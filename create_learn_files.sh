#!/bin/bash
# VibeSchool Learn — file creation script for Termux
# Run this from the ROOT of your vibeschool-main project directory.
set -e

mkdir -p app/learn
mkdir -p "app/learn/[courseSlug]"
mkdir -p "app/learn/[courseSlug]/[moduleSlug]/[topicSlug]"
mkdir -p app/learn/careers
mkdir -p components/learn
mkdir -p supabase/migrations

echo "Creating supabase/migrations/20260619000001_learn_schema.sql ..."
cat > supabase/migrations/20260619000001_learn_schema.sql << 'EOF'
-- supabase/migrations/20260619000001_learn_schema.sql
-- VibeSchool Learn: post-secondary / vocational learning module
-- Independent learner identity, separate from teacher/parent/student roles.

-- ─── learner_profiles ──────────────────────────────────────────────────────
create table if not exists learner_profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  display_name       text,
  avatar_initials    text default 'NJ',
  streak_days        integer default 0,
  last_active_date   date,
  preferred_language text default 'english',
  created_at         timestamptz default now()
);

-- ─── courses ───────────────────────────────────────────────────────────────
create table if not exists courses (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique not null,
  title          text not null,
  institution    text,
  level          text,
  duration_label text,
  domain         text not null check (domain in ('health', 'tech', 'education', 'trade')),
  status         text not null default 'coming_soon' check (status in ('live', 'coming_soon')),
  badge          text,
  description    text,
  weeks_count    integer,
  modules_count  integer,
  created_at     timestamptz default now()
);

-- ─── modules ───────────────────────────────────────────────────────────────
create table if not exists modules (
  id              uuid primary key default gen_random_uuid(),
  course_id       uuid not null references courses(id) on delete cascade,
  slug            text not null,
  title           text not null,
  sequence_number integer not null,
  weeks_label     text,
  created_at      timestamptz default now(),
  unique (course_id, slug)
);

-- ─── topics ────────────────────────────────────────────────────────────────
create table if not exists topics (
  id                 uuid primary key default gen_random_uuid(),
  module_id          uuid not null references modules(id) on delete cascade,
  slug               text not null,
  title              text not null,
  subtitle           text,
  sequence_number    integer not null,
  week_number        integer,
  concept_tab        jsonb,
  kenya_context_tab  jsonb,
  common_errors_tab  jsonb,
  clinical_tip_tab   jsonb,
  content_status     text not null default 'draft' check (content_status in ('draft', 'in_review', 'published')),
  created_at         timestamptz default now(),
  unique (module_id, slug)
);

-- ─── quiz_questions ────────────────────────────────────────────────────────
create table if not exists quiz_questions (
  id                 uuid primary key default gen_random_uuid(),
  topic_id           uuid not null references topics(id) on delete cascade,
  question_text      text not null,
  options            jsonb not null, -- [{ id: "opt-a", label: "A", text: "..." }, ...]
  correct_option_id  text not null,
  explanation        text,
  created_at         timestamptz default now()
);

-- ─── learner_progress ──────────────────────────────────────────────────────
-- Single source of truth for completion. Course/module progress and streaks
-- are derived from this table, never stored independently.
create table if not exists learner_progress (
  id            uuid primary key default gen_random_uuid(),
  learner_id    uuid not null references learner_profiles(id) on delete cascade,
  topic_id      uuid not null references topics(id) on delete cascade,
  completed_at  timestamptz,
  quiz_score    numeric,
  created_at    timestamptz default now(),
  unique (learner_id, topic_id)
);

-- ─── Indexes ───────────────────────────────────────────────────────────────
create index if not exists idx_modules_course_id on modules(course_id);
create index if not exists idx_topics_module_id on topics(module_id);
create index if not exists idx_quiz_questions_topic_id on quiz_questions(topic_id);
create index if not exists idx_learner_progress_learner_id on learner_progress(learner_id);
create index if not exists idx_learner_progress_topic_id on learner_progress(topic_id);

-- ─── RLS ───────────────────────────────────────────────────────────────────
alter table learner_profiles enable row level security;
alter table courses enable row level security;
alter table modules enable row level security;
alter table topics enable row level security;
alter table quiz_questions enable row level security;
alter table learner_progress enable row level security;

-- Public read on published catalog content
create policy "public read courses" on courses for select using (true);
create policy "public read modules" on modules for select using (true);
create policy "public read published topics" on topics for select using (content_status = 'published');
create policy "public read quiz questions" on quiz_questions for select using (true);

-- Learner profile: owner-only
create policy "learner reads own profile" on learner_profiles for select using (auth.uid() = id);
create policy "learner inserts own profile" on learner_profiles for insert with check (auth.uid() = id);
create policy "learner updates own profile" on learner_profiles for update using (auth.uid() = id);

-- Learner progress: owner-only
create policy "learner reads own progress" on learner_progress for select using (auth.uid() = learner_id);
create policy "learner inserts own progress" on learner_progress for insert with check (auth.uid() = learner_id);
create policy "learner updates own progress" on learner_progress for update using (auth.uid() = learner_id);

-- ─── Seed: pilot course (Community Health Nursing) ────────────────────────
insert into courses (slug, title, institution, level, duration_label, domain, status, badge, description, weeks_count, modules_count)
values (
  'community-health-nursing',
  'Community Health Nursing',
  'KMTC',
  'Certificate',
  '3 years',
  'health',
  'live',
  null,
  'KRCHN exam prep and clinical skills for Kenya''s community health nursing certificate.',
  32,
  5
)
on conflict (slug) do nothing;

-- Coming-soon placeholders (catalog only, no module/topic content yet)
insert into courses (slug, title, institution, level, duration_label, domain, status, badge)
values
  ('pharmacy-technician',      'Pharmacy Technician',          'KMTC',            'Certificate', '2 years', 'health',    'coming_soon', null),
  ('electrical-installation',  'Electrical Installation',      'TVET',            'Certificate', '2 years', 'trade',     'coming_soon', null),
  ('primary-teacher-education','Primary Teacher Education',    'Teachers College','Diploma',     '2 years', 'education', 'coming_soon', null),
  ('business-administration',  'Business Administration',      'University',      'Degree',      '4 years', 'trade',     'coming_soon', null),
  ('medical-laboratory-science','Medical Laboratory Science',  'KMTC',            'Diploma',     '3 years', 'health',    'coming_soon', null)
on conflict (slug) do nothing;
EOF

echo "Creating components/learn/LearnBottomNav.tsx ..."
cat > components/learn/LearnBottomNav.tsx << 'EOF'
"use client"

import React from 'react'
import { usePathname, useRouter } from 'next/navigation'

interface NavTab {
  label: string
  path: string
  icon: string
}

export function LearnBottomNav() {
  const pathname = usePathname()
  const router = useRouter()

  const tabs: NavTab[] = [
    { label: 'Home',    path: '/learn',         icon: '🏠' },
    { label: 'Careers', path: '/learn/careers', icon: '🎯' },
  ]

  const handleTabClick = (tab: NavTab) => {
    router.push(tab.path)
  }

  const isTabActive = (tab: NavTab) => {
    if (tab.path === '/learn') {
      return pathname === '/learn'
    }
    return pathname.startsWith(tab.path)
  }

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: '480px', height: 64,
      backgroundColor: '#ffffff', borderTop: '1px solid #e5e5ef',
      display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      zIndex: 90, boxShadow: '0 -4px 20px rgba(0,0,0,0.06)',
    }}>
      {tabs.map((tab) => {
        const isActive = isTabActive(tab)
        return (
          <div
            key={tab.label}
            onClick={() => handleTabClick(tab)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', flex: 1, height: '100%',
              cursor: 'pointer', position: 'relative',
            }}
          >
            {isActive && (
              <div style={{
                position: 'absolute', top: 0, width: 24, height: 3,
                backgroundColor: '#1A1AFF', borderRadius: '0 0 2px 2px',
              }} />
            )}
            <span style={{ fontSize: 18, opacity: isActive ? 1 : 0.45 }}>
              {tab.icon}
            </span>
            <span style={{
              fontSize: 10, marginTop: 2,
              color: isActive ? '#1A1AFF' : '#9292a6',
              fontWeight: isActive ? 700 : 400,
            }}>
              {tab.label}
            </span>
          </div>
        )
      })}
    </nav>
  )
}
EOF

echo "Creating app/learn/page.tsx ..."
cat > app/learn/page.tsx << 'EOF'
"use client"
export const dynamic = "force-dynamic"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { LearnBottomNav } from '@/components/learn/LearnBottomNav'

const BLUE = '#1A1AFF'
const INK = '#0A0A0F'
const MUTED = '#5A5A6A'
const CANVAS = '#F7F7FB'

interface CourseRow {
  id: string
  slug: string
  title: string
  institution: string | null
  level: string | null
  duration_label: string | null
  domain: string
  status: 'live' | 'coming_soon'
  badge: string | null
  weeks_count: number | null
  modules_count: number | null
}

const DOMAIN_META: Record<string, { label: string; emoji: string; bg: string }> = {
  health:    { label: 'Health',    emoji: '🩺', bg: '#e6fff5' },
  tech:      { label: 'Tech',      emoji: '⚡', bg: '#eef2ff' },
  education: { label: 'Education', emoji: '✏️', bg: '#fff7ed' },
  trade:     { label: 'Trade',     emoji: '💼', bg: '#fdf2f8' },
}

function CourseCard({ course, onClick }: { course: CourseRow; onClick: () => void }) {
  const domainMeta = DOMAIN_META[course.domain] ?? DOMAIN_META.trade
  const isLive = course.status === 'live'

  return (
    <div
      onClick={isLive ? onClick : undefined}
      style={{
        background: '#fff', borderRadius: 16, border: '1px solid #ecebf3',
        padding: 16, cursor: isLive ? 'pointer' : 'default',
        opacity: isLive ? 1 : 0.7,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, background: domainMeta.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
        }}>
          {domainMeta.emoji}
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
          background: isLive ? '#eef2ff' : '#f3f3f6',
          color: isLive ? BLUE : MUTED,
        }}>
          {isLive ? 'Live' : 'Coming soon'}
        </span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: INK, marginBottom: 4 }}>
        {course.title}
      </div>
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>
        {[course.institution, course.level, course.duration_label].filter(Boolean).join(' · ')}
      </div>
      <div style={{ fontSize: 12, color: MUTED }}>
        {isLive
          ? `📚 ${course.modules_count ?? '—'} modules`
          : '📚 Curriculum in review'}
      </div>
    </div>
  )
}

export default function LearnPage() {
  const router = useRouter()
  const [courses, setCourses] = useState<CourseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('courses')
        .select('id, slug, title, institution, level, duration_label, domain, status, badge, weeks_count, modules_count')
        .order('status', { ascending: false })

      if (error) {
        console.error('LearnPage courses fetch error:', error)
      } else if (data) {
        setCourses(data as CourseRow[])
      }
      setLoading(false)
    }
    load()
  }, [])

  const liveCourses = courses.filter(c => c.status === 'live')
  const featured = liveCourses[0] ?? null

  const filteredCourses = search.trim()
    ? courses.filter(c => c.title.toLowerCase().includes(search.trim().toLowerCase()))
    : courses

  return (
    <div style={{ minHeight: '100vh', background: CANVAS, paddingBottom: 84 }}>
      {/* TOPBAR */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50, background: CANVAS,
        padding: '16px 16px 8px', borderBottom: '1px solid #ecebf3',
      }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: INK }}>VibeSchool <span style={{ color: BLUE }}>Learn</span></div>
      </div>

      {/* HERO */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: INK, lineHeight: 1.25 }}>
          Kenya&apos;s Learning Platform
        </div>
        <div style={{ fontSize: 13, color: MUTED, marginTop: 6, marginBottom: 16 }}>
          Free, curriculum-aligned study material for KMTC, TVET, and Teachers College learners.
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search courses..."
          style={{
            width: '100%', padding: '12px 14px', borderRadius: 12,
            border: '1px solid #ecebf3', background: '#fff', fontSize: 14,
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* STATS BAR */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
        padding: '16px 16px 0',
      }}>
        {[
          { number: String(liveCourses.length), label: 'Course live' },
          { number: String(featured?.modules_count ?? 0), label: 'Modules & topics' },
          { number: `${Math.max(courses.length - liveCourses.length, 0)}+`, label: 'More coming soon' },
          { number: '100%', label: 'Free forever' },
        ].map((stat) => (
          <div key={stat.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: INK }}>{stat.number}</div>
            <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* DOMAIN GRID */}
      <div style={{ padding: '24px 16px 0' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: INK, marginBottom: 12 }}>Browse by domain</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {Object.entries(DOMAIN_META).map(([key, meta]) => (
            <div key={key} style={{
              background: '#fff', borderRadius: 14, border: '1px solid #ecebf3',
              padding: '14px 8px', textAlign: 'center',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, background: meta.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, margin: '0 auto 6px',
              }}>
                {meta.emoji}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: INK }}>{meta.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* FEATURED COURSE */}
      {featured && (
        <div style={{ padding: '24px 16px 0' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: INK, marginBottom: 12 }}>Featured course</div>
          <div
            onClick={() => router.push(`/learn/${featured.slug}`)}
            style={{
              background: INK, borderRadius: 18, padding: 20, cursor: 'pointer',
              color: '#fff',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: BLUE, marginBottom: 8 }}>
              {(featured.institution ?? '').toUpperCase()} · {featured.level}
            </div>
            <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 6 }}>{featured.title}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 16 }}>
              📅 {featured.duration_label} curriculum · 🧠 AI Twin included · 🇰🇪 Kenya context
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: BLUE, color: '#fff', fontSize: 13, fontWeight: 700,
              padding: '10px 18px', borderRadius: 999,
            }}>
              Start learning →
            </div>
          </div>
        </div>
      )}

      {/* ALL COURSES */}
      <div style={{ padding: '24px 16px 0' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: INK, marginBottom: 12 }}>All courses</div>
        {loading ? (
          <div style={{ fontSize: 13, color: MUTED }}>Loading courses...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {filteredCourses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                onClick={() => router.push(`/learn/${course.slug}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* CAREER TEASER */}
      <div style={{ padding: '24px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: INK }}>I want to become...</div>
          <div
            onClick={() => router.push('/learn/careers')}
            style={{ fontSize: 12, fontWeight: 600, color: BLUE, cursor: 'pointer' }}
          >
            All careers →
          </div>
        </div>
      </div>

      <LearnBottomNav />
    </div>
  )
}
EOF

echo "Creating app/learn/[courseSlug]/page.tsx ..."
cat > 'app/learn/[courseSlug]/page.tsx' << 'EOF'
"use client"
export const dynamic = "force-dynamic"

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { LearnBottomNav } from '@/components/learn/LearnBottomNav'

const BLUE = '#1A1AFF'
const INK = '#0A0A0F'
const MUTED = '#5A5A6A'
const CANVAS = '#F7F7FB'

interface CourseRow {
  id: string
  slug: string
  title: string
  institution: string | null
  level: string | null
  duration_label: string | null
  status: 'live' | 'coming_soon'
}

interface ModuleRow {
  id: string
  slug: string
  title: string
  sequence_number: number
  weeks_label: string | null
}

interface TopicRow {
  id: string
  module_id: string
  slug: string
  title: string
  sequence_number: number
}

interface ProgressRow {
  topic_id: string
  completed_at: string | null
}

export default function CourseRoadmapPage() {
  const router = useRouter()
  const params = useParams()
  const courseSlug = params.courseSlug as string

  const [course, setCourse] = useState<CourseRow | null>(null)
  const [modules, setModules] = useState<ModuleRow[]>([])
  const [topicsByModule, setTopicsByModule] = useState<Record<string, TopicRow[]>>({})
  const [completedTopicIds, setCompletedTopicIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: courseData, error: courseErr } = await supabase
        .from('courses')
        .select('id, slug, title, institution, level, duration_label, status')
        .eq('slug', courseSlug)
        .single()

      if (courseErr || !courseData) {
        console.error('CourseRoadmapPage course fetch error:', courseErr)
        setNotFound(true)
        setLoading(false)
        return
      }
      setCourse(courseData as CourseRow)

      const { data: { user } } = await supabase.auth.getUser()

      const [modulesResult, progressResult] = await Promise.all([
        supabase
          .from('modules')
          .select('id, slug, title, sequence_number, weeks_label')
          .eq('course_id', courseData.id)
          .order('sequence_number', { ascending: true }),
        user
          ? supabase
              .from('learner_progress')
              .select('topic_id, completed_at')
              .eq('learner_id', user.id)
          : Promise.resolve({ data: [] as ProgressRow[], error: null }),
      ])

      const moduleRows = (modulesResult.data ?? []) as ModuleRow[]
      setModules(moduleRows)

      const completed = new Set(
        ((progressResult.data ?? []) as ProgressRow[])
          .filter(p => p.completed_at)
          .map(p => p.topic_id)
      )
      setCompletedTopicIds(completed)

      if (moduleRows.length > 0) {
        const moduleIds = moduleRows.map(m => m.id)
        const { data: topicData, error: topicErr } = await supabase
          .from('topics')
          .select('id, module_id, slug, title, sequence_number')
          .in('module_id', moduleIds)
          .eq('content_status', 'published')
          .order('sequence_number', { ascending: true })

        if (topicErr) {
          console.error('CourseRoadmapPage topics fetch error:', topicErr)
        } else if (topicData) {
          const grouped: Record<string, TopicRow[]> = {}
          for (const topic of topicData as TopicRow[]) {
            if (!grouped[topic.module_id]) grouped[topic.module_id] = []
            grouped[topic.module_id].push(topic)
          }
          setTopicsByModule(grouped)
        }
      }

      setLoading(false)
    }
    load()
  }, [courseSlug])

  function moduleProgress(moduleId: string): { done: number; total: number } {
    const topics = topicsByModule[moduleId] ?? []
    const done = topics.filter(t => completedTopicIds.has(t.id)).length
    return { done, total: topics.length }
  }

  function moduleStatus(index: number, moduleId: string): 'done' | 'active' | 'locked' {
    const { done, total } = moduleProgress(moduleId)
    if (total > 0 && done === total) return 'done'
    if (index === 0) return 'active'
    const prevModule = modules[index - 1]
    if (!prevModule) return 'active'
    const prev = moduleProgress(prevModule.id)
    if (prev.total > 0 && prev.done === prev.total) return 'active'
    return 'locked'
  }

  const overallDone = Object.values(topicsByModule).flat().filter(t => completedTopicIds.has(t.id)).length
  const overallTotal = Object.values(topicsByModule).flat().length
  const overallPct = overallTotal > 0 ? Math.round((overallDone / overallTotal) * 100) : 0

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: CANVAS, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: MUTED }}>Loading course...</div>
      </div>
    )
  }

  if (notFound || !course) {
    return (
      <div style={{ minHeight: '100vh', background: CANVAS, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: INK, marginBottom: 8 }}>Course not found</div>
          <div onClick={() => router.push('/learn')} style={{ fontSize: 13, color: BLUE, cursor: 'pointer' }}>
            ← Back to Learn
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: CANVAS, paddingBottom: 84 }}>
      {/* TOPBAR */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50, background: CANVAS,
        padding: '16px 16px 12px', borderBottom: '1px solid #ecebf3',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div onClick={() => router.push('/learn')} style={{ cursor: 'pointer', fontSize: 18, color: INK }}>←</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>{course.title}</div>
      </div>

      {/* PROGRESS SUMMARY */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>
          {[course.institution, course.level, course.duration_label].filter(Boolean).join(' · ')}
        </div>
        <div style={{
          background: '#fff', borderRadius: 16, border: '1px solid #ecebf3',
          padding: 16, display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <svg width="56" height="56" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="24" fill="none" stroke="#ecebf3" strokeWidth="6" />
            <circle
              cx="28" cy="28" r="24" fill="none" stroke={BLUE} strokeWidth="6"
              strokeDasharray={`${overallPct * 1.508} 150.8`}
              strokeLinecap="round"
              transform="rotate(-90 28 28)"
            />
          </svg>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: INK }}>{overallPct}% complete</div>
            <div style={{ fontSize: 12, color: MUTED }}>{overallDone} of {overallTotal} topics done</div>
          </div>
        </div>
      </div>

      {/* MODULE LIST */}
      <div style={{ padding: '20px 16px 0' }}>
        {modules.map((module, index) => {
          const status = moduleStatus(index, module.id)
          const { done, total } = moduleProgress(module.id)
          const topics = topicsByModule[module.id] ?? []
          const isLocked = status === 'locked'

          return (
            <div key={module.id} style={{ marginBottom: 14 }}>
              <div style={{
                background: '#fff', borderRadius: 14, border: '1px solid #ecebf3',
                padding: 14, opacity: isLocked ? 0.55 : 1,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: status === 'done' ? '#e6fff5' : status === 'active' ? '#eef2ff' : '#f3f3f6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700,
                    color: status === 'done' ? '#00a878' : status === 'active' ? BLUE : MUTED,
                  }}>
                    {status === 'done' ? '✓' : String(index + 1).padStart(2, '0')}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>{module.title}</div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                      {module.weeks_label ?? ''}{total > 0 ? ` · ${done}/${total} topics` : ''}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
                    background: status === 'done' ? '#e6fff5' : status === 'active' ? '#eef2ff' : '#f3f3f6',
                    color: status === 'done' ? '#00a878' : status === 'active' ? BLUE : MUTED,
                  }}>
                    {status === 'done' ? 'Done' : status === 'active' ? 'In progress' : 'Locked'}
                  </span>
                </div>

                {!isLocked && topics.length > 0 && (
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {topics.map((topic) => {
                      const isDone = completedTopicIds.has(topic.id)
                      return (
                        <div
                          key={topic.id}
                          onClick={() => router.push(`/learn/${courseSlug}/${module.slug}/${topic.slug}`)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
                            background: CANVAS,
                          }}
                        >
                          <span style={{ fontSize: 13 }}>{isDone ? '✅' : '⬜'}</span>
                          <span style={{ fontSize: 13, color: INK }}>{topic.title}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {modules.length === 0 && (
          <div style={{ fontSize: 13, color: MUTED, textAlign: 'center', padding: '24px 0' }}>
            Module content is being prepared for this course.
          </div>
        )}
      </div>

      <LearnBottomNav />
    </div>
  )
}
EOF

echo "Creating app/learn/[courseSlug]/[moduleSlug]/[topicSlug]/page.tsx ..."
cat > 'app/learn/[courseSlug]/[moduleSlug]/[topicSlug]/page.tsx' << 'EOF'
"use client"
export const dynamic = "force-dynamic"

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const BLUE = '#1A1AFF'
const INK = '#0A0A0F'
const MUTED = '#5A5A6A'
const CANVAS = '#F7F7FB'
const HEALTH = '#00a878'
const HEALTH_BG = '#e6fff5'

interface ContentBlock {
  title: string
  text: string
}

interface TopicRow {
  id: string
  module_id: string
  slug: string
  title: string
  subtitle: string | null
  concept_tab: ContentBlock[] | null
  kenya_context_tab: ContentBlock[] | null
  common_errors_tab: ContentBlock[] | null
  clinical_tip_tab: ContentBlock[] | null
}

interface QuizOption {
  id: string
  label: string
  text: string
}

interface QuizQuestionRow {
  id: string
  question_text: string
  options: QuizOption[]
  correct_option_id: string
  explanation: string | null
}

interface ModuleRow {
  id: string
  title: string
}

interface CourseRow {
  id: string
  title: string
}

type TabKey = 'concept' | 'kenya' | 'practice' | 'errors' | 'clinical'

function ConceptBlocks({ blocks }: { blocks: ContentBlock[] | null }) {
  if (!blocks || blocks.length === 0) {
    return <div style={{ fontSize: 13, color: MUTED }}>Content coming soon.</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {blocks.map((block, i) => (
        <div key={i} style={{
          background: '#fff', borderRadius: 14, border: '1px solid #ecebf3',
          borderLeft: `4px solid ${BLUE}`, padding: 14,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 6 }}>{block.title}</div>
          <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.6 }}>{block.text}</div>
        </div>
      ))}
    </div>
  )
}

function QuizPanel({ topicId }: { topicId: string }) {
  const [questions, setQuestions] = useState<QuizQuestionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedByQuestion, setSelectedByQuestion] = useState<Record<string, string>>({})

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('quiz_questions')
        .select('id, question_text, options, correct_option_id, explanation')
        .eq('topic_id', topicId)

      if (error) {
        console.error('QuizPanel fetch error:', error)
      } else if (data) {
        setQuestions(data as QuizQuestionRow[])
      }
      setLoading(false)
    }
    load()
  }, [topicId])

  function selectOption(questionId: string, optionId: string) {
    setSelectedByQuestion(prev => ({ ...prev, [questionId]: optionId }))
  }

  if (loading) {
    return <div style={{ fontSize: 13, color: MUTED }}>Loading practice questions...</div>
  }

  if (questions.length === 0) {
    return <div style={{ fontSize: 13, color: MUTED }}>Practice questions coming soon.</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {questions.map((q) => {
        const selectedId = selectedByQuestion[q.id]
        const hasAnswered = Boolean(selectedId)
        const isCorrect = selectedId === q.correct_option_id

        return (
          <div key={q.id}>
            <div style={{ fontSize: 14, fontWeight: 600, color: INK, marginBottom: 12, lineHeight: 1.5 }}>
              {q.question_text}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {q.options.map((opt) => {
                const isSelected = selectedId === opt.id
                const isThisCorrect = opt.id === q.correct_option_id
                let bg = '#fff'
                let border = '#ecebf3'
                if (hasAnswered && isThisCorrect) { bg = HEALTH_BG; border = HEALTH }
                else if (hasAnswered && isSelected && !isThisCorrect) { bg = '#fef2f2'; border = '#ef4444' }

                return (
                  <div
                    key={opt.id}
                    onClick={() => !hasAnswered && selectOption(q.id, opt.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '12px 14px', borderRadius: 12,
                      border: `1.5px solid ${border}`, background: bg,
                      cursor: hasAnswered ? 'default' : 'pointer',
                    }}
                  >
                    <div style={{
                      width: 24, height: 24, borderRadius: 8, background: CANVAS,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, color: INK, flexShrink: 0,
                    }}>
                      {opt.label}
                    </div>
                    <span style={{ fontSize: 13, color: INK }}>{opt.text}</span>
                  </div>
                )
              })}
            </div>

            {hasAnswered && (
              <div style={{
                marginTop: 12, padding: 14, borderRadius: 12,
                background: isCorrect ? HEALTH_BG : '#fef2f2',
                borderLeft: `4px solid ${isCorrect ? HEALTH : '#ef4444'}`,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: isCorrect ? '#007a5a' : '#c0392b' }}>
                  {isCorrect ? '✓ Correct!' : '✗ Not quite.'}
                </div>
                {q.explanation && (
                  <div style={{ fontSize: 12, color: MUTED, marginTop: 6, lineHeight: 1.6 }}>
                    {q.explanation}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function TopicDetailPage() {
  const router = useRouter()
  const params = useParams()
  const courseSlug = params.courseSlug as string
  const moduleSlug = params.moduleSlug as string
  const topicSlug = params.topicSlug as string

  const [course, setCourse] = useState<CourseRow | null>(null)
  const [module, setModule] = useState<ModuleRow | null>(null)
  const [topic, setTopic] = useState<TopicRow | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('concept')
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [markingDone, setMarkingDone] = useState(false)
  const [isDone, setIsDone] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: courseData, error: courseErr } = await supabase
        .from('courses')
        .select('id, title')
        .eq('slug', courseSlug)
        .single()

      if (courseErr || !courseData) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setCourse(courseData as CourseRow)

      const { data: moduleData, error: moduleErr } = await supabase
        .from('modules')
        .select('id, title')
        .eq('course_id', courseData.id)
        .eq('slug', moduleSlug)
        .single()

      if (moduleErr || !moduleData) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setModule(moduleData as ModuleRow)

      const { data: topicData, error: topicErr } = await supabase
        .from('topics')
        .select('id, module_id, slug, title, subtitle, concept_tab, kenya_context_tab, common_errors_tab, clinical_tip_tab')
        .eq('module_id', moduleData.id)
        .eq('slug', topicSlug)
        .single()

      if (topicErr || !topicData) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setTopic(topicData as TopicRow)

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: progressData } = await supabase
          .from('learner_progress')
          .select('completed_at')
          .eq('learner_id', user.id)
          .eq('topic_id', topicData.id)
          .maybeSingle()
        setIsDone(Boolean(progressData?.completed_at))
      }

      setLoading(false)
    }
    load()
  }, [courseSlug, moduleSlug, topicSlug])

  async function markComplete() {
    if (!topic || markingDone) return
    setMarkingDone(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setMarkingDone(false)
      router.push('/auth/callback')
      return
    }

    const { error } = await supabase
      .from('learner_progress')
      .upsert(
        { learner_id: user.id, topic_id: topic.id, completed_at: new Date().toISOString() },
        { onConflict: 'learner_id,topic_id' }
      )

    if (error) {
      console.error('markComplete error:', error)
    } else {
      setIsDone(true)
    }
    setMarkingDone(false)
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'concept',  label: '💡 Concept' },
    { key: 'kenya',    label: '🇰🇪 Kenya Context' },
    { key: 'practice', label: '📝 Practice' },
    { key: 'errors',   label: '⚠️ Common Errors' },
    { key: 'clinical', label: '🏥 Clinical Tip' },
  ]

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: CANVAS, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: MUTED }}>Loading topic...</div>
      </div>
    )
  }

  if (notFound || !course || !module || !topic) {
    return (
      <div style={{ minHeight: '100vh', background: CANVAS, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: INK, marginBottom: 8 }}>Topic not found</div>
          <div onClick={() => router.push(`/learn/${courseSlug}`)} style={{ fontSize: 13, color: BLUE, cursor: 'pointer' }}>
            ← Back to roadmap
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: CANVAS, paddingBottom: 32 }}>
      {/* TOPBAR */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50, background: CANVAS,
        padding: '16px 16px 12px', borderBottom: '1px solid #ecebf3',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: MUTED, marginBottom: 8 }}>
          <span onClick={() => router.push(`/learn/${courseSlug}`)} style={{ cursor: 'pointer' }}>{course.title}</span>
          <span>›</span>
          <span>{module.title}</span>
        </div>
        <div style={{ fontSize: 17, fontWeight: 800, color: INK }}>{topic.title}</div>
        {topic.subtitle && (
          <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{topic.subtitle}</div>
        )}
      </div>

      {/* TABS */}
      <div style={{
        display: 'flex', gap: 6, padding: '12px 16px', overflowX: 'auto',
        borderBottom: '1px solid #ecebf3',
      }}>
        {tabs.map((tab) => (
          <div
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flexShrink: 0, padding: '8px 14px', borderRadius: 999, fontSize: 12,
              fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
              background: activeTab === tab.key ? BLUE : '#fff',
              color: activeTab === tab.key ? '#fff' : INK,
              border: activeTab === tab.key ? 'none' : '1px solid #ecebf3',
            }}
          >
            {tab.label}
          </div>
        ))}
      </div>

      {/* TAB CONTENT */}
      <div style={{ padding: 16 }}>
        {activeTab === 'concept' && <ConceptBlocks blocks={topic.concept_tab} />}
        {activeTab === 'kenya' && <ConceptBlocks blocks={topic.kenya_context_tab} />}
        {activeTab === 'practice' && <QuizPanel topicId={topic.id} />}
        {activeTab === 'errors' && <ConceptBlocks blocks={topic.common_errors_tab} />}
        {activeTab === 'clinical' && <ConceptBlocks blocks={topic.clinical_tip_tab} />}
      </div>

      {/* MARK COMPLETE */}
      <div style={{ padding: '0 16px 16px' }}>
        <div
          onClick={markComplete}
          style={{
            textAlign: 'center', padding: '14px', borderRadius: 14,
            background: isDone ? HEALTH_BG : BLUE,
            color: isDone ? HEALTH : '#fff',
            fontSize: 14, fontWeight: 700, cursor: isDone ? 'default' : 'pointer',
          }}
        >
          {isDone ? '✓ Topic completed' : markingDone ? 'Saving...' : 'Mark as complete'}
        </div>
      </div>
    </div>
  )
}
EOF

echo "Creating app/learn/careers/page.tsx ..."
cat > app/learn/careers/page.tsx << 'EOF'
"use client"
export const dynamic = "force-dynamic"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { LearnBottomNav } from '@/components/learn/LearnBottomNav'

const BLUE = '#1A1AFF'
const INK = '#0A0A0F'
const MUTED = '#5A5A6A'
const CANVAS = '#F7F7FB'

interface CourseRow {
  slug: string
  domain: string
  status: 'live' | 'coming_soon'
}

interface CareerDef {
  emoji: string
  title: string
  domain: string
  institutionLabel: string
}

const CAREERS: CareerDef[] = [
  { emoji: '👩‍⚕️', title: 'A Nurse',         domain: 'health',    institutionLabel: 'KMTC' },
  { emoji: '👨‍🏫', title: 'A Teacher',       domain: 'education', institutionLabel: 'College' },
  { emoji: '💊',   title: 'A Pharmacist',    domain: 'health',    institutionLabel: 'KMTC' },
  { emoji: '🔌',   title: 'An Electrician',  domain: 'trade',     institutionLabel: 'TVET' },
  { emoji: '💻',   title: 'In Tech',         domain: 'tech',      institutionLabel: 'Various' },
]

export default function CareersPage() {
  const router = useRouter()
  const [courses, setCourses] = useState<CourseRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('courses')
        .select('slug, domain, status')

      if (error) {
        console.error('CareersPage courses fetch error:', error)
      } else if (data) {
        setCourses(data as CourseRow[])
      }
      setLoading(false)
    }
    load()
  }, [])

  function liveCourseCountForDomain(domain: string): number {
    return courses.filter(c => c.domain === domain && c.status === 'live').length
  }

  return (
    <div style={{ minHeight: '100vh', background: CANVAS, paddingBottom: 84 }}>
      {/* TOPBAR */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50, background: CANVAS,
        padding: '16px 16px 12px', borderBottom: '1px solid #ecebf3',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div onClick={() => router.push('/learn')} style={{ cursor: 'pointer', fontSize: 18, color: INK }}>←</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>I want to become...</div>
      </div>

      <div style={{ padding: '20px 16px 0' }}>
        {loading ? (
          <div style={{ fontSize: 13, color: MUTED }}>Loading careers...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {CAREERS.map((career) => {
              const liveCount = liveCourseCountForDomain(career.domain)
              const hasLive = liveCount > 0

              return (
                <div
                  key={career.title}
                  onClick={() => router.push('/learn')}
                  style={{
                    background: '#fff', borderRadius: 16, border: '1px solid #ecebf3',
                    padding: 16, textAlign: 'center', cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{career.emoji}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: INK, marginBottom: 4 }}>
                    {career.title}
                  </div>
                  <div style={{ fontSize: 11, color: hasLive ? BLUE : MUTED }}>
                    {hasLive
                      ? `${liveCount} course${liveCount > 1 ? 's' : ''} live · ${career.institutionLabel}`
                      : `Coming soon · ${career.institutionLabel}`}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <LearnBottomNav />
    </div>
  )
}
EOF


echo ""
echo "All Learn files created."
echo ""
echo "NOTE: app/page.tsx was NOT touched by this script."
echo "Manually add this line to your homepage near the existing"
echo "'/global' link, inside the same block as S.exploreLink:"
echo ""
echo '  <a href="/learn" style={{ ...S.exploreLink, marginTop: 8 }}>'
echo '    VibeSchool Learn — KMTC, TVET & College prep →'
echo '  </a>'
echo ""
echo "Next steps:"
echo "1. Run the migration: supabase/migrations/20260619000001_learn_schema.sql"
echo "   (via Supabase SQL editor or CLI)"
echo "2. npx tsc --noEmit   (verify no type errors)"
echo "3. Visit /learn after deploying"
