# ADR 0007: Yjs State-based CRDT vs Centralized Operational Transformation (OT)

## Status
Accepted

## Context
Real-time collaborative editing is typically solved by either Operational Transformation (OT) or Conflict-Free Replicated Data Types (CRDT):
- **Operational Transformation (OT)** (e.g. Google Docs, Figma engine): Requires a single authoritative central server to sequence all operations, transform incoming concurrent operations against historical logs, and enforce strict ordering. In a multi-node or offline setting, transforming operations across non-linear history requires complex transformation matrices (TP1/TP2 conditions), and offline editing is notoriously difficult to reconcile cleanly without central locks.
- **Conflict-Free Replicated Data Types (CRDT)** (e.g. Yjs, Automerge): Uses mathematically proven conflict-free convergence. Any client can mutate the document locally offline; updates are commutative and idempotent, meaning they can arrive out of order, be duplicated, or be merged across peer nodes without needing a single central sequencer.

## Decision
Adopt **Yjs state-based CRDT** over transport-agnostic OT:
1. **Offline-First Resilience**: Users in Kenya and emerging markets often experience intermittent mobile connectivity. With Yjs, design teams can continue sketching and taking notes while offline; when connectivity returns, local outboxes flush and merge deterministically.
2. **Decentralized Multi-Node Scalability**: Multiple Socket.io backend nodes independently apply updates to their local `Y.Doc` instances via Redis Pub/Sub without requiring a single centralized master lock or sequencer.
3. **Idempotency & Resilience**: Network retries are completely safe because applying a Yjs binary update multiple times has zero side effects.

## Consequences
- Guaranteed convergence across all browser tabs and server nodes.
- High resilience to latency variations and network drops.
- Eliminates the need for complex, bug-prone operational transformation matrices.
