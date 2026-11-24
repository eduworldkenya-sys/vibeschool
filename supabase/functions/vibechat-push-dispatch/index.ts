// Closed-app VibeChat Web Push dispatcher. Generic empty pushes, no message data.
// Deployment and scheduling require explicit release commissioning.
const url = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const secret = Deno.env.get("VIBECHAT_PUSH_DISPATCH_SECRET") ?? "";
const vapidPublic = Deno.env.get("VIBECHAT_VAPID_PUBLIC_KEY") ?? "";
const vapidPrivate = Deno.env.get("VIBECHAT_VAPID_PRIVATE_KEY") ?? "";
const subject = Deno.env.get("VIBECHAT_VAPID_SUBJECT") ?? "";
const enc = new TextEncoder();
const b64 = (v: Uint8Array) => btoa(String.fromCharCode(...v)).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
const unb64 = (s:string) => Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(s.length/4)*4,"=")),x=>x.charCodeAt(0));
const validEndpoint = (s:string) => /^https:\/\/(?:fcm\.googleapis\.com\/fcm\/send\/|updates\.push\.services\.mozilla\.com\/wpush\/v[12]\/|web\.push\.apple\.com\/)[A-Za-z0-9._~:%+=/-]+$/.test(s) && s.length<=2048;
async function sameSecret(candidate:string, expected:string){
 const a=new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(candidate)));
 const b=new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(expected)));
 let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;
}
async function rpc<T>(name:string,args:Record<string,unknown>):Promise<T>{
 const r=await fetch(url+"/rest/v1/rpc/"+name,{method:"POST",headers:{apikey:serviceKey,Authorization:"Bearer "+serviceKey,"Content-Type":"application/json"},body:JSON.stringify(args),redirect:"error",signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw new Error("Database operation failed");
 return await r.json() as T;
}
async function signingKey(){
 const pub=unb64(vapidPublic),priv=unb64(vapidPrivate);
 if(pub.length!==65||pub[0]!==4||priv.length!==32)throw new Error("Invalid VAPID configuration");
 return await crypto.subtle.importKey("jwk",{kty:"EC",crv:"P-256",x:b64(pub.slice(1,33)),y:b64(pub.slice(33,65)),d:b64(priv),ext:true},{name:"ECDSA",namedCurve:"P-256"},false,["sign"]);
}
async function authorization(endpoint:string,key:CryptoKey){
 const header=b64(enc.encode(JSON.stringify({typ:"JWT",alg:"ES256"})));
 const payload=b64(enc.encode(JSON.stringify({aud:new URL(endpoint).origin,exp:Math.floor(Date.now()/1000)+3600,sub:subject})));
 const content=header+"."+payload;
 const sig=new Uint8Array(await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},key,enc.encode(content)));
 return "vapid t="+content+"."+b64(sig)+", k="+vapidPublic;
}
type Job={id:string;lease:string};
type Delivery={endpoint:string;p256dh:string;auth:string};
async function dispatch(job:Job,key:CryptoKey){
 let outcome="retry";
 try{
  const d=await rpc<Delivery|null>("vibechat_push_delivery",{p_id:job.id,p_lease:job.lease});
  if(!d||!validEndpoint(d.endpoint))outcome="skipped";
  else{
   // Empty Web Push messages need no application payload encryption.
   const r=await fetch(d.endpoint,{method:"POST",headers:{Authorization:await authorization(d.endpoint,key),TTL:"60",Urgency:"normal",Topic:"vibechat"},redirect:"error",signal:AbortSignal.timeout(10000)});
   outcome=r.ok?"sent":r.status===404||r.status===410?"expired":r.status===429||r.status>=500?"retry":"failed";
  }
 }catch{outcome="retry"}
 await rpc<boolean>("vibechat_finish_push",{p_id:job.id,p_lease:job.lease,p_outcome:outcome});
 return outcome;
}
Deno.serve(async req=>{
 if(req.method!=="POST")return new Response(null,{status:405});
 if(secret.length<32||!serviceKey||!url||!vapidPublic||!vapidPrivate||!/^mailto:[^@\s]+@[^@\s]+$/.test(subject))return new Response("Unavailable",{status:503});
 if(!await sameSecret(req.headers.get("x-vibechat-dispatch-secret")??"",secret))return new Response("Forbidden",{status:403});
 try{
  const key=await signingKey();
  const jobs=await rpc<Job[]>("vibechat_claim_push",{});
  const counts:Record<string,number>={};
  for(let i=0;i<jobs.length;i+=4){
   const results=await Promise.allSettled(jobs.slice(i,i+4).map(job=>dispatch(job,key)));
   for(const r of results){const k=r.status==="fulfilled"?r.value:"lease-recovery";counts[k]=(counts[k]??0)+1}
  }
  return Response.json({processed:jobs.length,outcomes:counts},{headers:{"Cache-Control":"no-store"}});
 }catch{return new Response("Dispatch unavailable",{status:503})}
});
