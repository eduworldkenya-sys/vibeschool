import { supabase } from "@/lib/supabase"

const sb = supabase as any

export type HQDepartment = { key:string; name:string; mandate:string; icon:string|null; open_count:number; critical_count:number; waiting_approval_count:number }
export type HQWorkItem = { id:string; department_key:string; work_type:string; priority:"low"|"normal"|"high"|"critical"; status:"open"|"in_progress"|"waiting_approval"|"resolved"|"cancelled"; title:string; summary:string|null; source_type:string|null; source_id:string|null; route:string|null; approval_required:boolean; due_at:string|null; evidence:Record<string,unknown>; created_at:string; updated_at:string; resolved_at:string|null }
export type HQMorningBrief = { generated_at:string; headline:{new_users_today:number;active_schools:number;lesson_plans_today:number;submissions_today:number;open_incidents:number;decisions_waiting:number;work_waiting_approval:number}; priorities:Array<{department:string;priority:string;title:string;summary:string|null;route:string|null}>; decisions:Array<{id:string;code:string;title:string;status:string}> }

export async function listHQDepartments(): Promise<HQDepartment[]> { const {data,error}=await sb.rpc("hq_list_departments"); if(error) throw error; return (data??[]) as HQDepartment[] }
export async function listHQWorkItems(department:string|null=null,limit=100): Promise<HQWorkItem[]> { const {data,error}=await sb.rpc("hq_list_work_items",{p_department:department,p_limit:limit}); if(error) throw error; return (data??[]) as HQWorkItem[] }
export async function createHQWorkItem(input:{department:string;title:string;summary?:string;priority?:HQWorkItem["priority"];dueAt?:string|null;approvalRequired?:boolean;route?:string|null;evidence?:Record<string,unknown>}){ const {data,error}=await sb.rpc("hq_create_work_item",{p_department:input.department,p_title:input.title,p_summary:input.summary??null,p_priority:input.priority??"normal",p_due_at:input.dueAt??null,p_approval_required:input.approvalRequired??false,p_route:input.route??null,p_evidence:input.evidence??{}}); if(error) throw error; return data as string }
export async function updateHQWorkItem(id:string,status:HQWorkItem["status"]){ const {error}=await sb.rpc("hq_update_work_item",{p_id:id,p_status:status}); if(error) throw error }
export async function loadHQMorningBrief(): Promise<HQMorningBrief>{ const {data,error}=await sb.rpc("hq_get_morning_brief"); if(error) throw error; return data as HQMorningBrief }
