# Cyborg current-main certification reconciliation — 2026-08-23

Status: EVIDENCE RECONCILIATION / NON-ACTIVATING

Baseline revision: `0b36e472613dbbb00e36fc00e2f03cb424808ebc` (`main`, merge of PR #452)
Historical Cyborg kernel certification head: `e1a7148f4a859d2a838687a4ae6b90c029eb653a` (PR #448)
Historical merge commit: `76be882e377c231cb4ebb5b3f25584f14703d1b0`
Production Supabase project observed: `yauqsxggtuxuykcbrtzf`

## Purpose

Reconcile the historically valid PR #448 repository-kernel certification with the materially newer current `main`, record the live `twin-chat` security-gate proof required by PR #452, and prevent either result from being misrepresented as full production/autonomous-runtime certification.

This document does not activate runtime, schedulers, publishing, payments, authority grants, or any consequential Worker Engine path.

## 1. Historical certification remains valid but revision-bound

PR #448 received explicit exact-head certification at `e1a7148f4a859d2a838687a4ae6b90c029eb653a` for the repository kernel/runtime-gate scope. That certification covered the Cyborg Mission Kernel and its triggered repository gates. It explicitly excluded production persistence/execution adapters, applied-production migration proof, schedulers, automatic publishing, payments, consequential authority, and runtime activation.

The certification is evidence about that exact revision. It does not float forward to later `main` commits.

## 2. Current-main drift

Current `main` is `0b36e472613dbbb00e36fc00e2f03cb424808ebc`, twenty commits beyond the PR #448 merge lineage described in the prior audit and including later Worker Engine governed proof, universal LLM gateway work, chat-session admission, and PR #452 production reconciliation.

Therefore current-main certification must be established from fresh exact-head evidence on the reconciliation PR. Historical #448 CI/review evidence is provenance, not current-head proof.

## 3. Live `twin-chat` proof required by PR #452

Production inspection on 2026-08-23 found active Supabase Edge Function `twin-chat` version `28` with `verify_jwt=true`.

The active function contains the two security controls PR #452 required before production certification:

1. **Cyborg chat admission before provider execution**
   - mission identity is created/resumed before the model call;
   - provider execution rejects a missing mission ID with `CYBORG_MISSION_REQUIRED`;
   - provider requests carry `x-cyborg-mission-id`.
2. **Student entitlement/session gate**
   - student calls require `sessionId`;
   - the function invokes `student_consume_twin_session` before student model execution;
   - policy failures return fail-closed denial responses.

This proves **required security-gate parity** for PR #452's stated production gate.

### Important non-equivalence

The active production function is not text-identical to the repository copy at baseline `0b36e472...`; non-gate Twin prompt/fallback/escalation wording differs. Therefore this evidence must not be described as full source/byte parity. The proven claim is narrower: the deployed function contains both mandatory Cyborg admission and student entitlement controls.

Any later production-source parity programme must reconcile those non-gate differences separately and re-verify the live function after deployment.

## 4. Universal-gateway enforcement gap discovered during reconciliation

The repository has a canonical `CyborgUniversalGateway` and a CI validator that rejects several direct provider patterns under `app/api`, `lib`, `components`, and `scripts`.

However, the validator does not scan `supabase/functions/**` and does not include the Groq endpoint in its forbidden-provider rules. `twin-chat` therefore performs a direct Groq HTTP call outside `lib/cyborg/gateway.ts` while carrying a Cyborg mission ID.

A separate chat-session validator does scan chat entrypoints and requires mission identity/admission before such calls. This is useful, but it is weaker than the proposed stronger invariant **"no Cyborg capability = no LLM"** because `twin-chat` currently creates/resumes a mission identifier locally rather than presenting a short-lived signed capability issued by a central admission service.

Classification:

- mission-tagged chat admission: **IMPLEMENTED / production security gate observed**;
- repository canonical universal gateway: **IMPLEMENTED**;
- every server/Edge Function provider call physically forced through one provider gateway: **NOT YET PROVEN**;
- short-lived signed Cyborg capability required for each provider execution: **NOT YET IMPLEMENTED/PROVEN**.

This reconciliation PR must not silently upgrade those claims.

## 5. Worker Engine relationship

PR #450 restored a current-contract governed Worker Engine adversarial proof for lifecycle, watchdog, authority, fallback, sanitization, durable trigger admission, persistence failure, and structured clarification behavior.

That does not close Worker Engine production mutation topology. The current topology document still identifies production `hq_workforce_tool_gateway_execute(task_id)` as a legacy consequential gateway and a P0 reconciliation target predating the canonical R1.4 capability -> authority -> execution -> independent-verification chain.

Therefore the current truthful state is:

- Worker Engine governed repository proof: **implemented and separately evidenced**;
- Worker Engine -> Cyborg model-call enforcement: **requires explicit integration proof**;
- canonical R1.4 production consequential mutation chain: **PROOF/RECONCILIATION PENDING**;
- full autonomous Worker Engine runtime certification: **PENDING**.

## 6. Exact-head gates for this reconciliation

This evidence/governance-only reconciliation is eligible for repository-scope certification only if its final exact PR head passes all triggered applicable gates, including at minimum:

- Cyborg Mission Kernel Contract;
- Cyborg Universal LLM Gateway;
- Cyborg Chat Session Gateway;
- Worker Engine Governed Proof where triggered/applicable;
- Agent Governance;
- TypeScript / production build / engineering integration and control-plane gates;
- Supabase migration/security gates where triggered.

Independent review must bind any certification to that final exact head.

## 7. Certification boundaries

A green reconciliation may support this statement:

> **Cyborg current-main repository/kernel/chat-security reconciliation — CERTIFIED at exact PR head, subject to recorded gate evidence.**

It must not be expanded into any of these statements without separate evidence:

- full production persistence certification;
- runtime persistence adapter certification;
- runtime execution adapter certification;
- restart/recovery certification;
- bounded autonomous production mission certification;
- cryptographic per-call Cyborg capability enforcement;
- Worker Engine R1.4 production mutation-chain certification;
- scheduler/runtime activation readiness.

## Safety invariant

Runtime activation, schedulers, publishing, payments, consequential authority, and production Worker Engine execution remain outside this reconciliation and remain owner-gated.