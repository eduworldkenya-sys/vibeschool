'use client'
import {useEffect,useState} from 'react'
import Link from 'next/link'

export const DISCOVERY_EVENT='vibeschool:marketing-round-completed'
const KEY='vibeschool.discovery.v1'
const SETTINGS='vibeschool.discovery.settings.v1'
type State={rounds:number;lastPromptAt:number}
type Settings={enabled:boolean;firstAt:number;repeatEvery:number}
const defaults:Settings={enabled:true,firstAt:3,repeatEvery:5}
function settings():Settings {
  try {
    const s=JSON.parse(localStorage.getItem(SETTINGS)||'{}') as Partial<Settings>
    return {enabled:s.enabled!==false,firstAt:Number.isInteger(s.firstAt)&&s.firstAt!>=1&&s.firstAt!<=20?s.firstAt!:3,repeatEvery:Number.isInteger(s.repeatEvery)&&s.repeatEvery!>=1&&s.repeatEvery!<=30?s.repeatEvery!:5}
  }catch{return defaults}
}
function read():State {
  try{const s=JSON.parse(localStorage.getItem(KEY)||'{}') as Partial<State>;return {rounds:Number.isSafeInteger(s.rounds)&&s.rounds!>=0?s.rounds!:0,lastPromptAt:Number.isSafeInteger(s.lastPromptAt)&&s.lastPromptAt!>=0?s.lastPromptAt!:0}}catch{return {rounds:0,lastPromptAt:0}}
}
/** Call exactly once after a completed outcome, never at the start of an animation. */
export function recordMarketingGameCompletion(){
  if(typeof window!=='undefined') window.dispatchEvent(new Event(DISCOVERY_EVENT))
}
export default function DiscoveryInvitation(){
  const [open,setOpen]=useState(false)
  useEffect(()=>{
    const completed=()=>{
      const cfg=settings();if(!cfg.enabled)return
      const previous=read(),rounds=previous.rounds+1
      const due=rounds>=cfg.firstAt&&(previous.lastPromptAt===0||rounds-previous.lastPromptAt>=cfg.repeatEvery)
      try{localStorage.setItem(KEY,JSON.stringify({rounds,lastPromptAt:due?rounds:previous.lastPromptAt}))}catch{}
      if(due)setOpen(true)
    }
    window.addEventListener(DISCOVERY_EVENT,completed)
    return()=>window.removeEventListener(DISCOVERY_EVENT,completed)
  },[])
  if(!open)return null
  const tracked=(url:string,action:string)=>url+'?utm_source=marketing_studio&utm_medium=game_invitation&utm_campaign=discovery&utm_content='+action
  return <div role="presentation" style={{position:'fixed',inset:0,zIndex:9999,display:'grid',placeItems:'center',padding:18,background:'rgba(4,9,22,.78)'}}>
    <section role="dialog" aria-modal="true" aria-labelledby="discovery-heading" style={{width:'min(100%,430px)',padding:26,border:'1px solid #56738a',borderRadius:22,background:'#111b30',color:'#fff',boxShadow:'0 24px 70px #0009',fontFamily:'inherit'}}>
      <p style={{color:'#8de4d2',fontSize:12,fontWeight:800,letterSpacing:2,margin:'0 0 12px'}}>VIBESCHOOL ORIGINALS</p>
      <h2 id="discovery-heading" style={{fontSize:26,margin:'0 0 8px'}}>Enjoyed the game?</h2>
      <p style={{color:'#d5deeb',fontSize:15,lineHeight:1.6}}>Discover free stories, books and learning on VibeSchool. You can keep playing without an account.</p>
      <div style={{display:'grid',gap:10,marginTop:22}}>
        <Link href={tracked('/learn/stories','books')} onClick={()=>setOpen(false)} style={{display:'block',textAlign:'center',background:'#70e2c5',padding:13,borderRadius:12,color:'#091a22',fontWeight:800,textDecoration:'none'}}>Read a story</Link>
        <Link href={tracked('/global/signup','signup')} onClick={()=>setOpen(false)} style={{display:'block',textAlign:'center',border:'1px solid #7e98b1',padding:13,borderRadius:12,color:'#fff',fontWeight:800,textDecoration:'none'}}>Join VibeSchool</Link>
        <button type="button" autoFocus onClick={()=>setOpen(false)} style={{border:0,background:'transparent',padding:12,color:'#d5deeb',fontWeight:700,cursor:'pointer'}}>Keep playing</button>
      </div>
    </section>
  </div>
}
