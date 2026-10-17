# Sketchboard v1.0.0 Release Notes

**Sketchboard** is a Figma-grade real-time collaborative canvas engineered specifically for Kenyan design, fintech, and distributed product engineering squads.

---

## Highlights

- 🎨 **HTML5 Canvas 2D Dual-Layer Engine**: Zero third-party canvas dependencies. Split rendering isolating 60fps interaction overlays from static scene repaints.
- 📐 **Sub-Millisecond SpatialGrid Culling**: Custom broadphase index sustaining 60fps with 2,000 shapes (< 1ms query time).
- 🔄 **Yjs CRDT over Unified Socket.io**: Property-level merge granularity. If Alice moves a rectangle while Juma changes its color, both edits succeed without clobbering.
- ↩️ **Scoped Multi-User Undo/Redo**: Revert your own actions via `Ctrl+Z` without reverting remote collaborators' changes.
- ⚡ **Redis Hot-Log & PostgreSQL Compaction**: Append-only Redis update streams with distributed lock compaction to PostgreSQL snapshots.
- 🖨️ **High-DPI Offscreen Export Engine**: 1x, 2x, 3x PNG exports and aspect-adaptive PDFs stamped with `Africa/Nairobi` timestamps.
- 🇰🇪 **Kenyan Swahili Design System**: Swahili palette (`Njano`, `Waridi`, `Kijani`, `Buluu`, etc.) and bilingual UI toggle (`EN | SW`).
- ☸️ **Production Kubernetes & Docker Compose**: 2 server replicas, Redis, Postgres, Web, and NGINX Load Balancer with sticky session routing.

---

## Quickstart

```bash
# Clone and setup
git clone https://github.com/crnjihia/sketchboard.git
cd sketchboard
make setup

# Run tests (27 unit/integration tests)
make test

# Start full multi-node cluster
make compose-up

# Seed Nairobi FinTech Super-App demo board
make seed
```

Access the application at [http://localhost:8080](http://localhost:8080) (`?debug=1` for performance metrics).

---

## Test Verification Summary
- **Unit, Integration & CRDT Fuzzing Tests**: 27/27 Passed (`make test`)
- **Multi-Browser Playwright Collaboration Test**: 100% Passed (`make test-e2e`)
- **Crash Failover Chaos Test**: Passed with 0 lost edits (`make test-chaos`)
- **Cluster Load Benchmark**: 5,350 cursors, 200 edits, 100% ACK rate (`make test-load`)
- **Kubernetes 2-Node Kind Smoke Test**: Rollout verified on 2 worker nodes (`make k8s-smoke`)
