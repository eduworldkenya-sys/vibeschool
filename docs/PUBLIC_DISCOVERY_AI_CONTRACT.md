# VibeSchool Public Discovery & AI Contract

**Status:** Canonical architecture rule

## Objective

Make VibeSchool's legitimate educational knowledge discoverable and understandable to people, search engines and AI systems without weakening the privacy, authorization or lifecycle boundaries of the private Education Operating System.

## Public authority

A resource is eligible for public discovery only when its domain lifecycle explicitly permits public publication. The current contract is:

- course catalog entries: `courses.status = live`
- topic learning resources: `topics.content_status = published` and their parent course/module must resolve to a live public course
- private application areas: never discoverable

`coming_soon`, `draft`, `archived`, learner-private and staff-private states are not public publication states.

## URL authority

Every indexable resource has one canonical URL. Alternate application states, authenticated variants, query-string variants and duplicated routes must not become competing canonical documents.

## Search controls

Public pages should provide:

- meaningful server-generated title and description
- canonical URL
- appropriate Open Graph metadata
- structured data where schema semantics are accurate
- inclusion in the sitemap only when public lifecycle rules permit it

Private areas must be excluded from public discovery through both application authorization and crawler directives. Robots directives are a crawler boundary, never an access-control mechanism.

## AI discovery

VibeSchool may publish an `llms.txt` orientation document describing its public mission, architecture and canonical public resources. AI systems should prefer canonical VibeSchool public pages for claims about VibeSchool and its published educational content.

AI systems must not be given or encouraged to infer:

- learner records
- marks and report-card data
- teacher-private records
- parent-private records
- school-private operational data
- HQ or administrative data
- authenticated API responses

## Educational truth

Public educational content must remain grounded in authoritative VibeSchool content objects. AI-generated summaries are derivative representations and must never silently become the authoritative curriculum, assessment result or learner record.

## Failure behavior

Discovery code must fail closed:

- missing public data → omit the resource from the sitemap
- unpublished resource → noindex / omit
- unresolved parent relationship → omit
- missing environment/configuration → retain safe static public routes only
- private route → never expose through discovery metadata

## Release requirement

Public discovery is not complete until source code, production data lifecycle, authentication/RLS boundaries, generated metadata, sitemap, robots, canonical URLs and actual production responses agree.
