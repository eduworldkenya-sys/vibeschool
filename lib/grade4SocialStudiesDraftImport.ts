'use client'
import { getSupabaseClient } from '@/lib/supabase'
import { isMumbi2Publisher } from '@/lib/studioPublisherIdentity'
import { emptyPublication, emptyChapter, calcWordCount, calcReadingTime, type ContentBlock } from '@/lib/publishTypes'
import { publicationDraftToInsert, chapterDraftToInsert } from '@/lib/publicationDraftCodec'
import { uploadDraftMedia, removeVibePressMedia } from '@/lib/vibepressMedia'

type SourceSection = {number:number;title:string;sourceSection:string;sub_strand_id:string;cbc_strand:string;learning_outcomes:string[];sourceOutcomeIds:string[];blocks:ContentBlock[]}
type Asset = {sourceSection:string;title:string;alt:string;svg:string}
type Intake = {manuscript:{publication:{title:string;description:string};chapters:SourceSection[]};visuals:Asset[]}
const PUBLICATION_ID = '71a76cd8-f209-4f99-a1d0-7e5b66f42e43'
const TITLE = 'Grade 4 Social Studies'
function chapterId(n:number) { return '1bcfc25b-702d-4a21-9dc8-'+String(n).padStart(12,'0') }
function fail(reason:unknown): never { throw new Error(reason && typeof reason==='object' && 'message' in reason ? String(reason.message) : 'Draft import failed.') }
async function toPng(asset:Asset):Promise<File>{
 const url=URL.createObjectURL(new Blob([asset.svg],{type:'image/svg+xml'}))
 try {
  const image=new Image()
  await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('Diagram could not be rendered.'));image.src=url})
  const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Diagram canvas unavailable.')
  ctx.drawImage(image,0,0)
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Diagram conversion failed.')),'image/png'))
  return new File([blob],asset.sourceSection.replace('.','-')+'.png',{type:'image/png'})
 } finally {URL.revokeObjectURL(url)}
}
export async function importGrade4SocialStudiesDraft():Promise<string> {
 const sb=getSupabaseClient()
 const {data:{user},error:authError}=await sb.auth.getUser()
 if(authError||!user)throw new Error('Sign in as Mumbi2.')
 const {data:profile,error:roleError}=await sb.from('profiles').select('role').eq('id',user.id).maybeSingle()
 if(roleError||!isMumbi2Publisher(user.id,profile?.role))throw new Error('Authorized publisher required.')
 const response=await fetch('/api/teacher/studio/grade4-social-studies-draft',{cache:'no-store'})
 if(!response.ok)throw new Error('Could not load the private manuscript.')
 const intake=await response.json() as Intake
 const sections=intake.manuscript.chapters
 if(intake.manuscript.publication.title!==TITLE||sections.length!==19||new Set(sections.flatMap(c=>c.sourceOutcomeIds)).size!==72||intake.visuals.length!==6||sections.reduce((n,c)=>n+c.blocks.filter(b=>b.type==='question').length,0)!==95)throw new Error('Manuscript coverage mismatch.')
 const {data:books,error:bookError}=await sb.from('vibe_publications').select('id,title,status,author_id,format,cbc_grade,cbc_subject').eq('author_id',user.id).eq('format','vibetextbook')
 if(bookError)fail(bookError)
 const similar=(books??[]).find(b=>b.id!==PUBLICATION_ID && b.cbc_grade?.replace(/\s/g,'').toLowerCase()==='grade4'&&b.cbc_subject?.replace(/[\s_]/g,'').toLowerCase()==='socialstudies')
 if(similar)return similar.id
 const existing=(books??[]).find(b=>b.id===PUBLICATION_ID)
 if(existing&&(existing.title!==TITLE||existing.author_id!==user.id||existing.format!=='vibetextbook'))throw new Error('Existing publication identity conflict.')
 if(existing&&existing.status!=='draft')return existing.id
 if(!existing){
  const publication={...emptyPublication(user.id,'vibetextbook'),id:PUBLICATION_ID,title:TITLE,description:intake.manuscript.publication.description,genre:'academic' as const,cbc_grade:'grade4' as const,cbc_subject:'Social Studies',cbc_aligned:false}
  const {error}=await sb.from('vibe_publications').insert(publicationDraftToInsert(publication,0))
  if(error)fail(error)
 }
 const {data:prior,error:priorError}=await sb.from('vibe_chapters').select('id,number,sub_strand_id,status').eq('publication_id',PUBLICATION_ID)
 if(priorError)fail(priorError)
 if((prior??[]).some(c=>!sections.some(s=>chapterId(s.number)===c.id&&s.number===c.number&&s.sub_strand_id===c.sub_strand_id)||c.status!=='draft'))throw new Error('Existing chapter edits or identity conflict; open the draft instead of replacing it.')
 // One insert per section: interrupted uploads resume from persisted IDs; never overwrite editorial changes.
 for(const section of sections){
  const id=chapterId(section.number)
  if((prior??[]).some(c=>c.id===id))continue
  const blocks=section.blocks.map(b=>({...b}))
  const asset=intake.visuals.find(a=>a.sourceSection===section.sourceSection)
  let uploaded:string|undefined
  try{
   if(asset){
    uploaded=await uploadDraftMedia(sb,user.id,'images',await toPng(asset))
    const placement=blocks.findIndex(b=>b.type==='table')
    blocks.splice(placement<0?blocks.length:placement,0,{id:'vsg4sst-'+section.sourceSection.replace('.','-')+'-visual',type:'image',content:uploaded,meta:{alt:asset.alt,caption:asset.title}})
   }
   const c={...emptyChapter(PUBLICATION_ID,section.number),id,title:section.title,sub_strand_id:section.sub_strand_id,cbc_strand:section.cbc_strand,learning_outcomes:section.learning_outcomes,blocks,word_count:calcWordCount(blocks),reading_time_min:calcReadingTime(blocks)}
   const {error}=await sb.from('vibe_chapters').insert(chapterDraftToInsert(c))
   if(error)fail(error)
  }catch(error){
   if(uploaded){
    const {data:stored,error:lookupError}=await sb.from('vibe_chapters').select('id').eq('id',id).maybeSingle()
    if(!lookupError&&!stored)await removeVibePressMedia(sb,uploaded)
   }
   throw error
  }
 }
 const {data:confirmed,error:verifyError}=await sb.from('vibe_chapters').select('id,number,sub_strand_id,status').eq('publication_id',PUBLICATION_ID)
 if(verifyError)fail(verifyError)
 if(confirmed?.length!==19||sections.some(s=>!confirmed?.some(c=>c.id===chapterId(s.number)&&c.sub_strand_id===s.sub_strand_id&&c.status==='draft')))throw new Error('Draft import is incomplete. Retry to resume.')
 return PUBLICATION_ID
}
