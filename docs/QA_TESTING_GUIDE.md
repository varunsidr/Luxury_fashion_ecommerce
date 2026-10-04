# zeouf — QA coverage and test-generation guide

**Baseline:** Storefront polish, password confirmation, admin logout and cart recovery over `3a58270`, reviewed 4 October 2026. Exact source inputs and reviewer assertions are recorded in requirements-source-snapshot.json and requirements-reviews.json. This guide accompanies [BRD.md](BRD.md) and [REQUIREMENTS_TRACEABILITY.csv](REQUIREMENTS_TRACEABILITY.csv). Test designs are separate from executed evidence.

## 1. Start here

1. Read BRD sections 2–4 to understand available functions, roles and routes.
2. Select the exact requirement IDs for the area being tested. Read their state and any linked G-xx findings before generating expectations.
3. Record build URL/revision, real-Supabase versus fallback mode, database migration version, mail availability, authentication policy and browser.
4. Create isolated fixtures. Inspect persisted values after setup; a seed success response is insufficient evidence of a clean dataset.
5. Generate cases for normal flow, denial/error, boundary, persistence, and integration as applicable. Separate present behavior from proposed target acceptance.
6. Link each case and defect to requirement IDs, and update the CSV execution fields after running it.

I/C/D describe implementation evidence only. Use `Known gap` for reproduced unmet P requirements, `Target requirement` for T or intended P behavior, and `Environment blocked` for unavailable prerequisites. Do not treat a known gap or unexecuted test as Passed.

## 2. Test-case record

| Field | Required contents |
|---|---|
| Test ID | Stable unique ID, e.g. TC-CHK-007-01 |
| Requirement IDs | One or more exact IDs, e.g. CHK-07, NFR-01 |
| Gap IDs | Relevant BRD finding, if any |
| Title / purpose | Observable behavior being checked |
| Test mode | Current baseline / Target requirement / Regression |
| Priority | P0/P1/P2 from requirement, adjusted with documented reason |
| Layer | UI / API / database-policy / end-to-end / content / accessibility / performance |
| Role | Visitor / customer A / customer B / administrator / protected test helper |
| Preconditions | Config, identity, fixture IDs/values, storage and migration version |
| Test data | Exact inputs, options, quantities, expected prices/stock |
| Steps | Reproducible actions or Given/When/Then |
| Expected result | UI result, HTTP contract, persisted result, absent forbidden side effects |
| Cleanup | Fixture records/storage/mail reset needed; scoped to this test |
| Execution | Not executed / Passed / Failed / Blocked / Not applicable |
| Evidence | Build, timestamp, browser, screenshots/network/DB assertion where relevant |
| Defect / owner | Linked defect, responsible owner and status |

One broad test named “checkout works” is insufficient. Split authentication, field rules, option validation, limits, transaction integrity, stock conflicts, both methods, confirmation and replay behavior. An end-to-end case can supplement these checks but does not replace them.

## 3. Fixture catalog

Use fictional identities and addresses. Resolve database UUIDs from created fixture names; numeric local IDs are unsuitable for real checkout/stock/restock tests. Names below are test fixture specifications, not a claim that these records already exist.

| Fixture | Definition | Coverage |
|---|---|---|
| U-A | Confirmed customer A with a profile and known password | Customer normal flows |
| U-B | Confirmed customer B with separate favorites/orders/reviews | Ownership/isolation |
| U-UNVERIFIED | Unverified account where project requires confirmation | Signup/sign-in provider behavior |
| U-NOPROFILE | Auth user lacking profile, created in isolated QA setup | Checkout profile upsert/self-healing |
| A-VALID | Admin cookie from correct configured credential | Private reads/stock/moderation/status |
| A-EXPIRED / A-FORGED | Expired signed token / invalid signed token; separate browser context | Access denial |
| A-FLAGONLY | localStorage admin_auth=1 without valid admin cookie | UI flag versus API authority |
| P-UNSIZED | Bags product, price INR 1,000, no sizes/colors, stock 5 | Card quick-add, subtotal, unsized stock |
| P-SIZED | Women's Dress, price INR 2,500, sizes S/M/L; S=0, M=4, L=5; aggregate 9 | Size selection, stock boundaries, filters |
| P-LAST | Unsized Accessories product, price INR 500, stock 1 | Competing checkout, exact-stock purchase |
| P-ZERO | Perfume product, price INR 3,000, stock 0 | Unavailable card and restock |
| P-COLOR | Product with two named colors and verified distinct images; shared inventory | Color photography, variant merge, snapshots |
| P-DEMO | image_url starts /demo-products/; even if color metadata exists | Color suppression/single photograph |
| P-MISSING-SIZE | Product configured for S/M with one stock row missing | Unknown stock behavior G-09 |
| P-MULTIIMAGE | Valid main image and multiple gallery URLs | Gallery/thumbnail/image removal |
| P-DECIMAL | Unsized product, base price INR 999.50, stock 10 | Price snapshots and display rounding |
| P-TAGSET | Distinct products tagged New / Best / Featured / Populer / no tag | Highlight and newest sorting |
| P-TAXONOMY | At least one product per 14 database categories with distinct names/brands | Category boundaries and searches |
| P-LARGE | Collection of 49 known matching products plus some nonmatches | 24→48→49 batching/filter counts |
| P-TIES | Equal-price products, equal-date products, missing date/tag/brand | Deterministic sort and option hiding |
| CART-VALID / CART-LEGACY | Stored browser line with quantity two; duplicate missing/null color lines and a distinct named color | Initial hydration, reload, normalization and variant-specific edits |
| CART-BROKEN / CART-MIXED | Malformed JSON/nonarray, or valid lines mixed with blank IDs, invalid prices/quantities/options/photo URLs | Recover without crash, preserve valid items, display notice |
| STORAGE-BLOCKED / STORAGE-FULL | Browser localStorage getter/write throws SecurityError/QuotaExceededError | Keep in-memory bag; show persistence notice |
| MEDIA-STILL / IMG-FAILED | Reduced-motion browser; one aborted product image request | Still hero/manual navigation; card image failure feedback |
| CAT-SLOW / CAT-STOCK-SLOW | Configured fixture client with a held product or size-stock response and controlled browser clock | Honest loading copy, eight-second deadline, retained live products for stock-only failure |
| CAT-FAILED / CAT-EMPTY | Configured fixture products response returns 503 or successful empty array | Identified demo fallback/retry versus a genuinely empty live collection |
| A-LOCAL-COOKIE | Fixture admin login on isolated localhost server with service role disabled | Real signed cookie logout and post-logout denial; no live DB writes |
| F-A / F-B | Different favorite sets for U-A and U-B | Database ownership/counts |
| R-PENDING / R-APPROVED | Known ratings, comments, ownership and approval flags | Public visibility, moderation, averages |
| R-WITHIMAGE | Valid image URLs attached to a review | Persistence versus public image presentation |
| O-STATUSSET | Orders in all five statuses, linked lines with known unit prices | Order filters/lifecycle/analytics |
| O-DELETED-PRODUCT | Order line retains quantity/unit price; product reference null | Historical fallback |
| N-SIZESET | Pending alerts for whole product, S, M, alternate color and different email casing | Matching, duplicate, delivery eligibility |
| IMG-VALID | JPEG/PNG/WebP each ≤2 MiB, including exact 2 MiB | Upload acceptance |
| IMG-INVALID | >2 MiB, unsupported MIME, misleading extension, fourth file | Upload validation |

Seed scripts may change stock and insert sample orders. Measure final stock/records before testing. Current reset endpoint omits orders, auth users and browser localStorage and ignores delete failures. Do not use it as a guaranteed clean baseline. Never run destructive fixture setup against a shared or production database.

## 4. Coverage matrix

| Dimension | Cases to generate | Applies to |
|---|---|---|
| Roles | Guest, current customer, other customer, valid/expired/forged admin, local flag only | AUTH, FAV, CART, CHK, ORD, REV, ADM, APIs |
| Data population | Zero, one, many, duplicate, deleted reference | Listings, search, favorites, history, dashboard, moderation |
| Category | Every main/database category; women versus men; English and legacy URL | NAV, CAT, PDP |
| Options | Unsized/sized; chosen/missing/zero/missing-row size; colors/no colors/demo photos | PDP, CART, CHK, STK, RST |
| Availability | Stock 0, 1, 4, 5; exact quantity, one over; changed since cart addition | CAT, PDP, CHK, STK |
| Quantities | 0, 1, 20, 21, fraction, numeric string; merged duplicate variants | CART, CHK |
| Item limits | 0, 1, 50, 51 raw checkout entries; 24, 25, 48, 49 listing matches | CHK, CAT |
| Filters | Each alone, combinations, no matches, clear all; inclusive price boundaries | CAT, AOR, PRD |
| Sort | All choices, ties, missing date/tag; preserve recommended incoming order | CAT |
| Text | Empty/whitespace, case, Unicode, special URL characters, limit−1/limit/limit+1 | SEA, AUTH, CHK, REV, RST, PRD |
| Authentication changes | Login, logout, reload, session expiry, account switch, interrupted gated action | AUTH, FAV, CART, ADM |
| Browser state | New context, existing cart, corrupted cart JSON, hydration/reload | CART, NAV |
| Service configuration | Real backend, local fallback, backend failure, missing server key, missing migration/bucket | CAT, AUTH, CHK, REV, STK |
| Currency | India/US/other header, browser fallback, valid/invalid/offline rate, decimal rounding | CUR, CAT, CART, CHK, ORD |
| Files | 1/3/4 files, exact/over 2 MiB, accepted/rejected MIME, failed upload | REV, PRD |
| Transactions | Later line fails, insufficient stock, competing last unit, DB/RPC unavailable | CHK, NFR |
| Replays | Duplicate clicks/POST, repeated alert, concurrent notification batches, repeated unsubscribe | CHK, FAV, RST |
| Status/moderation | All statuses; backward transition; approve/delete; pending visibility and aggregates | AOR, ORD, REV, ANL |
| Failure UX | 400/401/409/429/500/503, network rejection, slow response, invalid response body | Forms, APIs, NFR-03 |
| Responsive/accessibility | 375/768/1440px proposal; keyboard/focus/contrast/reduced motion | NAV, PDP, forms, admin |
| Environment guards | Production blocks helpers; credentials separate; secrets absent from client | OPS, NFR-02 |
| Content accuracy | Demo/no-charge/no-shipment; newsletter preview; no invented decline/promotion/settings | CNT, CHK, SET |

Use pairwise coverage for secondary UI combinations if useful, but explicitly cover every P0 rule and boundary. Do not use pairwise sampling to omit ownership, transaction rollback or stock concurrency.

## 5. Scenario seeds

These are starting cases. Expected unmet target behavior is explicitly marked; do not rewrite it as a passing description of the bug.

| Test seed | Requirements | Given / When / Then | Mode |
|---|---|---|---|
| TC-NAV-006-01 | NAV-06 | Given a clean browser, when opening /kadin/elbise, then navigation reaches /women/dress and shows Dress listing; repeat for mapped legacy paths. | Baseline |
| TC-CAT-005-01 | CAT-03, CAT-05 | Given P-SIZED and selected S with In stock only, when filters apply, then this product is excluded; selected M includes it. | Baseline |
| TC-CAT-007-01 | CAT-07 | Given 49 matching products, when listing opens and Load More is clicked twice, then visible counts are 24/48/49 and the final button is absent. | Baseline |
| TC-SEA-002-01 | SEA-02 | Given a product matching both name and category query, when searching different-case text, then it occurs once in results. | Baseline |
| TC-AUTH-002-01 | AUTH-02 | Given password A and confirmation B, when submitting, then mismatch alert appears and neither helper nor signup runs. Blank confirmation is required; matching values proceed without sending confirmation and clear it after success/tab change. | Baseline; resolved G-01 |
| TC-CART-002-01 | CART-02, CART-05 | Given U-A and P-COLOR, when adding M/red twice and L/red once, then two lines exist with quantities 2/1 and correct subtotal. | Baseline |
| TC-CART-004-01 | CART-04, AUTH-06 | Given U-A's stored cart, when signing out and signing in as U-B in the same browser, then record the current shared cart; separately test the owner-approved account separation target. | Baseline finding plus pending target; G-10 |
| TC-CART-004-02 | CART-02, CART-04, CART-05 | Given a saved line and mixed invalid rows, when loading and editing quantity then reloading, then valid items/totals persist and invalid rows do not crash rendering. Missing/null color variants merge; invalid JSON recovers with notice. | Baseline recovery; account ownership remains G-10 |
| TC-CART-004-03 | CART-04, NFR-03 | Given blocked reads or full/unavailable writes, when loading and using the bag, then in-memory controls remain usable and a persistence notice appears. | Baseline |
| TC-NAV-001-01 | NAV-01, NAV-02 | Given desktop/mobile or reduced motion, when switching/pausing hero or scrolling away, then matching links/posters appear, only one active clip exists and hidden/offscreen/reduced-motion playback stops; each editorial destination resolves. | Baseline |
| TC-NAV-005-01 | NAV-03, NAV-04, NAV-05 | Given keyboard/mobile navigation, when opening clothing menus or an account/cart/search drawer, then subcategory links work, Tab stays in the active dialog, Escape closes it and focus returns to the trigger; closed drawers are inert. | Baseline |
| TC-PDP-001-01 | PDP-01, PDP-08 | Given in-stock/out-of-stock/sized/unsized products, when loading, aborting an image, hovering, focusing or touching a card, then information remains readable, failure feedback appears and only valid actions are offered. | Baseline |
| TC-CHK-003-01 | CHK-03 | Given a valid session/address and two identical entries of quantities 10/11, when POSTing checkout, then 400 occurs and no order/stock write exists. | Baseline |
| TC-CHK-005-01 | CHK-05, CHK-06 | Given P-UNSIZED database price 1,000 and a forged client price 1, when buying two, then saved unit price is 1,000, total 2,000 and stock 3. | Baseline |
| TC-CHK-007-01 | CHK-07 | Given P-LAST stock one and two independently authenticated customers, when both buy simultaneously, then exactly one succeeds and one conflicts; stock is zero and only one complete order exists. | Baseline; verify transaction |
| TC-CHK-007-02 | CHK-06, CHK-07 | Given first line has stock and later line is forced to fail inside the transaction after precheck, when checkout executes, then no order/lines remain and all inventory is unchanged. | Baseline; isolated fault injection |
| TC-CHK-009-01 | CHK-09 | Given a sized product, when a direct API caller omits size or supplies invented color, then invalid options are rejected with no writes. Current code does not enforce this. | Target; G-08 |
| TC-CHK-009-02 | CHK-09 | Given a successful valid checkout request, when the same request is retried, then agreed idempotent behavior prevents another order. No current idempotency contract exists. | Target; decision required G-14 |
| TC-ORD-001-01 | ORD-01, NFR-01 | Given orders for U-A and U-B, when U-A reads history and attempts a direct U-B order read, then only U-A's records are accessible. | Baseline with RLS evidence |
| TC-REV-004-01 | REV-04 | Given approved and pending reviews, when a visitor reads product details, then only approved feedback contributes to public results/rating. Current detail/RLS violate intended moderation. | Target; G-04 |
| TC-REV-002-01 | REV-02 | Given U-A and existing product, when uploading exactly three accepted 2 MiB images, then upload returns three URLs; a fourth or oversized image is rejected without successful review save. | Baseline |
| TC-RST-002-01 | RST-02 | Given a pending request, when the same email in different casing requests the same product/options, then already_subscribed is returned and pending count remains one. | Baseline |
| TC-RST-004-01 | RST-04 | Given S and M requests and only M stock restored, when notifying M, then only eligible M/whole-item requests are delivered; re-run, provider failure and size-less notification are checked separately. | Target eligibility plus baseline batching; G-12 |
| TC-RST-005-01 | RST-05 | Given a valid alert token, when using its unsubscribe URL twice, then record is absent and both valid-shape requests return confirmation; malformed token returns 400. | Baseline |
| TC-ADM-002-01 | ADM-02, AOR-01, STK-01 | Given admin_auth=1 without signed cookie, when calling admin order/stock APIs, then both deny authorization and no writes occur. | Baseline APIs; P0 |
| TC-ADM-003-01 | ADM-03 | Given a signed admin cookie, when sidebar logout succeeds, then cookie and local flag are absent, route is /admin and a private API returns 401. Failed logout retains state and allows retry. GET logout redirects 303 on the request origin; POST returns no-store JSON. | Baseline; resolved G-13 |
| TC-PRD-002-01 | PRD-02, ADM-02 | Given the checked-in base write policies and cookie-only administrator, when saving a catalog change, then verify persistence on reload and capture the permissions failure instead of trusting closed form. | Known-gap reproduction; G-06 |
| TC-STK-002-01 | STK-02, ADM-04 | Given P-SIZED S=0/M=4/L=5, when saving M=2 through stock API, then M is 2 and product stock is 7; refresh dashboard and verify inventory. | Baseline |
| TC-AOR-003-01 | AOR-03, ORD-02 | Given a pending U-A order, when admin sets processing, then persisted status and U-A history after reload show Processing. | Baseline |
| TC-ANL-001-01 | ANL-01, ANL-04 | Given known totals including a cancelled order, when loading analytics, then sum/average/top units use all loaded orders under baseline rules; cancelled-excluded metric is a separate owner decision. | Baseline |
| TC-OPS-002-01 | OPS-02–04, NFR-02 | Given production mode, when calling test reset/seed-user and dev create-user, then first two return 404 and dev helper returns 403; no mutation occurs. | Baseline |
| TC-CNT-001-01 | CNT-01 | Given footer form, when submitting valid email, then preview-only feedback appears and no subscription network write/email occurs. | Baseline demo |

For transaction rollback cases, ordinary precheck failure alone does not prove SQL rollback. Arrange a controlled stock change or database failure between precheck and transactional write in an isolated test environment; record before/after inventory and order counts. For concurrency cases use independent sessions, not one UI double-click alone.

## 6. Test execution layers and assertions

| Layer | What to prove |
|---|---|
| UI | Correct visible states, navigation, option choices, counts, validation and meaningful feedback |
| API | HTTP statuses/schema, authentication, input normalization, limits, supported values, no forbidden side effects |
| Database policy | Own-data isolation, public-read boundaries, write restrictions, checkout RPC execution permissions |
| Database transaction | Price/option snapshots, exact decrements, atomic rollback, no oversell or partial orders |
| Integration | Auth confirmation/reset, allowed storage uploads, current applied migrations, currency fallback, mail/provider outcomes |
| End-to-end | Guest discovery → registration/login → options/cart → each demo method → confirmation/history → admin status change |
| Quality | Agreed viewport/browser targets, keyboard/focus behavior, content consistency, performance under specified conditions |

Mock third-party rate and email responses for deterministic failure/boundary tests. Keep separate configured-integration smoke tests. Do not accept mocks as proof of actual database RLS, auth policy, transaction atomicity, image permissions or verified email sender delivery.

Some product-card/detail/navbar controls already expose data-testid, data-state, data-product-id or data-selected. Prefer accessible roles/names for visible actions and stable test IDs when necessary; do not treat hidden offscreen controls as interactable. Avoid fixed six-second sleeps for slides; use a controlled clock or wait for the expected observable change. A test timeout is not an application acceptance target.

## 7. Prompt for a test-generation tool

```text
Generate test cases for the zeouf website using docs/BRD.md,
docs/QA_TESTING_GUIDE.md and docs/REQUIREMENTS_TRACEABILITY.csv.

Treat the BRD as the business baseline, with the documented source state and
known gaps. Cover every exact requirement ID. Do not claim any case executed.
Do not invent functionality, business rules, credentials or fixture UUIDs.

For each case return:
test_id, requirement_ids, gap_ids, title, test_mode, priority, layer, role,
preconditions, fixture_data, steps, expected_ui, expected_http,
expected_database_changes, forbidden_side_effects, cleanup,
execution_status (Not executed), and automation_suitability.

Include positive, negative, boundary, permission, persistence and recovery
cases where applicable; explicitly cover P0 transactions and concurrency.
For C requirements specify environment prerequisites. For P/T requirements
separate baseline observations from target acceptance and mark known gaps.

Special boundaries:
- This is demo commerce: no real charges, card fields, card-number decline,
  actual shipment, refunds, taxes, coupon engine or guest checkout.
- Adding to cart requires sign-in; cart is browser-local and not account-bound.
- Search is name/category substring matching with deduplication.
- Colors share stock; demo photograph products hide color options.
- Public pending-review visibility, admin writes, account cart ownership,
  notification eligibility, inventory synchronization and order replay have gaps.
- Password confirmation and browser-cookie admin logout have scoped regression
  coverage; retain their resolved finding history without claiming full acceptance.
- Settings, user View, newsletter and unused countdown have documented limits.
- Checkout server truncates long shipping strings and uses current DB prices.
- A health response or reset response does not prove database readiness/cleanup.

Output a coverage table mapping every requirement ID to generated test IDs
and identify unanswered business decisions or missing environment inputs.
Do not normalize a known bug into a passing target acceptance criterion.
```

## 8. Acceptance evidence and maintenance

Use requirement execution summaries such as `Not executed`, `Passed`, `Failed`, `Blocked`, `Mixed` or `Not applicable`, with supporting test IDs. A requirement is Passed only when all applicable acceptance tests pass against the recorded build/environment. Mixed is appropriate when tests include both passing baseline behavior and failing intended acceptance. P/T test mode is independent of execution status.

Record absent features as exclusions or target requirements, never imaginary working cases. Record migration/config blockers separately from defects, and require owner decisions for undefined behavior. Revisit impacted cases when schema, options, ownership, rate limits, routes or copy change. Retain test history across BRD/CSV updates.

### Documentation regression coverage (OPS-06)

Run `npm run docs:test` with Node.js 20 or later. The suite creates isolated temporary documentation/source fixtures and removes only those fixtures; no Supabase, Docker, credentials or live data are required. It covers CSV quoting and multiline/manual/custom fields, unchanged results, changed/retired requirement archives, Needs retest after source review, invalid IDs/ranges/source codes, stale generated files, absent snapshots, unreviewed source changes, mismatched review evidence, broken links, retired-ID reuse and idempotent synchronization. Fingerprint scenarios cover line-ending normalization, deleted inputs and exclusion of local secrets/build output.

Then run `npm run docs:check` against the real repository and `npm run build`. A missing review or source drift must fail the documentation gate even after `docs:sync`; synchronization is not approval. Review requires a descriptive summary plus the actual affected IDs, or an explanation using `--no-functional-change`. Commit generated history, snapshot and review log together with the code/docs. These checks prove documentation tooling behavior; they do not establish passing website acceptance, database readiness, migration correctness or mail delivery. Keep the existing application gaps and execution statuses until separately tested.

### Storefront browser regressions (OPS-07)

Install dependencies with `npm ci`, install Chromium using `npx playwright install chromium`, then run `npm run test:ui` and `npm run test:catalog` sequentially. Each suite owns port 3100 and refuses a running server. Both disable live service-role/mail credentials and use a nonproduction fixture admin password. The storefront suite selects the local fallback client; signup/currency responses are mocked and admin cookie authorization executes locally. The catalog suite selects a configured client pointed at the reserved .invalid domain and intercepts its requests. Neither creates a live account, product, order or email. ISOLATED_BROWSER_TESTS=1 selects the .next-browser-tests compilation cache so tests can coexist with ordinary localhost development; generated types from that cache are included in tsconfig.json.

The storefront suite includes 16 local cases for restoration/normalization, malformed/unavailable storage, quantity persistence/reload, mismatch/blank/matching confirmation, real browser-cookie removal and failed logout retry, GET logout origin/cookie attributes, manual/reduced-motion/offscreen media, six editorial destinations, mobile clothing menus, desktop disclosure, drawer focus/Escape, photo failure and keyboard card actions, and mobile/tablet overflow. Six catalog cases cover all seven main categories, a slow response with Loading collection, product timeout with labelled demo fallback and retry recovery, stock-only timeout retaining live products, 503 recovery versus genuine empty results, and cancellation of abandoned requests. The deadlines bound the entire query, including auth-lock waits; aborting fetch alone is insufficient. Screenshots/traces use separate ignored test-results/storefront and test-results/catalog directories; CI uploads both. Turbopack uses an explicit project root; confirm built CSS matches source, await hydration and reset scroll before evaluating screenshots.

For CAT-07/CAT-08, hold requests with CAT-SLOW and assert Loading collection rather than coming-soon/empty copy. At eight seconds, assert that loading ends and demo fallback is clearly identified with Retry collection. Restore a successful response and retry: live products replace fallback and feedback disappears. With only CAT-STOCK-SLOW, retain fetched live products and show the size-availability warning. With CAT-EMPTY, preserve the real empty collection; no demo substitution or failure notice is expected. Stock error feedback does not prove stock readiness or resolve the missing-size-row policy in G-09.

These cases do not cover live Supabase signup/RLS/checkout, copied-token revocation, complete cart ownership policy, all keyboard/screen-reader paths or WCAG conformance. Verify hidden-tab media behavior, quota-limited writes, reveal/tab-reset behavior and provider failures in separate scenarios as needed. Keep overall requirement statuses separate from passing scoped regression cases; preserve G-01/G-13 history and the unresolved portion of G-10.

### README previews and capability accuracy

The README screenshots were refreshed from the `f6b916d` UI on 4 October 2026 using isolated fallback data, INR currency and reduced motion. Desktop previews use 1440px width; category captures include product names/prices. The dashboard uses local catalog data and an empty order-response fixture. Captures wait for fonts and visible images to load; full-page capture first scrolls through every section and checks all image loads before returning to the top. The development indicator is hidden only during capture. These images are presentation references, not evidence of live Supabase permissions, stock synchronization or mail delivery.

Review README links/images, English route labels, setup/migration sequence, current feature limitations and the checkout description when updating previews. CHK-04 has no card-number input or number-based decline simulation; the README portion of G-11 is corrected, while the misleading approval-or-decline UI label remains unresolved. The old database diagram is explicitly historical and must not substitute for the checked-in SQL migrations.
