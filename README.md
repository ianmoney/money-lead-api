# Money health-insurance quote

A reusable, mobile-first Money.com.au health-insurance quote flow built with Next.js.

The server reserves and updates an idempotent Google Sheet backup row around each Money API request, including the full upstream response for operational recovery.

## Routes

- `/health-insurance/quote` — stripped-down iframe widget
- `/inline-example` — campaign-page iframe demonstration

## Local development

```bash
npm install
npm run dev
```

Development uses a deterministic local mock. It never calls Money or another external API.

- Submission failure: use `fail@example.invalid`

## Interaction decisions

Choice cards advance to the next question on click. Birth year uses a clickable decade followed by a clickable year, and the first-party API adapter sends 1 January of that year as ISO `YYYY-01-01`. There is no Continue button; a small Back control preserves answers.

## Production configuration

Copy `.env.example` to the deployment environment and supply only approved values. The required server-only values are `ClientID`, `ClientSecret`, `MONEY_API_BASE_URL`, `GOOGLE_SHEETS_WEBHOOK_URL`, and `GOOGLE_SHEETS_WEBHOOK_SECRET`. The Apps Script source is in `integrations/google-apps-script/Code.gs`; its `WEBHOOK_SECRET` Script Property must match Vercel. The privacy/terms links and Money.com.au thank-you URL are fixed in source.

## Verification

```bash
npm run lint
npm run build
```

This frontend is staging-ready, not production-live. The remaining backend, legal, mapping and UAT gates are recorded in `docs/OPEN_DECISIONS.md` and `docs/STATUS.json`.

See `docs/EMBEDDING_AND_VERCEL.md` for the copy-paste iframe, Git commands and Vercel setup.
