# VibeSchool Pathways — National Authority, SEO and AI Discoverability Mission

**Status:** Strategic mission contract; not yet implemented or certified.  
**Branch:** `agent/pathways-customer-acquisition-strategy`  
**Promotion rule:** This branch must not merge to `main` until the Pathways acquisition mission, including this authority/discoverability layer, is complete and certified.

## 1. Strategic Ambition

VibeSchool Pathways should become one of the most discoverable, useful and trusted independent sources for Kenyan pathway guidance.

The target is not merely to rank for the word “pathway.” The target is that when a learner, parent, teacher, school, search engine or AI assistant asks a real Kenya education question, VibeSchool has a relevant, indexable, structured, current and source-backed answer.

Examples of intended discovery questions:

- Which senior school pathway should I choose in Kenya?
- What are the Grade 10 pathways in Kenya?
- Which subjects are required for STEM?
- Which schools offer a specific subject combination?
- What careers can a given pathway lead to?
- Which pathway fits a learner interested in engineering, medicine, business, agriculture, arts or sports?
- Which senior schools in a county offer a given combination?
- What does a specific Ministry/KICD pathway rule mean for a learner?

## 2. Authority Positioning

VibeSchool must never imply that it is the Ministry of Education, KICD, KNEC or another official government authority.

Instead, VibeSchool should aim to become the strongest independent interpretation and discovery layer around authoritative Kenyan education data.

The hierarchy is:

**Official source → VibeSchool evidence ingestion → normalized knowledge graph → understandable learner/parent guidance → searchable public knowledge pages → personalized pathway experience.**

Official facts remain attributed to their authoritative source. VibeSchool recommendations are clearly labeled as VibeSchool guidance.

## 3. Competitive Standard

The Ministry’s current Grade 10 selection ecosystem already publishes pathway, subject-combination, school and career information. Therefore VibeSchool cannot win by reproducing a thinner version of the same material.

VibeSchool must compete on:

- completeness;
- clarity;
- searchability;
- structured relationships;
- provenance;
- freshness;
- explanation;
- comparison;
- personalization;
- accessibility;
- low-bandwidth performance;
- public indexability;
- machine readability;
- longitudinal learner context.

The target is **authority-grade coverage**, not official-government identity.

## 4. Knowledge Coverage Contract

The Pathways knowledge system should eventually model at least:

### Pathways
- official pathway names;
- tracks/branches where applicable;
- descriptions;
- eligibility/selection rules where officially defined;
- related subjects;
- related careers;
- related competencies/interests;
- official source and effective date;
- version/status/history.

### Subject combinations
- canonical combination identity;
- constituent subjects;
- pathway/track relationship;
- official availability rules;
- schools offering the combination;
- source/evidence;
- effective date/version.

### Subjects
- canonical subject name;
- curriculum level;
- pathway relationships;
- prerequisites where authoritative;
- career/tertiary relevance where supported;
- aliases/search synonyms;
- provenance.

### Senior schools
- canonical school identity;
- KNEC or other official identifier where legally/publicly available;
- county/sub-county/location;
- gender;
- accommodation type;
- cluster/category where authoritative;
- pathways offered;
- subject combinations offered;
- programme/specialism information;
- verified source history;
- last checked timestamp;
- confidence/provenance.

### Careers and progression
- career identity;
- pathway relationships;
- subject relevance;
- further-study/professional requirements only where sourced;
- explanation of uncertainty and changing requirements;
- authoritative/professional source links where appropriate.

### Policy and guidance
- official Ministry/KICD/KNEC notices affecting pathways;
- effective dates;
- superseded rules;
- plain-language explanation;
- affected pathways, combinations, grades and cohorts.

## 5. National Knowledge Graph

The information must not remain isolated pages or copied text.

It should form a versioned graph such as:

**Policy → Cohort → Pathway → Track → Subject combination → Subject → School → County → Career → Further study → Learner action**

Every consequential edge should be attributable to evidence or explicitly marked as VibeSchool inference/guidance.

This graph powers both personalized recommendations and public discovery pages.

## 6. Provenance and Trust Contract

Every important official claim should support:

- source organization;
- source URL/document identity;
- retrieval/observation date;
- effective date where known;
- evidence type;
- version/status;
- confidence;
- whether the claim is official fact, normalized interpretation or VibeSchool recommendation.

When sources conflict, the system must not silently choose one. Record the conflict and either resolve it with stronger evidence or expose uncertainty appropriately.

Stale data should be detectable. Superseded policy must not continue appearing as current guidance.

## 7. SEO Architecture

SEO is a product/data architecture responsibility, not a marketing afterthought.

### Public indexable entities

Where privacy and source rights permit, VibeSchool should have canonical public pages for high-value entities and queries, for example:

- `/pathways`
- `/pathways/stem`
- `/pathways/social-sciences`
- `/pathways/arts-sports-science`
- `/subjects/...`
- `/subject-combinations/...`
- `/schools/...`
- `/counties/.../senior-schools`
- `/careers/...`
- query-intent guides such as subject/pathway/career relationships.

Exact routes must be chosen after auditing the existing application and URL architecture.

### Technical SEO requirements

- stable canonical URLs;
- server-rendered or otherwise reliably crawlable primary content;
- unique titles/descriptions;
- semantic heading structure;
- canonical tags;
- XML sitemaps segmented by entity type where scale warrants;
- robots policy that intentionally exposes public knowledge and blocks private/session surfaces;
- structured internal linking;
- useful 404/redirect behavior;
- no duplicate thin pages generated from arbitrary filters;
- fast mobile performance;
- accessible semantic HTML;
- freshness metadata where useful;
- correct language/locale treatment if multilingual pages are introduced.

## 8. Search Intent Architecture

Do not optimize only for entity names. Build around real questions and decision intent.

Priority intent families:

1. **Understand** — “What is STEM pathway in Kenya?”
2. **Compare** — “STEM vs Social Sciences pathway.”
3. **Qualify** — “Which pathway suits me?”
4. **Combine** — “Which subjects can I take with Physics?”
5. **Locate** — “Schools offering Aviation and Physics.”
6. **Progress** — “What careers come from this pathway?”
7. **Policy** — “Latest Grade 10 pathway selection rules.”
8. **Action** — “How do I choose my senior school pathway?”

Every high-value intent should map to a canonical knowledge page or tool, not an uncontrolled pile of near-duplicate SEO content.

## 9. AI Discoverability / Answer Engine Optimization

AI systems should be able to understand VibeSchool’s public knowledge without scraping a client-only application or guessing relationships.

The public layer should therefore provide:

- clear entity names and definitions;
- concise factual summaries near the top of pages;
- explicit relationships between pathways, subjects, careers and schools;
- source attribution;
- dates and freshness signals;
- stable URLs;
- crawlable HTML;
- structured data using appropriate schema.org types where valid;
- machine-readable sitemaps/feeds where useful;
- consistent terminology and canonical aliases;
- FAQ-style answers only when they represent genuine user questions, not search spam.

Do not invent unsupported “AI SEO” metadata. Prioritize high-quality public information, strong structure and verifiable provenance.

## 10. Structured Data Contract

During implementation, evaluate and use only schema.org types that accurately describe the page, such as appropriate Organization, EducationalOrganization, School, Course, FAQPage, BreadcrumbList, Article or Dataset markup where the underlying content genuinely qualifies.

Structured data must match visible page content. Never create fabricated ratings, reviews, admissions data or other rich-result bait.

## 11. Programmatic Knowledge Pages — Quality Gate

Programmatic SEO is allowed only when each generated page has independent user value.

A school/pathway/combination page should contain meaningful structured information and relationships, not just swap a county or subject keyword into a template.

Do not publish pages when evidence is too weak to make them useful. Thin, duplicate or speculative pages should remain unpublished/noindex until the knowledge contract is satisfied.

## 12. Freshness Engine

Authority requires ongoing maintenance.

The system should eventually support:

**Discover source change → ingest evidence → compare against canonical state → detect conflict/change → human/governed review where required → update canonical knowledge → regenerate affected public surfaces → update freshness → retain history.**

Priority monitored sources should include official Kenya education authorities relevant to pathway facts.

No automated source change may silently rewrite consequential learner guidance without the required governance level.

## 13. Content Depth Standard

To rival official portals in usefulness, each major entity page should answer the next questions a user is likely to ask.

For a pathway page, this can include:
- what it is;
- who it may suit;
- official structure;
- subjects/combinations;
- schools;
- possible careers/progression;
- how selection works;
- common misunderstandings;
- source/update history;
- pathway discovery CTA.

For a school page:
- canonical identity;
- location;
- verified classification fields;
- offered pathways/combinations where supported;
- relevant contextual filters;
- evidence/freshness;
- link into pathway discovery.

Content must distinguish facts from recommendations.

## 14. Acquisition Integration

Public authority pages are not separate from the acquisition strategy.

The loop is:

**Search/AI answer/referral → authoritative VibeSchool knowledge page → useful answer → “Discover my pathway” → anonymous pathway experience → value moment → free sign-in → activation.**

SEO traffic without pathway activation is not the end goal.

## 15. Measurement

Track at minimum:

- indexed canonical pages;
- coverage by entity type;
- source freshness/staleness;
- organic impressions/clicks;
- rankings for representative intent clusters;
- AI/referral traffic where observable;
- public knowledge page → pathway-start conversion;
- pathway-start → result;
- result → registration;
- registration → activation;
- crawl/index errors;
- duplicate/thin page rate;
- pages with missing provenance;
- coverage gaps against authoritative source sets.

The north star remains activated pathway users, with discoverability serving the acquisition engine.

## 16. Priority Roadmap

### A0 — Authority baseline audit
- inventory current Pathways public pages;
- inventory existing school/pathway/subject/career data;
- inspect what Google can crawl today;
- inspect metadata, rendering, sitemap, robots and canonical behavior;
- inspect existing provenance and freshness fields;
- compare coverage to official Ministry/KICD/KNEC public sources;
- quantify missing entities and relationships.

### A1 — Canonical knowledge model
- define canonical entity IDs;
- define provenance model;
- define version/effective-date model;
- define source conflict behavior;
- connect pathways, combinations, subjects, schools and careers;
- define public/private field boundaries.

### A2 — Public knowledge surfaces
- build canonical entity pages;
- build internal-link graph;
- add crawlable factual summaries;
- add citations/source history;
- add discovery CTA;
- ensure strong mobile/low-bandwidth UX.

### A3 — Technical SEO
- metadata;
- canonical URLs;
- sitemap architecture;
- robots policy;
- structured data;
- redirect/404 contracts;
- performance and indexability validation.

### A4 — National coverage
- ingest/verify authoritative pathway data;
- subject-combination coverage;
- senior-school coverage;
- county/local discovery;
- career/progression knowledge;
- policy history;
- gap dashboards.

### A5 — Freshness and authority operations
- source monitoring;
- change detection;
- review workflow;
- stale-data detection;
- conflict handling;
- provenance audit;
- scheduled coverage checks.

### A6 — Search and AI authority certification
- representative Google/Bing query audit;
- rendered-page/crawler audit;
- structured data validation;
- AI answer/citation sampling across major assistants/search systems where permitted;
- factual accuracy adversarial review;
- search-intent coverage report;
- acquisition conversion measurement.

## 17. Certification Standard

This authority mission is not complete because pages exist.

Completion requires evidence that:

- [ ] canonical entities and relationships are modeled;
- [ ] authoritative claims carry provenance;
- [ ] stale/superseded facts are governed;
- [ ] key public pages are crawlable and indexable;
- [ ] sitemap/canonical/robots behavior is correct;
- [ ] pages provide substantial independent value;
- [ ] school/pathway/subject-combination coverage is measured nationally;
- [ ] gaps against authoritative public datasets are visible;
- [ ] no private learner data is exposed to search crawlers;
- [ ] recommendations do not masquerade as official government decisions;
- [ ] structured data reflects visible truth;
- [ ] public pages connect into the Pathways acquisition journey;
- [ ] representative search-intent queries are monitored;
- [ ] factual accuracy and source freshness pass adversarial audit;
- [ ] branch-level implementation, tests and production-readiness gates pass before merge is considered.

## 18. Non-Negotiable Position

The goal is not “beat the Ministry by pretending to be official.”

The goal is:

> **Use authoritative Kenyan education sources better than anyone else: normalize them, connect them, explain them, keep them current, expose them cleanly to humans and machines, and turn that knowledge into useful learner action.**

If VibeSchool achieves that consistently, search engines, AI systems, teachers, parents and learners have a legitimate reason to treat it as a leading reference for pathway discovery.
