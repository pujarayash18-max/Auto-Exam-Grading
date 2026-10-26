import asyncio
from app.api.deps import AsyncSessionLocal
from sqlalchemy import select
from app.models.viva import StudentVivaRun, StudentVivaAnswer

async def populate():
    async with AsyncSessionLocal() as db:
        sr = await db.get(StudentVivaRun, 1)
        answers = (await db.execute(select(StudentVivaAnswer).where(StudentVivaAnswer.viva_run_id == 1))).scalars().all()
        evals = [
            ("Good conceptual definition of linked lists, but omitted doubly-linked list pointer overhead.", 
             "Focus on pointer manipulation, memory allocation overhead, and time complexity differences between singly and doubly linked lists."),
            ("Accurately explained stack LIFO order with clear push/pop examples.", 
             "Strengthen understanding of stack overflow/underflow edge cases and call stack unwinding in recursion."),
            ("Understood binary search tree traversal orders (in-order, pre-order).", 
             "Needs improvement on balancing mechanisms like AVL and Red-Black tree rotations to avoid worst-case O(N) degradation."),
            ("Described hash table collision resolution using chaining.", 
             "Review open addressing techniques (linear probing, quadratic probing, double hashing) and load factor re-hashing thresholds."),
            ("Explained BFS vs DFS graph traversals reasonably well.", 
             "Practice writing topological sort algorithms and cycle detection using visited sets.")
        ]
        for a, (fb, ai) in zip(answers, evals):
            a.feedback = fb
            a.areas_to_improve = ai
        sr.feedback_notes = """### Executive Assessment
The student demonstrates a solid fundamental grasp of core linear data structures and tree traversals. Spoken explanations were articulated clearly with relevant real-world use cases.

### Areas Needing Improvement
- **Tree Balancing Mechanisms**: Review tree rotation mechanisms (AVL / Red-Black) to prevent worst-case linear search complexity.
- **Hash Table Collision Handling**: Deepen understanding of open addressing strategies (quadratic probing and double hashing) versus chaining.
- **Graph Algorithms**: Practice implementing cycle detection and topological sorting in directed acyclic graphs (DAGs).

### Actionable Study Recommendations
- Revisit Chapter 4 & 5 of Data Structures and Algorithm Analysis for self-balancing search trees.
- Solve graph traversal problem sets focusing on edge classification and DFS backtracking."""
        sr.is_published = True
        sr.publish_grades = False  # Start with publish_grades = False (Remarks and Audio only)
        await db.commit()
        print("Populated run 1 successfully with publish_grades=False!")

if __name__ == "__main__":
    asyncio.run(populate())
