import {NextRequest} from 'next/server'
import {guestCheckout} from '@/lib/success-wishes/guest-checkout'
import {failure,json,reply} from '@/lib/success-wishes/server'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=60
export async function POST(req:NextRequest){try{return reply(await guestCheckout(req,await json(req)))}catch(error){return failure(error)}}
