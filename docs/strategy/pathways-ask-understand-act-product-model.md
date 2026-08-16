# VibeSchool Pathways — Ask → Understand → Act Product Model

**Status:** Governing product architecture; implementation pending audit and certification.  
**Branch:** `agent/pathways-customer-acquisition-strategy`  
**Read with:** the Pathways Mission Documentation Index and every document it requires.  
**Promotion rule:** This mission branch remains isolated until the complete Pathways mission is implemented and certified.

## 1. Why This Document Exists

This document records a critical product insight that must not be lost between chats or reduced to “add a chatbot” or “make some SEO pages.”

People increasingly use short-form social video, creators, messaging groups and AI assistants instead of traditional search for many practical questions because they often want more than documents. They want:

- an immediate answer;
- an explanation they can understand quickly;
- a human-feeling interpretation of the question behind the query;
- evidence or social/professional reassurance;
- a recommendation;
- and, most importantly, to know what to do next.

Traditional search often returns links and asks the user to perform the synthesis. Short-form/social experiences often perform that synthesis quickly, but can lack authoritative evidence, completeness, consistency and accountability.

**VibeSchool's opportunity is not to copy TikTok.**

The product opportunity is to combine:

> **short-form simplicity + search discoverability + authoritative Kenyan education evidence + teacher-like explanation + personalized guidance + immediate action.**

This is the intended meaning whenever future documents or agents refer to VibeSchool as an **education decision/navigation system**.

## 2. Core Product Thesis

People do not primarily need more pathway information. They need help making an educational decision.

Therefore the canonical interaction model is:

**ASK → UNDERSTAND → VERIFY → PERSONALIZE → ACT → GET HELP WHEN NEEDED → REMEMBER/CONTINUE.**

### ASK

Start from the user's real question or known fact, not from VibeSchool's database hierarchy.

### UNDERSTAND

Give the shortest useful explanation first.

### VERIFY

Allow the user to inspect evidence, provenance, official sources, dates and caveats.

### PERSONALIZE

Translate the general answer into “what does this mean for me/my child/my learner?” using authorized evidence.

### ACT

Provide the appropriate next action: check subjects, explore a pathway, find schools, compare options, improve evidence, start a learning action, or follow an official process.

### GET HELP

When the system cannot safely resolve the decision or the user wants professional interpretation, route to governed human assistance when that service exists.

### REMEMBER

After trust is earned, free authentication allows VibeSchool to preserve the journey through the Pathway Passport/persistent pathway state.

## 3. VibeSchool Must Answer the Question Behind the Search

A literal query is often only a proxy for a decision problem.

Examples:

- “best STEM schools” may mean “where can my child realistically pursue this direction?”
- “pathway for medicine” may mean “what should my child choose now to keep medicine possible?”
- “what is STEM?” may mean “is STEM appropriate for me?”
- “school X” may mean “does this school offer what I need?”
- “my child is poor in maths” may mean “have they already lost the option they want?”

The system should answer the literal factual question accurately and then expose the likely useful next action without pretending to know private intent it has not been given.

## 4. Universal Ask VibeSchool Direction

Pathways should evaluate a prominent natural-language entry surface such as **Ask VibeSchool**.

Example user questions:

- Which schools in Nakuru offer my combination?
- Which pathway should I choose if I want to become a doctor?
- My child does not know what pathway to choose.
- What is STEM?
- Which subjects lead toward engineering?
- Does this school offer my preferred combination?
- I do not know where to start.

### Architectural constraint

**Ask VibeSchool is not an unconstrained LLM oracle.**

The answer architecture should be:

**intent/question → canonical entity/relationship retrieval → authoritative/verified evidence → governed recommendation logic where needed → audience/language presentation → action.**

Generative AI may help interpret language or present an explanation, but it must not become the source of educational truth when canonical evidence exists or is required.

If evidence is missing, conflicting or stale, the answer must communicate that state rather than invent an answer.

## 5. Multiple Entry Doors, One Knowledge System

Pathways must not have one compulsory beginning.

A user may begin from:

### “I know myself”
**Help me find my pathway.**

### “I know my career”
**I want to become a doctor/pilot/engineer/etc.**

### “I know my subjects”
**Where can these subjects take me?**

### “I know the school”
**What does this school offer?**

### “I know the pathway”
**Help me understand/explore STEM, Social Sciences, Arts/Sports, etc.**

### “I know my location”
**What relevant schools/options are available around this area?**

### “I know the question”
**Ask VibeSchool.**

### “I know nothing”
**Guide me.**

All of these should resolve into the same canonical education knowledge graph and recommendation/navigation system. Do not build separate contradictory mini-engines for each entry point.

## 6. Answer Architecture: Quick → Action → Understand → Verify

A canonical answer should support increasing depth.

### Quick

Give the shortest accurate useful answer.

### Action

Expose one primary next action and a small number of relevant secondary actions.

Examples:
- Check my subjects
- Find schools
- Explore careers
- Compare pathways
- Check my situation
- Improve my guidance

### Understand

Provide a short explanation: **Why?** / **Why this answer?**

### Verify

Expose evidence, official sources, provenance, effective dates, uncertainty and update history where appropriate.

This allows a low-patience user and an expert researcher to use the same underlying product without forcing either into the other's experience.

## 7. Every Important Answer Should Lead to Action

Product law:

> **No important guidance answer should end as a dead informational page when there is a legitimate next action VibeSchool can offer.**

Examples:

**What is STEM?** → Explore STEM careers / check whether it fits me.

**Which pathway fits me?** → Quick discovery / improve evidence.

**Subjects for a career?** → Check my subjects / see related combinations.

**Schools offering a combination?** → Filter/compare schools.

**I am confused.** → Guided discovery.

**I need help.** → governed human support when available.

Do not manufacture actions merely for engagement. The action must advance the user's educational decision.

## 8. Search Pages Should Be Tools, Not SEO Articles

The #1 discoverability mission must not produce a library of long articles that rank but fail to solve the user's problem.

Where the query is structured, the public page should behave like a useful mini-application.

Example pattern for a school/subject query:

**Schools offering [verified subject/combination]**

- immediately show verified results when available;
- allow useful filters such as county and applicable school attributes;
- show source/freshness information;
- provide meaningful school details;
- expose related pathway/subject context;
- then offer a personalized CTA such as **Not sure whether this fits you? Check your pathway.**

Counts and availability must always come from actual canonical data. Never use invented demonstration counts in production content.

Search intent should land on the answer, not force the visitor through the generic Pathways homepage.

## 9. Social/Short-Form Information Model

VibeSchool should learn from why short-form content works without reproducing its weaknesses.

Useful characteristics to adopt:

- immediate orientation;
- plain language;
- one idea at a time;
- visual/voice explanation where useful;
- question-led content;
- practical examples;
- strong next action;
- human comprehensibility.

Characteristics not to adopt:

- engagement bait;
- unsupported certainty;
- misinformation for virality;
- sensational career claims;
- opaque recommendation logic;
- infinite scrolling as the product objective;
- popularity as a substitute for educational truth.

## 10. Listen and Voice Direction

Reading must not be the only route to understanding.

Pathways should evaluate **Listen** on important explanations and results.

Potential progression:

1. concise text-first answer;
2. optional English audio;
3. optional Kiswahili audio;
4. later, voice input for natural questions where quality/safety is sufficient.

Example intent:

A parent should eventually be able to ask a natural spoken question in English or Kiswahili and receive an evidence-grounded explanation rather than needing to understand VibeSchool's menu structure.

Voice is a presentation/input layer over the same canonical truth system. It must not create a separate factual engine.

## 11. Personalized “What Should I Do?” Layer

The long-term experience should move from generic information toward a next-action navigator.

For an anonymous visitor, this may be a simple contextual action.

For an authenticated learner with authorized evidence, it can become increasingly specific:

- check a missing subject requirement;
- compare two pathway directions;
- review schools offering an adopted combination;
- add recent evidence to improve guidance;
- take a relevant learning action;
- revisit a decision when authoritative information changes.

The product should not overwhelm users with a long task list. Prefer the **next useful action**.

## 12. Human Assistance Is the Last-Mile Layer

Technology should not pretend to resolve every situation.

When governed teacher assistance exists, the model is:

**free authoritative guidance → personalized navigation → optional verified professional interpretation.**

With appropriate consent and privacy controls, the professional should receive enough context to avoid making the family repeat the entire journey.

Human assistance is especially relevant when:

- evidence conflicts;
- the learner/parent remains uncertain;
- a nuanced trade-off requires discussion;
- official rules are unclear for the user's situation;
- the user explicitly wants professional review.

Payment does not buy educational truth or recommendation influence.

## 13. Distribution System

VibeSchool should not depend on one discovery channel.

The same canonical knowledge and decision engine can be surfaced through:

### Search engines
Public answer/tool pages for high-intent queries.

### AI assistants / answer engines
Crawlable, structured, provenance-backed public knowledge capable of being cited or surfaced.

### TikTok / short-form social
Short problem-led explanations whose CTA leads to the relevant VibeSchool tool or answer, not merely a homepage.

### YouTube
Deeper education/explanation and demonstrations linked to actionable VibeSchool surfaces.

### WhatsApp
Privacy-safe referral links and useful share objects.

### Teachers
Trusted QR/link/class guidance distribution.

### Schools
Verified institutional discovery and appropriate guidance distribution.

### Parents and learners
Organic referrals based on actual utility.

Distribution content may vary by channel, but educational truth should resolve to the same canonical evidence system.

## 14. Channel-to-Product Continuity

A user should not lose their question when moving from a discovery channel into VibeSchool.

Examples:

- Google query about schools → relevant school/combination results page;
- AI citation → evidence/source page behind the answer;
- TikTok video about medicine → medicine-to-pathway explorer;
- teacher QR → guided pathway start/referral context;
- WhatsApp share → privacy-safe relevant public surface.

Avoid generic “link in bio → homepage → find the thing again” funnels where a deeper relevant route is safe and available.

## 15. The Trust Combination

The intended competitive combination is:

> **Fast enough for short-form behavior.**  
> **Discoverable enough for search.**  
> **Structured enough for AI systems.**  
> **Evidence-backed enough to verify.**  
> **Simple enough for low-literacy/low-patience users.**  
> **Deep enough for teachers and research-oriented parents.**  
> **Personalized enough to matter.**  
> **Actionable enough to return to.**

No single characteristic is sufficient.

## 16. Product Vision Clarification

The broader product vision is:

> **VibeSchool becomes the place Kenyans go when they do not know what educational decision to make next.**

For this Pathways mission, that means VibeSchool is not merely:

- a pathway quiz;
- a static career website;
- a school directory;
- a government-data mirror;
- a chatbot;
- an SEO content farm;
- or a teacher marketplace.

It is an **education decision and navigation system** built on authoritative evidence.

## 17. Canonical End-to-End Model

**DISCOVER / ASK**  
User arrives from search, AI, social, WhatsApp, teacher, school, referral or direct visit.

↓

**ANSWER / ORIENT**  
Give immediate useful information in accessible language.

↓

**UNDERSTAND**  
Explain what the answer means.

↓

**VERIFY**  
Evidence, provenance, official source, date and uncertainty are available.

↓

**PERSONALIZE**  
Offer “what does this mean for me?” without requiring unnecessary data.

↓

**ACT**  
Pathway, subjects, school, career, learning or official next step.

↓

**SIGN IN FOR CONTINUITY**  
After value is demonstrated, offer free persistence and Pathway Passport.

↓

**RETURN**  
Show persistent pathway state and next useful action rather than reacquisition UX.

↓

**HUMAN HELP WHEN NEEDED**  
Optional governed teacher/professional assistance.

↓

**LONGITUDINAL NAVIGATION**  
The learner's evidence and decisions can evolve over time under the constitutions.

## 18. What Future Agents Must Not Misinterpret

This document does **not** authorize the following shortcuts:

- “Build a ChatGPT clone for education.”
- “Use an LLM to answer everything.”
- “Publish thousands of keyword pages.”
- “Make TikTok-style infinite scrolling.”
- “Force sign-up before answering.”
- “Replace official sources with VibeSchool opinion.”
- “Use a teacher marketplace as the primary product.”
- “Add voice before the canonical truth system is trustworthy.”
- “Invent school counts, eligibility or recommendations to fill missing data.”

The moat is the connected system:

**canonical national knowledge + provenance + decision/recommendation logic + understandable presentation + personalized action + persistent learner context + trusted human support + distribution authority.**

## 19. Acceptance Questions for Implementation

Before a surface is considered aligned, ask:

1. Can the intended user understand the answer quickly?
2. Does the page answer the query they actually arrived with?
3. Is there an appropriate next action?
4. Can a user inspect why the answer is true/recommended?
5. Is official fact distinguishable from VibeSchool guidance?
6. Does personalization use only appropriate authorized evidence?
7. Does the experience work without long reading?
8. Can a detail-oriented user go deeper?
9. Is the public surface crawlable/indexable where intended?
10. Can the same canonical truth serve search, AI, social and in-product use?
11. Does moving between channels preserve relevant context safely?
12. Does the experience earn sign-in rather than demand it?
13. Does it fail honestly when evidence is insufficient?
14. Is the next action educationally useful rather than engagement bait?

## 20. Relationship to the Existing Mission

This model does not replace the existing Pathways strategy documents. It explains the product behavior that connects them:

- the **customer-acquisition strategy** explains why free Pathways is the front door;
- the **experience specification** governs placement and continuity;
- the **action-first/trust specification** governs comprehension and progressive depth;
- the **national authority/discoverability mission** governs #1 search/AI ambition and public knowledge;
- the **seven constitutions** govern humans, truth, recommendation, safety, discovery, commerce and operations;
- this document explains how those parts become one user-facing **Ask → Understand → Act** decision system;
- the **execution handoff** determines implementation order.

Future agents must reconcile all of them together before coding.

## 21. Promotion Rule

This product model is part of the complete Pathways mission contract.

It does not justify merging documentation or partial features to `main`.

The branch remains isolated until the complete agreed mission is implemented, adversarially tested and certified according to the Mission Documentation Index and execution handoff.