import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const subjects = {
  cre: { id: '8165d513-035b-4019-9fdb-5b86a27335a1', label: 'Christian Religious Education', source: 'owner-approved:grade4-cre:2026-11-22' },
  'creative-arts': { id: '6d68b57c-565d-4a04-879d-c77f588d6404', label: 'Creative Arts', source: 'owner-paraphrase-2026-11-22' },
} as const

type Row = { id: string; name: string; sub_strand: string; strand_order: number | null; sub_strand_order: number | null; learning_outcomes: string[] | null; source_ref: string | null }

export default async function Grade4PublicCurriculum({ searchParams }: { searchParams: Promise<{ subject?: string }> }) {
  const params = await searchParams
  const selected = params.subject === 'creative-arts' ? 'creative-arts' : 'cre'
  const subject = subjects[selected]
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  let rows: Row[] = []
  let errorMessage = ''
  if (!url || !key) {
    errorMessage = 'Curriculum service is temporarily unavailable.'
  } else {
    // This page deliberately returns only explicitly allowlisted public curriculum fields,
    // scoped to two owner-approved Grade 4 subject maps. No user or teacher records.
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    const result = await db.from('cbc_strands')
      .select('id,name,sub_strand,strand_order,sub_strand_order,learning_outcomes,source_ref')
      .eq('subject_id', subject.id).eq('grade', 'Grade 4')
      .order('strand_order', { ascending: true }).order('sub_strand_order', { ascending: true })
    if (result.error) errorMessage = 'The curriculum could not be loaded.'
    else rows = ((result.data ?? []) as Row[]).filter(r => selected === 'cre'
      ? r.source_ref === subject.source
      : Boolean(r.source_ref?.includes(subject.source)))
  }
  const grouped = new Map<string, Row[]>()
  for (const row of rows) grouped.set(row.name, [...(grouped.get(row.name) ?? []), row])
  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px', lineHeight: 1.65 }}>
      <nav aria-label="Curriculum navigation"><Link href="/learn">Learn</Link> / Grade 4 / Curriculum</nav>
      <h1>Grade 4 curriculum</h1>
      <p>Browse the curriculum without creating an account.</p>
      <nav aria-label="Subjects" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <Link href="/learn/grade-4/curriculum?subject=cre" aria-current={selected === 'cre' ? 'page' : undefined}>Christian Religious Education</Link>
        <Link href="/learn/grade-4/curriculum?subject=creative-arts" aria-current={selected === 'creative-arts' ? 'page' : undefined}>Creative Arts</Link>
      </nav>
      <h2>{subject.label}</h2>
      {selected === 'creative-arts' && <p>Learning objectives below are VibeSchool-original paraphrases aligned to the KICD curriculum. Swimming and Indigenous Kenyan Games are alternatives, not two compulsory units.</p>}
      {errorMessage && <p role="alert">{errorMessage}</p>}
      {!errorMessage && rows.length === 0 && <p role="status">No published curriculum map is available.</p>}
      {[...grouped.entries()].map(([strand, units]) => (
        <section key={strand} aria-label={strand}>
          <h3>{strand}</h3>
          {units.map(unit => (
            <details key={unit.id} style={{ borderBottom: '1px solid #8885', padding: '12px 0' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{unit.sub_strand}</summary>
              <h4>Learning objectives</h4>
              <ol>{(unit.learning_outcomes ?? []).map((outcome, i) => <li key={i}>{outcome}</li>)}</ol>
            </details>
          ))}
        </section>
      ))}
    </main>
  )
}
