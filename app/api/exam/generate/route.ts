import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabaseServer'
import { invokeCyborgBoundary } from '@/lib/cyborg/http-client'

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_WINDOW_MS = 60_000
const RATE_MAX_CALLS = 10
function checkRateLimit(ip: string): boolean {
  const now = Date.now(); const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) { rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS }); return true }
  if (entry.count >= RATE_MAX_CALLS) return false
  entry.count++; return true
}

const ALLOWED_SUBJECTS = new Set(['Mathematics','English','Biology','Chemistry','History','Physics','Geography','Kiswahili','CRE','Business Studies'])
const ALLOWED_FORMS = new Set(['Form 1','Form 2','Form 3','Form 4'])
const ALLOWED_DIFFICULTIES = new Set(['easy','medium','hard'])
const MIN_POOL_SIZE = 30
const SUBJECT_CONTEXT: Record<string, string> = {
  Mathematics: 'Write all numbers and expressions as plain text (e.g. "x^2 + 3x - 4", "3/4", "sqrt(16)"). Base calculations on real KCSE paper style: define variables, show units, use Kenyan currency (Ksh) for commercial arithmetic.',
  English: 'Write comprehension passages in clear Standard Kenyan English. Grammar questions must test real KCSE Paper 1 and 2 structures. Vocabulary should reflect KCSE set books and oral literature where relevant.',
  Biology: 'Use correct biological terminology aligned with KNEC KCSE Biology syllabus. Reference local Kenyan ecosystems, diseases common in Kenya (malaria, typhoid), and local flora/fauna where relevant.',
  Chemistry: 'Use IUPAC nomenclature aligned with KNEC Chemistry syllabus. Write chemical equations as plain text (e.g. "2H2 + O2 -> 2H2O"). Reference Kenyan industrial chemistry (soda ash, cement, fertilisers).',
  Physics: 'Write all equations as plain text (e.g. "F = ma", "v^2 = u^2 + 2as"). Use SI units throughout. Reference Kenyan contexts (hydroelectric power at Masinga Dam, solar energy). KCSE Physics Paper 1 and Paper 2 style.',
  Geography: 'Reference Kenyan geography specifically: Rift Valley, Lake Victoria, Mt Kenya, Mombasa port. KNEC Geography Paper 1 (Physical) and Paper 2 (Human and Economic). Map features described in words.',
  Kiswahili: 'Andika maswali kwa Kiswahili sanifu. Tumia muundo wa kawaida wa mtihani wa KCSE Kiswahili. Maswali ya sarufi, ufahamu, na fasihi yafuate mtaala wa KNEC.',
  CRE: 'Questions must align with the KNEC CRE syllabus covering Old Testament, New Testament, and Christian Living. Reference specific Bible passages by book, chapter and verse. Include Kenyan Christian context where relevant.',
  History: "Cover KNEC History and Government syllabus precisely. Reference specific Kenyan historical events, leaders, dates, and policies. Government questions should reflect Kenya's constitutional structure post-2010.",
  'Business Studies': 'Cover KNEC Business Studies syllabus including Commerce, Accounting, Economics principles. Use Kenyan business context: M-Pesa, NSE, Kenya Revenue Authority. Financial calculations use Ksh.',
}
const DIFFICULTY_INSTRUCTIONS: Record<string, string> = {
  easy: 'Questions test direct recall and basic application. Single-step problems. Distractors are clearly wrong to a prepared student. Suitable for revision starters.',
  medium: 'Questions test understanding and standard application. Two or three steps required. Distractors include common misconceptions. This is the core KCSE exam standard.',
  hard: 'Questions test higher-order thinking: analysis, synthesis, multi-step reasoning, common exam traps. Distractors are close to the correct answer. Modelled on the hardest questions from recent KCSE papers (2018–2023).',
}
interface BankQuestion { id:string; question:string; options:string[]; correct_index:number; explanation:string; teaching_note:string; hint:string|null; topic:string }
function toClientShape(row: BankQuestion, i: number) { return { id:`q${i+1}`,question:row.question,options:row.options as [string,string,string,string],correctIndex:row.correct_index,explanation:row.explanation,teachingNote:row.teaching_note,topic:row.topic,hint:row.hint??'',bankId:row.id } }

async function generateThroughCyborg(subject:string, form:string, safeTopic:string, difficulty:string, count:number, requestedMissionId?:string) {
  const subjectCtx=SUBJECT_CONTEXT[subject]??''; const diffCtx=DIFFICULTY_INSTRUCTIONS[difficulty]??''
  const systemPrompt=`You are a senior KNEC KCSE examiner with 15 years of experience setting the official Kenya Certificate of Secondary Education examinations. You output ONLY raw valid JSON arrays — no markdown, no backticks, no preamble, no trailing text. Every question you write has appeared or could appear in a real KCSE paper.`
  const userPrompt=`Generate exactly ${count} KCSE ${subject} multiple choice questions.\nForm: ${form}\nTopic: "${safeTopic}"\nDifficulty: ${difficulty}\n\nSUBJECT RULES:\n${subjectCtx}\n\nDIFFICULTY RULES:\n${diffCtx}\n\nQUESTION QUALITY RULES:\n1. Every question must be unambiguous — only ONE option is definitively correct.\n2. All four options must be plausible. Never use "All of the above" or "None of the above".\n3. Options should be similar in length and grammatical structure.\n4. Vary the correct answer position across questions.\n5. Vary question types: definition, calculation, application, error identification.\n\nEXPLANATION RULES:\n1. explanation: 2-3 sentences walking through WHY the correct answer is right.\n2. teachingNote: 1-2 sentences — the core concept a student must nail to never get this wrong again.\n3. hint: One subtle nudge toward the solution. Do NOT reveal the answer or full method.\n\nReturn ONLY this JSON array:\n[{"id":"q1","question":"...","options":["A text","B text","C text","D text"],"correctIndex":0,"explanation":"...","teachingNote":"...","topic":"${safeTopic}","hint":"..."}]`
  const result=await invokeCyborgBoundary({actorKey:'service:app.exam-generate',externalChatId:requestedMissionId||`exam-generate:${crypto.randomUUID()}`,objective:`Generate governed ${subject} ${form} exam top-up`,missionId:requestedMissionId,callerServiceId:'app.exam-generate',provider:'groq',model:'llama-3.3-70b-versatile',maxTokens:4096,messages:[{role:'system',content:systemPrompt},{role:'user',content:userPrompt}],metadata:{feature:'vibeexam',subject,form,topic:safeTopic,difficulty,count},dataClassification:'internal'})
  const data=result.output as {choices?:Array<{message?:{content?:string}}>}; const text=(data.choices?.[0]?.message?.content??'').trim()
  const startIdx=text.indexOf('['), endIdx=text.lastIndexOf(']'); if(startIdx===-1||endIdx===-1) throw new Error('AI returned an invalid response')
  const parsed:unknown[]=JSON.parse(text.substring(startIdx,endIdx+1)); if(!Array.isArray(parsed)||!parsed.length) throw new Error('AI returned empty questions')
  const validated=parsed.filter((q):q is Record<string,unknown>=>typeof q==='object'&&q!==null).filter(q=>typeof q.question==='string'&&Array.isArray(q.options)&&q.options.length===4&&typeof q.correctIndex==='number'&&q.correctIndex>=0&&q.correctIndex<=3&&typeof q.explanation==='string'&&typeof q.teachingNote==='string').map(q=>({question:String(q.question).trim(),options:(q.options as Array<unknown>).map(o=>String(o).trim()),correctIndex:Number(q.correctIndex),explanation:String(q.explanation).trim(),teachingNote:String(q.teachingNote).trim(),hint:typeof q.hint==='string'?String(q.hint).trim():''}))
  if(validated.length<Math.floor(count*0.7)) throw new Error('AI returned too many invalid questions')
  return {questions:validated,missionId:result.missionId,lineage:result.lineage}
}

export async function POST(req: NextRequest) {
  const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()??'unknown'
  if(!checkRateLimit(ip)) return NextResponse.json({error:'Too many requests. Please wait a minute before generating another exam.'},{status:429})
  try {
    const supabase=getSupabaseServerClient(); const body=await req.json(); const {subject,form,topic,difficulty,count}=body
    if(!ALLOWED_SUBJECTS.has(subject)) return NextResponse.json({error:'Invalid subject'},{status:400})
    if(!ALLOWED_FORMS.has(form)) return NextResponse.json({error:'Invalid form'},{status:400})
    if(!ALLOWED_DIFFICULTIES.has(difficulty)) return NextResponse.json({error:'Invalid difficulty'},{status:400})
    if(!topic||typeof topic!=='string'||topic.length>80) return NextResponse.json({error:'Invalid topic'},{status:400})
    const safeTopic=topic.replace(/[^a-zA-Z0-9 \-,().'\/&]/g,'').trim(); if(!safeTopic) return NextResponse.json({error:'Invalid topic'},{status:400})
    const safeCount=Math.min(Math.max(parseInt(String(count),10)||10,5),30)
    const {data:poolCount,error:countErr}=await supabase.rpc('count_bank_questions',{p_subject:subject,p_form:form,p_topic:safeTopic,p_difficulty:difficulty})
    if(countErr) console.error('[VibeExam] Bank count error:',countErr.message)
    const currentPoolSize=typeof poolCount==='number'?poolCount:0
    let cyborgLineage:unknown=null; let missionId:string|undefined
    if(currentPoolSize<MIN_POOL_SIZE){
      try{
        const requestedMissionId=req.headers.get('x-cyborg-mission-id')?.trim()||undefined
        const fresh=await generateThroughCyborg(subject,form,safeTopic,difficulty,20,requestedMissionId); missionId=fresh.missionId; cyborgLineage=fresh.lineage
        const rows=fresh.questions.map(q=>({subject,form,topic:safeTopic,difficulty,question:q.question,options:q.options,correct_index:q.correctIndex,explanation:q.explanation,teaching_note:q.teachingNote,hint:q.hint||null,source:'ai_generated'}))
        const {error:insertErr}=await supabase.from('exam_question_bank').insert(rows); if(insertErr) console.error('[VibeExam] Bank insert error:',insertErr.message)
      }catch(genErr){ console.error('[VibeExam] Cyborg top-up failed:',(genErr as Error).message); if(currentPoolSize===0) return NextResponse.json({error:'Unable to generate questions right now. Please try again shortly.'},{status:500}) }
    }
    const {data:bankRows,error:fetchErr}=await supabase.rpc('get_bank_questions',{p_subject:subject,p_form:form,p_topic:safeTopic,p_difficulty:difficulty,p_count:safeCount})
    if(fetchErr||!bankRows||bankRows.length===0){ console.error('[VibeExam] Bank fetch error:',fetchErr?.message); return NextResponse.json({error:'No questions available for this topic yet. Please try again shortly.'},{status:500}) }
    const questions=(bankRows as BankQuestion[]).map(toClientShape); const ids=(bankRows as BankQuestion[]).map(r=>r.id)
    supabase.rpc('bump_bank_served',{p_ids:ids}).then(({error})=>{if(error) console.error('[VibeExam] bump_bank_served failed:',error.message)})
    return NextResponse.json({questions,missionId,lineage:cyborgLineage})
  } catch(e:unknown){ const msg=e instanceof Error?e.message:'Unknown error'; console.error('[VibeExam] Generate error:',msg); return NextResponse.json({error:msg},{status:500}) }
}
