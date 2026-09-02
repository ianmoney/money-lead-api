export type QuoteEventName =
  | "quote_view" | "quote_start" | "quote_step_complete" | "quote_validation_error"
  | "phone_otp_requested" | "phone_otp_verified" | "lead_submit_started"
  | "lead_submit_succeeded" | "lead_submit_failed";

type SafeProperties = Record<string, string | number | boolean>;

declare global { interface Window { dataLayer?: Array<Record<string, unknown>>; } }

export function trackQuoteEvent(name: QuoteEventName, properties: SafeProperties = {}) {
  if (typeof window === "undefined") return;
  const event = { event: name, ...properties };
  window.dispatchEvent(new CustomEvent("money:quote-event", { detail: event }));
  window.dataLayer?.push(event);
}

export type Attribution = {
  utm_source: string | null; utm_medium: string | null; utm_campaign: string | null;
  utm_content: string | null; utm_term: string | null; fbclid: string | null; gclid: string | null;
  landing_url: string; referrer: string | null; funnel_version: string;
};

const allowedKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid"] as const;

export function captureAttribution(): Attribution {
  const url = new URL(window.location.href);
  const values = Object.fromEntries(allowedKeys.map((key) => [key, url.searchParams.get(key)?.slice(0, 256) || null]));
  let referrer: string | null = null;
  if (document.referrer) { try { const parsed = new URL(document.referrer); referrer = `${parsed.origin}${parsed.pathname}`.slice(0, 500); } catch {} }
  return { ...values, landing_url: `${url.origin}${url.pathname}`.slice(0, 500), referrer, funnel_version: "health-v1" } as Attribution;
}
