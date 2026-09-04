# Threat model

## Assets

PII, OTP state, verification proofs, Money/Twilio/Turnstile credentials, OAuth tokens, provider mappings, submission idempotency and conversion integrity.

## Threats and required controls

| Threat | Controls | Evidence required before production |
| --- | --- | --- |
| SMS pumping/bots | server-side Turnstile, IP and phone-hash windows, session send cap, Twilio service limits, generic 429 | deterministic and staging rate-limit tests |
| OTP guessing | Twilio Verify, six-digit format, attempt cap, short expiry, generic errors | wrong/expired/limited tests |
| Replay/token theft | 256-bit opaque proof, hash at rest, short TTL, atomic one-time consumption, exact phone/funnel/session binding | concurrent replay and mismatch tests |
| Duplicate leads | UUID submission ID, atomic idempotency record, in-progress state, stable replay result | concurrent submission test with one upstream call |
| Origin/CORS abuse | exact production origin allowlist, Preview policy isolated from production, no wildcard credentials | origin matrix tests |
| Open redirect | redirect chosen from server configuration only; never request/query input | allowlist tests |
| Injection/oversized payloads | content-type check, byte limits, strict schemas, enum allowlists, max string lengths | fuzz and payload-limit tests |
| Secret leakage | server-only environment variables, no `NEXT_PUBLIC_` secrets, secret scanning, redacted structured logs | bundle and log scan |
| PII leakage | no PII in URLs/storage/analytics/logs/screenshots/fixtures; test-only `.invalid` identities | analytics/log evidence |
| Provider outage | strict timeouts, generic safe errors, same-ID retry semantics, no false success | Twilio/store/Money timeout tests |

## PII retention

The browser retains answers in React memory only. The temporary store retains phone hashes, session metadata, attempt/rate counters, proof hashes and idempotency status only for documented TTLs. It does not retain the full lead. The Money API remains the system of record after acceptance. Failed submissions are not currently retained or downloadable. Adding recovery requires a separately approved encrypted failure queue with strict access, retention, deletion and audit controls; full lead payloads must not be added to the verification/idempotency store by accident. Durable-store vendor, region, encryption and deletion policy are an open approval item.

## Security headers

Production sets HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, restrictive `Permissions-Policy`, frame restrictions compatible with the approved inline integration method and a CSP limited to self plus specifically approved Turnstile/analytics origins. The final CSP is tested against both contexts before enablement.
