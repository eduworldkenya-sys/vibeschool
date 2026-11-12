'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { hqSupabase } from '@/lib/hq/supabase'
import { VISUAL_PLACEMENTS, VISUAL_TYPES, VISUAL_MAX_BYTES } from '@/lib/visual-library/contract'

type Context = { id: string; title: string; grade: string; subject: string }
type Visual = {
  id: string; title: string; grade: string; subject: string; description: string; type: string;
  caption: string; altText: string; labels: string[]; placements: string[];
  lifecycle: string; createdAt: string; previewUrl: string | null; referenceToken: string
}

const input: React.CSSProperties = {
  display: 'block', width: '100%', minHeight: 43, border: '1px solid #455973', borderRadius: 9,
  background: '#102239', color: '#f8fafc', padding: '9px 11px', font: 'inherit', boxSizing: 'border-box',
}
const panel: React.CSSProperties = { background: '#0d1b2f', border: '1px solid #283b56', borderRadius: 14, padding: 17 }
const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6, color: '#c7d7e8' }
const button: React.CSSProperties = { borderRadius: 9, border: 0, background: '#c7a35a', color: '#08192d', minHeight: 44, padding: '9px 14px', fontWeight: 800, cursor: 'pointer' }
function titleCase(text: string) { return text.replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase()) }

async function hqRequest(path: string, options?: RequestInit) {
  const { data: { session } } = await hqSupabase.auth.getSession()
  if (!session) throw Error('Your HQ session has expired. Sign in again.')
  const response = await fetch(path, {
    ...options, cache: 'no-store',
    headers: { ...(options?.headers || {}), Authorization: 'Bearer ' + session.access_token },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw Error(typeof data.error === 'string' ? data.error : 'Request failed.')
  return data
}

export default function HQVisualLearningLibrary() {
  const [grade, setGrade] = useState('4')
  const [subjectSearch, setSubjectSearch] = useState('')
  const [contexts, setContexts] = useState<Context[]>([])
  const [sourceStrandId, setSourceResourceId] = useState('')
  const [visuals, setVisuals] = useState<Visual[]>([])
  const [title, setTitle] = useState('')
  const [topicKey, setTopicKey] = useState('')
  const [description, setDescription] = useState('')
  const [altText, setAltText] = useState('')
  const [caption, setCaption] = useState('')
  const [labels, setLabels] = useState('')
  const [visualType, setVisualType] = useState<(typeof VISUAL_TYPES)[number]>('diagram')
  const [placement, setPlacement] = useState<(typeof VISUAL_PLACEMENTS)[number]>('explanation')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadVisuals = useCallback(async () => {
    try {
      const data = await hqRequest('/api/hq/visual-library?grade=' + encodeURIComponent(grade))
      setVisuals(Array.isArray(data.visuals) ? data.visuals : [])
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load visuals.') }
    finally { setLoading(false) }
  }, [grade])

  useEffect(() => { setLoading(true); void loadVisuals() }, [loadVisuals])

  useEffect(() => {
    let mounted = true
    void hqRequest('/api/hq/visual-library?contexts=1&grade=' + encodeURIComponent(grade) + '&search=' + encodeURIComponent(subjectSearch))
      .then(data => { if (mounted) { setContexts(Array.isArray(data.contexts) ? data.contexts : []); setSourceResourceId('') } })
      .catch(err => { if (mounted) { setContexts([]); setError(err instanceof Error ? err.message : 'Could not load curriculum.') } })
    return () => { mounted = false }
  }, [grade, subjectSearch])

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(''); setMessage('')
    if (!file || file.size > VISUAL_MAX_BYTES) { setError('Choose a PNG, JPG, WebP or GIF image up to 5 MB.'); return }
    if (!sourceStrandId) { setError('Select the curriculum lesson this visual supports.'); return }
    setBusy(true)
    try {
      const data = new FormData()
      const fields = { title, topicKey, description, altText, caption, labels, visualType, placement, sourceStrandId }
      Object.entries(fields).forEach(([key,value]) => data.append(key, value))
      data.append('file', file)
      const result = await hqRequest('/api/hq/visual-library', { method: 'POST', body: data })
      setMessage(result.message || 'Visual saved privately.')
      setTitle(''); setDescription(''); setAltText(''); setCaption(''); setLabels(''); setTopicKey(''); setFile(null)
      const fileInput = document.getElementById('visual-file') as HTMLInputElement | null
      if (fileInput) fileInput.value = ''
      await loadVisuals()
    } catch (err) { setError(err instanceof Error ? err.message : 'Upload failed.') }
    finally { setBusy(false) }
  }

  return <main style={{ background: '#07111f', color: '#f8fafc', minHeight: '100dvh', padding: '20px 14px 70px', fontFamily: 'Inter,system-ui,sans-serif' }}>
    <div style={{ maxWidth: 1120, margin: '0 auto', display: 'grid', gap: 18 }}>
      <div><Link href="/hq/content" style={{ color: '#c8d9f0', textDecoration: 'none', fontSize: 13 }}>← Content Release</Link>
        <h1 style={{ fontSize: 26, margin: '9px 0 5px' }}>Visual Learning Library</h1>
        <p style={{ color: '#adbfd4', fontSize: 14, lineHeight: 1.5, maxWidth: 780 }}>
          Store diagrams and illustrations once. Link them to curriculum content by visual ID. Draft images remain private until the existing review and publication process certifies them.
        </p>
      </div>
      {error && <div role="alert" style={{ color: '#fecaca', padding: 12, background: '#38222b', borderRadius: 10 }}>{error}</div>}
      {message && <div role="status" style={{ color: '#bbf7d0', padding: 12, background: '#173b31', borderRadius: 10 }}>{message}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px),1fr))', gap: 16, alignItems: 'start' }}>
        <form onSubmit={e => void upload(e)} style={{ ...panel, display: 'grid', gap: 13 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Add a visual</h2>
          <div><label htmlFor="vgrade" style={label}>Grade</label><select id="vgrade" style={input} value={grade} onChange={e => setGrade(e.target.value)}>
            {Array.from({length:9},(_,i)=><option key={i+1} value={String(i+1)}>Grade {i+1}</option>)}
          </select></div>
          <div><label htmlFor="vsubject" style={label}>Find subject</label><input id="vsubject" style={input} placeholder="e.g. Mathematics" value={subjectSearch} onChange={e=>setSubjectSearch(e.target.value)}/></div>
          <div><label htmlFor="vcontext" style={label}>Curriculum sub-strand to support</label><select id="vcontext" required style={input} value={sourceStrandId} onChange={e=>setSourceResourceId(e.target.value)}>
            <option value="">Choose sub-strand</option>
            {contexts.map(row=><option key={row.id} value={row.id}>{row.subject} · {row.title}</option>)}
          </select>{!contexts.length && <small style={{color:'#d7af70'}}>No curriculum sub-strands found. Search for the subject, or check its curriculum map.</small>}</div>
          <div><label htmlFor="vtitle" style={label}>Visual title</label><input id="vtitle" required maxLength={140} style={input} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Equivalent fractions – shaded bars"/></div>
          <div><label htmlFor="vtopic" style={label}>Topic key</label><input id="vtopic" required maxLength={100} style={input} value={topicKey} onChange={e=>setTopicKey(e.target.value)} placeholder="equivalent-fractions"/></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div><label htmlFor="vtype" style={label}>Visual type</label><select id="vtype" style={input} value={visualType} onChange={e=>setVisualType(e.target.value as typeof visualType)}>
              {VISUAL_TYPES.map(v=><option key={v} value={v}>{titleCase(v)}</option>)}
            </select></div>
            <div><label htmlFor="vplacement" style={label}>Used in</label><select id="vplacement" style={input} value={placement} onChange={e=>setPlacement(e.target.value as typeof placement)}>
              {VISUAL_PLACEMENTS.map(v=><option key={v} value={v}>{titleCase(v)}</option>)}
            </select></div>
          </div>
          <div><label htmlFor="valt" style={label}>Describe what learners can see (alt text)</label><textarea id="valt" required minLength={8} maxLength={300} style={{...input,minHeight:75}} value={altText} onChange={e=>setAltText(e.target.value)} placeholder="Three equal rectangles showing one-half, two-quarters and four-eighths shaded."/></div>
          <div><label htmlFor="vcaption" style={label}>Caption</label><input id="vcaption" style={input} maxLength={300} value={caption} onChange={e=>setCaption(e.target.value)} placeholder="Equal parts can represent the same fraction."/></div>
          <div><label htmlFor="vlabels" style={label}>Labels (comma-separated)</label><input id="vlabels" style={input} value={labels} onChange={e=>setLabels(e.target.value)} maxLength={300} placeholder="1/2, 2/4, 4/8"/></div>
          <div><label htmlFor="vdesc" style={label}>Production notes (optional)</label><textarea id="vdesc" style={{...input,minHeight:65}} value={description} maxLength={1000} onChange={e=>setDescription(e.target.value)}/></div>
          <div><label htmlFor="visual-file" style={label}>Image file · PNG, JPG, WebP, GIF</label>
            <input id="visual-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" required onChange={e=>setFile(e.target.files?.[0]||null)} style={{color:'#e2e8f0',maxWidth:'100%'}}/></div>
          <button style={{...button,opacity:busy?0.6:1}} type="submit" disabled={busy}>{busy?'Saving…':'Save private visual draft'}</button>
          <small style={{color:'#adc1d5',lineHeight:1.5}}>Saving a draft does not publish it. A certified version and public root are required before learners can see it.</small>
        </form>

        <section style={{...panel,display:'grid',gap:13}}>
          <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center'}}>
            <h2 style={{margin:0,fontSize:18}}>Saved visuals</h2><button type="button" onClick={()=>void loadVisuals()} style={{...button,background:'#233b57',color:'#f8fafc'}}>Refresh</button>
          </div>
          {loading?<p role="status">Loading visuals…</p>:visuals.length===0?<p style={{color:'#afc1d6'}}>No visual assets saved for this grade yet.</p>:
            <div style={{display:'grid',gap:12}}>{visuals.map(v=><article key={v.id} style={{border:'1px solid #334966',borderRadius:10,padding:12,display:'grid',gap:9}}>
              <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'start'}}><div><strong>{v.title}</strong><div style={{color:'#bacde0',fontSize:12,marginTop:4}}>{v.subject} · {titleCase(v.type)}</div></div>
                <span style={{fontSize:11,color:v.lifecycle==='certified'?'#9ee1bb':'#f0c47f'}}>{v.lifecycle}</span></div>
              {v.previewUrl && <img src={v.previewUrl} alt={v.altText} loading="lazy" style={{maxWidth:'100%',maxHeight:230,objectFit:'contain',background:'#fff',borderRadius:8}}/>}
              {v.caption && <div style={{color:'#c5d4e2',fontSize:13}}>{v.caption}</div>}
              <code style={{fontSize:11,color:'#b5c4d8',overflowWrap:'anywhere'}}>{v.referenceToken}</code>
              <button type="button" style={{...button,background:'#233b57',color:'#f8fafc'}} onClick={()=>void navigator.clipboard.writeText(v.referenceToken)}>Copy visual reference</button>
            </article>)}</div>}
        </section>
      </div>
    </div>
  </main>
}
