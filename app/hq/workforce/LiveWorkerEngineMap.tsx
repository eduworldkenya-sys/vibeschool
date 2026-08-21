"use client"

import {useEffect,useMemo,useRef,useState} from "react"
import {workerIdentity} from "@/lib/hq/workforceIdentity"
import styles from "./LiveWorkerEngineMap.module.css"

type Row=Record<string,any>
type Readiness="ready"|"repair"|"stopped"

const zoneConfig={
  ready:{title:"READY TO WORK",symbol:"✓",className:styles.ready,color:"#22c55e",top:"rgba(22,101,52,.46)"},
  repair:{title:"NEEDS REPAIR",symbol:"⚒",className:styles.repair,color:"#f59e0b",top:"rgba(146,91,8,.43)"},
  stopped:{title:"NOT READY",symbol:"×",className:styles.stopped,color:"#94a3b8",top:"rgba(71,85,105,.38)"},
} as const

function readiness(row:Row):Readiness{
  if(row.certification_state==="CERTIFIED"&&row.qualification_state==="CERTIFIED"&&!row.legacy_recertification_required)return "ready"
  if(row.certification_state==="NEEDS_REPAIR"||row.qualification_state==="FAILED_QUALIFICATION")return "repair"
  return "stopped"
}

function readable(value:unknown){return String(value??"—").replaceAll("_"," ")}
function date(value:unknown){return value?new Date(String(value)).toLocaleString("en-KE"):"—"}

export default function LiveWorkerEngineMap({workers,generatedAt}:{workers:Row[];generatedAt?:string}){
  const [selected,setSelected]=useState<Row|null>(null)
  const closeRef=useRef<HTMLButtonElement>(null)
  const groups=useMemo(()=>({
    ready:workers.filter(row=>readiness(row)==="ready"),
    repair:workers.filter(row=>readiness(row)==="repair"),
    stopped:workers.filter(row=>readiness(row)==="stopped"),
  }),[workers])

  useEffect(()=>{
    if(!selected)return
    closeRef.current?.focus()
    const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape")setSelected(null)}
    window.addEventListener("keydown",onKey)
    return()=>window.removeEventListener("keydown",onKey)
  },[selected])

  return <section className={styles.shell} aria-labelledby="worker-engine-map-title">
    <header className={styles.header}>
      <h2 id="worker-engine-map-title">VIBESCHOOL WORKER ENGINE</h2>
      <p>Governed. Reliable. Built for Kenyan education.</p>
      <span className={styles.live}>LIVE PRODUCTION READINESS</span>
    </header>
    <div className={styles.layout}>
      <div className={styles.hubWrap}><div className={styles.hub}><div><strong>Governed<br/>Worker<br/>Engine</strong><span className={styles.gear} aria-hidden>⚙</span><small>{workers.length} TECHNICAL WORKERS</small></div></div></div>
      {(Object.keys(zoneConfig) as Readiness[]).map(key=><Zone key={key} kind={key} rows={groups[key]} onSelect={setSelected}/>) }
    </div>
    <footer className={styles.footer}>Created does not mean certified. Authority remains governed. Updated {date(generatedAt)}.</footer>
    {selected&&<WorkerDialog row={selected} onClose={()=>setSelected(null)} closeRef={closeRef}/>} 
  </section>
}

function Zone({kind,rows,onSelect}:{kind:Readiness;rows:Row[];onSelect:(row:Row)=>void}){
  const config=zoneConfig[kind]
  return <section className={`${styles.zone} ${config.className}`} style={{"--zone-border":`${config.color}88`,"--zone-text":config.color,"--zone-top":config.top} as React.CSSProperties} aria-label={`${config.title}, ${rows.length} workers`}>
    <header className={styles.zoneHeader}><span aria-hidden>{config.symbol}</span><h3>{config.title} — {rows.length}</h3></header>
    <div className={styles.list}>{rows.length?rows.map(row=>{const identity=workerIdentity(row.worker_key,row.title);return <button className={styles.worker} key={row.worker_key} onClick={()=>onSelect(row)} aria-label={`Open ${identity.name}, ${row.title}`}><span className={styles.avatar}>{identity.name.slice(0,1)}</span><span className={styles.copy}><strong>{identity.name}</strong><small>{row.title} · {row.department_key}</small></span><span className={styles.risk}>{row.risk_class??"—"}</span></button>}):<div className={styles.empty}>No workers in this state.</div>}</div>
  </section>
}

function WorkerDialog({row,onClose,closeRef}:{row:Row;onClose:()=>void;closeRef:React.RefObject<HTMLButtonElement>}){
  const identity=workerIdentity(row.worker_key,row.title)
  return <div className={styles.modalLayer} role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="worker-readiness-title">
    <div className={styles.modalTop}><div><h3 id="worker-readiness-title">{identity.name}</h3><p>{identity.purpose}</p></div><button ref={closeRef} className={styles.close} onClick={onClose} aria-label="Close worker details">×</button></div>
    <div className={styles.facts}>
      <Fact label="Technical worker" value={row.worker_key}/><Fact label="Department" value={row.department_key}/><Fact label="Certification" value={readable(row.certification_state)}/><Fact label="Qualification" value={readable(row.qualification_state)}/><Fact label="Risk class" value={row.risk_class}/><Fact label="Registry state" value={readable(row.registry_status)}/><Fact label="Certified" value={date(row.certified_at)}/><Fact label="Expires" value={date(row.expires_at)}/>
    </div>
  </section></div>
}

function Fact({label,value}:{label:string;value:unknown}){return <div className={styles.fact}><small>{label}</small><strong>{readable(value)}</strong></div>}
