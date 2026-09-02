# Money health-insurance quote architecture

Status: frontend staging foundation. This repository does not make the system production-live.

## Boundaries

- `money-lead-api` is the repository root for the public Next.js iframe experience. It contains the reusable `HealthQuoteForm`, the dedicated quote route, an iframe demonstration route, anonymous analytics adapters and a typed API client.
- The security-critical server endpoints are not implemented yet. They will own SMS verification, Turnstile verification, temporary durable state, idempotency, the Money OAuth client and lead transformation. No legacy Typeform code is changed here.
- The existing signed `POST /api/health-insurance` Typeform webhook remains untouched until explicit cutover approval.
- Browser code never calls Money or Twilio directly. It calls only the versioned first-party endpoints described in `docs/API_CONTRACTS.md`.

## Frontend structure

- `src/features/health-quote/` - schema, state machine, reusable UI, validation, API client and anonymous tracking.
- `src/components/` - Money presentation primitives shared by page shells.
- `src/app/health-insurance/quote/` - dedicated full-page journey.
- `src/app/inline-example/` - inline campaign placement using the same component and state machine.
- `src/app/` - route shells, metadata and global design tokens only.

The form state is in memory. Names, email, phone and birth year are never placed in URLs, analytics or browser storage. Refreshing safely restarts the journey.

## Runtime flow

1. The browser captures allowlisted attribution at entry and emits anonymous `quote_view`.
2. One shared schema-driven state machine collects answers. Choice and year cards advance immediately; a small Back control preserves prior answers.
3. The browser asks the first-party API to start verification after local mobile validation and Turnstile completion.
4. The backend binds an opaque verification session to the normalized phone and funnel and asks Twilio Verify to send the SMS.
5. A successful OTP check returns a short-lived one-time proof. A client boolean is not proof.
6. The browser submits the lead with a client-generated UUID and the one-time proof.
7. The backend atomically consumes the proof, validates the phone binding, applies idempotency, transforms through the existing Money adapter and calls Money.
8. Only a confirmed Money acceptance emits primary conversion events. Only then does the widget request that its parent page navigate to the fixed Money.com.au thank-you URL.

## Environments

| Environment | API mode | Real SMS/Money calls | Notes |
| --- | --- | --- | --- |
| Local | deterministic mock by explicit non-production flag | Never | Visible mock banner |
| CI | deterministic mock | Never | Fixed clocks and IDs |
| Vercel Preview | mock or protected staging | Never by default | Access-controlled and separately allowlisted |
| Staging | real staging providers after human approval | Allowed for UAT only | No production customer data |
| Production | real providers | Allowed | Fails closed if any required configuration is missing |

## Migration and rollback

The new routes are additive. Typeform remains live during staging UAT. Cutover changes campaign traffic only after real-device OTP and Money Admin verification. Rollback restores campaign links to Typeform; it does not require a backend code rollback. Idempotency records must survive frontend rollback long enough to cover browser retries.

## Current blockers

See `docs/OPEN_DECISIONS.md`. The security-critical backend is still unimplemented. Production provider mappings, consent version and durable-store choice remain unconfirmed and must fail closed.
