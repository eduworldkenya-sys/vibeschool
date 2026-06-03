"use client";
export const dynamic = "force-dynamic";

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { createMeeting } from '@/lib/meetings'
import AttendeeSelector from '@/components/admin/meetings/AttendeeSelector'

const C = {
  hero:    '#0a1628',
  emerald: '#10b981',
  navy3:   '#0f5fa8',
  bg:      '#f0f4f8',
  border:  '#e2e8f0',
  muted:   '#64748b',
  white:   '#ffffff',
  red:     '#ef4444',
  surface: '#ffffff',
  text:    '#0f172a',
  textSm:  '#475569',
}

type MeetingType = 'staff' | 'department' | 'parents' | 'board' | 'emergency'
type Confidentiality = 'public' | 'staff_only' | 'board_only'
type LocationMode = 'in_person' | 'virtual' | 'both'

interface Profile {
  id: string
  full_name: string
  avatar_url?: string
}

interface SelectedAttendee {
  profile_id: string
  role: 'attendee' | 'observer'
  is_mandatory: boolean
}

const TYPE_META: Record<MeetingType, { label: string; color: string; bg: string }> = {
  staff:       { label: 'Staff',       color: '#1d4ed8', bg: '#eff6ff' },
  department:  { label: 'Department',  color: '#7c3aed', bg: '#f5f3ff' },
  parents:     { label: 'Parents',     color: '#0891b2', bg: '#ecfeff' },
  board:       { label: 'Board',       color: '#b45309', bg: '#fffbeb' },
  emergency:   { label: 'Emergency',   color: '#dc2626', bg: '#fef2f2' },
}

const DURATION_PILLS = [
  { label: '30 min', value: 30 },
  { label: '1 hr',   value: 60 },
  { label: '1.5 hr', value: 90 },
  { label: '2 hr',   value: 120 },
  { label: 'Custom', value: -1 },
]

function Spinner() {
  return (
    <span style={{
      display: 'inline-block',
      width: 16,
      height: 16,
      border: '2px solid rgba(255,255,255,0.35)',
      borderTopColor: '#fff',
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
    }} />
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: 'block',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase' as const,
      color: C.muted,
      marginBottom: 6,
    }}>
      {children}
    </span>
  )
}

function Field({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ marginBottom: 20, ...style }}>
      {children}
    </div>
  )
}

function Input({
  value, onChange, placeholder, type = 'text', required
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  required?: boolean
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      style={{
        width: '100%',
        boxSizing: 'border-box' as const,
        background: C.bg,
        border: `1.5px solid ${C.border}`,
        borderRadius: 12,
        padding: '11px 14px',
        fontSize: 15,
        color: C.text,
        outline: 'none',
        fontFamily: 'inherit',
      }}
    />
  )
}

function Textarea({
  value, onChange, placeholder, rows = 3
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        width: '100%',
        boxSizing: 'border-box' as const,
        background: C.bg,
        border: `1.5px solid ${C.border}`,
        borderRadius: 12,
        padding: '11px 14px',
        fontSize: 15,
        color: C.text,
        outline: 'none',
        resize: 'vertical' as const,
        fontFamily: 'inherit',
      }}
    />
  )
}

function PillRow<T extends string>({
  options, value, onChange
}: {
  options: { label: string; value: T; color?: string; bg?: string }[]
  value: T | null
  onChange: (v: T) => void
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8 }}>
      {options.map(opt => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              padding: '7px 14px',
              borderRadius: 99,
              border: `1.5px solid ${active ? (opt.color ?? C.hero) : C.border}`,
              background: active ? (opt.bg ?? C.hero) : C.white,
              color: active ? (opt.color ?? C.white) : C.textSm,
              fontWeight: active ? 700 : 500,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function SearchableSelect({
  label, value, onChange, options, placeholder
}: {
  label: string
  value: string
  onChange: (id: string) => void
  options: Profile[]
  placeholder?: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = options.filter(p =>
    p.full_name.toLowerCase().includes(query.toLowerCase())
  )

  const selected = options.find(p => p.id === value)

  return (
    <div style={{ position: 'relative' }}>
      <Label>{label}</Label>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: C.bg,
          border: `1.5px solid ${C.border}`,
          borderRadius: 12,
          padding: '11px 14px',
          cursor: 'pointer',
          fontSize: 15,
          color: selected ? C.text : C.muted,
        }}
      >
        {selected ? selected.full_name : (placeholder ?? 'Select...')}
        <span style={{ color: C.muted, fontSize: 12 }}>▾</span>
      </div>
      {open && (
        <div style={{
          position: 'absolute',
          zIndex: 99,
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          background: C.white,
          border: `1.5px solid ${C.border}`,
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
          maxHeight: 220,
          overflowY: 'auto' as const,
        }}>
          <div style={{ padding: '8px 10px', borderBottom: `1px solid ${C.border}` }}>
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search..."
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: 14,
                color: C.text,
                fontFamily: 'inherit',
              }}
            />
          </div>
          {filtered.length === 0 && (
            <div style={{ padding: '12px 14px', fontSize: 13, color: C.muted }}>No results</div>
          )}
          {filtered.map(p => (
            <div
              key={p.id}
              onClick={() => { onChange(p.id); setQuery(''); setOpen(false) }}
              style={{
                padding: '10px 14px',
                fontSize: 14,
                color: C.text,
                cursor: 'pointer',
                background: p.id === value ? C.bg : 'transparent',
                fontWeight: p.id === value ? 600 : 400,
              }}
            >
              {p.full_name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Divider({ label }: { label: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      margin: '28px 0 20px',
    }}>
      <span style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase' as const,
        color: C.muted,
        whiteSpace: 'nowrap' as const,
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: C.border }} />
    </div>
  )
}

export default function NewMeetingPage() {
  const router = useRouter()
  

  const [authed, setAuthed] = useState<boolean | null>(null)
  const [schoolId, setSchoolId] = useState<string>('')
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [profiles, setProfiles] = useState<Profile[]>([])

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [meetingType, setMeetingType] = useState<MeetingType | null>(null)
  const [confidentiality, setConfidentiality] = useState<Confidentiality | null>('public')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [durationPill, setDurationPill] = useState<number | null>(60)
  const [customDuration, setCustomDuration] = useState('')
  const [locationMode, setLocationMode] = useState<LocationMode>('in_person')
  const [venue, setVenue] = useState('')
  const [meetingLink, setMeetingLink] = useState('')
  const [chairId, setChairId] = useState('')
  const [secretaryId, setSecretaryId] = useState('')
  const [attendees, setAttendees] = useState<SelectedAttendee[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const init = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/admin/login'); return }
      setCurrentUserId(user.id)
      setAuthed(true)

      const { data: profile, error: pErr } = await supabase
        .from('profiles')
        .select('school_id')
        .eq('id', user.id)
        .single()

      if (pErr || !profile?.school_id) throw new Error('Could not load school')
      const sid = profile.school_id as string
      setSchoolId(sid)

      const { data: profs, error: prErr } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('school_id', sid)
        .order('full_name')

      if (prErr) throw prErr
      setProfiles((profs ?? []) as Profile[])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Initialisation failed'
      setError(msg)
      setAuthed(true)
    }
  }, [router, supabase])

  const initRef = useRef(false)
  if (!initRef.current) {
    initRef.current = true
    init()
  }

  const effectiveDuration = durationPill === -1
    ? parseInt(customDuration || '0', 10)
    : (durationPill ?? 0)

  const handleSubmit = async () => {
    setError(null)
    if (!title.trim()) { setError('Meeting title is required.'); return }
    if (!date) { setError('Please choose a date.'); return }
    if (!meetingType) { setError('Please select a meeting type.'); return }

    const scheduledAt = time
      ? new Date(`${date}T${time}`).toISOString()
      : new Date(`${date}T09:00`).toISOString()

    setSaving(true)
    try {
      const meeting = await createMeeting({
        school_id: schoolId,
        title: title.trim(),
        description: description.trim() || null,
        meeting_type: meetingType,
        confidentiality: confidentiality ?? 'public',
        status: 'scheduled',
        chair_id: chairId || null,
        secretary_id: secretaryId || null,
        venue: (locationMode === 'in_person' || locationMode === 'both') ? (venue.trim() || null) : null,
        meeting_link: (locationMode === 'virtual' || locationMode === 'both') ? (meetingLink.trim() || null) : null,
        scheduled_at: scheduledAt,
        duration_mins: effectiveDuration || null,
        created_by: currentUserId,
      })

      if (!meeting?.id) throw new Error('Meeting creation returned no ID')

      if (attendees.length > 0) {
        const rows = attendees.map(a => ({
          meeting_id: meeting.id,
          profile_id: a.profile_id,
          role: a.role,
          is_mandatory: a.is_mandatory,
          rsvp: 'pending',
          attended: false,
        }))
        const { error: aErr } = await supabase
          .from('meeting_attendees')
          .insert(rows)
        if (aErr) throw aErr
      }

      router.push(`/admin/meetings/${meeting.id}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create meeting'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  if (authed === null) {
    return (
      <div style={{
        minHeight: '100vh',
        background: C.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Spinner />
      </div>
    )
  }

  const typeOptions = (Object.keys(TYPE_META) as MeetingType[]).map(k => ({
    label: TYPE_META[k].label,
    value: k,
    color: TYPE_META[k].color,
    bg: TYPE_META[k].bg,
  }))

  const confOptions: { label: string; value: Confidentiality; color?: string; bg?: string }[] = [
    { label: 'Public',     value: 'public',     color: C.emerald, bg: '#ecfdf5' },
    { label: 'Staff Only', value: 'staff_only',  color: '#7c3aed', bg: '#f5f3ff' },
    { label: 'Board Only', value: 'board_only',  color: '#b45309', bg: '#fffbeb' },
  ]

  const locationOptions: { label: string; value: LocationMode }[] = [
    { label: 'In-Person', value: 'in_person' },
    { label: 'Virtual',   value: 'virtual' },
    { label: 'Both',      value: 'both' },
  ]

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input[type="date"], input[type="time"] { color-scheme: light; }
      `}</style>

      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: C.hero,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
      }}>
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: 'none',
            borderRadius: 10,
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: C.white,
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          ←
        </button>
        <span style={{ color: C.white, fontWeight: 700, fontSize: 17 }}>New Meeting</span>
      </div>

      <div style={{
        maxWidth: 600,
        margin: '0 auto',
        padding: '20px 16px 120px',
        background: C.bg,
        minHeight: '100vh',
      }}>
        {error && (
          <div style={{
            background: '#fef2f2',
            border: `1.5px solid #fca5a5`,
            borderRadius: 12,
            padding: '12px 14px',
            color: '#dc2626',
            fontSize: 14,
            marginBottom: 20,
            fontWeight: 500,
          }}>
            {error}
          </div>
        )}

        <Divider label="Basic Info" />

        <Field>
          <Label>Meeting Title *</Label>
          <Input value={title} onChange={setTitle} placeholder="e.g. Term 2 Staff Briefing" required />
        </Field>

        <Field>
          <Label>Description</Label>
          <Textarea value={description} onChange={setDescription} placeholder="Optional agenda overview or context…" />
        </Field>

        <Field>
          <Label>Meeting Type *</Label>
          <PillRow<MeetingType> options={typeOptions} value={meetingType} onChange={setMeetingType} />
        </Field>

        <Field>
          <Label>Confidentiality</Label>
          <PillRow<Confidentiality> options={confOptions} value={confidentiality} onChange={setConfidentiality} />
        </Field>

        <Divider label="Schedule" />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div>
            <Label>Date *</Label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box' as const,
                background: C.bg,
                border: `1.5px solid ${C.border}`,
                borderRadius: 12,
                padding: '11px 14px',
                fontSize: 15,
                color: C.text,
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>
          <div>
            <Label>Time</Label>
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box' as const,
                background: C.bg,
                border: `1.5px solid ${C.border}`,
                borderRadius: 12,
                padding: '11px 14px',
                fontSize: 15,
                color: C.text,
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>
        </div>

        <Field>
          <Label>Duration</Label>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8 }}>
            {DURATION_PILLS.map(dp => {
              const active = durationPill === dp.value
              return (
                <button
                  key={dp.value}
                  type="button"
                  onClick={() => setDurationPill(dp.value)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 99,
                    border: `1.5px solid ${active ? C.hero : C.border}`,
                    background: active ? C.hero : C.white,
                    color: active ? C.white : C.textSm,
                    fontWeight: active ? 700 : 500,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  {dp.label}
                </button>
              )
            })}
          </div>
          {durationPill === -1 && (
            <div style={{ marginTop: 10 }}>
              <Input type="number" value={customDuration} onChange={setCustomDuration} placeholder="Enter minutes (e.g. 45)" />
            </div>
          )}
        </Field>

        <Divider label="Location" />

        <Field>
          <Label>Meeting Format</Label>
          <div style={{ display: 'flex', gap: 8 }}>
            {locationOptions.map(lo => {
              const active = locationMode === lo.value
              return (
                <button
                  key={lo.value}
                  type="button"
                  onClick={() => setLocationMode(lo.value)}
                  style={{
                    flex: 1,
                    padding: '9px 4px',
                    borderRadius: 12,
                    border: `1.5px solid ${active ? C.hero : C.border}`,
                    background: active ? C.hero : C.white,
                    color: active ? C.white : C.textSm,
                    fontWeight: active ? 700 : 500,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  {lo.label}
                </button>
              )
            })}
          </div>
        </Field>

        {(locationMode === 'in_person' || locationMode === 'both') && (
          <Field>
            <Label>Venue</Label>
            <Input value={venue} onChange={setVenue} placeholder="e.g. Staff Room, Block A" />
          </Field>
        )}

        {(locationMode === 'virtual' || locationMode === 'both') && (
          <Field>
            <Label>Meeting Link</Label>
            <Input value={meetingLink} onChange={setMeetingLink} placeholder="https://meet.google.com/…" />
          </Field>
        )}

        <Divider label="People" />

        <Field>
          <SearchableSelect
            label="Chair"
            value={chairId}
            onChange={setChairId}
            options={profiles}
            placeholder="Select chairperson…"
          />
        </Field>

        <Field>
          <SearchableSelect
            label="Secretary"
            value={secretaryId}
            onChange={setSecretaryId}
            options={profiles}
            placeholder="Select secretary…"
          />
        </Field>

        <Field>
          <Label>Attendees</Label>
          <AttendeeSelector
            schoolId={schoolId}
            selected={attendees.map(a => a.profile_id)}
            onChange={(ids: string[]) => setAttendees(ids.map(id => ({ profile_id: id, role: 'attendee' as const, is_mandatory: false })))}
          />
        </Field>

        <div style={{ marginTop: 32 }}>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            style={{
              width: '100%',
              padding: '15px',
              background: saving ? '#334155' : C.hero,
              color: C.white,
              border: 'none',
              borderRadius: 14,
              fontSize: 16,
              fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              transition: 'background 0.15s',
            }}
          >
            {saving ? <><Spinner /> Scheduling…</> : '📅 Schedule Meeting'}
          </button>
        </div>
      </div>
    </>
  )
}
