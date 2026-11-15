"use client";

import { useEffect, useState } from "react";
import { useStudent } from "@/lib/student-context";

type Props = { feature: string; children: React.ReactNode; label?: string };

/** Optional UI orientation only. Never wrap assessment rules, assignments or critical notices. */
export default function StudentIntro({ feature, children, label = "How this works" }: Props) {
  const { identity } = useStudent();
  const [open, setOpen] = useState(false);
  const studentId = identity?.studentId;
  useEffect(() => { setOpen(false); }, [studentId, feature]);
  if (!studentId) return null;
  return <div className="vs-student-guidance" style={{ margin: "8px 0 14px" }}>
    {!open
      ? <button type="button" onClick={() => setOpen(true)} aria-label={label}
          style={{ color: "var(--vs-muted)", background: "transparent", border: 0, textDecoration: "underline", fontSize: 12, padding: "5px 0", cursor: "pointer" }}>{label}</button>
      : <div style={{ background: "var(--vs-card)", border: "1px solid var(--vs-border)", borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--vs-muted)" }}>{children}</div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <button type="button" onClick={() => setOpen(false)} style={{ minHeight: 38, padding: "8px 14px", borderRadius: 10, border: 0, fontWeight: 700, background: "var(--vs-accent)", color: "var(--vs-on-accent)", cursor: "pointer" }}>Got it</button>
          </div>
        </div>}
  </div>;
}
