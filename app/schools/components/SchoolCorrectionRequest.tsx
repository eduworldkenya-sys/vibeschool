'use client'
import {useState,type FormEvent} from 'react'
import Link from 'next/link'
import {supabase} from '@/lib/supabase'
import styles from '../schools.module.css'

export default function SchoolCorrectionRequest({slug}:{slug:string}){
 const [open,setOpen]=useState(false),[notes,setNotes]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[signIn,setSignIn]=useState(false)
 async function submit(e:FormEvent){
  e.preventDefault();if(busy||notes.trim().length<10)return
  setBusy(true);setMessage('');setSignIn(false)
  try{
   const {data:{user}}=await supabase.auth.getUser()
   if(!user){setSignIn(true);return}
   const {error}=await supabase.rpc('submit_directory_school_correction_v1',{p_slug:slug,p_notes:notes.trim()})
   if(error){setMessage('Correction could not be submitted. Try again.');return}
   setMessage('Correction received for review. School information will not change automatically.');setNotes('')
  }catch{setMessage('Correction could not be submitted. Try again.')}finally{setBusy(false)}
 }
 return <div><button type="button" className={styles.canonicalCorrection} aria-expanded={open} onClick={()=>setOpen(v=>!v)}>Suggest a correction</button>
 {open&&<form className={styles.schoolCorrectionForm} onSubmit={submit}><label htmlFor="school-correction">What information is incorrect?</label><textarea id="school-correction" required minLength={10} maxLength={1000} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Describe the incorrect detail and the correct information."/><button className={styles.secondary} type="submit" disabled={busy||notes.trim().length<10}>{busy?'Submitting…':'Submit correction'}</button>{signIn&&<p><Link href={'/login?redirect='+encodeURIComponent('/school/'+slug)}>Sign in</Link> to submit for review.</p>}{message&&<p role="status">{message}</p>}</form>}</div>
}
