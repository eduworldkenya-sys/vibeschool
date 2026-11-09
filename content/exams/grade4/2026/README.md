# VibeSchool Grade 4 — Original Exam Series 01

These are **new, original VibeSchool-authored assessments**, not renamed or
copied Grade 4 pilot examinations and not KNEC/KICD examination papers.

## First production candidates

| Learning area | Source | Questions | Marks | Stage |
| --- | --- | ---: | ---: | --- |
| Mathematics | mathematics-exam-01.json | 12 | 12 | Editorial / outcome review |
| English | english-exam-01.json | 12 | 12 | Editorial / outcome review |
| Kiswahili | kiswahili-exam-01.json | 12 | 12 | Editorial / outcome review |

Each original exam is set to 30 minutes, with one-mark four-option questions,
individual explanations, stable bank keys, and a limit of three attempts.

## Curriculum authority

The Grade 4 learning areas originate from the official KICD Grade Four Designs:
https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-four-designs/

The papers **do not** claim independent KICD outcome verification. They test
a selected subset of knowledge and reading/grammar competencies. They do not
replace oral, practical, creative or extended writing assessments.

## Publication contract

The currently supported public assessment engine uses `assessment_type:
practice`, including the Grade 9 public exam model. The *paper title* is a
VibeSchool exam (not a pilot), but it remains an automatically marked public
practice assessment in the backend. A separately governed formal school exam
requires the formal teacher/class assignment and release policy.

1. Run `node --test scripts/test-grade4-original-exams.mjs`.
2. Conduct an independent editorial read of all 36 questions, answer keys and
   explanations. Map every question to the applicable verified KICD outcome.
3. Open HQ `/hq/exams/publish`, import the JSON paper and select **Validate paper**.
4. The authenticated platform owner must approve and publish it through
   `hq_publish_original_practice` (no database impersonation or bypass).
5. Verify the new public-practice assignment appears for an independent
   Grade 4 learner; complete an attempt and verify immediate result, review,
   skipped answers and gradebook.
6. Only then update this manifest with actual assignment IDs and live
   certification evidence.

Do not label a paper live before the owner-authorized publication succeeds.

## Learning areas to follow

Science & Technology; Agriculture; Social Studies; Creative Arts; and
Religious Education (CRE, IRE or HRE as appropriate to the learner), followed
by language options where offered. Check school/global subject label matching
before publication: the existing global subject currently uses
"Science and Technology" whereas the Grade 4 authority uses
"Science & Technology".
