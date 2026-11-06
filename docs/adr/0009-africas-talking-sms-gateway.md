# ADR 0009: Africa's Talking SMS Gateway & Collaborator Notification Subsystem

## Status
Accepted

## Context
Real-time collaborative workspaces require frictionless collaborator onboarding. In the East African ecosystem, email notifications frequently suffer from low engagement, spam filtering, or delayed reading by product stakeholders working in the field. Conversely, SMS notifications delivered directly to a smartphone guarantee immediate engagement.

Furthermore, upon subscribing to paid workspace tiers via M-Pesa (ADR 0008), customers expect an instantaneous SMS receipt containing the transaction code, board name, and validity timestamp.

Africa's Talking is the established telco infrastructure gateway in Sub-Saharan Africa, providing robust SMS APIs across Safaricom, Airtel, and Telkom networks.

However, invoking third-party SMS APIs during local development and testing introduces challenges:
1. **Financial Cost**: Each outbound SMS incurs telco charges (KES ~0.80 per 160-character message segment).
2. **Rate Limits & Throttling**: Telco gateways enforce strict sender ID velocity checks.
3. **API Key Dependency**: Automated CI/CD runs must operate offline without requiring paid API keys or exposing telco secrets.

## Decision
We implemented a dual-mode SMS notification subsystem powered by an `AfricaTalkingClient` abstraction with an in-memory synthetic outbox:

```
                          ┌────────────────────────────┐
                          │    Express API Router      │
                          │ /api/notifications/sms/*   │
                          └─────────────┬──────────────┘
                                        │
                                        ▼
                          ┌────────────────────────────┐
                          │ AfricaTalkingClient (IFace)│
                          └─────────────┬──────────────┘
                                        │
               ┌────────────────────────┴────────────────────────┐
               ▼                                                 ▼
   ┌───────────────────────┐                         ┌───────────────────────┐
   │ MockAfricaTalking     │                         │ AfricaTalkingHttp     │
   │ (Zero-Credential Dev) │                         │ (Production Gateway)  │
   │ - In-Memory Outbox    │                         │ - E.164 Dispatches    │
   │ - Queryable Messages  │                         │ - Custom Sender ID    │
   │ - Synthetic MessageId │                         │ - KES Cost Accounting │
   └───────────────────────┘                         └───────────────────────┘
```

### Key Architectural Tenets:

1. **Normalized MSISDN Routing**:
   - Africa's Talking requires recipients formatted in international standard E.164 (`+2547XXXXXXXX` or `+2541XXXXXXXX`).
   - We utilize `formatE164Phone()` from `@sketchboard/shared` to sanitize user inputs before dispatch.

2. **Synthetic Inspectable Outbox**:
   - When running in default mock mode (`AFRICASTALKING_MOCK=true`), messages are saved to an in-memory circular buffer (`outbox`).
   - The `/api/notifications/sms/outbox` endpoint exposes dispatched messages for inspection by automated test suites or development debugging.
   - Each synthetic message returns standard Africa's Talking response structures (`statusCode: 101`, `cost: "KES 0.8000"`, `status: "Success"`).

3. **Collaborator Invite Link Generation**:
   - The `/api/notifications/sms/invite` endpoint takes `{ boardId, phone, inviterName }` and dispatches a localized Swahili/English message containing the direct join URL.
   - Example message: `"Habari! Chris has invited you to collaborate on Sketchboard board 'nairobi-hq': http://localhost:5173?board=nairobi-hq"`.

4. **Security & Spam Protection**:
   - Outbound SMS requests are rate-limited per IP and board to prevent SMS toll fraud.
   - Phone numbers are validated against strict Kenyan prefix allocations (`+254 7XX` Safaricom/Airtel and `+254 1XX` Airtel/Safaricom new ranges). Non-Kenyan or malformed numbers are rejected with `400 Bad Request`.

## Consequences

### Positive:
- **Zero SMS Costs in Development & CI**: Developers and test suites can send unlimited invitations and transaction receipts without spending KES credits.
- **Inspectable State**: Vitest and Playwright tests can assert that SMS messages were formatted and triggered accurately via the `/outbox` inspection route.
- **Immediate Production Transition**: Supplying `AFRICASTALKING_API_KEY`, `AFRICASTALKING_USERNAME`, and `AFRICASTALKING_SENDER_ID` seamlessly activates live SMS delivery over Pan-African telco networks.

### Trade-offs & Mitigations:
- *Risk*: Memory growth in long-running development servers if outbox is never purged.
  *Mitigation*: The mock client caps in-memory outbox history to the most recent 100 messages, discarding oldest entries automatically.

