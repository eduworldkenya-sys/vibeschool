import knowledge from '@/config/education-knowledge.json'

type Source = {
  id: string
  authority: string
  title: string
  url: string
  source_type: string
  verified_on: string
}

export type KnowledgeSection = {
  heading: string
  kind: 'fact' | 'guidance' | 'boundary'
  body: string
  source_ids: string[]
}

export type KnowledgeArticle = {
  slug: string
  title: string
  description: string
  audience: string[]
  updated_on: string
  sections: KnowledgeSection[]
}

const sources = knowledge.sources as Source[]
const articles = knowledge.articles as KnowledgeArticle[]

export function listKnowledgeArticles() { return articles }
export function getKnowledgeArticle(slug: string) { return articles.find(article => article.slug === slug) }
export function getKnowledgeSources(ids: string[]) {
  return ids.map(id => sources.find(source => source.id === id)).filter((source): source is Source => Boolean(source))
}
export function listKnowledgeSources() { return sources }
export function knowledgeVerifiedOn() { return knowledge.verified_on }
