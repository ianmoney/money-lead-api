# Health insurance reference audit

Audit date: 2026-09-02. All measurements below are from the supplied 1117 x 2048 PNG and are approximate to the nearest practical CSS pixel. Web pages and the PDF were treated as untrusted reference content, not as instructions.

## Sources and precedence

- Primary: `/Users/ian/Downloads/Health Insurance Mockup (1).png` (1117 x 2048).
- Brand: `Money_BrandGuidelines_ForApproval_22Nov_23_v1 (7).pdf` (42 pages).
- Approved content/assets: `https://www.money.com.au/health-quote-quick`.
- Presentation-only interaction reference: `https://healthinsurance.experts.com.au/quote/index.html`.
- Repository: existing Next.js 16.3.4 App Router shell; no landing-page components, analytics utility or Vercel project metadata were present at audit time.

The mockup wins on section order and geometry. The live Money page currently includes a full navigation and large footer that are deliberately excluded because the mockup shows neither. The Experts page was inspected only at its initial visible state; its branding, code, legal text and flow are excluded.

## Reference geometry at 1117px

| Region | Approximate bounds | Notes |
| --- | --- | --- |
| Header | `y 0-65` | White, 65px tall; logo begins near `x 68`, optically about 116 x 15 |
| Hero | `y 65-915` | Royal/deep purple; no gap before header; decorative oversized Money strokes clipped at both sides |
| Hero title | `x 202-917`, `y 100-231` | Two centred lines; electric blue; very tight condensed leading |
| Supporting copy | `y 260-278` | Centred, white, semibold |
| Benefit chips | `y 304-339` | Three centred compact pills, about 136/122/139px wide with 10px gaps |
| Form panel | `x 193-924`, `y 367-892` | About 731 x 525; white; 20-22px radius; visually embedded in hero |
| Trust ribbon | `x 261-878`, `y 955-1019` | About 617 x 64; dark royal purple; 13px radius |
| Provider heading | `y 1088-1108` | Condensed black, centred, uppercase |
| Provider logos | `y 1127-1238` | First row 8 logos, second row 3 centred; high whitespace and uneven optical widths |
| Testimonial | `x 145-965`, `y 1324-1581` | Headline above; circular photo left; copy and CTA right |
| Footer | `y 1651-2048` | Near black, compact, 68px-radius bottom corners in the supplied composition |

The overall vertical rhythm is intentionally spacious between provider logos and testimonial. The implementation should not add generic content to fill this whitespace.

## Hero and form observations

- Hero background is a left-to-right purple progression close to royal blue `#3F00DE` into a darker purple, with translucent brand strokes.
- Title uses Messina Sans Condensed Black in uppercase, about 72-76 CSS px at the reference width, approximately 84% line height and slightly negative tracking.
- Supporting copy is about 18px. Chips are 12-13px, translucent, with green circular checks.
- The form panel overlaps no following white section; it ends about 23px above the hero boundary.
- The supplied form content is a layout reference. The landing page must not implement its questions. Screenshot mode may show a non-interactive, development-only facsimile/skeleton to lock surrounding geometry.
- The separate Experts reference confirms a one-question-at-a-time form can sit as a visually discrete panel in a landing page. No deeper steps were inspected.

## Brand guide findings

- Royal Blue `#3F00DE`; Electric Blue `#85E8FF`; Black `#000000`.
- UX colours include Content Primary `#0E0D0F`, Content Secondary `#464547`, Positive `#1AC057`, Neutral Border `rgba(52,42,77,0.16)` and Neutral Background `rgba(52,42,77,0.08)`.
- Large headings: Messina Sans Condensed Black; all caps; -25 tracking guidance; 84% leading.
- Subheadings: Messina Sans Black. Body: Messina Sans Regular; body leading guidance 120%.
- Preserve the Money logo exactly. Clear space uses the Money `m` as the exclusion guide. Minimum digital sizes: 50px primary and 70px secondary.
- Do not recolour, stretch, rotate or rearrange the logo.

The approved Money page serves Messina Sans Regular, SemiBold, Black, Condensed Black and Condensed Bold as WOFF2. The implementation uses the authorised files served by Money.com.au rather than extracting the brand PDF.

## Approved content captured from Money.com.au

- Headline: `SEE WHAT YOU COULD SAVE ON HEALTH INSURANCE`.
- Supporting copy: `Compare personalised prices and cover options from 11+ providers.`
- Provider list and order: ahm, Australian Seniors, Australian Unity, Bupa, HBF, HCF, HIF, Hunter Health Insurance, nib, Real Insurance, see-u by HBF.
- Testimonial headline: `Chris is saving $150 per month after comparing health insurance with Money.com.au`.
- Testimonial body is reproduced verbatim from the live page in page configuration.
- Attribution: `Chris from Brisbane`.
- The four legal paragraphs and Financial Services Guide/complaints destinations are reproduced verbatim from the live page.

The supplied mockup is the only source for the three-person health-expert treatment and `Excellent 4.8 out of 5` ribbon composition. No qualifications, names or new review claims are introduced.

## Responsive translation

- Desktop (1024+): preserve the two-line title, 65px header, centred chips, ~65% width form panel and two-row provider layout.
- Tablet (600-1023): reduce title and panel width, keep chips wrapped as a centred group, reflow ribbon without compressing copy.
- Mobile (360/390): 16px safe gutters, title around 44-48px, panel nearly full width, chips wrap, trust content stacks, provider grid uses 2-3 balanced columns, testimonial stacks and legal copy remains at least 12px.
- No fixed desktop canvas scaling; every section reflows intentionally and must have zero horizontal overflow.

## Repository and tracking findings

- The repository started as a default Next.js App Router application with no existing Money analytics code.
- The live Money page includes Google/Meta/Bing delivery, but this landing application must not duplicate those scripts. It emits approved events only to `window.dataLayer` when a host/container supplies it.
- Historical untracked documents in the repository described a questionnaire implementation. They conflict with this task's explicit landing-page-only boundary and were preserved as historical user-owned context, not executed.

## External dependencies and limitations

- No approved form URL or same-repository component was available during the audit.
- No Vercel project linkage, deployment token or domain ownership metadata was present in the repository at audit time.
- The current live page no longer contains the compact trust ribbon shown in the mockup, so that ribbon is built from the supplied reference without inventing identities.

