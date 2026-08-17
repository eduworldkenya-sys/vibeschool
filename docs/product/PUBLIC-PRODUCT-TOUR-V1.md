# Public Product Tour V1

Status: implementation contract  
Date: 2026-08-17

## Objective

Add a lightweight homepage product tour that demonstrates how one educational journey moves through VibeSchool without creating a fake live application or exposing production data.

Working public title:

> **See one lesson become learning**
>
> Follow a VibeSchool journey from curriculum planning to learner progress.

## Why

The public site now explains VibeSchool's connected product thesis. The remaining credibility gap is product proof: visitors should be able to see how planning, classroom activity, learner work, assessment and progress connect.

## V1 journey

1. **Plan** — curriculum, scheme and lesson preparation.
2. **Teach** — teaching occurrence, classroom activity and attendance/evidence context.
3. **Learn** — learner receives and completes appropriate learning work.
4. **Assess** — evidence/submission is reviewed and assessed.
5. **Understand** — progress/mastery context changes based on evidence.
6. **Support** — next action and appropriate family context become visible.

## Implementation boundary

V1 is deliberately lightweight:

- one reusable `ProductTour` component;
- six steps;
- next/previous and direct-step navigation;
- keyboard and mobile accessible;
- progressive enhancement only;
- homepage integration;
- real certified VibeSchool screens when available;
- safe demonstration data only;
- no production learner or school data;
- no simulated backend;
- no fake customer evidence;
- no pricing changes;
- no Supabase production mutation.

## Screenshot/evidence rule

A screenshot may be added only when the represented application state is known to exist and has been safely captured with non-sensitive demonstration data. Until a screen is certified, the tour may use a clearly labelled product-state placeholder describing what will be shown; it must never imitate a real customer dashboard or invent performance results.

## Acceptance criteria

- tour explains the six-step educational continuity story;
- works at phone and desktop widths;
- controls are keyboard operable and have meaningful labels;
- no horizontal overflow at supported mobile widths;
- no private or production data appears in assets;
- screenshots, when present, correspond to real VibeSchool product surfaces;
- homepage remains usable without JavaScript-dependent hidden content;
- TypeScript and production build pass;
- public browser/mobile gate passes;
- public trust/entry contracts remain green;
- PR remains isolated from unrelated application and database changes.

## Non-goals

- full interactive sandbox;
- authenticated demo account;
- recreating Teacher OS inside the marketing site;
- animation-heavy presentation;
- video production;
- publishing unapproved membership pricing.

## Promotion rule

Do not merge solely because the component renders. Merge only after the exact branch head passes the public browser/mobile, trust, entry architecture and production build gates.
