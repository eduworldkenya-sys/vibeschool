"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { C } from "@/components/teacher/ui";

/* ── types ── */
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
  subjects:     { name: string } | null;
}
interface Stats {
  content_count:     number;
  total_views:       number;
  total_earnings_ksh: number;
  teacher_rank:      number;
}
interface Subject { id: string; name: string; }

/* ── constants ── */
const DARK    = "#1e1b4b";
const ACCENT  = "#10b981";
const GOLD    = "#f59e0b";
const MUTED   = "#6b7280";
const BORDER  = "#e5e7eb";
const SURFACE = "#f8f9fa";
const RED     = "#ef4444";

const TABS = ["Content", "Create", "Stats"] as const;
type Tab = typeof TABS[number];

/* ── helpers ── */
function fmt(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
function ksh(n: number) {
  return `KSh ${n.toLocaleString("en-KE", { minimumFractionDigits: 0 })}`;
}

/* ══════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════ */
export default function VibeLearnPage() {
  const [tab,      setTab]      = useState<Tab>("Content");
  const [stats,    setStats]    = useState<Stats | null>(null);
  const [content,  setContent]  = useState<Content[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [userId,   setUserId]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);

    const [contentRes, statsRes] = await Promise.all([
      supabase
        .from("vibelearn_content")
        .select("id,title,description,type,url,tags,view_count,earnings_ksh,status,created_at,subjects(name)")
        .eq("submitted_by", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("vibelearn_teacher_stats")
        .select("content_count,total_views,total_earnings_ksh,teacher_rank")
        .eq("teacher_id", user.id)
        .maybeSingle(),
    ]);

    if (contentRes.data) setContent(contentRes.data as unknown as Content[]);
    if (statsRes.data)   setStats(statsRes.data as Stats);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ background: C.bg, minHeight: "100vh", paddingBottom: 80 }}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .vl-card { animation: fadeUp 0.28s ease both; }
        .vl-tab-btn:active { transform: scale(0.96); }
        .vl-item:active { transform: scale(0.985); }
      `}</style>

      {/* ── HERO ── */}
      <Hero stats={stats} loading={loading} />

      {/* ── TAB SWITCHER ── */}
      <div style={{ padding: "0 20px 0", marginTop: 20 }}>
        <div style={{
          display: "flex", background: SURFACE, borderRadius: 14,
          padding: 4, border: `1px solid ${BORDER}`,
        }}>
          {TABS.map(t => (
            <button
              key={t}
              className="vl-tab-btn"
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: "10px 0", border: "none", borderRadius: 11,
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                fontFamily: "inherit", transition: "all 0.18s",
                background: tab === t ? DARK : "transparent",
                color:      tab === t ? "#fff" : MUTED,
                boxShadow:  tab === t ? "0 2px 8px rgba(30,27,75,0.18)" : "none",
              }}
            >{t}</button>
          ))}
        </div>
      </div>

      {/* ── TAB CONTENT ── */}
      <div style={{ padding: "20px 20px 0" }}>
        {tab === "Content" && <ContentTab items={content} loading={loading} onRefresh={load} />}
        {tab === "Create"  && <CreateTab  userId={userId} onSuccess={() => { load(); setTab("Content"); }} />}
        {tab === "Stats"   && <StatsTab   stats={stats} items={content} />}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   HERO
══════════════════════════════════════════════ */
function Hero({ stats, loading }: { stats: Stats | null; loading: boolean }) {
  return (
    <div style={{
      margin: "0 0 0 0",
      background: `linear-gradient(135deg, ${DARK} 0%, #312e81 60%, #1e3a5f 100%)`,
      padding: "28px 24px 24px",
      position: "relative", overflow: "hidden",
    }}>
      {/* decorative circles */}
      <div style={{ position:"absolute", top:-40, right:-40, width:160, height:160, borderRadius:"50%", background:"rgba(16,185,129,0.12)", pointerEvents:"none" }} />
      <div style={{ position:"absolute", bottom:-30, left:10, width:100, height:100, borderRadius:"50%", background:"rgba(255,255,255,0.04)", pointerEvents:"none" }} />

      <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)", fontWeight:800, letterSpacing:2, textTransform:"uppercase", marginBottom:6 }}>
        VibeLearn Studio
      </div>

      {loading ? (
        <div style={{ height:52, borderRadius:10, background:"rgba(255,255,255,0.08)", animation:"shimmer 1.4s infinite", backgroundSize:"200% 100%" }} />
      ) : (
        <>
          <div style={{ fontSize:42, fontWeight:900, color:"#fff", lineHeight:1, letterSpacing:-1 }}>
            <span style={{ fontSize:22, fontWeight:600, color:"rgba(255,255,255,0.6)", marginRight:4 }}>KSh</span>
            {(stats?.total_earnings_ksh ?? 0).toLocaleString("en-KE")}
          </div>
          <div style={{ fontSize:12, color:ACCENT, marginTop:6, fontWeight:600 }}>
            ▲ Total earnings from your content
          </div>
        </>
      )}

      <div style={{ display:"flex", gap:12, marginTop:20 }}>
        {[
          { val: loading ? "—" : fmt(stats?.total_views ?? 0),     label:"Views"    },
          { val: loading ? "—" : String(stats?.content_count ?? 0), label:"Published"},
          { val: loading ? "—" : `#${stats?.teacher_rank ?? "—"}`,  label:"Rank",  gold:true },
        ].map(s => (
          <div key={s.label} style={{
            flex:1, background:"rgba(255,255,255,0.08)", borderRadius:12,
            padding:"12px 10px", textAlign:"center",
            border:"1px solid rgba(255,255,255,0.1)",
          }}>
            <div style={{ fontSize:20, fontWeight:800, color: s.gold ? GOLD : "#fff" }}>{s.val}</div>
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.45)", marginTop:3, fontWeight:600, letterSpacing:0.8, textTransform:"uppercase" }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   CONTENT TAB
══════════════════════════════════════════════ */
function ContentTab({ items, loading, onRefresh }: { items: Content[]; loading: boolean; onRefresh: () => void }) {
  if (loading) return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {[1,2,3].map(i => (
        <div key={i} style={{ height:88, borderRadius:16, background:"linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)", backgroundSize:"200% 100%", animation:"shimmer 1.4s infinite" }} />
      ))}
    </div>
  );

  if (items.length === 0) return (
    <div style={{ textAlign:"center", padding:"48px 0" }}>
      <div style={{ fontSize:48, marginBottom:16 }}>📭</div>
      <div style={{ fontSize:16, fontWeight:800, color:DARK, marginBottom:8 }}>No content yet</div>
      <div style={{ fontSize:13, color:MUTED }}>Switch to Create to publish your first ebook or epage.</div>
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {items.map((item, i) => (
        <ContentCard key={item.id} item={item} idx={i} onRefresh={onRefresh} />
      ))}
    </div>
  );
}

function ContentCard({ item, idx, onRefresh }: { item: Content; idx: number; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [toggling, setToggling] = useState(false);

  async function toggleStatus() {
    setToggling(true);
    const next = item.status === "live" ? "draft" : "live";
    await supabase.from("vibelearn_content").update({ status: next }).eq("id", item.id);
    setToggling(false);
    onRefresh();
  }

  const isLive = item.status === "live";

  return (
    <div
      className="vl-card vl-item"
      style={{
        background:"#fff", borderRadius:16, border:`1px solid ${BORDER}`,
        overflow:"hidden", cursor:"pointer",
        boxShadow:"0 1px 4px rgba(0,0,0,0.06)",
        animationDelay:`${idx * 0.05}s`,
        transition:"box-shadow 0.18s",
      }}
      onClick={() => setExpanded(e => !e)}
    >
      <div style={{ padding:"16px 16px 14px", display:"flex", gap:14, alignItems:"flex-start" }}>
        {/* type badge */}
        <div style={{
          width:44, height:44, borderRadius:12, flexShrink:0,
          display:"flex", alignItems:"center", justifyContent:"center",
          background: item.type === "ebook"
            ? "linear-gradient(135deg,#312e81,#1e1b4b)"
            : "linear-gradient(135deg,#064e3b,#065f46)",
          fontSize:20,
        }}>
          {item.type === "ebook" ? "📖" : "📄"}
        </div>

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:700, color:DARK, lineHeight:1.3, marginBottom:3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {item.title}
          </div>
          <div style={{ fontSize:11, color:MUTED, marginBottom:6 }}>
            {item.subjects?.name ?? "No subject"} · {new Date(item.created_at).toLocaleDateString("en-KE", { day:"numeric", month:"short" })}
          </div>
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            <span style={{
              fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20,
              background: isLive ? "rgba(16,185,129,0.12)" : "rgba(107,114,128,0.12)",
              color:      isLive ? ACCENT : MUTED,
            }}>
              {isLive ? "● LIVE" : "DRAFT"}
            </span>
            <span style={{ fontSize:10, color:MUTED }}>{item.type.toUpperCase()}</span>
          </div>
        </div>

        <div style={{ textAlign:"right", flexShrink:0 }}>
          <div style={{ fontSize:15, fontWeight:800, color:ACCENT }}>{ksh(item.earnings_ksh)}</div>
          <div style={{ fontSize:10, color:MUTED, marginTop:2 }}>{fmt(item.view_count)} views</div>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop:`1px solid ${BORDER}`, padding:"12px 16px", display:"flex", gap:10 }}
          onClick={e => e.stopPropagation()}
        >
          <a
            href={item.url} target="_blank" rel="noreferrer"
            style={{
              flex:1, padding:"10px 0", borderRadius:10, border:`1px solid ${BORDER}`,
              fontSize:12, fontWeight:700, color:DARK, textAlign:"center",
              textDecoration:"none", background:SURFACE,
            }}
          >
            Open URL
          </a>
          <button
            onClick={toggleStatus}
            disabled={toggling}
            style={{
              flex:1, padding:"10px 0", borderRadius:10, border:"none",
              fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
              background: isLive ? "rgba(239,68,68,0.08)" : "rgba(16,185,129,0.10)",
              color:      isLive ? RED : ACCENT,
            }}
          >
            {toggling ? "…" : isLive ? "Set Draft" : "Go Live"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   CREATE TAB
══════════════════════════════════════════════ */
function CreateTab({ userId, onSuccess }: { userId: string | null; onSuccess: () => void }) {
  const [type,     setType]     = useState<"epage"|"ebook">("epage");
  const [title,    setTitle]    = useState("");
  const [desc,     setDesc]     = useState("");
  const [url,      setUrl]      = useState("");
  const [tags,     setTags]     = useState("");
  const [subjectId,setSubjectId]= useState("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string|null>(null);
  const [urlErr,   setUrlErr]   = useState<string|null>(null);

  useEffect(() => {
    supabase.from("subjects").select("id,name").then(({ data }) => {
      if (data) setSubjects(data as Subject[]);
    });
  }, []);

  function validateUrl(): boolean {
    if (!url.trim()) { setUrlErr("URL is required"); return false; }
    try {
      const u = new URL(url.trim());
      if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error();
      setUrlErr(null); return true;
    } catch {
      setUrlErr("Enter a valid URL starting with https://");
      return false;
    }
  }

  async function publish() {
    setError(null);
    if (!title.trim()) { setError("Title is required"); return; }
    if (!validateUrl()) return;
    if (!userId) { setError("Not signed in"); return; }

    setLoading(true);
    const tagsArr = tags.split(",").map(t => t.trim()).filter(Boolean);
    const { error: err } = await supabase.from("vibelearn_content").insert({
      title:        title.trim(),
      description:  desc.trim() || null,
      url:          url.trim(),
      type,
      tags:         tagsArr,
      subject_id:   subjectId || null,
      submitted_by: userId,
      view_count:   0,
      earnings_ksh: 0,
      status:       "live",
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    onSuccess();
  }

  const inputStyle = {
    width:"100%", boxSizing:"border-box" as const,
    background:"#fff", border:`1px solid ${BORDER}`,
    borderRadius:12, padding:"13px 16px",
    fontSize:13, color:DARK, outline:"none",
    fontFamily:"inherit",
  };
  const labelStyle = {
    fontSize:10, color:MUTED, fontWeight:800,
    letterSpacing:1.2, textTransform:"uppercase" as const,
    display:"block", marginBottom:7,
  };

  return (
    <div className="vl-card" style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* type toggle */}
      <div style={{ display:"flex", background:SURFACE, borderRadius:12, padding:4, border:`1px solid ${BORDER}` }}>
        {(["epage","ebook"] as const).map(t => (
          <button key={t} onClick={() => setType(t)} style={{
            flex:1, padding:"10px 0", border:"none", borderRadius:9,
            fontSize:12, fontWeight:800, cursor:"pointer", fontFamily:"inherit",
            background: type === t ? DARK : "transparent",
            color:      type === t ? "#fff" : MUTED,
            transition: "all 0.18s",
          }}>
            {t === "epage" ? "📄 EPAGE" : "📖 EBOOK"}
          </button>
        ))}
      </div>

      {/* title */}
      <div>
        <label style={labelStyle}>Title *</label>
        <input value={title} onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Grade 8 Algebra Notes"
          style={inputStyle} />
      </div>

      {/* description */}
      <div>
        <label style={labelStyle}>Description</label>
        <textarea value={desc} onChange={e => setDesc(e.target.value)}
          placeholder="What will students learn from this?"
          rows={3}
          style={{ ...inputStyle, resize:"none" }} />
      </div>

      {/* subject */}
      {subjects.length > 0 && (
        <div>
          <label style={labelStyle}>Subject</label>
          <select value={subjectId} onChange={e => setSubjectId(e.target.value)}
            style={{ ...inputStyle, appearance:"none" }}>
            <option value="">— Select subject —</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}

      {/* url */}
      <div>
        <label style={labelStyle}>Content URL *</label>
        <input value={url} onChange={e => { setUrl(e.target.value); setUrlErr(null); }}
          onBlur={validateUrl}
          placeholder="https://docs.google.com/..."
          style={{ ...inputStyle, borderColor: urlErr ? RED : BORDER }} />
        {urlErr && <div style={{ fontSize:11, color:RED, marginTop:5 }}>{urlErr}</div>}
      </div>

      {/* tags */}
      <div>
        <label style={labelStyle}>Tags</label>
        <input value={tags} onChange={e => setTags(e.target.value)}
          placeholder="algebra, grade8, kcse — comma separated"
          style={inputStyle} />
      </div>

      {/* earn preview */}
      <div style={{
        background:"linear-gradient(135deg,#ecfdf5,#d1fae5)",
        borderRadius:14, padding:"14px 16px",
        display:"flex", alignItems:"center", gap:12,
        border:"1px solid rgba(16,185,129,0.2)",
      }}>
        <div style={{ fontSize:28 }}>💰</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:700, color:DARK }}>Estimated Monthly Earnings</div>
          <div style={{ fontSize:11, color:MUTED, marginTop:2 }}>Based on similar content on VibeLearn</div>
        </div>
        <div style={{ fontSize:18, fontWeight:800, color:ACCENT }}>KSh 1,200+</div>
      </div>

      {error && (
        <div style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:10, padding:"12px 14px", fontSize:12, color:RED }}>
          {error}
        </div>
      )}

      <button onClick={publish} disabled={loading} style={{
        width:"100%", padding:"16px 0", borderRadius:14, border:"none",
        background: loading ? "rgba(30,27,75,0.4)" : DARK,
        color:"#fff", fontSize:15, fontWeight:800,
        cursor: loading ? "not-allowed" : "pointer",
        fontFamily:"inherit", letterSpacing:0.3,
        boxShadow: loading ? "none" : "0 4px 16px rgba(30,27,75,0.3)",
        transition:"all 0.18s",
      }}>
        {loading ? "Publishing…" : "Publish to VibeLearn →"}
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════
   STATS TAB
══════════════════════════════════════════════ */
function StatsTab({ stats, items }: { stats: Stats | null; items: Content[] }) {
  const totalViews = items.reduce((s, i) => s + i.view_count, 0);
  const liveCount  = items.filter(i => i.status === "live").length;
  const avgViews   = items.length > 0 ? Math.round(totalViews / items.length) : 0;

  const completionRate = 81; // placeholder — wire to vibelearn_completed when ready
  const saveRate       = 55;
  const searchAppear   = 73;
  const indexScore     = Math.min(100, Math.round(
    (completionRate * 0.4) + (saveRate * 0.3) + (searchAppear * 0.3)
  ));

  const signals = [
    { label:"Completion Rate",   val:`${completionRate}%`, pct:completionRate, color:ACCENT },
    { label:"Save Rate",         val:`${saveRate}%`,       pct:saveRate,       color:GOLD   },
    { label:"Search Visibility", val:`${searchAppear}%`,   pct:searchAppear,   color:DARK   },
    { label:"Live Content",      val:String(liveCount),    pct: items.length > 0 ? Math.round((liveCount/items.length)*100) : 0, color:"#8b5cf6" },
  ];

  const tips = [
    { icon:"🚀", title:"Add tags to untagged content", desc:"Tagged content appears 3× more in student searches." },
    { icon:"📅", title:"Publish consistently", desc:"Weekly publishing boosts your freshness score." },
    { icon:"✍️", title:"Improve descriptions", desc:"Richer descriptions improve click-through from search." },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* index score */}
      <div className="vl-card" style={{
        background:`linear-gradient(135deg,${DARK},#312e81)`,
        borderRadius:20, padding:"22px 20px",
        display:"flex", alignItems:"center", gap:20,
      }}>
        {/* score ring */}
        <div style={{
          width:80, height:80, borderRadius:"50%", flexShrink:0,
          background:`conic-gradient(${ACCENT} 0deg ${indexScore * 3.6}deg, rgba(255,255,255,0.1) ${indexScore * 3.6}deg 360deg)`,
          display:"flex", alignItems:"center", justifyContent:"center",
        }}>
          <div style={{
            width:60, height:60, borderRadius:"50%",
            background:DARK,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:18, fontWeight:900, color:ACCENT,
          }}>
            {indexScore}
          </div>
        </div>
        <div>
          <div style={{ fontSize:18, fontWeight:800, color:"#fff" }}>
            {indexScore >= 80 ? "Excellent" : indexScore >= 60 ? "Good Standing" : "Needs Work"}
          </div>
          <div style={{ fontSize:12, color:"rgba(255,255,255,0.5)", marginTop:4, lineHeight:1.5 }}>
            Your content index score. Higher score = more student visibility.
          </div>
          {stats?.teacher_rank && (
            <div style={{
              display:"inline-flex", alignItems:"center", gap:4,
              background:"rgba(245,158,11,0.15)", color:GOLD,
              padding:"4px 10px", borderRadius:20, fontSize:11, fontWeight:700,
              marginTop:8,
            }}>
              🏆 Rank #{stats.teacher_rank} Teacher
            </div>
          )}
        </div>
      </div>

      {/* signals grid */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        {signals.map(s => (
          <div key={s.label} style={{
            background:"#fff", borderRadius:16, padding:"16px 14px",
            border:`1px solid ${BORDER}`,
            boxShadow:"0 1px 4px rgba(0,0,0,0.05)",
          }}>
            <div style={{ fontSize:22, fontWeight:800, color:s.color }}>{s.val}</div>
            <div style={{ fontSize:10, color:MUTED, marginTop:2, fontWeight:600, letterSpacing:0.5 }}>{s.label}</div>
            <div style={{ height:3, background:BORDER, borderRadius:10, marginTop:10, overflow:"hidden" }}>
              <div style={{ height:"100%", borderRadius:10, background:s.color, width:`${s.pct}%`, transition:"width 0.8s ease" }} />
            </div>
          </div>
        ))}
      </div>

      {/* tips */}
      <div style={{ background:"#fff", borderRadius:16, border:`1px solid ${BORDER}`, overflow:"hidden" }}>
        <div style={{ padding:"14px 16px 10px", fontSize:10, fontWeight:800, color:MUTED, letterSpacing:1.4, textTransform:"uppercase" }}>
          Improve Your Score
        </div>
        {tips.map((t, i) => (
          <div key={t.title} style={{
            display:"flex", gap:14, alignItems:"flex-start",
            padding:"14px 16px",
            borderTop: i === 0 ? `1px solid ${BORDER}` : `1px solid ${BORDER}`,
          }}>
            <div style={{
              width:36, height:36, borderRadius:10, flexShrink:0,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:18, background:SURFACE,
            }}>
              {t.icon}
            </div>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:DARK }}>{t.title}</div>
              <div style={{ fontSize:11, color:MUTED, marginTop:3, lineHeight:1.5 }}>{t.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
