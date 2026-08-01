"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

type ItemType = "highlight" | "note" | "vocabulary" | "definition" | "formula";

interface ChapterOption {
  id: string;
  title: string | null;
  number: number;
  can_read: boolean;
}

interface ReaderShape {
  ok?: boolean;
  chapters?: ChapterOption[];
}

const LABELS: Record<ItemType, string> = {
  highlight: "Highlight",
  note: "Note",
  vocabulary: "Vocabulary",
  definition: "Definition",
  formula: "Formula",
};

export function StudyCapturePanel({ publicationId }: { publicationId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedChapter = searchParams.get("chapter");
  const [open, setOpen] = useState(false);
  const [chapters, setChapters] = useState<ChapterOption[]>([]);
  const [chapterId, setChapterId] = useState("");
  const [itemType, setItemType] = useState<ItemType>("highlight");
  const [text, setText] = useState("");
  const [meaning, setMeaning] = useState("");
  const [color, setColor] = useState("yellow");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase.rpc("get_vibetextbook_reader", {
        publication_id_input: publicationId,
      });
      if (cancelled) return;
      const payload = data as ReaderShape | null;
      const readable = Array.isArray(payload?.chapters)
        ? payload.chapters.filter((chapter) => chapter.can_read)
        : [];
      setChapters(readable);
      const requested = readable.find((chapter) => chapter.id === requestedChapter);
      setChapterId(requested?.id ?? readable[0]?.id ?? "");
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [publicationId, requestedChapter, supabase]);

  function openPanel() {
    const selection =
      typeof window !== "undefined" ? window.getSelection()?.toString().trim() : "";
    if (selection) setText(selection.slice(0, 2000));
    setMessage(null);
    setOpen(true);
  }

  async function save() {
    if (!chapterId || !text.trim() || saving) return;
    setSaving(true);
    setMessage(null);

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      router.push("/login");
      return;
    }

    const payload =
      itemType === "highlight"
        ? { text: text.trim(), color, context: "" }
        : itemType === "note"
          ? { text: text.trim() }
          : { text: text.trim(), meaning: meaning.trim() };

    const { data, error } = await supabase.rpc("upsert_study_workspace_item", {
      p_item_type: itemType,
      p_chapter_id: chapterId,
      p_payload: payload,
      p_item_id: null,
    });

    const result = data as { ok?: boolean; reason?: string } | null;
    if (error || !result?.ok) {
      setMessage(
        result?.reason === "not_entitled"
          ? "This unit is not currently available."
          : "The study item could not be saved."
      );
      setSaving(false);
      return;
    }

    setMessage(`${LABELS[itemType]} saved.`);
    setText("");
    setMeaning("");
    setSaving(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        aria-label="Open study tools"
        style={{
          position: "fixed",
          right: 16,
          bottom: 18,
          zIndex: 60,
          border: "none",
          borderRadius: 999,
          background: "#CCFF00",
          color: "#090D16",
          padding: "12px 16px",
          fontSize: 13,
          fontWeight: 900,
          boxShadow: "0 12px 30px rgba(0,0,0,.35)",
          cursor: "pointer",
        }}
      >
        ＋ Study
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Save to study workspace"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 70,
            background: "rgba(0,0,0,.62)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setOpen(false);
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 620,
              maxHeight: "88dvh",
              overflowY: "auto",
              background: "#111827",
              borderRadius: "20px 20px 0 0",
              padding: 18,
              color: "#fff",
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>Study tools</div>
                <div style={{ fontSize: 12, opacity: 0.55, marginTop: 3 }}>
                  Save learning material to your private workspace.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close study tools"
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#fff",
                  fontSize: 22,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>

            <label style={{ display: "block", marginTop: 18, fontSize: 12, fontWeight: 800 }}>
              Unit
              <select
                value={chapterId}
                onChange={(event) => setChapterId(event.target.value)}
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: 11,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,.12)",
                  background: "#1a2235",
                  color: "#fff",
                }}
              >
                {chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    Unit {chapter.number} · {chapter.title || `Unit ${chapter.number}`}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: "flex", gap: 7, overflowX: "auto", marginTop: 14 }}>
              {(Object.keys(LABELS) as ItemType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setItemType(type);
                    setMessage(null);
                  }}
                  style={{
                    flexShrink: 0,
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,.12)",
                    background: itemType === type ? "#CCFF00" : "#1a2235",
                    color: itemType === type ? "#090D16" : "#fff",
                    padding: "8px 11px",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  {LABELS[type]}
                </button>
              ))}
            </div>

            <label style={{ display: "block", marginTop: 14, fontSize: 12, fontWeight: 800 }}>
              {itemType === "note" ? "Note" : itemType === "highlight" ? "Selected text" : "Term or formula"}
              <textarea
                value={text}
                maxLength={itemType === "highlight" ? 2000 : 5000}
                onChange={(event) => setText(event.target.value)}
                rows={4}
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: 11,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,.12)",
                  background: "#1a2235",
                  color: "#fff",
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
            </label>

            {itemType === "highlight" && (
              <label style={{ display: "block", marginTop: 12, fontSize: 12, fontWeight: 800 }}>
                Highlight colour
                <select
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  style={{
                    width: "100%",
                    marginTop: 6,
                    padding: 11,
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,.12)",
                    background: "#1a2235",
                    color: "#fff",
                  }}
                >
                  <option value="yellow">Yellow</option>
                  <option value="green">Green</option>
                  <option value="blue">Blue</option>
                  <option value="pink">Pink</option>
                </select>
              </label>
            )}

            {itemType !== "highlight" && itemType !== "note" && (
              <label style={{ display: "block", marginTop: 12, fontSize: 12, fontWeight: 800 }}>
                Meaning or explanation
                <textarea
                  value={meaning}
                  maxLength={5000}
                  onChange={(event) => setMeaning(event.target.value)}
                  rows={3}
                  style={{
                    width: "100%",
                    marginTop: 6,
                    padding: 11,
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,.12)",
                    background: "#1a2235",
                    color: "#fff",
                    resize: "vertical",
                    boxSizing: "border-box",
                  }}
                />
              </label>
            )}

            {message && (
              <div
                role="status"
                style={{
                  marginTop: 12,
                  fontSize: 12,
                  color: message.endsWith("saved.") ? "#CCFF00" : "#ff9b9b",
                }}
              >
                {message}
              </div>
            )}

            <button
              type="button"
              disabled={!chapterId || !text.trim() || saving}
              onClick={() => void save()}
              style={{
                width: "100%",
                marginTop: 16,
                border: "none",
                borderRadius: 12,
                background: "#CCFF00",
                color: "#090D16",
                padding: 13,
                fontSize: 13,
                fontWeight: 900,
                cursor: saving ? "wait" : "pointer",
                opacity: !chapterId || !text.trim() || saving ? 0.55 : 1,
              }}
            >
              {saving ? "Saving…" : `Save ${LABELS[itemType].toLowerCase()}`}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
