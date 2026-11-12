import { NextRequest } from 'next/server'
import { UUID_RE } from '@/lib/visual-library/contract'
import { requireVisualReleaseOperator, visualJson } from '@/lib/visual-library/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Only delegated, explicitly scoped visual releases.
 * The ordinary authenticated-owner certification API remains unchanged.
 * Candidate intake tokens cannot reach this route; no bulk release allowed.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireVisualReleaseOperator(req)
    if (!session) return visualJson({ error: 'Visual release authorization required.' }, 403)
    const size = Number(req.headers.get('content-length') || 0)
    if (size > 4096) return visualJson({ error: 'Release request too large.' }, 413)
    if (!(req.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
      return visualJson({ error: 'JSON request required.' }, 415)
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return visualJson({ error: 'Invalid release request.' }, 400)
    }
    const field = (key: string, max = 600) => {
      const value = body[key]
      return typeof value === 'string' ? value.trim().slice(0, max + 1) : ''
    }
    const versionId = field('visualVersionId', 36)
    const expectedSha256 = field('expectedContentSha256', 64)
    const operatorReason = field('operatorReason')
    const qualityCheck = field('qualityCheck')
    const rightsCheck = field('rightsCheck')
    const accessibilityCheck = field('accessibilityCheck')
    const requestId = (req.headers.get('x-request-id') || '').trim().slice(0, 80)
    if (!UUID_RE.test(versionId) || !/^[0-9a-f]{64}$/.test(expectedSha256)
      || [operatorReason, qualityCheck, rightsCheck, accessibilityCheck]
        .some(value => value.length < 12 || value.length > 600)
      || (requestId && !/^[\w.:-]{1,80}$/.test(requestId))) {
      return visualJson({ error: 'Version, exact hash and documented release checks are required.' }, 400)
    }

    // Database function is service_role-only and atomically validates:
    // verified visual_aid, rights, source strand, exact version/content SHA,
    // private object MIME/bytes, no other certified version and audit trail.
    const { data, error } = await session.admin.rpc('vs_release_verified_visual', {
      p_version_id: versionId,
      p_expected_sha256: expectedSha256,
      p_release_evidence: {
        operator_reason: operatorReason,
        quality_check: qualityCheck,
        rights_check: rightsCheck,
        accessibility_check: accessibilityCheck,
        actor: session.actor,
        request_id: requestId || null,
      },
    })
    if (error) {
      const blocked = error.code === '23514' || error.code === '42501' || error.code === '22023'
      return visualJson({ error: blocked ? 'Visual did not pass release checks.' : 'Visual release unavailable.' },
        blocked ? 409 : 503)
    }
    return visualJson({ result: data }, 200)
  } catch {
    return visualJson({ error: 'Visual release unavailable.' }, 503)
  }
}
