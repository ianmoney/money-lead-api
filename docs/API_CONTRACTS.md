# API contracts

All public responses use JSON, a stable `code`, a user-safe `message` and an internal request ID that contains no PII. Payloads larger than the documented limit are rejected before parsing. Production accepts only allowlisted Money origins.

## Confirmed upstream Money contract

The supplied Money Admin screenshot confirms:

- `POST https://api.money.com.au/v1/funnels/health-insurance`
- request fields including `coverage_type`, `cover_type.hospital`, `cover_type.extras`, `reasons_for_cover`, `dob`, `partner_dob`, `dependents`, `state`, `taxable_income`, `hospital_service_classification`, `current_provider_account_id`, `hospital_services`, `extra_services`, `contact_first_name`, `contact_last_name`, `contact_email`, `contact_phone`, `mobile_code`, `bo_continuous_cover` and `referrer`
- allowed state abbreviations: `ACT`, `NSW`, `NT`, `QLD`, `SA`, `TAS`, `VIC`, `WA`
- response contains `scenario_id` and `matchmaker_results`

The screenshot shows an example `coverage_type` value but does not establish the complete enum. Production mappings remain configuration-backed and fail closed.

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
