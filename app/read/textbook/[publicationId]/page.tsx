"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import type {
  ContentBlock,
  VibePublication,
} from "@/lib/publishTypes";
import { FORMAT_META } from "@/lib/publishTypes";
import { ContentBlockEditor } from "@/components/global/publish/ContentBlockEditor";

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

      const { data, error } = await supabase.rpc(
        "get_vibetextbook_reader",
        {
          publication_id_input: publicationId,
        }
      );

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

      const resumeChapterId =
        nextPayload.resume?.chapter_id ?? null;
      const resumeIndex = resumeChapterId
        ? chapters.findIndex(
            (c) => c.id === resumeChapterId
          )
        : -1;
      setActiveIndex(
        resumeIndex >= 0 ? resumeIndex : 0
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
  }, [publicationId]);

  const publication = payload?.publication ?? null;
  const chapters = payload?.chapters ?? [];

  const safeActiveIndex =
    chapters.length === 0
      ? 0
      : Math.min(
          Math.max(activeIndex, 0),
          chapters.length - 1
        );

  const activeChapter =
    chapters[safeActiveIndex] ?? null;

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
        </div>

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
                        onClick={() =>
                          setActiveIndex(index)
                        }
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
              <section>
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

                <h2
                  style={{
                    fontSize: 23,
                    fontWeight: 850,
                    color: TEXT,
                    margin: "0 0 18px",
                    lineHeight: 1.3,
                  }}
                >
                  {activeChapter.title ||
                    `${meta.chapterLabel} ${activeChapter.number}`}
                </h2>

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
                      {activeBlocks.map(
                        (block) => (
                          <ContentBlockEditor
                            key={block.id}
                            block={block}
                            format={
                              publication.format
                            }
                            readOnly
                            isFocused={false}
                            onFocus={() => undefined}
                            onUpdate={() => undefined}
                            onDelete={() => undefined}
                            onMoveUp={() => undefined}
                            onMoveDown={() => undefined}
                          />
                        )
                      )}
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
                  {safeActiveIndex > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setActiveIndex(
                          (previous) =>
                            previous - 1
                        )
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

                  {safeActiveIndex <
                    chapters.length - 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setActiveIndex(
                          (previous) =>
                            previous + 1
                        )
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
