"use client";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { useKenyaCounties, normalizeKenyaCounty } from "@/lib/geography/kenyaCounties";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Plus, SlidersHorizontal } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import TeachingJobs from "../TeachingJobs";
import styles from "./marketplace.module.css";
import detailStyles from "@/components/teacher/marketplace/listingDetails.module.css";
import ListingDetailDialog from "@/components/teacher/marketplace/ListingDetailDialog";
import ListingTabs from "@/components/teacher/marketplace/ListingTabs";
import { swapListing, validListingId } from "@/lib/public/teacherListings";

type Level = "Primary" | "Junior School" | "Senior School";
type Listing = {id:string;teacher_id:string;current_county:string;current_subcounty:string;preferred_county:string;preferred_subcounty:string|null;school_level:Level;subject:string;status:"published"|"paused";created_at:string};
type Interest = {id:string;listing_id:string;sender_id:string;message:string;contact_phone:string;status:"pending"|"accepted"|"declined";created_at:string};
type Draft = {current_county:string;current_subcounty:string;preferred_county:string;preferred_subcounty:string;school_level:Level;subject:string};
const empty:Draft={current_county:"",current_subcounty:"",preferred_county:"",preferred_subcounty:"",school_level:"Primary",subject:""};
const SELECT="id,teacher_id,current_county,current_subcounty,preferred_county,preferred_subcounty,school_level,subject,status,created_at";
const INTEREST_SELECT="id,listing_id,sender_id,message,contact_phone,status,created_at";
const validPhone=(s:string)=>/^\+?[0-9]{10,15}$/.test(s);

export default function TeacherMarketplace(){
 const { counties, countyNames: COUNTIES } = useKenyaCounties();
 const [tab,setTab]=useState<"swap"|"jobs">("jobs");
 const [userId,setUserId]=useState<string|null>(null);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [listings,setListings]=useState<Listing[]>([]);
 const [interests,setInterests]=useState<Interest[]>([]);
 const [filterCounty,setFilterCounty]=useState("");
 const [filterLevel,setFilterLevel]=useState("");
 const [filters,setFilters]=useState(false);
 const [editing,setEditing]=useState(false);
 const [draft,setDraft]=useState<Draft>(empty);
 const [message,setMessage]=useState("");
 const [phone,setPhone]=useState("");
 const [selected,setSelected]=useState<string|null>(null);
 const [detail,setDetail]=useState<Listing|null>(null);
 const interestInput=useRef<HTMLInputElement>(null);
 const mine=listings.find(l=>l.teacher_id===userId);
 const load=useCallback(async()=>{
  setError("");setLoading(true);
  try {
   const client=getSupabaseClient();
   const [{data:auth,error:authError},{data:rows,error:rowsError}]=await Promise.all([
    client.auth.getUser(),
    client.from("teacher_swap_listings").select(SELECT).order("created_at",{ascending:false}).limit(200)
   ]);
   if(authError) throw authError;
   if(rowsError) throw rowsError;
   const uid=auth.user?.id??null;
   const publicRows=(rows??[]) as Listing[];
   const sharedId=new URLSearchParams(window.location.search).get("swap");
   if(validListingId(sharedId)&&!publicRows.some(row=>row.id===sharedId)){
    const {data:shared,error:sharedError}=await client.from("teacher_swap_listings").select(SELECT).eq("id",sharedId).eq("status","published").maybeSingle();
    if(sharedError)throw sharedError;
    if(shared)publicRows.push(shared as Listing);
   }
   setUserId(uid);setListings(publicRows);
   if(uid){
    const {data:requests,error:requestError}=await client.from("teacher_swap_interests").select(INTEREST_SELECT).order("created_at",{ascending:false}).limit(200);
    if(requestError) throw requestError;
    setInterests((requests??[]) as Interest[]);
   }else setInterests([]);
  }catch(e){setError(e instanceof Error?e.message:"Cannot load swap listings.");}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 const outgoing=useMemo(()=>new Set(interests.filter(i=>i.sender_id===userId).map(i=>i.listing_id)),[interests,userId]);
 const visible=useMemo(()=>listings.filter(l=>l.status==="published"&&l.teacher_id!==userId&&(!filterCounty||l.preferred_county===filterCounty||l.current_county===filterCounty)&&(!filterLevel||l.school_level===filterLevel)).sort((a,b)=>{
   const score=(l:Listing)=>mine&&l.current_county===mine.preferred_county&&l.preferred_county===mine.current_county&&l.school_level===mine.school_level?1:0;
   return score(b)-score(a);
 }),[listings,userId,filterCounty,filterLevel,mine]);
 const incoming=interests.filter(i=>i.listing_id===mine?.id);
 useEffect(()=>{
  function sync(){
  const params=new URLSearchParams(window.location.search);
  if(params.get("tab")==="swap"||params.has("swap"))setTab("swap");
  const id=params.get("swap");
  if(loading)return;
  if(!validListingId(id)){setDetail(null);return;}
  const row=listings.find(l=>l.id===id&&l.status==="published");
  if(!row){setNotice("This swap is no longer available.");return;}
  if(params.get("interest")==="1"&&userId&&row.teacher_id!==userId&&!outgoing.has(id)){
   setSelected(id);params.delete("swap");params.delete("interest");
   window.history.replaceState(null,"",window.location.pathname+"?"+params.toString());
  }else setDetail(row);
  }
  sync();window.addEventListener("popstate",sync);return()=>window.removeEventListener("popstate",sync);
 },[listings,loading,userId,outgoing]);
 useEffect(()=>{if(selected)interestInput.current?.focus();},[selected]);
 function viewDetails(row:Listing){
  const next=new URL(window.location.href);next.searchParams.set("swap",row.id);next.searchParams.delete("interest");window.history.pushState(null,"",next);setError("");setDetail(row);
 }
 function closeDetails(){
  const next=new URL(window.location.href);next.searchParams.delete("swap");next.searchParams.delete("interest");window.history.replaceState(null,"",next);setDetail(null);
 }

 function startEdit(){
  if(mine) setDraft({current_county:normalizeKenyaCounty(mine.current_county,counties),current_subcounty:mine.current_subcounty,preferred_county:normalizeKenyaCounty(mine.preferred_county,counties),preferred_subcounty:mine.preferred_subcounty??"",school_level:mine.school_level,subject:mine.subject});
  else setDraft(empty);
  setError("");setNotice("");setEditing(true);
 }
 async function save(){
  if(!userId){setError("Sign in to post a swap.");return;}
  const d={...draft,current_county:normalizeKenyaCounty(draft.current_county,counties),preferred_county:normalizeKenyaCounty(draft.preferred_county,counties),current_subcounty:draft.current_subcounty.trim(),preferred_subcounty:draft.preferred_subcounty.trim(),subject:draft.subject.trim()};
  if(!COUNTIES.includes(d.current_county)||!COUNTIES.includes(d.preferred_county)||d.current_county===d.preferred_county||d.current_subcounty.length<2){setError("Choose different current and preferred counties, and enter your current sub-county.");return;}
  setBusy(true);setError("");setNotice("");
  try{
   const client=getSupabaseClient();
   const {data:auth}=await client.auth.getUser();
   if(auth.user?.id!==userId) throw new Error("Your session expired. Sign in again.");
   const payload={...d,preferred_subcounty:d.preferred_subcounty||null};
   const result=mine?await client.from("teacher_swap_listings").update({...payload,updated_at:new Date().toISOString()}).eq("id",mine.id).eq("teacher_id",userId):
     await client.from("teacher_swap_listings").insert({...payload,teacher_id:userId});
   if(result.error)throw result.error;
   setEditing(false);setNotice(mine?"Swap listing updated.":"Your swap is published.");await load();
  }catch(e){setError(e instanceof Error?e.message:"Could not save. Try again.");}
  finally{setBusy(false);}
 }
 async function toggle(){
  if(!mine)return;
  setBusy(true);setError("");
  const {error:e}=await getSupabaseClient().from("teacher_swap_listings").update({status:mine.status==="published"?"paused":"published",updated_at:new Date().toISOString()}).eq("id",mine.id).eq("teacher_id",userId!);
  if(e)setError(e.message);else{setNotice(mine.status==="published"?"Listing paused.":"Listing published.");await load();}
  setBusy(false);
 }
 async function sendInterest(){
  if(!selected||!userId)return;
  if(!validPhone(phone)){setError("Enter a valid contact number (10–15 digits; + optional).");return;}
  setBusy(true);setError("");
  const {error:e}=await getSupabaseClient().from("teacher_swap_interests").insert({listing_id:selected,sender_id:userId,message:message.trim().slice(0,500),contact_phone:phone.trim()});
  if(e)setError(e.message);else{setSelected(null);setMessage("");setPhone("");setNotice("Interest sent privately to the listing owner.");await load();}
  setBusy(false);
 }
 async function removeInterest(id:string){
  setBusy(true);setError("");
  const {error:e}=await getSupabaseClient().from("teacher_swap_interests").delete().eq("id",id).eq("sender_id",userId!);
  if(e)setError(e.message);else{setNotice("Interest withdrawn.");await load();}
  setBusy(false);
 }
 async function deleteSwap(){
  if(!mine||!window.confirm("Delete your swap listing and its interest requests?"))return;
  setBusy(true);setError("");
  const {error:e}=await getSupabaseClient().from("teacher_swap_listings").delete().eq("id",mine.id).eq("teacher_id",userId!);
  if(e)setError(e.message);else{setNotice("Swap listing deleted.");await load();}
  setBusy(false);
 }
 async function respond(id:string,status:"accepted"|"declined"){
  setBusy(true);setError("");
  const {error:e}=await getSupabaseClient().from("teacher_swap_interests").update({status}).eq("id",id).eq("listing_id",mine?.id??"");
  if(e)setError(e.message);else{setNotice(status==="accepted"?"Interest accepted. Contact the teacher using the number they supplied.":"Interest declined.");await load();}
  setBusy(false);
 }
 return <div className={styles.root}>
  <header className={styles.header}><p className={styles.kicker}>VIBESCHOOL · TEACHERS</p><h1>Teacher Marketplace</h1><p>School jobs and station swaps, in one place.</p><Link className={styles.secondary} href="/teacher/tutoring">My tutoring</Link></header>
  <ListingTabs value={tab} idPrefix="managed-opportunities" onChange={next=>{closeDetails();setTab(next);const url=new URL(window.location.href);url.searchParams.set("tab",next);window.history.replaceState(null,"",url);}} />
  {tab==="jobs"&&<section className={styles.panel} role="tabpanel" id="managed-opportunities-panel-jobs" aria-labelledby="managed-opportunities-tab-jobs"><h2>Teaching vacancies</h2><TeachingJobs/></section>}
  {tab==="swap"&&<section className={styles.panel} role="tabpanel" id="managed-opportunities-panel-swap" aria-labelledby="managed-opportunities-tab-swap">
    <div className={styles.heading}><div><h2>Teacher Swap</h2><p>Find potential colleagues looking to exchange stations.</p></div><button className={styles.primary} onClick={startEdit}><Plus size={18}/>{mine?"Edit my swap":"Post a swap"}</button></div>
    <p className={styles.disclaimer}>Discovery only. Matching is not TSC approval. Complete official transfers through the <a href="https://portal.tsc.go.ke/" target="_blank" rel="noopener noreferrer">TSC portal</a>.</p>
    {notice&&<p className={styles.success} role="status">{notice}</p>}
    {error&&<p className={styles.error} role="alert">{error}</p>}
    {mine&&!editing&&<section className={styles.mine}><div className={styles.heading}><div><strong>My swap · {mine.status==="published"?"Published":"Paused"}</strong><p>{mine.current_county} → {mine.preferred_county} · {mine.school_level}</p></div><div className={styles.actions}><button className={styles.secondary} disabled={busy} onClick={()=>void toggle()}>{mine.status==="published"?"Pause":"Republish"}</button><button className={styles.secondary} disabled={busy} onClick={()=>void deleteSwap()}>Delete</button></div></div>
      {incoming.length>0&&<div className={styles.requests}><strong>Interest requests ({incoming.length})</strong>{incoming.map(i=><article key={i.id}><p>{i.message||"Interested in your swap."}</p><small>Contact provided: {i.contact_phone} · {i.status}</small>{i.status==="pending"&&<div className={styles.actions}><button disabled={busy} className={styles.primary} onClick={()=>void respond(i.id,"accepted")}>Accept</button><button disabled={busy} className={styles.secondary} onClick={()=>void respond(i.id,"declined")}>Decline</button></div>}</article>)}</div>}
    </section>}
    {editing&&<div className={styles.form}><h3>{mine?"Edit your swap":"Post your swap"}</h3><p>Your account is used automatically. Do not enter your name or personal details in the listing.</p>
      <div className={styles.fields}>
       <label>Current county<SearchableSelect label="Current county" value={draft.current_county} options={COUNTIES} placeholder="Search county" onChange={v=>setDraft({...draft,current_county:v})}/></label>
       <label>Current sub-county<input maxLength={100} value={draft.current_subcounty} placeholder="e.g. Kasarani" onChange={e=>setDraft({...draft,current_subcounty:e.target.value})}/></label>
       <label>Preferred county<SearchableSelect label="Preferred county" value={draft.preferred_county} options={COUNTIES} placeholder="Search county" onChange={v=>setDraft({...draft,preferred_county:v})}/></label>
       <label>Preferred sub-county (optional)<input maxLength={100} value={draft.preferred_subcounty} onChange={e=>setDraft({...draft,preferred_subcounty:e.target.value})}/></label>
       <label>School level<select value={draft.school_level} onChange={e=>setDraft({...draft,school_level:e.target.value as Level})}>{["Primary","Junior School","Senior School"].map(l=><option key={l}>{l}</option>)}</select></label>
       <label>Subject (optional)<input maxLength={100} value={draft.subject} onChange={e=>setDraft({...draft,subject:e.target.value})} placeholder="e.g. Mathematics"/></label>
      </div>
      <div className={styles.actions}><button className={styles.primary} disabled={busy} onClick={()=>void save()}>{busy?"Saving…":mine?"Save changes":"Publish swap"}</button><button className={styles.secondary} disabled={busy} onClick={()=>setEditing(false)}>Cancel</button></div>
     </div>}
    {userId&&interests.some(i=>i.sender_id===userId)&&<section className={styles.mine}><strong>My interest requests</strong><div className={styles.requests}>{interests.filter(i=>i.sender_id===userId).map(i=>{const l=listings.find(l=>l.id===i.listing_id);return <article key={i.id}><p>{l?`${l.current_county} → ${l.preferred_county}`:"Listing unavailable"} · {i.status}</p>{i.status==="pending"&&<button className={styles.secondary} disabled={busy} onClick={()=>void removeInterest(i.id)}>Withdraw</button>}</article>})}</div></section>}
    {!userId&&!loading&&<p className={styles.hint}>You can browse swaps without an account. <Link href="/login?redirect=%2Fteacher%2Fmarketplace">Sign in to post or express interest.</Link></p>}
    <div className={styles.findHeading}><h3>Find swaps</h3><button className={styles.filterButton} onClick={()=>setFilters(!filters)} aria-expanded={filters}><SlidersHorizontal size={17}/> Filters</button></div>
    {filters&&<div className={styles.filters}><label>County<SearchableSelect label="Filter county" value={filterCounty} options={COUNTIES} placeholder="Any county" onChange={setFilterCounty}/></label><label>School level<select value={filterLevel} onChange={e=>setFilterLevel(e.target.value)}><option value="">All levels</option>{["Primary","Junior School","Senior School"].map(l=><option key={l}>{l}</option>)}</select></label><button className={styles.secondary} onClick={()=>{setFilterCounty("");setFilterLevel("");}}>Clear</button></div>}
    {loading?<p role="status">Loading available swaps…</p>:visible.length===0?<p className={styles.empty}>No swap listings match yet. Post yours so teachers can find you.</p>:
     <div className={styles.cards}>{visible.map(l=>{const reverse=!!mine&&l.current_county===mine.preferred_county&&l.preferred_county===mine.current_county&&l.school_level===mine.school_level;return <article className={detailStyles.card} key={l.id}>
      <button type="button" className={detailStyles.cardButton} onClick={()=>viewDetails(l)} aria-label={"View swap: "+l.current_county+" to "+l.preferred_county}>
       <span className={detailStyles.badge}>{reverse?"Reverse match":"Teacher swap"}</span><h3>{l.current_county} → {l.preferred_county}</h3>
       <p>{l.current_subcounty} · {l.school_level}</p><p>Subjects: {l.subject||"Not provided"}</p>
       {outgoing.has(l.id)&&<small>Interest already sent</small>}<span className={detailStyles.view}>View details →</span>
      </button>
     </article>})}</div>}
    {detail&&<ListingDetailDialog key={detail.id} listing={swapListing(detail)} onClose={closeDetails} interest={detail.teacher_id===userId?undefined:{disabled:outgoing.has(detail.id),label:outgoing.has(detail.id)?"Interest already sent":"Express interest",onClick:()=>{const id=detail.id;closeDetails();setSelected(id);}}}/>}
    {selected&&<div className={styles.overlay} role="presentation"><div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="interest-title">
      <h3 id="interest-title">Express interest</h3><p>Your number will be visible only to the listing owner. They can contact you if interested.</p>
      <label>Contact number<input ref={interestInput} type="tel" inputMode="tel" value={phone} maxLength={16} placeholder="07… or +254…" onChange={e=>setPhone(e.target.value)}/></label>
      <label>Short message (optional)<textarea maxLength={500} rows={3} value={message} onChange={e=>setMessage(e.target.value)} placeholder="I am interested in your swap…"/></label>
      <div className={styles.actions}><button className={styles.primary} disabled={busy} onClick={()=>void sendInterest()}>Send interest</button><button className={styles.secondary} onClick={()=>setSelected(null)}>Cancel</button></div>
      {error&&<p role="alert" className={styles.error}>{error}</p>}
     </div></div>}
   </section>}
 </div>;
}
