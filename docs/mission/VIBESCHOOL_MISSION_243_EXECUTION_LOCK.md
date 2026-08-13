# VibeSchool Mission 243 — Execution Lock

**Execution branch:** `mission-243-execution`  
**Release policy:** no merge/deployment until certification; one consolidated production release.  
**Rule:** every task must pass DISCOVER → ROOT CAUSE → FIX → TEST → VERIFY → DOCUMENT. `LOCKED` means part of the mandatory completion set; it is not a completion claim.

## Status legend
`LOCKED` = mandatory queue item. `OPEN` = unresolved. `INVESTIGATING` = root-cause work active. `IMPLEMENTING` = fix in progress. `VERIFYING` = evidence execution in progress. `VERIFIED` = acceptance evidence passed. `CERTIFIED` = final release gate passed. `BLOCKED` = genuine external blocker only.

## Master task ledger

### P0 — Authority & architecture
- [ ] **001** `P0-001` — Finalize canonical Mission and Vision — **LOCKED**
- [ ] **002** `P0-002` — Establish single authoritative VibeSchool OS architecture — **LOCKED**
- [ ] **003** `P0-003` — Establish canonical VibeTwin boundary — **LOCKED**
- [ ] **004** `P0-004` — Resolve repository/source-of-truth conflicts — **LOCKED**
- [ ] **005** `P0-005` — Resolve database-vs-application authority conflicts — **LOCKED**
- [ ] **006** `P0-006` — Resolve publication authority — **LOCKED**
- [ ] **007** `P0-007` — Resolve public-discovery authority — **LOCKED**
- [ ] **008** `P0-008` — Verify documentation, code, migrations, and database contracts agree — **LOCKED**
- [ ] **009** `P0-009` — Create final authority map — **LOCKED**
- [ ] **010** `P0-010` — Certify P0 — **LOCKED**

### P1 — Security & data authority
- [ ] **011** `P1-011` — Audit authentication/session flows — **LOCKED**
- [ ] **012** `P1-012` — Verify role resolution — **LOCKED**
- [ ] **013** `P1-013` — Verify school membership resolution — **LOCKED**
- [ ] **014** `P1-014` — Verify account-status enforcement — **LOCKED**
- [ ] **015** `P1-015` — Verify unauthorized-login behavior — **LOCKED**
- [ ] **016** `P1-016` — Verify password/security configuration — **LOCKED**
- [ ] **017** `P1-017` — Resolve leaked-password protection finding — **LOCKED**
- [ ] **018** `P1-018` — Inventory every important table — **LOCKED**
- [ ] **019** `P1-019` — Inventory every RLS policy — **LOCKED**
- [ ] **020** `P1-020` — Inventory grants — **LOCKED**
- [ ] **021** `P1-021` — Inventory SECURITY DEFINER functions — **LOCKED**
- [ ] **022** `P1-022` — Verify search_path on privileged functions — **LOCKED**
- [ ] **023** `P1-023` — Verify anonymous access — **LOCKED**
- [ ] **024** `P1-024` — Verify authenticated access — **LOCKED**
- [ ] **025** `P1-025` — Verify student isolation — **LOCKED**
- [ ] **026** `P1-026` — Verify teacher isolation — **LOCKED**
- [ ] **027** `P1-027` — Verify parent isolation — **LOCKED**
- [ ] **028** `P1-028` — Verify school-admin isolation — **LOCKED**
- [ ] **029** `P1-029` — Verify school-owner isolation — **LOCKED**
- [ ] **030** `P1-030` — Verify HQ isolation — **LOCKED**
- [ ] **031** `P1-031` — Verify service-role boundaries — **LOCKED**
- [ ] **032** `P1-032` — Audit admin_* RPCs — **LOCKED**
- [ ] **033** `P1-033` — Audit student_* RPCs — **LOCKED**
- [ ] **034** `P1-034` — Audit teacher_* RPCs — **LOCKED**
- [ ] **035** `P1-035` — Audit parent_* RPCs — **LOCKED**
- [ ] **036** `P1-036` — Audit school_* RPCs — **LOCKED**
- [ ] **037** `P1-037` — Audit hq_* RPCs — **LOCKED**
- [ ] **038** `P1-038` — Audit exq_* RPCs — **LOCKED**
- [ ] **039** `P1-039` — Audit publication functions — **LOCKED**
- [ ] **040** `P1-040` — Audit assessment functions — **LOCKED**
- [ ] **041** `P1-041` — Audit progress/evidence functions — **LOCKED**
- [ ] **042** `P1-042` — Audit VibeTwin functions — **LOCKED**
- [ ] **043** `P1-043` — Test malicious client-supplied IDs — **LOCKED**
- [ ] **044** `P1-044` — Test cross-school access — **LOCKED**
- [ ] **045** `P1-045` — Test cross-student access — **LOCKED**
- [ ] **046** `P1-046` — Test privilege escalation — **LOCKED**
- [ ] **047** `P1-047` — Test unauthorized mutation — **LOCKED**
- [ ] **048** `P1-048` — Repair every genuine vulnerability — **LOCKED**
- [ ] **049** `P1-049` — Re-run adversarial authorization tests — **LOCKED**
- [ ] **050** `P1-050` — Certify P1 — **LOCKED**

### P2 — Content & publication authority
- [ ] **051** `P2-051` — Audit draft → review → published → ready → live state transitions — **LOCKED**
- [ ] **052** `P2-052` — Verify unpublished content cannot become public — **LOCKED**
- [ ] **053** `P2-053` — Verify unpublished content cannot enter sitemap — **LOCKED**
- [ ] **054** `P2-054` — Verify unpublished content cannot enter AI discovery — **LOCKED**
- [ ] **055** `P2-055` — Verify course/module/topic parent-child integrity — **LOCKED**
- [ ] **056** `P2-056` — Find orphaned public resources — **LOCKED**
- [ ] **057** `P2-057` — Repair orphaned resources — **LOCKED**
- [ ] **058** `P2-058` — Verify public content derives from authoritative publication state — **LOCKED**
- [ ] **059** `P2-059` — Audit textbook publication — **LOCKED**
- [ ] **060** `P2-060` — Audit course publication — **LOCKED**
- [ ] **061** `P2-061` — Audit topic publication — **LOCKED**
- [ ] **062** `P2-062` — Audit public reader RPCs — **LOCKED**
- [ ] **063** `P2-063` — Audit public knowledge APIs — **LOCKED**
- [ ] **064** `P2-064` — Verify publication authorization — **LOCKED**
- [ ] **065** `P2-065` — Verify unpublication authorization — **LOCKED**
- [ ] **066** `P2-066` — Verify publication prerequisites — **LOCKED**
- [ ] **067** `P2-067` — Certify P2 — **LOCKED**

### P3 — Reader / learner experience
- [ ] **068** `P3-068` — Audit public reader — **LOCKED**
- [ ] **069** `P3-069` — Audit course rendering — **LOCKED**
- [ ] **070** `P3-070` — Audit module rendering — **LOCKED**
- [ ] **071** `P3-071` — Audit topic rendering — **LOCKED**
- [ ] **072** `P3-072` — Audit lesson rendering — **LOCKED**
- [ ] **073** `P3-073` — Audit typography — **LOCKED**
- [ ] **074** `P3-074` — Audit hierarchy — **LOCKED**
- [ ] **075** `P3-075` — Audit colors/contrast — **LOCKED**
- [ ] **076** `P3-076` — Audit spacing — **LOCKED**
- [ ] **077** `P3-077` — Audit mobile experience — **LOCKED**
- [ ] **078** `P3-078` — Audit desktop experience — **LOCKED**
- [ ] **079** `P3-079` — Audit navigation — **LOCKED**
- [ ] **080** `P3-080` — Audit deep links — **LOCKED**
- [ ] **081** `P3-081` — Audit refresh behavior — **LOCKED**
- [ ] **082** `P3-082` — Audit loading states — **LOCKED**
- [ ] **083** `P3-083` — Audit empty states — **LOCKED**
- [ ] **084** `P3-084` — Audit error states — **LOCKED**
- [ ] **085** `P3-085` — Audit progress state — **LOCKED**
- [ ] **086** `P3-086` — Audit practice interaction — **LOCKED**
- [ ] **087** `P3-087` — Audit assessment interaction — **LOCKED**
- [ ] **088** `P3-088` — Audit feedback — **LOCKED**
- [ ] **089** `P3-089` — Audit learner continuation flow — **LOCKED**
- [ ] **090** `P3-090` — Verify reader → application transition — **LOCKED**
- [ ] **091** `P3-091` — Verify accessibility — **LOCKED**
- [ ] **092** `P3-092` — Certify P3 — **LOCKED**

### P4 — SEO
- [ ] **093** `P4-093` — Audit indexability — **LOCKED**
- [ ] **094** `P4-094` — Audit robots.txt — **LOCKED**
- [ ] **095** `P4-095` — Audit sitemap — **LOCKED**
- [ ] **096** `P4-096` — Verify sitemap derives from public authority — **LOCKED**
- [ ] **097** `P4-097` — Audit canonical URLs — **LOCKED**
- [ ] **098** `P4-098` — Audit page metadata — **LOCKED**
- [ ] **099** `P4-099` — Audit Open Graph — **LOCKED**
- [ ] **100** `P4-100` — Audit structured data — **LOCKED**
- [ ] **101** `P4-101` — Audit breadcrumbs — **LOCKED**
- [ ] **102** `P4-102` — Audit internal linking — **LOCKED**
- [ ] **103** `P4-103` — Audit server rendering — **LOCKED**
- [ ] **104** `P4-104` — Audit duplicate URLs — **LOCKED**
- [ ] **105** `P4-105` — Audit redirects — **LOCKED**
- [ ] **106** `P4-106` — Audit 404 handling — **LOCKED**
- [ ] **107** `P4-107` — Audit thin-content exposure — **LOCKED**
- [ ] **108** `P4-108` — Exclude private routes — **LOCKED**
- [ ] **109** `P4-109` — Verify public course URLs — **LOCKED**
- [ ] **110** `P4-110` — Verify public topic URLs — **LOCKED**
- [ ] **111** `P4-111` — Verify search-engine HTTP responses — **LOCKED**
- [ ] **112** `P4-112` — Verify production SEO — **LOCKED**
- [ ] **113** `P4-113` — Certify P4 — **LOCKED**

### P5 — AI discoverability
- [ ] **114** `P5-114` — Verify /llms.txt — **LOCKED**
- [ ] **115** `P5-115` — Verify machine-readable public knowledge — **LOCKED**
- [ ] **116** `P5-116` — Verify canonical URLs — **LOCKED**
- [ ] **117** `P5-117` — Verify educational relationships — **LOCKED**
- [ ] **118** `P5-118` — Verify publication relationships — **LOCKED**
- [ ] **119** `P5-119` — Verify public-resource discovery — **LOCKED**
- [ ] **120** `P5-120` — Verify AI can understand what VibeSchool is — **LOCKED**
- [ ] **121** `P5-121` — Verify AI can discover legitimate educational resources — **LOCKED**
- [ ] **122** `P5-122` — Test AI discovery against unpublished content — **LOCKED**
- [ ] **123** `P5-123` — Test AI discovery against learner data — **LOCKED**
- [ ] **124** `P5-124` — Test AI discovery against school-private data — **LOCKED**
- [ ] **125** `P5-125` — Test AI discovery against teacher-private data — **LOCKED**
- [ ] **126** `P5-126` — Test AI discovery against parent-private data — **LOCKED**
- [ ] **127** `P5-127` — Test AI discovery against assessment answers — **LOCKED**
- [ ] **128** `P5-128` — Test AI discovery against HQ data — **LOCKED**
- [ ] **129** `P5-129` — Verify no privileged RPC exposure — **LOCKED**
- [ ] **130** `P5-130` — Certify P5 — **LOCKED**

### P6 — VibeTwin
- [ ] **131** `P6-131` — Audit VibeTwin evidence model — **LOCKED**
- [ ] **132** `P6-132` — Audit learner-state authority — **LOCKED**
- [ ] **133** `P6-133` — Audit evidence provenance — **LOCKED**
- [ ] **134** `P6-134` — Audit context construction — **LOCKED**
- [ ] **135** `P6-135` — Audit reasoning boundaries — **LOCKED**
- [ ] **136** `P6-136` — Audit recommendation boundaries — **LOCKED**
- [ ] **137** `P6-137` — Audit action authority — **LOCKED**
- [ ] **138** `P6-138` — Verify human/system authority remains authoritative — **LOCKED**
- [ ] **139** `P6-139` — Verify AI cannot invent learner state — **LOCKED**
- [ ] **140** `P6-140` — Verify AI cannot overwrite authoritative state — **LOCKED**
- [ ] **141** `P6-141` — Verify AI cannot bypass RLS — **LOCKED**
- [ ] **142** `P6-142` — Verify AI cannot expose private information — **LOCKED**
- [ ] **143** `P6-143` — Verify AI-generated recommendations are distinguishable from facts — **LOCKED**
- [ ] **144** `P6-144` — Verify evidence → reasoning → recommendation traceability — **LOCKED**
- [ ] **145** `P6-145` — Verify misconception generation — **LOCKED**
- [ ] **146** `P6-146` — Verify mastery resolution — **LOCKED**
- [ ] **147** `P6-147` — Verify adaptive practice — **LOCKED**
- [ ] **148** `P6-148` — Verify calibration integrity — **LOCKED**
- [ ] **149** `P6-149` — Verify learner self-check remains non-authoritative — **LOCKED**
- [ ] **150** `P6-150` — Verify VibeTwin cannot poison evidence — **LOCKED**
- [ ] **151** `P6-151` — Certify P6 — **LOCKED**

### P7 — End-to-end journeys
- [ ] **152** `P7-152` — Public reader journey — **LOCKED**
- [ ] **153** `P7-153` — Student registration/login journey — **LOCKED**
- [ ] **154** `P7-154` — Student curriculum journey — **LOCKED**
- [ ] **155** `P7-155` — Student lesson journey — **LOCKED**
- [ ] **156** `P7-156` — Student practice journey — **LOCKED**
- [ ] **157** `P7-157` — Student assessment journey — **LOCKED**
- [ ] **158** `P7-158` — Student evidence journey — **LOCKED**
- [ ] **159** `P7-159` — Student progress journey — **LOCKED**
- [ ] **160** `P7-160` — Student continuation journey — **LOCKED**
- [ ] **161** `P7-161` — Teacher login — **LOCKED**
- [ ] **162** `P7-162` — Teacher school resolution — **LOCKED**
- [ ] **163** `P7-163` — Teacher class access — **LOCKED**
- [ ] **164** `P7-164` — Teacher curriculum access — **LOCKED**
- [ ] **165** `P7-165` — Teacher planning — **LOCKED**
- [ ] **166** `P7-166` — Teacher assessment — **LOCKED**
- [ ] **167** `P7-167` — Teacher evidence — **LOCKED**
- [ ] **168** `P7-168` — Teacher intervention — **LOCKED**
- [ ] **169** `P7-169` — Parent login — **LOCKED**
- [ ] **170** `P7-170` — Parent-child authorization — **LOCKED**
- [ ] **171** `P7-171` — Parent learning-context access — **LOCKED**
- [ ] **172** `P7-172` — Parent progress — **LOCKED**
- [ ] **173** `P7-173` — Parent support workflow — **LOCKED**
- [ ] **174** `P7-174` — School administration — **LOCKED**
- [ ] **175** `P7-175` — User management — **LOCKED**
- [ ] **176** `P7-176` — Curriculum management — **LOCKED**
- [ ] **177** `P7-177` — Teaching — **LOCKED**
- [ ] **178** `P7-178` — Assessment — **LOCKED**
- [ ] **179** `P7-179` — Evidence — **LOCKED**
- [ ] **180** `P7-180` — Decision support — **LOCKED**
- [ ] **181** `P7-181` — UI → API trace — **LOCKED**
- [ ] **182** `P7-182` — API → Auth trace — **LOCKED**
- [ ] **183** `P7-183` — Auth → database trace — **LOCKED**
- [ ] **184** `P7-184` — Database → response trace — **LOCKED**
- [ ] **185** `P7-185` — Response → UI trace — **LOCKED**
- [ ] **186** `P7-186` — Verify every critical journey — **LOCKED**
- [ ] **187** `P7-187` — Certify P7 — **LOCKED**

### P8 — Production hardening
- [ ] **188** `P8-188` — Run TypeScript/typecheck — **LOCKED**
- [ ] **189** `P8-189` — Run lint — **LOCKED**
- [ ] **190** `P8-190` — Run unit tests — **LOCKED**
- [ ] **191** `P8-191` — Run integration tests — **LOCKED**
- [ ] **192** `P8-192` — Run database tests — **LOCKED**
- [ ] **193** `P8-193` — Run RLS tests — **LOCKED**
- [ ] **194** `P8-194` — Run authorization tests — **LOCKED**
- [ ] **195** `P8-195` — Run security tests — **LOCKED**
- [ ] **196** `P8-196` — Run build — **LOCKED**
- [ ] **197** `P8-197` — Run browser tests — **LOCKED**
- [ ] **198** `P8-198` — Run accessibility tests — **LOCKED**
- [ ] **199** `P8-199` — Run SEO tests — **LOCKED**
- [ ] **200** `P8-200` — Run AI-discovery tests — **LOCKED**
- [ ] **201** `P8-201` — Run environment validation — **LOCKED**
- [ ] **202** `P8-202` — Validate migrations — **LOCKED**
- [ ] **203** `P8-203` — Validate migration ordering — **LOCKED**
- [ ] **204** `P8-204` — Inspect generated diff — **LOCKED**
- [ ] **205** `P8-205` — Inspect dependency changes — **LOCKED**
- [ ] **206** `P8-206` — Inspect environment variables — **LOCKED**
- [ ] **207** `P8-207` — Inspect production configuration — **LOCKED**
- [ ] **208** `P8-208` — Resolve every failure — **LOCKED**
- [ ] **209** `P8-209` — Re-run failed tests — **LOCKED**
- [ ] **210** `P8-210` — Produce reproducible evidence — **LOCKED**
- [ ] **211** `P8-211` — Freeze feature development — **LOCKED**
- [ ] **212** `P8-212` — Certify P8 — **LOCKED**

### P9 — Final release
- [ ] **213** `P9-213` — Build final certification matrix — **LOCKED**
- [ ] **214** `P9-214` — Reconcile GAP_LEDGER — **LOCKED**
- [ ] **215** `P9-215` — Ensure no critical OPEN gaps — **LOCKED**
- [ ] **216** `P9-216` — Ensure no critical FAILED tests — **LOCKED**
- [ ] **217** `P9-217` — Ensure no security-critical defects — **LOCKED**
- [ ] **218** `P9-218` — Ensure no publication-critical defects — **LOCKED**
- [ ] **219** `P9-219` — Review complete Git diff — **LOCKED**
- [ ] **220** `P9-220` — Review migrations — **LOCKED**
- [ ] **221** `P9-221` — Review security changes — **LOCKED**
- [ ] **222** `P9-222` — Review environment — **LOCKED**
- [ ] **223** `P9-223` — Run final build — **LOCKED**
- [ ] **224** `P9-224` — Run final browser verification — **LOCKED**
- [ ] **225** `P9-225` — Run final authentication verification — **LOCKED**
- [ ] **226** `P9-226` — Run final database verification — **LOCKED**
- [ ] **227** `P9-227` — Run final SEO verification — **LOCKED**
- [ ] **228** `P9-228` — Run final AI verification — **LOCKED**
- [ ] **229** `P9-229` — Run final critical user journeys — **LOCKED**
- [ ] **230** `P9-230` — Verify release prerequisites — **LOCKED**
- [ ] **231** `P9-231` — Push once — **LOCKED**
- [ ] **232** `P9-232` — Deploy once — **LOCKED**
- [ ] **233** `P9-233` — Verify production — **LOCKED**
- [ ] **234** `P9-234` — Run production smoke tests — **LOCKED**
- [ ] **235** `P9-235` — Verify production authentication — **LOCKED**
- [ ] **236** `P9-236` — Verify production database authorization — **LOCKED**
- [ ] **237** `P9-237` — Verify production reader — **LOCKED**
- [ ] **238** `P9-238` — Verify production SEO — **LOCKED**
- [ ] **239** `P9-239` — Verify production AI discovery — **LOCKED**
- [ ] **240** `P9-240` — Verify critical journeys in production — **LOCKED**
- [ ] **241** `P9-241` — Record final evidence — **LOCKED**
- [ ] **242** `P9-242` — Mark P0–P9 CERTIFIED — **LOCKED**
- [ ] **243** `P9-243` — Declare MISSION COMPLETE — **LOCKED**

## Execution contract
1. Highest-value unresolved task first; security and data integrity outrank polish.
2. A finding never ends a task. Investigate, repair, execute the strongest available test, verify, document, then move immediately.
3. A failed test creates a new root-cause hypothesis and remains unresolved until it passes.
4. Later evidence may reopen an earlier task.
5. No task becomes VERIFIED without evidence.
6. No task becomes CERTIFIED until final release validation.
7. No incremental Vercel deployments.
8. No premature merge.
9. One consolidated production release only after P0–P8 certification.
10. Genuine external blockers are isolated; independent work continues.
