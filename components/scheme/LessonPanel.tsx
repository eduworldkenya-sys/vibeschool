"use client"

import { useState } from 'react'
import { CBC_CURRICULUM, getLessonContext, getParentBrief } from '@/lib/curriculum'
import type { Grade, Subject, Term } from '@/lib/curriculum'

const C = {
  bg:          '#f8fafc',
  surface:     '#ffffff',
  surface2:    '#f1f5f9',
  border:      '#e2e8f0',
  border2:     '#cbd5e1',
  text:        '#1e293b',
  text2:       '#64748b',
  text3:       '#94a3b8',
  teal:        '#0d9488',
  tealLight:   '#ccfbf1',
  indigo:      '#4f46e5',
  indigoLight: '#e0e7ff',
  amber:       '#d97706',
  amberLight:  '#fef3c7',
  green:       '#16a34a',
  greenLight:  '#dcfce7',
  red:         '#e11d48',
  redLight:    '#ffe4e6',
  dark:        '#0a1628',
  shadow:      '0 1px 3px rgba(0,0,0,0.08)',
  shadowMd:    '0 4px 16px rgba(0,0,0,0.08)',
} as const

function Section({ title, color = C.indigo, children }: {
  title: string; color?: string; children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color,
        letterSpacing: 1.5, textTransform: 'uppercase',
        marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {title}
        <div style={{ flex: 1, height: 1, background: C.border }} />
      </div>
      {children}
    </div>
  )
}

function Card({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <div style={{
      background: C.surface2, borderRadius: 12, padding: '12px 14px',
      marginBottom: 8, border: `1px solid ${C.border}`,
      borderLeft: accent ? `3px solid ${accent}` : `1px solid ${C.border}`,
      fontSize: 13, color: C.text, lineHeight: 1.6,
    }}>{children}</div>
  )
}

function QuestionSet({ label, color, items }: {
  label: string
  color: string
  items: { question: string; answer: string; parent_note?: string }[]
}) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        fontSize: 11, fontWeight: 800, color,
        marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1,
      }}>{label}</div>
      {items.map((q, i) => (
        <div key={i} style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 10, marginBottom: 5, overflow: 'hidden',
        }}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            style={{
              width: '100%', textAlign: 'left', padding: '10px 14px',
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: C.text,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
            }}
          >
            <span>{q.question}</span>
            <span style={{
              fontSize: 16, color: C.text3, flexShrink: 0,
              transform: open === i ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s',
            }}>⌄</span>
          </button>
          {open === i && (
            <div style={{
              padding: '10px 14px 12px', borderTop: `1px solid ${C.border}`,
              background: `${color}11`,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 3 }}>Answer</div>
              <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{q.answer}</div>
              {q.parent_note && (
                <div style={{
                  marginTop: 8, fontSize: 11, color: C.amber,
                  background: C.amberLight, borderRadius: 8, padding: '6px 10px', fontWeight: 600,
                }}>💡 {q.parent_note}</div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function TeacherView({ grade, subject, term, week }: {
  grade: Grade; subject: Subject; term: Term; week: number
}) {
  const ctx = getLessonContext(CBC_CURRICULUM as Record<string, never>, { grade, subject, term, week })

  if (!ctx) return (
    <div style={{ textAlign: 'center', padding: '32px 20px', color: C.text3, fontSize: 13 }}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>📖</div>
      <div style={{ fontWeight: 700, color: C.text2, marginBottom: 6 }}>No lesson content yet</div>
      <div>Content for Term {term} Week {week} is being prepared.</div>
    </div>
  )

  return (
    <div>
      <div style={{
        background: `linear-gradient(135deg, ${C.indigo}15, ${C.teal}15)`,
        borderRadius: 12, padding: '14px 16px', marginBottom: 18,
        border: `1px solid ${C.indigo}30`,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: C.indigo,
          marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1,
        }}>Term {ctx.term} · Week {ctx.week}</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text, lineHeight: 1.3 }}>{ctx.topic}</div>
      </div>

      <Section title="Learning Outcomes" color={C.indigo}>
        {ctx.outcomes.map((o, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%',
              background: C.indigoLight, color: C.indigo,
              fontSize: 10, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, marginTop: 1,
            }}>{i + 1}</div>
            <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>{o}</div>
          </div>
        ))}
      </Section>

      <Section title="Teacher Mastery Notes" color={C.teal}>
        <div style={{
          background: C.tealLight, border: `1px solid #5eead4`,
          borderRadius: 12, padding: '12px 14px',
          fontSize: 13, color: C.text, lineHeight: 1.7, whiteSpace: 'pre-line',
        }}>{ctx.mastery_notes}</div>
      </Section>

      <Section title="Teaching Tips" color={C.teal}>
        {ctx.tips.map((t, i) => (
          <Card key={i} accent={C.teal}>
            <span style={{ fontWeight: 700, color: C.teal, marginRight: 6 }}>#{i + 1}</span>{t}
          </Card>
        ))}
      </Section>

      <Section title="Common Mistakes" color={C.red}>
        {ctx.mistakes.map((m, i) => (
          <div key={i} style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderLeft: `3px solid ${C.red}`, borderRadius: 12,
            padding: '12px 14px', marginBottom: 8,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.red, marginBottom: 6 }}>❌ {m.mistake}</div>
            <div style={{ fontSize: 12, color: C.text2, marginBottom: 6, lineHeight: 1.5 }}>
              <span style={{ fontWeight: 700 }}>Why: </span>{m.why_it_happens}
            </div>
            <div style={{
              fontSize: 12, color: C.green, background: C.greenLight,
              borderRadius: 8, padding: '6px 10px', lineHeight: 1.5,
            }}>
              <span style={{ fontWeight: 700 }}>Fix: </span>{m.how_to_correct}
            </div>
          </div>
        ))}
      </Section>

      <Section title="Worked Examples" color={C.amber}>
        {ctx.examples.map((e, i) => (
          <div key={i} style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderLeft: `3px solid ${C.amber}`, borderRadius: 12,
            padding: '12px 14px', marginBottom: 10,
          }}>
            <div style={{
              fontSize: 12, fontWeight: 800, color: C.amber,
              marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1,
            }}>Example {i + 1}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10, lineHeight: 1.5 }}>{e.problem}</div>
            <div style={{ marginBottom: 10 }}>
              {e.solution_steps.map((s, j) => (
                <div key={j} style={{ display: 'flex', gap: 10, marginBottom: 6, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: 6,
                    background: C.amberLight, color: C.amber,
                    fontSize: 10, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>{j + 1}</div>
                  <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>{s}</div>
                </div>
              ))}
            </div>
            <div style={{
              background: C.greenLight, borderRadius: 8, padding: '8px 12px',
              fontSize: 13, fontWeight: 700, color: C.green,
            }}>✓ {e.answer}</div>
            <div style={{
              marginTop: 8, fontSize: 11, color: C.text3, fontStyle: 'italic', lineHeight: 1.5,
            }}>🇰🇪 {e.kenyan_context}</div>
          </div>
        ))}
      </Section>

      <Section title="Practice Questions" color={C.indigo}>
        <QuestionSet label="Easy"   color={C.green} items={ctx.practice.easy}   />
        <QuestionSet label="Medium" color={C.amber} items={ctx.practice.medium} />
        <QuestionSet label="Hard"   color={C.red}   items={ctx.practice.hard}   />
      </Section>

      <Section title="Classroom Warning Signs" color={C.red}>
        {ctx.classroom_warnings.map((w, i) => (
          <div key={i} style={{
            display: 'flex', gap: 8, marginBottom: 7,
            alignItems: 'flex-start', fontSize: 13, color: C.text, lineHeight: 1.5,
          }}>
            <span style={{ color: C.red, flexShrink: 0 }}>⚠️</span>{w}
          </div>
        ))}
      </Section>
    </div>
  )
}

function ParentView({ grade, subject, term, week }: {
  grade: Grade; subject: Subject; term: Term; week: number
}) {
  const brief = getParentBrief(CBC_CURRICULUM as Record<string, never>, { grade, subject, term, week })

  if (!brief) return (
    <div style={{ textAlign: 'center', padding: '32px 20px', color: C.text3, fontSize: 13 }}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>👨‍👩‍👧</div>
      <div style={{ fontWeight: 700, color: C.text2, marginBottom: 6 }}>Parent brief coming soon</div>
      <div>We are preparing the parent summary for Term {term} Week {week}.</div>
    </div>
  )

  return (
    <div>
      <div style={{
        background: `linear-gradient(135deg, ${C.teal}15, ${C.green}15)`,
        borderRadius: 12, padding: '14px 16px', marginBottom: 18,
        border: `1px solid ${C.teal}30`,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: C.teal,
          marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1,
        }}>What your child learned this week</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text, lineHeight: 1.3 }}>{brief.topic}</div>
      </div>

      <Section title="In Simple Words" color={C.teal}>
        <div style={{
          background: C.tealLight, border: `1px solid #5eead4`,
          borderRadius: 12, padding: '14px 16px',
          fontSize: 14, color: C.text, lineHeight: 1.8, fontWeight: 500,
        }}>{brief.summary}</div>
      </Section>

      <Section title="Ask Your Child Tonight" color={C.indigo}>
        {brief.questions.map((q, i) => (
          <div key={i} style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderLeft: `3px solid ${C.indigo}`, borderRadius: 12,
            padding: '12px 14px', marginBottom: 8,
            fontSize: 13, color: C.text, lineHeight: 1.6,
          }}>
            <span style={{ fontWeight: 800, color: C.indigo, marginRight: 6 }}>💬</span>{q}
          </div>
        ))}
      </Section>

      <Section title="Home Activity" color={C.amber}>
        <div style={{
          background: C.amberLight, border: `1px solid #fcd34d`,
          borderRadius: 12, padding: '14px 16px',
          fontSize: 13, color: C.text, lineHeight: 1.8,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 800, color: C.amber,
            marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1,
          }}>🏠 No materials needed</div>
          {brief.home_activity}
        </div>
      </Section>

      <Section title="Watch Out For" color={C.red}>
        {brief.warning_signs.map((w, i) => (
          <div key={i} style={{
            display: 'flex', gap: 8, marginBottom: 7,
            alignItems: 'flex-start', fontSize: 13, color: C.text, lineHeight: 1.5,
          }}>
            <span style={{ color: C.red, flexShrink: 0 }}>🚩</span>{w}
          </div>
        ))}
      </Section>
    </div>
  )
}

export function LessonPanel({
  gradeLabel, subjectLabel, term, week,
}: {
  gradeLabel: string; subjectLabel: string; term: number; week: number
}) {
  const [activeTab, setActiveTab] = useState<'teacher' | 'parent'>('teacher')

  const gradeMap: Record<string, Grade> = {
    'Grade 6': 'grade6', 'Grade 7': 'grade7', 'Grade 8': 'grade8',
  }
  const subjectMap: Record<string, Subject> = {
    'Mathematics': 'mathematics', 'English': 'english',
    'Kiswahili': 'kiswahili', 'Science and Technology': 'science',
    'Social Studies': 'socialstudies', 'Home Science': 'homescience',
    'Agriculture': 'agriculture', 'CRE': 'cre',
  }

  const grade   = gradeMap[gradeLabel]
  const subject = subjectMap[subjectLabel]
  if (!grade || !subject) return null

  const tabs = [
    { key: 'teacher' as const, label: '👩‍🏫 Teacher', color: C.indigo },
    { key: 'parent'  as const, label: '👨‍👩‍👧 Parent',  color: C.teal  },
  ]

  return (
    <div style={{
      background: C.surface, borderRadius: 16,
      border: `1px solid ${C.border}`, boxShadow: C.shadowMd,
      marginBottom: 20, overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, background: C.surface2 }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1, padding: '13px 8px', border: 'none',
              background: activeTab === tab.key ? C.surface : 'none',
              color: activeTab === tab.key ? tab.color : C.text3,
              fontWeight: activeTab === tab.key ? 800 : 600,
              fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              borderBottom: activeTab === tab.key ? `2px solid ${tab.color}` : '2px solid transparent',
              transition: 'all 0.15s ease',
            }}
          >{tab.label}</button>
        ))}
      </div>
      <div style={{ padding: '16px' }}>
        {activeTab === 'teacher'
          ? <TeacherView grade={grade} subject={subject} term={term as Term} week={week} />
          : <ParentView  grade={grade} subject={subject} term={term as Term} week={week} />
        }
      </div>
    </div>
  )
}
