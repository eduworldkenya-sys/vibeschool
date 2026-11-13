'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, ArrowRight, BookOpen, BookmarkCheck, ChevronLeft, ChevronRight, Moon, Sun, Type } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { ContentBlock, VibeChapter, VibePublication } from '@/lib/publishTypes'
import { isStoryPublication, safeStoryImage, storyReaderHref, storyText } from '@/lib/learn/storyPublications'
import css from './Originals.module.css'

type StoryChapter=Pick<VibeChapter,'id'|'number'|'title'|'blocks'|'status'|'word_count'|'reading_time_min'>
type SavedProgress={ chapter_id:string; progress_percent:number; last_read_at:string; reading_position:{block_id?:string;block_offset_percent?:number;scroll_percent?:number}|null }
type Position={ chapterId:string; blockId:string; percent:number; blockOffset:number }
const clamp=(v:number)=>Math.max(0,Math.min(100,Math.round(v)))
const GUEST_KEY='vibeschool.originals.guest.'

function StoryBlock({block}:{block:ContentBlock}) {
  if(block.type==='image'||block.type==='diagram') {
    const url=safeStoryImage(block.content)
    if(!url) return null
    const alt=String(block.meta?.alt||block.meta?.caption||'Story illustration')
    return <figure className={css.illustration}><img loading="lazy" src={url} alt={alt}/>{block.meta?.caption && <figcaption>{String(block.meta.caption)}</figcaption>}</figure>
  }
  if(block.type==='divider') return <hr className={css.storyDivider}/>
  const prose=storyText(block.content||'')
  if(!prose) return null
  if(block.type==='heading1'||block.type==='heading2'||block.type==='heading3') return <h3 className={css.storySubhead}>{prose}</h3>
  if(block.type==='quote') return <blockquote className={css.storyQuote}>{prose}</blockquote>
  return <p className={css.prose}>{prose}</p>
}

export function StoryBook({mode}:{mode:'detail'|'read'}) {
  const params=useParams()
  const router=useRouter()
  const search=useSearchParams()
  const id=typeof params.id==='string'?params.id:''
  const initialRequest=useRef({id,chapter:search.get('chapter'),resume:search.get('resume')==='1'})
  const [publication,setPublication]=useState<VibePublication|null>(null)
  const [chapters,setChapters]=useState<StoryChapter[]>([])
  const [saved,setSaved]=useState<SavedProgress[]>([])
  const [activeId,setActiveId]=useState('')
  const [signedIn,setSignedIn]=useState(false)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [theme,setTheme]=useState<'paper'|'night'>('paper')
  const [fontScale,setFontScale]=useState(1)
  const [sync,setSync]=useState('')
  const positionRef=useRef<Position|null>(null)
  const writeTimer=useRef<ReturnType<typeof setTimeout>|null>(null)
  const restoredChapterRef=useRef('')
  const scrollRestoringRef=useRef(false)

  useEffect(()=>{
    let mounted=true
    void (async()=>{
      try{
        if(!id){setError('This story could not be found.');return}
        const {data:p,error:pe}=await supabase.from('vibe_publications').select('*')
          .eq('id',id).eq('status','published').maybeSingle()
        if(pe||!p||!isStoryPublication(p as VibePublication)){
          if(mounted)setError('This story is not available in VibeSchool Originals.')
          return
        }
        const {data:chaps,error:ce}=await supabase.from('vibe_chapters')
          .select('id,number,title,blocks,status,word_count,reading_time_min')
          .eq('publication_id',id).in('status',['published','locked'])
          .order('number',{ascending:true})
        if(ce)throw ce
        const available=(chaps||[]) as StoryChapter[]
        const {data:{user}}=await supabase.auth.getUser()
        let records:SavedProgress[]=[]
        if(user){
          const {data:rows}=await supabase.from('vibe_reading_progress')
            .select('chapter_id,progress_percent,reading_position,last_read_at')
            .eq('viewer_id',user.id).eq('publication_id',id)
            .order('last_read_at',{ascending:false})
          records=(rows||[]) as SavedProgress[]
        } else {
          try {
            const raw=window.localStorage.getItem(GUEST_KEY+id)
            const obj=raw?JSON.parse(raw) as SavedProgress:null
            if(obj && available.some(c=>c.id===obj.chapter_id)) records=[obj]
          }catch{/* guest storage may be disabled */}
        }
        if(!mounted)return
        setPublication(p as VibePublication)
        setChapters(available)
        setSaved(records)
        setSignedIn(Boolean(user))
        const explicit=initialRequest.current.id===id?initialRequest.current.chapter:null
        const requested=explicit&&available.find(c=>c.id===explicit)
        const resumed=initialRequest.current.id===id&&initialRequest.current.resume&&records.length?available.find(c=>c.id===records[0].chapter_id):null
        setActiveId(requested?.id||resumed?.id||available[0]?.id||'')
      }catch{
        if(mounted)setError('Unable to load this story. Please try again.')
      }finally{if(mounted)setLoading(false)}
    })()
    return()=>{mounted=false}
  },[id])

  const activeIndex=useMemo(()=>chapters.findIndex(c=>c.id===activeId),[chapters,activeId])
  const active=activeIndex>=0?chapters[activeIndex]:null
  const savedLatest=saved[0]||null
  const isFree=publication?.pricing.type==='free'
  const isReadable=Boolean(active && isFree && active.status==='published' && Array.isArray(active.blocks) && active.blocks.length)

  const persist=useCallback(async (position:Position)=>{
    if(!position.chapterId||!position.blockId) return
    const record={
      chapter_id:position.chapterId,
      progress_percent:position.percent,
      reading_position:{block_id:position.blockId,block_offset_percent:position.blockOffset,scroll_percent:position.percent},
      last_read_at:new Date().toISOString(),
    }
    if(!signedIn){
      try{window.localStorage.setItem(GUEST_KEY+id,JSON.stringify(record));setSync('Saved on this device')}
      catch{setSync('Reading position cannot be saved in this browser')}
      return
    }
    const {data,error:writeError}=await supabase.rpc('record_story_reading_progress',{
      publication_id_input:id,chapter_id_input:position.chapterId,
      progress_percent_input:position.percent,position_input:record.reading_position,
    })
    const result=data as {ok?:boolean}|null
    if(writeError||!result?.ok) {setSync('Unable to sync position. Check your connection.');return}
    setSync('Saved to your account')
  },[id,signedIn])

  // Restore a stable paragraph ID rather than a viewport-dependent scroll percentage.
  useEffect(()=>{
    if(mode!=='read'||loading||!active||!isReadable)return
    if(restoredChapterRef.current===active.id)return
    restoredChapterRef.current=active.id
    scrollRestoringRef.current=true
    const timer=window.setTimeout(()=>{
      const record=saved.find(r=>r.chapter_id===active.id)
      const idToRestore=record?.reading_position?.block_id
      const blocks=Array.from(document.querySelectorAll<HTMLElement>('[data-story-block-id]'))
      const target=blocks.find(el=>el.dataset.storyBlockId===idToRestore)
      if(target){
        const offset=clamp(Number(record?.reading_position?.block_offset_percent||0))
        const top=window.scrollY+target.getBoundingClientRect().top-110+target.offsetHeight*offset/100
        window.scrollTo({top:Math.max(0,top),behavior:'instant'})
      }else window.scrollTo({top:0,behavior:'instant'})
      positionRef.current=null
      window.setTimeout(()=>{scrollRestoringRef.current=false},150)
    },100)
    return()=>window.clearTimeout(timer)
  },[mode,loading,active,isReadable,saved])

  // Keep the latest paragraph and a within-paragraph offset; debounce writes while scrolling.
  useEffect(()=>{
    if(mode!=='read'||!isReadable||!active)return
    let scheduled=false
    function measure(){
      scheduled=false
      if(scrollRestoringRef.current)return
      const blocks=Array.from(document.querySelectorAll<HTMLElement>('[data-story-block-id]'))
      if(!blocks.length)return
      const readingLine=Math.min(window.innerHeight*0.42,380)
      let idx=0
      blocks.forEach((el,i)=>{if(el.getBoundingClientRect().top<=readingLine)idx=i})
      const chosen=blocks[idx]
      const rect=chosen.getBoundingClientRect()
      const part=clamp(((readingLine-rect.top)/Math.max(rect.height,1))*100)
      const final=idx===blocks.length-1&&rect.bottom<=window.innerHeight*.92
      const pct=final?100:Math.min(89,clamp(((idx+part/100)/blocks.length)*100))
      const snapshot={chapterId:active!.id,blockId:chosen.dataset.storyBlockId||'',percent:pct,blockOffset:part}
      positionRef.current=snapshot
      if(writeTimer.current)window.clearTimeout(writeTimer.current)
      writeTimer.current=window.setTimeout(()=>void persist(snapshot),1600)
    }
    function onScroll(){if(!scheduled){scheduled=true;window.requestAnimationFrame(measure)}}
    function onHidden(){if(document.visibilityState==='hidden'&&positionRef.current)void persist(positionRef.current)}
    window.addEventListener('scroll',onScroll,{passive:true})
    document.addEventListener('visibilitychange',onHidden)
    const starter=window.setTimeout(onScroll,330)
    return()=>{
      window.clearTimeout(starter)
      window.removeEventListener('scroll',onScroll)
      document.removeEventListener('visibilitychange',onHidden)
      if(writeTimer.current)window.clearTimeout(writeTimer.current)
      if(positionRef.current?.chapterId===active.id)void persist(positionRef.current)
    }
  },[mode,active,isReadable,persist])

  function changeChapter(next:string){
    if(!chapters.some(c=>c.id===next))return
    if(positionRef.current)void persist(positionRef.current)
    positionRef.current=null
    restoredChapterRef.current=''
    setActiveId(next)
    setSync('')
    router.replace(storyReaderHref(id,next),{scroll:false})
  }
  function exitReader(){
    if(positionRef.current)void persist(positionRef.current)
    router.push('/learn/stories')
  }

  if(loading)return <main className={css.page}><div role="status" className={css.message}>Opening your story…</div></main>
  if(error||!publication)return <main className={css.page}><div className={css.library}><Link className={css.smallLink} href="/learn/stories"><ArrowLeft size={15}/> Stories & Series</Link><p role="alert" className={css.message}>{error||'Story not found'}</p></div></main>
  const bookTitle=publication.title||'Untitled story'
  const image=safeStoryImage(publication.cover_url)

  if(mode==='detail')return <main className={css.page}>
    <header className={css.header}><div className={css.headerInner}><Link className={css.backLink} href="/learn/stories"><ArrowLeft size={17}/> Stories & Series</Link><Link className={css.wordmark} href="/learn/stories"><BookOpen size={19}/> VibeSchool <strong>Originals</strong></Link></div></header>
    <div className={css.bookDetail}>
      <div className={css.detailCover}>{image?<img src={image} alt={'Cover of '+bookTitle}/>:<div className={css.coverFallback}><BookOpen size={70}/> VibeSchool Originals</div>}</div>
      <div className={css.detailInfo}>
        <span className={css.eyebrow}>{publication.series_name||'VIBESCHOOL ORIGINALS'} {publication.series_number?' · BOOK '+publication.series_number:''}</span>
        <h1 className={css.detailTitle}>{bookTitle}</h1>
        {publication.subtitle&&<p className={css.detailSubtitle}>{publication.subtitle}</p>}
        <p className={css.detailDescription}>{publication.description||'Discover this VibeSchool Originals story.'}</p>
        <p className={css.detailMeta}>{chapters.length} chapters · {String(publication.genre||'Story').replace(/_/g,' ')}</p>
        {isFree&&chapters.length>0 ?
          <Link className={css.primaryButton} href={storyReaderHref(id,savedLatest?.chapter_id||null,Boolean(savedLatest))}>
            <BookOpen size={18}/>{savedLatest?'Continue Reading':'Start Reading'} <ArrowRight size={17}/>
          </Link>
        :<Link className={css.primaryButton} href={'/global/read/publication/'+encodeURIComponent(id)}>Open original publication <ArrowRight size={17}/></Link>}
        {publication.series_name&&<Link className={css.smallLink} href={'/learn/stories?series='+encodeURIComponent(publication.series_name)}>Explore this series <ArrowRight size={15}/></Link>}
        <section className={css.contents}><h2>Chapters</h2><div className={css.chapterList}>{chapters.map(ch=><Link key={ch.id} className={css.chapterEntry}
          href={isFree?storyReaderHref(id,ch.id):'/global/read/publication/'+encodeURIComponent(id)}>
          <span className={css.chapterNumber}>{String(ch.number).padStart(2,'0')}</span><span><strong>{ch.title||'Chapter '+ch.number}</strong><small>{ch.reading_time_min||1} min read {saved.some(p=>p.chapter_id===ch.id)?' · Started':''}</small></span><ChevronRight size={18}/>
        </Link>)}</div></section>
      </div>
    </div>
  </main>

  return <main className={css.page+' '+(theme==='night'?css.night:'')}>
    <header className={css.readerHeader}><div className={css.readerTop}>
      <button type="button" onClick={exitReader} className={css.readerBack}><ArrowLeft size={17}/> Save & Exit</button>
      <span className={css.readerBookTitle}>{bookTitle}</span>
      <div className={css.readerControls}>
        <button type="button" aria-label="Change text size" onClick={()=>setFontScale(v=>v>=1.3?1:v+.15)}><Type size={18}/> A{fontScale>1?' +':''}</button>
        <button type="button" aria-label="Switch reading theme" onClick={()=>setTheme(t=>t==='paper'?'night':'paper')}>{theme==='paper'?<Moon size={18}/>:<Sun size={18}/>}</button>
      </div>
    </div></header>
    <div className={css.readerGrid}>
      <aside className={css.readerSidebar} aria-label="Book chapters">
        <strong>Contents</strong>
        {chapters.map(ch=><button type="button" key={ch.id} aria-current={ch.id===activeId?'page':undefined}
          className={ch.id===activeId?css.contentsActive:css.contentsButton} onClick={()=>changeChapter(ch.id)}>
          <span>{ch.number}. {ch.title||'Chapter '+ch.number}</span>
          {saved.some(s=>s.chapter_id===ch.id)&&<BookmarkCheck size={14}/>}
        </button>)}
      </aside>
      <article className={css.readingPaper} aria-label="Story chapter">
        {active?<><div className={css.chapterIntro}><span>CHAPTER {active.number}</span><h1>{active.title||'Chapter '+active.number}</h1></div>
          {isReadable?<div className={css.storyProse} style={{fontSize:fontScale+'em'}}>
            {(active.blocks||[]).map((block,i)=><div key={block.id||i} data-story-block-id={block.id||String(i)} className={css.storyBlock}><StoryBlock block={block}/></div>)}
          </div>:<div role="status" className={css.message}>This chapter is not available to read here. Use the original publication page if access is required.</div>}
          <div className={css.chapterFooter}><p>{sync|| (signedIn?'Your position saves automatically as you read.':'Your position is saved on this device until you sign in.')}</p>
          <div className={css.chapterNav}>
            <button type="button" disabled={activeIndex<=0} onClick={()=>changeChapter(chapters[activeIndex-1].id)}><ChevronLeft size={16}/> Previous</button>
            {activeIndex<chapters.length-1?<button type="button" onClick={()=>changeChapter(chapters[activeIndex+1].id)}>Next Chapter <ChevronRight size={16}/></button>:
              <Link href="/learn/stories">Discover More Stories <ArrowRight size={16}/></Link>}
          </div></div></>:<div className={css.message}>No published chapters are available yet.</div>}
      </article>
    </div>
  </main>
}

function readableKey(value:boolean){return value}
