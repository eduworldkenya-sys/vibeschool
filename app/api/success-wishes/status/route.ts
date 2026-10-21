import { NextRequest } from 'next/server'
import { field, object, uuid, WishError } from '@/lib/success-wishes/contracts'
import { database, failure, json, limit, reply } from '@/lib/success-wishes/server'
import { hashSecret } from '@/lib/success-wishes/security'

// Sender status is protected by the same private withdrawal capability.
// Never put access tokens in GET query parameters, server logs, or URLs.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const input = object(await json(req))
    const reference = uuid(input.reference)
    const managementToken = field(input.managementToken, 64, 64)
    if (!/^[a-f0-9]{64}$/.test(managementToken)) {
      throw new WishError(400, 'Check the submission reference and private code.')
    }
    await limit('sender-status:global', 1000, 60)
    await limit('sender-status:' + reference, 8, 900)
    const { data, error } = await database().from('success_wishes_messages')
      .select('id,state,payment_status,created_at,expires_at')
      .eq('id', reference)
      .eq('management_token_hash', hashSecret(managementToken))
      .maybeSingle()
    if (error) throw error
    if (!data) throw new WishError(404, 'Check the reference and private code.')
    return reply({
      reference: data.id,
      // Never reveal candidate report/block decisions to a sender.
      status: data.state === 'reported' || data.state === 'blocked' ? 'unavailable' : data.state,
      paymentStatus: data.payment_status,
      createdAt: data.created_at,
      expiresAt: data.expires_at,
    })
  } catch (error) { return failure(error) }
}
