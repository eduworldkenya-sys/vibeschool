# HQ User Intelligence — handover

## Mission
Upgrade `/hq/users` from a passive account directory into an owner-gated founder intelligence surface without adding invasive tracking or conflating account status with real activity.

## Audit findings
- Existing UI exposed name/ID, role, account status and billing only.
- `active` meant account status; it did not mean recently logged in.
- Production already stores authoritative `auth.users.last_sign_in_at`.
- Production already has 101 auth users; at audit time 2 had signed in within 24h, 11 within 7d, and 4 accounts were new within 7d.
- Existing HQ RPC is owner-gated and should remain the access boundary.

## Implemented on branch
`feature/hq-user-intelligence-20260818`

- Added `hq_user_intelligence_overview()` owner-only RPC.
- Extended `hq_user_directory()` with `last_sign_in_at` and elapsed sign-in age.
- Added founder metric cards: total users, signed-in 24h/7d, new 7d, 30d reach and attention count.
- Added founder signals for first-sign-in proxy, school affiliation and subscription health.
- Added explicit per-user last-sign-in display including Never/relative time.
- Kept a warning that sign-in is not meaningful learning/teaching activity.
- Responsive layout uses auto-fit metric cards and a compact three-column account row.

## Next intelligence layer
Instrument a governed product-event taxonomy for role-specific activation and value events, then add D1/D7/D30 retention, funnels, cohorts, feature adoption, learning outcomes, school health, acquisition attribution and content-demand gaps. Do not derive these from login alone.

## Deployment discipline
No Vercel deployment was intentionally triggered. Production Supabase was inspected read-only; the new migration has not been applied to production in this pass. Merge only after repository certification/build gates pass and migration lineage is reconciled.
