import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import { BlogExplorer } from '@/components/blog/BlogExplorer'
import { listPublishedBlogArticles } from '@/lib/blogContent'
import { listKnowledgeArticles } from '@/lib/educationKnowledge'

export const revalidate = 300

export default async function BlogPage(){
  const publications = await listPublishedBlogArticles()
  const guides = listKnowledgeArticles()
  return <div className="blog-shell">
    <PublicHeader product="News & Guides" />
    <main id="main-content"><BlogExplorer publications={publications} guides={guides}/></main>
    <PublicFooter />
  </div>
}
