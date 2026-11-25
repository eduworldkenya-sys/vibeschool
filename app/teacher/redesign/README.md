# Teacher redesign shared components

This is the frontend-only implementation of the relevant design decisions in [REDESIGN.md](https://github.com/eduworldkenya-sys/vibeschool/blob/c7e6d4730749b6a8699a555555bbac9c1555f134/REDESIGN.md), particularly sections 4–5, 24–29, 31–36, 39–42, 47–48. That document remains the broader design source of truth.

## Reuse contract

- Import existing primitives from `ui.tsx` and composed controls from `controls.tsx`; do not copy their JSX or CSS into individual redesigned workspaces. Configure labels, actions, variants, data, icons and states through props. Extend the common component for a genuinely reusable new variant.
- Shared styles and semantic appearance tokens are in `redesign.module.css`; deterministic search/filter/reorder/calendar logic lives in `component-logic.ts`. The canonical teacher navigation registry remains `components/teacher/navigation.ts`.
- The Design Lab uses the same imports as the redesigned app. Open Me → Design Lab, or visit `/teacher/redesign?tab=me&panel=lab`. All lab data and actions are synthetic and local.
- Preserve existing product functionality and permissions. Do not introduce a parallel production service, duplicate established UI infrastructure, or bind sample actions to production writes. Reconcile legacy shared components during adoption; this library is canonical for the redesigned Teacher App, not yet a migration of every VibeSchool surface.

## Review matrix

| Family | Implemented representative controls | Remaining evidence or coverage |
| --- | --- | --- |
| Buttons | ActionButton: primary, outline, ghost, destructive, icon, three sizes, pending/disabled | Browser focus and action-state verification |
| Search | SmartSearch: universal, expandable, filtered, recents, clear, local ranked matches | Authorized backend search, typo tolerance, asynchronous cancellation |
| Filters | FilterChips, RecordFilters: inline, advanced draft, multi-subject, sorting/reset, counts | Date ranges where applicable; real server filtering and pagination |
| Forms | TextField, SelectField, CheckField, RadioField, SwitchField, RangeField, inline validation | Upload and rich editor adoption, real draft persistence and validation |
| Navigation | Existing responsive app shell, ContextTabs, ActionMenu, Accordion, deep links | Device/browser back and keyboard verification |
| Overlays | AdaptiveOverlay, centered confirmation, adaptive sheet/drawer; contextual popover sample | Consolidate remaining existing shell overlay internals; focus and device checks |
| Data display | DataTable, Pagination, Calendar, Progress, MetricBars, Timeline | Real records, specialized charts and schedule behavior |
| Feedback | StateView, StatusPill, Notice, Skeleton, retry/undo samples | Real authoritative async outcomes, notification delivery and sync |
| Interactions | ReorderList drag and explicit move controls, keyboard tabs, shell swipe, reduced-motion styles | Touch gesture/browser checks; advanced canvas interactions only where needed |
| Verification | Regression contracts and lab checklist for 320–1440px, themes, text scaling, keyboard | Actual CI, device/browser, assistive technology and production checks |

This matrix records implementation scope, not certification. The broader inventory in REDESIGN.md remains applicable to future real workspaces. No extra product features are implied by illustrative samples.
