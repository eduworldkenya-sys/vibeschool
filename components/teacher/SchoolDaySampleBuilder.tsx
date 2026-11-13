'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { C, Card, Btn, SectionLabel } from '@/components/teacher/ui'
import { periodAppearance } from '@/lib/timetable/periodAppearance'
import { SCHOOL_DAY_SAMPLES, isSampleBlock, sampleBlockErrors, personalSchoolDayKey, parsePersonalSchoolDay, type PersonalSchoolDayPlan, type SampleBlock } from '@/lib/timetable/schoolDaySamples'

type SavedSample = { id: string; name: string; blocks: SampleBlock[] }
type Props = {
  schoolId: string; userId: string; schoolName: string;
  canManage: boolean; periodCount: number; onReload: () => Promise<void>;
  mode?: 'starter' | 'editor'; initialSampleId?: string | null;
  onSampleChosen?: (sampleId: string) => void;
}
const DAYS = ['Every school day','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const TYPES = ['lesson','break','lunch','assembly','games','club','prep','staff_meeting','guidance','examination','school_event','free','custom']
const input: React.CSSProperties = { border: '1px solid #cbd5e1', borderRadius: 8, padding: 8, width: '100%', minWidth: 0, boxSizing: 'border-box' }
const clone = (blocks: readonly SampleBlock[]) => blocks.map(block => ({ ...block }))

/**
 * Personal plans stay browser-local, separate from scheduled lessons.
 * Authoritative school blocks still require the existing admin-checked RPCs.
 * Never auto-apply a sample.
 */
export default function SchoolDaySampleBuilder({ schoolId, userId, schoolName, canManage, periodCount, onReload, mode = 'editor', initialSampleId, onSampleChosen }: Props) {
  const [choice, setChoice] = useState('')
  const [draft, setDraft] = useState<SampleBlock[]>([])
  const [draftName, setDraftName] = useState('')
  const [saved, setSaved] = useState<SavedSample[]>([])
  const [activePersonal, setActivePersonal] = useState<PersonalSchoolDayPlan | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const key = 'vs.school-day-drafts.v1.' + userId + '.' + schoolId
  useEffect(() => {
    try {
      setActivePersonal(parsePersonalSchoolDay(window.localStorage.getItem(personalSchoolDayKey(userId, schoolId))))
    } catch { setActivePersonal(null) }
  }, [userId, schoolId])
  useEffect(() => {
    setChoice('')
    setDraft([])
    setDraftName('')
    setMessage('')
    setError('')
    try {
      const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? '[]')
      if (!Array.isArray(parsed)) { setSaved([]); return }
      const safe = parsed.filter((item): item is SavedSample => {
        if (!item || typeof item !== 'object') return false
        const data = item as Partial<SavedSample>
        return typeof data.id === 'string' && typeof data.name === 'string'
          && data.name.length <= 100 && Array.isArray(data.blocks)
          && sampleBlockErrors(data.blocks).length === 0
      }).slice(0, 30)
      setSaved(safe)
    } catch { setSaved([]) }
  }, [key])

  useEffect(() => {
    if (mode !== 'editor' || !initialSampleId) return
    const sample = SCHOOL_DAY_SAMPLES.find(item => item.id === initialSampleId)
    if (!sample) return
    setChoice(sample.id)
    setDraft(clone(sample.blocks))
    setDraftName(sample.name)
    setMessage('Sample opened for editing. No lessons or school periods have changed.')
  }, [initialSampleId, mode, key])

  function rememberChoice(sampleId: string) {
    // A browser-local, user-scoped display preference, not a school setting.
    try { window.localStorage.setItem('vs.timetable.sample-picked.v1.' + userId, sampleId) } catch { /* samples remain usable without storage */ }
    onSampleChosen?.(sampleId)
  }

  const problems = sampleBlockErrors(draft)
  const canApply = canManage && periodCount === 0 && draft.length > 0 && problems.length === 0 && !busy

  function loadSample() {
    setError(''); setMessage('')
    if (choice === 'custom') { setDraft([]); setDraftName('My school day'); return }
    const existing = saved.find(item => 'saved:' + item.id === choice)
    const builtin = SCHOOL_DAY_SAMPLES.find(item => item.id === choice)
    if (!existing && !builtin) { setError('Choose a sample first.'); return }
    setDraft(clone((existing ?? builtin)!.blocks))
    setDraftName(existing?.name ?? builtin!.name)
    rememberChoice(choice)
    setMessage('Sample loaded as an editable draft. Nothing has been changed in the school timetable.')
  }

  function change(i: number, changes: Partial<SampleBlock>) {
    setDraft(rows => rows.map((row, index) => {
      if (index !== i) return row
      const updated = { ...row, ...changes }
      if (updated.kind !== 'lesson') updated.protected = true
      return updated
    }))
    setError(''); setMessage('')
  }

  function saveOnDevice() {
    setError(''); setMessage('')
    if (problems.length) { setError(problems[0]); return }
    if (!draftName.trim() || draftName.trim().length > 100) { setError('Name your template (up to 100 characters).'); return }
    try {
      const next = [{ id: crypto.randomUUID(), name: draftName.trim(), blocks: clone(draft) }, ...saved].slice(0, 30)
      window.localStorage.setItem(key, JSON.stringify(next))
      setSaved(next)
      setMessage('Saved on this device only. Export the file to use it on another device or share it.')
    } catch { setError('Browser storage is unavailable. Export the template file instead.') }
  }

  function useOnMyTimetable() {
    setError(''); setMessage('')
    if (problems.length) { setError(problems[0]); return }
    if (!draftName.trim() || draftName.trim().length > 100) { setError('Name your timetable before using it.'); return }
    const plan: PersonalSchoolDayPlan = {
      name: draftName.trim(), blocks: clone(draft), activatedAt: new Date().toISOString(),
    }
    try {
      window.localStorage.setItem(personalSchoolDayKey(userId, schoolId), JSON.stringify(plan))
      setActivePersonal(plan)
      rememberChoice(choice || 'personal')
      setMessage('Your personal school-day outline is now active in Timetable on this device. No school-wide periods or lesson assignments were changed.')
    } catch { setError('Browser storage is unavailable. Export your timetable file instead.') }
  }

  function stopPersonalTimetable() {
    try {
      window.localStorage.removeItem(personalSchoolDayKey(userId, schoolId))
      setActivePersonal(null)
      setMessage('Your personal school-day outline is no longer active. Saved templates and school lessons are unchanged.')
      setError('')
    } catch { setError('Browser storage is unavailable. Your personal plan could not be cleared.') }
  }

  function exportFile() {
    setError(''); setMessage('')
    if (problems.length) { setError(problems[0]); return }
    const data = { format: 'vibeschool-school-day-template', version: 1, name: draftName.trim() || 'School day', blocks: draft }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url; link.download = 'vibeschool-school-day-template.json'
    document.body.appendChild(link); link.click(); link.remove()
    URL.revokeObjectURL(url)
  }

  async function importFile(file?: File) {
    if (!file) return
    setError(''); setMessage('')
    try {
      if (file.size > 200_000) throw new Error('Template file is too large.')
      const parsed: unknown = JSON.parse(await file.text())
      if (!parsed || typeof parsed !== 'object') throw new Error('Invalid template file.')
      const data = parsed as { format?: unknown; version?: unknown; name?: unknown; blocks?: unknown }
      if (data.format !== 'vibeschool-school-day-template' || data.version !== 1 || !Array.isArray(data.blocks))
        throw new Error('Not a supported VibeSchool timetable template.')
      const issues = sampleBlockErrors(data.blocks)
      if (issues.length) throw new Error(issues[0])
      setDraft(clone(data.blocks.filter(isSampleBlock)))
      setDraftName(typeof data.name === 'string' ? data.name.slice(0, 100) : 'Imported school day')
      setMessage('File opened as a draft. School periods have not changed.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not open template.') }
  }

  async function applyToSchool() {
    if (!canApply) return
    if (!window.confirm('Use these ' + draft.length + ' editable blocks for ' + schoolName + '? Confirm every time with the school. This creates bell periods only — no subject lessons or teaching evidence.')) return
    setBusy(true); setError(''); setMessage('')
    const created: string[] = []
    try {
      // Fail closed against an existing school day, including periods added by
      // another administrator after the draft was opened.
      const [existing, permission] = await Promise.all([
        supabase.rpc('get_school_day_blocks_for_member', { p_school_id: schoolId }),
        supabase.rpc('can_manage_my_school_timetable', { p_school_id: schoolId }),
      ])
      if (existing.error) throw existing.error
      if (permission.error) throw permission.error
      if (!permission.data) throw new Error('Only a school administrator may apply school-wide periods.')
      if ((existing.data ?? []).length > 0) throw new Error('This school already has configured periods. Review them individually; no sample can replace or overwrite them.')

      for (const block of draft) {
        const { data, error: rpcError } = await supabase.rpc('save_school_period_block', {
          p_period_id: null, p_school_id: schoolId, p_schedule_day: block.schedule_day,
          p_label: block.label.trim(), p_start_time: block.start_time, p_end_time: block.end_time,
          p_kind: block.kind, p_protected: block.kind !== 'lesson' || block.protected,
        })
        if (rpcError) throw rpcError
        if (typeof data !== 'string') throw new Error('The server did not return the created period identity.')
        created.push(data)
      }
      setMessage('School-day blocks created. Review the times, then assign subjects and check KICD weekly allocations separately.')
    } catch (e) {
      // Existing per-block RPCs are not atomic. Undo only blocks created in
      // this attempt; if a concurrent user linked a period, leave it intact.
      let failedUndo = 0
      for (const id of created.reverse()) {
        const result = await supabase.rpc('delete_school_period_block', { p_period_id: id })
        if (result.error) failedUndo++
      }
      setError((e instanceof Error ? e.message : 'Could not apply school-day draft.')
        + (failedUndo ? ' ' + failedUndo + ' new blocks could not be rolled back. A school administrator must inspect the remaining periods.' : ' Created blocks were rolled back where permitted.'))
    } finally {
      await onReload()
      setBusy(false)
    }
  }

  if (mode === 'starter') return <Card>
    <SectionLabel>Choose a timetable sample</SectionLabel>
    <p style={{ color: C.textMuted, fontSize: 12, lineHeight: 1.6, margin: '0 0 12px' }}>
      Choose a sample to open it in Timetable setup. You can edit it before saving; this will not create or change any scheduled lessons.
    </p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 }}>
      {SCHOOL_DAY_SAMPLES.map(sample => <button
        key={sample.id}
        type="button"
        aria-label={'Choose ' + sample.name}
        onClick={() => rememberChoice(sample.id)}
        style={{ textAlign: 'left', display: 'grid', alignContent: 'start', gap: 6,
          border: '1px solid ' + C.border, borderRadius: 12, background: C.surface,
          padding: 12, cursor: 'pointer', color: C.textPrimary, fontFamily: 'inherit' }}
      >
        <strong style={{ fontSize: 13 }}>{sample.name}</strong>
        <span style={{ fontSize: 12, color: C.textMuted }}>{sample.description}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.accent }}>Choose & edit in Setup</span>
      </button>)}
    </div>
  </Card>

  return <Card>
    <SectionLabel>Timetable samples and saved templates</SectionLabel>
    <p style={{ color: C.textMuted, fontSize: 12, lineHeight: 1.6, margin: '0 0 12px' }}>
      Examples are never activated automatically. Choose one, edit the clock times and confirm the school's real schedule. Weekly KICD subject allocations, PPI and actual lesson placements remain separate.
    </p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10, marginBottom: 14 }}>
      {SCHOOL_DAY_SAMPLES.map(sample => <button
        key={sample.id}
        type="button"
        disabled={busy}
        aria-label={'Preview and edit ' + sample.name}
        aria-pressed={choice === sample.id && draft.length > 0}
        onClick={() => {
          setChoice(sample.id)
          setDraft(clone(sample.blocks))
          setDraftName(sample.name)
          rememberChoice(sample.id)
          setError('')
          setMessage('Sample opened as an editable draft. No school timetable was changed.')
        }}
        style={{
          textAlign: 'left', display: 'grid', alignContent: 'start', gap: 6,
          border: '1px solid ' + (choice === sample.id && draft.length > 0 ? C.accent : C.border),
          borderRadius: 12, background: C.surface, padding: 12,
          cursor: busy ? 'not-allowed' : 'pointer', color: C.textPrimary, fontFamily: 'inherit',
        }}
      >
        <strong style={{ fontSize: 13 }}>{sample.name}</strong>
        <span style={{ fontSize: 12, color: C.textMuted }}>{sample.description}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.accent }}>Preview & edit</span>
      </button>)}
    </div>
    <div style={{ display: 'grid', gap: 8 }}>
      <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700 }}>
        Starting point
        <select aria-label="Starting timetable sample" value={choice} onChange={e => setChoice(e.target.value)} style={input}>
          <option value="">Choose a sample (optional)</option>
          {SCHOOL_DAY_SAMPLES.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          <option value="custom">Create my own school day</option>
          {saved.map(item => <option key={item.id} value={'saved:' + item.id}>{item.name} (saved on this device)</option>)}
        </select>
      </label>
      {choice && SCHOOL_DAY_SAMPLES.some(item => item.id === choice) && <p style={{ margin: 0, color: C.textMuted, fontSize: 12 }}>
        {SCHOOL_DAY_SAMPLES.find(item => item.id === choice)?.description} {SCHOOL_DAY_SAMPLES.find(item => item.id === choice)?.notes}
      </p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <Btn onClick={loadSample} disabled={!choice || busy}>Preview & edit</Btn>
        <label style={{ fontSize: 12, color: C.accent, cursor: 'pointer' }}>
          Import shared template
          <input aria-label="Import VibeSchool timetable template" type="file" accept=".json,application/json" onChange={e => { void importFile(e.target.files?.[0]); e.target.value = '' }} style={{ display: 'block', maxWidth: 220, fontSize: 11 }} />
        </label>
      </div>
    </div>
    {draft.length > 0 && <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
      <label style={{ fontSize: 12, fontWeight: 700, display: 'grid', gap: 4 }}>
        Template name
        <input aria-label="Template name" value={draftName} maxLength={100} onChange={e => setDraftName(e.target.value)} style={input} />
      </label>
      <p style={{ margin: 0, color: C.textMuted, fontSize: 12 }}>Edit each period below. Non-teaching blocks are always protected.</p>
      {draft.map((block, i) => <div key={i} style={{ border: '1px solid ' + C.border, borderLeft: '3px solid ' + periodAppearance(block.kind).border, background: periodAppearance(block.kind).background, padding: 10, borderRadius: 10, display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
          <strong style={{ fontSize: 12 }}>Block {i + 1}</strong>
          <button type="button" disabled={busy} onClick={() => setDraft(rows => rows.filter((_, n) => n !== i))}
            style={{ border: 0, background: 'transparent', color: '#b91c1c', fontWeight: 700 }}>Remove</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 8 }}>
          <label style={{ fontSize: 11 }}>Day
            <select aria-label={'Block ' + (i + 1) + ' day'} value={block.schedule_day} onChange={e => change(i, { schedule_day: Number(e.target.value) })} style={input}>
              {DAYS.map((d, n) => <option key={d} value={n}>{d}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 11 }}>Activity
            <select aria-label={'Block ' + (i + 1) + ' activity'} value={block.kind} onChange={e => change(i, { kind: e.target.value })} style={input}>
              {TYPES.map(type => <option value={type} key={type}>{type.replaceAll('_', ' ')}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 11 }}>Label
            <input aria-label={'Block ' + (i + 1) + ' label'} maxLength={120} value={block.label} onChange={e => change(i, { label: e.target.value })} style={input} />
          </label>
          <label style={{ fontSize: 11 }}>Start
            <input type="time" aria-label={'Block ' + (i + 1) + ' start'} value={block.start_time} onChange={e => change(i, { start_time: e.target.value })} style={input} />
          </label>
          <label style={{ fontSize: 11 }}>End
            <input type="time" aria-label={'Block ' + (i + 1) + ' end'} value={block.end_time} onChange={e => change(i, { end_time: e.target.value })} style={input} />
          </label>
        </div>
        {block.kind === 'lesson' && <label style={{ fontSize: 12 }}>
          <input type="checkbox" checked={block.protected} onChange={e => change(i, { protected: e.target.checked })} /> Protect from lesson placement
        </label>}
      </div>)}
    </div>}
    {(choice === 'custom' || draft.length > 0) && <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
      <button type="button" disabled={busy || draft.length >= 100} onClick={() => setDraft(rows => [...rows, { schedule_day: 0, label: '', start_time: '', end_time: '', kind: 'lesson', protected: false }])}
        style={{ padding: 10, border: '1px dashed ' + C.border, borderRadius: 8, background: 'transparent', color: C.accent, fontWeight: 700 }}>
        + Add a block
      </button>
      {draft.length > 0 && <>
        {problems.length > 0 && <div role="alert" style={{ color: '#991b1b', fontSize: 12 }}>{problems[0]}</div>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn variant="ghost" onClick={saveOnDevice} disabled={busy || problems.length > 0}>Save My Template (this device)</Btn>
          <Btn variant="ghost" onClick={exportFile} disabled={busy || problems.length > 0}>Export template</Btn>
        </div>
        {periodCount > 0 && <p style={{ fontSize: 12, color: C.textMuted, margin: 0 }}>
          This school already has periods. Samples cannot overwrite them. You can still save and share this draft, or edit existing blocks individually below.
        </p>}
        <Btn onClick={useOnMyTimetable} disabled={busy || problems.length > 0}>Use on my timetable (this device)</Btn>
        {activePersonal && <div role="status" style={{ display: 'grid', gap: 6, fontSize: 12, color: C.textPrimary }}>
          <span><strong>Personal timetable active:</strong> {activePersonal.name} · Visible on this device only.</span>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <a href="/teacher/timetable" style={{ color: C.accent, fontWeight: 700 }}>View my timetable</a>
            <button type="button" onClick={stopPersonalTimetable} style={{ border: 0, background: 'transparent', color: C.textMuted, cursor: 'pointer' }}>Stop using personal plan</button>
          </div>
        </div>}
        {!canManage ? <p style={{ fontSize: 12, color: C.textMuted, margin: 0 }}>
          School-wide publishing is unavailable for {schoolName}. An active school administrator must confirm the school bell times. Your personal timetable can be used without that approval.
        </p> : <Btn onClick={() => void applyToSchool()} disabled={!canApply}>
          {busy ? 'Applying…' : 'Confirm and use for this school'}
        </Btn>}
      </>}
    </div>}
    {error && <div role="alert" style={{ marginTop: 10, fontSize: 12, color: '#991b1b' }}>{error}</div>}
    {message && <div role="status" style={{ marginTop: 10, fontSize: 12, color: '#166534' }}>{message}</div>}
  </Card>
}
