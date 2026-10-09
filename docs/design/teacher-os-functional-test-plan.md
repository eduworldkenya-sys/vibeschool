# Teacher OS functional testing

The owner authorizes reversible tests in the connected production-designated, prelaunch project, using dedicated test accounts. A verified recoverable database backup is a prerequisite for any write test. No backup has yet been verified: available configuration includes only the public Supabase URL/key, and this session has no Supabase management connector.

## Preconditions for writes

1. Verify the connected project identity, a completed backup/restore point, timestamp, retention and documented recovery path through Supabase management metadata. Save redacted evidence. Do not restore over the connected database as a test.
2. Establish the test account's canonical identity and authorized school context. Use a second dedicated account for cross-tenant negative tests; never use service-role access to make an RLS test pass.
3. Register each test-created record immediately, including table/type, ID, parent IDs, owner, scenario, prior state when relevant, and cleanup result. New names begin `VS-CODEX-TEST-20261009-`; record IDs, rather than names alone, govern cleanup.
4. Verify each exercised flow cannot trigger payments, email, SMS or external notifications. Keep database operations restricted to explicitly registered test records. Disable no application security or RLS. Stop before any unsafe downstream effect.
5. Admit reversible database testing through the repository's existing capability/security gate after the above evidence is available. No destructive schema change, merge or deployment is admitted by this testing authorization.

## Journey matrix

| Journey | Positive test | Negative / recovery test | Current proof |
|---|---|---|---|
| Login | Sign in dedicated Teacher account and resolve canonical destination | Anonymous Teacher context requests denied | Live read passed; both RPCs deny anonymous with 401/42501 |
| School onboarding | Create/connect test school; reload canonical context | Unauthorized school rejected; retry preserves context | Write prerequisite pending |
| Class onboarding | Create test class and subject assignment; reload | Invalid grade/subject and duplicate assignment rejected | Write prerequisite pending |
| Class Hub | Search/open assigned classes; verify current rosters | Empty/error fixture, wrong school denied | Live 3 classes / 6 learners; isolated empty/error/search passed |
| Learners | Create/edit test learner; retrieve current enrollment | Duplicate enrollment and cross-tenant access rejected | Write prerequisite pending |
| Subject Hub | Open real teaching assignment and linked materials | Missing assignment and unavailable material recoverable | Pending |
| School Hub | Display authorized school and class scope | Forbidden school context remains inaccessible | Pending |
| Timetable | Create/edit/delete test slots, reload and conflict-check | Overlap, stale state, copy/undo and unauthorized teacher | Contract tests pass; write journeys pending |
| Scheme | Prepare/test a scheme and retrieve week linkage | Missing calendar, invalid scope, retries | Write prerequisite pending |
| Lesson plan | Prepare/save/reload test plan and attach correct occurrence | Invalid identity; drafts remain separate from evidence | Contracts pass; write journeys pending |
| Teach Mode | Start and complete exact test occurrence | Repeated completion, missing evidence and wrong owner | Write prerequisite pending |
| Attendance | Save/reload present/absent test roster batch | Wrong roster, duplicate/retry, unauthorized class | Write prerequisite pending |
| Homework | Create/assign/edit test task and retrieve submission | Invalid class/subject, stale save, invalid marks | Live list read passed; write journeys pending |
| Assessment | Create/save test assessment, attempts and marks | Invalid mark/range; wrong owner; repeated save | Authority/exam contracts pass; writes pending |
| Exams/results | Record test marks and retrieve subject/class results | Locked exam stays read-only; no duplicate result authority | Exam contracts pass; writes pending |
| Progress | Record test lesson reflection and retrieve learner history | Disconnected occurrence and wrong school rejected | Write prerequisite pending |
| Resources | Add/edit/delete a registered test resource | Invalid URL/scope; form validation; save retry | Shared dialog/labels/Escape verified with isolated fixtures |
| Notifications | Retrieve list and mark a test-created notification read | Existing unrelated notification untouched; no external send | Live list read passed; writes pending |
| Settings/profile | Save and retrieve preferences on test account | Failed save retains input; loading/error accessible | Isolated preference save passed; live read passed |
| Cleanup | Delete only ledger-listed test-created records in dependency order | Abort if ownership/parent IDs mismatch; preserve unrelated records | No application test records created yet |

## Existing evidence and open defect

Dependency verification, TypeScript, lint, production build, Twin, timetable, SEO and Teacher UI/authority contracts pass for the tested working tree. Lint retains existing warnings. Public local production GETs and test-account production-mode sign-in pass. Local browser fixtures cover six viewport widths and keyboard behavior. This is not certification of the full application or every route/state.

The live credit-balance RPC returns HTTP 403 for the supplied account. Authenticated read diagnostics confirm `42501: permission denied for function get_credit_balance`. Inspect current grants through authorized management access before proposing any grant correction. Do not weaken the existing denial.

The environment draft contains `SUPABASE_ACCESS_TOKEN` as a metadata-only secure configuration requirement and adds `api.supabase.com` alongside existing allowed domains. No credential is in this repository. Write testing remains blocked until backup verification succeeds.

School Hub diagnostics also confirm missing school-information RPC (`PGRST202`) and JSON/table context errors (`42703`) in the responsibility readers. A corrective migration and realistic JSON-contract regression are prepared and pass against isolated PostgreSQL/PGlite. The production-designated project has not been modified. The management backup endpoint returns 401 through existing proxy access; the token requirement remains pending.
