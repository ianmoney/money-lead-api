# Tracking plan

The frontend emits anonymous structured events through one adapter. No event property may contain name, email, phone, DOB, OTP, tokens, free text or raw answer values that could identify a person.

| Event | Fires when | Allowed properties |
| --- | --- | --- |
| `quote_view` | form first becomes visible | context, funnel_version |
| `quote_start` | first answer is selected | context, funnel_version |
| `quote_step_complete` | a valid step advances | step_id, step_index, context |
| `quote_validation_error` | step validation blocks progress | step_id, error_code |
| `phone_otp_requested` | backend accepts the send request | context |
| `phone_otp_verified` | backend returns a verification proof | context |
| `lead_submit_started` | verified lead request starts | event_id |
| `lead_submit_succeeded` | backend confirms Money accepted | event_id |
| `lead_submit_failed` | lead request fails | event_id, safe_error_code |

UTM source/medium/campaign/content/term, `fbclid`, `gclid`, landing URL, referrer and funnel version are captured once in memory and sent to the backend only when supported. They are length-limited and never written to persistent browser storage.

Meta `Lead` and the primary GA4 conversion fire exactly once and only after `lead_submit_succeeded`. The stable submission UUID is the event ID for future browser/server deduplication. OTP success, clicks, redirects and thank-you reloads are not conversions.
