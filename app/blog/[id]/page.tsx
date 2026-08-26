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

export async function generateMetadata({params}:{params:{id:string}}):Promise<Metadata>{
  const story=await getPublishedBlogStory(params.id)
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

export default async function BlogArticlePage({params}:{params:{id:string}}){
  const story=await getPublishedBlogStory(params.id)
  if(!story)notFound()
  const {publication,chapters,authorName}=story
  const title=publication.title?.trim()||'VibeSchool Education Article'
  const description=publication.description?.trim()||publication.subtitle?.trim()||''
  const canonical=`${SITE_URL}/blog/${publication.id}`
  const minutes=chapters.reduce((sum,chapter)=>sum+Math.max(0,chapter.reading_time_min||0),0)
  const schema={'@context':'https://schema.org','@type':'Article','@id':`${canonical}#article`,headline:title,description,url:canonical,mainEntityOfPage:{'@type':'WebPage','@id':canonical},author:{'@type':'Organization',name:authorName},publisher:{'@type':'EducationalOrganization',name:'VibeSchool',url:SITE_URL},inLanguage:publication.language==='sw'?'sw-KE':'en-KE',datePublished:publication.published_at,dateModified:publication.updated_at,...(publication.cover_url?{image:publication.cover_url}:{})}
  const isExamStory=(publication.tags??[]).some(tag=>/kcse|exam|revision/i.test(tag))||/kcse|exam|revision/i.test(title)
  return <div className={styles.page}>
    <PublicHeader product="News & Guides"/>
    <main id="main-content"><article>
      <header className={styles.hero}><div className={styles.wrap}><Link href="/blog" className={styles.back}>← News & Guides</Link><p className={styles.eyebrow}>VIBESCHOOL EDUCATION</p><h1>{title}</h1>{description?<p className={styles.lead}>{description}</p>:null}<div className={styles.byline}><span>By {authorName}</span>{publication.published_at?<time dateTime={publication.published_at}>{formatDate(publication.published_at)}</time>:null}{minutes?<span>{minutes} min read</span>:null}</div></div></header>
      {publication.cover_url?<div className={styles.cover}><img src={publication.cover_url} alt={`Cover for ${title}`}/></div>:null}
      <div className={`${styles.article} ${styles.wrap}`}>{chapters.length?chapters.map(chapter=><section key={chapter.id} className={styles.chapter}>{chapters.length>1&&chapter.title?<h2>{chapter.title}</h2>:null}{chapter.blocks.map(block=><ArticleBlock key={block.id} block={block}/>)}</section>):<div className={styles.empty}>This article is being prepared for reading.</div>}</div>
    </article>
    <section className={styles.action} aria-labelledby="article-next-step"><div className={styles.wrap}><div><p className={styles.eyebrowDark}>PUT THIS INTO PRACTICE</p><h2 id="article-next-step">{isExamStory?'Find the gap. Work on the next mark.':'Keep learning while the idea is fresh.'}</h2><p>{isExamStory?'Choose what needs attention, practise it and use the result to decide what comes next.':'Move from reading into a focused VibeSchool learning experience.'}</p></div><div className={styles.actionLinks}><Link className={styles.primaryAction} href="/global/read">{isExamStory?'Start focused practice':'Start learning'} →</Link><Link href="/kenya-education">Browse Kenya education guides</Link></div></div></section>
    <section className={styles.next}><div className={styles.wrap}><div><p className={styles.eyebrowDark}>KEEP EXPLORING</p><h2>More useful reading.</h2></div><div className={styles.nextLinks}><Link href="/blog">More news & guides</Link><Link href="/kenya-education">Verified Kenya education guides</Link></div></div></section>
    </main><PublicFooter/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/>
  </div>
}

function ArticleBlock({block}:{block:ContentBlock}){
  const content=block.content?.trim(); if(!content)return null
  if(block.type==='heading1')return <h2>{content}</h2>
  if(block.type==='heading2'||block.type==='heading3')return <h3>{content}</h3>
  if(block.type==='quote')return <blockquote>{content}</blockquote>
  if(block.type==='bulletList')return <ul>{content.split(/\n+/).map((item,index)=><li key={index}>{item.replace(/^[-•]\s*/, '')}</li>)}</ul>
  if(block.type==='numberedList')return <ol className={styles.actionSteps}>{content.split(/\n+/).map((item,index)=><li key={index}><StepText text={item.replace(/^\d+[.)]\s*/, '')}/></li>)}</ol>
  if(block.type==='divider')return <hr/>
  if(block.type==='image'&&/^https?:\/\//i.test(content))return <figure><img src={content} alt={String(block.meta?.caption||'Article illustration')}/>{block.meta?.caption?<figcaption>{String(block.meta.caption)}</figcaption>:null}</figure>
  const paragraphs=content.split(/\n\n+/).filter(Boolean)
  if(['callout','definition','example','workedExample','summary','keyPoints','activity','experiment','project','question'].includes(block.type))return <aside className={styles.callout}>{paragraphs.map((paragraph,index)=><p key={index}>{paragraph}</p>)}</aside>
  return <>{paragraphs.map((paragraph,index)=><p key={index}>{paragraph}</p>)}</>
}

function StepText({text}:{text:string}){const match=text.match(/^([^—–-]{1,32})\s*[—–-]\s*(.+)$/);return match?<><strong>{match[1].trim()}</strong><span>{match[2].trim()}</span></>:<span>{text}</span>}
function formatDate(value:string){return new Intl.DateTimeFormat('en-KE',{day:'numeric',month:'long',year:'numeric'}).format(new Date(value))}
