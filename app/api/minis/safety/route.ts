import 'server-only'
import { createHash } from 'node:crypto'
import { validTeacherMiniPhoto } from '@/lib/minis/teacher-photo'
import { MINI_ID } from '@/lib/minis/public-url'
import { validateMiniVoice } from '@/lib/minis/voice'
import {miniSlidesEnabled} from '@/lib/minis/slide-release'
import {parseMiniDeck,miniDeckText} from '@/lib/minis/slides'
import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

const NO_STORE = { 'Cache-Control':'private, no-store', 'X-Content-Type-Options':'nosniff' }
type Target = 'mini' | 'request' | 'comment'
type SafetyVerdict = { safe: boolean; reason: string }
type PendingItem = { id:string; status:string; creator_id?:string; requester_id?:string; author_id?:string;
  slide_deck?:unknown; updated_at?:string; title?:string; body?:string; question?:string; cover_path?:string|null; audio_path?:string|null; tags?:string[]; request_id?:string|null;
  publication_method?:string|null; quiz_question?:string|null; quiz_options?:string[]; quiz_explanation?:string|null }
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
  let text=[input.title,input.body].join('\n').trim()
  if(!text||text.length>5000)throw new Error('Invalid safety input.')
  const contact=/https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?254|0)[17]\d{8}/i
  if(contact.test(text))return {safe:false,reason:'Contact information or links are not allowed'}
  // In public student requests, avoid school and learner identifying details.
  if(input.target==='request'&&/\b(my|our)\s+(school|phone|address|teacher's\s+phone)\b/i.test(text))
    return {safe:false,reason:'Remove identifying personal details'}
  const headers={'Content-Type':'application/json','x-goog-api-key':key}
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
    if(detectedText.trim())text+='\n'+detectedText
    if(text.length>12000)throw new Error('Image text exceeds safety screening limit.')
  }
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
  const seen=new Set<string>()
  for(const item of report.moderationCategories){
    if(typeof item.name!=='string'||typeof item.confidence!=='number'||!Number.isFinite(item.confidence)||item.confidence<0||item.confidence>1||seen.has(item.name))
      throw new Error('Invalid text safety category.')
    seen.add(item.name)
    if(Object.prototype.hasOwnProperty.call(thresholds,item.name)&&item.confidence>=thresholds[item.name])
      return {safe:false,reason:'Content did not meet the safety policy'}
  }
  if(Object.keys(thresholds).some(category=>!seen.has(category)))throw new Error('Missing text safety categories.')
  return {safe:true,reason:'Automated screening passed'}
}

// Speech recognition is an additional prerequisite, never a replacement for text/image screening.
async function inspectVoice(db:SupabaseClient,path:string,actor:string):Promise<{text:string;hash:string}> {
  if(!path.startsWith(actor+'/')||!MINI_ID.test(path.slice(actor.length+1,-4))||!path.endsWith('.wav'))throw Error('Invalid voice path.')
  const key=process.env.MINI_GOOGLE_SPEECH_API_KEY
  if(!key)throw Error('Voice safety checks unavailable.')
  const {data,error}=await db.storage.from('mini-voice').download(path)
  if(error||!data||data.type!=='audio/wav'||data.size>1920044)throw Error('Voice unavailable.')
  const bytes=Buffer.from(await data.arrayBuffer())
  validateMiniVoice(bytes)
  const response=await fetch('https://speech.googleapis.com/v1/speech:recognize',{
    method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},
    cache:'no-store',signal:AbortSignal.timeout(20000),
    body:JSON.stringify({config:{encoding:'LINEAR16',sampleRateHertz:16000,audioChannelCount:1,languageCode:'en-KE',alternativeLanguageCodes:['sw-KE'],enableAutomaticPunctuation:true,profanityFilter:false,maxAlternatives:1},audio:{content:bytes.toString('base64')}})
  })
  if(!response.ok)throw Error('Voice recognition unavailable.')
  const result=await response.json() as {results?:{alternatives?:{transcript?:string;confidence?:number}[]}[]}
  if(!Array.isArray(result.results)||!result.results.length)throw Error('No recognizable speech.')
  const texts=result.results.map(r=>{
    const best=r.alternatives?.[0]
    if(typeof best?.transcript!=='string'||!best.transcript.trim()||typeof best.confidence!=='number'||!Number.isFinite(best.confidence)||best.confidence<0.75||best.confidence>1)throw Error('Voice recognition uncertain.')
    return best.transcript.trim()
  })
  const text=texts.join(' ')
  if(!text||text.length>5000)throw Error('Voice transcript unavailable.')
  return {text,hash:createHash('sha256').update(bytes).digest('hex')}
}

async function releaseTeacherPhoto(db: SupabaseClient, item: PendingItem, actor: string) {
  if (process.env.MINI_TEACHER_PHOTO_POSTING_ENABLED !== 'true')
    return approved({error:'Teacher posting is paused. Your draft is private.'},503)
  const {data:eligible,error:eligibilityError}=await db.rpc('mini_teacher_photo_public',{p_user:actor})
  if (eligibilityError) return approved({error:'Unable to verify teacher posting eligibility.'},503)
  if (eligible !== true) return approved({error:'A verified adult teacher account and public profile are required.'},403)
  if (item.status === 'approved') return approved({ok:true,published:true})
  if (item.status !== 'draft') return approved({error:'This Mini cannot be posted.'},409)
  const cover = item.cover_path
  const extension = cover?.split('.').at(-1)
  if (!cover || !extension || cover !== actor+'/'+item.id+'.'+extension ||
      !item.updated_at || item.slide_deck != null || item.audio_path || item.request_id)
    return approved({error:'This draft requires a valid private photo.'},422)
  const {data:photo,error:downloadError}=await db.storage.from('mini-covers').download(cover)
  if (downloadError || !photo) return approved({error:'Could not read your photo. Reopen the draft to upload it again.'},422)
  if (!await validTeacherMiniPhoto(photo, extension))
    return approved({error:'The cover must be a valid JPG, PNG or WebP photo under 5 MB.'},422)
  const {data:published,error}=await db.rpc('mini_release_teacher_photo',{
    p_actor:actor,p_id:item.id,p_version:item.updated_at,p_cover:cover,
  })
  if (error || published !== true) return approved({error:'Could not post this draft. Check your public profile and try again.'},409)
  return approved({ok:true,published:true})
}

export async function POST(request:NextRequest) {
  if(process.env.MINI_LESSONS_OPEN_PUBLISHING_ENABLED!=='true' &&
     process.env.MINI_TEACHER_PHOTO_POSTING_ENABLED!=='true')
    return approved({error:'Publishing is not yet available.'},503)
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
       typeof data.id!=='string'||!MINI_ID.test(data.id))return approved({error:'Invalid request'},400)
    target=data.target as Target;id=data.id
  }catch{return approved({error:'Invalid JSON'},400)}
  if(target!=='mini' && process.env.MINI_LESSONS_OPEN_PUBLISHING_ENABLED!=='true')
    return approved({error:'Publishing is not yet available.'},503)

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
    if(target==='mini' && item.publication_method==='teacher_direct_photo')
      return await releaseTeacherPhoto(db,item,actor)
    if(process.env.MINI_LESSONS_OPEN_PUBLISHING_ENABLED!=='true')
      return approved({error:'Publishing is not yet available.'},503)
    if(item.status==='approved')return approved({ok:true,published:true})
    if(item.status!=='pending')return approved({error:'This item is not awaiting a safety check.'},409)
    if(target==='mini'){
      const {data:eligible,error:eligibleError}=await db.rpc('mini_creator_can_submit',{p_user:actor})
      if(eligibleError||eligible!==true)return approved({error:'Public creator eligibility is required.'},403)
      if(item.slide_deck!=null){if(!miniSlidesEnabled()||process.env.MINI_LESSON_SLIDES_PUBLISHING_ENABLED!=='true')return approved({error:'Slide publishing is not yet available.'},503);if(item.cover_path||!parseMiniDeck(item.slide_deck))return approved({error:'Invalid slides.'},422)}else if(!item.cover_path||!item.cover_path.startsWith(actor+'/'))return approved({error:'A private cover photo is required.'},422)
      if(item.request_id){
        const {data:valid}=await db.rpc('mini_request_available',{p_request:item.request_id})
        if(valid!==true)return approved({error:'The linked student request is unavailable.'},422)
      }
    }
    // Missing configuration is not a failed creator attempt.
    if(!process.env.MINI_GOOGLE_SAFETY_API_KEY?.trim())return approved({error:'Safety checks are unavailable. Your submission remains private.'},503)
    if(target==='mini'&&!item.updated_at)return approved({error:'Cannot verify the submission version.'},503)
    const {data:claimed,error:claimError}=await db.rpc('mini_safety_claim',{
      p_target:target,p_id:id,p_owner:actor,
    })
    if(claimError||claimed!==true)return approved({error:'A safety check is already running or the scan limit is reached.'},409)

    let verdict:SafetyVerdict
    let voiceHash:string|null=null
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
      const deck=target==='mini'&&item.slide_deck!=null?parseMiniDeck(item.slide_deck):null
      if(target==='mini'&&item.slide_deck!=null&&!deck)throw Error('Invalid slides.')
      const text=[body,...(item.tags??[]),item.quiz_question??'',...(item.quiz_options??[]),item.quiz_explanation??'',...(deck?[miniDeckText(deck)]:[])].join('\n')
      verdict=await moderate({target,title:item.title??'',body:text,photo})
      if(verdict.safe&&target==='mini'&&item.audio_path){
        const voice=await inspectVoice(db,item.audio_path,actor)
        verdict=await moderate({target,title:'Voice narration',body:voice.text})
        if(verdict.safe)voiceHash=voice.hash
      }
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
      if(item.audio_path)changes.audio_sha256=voiceHash
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
