import type { Metadata } from "next";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import PremiumTeacherMarketplace from "@/components/teacher/marketplace/PremiumTeacherMarketplace";
import TeacherOpportunities from "@/components/teacher/marketplace/TeacherOpportunities";

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
        <section aria-label="Additional recruitment services" style={{maxWidth:1080, margin:"0 auto", padding:"0 20px 32px",color:"CanvasText",background:"Canvas"}}>
          <details>
            <summary style={{cursor:"pointer",minHeight:44,padding:"13px 0",fontWeight:700,fontSize:13}}>Additional recruitment details</summary>
            <TeacherOpportunities />
          </details>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
