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

// ── Helpers ───────────────────────────────────────────────────────────────────
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

// Shared across the Content tab list and DiscoverTab — previously each
// had its own `item.type === "ebook" ? "📚" : "📄"` check, which silently
// put every textbook row under the generic epage icon.
function contentIcon(type: "epage" | "ebook" | "textbook"): string {
  if (type === "textbook") return "📘";
  if (type === "ebook") return "📚";
  return "📄";
}

// Destination for a content card's read/open action. Textbook rows keep
// using their canonical url (already set correctly by the lifecycle
// RPCs). Native epage/ebook rows with a body go to the native reader
// (/global/read/[id] — already supports rendering body via
// ScrollSurface, not new). Legacy url-only rows keep opening externally.
// Returns null when there's genuinely nothing to open.
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

// ── Shimmer skeleton ──────────────────────────────────────────────────────────
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

// ── Static style objects (outside render — never recreated) ───────────────────
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

// ── Delete confirmation modal ─────────────────────────────────────────────────
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

// ── Main component ────────────────────────────────────────────────────────────
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

  // Create form
  const [cType,        setCType]        = useState<"epage" | "ebook" | "textbook">("epage");
  const [cTitle,       setCTitle]       = useState("");
  const [cDesc,        setCDesc]        = useState("");
  const [subjectOptions, setSubjectOptions] =
    useState<SubjectOption[]>([]);
  const [cSubjectId, setCSubjectId] =
    useState("");
  const [cUrl,         setCUrl]         = useState("");
  const [cBody,        setCBody]        = useState("");
  const [cUrlError,    setCUrlError]    = useState("");
  const [cTags,        setCTags]        = useState<string[]>([]);
  const [cTagInput,    setCTagInput]    = useState("");
  const [publishing,   setPublishing]   = useState(false);
  const [publishError, setPublishError] = useState("");
  const [publishOk,    setPublishOk]    = useState(false);

  // Edit form
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

    const requestedTab =
      new URLSearchParams(
        window.location.search
      ).get("tab");

    if (
      requestedTab === "content" ||
      requestedTab === "create" ||
      requestedTab === "assignments" ||
      requestedTab === "stats" ||
      requestedTab === "discover"
    ) {
      setTab(requestedTab);
    }

    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace('/?role=teacher'); return; }
        if (!mounted.current) return;
        setUserId(user.id);

        const { data: assignmentRows, error: assignmentError } =
          await supabase
            .from("teacher_classes")
            .select("subject_id")
            .eq("teacher_id", user.id)
            .not("subject_id", "is", null);

        if (assignmentError) throw assignmentError;

        const subjectIds = Array.from(
          new Set(
            (assignmentRows ?? [])
              .map(row => row.subject_id)
              .filter(
                (subjectId): subjectId is string =>
                  typeof subjectId === "string" &&
                  subjectId.length > 0
              )
          )
        );

        if (subjectIds.length > 0) {
          const { data: subjectRows, error: subjectError } =
            await supabase
              .from("subjects")
              .select("id,name")
              .in("id", subjectIds)
              .order("name");

          if (subjectError) throw subjectError;

          const nextSubjects =
            (subjectRows ?? [])
              .filter(row =>
                typeof row.id === "string" &&
                typeof row.name === "string"
              )
              .map(row => ({
                id: row.id,
                name: row.name,
              }));

          if (mounted.current) {
            setSubjectOptions(nextSubjects);
            setCSubjectId(
              current => current ||
                nextSubjects[0]?.id || ""
            );
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
    setLoadingStats(true);
    try {
      const { data, error } = await supabase
        .from("vibelearn_content")
        .select("title,view_count,earnings_ksh,status")
        .eq("submitted_by", uid);
      if (error) throw error;
      const rows = data ?? [];
      const sorted = [...rows].sort((a,b) => (b.view_count ?? 0) - (a.view_count ?? 0));
      if (mounted.current) setStats({
        total_views: rows.reduce((s,r) => s + (r.view_count ?? 0), 0),
        total_earnings_ksh: rows.reduce((s,r) => s + Number(r.earnings_ksh ?? 0), 0),
        live_count: rows.filter(r => r.status === "live").length,
        teacher_rank: null,
        top_content: sorted.slice(0,5).map(r => ({ title: r.title, view_count: r.view_count ?? 0 })),
      });
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
    const t = cTagInput.trim();
    if (t && !cTags.includes(t)) setCTags(prev => [...prev, t]);
    setCTagInput("");
  };

  const handlePublish = async () => {
    if (!userId || !cTitle.trim() || !cDesc.trim() || !cSubjectId) return;
    setPublishError(""); setCUrlError(""); setPublishOk(false);

    if (cType === "textbook") {
      router.push("/teacher/studio/editor?format=vibetextbook");
      return;
    }

    if (cType === "ebook") {
      router.push("/teacher/studio/editor?format=ebook");
      return;
    }

    const trimmedUrl = cUrl.trim();
    const trimmedBody = cBody.trim();
    if (trimmedUrl && !isValidUrl(trimmedUrl)) {
      setCUrlError("Enter a valid https:// or http:// URL.");
      return;
    }
    if (!trimmedBody && !trimmedUrl) {
      setPublishError("Add page content or a resource link.");
      return;
    }

    setPublishing(true);
    try {
      const { error } = await supabase.from("vibelearn_content").insert({
        submitted_by: userId,
        title: cTitle.trim(), description: cDesc.trim(),
        body: trimmedBody || null,
        type: cType, source: "teacher",
        url: trimmedUrl || null, tags: cTags,
        status: "draft",
        subject_id: cSubjectId,
      });
      if (error) throw error;
      setPublishOk(true);
      resetCreate();
      setPublishOk(true);
      await Promise.all([loadContent(userId), loadStats(userId)]);
      setTimeout(() => setPublishOk(false), 3500);
    } catch (e) {
      setPublishError(friendlyError(e));
    } finally { setPublishing(false); }
  };

  const toggleStatus = async (item: Content) => {
    if (togglingId) return;
    setTogglingId(item.id); setActionError("");
    const next = item.status === "live" ? "draft" : "live";
    try {
      if (item.type === "textbook") {
        if (!item.vibe_publication_id) throw new Error("This textbook is not linked to its publication.");
        const fn = next === "live" ? "publish_publication" : "unpublish_publication";
        const { error } = await supabase.rpc(fn, { p_publication_id: item.vibe_publication_id });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("vibelearn_content").update({ status: next }).eq("id", item.id);
        if (error) throw error;
      }
      if (userId) await Promise.all([loadContent(userId), loadStats(userId)]);
    } catch (e) { setActionError(friendlyError(e)); }
    finally { setTogglingId(null); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deletingId) return;
    setDeletingId(deleteTarget.id); setActionError("");
    try {
      if (deleteTarget.type === "textbook") {
        if (!deleteTarget.vibe_publication_id) throw new Error("This textbook is not linked to its publication.");
        const { error } = await supabase.rpc("remove_textbook_from_vibelearn", { p_publication_id: deleteTarget.vibe_publication_id });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("vibelearn_content").delete().eq("id", deleteTarget.id);
        if (error) throw error;
      }
      setDeleteTarget(null);
      if (userId) await Promise.all([loadContent(userId), loadStats(userId)]);
    } catch (e) { setActionError(friendlyError(e)); }
    finally { setDeletingId(null); }
  };

  const startEdit = (item: Content) => {
    setEditingId(item.id); setETitle(item.title); setEDesc(item.description);
    setEUrl(item.url ?? ""); setEBody(item.body ?? ""); setETags(item.tags ?? []); setSaveError("");
  };

  const saveEdit = async () => {
    if (!editingId || saving) return;
    const item = content.find(c => c.id === editingId);
    if (!item) return;
    if (!eTitle.trim() || !eDesc.trim()) { setSaveError("Title and description are required."); return; }
    if (item.type !== "textbook" && eUrl.trim() && !isValidUrl(eUrl.trim())) { setSaveError("Enter a valid URL."); return; }
    setSaving(true); setSaveError("");
    try {
      if (item.type === "textbook") {
        if (!item.vibe_publication_id) throw new Error("This textbook is not linked to its publication.");
        const { error } = await supabase.from("vibe_publications")
          .update({ title: eTitle.trim(), description: eDesc.trim(), tags: eTags })
          .eq("id", item.vibe_publication_id);
        if (error) throw error;
        const { error: reconcileError } = await supabase.rpc("reconcile_textbook_index", { p_publication_id: item.vibe_publication_id });
        if (reconcileError) throw reconcileError;
      } else {
        const { error } = await supabase.from("vibelearn_content").update({
          title: eTitle.trim(), description: eDesc.trim(), url: eUrl.trim(),
          body: eBody.trim() || null,
          tags: eTags,
        }).eq("id", editingId);
        if (error) throw error;
      }
      setEditingId(null);
      if (userId) await Promise.all([loadContent(userId), loadStats(userId)]);
    } catch (e) { setSaveError(friendlyError(e)); }
    finally { setSaving(false); }
  };

  const handleOpen = (item: Content) => {
    const dest = contentReadUrl(item);
    if (!dest) return;
    if (dest.external) window.open(dest.href, "_blank", "noopener,noreferrer");
    else router.push(dest.href);
  };

  const addEditTag = (tag: string) => setETags(prev => prev.includes(tag) ? prev : [...prev, tag]);

  // ── Sub-components ─────────────────────────────────────────────────────────
  function ContentTab() {
    if (loadingPage) return <div>{[0,1,2].map(i => <div key={i} style={{ ...S.card, display: "flex", gap: 14 }}><Shimmer w={44} h={44} r={12}/><div style={{ flex:1 }}><Shimmer w="55%" h={14}/><div style={{height:8}}/><Shimmer w="85%" h={11}/></div></div>)}</div>;
    if (!content.length) return <div style={{ ...S.card, textAlign:"center", padding:"40px 20px" }}><div style={{fontSize:32, marginBottom:10}}>📚</div><div style={{fontWeight:800,color:C.textPrimary}}>No content yet</div><div style={{fontSize:12,color:C.textMuted,marginTop:5}}>Create a learning page here, or use Content Studio for an eBook or interactive textbook.</div><button onClick={()=>setTab("create")} style={{marginTop:16,padding:"10px 18px",borderRadius:10,border:"none",background:C.accent,color:"#fff",fontWeight:700,cursor:"pointer"}}>Create content</button></div>;

    return <div>{content.map(item => {
      const expanded = expandedId === item.id;
      const editing = editingId === item.id;
      const openable = contentReadUrl(item) !== null;
      return <div key={item.id} style={S.card}>
        <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
          <div style={{fontSize:26,width:42,height:42,borderRadius:12,background:"#f3f4f6",display:"grid",placeItems:"center",flexShrink:0}}>{contentIcon(item.type)}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:14,fontWeight:800,color:C.textPrimary,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.title}</div>
            <div style={{fontSize:11,color:C.textMuted,marginTop:3}}>{item.type.toUpperCase()} · {relativeDate(item.created_at)} · {item.view_count ?? 0} views</div>
            <div style={{marginTop:8,display:"flex",gap:6,flexWrap:"wrap"}}>{item.tags?.slice(0,4).map(t=><span key={t} style={{fontSize:9,padding:"2px 7px",borderRadius:8,background:"#f3f4f6",color:C.textMuted}}>{t}</span>)}</div>
          </div>
          <span style={{fontSize:10,fontWeight:800,padding:"4px 8px",borderRadius:10,background:item.status==="live"?"#dcfce7":"#fef3c7",color:item.status==="live"?"#166534":"#92400e"}}>{item.status.toUpperCase()}</span>
        </div>
        <div style={{display:"flex",gap:8,marginTop:13}}>
          <button disabled={!openable} onClick={()=>handleOpen(item)} style={{...S.pill(false),opacity:openable?1:.45}}>Open</button>
          <button onClick={()=>setExpandedId(expanded?null:item.id)} style={S.pill(false)}>{expanded?"Close":"Manage"}</button>
        </div>
        {expanded && !editing && <div style={{borderTop:`1px solid ${C.border}`,marginTop:13,paddingTop:13,display:"flex",gap:8,flexWrap:"wrap"}}>
          <button onClick={()=>toggleStatus(item)} disabled={togglingId===item.id} style={S.pill(false)}>{togglingId===item.id?"Saving…":item.status==="live"?"Unpublish":"Publish"}</button>
          <button onClick={()=>startEdit(item)} style={S.pill(false)}>Edit</button>
          <button onClick={()=>setDeleteTarget(item)} style={{...S.pill(false),color:C.error}}>{item.type==="textbook"?"Remove from VibeLearn":"Delete"}</button>
        </div>}
        {expanded && editing && <div style={{borderTop:`1px solid ${C.border}`,marginTop:13,paddingTop:13}}>
          <label style={S.label}>Title</label><input value={eTitle} onChange={e=>setETitle(e.target.value)} style={{...S.input,marginBottom:10}}/>
          <label style={S.label}>Description</label><textarea value={eDesc} onChange={e=>setEDesc(e.target.value)} rows={3} style={{...S.input,resize:"vertical",marginBottom:10}}/>
          {item.type!=="textbook" && <><label style={S.label}>URL</label><input value={eUrl} onChange={e=>setEUrl(e.target.value)} style={{...S.input,marginBottom:10}}/><label style={S.label}>Body</label><textarea value={eBody} onChange={e=>setEBody(e.target.value)} rows={6} style={{...S.input,resize:"vertical",marginBottom:10}}/></>}
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>{TAGS_PRESET.slice(0,12).map(t=><button key={t} onClick={()=>addEditTag(t)} style={S.pill(eTags.includes(t))}>{t}</button>)}</div>
          {saveError && <div style={{fontSize:11,color:C.error,marginBottom:8}}>{saveError}</div>}
          <div style={{display:"flex",gap:8}}><button onClick={saveEdit} disabled={saving} style={{...S.pill(true),flex:1}}>{saving?"Saving…":"Save"}</button><button onClick={()=>setEditingId(null)} style={{...S.pill(false),flex:1}}>Cancel</button></div>
        </div>}
      </div>;
    })}</div>;
  }

  function CreateTab() {
    return <div style={{ animation: "slideIn .22s ease" }}>
      <div style={{ ...S.card, padding: "18px" }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Choose what to create</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { id: "epage" as const, icon: "📄", title: "Learning Page", desc: "Notes, revision material, activities or a lesson resource." },
            { id: "ebook" as const, icon: "📚", title: "eBook", desc: "Structured chapters, rich media and revision history in Content Studio.", badge: "Content Studio" },
            { id: "textbook" as const, icon: "📘", title: "Interactive Textbook", desc: "Curriculum-linked units, outcomes, diagrams, activities and publishing controls.", badge: "Content Studio" },
          ].map(opt => {
            const isLongForm = opt.id === "ebook" || opt.id === "textbook";
            const isSelected = cType === opt.id && !isLongForm;
            return (
              <button
                key={opt.id}
                onClick={() => {
                  if (opt.id === "ebook") { router.push("/teacher/studio/editor?format=ebook"); return; }
                  if (opt.id === "textbook") { router.push("/teacher/studio/editor?format=vibetextbook"); return; }
                  setCType(opt.id);
                  requestAnimationFrame(() => {
                    createFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  });
                }}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 12, textAlign: "left",
                  padding: "14px 16px", borderRadius: 14, cursor: "pointer", fontFamily: "inherit",
                  border: isSelected ? `1.5px solid ${C.accent}` : `1.5px solid ${C.border}`,
                  background: isSelected ? "#f0fdfa" : "#fff",
                }}
              >
                <div style={{ fontSize: 22, flexShrink: 0 }}>{opt.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: C.textPrimary }}>{opt.title}</div>
                    {isSelected ? (
                      <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#d1fae5", color: "#065f46", textTransform: "uppercase", letterSpacing: 0.5 }}>Selected</span>
                    ) : opt.badge ? (
                      <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#ede9fe", color: "#6d28d9", textTransform: "uppercase", letterSpacing: 0.5 }}>{opt.badge}</span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginTop: 3, lineHeight: 1.5 }}>{opt.desc}</div>
                </div>
                <div style={{ fontSize: 16, color: isSelected ? C.accent : C.textMuted, fontWeight: 800, flexShrink: 0, alignSelf: "center" }}>
                  {isLongForm ? "→" : (isSelected ? "✓" : "→")}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div ref={createFormRef} style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0 16px", paddingTop: 4 }}>
        <div style={{ height: 1, flex: "0 0 16px", background: C.border }} />
        <p style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, margin: 0, whiteSpace: "nowrap" }}>
          Learning Page Details
        </p>
        <div style={{ height: 1, flex: 1, background: C.border }} />
      </div>

      {[
        { id: "vl-title", label: "Title *", value: cTitle, setter: setCTitle, placeholder: "e.g. Quadratic Equations — Form 3", type: "input" },
        { id: "vl-desc", label: "Description *", value: cDesc, setter: setCDesc, placeholder: "What will students learn?", type: "textarea" },
      ].map(f => <div key={f.id} style={{marginBottom:14}}><label htmlFor={f.id} style={S.label}>{f.label}</label>{f.type==="textarea"?<textarea id={f.id} value={f.value} onChange={e=>f.setter(e.target.value)} placeholder={f.placeholder} rows={3} style={{...S.input,resize:"none",lineHeight:1.6}}/>:<input id={f.id} value={f.value} onChange={e=>f.setter(e.target.value)} placeholder={f.placeholder} style={S.input}/>}</div>)}

      <div style={{marginBottom:14}}><label htmlFor="vl-subject" style={S.label}>Subject *</label><select id="vl-subject" value={cSubjectId} onChange={e=>setCSubjectId(e.target.value)} style={S.input}><option value="">Select subject</option>{subjectOptions.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
      <div style={{marginBottom:14}}><label htmlFor="vl-body" style={S.label}>Page content</label><textarea id="vl-body" value={cBody} onChange={e=>setCBody(e.target.value)} placeholder="Write the learning content here…" rows={8} style={{...S.input,resize:"vertical",lineHeight:1.65}}/></div>
      <div style={{marginBottom:14}}><label htmlFor="vl-url" style={S.label}>Resource link (optional)</label><input id="vl-url" value={cUrl} onChange={e=>{setCUrl(e.target.value);setCUrlError("")}} placeholder="https://…" style={S.input}/>{cUrlError&&<div style={{fontSize:11,color:C.error,marginTop:5}}>{cUrlError}</div>}</div>
      <div style={{marginBottom:14}}><label style={S.label}>Tags</label><div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>{TAGS_PRESET.map(t=><button key={t} onClick={()=>toggleTag(t)} style={S.pill(cTags.includes(t))}>{t}</button>)}</div><div style={{display:"flex",gap:7}}><input value={cTagInput} onChange={e=>setCTagInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addCustomTag()}}} placeholder="Custom tag" style={{...S.input,flex:1}}/><button onClick={addCustomTag} style={S.pill(false)}>Add</button></div></div>
      {publishError&&<div style={{fontSize:11,color:C.error,marginBottom:8}}>{publishError}</div>}{publishOk&&<div style={{fontSize:11,color:C.accent,marginBottom:8,fontWeight:700}}>Saved as draft.</div>}
      <button onClick={handlePublish} disabled={publishing||!cTitle.trim()||!cDesc.trim()||!cSubjectId} style={S.btnPrimary(publishing||!cTitle.trim()||!cDesc.trim()||!cSubjectId)}>{publishing?"Saving…":"Save Learning Page Draft"}</button>
    </div>;
  }

  function StatsTab() {
    if (loadingStats) return <div style={S.card}><Shimmer h={18} w="35%"/><div style={{height:14}}/><Shimmer h={60}/></div>;
    if (!stats) return <div style={S.card}>Stats unavailable.</div>;
    return <div><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:9,marginBottom:14}}>{[["Views",stats.total_views],["Live",stats.live_count],["KES",stats.total_earnings_ksh]].map(([l,v])=><div key={String(l)} style={{...S.card,marginBottom:0,textAlign:"center",padding:14}}><div style={{fontSize:19,fontWeight:900,color:C.textPrimary}}>{v}</div><div style={{fontSize:9,color:C.textMuted,textTransform:"uppercase",letterSpacing:.8,marginTop:3}}>{l}</div></div>)}</div>{stats.top_content.length>0&&<div style={S.card}><div style={{fontSize:12,fontWeight:800,marginBottom:10}}>Top content</div>{stats.top_content.map((r,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"7px 0",borderBottom:i<stats.top_content.length-1?`1px solid ${C.border}`:"none"}}><span>{r.title}</span><span style={{color:C.textMuted}}>{r.view_count} views</span></div>)}</div>}</div>;
  }

  function DiscoverTab() {
    const [items,setItems]=useState<Content[]>([]); const [loading,setLoading]=useState(true); const [adopting,setAdopting]=useState<string|null>(null); const [classes,setClasses]=useState<AdoptionClassOption[]>([]); const [selectedClass,setSelectedClass]=useState(""); const [selectedSubject,setSelectedSubject]=useState(""); const [msg,setMsg]=useState("");
    useEffect(()=>{let alive=true;(async()=>{try{const [{data,error},opts]=await Promise.all([supabase.from("vibelearn_content").select("id,title,description,body,type,source,url,tags,status,view_count,earnings_ksh,created_at,submitted_by,vibe_publication_id,subject_id").eq("status","live").order("view_count",{ascending:false}).limit(30),loadSubjectAdoptionClasses()]);if(error)throw error;if(alive){setItems((data??[]) as Content[]);setClasses(opts);if(opts[0]){setSelectedClass(opts[0].class_id);setSelectedSubject(opts[0].subject_id)}}}catch{}finally{if(alive)setLoading(false)}})();return()=>{alive=false}},[]);
    const adopt=async(item:Content)=>{if(!selectedClass||!selectedSubject)return;setAdopting(item.id);setMsg("");try{const resources=await resolvePublicRegistryResources([item]);const resource=resources.get(item.id);if(!resource)throw new Error("This content is not available as a reusable learning resource yet.");await addResourceToClass({resourceId:resource.resource_id,classId:selectedClass,subjectId:selectedSubject});setMsg("Added to class library.")}catch(e){setMsg(friendlyError(e))}finally{setAdopting(null)}};
    if(loading)return <Shimmer h={120}/>;
    return <div>{classes.length>0&&<div style={S.card}><label style={S.label}>Adopt into class</label><select value={`${selectedClass}|${selectedSubject}`} onChange={e=>{const[c,s]=e.target.value.split("|");setSelectedClass(c);setSelectedSubject(s)}} style={S.input}>{classes.map(c=><option key={`${c.class_id}-${c.subject_id}`} value={`${c.class_id}|${c.subject_id}`}>{c.class_name} · {c.subject_name}</option>)}</select>{msg&&<div style={{fontSize:11,marginTop:7,color:C.textMuted}}>{msg}</div>}</div>}{items.map(item=><div key={item.id} style={S.card}><div style={{display:"flex",gap:10}}><div style={{fontSize:24}}>{contentIcon(item.type)}</div><div style={{flex:1}}><div style={{fontSize:14,fontWeight:800}}>{item.title}</div><div style={{fontSize:11,color:C.textMuted,marginTop:3}}>{item.description}</div></div></div><div style={{display:"flex",gap:8,marginTop:12}}><button onClick={()=>handleOpen(item)} disabled={!contentReadUrl(item)} style={S.pill(false)}>Open</button>{classes.length>0&&<button onClick={()=>adopt(item)} disabled={adopting===item.id} style={S.pill(false)}>{adopting===item.id?"Adding…":"Add to class"}</button>}</div></div>)}</div>;
  }

  function AssignmentsTab() {
    const [rows,setRows]=useState<ClassroomReadingAssignment[]>([]); const [loading,setLoading]=useState(true); const [openId,setOpenId]=useState<string|null>(null); const [learners,setLearners]=useState<AssignmentLearnerItem[]>([]); const [learnersLoading,setLearnersLoading]=useState(false);
    useEffect(()=>{let alive=true;(async()=>{try{const{data,error}=await supabase.rpc("get_my_classroom_reading_assignments");if(error)throw error;if(alive)setRows((data??[]) as ClassroomReadingAssignment[])}catch{}finally{if(alive)setLoading(false)}})();return()=>{alive=false}},[]);
    const toggle=async(id:string)=>{if(openId===id){setOpenId(null);setLearners([]);return}setOpenId(id);setLearnersLoading(true);try{const{data,error}=await supabase.rpc("get_classroom_reading_assignment_learners",{assignment_id_input:id});if(error)throw error;setLearners((data??[]) as AssignmentLearnerItem[])}catch{setLearners([])}finally{setLearnersLoading(false)}};
    if(loading)return <Shimmer h={120}/>; if(!rows.length)return <div style={S.card}>No reading assignments yet.</div>;
    return <div>{rows.map(r=><div key={r.assignment_id} style={S.card}><div style={{fontSize:14,fontWeight:800}}>{r.publication_title||"Assigned reading"}</div><div style={{fontSize:11,color:C.textMuted,marginTop:3}}>{r.class_name}{r.class_stream?` · ${r.class_stream}`:""} · {r.chapter_title||`Chapter ${r.chapter_number}`}</div><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginTop:11}}>{[["Learners",r.learner_count],["Started",r.started_count],["Done",r.completed_count]].map(([l,v])=><div key={String(l)} style={{background:"#f9fafb",borderRadius:9,padding:8,textAlign:"center"}}><div style={{fontWeight:800}}>{v}</div><div style={{fontSize:9,color:C.textMuted}}>{l}</div></div>)}</div><button onClick={()=>toggle(r.assignment_id)} style={{...S.pill(false),marginTop:10}}>{openId===r.assignment_id?"Hide learners":"Learners"}</button>{openId===r.assignment_id&&(learnersLoading?<div style={{marginTop:10}}><Shimmer h={50}/></div>:<div style={{marginTop:10}}>{learners.map(l=><div key={l.student_id} style={{fontSize:11,padding:"7px 0",borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between"}}><span>{l.learner_name||l.admission_number||"Learner"}</span><span style={{color:C.textMuted}}>{l.reading_status.replaceAll("_"," ")}{l.progress_percent!=null?` · ${l.progress_percent}%`:""}</span></div>)}</div>)}</div>)}</div>;
  }

  return (
    <div style={{minHeight:"100vh",background:"#f8fafc",paddingBottom:90}}>
      <style>{SHIMMER_CSS}</style>
      <header style={{padding:"20px 18px 12px",background:"#fff",borderBottom:`1px solid ${C.border}`}}><div style={{maxWidth:700,margin:"0 auto"}}><div style={{fontSize:22,fontWeight:900,color:C.textPrimary}}>VibeLearn</div><div style={{fontSize:11,color:C.textMuted,marginTop:3}}>Create, discover and assign learning content.</div></div></header>
      <main style={{maxWidth:700,margin:"0 auto",padding:"14px 14px 40px"}}>
        <div style={{display:"flex",gap:7,overflowX:"auto",paddingBottom:4,marginBottom:14}}>{([['content','My content'],['create','Create'],['discover','Discover'],['assignments','Assignments'],['stats','Stats']] as [Tab,string][]).map(([id,label])=><button key={id} onClick={()=>setTab(id)} style={S.pill(tab===id)}>{label}</button>)}</div>
        {pageError&&<div style={{...S.card,color:C.error,fontSize:12}}>{pageError}</div>}{actionError&&<div style={{...S.card,color:C.error,fontSize:12}}>{actionError}</div>}
        {tab==="content"&&<ContentTab/>}{tab==="create"&&<CreateTab/>}{tab==="discover"&&<DiscoverTab/>}{tab==="assignments"&&<AssignmentsTab/>}{tab==="stats"&&<StatsTab/>}
      </main>
      {deleteTarget&&<DeleteModal title={deleteTarget.title} busy={deletingId===deleteTarget.id} onCancel={()=>setDeleteTarget(null)} onConfirm={confirmDelete} heading={deleteTarget.type==="textbook"?"Remove from VibeLearn?":"Delete content?"} message={deleteTarget.type==="textbook"?"The authoritative publication remains in Content Studio. This removes only its VibeLearn listing.":undefined} confirmLabel={deleteTarget.type==="textbook"?"Remove":"Delete"} confirmingLabel={deleteTarget.type==="textbook"?"Removing…":"Deleting…"}/>} 
    </div>
  );
}
