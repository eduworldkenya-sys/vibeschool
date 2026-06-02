"use client";
'use client'

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { C } from "@/components/teacher/ui";

interface ContentRow {
  id:           string;
  title:        string;
  view_count:   number;
  earnings_ksh: number;
  tags:         string[];
  description:  string;
  url:          string;
  status:       string;
  created_at:   string;
}

// Score uses live items only — draft views should not inflate ranking signals
function score(items: ContentRow[]): number {
  if (items.length === 0) return 0;
  const live      = items.filter(c => c.status === "live");
  const all       = items;
  const liveViews = live.reduce((a, c) => a + c.view_count, 0);
  const tagged    = all.filter(c => c.tags?.length > 0).length;
  const described = all.filter(c => c.description?.trim().length > 20).length;
  const hasUrl    = all.filter(c => c.url?.trim()).length;

  const liveScore = Math.min((live.length / Math.max(all.length, 1)) * 30, 30);
  const viewScore = Math.min(liveViews * 2, 30);
  const tagScore  = Math.min((tagged    / all.length) * 20, 20);
  const descScore = Math.min((described / all.length) * 10, 10);
  const urlScore  = Math.min((hasUrl    / all.length) * 10, 10);

  return Math.round(liveScore + viewScore + tagScore + descScore + urlScore);
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
`;

function ScoreRing({ value, max = 100 }: { value: number; max?: number }) {
  const pct   = value / max;
  const r     = 38;
  const circ  = 2 * Math.PI * r;
  const dash  = circ * pct;
  const color = value >= 70 ? C.accent : value >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={100} height={100} viewBox="0 0 100 100" aria-label={`Index score: ${value} out of ${max}`}>
      <circle cx={50} cy={50} r={r} fill="none" stroke="#f0f0f0" strokeWidth={10} />
      <circle cx={50} cy={50} r={r} fill="none" stroke={color} strokeWidth={10}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 50 50)"
        style={{ transition: "stroke-dasharray 0.8s ease" }}
      />
      <text x={50} y={50} textAnchor="middle" dominantBaseline="central"
        style={{ fontSize: 20, fontWeight: 800, fill: color, fontFamily: "inherit" }}>
        {value}
      </text>
    </svg>
  );
}

export default function IndexerPage() {
  const router  = useRouter();
  const mounted = useRef(true);

  const [items,   setItems]   = useState<ContentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rank,    setRank]    = useState<number | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/teacher/login"); return; }

      const [contentRes, statsRes] = await Promise.all([
        supabase
          .from("vibelearn_content")
          .select("id,title,view_count,earnings_ksh,tags,description,url,status,created_at")
          .eq("submitted_by", user.id),
        supabase
          .from("vibelearn_teacher_stats")
          .select("teacher_rank")
          .eq("teacher_id", user.id)
          .maybeSingle(),
      ]);

      if (!mounted.current) return;
      setItems(contentRes.data ?? []);
      setRank(statsRes.data?.teacher_rank ?? null);
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const indexScore  = score(items);
  const live        = items.filter(c => c.status === "live").length;
  const totalViews  = items.filter(c => c.status === "live").reduce((a, c) => a + c.view_count, 0);
  const tagged      = items.filter(c => c.tags?.length > 0).length;
  const described   = items.filter(c => c.description?.trim().length > 20).length;

  // Sort immutably — no mutation of state array
  const sortedByDate = [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const latestDate   = sortedByDate[0] ? new Date(sortedByDate[0].created_at) : null;
  const publishedThisWeek = latestDate ? Date.now() - latestDate.getTime() < 7 * 86400000 : false;

  const tips: { icon: string; title: string; body: string; done: boolean }[] = [
    { icon: "📄", title: "Publish at least 1 live content",   body: "Live content is indexed and discoverable by students.",         done: live > 0 },
    { icon: "🏷️", title: "Add tags to all content",           body: "Tagged content appears 3× more in student searches.",          done: tagged === items.length && items.length > 0 },
    { icon: "📝", title: "Add descriptions to all content",   body: "Rich descriptions improve click-through from search.",         done: described === items.length && items.length > 0 },
    { icon: "👁️", title: "Get your first 10 views",           body: "Views signal quality to the ranking engine.",                  done: totalViews >= 10 },
    { icon: "📚", title: "Publish 5+ pieces of content",      body: "Volume increases your search surface area.",                   done: items.length >= 5 },
    { icon: "🔄", title: "Publish at least weekly",           body: "Freshness boosts your index score over time.",                 done: publishedThisWeek },
  ];

  const card: React.CSSProperties = {
    background: C.bg, borderRadius: 16,
    border: `1px solid ${C.border}`,
    padding: "16px 18px", marginBottom: 14,
    boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
  };

  if (loading) return (
    <>
      <style>{SHIMMER_CSS}</style>
      <div style={{ padding: 0 }}>
        {[1,2,3].map(i => (
          <div key={i} style={{ ...card, background: "linear-gradient(90deg,#f0f0f0 25%,#e4e4e4 50%,#f0f0f0 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite", height: 80 }} />
        ))}
      </div>
    </>
  );

  return (
    <>
      <style>{SHIMMER_CSS}</style>
      <div style={{ animation: "slideIn 0.22s ease" }}>

        {/* Header */}
        <div style={{ background: `linear-gradient(135deg,${C.dark} 0%,#312e81 100%)`, borderRadius: 20, padding: "20px", marginBottom: 14, color: "#fff" }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>VibeLearn</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Content Indexer</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>How VibeLearn ranks your content for student discovery</div>
        </div>

        {/* Score card */}
        <div style={{ ...card, display: "flex", alignItems: "center", gap: 20 }}>
          <ScoreRing value={indexScore} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.textPrimary }}>
              {indexScore >= 70 ? "Good Standing" : indexScore >= 40 ? "Needs Work" : "Getting Started"}
            </div>
            <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4, lineHeight: 1.5 }}>
              {rank ? `Ranked #${rank} among all teachers on the platform.` : "Publish content to get ranked."}
            </div>
            {rank && (
              <div style={{ display: "inline-block", marginTop: 8, padding: "4px 12px", borderRadius: 20, background: "#fef3c7", color: "#b45309", fontSize: 11, fontWeight: 700 }}>
                🏆 Rank #{rank}
              </div>
            )}
          </div>
        </div>

        {/* Signal bars */}
        <div style={card}>
          <div style={{ fontSize: 10, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1.4, marginBottom: 14 }}>Ranking Signals</div>
          {[
            { label: "Live Content",    value: live,        max: Math.max(items.length, 1), suffix: ` / ${items.length}`, color: C.accent   },
            { label: "Live Views",      value: totalViews,  max: 50,                         suffix: " views",             color: "#0284c7"  },
            { label: "Tagged Content",  value: tagged,      max: Math.max(items.length, 1), suffix: ` / ${items.length}`, color: "#7c3aed"  },
            { label: "Has Description", value: described,   max: Math.max(items.length, 1), suffix: ` / ${items.length}`, color: "#f59e0b"  },
          ].map(s => (
            <div key={s.label} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.textPrimary }}>{s.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.value}{s.suffix}</span>
              </div>
              <div style={{ height: 6, background: "#f3f4f6", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 10, background: s.color, width: `${Math.min((s.value / s.max) * 100, 100)}%`, transition: "width 0.8s ease" }} />
              </div>
            </div>
          ))}
        </div>

        {/* Tips */}
        <div style={card}>
          <div style={{ fontSize: 10, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1.4, marginBottom: 14 }}>Improve Your Score</div>
          {tips.map((tip, i) => (
            <div key={tip.title} style={{ display: "flex", gap: 12, alignItems: "flex-start", paddingBottom: 14, marginBottom: i < tips.length - 1 ? 14 : 0, borderBottom: i < tips.length - 1 ? `1px solid ${C.border}` : "none" }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, background: tip.done ? "#d1fae5" : "#f3f4f6", transition: "background 0.3s ease" }}>
                {tip.done ? "✓" : tip.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: tip.done ? C.accent : C.textPrimary, textDecoration: tip.done ? "line-through" : "none", transition: "all 0.3s ease" }}>{tip.title}</div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3, lineHeight: 1.5 }}>{tip.body}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Content performance table */}
        {items.length > 0 && (
          <div style={card}>
            <div style={{ fontSize: 10, fontWeight: 800, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1.4, marginBottom: 14 }}>Your Content Performance</div>
            {[...items].sort((a, b) => b.view_count - a.view_count).map((item, i) => (
              <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : "none" }}>
                <div style={{ fontSize: 14, flexShrink: 0, width: 24, textAlign: "center", color: C.textMuted, fontWeight: 800 }}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 3 }}>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: item.status === "live" ? "#d1fae5" : "#f3f4f6", color: item.status === "live" ? "#065f46" : C.textMuted, fontWeight: 700 }}>{item.status}</span>
                    {item.tags?.slice(0, 2).map(t => <span key={t} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: "#f3f4f6", color: C.textMuted }}>{t}</span>)}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>{item.view_count} views</div>
                  <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 600 }}>KSH {(item.earnings_ksh ?? 0).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </>
  );
}
