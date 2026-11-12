# Intelligent Timetable — 11-Standard Integration Acceptance

**Integration branch:** `integration/intelligent-timetable`
**Baseline:** `main` at `a1dfc2ddfdc8bb38c72472c1064365f12fbe809b` (PR #1465 included)
**Recorded:** 2026-11-12
**Owner's objective:** One integrated, demonstrably working timetable rather than 11 independently merged code changes.

## Operating rules

1. Feature work must target this integration branch, not `main`. Use separate feature branches and pull requests; do not allow 11 parallel writers on the integration branch.
2. A merged pull request is **not** an accepted production standard. Record code / CI / deployed database / signed-in acceptance separately.
3. Do not force-merge, fabricate KICD evidence, insert teaching/attendance/completion evidence, or alter historical schedule identities.
4. Every contribution reports its PR, head commit, touched files, prerequisite migrations, test commands/results, remaining blockers, and acceptance evidence.
5. Check dependency conflicts before applying migrations. Treat live schema and existing historical data as authoritative evidence; use read-only preflight before write migrations.
6. Hold the final `integration/intelligent-timetable → main` PR until all eleven gates pass as a **combined** system. Maintain rollback/recovery procedure for schema changes.

## Acceptance scorecard (not a list of completed features)

Legend: **OPEN** = acceptance not established; **CODE MERGED / PROD OPEN** = changes in Git but production unverified; **BLOCKED** = known prerequisite prevents acceptance.

| ID | Standard | Integration acceptance evidence required | Status at baseline |
| --- | --- | --- | --- |
| TBL-01 | One timetable for school and tuition | Unified school/tuition timetable display with explicit context; prevent conflicts for shared teacher and learner across school–tuition and tuition–tuition; preserve invitation-scoped access, school closure exceptions, and isolation. Test as teacher, tutor and learner. | **OPEN** — PR #1464 open and retargeted to this integration branch; GitHub subsequently reported mergeable=true / mergeable_state=unstable. CI and acceptance still required. |
| TBL-02 | Verified KICD allocations for Grades 1–9 | KICD source/version locator per grade/subject; canonical school allocation counts and supported choices; effective allocations for real classes; no duplicate/overwritten identities; production migration + read-only data checks. | **CODE MERGED / PROD OPEN** — PR #1465 merged to `main` at baseline. Production migration/application not certified. |
| TBL-03 | School-configured periods, durations and allocation units | User-configurable school period grid, reusable sample options but no forced default; reject invalid overlapping period configuration; prove actual Gilgil configuration and Grade 4 Kilimanjaro Mathematics five valid 35-minute periods if that is the agreed school configuration. Do not infer valid periods from historic slots. | **BLOCKED** — latest reported Gilgil audit #1451 found zero configured periods; implementation not yet reported accepted. Existing branch `fix/timetable-real-period-setup-20261112` was found but is 40 commits behind the integration branch with zero unique commits; it is not a completed current Standard 3 implementation. |
| TBL-04 | Allocation gaps and scheduling conflicts | Reconcile required/placed/remaining lessons and show collision reason; cross-school/tutor/class/learner conflicts; test invalid and valid timetable edits with clear UI feedback. | **OPEN** — existing checks and PR #1453 need integrated signed-in proof. |
| TBL-05 | Real calendar and actual Scheme capacity | Real school calendar including terms, alternating weeks, holidays, closures, exceptions, dated occurrences and reschedules; Scheme capacity matches actual eligible sessions. | **OPEN** — no dated end-to-end proof. |
| TBL-06 | Exact dated occurrence → Scheme item → curriculum outcome | Open by dated occurrence ID; choose only explicitly eligible Scheme item with canonical verified outcome; missing link must show as missing, not silently guess. Prove with scheduled Grade 4 Math acceptance lesson. | **OPEN** — partial planner code #1281, live linkage not proved. |
| TBL-07 | Prepare without timetable | Teacher can search Curriculum Map/Scheme, prepare and save Lesson Plan/Notes, and teach unscheduled through explicitly separate route; does not invent timetable attendance or outcomes. | **OPEN** — code and migration reported available, signed-in verification outstanding. |
| TBL-08 | Same occurrence through Teach, completion and recovery | Mumbi2 signs in, opens exact dated scheduled occurrence, teaches, explicitly marks complete, reopens same occurrence, sees retained attendance and teaching evidence; missed-lesson recovery remains traceable. | **OPEN** — no verified complete replay. |
| TBL-09 | Truthful progress and learner evidence | Scheduled/required/planned/delivered/completed counts reconcile; teacher completion not automatically learner mastery; no fabricated attendance, achievement or learner attempts. | **OPEN** — production cross-screen audit pending. |
| TBL-10 | Preserve history through timetable revisions | Future-effective revisions preserve earlier dated lessons, attendance, plans and slot IDs; dependency-safe archive; historical school/tuition evidence still resolves after changes. | **OPEN** — historical inventory exists in #1451, revision replay pending. |
| TBL-11 | Prove readiness before automatic generation | Four canonical pending migrations from earlier TBL-013 preflight reconciled against current production ledger and actual schema, dry-run safe, approved deployment path, school periods verified, no unauthorized automatic generation, integrated teacher acceptance and release evidence. | **BLOCKED** — four migrations/pending configuration were reported; must recheck live ledger at release time. |

## Release prerequisites in dependency order

1. **Schema / KICD baseline:** confirm current `main` and production migration ledger independently; reconcile TBL-012/013 preflights and #1465 migrations, avoid duplicate engines or migrations.
2. **TBL-03 school periods + TBL-02 effective allocations:** configure Gilgil by a confirmed school-controlled grid, verify target class subject counts. Teacher-editable examples are templates, not silent defaults.
3. **TBL-01 unified school/tuition:** reconcile PR #1464 against the integration branch, resolve merge conflicts and check its migration against the live preflight.
4. **TBL-04, 05, 06:** collision and gap calculations, real calendar capacity and exact Scheme/outcome lineage.
5. **TBL-07, 08, 09, 10:** independently prepare, dated Teach → Complete → Reopen, truthful evidence and future-effective revision tests.
6. **TBL-11:** fail-closed live migration preflight, clean CI/build, signed-in Mumbi2 replay and acceptance evidence for each gate. Only then open integration PR to `main`.

## Required integrated acceptance replay

- **Actor:** Tr. Mumbi2, Gilgil Township School, Grade 4 Kilimanjaro.
- **Subject:** Mathematics; **target allocation:** five 35-minute periods **only if confirmed by the school**.
- **Route:** configured periods → class weekly allocation → recurring timetable → real dated occurrence → eligible Scheme item → verified curriculum outcome → saved Lesson Plan → Teach → explicit completion → reopen same occurrence → inspect attendance and teaching record.
- **Negative checks:** unlinked Scheme outcome, conflicting teacher/class/tuition slot, holiday/closure, non-school learner, zero configured periods, invalid historical test slot, pending migration.
- **Evidence:** exact IDs, source refs, SQL preflight, build/CI logs, signed-in screenshots/records, before-and-after audit for historical IDs and permissions.
- **Release rule:** All 11 standards independently verified **and** full integrated replay verified; never mark release green based only on PR counts.

## PR references

- TBL-01: [#1464](https://github.com/eduworldkenya-sys/vibeschool/pull/1464) — now targets integration; open, CI / production preflight / acceptance pending. Re-check GitHub mergeability dynamically.
- TBL-02: [#1465](https://github.com/eduworldkenya-sys/vibeschool/pull/1465) — merged into baseline code, not necessarily live DB.
- TBL-03 historical evidence: [#1451](https://github.com/eduworldkenya-sys/vibeschool/pull/1451).
- TBL-11 schema preflight: [#1463](https://github.com/eduworldkenya-sys/vibeschool/pull/1463), superseding closed-unmerged [#1462](https://github.com/eduworldkenya-sys/vibeschool/pull/1462).

**Important:** This file is a tracking / acceptance contract, **not** evidence that any implementation has been tested in production.
