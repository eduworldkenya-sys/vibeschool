"use client";
import { useRef } from "react";
import styles from "./listingDetails.module.css";
type Tab = "jobs" | "swap" | "hire";
const labels: Record<Tab,string> = { jobs: "Jobs", swap: "Swaps", hire: "Hire Teachers" };
export default function ListingTabs<T extends Tab>({ value, onChange, idPrefix, tabs }: {value:T;onChange:(value:T)=>void;idPrefix:string;tabs?:readonly T[]}) {
  const options = tabs ?? (["jobs","swap"] as readonly Tab[] as readonly T[]);
  const refs=useRef<(HTMLButtonElement|null)[]>([]);
  return <div className={styles.tabs} role="tablist" aria-label="Teacher opportunities">{options.map((tab,i)=><button key={tab} ref={node=>{refs.current[i]=node}} id={idPrefix+"-tab-"+tab} type="button" role="tab" aria-selected={value===tab} aria-controls={idPrefix+"-panel-"+tab} tabIndex={value===tab?0:-1} onClick={()=>onChange(tab)} onKeyDown={e=>{
    if (!["ArrowLeft","ArrowRight","Home","End"].includes(e.key)) return;
    e.preventDefault();const index=e.key==="Home"?0:e.key==="End"?options.length-1:(i+(e.key==="ArrowRight"?1:-1)+options.length)%options.length;
    const next=options[index];if(next){onChange(next);refs.current[index]?.focus()}
  }}>{labels[tab]}</button>)}</div>
}
