"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const C = {
  bg: "#f0f2f5",
  surface: "#ffffff",
  border: "#e5e7eb",
  text: "#111827",
  muted: "#6b7280",
  accent: "#6366f1",
  accentLight: "#eef2ff",
  error: "#ef4444",
};

type Tab =
  | "continue"
  | "saved"
  | "bookmarks"
  | "highlights"
  | "notes"
  | "vocabulary"
  | "definitions"
  | "formulae";

type StudyType = "highlight" | "note" | "vocabulary" | "definition" | "formula";

interface SavedPublication {
  publication_id: string;
  cover_url: string | null;
  title: string | null;
  cbc_grade: string | null;
  cbc_subject: string | null;
}

interface BookmarkItem {
  chapter_id: string;
  publication_id: string;
  chapter_title: string | null;
  chapter_number: number;
  publication_title: string | null;
  cover_url: string | null;
  cbc_grade: string | null;
  cbc_subject: string | null;
}

interface ContinueItem {
  publication_id: string;
  title: string | null;
  cover_url: string | null;
  cbc_subject: string | null;
  cbc_grade: string | null;
  current_chapter_id: string;
  current_chapter_number: number;
  current_chapter_title: string | null;
  progress_percent: number;
}

interface StudyItem {
  item_id: string;
  item_type: StudyType;
  chapter_id: string;
  publication_id: string;
  chapter_title: string | null;
  chapter_number: number;
  publication_title: string | null;
  cover_url: string | null;
  cbc_grade: string | null;
  cbc_subject: string | null;
  payload: { text?: string; meaning?: string; color?: string; context?: string };
  updated_at: string;
}

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "continue", label: "Continue Reading" },
  { id: "saved", label: "Saved" },
  { id: "bookmarks", label: "Bookmarks" },
  { id: "highlights", label: "Highlights" },
  { id: "notes", label: "Notes" },
  { id: "vocabulary", label: "Vocabulary" },
  { id: "definitions", label: "Definitions" },
  { id: "formulae", label: "Formulae" },
];

const tabToType: Partial<Record<Tab, StudyType>> = {
  highlights: "highlight",
  notes: "note",
  vocabulary: "vocabulary",
  definitions: "definition",
  formulae: "formula",
};

export default function StudyWorkspacePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("continue");
  const [saved, setSaved] = useState<SavedPublication[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [continueItems, setContinueItems] = useState<ContinueItem[]>([]);
  const [studyItems, setStudyItems] = useState<StudyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editMeaning, setEditMeaning] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadWorkspace() {
    setLoading(true);
    setPageError(null);

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      router.replace("/login");
      return;
    }

    const [libraryResult, continueResult, bookmarksResult, studyResult] =
      await Promise.all([
        supabase.rpc("get_my_library"),
        supabase.rpc("get_continue_reading", { limit_input: 20 }),
        supabase.rpc("get_my_bookmarks"),
        supabase.rpc("get_my_study_workspace_items", { p_item_type: null }),
      ]);

    if (
      libraryResult.error ||
      continueResult.error ||
      bookmarksResult.error ||
      studyResult.error
    ) {
      console.error(
        "Failed to load workspace:",
        libraryResult.error,
        continueResult.error,
        bookmarksResult.error,
        studyResult.error
      );
      setPageError("Your study workspace could not be loaded.");
      setLoading(false);
      return;
    }

    setSaved(Array.isArray(libraryResult.data) ? libraryResult.data : []);
    setBookmarks(Array.isArray(bookmarksResult.data) ? bookmarksResult.data : []);
    setStudyItems(Array.isArray(studyResult.data) ? studyResult.data : []);

    const continuePayload = continueResult.data as {
      items?: ContinueItem[];
    } | null;
    setContinueItems(
      Array.isArray(continuePayload?.items) ? continuePayload.items : []
    );
    setLoading(false);
  }

  useEffect(() => {
    void loadWorkspace();
  }, []);

  function openPublication(publicationId: string, chapterId?: string) {
    const base = `/read/textbook/${encodeURIComponent(publicationId)}`;
    router.push(chapterId ? `${base}?chapter=${encodeURIComponent(chapterId)}` : base);
  }

  const visibleStudyItems = useMemo(() => {
    const type = tabToType[activeTab];
    return type ? studyItems.filter((item) => item.item_type === type) : [];
  }, [activeTab, studyItems]);

  function beginEdit(item: StudyItem) {
    setEditingId(item.item_id);
    setEditText(item.payload.text ?? "");
    setEditMeaning(item.payload.meaning ?? "");
  }

  async function saveEdit(item: StudyItem) {
    if (!editText.trim() || busyId) return;
    setBusyId(item.item_id);
    const payload =
      item.item_type === "highlight"
        ? {
            text: editText.trim(),
            color: item.payload.color ?? "yellow",
            context: item.payload.context ?? "",
          }
        : item.item_type === "note"
          ? { text: editText.trim() }
          : { text: editText.trim(), meaning: editMeaning.trim() };

    const { data, error } = await supabase.rpc("upsert_study_workspace_item", {
      p_item_type: item.item_type,
      p_chapter_id: item.chapter_id,
      p_payload: payload,
      p_item_id: item.item_id,
    });
    const result = data as { ok?: boolean } | null;

    if (error || !result?.ok) {
      setPageError("The study item could not be updated.");
      setBusyId(null);
      return;
    }

    setStudyItems((current) =>
      current.map((currentItem) =>
        currentItem.item_id === item.item_id
          ? {
              ...currentItem,
              payload,
              updated_at: new Date().toISOString(),
            }
          : currentItem
      )
    );
    setEditingId(null);
    setBusyId(null);
  }

  async function deleteItem(item: StudyItem) {
    if (busyId || !window.confirm("Delete this study item?")) return;
    setBusyId(item.item_id);
    const { data, error } = await supabase.rpc("delete_study_workspace_item", {
      p_item_id: item.item_id,
    });
    const result = data as { ok?: boolean } | null;

    if (error || !result?.ok) {
      setPageError("The study item could not be deleted.");
      setBusyId(null);
      return;
    }

    setStudyItems((current) =>
      current.filter((currentItem) => currentItem.item_id !== item.item_id)
    );
    setBusyId(null);
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: C.bg,
        padding: "18px 16px 80px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            border: "none",
            background: "transparent",
            color: C.muted,
            fontSize: 13,
            fontWeight: 700,
            padding: 0,
            cursor: "pointer",
          }}
        >
          ← Back
        </button>

        <h1 style={{ color: C.text, fontSize: 25, margin: "18px 0 4px" }}>
          My Study Workspace
        </h1>
        <p style={{ color: C.muted, fontSize: 13, margin: "0 0 18px" }}>
          Continue reading and keep highlights, notes and study references together.
        </p>

        <div
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            paddingBottom: 10,
            marginBottom: 14,
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                flexShrink: 0,
                border: "none",
                borderRadius: 999,
                padding: "9px 13px",
                background: activeTab === tab.id ? C.accent : C.surface,
                color: activeTab === tab.id ? "#ffffff" : C.muted,
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading && <EmptyState title="Loading workspace…" text="Preparing your study material." />}
        {!loading && pageError && (
          <div
            role="alert"
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 14,
              padding: 16,
              color: C.error,
              fontSize: 13,
              marginBottom: 12,
            }}
          >
            {pageError}
          </div>
        )}

        {!loading && activeTab === "continue" && (
          <CardList>
            {continueItems.length === 0 ? (
              <EmptyState title="Nothing in progress" text="Open a textbook and begin reading to see it here." />
            ) : (
              continueItems.map((item) => (
                <PublicationCard
                  key={item.publication_id}
                  title={item.title}
                  coverUrl={item.cover_url}
                  grade={item.cbc_grade}
                  subject={item.cbc_subject}
                  detail={item.current_chapter_title || `Unit ${item.current_chapter_number}`}
                  progress={item.progress_percent}
                  onOpen={() => openPublication(item.publication_id, item.current_chapter_id)}
                />
              ))
            )}
          </CardList>
        )}

        {!loading && activeTab === "saved" && (
          <CardList>
            {saved.length === 0 ? (
              <EmptyState title="No saved textbooks" text="Use the Save button inside a textbook to add it." />
            ) : (
              saved.map((item) => (
                <PublicationCard
                  key={item.publication_id}
                  title={item.title}
                  coverUrl={item.cover_url}
                  grade={item.cbc_grade}
                  subject={item.cbc_subject}
                  detail="Saved textbook"
                  onOpen={() => openPublication(item.publication_id)}
                />
              ))
            )}
          </CardList>
        )}

        {!loading && activeTab === "bookmarks" && (
          <CardList>
            {bookmarks.length === 0 ? (
              <EmptyState title="No chapter bookmarks" text="Bookmark a unit inside the reader to keep it here." />
            ) : (
              bookmarks.map((item) => (
                <PublicationCard
                  key={item.chapter_id}
                  title={item.publication_title}
                  coverUrl={item.cover_url}
                  grade={item.cbc_grade}
                  subject={item.cbc_subject}
                  detail={`Unit ${item.chapter_number} · ${item.chapter_title || `Unit ${item.chapter_number}`}`}
                  onOpen={() => openPublication(item.publication_id, item.chapter_id)}
                />
              ))
            )}
          </CardList>
        )}

        {!loading && tabToType[activeTab] && (
          <CardList>
            {visibleStudyItems.length === 0 ? (
              <EmptyState
                title={`No ${tabs.find((tab) => tab.id === activeTab)?.label.toLowerCase()}`}
                text="Use the Study button inside a textbook to save material here."
              />
            ) : (
              visibleStudyItems.map((item) => (
                <StudyCard
                  key={item.item_id}
                  item={item}
                  editing={editingId === item.item_id}
                  editText={editText}
                  editMeaning={editMeaning}
                  busy={busyId === item.item_id}
                  onEdit={() => beginEdit(item)}
                  onCancel={() => setEditingId(null)}
                  onTextChange={setEditText}
                  onMeaningChange={setEditMeaning}
                  onSave={() => void saveEdit(item)}
                  onDelete={() => void deleteItem(item)}
                  onOpen={() => openPublication(item.publication_id, item.chapter_id)}
                />
              ))
            )}
          </CardList>
        )}
      </div>
    </main>
  );
}

function CardList({ children }: { children: React.ReactNode }) {
  return <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>{children}</section>;
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: "30px 20px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 34, marginBottom: 10 }}>📚</div>
      <h2 style={{ color: C.text, fontSize: 16, margin: "0 0 7px" }}>{title}</h2>
      <p style={{ color: C.muted, fontSize: 13, margin: 0, lineHeight: 1.55 }}>{text}</p>
    </div>
  );
}

function StudyCard({
  item,
  editing,
  editText,
  editMeaning,
  busy,
  onEdit,
  onCancel,
  onTextChange,
  onMeaningChange,
  onSave,
  onDelete,
  onOpen,
}: {
  item: StudyItem;
  editing: boolean;
  editText: string;
  editMeaning: string;
  busy: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onTextChange: (value: string) => void;
  onMeaningChange: (value: string) => void;
  onSave: () => void;
  onDelete: () => void;
  onOpen: () => void;
}) {
  return (
    <article
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: 14,
      }}
    >
      <div style={{ color: C.muted, fontSize: 11, fontWeight: 800 }}>
        {item.publication_title || "Untitled textbook"} · Unit {item.chapter_number}
      </div>

      {editing ? (
        <>
          <textarea
            value={editText}
            maxLength={item.item_type === "highlight" ? 2000 : 5000}
            onChange={(event) => onTextChange(event.target.value)}
            rows={4}
            style={{
              width: "100%",
              marginTop: 10,
              padding: 10,
              borderRadius: 9,
              border: `1px solid ${C.border}`,
              boxSizing: "border-box",
            }}
          />
          {!["highlight", "note"].includes(item.item_type) && (
            <textarea
              value={editMeaning}
              maxLength={5000}
              onChange={(event) => onMeaningChange(event.target.value)}
              rows={3}
              placeholder="Meaning or explanation"
              style={{
                width: "100%",
                marginTop: 8,
                padding: 10,
                borderRadius: 9,
                border: `1px solid ${C.border}`,
                boxSizing: "border-box",
              }}
            />
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button type="button" disabled={busy || !editText.trim()} onClick={onSave}>
              {busy ? "Saving…" : "Save"}
            </button>
            <button type="button" disabled={busy} onClick={onCancel}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          <div style={{ color: C.text, fontSize: 15, fontWeight: 800, marginTop: 8, whiteSpace: "pre-wrap" }}>
            {item.payload.text}
          </div>
          {item.payload.meaning && (
            <div style={{ color: C.muted, fontSize: 13, lineHeight: 1.55, marginTop: 7, whiteSpace: "pre-wrap" }}>
              {item.payload.meaning}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <button type="button" onClick={onOpen}>Open unit</button>
            <button type="button" onClick={onEdit}>Edit</button>
            <button type="button" disabled={busy} onClick={onDelete}>
              {busy ? "Deleting…" : "Delete"}
            </button>
          </div>
        </>
      )}
    </article>
  );
}

function PublicationCard({
  title,
  coverUrl,
  grade,
  subject,
  detail,
  progress,
  onOpen,
}: {
  title: string | null;
  coverUrl: string | null;
  grade: string | null;
  subject: string | null;
  detail: string;
  progress?: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        width: "100%",
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: 12,
        display: "flex",
        gap: 13,
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          width: 62,
          height: 82,
          borderRadius: 9,
          overflow: "hidden",
          flexShrink: 0,
          background: C.accentLight,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
        }}
      >
        {coverUrl ? (
          <img src={coverUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          "📖"
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: C.text, fontSize: 14, fontWeight: 800, lineHeight: 1.35 }}>
          {title || "Untitled textbook"}
        </div>
        <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>
          {[grade, subject].filter(Boolean).join(" · ")}
        </div>
        <div style={{ color: C.muted, fontSize: 12, marginTop: 7 }}>{detail}</div>
        {typeof progress === "number" && (
          <div style={{ marginTop: 9 }}>
            <div style={{ height: 5, borderRadius: 999, background: C.border, overflow: "hidden" }}>
              <div
                style={{
                  width: `${Math.max(0, Math.min(100, progress))}%`,
                  height: "100%",
                  background: C.accent,
                }}
              />
            </div>
            <div style={{ color: C.muted, fontSize: 10, marginTop: 4 }}>
              {Math.round(progress)}% read
            </div>
          </div>
        )}
      </div>
    </button>
  );
}
