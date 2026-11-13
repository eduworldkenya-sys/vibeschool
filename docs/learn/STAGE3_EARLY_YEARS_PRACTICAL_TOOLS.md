# Stage 3 — Early Years, Creative Arts, Social Studies and Agriculture

## Architecture
Extend UniversalLearnReader and the existing TeachingToolShelf/catalogue. No parallel backend, lesson routes, asset store, assessment engine, submissions or mastery tables.

| Tool | Function | Canonical payload |
| --- | --- | --- |
| visual-explorer | Approved image and revealable labels | visualId, resourceVersionId, visualNotes |
| audio-learning | Browser text-to-speech and visible text fallback | spokenText, language |
| observation-journal | Record answers to authored observation questions | observationQuestions |
| drawing-pad | Touch/mouse drawing, downloaded PNG, accessible description | prompt |
| practical-steps | Sequential instructions and materials | steps, materials |
| sorting-groups | Existing classification sorter reused across subjects | groups, items |
| map-explorer | Authored location labels and optional schematic points | places, optional approved visualId |
| timeline-explorer | Chronological exploration in authored order | events |
| evidence-notes | Written reflections copied into existing assignment | observationQuestions |

The source is an authorised *released* lesson or *certified* teacher resource. The section adapter admits only bounded declarative fields from author-authored JSON and keeps original section body. When toolContext is passed, the Universal Learn Reader matches the exact source resource version, section index, section ID and body. Feedback sections cannot trigger interactive tools. Unknown tool IDs are filtered by the **existing** single tool catalogue.

Visual media must pass VisualLearningAsset and its certified resource-version API. The map diagram is expressly schematic, **not geographic coordinates**. Audio is device-dependent browser speech; there are no unverified audio URL hosts. Drawing, observations and reflections are client-local; do **not** claim saved pupil evidence, grading or learner mastery. The learner can copy notes into an existing assignment or save a drawing to the device for later manual attachment where supported.

## Authoring examples (illustrations only; not published or curriculum-certified)

**Early Years** — supply a section with a body explaining shapes and tools such as an audio-learning instruction, drawing-pad for tracing, and sorting-groups with authored labels and correct categories.

**Creative Arts** — attach drawing-pad with an age-appropriate original creative prompt and evidence-notes for reflection. The learner should also be free to draw on paper.

**Social Studies** — attach map-explorer with places such as community facilities and teacher-authored descriptions. Pins use 0–100 percentages on a schematic diagram; show the actual map only via an approved visualId. Use timeline-explorer with authored event order and dates.

**Agriculture** — attach practical-steps with materials and sequential safe steps, observation-journal with actual observation questions, and evidence-notes for reflection. Physical activities may need adult supervision.

Example accepted shape:

~~~json
{
  "id": "explore",
  "title": "Observe a seed",
  "body": "Describe the changes you observe over several days.",
  "tools": [
    {"id":"practical-steps","materials":["Seed","Soil","Water"],
      "steps":["Prepare a container with soil.","Place the seed.","Water gently.","Observe regularly."]},
    {"id":"observation-journal","observationQuestions":["What has changed since your last observation?"]},
    {"id":"evidence-notes"}
  ]
}
~~~

Do not fabricate KICD learning outcomes, source approval, student responses, map locations or assessments. Publishing teams must associate the released content with its real curriculum, sub-strand, scheme lesson and approved assets. Grade 4 Time custom visuals and existing Stage 2 Maths, Language and Science interactions remain unchanged.

## Acceptance gates
1. Test the catalogue and Stage 3 component selection. Preserve all 15 Stage 2 tools.
2. Run typecheck, outcome-delivery tests, visual-library tests and production build.
3. Check fallback for unknown tools, unsupported media, unavailable speech, missing prompts and inaccessible or private resources.
4. Test Grade 4 Time lesson and outcome routes, Early Years touch/drawing/keyboard alternative, Creative Arts, Social Studies schematic maps and Agriculture observations.
5. Verify published learner and certified teacher access independently, with mobile/desktop responsive and screen-reader checks.
6. Confirm no separate writes, new backend tables, child photo collection or unsanctioned mastery scores.
7. Merge only after CI; separately verify the deployed browser and actual learner/teacher journeys.

## Remaining scope
This change provides tool definitions, interactive UI and canonical section-adapter support, *not* automatic content backfill or online evidence persistence. Publishing per-subject lesson materials and hooking learner evidence into existing authenticated homework submission still need explicit source-specific implementation and signed-in verification. Code-merge completion alone must not be reported as production certification.
