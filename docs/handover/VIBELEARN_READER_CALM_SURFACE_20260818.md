# VibeLearn Reader Calm Surface Handover — 2026-08-18

## Scope

Issue #256: enforce a calm, content-first VibeLearn Read experience without deleting governed reader capabilities.

Branch: `fix/vibelearn-reader-calm-surface-20260818`
PR: #258

## Investigation findings

1. The canonical reader still exposed a publication landing experience before the active chapter: large cover, publication metadata, Save, description, permanent search, and full unit list.
2. The reader mounted two independent persistent bottom control systems: `ReaderExcellenceShell` and `ReaderModeController`.
3. Teacher assignment/bookmark actions remained inside the active chapter heading even in default Read mode.
4. Existing architecture was already strong enough to solve the UX problem without replacing canonical entitlement, progress, annotations, listening, study, revision or teacher derivation systems.
5. Production Supabase reader authorities were inspected read-only. No production database mutation is required for this UI remediation.

## Product decision

The default Read experience is governed by progressive disclosure:

- content is the hero;
- old publication/search chrome is suppressed while an active readable unit is open;
- Contents/Search is opened on demand;
- Read/Study/Revise becomes one compact contextual mode control rather than a second persistent bottom bar;
- appearance remains behind `Aa`;
- advanced voice controls remain behind Listen;
- the redundant `Clear` control is suppressed from the persistent reader bar;
- teacher assignment/bookmark controls are suppressed in default Read mode and remain available outside the calm reading state;
- underlying reader authority components are preserved, not duplicated.

## Implementation

New component: `components/read/ReaderCalmSurface.tsx`.

It is mounted by the canonical textbook layout and provides a small navigation layer over the existing reader. It deliberately uses the existing `ReaderModeController` as the mode authority and the existing chapter/search DOM as Contents authority instead of creating parallel state or data fetching.

The calm header synchronizes from the canonical active chapter and explicitly listens for `vibe:reader-chapter` so chapter transitions update the visible title and close stale Contents state.

## Permanent regression contract

`scripts/test-reader-excellence-contract.py` now certifies the calm-surface invariants in addition to the pre-existing entitlement, reconnect, annotation, glossary, accessibility, search, listening and commerce boundaries.

The contract requires:

- the calm surface to remain mounted by the canonical layout;
- legacy non-content reader chrome to be progressively disclosed;
- the duplicate persistent mode switcher to stay hidden under the calm surface;
- the redundant persistent `Clear` action to remain suppressed;
- teacher assignment/bookmark actions to remain absent from default Read chrome;
- Contents and Read/Study/Revise affordances to remain available;
- canonical chapter-change synchronization to remain wired.

## Safety boundaries

- No Supabase DDL/DML changes.
- No entitlement changes.
- No progress/completion changes.
- No annotation model changes.
- No service-worker/offline changes.
- No managed TTS activation.
- No payment changes.
- Vercel has not been intentionally invoked by this work and must remain untriggered until promotion is deliberate.
- A Netlify deploy-preview status may be created automatically by repository integration; it is not a Vercel action and is not treated as production authority.

## Research grounding

Current digital-reading research continues to identify working-memory/cognitive-load constraints and the distraction risk of supplementary interactive features. The remediation therefore favors contextual controls and one primary reading task rather than feature removal.

## Certification log

- Initial implementation head `9d80da67bd54bd8a88383715828803333ee5ecb4`: Reader Excellence Contract passed.
- The initial contract was then judged insufficient because it did not mechanically assert the new calm surface itself.
- The contract has therefore been strengthened before promotion rather than relying on a green legacy gate.
- Production Supabase remained read-only throughout this remediation.

## Remaining promotion gates

1. Exact-head Reader Excellence Contract after the strengthened contract lands.
2. Exact-head TypeScript and production build.
3. Small-screen/mobile behavior evidence available in the current execution environment.
4. Keyboard/focus and reduced-motion regression.
5. Verify Read/Study/Revise transition still exposes the correct governed tools.
6. Verify Contents/Search opens and closes without losing canonical chapter/query state.
7. Verify locked/no-chapter states remain visible.
8. Reconcile with latest `main` if it moves before merge.
9. Merge only from the exact certified head.
