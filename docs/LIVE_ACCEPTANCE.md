# Deployed-site acceptance runbook

Prepared 8 November 2026. This is a test specification, not an execution report. Read it with [BRD.md](BRD.md), [QA_TESTING_GUIDE.md](QA_TESTING_GUIDE.md) and [REQUIREMENTS_TRACEABILITY.csv](REQUIREMENTS_TRACEABILITY.csv). Every scenario below starts **Not executed**; earlier local passes remain separate evidence.

## What each result establishes

| Evidence level | What it establishes | What it does not establish |
|---|---|---|
| Vercel deployment / HTTP health | A particular application deployment is reachable | Working database permissions, auth, checkout, email or scheduled processing |
| Local fixture suites | Behavior against controlled data, intercepted services or isolated PostgreSQL | The deployed revision or its actual connected services |
| Deployed public smoke | Public browsing on the recorded deployed revision | Authenticated flows, persisted mutations, email or concurrent transactions |
| Configured integration acceptance | The listed real-service scenarios passed on the recorded app, database and configuration | Untested scenarios, a different environment/revision or commercial payment/fulfillment |

A preview using a different Supabase project proves that preview's integration only. Record production verification separately. A Vercel deployment by itself is not evidence that migrations ran or that an external scheduler exists.

## Execution modes and required inputs

Public smoke can use the existing guarded suite. Authenticated and state-changing cases belong in a separate suite against an isolated staging database with dedicated test accounts, products and a controlled mail inbox. An approved, explicitly scoped production run may cover selected cases; document its permitted accounts, UUIDs, recipients and cleanup before execution. Do not run stock races, resets, failure injection or backlog tests against ordinary production data.

| Input | Required record / preflight assertion |
|---|---|
| Deployment identity | Exact immutable deployment URL, user-facing alias if used, Git SHA, deployment ID, environment, UTC execution time and Asia/Calcutta display time. Confirm the alias still points to that deployment at completion; stop/restart evidence collection if it changes. If SHA cannot be established, record Blocked for revision-specific acceptance. |
| Database identity | Nonsecret project/environment identifier and applied migration filenames/checksums. Confirm app points to that project; fallback products must not substitute for database fixtures. |
| Auth fixtures | Dedicated U-A and U-B with verified ownership/profile IDs, A-VALID and expired/forged cases, confirmation policy, controlled recovery inbox and allowed deployed /reset-password redirect. Load credentials through the test runner's secret store. |
| Catalog fixtures | Resolve real UUIDs for P-UNSIZED, P-SIZED, P-LAST, P-ZERO, P-MISSING-SIZE and P-COLOR; record current prices, configured sizes/colors, per-size rows and aggregate stock. Distinct run prefix separates fixtures from other test runs. Numeric local IDs are not valid substitutes. |
| Service configuration | Presence/validity results only for public Supabase settings, server service role, named admin hashes and separate signing secret, RATE_LIMIT_SECRET, limiter RPC and proxy behavior. No values in reports. |
| Storage | product-images permissions and private review-images configuration; dedicated run-owned object paths. |
| Restock | RESEND_API_KEY, verified RESTOCK_FROM_EMAIL, correct NEXT_PUBLIC_SITE_URL, separate RESTOCK_CRON_SECRET of at least 32 characters, external scheduler target POST /api/internal/restock-alerts every minute with bearer authorization. Record scheduler enabled state and recent invocation evidence; a stored secret alone is insufficient. |
| Assistant | Actual server Groq configuration/model and production limiter; fictional prompts only, with a test budget and request cap. |
| Evidence/cleanup | Artifact location, redaction policy, approved fixture manifest, operator responsible for cleanup and any explicitly accepted scope exclusions. |

Apply the migration order in BRD section 11 to the approved environment before the run; do not reapply old checkout definitions afterward. Migration application is an operator setup step, not something generated browser tests should do automatically. A missing input blocks the affected cases, not unrelated public browsing.

`npm run security:check-db` is an existing read-only inspector and needs DATABASE_URL supplied securely. Retain its findings, not its connection string. It does not fully inspect restock/review/lifecycle additions or prove live concurrency: separately inspect their current columns, RPC definitions and grants, then exercise real role boundaries. A green inspector alone cannot pass every security scenario.

## Existing commands and framework boundaries

For public browsing, set PLAYWRIGHT_BASE_URL in the runner environment to the recorded HTTP(S) origin, install Chromium and run:

```sh
npm run test:live
```

The current suite has 13 public Chromium cases, one worker, zero retries, no local server and no saved authentication. It blocks mutating methods and known helper/logout paths. Keep these guards intact; do not add login, checkout, restock or admin-write cases to this suite. Do not visit unsubscribe links during public smoke: GET /api/restock-notifications/unsubscribe changes data despite its HTTP method. Artifacts go to test-results/live.

The separate external pw-mcp-demo framework uses ECOMMERCE_BASE_URL for its public suite and the command `npm run test:ecommerce:read-only -- --retries=0`; this command belongs to that framework, not this repository. Preserve its request guards too. Browser interception proves fixtures, not real configured integration.

The scenarios below are specifications for a separate integration suite; **this repository currently has no command that executes all of them**. Before generating/running that suite, require an explicit target origin, fixture manifest and scoped write/mail authorization. Do not silently default integration tests to the public production URL or reuse a customer/admin session from public smoke. Secret names used by the external runner are its configuration contract, not new website environment settings.

Local regression commands remain test:ui, test:catalog and test:assistant (run sequentially), test:purchase, test:restock and audit:product-photos. They do not target the deployment. Current storefront push CI runs purchase/restock/photo/UI/catalog checks; it does not run test:assistant or test:live. Scheduling deployed acceptance after the intended deployment is ready is separate from push CI.

## Scenario catalog for test generation

Each row is a scenario family. Generate independently reported normal, denial and recovery cases as specified; do not hide a blocked branch under a passing family. Use the fixture definitions and detailed contracts in the BRD/QA guide. All mutation rows require the scoped environment described above.

| Scenario ID | Requirement IDs | Setup, actions and required assertions | Evidence / boundary |
|---|---|---|---|
| LIVE_CASE_01 Public deployed smoke | OPS-08, CAT-01, SEA-03, PDP-01, PDP-10 | Run the guarded public suite on the intended revision. Open each main collection, search a known live product and follow a card to its exact product heading/URL. Reject fallback/loading/error states as substitutes for live catalog results. Inspect enhanced cargo detail/card/chat framing at mobile/desktop, no divider/neighbor fragment and usable image resolution. | Public report plus image requests/screenshots; generic homepage/health 200 is insufficient. Photo source integrity remains a separate asset audit. |
| LIVE_CASE_02 Auth and recovery | AUTH-01, AUTH-03, AUTH-05, AUTH-06 | Using dedicated identities, test signup/confirmation according to actual policy, sign in/out, expired session and recovery email. Follow the allowed deployed redirect, change password and prove the new password works. | Auth/session outcomes and controlled inbox evidence; a reset-request success message does not prove delivery or completed recovery. |
| LIVE_CASE_03 Account cart isolation | CART-01, CART-04, AUTH-06, CHK-01, CHK-08 | In one browser profile: A adds variant/quantity, reloads, signs out (bag immediately empty/closed), B signs in and sees only B's bag, then A returns and sees A's bag. Same-account refresh retains contents. With an A checkout response held by the test client, switch to B and release it: B's bag/contact fields must not be overwritten or cleared. | Real auth plus storage/visible-owner assertions before/after transitions. Client response delay is fault injection, not proof of a live server outage. No cross-device cart sync is expected. |
| LIVE_CASE_04 Favorites/orders ownership | FAV-01, FAV-02, ORD-01, NFR-01 | Give A/B distinct favorites and orders. Reload each session and attempt cross-account reads/writes using the other fixture's IDs through actual browser-role requests. | UI, API/RLS denial and persisted ownership; service-role visibility cannot prove customer isolation. |
| LIVE_CASE_05 Checkout persistence | CHK-03, CHK-04, CHK-05, CHK-06, CHK-07, ORD-02, AOR-03 | Run each supported demo payment choice using known options/quantity and fictional address. Assert one saved order and correct lines, server price/total, saved options/address/method, exact size/aggregate decrement, confirmation/history and admin detail after reload. Try manipulated client price and invalid/missing options separately: reject invalid data or use trusted price, never partial writes. | Compare scoped DB snapshots and order IDs to UI/API results. No card input, real charge, shipment or refund is expected. |
| LIVE_CASE_06 Replay and lost response | CHK-08, CHK-09, CHK-10 | Commit a fixture checkout but hide its first response at the test client. Retry unchanged payload/key after reload: original order ID/total, no extra lines/decrement. Same key with changed payload conflicts. | Persisted before/after rows and request key correlation (redacted). UI success alone cannot distinguish duplicate orders. |
| LIVE_CASE_07 Independent stock races | CHK-07, CHK-09, STK-04, AOR-04 | Two independently authenticated sessions submit different attempts for P-LAST stock=1, with concurrent real server/DB work: exactly one purchase, other safely rejected, stock never negative and no partial order. Separately race catalog/stock save and cancellation against checkout; preserve committed stock and restore pre-shipment quantity at most once. | Independent transactions with timing and final DB assertions; serial requests or single-connection PGlite are not concurrency evidence. Invalid transition/change-of-size restoration conflict must leave all affected writes unchanged. |
| LIVE_CASE_08 Admin authority/catalog/storage | ADM-01, ADM-02, ADM-03, PRD-02, PRD-03, PRD-04, PRD-05, NFR-01 | Reject visitor/customer/flag-only/forged/expired access to private APIs. Valid admin saves/reads back a run-owned product, sizes and allowed image; invalid uploads/options fail. Browser anon/customer direct catalog/storage writes are denied. Log out and prove the old browser cookie no longer authorizes requests. | Actual auth, API statuses, persisted values and object permissions; private review photos remain LIVE_CASE_09. Test existing constraints/legacy invalid rows separately, never rewrite unrelated records. |
| LIVE_CASE_09 Review moderation/privacy | REV-01, REV-02, REV-04, REV-05, REV-06, REV-07 | A submits a pending review and private photo. B/public must not see pending content. Admin approves, replies, edits/removes reply and unpublishes; verify each public state after reload and browser-role moderation-write denial. Verify permitted signed image access and expiry. | Actual DB/storage and signed URL evidence. Previously issued signed links may remain valid until expiry; unpublishing is not instant revocation. Historical public objects/orphan cleanup remain documented gaps. |
| LIVE_CASE_10 Search recovery | SEA-03, NFR-03 | Live known-query result/empty result; separately intercept failed and held name/category responses, verify distinct error and Retry search after the eight-second deadline, then recover. Rapid A/B query changes and clearing query must suppress stale results. | Label real happy-path reads separately from client-injected error/deadline evidence; no random fallback success. |
| LIVE_CASE_11 Size-alert subscription | PDP-03, RST-01, RST-02 | P-SIZED S=0/M>0: S selectable for Notify me while purchase disabled; valid unavailable S saves (201), exact normalized duplicate returns already_subscribed (200) with one pending tuple. Available M subscription returns 409. Invalid/unsupported options return 400, unknown UUID 404; missing configured stock row is unavailable. All-zero product offers whole-product alert. | UI/API plus exact persisted tuple/count. Color shares stock; demo-photo products reject selectable color. Respect subscription rate limits instead of treating intentional 429 as a fixture failure. |
| LIVE_CASE_12 Restock eligibility | RST-03, RST-04 | With pending S/M/whole-product requests and all sizes zero, restore M. Only M and whole-product become eligible; S remains pending. Repeated positive saves, retired rows and unrelated products do not queue sends. Depletion before claim/preparation suppresses sending. Cancellation's genuine zero-to-positive restoration queues once. | Queue state and claim/preparation/provider correlation, not admin notification toast alone. No stock reservation; availability may change after preparation. |
| LIVE_CASE_13 Scheduler and real mail | RST-04, RST-05, RST-06 | Use only allowlisted controlled recipients and isolated queue. Observe an actual external scheduled POST (not merely manual admin processing), authorized response and due-batch progress. Missing/wrong bearer returns 401. Real provider acceptance updates matching request; verify actual received email's product/size and correct deployed product/unsubscribe links. Unsubscribe removes only that request; repeated link use remains safe. | Redacted scheduler invocation, queue result, provider event and inbox outcome recorded separately. Provider acceptance/notified_at is not inbox-delivery proof. GET unsubscribe is a write; do not run a successful all-products worker on a shared queue outside approved scope. |
| LIVE_CASE_14 Durable retry/worker overlap | RST-04, RST-06 | In an isolated test environment, induce transient timeout/429/5xx and restore provider access; prove due-time progression, frozen payload and stable restock/request-ID idempotency, eventual acceptance without duplicate logical delivery. Test permanent failure parking, ambiguous attempt older than 23h parking, expired ten-minute lease/stale-token denial and competing workers. Exercise over-100 due records in batches of at most ten. | Controlled provider fault/clock or isolated fixture manipulation must be identified. Concurrent claims require independent sessions. Suppress external sending or use a bounded sandbox; real success mail remains a separate LIVE_CASE_13 case. No claim of exactly-once inbox delivery. |
| LIVE_CASE_15 Real assistant relevance/confirmation | AST-02, AST-03, AST-04, AST-05, AST-12, AST-13, AST-14 | Establish fixture catalog truth: cargo jeans/pants available, cargo shorts absent. Ask cargo shorts: explicit exact-match-unavailable notice, relevant alternatives and no shirt; preserve budget/category/size/stock. Add an exact shorts fixture and repeat in a fresh conversation after the 30-second cache window: exact results. Cover factual unknowns (no invented material/care), comparison, preference refinement and required options. Proposal alone never changes bag; explicit confirmation validates fresh price/stock and adds once for current account. | Actual Groq/tool/network result against known catalog, not intercepted model responses. Log sanitized prompts, expected IDs/options, returned IDs and each failed response. Do not compare with Rufus or infer general quality from one prompt. |
| LIVE_CASE_16 Production security/config failures | NFR-01, NFR-02, NFR-08, OPS-03, OPS-04, OPS-09 | Verify production QA/dev helpers denied; no service/admin/mail secrets in client artifacts. Exercise real browser-role grants, shared limiter boundaries across instances and proxy addressing. In a separate preview, remove required service/limiter/mail configuration and verify documented unavailable/queued behavior without false success. | No production config toggling or general load attack. A single-instance 429 cannot prove shared counters; record config tests separately from production observation. Full read-only inspector is supplementary evidence. |
| LIVE_CASE_17 Device/accessibility/performance | NAV-05, AST-11, NFR-04, NFR-05, NFR-06 | Check agreed widths/browsers, keyboard/focus, heart alignment, no duplicate desktop category row, photo framing, assistant scrolling/input and reduced motion. Include a real mobile keyboard, manual accessibility review and agreed performance workload/thresholds. | Record actual devices and measurements. Chromium emulation/axe alone does not establish WCAG compliance or all-device support. Unagreed performance/browser targets remain Target requirement, not Passed. |

For every scenario also apply any relevant boundary/negative cases in the BRD. These families prioritize deployment-dependent risks and do not replace coverage of all 138 requirements or silently resolve any G-xx finding.

## Result record and release decision

Every generated test must include:

```text
test_id, scenario_id, requirement_ids, gap_ids, priority,
target_origin, deployment_id, git_sha, environment, database_project_id,
migration_evidence, started_at_utc, browser_device, role_aliases,
fixture_ids, prerequisites, steps, expected_ui_http_database,
observed_ui_http_database, evidence_paths, cleanup_result,
status, blocked_reason, defect_ids, accepted_exception_owner
```

Record individual outcomes as Not executed, Passed, Failed, Blocked or Not applicable with reasons. A skipped environment-dependent case is Blocked, not Passed. A reproduced unmet P requirement remains a known gap; unimplemented T behavior remains a target. Retain failures before any rerun; retries must not hide flaky behavior. Do not mark a whole requirement Passed from one happy path.

Keep run reports outside the manual RTM until reviewed, e.g. test-results/live-acceptance/<deployment-id>/<run-id>/ with redacted structured results, traces/screenshots and persisted-state diffs. Browser traces can contain cookies/tokens/email links: sanitize or restrict access before sharing; never attach credentials, subscriber addresses or unsubscribe tokens to public reports. Inbox evidence may identify the recipient by an alias. Public and integration reports must have distinct directories.

Cleanup must use only the recorded run-owned IDs/object paths and approved fixture mechanisms. The unsafe reset helper is retired (G-23): production returns 404 and authorized nonproduction calls return 410 without service calls. Use isolated SQL fixtures and fresh browser contexts; no hosted reset or cleanup is implied. Do not delete unrelated orders, users, products or mail requests. Record leftovers for the operator; destructive user/account cleanup must follow the environment's approved process.

Summarize counts and outstanding blockers by evidence level and requirement. Demo release acceptance requires the agreed P0 ownership, price/inventory/replay, role/helper and configured integration cases to pass on the intended revision, with other exclusions explicitly owned. Keep proposed quality targets and remaining G-xx limits visible. Obtain product/development/QA sign-off against the same app/database/configuration baseline. If staging alone passed, say so; do not relabel it full production acceptance.

## Prompt for the separate testing framework

```text
Read docs/BRD.md, docs/QA_TESTING_GUIDE.md, docs/LIVE_ACCEPTANCE.md
and docs/REQUIREMENTS_TRACEABILITY.csv from the intended application revision.
Generate a deployment-specific coverage plan for LIVE_CASE_01 through LIVE_CASE_17,
splitting each scenario family into independently reported cases mapped to
exact existing requirement IDs and gap IDs. Start every case Not executed.

First output missing target/revision, migration, fixture, identity, mail and
scheduler inputs. Separate public read-only smoke, configured real-service
checks, controlled fault injection and independent-transaction concurrency.
Preserve the existing read-only suites and do not invent a command or claim
that they execute the integration plan. Implement a separate opt-in suite
only within its supplied environment/fixture/write/mail scope; absent scope
or prerequisites means Blocked for those cases, not success or fallback.

Use real auth/catalog/DB/provider paths for integration evidence. Label any
interception, simulated failure, clock change or sandbox provider explicitly.
Do not send real email, change stock or invoke a global worker/reset from the
public smoke. Never print secrets or use local numeric IDs for DB mutations.
Produce per-case results/evidence and a requirement coverage/blocker report.
Do not upgrade manual RTM execution fields or declare full live acceptance
without execution review and sign-off on the recorded deployment baseline.
```
