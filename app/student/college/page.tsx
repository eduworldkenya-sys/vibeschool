'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import compact from '@/components/student/LearnerCompact.module.css'
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

  const saved = papers.find(paper => paperCode(paper) === savedPaper)
  const studyHref = '/learn/kasneb-cpa'
  const canStudy = courseLive && savedPaperLive
  return <div className={compact.screen}>
    <h1>CPA study space</h1>
    {loading ? <p role="status">Opening CPA catalogue…</p> : <>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <section className={compact.panel} aria-label="Selected paper">
        <h2>{saved?.title ?? 'Select a paper'}</h2>
        {saved?.qualification_level && <p className={compact.muted}>{saved.qualification_level}</p>}
        {canStudy
          ? <Link className={compact.primary} href={studyHref}>Open study space <span aria-hidden="true">→</span></Link>
          : saved && <p className={compact.muted}>Lessons in preparation</p>}
      </section>
      <div className={compact.grid}>
        {canStudy && <Link className={compact.action} href={studyHref + '?view=practice'}>Self-evaluation</Link>}
        {canStudy && <Link className={compact.action} href={studyHref + '?view=progress'}>Progress</Link>}
        <Link className={compact.action} href="/student/college/tasks">Study tasks</Link>
        <Link className={compact.action} href="/student/college/profile">My profile</Link>
      </div>
      <details className={compact.panel} open={savedPaper ? undefined : true}>
        <summary>{savedPaper ? 'Change paper' : 'Choose a CPA paper'}</summary>
        <div style={{display:'grid',gap:8}}>
          <label>CPA level
            <select value={level} disabled={!!error} onChange={event => {
              const next = event.target.value
              setLevel(isLevel(next) ? next : '')
              setSelectedPaper('')
              setNotice('')
            }}>
              <option value="">Choose your level</option>
              {LEVELS.filter(item => papers.some(paper => paper.qualification_level === item))
                .map(item => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>Paper or requirement
            <select value={selectedPaper} disabled={!level || !!error}
              onChange={event => { setSelectedPaper(event.target.value); setNotice('') }}>
              <option value="">Choose your paper</option>
              {availablePapers.map(paper =>
                <option key={paper.slug} value={paperCode(paper)}>{paper.title}</option>)}
            </select>
          </label>
          {advanced && <p className={compact.muted}>Codes follow the April 2026 booklet. Confirm your registration code with KASNEB.</p>}
          {chosen?.qualification_requirement && chosen.qualification_requirement !== 'required' &&
            <p className={compact.muted}>{chosen.qualification_requirement.replaceAll('_', ' ')}</p>}
          <button className={compact.primary} type="button" disabled={!selectedIsValid || saving || !!error} onClick={savePaper}>
            {saving ? 'Saving…' : 'Save my paper'}
          </button>
        </div>
      </details>
    </>}
  </div>
}
