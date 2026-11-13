# Learn Stage 2 — reusable teaching tools

## Ownership and boundaries
These 15 client-side learning aids extend `UniversalLearnReader`. They do not create a separate lesson route, question bank, visual asset database, publication mechanism, grading engine, mastery record or learner identity. The caller remains responsible for obtaining a released, authorised lesson through its existing RPC and access checks.

The tools are exploratory and offer **local** self-checks only. A correct result is not an exam pass, mastery measurement, assignment submission or persistent progress. The interface says so clearly.

## Catalogue

| Subject group | Tool IDs | Reusable concepts |
| --- | --- | --- |
| Mathematics | `number-line`, `place-value`, `fraction-bars`, `multiplication-array`, `clock`, `unit-converter`, `data-chart` | Integers, ordering, digit value, proper/improper fractions, multiplication, time, measures, graphs |
| Languages | `word-builder`, `sentence-order`, `vocabulary-match`, `reading-comprehension`, `writing-planner` | Spelling, word structure, syntax, word meanings, reading comprehension, writing plans |
| Science | `classification`, `experiment-variables`, `food-chain` | Grouping, fair tests, independent/dependent/controlled variables, energy transfer |

All 15 tools have learner interactions, feedback or visible model changes, keyboard-accessible native controls, labelled inputs, and reset or undo when appropriate. No lesson-specific widget is replaced.

## Authoring examples

Released content readers may supply an explicit `tools` array without schema changes:

```tsx
<UniversalLearnReader
  subject="English"
  title="Writing clear sentences"
  sections={releasedSections}
  tools={[
    { id: 'sentence-order', sentence: 'The bird builds a nest.' },
    { id: 'vocabulary-match', pairs: [
      { term: 'describe', definition: 'Give clear details about something' },
      { term: 'compare', definition: 'Look for similarities and differences' },
    ] },
  ]}
/>
```

Only explicitly authored, verified lesson tool configurations are displayed; `subject` or `topic` does not automatically create activities. When no approved `tools` or `section.tools` are present, the reader simply displays the lesson (and any existing specialised lesson aids) without an unrelated shelf. This prevents Grade 4 Time, English and Science pages from showing generic exercises that have not been checked against their specific outcomes. Tool selection is not an outcome-certification mechanism: authoring must match a verified canonical curriculum outcome and an admitted content version.

All provided tools are validated by type, subject, allowed configuration and version before rendering. Invalid and wrong-subject tools are omitted; no generic fallback exercise is invented. At most five authored tools are shown per lesson to reduce overload. A `data-chart` can be used in Mathematics or Science when the approved dataset is supplied. The displayed content comes only from the authorized reading source; the interactive shelf never fetches questions or writes results. `showTeachingTools={false}` or `tools={[]}` suppresses the shelf. Feedback/answer sections are excluded from section-tool selection.

## Content and pedagogy
Every activity must contain its actual approved author-provided values, terms, classifications or sequences. Language and Science no longer substitute generic example data for missing or malformed input. Word building requires a learner-facing clue and hides the target word until the learner attempts to construct it. Sentence reordering treats duplicate words by their visible values, not their original array indices. Number lines are configurable within a bounded range, place value supports up to twelve digits, fraction bars support up to three wholes, and units include capacity.

The standard published text and certified `[visual:UUID]` resolver remain unchanged. Teaching aids must not claim a learner's mastery or silently mutate learning records. More advanced lessons can provide new data payloads while reusing these same visual/interaction primitives.

## Verification
`npm run test:outcome-delivery` includes `scripts/test-teaching-tools.mjs` and existing Grade 4 Time reader tests. Run typecheck, build, outcome-specific cross-grade contract tests and responsive browser checks on both Time entrypoints plus English and Science lesson examples before a release readiness claim.

Rollback: remove the optional shelf import and render line from `UniversalLearnReader`; the published notes, question reveals, visual references and existing Time widgets remain intact.

## Coverage and approval limits

Implementation of the 15 reusable components does not mean 15 tools are certified for every grade or learning outcome. The authoring/content bridge must supply relevant released activity data tied to the correct curriculum outcome; the presentation layer deliberately cannot infer that mapping. Grade 4 Time keeps its existing time-specific visual aids. Signed-in teacher, independent learner, school-linked learner, keyboard, low-bandwidth and phone tests remain required for production certification.
