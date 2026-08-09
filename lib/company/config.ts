import { supabase } from "@/lib/supabase"

export type PolicyEvaluation<T> = {
  value: T
  policyKey: string
  productKey: string
  decisionId: string | null
  version: number | null
  reason: "company_policy" | "registry_default" | string
  fallbackUsed: boolean
  failureMode: "fail_open" | "fail_closed" | "last_known_good"
}

/**
 * Canonical company-policy evaluation API.
 * Products consume policy through this contract instead of querying HQ tables.
 * The backend validates type/range/product ownership and records evaluation evidence.
 */
export async function evaluateCompanyPolicy<T>(productKey:string,policyKey:string,context:Record<string,unknown>={}):Promise<PolicyEvaluation<T>>{
  const {data,error}=await supabase.rpc("hq_evaluate_policy",{p_product_key:productKey,p_policy_key:policyKey,p_context:context})
  if(error) throw error
  return data as PolicyEvaluation<T>
}

/** Product acknowledgement is evidence that the runtime reached a policy stage. */
export async function acknowledgeCompanyPolicy<T>(productKey:string,policyKey:string,value:T,stage:"received"|"evaluated"|"enforced"="enforced"){
  const {error}=await supabase.rpc("hq_ack_policy",{p_product_key:productKey,p_policy_key:policyKey,p_value:value,p_stage:stage})
  if(error) throw error
}

/** Backward-compatible reader. New governed behavior should use evaluateCompanyPolicy. */
export async function getCompanyConfig<T>(productKey:string,configKey:string,fallback:T):Promise<T>{
  try{return (await evaluateCompanyPolicy<T>(productKey,configKey)).value}
  catch{return fallback}
}
