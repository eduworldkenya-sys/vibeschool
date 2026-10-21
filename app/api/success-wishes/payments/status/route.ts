import {NextRequest} from 'next/server'
import {field,object,uuid,WishError} from '@/lib/success-wishes/contracts'
import {database,failure,json,limit,reply} from '@/lib/success-wishes/server'
import {hashSecret} from '@/lib/success-wishes/security'
import {guestMpesaSandboxEnabled} from '@/lib/success-wishes/guest-mpesa-contract'
export const runtime='nodejs'
export const dynamic='force-dynamic'

// Private status lookup by a freshly verified sender. It cannot settle funds.
export async function POST(req:NextRequest){
  try{
    if(!guestMpesaSandboxEnabled()
      ||process.env.SUCCESS_WISHES_MPESA_ISOLATED_DATABASE_CONFIRMED!=='true')
      throw new WishError(503,'Sandbox payment status is unavailable.')
    const body=object(await json(req))
    const reference=uuid(body.reference)
    const proof=field(body.senderProof,64,64)
    if(!/^[a-f0-9]{64}$/.test(proof))throw new WishError(401,'Verify your phone.')
    await limit('guest-mpesa:status:'+reference,20,900)
    const db=database()
    const {data:sender,error:senderError}=await db.from('success_wishes_sender_sessions')
      .select('sender_id').eq('token_hash',hashSecret(proof))
      .gt('expires_at',new Date().toISOString()).maybeSingle()
    if(senderError)throw senderError
    if(!sender)throw new WishError(401,'Verify your phone again.')
    const readOrder=()=>db.from('success_wishes_guest_orders')
      .select('id,state,amount_kes,format,message_id,idempotency_key,created_at')
      .eq('id',reference).eq('sender_id',sender.sender_id).maybeSingle()
    const initial=await readOrder()
    if(initial.error)throw initial.error
    if(!initial.data)throw new WishError(404,'Payment reference not found.')
    // Recover a verified callback that arrived before STK acknowledgement was
    // attached. Only provider-confirmed, server-private events can be replayed.
    if(initial.data.state==='awaiting_customer'
      ||initial.data.state==='reconciliation_required'){
      const {data:attempt}=await db.from('success_wishes_guest_payment_attempts')
        .select('checkout_request_id').eq('order_id',reference).maybeSingle()
      if(attempt?.checkout_request_id){
        const {data:events}=await db.from('success_wishes_guest_payment_events')
          .select('id').eq('checkout_request_id',attempt.checkout_request_id)
          .eq('provider_confirmed',true).eq('processing_state','pending').limit(5)
        for(const event of events||[])
          await db.rpc('success_wishes_settle_guest_event',{p_event_id:event.id})
      }
    }
    const {data:order,error}=await readOrder()
    if(error)throw error
    if(!order)throw new WishError(404,'Payment reference not found.')
    const paid=order.state==='settled'
    return reply({
      reference:order.id,state:order.state,format:order.format,
      currency:'KES',amountKes:order.amount_kes,paid,
      messageReference:paid?order.message_id:null,
      managementToken:paid?hashSecret('success-wishes:manage:'+order.idempotency_key):undefined,
      message:paid?'Verified payment recorded. Your wish is awaiting candidate acceptance.'
        :order.state==='reconciliation_required'?'Do not pay again. Contact support with this reference.'
        :order.state==='awaiting_customer'?'Finish the sandbox STK request before checking again.'
        :order.state==='failed'?'The sandbox payment did not complete.'
        :'Payment is not settled.',
    })
  }catch(error){return failure(error)}
}
