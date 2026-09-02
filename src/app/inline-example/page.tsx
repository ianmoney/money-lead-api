"use client";

import { useEffect, useRef } from "react";
import styles from "./page.module.css";

const thankYouUrl = "https://www.money.com.au/health-insurance/health-thank-you";

export default function InlineExamplePage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const resize = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.type === "money-health-quote:complete" && event.data.url === thankYouUrl) {
        window.location.assign(thankYouUrl);
        return;
      }
      if (event.data?.type !== "money-health-quote:resize") return;
      const height = Number(event.data.height);
      if (Number.isFinite(height)) iframeRef.current.style.height = `${Math.max(560, Math.min(1400, height))}px`;
    };
    window.addEventListener("message", resize);
    return () => window.removeEventListener("message", resize);
  }, []);

  return <main className={styles.page}>
    <article>
      <p className={styles.kicker}>Health insurance</p>
      <h1>Could your current cover be costing you more than it should?</h1>
      <p>This page demonstrates the deployable quote widget inside a real iframe.</p>
    </article>
    <aside aria-label="Health-insurance quote">
      <iframe ref={iframeRef} className={styles.quoteFrame} src="/health-insurance/quote" title="Compare health insurance" loading="eager" />
    </aside>
  </main>;
}
