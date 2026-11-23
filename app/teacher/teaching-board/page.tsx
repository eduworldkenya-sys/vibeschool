'use client'
import {Suspense,useEffect,useState} from 'react'
import Link from 'next/link'
import {useRouter,useSearchParams} from 'next/navigation'
import {supabase} from '@/lib/supabase'
import {ObjectBoard} from '@/components/live-classroom/LiveObjectBoard'
import {decodeBoard,emptyBoard,encodeBoard} from '@/components/live-classroom/LiveBoardProtocol'

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const blank=()=>encodeBoard(emptyBoard())
const button={padding:'10px 13px',border:'1px solid #cfdbd4',background:'#fff',color:'#194331',borderRadius:4,fontWeight:700,cursor:'pointer'} as const
function BoardWorkspace(){
 const params=useSearchParams(),router=useRouter()
 const planId=params.get('lessonPlanId')
 const [cacheKey,setCacheKey]=useState('')
 const [board,setBoard]=useState(blank)
 const [undo,setUndo]=useState<string[]>([])
 const [redo,setRedo]=useState<string[]>([])
 const [error,setError]=useState('')
 useEffect(()=>{
  let active=true
  void supabase.auth.getUser().then(({data,error})=>{
   if(!active)return
   if(error||!data.user){router.replace('/login/teacher');return}
   const key='vibeschool.in-class-board.v1:'+data.user.id+':'+(planId&&uuid.test(planId)?planId:'general')
   try{
    const saved=window.localStorage.getItem(key)
    if(saved&&decodeBoard(saved))setBoard(saved)
   }catch{/* Browser storage is optional, not a teaching requirement. */}
   setCacheKey(key)
  }).catch(()=>{if(active)setError('Unable to verify teacher account.')})
  return()=>{active=false}
 },[router,planId])
 useEffect(()=>{
  if(!cacheKey||!decodeBoard(board))return
  try{window.localStorage.setItem(cacheKey,board)}catch{/* Keep work in memory. */}
 },[cacheKey,board])
 function update(next:string){
  if(!decodeBoard(next)||next===board)return
  setUndo(history=>[...history.slice(-29),board]);setRedo([]);setBoard(next)
 }
 function backward(){if(!undo.length)return;setRedo(a=>[...a,board]);setBoard(undo[undo.length-1]);setUndo(a=>a.slice(0,-1))}
 function forward(){if(!redo.length)return;setUndo(a=>[...a,board]);setBoard(redo[redo.length-1]);setRedo(a=>a.slice(0,-1))}
 if(error)return <main style={{padding:16}} role="alert">{error}</main>
 if(!cacheKey)return <main style={{padding:16}} role="status">Opening private whiteboard…</main>
 return <main style={{maxWidth:1200,margin:'0 auto',padding:14,minHeight:'100vh',background:'#f7faf8',color:'#18392b'}}>
   <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:9,flexWrap:'wrap'}}>
    <div><span style={{fontSize:11,color:'#557568',fontWeight:700}}>TEACHING KIT · IN CLASS</span><h1 style={{margin:'4px 0',fontSize:24}}>Whiteboard</h1></div>
    <Link style={button} href="/teacher/lessonplan">Lesson Plans</Link>
   </header>
   <p style={{fontSize:13,color:'#516c60'}}>This board is private to your signed-in teacher account on this device. Nothing is shared to Live automatically.</p>
   <nav aria-label="Whiteboard history" style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
     <button type="button" style={button} disabled={!undo.length} onClick={backward}>Undo</button>
     <button type="button" style={button} disabled={!redo.length} onClick={forward}>Redo</button>
     <button type="button" style={button} onClick={()=>{if(window.confirm('Clear this private board?'))update(blank())}}>Clear board</button>
   </nav>
   <ObjectBoard value={board} page={1} total={1} onChange={update} disabled={false} onUndo={backward} onRedo={forward} canUndo={undo.length>0} canRedo={redo.length>0}/>
 </main>
}
export default function TeachingBoardPage(){return <Suspense fallback={<main style={{padding:16}}>Opening whiteboard…</main>}><BoardWorkspace/></Suspense>}
