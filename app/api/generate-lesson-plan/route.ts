import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAnthropicMessagesAdapter, invokeGovernedCyborgModel } from '@/lib/cyborg/gateway'
import { parseGeneratedLessonPlan } from '@/lib/teaching/lessonPlanCodec'

function getAdminSupabase() { const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL; const serviceRoleKey=process.env.SUPABASE_SERVICE_ROLE_KEY; if(!supabaseUrl||!serviceRoleKey) throw new Error('Supabase server credentials are not configured'); return createClient(supabaseUrl,serviceRoleKey,{auth:{autoRefreshToken:false,persistSession:false}}) }
const CREDIT_COST=1, FREE_CREDITS=3
export async function POST(req: NextRequest) {
 try {
  const supabaseAdmin=getAdminSupabase(); const authHeader=req.headers.get('authorization')??''; const token=authHeader.startsWith('Bearer ')?authHeader.slice(7):''; if(!token) return NextResponse.json({error:'Unauthorized'},{status:401})
  const {data:{user},error:authError}=await supabaseAdmin.auth.getUser(token); if(authError||!user) return NextResponse.json({error:'Unauthorized'},{status:401}); const teacherId=user.id
  const [{data:profile},{data:teacherAssignment}]=await Promise.all([supabaseAdmin.from('profiles').select('role').eq('id',teacherId).maybeSingle(),supabaseAdmin.from('teacher_classes').select('id').eq('teacher_id',teacherId).limit(1).maybeSingle()]); if(profile?.role!=='teacher'||!teacherAssignment) return NextResponse.json({error:'Forbidden'},{status:403})
  let {data:wallet}=await supabaseAdmin.from('vibe_credits').select('balance, total_earned, total_spent').eq('teacher_id',teacherId).maybeSingle()
  if(!wallet){ const {data:newWallet}=await supabaseAdmin.from('vibe_credits').insert({teacher_id:teacherId,balance:FREE_CREDITS,total_earned:FREE_CREDITS,total_spent:0}).select('balance, total_earned, total_spent').single(); wallet=newWallet; await supabaseAdmin.from('vibe_credit_transactions').insert({teacher_id:teacherId,type:'gift',feature:'signup_bonus',amount:FREE_CREDITS,balance_after:FREE_CREDITS,notes:'Free credits on first AI use'}) }
  if(!wallet||wallet.balance<CREDIT_COST) return NextResponse.json({error:'insufficient_credits',balance:wallet?.balance??0,required:CREDIT_COST,message:'You have no Vibe Credits. Buy credits to generate lesson plans.'},{status:402})
  const {prompt}=await req.json(); if(!prompt) return NextResponse.json({error:'Missing prompt'},{status:400})
  const missionId=req.headers.get('x-cyborg-mission-id')?.trim()||`lesson-plan:${teacherId}:${crypto.randomUUID()}`; const adapter=createAnthropicMessagesAdapter(process.env.ANTHROPIC_API_KEY??'')
  const response=await invokeGovernedCyborgModel(adapter,{provider:'anthropic',model:'claude-sonnet-4-6',missionId,metadata:{maxTokens:2000,feature:'lesson-plan',teacherId},messages:[{role:'user',content:prompt}]})
  const anthropicData=response.output as {content?:Array<{type:string;text?:string}>}; const text=anthropicData.content?.map(b=>b.text??'').join('')??''; const parsed:unknown=JSON.parse(text.replace(/```json|```/g,'').trim()); const plan=parseGeneratedLessonPlan(parsed)
  if(!plan) return NextResponse.json({error:'invalid_lesson_plan_contract',message:'The generator returned an invalid lesson-plan format.'},{status:502})
  const newBalance=wallet.balance-CREDIT_COST; await supabaseAdmin.from('vibe_credits').update({balance:newBalance,total_spent:wallet.total_spent+CREDIT_COST,updated_at:new Date().toISOString()}).eq('teacher_id',teacherId); await supabaseAdmin.from('vibe_credit_transactions').insert({teacher_id:teacherId,type:'spend',feature:'lesson_plan',amount:-CREDIT_COST,balance_after:newBalance,notes:'Generated lesson plan'})
  return NextResponse.json({plan,missionId,cyborgCapability:response.capabilityJti,credits:{used:CREDIT_COST,balance:newBalance,was:wallet.balance}})
 } catch(e:unknown){ return NextResponse.json({error:e instanceof Error?e.message:'Unknown error'},{status:500}) }
}
