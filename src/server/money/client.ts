const DEFAULT_MONEY_API_BASE_URL = "https://api-staging.money.com.au";
const TOKEN_PATH = "/oauth/token";
const HEALTH_INSURANCE_SCENARIO_PATH = "/v1/funnels/health-insurance";
const REQUEST_TIMEOUT_MS = 12_000;

export type MoneyState = "ACT" | "NSW" | "NT" | "QLD" | "SA" | "TAS" | "VIC" | "WA";

export type MoneyReferrer = {
  campaign?: string | null;
  ga_client_id?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  http_referrer?: string | null;
};

/**
 * Fields confirmed from the supplied Money Admin API screenshot.
 * Enum values and business-required combinations are intentionally not guessed here.
 */
export type MoneyHealthInsuranceScenarioRequest = {
  coverage_type: string;
  cover_type: {
    hospital: boolean;
    extras: boolean;
  };
  reasons_for_cover?: string | null;
  dob?: string | null;
  partner_dob?: string | null;
  dependents?: string[] | null;
  state: MoneyState;
  taxable_income?: number | null;
  hospital_service_classification?: string | null;
  current_provider_account_id?: string | null;
  hospital_services?: string[] | null;
  extra_services?: string[] | null;
  contact_first_name: string;
  contact_last_name: string;
  contact_email: string;
  contact_phone: string;
  mobile_code?: string | null;
  bo_continuous_cover?: boolean | null;
  referrer?: MoneyReferrer | null;
};

export type MoneyHealthInsuranceScenarioResponse = {
  scenario_id: string;
  matchmaker_results: Array<{
    scenario_matchmaker_result_id: string;
    package: unknown[] | null;
  }>;
};

type MoneyOAuthTokenResponse = {
  access_token?: unknown;
  token_type?: unknown;
  expires_in?: unknown;
};

type CachedToken = {
  accessToken: string;
  tokenType: string;
  expiresAt: number;
};

let cachedToken: CachedToken | null = null;

export class MoneyApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "MoneyApiError";
  }
}

function getConfig() {
  const clientId = process.env.ClientID?.trim();
  const clientSecret = process.env.ClientSecret?.trim();
  const baseUrl = (process.env.MONEY_API_BASE_URL?.trim() || DEFAULT_MONEY_API_BASE_URL).replace(/\/+$/, "");

  if (!clientId || !clientSecret) {
    throw new MoneyApiError(
      "CONFIGURATION_REQUIRED",
      "Money API credentials are not configured on the server.",
    );
  }

  if (!baseUrl.startsWith("https://")) {
    throw new MoneyApiError("CONFIGURATION_REQUIRED", "Money API base URL must use HTTPS.");
  }

  return { clientId, clientSecret, baseUrl };
}

async function fetchJson(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const payload = await response.json().catch(() => null);
    return { response, payload };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new MoneyApiError("UPSTREAM_TIMEOUT", "Money API request timed out.");
    }
    throw new MoneyApiError("UPSTREAM_UNAVAILABLE", "Money API could not be reached.");
  } finally {
    clearTimeout(timeout);
  }
}

export async function getMoneyAccessToken(): Promise<{ accessToken: string; tokenType: string }> {
  if (cachedToken && cachedToken.expiresAt - Date.now() > 30_000) {
    return { accessToken: cachedToken.accessToken, tokenType: cachedToken.tokenType };
  }

  const { clientId, clientSecret, baseUrl } = getConfig();
  const { response, payload } = await fetchJson(`${baseUrl}${TOKEN_PATH}`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "",
    }),
  });

  if (!response.ok) {
    throw new MoneyApiError(
      "AUTH_FAILED",
      `Money staging authentication failed with HTTP ${response.status}.`,
      response.status,
    );
  }

  const tokenPayload = (payload || {}) as MoneyOAuthTokenResponse;
  if (typeof tokenPayload.access_token !== "string" || tokenPayload.access_token.length === 0) {
    throw new MoneyApiError("AUTH_RESPONSE_INVALID", "Money authentication response did not contain an access token.");
  }

  const tokenType = typeof tokenPayload.token_type === "string" && tokenPayload.token_type.trim()
    ? tokenPayload.token_type.trim()
    : "Bearer";

  const expiresIn = typeof tokenPayload.expires_in === "number" && Number.isFinite(tokenPayload.expires_in)
    ? tokenPayload.expires_in
    : null;

  if (expiresIn && expiresIn > 30) {
    cachedToken = {
      accessToken: tokenPayload.access_token,
      tokenType,
      expiresAt: Date.now() + expiresIn * 1000,
    };
  } else {
    cachedToken = null;
  }

  return { accessToken: tokenPayload.access_token, tokenType };
}

export async function createMoneyHealthInsuranceScenario(
  request: MoneyHealthInsuranceScenarioRequest,
): Promise<MoneyHealthInsuranceScenarioResponse> {
  const { baseUrl } = getConfig();
  const { accessToken, tokenType } = await getMoneyAccessToken();

  const { response, payload } = await fetchJson(`${baseUrl}${HEALTH_INSURANCE_SCENARIO_PATH}`, {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: `${tokenType} ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new MoneyApiError(
      response.status === 422 ? "LEAD_REJECTED" : "UPSTREAM_REQUEST_FAILED",
      `Money health-insurance scenario request failed with HTTP ${response.status}.`,
      response.status,
    );
  }

  const result = (payload || {}) as Partial<MoneyHealthInsuranceScenarioResponse>;
  if (typeof result.scenario_id !== "string" || !Array.isArray(result.matchmaker_results)) {
    throw new MoneyApiError(
      "UPSTREAM_RESPONSE_INVALID",
      "Money health-insurance scenario response did not match the expected shape.",
    );
  }

  return result as MoneyHealthInsuranceScenarioResponse;
}
