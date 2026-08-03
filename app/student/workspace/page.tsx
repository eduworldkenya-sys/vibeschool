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
  | "assigned"
  | "continue"
  | "saved"
  | "bookmarks"
  | "highlights"
  | "notes"
  | "vocabulary"
  | "definitions"
  | "formulae";

type StudyType = "highlight" | "note" | "vocabulary" | "definition" | "formula";

const STUDY_TYPES: readonly StudyType[] = [
  "highlight",
  "note",
  "vocabulary",
  "definition",
  "formula",
];

function isStudyType(value: string): value is StudyType {
  return STUDY_TYPES.includes(value as StudyType);
}

function normalizeStudyPayload(
  value: unknown
): StudyItem["payload"] {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return {};
  }

  const payload = value as Record<string, unknown>;

  return {
    text: typeof payload.text === "string" ? payload.text : undefined,
    meaning:
      typeof payload.meaning === "string"
        ? payload.meaning
        : undefined,
    color:
      typeof payload.color === "string"
        ? payload.color
        : undefined,
    context:
      typeof payload.context === "string"
        ? payload.context
        : undefined,
  };
}

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

type ReadingStatus = "not_started" | "reading" | "completed";
type DueStatus =
  | "no_due_date"
  | "upcoming"
  | "due_today"
  | "overdue"
  | "completed";

interface AssignedReadingItem {
  id: string;
  class_id: string;
  class_name: string | null;
  class_stream: string | null;
  publication_id: string;
  publication_title: string | null;
  cover_url: string | null;
  cbc_subject: string | null;
  cbc_grade: string | null;
  chapter_id: string;
  chapter_number: number;
  chapter_title: string | null;
  assigned_at: string;
  due_at: string | null;
  progress_percent: number;
  started_at: string | null;
  last_read_at: string | null;
  completed_at: string | null;
  reading_status: ReadingStatus;
  due_status: DueStatus;
  reader_url: string;
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
  { id: "assigned", label: "Assigned Reading" },
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
  const [activeTab, setActiveTab] = useState<Tab>("assigned");
  const [assignedItems, setAssignedItems] = useState<AssignedReadingItem[]>([]);
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

    const [
      assignedResult,
      libraryResult,
      continueResult,
      bookmarksResult,
      studyResult,
    ] = await Promise.all([
      supabase.rpc("get_my_assigned_reading"),
      supabase.rpc("get_my_library"),
      supabase.rpc("get_continue_reading", { limit_input: 20 }),
      supabase.rpc("get_my_bookmarks"),
      supabase.rpc("get_my_study_workspace_items", {
        p_item_type: undefined,
      }),
    ]);

    if (
      assignedResult.error ||
      libraryResult.error ||
      continueResult.error ||
      bookmarksResult.error ||
      studyResult.error
    ) {
      console.error(
        "Failed to load workspace:",
        assignedResult.error,
        libraryResult.error,
        continueResult.error,
        bookmarksResult.error,
        studyResult.error
      );
      setPageError("Your study workspace could not be loaded.");
      setLoading(false);
      return;
    }

    const assignedPayload = assignedResult.data as {
      ok?: boolean;
      reason?: string | null;
      items?: AssignedReadingItem[];
    } | null;

    setAssignedItems(
      Array.isArray(assignedPayload?.items) ? assignedPayload.items : []
    );
    setSaved(Array.isArray(libraryResult.data) ? libraryResult.data : []);
    setBookmarks(Array.isArray(bookmarksResult.data) ? bookmarksResult.data : []);
    const normalizedStudyItems: StudyItem[] = Array.isArray(
      studyResult.data
    )
      ? studyResult.data.flatMap(row => {
          if (!isStudyType(row.item_type)) return [];

          return [{
            item_id: row.item_id,
            item_type: row.item_type,
            chapter_id: row.chapter_id,
            publication_id: row.publication_id,
            chapter_title: row.chapter_title,
            chapter_number: row.chapter_number,
            publication_title: row.publication_title,
            cover_url: row.cover_url,
            cbc_grade: row.cbc_grade,
            cbc_subject: row.cbc_subject,
            payload: normalizeStudyPayload(row.payload),
            updated_at: row.updated_at,
          }];
        })
      : [];

    setStudyItems(normalizedStudyItems);

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
          Open assigned chapters, continue reading and keep your study material together.
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

        {!loading && activeTab === "assigned" && (
          <CardList>
            {assignedItems.length === 0 ? (
              <EmptyState
                title="No assigned reading"
                text="Reading assigned by your teachers will appear here."
              />
            ) : (
              assignedItems.map((item) => (
                <AssignedReadingCard
                  key={item.id}
                  item={item}
                  onOpen={() =>
                    openPublication(item.publication_id, item.chapter_id)
                  }
                />
              ))
            )}
          </CardList>
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

function AssignedReadingCard({
  item,
  onOpen,
}: {
  item: AssignedReadingItem;
  onOpen: () => void;
}) {
  const dueLabel = formatDueLabel(item.due_status, item.due_at);
  const classLabel = [item.class_name, item.class_stream]
    .filter(Boolean)
    .join(" · ");
  const progress = Math.max(
    0,
    Math.min(100, Number(item.progress_percent) || 0)
  );

  const statusStyle =
    item.due_status === "overdue"
      ? { background: "#fef2f2", color: "#b91c1c", border: "#fecaca" }
      : item.due_status === "due_today"
        ? { background: "#fff7ed", color: "#c2410c", border: "#fed7aa" }
        : item.due_status === "completed"
          ? { background: "#ecfdf5", color: "#047857", border: "#a7f3d0" }
          : { background: C.accentLight, color: C.accent, border: "#c7d2fe" };

  return (
    <article
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        padding: 13,
        display: "flex",
        gap: 13,
      }}
    >
      <div
        style={{
          width: 68,
          height: 92,
          borderRadius: 10,
          overflow: "hidden",
          flexShrink: 0,
          background: C.accentLight,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 25,
        }}
      >
        {item.cover_url ? (
          <img
            src={item.cover_url}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          "📖"
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div
            style={{
              color: C.text,
              fontSize: 14,
              fontWeight: 850,
              lineHeight: 1.35,
            }}
          >
            {item.publication_title || "Untitled textbook"}
          </div>

          <span
            style={{
              flexShrink: 0,
              border: `1px solid ${statusStyle.border}`,
              background: statusStyle.background,
              color: statusStyle.color,
              borderRadius: 999,
              padding: "4px 7px",
              fontSize: 9,
              fontWeight: 850,
              whiteSpace: "nowrap",
            }}
          >
            {dueLabel}
          </span>
        </div>

        <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>
          {[item.cbc_grade, item.cbc_subject].filter(Boolean).join(" · ")}
        </div>

        <div
          style={{
            color: C.text,
            fontSize: 12,
            fontWeight: 750,
            marginTop: 8,
            lineHeight: 1.4,
          }}
        >
          Unit {item.chapter_number}
          {item.chapter_title ? ` · ${item.chapter_title}` : ""}
        </div>

        {classLabel && (
          <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>
            Assigned to {classLabel}
          </div>
        )}

        <div style={{ marginTop: 10 }}>
          <div
            style={{
              height: 5,
              borderRadius: 999,
              background: C.border,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                background: C.accent,
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              color: C.muted,
              fontSize: 10,
              marginTop: 4,
            }}
          >
            <span>{Math.round(progress)}% read</span>
            <span>{readingStatusLabel(item.reading_status)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpen}
          style={{
            border: "none",
            borderRadius: 9,
            background: C.accent,
            color: "#ffffff",
            padding: "8px 11px",
            fontSize: 11,
            fontWeight: 850,
            cursor: "pointer",
            marginTop: 10,
          }}
        >
          {item.reading_status === "not_started"
            ? "Start reading"
            : item.reading_status === "completed"
              ? "Read again"
              : "Continue reading"}
        </button>
      </div>
    </article>
  );
}

function readingStatusLabel(status: ReadingStatus) {
  if (status === "completed") return "Completed";
  if (status === "reading") return "In progress";
  return "Not started";
}

function formatDueLabel(status: DueStatus, dueAt: string | null) {
  if (status === "completed") return "Completed";
  if (status === "overdue") return "Overdue";
  if (status === "due_today") return "Due today";
  if (status === "no_due_date" || !dueAt) return "No due date";

  const date = new Date(dueAt);
  if (Number.isNaN(date.getTime())) return "Upcoming";

  return `Due ${new Intl.DateTimeFormat("en-KE", {
    day: "numeric",
    month: "short",
  }).format(date)}`;
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
