const SPREADSHEET_ID = "14gvr-c9hp0H9L464yqpaqDOkPvPMxf447AwsTA1rfI8";
const SHEET_NAME = "Health";
const HEADERS = [
  "Received at", "Submission ID", "Backup status", "Current health fund", "Cover for", "Gender", "Cover type",
  "State", "Birth year", "First name", "Last name", "Email", "Phone", "Consent accepted", "Consent version",
  "UTM source", "UTM medium", "UTM campaign", "UTM content", "UTM term", "fbclid", "gclid", "Landing URL",
  "Referrer", "Funnel version", "Money HTTP status", "Acceptance ID", "Acceptance ID field", "Money response JSON",
  "Error code", "Error message", "Retry count", "Last attempt at"
];
const KEYS = [
  "received_at", "submission_id", "backup_status", "current_health_fund", "cover_for", "gender", "cover_type", "state",
  "birth_year", "first_name", "last_name", "email", "phone", "consent_accepted", "consent_version", "utm_source",
  "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid", "landing_url", "referrer",
  "funnel_version", "money_http_status", "acceptance_id", "acceptance_id_field", "money_response_json", "error_code",
  "error_message", "retry_count", "last_attempt_at"
];

function jsonResponse_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const body = JSON.parse((e.postData && e.postData.contents) || "{}");
    const expected = PropertiesService.getScriptProperties().getProperty("WEBHOOK_SECRET");
    if (!expected || body.secret !== expected || ["reserve", "upsert"].indexOf(body.action) < 0 || !body.row || !body.row.submission_id) {
      return jsonResponse_({ ok: false, code: "NOT_AUTHORIZED" });
    }

    lock.waitLock(10000);
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error("Backup sheet not found.");
    const headerValues = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
    if (headerValues.join("\n") !== HEADERS.join("\n")) throw new Error("Backup sheet headers do not match.");

    const lastRow = sheet.getLastRow();
    let targetRow = lastRow + 1;
    let previousStatus = "";
    let previousAcceptanceId = "";
    let previousAcceptanceIdField = "";
    if (lastRow >= 2) {
      const ids = sheet.getRange(2, 2, lastRow - 1, 1).getDisplayValues();
      const index = ids.findIndex(function (entry) { return entry[0] === String(body.row.submission_id); });
      if (index >= 0) {
        targetRow = index + 2;
        const existing = sheet.getRange(targetRow, 1, 1, HEADERS.length).getDisplayValues()[0];
        previousStatus = existing[2];
        previousAcceptanceId = existing[26];
        previousAcceptanceIdField = existing[27];
      }
    }

    if (body.action === "reserve" && (previousStatus === "PENDING_MONEY_API" || previousStatus === "MONEY_ACCEPTED")) {
      return jsonResponse_({ ok: true, row: targetRow, previous_status: previousStatus, acceptance_id: previousAcceptanceId, acceptance_id_field: previousAcceptanceIdField });
    }

    const values = KEYS.map(function (key) {
      const value = body.row[key];
      return value === null || typeof value === "undefined" ? "" : value;
    });
    sheet.getRange(targetRow, 1, 1, values.length).setValues([values]);
    SpreadsheetApp.flush();
    return jsonResponse_({ ok: true, row: targetRow, previous_status: previousStatus });
  } catch (error) {
    return jsonResponse_({ ok: false, code: "WRITE_FAILED", message: String(error && error.message || error) });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}
