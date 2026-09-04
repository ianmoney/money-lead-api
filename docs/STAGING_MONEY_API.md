# Money staging API integration

Status: OAuth client, typed health-insurance scenario client, fail-closed adapter and protected preview-only scenario probe are implemented on the staging integration branch. Public lead submission remains fail-closed until the unresolved upstream mappings and verification backend are completed.

## Confirmed staging configuration

- Base URL: `https://api-staging.money.com.au`
- Authentication: `POST /oauth/token`
- JSON body:

```json
{
  "grant_type": "client_credentials",
  "client_id": "<ClientID>",
  "client_secret": "<ClientSecret>",
  "scope": ""
}
```

Vercel stores the credentials as server-only environment variables named `ClientID` and `ClientSecret`.

The Money Admin API screenshot confirms the health-insurance scenario endpoint as:

```text
POST /v1/funnels/health-insurance
```

## Additional staging/contact payload evidence

A later supplied payload establishes or strongly suggests the following request behaviour:

- individual coverage values can be gender-specific; examples now include `JUST_YOU_MALE` and `JUST_YOU_FEMALE`
- Money accepts local Australian mobile representation such as `04...`
- `hospital_services`, `extra_services`, `reasons_for_cover` and `dependents` may be sent as empty arrays
- `taxable_income` may be sent as a string even though earlier Admin material showed a numeric representation
- `rebate_label` is accepted by the supplied flow despite being absent from the earlier Admin screenshot
- `referrer` may carry Google/Meta click IDs, UTMs, GA client ID and an HTTP referrer

The supplied provider UUID is not mapped to a health fund because the evidence does not explicitly establish that relationship.

## Code added

`src/server/money/client.ts`

- loads `ClientID` and `ClientSecret` only on the server
- defaults `MONEY_API_BASE_URL` to the staging base URL
- requests an OAuth access token using the confirmed JSON client-credentials payload
- caches the token in-process only when an `expires_in` value is returned
- adds an `Authorization: <token_type> <access_token>` header to the scenario request
- exposes a typed `createMoneyHealthInsuranceScenario()` function
- accepts only observed type inconsistencies such as numeric-or-string `taxable_income` and string-or-array `reasons_for_cover`
- extracts a small, redacted field/message list from `422` responses for the internal staging probe
- uses a 12 second timeout and stable integration errors
- never logs or returns the client secret or access token

`src/server/money/health-insurance-adapter.ts`

- validates the existing form enums before transformation
- converts the selected birth year to 1 January in ISO format
- maps Hospital Only, Hospital & Extras and Extras Only to the two Money booleans
- maps contact and allowlisted attribution fields
- supports explicit supplemental staging fields such as income, rebate label, reasons, service arrays and continuous-cover value without inventing them
- defaults confirmed empty-list fields to arrays rather than `null`
- requires confirmed coverage, provider and phone-format configuration and fails closed when it is absent
- accepts partner DOB and dependant values only as explicit supplemental data; it does not invent them

`src/app/api/internal/money-auth-check/route.ts`

- provides a narrow staging diagnostic that tests OAuth only
- returns no token value
- if `INTERNAL_HEALTHCHECK_KEY` is set, callers must send the same value in `x-internal-healthcheck-key`
- in production mode, the route fails closed if `INTERNAL_HEALTHCHECK_KEY` is not configured

`src/app/api/internal/money-scenario-probe/route.ts`

- accepts `POST` only
- exists only on Vercel Preview deployments (`VERCEL_ENV=preview`); elsewhere it returns `404`
- refuses to run unless `MONEY_API_BASE_URL` resolves exactly to `https://api-staging.money.com.au`
- always requires `INTERNAL_HEALTHCHECK_KEY`
- submits one hard-coded synthetic `JUST_YOU_MALE` QLD Hospital Only scenario
- uses `staging-probe@example.invalid` and ACMA-reserved fictional mobile `0491 570 156`
- sends empty arrays where the supplied payload showed arrays
- sends no provider account ID
- returns only `scenario_id` on success
- returns a capped, redacted validation issue list for `422` responses and never returns the upstream request body or OAuth token

## Vercel variables

Already supplied by the project owner in Production scope:

```text
ClientID=<saved in Vercel>
ClientSecret=<saved in Vercel>
```

Required for the protected PR Preview before testing:

```text
ClientID=<same credential, protected Preview scope>
ClientSecret=<same credential, protected Preview scope>
MONEY_API_BASE_URL=https://api-staging.money.com.au
INTERNAL_HEALTHCHECK_KEY=<random Preview-only secret>
```

Do not prefix any of these with `NEXT_PUBLIC_`.

The Preview-scoped changes above require explicit project-owner approval before they are made.

## Staging auth smoke test

After the variables are approved and a fresh Preview deployment is created, call:

```text
GET /api/internal/money-auth-check
x-internal-healthcheck-key: <INTERNAL_HEALTHCHECK_KEY>
```

Expected success response:

```json
{
  "ok": true,
  "upstream": "money-staging",
  "token_type": "Bearer"
}
```

The returned `token_type` may differ if the OAuth service specifies another scheme. The access token itself is never returned.

## Staging scenario validation probe

Only after OAuth succeeds, call:

```text
POST /api/internal/money-scenario-probe
x-internal-healthcheck-key: <INTERNAL_HEALTHCHECK_KEY>
```

The probe intentionally uses a synthetic payload and no provider UUID. A `422` is useful evidence: record only the redacted field/message output and use it to refine the typed contract. A success response returns the generated `scenario_id`; verify that ID in Money Admin staging before treating the scenario creation path as confirmed. If Money returns HTTP 200 with an unknown schema, the probe returns a bounded `response_shape` summary with field names, value types and array lengths only; it never returns response values.

## What is intentionally not wired to the public form yet

Do not guess:

- the complete `coverage_type` enum or Couple/Family values
- whether the public form must add a gender question
- whether Couple/Family require `partner_dob` or dependant DOB data
- provider account IDs or the supplied UUID's provider identity
- whether `taxable_income` and `rebate_label` are required in all flows
- the canonical type and allowed values for `reasons_for_cover`
- whether `bo_continuous_cover` should be inferred from having a current fund
- any upstream idempotency header
- whether successful scenario creation is the final lead-acceptance event

The public flow also still needs the first-party OTP/verification proof, durable expiring state, idempotency, Turnstile verification and associated tests described in `ARCHITECTURE.md` and `docs/API_CONTRACTS.md`.

## Next implementation step

1. Obtain explicit approval for the protected Preview-scoped Vercel variables.
2. Redeploy the branch Preview.
3. Run the OAuth smoke test.
4. Run the protected synthetic scenario probe.
5. Use redacted staging validation evidence to resolve request mappings.
6. Verify any successful `scenario_id` in Money Admin staging.
7. Keep the public form disconnected until verification, durable state, idempotency and strict fail-closed validation are implemented and reviewed.
