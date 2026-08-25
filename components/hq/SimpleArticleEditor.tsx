"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { usePublicationDraft } from "@/hooks/usePublicationDraft"

const templates = [
  ["Revision guide", "What learners will understand\n\nExplain the idea clearly here.\n\nWorked example\n\nShow the steps and answer.\n\nCommon mistake\n\nExplain what learners often get wrong.\n\nTry it yourself\n\nAdd three short questions."],
  ["Exam guide", "The challenge\n\nExplain what the examination tests.\n\nHow to answer\n\nGive a clear step-by-step method.\n\nExaminer tip\n\nShow how marks are earned.\n\nPractice question\n\nAdd a question and model answer."],
  ["Education news", "What happened\n\nState the verified development.\n\nWhy it matters\n\nExplain the impact on learners, teachers or parents.\n\nWhat to do next\n\nGive practical, clearly-labelled guidance.\n\nSources\n\nAdd links to the original authoritative sources."],
] as const

export function SimpleArticleEditor({authorId, publicationId}:{authorId:string;publicationId?:string}){
  const router=useRouter()
  const draft=usePublicationDraft(authorId,"vibepress",publicationId)
  const [publishing,setPublishing]=useState(false)
  const chapter=draft.chapters.find(item=>item.id===draft.activeChapterId)??draft.chapters[0]
  const body=useMemo(()=>chapter?.blocks.map(block=>block.content).filter(Boolean).join("\n\n")??"",[chapter])
  const bodyBlock=chapter?.blocks[0]

  function setBody(value:string){
    if(bodyBlock) draft.updateBlock(bodyBlock.id,value)
  }
  function applyTemplate(value:string){
    if(body.trim()&&!window.confirm("Replace the current article body with this template?")) return
    setBody(value)
  }
  async function publish(){
    if(!draft.publication?.title?.trim()||!body.trim()) return
    setPublishing(true)
    const saved=await draft.forceSave()
    const published=saved&&await draft.publishPublication()
    setPublishing(false)
    if(published) router.push(`/global/read/publication/${draft.publication?.id}`)
  }
  if(draft.loading)return <main className="simple-loading">Opening your article…</main>
  if(!draft.publication||!chapter)return <main className="simple-loading">The editor could not open. {draft.error}</main>
  const pub=draft.publication
  return <main className="simple-editor">
    <header><button onClick={()=>router.push("/hq/studio")}>← Studio</button><div><strong>VibeSchool Article Editor</strong><span>{draft.saving?"Saving…":draft.lastSaved?"Saved automatically":"Draft"}</span></div><button className="publish" disabled={publishing||!pub.title?.trim()||!body.trim()} onClick={publish}>{publishing?"Publishing…":"Publish"}</button></header>
    <div className="workspace">
      <section className="templates"><p>START FAST</p><h2>Choose a structure</h2>{templates.map(([name,value])=><button key={name} onClick={()=>applyTemplate(value)}><strong>{name}</strong><span>Use template →</span></button>)}</section>
      <section className="canvas">
        <label>Headline<input autoFocus value={pub.title??""} onChange={event=>draft.updatePublication({title:event.target.value})} placeholder="A clear, useful headline"/></label>
        <label>Short introduction<textarea rows={3} value={pub.description??""} onChange={event=>draft.updatePublication({description:event.target.value,subtitle:event.target.value})} placeholder="Tell the reader what they will gain."/></label>
        <div className="row"><label>Category<select value={pub.genre} onChange={event=>draft.updatePublication({genre:event.target.value as typeof pub.genre})}><option value="academic">Revision</option><option value="magazine">Education news</option><option value="self_help">Study skills</option><option value="non_fiction">Careers & guidance</option></select></label><label>Cover image URL<input value={pub.cover_url??""} onChange={event=>draft.updatePublication({cover_url:event.target.value||null})} placeholder="Optional"/></label></div>
        <label>Article body<textarea className="body" rows={22} value={body} onChange={event=>setBody(event.target.value)} placeholder="Write naturally. Headings, examples and questions can each begin on a new line."/></label>
        {draft.error&&<p className="error">{draft.error}</p>}
      </section>
      <aside><p>MOBILE PREVIEW</p><div className="preview">{pub.cover_url&&<img src={pub.cover_url} alt=""/>}<small>VIBESCHOOL EDUCATION</small><h1>{pub.title||"Your headline appears here"}</h1><b>{pub.description||"Your short introduction appears here."}</b>{body.split(/\n\n+/).filter(Boolean).slice(0,6).map((text,index)=><p key={index}>{text}</p>)}</div></aside>
    </div>
    <style jsx>{`*{box-sizing:border-box}.simple-editor{min-height:100dvh;background:#f4f1e8;color:#111827;font-family:var(--font-jakarta),Arial,sans-serif}.simple-loading{min-height:100dvh;display:grid;place-items:center;background:#101827;color:white}.simple-editor>header{position:sticky;top:0;z-index:5;min-height:62px;padding:10px 18px;background:#07111f;color:white;display:flex;align-items:center;justify-content:space-between;gap:14px}.simple-editor header button{border:0;background:transparent;color:#cbd5e1;font-weight:800;cursor:pointer}.simple-editor header div{display:grid;text-align:center}.simple-editor header span{font-size:11px;color:#94a3b8}.simple-editor header .publish{background:#d0b154;color:#07111f;border-radius:9px;padding:10px 16px}.simple-editor header .publish:disabled{opacity:.45}.workspace{max-width:1450px;margin:auto;padding:22px;display:grid;grid-template-columns:210px minmax(0,760px) minmax(260px,1fr);gap:18px}.templates,.canvas,aside{background:#fff;border:1px solid #dedbd2;border-radius:16px;padding:18px;align-self:start}.templates>p,aside>p{font-size:10px;letter-spacing:.14em;font-weight:900;color:#755b17}.templates h2{font-size:20px}.templates button{width:100%;text-align:left;display:grid;gap:4px;padding:13px;margin:8px 0;border:1px solid #ddd8ca;border-radius:10px;background:#faf8f2;cursor:pointer}.templates span{font-size:11px;color:#755b17}.canvas{display:grid;gap:17px}.canvas label{display:grid;gap:7px;font-size:12px;font-weight:850}.canvas input,.canvas textarea,.canvas select{width:100%;border:1px solid #ccd0d6;border-radius:10px;padding:11px 12px;font:inherit;background:white}.canvas input:first-of-type{font-size:20px;font-weight:850}.canvas .body{line-height:1.7;resize:vertical}.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}.preview{border:1px solid #ddd8ca;border-radius:16px;overflow:hidden;padding:18px;font-family:Georgia,serif}.preview img{width:calc(100% + 36px);height:150px;object-fit:cover;margin:-18px -18px 15px}.preview small{color:#755b17;font:800 9px Arial;letter-spacing:.12em}.preview h1{font-size:28px;line-height:1.05;margin:8px 0 12px}.preview b{font:600 13px/1.5 Arial;color:#58606c}.preview p{white-space:pre-wrap;line-height:1.65;color:#374151}.error{color:#b91c1c;font-weight:700}@media(max-width:1050px){.workspace{grid-template-columns:190px 1fr}.workspace aside{grid-column:1/-1}.preview{max-width:680px;margin:auto}}@media(max-width:720px){.simple-editor>header{padding:8px 10px}.simple-editor header div strong{font-size:13px}.workspace{padding:10px;grid-template-columns:1fr}.templates{display:flex;overflow-x:auto;gap:8px}.templates>p,.templates h2{display:none}.templates button{min-width:155px;margin:0}.row{grid-template-columns:1fr}.canvas{padding:15px}.workspace aside{display:none}}`}</style>
  </main>
}
