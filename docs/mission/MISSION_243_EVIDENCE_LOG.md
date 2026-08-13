# Mission 243 — Evidence Log

## Batch execution

### E-001 — Adaptive answer-key boundary
- **Task:** P1/P6 adaptive practice authority.
- **Finding:** `student_answer_adaptive_practice_question` returned `correct_index` to the learner client.
- **Fix:** New migration `20260813040000_secure_adaptive_practice_answer_boundary.sql` removes `correct_index` from the RPC response while retaining server-side scoring.
- **Verification:** Migration source inspection confirms the response contains `correct`, `explanation`, evidence metadata, and adaptation state, but no `correct_index`. `student_generate_adaptive_practice_question` already returns options without the answer index.
- **Status:** `VERIFYING` — production migration execution was blocked by the connected tool safety boundary; production remains on the pre-fix function until the migration can be executed through an authorized migration path.

### E-002 — Learner practice UI answer-key exposure
- **Task:** P3/P6 practice interaction security.
- **Finding:** `app/student/vibelearn/practice/page.tsx` directly selected `correct_index` from `exam_question_bank` and used it in the browser to mark the correct option.
- **Fix:** Replaced the direct table read with `getKcseAdaptivePractice`, whose learner contract excludes the authoritative answer index. The UI now records answers through the server-authoritative RPC and displays only the returned correctness/explanation.
- **Verification:** Branch file inspection confirms the practice page no longer selects or consumes `correct_index` for bank questions.
- **Status:** `VERIFIED` at source-contract level; runtime/browser execution remains a P8/P7 gate.

### E-003 — Internal misconception helper privilege
- **Task:** P1 privileged RPC surface.
- **Finding:** `student_record_adaptive_misconception` was directly executable by `authenticated` clients even though it is an internal helper invoked by the trusted answer-processing function.
- **Fix:** New migration revokes `public`, `anon`, and `authenticated` execution and retains `service_role` execution.
- **Verification:** Migration source inspection confirms the intended grant/revoke contract.
- **Status:** `VERIFYING` pending authorized production migration execution.

### E-004 — Identity/FK authority forensic correction
- **Task:** P1 data authority.
- **Finding:** An initial hypothesis suggested `student_mistake_notebook.student_id` should use `students.id`.
- **Test:** Production foreign-key inspection showed `student_mistake_notebook.student_id` references `profiles.id`, while `student_learning_events.student_id`, `student_twin_memory_claims.student_id`, and `student_twin_intervention_effects.student_id` reference `students.id`.
- **Repair:** The migration was corrected before execution so each write uses the authoritative ID type required by its table. This prevented introducing a new FK/data-integrity defect.
- **Status:** `VERIFIED` as an architectural/data-contract finding; the corrected migration is ready for authorized execution.

### E-005 — SEO private-surface exposure
- **Task:** P4 SEO/public-private separation.
- **Finding:** `app/sitemap.ts` included `/student/learn` and `/student/resources`, while `app/robots.ts` explicitly allowed those private surfaces.
- **Fix:** Removed private student URLs from the sitemap and changed robots rules to disallow `/student/` entirely. Added the public `/global/read` discovery surface to the sitemap.
- **Verification:** Source inspection confirms the sitemap contains only public informational/discovery URLs and robots now fails closed for student application routes.
- **Status:** `VERIFIED` at source-contract level; HTTP/production verification remains a P8/P9 gate.

### E-006 — AI machine-discovery contract
- **Task:** P5 AI discoverability.
- **Finding:** The current `main` branch did not contain an `/llms.txt` endpoint.
- **Fix:** Added `app/llms.txt/route.ts` with an explicit public knowledge contract, canonical public reader, sitemap, publication authority, and private-data/VibeTwin boundaries.
- **Verification:** Branch source inspection confirms `text/plain` response, bounded caching, public canonical links, and explicit private-data exclusions.
- **Status:** `VERIFIED` at implementation level; production HTTP verification remains open.

## Production execution blockers

1. The connected Supabase migration execution path rejected the adaptive-boundary production DDL under the current safety controls. No production mutation was falsely claimed.
2. Vercel production verification remains a separate P9 gate and must not be inferred from repository state.
3. Full typecheck/lint/build/browser execution still requires an executable CI/runtime path and reproducible results.

## Rule

A source-level `VERIFIED` item is not a production `CERTIFIED` item. Production certification requires executed evidence from the actual target environment.
