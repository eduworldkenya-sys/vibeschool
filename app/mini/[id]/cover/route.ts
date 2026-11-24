import { NextResponse } from 'next/server'
import { publicMiniCover } from '@/lib/minis/public-server'
export const dynamic = 'force-dynamic'
export async function GET(_request: Request, {params}:{params:Promise<{id:string}>}) {
  const {id} = await params
  const url = await publicMiniCover(id)
  const headers = {'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}
  if (!url) return new NextResponse(null,{status:404,headers})
  return NextResponse.redirect(url,{status:307,headers})
}
