import os
import re
from pypdf import PdfReader
from pptx import Presentation

def extract_text(file_path: str, material_type: str) -> str:
    """Extracts text from a PDF or PPTX file."""
    text = ""
    if not os.path.exists(file_path):
        return ""
        
    try:
        if material_type.lower() == "pdf" or file_path.lower().endswith(".pdf"):
            reader = PdfReader(file_path)
            for page in reader.pages:
                text += page.extract_text() + "\n"
        elif material_type.lower() in ["ppt", "pptx"] or file_path.lower().endswith((".ppt", ".pptx")):
            prs = Presentation(file_path)
            for slide in prs.slides:
                for shape in slide.shapes:
                    if hasattr(shape, "text"):
                        text += shape.text + "\n"
    except Exception as e:
        print(f"Error extracting text from {file_path}: {e}")
        
    return text.strip()


def clean_text(text: str) -> str:
    """Normalizes whitespace and removes trailing punctuation artifacts."""
    return " ".join((text or "").strip().split())


def is_valid_question(text: str) -> bool:
    """
    Validates whether a text string has genuine question characteristics.
    Rejects generic slide headings, agenda items, and lecture bullet points.
    """
    q = clean_text(text)
    if len(q) < 8 or len(q.split()) < 3:
        return False

    lower = q.lower()
    # Reject common presentation / outline non-question noise
    reject_prefixes = (
        'agenda', 'unit ', 'slide ', 'page ', 'chapter ', 'table of contents',
        'thank you', 'references', 'contents', 'topic', 'learning objectives',
        'syllabus', 'course outcome', 'overview', 'summary', 'introduction'
    )
    if any(lower.startswith(w) for w in reject_prefixes):
        return False

    # Positive criterion 1: ends with a question mark
    if q.endswith('?'):
        return True

    # Strip any leading numbering like '1. ', '1) ', 'Q1: ', 'Question 1: '
    stripped = re.sub(r'^(?:q(?:uestion)?[\s\.\-_]*\d*|\d+[\.\)])\s*[:\.\-]?\s*', '', lower).strip()

    # Guard against 'State Management' or 'State Machine' being misidentified as imperative 'State the...'
    if stripped.startswith('state '):
        if any(stripped.startswith('state ' + n) for n in ['management', 'pattern', 'machine', 'diagram', 'space', 'variable', 'transition', 'model', 'table']):
            return False

    # Positive criterion 2: starts with standard interrogative / prompt words
    q_words = (
        'what', 'why', 'how', 'when', 'where', 'which', 'who', 'whose',
        'explain', 'describe', 'define', 'differentiate', 'distinguish',
        'compare', 'contrast', 'discuss', 'elaborate', 'state', 'list',
        'calculate', 'evaluate', 'justify', 'analyze', 'illustrate',
        'can', 'does', 'is', 'are', 'write a short note', 'give reasons'
    )
    return any(stripped.startswith(w + ' ') or stripped == w for w in q_words)


def parse_numbered_block(block: str) -> tuple[str, str]:
    """
    Parses a numbered block from a table or list into (question, answer).
    Only returns a pair if the question text satisfies strict question criteria.
    """
    block = block.strip()
    if not block:
        return "", ""

    # 1. Explicit answer marker: Answer:, Ans:, Solution:, Explanation:, or A:
    ans_match = re.search(
        r'(?:\n|^)\s*(?:(?:Answer|Ans|Solution|Explanation|Expected Answer)\s*[:\.\-]?|A\s*[:\.\-])\s*', 
        block, 
        re.IGNORECASE
    )
    if ans_match:
        q_part = clean_text(block[:ans_match.start()])
        a_part = clean_text(block[ans_match.end():])
        if is_valid_question(q_part):
            return q_part, a_part

    # 2. Question mark split
    if '?' in block:
        parts = block.split('?', 1)
        q_part = clean_text(parts[0] + '?')
        a_part = clean_text(parts[1])
        if is_valid_question(q_part):
            return q_part, a_part

    # 3. Explicit question without explicit answer (e.g. numbered question ending with period or newline)
    sentences = re.split(r'(?<=\.)\s*\n\s*(?=[A-Z0-9])', block)
    if sentences and is_valid_question(sentences[0]):
        return clean_text(sentences[0]), clean_text(' '.join(sentences[1:]))

    # If the first line of the block is a valid question
    first_line = block.split('\n')[0].strip()
    if is_valid_question(first_line):
        rest = '\n'.join(block.split('\n')[1:]).strip()
        return clean_text(first_line), clean_text(rest)

    # Not a question - reject
    return "", ""


def extract_qa_from_text(raw_text: str) -> list[dict[str, str]]:
    """
    Parses structured question-and-answer pairs or questions from extracted document text.
    Returns a list of dicts: [{'question_text': str, 'expected_answer': str}]
    Guarantees that slide decks and regular study notes are not falsely parsed as Q&A banks.
    """
    if not raw_text or not raw_text.strip():
        return []

    # Strategy 2: Explicit Tagged Q: and A: blocks (Highest confidence)
    qa_pairs = []
    pattern = re.compile(
        r'(?:^|\n)\s*(?:(?:Q(?:uestion)?[\s\.\-_]*\d*|\d+[\.\)])\s*[:\.\-]?\s*)(.*?)(?=\n\s*(?:(?:Answer|Ans|Solution|Explanation|Expected Answer)\s*[:\.\-]?|A\s*[:\.\-])\s*)'
        r'\n\s*(?:(?:Answer|Ans|Solution|Explanation|Expected Answer)\s*[:\.\-]?|A\s*[:\.\-])\s*(.*?)(?=(?:\n\s*(?:Q(?:uestion)?[\s\.\-_]*\d*|\d+[\.\)])\s*[:\.\-]?\s*)|\Z)',
        re.IGNORECASE | re.DOTALL
    )
    for m in pattern.finditer(raw_text):
        q = clean_text(m.group(1))
        a = clean_text(m.group(2))
        if is_valid_question(q):
            qa_pairs.append({'question_text': q, 'expected_answer': a})

    if len(qa_pairs) >= 2:
        return qa_pairs

    # Strategy 3: Numbered questions ending with question marks or question prompts
    q_only_pattern = re.compile(
        r'(?:^|\n)\s*(?:(?:Q(?:uestion)?[\s\.\-_]*\d*|\d+[\.\)])\s*[:\.\-]?\s*)([A-Z][^\n]+?)(?=\n|\Z)',
        re.IGNORECASE
    )
    q_matches = q_only_pattern.findall(raw_text)
    valid_q_matches = [clean_text(q) for q in q_matches if is_valid_question(q)]
    if len(valid_q_matches) >= 3:
        return [{'question_text': q, 'expected_answer': ''} for q in valid_q_matches]

    # Strategy 1: Numbered table rows / list items
    numbered_blocks = re.split(r'(?:^|\n)\s*(\d+)[\.\)]?\s*\n', raw_text)
    if len(numbered_blocks) >= 6:  # at least 3 numbered items
        table_items = []
        for i in range(1, len(numbered_blocks), 2):
            block = numbered_blocks[i+1].strip()
            if not block or len(block) < 5:
                continue
            q, a = parse_numbered_block(block)
            if q and is_valid_question(q):
                table_items.append({'question_text': q, 'expected_answer': a})

        total_sections = len(numbered_blocks) // 2
        # Strict guard: At least 3 genuine questions AND at least 40% of items must be real questions.
        # This prevents 100-slide presentations from being misinterpreted as Q&A documents.
        if len(table_items) >= 3 and len(table_items) >= max(3, int(total_sections * 0.4)):
            return table_items

    return []


def extract_qa_pairs(file_path: str, material_type: str = "") -> list[dict[str, str]]:
    """
    Extracts explicit questions and expected answers directly from an uploaded PDF, PPTX, or text file.
    """
    if not file_path or not os.path.exists(file_path):
        return []
        
    text = extract_text(file_path, material_type)
    if not text:
        return []

    return extract_qa_from_text(text)
