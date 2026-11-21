import type { Metadata } from "next";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import PremiumTeacherMarketplace from "@/components/teacher/marketplace/PremiumTeacherMarketplace";

export const metadata: Metadata = {
  title: "Teacher Marketplace | VibeSchool",
  description: "Find teaching opportunities, online tuition requests and station swaps, or recruit teachers for your school in Kenya.",
  alternates: { canonical: "/teacher/marketplace" },
};

export default function PublicTeacherMarketplace() {
  return (
    <>
      <PublicHeader product="Teacher Marketplace" />
      <main id="main-content" tabIndex={-1}>
        <PremiumTeacherMarketplace />
      </main>
      <PublicFooter />
    </>
  );
}
