import json
import logging
import re
from typing import List, Dict, Any
from app.ai.llm import dispatch_llm_call, _strip_markdown_fences

logger = logging.getLogger("uvicorn.error")

def _extract_mcq_array(raw_text: str) -> List[Dict[str, Any]]:
    if not raw_text:
        return []
    cleaned = _strip_markdown_fences(raw_text)

    # 1. Direct JSON parse
    try:
        data = json.loads(cleaned)
        if isinstance(data, list):
            return [x for x in data if isinstance(x, dict)]
        if isinstance(data, dict):
            for k in ["questions", "items", "data", "mcqs", "result"]:
                if k in data and isinstance(data[k], list):
                    return [x for x in data[k] if isinstance(x, dict)]
    except Exception:
        pass

    # 2. Slice between outer [ and ]
    start = cleaned.find("[")
    end = cleaned.rfind("]")
    if start != -1 and end != -1 and end > start:
        try:
            data = json.loads(cleaned[start:end + 1])
            if isinstance(data, list):
                return [x for x in data if isinstance(x, dict)]
        except Exception:
            pass

    # 3. Regex block matching for each object
    items = []
    blocks = re.findall(r'\{[^{}]*?"question_text"[^{}]*?\}', cleaned, re.DOTALL)
    for b in blocks:
        try:
            obj = json.loads(b)
            if isinstance(obj, dict) and "question_text" in obj:
                items.append(obj)
        except Exception:
            continue
    return items

async def generate_mcq_from_material(
    content_text: str,
    num_questions: int = 5,
    subject: str = "General",
    faculty_id: int = None,
    exam_id: int = None,
    enable_blooms_taxonomy: bool = True
) -> List[Dict[str, Any]]:
    """
    Calls the LLM to generate high quality Multiple Choice Questions based on provided course notes or slides.
    Supports optional Bloom's Taxonomy cognitive distribution.
    """
    num_questions = max(1, min(num_questions, 25))
    truncated_content = content_text[:8000] if content_text else ""

    blooms_req = (
        '5. "bloom_level": Balance questions across Bloom\'s Taxonomy levels ("Remember", "Understand", "Apply", "Analyze"). Specify the level for each question.'
        if enable_blooms_taxonomy
        else '5. "bloom_level": Set value to "Standard". Do not constrain by Bloom\'s taxonomy.'
    )

    prompt = f"""You are a senior academic professor preparing a rigorous Multiple Choice Question (MCQ) assessment for the subject '{subject}'.

Generate exactly {num_questions} objective multiple choice questions based on the reference notes provided below.

REFERENCE MATERIAL:
\"\"\"
{truncated_content if truncated_content else f"Core fundamental concepts of {subject}."}
\"\"\"

STRICT REQUIREMENTS FOR EACH QUESTION:
1. "question_text": Clear, unambiguous, academic question stem. Do NOT write "According to the slide" or "Based on the text". Frame it as a direct assessment question.
2. "option_a", "option_b", "option_c", "option_d": Four distinct, plausible, mutually exclusive answer choices.
3. "correct_option": The single correct option letter. Must be strictly "A", "B", "C", or "D".
4. "explanation": A 1-2 sentence concise explanation justifying why the correct option is right.
{blooms_req}

OUTPUT FORMAT:
Return ONLY a valid JSON array of objects with no conversational wrapper.
Example schema:
[
  {{
    "question_text": "Which property ensures that a transaction is all-or-nothing in database management systems?",
    "option_a": "Atomicity",
    "option_b": "Consistency",
    "option_c": "Isolation",
    "option_d": "Durability",
    "correct_option": "A",
    "explanation": "Atomicity ensures that all statements in a transaction either complete successfully or are rolled back completely.",
    "bloom_level": "{"Remember" if enable_blooms_taxonomy else "Standard"}"
  }}
]
"""

    try:
        response_text = await dispatch_llm_call(
            prompt=prompt,
            json_format=True,
            operation_type="question_generation",
            faculty_id=faculty_id,
            exam_id=exam_id,
            temperature=0.4
        )
        raw_items = _extract_mcq_array(response_text)
    except Exception as e:
        logger.error(f"Error calling LLM for MCQ generation: {e}")
        raw_items = []

    validated_questions: List[Dict[str, Any]] = []
    for item in raw_items:
        q_text = str(item.get("question_text") or "").strip()
        opt_a = str(item.get("option_a") or "").strip()
        opt_b = str(item.get("option_b") or "").strip()
        opt_c = str(item.get("option_c") or "").strip()
        opt_d = str(item.get("option_d") or "").strip()
        correct = str(item.get("correct_option") or "").strip().upper()
        
        # Clean correct option
        if correct not in ["A", "B", "C", "D"]:
            for choice in ["A", "B", "C", "D"]:
                if correct.startswith(choice):
                    correct = choice
                    break
        if correct not in ["A", "B", "C", "D"]:
            correct = "A"

        if q_text and opt_a and opt_b and opt_c and opt_d:
            validated_questions.append({
                "question_text": q_text,
                "option_a": opt_a,
                "option_b": opt_b,
                "option_c": opt_c,
                "option_d": opt_d,
                "correct_option": correct,
                "explanation": str(item.get("explanation") or "").strip() or f"Option {correct} is the correct answer.",
                "bloom_level": (str(item.get("bloom_level") or "Understand").strip()) if enable_blooms_taxonomy else "Standard"
            })

    # If the LLM didn't return enough questions or failed, add fallback syllabus-based questions
    if len(validated_questions) < num_questions:
        needed = num_questions - len(validated_questions)
        for i in range(needed):
            idx = len(validated_questions) + 1
            validated_questions.append({
                "question_text": f"In {subject}, which of the following best represents standard best practices for topic component #{idx}?",
                "option_a": f"High modularity, strong cohesion, and loose coupling",
                "option_b": f"Hardcoded dependencies and global mutable state",
                "option_c": f"Unbounded recursion without base termination conditions",
                "option_d": f"Bypassing security validation and boundary checks",
                "correct_option": "A",
                "explanation": "Decoupled architecture and high cohesion represent fundamental principles of maintainable and scalable design.",
                "bloom_level": "Understand" if enable_blooms_taxonomy else "Standard"
            })

    return validated_questions[:num_questions]
