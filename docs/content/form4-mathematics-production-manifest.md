# Form 4 Mathematics — Production Seed Manifest

Date: 2026-08-28
Curriculum: Kenya legacy 8-4-4 / KCSE
Subject: Mathematics
Level: Form 4
Publication ID: `a8440000-0000-4000-8000-000000000004`
Publication title: `Vibe Mathematics Form 4`

## Authority and provenance

The production corpus is bound to the legacy revised Kenya secondary Mathematics syllabus, Form Four, not Grade 10 CBE Mathematics. The recovered revised secondary syllabus identifies the Form Four Mathematics scope as topics 59.0.0–68.0.0: Matrices and Transformations; Statistics (2); Loci; Trigonometry (3); Three Dimensional Geometry; Longitudes and Latitudes; Linear Programming; Differentiation; Area Approximation; Integration.

Authority source used for exact objective reconciliation:
`https://kcpe-kcse.com/wp-content/uploads/2018/02/SYLLABUS-ORIGINAL-FOR-MATH-PHYSICS-CHEMISTRY-BIOLOGY-AGRICULTURE-HOME-SCIENCE.pdf`

KICD remains the current institutional authority/root at `https://kicd.ac.ke/`; the legacy syllabus belongs to the predecessor/revised 8-4-4 syllabus lineage. No KICD endorsement, human reviewer, teacher approval, `verified_by`, or release approval is fabricated.

Important syllabus boundaries preserved in the content include: product and quotient differentiation rules are excluded; Area Approximation includes both trapezium and mid-ordinate rules; Longitudes and Latitudes uses the syllabus constants/context; Form Four scope is topics 59–68 rather than generic textbook ordering.

## Curriculum coverage

| Topic | Title | Objectives mapped | Curriculum ID | Chapter ID |
| --- | --- | ---: | --- | --- |
| 59.0.0 | Matrices and Transformations | 10 | `a8440059-0000-4000-8000-000000000001` | `a844c059-0000-4000-8000-000000000001` |
| 60.0.0 | Statistics (2) | 6 | `a8440060-0000-4000-8000-000000000001` | `a844c060-0000-4000-8000-000000000001` |
| 61.0.0 | Loci | 3 | `a8440061-0000-4000-8000-000000000001` | `a844c061-0000-4000-8000-000000000001` |
| 62.0.0 | Trigonometry (3) | 5 | `a8440062-0000-4000-8000-000000000001` | `a844c062-0000-4000-8000-000000000001` |
| 63.0.0 | Three Dimensional Geometry | 5 | `a8440063-0000-4000-8000-000000000001` | `a844c063-0000-4000-8000-000000000001` |
| 64.0.0 | Longitudes and Latitudes | 6 | `a8440064-0000-4000-8000-000000000001` | `a844c064-0000-4000-8000-000000000001` |
| 65.0.0 | Linear Programming | 4 | `a8440065-0000-4000-8000-000000000001` | `a844c065-0000-4000-8000-000000000001` |
| 66.0.0 | Differentiation | 10 | `a8440066-0000-4000-8000-000000000001` | `a844c066-0000-4000-8000-000000000001` |
| 67.0.0 | Area Approximation | 6 | `a8440067-0000-4000-8000-000000000001` | `a844c067-0000-4000-8000-000000000001` |
| 68.0.0 | Integration | 6 | `a8440068-0000-4000-8000-000000000001` | `a844c068-0000-4000-8000-000000000001` |
| **Total** | **10 topics** | **61** | | **10 chapters** |

## Production data contract

The production seed reuses the canonical VibeSchool content architecture:

- existing global `public.subjects` Mathematics subject;
- deterministic `public.curriculum` Form Four topic rows;
- 61 coded `public.curriculum_learning_outcomes` rows;
- canonical `public.chapter_learning_outcome_links` with `masters` alignment;
- one `public.vibe_publications` `vibetextbook` publication;
- ten ordered `public.vibe_chapters` JSON block chapters;
- public reader route `/read/textbook/[publicationId]/[chapterId]`;
- inline `LearningCheckpoint` blocks rather than a Mathematics-specific quiz platform;
- Teacher OS and Student OS derivative blocks inside every chapter.

The seed preserves publication invariants, including `published_at` for published chapters. Automated trigger-created uncoded `creator_claimed` duplicate outcomes were identified during production and their stale links/outcomes were removed in favour of the 61 coded official-source objective rows.

## Learning-system content

Every production chapter includes:

- explicit syllabus-linked outcomes;
- orientation and prerequisite diagnostic;
- conceptual explanation and relationship/derivation where applicable;
- six topic-specific worked examples;
- error analysis and misconception guidance;
- guided practice and independent practice;
- verified answer block;
- canonical LearningCheckpoint block;
- original KCSE-style application prompt;
- Teacher OS teaching sequence;
- Student OS mastery routine;
- mastery review.

Across the 10 chapters this seed currently contains 60 topic-specific worked examples and 60 explicit independent-practice items, in addition to checkpoint and KCSE-application prompts.

## Runtime database evidence

Production database checks after seeding established:

- canonical publication: 1;
- chapters: 10/10;
- chapter minimum block count: 20;
- official objective rows: 61/61 after stale-trigger cleanup;
- objective-to-chapter mappings: 61/61;
- published chapters carry `published_at`;
- all alignment states remain `creator_claimed` at chapter level;
- no human `verified_by` is fabricated.

## Certification boundary

This production seed is deliberately not labelled final human curriculum certification. The objective coverage and authored content can be exposed through the canonical reader, but strict release certification still requires the remaining independent specialist/critic depth pass, exhaustive worked-answer recalculation evidence, visual graph/construction artifact verification, and any legitimate human release gate required by the canonical publication state machine.
