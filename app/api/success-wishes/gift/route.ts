import {NextRequest} from 'next/server'
import {WishError} from '@/lib/success-wishes/contracts'
import {database,failure,json,limit,reply} from '@/lib/success-wishes/server'
import {hashSecret} from '@/lib/success-wishes/security'
import {privateGift,rememberGift} from '@/lib/success-wishes/remembered-gifts'
export const dynamic='force-dynamic'
export const runtime='nodejs'
async function gift(req:NextRequest,reveal:boolean){
 const body=await json(req) as {token?:unknown}
 if(typeof body?.token!=='string'||!/^[a-f0-9]{64}$/.test(body.token))throw new WishError(404,'This gift link is unavailable.')
 const ip=(req.headers.get('x-real-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown').slice(0,100)
 await limit('guest-gift-access:'+ip,40,900)
 const result=await privateGift(database(),hashSecret('success-wishes:paid-link:'+body.token),reveal)
 const response=reply({card:result.card})
 if(reveal)await rememberGift(req,response,result)
 return response
}
export async function POST(req:NextRequest){try{return await gift(req,false)}catch(e){return failure(e)}}
export async function PUT(req:NextRequest){try{return await gift(req,true)}catch(e){return failure(e)}}
