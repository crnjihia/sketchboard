# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Dual-layer HTML5 Canvas renderer**: Split architecture decoupling the static scene canvas from the interaction overlay canvas (selection bounds, resize handles, marquee box, and volatile cursors).
- **Spatial grid index & viewport culling**: Uniform spatial grid (`SpatialGrid`) in `@sketchboard/shared` providing O(1) broadphase lookups and sub-millisecond viewport culling sustaining 60fps with 2,000 objects.
- **Inverse transform hit-testing**: Exact hit-testing for arbitrarily rotated rectangles, ellipses, lines, arrows, smoothed freehand strokes, and 8 resize handles + rotation handle with touch target margins.
- **Interactive canvas tools**: Support for Select (V), Pan/Hand (H/Space), Rectangle (R), Ellipse (O), Line (L), Arrow (A), Freehand pen (P) with Chaikin smoothing and `Path2D` caching, Text (T), and Sticky notes (N).
- **Swahili color picker & author tags**: Sticky notes with author tags ("— Amina Kimani") and Swahili color selection (`Njano`, `Waridi`, `Kijani`, `Buluu`, etc.).
- **Positioned DOM textarea overlay**: Seamless text and sticky note inline editing committing directly to Y.Doc upon blur/Enter.
- **Pan & Zoom engine**: Infinite canvas with adaptive dot grid, cursor-anchored wheel zooming (10% to 400%), middle-click / space-drag panning, and multi-touch pinch zoom for mobile devices.
- **Performance HUD**: Real-time FPS, rendered vs culled objects, and viewport stats activated via `?debug=1`.
- **Keyboard shortcuts modal**: Interactive `?` help dialog detailing keybindings and touch gestures.
- **Monorepo architecture**: Initialized pnpm workspaces monorepo structure with `packages/shared`, `apps/server`, and `apps/web`.
- **Kenyan Swahili colour palette**: Single source of truth in `@sketchboard/shared` featuring `Njano`, `Waridi`, `Kijani`, `Buluu`, `Machungwa`, `Zambarau`, `Nyekundu`, `Kijivu` with deterministic user color hashing and collision avoidance.
- **Canvas object schemas**: Zod validation schemas and TypeScript types for `rectangle`, `ellipse`, `line`, `arrow`, `freehand`, `text`, and `sticky`.
- **Yjs CRDT document model**: Property-level `Y.Map<string, Y.Map<string, any>>` objects model and `Y.Array<string>` z-order collection in `BoardDocManager`.
- **Zero-allocation SceneCache**: Plain-JS derived scene cache subscribing via `observeDeep` to isolate the 60fps render loop from Yjs query overhead.
- **Socket.io binary sync protocol**: Real-time sync pipeline supporting state vector diffs (`sync:step1`, `sync:step2`), optimistic local transactions, server ACKs (`sync:ack`), payload size bounds (256 KB), rate-limiting (60 ops/sec), and volatile cursor relay (`cursor:move`).
- **Comprehensive test suites**: 21 unit, integration, and benchmark tests covering CRDT property-level conflict convergence and multi-client headless Socket.io sync loops.
- **Architecture decision records**: ADRs 0001 (Monorepo), 0002 (Yjs over Socket.io), and 0003 (Property-level CRDT).
