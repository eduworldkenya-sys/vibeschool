# HQ Mobile Founder Command Center Handover — 2026-08-19

## Mission

Rebuild the VibeSchool HQ founder surface as a phone-first command center without weakening owner authentication, product authority controls, offline fail-closed behavior, runtime certification evidence, or existing Supabase truth sources.

## Product direction

HQ is not a generic admin dashboard. It is the founder operating surface for observing company state, detecting drift, explaining changes, prioritizing work, making governed decisions, verifying outcomes, and learning from evidence.

The mobile experience is the primary interaction model. Desktop remains supported as an expanded view of the same information architecture.

## Implemented

- Responsive HQ shell with a fixed five-destination mobile bottom navigation: Home, Insights, Live, Alerts, More.
- Larger mobile interaction targets and phone-safe header/action layouts.
- Founder Command Center north-star scorecard for DAU, WAU, MAU, incidents, findings, outstanding work, and actionable founder decisions.
- Source-backed seven-day activity sparkline.
- Audience-scale visualization for activation footprint.
- Priority findings surface and founder morning brief.
- System health, financial summary, and learning/product evidence panels.
- Existing product-authority controls retained, including reason capture before live authority changes.
- Existing runtime certification evidence retained.
- Offline last-known certified snapshot behavior retained; consequential controls remain unavailable offline.
- HQ command center migrated to the isolated `hqSupabase` client so its session matches the owner-only HQ authentication boundary.
- Curriculum Authority navigation contract made presentation-independent: certification now verifies that the protected route remains reachable rather than requiring an exact visual label.

## Production Supabase verification

The current production project exposes the HQ RPC contracts used by this surface:

- `hq_get_seven_day_owner_report`
- `hq_get_product_controls`
- `hq_get_control_health_v2`
- `hq_workforce_list_decisions`
- `hq_run_operating_cycle`

The HQ layout separately enforces `hq_check_owner_access` before protected HQ content is rendered.

No database migration or production data mutation was required for this UX tranche.

## Security and governance invariants

- HQ remains owner-gated.
- HQ browser session remains isolated from normal VibeSchool application sessions.
- Product authority changes continue to require a recorded operational reason.
- Offline mode is read-only for consequential authority changes and operating-cycle execution.
- Runtime certification evidence remains visible to the owner.
- No service-role credential was introduced into the browser.

## Certification gates

Required before merge:

1. TypeScript and Production Build Gate — exact-head pass.
2. Worker Engine WE-R1.3 / R1.3X Acceptance Gate — exact-head pass.
3. Curriculum Authority Operator Contract — exact-head pass.
4. PR remains mergeable against current `main`.

Any failing gate blocks merge until repaired and rerun on the exact final head.

## Deployment discipline

Vercel is intentionally not invoked during iterative implementation. The repository is certified first; only the final merged state is eligible for production deployment. This avoids consuming deployment capacity on intermediate commits.

## Changed surface

- `components/hq/HQShell.tsx`
- `app/hq/page.tsx`
- `scripts/test-curriculum-authority-operator.mjs`
- this handover log

## Next HQ evolution

After this command-center tranche is merged and production-verified, the next HQ work should deepen evidence rather than add visual clutter: acquisition and activation funnels, learner retention and outcome intelligence, teacher workflow health, parent engagement, school adoption, revenue/reconciliation, content demand and quality, and accountable work ownership. Each should reuse the same phone-first navigation grammar and source-backed evidence model.
