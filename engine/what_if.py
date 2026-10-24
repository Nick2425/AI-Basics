"""NeuroSoma - Clinical What-If Scenario Engine.

Validates learner answers to targeted clinical what-if challenges,
persists audit records and companion feedback to a dedicated audit_notes/ folder,
and produces high-yield takeaways.
"""

import datetime
import json
import os

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DATA_PATH = os.path.join(_BASE_DIR, "data", "anatomy_graph.json")
_AUDIT_NOTES_DIR = os.path.join(_BASE_DIR, "audit_notes")

# Ensure the audit_notes directory exists
os.makedirs(_AUDIT_NOTES_DIR, exist_ok=True)

with open(_DATA_PATH, "r", encoding="utf-8") as _f:
    _ANATOMY_GRAPH = json.load(_f)

_STRUCTURE_MAP = {s["id"]: s for s in _ANATOMY_GRAPH.get("structures", [])}


def evaluate_what_if(structure_id: str, question: str, user_answer: str) -> dict:
    """Evaluate student's answer to a clinical scenario and save to audit_notes folder.

    Args:
        structure_id: ID of the structure being audited.
        question: The scenario question presented to the student.
        user_answer: The student's submitted explanation.

    Returns:
        Dictionary with validation feedback, verified key takeaway, and full audit record.
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

    append_text = f"\n\nClinical Takeaway: {clinical_core}"
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    clean_tag = (structure.get("tag") or "").replace("[", "").replace("]", "")

    # Create structured audit record
    audit_record = {
        "structure_id": structure_id,
        "structure_name": structure_name,
        "category": structure.get("category", ""),
        "tag": clean_tag,
        "timestamp": now_iso,
        "question": question,
        "student_answer": user_answer,
        "is_correct": is_correct,
        "companion_feedback": feedback,
        "key_takeaway": verified_takeaway
    }

    # Save record to separate audit_notes folder as both JSON and Markdown
    save_audit_record(audit_record)

    return {
        "status": "evaluated",
        "is_correct": is_correct,
        "structure_id": structure_id,
        "structure_name": structure_name,
        "clinical_feedback": feedback,
        "key_takeaway": verified_takeaway,
        "append_text": append_text,
        "audit_record": audit_record
    }


def save_audit_record(record: dict) -> None:
    """Persist an audit record to the audit_notes/ directory."""
    os.makedirs(_AUDIT_NOTES_DIR, exist_ok=True)
    sid = record.get("structure_id", "unknown")

    # 1. JSON record
    json_path = os.path.join(_AUDIT_NOTES_DIR, f"{sid}_audit.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(record, f, indent=2)

    # 2. Markdown record
    md_path = os.path.join(_AUDIT_NOTES_DIR, f"{sid}_audit.md")
    status_str = "Assessment Confirmed" if record.get("is_correct") else "Needs Reinforcement"
    md_content = f"""# Clinical Audit: {record.get('structure_name')}
- **Timestamp:** {record.get('timestamp')}
- **Status:** {status_str}
- **Category:** {record.get('category')}

## Clinical Scenario Question
{record.get('question')}

## Student Assessment
{record.get('student_answer')}

## Companion Feedback
{record.get('companion_feedback')}

## Verified Clinical Takeaway
{record.get('key_takeaway')}
"""
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_content)


def get_all_audit_notes() -> list:
    """Retrieve all saved audit notes from the audit_notes/ directory."""
    if not os.path.exists(_AUDIT_NOTES_DIR):
        return []
    records = []
    for fname in sorted(os.listdir(_AUDIT_NOTES_DIR)):
        if fname.endswith("_audit.json"):
            try:
                with open(os.path.join(_AUDIT_NOTES_DIR, fname), "r", encoding="utf-8") as f:
                    records.append(json.load(f))
            except Exception:
                pass
    return records


def delete_audit_note(structure_id: str) -> bool:
    """Remove a saved audit note from the audit_notes/ directory."""
    deleted = False
    for ext in ["_audit.json", "_audit.md"]:
        fpath = os.path.join(_AUDIT_NOTES_DIR, f"{structure_id}{ext}")
        if os.path.exists(fpath):
            try:
                os.remove(fpath)
                deleted = True
            except OSError:
                pass
    return deleted
