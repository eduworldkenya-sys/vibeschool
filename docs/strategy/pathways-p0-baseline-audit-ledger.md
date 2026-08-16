# VibeSchool Pathways — P0 Baseline, Ownership & Implementation Ledger

**Branch:** `agent/pathways-customer-acquisition-strategy` · **Draft PR:** #168  
**Status:** ACTIVE  
**Safety:** branch migrations are not production-applied; no merge until complete exact-head certification.

## Current Status Precedence

**PR head/workflows → live Supabase → this ledger → execution handoff → older planning docs.**

## Ownership decisions

| Domain | Decision |
|---|---|
| learner identity | reuse `students.id`; no Pathways learner identity |
| Student Profile | extend with Pathway Passport |
| Student Home | preserve current learning next-action authority; optional projection later |
| personalized learning path | keep separate: mastery/task recommendations |
| VibeTwin | keep separate: future explainer/coach, not Pathways truth |
| formal assessment | keep separate: Quick Check is not graded assessment |
| subjects | reuse canonical global `subjects` |
| schools | reuse canonical `schools`; unmatched directory remains discovery evidence |
| auth/onboarding | reuse `get_my_onboarding_state()`; continuation cannot bypass it |
| SEO | extend existing sitemap/robots |
| legacy `/learn/careers` | temporary learning launcher, not national career authority |
| Pathways graph | new bounded provenance-backed domain |
| anonymous Quick Check | device-local before consent |
| Pathway Passport | learner-owned current projection + history |
| public school finder | canonical active schools; verified-only offering filters |

## Implemented branch surfaces

- `/pathways`
- `/pathways/check`
- `/pathways/continue` (`noindex`)
- `/pathways/schools`
- `lib/pathways/quickCheck.ts`
- `lib/pathways/public.ts`
- `lib/pathways/student.ts`
- Student Profile **My Pathway Passport**
- safe `next` in role login + learner signup, subordinate to canonical onboarding
- sitemap/robots/metadata integration

## Implemented branch migrations

### `20260816070000_pathways_canonical_domain.sql`
RLS-governed provenance, pathways, tracks, subject combinations, combination→canonical-subject edges, careers, career links and canonical-school offering evidence. Only three high-level Ministry pathway families are seeded; detailed facts remain unpopulated until record-level evidence exists.

### `20260816071000_pathways_passport_and_adoption.sql`
Append-only learner decision history, current Pathway Passport, idempotent authenticated adoption and own-passport read RPC.

### `20260816072000_pathways_public_school_read.sql`
Bounded anonymous/authenticated canonical-school search. Excludes unmatched directory candidates and requires verified offering evidence when pathway/combination filters are used.

## Safeguarding/account boundary

Existing learner signup is teacher-code + guardian-first. Pathways does not weaken this for conversion. Everyone can use the free anonymous experience; current Passport save requires an established canonical learner identity. A standalone family/independent-minor acquisition identity is a separate safeguarding design gate and must not create a duplicate learner identity.

## Mission-specific CI

- `scripts/test-pathways-contract.mjs`
- `.github/workflows/pathways-contract.yml`

The contract directly checks value-before-auth, local-before-consent, versioned deterministic scoring, uncertainty, learner-only adoption, canonical learner/school reuse, RLS presence, verified-only public offerings, bounded search and crawl/private-route boundaries.

## Certification checkpoint

Earlier evidence:
- Migration Security passed on earlier implementation heads.
- Entry Architecture initially exposed a stale static-href test after safe continuation was added; the test was strengthened and the next run passed.

**Only the final unchanged candidate head counts.** Require on the same head:
- Pathways Mission Contract PASS;
- Entry Architecture PASS;
- Supabase Migration Security PASS;
- TBL-011 clean rebuild PASS;
- TBL-012 repository extraction PASS;
- TypeScript PASS;
- ESLint PASS;
- Next.js production build PASS;
- privacy/safeguarding/mobile acceptance PASS.

## Remaining work

1. Stabilize/fix exact-head CI.
2. Add parent/teacher read-only support projections.
3. Implement privacy-safe funnel analytics.
4. Build authoritative ingestion/reconciliation for tracks, combinations and school offerings.
5. Coordinate offering population with national canonical-school reconciliation.
6. Add canonical pathway entity pages and career graph/pages.
7. Build bounded Ask VibeSchool only when evidence coverage is sufficient.
8. Run representative mobile/accessibility/low-literacy acceptance.

## External dependency

National-scale offering coverage depends on authoritative Ministry/NEMIS/KNEC evidence. Missing evidence remains **not yet verified**, never a fabricated negative.

## Promotion

**Do not merge PR #168 or production-apply its migrations until the complete mission is exact-head certified and promotion is appropriate.**
