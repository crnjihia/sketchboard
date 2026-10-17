# ADR 0003: Property-Level CRDT Document Model vs Flat Object Array

## Status
Accepted

## Context
In collaborative whiteboarding, users frequently interact with the same shape simultaneously:
- User A drags the shape to a new position (`x`, `y`).
- User B changes the fill color (`style.fill`) or edits the text (`text`).
- In a naïve CRDT where shapes are atomic objects in a `Y.Array<Shape>` or `Y.Map<string, Shape>`, the last write would overwrite the entire shape, obliterating either the movement or the color edit.

## Decision
Represent each board as:
1. `objects`: `Y.Map<string, Y.Map<string, any>>`
   - Key: Object ID.
   - Value: Nested `Y.Map` of properties (`x`, `y`, `w`, `h`, `rotation`, `style`, `text`, `updatedAt`, etc.).
   - This provides property-level granularity: concurrent edits to different properties of the same shape merge without conflict (both edits succeed).
   - Concurrent edits to the same property (e.g. two users dragging the same shape) resolve deterministically via Yjs logical clocks (last-writer-wins per property).
2. `zOrder`: `Y.Array<string>`
   - Independent ordered list of object IDs from bottom-most (index 0) to top-most (front).
   - Decouples shape geometric properties from stacking order, avoiding race conditions during layer re-ordering.
3. `SceneCache`:
   - A derived plain-JS cache populated via `objects.observeDeep` and `zOrder.observe`.
   - Protects the 60fps canvas render loop from allocating or querying Yjs types on every frame.

## Consequences
- High collaboration fidelity: multi-user interactions feel natural and non-destructive.
- Clean separation of concerns between CRDT mutations and high-performance Canvas 2D rendering.
