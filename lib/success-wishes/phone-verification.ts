import {createHmac} from 'node:crypto'
import {WishError} from './contracts'

type Env=Record<string,string|undefined>
type Requester=typeof fetch

// Kenya mobile numbers only. Restrict countries to avoid SMS toll fraud.
export function senderPhone(value:unknown):string {
  if(typeof value!=='string')throw new WishError(400,'Enter your Kenyan mobile number.')
  const compact=value.trim().replace(/[ ()-]/g,'')
  let normalized=compact
  if(/^0[17]\d{8}$/.test(compact))normalized='+254'+compact.slice(1)
  else if(/^254[17]\d{8}$/.test(compact))normalized='+'+compact
  if(!/^\+254[17]\d{8}$/.test(normalized))
    throw new WishError(400,'Enter a valid Kenyan mobile number, e.g. 0712345678.')
  return normalized
}
export function phoneFingerprint(phone:string,secret:string):string {
  if(secret.length<32)throw Error('Sender verification secret is not configured.')
  return createHmac('sha256',secret).update('success-wishes:phone:'+senderPhone(phone)).digest('hex')
}
export function phoneVerificationReady(env:Env=process.env):boolean {
  const mode=env.SUCCESS_WISHES_AT_MODE
  return env.SUCCESS_WISHES_SENDER_VERIFICATION_ENABLED==='true'
    &&typeof env.SUCCESS_WISHES_VERIFICATION_SECRET==='string'
    &&env.SUCCESS_WISHES_VERIFICATION_SECRET.length>=32
    &&!!env.SUCCESS_WISHES_AT_USERNAME?.trim() &&!!env.SUCCESS_WISHES_AT_API_KEY?.trim()
    &&(mode==='live'||(mode==='sandbox'&&env.VERCEL_ENV==='preview'))
}
// SMS delivered only when carrier credentials and environment are commissioned.
// No OTP is logged, exposed in response data, or sent to the recipient school.
export async function sendSenderPhoneCode(phone:string,code:string,options:{
  env?:Env;fetcher?:Requester
}={}):Promise<void> {
  const env=options.env??process.env
  if(!phoneVerificationReady(env))throw Error('Phone verification provider is unavailable.')
  if(!/^\d{6}$/.test(code))throw Error('Invalid verification code.')
  const destination=senderPhone(phone)
  const endpoint=env.SUCCESS_WISHES_AT_MODE==='sandbox'
    ?'https://api.sandbox.africastalking.com/version1/messaging'
    :'https://api.africastalking.com/version1/messaging'
  const body=new URLSearchParams({
    username:env.SUCCESS_WISHES_AT_USERNAME!.trim(),
    to:destination,
    message:'Your VibeSchool Success Wishes code is '+code+'. Valid for 10 minutes. Never share it.',
  })
  const from=env.SUCCESS_WISHES_AT_SENDER_ID?.trim()
  if(from)body.set('from',from)
  let response:Response
  try{
    response=await (options.fetcher??fetch)(endpoint,{
      method:'POST',
      headers:{
        apiKey:env.SUCCESS_WISHES_AT_API_KEY!.trim(),
        Accept:'application/json',
        'Content-Type':'application/x-www-form-urlencoded',
      },
      body:body.toString(),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000),
    })
  }catch{throw Error('Verification SMS could not be submitted to the provider.')}
  if(!response.ok)throw Error('Verification SMS provider rejected the request.')
  const envelope:unknown=await response.json().catch(()=>null)
  const recipients=(envelope as {SMSMessageData?:{Recipients?:unknown}}|null)?.SMSMessageData?.Recipients
  if(!Array.isArray(recipients)||recipients.length!==1)throw Error('SMS provider did not accept the message.')
  const item=recipients[0] as {number?:unknown;statusCode?:unknown;status?:unknown}
  if(item.number!==destination||item.statusCode!==102||item.status!=='Success')
    throw Error('SMS provider did not accept the message.')
}
