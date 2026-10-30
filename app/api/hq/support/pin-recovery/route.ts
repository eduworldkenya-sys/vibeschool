import {NextRequest,NextResponse} from 'next/server'
import {createClient} from '@supabase/supabase-js'
import {secret,validId,nameKey} from '@/lib/success-wishes/receiver-pin'
import {recoveryHash} from '@/lib/success-wishes/receiver-collection'
import {hashSecret} from '@/lib/success-wishes/security'
export const runtime='nodejs'
export const dynamic='force-dynamic'
function db(){return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{autoRefreshToken:false,persistSession:false}})}
async function authorize(req:NextRequest){
 const token=req.headers.get('authorization')?.replace(/^Bearer /,'')
 if(!token)return null
 const client=db(),{data:{user},error}=await client.auth.getUser(token)
 if(error||!user)return null
 const {data:member}=await client.from('hq_human_members').select('role,status,permissions,access_expires_at').eq('profile_id',user.id).maybeSingle()
 if(!member||member.status!=='active'||member.access_expires_at&&Date.parse(member.access_expires_at)<=Date.now())return null
 if(member.role!=='founder'&&(!Array.isArray(member.permissions)||!member.permissions.includes('support.manage')))return null
 return {client,operator:user.id}
}
const fail=(message:string,status:number)=>NextResponse.json({error:message},{status})
export async function GET(req:NextRequest){
 const auth=await authorize(req);if(!auth)return fail('Not authorized',403)
 const {data,error}=await auth.client.from('success_wish_recovery_reviews').select('id,exam_year,status,created_at,resolved_at').order('created_at',{ascending:false}).limit(100)
 return error?fail('Could not load requests',503):NextResponse.json({requests:data},{headers:{'cache-control':'no-store'}})
}
export async function POST(req:NextRequest){
 const auth=await authorize(req);if(!auth)return fail('Not authorized',403)
 const body=await req.json().catch(()=>null)
 if(!body||!validId(body.requestId)||!['approve','reject'].includes(body.action))return fail('Invalid request',400)
 const {client,operator}=auth
 const {data:review}=await client.from('success_wish_recovery_reviews').select('id,status,phone_digest,name_digest,exam_year').eq('id',body.requestId).maybeSingle()
 if(!review||review.status!=='pending'&&review.status!=='reviewing')return fail('Request is no longer pending',409)
 if(body.action==='reject'){
  const {error}=await client.from('success_wish_recovery_reviews').update({status:'rejected',resolved_at:new Date().toISOString(),evidence_reference:'rejected by HQ '+operator}).eq('id',review.id).in('status',['pending','reviewing'])
  return error?fail('Could not reject request',503):NextResponse.json({ok:true})
 }
 if(!validId(body.receiverId)||typeof body.evidence!=='string'||body.evidence.trim().length<20||body.confirmedVerified!==true)return fail('Independently verify the recipient and record evidence before approval',400)
 const {data:receiver}=await client.from('success_wish_receivers').select('id,phone_e164,display_name,pin_exam_year,pin_hash,consent_status').eq('id',body.receiverId).maybeSingle()
 if(!receiver||!receiver.pin_hash||receiver.consent_status==='revoked'||receiver.pin_exam_year!==review.exam_year||
 hashSecret('success-wishes:recovery-review:phone:'+receiver.phone_e164)!==review.phone_digest||
 hashSecret('success-wishes:recovery-review:name:'+nameKey(receiver.display_name))!==review.name_digest)
 return fail('Recipient does not match this request',409)
 // Approvals do not authenticate phone ownership. HQ must verify identity outside the form.
 const capability=secret()
 const {data:claimed,error:claimError}=await client.from('success_wish_recovery_reviews').update({status:'reviewing',evidence_reference:body.evidence.trim().slice(0,300)+' | approved by '+operator}).eq('id',review.id).in('status',['pending','reviewing']).select('id').maybeSingle()
 if(claimError||!claimed)return fail('Request was already handled',409)
 const {error}=await client.from('success_wish_receivers').update({pin_recovery_hash:recoveryHash(capability),pin_previous_recovery_hash:null,pin_reset_hash:null}).eq('id',receiver.id)
 if(error)return fail('Could not issue recovery link',503)
 await client.from('success_wish_recovery_reviews').update({status:'completed',resolved_at:new Date().toISOString()}).eq('id',review.id)
 return NextResponse.json({ok:true,recoveryUrl:req.nextUrl.origin+'/success-wishes/recover#recovery='+capability},{headers:{'cache-control':'no-store'}})
}
