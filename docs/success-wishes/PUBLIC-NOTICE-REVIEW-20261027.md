# Public notice review — 27 October 2026

Scope: substantive repository-backed review of the five expired public surfaces while reconciling Success Wishes PRs #833–#853. This is a product disclosure review, not a claim of legal certification or production commissioning. Next review: 26 November 2026, or sooner if practices change.

- `/legal/privacy`: added the actual Wishes fields, tab-local 24-hour text draft, local-only media, private links, registered-contact SMS/consent/recovery, payment-provider handling, rights requests and time-limited card access. Basis: `sender-draft.ts`, `useSenderDraft.ts`, `SenderMediaCapture.tsx`, `WishCheckout.tsx`, receiver/card, verify, recover and safety routes. Existing operator identity and rights remain unchanged; no new processing permission is created.
- `/legal/terms`: distinguished review/order creation from verified payment, disclosed local-only media, expiring/revocable access, recovery and support for delivery/payment/refund questions without inventing a refund promise or changing statutory rights.
- `/legal/aup`: added private-link/code protection, unwanted-message reporting and child-safety restrictions, using existing settings/contact routes.
- `/evidence`: checked `public-evidence.json` has no published claims and defaults to withhold. Added an explicit boundary between synthetic Wishes tests and live payment/SMS/device/adoption evidence. No outcome claims promoted and no evidence-manifest review date fabricated.
- `/pathways/schools`: inspected canonical search, source/date disclosure and verified-offering states; added a visible explanation that directory inclusion does not establish admission or current offerings. No school data or verification status changed.

External reference: Kenya Office of the Data Protection Commissioner, Data Sharing Code (March 2025), https://www.odpc.go.ke/wp-content/uploads/2025/03/FINAL-DATA-SHARING-CODE.pdf. The review preserves purpose, minimum disclosure and consent boundaries; it does not attest to operator registration, processor contracts or a legal audit.

Validation: public trust/content-governance/link contracts, TypeScript, changed-file lint, production build and synthetic Success Wishes browser regressions are required on the integrated candidate. Runtime switches and providers are unchanged. Reverting this change restores the prior notices and manifest; do not revert only the review dates while retaining revised practices.
