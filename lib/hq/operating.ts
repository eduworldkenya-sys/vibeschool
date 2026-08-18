import { supabase } from "@/lib/supabase"

const sb = supabase as any

export type HQSnapshot = {
  generated_at: string
  users: { total: number; today: number; teachers: number; learners: number }
  schools: { total: number; active: number; today: number }
  teaching: { lesson_plans_today: number; lesson_plans_7d: number; lessons_taught_today: number; homework_today: number; submissions_today: number; unreviewed_submissions: number }
  content: { publications_total: number; publications_live: number; publications_draft: number; reads_total: number }
  events: { today: number; last_hour: number }
  notifications: { unread: number; critical: number }
  incidents: { open: number }
}

export type HQNotificationClass = "digest" | "important" | "action_required" | "critical"
export type HQNotification = {
  id: string
  category: string
  severity: "info" | "success" | "warning" | "critical"
  notification_class: HQNotificationClass
  title: string
  body: string
  route: string | null
  action_label: string | null
  status: "unread" | "read" | "resolved"
  occurrence_count: number
  first_seen_at: string
  last_seen_at: string
  acknowledged_at: string | null
  source_type: string | null
  source_id: string | null
  metadata: Record<string, unknown>
  owner_department: string | null
  due_at: string | null
  escalation_level: number
  escalated_at: string | null
  work_item_id: string | null
  feedback: "useful" | "noise" | null
  feedback_at: string | null
  created_at: string
}
export type HQFounderBrief = {
  generated_at: string
  headline: {
    new_users_today: number
    new_users_yesterday: number
    active_critical: number
    action_required: number
    overdue: number
    opportunities: number
    open_incidents: number
    payment_failures_24h: number
  }
  priorities: Array<{
    id: string
    class: HQNotificationClass
    category: string
    title: string
    body: string
    route: string | null
    due_at: string | null
    owner_department: string | null
    work_item_id: string | null
  }>
  opportunities: Array<{
    id: string
    title: string
    body: string
    route: string | null
    metadata: Record<string, unknown>
  }>
}
export type HQDecision = { id:string; code:string; title:string; category:string; decision_type:string; status:"draft"|"reviewed"|"approved"|"locked"|"active"|"superseded"|"rolled_back"|"cancelled"; rule_key:string|null; rule_value:unknown; reason:string|null; affected_products:string[]; effective_at:string|null; approved_at:string|null; locked_at:string|null; supersedes_id:string|null; rollback_of_id:string|null; created_at:string; updated_at:string }
export type HQDecisionDetail = { decision:HQDecision; versions:Array<Record<string,unknown>>; targets:Array<{id:string;product_key:string;expected_config_key:string|null;expected_value:unknown;status:string;applied_at:string|null;verified_at:string|null;error:string|null}>; audit:Array<{id:string;action:string;actor_id:string|null;details:Record<string,unknown>;created_at:string}> }
export type HQExecutiveAnalytics = { generated_at:string; daily:Array<{date:string;signups:number;lesson_plans:number;homework:number;submissions:number}>; roles:Array<{role:string;count:number}>; schools:Array<{status:string;count:number}>; finance:{payments_30d:number;expenses_30d:number;publication_earnings:number}; communications:{parent_messages_30d:number;vc_messages_30d:number}; content:{publication_reads:number}; operations:{open_incidents:number;marking_backlog:number} }
export type HQDepartment = { key:string; name:string; mandate:string; icon:string|null; open_count:number; critical_count:number; waiting_approval_count:number }
export type HQWorkItem = { id:string; department_key:string; work_type:string; priority:"low"|"normal"|"high"|"critical"; status:"open"|"in_progress"|"waiting_approval"|"resolved"|"cancelled"; title:string; summary:string|null; source_type:string|null; source_id:string|null; route:string|null; approval_required:boolean; due_at:string|null; evidence:Record<string,unknown>; created_at:string; updated_at:string; resolved_at:string|null; owner_id:string|null; acted_at:string|null; verification_status:string|null; verification_evidence:Record<string,unknown>|null; action_taken:Record<string,unknown>|null }
export type HQWorkItemUpdate = { id:string; work_item_id:string; update_type:"note"|"question"|"answer"|"evidence"|"handoff"|"status"|"approval"|"correction"|"system"; body:string; actor_id:string|null; worker_id:string|null; metadata:Record<string,unknown>; created_at:string }
export type HQWorkItemLink = { id:string; work_item_id:string; link_type:"github_issue"|"github_pull_request"|"github_branch"|"github_commit"|"supabase_migration"|"artifact"|"evidence"|"runbook"; label:string; url:string; metadata:Record<string,unknown>; added_by:string|null; created_at:string }
export type HQWorkforceRunSummary = { id:string; lane_key:string; worker_id:string|null; trigger_type:string; status:string; authority_result:string|null; execution_evidence:Record<string,unknown>; started_at:string|null; completed_at:string|null; created_at:string }
export type HQWorkforceHandoffSummary = { id:string; handoff_key:string; from_lane_key:string; to_lane_key:string; from_worker_id:string|null; to_worker_id:string|null; reason:string; status:string; violation_code:string|null; created_at:string; accepted_at:string|null; completed_at:string|null }
export type HQWorkroomItem = { item:HQWorkItem; updates:HQWorkItemUpdate[]; links:HQWorkItemLink[]; runs:HQWorkforceRunSummary[]; handoffs:HQWorkforceHandoffSummary[] }
export type HQWorkroomAction = "start"|"submit_for_approval"|"authorize"|"request_correction"|"accept_verified"|"cancel"
export type HQMorningBrief = { generated_at:string; headline:{new_users_today:number;active_schools:number;lesson_plans_today:number;submissions_today:number;open_incidents:number;decisions_waiting:number;work_waiting_approval:number}; priorities:Array<{department:string;priority:string;title:string;summary:string|null;route:string|null}>; decisions:Array<{id:string;code:string;title:string;status:string}> }

export async function loadHQSnapshot(): Promise<HQSnapshot> { const {data,error}=await sb.rpc("hq_get_snapshot"); if(error) throw error; return data as HQSnapshot }
export async function loadHQExecutiveAnalytics(): Promise<HQExecutiveAnalytics> { const {data,error}=await sb.rpc("hq_get_executive_analytics"); if(error) throw error; return data as HQExecutiveAnalytics }
export async function loadHQNotifications(limit=100): Promise<HQNotification[]> { const {data,error}=await sb.rpc("hq_list_notifications",{p_limit:limit}); if(error) throw error; return (data??[]) as HQNotification[] }
export async function loadHQFounderBrief(): Promise<HQFounderBrief> { const {data,error}=await sb.rpc("hq_get_founder_brief"); if(error) throw error; return data as HQFounderBrief }
export async function markHQNotificationRead(id:string){ const {error}=await sb.rpc("hq_mark_notification_read",{p_id:id}); if(error) throw error }
export async function acknowledgeHQNotification(id:string){ const {error}=await sb.rpc("hq_acknowledge_notification",{p_id:id}); if(error) throw error }
export async function resolveHQNotification(id:string){ const {error}=await sb.rpc("hq_resolve_notification",{p_id:id}); if(error) throw error }
export async function setHQNotificationFeedback(id:string,feedback:"useful"|"noise"){ const {error}=await sb.rpc("hq_set_notification_feedback",{p_id:id,p_feedback:feedback}); if(error) throw error }
export async function openHQNotificationWorkroom(id:string): Promise<string|null>{ const {data,error}=await sb.rpc("hq_open_notification_workroom",{p_id:id}); if(error) throw error; return (data as string|null) }
export async function runHQRules(){ const {data,error}=await sb.rpc("hq_generate_operational_alerts"); if(error) throw error; return Number(data??0) }
export async function listHQDecisions(limit=100): Promise<HQDecision[]> { const {data,error}=await sb.rpc("hq_list_decisions",{p_limit:limit}); if(error) throw error; return (data??[]) as HQDecision[] }
export async function getHQDecisionDetail(id:string): Promise<HQDecisionDetail> { const {data,error}=await sb.rpc("hq_get_decision_detail",{p_id:id}); if(error) throw error; return data as HQDecisionDetail }
export async function getHQProductConfig(productKey:string,configKey:string){ const {data,error}=await sb.rpc("hq_get_product_config",{p_product_key:productKey,p_config_key:configKey}); if(error) throw error; return data }

export async function listHQDepartments(): Promise<HQDepartment[]> { const {data,error}=await sb.rpc("hq_list_departments"); if(error) throw error; return (data??[]) as HQDepartment[] }
export async function listHQWorkItems(department:string|null=null,limit=100): Promise<HQWorkItem[]> { const {data,error}=await sb.rpc("hq_list_work_items",{p_department:department,p_limit:limit}); if(error) throw error; return (data??[]) as HQWorkItem[] }
export async function createHQWorkItem(input:{department:string;title:string;summary?:string;priority?:HQWorkItem["priority"];dueAt?:string|null;approvalRequired?:boolean;route?:string|null;evidence?:Record<string,unknown>}){ const {data,error}=await sb.rpc("hq_create_work_item",{p_department:input.department,p_title:input.title,p_summary:input.summary??null,p_priority:input.priority??"normal",p_due_at:input.dueAt??null,p_approval_required:input.approvalRequired??false,p_route:input.route??null,p_evidence:input.evidence??{}}); if(error) throw error; return data as string }
export async function updateHQWorkItem(id:string,status:HQWorkItem["status"]){ const {error}=await sb.rpc("hq_update_work_item",{p_id:id,p_status:status}); if(error) throw error }
export async function loadHQMorningBrief(): Promise<HQMorningBrief>{ const {data,error}=await sb.rpc("hq_get_morning_brief"); if(error) throw error; return data as HQMorningBrief }
export async function getHQWorkroomItem(id:string):Promise<HQWorkroomItem>{const{data,error}=await sb.rpc("hq_workroom_get_item",{p_id:id});if(error)throw error;return data as HQWorkroomItem}
export async function addHQWorkroomUpdate(id:string,type:HQWorkItemUpdate["update_type"],body:string,metadata:Record<string,unknown>={}){const{data,error}=await sb.rpc("hq_workroom_add_update",{p_work_item_id:id,p_update_type:type,p_body:body,p_metadata:metadata});if(error)throw error;return data as string}
export async function addHQWorkroomLink(id:string,type:HQWorkItemLink["link_type"],label:string,url:string,metadata:Record<string,unknown>={}){const{data,error}=await sb.rpc("hq_workroom_add_link",{p_work_item_id:id,p_link_type:type,p_label:label,p_url:url,p_metadata:metadata});if(error)throw error;return data as string}
export async function actOnHQWorkroomItem(id:string,action:HQWorkroomAction,reason:string):Promise<HQWorkroomItem>{const{data,error}=await sb.rpc("hq_workroom_act",{p_work_item_id:id,p_action:action,p_reason:reason});if(error)throw error;return data as HQWorkroomItem}
