import { NextRequest } from 'next/server'
import { field, object, WishError } from '@/lib/success-wishes/contracts'
import { database, failure, json, limit, reply } from '@/lib/success-wishes/server'
import { equalHash, hashSecret, token } from '@/lib/success-wishes/security'
import {
  sendSenderCode, senderChallengeHash, senderCode, senderEmail,
  senderFingerprint, senderVerificationReady, emailVerificationReady,
} from '@/lib/success-wishes/verification'
import {phoneFingerprint, phoneVerificationReady, sendSenderPhoneCode, senderPhone} from '@/lib/success-wishes/phone-verification'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function identity(input:Record<string,unknown>):{channel:'phone'|'email';address:string;fingerprint:string} {
  const secret=configuredSecret()
  if(input.phone!==undefined) {
    if(!phoneVerificationReady())throw new WishError(503,'Phone verification is not configured yet.')
    const address=senderPhone(input.phone)
    return {channel:'phone',address,fingerprint:phoneFingerprint(address,secret)}
  }
  if(!emailVerificationReady())throw new WishError(503,'Email verification is not configured yet.')
  const address=senderEmail(input.email)
  return {channel:'email',address,fingerprint:senderFingerprint(address,secret)}
}
function configuredSecret():string {
  if(!senderVerificationReady()&&!phoneVerificationReady())
    throw new WishError(503,'Sender verification is not available yet.')
  return process.env.SUCCESS_WISHES_VERIFICATION_SECRET!
}

// A phone OTP proves possession of the mobile number, not parental authority.
// Identity HMACs share the legacy email_digest column but are domain separated;
// the cleartext phone/email, verification code and SMS provider response are never stored.
export async function POST(req:NextRequest) {
  try {
    const input=object(await json(req))
    const who=identity(input)
    const secret=configuredSecret()
    await limit('sender-otp:global',300,3600)
    await limit('sender-otp:'+who.fingerprint,3,3600)
    const code=senderCode()
    const codeHash=senderChallengeHash(who.fingerprint,code,secret)
    const db=database()
    const {error}=await db.from('success_wishes_sender_challenges').upsert({
      email_digest:who.fingerprint,code_hash:codeHash,
      expires_at:new Date(Date.now()+10*60_000).toISOString(),
      consumed_at:null,attempts:0,
    },{onConflict:'email_digest'})
    if(error)throw error
    try {
      if(who.channel==='phone')await sendSenderPhoneCode(who.address,code)
      else await sendSenderCode(who.address,code,{fingerprint:who.fingerprint})
    }catch{
      await db.from('success_wishes_sender_challenges').delete()
        .eq('email_digest',who.fingerprint).eq('code_hash',codeHash)
      throw new WishError(503,'Verification code could not be sent. Please try again.')
    }
    return reply({ok:true,message:who.channel==='phone'
      ?'Check your phone for the six-digit SMS code. It expires in ten minutes.'
      :'Check your email for the six-digit code. It expires in ten minutes.'})
  }catch(error){return failure(error)}
}

export async function PATCH(req:NextRequest){
  try{
    const input=object(await json(req))
    const who=identity(input)
    const secret=configuredSecret()
    const code=field(input.code,6,6)
    if(!/^\d{6}$/.test(code))throw new WishError(400,'Enter the six-digit code.')
    await limit('sender-verify:global',1200,3600)
    await limit('sender-verify:'+who.fingerprint,12,900)
    const db=database()
    const {data:challenge,error}=await db.from('success_wishes_sender_challenges')
      .select('code_hash,expires_at,attempts,consumed_at')
      .eq('email_digest',who.fingerprint).maybeSingle()
    if(error)throw error
    if(!challenge||challenge.consumed_at||challenge.attempts>=5
      ||Date.parse(challenge.expires_at)<=Date.now())
      throw new WishError(401,'The verification code is invalid or expired.')
    const matches=equalHash(challenge.code_hash,senderChallengeHash(who.fingerprint,code,secret))
    const {data:claimed,error:updateError}=await db.from('success_wishes_sender_challenges')
      .update({attempts:challenge.attempts+1,consumed_at:matches?new Date().toISOString():null})
      .eq('email_digest',who.fingerprint).eq('code_hash',challenge.code_hash)
      .eq('attempts',challenge.attempts).is('consumed_at',null)
      .gt('expires_at',new Date().toISOString()).select('email_digest').maybeSingle()
    if(updateError)throw updateError
    if(!claimed||!matches)throw new WishError(401,'The verification code is invalid or expired.')
    const {data:sender,error:senderError}=await db.from('success_wishes_senders')
      .upsert({email_digest:who.fingerprint},{onConflict:'email_digest'})
      .select('id').single()
    if(senderError||!sender)throw senderError||new Error('Sender identity could not be verified.')
    const proof=token()
    const expiresAt=new Date(Date.now()+24*60*60*1000).toISOString()
    const {error:proofError}=await db.from('success_wishes_sender_sessions')
      .insert({token_hash:hashSecret(proof),sender_id:sender.id,expires_at:expiresAt})
    if(proofError)throw proofError
    return reply({verified:true,senderProof:proof,expiresAt})
  }catch(error){return failure(error)}
}
