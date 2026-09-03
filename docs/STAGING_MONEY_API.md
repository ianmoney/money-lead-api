# Money staging API integration

Status: OAuth client and typed health-insurance scenario client implemented on the staging integration branch. Public lead submission remains fail-closed until the unresolved upstream mappings and verification backend are completed.

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

## Code added

`src/server/money/client.ts`

- loads `ClientID` and `ClientSecret` only on the server
- defaults `MONEY_API_BASE_URL` to the staging base URL
- requests an OAuth access token using the confirmed JSON client-credentials payload
- caches the token in-process only when an `expires_in` value is returned
- adds an `Authorization: <token_type> <access_token>` header to the scenario request
- exposes a typed `createMoneyHealthInsuranceScenario()` function
- uses a 12 second timeout and stable integration errors
- never logs or returns the client secret or access token

`src/server/money/health-insurance-adapter.ts`

- validates the existing form enums before transformation
- converts the selected birth year to 1 January in ISO format
- maps Hospital Only, Hospital & Extras and Extras Only to the two Money booleans
- maps contact and allowlisted attribution fields
- requires confirmed coverage, provider and phone-format configuration and fails closed when it is absent
- accepts partner DOB and dependant values only as explicit supplemental data; it does not invent them

`src/app/api/internal/money-auth-check/route.ts`

- provides a narrow staging diagnostic that tests OAuth only
- returns no token value
- if `INTERNAL_HEALTHCHECK_KEY` is set, callers must send the same value in `x-internal-healthcheck-key`
- in production mode, the route fails closed if `INTERNAL_HEALTHCHECK_KEY` is not configured

## Vercel variables

Already supplied by the project owner:

```text
ClientID=<saved in Vercel>
ClientSecret=<saved in Vercel>
```

Recommended additional staging variables:

```text
MONEY_API_BASE_URL=https://api-staging.money.com.au
INTERNAL_HEALTHCHECK_KEY=<random staging-only secret>
```

Do not prefix any of these with `NEXT_PUBLIC_`.

## Staging auth smoke test

After deploying the branch to a protected Vercel Preview/Staging deployment, call:

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

## What is intentionally not wired to the public form yet

The confirmed DOB and hospital/extras transformations are now implemented in a server-only adapter. The form still collects a smaller user-friendly set of fields than the Money scenario API, and the remaining production mappings have not been supplied. In particular, do not guess:

- complete `coverage_type` values and the mapping from `Individual`, `Couple`, `Family`; the supplied example `JUST_YOU_FEMALE` indicates gender may be required, but the form does not collect it
- `current_provider_account_id` values and the mapping from provider labels
- whether `partner_dob` or `dependents` must be supplied for Couple or Family, given that the form currently collects one birth year only
- whether `reasons_for_cover`, hospital-service classification, taxable income, hospital services, extras services and other optional-looking fields are actually required for the staging business flow
- exact upstream phone representation
- any upstream idempotency header

The supplied Admin screenshot confirms the field names and response shape, but not enough business rules to safely transform the existing form end-to-end.

The public flow also still needs the first-party OTP/verification proof, durable expiring state, idempotency, Turnstile verification and associated tests described in `ARCHITECTURE.md` and `docs/API_CONTRACTS.md`.

## Next implementation step

Once the Money API owner confirms the missing mappings, configure the fail-closed server adapter and then call `createMoneyHealthInsuranceScenario()` only after successful phone verification and idempotency checks. Verify the resulting `scenario_id` appears in the Money Admin staging environment before enabling any paid traffic.
