import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import { getKnowledgeArticle, getKnowledgeSources, listKnowledgeArticles } from '@/lib/educationKnowledge'

export function generateStaticParams(){ return listKnowledgeArticles().map(article=>({slug:article.slug})) }

export function generateMetadata({params}:{params:{slug:string}}):Metadata{
  const article=getKnowledgeArticle(params.slug)
  if(!article) return { title:'Kenya Education Guide' }
  return { alternates:{canonical:`/kenya-education/${article.slug}`}, title:article.title, description:article.description }
}

const labels={fact:'Official-source fact',guidance:'Practical guidance',boundary:'Important boundary'} as const

export default function KnowledgeArticlePage({params}:{params:{slug:string}}){
  const article=getKnowledgeArticle(params.slug)
  if(!article) notFound()
  return <div className="page"><PublicHeader product="Kenya Education"/><main id="main-content">
    <section className="hero"><div className="wrap"><Link href="/kenya-education" className="back">← Kenya Education</Link><p className="eyebrow">SOURCE-BACKED GUIDE</p><h1>{article.title}</h1><p className="lead">{article.description}</p><p className="updated">Reviewed {article.updated_on}</p></div></section>
    <article className="article wrap">{article.sections.map(section=>{const sources=getKnowledgeSources(section.source_ids);return <section key={section.heading}><p className={`kind ${section.kind}`}>{labels[section.kind]}</p><h2>{section.heading}</h2><p className="body">{section.body}</p><div className="refs"><span>Sources</span>{sources.map(source=><a key={source.id} href={source.url} target="_blank" rel="noopener noreferrer">{source.authority}: {source.title} ↗</a>)}</div></section>})}</article>
    <section className="next"><div className="wrap"><h2>Continue with the evidence, not just the explanation.</h2><div><Link href="/pathways">Explore VibeSchool Pathways</Link><Link href="/pathways/schools">Explore school discovery</Link><Link href="/kenya-education">More Kenya education guides</Link></div></div></section>
  </main><PublicFooter/><style>{styles}</style></div>
}

const styles=`.page{background:#f8f8f5;color:#111827;font-family:var(--font-jakarta),Arial,sans-serif;line-height:1.75}.page *{box-sizing:border-box}.wrap{max-width:920px;margin:auto}.hero{background:#07111f;color:#fff;padding:76px 24px}.back{color:#c7d1dc;text-decoration:none;font-weight:750}.eyebrow{font:850 11px var(--font-mono);letter-spacing:.15em;color:#d0b154;margin-top:34px}h1,h2{font-family:var(--font-display),Arial,sans-serif;letter-spacing:-.035em;line-height:1.08}h1{font-size:clamp(40px,5.7vw,66px);margin:12px 0 20px}.lead{font-size:18px;color:#c8d1dc;max-width:760px}.updated{font-size:12px;color:#93a1b2}.article{padding:55px 24px 80px}.article section{padding:34px 0;border-bottom:1px solid #dfe1e4}.article h2{font-size:clamp(27px,3.8vw,39px);margin:8px 0 14px}.body{font-size:17px;color:#4f5966;max-width:790px}.kind{display:inline-flex;border-radius:999px;padding:5px 9px;font:800 10px var(--font-mono);letter-spacing:.07em;text-transform:uppercase;margin:0}.fact{background:#e7f4eb;color:#205c35}.guidance{background:#e8edf8;color:#294b7a}.boundary{background:#fff1cf;color:#725710}.refs{display:grid;gap:5px;margin-top:18px;padding:14px;border-left:3px solid #d0b154;background:#fff}.refs span{font:800 10px var(--font-mono);text-transform:uppercase;color:#6c7480}.refs a{color:#5f4b14;font-size:13px;font-weight:750;text-decoration:none}.next{background:#eeeae0;padding:62px 24px}.next h2{font-size:32px}.next div div{display:flex;gap:10px;flex-wrap:wrap}.next a{background:#fff;border:1px solid #d7d3c8;border-radius:10px;padding:11px 14px;text-decoration:none;color:#17202c;font-weight:800}@media(max-width:700px){.hero{padding:58px 18px}.article{padding:35px 18px 60px}.next{padding:50px 18px}}`