import { supabase } from '@/lib/supabase'
import type { MiniPost } from './data'
import {parseMiniDeck,miniDeckText,type MiniSlideEntry} from './slides'
import { miniSubjectFromTags, parseMiniHashtags } from './tags'

export async function currentMiniUser(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser()
  return error ? null : data.user?.id ?? null
}

/**
 * Request immediate automated safety screening; publishing is never manually approved in HQ.
 * API is fail-closed if its release flag or classifier is unavailable.
 */
export class MiniSubmissionSavedError extends Error {
  readonly submissionId:string
  constructor(submissionId:string,message:string){super(message);this.name='MiniSubmissionSavedError';this.submissionId=submissionId;Object.setPrototypeOf(this,MiniSubmissionSavedError.prototype)}
}

export async function publishMiniSafely(target:'mini'|'request'|'comment',id:string):Promise<void> {
  const {data:{session},error:sessionError}=await supabase.auth.getSession()
  if(sessionError||!session?.access_token)throw Error('Sign in to publish.')
  let response:Response
  try{
    response=await fetch('/api/minis/safety',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},
      body:JSON.stringify({target,id}),
      cache:'no-store',
    })
  }catch{throw Error('Your submission is saved privately. Automatic safety checks are unavailable; retry later.')}
  const payload:unknown=await response.json().catch(()=>null)
  const result=payload&&typeof payload==='object'?payload as {error?:string;published?:boolean;message?:string}:null
  if(!response.ok)throw Error(result?.error||'Your submission is saved privately. Retry the automatic safety check.')
  if(result?.published!==true)throw Error(result?.message||'Content did not pass the automatic safety check.')
}

export async function miniIsVerifiedAdult(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('mini_adult_signal_allowed', { p_user: userId })
  return !error && data === true
}

export async function submitMini({
  title, body, hashtags, photo, slides, userId, challenge, requestId,
}: {
  title: string
  body: string
  hashtags: string
  photo?: File
  slides?: MiniSlideEntry[]
  userId: string
  requestId?: string | null
  challenge?: { question: string; options: string[]; correct: number; explanation: string } | null
}): Promise<string> {
  const cleanTitle = title.trim()
  if (requestId && !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(requestId)) throw Error('Invalid request link.')
  const cleanBody = body.trim()
  if (cleanTitle.length < 5 || cleanTitle.length > 100) throw Error('Use a title between 5 and 100 characters.')
  if (cleanBody.length < 40 || cleanBody.length > 3000) throw Error('Write a short, useful explanation of at least 40 characters.')
  const tags = parseMiniHashtags(hashtags)
  const subject = miniSubjectFromTags(tags)
  const question = challenge?.question.trim() || null
  const options = challenge ? challenge.options.map(option => option.trim()) : []
  const explanation = challenge?.explanation.trim() || null
  const correct = challenge?.correct ?? null
  if (challenge && (!question || question.length<10 || question.length>240 ||
    options.length<2 || options.length>4 || options.some(option=>option.length<1 || option.length>180) ||
    correct === null || !Number.isInteger(correct) || correct<0 || correct>=options.length ||
    !explanation || explanation.length<10 || explanation.length>500))
    throw Error('Complete the quick question, answer choices and explanation.')
  const deck=slides===undefined?null:parseMiniDeck(slides)
  if(slides!==undefined&&!deck)throw Error('Invalid slides.')
  if(Boolean(photo)===Boolean(deck))throw Error('Choose photo or slides.')
  if(deck&&[cleanTitle,cleanBody,...tags,question??'',...options,explanation??'',miniDeckText(deck)].join('\n').length>5000)throw Error('Shorten the presentation or description.')
  const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as Record<string,string>)[photo?.type??'']
  if (photo && (!ext || photo.size > 5 * 1024 * 1024 || photo.size < 100))
    throw Error('Choose a JPG, PNG or WebP photo under 5 MB.')

  const verified = await currentMiniUser()
  if (!verified || verified !== userId) throw Error('Sign in to submit your Mini Lesson.')

  const { data: canSubmit, error: eligibilityError } =
    await supabase.rpc('mini_creator_can_submit', { p_user: verified })
  if (eligibilityError || canSubmit !== true)
    throw Error('Public creators need an opted-in profile and independent age eligibility. Check your public profile settings.')

  const coverPath=photo?userId+'/'+crypto.randomUUID()+'.'+ext:null
  if(photo&&coverPath){const {error}=await supabase.storage.from('mini-covers').upload(coverPath,photo,{contentType:photo.type,cacheControl:'3600',upsert:false});if(error)throw Error('Unable to upload image.') }

  const { data: submitted, error: publishError } = await supabase.from('mini_lessons')
    .insert({ creator_id: userId, title: cleanTitle, body: cleanBody, subject, tags, quiz_question:question, quiz_options:options, quiz_correct:correct, quiz_explanation:explanation, cover_path: coverPath, ...(slides?{slide_deck:slides}:{}), status: 'pending', request_id: requestId ?? null })
    .select('id').single()
  if (publishError || !submitted?.id) {
    // Best-effort rollback of an unused, private file; the DB stays fail-closed.
    if(coverPath)await supabase.storage.from('mini-covers').remove([coverPath])
    throw Error('The Mini could not be submitted. Your profile may need additional verification.')
  }
  try {await publishMiniSafely('mini',submitted.id as string)}
  catch(error){throw new MiniSubmissionSavedError(submitted.id as string,error instanceof Error?error.message:'Saved privately. Check publication status.')}
  return submitted.id as string
}

export async function changeMiniInteraction(id: string, userId: string, kind: 'like' | 'save', on: boolean) {
  const verified = await currentMiniUser()
  if (!verified || verified !== userId) throw Error('Sign in to interact with Minis.')
  const result = on
    ? await supabase.from('mini_interactions').insert({ mini_id: id, user_id: verified, kind })
    : await supabase.from('mini_interactions').delete().eq('mini_id',id).eq('user_id',verified).eq('kind',kind)
  if (result.error && !(on && result.error.code === '23505')) throw Error('Could not update this Mini.')
}

export async function changeMiniFollow(creatorId: string, userId: string, on: boolean) {
  const verified = await currentMiniUser()
  if (!verified || verified !== userId) throw Error('Sign in to follow creators.')
  if (verified === creatorId) throw Error('You cannot follow your own profile.')
  const result = on
    ? await supabase.from('global_profile_follows').insert({ follower_id: verified, followed_id: creatorId })
    : await supabase.from('global_profile_follows').delete().eq('follower_id',verified).eq('followed_id',creatorId)
  if (result.error && !(on && result.error.code === '23505')) throw Error('Unable to update this follow.')
}

export async function addMiniComment(id: string, userId: string, body: string) {
  const verified = await currentMiniUser()
  if (!verified || verified !== userId) throw Error('Sign in to post a comment.')
  if (body.trim().length < 2 || body.trim().length > 500) throw Error('Comments must be between 2 and 500 characters.')
  const { data, error } = await supabase.from('mini_comments')
    .insert({ mini_id: id, author_id: verified, body: body.trim(), status: 'pending' })
    .select('id').single()
  if (error || !data?.id) throw Error('The comment could not be submitted.')
  await publishMiniSafely('comment',data.id as string)
}

export async function reportMini(id: string, userId: string, reason: string) {
  const verified = await currentMiniUser()
  if (!verified || verified !== userId) throw Error('Sign in to report content.')
  const allowed = ['incorrect','unsafe','spam','copyright','other']
  if (!allowed.includes(reason)) throw Error('Choose a valid reason.')
  const { error } = await supabase.from('mini_reports')
    .insert({ mini_id: id, reporter_id: verified, reason })
  if (error && error.code !== '23505') throw Error('Unable to submit report.')
}

export async function recordMiniLearningSignal(
  mini: MiniPost, userId: string, signal: 'understood' | 'not_interested',
) {
  const verified = await currentMiniUser()
  if (!verified || verified !== userId) throw Error('Sign in to save learning feedback.')
  if (!(await miniIsVerifiedAdult(verified))) throw Error('Learning preference tracking is available only for verified adults.')
  const day = new Date().toISOString().slice(0,10)
  const { error } = await supabase.from('mini_learning_signals')
    .insert({ user_id: verified, mini_id: mini.id, signal, occurred_on: day })
  if (error && error.code !== '23505') throw Error('Unable to record that feedback.')
}
