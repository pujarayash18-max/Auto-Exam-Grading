import io
import pandas as pd
from typing import List, Dict, Any

SAMPLE_QUESTIONS = [
    {
        "question_text": "Which data structure uses LIFO (Last In First Out) ordering?",
        "option_a": "Queue",
        "option_b": "Stack",
        "option_c": "Binary Search Tree",
        "option_d": "Graph",
        "correct_option": "B",
        "explanation": "A Stack operates on a Last In First Out (LIFO) order where the last element inserted is the first to be popped.",
        "bloom_level": "Remember"
    },
    {
        "question_text": "What is the worst-case time complexity of standard QuickSort algorithm?",
        "option_a": "O(n)",
        "option_b": "O(n log n)",
        "option_c": "O(n^2)",
        "option_d": "O(log n)",
        "correct_option": "C",
        "explanation": "When the chosen pivot is continually the smallest or largest element, the recursion degenerates to O(n^2).",
        "bloom_level": "Understand"
    },
    {
        "question_text": "In SQL, which clause is used to filter records resulting from an aggregate function like COUNT() or AVG()?",
        "option_a": "WHERE",
        "option_b": "HAVING",
        "option_c": "FILTER",
        "option_d": "ORDER BY",
        "correct_option": "B",
        "explanation": "HAVING filters grouped aggregates after GROUP BY, whereas WHERE filters rows before aggregation.",
        "bloom_level": "Apply"
    },
    {
        "question_text": "Which HTTP status code signifies that a requested resource was not found on the server?",
        "option_a": "200",
        "option_b": "401",
        "option_c": "403",
        "option_d": "404",
        "correct_option": "D",
        "explanation": "404 Not Found indicates that the origin server did not find a current representation for the target resource.",
        "bloom_level": "Remember"
    }
]

def generate_sample_template() -> bytes:
    """
    Generates an Excel (.xlsx) byte stream containing standard headers and sample MCQ questions.
    """
    df = pd.DataFrame(SAMPLE_QUESTIONS)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="MCQ_Template")
    return output.getvalue()

def generate_sample_csv() -> bytes:
    """
    Generates a CSV byte stream containing standard headers and sample MCQ questions.
    """
    df = pd.DataFrame(SAMPLE_QUESTIONS)
    return df.to_csv(index=False).encode("utf-8")

def parse_mcq_template(file_bytes: bytes, filename: str) -> List[Dict[str, Any]]:
    """
    Parses an uploaded Excel or CSV file into a validated list of question dictionaries.
    """
    filename_lower = filename.lower()
    bio = io.BytesIO(file_bytes)
    
    if filename_lower.endswith(".csv"):
        df = pd.read_csv(bio)
    elif filename_lower.endswith((".xlsx", ".xls")):
        df = pd.read_excel(bio)
    else:
        raise ValueError("Unsupported file format. Please upload an Excel (.xlsx/.xls) or CSV (.csv) file.")
    
    if df.empty:
        raise ValueError("The uploaded file contains no data.")

    # Normalize column names: strip and lowercase
    col_mapping = {}
    for col in df.columns:
        norm = str(col).strip().lower().replace(" ", "_")
        col_mapping[norm] = col

    def find_col(candidates: List[str]) -> str:
        for c in candidates:
            if c in col_mapping:
                return col_mapping[c]
        return None

    q_col = find_col(["question_text", "question", "prompt", "question_prompt", "questiontext"])
    a_col = find_col(["option_a", "optiona", "choice_a", "a"])
    b_col = find_col(["option_b", "optionb", "choice_b", "b"])
    c_col = find_col(["option_c", "optionc", "choice_c", "c"])
    d_col = find_col(["option_d", "optiond", "choice_d", "d"])
    ans_col = find_col(["correct_option", "correct_answer", "answer", "correct", "key", "correctoption"])
    exp_col = find_col(["explanation", "rationale", "reason", "solution", "remarks"])
    bloom_col = find_col(["bloom_level", "bloom", "difficulty", "level", "bloomlevel"])

    missing = []
    if not q_col: missing.append("question_text")
    if not a_col: missing.append("option_a")
    if not b_col: missing.append("option_b")
    if not c_col: missing.append("option_c")
    if not d_col: missing.append("option_d")
    if not ans_col: missing.append("correct_option")

    if missing:
        raise ValueError(f"Missing required columns in template: {', '.join(missing)}. Please use the downloadable template.")

    parsed_questions: List[Dict[str, Any]] = []
    errors: List[str] = []

    for idx, row in df.iterrows():
        row_num = idx + 2 # Header is row 1
        q_val = str(row[q_col]).strip() if pd.notna(row[q_col]) else ""
        if not q_val or q_val.lower() == "nan":
            continue # Skip blank rows
        
        opt_a = str(row[a_col]).strip() if pd.notna(row[a_col]) else ""
        opt_b = str(row[b_col]).strip() if pd.notna(row[b_col]) else ""
        opt_c = str(row[c_col]).strip() if pd.notna(row[c_col]) else ""
        opt_d = str(row[d_col]).strip() if pd.notna(row[d_col]) else ""
        ans_raw = str(row[ans_col]).strip().upper() if pd.notna(row[ans_col]) else ""
        
        # Check answer formatting
        # Handle cases like "Option A" or "A)" or just "A"
        clean_ans = ""
        for choice in ["A", "B", "C", "D"]:
            if ans_raw == choice or ans_raw.startswith(choice + ")") or ans_raw.startswith(choice + ".") or ans_raw.endswith(" " + choice):
                clean_ans = choice
                break
        if not clean_ans and ans_raw in ["A", "B", "C", "D"]:
            clean_ans = ans_raw

        if not clean_ans:
            # Also check if the answer text matches one of the option texts exactly
            if ans_raw.lower() == opt_a.lower(): clean_ans = "A"
            elif ans_raw.lower() == opt_b.lower(): clean_ans = "B"
            elif ans_raw.lower() == opt_c.lower(): clean_ans = "C"
            elif ans_raw.lower() == opt_d.lower(): clean_ans = "D"

        if not clean_ans:
            errors.append(f"Row {row_num}: Invalid correct_option '{ans_raw}'. Must be A, B, C, or D.")
            continue

        if not opt_a or not opt_b or not opt_c or not opt_d:
            errors.append(f"Row {row_num}: All 4 options (A, B, C, D) must have text.")
            continue

        explanation = str(row[exp_col]).strip() if exp_col and pd.notna(row[exp_col]) and str(row[exp_col]).lower() != "nan" else None
        bloom = str(row[bloom_col]).strip() if bloom_col and pd.notna(row[bloom_col]) and str(row[bloom_col]).lower() != "nan" else "Understand"

        parsed_questions.append({
            "question_text": q_val,
            "option_a": opt_a,
            "option_b": opt_b,
            "option_c": opt_c,
            "option_d": opt_d,
            "correct_option": clean_ans,
            "explanation": explanation,
            "bloom_level": bloom
        })

    if errors:
        raise ValueError(f"Template errors found:\n" + "\n".join(errors[:5]))

    if not parsed_questions:
        raise ValueError("No valid questions found in the template.")

    return parsed_questions
