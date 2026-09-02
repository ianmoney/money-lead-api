# Health quote form integration

The landing page owns only the stable panel and lifecycle boundary. It does not know questionnaire fields, read answer payloads, validate answers or submit leads.

## Integration modes

### Same-repository component

Pass a React component to `QuoteFormEmbed.component`. The component receives `onReady`, `onStart`, `onComplete` and `onError`. Callbacks have no answer arguments.

### Separate Vercel application

Set both:

```text
NEXT_PUBLIC_HEALTH_FORM_URL=https://approved-form-host.example/path
NEXT_PUBLIC_HEALTH_FORM_ALLOWED_ORIGINS=https://approved-form-host.example
```

The URL must be HTTPS and its exact origin must be in the comma-separated allowlist. Wildcards and arbitrary origins are not supported. The iframe uses `allow-forms allow-scripts allow-same-origin`, requests no camera/microphone permissions, has a descriptive title, a strict referrer policy and a fallback link.

Production without either integration renders an honest unavailable state. Development and builds with `NEXT_PUBLIC_HEALTH_FORM_SCREENSHOT_MODE=true` render a deterministic, non-interactive placeholder solely for layout testing.

## Child-to-parent message contract

The child window posts messages to the exact parent origin, never `*`:

```ts
type HealthFormMessage =
  | { source: "money-health-form"; version: 1; type: "ready" }
  | { source: "money-health-form"; version: 1; type: "start" }
  | { source: "money-health-form"; version: 1; type: "complete" }
  | { source: "money-health-form"; version: 1; type: "error"; code?: string }
  | { source: "money-health-form"; version: 1; type: "resize"; height: number };
```

The parent validates `event.source`, exact `event.origin`, source name, version and type. Resize values are finite, rounded and clamped between 420 and 1200px by default. Unknown messages are ignored. The parent does not log message data or inspect child DOM.

## Attribution handoff

Only these existing landing URL parameters are copied into the iframe URL:

- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `utm_term`
- `fbclid`
- `gclid`
- `msclkid`

Each value is trimmed and capped at 256 characters. Repeated parameters use the first value. No other query strings or fragments are forwarded. The adapter does not put answers, PII or health data in URLs, storage, analytics or logs.

## Landing-page lifecycle analytics

The page emits `health_quote_embed_ready` only after an explicit same-repository callback or a validated `ready` message. It emits `health_quote_embed_error` only after an explicit callback, validated `error` message, iframe load failure or invalid configured URL. Form steps and completion/submission analytics remain owned by the form team; a click is never treated as a lead or completion.

## Handoff checklist

1. Provide the approved component or HTTPS form URL.
2. Provide the exact production and preview origins.
3. Implement the version-1 messages above, including a resize message whenever the child height changes.
4. Confirm the child can run without camera or microphone access.
5. Confirm the child accepts only the documented attribution allowlist.
6. Test preview and production origins separately before traffic cutover.
