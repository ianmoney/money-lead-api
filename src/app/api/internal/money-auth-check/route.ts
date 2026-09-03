import { NextResponse } from "next/server";
import { getMoneyAccessToken, MoneyApiError } from "@/server/money/client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const expectedKey = process.env.INTERNAL_HEALTHCHECK_KEY?.trim();
  if (expectedKey) {
    const suppliedKey = request.headers.get("x-internal-healthcheck-key")?.trim();
    if (suppliedKey !== expectedKey) {
      return NextResponse.json({ ok: false, code: "NOT_FOUND" }, { status: 404 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { ok: false, code: "CONFIGURATION_REQUIRED", message: "Internal health check is disabled." },
      { status: 503 },
    );
  }

  try {
    const { tokenType } = await getMoneyAccessToken();
    return NextResponse.json({
      ok: true,
      upstream: "money-staging",
      token_type: tokenType,
    });
  } catch (error) {
    const apiError = error instanceof MoneyApiError
      ? error
      : new MoneyApiError("UPSTREAM_UNAVAILABLE", "Money staging authentication check failed.");

    return NextResponse.json(
      { ok: false, code: apiError.code, message: apiError.message },
      { status: apiError.status && apiError.status >= 400 && apiError.status < 600 ? 502 : 503 },
    );
  }
}
