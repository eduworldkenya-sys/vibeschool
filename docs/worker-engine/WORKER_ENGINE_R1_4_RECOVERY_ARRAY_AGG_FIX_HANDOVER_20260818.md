# Worker Engine R1.4 production-recovery lineage repair handover — 2026-08-18

## Decision

PR #246 merged successfully, but production recovery remains fail-closed. The first disposable recovery rehearsal failed with `"array_agg" is an aggregate function` while replaying `20260815090500` out of historical order. Investigation of the live Supabase ledger showed that this was a rehearsal-design symptom, not permission to edit or replay the already-applied migration.

Production was not mutated by the failed workflow. Vercel was not used.

## Live production facts

Read-only production verification established:

- `20260815090500`, `15091000`, `15092000`, `15092500`, `15093000`, `15094000`, `15095000`, `15121500`, `15123000`, `15130200`, and `18111900` are applied;
- `20260815130100` is applied under the production identity `create_open_schools_kenya_kibera_batch1`;
- repository history uses the same version for `worker_engine_we_r1_4_compensation`;
- `hq_workforce_execution_intents.authoritative_before_state` is absent;
- `hq_workforce_execution_intents.expected_after_state` is absent;
- `hq_workforce_execution_compensations` is absent;
- the later exact-state capture function/trigger and compensation RPC from `15130200` exist;
- Worker Engine remains heartbeat OFF, Factory OFF, runtime OFF, autonomy L0, maximum risk 0, Shadow OFF, Shadow scheduler OFF, global stop ON.

## True genesis

The blocking defect is migration semantic identity collision, not simply catalog scanning.

A version-only migration audit classified every shared timestamp as parity. That is insufficient for VibeSchool's production history: `20260815130100` proves that equal versions can represent different migrations. As a result the repository compensation foundation can be silently considered applied even though its schema mutations never reached production.

Applied migration history is immutable. The repository's historical `15130100` file must not be renamed, edited for production replay, or marked as newly applied.

## Forward-only repair

New migration:

`20260818111950_worker_engine_we_r1_4_compensation_lineage_collision_repair.sql`

It is intentionally ordered after the already-applied `18111900` reconciliation bridge and before the pending `18112000+` closure chain.

The migration:

1. asserts the Worker Engine is fully fail-closed;
2. validates any pre-existing recovery columns have the expected `jsonb` type;
3. restores the two missing authoritative recovery-state columns;
4. creates the canonical compensation evidence table, indexes, RLS and grants;
5. restores the immutable compensation trigger/function;
6. requires the later `15130200` exact-state capture function, trigger and compensation RPC to already exist;
7. deliberately does not replace those newer function bodies with the collided `15130100` implementation;
8. reasserts the runtime safety state after repair.

## Security-gate diagnosis

Exact-head certification on `ceb9205dd83bfa281b4304d644fc04b68c85a668` passed the dedicated production-recovery rehearsal, Worker Engine acceptance, clean rebuild, promotion planner, repository extractor, TypeScript/production build, CI production build, and auth/onboarding gates. The only failing gate was `Supabase Migration Security Contract`.

The failure was diagnostic rather than evidence of an open privilege boundary. The validator requires every newly created table to contain an `authorization-test` declaration whose text begins with the exact qualified table identifier. The migration already contained the intended authorization statement, but it was written as:

`-- authorization-test: public/anon/authenticated denied; service_role read-only.`

That text documents the intended roles but does not name `public.hq_workforce_execution_compensations`, so the contract parser correctly failed closed.

The underlying SQL authorization contract is already substantive and restrictive:

- row level security is enabled on `public.hq_workforce_execution_compensations`;
- all privileges are revoked from `public`, `anon`, `authenticated`, and `service_role`;
- only `SELECT` is granted back to `service_role`;
- the immutable trigger prevents update/delete mutation of compensation evidence;
- the guard function is not directly executable by public application roles.

A read-only production probe also reconfirmed the expected pre-repair state: the compensation table and the two authoritative recovery columns are still absent, while the later exact-state capture and compensation RPC exist. The Worker Engine remained `false|false|false|0|0|false|false|true` for heartbeat, Factory, runtime, autonomy, risk, Shadow, Shadow scheduler, and global stop respectively.

The repair therefore changes only the declaration syntax to the repository contract form:

`-- authorization-test: public.hq_workforce_execution_compensations denies public/anon/authenticated direct access and service_role is read-only.`

No grant, RLS, policy, function authority, runtime state, production data, or recovery semantics are weakened to satisfy CI.

## Collision-aware staging

`worker-engine-build-ledger-aligned-stage.py` now supports explicit identity placeholders. The R1.4 recovery builder declares `20260815130100` as a known shared-version/non-equivalent identity and stages an inert production-history placeholder for that timestamp rather than copying repository SQL into the ledger-aligned view.

The missing semantics are carried only by `20260818111950`. This prevents timestamp equality from being reported as semantic equivalence.

## Corrected recovery rehearsal

The dedicated production-recovery workflow no longer replays already-applied R1.3X migrations out of order.

Its disposable database now:

1. rebuilds through the already-applied `20260818111900` bridge boundary;
2. removes exactly the compensation foundation pieces known to be missing in production, reproducing the observed `15130100` semantic collision state while leaving `15130200` exact-state objects present;
3. applies `20260818111950`;
4. applies the `18112000..18113000` Worker Engine closure chain;
5. verifies the compensation table, recovery columns, immutable trigger and exact-state APIs;
6. runs the production-closure adversarial suite;
7. proves runtime remains L0/risk-0/OFF with global stop ON.

## Production promotion boundary

Production remains protected by the `production-migration-repair` GitHub environment, exact project-ref verification, linked-ledger capture, collision-aware staged view, exact dry-run assertion, apply evidence, post-apply ledger verification and zero-pending postflight.

The preflight must explicitly prove:

- already-applied `15090500` is not pending;
- collided `15130100` is not pending or replayed;
- already-applied `18111900` is not pending;
- forward repair `18111950` is pending;
- closure `18112000` and `18113000` are pending;
- the manifest records the `create_open_schools_kenya_kibera_batch1` collision provenance.

No Shadow Trial or canary may start until production recovery completes and live postconditions are verified.

## Next sequence

Reconcile latest main → exact-head certification → make repair PR ready → merge once → protected production recovery → verify Supabase compensation foundation and ledger → Shadow Trial → bounded canary → Content Factory remediation.
