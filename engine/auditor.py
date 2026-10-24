"""NeuroSoma - Knowledge-Gap Audit Engine.

Evaluates student study notes against ground-truth anatomical concepts
in data/anatomy_graph.json to detect coverage blind spots, prioritize gaps,
and generate clinical challenge prompts with scenario variety.
"""

import json
import os
import random
import re

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DATA_PATH = os.path.join(_BASE_DIR, "data", "anatomy_graph.json")

with open(_DATA_PATH, "r", encoding="utf-8") as _f:
    _ANATOMY_GRAPH = json.load(_f)

_STRUCTURES = _ANATOMY_GRAPH.get("structures", [])
_STRUCTURE_MAP = {s["id"]: s for s in _STRUCTURES}

# Multi-scenario clinical challenge pools providing varied high-yield assessment
_WHAT_IF_PROMPTS_POOL = {
    "vagus_nerve": [
        "During thyroidectomy or anterior cervical spine exposure, acute iatrogenic traction on the recurrent laryngeal branch of CN X occurs. What phonatory and laryngeal deficits manifest?",
        "A patient presents with carotid sinus hypersensitivity. Stimulation of vagal afferent branches produces profound bradycardia and syncope. Through what autonomic pathway does CN X modulate cardiac conduction?",
        "Unilateral lesion of the vagus nerve trunk at the jugular foramen impairs palatal and pharyngeal innervation. What anatomical asymmetry develops on physical examination of the uvula and soft palate?"
    ],
    "spinal_accessory_nerve": [
        "During an excisional lymph node biopsy in the posterior cervical triangle, the spinal accessory nerve is severed. What characteristic shoulder deformity and motor deficits develop?",
        "A patient suffers penetrating trauma to the superior posterior triangle of the neck. When instructed to shrug against resistance or turn the chin to the opposite side, what specific muscular weaknesses are observed?",
        "Iatrogenic CN XI injury leads to chronic shoulder pain, lateral scapular winging, and inability to abduct the arm past 90 degrees. Why does loss of trapezius stabilization restrict glenohumeral elevation?"
    ],
    "phrenic_nerve": [
        "Blunt cervical spine trauma injuring the C3–C5 ventral rami impairs phrenic nerve conduction. What diagnostic radiographic finding on upright chest radiography confirms diaphragmatic paralysis?",
        "During open cardiac surgery with hypothermic pericardial slush cooling, cold-induced neuropraxia of the left phrenic nerve occurs. How does unilateral diaphragmatic paralysis alter pulmonary mechanics during spontaneous respiration?",
        "A patient with high cervical spinal cord trauma develops acute respiratory failure. Correlating with the clinical axiom 'C3, 4, 5 keep the diaphragm alive', what ventilatory mechanism is abolished?"
    ],
    "cervical_plexus": [
        "Prior to carotid endarterectomy, a superficial cervical plexus block is administered along the posterior border of the sternocleidomastoid. What cutaneous sensory dermatomes are anesthetized?",
        "Trauma to the posterior cervical triangle at Erb's point injures superficial cutaneous branches of the cervical plexus. Deficits in which specific sensory branches impair neck and ear sensation?",
        "An infiltrative deep neck mass compresses the ansa cervicalis (deep cervical plexus loop). What motor deficit involving infrahyoid strap muscle excursion occurs during deglutition?"
    ],
    "sternocleidomastoid": [
        "A pediatric patient presents with congenital muscular torticollis due to fibrotic contracture of the unilateral sternocleidomastoid. Describe the characteristic resting rotational and lateral tilting head posture.",
        "Unilateral dystonic spasm of the sternocleidomastoid occurs in adult spasmodic torticollis. In which direction does the chin rotate, and toward which shoulder does the vertex tilt?",
        "In patients in severe respiratory distress, bilateral contraction of the sternocleidomastoid is observed as accessory inspiratory effort. What mechanical elevation does it exert on the clavicles and sternum?"
    ],
    "trapezius_superior": [
        "Sustained postural load or compressive injury to the upper trapezius produces myofascial trigger points with referred cervico-occipital pain. Which movements of the scapula and cervical spine become restricted?",
        "Loss of upper trapezius stabilization disrupts normal scapulohumeral rhythm during humeral abduction. Which rotator cuff tendon is predisposed to subacromial impingement when the scapula fails to upwardly rotate?",
        "During physical examination of cranial nerve XI function, the examiner presses down on the shoulders while asking the patient to shrug. What primary scapular elevation muscle is being isolated?"
    ],
    "scalene_anterior": [
        "Hypertrophy or anomalous fibrous bands of the anterior scalene muscle cause neurogenic thoracic outlet syndrome. Which neural trunks passing through the interscalene triangle are compressed?",
        "During interscalene brachial plexus blockade, local anesthetic spreads anteriorly across the prevertebral fascia over the anterior scalene surface. Which motor nerve is unintentionally anesthetized?",
        "In patients with respiratory failure, the anterior scalene acts as an accessory inspiratory muscle. What cranial-cervical origin and first-rib insertion allow it to elevate the upper thoracic cage?"
    ],
    "occipital_base": [
        "A basilar skull fracture traversing the occipital condyles and foramen magnum compromises the hypoglossal canal and jugular foramen. Which cranial nerves are at acute risk of entrapment or avulsion?",
        "Atlanto-occipital dislocation represents complete ligamentous disruption between the occipital condyles and C1. Why does this injury result in immediate respiratory arrest or fatal brainstem transection?",
        "An expanding lesion at the occipital skull base compresses the medulla oblongata as it transitions into the cervical spinal cord. What cardiorespiratory and pyramidal tract signs indicate life-threatening tonsillar herniation?"
    ],
    "c1_atlas": [
        "An axial loading impact to the vertex of the cranium produces a Jefferson fracture of the C1 atlas ring with lateral mass displacement. What ligament is at risk of catastrophic rupture?",
        "Because the C1 vertebra lacks a vertebral body and spinous process, it forms a wide ring around the spinal cord (Steel's Rule of Thirds). How does this unique ring anatomy provide a safety margin during minimally displaced fractures?",
        "Severe rotational trauma at the atlanto-axial joint causes C1-C2 subluxation. What symptoms arise from stretching or kinking the vertebral artery as it passes through the transverse foramen of the atlas?"
    ],
    "c2_axis": [
        "A hyperextension injury of the cervical spine causes a bilateral fracture of the C2 pars interarticularis (Hangman's fracture). What mechanical instability develops between C2 and C3?",
        "A Type II odontoid fracture occurs across the base of the dens where it attaches to the C2 vertebral body. Why is this fracture subtype notoriously prone to nonunion and posterior cord displacement?",
        "The dens (odontoid process) of C2 serves as the rotational pivot for the skull and atlas. If the transverse ligament holding the dens against the anterior arch of C1 is torn, what cord compression occurs during cervical flexion?"
    ],
    "c3_c7_vertebrae": [
        "A posterolateral disc herniation at the C5-C6 cervical motion segment impinges on the exiting C6 spinal nerve root. What specific reflex, motor weakness, and sensory dermatomal changes are elicited on examination?",
        "Severe degenerative cervical spondylosis produces posterior osteophytic ridging and canal stenosis from C3 to C7. What clinical constellation of upper and lower motor neuron signs defines cervical spondylotic myelopathy?",
        "The uncinate processes of C3-C7 form uncovertebral joints (joints of Luschka) flanking the intervertebral foramina. How does hypertrophy of these joints produce cervical radiculopathy even without acute disc extrusion?"
    ]
}

# Alias mapping
_WHAT_IF_PROMPTS_POOL["anterior_scalene"] = _WHAT_IF_PROMPTS_POOL["scalene_anterior"]
_WHAT_IF_PROMPTS_POOL["c3_c7_spine"] = _WHAT_IF_PROMPTS_POOL["c3_c7_vertebrae"]


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

    # Formulate professional clinical gap explanation
    covered_names = [_STRUCTURE_MAP[cid]["name"].split("(")[0].strip() for cid in covered_ids if cid in _STRUCTURE_MAP]
    if covered_names:
        coverage_summary = f"Your notes examine {', '.join(covered_names[:3])}"
    else:
        coverage_summary = "Your notes have not yet begun structural annotation"

    if is_thin:
        gap_explanation = (
            f"{coverage_summary}, but structural coverage on {target_name} is minimal. "
            f"Key functional pathways ({', '.join(key_concepts[:3])}) require clinical reinforcement."
        )
    else:
        function_hint = target_structure.get("innervation") or target_structure.get("description", "")
        clean_hint = function_hint.split(';')[0].strip()
        gap_explanation = (
            f"{coverage_summary}, but completely omit {target_name}. "
            f"This structure governs {clean_hint.lower()}."
        )

    # Select varied scenario from pool
    prompts = _WHAT_IF_PROMPTS_POOL.get(target_id, [
        f"What-if acute injury impairs {target_name}? What specific clinical deficit develops?"
    ])
    what_if_prompt = random.choice(prompts)

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
