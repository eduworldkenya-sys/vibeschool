import type { Database, Json } from './database.types'
import type {
  BlockMeta,
  BlockType,
  CBCGrade,
  CBCSubject,
  ChapterStatus,
  ContentBlock,
  PricingModel,
  PublicationFormat,
  PublicationGenre,
  PublicationStatus,
  VibeChapter,
  VibePublication,
} from './publishTypes'

type PublicationRow = Database['public']['Tables']['vibe_publications']['Row']
type PublicationInsert = Database['public']['Tables']['vibe_publications']['Insert']
type ChapterRow = Database['public']['Tables']['vibe_chapters']['Row']
type ChapterInsert = Database['public']['Tables']['vibe_chapters']['Insert']

const PUBLICATION_FORMATS: readonly PublicationFormat[] = ['vibepress','vibechronicles','vibetextbook','vibescripture','vibevoice','ebook']
const PUBLICATION_STATUSES: readonly PublicationStatus[] = ['draft','published','unpublished','archived']
const CHAPTER_STATUSES: readonly ChapterStatus[] = ['draft','published','locked']
const PUBLICATION_GENRES: readonly PublicationGenre[] = ['fiction','non_fiction','romance','thriller','biography','self_help','religion','academic','children','poetry','magazine','other']
const CBC_SUBJECTS: readonly CBCSubject[] = ['mathematics','english','kiswahili','science','biology','chemistry','physics','agriculture','business_studies','history_citizenship','social_studies','creative_arts','physical_education','religious_education','other']
const CBC_GRADES: readonly CBCGrade[] = ['pp1','pp2','grade1','grade2','grade3','grade4','grade5','grade6','grade7','grade8','grade9','grade10','grade11','grade12','form1','form2','form3','form4']
const BLOCK_TYPES: readonly BlockType[] = ['paragraph','heading1','heading2','heading3','quote','bulletList','numberedList','image','diagram','table','equation','video','audio','model3d','simulation','divider','callout','definition','example','workedExample','summary','keyPoints','code','activity','experiment','project','question','interactive']

function isRecord(value: unknown): value is Record<string, Json | undefined> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}
function isEnumValue<T extends string>(value: string | null, options: readonly T[]): value is T {
  return value !== null && options.includes(value as T)
}
function requireEnumValue<T extends string>(value: string | null, options: readonly T[], fieldName: string): T {
  if (!isEnumValue(value, options)) throw new Error(`Invalid ${fieldName}: ${value ?? 'null'}`)
  return value
}
function optionalEnumValue<T extends string>(value: string | null, options: readonly T[], fieldName: string): T | null {
  if (value === null || value === '') return null
  return requireEnumValue(value, options, fieldName)
}
function parsePricing(value: Json | null): PricingModel {
  if (!isRecord(value)) return { type: 'free' }
  const type = value.type
  if (type === 'free') return { type: 'free' }
  if (type === 'paid' && typeof value.priceKsh === 'number') return { type: 'paid', priceKsh: value.priceKsh }
  if (type === 'freemium' && typeof value.freeChapters === 'number' && typeof value.priceKsh === 'number') return { type: 'freemium', freeChapters: value.freeChapters, priceKsh: value.priceKsh }
  if (type === 'donation' && typeof value.suggestedKsh === 'number') return { type: 'donation', suggestedKsh: value.suggestedKsh }
  if (type === 'school_license' && typeof value.perStudentKsh === 'number' && typeof value.schoolKsh === 'number') return { type: 'school_license', perStudentKsh: value.perStudentKsh, schoolKsh: value.schoolKsh }
  throw new Error('Invalid publication pricing payload.')
}
function pricingToJson(pricing: PricingModel): Json {
  switch (pricing.type) {
    case 'free': return { type: 'free' }
    case 'paid': return { type: 'paid', priceKsh: pricing.priceKsh }
    case 'freemium': return { type: 'freemium', freeChapters: pricing.freeChapters, priceKsh: pricing.priceKsh }
    case 'donation': return { type: 'donation', suggestedKsh: pricing.suggestedKsh }
    case 'school_license': return { type: 'school_license', perStudentKsh: pricing.perStudentKsh, schoolKsh: pricing.schoolKsh }
  }
}
function parseBlockMeta(value: Json | undefined): BlockMeta | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value)) throw new Error('Invalid content block metadata.')
  const meta: BlockMeta = {}
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') { meta[key] = item; continue }
    if (isStringArray(item)) { meta[key] = item; continue }
    throw new Error(`Invalid metadata value for content block key "${key}".`)
  }
  return meta
}
function blockMetaToJson(meta: BlockMeta | undefined): Json | undefined {
  if (!meta) return undefined
  const serialized: Record<string, Json | undefined> = {}
  for (const [key, value] of Object.entries(meta)) serialized[key] = value
  return serialized
}
function parseContentBlock(value: Json): ContentBlock {
  if (!isRecord(value)) throw new Error('Invalid content block payload.')
  if (typeof value.id !== 'string' || typeof value.type !== 'string' || typeof value.content !== 'string') throw new Error('Content block is missing required fields.')
  if (!isEnumValue(value.type, BLOCK_TYPES)) throw new Error(`Invalid content block type: ${value.type}`)
  const meta = parseBlockMeta(value.meta)
  return { id: value.id, type: value.type, content: value.content, ...(meta ? { meta } : {}) }
}
function contentBlockToJson(block: ContentBlock): Json {
  return { id: block.id, type: block.type, content: block.content, ...(block.meta ? { meta: blockMetaToJson(block.meta) } : {}) }
}
function parseContentBlocks(value: Json): ContentBlock[] {
  if (!Array.isArray(value)) throw new Error('Chapter blocks must be a JSON array.')
  return value.map(parseContentBlock)
}
function contentBlocksToJson(blocks: ContentBlock[]): Json { return blocks.map(contentBlockToJson) }

export function publicationRowToDraft(row: PublicationRow): VibePublication {
  return {
    id: row.id, author_id: row.author_id, format: requireEnumValue(row.format, PUBLICATION_FORMATS, 'publication format'),
    title: row.title, subtitle: row.subtitle, cover_url: row.cover_url, description: row.description,
    genre: requireEnumValue(row.genre ?? 'other', PUBLICATION_GENRES, 'publication genre'), tags: row.tags ?? [],
    language: row.language === 'sw' || row.language === 'mixed' ? row.language : 'en',
    status: requireEnumValue(row.status, PUBLICATION_STATUSES, 'publication status'), pricing: parsePricing(row.pricing),
    chapter_count: row.chapter_count, total_reads: row.total_reads ?? 0, total_vibes: row.total_vibes ?? 0, earnings_ksh: row.earnings_ksh ?? 0,
    cbc_subject: optionalEnumValue(row.cbc_subject, CBC_SUBJECTS, 'subject'), cbc_grade: optionalEnumValue(row.cbc_grade, CBC_GRADES, 'grade'),
    cbc_aligned: row.cbc_aligned ?? false, curriculum_framework: row.curriculum_framework ?? 'CBC', series_name: row.series_name,
    series_number: row.series_number, publication_name: row.publication_name, issue_number: row.issue_number,
    created_at: row.created_at, updated_at: row.updated_at, published_at: row.published_at,
  }
}
export function publicationDraftToInsert(publication: VibePublication, chapterCount: number = publication.chapter_count): PublicationInsert {
  return {
    id: publication.id, author_id: publication.author_id, format: publication.format, title: publication.title?.trim() || undefined,
    subtitle: publication.subtitle, cover_url: publication.cover_url, description: publication.description, genre: publication.genre,
    tags: publication.tags, language: publication.language, status: publication.status, pricing: pricingToJson(publication.pricing), chapter_count: chapterCount,
    total_reads: publication.total_reads, total_vibes: publication.total_vibes, earnings_ksh: publication.earnings_ksh, cbc_subject: publication.cbc_subject,
    cbc_grade: publication.cbc_grade, cbc_aligned: publication.cbc_aligned, curriculum_framework: publication.curriculum_framework,
    series_name: publication.series_name, series_number: publication.series_number, publication_name: publication.publication_name,
    issue_number: publication.issue_number, created_at: publication.created_at, updated_at: new Date().toISOString(), published_at: publication.published_at,
  }
}
export function chapterRowToDraft(row: ChapterRow): VibeChapter {
  return {
    id: row.id, publication_id: row.publication_id, title: row.title, number: row.number, blocks: parseContentBlocks(row.blocks),
    status: requireEnumValue(row.status, CHAPTER_STATUSES, 'chapter status'), word_count: row.word_count, reading_time_min: row.reading_time_min,
    published_at: row.published_at, created_at: row.created_at, updated_at: row.updated_at, learning_outcomes: row.learning_outcomes,
    cbc_strand: row.cbc_strand, curriculum_id: row.curriculum_id, sub_strand_id: row.sub_strand_id,
  }
}
export function chapterDraftToInsert(chapter: VibeChapter): ChapterInsert {
  return {
    id: chapter.id, publication_id: chapter.publication_id, title: chapter.title, number: chapter.number, blocks: contentBlocksToJson(chapter.blocks),
    status: chapter.status, word_count: chapter.word_count, reading_time_min: chapter.reading_time_min, published_at: chapter.published_at,
    created_at: chapter.created_at, updated_at: new Date().toISOString(), learning_outcomes: chapter.learning_outcomes,
    cbc_strand: chapter.cbc_strand, curriculum_id: chapter.curriculum_id, sub_strand_id: chapter.sub_strand_id,
  }
}
