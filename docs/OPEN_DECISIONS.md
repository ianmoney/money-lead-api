# Open decisions

Unresolved items fail closed; they are not inferred from examples.

| ID | Decision/blocker | Current evidence | Required owner/action |
| --- | --- | --- | --- |
| OD-01 | Complete production `coverage_type` enum | Staging/contact examples now include `JUST_YOU_MALE` and `JUST_YOU_FEMALE`; full enum still unknown | Money API owner or staging validation supplies Couple/Family values and confirms whether gender is mandatory |
| OD-02 | Provider account IDs and whether required | A provider UUID was supplied in one payload, but its fund identity was not explicitly established | Money API owner supplies approved provider-to-UUID mapping and confirms the supplied UUID's provider |
| OD-03 | Partner/dependant DOB mapping | Form collects one birth year only; current evidence does not establish Couple/Family DOB requirements | Confirm whether Couple/Family require `partner_dob`, dependant DOB objects, or only an empty/list value |
| OD-04 | Upstream phone representation | Supplied Money payload accepts local Australian mobile format such as `04...`; public verification contract uses E.164 internally | Keep Money adapter configurable; validate local format in staging before production mapping is fixed |
| OD-05 | Upstream idempotency header | Not supplied | Money API owner confirms; internal idempotency still required |
| OD-06 | Required scenario/request fields | Supplied payload adds `rebate_label`, string `taxable_income`, empty service arrays and array-shaped reasons/dependants, but business requirements remain incomplete | Staging validation with API owner |
| OD-07 | Gender question in the public form | Individual coverage examples are gender-specific | Product/API owner decides whether form must add gender or another supported mapping exists |
| OD-08 | `reasons_for_cover` canonical type | Admin material and supplied payload are inconsistent; payload uses an array | Resolve through staging validation/API owner |
| OD-09 | Continuous-cover inference | Supplied payload uses `bo_continuous_cover: true`, but no rule tying it to current fund has been confirmed | Do not infer from current fund until confirmed |
| OD-10 | Durable expiring store/vendor/region | Requirement supplied, provider not selected | Security/platform approval |
| OD-11 | Security-critical verification/idempotency backend and tests | Money staging OAuth client is implemented; OTP proof, durable state and public lead endpoint are not | Implement and independently review before staging UAT |
| OD-12 | Turnstile/Twilio/staging credentials | Not supplied | Human-approved staging UAT gate |

Confirmed by supplied material: Money brand colours (`#3F00DE`, `#85E8FF`, black and UX greys), Messina Sans family guidance, Money upstream health-insurance endpoint, state abbreviations, core request field names and response `scenario_id` location.

## Resolved integration decisions

- 2026-09-03: staging base URL is `https://api-staging.money.com.au`.
- 2026-09-03: authentication is `POST /oauth/token` with a JSON client-credentials body containing `grant_type: client_credentials`, `client_id`, `client_secret`, and `scope: ""`.
- 2026-09-03: Vercel server-only environment variable names are `ClientID` and `ClientSecret`. These must never be exposed as `NEXT_PUBLIC_*` variables.
- 2026-09-03: Money accepts at least one local Australian mobile representation in a supplied scenario payload.
- 2026-09-03: empty `hospital_services`, `extra_services`, `reasons_for_cover` and `dependents` may be represented as arrays in the supplied payload.
- 2026-09-03: supplied payload evidence includes string `taxable_income` and a `rebate_label` field; the typed staging client accepts these observed variants pending canonical-contract confirmation.

## Resolved product decisions

- 2026-09-02: collect birth year only. The adapter sends 1 January of the chosen year as ISO `dob` (`YYYY-01-01`).
- 2026-09-02: choice cards and birth-year cards advance on click. No Continue button; retain a small Back control.
- 2026-09-02: consent text is “I agree to the Privacy Policy and Terms of Use,” linked to the supplied Money.com.au pages; the consent version remains deployment configuration.
- 2026-09-02: after successful production submission, redirect the whole embedding page to `https://www.money.com.au/health-insurance/health-thank-you`.
- 2026-09-04: a successful Money response containing `scenario_id` is the final accepted-lead event.
- 2026-09-04: unanswered optional Money fields are sent using the contract's empty representation (`null` for nullable scalar fields and `[]` for list fields). Values are not invented.
- 2026-09-04: answers that cannot yet be mapped require a confirmed Money field name and type. The currently known contract contains no `description` field, so unmapped answers must not be placed in an undocumented field.
