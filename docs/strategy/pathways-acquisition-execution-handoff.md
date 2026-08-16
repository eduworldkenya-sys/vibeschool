# VibeSchool Pathways — Execution Handoff

**Branch:** `agent/pathways-customer-acquisition-strategy` · **Draft PR:** #168  
**Promotion:** keep draft; no production migration/no merge until full exact-head certification.

## Mission

**Discover → free value → understand/verify → act → sign in only for continuity → preserve/adopt → return → refer → optional governed help later.**

**ASK → UNDERSTAND → VERIFY → PERSONALIZE → ACT → HELP WHEN NEEDED → REMEMBER/CONTINUE.**

## Read first

For current status, inspect PR #168 + live Supabase, then read `pathways-p0-baseline-audit-ledger.md`. That ledger supersedes stale checklist language in older plans.

## Current branch state

Implemented:
- public `/pathways`;
- anonymous deterministic `/pathways/check` with device-local pre-consent state;
- explicit/noindex `/pathways/continue` Save bridge;
- canonical-onboarding-safe `next` in role login and learner signup;
- provenance-backed Pathways graph migration referencing canonical subjects/schools;
- learner decision history + Pathway Passport persistence and Student Profile projection;
- bounded anonymous canonical `/pathways/schools` finder with verified-only offering filters;
- sitemap/robots/metadata integration;
- dedicated Pathways Mission Contract CI.

All Pathways migrations remain branch-only and are not applied to production.

## Locked boundaries

Free core; no second learner/school/auth/SEO/truth engine; formal assessment and mastery recommendations remain separate; Twin is an explainer later; parent/teacher support cannot overwrite learner adoption; commercial relationships cannot affect truth/ranking; missing offering evidence means not yet verified; existing guardian-first learner account safeguards remain intact.

## Work board

- P0.0 ownership audit — substantially resolved.
- P0.1 truth/provenance — implemented; certify.
- P0.2 anonymous/continuation — implemented; certify.
- P0.3 Quick Check — implemented; certify + user test.
- P0.4 result/action hub — minimum coherent version implemented.
- P0.5 Passport — implemented in Student Profile.
- P0.6 parent/teacher projections — pending.
- P1.0 authoritative population — source/identity dependency.
- P1.1 pathway entity pages — pending.
- P1.2 career graph/pages — pending.
- P1.3 school finder — foundation implemented; offering data pending.
- P1.4 Ask VibeSchool — pending graph coverage.
- P2 SEO/AI authority — technical foundation started.
- P3 voice/Kiswahili — later.
- P4 teacher assistance — later.

## Exact-head certification

Final unchanged head must pass Pathways Mission Contract, Entry Architecture, Migration Security, TBL-011, TBL-012, TypeScript, ESLint, production build and privacy/safeguarding/mobile acceptance.

## Continue autonomously

1. Fix exact-head CI.
2. Add parent/teacher read-only support projections.
3. Add privacy-safe funnel analytics.
4. Build authoritative tracks/combinations/offering ingestion/reconciliation.
5. Add canonical pathway/career pages.
6. Add bounded Ask VibeSchool only from sufficient evidence.
7. Run representative mobile/accessibility/low-literacy acceptance.

## Safeguarding/account constraint

Anyone can use Pathways anonymously. Current Passport Save needs an established canonical learner identity. A standalone family/independent-minor account model is a separate safety design gate; never weaken guardian rules or create a duplicate Pathways learner identity just to improve conversion.

## External dependency

National verified offering coverage depends on authoritative Ministry/NEMIS/KNEC evidence and canonical school reconciliation. Never fabricate missing facts.

## New-chat handoff

> Continue Pathways on `agent/pathways-customer-acquisition-strategy`, draft PR #168. Read the mission index, all required documents, the live P0 ledger and this handoff. Inspect current GitHub/Supabase before changing code. Continue the highest-priority unfinished gate and do not merge or production-apply migrations until full exact-head certification.
