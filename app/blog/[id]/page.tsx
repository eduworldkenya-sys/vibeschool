import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import { getPublishedBlogStory } from '@/lib/blogContent'
import type { ContentBlock } from '@/lib/publishTypes'
import styles from './article.module.css'

const SITE_URL='https://www.vibeschool.co.ke'

export const revalidate=300

export async function generateMetadata({params}:{params:Promise<{id:string}>}):Promise<Metadata>{
  const {id}=await params
  const story=await getPublishedBlogStory(id)
  if(!story)return{title:'Article not found',robots:{index:false,follow:false}}
  const {publication}=story
  const title=publication.title?.trim()||'VibeSchool Education Article'
  const description=publication.description?.trim()||publication.subtitle?.trim()||'Practical education guidance from VibeSchool.'
  const canonical=`${SITE_URL}/blog/${publication.id}`
  return{
    title,description,alternates:{canonical},robots:{index:true,follow:true},
    openGraph:{type:'article',url:canonical,title,description,siteName:'VibeSchool',locale:'en_KE',publishedTime:publication.published_at??undefined,modifiedTime:publication.updated_at,...(publication.cover_url?{images:[{url:publication.cover_url,alt:title}]}:{})},
    twitter:{card:'summary_large_image',title,description,...(publication.cover_url?{images:[publication.cover_url]}:{})},
  }
}

export default async function BlogArticlePage({params}:{params:Promise<{id:string}>}){
  const {id}=await params
  const story=await getPublishedBlogStory(id)
  if(!story)notFound()
  const {publication,chapters,authorName}=story
  const title=publication.title?.trim()||'VibeSchool Education Article'
  const description=publication.description?.trim()||publication.subtitle?.trim()||''
  const canonical=`${SITE_URL}/blog/${publication.id}`
  const minutes=chapters.reduce((sum,chapter)=>sum+Math.max(0,chapter.reading_time_min||0),0)
  const schema={
    '@context':'https://schema.org','@type':'Article','@id':`${canonical}#article`,headline:title,description,url:canonical,
    mainEntityOfPage:{'@type':'WebPage','@id':canonical},author:{'@type':'Organization',name:authorName},publisher:{'@type':'EducationalOrganization',name:'VibeSchool',url:SITE_URL},
    inLanguage:publication.language==='sw'?'sw-KE':'en-KE',datePublished:publication.published_at,dateModified:publication.updated_at,
    ...(publication.cover_url?{image:publication.cover_url}:{}),
  }
  return <div className={styles.page}>
    <PublicHeader product="News & Guides"/>
    <main id="main-content">
      <article>
        <header className={styles.hero}><div className={styles.wrap}><Link href="/blog" className={styles.back}>← News & Guides</Link><p className={styles.eyebrow}>VIBESCHOOL EDUCATION</p><h1>{title}</h1>{description?<p className={styles.lead}>{description}</p>:null}<div className={styles.byline}><span>By {authorName}</span>{publication.published_at?<time dateTime={publication.published_at}>{formatDate(publication.published_at)}</time>:null}{minutes?<span>{minutes} min read</span>:null}</div></div></header>
        {publication.cover_url?<div className={styles.cover}><img src={publication.cover_url} alt={`Cover for ${title}`}/></div>:null}
        <div className={`${styles.article} ${styles.wrap}`}>{chapters.length?chapters.map(chapter=><section key={chapter.id} className={styles.chapter}>{chapters.length>1&&chapter.title?<h2>{chapter.title}</h2>:null}{chapter.blocks.map(block=><ArticleBlock key={block.id} block={block}/>)}</section>):<div className={styles.empty}>This article is being prepared for reading.</div>}</div>
      </article>
      <section className={styles.next}><div className={styles.wrap}><div><p className={styles.eyebrowDark}>KEEP EXPLORING</p><h2>Turn useful information into action.</h2></div><div className={styles.nextLinks}><Link href="/blog">More news & guides</Link><Link href="/kenya-education">Verified Kenya education guides</Link><Link href="/global/read">Start learning</Link></div></div></section>
    </main>
    <PublicFooter/>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/>
  </div>
}

function ArticleBlock({block}:{block:ContentBlock}){
  const content=block.content?.trim()
  if(!content)return null
  if(block.type==='heading1')return <h2>{content}</h2>
  if(block.type==='heading2'||block.type==='heading3')return <h3>{content}</h3>
  if(block.type==='quote')return <blockquote>{content}</blockquote>
  if(block.type==='bulletList')return <ul>{content.split(/\n+/).map((item,index)=><li key={index}>{item.replace(/^[-•]\s*/, '')}</li>)}</ul>
  if(block.type==='numberedList')return <ol>{content.split(/\n+/).map((item,index)=><li key={index}>{item.replace(/^\d+[.)]\s*/, '')}</li>)}</ol>
  if(block.type==='divider')return <hr/>
  if(block.type==='image'&&/^https?:\/\//i.test(content))return <figure><img src={content} alt={String(block.meta?.caption||'Article illustration')}/>{block.meta?.caption?<figcaption>{String(block.meta.caption)}</figcaption>:null}</figure>
  const paragraphs=content.split(/\n\n+/).filter(Boolean)
  if(['callout','definition','example','workedExample','summary','keyPoints','activity','experiment','project','question'].includes(block.type))return <aside className={styles.callout}>{paragraphs.map((paragraph,index)=><p key={index}>{paragraph}</p>)}</aside>
  return <>{paragraphs.map((paragraph,index)=><p key={index}>{paragraph}</p>)}</>
}

function formatDate(value:string){return new Intl.DateTimeFormat('en-KE',{day:'numeric',month:'long',year:'numeric'}).format(new Date(value))}
