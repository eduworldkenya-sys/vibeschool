import {supabase} from '@/lib/supabase';
import type {Data} from '@/lib/class-workbook/model';
import type {Event} from './model';
export async function loadEvents(data:Data):Promise<Event[]>{
 const all:Event[]=[];for(let offset=0;offset<20000;offset+=500){const response=await supabase.from('teacher_learner_events').select('id,student_id,subject_id,event_kind,note,due_at,resolved_at,created_at,created_by').eq('school_id',data.schoolId).eq('class_id',data.classId).is('archived_at',null).order('created_at').order('id').range(offset,offset+499);if(response.error)throw new Error(response.error.message);all.push(...response.data??[]);if((response.data?.length??0)<500)return all;}throw new Error('There are too many activity records to open at once.');
}
export async function recordAction(data:Data,ids:string[],subjectId:string,note:string,kind:'observation'|'participation'|'recognition'|'followup'|'parent_contact'|'management',due:string,requestId:string){
 if(!ids.length||!note.trim()||note.length>2000)throw new Error('Choose learners and write a short factual note.');
 const response=await supabase.rpc('teacher_record_class_action',{p_class_id:data.classId,p_subject_id:subjectId||null,p_student_ids:ids,p_kind:kind,p_note:note.trim(),p_due_date:due||null,p_request_id:requestId});if(response.error)throw new Error(response.error.message);if(response.data!==ids.length)throw new Error('The saved actions could not be confirmed. Reload before retrying.');
}
export async function resolveAction(event:Event){const r=await supabase.from('teacher_learner_events').update({resolved_at:new Date().toISOString()}).eq('id',event.id).eq('created_by',event.created_by).select('id,resolved_at').single();if(r.error||!r.data?.resolved_at)throw new Error(r.error?.message??'The follow-up was not updated. Reload and try again.');}
