# Approved Pathways explorer

Mission CYBORG-20261106070241-8b9e1f. Base 813188c012bf8a7fff6f79dbfbc722af0a5f12c6.

Reconstructs the approved navy/teal/gold desktop wheel and mobile cards following workspace maintenance. Earlier local test results do not certify this reconstructed candidate.

Outcome: choose pathway → study area → subjects/careers → verified school offerings. Editable steps and URL selections preserve context. No login is required. The existing Quick Check is retained, with zero-signal secondary recommendations removed and results carried into exploration.

Data: reuse published/verified pathways, tracks, combinations, careers and links, subject claims and the existing public school offering RPC. No migrations, grants, RLS, authentication, payments, worker or scheduler changes. Pathway-only career relationships are explicitly distinguished from track relationships. School matches are filtered by the selected combination when chosen; otherwise the school screen explicitly states it shows the pathway rather than a selected subject combination.

Shell: optional compact canonical header/footer. Default public pages remain unchanged. Pathways owns step navigation and excludes the global bottom menu that previously covered its action.

Checks: type/lint/build; Pathways auth/domain; public trust; focused track isolation and filter regressions; responsive browser journey at 320/360/390/412/768/1440px; loading, empty, error/retry and stale-choice paths; canonical public browser gate unchanged plus new explorer suite. Local fixtures are not production catalogue evidence. Exact-head CI, merge lineage, deployment revision and production observation must be verified separately.

Rollback: revert this isolated PR; no database rollback required. No production readiness claim is made by this document.
