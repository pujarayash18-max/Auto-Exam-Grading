import unittest
import os
import re
from app.ai.document_parser import clean_subject_name, sanitize_exam_text, extract_presentation_topics
from app.ai.mcq_generator import generate_mcq_from_material

class TestMCQGenerationAndSanitization(unittest.TestCase):

    def test_clean_subject_name(self):
        # 1. Subject with parenthesized PPT filename
        self.assertEqual(clean_subject_name(".NET (Unit 3 -  ASP.NET MVC.pptx)"), ".NET")
        # 2. Subject with hyphenated unit
        self.assertEqual(clean_subject_name("Data Structures - Unit 2"), "Data Structures")
        # 3. Subject with trailing file extension
        self.assertEqual(clean_subject_name("Operating Systems.pdf"), "Operating Systems")
        # 4. Clean subject remains unchanged
        self.assertEqual(clean_subject_name("Computer Networks"), "Computer Networks")
        # 5. Empty or whitespace
        self.assertEqual(clean_subject_name(""), "General")

    def test_sanitize_exam_text(self):
        # Case 1: Filename in parentheses with placeholder
        bad_1 = "In .NET (Unit 3 - ASP.NET MVC.pptx), which of the following best represents standard best practices for topic component #2?"
        clean_1 = sanitize_exam_text(bad_1)
        self.assertNotIn(".pptx", clean_1)
        self.assertNotIn("Unit 3", clean_1)
        self.assertNotIn("topic component", clean_1)
        self.assertTrue(clean_1.endswith("?"))

        # Case 2: Meta references to slide and document
        bad_2 = "According to Unit 3, slide 12 of ASP.NET MVC.pptx, what is the role of the Controller?"
        clean_2 = sanitize_exam_text(bad_2)
        self.assertNotIn("Unit 3", clean_2)
        self.assertNotIn("slide 12", clean_2)
        self.assertNotIn(".pptx", clean_2)
        self.assertEqual(clean_2, "What is the role of the Controller?")

        # Case 3: 'Based on the provided slides'
        bad_3 = "Based on the provided slides, which component manages database data?"
        clean_3 = sanitize_exam_text(bad_3)
        self.assertNotIn("provided slides", clean_3)
        self.assertEqual(clean_3, "Which component manages database data?")

        # Case 4: Explanation text with material reference
        bad_4 = "As explained in Unit 3, the Model component represents domain logic."
        clean_4 = sanitize_exam_text(bad_4)
        self.assertNotIn("Unit 3", clean_4)
        self.assertIn("Model component represents domain logic", clean_4)

    def test_extract_presentation_topics_from_pptx(self):
        sample_path = "backend/uploads/mcq_materials/11_Unit 3 -  ASP.NET MVC.pptx"
        if not os.path.exists(sample_path):
            self.skipTest("Sample PPTX not present in uploads")

        chunks, concepts = extract_presentation_topics(file_path=sample_path)
        self.assertGreater(len(chunks), 0)
        self.assertGreater(len(concepts), 0)

        # Ensure no concept has university banner or unit number
        for term, desc in concepts:
            self.assertFalse(re.search(r'MARWADI\s+UNIVERSITY', term, re.I))
            self.assertFalse(re.search(r'UNIT\s+\d+', term, re.I))
            self.assertFalse(re.search(r'\.pptx', term, re.I))
            self.assertFalse(re.search(r'\.pptx', desc, re.I))
            self.assertFalse(re.search(r'MARWADI\s+UNIVERSITY', desc, re.I))

    async def _async_mcq_generation_quality(self):
        sample_path = "backend/uploads/mcq_materials/11_Unit 3 -  ASP.NET MVC.pptx"
        if not os.path.exists(sample_path):
            self.skipTest("Sample PPTX not present in uploads")

        # Generate 5 questions using material and PPT
        qs = await generate_mcq_from_material(
            content_text="",
            file_path=sample_path,
            num_questions=5,
            subject=".NET (Unit 3 -  ASP.NET MVC.pptx)",
            enable_blooms_taxonomy=True
        )

        self.assertEqual(len(qs), 5)
        for q in qs:
            q_text = q["question_text"]
            self.assertNotIn(".pptx", q_text)
            self.assertNotIn("Unit 3", q_text)
            self.assertNotIn("topic component", q_text)
            self.assertIn(q["correct_option"], ["A", "B", "C", "D"])
            self.assertTrue(len(q["option_a"]) > 0)
            self.assertTrue(len(q["option_b"]) > 0)
            self.assertTrue(len(q["option_c"]) > 0)
            self.assertTrue(len(q["option_d"]) > 0)
            self.assertTrue(len(q["explanation"]) > 0)

    def test_async_mcq_generation(self):
        import asyncio
        asyncio.run(self._async_mcq_generation_quality())

if __name__ == "__main__":
    unittest.main()
