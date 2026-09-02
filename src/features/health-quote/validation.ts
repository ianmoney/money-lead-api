import type { LeadAnswers, StepId } from "./schema";

export function normalizeAustralianMobile(value: string) {
  const compact = value.replace(/[\s()-]/g, "");
  if (/^04\d{8}$/.test(compact)) return `+61${compact.slice(1)}`;
  if (/^\+614\d{8}$/.test(compact)) return compact;
  return null;
}

export function validateStep(step: StepId, answers: LeadAnswers): string | null {
  if (step === "current_health_fund" && !answers.current_health_fund) return "Choose your current health fund to continue.";
  if (step === "cover_for" && !answers.cover_for) return "Choose who needs health cover.";
  if (step === "cover_type" && !answers.cover_type) return "Choose the type of cover you want.";
  if (step === "state" && !answers.state) return "Choose your state or territory.";
  if (step === "birth_year" && (!/^\d{4}$/.test(answers.birth_year) || Number(answers.birth_year) < 1900 || Number(answers.birth_year) > new Date().getFullYear())) return "Choose your birth year.";
  if (step === "contact") {
    if (answers.first_name.trim().length < 2) return "Enter your first name.";
    if (answers.last_name.trim().length < 2) return "Enter your last name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers.email.trim())) return "Enter a valid email address.";
    if (!normalizeAustralianMobile(answers.phone)) return "Enter a valid Australian mobile number, such as 0412 345 678.";
  }
  return null;
}
