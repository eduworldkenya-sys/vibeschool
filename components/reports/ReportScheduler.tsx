"use client";
'use client'

import { useEffect, useState } from 'react'
import { getSchedules, toggleSchedule, deleteSchedule, ReportSchedule } from '@/lib/reports/queries/schedules'

const REPORT_TYPES = [
  'Academic — Grade Performance',
  'Academic — Homework Analysis',
  'Attendance — Student',
  'Attendance — Staff',
  'Finance — Fee Collection',
  'Finance — Budget vs Actual',
  'Staff — Directory',
  'Operational — Visitor Log',
]

const FREQUENCIES: { value: ReportSchedule['frequency']; label: string }[] = [
  { value: 'daily',       label: 'Daily (7:00 AM)' },
  { value: 'weekly',      label: 'Weekly (Monday 7:00 AM)' },
  { value: 'end_of_term', label: 'End of Term' },
]

interface ReportSchedulerProps {
  schoolId: string
  userId: string
}

export default function ReportScheduler({ schoolId, userId }: ReportSchedulerProps) {
  const [schedules, setSchedules] = useState<ReportSchedule[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const [form, setForm] = useState({
    report_type: REPORT_TYPES[0],
    frequency: 'weekly' as ReportSchedule['frequency'],
    recipients: '',
  })

  async function load() {
    setLoading(true)
    try {
      const data = await getSchedules(schoolId)
      setSchedules(data)
    } catch (e) {
      setError('Failed to load schedules.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [schoolId])

  async function handleCreate() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/reports/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_id:   schoolId,
          report_type: form.report_type,
          frequency:   form.frequency,
          recipients:  form.recipients.split(',').map(r => r.trim()).filter(Boolean),
          filters:     {},
        }),
      })
      if (!res.ok) throw new Error('Failed to create schedule')
      setShowForm(false)
      setForm({ report_type: REPORT_TYPES[0], frequency: 'weekly', recipients: '' })
      await load()
    } catch {
      setError('Failed to save schedule.')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(id: string, current: boolean) {
    try {
      await toggleSchedule(id, !current)
      setSchedules(prev => prev.map(s => s.id === id ? { ...s, is_active: !current } : s))
    } catch {
      setError('Failed to update schedule.')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteSchedule(id)
      setSchedules(prev => prev.filter(s => s.id !== id))
    } catch {
      setError('Failed to delete schedule.')
    }
  }

  const freqLabel = (f: string) => FREQUENCIES.find(x => x.value === f)?.label ?? f

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Scheduled Reports</h3>
          <p className="text-xs text-slate-500 mt-0.5">Auto-generate and deliver reports on a schedule</p>
        </div>
        <button
          onClick={() => setShowForm(p => !p)}
          className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
        >
          + Schedule
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="rounded-xl bg-slate-800/60 border border-slate-700 p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">New Schedule</p>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Report Type</label>
            <select
              value={form.report_type}
              onChange={e => setForm(p => ({ ...p, report_type: e.target.value }))}
              className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-sm rounded-lg px-3 py-2"
            >
              {REPORT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Frequency</label>
            <select
              value={form.frequency}
              onChange={e => setForm(p => ({ ...p, frequency: e.target.value as ReportSchedule['frequency'] }))}
              className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-sm rounded-lg px-3 py-2"
            >
              {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Recipients (comma-separated emails)</label>
            <input
              type="text"
              value={form.recipients}
              onChange={e => setForm(p => ({ ...p, recipients: e.target.value }))}
              placeholder="principal@school.ac.ke, admin@school.ac.ke"
              className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-sm rounded-lg px-3 py-2 placeholder-slate-500"
            />
            <p className="text-xs text-slate-500 mt-1">⚠️ Email delivery active once email provider is configured.</p>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCreate}
              disabled={saving}
              className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save Schedule'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Schedule list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map(i => (
            <div key={i} className="h-16 rounded-xl bg-slate-700/40 animate-pulse" />
          ))}
        </div>
      ) : schedules.length === 0 ? (
        <div className="rounded-xl bg-slate-800/40 border border-slate-700/50 px-4 py-8 text-center">
          <p className="text-slate-500 text-sm">No schedules yet. Create one above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {schedules.map(s => (
            <div
              key={s.id}
              className="rounded-xl bg-slate-800/60 border border-slate-700 px-4 py-3 flex items-center justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200 font-medium truncate">{s.report_type}</p>
                <p className="text-xs text-slate-500 mt-0.5">{freqLabel(s.frequency)}</p>
                {s.recipients.length > 0 && (
                  <p className="text-xs text-slate-600 mt-0.5 truncate">{s.recipients.join(', ')}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Toggle */}
                <button
                  onClick={() => handleToggle(s.id, s.is_active)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    s.is_active ? 'bg-indigo-600' : 'bg-slate-600'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    s.is_active ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
                {/* Delete */}
                <button
                  onClick={() => handleDelete(s.id)}
                  className="text-slate-500 hover:text-red-400 transition-colors text-base"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
