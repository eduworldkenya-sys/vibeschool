/** Returns to the exact teacher-owned Lesson Notes route only for valid IDs.
 * This is navigation context, never a security or teaching-occurrence grant. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function dateIsReal(s:string|null):s is string {
 if(!s||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false
 const d=new Date(s+'T12:00:00Z')
 return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s
}
export function teachingKitBackHref(params:Pick<URLSearchParams,'get'>):string {
 const lessonPlanId=params.get('lessonPlanId')
 if(!lessonPlanId||!UUID.test(lessonPlanId))return '/teacher/lessonplan'
 const query=new URLSearchParams({lessonPlanId})
 for(const field of ['classId','subjectId','occurrenceId','timetableSlotId'] as const){
  const value=params.get(field)
  if(value&&UUID.test(value))query.set(field,value)
 }
 const date=params.get('date')
 if(dateIsReal(date))query.set('date',date)
 return '/teacher/lesson-notes?'+query.toString()
}
