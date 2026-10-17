# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-10-17

Initial production release of **Sketchboard**: a Figma-grade real-time collaborative canvas built for Kenyan design, fintech, and product engineering squads.

### Added

#### Core Real-Time Engine & CRDT
- **Yjs Binary Transport over Socket.io**: Unified WebSocket and polling transport carrying native `yjs` binary updates without relying on `y-websocket`.
- **Property-Level CRDT Granularity**: Document model using `Y.Map<string, Y.Map<string, any>>` ("objects") and `Y.Array<string>` ("zOrder"). Non-conflicting edits to different properties of the same shape merge seamlessly.
- **User-Scoped Undo/Redo**: Implemented `Y.UndoManager` tracking strictly local origin transactions (`'local'`), ensuring users can undo their own changes without reverting peer squad edits.
- **Optimistic UI with Outbox Queue**: Local edits apply instantly at 60fps; unacknowledged changes are held in an outbox map and re-transmitted upon reconnect.
- **Property-Based CRDT Convergence Test**: Automated fuzzing test validating 4 concurrent clients under randomized operation order and 25% duplicate packet loss converge byte-identically.

#### Dual-Layer Canvas Renderer (HTML5 2D API)
- **Zero Third-Party Canvas Libraries**: Implemented using pure browser Canvas 2D API without heavy wrappers (no Konva, no Fabric, no Pixi).
- **Dual-Layer Architecture**:
  - *Bottom Layer*: Static scene canvas updated strictly upon document mutations.
  - *Top Layer*: Interaction overlay rendering multi-select bounding boxes, 8 resize handles, rotation handle, marquee selection box, and live remote cursors at 60fps.
- **Spatial Grid Broadphase Indexing**: Custom `SpatialGrid` partitioning world space into cells, achieving viewport culling in `< 1ms` across 2,000 objects.
- **Interactive Shape Tools**: Selection/Transform (V), Hand/Pan (H/Space), Rectangle (R), Ellipse (O), Line (L), Arrow (A), Freehand Pen (P) with Chaikin smoothing and `Path2D` caching, Text (T), and Sticky notes (N).
- **Inverse Matrix Hit-Testing**: Rotated bounding box hit-detection with padding for touch devices.
- **DOM Inline Editing Overlay**: Seamless text editing overlay for text boxes and sticky notes committing on blur or Enter.

#### Design System & Internationalization
- **Kenyan Swahili Colour Palette**: Defined single source of truth in `@sketchboard/shared`: `Njano` (Yellow), `Waridi` (Pink), `Kijani` (Green), `Buluu` (Blue), `Machungwa` (Orange), `Zambarau` (Purple), `Nyekundu` (Red), `Kijivu` (Grey).
- **Deterministic Cursor Colors**: Hash-based deterministic color assignment with local collision avoidance.
- **Bilingual UI (English & Kiswahili)**: Interactive language switch (`EN | SW`) toggling all toolbar tools, dialogs, and status badges.
- **Offline Resilience Banner**: Real-time alert banner indicating when network connectivity is lost.

#### Offscreen Export Engine (PNG & PDF)
- **High-DPI Offscreen PNG Export**: Pure canvas rasterization at 1x, 2x, and 3x scale with optional transparent background.
- **Responsive PDF Generation**: Multi-page orientation matching (A4/A3 landscape/portrait) via `jsPDF`.
- **Nairobi Timestamped Footer**: Exports automatically stamped with `Africa/Nairobi` timezone, board title, and `"Made with Sketchboard"`.
- **Interactive Export Modal**: Triggered via `Ctrl+E` or header button with progress feedback.

#### Distributed Multi-Node DevOps & Kubernetes
- **Multi-Node Redis Clustering**: `@socket.io/redis-adapter` relaying room broadcasts across multiple server replicas.
- **Redis Hot Update Log & Compaction**: Append-only list (`sketchboard:board:<boardId>:updates`) compacted into PostgreSQL `boards` snapshots upon reaching update or size thresholds with distributed locking.
- **Docker Multi-Stage Images**: Non-root production containers for server and web with HTTP healthchecks.
- **Docker Compose Production Topology**: 2 server nodes, Redis, Postgres, Web, and NGINX Load Balancer on port `8080`.
- **Kubernetes Manifests (Kustomize)**: Deployments with pod anti-affinity, RollingUpdate, PDB (`maxUnavailable: 1`), HPA, and NGINX Ingress sticky session cookie annotations.
- **Automated Chaos & Load Benchmarks**: Pod crash failover test (0 edits lost) and 50-socket cluster load benchmark.
- **Playwright Multi-Browser Collaboration Verification**: Automated multi-context browser test suite (`make test-e2e`) verifying real-time cross-client replication, concurrent drag convergence, live cursors, and reload state recovery.
- **Automated Hero Screenshot Generation**: Reproducible browser viewport capture to `docs/assets/hero-screenshot.png`.
- **Automated Kind 2-Node Kubernetes Smoke Test**: Scripts (`make k8s-smoke`) verifying full cluster deployment and pod readiness across a 2-worker node Kind cluster.
- **GitHub Container Registry (GHCR) & GitHub Pages Workflows**: Automated container publishing and web deployment pipelines.
