# Canonical Learning Assets R3.2 — Schema Design

Date: 2026-08-18
Branch: `feature/canonical-learning-assets-r3-20260818`
Base main: `c88fa34f430c7fffa37429cbf07cdf604ed706db`
Status: tracked migration implemented on branch; production unchanged

## Final authority shape

`public.learning_resources` remains the stable canonical family/root identity. `public.learning_resource_versions` stores exact immutable reusable content/certification versions.

This preserves all existing `learning_resources.canonical_key` identities and FKs while allowing historical teaching occurrences to retain the exact version used.

## Root additions

R3.2 adds nullable identity dimensions to existing roots:

- `asset_kind`
- `purpose`
- `identity_key_version`
- `language_code`
- `material_variant`

Existing rows remain legacy/unclassified until explicitly migrated; no existing row is silently certified.

## Exact-version authority

`learning_resource_versions` records:

- root/resource identity;
- sequential version lineage;
- lifecycle `candidate|verified|certified|retired|rejected`;
- canonical JSON payload + SHA-256 fingerprint;
- provenance;
- rights status;
- certification policy/evidence;
- immutable timestamps.

Only one certified version and one candidate/verified version may exist per root at a time.

## Immutability

Certified versions cannot be changed. The only permitted certified transition is `certified -> retired` with payload, provenance, rights and certification evidence unchanged. Retired versions are immutable. Versions cannot be deleted.

This protects every teacher/class occurrence that pins an exact version.

## Exact delivery pin

`teaching_resource_links.resource_version_id` is added as a nullable transition-safe FK. A trigger proves the pinned version belongs to the same `resource_id`.

Stable adoption/library records may continue to point at the root; actual teaching/delivery records can pin the exact version.

## Read contract

`cla_get_certified_learning_resource(family_key)` returns only:

- an active root;
- a currently certified child version;
- a parent resource visible under `fn_learning_resource_visible`.

Candidate, verified, retired, rejected and legacy-only roots resolve as a miss.

## Security contract

- new version table has RLS enabled;
- `anon`: no table access and no certified lookup EXECUTE;
- `authenticated`: SELECT only, constrained by visible parent;
- `service_role`: SELECT/INSERT/UPDATE, no DELETE;
- internal trigger functions are not browser executable;
- lookup function is security-invoker with empty search path;
- no browser role receives certification write authority.

## Canonical identity

`lib/content/canonicalLearningAssetIdentity.ts` builds a deterministic family key from stable jurisdiction/curriculum/grade/subject/strand-or-outcome/topic, artifact kind, purpose, language and legitimate material variant dimensions.

Teacher, school, class, learner, date, deadline and timetable context are deliberately excluded.

## Lookup-before-generation

`lib/content/canonicalLearningAssetLookup.ts` implements the application gate:

`certified hit -> generationAllowed=false`

`certified miss -> generationAllowed=true`

External research/model spend must never occur before this gate and, after R3.3 concurrency work, must only occur after a unique miss claim.

## Verification

`scripts/test-canonical-learning-asset-identity.sh` proves deterministic identity behavior.

`scripts/sql/canonical_learning_resource_versions_verify.sql` proves RLS/grants, certified uniqueness, lineage isolation, immutability, retirement/supersession and fail-closed lookup in a disposable database transaction.

## Promotion discipline

The tracked migration is `20260818141000_canonical_learning_resource_versions.sql`. It follows current production migration `20260818140000` and was checked for collision against current `main` before being ported.

Production Supabase remains unchanged. Vercel remains untouched. Promotion requires clean migration-chain/database certification first.