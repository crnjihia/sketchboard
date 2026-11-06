# ADR 0008: Safaricom Daraja 2.0 M-Pesa STK Push Integration & Zero-Credential Mock Adapter

## Status
Accepted

## Context
Sketchboard is tailored for Kenyan and East African product squads collaborating in high-velocity tech hubs (Nairobi, Mombasa, Kisumu). In Kenya, mobile money via Safaricom M-Pesa is the undisputed payment rail for SaaS subscriptions, digital services, and peer-to-peer commerce. Credit card penetration remains low (< 5%), whereas M-Pesa active accounts exceed 30+ million.

To offer workspace plan upgrades (Free, Pro Squad at KES 150/mo, Enterprise at KES 500/mo), Sketchboard requires integration with the **Safaricom Daraja 2.0 Lipa Na M-Pesa Online (STK Push / Customer-to-Business)** API.

However, standard Daraja integrations introduce severe hurdles during software development and automated testing:
1. **Public Webhook Routing**: Safaricom requires a publicly routable HTTPS callback URL to deliver asynchronous transaction results. Local `localhost` environments typically necessitate reverse tunnels (e.g. ngrok), introducing external dependencies, latency, and instability.
2. **Credential & Sandbox Fragility**: Daraja test credentials, passkeys, and sandbox endpoints frequently experience outages, rate-limits, or expired SSL certificates.
3. **CI/CD Determinism**: CI pipelines (GitHub Actions, Docker builds) operate in isolated zero-credential networks where external network calls to Safaricom are either impossible or non-deterministic.
4. **Security Boundaries**: Real financial credentials must never be committed to source control or exposed to the browser client.

## Decision
We architected a pluggable, interface-driven payment gateway architecture utilizing a **Zero-Credential In-Memory Mock Adapter** by default, paired with a production-grade **Daraja HTTP Client**:

```
                       ┌─────────────────────────┐
                       │   Express API Router    │
                       │  /api/payments/mpesa/*  │
                       └────────────┬────────────┘
                                    │
                                    ▼
                       ┌─────────────────────────┐
                       │   MpesaClient (IFace)   │
                       └────────────┬────────────┘
                                    │
            ┌───────────────────────┴───────────────────────┐
            ▼                                               ▼
┌─────────────────────────┐                     ┌─────────────────────────┐
│     MockMpesaClient     │                     │    DarajaMpesaClient    │
│  (Zero-Credential Dev)  │                     │  (Sandbox / Production) │
│ - In-Memory State Mach. │                     │ - OAuth Bearer Token    │
│ - Deterministic Receipts│                     │ - Base64 Password Hash  │
│ - Handset Simulation    │                     │ - CBK Limit Guards      │
└─────────────────────────┘                     └─────────────────────────┘
```

### Key Architectural Tenets:

1. **Strict Interface Decoupling (`MpesaClient`)**:
   - `initiateStkPush(params)`: Validates payload and triggers STK push.
   - `queryStkPushStatus(checkoutRequestId)`: Queries transaction status.
   - `simulateCallback(checkoutRequestId, options)`: Development-only method allowing test suites and manual reviewers to trigger synthetic handset responses (PIN entered or cancelled).

2. **CBK Transaction Guardrails**:
   - Central Bank of Kenya (CBK) mobile money regulations cap single STK push transactions to KES 250,000.00 and require a minimum of KES 1.00.
   - Both client and server schemas strictly enforce `amount >= 1 && amount <= 250000` via shared Zod validation.

3. **Kenyan MSISDN Normalization**:
   - Safaricom Daraja requires MSISDN in 12-digit international format (`2547XXXXXXXX` or `2541XXXXXXXX`).
   - We implemented uniform normalizers in `@sketchboard/shared`:
     - Accepts: `0712345678`, `+254712345678`, `254712345678`, `0112345678`.
     - Normalizes to: `254712345678` (Daraja) or `+254712345678` (E.164 for Africa's Talking).

4. **Idempotent Payment Ledger (`IPaymentLedger`)**:
   - Webhook callbacks arrive asynchronously and can be retried by Safaricom up to 3 times.
   - `PostgresPaymentLedger` records each checkout request with states (`PENDING`, `COMPLETED`, `FAILED`, `CANCELLED`).
   - Automatic fallback to an in-memory ledger when `ENABLE_POSTGRES=false` ensures full zero-dependency execution.
   - Upon successful receipt validation, the associated board is upgraded atomically with transactional audit history.

5. **Client-Side Dev Simulator**:
   - When running in mock mode (`MPESA_MOCK=true`), the modal exposes inline developer triggers (`[Simulate PIN Success]` and `[Simulate User Cancel]`).
   - This allows Playwright E2E tests and demo reviewers to complete end-to-end checkout cycles in under 2 seconds without external mocks or network proxies.

## Consequences

### Positive:
- **Zero Real Credentials Required**: Anyone cloning the repository can run `pnpm test`, `pnpm test:e2e`, or `pnpm dev` and experience the full M-Pesa flow instantly.
- **Flawless Automated Testing**: 100% deterministic test execution in CI without network flakiness.
- **Production Readiness**: Seamlessly switches to real Safaricom Daraja 2.0 endpoints in staging/production by setting `MPESA_MOCK=false` and populating credentials.
- **Regulatory Compliance**: Adheres to CBK single-transaction limits and Safaricom's official API specifications.

### Trade-offs & Mitigations:
- *Risk*: Mock responses might drift from real Daraja callback schemas over time.
  *Mitigation*: The mock adapter strictly adheres to Safaricom's official `Body.stkCallback` JSON schema, validated against Zod contracts in `@sketchboard/shared`.

