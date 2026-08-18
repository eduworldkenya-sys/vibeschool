# Content Factory R2.3 — Source-Grounded Authoring Worker Handover

Date: 2026-08-18

## Mission

R2.3 turns verified curriculum evidence into an editorial **draft**, not published truth.

The authority chain is:

`R2.1 research job evidence_ready -> R2.2 material-bound supported verdicts -> deterministic evidence packet -> Worker Engine model authorization -> evidence-only draft -> database citation verification -> immutable authoring draft -> HQ owner acceptance -> prepared editorial patch -> separate proposal approval/apply`

The Authoring Worker is not allowed to research independently, certify evidence, approve its own draft, apply a patch, or publish content.

## Starting point

R2.2 Semantic Verifier was certified against exact current main and merged as PR #244, merge commit `98ee9c5391349fd60935f5b8abb4d5dff391c2e8`.

R2.3 branch:

`agent/content-factory-r2-source-grounded-authoring-20260818`

The branch was created directly from that merge commit.

## Existing editorial system found

VibeSchool already has `curriculum-intelligence-editorial` and `hq_apply_curriculum_intelligence_proposal`.

The historical editorial executor prepares a patch by taking `patch.content` or `proposed_content` and binding it to the current canonical content block. That is a useful deterministic editorial transport, but it is not a source-grounded authoring authority.

R2.3 therefore does **not** make the model output immediately apply-ready. A machine-produced draft is persisted in a separate immutable ledger and sets `editorial_status='needs_review'`. Only an explicit HQ platform-owner acceptance RPC may convert that draft into the existing `prepared` editorial-patch format. Proposal approval and apply remain separate actions after that acceptance.

## Evidence boundary

The database builds the authoring evidence packet through `hq_content_authoring_evidence_packet(proposal_id)`.

Machine authoring requires:

- a completed `curriculum_research_jobs` row in `evidence_ready` state;
- the proposal itself to remain `verification_status='verified'`;
- no currently unverified source rows;
- no contradictions;
- at least `required_source_count` currently supporting sources verified by `certified_semantic_verifier_v1`;
- each machine-authoring source to have an R2.2 immutable material row and a supported semantic verdict with a grounded evidence excerpt.

`manual_verified` remains a valid R2.1 research trust method, but manual-only evidence is deliberately insufficient for autonomous R2.3 prose generation because it does not necessarily carry R2.2 immutable material binding. Such work stays human-authored unless enough material-bound semantic sources also exist.

The evidence packet contains source identity, URL/title/type/tier/authority, semantic confidence, evidence excerpt, material ID and material SHA. Its SHA-256 is computed inside PostgreSQL and bound to the Worker Engine model authorization together with the proposal claim hash, current target-content hash and target block ID.

## Authoring executor

`supabase/functions/content-authoring-worker/index.ts`

The executor:

1. requires the service-role boundary;
2. claims one exact Worker Engine authoring task through `hq_content_authoring_claim`;
3. receives only the database-authorized verified evidence packet;
4. performs no Tavily/search/source-fetching path;
5. calls the existing governed model gateway only after Worker Engine authority succeeds;
6. tells the model that evidence excerpts are untrusted data, never instructions;
7. forbids outside knowledge, hidden research and claims of official/published status;
8. requires structured `content`, `rationale`, and citations;
9. locally checks each cited quote occurs in the exact authorized evidence excerpt and that citations cover the required distinct-source count;
10. sends the draft to PostgreSQL for independent final validation;
11. on failure, finalizes/releases the model reservation and follows Worker Engine retry/dead-letter behavior.

## Database completion boundary

`hq_content_authoring_complete` independently recomputes the evidence packet and target-content hashes. If the evidence packet, claim, or current block changed after model authorization, completion fails.

For each citation PostgreSQL proves:

- the source was in the exact authorized evidence packet;
- the quote occurs inside the authorized semantic-verifier evidence excerpt the model actually saw;
- the same quote also occurs in the immutable R2.2 source material.

The database then writes one immutable `curriculum_authoring_drafts` row and completes the Worker Engine task with `outcome='draft_requires_human_acceptance'`.

It does **not** populate an apply-ready patch and does **not** set `editorial_status='prepared'`.

## Human acceptance boundary

`hq_accept_content_authoring_draft(draft_id)` is authenticated but internally requires `is_platform_owner()`.

Before accepting, it verifies the canonical content target still matches the content hash and exact text seen during model authorization. A stale target is rejected.

Acceptance then copies the immutable draft into the existing deterministic editorial patch format with:

- target block identity;
- expected current content;
- draft content;
- authoring draft ID;
- evidence packet SHA;
- verified citations;
- `prepared_from='source_grounded_authoring_v1'`;
- derivative invalidation impacts.

Acceptance writes an audit entry and only sets `editorial_status='prepared'`. It does not set proposal `status='approved'` or `status='applied'`.

The existing `hq_apply_curriculum_intelligence_proposal` still requires **both** proposal `status='approved'` and editorial `status='prepared'`, preserving the human governance chain.

## Worker Engine contract

R2.3 preserves existing certified handlers and adds:

- tool/handler/capability: `content.authoring.source_grounded`
- operation: `draft_content`
- resource type: `curriculum_intelligence_proposal`

The authoring claim uses the existing Model Gateway reason `unstructured_synthesis`; it does not create another model-authority plane.

## Certification

Added:

- `scripts/sql/content_factory_r2_source_grounded_authoring_verify.sql`
- `.github/workflows/content-factory-r2-source-grounded-authoring.yml`

The dedicated adversarial contract proves:

- authoring drafts are service-only, RLS-protected and immutable;
- machine authoring RPCs are service-only;
- human acceptance requires the authenticated owner lane;
- R2.3 extends rather than narrows the certified Worker Engine handler vocabulary;
- authoring evidence requires R2.1 `evidence_ready` + enough R2.2 material-bound semantic support;
- contradictions and unverified sources fail closed;
- evidence packet/current content/claim hashes are model-authorization bindings;
- citation source count cannot fall below the research source requirement;
- cited text must exist both in the exact authorized verifier excerpt and immutable source material;
- model completion can only create a `needs_review` immutable draft;
- only explicit owner acceptance can create a `prepared` patch;
- acceptance cannot approve or apply the proposal;
- the existing apply RPC still requires `approved + prepared`;
- model failures close reservation/retry/dead-letter state;
- installation leaves Worker Engine runtime OFF, autonomy L0, risk 0, and zero active capability-authority grants;
- Deno type-checks the executor;
- static executor checks reject hidden research integrations.

## Production boundary

Production was not mutated by R2.3 development.

The latest read-only production verification before this stage still showed Worker Engine production recovery stopping at `20260818111900`, with `public.hq_workforce_capability_authority_grants` absent. Therefore R2.1/R2.2/R2.3 production promotion and worker activation remain blocked behind the protected Worker Engine recovery path.

No R2.3 migration, Edge Function, model authority, or authoring worker has been activated in production.

## Vercel

No direct Vercel tool/deployment is part of R2.3 branch work. Keep the branch isolated until exact-current-main repository certification is green.

## Next after R2.3

Once repository-certified and later production-commissioned, the next Content Factory stage should be a governed editorial/QA release worker that evaluates pedagogy, curriculum alignment, originality/rights, block structure and derivative impacts **without collapsing owner approval/publish authority into the worker**.
