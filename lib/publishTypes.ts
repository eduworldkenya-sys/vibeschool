// lib/publishTypes.ts

export type PublicationFormat =
  | 'vibepress'
  | 'vibechronicles'
  | 'vibetextbook'
  | 'vibescripture'
  | 'vibevoice'

export type PublicationStatus = 'draft' | 'published' | 'archived'
export type ChapterStatus = 'draft' | 'published' | 'locked'

export type BlockType =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'quote'
  | 'bulletList'
  | 'numberedList'
  | 'image'
  | 'divider'
  | 'callout'
  | 'code'
  | 'activity'
  | 'question'
  | 'interactive'

export type PricingModel =
  | { type: 'free' }
  | { type: 'paid'; priceKsh: number }
  | { type: 'freemium'; freeChapters: number; priceKsh: number }
  | { type: 'donation'; suggestedKsh: number }
  | { type: 'school_license'; perStudentKsh: number; schoolKsh: number }

export type CBCSubject =
  | 'mathematics'
  | 'english'
  | 'kiswahili'
  | 'science'
  | 'biology'
  | 'chemistry'
  | 'physics'
  | 'history_citizenship'
  | 'history_government'
  | 'business_studies'
  | 'agriculture'
  | 'social_studies'
  | 'creative_arts'
  | 'physical_education'
  | 'religious_education'
  | 'other'

export type CBCGrade =
  | 'pp1' | 'pp2'
  | 'grade1' | 'grade2' | 'grade3' | 'grade4'
  | 'grade5' | 'grade6' | 'grade7' | 'grade8' | 'grade9'
  | 'grade10' | 'grade11' | 'grade12'
  | 'form1' | 'form2' | 'form3' | 'form4'

export type PublicationGenre =
  | 'fiction' | 'non_fiction' | 'romance' | 'thriller'
  | 'biography' | 'self_help' | 'religion' | 'academic'
  | 'children' | 'poetry' | 'magazine' | 'other'

export type BlockMeta = Record<string, string | number | boolean | string[]>

export interface ContentBlock {
  id:      string
  type:    BlockType
  content: string
  meta?:   BlockMeta
}

export interface VibePublication {
  id:               string
  author_id:        string
  format:           PublicationFormat
  title:            string | null
  subtitle:         string | null
  cover_url:        string | null
  description:      string | null
  genre:            PublicationGenre
  tags:             string[]
  language:         'en' | 'sw' | 'mixed'
  status:           PublicationStatus
  pricing:          PricingModel
  chapter_count:    number
  total_reads:      number
  total_vibes:      number
  earnings_ksh:     number
  cbc_subject:      CBCSubject | null
  cbc_grade:        CBCGrade | null
  cbc_aligned:      boolean
  curriculum_framework: string
  series_name:      string | null
  series_number:    number | null
  publication_name: string | null
  issue_number:     string | null
  created_at:       string
  updated_at:       string
  published_at:     string | null
}

export interface VibeChapter {
  id:               string
  publication_id:   string
  title:            string | null
  number:            number
  blocks:           ContentBlock[]
  status:           ChapterStatus
  word_count:       number
  reading_time_min: number
  published_at:     string | null
  created_at:       string
  updated_at:       string
  learning_outcomes: string[]
  cbc_strand:       string | null
  curriculum_id:    string | null
  sub_strand_id:    string | null
}

export interface ProfileData {
  id:         string
  full_name:  string | null
  avatar_url: string | null
  bio:        string | null
}

export const FORMAT_META: Record<PublicationFormat, {
  label:         string
  icon:          string
  accent:        string
  chapterLabel:  string
  chapterPlural: string
}> = {
  vibepress: { label: 'VibePress', icon: '📰', accent: '#4ECDC4', chapterLabel: 'Article', chapterPlural: 'Articles' },
  vibechronicles: { label: 'VibeChronicles', icon: '📖', accent: '#FF6B6B', chapterLabel: 'Chapter', chapterPlural: 'Chapters' },
  vibetextbook: { label: 'VibeTextbook', icon: '🎓', accent: '#CCFF00', chapterLabel: 'Unit', chapterPlural: 'Units' },
  vibescripture: { label: 'VibeScripture', icon: '📿', accent: '#DDA0DD', chapterLabel: 'Chapter', chapterPlural: 'Chapters' },
  vibevoice: { label: 'VibeVoice', icon: '🎙️', accent: '#45B7D1', chapterLabel: 'Episode', chapterPlural: 'Episodes' },
}

export function emptyPublication(authorId: string, format: PublicationFormat): VibePublication {
  return {
    id: crypto.randomUUID(), author_id: authorId, format, title: null, subtitle: null, cover_url: null, description: null,
    genre: 'other', tags: [], language: 'en', status: 'draft', pricing: { type: 'free' }, chapter_count: 0,
    total_reads: 0, total_vibes: 0, earnings_ksh: 0, cbc_subject: null, cbc_grade: null, cbc_aligned: false,
    curriculum_framework: 'CBE', series_name: null, series_number: null, publication_name: null, issue_number: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(), published_at: null,
  }
}

export function emptyChapter(publicationId: string, number: number): VibeChapter {
  return {
    id: crypto.randomUUID(), publication_id: publicationId, title: null, number,
    blocks: [{ id: crypto.randomUUID(), type: 'paragraph', content: '' }], status: 'draft', word_count: 0,
    reading_time_min: 1, published_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    learning_outcomes: [], cbc_strand: null, curriculum_id: null, sub_strand_id: null,
  }
}
