import {serve} from "https://deno.land/std@0.224.0/http/server.ts";
import {createClient} from "https://esm.sh/@supabase/supabase-js@2.43.4";

// Sandbox-only; requires verify_jwt=false at deployment because Safaricom
// cannot present a Supabase user JWT. A long callback secret, an isolated
// database and a separate Daraja STK status query are all required.
// No callback body alone is ever proof of payment.
type Json=Record<string,unknown>;
function respond(body:unknown,status=200){
  return new Response(JSON.stringify(body),{status,headers:{
    "Content-Type":"application/json","Cache-Control":"no-store",
  }});
}
function obj(value:unknown):Json{
  if(!value||typeof value!=="object"||Array.isArray(value))throw Error("invalid_payload");
  return value as Json;
}
function env(name:string):string{
  const value=Deno.env.get(name)?.trim();
  if(!value)throw Error("missing_configuration:"+name);
  return value;
}
function secretMatches(candidate:string,secret:string):boolean{
  if(candidate.length<32||candidate.length!==secret.length)return false;
  let difference=0;
  for(let i=0;i<secret.length;i++)difference|=candidate.charCodeAt(i)^secret.charCodeAt(i);
  return difference===0;
}
function callbackInfo(value:unknown){
  const cb=obj(obj(value).Body).stkCallback;
  const data=obj(cb),checkout=data.CheckoutRequestID,merchant=data.MerchantRequestID;
  const code=data.ResultCode;
  if(typeof checkout!=="string"||!(/^[A-Za-z0-9_-]{6,160}$/).test(checkout)
    ||typeof merchant!=="string"||!(/^[A-Za-z0-9_-]{6,160}$/).test(merchant)
    ||typeof code!=="number"||!Number.isInteger(code)||code<0||code>99999)
      throw Error("invalid_callback_envelope");
  const metadata=data.CallbackMetadata==null?[]:obj(data.CallbackMetadata).Item;
  if(!Array.isArray(metadata)||metadata.length>20)throw Error("invalid_callback_metadata");
  const fields=new Map<string,unknown>();
  for(const raw of metadata){
    const item=obj(raw);
    if(typeof item.Name!=="string"||fields.has(item.Name))throw Error("duplicate_callback_metadata");
    fields.set(item.Name,item.Value);
  }
  const amount=fields.get("Amount"),phone=fields.get("PhoneNumber"),
        receipt=fields.get("MpesaReceiptNumber");
  if(amount!=null&&(!Number.isSafeInteger(amount)||Number(amount)<1))
    throw Error("invalid_callback_amount");
  const normalized=phone==null?null:String(phone).replace(/[\s+()-]/g,"");
  if(normalized!=null&&!/^254[17][0-9]{8}$/.test(normalized))
    throw Error("invalid_callback_phone");
  if(receipt!=null&&(typeof receipt!=="string"||!/^[A-Za-z0-9]{6,30}$/.test(receipt)))
    throw Error("invalid_callback_receipt");
  if(code===0&&(typeof amount!=="number"||normalized==null||receipt==null))
    throw Error("missing_paid_evidence");
  return {
    checkout,merchant,code,amount:amount==null?null:Number(amount),
    phone:normalized,receipt:receipt==null?null:String(receipt),
    eventKey:"wish:"+checkout+":"+code+":"+(receipt??"none"),
  };
}
async function safaricomQuery(checkout:string):Promise<number|null>{
  const host="https://sandbox.safaricom.co.ke";
  const consumer=env("MPESA_CONSUMER_KEY"),secret=env("MPESA_CONSUMER_SECRET");
  const shortcode=env("MPESA_SHORTCODE"),passkey=env("MPESA_PASSKEY");
  const oauth=await fetch(host+"/oauth/v1/generate?grant_type=client_credentials",{
    headers:{Authorization:"Basic "+btoa(consumer+":"+secret)},
    signal:AbortSignal.timeout(12000),redirect:"error",cache:"no-store",
  });
  if(!oauth.ok)return null;
  const token=String(obj(await oauth.json()).access_token??"");
  if(token.length<8)return null;
  const timestamp=new Date(Date.now()+3*3600000).toISOString().replace(/\D/g,"").slice(0,14);
  const password=btoa(shortcode+passkey+timestamp);
  const result=await fetch(host+"/mpesa/stkpushquery/v1/query",{
    method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
    body:JSON.stringify({BusinessShortCode:shortcode,Password:password,
      Timestamp:timestamp,CheckoutRequestID:checkout}),
    signal:AbortSignal.timeout(12000),redirect:"error",cache:"no-store",
  });
  if(!result.ok)return null;
  const response=obj(await result.json());
  const parsed=Number(response.ResultCode);
  return response.ResultCode!==undefined&&Number.isInteger(parsed)
    &&parsed>=0&&parsed<=99999?parsed:null;
}
serve(async(req)=>{
  if(req.method!=="POST")return respond({ResultCode:1,ResultDesc:"Method not allowed"},405);
  if(Deno.env.get("MPESA_ENV")!=="sandbox"
    ||Deno.env.get("SUCCESS_WISHES_MPESA_ISOLATED_DATABASE_CONFIRMED")!=="true"
    ||Deno.env.get("SUCCESS_WISHES_MPESA_SANDBOX_CALLBACK_ENABLED")!=="true")
    return respond({ResultCode:1,ResultDesc:"Sandbox callback unavailable"},503);
  const configured=Deno.env.get("SUCCESS_WISHES_MPESA_CALLBACK_SECRET")?.trim()??"";
  const supplied=new URL(req.url).searchParams.get("secret")??"";
  if(!secretMatches(supplied,configured))
    return respond({ResultCode:1,ResultDesc:"Unauthorized callback"},401);
  let payload:unknown,info:ReturnType<typeof callbackInfo>;
  try{
    const raw=await req.text();
    if(raw.length>16000)throw Error("callback_too_large");
    payload=JSON.parse(raw);
    info=callbackInfo(payload);
  }catch{return respond({ResultCode:1,ResultDesc:"Malformed callback"},400);}
  try{
    const db=createClient(env("SUPABASE_URL"),env("SUPABASE_SERVICE_ROLE_KEY"),{
      auth:{persistSession:false,autoRefreshToken:false},
    });
    const {data:inserted,error:insertError}=await db
      .from("success_wishes_guest_payment_events")
      .insert({event_key:info.eventKey,checkout_request_id:info.checkout,
        merchant_request_id:info.merchant,result_code:info.code,
        amount_kes:info.amount,phone:info.phone,
        provider_receipt:info.receipt,payload,provider_confirmed:false})
      .select("id,provider_confirmed,processing_state").single();
    let event=inserted;
    if(insertError){
      if(insertError.code!=="23505")throw Error("callback_persistence_failed");
      const {data:old,error}=await db.from("success_wishes_guest_payment_events")
        .select("id,provider_confirmed,processing_state")
        .eq("event_key",info.eventKey).maybeSingle();
      if(error||!old)throw Error("callback_recovery_failed");
      event=old;
    }
    if(!event)throw Error("callback_not_persisted");
    if(event.processing_state!=="pending")
      return respond({ResultCode:0,ResultDesc:"Already recorded"});
    // An injected or spoofed callback must never release a wish. Query Daraja
    // on a separately authenticated connection and compare its result.
    let providerCode:number|null=null;
    try{providerCode=await safaricomQuery(info.checkout);}catch{providerCode=null;}
    if(providerCode===null||providerCode!==info.code){
      return respond({ResultCode:0,ResultDesc:"Recorded for reconciliation"});
    }
    const {error:confirmError}=await db.from("success_wishes_guest_payment_events")
      .update({provider_confirmed:true}).eq("id",event.id)
      .eq("processing_state","pending");
    if(confirmError)throw Error("provider_confirmation_persistence_failed");
    const {data:decision,error:processError}=await db
      .rpc("success_wishes_settle_guest_event",{p_event_id:event.id});
    if(processError)throw Error("settlement_processing_failed");
    return respond({ResultCode:0,ResultDesc:
      decision==="settled"?"Verified settlement":"Recorded for reconciliation"});
  }catch{
    // Durable persistence failures must not be falsely acknowledged. For
    // uncertain post-persistence state, the reconciliation job also retries.
    return respond({ResultCode:1,ResultDesc:"Temporary processing failure"},500);
  }
});
