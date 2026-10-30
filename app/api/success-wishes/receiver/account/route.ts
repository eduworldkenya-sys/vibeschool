import {NextRequest} from 'next/server'
import {WishError,field,object} from '@/lib/success-wishes/contracts'
import {database,failure,json,reply,takeAttempt} from '@/lib/success-wishes/server'
import {hashSecret} from '@/lib/success-wishes/security'
import {senderPhone} from '@/lib/success-wishes/phone-verification'
import {PIN_COOKIE,derive,nameKey,protectPin,secret,validSecret,validId,verifyPin} from '@/lib/success-wishes/receiver-pin'
import {receiverSession,remember,pinAttempt,cookieOptions,sessionHash,recoveryHash,type Receiver} from '@/lib/success-wishes/receiver-collection'
export const dynamic='force-dynamic'
export const runtime='nodejs'
const denied=()=>new WishError(401,'Check your details or use your private recovery link.')
export async function GET(req:NextRequest){try{const {receiver:r}=await receiverSession(req);return reply({recipient:{id:r.id,name:r.display_name,school:r.school_label,phone:r.phone_e164,examYear:r.pin_exam_year}})}catch(e){return failure(e)}}
export async function POST(req:NextRequest){try{
 const b=object(await json(req)),db=database(),action=field(b.action,1,24)
 if(action==='login'){
  if(!validId(b.inboxId))throw denied()
  await pinAttempt(req,b.inboxId)
  const {data:r,error}=await db.from('success_wish_receivers').select('id,pin_hash,pin_epoch,consent_status').eq('id',b.inboxId).maybeSingle()
  if(error)throw new WishError(503,'Private access is temporarily unavailable.')
  if(!r?.pin_hash||r.consent_status==='revoked'||!verifyPin(b.pin,r.pin_hash))throw denied()
  const response=reply({ok:true,inboxId:r.id});await remember(db,req,response,r);return response
 }
 if(action==='create'){
  const phone=senderPhone(b.phone),name=field(b.name,1,100).trim(),school=b.school?field(b.school,1,80):'',year=field(b.examYear,4,4)
  if(!/^20\d{2}$/.test(year)||!validSecret(b.setupKey)||b.accepted!==true||b.role!=='adult'&&b.role!=='guardian')throw new WishError(400,'Confirm your PIN and adult or parent/guardian choice.')
  await pinAttempt(req,'setup:'+phone)
  const setup=hashSecret('pin-setup:'+b.setupKey),recovery=derive('setup-recovery:'+b.setupKey),pin=protectPin(b.pin,derive('setup-salt:'+b.setupKey).slice(0,32))
  const {data:previous,error:pe}=await db.from('success_wish_receivers').select('id,pin_epoch,pin_hash,pin_recovery_hash,pin_name_key,phone_e164').eq('pin_setup_hash',setup).maybeSingle()
  if(pe)throw new WishError(503,'Could not check setup. Try again.')
  if(previous){if(previous.pin_name_key!==nameKey(name)||previous.phone_e164!==phone||previous.pin_recovery_hash!==recoveryHash(recovery)||!verifyPin(b.pin,previous.pin_hash))throw denied();const response=reply({ok:true,inboxId:previous.id,recoveryUrl:req.nextUrl.origin+'/success-wishes/recover#recovery='+recovery});await remember(db,req,response,previous);return response}
  // A phone is a shared delivery address, but an existing recipient identity
  // must be unlocked rather than silently provisioned a second time.
  const {data:existing,error:existingError}=await db.from('success_wish_receivers')
   .select('id').eq('phone_e164',phone).eq('pin_name_key',nameKey(name)).eq('pin_exam_year',year).limit(1)
  if(existingError)throw new WishError(503,'Could not check existing inbox. Try again.')
  if(existing?.length)throw new WishError(409,'This recipient already has an inbox. Open My wishes and enter their PIN.')
  let legacyId:string|null=null
  try{const {inboxSession}=await import('@/lib/success-wishes/receiver-otp');const old=await inboxSession(req);if(old.receiver.phone_e164===phone&&nameKey(old.receiver.display_name)===nameKey(name))legacyId=old.receiver.id}catch(e){if(!(e instanceof WishError&&[401,503].includes(e.status)))throw e}
  const record={display_name:name,school_label:school,phone_e164:phone,pin_name_key:nameKey(name),pin_exam_year:year,pin_hash:pin,pin_epoch:1,pin_setup_hash:setup,pin_recovery_hash:recoveryHash(recovery),pin_notice_version:'keepsake-2026-10-29',pin_consent_role:b.role,pin_consent_at:new Date().toISOString()}
  const query=legacyId?db.from('success_wish_receivers').update(record).eq('id',legacyId).is('pin_hash',null):db.from('success_wish_receivers').insert(record)
  const {data:r,error}=await query.select('id,pin_epoch').single()
  if(error||!r)throw new WishError(409,'Setup could not finish. Retry the same form or unlock your inbox.')
  const response=reply({ok:true,inboxId:r.id,recoveryUrl:req.nextUrl.origin+'/success-wishes/recover#recovery='+recovery});await remember(db,req,response,r);return response
 }
 if(action==='recover'){
  if(!validSecret(b.recovery)||!validSecret(b.setupKey))throw denied()
  await pinAttempt(req,'recover:'+recoveryHash(b.recovery))
  const next=derive('reset:'+b.recovery+':'+b.setupKey),raw=derive('reset-session:'+b.recovery+':'+b.setupKey),pin=protectPin(b.pin,derive('reset-salt:'+b.setupKey).slice(0,32))
  const {data,error}=await db.rpc('success_wish_pin_recover',{p_old:recoveryHash(b.recovery),p_new:recoveryHash(next),p_pin:pin,p_request:hashSecret('reset-request:'+b.setupKey),p_session:sessionHash(raw)})
  const r=Array.isArray(data)?data[0]:data
  if(error||!r?.id)throw denied()
  const response=reply({ok:true,inboxId:r.id,recoveryUrl:req.nextUrl.origin+'/success-wishes/recover#recovery='+next});response.cookies.set(PIN_COOKIE,raw,cookieOptions(req));return response
 }
 if(action==='reset_signed_in'){
  // An existing authenticated PIN session is a possession credential. Phone and name
  // are never used to identify the inbox. Rotate every old session on reset.
  const {receiver:r}=await receiverSession(req)
  await pinAttempt(req,'trusted-reset:'+r.id)
  const recovery=secret(),pin=protectPin(b.pin)
  const {data:updated,error}=await db.from('success_wish_receivers')
   .update({pin_hash:pin,pin_recovery_hash:recoveryHash(recovery),
    pin_previous_recovery_hash:null,pin_reset_hash:null,pin_epoch:r.pin_epoch+1})
   .eq('id',r.id).eq('pin_epoch',r.pin_epoch)
   .select('id,pin_epoch').maybeSingle()
  if(error||!updated)throw new WishError(409,'Your inbox changed. Reopen My wishes and try again.')
  const {error:revokeError}=await db.from('success_wish_receiver_sessions').delete().eq('receiver_id',r.id)
  if(revokeError)throw new WishError(503,'PIN changed. Sign in again with your new PIN.')
  const response=reply({ok:true,inboxId:r.id,recoveryUrl:req.nextUrl.origin+'/success-wishes/recover#recovery='+recovery})
  await remember(db,req,response,updated)
  return response
 }
 if(action==='confirm_recovery'){
  const {receiver:r}=await receiverSession(req);if(b.inboxId!==r.id)throw new WishError(409,'The active learner changed. Reopen My wishes.');const {error}=await db.from('success_wish_receivers').update({pin_previous_recovery_hash:null,pin_reset_hash:null}).eq('id',r.id).eq('pin_epoch',r.pin_epoch);if(error)throw new WishError(503,'Could not finish recovery. Try again.');return reply({ok:true})
 }
 if(action==='attach'){
  const {receiver:r}=await receiverSession(req);if(b.inboxId!==r.id)throw new WishError(409,'The active learner changed. Reopen My wishes.');if(!validSecret(b.token))throw new WishError(400,'Open your private gift link.');await takeAttempt(db,'pin-attach:'+r.id,40,900)
  const {data,error}=await db.rpc('success_wish_pin_claim',{p_receiver:r.id,p_link_hash:hashSecret('success-wishes:paid-link:'+b.token)})
  if(error||data!==true)throw new WishError(409,'This gift is unavailable, belongs to another learner, or is already saved elsewhere.');return reply({ok:true})
 }
 throw new WishError(400,'Choose an account action.')
}catch(e){return failure(e)}}
export {logoutReceiver as DELETE} from '@/lib/success-wishes/receiver-logout'
