---
doc: scope
status: approved
---

# NeuroSoma: Anatomy Study & Knowledge-Gap Navigator

A persistent study companion for anatomy and biomedical coursework that pairs an interactive anatomical viewer with an active gap-detecting knowledge auditor.

## The Unique Kernel
The tool doesn't just display anatomical models—it tracks what you know. When you write study notes and trigger an audit, it detects blind spots in your coverage, automatically moves the viewport directly to the overlooked structure, anchors a targeted gap note explaining the concept, and delivers a concrete "what-if" clinical/functional scenario once corrected to solidify understanding.

## Who It's For
A biomedical and anatomy student studying dense, interconnected bodily systems who keeps a study tool open in a persistent tab, wanting to actively verify recall and note completeness rather than passively re-reading lecture slides.

## The Core Loop
1. **Explore:** View the segmented nervous/musculoskeletal systems and toggle layers on/off.
2. **Inspect:** Select parts via click or terminal query to review function and known/unknown status.
3. **Annotate:** Write personal study notes on the structures.
4. **Audit:** Trigger the knowledge gap check; the viewport navigates directly to omitted or thin concepts with anchored callouts.
5. **Reinforce ("What-If"):** After correcting the gap in your notes, the tool serves a targeted biomedical "what-if" question (e.g., nerve compression, biomechanical strain, or pathway lesion) to test functional mastery.

## Inspiration & Identity
- High-contrast clinical dark mode aesthetic.
- Terminal-inspired study console paired with an interactive anatomical viewport.
- Uncluttered, responsive, focused on spatial memory and diagnostic feedback.

## Why This Matters to the Learner
Anatomy coursework involves dense structural hierarchies. Having a companion that acts like an interactive study partner—pinpointing exactly where your notes fall short on the visual model and challenging you with functional "what-if" scenarios—builds real clinical intuition.

## What "Working" Looks Like
In a 1-minute demo:
1. The app initializes onto an anatomical system overview (segmented nervous and musculoskeletal region).
2. The user toggles a layer and inspects a part.
3. The user writes study notes in the console.
4. The user clicks/commands "Audit Notes."
5. The viewport automatically transitions to a structure omitted from the notes, displaying an anchored gap callout with explanatory details.
6. The user updates the note to address the gap, and the tool delivers a brief "what-if" scenario that tests the clinical consequence of the structure.

## The POC Boundary
- **Included (Now):**
  - Segmented model focusing on key nervous and musculoskeletal structures.
  - Interactive viewport with focus/pan animations.
  - Layer toggles (nervous vs. musculoskeletal).
  - Selection via click or terminal prompt.
  - Note-taking input.
  - Automated note-skimming audit that navigates the camera to the omitted structure and displays an anchored callout.
  - "What-if" scenario prompt presented after addressing a knowledge gap.

## Later
- Full-body multi-system coverage (circulatory, digestive, etc.).
- Complex dual-mode switching between 2D histology slices and full 3D CAD meshes.
- Long-term spaced repetition scheduling and multi-session persistence.

## Explicitly Cut
- Full-body rigging and muscle deformation animations.
- Mobile native application packaging.
- Multi-user study groups or cloud syncing.
