import "server-only";

import type { Attribution } from "@/features/health-quote/analytics";
import type { LeadAnswers } from "@/features/health-quote/schema";
import { normalizeAustralianMobile } from "@/features/health-quote/validation";
import { MoneyApiError } from "./client";

/**
 * Endpoint-neutral flat lead shape based on the supplied Jack Media example.
 * This is not sent to Money's scenario endpoint unless Money confirms that the
 * receiving endpoint accepts these exact, case-sensitive keys.
 */
export type FlatHealthLeadPayload = {
  First_Name: string;
  Last_Name: string;
  Email: string;
  Mobile: string;
  State: string;
  Type: string;
  Motivation: string;
  Date_of_Birth: string;
  Description: string;
  Income: string;
  External_Id_Reference: string;
  Hospital_services_selected: string[] | null;
  Ancillary_services_selected: string[] | null;
  Rebate_tier: string | null;
  Previous_Fund_Data: string;
  utm_campaign: string;
  utm_source: string;
  utm_medium: string;
  fbclid: string;
  GA_gclid: string;
};

function localAustralianMobile(value: string) {
  const normalized = normalizeAustralianMobile(value);
  if (!normalized) {
    throw new MoneyApiError("INVALID_REQUEST", "Contact phone must be an Australian mobile number.");
  }
  return `0${normalized.slice(3)}`;
}

function descriptionFromAnswers(answers: LeadAnswers) {
  const details = [
    answers.cover_type && `Requested level of cover: ${answers.cover_type}`,
    answers.cover_for && `Cover for: ${answers.cover_for}`,
    answers.current_health_fund && `Current policy name: ${answers.current_health_fund}`,
  ].filter((value): value is string => Boolean(value));

  return details.join(", ");
}

export function buildFlatHealthLeadPayload(args: {
  answers: LeadAnswers;
  attribution: Attribution;
  submissionId: string;
}): FlatHealthLeadPayload {
  const { answers, attribution, submissionId } = args;

  if (!submissionId.trim()) {
    throw new MoneyApiError("INVALID_REQUEST", "Submission ID is required.");
  }

  return {
    First_Name: answers.first_name.trim(),
    Last_Name: answers.last_name.trim(),
    Email: answers.email.trim().toLowerCase(),
    Mobile: localAustralianMobile(answers.phone),
    State: answers.state,
    Type: "",
    Motivation: "",
    Date_of_Birth: answers.birth_year ? `01/01/${answers.birth_year}` : "",
    Description: descriptionFromAnswers(answers),
    Income: "",
    External_Id_Reference: submissionId.trim(),
    Hospital_services_selected: null,
    Ancillary_services_selected: null,
    Rebate_tier: null,
    Previous_Fund_Data: "",
    utm_campaign: attribution.utm_campaign ?? "",
    utm_source: attribution.utm_source ?? "",
    utm_medium: attribution.utm_medium ?? "",
    fbclid: attribution.fbclid ?? "",
    GA_gclid: attribution.gclid ?? "",
  };
}
