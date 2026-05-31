// lib/storyTypes.ts

export type StoryStatus    = 'draft' | 'published'
export type AgeRange       = '4-8' | '9-12' | '13+'
export type StoryLanguage  = 'en' | 'sw' | 'mixed'
export type BubbleShape    = 'speech' | 'thought' | 'shout' | 'whisper'
export type TextAlign      = 'left' | 'center' | 'right'
export type FontFamily     = 'rounded' | 'bold' | 'handwritten' | 'serif'

export interface StoryCharacter {
  id:        string
  name:      string
  color:     string
  emoji:     string
  avatarUrl: string | null
}

export interface StoryTextBlock {
  id:         string
  text:       string
  x:          number
  y:          number
  fontSize:   number
  fontFamily: FontFamily
  color:      string
  align:      TextAlign
  bold:       boolean
  italic:     boolean
}

export interface StorySpeechBubble {
  id:            string
  text:          string
  characterId:   string | null
  shape:         BubbleShape
  x:             number
  y:             number
  width:         number
  tailDirection: 'left' | 'right' | 'up' | 'down'
  bgColor:       string
  textColor:     string
  fontSize:      number
}

export interface StoryPage {
  id:                 string
  storyId:            string
  pageNumber:         number
  illustrationUrl:    string | null
  illustrationPrompt: string | null
  textBlocks:         StoryTextBlock[]
  speechBubbles:      StorySpeechBubble[]
  backgroundColor:    string
}

export interface VibeStory {
  id:            string
  authorId:      string
  title:         string
  coverImageUrl: string | null
  description:   string | null
  language:      StoryLanguage
  ageRange:      AgeRange
  tags:          string[]
  characters:    StoryCharacter[]
  status:        StoryStatus
  pageCount:     number
  viewCount:     number
  vibeCount:     number
  earningsKsh:   number
  createdAt:     string
  updatedAt:     string
  publishedAt:   string | null
}

export interface StoryDraft {
  story: VibeStory
  pages: StoryPage[]
}

export function emptyPage(storyId: string, pageNumber: number): StoryPage {
  return {
    id:                 crypto.randomUUID(),
    storyId,
    pageNumber,
    illustrationUrl:    null,
    illustrationPrompt: null,
    textBlocks:         [],
    speechBubbles:      [],
    backgroundColor:    '#1a1a2e',
  }
}

export function emptyStory(authorId: string): VibeStory {
  return {
    id:            crypto.randomUUID(),
    authorId,
    title:         '',
    coverImageUrl: null,
    description:   null,
    language:      'en',
    ageRange:      '4-8',
    tags:          [],
    characters:    [],
    status:        'draft',
    pageCount:     1,
    viewCount:     0,
    vibeCount:     0,
    earningsKsh:   0,
    createdAt:     new Date().toISOString(),
    updatedAt:     new Date().toISOString(),
    publishedAt:   null,
  }
}

export function emptyCharacter(): StoryCharacter {
  const colors = ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD','#98D8C8']
  const emojis = ['🦁','🐘','🦊','🐬','🦋','🐸','🦉','🐼','🦒','🐧']
  return {
    id:        crypto.randomUUID(),
    name:      '',
    color:     colors[Math.floor(Math.random() * colors.length)],
    emoji:     emojis[Math.floor(Math.random() * emojis.length)],
    avatarUrl: null,
  }
}

export function emptyTextBlock(): StoryTextBlock {
  return {
    id:         crypto.randomUUID(),
    text:       '',
    x:          10,
    y:          70,
    fontSize:   18,
    fontFamily: 'rounded',
    color:      '#ffffff',
    align:      'center',
    bold:       false,
    italic:     false,
  }
}

export function emptySpeechBubble(characterId: string | null): StorySpeechBubble {
  return {
    id:            crypto.randomUUID(),
    text:          '',
    characterId,
    shape:         'speech',
    x:             20,
    y:             20,
    width:         60,
    tailDirection: 'down',
    bgColor:       '#ffffff',
    textColor:     '#000000',
    fontSize:      14,
  }
}
