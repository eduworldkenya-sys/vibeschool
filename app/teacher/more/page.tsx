'use client'

import { useRouter } from 'next/navigation'
import { Card, C } from '@/components/teacher/ui'

const ITEMS = [
  { icon: '🏫', label: 'ClassHub',       desc: 'Your class overview and learner profiles',  href: '/teacher/classhub',   live: true  },
  { icon: '🔬', label: 'SubjectHub',     desc: 'Subject teams and shared resources',         href: '/teacher/subjecthub', live: true  },
  { icon: '📦', label: 'Resources',      desc: 'Upload and manage teaching materials',       href: '/teacher/resources',  live: true  },
  { icon: '📊', label: 'Assessment',     desc: 'Scores, trends, and progressive records',    href: '/teacher/assessment', live: true  },
  { icon: '🏆', label: 'Results',      desc: 'Exam marks, analysis and report cards',      href: '/teacher/results',    live: true  },
  { icon: '🗓️', label: 'Timetable',     desc: 'Full weekly timetable view',                 href: '/teacher/timetable',  live: true  },
  { icon: '🏛️', label: 'SchoolHub',     desc: 'School-wide admin and governance',           href: '/teacher/schoolhub',  live: true  },
  { icon: '📋', label: 'Scheme of Work', desc: 'Curriculum map and topic tracker',           href: '/teacher/scheme',     live: true  },
  { icon: '⚙️', label: 'Settings',      desc: 'Account, notifications, preferences',        href: '/teacher/settings',   live: true  },
  { icon: '🎓', label: 'VibeLearn',      desc: 'Student-facing learning platform',           href: '/teacher/vibelearn',  live: false },
  { icon: '❓', label: 'Help & Support', desc: 'Guides, FAQs, and contact',                  href: '/teacher/help',       live: true  },
]

export default function MorePage() {
  const router = useRouter()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 180 }}>

      <div style={{ fontSize: 20, fontWeight: 800, color: C.textPrimary }}>More</div>

      <Card>
        {ITEMS.map((item, i) => (
          <div
            key={item.label}
            onClick={() => item.live && router.push(item.href)}
            style={{
              display:       'flex',
              alignItems:    'center',
              gap:           14,
              padding:       '14px 0',
              borderBottom:  i < ITEMS.length - 1 ? `1px solid ${C.border}` : 'none',
              cursor:        item.live ? 'pointer' : 'default',
              opacity:       item.live ? 1 : 0.45,
            }}
          >
            <span style={{ fontSize: 22, flexShrink: 0 }}>{item.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>
                  {item.label}
                </span>
                {!item.live && (
                  <span style={{
                    fontSize:        9,
                    fontWeight:      800,
                    textTransform:   'uppercase',
                    padding:         '2px 7px',
                    borderRadius:    10,
                    background:      C.surface,
                    color:           C.textMuted,
                    border:          `1px solid ${C.border}`,
                  }}>
                    Soon
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{item.desc}</div>
            </div>
            {item.live && (
              <span style={{ fontSize: 16, color: C.textMuted, flexShrink: 0 }}>›</span>
            )}
          </div>
        ))}
      </Card>

    </div>
  )
}