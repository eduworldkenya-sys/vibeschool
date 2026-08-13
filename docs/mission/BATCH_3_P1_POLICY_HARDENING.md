# Mission 243 — Batch 3 P1 Evidence

## E-013 — Pending curriculum content exposure

**Finding:** Production `curriculum_content` had an `authenticated` SELECT policy with `qual=true`. The table contains `lesson_context`, `parent_brief`, `school_id`, `status`, and `author_id`. Production data contains 27 global rows: 14 `confirmed` and 13 `pending`.

**Risk:** Any authenticated caller could read pending curriculum content, including internal authoring context, without publication/confirmation authority.

**Repair prepared:** `20260813050000_p1_public_policy_boundary_hardening.sql` replaces the unrestricted policy with `status = 'confirmed'`.

**Acceptance test:** authenticated caller sees confirmed curriculum content; pending content is denied. Anonymous caller has no policy-based access.

**Status:** VERIFYING — migration is committed to `mission-243-execution`; production execution remains pending controlled migration execution.

## E-014 — Internal system configuration exposure

**Finding:** `system_config` had an authenticated SELECT policy with `auth.uid() IS NOT NULL`, exposing internal operational thresholds and retention settings.

**Repair prepared:** revoke table privileges from `anon` and `authenticated`. Service-role/backend paths remain the intended operational access route.

**Acceptance test:** anonymous/authenticated direct table read is denied; trusted backend operation remains functional.

**Status:** VERIFYING — migration prepared; production execution pending.

## E-015 — School-scoped reference leakage

**Finding:** `past_papers`, `flashcards`, and `formula_sheets` had authenticated SELECT policies with `true`, despite containing `school_id` fields. This permitted cross-school reads for school-scoped rows.

**Repair prepared:** replace unrestricted policies with `school_id IS NULL OR school_id = caller profile school_id`.

**Acceptance test:** global records remain available; a caller can read only records for their own school; cross-school records return zero rows.

**Status:** VERIFYING — migration prepared; production execution pending.

## E-016 — FunHub answer-key exposure remains open

**Finding:** `funhub_questions` contains `correct` and `explanation`, and the Speed Quiz client selects `*` directly. The client computes correctness locally. This is an integrity flaw: a client can inspect the authoritative answer before answering.

**Decision:** Do not simply revoke the table SELECT yet because the existing FunHub UI depends on the current contract. The correct repair is a server-authoritative question/answer flow: public question projection without `correct`, plus a server-side answer validation/scoring RPC.

**Next action:** inventory all FunHub consumers, create the safe question projection/RPC, move scoring to the database, update the games, then revoke direct answer-key reads.

**Status:** OPEN — P1/P6 dependency.
