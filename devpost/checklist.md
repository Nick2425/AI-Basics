---
doc: checklist
status: approved
---

# Build Checklist

Build mode: learn

## Slices

- [x] **1. Anatomical viewport launches with navigable 3D structures**
  Becomes usable: Running `python app.py` opens a browser with the 3-column layout in Surgical Dark mode. The center viewport renders cervical/cranial nerves, muscles, and bones from the backend data. You can orbit, zoom, and pan the model freely with the mouse.
  Why now: Everything else — notes, audit, what-if — needs a visible, navigable anatomical model to attach to. This slice bootstraps the entire project (FastAPI server, static file serving, Three.js scene, anatomy data) and proves the 3D rendering pipeline works end to end.
  PRD ref: `prd.md > The Core Journey` (steps 1–2), `prd.md > Screens and Layout`
  Spec ref: `spec.md > Components > 1. Backend Server`, `spec.md > Components > 2. Anatomical Knowledge Graph`, `spec.md > Components > 5. 3D Viewport`, `spec.md > File Structure`, `spec.md > Look and Feel`
  Build: Create the full project scaffold per spec file structure. Write `requirements.txt` with FastAPI/Uvicorn/Pydantic. Build `app.py` mounting static files and the `GET /api/anatomy` endpoint. Create `data/anatomy_graph.json` with all cranial/cervical structures. Build `static/index.html` with the 3-column layout, menu bar, and Surgical Dark styling. Write `static/css/style.css` with all three theme palettes and glassmorphism surfaces. Write `static/js/viewport.js` to fetch anatomy data and render Three.js meshes (spline nerves, bone geometry, muscle geometry) with OrbitControls. Write `static/js/app.js` as the coordinator.
  Verify (mechanical): Run `python app.py`, confirm server starts on port 8000 with no errors. Open `http://localhost:8000` and confirm the 3D scene renders with visible nerve, muscle, and bone structures. Drag to orbit and scroll to zoom.
  Learner check: Open `http://localhost:8000` in your browser, drag around the viewport, and tell me if the anatomical model and dark clinical layout look like what you pictured.
  Commit: `Scaffold project with 3D anatomical viewport and dark clinical layout`

- [x] **2. ViewCube synchronization and layer toggles**
  Becomes usable: An Autodesk Inventor-style ViewCube appears in the top-right of the viewport, rotating in 1:1 sync with the anatomical camera. Clicking cube faces snaps to orthogonal views. The View menu toggles nervous and musculoskeletal layer visibility.
  Why now: Navigation and layer control are needed before inspection and auditing — you need to be able to orient and isolate systems to meaningfully select structures.
  PRD ref: `prd.md > Features > 1. Viewport, ViewCube & Transparency Isolation`
  Spec ref: `spec.md > Components > 5. 3D Viewport & Synchronized ViewCube`
  Build: Add the ViewCube as a second Three.js scene overlaid in the top-right corner, sharing a synchronized camera quaternion with the main viewport. Implement face-click detection and smooth camera interpolation to orthogonal views. Wire the `View > Layers` menu to toggle Three.js mesh group visibility for nervous and musculoskeletal systems.
  Verify (mechanical): Drag the main viewport and confirm the ViewCube rotates in lockstep. Click the "Front" face and confirm both snap smoothly. Open View > Layers, uncheck Nervous System, confirm nerve meshes disappear.
  Learner check: Drag the model around and watch the ViewCube follow. Click a few cube faces. Toggle layers on and off via the View menu. Does the synchronization feel right?
  Commit: `Add synchronized ViewCube and layer toggle menu`

- [x] **3. Click-to-inspect with transparency isolation and sticky notes**
  Becomes usable: Clicking an anatomical structure dims everything else to 25% opacity, highlights the target, and opens a floating sticky-note popup where you can write and save study notes. Notes appear in the left-panel tree. A sample note is pre-loaded on launch.
  Why now: This is the annotation half of the unique kernel — the audit can't detect gaps in notes that don't exist yet. Transparency isolation is shared between inspection and audit, so building it here means the audit slice gets it for free.
  PRD ref: `prd.md > Features > 2. Interactive Sticky-Note Annotations`, `prd.md > Features > 1. Viewport, ViewCube & Transparency Isolation` (transparency dimming)
  Spec ref: `spec.md > Components > 6. Sticky Notes & Tree Controller`
  Build: Implement Three.js Raycaster click detection on anatomical meshes. On selection, set all non-selected meshes to `opacity: 0.25`. Render a floating sticky-note card anchored to the selected structure's screen position. Save/load notes to `localStorage`. Populate the left tree with active notes and clinical badges. Pre-load one sample note on the Vagus Nerve.
  Verify (mechanical): Click a nerve structure and confirm surrounding meshes dim. Type a note, close the popup, and confirm it appears in the left tree. Reload the page and confirm the note persists. Close an empty note and confirm nothing is saved.
  Learner check: Click a structure, write a short study note, and close it. Check the left tree. Reload the page. Does it all feel natural?
  Commit: `Add click-to-inspect, transparency isolation, and sticky notes`

- [x] **4. Knowledge-gap audit with camera glide and clinical what-if challenge**
  Becomes usable: After writing notes, the terminal prompts "Ready to audit your notes?" Accepting sends notes to the Python audit engine, which finds an unaddressed structure. The camera smoothly glides to that structure, surrounding anatomy dims, and a "What-If" clinical modal appears. Answering appends the takeaway to your notes. This is the unique kernel working end to end.
  Why now: This is the core of the app — the thing that makes NeuroSoma different from a plain anatomy viewer. It must land early to prove the kernel and leave time for polish.
  PRD ref: `prd.md > Features > 3. Proactive Knowledge Gap Audit`, `prd.md > Features > 4. "What-If" Clinical Scenario Challenge`
  Spec ref: `spec.md > Components > 3. Dual-Mode Audit Engine`, `spec.md > Components > 4. Clinical What-If Generator`
  Build: Write `engine/auditor.py` with local semantic concept matching against `anatomy_graph.json`. Write `engine/what_if.py` generating clinical scenarios from structure data. Add `POST /api/audit` and `POST /api/what-if` endpoints to `app.py`. On the frontend, implement the audit prompt flow in the terminal, smooth camera interpolation to the gap target coordinates, transparency isolation of the audited structure, and the "What-If" modal overlay with answer submission and note appending.
  Verify (mechanical): Write a note on one structure, trigger audit, and confirm the response identifies a different structure as the gap. Confirm the camera animates to the target coordinates. Confirm the What-If modal appears with a clinical question. Submit an answer and confirm the takeaway is appended to the note.
  Learner check: Write a quick note on one structure, accept the audit prompt, and watch the camera fly to the gap. Answer the what-if question. Check that your note got updated. This is the core loop — does it feel like the study tool you described?
  Commit: `Add knowledge-gap audit engine, camera glide, and what-if challenge`

- [x] **5. Terminal console and theme switcher**
  Becomes usable: The right-panel terminal supports typed commands (`audit`, `inspect <part>`, `layer <nervous|musculo>`, `theme <dark|light|pink>`, `help`). The theme switcher in the header toggles between Surgical Dark, Clean Light, and Off-Pink palettes across the entire UI and 3D scene.
  Why now: The terminal and themes complete the full interaction surface described in the PRD. All prior behavior works through clicks; the terminal adds the keyboard-driven workflow and ties everything together.
  PRD ref: `prd.md > Features > 5. Modern Terminal & Query Console`, `prd.md > Screens and Layout > Global Header / Theme Switcher`
  Spec ref: `spec.md > Components > 7. Modern Terminal Console`, `spec.md > Look and Feel`
  Build: Write `static/js/terminal.js` with a command parser, scrollable output log, and styled prompt. Implement the `inspect` command to trigger raycaster selection, `layer` to toggle visibility, `audit` to trigger the audit flow, `theme` to switch CSS custom properties and Three.js scene background/materials, and `help` to list commands. Add theme toggle buttons in the header. Apply Clean Light and Off-Pink palettes.
  Verify (mechanical): Type `help` and confirm command list renders. Type `inspect vagus` and confirm the Vagus Nerve is selected and isolated. Type `theme pink` and confirm the entire app switches palette. Type `audit` and confirm it triggers the audit flow.
  Learner check: Try each terminal command. Switch themes. Does the terminal feel like the clinical study console you envisioned?
  Commit: `Add terminal console with commands and three-theme switcher`

## Hands-on Checkpoints

- [x] Early usable behavior explored — after slice 3 (inspect, notes, and transparency working), the annotation loop is complete and ready for feedback before building the audit kernel
- [x] Final kick-the-tires exploration and feedback completed

## Final Review

- [x] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [x] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [x] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [x] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: Implemented dedicated clinical audit notes persistence to disk (audit_notes/ directory) as structured JSON and Markdown files with companion feedback; wired REST endpoints GET /api/audit-notes and DELETE /api/audit-notes/{structure_id}; created dedicated 'Clinical Audit Notes' folder in left hierarchy tree; built interactive floating detail card with companion feedback, scenario question, user assessment, and verified takeaway. Mechanically verified via curl/python HTTP requests and live server at http://localhost:8000.
Route and stops:
  - Stop 1: static/js/audit.js (triggerAudit) -> engine/auditor.py (audit_notes)
  - Stop 2: static/js/viewport.js (glideToTarget, selectStructureById)
  - Stop 3: engine/what_if.py (evaluate_what_if, save_audit_record) -> audit_notes/<id>_audit.md -> static/js/notes.js (openAuditRecord)
Edit outcome: Kept and verified — dual persistence between localStorage study drafts and server audit_notes/ disk records with companion feedback.
Reflection: Dual-layer state partitioning: separating volatile exploratory drafts (localStorage) from verified clinical audit records (disk-persisted JSON/Markdown) provides seamless resilience, portability, and clear feedback history.
Activity mode: live app and editor with interactive mechanical verification.

## Revisions

- Save clinical audit notes in separate folder (audit_notes/) with both JSON and Markdown representations.
- Provide comprehensive companion evaluation feedback in chat bubble and within the audited note record card.
- Group saved audit notes in a dedicated 'Clinical Audit Notes' folder in the left sidebar hierarchy tree.
- Replaced all brackets [] with superscript <sup> tags or clean badge pills.
- Added quick action 'View Audit Note' button in companion chat stream.
- Lightened companion terminal in Clean Light mode with crisp slate background, clean white chat bubbles, and improved text contrast.
- Updated ViewCube face labels and terminal view commands to anatomical directional terminology (Anterior, Posterior, Superior, Inferior, Left, Right).
- Blended command console with conversational AI assistant: students can query anatomical structures, clinical deficits, and study progress in natural language or execute clinical commands (`audit`, `view`, `theme`, `recenter`, `inspect`, `clear`, `help`).
- Integrated 3D viewport actions into conversational AI responses: automatically isolating discussed anatomy and providing interactive quick-action buttons directly within chat bubbles.
- Personalized application identity: renamed application to SnoopAnatomy and AI companion to Professor Snoop.
- Added animated Professor Snoop mascot figure to the clinical audit challenge modal, pointing directly to audit scenario boxes during questions and changing to a proud, celebrating expression upon assessment submission.

