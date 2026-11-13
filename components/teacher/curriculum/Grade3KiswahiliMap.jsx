'use client';

import { useMemo, useState } from 'react';
import {
  GRADE3_KISWAHILI_WEEKLY_PERIODS,
  GRADE3_KISWAHILI_SOURCE_CATALOGUE,
  GRADE3_KISWAHILI_SOURCE_DOCUMENT,
} from '@/lib/curriculum/grade3KiswahiliMap.mjs';

const border = '#d9e5dc';
const ink = '#173f32';

export default function Grade3KiswahiliMap({
  units = [], selectedUnitId, onSelectUnit, onOpenScheme,
  schemeCount = 0, loading = false, error = '',
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => units.filter(unit =>
    (unit.strand + ' ' + unit.subStrand + ' ' + unit.outcomes.map(outcome => outcome.text).join(' '))
      .toLocaleLowerCase('sw').includes(query.trim().toLocaleLowerCase('sw'))
  ), [units, query]);
  const selected = units.find(unit => unit.id === selectedUnitId) || units[0] || null;
  const strands = [...new Set(filtered.map(unit => unit.strand))];

  return <section aria-label="Ramani ya mtaala wa Kiswahili wa Gredi ya 3"
    style={{background:'#fff', border:'1px solid ' + border, borderRadius:14, padding:16, color:ink, marginBottom:14}}>
    <div style={{fontSize:11, fontWeight:800, letterSpacing:'.08em', color:'#397652'}}>GREDI YA 3 · KISWAHILI</div>
    <h2 style={{fontSize:22, margin:'5px 0 8px'}}>Ramani ya mtaala</h2>
    <p style={{fontSize:13, lineHeight:1.6, color:'#50675b', margin:'0 0 12px'}}>
      Mada zilizopo kwenye mfumo wa VibeSchool. Huu bado si mtaala wote wa KICD uliohakikiwa neno kwa neno.
    </p>
    <div style={{display:'flex', gap:7, flexWrap:'wrap', marginBottom:14}}>
      <span style={{background:'#eff6f1', padding:'7px 10px', borderRadius:20, fontSize:12}}>Vipindi {GRADE3_KISWAHILI_WEEKLY_PERIODS} kwa wiki</span>
      <span style={{background:'#eff6f1', padding:'7px 10px', borderRadius:20, fontSize:12}}>Mada ndogo zilizohifadhiwa: {units.length}</span>
      <span style={{background:'#eff6f1', padding:'7px 10px', borderRadius:20, fontSize:12}}>Masomo ya Scheme: {schemeCount}</span>
    </div>
    <label htmlFor="grade3-kiswahili-search" style={{display:'block',fontWeight:700,fontSize:13,marginBottom:6}}>Tafuta mada au stadi</label>
    <input id="grade3-kiswahili-search" type="search" value={query} onChange={event => setQuery(event.target.value)}
      placeholder="Mf. Kusoma, Mazungumzo" style={{display:'block',width:'100%',minHeight:44,border:'1px solid #bdcfbf',borderRadius:9,padding:'8px 12px',fontSize:14,marginBottom:12}} />
    {loading ? <p role="status">Inapakia rekodi za mtaala…</p> : error ? <p role="alert" style={{color:'#9f1239'}}>{error}</p> :
      !units.length ? <p role="status">Hakuna mada zilizothibitishwa kwenye hifadhidata ya Kiswahili ya Gredi ya 3.</p> :
      <div style={{display:'grid',gap:12}}>
        <nav aria-label="Chagua mada ndogo ya Kiswahili" style={{display:'grid',gap:10}}>
          {strands.map(strand => <div key={strand}>
            <h3 style={{fontSize:14,margin:'0 0 8px'}}>{strand}</h3>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {filtered.filter(unit => unit.strand === strand).map(unit =>
                <button key={unit.id} type="button" aria-pressed={selected?.id === unit.id}
                  onClick={() => onSelectUnit?.(unit.id)}
                  style={{minHeight:44,borderRadius:9,padding:'8px 11px',fontSize:12,
                    border:'1px solid ' + (selected?.id === unit.id ? ink : border),
                    background:selected?.id === unit.id ? ink : '#fff',color:selected?.id === unit.id ? '#fff' : ink}}>
                  {unit.subStrand}
                </button>
              )}
            </div>
          </div>)}
          {filtered.length === 0 && <p role="status">Hakuna mada inayolingana na utafutaji.</p>}
        </nav>
        {selected && <article style={{background:'#f8faf8',padding:14,border:'1px solid ' + border,borderRadius:12}}>
          <div style={{fontSize:12,color:'#537060'}}>{selected.strand}</div>
          <h3 style={{fontSize:19,margin:'4px 0 10px'}}>{selected.subStrand}</h3>
          <p style={{fontSize:13,lineHeight:1.6,color:'#5a665c'}}>
            {selected.sourceLinked ? 'Rekodi ina kiungo cha chanzo; uhakiki wa matini yote bado unahitajika.' :
              'Mada hii haijaunganishwa na marejeo ya chanzo cha KICD.'}
          </p>
          <h4 style={{fontSize:13,margin:'0 0 6px'}}>Matokeo ya kujifunza yaliyohifadhiwa</h4>
          {selected.outcomes.length ?
            <ol style={{fontSize:13,lineHeight:1.7,paddingLeft:20}}>
              {selected.outcomes.map(outcome => <li key={outcome.id}>{outcome.text}</li>)}
            </ol> :
            <p role="status" style={{fontSize:13,color:'#825b25'}}>
              Bado hakuna matokeo ya kujifunza ya VibeSchool yaliyounganishwa na mada hii. Usihesabu kuwa Scheme imekamilika.
            </p>}
          {onOpenScheme && <button type="button" onClick={() => onOpenScheme(selected.id)}
            style={{minHeight:44,border:0,borderRadius:9,padding:'10px 14px',background:ink,color:'#fff',fontWeight:800}}>
            Fungua Scheme of Work
          </button>}
          <p style={{fontSize:12,lineHeight:1.5,color:'#50675b',margin:'10px 0 0'}}>
            Kufungua Scheme hakuundi somo. Kuhifadhi kunahitaji mwalimu aliyeidhinishwa, wiki halisi na matokeo yaliyothibitishwa.
          </p>
        </article>}
      </div>}
    <p style={{fontSize:12,lineHeight:1.6,color:'#50675b',margin:'13px 0 0'}}>
      <a href={GRADE3_KISWAHILI_SOURCE_CATALOGUE} target="_blank" rel="noopener noreferrer">Orodha ya mitaala ya KICD</a>
      {' · '}
      <a href={GRADE3_KISWAHILI_SOURCE_DOCUMENT} target="_blank" rel="noopener noreferrer">Hati ya marejeo ya Kiswahili Gredi 1–3</a>
    </p>
  </section>;
}
