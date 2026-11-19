# VibeMe character universe — v2
VibeMe is VibeSchool's original SVG art system. The same bounded renderer serves personal avatars and **fictional** educational illustrations. Version 1 URLs remain immutable; version 2 choices are independently editable and never establish account gender, age, verification, or qualification. Student/adult defaults are cosmetic, not identity claims. Existing photos and saves remain until the owner explicitly replaces them.

## Authoring
Use a canonical published learning section's authored block, not a learner's profile:
```json
{"kind":"character","code":"v2-2200000222100000","altText":"A fictional learner wearing a school uniform","caption":"A VibeSchool character"}
```
Use the editor or character code contract in lib/vibeme-character.ts; ensure the 16 choices are in order and the last choice is 0 (still) for educational blocks. Keep meaningful alt text and captions. The block is rendered only in existing authorized lesson reader paths; it does not certify or publish a textbook. No external image URL, account lookup, or personal data is allowed. Story/exercise authoring teams may reuse the same bounded SVG renderer, subject to existing editorial release gates.
Profile animations are finite and respect prefers-reduced-motion. Advanced stickers, rewards, export, and remaining app-surface rollouts are separate.
