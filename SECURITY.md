# Security Policy

The Sketchboard team takes the security of our real-time collaboration engine and user data seriously. We appreciate the responsible disclosure of any vulnerabilities.

---

## Supported Versions

Only the latest release version on the `main` branch receives security updates.

| Version | Supported          |
| :---    | :---               |
| 1.0.x   | :white_check_mark: |
| < 1.0.0 | :x:                |

---

## Reporting a Vulnerability

**Please do NOT report security vulnerabilities through public GitHub issues.**

If you discover a potential vulnerability in Sketchboard:

1. Send an email to **[security@sketchboard.dev]** (or contact the maintainers directly via repository security advisories).
2. Include the following details:
   - Type of vulnerability (e.g. CRDT payload injection, unauthorized Socket.io room join, memory exhaustion via unbounded binary updates).
   - Step-by-step reproduction instructions or a minimal proof-of-concept.
   - Affected components (`@sketchboard/shared`, `@sketchboard/server`, or `@sketchboard/web`).
   - Potential impact on cluster integrity or data confidentiality.

---

## Response Process & SLA

- **Acknowledgment**: We will acknowledge receipt of your report within **48 hours**.
- **Assessment**: Our engineering team will assess and validate the vulnerability within **5 business days**.
- **Fix & Disclosure**: If validated, we will develop a patch, deploy it to supported branches, and coordinate a mutual disclosure date with credit given to the reporter.

---

## Security Practices in Sketchboard

- **Strict Payload Sizing**: The Socket.io server enforces a 256 KB hard limit on incoming binary CRDT updates to prevent memory exhaustion attacks.
- **Rate Limiting**: Sockets are bounded to a maximum of 60 mutations/sec per connection.
- **Volatile Cursors**: Ephemeral presence events bypass persistent databases and hot-update logs entirely.
- **Minimal Surface**: Lightweight Node.js runtime running with non-root security contexts in all containerized deployments.
