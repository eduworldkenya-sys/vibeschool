---
name: vibeschool-ci-repair
description: Diagnose and repair VibeSchool required CI failures on the exact candidate head.
---
# CI Repair
Bind every failure to the exact candidate SHA. Fetch the failed job/log and classify product, test, contract, environment, dependency, timeout or CI-infrastructure cause. Repair the canonical cause, run focused preflight, rerun only necessary checks, and repeat until green or a typed blocker. Repeated identical failures require a strategy change. Never label a failure flaky without evidence or bypass a required check.
