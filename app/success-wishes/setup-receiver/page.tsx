'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import styles from '../Receiver.module.css'

type School = { id:string; name:string }
type Student = { id:string; name:string; admissionNumber:string|null }
type Guardian = { id:string; relationship:string }
const provision = '/api/success-wishes/receiver/provision'

export default function ReceiverSchoolSetup() {
  const [schools,setSchools]=useState<School[]>([])
  const [schoolId,setSchoolId]=useState('')
  const [query,setQuery]=useState('')
  const [students,setStudents]=useState<Student[]>([])
  const [student,setStudent]=useState<Student|null>(null)
  const [guardians,setGuardians]=useState<Guardian[]>([])
  const [guardianId,setGuardianId]=useState('')
  const [recordRef,setRecordRef]=useState('')
  const [attested,setAttested]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [message,setMessage]=useState('')
  useEffect(()=>{
    let mounted=true
    void fetch('/api/success-wishes/my-schools',{cache:'no-store'}).then(async r=>{
      const data=await r.json();if(!r.ok)throw Error(data.error||'School setup is unavailable.');return data
    }).then(data=>{if(mounted)setSchools(data.schools||[])})
      .catch(e=>{if(mounted)setError(e instanceof Error?e.message:'Could not load authorised schools.')})
    return ()=>{mounted=false}
  },[])
  async function request(url:string,options?:RequestInit){
    const r=await fetch(url,{cache:'no-store',...options})
    const data=await r.json()
    if(!r.ok)throw Error(data.error||'The registration request could not be completed.')
    return data
  }
  async function search(){
    setBusy(true);setError('');setMessage('');setStudent(null);setStudents([]);setGuardians([])
    try {
      if(!schoolId||query.trim().length<2)throw Error('Choose a school and enter at least two letters.')
      const data=await request('/api/success-wishes/candidates?schoolId='+encodeURIComponent(schoolId)+'&q='+encodeURIComponent(query.trim()))
      setStudents(data.candidates||[])
    }catch(e){setError(e instanceof Error?e.message:'Search failed.')}
    finally{setBusy(false)}
  }
  async function choose(candidate:Student){
    setBusy(true);setError('');setMessage('');setGuardianId('');setRecordRef('');setAttested(false)
    setStudent(candidate);setGuardians([])
    try{
      const data=await request(provision+'?schoolId='+encodeURIComponent(schoolId)+'&studentId='+encodeURIComponent(candidate.id))
      setGuardians(data.guardians||[])
      if(!data.guardians?.length)setMessage('No primary guardian with school consent authority is linked. Correct the official school record before proceeding.')
    }catch(e){setError(e instanceof Error?e.message:'The student could not be verified.')}
    finally{setBusy(false)}
  }
  async function register(){
    setBusy(true);setError('');setMessage('')
    try{
      if(!student||!guardianId||!attested||recordRef.trim().length<6)
        throw Error('Choose a guardian, verify the school record, and enter its reference.')
      const data=await request(provision,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({schoolId,studentId:student.id,guardianLinkId:guardianId,
          schoolRecordReference:recordRef.trim(),schoolRecordChecked:attested})})
      setMessage(data.message||'Recipient registered pending guardian consent.')
      setRecordRef('');setAttested(false);setGuardianId('');setStudent(null);setGuardians([])
    }catch(e){setError(e instanceof Error?e.message:'Registration was not completed.')}
    finally{setBusy(false)}
  }
  return <div className={styles.page}>
    <header className={styles.top}><Link className={styles.brand} href="/success-wishes">VIBESCHOOL / SUCCESS WISHES</Link>
      <span className={styles.muted}>Authorised school registration</span></header>
    <main className={styles.wrap}>
      <div className={styles.hero}><p className={styles.eyebrow}>SCHOOL-ASSISTED PILOT</p>
        <h1>Register a verified student recipient.</h1>
        <p>For school administrators only. A guardian must be linked in the school system and have a separately verified phone. The recipient will not need a VibeSchool login. No wish can be opened until guardian consent is verified.</p></div>
      {error&&<p role="alert" className={styles.error}>{error}</p>}
      {message&&<div role="status" className={styles.notice}>{message}</div>}
      <section className={styles.panel}><h2>1. Find the student</h2>
        <div className={styles.form}>
          <label>School
            <select value={schoolId} onChange={e=>{setSchoolId(e.target.value);setStudent(null);setStudents([]);setGuardians([]);setMessage('')}}>
              <option value="">Choose your school</option>{schools.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}
            </select></label>
          <label>Student name
            <input value={query} onChange={e=>setQuery(e.target.value)} maxLength={80}
              placeholder="Search official school roll" /></label>
          <button className={styles.primary} type="button" disabled={busy||!schoolId||query.trim().length<2}
            onClick={()=>void search()}>Search students</button>
          {students.map(s=><button type="button" className={styles.secondary} key={s.id}
            onClick={()=>void choose(s)} disabled={busy}>{s.name}{s.admissionNumber?' · '+s.admissionNumber:''}</button>)}
        </div>
      </section>
      {student&&<section className={styles.panel}><h2>2. Check the guardian</h2>
        <p>Student: <strong>{student.name}</strong>. Only primary guardians linked to this school are eligible. Never enter a phone number on behalf of the guardian.</p>
        <div className={styles.form}>
          <label>School-linked guardian
            <select value={guardianId} onChange={e=>setGuardianId(e.target.value)}>
              <option value="">Choose the verified school link</option>
              {guardians.map((g,i)=><option key={g.id} value={g.id}>{g.relationship} · #{i+1}</option>)}
            </select></label>
          <label>School record reference
            <input value={recordRef} maxLength={120} onChange={e=>setRecordRef(e.target.value)}
              placeholder="Reference of the record you checked" /></label>
          <label><input type="checkbox" checked={attested} onChange={e=>setAttested(e.target.checked)} />
            I verified the student's identity and the listed guardian's authority against the school's official records.</label>
          <button type="button" className={styles.primary} disabled={busy||!guardianId||!attested||recordRef.trim().length<6}
            onClick={()=>void register()}>{busy?'Verifying…':'Register recipient'}</button>
        </div>
      </section>}
      <div className={styles.links}><Link href="/success-wishes">Back to Success Wishes</Link></div>
    </main>
  </div>
}
