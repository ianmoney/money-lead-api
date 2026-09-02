# Money health-insurance quote

A reusable, mobile-first Money.com.au health-insurance quote flow built with Next.js.

## Routes

- `/health-insurance/quote` — stripped-down iframe widget
- `/inline-example` — campaign-page iframe demonstration

## Local development

```bash
npm install
npm run dev
```

Development uses a deterministic local mock. It never calls Twilio, Money or another external API.

- Success code: `246810`
- Expired-code state: `000000`
- Rate-limited state: `999999`
- Submission failure: use `fail@example.invalid`

## Interaction decisions

Choice cards advance to the next question on click. Birth year uses a clickable decade followed by a clickable year, and the first-party API adapter sends 1 January of that year as ISO `YYYY-01-01`. There is no Continue button; a small Back control preserves answers.

## Production configuration

Copy `.env.example` to the deployment environment and supply only approved values. Production fails closed if the API origin, Turnstile or consent version is missing. The privacy/terms links and Money.com.au thank-you URL are fixed in source. The browser talks only to the first-party API contract in `docs/API_CONTRACTS.md`; OAuth and Twilio secrets belong in server-only configuration and must never be exposed as `NEXT_PUBLIC_*` values.

## Verification

```bash
npm run lint
npm run build
```

This frontend is staging-ready, not production-live. The remaining backend, legal, mapping and UAT gates are recorded in `docs/OPEN_DECISIONS.md` and `docs/STATUS.json`.

See `docs/EMBEDDING_AND_VERCEL.md` for the copy-paste iframe, Git commands and Vercel setup.
