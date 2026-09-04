"use client";

import { useEffect, useRef, useState } from "react";
import { captureAttribution, trackQuoteEvent, type Attribution } from "./analytics";
import { isMockMode, QuoteApiError, submitLead } from "./api";
import { coverForOptions, coverTypeOptions, genderOptions, initialAnswers, providerOptions, stateOptions, steps, type LeadAnswers } from "./schema";
import { validateStep } from "./validation";
import styles from "./HealthQuoteForm.module.css";

type Context = "fullPage" | "inline" | "embed";
type SubmitState = "idle" | "submitting" | "error" | "success";

const consentVersion = process.env.NEXT_PUBLIC_CONSENT_VERSION?.trim() || "";
const privacyUrl = "https://www.money.com.au/privacy-policy";
const termsUrl = "https://www.money.com.au/terms-of-use";
const thankYouUrl = "https://www.money.com.au/health-insurance/health-thank-you";
const decades = Array.from({ length: 7 }, (_, index) => 1940 + index * 10);

function ChoiceGrid({ name, value, options, onChange }: { name: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return <div className={styles.optionGrid} role="radiogroup" aria-label={name.replaceAll("_", " ")}>{options.map((option) =>
    <button
      type="button"
      className={`${styles.option} ${value === option ? styles.optionSelected : ""}`}
      role="radio"
      aria-checked={value === option}
      key={option}
      onClick={() => onChange(option)}
    >
      {option}
    </button>
  )}</div>;
}

export function HealthQuoteForm({ context = "embed" }: { context?: Context }) {
  const [answers, setAnswers] = useState<LeadAnswers>(initialAnswers);
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedDecade, setSelectedDecade] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const attribution = useRef<Attribution | null>(null);
  const started = useRef(false);
  const converted = useRef(false);
  const submissionId = useRef("");
  const headingRef = useRef<HTMLLegendElement>(null);
  const mockMode = isMockMode();
  const step = steps[stepIndex];
  const percentage = Math.round(((stepIndex + 1) / steps.length) * 100);

  useEffect(() => { attribution.current = captureAttribution(); trackQuoteEvent("quote_view", { context, funnel_version: "health-v1" }); }, [context]);
  useEffect(() => { if (stepIndex > 0) headingRef.current?.focus(); }, [stepIndex]);
  useEffect(() => {
    if (context !== "embed" || window.parent === window) return;
    const reportHeight = () => window.parent.postMessage({ type: "money-health-quote:resize", height: Math.ceil(document.documentElement.scrollHeight) }, "*");
    const observer = new ResizeObserver(reportHeight);
    observer.observe(document.documentElement);
    reportHeight();
    return () => observer.disconnect();
  }, [context]);

  const noteStart = () => {
    if (!started.current) { started.current = true; trackQuoteEvent("quote_start", { context, funnel_version: "health-v1" }); }
  };

  const update = <K extends keyof LeadAnswers>(key: K, value: LeadAnswers[K]) => {
    setAnswers((current) => ({ ...current, [key]: value }));
    if (key === "phone") setSubmitState("idle");
    setError(""); noteStart();
  };

  const chooseAndAdvance = <K extends keyof LeadAnswers>(key: K, value: LeadAnswers[K]) => {
    setAnswers((current) => ({ ...current, [key]: value }));
    setError(""); noteStart();
    trackQuoteEvent("quote_step_complete", { step_id: step.id, step_index: stepIndex + 1, context });
    window.setTimeout(() => setStepIndex((index) => Math.min(steps.length - 1, index + 1)), 90);
  };

  const goBack = () => {
    if (["submitting", "success"].includes(submitState)) return;
    if (step.id === "birth_year" && selectedDecade !== null) { setSelectedDecade(null); setError(""); return; }
    setError(""); setSubmitState("idle"); setStepIndex((index) => Math.max(0, index - 1));
  };

  const submit = async () => {
    const contactError = validateStep("contact", answers);
    if (contactError) { setError(contactError); trackQuoteEvent("quote_validation_error", { step_id: "contact", error_code: "INVALID_CONTACT" }); return; }
    if (!answers.consentAccepted) { setError("Accept the Privacy Policy and Terms of Use before submitting."); return; }
    setSubmitState("submitting"); setError("");
    try {
      if (!submissionId.current) submissionId.current = crypto.randomUUID();
      trackQuoteEvent("lead_submit_started", { event_id: submissionId.current });
      const result = await submitLead({ submissionId: submissionId.current, answers, attribution: attribution.current || captureAttribution(), consentVersion: mockMode ? "DEMO-NOT-CONSENT" : (consentVersion || "health-v1") });
      setSubmitState("success");
      if (!converted.current) { converted.current = true; trackQuoteEvent("lead_submit_succeeded", { event_id: result.submission_id }); }
      if (!mockMode) {
        if (context === "embed" && window.parent !== window) window.parent.postMessage({ type: "money-health-quote:complete", url: thankYouUrl }, "*");
        else window.location.assign(thankYouUrl);
      }
    } catch (caught) {
      const apiError = caught instanceof QuoteApiError ? caught : new QuoteApiError("REQUEST_FAILED", "We could not complete that request. Please try again.");
      setSubmitState("error"); setError(apiError.message);
      trackQuoteEvent("lead_submit_failed", { event_id: submissionId.current || "not-created", safe_error_code: apiError.code });
    }
  };

  const currentYear = new Date().getFullYear();
  const years = selectedDecade === null ? [] : Array.from({ length: Math.min(10, currentYear - selectedDecade + 1) }, (_, index) => String(selectedDecade + index)).reverse();

  const content = () => {
    if (step.id === "current_health_fund") return <ChoiceGrid name={step.id} value={answers.current_health_fund} options={providerOptions} onChange={(value) => chooseAndAdvance("current_health_fund", value)} />;
    if (step.id === "cover_for") return <ChoiceGrid name={step.id} value={answers.cover_for} options={coverForOptions} onChange={(value) => chooseAndAdvance("cover_for", value)} />;
    if (step.id === "gender") return <ChoiceGrid name={step.id} value={answers.gender} options={genderOptions} onChange={(value) => chooseAndAdvance("gender", value)} />;
    if (step.id === "cover_type") return <ChoiceGrid name={step.id} value={answers.cover_type} options={coverTypeOptions} onChange={(value) => chooseAndAdvance("cover_type", value)} />;
    if (step.id === "state") return <ChoiceGrid name={step.id} value={answers.state} options={stateOptions} onChange={(value) => chooseAndAdvance("state", value)} />;
    if (step.id === "birth_year") return selectedDecade === null
      ? <ChoiceGrid name="birth_decade" value="" options={decades.map((decade) => `${decade}s`)} onChange={(value) => { setSelectedDecade(Number(value.slice(0, 4))); setError(""); }} />
      : <><button type="button" className={styles.decadeBack} onClick={() => setSelectedDecade(null)}>← Choose another decade</button><ChoiceGrid name="birth_year" value={answers.birth_year} options={years} onChange={(value) => chooseAndAdvance("birth_year", value)} /></>;
    if (step.id === "contact") return submitState === "success" ? <div className={styles.successBox} role="status"><span className={styles.statusIcon}>✓</span><h3>Quote submitted</h3><p>Your details were accepted and backed up securely.</p></div> : <div className={styles.fields}>
      <div className={styles.nameRow}><label><span>First name</span><input name="first_name" autoComplete="given-name" value={answers.first_name} maxLength={80} onChange={(e) => update("first_name", e.target.value)} /></label><label><span>Last name</span><input name="last_name" autoComplete="family-name" value={answers.last_name} maxLength={80} onChange={(e) => update("last_name", e.target.value)} /></label></div>
      <label><span>Email address</span><input name="email" type="email" inputMode="email" autoComplete="email" value={answers.email} maxLength={160} onChange={(e) => update("email", e.target.value)} /></label>
      <label><span>Australian mobile number</span><input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0412 345 678" value={answers.phone} maxLength={18} onChange={(e) => update("phone", e.target.value)} /></label>
      <div className={styles.consent}><input id="consent_accepted" name="consent_accepted" type="checkbox" checked={answers.consentAccepted} onChange={(e) => update("consentAccepted", e.target.checked)} /><label htmlFor="consent_accepted">I agree to the <a href={privacyUrl} target="_blank" rel="noreferrer">Privacy Policy</a> and <a href={termsUrl} target="_blank" rel="noreferrer">Terms of Use</a>.</label></div>
      <button type="button" className={styles.sendButton} onClick={submit} disabled={submitState === "submitting"}>{submitState === "submitting" ? "Submitting securely..." : "Submit and view results"}</button>
    </div>;
    return null;
  };

  const embedded = context === "embed";

  return <section className={`${styles.shell} ${context === "inline" ? styles.inline : ""} ${embedded ? styles.embed : ""}`} aria-labelledby={embedded ? undefined : "quote-heading"} aria-label={embedded ? "Health insurance comparison" : undefined}>
    {!embedded && mockMode && <div className={styles.previewBanner} role="status">Non-production preview - no details are sent</div>}
    {!embedded && <header className={styles.header}><span className={styles.wordmark} aria-label="Money.com.au">money<span>.com.au</span></span><span className={styles.secureNote}>Quick, simple and secure</span></header>}
    {!embedded && <div className={styles.hero}><p className={styles.eyebrow}>Compare health insurance</p><h1 id="quote-heading">Let&apos;s find cover that fits</h1><p>Answer a few simple questions. It only takes a couple of minutes.</p></div>}
    <div className={styles.progressRow}><span>Compare now</span><span>Step {stepIndex + 1} of {steps.length}</span></div><div className={styles.progressTrack} aria-hidden="true"><span style={{ width: `${percentage}%` }} /></div>
    <form className={styles.card} onSubmit={(event) => event.preventDefault()} noValidate>
      {stepIndex > 0 && submitState !== "success" && <button type="button" className={styles.smallBack} onClick={goBack} disabled={submitState === "submitting"}>← Back</button>}
      <fieldset disabled={submitState === "submitting"}><legend ref={headingRef} tabIndex={-1}>{step.title}</legend>{step.hint && <p className={styles.hint}>{step.hint}</p>}{content()}</fieldset>
      <div className={styles.errorRegion} aria-live="polite">{error && <p className={styles.errorBox}>{error}</p>}</div>
    </form>
    {!embedded && <footer className={styles.footer}>Money.com.au does not compare all providers or products in the market. Product availability changes from time to time.</footer>}
  </section>;
}
