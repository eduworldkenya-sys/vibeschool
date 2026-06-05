"use client"
export const dynamic = 'force-dynamic'

import { useRouter } from 'next/navigation'
import { C } from '@/components/teacher/ui'

const ITEMS = [
  { label: 'ClassHub',   href: '/teacher',            desc: 'Your classes and students'     },
  { label: 'SubjectHub', href: '/teacher/subjecthub', desc: 'Manage your subjects'           },
  { label: 'Timetable',  href: '/teacher/timetable',  desc: 'View your schedule'             },
  { label: 'Attendance', href: '/teacher/attendance', desc: 'Mark and review attendance'     },
  { label: 'Assessment', href: '/teacher/assessment', desc: 'CBC assessments'                },
  { label: 'Scheme',     href: '/teacher/scheme',     desc: 'Curriculum tracker'             },
  { label: 'Resources',  href: '/teacher/resources',  desc: 'Notes, quizzes, exercises'      },
  { label: 'SchoolHub',  href: '/teacher/schoolhub',  desc: 'School info and staff'          },
  { label: 'Results',    href: '/teacher/results',    desc: 'Student results'                },
  { label: 'TPAD',       href: '/teacher/tpad',       desc: 'Teacher performance appraisal'  },
  { label: 'Profile',    href: '/teacher/profile',    desc: 'Your profile'                   },
  { label: 'Settings',   href: '/teacher/settings',   desc: 'App settings'                   },
  { label: 'Help',       href: '/teacher/help',       desc: 'Help and support'               },
]

export default function MorePage() {
  const router = useRouter()
  return (
    <div style={{ paddingBottom: 32 }}>
      <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #2d2a6e 100%)', borderRadius: 20, padding: '20px', marginBottom: 16, color: '#fff' }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase' }}>More</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>All Tools</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>Everything in one place</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ITEMS.map(item => (
          <button key={item.href} onClick={() => router.push(item.href)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 16, background: '#fff', border: '1px solid ' + C.border, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' as const, width: '100%', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>{item.label}</div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{item.desc}</div>
            </div>
            <span style={{ fontSize: 18, color: C.textMuted }}>&rsaquo;</span>
          </button>
        ))}
      </div>
    </div>
  )
}
