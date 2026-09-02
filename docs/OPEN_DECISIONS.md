# Open decisions

Unresolved items fail closed; they are not inferred from examples.

| ID | Decision/blocker | Current evidence | Required owner/action |
| --- | --- | --- | --- |
| OD-01 | Complete production `coverage_type` enum | Admin screenshot confirms field and one example only | Money API owner supplies full enum/mapping |
| OD-02 | Provider account IDs and whether required | Field is `current_provider_account_id`; no mapping supplied | Money API owner supplies approved list |
| OD-03 | OAuth credential encoding | Not visible in supplied Admin screenshot | Existing `money-lead-api` docs/code review |
| OD-04 | Upstream phone representation | Public verification contract uses E.164; upstream requirement unconfirmed | Money API owner confirms |
| OD-05 | Upstream idempotency header | Not supplied | Money API owner confirms; internal idempotency still required |
| OD-06 | Required scenario/request fields | Screenshot confirms shape, not all business requirements | Staging validation with API owner |
| OD-07 | Gender, citizenship and dependants | No confirmed downstream requirement | Product/compliance/API owners decide |
| OD-10 | Durable expiring store/vendor/region | Requirement supplied, provider not selected | Security/platform approval |
| OD-11 | Security-critical server implementation and tests | Repository now contains the frontend widget only | Implement and independently review the backend before staging UAT |
| OD-12 | Turnstile/Twilio/staging credentials | Not supplied | Human-approved staging UAT gate |

Confirmed by supplied material: Money brand colours (`#3F00DE`, `#85E8FF`, black and UX greys), Messina Sans family guidance, Money upstream base/endpoint, state abbreviations, core request field names and response `scenario_id` location.

## Resolved product decisions

- 2026-09-02: collect birth year only. The adapter sends 1 January of the chosen year as ISO `dob` (`YYYY-01-01`).
- 2026-09-02: choice cards and birth-year cards advance on click. No Continue button; retain a small Back control.
- 2026-09-02: consent text is “I agree to the Privacy Policy and Terms of Use,” linked to the supplied Money.com.au pages; the consent version remains deployment configuration.
- 2026-09-02: after successful production submission, redirect the whole embedding page to `https://www.money.com.au/health-insurance/health-thank-you`.
