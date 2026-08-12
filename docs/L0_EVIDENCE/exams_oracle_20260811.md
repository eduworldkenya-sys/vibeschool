# L0 Oracle — `public.exams`

Captured: 2026-08-11

## Why this object entered L0 scope

The isolated TBL-011 clean rebuild in PR #68 successfully applied the reconstructed `20260520000000_timetable_foundation_baseline` and continued through the tracked migration chain until `20260801123417_content_os_universal_resource_engine.sql` failed because `public.exams` did not exist.

The failing migration creates `public.teaching_resource_links` with `exam_id uuid references public.exams(id) on delete cascade`.

Repository search finds uses of `public.exams` but no tracked `CREATE TABLE public.exams` before that failure. The tracked `20260619_vibeexam.sql` migration creates the separate `exam_sessions`, `exam_question_log`, `exam_flags`, and `exam_streaks` objects; it does not create `public.exams`.

This makes `public.exams` a proven missing replay prerequisite and therefore an L0 oracle expansion, not a speculative feature addition.

## Current production catalog evidence

Current production columns:

- `id uuid NOT NULL DEFAULT gen_random_uuid()`
- `school_id uuid NOT NULL`
- `name text NOT NULL`
- `term integer NOT NULL`
- `academic_year integer NOT NULL`
- `exam_type text NOT NULL DEFAULT 'summative'`
- `pass_mark integer NOT NULL DEFAULT 50`
- `is_locked boolean NOT NULL DEFAULT false`
- `created_by uuid NOT NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`

Current production constraints:

- `exams_pkey`: primary key (`id`)
- `exams_school_id_fkey`: `school_id -> public.schools(id) ON DELETE CASCADE`
- `exams_created_by_fkey`: `created_by -> public.profiles(id)`
- `exams_school_id_name_term_academic_year_key`: unique (`school_id`, `name`, `term`, `academic_year`)
- `exams_term_check`: term in 1, 2, 3
- `exams_exam_type_check`: exam type in `summative`, `cat`, `midterm`, `opener`

Current production policies observed:

- `Admins manage exams`
- `School members view exams`
- `exams_admin`
- `exams_member_read`
- `exams_teacher`

These policies describe current production, not necessarily the historical baseline state. M(repo) must determine which are post-baseline and therefore must not be copied blindly into the reconstructed baseline.

## Safety boundary

No production DDL was executed to collect this evidence. Do not add a new production migration merely to satisfy the clean rebuild. The repair belongs in repository provenance/reconstruction and must preserve the live migration ledger.
