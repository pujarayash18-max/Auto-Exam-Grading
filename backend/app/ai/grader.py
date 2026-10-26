from typing import List
from app.ai.llm import evaluate_answer

async def calculate_final_grade(total_score: float, max_possible: float, grading_schemes: list) -> str:
    """
    Maps the total score to a letter grade based on the configured grading schemes or standard scale.
    """
    if max_possible <= 0:
        return "F"
        
    percentage = (total_score / max_possible) * 100
    
    if grading_schemes:
        for scheme in grading_schemes:
            if scheme.min_marks <= percentage <= scheme.max_marks:
                return scheme.grade_label
                
    # Standard academic grading scale if no explicit scheme configured
    if percentage >= 90:
        return "A+"
    elif percentage >= 80:
        return "A"
    elif percentage >= 70:
        return "B"
    elif percentage >= 60:
        return "C"
    elif percentage >= 50:
        return "D"
    else:
        return "F"
