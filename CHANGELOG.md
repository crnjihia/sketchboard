# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Monorepo architecture**: Initialized pnpm workspaces monorepo structure with `packages/shared`, `apps/server`, and `apps/web`.
- **Kenyan Swahili colour palette**: Single source of truth in `@sketchboard/shared` featuring `Njano`, `Waridi`, `Kijani`, `Buluu`, `Machungwa`, `Zambarau`, `Nyekundu`, `Kijivu` with deterministic user color hashing and collision avoidance.
- **Canvas object schemas**: Zod validation schemas and TypeScript types for `rectangle`, `ellipse`, `line`, `arrow`, `freehand`, `text`, and `sticky`.
- **Yjs CRDT document model**: Property-level `Y.Map<string, Y.Map<string, any>>` objects model and `Y.Array<string>` z-order collection in `BoardDocManager`.
- **Zero-allocation SceneCache**: Plain-JS derived scene cache subscribing via `observeDeep` to isolate the 60fps render loop from Yjs query overhead.
- **Socket.io binary sync protocol**: Real-time sync pipeline supporting state vector diffs (`sync:step1`, `sync:step2`), optimistic local transactions, server ACKs (`sync:ack`), payload size bounds (256 KB), rate-limiting (60 ops/sec), and volatile cursor relay (`cursor:move`).
- **Comprehensive test suites**: 14 unit and integration tests covering CRDT property-level conflict convergence and multi-client headless Socket.io sync loops.
- **Architecture decision records**: ADRs 0001 (Monorepo), 0002 (Yjs over Socket.io), and 0003 (Property-level CRDT).
