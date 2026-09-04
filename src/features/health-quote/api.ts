import type { Attribution } from "./analytics";
import type { LeadAnswers } from "./schema";
import { normalizeAustralianMobile } from "./validation";

export class QuoteApiError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

const mockMode = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
const apiBase = process.env.NEXT_PUBLIC_LEAD_API_BASE_URL?.replace(/\/$/, "") || "";
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function post<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${apiBase}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new QuoteApiError(payload.code || "REQUEST_FAILED", payload.message || "We could not complete that request. Please try again.");
    return payload as T;
  } catch (error) {
    if (error instanceof QuoteApiError) throw error;
    throw new QuoteApiError("UPSTREAM_UNAVAILABLE", "We could not connect just now. Please check your connection and try again.");
  } finally { clearTimeout(timeout); }
}

export async function startVerification(phone: string, turnstileToken: string) {
  const normalized = normalizeAustralianMobile(phone);
  if (!normalized) throw new QuoteApiError("INVALID_PHONE", "Enter a valid Australian mobile number.");
  if (mockMode) { await pause(650); return { verification_id: "mock-verification", expires_in: 300, resend_after: 30 }; }
  if (!turnstileToken) throw new QuoteApiError("TURNSTILE_REQUIRED", "Complete the security check before requesting a code.");
  return post<{ verification_id: string; expires_in: number; resend_after: number }>("/api/v1/phone-verification/start", { phone: normalized, funnel: "health-insurance", turnstile_token: turnstileToken });
}

export async function checkVerification(verificationId: string, code: string) {
  if (mockMode) {
    await pause(550);
    if (code === "000000") throw new QuoteApiError("OTP_EXPIRED", "That code has expired. Request a new one.");
    if (code === "999999") throw new QuoteApiError("TRY_LATER", "Too many attempts. Please wait before trying again.");
    if (code !== "246810") throw new QuoteApiError("OTP_INVALID", "That code does not match. Check the SMS and try again.");
    return { verified: true as const, verification_token: "mock-one-time-proof", expires_in: 600 };
  }
  return post<{ verified: true; verification_token: string; expires_in: number }>("/api/v1/phone-verification/check", { verification_id: verificationId, code });
}

export async function submitLead(args: { submissionId: string; answers: LeadAnswers; attribution: Attribution; consentVersion: string; }) {
  const phone = normalizeAustralianMobile(args.answers.phone);
  if (!phone) throw new QuoteApiError("INVALID_PHONE", "The verified mobile number is no longer valid.");
  if (mockMode) {
    await pause(800);
    if (args.answers.email.toLowerCase() === "fail@example.invalid") throw new QuoteApiError("UPSTREAM_UNAVAILABLE", "Money could not accept the quote just now. Your details have not been submitted. Please try again.");
    return { success: true as const, submission_id: args.submissionId, redirect_url: null };
  }
  return post<{ success: true; submission_id: string; acceptance_id: string; acceptance_id_field: string; backup_status: "saved" | "pending"; redirect_url: string }>("/api/v1/health-insurance/leads", {
    submission_id: args.submissionId,
    lead: {
      current_health_fund: args.answers.current_health_fund,
      cover_for: args.answers.cover_for,
      gender: args.answers.gender,
      cover_type: args.answers.cover_type,
      state: args.answers.state,
      dob: `${args.answers.birth_year}-01-01`,
      first_name: args.answers.first_name,
      last_name: args.answers.last_name,
      email: args.answers.email,
      phone,
    },
    consent: { accepted: args.answers.consentAccepted, version: args.consentVersion },
    attribution: args.attribution,
  });
}

export function isMockMode() { return mockMode; }
