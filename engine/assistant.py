"""NeuroSoma - Conversational Clinical Assistant Engine.

Blends natural language conversational reasoning with 3D viewport command execution.
Answers anatomical and clinical inquiries, evaluates coverage, and isolates structures.
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


def respond_to_query(query: str, current_notes: dict = None, active_structure_id: str = None) -> dict:
    """Process a conversational query or command and return a rich tutor response.

    Args:
        query: User input string.
        current_notes: Dictionary of structure_id -> note text.
        active_structure_id: Currently inspected structure ID if any.

    Returns:
        Dictionary with:
            - response_html: Formatted conversational response string.
            - command: Optional client-side command to execute (e.g., 'audit', 'recenter', 'theme', 'view', 'inspect').
            - command_arg: Argument for the command.
            - focus_structure_id: Optional structure ID to select/isolate in 3D.
            - actions: Optional list of quick action buttons for chat bubble.
    """
    if not query or not query.strip():
        return {
            "response_html": "How can I assist your cranial-cervical study session? Ask an anatomical question or type <code>help</code> for commands.",
            "command": None
        }

    q = query.strip()
    q_lower = q.lower()
    notes = current_notes or {}

    # 1. Check for natural language audit intent
    if re.search(r"\b(audit|audit notes|check (my )?gaps|review (my )?notes|find gaps|test my coverage)\b", q_lower):
        return {
            "response_html": "Initiating cranial-cervical knowledge-gap audit across your study notes...",
            "command": "audit"
        }

    # 2. Check for natural language camera recenter intent
    if re.search(r"\b(recenter|reset( the)? camera|center view|overview view|reset view)\b", q_lower):
        return {
            "response_html": "Camera smoothly recentered to anatomical overview.",
            "command": "recenter"
        }

    # 3. Check for natural language theme switching
    theme_match = re.search(r"\b(switch to|change to|set theme to|theme)\s+(light|dark|pink)\b", q_lower)
    if theme_match:
        theme_name = theme_match.group(2)
        display_names = {"dark": "Surgical Dark", "light": "Clean Light", "pink": "Off-Pink"}
        return {
            "response_html": f"Visual theme switched to <strong>{display_names.get(theme_name, theme_name)}</strong>.",
            "command": "theme",
            "command_arg": theme_name
        }

    # 4. Check for natural language orientation / view snapping
    view_match = re.search(r"\b(view|look at( the)?|show( me)?( the)?|orient to( the)?)\s+(anterior|posterior|superior|inferior|front|back|left|right|top|bottom)\b", q_lower)
    if view_match:
        direction = view_match.group(view_match.lastindex)
        return {
            "response_html": f"Oriented 3D camera to <strong>{direction.upper()}</strong> anatomical projection.",
            "command": "view",
            "command_arg": direction
        }

    # 5. Check for greetings or companion identity inquiries
    if re.search(r"\b(hello|hi|hey|greetings|who are you|what can you do|help me|snoop|professor snoop)\b", q_lower) and len(q_lower.split()) <= 6:
        note_count = len([k for k, v in notes.items() if v and v.strip()])
        return {
            "response_html": (
                "I am <strong>Professor Snoop</strong>, your Clinical Study Companion for SnoopAnatomy. "
                "I blend conversational anatomy guidance with direct 3D viewport control.<br><br>"
                "You can converse with me naturally or issue clinical commands:<br>"
                "• Ask clinical questions: <em>'What does the phrenic nerve innervate?'</em> or <em>'Why is CN XI vulnerable in biopsies?'</em><br>"
                "• Audit knowledge gaps: <em>'audit'</em> or <em>'check my gaps'</em><br>"
                "• Navigate anatomy: <em>'view anterior'</em>, <em>'inspect vagus'</em>, or <em>'recenter'</em><br><br>"
                f"You currently have <strong>{note_count} active study notes</strong> saved."
            ),
            "command": None,
            "actions": [
                {"label": "Audit Notes", "action": "audit"},
                {"label": "Recenter View", "action": "recenter"}
            ]
        }

    # 6. Check for study progress / coverage questions
    if re.search(r"\b(how are my notes|what should i study|my progress|what am i missing|summary of notes|review progress)\b", q_lower):
        covered_ids = [k for k, v in notes.items() if v and v.strip()]
        uncovered = [s for s in _STRUCTURES if s["id"] not in covered_ids]
        total = len(_STRUCTURES)
        covered_count = len(covered_ids)

        if covered_count == total:
            return {
                "response_html": "Excellent coverage! You have documented all 11 active cranial and cervical structures. Run an audit to challenge your clinical recall with what-if scenarios.",
                "command": None,
                "actions": [{"label": "Run Audit Challenge", "action": "audit"}]
            }

        uncovered_names = ", ".join([f"<strong>{s['name']}</strong>" for s in uncovered[:3]])
        return {
            "response_html": (
                f"You have documented <strong>{covered_count} of {total}</strong> structures.<br><br>"
                f"High-yield areas currently without notes include: {uncovered_names}.<br>"
                "Would you like to focus on one of these or run a proactive audit to isolate the highest priority gap?"
            ),
            "command": None,
            "focus_structure_id": uncovered[0]["id"] if uncovered else None,
            "actions": [
                {"label": f"Inspect {uncovered[0]['name'].split('(')[-1].replace(')', '') if uncovered else 'Structure'}", "action": f"inspect {uncovered[0]['id']}" if uncovered else "recenter"},
                {"label": "Audit Notes", "action": "audit"}
            ]
        }

    # 7. Anatomical structure identification & deep clinical answering
    matched_structures = find_matching_structures(q_lower)

    if matched_structures:
        primary = matched_structures[0]
        structure_name = primary.get("name", primary["id"])
        category = primary.get("category", primary.get("system", "Structure"))
        tag = (primary.get("tag") or category).replace("[", "").replace("]", "")
        description = primary.get("description", "")
        innervation_or_action = primary.get("innervation") or primary.get("actions") or ""
        clinical = primary.get("clinical_relevance", "")

        # Check if student has notes on this structure
        has_note = primary["id"] in notes and bool(notes[primary["id"]].strip())
        note_status_html = (
            "<br><br><em>Status: You have an active study note recorded for this structure.</em>"
            if has_note
            else "<br><br><em>Note: No study note recorded yet for this structure. Type in the sticky note card to save clinical observations.</em>"
        )

        response_text = (
            f"<strong>{structure_name}</strong> <sup>{tag}</sup><br><br>"
            f"• <strong>Overview:</strong> {description}<br>"
            f"• <strong>Functional Role:</strong> {innervation_or_action}<br>"
            f"• <strong>Clinical Correlation:</strong> {clinical}"
            f"{note_status_html}"
        )

        return {
            "response_html": response_text,
            "command": "inspect",
            "command_arg": primary["id"],
            "focus_structure_id": primary["id"],
            "actions": [
                {"label": f"Inspect {primary['id'].replace('_', ' ').title()}", "action": f"inspect {primary['id']}"},
                {"label": "Audit Notes", "action": "audit"}
            ]
        }

    # 8. General anatomical concept matching (cranial nerves, brachial plexus, torticollis, etc.)
    concept_response = check_general_clinical_concepts(q_lower)
    if concept_response:
        return concept_response

    # 9. Natural fallback offering both conversational and command suggestions
    return {
        "response_html": (
            f"I analyzed your query: <em>\"{escape_html(q)}\"</em>.<br><br>"
            "I can assist with anatomical functions, clinical deficits, and study note audits across the cranial and cervical region.<br><br>"
            "Try asking:<br>"
            "• <em>'What happens if the vagus nerve is damaged?'</em><br>"
            "• <em>'Explain the clinical anatomy of the anterior scalene'</em><br>"
            "• <em>'What are the borders of the posterior cervical triangle?'</em><br>"
            "• Or run commands: <code>audit</code>, <code>recenter</code>, <code>theme light</code>, <code>view posterior</code>"
        ),
        "command": None,
        "actions": [
            {"label": "Audit Notes", "action": "audit"},
            {"label": "Recenter View", "action": "recenter"}
        ]
    }


def find_matching_structures(query_lower: str) -> list:
    """Find anatomy structures mentioned in or closely relevant to query."""
    matches = []

    # Direct ID and exact name matching
    for s in _STRUCTURES:
        sid = s["id"]
        sid_spaced = sid.replace("_", " ")
        name_lower = s["name"].lower()

        if sid in query_lower or sid_spaced in query_lower or name_lower in query_lower:
            matches.append(s)
            continue

        # Check key concepts
        for kc in s.get("key_concepts", []):
            if kc.lower() in query_lower:
                matches.append(s)
                break

    # Aliases
    alias_map = {
        "vagus": "vagus_nerve",
        "cn x": "vagus_nerve",
        "cranial nerve 10": "vagus_nerve",
        "cranial nerve x": "vagus_nerve",
        "recurrent laryngeal": "vagus_nerve",
        "accessory": "spinal_accessory_nerve",
        "cn xi": "spinal_accessory_nerve",
        "cranial nerve 11": "spinal_accessory_nerve",
        "cranial nerve xi": "spinal_accessory_nerve",
        "spinal accessory": "spinal_accessory_nerve",
        "phrenic": "phrenic_nerve",
        "diaphragm": "phrenic_nerve",
        "c3 4 5": "phrenic_nerve",
        "cervical plexus": "cervical_plexus",
        "ansa cervicalis": "cervical_plexus",
        "erbs point": "cervical_plexus",
        "erb's point": "cervical_plexus",
        "scm": "sternocleidomastoid",
        "sternocleidomastoid": "sternocleidomastoid",
        "torticollis": "sternocleidomastoid",
        "trapezius": "trapezius_superior",
        "upper trap": "trapezius_superior",
        "shoulder shrug": "trapezius_superior",
        "shoulder drop": "spinal_accessory_nerve",
        "scalene": "scalene_anterior",
        "anterior scalene": "scalene_anterior",
        "thoracic outlet": "scalene_anterior",
        "occipital": "occipital_base",
        "skull base": "occipital_base",
        "foramen magnum": "occipital_base",
        "atlas": "c1_atlas",
        "c1": "c1_atlas",
        "jefferson": "c1_atlas",
        "axis": "c2_axis",
        "c2": "c2_axis",
        "dens": "c2_axis",
        "odontoid": "c2_axis",
        "hangman": "c2_axis",
        "vertebrae": "c3_c7_vertebrae",
        "spine": "c3_c7_vertebrae",
        "radiculopathy": "c3_c7_vertebrae",
        "cervical spine": "c3_c7_vertebrae"
    }

    for alias, sid in alias_map.items():
        if alias in query_lower and sid in _STRUCTURE_MAP:
            s = _STRUCTURE_MAP[sid]
            if s not in matches:
                matches.append(s)

    return matches


def check_general_clinical_concepts(q_lower: str) -> dict:
    """Provide tailored clinical answers for common broader anatomy questions."""
    if "triangle" in q_lower or "posterior triangle" in q_lower or "anterior triangle" in q_lower:
        return {
            "response_html": (
                "<strong>Cervical Triangles &amp; Surgical Landmarks:</strong><br><br>"
                "• <strong>Posterior Triangle:</strong> Bordered by the posterior edge of the SCM, anterior edge of the trapezius, and middle third of the clavicle. "
                "Critically contains the <strong>Spinal Accessory Nerve (CN XI)</strong> crossing superficially across the levator scapulae, making it vulnerable during lymph node biopsies.<br>"
                "• <strong>Anterior Triangle:</strong> Bordered by the anterior border of the SCM, inferior margin of the mandible, and midline of the neck. Contains the carotid sheath (carotid artery, internal jugular vein, and <strong>Vagus Nerve</strong>)."
            ),
            "command": "inspect",
            "command_arg": "spinal_accessory_nerve",
            "focus_structure_id": "spinal_accessory_nerve",
            "actions": [
                {"label": "Inspect CN XI", "action": "inspect spinal_accessory_nerve"},
                {"label": "Inspect Vagus Nerve", "action": "inspect vagus_nerve"}
            ]
        }

    if "nerve" in q_lower and "muscle" in q_lower:
        return {
            "response_html": (
                "<strong>Neuromuscular Correlations in the Neck:</strong><br><br>"
                "• <strong>CN XI (Spinal Accessory):</strong> Provides somatic motor innervation to both the <em>Sternocleidomastoid</em> and <em>Trapezius</em>.<br>"
                "• <strong>Phrenic Nerve (C3–C5):</strong> Descends along the anterior surface of the <em>Anterior Scalene</em> before entering the mediastinum to innervate the diaphragm.<br>"
                "• <strong>Ansa Cervicalis (C1–C3):</strong> Loops anterior to the internal jugular to innervate the infrahyoid strap muscles."
            ),
            "command": None,
            "actions": [
                {"label": "Inspect SCM", "action": "inspect sternocleidomastoid"},
                {"label": "Inspect Phrenic Nerve", "action": "inspect phrenic_nerve"}
            ]
        }

    return None


def escape_html(str_val: str) -> str:
    """Escape special HTML characters."""
    if not str_val:
        return ""
    return (
        str_val.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )
