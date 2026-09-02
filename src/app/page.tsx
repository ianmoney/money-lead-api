import { redirect } from "next/navigation";

export default function Home() {
  redirect("/health-insurance/quote");
}
