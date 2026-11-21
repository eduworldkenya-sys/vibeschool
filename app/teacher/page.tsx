import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import PremiumTeacherMarketplace from "@/components/teacher/marketplace/PremiumTeacherMarketplace";
import TeacherExperiencePreview from "./TeacherExperiencePreview";
import TeacherOpportunities from "@/components/teacher/marketplace/TeacherOpportunities";

export const metadata: Metadata = {
  title: "For Teachers | VibeSchool",
  description: "Find teaching opportunities, online tuition and station swaps, or hire teachers through VibeSchool.",
};

export default function TeacherGateway() {
  return (
    <>
      <PublicHeader product="Teachers" />
      <main id="main-content" tabIndex={-1}>
        <PremiumTeacherMarketplace />
        <section aria-label="Teacher OS and additional services" style={{maxWidth:1080,margin:"0 auto",padding:"0 20px 32px",color:"CanvasText",background:"Canvas"}}>
          <details>
            <summary style={{cursor:"pointer",fontWeight:700,fontSize:13,minHeight:44,padding:"13px 0"}}>Teacher OS and additional services</summary>
            <p style={{padding:"12px 0"}}><Link href="/teacher/pulse" style={{fontWeight:700,textDecoration:"underline"}}>Open Teacher OS</Link></p>
            <TeacherExperiencePreview />
            <TeacherOpportunities />
          </details>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
