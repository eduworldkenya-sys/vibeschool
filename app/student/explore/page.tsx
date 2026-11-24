'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ArrowRight, BookOpen, FlaskConical, Gamepad2, Lightbulb, Palette, Search, X } from 'lucide-react'
import { useStudent } from '@/lib/student-context'
import { fallbackSubjectGroups, recogniseLearnerGrade } from '@/lib/learn/schoolCatalog'

const card: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 9, padding: 17,
  textDecoration: 'none', minHeight: 122, border: '1px solid var(--vs-border)',
  borderRadius: 12, background: 'var(--vs-card)', color: 'var(--vs-text)',
}
const ideas = [
  { title: 'Nature & science', hint: 'Explore the world around you', pattern: /science|environment|agricultur|nature/i, Icon: FlaskConical },
  { title: 'Numbers & patterns', hint: 'Find interesting ways to solve problems', pattern: /math/i, Icon: Lightbulb },
  { title: 'Stories & language', hint: 'Read, imagine and express ideas', pattern: /english|kiswahili|language/i, Icon: BookOpen },
  { title: 'Art & design', hint: 'Explore making, music and creativity', pattern: /creative|art|music|design/i, Icon: Palette },
]

export default function StudentExplorePage() {
  const { identity } = useStudent()
  const [query, setQuery] = useState('')
  const grade = recogniseLearnerGrade(identity?.className)
  const subjects = useMemo(() => {
    if (!grade) return []
    return [...new Set(fallbackSubjectGroups(grade).flatMap(group => group.subjects))]
  }, [grade])
  const href = (subject?: string) => {
    const params = new URLSearchParams()
    if (grade) params.set('grade', grade)
    if (subject) params.set('subject', subject)
    const search = params.toString()
    return '/learn' + (search ? '?' + search : '')
  }
  const matches = subjects.filter(subject => subject.toLowerCase().includes(query.trim().toLowerCase()))
  return <main style={{ maxWidth: 980, margin: '0 auto', padding: '10px 0 60px', display: 'grid', gap: 18 }}>
    <header style={{ display: 'grid', gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 750, color: 'var(--vs-accent)' }}>DISCOVER</span>
      <h1 style={{ fontSize: 'clamp(24px,4vw,30px)', letterSpacing: '-.035em' }}>What interests you?</h1>
      <p style={{ fontSize: 13, color: 'var(--vs-muted)' }}>Choose something to discover. Only available published lessons appear in Learn.</p>
    </header>
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', minHeight: 48, border: '1px solid var(--vs-border)', borderRadius: 10, background: 'var(--vs-card)' }}>
      <Search size={19} aria-hidden="true" />
      <span className="sr-only">Find a subject</span>
      <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a subject" style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', color: 'var(--vs-text)', fontSize: 14 }} />
      {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search" style={{ display: 'grid', placeItems: 'center', width: 40, height: 40, border: 0, background: 'transparent', color: 'var(--vs-muted)', cursor: 'pointer' }}><X size={18} /></button>}
    </label>
    {query.trim() ? <section aria-live="polite">
      <h2 style={{ fontSize: 16, marginBottom: 10 }}>Matching subjects</h2>
      {matches.length ? <nav style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }} aria-label="Matching subjects">
        {matches.map(subject => <Link key={subject} href={href(subject)} style={card}><BookOpen size={23} color="var(--vs-accent)" aria-hidden="true" /><strong>{subject}</strong><span style={{ marginTop: 'auto', fontSize: 12, color: 'var(--vs-muted)' }}>Open Learn <ArrowRight size={13} style={{ display: 'inline', verticalAlign: 'middle' }} /></span></Link>)}
      </nav> : <p style={{ color: 'var(--vs-muted)', fontSize: 13 }}>No matching subject. Try the complete library.</p>}
    </section> : <>
      <section>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>Explore an interest</h2>
        <nav style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(185px,1fr))', gap: 10 }} aria-label="Learning interests">
          {ideas.map(({ title, hint, pattern, Icon }) => <Link key={title} href={href(subjects.find(subject => pattern.test(subject)))} style={card}>
            <Icon size={24} color="var(--vs-accent)" aria-hidden="true" />
            <strong>{title}</strong><span style={{ fontSize: 12, color: 'var(--vs-muted)', lineHeight: 1.45 }}>{hint}</span>
          </Link>)}
        </nav>
      </section>
      <section>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>Try something different</h2>
        <nav style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 10 }} aria-label="Discovery activities">
          <Link href="/explore" style={card}><Lightbulb size={23} color="var(--vs-accent)" /><strong>Mini Lessons</strong><span style={{ fontSize: 12, color: "var(--vs-muted)" }}>Explore short explanations or request one</span></Link>
           <Link href="/learn/stories" style={card}><BookOpen size={23} color="var(--vs-accent)" /><strong>Read a story</strong><span style={{ fontSize: 12, color: 'var(--vs-muted)' }}>Find published stories</span></Link>
          <Link href="/student/funhub" style={card}><Gamepad2 size={23} color="var(--vs-accent)" /><strong>Play a game</strong><span style={{ fontSize: 12, color: 'var(--vs-muted)' }}>Try a quick learning challenge</span></Link>
          <Link href="/student/create" style={card}><Palette size={23} color="var(--vs-accent)" /><strong>Create</strong><span style={{ fontSize: 12, color: 'var(--vs-muted)' }}>Start a story or a project</span></Link>
        </nav>
      </section>
    </>}
    <Link href={href()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, padding: '12px 15px', background: 'var(--vs-accent)', borderRadius: 10, color: 'var(--vs-on-accent)', textDecoration: 'none', fontSize: 13, fontWeight: 800 }}>
      <span>Browse all published lessons</span><ArrowRight size={18} aria-hidden="true" />
    </Link>
  </main>
}
