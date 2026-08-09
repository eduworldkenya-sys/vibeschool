# HQ old-value salvage manifest

Date: 2026-08-09
Working branch: `feat/hq-old-value-complete-20260809`

## Acceptance rule

No genuinely valuable old-HQ capability should require returning to an old branch. Old branches may retain different commits or UI code, but only the following may remain there without being ported: hardcoded demo data, dead prototypes, duplicated/superseded implementations, stale product rewrites, weaker authorization patterns, or code whose useful capability is implemented more safely elsewhere.

## Definitive capability map

| Valuable capability discovered in old/donor work | New authoritative destination | Status |
|---|---|---|
| HQ owner command center | `/hq` + hardened server owner layout | PRESERVED / SUPERSEDED |
| Departments / digital company | `/hq/departments` | PRESERVED + stronger |
| Create company work | `/hq/departments` + HQ operating RPCs | PRESERVED |
| Boardroom / decisions | `/hq/decisions` + workforce decision authority | PRESERVED + stronger |
| HQ Twin | `components/hq/TwinDrawer.tsx` | PRESERVED; old/new implementation matched |
| Notifications | `components/hq/NotificationCenter.tsx` | PRESERVED |
| Executive analytics | `/hq/analytics` + `ExecutiveAnalytics.tsx` | PRESERVED |
| Teaching/content operational drilldowns | Executive analytics + owner reports | PRESERVED / SUPERSEDED |
| Product enable/disable authority | HQ product policy + `ProductAuthorityGate` | PRESERVED + stronger |
| Runtime policy evidence | policy evaluation/ack + certification | NEWER / stronger |
| Old Content Studio hub | `/hq/studio` | REBUILT on live data |
| Academy courses | `/hq/studio/academy` + real `courses` | RESTORED live |
| Academy modules | `/hq/studio/academy` + real `modules` | RESTORED live |
| Academy topics | `/hq/studio/academy` + real `topics` | RESTORED live |
| Topic Concept section | `topics.concept_tab` via Academy owner RPC | RESTORED live |
| Topic Kenya Context | `topics.kenya_context_tab` via Academy owner RPC | RESTORED live |
| Topic Common Errors | `topics.common_errors_tab` via Academy owner RPC | RESTORED live |
| Specialist/clinical tip | `topics.clinical_tip_tab` via Academy owner RPC | RESTORED live |
| Topic draft/review/published state | Academy owner RPC | RESTORED live |
| Human rich textbook authoring | `/hq/studio/editor` + global publication editor | RESTORED + expanded |
| eBook authoring | rich editor + live `ebook` DB format | RESTORED |
| Text / headings / lists / quote / callout / code | global block editor | PRESERVED |
| Definition blocks | global block editor | RESTORED |
| Example / worked-example blocks | global block editor | RESTORED |
| Summary / key-points blocks | global block editor | RESTORED |
| Image / diagram | global block editor | RESTORED / hardened |
| Table / equation | global block editor | RESTORED |
| Video / audio | global block editor | RESTORED safely |
| 3D model / simulation references | global block editor | RESTORED safely; arbitrary scripts not embedded |
| Activities / experiments / projects | global block editor | RESTORED |
| VibeLab interactive blocks | global block editor | PRESERVED from newer work |
| Curriculum source registration | `/hq/studio/governance` | RESTORED + owner-wide |
| Curriculum source reviewed/verified/rejected lifecycle | `/hq/studio/governance` + owner RPC | RESTORED + stronger |
| Publication revision history | `/hq/studio/governance` | RESTORED + owner-wide |
| Curriculum grade/subject/week browser | `/hq/studio/curriculum` | RESTORED live |
| Substrand/topic editing | `/hq/studio/curriculum` | RESTORED live |
| Teaching tips | curriculum content context via owner RPC | RESTORED live |
| Common learner mistakes | curriculum content context via owner RPC | RESTORED live |
| Learning outcomes | draft outcome creation + Curriculum Intelligence | RESTORED + stronger |
| Curriculum research/update engine | `/hq/curriculum-intelligence/engine` + active workers | NEWER / stronger |
| Rights/provenance | Curriculum Intelligence | NEWER / stronger |
| Content health / learner feedback | Curriculum Intelligence | NEWER / stronger |
| Exact patch / stale-write protection | Curriculum Intelligence | NEWER / stronger |
| Regeneration / QA / effectiveness | Curriculum Intelligence | NEWER / stronger |
| Exam subject/topic idea | real curriculum + assessment bank | RESTORED without hardcoded subject counts |
| Question bank | `/hq/studio/exams` + `assessment_questions` | RESTORED live |
| Add assessment question | owner-guarded draft creation | RESTORED live |
| Question review | owner approve/reject lifecycle | RESTORED live |
| Global moderation concept | `/hq/studio/moderation` | RESTORED on real sources |
| Exam flags moderation | unified moderation owner RPC | RESTORED live |
| HQ incident moderation/recovery evidence | unified moderation owner RPC | RESTORED + stronger |
| Assessment moderation requests | unified moderation owner RPC | RESTORED live |
| Hardcoded VibePress/VibeVoice/VibeChronicles report examples | NOT COPIED | No corresponding live report source existed; concept is preserved by unified queue |
| FunHub voucher catalog | `/hq/studio/funhub` + `funhub_vouchers` | RESTORED live |
| Voucher XP price | FunHub owner RPC | RESTORED live |
| Voucher stock / claimed / remaining | FunHub owner RPC | RESTORED live |
| Voucher active/inactive state | FunHub owner RPC | RESTORED live |
| XP economy evidence | `funhub_xp` / ledger + Studio overview | PRESERVED live |
| Domains / taxonomy | `/hq/studio/domains` + `hq_content_domains` | RESTORED as governed data |
| Old Health/Trade/Education/Transportation/Technology domains | `hq_content_domains` seed | PRESERVED as real data |
| Publishing review inbox | `/hq/content` Publishing Factory | NEWER / stronger |
| Release certification / no false publication | Publishing Factory | NEWER / stronger |
| Digital workforce engine | `lib/hq/workforce/*` + production workforce DB | NEWER / stronger |
| Deterministic-first worker execution | workforce engine | NEWER / stronger |
| Worker templates/factory/certification | workforce engine | NEWER / stronger |
| Work routing / ownership / approvals | workforce engine | NEWER / stronger |
| Automated operating cycle / Cron boundary | current HQ operating stack | PRESERVED; old repair branch is ancestor/superseded |

## Deliberately not copied

- The old `/hq/studio` React page's hardcoded course names, counts, curriculum coverage percentages, moderation submissions, XP totals, voucher inventories and fake button behavior.
- Old weaker client-only HQ access patterns where the new server owner boundary exists.
- Stale Student/Twin rewrites from HQ hardening branches; Student/Twin has newer independent work and must not be regressed for HQ salvage.
- Duplicate temporary workforce branches whose content is already contained in the consolidated branch.
- Donor VibeLearn rewrite from the unfinished Content Studio PR; its useful editor capabilities were selectively rebuilt without importing the unrelated risky rewrite.

## Security rule

New owner administration paths do not relax ordinary learner/teacher RLS. Where old concepts required owner-wide access, the implementation uses narrow `SECURITY DEFINER` RPCs with `hq_assert_owner()`, fixed `search_path`, `anon` EXECUTE revoked, and authenticated execution gated internally by platform-owner authority.

## Final release rule

This manifest is a capability-completeness record, not permission to merge. The working branch must still pass TypeScript, ESLint, production build, security verification and final branch-delta review before promotion to `main`.
