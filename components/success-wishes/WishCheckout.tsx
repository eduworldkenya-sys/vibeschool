'use client'
import {useCallback,useEffect,useId,useRef,useState} from 'react'
import {Check,X} from 'lucide-react'
import {CardArt,type CardValues,type Template} from './SuccessCardStudio'
import {CHECKOUT_STORAGE_KEY,newCheckoutKey,checkoutMessage,pendingCheckout,maskedPayerPhone,canPay,checkoutSuccess,type CheckoutOrder} from '@/lib/success-wishes/checkout-client'
import {normalizeSafaricomPhone} from '@/lib/success-wishes/payment-contract'
import styles from './SuccessCardStudio.module.css'
import {playWishFeedbackSound,prepareWishFeedbackSound} from '@/lib/success-wishes/signature-sound'
import GiftShareActions from './GiftShareActions'
type CheckoutReply={order:CheckoutOrder;paymentError?:string|null}
class CheckoutRequestError extends Error{constructor(readonly status:number,message:string){super(message)}}
export default function WishCheckout({theme,values,onClose,soundEnabled=false,inboxRequest=''}:{inboxRequest?:string;soundEnabled?:boolean;theme:Template;values:CardValues;onClose:()=>void}){
 const id=useId(),dialog=useRef<HTMLElement>(null),inFlight=useRef(false),alive=useRef(true)
 const [correctPhone,setCorrectPhone]=useState('')
 const [key,setKey]=useState(''),[phone,setPhone]=useState('')
 const [draft,setDraft]=useState({theme,...values})
 const [order,setOrder]=useState<CheckoutOrder|null>(null),[restoring,setRestoring]=useState(true)
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false)
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[autoCheck,setAutoCheck]=useState(true)
 const celebrated=useRef(new Set<string>()),stopFeedback=useRef<(()=>void)|null>(null)
 const success=checkoutSuccess(order)
 useEffect(()=>{
  if(!success||!order)return
  const event=order.id+':'+success
  if(celebrated.current.has(event))return
  celebrated.current.add(event)
  if(soundEnabled){stopFeedback.current?.();stopFeedback.current=playWishFeedbackSound(success)}
 },[success,order,soundEnabled])
 useEffect(()=>()=>stopFeedback.current?.(),[])
 const persist=useCallback((secret:string,paymentUncertain=false)=>sessionStorage.setItem(CHECKOUT_STORAGE_KEY,JSON.stringify({key:secret,paymentUncertain,expires:Date.now()+90*86400000})),[])
 const call=useCallback(async(body:Record<string,unknown>):Promise<CheckoutReply>=>{
  const r=await fetch('/api/success-wishes/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(45000)})
  const p=await r.json();if(!r.ok)throw new CheckoutRequestError(r.status,p.error||'Checkout is unavailable.')
  if(!p.order)throw Error('Checkout is unavailable.')
  return p as CheckoutReply
 },[])
 useEffect(()=>{
  alive.current=true;const previous=document.activeElement as HTMLElement|null;dialog.current?.focus()
  const restore=async()=>{try{
   const raw=sessionStorage.getItem(CHECKOUT_STORAGE_KEY),saved=raw?JSON.parse(raw):null
   if(saved&&/^[a-f0-9]{64}$/.test(saved.key)&&saved.expires>Date.now()){
    setKey(saved.key);setUncertain(true)
    try{
     const found=await call({action:'status',key:saved.key})
     if(alive.current){setOrder(found.order);setUncertain(saved.paymentUncertain===true&&found.order.state==='created')}
    }catch(error){
     if(error instanceof CheckoutRequestError&&error.status===404&&saved.paymentUncertain!==true){
      sessionStorage.removeItem(CHECKOUT_STORAGE_KEY);if(alive.current){setKey(newCheckoutKey());setUncertain(false)}
     }else throw error
    }
   }else setKey(newCheckoutKey())
  }catch{if(alive.current){setUncertain(true);setError('Your saved order couldn’t be checked.')}}
  finally{if(alive.current)setRestoring(false)}}
  void restore();return()=>{alive.current=false;previous?.focus()}
 },[call])
 const orderId=order?.id,orderState=order?.state
 useEffect(()=>{
  if(!key||(!uncertain&&(!orderState||!pendingCheckout(orderState)))||!autoCheck)return
  const deadline=Date.now()+180000
  const timer=window.setInterval(async()=>{
   if(Date.now()>deadline){setAutoCheck(false);return}
   if(inFlight.current||document.visibilityState!=='visible')return
   inFlight.current=true
   try{const p=await call({action:'status',key});if(alive.current){setOrder(p.order);const hold=uncertain&&p.order.state==='created';persist(key,hold);setUncertain(hold);if(!hold)setError('')}}
   catch{if(alive.current)setNotice('Connection interrupted. Check status when you’re online.')}
   finally{inFlight.current=false}
  },6000)
  return()=>window.clearInterval(timer)
 },[orderId,orderState,key,uncertain,autoCheck,call,persist])
 async function act(action:'pay'|'status'){
  if(inFlight.current)return
  if(soundEnabled)prepareWishFeedbackSound()
  inFlight.current=true;setBusy(true);setError('');setNotice('')
  let paymentStarted=false
  try{
   if(action==='pay'&&!order&&!uncertain)normalizeSafaricomPhone(phone)
   persist(key,uncertain) // Save recovery before any order or payment request.
   let current=order
   if(action==='pay'){
    if(uncertain||current&&current.state!=='created')return
    if(!current){
     const created=await call({action:'create',key,version:'text',...draft,payerPhone:phone,...(inboxRequest?{inboxRequest}:{})})
     current=created.order;if(alive.current)setOrder(current)
    }
    if(current.state==='created'){
     persist(key,true);paymentStarted=true;setUncertain(true)
     const p=await call({action:'pay',key})
     if(alive.current){setOrder(p.order);const hold=p.order.state==='created'&&!p.paymentError;persist(key,hold);setUncertain(hold);setError(p.paymentError||'');setAutoCheck(true)}
    }
   }else{
    const p=await call({action:'status',key})
    if(alive.current){setOrder(p.order);const hold=uncertain&&p.order.state==='created';persist(key,hold);setUncertain(hold);setAutoCheck(true)}
   }
  }catch(error){
   if(alive.current){
    setUncertain(paymentStarted||action==='status'||uncertain)
    setError(paymentStarted||action==='status'?'Payment status couldn’t be checked.':error instanceof CheckoutRequestError?'Checkout is unavailable. Please try later.':'Check your number and try again.')
   }
  }finally{inFlight.current=false;if(alive.current)setBusy(false)}
 }
 function clear(nextPhone=''){
  sessionStorage.removeItem(CHECKOUT_STORAGE_KEY);setOrder(null);setKey(newCheckoutKey());setPhone(nextPhone);setUncertain(false);setError('');setNotice('')
 }
 async function correctAddress(){if(inFlight.current)return;inFlight.current=true;setBusy(true);setError('');try{const p=await call({action:'correct_address',key,phone:correctPhone});if(alive.current){setOrder(p.order);setCorrectPhone('');setNotice('Address corrected. The old gift link is replaced. Share the new link.')}}catch(e){if(alive.current)setError(e instanceof Error?e.message:'Could not correct this address.')}finally{inFlight.current=false;if(alive.current)setBusy(false)}}
 async function editNumber(){
  if(inFlight.current)return
  inFlight.current=true;setBusy(true);setError('')
  try{
   const p=await call({action:'status',key})
   if(!alive.current)return
   setOrder(p.order)
   if(p.order.state==='created'){setDraft({...p.order.card,deliveryPhone:p.order.card.deliveryPhone||''});clear(p.order.payerPhone)}
  }catch{if(alive.current){setUncertain(true);setError('Check payment status before editing.')}}
  finally{inFlight.current=false;if(alive.current)setBusy(false)}
 }
 async function retryFailed(){
  if(inFlight.current)return
  inFlight.current=true;setBusy(true);setError('')
  try{
   const p=await call({action:'status',key})
   if(!alive.current)return
   setOrder(p.order)
   if(p.order.state==='failed'){
    setDraft({...p.order.card,deliveryPhone:p.order.card.deliveryPhone||''})
    clear(p.order.payerPhone)
   }
  }catch{if(alive.current){setUncertain(true);setError('Check payment status before trying again.')}}
  finally{inFlight.current=false;if(alive.current)setBusy(false)}
 }
 function reset(){try{clear();setDraft({theme,...values})}catch{setError('Keep your recovery key before closing.')}}
 function trap(e:React.KeyboardEvent){
  if(e.key==='Escape'){onClose();return}if(e.key!=='Tab')return
  const items=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),a[href],summary')||[]).filter(item=>item.getClientRects().length>0);if(!items.length)return
  const first=items[0],last=items[items.length-1]
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
 }
 const card=order?.card||draft
 const checking=uncertain||!!order&&pendingCheckout(order.state)
 const title=restoring?'Restoring your order':success==='sent'?'Success card invitation sent!':success==='ready'?'Your success card is ready!':order?.state==='settled'?'Payment received':uncertain||order?.state==='reconciliation_required'?'Confirming payment':checking?'Check your phone':order?.state==='failed'?'Payment not completed':order?.state==='refunded'?'Payment refunded':'Review your wish'
 return <div className={styles.modalBackdrop} onKeyDown={trap}><section ref={dialog} tabIndex={-1} className={styles.checkoutModal} role="dialog" aria-modal="true" aria-labelledby={id}>
  <button type="button" className={styles.modalClose} aria-label="Close checkout" onClick={onClose}><X size={20}/></button>
  {order?.state==='settled'&&<p>{order.inboxStatus==='opened'?'Opened':order.inboxStatus==='available'?'Available in their inbox':'Not opened—share link'}</p>}
  {success&&<div className={styles.successCelebration} aria-hidden="true"><Check size={30}/><span>✦</span><span>✧</span><span>✦</span></div>}
  <h2 id={id}>{title}</h2>
  <div className={`${styles.checkoutPreview} ${checking?styles.checkoutPreviewCompact:''}`}><CardArt template={card.theme} values={card} preview/><strong>For {card.candidate}</strong></div>
  {restoring?<p role="status">Checking your order…</p>:<>
   {order?.state!=='settled'&&<div className={styles.orderTotal}>Total <strong>KSh 50</strong></div>}
   {!order&&!uncertain?<form noValidate onSubmit={e=>{e.preventDefault();void act('pay')}}>
    <label className={styles.checkoutLabel}>M-Pesa number<input type="tel" inputMode="tel" autoComplete="tel" value={phone} maxLength={20} disabled={busy} onChange={e=>setPhone(e.target.value)} placeholder="07XX XXX XXX"/></label>
    <button type="submit" className={styles.primary} disabled={busy||!key}>{busy?'Saving…':'Pay KSh 50'}</button>
    <p className={styles.checkoutHint}>Enter your PIN on the M-Pesa prompt.</p>
   </form>:<div aria-live="polite" className={styles.checkoutFlow}>
    {order&&!success&&<p className={styles.checkoutPhone}>M-Pesa: {maskedPayerPhone(order.payerPhone)}{canPay(order.state,uncertain)&&<button type="button" disabled={busy} onClick={()=>void editNumber()}>Edit</button>}</p>}
    {!success&&(checking||order&&order.state!=='created')&&<p role="status" className={styles.checkoutNotice}>{uncertain?'Confirming your payment. Do not pay again.':checkoutMessage(order!.state)}</p>}
    {order?.state==='failed'&&!uncertain&&<><p className={styles.checkoutHint}>Check that your M-Pesa SIM has mobile signal and airplane mode is off.</p><button type="button" className={styles.primary} disabled={busy} onClick={()=>void retryFailed()}>{busy?'Checking…':'Try again'}</button></>}
    {order&&canPay(order.state,uncertain)&&<><button type="button" className={styles.primary} disabled={busy} onClick={()=>void act('pay')}>{busy?'Requesting…':error?'Try again':'Pay KSh 50'}</button><p className={styles.checkoutHint}>Enter your PIN on the M-Pesa prompt.</p></>}
    {checking&&<button type="button" className={styles.secondary} disabled={busy||!key} onClick={()=>void act('status')}>{busy?'Checking…':'Check status'}</button>}
    {success&&order&&<div className={styles.successMessage} role="status"><strong>Payment received · KSh 50</strong><p>{success==='sent'?`The invitation was sent to ${maskedPayerPhone(order.card.deliveryPhone||'')}. You can also share the card below.`:`Share it with ${order.card.candidate} so they can open your wish.`}</p>{order.deliveryStatus==='needs_review'&&<p>The SMS invitation couldn’t be confirmed. Share the card below.</p>}</div>}
    {success&&order?.invitationUrl&&<GiftShareActions link={order.invitationUrl} candidate={order.card.candidate}/>}
    {order?.state==='settled'&&!success&&<><p role="status">Payment received. Your card is still being prepared. Do not pay again.</p><button type="button" className={styles.secondary} disabled={busy} onClick={()=>void act('status')}>{busy?'Checking…':'Check card status'}</button></>}
    {checking&&!autoCheck&&<p role="status" className={styles.checkoutHint}>Confirmation is taking longer. You can check status or close and return to this order. Do not pay again.</p>}
    {checking&&autoCheck&&<p className={styles.checkoutHint}>We check automatically. You can close and return to this order.</p>}
    {key&&<details className={styles.checkoutDetails}><summary>Order details</summary>
     {order&&<><p className={styles.checkoutReference}>Order {order.id}</p>{order.receipt&&<p>M-Pesa receipt: {order.receipt}</p>}<p>Delivery: {order.card.deliveryPhone||'Private gift link'}</p></>}
     <label className={styles.checkoutLabel}>Recovery key<input readOnly value={key} onFocus={e=>e.target.select()}/></label><p>Keep this key private to restore your order.</p>
     {order?.state==='settled'&&order.inboxStatus!=='opened'&&<details><summary>Correct recipient number</summary><label className={styles.checkoutLabel}>Recipient phone<input type="tel" value={correctPhone} onChange={e=>setCorrectPhone(e.target.value)}/></label><button type="button" disabled={busy||!correctPhone.trim()} onClick={()=>void correctAddress()}>Update address</button><p>Opened or claimed gifts need <a href="/contact">support</a>.</p></details>}
     {order?.backupCode&&<label className={styles.checkoutLabel}>Backup card code<input readOnly value={order.backupCode} onFocus={e=>e.target.select()}/></label>}
     {order&&!uncertain&&['created','failed','settled','refunded'].includes(order.state)&&<button type="button" className={styles.secondary} disabled={busy} onClick={reset}>{order.state==='settled'?'Create another wish':'Start a new checkout'}</button>}
    </details>}
   </div>}
  </>}
  {error&&<p role="alert" className={styles.checkoutError}>{error}</p>}{notice&&<p role="status" className={styles.checkoutHint}>{notice}</p>}
 </section></div>
}
