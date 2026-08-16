# VibeSchool Pathways — Acquisition Execution Handoff

**Purpose:** Operational continuation document for engineers, product operators and future ChatGPT sessions.  
**Mission branch:** `agent/pathways-customer-acquisition-strategy`  
**Draft PR:** #168  
**Master index:** `docs/strategy/pathways-mission-documentation-index.md`  
**Promotion rule:** Do not merge to `main` until the complete Pathways mission is implemented and exact-head certified.

## 1. Mission Lock

Make Pathways a free, trusted customer-acquisition front door and Kenya education decision/navigation layer for VibeSchool.

Required product loop:

**Discover → Experience free value → Understand/verify → Act → Sign in free only for continuity → Preserve/adopt pathway context → Return → Refer → Optional governed paid assistance later.**

Required decision model:

**ASK → UNDERSTAND → VERIFY → PERSONALIZE → ACT → GET HELP WHEN NEEDED → REMEMBER/CONTINUE.**

Do not reinterpret this mission as “put Pathways behind authentication,” “build a quiz,” “build a generic chatbot,” “publish SEO filler,” or “monetize pathway access.”

## 2. Locked Strategic Decisions

- Core Pathways discovery is free.
- Users receive useful value before the primary sign-in trigger.
- Payment is not required to discover a pathway.
- Authentication is for persistence, continuity and deeper authorized personalization.
- Anonymous Quick Check answers remain on-device until the user explicitly chooses Save.
- Required onboarding cannot be bypassed by a continuation URL.
- `public.students` remains the canonical learner identity.
- Parent/teacher accounts may support a learner but may not silently adopt/overwrite the learner-owned Pathway Passport.
- VibeTwin may later explain Pathways state but is not Pathways truth authority.
- The formal assessment engine is not the public Quick Check.
- Existing national school identity is reused; Pathways does not create another school directory.
- Official facts, learner evidence and VibeSchool guidance remain distinguishable.
- Teacher assistance may later be paid but remains optional.
- Commercial school/teacher relationships cannot alter educational truth or recommendation ranking.
- Learner privacy and safeguarding override conversion.

## 3. Repository / Production Baseline

The audit established that VibeSchool already has canonical learner identity, Student Home/Profile, VibeTwin, formal assessments, global subjects, national school identity/search, auth/onboarding and SEO infrastructure.

Before this branch, production had no dedicated canonical Pathways/Careers/Subject-Combination graph. The correct architecture is therefore **add the missing decision domain while reusing canonical identities and neighboring systems**.

Read `docs/strategy/pathways-p0-baseline-audit-ledger.md` for exact evidence and ownership classifications.

## 4. Current Workstream Board

| Gate | Objective | Status |
|---|---|---|
| P0.0 | repository/live DB collision and ownership audit | substantially resolved; active ledger maintained |
| P0.1 | canonical Pathways truth/provenance domain | implemented on branch; exact-head certification ongoing |
| P0.2 | anonymous state + safe auth continuation | implemented on branch; exact-head certification ongoing |
| P0.3 | Quick Check v1 | implemented on branch; technical certification + representative user testing remain |
| P0.4 | result/action hub | minimum coherent version implemented |
| P0.5 | Pathway Passport | persistence + Student Profile projection implemented; Home projection remains optional/pending |
| P0.6 | parent/teacher read-only support projections | pending |
| P1.0 | authoritative senior-school/pathway/combination population | architecture ready; authoritative population dependency outstanding |
| P1.1 | canonical public pathway knowledge pages | high-level landing implemented; dedicated entity pages pending |
| P1.2 | career decision graph/pages | pending; `/learn/careers` remains non-authoritative legacy navigation |
| P1.3 | school/combination finder | safe public finder foundation implemented; verified offering population pending |
| P1.4 | bounded Ask VibeSchool | pending sufficient graph coverage |
| P2 | #1 SEO + AI authority campaign | technical foundation underway; external rank/citation measurement waits for deployment/indexing |
| P3 | Listen/Kiswahili/voice | pending canonical truth maturity |
| P4 | verified teacher assistance/commercial layer | later; free core first |

## 5. Implemented Branch Artifacts

### Public Pathways
- `app/pathways/page.tsx`
- canonical URL `https://www.vibeschool.co.ke/pathways`
- multiple entry doors
- “Answer first. Sign in later.”
- high-level Kenyan pathway-family orientation

### Quick Check
- `lib/pathways/quickCheck.ts`
- `app/pathways/check/page.tsx`
- `app/pathways/check/layout.tsx`
- six short deterministic prompts
- version `pathways-quick-v1`
- close/tie uncertainty behavior
- no fake match percentages
- localStorage persistence
- no server/database write before explicit Save

### Consent/continuation
- `app/pathways/continue/page.tsx`
- `app/pathways/continue/layout.tsx` (`noindex`)
- `app/login/[role]/page.tsx` safe `next`
- `app/signup/student/page.tsx` safe `next`
- canonical `get_my_onboarding_state()` remains dominant

### Canonical knowledge migration — branch only, not production-applied
`supabase/migrations/20260816070000_pathways_canonical_domain.sql`

Creates RLS-governed:
- `pathway_sources`
- `pathways`
- `pathway_tracks`
- `pathway_subject_combinations`
- `pathway_combination_subjects`
- `pathway_careers`
- `pathway_career_links`
- `pathway_school_offerings`

It references existing canonical `subjects` and `schools`. Only the three high-level Ministry pathway families are seeded. Detailed relationships remain unpublished until evidence-backed ingestion exists.

### Pathway Passport migration — branch only
`supabase/migrations/20260816071000_pathways_passport_and_adoption.sql`

Creates:
- append-only `student_pathway_decisions` evidence/history;
- current `student_pathway_passports` projection;
- idempotent authenticated adoption RPC;
- learner-owned passport read RPC.

Client/service:
- `lib/pathways/student.ts`
- Student Profile now shows **My Pathway Passport**.

### Safe public school finder — branch only
`supabase/migrations/20260816072000_pathways_public_school_read.sql`

`pathways_search_public_schools(...)` exposes:
- active canonical schools only;
- bounded safe identity/location/category fields;
- no unmatched directory candidates;
- no membership/private contact/account data;
- pathway/combination filters only where an offering is verified.

UI/service:
- `lib/pathways/public.ts`
- `app/pathways/schools/page.tsx`
- `app/pathways/schools/layout.tsx`

### SEO/indexing
- existing `app/sitemap.ts` now contains `/pathways`, `/pathways/check`, `/pathways/schools`;
- existing `app/robots.ts` explicitly allows the public Pathways namespace;
- private continuation is noindex.

## 6. Critical Account/Safeguarding Constraint

The current canonical learner signup is deliberately teacher-code + guardian-first. A completely new Pathways visitor who is not already represented as a school-linked learner cannot automatically become a canonical learner merely to improve conversion.

Current safe behavior:
- everyone may explore anonymously;
- established learner identities may explicitly save into their Pathway Passport;
- parents/teachers cannot overwrite learner-owned adoption;
- a standalone-family/independent-learner acquisition identity model is a separate safeguarding design gate.

**Do not solve this by removing guardian/claim-code requirements from the existing school-linked learner account flow. Do not create a duplicate `pathway_users` learner identity.**

## 7. Funnel Event Contract

Semantic events required, using the minimum data necessary and never sending sensitive answers into marketing analytics:

1. `pathways_landing_viewed`
2. `pathways_started`
3. `pathways_meaningful_progress`
4. `pathways_preliminary_result_viewed`
5. `pathways_auth_prompt_viewed`
6. `pathways_auth_started`
7. `pathways_auth_completed`
8. `pathways_state_restored`
9. `pathways_full_result_viewed`
10. `pathways_saved_or_adopted`
11. `pathways_next_action_completed`
12. `pathways_shared`
13. `pathways_returned`
14. `pathways_assistance_viewed` — future
15. `pathways_assistance_requested` — future
16. `pathways_assistance_paid` — future

Primary business metric: **Activated Pathway Users**, not registrations alone.

## 8. Current Certification State

The repository migration-security contract passed after the Pathways migrations were introduced.

The first Entry Architecture run failed because its old static test expected literal signup hrefs and did not model safe `?next=` continuation. The implementation was not weakened. The regression contract was expanded to prove:
- direct learner/parent signup remains available;
- password login preserves safe continuation only after canonical onboarding is `ready`;
- learner signup follows the same invariant;
- OAuth callback follows the same invariant;
- Pathways sitemap/robots rules are present.

The subsequent Entry Architecture run passed.

The current exact-head certification loop must continue through:
- Supabase Migration Security Contract;
- Entry Architecture Contract;
- TBL-011 clean rebuild;
- TBL-012 repository extractor;
- TypeScript;
- ESLint;
- Next.js production build;
- Pathways-specific adversarial/contract tests once added.

## 9. Immediate Autonomous Work

Continue without user input unless an owner-only business/policy decision is genuinely required:

1. Repair any exact-head CI failure at its root cause.
2. Add Pathways-specific contract tests for scoring, consent boundary, adoption authority and safe public-school filtering.
3. Add parent/teacher read-only support projections using existing relationship/class authority.
4. Audit and implement privacy-safe Pathways analytics writer.
5. Add canonical pathway entity pages from the graph.
6. Build authoritative source ingestion/reconciliation for tracks, combinations and verified school offerings.
7. Coordinate population with the national school-identity mission; never infer canonical identity from fuzzy directory data.
8. Build a canonical career graph and retire/canonicalize conflicting legacy career navigation when replacement evidence exists.
9. Build bounded Ask VibeSchool only after graph coverage is strong enough to answer from evidence.
10. Run mobile/accessibility/low-literacy tests and complete exact-head certification.

## 10. Known External Data Dependency

National-scale verified school-offering coverage depends on acquisition and reconciliation of authoritative Ministry/NEMIS/KNEC evidence. Architecture may be completed without that artifact, but missing evidence must remain **“not yet verified”**, never “does not exist” and never a fabricated fact.

## 11. Experiment Rules

Allowed after baseline analytics: CTA copy/timing, preview depth, result presentation, sharing, referral framing.

Forbidden: hiding free access, false scarcity, deliberate state loss, pay-to-rank educational recommendations, sensitive learner ad targeting, weakening auth/RLS/safeguarding to increase conversion.

## 12. Handoff Protocol

A future chat must:

1. Read `docs/strategy/pathways-mission-documentation-index.md` and every required file.
2. Read `docs/strategy/pathways-p0-baseline-audit-ledger.md`.
3. Inspect PR #168/current branch head and live Supabase before assuming status.
4. Continue the highest-priority unfinished gate.
5. Preserve canonical learner/school/auth/Twin boundaries.
6. Never apply branch migrations to production or merge to `main` until promotion requirements are satisfied.
7. Update this handoff with exact evidence after each certified gate.

Minimum handoff sentence:

> Continue VibeSchool Pathways on `agent/pathways-customer-acquisition-strategy` / draft PR #168. Read the mission index and every required document first, then the P0 baseline ledger. Treat repository documents as mission memory. Continue the highest-priority unfinished gate, preserve canonical identity/truth/safeguarding boundaries, and do not merge or production-apply migrations until the full mission is exact-head certified.
