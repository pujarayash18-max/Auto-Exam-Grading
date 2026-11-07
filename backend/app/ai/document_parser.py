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


def clean_subject_name(raw_name: str) -> str:
    """
    Strips file names, extensions (.pptx, .pdf, etc.), unit numbers,
    chapter numbers, parenthesized material names, and returns a clean academic subject name.
    e.g. '.NET (Unit 3 - ASP.NET MVC.pptx)' -> '.NET'
    e.g. 'Data Structures - Unit 2.pdf' -> 'Data Structures'
    """
    if not raw_name:
        return "General"
    s = str(raw_name).strip()
    # 1. Strip parenthesized file references like '(Unit 3 - ASP.NET MVC.pptx)'
    s = re.sub(r'\s*\([^)]*?\.(?:pptx?|pdf|docx?|txt)[^)]*?\)', '', s, flags=re.IGNORECASE)
    # 2. Strip parenthesized unit references like '(Unit 3)'
    s = re.sub(r'\s*\([^)]*?(?:unit|chapter|module)\s*\d+[^)]*?\)', '', s, flags=re.IGNORECASE)
    # 3. Strip standalone file extensions
    s = re.sub(r'\.(?:pptx?|pdf|docx?|txt)\b', '', s, flags=re.IGNORECASE)
    # 4. Strip unit/chapter indicators at end, e.g. ' - Unit 3' or ' : Chapter 2'
    s = re.sub(r'[\s\-–—:]+\s*(?:Unit|Chapter|Section|Module)\s*\d+.*$', '', s, flags=re.IGNORECASE)
    # 5. Clean up trailing/leading whitespace and punctuation
    s = re.sub(r'^[\s\-–—:]+|[\s\-–—:]+$', '', s).strip()
    return s if s else "General"


def sanitize_exam_text(text: str) -> str:
    """
    Strips any occurrences of:
    - Files or file extensions (.pptx, .pdf, Unit 3 - ASP.NET MVC.pptx, etc.)
    - Unit, chapter, slide, lecture, module, section numbers
    - Meta phrases like 'According to the material', 'Based on the slide', 'As mentioned in the notes'
    - Generic placeholders like 'topic component #2'
    Cleans up whitespace, capitalization, and dangling prepositions.
    """
    if not text:
        return ""
    t = str(text).strip()
    # 1. Remove parenthesized filename references
    t = re.sub(r'\s*\([^)]*?\.(?:pptx?|pdf|docx?|txt)[^)]*?\)', '', t, flags=re.IGNORECASE)
    # 2. Remove unparenthesized filename references
    t = re.sub(r'\b[A-Za-z0-9_\-.\s]+\.(?:pptx?|pdf|docx?|txt)\b', '', t, flags=re.IGNORECASE)
    # 3. Remove Unit/Chapter/Slide/Module references
    t = re.sub(r'\b(?:in\s+|from\s+|according to\s+|as per\s+|of\s+)?(?:unit|chapter|section|module|slide|lecture)\s*\d+[\s:\-–—]*', '', t, flags=re.IGNORECASE)
    t = re.sub(r'\b(?:unit|chapter|section|module|slide|lecture)\s*\d+\b', '', t, flags=re.IGNORECASE)
    # 4. Remove meta-material phrases
    t = re.sub(r'\b(?:according to|based on|as stated in|as per|in|of)\s+(?:the\s+)?(?:provided\s+)?(?:slides?|material|presentation|notes?|text|document|curriculum|syllabus)[\s,:]*', '', t, flags=re.IGNORECASE)
    # 5. Remove generic placeholders
    t = re.sub(r'topic\s+component\s*#?\d*', '', t, flags=re.IGNORECASE)
    t = re.sub(r'component\s*#\d+', '', t, flags=re.IGNORECASE)
    # 6. Clean dangling prepositions and leading punctuation
    t = re.sub(r'^[,\s:\-–—]+', '', t)
    t = re.sub(r'^\s*(?:In\s*,|According to\s*,|Based on\s*,|From\s*,|Of\s*,)\s*', '', t, flags=re.IGNORECASE)
    t = re.sub(r'^[,\s:\-–—]+', '', t)
    # 7. Normalize multiple spaces
    t = re.sub(r'\s{2,}', ' ', t).strip()
    # 8. Clean trailing dangling prepositions like 'practices for ?'
    t = re.sub(r'\s+for\s*\?', '?', t)
    # 9. Capitalize first letter
    if t and t[0].islower():
        t = t[0].upper() + t[1:]
    return t


def extract_presentation_topics(file_path: str = None, text_content: str = None) -> tuple[list[str], list[tuple[str, str]]]:
    """
    Extracts clean, substantive topic chunks and concrete (concept, definition) pairs
    from an uploaded presentation (.pptx) or lecture text.
    Filters out university banners, syllabus codes, slide numbers, and presentation boilerplate.
    """
    topic_chunks: list[str] = []
    raw_concepts: list[tuple[str, str]] = []

    noise_patterns = [
        re.compile(r'MARWADI\s+UNIVERSITY', re.I),
        re.compile(r'UNIT\s+\d+', re.I),
        re.compile(r'01CE\d+', re.I),
        re.compile(r'B\.TECH|SEMESTER', re.I),
        re.compile(r'COURSE\s+CODE|COURSE\s+OBJECTIVE|TABLE\s+OF\s+CONTENTS|AGENDA|WHAT\s+THIS\s+UNIT\s+COVERS|THANK\s+YOU|ANY\s+QUESTIONS\?', re.I),
        re.compile(r'^\d+$')
    ]

    delim_pat = re.compile(r'^(?:\d+[\.\)]\s*)?([A-Za-z0-9\s_\.\(\)\-]{2,35}?)(?:\s*[:—–]|\s+-\s+)\s*(.+)$')
    invalid_concept_terms = re.compile(
        r'^(?:Course|CO\d+|Credit|Unit|Chapter|Section|Semester|Faculty|Student|College|University|Table\s+of\s+Contents|Agenda|Slide|Note|Page|Step\s*\d*|Topic|Overview|Summary|Introduction|Demo|Code|Example|Http|Https|What\s+This\s+Shows|What\s+This\s+Unit\s+Covers|Purpose)',
        re.I
    )

    def is_valid_concept(term: str, desc: str) -> bool:
        if not term or not desc:
            return False
        t_clean = term.strip()
        d_clean = desc.strip()
        if len(t_clean) < 3 or len(t_clean) > 40:
            return False
        if len(d_clean) < 15 or len(d_clean) > 300:
            return False
        if invalid_concept_terms.search(t_clean):
            return False
        if re.search(r'\b(?:slide|unit|chapter|page|semester|university|b\.tech|01ce\d+)\b', d_clean, re.I):
            return False
        if d_clean.lower().startswith(('right-click', 'navigate to', 'click on', 'select add', 'create a project')):
            return False
        return True

    # 1. Parse directly from PPTX file if available
    if file_path and os.path.exists(file_path) and file_path.lower().endswith(('.ppt', '.pptx')):
        try:
            prs = Presentation(file_path)
            current_chunk: list[str] = []
            current_chunk_len = 0

            for idx, slide in enumerate(prs.slides):
                slide_lines: list[str] = []
                for shape in slide.shapes:
                    if hasattr(shape, 'text') and shape.text:
                        raw = shape.text.strip()
                        if any(p.search(raw) for p in noise_patterns):
                            continue
                        for line in raw.split('\n'):
                            l = line.strip()
                            if len(l) > 2 and not any(p.search(l) for p in noise_patterns):
                                slide_lines.append(l)

                # Deduplicate lines within slide
                seen = set()
                deduped = [x for x in slide_lines if not (x in seen or seen.add(x))]
                if len(deduped) < 2:
                    continue

                # A. Check for delimiter definition or concept
                for line in deduped:
                    m = delim_pat.match(line)
                    if m:
                        term = m.group(1).strip()
                        desc = m.group(2).strip()
                        if is_valid_concept(term, desc):
                            raw_concepts.append((term, desc))

                # B. Check slide title + substantive body lines
                title = re.sub(r'^(?:What is a|What is an|What is|Introduction to|Overview of)\s+', '', deduped[0], flags=re.I).strip()
                for body_line in deduped[1:4]:
                    if is_valid_concept(title, body_line):
                        raw_concepts.append((title, body_line))

                slide_text = '\n'.join(deduped)
                current_chunk.append(slide_text)
                current_chunk_len += len(slide_text)

                # Group slides into cohesive chunks (~1200 - 2000 chars)
                if current_chunk_len >= 1200:
                    topic_chunks.append('\n\n'.join(current_chunk))
                    current_chunk = []
                    current_chunk_len = 0

            if current_chunk:
                topic_chunks.append('\n\n'.join(current_chunk))
        except Exception as e:
            print(f"Error parsing presentation slides from {file_path}: {e}")

    # 2. Parse from text_content if chunks are still empty
    if not topic_chunks and text_content:
        lines = [l.strip() for l in text_content.splitlines() if l.strip()]
        cleaned_lines = []
        for l in lines:
            if any(p.search(l) for p in noise_patterns):
                continue
            cleaned_lines.append(l)
            m = delim_pat.match(l)
            if m:
                term = m.group(1).strip()
                desc = m.group(2).strip()
                if is_valid_concept(term, desc):
                    raw_concepts.append((term, desc))

        # Chunk lines
        curr = []
        curr_len = 0
        for l in cleaned_lines:
            curr.append(l)
            curr_len += len(l)
            if curr_len >= 1500:
                topic_chunks.append('\n'.join(curr))
                curr = []
                curr_len = 0
        if curr:
            topic_chunks.append('\n'.join(curr))

    # Deduplicate concepts by term
    concept_map: dict[str, str] = {}
    for term, desc in raw_concepts:
        if term not in concept_map:
            concept_map[term] = desc
    unique_concepts = list(concept_map.items())

    return topic_chunks, unique_concepts
