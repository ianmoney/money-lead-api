"use client";

import { useEffect, useRef, useState } from "react";
import { captureAttribution, trackQuoteEvent, type Attribution } from "./analytics";
import { checkVerification, isMockMode, QuoteApiError, startVerification, submitLead } from "./api";
import { coverForOptions, coverTypeOptions, initialAnswers, providerOptions, stateOptions, steps, type LeadAnswers } from "./schema";
import { normalizeAustralianMobile, validateStep } from "./validation";
import styles from "./HealthQuoteForm.module.css";

type Context = "fullPage" | "inline" | "embed";
type OtpState = "idle" | "sending" | "sent" | "checking" | "submitting" | "error" | "success";

const consentVersion = process.env.NEXT_PUBLIC_CONSENT_VERSION?.trim() || "";
const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || "";
const privacyUrl = "https://www.money.com.au/privacy-policy";
const termsUrl = "https://www.money.com.au/terms-of-use";
const thankYouUrl = "https://www.money.com.au/health-insurance/health-thank-you";
const decades = Array.from({ length: 7 }, (_, index) => 1940 + index * 10);

declare global {
  interface Window {
    turnstile?: { render: (node: HTMLElement, options: { sitekey: string; callback: (token: string) => void; "expired-callback": () => void; "error-callback": () => void }) => string; reset: (id: string) => void; remove: (id: string) => void };
  }
}

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
  const [otpState, setOtpState] = useState<OtpState>("idle");
  const [otpCode, setOtpCode] = useState("");
  const [verificationId, setVerificationId] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [resendAfter, setResendAfter] = useState(0);
  const attribution = useRef<Attribution | null>(null);
  const started = useRef(false);
  const converted = useRef(false);
  const submissionId = useRef("");
  const headingRef = useRef<HTMLLegendElement>(null);
  const turnstileNode = useRef<HTMLDivElement>(null);
  const turnstileWidgetId = useRef("");
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
  useEffect(() => {
    if (resendAfter <= 0) return;
    const timer = window.setInterval(() => setResendAfter((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendAfter]);
  useEffect(() => {
    if (!["contact", "verification"].includes(step.id) || mockMode || !turnstileSiteKey || !turnstileNode.current) return;
    let cancelled = false;
    const render = () => {
      if (cancelled || !window.turnstile || !turnstileNode.current || turnstileWidgetId.current) return;
      turnstileWidgetId.current = window.turnstile.render(turnstileNode.current, { sitekey: turnstileSiteKey, callback: setTurnstileToken, "expired-callback": () => setTurnstileToken(""), "error-callback": () => setTurnstileToken("") });
    };
    const existing = document.querySelector<HTMLScriptElement>('script[data-money-turnstile="true"]');
    if (existing) { if (window.turnstile) render(); else existing.addEventListener("load", render, { once: true }); }
    else { const script = document.createElement("script"); script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; script.async = true; script.defer = true; script.dataset.moneyTurnstile = "true"; script.addEventListener("load", render, { once: true }); document.head.appendChild(script); }
    return () => { cancelled = true; if (turnstileWidgetId.current && window.turnstile) { window.turnstile.remove(turnstileWidgetId.current); turnstileWidgetId.current = ""; } };
  }, [mockMode, step.id]);

  const noteStart = () => {
    if (!started.current) { started.current = true; trackQuoteEvent("quote_start", { context, funnel_version: "health-v1" }); }
  };

  const update = <K extends keyof LeadAnswers>(key: K, value: LeadAnswers[K]) => {
    setAnswers((current) => ({ ...current, [key]: value }));
    if (key === "phone") { setVerificationId(""); setOtpState("idle"); setOtpCode(""); }
    setError(""); noteStart();
  };

  const chooseAndAdvance = <K extends keyof LeadAnswers>(key: K, value: LeadAnswers[K]) => {
    setAnswers((current) => ({ ...current, [key]: value }));
    setError(""); noteStart();
    trackQuoteEvent("quote_step_complete", { step_id: step.id, step_index: stepIndex + 1, context });
    window.setTimeout(() => setStepIndex((index) => Math.min(steps.length - 1, index + 1)), 90);
  };

  const goBack = () => {
    if (["sending", "checking", "submitting", "success"].includes(otpState)) return;
    if (step.id === "birth_year" && selectedDecade !== null) { setSelectedDecade(null); setError(""); return; }
    setError(""); setOtpState("idle"); setOtpCode(""); setStepIndex((index) => Math.max(0, index - 1));
  };

  const requestOtp = async (isResend = false) => {
    const contactError = validateStep("contact", answers);
    if (contactError) { setError(contactError); trackQuoteEvent("quote_validation_error", { step_id: "contact", error_code: "INVALID_CONTACT" }); return; }
    if (!answers.consentAccepted) { setError("Accept the Privacy Policy and Terms of Use before requesting a code."); return; }
    if (!mockMode && (!consentVersion || !turnstileSiteKey)) { setError("Online quotes are temporarily unavailable while required verification configuration is completed."); return; }
    setOtpState("sending"); setError("");
    try {
      const result = await startVerification(answers.phone, mockMode ? "mock-turnstile" : turnstileToken);
      setVerificationId(result.verification_id); setResendAfter(result.resend_after); setOtpState("sent");
      if (!isResend) { trackQuoteEvent("quote_step_complete", { step_id: "contact", step_index: 6, context }); setStepIndex(6); }
      trackQuoteEvent("phone_otp_requested", { context });
      if (!mockMode) { setTurnstileToken(""); if (turnstileWidgetId.current) window.turnstile?.reset(turnstileWidgetId.current); }
    } catch (caught) { setOtpState("error"); setError(caught instanceof QuoteApiError ? caught.message : "We could not send the code. Please try again."); }
  };

  const verifyAndSubmit = async () => {
    if (!/^\d{6}$/.test(otpCode)) { setError("Enter the complete six-digit code from the SMS."); return; }
    setOtpState("checking"); setError("");
    try {
      const verification = await checkVerification(verificationId, otpCode);
      trackQuoteEvent("phone_otp_verified", { context }); setOtpState("submitting");
      if (!submissionId.current) submissionId.current = crypto.randomUUID();
      trackQuoteEvent("lead_submit_started", { event_id: submissionId.current });
      const result = await submitLead({ submissionId: submissionId.current, verificationToken: verification.verification_token, answers, attribution: attribution.current || captureAttribution(), consentVersion: mockMode ? "DEMO-NOT-CONSENT" : consentVersion });
      setOtpState("success");
      if (!converted.current) { converted.current = true; trackQuoteEvent("lead_submit_succeeded", { event_id: result.submission_id }); }
      if (!mockMode) {
        if (context === "embed" && window.parent !== window) window.parent.postMessage({ type: "money-health-quote:complete", url: thankYouUrl }, "*");
        else window.location.assign(thankYouUrl);
      }
    } catch (caught) {
      const apiError = caught instanceof QuoteApiError ? caught : new QuoteApiError("REQUEST_FAILED", "We could not complete that request. Please try again.");
      setOtpState(["OTP_INVALID", "OTP_EXPIRED", "TRY_LATER"].includes(apiError.code) ? "sent" : "error"); setError(apiError.message);
      if (!apiError.code.startsWith("OTP_")) trackQuoteEvent("lead_submit_failed", { event_id: submissionId.current || "not-created", safe_error_code: apiError.code });
    }
  };

  const currentYear = new Date().getFullYear();
  const years = selectedDecade === null ? [] : Array.from({ length: Math.min(10, currentYear - selectedDecade + 1) }, (_, index) => String(selectedDecade + index)).reverse();

  const content = () => {
    if (step.id === "current_health_fund") return <ChoiceGrid name={step.id} value={answers.current_health_fund} options={providerOptions} onChange={(value) => chooseAndAdvance("current_health_fund", value)} />;
    if (step.id === "cover_for") return <ChoiceGrid name={step.id} value={answers.cover_for} options={coverForOptions} onChange={(value) => chooseAndAdvance("cover_for", value)} />;
    if (step.id === "cover_type") return <ChoiceGrid name={step.id} value={answers.cover_type} options={coverTypeOptions} onChange={(value) => chooseAndAdvance("cover_type", value)} />;
    if (step.id === "state") return <ChoiceGrid name={step.id} value={answers.state} options={stateOptions} onChange={(value) => chooseAndAdvance("state", value)} />;
    if (step.id === "birth_year") return selectedDecade === null
      ? <ChoiceGrid name="birth_decade" value="" options={decades.map((decade) => `${decade}s`)} onChange={(value) => { setSelectedDecade(Number(value.slice(0, 4))); setError(""); }} />
      : <><button type="button" className={styles.decadeBack} onClick={() => setSelectedDecade(null)}>← Choose another decade</button><ChoiceGrid name="birth_year" value={answers.birth_year} options={years} onChange={(value) => chooseAndAdvance("birth_year", value)} /></>;
    if (step.id === "contact") return <div className={styles.fields}>
      <div className={styles.nameRow}><label><span>First name</span><input name="first_name" autoComplete="given-name" value={answers.first_name} maxLength={80} onChange={(e) => update("first_name", e.target.value)} /></label><label><span>Last name</span><input name="last_name" autoComplete="family-name" value={answers.last_name} maxLength={80} onChange={(e) => update("last_name", e.target.value)} /></label></div>
      <label><span>Email address</span><input name="email" type="email" inputMode="email" autoComplete="email" value={answers.email} maxLength={160} onChange={(e) => update("email", e.target.value)} /></label>
      <label><span>Australian mobile number</span><input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0412 345 678" value={answers.phone} maxLength={18} onChange={(e) => update("phone", e.target.value)} /><small>We&apos;ll send a one-time code to verify your mobile number.</small></label>
      <div className={styles.consent}><input id="consent_accepted" name="consent_accepted" type="checkbox" checked={answers.consentAccepted} onChange={(e) => update("consentAccepted", e.target.checked)} /><label htmlFor="consent_accepted">I agree to the <a href={privacyUrl} target="_blank" rel="noreferrer">Privacy Policy</a> and <a href={termsUrl} target="_blank" rel="noreferrer">Terms of Use</a>.</label></div>
      {!mockMode && <div ref={turnstileNode} className={styles.turnstile} aria-label="Security check" />}
      <button type="button" className={styles.sendButton} onClick={() => requestOtp(false)} disabled={otpState === "sending"}>{otpState === "sending" ? "Sending code..." : "Send verification code"}</button>
    </div>;
    return <div className={styles.verification}>
      <div className={styles.phoneSummary}><span>Code sent to</span><strong>{normalizeAustralianMobile(answers.phone) || answers.phone}</strong><button type="button" onClick={() => { setStepIndex(5); setOtpState("idle"); }}>Change number</button></div>
      {otpState === "success" ? <div className={styles.successBox} role="status"><span className={styles.statusIcon}>✓</span><h3>Preview completed</h3><p>The mock service accepted the test journey. No personal details were sent or stored.</p><p className={styles.microcopy}>In production, a successful submission redirects the full page to the Money.com.au thank-you page.</p></div> : <>
        <label className={styles.otpField}><span>Six-digit code</span><input name="otp_code" aria-describedby={mockMode ? "otp-help" : undefined} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} value={otpCode} onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }} placeholder="000000" /></label>
        {mockMode && <p id="otp-help" className={styles.mockHelp}>Preview code: <strong>246810</strong>. Use 000000 for expired or 999999 for rate-limited.</p>}
        {!mockMode && <div ref={turnstileNode} className={styles.turnstile} aria-label="Security check" />}
        <button type="button" className={styles.sendButton} onClick={verifyAndSubmit} disabled={otpState === "checking" || otpState === "submitting"}>{otpState === "checking" ? "Checking code..." : otpState === "submitting" ? "Submitting securely..." : "Verify and submit"}</button>
        <button type="button" className={styles.resendButton} onClick={() => requestOtp(true)} disabled={resendAfter > 0}>{resendAfter > 0 ? `Resend available in ${resendAfter}s` : "Resend code"}</button>
      </>}
    </div>;
  };

  const embedded = context === "embed";

  return <section className={`${styles.shell} ${context === "inline" ? styles.inline : ""} ${embedded ? styles.embed : ""}`} aria-labelledby={embedded ? undefined : "quote-heading"} aria-label={embedded ? "Health insurance comparison" : undefined}>
    {!embedded && mockMode && <div className={styles.previewBanner} role="status">Non-production preview - no details are sent</div>}
    {!embedded && <header className={styles.header}><span className={styles.wordmark} aria-label="Money.com.au">money<span>.com.au</span></span><span className={styles.secureNote}>Quick, simple and secure</span></header>}
    {!embedded && <div className={styles.hero}><p className={styles.eyebrow}>Compare health insurance</p><h1 id="quote-heading">Let&apos;s find cover that fits</h1><p>Answer a few simple questions. It only takes a couple of minutes.</p></div>}
    <div className={styles.progressRow}><span>Compare now</span><span>Step {stepIndex + 1} of {steps.length}</span></div><div className={styles.progressTrack} aria-hidden="true"><span style={{ width: `${percentage}%` }} /></div>
    <form className={styles.card} onSubmit={(event) => event.preventDefault()} noValidate>
      {stepIndex > 0 && otpState !== "success" && <button type="button" className={styles.smallBack} onClick={goBack} disabled={["sending", "checking", "submitting"].includes(otpState)}>← Back</button>}
      <fieldset disabled={otpState === "submitting"}><legend ref={headingRef} tabIndex={-1}>{step.title}</legend>{step.hint && <p className={styles.hint}>{step.hint}</p>}{content()}</fieldset>
      <div className={styles.errorRegion} aria-live="polite">{error && <p className={styles.errorBox}>{error}</p>}</div>
    </form>
    {!embedded && <footer className={styles.footer}>Money.com.au does not compare all providers or products in the market. Product availability changes from time to time.</footer>}
  </section>;
}
