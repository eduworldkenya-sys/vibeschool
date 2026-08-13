import { NextResponse } from 'next/server'

const CONTENT = `# VibeSchool

VibeSchool is a Kenya-focused Education Operating System connecting curriculum, learning, teaching, assessment, evidence, educational content, people, decisions, and bounded intelligence around the learner.

## Public knowledge

The authoritative public discovery surface is the VibeGlobal reader:
https://www.vibeschool.co.ke/global/read

The public sitemap is the canonical machine-discovery index for public URLs:
https://www.vibeschool.co.ke/sitemap.xml

## Authority rules

- Only content published through VibeSchool's publication authority belongs in public discovery.
- Draft, review, private, school-private, learner-private, teacher-private, parent-private, and HQ content is excluded.
- Search visibility must not override publication state.
- The database remains authoritative for publication state and durable application state.

## AI boundary

AI systems may discover and reason over public educational knowledge exposed through the public reader and canonical URLs.

AI systems must not receive or infer private learner records, school-private records, teacher-private records, parent-private records, assessment answer keys, HQ operational data, privileged RPC results, credentials, or internal security state.

VibeTwin is bounded intelligence over trusted educational context. It is not the system of record and must not silently rewrite authoritative state or bypass authorization.

## Related public resources

- VibeSchool: https://www.vibeschool.co.ke
- Public reader: https://www.vibeschool.co.ke/global/read
- About: https://www.vibeschool.co.ke/about
- Contact: https://www.vibeschool.co.ke/contact
- Sitemap: https://www.vibeschool.co.ke/sitemap.xml
- Privacy: https://www.vibeschool.co.ke/legal/privacy
- Terms: https://www.vibeschool.co.ke/legal/terms
`

export function GET() {
  return new NextResponse(CONTENT, {
    status: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=900, s-maxage=900, stale-while-revalidate=3600',
    },
  })
}
