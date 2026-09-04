import "server-only";

import type { Attribution } from "@/features/health-quote/analytics";
import {
  coverForOptions,
  coverTypeOptions,
  providerOptions,
  genderOptions,
  stateOptions,
  type LeadAnswers,
} from "@/features/health-quote/schema";
import { normalizeAustralianMobile } from "@/features/health-quote/validation";
import {
  MoneyApiError,
  type MoneyHealthInsuranceScenarioRequest,
  type MoneyState,
} from "./client";

type CoverFor = (typeof coverForOptions)[number];
type CoverType = (typeof coverTypeOptions)[number];
type Provider = (typeof providerOptions)[number];
type Gender = (typeof genderOptions)[number];

export type MoneyHealthInsuranceMapping = {
  coverageTypeByCoverFor?: Partial<Record<CoverFor, string>>;
  providerAccountIdByFund?: Partial<Record<Provider, string>>;
  contactPhoneFormat?: "E164" | "AU_LOCAL";
};

export type MoneyHealthInsuranceSupplementalAnswers = {
  partnerDob?: string | null;
  dependents?: unknown[] | null;
  taxableIncome?: number | string | null;
  rebateLabel?: string | null;
  reasonsForCover?: string | string[] | null;
  hospitalServices?: string[] | null;
  extraServices?: string[] | null;
  hospitalServiceClassification?: string | null;
  boContinuousCover?: boolean | null;
  campaign?: string | null;
};

const COVER_TYPE_BY_LABEL: Record<CoverType, MoneyHealthInsuranceScenarioRequest["cover_type"]> = {
  "Hospital Only": { hospital: true, extras: false },
  "Hospital & Extras": { hospital: true, extras: true },
  "Extras Only": { hospital: false, extras: true },
};

function isOneOf<T extends readonly string[]>(values: T, value: string): value is T[number] {
  return values.includes(value as T[number]);
}

function mappingRequired(message: string): never {
  throw new MoneyApiError("MAPPING_REQUIRED", message);
}

function assertIsoDateOrNull(value: string | null | undefined, field: string) {
  // Money's Laravel Data DTO models omitted partner_dob as Optional, but rejects
  // an explicit JSON null before its validation rules run.
  if (value == null) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new MoneyApiError("INVALID_REQUEST", `${field} must use YYYY-MM-DD format.`);
  }
  return value;
}

export function birthYearToMoneyDob(birthYear: string, currentYear = new Date().getFullYear()) {
  if (!/^\d{4}$/.test(birthYear)) {
    throw new MoneyApiError("INVALID_REQUEST", "Birth year must contain four digits.");
  }

  const year = Number(birthYear);
  if (year < 1900 || year > currentYear) {
    throw new MoneyApiError("INVALID_REQUEST", "Birth year is outside the supported range.");
  }

  return `${birthYear}-01-01`;
}

export function moneyCoverTypeFromLabel(label: string) {
  if (!isOneOf(coverTypeOptions, label)) {
    throw new MoneyApiError("INVALID_REQUEST", "Health cover type is not supported.");
  }

  return { ...COVER_TYPE_BY_LABEL[label] };
}

function moneyProviderAccountId(
  provider: Provider,
  mapping: MoneyHealthInsuranceMapping,
) {
  if (provider === "No current fund" || provider === "Other") return null;

  const accountId = mapping.providerAccountIdByFund?.[provider]?.trim();
  return accountId || null;
}

function moneyCoverageType(coverFor: CoverFor, gender: Gender | "", mapping: MoneyHealthInsuranceMapping) {
  const configured = mapping.coverageTypeByCoverFor?.[coverFor]?.trim();
  if (configured) return configured;
  if (coverFor === "Individual") {
    if (gender === "Female") return "JUST_YOU_FEMALE";
    if (gender === "Male") return "JUST_YOU_MALE";
    return "JUST_YOU";
  }
  if (coverFor === "Couple") return "COUPLE";
  return "FAMILY";
}

function moneyReferrer(attribution: Attribution, campaign?: string | null) {
  return {
    campaign: campaign ?? null,
    ga_client_id: null,
    gclid: attribution.gclid,
    fbclid: attribution.fbclid,
    utm_source: attribution.utm_source,
    utm_medium: attribution.utm_medium,
    utm_campaign: attribution.utm_campaign,
    utm_content: attribution.utm_content,
    utm_term: attribution.utm_term,
    http_referrer: attribution.referrer,
  };
}

function moneyContactPhone(phone: string, mapping: MoneyHealthInsuranceMapping) {
  const normalized = normalizeAustralianMobile(phone);
  if (!normalized) {
    throw new MoneyApiError("INVALID_REQUEST", "Contact phone must be an Australian mobile number.");
  }

  if (mapping.contactPhoneFormat === "E164") return normalized;
  if (mapping.contactPhoneFormat === "AU_LOCAL") return `0${normalized.slice(3)}`;

  return mappingRequired("Money contact phone format is not configured.");
}

export function buildMoneyHealthInsuranceScenario(
  answers: LeadAnswers,
  attribution: Attribution,
  mapping: MoneyHealthInsuranceMapping,
  supplemental: MoneyHealthInsuranceSupplementalAnswers = {},
): MoneyHealthInsuranceScenarioRequest {
  if (!isOneOf(coverForOptions, answers.cover_for)) {
    throw new MoneyApiError("INVALID_REQUEST", "Health coverage selection is not supported.");
  }
  if (!isOneOf(providerOptions, answers.current_health_fund)) {
    throw new MoneyApiError("INVALID_REQUEST", "Current health fund is not supported.");
  }
  if (answers.gender !== "" && !isOneOf(genderOptions, answers.gender)) {
    throw new MoneyApiError("INVALID_REQUEST", "Gender selection is not supported.");
  }
  if (!isOneOf(stateOptions, answers.state)) {
    throw new MoneyApiError("INVALID_REQUEST", "State or territory is not supported.");
  }

  const coverageType = moneyCoverageType(answers.cover_for, answers.gender, mapping);

  return {
    coverage_type: coverageType,
    cover_type: moneyCoverTypeFromLabel(answers.cover_type),
    reasons_for_cover: supplemental.reasonsForCover ?? [],
    dob: birthYearToMoneyDob(answers.birth_year),
    partner_dob: assertIsoDateOrNull(supplemental.partnerDob, "Partner DOB"),
    dependents: supplemental.dependents ?? [],
    state: answers.state as MoneyState,
    taxable_income: supplemental.taxableIncome ?? null,
    rebate_label: supplemental.rebateLabel ?? null,
    hospital_service_classification: supplemental.hospitalServiceClassification ?? null,
    current_provider_account_id: moneyProviderAccountId(answers.current_health_fund, mapping),
    hospital_services: supplemental.hospitalServices ?? [],
    extra_services: supplemental.extraServices ?? [],
    contact_first_name: answers.first_name.trim(),
    contact_last_name: answers.last_name.trim(),
    contact_email: answers.email.trim().toLowerCase(),
    contact_phone: moneyContactPhone(answers.phone, mapping),
    mobile_code: null,
    bo_continuous_cover: supplemental.boContinuousCover ?? null,
    referrer: moneyReferrer(attribution, supplemental.campaign),
  };
}
