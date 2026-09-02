import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Compare health insurance | Money.com.au",
  description: "Answer a few simple questions to compare health-insurance options with Money.com.au.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en-AU"><body>{children}</body></html>;
}
