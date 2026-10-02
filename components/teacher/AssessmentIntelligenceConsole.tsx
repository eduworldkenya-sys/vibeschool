"use client";

import React from "react";
import { supabase } from "@/lib/supabase";

type MovementSegment =
  | "strong_improving"
  | "strong_steady"
  | "strong_declining"
  | "recovering"
  | "needs_support"
  | "at_risk_declining"
  | "meeting"
  | "absent";

type Intelligence = {
  context: {
    exam_id: string;
    exam_name: string;
    class_id: string;
    class_name: string;
    class_stream?: string | null;
    subject_id: string;
    subject_name: string;
    pass_mark: number;
  };
  evidence_quality: {
    exam_scope: "aggregate";
    has_previous_exam: boolean;
    has_outcome_evidence: boolean;
    outcome_scope: "longitudinal_subject" | "none";
    outcome_note: string;
  };
  completion: { roster: number; recorded: number; absent: number; remaining: number; percent: number };
  headline_metrics: {
    mean: number | null;
    median: number | null;
    highest: number | null;
    lowest: number | null;
    passed: number;
    below: number;
    meeting_percent: number | null;
    previous_mean: number | null;
    mean_change: number | null;
    previous_exam_name: string | null;
  };
  performance_distribution: Record<"EE" | "ME" | "AE" | "BE", number>;
  historical_trajectory: Array<{ exam_id: string; name: string; type: string; mean: number | null; learners: number }>;
  learner_rankings: Array<{ student_id: string; name: string; marks: number }>;
  learner_movements: Array<{
    student_id: string;
    name: string;
    marks: number;
    previous_marks: number | null;
    change: number | null;
    segment: MovementSegment;
  }>;
  performance_segments: Record<string, number>;
  outcome_weaknesses: Array<{
    outcome_id: string;
    outcome_text: string;
    mastery_score: number | null;
    evidence_count: number;
    repeated_weakness_count: number;
    learners_affected: number;
    confidence_score: number | null;
  }>;
  intervention_effects: Array<{
    id: string;
    student_id: string;
    student_name: string | null;
    recommendation: string | null;
    baseline: number | null;
    followup: number | null;
    change: number | null;
    status: string;
  }>;
  attention_items: Array<{ severity: string; title: string; detail: string; action: string }>;
  recommended_actions: Array<{ id: string; label: string; enabled: boolean; action: string }>;
};

type Props = {
  examId: string;
  classId: string;
  subjectId: string;
  refreshKey: string;
  onOpenMarkbook: () => void;
};

const C = {
  ink: "#111827",
  muted: "#6B7280",
  line: "#E5E7EB",
  panel: "#FFFFFF",
  canvas: "#F7F7F5",
  green: "#087A55",
  greenSoft: "#ECFDF5",
  amber: "#A16207",
  amberSoft: "#FFFBEB",
  red: "#B42318",
  redSoft: "#FFF1F0",
  indigo: "#4338CA",
  indigoSoft: "#EEF2FF",
};

function format(value: number | null | undefined, digits = 1) {
  return value == null || !Number.isFinite(value) ? "—" : value.toFixed(digits);
}

function segmentLabel(segment: MovementSegment) {
  const labels: Record<MovementSegment, string> = {
    strong_improving: "Strong & improving",
    strong_steady: "Strong & steady",
    strong_declining: "Strong but declining",
    recovering: "Recovering",
    needs_support: "Needs support",
    at_risk_declining: "At risk",
    meeting: "Meeting expectation",
    absent: "Absent",
  };
  return labels[segment];
}

function segmentTone(segment: MovementSegment) {
  if (segment === "strong_improving" || segment === "recovering") return { bg: C.greenSoft, fg: C.green };
  if (segment === "at_risk_declining" || segment === "strong_declining") return { bg: C.redSoft, fg: C.red };
  if (segment === "needs_support") return { bg: C.amberSoft, fg: C.amber };
  return { bg: "#F3F4F6", fg: "#4B5563" };
}

function Metric({ label, value, detail, emphasis }: { label: string; value: string; detail?: string; emphasis?: "good" | "bad" | "neutral" }) {
  const fg = emphasis === "good" ? C.green : emphasis === "bad" ? C.red : C.ink;
  return (
    <div style={{ minWidth: 154, flex: "1 0 154px", padding: "16px 17px", border: `1px solid ${C.line}`, borderRadius: 16, background: C.panel }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: C.muted }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 29, lineHeight: 1, fontWeight: 850, letterSpacing: "-.04em", color: fg }}>{value}</div>
      {detail && <div style={{ marginTop: 7, fontSize: 12, color: C.muted, lineHeight: 1.35 }}>{detail}</div>}
    </div>
  );
}

function Sparkline({ points }: { points: Array<{ name: string; mean: number | null }> }) {
  const valid = points.filter(p => p.mean != null) as Array<{ name: string; mean: number }>;
  if (valid.length < 2) return <div style={{ padding: 22, color: C.muted, fontSize: 13 }}>A trend appears after at least two assessments have comparable results.</div>;
  const width = 640;
  const height = 190;
  const pad = 26;
  const values = valid.map(p => p.mean);
  const min = Math.max(0, Math.min(...values) - 8);
  const max = Math.min(100, Math.max(...values) + 8);
  const span = Math.max(1, max - min);
  const coords = valid.map((p, i) => ({
    ...p,
    x: pad + (i * (width - pad * 2)) / Math.max(1, valid.length - 1),
    y: height - pad - ((p.mean - min) / span) * (height - pad * 2),
  }));
  const path = coords.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  return (
    <div style={{ overflowX: "auto" }}>
      <svg role="img" aria-label="Class mean across assessments" viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", minWidth: 520, display: "block" }}>
        {[0, 1, 2, 3].map(i => <line key={i} x1={pad} x2={width - pad} y1={pad + i * 42} y2={pad + i * 42} stroke="#EEF0F2" />)}
        <path d={path} fill="none" stroke={C.indigo} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map(point => (
          <g key={point.name}>
            <circle cx={point.x} cy={point.y} r="5" fill="#fff" stroke={C.indigo} strokeWidth="3" />
            <text x={point.x} y={point.y - 12} textAnchor="middle" fontSize="11" fontWeight="800" fill={C.ink}>{point.mean.toFixed(1)}</text>
            <text x={point.x} y={height - 5} textAnchor="middle" fontSize="10" fill={C.muted}>{point.name.length > 16 ? `${point.name.slice(0, 14)}…` : point.name}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function Distribution({ data }: { data: Intelligence["performance_distribution"] }) {
  const total = Object.values(data).reduce((sum, n) => sum + n, 0);
  const tones: Record<string, string> = { EE: "#087A55", ME: "#2563EB", AE: "#D97706", BE: "#C2413A" };
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {(["EE", "ME", "AE", "BE"] as const).map(key => {
        const pct = total ? Math.round((data[key] / total) * 100) : 0;
        return <div key={key} style={{ display: "grid", gridTemplateColumns: "34px minmax(0,1fr) 70px", gap: 10, alignItems: "center" }}>
          <strong style={{ fontSize: 12 }}>{key}</strong>
          <div style={{ height: 10, borderRadius: 999, background: "#EEF0F2", overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: tones[key], transition: "width .25s ease" }} />
          </div>
          <span style={{ fontSize: 12, textAlign: "right", color: C.muted }}>{data[key]} · {pct}%</span>
        </div>;
      })}
    </div>
  );
}

function MovementMatrix({ movements, passMark, onSelect }: { movements: Intelligence["learner_movements"]; passMark: number; onSelect: (id: string) => void }) {
  const plotted = movements.filter(m => m.change != null && m.segment !== "absent");
  if (plotted.length < 2) return <div style={{ padding: 22, color: C.muted, fontSize: 13 }}>Learner movement appears when this class has comparable previous results.</div>;
  return (
    <div>
      <div style={{ position: "relative", height: 300, border: `1px solid ${C.line}`, borderRadius: 16, overflow: "hidden", background: "linear-gradient(90deg,#FFF8F7 0 50%,#F3FCF8 50%),linear-gradient(#F6F9FF 0 50%,#FFFDF5 50%)" }}>
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "#D1D5DB" }} />
        <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: "#D1D5DB" }} />
        <span style={{ position: "absolute", top: 10, left: 12, fontSize: 10, fontWeight: 800, color: C.muted }}>BELOW TARGET · IMPROVING</span>
        <span style={{ position: "absolute", top: 10, right: 12, fontSize: 10, fontWeight: 800, color: C.muted }}>STRONG · IMPROVING</span>
        <span style={{ position: "absolute", bottom: 10, left: 12, fontSize: 10, fontWeight: 800, color: C.muted }}>AT RISK</span>
        <span style={{ position: "absolute", bottom: 10, right: 12, fontSize: 10, fontWeight: 800, color: C.muted }}>STRONG · DECLINING</span>
        {plotted.map(m => {
          const x = Math.max(5, Math.min(95, m.marks));
          const change = Math.max(-20, Math.min(20, m.change ?? 0));
          const y = 50 - change * 2;
          const tone = segmentTone(m.segment);
          return <button key={m.student_id} onClick={() => onSelect(m.student_id)} title={`${m.name}: ${m.marks}, ${m.change && m.change > 0 ? "+" : ""}${m.change}`} style={{ position: "absolute", left: `calc(${x}% - 7px)`, top: `calc(${Math.max(7, Math.min(93, y))}% - 7px)`, width: 15, height: 15, borderRadius: 999, border: "2px solid #fff", boxShadow: "0 1px 5px rgba(0,0,0,.18)", background: tone.fg, cursor: "pointer" }} aria-label={`Open ${m.name}`} />;
        })}
      </div>
      <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", fontSize: 11, color: C.muted }}><span>Lower performance</span><span>Pass mark {passMark}%</span><span>Higher performance</span></div>
    </div>
  );
}

export default function AssessmentIntelligenceConsole({ examId, classId, subjectId, refreshKey, onOpenMarkbook }: Props) {
  const [data, setData] = React.useState<Intelligence | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = React.useState<string | null>(null);
  const [section, setSection] = React.useState<"overview" | "learners" | "outcomes" | "actions">("overview");
  const [learnerFilter, setLearnerFilter] = React.useState<"all" | "help" | "improving" | "declining">("all");
  const [learnerSearch, setLearnerSearch] = React.useState("");

  React.useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      const response = await supabase.rpc("teacher_get_assessment_intelligence" as never, { p_exam_id: examId, p_class_id: classId, p_subject_id: subjectId } as never);
      if (!active) return;
      if (response.error) {
        setError("Exam review could not be loaded. Your marks remain safe.");
        setData(null);
      } else {
        setData(response.data as Intelligence);
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [examId, classId, subjectId, refreshKey]);

  if (loading) return <div style={{ display: "grid", gap: 12 }}><div style={{ height: 112, borderRadius: 18, background: "#F3F4F6" }} /><div style={{ height: 260, borderRadius: 18, background: "#F3F4F6" }} /></div>;
  if (error || !data) return <div role="alert" style={{ padding: 18, border: `1px solid #FECACA`, borderRadius: 16, color: C.red, background: C.redSoft }}>{error ?? "No intelligence is available yet."}</div>;

  const h = data.headline_metrics;
  const changeText = h.mean_change == null ? "No comparable previous exam" : `${h.mean_change >= 0 ? "+" : ""}${format(h.mean_change)} vs ${h.previous_exam_name ?? "previous"}`;
  const changeEmphasis = h.mean_change == null ? "neutral" : h.mean_change > 0 ? "good" : h.mean_change < 0 ? "bad" : "neutral";
  const top = data.learner_rankings[0];
  const atRisk = data.learner_movements.filter(m => m.segment === "at_risk_declining");
  const support = data.learner_movements.filter(m => ["needs_support", "at_risk_declining", "recovering"].includes(m.segment));
  const biggestImprovement = [...data.learner_movements].filter(m => m.change != null).sort((a, b) => (b.change ?? 0) - (a.change ?? 0))[0];
  const biggestDecline = [...data.learner_movements].filter(m => m.change != null).sort((a, b) => (a.change ?? 0) - (b.change ?? 0))[0];
  const selected = data.learner_movements.find(m => m.student_id === selectedStudentId) ?? null;
  const filteredLearners = data.learner_movements
    .filter(m => {
      if (learnerFilter === "help" && !["needs_support", "at_risk_declining", "recovering"].includes(m.segment)) return false;
      if (learnerFilter === "improving" && !["strong_improving", "recovering"].includes(m.segment)) return false;
      if (learnerFilter === "declining" && !["strong_declining", "at_risk_declining"].includes(m.segment)) return false;
      return m.name.toLowerCase().includes(learnerSearch.trim().toLowerCase());
    })
    .sort((a, b) => b.marks - a.marks);

  const summary = h.mean == null
    ? "There are not enough recorded marks yet to interpret this class."
    : data.completion.remaining > 0
      ? `${data.completion.remaining} learner${data.completion.remaining === 1 ? "" : "s"} still need a result. Current signals are provisional until marking is complete.`
      : h.mean_change != null
        ? `The class mean is ${format(h.mean)}%. It ${h.mean_change >= 0 ? "improved" : "declined"} by ${format(Math.abs(h.mean_change))} points from ${h.previous_exam_name ?? "the previous assessment"}. ${support.length ? `${support.length} learner${support.length === 1 ? " needs" : "s need"} attention.` : "No learner is currently below the pass threshold."}`
        : `The class mean is ${format(h.mean)}%. ${support.length ? `${support.length} learner${support.length === 1 ? " needs" : "s need"} attention.` : "All recorded learners are at or above the pass threshold."}`;

  const tabs = [
    ["overview", "Overview"], ["learners", "Learners"], ["outcomes", "Topic evidence"], ["actions", "Next steps"],
  ] as const;

  return <div style={{ display: "grid", gap: 14, color: C.ink }}>
    <section style={{ padding: "18px 18px 16px", borderRadius: 18, background: "#111827", color: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".09em", color: "#9CA3AF", fontWeight: 800 }}>Assessment intelligence</div>
          <h2 style={{ margin: "5px 0 0", fontSize: 22, letterSpacing: "-.025em" }}>{data.context.exam_name}</h2>
          <div style={{ marginTop: 4, fontSize: 13, color: "#CBD5E1" }}>{data.context.class_name}{data.context.class_stream ? ` ${data.context.class_stream}` : ""} · {data.context.subject_name}</div>
        </div>
        <div style={{ padding: "7px 10px", borderRadius: 999, background: data.completion.remaining === 0 ? "#123B31" : "#3D3421", color: data.completion.remaining === 0 ? "#A7F3D0" : "#FDE68A", fontSize: 11, fontWeight: 800 }}>{data.completion.recorded}/{data.completion.roster} results</div>
      </div>
      <p style={{ margin: "15px 0 0", maxWidth: 880, fontSize: 15, lineHeight: 1.55, color: "#F3F4F6", fontWeight: 650 }}>{summary}</p>
    </section>

    <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
      {tabs.map(([id, label]) => <button key={id} onClick={() => setSection(id)} style={{ flexShrink: 0, padding: "8px 12px", borderRadius: 999, border: `1px solid ${section === id ? "#111827" : C.line}`, background: section === id ? "#111827" : "#fff", color: section === id ? "#fff" : C.ink, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>{label}</button>)}
    </div>

    {section === "overview" && <>
      <div style={{ display: "flex", gap: 9, overflowX: "auto", paddingBottom: 3 }}>
        <Metric label="Class mean" value={h.mean == null ? "—" : `${format(h.mean)}%`} detail={changeText} emphasis={changeEmphasis} />
        <Metric label="Highest" value={h.highest == null ? "—" : `${format(h.highest, 0)}%`} detail={top?.name ?? "No result yet"} />
        <Metric label="Passed" value={h.meeting_percent == null ? "—" : `${format(h.meeting_percent, 0)}%`} detail={`${h.passed} learner${h.passed === 1 ? "" : "s"}`} emphasis={h.meeting_percent != null && h.meeting_percent >= 70 ? "good" : "neutral"} />
        <Metric label="Need help" value={String(support.length)} detail={atRisk.length ? `${atRisk.length} declining and below target` : "Based on current threshold"} emphasis={support.length ? "bad" : "good"} />
        <Metric label="Completion" value={`${format(data.completion.percent, 0)}%`} detail={`${data.completion.remaining} remaining · ${data.completion.absent} absent`} emphasis={data.completion.remaining === 0 ? "good" : "neutral"} />
      </div>

      {data.evidence_quality.has_previous_exam && <section style={{ border: `1px solid ${C.line}`, borderRadius: 18, background: C.panel, overflow: "hidden" }}>
        <div style={{ padding: "15px 17px 0" }}><h3 style={{ margin: 0, fontSize: 15 }}>How the class is changing</h3><p style={{ margin: "4px 0 0", fontSize: 12, color: C.muted }}>Class mean across earlier exams for the same class and subject.</p></div>
        <Sparkline points={data.historical_trajectory} />
      </section>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12 }}>
        <section style={{ padding: 17, border: `1px solid ${C.line}`, borderRadius: 18, background: C.panel }}>
          <h3 style={{ margin: "0 0 14px", fontSize: 15 }}>How marks are spread</h3>
          <Distribution data={data.performance_distribution} />
        </section>
        <section style={{ padding: 17, border: `1px solid ${C.line}`, borderRadius: 18, background: C.panel }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>Compared with the last exam</h3>
          {!data.evidence_quality.has_previous_exam ? <p style={{ color: C.muted, fontSize: 13, lineHeight: 1.5 }}>This is the first comparable result set for this class and subject. VibeSchool will show movement after the next assessment.</p> : <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            <div style={{ padding: 11, background: C.greenSoft, borderRadius: 12 }}><strong style={{ fontSize: 12, color: C.green }}>Biggest improvement</strong><div style={{ marginTop: 4, fontSize: 14, fontWeight: 800 }}>{biggestImprovement?.name ?? "—"} {biggestImprovement?.change != null ? `+${format(biggestImprovement.change)}` : ""}</div></div>
            <div style={{ padding: 11, background: C.redSoft, borderRadius: 12 }}><strong style={{ fontSize: 12, color: C.red }}>Biggest decline</strong><div style={{ marginTop: 4, fontSize: 14, fontWeight: 800 }}>{biggestDecline?.name ?? "—"} {biggestDecline?.change != null ? format(biggestDecline.change) : ""}</div></div>
            <div style={{ fontSize: 12, color: C.muted }}>{data.performance_segments.recovering ?? 0} recovering · {data.performance_segments.strong_improving ?? 0} strong and improving · {data.performance_segments.at_risk_declining ?? 0} at risk</div>
          </div>}
        </section>
      </div>

      <section style={{ padding: 17, border: `1px solid ${C.line}`, borderRadius: 18, background: C.panel }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}><div><h3 style={{ margin: 0, fontSize: 15 }}>What needs your attention</h3><p style={{ margin: "4px 0 0", color: C.muted, fontSize: 12 }}>Based on missing marks, learner changes and trusted evidence.</p></div><button onClick={() => setSection("actions")} style={{ border: 0, background: "transparent", color: C.indigo, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>See next steps</button></div>
        <div style={{ display: "grid", gap: 8, marginTop: 13 }}>
          {data.attention_items.length === 0 ? <div style={{ padding: 13, borderRadius: 12, background: C.greenSoft, color: C.green, fontSize: 13, fontWeight: 750 }}>Nothing urgent stands out from the results we have.</div> : data.attention_items.slice(0, 5).map((item, i) => <button key={`${item.title}-${i}`} onClick={() => item.action === "markbook" ? onOpenMarkbook() : item.action === "outcomes" ? setSection("outcomes") : setSection("learners")} style={{ textAlign: "left", padding: "12px 13px", border: `1px solid ${C.line}`, borderRadius: 13, background: "#fff", cursor: "pointer" }}><strong style={{ fontSize: 13 }}>{item.title}</strong><div style={{ marginTop: 3, color: C.muted, fontSize: 12, lineHeight: 1.4 }}>{item.detail}</div></button>)}
        </div>
      </section>
    </>}

    {section === "learners" && <>
      <section style={{ padding: 17, border: `1px solid ${C.line}`, borderRadius: 18, background: C.panel }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div><h3 style={{ margin: 0, fontSize: 15 }}>Find and compare learners</h3><p style={{ margin: "4px 0 0", fontSize: 12, color: C.muted }}>Search the class or quickly open a group.</p></div>
          <input value={learnerSearch} onChange={event => setLearnerSearch(event.target.value)} placeholder="Search learner" aria-label="Search learners" style={{ minWidth: 180, flex: "0 1 240px", padding: "9px 11px", border: `1px solid ${C.line}`, borderRadius: 11, font: "inherit" }} />
        </div>
        <div style={{ display: "flex", gap: 7, overflowX: "auto", marginTop: 12, paddingBottom: 2 }}>
          {([
            ["all", `All ${data.learner_movements.length}`],
            ["help", `Need help ${support.length}`],
            ["improving", `Improving ${data.learner_movements.filter(m => ["strong_improving","recovering"].includes(m.segment)).length}`],
            ["declining", `Declining ${data.learner_movements.filter(m => ["strong_declining","at_risk_declining"].includes(m.segment)).length}`],
          ] as const).map(([id,label]) => <button key={id} onClick={() => setLearnerFilter(id)} style={{ flexShrink: 0, padding: "7px 10px", borderRadius: 999, border: `1px solid ${learnerFilter===id?"#111827":C.line}`, background: learnerFilter===id?"#111827":"#fff", color: learnerFilter===id?"#fff":C.ink, fontSize: 11, fontWeight: 800, cursor: "pointer" }}>{label}</button>)}
        </div>
        <div style={{ display: "grid", gap: 7, marginTop: 12 }}>
          {filteredLearners.length === 0 ? <div style={{ color: C.muted, fontSize: 13 }}>No learners match this view.</div> : filteredLearners.slice(0, 20).map(learner => {
            const tone=segmentTone(learner.segment);
            return <button key={learner.student_id} onClick={() => setSelectedStudentId(learner.student_id)} style={{ border: "1px solid #E5E7EB", background: "#fff", borderRadius: 12, padding: "10px 11px", display: "flex", justifyContent: "space-between", gap: 10, cursor: "pointer", textAlign: "left" }}>
              <span><strong>{learner.name}</strong><div style={{ marginTop: 2, fontSize: 11, color: tone.fg }}>{segmentLabel(learner.segment)}</div></span>
              <span style={{ textAlign: "right" }}><strong>{format(learner.marks,0)}%</strong>{learner.change != null && <div style={{ fontSize: 11, color: learner.change < 0 ? C.red : C.green }}>{learner.change > 0 ? "+" : ""}{format(learner.change)}</div>}</span>
            </button>;
          })}
        </div>
      </section>
      <section style={{ padding: 17, border: `1px solid ${C.line}`, borderRadius: 18, background: C.panel }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>Marks and movement</h3>
        <p style={{ margin: "4px 0 14px", fontSize: 12, color: C.muted }}>Each dot is a learner. Left to right shows the mark. Up or down shows change from the last comparable exam.</p>
        <MovementMatrix movements={data.learner_movements} passMark={data.context.pass_mark} onSelect={setSelectedStudentId} />
      </section>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))", gap: 12 }}>
        <section style={{ padding: 17, border: `1px solid ${C.line}`, borderRadius: 18, background: C.panel }}><h3 style={{ margin: "0 0 11px", fontSize: 15 }}>Top performers</h3><div style={{ display: "grid", gap: 7 }}>{data.learner_rankings.map((learner, i) => <button key={learner.student_id} onClick={() => setSelectedStudentId(learner.student_id)} style={{ border: 0, background: i === 0 ? C.indigoSoft : "#F9FAFB", borderRadius: 12, padding: "10px 11px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", textAlign: "left" }}><span><strong>{i + 1}. {learner.name}</strong></span><strong>{format(learner.marks, 0)}%</strong></button>)}</div></section>
        <section style={{ padding: 17, border: `1px solid ${C.line}`, borderRadius: 18, background: C.panel }}><h3 style={{ margin: "0 0 11px", fontSize: 15 }}>Learners needing attention</h3><div style={{ display: "grid", gap: 7 }}>{support.length === 0 ? <div style={{ color: C.muted, fontSize: 13 }}>No recorded learner is currently below the pass threshold.</div> : support.map(learner => { const tone = segmentTone(learner.segment); return <button key={learner.student_id} onClick={() => setSelectedStudentId(learner.student_id)} style={{ border: 0, background: tone.bg, borderRadius: 12, padding: "10px 11px", display: "flex", justifyContent: "space-between", gap: 10, cursor: "pointer", textAlign: "left" }}><span><strong style={{ color: tone.fg }}>{learner.name}</strong><div style={{ marginTop: 2, fontSize: 11, color: C.muted }}>{segmentLabel(learner.segment)}</div></span><span style={{ textAlign: "right" }}><strong>{format(learner.marks, 0)}%</strong>{learner.change != null && <div style={{ fontSize: 11, color: learner.change < 0 ? C.red : C.green }}>{learner.change > 0 ? "+" : ""}{format(learner.change)}</div>}</span></button>; })}</div></section>
      </div>
    </>}

    {section === "outcomes" && <section style={{ padding: 17, border: `1px solid ${C.line}`, borderRadius: 18, background: C.panel }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><div><h3 style={{ margin: 0, fontSize: 15 }}>Topic evidence</h3><p style={{ margin: "4px 0 0", fontSize: 12, color: C.muted, maxWidth: 780, lineHeight: 1.45 }}>{data.evidence_quality.outcome_note}</p></div><span style={{ alignSelf: "flex-start", padding: "6px 9px", borderRadius: 999, background: data.evidence_quality.has_outcome_evidence ? C.greenSoft : C.amberSoft, color: data.evidence_quality.has_outcome_evidence ? C.green : C.amber, fontSize: 10, fontWeight: 850 }}>{data.evidence_quality.has_outcome_evidence ? "OUTCOME EVIDENCE AVAILABLE" : "AGGREGATE EXAM ONLY"}</span></div>
      {data.outcome_weaknesses.length === 0 ? <div style={{ marginTop: 14, padding: 16, borderRadius: 14, background: C.amberSoft, color: "#713F12", fontSize: 13, lineHeight: 1.5 }}><strong>We do not yet know which topic caused the marks.</strong><br />This exam has total subject marks, but its questions are not linked closely enough to curriculum outcomes. VibeSchool will not guess.</div> : <div style={{ display: "grid", gap: 9, marginTop: 14 }}>{data.outcome_weaknesses.map(outcome => <div key={outcome.outcome_id} style={{ padding: 13, border: `1px solid ${C.line}`, borderRadius: 14 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><strong style={{ fontSize: 13, lineHeight: 1.4 }}>{outcome.outcome_text}</strong><strong style={{ whiteSpace: "nowrap", color: outcome.mastery_score != null && outcome.mastery_score < 50 ? C.red : C.ink }}>{format(outcome.mastery_score)}%</strong></div><div style={{ marginTop: 7, display: "flex", gap: 12, flexWrap: "wrap", fontSize: 11, color: C.muted }}><span>{outcome.learners_affected} learners affected</span><span>{outcome.evidence_count} evidence points</span><span>Repeated {outcome.repeated_weakness_count}×</span>{outcome.confidence_score != null && <span>Confidence {format(outcome.confidence_score)}%</span>}</div></div>)}</div>}
      {data.intervention_effects.length > 0 && <div style={{ marginTop: 18 }}><h4 style={{ margin: "0 0 9px", fontSize: 13 }}>Did previous support help?</h4><div style={{ display: "grid", gap: 8 }}>{data.intervention_effects.map(effect => <div key={effect.id} style={{ padding: 12, borderRadius: 13, background: (effect.change ?? 0) > 0 ? C.greenSoft : "#F9FAFB" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><strong style={{ fontSize: 12 }}>{effect.student_name ?? "Learner"}</strong><strong style={{ color: (effect.change ?? 0) > 0 ? C.green : C.ink }}>{effect.baseline == null || effect.followup == null ? "—" : `${format(effect.baseline)} → ${format(effect.followup)}`}</strong></div>{effect.recommendation && <div style={{ marginTop: 4, color: C.muted, fontSize: 11 }}>{effect.recommendation}</div>}</div>)}</div></div>}
    </section>}

    {section === "actions" && <section style={{ padding: 17, border: `1px solid ${C.line}`, borderRadius: 18, background: C.panel }}>
      <h3 style={{ margin: 0, fontSize: 15 }}>What to do next</h3><p style={{ margin: "4px 0 13px", fontSize: 12, color: C.muted }}>Use the results to move straight to the next useful job.</p>
      <div style={{ display: "grid", gap: 9 }}>
        {data.recommended_actions.filter(a => a.enabled).map(action => {
          const href = action.action === "lessonplan" ? `/teacher/lessonplan?classId=${classId}&subjectId=${subjectId}&from=results` : action.action === "reports" && top ? `/teacher/results/report-card/${top.student_id}?examId=${examId}` : null;
          const content = <><strong style={{ fontSize: 13 }}>{action.label}</strong><span style={{ fontSize: 12, color: C.muted }}>{action.action === "markbook" ? "Finish the missing marks." : action.action === "learners" ? "Open the learners who may need help." : action.action === "lessonplan" ? "Use trusted topic evidence to plan reteaching." : "Open reports for this exam."}</span></>;
          if (action.action === "markbook") return <button key={action.id} onClick={onOpenMarkbook} style={{ padding: 13, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", border: `1px solid ${C.line}`, borderRadius: 13, background: "#fff", cursor: "pointer", textAlign: "left" }}>{content}</button>;
          if (action.action === "learners") return <button key={action.id} onClick={() => setSection("learners")} style={{ padding: 13, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", border: `1px solid ${C.line}`, borderRadius: 13, background: "#fff", cursor: "pointer", textAlign: "left" }}>{content}</button>;
          return href ? <a key={action.id} href={href} style={{ padding: 13, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", border: `1px solid ${C.line}`, borderRadius: 13, background: "#fff", textDecoration: "none", color: C.ink }}>{content}</a> : null;
        })}
      </div>
    </section>}

    {selected && <div role="dialog" aria-modal="true" aria-label={`Learner exam view for ${selected.name}`} style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(17,24,39,.38)", display: "flex", justifyContent: "flex-end" }} onClick={event => { if (event.target === event.currentTarget) setSelectedStudentId(null); }}>
      <aside style={{ width: "min(440px,100%)", height: "100%", overflowY: "auto", background: "#fff", padding: 20, boxShadow: "-12px 0 40px rgba(0,0,0,.12)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><div><div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", fontWeight: 800, letterSpacing: ".06em" }}>Learner intelligence</div><h3 style={{ margin: "5px 0 0", fontSize: 22 }}>{selected.name}</h3></div><button onClick={() => setSelectedStudentId(null)} aria-label="Close learner intelligence" style={{ width: 34, height: 34, borderRadius: 999, border: `1px solid ${C.line}`, background: "#fff", cursor: "pointer", fontSize: 18 }}>×</button></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginTop: 18 }}><Metric label="Current" value={`${format(selected.marks, 0)}%`} /><Metric label="Change" value={selected.change == null ? "—" : `${selected.change > 0 ? "+" : ""}${format(selected.change)}`} detail={selected.previous_marks == null ? "No prior comparable mark" : `Previous ${format(selected.previous_marks, 0)}%`} emphasis={selected.change == null ? "neutral" : selected.change > 0 ? "good" : selected.change < 0 ? "bad" : "neutral"} /></div>
        <div style={{ marginTop: 12, padding: 13, borderRadius: 14, ...segmentTone(selected.segment), background: segmentTone(selected.segment).bg, color: segmentTone(selected.segment).fg }}><strong>{segmentLabel(selected.segment)}</strong><div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.45 }}>This is based on the learner's mark, the pass mark and change from the last comparable exam.</div></div>
        <div style={{ marginTop: 18 }}><h4 style={{ margin: "0 0 9px", fontSize: 13 }}>Next actions</h4><div style={{ display: "grid", gap: 8 }}><a href={`/teacher/results/report-card/${selected.student_id}?examId=${examId}`} style={{ padding: 11, border: `1px solid ${C.line}`, borderRadius: 12, color: C.ink, textDecoration: "none", fontWeight: 750, fontSize: 12 }}>Open learner report</a><a href={`/teacher/assessment?classId=${classId}&subjectId=${subjectId}&studentId=${selected.student_id}&from=results`} style={{ padding: 11, border: `1px solid ${C.line}`, borderRadius: 12, color: C.ink, textDecoration: "none", fontWeight: 750, fontSize: 12 }}>Open assessment workspace</a></div></div>
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.line}`, color: C.muted, fontSize: 11, lineHeight: 1.5 }}>A total mark alone cannot tell us which topic caused a problem. Topic findings appear only when there is linked evidence.</div>
      </aside>
    </div>}
  </div>;
}
