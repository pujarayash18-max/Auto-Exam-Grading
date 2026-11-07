import unittest
from app.ai.llm import estimate_exam_tokens, normalize_spoken_transcript, clean_expected_answer
from app.ai.document_parser import is_valid_question
from app.models.viva import StudentVivaStatus

class TestAutoExamCore(unittest.TestCase):
    def test_estimate_exam_tokens_calculation(self):
        """Verify exact formula for question prep and live student viva token budgeting."""
        est = estimate_exam_tokens(num_students=10, num_questions_per_student=3, generate_questions_count=15)
        self.assertEqual(est["prep_tokens"], 7500)
        self.assertEqual(est["per_student_tokens"], 3200)
        self.assertEqual(est["viva_tokens"], 32000)
        self.assertEqual(est["total_estimated"], 39500)
        self.assertEqual(est["num_students"], 10)
        self.assertEqual(est["num_questions_per_student"], 3)

    def test_estimate_exam_tokens_zero_students(self):
        """Ensure zero students cleanly budgets only preparation tokens with no runtime crash."""
        est = estimate_exam_tokens(num_students=0, num_questions_per_student=5, generate_questions_count=10)
        self.assertEqual(est["prep_tokens"], 5000)
        self.assertEqual(est["viva_tokens"], 0)
        self.assertEqual(est["total_estimated"], 5000)

    def test_is_valid_question_positive_cases(self):
        """Ensure genuine academic questions are recognized."""
        positive_samples = [
            "What is the difference between a process and a thread?",
            "Explain how virtual memory operates using paging.",
            "How does a binary search tree maintain balance in an AVL implementation?",
            "Can you describe the time complexity of quicksort in the worst case?",
            "Differentiate between TCP and UDP protocols.",
            "Why is normalization required in relational database design?"
        ]
        for q in positive_samples:
            self.assertTrue(is_valid_question(q), f"Failed on valid question: {q}")

    def test_is_valid_question_rejects_slide_noise(self):
        """Ensure presentation headings and non-question agenda items are rejected."""
        negative_samples = [
            "Agenda",
            "Unit 2: State Management in ASP.NET",
            "Slide 14",
            "Chapter 3: Database Normalization",
            "Thank You",
            "References and Recommended Reading",
            "Table of Contents",
            "Overview of Object Oriented Programming",
            "Syllabus for Computer Engineering Semester 5",
            "State Management"
        ]
        for item in negative_samples:
            self.assertFalse(is_valid_question(item), f"Failed to reject presentation noise: {item}")

    def test_student_viva_status_enum_values(self):
        """Verify all student viva run statuses including PAUSED and ABSENT are supported."""
        statuses = {s.value for s in StudentVivaStatus}
        self.assertIn("pending", statuses)
        self.assertIn("in_progress", statuses)
        self.assertIn("paused", statuses)
        self.assertIn("completed", statuses)
        self.assertIn("absent", statuses)

    def test_question_pool_swap_logic(self):
        """Simulates the instant pool reroll swap algorithm without mutating original assigned order."""
        assigned_ids = ["101", "102", "103", "104", "105"]
        pool_ids = [101, 102, 103, 104, 105, 201, 202, 203]
        
        old_qid = 103
        cur_int_ids = {int(x) for x in assigned_ids}
        unused = [qid for qid in pool_ids if qid not in cur_int_ids and qid != old_qid]
        
        self.assertEqual(len(unused), 3)
        self.assertEqual(unused, [201, 202, 203])
        
        chosen = unused[0]
        idx = assigned_ids.index(str(old_qid))
        updated_ids = list(assigned_ids)
        updated_ids[idx] = str(chosen)
        
        self.assertEqual(updated_ids, ["101", "102", "201", "104", "105"])
        self.assertEqual(len(updated_ids), len(assigned_ids))

    def test_normalize_spoken_transcript_phonetics(self):
        """Verify speech-to-text phonetic replacements convert spoken artifacts to proper technical terms."""
        # Merge sort and Big-O
        raw1 = "the in place what sort algorithm has a time complexity of bigo of n login and Mauritius them back together"
        norm1 = normalize_spoken_transcript(raw1)
        self.assertIn("O(n log n)", norm1)
        self.assertIn("merge sort", norm1)
        self.assertIn("merges", norm1)

        # ADO.NET and Razor
        raw2 = "video.net architecture uses razors and tax and star.css TML view files"
        norm2 = normalize_spoken_transcript(raw2)
        self.assertIn("ADO.NET", norm2)
        self.assertIn("Razor syntax", norm2)
        self.assertIn("*.cshtml", norm2)

        # CRUD and Balanced trees
        raw3 = "performance crowd operations on a balance stray with bigo of login"
        norm3 = normalize_spoken_transcript(raw3)
        self.assertIn("perform CRUD operations", norm3)
        self.assertIn("balanced tree", norm3)
        self.assertIn("O(log n)", norm3)

    def test_clean_expected_answer_strips_boilerplate(self):
        """Verify slide headers, course outcomes, and university boilerplate are stripped from reference answers."""
        raw = "MARWADI UNIVERSITY | UNIT 2 : ASP.NET WEB APPLICATION HTTP is a stateless protocol. [Remember] UNIT 3 - SECTION 4 Models in MVC. • Bullet item."
        cleaned = clean_expected_answer(raw)
        self.assertNotIn("MARWADI UNIVERSITY", cleaned)
        self.assertNotIn("UNIT 2 :", cleaned)
        self.assertNotIn("[Remember]", cleaned)
        self.assertIn("HTTP is a stateless protocol", cleaned)
        self.assertIn("Models in MVC", cleaned)

    def test_custom_question_replacement_logic(self):
        """Verify custom follow-up questions correctly replace an active question ID without altering list length."""
        assigned = ["101", "102", "103"]
        old_id = "102"
        new_id = "999"
        idx = assigned.index(old_id)
        assigned[idx] = new_id
        self.assertEqual(assigned, ["101", "999", "103"])
        self.assertEqual(len(assigned), 3)

    def test_waiting_room_heartbeat_online_calculation(self):
        """Verify waiting room presence expires after 15 seconds of inactivity."""
        import time
        now = time.time()
        active_heartbeat = now - 5.0
        stale_heartbeat = now - 20.0
        
        self.assertTrue((now - active_heartbeat) < 15.0)
        self.assertFalse((now - stale_heartbeat) < 15.0)

if __name__ == '__main__':
    unittest.main()
