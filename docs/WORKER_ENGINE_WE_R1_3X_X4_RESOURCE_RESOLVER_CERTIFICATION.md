# WE-R1.3X X4 — Resource Registry & Resolver Certification

Date: 2026-08-15
Status: PASS
Certified head: `c8bcc1659988030678631e5815f287df87676d22`

X4 establishes a governed Worker Engine resource registry and least-sufficient resolver without replacing the existing WE-L5 deterministic-first Model Gateway or R1.3 resource/anomaly ceilings. Models, deterministic services, tools, data sources, documents, compute, queues, human reviewers, workers and certified skills can be represented as governed resources with version, health, reliability, cost, autonomy/risk, scope, jurisdiction, data classification, quota/interface contracts and provenance.

The resolver records selected and rejected resources, fails closed on health/classification/scope/jurisdiction/authority/risk/reliability constraints and orders eligible resources by least autonomy → least risk → least cost → least latency → reliability/policy priority. Model gateway resources are registered disabled/unknown by default and explicitly point back to `hq_workforce_authorize_model_call`, preserving deterministic-first authorization.

Exact-head gates passed: Supabase Migration Security Contract; WE-R1.3/R1.3X acceptance including X1–X4 suites and fail-closed reassertion; Worker Engine Promotion Planner Regression; TBL-011 blank migration rebuild; TBL-012 extractor; TypeScript + ESLint + Next.js production build. No runtime activation occurred.

Next allowed gate: X5 Planning Graph.