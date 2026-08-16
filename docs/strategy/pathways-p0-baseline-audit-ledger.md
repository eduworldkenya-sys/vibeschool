# VibeSchool Pathways — Live P0 Implementation Ledger

**Branch:** `agent/pathways-customer-acquisition-strategy` · **Draft PR:** #168  
**Status:** ACTIVE. **No production migration and no merge until complete exact-head certification.**

Current-truth precedence: **PR head/workflows → live Supabase → this ledger → execution handoff → older plans.**

## Locked architecture

- Reuse `students.id`, canonical global subjects, canonical `schools`, canonical auth/onboarding and existing SEO infrastructure.
- Extend Student Profile with Pathway Passport; do not create a second learner dashboard.
- Keep formal assessment, mastery recommendations and VibeTwin as neighboring domains; none owns Pathways truth.
- Keep unmatched school-directory records as discovery evidence, never canonical public truth.
- Add only the missing provenance-backed Pathways graph, decision history, Passport and verified offering relationships.

## Implemented branch surfaces

- `/pathways` — free public decision home.
- `/pathways/check` — deterministic six-question `pathways-quick-v1`; device-local before consent; honest ambiguity.
- `/pathways/continue` — explicit Save bridge; noindex.
- `/pathways/schools` — canonical public school finder; verified-only offering filters.
- safe `next` in role login + learner signup, subordinate to `get_my_onboarding_state()`.
- Student Profile **My Pathway Passport**.
- sitemap/robots/metadata integration.
- Pathways Mission Contract workflow.

## Branch-only migrations

1. `20260816070000_pathways_canonical_domain.sql` — RLS-governed provenance, pathways, tracks, combinations, canonical-subject edges, careers, career links and canonical-school offering evidence. Only high-level Ministry pathway families seeded.
2. `20260816071000_pathways_passport_and_adoption.sql` — append-only learner decisions, current Passport, idempotent learner adoption, own-passport read.
3. `20260816072000_pathways_public_school_read.sql` — bounded anonymous canonical-school search; excludes unmatched directory; offering filters require verified evidence.

## Safeguarding

Current learner signup remains teacher-code + guardian-first. Anyone can explore Pathways anonymously. Current Passport Save requires an established learner identity. Standalone family/independent-minor identity is a separate safeguarding gate; never weaken guardian requirements or create `pathway_users` for conversion.

## Exact-head certification

Final unchanged head must pass:
- Pathways Mission Contract
- Entry Architecture
- Migration Security
- TBL-011 clean rebuild
- TBL-012 repository extraction
- TypeScript
- ESLint
- production build
- privacy/safeguarding/mobile acceptance

Earlier green runs are diagnostic only after the head changes.

## Remaining critical work

1. Stabilize/fix exact-head CI.
2. Parent/teacher read-only support projections.
3. Privacy-safe funnel analytics.
4. Authoritative track/combination/offering ingestion and reconciliation.
5. Canonical pathway/career pages.
6. Bounded Ask VibeSchool after sufficient evidence coverage.
7. Representative mobile/accessibility/low-literacy acceptance.

National verified offering coverage depends on authoritative Ministry/NEMIS/KNEC evidence and canonical-school reconciliation. Missing evidence means **not yet verified**, never an invented negative.

**Do not merge PR #168 or production-apply its migrations until the complete mission is exact-head certified and promotion is appropriate.**
