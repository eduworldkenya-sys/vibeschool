# VibeLearn Reader Excellence Contract

## Product position

VibeLearn Read is a primary VibeSchool product surface and a core commercial experience. The reader must be good enough that a learner prefers to read, listen, understand, study and remember content in VibeSchool even when comparable content exists elsewhere.

## North-star journey

`open → orient → read/listen → understand → continue → remember`

## Binding rule

**Content is the hero.** Every persistent control must justify taking attention away from the learning material. Secondary learning, teacher and commerce tools use progressive disclosure instead of competing with reading.

## Reader invariants

1. One reader has one appearance/comfort authority. Duplicate theme or typography controllers are not allowed.
2. Reading preferences persist locally without changing publication content.
3. The default Read mode is calm; study and revision controls appear only after the learner chooses those modes.
4. Chapter navigation is not learning evidence. Changing chapter cannot manufacture completion.
5. Completion at or above 90% requires final structured-block position evidence.
6. Resume restores the exact saved block when valid evidence exists.
7. Reading progress is monotonic unless an explicit governed reset is requested.
8. The same canonical chapter-read authority governs free, preview, author and paid-entitlement access.
9. Browser/device speech is a fallback, not a guaranteed neural voice.
10. Selected text is acted on in context in Study mode; learners should not copy text into another workspace first.
11. Images and diagrams must be inspectable on small screens through tap-to-zoom.
12. Search, Study, Learn, Test and teacher derivation remain available without independently floating over Read mode.
13. Missing evidence remains missing; progress, completion, mastery and assessment evidence are distinct concepts.
14. Reduced-motion and accessible focus states are required.
15. Reader changes must remain safe on affordable mobile devices and constrained networks.
16. Read, Study and Revise are modes over one canonical content/entitlement surface, not separate readers.

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
- selected passage → Highlight / Note directly in context
- selected short term → Vocabulary + Pronounce
- study items reuse the existing governed study-workspace RPC
- diagrams/images tap to full-screen zoom
- duplicate legacy appearance controller removed
- secondary launchers consolidated behind contextual tool access

### Wave 4 — explicit learning modes
- Read / Study / Revise switcher over the same textbook
- Read is the default and hides study/revision chrome
- Study exposes selection actions and study/teacher tools
- Revise exposes guided learning and grounded self-test tools
- mode persists on-device and does not change entitlement or content truth

## Remaining program

1. Persistent rendered highlights and note markers on the passage itself. This needs a stable passage anchor contract; text-only matching is not acceptable for durable annotations.
2. Definition interaction and optional English↔Kiswahili explanation with an evidence/provider policy.
3. Search UX refinement with heading/concept/formula grouping.
4. Managed premium neural TTS evaluation with sentence timing, durable audio position and optional governed audio caching.
5. Offline/reconnect continuity and constrained-network performance certification.
6. Mobile browser/accessibility acceptance across representative low-end Android dimensions.
7. Reader → purchase → entitlement → continue-reading E2E certification for the first controlled Learning Product.

## Promotion boundary

Keep reader work isolated from unrelated curriculum-ingestion or publishing-authority work. Merge only after the exact reader head passes TypeScript/production build, migration/security, clean rebuild and relevant commerce/auth gates. Production migration application and commercial activation remain separate controlled operations.
