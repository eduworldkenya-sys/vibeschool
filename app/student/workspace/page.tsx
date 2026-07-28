"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
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

interface SavedPublication {
  publication_id: string;
  cover_url: string | null;
  title: string | null;
  cbc_grade: string | null;
  cbc_subject: string | null;
  saved_at: string;
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
  last_read_at: string;
  completed: boolean;
}

type Tab =
  | "continue"
  | "saved"
  | "bookmarks"
  | "highlights"
  | "notes"
  | "vocabulary"
  | "definitions"
  | "formulae";

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

export default function StudyWorkspacePage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>("continue");
  const [saved, setSaved] = useState<SavedPublication[]>([]);
  const [continueItems, setContinueItems] = useState<ContinueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      setLoading(true);
      setPageError(null);

      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (cancelled) return;

      if (authError || !authData.user) {
        router.replace("/login");
        return;
      }

      const [libraryResult, continueResult] = await Promise.all([
        supabase.rpc("get_my_library"),
        supabase.rpc("get_continue_reading", {
          limit_input: 20,
        }),
      ]);

      if (cancelled) return;

      if (libraryResult.error || continueResult.error) {
        console.error(
          "Failed to load workspace:",
          libraryResult.error,
          continueResult.error
        );
        setPageError("Your study workspace could not be loaded.");
        setLoading(false);
        return;
      }

      setSaved(
        Array.isArray(libraryResult.data)
          ? (libraryResult.data as SavedPublication[])
          : []
      );

      const continuePayload = continueResult.data as {
        ok?: boolean;
        items?: ContinueItem[];
      } | null;

      setContinueItems(
        Array.isArray(continuePayload?.items)
          ? continuePayload.items
          : []
      );

      setLoading(false);
    }

    void loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [router]);

  function openPublication(publicationId: string) {
    router.push(`/read/textbook/${publicationId}`);
  }

  const futureTab =
    activeTab !== "continue" && activeTab !== "saved";

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

        <h1
          style={{
            color: C.text,
            fontSize: 25,
            margin: "18px 0 4px",
          }}
        >
          My Study Workspace
        </h1>

        <p
          style={{
            color: C.muted,
            fontSize: 13,
            margin: "0 0 18px",
          }}
        >
          Continue your textbooks and keep study material together.
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
                background:
                  activeTab === tab.id
                    ? C.accent
                    : C.surface,
                color:
                  activeTab === tab.id
                    ? "#ffffff"
                    : C.muted,
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading && (
          <div
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 14,
              padding: 24,
              color: C.muted,
              textAlign: "center",
            }}
          >
            Loading workspace…
          </div>
        )}

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
            }}
          >
            {pageError}
          </div>
        )}

        {!loading &&
          !pageError &&
          activeTab === "continue" && (
            <section
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {continueItems.length === 0 ? (
                <EmptyState
                  title="Nothing in progress"
                  text="Open a textbook and begin reading to see it here."
                />
              ) : (
                continueItems.map((item) => (
                  <PublicationCard
                    key={item.publication_id}
                    title={item.title}
                    coverUrl={item.cover_url}
                    grade={item.cbc_grade}
                    subject={item.cbc_subject}
                    detail={
                      item.current_chapter_title ||
                      `Unit ${item.current_chapter_number}`
                    }
                    progress={item.progress_percent}
                    onOpen={() =>
                      openPublication(item.publication_id)
                    }
                  />
                ))
              )}
            </section>
          )}

        {!loading &&
          !pageError &&
          activeTab === "saved" && (
            <section
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {saved.length === 0 ? (
                <EmptyState
                  title="No saved textbooks"
                  text="Use the Save button inside a textbook to add it."
                />
              ) : (
                saved.map((item) => (
                  <PublicationCard
                    key={item.publication_id}
                    title={item.title}
                    coverUrl={item.cover_url}
                    grade={item.cbc_grade}
                    subject={item.cbc_subject}
                    detail="Saved textbook"
                    onOpen={() =>
                      openPublication(item.publication_id)
                    }
                  />
                ))
              )}
            </section>
          )}

        {!loading && !pageError && futureTab && (
          <EmptyState
            title={`${tabs.find((tab) => tab.id === activeTab)?.label} not captured yet`}
            text="The canonical workspace authority is ready. Writer controls land in the next scoped fix units."
          />
        )}
      </div>
    </main>
  );
}

function EmptyState({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
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
      <div style={{ fontSize: 34, marginBottom: 10 }}>
        📚
      </div>

      <h2
        style={{
          color: C.text,
          fontSize: 16,
          margin: "0 0 7px",
        }}
      >
        {title}
      </h2>

      <p
        style={{
          color: C.muted,
          fontSize: 13,
          margin: 0,
          lineHeight: 1.55,
        }}
      >
        {text}
      </p>
    </div>
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
          <img
            src={coverUrl}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          "📖"
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            color: C.text,
            fontSize: 14,
            fontWeight: 800,
            lineHeight: 1.35,
          }}
        >
          {title || "Untitled textbook"}
        </div>

        <div
          style={{
            color: C.muted,
            fontSize: 12,
            marginTop: 4,
          }}
        >
          {[grade, subject].filter(Boolean).join(" · ")}
        </div>

        <div
          style={{
            color: C.muted,
            fontSize: 12,
            marginTop: 7,
          }}
        >
          {detail}
        </div>

        {typeof progress === "number" && (
          <div style={{ marginTop: 9 }}>
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
                  width: `${Math.max(
                    0,
                    Math.min(100, progress)
                  )}%`,
                  height: "100%",
                  background: C.accent,
                }}
              />
            </div>

            <div
              style={{
                color: C.muted,
                fontSize: 10,
                marginTop: 4,
              }}
            >
              {Math.round(progress)}% read
            </div>
          </div>
        )}
      </div>
    </button>
  );
}
