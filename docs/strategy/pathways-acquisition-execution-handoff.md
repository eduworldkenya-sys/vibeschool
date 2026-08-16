# VibeSchool Pathways — Acquisition Execution Handoff

**Branch:** `agent/pathways-customer-acquisition-strategy` · **Draft PR:** #168  
**Promotion:** no merge to `main` and no production application of branch migrations until the complete mission is exact-head certified.

## Mission

**Discover → free value → understand/verify → act → sign in only for continuity → preserve/adopt → return → refer → optional governed human help later.**

**ASK → UNDERSTAND → VERIFY → PERSONALIZE → ACT → HELP WHEN NEEDED → REMEMBER/CONTINUE.**

## Current implementation

Read current PR/workflows and live Supabase first, then `pathways-p0-baseline-audit-ledger.md`.

Implemented on branch:
- `/pathways` free public decision home;
- `/pathways/check` six-question deterministic anonymous Quick Check, device-local before consent;
- `/pathways/continue` noindex Save/continuation bridge;
- safe `next` in role login + learner signup, subordinate to `get_my_onboarding_state()`;
- provenance-backed canonical Pathways graph migration referencing existing subjects/schools;
- learner decision history + Pathway Passport migration and Student Profile projection;
- safe public `/pathways/schools` over active canonical schools, with verified-only offering filters;
- sitemap/robots/metadata integration;
- dedicated Pathways Mission Contract CI.

All Pathways migrations are **branch-only, not production-applied**.

## Non-negotiable boundaries

- free core and value before primary sign-in;
- no second learner identity, school identity, auth router, sitemap authority or Pathways truth brain;
- formal assessments and mastery recommendations remain separate domains;
- Twin is a future explainer/coach consumer, not Pathways authority;
- anonymous answers remain local until explicit Save;
- parent/teacher support cannot overwrite learner adoption;
- missing offering evidence means “not yet verified”, not “does not exist”;
- commercial relationships never alter educational truth/ranking;
- existing school-linked learner signup remains teacher-code + guardian-first.

## Work board

| Gate | Status |
|---|---|
| P0.0 ownership/collision audit | substantially resolved |
| P0.1 canonical truth/provenance | implemented; certify |
| P0.2 anonymous state/auth continuation | implemented; certify |
| P0.3 Quick Check | implemented; certify + user test |
| P0.4 result/action hub | minimum coherent version implemented |
| P0.5 Pathway Passport | implemented in Student Profile |
| P0.6 parent/teacher read-only projections | pending |
| P1.0 authoritative tracks/combinations/offerings | source/identity dependency |
| P1.1 pathway entity pages | pending |
| P1.2 career graph/pages | pending |
| P1.3 school finder | foundation implemented; offering population pending |
| P1.4 bounded Ask VibeSchool | pending evidence coverage |
| P2 SEO/AI authority campaign | technical foundation started |
| P3 voice/Kiswahili | later |
| P4 teacher assistance | later |

## Certification

Only the final unchanged head counts. Require on the same head:
- Pathways Mission Contract;
- Entry Architecture Contract;
- Supabase Migration Security Contract;
- TBL-011 clean rebuild;
- TBL-012 repository extraction;
- TypeScript;
- ESLint;
- Next.js production build;
- privacy/safeguarding/mobile E2E acceptance.

## Immediate autonomous work

1. Repair exact-head CI failures.
2. Add parent/teacher read-only support projections.
3. Implement privacy-safe funnel analytics.
4. Build evidence ingestion/reconciliation for tracks, combinations and school offerings.
5. Add canonical pathway/career entity pages.
6. Build bounded Ask VibeSchool only from sufficient canonical evidence.
7. Run representative mobile/accessibility/low-literacy acceptance.
8. Keep PR draft until full promotion criteria are met.

## Safeguarding/account dependency

A brand-new anonymous visitor can always use Pathways. Current Passport save requires an established canonical learner identity. A standalone family/independent-minor acquisition identity is a separate safeguarding gate; never weaken guardian requirements or create `pathway_users` merely to improve conversion.

## External data dependency

National verified offering coverage depends on authoritative Ministry/NEMIS/KNEC evidence and canonical-school reconciliation. Never fabricate missing facts.

## Handoff

> Continue Pathways on `agent/pathways-customer-acquisition-strategy`, draft PR #168. Read the mission index, every required strategy document, the live P0 ledger and this handoff. Inspect current GitHub/Supabase before acting. Continue the highest-priority unfinished gate, preserve canonical identity/truth/safeguarding boundaries, and do not merge or production-apply migrations until the full mission is exact-head certified.
