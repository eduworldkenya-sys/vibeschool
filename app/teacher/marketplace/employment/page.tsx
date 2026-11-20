"use client";
import {useCallback,useEffect,useState} from "react";
import Link from "next/link";
import {supabase} from "@/lib/supabase";
import {useKenyaCounties} from "@/lib/geography/kenyaCounties";
import {AVAILABILITY,EMPTY_EMPLOYMENT,EMPLOYMENT_TYPES,EmploymentFields,HIRE_URL,LEVELS,MANAGE_URL,OwnListing,QUALIFICATIONS,REGISTRATION,RecruitmentRequest,REQUEST_FIELDS,splitSubjects,toggleOption} from "@/lib/public/teacherEmployment";
import styles from "@/components/teacher/marketplace/employment.module.css";

export default function EmploymentPage(){
 const {countyNames,error:countyError}=useKenyaCounties();
 const [uid,setUid]=useState(""),[name,setName]=useState(""),[listing,setListing]=useState<OwnListing|null>(null),[form,setForm]=useState<EmploymentFields>(EMPTY_EMPLOYMENT),[subjectText,setSubjectText]=useState(""),[consent,setConsent]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false),[requests,setRequests]=useState<RecruitmentRequest[]>([]);
 const load=useCallback(async()=>{
   setLoading(true);setError("");
   try{
    const {data:auth}=await supabase.auth.getUser();if(!auth.user){window.location.assign("/login?redirect="+encodeURIComponent(MANAGE_URL));return}
    const id=auth.user.id;setUid(id);
    const [profile,teacher,own]=await Promise.all([supabase.from("profiles").select("full_name").eq("id",id).single(),supabase.from("teacher_profiles").select("subjects_taught").eq("profile_id",id).maybeSingle(),supabase.from("teacher_employment_listings").select("*").eq("teacher_id",id).maybeSingle()]);
    if(profile.error||teacher.error||own.error)throw new Error("Could not load your employment profile.");
    setName(profile.data?.full_name??"");const row=own.data as OwnListing|null;setListing(row);
    const fields:EmploymentFields=row?{levels:row.levels,subjects:row.subjects,qualification:row.qualification,experience:row.experience,registration:row.registration,counties:row.counties,employment_types:row.employment_types,availability:row.availability,bio:row.bio,education:row.education,work_history:row.work_history}:{...EMPTY_EMPLOYMENT,subjects:(teacher.data?.subjects_taught??[]) as string[]};
    setForm(fields);setSubjectText(fields.subjects.join(", "));setConsent(!!row?.consented_at);
    if(row){const res=await supabase.from("teacher_employment_requests").select(REQUEST_FIELDS).eq("listing_id",row.id).order("created_at",{ascending:false});if(res.error)throw new Error("Could not load interview requests.");setRequests((res.data??[]) as RecruitmentRequest[])}else setRequests([]);
   }catch(e){setError(e instanceof Error?e.message:"Unable to load employment profile.")}finally{setLoading(false)}
 },[]);
 useEffect(()=>{void load()},[load]);
 function field<K extends keyof EmploymentFields>(key:K,value:EmploymentFields[K]){setForm(f=>({...f,[key]:value}))}
 function choices(key:"levels"|"counties"|"employment_types",options:readonly string[]){return <div className={styles.choices}>{options.map(v=><button type="button" className={styles.choice} key={v} aria-pressed={form[key].includes(v)} onClick={()=>field(key,toggleOption(form[key],v))}>{v}</button>)}</div>}
 const subjects=splitSubjects(subjectText);
 const valid=!!name.trim()&&form.levels.length>0&&subjects.length>0&&!!form.qualification&&!!form.registration&&form.counties.length>0&&form.employment_types.length>0&&Number.isInteger(form.experience)&&form.experience>=0&&form.experience<=60&&consent;
 async function save(status:"published"|"paused"){
   if(busy||!uid||(status==="published"&&!valid))return;
   setBusy(true);setError("");setNotice("");
   try{
    const payload=status==="paused"?{status}:{...form,subjects,status,consented_at:new Date().toISOString()};
    const result=listing?await supabase.from("teacher_employment_listings").update(payload).eq("id",listing.id).eq("teacher_id",uid).select("id").single():await supabase.from("teacher_employment_listings").insert({...payload,teacher_id:uid}).select("id").single();
    if(result.error)throw new Error("Could not update your employment listing. Check your teacher account and try again.");
    await load();setNotice(status==="published"?"Your profile is published.":"Your profile is hidden.");
   }catch(e){setError(e instanceof Error?e.message:"Unable to save.")}finally{setBusy(false)}
 }
 async function respond(id:string,status:"accepted"|"declined"){
  if(busy)return;setBusy(true);setError("");setNotice("");
  try{const result=await supabase.from("teacher_employment_requests").update({status}).eq("id",id).eq("status","pending").select("id").single();if(result.error)throw new Error("Could not respond to this request.");await load();setNotice("Response saved.")}catch(e){setError(e instanceof Error?e.message:"Unable to respond.")}finally{setBusy(false)}
 }
 if(loading)return <div className={styles.wrap} role="status">Loading employment profile…</div>;
 return <div className={styles.wrap}><div className={styles.panel}>
 <header className={styles.toolbar}><h2>My Employment</h2><Link href={HIRE_URL} className={styles.secondary}>Hire Teachers</Link></header>
 {listing&&<p className={styles.status}>{listing.status==="published"?"Open to work · Profile visible":"Profile hidden"}</p>}
 {error&&<div role="alert" className={styles.error}>{error} <button className={styles.secondary} onClick={()=>void load()}>Retry</button></div>}{notice&&<p role="status">{notice}</p>}
 <form className={styles.form} onSubmit={e=>{e.preventDefault();void save("published")}}>
 <label className={styles.field}>Full name<input value={name} readOnly/></label>
 <fieldset><legend>Teaching levels</legend>{choices("levels",LEVELS)}</fieldset>
 <label className={styles.field}>Subjects (comma-separated)<input required maxLength={240} value={subjectText} onChange={e=>setSubjectText(e.target.value)} placeholder="Mathematics, English"/></label>
 <label className={styles.field}>Highest qualification<select required value={form.qualification} onChange={e=>field("qualification",e.target.value)}><option value="">Select qualification</option>{QUALIFICATIONS.map(v=><option key={v}>{v}</option>)}</select></label>
 <label className={styles.field}>Years of teaching experience<input type="number" min={0} max={60} required value={form.experience} onChange={e=>field("experience",Number(e.target.value))}/></label>
 <label className={styles.field}>TSC registration<select required value={form.registration} onChange={e=>field("registration",e.target.value)}><option value="">Select status</option>{REGISTRATION.map(v=><option key={v}>{v}</option>)}</select></label>
 <fieldset><legend>Preferred counties</legend>{countyError?<p role="alert">{countyError}</p>:<select aria-label="Add preferred county" value="" onChange={e=>{if(e.target.value)field("counties",[...new Set([...form.counties,e.target.value])])}}><option value="">Select county</option>{countyNames.map(c=><option key={c}>{c}</option>)}</select>}<div className={styles.choices}>{form.counties.map(c=><button key={c} type="button" className={styles.choice} onClick={()=>field("counties",form.counties.filter(v=>v!==c))}>{c} ×</button>)}</div></fieldset>
 <fieldset><legend>Employment type</legend>{choices("employment_types",EMPLOYMENT_TYPES)}</fieldset>
 <label className={styles.field}>Availability<select value={form.availability} onChange={e=>field("availability",e.target.value)}>{AVAILABILITY.map(v=><option key={v}>{v}</option>)}</select></label>
 <label className={styles.field}>About yourself<textarea maxLength={600} rows={3} value={form.bio} onChange={e=>field("bio",e.target.value)}/></label>
 <label className={styles.field}>Education (optional)<textarea maxLength={1500} rows={3} value={form.education} onChange={e=>field("education",e.target.value)}/></label>
 <label className={styles.field}>Employment history (optional)<textarea maxLength={2000} rows={4} value={form.work_history} onChange={e=>field("work_history",e.target.value)}/></label>
 <p className={styles.hint}>Your name and these professional details will be public. Do not include contact details, TSC numbers, ID numbers, referees' contact information or other private information.</p>
 <label className={styles.check}><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>I consent to publishing my professional profile and confirm the information is accurate.</label>
 <div className={styles.actions}><button type="submit" className={styles.button} disabled={!valid||busy}>{busy?"Saving…":listing?.status==="published"?"Save published profile":"Publish profile"}</button>{listing?.status==="published"&&<button type="button" className={styles.secondary} disabled={busy} onClick={()=>void save("paused")}>Hide listing</button>}</div>
 </form>
 <section className={styles.section}><h2>Interview invitations</h2>{requests.length===0?<p className={styles.hint}>No interview invitations yet.</p>:requests.map(r=><article key={r.id} className={styles.request}><strong>{r.school_name}</strong><p>{r.message}</p><span className={styles.status}>{r.status}</span>{r.status==="pending"&&<div className={styles.actions}><button className={styles.button} disabled={busy} onClick={()=>void respond(r.id,"accepted")}>Accept</button><button className={styles.secondary} disabled={busy} onClick={()=>void respond(r.id,"declined")}>Decline</button></div>}</article>)}</section>
 </div></div>
}
