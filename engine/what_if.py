"""NeuroSoma - Clinical What-If Scenario Engine.

Validates learner answers to targeted clinical what-if challenges and
produces high-yield takeaways to append to the structure's study notes.
"""

import json
import os

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DATA_PATH = os.path.join(_BASE_DIR, "data", "anatomy_graph.json")

with open(_DATA_PATH, "r", encoding="utf-8") as _f:
    _ANATOMY_GRAPH = json.load(_f)

_STRUCTURE_MAP = {s["id"]: s for s in _ANATOMY_GRAPH.get("structures", [])}


def evaluate_what_if(structure_id: str, question: str, user_answer: str) -> dict:
    """Evaluate student's answer to a clinical scenario and generate a takeaway.

    Args:
        structure_id: ID of the structure being audited.
        question: The scenario question presented to the student.
        user_answer: The student's submitted explanation.

    Returns:
        Dictionary with validation feedback, verified key takeaway, and append text.
    """
    structure = _STRUCTURE_MAP.get(structure_id)
    if not structure:
        return {
            "status": "error",
            "message": f"Unknown structure {structure_id}"
        }

    clinical_core = structure.get("clinical_relevance", "")
    key_concepts = structure.get("key_concepts", [])

    # Check for keyword matches in student's response
    user_words = set(user_answer.lower().split())
    matched_concepts = [c for c in key_concepts if any(w in user_words for w in c.lower().split())]

    # Synthesize refined takeaway
    structure_name = structure.get("name", structure_id)
    verified_takeaway = f"Clinical Correlation: {clinical_core}"

    # Professional clinical evaluation
    if matched_concepts:
        feedback = (
            f"Assessment confirmed. Accurate clinical correlation identified: "
            f"{', '.join(matched_concepts[:2])}."
        )
        is_correct = True
    else:
        hint = structure.get('clinical_relevance') or structure.get('innervation') or 'this anatomical structure'
        hint_core = hint.split(';')[0].strip()
        feedback = (
            f"Clinical correlation requiring reinforcement: "
            f"{hint_core}."
        )
        is_correct = False

    # Clean takeaway without any brackets
    append_text = f"\n\nClinical Takeaway: {clinical_core}"

    return {
        "status": "evaluated",
        "is_correct": is_correct,
        "structure_id": structure_id,
        "structure_name": structure_name,
        "clinical_feedback": feedback,
        "key_takeaway": verified_takeaway,
        "append_text": append_text
    }
