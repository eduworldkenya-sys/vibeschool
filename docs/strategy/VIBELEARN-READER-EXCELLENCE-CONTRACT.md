# VibeLearn Reader Excellence Contract

## Product position

VibeLearn Read is a primary VibeSchool product surface and a core commercial experience. The reader must be good enough that a learner prefers to read, listen, understand, study and remember content in VibeSchool even when comparable content exists elsewhere.

## North-star journey

`open → orient → read/listen → understand → continue → remember`

## Binding rule

**Content is the hero.**

Every persistent control must justify taking attention away from the learning material. Secondary learning, teacher and commerce tools use progressive disclosure instead of competing with reading.

## Reader invariants

1. One reader has one appearance/comfort authority. Duplicate theme or typography controllers are not allowed.
2. Reading preferences persist locally without changing publication content.
3. The default reader surface remains calm: one compact continuity header, one comfort/listen control surface and one secondary Tools entry point.
4. Chapter navigation is not learning evidence. Changing chapter cannot manufacture completion.
5. Completion at or above 90% requires final structured-block position evidence.
6. Resume restores the exact saved block when valid evidence exists.
7. Reading progress is monotonic unless an explicit governed reset is requested.
8. The same canonical chapter-read authority governs free, preview, author and paid-entitlement access.
9. Text-to-speech quality claims must match the actual provider. Browser/device voices are a fallback, not a guaranteed neural voice.
10. Selected text is acted on in context. Highlight, note and listen actions should not require copying text into another workspace first.
11. Images and diagrams must be inspectable on small screens through tap-to-zoom.
12. Search, Study, Learn, Test and teacher-derivation capabilities remain available but must not float over reading independently.
13. Missing evidence remains missing; progress, completion, mastery and assessment evidence are distinct concepts.
14. Reduced-motion and accessible focus states are required reader behavior.
15. Reader changes must remain safe on affordable mobile devices and constrained networks.

## Implemented waves

### Wave 1 — comfort, focus and listen

- Paper, Light, Dark and High Contrast themes
- font-size, line-spacing and reading-width controls
- persistent preferences
- distraction-free Focus mode
- Web Speech API fallback with best-available English voice ranking
- voice choice, rate, pause/resume/stop
- current-passage highlighting and follow
- mobile-safe controls and reduced-motion support

### Wave 2 — continuity and truthful progress

- compact sticky current-unit header
- progress and approximate reading time remaining
- previous / next and Contents access
- exact-block authenticated resume
- measured structured-block progress persistence
- server rejection of navigation-only completion
- canonical paid/free/author chapter-read authority parity

### Wave 3 — contextual study and chrome consolidation

- selected passage → Highlight / Note / Listen directly in context
- study items reuse the existing governed study-workspace RPC
- diagrams/images tap to full-screen zoom
- duplicate legacy appearance controller removed from the mounted reader
- Study / Learn / Test / teacher launchers consolidated behind one Tools drawer

## Remaining program

1. Persistent rendered highlights and note markers on the passage itself.
2. Vocabulary/pronunciation/definition interaction with English↔Kiswahili explanation where evidence/provider policy permits.
3. Explicit Read / Study / Revise modes over the same content, without creating separate reader implementations.
4. Search UX refinement with heading/concept/formula result grouping.
5. Managed premium neural TTS evaluation with sentence timing, durable audio position and optional governed audio caching.
6. Offline/reconnect continuity and constrained-network performance certification.
7. Mobile browser/accessibility acceptance across representative low-end Android dimensions.
8. Reader → purchase → entitlement → continue-reading E2E certification for the first controlled Learning Product.

## Promotion boundary

Keep reader work isolated from unrelated curriculum-ingestion or publishing-authority work. Merge only after the exact reader head passes TypeScript/production build, migration/security, clean rebuild and relevant commerce/auth gates. Production migration application and commercial activation remain separate controlled operations.
