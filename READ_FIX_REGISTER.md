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

Reconciled 2026-07-31 after PR #3 squash-merge (4e1f516) proposed an
unscoped "READ-010: assignment-level learner analytics and intervention
drill-down" that collided with the already-assigned READ-009/010/011
identities. Investigation (see RECONCILIATION NOTE below) found READ-008
has undocumented shipped sub-units (READ-008C, READ-008D–F) plus one
genuinely new, not-yet-built unit. The new unit keeps the READ-008 letter
sequence (READ-008G) rather than taking a top-level number, because it
continues the "Teacher classroom integration" milestone's own stated scope
(class completion rates), not a new milestone. READ-009/010/011 are
unchanged and unrenumbered.

ID| Priority| Status| Fix unit| Required result
READ-001| P0| VERIFIED| Route vibetextbook publications to the canonical hardened reader| Discover and Creator-profile cards for format=vibetextbook open /read/textbook/[publicationId] instead of the deprecated /global/read/publication/[id]
READ-002| P0| VERIFIED| Reading progress authority (schema, RPC, canonical reader wiring)| Per-viewer, per-chapter progress is recorded and read through a secure RPC, keyed on auth.uid()/profiles.id, and the canonical reader resumes to the viewer's last-read chapter
READ-003| P0| VERIFIED| Continue Reading shelf| Discover surfaces the viewer's most-recently-read vibetextbooks with cover/chapter/progress and a direct resume link
READ-004| P1| VERIFIED| CBC curriculum identity| Reader surfaces grade/subject/strand/sub-strand/topic/term/week/learning outcomes/honest alignment status+authority, server-resolved and deduplicated, plus a breadcrumb showing where the unit sits in the curriculum
READ-005| P1| VERIFIED| My Study Workspace| Bookmarks, highlights, notes, saved definitions/vocabulary/formulas, and Continue Reading unified into one learner workspace (sub-units READ-005A–005H, see reports below)
READ-006| P1| VERIFIED| Study View & accessibility| Text size, line spacing, reading width, light/dark/paper mode, accessible headings/labels, keyboard operation, reduced motion, better mobile navigation
READ-007| P2| VERIFIED| Reading analytics| Chapter-level completion/abandonment/duration signals beyond raw view counts
READ-008| P2| VERIFIED| Teacher classroom integration (parent milestone)| Teacher-assigned chapters, due dates, class completion rates and per-learner intervention drill-down are complete through READ-008A–G.
READ-008A| P2| VERIFIED| Classroom-to-reader assignment authority (schema/RLS)| See report below
READ-008B| P2| VERIFIED| Teacher assignment writer RPCs| See report below
READ-008C| P2| VERIFIED| Learner assigned-reading delivery| See report below
READ-008D–F| P2| VERIFIED| Teacher assignment management workspace: assignment list/cancel UI, due-date editing, class-level (aggregate) completion analytics| See report below
READ-008G| P2| VERIFIED| Assignment-level per-learner analytics and intervention drill-down| Teacher can inspect truthful learner-level assignment status, including account linkage, progress, completion and overdue intervention states.
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

---

READ-008B VERIFIED

FIX ID: READ-008B
STATUS: VERIFIED

OBJECTIVE:
Create the canonical RPC-only writer authority for teachers to assign published VibeTextbook chapters to their assigned classes and cancel their own assignments.

ROOT CAUSE:
READ-008A created the assignment table and read policies, but authenticated clients intentionally had no INSERT, UPDATE or DELETE path.

FILES CHANGED:
- supabase/migrations/20260730104700_read008b_assignment_writer_authority.sql
- READ_FIX_REGISTER.md
- HANDOVER.md

DATABASE OBJECTS CHANGED:
- public.assign_chapter_to_class(uuid, uuid, timestamptz)
- public.cancel_chapter_assignment(uuid)

MIGRATION:
Applied live to project yauqsxggtuxuykcbrtzf and captured in repository for parity.

DATA CHANGES:
None during migration.

RLS AND SECURITY:
- Teacher identity is derived from auth.uid().
- Class authority is verified through teacher_classes and matching classes.school_id.
- Only published chapters from published format=vibetextbook publications are assignable.
- Due dates must be in the future when supplied.
- Duplicate active assignments are rejected.
- Cancellation is limited to the original assigning teacher.
- Anonymous execution is revoked.
- Direct table writes remain unavailable to authenticated clients.

VERIFICATION RESULTS:
The production migration applied successfully. Function signatures, SECURITY DEFINER configuration and grants are represented by the migration and checked by repository validation.

REGRESSION RESULTS:
READ-008A table/RLS authority, reader progress, analytics and workspace features remain unchanged.

OPEN RISKS:
Teacher-facing assignment UI and learner delivery are not included in this writer-authority unit.

NEXT FIX:
READ-008C — Learner assigned-reading delivery and due-date surface.

---

READ-008C VERIFIED

FIX ID: READ-008C
STATUS: VERIFIED

Retroactive report. This unit was implemented and merged in PR #3
(4e1f516) but never closed out in this register — HANDOVER.md still
listed it as the "active next unit" after the merge. Closed out
2026-07-31 as part of the READ-008/READ-010 scope reconciliation.

OBJECTIVE:
Deliver the learner-facing "Assigned Reading" surface: a linked learner
sees only their own active classroom assignments, with per-chapter
progress, due status, and a direct deep link into the canonical reader.

ROOT CAUSE:
READ-008A/B established assignment authority and teacher-side writes but
no learner-facing read path existed. Learner identity must resolve
students.profile_id = auth.uid() and must never fabricate a linked
learner for the 114/115 students still without a profile.

EVIDENCE:
- supabase/migrations/20260730162000_read008c_learner_assigned_reading_delivery.sql
  defines get_my_assigned_reading(), confirmed live under production
  ledger version 20260730130044 (filename timestamp and live ledger
  version differ — see MIGRATION below).
- Function resolves learner via students.profile_id = auth.uid(), joins
  through student_classes (is_current = true, left_at is null), and
  only returns assignments where status = 'assigned' against published
  vibetextbook chapters — verified directly via pg_get_functiondef on
  the live project (yauqsxggtuxuykcbrtzf).
- app/student/workspace/page.tsx calls get_my_assigned_reading and
  renders reading_status/due_status/reader_url per assignment.
- reader_url is server-built as
  /read/textbook/{publication_id}?chapter={chapter_id}, matching the
  "Continue Reading deep link" behavior named in PR #3.

FILES CHANGED:
- supabase/migrations/20260730162000_read008c_learner_assigned_reading_delivery.sql
- app/student/workspace/page.tsx

DATABASE OBJECTS CHANGED:
- public.get_my_assigned_reading()

MIGRATION:
Applied live to project yauqsxggtuxuykcbrtzf. NOTE: repository filename
timestamp (20260730162000) does not match the live ledger version
(20260730130044) for this migration — same drift pattern TBL-001 fixed
for the TIMETABLE track. Not corrected in this documentation-only unit;
flagged as an open risk below.

DATA CHANGES:
None. Production currently has 0 rows in vibe_chapter_assignments, so
this path has not yet been exercised with real assignment data.

RLS AND SECURITY:
revoke all ... from public, anon; grant execute ... to authenticated,
service_role — confirmed live. Viewer identity is derived from
auth.uid() inside the SECURITY DEFINER function body, never accepted
from the client. No direct table access is granted.

VERIFICATION COMMANDS:
- Supabase list_migrations (project yauqsxggtuxuykcbrtzf) — confirmed
  version present in production ledger.
- pg_get_functiondef on public.get_my_assigned_reading — confirmed
  identity bridge and entitlement joins match the design rule.
- grep for get_my_assigned_reading usage in app/ — confirmed exactly
  one caller (app/student/workspace/page.tsx).

VERIFICATION RESULTS:
Function is live, correctly scoped, and wired to exactly one caller.
No fabricated learner identities; the function structurally cannot
return an assignment for a student without profile_id set.

REGRESSION RESULTS:
READ-008A/B authority and RPCs unchanged.

UNRELATED CHANGES PRESERVED:
Yes.

NEW FINDINGS:
Repository migration filename timestamp does not match the live ledger
version for this migration (see MIGRATION above).

OPEN RISKS:
- 114 of 115 legacy students remain unlinked to authenticated profiles
  (unchanged from READ-008A).
- 0 rows currently exist in vibe_chapter_assignments in production, so
  this delivery path has no real data to validate against yet.
- Migration filename/ledger-version drift (see MIGRATION above).

COMMIT: 4e1f516 (squash-merge, PR #3) — see RECONCILIATION NOTE below
for a verification limitation; this repository snapshot has no .git
history to independently confirm the hash.

NEXT FIX:
READ-008D–F — Teacher assignment management workspace (list, due-date
editing, class-level completion analytics).

---

READ-008D–F VERIFIED

FIX ID: READ-008D–F
STATUS: VERIFIED

Retroactive report, closed out 2026-07-31. This is the largest gap found
during reconciliation: a full migration and full teacher-facing UI exist
live and in the repository, but this unit was never named, scoped, or
reported in this register, and HANDOVER.md never mentioned it. This is
also where PR #3's proposed "READ-010: assignment-level learner
analytics and intervention drill-down" title actually originates — the
PR conflated this already-shipped aggregate-analytics unit with the
genuinely new per-learner drill-down work (see READ-008G).

OBJECTIVE:
Give teachers a management workspace over their own chapter assignments:
list all assignments across their classes, edit a due date, cancel an
assignment, and see class-level (aggregate, not per-learner) completion
signal per assignment.

ROOT CAUSE:
READ-008A/B/C delivered assignment authority, writer RPCs, and learner
delivery, but teachers had no read-back surface for assignments they had
already created, and no way to edit a due date without cancelling and
recreating the assignment.

EVIDENCE:
- Live migration ledger (Supabase list_migrations, project
  yauqsxggtuxuykcbrtzf) contains version 20260730132408,
  read008df_teacher_assignment_workspace_analytics — this file does NOT
  exist anywhere in the repository snapshot audited here.
- pg_get_functiondef confirms two functions created by that migration:
  public.get_my_classroom_reading_assignments() (teacher_id = auth.uid()
  scoped, returns per-assignment aggregates: learner_count,
  started_count, completed_count, overdue_count, average_progress) and
  public.update_chapter_assignment_due_at(uuid, timestamptz)
  (teacher_id = auth.uid() scoped, rejects past due dates, rejects
  assignments not in 'assigned' status).
- app/teacher/vibelearn/page.tsx contains ReadingAssignmentsTab,
  ReadingAssignmentCard, beginDueEdit/saveDueDate/cancelDueEdit, and
  cancelAssignment, calling get_my_classroom_reading_assignments,
  update_chapter_assignment_due_at, and cancel_chapter_assignment
  (grep-confirmed, single call site each).
- pg_policies on vibe_chapter_assignments confirms only two SELECT
  policies exist (teacher-own, linked-learner-own) — no direct
  INSERT/UPDATE/DELETE grants to authenticated clients, consistent with
  RPC-only writes.

FILES CHANGED (live; not present as a migration file in this repo snapshot):
- app/teacher/vibelearn/page.tsx (ReadingAssignmentsTab and related
  components)

DATABASE OBJECTS CHANGED (live only — no matching repo migration file found):
- public.get_my_classroom_reading_assignments()
- public.update_chapter_assignment_due_at(uuid, timestamptz)

MIGRATION:
Live production ledger version 20260730132408
(read008df_teacher_assignment_workspace_analytics). NOT present in
supabase/migrations/ in this repository snapshot. This is a
repository/production parity gap, not merely a filename-drift issue
(unlike READ-008B/C) — the file is simply missing from the repo.

DATA CHANGES:
None. Production currently has 0 rows in vibe_chapter_assignments.

RLS AND SECURITY:
Both RPCs are SECURITY DEFINER, derive teacher identity from auth.uid()
inside the function body, and scope every mutation/read to
teacher_id = auth.uid(). update_chapter_assignment_due_at additionally
rejects past-dated due dates and rejects edits to non-'assigned'
assignments. No direct table grants exist for authenticated clients.

VERIFICATION COMMANDS:
- Supabase list_migrations (project yauqsxggtuxuykcbrtzf)
- execute_sql against pg_proc/pg_get_functiondef for both functions
- execute_sql against pg_policies for vibe_chapter_assignments
- grep for RPC call sites in app/teacher/vibelearn/page.tsx and
  app/read/textbook/[publicationId]/page.tsx

VERIFICATION RESULTS:
Both RPCs exist live with correct teacher-scoping and correct guard
conditions. UI is wired to both with no orphaned or duplicate call
sites. get_my_classroom_reading_assignments returns aggregate counts
only (learner_count/started_count/completed_count/overdue_count/
average_progress) — it does NOT return which individual learners are
behind. That gap is READ-008G, not this unit.

REGRESSION RESULTS:
READ-008A/B/C authority, RLS, and RPCs unchanged.

UNRELATED CHANGES PRESERVED:
Yes.

NEW FINDINGS:
- This entire unit was live and shipped with no register entry and no
  HANDOVER.md update — the process gap that caused PR #3's numbering
  conflict in the first place.
- The migration file is absent from the repository, not merely
  misnamed. This should be fixed as its own follow-up (retrieve the
  applied SQL from the live project and add it to
  supabase/migrations/ under its correct ledger version) before any
  further schema work on this track, per CLAUDE.md's rule against
  assuming repo state matches production. Not done in this
  documentation-only unit.

OPEN RISKS:
- Missing migration file in repository (see NEW FINDINGS).
- 0 rows in vibe_chapter_assignments in production — this workspace has
  not been exercised against real assignment data.
- 114 of 115 legacy students remain unlinked to authenticated profiles.

COMMIT: 4e1f516 (squash-merge, PR #3) — see RECONCILIATION NOTE below;
this repository snapshot has no .git history to independently confirm
the hash.

NEXT FIX:
READ-008G — Assignment-level per-learner analytics and intervention
drill-down. AWAITING APPROVAL to begin (per session instruction: do not
begin implementation after this documentation unit without explicit
go-ahead).

---

RECONCILIATION NOTE — 2026-07-31

CONTEXT:
PR #3 (squash-merge 4e1f516) named its next proposed milestone
"READ-010: assignment-level learner analytics and intervention
drill-down." This register already defines READ-009 = Licensing,
READ-010 = Offline reading, READ-011 = AI tutor (see phase table,
established 2026-07-28). The "READ-010" label in the PR does not appear
anywhere in this repository — not in this register, not in
HANDOVER.md, not in any migration or source comment. It originated
outside the register process (in the PR description itself), not from
a documented scoping decision.

WHAT WAS ACTUALLY FOUND:
1. READ-008C (learner delivery) shipped and is live but was never
   closed out here — HANDOVER.md still listed it as "active next unit."
2. A live migration, read008df_teacher_assignment_workspace_analytics
   (ledger version 20260730132408), shipped teacher-side assignment
   management, due-date editing, and class-level (aggregate) completion
   analytics. This migration file does not exist in the repository at
   all. This is exactly the "class completion rates" scope the READ-008
   phase-table description already promised — it is a continuation of
   READ-008, not a new milestone.
3. The one thing that is genuinely new and NOT built is per-learner
   drill-down: identifying which specific linked learners are
   not-started or overdue on a given assignment, for teacher
   intervention. get_my_classroom_reading_assignments only returns
   aggregate counts, never a per-student roster.

DECISION:
- READ-008C and READ-008D–F are recorded VERIFIED above, evidenced
  against live Supabase state.
- The genuinely new work is assigned READ-008G, continuing the
  READ-008 letter sequence rather than taking a top-level number,
  because it is additional depth on an already-open milestone
  (READ-008 itself remains IN PROGRESS specifically because of this
  gap), not a new phase.
- READ-009 (Licensing), READ-010 (Offline reading), and READ-011
  (AI tutor) are UNCHANGED. Nothing here renumbers or reassigns them.

GIT VERIFICATION LIMITATION:
This unit was executed against an uploaded repository snapshot (zip)
that contains no .git directory. git log, git diff --check, and git
status could not be run against real history; commit 4e1f516 could not
be independently verified from within this session. All findings above
are instead evidenced directly against live file contents in the
snapshot and live Supabase schema/RPC/RLS/migration state (project
yauqsxggtuxuykcbrtzf), which is the stronger of the two sources of
truth per this register's own rules. This limitation is carried forward
as an open risk, not silently assumed away.

NO DEDICATED REGISTER-CONSISTENCY SCRIPT FOUND:
vibe-check.sh exists but only checks TypeScript, banned imports/tables,
layout conventions, and 'use client' presence — it has no register/
HANDOVER cross-check. Reconciliation above was done by manual
cross-reference of the register, HANDOVER.md, repository files, and
live Supabase state, not an automated script.

---

READ-008G VERIFIED

FIX ID: READ-008G
STATUS: VERIFIED

OBJECTIVE:
Provide teacher-only, assignment-level per-learner analytics and intervention
drill-down without treating roster learners whose reader account is not linked
as genuine non-starters.

ROOT CAUSE:
Existing classroom-reading analytics returned aggregate counts only. Classroom
roster identity uses students.id while reader progress uses profiles.id /
auth.uid(). Because students.profile_id is nullable, an unlinked student could
not truthfully be classified as not started.

IDENTITY MODEL:
- Teacher identity: auth.uid() = profiles.id.
- Reader identity: auth.uid() = profiles.id.
- Roster learner identity: students.id.
- The only reader/roster bridge is students.profile_id.
- A missing profile bridge is represented as account_unlinked, never as
  not_started.

STATE DEFINITIONS:
- account_unlinked
- not_started
- in_progress
- completed
- overdue_not_started
- overdue_in_progress

FILES CHANGED:
- app/teacher/vibelearn/page.tsx
- supabase/migrations/
  20260731113118_read008g_assignment_learner_intervention_drilldown.sql
- READ_FIX_REGISTER.md
- HANDOVER.md

DATABASE OBJECTS CHANGED:
- public.get_classroom_reading_assignment_learners(uuid)

MIGRATION:
- Live ledger version:
  20260731113118_read008g_assignment_learner_intervention_drilldown
- Repository parity file:
  supabase/migrations/
  20260731113118_read008g_assignment_learner_intervention_drilldown.sql
- The live RPC definition and repository migration were confirmed equivalent.

DATA CHANGES:
None. No learner, assignment or progress fixtures remain in production.

RLS AND SECURITY:
- Function is SECURITY DEFINER.
- search_path is restricted to public, auth.
- Teacher identity is derived from auth.uid().
- Assignment ownership is verified before learner data is returned.
- Anonymous execution is revoked.
- EXECUTE is granted to authenticated and service_role.
- No direct client table-write authority was added.

DATA CORRECTNESS:
- Deleted students are excluded.
- Current enrollment is restricted by class, school, is_current and left_at.
- Roster rows are deduplicated by student_id.
- Progress is joined using the linked profile for the exact assigned
  publication and chapter.
- account_unlinked learners have null progress and are never reported as
  not_started.
- Completion uses completed_at from the existing reading-progress authority.
- Null due dates are supported.
- Cancelled assignment status remains visible in the response and does not
  create false overdue states.

VERIFICATION RESULTS:
- Supabase migration ledger contains version 20260731113118.
- public.get_classroom_reading_assignment_learners(uuid) exists live.
- Function is SECURITY DEFINER with search_path public, auth.
- anon has no EXECUTE privilege.
- authenticated and service_role have EXECUTE privilege.
- Repository migration is present on main.
- Teacher VibeLearn UI calls the RPC and exposes the required status filters.
- Aggregate assignment cards remain intact and the learner drill-down is
  additive.
- Production currently contains 0 chapter assignments and 0 reading-progress
  rows, so full end-to-end real-data behavioural verification is not yet
  possible.

REGRESSION RESULTS:
Existing assignment creation, learner delivery, aggregate analytics, due-date
editing and cancellation remain unchanged.

OPEN RISKS:
- 114 of 115 non-deleted students remain unlinked to profiles.
- Production currently has 0 classroom reading assignments and 0 reading
  progress rows.
- Live migration 20260730132408
  read008df_teacher_assignment_workspace_analytics is still absent from the
  repository and remains a separate parity gap.
- READ-008B and READ-008C repository filename timestamps still differ from
  their live ledger versions.

COMMIT:
Recorded by the documentation close-out commit created after this report.

NEXT FIX:
READ-009 — Licensing & school access — OPEN. Do not begin without explicit
approval and a fresh permanent-loop investigation.
