// path: docs/tools.md
# Sketchboard Interaction Tools (Phase 2)

This document explains the user‑facing **tools** available in the Sketchboard UI, how they map to internal engine actions, and the keyboard shortcuts.

| Tool | UI Icon | Keyboard shortcut | Core engine path |
|------|---------|-------------------|-----------------|
| **Select** | ![mouse-pointer] | `V` | `CanvasEngine` → `mode = 'idle'` / hit‑test on `pointerdown` |
| **Hand / Pan** | ![hand] | `H` | `CanvasEngine` → `mode = 'panning'` (Space or middle‑mouse) |
| **Rectangle** | ![square] | `R` | Drag‑to‑create preview → `addObject` on `pointerup` |
| **Ellipse** | ![circle] | `O` | Same as rectangle, but draws an ellipse in the preview |
| **Line** | ![minus] | `L` | Drag‑to‑create a line segment |
| **Arrow** | ![arrow] | `A` | Drag‑to‑create a line with an arrowhead |
| **Freehand Pen** | ![pencil] | `P` | Continuous point capture → `smoothPoints` → `addObject` on release |
| **Text** | ![type] | `T` | Click creates a text object, instantly opens the **TextEditorOverlay** for inline editing |
| **Sticky Note** | ![sticky-note] | `N` | Click creates a sticky note object (Swahili colour) and opens the same overlay for editing |

## Undo / Redo
- **Undo** – `Ctrl/Cmd + Z` (or click the blue **↶** button in the toolbar). Calls `BoardDocManager.undo()`. The button is disabled when there is nothing to undo.
- **Redo** – `Ctrl/Cmd + Shift + Z` (or click **↷**). Calls `BoardDocManager.redo()`.

Both operations are powered by **Yjs `UndoManager`**, which tracks changes at the *property* level, guaranteeing that independent edits (e.g., moving a shape while another user changes its colour) are merged correctly.

## Implementation notes
- The toolbar now receives the `BoardDocManager` instance and directly invokes `undo()` / `redo()`. This keeps the UI stateless and lets Yjs handle the heavy lifting.
- The `Toolbar` component also shows disabled styling when undo/redo is unavailable.
- All tools respect the current **Swahili colour palette** (`activeColor`) and the active **stroke colour**/width.
- The **color picker** remains unchanged and still writes the chosen Swahili colour name into the store, which the engine reads when creating new shapes.

---

*This file is linked from the top‑level README for quick reference.*
