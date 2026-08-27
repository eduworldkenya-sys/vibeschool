import Link from "next/link";
import { TrackedLink } from "@/components/public/TrackedLink";

export const metadata = { title: "Founding Teacher Creators | VibeSchool", description: "Help shape a responsible creator pathway for Kenyan teacher expertise." };

const creatorWhatsApp = "https://wa.me/254728232157?text=" + encodeURIComponent("Hello VibeSchool. I am interested in joining the Founding Teacher Creator programme. My subject/level is: ");

export default function FoundingCreators() {
  return <main style={{ minHeight:"100vh", background:"#f7f8f5", color:"#17211b" }}>
    <div style={{ maxWidth:900, margin:"0 auto", padding:"28px 20px 80px" }}>
      <Link href="/teacher" style={{ color:"#16865b", textDecoration:"none", fontWeight:850 }}>← Teacher home</Link>
      <p style={{ margin:"72px 0 12px", color:"#16865b", fontSize:12, fontWeight:950, letterSpacing:1.3 }}>FOUNDING TEACHER CREATOR PROGRAMME</p>
      <h1 style={{ margin:0, maxWidth:800, fontSize:"clamp(42px,7vw,72px)", lineHeight:1, letterSpacing:"-.05em" }}>Your best teaching should be able to travel further than one classroom.</h1>
      <p style={{ maxWidth:720, margin:"26px 0", color:"#536159", fontSize:20, lineHeight:1.65 }}>Teachers build explanations, questions, revision methods and classroom judgement over years. VibeSchool is developing a governed way to turn that expertise into reusable learning resources.</p>
      <div style={{ background:"#fff", border:"1px solid #e1e6e1", borderRadius:24, padding:28, marginTop:42 }}>
        <h2 style={{ marginTop:0 }}>What founding creators help us prove</h2>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))", gap:16 }}>
          {[['CREATE','Bring one resource or teaching idea worth sharing.'],['QUALITY','Help define what excellent, curriculum-grounded teacher content looks like.'],['PUBLISH','Shape how teacher authorship, attribution and distribution should work.'],['EARN','Help design a fair future earning model before we promise payouts.']].map(([a,b])=><div key={a} style={{ padding:18, background:"#f7f8f5", borderRadius:16 }}><strong style={{ color:"#16865b", fontSize:12 }}>{a}</strong><p style={{ marginBottom:0, lineHeight:1.55 }}>{b}</p></div>)}
        </div>
      </div>
      <div style={{ marginTop:34, padding:28, borderRadius:24, background:"#17211b", color:"white" }}><h2 style={{ marginTop:0 }}>This is not an income promise.</h2><p style={{ color:"#cbd5ce", lineHeight:1.7 }}>The marketplace and creator payout model are still being developed. Founding creators join to shape the system, test contribution workflows and establish the quality standard before commercial earning is opened.</p><div style={{ display:"flex", gap:12, flexWrap:"wrap", marginTop:18 }}><TrackedLink event="public_teacher_creator" href={creatorWhatsApp} external target="_blank" rel="noopener noreferrer" style={{ display:"inline-flex", minHeight:50, alignItems:"center", padding:"0 20px", borderRadius:14, background:"#16865b", color:"white", textDecoration:"none", fontWeight:900 }}>Register interest on WhatsApp →</TrackedLink><Link href="/login?redirect=/teacher/profile" style={{ display:"inline-flex", minHeight:50, alignItems:"center", padding:"0 20px", borderRadius:14, border:"1px solid rgba(255,255,255,.25)", color:"white", textDecoration:"none", fontWeight:900 }}>Join VibeSchool as a teacher →</Link></div></div>
    </div>
  </main>
}
