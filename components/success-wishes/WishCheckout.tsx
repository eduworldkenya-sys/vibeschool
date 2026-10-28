'use client'
import {useCallback,useEffect,useId,useRef,useState} from 'react'
import {X} from 'lucide-react'
import {CardArt,type CardValues,type Template} from './SuccessCardStudio'
import {CHECKOUT_STORAGE_KEY,newCheckoutKey,checkoutMessage,pendingCheckout,type CheckoutOrder} from '@/lib/success-wishes/checkout-client'
import {normalizeSafaricomPhone} from '@/lib/success-wishes/payment-contract'
import styles from './SuccessCardStudio.module.css'
export default function WishCheckout({theme,values,onClose}:{theme:Template;values:CardValues;onClose:()=>void}){
 const id=useId(),dialog=useRef<HTMLElement>(null),inFlight=useRef(false),alive=useRef(true)
 const [key,setKey]=useState(''),[phone,setPhone]=useState('')
 const [order,setOrder]=useState<CheckoutOrder|null>(null),[review,setReview]=useState(false),[restoring,setRestoring]=useState(true)
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[autoCheck,setAutoCheck]=useState(true)
 const [availability,setAvailability]=useState<'checking'|'open'|'closed'>('checking'),[recoveryBlocked,setRecoveryBlocked]=useState(false)
 const persist=useCallback((secret:string)=>sessionStorage.setItem(CHECKOUT_STORAGE_KEY,JSON.stringify({key:secret,expires:Date.now()+90*86400000})),[])
 const call=useCallback(async(body:Record<string,unknown>)=>{
  const r=await fetch('/api/success-wishes/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(45000)})
  const p=await r.json();if(!r.ok){const problem=new Error(p.error||'Checkout is unavailable. Keep your recovery key before trying again.') as Error & {status:number};problem.status=r.status;throw problem}
  return p.order as CheckoutOrder
 },[])
 useEffect(()=>{
  let active=true
  void fetch('/api/success-wishes/config',{cache:'no-store',signal:AbortSignal.timeout(15000)})
   .then(async response=>{if(!response.ok)throw Error('Unavailable');return response.json()})
   .then(config=>{if(active)setAvailability(config.paymentsEnabled===true?'open':'closed')})
   .catch(()=>{if(active)setAvailability('closed')})
  return()=>{active=false}
 },[])
 useEffect(()=>{
  alive.current=true;const previous=document.activeElement as HTMLElement|null;dialog.current?.focus()
  const restore=async()=>{try{
   const raw=sessionStorage.getItem(CHECKOUT_STORAGE_KEY),saved=raw?JSON.parse(raw):null
   if(saved&&/^[a-f0-9]{64}$/.test(saved.key)&&saved.expires>Date.now()){
    setKey(saved.key)
    try{const found=await call({action:'status',key:saved.key});if(alive.current)setOrder(found)}
    catch(e){
     if((e as Error & {status?:number}).status===404){sessionStorage.removeItem(CHECKOUT_STORAGE_KEY);if(alive.current)setKey(newCheckoutKey())}
     else throw e
    }
   }else setKey(newCheckoutKey())
  }catch{if(alive.current){setRecoveryBlocked(true);setError('We could not check your previous order. Do not pay again until its status is known.')}}
  finally{if(alive.current)setRestoring(false)}}
  void restore();return()=>{alive.current=false;previous?.focus()}
 },[call])
 const orderId=order?.id,orderState=order?.state
 useEffect(()=>{
  if(!orderId||!orderState||!pendingCheckout(orderState)||!autoCheck)return
  const deadline=Date.now()+180000
  const timer=window.setInterval(async()=>{
   if(Date.now()>deadline){setAutoCheck(false);return}
   if(inFlight.current||document.visibilityState!=='visible')return
   inFlight.current=true
   try{const o=await call({action:'status',key});if(alive.current)setOrder(o)}
   catch{if(alive.current)setNotice('Connection interrupted. Your order is saved; check status when you are online.')}
   finally{inFlight.current=false}
  },6000)
  return()=>window.clearInterval(timer)
 },[orderId,orderState,key,autoCheck,call])
 async function act(action:'create'|'pay'|'status'){
  if(inFlight.current)return
  inFlight.current=true;setBusy(true);setError('');setNotice('')
  try{
   if(action==='create')normalizeSafaricomPhone(phone)
   persist(key) // Recovery must be saved before any order/payment request.
   const o=await call(action==='create'?{action,key,version:'text',theme,...values,payerPhone:phone}:{action,key})
   if(alive.current){setOrder(o);setRecoveryBlocked(false);setAutoCheck(true)}
  }catch(e){if(alive.current)setError(e instanceof Error?e.message:'This request could not be checked. Do not pay again.')}
  finally{inFlight.current=false;if(alive.current)setBusy(false)}
 }
 function reset(){try{sessionStorage.removeItem(CHECKOUT_STORAGE_KEY);setOrder(null);setKey(newCheckoutKey());setReview(false)}catch{setError('Browser storage is unavailable. Keep your order recovery key.')}}
 async function copy(value:string,kind:'link'|'key'='link'){try{await navigator.clipboard.writeText(value);setNotice(kind==='key'?'Recovery key copied. Keep it private; do not send it to the recipient.':'Private card link copied. Share only with the intended recipient.')}catch{setNotice('Select and copy the value from the field below.')}}
 function trap(e:React.KeyboardEvent){
  if(e.key==='Escape'){onClose();return}if(e.key!=='Tab')return
  const items=dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),a[href],summary');if(!items?.length)return
  const first=items[0],last=items[items.length-1]
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
 }
 return <div className={styles.modalBackdrop} onKeyDown={trap}><section ref={dialog} tabIndex={-1} className={styles.checkoutModal} role="dialog" aria-modal="true" aria-labelledby={id}>
  <button type="button" className={styles.modalClose} aria-label="Close checkout" onClick={onClose}><X size={20}/></button>
  <p className={styles.eyebrow}>M-PESA CHECKOUT</p><h2 id={id}>{order?.state==='settled'?'Your wish is ready':order?'Your saved order':review?'Review your wish':'Your order'}</h2>
  <div className={styles.checkoutOrder}><CardArt template={order?.card.theme||theme} values={order?.card||values} preview/><div><strong>Text Wish · {order?.card.candidate||values.candidate}</strong>{(order?.card.school??values.school)&&<span>{order?.card.school??values.school}</span>}<span>{order?.card.examYear||values.examYear} exams</span></div></div>
  <details className={styles.checkoutPreview}><summary>See the full wish</summary><CardArt template={order?.card.theme||theme} values={order?.card||values} preview/></details>
  {restoring?<p role="status">Checking for an existing order…</p>:recoveryBlocked?<div role="status" className={styles.checkoutRecovery}><p>Your earlier order needs to be checked before another payment can start.</p><button type="button" className={styles.secondary} disabled={busy||!key} onClick={()=>void act('status')}>Check saved order</button></div>:!order?(availability==='checking'?<p role="status">Checking M-Pesa availability…</p>:availability==='closed'?<p role="status" className={styles.checkoutNotice}>M-Pesa payments are not available right now. No payment has been requested. You can return when checkout opens.</p>:<form noValidate onSubmit={e=>{e.preventDefault();if(review){void act('create');return}try{normalizeSafaricomPhone(phone);setReview(true);setError('')}catch(e){setError(e instanceof Error?e.message:'Check your details.')}}}>
   {!review?<><fieldset className={styles.numberPicker}><legend>Choose a number prefix</legend>{['07','01','+254'].map(prefix=><button key={prefix} type="button" aria-pressed={phone.startsWith(prefix)} disabled={busy} onClick={()=>setPhone(prefix)}>{prefix}</button>)}</fieldset>
    <label className={styles.checkoutLabel}>M-Pesa number<input type="tel" inputMode="tel" autoComplete="tel" value={phone} maxLength={20} disabled={busy} onChange={e=>setPhone(e.target.value)} placeholder="07XX XXX XXX"/></label></>:<p className={styles.checkoutFine}>M-Pesa number: <strong>{phone}</strong></p>}
   <div className={styles.orderTotal}>Total <strong>KSh 50</strong></div>
   <div className={styles.checkoutActions}>{review&&<button type="button" className={styles.secondary} disabled={busy} onClick={()=>setReview(false)}>Edit number</button>}<button type="submit" className={styles.primary} disabled={busy||!key}>{busy?'Saving…':review?'Save order & continue':'Review order'}</button></div>
  </form>):<div aria-live="polite"><p role="status" className={styles.checkoutNotice}>{checkoutMessage(order.state)}</p><p>KSh {order.amountKes} · {order.payerPhone}</p><p>Order {order.id}</p>{order.receipt&&<p>M-Pesa receipt: {order.receipt}</p>}
   {order.state==='created'&&(availability==='open'?<button type="button" className={styles.primary} disabled={busy} onClick={()=>void act('pay')}>{busy?'Requesting payment…':'Pay KSh 50 with M-Pesa'}</button>:<p role="status" className={styles.checkoutNotice}>New M-Pesa payments are paused. Your order is saved; no new prompt will be sent.</p>)}
   {pendingCheckout(order.state)&&<button type="button" className={styles.secondary} disabled={busy} onClick={()=>void act('status')}>{busy?'Checking…':'Check payment status'}</button>}
   {order.invitationUrl&&<><label className={styles.checkoutLabel}>Private card link<input readOnly value={order.invitationUrl} onFocus={e=>e.target.select()}/></label><div className={styles.checkoutActions}><button type="button" className={styles.primary} onClick={()=>void copy(order.invitationUrl!)}>Copy private link</button><a className={styles.secondary} href={order.invitationUrl}>Open card</a></div>{order.backupCode&&<label className={styles.checkoutLabel}>Backup card code<input readOnly value={order.backupCode} onFocus={e=>e.target.select()}/></label>}<p>Share this private gift link with {order.card.candidate}. Anyone with the link can open it; keep it private. The gift is kept for 90 days.</p></>}
   <details><summary>Save your order recovery key</summary><p>Keep this key private. It restores this order on another device.</p><input aria-label="Private order recovery key" readOnly value={key} onFocus={e=>e.target.select()}/><button type="button" className={styles.secondary} onClick={()=>void copy(key,'key')}>Copy recovery key</button></details>
   {['created','failed','settled','refunded'].includes(order.state)&&<button type="button" className={styles.secondary} onClick={reset}>{order.state==='settled'?'Create another wish':'Start a new checkout'}</button>}
  </div>}
  {error&&<p role="alert" className={styles.checkoutError}>{error}</p>}{notice&&<p role="status">{notice}</p>}
 </section></div>
}
