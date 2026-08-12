# VibeSchool Reader UX Forensic Audit

## Purpose

Permanent UX/product audit for the learner-facing VibeTextbook reader. This complements `READ_FIX_REGISTER.md`: the READ register tracks engineering fixes; this document tracks the experience a learner should receive and the gaps that can remain even when the underlying engineering is correct.

## Current architecture verified from repository evidence

- Canonical VibeTextbook route: `/read/textbook/[publicationId]`.
- Published VibeTextbook access is backed by the hardened reader RPC architecture documented in `READ_FIX_REGISTER.md`.
- Reader progress and Continue Reading are already implemented and documented as verified.
- Study Workspace capabilities include bookmarks, highlights, notes, saved definitions/vocabulary/formulas and Continue Reading.
- Reader appearance controls already support dark/light/paper themes, four font sizes, three line-spacing levels, three reading-width levels, reduced motion, persistence in localStorage, a skip link and keyboard shortcut.
- Teacher assignment and learner-progress integration are already documented as verified.

## Product principle

The reader must behave as a learning environment, not a database-backed document viewer:

`Orient -> Read -> Understand -> Practice -> Receive feedback -> Continue -> Resume -> Complete`

Technical correctness alone is not sufficient. Every reader capability must be judged by whether a learner immediately understands what to do, why it matters, and what happens next.

## Priority UX findings

### UX-P0-001 — First-open orientation

**Risk:** A learner can reach content without immediately understanding the learning objective, expected activity, current position, or next action.

**Target experience:** Show title, grade/subject, concise learning goals, estimated reading/learning time, progress state, and a single dominant `Start Learning` or `Continue` action.

**Acceptance:** A first-time learner can identify what the lesson is about and how to begin within a few seconds without opening a menu.

### UX-P0-002 — Reader orientation and location

**Risk:** Curriculum metadata can exist technically but still fail to orient the learner if presented as dense metadata.

**Target experience:** Keep a compact breadcrumb/context indicator and clear chapter/section position, for example `Mathematics > Numbers > Whole Numbers` plus `Chapter 2 of 8`.

**Acceptance:** The learner can tell where they are and how much remains without leaving the reader.

### UX-P0-003 — Learning rhythm

**Risk:** A long continuous stream of paragraphs feels like a web page rather than a textbook designed for learning.

**Target experience:** Author/render content as a deliberate rhythm: concept -> explanation -> example -> visual -> think -> try -> feedback -> continue.

**Acceptance:** Content blocks have clear pedagogical purpose and the learner is periodically invited to think or act.

### UX-P0-004 — Interaction and feedback loop

**Risk:** Interactive elements are only useful if the learner receives immediate, comprehensible feedback.

**Target experience:** Correct answers explain why they are correct; incorrect answers provide a clue or explanation and a safe retry path rather than simply saying `Wrong`.

**Acceptance:** Every learner action has an understandable result and a clear next action.

### UX-P0-005 — Mobile-first reading

**Risk:** The target environment includes phone-based learners and variable network conditions. A desktop-first reader can become difficult to use even if technically responsive.

**Target experience:** No pinch zoom for ordinary reading, thumb-friendly controls, stable reading width, minimal chrome, predictable chapter navigation and uninterrupted vertical reading.

**Acceptance:** A complete lesson can be read and interacted with comfortably on a small phone screen.

### UX-P1-001 — Make progress meaningful

The existing progress system is valuable, but percentage alone should be supplemented by meaningful statements such as `4 of 6 sections complete` or `2 activities remaining`.

### UX-P1-002 — Keep Workspace secondary

Bookmarks, notes, highlights and saved references are powerful. They should remain available without turning the primary reading surface into a control panel. The default learner path remains `Read -> Understand -> Practice -> Continue`.

### UX-P1-003 — Reading appearance defaults

Current reader controls default to dark mode. This is technically valid and fully user-configurable, but the product should validate the default with actual learner testing. For sustained school-text reading, a comfortable light/paper default may reduce visual fatigue for some learners; dark mode should remain immediately available.

### UX-P1-004 — Accessibility as part of learning UX

The current reader has a strong foundation: skip link, focus-visible states, keyboard operation, reduced motion, font scaling, spacing and width controls. Continue testing actual keyboard traversal, screen-reader semantics, contrast in every theme, and interactive feedback announcements.

### UX-P1-005 — Resume must restore context

Continue Reading should restore not only the chapter but the learner's meaningful reading position/context. Existing progress is documented as verified; future refinement should improve position accuracy beyond coarse open/leave heuristics.

### UX-P2-001 — Offline reading

Already tracked as READ-010 OPEN and intentionally gated behind online-reader maturity. When implemented, cache should support lesson reading during connectivity loss and synchronize progress safely after reconnection.

### UX-P2-002 — AI tutor

Already tracked as READ-011 OPEN. Do not add a generic chatbot before the core reader loop is excellent. When introduced, the tutor should be grounded in the current published lesson and act as a bounded learning assistant.

### UX-P2-003 — Commercial entitlement

Already tracked as READ-009 OPEN. Paid and school-license reading must eventually resolve through server-side entitlement before content access; the UX should make access state understandable rather than exposing technical authorization errors.

## Reader quality gates

A reader release should not be considered complete until all of these are true:

1. A first-time learner knows what to do immediately.
2. A returning learner can resume immediately.
3. Every content type has a deliberate visual treatment.
4. Every interactive learning action has feedback.
5. Progress is persisted and understandable.
6. The interface works comfortably on mobile.
7. Light, dark and paper themes remain readable and accessible.
8. Unpublished or unauthorized content cannot leak through the reader.
9. Weak-network behavior is graceful, with offline support planned/implemented according to release phase.
10. TypeScript, lint and production build gates pass.

## Engineering blocker discovered during this audit

The latest main-branch TypeScript/production gate failed before lint/build because `app/hq/support/page.tsx` contained malformed JSX/parser syntax. The failure was unrelated to the reader but blocked repository-wide TypeScript validation.

### Corrective action

The support page was rewritten with equivalent behavior and valid, readable TSX in commit `755edf850913e9ed6d6a9fc6ff0cc4302e6e62d6`.

### Required verification

The GitHub `TypeScript and Production Build Gate` must pass `npm run typecheck`, then ESLint and the Next.js production build. No reader work should be declared production-ready while this repository-wide gate is red.

## Priority roadmap

### P0 — before learner-facing production sign-off

- First-open orientation
- Clear reader location/progress
- Pedagogical content rhythm
- Complete interaction/feedback loop
- Mobile-first usability
- Repository TypeScript/lint/build green

### P1 — immediately after P0

- Meaningful progress language
- Workspace simplification/polish
- Accessibility verification across themes and interactions
- More precise resume position
- Validate the default reading theme with real learners

### P2 — maturity

- Licensing/school entitlement completion
- Offline reading
- Bounded lesson-grounded AI tutor

## Rule for future work

Do not rebuild the reader merely because a feature is not perfect. First trace the existing implementation, verify the live Supabase authority, test the learner journey, then patch the smallest correct layer. Keep engineering findings in `READ_FIX_REGISTER.md` and UX findings here.
