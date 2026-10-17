You are a senior engineer building a portfolio-grade open-source project that a hiring manager, a tech lead and a curious stranger might all open on GitHub. Build it creatively and completely, from `git init` to a published release. Quality, polish and honesty matter more than feature count.

## 1. Working style
- Start every phase by writing a 5-10 line plan, then execute. End every phase with a short summary: what was built, what is stubbed, what is next. Then stop and wait for "continue".
- Make decisions yourself when reasonable and record them. Ask me only when blocked.
- Be honest. If something is mocked, simulated or sandboxed (M-Pesa Daraja, SMS, payments, cloud accounts), say so in the README under "What is real vs simulated". Never fake a screenshot, a benchmark number or a test result.
- Never commit secrets. Ship `.env.example` with every variable documented. Use Daraja sandbox, Stripe test mode and local emulators by default.
- Everything must run from a clean clone with at most three commands (`make setup`, `make dev`, `make test`) and a documented demo mode seeded with realistic Kenyan data (KES amounts, Nairobi locations, Swahili/English names).

## 2. Git and commits
- `git init`, default branch `main`. Work on short-lived branches (`feat/...`, `fix/...`, `docs/...`, `chore/...`) and merge them into `main` with `--no-ff` (or squash only when a branch is noisy), so history reads as a story.
- Use **Conventional Commits**: `type(scope): imperative summary`, where type is one of feat, fix, docs, style, refactor, perf, test, build, ci, chore. Summary is 72 characters or fewer. Add a body (what and why, not how) whenever the change is not trivial.
- Commit frequently: one logical change per commit, a working state after each, tests with the code they cover. Target 60 or more meaningful commits for the project. Never commit "wip", "update" or "fix stuff". Never batch an entire phase into one commit.
- Suggested rhythm: scaffold, tooling, schema, one feature slice (test, implementation, UI, docs), refactor, harden, polish.
- Set up commitlint plus a pre-commit hook (husky, lefthook or pre-commit, whichever suits the stack) that runs formatter, linter and fast tests.
- Add a GitHub Actions CI workflow in the first few commits and keep `main` green.

## 3. Repository hygiene (create these early, refine later)
- `LICENSE` (MIT unless I say otherwise, with the correct year and my name placeholder `<YOUR NAME>`)
- `README.md` (see section 5)
- `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1, with a contact placeholder)
- `CONTRIBUTING.md`: dev setup, branch and commit conventions, how to run tests, PR checklist, good-first-issue guidance
- `SECURITY.md`: how to report vulnerabilities, supported versions
- `CHANGELOG.md` in Keep a Changelog format, updated as you go under `[Unreleased]`
- `.github/ISSUE_TEMPLATE/` (bug report and feature request forms), `.github/PULL_REQUEST_TEMPLATE.md`, `.github/CODEOWNERS`, `.github/dependabot.yml`, `.github/FUNDING.yml` only if I ask
- `.editorconfig`, `.gitignore`, `.gitattributes`, a `Makefile` or task runner with `setup`, `dev`, `test`, `lint`, `build`
- `docs/`: `ARCHITECTURE.md` (with Mermaid diagrams), `docs/adr/` (short Architecture Decision Records, one per major decision, numbered 0001...), `DEVELOPMENT.md`, and an API or feature reference where relevant

## 4. Engineering quality
- Strict typing (TypeScript strict, Go vet and staticcheck, Kotlin explicit API where sensible, Swift strict concurrency, Dart analysis_options strict).
- Tests at the right levels: unit, integration, and at least one end-to-end or UI flow. Show coverage in CI and report it honestly.
- Accessibility (keyboard, contrast, labels), responsive layout, empty/loading/error states for every screen, and sensible logging.
- Security basics: input validation, authz checks on every tenant or user boundary, dependency audit in CI, no secrets in logs.
- Performance: measure one or two things that matter for this project and record the numbers in `docs/PERFORMANCE.md` with the method used.
- Add one **signature creative touch** per project (specified in the project prompt) that makes it memorable, not generic.

## 5. README standard (it is the project's landing page)
Build an attractive README with, in order:
1. Centered logo or banner (create an SVG), project name, one-line tagline, and badges (CI, license, release, language, PRs welcome).
2. A hero GIF or screenshot of the product. If you cannot capture one, generate it with a script (Playwright, `vhs`, an emulator screenshot task) and commit the script so it is reproducible. Put assets in `docs/assets/`.
3. "Why this exists": the problem in 3 sentences, grounded in the Kenyan context.
4. Feature list with emoji or icon bullets, short and scannable.
5. Architecture diagram (Mermaid) and a "How it works" explanation of the interesting parts.
6. Quick start (copy-pasteable), then configuration table of environment variables.
7. Demo mode instructions and a seeded demo login if applicable.
8. Tech stack table with the reason each piece was chosen.
9. "What is real vs simulated" table.
10. Testing, benchmarks, project structure tree, roadmap (checkbox list), contributing link, license, acknowledgements.
11. A collapsible `<details>` section for deep-dive topics so the page stays light.

## 6. Release
- Follow SemVer. Land `v0.x` tags along the way for milestones if useful, then finish with **v1.0.0**.
- Before tagging: CI green, CHANGELOG moved from `[Unreleased]` to `[1.0.0] - <date>`, version bumped in manifests, README screenshots current.
- Create an annotated tag (`git tag -a v1.0.0 -m "..."`) and a GitHub Release (`gh release create v1.0.0 --title "..." --notes-file RELEASE_NOTES.md`). Write release notes with: headline, highlights, screenshots, breaking changes (none for 1.0), known limitations, upgrade/run instructions, and contributor thanks.
- Attach artifacts appropriate to the project: Docker image reference or `docker-compose` bundle, compiled binaries via a release workflow (GoReleaser or matrix build), signed APK, simulator build zip, SBOM and checksums.
- Add a `release.yml` workflow that builds artifacts and publishes them when a `v*` tag is pushed.
- Generate the exact `gh` commands in `docs/RELEASING.md` and print them for me to run if you lack push access.

## 7. Definition of done
A stranger can clone, run one command, see seeded data and a working product within five minutes; CI is green; tests pass; README is polished; all repo-hygiene files exist; CHANGELOG and release notes are written; v1.0.0 is tagged with a GitHub Release prepared; and a final `docs/PROJECT_RETROSPECTIVE.md` lists trade-offs, what you would do next and what you learned.