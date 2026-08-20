# HQ Human Authority Recovery Protocol

## Purpose

This protocol governs human HQ identity recovery, ownership continuity, emergency access removal, role changes and offboarding. It does not expose passwords, service-role keys, deployment credentials or source-control credentials through HQ.

## Founder continuity

- Founder/Owner authority cannot be granted, transferred, demoted or revoked through the ordinary HQ Team member-administration API.
- Ownership changes require a separately reviewed engineering/security procedure with production identity verification, explicit evidence and a second authorized human where available.
- A Partner/Admin or HQ Admin cannot promote themselves or another member to Founder.
- Loss of a Founder password uses the isolated Supabase Auth recovery flow; it must not be solved by sharing another operator's credentials.

## Emergency removal

- Suspend immediately terminates the target's active Supabase sessions and blocks HQ access while preserving the membership record and work history.
- Revoke terminates sessions, removes any legacy broad-owner bridge, marks the human record revoked, and reassigns open/in-progress human assignments to the acting Founder.
- Reactivation restores only the existing approved role. If password readiness is not proven, the account returns to Password setup rather than Active.

## Authority changes

- Role or permission changes revoke existing sessions so stale authority cannot survive in a previously issued session.
- Reviewer, Support, Finance and Viewer roles never receive `platform_owners` compatibility access.
- Partner/Admin and HQ Admin may retain broad HQ operator compatibility, while Founder-only account administration and ownership actions remain protected.
- Expired, suspended, revoked or password-incomplete identities fail closed.

## Consequential approvals

- Critical approval requests may require two approvals.
- The requester cannot approve their own consequential request.
- A human may decide a given approval only once.
- A rejection closes the request; expiration closes its authority window operationally.

## Audit expectations

Human authority changes, password setup completion, password-reset dispatch, assignment creation/status changes, approval decisions, suspension, revocation and reactivation are recorded in the HQ human audit ledger with actor, target/action and timestamp context.

## Separation from digital workers

Human HQ roles do not automatically grant Worker Engine capabilities. Digital-worker execution remains governed by the Workforce authority, canary, breaker, evidence and emergency-stop controls.
