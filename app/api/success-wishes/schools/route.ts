import { NextRequest } from 'next/server'
import { database, failure, reply, limit } from '@/lib/success-wishes/server'
import { enabled } from '@/lib/success-wishes/security'
export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest) {
  if (!enabled()) return reply({ schools: [], available: false })
  try {
    await limit('school-search:global', 2000, 60)
    const q = (req.nextUrl.searchParams.get('q') || '').trim()
    if (q.length < 2 || q.length > 80) return reply({ schools: [], available: true })
    const { data, error } = await database().from('success_wishes_schools').select('school_id,schools!inner(id,name,county,status,deleted_at)').eq('enabled', true).gt('expires_at', new Date().toISOString()).is('schools.deleted_at', null).in('schools.status', ['active', 'pending']).ilike('schools.name', `%${q.replace(/[%_,()\\]/g, '')}%`).limit(15)
    if (error) throw error
    // Explicit public projection: no student or private participation fields.
    const schools = (data || []).flatMap(row => {
      const nested: unknown = row.schools
      const s = Array.isArray(nested) ? nested[0] : nested
      return s && typeof s === 'object' && 'id' in s && 'name' in s ? [{ id: s.id, name: s.name, county: 'county' in s ? s.county : null }] : []
    })
    return reply({ schools, available: true })
  } catch (error) { return failure(error) }
}
