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
  { value: 'fiction',     label: 'Fiction'     },
  { value: 'non_fiction', label: 'Non-Fiction'  },
  { value: 'romance',     label: 'Romance'      },
  { value: 'thriller',    label: 'Thriller'     },
  { value: 'biography',   label: 'Biography'    },
  { value: 'self_help',   label: 'Self Help'    },
  { value: 'religion',    label: 'Religion'     },
  { value: 'academic',    label: 'Academic'     },
  { value: 'children',    label: 'Children'     },
  { value: 'poetry',      label: 'Poetry'       },
  { value: 'magazine',    label: 'Magazine'     },
  { value: 'other',       label: 'Other'        },
]

const CBC_SUBJECTS: { value: CBCSubject; label: string }[] = [
  { value: 'mathematics',        label: 'Mathematics'        },
  { value: 'english',            label: 'English'            },
  { value: 'kiswahili',          label: 'Kiswahili'          },
  { value: 'science',            label: 'Science & Tech'     },
  { value: 'biology',            label: 'Biology'            },
  { value: 'chemistry',          label: 'Chemistry'          },
  { value: 'physics',            label: 'Physics'            },
  { value: 'social_studies',     label: 'Social Studies'     },
  { value: 'creative_arts',      label: 'Creative Arts'      },
  { value: 'physical_education', label: 'Physical Education' },
  { value: 'religious_education',label: 'Religious Ed.'      },
  { value: 'other',              label: 'Other'               },
]

const CBC_GRADES: { value: CBCGrade; label: string }[] = [
  { value: 'pp1',    label: 'PP1'     },
  { value: 'pp2',    label: 'PP2'     },
  { value: 'grade1', label: 'Grade 1' },
  { value: 'grade2', label: 'Grade 2' },
  { value: 'grade3', label: 'Grade 3' },
  { value: 'grade4', label: 'Grade 4' },
  { value: 'grade5', label: 'Grade 5' },
  { value: 'grade6', label: 'Grade 6' },
  { value: 'grade7', label: 'Grade 7' },
  { value: 'grade8', label: 'Grade 8' },
  { value: 'grade9', label: 'Grade 9' },
  { value: 'form1',  label: 'Form 1'  },
  { value: 'form2',  label: 'Form 2'  },
  { value: 'form3',  label: 'Form 3'  },
  { value: 'form4',  label: 'Form 4'  },
]

export function PublicationSetupDrawer({ publication, isOpen, onClose, onUpdate, onPublish }: Props) {
  const [publishing,    setPublishing]    = useState(false)
  const [success,       setSuccess]       = useState(false)
  const [uploadingCover,setUploadingCover]= useState(false)
  const [tagInput,      setTagInput]      = useState('')
  const [priceInput,    setPriceInput]    = useState('')
  const [validErr,      setValidErr]      = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const meta        = FORMAT_META[publication.format]
  const isTextbook  = publication.format === 'vibetextbook'

  const uploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const rawExt = file.name.includes('.') ? file.name.split('.').pop() : undefined
    const ext    = rawExt ? rawExt.toLowerCase().replace(/[^a-z0-9]/g, '') : 'png'
    if (!['jpg','jpeg','png','gif','webp'].includes(ext)) return
    if (file.size > 5 * 1024 * 1024) {
      setValidErr('Cover image must be 5 MB or smaller.')
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    setUploadingCover(true)
    setValidErr(null)
    try {
      const sb   = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data: { user } } = await sb.auth.getUser()
      if (!user) throw new Error('Sign in before uploading a cover image')
      const path = `${user.id}/covers/${crypto.randomUUID()}.${ext}`
      const { error: ue } = await sb.storage
        .from('vibe-publication-covers')
        .upload(path, file)
      if (ue) throw ue
      const { data } = sb.storage.from('vibe-publication-covers').getPublicUrl(path)
      onUpdate({ cover_url: data.publicUrl })
    } catch (error) {
      setValidErr(error instanceof Error ? error.message : 'Cover upload failed. Try again.')
    } finally {
      setUploadingCover(false)
      if (fileRef.current) fileRef.current.value = ''
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
    if (type === 'free')           pricing = { type: 'free' }
    else if (type === 'paid')      pricing = { type: 'paid', priceKsh: n || 100 }
    else if (type === 'freemium')  pricing = { type: 'freemium', freeChapters: 3, priceKsh: n || 50 }
    else if (type === 'donation')  pricing = { type: 'donation', suggestedKsh: n || 50 }
    else pricing = { type: 'school_license', perStudentKsh: 200, schoolKsh: 15000 }
    onUpdate({ pricing })
  }

  const wasAlreadyLive = publication.status === 'published'

  const handlePublish = async () => {
    if (!publication.title?.trim()) {
      setValidErr('Title is required')
      return
    }

    if (
      isTextbook &&
      !publication.cbc_subject?.trim()
    ) {
      setValidErr(
        'Select the subject before publishing this textbook.'
      )
      return
    }

    if (
      isTextbook &&
      !publication.cbc_grade?.trim()
    ) {
      setValidErr(
        'Select the grade or form before publishing this textbook.'
      )
      return
    }

    setValidErr(null)
    setPublishing(true)
    const ok = await onPublish()
    setPublishing(false)
    if (ok) setSuccess(true)
  }

  const inp: React.CSSProperties = {
    width: '100%', background: CARD, border: '1px solid ' + BORDER,
    borderRadius: 10, padding: '10px 14px',
    color: TEXT, fontSize: 14, outline: 'none', boxSizing: 'border-box',
  }

  const pill = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 24, fontSize: 12, fontWeight: 600,
    cursor: 'pointer', border: '1px solid ' + (active ? ACCENT : BORDER),
    background: active ? 'rgba(204,255,0,0.1)' : CARD,
    color: active ? ACCENT : MUTED,
  })

  const lbl: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: MUTED,
    letterSpacing: '0.1em', display: 'block', marginBottom: 8,
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480, background: SURF,
        borderTop: '1px solid ' + BORDER,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: '24px 20px 40px', zIndex: 310, boxSizing: 'border-box',
        maxHeight: '92dvh', overflowY: 'auto',
        animation: 'slideUp 0.3s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <style dangerouslySetInnerHTML={{ __html: '@keyframes slideUp{from{transform:translateX(-50%) translateY(100%)}to{transform:translateX(-50%) translateY(0)}}' }} />

        {success ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🚀</div>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: TEXT, margin: '0 0 8px' }}>
              {wasAlreadyLive ? 'Updated!' : 'Published!'}
            </h3>
            <p style={{ color: MUTED, fontSize: 14, margin: '0 0 24px' }}>
              {wasAlreadyLive ? `Your changes to ${meta.label} are live.` : `Your ${meta.label} is now live.`}
            </p>
            <button onClick={() => { setSuccess(false); onClose() }} style={{
              background: ACCENT, color: '#090D16', border: 'none',
              borderRadius: 12, padding: '12px 28px',
              fontSize: 14, fontWeight: 800, cursor: 'pointer',
            }}>Done</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: TEXT }}>
                {wasAlreadyLive ? `Update ${meta.label}` : `Publish ${meta.label}`}
              </h3>
              <button onClick={onClose} style={{
                background: 'rgba(255,255,255,0.06)', border: 'none',
                borderRadius: '50%', width: 28, height: 28,
                color: TEXT, fontSize: 14, cursor: 'pointer',
              }}>✕</button>
            </div>

            {validErr && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 10, padding: '10px 14px',
                fontSize: 13, color: '#ef4444', marginBottom: 16,
              }}>{validErr}</div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Cover */}
              <div>
                <span style={lbl}>COVER IMAGE</span>
                {publication.cover_url ? (
                  <div style={{ position: 'relative' }}>
                    <img src={publication.cover_url} alt="Cover"
                      style={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 12 }} />
                    <button onClick={() => fileRef.current?.click()} style={{
                      position: 'absolute', bottom: 8, right: 8,
                      background: 'rgba(0,0,0,0.7)', border: '1px solid ' + BORDER,
                      color: TEXT, borderRadius: 8, padding: '4px 10px',
                      fontSize: 11, cursor: 'pointer',
                    }}>Change</button>
                  </div>
                ) : (
                  <div onClick={() => fileRef.current?.click()} style={{
                    border: '2px dashed ' + BORDER, borderRadius: 12, padding: '24px',
                    textAlign: 'center', cursor: 'pointer', color: MUTED, fontSize: 13,
                  }}>{uploadingCover ? 'Uploading…' : '📷 Add cover image'}</div>
                )}
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: 'none' }} onChange={uploadCover} />
              </div>

              {/* Title */}
              <div>
                <span style={lbl}>TITLE</span>
                <input style={inp} value={publication.title || ''}
                  placeholder="Title of your work"
                  onChange={e => onUpdate({ title: e.target.value })} />
              </div>

              {/* Description */}
              <div>
                <span style={lbl}>DESCRIPTION</span>
                <textarea style={{ ...inp, minHeight: 80, resize: 'none' as const }}
                  value={publication.description || ''}
                  placeholder="Hook your readers."
                  onChange={e => onUpdate({ description: e.target.value || null })} />
              </div>

              {/* Genre */}
              <div>
                <span style={lbl}>GENRE</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {GENRES.map(g => (
                    <button key={g.value} onClick={() => onUpdate({ genre: g.value })} style={pill(publication.genre === g.value)}>
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Curriculum fields */}
              {isTextbook && (
                <>
                  <div>
                    <span style={lbl}>CURRICULUM</span>
                    <input
                      style={inp}
                      value={publication.curriculum_framework}
                      placeholder="e.g. CBC or KCSE 8-4-4"
                      onChange={e => onUpdate({ curriculum_framework: e.target.value })}
                    />
                  </div>
                  <div>
                    <span style={lbl}>SUBJECT</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {CBC_SUBJECTS.map(s => (
                        <button key={s.value} onClick={() => onUpdate({ cbc_subject: s.value })} style={pill(publication.cbc_subject === s.value)}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span style={lbl}>GRADE / FORM</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {CBC_GRADES.map(g => (
                        <button key={g.value} onClick={() => onUpdate({ cbc_grade: g.value })} style={pill(publication.cbc_grade === g.value)}>
                          {g.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Pricing */}
              <div>
                <span style={lbl}>MONETISATION</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {(['free','paid','freemium','donation'] as PricingModel['type'][]).map(t => (
                    <button key={t} onClick={() => applyPricing(t)} style={pill(publication.pricing.type === t)}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
                {publication.pricing.type !== 'free' && (
                  <input style={inp} inputMode="numeric" value={priceInput}
                    placeholder="Price (KSh)"
                    onChange={e => setPriceInput(e.target.value)} />
                )}
              </div>

              {/* Tags */}
              <div>
                <span style={lbl}>TAGS</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {publication.tags.map(tag => (
                    <button key={tag} onClick={() => onUpdate({ tags: publication.tags.filter(t => t !== tag) })}
                      style={{ ...pill(false), padding: '4px 9px' }}>#{tag} ×</button>
                  ))}
                </div>
                <input style={inp} value={tagInput} placeholder="Type a tag and press Enter"
                  onChange={e => setTagInput(e.target.value)} onKeyDown={addTag} />
              </div>

              <button onClick={handlePublish} disabled={publishing || uploadingCover} style={{
                marginTop: 6, background: ACCENT, color: '#090D16', border: 'none',
                borderRadius: 12, padding: '13px 18px', fontSize: 14, fontWeight: 850,
                cursor: publishing || uploadingCover ? 'default' : 'pointer',
                opacity: publishing || uploadingCover ? 0.55 : 1,
              }}>{publishing ? 'Publishing…' : wasAlreadyLive ? 'Update publication' : 'Publish'}</button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
