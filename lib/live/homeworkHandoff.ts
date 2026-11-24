const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function validLiveHomeworkRoom(id:string):boolean{return UUID.test(id)}
export function liveHomeworkDraft(value:unknown,roomId:string):{title:string;instructions:string}{
 if(!validLiveHomeworkRoom(roomId)||!value||typeof value!=='object')throw Error('Invalid Live lesson.')
 const room=value as {id?:unknown;teacher?:unknown;mode?:unknown;status?:unknown;title?:unknown;history?:unknown}
 if(room.id!==roomId||room.teacher!==true||room.mode!=='school'||room.status!=='ended'||typeof room.title!=='string'||!Array.isArray(room.history))throw Error('The ended Live lesson is not available in this teaching class.')
 const questions:string[]=[]
 for(const row of room.history){
  if(!row||typeof row!=='object'||!['quiz','exercise'].includes(row.kind)||typeof row.body!=='string')continue
  const body=row.body.trim()
  if(!body||questions.includes(body)||questions.length>=10)continue
  questions.push(body.slice(0,900))
 }
 const lines:string[]=[]
 for(const q of questions){const next=(lines.length+1)+'. '+q;if([...lines,next].join('\n\n').length>4000)break;lines.push(next)}
 return {title:room.title.trim().slice(0,105)+' · Homework',instructions:lines.join('\n\n')}
}
export function liveHomeworkLink(classId:string,roomId:string,planId:string|null,occurrenceId:string|null):string|null{
 if(!UUID.test(classId)||!UUID.test(roomId)||(planId!==null&&!UUID.test(planId))||(occurrenceId!==null&&!UUID.test(occurrenceId)))return null
 const query=new URLSearchParams({liveRoomId:roomId})
 if(planId)query.set('lessonPlanId',planId)
 if(occurrenceId)query.set('occurrenceId',occurrenceId)
 return '/teacher/classhub/'+encodeURIComponent(classId)+'/homework?'+query.toString()
}
