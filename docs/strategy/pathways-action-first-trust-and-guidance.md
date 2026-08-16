# VibeSchool Pathways — Action-First, Trust and Progressive Guidance Contract

**Status:** Product/UX mission contract; implementation pending audit and certification.  
**Branch:** `agent/pathways-customer-acquisition-strategy`  
**Companions:** `pathways-customer-acquisition.md`, `pathways-experience-specification.md`, `pathways-national-authority-and-discoverability.md`, `pathways-acquisition-execution-handoff.md`

## 1. Product Promise

> **Give VibeSchool a short amount of time and leave knowing something useful about your educational direction — even if you never create an account.**

The core experience is **action-first and depth-on-demand**.

A user must be able to complete the core Pathways journey without reading long-form explanations. Every important decision surface should prioritize:

**Action → simple explanation → optional detail → evidence/source depth.**

This serves users with different literacy, education, attention, language and information needs without labeling or stigmatizing them.

## 2. Experience Objective

Optimize simultaneously for:

1. **Little time** — useful value quickly.
2. **Low cognitive load** — obvious choices and next actions.
3. **Trust** — visible reasoning, evidence and uncertainty.
4. **Depth when wanted** — informed users can inspect details and sources.
5. **Actionability** — results lead to schools, subjects, careers or next steps rather than a static report.

Do not optimize for assessment length, text volume or account creation alone.

## 3. Three-Depth Information Pattern

Every major result/information surface should support three depths.

### Depth 1 — Act

Immediate answer and obvious CTA.

Example intent:

**STEM looks strongest for you**

`See schools` / `Check subjects` / primary context-specific action.

### Depth 2 — Understand

Short plain-language explanation accessible through a secondary interaction such as **Why?** or **Why this result?**

### Depth 3 — Verify / explore deeply

Detailed evidence, official relationships, caveats, provenance, update dates and source history for users who need them.

Deep information must exist without forcing every user to consume it.

## 4. Interaction-First Discovery

Pathways should feel like doing rather than reading.

Prefer:

**Tap → choose → compare → see insight → act.**

Avoid long paragraphs between every decision.

Question design should:
- use one clear idea at a time;
- use concise answer choices;
- support recognizable icons/visual cues where they genuinely aid comprehension;
- retain visible text for accessibility and clarity;
- make the selected state obvious;
- permit back/edit where safe;
- avoid educational jargon in the question itself;
- offer `Not sure`, `I don't know`, `I haven't studied this` or `Skip` where forcing an answer would create false evidence.

## 5. Short Quick-Check Concept

Pathways should evaluate a **roughly 60-second quick discovery mode** using a small number of high-information questions.

The quick check should produce an **early indication**, not pretend to be a comprehensive assessment.

Example result structure:

- strongest direction so far;
- 2–3 strongest supporting signals;
- meaningful alternative if evidence supports one;
- explicit evidence/completeness state;
- one action to improve the recommendation.

Do not present unsupported numerical match precision.

The exact number of questions and duration must be validated through user testing rather than frozen from this document.

## 6. Progressive Evidence Investment

Do not require all possible information upfront.

Allow users to improve guidance progressively, for example:

**Initial interests → subject preferences → recent performance → career interests/goals → additional verified learner evidence.**

Each additional step must explain the benefit before asking for more effort.

Example intent:

**Improve my recommendation**

Then show a short action such as adding subjects or recent performance.

The system should visibly distinguish evidence completeness from recommendation certainty.

## 7. Micro-Value During Discovery

The journey should not be a black box that withholds all value until the last screen.

Where evidence is sufficient and doing so does not bias subsequent answers, provide short, carefully worded insights during the journey, such as:

- an emerging interest pattern;
- two directions currently worth exploring;
- an indication that more information is needed to distinguish them.

Do not reveal intermediate conclusions in ways that cause users to game later answers. Product testing should determine where micro-insights improve trust without corrupting evidence quality.

## 8. Result Is an Action Hub, Not a Report

The primary result experience should not be a long report.

After the recommendation, prioritize actions such as:

- **Find schools**
- **Check subjects**
- **Explore careers**
- **Improve my result**
- **Understand my result**
- **Ask for help** (only when governed assistance exists)

Detailed narrative belongs behind progressive disclosure.

## 9. Visual Result Hierarchy

Where comparison is meaningful, users should be able to see the relative strength of directions quickly.

Use understandable labels such as:

- Strongest direction
- Worth exploring
- Not enough evidence yet

Do not use visual bars or percentages that imply mathematical precision the recommendation model cannot justify.

Color must never be the only signal.

## 10. Trust Architecture

Trust is demonstrated, not claimed.

Never rely on phrases such as “advanced AI determined this” as proof of quality.

The user should be able to see:
- what information they supplied;
- which signals supported the recommendation;
- what information is missing;
- what could change the guidance;
- what is official fact;
- what is VibeSchool interpretation/guidance;
- source/update information for consequential official claims.

### Three-source distinction

The UI should distinguish:

**Official information** — sourced Ministry/KICD/KNEC or other authoritative facts.

**Your information** — answers, preferences, results and goals supplied/authorized for this learner.

**VibeSchool guidance** — interpretation/recommendation generated from the evidence.

Never blend these categories in a way that makes VibeSchool guidance look like an official government placement decision.

## 11. Honest Uncertainty

The system must be allowed to say:

- “We need more information.”
- “Two directions are currently close.”
- “This is an early indication.”
- “Adding recent results may change this guidance.”

Do not manufacture certainty to make the product feel impressive.

When two directions are genuinely close, offer a small next action to distinguish them rather than forcing a winner.

## 12. Insight and Surprise

When supported by evidence, the result may highlight a useful non-obvious relationship, for example an interest in business combined with strong technology/problem-solving signals.

These insights should help exploration, not sensationalize or contradict evidence for engagement.

## 13. “What If?” Exploration

After a user has a result, Pathways should eventually support scenario exploration such as:

- What if my Mathematics improves?
- What if I want a particular career?
- What if I prefer day school?
- What if a preferred school does not offer my combination?
- What if I change my mind?

“What if?” interactions should explain consequences using the canonical knowledge/evidence model and must not silently alter the learner's adopted pathway.

## 14. Journey Map Beyond the Recommendation

A pathway result should open a navigable decision journey:

**Learner → likely direction → pathway/track → subject combinations → schools → careers/progression → next learner action.**

The user does not need to view every layer. Each layer is available when relevant.

## 15. Audience-Specific Presentation

The underlying evidence/knowledge can be shared, but presentation differs by user need.

### Learner

Primary framing: **Explore what fits me and what I can do next.**

### Parent

Primary framing: **Help me understand and support my child's options.**

Useful parent actions may include short discussion prompts, questions to ask the learner and concrete next steps.

### Teacher

Primary framing: **Help a learner explore using evidence.**

Teachers are trusted support participants, not owners of the learner's pathway decision.

Do not simply duplicate the learner UI for parents and teachers.

## 16. Human Guidance / Teacher Trust Layer

Future optional teacher assistance can strengthen trust when implemented safely.

The model is:

**Official evidence + learner evidence + VibeSchool guidance + optional verified human professional review.**

A teacher should review evidence/guidance, not overwrite canonical facts or gain authority merely because payment occurred.

Paid assistance must remain optional and downstream of the free core.

## 17. Pathway Passport

After authentication, evaluate a persistent **Pathway Passport** as the learner's living decision asset.

Potential components:
- current/adopted direction;
- interests/strength signals;
- subjects;
- career interests;
- school possibilities;
- evidence completeness;
- last reviewed/updated state;
- next action;
- history/superseded guidance where appropriate.

The Passport should evolve as evidence changes without silently rewriting the learner's history or choices.

This provides a concrete reason to sign in and return: **“I want VibeSchool to remember and continue helping me.”**

## 18. Authentication Psychology

The relationship should be:

**Help first → demonstrate usefulness → establish trust → offer continuity → sign in free.**

Not:

**Give us your personal details → maybe receive value later.**

Preferred acquisition intent remains **Save my pathway and continue** or equivalent user-tested wording.

## 19. Literacy and Jargon Contract

Never assume the user understands CBC/CBE policy terminology.

Introduce meaning before jargon. For example, explain what a pathway helps determine before asking someone to select a “pathway.”

Rules:
- short sentences on action-critical screens;
- common words where possible;
- define unavoidable official terms;
- no “simple mode for uneducated users” or stigmatizing segmentation;
- same respectful core UX for everyone;
- depth is chosen by the user through progressive disclosure.

## 20. Audio and Language Direction

Audio can later improve access for users who prefer listening or have reading barriers.

Potential behavior:
- `Listen` on important explanations/results;
- English and Kiswahili as priority language directions subject to content/translation quality;
- audio must not become a P0 dependency unless evidence requires it;
- text remains available for accessibility, search and verification.

Translation changes presentation, not canonical truth.

## 21. Ten-Second Comprehension Test

Every major screen should allow a user to understand within roughly ten seconds:

1. **What is this?**
2. **What should I do?**
3. **What happens next?**

This is a design review heuristic, not a fabricated analytics guarantee.

If the primary action requires reading several paragraphs to understand, redesign the screen.

## 22. Low-Literacy / Low-Attention Acceptance Gates

Before mission certification, test with representative users rather than assuming designer comprehension equals user comprehension.

Evidence should show:
- [ ] core journey can be completed without reading long-form content;
- [ ] primary action is recognizable quickly;
- [ ] jargon is explained or avoided;
- [ ] users can safely choose `Not sure`/skip where applicable;
- [ ] detailed users can reach evidence/sources without cluttering the primary journey;
- [ ] result immediately offers useful actions;
- [ ] recommendation uncertainty is understandable;
- [ ] official fact vs VibeSchool guidance is distinguishable;
- [ ] parent and learner framing are understandable to their audiences;
- [ ] mobile interaction works comfortably on ordinary Android devices;
- [ ] slow-network behavior does not destroy progress;
- [ ] accessibility review passes;
- [ ] user testing includes people with varied digital familiarity and educational backgrounds.

## 23. Product Success Signal

The desired emotional/product outcome is not “the user finished our questionnaire.”

It is:

> **The user quickly learned something useful, understood what to do next, trusted why VibeSchool suggested it, and saw enough continuing value to want VibeSchool to remember their journey.**

## 24. Promotion Rule

This document is part of the Pathways mission contract. The mission branch remains isolated and must not merge into `main` merely because these designs are documented.

The relevant behaviors must be audited against the real application, implemented, tested with representative users, adversarially reviewed and certified as part of the full mission before promotion is considered.