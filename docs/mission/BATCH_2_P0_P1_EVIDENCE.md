# Mission 243 — Batch 2 Evidence

## E-007 — Canonical mission authority
`docs/VIBESCHOOL_MISSION_VISION.md` explicitly declares itself the canonical company-level Mission and Vision. The OS vision document explicitly derives from it, and the Student VibeTwin architecture explicitly remains subordinate to the company mission.

**Result:** P0 authority hierarchy verified.

## E-008 — Repository/database authority
The controlled certification branch is `mission-243-execution`. Production Supabase reports its applied migration history, including the latest security hardening migrations through `20260813030724_bound_twin_self_check_calibration_values`. Repository migrations therefore remain the intended reproducible database authority; runtime database state remains the actual execution authority until reconciled.

**Result:** authority model documented; final parity remains a P8/P9 certification gate.

## E-009 — School-admin student boundary
`admin_add_student()` requires an authenticated caller and `is_school_admin(p_school_id)`, then verifies any class belongs to that same school before inserting the student.

**Result:** verified by production function inspection.

## E-010 — HQ privilege boundary
`hq_create_decision()` and `hq_approve_decision()` both call `hq_assert_owner()`. `hq_assert_owner()` requires platform-owner authority for normal users and records the granted HQ access event. The special postgres/cron path is explicitly audited.

**Result:** verified by production function inspection.

## E-011 — Publication authority
`publish_publication()` locks the target publication, binds publication to its `author_id`, enforces publication policy, validates required metadata, requires at least one chapter, and transitions publication/chapter state inside the database.

**Result:** publication mutation is database-authoritative; SEO/AI layers must remain downstream projections.

## E-012 — Public reader boundary
`get_public_vibetextbook_reader()` is intentionally executable by `anon`, but it delegates to a non-client-executable raw helper. The raw helper requires `vibe_publications.format='vibetextbook'` and `status='published'`, returns only published chapters, and sanitizes public blocks. Paid/freemium chapter bodies are withheld according to pricing.

**Result:** public reader authority verified; anonymous execution is intentional rather than an accidental security leak.
