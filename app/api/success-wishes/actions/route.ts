import { NextRequest } from 'next/server'
import { field, object, uuid, WishError } from '@/lib/success-wishes/contracts'
import { failure, json, reply, session, limit } from '@/lib/success-wishes/server'
export async function POST(req: NextRequest) {
  try {
    const b = object(await json(req)), id = uuid(b.messageId), action = field(b.action, 4, 6)
    if (!['accept', 'hide', 'block', 'report'].includes(action)) throw new WishError(400, 'Choose a valid action.')
    const { db, inbox } = await session(req)
    await limit(`actions:${inbox.id}`, 100)
    const reason = action === 'report' ? (b.reason === undefined ? 'Reported by recipient' : field(b.reason, 1, 1000)) : null
    const { data, error } = action === 'block'
      ? await db.rpc('success_wishes_block_sender', { p_inbox_id: inbox.id, p_message_id: id })
      : await db.rpc('success_wishes_message_action', { p_inbox_id: inbox.id, p_message_id: id, p_action: action === 'hide' ? 'block' : action, p_reason: reason })
    if (error) throw error
    if (data !== true) throw new WishError(404, 'This message is unavailable.')
    return reply({ ok: true })
  } catch (error) { return failure(error) }
}
