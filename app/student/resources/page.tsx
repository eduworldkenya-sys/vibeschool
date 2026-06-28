"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useStudent } from "@/lib/student-context";
import { readCache, writeCache } from "@/lib/student-cache";
import Skel from "@/components/student/Skel";

interface Resource {
  id:           string;
  title:        string;
  description:  string;
  type:         string;
  subject:      string;
  external_url: string | null;
  content:      string | null;
  created_at:   string;
}

const TYPES = [
  { value: "notes",      label: "Notes"      },
  { value: "assessment", label: "Assessment" },
  { value: "exercise",   label: "Exercise"   },
  { value: "quiz",       label: "Quiz"       },
  { value: "video",      label: "Video"      },
]

function isSafeUrl(url: string | null): boolean {
  if (!url) return false;
  try { return ["http:", "https:"].includes(new URL(url).protocol); }
  catch { return false; }
}

function IconNotes() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="9" y1="13" x2="15" y2="13"/>
      <line x1="9" y1="17" x2="15" y2="17"/>
    </svg>
  )
}
function IconAssessment() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  )
}
function IconExercise() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6"  y1="20" x2="6"  y2="14"/>
    </svg>
  )
}
function IconQuiz() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )
}
function IconVideo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polygon points="10 8 16 12 10 16 10 8"/>
    </svg>
  )
}
function IconAll() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  )
}
function IconLink() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  )
}
function IconChevron({ open }: { open: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  )
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  notes:      <IconNotes />,
  assessment: <IconAssessment />,
  exercise:   <IconExercise />,
  quiz:       <IconQuiz />,
  video:      <IconVideo />,
}

export default function StudentResourcesPage() {
  const { identity, loading: idLoading } = useStudent();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState("all");
  const [expanded,  setExpanded]  = useState<string | null>(null);

  useEffect(() => {
    if (idLoading || !identity) return;

    const cached = readCache<Resource[]>("lessons", identity.studentId);
    if (cached) { setResources(cached); setLoading(false); }

    async function load() {
      const { data } = await supabase
        .from("student_accessible_resources")
        .select("*")
        .order("created_at", { ascending: false });

      const result = data ?? [];
      writeCache("lessons", identity!.studentId, result);
      setResources(result);
      setLoading(false);
    }
    load();
  }, [identity, idLoading]);

  const filtered = filter === "all" ? resources : resources.filter(r => r.type === filter);

  if (idLoading || (loading && resources.length === 0)) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 }}>
      <Skel h={40} radius={12} />
      <Skel h={80} radius={12} />
      <Skel h={80} radius={12} />
      <Skel h={80} radius={12} />
    </div>
  );

  return (
    <div style={{ animation: "slideIn 0.22s ease" }}>

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--vs-text)", fontFamily: "'Bricolage Grotesque', sans-serif" }}>
          Study Room
        </h1>
        <p style={{ fontSize: 12, color: "var(--vs-muted)", marginTop: 2 }}>
          {resources.length} resource{resources.length !== 1 ? "s" : ""} available
        </p>
      </div>

      {/* Filter chips */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 16, paddingBottom: 4 }}>
        {[{ value: "all", label: "All", icon: <IconAll /> }, ...TYPES.map(t => ({ ...t, icon: TYPE_ICONS[t.value] }))].map(t => (
          <button
            key={t.value}
            onClick={() => setFilter(t.value)}
            style={{
              display:      "flex",
              alignItems:   "center",
              gap:          6,
              padding:      "6px 14px",
              borderRadius: 20,
              border:       "1px solid var(--vs-border)",
              cursor:       "pointer",
              fontFamily:   "inherit",
              fontSize:     12,
              fontWeight:   700,
              whiteSpace:   "nowrap",
              flexShrink:   0,
              background:   filter === t.value ? "var(--vs-accent)" : "var(--vs-card)",
              color:        filter === t.value ? "#fff" : "var(--vs-muted)",
              transition:   "all 0.15s",
            }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div style={{
          background:   "var(--vs-card)",
          border:       "1px solid var(--vs-border)",
          borderRadius: 16,
          padding:      "40px 24px",
          textAlign:    "center",
        }}>
          <div style={{ fontSize: 13, color: "var(--vs-muted)" }}>
            No resources found in this category
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(r => (
            <div
              key={r.id}
              style={{
                background:   "var(--vs-card)",
                border:       "1px solid var(--vs-border)",
                borderRadius: 14,
                overflow:     "hidden",
              }}
            >
              {/* Card header */}
              <button
                onClick={() => setExpanded(prev => prev === r.id ? null : r.id)}
                style={{
                  width:        "100%",
                  display:      "flex",
                  alignItems:   "center",
                  gap:          12,
                  padding:      "14px 16px",
                  background:   "none",
                  border:       "none",
                  cursor:       "pointer",
                  fontFamily:   "inherit",
                  textAlign:    "left",
                }}
              >
                <div style={{
                  width:          36,
                  height:         36,
                  borderRadius:   10,
                  background:     "var(--vs-accent-soft)",
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "center",
                  color:          "var(--vs-accent)",
                  flexShrink:     0,
                }}>
                  {TYPE_ICONS[r.type] ?? <IconNotes />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--vs-text)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.title}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--vs-muted)" }}>
                    {r.subject} · {TYPES.find(t => t.value === r.type)?.label ?? r.type}
                  </div>
                </div>
                <span style={{ color: "var(--vs-muted)", flexShrink: 0 }}>
                  <IconChevron open={expanded === r.id} />
                </span>
              </button>

              {/* Expanded content */}
              {expanded === r.id && (
                <div style={{ padding: "0 16px 16px", borderTop: "1px solid var(--vs-border)" }}>
                  {r.description && (
                    <p style={{ fontSize: 13, color: "var(--vs-muted)", marginTop: 12, lineHeight: 1.6 }}>
                      {r.description}
                    </p>
                  )}
                  {r.content && (
                    <p style={{ fontSize: 13, color: "var(--vs-text)", marginTop: 10, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                      {r.content}
                    </p>
                  )}
                  {isSafeUrl(r.external_url) && (
                    <a
                      href={r.external_url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display:        "inline-flex",
                        alignItems:     "center",
                        gap:            6,
                        marginTop:      12,
                        padding:        "8px 16px",
                        background:     "var(--vs-accent)",
                        color:          "#fff",
                        borderRadius:   8,
                        fontSize:       12,
                        fontWeight:     700,
                        textDecoration: "none",
                      }}
                    >
                      <IconLink />
                      Open Resource
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
