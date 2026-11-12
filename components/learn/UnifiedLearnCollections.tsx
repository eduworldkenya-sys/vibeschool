'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, BookOpen, BookText, BriefcaseBusiness, ChevronRight, FileText, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import styles from './SchoolLearnLibrary.module.css'

type Publication = {
  id: string
  title: string
  description: string | null
  format: string
  cbc_grade: string | null
  cbc_subject: string | null
}
type Course = {
  id: string
  slug: string
  title: string
  institution: string | null
  level: string | null
  domain: string
  status: string
  modules_count: number | null
}

function PublicationDestination({publication}:{publication:Publication}) {
  const href = publication.format === 'vibetextbook'
    ? '/read/textbook/' + encodeURIComponent(publication.id)
    : '/global/read/publication/' + encodeURIComponent(publication.id)
  const category = publication.format === 'vibetextbook' ? 'Textbook'
    : publication.format === 'vibepress' ? 'Article'
    : publication.format === 'ebook' ? 'Ebook'
    : publication.format === 'vibechronicles' ? 'Story'
    : publication.format === 'vibevoice' ? 'Audio publication'
    : publication.format === 'vibescripture' ? 'Scripture'
    : 'Publication'
  return <Link className={styles.resource} href={href}>
    <span className={styles.resourceIcon}>{publication.format === 'vibetextbook' ? <BookText size={23} aria-hidden="true"/> : <FileText size={23} aria-hidden="true"/>}</span>
    <span className={styles.resourceBody}>
      <strong>{publication.title}</strong>
      <p>{publication.description || [publication.cbc_grade, publication.cbc_subject].filter(Boolean).join(' · ') || 'Open this published resource'}</p>
      <span className={styles.resourceMeta}>{category}{publication.cbc_grade ? ' · ' + publication.cbc_grade : ''}</span>
    </span>
    <ChevronRight size={19} aria-hidden="true"/>
  </Link>
}

export default function UnifiedLearnCollections({view}:{view:'reading'|'courses'}) {
  const [search,setSearch] = useState('')
  const [kind,setKind] = useState('all')
  const [items,setItems] = useState<Publication[]>([])
  const [courses,setCourses] = useState<Course[]>([])
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState(false)
  const [truncated,setTruncated] = useState(false)

  useEffect(()=>{
    let active=true
    setLoading(true);setError(false);setItems([]);setCourses([]);setTruncated(false);setSearch('');setKind('all')
    void (async()=>{
      try {
        if (view==='courses') {
          const {data,error}=await supabase.from('courses')
            .select('id,slug,title,institution,level,domain,status,modules_count')
            .order('title',{ascending:true})
          if(error) throw error
          if(active) setCourses(((data??[]) as Course[]).filter(item=>item.status==='live'||item.status==='coming_soon'))
        } else {
          const all:Publication[]=[]
          const size=200
          for(let page=0;page<25;page++){
            const {data,error}=await supabase.from('vibe_publications')
              .select('id,title,description,format,cbc_grade,cbc_subject')
              .eq('status','published')
              .order('id',{ascending:true})
              .range(page*size,(page+1)*size-1)
            if(error) throw error
            if(!active) return
            all.push(...(data??[]) as Publication[])
            if((data??[]).length<size) break
            if(page===24) setTruncated(true)
          }
          if(active) setItems(all.filter(item=>[
            'vibetextbook','ebook','vibepress','vibechronicles','vibevoice','vibescripture',
          ].includes(item.format)))
        }
      }catch{
        if(active) setError(true)
      }finally{
        if(active) setLoading(false)
      }
    })()
    return ()=>{active=false}
  },[view])

  const visible=useMemo(()=>{
    const needle=search.trim().toLowerCase()
    return items.filter(item=>kind==='all'||item.format===kind)
      .filter(item=>!needle||[item.title,item.description??'',item.cbc_grade??'',item.cbc_subject??''].join(' ').toLowerCase().includes(needle))
  },[items,search,kind])
  const filteredCourses=useMemo(()=>{
    const needle=search.trim().toLowerCase()
    return courses.filter(course=>(kind==='all'||course.domain===kind) &&
      (!needle||[course.title,course.institution??'',course.level??'',course.domain].join(' ').toLowerCase().includes(needle)))
  },[courses,search,kind])

  const isReading=view==='reading'
  const labels=isReading
    ? [['all','All publications'],['vibetextbook','Textbooks'],['ebook','Ebooks'],['vibepress','Articles'],['vibechronicles','Stories'],['vibevoice','Audio'],['vibescripture','Scripture']]
    : [['all','All courses'],['health','Health'],['tech','Technology'],['education','Education'],['trade','Trades']]
  return <section aria-label={isReading?'Published reading library':'Courses library'}>
    <div className={styles.kicker}>{isReading?'Published reading':'Further learning'}</div>
    <h1 className={styles.pageTitle}>{isReading?'Books, articles and other published reading':'College and career courses'}</h1>
    <p className={styles.description}>{isReading
      ? 'Discover released textbooks, ebooks and other public reading in one place. Open each publication in its existing reader.'
      : 'Explore existing courses and institutions. Only courses marked live can be opened.'}</p>
    <label className={styles.searchbox}><Search size={18} aria-hidden="true"/>
      <input type="search" value={search} onChange={e=>setSearch(e.target.value)}
        placeholder={isReading?'Search titles, subjects or grades…':'Search courses or institutions…'}
        aria-label={isReading?'Search published reading':'Search courses'}/>
    </label>
    <nav aria-label="Content type" className={styles.gradeTabs}>
      {labels.map(([id,name])=><button type="button" key={id}
        className={styles.gradeButton+' '+(kind===id?styles.gradeActive:'')}
        aria-pressed={kind===id} onClick={()=>setKind(id)}>{name}</button>)}
    </nav>
    <div className={styles.sectionHead}><h2>{isReading?'Available publications':'Available courses'}</h2>
      <span>{loading?'Loading…':(isReading?visible.length:filteredCourses.length)+' shown'}</span></div>
    {error && <div className={styles.alert} role="alert">This catalogue could not load. Try reopening Learn. No unpublished material has been substituted.</div>}
    {loading ? <div className={styles.empty} role="status">Opening the published catalogue…</div>
    : !error && isReading && visible.length>0 ? <div className={styles.resourceList}>{visible.map(item=><PublicationDestination key={item.id} publication={item}/>)}</div>
    : !error && !isReading && filteredCourses.length>0 ? <div className={styles.resourceList}>
      {filteredCourses.map(course=>course.status==='live'
        ? <Link key={course.id} className={styles.resource} href={'/learn/'+encodeURIComponent(course.slug)}>
            <span className={styles.resourceIcon}><BriefcaseBusiness size={22} aria-hidden="true"/></span>
            <span className={styles.resourceBody}><strong>{course.title}</strong>
              <p>{[course.institution,course.level].filter(Boolean).join(' · ')||'Live course'}</p>
              <span className={styles.resourceMeta}>Open course · {course.modules_count??'—'} modules</span></span>
            <ArrowRight size={19} aria-hidden="true"/></Link>
        : <div key={course.id} className={styles.resource} aria-disabled="true">
            <span className={styles.resourceIcon}><BookOpen size={22} aria-hidden="true"/></span>
            <span className={styles.resourceBody}><strong>{course.title}</strong>
              <p>{[course.institution,course.level].filter(Boolean).join(' · ')||'Course in review'}</p>
              <span className={styles.resourceMeta}>In review · not yet live</span></span>
          </div>)}</div>
    : !error && <div className={styles.empty}>No released content matches this selection.</div>}
    {truncated && <p className={styles.alert}>This collection contains more results than the current view can show. Refine your search or category.</p>}
    <p className={styles.tinyNote}>Publication rights, course enrollment and reader permissions remain enforced by the existing destination.</p>
  </section>
}
