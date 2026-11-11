import type { Metadata } from "next";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import VacancyMatchSandbox from "./VacancyMatchSandbox";

export const metadata: Metadata = {
  title: "TSC Vacancy Matching Sandbox | VibeSchool Teacher Marketplace",
  description: "Try a safe demo of the VibeSchool Teacher Marketplace vacancy matcher. Example records only; applications are made through the official TSC portal.",
  robots: { index: false, follow: false },
};

export default function TeacherMarketplaceSandboxPage() {
  return (
    <div>
      <PublicHeader product="Teacher Marketplace Sandbox" />
      <main id="main-content">
        <VacancyMatchSandbox />
      </main>
      <PublicFooter />
    </div>
  );
}
