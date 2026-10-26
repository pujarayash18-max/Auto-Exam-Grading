import os
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


def parse_numbered_block(block: str) -> tuple[str, str]:
    """
    Parses a numbered block from a table or list into (question, answer).
    Handles explicit answer tags, question mark splits, and multi-sentence answers.
    """
    import re
    block = block.strip()
    if not block:
        return "", ""

    # 1. Explicit answer marker: Answer:, Ans:, Solution:, or A: (requires punctuation after single letter)
    ans_match = re.search(
        r'(?:\n|^)\s*(?:(?:Answer|Ans|Solution|Explanation|Expected Answer)\s*[:\.\-]?|A\s*[:\.\-])\s*', 
        block, 
        re.IGNORECASE
    )
    if ans_match:
        return clean_text(block[:ans_match.start()]), clean_text(block[ans_match.end():])

    # 2. Question mark split
    if '?' in block:
        parts = block.split('?', 1)
        return clean_text(parts[0] + '?'), clean_text(parts[1])

    # 3. Sentence split: period followed by newline and capital letter starting next sentence
    sentences = re.split(r'(?<=\.)\s*\n\s*(?=[A-Z0-9])', block)
    if len(sentences) >= 2:
        return clean_text(sentences[0]), clean_text(' '.join(sentences[1:]))

    # If the block ends with a period, question mark, or colon and wasn't split, it's a question only
    if clean_text(block).endswith(('.', '?', ':')):
        return clean_text(block), ""

    # 4. Paragraph break split
    if '\n\n' in block:
        p_parts = block.split('\n\n', 1)
        return clean_text(p_parts[0]), clean_text(p_parts[1])

    return clean_text(block), ""


def extract_qa_from_text(raw_text: str) -> list[dict[str, str]]:
    """
    Parses structured question-and-answer pairs or questions from extracted document text.
    Returns a list of dicts: [{'question_text': str, 'expected_answer': str}]
    """
    import re
    if not raw_text or not raw_text.strip():
        return []

    # Strategy 1: Numbered table rows / list items (e.g. \n 1\n, \n1.\n, \n1)\n)
    numbered_blocks = re.split(r'(?:^|\n)\s*(\d+)[\.\)]?\s*\n', raw_text)
    if len(numbered_blocks) >= 5:  # at least 2 numbered items
        table_items = []
        for i in range(1, len(numbered_blocks), 2):
            num = numbered_blocks[i]
            block = numbered_blocks[i+1].strip()
            if not block or len(block) < 5:
                continue
            q, a = parse_numbered_block(block)
            if q and len(q) > 5:
                table_items.append({'question_text': q, 'expected_answer': a})
        if len(table_items) >= 2:
            return table_items

    # Strategy 2: Explicit Tagged Q: and A: blocks
    qa_pairs = []
    pattern = re.compile(
        r'(?:^|\n)\s*(?:(?:Q(?:uestion)?[\s\.\-_]*\d*|\d+[\.\)])\s*[:\.\-]?\s*)(.*?)(?=\n\s*(?:(?:Answer|Ans|Solution|Explanation|Expected Answer)\s*[:\.\-]?|A\s*[:\.\-])\s*)'
        r'\n\s*(?:(?:Answer|Ans|Solution|Explanation|Expected Answer)\s*[:\.\-]?|A\s*[:\.\-])\s*(.*?)(?=(?:\n\s*(?:Q(?:uestion)?[\s\.\-_]*\d*|\d+[\.\)])\s*[:\.\-]?\s*)|\Z)',
        re.IGNORECASE | re.DOTALL
    )
    for m in pattern.finditer(raw_text):
        q = clean_text(m.group(1))
        a = clean_text(m.group(2))
        if len(q) > 3:
            qa_pairs.append({'question_text': q, 'expected_answer': a})

    if qa_pairs:
        return qa_pairs

    # Strategy 3: Numbered questions ending with question marks
    q_only_pattern = re.compile(
        r'(?:^|\n)\s*(?:(?:Q(?:uestion)?[\s\.\-_]*\d*|\d+[\.\)])\s*[:\.\-]?\s*)([A-Z][^\n]+?\?)',
        re.IGNORECASE
    )
    q_matches = q_only_pattern.findall(raw_text)
    if len(q_matches) >= 2:
        return [{'question_text': clean_text(q), 'expected_answer': ''} for q in q_matches if len(q.strip()) > 5]

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
