# Content Factory R2.2 — Semantic Verifier Handover

Date: 2026-08-18

## Mission

R2.2 adds a governed semantic verifier between deterministic source discovery and source-grounded authoring.

The required evidence chain is:

`candidate search result -> deterministic source extraction -> immutable source-material ledger -> PostgreSQL-computed material hash -> Worker Engine model authorization -> structured semantic verdict -> database proof that decisive quoted evidence occurs in stored material -> immutable verdict -> evidence status`

This worker is deliberately separate from the R2.1 Research Worker so source discovery cannot verify its own output.

## Repository scope

Repository: `eduworldkenya-sys/vibeschool`

Branch: `agent/content-factory-r2-semantic-verifier-20260818`

R2.1 Research Worker was merged as PR #238. R2.2 reuses the existing Worker Engine task, model authorization, budget, lifecycle, retry and dead-letter controls rather than creating another AI authority plane.

## Trust defects found and closed

### 1. Search snippets are not proof

The first R2.2 draft still carried the R2.1 source candidate excerpt into the verifier. That would allow a model to classify a search snippet as if it were the underlying source.

The repaired design requires independently retrieved source material. The Edge executor retrieves the source URL using bounded HTTPS extraction and can fall back to Tavily Extract. The material is passed to PostgreSQL, which computes the authoritative SHA-256 and stores the immutable material row before model authorization is issued.

### 2. Executor/database signature drift

After material-binding hardening was added to the database migration, the Edge executor still called the older snippet-bound RPC signatures. The branch therefore could not be certified.

The executor now calls only the material-bound claim and completion signatures and sends `material_id` back on completion.

### 3. Model output cannot self-ground

A decisive `supported` or `refuted` verdict requires confidence >= 0.85 and an evidence excerpt. The database normalizes whitespace/case and verifies the excerpt is an actual substring of the immutable stored material. A hallucinated quotation is rejected before evidence state changes.

### 4. Replay/cross-material substitution is rejected

The Worker Engine model invocation records `material_id`, `material_sha256` and `claim_sha256` in deterministic-failure evidence before the model call. Completion checks the invocation belongs to the same task/worker and that the same material identity/hash was authorized.

### 5. Source fetching now has a network boundary

The executor requires HTTPS, rejects localhost/private IPv4/link-local/local hostnames, revalidates redirects, bounds extraction size, and supports only text-like direct content. Unsupported direct content may fall back to Tavily extraction when configured.

## Database contracts

### `20260818131200_content_factory_r2_semantic_verifier.sql`

Installs the semantic-verdict ledger, verifier tool contract and initial service-only claim/complete/fail functions. It preserves the certified existing Worker Engine handler vocabulary and adds exactly `content.evidence.semantic_verify`.

### `20260818131210_content_factory_r2_semantic_material_binding.sql`

Adds the immutable source-material ledger and makes `material_id` mandatory on semantic verdicts. The old snippet-bound claim/complete overloads are non-callable. The service-role executable overloads require retrieved material and material identity.

No migration activates Worker Engine runtime, autonomy, risk, worker lifecycle or capability authority.

## Edge executor

`supabase/functions/content-semantic-verifier/index.ts`

Lifecycle:

1. Require service-role authorization at the Edge boundary.
2. Load the exact candidate source row.
3. Retrieve underlying HTTPS source material; reject local/private network targets and unsafe redirects.
4. Call `hq_content_semantic_verifier_claim(...)` with the retrieved material.
5. PostgreSQL computes/stores the material hash and obtains Worker Engine model authorization.
6. Call the configured Groq model only after the governed claim succeeds.
7. Parse strict structured JSON.
8. Locally reject ungrounded decisive excerpts as an early guard.
9. Call `hq_content_semantic_verifier_complete(...)` with the exact material ID.
10. PostgreSQL independently rechecks task/model/material binding and quoted evidence grounding before writing the immutable verdict and updating trusted evidence status.
11. On failure, finalize/release the model reservation and follow Worker Engine retry/dead-letter semantics.

The model is a classifier, not evidence authority. PostgreSQL remains the evidence-state authority.

## Certification added

- `scripts/sql/content_factory_r2_semantic_verifier_verify.sql`
- `.github/workflows/content-factory-r2-semantic-verifier.yml`

The dedicated contract verifies:

- material/verdict ledgers exist, have RLS enabled, are immutable and service-only;
- browser roles cannot execute verifier RPCs;
- old snippet-bound service-role RPCs are not callable;
- the verifier extends rather than narrows the existing Worker Engine handler vocabulary;
- material SHA-256 is computed inside PostgreSQL before model authorization;
- task/source/material/claim binding is carried into Worker Engine model evidence;
- decisive excerpts must occur inside immutable stored material;
- failure releases/finalizes model reservation and routes to dead letter after retry exhaustion;
- R2.1 finalization recognizes only trusted semantic verification provenance;
- installation leaves runtime disabled, autonomy L0, max risk 0 and zero active capability-authority grants;
- the executor calls material-bound claim -> model verification -> material-bound completion in that order;
- the executor no longer references `claim.evidence_excerpt` as source proof;
- Deno type-checks the Edge executor.

## Production boundary — read-only verification 2026-08-18

Production Supabase project `yauqsxggtuxuykcbrtzf` was inspected read-only.

Observed Worker Engine/content migration ledger at or after `20260818110000`:

- `20260818111900` — `worker_engine_we_r1_3x_production_reconciliation_bridge`
- `20260818125000` — curriculum authority source pipeline
- `20260818130000` — curriculum authority hierarchy binding
- `20260818133000` — curriculum authority operator intake

Still absent in production:

- `public.hq_workforce_capability_authority_grants`
- `public.curriculum_semantic_materials`
- `public.curriculum_semantic_verdicts`

Therefore R2.2 production promotion/activation is blocked. No production DDL/data mutation or Edge Function deployment was performed during this work.

## Promotion/activation prerequisites

1. Complete and verify the protected Worker Engine R1.4 production recovery beyond `20260818111900`.
2. Verify the production capability-authority plane exists and engine remains fail-closed.
3. Promote/certify required Content Factory R1/R2.1 migrations in dependency order.
4. Merge R2.2 only after exact-current-main CI is green.
5. Promote R2.2 migrations through the governed production migration path.
6. Deploy `content-semantic-verifier` with JWT verification and required service/Groq/Tavily secrets.
7. Register/certify the semantic verifier worker/skill/capability and bounded token budget in a separate activation change.
8. Run a bounded canary using one known-supported, one known-refuted and one insufficient source; verify immutable materials, model reservations, verdicts, evidence status, retries and telemetry.
9. Only after canary evidence is accepted may the source-grounded Authoring Worker consume `certified_semantic_verifier_v1` evidence.

## Non-negotiable authoring boundary

The next Authoring Worker must consume verified evidence packets. It must not silently search the web, treat model memory as curriculum truth, certify its own sources, or write official curriculum authority. Editorial/official promotion remains separately governed.

## Vercel

No Vercel tool or deployment was intentionally invoked during R2.2 branch work. Keep the branch isolated until exact-head certification is complete; merge only once the full R2.2/current-main gate is green.
