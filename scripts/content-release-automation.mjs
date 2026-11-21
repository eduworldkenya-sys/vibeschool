/**
 * Fail-closed decision and execution adapter for the canonical Content Engine.
 * This module does NOT mint sessions, schedule work, review academic content, approve
 * sources, certify resources, or override RLS. A trusted runner must load a fresh
 * canonical read-only preflight using the SAME authenticated publisher context.
 * Only public.publish_publication can effect the release.
 */
const failure = (reason, blockers = []) => ({ state: 'BLOCKED', reason, blockers, mayRequestCanonicalPublish: false, learnerVisible: false })
const positive = (n) => Number.isSafeInteger(n) && n > 0
const exact = (actual, required) => Number.isSafeInteger(required) && required > 0 && actual === required

export function classifyContentReleasePreflight(input, expected) {
  const p = Array.isArray(input) && input.length === 1 ? input[0]?.release_preflight : input?.release_preflight ?? input
  if (!expected || typeof expected !== 'object' || !p || typeof p !== 'object' || Array.isArray(p)) return failure('missing_report')
  if (p.no_mutation_performed !== true || p.scope !== expected.scope || p.package_id !== expected.packageId || p.publication_id !== expected.publicationId) return failure('scope_or_evidence_mismatch')
  if (!Array.isArray(p.blockers) || !p.blockers.every(b => typeof b === 'string' && b.length > 0) || p.blockers.length !== new Set(p.blockers).size) return failure('invalid_blockers')
  const f = p.facts
  if (!f || typeof f !== 'object' || !f.release || !f.official_source || !f.outcomes || !f.resources || !f.guide || !f.assessment || !f.curriculum_gate) return failure('incomplete_release_evidence', p.blockers)
  const a = f.release, s = f.official_source, o = f.outcomes, r = f.resources, g = f.guide, e = f.assessment
  const proof = positive(s.approved) && positive(s.artifacts) && positive(s.promoted_snapshots)
    && exact(o.mapped,expected.outcomeCount) && exact(o.active,expected.outcomeCount) && exact(o.locator_matches,expected.outcomeCount)
    && exact(r.total,expected.resourceCount) && exact(r.verified_payload_hashes,expected.resourceCount)
    && exact(r.certified,expected.resourceCount) && exact(r.rights_cleared,expected.resourceCount)
    && r.pending_rights === 0 && exact(r.active_roots,expected.resourceCount)
    && r.public_learnable >= expected.publicResourceCount && r.protected_sensitive >= expected.privateResourceCount
    && positive(g.approved) && exact(g.source_blocks,expected.chapterBlockCount)
    && exact(e.items,expected.assessmentItemCount) && exact(e.marks,expected.assessmentMarks)
    && e.approved_items >= expected.minimumApprovedAssessmentItems
    && f.curriculum_gate.state === 'PASS'
  if (!proof) return failure('release_evidence_incomplete_or_stale',p.blockers)
  const learnerVisible = a.published_chapters > 0 && a.live_catalogue_rows > 0
  if (p.blockers.length === 0 && p.status === 'CATALOGUE_VISIBLE' && learnerVisible && f.book_status === 'published' && positive(a.final_release_approvals)) {
    return {state: 'CATALOGUE_VERIFIED',reason:null,blockers:[],mayRequestCanonicalPublish:false,learnerVisible:true}
  }
  if (p.blockers.length === 1 && p.blockers[0] === 'student_catalogue_publication_pending' &&
      p.status === 'READY_TO_PUBLISH' && f.book_status === 'draft' && positive(a.current_fingerprint_approvals) && f.app_actor_attached_to_this_connection === true && !learnerVisible) {
    return {state:'READY_TO_PUBLISH',reason:null,blockers:p.blockers,mayRequestCanonicalPublish:true,learnerVisible:false}
  }
  return failure('release_gates_pending_or_contradictory',p.blockers)
}

/**
 * Call ONLY from an already authenticated, authorized server worker. No service-role
 * client or caller-provided user id is accepted as proof of an actual user session.
 * The database rechecks author, fingerprint and quality at the moment of release.
 * A catalogue check is not a signed-in mobile learner end-to-end acceptance test.
 */
export async function runAuthorizedContentRelease({client,loadPreflight,expected}) {
  if (!client?.auth?.getUser || !client?.rpc || typeof loadPreflight !== 'function' || !expected?.publisherId) return failure('authenticated_publisher_connection_required')
  let before
  try { before = classifyContentReleasePreflight(await loadPreflight(),expected) }
  catch { return failure('preflight_unavailable') }
  if (before.state !== 'READY_TO_PUBLISH') return before
  let user
  try { const answer = await client.auth.getUser(); if (answer.error) return failure('publisher_auth_verification_failed'); user=answer.data?.user }
  catch { return failure('publisher_auth_verification_failed') }
  if (user?.id !== expected.publisherId) return failure('publisher_identity_mismatch')
  let response
  try { response = await client.rpc('publish_publication',{p_publication_id:expected.publicationId}) }
  catch { return failure('canonical_publish_rpc_failed') }
  if (response.error || !Array.isArray(response.data) || response.data.length !== 1) return failure('canonical_publish_rpc_failed')
  let after
  try { after = classifyContentReleasePreflight(await loadPreflight(),expected) }
  catch { return failure('catalogue_verification_unavailable') }
  return after.state === 'CATALOGUE_VERIFIED' ? after : failure('post_release_catalogue_not_verified',after.blockers)
}
