"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { C } from "@/components/teacher/ui";

interface HWItem {
  id:          string;
  title:       string;
  subject:     string;
  due_date:    string;
  type:        string;
  class_id:    string;
  class_name:  string;
  sub_count:   number;
  total_count: number;
}

function isOverdue(due: string): boolean {
  const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Nairobi" }))
    .toISOString().split("T")[0];
  return due.split("T")[0] < today;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short" });
}

type Filter = "all" | "active" | "overdue";

export default function TeacherHomeworkPage() {
  const router = useRouter();
  const [items,   setItems]   = useState<HWItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState<Filter>("all");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const [tcRes, clsRes] = await Promise.all([
        supabase.from("teacher_classes").select("class_id").eq("teacher_id", user.id),
        supabase.from("classes").select("id, name").eq("teacher_id", user.id),
      ]);

      const classIds = Array.from(new Set([
        ...(tcRes.data ?? []).map((r: { class_id: string }) => r.class_id),
        ...(clsRes.data ?? []).map((r: { id: string }) => r.id),
      ]));

      if (classIds.length === 0) { setLoading(false); return; }

      const [hwRes, stuRes, allClsRes] = await Promise.all([
        supabase.from("homework")
          .select("id, title, subject, due_date, type, class_id, homework_submissions(id)")
          .in("class_id", classIds)
          .eq("teacher_id", user.id)
          .order("due_date", { ascending: false }),
        supabase.from("students").select("id, class_id").in("class_id", classIds),
        supabase.from("classes").select("id, name").in("id", classIds),
      ]);

      const clsMap = new Map<string, string>();
      for (const c of (allClsRes.data ?? [])) clsMap.set(c.id, c.name);

      const stuCountMap = new Map<string, number>();
      for (const st of (stuRes.data ?? [])) {
        stuCountMap.set(st.class_id, (stuCountMap.get(st.class_id) ?? 0) + 1);
      }

      const result: HWItem[] = ((hwRes.data ?? []) as any[]).map(h => ({
        id:          h.id,
        title:       h.title,
        subject:     h.subject,
        due_date:    h.due_date,
        type:        h.type,
        class_id:    h.class_id,
        class_name:  clsMap.get(h.class_id) ?? "Unknown Class",
        sub_count:   (h.homework_submissions ?? []).length,
        total_count: stuCountMap.get(h.class_id) ?? 0,
      }));

      setItems(result);
      setLoading(false);
    }
    load();
  }, []);

  const active  = items.filter(h => !isOverdue(h.due_date));
  const overdue = items.filter(h =>  isOverdue(h.due_date));
  const shown   = filter === "active" ? active : filter === "overdue" ? overdue : items;
  const totalPending = items.reduce((acc, h) => acc + Math.max(0, h.total_count - h.sub_count), 0);

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: C.textMuted, paddingBottom: 80, background: C.surface, minHeight: "100vh" }}>
      <div style={{ background: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)", padding: "20px 16px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, width: 36, height: 36, color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{"<"}</button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: "#fff", margin: 0 }}>All Homework</h1>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", margin: "2px 0 0" }}>Across all your classes</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { label: "Total",   value: items.length },
            { label: "Active",  value: active.length },
            { label: "Overdue", value: overdue.length },
            { label: "Pending", value: totalPending },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: "rgba(255,255,255,0.15)", borderRadius: 10, padding: "8px 4px", textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{s.value}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "16px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {(["all", "active", "overdue"] as Filter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "8px 16px", borderRadius: 20, border: "none", cursor: "pointer",
              fontFamily: "inherit", fontSize: 12, fontWeight: 700,
              background: filter === f ? "#0f766e" : "#fff",
              color:      filter === f ? "#fff"    : C.textMuted,
              boxShadow:  filter === f ? "0 2px 8px rgba(15,118,110,0.25)" : "0 1px 3px rgba(0,0,0,0.06)",
            }}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: C.textMuted }}>Loading...</div>
        ) : shown.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 20, padding: "40px 20px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>{"\U0001F4DD"}</div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "#111827", margin: "0 0 8px" }}>No homework yet</h2>
            <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>Go into a class to post homework.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {shown.map(h => {
              const over = isOverdue(h.due_date);
              const pct  = h.total_count > 0 ? Math.round((h.sub_count / h.total_count) * 100) : 0;
              return (
                <button
                  key={h.id}
                  onClick={() => router.push(`/teacher/classhub/${h.class_id}/homework/${h.id}`)}
                  style={{
                    width: "100%", textAlign: "left", background: "#fff", borderRadius: 16,
                    padding: "14px 16px", border: "none", cursor: "pointer", fontFamily: "inherit",
                    borderLeft: `4px solid ${over ? "#ef4444" : "#0f766e"}`,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 800, color: "#111827", margin: 0 }}>{h.title}</p>
                      <p style={{ fontSize: 11, color: C.textMuted, margin: "3px 0 0" }}>{h.class_name} {h.subject}</p>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: "right" }}>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 20, background: over ? "#fee2e2" : "#d1fae5", color: over ? "#991b1b" : "#065f46" }}>
                        {over ? "Overdue" : "Active"}
                      </span>
                      <p style={{ fontSize: 11, color: C.textMuted, margin: "4px 0 0", fontWeight: 600 }}>Due {formatDate(h.due_date)}</p>
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#f3f4f6", color: C.textMuted, textTransform: "capitalize" }}>{h.type}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: h.sub_count > 0 ? "#0f766e" : C.textMuted }}>{h.sub_count}/{h.total_count} submitted</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 99, background: "#f3f4f6", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: over && pct < 100 ? "#ef4444" : "#0f766e", borderRadius: 99, transition: "width 0.4s ease" }} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

