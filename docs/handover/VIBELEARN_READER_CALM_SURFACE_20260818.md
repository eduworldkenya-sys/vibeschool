# VibeLearn Reader Calm Surface Handover — 2026-08-18

## Scope

Issue #256: enforce a calm, content-first VibeLearn Read experience without deleting governed reader capabilities.

Branch: `fix/vibelearn-reader-calm-surface-20260818`

## Investigation findings

1. The canonical reader still exposes a publication landing experience before the active chapter: large cover, publication metadata, Save, description, permanent search, and full unit list.
2. The reader mounts two independent persistent bottom control systems: `ReaderExcellenceShell` and `ReaderModeController`.
3. Teacher assignment/bookmark actions remain inside the active chapter heading even in default Read mode.
4. Existing architecture is already strong enough to solve the UX problem without replacing canonical entitlement, progress, annotations, listening, study, revision or teacher derivation systems.
5. Production Supabase reader authorities were inspected read-only. No production database mutation is required for this UI remediation.

## Product decision

The default Read experience is now governed by progressive disclosure:

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

## Safety boundaries

- No Supabase DDL/DML changes.
- No entitlement changes.
- No progress/completion changes.
- No annotation model changes.
- No service-worker/offline changes.
- No managed TTS activation.
- No payment changes.
- Vercel must remain intentionally untriggered until exact-head certification is complete and promotion is deliberate.

## Research grounding

Recent digital-reading research continues to identify working-memory/cognitive-load constraints and the distraction risk of supplementary interactive features. The remediation therefore favors contextual controls and one primary reading task rather than feature removal.

## Remaining certification

1. TypeScript.
2. Reader Excellence contract.
3. Production build.
4. Small Android viewport acceptance.
5. Keyboard/focus and reduced-motion regression.
6. Verify Read/Study/Revise transition still exposes the correct governed tools.
7. Verify Contents/Search opens and closes without losing chapter/query state.
8. Verify locked/no-chapter states remain visible.
9. Exact-head CI before merge.
