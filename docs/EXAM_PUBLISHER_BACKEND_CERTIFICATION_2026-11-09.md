# VibeSchool Original Exam Publisher — Backend Certification

Date: 2026-11-09 (Africa/Nairobi)  
Scope: `hq_publish_original_practice`, Grade 9 independent practice and learner assessment result lifecycle.

## Confirmed production state

- Canonical original exam publisher function installed in Supabase project `yauqsxggtuxuykcbrtzf`.
- Production Vercel deployment for `main` at `52c0c419` showed `READY` at verification time.
- Anonymous execution is not granted to the publisher; owner authorization is enforced in its body.
- Two original Grade 9 Mathematics pilot exams remain open. One additional Grade 9 Indices topic-practice assignment also exists and is separate.
- Repository migration inventory was checked from the complete Git tree: 1,071 SQL migration files, with **no duplicated version prefixes** at verification time.

## Transactional production checks (all simulated)

All mutating tests were performed within explicit PostgreSQL `BEGIN ... ROLLBACK` transactions. Authenticated identity was **simulated in SQL**, not established with an actual browser session.

| Check | Observed result |
|---|---|
| Owner preview of novel Grade 9 mathematics paper | `ok=true`, `valid=true`, `ready_to_publish=true` |
| Owner publication of one-question QA paper | Canonical definition created inside transaction |
| Rollback check | 0 QA assessment records and 0 QA outcome records persisted |
| Duplicate Pilot 02 title | `title_already_exists` |
| Answer key outside available choices | `answer_not_in_options` |
| Publication without explicit approval | Rejected with `explicit_owner_approval_required` |
| Independent Grade 9 learner starts Pilot 02 | 10 question payload, correct independent assessment identity |
| Learner answers 1 and skips 9 | 1/10, 10%, `score_released=true` |
| Learner result review | Returned marked items, correct answers and worked explanations |
| Rollback of learner simulated attempts | 0 matching QA attempt records persisted |

These test outcomes demonstrate the **database backend** contract. They do **not** certify the authenticated HQ screen, real-device interaction, nor an actual learner sign-in journey.

## Remaining end-to-end release gate

1. Log in to the HQ publisher as a real platform-owner session.
2. Upload a fresh, original and reviewed JSON exam that does not duplicate any existing questions or bank keys.
3. Preview the paper and inspect all explanations and marking keys.
4. Explicitly confirm publication; verify the resulting assessment and assignment IDs.
5. Open the assigned exam as a real independent learner of the correct grade.
6. Answer, skip, submit and review immediate results on mobile and desktop.
7. Confirm results persist across refresh and cannot be accessed by a different learner.
8. Record CI/build/deployment evidence for the exact version being certified.

**Policy:** Original content and automatically generated draft competency links must remain labelled provisional. Do not claim KICD verified or bypass owner approval.

