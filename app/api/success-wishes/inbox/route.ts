import { NextRequest } from 'next/server'
import { failure, reply, session } from '@/lib/success-wishes/server'
export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest) {
  try {
    const { db, inbox } = await session(req)
    const { data, error } = await db.from('success_wishes_messages').select('id,sender_name,relationship,format,body,state,created_at').eq('inbox_id', inbox.id).in('state', ['request', 'available']).in('payment_status', ['paid', 'sponsored']).or('format.eq.text,media_status.eq.ready').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(100)
    if (error) throw error
    return reply({ messages: (data || []).map(m => ({ id: m.id, senderName: m.sender_name, relationship: m.relationship, kind: m.format, text: m.state === 'available' ? m.body : null, state: m.state, createdAt: m.created_at })) })
  } catch (error) { return failure(error) }
}
