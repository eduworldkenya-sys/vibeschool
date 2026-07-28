VIBESCHOOL VIBELEARN READ FIX REGISTER

Purpose

This file is the permanent source of truth for VibeLearn/VibeTextbook reader repair and implementation work (the "READ" track).

Claude must:

- work from the current repository state;
- inspect the current Supabase project directly;
- use git history and repository files as evidence;
- complete one fix unit at a time;
- update "HANDOVER.md" (VIBELEARN section) at the end of every fix;
- never restart the full audit unless explicitly instructed.

The active fix is recorded in "HANDOVER.md" under VIBELEARN.

Numbering note: the original VibeLearn Read audit (2026-07-28) proposed READ-001 through READ-008 as read-only recommendations. Execution renumbered and merged some of them based on what investigation actually found (READ-002 absorbed the audit's proposed entitlement-authority step once investigation showed part of it was already live; READ-003 corresponds to the audit's READ-004 Continue Reading). This register reflects the numbering actually executed, not the original audit document.

---

EXECUTION MODEL

One fix per session/turn

Each fix is scoped, investigated, implemented, verified against the live Supabase project, and committed before moving to the next. A fix may end only as:

- OPEN
- IN PROGRESS
- AWAITING APPROVAL
- BLOCKED
- FAILED
- VERIFIED

Claude must not silently continue into the next fix without confirming scope first.

---

PERMANENT EXECUTION LOOP

1. Load project state

Read:
1. "CLAUDE.md"
2. "READ_FIX_REGISTER.md"
3. "HANDOVER.md" (VIBELEARN section)
4. Relevant source files (app/read/textbook/[publicationId]/page.tsx, app/global/read/*, app/global/creator/*)
5. Relevant migrations (supabase/migrations/2026072*)
6. Current git status and recent commits
7. Current Supabase schema, RPCs, and RLS directly via the connected project (yauqsxggtuxuykcbrtzf) — never assume the repo matches live

2. Confirm prior state

Verify declared prior fixes are present in the repository, git history, migration files, and live Supabase schema/RPCs — not just in this register.

3. Scope the active fix

Work only on the active fix ID. Do not fix unrelated findings, redesign adjacent systems, or combine another fix into the current session without explicit approval.

4. Investigate before patching

Read live schema and code directly. Do not assume a prior audit or prior session's summary is still accurate — verify against current state.

5. Identity and architecture rules for this track

- viewer_id = auth.uid() = profiles.id for all reader-facing identity. Never students.id (legacy vibelearn_* engagement tables are students.id-keyed, have 0 live rows, and 114/115 students rows have no login — do not reuse or repair them as part of this track without a separate, explicitly scoped fix).
- Canonical reader for format=vibetextbook is /read/textbook/[publicationId], backed by get_vibetextbook_reader(). All other formats stay on /global/read/publication/[id] until they get their own hardened path.
- Writes are RPC-only, SECURITY DEFINER, viewer identity always derived from auth.uid() server-side, never accepted from the client.
- Entitlement (free/donation/freemium/paid/school_license) is enforced server-side on every read and write path that touches chapter content or progress — never trust a client-side can_read check alone.

6. Verify against live Supabase before declaring done

Every schema/RPC change must be smoke-tested against the live project (yauqsxggtuxuykcbrtzf) before being reported VERIFIED — not just applied.

7. Report and update HANDOVER.md

At fix close, append a full fix report (below) to this register and update the VIBELEARN summary block in HANDOVER.md.

---

STATUS DEFINITIONS

OPEN

The fix has not started.

IN PROGRESS

The fix is currently being investigated or implemented.

AWAITING APPROVAL

The next required action is destructive, production-affecting, or explicitly approval-gated.

BLOCKED

The fix cannot continue because of a confirmed dependency or unavailable access.

FAILED

Implementation or verification failed and the repository or database has not reached the required result.

VERIFIED

The root cause was corrected and all required verification passed.

---

READ TRACK — FIX PHASES

ID| Priority| Status| Fix unit| Required result
READ-001| P0| VERIFIED| Route vibetextbook publications to the canonical hardened reader| Discover and Creator-profile cards for format=vibetextbook open /read/textbook/[publicationId] instead of the deprecated /global/read/publication/[id]
READ-002| P0| VERIFIED| Reading progress authority (schema, RPC, canonical reader wiring)| Per-viewer, per-chapter progress is recorded and read through a secure RPC, keyed on auth.uid()/profiles.id, and the canonical reader resumes to the viewer's last-read chapter
READ-003| P0| VERIFIED| Continue Reading shelf| Discover surfaces the viewer's most-recently-read vibetextbooks with cover/chapter/progress and a direct resume link
READ-004| P1| OPEN| CBC identity panel| Reader surfaces grade/subject/strand/sub-strand/learning outcomes/alignment verification already present in vibe_publications/vibe_chapters
READ-005| P1| OPEN| Save & Bookmarks| One consolidated save/bookmark model for the canonical reader (legacy vibelearn_saved/vibelearn_content_saves duplication resolved first, not reused as-is)
READ-006| P2| OPEN| Reading analytics| Chapter-level completion/abandonment/duration signals beyond raw view counts
READ-007| P2| OPEN| Classroom assignment integration| Teacher-assigned chapters, due dates, class completion rates — this is the point at which students.id / classroom roster identity gets solved, deliberately deferred from READ-002/003
READ-008| P2| OPEN| Licensing & payments| Real M-Pesa/school-licence entitlement backing the paid/school_license pricing types the reader already recognizes but cannot fulfill

---

FIX REPORT FORMAT

At the close of every fix, Claude must append a report here and update HANDOVER.md (VIBELEARN section):

FIX ID:
STATUS:

OBJECTIVE:

ROOT CAUSE:

EVIDENCE:

FILES CHANGED:

DATABASE OBJECTS CHANGED:

MIGRATION:

DATA CHANGES:

RLS AND SECURITY:

VERIFICATION COMMANDS:

VERIFICATION RESULTS:

REGRESSION RESULTS:

UNRELATED CHANGES PRESERVED:

NEW FINDINGS:

OPEN RISKS:

COMMIT:

NEXT FIX:

---

READ-001 VERIFIED

FIX ID: READ-001
STATUS: VERIFIED

OBJECTIVE:
Route format=vibetextbook publications to the canonical, entitlement-safe reader (/read/textbook/[publicationId]) from every entry point, instead of the deprecated /global/read/publication/[id].

ROOT CAUSE:
An external audit (VibeLearn Read audit, 2026-07-28) correctly flagged two reader implementations but understated the gap — the newer canonical reader (get_vibetextbook_reader RPC, hardened 20260725090023) was already live, but two client entry points (Discover, Creator profile) still linked to the old unhardened reader for every publication regardless of format.

EVIDENCE:
- app/global/read/page.tsx:144 and app/global/creator/[id]/page.tsx:145 both called router.push('/global/read/publication/' + pub.id) unconditionally.
- supabase/migrations/20260725083742_point_textbook_index_url_at_canonical_reader.sql already declared /read/textbook/[publicationId] canonical for indexed content.
- get_vibetextbook_reader() (20260725090023) restricts itself to format='vibetextbook' — confirmed the two readers are not interchangeable, so the fix had to be format-conditional, not a blanket replace.

FILES CHANGED:
- app/global/read/page.tsx
- app/global/creator/[id]/page.tsx

DATABASE OBJECTS CHANGED:
None. Live schema was already correct; this was a client-only fix.

MIGRATION:
None required.

DATA CHANGES:
None.

RLS AND SECURITY:
No change. Fix routes users to security controls that already existed live.

VERIFICATION COMMANDS:
grep for remaining '/global/read/publication/' references after patch; manual read of both files.

VERIFICATION RESULTS:
Both call sites now branch on pub.format === 'vibetextbook'; non-textbook formats unchanged. Build Guard v2 passed on push (use client directives, no duplicate routes, no merge conflicts).

REGRESSION RESULTS:
No other call sites referenced the old route for textbooks (confirmed by repo-wide grep before patch).

UNRELATED CHANGES PRESERVED:
Yes — 2-file diff only, no changes to non-textbook rendering.

NEW FINDINGS:
None beyond the audit correction already logged in session.

OPEN RISKS:
Old reader (/global/read/publication/[id]) remains reachable by direct URL for textbooks. Explicitly deferred, not folded into READ-001 — needs its own hardening fix once non-textbook formats have a canonical path too.

COMMIT: 57919fe

NEXT FIX: READ-002

---

READ-002 VERIFIED

FIX ID: READ-002
STATUS: VERIFIED

OBJECTIVE:
Establish one authoritative reading-progress model (identity, schema, write RPC, read wiring) for the canonical VibeTextbook reader.

ROOT CAUSE:
No reading progress existed at all. The five legacy vibelearn_* engagement tables (vibelearn_history/completed/saved/points/streaks) looked reusable on paper but were confirmed broken: FK'd to students.id (not profiles.id/auth.uid()), 0 live rows, and 114 of 115 students rows have no profile_id (no login). The one client write path (components/student/VibeLearnShellWrapper.tsx) was inserting auth.uid() into a column FK'd to a different table's id space. None of the five tables had a chapter_id or position/percent column regardless, so they could not have satisfied resume/position requirements even if repaired.

EVIDENCE:
- information_schema.columns + table_constraints queried live: vibelearn_{history,completed,saved,points,streaks,content_saves}.student_id all FK to students.id.
- SELECT count(*) on all five tables live: 0 rows each.
- students table: 115 rows, 1 with profile_id set.
- get_vibetextbook_reader / get_vibelearn_content_reader both already use auth.uid() directly with no students concept — confirmed as the correct, consistent identity to extend.

FILES CHANGED:
- app/read/textbook/[publicationId]/page.tsx

DATABASE OBJECTS CHANGED:
- New table: public.vibe_reading_progress (viewer_id/publication_id/chapter_id keyed, unique constraint, RLS owner-read-only, no client write grants)
- New function: public.record_reading_progress(publication_id_input, chapter_id_input, progress_percent_input, position_input, reset_input) — SECURITY DEFINER
- Replaced function: public.get_vibetextbook_reader(publication_id_input) — added per-chapter progress_percent/completed_at/last_read_at and top-level resume

MIGRATION:
- supabase/migrations/20260728120000_create_vibe_reading_progress.sql
- supabase/migrations/20260728120010_record_reading_progress_rpc.sql
- supabase/migrations/20260728120020_wire_progress_into_vibetextbook_reader.sql
(Applied live directly first, migration files added to repo for parity/idempotent replay — all statements are create-if-not-exists / create-or-replace / drop-then-create-policy.)

DATA CHANGES:
None (no backfill; progress starts accumulating from first post-deploy read).

RLS AND SECURITY:
- vibe_reading_progress: RLS enabled, single SELECT policy (viewer_id = auth.uid()); no INSERT/UPDATE/DELETE policy or grant to any client role — writes only via record_reading_progress.
- record_reading_progress: viewer_id always derived server-side from auth.uid(); rejects null auth.uid() (auth_required); re-checks the same free/donation/freemium entitlement rule as the reader before accepting a write (not_entitled); rejects chapter/publication mismatches; progress monotonic via GREATEST unless reset_input=true; completed_at server-derived at 90%, never client-supplied.
- Anonymous (anon role) not granted execute on record_reading_progress.

VERIFICATION COMMANDS:
select public.get_vibetextbook_reader(<live grade 4 maths publication id>);
select public.record_reading_progress(...) with no auth context (simulates anonymous).

VERIFICATION RESULTS:
- record_reading_progress with no auth.uid() returned {"ok": false, "reason": "auth_required"} as expected.
- get_vibetextbook_reader returned progress_percent: 0, last_read_at: null, resume: null for an anonymous/no-progress call — correct shape, no crash.

REGRESSION RESULTS:
get_vibetextbook_reader's existing can_read/blocks logic byte-identical aside from the additive progress/resume fields; existing grants (anon+authenticated execute) preserved by CREATE OR REPLACE.

UNRELATED CHANGES PRESERVED:
Yes — legacy vibelearn_* tables and their one caller untouched, as scoped.

NEW FINDINGS:
The identity/schema mismatch above (students.id vs auth.uid()) is a pre-existing, independent bug in components/student/VibeLearnShellWrapper.tsx — not fixed here, flagged for separate triage if that student-facing surface is ever revisited.

OPEN RISKS:
Progress-write heuristic in the client (open=10%, leave-for-another-chapter=100%) is coarse — no real scroll/time-based measurement. Acceptable for MVP resume behavior; flagged as a future refinement, not a defect.

COMMIT: 4730825

NEXT FIX: READ-003

---

READ-003 VERIFIED

FIX ID: READ-003
STATUS: VERIFIED

OBJECTIVE:
Surface READ-002's progress data as a "Continue Reading" shelf on Discover, so returning readers can resume without re-finding a book manually.

ROOT CAUSE:
N/A (net-new feature, not a defect fix) — READ-002 recorded progress but nothing read it back outside the single reader page itself.

EVIDENCE:
N/A — feature build, not investigation-driven.

FILES CHANGED:
- app/global/read/page.tsx

DATABASE OBJECTS CHANGED:
- New function: public.get_continue_reading(limit_input) — SECURITY DEFINER, STABLE

MIGRATION:
- supabase/migrations/20260728130000_create_get_continue_reading_rpc.sql
(Applied live directly first, migration file added to repo for parity.)

DATA CHANGES:
None.

RLS AND SECURITY:
get_continue_reading derives viewer_id from auth.uid(); anonymous callers get {"ok": true, "items": []} rather than an error. Re-checks per-row entitlement (same free/donation/freemium rule) so a publication that changed pricing after the viewer started reading silently drops off the shelf rather than resuming into a now-blocked chapter. Granted execute to anon and authenticated (safe: no writes, degrades to empty for anon).

VERIFICATION COMMANDS:
Live transaction test: inserted one real vibe_reading_progress row for the Grade 4 Maths textbook under a real profile id, set request.jwt.claims to simulate that viewer, called get_continue_reading(10), then ROLLBACK.
Separate unauthenticated call to confirm the anon path.

VERIFICATION RESULTS:
- Authenticated simulation returned the expected single item: title, cover_url, cbc_subject/grade, current_chapter_id/number/title, progress_percent: 45, completed: false, last_read_at populated.
- Anonymous call returned {"ok": true, "items": []}.
- Transaction rolled back — confirmed no test rows persisted in vibe_reading_progress.

REGRESSION RESULTS:
Discover page's existing grid/filter/search logic untouched; shelf renders conditionally above it only when continueReading.length > 0.

UNRELATED CHANGES PRESERVED:
Yes — 2-file diff only (1 new migration, 1 patched page).

NEW FINDINGS:
None.

OPEN RISKS:
Shelf caps at 8 items with no "see all" — acceptable for MVP, flagged for later if a viewer accumulates many in-progress textbooks.

COMMIT: 3115544

NEXT FIX: READ-004
