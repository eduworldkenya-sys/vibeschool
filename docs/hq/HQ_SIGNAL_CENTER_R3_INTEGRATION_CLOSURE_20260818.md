# HQ Signal Center R3 — Integration Closure

Date: 2026-08-18

During exact-head certification, TBL-011 failed before the R3 migration at `20260818235100_hq_decision_intelligence_repair.sql`.

The failing migration attempted to patch `hq_run_company_intelligence_v2()` and `hq_get_company_brief_v2()` unconditionally. Production contains those functions, but their original company-intelligence-v2 subsystem predates repository tracking and is absent from a clean rebuild.

The repair migration is now explicitly portable:
- when both legacy production functions exist, it patches their known production defects;
- when the legacy subsystem is absent, it exits without inventing partial legacy state;
- the function comment is applied only when the target function exists.

This is an integration/lineage repair discovered by R3 certification, not an R3 runtime dependency. R3 remains built on repository-owned HQ notifications, Workroom, incidents, profiles, schools and commerce truth.

The next acceptable promotion head must pass a fresh full TBL-011 rebuild plus the normal application/security gates.
