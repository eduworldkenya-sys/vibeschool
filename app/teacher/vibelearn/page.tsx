"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { C } from "@/components/teacher/ui";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Content {
  id:           string;
  title:        string;
  description:  string;
  type:         "epage" | "ebook" | "textbook";
  source:       string;
  url:          string;
  tags:         string[];
  status:       "live" | "draft";
  view_count:   number;
  earnings_ksh: number;
  created_at:   string;
  submitted_by: string;
  vibe_publication_id?: string | null;
}

interface Stats {
  total_views:        number;
  total_earnings_ksh: number;
  live_count:         number;
  teacher_rank:       number | null;
  top_content:        { title: string; view_count: number }[];
}

type Tab = "content" | "create" | "stats" | "discover";

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
  const [eTags,        setETags]        = useState<string[]>([]);
  const [saving,       setSaving]       = useState(false);
  const [saveError,    setSaveError]    = useState("");

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
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
      .select("id,title,description,type,source,url,tags,status,view_count,earnings_ksh,created_at,submitted_by,vibe_publication_id")
      .eq("submitted_by", uid)
      .order("created_at", { ascending: false });
    if (!error && data && mounted.current) setContent(data as Content[]);
  }, []);

  const loadStats = useCallback(async (uid: string) => {
    if (mounted.current) setLoadingStats(true);
    try {
      let data: Record<string, number> | null = null
      try {
        const { data: _d } = await supabase
          .from("vibelearn_teacher_stats")
          .select("*")
          .eq("teacher_id", uid)
          .maybeSingle();
        data = _d
      } catch { /* table may not exist yet — non-fatal */ }
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
    if (!eTitle.trim())                          { setSaveError("Title is required."); return; }
    if (!isTextbook && !eUrl.trim())              { setSaveError("URL is required."); return; }
    if (!isTextbook && !isValidUrl(eUrl.trim()))  { setSaveError("Enter a valid https:// URL."); return; }
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
        const { error } = await supabase
          .from("vibelearn_content")
          .update({ title: eTitle.trim(), description: eDesc.trim(), url: eUrl.trim(), tags: eTags })
          .eq("id", id)
          .eq("submitted_by", userId!);
        if (error) throw error;
        if (!mounted.current) return;
        setContent(prev => prev.map(c => c.id === id
          ? { ...c, title: eTitle.trim(), description: eDesc.trim(), url: eUrl.trim(), tags: eTags }
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
    setETags(item.tags ?? []);
  }

  // ── Publish ─────────────────────────────────────────────────────────────────
  async function handlePublish() {
    setPublishError("");
    if (!userId)              { setPublishError("Not authenticated."); return; }
    if (!cTitle.trim())       { setPublishError("Title is required."); return; }
    if (!cDesc.trim())        { setPublishError("Description is required."); return; }
    if (!cUrl.trim())         { setPublishError("Content URL is required."); return; }
    if (!isValidUrl(cUrl.trim())) { setPublishError("Enter a valid https:// URL."); return; }
    setPublishing(true);
    try {
      const { error } = await supabase.from("vibelearn_content").insert({
        title:        cTitle.trim(),
        description:  cDesc.trim(),
        type:         cType,
        source:       cSubject,
        url:          cUrl.trim(),
        tags:         cTags,
        status:       "live",
        submitted_by: userId,
        view_count:   0,
        earnings_ksh: 0,
      });
      if (error) throw error;
      if (!mounted.current) return;
      setCTitle(""); setCDesc(""); setCUrl(""); setCTags([]); setCTagInput(""); setCUrlError("");
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
          {(["content","create","stats","discover"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={S.pill(tab === t)}>
              {{ content: `📄 Content${liveCount > 0 ? ` (${liveCount})` : ""}`, create: "✦ Create", stats: "📊 Stats", discover: "🔍 Discover" }[t]}
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
                          <div style={{ marginBottom: 10 }}>
                            <label style={S.label}>URL</label>
                            {item.type === "textbook" ? (
                              <>
                                <input value={item.url} disabled readOnly
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
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      if (opt.id === "textbook") { router.push("/global/create/textbook"); return; }
                      setCType(opt.id);
                    }}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 12, textAlign: "left",
                      padding: "14px 16px", borderRadius: 14, cursor: "pointer", fontFamily: "inherit",
                      border: cType === opt.id && opt.id !== "textbook" ? `1.5px solid ${C.accent}` : `1.5px solid ${C.border}`,
                      background: cType === opt.id && opt.id !== "textbook" ? "#f0fdfa" : "#fff",
                    }}
                  >
                    <div style={{ fontSize: 22, flexShrink: 0 }}>{opt.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: C.textPrimary }}>{opt.title}</div>
                        {opt.badge && (
                          <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#ede9fe", color: "#6d28d9", textTransform: "uppercase", letterSpacing: 0.5 }}>{opt.badge}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: C.textMuted, marginTop: 3, lineHeight: 1.5 }}>{opt.desc}</div>
                    </div>
                    <div style={{ fontSize: 16, color: C.textMuted, flexShrink: 0, alignSelf: "center" }}>→</div>
                  </button>
                ))}
              </div>
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

            <div style={{ marginBottom: 14 }}>
              <label htmlFor="vl-url" style={S.label}>External Resource Link *</label>
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

            <button onClick={handlePublish} disabled={publishing} style={S.btnPrimary(publishing)}>
              {publishing ? "Publishing…" : "Drop a Vibe ✦"}
            </button>
            <p style={{ fontSize: 11, color: C.textMuted, textAlign: "center", margin: "8px 0 0" }}>
              This will go live in VibeLearn immediately.
            </p>
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

        {/* ══ DISCOVER TAB ══ */}
        {tab === "discover" && <DiscoverTab userId={userId} />}

      </div>
    </>
  );
}

// ── Discover Tab ──────────────────────────────────────────────────────────────
function DiscoverTab({ userId }: { userId: string | null }) {
  const [items,   setItems]   = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [query,   setQuery]   = useState("");
  const [filter,  setFilter]  = useState<"all" | "epage" | "ebook">("all");
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    async function load() {
      if (mounted.current) setLoading(true);
      try {
        let q = supabase
          .from("vibelearn_content")
          // submitted_by included so server-side neq filter works
          .select("id,title,description,type,source,url,tags,status,view_count,earnings_ksh,created_at,submitted_by")
          .eq("status", "live")
          .order("view_count", { ascending: false })
          .limit(30);
        if (filter !== "all") q = q.eq("type", filter);
        // exclude own content server-side — not client-side
        if (userId) q = q.neq("submitted_by", userId);
        if (query.trim()) q = q.ilike("title", "%" + query.trim() + "%");
        const { data } = await q;
        if (mounted.current) setItems((data ?? []) as Content[]);
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
      <div style={{ position: "relative", marginBottom: 10 }}>
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search content by topic, subject, tag…"
          style={{ width: "100%", padding: "12px 14px 12px 42px", borderRadius: 12, border: "1.5px solid #e5e7eb", fontSize: 13, fontFamily: "inherit", outline: "none", background: "#fff", color: "#111827", boxSizing: "border-box" }} />
        <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, pointerEvents: "none" }}>🔍</div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {(["all","epage","ebook"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "6px 14px", borderRadius: 20, fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "inherit", background: filter === f ? C.accent : "#f3f4f6", color: filter === f ? "#fff" : "#6b7280", textTransform: "uppercase" }}>
            {f === "all" ? "All" : f === "epage" ? "📄 Epage" : "📚 Ebook"}
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
              <a href={item.url} target="_blank" rel="noopener noreferrer"
                style={{ display: "inline-block", marginTop: 6, fontSize: 11, padding: "5px 12px", borderRadius: 8, background: "#f3f4f6", color: "#111827", fontWeight: 700, textDecoration: "none" }}>
                Open →
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
