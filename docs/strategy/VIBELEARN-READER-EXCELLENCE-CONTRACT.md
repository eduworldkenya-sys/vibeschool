# VibeLearn Reader Excellence Contract

## Product position

VibeLearn Read is a primary VibeSchool business surface, not a utility page around content. The product must be good enough that a learner prefers reading the same educational material in VibeLearn because it is calmer, clearer, easier to continue and easier to understand.

## North-star journey

`open → orient → read/listen → understand → continue → remember`

Reading is the default task. Publishing, commerce, analytics, study tools, assessment and teacher actions may support the task but must not compete with the text for attention.

## Binding experience rules

1. **Content is the hero.** The active reading passage receives the dominant visual area.
2. **Progressive disclosure.** Secondary tools are collapsed until the reader asks for them.
3. **Comfort is personal.** Theme, text size, line spacing and reading width persist on-device.
4. **Focus is one tap away.** A learner can remove non-reading chrome without losing the content or progress.
5. **Listen is a reading mode, not a gimmick.** Speech starts near the current viewport, exposes pause/resume/stop and voice/speed selection, and visibly follows the passage being spoken.
6. **Do not claim a natural voice that the device cannot provide.** Prefer higher-quality English voices, but truthfully disclose that browser/device voice quality varies until a managed premium audio service is commissioned.
7. **Readable typography wins over brand styling.** Body text is left aligned, comfortably spaced and constrained to a readable measure.
8. **Mobile is canonical.** The controls must remain usable on narrow Android screens and respect safe-area insets.
9. **Accessibility is a product requirement.** Controls have labels/states, reduced-motion preference is respected, high-contrast reading is available, and text scaling must not destroy layout.
10. **No accidental commercial activation.** Reader UX improvements must not enable M-Pesa, activate offers or change entitlement authority.

## Implementation waves

### Wave 1 — Reading foundation
- calm persistent reader controls
- themes
- text size / line spacing / reading width
- focus mode
- listen controller
- spoken-passage tracking

### Wave 2 — Navigation and continuity
- one canonical compact reader header
- chapter table of contents
- previous/next navigation
- exact block resume
- estimated remaining reading time
- remove duplicate/competing navigation chrome

### Wave 3 — Study interactions
- highlight
- note
- bookmark exact passage
- in-book search with exact jump
- image/diagram zoom
- vocabulary save and pronunciation

### Wave 4 — Learning modes
- explicit Read / Study / Revise modes
- quick checks shown contextually rather than permanently
- misconception and worked-example surfaces grounded in verified curriculum/content semantics

### Wave 5 — premium audio
- evaluate managed neural/non-robotic TTS provider behind a provider-neutral server contract
- sentence timing/highlighting
- durable audio position
- chapter audio caching/offline strategy where licensing and cost allow
- preserve browser speech as a no-cost fallback

## Acceptance standard

A release is not complete because a component exists. It must prove on a representative mobile viewport that a learner can open a readable publication, enter focus mode, change comfort settings, start/pause/resume/stop listening, leave and return without losing preferences, and still retain the existing entitlement/security boundaries.
