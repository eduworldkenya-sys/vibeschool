import { NextRequest } from 'next/server'
import { object, WishError } from '@/lib/success-wishes/contracts'
import { database, failure, json, reply } from '@/lib/success-wishes/server'
import { freeWish } from '../free/route'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Both advertised code and free-trial endpoints share the same atomic five-card allowance.
// Legacy standalone campaign redemption is intentionally not used: it bypassed the per-sender cap.
export async function POST(req:NextRequest){
 try{
  const b=object(await json(req))
  if(typeof b.code!=='string'||b.code.trim().toUpperCase()!=='DNJIMAX3')throw new WishError(400,'Invalid code.')
  if(b.action==='validate'){
   const {data,error}=await database().from('success_wishes_pilot_control').select('free_text_enabled').eq('singleton',true).maybeSingle()
   if(error||!data?.free_text_enabled)throw new WishError(409,'This free-card code is not active.')
   return reply({valid:true})
  }
  return reply(await freeWish(req,b))
 }catch(error){return failure(error)}
}
