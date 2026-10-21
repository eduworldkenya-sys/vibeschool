import {NextRequest} from 'next/server'
import {field,object,submission,WishError} from '@/lib/success-wishes/contracts'
import {database,failure,json,limit,reply} from '@/lib/success-wishes/server'
import {hashSecret} from '@/lib/success-wishes/security'
import {normalizeSafaricomPhone} from '@/lib/success-wishes/payment-contract'
import {guestMpesaSandboxEnabled,serverQuoteWish} from '@/lib/success-wishes/guest-mpesa-contract'
import {createGuestMpesaTransport,guestMpesaTransportReady} from '@/lib/success-wishes/mpesa-transport'
export const runtime='nodejs'
export const dynamic='force-dynamic'

// Isolated sandbox-only implementation. Not enabled for public production.
// This API NEVER marks an order paid. Only a separate provider-verified
// transactional callback processor can release the recipient's message.
export async function POST(req:NextRequest){
  let orderId:string|null=null
  let attemptId:string|null=null
  let dispatched=false
  try{
    if(!guestMpesaSandboxEnabled() || !guestMpesaTransportReady()
      ||process.env.SUCCESS_WISHES_MPESA_ISOLATED_DATABASE_CONFIRMED!=='true')
      throw new WishError(503,'M-Pesa sandbox checkout is not commissioned.')
    const body=object(await json(req))
    const input=submission(body)
    const senderProof=field(body.senderProof,64,64)
    if(!/^[a-f0-9]{64}$/.test(senderProof))
      throw new WishError(401,'Verify your phone before testing a payment.')
    const phone=normalizeSafaricomPhone(field(body.phone,9,18))
    const quote=serverQuoteWish(input.kind)
    const db=database()
    await limit('guest-mpesa:sandbox:global',80,3600)
    await limit('guest-mpesa:sandbox:sender:'+hashSecret(phone),6,3600)
    const {data:sender,error:senderError}=await db.from('success_wishes_sender_sessions')
      .select('sender_id').eq('token_hash',hashSecret(senderProof))
      .gt('expires_at',new Date().toISOString()).maybeSingle()
    if(senderError)throw senderError
    if(!sender)throw new WishError(401,'Your phone verification expired.')
    const {data:school,error:schoolError}=await db.from('success_wishes_schools')
      .select('enabled,expires_at').eq('school_id',input.schoolId)
      .eq('enabled',true).gt('expires_at',new Date().toISOString()).maybeSingle()
    if(schoolError)throw schoolError
    if(!school)throw new WishError(503,'The selected school is not accepting wishes.')
    const {data:inboxId,error:recipientError}=await db.rpc('success_wishes_match_recipient',{
      p_school_id:input.schoolId,p_admission_number:input.admissionNumber,p_name:input.candidateName,
    })
    if(recipientError)throw recipientError
    if(typeof inboxId!=='string')throw new WishError(400,'Check the recipient details with the school.')
    const {data:blocked,error:blockedError}=await db.from('success_wishes_blocked_senders')
      .select('sender_id').eq('inbox_id',inboxId).eq('sender_id',sender.sender_id).maybeSingle()
    if(blockedError)throw blockedError
    if(blocked)throw new WishError(403,'This candidate cannot receive wishes from this sender.')

    const proposed={
      inbox_id:inboxId,sender_id:sender.sender_id,sender_name:input.senderName,
      relationship:input.relationship,format:input.kind,body:input.text,
      phone,amount_kes:quote.amountKes,idempotency_key:input.idempotencyKey,
    }
    const {data:created,error:createError}=await db.from('success_wishes_guest_orders')
      .insert(proposed).select('id,state').single()
    let ownsOrder=true
    if(createError){
      if(createError.code!=='23505')throw createError
      ownsOrder=false
      const {data:old,error:oldError}=await db.from('success_wishes_guest_orders')
        .select('id,state,inbox_id,sender_id,sender_name,relationship,format,body,phone,amount_kes')
        .eq('sender_id',sender.sender_id).eq('idempotency_key',input.idempotencyKey).maybeSingle()
      if(oldError)throw oldError
      if(!old||old.inbox_id!==proposed.inbox_id||old.sender_name!==proposed.sender_name
        ||old.relationship!==proposed.relationship||old.format!==proposed.format
        ||old.body!==proposed.body||old.phone!==proposed.phone
        ||old.amount_kes!==proposed.amount_kes)
        throw new WishError(409,'Submission reference is already used for another wish.')
      return reply({reference:old.id,state:old.state,
        message:'The existing sandbox payment was recovered. It will not be sent twice.'})
    }
    if(!created||!ownsOrder)throw new Error('Guest order could not be created.')
    orderId=created.id
    const {data:attempt,error:attemptError}=await db.from('success_wishes_guest_payment_attempts')
      .insert({order_id:orderId}).select('id').single()
    if(attemptError||!attempt)throw attemptError||new Error('Could not record sandbox payment attempt.')
    attemptId=attempt.id
    const {data:claimed,error:claimError}=await db.rpc('success_wishes_claim_guest_attempt',{
      p_attempt_id:attempt.id,
    })
    if(claimError)throw claimError
    if(claimed!==true)throw new WishError(503,'Canonical M-Pesa initiation is disabled. No payment was requested.')

    // A second fail-closed check immediately before the network side effect.
    const transport=createGuestMpesaTransport()
    const ack=await transport.sendStk({
      id:attempt.id,state:'submitting',amountKes:quote.amountKes,phone,
    },async()=>{
      const {data:control,error:controlError}=await db.from('mpesa_runtime_control')
        .select('initiation_enabled').eq('singleton',true).maybeSingle()
      const {data:locked,error:lockedError}=await db.from('success_wishes_guest_payment_attempts')
        .select('state,order_id').eq('id',attempt.id).maybeSingle()
      return !controlError&&!lockedError&&control?.initiation_enabled===true
        &&locked?.state==='submitting'&&locked.order_id===orderId
        &&guestMpesaSandboxEnabled()
    })
    dispatched=true
    const {data:attached,error:attachError}=await db.rpc('success_wishes_attach_guest_stk',{
      p_attempt_id:attempt.id,p_checkout:ack.checkoutRequestId,
      p_merchant:ack.merchantRequestId,p_response:{sandbox:true},
    })
    if(attachError||attached!==true)throw attachError||new Error('STK acknowledgement was not recorded.')
    return reply({reference:orderId,state:'awaiting_customer',amountKes:quote.amountKes,
      currency:'KES',message:ack.customerMessage,paid:false},202)
  }catch(error){
    // Once a network request is attempted, even a timeout can have issued an
    // STK prompt. Never automatically send a second charge.
    if(orderId&&attemptId&&!(error instanceof WishError&&error.status===503&&!dispatched)){
      try{
        const db=database()
        await db.from('success_wishes_guest_payment_attempts')
          .update({state:'reconciliation_required',updated_at:new Date().toISOString()})
          .eq('id',attemptId).in('state',['created','submitting','awaiting_customer'])
        await db.from('success_wishes_guest_orders')
          .update({state:'reconciliation_required',updated_at:new Date().toISOString()})
          .eq('id',orderId).in('state',['created','submitting','awaiting_customer'])
      }catch{ /* leave durable attempt for operator reconciliation */ }
    }
    return failure(error)
  }
}
