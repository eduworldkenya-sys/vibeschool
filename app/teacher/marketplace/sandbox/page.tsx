import type { Metadata } from "next";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import VacancyMatchSandbox from "./VacancyMatchSandbox";

export const metadata: Metadata = {
  title: "TSC Recruitment Guide | VibeSchool Teacher Marketplace",
  description: "Explore 2026 TSC teaching vacancies by county and level, check minimum requirements, and use the official application portal.",
  robots: { index: false, follow: false },
};

export default function TeacherMarketplaceSandboxPage() {
  return (
    <div>
      <PublicHeader product="Teacher Marketplace" />
      <main id="main-content">
        <VacancyMatchSandbox />
      </main>
      <PublicFooter />
    </div>
  );
}
