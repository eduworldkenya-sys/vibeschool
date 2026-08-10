"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import type {
  ContentBlock,
  VibePublication,
} from "@/lib/publishTypes";
import { FORMAT_META } from "@/lib/publishTypes";
import { ContentBlockEditor } from "@/components/global/publish/ContentBlockEditor";
import {
  buildReaderSearchIndex,
  readerChapterUrl,
  searchReaderIndex,
} from "@/lib/read/readerSearch";

const BG = "#090D16";
const SURFACE = "#111827";
const CARD = "#1a2235";
const ACCENT = "#CCFF00";
const TEXT = "#ffffff";
const MUTED = "rgba(255,255,255,0.48)";
const BORDER = "rgba(255,255,255,0.08)";

type AccessState =
  | "loading"
  | "ready"
  | "not_found"
  | "error";

interface ReaderCurriculum {
  framework: string | null;
  grade: string | null;
  subject: string | null;
  strand: string | null;
  sub_strand: string | null;
  topic: string | null;
  term: number | null;
  week: number | null;
  learning_outcomes: string[];
  key_inquiry_questions: string[];
  suggested_experiences: string[];
  core_competencies: string[];
  core_values: string[];
  source_ref: string | null;
  alignment_status:
    | "unclaimed"
    | "creator_claimed"
    | "pending_review"
    | "verified"
    | "rejected";
  authority: "official" | "publisher" | null;
  verified_by: string | null;
  verified_at: string | null;
  has_curriculum_detail: boolean;
}

interface ReaderChapter {
  id: string;
  publication_id: string;
  title: string | null;
  number: number;
  status: "draft" | "published" | "locked";
  word_count: number | null;
  reading_time_min: number | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  cbc_strand: string | null;
  can_read: boolean;
  progress_percent: number | null;
  completed_at: string | null;
  last_read_at: string | null;
  curriculum: ReaderCurriculum;
  is_bookmarked: boolean;
  blocks: ContentBlock[] | null;
}

interface ReaderPayload {
  ok: boolean;
  reason: string | null;
  viewer_is_author: boolean;
  author_name: string;
  publication: VibePublication;
  chapters: ReaderChapter[];
  resume: {
    chapter_id: string;
    progress_percent: number;
    last_read_at: string;
  } | null;
}

interface ReaderTeacherClass {
  id: string;
  name: string;
  stream: string | null;
}

const ALIGNMENT_LABELS: Record<
  ReaderCurriculum["alignment_status"],
  { label: string; color: string }
> = {
  verified: { label: "Verified curriculum alignment", color: ACCENT },
  pending_review: { label: "Alignment under review", color: "#F5A623" },
  creator_claimed: {
    label: "Curriculum alignment claimed by publisher",
    color: MUTED,
  },
  unclaimed: { label: "No verified alignment", color: MUTED },
  rejected: { label: "Alignment not verified", color: "#FF5C5C" },
};

const COVER_GRADIENTS = [
  "linear-gradient(135deg,#1a2235,#2d3748)",
  "linear-gradient(135deg,#0f2027,#203a43,#2c5364)",
  "linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)",
  "linear-gradient(135deg,#0d0d0d,#1a1a1a,#333)",
  "linear-gradient(135deg,#0a0a0a,#1a2235)",
];

function curriculumPath(cur: ReaderCurriculum): string {
  const parts: string[] = [];
  if (cur.grade) parts.push(capitalizeWords(cur.grade));
  if (cur.subject) parts.push(capitalizeWords(cur.subject));
  if (cur.strand) parts.push(cur.strand);
  if (cur.sub_strand) parts.push(cur.sub_strand);
  if (cur.topic) parts.push(cur.topic);
  const termWeek: string[] = [];
  if (cur.term) termWeek.push("Term " + cur.term);
  if (cur.week) termWeek.push("Week " + cur.week);
  const path = parts.join(" › ");
  const tail = termWeek.join(" · ");
  if (path && tail) return path + "  ·  " + tail;
  return path || tail;
}

function capitalizeWords(value: string): string {
  return value
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function coverGradient(id: string): string {
  if (!id) return COVER_GRADIENTS[0];

  return COVER_GRADIENTS[
    id.charCodeAt(0) % COVER_GRADIENTS.length
  ];
}

function formatDate(value: string | null): string {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-KE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function normalizeBlocks(
  value: ContentBlock[] | null | unknown
): ContentBlock[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (block): block is ContentBlock =>
      !!block &&
      typeof block === "object" &&
      typeof block.id === "string" &&
      typeof block.type === "string" &&
      typeof block.content === "string"
  );
}

// READ-008C: SEARCH POLISH
function HighlightedText({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return <>{text}</>;

  const lowerText = text.toLocaleLowerCase("en");
  const lowerQuery = normalizedQuery.toLocaleLowerCase("en");
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let matchIndex = lowerText.indexOf(lowerQuery);

  while (matchIndex >= 0) {
    if (matchIndex > cursor) {
      parts.push(text.slice(cursor, matchIndex));
    }

    const matchEnd = matchIndex + normalizedQuery.length;
    parts.push(
      <mark
        key={`${matchIndex}-${matchEnd}`}
        style={{
          background: "rgba(204,255,0,0.22)",
          color: TEXT,
          borderRadius: 3,
          padding: "0 2px",
        }}
      >
        {text.slice(matchIndex, matchEnd)}
      </mark>
    );

    cursor = matchEnd;
    matchIndex = lowerText.indexOf(lowerQuery, cursor);
  }

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return <>{parts}</>;
}

function readerTeacherClassLabel(item: ReaderTeacherClass): string {
  return [item.name, item.stream].filter(Boolean).join(" · ");
}

function readerDateTimeLocalMinimum(): string {
  const date = new Date(Date.now() + 60_000);
  const offsetMs = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - offsetMs)
    .toISOString()
    .slice(0, 16);
}

function readerAssignmentError(reason: string | null | undefined): string {
  switch (reason) {
    case "auth_required":
      return "Your session has expired. Sign in again.";
    case "due_date_must_be_future":
      return "The due date must be in the future.";
    case "class_not_assigned":
      return "You are not assigned to this class.";
    case "chapter_not_assignable":
      return "This unit is not currently available for assignment.";
    case "already_assigned":
      return "This unit is already actively assigned to that class.";
    default:
      return "The unit could not be assigned. Try again.";
  }
}

function ChapterAssignmentPanel({
  chapter,
  classes,
  publicationTitle,
  onClose,
}: {
  chapter: ReaderChapter;
  classes: ReaderTeacherClass[];
  publicationTitle: string;
  onClose: () => void;
}) {
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [dueValue, setDueValue] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState("");
  const [successClass, setSuccessClass] = useState("");

  async function assignChapter() {
    if (assigning || !classId) return;

    let dueAt: string | null = null;

    if (dueValue) {
      const dueDate = new Date(dueValue);

      if (
        Number.isNaN(dueDate.getTime()) ||
        dueDate.getTime() <= Date.now()
      ) {
        setError("The due date must be in the future.");
        return;
      }

      dueAt = dueDate.toISOString();
    }

    setAssigning(true);
    setError("");
    setSuccessClass("");

    const sb = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error: rpcError } = await sb.rpc(
      "assign_chapter_to_class",
      {
        p_class_id: classId,
        p_chapter_id: chapter.id,
        p_due_at: dueAt,
      }
    );

    const result = data as {
      ok?: boolean;
      reason?: string | null;
      assignment_id?: string;
    } | null;

    if (rpcError || !result?.ok) {
      console.error(
        "Failed to assign textbook unit:",
        rpcError ?? result
      );
      setError(
        readerAssignmentError(
          result?.reason ??
            (rpcError?.message.includes("AUTH")
              ? "auth_required"
              : null)
        )
      );
      setAssigning(false);
      return;
    }

    const assignedClass = classes.find(item => item.id === classId);
    setSuccessClass(
      assignedClass
        ? readerTeacherClassLabel(assignedClass)
        : "the selected class"
    );
    setAssigning(false);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Assign unit to class"
      style={{
        background: SURFACE,
        border: "1px solid rgba(204,255,0,0.28)",
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        boxShadow: "0 14px 40px rgba(0,0,0,0.3)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div>
          <div
            style={{
              color: ACCENT,
              fontSize: 10,
              fontWeight: 850,
              letterSpacing: "0.1em",
              marginBottom: 5,
            }}
          >
            ASSIGN READING
          </div>

          <div
            style={{
              color: TEXT,
              fontSize: 15,
              fontWeight: 850,
              lineHeight: 1.4,
            }}
          >
            {chapter.title || `Unit ${chapter.number}`}
          </div>

          <div
            style={{
              color: MUTED,
              fontSize: 11,
              marginTop: 3,
            }}
          >
            {publicationTitle}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close assignment panel"
          style={{
            background: "transparent",
            border: `1px solid ${BORDER}`,
            color: MUTED,
            width: 34,
            height: 34,
            borderRadius: 9,
            cursor: "pointer",
            fontSize: 18,
          }}
        >
          ×
        </button>
      </div>

      {successClass ? (
        <div
          style={{
            borderRadius: 12,
            border: "1px solid rgba(204,255,0,0.35)",
            background: "rgba(204,255,0,0.08)",
            padding: 14,
          }}
        >
          <div
            style={{
              color: ACCENT,
              fontSize: 14,
              fontWeight: 850,
              marginBottom: 5,
            }}
          >
            ✓ Reading assigned
          </div>

          <div
            style={{
              color: TEXT,
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            This unit is now available in the Assigned Reading workspace for{" "}
            {successClass}.
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              marginTop: 12,
              width: "100%",
              border: "none",
              borderRadius: 10,
              background: ACCENT,
              color: BG,
              padding: "11px 14px",
              fontWeight: 850,
              cursor: "pointer",
            }}
          >
            Done
          </button>
        </div>
      ) : (
        <>
          <label
            htmlFor={`assignment-class-${chapter.id}`}
            style={{
              display: "block",
              color: MUTED,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.08em",
              marginBottom: 6,
            }}
          >
            CLASS
          </label>

          <select
            id={`assignment-class-${chapter.id}`}
            value={classId}
            onChange={event => {
              setClassId(event.target.value);
              setError("");
            }}
            disabled={assigning}
            style={{
              width: "100%",
              background: CARD,
              color: TEXT,
              border: `1px solid ${BORDER}`,
              borderRadius: 11,
              padding: "12px 13px",
              fontSize: 13,
              outline: "none",
              marginBottom: 13,
            }}
          >
            {classes.map(item => (
              <option key={item.id} value={item.id}>
                {readerTeacherClassLabel(item)}
              </option>
            ))}
          </select>

          <label
            htmlFor={`assignment-due-${chapter.id}`}
            style={{
              display: "block",
              color: MUTED,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.08em",
              marginBottom: 6,
            }}
          >
            DUE DATE · OPTIONAL
          </label>

          <input
            id={`assignment-due-${chapter.id}`}
            type="datetime-local"
            value={dueValue}
            min={readerDateTimeLocalMinimum()}
            onChange={event => {
              setDueValue(event.target.value);
              setError("");
            }}
            disabled={assigning}
            style={{
              width: "100%",
              boxSizing: "border-box",
              background: CARD,
              color: TEXT,
              colorScheme: "dark",
              border: `1px solid ${BORDER}`,
              borderRadius: 11,
              padding: "12px 13px",
              fontSize: 13,
              outline: "none",
            }}
          />

          {error && (
            <div
              role="alert"
              style={{
                color: "#FF8A8A",
                fontSize: 12,
                lineHeight: 1.5,
                marginTop: 10,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="button"
            disabled={assigning || !classId}
            onClick={() => void assignChapter()}
            style={{
              width: "100%",
              border: "none",
              borderRadius: 11,
              background:
                assigning || !classId
                  ? "rgba(204,255,0,0.25)"
                  : ACCENT,
              color: BG,
              padding: "12px 14px",
              marginTop: 14,
              fontWeight: 900,
              fontSize: 13,
              cursor:
                assigning || !classId
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {assigning ? "Assigning…" : "Assign Unit"}
          </button>
        </>
      )}
    </div>
  );
}

function ErrorScreen({
  message,
  onHome,
}: {
  message: string;
  onHome: () => void;
}) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: BG,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: "0 24px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 48 }}>📖</div>

      <h2
        style={{
          fontSize: 20,
          fontWeight: 800,
          color: TEXT,
          margin: 0,
        }}
      >
        {message}
      </h2>

      <button
        type="button"
        onClick={onHome}
        style={{
          background: ACCENT,
          color: BG,
          border: "none",
          borderRadius: 12,
          padding: "12px 24px",
          fontSize: 14,
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        Go Home
      </button>
    </div>
  );
}

export default function ReadTextbookPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedChapterId = searchParams.get("chapter");
  const requestedSearchQuery = searchParams.get("q") ?? "";
  const requestedBlockId = searchParams.get("block");

  const publicationId =
    typeof params.publicationId === "string"
      ? params.publicationId
      : "";

  const [state, setState] =
    useState<AccessState>("loading");

  const [payload, setPayload] =
    useState<ReaderPayload | null>(null);

  const [activeIndex, setActiveIndex] =
    useState(0);

  const [publicationSaved, setPublicationSaved] =
    useState(false);
  const [saveLoading, setSaveLoading] =
    useState(false);
  const [saveError, setSaveError] =
    useState<string | null>(null);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [bookmarkError, setBookmarkError] = useState<string | null>(null);
  const [teacherClasses, setTeacherClasses] = useState<ReaderTeacherClass[]>([]);
  const [teacherClassesLoading, setTeacherClassesLoading] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(requestedSearchQuery);
  const [selectedSearchResult, setSelectedSearchResult] = useState(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!publicationId) {
      setState("not_found");
      return;
    }

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    async function loadReader() {
      setState("loading");

      // Issue #41: anonymous visitors use the RLS-bound SECURITY INVOKER
      // contract. Signed-in viewers use the privileged reader for caller-scoped
      // entitlements, progress, bookmarks and author draft preview.
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const readerRpc = session
        ? "get_vibetextbook_reader"
        : "get_public_vibetextbook_reader";

      let { data, error } = await supabase.rpc(readerRpc, {
        publication_id_input: publicationId,
      });

      // Backward-compatible release sequencing: the frontend may be promoted
      // before the migration creates the public RPC. Only a missing-function
      // response may fall back to the legacy reader; all other errors fail
      // closed. Once the migration is applied, anon can no longer execute the
      // legacy RPC and this path becomes unreachable.
      if (
        !session &&
        error &&
        (error.code === "PGRST202" || error.code === "42883")
      ) {
        const legacyReader = await supabase.rpc(
          "get_vibetextbook_reader",
          {
            publication_id_input: publicationId,
          }
        );

        data = legacyReader.data;
        error = legacyReader.error;
      }

      if (cancelled) return;

      if (error) {
        console.error(
          "Failed to load VibeTextbook reader:",
          error
        );
        setState("error");
        return;
      }

      const nextPayload =
        data as ReaderPayload | null;

      if (
        !nextPayload ||
        !nextPayload.ok ||
        !nextPayload.publication
      ) {
        setState("not_found");
        return;
      }

      const chapters = Array.isArray(
        nextPayload.chapters
      )
        ? nextPayload.chapters
        : [];

      setPayload({
        ...nextPayload,
        chapters,
      });

      const requestedIndex = requestedChapterId
        ? chapters.findIndex(
            (chapter) =>
              chapter.id === requestedChapterId &&
              chapter.publication_id === publicationId
          )
        : -1;
      const resumeChapterId = nextPayload.resume?.chapter_id ?? null;
      const resumeIndex = resumeChapterId
        ? chapters.findIndex((chapter) => chapter.id === resumeChapterId)
        : -1;
      setActiveIndex(
        requestedIndex >= 0 ? requestedIndex : resumeIndex >= 0 ? resumeIndex : 0
      );
      setState("ready");

      if (
        nextPayload.publication.status ===
        "published"
      ) {
        const storageKey =
          `read_pub_${publicationId}`;

        const alreadyRecorded =
          typeof sessionStorage !== "undefined" &&
          sessionStorage.getItem(storageKey);

        if (!alreadyRecorded) {
          const { error: readError } =
            await supabase.rpc(
              "increment_publication_reads",
              {
                pub_id: publicationId,
                viewer_id: null,
              }
            );

          if (
            !readError &&
            typeof sessionStorage !== "undefined"
          ) {
            sessionStorage.setItem(
              storageKey,
              "1"
            );
          }

          if (readError) {
            console.warn(
              "Publication read was not recorded:",
              readError
            );
          }
        }
      }
    }

    void loadReader();

    return () => {
      cancelled = true;
    };
  }, [publicationId, requestedChapterId]);

  const publication = payload?.publication ?? null;
  // READ-008D: NAVIGATION INTEGRITY
  const chapters = useMemo(
    () => payload?.chapters ?? [],
    [payload?.chapters]
  );

  const readerSearchIndex = useMemo(
    () => buildReaderSearchIndex(chapters),
    [chapters]
  );

  const searchResults = useMemo(
    () => searchReaderIndex(readerSearchIndex, searchQuery),
    [readerSearchIndex, searchQuery]
  );

  const selectedSearchBlockId =
    searchResults[selectedSearchResult]?.blockId ?? null;
  const searchResultRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    setSelectedSearchResult((current) => {
      if (searchResults.length === 0) return 0;
      return Math.min(current, searchResults.length - 1);
    });
  }, [searchResults.length]);

  useEffect(() => {
    searchResultRefs.current[selectedSearchResult]?.scrollIntoView({
      block: "nearest",
    });
  }, [selectedSearchResult]);

  function updateReaderUrl(
    chapterId: string,
    query = searchQuery,
    blockId?: string
  ) {
    if (!publicationId || typeof window === "undefined") return;

    window.history.replaceState(
      window.history.state,
      "",
      readerChapterUrl(publicationId, chapterId, query, blockId)
    );
  }

  function navigateToChapter(
    index: number,
    blockId?: string,
    query = searchQuery
  ) {
    const chapter = chapters[index];
    if (!chapter) return;

    setActiveIndex(index);
    setSelectedSearchResult((current) =>
      blockId ? current : 0
    );
    updateReaderUrl(chapter.id, query, blockId);

    window.setTimeout(() => {
      const target = blockId
        ? document.getElementById(`reader-block-${blockId}`)
        : document.getElementById("reader-active-unit");

      target?.scrollIntoView({
        behavior: "smooth",
        block: blockId ? "center" : "start",
      });
    }, 80);
  }

  function openSearchResult(resultIndex: number) {
    const result = searchResults[resultIndex];
    if (!result) return;

    const chapterIndex = chapters.findIndex(
      (chapter) => chapter.id === result.chapterId
    );
    if (chapterIndex < 0) return;

    setSelectedSearchResult(resultIndex);
    navigateToChapter(chapterIndex, result.blockId, searchQuery);
  }

  useEffect(() => {
    setSearchQuery(requestedSearchQuery);
  }, [requestedSearchQuery]);

  useEffect(() => {
    if (!requestedBlockId || state !== "ready") return;

    window.setTimeout(() => {
      document
        .getElementById(`reader-block-${requestedBlockId}`)
        ?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
    }, 100);
  }, [requestedBlockId, state]);

  useEffect(() => {
    function handleReaderShortcut(event: KeyboardEvent) {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "f"
      ) {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    }

    window.addEventListener("keydown", handleReaderShortcut);
    return () => window.removeEventListener("keydown", handleReaderShortcut);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSavedState() {
      if (!publicationId || state !== "ready") return;

      const sb = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { data: authData } = await sb.auth.getUser();

      if (!authData.user || cancelled) {
        setPublicationSaved(false);
        return;
      }

      const { data, error } = await sb
        .from("vibe_workspace_items")
        .select("id")
        .eq("viewer_id", authData.user.id)
        .eq("publication_id", publicationId)
        .eq("item_type", "publication_save")
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.warn("Could not load saved state:", error);
        return;
      }

      setPublicationSaved(Boolean(data));
    }

    void loadSavedState();

    return () => {
      cancelled = true;
    };
  }, [publicationId, state]);

  async function togglePublicationSave() {
    if (!publicationId || saveLoading) return;

    setSaveLoading(true);
    setSaveError(null);

    const sb = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: authData } = await sb.auth.getUser();

    if (!authData.user) {
      setSaveLoading(false);
      router.push("/login");
      return;
    }

    const { data, error } = await sb.rpc(
      "toggle_publication_save",
      {
        p_publication_id: publicationId,
      }
    );

    if (error) {
      console.error("Failed to toggle publication save:", error);
      setSaveError("The textbook could not be saved.");
      setSaveLoading(false);
      return;
    }

    const result = data as {
      ok?: boolean;
      reason?: string | null;
      saved?: boolean;
    } | null;

    if (!result?.ok) {
      setSaveError(
        result?.reason === "not_entitled"
          ? "This textbook is not currently available."
          : "The textbook could not be saved."
      );
      setSaveLoading(false);
      return;
    }

    setPublicationSaved(Boolean(result.saved));
    setSaveLoading(false);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadTeacherClasses() {
      if (state !== "ready") return;

      setTeacherClassesLoading(true);

      const sb = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { data: authData } = await sb.auth.getUser();

      if (!authData.user || cancelled) {
        setTeacherClasses([]);
        setTeacherClassesLoading(false);
        return;
      }

      const { data, error } = await sb
        .from("teacher_classes")
        .select("class_id, classes(id, name, stream)")
        .eq("teacher_id", authData.user.id);

      if (cancelled) return;

      if (error) {
        console.warn("Could not load teacher classes:", error);
        setTeacherClasses([]);
        setTeacherClassesLoading(false);
        return;
      }

      const classMap = new Map<string, ReaderTeacherClass>();

      for (const row of data ?? []) {
        const joined = Array.isArray(row.classes)
          ? row.classes[0]
          : row.classes;

        if (
          joined &&
          typeof joined.id === "string" &&
          typeof joined.name === "string"
        ) {
          classMap.set(joined.id, {
            id: joined.id,
            name: joined.name,
            stream:
              typeof joined.stream === "string" && joined.stream.trim()
                ? joined.stream
                : null,
          });
        }
      }

      setTeacherClasses(
        Array.from(classMap.values()).sort((a, b) =>
          readerTeacherClassLabel(a).localeCompare(
            readerTeacherClassLabel(b)
          )
        )
      );
      setTeacherClassesLoading(false);
    }

    void loadTeacherClasses();

    return () => {
      cancelled = true;
    };
  }, [state]);

  async function toggleChapterBookmark() {
    if (!activeChapter || bookmarkLoading) return;
    const chapterId = activeChapter.id;
    const before = Boolean(activeChapter.is_bookmarked);
    setBookmarkLoading(true);
    setBookmarkError(null);

    const updateLocal = (bookmarked: boolean) =>
      setPayload((current) => current ? ({
        ...current,
        chapters: current.chapters.map((chapter) =>
          chapter.id === chapterId ? { ...chapter, is_bookmarked: bookmarked } : chapter
        ),
      }) : current);

    updateLocal(!before);
    const sb = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: authData } = await sb.auth.getUser();
    if (!authData.user) {
      updateLocal(before);
      setBookmarkLoading(false);
      router.push("/login");
      return;
    }
    const { data, error } = await sb.rpc("toggle_chapter_bookmark", {
      p_chapter_id: chapterId,
    });
    const result = data as { ok?: boolean; reason?: string | null; bookmarked?: boolean } | null;
    if (error || !result?.ok) {
      console.error("Failed to toggle chapter bookmark:", error ?? result);
      updateLocal(before);
      setBookmarkError(result?.reason === "not_entitled"
        ? "This unit is not currently available to bookmark."
        : "The bookmark could not be updated.");
      setBookmarkLoading(false);
      return;
    }
    updateLocal(Boolean(result.bookmarked));
    setBookmarkLoading(false);
  }

  const safeActiveIndex =
    chapters.length === 0
      ? 0
      : Math.min(
          Math.max(activeIndex, 0),
          chapters.length - 1
        );

  const activeChapter =
    chapters[safeActiveIndex] ?? null;

  const previousReadableIndex = useMemo(() => {
    for (let index = safeActiveIndex - 1; index >= 0; index -= 1) {
      if (chapters[index]?.can_read) return index;
    }
    return -1;
  }, [chapters, safeActiveIndex]);

  const nextReadableIndex = useMemo(() => {
    for (
      let index = safeActiveIndex + 1;
      index < chapters.length;
      index += 1
    ) {
      if (chapters[index]?.can_read) return index;
    }
    return -1;
  }, [chapters, safeActiveIndex]);

  const activeBlocks = useMemo(
    () => normalizeBlocks(activeChapter?.blocks),
    [activeChapter?.blocks]
  );

  const previousChapterRef = useRef<
    { id: string; publicationId: string } | null
  >(null);

  useEffect(() => {
    if (state !== "ready") return;
    if (!publication || !activeChapter) return;

    const sb = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const previous = previousChapterRef.current;

    if (previous && previous.id !== activeChapter.id) {
      void sb.rpc("record_reading_progress", {
        publication_id_input: previous.publicationId,
        chapter_id_input: previous.id,
        progress_percent_input: 100,
      });
    }

    if (!previous || previous.id !== activeChapter.id) {
      window.dispatchEvent(
        new CustomEvent("vibe:reader-chapter", {
          detail: {
            publicationId: publication.id,
            chapterId: activeChapter.id,
            progressPercent: Math.max(activeChapter.progress_percent ?? 0, 10),
          },
        })
      );

      previousChapterRef.current = {
        id: activeChapter.id,
        publicationId: publication.id,
      };

      if (activeChapter.can_read) {
        void sb.rpc("record_reading_progress", {
          publication_id_input: publication.id,
          chapter_id_input: activeChapter.id,
          progress_percent_input: 10,
        });
      }
    }
  }, [state, publication?.id, activeChapter?.id, activeChapter?.can_read]);

  const [curriculumExpanded, setCurriculumExpanded] = useState(false);

  if (state === "loading") {
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: BG,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: `3px solid ${ACCENT}`,
            borderTopColor: "transparent",
            animation: "spin 0.8s linear infinite",
          }}
        />

        <style
          dangerouslySetInnerHTML={{
            __html:
              "@keyframes spin{to{transform:rotate(360deg)}}",
          }}
        />
      </div>
    );
  }

  if (
    state === "not_found" ||
    !payload ||
    !publication
  ) {
    return (
      <ErrorScreen
        message="Textbook not found"
        onHome={() => router.push("/global")}
      />
    );
  }

  if (state === "error") {
    return (
      <ErrorScreen
        message="The textbook could not be loaded"
        onHome={() => router.push("/global")}
      />
    );
  }

  const meta = FORMAT_META.vibetextbook;
  const gradient = coverGradient(publication.id);

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: BG,
        fontFamily:
          "system-ui,-apple-system,sans-serif",
      }}
    >
      <div
        style={{
          position: "relative",
          height: 240,
          overflow: "hidden",
        }}
      >
        {publication.cover_url ? (
          <img
            src={publication.cover_url}
            alt={publication.title || "Textbook cover"}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: gradient,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontSize: 56,
                opacity: 0.4,
              }}
            >
              {meta.icon}
            </span>
          </div>
        )}

        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top,rgba(9,13,22,1) 0%,rgba(9,13,22,0.3) 70%,transparent 100%)",
          }}
        />

        <button
          type="button"
          onClick={() => router.back()}
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            background: "rgba(9,13,22,0.72)",
            border: `1px solid ${BORDER}`,
            borderRadius: 10,
            padding: "7px 14px",
            color: TEXT,
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            backdropFilter: "blur(8px)",
          }}
        >
          ← Back
        </button>
      </div>

      <main
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "20px 16px 80px",
          boxSizing: "border-box",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            background:
              "rgba(255,255,255,0.06)",
            borderRadius: 24,
            padding: "4px 11px",
            fontSize: 11,
            fontWeight: 800,
            color: MUTED,
          }}
        >
          {meta.icon} {meta.label}
        </span>

        {(publication.cbc_grade || publication.cbc_subject) && (
          <span
            style={{
              display: "inline-flex",
              background: "rgba(204,255,0,0.08)",
              border: `1px solid rgba(204,255,0,0.24)`,
              borderRadius: 24,
              padding: "4px 11px",
              fontSize: 11,
              fontWeight: 800,
              color: ACCENT,
              marginLeft: 6,
            }}
          >
            CBC
            {publication.cbc_grade
              ? " · " + capitalizeWords(publication.cbc_grade)
              : ""}
            {publication.cbc_subject
              ? " · " + capitalizeWords(publication.cbc_subject)
              : ""}
          </span>
        )}

        <h1
          style={{
            fontSize: 27,
            fontWeight: 850,
            color: TEXT,
            margin: "10px 0 6px",
            lineHeight: 1.25,
          }}
        >
          {publication.title ||
            "Untitled textbook"}
        </h1>

        {publication.subtitle && (
          <p
            style={{
              fontSize: 15,
              color: MUTED,
              margin: "0 0 10px",
              lineHeight: 1.5,
            }}
          >
            {publication.subtitle}
          </p>
        )}

        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <span
            style={{
              fontSize: 13,
              color: TEXT,
              fontWeight: 700,
            }}
          >
            {payload.author_name ||
              "Anonymous"}
          </span>

          <span style={{ color: MUTED }}>·</span>

          <span
            style={{
              fontSize: 12,
              color: MUTED,
            }}
          >
            {formatDate(
              publication.published_at ||
                publication.created_at
            )}
          </span>

          <span style={{ color: MUTED }}>·</span>

          <span
            style={{
              fontSize: 12,
              color: MUTED,
            }}
          >
            {chapters.length}{" "}
            {chapters.length === 1
              ? meta.chapterLabel.toLowerCase()
              : meta.chapterPlural.toLowerCase()}
          </span>

          <button
            type="button"
            disabled={saveLoading}
            onClick={() => void togglePublicationSave()}
            aria-pressed={publicationSaved}
            style={{
              marginLeft: "auto",
              borderRadius: 10,
              border: publicationSaved
                ? `1px solid rgba(204,255,0,0.45)`
                : `1px solid ${BORDER}`,
              background: publicationSaved
                ? "rgba(204,255,0,0.1)"
                : "rgba(255,255,255,0.04)",
              color: publicationSaved ? ACCENT : TEXT,
              padding: "7px 12px",
              fontSize: 12,
              fontWeight: 800,
              cursor: saveLoading ? "wait" : "pointer",
              opacity: saveLoading ? 0.65 : 1,
            }}
          >
            {saveLoading
              ? "Saving…"
              : publicationSaved
                ? "✓ Saved"
                : "＋ Save"}
          </button>
        </div>

        {saveError && (
          <div
            role="alert"
            style={{
              color: "#FF8A8A",
              fontSize: 12,
              margin: "-4px 0 12px",
            }}
          >
            {saveError}
          </div>
        )}

        {publication.description && (
          <p
            style={{
              fontSize: 14,
              color:
                "rgba(255,255,255,0.58)",
              margin: "0 0 20px",
              lineHeight: 1.65,
            }}
          >
            {publication.description}
          </p>
        )}

        <div
          style={{
            borderTop: `1px solid ${BORDER}`,
            marginBottom: 20,
          }}
        />

        {chapters.length === 0 ? (
          <div
            style={{
              background: SURFACE,
              border: `1px solid ${BORDER}`,
              borderRadius: 16,
              padding: "32px 22px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 38,
                marginBottom: 12,
              }}
            >
              📚
            </div>

            <h2
              style={{
                color: TEXT,
                fontSize: 17,
                margin: "0 0 8px",
              }}
            >
              No published units yet
            </h2>

            <p
              style={{
                color: MUTED,
                fontSize: 13,
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              This textbook does not currently
              contain any units available to read.
            </p>
          </div>
        ) : (
          <>
            <section
              style={{
                marginBottom: 22,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: MUTED,
                  letterSpacing: "0.1em",
                  marginBottom: 10,
                }}
              >
                SEARCH AND NAVIGATION
              </div>

              <div style={{ position: "relative", marginBottom: 14 }}>
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSearchQuery(value);
                    setSelectedSearchResult(0);

                    if (activeChapter) {
                      updateReaderUrl(activeChapter.id, value);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setSearchQuery("");
                      setSelectedSearchResult(0);
                      if (activeChapter) {
                        updateReaderUrl(activeChapter.id, "");
                      }
                      searchInputRef.current?.blur();
                      return;
                    }

                    if (searchResults.length === 0) return;

                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setSelectedSearchResult((current) =>
                        Math.min(current + 1, searchResults.length - 1)
                      );
                      return;
                    }

                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      setSelectedSearchResult((current) =>
                        Math.max(current - 1, 0)
                      );
                      return;
                    }

                    if (event.key === "Enter") {
                      event.preventDefault();
                      openSearchResult(selectedSearchResult);
                    }
                  }}
                  aria-controls={
                    searchQuery.trim() ? "reader-search-results" : undefined
                  }
                  placeholder="Search readable units…"
                  aria-label="Search this textbook"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    borderRadius: 12,
                    border: `1px solid ${BORDER}`,
                    background: SURFACE,
                    color: TEXT,
                    padding: "12px 42px 12px 14px",
                    fontSize: 14,
                    outline: "none",
                  }}
                />

                {searchQuery && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedSearchResult(0);

                      if (activeChapter) {
                        updateReaderUrl(activeChapter.id, "");
                      }

                      searchInputRef.current?.focus();
                    }}
                    style={{
                      position: "absolute",
                      top: 7,
                      right: 7,
                      width: 30,
                      height: 30,
                      borderRadius: 9,
                      border: "none",
                      background: "rgba(255,255,255,0.06)",
                      color: MUTED,
                      cursor: "pointer",
                      fontSize: 16,
                    }}
                  >
                    ×
                  </button>
                )}
              </div>

              {searchQuery.trim() && (
                <div
                  id="reader-search-results"
                  role="region"
                  aria-label="Textbook search results"
                  style={{
                    background: SURFACE,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 14,
                    padding: 8,
                    marginBottom: 16,
                  }}
                >
                  <div
                    aria-live="polite"
                    style={{
                      color: MUTED,
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "5px 7px 9px",
                    }}
                  >
                    {searchResults.length === 0
                      ? "No matches in readable units"
                      : `${searchResults.length} ${
                          searchResults.length === 1 ? "match" : "matches"
                        }`}
                  </div>

                  {searchResults.length > 0 && (
                    <>
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          padding: "0 7px 8px",
                        }}
                      >
                        <button
                          type="button"
                          disabled={selectedSearchResult <= 0}
                          onClick={() =>
                            openSearchResult(
                              Math.max(0, selectedSearchResult - 1)
                            )
                          }
                          style={{
                            flex: 1,
                            borderRadius: 9,
                            border: `1px solid ${BORDER}`,
                            background: CARD,
                            color: TEXT,
                            padding: "7px 10px",
                            cursor:
                              selectedSearchResult <= 0
                                ? "not-allowed"
                                : "pointer",
                            opacity: selectedSearchResult <= 0 ? 0.45 : 1,
                            fontSize: 11,
                            fontWeight: 800,
                          }}
                        >
                          ← Previous
                        </button>

                        <button
                          type="button"
                          disabled={
                            selectedSearchResult >= searchResults.length - 1
                          }
                          onClick={() =>
                            openSearchResult(
                              Math.min(
                                searchResults.length - 1,
                                selectedSearchResult + 1
                              )
                            )
                          }
                          style={{
                            flex: 1,
                            borderRadius: 9,
                            border: `1px solid ${BORDER}`,
                            background: CARD,
                            color: TEXT,
                            padding: "7px 10px",
                            cursor:
                              selectedSearchResult >= searchResults.length - 1
                                ? "not-allowed"
                                : "pointer",
                            opacity:
                              selectedSearchResult >= searchResults.length - 1
                                ? 0.45
                                : 1,
                            fontSize: 11,
                            fontWeight: 800,
                          }}
                        >
                          Next →
                        </button>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 5,
                          maxHeight: 300,
                          overflowY: "auto",
                        }}
                      >
                        {searchResults.map((result, resultIndex) => {
                          const selected =
                            resultIndex === selectedSearchResult;

                          return (
                            <button
                              type="button"
                              key={`${result.chapterId}-${result.blockId}-${result.matchIndex}`}
                              ref={(element) => {
                                searchResultRefs.current[resultIndex] = element;
                              }}
                              aria-current={selected ? "true" : undefined}
                              onClick={() => openSearchResult(resultIndex)}
                              style={{
                                width: "100%",
                                textAlign: "left",
                                borderRadius: 10,
                                border: selected
                                  ? "1px solid rgba(204,255,0,0.32)"
                                  : "1px solid transparent",
                                background: selected
                                  ? "rgba(204,255,0,0.07)"
                                  : CARD,
                                padding: "10px 11px",
                                cursor: "pointer",
                              }}
                            >
                              <div
                                style={{
                                  color: selected ? ACCENT : MUTED,
                                  fontSize: 10,
                                  fontWeight: 800,
                                  marginBottom: 4,
                                }}
                              >
                                {meta.chapterLabel} {result.chapterNumber} ·{" "}
                                {result.chapterTitle}
                              </div>

                              <div
                                style={{
                                  color: TEXT,
                                  fontSize: 12,
                                  lineHeight: 1.5,
                                }}
                              >
                                <HighlightedText
                                  text={result.snippet}
                                  query={searchQuery}
                                />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: MUTED,
                  letterSpacing: "0.1em",
                  marginBottom: 10,
                }}
              >
                {meta.chapterPlural.toUpperCase()}
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 5,
                }}
              >
                {chapters.map(
                  (chapter, index) => {
                    const active =
                      index === safeActiveIndex;

                    return (
                      <button
                        type="button"
                        key={chapter.id}
                        aria-current={active ? "page" : undefined}
                        onClick={() => navigateToChapter(index)}
                        style={{
                          width: "100%",
                          padding: "11px 14px",
                          borderRadius: 11,
                          cursor: "pointer",
                          background: active
                            ? "rgba(204,255,0,0.08)"
                            : CARD,
                          border:
                            "1px solid " +
                            (active
                              ? "rgba(204,255,0,0.28)"
                              : BORDER),
                          display: "flex",
                          justifyContent:
                            "space-between",
                          alignItems: "center",
                          textAlign: "left",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: 11,
                              color: active
                                ? ACCENT
                                : MUTED,
                              fontWeight: 800,
                              marginBottom: 3,
                            }}
                          >
                            {meta.chapterLabel}{" "}
                            {chapter.number}
                          </div>

                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: TEXT,
                            }}
                          >
                            {chapter.title ||
                              `${meta.chapterLabel} ${chapter.number}`}
                          </div>

                          <div
                            style={{
                              fontSize: 10,
                              color: MUTED,
                              marginTop: 3,
                            }}
                          >
                            {Number(
                              chapter.word_count || 0
                            ).toLocaleString()}{" "}
                            words ·{" "}
                            {Number(
                              chapter.reading_time_min ||
                                0
                            )}{" "}
                            min
                          </div>

                          {chapter.progress_percent !== null &&
                            chapter.progress_percent > 0 && (
                              <div
                                style={{
                                  fontSize: 10,
                                  color: chapter.completed_at
                                    ? ACCENT
                                    : MUTED,
                                  marginTop: 3,
                                  fontWeight: 700,
                                }}
                              >
                                {chapter.completed_at
                                  ? "✓ Completed"
                                  : chapter.progress_percent + "% read"}
                              </div>
                            )}
                        </div>

                        {!chapter.can_read && (
                          <span
                            aria-label="Locked"
                            style={{ fontSize: 17 }}
                          >
                            🔒
                          </span>
                        )}
                      </button>
                    );
                  }
                )}
              </div>
            </section>

            <div
              style={{
                borderTop: `1px solid ${BORDER}`,
                marginBottom: 20,
              }}
            />

            {activeChapter && (
              <section id="reader-active-unit">
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: meta.accent,
                    letterSpacing: "0.12em",
                    marginBottom: 8,
                  }}
                >
                  {meta.chapterLabel.toUpperCase()}{" "}
                  {activeChapter.number}
                </div>

                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 18 }}>
                  <h2 style={{ flex: 1, fontSize: 23, fontWeight: 850, color: TEXT, margin: 0, lineHeight: 1.3 }}>
                    {activeChapter.title || `${meta.chapterLabel} ${activeChapter.number}`}
                  </h2>

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    {(teacherClasses.length > 0 || teacherClassesLoading) && (
                      <button
                        type="button"
                        disabled={
                          teacherClassesLoading ||
                          !activeChapter.can_read ||
                          activeChapter.status !== "published"
                        }
                        onClick={() => setAssignmentOpen(true)}
                        aria-label="Assign this unit to a class"
                        title="Assign this unit to a class"
                        style={{
                          borderRadius: 10,
                          border: "1px solid rgba(204,255,0,0.38)",
                          background: "rgba(204,255,0,0.09)",
                          color: ACCENT,
                          minHeight: 42,
                          padding: "0 12px",
                          fontSize: 12,
                          fontWeight: 850,
                          cursor:
                            teacherClassesLoading ||
                            !activeChapter.can_read ||
                            activeChapter.status !== "published"
                              ? "not-allowed"
                              : "pointer",
                          opacity:
                            teacherClassesLoading ||
                            !activeChapter.can_read ||
                            activeChapter.status !== "published"
                              ? 0.55
                              : 1,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {teacherClassesLoading ? "Loading…" : "Assign to Class"}
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={bookmarkLoading || !activeChapter.can_read}
                      onClick={() => void toggleChapterBookmark()}
                      aria-pressed={Boolean(activeChapter.is_bookmarked)}
                      aria-label={activeChapter.is_bookmarked ? "Remove chapter bookmark" : "Bookmark chapter"}
                      title={activeChapter.is_bookmarked ? "Remove bookmark" : "Bookmark this unit"}
                      style={{
                        flexShrink: 0, borderRadius: 10,
                        border: activeChapter.is_bookmarked ? "1px solid rgba(204,255,0,0.45)" : `1px solid ${BORDER}`,
                        background: activeChapter.is_bookmarked ? "rgba(204,255,0,0.1)" : "rgba(255,255,255,0.04)",
                        color: activeChapter.is_bookmarked ? ACCENT : TEXT,
                        minWidth: 42, height: 42, padding: "0 11px", fontSize: 19,
                        cursor: bookmarkLoading || !activeChapter.can_read ? "not-allowed" : "pointer",
                        opacity: bookmarkLoading || !activeChapter.can_read ? 0.55 : 1,
                      }}
                    >
                      {bookmarkLoading ? "…" : activeChapter.is_bookmarked ? "🔖" : "☆"}
                    </button>
                  </div>
                </div>

                {bookmarkError && <div role="alert" style={{ color: "#FF8A8A", fontSize: 12, margin: "-8px 0 14px" }}>{bookmarkError}</div>}

                {assignmentOpen && (
                  <ChapterAssignmentPanel
                    chapter={activeChapter}
                    classes={teacherClasses}
                    publicationTitle={publication.title || "Untitled textbook"}
                    onClose={() => setAssignmentOpen(false)}
                  />
                )}

                {activeChapter.curriculum && (
                  <div
                    style={{
                      background: SURFACE,
                      border: `1px solid ${BORDER}`,
                      borderRadius: 14,
                      padding: "14px 16px",
                      marginBottom: 20,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        color: MUTED,
                        letterSpacing: "0.1em",
                        marginBottom: 10,
                      }}
                    >
                      ABOUT THIS UNIT
                    </div>

                    {activeChapter.curriculum.has_curriculum_detail && (
                      <>
                        {curriculumPath(activeChapter.curriculum) && (
                          <div
                            style={{
                              fontSize: 11,
                              color: MUTED,
                              marginBottom: 10,
                              lineHeight: 1.5,
                            }}
                          >
                            {curriculumPath(activeChapter.curriculum)}
                          </div>
                        )}

                        {(activeChapter.curriculum.strand ||
                          activeChapter.curriculum.sub_strand) && (
                          <div
                            style={{
                              display: "flex",
                              gap: 20,
                              marginBottom: 10,
                            }}
                          >
                            {activeChapter.curriculum.strand && (
                              <div>
                                <div
                                  style={{
                                    fontSize: 10,
                                    color: MUTED,
                                    fontWeight: 700,
                                  }}
                                >
                                  Strand
                                </div>
                                <div
                                  style={{
                                    fontSize: 13,
                                    color: TEXT,
                                    fontWeight: 700,
                                  }}
                                >
                                  {activeChapter.curriculum.strand}
                                </div>
                              </div>
                            )}

                            {activeChapter.curriculum.sub_strand && (
                              <div>
                                <div
                                  style={{
                                    fontSize: 10,
                                    color: MUTED,
                                    fontWeight: 700,
                                  }}
                                >
                                  Sub-strand
                                </div>
                                <div
                                  style={{
                                    fontSize: 13,
                                    color: TEXT,
                                    fontWeight: 700,
                                  }}
                                >
                                  {activeChapter.curriculum.sub_strand}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {activeChapter.curriculum.learning_outcomes.length >
                          0 && (
                          <div style={{ marginBottom: 10 }}>
                            <div
                              style={{
                                fontSize: 10,
                                color: MUTED,
                                fontWeight: 700,
                                marginBottom: 4,
                              }}
                            >
                              What you will learn
                            </div>
                            <ul
                              style={{
                                margin: 0,
                                paddingLeft: 18,
                                color: TEXT,
                                fontSize: 13,
                                lineHeight: 1.6,
                              }}
                            >
                              {activeChapter.curriculum.learning_outcomes.map(
                                (outcome, i) => (
                                  <li key={i}>{outcome}</li>
                                )
                              )}
                            </ul>
                          </div>
                        )}

                        {(activeChapter.curriculum.key_inquiry_questions
                          .length > 0 ||
                          activeChapter.curriculum.suggested_experiences
                            .length > 0 ||
                          activeChapter.curriculum.core_competencies.length >
                            0 ||
                          activeChapter.curriculum.core_values.length >
                            0) && (
                          <button
                            type="button"
                            onClick={() =>
                              setCurriculumExpanded((v) => !v)
                            }
                            style={{
                              background: "none",
                              border: "none",
                              color: ACCENT,
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: "pointer",
                              padding: 0,
                              marginBottom: curriculumExpanded
                                ? 10
                                : 0,
                            }}
                          >
                            {curriculumExpanded
                              ? "Hide details ▲"
                              : "More about this unit ▼"}
                          </button>
                        )}

                        {curriculumExpanded && (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 10,
                            }}
                          >
                            {activeChapter.curriculum.key_inquiry_questions
                              .length > 0 && (
                              <div>
                                <div
                                  style={{
                                    fontSize: 10,
                                    color: MUTED,
                                    fontWeight: 700,
                                    marginBottom: 4,
                                  }}
                                >
                                  Key inquiry questions
                                </div>
                                <ul
                                  style={{
                                    margin: 0,
                                    paddingLeft: 18,
                                    color: TEXT,
                                    fontSize: 12.5,
                                    lineHeight: 1.6,
                                  }}
                                >
                                  {activeChapter.curriculum.key_inquiry_questions.map(
                                    (q, i) => (
                                      <li key={i}>{q}</li>
                                    )
                                  )}
                                </ul>
                              </div>
                            )}

                            {activeChapter.curriculum.suggested_experiences
                              .length > 0 && (
                              <div>
                                <div
                                  style={{
                                    fontSize: 10,
                                    color: MUTED,
                                    fontWeight: 700,
                                    marginBottom: 4,
                                  }}
                                >
                                  Suggested learning experiences
                                </div>
                                <ul
                                  style={{
                                    margin: 0,
                                    paddingLeft: 18,
                                    color: TEXT,
                                    fontSize: 12.5,
                                    lineHeight: 1.6,
                                  }}
                                >
                                  {activeChapter.curriculum.suggested_experiences.map(
                                    (s, i) => (
                                      <li key={i}>{s}</li>
                                    )
                                  )}
                                </ul>
                              </div>
                            )}

                            {activeChapter.curriculum.core_competencies
                              .length > 0 && (
                              <div>
                                <div
                                  style={{
                                    fontSize: 10,
                                    color: MUTED,
                                    fontWeight: 700,
                                    marginBottom: 4,
                                  }}
                                >
                                  Core competencies
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: 6,
                                  }}
                                >
                                  {activeChapter.curriculum.core_competencies.map(
                                    (c, i) => (
                                      <span
                                        key={i}
                                        style={{
                                          fontSize: 11,
                                          background:
                                            "rgba(255,255,255,0.06)",
                                          color: TEXT,
                                          padding: "3px 9px",
                                          borderRadius: 12,
                                        }}
                                      >
                                        {c}
                                      </span>
                                    )
                                  )}
                                </div>
                              </div>
                            )}

                            {activeChapter.curriculum.core_values.length >
                              0 && (
                              <div>
                                <div
                                  style={{
                                    fontSize: 10,
                                    color: MUTED,
                                    fontWeight: 700,
                                    marginBottom: 4,
                                  }}
                                >
                                  Core values
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: 6,
                                  }}
                                >
                                  {activeChapter.curriculum.core_values.map(
                                    (v, i) => (
                                      <span
                                        key={i}
                                        style={{
                                          fontSize: 11,
                                          background:
                                            "rgba(255,255,255,0.06)",
                                          color: TEXT,
                                          padding: "3px 9px",
                                          borderRadius: 12,
                                        }}
                                      >
                                        {v}
                                      </span>
                                    )
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        <div
                          style={{
                            borderTop: `1px solid ${BORDER}`,
                            margin: "12px 0 10px",
                          }}
                        />
                      </>
                    )}

                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color:
                          ALIGNMENT_LABELS[
                            activeChapter.curriculum.alignment_status
                          ].color,
                      }}
                    >
                      {
                        ALIGNMENT_LABELS[
                          activeChapter.curriculum.alignment_status
                        ].label
                      }
                    </div>
                  </div>
                )}

                {activeChapter.can_read ? (
                  activeBlocks.length > 0 ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 5,
                      }}
                    >
                      {activeBlocks.map((block) => (
                        <div
                          key={block.id}
                          id={`reader-block-${block.id}`}
                          data-reader-block-id={block.id}
                          style={{
                            scrollMarginTop: 20,
                            borderRadius: 10,
                            outline:
                              selectedSearchBlockId === block.id
                                ? "2px solid rgba(204,255,0,0.72)"
                                : "2px solid transparent",
                            background:
                              selectedSearchBlockId === block.id
                                ? "rgba(204,255,0,0.055)"
                                : "transparent",
                            transition:
                              "outline-color 160ms ease, background 160ms ease",
                          }}
                        >
                          <ContentBlockEditor
                            block={block}
                            format={publication.format}
                            readOnly
                            isFocused={false}
                            onFocus={() => undefined}
                            onUpdate={() => undefined}
                            onDelete={() => undefined}
                            onMoveUp={() => undefined}
                            onMoveDown={() => undefined}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      style={{
                        background: SURFACE,
                        border: `1px solid ${BORDER}`,
                        borderRadius: 14,
                        padding: "24px",
                        color: MUTED,
                        fontSize: 13,
                        lineHeight: 1.6,
                        textAlign: "center",
                      }}
                    >
                      This unit has no readable
                      content yet.
                    </div>
                  )
                ) : (
                  <div
                    style={{
                      background: SURFACE,
                      border: `1px solid ${BORDER}`,
                      borderRadius: 16,
                      padding: "36px 24px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 40,
                        marginBottom: 16,
                      }}
                    >
                      🔒
                    </div>

                    <h3
                      style={{
                        fontSize: 18,
                        fontWeight: 850,
                        color: TEXT,
                        margin: "0 0 8px",
                      }}
                    >
                      This unit is locked
                    </h3>

                    <p
                      style={{
                        fontSize: 14,
                        color: MUTED,
                        margin: "0 0 20px",
                        lineHeight: 1.6,
                      }}
                    >
                      Purchasing and school-license
                      access are not available in this
                      reader yet. The unit content has
                      not been downloaded to your
                      device.
                    </p>

                    <button
                      type="button"
                      disabled
                      style={{
                        background:
                          "rgba(255,255,255,0.08)",
                        color: MUTED,
                        border: `1px solid ${BORDER}`,
                        borderRadius: 12,
                        padding: "13px 28px",
                        fontSize: 14,
                        fontWeight: 800,
                        cursor: "not-allowed",
                      }}
                    >
                      Purchasing coming soon
                    </button>
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    marginTop: 32,
                  }}
                >
                  {previousReadableIndex >= 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        navigateToChapter(previousReadableIndex)
                      }
                      style={{
                        flex: 1,
                        padding: 12,
                        background: CARD,
                        border: `1px solid ${BORDER}`,
                        borderRadius: 12,
                        color: TEXT,
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      ← Previous{" "}
                      {meta.chapterLabel}
                    </button>
                  )}

                  {nextReadableIndex >= 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        navigateToChapter(nextReadableIndex)
                      }
                      style={{
                        flex: 1,
                        padding: 12,
                        background: CARD,
                        border: `1px solid ${BORDER}`,
                        borderRadius: 12,
                        color: TEXT,
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Next {meta.chapterLabel} →
                    </button>
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
