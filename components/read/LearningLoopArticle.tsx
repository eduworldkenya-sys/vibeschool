"use client";

import { useEffect, useMemo, useState } from "react";
import type { ContentBlock, PublicationFormat } from "@/lib/publishTypes";
import { ContentBlockEditor } from "@/components/global/publish/ContentBlockEditor";

export type LearningLayer = "orient" | "comprehend" | "apply" | "connect" | "extend";

type Props = {
  publicationId: string;
  chapterId: string;
  blocks: ContentBlock[];
  format: PublicationFormat;
  fontSize: number;
};

const LAYERS: Array<{ id: LearningLayer; label: string; description: string }> = [
  { id: "orient", label: "Orient", description: "Know where you are going and activate what you already know." },
  { id: "comprehend", label: "Comprehend", description: "Build the core historical narrative, concepts and evidence." },
  { id: "apply", label: "Apply & check", description: "Test understanding and surface misconceptions early." },
  { id: "connect", label: "Connect", description: "Relate the history to Kenya, Africa and connected ideas where relevant." },
  { id: "extend", label: "Extend", description: "Move into KCSE practice, revision and teacher-ready application." },
];

const isLayer = (value: unknown): value is LearningLayer =>
  value === "orient" || value === "comprehend" || value === "apply" || value === "connect" || value === "extend";

function explicitLayer(block: ContentBlock): LearningLayer | null {
  const raw = block.meta?.learning_layer;
  if (typeof raw !== "string") return null;
  const normalized = raw.toLowerCase().replace(/\s+/g, "_");
  if (normalized === "apply_check" || normalized === "apply_and_check") return "apply";
  return isLayer(normalized) ? normalized : null;
}

function inferLayer(block: ContentBlock): LearningLayer {
  const haystack = `${block.type} ${block.content}`.toLowerCase();
  if (block.type === "question" || block.type === "interactive" || /check your|checkpoint|misconception|quick check/.test(haystack)) return "apply";
  if (/kenya|kenyan|east africa|african context|local impact|connect/.test(haystack)) return "connect";
  if (block.type === "summary" || block.type === "keyPoints" || /kcse|revision|exam practice|marking scheme|extend/.test(haystack)) return "extend";
  if (/learning outcome|what you.{0,4}ll learn|prior knowledge|inquiry question|anchor question|timeline overview/.test(haystack)) return "orient";
  return "comprehend";
}

function layerFor(block: ContentBlock): LearningLayer {
  return explicitLayer(block) ?? inferLayer(block);
}

export function LearningLoopArticle({ publicationId, chapterId, blocks, format, fontSize }: Props) {
  const storageKey = `vibe.learning-loop.${publicationId}.${chapterId}`;
  const groups = useMemo(() => {
    const result: Record<LearningLayer, ContentBlock[]> = { orient: [], comprehend: [], apply: [], connect: [], extend: [] };
    for (const block of blocks) result[layerFor(block)].push(block);
    return result;
  }, [blocks]);
  const available = LAYERS.filter(layer => groups[layer.id].length > 0);
  const [completed, setCompleted] = useState<LearningLayer[]>([]);

  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || "[]");
      if (Array.isArray(parsed)) setCompleted(parsed.filter(isLayer));
    } catch {}
  }, [storageKey]);

  const toggleComplete = (layer: LearningLayer) => {
    setCompleted(current => {
      const next = current.includes(layer) ? current.filter(item => item !== layer) : [...current, layer];
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const done = available.filter(layer => completed.includes(layer.id)).length;
  const percent = available.length ? Math.round((done / available.length) * 100) : 0;

  return (
    <article aria-label="Chapter learning loop" style={{ fontSize, lineHeight: 1.72 }}>
      {available.length > 1 ? (
        <section aria-label="Learning progress" style={{ margin: "0 0 30px", padding: "15px 16px", border: "1px solid rgba(255,255,255,.11)", borderRadius: 14, background: "rgba(255,255,255,.025)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "baseline" }}>
            <strong style={{ fontSize: 14 }}>Learning loop</strong>
            <span style={{ fontSize: 12, opacity: .7 }}>{done}/{available.length} stages · {percent}%</span>
          </div>
          <div aria-hidden="true" style={{ height: 5, borderRadius: 999, background: "rgba(255,255,255,.1)", marginTop: 10, overflow: "hidden" }}>
            <div style={{ width: `${percent}%`, height: "100%", background: "#cfff00", transition: "width .2s ease" }} />
          </div>
        </section>
      ) : null}

      {available.map((layer, layerIndex) => {
        const isDone = completed.includes(layer.id);
        return (
          <section key={layer.id} id={`learning-layer-${layer.id}`} data-learning-layer={layer.id} aria-labelledby={`learning-layer-title-${layer.id}`} style={{ margin: layerIndex ? "44px 0 0" : "0" }}>
            <header style={{ marginBottom: 18, paddingBottom: 13, borderBottom: "1px solid rgba(255,255,255,.11)" }}>
              <div style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ color: "#cfff00", fontWeight: 850, fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase" }}>Stage {layerIndex + 1}</div>
                  <h2 id={`learning-layer-title-${layer.id}`} style={{ margin: "3px 0 3px", fontSize: 22, lineHeight: 1.2 }}>{layer.label}</h2>
                  <p style={{ margin: 0, fontSize: 13, opacity: .72 }}>{layer.description}</p>
                </div>
                <button type="button" aria-pressed={isDone} onClick={() => toggleComplete(layer.id)} style={{ minHeight: 38, borderRadius: 10, border: "1px solid rgba(255,255,255,.14)", background: isDone ? "rgba(207,255,0,.13)" : "transparent", color: isDone ? "#cfff00" : "inherit", padding: "7px 10px", fontWeight: 750, cursor: "pointer", whiteSpace: "nowrap" }}>
                  {isDone ? "Completed ✓" : "Mark done"}
                </button>
              </div>
            </header>
            {groups[layer.id].map(block => (
              <div key={block.id} id={`reader-block-${block.id}`} data-reader-block-id={block.id} style={{ marginBottom: 8 }}>
                <ContentBlockEditor block={block} format={format} readOnly isFocused={false} onFocus={() => undefined} onUpdate={() => undefined} onDelete={() => undefined} onMoveUp={() => undefined} onMoveDown={() => undefined} />
              </div>
            ))}
          </section>
        );
      })}
    </article>
  );
}
