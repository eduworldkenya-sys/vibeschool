"use client";
import {useCallback,useEffect,useState} from "react";
import Link from "next/link";
import {downloadTeacherCv} from "@/lib/public/teacherCvPdf";
import {supabase} from "@/lib/supabase";
import {useKenyaCounties} from "@/lib/geography/kenyaCounties";
import {AVAILABILITY,CV_BUCKET,personalCvPath,sharedCvPath,EMPTY_EMPLOYMENT,EMPLOYMENT_TYPES,EmploymentFields,HIRE_URL,LEVELS,MANAGE_URL,OwnListing,QUALIFICATIONS,REGISTRATION,RecruitmentRequest,REQUEST_FIELDS,splitSubjects,toggleOption} from "@/lib/public/teacherEmployment";
import styles from "@/components/teacher/marketplace/employment.module.css";

export default function EmploymentPage(){
 const {countyNames,error:countyError}=useKenyaCounties();
 const [cvExists,setCvExists]=useState(false),[cvShared,setCvShared]=useState<string[]>([]);
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
    const cv=await supabase.storage.from(CV_BUCKET).list("personal/"+id,{limit:5,search:"cv.pdf"});setCvExists(!cv.error&&(cv.data??[]).some(file=>file.name==="cv.pdf"));
    setForm(fields);setSubjectText(fields.subjects.join(", "));setConsent(!!row?.consented_at);
    if(row){const res=await supabase.from("teacher_employment_requests").select(REQUEST_FIELDS).eq("listing_id",row.id).order("created_at",{ascending:false});if(res.error)throw new Error("Could not load interview requests.");const incoming=(res.data??[]) as RecruitmentRequest[];setRequests(incoming);const shared=await Promise.all(incoming.filter(r=>r.status==="accepted").map(async r=>{const f=await supabase.storage.from(CV_BUCKET).list("shared/"+r.id,{limit:5,search:"cv.pdf"});return !f.error&&(f.data??[]).some(file=>file.name==="cv.pdf")?r.id:null}));setCvShared(shared.filter((id):id is string=>id!==null))}else setRequests([]);
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
 async function downloadFile(path:string,filename:string){
  const {data,error:e}=await supabase.storage.from(CV_BUCKET).download(path);if(e||!data)throw new Error("CV unavailable.");
  const url=URL.createObjectURL(data);const a=document.createElement("a");a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
 }
 async function uploadCv(file:File){
  if(busy||!uid)return;setBusy(true);setNotice("");setError("");
  try{if(file.size>5*1024*1024||file.type!=="application/pdf"||await file.slice(0,5).text()!=="%PDF-")throw new Error("Select a PDF file smaller than 5 MB.");
   const {error:e}=await supabase.storage.from(CV_BUCKET).upload(personalCvPath(uid),file,{upsert:true,contentType:"application/pdf"});if(e)throw new Error("CV upload failed.");setCvExists(true);setNotice("Private CV uploaded.");
  }catch(e){setError(e instanceof Error?e.message:"CV upload failed.")}finally{setBusy(false)}
 }
 async function removeCv(){
  if(!uid||busy)return;setBusy(true);setError("");try{const {error:e}=await supabase.storage.from(CV_BUCKET).remove([personalCvPath(uid)]);if(e)throw e;setCvExists(false);setNotice("Private file removed. Previously shared copies must be revoked separately.")}catch{setError("Could not remove your CV.")}finally{setBusy(false)}
 }
 async function shareCv(r:RecruitmentRequest,revoke=false){
  if(!uid||busy||r.status!=="accepted")return;setBusy(true);setError("");setNotice("");
  try{if(revoke){const {error:e}=await supabase.storage.from(CV_BUCKET).remove([sharedCvPath(r.id)]);if(e)throw e;setCvShared(ids=>ids.filter(id=>id!==r.id));setNotice("The school's access to this shared copy is revoked. Previously downloaded copies cannot be recalled.")}
   else{const {data,error:e}=await supabase.storage.from(CV_BUCKET).download(personalCvPath(uid));if(e||!data)throw new Error("Upload a private PDF first.");
    const result=await supabase.storage.from(CV_BUCKET).upload(sharedCvPath(r.id),data,{upsert:true,contentType:"application/pdf"});if(result.error)throw result.error;setCvShared(ids=>[...new Set([...ids,r.id])]);setNotice("CV shared privately with "+r.school_name+".")}
  }catch(e){setError(e instanceof Error?e.message:"CV sharing failed.")}finally{setBusy(false)}
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
 <section className={styles.section}><h2>My CV</h2><button className={styles.secondary} disabled={!valid} onClick={()=>void downloadTeacherCv(name,{...form,subjects}).catch(()=>setError("Could not generate your digital CV."))}>Download digital CV (PDF)</button><label className={styles.field}>Upload private CV (optional · PDF up to 5 MB)<input type="file" disabled={busy} accept="application/pdf,.pdf" onChange={e=>{const f=e.target.files?.[0];e.target.value="";if(f)void uploadCv(f)}}/></label>{cvExists&&<div className={styles.actions}><button className={styles.secondary} onClick={()=>void downloadFile(personalCvPath(uid),"my-cv.pdf").catch(()=>setError("Could not download your CV."))}>Download uploaded CV</button><button className={styles.secondary} disabled={busy} onClick={()=>void removeCv()}>Remove</button></div>}<p className={styles.hint}>Your uploaded PDF is never public. You decide whether to share a copy with a school after accepting its invitation.</p></section><section className={styles.section}><h2>Interview invitations</h2>{requests.length===0?<p className={styles.hint}>No interview invitations yet.</p>:requests.map(r=><article key={r.id} className={styles.request}><strong>{r.school_name}</strong><p>{r.message}</p><span className={styles.status}>{r.status}</span>{r.status==="pending"&&<div className={styles.actions}><button className={styles.button} disabled={busy} onClick={()=>void respond(r.id,"accepted")}>Accept</button><button className={styles.secondary} disabled={busy} onClick={()=>void respond(r.id,"declined")}>Decline</button></div>}{r.status==="accepted"&&<div className={styles.actions}>{cvExists&&<button className={styles.secondary} disabled={busy} onClick={()=>{if(window.confirm("Share a copy of your PDF CV with "+r.school_name+"?"))void shareCv(r)}}>{cvShared.includes(r.id)?"Replace shared CV":"Share CV with school"}</button>}{cvShared.includes(r.id)&&<button className={styles.secondary} disabled={busy} onClick={()=>void shareCv(r,true)}>Revoke CV access</button>}</div>}</article>)}</section>
 </div></div>
}
