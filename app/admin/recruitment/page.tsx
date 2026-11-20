"use client";
import {useCallback,useEffect,useState} from "react";
import Link from "next/link";
import {supabase} from "@/lib/supabase";
import {getAdminSchoolAuthority} from "@/lib/admin/authority";
import HireTeachers from "@/components/teacher/marketplace/HireTeachers";
import {Candidate,CV_BUCKET,DIRECTORY_FIELDS,RecruitmentRequest,REQUEST_FIELDS,sharedCvPath} from "@/lib/public/teacherEmployment";
import styles from "@/components/teacher/marketplace/employment.module.css";

export default function RecruitmentPage(){
 const [schoolId,setSchoolId]=useState(""),[requests,setRequests]=useState<RecruitmentRequest[]>([]),[shortlisted,setShortlisted]=useState<string[]>([]),[saved,setSaved]=useState<Candidate[]>([]),[tab,setTab]=useState<"discover"|"shortlist"|"requests">("discover"),[error,setError]=useState(""),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const authority=await getAdminSchoolAuthority();setSchoolId(authority.schoolId);
   const [req,short]=await Promise.all([supabase.from("teacher_employment_requests").select(REQUEST_FIELDS).eq("school_id",authority.schoolId).order("created_at",{ascending:false}),supabase.from("teacher_employment_shortlists").select("listing_id").eq("school_id",authority.schoolId)]);
   if(req.error||short.error)throw new Error("Recruitment records could not be loaded.");
   const ids=(short.data??[]).map((r:{listing_id:string})=>r.listing_id);setShortlisted(ids);setRequests((req.data??[]) as RecruitmentRequest[]);
   if(ids.length){const res=await supabase.from("teacher_employment_directory").select(DIRECTORY_FIELDS).in("id",ids);if(res.error)throw new Error("Shortlisted profiles could not be loaded.");setSaved((res.data??[]) as Candidate[])}else setSaved([]);
  }catch(e){setError(e instanceof Error?e.message:"Recruitment is unavailable.")}finally{setLoading(false)}
 },[]);
 useEffect(()=>{void load()},[load]);
 async function toggle(id:string){
  if(busy||!schoolId)return;setBusy(true);setError("");
  try{const r=shortlisted.includes(id)?await supabase.from("teacher_employment_shortlists").delete().eq("school_id",schoolId).eq("listing_id",id):await supabase.from("teacher_employment_shortlists").insert({school_id:schoolId,listing_id:id});if(r.error)throw r.error;await load()}catch{setError("Could not update your shortlist.")}finally{setBusy(false)}
 }
 async function download(id:string){
  setError("");try{const {data,error:e}=await supabase.storage.from(CV_BUCKET).download(sharedCvPath(id));if(e||!data)throw new Error("The teacher has not shared a CV, or access has been revoked.");const url=URL.createObjectURL(data);const a=document.createElement("a");a.href=url;a.download="teacher-cv.pdf";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch(e){setError(e instanceof Error?e.message:"CV unavailable.")}
 }
 return <main className={styles.wrap}><div className={styles.panel}><header className={styles.toolbar}><h2>Recruit teachers</h2><Link href="/admin/teachers" className={styles.secondary}>School teachers</Link></header><div className={styles.actions} aria-label="Recruitment views">{(["discover","shortlist","requests"] as const).map(t=><button key={t} className={styles.choice} aria-pressed={tab===t} onClick={()=>{setTab(t);if(t!=="discover")void load()}}>{t==="discover"?"Discover":t==="shortlist"?"Shortlist":"Interview requests"}</button>)}</div>{error&&<p role="alert" className={styles.error}>{error} <button className={styles.secondary} onClick={()=>void load()}>Retry</button></p>}{loading?<p role="status">Loading recruitment…</p>:schoolId&&<>{tab==="discover"&&<HireTeachers schoolId={schoolId} shortlisted={shortlisted} onShortlist={id=>void toggle(id)}/>}
 {tab==="shortlist"&&(saved.length?<div className={styles.grid}>{saved.map(c=><article className={styles.card} key={c.id}><h3>{c.display_name}</h3><p>{c.subjects.join(", ")} · {c.counties.join(", ")}</p><button className={styles.secondary} onClick={()=>void toggle(c.id)}>Remove from shortlist</button></article>)}</div>:<p>No available shortlisted teachers.</p>)}
 {tab==="requests"&&(requests.length?<section className={styles.section}>{requests.map(r=><article className={styles.request} key={r.id}><strong>{r.teacher_name}</strong><p>{r.message}</p><span>{r.status}</span>{r.status==="accepted"&&<button className={styles.secondary} onClick={()=>void download(r.id)}>Download shared CV</button>}</article>)}</section>:<p>No interview requests sent yet.</p>)}</>}</div></main>
}
