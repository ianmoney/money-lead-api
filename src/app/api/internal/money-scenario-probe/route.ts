import { NextResponse } from "next/server";
import {
  createMoneyHealthInsuranceScenario,
  getMoneyApiBaseUrl,
  MoneyApiError,
  MONEY_STAGING_API_BASE_URL,
  type MoneyHealthInsuranceScenarioRequest,
} from "@/server/money/client";

export const dynamic = "force-dynamic";

const SYNTHETIC_STAGING_SCENARIO: MoneyHealthInsuranceScenarioRequest = {
  coverage_type: "JUST_YOU_MALE",
  dob: "1990-01-01",
  state: "QLD",
  taxable_income: "130000",
  rebate_label: "$118,001 - $158,000",
  hospital_services: [],
  extra_services: [],
  cover_type: {
    hospital: true,
    extras: false,
  },
  contact_first_name: "Staging",
  contact_last_name: "Probe",
  contact_email: "staging-probe@example.invalid",
  // ACMA-reserved fictional mobile number. Never replace with customer data.
  contact_phone: "0491570156",
  referrer: {
    ga_client_id: null,
    gclid: null,
    fbclid: null,
    utm_source: "staging-probe",
    utm_medium: "internal",
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
    http_referrer: "/api/internal/money-scenario-probe",
  },
  reasons_for_cover: [],
  dependents: [],
  bo_continuous_cover: true,
  current_provider_account_id: null,
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
    const result = await createMoneyHealthInsuranceScenario(SYNTHETIC_STAGING_SCENARIO);
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
