# Live teaching migration ledger parity — 28 November 2026

Refs #2170. Source base d1a588a0261a3caa847612dbf4c6660d1fa58c90. Production project yauqsxggtuxuykcbrtzf read-only comparison: each exact original repository SQL string equals the applied ledger statements[1], not just the recorded migration name. The migration blobs are moved unchanged to the recorded version and name. Do not replay them or manually edit ledger rows.

| Original filename | Recorded filename | Git blob |
| --- | --- | --- |
| 20261124150000_live_workbook.sql | 20261127152007_20261124150000_live_workbook.sql | 530b0d2665b7e93d431873337f9b9c1d6835b847 |
| 20261124151000_live_classroom_phase.sql | 20261127152023_20261124151000_live_classroom_phase.sql | 46afac7cf7f69ef49cf813c3e41e31184a3885cc |
| 20261124152000_live_stage_ink.sql | 20261127152029_20261124152000_live_stage_ink.sql | 9b5a4dea91a14520c4cba1ee972c08f2ca6fff40 |
| 20261124215629_live_teacher_material_versions.sql | 20261127152035_20261124215629_live_teacher_material_versions.sql | 7dea7b17534c6b71808e8e694849bcd660d56414 |
| 20261124220843_live_studio_private_files.sql | 20261127152039_20261124220843_live_studio_private_files.sql | 765f674742637a8d7c7cd070eb6a94c4ea399483 |
| 20261125000100_live_slide_study.sql | 20261127152045_20261125000100_live_slide_study.sql | 034314e5c814f53f48855830b7becf86def56a7e |
| 20261125000200_live_breakout_discussions.sql | 20261127152049_20261125000200_live_breakout_discussions.sql | f9b20f904f1afec9e411f8fee935d3d5b6853c10 |
| 20261127173000_live_classroom_slide_update.sql | 20261127193512_20261127173000_live_classroom_slide_update.sql | ec63a88a5a597321093138fa3e5832acdcf7f029 |

No exact ledger statement match was found for 20261112150000_unified_school_tuition_schedule.sql, 20261128042000_lesson_plan_presentation.sql, or 20261128070000_live_tuition_booking.sql. These are not approved for replay; inspect actual objects, dependency order, authorization and collision preflight separately. No production changes performed. Clean reconstruction, fixture updates, exact-head CI and independent assurance remain gates. Local checkout is blocked by DNS; evidence was obtained from the repository and production catalog/ledger connectors.
