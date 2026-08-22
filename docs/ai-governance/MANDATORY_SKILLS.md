# VibeSchool Mandatory Agent Skills

Every AI coding agent, LLM, autonomous worker, reviewer, or repair agent working in this repository must apply the modules in `SKILL_REGISTRY.json`. These are operating controls, not optional suggestions.

## Mandatory core

### repo-truth-first
Inspect current code, types, tests, migrations, workflows, PR state, CI state, production evidence when relevant, and the exact current head before proposing or changing code. Historical chat or handover claims are leads, never proof.

### contract-integrity
Resolve canonical contracts from current source before constructing fixtures, mocks, payloads, interfaces, SQL, RPC calls, APIs or generated types. If code and remembered shapes disagree, current canonical source wins after investigation. Stale shapes must not be preserved for convenience.

### preflight-before-ci
Before claiming a branch is ready for CI, run the narrowest relevant tests plus typecheck, lint, relevant build/compile and changed-file validation required by the affected domain. Do not use remote CI as the first syntax/type/debug loop when a cheaper local or deterministic check exists.

### test-the-test
For new or materially changed regression tests, establish that the test detects the protected failure. Use a safe mutation, negative control, failing fixture, adversarial case or equivalent proof. A test that stays green when its protected behavior is broken is not accepted evidence.

### ci-failure-repair-loop
For every failing required check: bind the failure to the exact candidate SHA; fetch the exact failed job and logs; classify root cause; repair the canonical cause rather than masking the symptom; run appropriate preflight; rerun only what is necessary; repeat until green or a genuine external/owner-only blocker exists. Never relabel a failure as flaky without evidence.

### evidence-and-certification
Use these meanings strictly: IMPLEMENTED = code exists; VERIFIED = relevant behavior has current evidence; CERTIFIED = all required independent/governed gates pass for the exact current candidate; MERGED = GitHub confirms the intended exact head was merged; BLOCKED = a specific unresolved constraint prevents further safe progress. Never substitute one state for another.

### dependency-integrity-loop
If later work exposes a defect in an earlier dependency, verify the defect, identify affected descendants, invalidate stale READY/CERTIFIED evidence, repair the earliest canonical root cause first, re-run affected evidence, then resume the interrupted work. Preserve concurrent work that is provably unaffected.

### escape-hatch-auditor
Inspect changed code and relevant neighboring contracts for `as any`, unsafe `as unknown` coercions, `@ts-ignore`, `@ts-nocheck`, skipped/only tests, disabled lint/type rules, swallowed errors, empty catches, weakened assertions, permissive/bypass mocks, unsafe feature flags and equivalent escape hatches. Existing debt may be documented when truly unrelated; newly introduced bypasses require explicit justification and proof they do not weaken safety.

### security-authority-gate
For auth, DB, Worker Engine, HQ authority, payments or consequential operations, verify tenant isolation, RLS, grants, service-role boundaries, authorization at the trusted boundary, capability/owner gates, secrets handling, destructive-operation controls and fail-closed behavior. UI hiding is never authorization.

### merge-certification-gate
Do not merge until all required checks for the current head are green, exact-head identity is verified, required reviews/obligations are satisfied, unresolved material findings are zero or formally blocked, and the merge uses the verified head. After merge, verify GitHub's merge result and required post-merge state.

### regression-learning
Every preventable material failure should produce a durable regression test, validator, contract assertion, preflight rule, lint rule, CI gate or documented reason why automation is not practical. Prefer prevention over relying on future memory.

### resource-conservation
Prefer repository inspection, focused tests and existing CI evidence over unnecessary deployments or paid external calls. Avoid repeated Vercel/Netlify runs, paid AI generation, destructive DB changes and broad expensive checks unless they add required evidence. Conservation may never be used to skip a required safety/certification gate.

## VibeSchool domain modules

### worker-engine-governance
Applies to workforce/autopilot/agent runtime work. Verify canonical worker identity, capability grants, trigger admission/deduplication, cooldowns, context sanitization, clarification persistence, approval/escalation, fallback risk, independent watchdog, retries/idempotency, stop/rollback semantics and commissioning state. Runtime remains off unless explicitly authorized.

### supabase-rls-security
Applies to schema, migrations, SQL, Auth, Storage, RPCs, Edge Functions and generated DB types. Verify reconstruction, forward-only migration safety, RLS coverage, policy semantics, grants/default privileges, SECURITY DEFINER search paths/authorization, service-role boundaries, tenant/school isolation and type/schema consistency. Production mutation requires the repository's authorization gates.

### content-factory-quality
Applies to curriculum/content creation, repair, review and publishing. Verify exact curriculum identity, source fidelity, coverage, semantic/quality evidence, learner safety, independent reviewer separation, stale-version invalidation and rendered artifact quality. Publishing remains gated by explicit governed approval.

### hq-ux-operational-truth
HQ must display operational truth, not aspirational labels. Distinguish certified, commissioned, authorized, available, working, waiting, blocked, stopped and stale. Evidence, failure reason and next action must be understandable and usable on supported devices. Frontend state must reconcile with backend/database truth.

### journey-integrity
For Teacher, Student, Parent and School Admin changes, verify the complete journey and shared contracts across auth, identity, school membership, navigation, data creation, evidence, notifications and role boundaries. A locally green screen is insufficient if the end-to-end journey is broken.

### production-readiness
Verify configuration/environment truth, deployment build, migration compatibility, feature flags, rollback/recovery, observability, security gates and post-deployment checks. Never infer production readiness from a preview or historical deployment.

### observability-watchdog-reliability
Verify meaningful events/metrics, telemetry freshness, worker/system heartbeat freshness, alerting, independent watchdog behavior, failure visibility, timeout/retry/recovery semantics and evidence that monitoring itself fails closed when required data is missing or stale.

## Application rule

The twelve core modules apply to every engineering mission. Domain modules apply whenever the task touches that domain. If more than one domain applies, combine the modules; do not pick only the easiest one.

The executable validator checks that these modules remain registered and referenced by the universal agent entrypoint. Repository control-plane and domain-specific CI remain authoritative for deeper executable proof.
