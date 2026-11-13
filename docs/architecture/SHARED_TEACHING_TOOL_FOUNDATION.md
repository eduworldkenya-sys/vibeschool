# Shared Learn teaching-tool foundation

## Scope and authority

The **Universal Learn Reader** is the single presentation host for lesson sections. The optional `teachingTool` metadata on a released section selects a subject-appropriate, versioned, reusable teaching tool from `lib/learn/teachingToolRegistry.ts`. This is a presentation decision, not a new source of curriculum, learner records, answer authority, assets, or assessment.

The caller MUST obtain content through its existing certified/published or authorized read path. The reader/registry MUST NOT directly fetch content, bypass RLS, modify lesson text, publish new media, assign grades, persist progress, or run an exam engine.

## Existing components

- `components/learn/UniversalLearnReader.tsx`: navigation, sections, heading, feedback boundaries, and optional custom rendering by existing callers.
- `lib/learn/teachingToolRegistry.ts`: subject classification, tool allowlist, version compatibility, explicit selection, and safe fallback.
- `components/learn/TeachingToolHost.tsx`: render from the supplied section body, via the existing certified `VisualRichText` visual admission path.
- `components/learn/UniversalLearnReader.module.css`: accessible, responsive shared surfaces.

## Data contract

```ts
const section = {
  id: 'reading', title: 'Read the passage',
  body: 'A story supplied by the authorized published reader.',
  teachingTool: { id: 'language-reading', version: 1 },
}
```

The field is optional. Existing Grade 4 Time numbered `example` steps automatically use the progressive Mathematics tool; other legacy prose remains unchanged. The **section presentation registry** is distinct from the existing Stage 2 interactive teaching-tool catalog (`lib/learn/teachingToolCatalog.ts`) and its `TeachingToolShelf`. Both run inside the same reader with separate responsibilities: section presentation chooses a rendering style for existing prose, while the shelf offers 12 optional interactive models. Do not create a second content source, question bank or progress authority.

Current v1 section presentation tools: `rich-text` (all subjects), `math-worked-steps` (Mathematics), `language-reading` (Languages), `science-observation` (Science). They are generic display shells, not complete interactive subject tools.

For future tool families, extend the versioned allowlist and host, validate any new tool-specific data separately, author a real accessible fallback, and add cross-grade and unauthorized-content regression tests. Never infer answers, skills, experiments, source rights or visual approval from arbitrary prose.

## Stage 4 — Specialist Senior School roadmap

Fourteen future tool families (the original six plus spreadsheet/data, geography/GIS,
agriculture, technical drawing, home science, media production, language/debate and
community project portfolios) are listed in the **inactive**
`SPECIALIST_TOOL_ROADMAP` in the existing interactive catalogue. Planned family
IDs are not executable `TeachingToolId` values and cannot appear in a learner
lesson. See [Stage 4 admission and rollout plan](../learn/STAGE4_SPECIALIST_SENIOR_TOOLS.md).
No new reader, persistence, assessment engine or permission path is authorized.

## Integration sequence

1. Obtain a previously authorized release using the established reader/RPC.
2. Convert that release into sections without changing its content or permission scope.
3. Include optional versioned `teachingTool` metadata only when the authoring/schema path intentionally supports that specialised display.
4. Render through `UniversalLearnReader`; any caller's existing `renderBody` override still takes priority.
5. Confirm no content loss, no unauthorized visual/answer leakage, keyboard interaction, mobile layout and print fallback.

## Verification

`node --experimental-strip-types --test scripts/test-teaching-tool-registry.mjs`, `npm run test:outcome-delivery`, TypeScript and production build, then real learner and teacher browser checks. Code merges are not production verification.

## Minimum acceptance matrix

| Source lesson | Presentation | Safety expectation |
| --- | --- | --- |
| Grade 4 Mathematics Time with two numbered steps | Progressive worked steps | Same published explanation and certified visuals; no new answer record |
| Mathematics explanation without step numbering | Plain readable text | No invented steps |
| English or Kiswahili with explicit `language-reading` v1 | Reading passage | Same authored words; no generated audio or score |
| Science with explicit `science-observation` v1 | Observation text and admitted diagrams | No fabricated experiment, simulation or safety assurance |
| Unknown tool, unsupported subject or unsupported version | Plain readable text | No content loss, no code execution and no unapproved media |

These are contract tests and design expectations. The language and science tools are available in the shared host but individual content pipelines must explicitly supply verified metadata before specialised presentations appear in published lessons. Browser and real-device certification is a separate gate.
