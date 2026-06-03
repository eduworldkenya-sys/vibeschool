"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Strand {
  name: string;
  score: number;
  status: "Advanced" | "Proficient" | "Developing" | "Beginning";
}

interface Subject {
  id: string;
  name: string;
  code: string;
  icon: string;
  rating: "EE" | "ME" | "AE" | "BE";
  themeColor: string;
  accentBg: string;
  strands: Strand[];
  teacherFeedback: string;
  teacherName: string;
  updatedAt: string;
}

// Mock database payload array to seed initial state
const INITIAL_REGISTRY_PAYLOAD: Subject[] = [
  {
    id: "math",
    name: "Mathematics Activities",
    code: "MAT",
    icon: "📐",
    rating: "EE",
    themeColor: "#10b981",
    accentBg: "#f0fdf4",
    strands: [
      { name: "Numbers & Fractions Mastery", score: 92, status: "Advanced" },
      { name: "Measurement & Mass Estimation", score: 85, status: "Proficient" },
      { name: "Geometry & Spatial Identification", score: 68, status: "Developing" }
    ],
    teacherFeedback: "Incredible speed with mental math arithmetic! He effortlessly bridges abstract concepts. We are focusing on refining geometric shapes next week.",
    teacherName: "Madam Agnes Omwamba",
    updatedAt: "Today, 10:42 AM"
  },
  {
    id: "eng",
    name: "English Language Arts",
    code: "ENG",
    icon: "📚",
    rating: "ME",
    themeColor: "#3b82f6",
    accentBg: "#eff6ff",
    strands: [
      { name: "Reading Fluency & Phonetics", score: 88, status: "Advanced" },
      { name: "Critical Comprehension Engine", score: 78, status: "Proficient" },
      { name: "Sentence Composition & Syntax", score: 72, status: "Proficient" }
    ],
    teacherFeedback: "Reads with brilliant expressive rhythm and catches contextual clues quickly. His narrative essay structure is becoming exceptionally strong.",
    teacherName: "Mr. David Kiprop",
    updatedAt: "Yesterday"
  },
  {
    id: "kisw",
    name: "Shughuli za Kiswahili",
    code: "KIS",
    icon: "🌍",
    rating: "ME",
    themeColor: "#f59e0b",
    accentBg: "#fffbeb",
    strands: [
      { name: "Kusikiliza na Kuongea kwa Unyofu", score: 84, status: "Proficient" },
      { name: "Kusoma kwa Sauti na Lafudhi", score: 80, status: "Proficient" },
      { name: "Insha na Tahajia (Spelling)", score: 65, status: "Developing" }
    ],
    teacherFeedback: "Anadhihirisha uelewa wa hali ya juu katika mazungumzo na midahalo ya darasani. Tutaendelea kukuza msamiati wa ziada kupitia usomaji wa hadithi.",
    teacherName: "Mwalimu Mwangi",
    updatedAt: "May 20, 2026"
  }
];

export default function BulletproofPerformancePortfolio() {
  const router = useRouter();
  
  // Fix Quality Issue #9: Future-proof database swaps by running logic against active hook state hooks from day one
  const [subjects] = useState<Subject[]>(INITIAL_REGISTRY_PAYLOAD);
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
  const [animatedSubjectIds, setAnimatedSubjectIds] = useState<Record<string, boolean>>({});
  const [activeReaction, setActiveReaction] = useState<Record<string, string>>({});
  const [cbcExplainer, setCbcExplainer] = useState<{ open: boolean; rating: "EE" | "ME" | "AE" | "BE" | null }>({
    open: false,
    rating: null
  });

  // Fix Bug #6: Use a proper double requestAnimationFrame loop to ensure the DOM is painted safely on all devices
  useEffect(() => {
    const frameId1: number;
    let frameId2: number;

    frameId1 = requestAnimationFrame(() => {
      frameId2 = requestAnimationFrame(() => {
        setExpandedSubject("math");
        setAnimatedSubjectIds({ math: true });
      });
    });

    return () => {
      cancelAnimationFrame(frameId1);
      cancelAnimationFrame(frameId2);
    };
  }, []);

  // Compute live analytical scores dynamically
  const totalStrandsCount = subjects.reduce((acc, sub) => acc + sub.strands.length, 0);
  const aggregateScore = totalStrandsCount > 0 
    ? Math.round(subjects.reduce((acc, sub) => acc + sub.strands.reduce((sAcc, str) => sAcc + str.score, 0), 0) / totalStrandsCount)
    : 0;

  const getAggregateLabel = (score: number) => {
    if (score >= 80) return "Optimal Execution";
    if (score >= 50) return "Steady Performance";
    return "Needs Intervention";
  };

  const getRatingMetadata = (rating: "EE" | "ME" | "AE" | "BE") => {
    switch(rating) {
      case "EE": return { label: "EE", color: "#10b981", bg: "#e6fbf2", eng: "Exceeding Expectations", swa: "Kupita Kiwango Kilichotarajiwa" };
      case "ME": return { label: "ME", color: "#3b82f6", bg: "#eef2ff", eng: "Meeting Expectations", swa: "Kufikia Kiwango Kilichotarajiwa" };
      case "AE": return { label: "AE", color: "#f59e0b", bg: "#fef7e6", eng: "Approaching Expectations", swa: "Kukaribia Kiwango Kilichotarajiwa" };
      default: return { label: "BE", color: "#ef4444", bg: "#fdf2f2", eng: "Below Expectations", swa: "Chini ya Kiwango Kilichotarajiwa" };
    }
  };

  const getStrandBadgeStyle = (status: string) => {
    switch(status) {
      case "Advanced": return { color: "#10b981", bg: "#e6fbf2" };
      case "Proficient": return { color: "#3b82f6", bg: "#eef2ff" };
      default: return { color: "#f59e0b", bg: "#fef7e6" };
    }
  };

  const handleToggle = (id: string) => {
    if (expandedSubject === id) {
      setExpandedSubject(null);
      // Fix Bug #1: Explicitly clear target subject keys when closed so progress bar elements re-animate from zero on reopen
      setAnimatedSubjectIds(prev => ({ ...prev, [id]: false }));
    } else {
      setExpandedSubject(id);
      // Execute micro-task frame step passes cleanly
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimatedSubjectIds(prev => ({ ...prev, [id]: true }));
        });
      });
    }
  };

  if (subjects.length === 0) {
    return (
      <div style={{ maxWidth: "480px", margin: "0 auto", padding: "60px 24px", textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
        <span style={{ fontSize: "48px" }}>📭</span>
        <h3 style={{ fontSize: "18px", fontWeight: "800", color: "#1e293b", marginTop: "16px" }}>No Academic Evaluations Yet</h3>
        <p style={{ fontSize: "14px", color: "#64748b", marginTop: "8px" }}>Evaluations appear automatically here once released by the school registry.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "480px", margin: "0 auto", padding: "24px 16px", backgroundColor: "#f8fafc", minHeight: "100vh", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif", color: "#0f172a", position: "relative" }}>
      
      {/* Top Navbar Row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
        <button 
          onClick={() => router.push("/parent/learn")} 
          style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "14px", width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
        </button>
        <div style={{ textAlign: "right" }}>
          <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "1px" }}>CBC Portfolio</span>
          <h1 style={{ fontSize: "20px", fontWeight: "900", color: "#0f172a", margin: 0 }}>Academic Metrics</h1>
        </div>
      </div>

      {/* Child Performance Aggregate Identity Card */}
      <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", padding: "20px", borderRadius: "24px", color: "#fff", marginBottom: "24px", boxShadow: "0 10px 25px -5px rgba(15,23,42,0.15)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ width: "56px", height: "56px", borderRadius: "18px", background: "linear-gradient(45deg, #3b82f6, #10b981)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: "800", boxShadow: "0 4px 12px rgba(59,130,246,0.3)" }}>
            JM
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "800", letterSpacing: "-0.3px" }}>Jaden Mwangi</h3>
            <p style={{ margin: "2px 0 0 0", fontSize: "13px", color: "#94a3b8" }}>Grade 3 Premium Track • Term 1 Evaluation</p>
          </div>
        </div>
        
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", marginTop: "16px", paddingTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "12px", color: "#94a3b8" }}>Overall Competency Aggregate:</span>
          <span style={{ background: "rgba(16,185,129,0.2)", color: "#34d399", padding: "4px 10px", borderRadius: "8px", fontSize: "12px", fontWeight: "800" }}>{aggregateScore}% {getAggregateLabel(aggregateScore)}</span>
        </div>
      </div>

      {/* Main Accordion Stream Block */}
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {subjects.map((subject) => {
          const isExpanded = expandedSubject === subject.id;
          const rConfig = getRatingMetadata(subject.rating);

          return (
            <div 
              key={subject.id} 
              style={{ backgroundColor: "#fff", borderRadius: "22px", border: "1px solid #e2e8f0", overflow: "hidden", transition: "transform 0.2s, box-shadow 0.2s", boxShadow: isExpanded ? "0 12px 20px -8px rgba(0,0,0,0.04)" : "0 2px 4px rgba(0,0,0,0.01)" }}
            >
              {/* Trigger Node Bar — Fix Bug #4: Explicitly applied active functional accessibility roles */}
              <div 
                onClick={() => handleToggle(subject.id)}
                role="button"
                aria-expanded={isExpanded}
                style={{ padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none", WebkitTapHighlightColor: "transparent" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <div style={{ fontSize: "22px", width: "44px", height: "44px", borderRadius: "14px", backgroundColor: subject.accentBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {subject.icon}
                  </div>
                  <div>
                    <span style={{ fontSize: "10px", fontWeight: "800", color: "#94a3b8", letterSpacing: "0.5px" }}>{subject.code}</span>
                    <h3 style={{ margin: "1px 0 0 0", fontSize: "15px", fontWeight: "800", color: "#1f2937" }}>{subject.name}</h3>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setCbcExplainer({ open: true, rating: subject.rating }); }}
                    style={{ backgroundColor: rConfig.bg, color: rConfig.color, padding: "5px 10px", borderRadius: "9px", fontSize: "11px", fontWeight: "800", border: "none", cursor: "pointer", zIndex: 2 }}
                  >
                    {rConfig.label} ⓘ
                  </button>
                  <span style={{ color: "#94a3b8", fontSize: "11px", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)" }}>
                    ▼
                  </span>
                </div>
              </div>

              {/* Accordion Smooth Expand Area Container */}
              <div style={{ display: "grid", gridTemplateRows: isExpanded ? "1fr" : "0fr", transition: "grid-template-rows 250ms cubic-bezier(0.4, 0, 0.2, 1)" }}>
                <div style={{ overflow: "hidden", minHeight: 0 }}>
                  <div style={{ padding: "0 20px 20px 20px", borderTop: "1px solid #f1f5f9", backgroundColor: "#fafbfd" }}>
                    
                    {/* Core Parameters Tracking Grid */}
                    <div style={{ marginTop: "16px" }}>
                      <h4 style={{ margin: "0 0 12px 0", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Strand Verification Parameters</h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {subject.strands.map((strand, idx) => {
                          const badge = getStrandBadgeStyle(strand.status);
                          return (
                            <div key={idx}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                                <span style={{ fontWeight: "600", color: "#334155", fontSize: "13px" }}>{strand.name}</span>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                  <span style={{ fontSize: "10px", fontWeight: "700", color: badge.color, backgroundColor: badge.bg, padding: "2px 6px", borderRadius: "6px" }}>
                                    {strand.status}
                                  </span>
                                  <span style={{ fontWeight: "700", color: subject.themeColor, fontSize: "12px" }}>{strand.score}%</span>
                                </div>
                              </div>
                              <div style={{ width: "100%", height: "6px", backgroundColor: "#e2e8f0", borderRadius: "999px", overflow: "hidden" }}>
                                <div style={{ width: isExpanded && animatedSubjectIds[subject.id] ? `${strand.score}%` : "0%", height: "100%", backgroundColor: subject.themeColor, borderRadius: "999px", transition: "width 600ms cubic-bezier(0.1, 0.76, 0.55, 0.94)" }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Teacher Feedback Container */}
                    <div style={{ marginTop: "18px", padding: "14px", backgroundColor: "#fff", borderRadius: "16px", border: "1px solid #e2e8f0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <span style={{ fontSize: "12px", fontWeight: "700", color: "#334155" }}>{subject.teacherName}</span>
                        <span style={{ fontSize: "11px", color: "#94a3b8" }}>{subject.updatedAt}</span>
                      </div>
                      <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#475569", lineHeight: "1.6", fontStyle: "italic" }}>
                        "{subject.teacherFeedback}"
                      </p>
                      
                      {/* Interaction Actions Bar Row */}
                      <div style={{ display: "flex", gap: "8px", borderTop: "1px solid #f1f5f9", paddingTop: "10px" }}>
                        {["❤️", "🔥", "👏"].map((emoji) => {
                          const isSelected = activeReaction[subject.id] === emoji;
                          return (
                            <button 
                              key={emoji}
                              onClick={() => setActiveReaction({ ...activeReaction, [subject.id]: isSelected ? "" : emoji })}
                              style={{ border: isSelected ? `1px solid ${subject.themeColor}` : "1px solid #e2e8f0", background: isSelected ? subject.accentBg : "#fff", borderRadius: "10px", padding: "5px 12px", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                            >
                              <span>{emoji}</span> 
                              {/* Fix Bug #7: High fidelity vector line-check vector asset instead of breaking Unicode strings */}
                              {isSelected && (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={subject.themeColor} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "2px" }}><polyline points="20 6 9 17 4 12"></polyline></svg>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Context Dialogue Modal Overlay Sheet Wrapper */}
      {cbcExplainer.open && cbcExplainer.rating && (() => {
        const explainerMeta = getRatingMetadata(cbcExplainer.rating);
        return (
          // Fix Bug #2: Absolute stacking insulation mapping to block interception bleed-through variables completely
          <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "flex-end", zIndex: 9999 }}>
            <div 
              onClick={() => setCbcExplainer({ open: false, rating: null })} 
              style={{ position: "absolute", inset: 0, backgroundColor: "rgba(15,23,42,0.4)", backdropFilter: "blur(4px)", zIndex: 1 }} 
            />
            <div style={{ width: "100%", maxWidth: "480px", margin: "0 auto", backgroundColor: "#fff", borderTopLeftRadius: "28px", borderTopRightRadius: "28px", padding: "24px 20px", position: "relative", zIndex: 2, maxHeight: "85vh", overflowY: "auto", animation: "slideUp 220ms cubic-bezier(0.16, 1, 0.3, 1)" }}>
              <div style={{ width: "40px", height: "4px", backgroundColor: "#cbd5e1", borderRadius: "999px", margin: "0 auto 16px auto" }} />
              
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                <span style={{ backgroundColor: explainerMeta.bg, color: explainerMeta.color, fontSize: "16px", fontWeight: "900", padding: "6px 14px", borderRadius: "12px" }}>
                  {explainerMeta.label}
                </span>
                <div>
                  <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>{explainerMeta.eng}</h4>
                  <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>{explainerMeta.swa}</p>
                </div>
              </div>

              <div style={{ backgroundColor: "#f8fafc", padding: "16px", borderRadius: "16px", fontSize: "13px", color: "#334155", lineHeight: "1.6" }}>
                <strong>What this means for your child:</strong><br />
                {cbcExplainer.rating === "EE" && "The learner consistently demonstrates exceptional competency execution, going completely beyond the expected learning outcomes independently."}
                {cbcExplainer.rating === "ME" && "The learner successfully executes core competencies smoothly and satisfies all standard grading matrices accurately."}
                {cbcExplainer.rating === "AE" && "The learner is steadily improving but still requires minor baseline instruction support to cement the target objectives."}
                {cbcExplainer.rating === "BE" && "The learner requires direct, focused intervention loops to address key gaps in conceptual performance."}
              </div>

              <button 
                onClick={() => setCbcExplainer({ open: false, rating: null })}
                style={{ width: "100%", marginTop: "20px", padding: "14px", background: "#0f172a", color: "#fff", border: "none", borderRadius: "14px", fontWeight: "700", cursor: "pointer" }}
              >
                Understood • Sawa
              </button>
            </div>
          </div>
        );
      })()}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}} />
    </div>
  );
}
