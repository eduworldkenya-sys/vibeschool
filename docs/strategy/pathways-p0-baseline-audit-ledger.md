# VibeSchool Pathways — P0.0 Baseline Freeze & Collision Audit Ledger

**Mission branch:** `agent/pathways-customer-acquisition-strategy`  
**Status:** ACTIVE — audit started 2026-08-16  
**Safety:** repository + live Supabase inspection only until ownership/collision findings are resolved. No production schema/data mutation is authorized by this gate.

## Objective

Establish the exact existing VibeSchool product/data/runtime surfaces that Pathways must REUSE, EXTEND, KEEP SEPARATE or RETIRE before any Pathways schema or feature implementation.

## Audit Domains

1. Public entry/navigation and `/learn` surfaces.
2. Existing career/pathway-like routes and data.
3. Learner identity/profile authority.
4. Student Home, Tasks and personalized path infrastructure.
5. Student Twin / recommendation-adjacent logic.
6. Assessment engine and reusable session/question/evidence primitives.
7. National school identity, discovery, search and offering data.
8. Curriculum/subject identity and senior-school concepts.
9. Auth/onboarding and anonymous→authenticated continuation.
10. Parent and teacher learner projections.
11. SEO: metadata, sitemap, robots, public/private boundaries.
12. Analytics/event/observability foundations.
13. Live Supabase tables/views/functions/RLS/grants relevant to all above.

## Classification Contract

Every material existing capability receives exactly one initial classification:

- **REUSE** — canonical capability already fits Pathways without ownership duplication.
- **EXTEND** — canonical capability exists but needs additive Pathways semantics.
- **KEEP SEPARATE** — valid neighboring subsystem; integrate through a contract but do not merge ownership.
- **RETIRE / DO NOT REUSE** — legacy/duplicate/unsafe semantics that must not become Pathways foundation.
- **UNRESOLVED** — insufficient evidence; blocks dependent implementation until resolved.

## Non-Negotiable Invariants

- No second learner identity.
- No second school identity.
- No second recommendation truth engine.
- No second auth/onboarding router.
- No second sitemap/robots authority.
- No schema invention before live-database archaeology.
- No public SEO surface may expose private learner data.
- Pathways recommendation truth must remain evidence/provenance reconstructable.
- Twin may explain/coach from Pathways state but may not independently invent canonical pathway eligibility/offering truth.
- School-offering facts must attach to canonical school identities with provenance rather than copy school identity into a Pathways directory.
- No merge to `main` until the complete Pathways mission is implemented and certified.

## Working Evidence Table

| Domain | Evidence | Initial classification | Collision/risk | Next proof |
|---|---|---|---|---|
| Public `/learn` + careers | Pending detailed audit | UNRESOLVED | possible duplicate career taxonomy | inspect route/data source/metadata |
| Learner identity/profile | Existing canonical learner architecture | REUSE | duplicate identity if Pathways invents profile | inspect DB/function ownership |
| Student Home/Profile | Existing learner operating surfaces | EXTEND | duplicate Pathways dashboard | inspect current data contracts |
| Twin | Existing student brain/chat architecture | KEEP SEPARATE | second recommendation brain | inspect canonical inputs/outputs |
| Assessment | Existing assessment engine | UNRESOLVED | semantic mismatch if forced reuse | inspect session/question/results primitives |
| School identity/discovery | Existing national identity/search subsystem | REUSE/EXTEND | duplicate school directory | inspect live canonical IDs + search APIs |
| Auth/onboarding | Existing canonical resolver work | REUSE/EXTEND | second routing state machine | inspect current resolver and continuation options |
| SEO | Existing sitemap/robots infrastructure | EXTEND | duplicate canonical/public intent | inspect current generation rules |
| Analytics/observability | Pending | UNRESOLVED | blind acquisition funnel | inspect event tables/code |

## Exit Criteria

P0.0 closes only when:

1. The repository topology and live Supabase topology agree or all divergences are recorded.
2. Every P0 dependency has an ownership classification.
3. Existing canonical IDs and authoritative functions are identified.
4. Duplicate/legacy surfaces that must not be reused are identified.
5. The anonymous continuation strategy has a safe integration point.
6. The first safe implementation slice is specified at file/table/RPC/route level.
7. No unresolved ownership collision remains for P0.1–P0.4.

## Current Action

Run repository archaeology and live Supabase read-only inspection in parallel, then update this ledger with evidence-backed classifications and the exact P0.1 implementation boundary.
