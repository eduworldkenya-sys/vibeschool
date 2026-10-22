import {timingSafeEqual} from 'node:crypto'
import {NextRequest} from 'next/server'
import {reply,failure,database} from '@/lib/success-wishes/server'
import {guestMpesaSandboxEnabled} from '@/lib/success-wishes/guest-mpesa-contract'
import {createGuestMpesaTransport,guestMpesaTransportReady} from '@/lib/success-wishes/mpesa-transport'
export const runtime='nodejs'
export const dynamic='force-dynamic'
function authorized(req:NextRequest):boolean{
  const expected=process.env.SUCCESS_WISHES_MPESA_RECONCILE_SECRET||''
  const supplied=req.headers.get('authorization')?.replace(/^Bearer /,'')||''
  if(expected.length<32||supplied.length!==expected.length)return false
  return timingSafeEqual(Buffer.from(expected),Buffer.from(supplied))
}
// A scheduled/operator retry for callbacks which arrived early or when
// Daraja was temporarily unavailable. Does not create STK requests.
export async function POST(req:NextRequest){
  try{
    if(!guestMpesaSandboxEnabled()||!guestMpesaTransportReady()
      ||process.env.SUCCESS_WISHES_MPESA_ISOLATED_DATABASE_CONFIRMED!=='true')
      return reply({error:'Sandbox payment reconciliation is disabled.'},503)
    if(!authorized(req))return reply({error:'Unauthorized.'},401)
    const db=database()
    const transport=createGuestMpesaTransport()
    const {data:events,error}=await db.from('success_wishes_guest_payment_events')
      .select('id,checkout_request_id,result_code,provider_confirmed')
      .eq('processing_state','pending')
      .order('received_at',{ascending:true}).limit(10)
    if(error)throw error
    let reconciled=0,unresolved=0
    for(const event of events||[]){
      if(!event.provider_confirmed){
        let providerCode:number|null=null
        try{providerCode=await transport.queryStk(event.checkout_request_id)}
        catch{unresolved++;continue}
        if(providerCode===null||providerCode!==event.result_code){unresolved++;continue}
        const {error:saveError}=await db.from('success_wishes_guest_payment_events')
          .update({provider_confirmed:true}).eq('id',event.id)
          .eq('processing_state','pending')
        if(saveError){unresolved++;continue}
      }
      const {data:decision,error:processError}=await db.rpc('success_wishes_settle_guest_event',{
        p_event_id:event.id,
      })
      if(processError||decision==='pending_checkout_attachment'
        ||decision==='provider_confirmation_required'||decision==='missing_event')
        unresolved++
      else reconciled++
    }
    return reply({scanned:(events||[]).length,reconciled,unresolved,
      message:'Sandbox payment reconciliation completed; no STK request initiated.'})
  }catch(error){return failure(error)}
}
