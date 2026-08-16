"use client";
import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { continuationForRole, normalizeContinuation } from '@/lib/auth/continuation'
import styles from './signup.module.css'

const COUNTRIES=[{code:'KE',name:'Kenya'},{code:'UG',name:'Uganda'},{code:'TZ',name:'Tanzania'},{code:'RW',name:'Rwanda'},{code:'US',name:'United States'},{code:'GB',name:'United Kingdom'},{code:'DE',name:'Germany'},{code:'JP',name:'Japan'}]
const MIN_DOB=new Date();MIN_DOB.setFullYear(MIN_DOB.getFullYear()-120)
const MAX_DOB=new Date();MAX_DOB.setFullYear(MAX_DOB.getFullYear()-5)
function under18(date:Date){const today=new Date();let age=today.getFullYear()-date.getFullYear();const m=today.getMonth()-date.getMonth();if(m<0||(m===0&&today.getDate()<date.getDate()))age--;return age<18}

function GlobalSignUpContent(){
  const router=useRouter(),searchParams=useSearchParams(),contentRef=useRef<HTMLDivElement>(null),navTimer=useRef<ReturnType<typeof setTimeout>|null>(null)
  const requestedNext=normalizeContinuation(searchParams.get('next')),pathwaysArrival=Boolean(requestedNext?.startsWith('/pathways'))
  const [fullName,setFullName]=useState(''),[dob,setDob]=useState(''),[country,setCountry]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState('')
  const [showPw,setShowPw]=useState(false),[error,setError]=useState(''),[loading,setLoading]=useState(false)
  useEffect(()=>()=>{if(navTimer.current)clearTimeout(navTimer.current)},[])
  function fadeOut(destination:string){if(!contentRef.current){router.push(destination);return}contentRef.current.style.transition='opacity 280ms ease-in';contentRef.current.style.opacity='0';navTimer.current=setTimeout(()=>router.push(destination),280)}
  async function handleSubmit(){
    setError('');if(!fullName.trim()){setError('Full name is required.');return}if(!dob){setError('Date of birth is required.');return}
    const dobDate=new Date(dob);if(isNaN(dobDate.getTime())||dobDate<MIN_DOB||dobDate>MAX_DOB){setError('Please enter a valid date of birth.');return}
    if(pathwaysArrival&&under18(dobDate)){setError('For a learner under 18 arriving through Pathways, use the parent/guardian or school-linked learner route so safeguarding is preserved.');return}
    if(!country){setError('Country is required.');return}if(!email.trim()){setError('Email is required.');return}if(password.length<8){setError('Password must be at least 8 characters.');return}
    setLoading(true);const {data:authData,error:authError}=await supabase.auth.signUp({email:email.trim(),password})
    if(authError||!authData.user){setLoading(false);setError(authError?.message||'Sign up failed. Please try again.');return}
    if(!authData.session){setLoading(false);setError('An account with this email already exists. Please sign in instead.');return}
    const {error:profileError}=await supabase.from('profiles').insert({id:authData.user.id,full_name:fullName.trim(),date_of_birth:dob,country_code:country,role:'global_user'})
    if(profileError){await supabase.auth.signOut();document.cookie='vibe_role=; path=/; max-age=0';setLoading(false);setError('Account setup failed. Please try again.');return}
    localStorage.setItem('vs_role','global_user');document.cookie=`vibe_role=global_user; path=/; max-age=${authData.session.expires_in??3600}; samesite=lax${location.protocol==='https:'?'; secure':''}`
    setLoading(false);fadeOut(continuationForRole(requestedNext,'global_user')||'/global')
  }
  const signin=continuationForRole(requestedNext,'global_user')?`/login/global?next=${encodeURIComponent(requestedNext!)}`:'/login/global'
  return <><div id="global-signup-root" className={styles.root}><div id="scan-line" aria-hidden/><div className={styles.content} ref={contentRef}>
    <button className={styles.back} onClick={()=>fadeOut(pathwaysArrival?'/pathways/continue':'/')} aria-label="Back">←</button><p className={styles.world}>GLOBAL</p><p className={styles.heading}>CREATE ACCOUNT</p><p className={styles.sub}>{pathwaysArrival?'Independent adult learner account. Under-18 learners should use the guardian or school-linked route.':'For international networks and independent learners.'}</p>
    <div className={styles.form}><div className={styles.field}><label className={styles.label} htmlFor="fullName">FULL NAME</label><input id="fullName" className={styles.input} autoComplete="name" value={fullName} onChange={e=>setFullName(e.target.value)} disabled={loading}/></div><div className={styles.field}><label className={styles.label} htmlFor="dob">DATE OF BIRTH</label><input id="dob" className={styles.input} type="date" min={MIN_DOB.toISOString().split('T')[0]} max={MAX_DOB.toISOString().split('T')[0]} value={dob} onChange={e=>setDob(e.target.value)} disabled={loading}/></div><div className={styles.field}><label className={styles.label} htmlFor="country">COUNTRY</label><select id="country" className={styles.input} value={country} onChange={e=>setCountry(e.target.value)} disabled={loading}><option value="" disabled>Select country</option>{COUNTRIES.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}</select></div><div className={styles.field}><label className={styles.label} htmlFor="email">EMAIL</label><input id="email" className={styles.input} type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} disabled={loading}/></div><div className={styles.field}><label className={styles.label} htmlFor="password">PASSWORD</label><div style={{position:'relative'}}><input id="password" className={styles.input} type={showPw?'text':'password'} autoComplete="new-password" style={{paddingRight:42}} value={password} onChange={e=>setPassword(e.target.value)} disabled={loading} onKeyDown={e=>{if(e.key==='Enter')void handleSubmit()}}/><button type="button" onClick={()=>setShowPw(v=>!v)} aria-label={showPw?'Hide password':'Show password'} style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer'}}>{showPw?'Hide':'Show'}</button></div></div>{error&&<p className={styles.error} role="alert">{error}</p>}<button className={styles.submit} onClick={()=>void handleSubmit()} disabled={loading}>{loading?'CREATING ACCOUNT…':'CREATE ACCOUNT'}</button></div>
    <p className={styles.switch}>Already have an account? <a className={styles.switchLink} href={signin}>Sign in</a></p>{pathwaysArrival&&<p className={styles.switch}><a className={styles.switchLink} href="/signup/parent?next=%2Fpathways%2Fcontinue">Parent or guardian route</a> · <a className={styles.switchLink} href="/signup/student?next=%2Fpathways%2Fcontinue">School learner route</a></p>}
  </div></div></>
}

export default function GlobalSignUp(){return <Suspense fallback={<div id="global-signup-root" className={styles.root}/> }><GlobalSignUpContent/></Suspense>}
