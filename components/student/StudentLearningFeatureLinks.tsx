'use client'

import Link from 'next/link'
import { BookOpen, BookText, ChartNoAxesColumn, Lightbulb, RotateCcw, CheckCircle2, Shapes, type LucideIcon } from 'lucide-react'
import { recogniseLearnerGrade } from '@/lib/learn/schoolCatalog'
import type { CSSProperties } from 'react'

type Props = { mode: 'learn' | 'practice'; grade?: string | null; subject?: string | null }
type Destination = { label: string; description: string; href: string; Icon: LucideIcon }

/** Navigation to the existing owners of each tool; does not load or duplicate content, attempts or scores. */
export function learnLibraryHref(grade?: string | null, subject?: string | null): string {
  const recognised = recogniseLearnerGrade(grade)
  const search = new URLSearchParams()
  if (recognised) search.set('grade', recognised)
  if (subject?.trim()) search.set('subject', subject.trim())
  return '/learn' + (search.size ? '?' + search.toString() : '')
}
export function topicPracticeHref(subject?: string | null): string {
  const search = new URLSearchParams()
  if (subject?.trim()) search.set('subject', subject.trim())
  return '/student/vibelearn/topic-practice' + (search.size ? '?' + search.toString() : '')
}

const shell: CSSProperties = { padding: 16, background: 'var(--vs-card)', border: '1px solid var(--vs-border)', borderRadius: 16, margin: '0 0 18px' }
const grid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10, marginTop: 12 }
const tile: CSSProperties = { display: 'flex', gap: 10, textDecoration: 'none', color: 'var(--vs-text)', background: 'var(--vs-soft)', border: '1px solid var(--vs-border)', borderRadius: 12, padding: 13, minHeight: 80, alignItems: 'flex-start' }
const muted: CSSProperties = { display: 'block', fontSize: 12, color: 'var(--vs-muted)', lineHeight: 1.5, marginTop: 4 }

export default function StudentLearningFeatureLinks({mode,grade,subject}:Props) {
  const library = learnLibraryHref(grade, subject)
  const learn: Destination[] = [
    {label:'Lessons and examples',description:'Read published explanations and worked examples',href:learnLibraryHref(grade),Icon:BookOpen},
    {label:'Books and stories',description:'Read published books and continue a story',href:'/learn?view=reading',Icon:BookText},
    {label:'Visual learning',description:'Explore approved diagrams and learning models',href:'/learn/visuals',Icon:Shapes},
  ]
  const practice: Destination[] = [
    {label:'Review mistakes',description:'Revisit scored wrong and skipped answers',href:'/student/vibelearn/mistakes',Icon:CheckCircle2},
    {label:'Revision plan',description:'Review topics using your recorded learning evidence',href:'/student/vibelearn/revision',Icon:RotateCcw},
    {label:'My progress',description:'Open your recorded results and achievements',href:'/student/marks',Icon:ChartNoAxesColumn},
  ]
  const items=mode==='learn'?learn:practice
  return <section aria-label={mode==='learn'?'Learn tools':'Practice tools'} style={shell}>
    <h2 style={{margin:0,fontSize:18,color:'var(--vs-text)'}}>{mode==='learn'?'Learn with the right tools':'Strengthen what you have learned'}</h2>
    <p style={{...muted,marginTop:6}}>{mode==='learn'
      ? 'Reading, worked steps, audio and interactive teaching aids live inside approved lessons.'
      : 'Use the same recorded questions and results to revise. Exams and assigned tasks remain separate.'}</p>
    <nav aria-label={mode==='learn'?'Explore learning resources':'Practice support'}>
      <div style={grid}>{items.map(({label,description,href,Icon})=>
        <Link key={label} href={href} style={tile}><Icon size={21} color="var(--vs-accent)" aria-hidden="true" />
          <span><strong style={{fontSize:13}}>{label}</strong><span style={muted}>{description}</span></span>
        </Link>)}</div>
    </nav>
    <div style={{marginTop:12,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
      <Lightbulb size={16} color="var(--vs-accent)" aria-hidden="true"/>
      {mode==='learn'
        ? <Link href={topicPracticeHref(subject)} style={{color:'var(--vs-accent)',fontSize:13,fontWeight:800}}>Ready to try? Open Topic Practice →</Link>
        : <Link href={library} style={{color:'var(--vs-accent)',fontSize:13,fontWeight:800}}>Need an explanation? Return to Learn →</Link>}
    </div>
  </section>
}
