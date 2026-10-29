import { createClient } from '@supabase/supabase-js'
import { verifiedFounderOperator } from '@/lib/success-wishes/mpesa-operator'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200) => Response.json(body, {
  status, headers: { 'Cache-Control': 'private, no-store' },
})

export async function GET(req: Request) {
  if (!(await verifiedFounderOperator(req))) return json({ error: 'Forbidden' }, 403)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return json({ error: 'Reporting unavailable' }, 503)
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  try {
    // Paginate rather than silently treating Supabase's default 1,000-row limit as a total.
    const orders: Array<{ id: string; state: string; amount_kes: number; created_at: string; settled_at: string | null }> = []
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db.from('success_wish_guest_orders')
        .select('id,state,amount_kes,created_at,settled_at')
        .order('created_at', { ascending: false }).order('id', { ascending: false })
        .range(offset, offset + 999)
      if (error) throw error
      orders.push(...(data || []))
      if (!data || data.length < 1000) break
      if (offset >= 99000) return json({ error: 'Reporting exceeds safe row limit' }, 503)
    }
    const count = async (table: string, opened = false) => {
      let query = db.from(table).select('*', { count: 'exact', head: true })
      if (opened) query = query.not('opened_at', 'is', null)
      const { count: value, error } = await query
      if (error) throw error
      return value ?? 0
    }
    const [free, freeOpened, links, linksOpened] = await Promise.all([
      count('success_wish_free_gifts'), count('success_wish_free_gifts', true),
      count('success_wish_guest_gifts'), count('success_wish_guest_gifts', true),
    ])
    const states: Record<string, number> = {}
    for (const order of orders) states[order.state] = (states[order.state] || 0) + 1
    const settled = orders.filter(o => o.state === 'settled' && !!o.settled_at)
    const revenue = settled.reduce((sum, o) => sum + Number(o.amount_kes || 0), 0)
    return json({
      orders: orders.length, states, settledOrders: settled.length, settledAmountKes: revenue,
      free, freeOpened, links, linksOpened,
      recent: orders.slice(0, 20).map(o => ({
        id: o.id, state: o.state, amountKes: o.amount_kes,
        createdAt: o.created_at, settledAt: o.settled_at,
      })),
      generatedAt: new Date().toISOString(),
    })
  } catch {
    return json({ error: 'Success Wishes records could not be loaded' }, 503)
  }
}
