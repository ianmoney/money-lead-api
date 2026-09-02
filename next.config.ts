import type { NextConfig } from "next";

function apiOrigin() {
  try {
    return process.env.NEXT_PUBLIC_LEAD_API_BASE_URL
      ? new URL(process.env.NEXT_PUBLIC_LEAD_API_BASE_URL).origin
      : "";
  } catch {
    return "";
  }
}

function embedAncestors() {
  return (process.env.EMBED_ALLOWED_ORIGINS || "")
    .split(/\s+/)
    .filter(Boolean)
    .filter((value) => {
      try { const url = new URL(value); return url.protocol === "https:" && url.origin === value; }
      catch { return false; }
    })
    .join(" ");
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

if (process.env.NODE_ENV === "production") {
  const connectOrigin = apiOrigin();
  const allowedParents = embedAncestors();
  securityHeaders.push(
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
    {
      key: "Content-Security-Policy",
      value: [
        "default-src 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        `frame-ancestors 'self'${allowedParents ? ` ${allowedParents}` : ""}`,
        "object-src 'none'",
        "img-src 'self' data:",
        "font-src 'self' data:",
        "style-src 'self' 'unsafe-inline'",
        "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
        "frame-src https://challenges.cloudflare.com",
        `connect-src 'self' https://challenges.cloudflare.com${connectOrigin ? ` ${connectOrigin}` : ""}`,
        "upgrade-insecure-requests",
      ].join("; "),
    },
  );
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
