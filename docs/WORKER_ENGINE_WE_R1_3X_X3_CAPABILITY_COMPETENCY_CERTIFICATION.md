# WE-R1.3X X3 — Capability & Competency Graph Certification

Date: 2026-08-15
Status: PASS
Certified head before this documentation commit: `c40287c3ed78145645ebb59aa8ed2d28470e196b`

## Certified result

X3 establishes capability as an outcome-oriented ontology distinct from certified skill/procedure, and establishes versioned worker competency evidence independent of department/lane identity.

Certified contracts:
- versioned `hq_workforce_capabilities` with explicit input/output/verification, risk/autonomy ceilings and provenance;
- capability dependency/composition edges with self-edge prevention;
- skill-manifest → capability bindings so certification remains with procedures rather than being implied by capability existence;
- versioned worker competencies with proficiency, empirical reliability, sample count, certification, scope, jurisdiction and expiry;
- competency-driven worker ranking that does not require exact department equality;
- certified-skill resolution beneath capabilities;
- service-only RLS and explicit direct-product-role denial;
- unchanged L0/R0 fail-closed runtime boundary.

## Exact-head evidence

At `c40287c3ed78145645ebb59aa8ed2d28470e196b`:
- Supabase Migration Security Contract: PASS.
- Worker Engine Promotion Planner Regression Gate: PASS.
- Worker Engine WE-R1.3/R1.3X disposable-local acceptance: PASS.
  - full migration rebuild: PASS;
  - WE-R1.3 adversarial suite: PASS;
  - X1 Objective Kernel suite: PASS;
  - X2 Memory Context suite: PASS;
  - X3 Capability Competency suite: PASS;
  - fail-closed reassertion: PASS.
- TBL-011 Isolated Clean Rebuild: first attempt suffered a container-level reset failure after a successful initial migration application; an exact-head job rerun then completed the entire blank-database rebuild and evidence sequence successfully. No SQL repair was required.
- TypeScript + ESLint + Next.js Production Build: PASS.

## Architectural closure

X3 resolves the conceptual defect in which skills could become the top-level intelligence abstraction. Canonical semantics are now:

Objective → required capability → certified procedure(s) / skill manifests → competency-qualified worker(s).

It does not yet replace all legacy routing call sites. That belongs to X6 after Resource and Planning gates provide the full eligibility context.

## Safety

No production activation was performed. Heartbeat, Factory, consequential execution and autonomy remain OFF/L0/R0.

Next allowed gate: X4 Resource Registry & Resolver.