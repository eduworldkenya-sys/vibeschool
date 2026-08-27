"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import type { LearningCheckpointSpec } from "@/lib/learning/checkpoint";

type Props = {
  publicationId: string;
  chapterId: string;
  blockId: string;
  spec: LearningCheckpointSpec;
};

export function LearningCheckpoint({ publicationId, chapterId, blockId, spec }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [misconception, setMisconception] = useState<string | null>(null);
  const [remediation, setRemediation] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (spec.type !== "multiple_choice" || !spec.choices?.length) {
    return (
      <section style={card} aria-label="Learning checkpoint">
        <div style={eyebrow}>Learning checkpoint</div>
        <strong>{spec.prompt}</strong>
        <p style={muted}>This checkpoint type is part of the canonical contract. Its dedicated inline renderer is not enabled yet.</p>
      </section>
    );
  }

  const submit = async () => {
    if (!selected || saving) return;
    const choice = spec.choices!.find(item => item.id === selected);
    if (!choice) return;

    setFeedback(choice.feedback.explanation);
    setMisconception(choice.feedback.misconceptionLabel ?? null);
    setRemediation(choice.feedback.remedialConceptId ?? spec.remediation?.targetBlockId ?? null);
    setSaveError(null);
    setSaving(true);

    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push("/login");
        return;
      }

      const { error } = await supabase.rpc("record_learning_checkpoint_attempt", {
        publication_id_input: publicationId,
        chapter_id_input: chapterId,
        block_id_input: blockId,
        checkpoint_id_input: spec.id,
        checkpoint_type_input: spec.type,
        response_input: { selectedChoiceId: selected },
        is_correct_input: choice.feedback.isCorrect,
        misconception_label_input: choice.feedback.misconceptionLabel ?? null,
        remediation_target_input: choice.feedback.remedialConceptId ?? spec.remediation?.targetBlockId ?? null,
        outcome_ids_input: spec.outcomeIds ?? [],
      });

      if (error) setSaveError("Your feedback is shown, but progress could not be recorded. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section style={card} aria-label="Learning checkpoint">
      <div style={eyebrow}>Learning checkpoint</div>
      <h3 style={{ margin: "4px 0 6px", fontSize: 19 }}>{spec.prompt}</h3>
      {spec.instructions ? <p style={muted}>{spec.instructions}</p> : null}
      <div style={{ display: "grid", gap: 9, marginTop: 14 }}>
        {spec.choices.map(choice => (
          <button
            key={choice.id}
            type="button"
            onClick={() => {
              setSelected(choice.id);
              setFeedback(null);
              setMisconception(null);
              setRemediation(null);
              setSaveError(null);
            }}
            aria-pressed={selected === choice.id}
            style={{ ...option, ...(selected === choice.id ? selectedOption : {}) }}
          >
            {choice.label}
          </button>
        ))}
      </div>
      <button type="button" onClick={submit} disabled={!selected || saving} style={{ ...submitButton, opacity: !selected || saving ? .55 : 1 }}>
        {saving ? "Saving…" : "Check my answer"}
      </button>
      {feedback ? (
        <div role="status" style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,.11)" }}>
          <strong style={{ display: "block", marginBottom: 4 }}>Feedback</strong>
          <div>{feedback}</div>
          {misconception ? <div style={{ ...muted, marginTop: 8 }}><strong>Misconception:</strong> {misconception}</div> : null}
          {remediation ? <a href={`#reader-block-${encodeURIComponent(remediation)}`} style={link}>Review the linked concept →</a> : null}
        </div>
      ) : null}
      {saveError ? <p role="alert" style={{ ...muted, marginTop: 10 }}>{saveError}</p> : null}
    </section>
  );
}

const card: CSSProperties = { margin: "20px 0 26px", padding: 16, borderRadius: 14, border: "1px solid rgba(207,255,0,.30)", background: "rgba(207,255,0,.045)" };
const eyebrow: CSSProperties = { color: "#cfff00", fontSize: 11, fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase" };
const muted: CSSProperties = { margin: "6px 0 0", opacity: .72, fontSize: 13 };
const option: CSSProperties = { width: "100%", textAlign: "left", borderRadius: 10, border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.025)", color: "inherit", padding: "11px 12px", cursor: "pointer", fontSize: 14 };
const selectedOption: CSSProperties = { borderColor: "rgba(207,255,0,.6)", background: "rgba(207,255,0,.09)" };
const submitButton: CSSProperties = { marginTop: 12, minHeight: 42, border: 0, borderRadius: 10, background: "#cfff00", color: "#0b0d12", padding: "9px 14px", fontWeight: 900, cursor: "pointer" };
const link: CSSProperties = { display: "inline-block", marginTop: 9, color: "#cfff00", fontWeight: 800, textDecoration: "none", fontSize: 13 };
