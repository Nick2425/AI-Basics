---
doc: prd
status: approved
---

# NeuroSoma — Product Requirements

A persistent study companion for anatomy and biomedical coursework that pairs a compact, interactive anatomical viewport with an active gap-detecting note auditor and clinical "what-if" reinforcement.
Source: `scope.md > The Unique Kernel` and `scope.md > Who It's For`.

## The Core Journey
1. **Launch:** The app opens in a compact 3-column workspace set to surgical dark mode, displaying a segmented cervical/cranial anatomical model in the center, an anatomical tree with one pre-loaded sample note on the left, and a modern terminal on the right.
2. **Explore:** The user navigates the viewport (drag the canvas or click-and-drag directly on the Autodesk Inventor-style ViewCube to rotate, scroll to zoom, or click faces/corners on the ViewCube to snap to Front, Right, Top, Back, Bottom). Layer visibility is configured through a classic top-level "View" dropdown menu bar (`View > Layers`).
3. **Inspect & Annotate:** The user clicks an anatomical structure or types an inquiry in the terminal. Surrounding structures become semi-transparent (20–25% opacity) while the selected structure remains vivid at 100% full opacity. A sticky-note overlay appears anchored to the structure, showing existing information and allowing the user to write new study notes. Blank notes are not saved.
4. **Proactive Audit Offer:** After notes are updated or when the user finishes writing, the tool proactively prompts: *"Ready to audit your notes?"* The user can accept or decline.
5. **Camera Navigation & Transparency Isolation:** Upon accepting, the audit scans the notes against anatomical ground truth, pinpoints an unaddressed or thin concept, smoothly glides the viewport camera to that structure, dims all other surrounding structures to semi-transparency for instant spatial focus, and temporarily highlights the related concepts inside the note.
6. **"What-If" Clinical Challenge:** A focused overlay appears presenting a functional "what-if" scenario (e.g., nerve impingement or biomechanical strain) with an input field for the user to answer.
7. **Append & Solidify:** Upon submitting an answer, the validated clinical insight and audit takeaway are appended directly to the structure's note, updating the user's mastery.

## Screens and Layout
A unified, compact single-screen workspace divided into three vertical zones:
- **Left Panel (Anatomical Hierarchy & Notes Tree):** 
  - Displays the hierarchical outline of systems, segments, and structures with clean clinical tags ([Nerve], [Bone], [Muscle]).
  - Dynamically lists structures that have active notes (preventing empty note clutter).
  - Quick-switch tabs between Viewport Layer Controls and the Note Tree.
- **Center Canvas (Anatomical Viewport):**
  - **Menu Bar (Top):** Classic IDE/spreadsheet-style application menu bar featuring a **View** dropdown menu (`View > Layers > [x] Nervous System, [x] Musculoskeletal System`).
  - Interactive visualization of the segmented cervical/cranial nervous and musculoskeletal anatomy.
  - **Autodesk Inventor-Style ViewCube (Top-Right):** An interactive 3D orientation cube featuring both:
    - Click-and-drag orbital mechanic: Click and drag anywhere on the cube or canvas to freely rotate orientation in 3D space, with 1:1 real-time synchronization between the cube and the anatomical viewport.
    - Clickable snap faces: Functional orthogonal faces (Front, Right, Left, Top, Bottom, Back) and corner vertices that snap both the camera and cube cleanly without gimbal flip.
  - Floating sticky-note overlays anchored to selected anatomical structures, styled as refined clinical cards with soft, subtle borders rather than visually obnoxious outlines.
  - Audit overlay modal for "what-if" clinical challenges.
- **Right Panel (Modern Terminal & Query Console):**
  - Sleek, modern terminal interface with a prompt line for natural language queries and command shortcuts (e.g., `audit`, `inspect <part>`, `toggle <layer>`, `view <front|side|top|back>`).
  - Audit confirmation prompts (*Ready to audit? [Accept] [Decline]*).
- **Global Header / Theme Switcher:**
  - Quick theme toggle in the header supporting **Surgical Dark** (default), **Clean Light**, and **Off-Pink**.

## Look and Feel
- **Visual Tone & Typography:** 
  - Strictly no emojis in any UI labels, badges, buttons, notes, or terminal output; exclusively professional clinical typography and iconography.
  - Modern, clean sans-serif (Inter/Outfit) for all UI panels, and modern sans-code monospace (JetBrains Mono) for the command console.
- **Theme & Palette:** 
  - *Surgical Dark (Default):* Deep slate background (`#0a0f18`), card/panel surfaces (`#121a2b`), vibrant cyan (`#38bdf8`) for nervous pathways, crimson/coral for muscular structures, and warm amber (`#f59e0b`) for gap callouts and "what-if" alerts.
  - *Clean Light:* Crisp clinical white/gray background with high-contrast slate text and saturated neural accents.
  - *Off-Pink:* Soft pastel clinical rose/slate palette for reduced eye strain during extended night study.
- **Depth & Transparency Isolation:** Non-selected structures drop to 20-30% opacity when a part is selected or audited, making the target structure immediately pop out of the surrounding anatomical field without requiring drawn circle rings.
- **Subtle Surface Aesthetics:** Sticky notes and floating elements use soft, understated borders (`rgba(255, 255, 255, 0.08)`) and gentle elevation shadows, avoiding high-contrast or visually distracting outlines.

## Features and Behavior

### 1. Viewport, ViewCube & Transparency Isolation
Source: `scope.md > The POC Boundary`
- Users can click and drag inside the viewport canvas OR directly on the Autodesk Inventor ViewCube to freely rotate the anatomical model in 3D.
- The ViewCube and anatomical viewport are 1:1 synchronized: rotating one immediately updates the other in real time.
- The viewport remains clean and uncluttered without instructional hint labels or helper text under controls.
- Scrolling zooms in and out within calibrated bounds.
- The ViewCube supports both click-and-drag free rotation and clicking individual faces (Front, Back, Right, Left, Top, Bottom) to snap both the cube and the model cleanly to exact orthogonal or isometric projections without gimbal lock or inversion.
- Layer visibility is managed through the top menu bar (`View > Layers > [x] Nervous System, [x] Musculoskeletal System`) with checkmarks.
- Selecting a structure (or auditing a gap) dims all other anatomical structures to semi-transparency while keeping the target structure at 100% opacity.
- *Acceptance Criteria:*
  - [ ] Dragging the ViewCube rotates both the cube and the viewport anatomical model in unison smoothly in 3D space.
  - [ ] Clicking any face of the ViewCube (Front, Back, Right, Left, Top, Bottom) snaps both the cube and the model to that perspective.
  - [ ] Opening the "View" menu and unchecking "Nervous System" hides nerve paths; rechecking displays them.
  - [ ] When a structure is selected or audited, all surrounding structures drop to semi-transparency while the target structure remains fully opaque.

### 2. Interactive Sticky-Note Annotations
Source: `scope.md > The Core Loop`
- Selecting a part opens a compact, floating sticky-note overlay anchored near the part, styled with refined subtle borders.
- If notes exist, they are displayed with an edit field; if no notes exist, an edit box opens ready for typing.
- Notes are created and added to the left tree only when text is entered. Completely blank notes are discarded and never saved.
- *Acceptance Criteria:*
  - [ ] Clicking an anatomical structure opens an anchored note popup displaying its name and text area with subtle, distraction-free styling.
  - [ ] Entering text and closing the popup creates an entry in the left tree.
  - [ ] Closing an untouched, empty note popup leaves no entry in the tree or storage.

### 3. Proactive Knowledge Gap Audit
Source: `scope.md > The Unique Kernel`
- When the user adds or edits notes, the tool proactively asks in the terminal: *"Ready to audit your notes?"* with Accept and Decline actions.
- The user can also trigger an audit manually at any time via the terminal command `audit` or an "Audit" button.
- The audit engine analyzes written notes against ground truth anatomical concepts for the active segment.
- When a gap or missing concept is detected:
  1. The viewport smoothly glides and zooms to the unaddressed structure.
  2. Surrounding structures become semi-transparent, isolating the overlooked structure at full brightness.
  3. Ideas/terms being audited in the note are temporarily highlighted.
  4. An anchored gap callout explains what was omitted.
- *Acceptance Criteria:*
  - [ ] The terminal prompts for audit readiness after notes are written.
  - [ ] Declining closes the prompt without action; accepting runs the audit.
  - [ ] The camera automatically pans and zooms directly to the omitted structure, dimming surrounding elements.
  - [ ] Related audited concepts are highlighted inside the note.

### 4. "What-If" Clinical Scenario Challenge
Source: `scope.md > Reinforce ("What-If")`
- After the viewport isolates the gap, a "What-If" overlay modal appears.
- It presents a targeted clinical/physiological scenario question (e.g., *"What-if the spinal accessory nerve is entrapped at the jugular foramen—what specific motor deficit occurs?"*).
- An input box allows the student to type their explanation.
- Submitting the answer validates the response and appends the verified clinical takeaway into the structure's note.
- *Acceptance Criteria:*
  - [ ] The "what-if" modal displays a clear clinical question with a text input.
  - [ ] Submitting an answer provides immediate feedback and appends the validated insight to the note.
  - [ ] The updated note reflects the new addition immediately in the sticky note and left tree.

### 5. Modern Terminal & Query Console
Source: `scope.md > The Core Loop`
- A sleek, modern console on the right side allowing typed interaction.
- Supports commands: `audit`, `inspect <part>`, `layer <nervous|musculo>`, `view <front|side|top|back>`, `theme <dark|light|pink>`, `help`.
- Displays real-time conversational explanations of anatomical queries and audit dialogue without any emojis.
- *Acceptance Criteria:*
  - [ ] Typing `inspect vagus` opens the Vagus nerve note, isolates it with transparency, and focuses the viewport.
  - [ ] Typing `theme pink` switches the application theme instantly.

## States and Boundaries

- **First Launch State:**
  - One sample note is pre-loaded on a key structure (e.g., Vagus Nerve or Sternocleidomastoid) to demonstrate the format.
  - The left tree shows only systems and the one sample note; no blank note placeholders clutter the tree.
- **Empty Notes State:**
  - If a user deletes all notes and triggers `audit`, the system outputs: *"No notes found to audit. Inspect a structure and jot down some thoughts first."*
- **100% Thorough State (Mastery State):**
  - If notes are comprehensive with no missing core concepts, the audit does not invent false errors; instead, it triggers a "what-if" spaced retrieval challenge on older, less recently viewed notes.
- **Discard State:**
  - Blank or whitespace-only notes are never saved, even as drafts.

## Product Decisions
- **3-Panel Compact Layout:** Chosen by the learner to keep reference models, structured note trees, and terminal interaction visible on a single persistent screen without tab switching.
- **Application Dropdown Menu for Layers:** Modeled after IDE/Sheets standards (`View > Layers`), replacing floating buttons with a clean, standard menu bar.
- **Autodesk Inventor-Style ViewCube with Drag & Click:** Enables both intuitive free-orbit dragging directly on the cube and snapping to all orthogonal and isometric views without orientation inversion.
- **Sticky-Note Overlays:** Floating popups directly on anatomical structures instead of a detached text editor, keeping visual context paramount.
- **Transparency Dimming over Focus Rings:** Making surrounding anatomy semi-transparent isolates the target structure cleanly in 3D/anatomical space without artificial circles.
- **Strict No-Emoji Standard:** Preserves a clean, clinical, and distraction-free learning environment.
- **Proactive Audit Prompting:** The tool politely asks if the user is ready rather than interrupting mid-thought.
- **What-If Clinical Overlays:** Chosen to ensure correcting a gap exercises applied clinical reasoning rather than passive rote memorization.
- **Theme Switcher:** Added to support personal preference and reduce eye strain (Dark, Light, Off-Pink).

## What We're Building
- Complete single-page web application featuring:
  - 3-column compact responsive desktop layout.
  - Classic application menu bar with "View" dropdown for layer toggling (`View > Layers`).
  - Interactive anatomical viewport for segmented cervical/cranial nervous and musculoskeletal structures.
  - Autodesk Inventor-style ViewCube supporting direct click-and-drag free rotation and clean face snapping (Front, Back, Right, Left, Top, Bottom).
  - Contextual transparency dimming of surrounding anatomy when a part is selected or audited.
  - Anchored sticky-note popups with create/edit/delete (blank notes discarded).
  - Modern terminal console supporting queries, commands, and audit triggers.
  - Proactive audit engine that moves the camera to gaps with transparency isolation and temporary concept highlights in notes.
  - "What-If" clinical scenario challenge overlay that appends confirmed insights to notes.
  - Sample pre-loaded note, empty state handling, and 100% thorough spaced retrieval mode.
  - Surgical Dark, Clean Light, and Off-Pink theme switcher.
  - Zero emojis across all interface text and output.

## Deferred From the POC
- Full-body multi-system coverage (respiratory, cardiovascular, etc.) — deferred to keep PoC build time within 2–4 hours.
- Cloud account sync and persistent database backend — deferred; local browser storage provides all needed persistence for personal studies.
- Spaced repetition decay algorithms with calendar scheduling.

## Possible Later Enhancements
- Exporting study notes and "what-if" takeaways to Markdown, PDF, or Anki flashcard decks.
- Dual-mode toggle to slice-based 2D histological stains.

## Non-Goals
- Full-body 3D skeletal rigging and muscular deformation animations.
- Native mobile app versions.
- Multi-user collaborative study sessions.

## Open Questions
- *None blocking spec approval.* The interaction model, layout, behaviors, and criteria are fully resolved.
