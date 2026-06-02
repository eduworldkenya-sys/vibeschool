"use client";

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const C = {
  hero:      '#0a1628',
  heroMid:   '#0d2347',
  emerald:   '#10b981',
  emeraldLt: '#d1fae5',
  bg:        '#f0f4f8',
  border:    '#e2e8f0',
  surface:   '#ffffff',
  text:      '#0f172a',
  muted:     '#64748b',
  warning:   '#f59e0b',
  warningLt: '#fef3c7',
  error:     '#ef4444',
  errorLt:   '#fee2e2',
  navy3:     '#0f5fa8',
}

type ProjectStatus = 'draft' | 'pending_approval' | 'active' | 'at_risk' | 'completed' | 'cancelled'
type ProjectType   = 'infrastructure' | 'academic' | 'community'

interface Project {
  project_id:           string
  school_id:            string
  title:                string
  project_type:         ProjectType | null
  status:               ProjectStatus
  start_date:           string | null
  end_date:             string | null
  planned:              number
  owner_id:             string | null
  owner_name:           string | null
  budget_line_id:       string | null
  at_risk_ack:          boolean
  spent:                number
  pending_confirmation: number
  remaining:            number
  milestones_total:     number
  milestones_done:      number
  created_at:           string
  updated_at:           string
}

interface BudgetLine {
  id:    string
  label: string | null
  term:  string
  year:  number
  amount: number
}

interface StaffMember {
  id:        string
  full_name: string
}

const STATUS_META: Record<ProjectStatus, { label: string; color: string; bg: string }> = {
  draft:            { label: 'Draft',            color: C.muted,   bg: '#f1f5f9' },
  pending_approval: { label: 'Pending Approval', color: '#92400e', bg: '#fef3c7' },
  active:           { label: 'Active',           color: '#065f46', bg: '#d1fae5' },
  at_risk:          { label: 'At Risk',          color: '#92400e', bg: '#fee2e2' },
  completed:        { label: 'Completed',        color: '#1e3a5f', bg: '#dbeafe' },
  cancelled:        { label: 'Cancelled',        color: '#4b5563', bg: '#f3f4f6' },
}

const TYPE_META: Record<string, { label: string; icon: string }> = {
  infrastructure: { label: 'Infrastructure', icon: '🏗️' },
  academic:       { label: 'Academic',       icon: '📚' },
  community:      { label: 'Community',      icon: '🤝' },
}

function Skeleton({ h = 56, r = 12 }: { h?: number; r?: number }) {
  return (
    <div style={{
      height:          h,
      borderRadius:    r,
      background:      'linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)',
      backgroundSize:  '200% 100%',
      animation:       'shimmer 1.4s infinite',
    }} />
  )
}

function fmt(n: number) {
  if (n >= 1_000_000) return `KES ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `KES ${(n / 1_000).toFixed(0)}K`
  return `KES ${n.toLocaleString()}`
}

function pct(spent: number, planned: number) {
  if (!planned) return 0
  return Math.min(100, Math.round((spent / planned) * 100))
}

export default function ProjectsPage() {
  const router = useRouter()

  const [projects,     setProjects]     = useState<Project[]>([])
  const [budgetLines,  setBudgetLines]  = useState<BudgetLine[]>([])
  const [staff,        setStaff]        = useState<StaffMember[]>([])
  const [schoolId,     setSchoolId]     = useState<string | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [filter,       setFilter]       = useState<ProjectStatus | 'all'>('all')
  const [showForm,     setShowForm]     = useState(false)
  const [submitting,   setSubmitting]   = useState(false)
  const [toast,        setToast]        = useState<{ msg: string; ok: boolean } | null>(null)

  const [form, setForm] = useState({
    title:          '',
    project_type:   '' as ProjectType | '',
    budget_line_id: '',
    owner_id:       '',
    start_date:     '',
    end_date:       '',
    budget:         '',
    description:    '',
  })

  useEffect(() => { boot() }, [])

  async function boot() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: p } = await supabase
        .from('profiles')
        .select('school_id')
        .eq('id', user.id)
        .single()

      if (!p?.school_id) return
      setSchoolId(p.school_id)
      await load(p.school_id)
    } catch {
      showToast('Failed to load', false)
    } finally {
      setLoading(false)
    }
  }

  async function load(sid: string) {
    const [projRes, budgetRes, staffRes] = await Promise.all([
      supabase
        .from('v_project_summary')
        .select('*')
        .eq('school_id', sid)
        .order('created_at', { ascending: false }),
      supabase
        .from('finance_budgets')
        .select('id, label, term, year, amount')
        .eq('school_id', sid)
        .order('year', { ascending: false }),
      supabase
        .from('profiles')
        .select('id, full_name')
        .eq('school_id', sid)
        .in('role', ['admin', 'teacher'])
        .order('full_name'),
    ])

    if (projRes.data)   setProjects(projRes.data)
    if (budgetRes.data) setBudgetLines(budgetRes.data)
    if (staffRes.data)  setStaff(staffRes.data)
  }

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  async function createProject() {
    if (!form.title.trim())       { showToast('Title is required', false); return }
    if (!form.project_type)       { showToast('Select a project type', false); return }
    if (!form.budget_line_id)     { showToast('Select a budget line', false); return }
    if (!form.budget || isNaN(Number(form.budget))) { showToast('Enter a valid budget', false); return }
    if (!schoolId) return

    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { data: proj, error } = await supabase
        .from('admin_projects')
        .insert({
          school_id:      schoolId,
          title:          form.title.trim(),
          project_type:   form.project_type,
          budget_line_id: form.budget_line_id || null,
          owner_id:       form.owner_id || null,
          start_date:     form.start_date || null,
          end_date:       form.end_date || null,
          budget:         Number(form.budget),
          description:    form.description.trim() || null,
          status:         'draft',
          created_by:     user?.id,
        })
        .select('id')
        .single()

      if (error) throw error

      // Log creation
      await supabase.from('project_log').insert({
        project_id: proj.id,
        school_id:  schoolId,
        actor_id:   user?.id,
        event_type: 'created',
        payload:    { title: form.title, budget: Number(form.budget) },
      })

      showToast('Project created', true)
      setShowForm(false)
      setForm({ title: '', project_type: '', budget_line_id: '', owner_id: '', start_date: '', end_date: '', budget: '', description: '' })
      await load(schoolId)
    } catch {
      showToast('Failed to create project', false)
    } finally {
      setSubmitting(false)
    }
  }

  async function updateStatus(projectId: string, newStatus: ProjectStatus) {
    if (!schoolId) return
    const { error } = await supabase
      .from('admin_projects')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', projectId)
      .eq('school_id', schoolId)

    if (error) { showToast(error.message, false); return }
    showToast('Status updated', true)
    await load(schoolId)
  }

  async function ackRisk(projectId: string) {
    if (!schoolId) return
    await supabase
      .from('admin_projects')
      .update({ at_risk_ack: true, at_risk_ack_at: new Date().toISOString() })
      .eq('id', projectId)
    await load(schoolId)
  }

  const filtered = filter === 'all'
    ? projects
    : projects.filter(p => p.status === filter)

  const counts = {
    all:              projects.length,
    active:           projects.filter(p => p.status === 'active').length,
    at_risk:          projects.filter(p => p.status === 'at_risk').length,
    pending_approval: projects.filter(p => p.status === 'pending_approval').length,
    draft:            projects.filter(p => p.status === 'draft').length,
    completed:        projects.filter(p => p.status === 'completed').length,
    cancelled:        projects.filter(p => p.status === 'cancelled').length,
  }

  const totalPlanned  = projects.filter(p => p.status === 'active' || p.status === 'at_risk').reduce((s, p) => s + (p.planned || 0), 0)
  const totalSpent    = projects.filter(p => p.status === 'active' || p.status === 'at_risk').reduce((s, p) => s + (p.spent || 0), 0)
  const totalPending  = projects.reduce((s, p) => s + (p.pending_confirmation || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <style>{`
        @keyframes shimmer {
          0%   { background-position:  200% 0 }
          100% { background-position: -200% 0 }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px) }
          to   { opacity: 1; transform: translateY(0) }
        }
        @keyframes fadeIn {
          from { opacity: 0 }
          to   { opacity: 1 }
        }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position:     'fixed',
          bottom:       80,
          left:         '50%',
          transform:    'translateX(-50%)',
          background:   toast.ok ? C.hero : C.error,
          color:        '#fff',
          padding:      '12px 20px',
          borderRadius: 12,
          fontSize:     13,
          fontWeight:   600,
          zIndex:       999,
          whiteSpace:   'nowrap',
          boxShadow:    '0 8px 24px rgba(0,0,0,0.2)',
          animation:    'fadeIn 0.2s ease',
        }}>
          {toast.ok ? '✓' : '✕'} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: 0 }}>Projects</h1>
          <p style={{ fontSize: 13, color: C.muted, margin: '2px 0 0' }}>
            Track school initiatives and expenditure
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{
            background:   `linear-gradient(135deg, ${C.emerald}, #059669)`,
            color:        '#fff',
            border:       'none',
            borderRadius: 10,
            padding:      '10px 16px',
            fontSize:     13,
            fontWeight:   700,
            cursor:       'pointer',
            display:      'flex',
            alignItems:   'center',
            gap:          6,
            boxShadow:    '0 4px 12px rgba(16,185,129,0.3)',
          }}
        >
          <span style={{ fontSize: 16 }}>+</span> New Project
        </button>
      </div>

      {/* Summary cards */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[1,2,3].map(i => <Skeleton key={i} h={72} />)}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[
            { label: 'Active Budget',  value: fmt(totalPlanned),  sub: `${counts.active + counts.at_risk} projects`, color: C.navy3 },
            { label: 'Total Spent',    value: fmt(totalSpent),    sub: `${totalPlanned ? pct(totalSpent, totalPlanned) : 0}% of active`, color: C.emerald },
            { label: 'Needs Approval', value: fmt(totalPending),  sub: `${projects.filter(p => p.pending_confirmation > 0).length} transactions`, color: counts.at_risk > 0 ? C.error : C.warning },
          ].map((card, i) => (
            <div key={i} style={{
              background:   C.surface,
              borderRadius: 12,
              padding:      '12px 14px',
              border:       `1px solid ${C.border}`,
              animation:    `slideUp 0.3s ease ${i * 0.06}s both`,
            }}>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 4 }}>{card.label}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: card.color }}>{card.value}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{card.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* At-risk banner */}
      {!loading && counts.at_risk > 0 && (
        <div style={{
          background:   C.errorLt,
          border:       `1px solid #fca5a5`,
          borderRadius: 12,
          padding:      '12px 16px',
          display:      'flex',
          alignItems:   'center',
          gap:          10,
        }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.error }}>
              {counts.at_risk} project{counts.at_risk > 1 ? 's' : ''} at risk
            </div>
            <div style={{ fontSize: 12, color: '#7f1d1d', marginTop: 2 }}>
              Over budget threshold or past deadline. Review immediately.
            </div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
        {([
          ['all',              'All'],
          ['active',           'Active'],
          ['at_risk',          'At Risk'],
          ['pending_approval', 'Pending'],
          ['draft',            'Draft'],
          ['completed',        'Done'],
        ] as [ProjectStatus | 'all', string][]).map(([key, label]) => {
          const active = filter === key
          const count  = counts[key as keyof typeof counts]
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              style={{
                flexShrink:   0,
                padding:      '7px 14px',
                borderRadius: 20,
                border:       active ? 'none' : `1px solid ${C.border}`,
                background:   active ? C.hero : C.surface,
                color:        active ? '#fff' : C.muted,
                fontSize:     12,
                fontWeight:   600,
                cursor:       'pointer',
                display:      'flex',
                alignItems:   'center',
                gap:          6,
              }}
            >
              {label}
              {count > 0 && (
                <span style={{
                  background:   active ? 'rgba(255,255,255,0.2)' : C.bg,
                  borderRadius: 10,
                  padding:      '1px 7px',
                  fontSize:     11,
                }}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Project list */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1,2,3].map(i => <Skeleton key={i} h={140} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign:    'center',
          padding:      '48px 0',
          color:        C.muted,
          background:   C.surface,
          borderRadius: 16,
          border:       `1px solid ${C.border}`,
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🚀</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            {filter === 'all' ? 'No projects yet' : `No ${filter.replace('_', ' ')} projects`}
          </div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            {filter === 'all' ? "Create your first project to get started" : "Change the filter to see other projects"}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((p, i) => {
            const meta      = STATUS_META[p.status]
            const typeMeta  = p.project_type ? TYPE_META[p.project_type] : null
            const spentPct  = pct(p.spent, p.planned)
            const isOverBudget = p.spent > p.planned

            return (
              <div
                key={p.project_id}
                style={{
                  background:   C.surface,
                  borderRadius: 16,
                  border:       `1px solid ${p.status === 'at_risk' ? '#fca5a5' : C.border}`,
                  overflow:     'hidden',
                  animation:    `slideUp 0.3s ease ${i * 0.04}s both`,
                  boxShadow:    p.status === 'at_risk' ? '0 0 0 3px rgba(239,68,68,0.08)' : 'none',
                }}
              >
                {/* Card header */}
                <div style={{ padding: '14px 16px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {typeMeta && (
                          <span style={{ fontSize: 13 }}>{typeMeta.icon}</span>
                        )}
                        <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{p.title}</span>
                        <span style={{
                          fontSize:     11,
                          fontWeight:   700,
                          color:        meta.color,
                          background:   meta.bg,
                          padding:      '2px 9px',
                          borderRadius: 20,
                        }}>
                          {meta.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
                        {typeMeta?.label ?? 'No type set'}
                        {p.owner_name ? ` · ${p.owner_name}` : ''}
                        {p.end_date ? ` · Due ${new Date(p.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                      </div>
                    </div>
                  </div>

                  {/* Budget progress */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                      <span style={{ color: C.muted }}>
                        Spent <strong style={{ color: isOverBudget ? C.error : C.text }}>{fmt(p.spent)}</strong>
                        {p.pending_confirmation > 0 && (
                          <span style={{ color: C.warning }}> + {fmt(p.pending_confirmation)} pending</span>
                        )}
                      </span>
                      <span style={{ color: C.muted }}>
                        of <strong style={{ color: C.text }}>{fmt(p.planned)}</strong>
                      </span>
                    </div>
                    <div style={{ height: 6, background: C.bg, borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{
                        height:       '100%',
                        width:        `${spentPct}%`,
                        background:   isOverBudget
                          ? C.error
                          : spentPct > 90
                          ? C.warning
                          : `linear-gradient(90deg, ${C.emerald}, #059669)`,
                        borderRadius: 6,
                        transition:   'width 0.6s ease',
                      }} />
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 3, textAlign: 'right' }}>
                      {fmt(p.remaining)} remaining · {spentPct}%
                    </div>
                  </div>

                  {/* Milestone progress */}
                  {p.milestones_total > 0 && (
                    <div style={{
                      display:      'flex',
                      alignItems:   'center',
                      gap:          8,
                      marginBottom: 12,
                      fontSize:     12,
                      color:        C.muted,
                    }}>
                      <span>📌</span>
                      <span>{p.milestones_done}/{p.milestones_total} milestones</span>
                      <div style={{ flex: 1, height: 4, background: C.bg, borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{
                          height:     '100%',
                          width:      `${pct(p.milestones_done, p.milestones_total)}%`,
                          background: C.navy3,
                          borderRadius: 4,
                        }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* At-risk ack */}
                {p.status === 'at_risk' && !p.at_risk_ack && (
                  <div style={{
                    margin:       '0 16px 12px',
                    background:   C.errorLt,
                    border:       `1px solid #fca5a5`,
                    borderRadius: 8,
                    padding:      '8px 12px',
                    display:      'flex',
                    alignItems:   'center',
                    justifyContent: 'space-between',
                    gap:          8,
                  }}>
                    <span style={{ fontSize: 12, color: '#7f1d1d', fontWeight: 600 }}>
                      ⚠️ This project has been flagged at risk
                    </span>
                    <button
                      onClick={() => ackRisk(p.project_id)}
                      style={{
                        background:   C.error,
                        color:        '#fff',
                        border:       'none',
                        borderRadius: 6,
                        padding:      '5px 10px',
                        fontSize:     11,
                        fontWeight:   700,
                        cursor:       'pointer',
                        flexShrink:   0,
                      }}
                    >
                      Acknowledge
                    </button>
                  </div>
                )}

                {/* Actions */}
                <div style={{
                  padding:        '10px 16px',
                  borderTop:      `1px solid ${C.border}`,
                  display:        'flex',
                  gap:            8,
                  background:     '#fafbfc',
                  justifyContent: 'flex-end',
                }}>
                  {p.status === 'draft' && (
                    <ActionBtn
                      label="Submit for Approval"
                      color={C.warning}
                      onClick={() => updateStatus(p.project_id, 'pending_approval')}
                    />
                  )}
                  {p.status === 'pending_approval' && (
                    <>
                      <ActionBtn
                        label="Approve"
                        color={C.emerald}
                        onClick={() => updateStatus(p.project_id, 'active')}
                      />
                      <ActionBtn
                        label="Reject"
                        color={C.error}
                        onClick={() => updateStatus(p.project_id, 'draft')}
                      />
                    </>
                  )}
                  {(p.status === 'active' || p.status === 'at_risk') && (
                    <ActionBtn
                      label="Mark Complete"
                      color={C.navy3}
                      onClick={() => updateStatus(p.project_id, 'completed')}
                    />
                  )}
                  {p.status !== 'cancelled' && p.status !== 'completed' && (
                    <ActionBtn
                      label="Cancel"
                      color={C.muted}
                      onClick={() => updateStatus(p.project_id, 'cancelled')}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* New Project Form Modal */}
      {showForm && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}
          style={{
            position:        'fixed',
            inset:           0,
            background:      'rgba(0,0,0,0.55)',
            zIndex:          100,
            display:         'flex',
            alignItems:      'flex-end',
            justifyContent:  'center',
            backdropFilter:  'blur(4px)',
            animation:       'fadeIn 0.2s ease',
          }}
        >
          <div style={{
            background:    C.surface,
            borderRadius:  '20px 20px 0 0',
            width:         '100%',
            maxWidth:      900,
            maxHeight:     '90vh',
            overflowY:     'auto',
            padding:       '20px 20px 40px',
            animation:     'slideUp 0.3s ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: C.text, margin: 0 }}>New Project</h2>
              <button
                onClick={() => setShowForm(false)}
                style={{ background: C.bg, border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: C.muted }}
              >✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Title *">
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Classroom Block Renovation"
                  style={inputStyle}
                />
              </Field>

              <Field label="Project Type *">
                <select
                  value={form.project_type}
                  onChange={e => setForm(f => ({ ...f, project_type: e.target.value as ProjectType }))}
                  style={inputStyle}
                >
                  <option value="">Select type</option>
                  <option value="infrastructure">🏗️ Infrastructure</option>
                  <option value="academic">📚 Academic</option>
                  <option value="community">🤝 Community</option>
                </select>
              </Field>

              <Field label="Budget Line *">
                <select
                  value={form.budget_line_id}
                  onChange={e => setForm(f => ({ ...f, budget_line_id: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="">Select budget line</option>
                  {budgetLines.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.label ?? b.term} {b.year} — {fmt(b.amount)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Budget (KES) *">
                <input
                  type="number"
                  value={form.budget}
                  onChange={e => setForm(f => ({ ...f, budget: e.target.value }))}
                  placeholder="0"
                  min="0"
                  style={inputStyle}
                />
              </Field>

              <Field label="Project Owner">
                <select
                  value={form.owner_id}
                  onChange={e => setForm(f => ({ ...f, owner_id: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="">Select owner (optional)</option>
                  {staff.map(s => (
                    <option key={s.id} value={s.id}>{s.full_name}</option>
                  ))}
                </select>
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Start Date">
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                    style={inputStyle}
                  />
                </Field>
                <Field label="End Date">
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                    style={inputStyle}
                  />
                </Field>
              </div>

              <Field label="Description">
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="What is this project trying to achieve?"
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </Field>

              <div style={{
                background:   '#fffbeb',
                border:       '1px solid #fde68a',
                borderRadius: 10,
                padding:      '10px 14px',
                fontSize:     12,
                color:        '#92400e',
              }}>
                ℹ️ Projects start as <strong>Draft</strong>. Submit for approval before work begins. Budget is only committed once approved.
              </div>

              <button
                onClick={createProject}
                disabled={submitting}
                style={{
                  background:   submitting ? C.muted : `linear-gradient(135deg, ${C.emerald}, #059669)`,
                  color:        '#fff',
                  border:       'none',
                  borderRadius: 12,
                  padding:      '14px',
                  fontSize:     14,
                  fontWeight:   700,
                  cursor:       submitting ? 'not-allowed' : 'pointer',
                  marginTop:    4,
                  boxShadow:    submitting ? 'none' : '0 4px 12px rgba(16,185,129,0.3)',
                }}
              >
                {submitting ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ActionBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background:   'none',
        border:       `1px solid ${color}`,
        borderRadius: 8,
        padding:      '6px 12px',
        fontSize:     12,
        fontWeight:   600,
        color:        color,
        cursor:       'pointer',
      }}
    >
      {label}
    </button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width:        '100%',
  padding:      '11px 14px',
  borderRadius: 10,
  border:       '1.5px solid #e2e8f0',
  fontSize:     14,
  color:        '#0f172a',
  background:   '#f8fafc',
  outline:      'none',
  boxSizing:    'border-box',
}
