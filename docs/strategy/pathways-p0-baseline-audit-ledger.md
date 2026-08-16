# VibeSchool Pathways — Live P0 Implementation Ledger

**Branch:** `agent/pathways-customer-acquisition-strategy` · **Draft PR:** #168  
**Status:** ACTIVE. **No production migration and no merge until complete exact-head certification.**

## Current-truth precedence

**PR head/workflows → live Supabase → this ledger → execution handoff → older planning docs.**

## Locked ownership

- Learner: reuse `students.id`; no duplicate Pathways learner identity.
- Student Profile: extend with Pathway Passport.
- Student Home: preserve current learning next-action authority; no second dashboard.
- Personalized learning path: keep separate mastery/task domain.
- VibeTwin: future explainer/coach only; not Pathways truth.
- Formal assessment: separate from Quick Check.
- Subjects: reuse canonical global subjects.
- Schools: reuse canonical `schools`; unmatched directory remains discovery evidence.
- Auth/onboarding: `get_my_onboarding_state()` dominates continuation.
- SEO: extend existing sitemap/robots.
- `/learn/careers`: temporary non-authoritative launcher.
- New Pathways concepts only: provenance/graph/decision/Passport.

## Implemented on branch

- `/pathways` free public decision home.
- `/pathways/check` deterministic six-question `pathways-quick-v1`; device-local before consent; honest ambiguity.
- `/pathways/continue` explicit Save bridge; noindex.
- `/pathways/schools` canonical public school finder; verified-only offering filters.
- safe `next` in role login + learner signup; canonical onboarding always dominates.
- Pathways graph migration referencing canonical subjects/schools.
- learner decision history + Pathway Passport migration and Student Profile projection.
- sitemap/robots/metadata integration.
- Pathways Mission Contract CI.

## Branch-only migrations

1. `20260816070000_pathways_canonical_domain.sql` — RLS-governed provenance, pathways, tracks, combinations, canonical-subject edges, careers, career links and canonical-school offering evidence. Only high-level Ministry pathway families seeded.
2. `20260816071000_pathways_passport_and_adoption.sql` — append-only learner decisions, current Passport, idempotent learner adoption, own-passport read.
3. `20260816072000_pathways_public_school_read.sql` — bounded anonymous canonical-school search; excludes unmatched directory; offering filters require verified evidence.

## Safeguarding

Current learner signup remains teacher-code + guardian-first. Anyone can explore Pathways anonymously. Passport Save currently requires an established learner identity. Standalone family/independent-minor identity is a separate safeguarding gate; never weaken guardian requirements or create `pathway_users` for conversion.

## Mission-specific contract

`scripts/test-pathways-contract.mjs` + `.github/workflows/pathways-contract.yml` assert free-before-auth, no direct Quick Check DB dependency, local-before-consent, versioned deterministic scoring, uncertainty, learner-only adoption, canonical identity reuse, RLS, verified-only offerings, bounded public search and crawl/private-route boundaries.

## Exact-head certification

Only the final unchanged head counts. Require on one head:
- Pathways Mission Contract PASS
- Entry Architecture PASS
- Migration Security PASS
- TBL-011 PASS
- TBL-012 PASS
- TypeScript PASS
- ESLint PASS
- production build PASS
- privacy/safeguarding/mobile acceptance PASS

## Remaining

1. Fix/stabilize exact-head CI.
2. Parent/teacher read-only support projections.
3. Privacy-safe funnel analytics.
4. Authoritative track/combination/offering ingestion/reconciliation.
5. Canonical pathway/career pages.
6. Bounded Ask VibeSchool after sufficient evidence coverage.
7. Representative mobile/accessibility/low-literacy acceptance.

## External dependency

National verified offering coverage depends on authoritative Ministry/NEMIS/KNEC evidence and canonical-school reconciliation. Missing evidence means **not yet verified**, never an invented negative.

## Promotion

**Do not merge PR #168 or production-apply its migrations until the complete mission is exact-head certified and promotion is appropriate.**
