'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useStudent } from '@/lib/student-context'
import { supabase } from '@/lib/supabase'

type Level = 'Foundation' | 'Intermediate' | 'Advanced'
const LEVELS: readonly Level[] = ['Foundation', 'Intermediate', 'Advanced']
type Paper = {
  slug: string
  title: string
  qualification_level: string | null
  qualification_requirement: string | null
  sequence_number: number
  has_published_lessons: boolean
}
type Path = {
  education_stage: string
  qualification_code: string
  qualification_level: string | null
  paper_code: string | null
}

function isLevel(value: string | null): value is Level {
  return LEVELS.some(level => level === value)
}
function paperCode(paper: Paper) {
  return paper.slug.toUpperCase()
}

export default function CollegeLearnerHome() {
  const { identity } = useStudent()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [courseLive, setCourseLive] = useState(false)
  const [papers, setPapers] = useState<Paper[]>([])
  const [level, setLevel] = useState<Level | ''>('')
  const [selectedPaper, setSelectedPaper] = useState('')
  const [savedPaper, setSavedPaper] = useState('')

  useEffect(() => {
    if (!identity?.profileId) return
    let active = true
    setLoading(true)
    setError('')
    void (async () => {
      try {
        const [profileResult, catalogueResult] = await Promise.all([
          supabase.from('learner_education_paths')
            .select('education_stage,qualification_code,qualification_level,paper_code')
            .eq('user_id', identity.profileId).maybeSingle(),
          supabase.rpc('get_my_cpa_paper_catalogue'),
        ])
        if (profileResult.error) throw new Error('Your professional study profile could not be opened.')
        const profile = profileResult.data as Path | null
        if (!profile || profile.education_stage !== 'post_secondary' || profile.qualification_code !== 'CPA')
          throw new Error('Your CPA study pathway needs verification.')
        if (catalogueResult.error || !catalogueResult.data ||
          !Array.isArray(catalogueResult.data.papers))
          throw new Error('The KASNEB CPA catalogue is temporarily unavailable.')
        if (!active) return
        const listed = (catalogueResult.data.papers as Paper[]).filter(paper =>
          typeof paper.slug === 'string' &&
          typeof paper.title === 'string' &&
          typeof paper.sequence_number === 'number' &&
          (paper.qualification_level === 'Foundation' ||
            paper.qualification_level === 'Intermediate' ||
            paper.qualification_level === 'Advanced')
        )
        if (!listed.length) throw new Error('CPA papers are not yet available to select.')
        setPapers(listed)
        setCourseLive(catalogueResult.data.status === 'live')
        const currentLevel = isLevel(profile.qualification_level) ? profile.qualification_level : ''
        const code = listed.some(paper => paper.qualification_level === currentLevel &&
          paperCode(paper) === profile.paper_code) ? profile.paper_code ?? '' : ''
        setLevel(currentLevel)
        setSelectedPaper(code)
        setSavedPaper(code)
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'CPA learning is unavailable. Please retry.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [identity?.profileId])

  const availablePapers = papers.filter(paper => paper.qualification_level === level)
  const chosen = availablePapers.find(paper => paperCode(paper) === selectedPaper)
  const selectedIsValid = !!chosen && !!level && paperCode(chosen) === selectedPaper
  const advanced = level === 'Advanced'
  const savedPaperLive = papers.some(p => paperCode(p) === savedPaper && p.has_published_lessons)

  async function savePaper() {
    if (!identity?.profileId || !level || !selectedIsValid || saving || loading || error) return
    setSaving(true)
    setNotice('')
    const { data, error: saveError } = await supabase.from('learner_education_paths')
      .update({
        qualification_level: level,
        paper_code: selectedPaper,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', identity.profileId)
      .eq('qualification_code', 'CPA')
      .select('paper_code')
      .single()
    setSaving(false)
    if (saveError || data?.paper_code !== selectedPaper) {
      setError('Your paper selection could not be saved. Please reload and try again.')
      return
    }
    setSavedPaper(selectedPaper)
    setNotice('Your CPA study paper has been saved.')
  }

  const card = { background: 'var(--vs-card)', border: '1px solid var(--vs-border)', borderRadius: 18, padding: 18 }
  const control = { width: '100%', minHeight: 48, borderRadius: 12, border: '1px solid var(--vs-border)', background: 'var(--vs-card)', color: 'var(--vs-text)', padding: '10px 12px', fontSize: 14 }

  return <div style={{maxWidth:760,margin:'0 auto',display:'grid',gap:16,padding:'10px 0 30px'}}>
    <header style={{display:'flex',justifyContent:'space-between',alignItems:'start',gap:12}}>
      <div>
        <p style={{fontSize:12,color:'var(--vs-muted)',fontWeight:700}}>College &amp; Professional Studies</p>
        <h1 style={{fontSize:'clamp(24px,5vw,30px)',margin:'8px 0'}}>Hello, {identity?.firstName || 'there'}</h1>
        <p style={{color:'var(--vs-muted)',fontSize:14}}>Certified Public Accountants · KASNEB</p>
      </div>
      <Link href="/student/college/profile" style={{color:'var(--vs-accent)',fontWeight:700,fontSize:13}}>My profile</Link>
    </header>
    <section style={card} aria-label="CPA study selection">
      <h2 style={{fontSize:19,marginBottom:8}}>Choose your CPA paper</h2>
      <p style={{fontSize:13,lineHeight:1.6,color:'var(--vs-muted)',marginBottom:18}}>
        Choose the paper you are preparing for. No school grade, class timetable or teacher is required.
      </p>
      {loading ? <p role="status">Opening your CPA catalogue…</p> : <>
        {error && <p role="alert" style={{color:'var(--vs-error)',marginBottom:12}}>{error}</p>}
        {notice && <p role="status" style={{color:'var(--vs-accent)',marginBottom:12}}>{notice}</p>}
        <div style={{display:'grid',gap:12}}>
          <label style={{display:'grid',gap:7,fontSize:13,fontWeight:700}}>CPA level
            <select style={control} value={level} disabled={!!error} onChange={event => {
              const next = event.target.value
              setLevel(isLevel(next) ? next : '')
              setSelectedPaper('')
              setNotice('')
            }}>
              <option value="">Choose your level</option>
              {LEVELS.filter(item => papers.some(paper => paper.qualification_level === item))
                .map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label style={{display:'grid',gap:7,fontSize:13,fontWeight:700}}>Paper or requirement
            <select style={control} value={selectedPaper} disabled={!level || !!error}
              onChange={event => { setSelectedPaper(event.target.value); setNotice('') }}>
              <option value="">Choose your paper</option>
              {availablePapers.map(paper =>
                <option key={paper.slug} value={paperCode(paper)}>{paper.title}</option>)}
            </select>
          </label>
          {advanced && <p style={{fontSize:12,lineHeight:1.55,color:'var(--vs-muted)'}}>
            Advanced paper codes reflect the dated April 2026 KASNEB qualification booklet.
            Some codes differ from the undated KASNEB website. Confirm your examination registration code directly with KASNEB.
          </p>}
          {chosen?.qualification_requirement && chosen.qualification_requirement !== 'required' &&
            <p style={{fontSize:12,lineHeight:1.55,color:'var(--vs-muted)'}}>
              This is listed as {chosen.qualification_requirement.replaceAll('_',' ')} in the source catalogue.
              Check your specific qualification requirements before registering.
            </p>}
          <button type="button" disabled={!selectedIsValid || saving || !!error}
            onClick={savePaper} style={{
              border:0,borderRadius:12,minHeight:48,background:'var(--vs-accent)',
              color:'var(--vs-on-accent)',fontWeight:800,
              opacity:!selectedIsValid || saving || !!error ? 0.5 : 1,
            }}>
            {saving ? 'Saving…' : savedPaper && savedPaper === selectedPaper ? 'Save this paper' : 'Save my paper'}
          </button>
        </div>
      </>}
    </section>
    <section style={card}>
      <p style={{fontSize:12,fontWeight:750,color:'var(--vs-muted)',marginBottom:8}}>MY STUDY SPACE</p>
      <h2 style={{fontSize:19,marginBottom:10}}>
        {savedPaper ? papers.find(paper => paperCode(paper) === savedPaper)?.title ?? 'CPA study' : 'CPA independent study'}
      </h2>
      {courseLive && savedPaperLive
        ? <p style={{fontSize:13,color:'var(--vs-muted)',marginBottom:14}}>
            Open your available CPA learning materials. Only released lessons are shown.
          </p>
        : <p style={{fontSize:13,color:'var(--vs-muted)',lineHeight:1.7}}>
            Learning materials for this paper are in preparation. You can save your paper now and return when lessons are published. School-grade lessons are not part of this study space.
          </p>}
      {courseLive && savedPaperLive &&
        <Link href="/learn/kasneb-cpa" style={{display:'inline-flex',padding:'12px 16px',borderRadius:11,
          background:'var(--vs-accent)',color:'var(--vs-on-accent)',textDecoration:'none',fontWeight:800}}>
          Open CPA learning
        </Link>}
    </section>
    <p style={{fontSize:11,color:'var(--vs-muted)',lineHeight:1.6}}>
      VibeSchool provides independent CPA preparation. It is not an official KASNEB examination centre or awarding body.
    </p>
  </div>
}
