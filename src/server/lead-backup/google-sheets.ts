import "server-only";

const REQUEST_TIMEOUT_MS = 8_000;
const MAX_ATTEMPTS = 3;

export type LeadBackupRow = {
  received_at: string;
  submission_id: string;
  backup_status: "PENDING_MONEY_API" | "MONEY_ACCEPTED" | "MONEY_FAILED";
  current_health_fund: string;
  cover_for: string;
  gender: string;
  cover_type: string;
  state: string;
  birth_year: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  consent_accepted: boolean;
  consent_version: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  fbclid: string;
  gclid: string;
  landing_url: string;
  referrer: string;
  funnel_version: string;
  money_http_status: number | "";
  acceptance_id: string;
  acceptance_id_field: string;
  money_response_json: string;
  error_code: string;
  error_message: string;
  retry_count: number;
  last_attempt_at: string;
};

export class LeadBackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeadBackupError";
  }
}

function configuration() {
  const url = process.env.GOOGLE_SHEETS_WEBHOOK_URL?.trim();
  const secret = process.env.GOOGLE_SHEETS_WEBHOOK_SECRET?.trim();
  if (!url || !secret) throw new LeadBackupError("Lead backup is not configured.");

  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.hostname !== "script.google.com" || !/^\/macros\/s\/[^/]+\/exec$/.test(parsed.pathname)) {
    throw new LeadBackupError("Lead backup URL is invalid.");
  }
  return { url: parsed.toString(), secret };
}

type BackupReply = {
  ok?: unknown;
  previous_status?: unknown;
  acceptance_id?: unknown;
  acceptance_id_field?: unknown;
};

async function sendLeadBackup(action: "reserve" | "upsert", row: LeadBackupRow) {
  const { url, secret } = configuration();
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ secret, action, row: { ...row, retry_count: attempt - 1 } }),
        signal: controller.signal,
        redirect: "follow",
      });
      const result = await response.json().catch(() => null) as BackupReply | null;
      if (response.ok && result?.ok === true) return result;
      lastError = new Error(`Lead backup returned HTTP ${response.status}.`);
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new LeadBackupError(lastError instanceof Error ? lastError.message : "Lead backup failed.");
}

export async function reserveLeadBackup(row: LeadBackupRow) {
  const result = await sendLeadBackup("reserve", row);
  return {
    previousStatus: typeof result.previous_status === "string" ? result.previous_status : "",
    acceptanceId: typeof result.acceptance_id === "string" ? result.acceptance_id : "",
    acceptanceIdField: typeof result.acceptance_id_field === "string" ? result.acceptance_id_field : "",
  };
}

export async function upsertLeadBackup(row: LeadBackupRow) {
  await sendLeadBackup("upsert", row);
}
