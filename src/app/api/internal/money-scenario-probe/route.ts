import { NextResponse } from "next/server";
import {
  createMoneyHealthInsuranceScenario,
  getMoneyApiBaseUrl,
  MoneyApiError,
  MONEY_STAGING_API_BASE_URL,
} from "@/server/money/client";
import { buildFlatHealthLeadPayload } from "@/server/money/flat-health-lead-adapter";
import type { Attribution } from "@/features/health-quote/analytics";
import type { LeadAnswers } from "@/features/health-quote/schema";

export const dynamic = "force-dynamic";

const SYNTHETIC_ANSWERS: LeadAnswers = {
  current_health_fund: "Bupa",
  cover_for: "Individual",
  cover_type: "Hospital Only",
  state: "QLD",
  birth_year: "1990",
  first_name: "Staging",
  last_name: "Probe",
  email: "staging-probe@example.invalid",
  // ACMA-reserved fictional mobile number. Never replace with customer data.
  phone: "0491570156",
  consentAccepted: true,
};

const SYNTHETIC_ATTRIBUTION: Attribution = {
  utm_source: "staging-probe",
  utm_medium: "internal",
  utm_campaign: null,
  utm_content: null,
  utm_term: null,
  fbclid: null,
  gclid: null,
  landing_url: "/api/internal/money-scenario-probe",
  referrer: null,
  funnel_version: "health-v1",
};

function probeUnavailable() {
  return NextResponse.json({ ok: false, code: "NOT_FOUND" }, { status: 404 });
}

export async function POST(request: Request) {
  if (process.env.VERCEL_ENV !== "preview") {
    return probeUnavailable();
  }

  if (getMoneyApiBaseUrl() !== MONEY_STAGING_API_BASE_URL) {
    return NextResponse.json(
      { ok: false, code: "CONFIGURATION_REQUIRED", message: "Scenario probe requires the Money staging API." },
      { status: 503 },
    );
  }

  const expectedKey = process.env.INTERNAL_HEALTHCHECK_KEY?.trim();
  const suppliedKey = request.headers.get("x-internal-healthcheck-key")?.trim();
  if (!expectedKey || !suppliedKey || suppliedKey !== expectedKey) {
    return probeUnavailable();
  }

  try {
    const flatPayload = buildFlatHealthLeadPayload({
      answers: SYNTHETIC_ANSWERS,
      attribution: SYNTHETIC_ATTRIBUTION,
      submissionId: crypto.randomUUID(),
    });
    const result = await createMoneyHealthInsuranceScenario(flatPayload);
    return NextResponse.json({
      ok: true,
      upstream: "money-staging",
      acceptance_id: result.acceptance_id,
      acceptance_id_field: result.acceptance_id_field,
    });
  } catch (error) {
    const apiError = error instanceof MoneyApiError
      ? error
      : new MoneyApiError("UPSTREAM_UNAVAILABLE", "Money staging scenario probe failed.");

    if (apiError.code === "LEAD_REJECTED") {
      return NextResponse.json(
        {
          ok: false,
          code: apiError.code,
          message: apiError.message,
          validation_issues: apiError.validationIssues ?? [],
        },
        { status: 422 },
      );
    }

    if (apiError.code === "UPSTREAM_RESPONSE_INVALID") {
      return NextResponse.json(
        {
          ok: false,
          code: apiError.code,
          message: apiError.message,
          response_shape: apiError.responseShape,
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { ok: false, code: apiError.code, message: apiError.message },
      { status: apiError.status === 401 || apiError.status === 403 ? 502 : 503 },
    );
  }
}
