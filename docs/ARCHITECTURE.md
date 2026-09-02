# Health insurance landing-page architecture

Status: implementation contract for `/health-insurance`. The questionnaire is an external dependency and is not implemented in this repository.

## Source priority and scope

1. `Health Insurance Mockup (1).png` controls layout, geometry and section order.
2. The supplied Money brand guide controls brand identity.
3. `money.com.au/health-quote-quick` controls approved assets, testimonial and legal copy.
4. The Health Insurance Experts page is an interaction reference only; its branding, code and question flow are excluded.

The landing page never knows questionnaire fields, reads answers, validates health data, transforms leads or submits leads.

## Folder ownership

| Folder | Responsibility |
| --- | --- |
| `src/app/health-insurance/` | Route entry, route metadata and composition only |
| `src/components/health-insurance/` | Header, hero, trust ribbon, provider grid, testimonial, footer and page styling |
| `src/integrations/quote-form/` | Form mount/embed adapter only; no questionnaire implementation |
| `src/integrations/analytics/` | Anonymous landing-page event adapter |
| `src/config/` | Approved copy, links, providers and public integration configuration |
| `public/assets/health-insurance/` | Locally stored authorised Money assets |
| `tests/health-insurance/` | Functional, responsive, accessibility and visual assertions |
| `scripts/visual-check/` | Deterministic screenshot/verification runner |
| `docs/` | Audit, integration contract and persistent status |

Only the integrator changes root configuration. Builders do not edit another builder's owned folder.

## Component boundaries

- `HealthInsurancePage` composes sections and does not inspect form internals.
- `Hero` owns the title, benefits and the stable form-panel geometry.
- `QuoteFormEmbed` fills that geometry with either a same-repository component, a configured iframe, a development/screenshot placeholder, or a production-safe unavailable state.
- `LandingAnalytics` emits only the approved page-level events.
- `CompareNowButton` scrolls the stable form anchor into view, focuses the iframe/container without trapping focus, and emits the CTA event.

The form panel's dimensions and hero layout do not change when the integration mode changes.

## Form adapter API

```ts
type QuoteFormEmbedProps = {
  component?: React.ComponentType<EmbeddedQuoteFormProps>;
  embedUrl?: string;
  allowedOrigins?: readonly string[];
  initialHeight?: number;
  minHeight?: number;
  maxHeight?: number;
  onReady?: () => void;
  onStart?: () => void;
  onComplete?: () => void;
  onError?: (error: QuoteFormEmbedError) => void;
};
```

Same-repository components receive lifecycle callbacks but the parent receives no answer payload. The iframe mode is configured with `NEXT_PUBLIC_HEALTH_FORM_URL`; exact allowed origins come from `NEXT_PUBLIC_HEALTH_FORM_ALLOWED_ORIGINS` and must include the embed URL origin. Missing or invalid production configuration fails closed.

## Iframe and `postMessage` contract

Every incoming message must satisfy all of the following:

1. `event.source === iframe.contentWindow`.
2. `event.origin` is an exact member of the parsed HTTPS origin allowlist.
3. Data is a plain object with `source: "money-health-form"`, `version: 1`, and one supported `type`.
4. No lifecycle payload is logged or copied into analytics.

Supported messages:

```ts
type HealthFormMessage =
  | { source: "money-health-form"; version: 1; type: "ready" }
  | { source: "money-health-form"; version: 1; type: "start" }
  | { source: "money-health-form"; version: 1; type: "complete" }
  | { source: "money-health-form"; version: 1; type: "error"; code?: string }
  | { source: "money-health-form"; version: 1; type: "resize"; height: number };
```

Resize height is finite, rounded, and clamped to the adapter's configured minimum and maximum. All unknown origins, sources, versions, types and fields are ignored. The iframe gets an accessible title, no camera/microphone permission, a restrictive sandbox, a fallback link, and a parent-controlled height so nested scrolling is avoided when resize messages are supported.

## Attribution handoff

Only these query parameters may be copied to the iframe URL: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `fbclid`, `gclid`, `msclkid`. Values are length-limited, single-valued strings. Arbitrary parameters, fragments and values that resemble PII are not forwarded. Attribution is held only long enough to construct the embed URL and is not written to storage or logs.

## Analytics ownership

The landing page owns:

- `health_quote_page_view`
- `health_quote_form_visible`
- `health_quote_compare_now_click`
- `health_quote_embed_ready`
- `health_quote_embed_error`

Events are pushed through the existing `window.dataLayer` interface when available, without installing pixels or analytics scripts. `embed_ready` and `embed_error` fire only from an explicit same-repository callback or a validated iframe message/load failure. The form team owns step, answer, validation and completion/submission analytics. No name, contact detail, date of birth, health information, answer value or arbitrary URL parameter enters the data layer.

## Asset policy

Use the official Money logos, provider logos, Chris photo and Messina webfonts observed on the approved Money page. Store them locally with their original aspect ratios and retain a source manifest. Do not redraw logos, extract fonts from the PDF or hotlink Storyblok at runtime. Decorative hero shapes are CSS/SVG geometry and must not reconstruct or alter a logo.

## Responsive contract

Primary verification widths are 1440, 1117, 1024, 768, 390 and 360 pixels. Layout breakpoints are content-driven near 1024, 768 and 600 pixels. The page must have no horizontal overflow, a nearly full-width mobile form panel with safe gutters, reflowed trust ribbon, balanced logo grid, stacked testimonial, 44px interactive targets and readable legal copy.

## Accessibility

- WCAG 2.2 AA target, semantic landmarks and one page `h1`.
- Visible `:focus-visible` indicators and logical keyboard order.
- CTA scroll moves focus to the iframe or stable form container and never traps it.
- Descriptive alt text for content images; decorative graphics are hidden.
- Status/error copy is announced without exposing sensitive data.
- Motion is suppressed for `prefers-reduced-motion`.
- Embedded content has a descriptive title and a usable fallback link.

## Performance budget

- Target LCP under 2.5s, CLS under 0.1 and INP under 200ms on representative mobile hardware.
- Self-host fonts with `font-display: swap`; preload only the heading and body faces used above the fold.
- Optimise local images and provide intrinsic dimensions.
- No client UI framework, carousel, analytics SDK or form/questionnaire bundle in the landing shell.
- Keep route client JavaScript below 100KB gzip where practical; the visual shell remains server-rendered except for analytics, CTA and form integration islands.

## Deployment architecture

The route is additive within the existing Next.js App Router application and targets its existing Vercel project. Production metadata defaults to `noindex, nofollow`. Preview and production builds use the same route; screenshot mode is enabled only by non-production/test configuration.

`compare.money.com.au` is a hostname, while `/health-insurance` is an application route. Before domain changes, inspect the current Vercel project/domain association. Never detach or reassign an existing hostname. Deploy a preview first, verify rendered output and HTTPS, then promote through the existing project. If DNS access is unavailable, record the exact Vercel-provided record and pending SSL state without claiming the custom domain is live.

## External dependency

Production funnel completion requires either an approved same-repository form component implementing the callback contract or an approved HTTPS `NEXT_PUBLIC_HEALTH_FORM_URL` plus exact origin allowlist. Until supplied and tested, the landing page is integration-ready but the production funnel is not functional.
