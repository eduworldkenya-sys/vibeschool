# Reader UX Final Engineering Status

## Closed gaps

- Passive question cards were replaced with structured learner question rendering.
- Question authoring now supports multiple choice, true/false, short answer, answer authority, hint and explanation.
- Learner answers are sent to the existing server-side grounded-practice authority.
- Server-side grounded practice derives correctness from the authoritative published `content_blocks` question instead of trusting a client-supplied boolean.
- Reader feedback is accessible and includes retry/explanation/hint behaviour.
- Answer markers and `correctAnswer` metadata are stripped from learner reader payloads by a database redaction boundary.
- Raw reader functions are no longer directly executable by browser roles.
- Live Supabase smoke tests confirmed the public reader can return real question blocks without leaking `Answer:` markers or `correctAnswer` metadata.

## Live evidence

The live database contains published assessable question blocks. The authenticated grounded-practice RPC exists with the expected signature and authenticated execute permission.

For the live Vibe Biology publication used as a smoke test:

- reader response: `ok = true`
- question blocks returned: 8
- question blocks containing `Answer:` in learner payload: 0
- question blocks containing `correctAnswer` metadata in learner payload: 0

## Important content-quality observation

Existing published questions are predominantly open-ended mastery prompts and do not contain a markable `Answer:` authority. They therefore intentionally remain reflection questions until an author supplies an answer authority. The system must never invent correct answers for published educational content.

## Release verification

The repository's GitHub `TypeScript and Production Build Gate` is required to pass TypeScript, ESLint and the production build on the final commit before this work can be called fully verified.

## Remaining product roadmap, not defects in the core online reader

- paid/school-license entitlement fulfilment
- offline cache/synchronization
- grounded AI tutor

These remain separate product capabilities and should not be falsely represented as complete by the core reader audit.
