# Grade 4 Mathematics VibePapers 001 — Private production staging receipt

**Release model: explicit owner-directed automated production release; no HQ human or independent educational reviewer.** Apply the one-time controlled migration only after exact-head GitHub checks pass. Publication status must be verified by production DB readback.

- Private bank key: `vibepapers-g4-math-001-private-2026`
- Private storage authority: `private.original_exam_drafts`; no plain-text question and answer-key sources in the current public Git branch.
- Format: 50 VibeSchool-original multiple-choice items, 50 marks, four unique answer options per question, one unambiguous key, explanations and provisional VibeSchool outcome codes; 14 mathematics sub-strands.
- Source scope: KICD *Grade 4 Mathematics*, revised 2024: https://kicd.ac.ke/wp-content/uploads/2024/02/GRADE.4.MATHEMATICS.pdf
- **Outcome status: provisional.** Production Grade 4 Maths outcome links remain creator-claimed and the comparable official-import records are not independently verified. Do not represent this as KICD-endorsed or source-outcome certified. There is no official KNEC affiliation.
- Automated private-bank audit: 50 ordered item numbers, 50 unique bank keys and prompts, 50 4-option sets, 50 valid keys and explanations, candidate outcome coverage present, zero exact published-prompt collisions. This is **structural verification, not educational approval**.
- Independent editorial review and authenticated owner publication are pending; direct publication by SQL or repo migration is prohibited. The current HQ owner-only private review/publisher remains authoritative.
- Upon owner-reviewed publication, use the canonical EXQ assignment and `hq_certify_exam_original_assignment` to register a unique `papers / 2026 / 1` product identity, only before any learner attempt. The feature hardening is in `20261115143000_exam_originals_reviewed_paper_provenance.sql`.
- Result/release, marking, learner outcomes, retries, gradebook and student account pathways must remain canonical EXQ functionality.
- Verification to capture before claiming live: owner authenticated approval, release receipt, resulting assessment/assignment UUIDs, exact 50 items and cognitive tags, protected result embargo, student Start/Save/Submit/Result/retry, a ready Vercel production deployment and fresh learner mobile QA.

## Preventing answer-key exposure

An earlier development-only candidate was accidentally committed to a publicly accessible temporary Git branch. That branch was force-reset without opening or merging a PR, but Git may retain unreachable objects; **the entire earlier candidate must be treated as exposed and may never be published or certified**. The 50-question private draft here is a distinct replacement, not the exposed source. Never put original exam answer keys in the public repository or CI logs. Only the server-private draft record and a verified owner-only review endpoint may hold keys before release.

## Rollback / recovery

If certification fails, the exam stays as a privately staged draft. If publication was executed, use the canonical assessment close/unpublish procedure with owner authorisation, preserve attempts and grades, and revoke the Originals classification without changing canonical scores. Never delete a paper with learner attempts to repair branding. The original private bank is retained for audit.

## Owner-directed automated release, 15 November 2026

The owner explicitly directed the assistant to publish without an HQ human. The private exam was independently rechecked by this assistant question-by-question for answer consistency, arithmetic and explanations; **that is an AI-assisted editorial check, not an independent human review**. The existing structurally verified private draft is protected by its exact MD5 content hash. The new migration `20261115150000_vibepapers_g4_math001_owner_directed_release.sql` performs a tightly scoped service-operated release for **this one paper only**, following VibeSchool's existing one-time owner-requested Grade 4 release precedent. It aborts for a changed draft, nonunique questions, malformed answer options, invalid outcomes, duplicates against published questions or an occupied series-year-paper number.

The published assessment records `human_educational_review = not_performed`, `independent_review = not_performed`, `owner_authenticated_signoff = not_claimed`, and `curriculum_verification = provisional`. `exam_original_assignment_series.review_mode = owner_directed_automated` distinguishes this release from personally reviewed HQ publications. Automated scoring, gradebook, attempts, results and independent-learner discovery reuse the canonical EXQ tables and RPCs.

**Do not mistake product-original classification for KICD accreditation or externally verified learning outcomes.** Any future human or external review must be a separate, real attestation, never backfilled as if it happened at publication.
