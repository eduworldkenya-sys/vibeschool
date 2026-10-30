import { NextRequest } from 'next/server'
import { failure, json, reply } from '@/lib/success-wishes/server'
import { freeWish } from '@/lib/success-wishes/free-issue'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function POST(req:NextRequest){try{return reply(await freeWish(req,await json(req)))}catch(error){return failure(error)}}
