'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styles from './spin-studio.module.css'

type Entry = { id: string; label: string; question: string; answer: string }
type Wheel = { id: string; name: string; entries: Entry[]; maxSpins: number; noRepeat: boolean; duration: number; countdown: number; sound: boolean; theme: 'electric' | 'sunset' | 'neon'; headline: string; cta: string }
type Format = 'portrait' | 'landscape' | 'square'
type Saved = { wheels: Wheel[]; selectedId: string }
const STORAGE = 'vibeschool.spin-studio.v1'
const colors = {
  electric: ['#1ac6c2','#ffbd37','#fe577e','#6d6dfc','#4cdb91','#ff8552','#aa6df3','#349dee'],
  sunset: ['#e85540','#ffc34a','#fd7391','#904ee0','#fb9242','#eebc65','#e35693','#bc5a47'],
  neon: ['#45ecaf','#bd72ff','#f4e85e','#4e9bf6','#ff609c','#35d4d3','#f09c4b','#8ced67'],
}
const uid = () => Math.random().toString(36).slice(2,11)
const sample: Entry[] = [
  ['Kenya','What is the capital of Kenya?','Nairobi'],
  ['Uganda','What is the capital of Uganda?','Kampala'],
  ['Tanzania','What is the capital of Tanzania?','Dodoma'],
  ['Rwanda','What is the capital of Rwanda?','Kigali'],
  ['Nigeria','What is the capital of Nigeria?','Abuja'],
  ['Ghana','What is the capital of Ghana?','Accra'],
  ['Egypt','What is the capital of Egypt?','Cairo'],
  ['Brazil','What is the capital of Brazil?','Brasília'],
  ['Japan','What is the capital of Japan?','Tokyo'],
  ['Australia','What is the capital of Australia?','Canberra'],
  ['Canada','What is the capital of Canada?','Ottawa'],
  ['France','What is the capital of France?','Paris'],
].map(([label,question,answer])=>({id:uid(),label,question,answer}))
const starter = (): Wheel => ({
  id: uid(), name:'Capital City Challenge', headline:'CAN YOU BEAT THE WHEEL?',
  cta:'Comment your answer • Follow VibeSchool',
  entries: sample.map(item=>({...item,id:uid()})), maxSpins:0, noRepeat:false,
  duration:6, countdown:5, sound:true, theme:'electric'
})
function validEntry(x: unknown): x is Entry {
  if (!x || typeof x !== 'object') return false
  const e=x as Record<string,unknown>
  return typeof e.id==='string' && typeof e.label==='string' && typeof e.question==='string' && typeof e.answer==='string'
}
function validWheel(x: unknown): x is Wheel {
  if (!x || typeof x!=='object') return false
  const w=x as Record<string,unknown>
  return typeof w.id==='string' && typeof w.name==='string' && Array.isArray(w.entries) && w.entries.length<=100 && w.entries.every(validEntry)
    && typeof w.headline==='string' && typeof w.cta==='string' && typeof w.maxSpins==='number'
    && typeof w.duration==='number' && typeof w.countdown==='number' && typeof w.sound==='boolean'
    && typeof w.noRepeat==='boolean' && ['electric','sunset','neon'].includes(String(w.theme))
}
function pos(cx:number,cy:number,r:number,angle:number) {
  const radians=(angle-90)*Math.PI/180
  return {x:cx+r*Math.cos(radians),y:cy+r*Math.sin(radians)}
}
function wedge(i:number,count:number) {
  const step=360/count, start=i*step, end=(i+1)*step
  const a=pos(200,200,187,start), b=pos(200,200,187,end)
  return 'M 200 200 L '+a.x+' '+a.y+' A 187 187 0 '+(step>180?1:0)+' 1 '+b.x+' '+b.y+' Z'
}
function soundEffect(kind:'tick'|'win'|'fail',enabled:boolean) {
  if (!enabled || typeof window==='undefined') return
  try {
    const ctx=new AudioContext()
    const notes=kind==='win'?[523,659,784]:kind==='fail'?[270,220]:[420]
    notes.forEach((hz,index)=>{
      const osc=ctx.createOscillator(),gain=ctx.createGain()
      const start=ctx.currentTime+index*.12
      osc.type=kind==='tick'?'triangle':'sine'
      osc.frequency.setValueAtTime(hz,start)
      gain.gain.setValueAtTime(.0001,start)
      gain.gain.exponentialRampToValueAtTime(kind==='tick'?.018:.1,start+.01)
      gain.gain.exponentialRampToValueAtTime(.0001,start+.13)
      osc.connect(gain);gain.connect(ctx.destination);osc.start(start);osc.stop(start+.14)
    })
    window.setTimeout(()=>{void ctx.close().catch(()=>{})},800)
  }catch { /* Audio is optional and can be blocked by the browser. */ }
}
export default function SpinStudio() {
  const [wheels,setWheels]=useState<Wheel[]>([])
  const [selectedId,setSelectedId]=useState('')
  const [loaded,setLoaded]=useState(false)
  const [recording,setRecording]=useState(false)
  const [format,setFormat]=useState<Format>('portrait')
  const [rotation,setRotation]=useState(0)
  const [spinning,setSpinning]=useState(false)
  const [result,setResult]=useState<number|null>(null)
  const [reveal,setReveal]=useState(false)
  const [verdict,setVerdict]=useState<'correct'|'wrong'|null>(null)
  const [used,setUsed]=useState<string[]>([])
  const [spinCount,setSpinCount]=useState(0)
  const [seconds,setSeconds]=useState<number|null>(null)
  const [paste,setPaste]=useState('')
  const [showBulk,setShowBulk]=useState(false)
  const [feedback,setFeedback]=useState('')
  const [fullScreen,setFullScreen]=useState(false)
  const stageRef=useRef<HTMLDivElement>(null)
  const spinTimer=useRef<ReturnType<typeof setTimeout>|null>(null)
  const pendingSpin=useRef(false)
  const wheel=wheels.find(w=>w.id===selectedId) || wheels[0]
  const entries=wheel?.entries || []
  const available=entries.map((entry,index)=>({entry,index})).filter(({entry})=>!wheel?.noRepeat || !used.includes(entry.id))
  const remaining=wheel?.maxSpins ? Math.max(0,wheel.maxSpins-spinCount) : null
  const locked=spinning || entries.length<2 || (remaining!==null && remaining===0) || available.length===0

  useEffect(()=>{
    try {
      const raw=localStorage.getItem(STORAGE)
      const data=raw?JSON.parse(raw) as Partial<Saved>:null
      if(data && Array.isArray(data.wheels)){
        const good=data.wheels.filter(validWheel).slice(0,50)
        if(good.length){setWheels(good);setSelectedId(good.some(w=>w.id===data.selectedId)?String(data.selectedId):good[0].id);setLoaded(true);return}
      }
    }catch {/* Corrupt or unavailable local storage is not fatal. */}
    const fresh=starter();setWheels([fresh]);setSelectedId(fresh.id);setLoaded(true)
  },[])
  useEffect(()=>{
    if(!loaded)return
    try{localStorage.setItem(STORAGE,JSON.stringify({wheels,selectedId}))}
    catch{ /* Storage quota or private browsing can prevent saving. */ }
  },[wheels,selectedId,loaded])
  useEffect(()=>{setRotation(0);setSpinning(false);setResult(null);setReveal(false);setUsed([]);setSpinCount(0);setSeconds(null);setVerdict(null)},[selectedId])
  useEffect(()=>{
    if(seconds===null || seconds<=0 || spinning)return
    const timer=window.setTimeout(()=>setSeconds(value=>value===null?null:Math.max(0,value-1)),1000)
    return ()=>window.clearTimeout(timer)
  },[seconds,spinning])
  useEffect(()=>()=>{if(spinTimer.current)clearTimeout(spinTimer.current)},[])
  useEffect(()=>{
    const change=()=>setFullScreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange',change)
    return ()=>document.removeEventListener('fullscreenchange',change)
  },[])
  const update=useCallback((patch:Partial<Wheel>)=>setWheels(all=>all.map(w=>w.id===selectedId?{...w,...patch}:w)),[selectedId])
  const editEntry=(id:string,patch:Partial<Entry>)=>update({entries:entries.map(e=>e.id===id?{...e,...patch}:e)})
  const resetRun=()=>{if(spinning)return;setUsed([]);setSpinCount(0);setResult(null);setReveal(false);setVerdict(null);setSeconds(null);setFeedback('Spin session reset.')}
  const spin=()=>{
    if(locked || !wheel || pendingSpin.current)return
    const chosen=available[Math.floor(Math.random()*available.length)]
    if(!chosen)return
    pendingSpin.current=true
    setSpinning(true);setResult(null);setReveal(false);setVerdict(null);setSeconds(null);setFeedback('')
    const step=360/entries.length, target=(360-(chosen.index+.5)*step)%360
    const current=((rotation%360)+360)%360
    const delta=((target-current+360)%360)
    const next=rotation+360*(5+Math.floor(wheel.duration/2))+delta
    setRotation(next)
    soundEffect('tick',wheel.sound)
    spinTimer.current=window.setTimeout(()=>{
      setSpinning(false);setResult(chosen.index);setUsed(old=>[...old,chosen.entry.id])
      setSpinCount(n=>n+1);setSeconds(wheel.countdown);pendingSpin.current=false
      soundEffect('tick',wheel.sound)
    },wheel.duration*1000)
  }
  const doVerdict=(v:'correct'|'wrong')=>{
    if(result===null || spinning)return
    setVerdict(v);setReveal(true);setSeconds(null)
    soundEffect(v==='correct'?'win':'fail',Boolean(wheel?.sound))
  }
  const addWheel=()=>{
    const w=starter();w.name='Untitled Wheel';w.headline='SPIN & TAKE THE CHALLENGE';w.entries=[]
    setWheels(all=>[...all,w]);setSelectedId(w.id);setFeedback('New wheel created.')
  }
  const duplicateWheel=()=>{
    if(!wheel)return
    const w={...wheel,id:uid(),name:wheel.name+' Copy',entries:wheel.entries.map(e=>({...e,id:uid()}))}
    setWheels(all=>[...all,w]);setSelectedId(w.id)
  }
  const removeWheel=()=>{
    if(!wheel || wheels.length===1)return
    const next=wheels.filter(w=>w.id!==wheel.id)
    setWheels(next);setSelectedId(next[0].id)
  }
  const importRows=()=>{
    const rows=paste.split(/\r?\n/).map(line=>line.split('|').map(v=>v.trim())).filter(row=>row[0])
    if(rows.length===0)return
    const next=rows.map(([label,question,answer])=>({id:uid(),label:label.slice(0,70),question:(question||'').slice(0,250),answer:(answer||'').slice(0,250)}))
    update({entries:[...entries,...next].slice(0,100)})
    setPaste('');setShowBulk(false);setFeedback('Entries added. Maximum 100 per wheel.')
  }
  const download=()=>{
    if(!wheel)return
    const blob=new Blob([JSON.stringify(wheel,null,2)],{type:'application/json'})
    const url=URL.createObjectURL(blob),anchor=document.createElement('a')
    anchor.href=url;anchor.download='vibeschool-'+wheel.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.json'
    anchor.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  const upload=async(file:File|undefined)=>{
    if(!file)return
    try{
      if(file.size>200000)throw Error('File too large.')
      const parsed:unknown=JSON.parse(await file.text())
      if(!validWheel(parsed))throw Error('Not a valid Spin Studio wheel.')
      const source=parsed as Wheel
      const fresh={...source,id:uid(),name:source.name.slice(0,90),entries:source.entries.map(e=>({...e,id:uid()}))}
      setWheels(all=>[...all,fresh]);setSelectedId(fresh.id);setFeedback('Wheel imported.')
    }catch(error){setFeedback(error instanceof Error?error.message:'Could not import wheel.')}
  }
  const toggleFull=async()=>{
    try{
      if(document.fullscreenElement)await document.exitFullscreen()
      else await stageRef.current?.requestFullscreen()
    }catch{setFeedback('Fullscreen is not supported here. Recording mode still works.')}
  }
  const selected=result===null?null:entries[result]
  const segmented=useMemo(()=>entries.map((entry,index)=>({entry,index,path:wedge(index,entries.length),degree:(index+.5)*360/entries.length})),[entries])
  if(!loaded || !wheel)return <main className={styles.page}><p>Loading Spin Studio…</p></main>
  return <main className={styles.page}>
    <div className={styles.shell}>
      {!recording && <header className={styles.header}>
        <div><span className={styles.eyebrow}>VIBESCHOOL ORIGINALS · CREATOR TOOLS</span><h1>Spin Studio <span>✦</span></h1><p>Create the challenge. Capture the moment. Build curiosity.</p></div>
        <div className={styles.headActions}><span className={styles.localTag}>● Browser-saved · Unlisted</span><button className={styles.primary} onClick={()=>{setRecording(true);setFeedback('')}}>Enter recording mode ↗</button></div>
      </header>}
      <div className={recording?styles.recordLayout:styles.layout}>
        {!recording && <aside className={styles.controls}>
          <div className={styles.panel}>
            <div className={styles.panelTitle}><h2>My wheels</h2><button onClick={addWheel} className={styles.smallButton}>+ New</button></div>
            <select aria-label="Select a saved wheel" value={selectedId} onChange={e=>setSelectedId(e.target.value)}>{wheels.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select>
            <div className={styles.row}><button onClick={duplicateWheel}>Duplicate</button><button disabled={wheels.length<=1} onClick={removeWheel}>Delete wheel</button></div>
            <label>Wheel name<input value={wheel.name} maxLength={90} onChange={e=>update({name:e.target.value})}/></label>
            <label>Video hook / headline<input value={wheel.headline} maxLength={100} onChange={e=>update({headline:e.target.value})}/></label>
            <label>Closing call to action<input value={wheel.cta} maxLength={120} onChange={e=>update({cta:e.target.value})}/></label>
          </div>
          <div className={styles.panel}>
            <div className={styles.panelTitle}><h2>Wheel entries <span className={styles.muted}>{entries.length}/100</span></h2><button className={styles.smallButton} disabled={entries.length>=100} onClick={()=>update({entries:[...entries,{id:uid(),label:'New item',question:'',answer:''}]})}>+ Add</button></div>
            <p className={styles.hint}>Every segment can have its own question and answer. Both are optional.</p>
            <div className={styles.entries}>{entries.map((entry,i)=><div className={styles.entry} key={entry.id}>
              <div className={styles.entryHead}><span>SEGMENT {i+1}</span><button aria-label={'Remove '+entry.label} onClick={()=>update({entries:entries.filter(e=>e.id!==entry.id)})}>Remove</button></div>
              <input aria-label={'Label '+(i+1)} placeholder="Segment label" maxLength={70} value={entry.label} onChange={e=>editEntry(entry.id,{label:e.target.value})}/>
              <input aria-label={'Question '+(i+1)} placeholder="Question (optional)" maxLength={250} value={entry.question} onChange={e=>editEntry(entry.id,{question:e.target.value})}/>
              <input aria-label={'Answer '+(i+1)} placeholder="Answer (optional)" maxLength={250} value={entry.answer} onChange={e=>editEntry(entry.id,{answer:e.target.value})}/>
            </div>)}</div>
            <button onClick={()=>setShowBulk(v=>!v)}>{showBulk?'Close bulk editor':'+ Paste multiple entries'}</button>
            {showBulk && <div className={styles.bulk}><p className={styles.hint}>One line per segment: Label | Question | Answer</p><textarea rows={5} value={paste} onChange={e=>setPaste(e.target.value)} placeholder={'Brazil | What is its capital? | Brasília\nFractions | What is 1/2 + 1/4? | 3/4'}/><button onClick={importRows} disabled={!paste.trim()}>Add entries</button></div>}
          </div>
          <div className={styles.panel}>
            <h2>Show controls</h2>
            <label>Video shape<select value={format} onChange={e=>setFormat(e.target.value as Format)}><option value="portrait">9:16 · Shorts & TikTok</option><option value="landscape">16:9 · YouTube</option><option value="square">1:1 · Square</option></select></label>
            <label>Wheel colour<select value={wheel.theme} onChange={e=>update({theme:e.target.value as Wheel['theme']})}><option value="electric">Electric Vibe</option><option value="sunset">Sunset Pop</option><option value="neon">Neon Night</option></select></label>
            <label>Spin duration: {wheel.duration} seconds<input aria-label="Spin duration" type="range" min="3" max="10" value={wheel.duration} onChange={e=>update({duration:Number(e.target.value)})}/></label>
            <label>Answer countdown: {wheel.countdown} seconds<input aria-label="Answer countdown" type="range" min="0" max="15" value={wheel.countdown} onChange={e=>update({countdown:Number(e.target.value)})}/></label>
            <label>Maximum spins (0 = unlimited)<input type="number" min="0" max="9999" value={wheel.maxSpins} onChange={e=>update({maxSpins:Math.max(0,Math.min(9999,Number(e.target.value)||0))})}/></label>
            <label className={styles.check}><input type="checkbox" checked={wheel.noRepeat} onChange={e=>update({noRepeat:e.target.checked})}/> Do not repeat a segment in this session</label>
            <label className={styles.check}><input type="checkbox" checked={wheel.sound} onChange={e=>update({sound:e.target.checked})}/> Sound effects (device audio must be recorded)</label>
            <div className={styles.row}><button onClick={download}>Export wheel</button><label className={styles.fileButton}>Import JSON<input type="file" accept=".json,application/json" onChange={e=>{void upload(e.target.files?.[0]);e.target.value=''}}/></label></div>
          </div>
        </aside>}
        <section className={styles.previewSection} aria-label="Wheel preview">
          {!recording && <div className={styles.previewTop}><span>LIVE PREVIEW</span><span>{format==='portrait'?'9:16':format==='landscape'?'16:9':'1:1'} · Ready to record</span></div>}
          <div ref={stageRef} className={[styles.stage,styles[format],styles[wheel.theme]].join(' ')}>
            <div className={styles.stageGlow} aria-hidden="true"/>
            <div className={styles.stageContent}>
              <div className={styles.brand}><span className={styles.brandMark}>V</span><span>VIBESCHOOL <b>SPIN STUDIO</b></span></div>
              <div className={styles.titleBlock}><div className={styles.livePill}>✦ SPIN THE CHALLENGE ✦</div><h2>{wheel.headline||'SPIN & TAKE THE CHALLENGE'}</h2><p>{wheel.name}</p></div>
              <div className={styles.wheelArea}>
                <div className={styles.wheelHalo}/>
                <svg role="img" aria-label="Wheel with editable segments" className={styles.wheelSvg} viewBox="0 0 400 400">
                  <circle cx="200" cy="200" r="198" fill="#08152c" stroke="rgba(255,255,255,.32)" strokeWidth="3"/>
                  {segmented.length>0 && <g style={{transform:'rotate('+rotation+'deg)',transformOrigin:'200px 200px',transition:spinning?'transform '+wheel.duration+'s cubic-bezier(.12,.78,.08,1)':'none'}}>
                    {segmented.map(({entry,index,path,degree})=><g key={entry.id}>
                      <path d={path} fill={colors[wheel.theme][index%8]} stroke="#121836" strokeWidth="1.8"/>
                      <text x="200" y="73" textAnchor="middle" transform={'rotate('+degree+' 200 200)'} fill="#10162b" fontSize={entries.length>16?8:entries.length>10?10:13} fontWeight="900">{entry.label.length>15?entry.label.slice(0,14)+'…':entry.label||'Item'}</text>
                    </g>)}
                  </g>}
                  <circle cx="200" cy="200" r="48" fill="#0d1831" stroke="#ffffff" strokeWidth="5"/>
                  <circle cx="200" cy="200" r="41" fill="#0e2442"/>
                  <text x="200" y="197" fill="white" textAnchor="middle" fontSize="27" fontWeight="900">VIBE</text>
                  <text x="200" y="217" fill="#40e4cd" textAnchor="middle" fontSize="17" fontWeight="900">SCHOOL</text>
                  <path d="M182 2 L218 2 L200 42 Z" fill="#fff" stroke="#0e1832" strokeWidth="4"/>
                  <circle cx="200" cy="200" r="195" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="5" strokeDasharray="2 13"/>
                </svg>
                {verdict==='correct' && <div className={styles.confetti} aria-hidden="true">{Array.from({length:24},(_,i)=><i key={i} style={{left:(i*41)%100+'%',animationDelay:(i%6)*.09+'s',background:colors[wheel.theme][i%8]}}/>)}</div>}
              </div>
              <div className={styles.questionArea} aria-live="polite">
                {selected ? <>
                  <span className={styles.resultKicker}>{spinning?'THE WHEEL IS SPINNING':'THE WHEEL CHOSE'}</span>
                  <strong className={styles.resultLabel}>{selected.label}</strong>
                  <p className={styles.question}>{selected.question||'Your challenge starts now!'}</p>
                  {!reveal && seconds!==null && <div className={styles.countdown}>{seconds===0?'TIME!':seconds}</div>}
                  {reveal && <div className={styles.answer}><span>{verdict==='correct'?'★ CORRECT ANSWER':verdict==='wrong'?'✦ THE ANSWER':'✦ ANSWER REVEAL'}</span><strong>{selected.answer||selected.label}</strong></div>}
                </> : <><span className={styles.resultKicker}>READY WHEN YOU ARE</span><p className={styles.readyText}>One spin. One question. Can you get it right?</p></>}
              </div>
              <p className={styles.cta}>{wheel.cta}</p>
            </div>
          </div>
          <div className={styles.playBar}>
            <div className={styles.playStatus}><span>SPINS <b>{spinCount}{remaining!==null?' / '+wheel.maxSpins:''}</b></span><span>{wheel.noRepeat?'UNIQUE LEFT '+available.length:'RANDOM MODE'}</span></div>
            <div className={styles.playButtons}>
              <button className={styles.spinButton} disabled={locked} onClick={spin}>{spinning?'SPINNING…':available.length===0?'ALL SEGMENTS USED':remaining===0?'SPIN LIMIT REACHED':'✦ SPIN NOW'}</button>
              <button disabled={spinning || result===null} onClick={()=>{setReveal(v=>!v);setVerdict(null)}}>{reveal?'Hide answer':'Reveal answer'}</button>
              <button disabled={spinning || result===null} onClick={()=>doVerdict('correct')}>✓ Correct</button>
              <button disabled={spinning || result===null} onClick={()=>doVerdict('wrong')}>✕ Wrong</button>
              <button onClick={resetRun} disabled={spinning}>Reset</button>
            </div>
          </div>
          {recording && <div className={styles.recordBar}><span>Recording view · Use your device screen recorder</span><div><button onClick={()=>{void toggleFull()}}>{fullScreen?'Exit fullscreen':'Fullscreen stage'}</button><button onClick={()=>setRecording(false)}>← Back to editor</button></div></div>}
          {!recording && <p className={styles.note}>Your saved wheels stay in this browser only. Direct URL access is not private. To record, open Recording Mode and capture the stage using your screen recorder; no camera or account needed.</p>}
          {feedback && <p role="status" className={styles.feedback}>{feedback}</p>}
        </section>
      </div>
    </div>
  </main>
}
