// path: README.md
@@
-## Architecture
+## Architecture
@@
-## System Architecture Diagram
+## System Architecture Diagram
@@
-## Real-Time Sync Protocol
+## Real-Time Sync Protocol
@@
-## How Conflicts Resolve: Property-Level CRDT vs OT
+## How Conflicts Resolve: Property-Level CRDT vs OT
@@
-## What Is Real vs. Simulated
+## What Is Real vs. Simulated
@@
-## Tech Stack & Architecture Choices
+## Tech Stack & Architecture Choices
@@
-## Development Workflow (local, docker, k8s)
+## Development Workflow (local, docker, k8s)
@@
-## Performance Benchmarks & Concurrency Tests
+## Performance Benchmarks & Concurrency Tests
+
+The **CRDT Property‑Based Convergence Test** (`packages/shared/__tests__/crdt-convergence-property.test.ts`) validates that four independent `BoardDocManager` instances applying random concurrent mutations converge to an identical state, even with out‑of‑order and duplicated updates. This test guarantees that the Yjs‑based collaboration layer satisfies strong eventual consistency for real‑time editing.
*** End Patch
*** End Patch