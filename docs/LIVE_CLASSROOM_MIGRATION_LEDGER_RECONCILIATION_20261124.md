# Live Classroom production ledger reconciliation — 2026-11-24

Production Supabase project `yauqsxggtuxuykcbrtzf`: these eleven original repository SQL blobs were compared directly against their applied ledger `statements[1]` using exact PostgreSQL string equality; every comparison was true with zero length difference. Relocate the identical blobs to the actual recorded versions; never replay these migrations or edit the production migration ledger.

| Former GitHub filename | Applied Supabase filename | Identical Git blob |
|---|---|---|
| `20261118075221_live_classroom_pilot.sql` | `20261119052713_live_classroom_pilot.sql` | `f739d1a642a4defeb1f84c0c6d78335d52dbbe2b` |
| `20261120104500_live_lesson_history_candidate.sql` | `20261120132754_live_lesson_history_candidate.sql` | `4cf4da93d1b713eb3d2c04b1d5ac78df6cc66264` |
| `20261120104501_live_learner_tools_candidate.sql` | `20261120132806_live_learner_tools_candidate.sql` | `e563da26a848dc395eaa0622dc0d719fd68b759d` |
| `20261120104502_live_teacher_workspace.sql` | `20261120132817_live_teacher_workspace.sql` | `62cff116f10f43e18f30147eb73edc6743df6e3c` |
| `20261121084500_live_past_classes.sql` | `20261121051052_live_past_classes_20261121.sql` | `8e1f63d71257d0b6f1606595d8ddebdf49709251` |
| `20261121102000_live_private_conversations.sql` | `20261121060238_live_private_conversations_20261121.sql` | `b6060703c065f8e1cde276ac74db9c7d185a140a` |
| `20261121121000_live_private_realtime_invalidation.sql` | `20261121063856_live_private_realtime_20261121.sql` | `e9f7a1fe1ece643691e6f1d332bf9ee0c935b084` |
| `20261121130000_live_private_session_assets.sql` | `20261121073938_live_private_session_assets.sql` | `88f13cce74df0356e28a03f3c84d8e9c514eb7ff` |
| `20261123130000_live_public_student_admission.sql` | `20261123094939_live_public_student_admission.sql` | `8b1df10bd7ca993468f1b32c28918b8322c173db` |
| `20261121153000_live_presenter_scroll_follow.sql` | `20261124143438_live_presenter_scroll_follow.sql` | `557feba63652a0578e9c2eefe202dafa314458ad` |
| `20261124070000_live_plan_history_read.sql` | `20261124143449_live_plan_history_read.sql` | `7532f6b37719d554fc2d47a49f40c13ff4de8416` |

The moderated-chat and lesson-evidence migrations already have matching version numbers. Presenter scroll and plan history were previously absent in production; both exact main SQL bodies were applied with the migration API after checking current prerequisites and patch anchors. Read-only checks confirmed all three presenter columns, the presenter action in the canonical RPC, and authenticated-only plan history execution. Test fixtures are updated to the recorded names and presenter/admission execution order. Independent study remains a separate migration candidate in PR #2086; it has not been activated. No production records were deleted or ledger rows manually rewritten. Full clean reconstruction and CI remain release gates.
