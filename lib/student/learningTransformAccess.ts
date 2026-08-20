import { supabase } from '@/lib/supabase'

export type LearningTransformAccess='learner'|'signed_out'|'account_without_learner'|'unavailable'

export async function getLearningTransformAccess():Promise<LearningTransformAccess>{
  try{
    const{data:{user}}=await supabase.auth.getUser()
    if(!user)return'signed_out'
    const{data,error}=await supabase.rpc('current_student_id')
    if(error)return'unavailable'
    return typeof data==='string'&&data.length>0?'learner':'account_without_learner'
  }catch{return'unavailable'}
}
