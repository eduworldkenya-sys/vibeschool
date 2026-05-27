"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { C } from "@/components/teacher/ui";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Content {
  id:          string;
  title:       string;
  description: string;
  type:        "epage" | "ebook";
  source:      string;        // subject text (workaround)
  external_url: string | null;
  tags:        string[];
  is_published: boolean;
  view_count:  number;
  created_at:  string;
  estimated_earnings: number;
}

interface Stats {
  total_views:       number;
  total_earnings_ksh: number;
  live_count:        number;
  teacher_rank:      number | null;
  top_content:       { title: string; view_count: number }[];
}

type Tab = "content" | "create" | "stats" | "discover";

const SUBJECTS = [
  "Mathematics", "English", "Kiswahili", "Biology", "Chemistry",
  "Physics", "History", "Geography", "CRE", "IRE", "Business Studies",
  "Agriculture", "Computer Studies", "Art & Design", "Music", "French",
];

const TAGS_PRESET = [
  "KCSE", "KCPE", "Form 1", "Form 2", "Form 3", "Form 4",
  "Grade 7", "Grade 8", "Grade 9", "Revision", "Notes", "Practicals",
  "Essays", "Past Papers", "Short Notes", "Diagrams",
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

function isValidUrl(url: string): boolean {
  try { return ["http:", "https:"].includes(new URL(url).protocol); }
  catch { return false; }
}

function Shimmer({ w = "100%", h = 16, r = 8 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "linear-gradient(90deg, #f0f0f0 25%, #e4e4e4 50%, #f0f0f0 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.4s infinite",
    }} />
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function VibeLearnPage() {
  const router = useRouter();

  const [tab,         setTab]         = useState<Tab>("content");
  const [userId,      setUserId]      = useState<string | null>(null);
  const [content,     setContent]     = useState<Content[]>([]);
  const [stats,       setStats]       = useState<Stats | null>(null);
  const [loadingPage, setLoadingPage] = useState(true);
  const [loadingStats,setLoadingStats]= useState(true);
  const [expandedId,  setExpandedId]  = useState<string | null>(null);
  const [deletingId,  setDeletingId]  = useState<string | null>(null);
  const [togglingId,  setTogglingId]  = useState<string | null>(null);
  const [pageError,   setPageError]   = useState("");

  // Create form
  const [cType,       setCType]       = useState<"epage" | "ebook">("epage");
  const [cTitle,      setCTitle]      = useState("");
  const [cDesc,       setCDesc]       = useState("");
  const [cSubject,    setCSubject]    = useState(SUBJECTS[0]);
  const [cUrl,        setCUrl]        = useState("");
  const [cUrlError,   setCUrlError]   = useState("");
  const [cTags,       setCTags]       = useState<string[]>([]);
  const [cTagInput,   setCTagInput]   = useState("");
  const [publishing,  setPublishing]  = useState(false);
  const [publishError,setPublishError]= useState("");
  const [publishOk,   setPublishOk]   = useState(false);

  // ── Auth + load ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace("/teacher/login"); return; }
        setUserId(user.id);
        await Promise.all([loadContent(user.id), loadStats(user.id)]);
      } catch (e) {
        setPageError("Failed to load. Check your connection.");
      } finally {
        setLoadingPage(false);
      }
    }
    init();
  }, []);

  const loadContent = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from("vibelearn_content")
      .select("id, title, description, type, source, external_url, tags, is_published, view_count, created_at, estimated_earnings")
      .eq("submitted_by", uid)
      .order("created_at", { ascending: false });
    if (!error && data) setContent(data as Content[]);
  }, []);

  const loadStats = useCallback(async (uid: string) => {
    setLoadingStats(true);
    try {
      const { data } = await supabase
        .from("vibelearn_teacher_stats")
        .select("*")
        .eq("submitted_by", uid)
        .maybeSingle();

      const { data: top } = await supabase
        .from("vibelearn_content")
        .select("title, view_count")
        .eq("submitted_by", uid)
        .eq("is_published", true)
        .order("view_count", { ascending: false })
        .limit(3);

      setStats({
        total_views:        data?.total_views        ?? 0,
        total_earnings_ksh: data?.total_earnings_ksh ?? 0,
        live_count:         data?.live_count         ?? 0,
        teacher_rank:       data?.teacher_rank       ?? null,
        top_content:        (top ?? []) as { title: string; view_count: number }[],
      });
    } finally {
      setLoadingStats(false);
    }
  }, []);

  // ── Toggle publish ───────────────────────────────────────────────────────
  async function togglePublish(item: Content) {
    if (togglingId) return;
    setTogglingId(item.id);
    try {
      const { error } = await supabase
        .from("vibelearn_content")
        .update({ is_published: !item.is_published })
        .eq("id", item.id)
        .eq("submitted_by", userId!);
      if (!error) {
        setContent(prev => prev.map(c => c.id === item.id ? { ...c, is_published: !c.is_published } : c));
        if (userId) loadStats(userId);
      }
    } finally {
      setTogglingId(null);
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────
  async function deleteContent(id: string) {
    if (deletingId) return;
    setDeletingId(id);
    try {
      const { error } = await supabase
        .from("vibelearn_content")
        .delete()
        .eq("id", id)
        .eq("submitted_by", userId!);
      if (!error) {
        setContent(prev => prev.filter(c => c.id !== id));
        setExpandedId(null);
        if (userId) loadStats(userId);
      }
    } finally {
      setDeletingId(null);
    }
  }

  // ── Publish ──────────────────────────────────────────────────────────────
  async function handlePublish() {
    setPublishError("");
    if (!cTitle.trim())             { setPublishError("Title is required."); return; }
    if (!cDesc.trim())              { setPublishError("Description is required."); return; }
    if (!cUrl.trim())               { setPublishError("Content URL is required."); return; }
    if (!isValidUrl(cUrl.trim()))   { setPublishError("Enter a valid https:// URL."); return; }

    setPublishing(true);
    try {
      const { error } = await supabase.from("vibelearn_content").insert({
        title:        cTitle.trim(),
        description:  cDesc.trim(),
        type:         cType,
        source:       cSubject,
        external_url: cUrl.trim(),
        tags:         cTags,
        is_published: true,
        submitted_by: userId!,
        view_count:   0,
        estimated_earnings: 0,
      });
      if (error) throw error;
      // Reset form
      setCTitle(""); setCDesc(""); setCUrl(""); setCTags([]); setCTagInput(""); setCUrlError("");
      setPublishOk(true);
      setTimeout(() => setPublishOk(false), 3000);
      if (userId) { await loadContent(userId); await loadStats(userId); }
      setTab("content");
    } catch (e: unknown) {
      setPublishError((e as Error).message ?? "Publish failed. Try again.");
    } finally {
      setPublishing(false);
    }
  }

  function addTag(t: string) {
    const clean = t.trim().slice(0, 30);
    if (!clean || cTags.includes(clean) || cTags.length >= 10) return;
    setCTags(prev => [...prev, clean]);
  }

  function removeTag(t: string) {
    setCTags(prev => prev.filter(x => x !== t));
  }

  // ── Shared style helpers ─────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: C.bg, borderRadius: 16,
    border: `1px solid ${C.border}`,
    padding: "16px 18px", marginBottom: 14,
    boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
  };

  const pill = (active: boolean): React.CSSProperties => ({
    padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
    border: active ? "none" : `1.5px solid ${C.border}`,
    background: active ? C.accent : "transparent",
    color: active ? "#fff" : C.textMuted,
    cursor: "pointer", transition: "all 0.15s",
  });

  if (loadingPage) {
    return (
      <div style={{ animation: "fadeIn 0.2s ease" }}>
        {/* Hero skeleton */}
        <div style={{ background: "linear-gradient(135deg, #065f46 0%, #1e1b4b 100%)", borderRadius: 20, padding: "20px", marginBottom: 14 }}>
          <Shimmer w={80}  h={10} />
          <div style={{ marginTop: 8 }}><Shimmer w={160} h={22} /></div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{ flex: 1, background: "rgba(255,255,255,0.1)", borderRadius: 12, padding: 12 }}>
                <Shimmer w="60%" h={18} /><div style={{ marginTop: 6 }}><Shimmer w="80%" h={9} /></div>
              </div>
            ))}
          </div>
        </div>
        {/* Tab skeleton */}
        <div style={{ ...card }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>{[1,2,3].map(i => <Shimmer key={i} w={70} h={32} r={20} />)}</div>
          {[1,2,3].map(i => <div key={i} style={{ marginBottom: 12 }}><Shimmer h={68} r={12} /></div>)}
        </div>
      </div>
    );
  }

  if (pageError) {
    return (
      <div style={{ ...card, textAlign: "center", padding: "40px 20px" }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>⚠️</div>
        <div style={{ fontSize: 14, color: C.textMuted }}>{pageError}</div>
        <button onClick={() => window.location.reload()} style={{ marginTop: 16, padding: "10px 20px", borderRadius: 10, border: "none", background: C.accent, color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Retry</button>
      </div>
    );
  }

  const liveCount  = content.filter(c => c.is_published).length;
  const draftCount = content.filter(c => !c.is_published).length;

  return (
    <div style={{ animation: "slideIn 0.22s ease" }}>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div style={{
        background:    "linear-gradient(135deg, #065f46 0%, #1e1b4b 100%)",
        borderRadius:  20, padding: "18px 20px",
        marginBottom:  14, color: "#fff", position: "relative", overflow: "hidden",
      }}>
        {/* glow orb */}
        <div style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.25), transparent 70%)", pointerEvents: "none" }} />

        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 2 }}>VibeLearn</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Publish. Earn. Grow.</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginBottom: 16 }}>
          Your content earns ad revenue every time a student reads it.
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { label: "Earnings (KSH)",  value: loadingStats ? "…" : `${(stats?.total_earnings_ksh ?? 0).toLocaleString()}`, color: "#6ee7b7" },
            { label: "Total Views",     value: loadingStats ? "…" : `${(stats?.total_views ?? 0).toLocaleString()}`,        color: "#93c5fd" },
            { label: "Live",            value: loadingStats ? "…" : `${stats?.live_count ?? 0}`,                             color: "#fde68a" },
            { label: "Rank",            value: loadingStats ? "…" : stats?.teacher_rank ? `#${stats.teacher_rank}` : "—",   color: "#f9a8d4" },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: "rgba(255,255,255,0.08)", borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", marginTop: 2, fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tab bar ───────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, overflowX: "auto", paddingBottom: 2 }}>
        {(["content", "create", "stats", "discover"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={pill(tab === t)}>
            {{ content: `📄 Content${liveCount > 0 ? ` (${liveCount})` : ""}`, create: "✦ Create", stats: "📊 Stats", discover: "🔍 Discover" }[t]}
          </button>
        ))}
      </div>

      {/* ── SUCCESS BANNER ────────────────────────────────────────────────── */}
      {publishOk && (
        <div style={{ ...card, background: "#d1fae5", border: "1px solid #6ee7b7", padding: "12px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#065f46" }}>✓ Published! Your content is now live and earning.</div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* CONTENT TAB                                                        */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {tab === "content" && (
        <div>
          {content.length === 0 ? (
            <div style={{ ...card, textAlign: "center", padding: "48px 24px" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📚</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary, marginBottom: 6 }}>No content yet</div>
              <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 20, lineHeight: 1.6 }}>
                Publish your first EPAGE or EBOOK and start earning from ad revenue every time a student reads it.
              </div>
              <button
                onClick={() => setTab("create")}
                style={{ padding: "12px 28px", borderRadius: 12, border: "none", background: C.accent, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}
              >
                Create your first content →
              </button>
            </div>
          ) : (
            <>
              {/* Live / Draft counts */}
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <div style={{ flex: 1, ...card, padding: "12px 14px", marginBottom: 0, textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: C.accent }}>{liveCount}</div>
                  <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600 }}>LIVE</div>
                </div>
                <div style={{ flex: 1, ...card, padding: "12px 14px", marginBottom: 0, textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: C.textMuted }}>{draftCount}</div>
                  <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600 }}>DRAFTS</div>
                </div>
              </div>

              {content.map((item, idx) => {
                const isExpanded = expandedId === item.id;
                const isDeleting = deletingId === item.id;
                const isToggling = togglingId === item.id;
                return (
                  <div
                    key={item.id}
                    style={{ ...card, cursor: "pointer", transition: "box-shadow 0.15s", animationDelay: `${Math.min(idx * 0.05, 0.3)}s`, animation: "slideIn 0.22s ease both" }}
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  >
                    {/* Row */}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      {/* Type icon */}
                      <div style={{
                        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                        background: item.type === "ebook" ? "#ede9fe" : "#dbeafe",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                      }}>
                        {item.type === "ebook" ? "📚" : "📄"}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary, lineHeight: 1.3 }}>{item.title}</div>
                        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>
                          {item.source} · {relativeDate(item.created_at)}
                        </div>
                        {/* Tags */}
                        {item.tags?.length > 0 && (
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                            {item.tags.slice(0, 4).map(tag => (
                              <span key={tag} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: "#f3f4f6", color: C.textMuted }}>{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Right column */}
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{
                          display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700,
                          background: item.is_published ? "#d1fae5" : "#f3f4f6",
                          color:      item.is_published ? "#065f46"  : C.textMuted,
                        }}>
                          {item.is_published ? "● Live" : "Draft"}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginTop: 6 }}>
                          {item.view_count.toLocaleString()} views
                        </div>
                      </div>
                    </div>

                    {/* Expanded actions */}
                    {isExpanded && (
                      <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }} onClick={e => e.stopPropagation()}>
                        {item.description && (
                          <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 12, lineHeight: 1.6 }}>{item.description}</div>
                        )}
                        {item.external_url && (
                          <a href={item.external_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.accent, display: "block", marginBottom: 14, wordBreak: "break-all" }}>
                            🔗 {item.external_url}
                          </a>
                        )}
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            disabled={isToggling}
                            onClick={() => togglePublish(item)}
                            style={{ padding: "8px 16px", borderRadius: 10, border: `1.5px solid ${C.accent}`, background: "transparent", color: C.accent, fontWeight: 700, fontSize: 12, cursor: isToggling ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: isToggling ? 0.6 : 1 }}
                          >
                            {isToggling ? "…" : item.is_published ? "Unpublish" : "Publish"}
                          </button>
                          <button
                            disabled={isDeleting}
                            onClick={() => {
                              if (window.confirm(`Delete "${item.title}"? This cannot be undone.`)) deleteContent(item.id);
                            }}
                            style={{ padding: "8px 16px", borderRadius: 10, border: `1.5px solid ${C.error}`, background: "transparent", color: C.error, fontWeight: 700, fontSize: 12, cursor: isDeleting ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: isDeleting ? 0.6 : 1 }}
                          >
                            {isDeleting ? "Deleting…" : "Delete"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              <button
                onClick={() => setTab("create")}
                style={{ width: "100%", padding: "14px", borderRadius: 14, border: `2px dashed ${C.border}`, background: "transparent", color: C.textMuted, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", marginBottom: 14 }}
              >
                + Add more content
              </button>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* CREATE TAB                                                         */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {tab === "create" && (
        <div style={card}>
          {/* Type toggle */}
          <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 12, padding: 4, marginBottom: 18 }}>
            {(["epage", "ebook"] as const).map(t => (
              <button
                key={t}
                onClick={() => setCType(t)}
                style={{
                  flex: 1, padding: "10px", borderRadius: 9, border: "none", fontFamily: "inherit",
                  fontWeight: 700, fontSize: 13, cursor: "pointer", transition: "all 0.15s",
                  background: cType === t ? "#fff" : "transparent",
                  color:      cType === t ? C.textPrimary : C.textMuted,
                  boxShadow:  cType === t ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                }}
              >
                {t === "epage" ? "📄 EPAGE" : "📚 EBOOK"}
              </button>
            ))}
          </div>

          {/* Title */}
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="vl-title" style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>Title *</label>
            <input
              id="vl-title"
              value={cTitle}
              onChange={e => setCTitle(e.target.value)}
              placeholder="e.g. Quadratic Equations — Form 3"
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: "inherit", color: C.textPrimary, outline: "none", background: C.bg }}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="vl-desc" style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>Description *</label>
            <textarea
              id="vl-desc"
              value={cDesc}
              onChange={e => setCDesc(e.target.value)}
              placeholder="What will students learn from this content?"
              rows={3}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: "inherit", color: C.textPrimary, outline: "none", background: C.bg, resize: "none", lineHeight: 1.6 }}
            />
          </div>

          {/* Subject */}
          <div style={{ marginBottom: 14, position: "relative" }}>
            <label htmlFor="vl-subject" style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>Subject</label>
            <div style={{ position: "relative" }}>
              <select
                id="vl-subject"
                value={cSubject}
                onChange={e => setCSubject(e.target.value)}
                style={{ width: "100%", padding: "12px 36px 12px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: "inherit", color: C.textPrimary, background: C.bg, appearance: "none", outline: "none", cursor: "pointer" }}
              >
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", fontSize: 12, color: C.textMuted }}>▾</div>
            </div>
          </div>

          {/* URL */}
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="vl-url" style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>Content URL *</label>
            <input
              id="vl-url"
              type="url"
              value={cUrl}
              onChange={e => { setCUrl(e.target.value); setCUrlError(""); }}
              onBlur={() => { if (cUrl && !isValidUrl(cUrl)) setCUrlError("Enter a valid https:// URL"); }}
              placeholder="https://docs.google.com/..."
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${cUrlError ? C.error : C.border}`, fontSize: 14, fontFamily: "inherit", color: C.textPrimary, outline: "none", background: C.bg }}
            />
            {cUrlError && <div style={{ fontSize: 12, color: C.error, marginTop: 4 }}>{cUrlError}</div>}
          </div>

          {/* Tags */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>
              Tags <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>({cTags.length}/10)</span>
            </label>
            {/* Preset chips */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {TAGS_PRESET.map(t => {
                const sel = cTags.includes(t);
                return (
                  <button
                    key={t}
                    onClick={() => sel ? removeTag(t) : addTag(t)}
                    style={{ padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit", background: sel ? C.accent : "#f3f4f6", color: sel ? "#fff" : C.textMuted, transition: "all 0.15s" }}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
            {/* Custom tag input */}
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={cTagInput}
                onChange={e => setCTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(cTagInput); setCTagInput(""); } }}
                placeholder="Custom tag, press Enter"
                maxLength={30}
                style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: "inherit", outline: "none", background: C.bg, color: C.textPrimary }}
              />
              <button
                onClick={() => { addTag(cTagInput); setCTagInput(""); }}
                style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: C.accent, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
              >
                Add
              </button>
            </div>
            {/* Selected custom tags */}
            {cTags.filter(t => !TAGS_PRESET.includes(t)).length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {cTags.filter(t => !TAGS_PRESET.includes(t)).map(t => (
                  <span key={t} style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, background: "#ede9fe", color: "#6d28d9", display: "flex", alignItems: "center", gap: 4 }}>
                    {t}
                    <button onClick={() => removeTag(t)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#6d28d9", lineHeight: 1, padding: 0 }}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Error */}
          {publishError && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: C.error, marginBottom: 14 }}>
              {publishError}
            </div>
          )}

          {/* Publish button */}
          <button
            onClick={handlePublish}
            disabled={publishing}
            style={{ width: "100%", padding: "15px", borderRadius: 14, border: "none", background: publishing ? "#d1fae5" : C.accent, color: "#fff", fontWeight: 800, fontSize: 15, cursor: publishing ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "all 0.2s", boxShadow: publishing ? "none" : "0 4px 16px rgba(16,185,129,0.35)" }}
          >
            {publishing ? "Publishing…" : "Publish & Start Earning ✦"}
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* STATS TAB                                                          */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {tab === "stats" && (
        <div>
          {loadingStats ? (
            <div style={card}>{[1,2,3,4].map(i => <div key={i} style={{ marginBottom: 12 }}><Shimmer h={52} r={12} /></div>)}</div>
          ) : content.length === 0 ? (
            <div style={{ ...card, textAlign: "center", padding: "48px 24px" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary, marginBottom: 6 }}>No stats yet</div>
              <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6 }}>Publish content first, then your views and earnings will appear here.</div>
            </div>
          ) : (
            <>
              {/* Key metrics */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                {[
                  { label: "Total Views",      value: (stats?.total_views ?? 0).toLocaleString(),       color: C.accent,    bg: "#d1fae5" },
                  { label: "Earnings (KSH)",   value: (stats?.total_earnings_ksh ?? 0).toLocaleString(), color: "#7c3aed",  bg: "#ede9fe" },
                  { label: "Live Content",     value: String(stats?.live_count ?? 0),                    color: "#0284c7",  bg: "#dbeafe" },
                  { label: "Teacher Rank",     value: stats?.teacher_rank ? `#${stats.teacher_rank}` : "—", color: "#b45309", bg: "#fef3c7" },
                ].map(s => (
                  <div key={s.label} style={{ background: s.bg, borderRadius: 14, padding: "16px 14px", border: "none" }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: s.color, fontWeight: 600, marginTop: 3, opacity: 0.7, textTransform: "uppercase", letterSpacing: 0.8 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Top content */}
              {stats?.top_content && stats.top_content.length > 0 && (
                <div style={card}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1.4, marginBottom: 12 }}>Top Performing Content</div>
                  {stats.top_content.map((c, i) => (
                    <div key={c.title} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < stats.top_content.length - 1 ? `1px solid ${C.border}` : "none" }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: i === 0 ? "#fef3c7" : i === 1 ? "#f3f4f6" : "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>
                        {["🥇","🥈","🥉"][i]}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.title}</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, flexShrink: 0 }}>{c.view_count.toLocaleString()} views</div>
                    </div>
                  ))}
                </div>
              )}

              {/* No views nudge */}
              {(stats?.total_views ?? 0) === 0 && content.filter(c => c.is_published).length > 0 && (
                <div style={{ ...card, background: "#fffbeb", border: "1px solid #fde68a" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: 6 }}>⚡ No views yet — here's why</div>
                  <div style={{ fontSize: 12, color: "#92400e", lineHeight: 1.7, opacity: 0.85 }}>
                    Students need to discover your content. Make sure your tags match what students search for, and share your content link with your class directly.
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* DISCOVER TAB                                                       */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {tab === "discover" && (
        <div>
          <div style={{ ...card, background: "linear-gradient(135deg, #ede9fe, #dbeafe)", border: "none", textAlign: "center", padding: "32px 20px" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1e1b4b", marginBottom: 6 }}>Discover is coming soon</div>
            <div style={{ fontSize: 13, color: "#4c1d95", lineHeight: 1.6 }}>
              Browse and read content from other teachers. Recommendations based on your subject and teaching level.
            </div>
          </div>

          {/* Nudge — see your own content */}
          <div style={{ ...card, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => setTab("content")}>
            <div style={{ fontSize: 24 }}>📚</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>View your published content</div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>See what's live and earning right now</div>
            </div>
            <div style={{ marginLeft: "auto", color: C.textMuted, fontSize: 18 }}>›</div>
          </div>
        </div>
      )}

    </div>
  );
}

