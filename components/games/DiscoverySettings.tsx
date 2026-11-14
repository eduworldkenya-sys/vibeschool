'use client'
import {useEffect,useState} from 'react'
const KEY='vibeschool.discovery.settings.v1'
export default function DiscoverySettings(){
 const [enabled,setEnabled]=useState(true),[firstAt,setFirstAt]=useState(3),[repeatEvery,setRepeatEvery]=useState(5),[message,setMessage]=useState('')
 useEffect(()=>{try{const s=JSON.parse(localStorage.getItem(KEY)||'{}');if(s.enabled===false)setEnabled(false);if(Number.isInteger(s.firstAt)&&s.firstAt>=1&&s.firstAt<=20)setFirstAt(s.firstAt);if(Number.isInteger(s.repeatEvery)&&s.repeatEvery>=1&&s.repeatEvery<=30)setRepeatEvery(s.repeatEvery)}catch{}},[])
 const save=()=>{try{localStorage.setItem(KEY,JSON.stringify({enabled,firstAt,repeatEvery}));setMessage('Discovery invitation settings saved in this browser.')}catch{setMessage('Settings could not be saved in this browser.')}}
 return <section aria-labelledby="discovery-settings-title" style={{margin:'26px 0',padding:22,border:'1px solid #35505f',borderRadius:18,background:'#10202b',color:'white'}}>
  <h2 id="discovery-settings-title" style={{margin:'0 0 8px',fontSize:20}}>Game-to-learning invitations</h2>
  <p style={{color:'#bbd0da',fontSize:14,lineHeight:1.6}}>After completed games, invite visitors to read original books or join VibeSchool. Visitors can keep playing. These settings apply only to this browser.</p>
  <div style={{display:'flex',flexWrap:'wrap',gap:16,alignItems:'center'}}>
   <label style={{display:'flex',gap:8,alignItems:'center'}}><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/> Enable invitation</label>
   <label>First invitation after <input aria-label="Completed games before first invitation" type="number" min="1" max="20" value={firstAt} onChange={e=>setFirstAt(Math.max(1,Math.min(20,Number(e.target.value)||1)))} style={{width:65,marginLeft:8,padding:7}}/> games</label>
   <label>Repeat after <input aria-label="Completed games between invitations" type="number" min="1" max="30" value={repeatEvery} onChange={e=>setRepeatEvery(Math.max(1,Math.min(30,Number(e.target.value)||1)))} style={{width:65,marginLeft:8,padding:7}}/> more</label>
   <button type="button" onClick={save} style={{padding:'10px 18px',border:0,borderRadius:10,background:'#70e2c5',color:'#092326',fontWeight:800,cursor:'pointer'}}>Save invitation settings</button>
  </div>{message&&<p role="status" style={{fontSize:13}}>{message}</p>}
 </section>
}
