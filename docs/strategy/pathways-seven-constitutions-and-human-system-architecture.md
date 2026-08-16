# VibeSchool Pathways — Human System Architecture & Seven Constitutions

**Status:** Governing mission contract; implementation pending.  
**Branch:** `agent/pathways-customer-acquisition-strategy`  
**Promotion:** Must not merge to `main` until the complete Pathways acquisition mission is implemented and certified.

## 1. Product Reframing

VibeSchool Pathways is not merely a pathway-selection quiz.

> **VibeSchool Pathways is intended to become Kenya's education decision and navigation system: a trusted independent layer that helps a person enter from a learner, career, subject, school, pathway, location or question; understand authoritative facts; explore options; make an informed decision; take a useful next action; and return as evidence or circumstances change.**

The current official Ministry platform already supports pathway, subject-combination and senior-school selection and describes its purpose as helping Grade 9 learners align selections with talents, interests and aspirations. VibeSchool must complement—not impersonate or replace—the official selection/placement authority.

## 2. Human Profiles Matrix

Do not design for a single generic learner, parent, teacher or school. Model the state in which the person arrives.

### Learners

Representative states include:
- confident/decided;
- confused/undecided;
- low current academic performance;
- high-performing/research-oriented;
- low reading patience;
- low educational-system knowledge;
- highly digitally capable but pathway-naive;
- impatient/30–60-second visitor;
- deep explorer;
- peer-influenced;
- parent-influenced;
- career-decided;
- school-decided;
- shared/no personal device;
- returning learner with existing pathway evidence.

The system must preserve agency. It must not communicate that a learner is permanently unsuitable for a field based only on current performance.

### Parents/caregivers

Representative states include:
- urgent “tell me what to do” parent;
- anxious parent afraid of a wrong decision;
- evidence-seeking/skeptical parent;
- low-digital-confidence parent;
- low educational-system knowledge;
- highly informed research parent;
- cost-sensitive parent;
- prestige-focused parent;
- parent with incomplete learner information;
- parent and learner who disagree;
- parent supporting multiple children on one device.

Parent UX must help support the learner rather than take ownership of the learner's aspirations.

### Teachers

Representative states include:
- guidance-oriented teacher;
- busy class teacher;
- career/counselling teacher;
- subject specialist;
- low-digital-confidence teacher;
- power user/researcher;
- teacher assisting one learner;
- teacher assisting a cohort/class;
- future verified paid-assistance provider.

Teachers can be major distribution and trust participants, but professional status does not permit arbitrary alteration of official facts or learner evidence.

### Schools

School users may need to:
- understand how VibeSchool represents them;
- verify identity;
- see sourced pathways/combinations;
- report incorrect information;
- submit evidence for correction;
- manage permitted school-supplied information;
- understand learner demand in privacy-safe aggregate form later.

A school cannot purchase or self-edit its way into factual eligibility or pathway recommendations.

## 3. Adaptive Experience Dimensions

Every important journey should be evaluated across four dimensions:

**WHO** — learner / parent / teacher / school.  
**STATE** — confused / decided / researching / urgent / returning / assisting.  
**CAPABILITY** — literacy / language / digital confidence / educational knowledge / attention / device / connectivity / access to records.  
**TRUST & PATIENCE** — low→high trust and roughly 10 seconds→60 seconds→3 minutes→deep exploration.

Design standard:

> **The core experience should work for the least patient and least informed appropriate user without frustrating the sophisticated user who wants evidence and depth.**

## 4. Multiple Entry Doors

Pathways must not have only one beginning.

Possible entry intents:
- I don't know my pathway;
- I know the career I want;
- I know my subjects;
- I am looking for a school;
- compare two pathways;
- help my child;
- help a learner;
- a specific Google/search question;
- a specific AI citation/referral;
- a teacher/school QR or referral.

All should converge on the same canonical knowledge/guidance system rather than disconnected mini-products.

Search users should land on the answer to their query, not be forced through a generic assessment first. AI-referred users should be able to see the evidence/source behind the answer they followed.

## 5. Time-Adaptive Value

Design useful layers for:
- **~10 seconds:** orientation/answer/next action;
- **~60 seconds:** useful early pathway indication where appropriate;
- **~3 minutes:** stronger guidance from additional evidence;
- **deep exploration:** comparisons, schools, careers, sources and scenarios;
- **return later:** persistent Pathway Passport and next actions.

Longer engagement should improve value; short engagement must not be useless.

## 6. Decision Psychology

Pathways must explicitly account for:
- fear of making the wrong choice;
- marks anxiety;
- parental pressure;
- peer pressure;
- teacher influence;
- prestige bias toward particular pathways/schools;
- confirmation bias;
- career misconceptions;
- indecision;
- overconfidence;
- fear that changing direction equals failure.

Use language such as “current evidence points toward” and “what would keep this option open” rather than permanent labels.

## 7. Household and Assisted-Use Architecture

One device may serve multiple learners. A teacher may help a class. A parent may help multiple children. Therefore:
- anonymous/session evidence must have explicit boundaries;
- one learner's answers must not leak into another's pathway;
- account adoption must identify which pathway session is being adopted;
- assisted sessions must not accidentally grant the assistant ownership of learner data;
- shared-device sign-out/session switching must be designed explicitly.

## 8. Trust Progression

Treat trust as earned progressively:

**T0:** unknown service → provide useful public value without sensitive data.  
**T1:** useful exploration → allow anonymous interaction.  
**T2:** result makes sense → offer free save/continuity.  
**T3:** user chooses deeper personalization → request additional evidence with purpose explained.  
**T4:** ongoing relationship → persistent learner journey, governed connections and deeper services.

Do not collect data merely because the user is available.

---

# Constitution I — Human Experience

## 9. Human Experience Constitution

1. Action first, depth on demand.
2. One obvious primary action per major screen.
3. Meaning before educational jargon.
4. Respectful universal UX; never stigmatize users by literacy/education level.
5. `Not sure`/skip is legitimate where uncertainty is real.
6. Mobile Android and variable connectivity are primary design conditions.
7. Accessibility includes visual, motor, cognitive, reading and language needs.
8. Deep users can inspect evidence without forcing depth on everyone.
9. Different audiences receive different framing from the same truth.
10. Users retain agency over consequential decisions.

## 10. Language and Audio

Plan for plain English first-class content and high-quality Kiswahili presentation where implemented. Preserve canonical official terminology while explaining it plainly. Audio/listen capability may later support users who prefer listening, but must not become an excuse for inaccessible text.

## 11. Emotional Safety

Avoid shame-based messaging around marks, school status or uncertainty. A weak current signal should produce improvement/navigation guidance where possible, not a permanent identity judgment.

---

# Constitution II — Educational Truth

## 12. Truth Hierarchy

For consequential pathway facts, preserve a hierarchy such as:

**Authoritative official evidence → verified institutional evidence within its legitimate scope → learner-authorized evidence → verified professional guidance → VibeSchool inference/recommendation.**

This hierarchy is contextual: a learner remains authoritative about their own preferences; a school may be authoritative about some current operational details but cannot override official classifications without evidence.

## 13. Temporal Truth

Every consequential rule/fact should support, where applicable:
- cohort;
- effective-from/effective-to;
- observed/retrieved date;
- source version/document;
- supersession state;
- provenance/confidence.

Do not model educational truth as only `current=true`.

## 14. Eligibility vs Suitability vs Aspiration

Keep separate:
- **Aspiration:** what the learner wants;
- **Suitability guidance:** what current interests/evidence suggest;
- **Eligibility:** what authoritative rules currently permit/require;
- **Opportunity/improvement:** what actions may keep or strengthen an option.

Never turn current ineligibility or weak evidence into “you can never become X.”

## 15. National School Identity

School truth requires canonical identity, official identifiers where appropriate/public, aliases/name changes, location hierarchy, duplicate protection, institution type/classification history, pathways/combinations evidence, source history and correction history.

## 16. Citation Chain

A user or auditor should be able to traverse:

**Guidance → reason → underlying fact/relationship → evidence → authoritative source.**

---

# Constitution III — Recommendation

## 17. Recommendation Constitution

Before implementation freezes an algorithm, define:
- permitted evidence;
- prohibited/unsafe evidence;
- evidence weighting principles;
- missing-evidence behavior;
- uncertainty thresholds;
- tie/near-tie handling;
- eligibility constraints;
- recommendation versioning;
- human review boundaries;
- audit/reconstruction requirements;
- rollback behavior.

## 18. Fairness

Adversarially test for inappropriate effects involving gender, geography, school type, socioeconomic proxies, disability-related circumstances and current academic performance.

Do not encode stereotypes such as certain careers/pathways being naturally male/female or automatically restrict lower-income learners to cheaper/lower-status options.

## 19. Counterfactual Guidance

A major product capability should eventually answer:

> **What would I need to do to keep or strengthen this option?**

Examples can connect career aspiration → official requirements → current evidence → missing evidence → practical next actions.

## 20. Reversibility and History

Support:

**Explore → shortlist → compare → adopt → reconsider → update.**

Do not silently overwrite adopted pathways or historical guidance. Preserve meaningful version/history so changes can be understood.

## 21. Scenario Exploration

“What if?” scenarios must be non-destructive unless the user explicitly adopts a resulting change.

---

# Constitution IV — Safety & Privacy

## 22. Consent Lifecycle

Design explicitly for minors and changing relationships:
- who supplied each class of information;
- who can view it;
- parent/caregiver relationship verification where needed;
- learner agency appropriate to age/policy;
- permission expiry/change;
- export/deletion/correction rights as applicable;
- transition as learner ages;
- safe sharing defaults.

## 23. Shared Device and Session Safety

Private pathway state must not become public/searchable, leak across users, remain exposed after unsafe session transitions or appear in guessable URLs.

## 24. Safeguarding Boundary

Pathways is educational guidance, not a universal counselling/crisis service. Define escalation/boundary behavior for disclosures outside the product's competence and for interactions with future human assistance.

## 25. Abuse/Fraud Threats

Model at least:
- school impersonation;
- fake corrections/evidence;
- teacher credential fraud;
- referral abuse;
- account farming;
- payment fraud later;
- deliberate answer manipulation;
- scraping/automated abuse;
- fabricated reviews/testimonials;
- commercial attempts to influence recommendation truth.

---

# Constitution V — Discovery & Authority

## 26. Discovery Constitution

The explicit strategic objective remains #1 organic discoverability across a maintained Kenyan pathway-intent benchmark and leading independent-source surfacing in AI answers.

Ranking goals never justify falsehood, thin programmatic pages, hidden text, fake reviews, fabricated structured data or misleading official affiliation.

## 27. Search Entry UX

Search intent pages answer the searched question first, then connect to pathway discovery. Examples include school-by-combination, career-to-pathway, pathway comparison and policy explanations.

## 28. AI/Agent Consumption

Public knowledge should be semantically clear, crawlable, attributable and stable enough for legitimate machine use. Private learner evidence must remain outside public machine-readable surfaces.

## 29. Programmatic Quality Threshold

Do not index a generated page unless it has sufficient verified data and independent user value. National scale must not become national-scale spam.

---

# Constitution VI — Commercial

## 30. Commercial Constitution

> **Money may influence service placement; money must never influence educational truth.**

The core pathway discovery/guidance remains free under the current acquisition mission. Future paid teacher assistance, school services or advertising must be visibly separated from canonical facts and learner-first recommendations.

## 31. Teacher Marketplace Governance

Before paid assistance activates, define teacher verification, scope, safeguarding, quality standards, response SLAs, reputation, complaints, suspension, payment/payout, refund/dispute and evidence-access boundaries.

## 32. School Commercial Boundary

Sponsored/commercial school placement, if ever introduced, must be clearly labeled and must not silently alter pathway fit, eligibility or factual school-offering data.

---

# Constitution VII — Operations

## 33. Freshness and Policy Change

A source/policy change should be able to trigger:

**Detect → ingest evidence → compare → classify affected facts/relationships → governed review → update canonical truth → identify affected recommendations/pages/profiles → regenerate/recalculate as appropriate → preserve history → verify.**

## 34. Correction Network

Support a governed loop:

**Report error → collect evidence → triage → verify → correct → identify affected surfaces/results → propagate → retain correction history.**

Users should be able to challenge VibeSchool. Trust includes the ability to correct us.

## 35. Incident Response and Rollback

Plan for consequential bad data/recommendation releases:
- identify defective knowledge/rule/model version;
- determine affected pages/recommendations/users where appropriate;
- stop propagation;
- restore last known safe version where possible;
- issue correction/update messaging where necessary;
- retain incident evidence;
- prevent recurrence.

## 36. Recommendation Observability

For a consequential result, operators should eventually reconstruct:

**input evidence/version → knowledge graph/version → policy/rules/version → recommendation engine/version → result → confidence/uncertainty → user-visible explanation → subsequent user action.**

## 37. Experiment Governance

Every meaningful experiment should define owner, hypothesis, population, start/end, success/guardrail metrics and rollback.

Do not casually experiment with factual truth, safeguarding standards, privacy rights or manipulative dark patterns.

## 38. Performance and Offline/Resume

Define measurable performance budgets during implementation. Offline/resumable behavior needs explicit local-state, synchronization, expiry and conflict rules; “works offline” is not a sufficient contract.

---

## 39. Geospatial and Practical Reality

Future school guidance may consider county, distance, day/boarding, transport practicality, accessibility and other legitimate constraints where data is reliable. Never expose a child's precise location publicly.

Cost information may help families understand options where reliable, but financial circumstances must not become a mechanism for steering poorer learners away from ambitious pathways.

## 40. Opportunity and Progression Intelligence

Long-term knowledge should connect pathways to tertiary/TVET/professional progression and careers using current, sourced requirements. Career-market claims are time-sensitive and must be sourced/versioned rather than presented as permanent truth.

## 41. Decision Quality, Not Only Conversion

Long-term success metrics should go beyond registrations:
- did users understand their options?
- did they take a meaningful next action?
- did guidance remain accurate/current?
- did they return when circumstances changed?
- did the recommendation help rather than confuse?
- where ethically/operationally measurable, did later outcomes validate or challenge the guidance?

Do not optimize conversion by reducing decision quality.

## 42. Longitudinal Pathway Passport

The Pathway Passport should preserve evolving interests, evidence, adopted direction, changes, next actions and meaningful history. Define evidence expiry and user control; old evidence should not silently dominate a future decision forever.

## 43. Institutional Defensibility / Moat

The defensible system is not the screen design. It is the combination of:

**national verified knowledge graph + provenance/version history + canonical school identity graph + pathway decision engine + learner longitudinal evidence + trusted teacher network + correction/freshness engine + search/AI authority + operational auditability.**

## 44. National Rollout Sequence

Default sequencing, subject to P0 audit findings:

1. authoritative data/identity/provenance foundation;
2. public search knowledge surfaces;
3. quick discovery/action-first experience;
4. authentication continuity/state adoption;
5. Pathway Passport;
6. school/combination navigation;
7. career/progression navigation;
8. parent experience;
9. teacher distribution/assisted workflows;
10. governed paid assistance marketplace;
11. deeper school ecosystem/commercial services.

Do not activate later commercial/network layers before the truth, safety and operational foundations they depend on.

## 45. Mission-Level Acceptance Questions

Before promotion, the programme must be able to answer with evidence:
- Can an impatient learner get useful value quickly?
- Can a low-literacy or low-digital-confidence user act without long reading?
- Can a sophisticated user inspect evidence and official sources?
- Can a parent support without taking over the learner's voice?
- Can a teacher assist one learner or eventually a cohort safely?
- Can a school challenge incorrect information without self-authorizing truth?
- Can shared devices keep learner states separated?
- Can official fact, learner evidence and VibeSchool guidance be distinguished?
- Can eligibility, suitability and aspiration be distinguished?
- Can uncertainty be shown honestly?
- Can recommendation bias be adversarially tested?
- Can a recommendation be reconstructed and rolled back by version?
- Can policy changes identify affected surfaces?
- Can incorrect information be reported and corrected?
- Can public knowledge rank without exposing private learner data?
- Can commercial services operate without influencing educational truth?
- Can the system remain useful on ordinary phones and weak connectivity?
- Can another engineer/agent determine what is implemented versus merely planned?

## 46. Promotion Rule

These constitutions are mission constraints, not optional ideas.

The branch remains isolated:

**inspect real implementation → reconcile with constitutions → decompose into implementation gates → implement → adversarially test → user-test → security/privacy/fairness review → technical certification → mission certification → only then consider merge.**

Documentation itself does not satisfy the mission.