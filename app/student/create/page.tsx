'use client'

import Link from 'next/link'
import { ArrowRight, BookOpen, FlaskConical, Lightbulb, Palette, PenLine, type LucideIcon } from 'lucide-react'

const CREATE: { title: string; detail: string; template: string; Icon: LucideIcon }[] = [
  { title: 'Write a story', detail: 'Invent characters, places and a new adventure.', template: 'story', Icon: PenLine },
  { title: 'Investigate', detail: 'Ask a question, observe and explain your findings.', template: 'investigation', Icon: FlaskConical },
  { title: 'Plan a design', detail: 'Describe an invention, artwork or something to make.', template: 'design', Icon: Palette },
  { title: 'Reading reflection', detail: 'Record the ideas you learned from a book.', template: 'reading', Icon: BookOpen },
]

export default function StudentCreatePage() {
  return <main style={{ maxWidth: 870, margin: '0 auto', display: 'grid', gap: 18, padding: '8px 0 60px' }}>
    <header style={{ display: 'grid', gap: 7 }}>
      <span style={{ color: 'var(--vs-accent)', fontWeight: 800, fontSize: 12 }}>MY CREATIVE SPACE</span>
      <h1 style={{ fontSize: 'clamp(24px,4vw,30px)' }}>Create something</h1>
      <p style={{ color: 'var(--vs-muted)', fontSize: 13, lineHeight: 1.5 }}>Choose an idea or start your own. Your written projects use your existing private project workspace.</p>
    </header>
    <nav aria-label="Things to create" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(185px,1fr))', gap: 11 }}>
      {CREATE.map(({ title, detail, template, Icon }) => <Link key={template} href={'/student/projects/independent?template=' + template} style={{ minHeight: 150, border: '1px solid var(--vs-border)', borderRadius: 12, padding: 18, background: 'var(--vs-card)', color: 'var(--vs-text)', display: 'grid', gap: 9, alignContent: 'start', textDecoration: 'none' }}>
        <Icon size={25} color="var(--vs-accent)" aria-hidden="true"/>
        <strong style={{ fontSize: 15 }}>{title}</strong>
        <span style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--vs-muted)' }}>{detail}</span>
        <span style={{ fontSize: 12, color: 'var(--vs-accent)', fontWeight: 750, marginTop: 5 }}>Start <ArrowRight size={14} style={{ display: 'inline', verticalAlign: 'middle' }}/></span>
      </Link>)}
    </nav>
    <section style={{ border: '1px solid var(--vs-border)', borderRadius: 12, background: 'var(--vs-card)', padding: 18, display: 'grid', gap: 11 }}>
      <h2 style={{ fontSize: 17 }}>My work</h2>
      <p style={{ color: 'var(--vs-muted)', fontSize: 13 }}>Keep writing, add observations, or finish something you started.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <Link href="/student/projects/independent" style={{ minHeight: 44, padding: '12px 14px', borderRadius: 10, background: 'var(--vs-accent)', color: 'var(--vs-on-accent)', fontSize: 13, fontWeight: 750, textDecoration: 'none' }}>Open my projects <ArrowRight size={14} style={{ display: 'inline', verticalAlign: 'middle' }}/></Link>
        <Link href="/student/workspace" style={{ minHeight: 44, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--vs-border)', color: 'var(--vs-text)', fontSize: 13, fontWeight: 750, textDecoration: 'none' }}>My learning workspace</Link>
      </div>
    </section>
    <aside style={{ display: 'flex', alignItems: 'flex-start', gap: 10, color: 'var(--vs-muted)', fontSize: 12, lineHeight: 1.5 }}><Lightbulb size={18} aria-hidden="true" style={{ flexShrink: 0 }}/> These are personal projects, not teacher-marked assignments. Sharing with other people is not enabled here.</aside>
  </main>
}
