"use client";
'use client'

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { ChildMedia } from "@/lib/types";

// ─── Colors ───────────────────────────────────────────────────────────────────
const dark   = "#1e1b4b";
const accent = "#10b981";
const bg     = "#f0f2f5";
const red    = "#ef4444";
const amber  = "#f59e0b";

// ─── Filter type ──────────────────────────────────────────────────────────────
type FilterType = "all" | "photo" | "video" | "document";

// ─── Shimmer ──────────────────────────────────────────────────────────────────
function Shimmer({ w = "100%", h = 16, r = 8 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r, flexShrink: 0,
      background: "linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)",
      backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite",
    }} />
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div style={{
      position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)",
      background: dark, color: "#fff", padding: "12px 24px", borderRadius: 40,
      fontSize: 13, fontWeight: 600, zIndex: 9999, whiteSpace: "nowrap",
      boxShadow: "0 4px 24px rgba(0,0,0,0.18)", animation: "slideUp 0.25s ease",
    }}>{msg}</div>
  );
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────
function Lightbox({ item, onClose }: { item: ChildMedia; onClose: () => void }) {
  const isPhoto    = item.type === "photo";
  const isVideo    = item.type === "video";
  const isDocument = item.type === "document";

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)",
        zIndex: 8000, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", padding: 20,
        animation: "fadeIn 0.2s ease",
      }}
    >
      {/* Close */}
      <button
        onClick={onClose}
        style={{
          position: "absolute", top: 20, right: 20,
          background: "rgba(255,255,255,0.12)", border: "none",
          color: "#fff", width: 40, height: 40, borderRadius: "50%",
          fontSize: 20, cursor: "pointer", display: "flex",
          alignItems: "center", justifyContent: "center",
        }}
      >✕</button>

      {/* Media */}
      <div
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 640, width: "100%", display: "flex", flexDirection: "column", gap: 16 }}
      >
        {isPhoto && (
          <img
            src={item.url}
            alt={item.title ?? "Memory"}
            style={{ width: "100%", maxHeight: "60vh", objectFit: "contain", borderRadius: 16 }}
          />
        )}

        {isVideo && (
          <video
            src={item.url}
            controls
            style={{ width: "100%", maxHeight: "60vh", borderRadius: 16, background: "#000" }}
          />
        )}

        {isDocument && (
          <div style={{
            background: "#fff", borderRadius: 16, padding: 32,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
          }}>
            <div style={{ fontSize: 56 }}>📄</div>
            <p style={{ fontSize: 16, fontWeight: 700, color: dark, textAlign: "center", margin: 0 }}>
              {item.title ?? "Document"}
            </p>
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              style={{
                background: dark, color: "#fff", padding: "10px 28px",
                borderRadius: 24, fontSize: 13, fontWeight: 700,
                textDecoration: "none",
              }}
            >Open Document</a>
          </div>
        )}

        {/* Meta */}
        <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 12, padding: "14px 18px" }}>
          {item.title && (
            <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "#fff" }}>{item.title}</p>
          )}
          {item.description && (
            <p style={{ margin: "0 0 8px", fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.5 }}>{item.description}</p>
          )}
          {item.recorded_at && (
            <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
              {new Date(item.recorded_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Media Card ───────────────────────────────────────────────────────────────
function MediaCard({ item, onClick }: { item: ChildMedia; onClick: () => void }) {
  const isPhoto    = item.type === "photo";
  const isVideo    = item.type === "video";
  const isDocument = item.type === "document";
  const thumb = isPhoto ? item.url : null;

  return (
    <div
      onClick={onClick}
      style={{
        borderRadius: 14, overflow: "hidden", cursor: "pointer",
        background: "#fff", border: "1px solid #e5e7eb",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
        position: "relative",
        aspectRatio: "1 / 1",
        display: "flex", flexDirection: "column",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.transform = "scale(1.02)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 20px rgba(0,0,0,0.12)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.transform = "scale(1)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
      }}
    >
      {/* Thumbnail area */}
      {thumb ? (
        <img
          src={thumb}
          alt={item.title ?? "Memory"}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          loading="lazy"
        />
      ) : (
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          background: isDocument ? "#f0f9ff" : "#f9fafb", fontSize: 36,
        }}>
          {isDocument ? "📄" : isVideo ? "🎬" : "🖼️"}
        </div>
      )}

      {/* Video play overlay */}
      {isVideo && (
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.28)",
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%",
            background: "rgba(255,255,255,0.9)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18,
          }}>▶️</div>
        </div>
      )}

      {/* Bottom label */}
      {(item.title || item.recorded_at) && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          background: "linear-gradient(transparent, rgba(0,0,0,0.65))",
          padding: "24px 10px 8px",
        }}>
          {item.title && (
            <p style={{
              margin: 0, fontSize: 11, fontWeight: 700, color: "#fff",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>{item.title}</p>
          )}
          {item.recorded_at && (
            <p style={{ margin: "2px 0 0", fontSize: 10, color: "rgba(255,255,255,0.65)" }}>
              {new Date(item.recorded_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          )}
        </div>
      )}

      {/* Type badge */}
      <div style={{
        position: "absolute", top: 8, right: 8,
        background: "rgba(0,0,0,0.45)", borderRadius: 20,
        padding: "2px 8px", fontSize: 9, fontWeight: 700,
        color: "#fff", textTransform: "uppercase", letterSpacing: 0.5,
      }}>
        {item.type}
      </div>
    </div>
  );
}

// ─── Upload Sheet ─────────────────────────────────────────────────────────────
function UploadSheet({ onClose, onToast }: { onClose: () => void; onToast: (m: string) => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        zIndex: 7000, display: "flex", alignItems: "flex-end",
        animation: "fadeIn 0.2s ease",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", background: "#fff", borderRadius: "24px 24px 0 0",
          padding: "28px 24px 48px", animation: "slideUp 0.3s ease",
        }}
      >
        <div style={{ width: 40, height: 4, background: "#e5e7eb", borderRadius: 4, margin: "0 auto 24px" }} />
        <p style={{ fontSize: 18, fontWeight: 800, color: dark, margin: "0 0 8px" }}>Add a Memory</p>
        <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 28px" }}>
          Upload photos, videos, or documents to preserve this moment.
        </p>

        {["📷 Photo or Video", "📄 Document"].map(label => (
          <button
            key={label}
            onClick={() => { onToast("Upload coming soon — stay tuned! 🚀"); onClose(); }}
            style={{
              display: "flex", alignItems: "center", gap: 14,
              width: "100%", padding: "16px 20px", marginBottom: 10,
              background: "#f9fafb", border: "1.5px solid #e5e7eb",
              borderRadius: 14, fontSize: 14, fontWeight: 600,
              color: dark, cursor: "pointer", textAlign: "left",
            }}
          >{label}</button>
        ))}

        <button
          onClick={onClose}
          style={{
            width: "100%", marginTop: 8, padding: "14px",
            background: "transparent", border: "none",
            fontSize: 14, color: "#9ca3af", cursor: "pointer", fontWeight: 600,
          }}
        >Cancel</button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MemoriesPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();

  const [childName,    setChildName]    = useState("");
  const [parentId,     setParentId]     = useState("");
  const [media,        setMedia]        = useState<ChildMedia[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [filter,       setFilter]       = useState<FilterType>("all");
  const [lightbox,     setLightbox]     = useState<ChildMedia | null>(null);
  const [showUpload,   setShowUpload]   = useState(false);
  const [toast,        setToast]        = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3000);
  }, []);

  // ── Fetch child name ────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchName() {
      const { data } = await supabase
        .from("students")
        .select("name")
        .eq("id", id)
        .single();
      if (data?.name) setChildName(data.name.split(" ")[0]);
    }
    if (id) fetchName();
    supabase.auth.getUser().then(({ data }) => { if (data.user) setParentId(data.user.id); });
  }, [id]);

  // ── Fetch media ─────────────────────────────────────────────────────────────
  const fetchMedia = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("child_media")
      .select("*")
      .eq("student_id", id)
      .is("deleted_at", null)
      .order("recorded_at", { ascending: false });

    if (!error && data) setMedia(data as ChildMedia[]);
    setLoading(false);
  }, [id]);

  useEffect(() => { if (id) fetchMedia(); }, [id, fetchMedia]);

  // ── Filtered list ───────────────────────────────────────────────────────────
  const filtered = filter === "all" ? media : media.filter(m => m.type === filter);

  // ── Counts ──────────────────────────────────────────────────────────────────
  const counts = {
    all:      media.length,
    photo:    media.filter(m => m.type === "photo").length,
    video:    media.filter(m => m.type === "video").length,
    document: media.filter(m => m.type === "document").length,
  };

  const FILTERS: { id: FilterType; label: string; emoji: string }[] = [
    { id: "all",      label: "All",       emoji: "✨" },
    { id: "photo",    label: "Photos",    emoji: "📷" },
    { id: "video",    label: "Videos",    emoji: "🎬" },
    { id: "document", label: "Documents", emoji: "📄" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: bg, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <style>{`
        @keyframes shimmer  { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
        @keyframes slideUp  { from{transform:translateY(40px);opacity:0} to{transform:translateY(0);opacity:1} }
      `}</style>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "16px 16px 120px" }}>

        {/* ── Hub Tab Bar ── */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto", paddingBottom: 2, WebkitOverflowScrolling: "touch" }}>
          {[
            { label: "👤 Profile",  href: "profile"  },
            { label: "🌱 Life",     href: "life"     },
            { label: "📈 Growth",   href: "growth"   },
            { label: "💰 Finance",  href: "finance"  },
            { label: "📸 Memories", href: "memories" },
            { label: "❤️ Health",   href: "health"   },
          ].map(t => {
            const active = t.href === "memories";
            return (
              <button
                key={t.href}
                onClick={() => router.push(`/parent/child/${id}/${t.href}`)}
                style={{
                  flexShrink: 0, padding: "8px 16px", borderRadius: 20,
                  border: "1.5px solid", borderColor: active ? dark : "#e5e7eb",
                  background: active ? dark : "#fff",
                  color: active ? "#fff" : "#6b7280",
                  fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                }}
              >{t.label}</button>
            );
          })}
        </div>

        {/* ── Hero ── */}
        <div style={{
          background: `linear-gradient(135deg, ${dark} 0%, #312e81 100%)`,
          borderRadius: 20, padding: "20px 20px 18px", marginBottom: 16, color: "#fff",
        }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 4, letterSpacing: 0.5, textTransform: "uppercase" }}>
            Memories
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
            {childName ? `${childName}'s Story` : "Loading…"}
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)" }}>
            {counts.all === 0
              ? "Every moment deserves to be remembered."
              : `${counts.all} ${counts.all === 1 ? "memory" : "memories"} — ${counts.photo} photos · ${counts.video} videos · ${counts.document} docs`
            }
          </div>

          {/* Add button */}
          <button
            onClick={() => setShowUpload(true)}
            style={{
              marginTop: 16, padding: "10px 22px",
              background: accent, color: "#fff", border: "none",
              borderRadius: 24, fontWeight: 700, fontSize: 13,
              cursor: "pointer", fontFamily: "inherit",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}
          >📸 Add Memory</button>
        </div>

        {/* ── Filter Pills ── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 2, WebkitOverflowScrolling: "touch" }}>
          {FILTERS.map(f => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                style={{
                  flexShrink: 0, padding: "7px 16px", borderRadius: 20,
                  border: "1.5px solid", borderColor: active ? accent : "#e5e7eb",
                  background: active ? accent : "#fff",
                  color: active ? "#fff" : "#6b7280",
                  fontWeight: 600, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                  display: "flex", alignItems: "center", gap: 5,
                }}
              >
                {f.emoji} {f.label}
                <span style={{
                  background: active ? "rgba(255,255,255,0.25)" : "#f0f0f0",
                  color: active ? "#fff" : "#9ca3af",
                  borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 700,
                }}>{counts[f.id]}</span>
              </button>
            );
          })}
        </div>

        {/* ── Skeleton ── */}
        {loading && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Shimmer key={i} h={180} r={14} />
            ))}
          </div>
        )}

        {/* ── Empty State ── */}
        {!loading && filtered.length === 0 && (
          <div style={{
            textAlign: "center", padding: "60px 24px",
            background: "#fff", borderRadius: 20,
            border: "1.5px dashed #e5e7eb",
          }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>
              {filter === "photo" ? "📷" : filter === "video" ? "🎬" : filter === "document" ? "📄" : "📸"}
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: dark, margin: "0 0 8px" }}>
              {childName ? `${childName}'s story starts here` : "No memories yet"}
            </p>
            <p style={{ fontSize: 13, color: "#9ca3af", margin: "0 0 24px", lineHeight: 1.6 }}>
              {filter === "all"
                ? "Capture the moments that matter most."
                : `No ${filter}s logged yet.`}
            </p>
            <button
              onClick={() => setShowUpload(true)}
              style={{
                padding: "10px 24px", background: dark, color: "#fff",
                border: "none", borderRadius: 24, fontWeight: 700,
                fontSize: 13, cursor: "pointer", fontFamily: "inherit",
              }}
            >📸 Add First Memory</button>
          </div>
        )}

        {/* ── Media Grid ── */}
        {!loading && filtered.length > 0 && (
          <>
            {/* Upload card — always first in grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div
                onClick={() => setShowUpload(true)}
                style={{
                  borderRadius: 14, border: "2px dashed #d1d5db",
                  background: "#fafafa", cursor: "pointer",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  gap: 8, aspectRatio: "1 / 1",
                  transition: "border-color 0.15s ease, background 0.15s ease",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = accent;
                  (e.currentTarget as HTMLDivElement).style.background = "#f0fdf4";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = "#d1d5db";
                  (e.currentTarget as HTMLDivElement).style.background = "#fafafa";
                }}
              >
                <div style={{ fontSize: 32 }}>📸</div>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#9ca3af", textAlign: "center", lineHeight: 1.4 }}>
                  Add a<br />Memory
                </p>
              </div>

              {filtered.map(item => (
                <MediaCard key={item.id} item={item} onClick={() => setLightbox(item)} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Lightbox ── */}
      {lightbox && <Lightbox item={lightbox} onClose={() => setLightbox(null)} />}

      {/* ── Upload Sheet ── */}
      {showUpload && (
        <UploadSheet
          onClose={() => setShowUpload(false)}
          onToast={showToast}
        />
      )}

      {/* ── Toast ── */}
      <Toast msg={toast} />
    </div>
  );
}
