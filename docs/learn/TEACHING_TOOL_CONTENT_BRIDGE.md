# Stage 3 — Teaching tools from canonical curriculum and content

## Ownership (no parallel infrastructure)

Teaching tools are **presentation-only consumers** of VibeSchool's canonical learning assets. They never publish, generate, mark, certify, or copy instructional content into a second library. The teaching-tool catalogue is the single existing `lib/learn/teachingToolCatalog.ts`.

| Need | Existing authority |
| --- | --- |
| Curriculum/outcome identity | Existing curriculum map and `curriculum_learning_outcomes` |
| Lesson/source selection | Existing Scheme of Work and `loadCertifiedContentForSource` |
| Content identity and certified immutable version | `learning_resources` + `learning_resource_versions` |
| Learner read admission | Existing published/certified read RPCs and RLS |
| Teacher asset access | Existing RLS-gated `CanonicalLessonSourceBundle` |
| Visual approval | Existing `VisualRichText` → `VisualLearningAsset` resolver |
| Assessment & mastery | Existing assessment engine only; teaching tools write neither |

**No new migrations, schema, catalogues, APIs, media stores or release gates are introduced.**

## Integration contract

`lib/learn/teachingToolContentBridge.mjs` is the single adapter.

1. The caller **first** loads an authorized published lesson/outcome from its existing RPC or teacher certified asset through the existing Scheme/curriculum loader. An arbitrary `sourceKind` string cannot grant authorization.
2. The caller passes the **real** `resourceVersionId` (and `resourceId`, `outcomeId`, `schemeLessonId` when known), subject, grade and parsed, visible section text.
3. The adapter preserves original section bodies and returns immutable `bindings`. Each binding references exactly one existing resource version and a matching section index. It does not fetch, materialize or create assets.
4. `UniversalLearnReader` accepts `toolContext` and keeps the existing `TeachingToolShelf` and its one `teachingToolCatalog.ts`. Section-level specifications are considered only when they match the released resource-version binding; feedback sections cannot supply tool inputs. The existing `afterSection` hook and Grade 4 Time bespoke visual aids are preserved.
5. `CanonicalLessonSourceBundle.toolContexts` exposes equivalent teacher-only bindings for existing certified assets. It works with or without a timetable; Scheme identifiers are attached when they exist, and existing curriculum-linked candidates remain the fallback. Only known payload `sections`, `content_text` or `body` fields are adapted; unknown shapes are skipped, not guessed.

The binding `slot` (e.g. `worked_example`, `exploration`, `guided_practice`) is **not** a new tool registry. Stage 2's shared teaching tools can select an appropriate existing component from these slots and its registered capabilities; do not fork its registry here.

## Security / content integrity

- The reader has no privileged database client and cannot promote drafts.
- `feedback`, answer-key and marking-scheme sections are excluded from automatic tool bindings. The existing reader's deliberate answer reveal is untouched.
- Teacher content remains available only through teacher-authorized loading; `certified_scheme` and `certified_curriculum` bindings are denied for the learner audience.
- `[visual:<uuid>]` tokens are **placeholders only**. They are not evidence of visual certification; the existing visual resolver alone decides if they can display.
- The adapter never records progress, marks, attempts, mastery or analytics.
- Missing/incompatible version IDs, malformed sections or invalid learner/teacher scope fail closed; missing optional content gives an empty tool list.
- Do not infer a curriculum outcome ID from headings or topic words. Only pass IDs delivered by an authoritative existing source.

## Verification and rollout

Run `npm run test:outcome-delivery` (includes `scripts/test-learning-tool-content-bridge.mjs`), `npm run test:teaching-library`, `npm run typecheck`, `npm run build`. Confirm mobile, independent learner, school learner and teacher lesson flows against a **published** resource. Check that switching lessons never renders an old binding; draft resources never appear and visual placeholders still use the existing resolver.

This stage wires canonical inputs into the existing portfolio of twelve Mathematics, Language and Science teaching tools. The tools remain ungraded and do not claim mastery. It does not claim production deployment or cross-grade runtime certification. Production and full cross-grade verification are separate gates.
