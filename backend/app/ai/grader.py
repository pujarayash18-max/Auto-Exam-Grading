import asyncio

async def evaluate_answer(question_text: str, expected_answer: str, transcript: str) -> dict:
    """
    Simulates calling an LLM (e.g. Ollama) to grade the student's answer.
    """
    # Simulate API latency
    await asyncio.sleep(1)
    
    # Very basic mock grading logic based on length for demonstration
    if not transcript or len(transcript) < 5:
        score = 0.0
        feedback = "Answer is too short or missing."
    elif len(transcript) > 50:
        score = 100.0
        feedback = "Excellent and detailed answer."
    else:
        score = 50.0
        feedback = "Partial answer provided."
        
    return {
        "score": score,
        "feedback": feedback
    }

async def calculate_final_grade(total_score: float, max_possible: float, grading_schemes: list) -> str:
    """
    Maps the total score to a grade based on the grading scheme.
    """
    if max_possible == 0:
        return "F"
        
    percentage = (total_score / max_possible) * 100
    
    # grading_schemes is expected to be a list of GradingScheme models
    for scheme in grading_schemes:
        if scheme.min_marks <= percentage <= scheme.max_marks:
            return scheme.grade_label
            
    return "F"
