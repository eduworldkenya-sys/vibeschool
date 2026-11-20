"use client";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {supabase} from "@/lib/supabase";
import {getAdminSchoolAuthority} from "@/lib/admin/authority";
import {useKenyaCounties} from "@/lib/geography/kenyaCounties";
import {Candidate,DIRECTORY_FIELDS,LEVELS,MANAGE_URL} from "@/lib/public/teacherEmployment";
import styles from "./employment.module.css";

export default function HireTeachers(){
  const {countyNames}=useKenyaCounties();
  const [query,setQuery]=useState(""),[county,setCounty]=useState(""),[level,setLevel]=useState(""),[page,setPage]=useState(0),[rows,setRows]=useState<Candidate[]>([]),[more,setMore]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),[retry,setRetry]=useState(0);
  const [candidate,setCandidate]=useState<Candidate|null>(null),[message,setMessage]=useState(""),[contactStatus,setContactStatus]=useState(""),[busy,setBusy]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    let active=true;setLoading(true);setError("");
    const timer=setTimeout(async()=>{
      try{
        let q=supabase.from("teacher_employment_directory").select(DIRECTORY_FIELDS).order("published_at",{ascending:false}).order("id",{ascending:true});
        if(county)q=q.contains("counties",[county]);if(level)q=q.contains("levels",[level]);
        const term=query.trim().slice(0,100).replace(/[%_\\]/g," ");
        if(term)q=q.ilike("search_text","%"+term+"%");
        const result=await q.range(page*30,page*30+30);
        if(!active)return;if(result.error)throw result.error;
        setRows((result.data??[]).slice(0,30) as Candidate[]);setMore((result.data??[]).length>30);
      }catch{if(active){setRows([]);setMore(false);setError("Teacher listings could not load. Try again.")}}finally{if(active)setLoading(false)}
    },250);
    return()=>{active=false;clearTimeout(timer)};
  },[query,county,level,page,retry]);
  useEffect(()=>{if(candidate&&!dialog.current?.open)dialog.current?.showModal()},[candidate]);
  function close(){setCandidate(null);setMessage("");setContactStatus("")}
  async function contact(){
    if(!candidate||!message.trim()||busy)return;
    setBusy(true);setContactStatus("");
    try{
      const {data:auth}=await supabase.auth.getUser();
      if(!auth.user){window.location.assign("/login?redirect="+encodeURIComponent("/teacher/marketplace?tab=hire"));return}
      const authority=await getAdminSchoolAuthority();
      const {error:sendError}=await supabase.from("teacher_employment_requests").insert({listing_id:candidate.id,school_id:authority.schoolId,message:message.trim()});
      if(sendError){setContactStatus(sendError.code==="23505"?"Your school already sent a request to this teacher.":"Could not send the request. Check your school authority and try again.");return}
      setContactStatus("Interview request sent. The teacher can accept or decline.");setMessage("");
    }catch{setContactStatus("Only an authorized school administrator can send an interview request.")}finally{setBusy(false)}
  }
  return <section className={styles.panel} aria-label="Hire teachers">
    <header className={styles.toolbar}><h3>Available teachers</h3><Link href={MANAGE_URL} className={styles.button}>List yourself for work +</Link></header>
    <div className={styles.filters}><input aria-label="Search teachers by name or subject" placeholder="Search teachers or subjects" value={query} onChange={e=>{setPage(0);setQuery(e.target.value)}}/><select aria-label="Preferred county" value={county} onChange={e=>{setPage(0);setCounty(e.target.value)}}><option value="">All counties</option>{countyNames.map(c=><option key={c}>{c}</option>)}</select><select aria-label="Teaching level" value={level} onChange={e=>{setPage(0);setLevel(e.target.value)}}><option value="">All levels</option>{LEVELS.map(l=><option key={l}>{l}</option>)}</select></div>
    {loading?<p role="status">Loading teachers…</p>:error?<div role="alert" className={styles.empty}>{error} <button className={styles.secondary} onClick={()=>setRetry(n=>n+1)}>Retry</button></div>:rows.length===0?<div className={styles.empty}>No available teachers match your search.</div>:<div className={styles.grid}>{rows.map(c=><article className={styles.card} key={c.id}><div className={styles.identity}><span className={styles.avatar} aria-hidden="true">{c.display_name.split(/\s+/).slice(0,2).map(n=>n[0]).join("").toUpperCase()}</span><div><h3>{c.display_name}</h3><span className={styles.available}>Open to work</span></div></div><div className={styles.meta}><p>{c.levels.join(" · ")}</p><p><strong>{c.subjects.join(", ")}</strong></p><p>{c.qualification} · {c.experience===0?"Fresh graduate":c.experience+" years experience"}</p><p>{c.counties.join(" · ")}</p><p>{c.availability}</p></div><button className={styles.secondary} onClick={()=>{setCandidate(c);setContactStatus("");setMessage("")}}>View professional profile</button></article>)}</div>}
    {!loading&&!error&&(page>0||more)&&<div className={styles.actions}><button className={styles.secondary} disabled={page===0} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page+1}</span><button className={styles.secondary} disabled={!more} onClick={()=>setPage(p=>p+1)}>Next</button></div>}
    <dialog ref={dialog} className={styles.dialog} onClose={close} aria-labelledby="candidate-name">
      {candidate&&<div className={styles.section}><header className={styles.toolbar}><h2 id="candidate-name">{candidate.display_name}</h2><button className={styles.secondary} onClick={()=>dialog.current?.close()} aria-label="Close profile">Close</button></header><span className={styles.available}>Open to work</span><div className={styles.meta}><p>{candidate.levels.join(" · ")} · {candidate.subjects.join(", ")}</p><p>{candidate.qualification} · {candidate.experience} years experience</p><p>TSC: {candidate.registration} (self-declared)</p><p>Preferred counties: {candidate.counties.join(", ")}</p><p>{candidate.employment_types.join(" · ")} · {candidate.availability}</p></div>{candidate.bio&&<><h3>About</h3><p className={styles.detail}>{candidate.bio}</p></>}{candidate.education&&<><h3>Education</h3><p className={styles.detail}>{candidate.education}</p></>}{candidate.work_history&&<><h3>Experience</h3><p className={styles.detail}>{candidate.work_history}</p></>}<p className={styles.hint}>Credentials are self-declared. Schools should verify qualifications independently.</p><label className={styles.field}>Interview request<textarea rows={3} maxLength={1000} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Introduce your school and the available position."/></label><button className={styles.button} disabled={busy||!message.trim()} onClick={()=>void contact()}>{busy?"Sending…":"Send interview request"}</button>{contactStatus&&<p role="status">{contactStatus}</p>}</div>}
    </dialog>
  </section>
}
