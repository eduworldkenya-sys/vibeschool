# Content Engine migration parity

Production authority: Supabase project `yauqsxggtuxuykcbrtzf`.

## Final hardening sequence

The final Content Engine state includes these production migrations in order:

1. `ce_009_010b_assignment_authority_delivery`
2. `ce_011b_016_content_engine_hardening`
3. `ce_016b_assignment_resource_not_null`

Repository files:

- `supabase/migrations/20260801152000_ce_009_010b_assignment_authority_delivery.sql`
- `supabase/migrations/20260801154500_ce_011b_016_content_engine_hardening.sql`
- `supabase/migrations/20260801155000_ce_016b_assignment_resource_not_null.sql`

The older file `20260801210000_ce_010_to_015_content_engine_foundation.sql` is a consolidated historical foundation snapshot. It is not the final hardening state and must not be used alone to reproduce production.

## Required production verification

Run:

```sql
select *
from public.ce_full_integrity_audit()
order by case severity when 'critical' then 1 when 'high' then 2 else 3 end,
         check_key;
```

Every returned `issue_count` must equal zero before the Content Engine backend is considered clean.

## Authority chain

`vibe_publications` → `vibe_chapters` → `content_blocks` → `learning_resources` → `scheme_lesson_resource_links` → `vibe_chapter_assignments` → `content_assignment_learners` → `content_submission_evidence` → `submission_marks` → `competency_evidence_ledger` → `student_outcome_mastery` → `parent_learning_summaries`.
