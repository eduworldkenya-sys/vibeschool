"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { LinkedChild } from "@/lib/types";

const dark   = "#1e1b4b";
const accent = "#10b981";
const bg     = "#f0f2f5";

function Skeleton({ w = "100%", h = 16, radius = 8 }: { w?: string | number; h?: number; radius?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: radius,
      background: "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.4s infinite",
      flexShrink: 0,
    }} />
  );
}

function ChildCard({ child, onTap }: { child: LinkedChild; onTap: () => void }) {
  const initial = child.name.trim()[0]?.toUpperCase() ?? "?";
  return (
    <div
      onClick={onTap}
      style={{
        background: "#fff",
        borderRadius: 16,
        border: "1px solid #e5e7eb",
        padding: "14px 16px",
        marginBottom: 12,
        display: "flex",
        alignItems: "center",
        gap: 14,
        cursor: "pointer",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        transition: "box-shadow 0.15s",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <div style={{
        width: 46,
        height: 46,
        borderRadius: "50%",
        background: "linear-gradient(135deg, #1e1b4b 0%, #4c1d95 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 20,
        fontWeight: 800,
        color: "#fff",
        flexShrink: 0,
      }}>
        {initial}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 2 }}>
          {child.name}
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {child.class_name}
        </div>
        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {child.school_name}
        </div>
      </div>

      <div style={{ fontSize: 20, color: "#d1d5db", flexShrink: 0 }}>›</div>
    </div>
  );
}

function EmptyState() {
  const router = useRouter();
  return (
    <div style={{
      background: "#fff",
      borderRadius: 20,
      padding: "36px 24px",
      textAlign: "center",
      border: "1px solid #e5e7eb",
      marginTop: 24,
    }}>
      <div style={{ fontSize: 52, marginBottom: 16 }}>👨‍👩‍👧</div>
      <div style={{ fontSize: 17, fontWeight: 800, color: "#111827", marginBottom: 8 }}>
        No children linked yet
      </div>
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 24, lineHeight: 1.5 }}>
        Link an existing student with a claim code, or add your child to a class directly.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          onClick={() => router.push("/parent/link-child")}
          style={{
            padding: "13px 24px",
            borderRadius: 12,
            border: "none",
            background: accent,
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          🔗 Link with Claim Code
        </button>
        <button
          onClick={() => router.push("/parent/create-child")}
          style={{
            padding: "13px 24px",
            borderRadius: 12,
            border: `1.5px solid ${dark}`,
            background: "transparent",
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          + Add Child to Class
        </button>
      </div>
    </div>
  );
}

export default function ParentStudentsPage() {
  const router = useRouter();

  const [loading,  setLoading]  = useState(true);
  const [children, setChildren] = useState<LinkedChild[]>([]);

  const fetchChildren = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/academy/signin?role=parent"); return; }

    const { data: links } = await supabase
      .from("parent_student_links")
      .select("student_id")
      .eq("parent_id", user.id);

    if (!links || links.length === 0) {
      setLoading(false);
      return;
    }

    const studentIds = links.map((l: { student_id: string }) => l.student_id);

    const { data: students } = await supabase
      .from("students")
      .select("id, name, class_id")
      .in("id", studentIds);

    if (!students || students.length === 0) {
      setLoading(false);
      return;
    }

    const classIds = students.map((s: { class_id: string }) => s.class_id);

    const { data: classes } = await supabase
      .from("classes")
      .select("id, name, stream, school_id")
      .in("id", classIds);

    const schoolIds = Array.from(
      new Set((classes ?? []).map((c: { school_id: string }) => c.school_id).filter(Boolean))
    ) as string[];

    const { data: schools } = await supabase
      .from("schools")
      .select("id, name")
      .in("id", schoolIds);

    const assembled: LinkedChild[] = students.map((s: { id: string; name: string; class_id: string }) => {
      const cls    = (classes ?? []).find((c: { id: string }) => c.id === s.class_id);
      const school = (schools ?? []).find((sc: { id: string }) => sc.id === cls?.school_id);
      const className = cls
        ? cls.name + (cls.stream ? " " + cls.stream : "")
        : "—";
      return {
        student_id:     s.id,
        name:           s.name,
        class_name:     className,
        attendance_pct: 0,
        school_name:    school?.name ?? "—",
      };
    });

    setChildren(assembled);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  return (
    <div style={{ animation: "slideIn 0.22s ease" }}>

      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 20,
      }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: dark }}>My Children</div>
        <div
          onClick={() => router.push("/parent/settings")}
          style={{ fontSize: 22, cursor: "pointer", color: "#6b7280" }}
        >
          ⚙️
        </div>
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1, 2].map(i => (
            <div key={i} style={{ background: "#fff", borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }}>
              <Skeleton w={46} h={46} radius={23} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                <Skeleton w="60%" h={14} />
                <Skeleton w="40%" h={11} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && children.length === 0 && <EmptyState />}

      {/* Children list */}
      {!loading && children.length > 0 && (
        <div>
          {children.map(child => (
            <ChildCard
              key={child.student_id}
              child={child}
              onTap={() => router.push("/parent/child/" + child.student_id + "/profile")}
            />
          ))}
        </div>
      )}

      {/* Add another child — spacer so button doesnt overlap last card */}
      {!loading && children.length > 0 && <div style={{ height: 80 }} />}

      {/* Fixed bottom button */}
      {!loading && children.length > 0 && (
        <div style={{
          position: "fixed",
          bottom: 72,
          left: 0,
          right: 0,
          padding: "0 16px",
          zIndex: 600,
        }}>
          <button
            onClick={() => router.push("/parent/create-child")}
            style={{
              width: "100%",
              maxWidth: 768,
              margin: "0 auto",
              display: "block",
              padding: "14px",
              borderRadius: 14,
              border: "1.5px dashed #d1d5db",
              background: "#fff",
              color: "#6b7280",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              fontFamily: "inherit",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
          >
            + Add Another Child
          </button>
        </div>
      )}
    </div>
  );
}
