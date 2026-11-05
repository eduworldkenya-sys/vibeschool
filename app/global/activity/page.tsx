"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useGlobalAuth } from "@/components/global/shared/GlobalAuthContext";

type ActivityItem = {
  id: string;
  title: string;
  description: string | null;
  created_at: string | null;
  kind: "post" | "resource" | "video";
  href: string;
};

type Filter = "All" | "Posts" | "Resources" | "Videos";

const BG = "#090D16";
const PANEL = "#111827";
const MUTED = "rgba(255,255,255,.58)";
const BORDER = "1px solid rgba(255,255,255,.09)";
const ACCENT = "#CCFF00";

function dateLabel(value: string | null) {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en-KE", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export default function ActivityPage() {
  const { isLoggedIn, userId } = useGlobalAuth();
  const router = useRouter();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [filter, setFilter] = useState<Filter>("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      if (!isLoggedIn || !userId) {
        setItems([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      const [stories, resources] = await Promise.all([
        supabase.from("vibe_stories")
          .select("id,title,description,created_at")
          .eq("author_id", userId)
          .eq("status", "published")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase.from("vibelearn_content")
          .select("id,title,description,type,created_at")
          .eq("submitted_by", userId)
          .eq("status", "live")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      if (!active) return;
      if (stories.error || resources.error) {
        setError("Your activity could not be loaded. Please refresh and try again.");
        setLoading(false);
        return;
      }
      const postItems: ActivityItem[] = (stories.data ?? []).map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        created_at: item.created_at,
        kind: "post",
        href: "/global/read/story/" + item.id,
      }));
      const resourceItems: ActivityItem[] = (resources.data ?? []).map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        created_at: item.created_at,
        kind: String(item.type ?? "").toLowerCase().includes("video") ? "video" : "resource",
        href: "/global/read/" + item.id,
      }));
      setItems([...postItems, ...resourceItems].sort(
        (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
      ));
      setLoading(false);
    }
    load().catch(() => {
      if (active) {
        setError("Your activity could not be loaded. Please refresh and try again.");
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [isLoggedIn, userId]);

  const visible = useMemo(
    () => filter === "All" ? items : items.filter((item) => {
      if (filter === "Posts") return item.kind === "post";
      if (filter === "Videos") return item.kind === "video";
      return item.kind === "resource";
    }),
    [filter, items]
  );

  if (!isLoggedIn) {
    return (
      <main style={{ minHeight: "65dvh", display: "grid", placeItems: "center", textAlign: "center", padding: 24, color: "#fff" }}>
        <div>
          <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>Your activity</h1>
          <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.6, maxWidth: 320 }}>
            Sign in to see your published posts and learning resources in one place.
          </p>
          <button onClick={() => router.push("/global/signup")} style={{ background: ACCENT, color: BG, border: 0, borderRadius: 10, padding: "12px 18px", fontWeight: 800 }}>
            Sign in / Create account
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "70dvh", padding: "8px 0 100px", color: "#fff", display: "grid", alignContent: "start", gap: 16 }}>
      <header>
        <p style={{ color: ACCENT, fontSize: 11, fontWeight: 800, letterSpacing: 1.4, margin: "0 0 6px" }}>YOUR VIBESCHOOL</p>
        <h1 style={{ fontSize: 23, fontWeight: 850, margin: 0 }}>Activity</h1>
        <p style={{ color: MUTED, fontSize: 13, margin: "6px 0 0" }}>Your published posts and learning contributions.</p>
      </header>

      <section style={{ display: "flex", gap: 8, overflowX: "auto" }} aria-label="Filter activity">
        {(["All", "Posts", "Resources", "Videos"] as Filter[]).map((value) => (
          <button key={value} onClick={() => setFilter(value)} aria-pressed={filter === value} style={{
            flexShrink: 0, border: BORDER, borderRadius: 20, padding: "8px 13px",
            background: filter === value ? ACCENT : PANEL, color: filter === value ? BG : "#fff",
            fontSize: 12, fontWeight: 750,
          }}>{value}</button>
        ))}
      </section>

      {loading ? (
        <p role="status" style={{ color: MUTED, fontSize: 13 }}>Loading your activity…</p>
      ) : error ? (
        <section role="alert" style={{ background: PANEL, border: BORDER, borderRadius: 12, padding: 16 }}>
          <p style={{ color: "#ff9b9b", fontSize: 13, margin: "0 0 10px" }}>{error}</p>
          <button onClick={() => window.location.reload()} style={{ background: "transparent", border: BORDER, borderRadius: 8, color: "#fff", padding: "8px 12px" }}>Try again</button>
        </section>
      ) : visible.length === 0 ? (
        <section style={{ background: PANEL, border: BORDER, borderRadius: 14, padding: "30px 18px", textAlign: "center" }}>
          <h2 style={{ fontSize: 15, margin: "0 0 7px" }}>{items.length === 0 ? "Your activity starts here" : "Nothing in this filter yet"}</h2>
          <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.6, margin: "0 auto 16px", maxWidth: 300 }}>
            {items.length === 0 ? "When you publish a story or learning resource, it will appear here." : "Choose another filter to see your contributions."}
          </p>
          {items.length === 0 && <button onClick={() => router.push("/global/create")} style={{ background: ACCENT, color: BG, border: 0, borderRadius: 9, padding: "10px 14px", fontWeight: 800 }}>Create a contribution</button>}
        </section>
      ) : (
        <section style={{ display: "grid", gap: 9 }}>
          {visible.map((item) => (
            <button key={item.kind + item.id} onClick={() => router.push(item.href)} style={{
              width: "100%", textAlign: "left", background: PANEL, border: BORDER,
              borderRadius: 12, padding: 14, color: "#fff", cursor: "pointer",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <span style={{ color: ACCENT, fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>
                  {item.kind === "post" ? "Published post" : item.kind === "video" ? "Published video" : "Published resource"}
                </span>
                <span style={{ color: MUTED, fontSize: 11, flexShrink: 0 }}>{dateLabel(item.created_at)}</span>
              </div>
              <h2 style={{ fontSize: 14, lineHeight: 1.4, margin: "8px 0 4px" }}>{item.title}</h2>
              {item.description && <p style={{ color: MUTED, fontSize: 12, lineHeight: 1.5, margin: 0 }}>{item.description.slice(0, 150)}{item.description.length > 150 ? "…" : ""}</p>}
              <span style={{ display: "block", color: ACCENT, fontSize: 11, fontWeight: 750, marginTop: 10 }}>Open contribution →</span>
            </button>
          ))}
        </section>
      )}
    </main>
  );
}
