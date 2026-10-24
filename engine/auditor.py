"""NeuroSoma - Knowledge-Gap Audit Engine.

Evaluates student study notes against ground-truth anatomical concepts
in data/anatomy_graph.json to detect coverage blind spots, prioritize gaps,
and generate clinical challenge prompts.
"""

import json
import os
import re

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DATA_PATH = os.path.join(_BASE_DIR, "data", "anatomy_graph.json")

with open(_DATA_PATH, "r", encoding="utf-8") as _f:
    _ANATOMY_GRAPH = json.load(_f)

_STRUCTURES = _ANATOMY_GRAPH.get("structures", [])
_STRUCTURE_MAP = {s["id"]: s for s in _STRUCTURES}

# Student-friendly scenario challenges calibrated for first-time anatomy learners
_WHAT_IF_PROMPTS = {
    "vagus_nerve": "If someone's vagus nerve (recurrent laryngeal branch) is irritated or pinched during neck surgery, why would their speaking voice suddenly sound hoarse or raspy?",
    "spinal_accessory_nerve": "The spinal accessory nerve powers your trapezius and neck muscles. If it gets injured, why would someone struggle to shrug their shoulder or turn their chin to the side?",
    "phrenic_nerve": "Anatomy students love the rhyme: 'C3, 4, 5 keeps the diaphragm alive!' If this nerve is hurt, why does normal breathing suddenly become difficult?",
    "cervical_plexus": "This nerve cluster provides feeling to the skin of your neck, ear, and upper shoulder. If a clinician numbs it before a procedure, where will the patient lose feeling?",
    "sternocleidomastoid": "This is the big muscle on the side of your neck that turns your head. If it goes into a sudden spasm (like waking up with a stiff neck), what happens to your head position?",
    "trapezius_superior": "Your upper trapezius helps lift your shoulders and steady your neck. If someone strains this muscle carrying a heavy bag, what everyday movement feels weak or sore?",
    "scalene_anterior": "The anterior scalene muscle sits right in front of the nerves traveling down into your arm. If this muscle gets tight and pinches them, what sensations might you feel in your arm?",
    "anterior_scalene": "The anterior scalene muscle sits right in front of the nerves traveling down into your arm. If this muscle gets tight and pinches them, what sensations might you feel in your arm?",
    "occipital_base": "This bone forms the foundation of your skull where vital nerves leave the brain. Why is a severe crack or fracture here considered a medical emergency?",
    "c1_atlas": "The C1 vertebra is named Atlas because it balances your entire skull like the titan Atlas. Why is cracking this top neck ring so dangerous for your spinal cord?",
    "c2_axis": "The C2 Axis vertebra has a small upright peg (the dens) that lets you shake your head 'no'. What happens if that peg snaps and pushes backward into the spinal cord?",
    "c3_c7_vertebrae": "These neck bones stack up to protect your spinal cord and the nerves heading into your arms. If a cushion (disc) slips between them, what does it press on?",
    "c3_c7_spine": "These neck bones stack up to protect your spinal cord and the nerves heading into your arms. If a cushion (disc) slips between them, what does it press on?"
}


def audit_notes(notes_payload: dict) -> dict:
    """Analyze student study notes against the cranial-cervical knowledge graph.

    Args:
        notes_payload: Dictionary mapping structure_id -> note text,
                       or {"notes": {...}}.

    Returns:
        Audit response dictionary conforming to spec schema:
        status, target_structure_id, structure_name, camera_target,
        gap_explanation, audited_terms, what_if_prompt.
    """
    if "notes" in notes_payload and isinstance(notes_payload["notes"], dict):
        notes_map = notes_payload["notes"]
    else:
        notes_map = notes_payload

    # Clean and filter non-empty notes
    active_notes = {}
    for sid, text in notes_map.items():
        if isinstance(text, str) and text.strip():
            active_notes[sid] = text.strip()

    # Identify covered structures
    covered_ids = set(active_notes.keys())

    # Build list of unaddressed structures
    unaddressed = [s for s in _STRUCTURES if s["id"] not in covered_ids]

    # If all structures have at least one note, check for the thinnest note
    if not unaddressed:
        # Find note with fewest words
        sorted_by_depth = sorted(
            _STRUCTURES,
            key=lambda s: len(active_notes.get(s["id"], "").split())
        )
        target_structure = sorted_by_depth[0]
        is_thin = True
    else:
        # Priority order: nervous system first, then musculoskeletal
        unaddressed_nerves = [s for s in unaddressed if s.get("system") == "nervous"]
        if unaddressed_nerves:
            target_structure = unaddressed_nerves[0]
        else:
            target_structure = unaddressed[0]
        is_thin = False

    target_id = target_structure["id"]
    target_name = target_structure["name"]
    camera_target = target_structure.get("coordinates", {}).get("camera_target", [0.0, 1.8, 2.0])
    key_concepts = target_structure.get("key_concepts", [])

    # Extract terms that were audited from existing notes
    audited_terms = []
    all_notes_text = " ".join(active_notes.values()).lower()
    for s in _STRUCTURES:
        for term in s.get("key_concepts", [])[:3]:
            if term.lower() in all_notes_text and term.lower() not in audited_terms:
                audited_terms.append(term.lower())
    if not audited_terms:
        audited_terms = [c.lower() for c in key_concepts[:3]]

    # Formulate friendly student-accessible gap explanation
    covered_names = [_STRUCTURE_MAP[cid]["name"].split("(")[0].strip() for cid in covered_ids if cid in _STRUCTURE_MAP]
    if covered_names:
        first_few = ', '.join(covered_names[:2])
        coverage_summary = f"You've taken notes on {first_few}"
    else:
        coverage_summary = "You haven't written notes for this area yet"

    if is_thin:
        gap_explanation = (
            f"{coverage_summary}, but your notes on {target_name} are still brief. "
            f"Let's look at how it works and check your understanding with a quick question!"
        )
    else:
        function_hint = target_structure.get("innervation") or target_structure.get("description", "")
        short_hint = function_hint.split(';')[0].split('.')[0].strip()
        gap_explanation = (
            f"{coverage_summary}, but you haven't explored {target_name} yet! "
            f"This part helps with {short_hint.lower()}. Let's test your understanding:"
        )

    # Retrieve or generate What-If prompt
    what_if_prompt = _WHAT_IF_PROMPTS.get(
        target_id,
        f"If {target_name} is injured or inflamed, what everyday symptom or movement issue would develop?"
    )

    clean_tag = (target_structure.get("tag") or "").replace("[", "").replace("]", "")

    return {
        "status": "gap_detected",
        "target_structure_id": target_id,
        "structure_name": target_name,
        "category": target_structure.get("category", ""),
        "tag": clean_tag,
        "camera_target": camera_target,
        "gap_explanation": gap_explanation,
        "audited_terms": audited_terms[:5],
        "what_if_prompt": what_if_prompt
    }
