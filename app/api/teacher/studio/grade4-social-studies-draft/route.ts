import { NextResponse } from 'next/server'
import { identityClient } from '@/lib/identity/server'
import { isMumbi2Publisher } from '@/lib/studioPublisherIdentity'
import manuscript from '@/docs/content/grade4-social-studies-textbook/reader-draft.json'
import visuals from '@/docs/content/grade4-social-studies-textbook/visuals/import-assets.json'
export const dynamic = 'force-dynamic'
/** Private manuscript intake for the existing Content Studio. No publication or
 * authority mutation, no service key, no teacher answer keys in this response. */
export async function GET() {
 const sb = await identityClient()
 const { data: { user }, error } = await sb.auth.getUser()
 if (error || !user) return NextResponse.json({ error: 'Sign in as the authorized publisher.' }, { status: 401, headers: {'Cache-Control':'private, no-store'} })
 const { data: profile, error: roleError } = await sb.from('profiles').select('role').eq('id', user.id).maybeSingle()
 if (roleError || !isMumbi2Publisher(user.id, profile?.role)) return NextResponse.json({ error: 'Publisher access required.' }, { status: 403, headers: {'Cache-Control':'private, no-store'} })
 return NextResponse.json({manuscript, visuals}, {headers:{'Cache-Control':'private, no-store'}})
}
