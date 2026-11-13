'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { BookOpen, ArrowLeft, ArrowRight, BookmarkCheck, LibraryBig, Search, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { isStoryPublication, safeStoryImage, storyLandingHref, storyReaderHref, orderSeriesBooks, STORY_GUEST_KEY, type StoryPublication } from '@/lib/learn/storyPublications'
import css from './Originals.module.css'

type Progress = { publication_id:string; chapter_id:string; progress_percent:number; last_read_at:string }
type ChapterLite = { id:string; number:number; title:string|null }
type Resume = Progress & { story:StoryPublication; chapter:ChapterLite|null }

function Cover({story}:{story:StoryPublication}) {
  const url=safeStoryImage(story.cover_url)
  return <div className={css.cover}>{url?<img src={url} alt={story.title ? 'Cover of '+story.title : 'Story cover'} loading="lazy"/>:<div className={css.coverFallback}><BookOpen size={38}/><span>VibeSchool Originals</span></div>}</div>
}

export function StoriesHub() {
  const searchParams=useSearchParams()
  const selectedSeries=searchParams.get('series')
  const [stories,setStories]=useState<StoryPublication[]>([])
  const [resume,setResume]=useState<Resume[]>([])
  const [search,setSearch]=useState('')
  const [genre,setGenre]=useState('all')
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [signedIn,setSignedIn]=useState(false)

  useEffect(()=>{
    let mounted=true
    void (async()=>{
      try {
        const all:StoryPublication[]=[]
        // Pagination follows the existing Learn catalogue and never substitutes draft content.
        for(let page=0;page<25;page++){
          const {data,error}=await supabase.from('vibe_publications')
            .select('id,title,subtitle,description,cover_url,format,genre,series_name,series_number,published_at,pricing,chapter_count')
            .eq('status','published').in('format',['ebook','vibechronicles'])
            .order('id',{ascending:true}).range(page*200,(page+1)*200-1)
          if(error) throw error
          if(!mounted) return
          all.push(...((data||[]) as StoryPublication[]))
          if((data||[]).length<200) break
        }
        const published=all.filter(isStoryPublication).sort((a,b)=>String(b.published_at||'').localeCompare(String(a.published_at||'')))
        if(!mounted) return
        setStories(published)
        const {data:{user}}=await supabase.auth.getUser()
        if(!mounted) return
        setSignedIn(Boolean(user))
        if(!published.length) return
        let progress:Progress[]=[]
        if(user){
          const ids=published.map(s=>s.id)
          const {data:progressRows,error:progressError}=await supabase.from('vibe_reading_progress')
            .select('publication_id,chapter_id,progress_percent,last_read_at')
            .eq('viewer_id',user.id).in('publication_id',ids)
            .order('last_read_at',{ascending:false}).limit(200)
          if(progressError) return
          progress=(progressRows||[]) as Progress[]
        }else{
          // A visitor should see the same Continue Reading shelf without an account.
          for(const story of published){
            try{
              const raw=window.localStorage.getItem(STORY_GUEST_KEY+story.id)
              if(!raw)continue
              const item=JSON.parse(raw)
              if(typeof item?.chapter_id==='string' && typeof item?.progress_percent==='number' && typeof item?.last_read_at==='string'){
                progress.push({publication_id:story.id,chapter_id:item.chapter_id,
                  progress_percent:Math.max(0,Math.min(100,item.progress_percent)),last_read_at:item.last_read_at})
              }
            }catch{/* Local storage may be disabled or a guest entry may be invalid. */}
          }
          progress.sort((a,b)=>b.last_read_at.localeCompare(a.last_read_at))
        }
        const found=new Set<string>()
        const recent=progress.filter(row=>{
          if(found.has(row.publication_id)) return false
          found.add(row.publication_id);return true
        })
        const {data:chaps}=recent.length
          ? await supabase.from('vibe_chapters').select('id,number,title').in('id',recent.map(p=>p.chapter_id))
          : {data:[] as ChapterLite[]}
        const chapById=new Map(((chaps||[]) as ChapterLite[]).map(c=>[c.id,c]))
        const byId=new Map(published.map(s=>[s.id,s]))
        if(mounted) setResume(recent.flatMap(p=>{
          const story=byId.get(p.publication_id)
          return story?[{...p,story,chapter:chapById.get(p.chapter_id)||null}]:[]
        }))
      }catch{if(mounted)setError('Stories are temporarily unavailable. Please try again.')}
      finally{if(mounted)setLoading(false)}
    })()
    return()=>{mounted=false}
  },[])

  const series=useMemo(()=>Array.from(new Set(stories.map(s=>s.series_name?.trim()).filter((s):s is string=>Boolean(s)))).sort(),[stories])
  const genres=useMemo(()=>Array.from(new Set(stories.map(s=>String(s.genre||'other')))).sort(),[stories])
  const visible=useMemo(()=>stories.filter(story=>{
    if(selectedSeries && story.series_name?.trim()!==selectedSeries) return false
    if(genre!=='all' && story.genre!==genre) return false
    const q=search.toLowerCase().trim()
    return !q || [story.title,story.subtitle,story.description,story.series_name,story.genre].some(x=>String(x||'').toLowerCase().includes(q))
  }),[stories,selectedSeries,search,genre])
  const displayed=useMemo(()=>selectedSeries ? orderSeriesBooks(visible) : visible,[visible,selectedSeries])

  return <main className={css.page} id="main-content">
    <div className={css.library}>
      <div className={css.eyebrow}>STORIES & SERIES</div>
      <h1 className={css.heroTitle}>{selectedSeries || 'Stories worth getting lost in.'}</h1>
      <p className={css.heroSubtitle}>{selectedSeries ? 'Explore every published book in this series.' : 'Discover original fiction, follow your favourite characters and continue right where you left off.'}</p>
      {selectedSeries && <Link href="/learn/stories" className={css.smallLink}><ArrowLeft size={15}/> All stories and series</Link>}
      {resume.length>0 && <section aria-labelledby="continue-title" className={css.continueSection}>
        <div className={css.sectionHead}><h2 id="continue-title">Continue Reading</h2><span>{signedIn?'Saved to your account':'Saved on this device'}</span></div>
        <div className={css.resumeList}>{resume.slice(0,6).map(item=><div className={css.resumeCard} key={item.publication_id}>
          <Link href={storyLandingHref(item.story.id)} className={css.resumeCover}><Cover story={item.story}/></Link>
          <div className={css.resumeInfo}><span className={css.goldLabel}>PICK UP WHERE YOU LEFT OFF</span>
            <strong>{item.story.title}</strong>
            <span>{item.chapter ? 'Chapter '+item.chapter.number+' · '+(item.chapter.title||'Untitled') : 'Continue your book'}</span>
            <div className={css.progressTrack} role="progressbar" aria-label="Current chapter progress" aria-valuenow={item.progress_percent} aria-valuemin={0} aria-valuemax={100}>
              <div style={{width:Math.max(0,Math.min(100,item.progress_percent))+'%'}}/>
            </div>
          </div>
          <Link className={css.resumeButton} href={storyReaderHref(item.story.id,item.chapter_id,true)}><BookmarkCheck size={17}/> Resume</Link>
        </div>)}</div>
      </section>}
      <div className={css.sectionHead}><h2>{selectedSeries?'Books in this series':'Explore Stories'}</h2><span>{loading?'Loading…':visible.length+' available'}</span></div>
      <label className={css.searchBox}><Search size={18}/><input aria-label="Search stories" type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search stories, characters or series…"/></label>
      <div className={css.pills}>
        <button type="button" className={genre==='all'?css.pillActive:css.pill} onClick={()=>setGenre('all')}>All genres</button>
        {genres.map(g=><button type="button" key={g} className={genre===g?css.pillActive:css.pill} onClick={()=>setGenre(g)}>{g.replace(/_/g,' ')}</button>)}
      </div>
      {error && <div role="alert" className={css.message}>{error}</div>}
      {loading ? <div role="status" className={css.message}>Opening the story library…</div>
      : !error && visible.length===0 ? <div className={css.message}>No published stories match this selection.</div>
      : !error && <div className={css.bookGrid}>{displayed.map(story=><Link href={storyLandingHref(story.id)} className={css.bookCard} key={story.id}>
        <Cover story={story}/><div className={css.bookBody}>
          <strong>{story.title||'Untitled story'}</strong>
          <span>{story.series_name ? story.series_name + (story.series_number?' · Book '+story.series_number:'') : String(story.genre||'Story')}</span>
          <p>{story.description||'Open the book and discover its chapters.'}</p>
          <span className={css.openLabel}>Open story <ChevronRight size={15}/></span>
        </div>
      </Link>)}</div>}
      {!selectedSeries && series.length>0 && <section className={css.seriesSection} aria-labelledby="series-title">
        <div className={css.sectionHead}><h2 id="series-title">Explore Series</h2><span>{series.length} collections</span></div>
        <div className={css.seriesGrid}>{series.map(name=><Link key={name} href={'/learn/stories?series='+encodeURIComponent(name)} className={css.seriesCard}>
          <LibraryBig size={23}/><div><strong>{name}</strong><span>{stories.filter(s=>s.series_name?.trim()===name).length} published book(s)</span></div><ArrowRight size={18}/>
        </Link>)}</div>
      </section>}
      {!signedIn && !loading && <p className={css.subtle}>Stories can be explored without signing in. Sign in to save and sync your reading position across devices.</p>}
    </div>
  </main>
}
