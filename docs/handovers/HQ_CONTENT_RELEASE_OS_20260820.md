# HQ Content Release OS — 2026-08-20

Base: `32cc4799bc69a5b66076b5239333908c7ff8d1e1`

Scope is isolated to the HQ publishing review surface and its dedicated regression gate. No Supabase migration, Worker Engine authority, VibeLearn reader, Teacher Content, analytics, or unrelated HQ PR branch is modified.

Key preserved contract: exact-version publishing decisions remain bound to `p_expected_version` through `hq_review_publishing_artifact`.

Key product changes:
- publication-first focus with Grade 10 Chemistry selected when present;
- chapter release map;
- separate Human / Needs work / Release status lanes;
- semantic actions for release blockers and missing VibeLab work instead of fake artifact review;
- search inside the focused publication;
- artifact-specific review rubric;
- technical release checks collapsed by default;
- mobile-sized primary controls.

Promotion rule: merge only from an exact-current-main candidate after applicable CI/build and the dedicated `HQ Content Release OS` contract pass.
