# Learn Stage 2 — reusable teaching tools

## Ownership and boundaries
These 12 client-side learning aids extend `UniversalLearnReader`. They do not create a separate lesson route, question bank, visual asset database, publication mechanism, grading engine, mastery record or learner identity. The caller remains responsible for obtaining a released, authorised lesson through its existing RPC and access checks.

The tools are exploratory and offer **local** self-checks only. A correct result is not an exam pass, mastery measurement, assignment submission or persistent progress. The interface says so clearly.

## Catalogue

| Subject group | Tool IDs | Reusable concepts |
| --- | --- | --- |
| Mathematics | `number-line`, `place-value`, `fraction-bars`, `multiplication-array`, `clock`, `unit-converter` | Integers, ordering, digit value, fractions, multiplication, time, measures |
| Languages | `word-builder`, `sentence-order`, `vocabulary-match` | Spelling, word structure, sentence syntax, word meanings |
| Science | `classification`, `experiment-variables`, `food-chain` | Grouping, fair tests, independent/dependent/controlled variables, energy transfer |

All 12 tools have learner interactions, feedback or visible model changes, keyboard-accessible native controls, labelled inputs, and reset or undo when appropriate. No lesson-specific widget is replaced.

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

For subject-wide examples, omit the `tools` prop. `suggestTeachingTools(subject, topic)` chooses a small illustrative set of general tools. `topic="time"` offers the clock and converter for both Grade 4 Time readers. To suppress the shelf for a lesson, pass `showTeachingTools={false}` or `tools={[]}`. Explicit section-level `section.tools` may also be supplied. Duplicated and unknown tool IDs are filtered; unsupported subjects display no toolbox.

## Content and pedagogy
The default examples are clearly exploratory examples, **not** translations of hidden exam answers. For targeted lessons, pass the actual approved author-provided values, terms, classifications and sequences. Science classification and fair-test feedback uses fixed local sample data unless a lesson supplies other valid classification items; fair-test roles are intentionally constrained to an understood demonstration.

The standard published text and certified `[visual:UUID]` resolver remain unchanged. Teaching aids must not claim a learner's mastery or silently mutate learning records. More advanced lessons can provide new data payloads while reusing these same visual/interaction primitives.

## Verification
`npm run test:outcome-delivery` includes `scripts/test-teaching-tools.mjs` and existing Grade 4 Time reader tests. Run typecheck, build, and responsive browser checks on both Time entrypoints plus English and Science lesson examples before a release readiness claim.

Rollback: remove the optional shelf import and render line from `UniversalLearnReader`; the published notes, question reveals, visual references and existing Time widgets remain intact.
