"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Avatar } from "@/components/teacher/ui";
import TwinDrawer from "@/components/teacher/TwinDrawer";

import OfflineBar from "@/components/teacher/OfflineBar";
import "@/components/teacher/teacher-workspace.css";
import "@/components/teacher/studio.css";
import TeacherNavigation from "@/components/teacher/TeacherNavigation";
import { ArrowLeft, ChevronDown, MessageSquare, Wallet, Sparkles } from "lucide-react";
import Link from "next/link";
import { ToastContext, UserContext, CreditContext } from "@/components/teacher/TeacherUiContext";

function activeTeacherSchoolName(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const activeSchoolId = Reflect.get(value, "active_school_id");
  const schools = Reflect.get(value, "schools");
  if (typeof activeSchoolId !== "string" || !Array.isArray(schools)) return "";
  for (const school of schools) {
    if (!school || typeof school !== "object") continue;
    if (Reflect.get(school, "id") !== activeSchoolId) continue;
    const name = Reflect.get(school, "name");
    return typeof name === "string" ? name : "";
  }
  return "";
}

function TwinPill({ onOpen, unread }: { onOpen: () => void; unread: number }) {
  const [pos, setPos] = useState<{x:number;y:number}|null>(null)
  const start = useRef({x:0,y:0,px:0,py:0})
  const dragging = useRef(false)
  const moved = useRef(false)
  useEffect(() => {
    const reset = () => setPos({x:window.innerWidth-68,y:window.innerHeight-152})
    reset(); window.addEventListener("resize",reset)
    return () => window.removeEventListener("resize",reset)
  },[])
  if (!pos) return null
  return <div role="button" tabIndex={0} aria-label={unread ? `Open Twin, ${unread} unread updates` : "Open Twin"} className="teacher-twin-launcher"
    style={{left:pos.x,top:pos.y}}
    onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();onOpen()}}}
    onPointerDown={event=>{dragging.current=true;moved.current=false;start.current={x:event.clientX,y:event.clientY,px:pos.x,py:pos.y};event.currentTarget.setPointerCapture(event.pointerId);event.preventDefault()}}
    onPointerMove={event=>{if(!dragging.current)return;const dx=event.clientX-start.current.x,dy=event.clientY-start.current.y;if(Math.abs(dx)>4||Math.abs(dy)>4)moved.current=true;setPos({x:Math.min(Math.max(start.current.px+dx,12),window.innerWidth-60),y:Math.min(Math.max(start.current.py+dy,72),window.innerHeight-136)})}}
    onPointerCancel={()=>{dragging.current=false;moved.current=true}}
    onPointerUp={()=>{dragging.current=false;if(!moved.current)onOpen()}}>
    <Sparkles size={21} aria-hidden="true"/>{unread>0&&<span className="teacher-counter">{unread>9?"9+":unread}</span>}
  </div>
}

function TopBar({ school, initials, unreadConnect, creditBalance, creditsLoading }: { school: string; initials: string; unreadConnect: number; creditBalance: number | null; creditsLoading: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const isRoot = pathname === "/teacher" || pathname === "/teacher/" || pathname.startsWith("/teacher/pulse");

  return <header className="teacher-topbar">
    <div className="teacher-topbar__identity">
      {!isRoot && <button type="button" onClick={() => router.back()} className="teacher-icon-button" aria-label="Go back"><ArrowLeft size={20}/></button>}
      <Link href="/teacher/pulse" className="teacher-brand-mark" aria-label="VibeSchool Today">V</Link>
      <Link href="/teacher/profile" className="teacher-topbar__school" aria-label={`School context: ${school || "Independent"}`}>
        <small>Teacher workspace</small><strong>{school || "Independent"} <ChevronDown size={12} aria-hidden="true" style={{display:"inline"}}/></strong>
      </Link>
    </div>
    <div className="teacher-topbar__actions">
      <Link href="/teacher/vibeconnect" className="teacher-icon-button" aria-label={`VibeConnect${unreadConnect ? `, ${unreadConnect} unread messages` : ""}`}><MessageSquare size={20}/>{unreadConnect > 0 && <span className="teacher-counter">{unreadConnect > 9 ? "9+" : unreadConnect}</span>}</Link>
      <Link href="/teacher/credits" className="teacher-topbar__credit" aria-label={`Credits: ${creditBalance ?? (creditsLoading ? "loading" : "balance unavailable")}`} title={creditBalance === null && !creditsLoading ? "Balance unavailable. Open credits to retry." : "View credits"}><Wallet size={18}/><span>{creditBalance ?? (creditsLoading ? "…" : "—")}</span></Link>
      <Avatar initials={initials || "…"} size={44} ariaLabel="Open teacher profile" onClick={() => router.push("/teacher/profile")} />
    </div>
  </header>;
}

function Toast({ msg }: { msg: string }) { return <div role="status" aria-live="polite" className="teacher-toast">{msg}</div> }

function SearchParamWatcher({ onTwin }: { onTwin: () => void }) {
  const searchParams = useSearchParams();
  useEffect(() => { if (searchParams?.get("twin") === "1") onTwin(); }, [searchParams, onTwin]);
  return null;
}

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [twinOpen, setTwinOpen] = useState(false);
  const [twinUnread, setTwinUnread] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [school, setSchool] = useState("");
  const [initials, setInitials] = useState("");
  const [fullName, setFullName] = useState("");
  const [unreadConnect, setUnreadConnect] = useState(0);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const teacherIdRef = useRef<string | null>(null);

  const refreshCredits = useCallback(() => {
    const uid = teacherIdRef.current;
    if (!uid) return;
    setCreditsLoading(true);
    supabase.rpc("get_credit_balance", { p_teacher_id: uid }).then(({ data: creditData }) => {
      const result = creditData as { success?: boolean; balance?: number } | null;
      if (result?.success) setCreditBalance(result.balance ?? null);
      setCreditsLoading(false);
    }, () => { setCreditsLoading(false); });
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }, []);

  useEffect(() => {
    let cancelled = false

    async function bootstrapShell() {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (cancelled) return
      if (authError || !user) {
        router.replace("/?role=teacher")
        return
      }

      // Session is the only hard gate for rendering the Teacher OS shell.
      // Every page/RPC retains its own server/RLS authority checks.
      teacherIdRef.current = user.id
      setAuthReady(true)

      // Profile, active school and credits are shell enrichment. They must never
      // hold navigation behind a full-screen loader.
      void (async () => {
        try {
          const [schoolContextRes, profileRes] = await Promise.all([
            supabase.rpc("get_my_teacher_school_context"),
            supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
          ])
          if (cancelled) return
          if (schoolContextRes.error) throw schoolContextRes.error

          const name = profileRes.data?.full_name ?? ""
          setFullName(name)
          const parts = name.trim().split(" ").filter(Boolean)
          setInitials(parts.slice(0, 2).map((w: string) => w[0].toUpperCase()).join(""))

          setSchool(activeTeacherSchoolName(schoolContextRes.data))
        } catch (error) {
          console.error("Teacher shell enrichment failed:", error)
        }
      })()

      refreshCredits()
    }

    void bootstrapShell()
    return () => { cancelled = true }
  }, [refreshCredits, router]);

  // Onboarding routes are already server-authorized by middleware and must not be
  // blocked by the full Teacher OS bootstrap. A brand-new teacher may not yet
  // have the teacher_profile/school bindings that the operational shell expects.
  const isOnboardingPath = pathname?.startsWith("/teacher/onboarding") ?? false;
  if (isOnboardingPath) return <div className="teacher-light-surface" style={{ minHeight: "100vh", background: "var(--teacher-canvas, #f5f6f2)", color: "var(--teacher-ink, #1c2923)" }}>{children}</div>;

  if (!authReady) return <div className="teacher-shell teacher-boot" role="status" aria-live="polite"><span className="teacher-brand-mark">V</span><p>Opening your teacher workspace…</p><div className="teacher-boot__skeleton" aria-hidden="true"><div className="teacher-skeleton"/><div className="teacher-skeleton"/><div className="teacher-skeleton"/></div></div>;

  return (
    <ToastContext.Provider value={{ showToast }}>
      <UserContext.Provider value={{ fullName, initials, school }}>
        <CreditContext.Provider value={{ creditBalance, refreshCredits }}>
          <div className="teacher-shell"><a href="#teacher-main" className="teacher-skip-link">Skip to workspace</a>
          <OfflineBar />
          <Suspense fallback={null}><SearchParamWatcher onTwin={() => setTwinOpen(true)} /></Suspense>
          <TopBar school={school} initials={initials} unreadConnect={unreadConnect} creditBalance={creditBalance} creditsLoading={creditsLoading} />
          <main id="teacher-main" data-studio-view={/^\/teacher\/classhub\/[^/]+\/student\/[^/]+\/?$/.test(pathname ?? "") ? "learner" : pathname === "/teacher/assessment" ? "assessment" : undefined} tabIndex={-1} className="teacher-content teacher-light-surface">{children}</main>
          <TwinPill onOpen={() => setTwinOpen(true)} unread={twinUnread} />
          <TeacherNavigation />
          <TwinDrawer open={twinOpen} onClose={() => setTwinOpen(false)} />
          {toast && <Toast msg={toast} />}
          </div>
        </CreditContext.Provider>
      </UserContext.Provider>
    </ToastContext.Provider>
  );
}
