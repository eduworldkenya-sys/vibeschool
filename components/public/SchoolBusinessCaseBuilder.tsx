'use client'

import { useMemo, useState } from 'react'

type Lane = 'planning' | 'assessment' | 'leadership' | 'family'

const laneMeta: Record<Lane,{label:string;workflow:string;measure:string}> = {
  planning:{label:'Planning & duplicate lesson administration',workflow:'Curriculum → scheme → lesson → teach',measure:'minutes from curriculum position to a ready, teachable lesson without duplicate setup'},
  assessment:{label:'Assessment, marking & recording duplication',workflow:'Evidence → assess → record → next action',measure:'minutes from learner evidence to an actionable result and follow-up'},
  leadership:{label:'Leadership reporting & information chasing',workflow:'Curriculum → teaching → evidence → leadership brief',measure:'time required for leadership to answer the agreed learning question without chasing separate records'},
  family:{label:'Family progress communication',workflow:'Evidence → authorised family context → next step',measure:'time and hand-offs required to give an authorised family a useful progress answer'},
}

function number(value:string,max=100000){const parsed=Number(value);return Number.isFinite(parsed)?Math.min(Math.max(parsed,0),max):0}
function format(value:number){return new Intl.NumberFormat('en-KE',{maximumFractionDigits:1}).format(value)}
function money(value:number){return new Intl.NumberFormat('en-KE',{style:'currency',currency:'KES',maximumFractionDigits:0}).format(value)}

export function SchoolBusinessCaseBuilder(){
  const [teachers,setTeachers]=useState('')
  const [weeks,setWeeks]=useState('')
  const [target,setTarget]=useState('')
  const [hourlyCost,setHourlyCost]=useState('')
  const [minutes,setMinutes]=useState<Record<Lane,string>>({planning:'',assessment:'',leadership:'',family:''})
  const result=useMemo(()=>{
    const t=number(teachers,5000), w=number(weeks,52), reduction=Math.min(number(target,100),100), hourly=number(hourlyCost,100000)
    const laneHours=Object.fromEntries((Object.keys(laneMeta) as Lane[]).map(lane=>[lane,t*w*number(minutes[lane],1440)/60])) as Record<Lane,number>
    const total=Object.values(laneHours).reduce((sum,value)=>sum+value,0)
    const recovered=total*(reduction/100)
    const top=(Object.keys(laneMeta) as Lane[]).sort((a,b)=>laneHours[b]-laneHours[a])[0]
    return {teachers:t,weeks:w,reduction,hourly,laneHours,total,recovered,capacityValue:recovered*hourly,top}
  },[teachers,weeks,target,hourlyCost,minutes])
  const ready=result.teachers>0&&result.weeks>0&&result.reduction>0&&result.total>0
  const topMeta=laneMeta[result.top]
  return <div className="builder">
    <div className="inputs">
      <label>Teachers in scope<input inputMode="numeric" value={teachers} onChange={e=>setTeachers(e.target.value)} placeholder="e.g. 24"/></label>
      <label>Measured weeks<input inputMode="numeric" value={weeks} onChange={e=>setWeeks(e.target.value)} placeholder="e.g. 4"/></label>
      <label>Target reduction in avoidable workload (%)<input inputMode="decimal" value={target} onChange={e=>setTarget(e.target.value)} placeholder="Your target"/></label>
      <label>Optional loaded staff cost per hour (KES)<input inputMode="decimal" value={hourlyCost} onChange={e=>setHourlyCost(e.target.value)} placeholder="Optional"/></label>
    </div>
    <fieldset><legend>Current avoidable minutes per teacher per week</legend><p>Enter only time you believe is duplication, re-entry, searching, chasing or preventable administrative friction — not the educational work itself.</p><div className="lanes">{(Object.keys(laneMeta) as Lane[]).map(lane=><label key={lane}><span>{laneMeta[lane].label}</span><input inputMode="decimal" value={minutes[lane]} onChange={e=>setMinutes(current=>({...current,[lane]:e.target.value}))} placeholder="minutes"/></label>)}</div></fieldset>
    {!ready?<div className="empty"><strong>Build from your school's own baseline.</strong><p>Complete the scope, target and at least one workload lane. Nothing is sent to VibeSchool; this calculator stays in your browser.</p></div>:<section className="result" aria-live="polite">
      <p className="eyebrow">ILLUSTRATIVE BUSINESS CASE · YOUR ASSUMPTIONS</p><div className="metrics"><article><span>Addressable workload in measured window</span><strong>{format(result.total)} hours</strong></article><article><span>Capacity if your target is achieved</span><strong>{format(result.recovered)} hours</strong></article>{result.hourly>0&&<article><span>Illustrative capacity value</span><strong>{money(result.capacityValue)}</strong></article>}</div>
      <p className="warning">This is not a savings guarantee, price quote, ROI claim or promise that VibeSchool will remove this workload. It is an assumption model for deciding what a pilot should measure.</p>
      <div className="pilot"><div><small>RECOMMENDED FIRST PILOT</small><h3>{topMeta.workflow}</h3><p>Your largest entered friction is <strong>{topMeta.label}</strong>. Start there rather than buying a broad transformation before the workflow is proven.</p></div><div><small>PRIMARY BASELINE MEASURE</small><p>{topMeta.measure}.</p><small>DECISION RULE</small><p>Measure the same definition before and during the pilot. Expand only if the agreed improvement is achieved without unacceptable reliability, privacy, workload-transfer or educational-quality trade-offs.</p></div></div>
      <div className="actions"><button type="button" onClick={()=>window.print()}>Print / save business case</button></div>
    </section>}
    <style>{styles}</style>
  </div>
}

const styles=`.builder{display:grid;gap:20px}.inputs{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.builder label{display:grid;gap:7px;font-weight:800}.builder input{width:100%;border:1px solid #cfd3da;border-radius:10px;padding:12px;font:inherit;background:#fff}.builder fieldset{border:1px solid #d8dbe1;border-radius:16px;padding:20px}.builder legend{font-weight:900;padding:0 8px}.builder fieldset>p{color:#626b77}.lanes{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.lanes label{background:#f7f7f4;border-radius:12px;padding:13px}.lanes span{font-size:13px}.empty{background:#eef0f4;border-radius:15px;padding:22px}.empty p{color:#626b77}.result{background:#111827;color:#fff;border-radius:20px;padding:26px}.eyebrow{font:850 11px var(--font-mono);letter-spacing:.12em;color:#d7bd68}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0}.metrics article{border:1px solid rgba(255,255,255,.15);border-radius:13px;padding:16px}.metrics span{display:block;color:#b8c2cf;font-size:12px}.metrics strong{display:block;font-size:26px;margin-top:4px}.warning{color:#c6cfda;border-left:3px solid #d0b154;padding-left:12px}.pilot{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:20px}.pilot>div{background:rgba(255,255,255,.06);border-radius:14px;padding:18px}.pilot small{font:850 10px var(--font-mono);color:#d7bd68;letter-spacing:.08em}.pilot h3{font-size:22px}.pilot p{color:#d1d8e1}.actions button{border:0;border-radius:10px;padding:12px 16px;font-weight:850;cursor:pointer}@media(max-width:700px){.inputs,.lanes,.metrics,.pilot{grid-template-columns:1fr}}`
