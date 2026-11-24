import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NO_STORE = { 'Cache-Control':'private, no-store', 'X-Content-Type-Options':'nosniff' }
type Target = 'mini' | 'request' | 'comment'
type SafetyVerdict = { safe: boolean; reason: string }
type PendingItem = { id:string; status:string; creator_id?:string; requester_id?:string; author_id?:string;
  updated_at?:string; title?:string; body?:string; question?:string; cover_path?:string|null; tags?:string[]; request_id?:string|null;
  quiz_question?:string|null; quiz_options?:string[]; quiz_explanation?:string|null }
const tables:Record<Target,string> = { mini:'mini_lessons', request:'mini_requests',comment:'mini_comments' }
const owners:Record<Target,string> = { mini:'creator_id', request:'requester_id',comment:'author_id' }
const approved = (body:unknown,status=200) => NextResponse.json(body,{status,headers:NO_STORE})

function sameOrigin(request:NextRequest):boolean {
  const origin=request.headers.get('origin')
  if(!origin) return true
  try { return new URL(origin).origin === request.nextUrl.origin } catch { return false }
}

function service():SupabaseClient {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL
  const secret=process.env.SUPABASE_SERVICE_ROLE_KEY
  if(!url||!secret) throw new Error('Database is unavailable.')
  return createClient(url,secret,{auth:{autoRefreshToken:false,persistSession:false}})
}

/**
 * Moderation uses Google's dedicated non-generative safety classifiers:
 * Natural Language moderateText and Vision SafeSearch + OCR + face detection.
 * No direct LLM calls and no unsafe fallback: missing/unsupported responses
 * leave the user's content privately pending.
 */
async function moderate(input:{target:Target;title:string;body:string;photo?:{data:string;mimeType:string}}):Promise<SafetyVerdict>{
  const key=process.env.MINI_GOOGLE_SAFETY_API_KEY
  if(!key) throw new Error('Automatic safety checks are unavailable.')
  const text=[input.title,input.body].join('\n').trim()
  if(!text||text.length>5000)throw new Error('Invalid safety input.')
  const contact=/https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?254|0)[17]\d{8}/i
  if(contact.test(text))return {safe:false,reason:'Contact information or links are not allowed'}
  // In public student requests, avoid school and learner identifying details.
  if(input.target==='request'&&/\b(my|our)\s+(school|phone|address|teacher's\s+phone)\b/i.test(text))
    return {safe:false,reason:'Remove identifying personal details'}
  const headers={'Content-Type':'application/json','x-goog-api-key':key}
  const language=await fetch('https://language.googleapis.com/v2/documents:moderateText',{
    method:'POST',headers,cache:'no-store',signal:AbortSignal.timeout(20000),
    body:JSON.stringify({document:{type:'PLAIN_TEXT',content:text}}),
  })
  if(!language.ok)throw new Error('Text safety service unavailable.')
  const classified:unknown=await language.json()
  if(!classified||typeof classified!=='object')throw new Error('Invalid text safety response.')
  const report=classified as {languageSupported?:boolean;moderationCategories?:Array<{name?:string;confidence?:number}>}
  if(report.languageSupported!==true)throw new Error('Unsupported or unconfirmed text safety language.')
  if(!Array.isArray(report.moderationCategories)||report.moderationCategories.length===0)
    throw new Error('Missing text safety categories.')
  const thresholds:Record<string,number>={
    Toxic:0.7,Derogatory:0.55,Violent:0.7,Sexual:0.5,Insult:0.7,Profanity:0.7,
    'Death, Harm & Tragedy':0.8,
  }
  for(const item of report.moderationCategories){
    if(typeof item.name!=='string'||typeof item.confidence!=='number'||!Number.isFinite(item.confidence))
      throw new Error('Invalid text safety category.')
    if(Object.prototype.hasOwnProperty.call(thresholds,item.name)&&item.confidence>=thresholds[item.name])
      return {safe:false,reason:'Content did not meet the safety policy'}
  }
  if(input.photo){
    if(!['image/jpeg','image/png','image/webp'].includes(input.photo.mimeType)||
       input.photo.data.length>7_200_000)
      throw new Error('Invalid image safety input.')
    const image=await fetch('https://vision.googleapis.com/v1/images:annotate',{
      method:'POST',headers,cache:'no-store',signal:AbortSignal.timeout(20000),
      body:JSON.stringify({requests:[{
        image:{content:input.photo.data},
        features:[{type:'SAFE_SEARCH_DETECTION'},{type:'FACE_DETECTION'},{type:'TEXT_DETECTION'}],
      }]}),
    })
    if(!image.ok)throw new Error('Image safety service unavailable.')
    const raw:unknown=await image.json()
    if(!raw||typeof raw!=='object')throw new Error('Invalid image safety response.')
    const result=raw as {responses?:Array<{
      error?:{message?:string};
      safeSearchAnnotation?:Record<string,string>;
      faceAnnotations?:unknown[];
      textAnnotations?:Array<{description?:string}>;
    }>}
    const img=result.responses?.[0]
    if(!img||img.error||!img.safeSearchAnnotation)throw new Error('Missing image safety analysis.')
    const blocked=new Set(['POSSIBLE','LIKELY','VERY_LIKELY'])
    const valid=new Set(['VERY_UNLIKELY','UNLIKELY','POSSIBLE','LIKELY','VERY_LIKELY'])
    for(const category of ['adult','violence','racy']){
      const level=img.safeSearchAnnotation[category]
      if(!level||!valid.has(level))throw new Error('Incomplete image safety analysis.')
      if(blocked.has(level))return {safe:false,reason:'Image did not meet the safety policy'}
    }
    if((img.faceAnnotations?.length??0)>0)
      return {safe:false,reason:'Use a teaching image without identifiable people'}
    const detectedText=img.textAnnotations?.[0]?.description??''
    if(contact.test(detectedText))return {safe:false,reason:'Contact information in image is not allowed'}
  }
  return {safe:true,reason:'Automated screening passed'}
}

export async function POST(request:NextRequest) {
  if(process.env.MINI_LESSONS_OPEN_PUBLISHING_ENABLED!=='true')
    return approved({error:'Open Mini publishing is not commissioned.'},503)
  if(!sameOrigin(request)) return approved({error:'Forbidden origin'},403)
  if(!(request.headers.get('content-type')||'').startsWith('application/json'))
    return approved({error:'JSON required'},415)
  if(Number(request.headers.get('content-length')||'0')>1024)
    return approved({error:'Request too large'},413)
  const bearer=request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  if(!bearer) return approved({error:'Sign in required'},401)
  let target:Target, id:string
  try{
    const raw=await request.text()
    if(new TextEncoder().encode(raw).byteLength>1024)return approved({error:'Request too large'},413)
    const body:unknown=JSON.parse(raw)
    if(!body||typeof body!=='object'||Array.isArray(body))return approved({error:'Invalid request'},400)
    const data=body as Record<string,unknown>
    if(!['mini','request','comment'].includes(String(data.target))||
       typeof data.id!=='string'||!UUID.test(data.id))return approved({error:'Invalid request'},400)
    target=data.target as Target;id=data.id
  }catch{return approved({error:'Invalid JSON'},400)}

  try {
    const db=service()
    const {data:auth,error:authError}=await db.auth.getUser(bearer)
    const actor=authError?null:auth.user?.id
    if(!actor)return approved({error:'Sign in required'},401)
    const {data,error}=await db.from(tables[target]).select('*').eq('id',id).maybeSingle()
    if(error||!data)return approved({error:'Item not found'},404)
    const item=data as PendingItem
    if(item[owners[target] as keyof PendingItem]!==actor)
      return approved({error:'Forbidden'},403)
    if(item.status==='approved')return approved({ok:true,published:true})
    if(item.status!=='pending')return approved({error:'This item is not awaiting a safety check.'},409)
    if(target==='mini'){
      const {data:eligible,error:eligibleError}=await db.rpc('mini_creator_can_submit',{p_user:actor})
      if(eligibleError||eligible!==true)return approved({error:'Public creator eligibility is required.'},403)
      if(!item.cover_path||!item.cover_path.startsWith(actor+'/'))
        return approved({error:'A private cover photo is required.'},422)
      if(item.request_id){
        const {data:valid}=await db.rpc('mini_request_available',{p_request:item.request_id})
        if(valid!==true)return approved({error:'The linked student request is unavailable.'},422)
      }
    }
    // Missing configuration is not a failed creator attempt.
    if(!process.env.MINI_GOOGLE_SAFETY_API_KEY?.trim())return approved({error:'Automatic safety checks are not configured. Your submission remains private.'},503)
    if(target==='mini'&&!item.updated_at)return approved({error:'Cannot verify the submission version.'},503)
    const {data:claimed,error:claimError}=await db.rpc('mini_safety_claim',{
      p_target:target,p_id:id,p_owner:actor,
    })
    if(claimError||claimed!==true)return approved({error:'A safety check is already running or the scan limit is reached.'},409)

    let verdict:SafetyVerdict
    try {
      let photo:{data:string;mimeType:string}|undefined
      if(target==='mini'&&item.cover_path){
        const {data:download,error:photoError}=await db.storage.from('mini-covers').download(item.cover_path)
        if(photoError||!download||download.size<100||download.size>5*1024*1024)
          throw new Error('Photo is unavailable for safety screening.')
        if(!['image/jpeg','image/png','image/webp'].includes(download.type))
          throw new Error('Unsupported photo type.')
        const bytes=Buffer.from(await download.arrayBuffer())
        photo={data:bytes.toString('base64'),mimeType:download.type}
      }
      const body=target==='request'?item.question??'':item.body??''
      const text=[body,...(item.tags??[]),item.quiz_question??'',...(item.quiz_options??[]),item.quiz_explanation??''].join('\n')
      verdict=await moderate({target,title:item.title??'',body:text,photo})
    }catch {
      await db.from('mini_safety_scans').update({
        verdict:'unavailable',reason:'Safety service unavailable',lease_until:new Date().toISOString(),
      }).eq('target',target).eq('target_id',id).eq('owner_id',actor)
      return approved({error:'Safety check unavailable. Your submission remains private; please retry.'},503)
    }
    const timestamp=new Date().toISOString()
    const changes:Record<string,unknown>={
      status:verdict.safe?'approved':'rejected',
      reviewed_at:timestamp,
    }
    if(target==='mini'){
      changes.published_at=verdict.safe?timestamp:null
      changes.moderation_note=verdict.safe?null:'Automated safety filter declined publication'
    }else if(target==='request'){
      changes.moderation_note=verdict.safe?null:'Automated safety filter declined publication'
      changes.updated_at=timestamp
    }
    let write=db.from(tables[target]).update(changes).eq('id',id).eq(owners[target],actor).eq('status','pending')
    // A creator can edit a pending Mini during a scan; never approve the changed version.
    if(target==='mini')write=write.eq('updated_at',item.updated_at!)
    const {data:changed,error:writeError}=await write.select('id').maybeSingle()
    if(writeError||!changed){
      await db.from('mini_safety_scans').update({verdict:'unavailable',reason:'Version changed or write unavailable',lease_until:new Date().toISOString()}).eq('target',target).eq('target_id',id).eq('owner_id',actor)
      return approved({error:'Unable to complete safety review. Content remains private; retry the current version.'},503)
    }
    await db.from('mini_safety_scans').update({
      verdict:verdict.safe?'approved':'rejected',
      reason:verdict.reason,
      model:'cloud-natural-language-plus-vision',
      checked_at:timestamp,lease_until:timestamp,
    }).eq('target',target).eq('target_id',id).eq('owner_id',actor)
    return approved({ok:true,published:verdict.safe,
      message:verdict.safe?'Published to Mini Lessons.':'This submission did not pass the automatic safety check. You can revise and try again.'})
  }catch {return approved({error:'Safety screening temporarily unavailable. Submission remains private.'},503)}
}
