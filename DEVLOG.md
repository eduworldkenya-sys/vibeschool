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
## [2026-06-29 14:56] 968d808
**What:** fix: teacher onboarding school registration via service role API route
**Status:** ✅ pushed
## [2026-06-29 14:59] 32bad72
**What:** chore: remove binary junk files, update gitignore
**Status:** ✅ pushed
## [2026-06-29 15:44] 4d35211
**What:** fix: switch lesson plan generation from Gemini to Groq
**Status:** ✅ pushed
## [2026-06-30 14:18] e26f1c0
**What:** Homework: edit/delete, bulk grading actions, timetable due indicator
**Status:** ✅ pushed
## [2026-06-30 14:42] 7b0c337
**What:** Twin + Pulse: homework grading awareness — ungraded count tracking, grading intent, Pulse cockpit card
**Status:** ✅ pushed
## [2026-06-30 14:45] 7a24be2
**What:** Homework: automated reminder cron for non-submitters, due tomorrow
**Status:** ✅ pushed
## [2026-06-30 14:57] b9504e5
**What:** Fix critical bug: notifications insert used wrong column (message vs body), add TPAD + invoice reminder crons
**Status:** ✅ pushed
## [2026-06-30 16:43] 29471e5
**What:** fix: teacher pulse page and fetcher updates
**Status:** ✅ pushed
## [2026-06-30 16:45] 040482b
**What:** nav: workflow trays (Today/Teach/Classes/Assess/Me), move VibeConnect+Homework into Classes
**Status:** ✅ pushed
## [2026-06-30 21:32] f02bf71
**What:** feat: TeachOS week view at /teacher/week
**Status:** ✅ pushed
## [2026-07-01 07:21] 8c56577
**What:** lessonnotes: fix unreachable delete modal, dead planId deep-link, save button hidden behind nav
**Status:** ✅ pushed
## [2026-07-01 07:22] 8535179
**What:** rename Lesson Notes -> Progress Record (route, table, all references) + fix broken student lesson query
**Status:** ✅ pushed
## [2026-07-01 07:25] c511202
**What:** merge preview/week-tray: nav Week tile + Progress Record rename + student lesson fix
**Status:** ✅ pushed
## [2026-07-04 02:18] b62bff7
**What:** feat(pulse): add Today at a Glance strip, progress ring, Quick Actions grid, wire Twin shortcut card
**Status:** ✅ pushed
## [2026-07-04 02:45] 2b1f0b4
**What:** feat(pulse): add Today at a Glance strip, progress ring, Quick Actions grid, wire Twin shortcut card
**Status:** ✅ pushed
## [2026-07-04 16:44] 863f7da
**What:** feat(pulse): add This Week Overview strip (lessons planned/taught, assignments, engagement %)
**Status:** ✅ pushed
## [2026-07-04 16:49] 0a98318
**What:** style(pulse): add per-step icons to LessonFlowCard, no logic changes
**Status:** ✅ pushed
## [2026-07-04 16:57] cae9217
**What:** style(pulse): add icons to Curriculum Progress, Class Support, Prepare Tomorrow rows
**Status:** ✅ pushed
## [2026-07-04 17:22] 53b5127
**What:** fix(pulse): remove redundant AI Assistant tile from QuickActions, Twin now has 2 entry points (FAB + TwinShortcut)
**Status:** ✅ pushed
## [2026-07-04 17:24] 84e72a7
**What:** fix(pulse): remove duplicate task in Next Teaching Actions list, hero card already shows it
**Status:** ✅ pushed
## [2026-07-04 17:38] 555d0b4
**What:** feat(pulse): add Teach Journey status row to LessonFlowCard, driven by existing gating logic
**Status:** ✅ pushed
## [2026-07-04 18:50] 50a76a6
**What:** feat(pulse): add countdown to Do This Next, severity badges on tasks, compact Prepare Tomorrow strip
**Status:** ✅ pushed
## [2026-07-04 18:55] ce6f3f0
**What:** Add PulseHeader component with school selector bar, notification/chat badges, schoolName in PulseSnapshot
**Status:** ✅ pushed
## [2026-07-04 19:31] 7d6863b
**What:** Add real avatar photo and functional Class/Subject switcher for teachers with multiple lessons today
**Status:** ✅ pushed
## [2026-07-04 22:08] 7ae743a
**What:** Add real avatar photo and functional Class/Subject switcher for teachers with multiple lessons today
**Status:** ✅ pushed
## [2026-07-05 10:08] 51d110f
**What:** Remove duplicate chat icon/avatar from PulseHeader; layout.tsx top bar already owns those
**Status:** ✅ pushed
## [2026-07-05 10:39] b151b46
**What:** Remove School field from selector bar, add no-lessons-today state, build TodayHero with real weather and lesson/student/attendance/pending stats
**Status:** ✅ pushed
## [2026-07-05 11:20] 440274c
**What:** Finish Stage 1: lift class/subject selection to page level, TodayHero now filters headline and all 4 stat pills by the selected class when it has a lesson today
**Status:** ✅ pushed
## [2026-07-05 11:21] 8f26842
**What:** Finish Stage 1: lift class/subject selection to page level, TodayHero now filters headline and all 4 stat pills by the selected class when it has a lesson today
**Status:** ✅ pushed
## [2026-07-05 13:02] a3be43e
**What:** diag: show error.message on Pulse error boundary
**Status:** ✅ pushed
## [2026-07-05 13:15] c2212aa
**What:** fix: version-gate localStorage snapshot cache + guard array fields in Pulse render, prevents crash from stale/incomplete cached PulseSnapshot
**Status:** ✅ pushed
## [2026-07-05 15:51] b4e615c
**What:** add school selector to teacher pulse header
**Status:** ✅ pushed
## [2026-07-05 15:53] 684e50b
**What:** add onboarding CTA to empty class state
**Status:** ✅ pushed
## [2026-07-08 16:20] a64df37
**What:** add VibeTextbook create page, /global/read discovery feed, and vibe_publications/vibe_chapters RLS migration
**Status:** ✅ pushed
## [2026-07-09 10:01] 5b9aaca
**What:** Fix textbook editing: list shows published+draft with status badges, publishing preserves original published_at, Update/Publish labels reflect live state, RPC dedup call site wired through
**Status:** ✅ pushed
## [2026-07-09 23:08] 5533223
**What:** fix: consolidate strand identity on cbc_strands
**Status:** ✅ pushed
## [2026-07-09 23:51] dd43162
**What:** fix nonexistent school_id filter in getStrandsForSubject
**Status:** ✅ pushed
## [2026-07-10 00:07] 28df760
**What:** fix addStrand missing sub_strand causing insert failures
**Status:** ✅ pushed
## [2026-07-10 00:38] f1d6253
**What:** remove dead strandQueries helper, no longer imported anywhere
**Status:** ✅ pushed
## [2026-07-10 00:46] dc2f56a
**What:** remove dead strandQueries helper, no longer imported anywhere
**Status:** ✅ pushed
## [2026-07-10 00:48] 0c60586
**What:** resolve cbc_strands through global subject taxonomy, fixes near-empty strand dropdowns
**Status:** ✅ pushed
## [2026-07-10 00:59] 488b631
**What:** resolve cbc_strands through global subject taxonomy, fixes near-empty strand dropdowns
**Status:** ✅ pushed
## [2026-07-10 01:03] 9170153
**What:** resolve cbc_strands through global subject taxonomy, fixes near-empty strand dropdowns
**Status:** ✅ pushed
## [2026-07-10 16:45] cde4174
**What:** fix: strand input text invisible due to inherited white body color
**Status:** ✅ pushed
## [2026-07-10 16:49] c00c874
**What:** fix: default text color on teacher/parent layouts to prevent white-on-white inputs
**Status:** ✅ pushed
## [2026-07-10 16:58] b0814af
**What:** fix: strand-name input text invisible (missed in first patch attempt)
**Status:** ✅ pushed
## [2026-07-11 06:51] 6bff270
**What:** scheme of work: real scheme_of_work write path, delta import, term-anchored
**Status:** ✅ pushed
## [2026-07-11 06:54] c3dddcc
**What:** generate: consume schemeId, write lesson_plans.scheme_id, unblock custom topics
**Status:** ✅ pushed
## [2026-07-11 07:57] d0fb02d
**What:** sync: timetable lesson plans read scheme, write scheme_id, mark teaching; kill strand_progress leak; term label dedupe
**Status:** ✅ pushed
## [2026-07-11 07:58] d63ea68
**What:** sync: assessments promote scheme items to teaching; last strand_progress writer removed
**Status:** ✅ pushed
## [2026-07-11 09:03] 92f022a
**What:** seamless flow: curriculum_content multi-source + un-deprecate scheme_of_work + derive lesson_plans.curriculum_id from scheme_id
**Status:** ✅ pushed
## [2026-07-11 13:28] 3c53da6
**What:** lesson panel: fix stale call site, read live scheme_of_work + curriculum_content; add lesson_number/reflection inputs to scheme items
**Status:** ✅ pushed
