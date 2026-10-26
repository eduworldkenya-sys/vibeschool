import { createServerClient } from '@supabase/ssr'
import { NextRequest } from 'next/server'
import { WishError, uuid } from '@/lib/success-wishes/contracts'
import { confirmedGuardianPhone } from '@/lib/success-wishes/receiver-provisioning'
import { requireGuardianWithdrawalAuthority } from '@/lib/success-wishes/guardian-withdrawal'
import { receiverDatabase } from '@/lib/success-wishes/receiver'
import { consumeOtp, issueOtp } from '@/lib/success-wishes/receiver-otp'
import { failure, json, limit, reply } from '@/lib/success-wishes/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
type Db = ReturnType<typeof receiverDatabase>
type Audit = { receiver_id:string;student_id:string;school_id:string;guardian_link_id:string }
type GuardianLink = {
  id:string; parent_id:string; student_id:string; school_id:string|null
  relationship:string; is_primary:boolean; receives_alerts:boolean
}
type Person = {
  id:string; student_id:string|null;display_name:string
  guardian_phone_e164:string|null;consent_route:string|null;consent_status:string
}

/**
 * For existing school-linked guardians only. The student need not log in or
 * know the guardian's credentials. Never use phone/profile data from a request.
 */
async function guardian(req: NextRequest) {
  const db = receiverDatabase() // public feature remains OFF until commissioned
  const userDb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } },
  )
  const { data: { user }, error } = await userDb.auth.getUser()
  if (error || !user) throw new WishError(401, 'Sign in with the linked guardian account.')
  const { data: profile, error: profileError } = await userDb.from('profiles')
    .select('account_status,is_anonymized').eq('id', user.id).maybeSingle()
  if (profileError || !profile || profile.account_status !== 'active' || profile.is_anonymized)
    throw new WishError(403, 'An active, verified guardian account is required.')
  const phone = confirmedGuardianPhone(user)
  return { db, id: user.id, phone }
}

async function verifiedRecipient(db: Db, guardianId: string, phone: string, receiverId: string) {
  const { data: audit, error: auditError } = await db.from('success_wish_receiver_provisioning_audit')
    .select('receiver_id,student_id,school_id,guardian_link_id').eq('receiver_id', receiverId).maybeSingle()
  if (auditError || !audit) throw new WishError(404, 'This recipient is unavailable to this guardian.')
  const [linked, found] = await Promise.all([
    db.from('parent_student_links')
      .select('id,parent_id,student_id,school_id,relationship,is_primary,receives_alerts')
      .eq('id',audit.guardian_link_id).eq('parent_id',guardianId).maybeSingle(),
    db.from('success_wish_receivers')
      .select('id,student_id,display_name,guardian_phone_e164,consent_route,consent_status')
      .eq('id',receiverId).maybeSingle(),
  ])
  if (linked.error || found.error) throw new WishError(503, 'Guardian verification is temporarily unavailable.')
  requireGuardianWithdrawalAuthority(
    guardianId,phone,receiverId,audit as Audit,linked.data as GuardianLink|null,found.data as Person|null,
  )
  return { receiverId, phone, name: (found.data as Person).display_name }
}

/** Minimal list for a signed-in guardian, not a public student directory. */
export async function GET(req: NextRequest) {
  try {
    const {db,id,phone}=await guardian(req)
    await limit('guardian-consent-list:'+id,30,900)
    const {data:links,error:linkError}=await db.from('parent_student_links')
      .select('id,parent_id,student_id,school_id,relationship,is_primary,receives_alerts')
      .eq('parent_id',id).eq('is_primary',true).eq('receives_alerts',true).limit(50)
    if(linkError)throw new WishError(503,'Guardian records are temporarily unavailable.')
    if(!links?.length)return reply({recipients:[]})
    const {data:audits,error:auditError}=await db.from('success_wish_receiver_provisioning_audit')
      .select('receiver_id,student_id,school_id,guardian_link_id')
      .in('guardian_link_id',links.map(l=>l.id)).limit(50)
    if(auditError)throw new WishError(503,'Guardian records are temporarily unavailable.')
    if(!audits?.length)return reply({recipients:[]})
    const {data:people,error:peopleError}=await db.from('success_wish_receivers')
      .select('id,student_id,display_name,guardian_phone_e164,consent_route,consent_status')
      .in('id',audits.map(a=>a.receiver_id)).limit(50)
    if(peopleError)throw new WishError(503,'Guardian records are temporarily unavailable.')
    const recipients=(audits as Audit[]).flatMap(a=>{
      try {
        const p=(people||[]).find(v=>v.id===a.receiver_id) as Person|undefined
        requireGuardianWithdrawalAuthority(id,phone,a.receiver_id,a,
          (links||[]).find(l=>l.id===a.guardian_link_id) as GuardianLink|undefined || null,p||null)
        return [{id:a.receiver_id,name:p!.display_name}]
      } catch {return []}
    })
    return reply({recipients})
  }catch(error){return failure(error)}
}

export async function POST(req: NextRequest) {
  try {
    const body=await json(req) as {action?:unknown;receiverId?:unknown;challengeId?:unknown;code?:unknown}
    if(body?.action!=='begin'&&body?.action!=='confirm')
      throw new WishError(400,'Choose a consent action.')
    const receiverId=uuid(body.receiverId)
    const {db,id,phone}=await guardian(req)
    await limit('guardian-consent-change:'+id+':'+receiverId,12,86400)
    const verified=await verifiedRecipient(db,id,phone,receiverId)
    if(body.action==='begin'){
      const challengeId=await issueOtp(db,verified.receiverId,verified.phone,'consent_guardian')
      return reply({challengeId,expiresInSeconds:300,
        message:'A fresh consent withdrawal code was submitted to your verified guardian phone.'})
    }
    await consumeOtp(db,verified.receiverId,body.challengeId,body.code,'consent_guardian')
    const {data:revoked,error:revokeError}=await db.from('success_wish_receivers')
      .update({consent_status:'revoked'})
      .eq('id',verified.receiverId).eq('consent_status','verified')
      .eq('consent_route','guardian').eq('guardian_phone_e164',verified.phone)
      .select('id').maybeSingle()
    if(revokeError||!revoked)throw new WishError(409,'Consent withdrawal could not be completed.')
    // Access immediately fails at central receiver checks. Clear tokens too.
    const {error:sessionError}=await db.from('success_wish_receiver_sessions')
      .delete().eq('receiver_id',verified.receiverId)
    if(sessionError)console.error('Success Wishes: guardian withdrawal session cleanup failed')
    return reply({ok:true,revoked:true,
      message:'Guardian consent withdrawn. The student inbox and private cards are now unavailable.'})
  }catch(error){return failure(error)}
}
