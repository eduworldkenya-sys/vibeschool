import { NextRequest } from 'next/server'
import { field, uuid, WishError } from '@/lib/success-wishes/contracts'
import { schoolAdmin } from '@/lib/success-wishes/staff'
import { database, failure, json, reply } from '@/lib/success-wishes/server'
export const dynamic='force-dynamic'
export const runtime='nodejs'
export async function GET(req:NextRequest){
 try{
  const schoolId=uuid(req.nextUrl.searchParams.get('schoolId'))
  await schoolAdmin(req,schoolId)
  const db=database({staffOnly:true})
  const {data:audits,error}=await db.from('success_wish_receiver_provisioning_audit').select('receiver_id').eq('school_id',schoolId).limit(500)
  if(error)throw error
  if(!audits?.length)return reply({reports:[],requests:[]})
  const ids=audits.map(a=>a.receiver_id)
  const [reports,requests]=await Promise.all([
   db.from('success_wish_receiver_reports').select('id,receiver_id,reason,status,created_at').in('receiver_id',ids).in('status',['open','under_review']).order('created_at').limit(100),
   db.from('success_wish_data_requests').select('id,receiver_id,kind,status,created_at').in('receiver_id',ids).in('status',['pending','reviewing']).order('created_at').limit(100),
  ])
  if(reports.error||requests.error)throw new WishError(503,'The privacy queue could not be loaded.')
  return reply({reports:reports.data,requests:requests.data})
 }catch(error){return failure(error)}
}
export async function POST(req:NextRequest){
 try{
  const body=await json(req) as Record<string,unknown>
  const schoolId=uuid(body.schoolId),targetId=uuid(body.targetId)
  const kind=field(body.kind,6,7),status=field(body.status,8,12),reference=field(body.evidenceReference,10,160)
  const userDb=await schoolAdmin(req,schoolId)
  const {data:{user},error}=await userDb.auth.getUser()
  if(error||!user)throw new WishError(401,'Sign in as the school administrator.')
  const {data,error:reviewError}=await database({staffOnly:true}).rpc('success_wish_review_privacy_case',{
   p_school:schoolId,p_staff:user.id,p_target:targetId,p_kind:kind,p_status:status,p_reference:reference,
  })
  if(reviewError||data!==true)throw new WishError(409,'The case is unavailable or the review transition is invalid.')
  return reply({ok:true,message:'Review recorded. Completing a case attests that the referenced manual privacy work was performed; no data was erased by this action.'})
 }catch(error){return failure(error)}
}
