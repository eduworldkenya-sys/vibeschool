export type MiniExample = {
  id: string
  title: string
  subject: string
  tags: string[]
  creator: string
  minutes: number
  summary: string
  paragraphs: string[]
  cover: 'history' | 'agriculture' | 'physics' | 'literature'
  question: string
  choices: string[]
  correct: number
}
