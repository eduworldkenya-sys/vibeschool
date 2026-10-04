import { parseProgressQuery, resolveTeacherProgressQuery } from '@/lib/learner-intelligence/progress-query'
import { supabase } from '@/lib/supabase'
import { hqSupabase } from '@/lib/hq/supabase'
import { searchHQ } from '@/lib/hq/search'
import { getTwinAuthorityContext, requireTwinRole, selectTwinRoleBinding, type TwinRole } from './core'
import { deriveTwinLearningSignals, interpretTwinCommand, matchTwinLinks, normalizeTwinText, predictTwinNext, safeTwinRoute, twinScreenAction, type TwinLink, type TwinObservation } from './personal'
import { TWIN_REGISTRY } from './registry'
import { saveCanonicalExamResult } from '@/lib/teacher/examResultAuthority'
import { getTeacherTwinState } from '@/lib/teacher/twin'

import { twinRecord, twinRpc } from './transport'
export { twinRecord, twinRpc } from './transport'
const str = (v: unknown) => typeof v === 'string' ? v : ''
const rows = (v: unknown): Record<string, unknown>[] => Array.isArray(v) ? v.map(twinRecord) : []

/** Exhaust each authorized query or fail visibly; never report a truncated search as complete. */
export async function twinPages<T>(query:(from:number,to:number)=>PromiseLike<{data:T[]|null;error:{message:string}|null}>):Promise<T[]> {
  const result:T[]=[]
  for(let from=0;from<20000;from+=500){
    const page=await query(from,from+499)
    if(page.error)throw new Error(page.error.message)
    result.push(...(page.data??[]))
    if((page.data?.length??0)<500)return result
  }
  throw new Error('Too many records for one Twin search. Open the class or subject and search again.')
}
async function twinIdPages<T>(ids:string[],query:(ids:string[],from:number,to:number)=>PromiseLike<{data:T[]|null;error:{message:string}|null}>):Promise<T[]> {
  const result:T[]=[]
  for(let i=0;i<ids.length;i+=200)result.push(...await twinPages((from,to)=>query(ids.slice(i,i+200),from,to)))
  return result
}

export interface TwinSession { userId: string; role: TwinRole; scopeId: string; schoolId: string | null; classIds: string[]; studentIds: string[]; assignments: Assignment[] }
export interface Assignment { class_id: string; class_name: string; stream: string; subject_id: string; subject_name: string }
export interface MarkProposal { session: TwinSession; examId: string; classId: string; subjectId: string; studentId: string; score: number; expectedUpdatedAt: string | null; before: number | null; label: string; createdAt: number }
export interface PersonalTwinReply { text: string; links?: TwinLink[]; proposal?: MarkProposal; evidence?: string[] }

export async function openPersonalTwinSession(role: TwinRole): Promise<TwinSession> {
  if (role === 'hq') {
    const { data, error } = await hqSupabase.auth.getUser()
    if (error || !data.user) throw new Error('Sign in to HQ to use your Twin.')
    await twinRpc('hq','hq_check_owner_access',{p_surface:'hq-twin'})
    return { userId: data.user.id, role, scopeId:'vibeschool',schoolId:null,classIds:[],studentIds:[],assignments:[] }
  }
  const authority = await getTwinAuthorityContext()
  const bindings = requireTwinRole(authority,role)
  if (role === 'teacher') {
    const context = twinRecord(await twinRpc(role,'teacher_get_operating_context'))
    const schoolId = str(context.school_id)
    selectTwinRoleBinding(authority,role,schoolId)
    const assignments = rows(context.classes).flatMap(a => typeof a.class_id==='string' && typeof a.subject_id==='string' ? [{class_id:a.class_id,class_name:str(a.class_name),stream:str(a.stream),subject_id:a.subject_id,subject_name:str(a.subject_name)}] : [])
    return { userId:authority.userId, role,scopeId:schoolId,schoolId,classIds:Array.from(new Set(assignments.map(a=>a.class_id))),studentIds:[],assignments }
  }
  if (role === 'parent') return {userId:authority.userId,role,scopeId:authority.userId,schoolId:null,classIds:[],studentIds:Array.from(new Set(bindings.flatMap(b=>b.resourceIds))),assignments:[]}
  const binding = selectTwinRoleBinding(authority,role)
  return {userId:authority.userId,role,scopeId:binding.scopeId,schoolId:binding.schoolId,classIds:[],studentIds:role==='student'?[binding.scopeId]:[],assignments:[]}
}

function navLink(role: TwinRole, slug: string, title: string, detail = ''): TwinLink { return {id:`nav:${role}:${slug}`,title,detail,kind:'tool',route:`/${role}/${slug}`} }
export function personalTwinTools(role: TwinRole): TwinLink[] {
  if (role==='teacher') return TWIN_REGISTRY.filter(x=>x.type==='navigate' && x.route).map(x=>({id:x.id,title:x.label,detail:x.keywords.join(' '),route:x.route!,kind:'tool'}))
  const tools: Record<Exclude<TwinRole,'teacher'>, Array<[string,string,string?]>> = {
    student:[['timetable','Timetable'],['tasks','Homework and tasks'],['results','My released results'],['resources','Learning resources'],['twin','My learning workspace']],
    parent:[['students','My children'],['report-cards','Child attendance and learning progress'],['messages','Messages'],['settings','Settings']],
    admin:[['academics','Classes'],['students','Students'],['teachers','Teachers'],['timetable','Timetable'],['attendance','Attendance'],['academics','School results'],['settings','Settings']],
    hq:[['workroom','Workroom'],['schools','Schools'],['content','Content'],['workforce','Workers'],['operations','Operations'],['billing','Finance'],['company','Settings']],
  }
  return tools[role].map(([slug,title,detail])=>navLink(role,slug,title,detail))
}

export async function searchPersonalTwin(session: TwinSession, query: string, currentClassId?: string): Promise<PersonalTwinReply> {
  const toolMatches = matchTwinLinks(query, personalTwinTools(session.role))
  if (session.role==='hq') {
    const results = await searchHQ(query,20)
    return {text:results.length?'Here are the matching HQ records.':'No matching HQ record was found.',links:[...results.map(r=>({id:r.result_id,title:r.title,detail:r.subtitle??'',kind:r.result_type,route:r.route})),...toolMatches].filter(l=>safeTwinRoute(l.route,'hq'))}
  }
  if (session.role==='student') {
    const result = twinRecord(await twinRpc('student','student_twin_search_school_records',{p_query:query,p_limit:20}))
    const links = rows(result.items).flatMap(r=>{const route=str(r.route)||str(r.action_url);return safeTwinRoute(route,'student')?[{id:str(r.id)||str(r.key),title:str(r.title)||str(r.label),detail:str(r.subtitle)||str(r.description),route,kind:str(r.type)||'learning'}]:[]})
    return {text:links.length?'Here is what I found in your learning records.':'No matching learning record was found. Try a subject, lesson title or task name.',links:[...links,...toolMatches]}
  }
  if (session.role==='parent') {
    const dashboards = await Promise.all(session.studentIds.map(id=>twinRpc('parent','get_parent_child_dashboard',{p_student_id:id})))
    const children = dashboards.map(twinRecord).map(d=>twinRecord(d.child)).map(c=>({id:str(c.id),title:str(c.name),detail:[str(c.school_name),str(c.class_name)].join(' · '),kind:'child',route:`/parent/child/${encodeURIComponent(str(c.id))}`}))
    const matched = matchTwinLinks(query,children)
    return {text:matched.length?'Here are your matching children.':'No matching child was found in your active family links.',links:[...matched,...toolMatches]}
  }
  let classIds = session.classIds
  let classLinks: TwinLink[] = []
  if (session.role==='teacher') {
    classLinks = Array.from(new Map(session.assignments.map(a=>[a.class_id,{id:a.class_id,title:`${a.class_name} ${a.stream}`.trim(),detail:session.assignments.filter(b=>b.class_id===a.class_id).map(b=>b.subject_name).join(', '),kind:'class',route:`/teacher/classhub/${a.class_id}`}])).values())
  } else {
    const result=await twinPages((from,to)=>supabase.from('classes').select('id,name,stream').eq('school_id',session.schoolId!).order('id').range(from,to))
    classIds=result.map(c=>c.id)
    classLinks=result.map(c=>({id:c.id,title:`${c.name} ${c.stream??''}`.trim(),detail:'School class',kind:'class',route:`/admin/academics?classId=${c.id}`}))
  }
  if(currentClassId){
    if(!classIds.includes(currentClassId))throw new Error('This class is outside your current school role. Choose an assigned class.')
    classIds=[currentClassId]
  }
  const links: TwinLink[] = [...toolMatches,...matchTwinLinks(query,classLinks)]
  if(classIds.length===0)return {text:'Connect a class and subject to search classroom records.',links}
  // Current enrollment is the canonical roster; never students.class_id/profile hints.
  const enrollments=await twinPages((from,to)=>supabase.from('student_classes').select('student_id,class_id').eq('school_id',session.schoolId!).in('class_id',classIds).eq('is_current',true).order('id').range(from,to))
  const ids=Array.from(new Set(enrollments.map(e=>e.student_id)))
  if(ids.length) {
    const learners=await twinIdPages(ids,(batch,from,to)=>supabase.from('students').select('id,name,admission_number').in('id',batch).is('deleted_at',null).order('id').range(from,to))
    const learnerLinks=learners.map(s=>{const classId=enrollments.find(e=>e.student_id===s.id)?.class_id;return{id:s.id,title:s.name,detail:s.admission_number??'Current learner',kind:'student',route:session.role==='teacher'?`/teacher/classhub/${classId}/student/${s.id}`:`/admin/students/${s.id}`}})
    links.push(...matchTwinLinks(query,learnerLinks))
  }
  if(session.role==='teacher') {
    const [lessons,homework,exams,schemes]=await Promise.all([
      twinPages((from,to)=>supabase.from('lesson_plans').select('id,title,topic,class_id,status').eq('school_id',session.schoolId!).eq('teacher_id',session.userId).in('class_id',classIds).order('id').range(from,to)),
      twinPages((from,to)=>supabase.from('homework').select('id,title,subject,class_id,due_date').eq('school_id',session.schoolId!).eq('teacher_id',session.userId).in('class_id',classIds).order('id').range(from,to)),
      twinPages((from,to)=>supabase.from('exams').select('id,name,exam_type,term,academic_year').eq('school_id',session.schoolId!).order('id').range(from,to)),
      twinPages((from,to)=>supabase.from('scheme_of_work').select('id,topic,subject,class_id,week').eq('school_id',session.schoolId!).eq('teacher_id',session.userId).in('class_id',classIds).order('id').range(from,to)),
    ])
    const records: TwinLink[]=[
      ...lessons.map(l=>({id:l.id,title:l.title??l.topic??'Lesson',detail:`${l.topic??''} · ${l.status??''}`,kind:'lesson',route:`/teacher/lesson-notes?lessonPlanId=${l.id}`})),
      ...homework.map(h=>({id:h.id,title:h.title,detail:`${h.subject} · due ${h.due_date}`,kind:'homework',route:`/teacher/classhub/${h.class_id}/homework/${h.id}`})),
      ...exams.map(e=>({id:e.id,title:e.name,detail:`${e.exam_type} · Term ${e.term} · ${e.academic_year}`,kind:'exam',route:`/teacher/results?examId=${e.id}${currentClassId?`&classId=${currentClassId}`:''}`})),
      ...schemes.flatMap(s=>{const matches=session.assignments.filter(a=>a.class_id===s.class_id&&nameMatches(s.subject??'',a.subject_name));return matches.length===1?[{id:s.id,title:s.topic??'Scheme item',detail:`${s.subject} · Week ${s.week}`,kind:'scheme',route:`/teacher/scheme?classId=${s.class_id}&subjectId=${matches[0].subject_id}&week=${s.week}`}]:[]}),
    ]
    links.push(...matchTwinLinks(query,records))
    return {text:`${links.length?'Here is what I found.':'No matching record was found in this school and teaching context.'}`,links:links.slice(0,30)}
  }
  return {text:links.length?'Here is what I found in your school.':'No matching school record was found.',links:links.slice(0,30)}
}

function nameMatches(query: string, name: string) {
  const tokens=normalizeTwinText(query).split(' ')
  const target=normalizeTwinText(name).split(' ')
  return tokens.every(t=>target.includes(t==='maths'||t==='math'?'mathematics':t))
}

export async function prepareTwinMark(session: TwinSession,intent: Extract<ReturnType<typeof interpretTwinCommand>,{kind:'mark'}>,classHint?:string,examHint?:string):Promise<PersonalTwinReply> {
  if(session.role!=='teacher')return {text:'Exam scores can only be changed from your authorized Teacher role.'}
  let assignments=session.assignments.filter(a=>nameMatches(intent.subject,a.subject_name))
  if(classHint)assignments=assignments.filter(a=>a.class_id===classHint)
  if(!assignments.length)return {text:'No assigned class and subject match. Check the subject name and active school.'}
  const classIds=Array.from(new Set(assignments.map(a=>a.class_id)))
  const enrollments=await twinPages((from,to)=>supabase.from('student_classes').select('student_id,class_id').eq('school_id',session.schoolId!).in('class_id',classIds).eq('is_current',true).order('id').range(from,to))
  const ids=Array.from(new Set(enrollments.map(e=>e.student_id)))
  if(!ids.length)return {text:'These classes have no current learners.'}
  const learners=await twinIdPages(ids,(batch,from,to)=>supabase.from('students').select('id,name').in('id',batch).is('deleted_at',null).order('id').range(from,to))
  const targets=learners.filter(s=>nameMatches(intent.student,s.name)).flatMap(learner=>assignments.filter(a=>enrollments.some(e=>e.student_id===learner.id&&e.class_id===a.class_id)).map(assignment=>({learner,assignment})))
  const unique=Array.from(new Map(targets.map(t=>[`${t.learner.id}:${t.assignment.class_id}:${t.assignment.subject_id}`,t])).values())
  if(unique.length!==1)return {text:unique.length?'More than one learner, class or subject matches. Open the intended class marks sheet and use the full name.':'No current learner matches that name in your assigned classes.'}
  const {learner,assignment}=unique[0]
  const exams=await twinPages((from,to)=>supabase.from('exams').select('id,name,exam_type,is_locked,term,academic_year').eq('school_id',session.schoolId!).order('id').range(from,to))
  const matchingExams=exams.filter(e=>(!examHint||e.id===examHint)&&nameMatches(intent.exam,`${e.name} ${e.exam_type}`))
  if(matchingExams.length!==1)return {text:matchingExams.length?'Several assessments match. Open the intended CAT/exam in Results, then repeat.':'No matching CAT/exam was found. Use its exact name.'}
  const exam=matchingExams[0]
  if(exam.is_locked)return {text:'This exam is locked. The score cannot be changed.'}
  const existing=await supabase.from('exam_results').select('marks,updated_at,teacher_id,is_absent').eq('exam_id',exam.id).eq('subject_id',assignment.subject_id).eq('student_id',learner.id).maybeSingle()
  if(existing.error)throw new Error(existing.error.message)
  if(existing.data && existing.data.teacher_id!==session.userId)return {text:'This result was recorded by another teacher. Open the marks sheet for the appropriate review.'}
  const label=`${learner.name} · ${assignment.subject_name} · ${exam.name} · Term ${exam.term}, ${exam.academic_year}`
  return {text:`Set ${label} to ${intent.score}/100?${existing.data?` Current record: ${existing.data.is_absent?'absent':`${existing.data.marks}/100`}.`:''}`,proposal:{session,examId:exam.id,classId:assignment.class_id,subjectId:assignment.subject_id,studentId:learner.id,score:intent.score,expectedUpdatedAt:existing.data?.updated_at??null,before:existing.data?.marks??null,label,createdAt:Date.now()}}
}

async function teacherLearningSignals(session:TwinSession,query:string,classHint?:string,examHint?:string):Promise<PersonalTwinReply> {
  let assignments=session.assignments
  if(classHint)assignments=assignments.filter(a=>a.class_id===classHint)
  const subjectMatches=assignments.filter(a=>normalizeTwinText(query).includes(normalizeTwinText(a.subject_name)) || (/\bmaths?\b/.test(query)&&a.subject_name.toLowerCase()==='mathematics'))
  if(subjectMatches.length)assignments=subjectMatches
  if(!assignments.length)return{text:'No authorized teaching context is available. Connect a class and subject first.'}
  const classes=Array.from(new Set(assignments.map(a=>a.class_id)))
  const [roster,exams,resultRows]=await Promise.all([
    twinPages((from,to)=>supabase.from('student_classes').select('student_id,class_id').eq('school_id',session.schoolId!).in('class_id',classes).eq('is_current',true).order('id').range(from,to)),
    twinPages((from,to)=>supabase.from('exams').select('id,name,term,academic_year,created_at').eq('school_id',session.schoolId!).order('academic_year',{ascending:false}).order('term',{ascending:false}).order('created_at',{ascending:false}).order('id').range(from,to)),
    twinPages((from,to)=>supabase.from('exam_results').select('student_id,class_id,subject_id,exam_id,marks,is_absent').eq('school_id',session.schoolId!).in('class_id',classes).order('id').range(from,to)),
  ])
  const ids=Array.from(new Set(roster.map(s=>s.student_id)))
  if(!ids.length)return{text:'There are no current learner enrollments in this teaching context.'}
  const learners=await twinIdPages(ids,(batch,from,to)=>supabase.from('students').select('id,name').in('id',batch).is('deleted_at',null).order('id').range(from,to))
  const names=new Map(learners.map(l=>[l.id,l.name]))
  const examOrder=new Map(exams.map((e,i)=>[e.id,exams.length-i]))
  const authorized=resultRows.filter(r=>assignments.some(a=>a.class_id===r.class_id&&a.subject_id===r.subject_id)&&roster.some(s=>s.student_id===r.student_id&&s.class_id===r.class_id)&&examOrder.has(r.exam_id)&&(!examHint||r.exam_id===examHint))
  const thresholdMatch=query.match(/\b(?:below|under|less than)\s+(\d+(?:\.\d+)?)\b/)
  const threshold=thresholdMatch?Number(thresholdMatch[1]):40
  if(threshold<0||threshold>100)return{text:'Use a score threshold from 0 to 100.'}
  let signals=deriveTwinLearningSignals(authorized.map(r=>({studentId:r.student_id,classId:r.class_id,subjectId:r.subject_id,score:Number(r.marks),isAbsent:r.is_absent,examId:r.exam_id,examOrder:examOrder.get(r.exam_id)!})),threshold)
  if(/\b(dropped|declin|falling)\w*\b/.test(query))signals=signals.filter(s=>s.kind==='declining_scores')
  const links=signals.slice(0,30).map((s,i)=>{const assignment=assignments.find(a=>a.class_id===s.classId&&a.subject_id===s.subjectId)!;return{id:`signal:${i}`,title:`${names.get(s.studentId)??'Learner'} · ${assignment.subject_name}`,detail:s.evidence[0],kind:'support signal',route:`/teacher/classhub/${assignment.class_id}/student/${s.studentId}`}})
  return{text:signals.length?`${signals.length} learner/subject records may need a closer look. Open a learner to review the evidence and plan support.`:'No matching support signal appears in the scored records available here. Missing marks or absent learners are not treated as zero scores.',links,evidence:['Uses current enrollments and authorized subject assignments.','Assessment order uses academic year, term, then exam creation order; it does not prove when each test was sat.',`Reviewed ${authorized.length} scored/absence records across ${exams.length} assessments.`,...signals.slice(0,5).flatMap(s=>s.evidence)]}
}

export async function executePersonalTwin(input:string,role:TwinRole,path:string,lastLinks:TwinLink[]=[]):Promise<PersonalTwinReply|null> {
  const progressIntent=role==='teacher' ? parseProgressQuery(input) : null
  const intent=interpretTwinCommand(input)
  // Preserve learner private-space search, coaching and evidence-backed learning
  // memory in the existing deterministic tutor; activity memory augments it.
  if(role==='student' && ['domain','search','unsupported'].includes(intent.kind))return null
  if(!progressIntent&&intent.kind==='domain'&&!/\b(search|find|student|learner|class|exam|cat|lesson|scheme|homework|resource|below|under|struggling|support|dropped|declining|falling|weakest)\b/.test(intent.query))return null
  const session=await openPersonalTwinSession(role)
  const url=new URL(path,'https://vibeschool.co.ke')
  const classHint=url.searchParams.get('classId')??url.pathname.match(/\/classhub\/([a-f0-9-]{36})/)?.[1]
  if(progressIntent) {
    const reply=await resolveTeacherProgressQuery(input,classHint)
    if(reply)return {text:reply.text,links:reply.actionUrl?[{id:'progress-query',title:reply.actionLabel??'Open progress',detail:'Authorized learner evidence',kind:'progress',route:reply.actionUrl}]:[]}
  }
  const scopeArgs={p_role:role,p_scope_id:session.scopeId}
  if(intent.kind==='help')return{text:'Search by a name, class, subject, lesson, homework or exam. Say “open my timetable”, “record 40 marks for Sifuna in Maths CAT”, “continue where I stopped”, “my memory” or “what next”. I use your current role and permissions. You can pause learning, clear remembered activity and choose collective learning. Unsupported changes require the original tool.'}
  if(intent.kind==='unsupported')return{text:intent.reason,links:matchTwinLinks(input,personalTwinTools(role))}
  if(intent.kind==='mark')return prepareTwinMark(session,intent,classHint,url.searchParams.get('examId')??undefined)
  if(role==='teacher' && /\b(below|under|struggling|need support|dropped|declining|falling scores|weakest)\b/.test(normalizeTwinText(input)))return teacherLearningSignals(session,normalizeTwinText(input),classHint,url.searchParams.get('examId')??undefined)
  if(intent.kind==='forget') {const count=await twinRpc(role,'twin_forget_activity');return{text:`Forgot ${count} personal activity observations. School records and learning evidence are preserved.`}}
  if (intent.kind==='navigate') {
    const links=matchTwinLinks(intent.query,personalTwinTools(role))
    if (links.length) return {text:'Choose the tool you want to open.',links}
  }
  if (intent.kind==='search'||intent.kind==='navigate'||intent.kind==='domain') return searchPersonalTwin(session,intent.query,classHint)
  const memory=twinRecord(await twinRpc(role,'twin_get_personal_memory',scopeArgs))
  const settings=twinRecord(memory.settings)
  if(intent.kind==='preference') {
    await twinRpc(role,'twin_set_personal_settings',{p_enabled:intent.enabled??settings.enabled!==false,p_collective:intent.collective??settings.collective===true})
    return{text:intent.enabled===false?'Personal activity learning is paused.':intent.enabled===true?'Personal activity learning is on.':intent.collective?'Collective learning is enabled. Only coarse activity patterns from large opt-in cohorts can be shared.':'Your activity is excluded from collective learning.'}
  }
  const observations: TwinObservation[]=rows(memory.observations).flatMap(o=>typeof o.id==='string' && o.role===role && o.scope_id===session.scopeId && typeof o.route==='string' && safeTwinRoute(o.route,role) && typeof o.action==='string' && typeof o.created_at==='string' && Number.isFinite(Date.parse(o.created_at)) ? [{id:o.id,role,scope_id:session.scopeId,route:o.route,action:o.action,previous_action:typeof o.previous_action==='string'?o.previous_action:null,created_at:o.created_at}] : [])
  if(intent.kind==='memory')return{text:`Activity learning: ${settings.enabled===false?'paused':'on'}. Collective contribution: ${settings.collective===true?'on':'off'}. I retain up to 90 days of product activity categories in your current role and scope. I do not record raw search text, names, scores or private notes in this activity memory.\n${observations.slice(0,8).map(o=>`${o.action.replaceAll('_',' ')} · ${new Date(o.created_at).toLocaleDateString('en-KE',{timeZone:'Africa/Nairobi'})}`).join('\n')||'No activity remembered yet.'}`}
  if(intent.kind==='continue') {
    const link=lastLinks.find(l=>safeTwinRoute(l.route,role))
    const recent=observations.find(o=>safeTwinRoute(o.route,role))
    return {text:link?'Here is the item you were just working with.':recent?'Here is your most recent working area.':'No recent working area is available.',links:link?[link]:recent?[navLink(role,recent.route.split('/').slice(2).join('/'),recent.action.replaceAll('_',' '))]:[]}
  }
  if(intent.kind==='predict') {
    const predictions=predictTwinNext(observations,role,session.scopeId)
    if(predictions.length)return {text:predictions.map(p=>p.title).join('\n'),evidence:predictions.flatMap(p=>p.evidence),links:predictions.map((p,i)=>({id:`prediction:${i}`,title:p.title,detail:`${p.confidence} preference pattern`,route:p.route,kind:'suggestion'}))}
    if(role==='teacher') {
      const state=await getTeacherTwinState()
      const decision=state.decision.now
      return {text:decision?`${decision.title}. ${decision.reason??''}`:'There is not enough activity history to predict your next action. Continue using VibeSchool normally.',evidence:decision?.reasonChain,links:decision?.actionUrl?[{id:'school-priority',title:decision.actionLabel??'Open',detail:'Current school evidence',route:decision.actionUrl,kind:'priority'}]:[]}
    }
    const latest=observations[0]
    if(latest) {
      const hints=rows(await twinRpc(role,'twin_collective_hints',{...scopeArgs,p_previous_action:latest.action}))
      if(hints.length)return{text:'These working areas are commonly used next by a large opt-in group. This is a general suggestion, not a prediction about you.',links:hints.filter(h=>safeTwinRoute(str(h.route),role)).map(h=>({id:`collective:${str(h.action)}`,title:str(h.action).replaceAll('_',' '),detail:'General activity pattern',route:str(h.route),kind:'suggestion'}))}
    }
    return{text:'There is not enough evidence yet to predict your next action. Missing activity does not mean poor performance.'}
  }
  return null
}

export async function observePersonalTwin(role:TwinRole,path:string,action?:string):Promise<void> {
  const session=await openPersonalTwinSession(role)
  const pathname=new URL(path,'https://vibeschool.co.ke').pathname
  if (!safeTwinRoute(pathname,role)) return
  const screen=twinScreenAction(pathname)
  // Store a template, never a learner UUID, query string or private document path.
  const route=`/${role}/${pathname.split('/').filter(Boolean)[1]??'home'}`
  await twinRpc(role,'twin_observe_activity',{p_role:role,p_scope_id:session.scopeId,p_route:route,p_action:action??screen,p_event_key:crypto.randomUUID()})
}

export async function confirmPersonalTwinMark(proposal:MarkProposal):Promise<PersonalTwinReply> {
  if(Date.now()-proposal.createdAt>5*60000)throw new Error('This review expired. Repeat the command to check the current record.')
  const fresh=await openPersonalTwinSession('teacher')
  if(fresh.userId!==proposal.session.userId || fresh.scopeId!==proposal.session.scopeId)throw new Error('Your identity or school changed. Repeat the command in the correct school.')
  const data=await saveCanonicalExamResult({examId:proposal.examId,schoolId:fresh.schoolId!,classId:proposal.classId,subjectId:proposal.subjectId,studentId:proposal.studentId,marks:proposal.score,isAbsent:false,expectedUpdatedAt:proposal.expectedUpdatedAt})
  window.dispatchEvent(new CustomEvent('vibeschool:record-saved',{detail:{kind:'exam_result'}}))
  return {text:`${proposal.label}: ${proposal.score}/100 saved and verified.`,links:[{id:str(data.id),title:'Open marks sheet',detail:'Saved result',kind:'exam',route:`/teacher/results?examId=${proposal.examId}&classId=${proposal.classId}&subjectId=${proposal.subjectId}`} ]}
}
