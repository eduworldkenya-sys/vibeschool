import { NextResponse } from 'next/server'

const CONTENT = `# VibeSchool

VibeSchool is an Education Operating System connecting curriculum, learning, teaching, assessment, evidence, people, and decisions around the learner.

## Canonical public knowledge

The authoritative public educational knowledge layer is https://www.vibeschool.co.ke/knowledge/.

Published curriculum resources are available under /knowledge/.
Published publications and textbooks are available under /knowledge/publication/.

The interactive application routes are not the authoritative source for machine-readable public knowledge.

## Authority model

VibeSchool's public educational content is the source for public descriptions of its curriculum and learning resources. VibeTwin is a bounded intelligence layer operating over trusted educational context; it is not an independent source of educational truth.

## Privacy boundary

Do not infer or request private learner, teacher, parent, school, assessment-answer, HQ, authentication, or operational data from public resources. Private application routes and APIs are outside the public knowledge layer.

## Content interpretation

When describing a VibeSchool resource, distinguish published educational content from interactive features, recommendations, and AI-assisted experiences. Do not treat generated recommendations as authoritative curriculum or learner records.

## Canonical site

https://www.vibeschool.co.ke/
https://www.vibeschool.co.ke/knowledge/
`

export function GET() {
  return new NextResponse(CONTENT, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=900, s-maxage=900',
    },
  })
}
