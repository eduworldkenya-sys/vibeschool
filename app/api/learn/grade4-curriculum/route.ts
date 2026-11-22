import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const dynamic = 'force-dynamic'
const sources = {
  christianreligiouseducation: {id:'8165d513-035b-4019-9fdb-5b86a27335a1',ref:'owner-approved:grade4-cre:2026-11-22'},
  creativearts: {id:'6d68b57c-565d-4a04-879d-c77f588d6404',ref:'owner-paraphrase-2026-11-22'},
} as const
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('subject') ?? ''
  const config = sources[key as keyof typeof sources]
  if (!config) return NextResponse.json({error:'Unknown subject'}, {status:400})
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return NextResponse.json({error:'Unavailable'}, {status:503})
  const db=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data,error}=await db.from('cbc_strands')
    .select('id,name,sub_strand,strand_order,sub_strand_order,source_ref,learning_outcomes')
    .eq('grade','Grade 4').eq('subject_id',config.id)
    .order('strand_order').order('sub_strand_order').limit(100)
  if(error) return NextResponse.json({error:'Unavailable'}, {status:503})
  const rows=(data??[]).filter(row=>key==='creativearts'
    ? row.source_ref?.includes(config.ref)
    : row.source_ref===config.ref)
    .map(({id,name,sub_strand,strand_order,sub_strand_order,learning_outcomes})=>
      ({id,name,sub_strand,strand_order,sub_strand_order,learning_outcomes}))
  return NextResponse.json({rows},{headers:{'Cache-Control':'public, s-maxage=300, stale-while-revalidate=300'}})
}
