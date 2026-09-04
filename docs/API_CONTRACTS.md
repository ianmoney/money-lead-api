# API contracts

All public responses use JSON, a stable `code`, a user-safe `message` and an internal request ID that contains no PII. Payloads larger than the documented limit are rejected before parsing. Production accepts only allowlisted Money origins.

## Confirmed upstream Money contract

The supplied Money Admin material and later staging/contact payload confirm:

- staging base URL: `https://api-staging.money.com.au`
- scenario endpoint: `POST /v1/funnels/health-insurance`
- request fields including `coverage_type`, `cover_type.hospital`, `cover_type.extras`, `reasons_for_cover`, `dob`, `partner_dob`, `dependents`, `state`, `taxable_income`, `rebate_label`, `hospital_service_classification`, `current_provider_account_id`, `hospital_services`, `extra_services`, `contact_first_name`, `contact_last_name`, `contact_email`, `contact_phone`, `mobile_code`, `bo_continuous_cover` and `referrer`
- allowed state abbreviations: `ACT`, `NSW`, `NT`, `QLD`, `SA`, `TAS`, `VIC`, `WA`
- individual `coverage_type` examples include `JUST_YOU_MALE` and `JUST_YOU_FEMALE`
- local Australian mobile representation such as `04...` is accepted in the supplied payload
- empty service selections, reasons and dependants may be arrays
- `taxable_income` has been observed as both number-like documentation and a string payload, so the staging client accepts number or string pending canonical-contract confirmation
- response contains `scenario_id` and `matchmaker_results`

The protected staging probe on 4 September 2026 observed a second successful response shape containing `funnel_request_id`, `email`, `first_name` and `surname`. The server accepts `funnel_request_id` as an alternative opaque acceptance ID and discards the returned contact fields. Public and internal responses expose only `acceptance_id` and `acceptance_id_field`.

The complete `coverage_type` enum, Couple/Family requirements, provider UUID mapping, canonical `reasons_for_cover` type and continuous-cover rule are not yet established. Production mappings remain configuration-backed and fail closed. A successful response containing `scenario_id` is treated as the final accepted-lead event per the product-owner decision on 4 September 2026.

Unanswered optional fields use the documented empty shape: `null` for nullable scalar fields and `[]` for list fields. Known form answers are mapped only to confirmed Money fields. The known contract does not include a `description` field, so answers without a confirmed field name and type are not packed into an undocumented fallback field.

## Jack Media-style flat payload evidence

The supplied Jack Media screenshot and public quiz code establish a separate flat lead shape. `src/server/money/flat-health-lead-adapter.ts` builds that shape without treating it as the confirmed Money scenario request. Directly compatible answers map to `First_Name`, `Last_Name`, `Email`, `Mobile`, `State`, `Date_of_Birth` and `External_Id_Reference`. Current fund, requested cover type and who needs cover are preserved in `Description`. Unanswered scalar fields are empty strings and unanswered service/rebate fields are `null`, matching the supplied example.

The public Jack Media quiz first posts its own camel-case questionnaire payload to a Jack Media lead-distribution endpoint. The capitalised/underscored record in the screenshot is therefore treated as downstream mapping evidence, not proof that `POST /v1/funnels/health-insurance` accepts those keys. The flat payload must remain disconnected until the receiving endpoint and its exact case-sensitive contract are confirmed.

A protected synthetic staging test on 4 September 2026 confirmed that sending the flat payload directly to `POST /v1/funnels/health-insurance` returns HTTP `412 Precondition Failed`. The existing lower-case scenario contract remains the only confirmed request shape for that endpoint.

## Internal staging diagnostics

### OAuth health check

`GET /api/internal/money-auth-check`

The route never returns the access token. On protected deployments it uses `x-internal-healthcheck-key` and fails closed when the key is required but absent.

### Scenario validation probe

`POST /api/internal/money-scenario-probe`

This route is for staging contract discovery only:

- available only when `VERCEL_ENV=preview`
- requires `MONEY_API_BASE_URL=https://api-staging.money.com.au`
- always requires `x-internal-healthcheck-key`
- submits hard-coded synthetic data only
- uses `staging-probe@example.invalid` and ACMA-reserved fictional mobile `0491570156`
- sends no provider account ID
- returns only `acceptance_id` and `acceptance_id_field` on success
- on upstream `422`, returns only capped/redacted validation field/message evidence
- on a successful upstream response with an unknown schema, returns a bounded structural summary containing field names, value types and array lengths but never field values

It is not a public lead endpoint and must never accept arbitrary customer payloads.

## Start verification

`POST /api/v1/phone-verification/start`

Request, maximum 8 KB:

```json
{"phone":"+61412345678","funnel":"health-insurance","turnstile_token":"opaque-client-token"}
```

Accepted, `202`:

```json
{"verification_id":"opaque-random-id","expires_in":300,"resend_after":30}
```

The backend accepts Australian mobiles only, verifies Turnstile before Twilio, applies rate limits by IP, phone hash and session, and returns no provider identifiers or enumeration signals.

## Check verification

`POST /api/v1/phone-verification/check`

Request, maximum 4 KB:

```json
{"verification_id":"opaque-random-id","code":"123456"}
```

Success, `200`:

```json
{"verified":true,"verification_token":"opaque-one-time-token","expires_in":600}
```

The proof is bound to the normalized phone, funnel and verification session. Only its hash is stored. Codes, phones, tokens and provider bodies are never logged.

## Submit verified lead

`POST /api/v1/health-insurance/leads`

Request, maximum 32 KB:

```json
{
  "submission_id":"client-generated-uuid",
  "verification_token":"opaque-one-time-token",
  "lead":{
    "cover_for":"Individual",
    "cover_type":"Hospital & Extras",
    "state":"VIC",
    "dob":"1980-01-01",
    "first_name":"Test",
    "last_name":"Person",
    "email":"test@example.invalid",
    "phone":"+61412345678",
    "current_health_fund":"Bupa"
  },
  "consent":{"accepted":true,"version":"CONFIG_REQUIRED"},
  "attribution":{"utm_source":null,"utm_medium":null,"utm_campaign":null,"utm_content":null,"utm_term":null,"fbclid":null,"gclid":null,"landing_url":"https://compare.money.com.au/health-insurance/quote","referrer":null,"funnel_version":"health-v1"}
}
```

Success, `200` or idempotent replay `200`:

```json
{"success":true,"submission_id":"client-generated-uuid","redirect_url":"server-allowlisted-url"}
```

The backend strictly validates all enums and lengths, atomically consumes the proof, checks exact normalized-phone and funnel binding, and makes `submission_id` concurrency-safe. It returns no OAuth token, Twilio data, upstream body or scenario details.

The public UI collects only `birth_year`. Per the product-owner decision on 2 September 2026, the first-party adapter constructs `dob` as `YYYY-01-01` (1 January of the selected year). No month or day is requested from the user.

## Stable errors

| HTTP | Code | Meaning |
| --- | --- | --- |
| 400 | `INVALID_REQUEST` | Input failed strict validation |
| 401 | `VERIFICATION_REQUIRED` | Proof missing, expired, reused or mismatched |
| 403 | `ORIGIN_NOT_ALLOWED` | Origin/preview policy failed |
| 409 | `SUBMISSION_IN_PROGRESS` | Same ID is already being processed |
| 422 | `LEAD_REJECTED` | Money rejected a valid request |
| 429 | `TRY_LATER` | Generic rate/attempt limit response |
| 502 | `UPSTREAM_UNAVAILABLE` | Provider failed safely |
| 504 | `UPSTREAM_TIMEOUT` | Provider timed out; same ID may be retried |

Error messages do not disclose account existence, provider internals, verification state or PII.
