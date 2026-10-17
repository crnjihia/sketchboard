# Developer & Contributor Guide

This guide walks you through local development workflows, debugging techniques, and testing strategies for **Sketchboard**.

---

## 1. Monorepo Organization

```
packages/shared/  # Pure TypeScript types, CRDT manager, geometric math, Swahili palette
apps/server/      # Fastify/Express + Socket.io server, Redis hot log, Postgres compaction
apps/web/         # React 18 + Vite frontend, HTML5 Canvas engine, Zustand UI store
deploy/compose/   # Docker Compose multi-container local cluster
deploy/k8s/       # Production Kustomize Kubernetes manifests
scripts/          # Chaos tests, cluster load tests, and demo seeder scripts
```

---

## 2. Setting Up Local Environment

```bash
# Clone the repository
git clone https://github.com/crnjihia/sketchboard.git
cd sketchboard

# Install dependencies across all packages and approve native build tools (esbuild)
make setup

# Run the full test suite
make test
```

---

## 3. Running Locally in Host Mode

To run without Docker containers:

```bash
# Terminal 1: Run both Web and Server in parallel
make dev

# Or run separately:
make dev-server  # Starts Socket.io server on http://localhost:4000
make dev-web     # Starts Vite development server on http://localhost:5173
```

When running without Redis or PostgreSQL, the server operates in standalone in-memory mode.

---

## 4. Running the Clustered Production Environment

To run the exact 2-node cluster with NGINX load balancer, Redis Pub/Sub, and PostgreSQL:

```bash
# Build and start all containers
make compose-up

# Verify health probes
curl http://localhost:8080/healthz
curl http://localhost:8080/readyz
curl http://localhost:8080/metrics
```

Open your browser to: **`http://localhost:8080`**

---

## 5. Debugging & Performance Tools

### Performance Overlay (`?debug=1`)
Append `?debug=1` to any board URL (e.g., `http://localhost:8080/?debug=1` or `http://localhost:5173/?debug=1`).

This activates a real-time HUD showing:
- Current Frame Rate (FPS) and target frame latency
- Culled objects vs. total objects on the canvas
- Active viewport zoom level and translation matrix
- Serving backend Node ID (`server-1` or `server-2`)

### Standalone Demo Board Seeder
To inject the realistic Kenyan FinTech Super-App canvas into any running instance:

```bash
make seed
# Or specify target URL and board ID:
pnpm tsx scripts/seed-demo.ts http://localhost:8080 nairobi-hq
```

---

## 6. Testing Workflows

```bash
# Run Vitest test runner
pnpm test

# Run Vitest in watch mode
pnpm test:watch

# Run Chaos Failover Test
make test-chaos

# Run 50-socket cluster load benchmark
make test-load
```
