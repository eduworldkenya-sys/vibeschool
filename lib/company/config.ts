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

type UntypedRpc = <T = unknown>(name: string, args?: Record<string, unknown>) => PromiseLike<{ data: T | null; error: { message?: string } | null }>
const rpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc

/** Canonical runtime company-policy evaluation API. */
export async function evaluateCompanyPolicy<T>(productKey:string,policyKey:string,context:Record<string,unknown>={}):Promise<PolicyEvaluation<T>>{
  const {data,error}=await rpc<PolicyEvaluation<T>>("hq_evaluate_policy",{p_product_key:productKey,p_policy_key:policyKey,p_context:context})
  if(error) throw new Error(error.message || "Policy evaluation failed")
  if(!data) throw new Error("Policy evaluation returned no data")
  return data
}

/** Runtime acknowledgement proves that the product reached a policy-enforcement stage. */
export async function acknowledgeCompanyPolicy<T>(productKey:string,policyKey:string,value:T,stage:"received"|"evaluated"|"enforced"="enforced"){
  const {error}=await rpc("hq_ack_policy",{p_product_key:productKey,p_policy_key:policyKey,p_value:value,p_stage:stage})
  if(error) throw new Error(error.message || "Policy acknowledgement failed")
}

/** Backward-compatible value reader. Governed product surfaces should prefer evaluateCompanyPolicy. */
export async function getCompanyConfig<T>(productKey:string,configKey:string,fallback:T):Promise<T>{
  try{return (await evaluateCompanyPolicy<T>(productKey,configKey)).value}
  catch{return fallback}
}
