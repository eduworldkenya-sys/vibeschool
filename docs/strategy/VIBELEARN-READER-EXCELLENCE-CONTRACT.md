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
17. Offline/reconnect support must never turn browser cache state into entitlement authority.
18. Authenticated reader/API responses and paid publication bytes are not service-worker cache candidates by default.
19. Client-side queued progress is provisional only; the server remains authoritative after reconnect.
20. A signed-out or different user must never inherit another viewer's pending reader progress.
21. Reader-owned interactive controls use a practical 44px touch floor and a visible keyboard focus ring.
22. Checkout UI never manufactures access: paid access exists only after durable server-side entitlement fulfillment.
23. Premium TTS must remain provider-neutral at the reader-state layer and server-side at the credential layer.

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

### Wave 5 — durable annotation anchors
- canonical block ID + start/end text offsets form the annotation anchor
- highlights and notes preserve validated anchor metadata through the governed study RPC
- saved highlights render back to the source passage where the CSS Highlight API is available
- anchored notes visibly mark their source block
- cross-block selection is rejected instead of storing an ambiguous anchor

### Wave 6 — annotation management and compatibility
- current-unit annotation manager in Study mode
- review, edit and delete highlights/notes
- highlight recoloring without losing source identity
- jump from saved annotation back to its canonical source block
- legacy/unanchored items remain explicitly identified
- non-CSS-Highlight browsers use exact-range visual overlays without rewriting canonical text nodes

### Wave 7 — governed English/Kiswahili explanations
- source-governed bilingual glossary contract
- explicit source attribution and publication state
- entitlement-aware reader lookup RPC; no direct browser table access
- contextual Explain EN / SW for short selected terms
- truthful absence when no approved definition exists
- best-available English/Kiswahili device pronunciation where supported

### Wave 8 — stronger in-book search
- search index is built only from chapters already marked readable by canonical reader authority
- exact phrases rank first
- multi-term concept matching works when meaningful terms are separated in the same block/title
- chapter-title and heading relevance are weighted
- one best hit per canonical block reduces repeated-match noise
- no remote embedding dependency, API cost or locked-content indexing
- tokenizer remains compatible with the repository's TypeScript target

### Wave 9 — listening continuity foundation
- listening position is tied to canonical publication/chapter/block identity instead of fragile audio time alone
- current spoken passage can be resumed on the same device
- continuity identity is provider-independent so a later neural-TTS provider does not redefine reader state
- browser speech remains explicitly a fallback, not a premium-neural claim

### Wave 10 — constrained-network progress resilience
- existing PWA service worker remains restricted to safe public/static routes
- authenticated reader/API responses and paid content remain network-owned
- authenticated reading progress queues locally when connectivity is lost or a network write fails
- queued state is scoped to the exact viewer ID and chapter/publication identity
- sign-out clears provisional queued reader progress
- reconnect replays queued progress only through the canonical server RPC
- entitlement and chapter validity are rechecked server-side before queued progress becomes authoritative
- UI states when progress is pending or synchronizing instead of silently losing evidence

### Wave 11 — low-end mobile and accessibility baseline
- canonical reader mounts a cross-cutting accessibility style floor
- reader-owned button/select/search/text controls use a 44px minimum touch height
- visible keyboard focus uses a high-contrast 3px reader-accent ring with offset and surface halo
- ≤380px phone layout reduces chrome pressure without shrinking touch targets
- reduced-motion preference suppresses reader animations/transitions and smooth scrolling
- Reader Excellence contract mechanically certifies these invariants

### Wave 12 — reader → purchase → entitlement → continue-reading closure
- reader purchase bar uses `commerce_get_publication_purchase_context`
- offer disappears for already-entitled viewers and routes saleable users into the existing Learning Product checkout
- checkout uses idempotency keys and the dedicated Learning Product M-Pesa STK function
- settled self-purchases return the learner to `/read/textbook/[publicationId]`
- production callback persists an idempotent callback event before fulfillment and preserves uncertain states for reconciliation
- server fulfillment verifies amount/receipt uniqueness before creating an active durable entitlement
- canonical `can_viewer_read_chapter` consumes that entitlement and cleared product rights; checkout UI never grants access itself
- repository commerce and Reader Excellence contracts both certify this bridge

### Wave 13 — premium TTS provider decision, non-activating
- managed TTS evaluation completed without adding credentials, spend or production activation
- Azure Speech is the preferred Kenya pilot candidate because Microsoft's current official voice catalogue explicitly provides `sw-KE` Kiswahili voices (`ZuriNeural` and `RafikiNeural`) and its Speech service supports long-form/batch synthesis, SSML and pronunciation lexicons
- ElevenLabs v3 remains a quality challenger for listening tests, but accent/native-voice suitability must be measured before Kenya production use
- Google/OpenAI remain possible English/provider alternatives but are not treated as Kenya-Kiswahili authority without explicit locale evidence
- provider integration remains gated; browser/device speech stays the production fallback until quality, unit economics, privacy, rights and budget caps are certified
- canonical block-based listening continuity is already provider-independent

## Current offline boundary

VibeSchool does **not** currently claim full paid-content offline reading. Once commercial content bytes are deliberately made available offline, revocation cannot be instantaneous while the device is disconnected. That requires an explicit offline-license/product policy rather than accidental service-worker caching.

The safe current behavior is:
- public/static PWA shell may be cached by the existing service worker;
- a reader already loaded in the browser remains usable during a transient drop;
- progress is queued and server-revalidated on reconnect;
- paid reader/API responses are not cached for offline reload;
- offline paid-content packages remain a separate governed future capability.

## Premium TTS pilot boundary

Do not activate a managed provider merely because it sounds better in one demo. Before production activation, certify:
- Kenya English and `sw-KE` pronunciation quality on curriculum vocabulary, names and numbers;
- paragraph and long-chapter latency on constrained mobile networks;
- character/token cost per learner-hour and monthly budget caps;
- server-only credentials and provider request logging/privacy boundaries;
- publication/audio rights and whether generated audio may be cached;
- fallback behavior when the provider or network is unavailable;
- no provider-specific position state in the reader.

The first controlled comparison should use the same canonical sample passages across Azure `sw-KE` voices, the best available English candidate and the current device fallback. Provider activation remains separate from reader merge.

## Remaining program

1. Real-browser low-end Android acceptance on representative devices/viewports, including screen-reader and long/image-heavy chapter checks; the static accessibility baseline is implemented but physical/device acceptance remains evidence to collect.
2. Controlled real M-Pesa transaction acceptance for the first saleable Learning Product, using a low-risk fixture/product and verifying callback → entitlement → reader return without changing the architecture.
3. Premium TTS listening bake-off and unit-economics certification; provider selection is decided for the pilot but activation remains intentionally off.
4. Full paid-content offline packages only after a deliberate offline-license/revocation policy is approved and technically certified.
5. True semantic/embedding search only if measured reader behavior proves the lexical/concept engine insufficient.

## Handover log — 2026-08-18

- PR: #229, branch `agent/vibelearn-reader-excellence-20260818`.
- Reader branch reconciled onto commerce-complete `main` (`39cd68f23fbd92da9c3241791948b4f2ba385e24`) without force-pushing and without production activation.
- A TypeScript gate failure caused by Unicode-regexp target incompatibility was isolated and corrected with an ES5-safe English/Kiswahili tokenizer.
- The earlier Learning Product commerce semantic check itself passed; its missing verifier was branch drift and was resolved by reconciling current main rather than weakening the workflow.
- Production Supabase remained read-only during reader work; production payment and entitlement functions were inspected but not changed.
- Vercel has not been intentionally activated from this work and must remain untriggered until the branch is fully certified and intentionally promoted.
- Wave 10 queues provisional same-user reading progress during connectivity loss and replays it through canonical server authority after reconnect.
- Wave 11 installs the reader-wide 44px/focus/reduced-motion mobile accessibility baseline.
- Wave 12 certifies the existing purchase/payment/entitlement/reader bridge in both production truth and repository contracts.
- Wave 13 records Azure Speech as the preferred Kenya TTS pilot candidate without activating or spending on it.
- Dedicated `Reader Excellence Contract` workflow is green and guards entitlement-safe offline behavior, annotations, glossary truth, search compatibility, listening continuity, accessibility and commerce return-path invariants.
- Current exact-head certification still requires all generic long-running gates to settle green before promotion.

## Promotion boundary

Keep reader work isolated from unrelated curriculum-ingestion or publishing-authority work. Merge only after the exact reader head passes TypeScript/production build, migration/security, clean rebuild, relevant PWA/public-browser, commerce/auth gates and Reader Excellence acceptance. Production migration application, real-money acceptance and managed-TTS activation remain separate controlled operations. Vercel activation occurs only after the branch is complete and intentionally promoted.
