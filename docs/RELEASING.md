# Releasing Sketchboard

This document defines the release engineering checklist and commands for cutting official releases of **Sketchboard**.

---

## 1. Versioning Policy

Sketchboard adheres to [Semantic Versioning (SemVer 2.0.0)](https://semver.org/):
- **MAJOR (`x.0.0`)**: Incompatible API or protocol wire breaking changes.
- **MINOR (`0.x.0`)**: Backwards-compatible features and capabilities.
- **PATCH (`0.0.x`)**: Backwards-compatible bug fixes and performance hardening.

---

## 2. Pre-Release Quality Gates

Before cutting a release:
1. Ensure all CI workflows are green on `main`.
2. Run full monorepo build and tests:
   ```bash
   pnpm build
   pnpm test
   pnpm test:chaos
   pnpm test:load
   ```
3. Update `CHANGELOG.md` by moving items from `[Unreleased]` to `[x.y.z] - YYYY-MM-DD`.
4. Update version strings in `package.json`, `packages/shared/package.json`, `apps/server/package.json`, and `apps/web/package.json`.

---

## 3. Releasing via GitHub CLI (`gh`)

Execute the following commands to tag and publish the release:

```bash
# 1. Ensure you are on main with a clean working tree
git checkout main
git pull origin main

# 2. Create the annotated git tag
git tag -a v1.0.0 -m "Release v1.0.0 - Production release of Sketchboard"
git push origin v1.0.0

# 3. Create the GitHub Release using the release notes
gh release create v1.0.0 \
  --title "Sketchboard v1.0.0 - Real-Time Collaborative Canvas for Kenyan Teams" \
  --notes-file RELEASE_NOTES.md
```

---

## 4. Post-Release Verification

- Verify that `.github/workflows/release.yml` triggers on the `v*` tag.
- Verify container images build and push to container registry (GHCR).
- Check that the release is visible on GitHub with attached notes.
