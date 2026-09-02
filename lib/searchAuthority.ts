import type { Metadata } from 'next'
import type { VibePublication } from '@/lib/publishTypes'

export const SITE_URL = 'https://www.vibeschool.co.ke'
export const ORGANIZATION_ID = `${SITE_URL}/#organization`

type ContentKind = 'news' | 'revision' | 'curriculum' | 'teacher-guide' | 'education-guide'

type AuthorityContext = {
  kind: ContentKind
  audience: 'teacher' | 'learner' | 'parent' | 'general'
  subject?: string
  grade?: string
  programme?: 'KCSE' | 'KJSEA' | 'KPSEA'
  topics: string[]
}

const clean = (value?: string | null) => value?.trim() || undefined
const unique = (values: Array<string | undefined>) => [...new Set(values.filter((value): value is string => Boolean(value)))]

export function classifyPublication(publication: VibePublication): AuthorityContext {
  const evidence = `${publication.title ?? ''} ${publication.description ?? ''} ${(publication.tags ?? []).join(' ')}`.toLowerCase()
  const programme = /kcse/.test(evidence) ? 'KCSE' : /kjsea/.test(evidence) ? 'KJSEA' : /kpsea/.test(evidence) ? 'KPSEA' : undefined
  const kind: ContentKind = /revision|exam|practice|past paper/.test(evidence)
    ? 'revision'
    : publication.cbc_aligned || publication.cbc_subject || publication.cbc_grade
      ? 'curriculum'
      : /tsc|teacher|lesson plan|scheme of work/.test(evidence)
        ? 'teacher-guide'
        : /news|court|announces|announced|launch|results|deadline/.test(evidence)
          ? 'news'
          : 'education-guide'
  const audience = kind === 'teacher-guide' ? 'teacher' : kind === 'revision' || kind === 'curriculum' ? 'learner' : 'general'
  return {
    kind,
    audience,
    subject: clean(publication.cbc_subject?.replaceAll('_', ' ')),
    grade: clean(publication.cbc_grade?.replace(/^grade/, 'Grade ').replace(/^form/, 'Form ')),
    programme,
    topics: unique(publication.tags ?? []).slice(0, 8),
  }
}

export function buildArticleMetadata(publication: VibePublication): Metadata {
  const title = clean(publication.title) ?? 'VibeSchool Education Article'
  const description = clean(publication.description) ?? clean(publication.subtitle) ?? 'Practical education guidance from VibeSchool.'
  const canonical = `${SITE_URL}/blog/${publication.id}`
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      type: 'article', url: canonical, title, description, siteName: 'VibeSchool',
      locale: publication.language === 'sw' ? 'sw_KE' : 'en_KE',
      publishedTime: publication.published_at ?? undefined,
      modifiedTime: publication.updated_at,
      ...(publication.cover_url ? { images: [{ url: publication.cover_url, alt: title }] } : {}),
    },
    twitter: { card: 'summary_large_image', title, description, ...(publication.cover_url ? { images: [publication.cover_url] } : {}) },
  }
}

export function buildArticleSchemas(publication: VibePublication, authorName: string) {
  const title = clean(publication.title) ?? 'VibeSchool Education Article'
  const description = clean(publication.description) ?? clean(publication.subtitle) ?? ''
  const canonical = `${SITE_URL}/blog/${publication.id}`
  const context = classifyPublication(publication)
  const articleType = context.kind === 'news' ? 'NewsArticle' : 'Article'
  const article = {
    '@context': 'https://schema.org', '@type': articleType, '@id': `${canonical}#article`,
    headline: title, description, url: canonical,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    author: { '@type': 'Person', name: authorName },
    publisher: { '@type': 'EducationalOrganization', '@id': ORGANIZATION_ID, name: 'VibeSchool', url: SITE_URL },
    inLanguage: publication.language === 'sw' ? 'sw-KE' : 'en-KE',
    datePublished: publication.published_at, dateModified: publication.updated_at,
    isAccessibleForFree: true,
    about: unique([context.programme, context.grade, context.subject, ...context.topics]).map(name => ({ '@type': 'Thing', name })),
    ...(publication.cover_url ? { image: publication.cover_url } : {}),
  }
  const breadcrumb = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList', '@id': `${canonical}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'VibeSchool', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'News & Guides', item: `${SITE_URL}/blog` },
      { '@type': 'ListItem', position: 3, name: title, item: canonical },
    ],
  }
  return { article, breadcrumb, context }
}

export function relatedSearchHref(context: AuthorityContext) {
  const query = context.subject ?? context.programme ?? context.topics[0] ?? 'Kenya education'
  return `/blog?search=${encodeURIComponent(query)}`
}

export function learningHref(context: AuthorityContext) {
  if (context.kind === 'revision') return `/global/read?intent=practice&source=blog${context.programme ? `&programme=${context.programme.toLowerCase()}` : ''}`
  return '/global/read?source=blog'
}
