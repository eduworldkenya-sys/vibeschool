"use client";

import React, { useRef, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import {
  VibePublication, PricingModel,
  PublicationGenre, CBCSubject, CBCGrade,
  FORMAT_META,
} from '@/lib/publishTypes'

const SURF   = '#111827'
const CARD   = '#1a2235'
const ACCENT = '#CCFF00'
const TEXT   = '#ffffff'
const MUTED  = 'rgba(255,255,255,0.4)'
const BORDER = 'rgba(255,255,255,0.06)'

interface Props {
  publication: VibePublication
  isOpen:      boolean
  onClose:     () => void
  onUpdate:    (patch: Partial<VibePublication>) => void
  onPublish:   () => Promise<boolean>
}

const GENRES: { value: PublicationGenre; label: string }[] = [
  { value: 'fiction', label: 'Fiction' },
  { value: 'non_fiction', label: 'Non-Fiction' },
  { value: 'romance', label: 'Romance' },
  { value: 'thriller', label: 'Thriller' },
  { value: 'biography', label: 'Biography' },
  { value: 'self_help', label: 'Self Help' },
  { value: 'religion', label: 'Religion' },
  { value: 'academic', label: 'Academic' },
  { value: 'children', label: 'Children' },
  { value: 'poetry', label: 'Poetry' },
  { value: 'magazine', label: 'Magazine' },
  { value: 'other', label: 'Other' },
]

const CBC_SUBJECTS: { value: CBCSubject; label: string }[] = [
  { value: 'mathematics', label: 'Mathematics' },
  { value: 'english', label: 'English' },
  { value: 'kiswahili', label: 'Kiswahili' },
  { value: 'science', label: 'Science & Technology' },
  { value: 'biology', label: 'Biology' },
  { value: 'chemistry', label: 'Chemistry' },
  { value: 'physics', label: 'Physics' },
  { value: 'agriculture', label: 'Agriculture' },
  { value: 'social_studies', label: 'Social Studies' },
  { value: 'creative_arts', label: 'Creative Arts' },
  { value: 'physical_education', label: 'Physical Education' },
  { value: 'religious_education', label: 'Religious Education' },
  { value: 'other', label: 'Other' },
]

const CBC_GRADES: { value: CBCGrade; label: string }[] = [
  { value: 'pp1', label: 'PP1' }, { value: 'pp2', label: 'PP2' },
  { value: 'grade1', label: 'Grade 1' }, { value: 'grade2', label: 'Grade 2' },
  { value: 'grade3', label: 'Grade 3' }, { value: 'grade4', label: 'Grade 4' },
  { value: 'grade5', label: 'Grade 5' }, { value: 'grade6', label: 'Grade 6' },
  { value: 'grade7', label: 'Grade 7' }, { value: 'grade8', label: 'Grade 8' },
  { value: 'grade9', label: 'Grade 9' }, { value: 'form1', label: 'Form 1' },
  { value: 'form2', label: 'Form 2' }, { value: 'form3', label: 'Form 3' },
  { value: 'form4', label: 'Form 4' },
]

export function PublicationSetupDrawer({ publication, isOpen, onClose, onUpdate, onPublish }: Props) {
  const [publishing, setPublishing] = useState(false)
  const [success, setSuccess] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [priceInput, setPriceInput] = useState('')
  const [validErr, setValidErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const meta = FORMAT_META[publication.format]
  const isTextbook = publication.format === 'vibetextbook'

  const uploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const rawExt = file.name.includes('.') ? file.name.split('.').pop() : undefined
    const ext = rawExt ? rawExt.toLowerCase().replace(/[^a-z0-9]/g, '') : 'png'
    if (!['jpg','jpeg','png','gif','webp'].includes(ext)) return
    setUploadingCover(true)
    try {
      const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
      const path = `${crypto.randomUUID()}.${ext}`
      const { error } = await sb.storage.from('vibe-publication-covers').upload(path, file)
      if (!error) {
        const { data } = sb.storage.from('vibe-publication-covers').getPublicUrl(path)
        onUpdate({ cover_url: data.publicUrl })
      }
    } finally {
      setUploadingCover(false)
    }
  }

  const addTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !tagInput.trim()) return
    e.preventDefault()
    const tag = tagInput.trim().toLowerCase()
    if (!publication.tags.includes(tag)) onUpdate({ tags: [...publication.tags, tag] })
    setTagInput('')
  }

  const applyPricing = (type: PricingModel['type']) => {
    const n = Number(priceInput) || 0
    let pricing: PricingModel
    if (type === 'free') pricing = { type: 'free' }
    else if (type === 'paid') pricing = { type: 'paid', priceKsh: n || 100 }
    else if (type === 'freemium') pricing = { type: 'freemium', freeChapters: 3, priceKsh: n || 50 }
    else if (type === 'donation') pricing = { type: 'donation', suggestedKsh: n || 50 }
    else pricing = { type: 'school_license', perStudentKsh: 200, schoolKsh: 15000 }
    onUpdate({ pricing })
  }

  const wasAlreadyLive = publication.status === 'published'

  const handlePublish = async () => {
    if (!publication.title?.trim()) { setValidErr('Title is required'); return }
    if (isTextbook && !publication.cbc_subject?.trim()) { setValidErr('Select the curriculum subject before publishing this textbook.'); return }
    if (isTextbook && !publication.cbc_grade?.trim()) { setValidErr('Select the grade or form before publishing this textbook.'); return }
    setValidErr(null)
    setPublishing(true)
    const ok = await onPublish()
    setPublishing(false)
    if (ok) setSuccess(true)
  }

  const inp: React.CSSProperties = {
    width: '100%', background: CARD, border: '1px solid ' + BORDER,
    borderRadius: 10, padding: '10px 14px', color: TEXT, fontSize: 14,
    outline: 'none', boxSizing: 'border-box',
  }
  const pill = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 24, fontSize: 12, fontWeight: 600,
    cursor: 'pointer', border: '1px solid ' + (active ? ACCENT : BORDER),
    background: active ? 'rgba(204,255,0,0.1)' : CARD,
    color: active ? ACCENT : MUTED,
  })
  const lbl: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: '0.1em',
    display: 'block', marginBottom: 8,
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300 }} />
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: SURF, borderTop: '1px solid ' + BORDER, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: '24px 20px 40px', zIndex: 310, boxSizing: 'border-box', maxHeight: '92dvh', overflowY: 'auto' }}>
        {success ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: TEXT, margin: '0 0 8px' }}>{wasAlreadyLive ? 'Update published' : 'Published'}</h3>
            <p style={{ color: MUTED, fontSize: 14, margin: '0 0 24px' }}>A revision snapshot was saved with this publication state.</p>
            <button onClick={() => { setSuccess(false); onClose() }} style={{ background: ACCENT, color: '#090D16', border: 'none', borderRadius: 12, padding: '12px 28px', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>Done</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 10, color: ACCENT, fontWeight: 800, letterSpacing: '0.1em' }}>CONTENT STUDIO</div>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: '4px 0 0', color: TEXT }}>{wasAlreadyLive ? `Update ${meta.label}` : `Prepare ${meta.label}`}</h3>
              </div>
              <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '50%', width: 28, height: 28, color: TEXT, cursor: 'pointer' }}>✕</button>
            </div>

            {validErr && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#ef4444', marginBottom: 16 }}>{validErr}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <span style={lbl}>COVER IMAGE</span>
                {publication.cover_url ? (
                  <div style={{ position: 'relative' }}>
                    <img src={publication.cover_url} alt="Cover" style={{ width: '100%', height: 170, objectFit: 'cover', borderRadius: 12 }} />
                    <button onClick={() => fileRef.current?.click()} style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.75)', border: '1px solid ' + BORDER, color: TEXT, borderRadius: 8, padding: '5px 10px', cursor: 'pointer' }}>Change</button>
                  </div>
                ) : <button onClick={() => fileRef.current?.click()} style={{ width: '100%', border: '2px dashed ' + BORDER, borderRadius: 12, padding: 24, background: 'transparent', color: MUTED, cursor: 'pointer' }}>{uploadingCover ? 'Uploading…' : 'Add cover image'}</button>}
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={uploadCover} />
              </div>

              <div><span style={lbl}>TITLE</span><input style={inp} value={publication.title || ''} placeholder="e.g. Form 4 Biology" onChange={e => onUpdate({ title: e.target.value })} /></div>
              <div><span style={lbl}>DESCRIPTION</span><textarea style={{ ...inp, minHeight: 80, resize: 'vertical' }} value={publication.description || ''} placeholder="What this resource teaches and who it is for" onChange={e => onUpdate({ description: e.target.value || null })} /></div>

              <div><span style={lbl}>GENRE</span><div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{GENRES.map(g => <button key={g.value} onClick={() => onUpdate({ genre: g.value })} style={pill(publication.genre === g.value)}>{g.label}</button>)}</div></div>

              {isTextbook && (
                <>
                  <div>
                    <span style={lbl}>CURRICULUM SUBJECT</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{CBC_SUBJECTS.map(s => <button key={s.value} onClick={() => onUpdate({ cbc_subject: s.value })} style={pill(publication.cbc_subject === s.value)}>{s.label}</button>)}</div>
                  </div>
                  <div>
                    <span style={lbl}>GRADE / FORM</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{CBC_GRADES.map(g => <button key={g.value} onClick={() => onUpdate({ cbc_grade: g.value })} style={pill(publication.cbc_grade === g.value)}>{g.label}</button>)}</div>
                  </div>
                  <div style={{ background: 'rgba(96,165,250,.08)', border: '1px solid rgba(96,165,250,.2)', borderRadius: 10, padding: 12, color: '#bfdbfe', fontSize: 12, lineHeight: 1.6 }}>
                    Selecting a subject and form identifies the book. Verified curriculum outcomes are linked separately at unit level; this screen does not invent curriculum claims.
                  </div>
                </>
              )}

              <div>
                <span style={lbl}>MONETISATION</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{(['free','paid','freemium','donation'] as PricingModel['type'][]).map(t => <button key={t} onClick={() => applyPricing(t)} style={pill(publication.pricing.type === t)}>{t}</button>)}{isTextbook && <button onClick={() => applyPricing('school_license')} style={pill(publication.pricing.type === 'school_license')}>School licence</button>}</div>
                {publication.pricing.type !== 'free' && publication.pricing.type !== 'school_license' && <input value={priceInput} onChange={e => setPriceInput(e.target.value.replace(/[^0-9]/g, ''))} placeholder="KES amount" inputMode="numeric" style={{ ...inp, marginTop: 10 }} />}
              </div>

              <div>
                <span style={lbl}>TAGS</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>{publication.tags.map(tag => <button key={tag} onClick={() => onUpdate({ tags: publication.tags.filter(t => t !== tag) })} style={{ ...pill(false), cursor: 'pointer' }}>{tag} ×</button>)}</div>
                <input style={inp} value={tagInput} placeholder="Type tag and press Enter" onChange={e => setTagInput(e.target.value)} onKeyDown={addTag} />
              </div>

              <button onClick={handlePublish} disabled={publishing} style={{ width: '100%', padding: 14, background: publishing ? 'rgba(204,255,0,.45)' : ACCENT, color: '#090D16', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: publishing ? 'not-allowed' : 'pointer' }}>{publishing ? 'Publishing…' : wasAlreadyLive ? 'Publish update' : 'Publish'}</button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
