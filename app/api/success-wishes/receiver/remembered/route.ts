import {NextRequest} from 'next/server'
import {failure,reply,json} from '@/lib/success-wishes/server'
import {object,WishError} from '@/lib/success-wishes/contracts'
import {rememberedGift,rememberedSessions,type RememberedGift} from '@/lib/success-wishes/remembered-gifts'
export const dynamic='force-dynamic'
export const runtime='nodejs'
export async function GET(req:NextRequest){try{
 const sessions=await rememberedSessions(req),cards:RememberedGift[]=[]
 for(let i=0;i<sessions.length;i+=10){
  const batch=await Promise.all(sessions.slice(i,i+10).map(async s=>{try{return await rememberedGift(req,s.guest_gift_id||s.free_gift_id,false,sessions)}catch(e){if(e instanceof WishError&&e.status===404)return null;throw e}}))
  for(const card of batch)if(card)cards.push(card)
 }
 return reply({cards})
}catch(e){return failure(e)}}
export async function POST(req:NextRequest){try{
 const b=object(await json(req))
 if(typeof b.id!=='string'||!/^[a-f0-9-]{36}$/i.test(b.id))throw new WishError(404,'This gift is unavailable.')
 return reply({card:await rememberedGift(req,b.id,b.reveal===true)})
}catch(e){return failure(e)}}
