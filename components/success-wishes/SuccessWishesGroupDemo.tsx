'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {newCheckoutKey,pendingCheckout,type CheckoutState,type CheckoutCard} from '@/lib/success-wishes/checkout-client'
import GiftShareActions from './GiftShareActions'
import { CardArt, type Template } from './SuccessCardStudio'
import styles from './SuccessWishesGroupDemo.module.css'

type Student = { id: number; name: string; message: string; design: string; phone:string }
const designs = ['Heritage', 'Botanical', 'Nightfall', 'Sunrise']
const makeStudent = (id: number): Student => ({ id, name: '', message: '', design: 'Heritage',phone:'' })

class GroupRequestError extends Error{constructor(readonly status:number,message:string){super(message)}}
type GroupOrder={id:string;state:CheckoutState;amountKes:100;payerPhone:string;cards:CheckoutCard[];links:Array<{card:CheckoutCard;invitationUrl:string}>;receipt:string|null}
const STORAGE='vs-group-wishes-orders-v1'
export default function SuccessWishesGroupDemo({ onClose }: { onClose: () => void }) {
  const [students, setStudents] = useState<Student[]>([makeStudent(1), makeStudent(2)])
  const [sender, setSender] = useState('')
  const [startingDesign, setStartingDesign] = useState('Heritage')
  const [step, setStep] = useState<'design' | 'names' | 'cards' | 'review'>('design')
  const [active, setActive] = useState(0)
  const [copyForAll, setCopyForAll] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const nextId = useRef(3)
  const [groupEnabled,setGroupEnabled]=useState(false)
  useEffect(()=>{fetch('/api/success-wishes/config',{cache:'no-store'}).then(r=>r.json()).then(p=>setGroupEnabled(p.groupPaymentsEnabled===true)).catch(()=>setGroupEnabled(false))},[])
  const [phone,setPhone]=useState(''),[order,setOrder]=useState<GroupOrder|null>(null)
  const [key,setKey]=useState(''),[history,setHistory]=useState<string[]>([]),[restoreKey,setRestoreKey]=useState('')
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[uncertain,setUncertain]=useState(false),[restoring,setRestoring]=useState(true)
  const inFlight=useRef(false),mounted=useRef(true)
  const save=useCallback((secret:string)=>{const keys: string[]=JSON.parse(localStorage.getItem(STORAGE)||'[]');const all=[secret,...keys.filter(k=>k!==secret)].slice(0,30);localStorage.setItem(STORAGE,JSON.stringify(all));setHistory(all)},[])
  const call=useCallback(async(body:Record<string,unknown>)=>{
    const r=await fetch('/api/success-wishes/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(45000)})
    const data=await r.json();if(!r.ok)throw new GroupRequestError(r.status,data.error||'Checkout unavailable.')
    if(data.order?.amountKes!==100)throw Error('This recovery key belongs to a single-card order.')
    return data as {order:GroupOrder;paymentError?:string}
  },[])
  const check=useCallback(async(secret:string)=>{
    if(inFlight.current)return
    inFlight.current=true;setBusy(true);setError('')
    try{const p=await call({action:'status',key:secret});if(mounted.current){setKey(secret);setOrder(p.order);setStep('review');setUncertain(false);save(secret)}}
    catch(e){if(mounted.current){if(e instanceof GroupRequestError&&e.status===404){setOrder(null);setKey(newCheckoutKey());setUncertain(false);setStep('design')}else setUncertain(true);setError(e instanceof Error?e.message:'Reconnect to restore your order.')}}
    finally{inFlight.current=false;if(mounted.current){setBusy(false);setRestoring(false)}}
  },[call,save])
  useEffect(()=>{
    mounted.current=true
    try{const keys=JSON.parse(localStorage.getItem(STORAGE)||'[]') as string[];setHistory(keys);if(keys[0]){setKey(keys[0]);setUncertain(true);void check(keys[0])}else{setKey(newCheckoutKey());setRestoring(false)}}catch{setError('Allow browser storage to keep your recovery key.');setRestoring(false)}
    return()=>{mounted.current=false}
  },[check])
  useEffect(()=>{
    if(!key||(!uncertain&&(!order||!pendingCheckout(order.state))))return
    const end=Date.now()+180000
    const timer=window.setInterval(()=>{if(Date.now()<end&&document.visibilityState==='visible')void check(key)},6000)
    return()=>window.clearInterval(timer)
  },[key,order,uncertain,check])
  async function pay(){
    if(!groupEnabled||inFlight.current||uncertain||order&&order.state!=='created')return
    inFlight.current=true;setBusy(true);setError('')
    let started=false
    try{
      save(key)
      let current=order
      if(!current){const p=await call({action:'create',group:true,key,sender,payerPhone:phone,students:students.map(s=>({candidate:s.name,message:s.message,theme:s.design.toLowerCase(),examYear:'2026',school:'',deliveryPhone:s.phone}))});current=p.order;if(mounted.current)setOrder(current)}
      if(current.state==='created'){started=true;setUncertain(true);const p=await call({action:'pay',key});if(mounted.current){setOrder(p.order);setUncertain(p.order.state==='created'&&!p.paymentError);setError(p.paymentError||'')}}
    }catch(e){if(mounted.current){setUncertain(started);setError(e instanceof Error?e.message:'Check status before paying again.')}}
    finally{inFlight.current=false;if(mounted.current)setBusy(false)}
  }
  function startNew(){if(order){setStudents(order.cards.map((c,i)=>({id:i+1,name:c.candidate,message:c.message,design:c.theme[0].toUpperCase()+c.theme.slice(1),phone:c.deliveryPhone||''})));nextId.current=order.cards.length+1;setSender(order.cards[0].sender);setPhone(order.payerPhone)}setOrder(null);setKey(newCheckoutKey());setUncertain(false);setError('');setStep('design')}


  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
      if(event.key!=='Tab')return
      const items=Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea,select,a[href],summary')||[]).filter(el=>el.getClientRects().length)
      const first=items[0],last=items[items.length-1]
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
    }
    document.addEventListener('keydown', keydown)
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', keydown) }
  }, [onClose])

  function update(index: number, fields: Partial<Student>) {
    setStudents(items => items.map((s, i) => i === index ? { ...s, ...fields } : s))
  }
  function add() {
    if (students.length < 4) setStudents(items => [...items, makeStudent(nextId.current++)])
  }
  function remove(index: number) {
    if (students.length > 2) { setStudents(items => items.filter((_, i) => i !== index)); setActive(0) }
  }
  const current = students[active]
  const namesReady = students.every(s => s.name.trim())
  const cardsReady = students.every(s => s.message.trim()&&s.phone.trim()) && sender.trim().length > 0

  return (
    <div className={styles.backdrop} onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="group-demo-title" tabIndex={-1} ref={dialogRef}>
        <header className={styles.header}>
          <div><span className={styles.eyebrow}>GROUP WISHES</span><h2 id="group-demo-title">Four smiles. One price.</h2><p>Up to 4 cards · KSh 100 · <strong>2 FREE Success Cards</strong></p></div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close group wishes">×</button>
        </header>
        <nav className={styles.steps} aria-label="Order progress">
          <span className={step === 'design' ? styles.selected : ''}>1. Design</span>
          <span className={step === 'names' ? styles.selected : ''}>2. Students</span>
          <span className={step === 'cards' ? styles.selected : ''}>3. Cards</span>
          <span className={step === 'review' ? styles.selected : ''}>4. Review</span>
        </nav>
        <div className={styles.body}>
          {step === 'design' && !restoring && <section>
            <h3>Choose a success card design</h3>
            <div role="group" aria-label="Choose first design" style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10,margin:'14px 0'}}>
              {designs.map(design => <button key={design} type="button" aria-pressed={startingDesign === design} aria-label={`Choose ${design} card design`} onClick={() => setStartingDesign(design)} className={styles.designChoice + (startingDesign === design ? ' ' + styles.designSelected : '')}><span className={styles.designArtwork}><CardArt template={design.toLowerCase() as Template} values={{candidate:'Your candidate',sender:sender || 'Your name',message:'',examYear:'2026'}} preview /></span><strong>{design}</strong></button>)}
            </div>
            <p className={styles.hint}>You can use this design for everyone or change each card later.</p>
            <button className={styles.primary} type="button" onClick={() => { setStudents(items => items.map(item => item.design === 'Heritage' ? {...item,design:startingDesign} : item));setStep('names') }}>Continue to students →</button>
          </section>}
          {step === 'names' && !restoring && <section>
            <div className={styles.row}><h3>Add students</h3><small>{students.length} of 4</small></div>
            {students.map((student, i) => <div key={student.id} className={styles.nameRow}>
              <label><span>Student {i + 1}</span><input maxLength={48} value={student.name} placeholder="Student name" onChange={e => update(i, { name: e.target.value })}/></label>
              {i > 1 && <button type="button" className={styles.remove} onClick={() => remove(i)} aria-label={'Remove student ' + (i + 1)}>×</button>}
            </div>)}
            {students.length < 4 && <button className={styles.secondary} type="button" onClick={add}>+ Add {students.length === 2 ? "third" : "fourth"} student</button>}
            <p className={styles.hint}>Each student gets a personal card and private link.</p>
          </section>}
          {step === 'cards' && <section>
            <div className={styles.row}><h3>Personalise</h3><small>{active + 1} of {students.length}</small></div>
            <div className={styles.tabs} role="group" aria-label="Choose student">
              {students.map((s,i) => <button key={s.id} type="button" className={i === active ? styles.activeTab : ''} onClick={() => setActive(i)}>{s.name}{s.message.trim() ? ' ✓' : ''}</button>)}
            </div>
            <label className={styles.field}><span>Your name</span><input maxLength={48} placeholder="Sender name" value={sender} onChange={e => setSender(e.target.value)}/></label>
            <label className={styles.field}><span>Recipient phone for {current.name}</span><input type="tel" maxLength={20} value={current.phone} onChange={e=>update(active,{phone:e.target.value})} placeholder="07XX XXX XXX"/></label>
            <label className={styles.field}><span>Card design</span><select value={current.design} onChange={e => update(active,{design:e.target.value})}>{designs.map(d=><option key={d} value={d}>{d}</option>)}</select></label>
            <label className={styles.field}><span>Message for {current.name}</span><textarea rows={4} maxLength={220} value={current.message} placeholder="Write a personal wish…" onChange={e => update(active,{message:e.target.value})}/></label>
            <label className={styles.toggle}><input type="checkbox" checked={copyForAll} onChange={e => setCopyForAll(e.target.checked)}/>Use this message for all students</label>
            <div className={styles.miniCard} aria-label={'Preview card for '+ current.name}>
              <small>{current.design.toUpperCase()} · SUCCESS WISHES 2026</small>
              <strong>To {current.name}</strong>
              <p>{current.message || 'Your message appears here.'}</p>
              <span>From {sender || 'Your name'}</span>
            </div>
          </section>}
          {step === 'review' && <section>
            <h3>Review your wishes</h3>
            {!order&&<div className={styles.reviewList}>{students.map((s,i)=><div key={s.id} className={styles.reviewItem}><div><strong>{s.name}</strong><small>{s.design} · {s.message}</small></div><button type="button" onClick={()=>{setActive(i);setStep('cards')}}>Edit</button></div>)}</div>}
            {order&&<div className={styles.reviewList}>{order.cards.map((c,i)=><div key={i} className={styles.reviewItem}><strong>{c.candidate}</strong><small>{c.theme}</small></div>)}</div>}
            <div className={styles.total}><span>{order?.cards.length||students.length} personalised cards</span><strong>KSh 100</strong></div>
            <p className={styles.hint}>One payment. Separate private links for every student.</p>
            {!order&&<label className={styles.field}><span>M-Pesa number</span><input type="tel" maxLength={20} value={phone} disabled={busy} placeholder="07XX XXX XXX" onChange={e=>setPhone(e.target.value)}/></label>}
            {(uncertain||order&&pendingCheckout(order.state))&&<p role="status">Check your phone. We’re checking payment. Do not pay again.</p>}
            {order?.state==='settled'&&<><strong>Payment received · KSh 100</strong>{order.links.map(item=><div key={item.invitationUrl} className={styles.reviewItem}><strong>{item.card.candidate}</strong><GiftShareActions link={item.invitationUrl} candidate={item.card.candidate} sender={item.card.sender}/></div>)}</>}
            {order?.state==='failed'&&<p>Payment was not completed.</p>}
            {order?.state==='refunded'&&<p>Payment refunded. These links are unavailable.</p>}
            <details><summary>Recover purchased cards</summary><label className={styles.field}><span>Private recovery key</span><input readOnly value={key} onFocus={e=>e.target.select()}/></label><label className={styles.field}><span>Restore another order</span><input value={restoreKey} maxLength={64} onChange={e=>setRestoreKey(e.target.value)}/></label><button type="button" disabled={busy||!/^[a-f0-9]{64}$/.test(restoreKey)} onClick={()=>void check(restoreKey)}>Restore</button>{history.map((saved,i)=><button key={saved} type="button" disabled={busy} onClick={()=>void check(saved)}>Saved order {i+1}</button>)}</details>
          </section>}
          {restoring&&<p role="status">Restoring your order…</p>}
          {error&&<p role="alert">{error}</p>}
        </div>
        <footer className={styles.actions}>
          {step !== 'design' && !order&&!busy&&!uncertain && <button type="button" className={styles.secondary} onClick={() => setStep(step === 'review' ? 'cards' : step === 'cards' ? 'names' : 'design')}>Back</button>}
          {step === 'names' && <button type="button" className={styles.primary} disabled={!namesReady} onClick={() => setStep('cards')}>Personalise cards</button>}
          {step === 'cards' && <button type="button" className={styles.primary} onClick={() => {
            if (copyForAll && current.message.trim()) {setStudents(items=>items.map(s=>({...s,message:current.message})));setCopyForAll(false)}
            if (active < students.length - 1) setActive(n=>n+1)
            else if (cardsReady || (copyForAll && current.message.trim() && sender.trim() && students.every(s=>s.phone.trim()))) setStep('review')
          }}>{active === students.length - 1 ? 'Review wishes' : 'Next student'}</button>}
          {step === 'review' && !uncertain&&(!order||order.state==='created')&&<button type="button" className={styles.primary} disabled={!groupEnabled||busy||restoring||!key||!order&&!phone.trim()} onClick={()=>void pay()}>{!groupEnabled?'Payment not open yet':busy?'Requesting…':'Pay KSh 100'}</button>}
          {(uncertain||order&&pendingCheckout(order.state))&&<button type="button" className={styles.primary} disabled={busy} onClick={()=>void check(key)}>Check status</button>}
          {order&&['settled','failed','refunded'].includes(order.state)&&<button type="button" className={styles.secondary} disabled={busy} onClick={startNew}>New order</button>}
        </footer>
      </div>
    </div>
  )
}
