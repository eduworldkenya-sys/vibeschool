# Content Factory R2.1 — Research Worker Handover

Date: 2026-08-18

## Scope

R2.1 converts VibeSchool research from a mostly manual/HQ intelligence workflow into a governed queued-work contract that sits on top of the Worker Engine. It deliberately does **not** create another worker platform or another durable queue.

Architecture boundary:

- Worker Engine owns execution identity, objective/plan authority, capability/skill certification, scoped authority, budgets, retries, leases, dead letters, circuit breakers and operator stops.
- Content Factory owns the curriculum research job, evidence semantics, source provenance and editorial outcome.

## Starting state

Repository: `eduworldkenya-sys/vibeschool`

R2 branch: `agent/content-factory-r2-worker-engine-20260818`

Branch base: `0667f3e3b77d0a35fb55202ec2bb769845ba63e3` (main after Worker Engine recovery PR #237 merge)

PR #233 (`Content Factory throughput closure`) was already merged as R1 remediation/throughput foundation. PR #237 (`Worker Engine R1.4 production recovery`) was merged after its exact-head recovery, WE-R1.4, TypeScript/build and production-build-contract checks were green.

Production Supabase was inspected read-only during R2.1. Its migration ledger still ended at `20260818111900_worker_engine_we_r1_3x_production_reconciliation_bridge` at the time of this handover. Therefore neither the later R1.4 recovery set nor `20260818114500_content_factory_throughput_closure` had been promoted through the certified production path. R2.1 must not be promoted out of order.

No production DDL, production data mutation, Edge Function deployment or Vercel deployment was performed by R2.1 development.

## Investigation findings

### 1. The old Workforce bus is not the Content Factory executor

The older work-bus path can complete a worker run after a `triage_and_own` side effect. That is operational triage, not domain research execution. R2 therefore binds Content Factory to the newer Worker Engine task/authority contract instead of extending the legacy pseudo-execution path.

### 2. A research Edge Function already existed, but it was not the queued Research Worker

`supabase/functions/curriculum-intelligence-research/index.ts` is an HQ/manual curriculum-intelligence generator. It selects a watch target, calls Tavily and Groq directly, and creates a proposal. It does not consume `curriculum_research_jobs` and does not run through the newer Worker Engine consequential task/budget authority chain.

It is retained as legacy intelligence intake for now. R2.1 does not duplicate or silently replace it.

### 3. The existing research evidence gate could over-certify

The previous `finalize_research_job` used source count, primary-source count, authority score and contradictions, but did not require a source to have a trusted semantic verification method before counting it as support.

Live production inspection found three source records with `supports_claim=true`, `contradicts_claim=false`, and `verification_method=NULL`. These historical rows are preserved for auditability but R2.1 explicitly refuses to treat them as certified supporting evidence.

## R2.1 implementation

### Migration `20260818131000_content_factory_r2_research_worker_bridge.sql`

Adds a domain-to-Worker-Engine binding on `curriculum_research_jobs`:

- `workforce_task_id`
- `workforce_budget_reservation_id`
- `executor_version`
- `execution_metadata`

Adds the approved tool-contract vocabulary for `content.research.external` / capability `content.research.execute`.

Adds service-only RPCs:

- `hq_content_research_claim(task_id, job_id, lease_seconds)`
- `hq_content_research_complete(task_id, job_id, execution_evidence)`
- `hq_content_research_fail(task_id, job_id, error)`

The claim boundary requires Worker Engine runtime to be enabled and delegates consequential authority to `hq_workforce_assert_consequential_task_authorized`. It then reserves execution budget and binds the domain job to the authorized Worker Engine task.

Failure releases budget, keeps task/job retry state synchronized, and exhausts into Worker Engine dead-letter + Content Factory `needs_human` instead of pretending completion.

### Migration `20260818131100_content_factory_r2_research_evidence_trust_hardening.sql`

Hardens evidence certification. Only sources explicitly classified by one of the recognized semantic verification methods can count as support:

- `manual_verified`
- `certified_semantic_verifier_v1`

Tavily/search discovery, legacy `supports_claim=true` flags without verification provenance, or any unknown verification method are unverified and force human/certified-verifier escalation.

The finalizer is service-only.

### Edge Function `content-research-worker`

Internal service-only queued research executor.

Lifecycle:

1. Receive an exact Worker Engine task ID + Content Factory research job ID.
2. Claim through `hq_content_research_claim`.
3. Gather candidate sources using Tavily under domain restrictions.
4. Persist source/provenance candidates.
5. Set `supports_claim=NULL`; never infer semantic support from a search snippet.
6. Run the hardened domain finalizer.
7. Complete the Worker Engine task with explicit `evidence_ready` or `needs_human` evidence.
8. On execution failure, release budget and route through retry/dead-letter semantics.

R2.1 intentionally makes **no model call**. The existing content worker is deterministic-first and production currently records it as `paid_ai_allowed=false`. Semantic verification is a separate certified capability, not something source discovery is allowed to invent.

## Certification

Added:

- `scripts/sql/content_factory_r2_research_worker_verify.sql`
- `.github/workflows/content-factory-r2-research-worker.yml`

The contract checks:

- Content Factory uses the existing domain queue rather than creating another queue.
- Research task claims are bound to the Worker Engine consequential authority chain.
- Budget reservation/release and dead-letter paths exist.
- Legacy/untrusted evidence cannot pass the semantic trust boundary.
- Research executor/finalizer RPCs are unavailable to `anon` and `authenticated`.
- R2.1 installation leaves Worker Engine runtime/autonomy/risk and active capability authority fail-closed.
- The Edge Function remains deterministic/no-model and cannot silently grow direct Groq/OpenAI/Anthropic calls.

## Activation boundary

R2.1 is **installation-ready, not activation-authorized**.

Before activation:

1. Promote the already-certified Worker Engine production recovery through its protected production workflow.
2. Verify production migration ledger/runtime invariants.
3. Promote the R1 Content Factory throughput migration through the normal migration path.
4. Re-run Content Factory R1 production certification.
5. Promote R2.1 migrations and deploy `content-research-worker` with JWT verification enabled.
6. Register/certify the `content.research.execute` capability/skill/worker authority and budget in a separate controlled activation change.
7. Run a bounded real research job and verify full task/job/evidence/dead-letter telemetry.

No R2 migration should turn on Worker Engine runtime or create active autonomous authority.

## Known deliberate limitation

R2.1 gathers and packages candidate evidence, but does not itself certify semantic claim support. This is intentional. A source discovery system that auto-labels its own search snippets as proof creates false confidence.

Next worker-stage work should add the certified semantic verifier/evidence packet boundary and then feed a source-grounded Content Authoring Worker. The authoring worker must consume verified evidence; it must not perform hidden research or bypass evidence provenance.

## Commit log

- `d51dc229f0607887051dee2f1169466acb7af145` — governed research worker bridge migration
- `c91f5eff785d45045c2659bc34fc359cd8fca076` — queued deterministic research executor
- `83480cd8cc53c4f1800218fa3597d3c47cc31e08` — evidence trust hardening
- `1cdef450014a64354e527b840b039aee0b37c6e1` — SQL contract
- `75d6bd1dbbc0493906154fc90a9ae21ebbc23914` — R2.1 CI contract workflow

Subsequent certification/fix commits should be appended before R2.1 is declared complete.
