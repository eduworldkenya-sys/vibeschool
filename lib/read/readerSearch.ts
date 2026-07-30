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
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeSearchText(value: string): string {
  return normalizeWhitespace(value).toLocaleLowerCase("en");
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
 * Builds an in-memory search index exclusively from entitled chapters.
 * Locked chapter content must never enter the index.
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
  const radius = 72;
  const start = Math.max(0, matchIndex - radius);
  const end = Math.min(
    text.length,
    matchIndex + matchLength + radius
  );

  return [
    start > 0 ? "…" : "",
    text.slice(start, end).trim(),
    end < text.length ? "…" : "",
  ].join("");
}

function scoreDocument(
  document: ReaderSearchDocument,
  normalizedQuery: string,
  matchIndex: number
): number {
  const title = normalizeSearchText(document.chapterTitle);
  let score = 1000 - Math.min(matchIndex, 900);

  if (title === normalizedQuery) score += 900;
  else if (title.startsWith(normalizedQuery)) score += 600;
  else if (title.includes(normalizedQuery)) score += 350;

  if (document.normalizedText.startsWith(normalizedQuery)) {
    score += 250;
  }

  if (
    document.blockType === "heading" ||
    document.blockType === "title"
  ) {
    score += 180;
  }

  return score;
}

export function searchReaderIndex(
  index: ReaderSearchDocument[],
  query: string,
  limit = 50
): ReaderSearchResult[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];

  const results: ReaderSearchResult[] = [];

  for (const document of index) {
    let fromIndex = 0;

    while (fromIndex < document.normalizedText.length) {
      const matchIndex = document.normalizedText.indexOf(
        normalizedQuery,
        fromIndex
      );

      if (matchIndex < 0) break;

      results.push({
        ...document,
        score: scoreDocument(
          document,
          normalizedQuery,
          matchIndex
        ),
        matchIndex,
        matchLength: normalizedQuery.length,
        snippet: createSnippet(
          document.text,
          matchIndex,
          normalizedQuery.length
        ),
      });

      fromIndex =
        matchIndex + Math.max(normalizedQuery.length, 1);
    }
  }

  return results
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;

      if (a.chapterNumber !== b.chapterNumber) {
        return a.chapterNumber - b.chapterNumber;
      }

      if (a.blockId !== b.blockId) {
        return a.blockId.localeCompare(b.blockId);
      }

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
