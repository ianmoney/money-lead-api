import { NextResponse } from "next/server";
import type { Attribution } from "@/features/health-quote/analytics";
import {
  coverForOptions,
  coverTypeOptions,
  genderOptions,
  providerOptions,
  stateOptions,
  type LeadAnswers,
} from "@/features/health-quote/schema";
import { normalizeAustralianMobile } from "@/features/health-quote/validation";
import { LeadBackupError, type LeadBackupRow, reserveLeadBackup, upsertLeadBackup } from "@/server/lead-backup/google-sheets";
import { createMoneyHealthInsuranceScenario, MoneyApiError } from "@/server/money/client";
import { buildMoneyHealthInsuranceScenario } from "@/server/money/health-insurance-adapter";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 32 * 1024;
const CONSENT_VERSION_FALLBACK = "health-v1";
const ALLOWED_CROSS_ORIGINS = new Set(["https://compare.money.com.au"]);

type LeadRequest = {
  submission_id: string;
  lead: LeadAnswers;
  consent: { accepted: boolean; version: string };
  attribution: Attribution;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAllowed(values: readonly string[], value: unknown): value is string {
  return typeof value === "string" && values.includes(value);
}

function requiredString(value: unknown, max: number) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

function nullableString(value: unknown, max: number) {
  return value === null || (typeof value === "string" && value.length <= max);
}

function parseRequest(value: unknown): LeadRequest | null {
  if (!isRecord(value) || !isRecord(value.lead) || !isRecord(value.consent) || !isRecord(value.attribution)) return null;
  const lead = value.lead;
  const consent = value.consent;
  const attribution = value.attribution;
  const phone = typeof lead.phone === "string" ? normalizeAustralianMobile(lead.phone) : null;

  if (!requiredString(value.submission_id, 80) ||
      !isAllowed(providerOptions, lead.current_health_fund) ||
      !isAllowed(coverForOptions, lead.cover_for) ||
      !(isAllowed(genderOptions, lead.gender) || (lead.gender === "" && lead.cover_for !== "Individual")) ||
      !isAllowed(coverTypeOptions, lead.cover_type) ||
      !isAllowed(stateOptions, lead.state) ||
      !requiredString(lead.birth_year, 4) || !/^\d{4}$/.test(lead.birth_year as string) ||
      !requiredString(lead.first_name, 80) || !requiredString(lead.last_name, 80) ||
      !requiredString(lead.email, 160) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email as string) ||
      !phone || consent.accepted !== true || !requiredString(consent.version, 100)) return null;

  const attributionFields = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid", "referrer"];
  if (!attributionFields.every((key) => nullableString(attribution[key], 500)) ||
      !requiredString(attribution.landing_url, 500) || !requiredString(attribution.funnel_version, 100)) return null;

  return value as unknown as LeadRequest;
}

function initialBackupRow(request: LeadRequest): LeadBackupRow {
  const { lead, consent, attribution } = request;
  return {
    received_at: new Date().toISOString(),
    submission_id: request.submission_id.trim(),
    backup_status: "PENDING_MONEY_API",
    current_health_fund: lead.current_health_fund,
    cover_for: lead.cover_for,
    gender: lead.gender,
    cover_type: lead.cover_type,
    state: lead.state,
    birth_year: lead.birth_year,
    first_name: lead.first_name.trim(),
    last_name: lead.last_name.trim(),
    email: lead.email.trim().toLowerCase(),
    phone: normalizeAustralianMobile(lead.phone) || "",
    consent_accepted: consent.accepted,
    consent_version: consent.version || CONSENT_VERSION_FALLBACK,
    utm_source: attribution.utm_source || "",
    utm_medium: attribution.utm_medium || "",
    utm_campaign: attribution.utm_campaign || "",
    utm_content: attribution.utm_content || "",
    utm_term: attribution.utm_term || "",
    fbclid: attribution.fbclid || "",
    gclid: attribution.gclid || "",
    landing_url: attribution.landing_url,
    referrer: attribution.referrer || "",
    funnel_version: attribution.funnel_version,
    money_http_status: "",
    acceptance_id: "",
    acceptance_id_field: "",
    money_response_json: "",
    error_code: "",
    error_message: "",
    retry_count: 0,
    last_attempt_at: new Date().toISOString(),
  };
}

function publicError(code: string, message: string, status: number, submissionId?: string) {
  return NextResponse.json({ success: false, code, message, submission_id: submissionId }, { status });
}

function addCorsHeaders(response: NextResponse, origin: string | null) {
  if (origin && ALLOWED_CROSS_ORIGINS.has(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");
    response.headers.set("Access-Control-Max-Age", "86400");
    response.headers.append("Vary", "Origin");
  }
  return response;
}

export function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  const requestOrigin = new URL(request.url).origin;
  if (!origin || (origin !== requestOrigin && !ALLOWED_CROSS_ORIGINS.has(origin))) {
    return new NextResponse(null, { status: 403 });
  }
  return addCorsHeaders(new NextResponse(null, { status: 204 }), origin);
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const requestOrigin = new URL(request.url).origin;
  const response = (value: NextResponse) => addCorsHeaders(value, origin);
  if (process.env.NODE_ENV === "production" && origin !== requestOrigin && !ALLOWED_CROSS_ORIGINS.has(origin || "")) {
    return publicError("ORIGIN_NOT_ALLOWED", "This submission origin is not allowed.", 403);
  }

  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_BODY_BYTES) return response(publicError("INVALID_REQUEST", "The request is too large.", 413));

  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return response(publicError("INVALID_REQUEST", "The request is too large.", 413));
  const payload = (() => { try { return JSON.parse(raw); } catch { return null; } })();
  const parsed = parseRequest(payload);
  if (!parsed) return response(publicError("INVALID_REQUEST", "Check the form answers and try again.", 400));

  const backup = initialBackupRow(parsed);
  try {
    const reservation = await reserveLeadBackup(backup);
    if (reservation.previousStatus === "MONEY_ACCEPTED" && reservation.acceptanceId) {
      return response(NextResponse.json({
        success: true,
        submission_id: parsed.submission_id,
        acceptance_id: reservation.acceptanceId,
        acceptance_id_field: reservation.acceptanceIdField,
        backup_status: "saved",
        redirect_url: "https://www.money.com.au/health-insurance/health-thank-you",
      }));
    }
    if (reservation.previousStatus === "PENDING_MONEY_API") {
      return response(publicError("SUBMISSION_IN_PROGRESS", "This submission is already being processed. Please wait before trying again.", 409, parsed.submission_id));
    }
  } catch (error) {
    const message = error instanceof LeadBackupError ? error.message : "Lead backup is unavailable.";
    return response(publicError("BACKUP_UNAVAILABLE", message, 503, parsed.submission_id));
  }

  try {
    const scenario = buildMoneyHealthInsuranceScenario(parsed.lead, parsed.attribution, {
      contactPhoneFormat: "AU_LOCAL",
    });
    const result = await createMoneyHealthInsuranceScenario(scenario);
    const completed: LeadBackupRow = {
      ...backup,
      backup_status: "MONEY_ACCEPTED",
      money_http_status: result.upstream_status,
      acceptance_id: result.acceptance_id,
      acceptance_id_field: result.acceptance_id_field,
      money_response_json: JSON.stringify(result.raw_response),
      last_attempt_at: new Date().toISOString(),
    };
    let backupStatus: "saved" | "pending" = "saved";
    try { await upsertLeadBackup(completed); } catch { backupStatus = "pending"; }

    return response(NextResponse.json({
      success: true,
      submission_id: parsed.submission_id,
      acceptance_id: result.acceptance_id,
      acceptance_id_field: result.acceptance_id_field,
      backup_status: backupStatus,
      redirect_url: "https://www.money.com.au/health-insurance/health-thank-you",
    }));
  } catch (error) {
    const apiError = error instanceof MoneyApiError
      ? error
      : new MoneyApiError("UPSTREAM_UNAVAILABLE", "Money could not accept the lead.");
    const failed: LeadBackupRow = {
      ...backup,
      backup_status: "MONEY_FAILED",
      money_http_status: apiError.status || "",
      money_response_json: apiError.rawResponse == null ? "" : JSON.stringify(apiError.rawResponse),
      error_code: apiError.code,
      error_message: apiError.message,
      last_attempt_at: new Date().toISOString(),
    };
    try { await upsertLeadBackup(failed); } catch {}

    const status = apiError.code === "INVALID_REQUEST" ? 400 : apiError.code === "LEAD_REJECTED" ? 422 : 502;
    return response(publicError(apiError.code, "We could not submit your quote just now. Your answers were saved; please try again.", status, parsed.submission_id));
  }
}
