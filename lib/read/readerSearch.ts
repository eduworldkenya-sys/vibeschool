import type { ContentBlock } from "@/lib/publishTypes";

export interface ReaderSearchChapter {
  id: string;
  number: number;
  title: string | null;
  can_read: boolean;
  blocks: ContentBlock[] | null;
}

export interface ReaderSearchDocument {
  chapterId: string;
  chapterNumber: number;
  chapterTitle: string;
  blockId: string;
  blockType: string;
  text: string;
  normalizedText: string;
}

export interface ReaderSearchResult extends ReaderSearchDocument {
  score: number;
  matchIndex: number;
  matchLength: number;
  snippet: string;
  matchKind: "phrase" | "terms" | "chapter";
  matchedTerms: string[];
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeSearchText(value: string): string {
  return normalizeWhitespace(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en");
}

function queryTerms(value: string): string[] {
  const normalized = normalizeSearchText(value);
  if (!normalized) return [];

  const seen = new Set<string>();
  const terms: string[] = [];
  // Reader content is currently English/Kiswahili. Both use the Latin alphabet,
  // and normalizeSearchText strips combining marks, so an ES5-compatible ASCII
  // token boundary preserves current search semantics without requiring Unicode
  // property escapes or the `u` regexp flag.
  for (const token of normalized.split(/[^a-z0-9]+/)) {
    if (token.length < 2 || seen.has(token)) continue;
    seen.add(token);
    terms.push(token);
  }
  return terms.slice(0, 12);
}

function safeBlocks(
  value: ContentBlock[] | null | unknown
): ContentBlock[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (block): block is ContentBlock =>
      Boolean(block) &&
      typeof block === "object" &&
      typeof block.id === "string" &&
      typeof block.type === "string" &&
      typeof block.content === "string"
  );
}

/**
 * Builds an in-memory index exclusively from chapters the canonical reader has
 * already marked readable. Locked chapter content must never enter the index.
 */
export function buildReaderSearchIndex(
  chapters: ReaderSearchChapter[]
): ReaderSearchDocument[] {
  const documents: ReaderSearchDocument[] = [];

  for (const chapter of chapters) {
    if (!chapter.can_read) continue;

    const chapterTitle =
      normalizeWhitespace(chapter.title ?? "") ||
      `Unit ${chapter.number}`;

    for (const block of safeBlocks(chapter.blocks)) {
      const text = normalizeWhitespace(block.content);
      if (!text) continue;

      documents.push({
        chapterId: chapter.id,
        chapterNumber: chapter.number,
        chapterTitle,
        blockId: block.id,
        blockType: block.type,
        text,
        normalizedText: normalizeSearchText(text),
      });
    }
  }

  return documents;
}

function createSnippet(
  text: string,
  matchIndex: number,
  matchLength: number
): string {
  const radius = 88;
  const safeIndex = Math.max(0, Math.min(matchIndex, text.length));
  const safeLength = Math.max(1, matchLength);
  const start = Math.max(0, safeIndex - radius);
  const end = Math.min(
    text.length,
    safeIndex + safeLength + radius
  );

  return [
    start > 0 ? "…" : "",
    text.slice(start, end).trim(),
    end < text.length ? "…" : "",
  ].join("");
}

function isHeading(blockType: string): boolean {
  return blockType === "heading" || blockType === "title";
}

function firstTermIndex(text: string, terms: string[]): number {
  let first = -1;
  for (const term of terms) {
    const index = text.indexOf(term);
    if (index >= 0 && (first < 0 || index < first)) first = index;
  }
  return first;
}

function scoreResult(
  document: ReaderSearchDocument,
  normalizedQuery: string,
  terms: string[],
  phraseIndex: number,
  titlePhraseIndex: number,
  matchedTerms: string[],
): { score: number; kind: ReaderSearchResult["matchKind"]; anchorIndex: number } | null {
  const title = normalizeSearchText(document.chapterTitle);
  const allTermsInText = terms.length > 0 && terms.every((term) => document.normalizedText.includes(term));
  const allTermsInTitle = terms.length > 0 && terms.every((term) => title.includes(term));

  if (phraseIndex < 0 && titlePhraseIndex < 0 && !allTermsInText && !allTermsInTitle) {
    return null;
  }

  let score = 0;
  let kind: ReaderSearchResult["matchKind"] = "terms";
  let anchorIndex = firstTermIndex(document.normalizedText, matchedTerms);

  if (phraseIndex >= 0) {
    kind = "phrase";
    anchorIndex = phraseIndex;
    score += 1800 - Math.min(phraseIndex, 700);
    if (phraseIndex === 0) score += 240;
  } else if (titlePhraseIndex >= 0) {
    kind = "chapter";
    score += 1500 - Math.min(titlePhraseIndex, 500);
  } else if (allTermsInText) {
    score += 900;
  } else if (allTermsInTitle) {
    kind = "chapter";
    score += 850;
  }

  if (title === normalizedQuery) score += 1000;
  else if (title.startsWith(normalizedQuery)) score += 700;
  else if (title.includes(normalizedQuery)) score += 450;

  if (matchedTerms.length > 0) {
    score += matchedTerms.length * 120;
    const positions = matchedTerms
      .map((term) => document.normalizedText.indexOf(term))
      .filter((index) => index >= 0)
      .sort((a, b) => a - b);
    if (positions.length > 1) {
      const spread = positions[positions.length - 1] - positions[0];
      score += Math.max(0, 220 - Math.min(spread, 220));
    }
  }

  if (isHeading(document.blockType)) score += 260;

  return { score, kind, anchorIndex: Math.max(0, anchorIndex) };
}

/**
 * Strong lexical/concept-aware search without a remote embedding dependency.
 * Exact phrases rank first; multi-word queries can also match when every
 * meaningful term occurs in a block or chapter title. Only one best result is
 * emitted per canonical block to avoid repeated-hit noise.
 */
export function searchReaderIndex(
  index: ReaderSearchDocument[],
  query: string,
  limit = 50
): ReaderSearchResult[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];

  const terms = queryTerms(query);
  const results: ReaderSearchResult[] = [];

  for (const document of index) {
    const title = normalizeSearchText(document.chapterTitle);
    const phraseIndex = document.normalizedText.indexOf(normalizedQuery);
    const titlePhraseIndex = title.indexOf(normalizedQuery);
    const matchedTerms = terms.filter((term) => document.normalizedText.includes(term));
    const scored = scoreResult(
      document,
      normalizedQuery,
      terms,
      phraseIndex,
      titlePhraseIndex,
      matchedTerms,
    );

    if (!scored) continue;

    const effectiveLength = phraseIndex >= 0
      ? normalizedQuery.length
      : Math.max(1, matchedTerms[0]?.length ?? normalizedQuery.length);

    results.push({
      ...document,
      score: scored.score,
      matchIndex: scored.anchorIndex,
      matchLength: effectiveLength,
      snippet: createSnippet(
        document.text,
        scored.anchorIndex,
        effectiveLength,
      ),
      matchKind: scored.kind,
      matchedTerms,
    });
  }

  return results
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.chapterNumber !== b.chapterNumber) return a.chapterNumber - b.chapterNumber;
      if (a.blockId !== b.blockId) return a.blockId.localeCompare(b.blockId);
      return a.matchIndex - b.matchIndex;
    })
    .slice(0, Math.max(1, limit));
}

export function readerChapterUrl(
  publicationId: string,
  chapterId: string,
  query?: string,
  blockId?: string
): string {
  const params = new URLSearchParams();

  params.set("chapter", chapterId);

  const normalizedQuery = normalizeWhitespace(query ?? "");

  if (normalizedQuery) {
    params.set("q", normalizedQuery);
  }

  if (blockId) {
    params.set("block", blockId);
  }

  return (
    `/read/textbook/${encodeURIComponent(publicationId)}` +
    `?${params.toString()}`
  );
}