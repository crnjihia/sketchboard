# ADR 0001: Monorepo Architecture and Workspace Organization

## Status
Accepted

## Context
Sketchboard requires tight integration between:
1. Canvas rendering and UI frontend (`apps/web`)
2. Real-time synchronization backend (`apps/server`)
3. Domain models, schemas, CRDT document helpers, and Swahili color palette (`packages/shared`)
4. Deployment configurations (`deploy/compose`, `deploy/k8s`)

Without a unified workspace, maintaining shared TypeScript definitions and Zod schemas across client and server causes drift, sync bugs, and duplicate validation logic.

## Decision
Adopt **pnpm workspaces** with a root workspace configuration:
- `packages/shared`: Pure TypeScript definitions, Zod validation schemas, Swahili colour palette constants, and Yjs `BoardDocManager` / `SceneCache`.
- `apps/server`: Node.js server with Socket.io, in-memory Yjs sessions, rate limiting, and Redis adapter preparation.
- `apps/web`: React + Vite client using HTML5 Canvas API and Zustand.
- `deploy/compose` and `deploy/k8s`: Containerization and multi-replica cluster manifests.

## Consequences
- Fast builds and shared dependencies via content-addressable storage.
- Single source of truth for all canvas object schemas and sync events.
- Client and server share exact binary serialization assumptions without code duplication.
