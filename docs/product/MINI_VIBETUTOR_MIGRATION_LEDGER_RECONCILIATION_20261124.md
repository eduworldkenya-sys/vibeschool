# Mini Lessons and VibeTutor migration ledger reconciliation — 24 November 2026

Read-only comparison of production project `yauqsxggtuxuykcbrtzf` and GitHub main at `6e7a85b2ea96b23396a94eb602bfd0caefdce71d`. All six Mini migrations are byte-identical to the deployed SQL; their source filenames now use the recorded versions 20261124044148, 20261124044153, 20261124044155, 20261124044200, 20261124072331 and 20261124072333. The VibeTutor/VibeMe relocations preserve repository SQL including authorization comments; core and invite-preview differ from recorded bodies only in comments/blank lines (non-comment trimmed line sequences match).

| Previous repo version | Applied Supabase version | Migration |
|---|---|---|
| 20261104120000 | 20261104102630 | vibetutor_core |
| 20261106093000 | 20261106070920 | vibetutor_student_invite_preview |
| 20261114063000 | 20261114035040 | vibetutor_private_teaching_unification |
| 20261119074500 | 20261119085711 | vibeme_public_tutor_avatar |
| 20261119090000 | 20261119111134 | vibeme_character_projection |
| 20261120130000 | 20261121070127 | vibetutor_public_learner_preview |
| 20261121140000 | 20261121072813 | vibetutor_no_guardian_approval |
| 20261121173000 | 20261121081306 | vibetutor_published_imported_requests |
| 20261121200000 | 20261121090520 | vibetutor_consent_gated_public_first_names |

The historical `20261105171240_vibetutor_search_select_student.sql` was missing at its applied path. Recovered exact recorded SQL from the production migration ledger for reconstruction. This is not a new grant or production mutation. Legacy student name search is privacy-sensitive; current permissions and age/consent safeguards require independent review before any expansion.

The unchanged-version VibeTutor performance, imports and private lessons files match non-comment trimmed line sequences of recorded SQL; invitations is byte-identical. Production reports 10 Mini and 15 VibeTutor tables with RLS enabled, including backup tables. The existing Mini safety scanner is service-only. RLS being enabled is not certification of policy correctness.

Path-based tests updated. No user records, feature flags, publication permissions, existing SQL bodies or live migration history changed. Require clean reconstruction, exact-head CI and post-merge integration verification. This is scoped reconciliation, not certification that unrelated repository migration drift is eliminated.
