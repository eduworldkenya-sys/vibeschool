# Form 4 Business Studies — Production Seed Manifest

Date: 2026-08-28
Curriculum: Kenya legacy 8-4-4 / KCSE
Subject: Business Studies
Level: Form 4
Publication ID: `b8440000-0000-4000-8000-000000000004`
Publication title: `Vibe Business Studies Form 4`

## Authority and provenance

The production corpus is intentionally bound to the legacy Kenya Secondary School Revised Business Studies Curriculum/Form IV structure, not the Grade 10 CBE curriculum.

The official KICD website remains the institutional authority/root source. During this production run the currently indexed KICD site confirmed continuing Form 4 Business Studies delivery, but the legacy syllabus PDF itself was not recoverable from the public KICD index. The detailed Form IV transcription was therefore cross-checked against independent reproductions of the legacy document titled `KENYA SECONDARY SCHOOL - REVISED BUSINESS STUDIES CURRICULUM` before seeding.

Because the authoritative legacy PDF URL was not recoverable, seeded chapter alignment is `creator_claimed`; no `verified_by`, human curriculum approval, teacher review, or release approval is fabricated.

## Curriculum coverage

| Topic | Title | Specific objectives mapped | Curriculum ID | Chapter ID |
| --- | --- | ---: | --- | --- |
| 25.00 | Source Documents and Books of Original Entry | 6 | `b8442500-0000-4000-8000-000000000001` | `b844c010-0000-4000-8000-000000000001` |
| 26.00 | Financial Statements | 7 | `b8442600-0000-4000-8000-000000000001` | `b844c020-0000-4000-8000-000000000001` |
| 27.00 | Money and Banking | 12 | `b8442700-0000-4000-8000-000000000001` | `b844c030-0000-4000-8000-000000000001` |
| 28.00 | Public Finance | 8 | `b8442800-0000-4000-8000-000000000001` | `b844c040-0000-4000-8000-000000000001` |
| 29.00 | Inflation | 7 | `b8442900-0000-4000-8000-000000000001` | `b844c050-0000-4000-8000-000000000001` |
| 30.00 | International Trade | 15 | `b8443000-0000-4000-8000-000000000001` | `b844c060-0000-4000-8000-000000000001` |
| 31.00 | Economic Development and Planning | 7 | `b8443100-0000-4000-8000-000000000001` | `b844c070-0000-4000-8000-000000000001` |
| **Total** | **7 topics** | **62** |  | **7 chapters** |

## Seed contract

The seed reuses the canonical History/content architecture:

- `public.subjects` — existing global `Business Studies` subject
- `public.curriculum` — seven deterministic Form IV topic authority rows
- `public.vibe_publications` — one `vibetextbook` publication
- `public.vibe_chapters` — seven ordered chapters with JSON content blocks
- canonical public reader route `/read/textbook/[publicationId]/[chapterId]`
- canonical learning-loop metadata: `orient`, `comprehend`, `apply`, `connect`, `extend`
- canonical Teacher OS bridge from the reader

All production identifiers are deterministic. Inserts use fixed IDs/upsert semantics so reruns do not create duplicate chapters or publications.

## Learning-system evidence

Every seeded chapter contains:

- learner orientation and syllabus-linked outcomes;
- sequenced explanations;
- Kenyan or East African application where relevant;
- worked/calculation examples where appropriate;
- an `apply` diagnostic checkpoint;
- a curriculum-specific misconception target;
- original KCSE-style practice (not represented as a past-paper question);
- Teacher OS activity/derivative block;
- Student OS activity/derivative block.

Financial Statements preserves the explicit legacy syllabus boundary that end-year adjustments are not required in this topic. Public Finance, Inflation, International Trade and Economic Development avoid encoding volatile current rates/statistics/programmes as timeless syllabus facts.

## Runtime verification ledger

Production database verification immediately after the seed returned:

- publication count: 1 canonical publication;
- chapters: 7/7;
- objective mappings: 62/62;
- minimum chapter block count: 14;
- minimum seeded chapter word count: 804;
- all seven chapter states: `published`;
- all seven alignment states: `creator_claimed`;
- no fabricated human verifier.

Reader code on canonical `main` loads published textbook payloads server-side through `get_public_vibetextbook_reader`, renders the selected chapter from initial server payload, and generates chapter-specific canonical/Open Graph metadata.

## Remaining certification boundary

This corpus is live-generated content, but a strict `COMPLETE` curriculum-authority certification still requires recovery/attachment of the exact authoritative KICD/KIE legacy syllabus artifact (URL/file/hash/page locators) or a legitimate human curriculum-authority verification. The seed deliberately does not claim that gate has passed.