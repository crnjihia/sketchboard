# Contributing to Sketchboard

Thank you for your interest in contributing to Sketchboard! We welcome contributions from design technologists, frontend engineers, distributed systems builders, and open-source enthusiasts.

---

## 1. Code of Conduct

All contributors are expected to uphold our [Code of Conduct](CODE_OF_CONDUCT.md). Please treat all members of the community with empathy, respect, and professionalism.

---

## 2. Development Setup

Sketchboard is structured as a `pnpm` monorepo using TypeScript strict mode throughout.

### Prerequisites
- **Node.js**: `>= 22.0.0`
- **pnpm**: `>= 12.0.0`
- **Docker & Docker Compose**: (Optional, for full cluster orchestration)

### Quick Start
```bash
# 1. Clone the repository
git clone https://github.com/crnjihia/sketchboard.git
cd sketchboard

# 2. Install workspace dependencies and approve build scripts
make setup

# 3. Start local development servers (Vite: http://localhost:5173, Server: http://localhost:4000)
make dev
```

---

## 3. Branching & Commit Conventions

### Branch Naming
Work on short-lived feature branches cut from `main`:
- `feat/feature-name` &bull; New features or capabilities
- `fix/bug-description` &bull; Bug fixes
- `perf/optimization` &bull; Performance improvements
- `docs/documentation` &bull; Documentation additions or edits
- `test/test-suite` &bull; Test harness and benchmark updates
- `chore/task` &bull; Build tooling, dependencies, or maintenance

### Conventional Commits
All commits must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:
```
<type>(<optional scope>): <imperative summary>

[optional body explaining WHAT and WHY, not HOW]
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`.

**Examples**:
- `feat(canvas): implement dual-layer canvas renderer with spatial grid culling`
- `fix(sync): resolve race condition during hot update log compaction`
- `docs(adr): record architectural decision for volatile cursors outside CRDT`

---

## 4. Testing & Quality Standards

Before submitting a Pull Request, ensure all quality gates pass:

```bash
# Run all unit, integration, and benchmark tests (27 tests)
make test

# Run chaos pod failover test
make test-chaos

# Run cluster load test
make test-load

# Run full monorepo build and strict typechecks
make build
```

### Guidelines:
- **Zero External Canvas Libraries**: All canvas rendering must use the native HTML5 Canvas 2D API (`OffscreenCanvas` for exports). Do not add Fabric, Konva, or Pixi.
- **CRDT Integrity**: All collaborative state must mutate via `BoardDocManager` inside transactional boundaries (`doc.transact(...)`).
- **Volatile Cursors**: Live cursors must remain strictly outside the persistent CRDT document.
- **Swahili Palette**: Any design tokens must reference `packages/shared/src/palette.ts` as the single source of truth.

---

## 5. Pull Request Checklist

When opening a Pull Request:
- [ ] Code compiles cleanly with `pnpm build` across all packages.
- [ ] New code is covered by tests in `packages/shared/__tests__`, `apps/server/__tests__`, or `apps/web/__tests__`.
- [ ] Conventional Commit messages are used.
- [ ] ADR added to `docs/adr/` if introducing an architectural decision.
- [ ] Updated `README.md` or documentation if altering user-facing features.

---

## 6. Good First Issues

If you are new to the repository, look for issues tagged `good first issue` or explore:
- Adding touch gesture support for mobile tablets
- Adding additional export templates (e.g. SVG export)
- Translating additional UI strings into Swahili
- Improving spatial grid cell size tuning for ultra-dense boards

Harambee & thank you for contributing!
