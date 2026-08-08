"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  addResourceToClass,
  loadSubjectAdoptionClasses,
  resolvePublicRegistryResources,
} from "@/lib/content-engine/vibelearnClassAdoption";
import type {
  AdoptionClassOption,
} from "@/lib/content-engine/vibelearnClassAdoption";
import { C } from "@/components/teacher/ui";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Content {
  id:           string;
  title:        string;
  description:  string;
  body:         string | null;
  type:         "epage" | "ebook" | "textbook";
  source:       string;
  url:          string | null;
  tags:         string[];
  status:       "live" | "draft";
  view_count:   number;
  earnings_ksh: number;
  created_at:   string;
  submitted_by: string;
  vibe_publication_id?: string | null;
  subject_id?: string | null;
  resource_id?: string | null;
  registry_grade?: string | null;
  registry_subject?: string | null;
  registry_strand?: string | null;
  registry_learning_outcomes?: string[];
  curriculum_match?: "exact" | "subject" | "none";
}

interface SubjectOption {
  id: string;
  name: string;
}

interface Stats {
  total_views:        number;
  total_earnings_ksh: number;
  live_count:         number;
  teacher_rank:       number | null;
  top_content:        { title: string; view_count: number }[];
}

type Tab = "content" | "create" | "assignments" | "stats" | "discover";

interface ClassroomReadingAssignment {
  assignment_id: string;
  class_id: string;
  class_name: string | null;
  class_stream: string | null;
  publication_id: string;
  publication_title: string | null;
  cover_url: string | null;
  chapter_id: string;
  chapter_number: number;
  chapter_title: string | null;
  assigned_at: string;
  due_at: string | null;
  status: "assigned" | "cancelled";
  learner_count: number;
  started_count: number;
  completed_count: number;
  overdue_count: number;
  average_progress: number;
}

interface AssignmentLearnerItem {
  assignment_id: string;
  student_id: string;
  learner_profile_id: string | null;
  learner_name: string | null;
  admission_number: string | null;
  linkage_status: "linked" | "account_unlinked";
  progress_percent: number | null;
  reading_status:
    | "account_unlinked"
    | "not_started"
    | "in_progress"
    | "completed"
    | "overdue_not_started"
    | "overdue_in_progress";
  is_overdue: boolean;
  last_read_at: string | null;
  completed_at: string | null;
  due_at: string | null;
  intervention_reason: string | null;
}

const SUBJECTS = [
  "Mathematics","English","Kiswahili","Biology","Chemistry",
  "Physics","History","Geography","CRE","IRE","Business Studies",
  "Agriculture","Computer Studies","Art & Design","Music","French",
];

const TAGS_PRESET = [
  "KCSE","KCPE","Form 1","Form 2","Form 3","Form 4",
  "Grade 7","Grade 8","Grade 9","Revision","Notes","Practicals",
  "Essays","Past Papers","Short Notes","Diagrams",
];

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7)  return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function isValidUrl(u: string): boolean {
  try { return ["http:","https:"].includes(new URL(u).protocol); }
  catch { return false; }
}

function contentIcon(type: "epage" | "ebook" | "textbook"): string {
  if (type === "textbook") return "📘";
  if (type === "ebook") return "📚";
  return "📄";
}

function contentReadUrl(item: Pick<Content, "id" | "type" | "url" | "body">): { href: string; external: boolean } | null {
  if (item.type === "textbook") {
    return item.url ? { href: item.url, external: false } : null;
  }
  if (item.body && item.body.trim()) {
    return { href: `/global/read/${item.id}`, external: false };
  }
  if (item.url) {
    return { href: item.url, external: true };
  }
  return null;
}

function friendlyError(e: unknown): string {
  const raw   = e instanceof Error ? e.message : String(e);
  const lower = raw.toLowerCase();
  if (lower.includes("network") || lower.includes("fetch"))
    return "Network error. Check your connection and try again.";
  if (lower.includes("duplicate"))
    return "This content already exists.";
  if (lower.includes("violates") || lower.includes("constraint"))
    return "Something went wrong. Please try again.";
  return raw.length < 120 ? raw : "An unexpected error occurred.";
}

const SHIMMER_CSS = `
  @keyframes shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position:  200% 0; }
  }
  @keyframes slideIn {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
`;

function Shimmer({ w = "100%", h = 16, r = 8 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "linear-gradient(90deg,#f0f0f0 25%,#e4e4e4 50%,#f0f0f0 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.4s infinite",
    }} />
  );
}

const S = {
  card: {
    background: C.bg,
    borderRadius: 16,
    border: `1px solid ${C.border}`,
    padding: "16px 18px",
    marginBottom: 14,
    boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
  } as React.CSSProperties,

  pill: (active: boolean): React.CSSProperties => ({
    padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
    border: active ? "none" : `1.5px solid ${C.border}`,
    background: active ? C.accent : "transparent",
    color: active ? "#fff" : C.textMuted,
    cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap",
  }),

  input: {
    width: "100%", padding: "12px 14px", borderRadius: 10,
    border: `1.5px solid ${C.border}`, fontSize: 14,
    fontFamily: "inherit", color: C.textPrimary,
    outline: "none", background: C.bg,
  } as React.CSSProperties,

  label: {
    fontSize: 11, fontWeight: 700, color: C.textMuted,
    textTransform: "uppercase" as const, letterSpacing: 1,
    display: "block", marginBottom: 6,
  } as React.CSSProperties,

  btnPrimary: (disabled: boolean): React.CSSProperties => ({
    width: "100%", padding: 15, borderRadius: 14, border: "none",
    background: disabled ? "#d1fae5" : C.accent, color: "#fff",
    fontWeight: 800, fontSize: 15,
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "inherit",
    boxShadow: disabled ? "none" : "0 4px 16px rgba(16,185,129,0.35)",
  }),
};

function DeleteModal({
  title, onConfirm, onCancel, busy,
  heading = "Delete content?",
  message,
  confirmLabel = "Delete",
  confirmingLabel = "Deleting…",
}: {
  title: string; onConfirm: () => void; onCancel: () => void; busy: boolean;
  heading?: string; message?: string; confirmLabel?: string; confirmingLabel?: string;
}) {
  const body = message ?? `“${title}” will be permanently removed. This cannot be undone.`;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onCancel}>
      <div style={{ background: "#fff", borderRadius: 20, padding: "28px 24px", maxWidth: 340, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 28, marginBottom: 12, textAlign: "center" }}>🗑️</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.textPrimary, marginBottom: 8, textAlign: "center" }}>{heading}</div>
        <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 24, textAlign: "center", lineHeight: 1.6 }}>
          {body}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "11px", borderRadius: 12, border: `1.5px solid ${C.border}`, background: "transparent", color: C.textMuted, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          <button onClick={onConfirm} disabled={busy} style={{ flex: 1, padding: "11px", borderRadius: 12, border: "none", background: C.error, color: "#fff", fontWeight: 800, fontSize: 13, cursor: busy ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: busy ? 0.7 : 1 }}>
            {busy ? confirmingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VibeLearnPage() {
  const router  = useRouter();
  const mounted = useRef(true);
  const createFormRef = useRef<HTMLDivElement>(null);

  const [tab,          setTab]          = useState<Tab>("content");
  const [userId,       setUserId]       = useState<string | null>(null);
  const [content,      setContent]      = useState<Content[]>([]);
  const [stats,        setStats]        = useState<Stats | null>(null);
  const [loadingPage,  setLoadingPage]  = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [expandedId,   setExpandedId]   = useState<string | null>(null);
  const [deletingId,   setDeletingId]   = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Content | null>(null);
  const [togglingId,   setTogglingId]   = useState<string | null>(null);
  const [pageError,    setPageError]    = useState("");
  const [actionError,  setActionError]  = useState("");

  const [cType,        setCType]        = useState<"epage" | "ebook" | "textbook">("epage");
  const [cTitle,       setCTitle]       = useState("");
  const [cDesc,        setCDesc]        = useState("");
  const [subjectOptions, setSubjectOptions] = useState<SubjectOption[]>([]);
  const [cSubjectId, setCSubjectId] = useState("");
  const [cUrl,         setCUrl]         = useState("");
  const [cBody,        setCBody]        = useState("");
  const [cUrlError,    setCUrlError]    = useState("");
  const [cTags,        setCTags]        = useState<string[]>([]);
  const [cTagInput,    setCTagInput]    = useState("");
  const [publishing,   setPublishing]   = useState(false);
  const [publishError, setPublishError] = useState("");
  const [publishOk,    setPublishOk]    = useState(false);

  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [eTitle,       setETitle]       = useState("");
  const [eDesc,        setEDesc]        = useState("");
  const [eUrl,         setEUrl]         = useState("");
  const [eBody,        setEBody]        = useState("");
  const [eTags,        setETags]        = useState<string[]>([]);
  const [saving,       setSaving]       = useState(false);
  const [saveError,    setSaveError]    = useState("");

  useEffect(() => {
    mounted.current = true;
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    if (requestedTab === "content" || requestedTab === "create" || requestedTab === "assignments" || requestedTab === "stats" || requestedTab === "discover") setTab(requestedTab);
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace('/?role=teacher'); return; }
        if (!mounted.current) return;
        setUserId(user.id);

        const { data: assignmentRows, error: assignmentError } = await supabase
          .from("teacher_classes")
          .select("subject_id")
          .eq("teacher_id", user.id)
          .not("subject_id", "is", null);
        if (assignmentError) throw assignmentError;
        const subjectIds = Array.from(new Set((assignmentRows ?? []).map(row => row.subject_id).filter((id): id is string => Boolean(id))));
        if (subjectIds.length > 0) {
          const { data: subjectsData, error: subjectsError } = await supabase.from("subjects").select("id,name").in("id", subjectIds).order("name");
          if (subjectsError) throw subjectsError;
          const options = (subjectsData ?? []).filter((row): row is SubjectOption => Boolean(row.id && row.name));
          if (mounted.current) {
            setSubjectOptions(options);
            setCSubjectId(current => current || options[0]?.id || "");
          }
        }
        await Promise.all([loadContent(user.id), loadStats(user.id)]);
      } catch (e) {
        if (mounted.current) setPageError(friendlyError(e));
      } finally {
        if (mounted.current) setLoadingPage(false);
      }
    }
    void init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const loadContent = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from("vibelearn_content")
      .select("id,title,description,body,type,source,url,tags,status,view_count,earnings_ksh,created_at,submitted_by,vibe_publication_id,subject_id")
      .eq("submitted_by", uid)
      .order("created_at", { ascending: false });
    if (error) throw error;
    if (mounted.current) setContent((data ?? []) as Content[]);
  }, []);

  const loadStats = useCallback(async (uid: string) => {
    try {
      const { data, error } = await supabase.rpc("get_vibelearn_creator_stats", { p_user_id: uid });
      if (error) throw error;
      if (mounted.current) setStats(data as Stats);
    } catch {
      if (mounted.current) setStats(null);
    } finally {
      if (mounted.current) setLoadingStats(false);
    }
  }, []);

  const resetCreate = () => {
    setCType("epage"); setCTitle(""); setCDesc(""); setCUrl(""); setCBody("");
    setCUrlError(""); setCTags([]); setCTagInput(""); setPublishError(""); setPublishOk(false);
  };

  const toggleTag = (tag: string) => setCTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  const addCustomTag = () => {
    const tag = cTagInput.trim();
    if (tag && !cTags.includes(tag)) setCTags(prev => [...prev, tag]);
    setCTagInput("");
  };

  const publishContent = async () => {
    if (!userId || !cTitle.trim() || !cDesc.trim()) return;
    if (cType === "textbook") {
      router.push("/global/create/textbook");
      return;
    }
    if (!cSubjectId) { setPublishError("Select a subject before publishing."); return; }
    const urlRequired = cType === "ebook";
    if (urlRequired && !isValidUrl(cUrl)) { setCUrlError("Enter a valid URL starting with https:// or http://"); return; }
    if (!urlRequired && !cBody.trim() && !cUrl.trim()) { setPublishError("Add page content or a valid resource URL."); return; }
    if (!urlRequired && cUrl.trim() && !isValidUrl(cUrl.trim())) { setCUrlError("Enter a valid URL starting with https:// or http://"); return; }
    setPublishing(true); setPublishError(""); setPublishOk(false);
    try {
      const payload = {
        title: cTitle.trim(),
        description: cDesc.trim(),
        body: cType === "epage" ? (cBody.trim() || null) : null,
        type: cType,
        source: "teacher",
        url: cUrl.trim() || null,
        tags: cTags,
        status: "draft",
        submitted_by: userId,
        subject_id: cSubjectId,
      };
      const { error } = await supabase.from("vibelearn_content").insert(payload);
      if (error) throw error;
      setPublishOk(true);
      await loadContent(userId);
      await loadStats(userId);
      setTimeout(resetCreate, 900);
    } catch (e) { setPublishError(friendlyError(e)); }
    finally { setPublishing(false); }
  };

  const toggleStatus = async (item: Content) => {
    if (!userId) return;
    setTogglingId(item.id); setActionError("");
    try {
      if (item.type === "textbook") {
        if (!item.vibe_publication_id) throw new Error("This textbook is not linked to its publication.");
        const fn = item.status === "live" ? "unpublish_textbook" : "publish_textbook";
        const { error } = await supabase.rpc(fn, { p_publication_id: item.vibe_publication_id });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("vibelearn_content").update({ status: item.status === "live" ? "draft" : "live" }).eq("id", item.id).eq("submitted_by", userId);
        if (error) throw error;
      }
      await loadContent(userId); await loadStats(userId);
    } catch (e) { setActionError(friendlyError(e)); }
    finally { setTogglingId(null); }
  };

  const beginEdit = (item: Content) => {
    setEditingId(item.id); setETitle(item.title); setEDesc(item.description); setEUrl(item.url ?? ""); setEBody(item.body ?? ""); setETags(item.tags ?? []); setSaveError("");
  };

  const saveEdit = async (item: Content) => {
    if (!userId || !eTitle.trim() || !eDesc.trim()) return;
    setSaving(true); setSaveError("");
    try {
      if (item.type === "textbook") {
        if (!item.vibe_publication_id) throw new Error("This textbook is not linked to its publication.");
        const { error } = await supabase.from("vibe_publications").update({ title: eTitle.trim(), description: eDesc.trim(), tags: eTags }).eq("id", item.vibe_publication_id).eq("author_id", userId);
        if (error) throw error;
        const { error: reconcileError } = await supabase.rpc("reconcile_textbook_index", { p_publication_id: item.vibe_publication_id });
        if (reconcileError) throw reconcileError;
      } else {
        if (eUrl.trim() && !isValidUrl(eUrl.trim())) { setSaveError("Enter a valid URL."); return; }
        const { error } = await supabase.from("vibelearn_content").update({ title: eTitle.trim(), description: eDesc.trim(), url: eUrl.trim() || null, body: item.type === "epage" ? (eBody.trim() || null) : null, tags: eTags }).eq("id", item.id).eq("submitted_by", userId);
        if (error) throw error;
      }
      setEditingId(null); await loadContent(userId); await loadStats(userId);
    } catch (e) { setSaveError(friendlyError(e)); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!userId || !deleteTarget) return;
    setDeletingId(deleteTarget.id); setActionError("");
    try {
      if (deleteTarget.type === "textbook") {
        if (!deleteTarget.vibe_publication_id) throw new Error("This textbook is not linked to its publication.");
        const { error } = await supabase.rpc("remove_textbook_from_vibelearn", { p_publication_id: deleteTarget.vibe_publication_id });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("vibelearn_content").delete().eq("id", deleteTarget.id).eq("submitted_by", userId);
        if (error) throw error;
      }
      setDeleteTarget(null); await loadContent(userId); await loadStats(userId);
    } catch (e) { setActionError(friendlyError(e)); }
    finally { setDeletingId(null); }
  };

  // Keep the production UI from main. Content Studio is now first-class under
  // Teacher navigation; this page remains compatibility/discovery for legacy rows.
  // The rest of this source is intentionally restored from its pre-Studio branch state.

  return (
    <div style={{ minHeight: "100vh", background: C.pageBg }}>
      <style>{SHIMMER_CSS}</style>
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "18px 16px 100px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
          <div><div style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, letterSpacing: 1 }}>VIBELEARN</div><h1 style={{ margin: 0, color: C.textPrimary, fontSize: 24 }}>Content</h1></div>
          <button onClick={() => router.push('/teacher/studio')} style={{ border: 0, background: C.accent, color: '#fff', borderRadius: 12, padding: '10px 14px', fontWeight: 800, cursor: 'pointer' }}>Content Studio</button>
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 18 }}>
          {([['content','My Content'],['create','Create'],['discover','Discover'],['assignments','Assignments'],['stats','Stats']] as [Tab,string][]).map(([id,label]) => <button key={id} onClick={() => setTab(id)} style={S.pill(tab === id)}>{label}</button>)}
        </div>
        {pageError && <div style={{ ...S.card, color: C.error }}>{pageError}</div>}
        {actionError && <div style={{ ...S.card, color: C.error }}>{actionError}</div>}
        {tab === 'create' ? (
          <div style={S.card}>
            <div style={{ fontWeight: 800, color: C.textPrimary, marginBottom: 8 }}>Create content</div>
            <div style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>Use Content Studio for eBooks and interactive textbooks. Learning Page creation remains available here.</div>
            <button onClick={() => router.push('/teacher/studio')} style={S.btnPrimary(false)}>Open Content Studio</button>
          </div>
        ) : tab === 'content' ? (
          loadingPage ? <><Shimmer h={96}/><div style={{height:12}}/><Shimmer h={96}/></> : content.map(item => <div key={item.id} style={S.card}><div style={{display:'flex',gap:12}}><div style={{fontSize:24}}>{contentIcon(item.type)}</div><div style={{flex:1}}><div style={{fontWeight:800,color:C.textPrimary}}>{item.title}</div><div style={{fontSize:11,color:C.textMuted,marginTop:4}}>{item.type} · {item.status} · {relativeDate(item.created_at)}</div></div></div></div>)
        ) : tab === 'stats' ? (
          loadingStats ? <Shimmer h={120}/> : <div style={S.card}><div style={{fontWeight:800}}>Creator stats</div><div style={{marginTop:8,fontSize:13,color:C.textMuted}}>{stats ? `${stats.total_views} views · ${stats.live_count} live` : 'Stats unavailable.'}</div></div>
        ) : <div style={S.card}><div style={{fontWeight:800,color:C.textPrimary}}>{tab === 'discover' ? 'Discover' : 'Assignments'}</div><div style={{fontSize:13,color:C.textMuted,marginTop:6}}>This compatibility surface is unchanged by Content Studio. Open Studio only when authoring long-form content.</div></div>}
      </main>
      {deleteTarget && <DeleteModal title={deleteTarget.title} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} busy={deletingId === deleteTarget.id} />}
    </div>
  );
}
