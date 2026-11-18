'use client'

import { useEffect, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { subjectKey } from '@/lib/learn/schoolCatalog'
import { buildTextbookOutline, type CurriculumOutlineRow } from '@/lib/learn/textbookOutline'
import styles from './SchoolLearnLibrary.module.css'

type State = { scope: string; status: 'loading' | 'ready' | 'unavailable'; rows: CurriculumOutlineRow[] }

/** A book shell is always available; its index is drawn only from readable canonical curriculum metadata. */
export default function SubjectTextbookOutline({ grade, subject }: { grade: string; subject: string }) {
  const scope = JSON.stringify([grade, subject])
  const [state, setState] = useState<State>({ scope, status: 'loading', rows: [] })
  useEffect(() => {
    let active = true
    const finish = (status: State['status'], rows: CurriculumOutlineRow[] = []) => {
      if (active) setState({ scope, status, rows })
    }
    finish('loading')
    async function load() {
      try {
        // Only global taxonomy rows: never bind a school subject by label.
        const { data: subjects, error: subjectError } = await supabase.from('subjects')
          .select('id,name').is('school_id', null).order('id').limit(1000)
        if (subjectError) throw subjectError
        const matches = (subjects ?? []).filter(item => subjectKey(item.name) === subjectKey(subject))
        if (matches.length !== 1) return finish('unavailable')
        const rows: CurriculumOutlineRow[] = []
        const size = 200
        for (let page = 0; ; page++) {
          const { data, error } = await supabase.from('cbc_strands')
            .select('id,name,sub_strand').eq('grade', grade).eq('subject_id', matches[0].id)
            .order('name').order('sub_strand').order('id').range(page * size, (page + 1) * size - 1)
          if (!active) return
          if (error) throw error
          rows.push(...(data ?? []))
          if ((data ?? []).length < size) break
        }
        finish('ready', rows)
      } catch {
        finish('unavailable')
      }
    }
    void load()
    return () => { active = false }
  }, [grade, subject, scope])
  const current = state.scope === scope ? state : { status: 'loading' as const, rows: [] }
  const chapters = buildTextbookOutline(current.rows)
  return <section className={styles.detailPanel} aria-label={grade + ' ' + subject + ' textbook'}>
    <div className={styles.sectionHead}><h2><BookOpen size={19} aria-hidden="true" /> {grade} {subject}</h2>
      <span>Textbook</span></div>
    <div className={styles.sectionHead}><h3>Contents</h3><span>{current.status === 'ready' ? chapters.length + ' chapters' : 'Book outline'}</span></div>
    {current.status === 'loading' ? <p role="status">Opening contents…</p> :
      chapters.length ? <ol className={styles.resourceList}>{chapters.map(chapter =>
        <li key={chapter.id}><details className={styles.resourceBody}>
          <summary><strong>{chapter.title}</strong> · {chapter.topics.length} topics</summary>
          {chapter.topics.length ? <ul>{chapter.topics.map(topic => <li key={topic.id}>{topic.title}</li>)}</ul> : <p>Topics not listed yet.</p>}
        </details></li>)}</ol> :
      <p role="status">{current.status === 'unavailable' ? 'Contents not available for this view yet.' : 'Chapters will appear as the curriculum is mapped.'}</p>}
    <p className={styles.description}>Read released material below. The outline does not indicate publication or mastery.</p>
  </section>
}
