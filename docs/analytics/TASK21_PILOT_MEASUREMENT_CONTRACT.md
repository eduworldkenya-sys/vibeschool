# Task 21 — Pilot Measurement Contract

Status: branch-only under Shared-Foundation Hold Gate.

## Trust rule
A metric is decision-grade only when its identity dimensions are canonical and its success semantics reconcile to authoritative backend state. Login, route views, and button clicks never constitute activation by themselves.

## Canonical event envelope
Product events use stable snake_case names and definition version `1`. Required context is minimized to: event name, occurred_at, authenticated actor id where applicable, canonical role, canonical school id when school-scoped, canonical student id only for student-scoped learning facts, session/journey/correlation id where useful, object id/type, outcome, safe failure category, application version, and stable operation/idempotency id for unique operations.

PII forbidden in analytics payloads: names, email, phone, free-text educational records, auth tokens, raw error bodies.

## Product event vs telemetry
Product events describe meaningful user/product state transitions. Task 12 telemetry describes technical execution and failures. Correlation IDs may connect them, but neither substitutes for the other.

## Canonical funnels
- Auth: auth_entry → auth_attempted → auth_succeeded → identity_resolved → onboarding_resolved → dashboard_reached.
- Teacher activation: auth_succeeded → teacher_dashboard_reached → teacher_class_context_resolved → teacher_lesson_started → one of attendance_saved/homework_assigned/assessment_recorded.
- Student activation: auth_succeeded → student_home_reached → student_learning_started → meaningful_learning_activity → learning_progress_saved.
- Parent activation: auth_succeeded → parent_identity_resolved → verified_child_available → parent_child_selected → parent_child_information_viewed.
- Admin activation: auth_succeeded → school_identity_resolved → admin_home_reached → operational_data_loaded → admin_meaningful_action_completed.
- VibeLearn: learning_asset_discovered → learning_asset_opened → student_learning_started → learning_progress_saved → learning_assessment_attempted → learning_completed → learning_resumed.

## School lifecycle
- Set up: canonical school has valid operating structure and an authorized admin.
- Activated: at least one server-authoritative teacher/admin/learning operation has completed for the school.
- Active: at least one meaningful server-authoritative operation in the role-appropriate rolling activity window. A school row alone is never activity.

## Retention
- Teacher: returns in a later cohort period and performs meaningful teacher work.
- Student: returns and produces meaningful learning/progress evidence.
- Parent: returns and views authorized child information.
- School: continues to produce meaningful school-scoped activity.

Default cohort grain for pilot: signup week × role × canonical pilot school. Avoid finer segmentation until sample sizes support it.

## Time to first value
Teacher: signup/auth start → first successful teaching operation. Student: onboarding/login start → first saved learning evidence. Parent: onboarding/login start → first authorized child insight. Admin: onboarding/login start → first successful school operation.

## Metric registry
| Metric | Decision-grade definition | Authority | Decision |
|---|---|---|---|
| Teacher activation | unique canonical teachers completing activation funnel | backend facts + product events | repair onboarding/class/lesson friction |
| Student activation | unique canonical students with saved learning evidence | progress/evidence backend | repair learning/open/save journey |
| Parent activation | authorized parent with verified child and meaningful view | relationship + server evidence | repair linking/insight access |
| Admin activation | authorized admin completing school operation | membership + backend operation | repair school setup/operations |
| VibeLearn completion | canonical student completion reconciled to progress/evidence | learning backend | content/reader/activity remediation |
| School active | canonical school with meaningful activity in window | backend operational facts | school-success intervention |
| Journey failure rate | failed authoritative stages / attempted authoritative stages | telemetry + product event correlation | reliability prioritization |
| Role retention | activated cohort returning with meaningful role work | canonical activity facts | product/value intervention |

## Duplicate policy
Critical unique operations use backend facts or stable operation/idempotency IDs. Retry/refresh duplicates cannot increase unique-success metrics.

## Error-aware funnel policy
A stage has explicit states: succeeded, product_failed, abandoned/unknown. Technical failure categories come from safe Task 12 telemetry correlation; absence of the next event is not automatically a product failure.

## Data quality gates
Reject or quarantine from decision-grade aggregates: unknown event names/versions, missing required canonical identity, impossible role/event combinations, missing school on school-scoped events, auth/profile/student identity mixing, invalid future timestamps, duplicate unique-operation IDs, and impossible stage order where a strict predecessor is required.

## Reconciliation
Critical success metrics must periodically compare event-derived counts to backend truth for attendance, homework/assessment, learning progress/completion, and parent relationship-scoped views where server evidence exists. Material disagreement blocks use of that metric.

## Privacy and retention
Raw product events are internal and minimized. Recommended policy pending owner/legal privacy authority: raw behavioral product events 90 days; pseudonymous journey aggregates 13 months; mandatory security/audit evidence follows its separate Task 12/14 retention policy. This recommendation must not be enacted in production while the hold gate is active.

## Failure behavior
Analytics writes are best-effort unless the same evidence is independently required for transaction/security/audit. Analytics ingestion failure must not block teaching, learning, parent views, or school operations.

## Baseline rule
No pilot baseline is certified from legacy counts until definitions, canonical identities, duplicate handling, and backend reconciliation pass. Legacy `platform_events` can inform inventory but cannot automatically be treated as the Task 21 baseline.
