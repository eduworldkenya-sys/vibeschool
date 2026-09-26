# Form 4 Computer Studies — Production Manifest

## Release identity

- Subject: Computer Studies
- Examination code: KCSE 451
- Cohort: legacy 8-4-4 Form 4 / KCSE
- Publication: `Vibe Computer Studies Form 4`
- Publication ID: `c4510000-0000-4000-8000-000000000004`
- Reader route: `/read/textbook/c4510000-0000-4000-8000-000000000004/[chapterId]`
- Database status: `published`
- Curriculum alignment status: `creator_claimed`
- Senior School Grade 10–12 contamination: forbidden

## Production result

Production Supabase currently contains:

- 18/18 published chapters
- 18 deterministic curriculum rows
- 17,370 stored content words
- 432 active-learning blocks
- minimum chapter depth: 942 words
- maximum chapter depth: 1,020 words
- zero fabricated verifier fields

Each chapter follows the VibeSchool learning loop: orient → explain/model → perform → diagnose error → repair → Kenyan transfer → KCSE mode → mastery, with Teacher OS and Student OS derivatives.

## Curriculum separation

### Form IV new teaching content

1. 10.0.0 Introduction to Networking and Data Communication — 24 lessons
2. 11.0.0 Application Areas of Information and Communication Technology — 8 lessons
3. 12.0.0 Impact of ICT on Society — 8 lessons
4. 13.0.0 Career Opportunities in ICT — 4 lessons
5. 14.0.0 Project — 50 lessons

### Cumulative KCSE mastery from earlier forms

1. Introduction to Computers — Form 1
2. Computer Systems — Form 1
3. Operating Systems — Form 1
4. Word Processing — Form 2
5. Spreadsheets — Form 2
6. Databases — Form 2
7. Desktop Publishing — Form 2
8. Internet and E-mail — Form 2
9. Data Security and Controls — Form 2
10. Data Representation — Form 3
11. Data Processing — Form 3
12. Elementary Programming Principles — Form 3
13. Systems Development — Form 3

Earlier-form material is intentionally labelled `KCSE CUMULATIVE MASTERY`; it is not falsely represented as newly taught Form IV content.

## Examination authority bindings

Current KNEC evidence establishes the 451 examination family, including 451/1 theory, 451/2 practical and 451/3 project. KNEC regulations bind Paper 1 duration/marks and its Section A/Section B structure. Current KNEC project/timetable material identifies the project as a sustained seven-month component, while KNEC advance instructions continue to govern practical preparation for 451/2.

The legacy syllabus topic map was cross-checked against a reproduced Kenya Secondary School Computer Studies curriculum. An exact authoritative legacy KICD/KIE source artifact plus hash has not yet been recovered in this production run. Consequently the database correctly records `creator_claimed`; no human verifier, exact source hash, or false `verified` state was invented.

## Practical integrity

- Phone-capable reasoning activities are labelled `PHONE-SAFE`.
- Native productivity-software rehearsal is labelled `DESKTOP-RECOMMENDED` or `DESKTOP-REQUIRED` as appropriate.
- Programming work is labelled `SIMULATED_PRACTICAL` unless a verified code runtime actually executes it.
- Screenshots are never treated as proof of practical performance.
- Project content coaches process and evidence; it does not manufacture a candidate's assessed submission.
- Cybersecurity scenarios are defensive and do not provide intrusion instructions.
- Legacy technology remains where curriculum-relevant but is labelled historical/legacy rather than current default.

## Content architecture

Every unit contains, as applicable:

- curriculum scope and learning outcomes
- anchor diagnostic
- deep concept explanation
- worked demonstration
- examiner lens
- practical/simulation task
- evidence checkpoint
- named misconception
- debugging protocol
- repair check
- Kenyan system transfer
- original KCSE-style question
- mark-acquisition routine
- mastery ladder
- Teacher OS derivative
- Student OS mastery activity
- deep mastery studio
- practical evidence standard

## Release QA

- Publication persistence: PASS
- 18/18 chapter persistence: PASS
- Curriculum-row binding: PASS
- Form IV versus cumulative separation: PASS
- Content-depth floor: PASS
- Practical honesty labels: PASS
- Original question policy: PASS
- No fabricated curriculum verification: PASS
- Current production Vercel deployment: READY

## Open certification gaps

The publication is live as a production content baseline, but strict Cyborg `CERTIFIED` status is not claimed yet.

1. **AUTHORITY_GAP / P1** — exact authoritative legacy KICD/KIE syllabus artifact and cryptographic hash still need binding.
2. **RUNTIME_PROOF / P1** — programming and native application tasks need a verified executable/native practical runtime before `EXECUTABLE_PRACTICAL` can be claimed.
3. **ASSESSMENT_RUNTIME / P1** — the full dedicated mock/practical corpus, adaptive misconception persistence and timed mastery analytics require runtime proof rather than prose-only declarations.
4. **SUBJECT_TAXONOMY / P2** — the current publication codec does not yet expose a `computer_studies` CBC subject enum. Production therefore stores this legacy publication under `cbc_subject=other` while canonical curriculum rows bind to the real Computer Studies subject ID.

## Current release state

`PUBLISHED_CONTENT_BASELINE`

Strict Cyborg status: `NEEDS_REPAIR` until the P1 authority/runtime gates above are evidenced. This prevents publication success from being confused with full executable-system certification.
