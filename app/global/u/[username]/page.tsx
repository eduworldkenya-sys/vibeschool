"use client";
import React,{useEffect,useState} from 'react';
import {useParams,useRouter} from 'next/navigation';
import {supabase} from '@/lib/supabase';
import {useGlobalAuth} from '@/components/global/shared/GlobalAuthContext';

type Profile={profile_id:string;username:string;display_name:string;bio:string|null;avatar_url:string|null;role_label:string|null;county:string|null;institution:string|null;follower_count:number|null;following_count:number|null;is_following:boolean};
type Item={id:string;kind:string;title:string;description?:string|null;view_count?:number;href?:string};
type Content={posts:Item[];resources:Item[];videos:Item[];activity:{kind:string;title:string;created_at:string}[]};
const MUTED='rgba(255,255,255,.58)',ACCENT='#CCFF00',BORDER='1px solid rgba(255,255,255,.09)';

export default function PublicGlobalProfilePage(){
 const {username}=useParams<{username:string}>(),router=useRouter(),{isLoggedIn,userId}=useGlobalAuth();
 const [profile,setProfile]=useState<Profile|null>(null),[content,setContent]=useState<Content|null>(null);
 const [tab,setTab]=useState<'Posts'|'Resources'|'Videos'|'About'|'Activity'>('Posts');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let active=true;async function load(){
  const [p,c]=await Promise.all([supabase.rpc('global_get_public_profile',{p_username:username}),supabase.rpc('global_get_public_profile_content',{p_username:username})]);
  if(!active)return;
  if(p.error||!p.data?.length||c.error||!c.data){setError('This profile is private or does not exist.');setLoading(false);return}
  setProfile(p.data[0] as Profile);setContent(c.data as Content);setLoading(false);
 }load().catch(()=>{if(active){setError('Could not load this profile.');setLoading(false)}});return()=>{active=false}},[username]);
 async function follow(){if(!profile||busy)return;if(!isLoggedIn||!userId){router.push('/global/signup');return}setBusy(true);setError('');
  const {error:e}=await supabase.rpc(profile.is_following?'global_unfollow_profile':'global_follow_profile',{p_username:username});
  if(e)setError(e.message||'Could not update follow status.');
  else setProfile(p=>p?{...p,is_following:!p.is_following,follower_count:p.follower_count===null?null:Math.max(0,p.follower_count+(p.is_following?-1:1))}:p);
  setBusy(false);
 }
 async function share(){try{if(navigator.share)await navigator.share({title:profile?.display_name||'VibeSchool profile',url:window.location.href});else if(navigator.clipboard)await navigator.clipboard.writeText(window.location.href);else setError('Sharing is not available on this device.')}catch{/* dismissed */}}
 if(loading)return <div style={{minHeight:'60dvh',display:'grid',placeItems:'center',color:ACCENT}}>Loading profile…</div>;
 if(!profile||!content)return <main style={{minHeight:'60dvh',display:'grid',placeItems:'center',textAlign:'center',color:'#fff',padding:24}}><div><h1>Profile unavailable</h1><p style={{color:MUTED}}>{error}</p><button onClick={()=>router.push('/global')} style={{background:ACCENT,border:0,borderRadius:9,padding:'11px 18px',fontWeight:800}}>Explore VibeSchool</button></div></main>;
 const list=tab==='Posts'?content.posts:tab==='Resources'?content.resources:tab==='Videos'?content.videos:[];
 const initials=profile.display_name.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();
 return <main style={{color:'#fff',display:'grid',gap:18,padding:'12px 0 100px'}}>
  <header style={{display:'flex',gap:14,alignItems:'center'}}>
   {profile.avatar_url?<img src={profile.avatar_url} alt="" style={{width:72,height:72,borderRadius:'50%',objectFit:'cover'}}/>:<div style={{width:72,height:72,borderRadius:'50%',display:'grid',placeItems:'center',background:ACCENT,color:'#090D16',fontWeight:900,fontSize:23}}>{initials}</div>}
   <div style={{minWidth:0,flex:1}}><h1 style={{fontSize:21,fontWeight:850,margin:0}}>{profile.display_name}</h1><div style={{color:MUTED,fontSize:12,marginTop:4}}>@{profile.username}</div><div style={{color:MUTED,fontSize:12,marginTop:3}}>{[profile.role_label,profile.county,profile.institution].filter(Boolean).join(' · ')}</div></div>
  </header>
  {profile.bio&&<p style={{color:'#e5e7eb',fontSize:14,lineHeight:1.6,margin:0}}>{profile.bio}</p>}
  <div style={{display:'flex',gap:10,alignItems:'center'}}>
   <button onClick={follow} disabled={busy||userId===profile.profile_id} style={{flex:1,border:0,borderRadius:10,padding:12,background:profile.is_following?'#1a2235':ACCENT,color:profile.is_following?'#fff':'#090D16',fontWeight:850,opacity:busy||userId===profile.profile_id?0.6:1}}>{userId===profile.profile_id?'Your profile':busy?'Please wait…':profile.is_following?'Following':'Follow'}</button>
   <button onClick={share} style={{border:BORDER,borderRadius:10,padding:'11px 14px',background:'transparent',color:'#fff',fontWeight:700}}>Share</button>
  </div>
  {profile.follower_count!==null&&profile.following_count!==null&&<div style={{display:'flex',gap:24,color:MUTED,fontSize:12}}><span><strong style={{color:'#fff'}}>{profile.follower_count}</strong> followers</span><span><strong style={{color:'#fff'}}>{profile.following_count}</strong> following</span></div>}
  {error&&<p role="alert" style={{color:'#ff8c8c',fontSize:12,margin:0}}>{error}</p>}
  <section style={{borderTop:BORDER,paddingTop:14}}>
   <nav style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:10}}>{(['Posts','Resources','Videos','About','Activity'] as const).map(t=><button key={t} onClick={()=>setTab(t)} style={{whiteSpace:'nowrap',border:BORDER,borderRadius:20,padding:'7px 11px',background:tab===t?ACCENT:'transparent',color:tab===t?'#090D16':MUTED,fontSize:11,fontWeight:800}}>{t}</button>)}</nav>
   {tab==='About'?<p style={{color:MUTED,fontSize:13,lineHeight:1.65,margin:0}}>{[profile.bio,profile.role_label,profile.county,profile.institution].filter(Boolean).join(' · ')||'No public introduction yet.'}</p>:tab==='Activity'?content.activity.length?<div style={{display:'grid',gap:12}}>{content.activity.map((a,i)=><div key={a.kind+i} style={{borderBottom:BORDER,paddingBottom:10}}><div style={{fontSize:13}}>{a.title}</div><div style={{color:MUTED,fontSize:11,marginTop:4}}>{a.kind==='published_story'?'Published a story':'Published a learning resource'} · {a.created_at?new Date(a.created_at).toLocaleDateString():''}</div></div>)}</div>:<p style={{color:MUTED,fontSize:13}}>No public activity yet.</p>:list.length?<div style={{display:'grid',gap:10}}>{list.map(x=><button key={x.id} onClick={()=>x.href&&router.push(x.href)} style={{textAlign:'left',background:'#111827',color:'#fff',border:BORDER,borderRadius:12,padding:13,display:'grid',gap:5}}><span style={{fontSize:13,fontWeight:750}}>{x.title}</span>{x.description&&<span style={{color:MUTED,fontSize:12,lineHeight:1.45}}>{x.description}</span>}<span style={{color:MUTED,fontSize:11}}>{x.kind} · {x.view_count??0} views</span></button>)}</div>:<p style={{color:MUTED,fontSize:13}}>No {tab.toLowerCase()} published yet.</p>}
  </section>
 </main>
}
