# VibeSchool Pathways — Acquisition Execution Handoff

**Purpose:** Operational continuation document for engineers, product operators and future ChatGPT sessions.  
**Mission branch:** `agent/pathways-customer-acquisition-strategy`  
**Draft PR:** #168  
**Master index:** `docs/strategy/pathways-mission-documentation-index.md`  
**Promotion rule:** Do not merge to `main` until the complete Pathways mission is implemented and exact-head certified.

## Mission Lock

**Discover → free value → understand/verify → act → sign in only for continuity → preserve/adopt → return → refer → optional governed paid assistance later.**

Canonical decision model: **ASK → UNDERSTAND → VERIFY → PERSONALIZE → ACT → GET HELP WHEN NEEDED → REMEMBER/CONTINUE.**

## Current Status Pointer

Do not infer current state from this file alone. Read, in order:
1. current PR #168 head/workflows;
2. live Supabase evidence;
3. `pathways-p0-baseline-audit-ledger.md`;
4. this handoff.

## Implemented on Branch

- Public `/pathways` acquisition/decision home.
- Anonymous `/pathways/check`, six deterministic prompts, `pathways-quick-v1`, device-local pre-consent state, honest ambiguity.
- `/pathways/continue` Save bridge, noindex.
- Safe `next` integration in role login and learner signup; canonical onboarding always dominates.
- Canonical provenance-backed Pathways graph migration referencing existing subjects and schools.
- Learner decision history + Pathway Passport migration and idempotent adoption RPC.
- Student Profile Pathway Passport projection.
- Safe anonymous canonical school-read RPC plus `/pathways/schools`; pathway filtering requires verified offering evidence.
- Sitemap/robots/metadata integration.
- Pathways-specific mission contract workflow covering free-first, consent, identity reuse, RLS/truth boundaries and public-school filtering.

All Supabase migrations remain branch-only and have **not** been applied to production.

## Locked Boundaries

- No second learner identity.
- No second school identity.
- No second Pathways truth brain.
- VibeTwin consumes/explains later; it does not own Pathways truth.
- Formal classroom assessments are not the Quick Check.
- Existing mastery recommendations are not future-pathway recommendations.
- Anonymous answers remain local until explicit Save.
- Parent/teacher support does not overwrite learner-owned adoption.
- Commercial relationships do not influence educational truth/ranking.
- Missing offering evidence means “not yet verified,” not “does not exist.”
- Existing school-linked learner signup remains guardian-first/teacher-code based; do not weaken it for conversion.

## Current Work Board

| Gate | State |
|---|---|
| P0.0 ownership/collision audit | substantially resolved |
| P0.1 canonical truth/provenance | implemented; certify |
| P0.2 anonymous state/continuation | implemented; certify |
| P0.3 Quick Check | implemented; certify + user test |
| P0.4 result/action hub | minimum coherent version implemented |
| P0.5 Pathway Passport | implemented in Student Profile |
| P0.6 parent/teacher support views | pending |
| P1.0 authoritative track/combination/offering population | source/identity dependency |
| P1.1 pathway entity pages | pending |
| P1.2 canonical career graph/pages | pending |
| P1.3 school finder | foundation implemented; verified offering population pending |
| P1.4 bounded Ask VibeSchool | pending graph coverage |
| P2 SEO/AI authority | technical foundation started |
| P3 voice/Kiswahili | later |
| P4 teacher assistance | later |

## Certification

Only a **single current exact head** can be certified. Older green runs do not count after the branch moves.

Final candidate must pass:
- Pathways Mission Contract;
- Entry Architecture Contract;
- Supabase Migration Security Contract;
- TBL-011 clean rebuild;
- TBL-012 repository extraction;
- TypeScript;
- ESLint;
- Next.js production build;
- privacy/safeguarding/mobile E2E acceptance.

The migration-security gate passed on earlier implementation heads. Entry Architecture initially exposed a stale test assumption after safe `next` was added; the test was strengthened, not the safety behavior weakened, and the next run passed.

## Immediate Autonomous Work

1. Run/repair exact-head certification.
2. Add parent/teacher read-only Pathway Passport projections under existing relationship/class authority.
3. Audit/implement privacy-safe funnel analytics.
4. Build provenance-governed authoritative ingestion/reconciliation for tracks, combinations and school offerings.
5. Build canonical pathway entity pages and career graph/pages.
6. Build bounded Ask VibeSchool only after evidence coverage is sufficient.
7. Run representative mobile/accessibility/low-literacy tests.
8. Keep PR #168 draft and production untouched until mission promotion criteria are satisfied.

## External Data Dependency

National-scale verified school/pathway/combination coverage depends on authoritative Ministry/NEMIS/KNEC evidence and canonical-school reconciliation. Architecture can proceed, but evidence must never be fabricated.

## New-Visitor Identity Constraint

A completely new anonymous visitor can always use Pathways for free. Saving into the current canonical learner Passport requires an established learner identity. Designing a standalone family/independent-minor acquisition identity is a separate safeguarding gate; do not bypass existing guardian requirements or create `pathway_users`.

## Handoff Sentence

> Continue VibeSchool Pathways on `agent/pathways-customer-acquisition-strategy`, draft PR #168. Read the mission index and all required documents, then the live P0 ledger. Inspect current GitHub/Supabase before acting. Continue the highest-priority unfinished gate, preserve canonical identity/truth/safeguarding boundaries, and do not merge or production-apply migrations until the full mission is exact-head certified.
