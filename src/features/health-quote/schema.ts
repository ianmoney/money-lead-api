export const providerOptions = [
  "Medibank", "Australian Unity", "AHM", "HCF", "HBF", "nib", "Bupa", "Other", "No current fund",
] as const;
export const coverForOptions = ["Individual", "Couple", "Family"] as const;
export const coverTypeOptions = ["Hospital Only", "Hospital & Extras", "Extras Only"] as const;
export const stateOptions = ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"] as const;

export const steps = [
  { id: "current_health_fund", title: "Who is your current health fund?", hint: "Choose one option" },
  { id: "cover_for", title: "Who needs health cover?", hint: "Choose the option that best fits" },
  { id: "cover_type", title: "What type of cover are you looking for?", hint: "You can review the details with an expert later" },
  { id: "state", title: "Which state or territory do you live in?", hint: "This helps narrow down available cover" },
  { id: "birth_year", title: "What year were you born?", hint: "Choose a decade, then tap your birth year" },
  { id: "contact", title: "Enter a few details to access your comparison", hint: "" },
  { id: "verification", title: "Verify your mobile number", hint: "We use a one-time SMS code to confirm it belongs to you" },
] as const;

export type StepId = (typeof steps)[number]["id"];

export type LeadAnswers = {
  current_health_fund: string;
  cover_for: string;
  cover_type: string;
  state: string;
  birth_year: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  consentAccepted: boolean;
};

export const initialAnswers: LeadAnswers = {
  current_health_fund: "", cover_for: "", cover_type: "", state: "", birth_year: "",
  first_name: "", last_name: "", email: "", phone: "", consentAccepted: false,
};
