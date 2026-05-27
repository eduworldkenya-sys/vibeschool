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
  source:      string;
  url:         string;
  tags:        string[];
  status:      "live" | "draft";
  view_count:  number;
  earnings_ksh: number;
  created_at:  string;
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

function Shimmer({ w="100%", h=16, r=8 }: { w?: string|number; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "linear-gradient(90deg,#f0f0f0 25%,#e4e4e4 50%,#f0f0f0 75%)",
      backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite",
    }} />
  );
}

export default function VibeLearnPage() {
  const router = useRouter();

  const [tab,          setTab]          = useState<Tab>("content");
  const [userId,       setUserId]       = useState<string|null>(null);
  const [content,      setContent]      = useState<Content[]>([]);
  const [stats,        setStats]        = useState<Stats|null>(null);
  const [loadingPage,  setLoadingPage]  = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [expandedId,   setExpandedId]   = useState<string|null>(null);
  const [deletingId,   setDeletingId]   = useState<string|null>(null);
  const [togglingId,   setTogglingId]   = useState<string|null>(null);
  const [pageError,    setPageError]    = useState("");

  // Create form state
  const [cType,        setCType]        = useState<"epage"|"ebook">("epage");
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

  // Edit state
  const [editingId,    setEditingId]    = useState<string|null>(null);
  const [eTitle,       setETitle]       = useState("");
  const [eDesc,        setEDesc]        = useState("");
  const [eUrl,         setEUrl]         = useState("");
  const [eTags,        setETags]        = useState<string[]>([]);
  const [saving,       setSaving]       = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace("/teacher/login"); return; }
        setUserId(user.id);
        await Promise.all([loadContent(user.id), loadStats(user.id)]);
      } catch {
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
      .select("id,title,description,type,source,url,tags,status,view_count,earnings_ksh,created_at")
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
        .eq("teacher_id", uid)
        .maybeSingle();
      const { data: top } = await supabase
        .from("vibelearn_content")
        .select("title,view_count")
        .eq("submitted_by", uid)
        .eq("status", "live")
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

  async function toggleStatus(item: Content) {
    if (togglingId) return;
    setTogglingId(item.id);
    try {
      const next = item.status === "live" ? "draft" : "live";
      const { error } = await supabase
        .from("vibelearn_content")
        .update({ status: next })
        .eq("id", item.id)
        .eq("submitted_by", userId!);
      if (!error) {
        setContent(prev => prev.map(c => c.id === item.id ? { ...c, status: next } : c));
        if (userId) loadStats(userId);
      }
    } finally {
      setTogglingId(null);
    }
  }

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

  async function saveEdit(id: string) {
    if (!eTitle.trim() || !eUrl.trim() || !isValidUrl(eUrl.trim())) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("vibelearn_content")
        .update({ title: eTitle.trim(), description: eDesc.trim(), url: eUrl.trim(), tags: eTags })
        .eq("id", id)
        .eq("submitted_by", userId!);
      if (!error) {
        setContent(prev => prev.map(c => c.id === id
          ? { ...c, title: eTitle.trim(), description: eDesc.trim(), url: eUrl.trim(), tags: eTags }
          : c
        ));
        setEditingId(null);
      }
    } finally {
      setSaving(false);
    }
  }

  function startEdit(item: Content) {
    setEditingId(item.id);
    setETitle(item.title);
    setEDesc(item.description ?? "");
    setEUrl(item.url ?? "");
    setETags(item.tags ?? []);
  }

  async function handlePublish() {
    setPublishError("");
    if (!cTitle.trim())           { setPublishError("Title is required."); return; }
    if (!cDesc.trim())            { setPublishError("Description is required."); return; }
    if (!cUrl.trim())             { setPublishError("Content URL is required."); return; }
    if (!isValidUrl(cUrl.trim())) { setPublishError("Enter a valid https:// URL."); return; }
    setPublishing(true);
    try {
      const { error } = await supabase.from("vibelearn_content").insert({
        title:       cTitle.trim(),
        description: cDesc.trim(),
        type:        cType,
        source:      cSubject,
        url:         cUrl.trim(),
        tags:        cTags,
        status:      "live",
        submitted_by: userId!,
        view_count:  0,
        earnings_ksh: 0,
      });
      if (error) throw error;
      setCTitle(""); setCDesc(""); setCUrl(""); setCTags([]); setCTagInput(""); setCUrlError("");
      setPublishOk(true);
      setTimeout(() => setPublishOk(false), 3000);
      if (userId) { await loadContent(userId); await loadStats(userId); }
      setTab("content");
    } catch (e: unknown) {
      setPublishError((e as Error).message ?? "Publish failed.");
    } finally {
      setPublishing(false);
    }
  }

  function addTag(t: string, setter: React.Dispatch<React.SetStateAction<string[]>>, current: string[]) {
    const clean = t.trim().slice(0, 30);
    if (!clean || current.includes(clean) || current.length >= 10) return;
    setter(prev => [...prev, clean]);
  }

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
    cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap" as const,
  });

  const liveCount  = content.filter(c => c.status === "live").length;
  const draftCount = content.filter(c => c.status === "draft").length;

  if (loadingPage) return (
    <div style={{ animation: "fadeIn 0.2s ease" }}>
      <div style={{ background: "linear-gradient(135deg,#065f46 0%,#1e1b4b 100%)", borderRadius: 20, padding: 20, marginBottom: 14 }}>
        <Shimmer w={80} h={10} /><div style={{ marginTop: 8 }}><Shimmer w={160} h={22} /></div>
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ flex: 1, background: "rgba(255,255,255,0.1)", borderRadius: 12, padding: 12 }}>
              <Shimmer w="60%" h={18} /><div style={{ marginTop: 6 }}><Shimmer w="80%" h={9} /></div>
            </div>
          ))}
        </div>
      </div>
      <div style={card}>{[1,2,3].map(i => <div key={i} style={{ marginBottom: 12 }}><Shimmer h={68} r={12} /></div>)}</div>
    </div>
  );

  if (pageError) return (
    <div style={{ ...card, textAlign: "center", padding: "40px 20px" }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>⚠️</div>
      <div style={{ fontSize: 14, color: C.textMuted }}>{pageError}</div>
      <button onClick={() => window.location.reload()} style={{ marginTop: 16, padding: "10px 20px", borderRadius: 10, border: "none", background: C.accent, color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Retry</button>
    </div>
  );

  return (
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
            { label: "Live",           value: loadingStats ? "…" : `${stats?.live_count ?? 0}`,                              color: "#fde68a" },
            { label: "Rank",           value: loadingStats ? "…" : stats?.teacher_rank ? `#${stats.teacher_rank}` : "—",    color: "#f9a8d4" },
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
          <button key={t} onClick={() => setTab(t)} style={pill(tab === t)}>
            {{ content: `📄 Content${liveCount > 0 ? ` (${liveCount})` : ""}`, create: "✦ Create", stats: "📊 Stats", discover: "🔍 Discover" }[t]}
          </button>
        ))}
      </div>

      {publishOk && (
        <div style={{ ...card, background: "#d1fae5", border: "1px solid #6ee7b7", padding: "12px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#065f46" }}>✓ Published! Your content is now live and earning.</div>
        </div>
      )}

      {/* ══ CONTENT TAB ══ */}
      {tab === "content" && (
        <div>
          {content.length === 0 ? (
            <div style={{ ...card, textAlign: "center", padding: "48px 24px" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📚</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary, marginBottom: 6 }}>No content yet</div>
              <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 20, lineHeight: 1.6 }}>Publish your first EPAGE or EBOOK and start earning from ad revenue every time a student reads it.</div>
              <button onClick={() => setTab("create")} style={{ padding: "12px 28px", borderRadius: 12, border: "none", background: C.accent, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                Create your first content →
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <div style={{ flex: 1, ...card, padding: "12px 14px", marginBottom: 0, textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: C.accent }}>{liveCount}</div>
                  <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600 }}>LIVE</div>
                </div>
                <div style={{ flex: 1, ...card, padding: "12px 14px", marginBottom: 0, textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: C.textMuted }}>{draftCount}</div>
                  <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600 }}>DRAFTS</div>
                </div>
                <div style={{ flex: 1, ...card, padding: "12px 14px", marginBottom: 0, textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#f59e0b" }}>
                    {content.reduce((a, c) => a + (c.earnings_ksh ?? 0), 0).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600 }}>KSH EARNED</div>
                </div>
              </div>

              {content.map((item, idx) => {
                const isExpanded = expandedId === item.id;
                const isEditing  = editingId === item.id;
                return (
                  <div key={item.id} style={{ ...card, animationDelay: `${Math.min(idx * 0.05, 0.3)}s`, animation: "slideIn 0.22s ease both" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }} onClick={() => { setExpandedId(isExpanded ? null : item.id); setEditingId(null); }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: item.type === "ebook" ? "#ede9fe" : "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                        {item.type === "ebook" ? "📚" : "📄"}
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
                          <button onClick={() => { if (window.confirm(`Delete "${item.title}"?`)) deleteContent(item.id); }} disabled={!!deletingId} style={{ padding: "8px 16px", borderRadius: 10, border: `1.5px solid ${C.error}`, background: "transparent", color: C.error, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit", opacity: deletingId ? 0.6 : 1 }}>
                            {deletingId === item.id ? "Deleting…" : "Delete"}
                          </button>
                        </div>
                      </div>
                    )}

                    {isEditing && (
                      <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }} onClick={e => e.stopPropagation()}>
                        <div style={{ marginBottom: 10 }}>
                          <label style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, display: "block", marginBottom: 4 }}>TITLE</label>
                          <input value={eTitle} onChange={e => setETitle(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: "inherit", outline: "none", color: C.textPrimary, background: C.bg }} />
                        </div>
                        <div style={{ marginBottom: 10 }}>
                          <label style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, display: "block", marginBottom: 4 }}>DESCRIPTION</label>
                          <textarea value={eDesc} onChange={e => setEDesc(e.target.value)} rows={2} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: "inherit", outline: "none", color: C.textPrimary, background: C.bg, resize: "none" }} />
                        </div>
                        <div style={{ marginBottom: 12 }}>
                          <label style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, display: "block", marginBottom: 4 }}>URL</label>
                          <input value={eUrl} onChange={e => setEUrl(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: "inherit", outline: "none", color: C.textPrimary, background: C.bg }} />
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => saveEdit(item.id)} disabled={saving} style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: C.accent, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit", opacity: saving ? 0.7 : 1 }}>{saving ? "Saving…" : "Save"}</button>
                          <button onClick={() => setEditingId(null)} style={{ padding: "9px 16px", borderRadius: 10, border: `1.5px solid ${C.border}`, background: "transparent", color: C.textMuted, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              <button onClick={() => setTab("create")} style={{ width: "100%", padding: 14, borderRadius: 14, border: `2px dashed ${C.border}`, background: "transparent", color: C.textMuted, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", marginBottom: 14 }}>
                + Add more content
              </button>
            </>
          )}
        </div>
      )}

      {/* ══ CREATE TAB ══ */}
      {tab === "create" && (
        <div style={card}>
          <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 12, padding: 4, marginBottom: 18 }}>
            {(["epage","ebook"] as const).map(t => (
              <button key={t} onClick={() => setCType(t)} style={{ flex: 1, padding: 10, borderRadius: 9, border: "none", fontFamily: "inherit", fontWeight: 700, fontSize: 13, cursor: "pointer", transition: "all 0.15s", background: cType === t ? "#fff" : "transparent", color: cType === t ? C.textPrimary : C.textMuted, boxShadow: cType === t ? "0 1px 4px rgba(0,0,0,0.1)" : "none" }}>
                {t === "epage" ? "📄 EPAGE" : "📚 EBOOK"}
              </button>
            ))}
          </div>

          <div style={{ marginBottom: 14 }}>
            <label htmlFor="vl-title" style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" as const, letterSpacing: 1, display: "block", marginBottom: 6 }}>Title *</label>
            <input id="vl-title" value={cTitle} onChange={e => setCTitle(e.target.value)} placeholder="e.g. Quadratic Equations — Form 3" style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: "inherit", color: C.textPrimary, outline: "none", background: C.bg }} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label htmlFor="vl-desc" style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" as const, letterSpacing: 1, display: "block", marginBottom: 6 }}>Description *</label>
            <textarea id="vl-desc" value={cDesc} onChange={e => setCDesc(e.target.value)} placeholder="What will students learn?" rows={3} style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: "inherit", color: C.textPrimary, outline: "none", background: C.bg, resize: "none", lineHeight: 1.6 }} />
          </div>

          <div style={{ marginBottom: 14, position: "relative" }}>
            <label htmlFor="vl-subject" style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" as const, letterSpacing: 1, display: "block", marginBottom: 6 }}>Subject</label>
            <div style={{ position: "relative" }}>
              <select id="vl-subject" value={cSubject} onChange={e => setCSubject(e.target.value)} style={{ width: "100%", padding: "12px 36px 12px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: "inherit", color: C.textPrimary, background: C.bg, appearance: "none" as const, outline: "none", cursor: "pointer" }}>
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", fontSize: 12, color: C.textMuted }}>▾</div>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label htmlFor="vl-url" style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" as const, letterSpacing: 1, display: "block", marginBottom: 6 }}>Content URL *</label>
            <input id="vl-url" type="url" value={cUrl} onChange={e => { setCUrl(e.target.value); setCUrlError(""); }} onBlur={() => { if (cUrl && !isValidUrl(cUrl)) setCUrlError("Enter a valid https:// URL"); }} placeholder="https://docs.google.com/..." style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${cUrlError ? C.error : C.border}`, fontSize: 14, fontFamily: "inherit", color: C.textPrimary, outline: "none", background: C.bg }} />
            {cUrlError && <div style={{ fontSize: 12, color: C.error, marginTop: 4 }}>{cUrlError}</div>}
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase" as const, letterSpacing: 1, display: "block", marginBottom: 8 }}>Tags ({cTags.length}/10)</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {TAGS_PRESET.map(t => {
                const sel = cTags.includes(t);
                return <button key={t} onClick={() => sel ? setCTags(p => p.filter(x => x !== t)) : addTag(t, setCTags, cTags)} style={{ padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit", background: sel ? C.accent : "#f3f4f6", color: sel ? "#fff" : C.textMuted, transition: "all 0.15s" }}>{t}</button>;
              })}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={cTagInput} onChange={e => setCTagInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(cTagInput, setCTags, cTags); setCTagInput(""); } }} placeholder="Custom tag, press Enter" maxLength={30} style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: "inherit", outline: "none", background: C.bg, color: C.textPrimary }} />
              <button onClick={() => { addTag(cTagInput, setCTags, cTags); setCTagInput(""); }} style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: C.accent, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Add</button>
            </div>
          </div>

          {publishError && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: C.error, marginBottom: 14 }}>{publishError}</div>}

          <button onClick={handlePublish} disabled={publishing} style={{ width: "100%", padding: 15, borderRadius: 14, border: "none", background: publishing ? "#d1fae5" : C.accent, color: "#fff", fontWeight: 800, fontSize: 15, cursor: publishing ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: publishing ? "none" : "0 4px 16px rgba(16,185,129,0.35)" }}>
            {publishing ? "Publishing…" : "Publish & Start Earning ✦"}
          </button>
        </div>
      )}

      {/* ══ STATS TAB ══ */}
      {tab === "stats" && (
        <div>
          {loadingStats ? (
            <div style={card}>{[1,2,3,4].map(i => <div key={i} style={{ marginBottom: 12 }}><Shimmer h={52} r={12} /></div>)}</div>
          ) : content.length === 0 ? (
            <div style={{ ...card, textAlign: "center", padding: "48px 24px" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary, marginBottom: 6 }}>No stats yet</div>
              <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6 }}>Publish content first.</div>
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                {[
                  { label: "Total Views",    value: (stats?.total_views ?? 0).toLocaleString(),        color: C.accent,   bg: "#d1fae5" },
                  { label: "Earnings (KSH)", value: (stats?.total_earnings_ksh ?? 0).toLocaleString(), color: "#7c3aed",  bg: "#ede9fe" },
                  { label: "Live Content",   value: String(stats?.live_count ?? 0),                    color: "#0284c7",  bg: "#dbeafe" },
                  { label: "Teacher Rank",   value: stats?.teacher_rank ? `#${stats.teacher_rank}` : "—", color: "#b45309", bg: "#fef3c7" },
                ].map(s => (
                  <div key={s.label} style={{ background: s.bg, borderRadius: 14, padding: "16px 14px" }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: s.color, fontWeight: 600, marginTop: 3, opacity: 0.7, textTransform: "uppercase" as const, letterSpacing: 0.8 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {stats?.top_content && stats.top_content.length > 0 && (
                <div style={card}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: C.textMuted, textTransform: "uppercase" as const, letterSpacing: 1.4, marginBottom: 12 }}>Top Performing</div>
                  {stats.top_content.map((c, i) => (
                    <div key={c.title} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < stats.top_content.length - 1 ? `1px solid ${C.border}` : "none" }}>
                      <div style={{ fontSize: 18, flexShrink: 0 }}>{["🥇","🥈","🥉"][i]}</div>
                      <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: C.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{c.title}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, flexShrink: 0 }}>{c.view_count.toLocaleString()} views</div>
                    </div>
                  ))}
                </div>
              )}

              {(stats?.total_views ?? 0) === 0 && (stats?.live_count ?? 0) > 0 && (
                <div style={{ ...card, background: "#fffbeb", border: "1px solid #fde68a" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: 6 }}>⚡ No views yet</div>
                  <div style={{ fontSize: 12, color: "#92400e", lineHeight: 1.7, opacity: 0.85 }}>Students need to discover your content. Make sure your tags match what students search for. Share your content directly with your class.</div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══ DISCOVER TAB ══ */}
      {tab === "discover" && (
        <div>
          <DiscoverTab userId={userId} />
        </div>
      )}

    </div>
  );
}

// ── Discover Tab — teachers browse other teachers' content ────────────────────
function DiscoverTab({ userId }: { userId: string | null }) {
  const [items,   setItems]   = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [query,   setQuery]   = useState("");
  const [filter,  setFilter]  = useState<"all"|"epage"|"ebook">("all");

  const card: React.CSSProperties = {
    background: "#fff", borderRadius: 14,
    border: "1px solid #e5e7eb",
    padding: "14px 16px", marginBottom: 10,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        let q = supabase
          .from("vibelearn_content")
          .select("id,title,description,type,source,url,tags,status,view_count,earnings_ksh,created_at")
          .eq("status", "live")
          .order("view_count", { ascending: false })
          .limit(30);
        if (filter !== "all") q = q.eq("type", filter);
        if (query.trim()) q = q.textSearch("search_vector", query.trim(), { type: "websearch", config: "english" });
        const { data } = await q;
        setItems((data ?? []).filter((c: Content) => c.submitted_by !== userId) as Content[]);
      } finally {
        setLoading(false);
      }
    }
    const t = setTimeout(load, query ? 400 : 0);
    return () => clearTimeout(t);
  }, [query, filter, userId]);

  return (
    <div>
      <div style={{ position: "relative", marginBottom: 10 }}>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search content by topic, subject, tag…" style={{ width: "100%", padding: "12px 14px 12px 42px", borderRadius: 12, border: "1.5px solid #e5e7eb", fontSize: 13, fontFamily: "inherit", outline: "none", background: "#fff", color: "#111827", boxSizing: "border-box" as const }} />
        <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, pointerEvents: "none" }}>🔍</div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {(["all","epage","ebook"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "6px 14px", borderRadius: 20, fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "inherit", background: filter === f ? C.accent : "#f3f4f6", color: filter === f ? "#fff" : "#6b7280", textTransform: "uppercase" as const }}>
            {f === "all" ? "All" : f === "epage" ? "📄 Epage" : "📚 Ebook"}
          </button>
        ))}
      </div>
      {loading ? (
        [1,2,3].map(i => <div key={i} style={{ marginBottom: 10 }}><div style={{ height: 90, borderRadius: 14, background: "linear-gradient(90deg,#f0f0f0 25%,#e4e4e4 50%,#f0f0f0 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} /></div>)
      ) : items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#6b7280", fontSize: 13 }}>
          {query ? `No results for "${query}"` : "No content from other teachers yet."}
        </div>
      ) : items.map(item => (
        <div key={item.id} style={card}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ fontSize: 22, flexShrink: 0 }}>{item.type === "ebook" ? "📚" : "📄"}</div>
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
              <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 6, fontSize: 11, padding: "5px 12px", borderRadius: 8, background: "#f3f4f6", color: "#111827", fontWeight: 700, textDecoration: "none" }}>Open →</a>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}