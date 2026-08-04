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
  const [cSubject,     setCSubject]     = useState(SUBJECTS[0]);
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
        await Promise.all([loadContent(user.id), loadStats(user.id)]);
      } catch {
        if (mounted.current) setPageError("Failed to load. Check your connection.");
      } finally {
        if (mounted.current) setLoadingPage(false);
      }
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadContent = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from("vibelearn_content")
      .select("id,title,description,body,type,source,url,tags,status,view_count,earnings_ksh,created_at,submitted_by,vibe_publication_id")
      .eq("submitted_by", uid)
      .order("created_at", { ascending: false });
    if (!error && data && mounted.current) setContent(data as Content[]);
  }, []);

  const loadStats = useCallback(async (uid: string) => {
    if (mounted.current) setLoadingStats(true);
    try {
      let data: {
        total_views: number | null;
        total_earnings_ksh: number | null;
        live_count: number | null;
        teacher_rank: number | null;
      } | null = null;

      try {
        const { data: statsRow } = await supabase
          .from("vibelearn_teacher_stats")
          .select(
            "total_views,total_earnings_ksh,live_count,teacher_rank"
          )
          .eq("teacher_id", uid)
          .maybeSingle();

        data = statsRow;
      } catch {
        // Stats view may not exist yet — non-fatal.
      }
      const { data: top } = await supabase
        .from("vibelearn_content")
        .select("title,view_count")
        .eq("submitted_by", uid)
        .eq("status", "live")
        .order("view_count", { ascending: false })
        .limit(3);
      if (!mounted.current) return;
      setStats({
        total_views:        data?.total_views        ?? 0,
        total_earnings_ksh: data?.total_earnings_ksh ?? 0,
        live_count:         data?.live_count         ?? 0,
        teacher_rank:       data?.teacher_rank       ?? null,
        top_content:        (top ?? []) as { title: string; view_count: number }[],
      });
    } finally {
      if (mounted.current) setLoadingStats(false);
    }
  }, []);

  // ── Optimistic toggle ───────────────────────────────────────────────────────
  async function toggleStatus(item: Content) {
    if (togglingId) return;
    const next = item.status === "live" ? "draft" : "live";
    setActionError("");
    setTogglingId(item.id);
    // optimistic
    setContent(prev => prev.map(c => c.id === item.id ? { ...c, status: next } : c));
    try {
      if (item.type === "textbook") {
        if (!item.vibe_publication_id) {
          setContent(prev => prev.map(c => c.id === item.id ? { ...c, status: item.status } : c));
          setActionError("This textbook is missing its publication reference. Run reconciliation before changing it.");
          return;
        }
        const result = next === "live"
          ? await supabase.rpc("publish_textbook", { p_publication_id: item.vibe_publication_id })
          : await supabase.rpc("unpublish_textbook", { p_publication_id: item.vibe_publication_id });
        if (result.error) {
          setContent(prev => prev.map(c => c.id === item.id ? { ...c, status: item.status } : c));
          setActionError(friendlyError(result.error));
        } else if (userId) {
          await loadContent(userId);
          loadStats(userId);
        }
      } else {
        const { error } = await supabase
          .from("vibelearn_content")
          .update({ status: next })
          .eq("id", item.id)
          .eq("submitted_by", userId!);
        if (error) {
          setContent(prev => prev.map(c => c.id === item.id ? { ...c, status: item.status } : c));
        } else {
          if (userId) loadStats(userId);
        }
      }
    } finally {
      if (mounted.current) setTogglingId(null);
    }
  }

  // ── Delete (with modal, not window.confirm) ─────────────────────────────────
  async function confirmDelete() {
    if (!deleteTarget || deletingId) return;
    const id = deleteTarget.id;
    setActionError("");
    setDeletingId(id);
    try {
      if (deleteTarget.type === "textbook") {
        if (!deleteTarget.vibe_publication_id) {
          setActionError("This textbook is missing its publication reference. Run reconciliation before changing it.");
          setDeleteTarget(null);
          return;
        }
        const { error } = await supabase.rpc("remove_textbook_from_vibelearn", {
          p_publication_id: deleteTarget.vibe_publication_id,
        });
        if (error) {
          setActionError(friendlyError(error));
        } else if (mounted.current) {
          setExpandedId(null);
          setDeleteTarget(null);
          if (userId) { await loadContent(userId); loadStats(userId); }
        }
      } else {
        const { error } = await supabase
          .from("vibelearn_content")
          .delete()
          .eq("id", id)
          .eq("submitted_by", userId!);
        if (!error && mounted.current) {
          setContent(prev => prev.filter(c => c.id !== id));
          setExpandedId(null);
          setDeleteTarget(null);
          if (userId) loadStats(userId);
        }
      }
    } finally {
      if (mounted.current) setDeletingId(null);
    }
  }

  // ── Save edit ───────────────────────────────────────────────────────────────
  async function saveEdit(id: string) {
    setSaveError("");
    const target = content.find(c => c.id === id);
    const isTextbook = target?.type === "textbook";
    const isEpageForValidation = target?.type === "epage";
    if (!eTitle.trim())                                                    { setSaveError("Title is required."); return; }
    if (target?.type === "ebook" && !eUrl.trim())                          { setSaveError("URL is required."); return; }
    if (!isTextbook && eUrl.trim() && !isValidUrl(eUrl.trim()))            { setSaveError("Enter a valid https:// URL."); return; }
    if (isEpageForValidation && !eBody.trim() && !eUrl.trim())             { setSaveError("Write the learning content or attach an external resource link."); return; }
    setSaving(true);
    try {
      if (isTextbook) {
        if (!target?.vibe_publication_id) throw new Error("Missing publication reference. Run reconciliation before editing this textbook.");
        const { error: pubError } = await supabase
          .from("vibe_publications")
          .update({ title: eTitle.trim(), description: eDesc.trim(), tags: eTags })
          .eq("id", target.vibe_publication_id);
        if (pubError) throw pubError;
        const { error: syncError } = await supabase.rpc("reconcile_textbook_index", {
          p_publication_id: target.vibe_publication_id,
        });
        if (syncError) throw syncError;
        if (!mounted.current) return;
        if (userId) await loadContent(userId);
        setEditingId(null);
      } else {
        const isEpage = target?.type === "epage";
        const bodyValue = isEpage ? (eBody.trim() || null) : (target?.body ?? null);
        const { error } = await supabase
          .from("vibelearn_content")
          .update({ title: eTitle.trim(), description: eDesc.trim(), body: bodyValue, url: eUrl.trim() || null, tags: eTags })
          .eq("id", id)
          .eq("submitted_by", userId!);
        if (error) throw error;
        if (!mounted.current) return;
        setContent(prev => prev.map(c => c.id === id
          ? { ...c, title: eTitle.trim(), description: eDesc.trim(), body: bodyValue, url: eUrl.trim() || null, tags: eTags }
          : c
        ));
        setEditingId(null);
      }
    } catch (e: unknown) {
      if (mounted.current) setSaveError(friendlyError(e));
    } finally {
      if (mounted.current) setSaving(false);
    }
  }

  function startEdit(item: Content) {
    setSaveError("");
    setEditingId(item.id);
    setETitle(item.title);
    setEDesc(item.description ?? "");
    setEUrl(item.url ?? "");
    setEBody(item.body ?? "");
    setETags(item.tags ?? []);
  }

  // ── Save (draft or publish) ────────────────────────────────────────────────
  async function saveContent(targetStatus: "draft" | "live") {
    setPublishError("");
    if (!userId)        { setPublishError("Not authenticated."); return; }
    if (!cTitle.trim()) { setPublishError("Title is required."); return; }
    if (!cDesc.trim())  { setPublishError("Description is required."); return; }

    if (cType === "epage") {
      if (!cBody.trim() && !cUrl.trim()) {
        setPublishError("Write the learning content or attach an external resource link.");
        return;
      }
      if (cUrl.trim() && !isValidUrl(cUrl.trim())) {
        setPublishError("Enter a valid https:// URL.");
        return;
      }
    } else {
      if (!cUrl.trim())             { setPublishError("Content URL is required."); return; }
      if (!isValidUrl(cUrl.trim())) { setPublishError("Enter a valid https:// URL."); return; }
    }

    setPublishing(true);
    try {
      const { error } = await supabase.from("vibelearn_content").insert({
        title:        cTitle.trim(),
        description:  cDesc.trim(),
        body:         cType === "epage" ? (cBody.trim() || null) : null,
        type:         cType,
        source:       cSubject,
        url:          cUrl.trim() || null,
        tags:         cTags,
        status:       targetStatus,
        submitted_by: userId,
        view_count:   0,
        earnings_ksh: 0,
      });
      if (error) throw error;
      if (!mounted.current) return;
      setCTitle(""); setCDesc(""); setCUrl(""); setCBody(""); setCTags([]); setCTagInput(""); setCUrlError("");
      setPublishOk(true);
      setTimeout(() => { if (mounted.current) setPublishOk(false); }, 3000);
      await Promise.all([loadContent(userId), loadStats(userId)]);
      setTab("content");
    } catch (e: unknown) {
      if (mounted.current) setPublishError(friendlyError(e));
    } finally {
      if (mounted.current) setPublishing(false);
    }
  }

  function addTag(t: string, setter: React.Dispatch<React.SetStateAction<string[]>>, current: string[]) {
    const clean = t.trim().slice(0, 30);
    if (!clean || current.includes(clean) || current.length >= 10) return;
    setter(prev => [...prev, clean]);
  }

  const liveCount  = content.filter(c => c.status === "live").length;
  const draftCount = content.filter(c => c.status === "draft").length;

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (loadingPage) return (
    <>
      <style>{SHIMMER_CSS}</style>
      <div style={{ animation: "fadeIn 0.2s ease" }}>
        <div style={{ background: "linear-gradient(135deg,#065f46 0%,#1e1b4b 100%)", borderRadius: 20, padding: 20, marginBottom: 14 }}>
          <Shimmer w={80} h={10} />
          <div style={{ marginTop: 8 }}><Shimmer w={160} h={22} /></div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{ flex: 1, background: "rgba(255,255,255,0.1)", borderRadius: 12, padding: 12 }}>
                <Shimmer w="60%" h={18} />
                <div style={{ marginTop: 6 }}><Shimmer w="80%" h={9} /></div>
              </div>
            ))}
          </div>
        </div>
        <div style={S.card}>{[1,2,3].map(i => <div key={i} style={{ marginBottom: 12 }}><Shimmer h={68} r={12} /></div>)}</div>
      </div>
    </>
  );

  if (pageError) return (
    <div style={{ ...S.card, textAlign: "center", padding: "40px 20px" }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>⚠️</div>
      <div style={{ fontSize: 14, color: C.textMuted }}>{pageError}</div>
      <button onClick={() => window.location.reload()} style={{ marginTop: 16, padding: "10px 20px", borderRadius: 10, border: "none", background: C.accent, color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Retry</button>
    </div>
  );

  return (
    <>
      <style>{SHIMMER_CSS}</style>

      {deleteTarget && (
        <DeleteModal
          title={deleteTarget.title}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
          busy={!!deletingId}
          {...(deleteTarget.type === "textbook" ? {
            heading: "Remove from VibeLearn?",
            message: `The VibeLearn listing for “${deleteTarget.title}” will be removed. The underlying textbook and chapters will not be deleted. Reader access will continue to follow the textbook’s publication status.`,
            confirmLabel: "Remove",
            confirmingLabel: "Removing…",
          } : {})}
        />
      )}

      <div style={{ animation: "slideIn 0.22s ease" }}>

        {/* ── Hero ── */}
        <div style={{ background: "linear-gradient(135deg,#065f46 0%,#1e1b4b 100%)", borderRadius: 20, padding: "18px 20px", marginBottom: 14, color: "#fff", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: "radial-gradient(circle,rgba(16,185,129,0.25),transparent 70%)", pointerEvents: "none" }} />
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 2 }}>VibeLearn</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Publish. Earn. Grow.</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginBottom: 16 }}>Your content earns every time a student reads it.</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { label: "Earnings (KSH)", value: loadingStats ? "…" : `${(stats?.total_earnings_ksh ?? 0).toLocaleString()}`, color: "#6ee7b7" },
              { label: "Total Views",    value: loadingStats ? "…" : `${(stats?.total_views ?? 0).toLocaleString()}`,         color: "#93c5fd" },
              { label: "Live",           value: loadingStats ? "…" : `${stats?.live_count ?? 0}`,                             color: "#fde68a" },
              { label: "Rank",           value: loadingStats ? "…" : stats?.teacher_rank ? `#${stats.teacher_rank}` : "—",   color: "#f9a8d4" },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, background: "rgba(255,255,255,0.08)", borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", marginTop: 2, fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <button
            onClick={() => router.push("/teacher/vibelearn/indexer")}
            style={{ marginTop: 14, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, padding: "8px 16px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
          >
            📊 View Index Score →
          </button>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14, overflowX: "auto", paddingBottom: 2 }}>
          {(["content","create","assignments","stats","discover"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={S.pill(tab === t)}>
              {{
                content: `📄 Content${liveCount > 0 ? ` (${liveCount})` : ""}`,
                create: "✦ Create",
                assignments: "📚 Assignments",
                stats: "📊 Stats",
                discover: "🔍 Discover",
              }[t]}
            </button>
          ))}
        </div>

        {publishOk && (
          <div style={{ ...S.card, background: "#d1fae5", border: "1px solid #6ee7b7", padding: "12px 16px", marginBottom: 14, animation: "fadeIn 0.3s ease" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#065f46" }}>✓ Vibe dropped. You are now earning.</div>
          </div>
        )}

        {/* ══ CONTENT TAB ══ */}
        {tab === "content" && (
          <div>
            {actionError && (
              <div style={{ fontSize: 12, color: C.error, marginBottom: 12, padding: "10px 14px", background: "#fef2f2", borderRadius: 10 }}>
                ⚠️ {actionError}
              </div>
            )}
            {content.length === 0 ? (
              <div style={{ ...S.card, textAlign: "center", padding: "48px 24px" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📚</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary, marginBottom: 6 }}>No Vibes Dropped Yet</div>
                <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 20, lineHeight: 1.6 }}>Create a learning page, ebook or VibeTextbook and publish it to VibeLearn.</div>
                <button onClick={() => setTab("create")} style={S.btnPrimary(false)}>
                  Drop Your First Vibe →
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  {[
                    { value: liveCount,  label: "LIVE",     color: C.accent    },
                    { value: draftCount, label: "DRAFTS",   color: C.textMuted },
                    { value: content.reduce((a, c) => a + (c.earnings_ksh ?? 0), 0), label: "KSH EARNED", color: "#f59e0b" },
                  ].map(s => (
                    <div key={s.label} style={{ flex: 1, ...S.card, padding: "12px 14px", marginBottom: 0, textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{typeof s.value === "number" ? s.value.toLocaleString() : s.value}</div>
                      <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {content.map((item, idx) => {
                  const isExpanded = expandedId === item.id;
                  const isEditing  = editingId  === item.id;
                  return (
                    <div key={item.id} style={{ ...S.card, animationDelay: `${Math.min(idx * 0.05, 0.3)}s`, animation: "slideIn 0.22s ease both" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}
                        onClick={() => { setExpandedId(isExpanded ? null : item.id); setEditingId(null); setSaveError(""); }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: item.type === "textbook" ? "#e0e7ff" : item.type === "ebook" ? "#ede9fe" : "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                          {contentIcon(item.type)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary, lineHeight: 1.3 }}>{item.title}</div>
                          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>{item.source} · {relativeDate(item.created_at)}</div>
                          {item.tags?.length > 0 && (
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                              {item.tags.slice(0, 3).map(tag => (
                                <span key={tag} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: "#f3f4f6", color: C.textMuted }}>{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: item.status === "live" ? "#d1fae5" : "#f3f4f6", color: item.status === "live" ? "#065f46" : C.textMuted }}>
                            {item.status === "live" ? "● Live" : "Draft"}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginTop: 6 }}>{item.view_count.toLocaleString()} views</div>
                          <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 600 }}>KSH {(item.earnings_ksh ?? 0).toLocaleString()}</div>
                        </div>
                      </div>

                      {isExpanded && !isEditing && (
                        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
                          {item.description && <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 12, lineHeight: 1.6 }}>{item.description}</div>}
                          {item.url && (
                            <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.accent, display: "block", marginBottom: 14, wordBreak: "break-all" }}>
                              🔗 {item.url}
                            </a>
                          )}
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} onClick={e => e.stopPropagation()}>
                            <button onClick={() => startEdit(item)} style={{ padding: "8px 16px", borderRadius: 10, border: `1.5px solid ${C.border}`, background: "transparent", color: C.textPrimary, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Edit</button>
                            <button onClick={() => toggleStatus(item)} disabled={!!togglingId} style={{ padding: "8px 16px", borderRadius: 10, border: `1.5px solid ${C.accent}`, background: "transparent", color: C.accent, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit", opacity: togglingId ? 0.6 : 1 }}>
                              {togglingId === item.id ? "…" : item.status === "live" ? "Unpublish" : "Publish"}
                            </button>
                            <button onClick={e => { e.stopPropagation(); setDeleteTarget(item); }} style={{ padding: "8px 16px", borderRadius: 10, border: `1.5px solid ${C.error}`, background: "transparent", color: C.error, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                              {item.type === "textbook" ? "Remove from VibeLearn" : "Delete"}
                            </button>
                          </div>
                        </div>
                      )}

                      {isEditing && (
                        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }} onClick={e => e.stopPropagation()}>
                          <div style={{ marginBottom: 10 }}>
                            <label style={S.label}>TITLE</label>
                            <input value={eTitle} onChange={e => setETitle(e.target.value)} style={S.input} />
                          </div>
                          <div style={{ marginBottom: 10 }}>
                            <label style={S.label}>DESCRIPTION</label>
                            <textarea value={eDesc} onChange={e => setEDesc(e.target.value)} rows={2}
                              style={{ ...S.input, resize: "none", lineHeight: 1.6 }} />
                          </div>
                          {item.type === "epage" && (
                            <div style={{ marginBottom: 10 }}>
                              <label style={S.label}>CONTENT</label>
                              <textarea value={eBody} onChange={e => setEBody(e.target.value)} rows={8}
                                style={{ ...S.input, resize: "vertical", minHeight: 160, lineHeight: 1.7 }} />
                            </div>
                          )}
                          <div style={{ marginBottom: 10 }}>
                            <label style={S.label}>URL{item.type === "ebook" ? "" : " (optional)"}</label>
                            {item.type === "textbook" ? (
                              <>
                                <input value={item.url ?? ""} disabled readOnly
                                  style={{ ...S.input, background: "#f3f4f6", color: C.textMuted, cursor: "not-allowed" }} />
                                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                                  Generated automatically from the textbook — not editable here.
                                </div>
                              </>
                            ) : (
                              <input value={eUrl} onChange={e => setEUrl(e.target.value)} style={S.input} />
                            )}
                          </div>
                          <div style={{ marginBottom: 12 }}>
                            <label style={S.label}>TAGS</label>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                              {eTags.map(t => (
                                <span key={t} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: C.accent, color: "#fff", display: "flex", alignItems: "center", gap: 4 }}>
                                  {t}
                                  <button onClick={() => setETags(p => p.filter(x => x !== t))} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 0, fontSize: 13, lineHeight: 1 }}>×</button>
                                </span>
                              ))}
                            </div>
                          </div>
                          {saveError && <div style={{ fontSize: 12, color: C.error, marginBottom: 10, padding: "8px 12px", background: "#fef2f2", borderRadius: 8 }}>{saveError}</div>}
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => saveEdit(item.id)} disabled={saving} style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: C.accent, color: "#fff", fontWeight: 700, fontSize: 12, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: saving ? 0.7 : 1 }}>
                              {saving ? "Saving…" : "Save"}
                            </button>
                            <button onClick={() => { setEditingId(null); setSaveError(""); }} style={{ padding: "9px 16px", borderRadius: 10, border: `1.5px solid ${C.border}`, background: "transparent", color: C.textMuted, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                <button onClick={() => setTab("create")} style={{ width: "100%", padding: 14, borderRadius: 14, border: `2px dashed ${C.border}`, background: "transparent", color: C.textMuted, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", marginBottom: 14 }}>
                  + Drop Another Vibe
                </button>
              </>
            )}
          </div>
        )}

        {/* ══ CREATE TAB ══ */}
        {tab === "create" && (
          <div style={S.card}>
            <div style={{ marginBottom: 18 }}>
              <p style={{ fontSize: 12, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 10px" }}>What would you like to create?</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { id: "epage" as const, icon: "📄", title: "Learning Page", desc: "Notes, revision material, activities or a lesson resource." },
                  { id: "ebook" as const, icon: "📚", title: "Ebook", desc: "A longer downloadable or linked learning resource." },
                  { id: "textbook" as const, icon: "📘", title: "VibeTextbook", desc: "A structured curriculum-aligned book with chapters and publishing controls.", badge: "Full authoring studio" },
                ].map(opt => {
                  const isSelected = cType === opt.id && opt.id !== "textbook";
                  return (
                    <button
                      key={opt.id}
                      onClick={() => {
                        if (opt.id === "textbook") { router.push("/global/create/textbook"); return; }
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
                        {opt.id === "textbook" ? "→" : (isSelected ? "✓" : "→")}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div ref={createFormRef} style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0 16px", paddingTop: 4 }}>
              <div style={{ height: 1, flex: "0 0 16px", background: C.border }} />
              <p style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, margin: 0, whiteSpace: "nowrap" }}>
                {cType === "epage" ? "Learning Page Details" : "Ebook Details"}
              </p>
              <div style={{ height: 1, flex: 1, background: C.border }} />
            </div>

            {[
              { id: "vl-title", label: "Title *",       value: cTitle, setter: setCTitle, placeholder: "e.g. Quadratic Equations — Form 3", type: "input"    },
              { id: "vl-desc",  label: "Description *", value: cDesc,  setter: setCDesc,  placeholder: "What will students learn?",         type: "textarea" },
            ].map(f => (
              <div key={f.id} style={{ marginBottom: 14 }}>
                <label htmlFor={f.id} style={S.label}>{f.label}</label>
                {f.type === "textarea" ? (
                  <textarea id={f.id} value={f.value} onChange={e => f.setter(e.target.value)} placeholder={f.placeholder} rows={3}
                    style={{ ...S.input, resize: "none", lineHeight: 1.6 }} />
                ) : (
                  <input id={f.id} value={f.value} onChange={e => f.setter(e.target.value)} placeholder={f.placeholder} style={S.input} />
                )}
              </div>
            ))}

            <div style={{ marginBottom: 14, position: "relative" }}>
              <label htmlFor="vl-subject" style={S.label}>Subject</label>
              <div style={{ position: "relative" }}>
                <select id="vl-subject" value={cSubject} onChange={e => setCSubject(e.target.value)}
                  style={{ ...S.input, paddingRight: 36, appearance: "none", cursor: "pointer" }}>
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", fontSize: 12, color: C.textMuted }}>▾</div>
              </div>
            </div>

            {cType === "epage" && (
              <div style={{ marginBottom: 14 }}>
                <label htmlFor="vl-body" style={S.label}>Content</label>
                <textarea id="vl-body" value={cBody} onChange={e => setCBody(e.target.value)}
                  rows={10} placeholder={"Write your learning page here...\n\nUse short paragraphs and clear examples."}
                  style={{ ...S.input, resize: "vertical", minHeight: 200, lineHeight: 1.7 }} />
                <p style={{ fontSize: 11, color: C.textMuted, margin: "4px 0 0", lineHeight: 1.5 }}>
                  This will be read directly inside VibeLearn. You can add an external link below instead of or alongside it.
                </p>
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label htmlFor="vl-url" style={S.label}>External Resource Link{cType === "ebook" ? " *" : " (optional)"}</label>
              <input id="vl-url" type="url" value={cUrl}
                onChange={e => { setCUrl(e.target.value); setCUrlError(""); }}
                onBlur={() => { if (cUrl && !isValidUrl(cUrl)) setCUrlError("Enter a valid https:// URL"); }}
                placeholder="https://docs.google.com/…"
                style={{ ...S.input, borderColor: cUrlError ? C.error : C.border }} />
              <p style={{ fontSize: 11, color: C.textMuted, margin: "4px 0 0", lineHeight: 1.5 }}>
                Link to the Google Doc, PDF, Drive file or webpage students will open.
              </p>
              {cUrlError && <div style={{ fontSize: 12, color: C.error, marginTop: 4 }}>{cUrlError}</div>}
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={S.label}>Tags ({cTags.length}/10)</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {TAGS_PRESET.map(t => {
                  const sel = cTags.includes(t);
                  return (
                    <button key={t} onClick={() => sel ? setCTags(p => p.filter(x => x !== t)) : addTag(t, setCTags, cTags)}
                      style={{ padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit", background: sel ? C.accent : "#f3f4f6", color: sel ? "#fff" : C.textMuted, transition: "all 0.15s" }}>
                      {t}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={cTagInput} onChange={e => setCTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(cTagInput, setCTags, cTags); setCTagInput(""); } }}
                  placeholder="Custom tag, press Enter" maxLength={30}
                  style={{ ...S.input, flex: 1, width: "auto" }} />
                <button onClick={() => { addTag(cTagInput, setCTags, cTags); setCTagInput(""); }}
                  style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: C.accent, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                  Add
                </button>
              </div>
            </div>

            {publishError && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: C.error, marginBottom: 14 }}>
                {publishError}
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => saveContent("draft")} disabled={publishing}
                style={{ flex: 1, padding: 14, borderRadius: 12, border: `1.5px solid ${C.border}`, background: "transparent", color: C.textPrimary, fontWeight: 700, fontSize: 14, cursor: publishing ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: publishing ? 0.6 : 1 }}>
                {publishing ? "Saving…" : "Save Draft"}
              </button>
              <button onClick={() => saveContent("live")} disabled={publishing} style={{ ...S.btnPrimary(publishing), flex: 1 }}>
                {publishing ? "Publishing…" : "Publish to VibeLearn ✦"}
              </button>
            </div>
          </div>
        )}

        {/* ══ STATS TAB ══ */}
        {tab === "stats" && (
          <div>
            {loadingStats ? (
              <div style={S.card}>{[1,2,3,4].map(i => <div key={i} style={{ marginBottom: 12 }}><Shimmer h={52} r={12} /></div>)}</div>
            ) : content.length === 0 ? (
              <div style={{ ...S.card, textAlign: "center", padding: "48px 24px" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary, marginBottom: 6 }}>No stats yet</div>
                <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6 }}>Publish content first.</div>
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  {[
                    { label: "Total Views",    value: (stats?.total_views ?? 0).toLocaleString(),        color: C.accent,  bg: "#d1fae5" },
                    { label: "Earnings (KSH)", value: (stats?.total_earnings_ksh ?? 0).toLocaleString(), color: "#7c3aed", bg: "#ede9fe" },
                    { label: "Live Content",   value: String(stats?.live_count ?? 0),                    color: "#0284c7", bg: "#dbeafe" },
                    { label: "Teacher Rank",   value: stats?.teacher_rank ? `#${stats.teacher_rank}` : "—", color: "#b45309", bg: "#fef3c7" },
                  ].map(s => (
                    <div key={s.label} style={{ background: s.bg, borderRadius: 14, padding: "16px 14px" }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 10, color: s.color, fontWeight: 600, marginTop: 3, opacity: 0.7, textTransform: "uppercase", letterSpacing: 0.8 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {stats?.top_content && stats.top_content.length > 0 && (
                  <div style={S.card}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1.4, marginBottom: 12 }}>Top Performing</div>
                    {stats.top_content.map((c, i) => (
                      <div key={c.title} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < stats.top_content.length - 1 ? `1px solid ${C.border}` : "none" }}>
                        <div style={{ fontSize: 18, flexShrink: 0 }}>{["🥇","🥈","🥉"][i]}</div>
                        <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: C.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, flexShrink: 0 }}>{c.view_count.toLocaleString()} views</div>
                      </div>
                    ))}
                  </div>
                )}

                {(stats?.total_views ?? 0) === 0 && (stats?.live_count ?? 0) > 0 && (
                  <div style={{ ...S.card, background: "#fffbeb", border: "1px solid #fde68a" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: 6 }}>⚡ No views yet</div>
                    <div style={{ fontSize: 12, color: "#92400e", lineHeight: 1.7, opacity: 0.85 }}>Students need to discover your content. Make sure your tags match what students search for.</div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ══ ASSIGNMENTS TAB ══ */}
        {tab === "assignments" && <ReadingAssignmentsTab />}

        {/* ══ DISCOVER TAB ══ */}
        {tab === "discover" && <DiscoverTab userId={userId} />}

      </div>
    </>
  );
}

// ── Reading Assignments Tab ───────────────────────────────────────────────────
function ReadingAssignmentsTab() {
  const [items, setItems] = useState<ClassroomReadingAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dueValue, setDueValue] = useState("");
  const [drilldownItem, setDrilldownItem] =
    useState<ClassroomReadingAssignment | null>(null);

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    const { data, error } = await supabase.rpc(
      "get_my_classroom_reading_assignments"
    );

    const payload = data as {
      ok?: boolean;
      items?: ClassroomReadingAssignment[];
    } | null;

    if (error || !payload?.ok) {
      console.error("Failed to load classroom reading assignments:", error);
      setLoadError(
        "Classroom reading assignments could not be loaded. Try again."
      );
      setLoading(false);
      return;
    }

    setItems(Array.isArray(payload.items) ? payload.items : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  function beginDueEdit(item: ClassroomReadingAssignment) {
    setActionError("");
    setEditingId(item.assignment_id);
    setDueValue(toDateTimeLocalValue(item.due_at));
  }

  function cancelDueEdit() {
    setEditingId(null);
    setDueValue("");
  }

  async function saveDueDate(item: ClassroomReadingAssignment) {
    if (busyId) return;

    if (!dueValue) {
      setActionError("Enter a due date and time.");
      return;
    }

    const date = new Date(dueValue);

      if (Number.isNaN(date.getTime())) {
        setActionError("Enter a valid due date and time.");
        return;
      }

      if (date.getTime() <= Date.now()) {
        setActionError("The due date must be in the future.");
        return;
      }

    const dueAt = date.toISOString();

    setBusyId(item.assignment_id);
    setActionError("");

    const { data, error } = await supabase.rpc(
      "update_chapter_assignment_due_at",
      {
        p_assignment_id: item.assignment_id,
        p_due_at: dueAt,
      }
    );

    const result = data as {
      ok?: boolean;
      assignment_id?: string;
      due_at?: string | null;
    } | null;

    if (error || !result?.ok) {
      console.error("Failed to update assignment due date:", error);
      setActionError(
        assignmentActionError(
          error,
          "The assignment due date could not be updated."
        )
      );
      setBusyId(null);
      return;
    }

    setItems(current =>
      current.map(currentItem =>
        currentItem.assignment_id === item.assignment_id
          ? {
              ...currentItem,
              due_at: result.due_at ?? dueAt,
            }
          : currentItem
      )
    );

    setEditingId(null);
    setDueValue("");
    setBusyId(null);
  }

  async function cancelAssignment(item: ClassroomReadingAssignment) {
    if (
      busyId ||
      !window.confirm(
        `Cancel “${item.chapter_title || `Unit ${item.chapter_number}`}” for ${assignmentClassLabel(item)}?`
      )
    ) {
      return;
    }

    setBusyId(item.assignment_id);
    setActionError("");

    const { data, error } = await supabase.rpc(
      "cancel_chapter_assignment",
      {
        p_assignment_id: item.assignment_id,
      }
    );

    const result = data as {
      ok?: boolean;
      reason?: string | null;
      assignment_id?: string;
      status?: string;
    } | null;

    if (error || !result?.ok) {
      console.error("Failed to cancel assignment:", error, result);
      setActionError(
        assignmentActionError(
          error ?? result?.reason,
          "The reading assignment could not be cancelled."
        )
      );
      setBusyId(null);
      return;
    }

    setItems(current =>
      current.map(currentItem =>
        currentItem.assignment_id === item.assignment_id
          ? { ...currentItem, status: "cancelled" }
          : currentItem
      )
    );

    setEditingId(current =>
      current === item.assignment_id ? null : current
    );
    setBusyId(null);
  }

  const activeItems = items.filter(item => item.status === "assigned");
  const cancelledItems = items.filter(item => item.status === "cancelled");

  const totalLearners = activeItems.reduce(
    (sum, item) => sum + Number(item.learner_count || 0),
    0
  );
  const totalCompleted = activeItems.reduce(
    (sum, item) => sum + Number(item.completed_count || 0),
    0
  );
  const totalOverdue = activeItems.reduce(
    (sum, item) => sum + Number(item.overdue_count || 0),
    0
  );

  if (loading) {
    return (
      <div>
        {[0, 1, 2].map(index => (
          <div key={index} style={S.card}>
            <div style={{ display: "flex", gap: 12 }}>
              <Shimmer w={56} h={76} r={10} />
              <div style={{ flex: 1 }}>
                <Shimmer w="76%" h={15} />
                <div style={{ marginTop: 9 }}>
                  <Shimmer w="55%" h={11} />
                </div>
                <div style={{ marginTop: 14 }}>
                  <Shimmer w="100%" h={6} r={999} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        style={{
          ...S.card,
          textAlign: "center",
          padding: "36px 22px",
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 10 }}>⚠️</div>
        <div
          style={{
            color: C.textPrimary,
            fontWeight: 800,
            fontSize: 15,
            marginBottom: 7,
          }}
        >
          Assignments unavailable
        </div>
        <div
          style={{
            color: C.textMuted,
            fontSize: 12,
            lineHeight: 1.6,
            marginBottom: 16,
          }}
        >
          {loadError}
        </div>
        <button
          type="button"
          onClick={() => void loadAssignments()}
          style={{
            border: "none",
            borderRadius: 10,
            padding: "10px 16px",
            background: C.accent,
            color: "#fff",
            fontWeight: 800,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ ...S.card, padding: 16 }}>
        <div
          style={{
            fontSize: 16,
            fontWeight: 850,
            color: C.textPrimary,
            marginBottom: 4,
          }}
        >
          Classroom Reading
        </div>
        <div
          style={{
            fontSize: 12,
            color: C.textMuted,
            lineHeight: 1.6,
            marginBottom: 14,
          }}
        >
          Track assigned chapters, learner progress and due dates.
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4,minmax(0,1fr))",
            gap: 7,
          }}
        >
          {[
            {
              label: "ACTIVE",
              value: activeItems.length,
              color: C.accent,
            },
            {
              label: "LEARNERS",
              value: totalLearners,
              color: "#2563eb",
            },
            {
              label: "COMPLETED",
              value: totalCompleted,
              color: "#7c3aed",
            },
            {
              label: "OVERDUE",
              value: totalOverdue,
              color: totalOverdue > 0 ? "#dc2626" : C.textMuted,
            },
          ].map(metric => (
            <div
              key={metric.label}
              style={{
                borderRadius: 11,
                background: "#f8fafc",
                border: `1px solid ${C.border}`,
                padding: "10px 5px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  color: metric.color,
                  fontSize: 17,
                  fontWeight: 900,
                }}
              >
                {metric.value}
              </div>
              <div
                style={{
                  color: C.textMuted,
                  fontSize: 8,
                  fontWeight: 800,
                  marginTop: 2,
                }}
              >
                {metric.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {actionError && (
        <div
          role="alert"
          style={{
            fontSize: 12,
            color: C.error,
            marginBottom: 12,
            padding: "11px 14px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 10,
            lineHeight: 1.5,
          }}
        >
          ⚠️ {actionError}
        </div>
      )}

      {items.length === 0 ? (
        <div
          style={{
            ...S.card,
            textAlign: "center",
            padding: "48px 24px",
          }}
        >
          <div style={{ fontSize: 38, marginBottom: 12 }}>📖</div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: C.textPrimary,
              marginBottom: 7,
            }}
          >
            No reading assignments yet
          </div>
          <div
            style={{
              color: C.textMuted,
              fontSize: 13,
              lineHeight: 1.65,
            }}
          >
            Assign a published textbook chapter to a class from the textbook
            reader.
          </div>
        </div>
      ) : (
        <>
          {activeItems.map(item => (
            <ReadingAssignmentCard
              key={item.assignment_id}
              item={item}
              editing={editingId === item.assignment_id}
              dueValue={dueValue}
              busy={busyId === item.assignment_id}
              onDueValueChange={setDueValue}
              onBeginEdit={() => beginDueEdit(item)}
              onCancelEdit={cancelDueEdit}
              onSaveDue={() => void saveDueDate(item)}
              onCancelAssignment={() => void cancelAssignment(item)}
              onViewLearners={() => setDrilldownItem(item)}
            />
          ))}

          {cancelledItems.length > 0 && (
            <details style={{ marginTop: 14 }}>
              <summary
                style={{
                  cursor: "pointer",
                  color: C.textMuted,
                  fontSize: 12,
                  fontWeight: 800,
                  padding: "10px 2px",
                }}
              >
                Cancelled assignments ({cancelledItems.length})
              </summary>

              <div style={{ marginTop: 8 }}>
                {cancelledItems.map(item => (
                  <ReadingAssignmentCard
                    key={item.assignment_id}
                    item={item}
                    editing={false}
                    dueValue=""
                    busy={false}
                    onDueValueChange={() => undefined}
                    onBeginEdit={() => undefined}
                    onCancelEdit={() => undefined}
                    onSaveDue={() => undefined}
                    onCancelAssignment={() => undefined}
                    onViewLearners={() => setDrilldownItem(item)}
                  />
                ))}
              </div>
            </details>
          )}
        </>
      )}

      {drilldownItem && (
        <AssignmentLearnersSheet
          item={drilldownItem}
          onClose={() => setDrilldownItem(null)}
        />
      )}
    </div>
  );
}

function ReadingAssignmentCard({
  item,
  editing,
  dueValue,
  busy,
  onDueValueChange,
  onBeginEdit,
  onCancelEdit,
  onSaveDue,
  onCancelAssignment,
  onViewLearners,
}: {
  item: ClassroomReadingAssignment;
  editing: boolean;
  dueValue: string;
  busy: boolean;
  onDueValueChange: (value: string) => void;
  onBeginEdit: () => void;
  onCancelEdit: () => void;
  onSaveDue: () => void;
  onCancelAssignment: () => void;
  onViewLearners: () => void;
}) {
  const cancelled = item.status === "cancelled";
  const learnerCount = Number(item.learner_count || 0);
  const startedCount = Number(item.started_count || 0);
  const completedCount = Number(item.completed_count || 0);
  const overdueCount = Number(item.overdue_count || 0);
  const averageProgress = Math.max(
    0,
    Math.min(100, Number(item.average_progress || 0))
  );

  return (
    <article
      style={{
        ...S.card,
        opacity: cancelled ? 0.68 : 1,
      }}
    >
      <div style={{ display: "flex", gap: 12 }}>
        <div
          style={{
            width: 58,
            height: 78,
            flexShrink: 0,
            overflow: "hidden",
            borderRadius: 10,
            background: "#e0e7ff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
          }}
        >
          {item.cover_url ? (
            <img
              src={item.cover_url}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            "📘"
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 8,
            }}
          >
            <div
              style={{
                color: C.textPrimary,
                fontSize: 14,
                fontWeight: 850,
                lineHeight: 1.35,
              }}
            >
              {item.publication_title || "Untitled textbook"}
            </div>

            <span
              style={{
                flexShrink: 0,
                borderRadius: 999,
                padding: "4px 8px",
                fontSize: 9,
                fontWeight: 850,
                background: cancelled
                  ? "#f1f5f9"
                  : overdueCount > 0
                    ? "#fef2f2"
                    : "#ecfdf5",
                color: cancelled
                  ? C.textMuted
                  : overdueCount > 0
                    ? "#b91c1c"
                    : "#047857",
                border: cancelled
                  ? `1px solid ${C.border}`
                  : overdueCount > 0
                    ? "1px solid #fecaca"
                    : "1px solid #a7f3d0",
              }}
            >
              {cancelled
                ? "Cancelled"
                : overdueCount > 0
                  ? `${overdueCount} overdue`
                  : "Active"}
            </span>
          </div>

          <div
            style={{
              color: C.textPrimary,
              fontSize: 12,
              fontWeight: 750,
              marginTop: 7,
              lineHeight: 1.4,
            }}
          >
            Unit {item.chapter_number}
            {item.chapter_title ? ` · ${item.chapter_title}` : ""}
          </div>

          <div
            style={{
              color: C.textMuted,
              fontSize: 11,
              marginTop: 4,
            }}
          >
            {assignmentClassLabel(item)}
          </div>

          <div
            style={{
              color: C.textMuted,
              fontSize: 10,
              marginTop: 4,
            }}
          >
            Assigned {formatAssignmentDate(item.assigned_at)}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,minmax(0,1fr))",
          gap: 6,
          marginTop: 14,
        }}
      >
        {[
          { label: "Learners", value: learnerCount },
          { label: "Started", value: startedCount },
          { label: "Done", value: completedCount },
          { label: "Overdue", value: overdueCount },
        ].map(metric => (
          <div
            key={metric.label}
            style={{
              background: "#f8fafc",
              borderRadius: 9,
              padding: "8px 4px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                color: C.textPrimary,
                fontSize: 14,
                fontWeight: 850,
              }}
            >
              {metric.value}
            </div>
            <div
              style={{
                color: C.textMuted,
                fontSize: 8,
                fontWeight: 750,
                marginTop: 2,
              }}
            >
              {metric.label}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 13 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            color: C.textMuted,
            fontSize: 10,
            marginBottom: 5,
          }}
        >
          <span>Average class progress</span>
          <span>{Math.round(averageProgress)}%</span>
        </div>

        <div
          style={{
            height: 6,
            borderRadius: 999,
            background: C.border,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${averageProgress}%`,
              height: "100%",
              background: C.accent,
            }}
          />
        </div>
      </div>

      <div
        style={{
          marginTop: 13,
          paddingTop: 12,
          borderTop: `1px solid ${C.border}`,
        }}
      >
        {editing ? (
          <div>
            <label style={S.label} htmlFor={`due-${item.assignment_id}`}>
              Due date and time
            </label>

            <input
              id={`due-${item.assignment_id}`}
              type="datetime-local"
              value={dueValue}
              min={minimumDateTimeLocalValue()}
              onChange={event => onDueValueChange(event.target.value)}
              style={S.input}
            />

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginTop: 9,
              }}
            >
              <button
                type="button"
                disabled={busy}
                onClick={onSaveDue}
                style={assignmentButtonStyle("primary", busy)}
              >
                {busy ? "Saving…" : "Save due date"}
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => onDueValueChange("")}
                style={assignmentButtonStyle("secondary", busy)}
              >
                Clear date
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={onCancelEdit}
                style={assignmentButtonStyle("secondary", busy)}
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div>
                <div
                  style={{
                    color: C.textMuted,
                    fontSize: 9,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: 0.7,
                  }}
                >
                  Due
                </div>
                <div
                  style={{
                    color: C.textPrimary,
                    fontSize: 12,
                    fontWeight: 750,
                    marginTop: 2,
                  }}
                >
                  {item.due_at
                    ? formatAssignmentDate(item.due_at, true)
                    : "No due date"}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                onClick={onViewLearners}
                style={assignmentButtonStyle("secondary", false)}
              >
                View learners
              </button>
            </div>

            {!cancelled && (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  marginTop: 10,
                }}
              >
                <button
                  type="button"
                  disabled={busy}
                  onClick={onBeginEdit}
                  style={assignmentButtonStyle("secondary", busy)}
                >
                  Edit due date
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={onCancelAssignment}
                  style={assignmentButtonStyle("danger", busy)}
                >
                  {busy ? "Cancelling…" : "Cancel assignment"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function AssignmentLearnersSheet({
  item,
  onClose,
}: {
  item: ClassroomReadingAssignment;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [rows, setRows] = useState<AssignmentLearnerItem[]>([]);
  const [linkedCount, setLinkedCount] = useState(0);
  const [unlinkedCount, setUnlinkedCount] = useState(0);
  const [filter, setFilter] = useState<
    "all" | "attention" | "not_started" | "in_progress" | "completed" | "unlinked"
  >("all");

  useEffect(() => {
    let cancelledEffect = false;

    async function load() {
      setLoading(true);
      setLoadError("");

      const { data, error } = await supabase.rpc(
        "get_classroom_reading_assignment_learners",
        { assignment_id_input: item.assignment_id }
      );

      if (cancelledEffect) return;

      const payload = data as {
        ok?: boolean;
        items?: AssignmentLearnerItem[];
        linked_learner_count?: number;
        unlinked_learner_count?: number;
      } | null;

      if (error || !payload?.ok) {
        console.error("Failed to load assignment learners:", error, payload);
        setLoadError("Learner details could not be loaded. Try again.");
        setLoading(false);
        return;
      }

      setRows(Array.isArray(payload.items) ? payload.items : []);
      setLinkedCount(Number(payload.linked_learner_count || 0));
      setUnlinkedCount(Number(payload.unlinked_learner_count || 0));
      setLoading(false);
    }

    void load();

    return () => {
      cancelledEffect = true;
    };
  }, [item.assignment_id]);

  const filtered = rows.filter(row => {
    switch (filter) {
      case "attention":
        return row.is_overdue;
      case "not_started":
        return row.reading_status === "not_started";
      case "in_progress":
        return row.reading_status === "in_progress";
      case "completed":
        return row.reading_status === "completed";
      case "unlinked":
        return row.linkage_status === "account_unlinked";
      default:
        return true;
    }
  });

  const filterOptions: { key: typeof filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "attention", label: "Needs attention" },
    { key: "not_started", label: "Not started" },
    { key: "in_progress", label: "In progress" },
    { key: "completed", label: "Completed" },
    { key: "unlinked", label: "Account not linked" },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.45)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 60,
      }}
      onClick={onClose}
    >
      <div
        onClick={event => event.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 520,
          maxHeight: "86vh",
          overflowY: "auto",
          background: C.bg,
          borderRadius: "18px 18px 0 0",
          padding: "18px 16px 24px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <div>
            <div style={{ fontSize: 15, fontWeight: 850, color: C.textPrimary }}>
              {item.chapter_title
                ? `Unit ${item.chapter_number} · ${item.chapter_title}`
                : `Unit ${item.chapter_number}`}
            </div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>
              {assignmentClassLabel(item)}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              border: "none",
              background: "#f1f5f9",
              borderRadius: 999,
              width: 30,
              height: 30,
              fontSize: 14,
              fontWeight: 800,
              color: C.textMuted,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        {!loading && !loadError && (
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>
            {linkedCount} linked · {unlinkedCount} account not linked
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            marginTop: 14,
            marginBottom: 4,
          }}
        >
          {filterOptions.map(option => (
            <button
              key={option.key}
              type="button"
              onClick={() => setFilter(option.key)}
              style={S.pill(filter === option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 12 }}>
          {loading && (
            <div>
              {[0, 1, 2].map(index => (
                <div key={index} style={{ padding: "12px 2px" }}>
                  <Shimmer w="60%" h={13} />
                  <div style={{ marginTop: 7 }}>
                    <Shimmer w="35%" h={10} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && loadError && (
            <div
              style={{
                textAlign: "center",
                padding: "28px 16px",
                color: C.textMuted,
                fontSize: 12,
              }}
            >
              ⚠️ {loadError}
            </div>
          )}

          {!loading && !loadError && filtered.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "28px 16px",
                color: C.textMuted,
                fontSize: 12,
              }}
            >
              No learners match this filter.
            </div>
          )}

          {!loading &&
            !loadError &&
            filtered.map(row => (
              <AssignmentLearnerRow key={row.student_id} row={row} />
            ))}
        </div>
      </div>
    </div>
  );
}

function AssignmentLearnerRow({ row }: { row: AssignmentLearnerItem }) {
  const unlinked = row.linkage_status === "account_unlinked";

  const statusLabel: Record<AssignmentLearnerItem["reading_status"], string> = {
    account_unlinked: "Account not linked",
    not_started: "Not started",
    in_progress: "In progress",
    completed: "Completed",
    overdue_not_started: "Overdue · not started",
    overdue_in_progress: "Overdue · in progress",
  };

  const statusColor: Record<
    AssignmentLearnerItem["reading_status"],
    { bg: string; fg: string; border: string }
  > = {
    account_unlinked: { bg: "#f8fafc", fg: C.textMuted, border: C.border },
    not_started: { bg: "#f8fafc", fg: C.textMuted, border: C.border },
    in_progress: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    completed: { bg: "#ecfdf5", fg: "#047857", border: "#a7f3d0" },
    overdue_not_started: { bg: "#fef2f2", fg: "#b91c1c", border: "#fecaca" },
    overdue_in_progress: { bg: "#fef2f2", fg: "#b91c1c", border: "#fecaca" },
  };

  const colors = statusColor[row.reading_status];

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 10,
        padding: "12px 4px",
        borderBottom: `1px solid ${C.border}`,
        opacity: unlinked ? 0.75 : 1,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: C.textPrimary,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {row.learner_name || "Unnamed learner"}
        </div>

        {row.admission_number && (
          <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>
            Adm. {row.admission_number}
          </div>
        )}

        {!unlinked && (
          <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>
            {Math.round(row.progress_percent || 0)}% ·{" "}
            {row.completed_at
              ? `Completed ${formatAssignmentDate(row.completed_at, true)}`
              : row.last_read_at
                ? `Last read ${formatAssignmentDate(row.last_read_at, true)}`
                : "No reading activity yet"}
          </div>
        )}

        {row.intervention_reason && (
          <div
            style={{
              fontSize: 10,
              color: "#b91c1c",
              marginTop: 4,
              fontWeight: 700,
            }}
          >
            {row.intervention_reason}
          </div>
        )}
      </div>

      <span
        style={{
          flexShrink: 0,
          borderRadius: 999,
          padding: "4px 8px",
          fontSize: 9,
          fontWeight: 850,
          whiteSpace: "nowrap",
          background: colors.bg,
          color: colors.fg,
          border: `1px solid ${colors.border}`,
        }}
      >
        {statusLabel[row.reading_status]}
      </span>
    </div>
  );
}

function assignmentClassLabel(item: ClassroomReadingAssignment): string {
  return [item.class_name || "Unnamed class", item.class_stream]
    .filter(Boolean)
    .join(" · ");
}

function assignmentButtonStyle(
  kind: "primary" | "secondary" | "danger",
  disabled: boolean
): React.CSSProperties {
  const background =
    kind === "primary"
      ? C.accent
      : kind === "danger"
        ? "#fef2f2"
        : "#f8fafc";

  const color =
    kind === "primary"
      ? "#fff"
      : kind === "danger"
        ? "#b91c1c"
        : C.textPrimary;

  const border =
    kind === "primary"
      ? "none"
      : kind === "danger"
        ? "1px solid #fecaca"
        : `1px solid ${C.border}`;

  return {
    border,
    borderRadius: 9,
    padding: "8px 11px",
    background,
    color,
    fontSize: 11,
    fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    fontFamily: "inherit",
  };
}

function formatAssignmentDate(
  value: string,
  includeTime = false
): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";

  return new Intl.DateTimeFormat("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(includeTime
      ? {
          hour: "2-digit",
          minute: "2-digit",
        }
      : {}),
  }).format(date);
}

function toDateTimeLocalValue(value: string | null): string {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs)
    .toISOString()
    .slice(0, 16);
}

function minimumDateTimeLocalValue(): string {
  const date = new Date(Date.now() + 60_000);
  const offsetMs = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - offsetMs)
    .toISOString()
    .slice(0, 16);
}

function assignmentActionError(
  error: unknown,
  fallback: string
): string {
  const raw =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : error &&
            typeof error === "object" &&
            "message" in error &&
            typeof error.message === "string"
          ? error.message
          : "";

  if (raw.includes("DUE_DATE_MUST_BE_FUTURE")) {
    return "The due date must be in the future.";
  }

  if (raw.includes("ASSIGNMENT_NOT_FOUND_OR_NOT_ACTIVE")) {
    return "This assignment is no longer active.";
  }

  if (raw.includes("AUTH_REQUIRED")) {
    return "Your session has expired. Sign in again.";
  }

  return raw ? friendlyError(raw) : fallback;
}

// ── Discover Tab ──────────────────────────────────────────────────────────────
function DiscoverTab({ userId }: { userId: string | null }) {
  const router = useRouter();
  const [items,   setItems]   = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [query,   setQuery]   = useState("");
  const [filter,  setFilter]  =
    useState<"all" | "epage" | "ebook" | "textbook">("all");
  const [subjectId, setSubjectId] =
    useState<string | null>(null);
  const [subjectName, setSubjectName] =
    useState<string | null>(null);
  const [adoptionClasses, setAdoptionClasses] =
    useState<AdoptionClassOption[]>([]);
  const [classPickerContentId, setClassPickerContentId] =
    useState<string | null>(null);
  const [adoptingContentId, setAdoptingContentId] =
    useState<string | null>(null);
  const [adoptionError, setAdoptionError] =
    useState("");
  const [adoptionSuccess, setAdoptionSuccess] =
    useState("");
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);


  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search
    );

    const requestedSubjectId =
      params.get("subjectId");

    const requestedTab = params.get("tab");

    if (requestedTab === "discover") {
      // Parent page already rendered DiscoverTab.
    }

    if (!requestedSubjectId) {
      setSubjectId(null);
      setSubjectName(null);
      setAdoptionClasses([]);
      return;
    }

    const resolvedSubjectId =
      requestedSubjectId;

    setSubjectId(resolvedSubjectId);

    async function loadContext() {
      try {
        const [subjectRes, classes] =
          await Promise.all([
            supabase
              .from("subjects")
              .select("name")
              .eq("id", resolvedSubjectId)
              .maybeSingle(),
            loadSubjectAdoptionClasses(
              resolvedSubjectId
            ),
          ]);

        if (!mounted.current) return;

        setSubjectName(
          subjectRes.data?.name ?? null
        );
        setAdoptionClasses(classes);
      } catch (error) {
        console.error(
          "[VibeLearn] adoption context load failed",
          error
        );

        if (mounted.current) {
          setAdoptionClasses([]);
          setAdoptionError(
            "Class options could not be loaded."
          );
        }
      }
    }

    void loadContext();
  }, []);

  useEffect(() => {
    async function load() {
      if (mounted.current) setLoading(true);
      try {
        let q = supabase
          .from("vibelearn_content")
          // submitted_by included so server-side neq filter works
          .select("id,title,description,body,type,source,url,tags,status,view_count,earnings_ksh,created_at,submitted_by,subject_id,vibe_publication_id")
          .eq("status", "live")
          .order("view_count", { ascending: false })
          .limit(30);
        if (filter !== "all") q = q.eq("type", filter);
        // exclude own content server-side — not client-side
        if (userId) q = q.neq("submitted_by", userId);
        if (query.trim()) q = q.ilike("title", "%" + query.trim() + "%");
        const { data, error } = await q;

        if (error) {
          throw error;
        }

        const rawItems =
          (data ?? []) as Content[];

        const registryMappings =
          await resolvePublicRegistryResources(
            rawItems.map(item => ({
              id: item.id,
              vibePublicationId:
                item.vibe_publication_id ?? null,
            }))
          );

        const resourcesByContentId = new Map(
          registryMappings.map(mapping => [
            mapping.contentId,
            mapping.resourceId,
          ])
        );

        if (mounted.current) {
          setItems(
            rawItems.map(item => ({
              ...item,
              resource_id:
                resourcesByContentId.get(
                  item.id
                ) ?? null,
            }))
          );
        }
      } finally {
        if (mounted.current) setLoading(false);
      }
    }
    const t = setTimeout(load, query ? 400 : 0);
    return () => clearTimeout(t);
  }, [query, filter, userId]);

  const discoverCard: React.CSSProperties = {
    background: "#fff", borderRadius: 14,
    border: "1px solid #e5e7eb",
    padding: "14px 16px", marginBottom: 10,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  };

  return (
    <div>
      {subjectId && (
        <div style={{
          marginBottom: 12,
          padding: "10px 12px",
          borderRadius: 12,
          background: "#ecfdf5",
          border: "1px solid #a7f3d0",
          fontSize: 12,
          color: "#047857",
          lineHeight: 1.5,
        }}>
          Choosing content for{" "}
          <strong>
            {subjectName ?? "this subject"}
          </strong>.
          Select an exact class before adding it.
        </div>
      )}

      {adoptionError && (
        <div style={{
          marginBottom: 10,
          padding: "10px 12px",
          borderRadius: 10,
          background: "#fef2f2",
          color: C.error,
          fontSize: 12,
        }}>
          {adoptionError}
        </div>
      )}

      {adoptionSuccess && (
        <div style={{
          marginBottom: 10,
          padding: "10px 12px",
          borderRadius: 10,
          background: "#ecfdf5",
          color: "#047857",
          fontSize: 12,
          fontWeight: 700,
        }}>
          {adoptionSuccess}
        </div>
      )}

      <div style={{ position: "relative", marginBottom: 10 }}>
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search content by topic, subject, tag…"
          style={{ width: "100%", padding: "12px 14px 12px 42px", borderRadius: 12, border: "1.5px solid #e5e7eb", fontSize: 13, fontFamily: "inherit", outline: "none", background: "#fff", color: "#111827", boxSizing: "border-box" }} />
        <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, pointerEvents: "none" }}>🔍</div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {(["all","epage","ebook","textbook"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "6px 14px", borderRadius: 20, fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "inherit", background: filter === f ? C.accent : "#f3f4f6", color: filter === f ? "#fff" : "#6b7280", textTransform: "uppercase" }}>
            {
              f === "all"
                ? "All"
                : f === "epage"
                  ? "📄 Epage"
                  : f === "ebook"
                    ? "📚 Ebook"
                    : "📘 Textbook"
            }
          </button>
        ))}
      </div>
      {loading ? (
        [1,2,3].map(i => <div key={i} style={{ marginBottom: 10 }}><Shimmer h={90} r={14} /></div>)
      ) : items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#6b7280", fontSize: 13 }}>
          {query ? `No results for "${query}"` : "No content from other teachers yet."}
        </div>
      ) : items.map(item => (
        <div key={item.id} style={discoverCard}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ fontSize: 22, flexShrink: 0 }}>{contentIcon(item.type)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", lineHeight: 1.3 }}>{item.title}</div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{item.source}</div>
              {item.tags?.length > 0 && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                  {item.tags.slice(0, 3).map(t => <span key={t} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: "#f3f4f6", color: "#6b7280" }}>{t}</span>)}
                </div>
              )}
            </div>
            <div style={{ flexShrink: 0, textAlign: "right" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.accent }}>{item.view_count} views</div>
              {(() => {
                const dest = contentReadUrl(item);
                if (!dest) return null;
                if (dest.external) {
                  return (
                    <a href={dest.href} target="_blank" rel="noopener noreferrer"
                      style={{ display: "inline-block", marginTop: 6, fontSize: 11, padding: "5px 12px", borderRadius: 8, background: "#f3f4f6", color: "#111827", fontWeight: 700, textDecoration: "none" }}>
                      Open →
                    </a>
                  );
                }
                return (
                  <button onClick={() => router.push(dest.href)}
                    style={{ display: "inline-block", marginTop: 6, fontSize: 11, padding: "5px 12px", borderRadius: 8, border: "none", background: "#f3f4f6", color: "#111827", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    Read →
                  </button>
                );
              })()}
            </div>
          </div>

          {subjectId && (
            <div style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: "1px solid #e5e7eb",
            }}>
              {!item.resource_id ? (
                <div style={{
                  fontSize: 11,
                  color: "#92400e",
                  background: "#fffbeb",
                  borderRadius: 9,
                  padding: "8px 10px",
                }}>
                  This item is readable, but its
                  public Content Engine resource
                  is not available for class use.
                </div>
              ) : adoptionClasses.length === 0 ? (
                <div style={{
                  fontSize: 11,
                  color: "#6b7280",
                }}>
                  No assigned classes are available
                  for this subject.
                </div>
              ) : classPickerContentId === item.id ? (
                <div>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: "#111827",
                    marginBottom: 8,
                  }}>
                    Add to which class?
                  </div>

                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 7,
                  }}>
                    {adoptionClasses.map(cls => (
                      <button
                        key={cls.id}
                        disabled={
                          adoptingContentId === item.id
                        }
                        onClick={async () => {
                          if (
                            !item.resource_id ||
                            !subjectId ||
                            adoptingContentId
                          ) {
                            return;
                          }

                          setAdoptingContentId(item.id);
                          setAdoptionError("");
                          setAdoptionSuccess("");

                          try {
                            await addResourceToClass({
                              resourceId:
                                item.resource_id,
                              classId: cls.id,
                              subjectId,
                            });

                            if (!mounted.current) return;

                            const classLabel =
                              cls.name +
                              (
                                cls.stream
                                  ? " · " + cls.stream
                                  : ""
                              );

                            setAdoptionSuccess(
                              `“${item.title}” added to ${classLabel}.`
                            );
                            setClassPickerContentId(null);
                          } catch (error) {
                            console.error(
                              "[VibeLearn] class adoption failed",
                              error
                            );

                            if (mounted.current) {
                              setAdoptionError(
                                "The resource could not be added to the class."
                              );
                            }
                          } finally {
                            if (mounted.current) {
                              setAdoptingContentId(null);
                            }
                          }
                        }}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: 10,
                          border:
                            "1px solid #d1d5db",
                          background: "#fff",
                          textAlign: "left",
                          color: "#111827",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor:
                            adoptingContentId === item.id
                              ? "wait"
                              : "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        {cls.name}
                        {cls.stream
                          ? " · " + cls.stream
                          : ""}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() =>
                      setClassPickerContentId(null)
                    }
                    style={{
                      marginTop: 8,
                      border: "none",
                      background: "transparent",
                      color: "#6b7280",
                      fontSize: 11,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setAdoptionError("");
                    setAdoptionSuccess("");
                    setClassPickerContentId(item.id);
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "none",
                    background: "#047857",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Add to a class
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
