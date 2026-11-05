"use client";
import React,{useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {supabase} from '@/lib/supabase';
type Person={username:string;display_name:string;avatar_url:string|null;role_label:string|null;county:string|null;institution:string|null};
type Entry={id:string;title:string;description:string|null;kind:'story'|'resource'|'video'|'publication';href:string;created_at:string|null;tags:string[]};
const accent='#CCFF00',muted='#b4bdcb',panel='#111827';
export default function DiscoverPage(){
 const router=useRouter();
 const [query,setQuery]=useState(''),[kind,setKind]=useState<'All'|'People'|'Stories'|'Resources'|'Videos'>('All');
 const [people,setPeople]=useState<Person[]>([]),[entries,setEntries]=useState<Entry[]>([]);
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{let alive=true;const timeout=setTimeout(async()=>{
  setLoading(true);setError('');
  try{
   const q=query.trim().toLowerCase();
   const [p,s,c,pubs]=await Promise.all([
    supabase.rpc('global_discover_people',{p_query:query.trim(),p_limit:20}),
    supabase.from('vibe_stories').select('id,title,description,created_at,tags').eq('status','published').order('published_at',{ascending:false}).limit(80),
    supabase.from('vibelearn_content').select('id,title,description,type,created_at,tags').eq('status','live').order('created_at',{ascending:false}).limit(80),
    supabase.from('vibe_publications').select('id,title,description,format,created_at,tags').eq('status','published').order('published_at',{ascending:false}).limit(80)
   ]);
   if(!alive)return;
   if(p.error||s.error||c.error||pubs.error)throw new Error('Discovery could not load. Please try again.');
   setPeople((p.data??[]) as Person[]);
   const stories:Entry[]=(s.data??[]).map(x=>({id:x.id,title:x.title??'Untitled story',description:x.description,created_at:x.created_at,kind:'story',href:'/global/read/story/'+x.id,tags:x.tags??[]}));
   const resources:Entry[]=(c.data??[]).map(x=>({id:x.id,title:x.title??'Untitled resource',description:x.description,created_at:x.created_at,kind:String(x.type??'').toLowerCase().includes('video')?'video':'resource',href:'/global/read/'+x.id,tags:x.tags??[]}));
   const publications:Entry[]=(pubs.data??[]).map(x=>({id:x.id,title:x.title??'Untitled publication',description:x.description,created_at:x.created_at,kind:'publication',href:'/global/read/publication/'+x.id,tags:x.tags??[]}));
   setEntries([...stories,...resources,...publications].filter(x=>!q||[x.title,x.description??'',...x.tags].some(v=>v.toLowerCase().includes(q))).sort((a,b)=>new Date(b.created_at??0).getTime()-new Date(a.created_at??0).getTime()));
  }catch{if(alive)setError('Discovery could not load. Please try again.')}finally{if(alive)setLoading(false)}
 },250);return()=>{alive=false;clearTimeout(timeout)}},[query,retry]);
 const shown=entries.filter(x=>kind==='All'?true:kind==='People'?false:kind==='Stories'?x.kind==='story':kind==='Videos'?x.kind==='video':x.kind==='resource'||x.kind==='publication');
 return <main style={{color:'#fff',padding:'8px 0 110px',maxWidth:850,margin:'auto'}}>
 <h1 style={{fontSize:25,margin:'0 0 6px'}}>Discover</h1><p style={{fontSize:13,color:muted,margin:'0 0 18px'}}>Explore public creators, stories and learning resources.</p>
 <label htmlFor="discover-search" style={{display:'block',fontSize:12,marginBottom:7}}>Search VibeSchool</label>
 <input id="discover-search" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Name, username, topic or subject" style={{width:'100%',boxSizing:'border-box',background:panel,border:'1px solid #3c4556',borderRadius:12,padding:14,color:'#fff',fontSize:15}}/>
 {query.trim()&&<nav aria-label="Discovery filters" style={{display:'flex',gap:8,overflowX:'auto',padding:'15px 0'}}>{(['All','People','Stories','Resources','Videos'] as const).map(k=><button key={k} aria-pressed={kind===k} onClick={()=>setKind(k)} style={{whiteSpace:'nowrap',border:'1px solid #3c4556',background:kind===k?accent:panel,color:kind===k?'#090D16':'#fff',borderRadius:20,padding:'9px 12px',fontWeight:700}}>{k}</button>)}</nav>}
 {loading?<p role="status" style={{color:muted}}>Searching…</p>:error?<div role="alert"><p>{error}</p><button onClick={()=>setRetry(x=>x+1)}>Retry</button></div>:<>
 {(kind==='All'||kind==='People')&&<section><h2 style={{fontSize:17}}>People</h2>{people.length===0?<p style={{color:muted,fontSize:13}}>No public profiles found.</p>:<div style={{display:'grid',gap:9}}>{people.map(p=><button key={p.username} onClick={()=>router.push('/global/u/'+encodeURIComponent(p.username))} style={{background:panel,border:'1px solid #30394a',borderRadius:12,padding:14,color:'#fff',textAlign:'left',display:'flex',alignItems:'center',gap:12}}><span style={{width:40,height:40,borderRadius:'50%',background:'#2b3747',display:'grid',placeItems:'center',flexShrink:0,fontWeight:800}}>{p.display_name.slice(0,1).toUpperCase()}</span><span><strong style={{display:'block',fontSize:14}}>{p.display_name}</strong><span style={{fontSize:12,color:muted}}>@{p.username}{p.role_label?' · '+p.role_label:''}</span></span></button>)}</div>}</section>}
 {kind!=='People'&&<section><h2 style={{fontSize:17}}>{kind==='All'?'Learning and stories':kind}</h2>{shown.length===0?<p style={{color:muted,fontSize:13}}>No matching published content.</p>:<div style={{display:'grid',gap:9}}>{shown.map(x=><button key={x.kind+x.id} onClick={()=>router.push(x.href)} style={{background:panel,border:'1px solid #30394a',borderRadius:12,padding:14,color:'#fff',textAlign:'left'}}><span style={{fontSize:10,textTransform:'uppercase',color:accent,fontWeight:800}}>{x.kind}</span><strong style={{display:'block',marginTop:5,fontSize:14}}>{x.title}</strong>{x.description&&<span style={{display:'block',color:muted,fontSize:12,marginTop:5}}>{x.description.slice(0,130)}</span>}</button>)}</div>}</section>}
 </>}
 </main>;
}
