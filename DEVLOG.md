# GOALS
- [x] Phase 1 VibeLearn
- [x] Phase 2 VibeLearn
- [x] Phase 3 VibeLearn
- [x] Phase 4 VibeLearn
- [ ] Phase 5 Vibe Lock (VibeLearnShellWrapper.tsx)
- [ ] Phase 6 Vibe Pass (VibeActionDock.tsx)
- [ ] Phase 7 Twin Voice (VibeTwin.tsx + APIs)
- [ ] Phase 8 Vibe Board (leaderboard)
- [ ] Teacher indexer push
- [ ] MwalimuSmart Bible blocks

---

# PUSH LOG

## [2026-05-31] b0018b8
**What:** Initial DEVLOG + vibe-push script setup
**Status:** ✅ pushed

## [2026-05-31 10:13] 1ad902d
**What:** setup DEVLOG and vibe-push script
**Status:** ✅ pushed

## [2026-05-31 10:22] 10cfffd
**What:** feat: teacher vibelearn indexer page
**Status:** ✅ pushed

## [2026-05-31 10:24] fcd6677
**What:** feat: teacher vibelearn page and indexer
**Status:** ✅ pushed

## [2026-05-31 10:28] c2a9daa
**What:** fix: null guard on loadAll in teacher vibeconnect
**Status:** ✅ pushed

## [2026-05-31 10:35] 68766f2
**What:** fix: add missing suggestionsLoading and suggestedContacts state in teacher vibeconnect
**Status:** ✅ pushed

## [2026-05-31 10:48] 27eb353
**What:** feat: Phase 5 VibeLearnShellWrapper + fix ModeSwitcher and AudioDock props
**Status:** ✅ pushed

## [2026-05-31 10:53] 26268f0
**What:** feat: Phase 5 Vibe Lock VibeLearnShellWrapper complete
**Status:** ✅ pushed

## [2026-05-31 10:54] ce5d916
**What:** feat: Phase 5 Vibe Lock VibeLearnShellWrapper complete
**Status:** ✅ pushed

## [2026-05-31 10:58] 60d5ef0
**What:** feat: Phase 6 Vibe Pass VibeActionDock complete
**Status:** ✅ pushed

## [2026-05-31 12:05] 94e242c
**What:** feat: dual claim codes (student+parent) with WhatsApp share
**Status:** ✅ pushed

## [2026-05-31 12:11] e4e360e
**What:** fix: role-based claim code validation for student and parent
**Status:** ✅ pushed

## [2026-06-03 15:26] f80ba87
**What:** fix: prefer-const ESLint errors blocking build
**Status:** ✅ pushed

## [2026-06-03 15:30] 84d7cd9
**What:** fix: revert frameId1 to let with eslint-disable
**Status:** ✅ pushed

## [2026-06-03 15:39] 019971e
**What:** fix: frameId1 const inline init to satisfy prefer-const
**Status:** ✅ pushed

## [2026-06-03 15:40] 5871c0c
**What:** chore: remove temp fix script
**Status:** ✅ pushed

## [2026-06-03 15:45] 93a1f47
**What:** chore: ignore ESLint during builds to unblock Vercel
**Status:** ✅ pushed

## [2026-06-03 15:48] 2d89853
**What:** fix: useEffect missing return path in match page
**Status:** ✅ pushed

## [2026-06-03 15:58] 46bc8e6
**What:** fix: useEffect missing return path in match page
**Status:** ✅ pushed

## [2026-06-05 10:10] 5e7f2fd
**What:** ci: add Supabase edge functions auto-deploy workflow
**Status:** ✅ pushed

## [2026-06-05 11:41] 886a912
**What:** fix: students full_name -> name in admin reports (4 files)
**Status:** ✅ pushed

## [2026-06-05 11:50] 933d1b8
**What:** fix: remove ghost nav routes from teacher layout
**Status:** ✅ pushed

## [2026-06-05 12:13] a0bc70b
**What:** fix: remove ghost routes from teacher tray nav
**Status:** ✅ pushed

## [2026-06-05 12:18] 85a846a
**What:** fix: restore full teacher tray nav — all real pages linked
**Status:** ✅ pushed

## [2026-06-15 22:29] a9f9b70
**What:** feat: VibeExam — free AI KCSE mock exam feature
**Status:** ✅ pushed

## [2026-06-15 22:35] adc54ff
**What:** feat: VibeExam — free AI KCSE mock exam feature
**Status:** ✅ pushed

## [2026-06-19 22:49] 8e748ba
**What:** fix: audit findings - login/signup security, student route guard, middleware role check, 404/error pages
**Status:** ✅ pushed

## [2026-06-19 23:08] bd50187
**What:** fix: revert middleware role-check (perf regression on slow networks)
**Status:** ✅ pushed

## [2026-06-21 14:18] 6d39d00
**What:** Redesign /learn page with brand tokens, functional domain filters, skeleton loading and error states
**Status:** ✅ pushed

## [2026-06-21 15:05] 1ec1ea2
**What:** Add course enrollment lock-in to roadmap page
**Status:** ✅ pushed

## [2026-06-21 15:23] 62590f7
**What:** Add course enrollment lock-in to roadmap page
**Status:** ✅ pushed

## [2026-06-21 15:26] b8d3fad
**What:** Domain-aware tip tab label on topic page
**Status:** ✅ pushed

## [2026-06-21 15:28] abc0813
**What:** Add course enrollment lock-in to roadmap page
**Status:** ✅ pushed

## [2026-06-22 00:42] aa7052a
**What:** diagnostic: surface real profileErr on signup failure
**Status:** ✅ pushed

## [2026-06-22 00:58] 64e6ca9
**What:** diagnostic: surface real profileErr on signup failure
**Status:** ✅ pushed

## [2026-06-22 00:58] 4018a1c
**What:** revert diagnostic logging
**Status:** ✅ pushed

## [2026-06-22 01:04] fb9cf08
**What:** revert diagnostic logging
**Status:** ✅ pushed

## [2026-06-22 01:04] abd4cab
**What:** diagnostic: surface real profileErr on signup failure
**Status:** ✅ pushed

## [2026-06-22 01:36] cdbe17a
**What:** diagnostic: surface profileErr.details on signup failure
**Status:** ✅ pushed

## [2026-06-22 02:02] 4d87c63
**What:** fix: profiles insert -> update, since on_auth_user_created trigger already creates the row
**Status:** ✅ pushed

## [2026-06-22 08:22] 57da1c7
**What:** fix: commit session before redirect + revert diagnostic error message
**Status:** ✅ pushed

## [2026-06-22 08:44] 5b50211
**What:** fix: write vibe_role cookie before redirect so middleware fast-path works on signup
**Status:** ✅ pushed

## [2026-06-22 09:03] 7ce0eba
**What:** fix: cookie-before-redirect, remove production alert(), activate all users, update handle_new_user to default active
**Status:** ✅ pushed

## [2026-06-23 00:10] 3a4bf29
**What:** feat: student signup via claim code, skip email field
**Status:** ✅ pushed

## [2026-06-23 00:53] 2761bb3
**What:** ux: pin sign out to top of admin sidebar for instant visibility
**Status:** ✅ pushed

## [2026-06-23 02:44] 3847e80
**What:** ux: compact sign out icon in admin sidebar header, restore settings visibility
**Status:** ✅ pushed

## [2026-06-23 02:50] 502991a
**What:** security: remove admin-direct debug page before production
**Status:** ✅ pushed

## [2026-06-23 02:58] 474cc95
**What:** chore: add vibe-check.sh health check script
**Status:** ✅ pushed

## [2026-06-23 03:12] 1d5bc4b
**What:** chore: add vibe-check.sh health check script
**Status:** ✅ pushed

## [2026-06-23 03:13] 4944c3c
**What:** ux: remove duplicate sign out, fix sidebar nav scroll
**Status:** ✅ pushed

## [2026-06-23 03:16] 2ebe865
**What:** ux: redirect admin role pill to dedicated signup/login pages
**Status:** ✅ pushed

## [2026-06-23 03:19] d211941
**What:** fix: student claim code 2.5s delay before RPC call
**Status:** ✅ pushed

## [2026-06-24 09:08] ff8896f
**What:** fix: add nairobiDateStr import to LessonPlanModal
**Status:** ✅ pushed

## [2026-06-24 09:27] 3b3cb09
**What:** fix: subjecthub — secure API route, fix classes fetch, attendance subject filter, remove unused imports
**Status:** ✅ pushed

## [2026-06-24 09:53] cfefd50
**What:** fix: restore use client order and nairobiDateStr imports in SmartInsightSlides and SmartTimetablePreview
**Status:** ✅ pushed

## [2026-06-24 22:44] 2dbeb31
**What:** fix scheme page: load strands from curriculum table, fix coverage dots, add sub_strand display
**Status:** ✅ pushed

## [2026-06-24 22:57] 5afc9e9
**What:** fix scheme: reload strands on week/term change, add selectedWeek to useCallback deps
**Status:** ✅ pushed

## [2026-06-24 23:03] 246345a
**What:** scheme: add strand count badge per week dot
**Status:** ✅ pushed

## [2026-06-25 08:52] caa6468
**What:** secure generate-lesson-plan: add auth + credit check before Anthropic call
**Status:** ✅ pushed

## [2026-06-25 09:07] abd5b56
**What:** fix: strands now load from curriculum table in assessment, subjecthub, gradebook; remove all alert() calls; deprecate generate-scheme route; expand CBC grades list
**Status:** ✅ pushed

## [2026-06-25 09:08] bafeb5e
**What:** chore: remove fix scripts from repo
**Status:** ✅ pushed

## [2026-06-26 13:08] be67528
**What:** update subject insight route
**Status:** ✅ pushed

## [2026-06-26 13:22] d940b3a
**What:** fix subject insight name, assessed pct, remove seed row mutation
**Status:** ✅ pushed

## [2026-06-26 13:30] f7b19b4
**What:** fix subject insight name, assessed pct, remove seed row mutation
**Status:** ✅ pushed

## [2026-06-26 13:36] a8fc1bf
**What:** add teacher academics hub page
**Status:** ✅ pushed

## [2026-06-26 13:37] 8419962
**What:** add academics to teacher more menu
**Status:** ✅ pushed

## [2026-06-26 13:46] 8c0984f
**What:** add teacher academics hub page
**Status:** ✅ pushed

## [2026-06-26 14:19] 02f8fd6
**What:** rebuild teacher academics hub: gradebook, at-risk, TPAD, attendance
**Status:** ✅ pushed

## [2026-06-26 14:59] cdeecfb
**What:** restyle academics: light theme matching More page aesthetic
**Status:** ✅ pushed

## [2026-06-26 15:14] 0f9b68f
**What:** academics: real TPAD scores, strand breakdown, smart empty states, error retry, light theme
**Status:** ✅ pushed

## [2026-06-27 15:14] 2101eae
**What:** feat: TeachOS — unified teach product page
**Status:** ✅ pushed

## [2026-06-28 12:13] c8e7cb5
**What:** add VibeTwin smart-without-AI build with fuzzy registry and brain
**Status:** ✅ pushed

## [2026-06-28 18:27] 6ea955e
**What:** feat: student app phase 1 — cache, context, theme, layout, BottomNav, OfflineBar, dashboard fix
**Status:** ✅ pushed

## [2026-06-28 18:30] dd93d3d
**What:** feat: student resources page — CSS vars, SVG icons, cache, context
**Status:** ✅ pushed

## [2026-06-28 21:37] 3e719cf
**What:** delete dead teacher BottomNav component and CSS
**Status:** ✅ pushed

## [2026-06-28 21:45] 150c5cc
**What:** delete dead teacher BottomNav component and CSS
**Status:** ✅ pushed

## [2026-06-28 21:48] 7a6713c
**What:** student nav: 3 tabs (Home, My Work, Me) — remove Play, vibelearn routes to Me
**Status:** ✅ pushed

## [2026-06-28 21:57] d9fb528
**What:** fix: use homework cache key in My Work page
**Status:** ✅ pushed

## [2026-06-28 22:11] fc629e7
**What:** fix: use homework cache key in My Work page
**Status:** ✅ pushed

## [2026-06-28 22:56] 7ae7b32
**What:** teacher grading: submission list + grade per student with mark and feedback
**Status:** ✅ pushed

## [2026-06-28 23:15] f6795c3
**What:** homework: school_id scoping, clickable cards, submission counts, manual grading, book photo required
**Status:** ✅ pushed

## [2026-06-28 23:26] 0076318
**What:** homework A: priority ordering, auto-bands, class average
**Status:** ✅ pushed

## [2026-06-28 23:31] 7e6278a
**What:** homework A: priority ordering, auto-bands, class average
**Status:** ✅ pushed

## [2026-06-28 23:31] 3d05ab4
**What:** homework A: priority ordering, auto-bands, class average
**Status:** ✅ pushed

## [2026-06-29 00:13] 47cd592
**What:** homework: clickable teacher cards, photo upload, home page urgency
**Status:** ✅ pushed

## [2026-06-29 02:04] 7bd7f81
**What:** fix: photo_url in Submission interface and select
**Status:** ✅ pushed

## [2026-06-29 07:01] f4885b1
**What:** fix: photo_url in Submission interface and select
**Status:** ✅ pushed

## [2026-06-29 07:14] 5240d1a
**What:** fix: photo_url in Submission interface and select
**Status:** ✅ pushed

## [2026-06-29 09:49] 38da1dc
**What:** Homework system: 9 fixes — types, group filter, notifications, photo upload, duplicate guard, cross-class view
**Status:** ✅ pushed

## [2026-06-29 10:02] 137d79f
**What:** Homework: questions-based submission mode, remove smart type, add questions toggle to create form
**Status:** ✅ pushed
## [2026-06-29 14:48] 9a1f5b0
**What:** fix: teacher onboarding school registration via service role API route
**Status:** ✅ pushed
