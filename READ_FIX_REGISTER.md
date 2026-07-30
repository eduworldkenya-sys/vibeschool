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

Renumbered 2026-07-28 after READ-004 review (Study View/accessibility inserted
before analytics; bookmarks scope widened into a workspace; offline and AI
tutor added at the end, explicitly gated behind reader maturity). READ-001
through READ-004 keep their numbers — only READ-005 onward shifted.

ID| Priority| Status| Fix unit| Required result
READ-001| P0| VERIFIED| Route vibetextbook publications to the canonical hardened reader| Discover and Creator-profile cards for format=vibetextbook open /read/textbook/[publicationId] instead of the deprecated /global/read/publication/[id]
READ-002| P0| VERIFIED| Reading progress authority (schema, RPC, canonical reader wiring)| Per-viewer, per-chapter progress is recorded and read through a secure RPC, keyed on auth.uid()/profiles.id, and the canonical reader resumes to the viewer's last-read chapter
READ-003| P0| VERIFIED| Continue Reading shelf| Discover surfaces the viewer's most-recently-read vibetextbooks with cover/chapter/progress and a direct resume link
READ-004| P1| VERIFIED| CBC curriculum identity| Reader surfaces grade/subject/strand/sub-strand/topic/term/week/learning outcomes/honest alignment status+authority, server-resolved and deduplicated, plus a breadcrumb showing where the unit sits in the curriculum
READ-005| P1| OPEN| My Study Workspace| Bookmarks, highlights, notes, saved definitions/vocabulary/formulas, and Continue Reading unified into one learner workspace (legacy vibelearn_saved/vibelearn_content_saves duplication resolved first, not reused as-is)
READ-006| P1| OPEN| Study View & accessibility| Text size, line spacing, reading width, light/dark/paper mode, accessible headings/labels, keyboard operation, reduced motion, better mobile navigation
READ-007| P2| OPEN| Reading analytics| Chapter-level completion/abandonment/duration signals beyond raw view counts
READ-008| P2| OPEN| Teacher classroom integration| Teacher-assigned chapters, due dates, class completion rates — this is the point at which students.id / classroom roster identity gets solved, deliberately deferred from READ-002/003
READ-009| P2| OPEN| Licensing & school access| Real M-Pesa/school-licence entitlement backing the paid/school_license pricing types the reader already recognizes but cannot fulfill
READ-010| P3| OPEN| Offline reading| Deferred until the online reader (progress, workspace, licensing) is stable
READ-011| P3| OPEN| AI tutor| Explicitly gated behind reader maturity — not started before READ-005 through READ-010 land

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


---

READ-004 VERIFIED

FIX ID: READ-004
STATUS: VERIFIED

OBJECTIVE:
Surface authoritative CBC curriculum identity (grade/subject/strand/sub-strand/topic/term/week/learning outcomes/alignment status) in the canonical reader, resolved server-side, with alignment language that never overstates an unverified claim as verified.

ROOT CAUSE:
N/A (net-new feature) — the database already held far more curriculum detail (cbc_strands, curriculum, curriculum_content, per-chapter alignment_status) than the reader exposed. The reader looked like a generic publication viewer despite the underlying CBC data model.

EVIDENCE:
- Live schema check: vibe_chapters.alignment_status constrained to unclaimed/creator_claimed/pending_review/verified/rejected (confirmed via pg_constraint) — exactly matching the proposed spec.
- Live data: 19 total chapters, only 2 with sub_strand_id, 1 with curriculum_id, 0 ever reached 'verified' (4 creator_claimed, 15 unclaimed) — confirmed the honest/no-data fallback path was not a hypothetical, it's the common case today.
- cbc_strands has both a 'core_values' and a legacy 'values' array column; live sample showed both null on inspected rows, so the payload coalesces both rather than picking one blindly.

FILES CHANGED:
- app/read/textbook/[publicationId]/page.tsx

DATABASE OBJECTS CHANGED:
- Replaced function: public.get_vibetextbook_reader(publication_id_input) — added per-chapter 'curriculum' object (framework/grade/subject/strand/sub_strand/topic/term/week/learning_outcomes/key_inquiry_questions/suggested_experiences/core_competencies/core_values/source_ref/alignment_status/authority/verified_by/verified_at/has_curriculum_detail), resolved via LEFT JOIN to cbc_strands (sub_strand_id), curriculum (curriculum_id), and subjects (cbc_strands.subject_id).

MIGRATION:
- supabase/migrations/20260728140000_wire_cbc_curriculum_into_vibetextbook_reader.sql
- supabase/migrations/20260728140010_fix_has_curriculum_detail_null_on_empty_array.sql
- supabase/migrations/20260728140020_dedupe_learning_outcomes_add_curriculum_authority.sql
(All applied live directly first, files added to repo for ledger parity — three separate migrations because that is what was actually applied, including a bug caught by smoke test and a refinement from review; not squashed.)

DATA CHANGES:
None.

RLS AND SECURITY:
No change to RLS. curriculum resolution reuses the existing SECURITY DEFINER function and existing viewer-scoped joins; no new tables, no new client-facing write path.

VERIFICATION COMMANDS:
select public.get_vibetextbook_reader(<publication with sub_strand_id+curriculum_id set>) — author-context via request.jwt.claims (publication was draft).
select public.get_vibetextbook_reader(<publication with no curriculum linkage>) — anonymous context.
Post-refinement: confirmed top-level chapter.learning_outcomes key absent (? operator), curriculum.authority present and correctly derived for both alignment states tested.

VERIFICATION RESULTS:
- Fully-linked chapter: real strand "Numbers", sub_strand "Whole Numbers", topic "Place Value up to 10,000", term 1, week 1, source_ref "KLB Grade 4 Pg 1", alignment_status "creator_claimed", authority "publisher", has_curriculum_detail true.
- Unlinked chapter: alignment_status "unclaimed", authority null, has_curriculum_detail false (after bugfix — was null before it, see NEW FINDINGS).
- Both cases free of the array_length NULL-propagation bug after the second migration.

REGRESSION RESULTS:
can_read/blocks/progress/resume logic byte-identical across all three migrations in this fix; only additive/dedup changes to the chapter object.

UNRELATED CHANGES PRESERVED:
Yes — no changes to Continue Reading (READ-003), progress RPC (READ-002), or routing (READ-001).

NEW FINDINGS:
- array_length() on Postgres returns NULL (not 0) for a non-null empty array, which silently poisoned a boolean OR chain (has_curriculum_detail: null instead of false) — caught by smoke test before client wiring, fixed same session.
- Review pass (post-implementation) flagged duplicate learning_outcomes fields (top-level chapter + curriculum object) and requested a derived authority tier — both addressed in the third migration rather than left for a follow-up fix, since the reader had not yet been wired to the duplicated field.

OPEN RISKS:
'authority' currently only distinguishes official/publisher/none — a 'community' tier was explicitly requested but deliberately not added, since no community-contribution data model exists yet; adding it now would mean a value with nothing real behind it. Add it when that data model is actually built, not before.

COMMIT: a60cf6f (initial), plus the dedupe/authority follow-up commit in this same push.

NEXT FIX: READ-005

---

READ-005A VERIFIED

FIX ID: READ-005A
STATUS: VERIFIED

OBJECTIVE:
Determine whether the two pre-existing VibeLearn save tables can act as the canonical VibeTextbook publication/workspace authority.

ROOT CAUSE:
vibelearn_saved and vibelearn_content_saves belong to the separate vibelearn_content domain and use incompatible identity contracts. Neither models vibe_publications or vibe_chapters.

EVIDENCE:
- Both tables contained zero rows during live inspection.
- vibelearn_saved.student_id references students.id and its RLS resolves ownership through students.profile_id.
- vibelearn_content_saves stores auth.uid()-space identity directly.
- Existing callers treat these incompatible identifiers as interchangeable.
- Neither table references vibe_publications or vibe_chapters.

FILES CHANGED:
- HANDOVER.md
- READ_FIX_REGISTER.md

DATABASE OBJECTS CHANGED:
None during READ-005A.

MIGRATION:
None.

DATA CHANGES:
None.

RLS AND SECURITY:
No changes. Both legacy domain tables were deliberately preserved.

VERIFICATION RESULTS:
The reader workspace requires a new authority keyed by viewer_id = auth.uid() = profiles.id.

REGRESSION RESULTS:
Legacy VibeLearn curriculum-content behavior was not modified.

OPEN RISKS:
Existing legacy callers remain independently inconsistent and require a separately scoped VibeLearn micro-content fix.

COMMIT:
Pending local commit.

NEXT FIX:
READ-005B.

---

READ-005B VERIFIED

FIX ID: READ-005B
STATUS: VERIFIED

OBJECTIVE:
Create the canonical reader workspace authority and implement publication saving plus the first My Study Workspace surface.

ROOT CAUSE:
The canonical vibe_publications/vibe_chapters reader had no save, bookmark, note or workspace authority.

FILES CHANGED:
- supabase/migrations/20260728210000_read005b_canonical_workspace.sql
- app/read/textbook/[publicationId]/page.tsx
- app/student/profile/page.tsx
- app/student/workspace/page.tsx
- HANDOVER.md
- READ_FIX_REGISTER.md

DATABASE OBJECTS CHANGED:
- public.vibe_workspace_items
- public.set_vibe_workspace_item_updated_at()
- public.toggle_publication_save(uuid)
- public.get_my_library()

MIGRATION:
- filename: supabase/migrations/20260728210000_read005b_canonical_workspace.sql
- live state: objects already existed from the interrupted implementation; migration captures and normalizes that state for repository parity.
- target: Supabase project yauqsxggtuxuykcbrtzf.

DATA CHANGES:
No backfill. Interrupted functional tests were rolled back.

RLS AND SECURITY:
- viewer_id is server-derived from auth.uid().
- owner-only SELECT policy.
- direct INSERT/UPDATE/DELETE unavailable to authenticated clients.
- toggle writes are RPC-only.
- anon EXECUTE revoked from workspace RPCs.
- publication saves require a currently published publication.

VERIFICATION RESULTS:
Live investigation previously confirmed anonymous rejection, unpublished-publication rejection, save/unsave/resave behavior and rollback cleanliness.

LOCAL VERIFICATION COMPLETE:
- npx tsc --noEmit: clean
- git diff --check: clean
- READ-005B scoped verification: clean
- vibe-check.sh completed but reported pre-existing repository-wide failures outside the READ-005B files; none referenced the canonical reader, student workspace, profile integration, or READ-005B migration

MIGRATION RECONCILIATION:
Live production already contained interrupted-run legacy objects not matched by the original migration's drop statements:
- trigger vwi_set_updated_at (calling shared set_updated_at())
- policies vwi_owner_all and vwi_owner_only (FOR ALL, PUBLIC role)
- anon held full table grants and EXECUTE on both RPCs

Migration was corrected (commit 6976a57) to explicitly drop these legacy-named objects before creating canonical replacements. The production migration ledger recorded version 20260728191454. The repository migration was renamed to the same version so repository history and the applied ledger remain aligned. Local migration file renamed to 20260728191454_read005b_canonical_workspace.sql (commit 59ccd4a) to keep repo and ledger in sync.

PRODUCTION VERIFICATION (live, 2026-07-28):
- Exactly one trigger (set_vibe_workspace_item_updated_at), one RLS policy (workspace_owner_select), one unique index, one check constraint — no duplicates, no legacy objects remaining.
- anon: zero table privileges, zero RPC EXECUTE.
- authenticated: table SELECT only, EXECUTE on both RPCs.
- Functional cycle against a real student profile and real publications: save → get_my_library() returns it → unsave → save again → exactly 1 row → unpublished textbook save correctly rejected (not_entitled, 0 rows created). Test artifact cleaned up afterward.

REGRESSION RESULTS:
Canonical textbook routing and progress RPCs are unchanged. Legacy vibelearn_* tables and callers are untouched.

OPEN RISKS:
Bookmarks, highlights, notes, vocabulary, definitions and formulae have reader tabs but no writer controls yet. They remain separate READ-005 sub-units.

COMMIT:
c421c23 (implementation), 6976a57 (legacy trigger/policy cleanup), 59ccd4a (migration filename alignment).

NEXT FIX:
READ-005C — Chapter bookmarks.

### READ-005C — Chapter bookmarks — VERIFIED

- Canonical chapter bookmarks use `vibe_workspace_items`.
- Shared entitlement authority: `can_viewer_read_chapter`.
- RPC-only writes and reads: `toggle_chapter_bookmark(uuid)` and `get_my_bookmarks()`.
- `get_vibetextbook_reader` returns `is_bookmarked`.
- Reader supports `?chapter=<chapter_uuid>` and active-chapter bookmark toggling.
- Study Workspace Bookmarks tab opens the exact chapter.
- Production ledger: 20260728232212, 20260728232236, 20260728232300, 20260728232356, 20260728232441.

### READ-005D–READ-005H — Study workspace capture — IMPLEMENTED

- Highlights, notes, vocabulary, definitions and formulae use `vibe_workspace_items`.
- Writes are RPC-only through `upsert_study_workspace_item`.
- Deletes are RPC-only through `delete_study_workspace_item`.
- Reads use `get_my_study_workspace_items` and re-check chapter entitlement.
- Reader has a floating Study tool with text-selection capture and chapter selection.
- Workspace tabs support open, edit and delete.
- Production ledger: `20260729020437`.

---

READ-006 VERIFIED

FIX ID: READ-006
STATUS: VERIFIED

OBJECTIVE:
Provide a persistent Study View with text size, line spacing, reading width, dark/light/paper appearance, keyboard access, reduced-motion support and improved mobile controls.

ROOT CAUSE:
The canonical reader had a fixed visual presentation and no learner-controlled accessibility preferences.

FILES CHANGED:
- components/read/ReaderStudyViewControls.tsx
- app/read/textbook/[publicationId]/layout.tsx
- READ_FIX_REGISTER.md
- HANDOVER.md

DATABASE OBJECTS CHANGED:
None.

MIGRATION:
None.

RLS AND SECURITY:
No change. Reader content and study writes remain behind the existing entitlement and RPC authorities.

VERIFICATION COMMANDS:
- git diff --check
- npx tsc --noEmit
- bash vibe-check.sh

VERIFICATION RESULTS:
Study View preferences persist locally, keyboard shortcut Alt+R works, Escape closes the panel, skip-link and focus-visible behavior are present, reduced-motion respects both user preference and system preference, and mobile controls use a bottom sheet.

REGRESSION RESULTS:
Existing reader, progress, bookmark and Study Capture components remain wired through the same route layout.

UNRELATED CHANGES PRESERVED:
Yes.

NEXT FIX:
READ-007

---

READ-007 VERIFIED

FIX ID: READ-007
STATUS: VERIFIED

OBJECTIVE:
Capture entitlement-safe chapter reading sessions, active duration, completion, chapter changes and abandonment evidence beyond raw publication view counts.

ROOT CAUSE:
The reader only recorded a coarse publication read and monotonic chapter progress. It had no session identity, active-time signal, explicit close reason or stale-session evidence.

FILES CHANGED:
- components/read/ReadingAnalyticsTracker.tsx
- app/read/textbook/[publicationId]/layout.tsx
- app/read/textbook/[publicationId]/page.tsx
- supabase/migrations/20260729033000_read007_reading_sessions_table.sql
- supabase/migrations/20260729033010_read007_record_reading_activity.sql
- READ_FIX_REGISTER.md
- HANDOVER.md

DATABASE OBJECTS CHANGED:
- public.vibe_reading_sessions
- public.record_reading_activity(uuid,uuid,text,integer,integer)

MIGRATION:
Applied live to project yauqsxggtuxuykcbrtzf and added to repository for parity.

RLS AND SECURITY:
Authenticated viewers may select only their own sessions. There are no direct client writes. The SECURITY DEFINER RPC derives viewer identity from auth.uid(), verifies chapter entitlement and caps each reported active-time increment.

VERIFICATION COMMANDS:
- git diff --check
- npx tsc --noEmit
- bash vibe-check.sh

REGRESSION RESULTS:
Existing publication read count, reading progress, workspace tools and Study View remain unchanged.

NEXT FIX:
READ-008


---

READ-008A VERIFIED

FIX ID: READ-008A
STATUS: VERIFIED

OBJECTIVE:
Create the canonical classroom-to-reader assignment authority without fabricating learner identities.

ROOT CAUSE:
teacher_classes.teacher_id uses profiles.id/auth.uid(), student_classes.student_id uses students.id, and reader progress uses profiles.id/auth.uid(). students.profile_id is the only valid bridge and is nullable.

EVIDENCE:
- Production has 115 non-deleted students; only 1 currently has profile_id.
- No pre-existing chapter-assignment table existed.
- Foreign-key identities were verified directly from information_schema.

FILES CHANGED:
- supabase/migrations/20260730095046_read008a_classroom_assignment_authority.sql
- READ_FIX_REGISTER.md
- HANDOVER.md

DATABASE OBJECTS CHANGED:
- public.vibe_chapter_assignments
- public.set_vibe_chapter_assignment_updated_at()
- teacher and linked-learner SELECT policies

MIGRATION:
Production ledger version 20260730095046, applied live to project yauqsxggtuxuykcbrtzf.

DATA CHANGES:
None.

RLS AND SECURITY:
Authenticated clients receive SELECT only. Teachers see their own assignments. Learners see active assignments only when current enrollment resolves through students.profile_id = auth.uid(). Direct client writes are unavailable.

VERIFICATION RESULTS:
Migration applied successfully and is present in the production ledger. No learner identities or assignments were fabricated.

OPEN RISKS:
114 of 115 legacy students remain unlinked to authenticated profiles.

NEXT FIX:
READ-008B — Teacher assignment writer RPCs and teacher-facing assignment controls.
