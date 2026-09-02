# Accessibility and performance contract

## Accessibility

- Target WCAG 2.2 AA with semantic headings, fieldsets/legends, native inputs, associated error text and live status messages.
- Full keyboard completion, visible `:focus-visible`, logical focus on each new step and no focus traps.
- Minimum 44x44 px targets, readable 18 px mobile body copy and no information conveyed by colour alone.
- Respect `prefers-reduced-motion`; transitions are decorative and non-blocking.
- No horizontal scroll at 320 px and no nested form scrollbar in inline placement.
- Automated gate: zero serious/critical axe findings; manual screen-reader and keyboard UAT remains required.

## Performance

- Representative mobile budgets: LCP < 2.5 s, INP < 200 ms, CLS < 0.1.
- No client UI framework, carousel or icon pack. The first question renders in the initial route payload.
- Brand logo is a local static asset with fixed dimensions. No hero photography is required for the form.
- Load Turnstile only when the user reaches contact verification, subject to final CSP.
- Keep first-load JavaScript for the quote route under 150 KB gzip where feasible and report actual build output.
- No uncaught console errors or failed application requests in the happy path.
