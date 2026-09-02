# Health quote form schema

The reusable component has two presentation contexts (`fullPage` and `inline`) but one schema and one state machine.

## Step order

| Step | Stable field | Input | Values/logic |
| --- | --- | --- | --- |
| 1 | `current_health_fund` | 2-column choice grid | Approved display names only; `No current fund` is an explicit empty-provider state |
| 2 | `cover_for` | 2-column choice grid | `Individual`, `Couple`, `Family` |
| 3 | `cover_type` | 2-column choice grid | `Hospital Only`, `Hospital & Extras`, `Extras Only` |
| 4 | `state` | 2-column choice grid | `ACT`, `NSW`, `NT`, `QLD`, `SA`, `TAS`, `VIC`, `WA` |
| 5 | `birth_year` | 2-stage clickable grid | Choose a decade, then a year; the adapter submits 1 January of that year as ISO `dob` |
| 6 | `first_name`, `last_name`, `email`, `phone` | labeled inputs | Australian mobile normalized to E.164 for the first-party API |
| 7 | OTP | six-digit input | Send, sent, countdown, wrong, expired, rate-limited, verified, recoverable failure |

Gender, citizenship and dependant details are excluded until Money confirms why and how they are required. `Not sure` is excluded where no downstream mapping exists.

## State machine

`answering -> sendingOtp -> otpSent -> checkingOtp -> otpInvalid|otpExpired|otpRateLimited|verified -> submitting -> submitFailed|accepted -> redirecting`

- Back keeps in-memory answers and invalidates any verification proof if the phone changes.
- A verified phone mismatch cannot be submitted.
- Reload restarts and retains no PII.
- Choice and year selections auto-advance. There is no Continue button.
- A small Back control preserves prior answers. Inside the birth-year step it returns from years to decades before returning to the previous question.
- Validation messages are specific, associated with fields and announced in a polite live region.

## Presentation contract

- Choice cards remain two columns down to 320 px where labels fit; long provider labels wrap.
- Each card is at least 64 px high on mobile and every interactive target is at least 44x44 px.
- At 320 px there is no horizontal scrolling, clipped copy or nested form scrollbar.
- Keyboard users can tab, select with native controls, continue and go back with visible focus.
