# VIBESCHOOL — PHASE 0 CURRICULUM CHAIN REPAIR
You are acting as a senior Supabase/Next.js engineer working inside an
existing, live, production codebase. Njima is the solo founder, builds
entirely from Android via Termux. You do not have creative license — you
are closing specific, pre-diagnosed gaps. Do not redesign anything not
listed below. Do not add features. Do not touch UI styling.

## IDENTITY / MISSION CONTEXT (read, do not act on beyond scope)
Vibeschool is building a Teacher Operating System for African education.
Sequence: win teachers → classrooms → schools → parents → content
providers → governments. Only "win teachers" (Phase 1) gets UI work right
now. Phase 0 is data foundation: curriculum, scheme, lesson plan, lesson
notes, homework, exercise, project, assessment must be a real
foreign-key-connected graph, because every future surface (Student OS,
Parent OS, School OS, Publisher access, Government reporting) is a NEW
VIEW onto this same graph — not a new schema. If this graph is wrong now,
every future surface becomes a rewrite instead of an addition. That is
the entire justification for this task. Do not lose sight of it.

## SCOPE LOCK — HARD BOUNDARY
- You may modify: /app/teacher, its components, lib/curriculum,
  lib/types.ts, and /supabase (migrations only, via SQL files — never
  edit supabase/types.ts by hand, it is regenerated).
- You may READ (never write) from /app/admin to understand current
  behavior, since app/admin/academics/curriculum/page.tsx and
  app/admin/academics/page.tsx are the only current readers of the
  tables involved.
- Do NOT modify /app/admin, /app/parent, /app/student, /app/global,
  /app/exam, /app/hq. If a fix genuinely requires touching /app/admin,
  STOP, do not write the code, and instead output a clearly labeled
  "FLAG FOR NJIMA" section explaining exactly what and why.

## ARCHITECTURE LAWS — NEVER VIOLATE, NO EXCEPTIONS
1. profiles.id = auth.uid() — never a separate user_id column on profiles.
2. Every query touching school-scoped data includes .eq('school_id', schoolId).
   EXCEPTION: the `curriculum` table has no school_id column by design —
   it is shared national KICD reference data. Do not add school_id to it.
3. Roles are teacher / admin / parent only. No student role in auth.
4. students table column is `name`, not `full_name`.
5. attendance table column is `timestamp`, not `date`.
6. twin_memory table uses `user_id`, not `profile_id`.
7. Never delete a file without first stating which other files import it.

## CONFIRMED FACTS ABOUT CURRENT STATE (verified by static code audit,
## re-verify against live Supabase before writing any migration)

FACT 1 — `curriculum` table (Supabase, real DB table): columns
grade, subject, term, week, strand, sub_strand, topic, periods, reference.
No school_id. No FK columns pointing out. This is the root reference node
and is correctly unscoped — do not change this.

FACT 2 — `scheme_of_work` table: HAS a real FK `curriculum_id →
curriculum.id`. Also has school_id, class_id, subject_id, teacher_id FKs.
THIS TABLE IS NEVER WRITTEN TO ANYWHERE IN THE APP. Confirmed by grepping
every .tsx/.ts file for "scheme_of_work" — it is only read, by
app/admin/academics/page.tsx and app/admin/academics/curriculum/page.tsx.
There is no insert/upsert call to it anywhere in app/teacher.

FACT 3 — The real teacher-facing "mark topic as delivered" flow lives in
app/teacher/scheme/page.tsx and writes to a DIFFERENT table:
`strand_progress` (columns: teacher_id, class_id, subject_id, school_id,
strand_id, term, week, status — set via .upsert with onConflict
'teacher_id,class_id,strand_id,term,week'). strand_progress also has a
curriculum_id column in its schema, but the app NEVER sets it on upsert.

FACT 4 — SUSPECTED SILENT-FAILURE BUG (verify first, this is the highest
priority item): app/teacher/scheme/page.tsx fetches strand *options* from
the `cbc_strands` table (a national reference table: grade, subject_id,
name, sub_strand — no school_id) and then writes those cbc_strands.id
values into strand_progress.strand_id. But strand_progress.strand_id has
a declared FK constraint pointing at the `strands` table — a completely
different, SCHOOL-SCOPED table (columns: id, name, school_id, subject_id
— no grade, no sub_strand). cbc_strands.id and strands.id are unrelated
UUID spaces. If this FK constraint is actually enforced in the live DB,
every strand_progress upsert from cbc_strands-sourced IDs is failing.
The calling code only does `if (!error) { updateLocalState() }` — no
toast, no user-visible error — so a teacher tapping "delivered" sees
nothing wrong while nothing is actually saved. This exact silent-failure
shape is the documented root cause of past bugs in this codebase
(twin_memory, attendance, students columns — see Architecture Laws above).
VERIFY THIS FIRST with a live Supabase query before changing anything else.

FACT 5 — `lesson_plans` table has NO scheme_id and NO curriculum_id
column. It links to strand_id (the strands table, not cbc_strands),
subject_id, class_id, teacher_id, timetable_slot_id. It cannot currently
be traced back to curriculum or scheme_of_work at all.

FACT 6 — `lesson_notes` table correctly FKs lesson_plan_id → lesson_plans.
This one link in the chain is real and correct. Do not touch it.

FACT 7 — `homework` table has no FK back to lesson_notes or lesson_plans.
lesson_notes.homework_set is a free-text column, not a relationship.

FACT 8 — app/admin/academics/curriculum/page.tsx (the only curriculum
UI that exists anywhere in the app) joins scheme_of_work rows to
curriculum rows by STRING EQUALITY on the `topic` field
(`schemeRows.some(s => s.topic === k.topic && s.status === "delivered")`)
even though scheme_of_work already has the real curriculum_id FK sitting
unused. Combine this with FACT 2 (scheme_of_work is never written to) and
this whole dashboard is currently measuring nothing real.

FACT 9 — Same file: `weeklyStatus(pct, expectedPct)` returns "behind" for
any class with zero curriculum rows loaded (true for every grade except
Grade 6 Mathematics, per curriculum data coverage). The StatusBadge
component has no "no data" state — only ahead/ontrack/behind — so every
non-Grade-6-Math class shows a false amber "Behind" pill directly next to
text that correctly says "No KICD topics loaded for this grade yet."

## YOUR TASK — IN THIS ORDER, STOP AND REPORT AFTER EACH NUMBERED STEP
Do not proceed to the next step until the current one is confirmed
correct. After each step, output a short status report: file path
touched, what changed, what it now links to, and any remaining risk.

### STEP 1 — VERIFY (read-only, no code changes)
Connect to the live Supabase project (read-only queries only) and confirm
or refute FACT 4. Specifically:
  a. Pull 5 sample rows from strand_progress. Do their strand_id values
     exist in `strands`, in `cbc_strands`, in both, or in neither?
  b. Check whether the strand_progress_strand_id_fkey constraint is
     actually present and enforced in the live schema (not just in the
     generated types.ts, which may be stale).
  c. Report row counts: strand_progress total rows vs. distinct teachers
     who have used the Scheme page recently, to sanity check whether
     saves are actually landing.
Output a clear verdict: "CONFIRMED — saves are failing" or "NOT
CONFIRMED — here is what's actually happening" before touching any code.

### STEP 2 — FIX the strand_id mismatch (only if Step 1 confirms it)
Pick ONE of these resolutions and implement it — do not do both:
  Option A: Change app/teacher/scheme/page.tsx to fetch/write against the
    `strands` table instead of `cbc_strands` (if `strands` is meant to be
    the school's customized/adopted subset of strands).
  Option B: Change strand_progress.strand_id's FK target from `strands`
    to `cbc_strands` via a migration SQL file (if cbc_strands was always
    the intended target and `strands` is dead weight).
State which option you chose and why, based on what Step 1 revealed about
which table actually has data and callers.
Add proper error handling: any failed upsert must show a toast to the
teacher — no more silent failures, per Architecture Law spirit.

### STEP 3 — DECIDE: scheme_of_work vs strand_progress (FLAG, don't just pick)
Do not silently choose. Output a comparison and STOP for Njima's decision:
  - Option A: Make app/teacher/scheme/page.tsx start writing real rows to
    scheme_of_work (which already has the correct curriculum_id FK),
    and plan to retire strand_progress.
  - Option B: Point the admin coverage page(s) at strand_progress instead
    of scheme_of_work, and add curriculum_id properly to strand_progress
    writes.
  Give a recommendation but do not implement until this is confirmed.

### STEP 4 — Add scheme_id to lesson_plans
Once Step 3 is resolved, write a migration adding a nullable
`scheme_id uuid references scheme_of_work(id)` column to lesson_plans
(or the equivalent table chosen in Step 3). Update
app/teacher/scheme/generate/page.tsx's lesson_plans insert (currently at
the `.from('lesson_plans').insert(payload)` call) to populate it. Do NOT
add a separate curriculum_id column directly on lesson_plans — trace
transitively through scheme to avoid duplicating the graph, per the
IMMUTABLE architecture doc's explicit anti-duplication rule.

### STEP 5 — Fix the admin coverage page (read-context only, flag the edit)
app/admin/academics/curriculum/page.tsx is outside your scope-locked
directories. Do NOT edit it. Instead output a "FLAG FOR NJIMA" section
with the exact diff needed to:
  a. Join scheme rows to curriculum by curriculum_id, not topic text.
  b. Add a distinct "no data" visual state to StatusBadge so classes with
     zero curriculum rows don't show a false "Behind" pill.

### STEP 6 — lesson_notes → homework (only after Steps 1-4 verified stable)
Propose (do not yet implement) a migration adding a nullable
lesson_notes_id to homework, and updating whichever teacher flow creates
homework to set it. Output the proposal only — stop here for this
session.

## CODE RULES — EVERY FILE, NO EXCEPTIONS
1. State the exact file path before any code.
2. Strings with apostrophes always use double quotes: "Track your child's progress"
3. Never delete a file without stating which other files import it and
   confirming those are updated too.
4. Every new/changed page must declare: full file path, what it imports,
   what it exports, which existing file links to it.
5. All shared types live in lib/types.ts — never import a type from a
   page file.
6. Every new page must be reachable from an existing page/component or
   it's rejected as an orphan.
7. Mentally confirm every import exists and every referenced file exists
   before giving code — no guessed paths.
8. No artifacts/canvas — give file paths and SQL/code directly, plain text.
9. All migration SQL goes in supabase/migrations/ as a new timestamped
   file. Never hand-edit supabase/types.ts.

## DEPLOYMENT FACTS (Termux-specific — mention in your final summary)
- supabase folder is gitignored — edge function / migration changes
  deploy via Supabase CLI only, never via git push.
- Migration apply pattern: cd to project root, export
  SUPABASE_ACCESS_TOKEN, then
  supabase_linux db push --project-ref yauqsxggtuxuykcbrtzf
  (or the appropriate migration command — confirm exact syntax before running).
- Git commits inside Ubuntu proot use: bash vibe-push.sh "message"

## FINAL OUTPUT FORMAT
End with a single consolidated summary table: file path | change type
(read/write/flag) | status (done/blocked/needs Njima decision) | risk
level. Nothing after that table — no marketing language, no "let me know
if you'd like me to continue."
