# VibeSchool — Kenya child-data and pilot-security release gates

**Status:** Evidence required; this document is a release checklist, not a legal certificate, penetration-test report, or proof of pilot completion.

## Guardrails

- Do not claim ODPC registration, GDPR compliance, ISO/IEC 27001 certification, a completed independent penetration test, measured uptime, or large-school capacity without evidence.
- Never use production learner data as demonstration data or publish learner-identifying audit artifacts.
- Do not resolve a Supabase advisor warning by granting broad RLS access or revoking production RPC privileges before mapping real callers and regression testing.
- Keep school, class, teacher, learner, parent, and support authorization enforced on the server and in PostgreSQL, not only in UI navigation.
- Review any change to authentication, child-data processing, storage, or cross-school access as a security-relevant release.

## Must-pass gates before a real-learner pilot

| Gate | Proof required | Current proof state |
| --- | --- | --- |
| G1 — Legal controller/processor obligations | Responsible legal entity, school/controller relationships, processing register, lawful purposes and ODPC registration determination with documentary evidence | Not independently verified in this change |
| G2 — Child data and consent | Age-appropriate notice, relevant parent/guardian authority, verified school/teacher/guardian relationship, best-interests assessment, consent evidence where consent is the basis | End-to-end test evidence required |
| G3 — Data protection impact and vendors | Documented child-data DPIA decision, vendor processing arrangements, actual hosting/data locations, international transfer assessment and safeguards | Documentary evidence required |
| G4 — Isolation | Negative tests covering anonymous access, learner self-access, unrelated parent, unassigned teacher, other class, other school, ex-staff, stale session and tampered identifiers | End-to-end permission evidence required |
| G5 — Privileged database operations | Review every exposed security-definer RPC for safe search_path, role grants, verified caller, school scope, ownership, execution boundary and audit trail; classify RLS-enabled/no-policy tables as deliberately server-only vs client-facing | Advisor triage and tests required |
| G6 — Public HTTP/TLS | Real deployed hostname checked for trusted certificate, expiry, HTTPS redirects, HSTS, nosniff, frame restrictions and referrer protection; test role-specific private no-store responses | Static header contract added; live response and TLS checks required |
| G7 — Data lifecycle and incidents | Tested access/correction/deletion requests, records retention, retention exceptions, backups, restore, breach identification and escalation contact | Operational evidence required |
| G8 — Safe mobile school pilot | Documented teacher, learner, parent, school-admin journeys on Android and desktop, network-loss/recovery, timeouts, uploads, performance baseline and support process | Real-device and real-school evidence required |
| G9 — Independent assurance | Independent authorized penetration-test scope, findings, remediation retest and dated report; dependency/security scanning and incident drill | No independent assurance asserted |
| G10 — Release decision | Named accountable owner, approved test evidence, residual-risk acceptance, rollback plan, and production commit/deployment identification | Not certified by this document |

## Implementation notes

The current Next.js header configuration protects against browser sniffing, framing and referrer leakage and adds private workspace cache rules. A narrow CSP blocks framing and object content, **not** all script injection; a complete nonce/hash-based CSP requires auditing Next.js, authentication, analytics, inline styling and third-party assets before enforcement. HSTS here intentionally excludes `includeSubDomains` and `preload` until every subdomain and HTTPS redirect is verified.

Supabase security advisors may report RLS-enabled tables without policies. Those tables are normally inaccessible to client database roles by default; classify them before adding policies. For privileged functions, inspect the actual implementation and each caller; high warning counts are review signals rather than a proof of exploitation.

## How to verify

- Run `npm run test:security-headers` and normal CI checks on the exact PR head.
- Inspect the preview site before merging; verify login, Teacher OS, learner and parent sessions, media, school creation, assessments, downloads and embeds still work.
- After deployment, make unauthenticated HTTP(S) requests to public and protected routes, inspect the actual response headers and certificate chain, and attach redacted results to the release review.
- Run controlled two-school, multi-role authorization tests on **test data** and retain only anonymous pass/fail evidence.
- Rerun Supabase security advisors after approved database changes. Record each remaining warning as intentional, fixed or escalated, with an accountable owner.

## Kenyan reference sources

- Kenya Data Protection Act, 2019: https://new.kenyalaw.org/akn/ke/act/2019/24
- Office of the Data Protection Commissioner: https://www.odpc.go.ke/
- ODPC guidance, including the Education Sector, Children's Data, DPIA and cross-border data: https://www.odpc.go.ke/guidelines-2/
- Supabase database lint documentation: https://supabase.com/docs/guides/database/database-linter

Independent counsel/security reviewers and the responsible school or processor must sign off on the legal and operational gates; repository changes cannot provide those attestations.
