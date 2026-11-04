"use client";
import React,{useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {supabase} from '@/lib/supabase';
import {useGlobalAuth} from '@/components/global/shared/GlobalAuthContext';

type Draft={username:string;display_name:string;bio:string;avatar_url:string;role_label:string;county:string;institution:string;is_public:boolean;show_social_counts:boolean};
type Item={id:string;title:string;created_at:string;view_count:number;kind:string;href:string};
type Story={id:string;title:string;created_at:string;view_count:number;description:string|null};
type Resource=Story&{type:string|null};
const EMPTY:Draft={username:'',display_name:'',bio:'',avatar_url:'',role_label:'',county:'',institution:'',is_public:false,show_social_counts:false};
const BG='#090D16',PANEL='#111827',BORDER='1px solid rgba(255,255,255,.09)',MUTED='rgba(255,255,255,.58)',ACCENT='#CCFF00';
const input:React.CSSProperties={width:'100%',boxSizing:'border-box',background:'#0b1220',color:'#fff',border:BORDER,borderRadius:10,padding:'12px 13px',fontSize:14};
const label:React.CSSProperties={display:'block',color:MUTED,fontSize:12,fontWeight:700,marginBottom:6};

export default function ProfilePage(){
 const {isLoggedIn,userId,userName}=useGlobalAuth(),router=useRouter();
 const [draft,setDraft]=useState<Draft>(EMPTY),[items,setItems]=useState<Item[]>([]);
 const [tab,setTab]=useState<'Posts'|'Resources'|'Videos'|'About'|'Activity'>('Posts');
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [stats,setStats]=useState({stories:0,resources:0,views:0});
 useEffect(()=>{let active=true;async function load(){
  if(!isLoggedIn||!userId){setLoading(false);return}
  const [p,s,r,sv,rv]=await Promise.all([
   supabase.from('global_public_profiles').select('*').eq('profile_id',userId).maybeSingle(),
   supabase.from('vibe_stories').select('id,title,description,created_at,view_count',{count:'exact'}).eq('author_id',userId).eq('status','published').order('created_at',{ascending:false}).limit(40),
   supabase.from('vibelearn_content').select('id,title,description,type,created_at,view_count',{count:'exact'}).eq('submitted_by',userId).eq('status','live').order('created_at',{ascending:false}).limit(40),
   supabase.from('vibe_stories').select('view_count').eq('author_id',userId).eq('status','published'),
   supabase.from('vibelearn_content').select('view_count').eq('submitted_by',userId).eq('status','live')
  ]);
  if(!active)return;
  if(p.error)setError('Could not load profile settings.');
  if(p.data)setDraft({...EMPTY,...p.data,username:p.data.username??'',display_name:p.data.display_name??'',bio:p.data.bio??'',avatar_url:p.data.avatar_url??'',role_label:p.data.role_label??'',county:p.data.county??'',institution:p.data.institution??''});
  else{const {error:e}=await supabase.from('global_public_profiles').insert({profile_id:userId});if(e&&e.code!=='23505')setError('Could not initialise profile. Refresh and try again.')}
  const stories=(s.data??[]) as Story[],resources=(r.data??[]) as Resource[];
  const views=[...(sv.data??[]),...(rv.data??[])].reduce((n,x)=>n+((x as {view_count?:number}).view_count??0),0);
  setStats({stories:s.count??stories.length,resources:r.count??resources.length,views});
  setItems([...stories.map(x=>({...x,kind:'story',href:'/global/read/story/'+x.id})),...resources.map(x=>({...x,kind:(x.type??'').toLowerCase().includes('video')?'video':'resource',href:'/global/read/'+x.id}))].sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()));
  setLoading(false);
 }load().catch(()=>{if(active){setError('Could not load profile. Refresh and try again.');setLoading(false)}});return()=>{active=false}},[isLoggedIn,userId]);
 const filtered=useMemo(()=>tab==='Posts'?items:tab==='Resources'?items.filter(x=>x.kind==='resource'):tab==='Videos'?items.filter(x=>x.kind==='video'):[],[items,tab]);
 function field<K extends keyof Draft>(k:K,v:Draft[K]){setDraft(d=>({...d,[k]:v}))}
 async function save(e:React.FormEvent){e.preventDefault();setError('');setNotice('');const username=draft.username.trim().toLowerCase().replace(/^@/,'');const name=draft.display_name.trim();
  if(draft.is_public&&(!username||name.length<2)){setError('Add a public name and username before publishing your profile.');return}
  if(username&&!/^[a-z0-9_]{3,24}$/.test(username)){setError('Username must be 3–24 lowercase letters, numbers or underscores.');return}
  if(draft.avatar_url&&!/^https?:\/\//i.test(draft.avatar_url.trim())){setError('Photo URL must begin with http:// or https://.');return}
  setSaving(true);const {error:e2}=await supabase.from('global_public_profiles').upsert({profile_id:userId,username:username||null,display_name:name||null,bio:draft.bio.trim()||null,avatar_url:draft.avatar_url.trim()||null,role_label:draft.role_label.trim()||null,county:draft.county.trim()||null,institution:draft.institution.trim()||null,is_public:draft.is_public,show_social_counts:draft.show_social_counts},{onConflict:'profile_id'});setSaving(false);
  if(e2){setError(e2.code==='23505'?'That username is already taken.':e2.message||'Could not save profile.');return}setDraft(d=>({...d,username,display_name:name}));setNotice('Profile saved.');
 }
 async function signOut(){await supabase.auth.signOut();document.cookie='vibe_role=; path=/; max-age=0';router.replace('/global')}
 if(!isLoggedIn)return <main style={{minHeight:'65dvh',display:'grid',placeItems:'center',textAlign:'center',padding:24,color:'#fff'}}><div><h1>Your VibeSchool profile</h1><p style={{color:MUTED}}>Sign in to manage your profile and contributions.</p><button onClick={()=>router.push('/global/signup')} style={{background:ACCENT,color:BG,border:0,borderRadius:10,padding:12,fontWeight:800}}>Create account / Sign in</button></div></main>;
 if(loading)return <div style={{minHeight:'60dvh',display:'grid',placeItems:'center',color:ACCENT}}>Loading profile…</div>;
 const name=draft.display_name||userName||'Your profile',initials=name.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();
 return <main style={{background:BG,color:'#fff',minHeight:'70dvh',padding:'12px 0 100px',display:'grid',gap:18}}>
  <header style={{display:'flex',alignItems:'center',gap:14}}>
   {draft.avatar_url?<img src={draft.avatar_url} alt="" style={{width:66,height:66,borderRadius:'50%',objectFit:'cover'}}/>:<div style={{width:66,height:66,borderRadius:'50%',background:ACCENT,color:BG,display:'grid',placeItems:'center',fontWeight:900,fontSize:22}}>{initials}</div>}
   <div style={{flex:1,minWidth:0}}><h1 style={{fontSize:20,margin:0}}>{name}</h1><div style={{fontSize:12,color:MUTED,marginTop:4}}>{draft.username?'@'+draft.username:'Choose a username for your public link'}</div><div style={{fontSize:12,color:MUTED,marginTop:3}}>{draft.role_label||'VibeSchool member'}{draft.county?' · '+draft.county:''}</div></div>
   <span style={{fontSize:11,color:draft.is_public?ACCENT:MUTED,border:BORDER,borderRadius:18,padding:'6px 9px'}}>{draft.is_public?'Public':'Private'}</span>
  </header>
  <section style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,background:PANEL,border:BORDER,borderRadius:14,padding:14}}>{[['Posts',stats.stories],['Resources',stats.resources],['Views',stats.views]].map(([k,v])=><div key={String(k)} style={{textAlign:'center'}}><div style={{fontSize:19,fontWeight:850,color:ACCENT}}>{Number(v).toLocaleString()}</div><div style={{fontSize:11,color:MUTED}}>{k}</div></div>)}</section>
  {error&&<p role="alert" style={{color:'#ff8c8c',fontSize:13,margin:0}}>{error}</p>}{notice&&<p role="status" style={{color:ACCENT,fontSize:13,margin:0}}>{notice}</p>}
  <section style={{background:PANEL,border:BORDER,borderRadius:14,padding:16}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:12}}><h2 style={{fontSize:15,margin:0}}>Public profile</h2><span style={{fontSize:11,color:MUTED}}>Private by default</span></div>
   <form onSubmit={save} style={{display:'grid',gap:12}}>
    <label><span style={label}>Public name</span><input style={input} maxLength={80} value={draft.display_name} onChange={e=>field('display_name',e.target.value)} placeholder={userName||'Name shown publicly'}/></label>
    <label><span style={label}>Username</span><input style={input} maxLength={24} value={draft.username} onChange={e=>field('username',e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,''))} placeholder="e.g. teacherjane"/><span style={{fontSize:11,color:MUTED}}>vibeschool.co.ke/global/u/{draft.username||'username'}</span></label>
    <label><span style={label}>Bio</span><textarea style={{...input,minHeight:78,resize:'vertical'}} maxLength={280} value={draft.bio} onChange={e=>field('bio',e.target.value)} placeholder="What do you teach, create or care about?"/></label>
    <label><span style={label}>Profile photo URL</span><input style={input} value={draft.avatar_url} onChange={e=>field('avatar_url',e.target.value)} placeholder="https://…"/></label>
    <label><span style={label}>Role / profession</span><input style={input} maxLength={60} value={draft.role_label} onChange={e=>field('role_label',e.target.value)} placeholder="Teacher, learner, parent, creator…"/></label>
    <label><span style={label}>County</span><input style={input} maxLength={80} value={draft.county} onChange={e=>field('county',e.target.value)} placeholder="Optional"/></label>
    <label><span style={label}>School / institution</span><input style={input} maxLength={120} value={draft.institution} onChange={e=>field('institution',e.target.value)} placeholder="Optional"/></label>
    <div style={{borderTop:BORDER,paddingTop:12,display:'grid',gap:12}}>
     <label style={{display:'flex',gap:10,alignItems:'center',fontSize:13}}><input type="checkbox" checked={draft.is_public} onChange={e=>field('is_public',e.target.checked)}/> Make my profile publicly discoverable</label>
     <label style={{display:'flex',gap:10,alignItems:'center',fontSize:12,color:MUTED}}><input type="checkbox" checked={draft.show_social_counts} onChange={e=>field('show_social_counts',e.target.checked)}/> Show follower and following counts</label>
     <p style={{fontSize:11,color:MUTED,lineHeight:1.5,margin:0}}>Email, phone, account details, classes, learner information and school records are never displayed.</p>
    </div>
    <button type="submit" disabled={saving} style={{background:ACCENT,color:BG,border:0,borderRadius:10,padding:13,fontWeight:850}}>{saving?'Saving…':'Save profile'}</button>
    {draft.is_public&&draft.username&&<button type="button" onClick={()=>router.push('/global/u/'+draft.username)} style={{background:'transparent',color:'#fff',border:BORDER,borderRadius:10,padding:12}}>View public profile ↗</button>}
   </form>
  </section>
  <section style={{background:PANEL,border:BORDER,borderRadius:14,padding:16}}><h2 style={{fontSize:15,margin:'0 0 12px'}}>Your contributions</h2>
   <nav style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:9}}>{(['Posts','Resources','Videos','About','Activity'] as const).map(t=><button key={t} onClick={()=>setTab(t)} style={{whiteSpace:'nowrap',border:BORDER,borderRadius:20,padding:'7px 11px',background:tab===t?ACCENT:'transparent',color:tab===t?BG:MUTED,fontSize:11,fontWeight:800}}>{t}</button>)}</nav>
   {tab==='About'?<p style={{color:MUTED,fontSize:13,lineHeight:1.6,margin:0}}>{draft.bio||'Add a short bio to introduce yourself.'}{draft.institution?' · '+draft.institution:''}</p>:tab==='Activity'?<p style={{color:MUTED,fontSize:13,margin:0}}>Published stories and live learning resources appear in your public activity when visibility is enabled.</p>:filtered.length?<div style={{display:'grid',gap:9}}>{filtered.map(x=><button key={x.id} onClick={()=>router.push(x.href)} style={{textAlign:'left',background:'#0b1220',color:'#fff',border:BORDER,borderRadius:10,padding:12}}><div style={{fontSize:13,fontWeight:750}}>{x.title}</div><div style={{fontSize:11,color:MUTED,marginTop:4}}>{x.kind==='story'?'Story':x.kind==='video'?'Video':'Learning resource'} · {x.view_count} views</div></button>)}</div>:<p style={{color:MUTED,fontSize:13}}>Nothing published here yet.</p>}
  </section>
  <section style={{display:'grid',gap:8}}><button onClick={()=>router.push('/global/dashboard')} style={{background:'#1a2235',color:'#fff',border:BORDER,borderRadius:10,padding:13,fontWeight:700}}>Creator Dashboard →</button><button onClick={signOut} style={{background:'transparent',color:'#ff7777',border:'1px solid rgba(255,119,119,.2)',borderRadius:10,padding:13,fontWeight:700}}>Sign out</button></section>
 </main>
}
