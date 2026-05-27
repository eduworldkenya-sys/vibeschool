"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { C } from "@/components/teacher/ui";

/* ── types ─────────────────────────────────────────────────── */
interface Content {
  id:           string;
  title:        string;
  description:  string | null;
  type:         string;
  url:          string;
  tags:         string[];
  view_count:   number;
  earnings_ksh: number;
  status:       string;
  created_at:   string;
}
interface TeacherStats {
  teacher_id:        string;
  content_count:     number;
  live_count:        number;
  draft_count:       number;
  total_views:       number;
  total_earnings_ksh: number;
  teacher_rank:      number;
}

/* ── constants ──────────────────────────────────────────────── */
const DARK   = C.dark;
const ACCENT = C.accent;
const MUTED  = C.textMuted;
const BORDER = C.border;
const RED    = C.error;
const GOLD   = C.warning;
const BG     = C.bg;
const SURF   = C.surface;

const TABS = ["Content", "Create", "Stats"] as const;
type Tab = typeof TABS[number];

const SUBJECTS = [
  { value: "maths",         label: "Maths"          },
  { value: "english",       label: "English"         },
  { value: "kiswahili",     label: "Kiswahili"       },
  { value: "science",       label: "Science"         },
  { value: "social_studies",label: "Social Studies"  },
  { value: "general",       label: "General"         },
];

/* ── helpers ────────────────────────────────────────────────── */
function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}k`;
  return String(n);
}
function ksh(n: number) {
  return `KSh ${Number(n).toLocaleString("en-KE", { minimumFractionDigits: 0 })}`;
}
function relativeDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86_400_000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 30)  return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short" });
}

/* ══════════════════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════════════════ */
export default function VibeLearnPage() {
  const router  = useRouter();
  const [tab,     setTab]     = useState<Tab>("Content");
  const [stats,   setStats]   = useState<TeacherStats | null>(null);
  const [content, setContent] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId,  setUserId]  = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/teacher/login"); return; }
      setUserId(user.id);

      const [cRes, sRes] = await Promise.all([
        supabase
          .from("vibelearn_content")
          .select("id,title,description,type,url,tags,view_count,earnings_ksh,status,created_at")
          .eq("submitted_by", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("vibelearn_teacher_stats")
          .select("*")
          .eq("teacher_id", user.id)
          .maybeSingle(),
      ]);

      if (cRes.data)  setContent(cRes.data as Content[]);
      if (sRes.data)  setStats(sRes.data as TeacherStats);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ background: BG, minHeight: "100vh", paddingBottom: 88 }}>
      <style>{`
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(10px) }
          to   { opacity:1; transform:translateY(0)    }
        }
        @keyframes shimmer {
          0%   { background-position: 200% 0  }
          100% { background-position: -200% 0 }
        }
        .vl-up   { animation: fadeUp 0.24s ease both }
        .vl-btn:active  { transform: scale(0.97) }
        .vl-card:active { transform: scale(0.988) }
      `}</style>

      <Hero stats={stats} loading={loading} />

      {/* tab bar */}
      <div style={{ padding: "18px 20px 0" }}>
        <div style={{
          display: "flex", background: SURF, borderRadius: 14,
          padding: 4, border: `1px solid ${BORDER}`,
        }}>
          {TABS.map(t => (
            <button
              key={t}
              className="vl-btn"
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: "10px 0", border: "none", borderRadius: 10,
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                fontFamily: "inherit", transition: "all 0.15s",
                background: tab === t ? DARK : "transparent",
                color:      tab === t ? "#fff" : MUTED,
                boxShadow:  tab === t ? "0 2px 8px rgba(30,27,75,0.2)" : "none",
              }}
            >{t}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: "20px 20px 0" }}>
        {tab === "Content" && (
          <ContentTab
            items={content}
            loading={loading}
            userId={userId}
            onRefresh={load}
            onCreate={() => setTab("Create")}
          />
        )}
        {tab === "Create" && (
          <CreateTab
            userId={userId}
            onSuccess={() => { load(); setTab("Content"); }}
          />
        )}
        {tab === "Stats" && (
          <StatsTab stats={stats} items={content} />
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   HERO
══════════════════════════════════════════════════════════════ */
function Hero({ stats, loading }: { stats: TeacherStats | null; loading: boolean }) {
  const shimmer = {
    background: "linear-gradient(90deg,rgba(255,255,255,0.06) 25%,rgba(255,255,255,0.12) 50%,rgba(255,255,255,0.06) 75%)",
    backgroundSize: "200% 100%",
    animation: "shimmer 1.4s infinite",
    borderRadius: 10,
  };

  return (
    <div style={{
      background: `linear-gradient(140deg, ${DARK} 0%, #312e81 55%, #1e3a5f 100%)`,
      padding: "28px 24px 24px",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position:"absolute", top:-50, right:-50, width:180, height:180, borderRadius:"50%", background:"rgba(16,185,129,0.10)", pointerEvents:"none" }} />
      <div style={{ position:"absolute", bottom:-40, left:-20, width:140, height:140, borderRadius:"50%", background:"rgba(255,255,255,0.03)", pointerEvents:"none" }} />

      <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)", fontWeight:800, letterSpacing:2.5, textTransform:"uppercase", marginBottom:8 }}>
        VibeLearn Studio
      </div>

      {loading ? (
        <>
          <div style={{ ...shimmer, height:48, marginBottom:8 }} />
          <div style={{ ...shimmer, height:16, width:"50%" }} />
        </>
      ) : (
        <>
          <div style={{ fontSize:40, fontWeight:900, color:"#fff", lineHeight:1, letterSpacing:-1 }}>
            <span style={{ fontSize:18, fontWeight:500, color:"rgba(255,255,255,0.5)", marginRight:4 }}>KSh</span>
            {Number(stats?.total_earnings_ksh ?? 0).toLocaleString("en-KE")}
          </div>
          <div style={{ fontSize:11, color: ACCENT, marginTop:6, fontWeight:600, letterSpacing:0.3 }}>
            Total earnings from your content
          </div>
        </>
      )}

      <div style={{ display:"flex", gap:10, marginTop:20 }}>
        {[
          { val: loading ? null : fmt(Number(stats?.total_views ?? 0)), label:"Views"     },
          { val: loading ? null : String(stats?.content_count ?? 0),    label:"Published" },
          { val: loading ? null : `#${stats?.teacher_rank ?? "—"}`,     label:"Rank", gold:true },
        ].map(s => (
          <div key={s.label} style={{
            flex:1, background:"rgba(255,255,255,0.07)", borderRadius:12,
            padding:"12px 8px", textAlign:"center",
            border:"1px solid rgba(255,255,255,0.09)",
          }}>
            {s.val === null
              ? <div style={{ ...shimmer, height:24, marginBottom:4 }} />
              : <div style={{ fontSize:20, fontWeight:800, color: s.gold ? GOLD : "#fff" }}>{s.val}</div>
            }
            <div style={{ fontSize:9, color:"rgba(255,255,255,0.4)", marginTop:3, fontWeight:700, letterSpacing:1, textTransform:"uppercase" }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   CONTENT TAB
══════════════════════════════════════════════════════════════ */
function ContentTab({
  items, loading, userId, onRefresh, onCreate,
}: {
  items: Content[]; loading: boolean; userId: string | null;
  onRefresh: () => void; onCreate: () => void;
}) {
  if (loading) return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {[1,2,3].map(i => (
        <div key={i} style={{
          height: 88, borderRadius: 16,
          background: "linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.4s infinite",
          animationDelay: `${i * 0.1}s`,
        }} />
      ))}
    </div>
  );

  if (items.length === 0) return (
    <div className="vl-up" style={{ textAlign:"center", padding:"52px 24px" }}>
      <div style={{ fontSize:52, marginBottom:16 }}>📭</div>
      <div style={{ fontSize:17, fontWeight:800, color:DARK, marginBottom:8 }}>
        No content yet
      </div>
      <div style={{ fontSize:13, color:MUTED, lineHeight:1.6, marginBottom:24 }}>
        Publish your first ebook or epage and start earning from your knowledge.
      </div>
      <button
        className="vl-btn"
        onClick={onCreate}
        style={{
          padding:"13px 32px", borderRadius:12, border:"none",
          background:DARK, color:"#fff", fontSize:14, fontWeight:700,
          cursor:"pointer", fontFamily:"inherit",
          boxShadow:"0 4px 14px rgba(30,27,75,0.25)",
        }}
      >
        Create your first content →
      </button>
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {items.map((item, i) => (
        <ContentCard
          key={item.id}
          item={item}
          idx={i}
          userId={userId}
          onRefresh={onRefresh}
        />
      ))}
    </div>
  );
}

/* ── content card ── */
function ContentCard({
  item, idx, userId, onRefresh,
}: {
  item: Content; idx: number; userId: string | null; onRefresh: () => void;
}) {
  const [open,     setOpen]     = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirm,  setConfirm]  = useState(false);

  const isLive = item.status === "live";

  async function toggleStatus() {
    if (!userId) return;
    setToggling(true);
    try {
      await supabase
        .from("vibelearn_content")
        .update({ status: isLive ? "draft" : "live", updated_at: new Date().toISOString() })
        .eq("id", item.id)
        .eq("submitted_by", userId);
    } finally {
      setToggling(false);
      onRefresh();
    }
  }

  async function deleteContent() {
    if (!userId) return;
    setDeleting(true);
    try {
      await supabase
        .from("vibelearn_content")
        .delete()
        .eq("id", item.id)
        .eq("submitted_by", userId);
    } finally {
      setDeleting(false);
      onRefresh();
    }
  }

  return (
    <div
      className="vl-up vl-card"
      style={{
        background:"#fff", borderRadius:16, border:`1px solid ${BORDER}`,
        overflow:"hidden", cursor:"pointer",
        boxShadow: C.shadow,
        animationDelay:`${Math.min(idx * 0.05, 0.3)}s`,
        transition:"box-shadow 0.15s",
      }}
      onClick={() => setOpen(o => !o)}
    >
      <div style={{ padding:"16px 16px 14px", display:"flex", gap:12, alignItems:"flex-start" }}>
        <div style={{
          width:44, height:44, borderRadius:12, flexShrink:0,
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:20,
          background: item.type === "ebook"
            ? "linear-gradient(135deg,#312e81,#1e1b4b)"
            : "linear-gradient(135deg,#064e3b,#065f46)",
        }}>
          {item.type === "ebook" ? "📖" : "📄"}
        </div>

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{
            fontSize:14, fontWeight:700, color:DARK, lineHeight:1.3, marginBottom:3,
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
          }}>
            {item.title}
          </div>
          <div style={{ fontSize:11, color:MUTED, marginBottom:6 }}>
            {item.type.toUpperCase()} · {relativeDate(item.created_at)}
          </div>
          <span style={{
            fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20,
            background: isLive ? "rgba(16,185,129,0.1)" : "rgba(107,114,128,0.1)",
            color:      isLive ? ACCENT : MUTED,
          }}>
            {isLive ? "● LIVE" : "DRAFT"}
          </span>
        </div>

        <div style={{ textAlign:"right", flexShrink:0 }}>
          <div style={{ fontSize:14, fontWeight:800, color:ACCENT }}>{ksh(item.earnings_ksh)}</div>
          <div style={{ fontSize:10, color:MUTED, marginTop:2 }}>{fmt(item.view_count)} views</div>
        </div>
      </div>

      {open && (
        <div
          style={{ borderTop:`1px solid ${BORDER}`, padding:"12px 16px" }}
          onClick={e => e.stopPropagation()}
        >
          {confirm ? (
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              <span style={{ flex:1, fontSize:12, color:MUTED }}>Delete this content?</span>
              <button
                onClick={() => setConfirm(false)}
                style={{ padding:"8px 14px", borderRadius:8, border:`1px solid ${BORDER}`, background:"#fff", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit", color:MUTED }}
              >Cancel</button>
              <button
                onClick={deleteContent}
                disabled={deleting}
                style={{ padding:"8px 14px", borderRadius:8, border:"none", background:RED, color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}
              >{deleting ? "…" : "Delete"}</button>
            </div>
          ) : (
            <div style={{ display:"flex", gap:8 }}>
              <a
                href={item.url} target="_blank" rel="noreferrer"
                style={{
                  flex:1, padding:"10px 0", borderRadius:10, border:`1px solid ${BORDER}`,
                  fontSize:12, fontWeight:700, color:DARK, textAlign:"center",
                  textDecoration:"none", background:SURF,
                }}
              >Open ↗</a>
              <button
                onClick={toggleStatus} disabled={toggling}
                style={{
                  flex:1, padding:"10px 0", borderRadius:10, border:"none",
                  fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
                  background: isLive ? "rgba(239,68,68,0.08)" : "rgba(16,185,129,0.08)",
                  color:      isLive ? RED : ACCENT,
                }}
              >{toggling ? "…" : isLive ? "Set Draft" : "Go Live"}</button>
              <button
                onClick={() => setConfirm(true)}
                style={{
                  width:40, borderRadius:10, border:`1px solid ${BORDER}`,
                  background:"#fff", fontSize:16, cursor:"pointer", color:MUTED,
                }}
              >🗑</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   CREATE TAB
══════════════════════════════════════════════════════════════ */
function CreateTab({ userId, onSuccess }: { userId: string | null; onSuccess: () => void }) {
  const [type,    setType]    = useState<"epage"|"ebook">("epage");
  const [title,   setTitle]   = useState("");
  const [desc,    setDesc]    = useState("");
  const [url,     setUrl]     = useState("");
  const [tags,    setTags]    = useState("");
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string|null>(null);
  const [urlErr,  setUrlErr]  = useState<string|null>(null);

  function validateUrl(): boolean {
    const val = url.trim();
    if (!val) { setUrlErr("URL is required"); return false; }
    try {
      const u = new URL(val);
      if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error();
      setUrlErr(null); return true;
    } catch {
      setUrlErr("Enter a valid URL (https://…)");
      return false;
    }
  }

  async function publish() {
    setError(null);
    if (!title.trim())  { setError("Title is required"); return; }
    if (!validateUrl()) return;
    if (!userId)        { setError("Not signed in"); return; }

    const rawTags = tags.split(",").map(t => t.trim()).filter(Boolean);
    if (rawTags.length > 10) { setError("Maximum 10 tags"); return; }
    if (rawTags.some(t => t.length > 30)) { setError("Each tag must be under 30 characters"); return; }

    setLoading(true);
    try {
      const { error: err } = await supabase.from("vibelearn_content").insert({
        title:        title.trim(),
        description:  desc.trim() || null,
        url:          url.trim(),
        type,
        tags:         rawTags,
        source:       subject || null,
        submitted_by: userId,
        view_count:   0,
        earnings_ksh: 0,
        status:       "live",
      });
      if (err) { setError(err.message); return; }
      onSuccess();
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  const field: React.CSSProperties = {
    width:"100%", boxSizing:"border-box",
    background:"#fff", border:`1px solid ${BORDER}`,
    borderRadius:12, padding:"13px 16px",
    fontSize:13, color:DARK, outline:"none",
    fontFamily:"inherit", appearance:"none",
  };
  const label: React.CSSProperties = {
    fontSize:10, color:MUTED, fontWeight:800,
    letterSpacing:1.2, textTransform:"uppercase",
    display:"block", marginBottom:7,
  };

  return (
    <div className="vl-up" style={{ display:"flex", flexDirection:"column", gap:16, paddingBottom:8 }}>

      {/* type toggle */}
      <div style={{ display:"flex", background:SURF, borderRadius:12, padding:4, border:`1px solid ${BORDER}` }}>
        {(["epage","ebook"] as const).map(t => (
          <button key={t} onClick={() => setType(t)} className="vl-btn" style={{
            flex:1, padding:"10px 0", border:"none", borderRadius:9,
            fontSize:12, fontWeight:800, cursor:"pointer", fontFamily:"inherit",
            background: type === t ? DARK : "transparent",
            color:      type === t ? "#fff" : MUTED,
            transition: "all 0.15s",
          }}>
            {t === "epage" ? "📄  Epage" : "📖  Ebook"}
          </button>
        ))}
      </div>

      <div>
        <label htmlFor="vl-title" style={label}>Title *</label>
        <input
          id="vl-title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Grade 8 Algebra Notes"
          style={field}
        />
      </div>

      <div>
        <label htmlFor="vl-desc" style={label}>Description</label>
        <textarea
          id="vl-desc"
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="What will students learn?"
          style={{ ...field, resize:"none", minHeight:80 }}
        />
      </div>

      <div>
        <label htmlFor="vl-subject" style={label}>Subject</label>
        <div style={{ position:"relative" }}>
          <select
            id="vl-subject"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            style={{ ...field, paddingRight:36 }}
          >
            <option value="">— Select subject —</option>
            {SUBJECTS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <span style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)", pointerEvents:"none", fontSize:11, color:MUTED }}>▾</span>
        </div>
      </div>

      <div>
        <label htmlFor="vl-url" style={label}>Content URL *</label>
        <input
          id="vl-url"
          value={url}
          onChange={e => { setUrl(e.target.value); setUrlErr(null); }}
          onBlur={validateUrl}
          placeholder="https://docs.google.com/…"
          style={{ ...field, borderColor: urlErr ? RED : BORDER }}
        />
        {urlErr && <div style={{ fontSize:11, color:RED, marginTop:5 }}>{urlErr}</div>}
      </div>

      <div>
        <label htmlFor="vl-tags" style={label}>Tags <span style={{ fontWeight:400, textTransform:"none", letterSpacing:0 }}>(max 10, comma separated)</span></label>
        <input
          id="vl-tags"
          value={tags}
          onChange={e => setTags(e.target.value)}
          placeholder="algebra, grade8, kcse"
          style={field}
        />
      </div>

      {error && (
        <div style={{
          background:"rgba(239,68,68,0.06)", border:`1px solid rgba(239,68,68,0.2)`,
          borderRadius:10, padding:"12px 14px", fontSize:12, color:RED, lineHeight:1.5,
        }}>
          {error}
        </div>
      )}

      <button
        onClick={publish}
        disabled={loading}
        className="vl-btn"
        style={{
          width:"100%", padding:"15px 0", borderRadius:13, border:"none",
          background: loading ? "rgba(30,27,75,0.35)" : DARK,
          color:"#fff", fontSize:15, fontWeight:800,
          cursor: loading ? "not-allowed" : "pointer",
          fontFamily:"inherit",
          boxShadow: loading ? "none" : "0 4px 14px rgba(30,27,75,0.28)",
          transition:"all 0.15s",
        }}
      >
        {loading ? "Publishing…" : "Publish to VibeLearn →"}
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   STATS TAB
══════════════════════════════════════════════════════════════ */
function StatsTab({ stats, items }: { stats: TeacherStats | null; items: Content[] }) {
  const hasContent = items.length > 0;
  const liveCount  = items.filter(i => i.status === "live").length;
  const topContent = [...items].sort((a, b) => b.view_count - a.view_count).slice(0, 3);

  if (!hasContent) return (
    <div className="vl-up" style={{ textAlign:"center", padding:"52px 24px" }}>
      <div style={{ fontSize:52, marginBottom:16 }}>📊</div>
      <div style={{ fontSize:17, fontWeight:800, color:DARK, marginBottom:8 }}>
        No stats yet
      </div>
      <div style={{ fontSize:13, color:MUTED, lineHeight:1.6 }}>
        Publish content first. Views, earnings and ranking will appear here once students start engaging.
      </div>
    </div>
  );

  const totalViews    = Number(stats?.total_views ?? 0);
  const totalEarnings = Number(stats?.total_earnings_ksh ?? 0);
  const rank          = stats?.teacher_rank ?? null;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

      {/* summary row */}
      <div className="vl-up" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        {[
          { label:"Total Views",    val: fmt(totalViews),     color:ACCENT, icon:"👁" },
          { label:"Total Earnings", val: ksh(totalEarnings),  color:DARK,   icon:"💰" },
          { label:"Live Content",   val: String(liveCount),   color:"#8b5cf6", icon:"✅" },
          { label:"Teacher Rank",   val: rank ? `#${rank}` : "—", color:GOLD, icon:"🏆" },
        ].map((s, i) => (
          <div key={s.label} className="vl-up" style={{
            background:"#fff", borderRadius:16, padding:"16px 14px",
            border:`1px solid ${BORDER}`, boxShadow:C.shadow,
            animationDelay:`${i * 0.06}s`,
          }}>
            <div style={{ fontSize:20, marginBottom:8 }}>{s.icon}</div>
            <div style={{ fontSize:20, fontWeight:800, color:s.color, lineHeight:1 }}>{s.val}</div>
            <div style={{ fontSize:10, color:MUTED, marginTop:4, fontWeight:600, letterSpacing:0.5 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* top content */}
      {topContent.length > 0 && (
        <div className="vl-up" style={{
          background:"#fff", borderRadius:16, border:`1px solid ${BORDER}`,
          overflow:"hidden", animationDelay:"0.1s",
        }}>
          <div style={{ padding:"14px 16px 10px", fontSize:10, fontWeight:800, color:MUTED, letterSpacing:1.4, textTransform:"uppercase" }}>
            Top Content by Views
          </div>
          {topContent.map((item, i) => (
            <div key={item.id} style={{
              display:"flex", alignItems:"center", gap:12,
              padding:"12px 16px",
              borderTop:`1px solid ${BORDER}`,
            }}>
              <div style={{
                width:28, height:28, borderRadius:8, flexShrink:0,
                background: item.type === "ebook"
                  ? "linear-gradient(135deg,#312e81,#1e1b4b)"
                  : "linear-gradient(135deg,#064e3b,#065f46)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:14,
              }}>
                {item.type === "ebook" ? "📖" : "📄"}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:700, color:DARK, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {item.title}
                </div>
                <div style={{ fontSize:10, color:MUTED, marginTop:2 }}>{fmt(item.view_count)} views · {ksh(item.earnings_ksh)}</div>
              </div>
              <div style={{
                fontSize:11, fontWeight:800, color: i === 0 ? GOLD : MUTED,
                minWidth:20, textAlign:"right",
              }}>
                #{i + 1}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* no views yet nudge */}
      {totalViews === 0 && (
        <div className="vl-up" style={{
          background:SURF, borderRadius:16, padding:"20px 18px",
          border:`1px solid ${BORDER}`, animationDelay:"0.15s",
        }}>
          <div style={{ fontSize:14, fontWeight:700, color:DARK, marginBottom:6 }}>
            No views yet
          </div>
          <div style={{ fontSize:12, color:MUTED, lineHeight:1.6 }}>
            Share your content links with students directly, or post them in your class group. Views and earnings update as students open your content.
          </div>
        </div>
      )}

    </div>
  );
}
