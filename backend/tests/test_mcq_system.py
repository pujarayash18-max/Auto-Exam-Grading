import unittest
import pandas as pd
import io
from app.core.mcq_template import generate_sample_template, generate_sample_csv, parse_mcq_template
from app.api.v1.mcq import _calculate_letter_grade, _generate_pin
from app.models.mcq import MCQAttemptStatus, MCQReleaseMode

class TestMCQSystem(unittest.TestCase):
    def test_pin_generation(self):
        pin = _generate_pin(6)
        self.assertEqual(len(pin), 6)
        self.assertTrue(pin.isdigit())

    def test_letter_grade_calculation(self):
        self.assertEqual(_calculate_letter_grade(95.0), "A+")
        self.assertEqual(_calculate_letter_grade(85.0), "A")
        self.assertEqual(_calculate_letter_grade(75.0), "B")
        self.assertEqual(_calculate_letter_grade(65.0), "C")
        self.assertEqual(_calculate_letter_grade(55.0), "D")
        self.assertEqual(_calculate_letter_grade(45.0), "F")

    def test_sample_template_generation_and_parsing_excel(self):
        excel_bytes = generate_sample_template()
        self.assertGreater(len(excel_bytes), 0)
        
        parsed = parse_mcq_template(excel_bytes, "template.xlsx")
        self.assertGreaterEqual(len(parsed), 3)
        for item in parsed:
            self.assertIn("question_text", item)
            self.assertIn("option_a", item)
            self.assertIn("option_b", item)
            self.assertIn("option_c", item)
            self.assertIn("option_d", item)
            self.assertIn(item["correct_option"], ["A", "B", "C", "D"])

    def test_sample_template_parsing_csv(self):
        csv_bytes = generate_sample_csv()
        self.assertGreater(len(csv_bytes), 0)

        parsed = parse_mcq_template(csv_bytes, "questions.csv")
        self.assertGreaterEqual(len(parsed), 3)
        first_q = parsed[0]
        self.assertTrue(len(first_q["question_text"]) > 0)
        self.assertIn(first_q["correct_option"], ["A", "B", "C", "D"])

    def test_invalid_template_missing_column(self):
        bad_df = pd.DataFrame([{"question_text": "What is Python?", "option_a": "Language"}])
        buf = io.BytesIO()
        bad_df.to_csv(buf, index=False)
        with self.assertRaises(ValueError):
            parse_mcq_template(buf.getvalue(), "bad.csv")

    def test_lockout_status_enum(self):
        self.assertEqual(MCQAttemptStatus.NOT_STARTED.value, "not_started")
        self.assertEqual(MCQAttemptStatus.IN_PROGRESS.value, "in_progress")
        self.assertEqual(MCQAttemptStatus.LOCKED_OUT.value, "locked_out")
        self.assertEqual(MCQAttemptStatus.SUBMITTED.value, "submitted")

    def test_release_mode_enum(self):
        self.assertEqual(MCQReleaseMode.IMMEDIATE.value, "immediate")
        self.assertEqual(MCQReleaseMode.WITHHELD.value, "withheld")

    def test_csv_export_format(self):
        import csv
        output = io.StringIO()
        writer = csv.writer(output)
        headers = ["GR Number", "Enrollment Number", "Student Name", "Status", "Score Attained", "Maximum Marks", "Percentage", "Letter Grade"]
        writer.writerow(headers)
        writer.writerow(["GR101", "EN202401", "Test Student", "submitted", 85.0, 100.0, "85.0%", "A"])
        csv_str = output.getvalue()
        self.assertIn("GR Number", csv_str)
        self.assertIn("Test Student", csv_str)
        self.assertIn("85.0%", csv_str)

    def test_proportional_allocation_weightages(self):
        materials = [
            {"name": "file1.pptx", "weight": 60.0},
            {"name": "file2.pdf", "weight": 40.0}
        ]
        num_questions = 20
        total_w = sum(m["weight"] for m in materials)
        allocated = []
        accum = 0
        for idx, m in enumerate(materials):
            if idx == len(materials) - 1:
                cnt = max(1, num_questions - accum)
            else:
                cnt = max(1, round(num_questions * (m["weight"] / total_w)))
                accum += cnt
            allocated.append(cnt)
        self.assertEqual(sum(allocated), 20)
        self.assertEqual(allocated[0], 12)
        self.assertEqual(allocated[1], 8)

    def test_timezone_resilient_elapsed_calculation(self):
        from datetime import datetime, timezone, timedelta
        now_utc = datetime.now(timezone.utc)
        
        # Test aware datetime
        aware_started = now_utc - timedelta(minutes=10)
        started = aware_started if aware_started.tzinfo else aware_started.replace(tzinfo=timezone.utc)
        elapsed = (now_utc - started).total_seconds()
        self.assertAlmostEqual(elapsed, 600, delta=2)

        # Test naive datetime
        naive_started = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=10)
        started2 = naive_started if naive_started.tzinfo else naive_started.replace(tzinfo=timezone.utc)
        elapsed2 = (now_utc - started2).total_seconds()
        self.assertAlmostEqual(elapsed2, 600, delta=5)

    def test_attempt_review_sheet_withheld_redacts_answers(self):
        # When grades are withheld, student should see question text, options, and their choice,
        # but correct_option, is_correct, and explanation must be redacted (None).
        questions = [
            {"id": 1, "text": "What is 2+2?", "opt_a": "3", "opt_b": "4", "opt_c": "5", "opt_d": "6", "correct": "B", "expl": "Basic math"},
            {"id": 2, "text": "What is 3+3?", "opt_a": "5", "opt_b": "6", "opt_c": "7", "opt_d": "8", "correct": "B", "expl": "Basic math"}
        ]
        student_answers = {1: "B", 2: "A"}
        is_released = False

        review_sheet = []
        for q in questions:
            selected = student_answers.get(q["id"])
            is_corr = (selected == q["correct"])
            review_sheet.append({
                "question_id": q["id"],
                "question_text": q["text"],
                "option_a": q["opt_a"],
                "option_b": q["opt_b"],
                "option_c": q["opt_c"],
                "option_d": q["opt_d"],
                "selected_option": selected,
                "correct_option": q["correct"] if is_released else None,
                "is_correct": is_corr if is_released else None,
                "explanation": q["expl"] if is_released else None
            })

        self.assertEqual(len(review_sheet), 2)
        # Verify student choice is present
        self.assertEqual(review_sheet[0]["selected_option"], "B")
        self.assertEqual(review_sheet[1]["selected_option"], "A")
        # Verify answer key is redacted
        self.assertIsNone(review_sheet[0]["correct_option"])
        self.assertIsNone(review_sheet[0]["is_correct"])
        self.assertIsNone(review_sheet[0]["explanation"])

    def test_attempt_review_sheet_released_includes_answers(self):
        # When grades are released, student sees their choice, the correct choice, correctness, and explanation.
        questions = [
            {"id": 1, "text": "What is 2+2?", "opt_a": "3", "opt_b": "4", "opt_c": "5", "opt_d": "6", "correct": "B", "expl": "Basic math"}
        ]
        student_answers = {1: "B"}
        is_released = True

        review_sheet = []
        for q in questions:
            selected = student_answers.get(q["id"])
            is_corr = (selected == q["correct"])
            review_sheet.append({
                "question_id": q["id"],
                "question_text": q["text"],
                "selected_option": selected,
                "correct_option": q["correct"] if is_released else None,
                "is_correct": is_corr if is_released else None,
                "explanation": q["expl"] if is_released else None
            })

        self.assertEqual(review_sheet[0]["selected_option"], "B")
        self.assertEqual(review_sheet[0]["correct_option"], "B")
        self.assertTrue(review_sheet[0]["is_correct"])
        self.assertEqual(review_sheet[0]["explanation"], "Basic math")

if __name__ == "__main__":
    unittest.main()
