# zeouf — QA coverage and test-generation guide

**Baseline:** Working copy based on merge `98ccf95`, reviewed 11 October 2026 for the Groq connection, quota handling and Zeouf Shopping Assistant display/privacy copy. Exact inputs and reviewer assertions are recorded in requirements-source-snapshot.json and requirements-reviews.json; earlier merged/pre-merge results below are historical scoped evidence. This guide accompanies [BRD.md](BRD.md) and [REQUIREMENTS_TRACEABILITY.csv](REQUIREMENTS_TRACEABILITY.csv). Test designs and reviewer assertions are separate from executed evidence.

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
| A-VALID | Admin cookie from a named account with its own scrypt password hash and separate session secret | Private reads/stock/moderation/status |
| A-EXPIRED / A-FORGED | Expired signed token / invalid signed token; separate browser context | Access denial |
| A-FLAGONLY | localStorage admin_auth=1 without valid admin cookie | UI flag versus API authority |
| P-UNSIZED | Bags product, price INR 1,000, no sizes/colors, stock 5 | Card quick-add, subtotal, unsized stock |
| P-SIZED | Women's Dress, price INR 2,500, sizes S/M/L; S=0, M=4, L=5; aggregate 9 | Size selection, stock boundaries, filters |
| P-LAST | Unsized Accessories product, price INR 500, stock 1 | Competing checkout, exact-stock purchase |
| P-ZERO | Perfume product, price INR 3,000, stock 0 | Unavailable card and restock |
| P-COLOR | Product with two named colors and verified distinct images; shared inventory | Color photography, variant merge, snapshots |
| P-DEMO | image_url starts /demo-products/; even if color metadata exists | Color suppression/single photograph |
| P-MISSING-SIZE | Product configured for S/M with one stock row missing | Missing row disables that size and transaction rejects purchase; specific-size alert selection remains G-09 |
| P-BLOUSE-OPTIONS | Local Brown Twist Blouse ID 7, image /kadin-bluz-1.jpg, sizes S/M/L, stock 0/4/5 and aggregate 9; staging UUID must be resolved separately | Mixed availability, quantity clamp to M=4, honest shipping copy |
| P-DRESS-OPTIONS / P-SIZED-ZERO | Demo dresses /demo-products/womens-dress/01.jpg and /05.jpg with S/M/L stocks 0/2/4 and 0/0/0; aggregates 6 and 0 | Color suppression, available-size selection, whole-product Notify me, disabled purchase |
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
| CHECKOUT-LOST | Configured .invalid fixture client with mocked customer session, one browser cart line and fictional address; first checkout request aborted, retry returns a mock saved order | Both methods, recoverable submit, cart preservation, same attempt key after reload; no live order creation |
| ATTEMPT-SAME / ATTEMPT-CHANGED | Same authenticated customer and UUID key with identical normalized payload / changed item, address or method | Original order/total replay after depletion / 409 without side effects |
| STOCK-STALE | Configured sizes S/M plus an obsolete Removed row with positive stock | Checkout/stock RPC aggregate excludes obsolete rows; does not prove catalog-edit synchronization |
| F-A / F-B | Different favorite sets for U-A and U-B | Database ownership/counts |
| R-PENDING / R-APPROVED | Known ratings, comments, ownership and approval flags | Public visibility, moderation, averages |
| R-WITHIMAGE | New private review-images object paths plus one historical public URL attached to separate reviews | Moderator signed URL, historical cleanup, public image presentation |
| O-STATUSSET | Orders in all five statuses, linked lines with known unit prices | Order filters/lifecycle/analytics |
| O-DELETED-PRODUCT | Order line retains quantity/unit price; product reference null | Historical fallback |
| N-SIZESET | Pending alerts for whole product, S, M, alternate color and different email casing | Matching, duplicate, delivery eligibility |
| IMG-VALID | JPEG/PNG/WebP each ≤2 MiB, including exact 2 MiB | Upload acceptance |
| IMG-INVALID | Empty or >2 MiB, unsupported MIME, declared type with wrong file signature, misleading extension, fourth file | Upload validation |
| AST-FAKE | Injected model/client dependencies and four named catalog fixtures, including zero-stock size and instruction-like product text; intercepted real SDK fetch with a fictional Groq key and 429 payload | Assistant tools, safe errors, SDK URL/auth/model, function-output round-trip, omitted store, no retries, card IDs, cached prices and denied anonymous cart reads; no real provider call |
| AST-WIDGET | Intercepted assistant response: first usage-limit 429, then a held response with literal HTML, catalog card and proposed add | Zeouf Shopping Assistant heading/privacy reminder, 390px layout, focus/Escape, Enter, typing/duplicate-send guard, quota message/retry and no cart change without Confirm |
| AST-GROQ-SMOKE | Separately configured Groq server key and one fictional in-memory tote bag, INR 1500, stock 3, no customer/cart | Opt-in live model search/function-output/card check without Supabase reads/writes; never print the key or include customer data |
| AST-STALE | Sized product with missing/obsolete rows, cached stock, requested unavailable size, and a proposal confirmed after stock/session change | G-26 source limits; separate reproduction and actual confirmation-outcome checks |

Seed scripts may change stock and insert sample orders. Measure final stock/records before testing. Current reset endpoint omits orders, auth users and browser localStorage and ignores delete failures. Do not use it as a guaranteed clean baseline. Never run destructive fixture setup against a shared or production database.

For newly inserted products, seed:products strips embedded size_stock from product payloads and inserts size rows afterward. Those writes are not one transaction: size-row failure leaves products, and a rerun skips them by name. Verify/repair in isolated staging. Existing named products keep their inventory unless explicitly changed by fixture setup. scripts/staging_product_options.sql is a manual fixture reset for all products matching the three image paths above; it preserves their UUIDs but overwrites sizes/stock and replaces size rows. Inspect the returned IDs/counts/values, including missing or duplicate image matches. Do not run it as a live migration or assume it executed during build. PGlite uses separate fixed UUIDs and data; local numeric IDs do not become production checkout IDs.

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
| Transactions | Later line fails, missing size row, stale aggregate row, competing last unit, crossed multi-product locks, concurrent stock edit/checkout, DB/RPC unavailable | CHK, STK, NFR |
| Replays | Missing/malformed key, identical retry after depletion, changed normalized payload, two customers sharing a key, simultaneous retries, lost response/reload, blocked sessionStorage; repeated alert/notification/unsubscribe | CHK, FAV, RST |
| Status/moderation | All statuses; backward transition; approve/delete; pending visibility and aggregates | AOR, ORD, REV, ANL |
| Failure UX | 400/401/409/429/500/503, network rejection, slow response, invalid response body | Forms, APIs, NFR-03 |
| Responsive/accessibility | 375/768/1440px proposal; exactly one nonnested main landmark, newsletter label/description; keyboard/focus/contrast/reduced motion | NAV, PDP, forms, admin |
| Product metadata | Name/category title with zeouf suffix, demo description and Open Graph values on seven families; collection and missing-product metadata | PDP-09 |
| Environment guards | Production blocks helpers; named admin hashes and independent secrets; shared limiter unavailable/working; secrets absent from client | OPS, ADM, NFR-02, NFR-08 |
| Content accuracy | Demo/no-charge/no-shipment; newsletter preview; no invented decline/promotion/settings | CNT, CHK, SET |

Use pairwise coverage for secondary UI combinations if useful, but explicitly cover every P0 rule and boundary. Do not use pairwise sampling to omit ownership, transaction rollback or stock concurrency.

## 5. Scenario seeds

These are starting cases. Expected unmet target behavior is explicitly marked; do not rewrite it as a passing description of the bug.

Unless testing missing-key validation or replay, every checkout API case needs a fresh UUID Idempotency-Key plus a valid customer bearer token and the purchase safeguards migration. Reuse the key only for an intentional same-attempt retry; use independent keys/customers for last-unit competition. Watch rate-limit counters so 429 does not mask the intended result.

| Test seed | Requirements | Given / When / Then | Mode |
|---|---|---|---|
| TC-NAV-006-01 | NAV-06 | Given a clean browser, when opening /kadin/elbise, then navigation reaches /women/dress and shows Dress listing; repeat for mapped legacy paths. | Baseline |
| TC-CAT-005-01 | CAT-03, CAT-05 | Given P-SIZED and selected S with In stock only, when filters apply, then this product is excluded; selected M includes it. | Baseline |
| TC-CAT-007-01 | CAT-07 | Given 49 matching products, when listing opens and Load More is clicked twice, then cards and Showing {visible} of 49 products both follow 24/48/49 and the final button is absent; filtering resets visible count to the first batch. | Baseline; automated batching, filter reset remains separate |
| TC-SEA-002-01 | SEA-02 | Given a product matching both name and category query, when searching different-case text, then it occurs once in results. | Baseline |
| TC-AUTH-002-01 | AUTH-02 | Given password A and confirmation B, when submitting, then mismatch alert appears and neither helper nor signup runs. Blank confirmation is required; matching values proceed without sending confirmation and clear it after success/tab change. | Baseline; resolved G-01 |
| TC-AST-001-01 | AST-01–05 | Given fake model/tool/widget fixtures, open chat, search under INR 2000, inspect missing-size/anonymous results, retry failed request and inspect escaped text, product links and proposed Confirm. The automated widget case asserts no cart mutation before Confirm but does not click it or establish a successful signed-in add. | Scoped baseline tests; live model and confirmed-cart end-to-end separate |
| TC-AST-002-01 | AST-02 | Given injected API deps and intercepted real SDK fetch, validate Groq endpoint/auth, function-output round-trip, omitted unsupported store, low reasoning, missing/blank key without OpenAI fallback, safe provider 429 with one request/no automatic retry, limiter responses and generic provider failure. Validate malformed/empty roles/text and 1,000-character bound. Add model override/default, 12/13/50/51 raw-history and 24,000-character body boundaries; only last 12 are validated/processed. | Scoped automated SDK/API checks; extra model/history/body boundaries remain separate scenarios |
| TC-AST-002-02 | AST-02, AST-03 | Given AST-GROQ-SMOKE, run the application chat loop with default model and ask for a tote under INR 2000. Require a searchProducts call, returned tool output, final nonfallback reply and fixture card. Record model, requests and fixture scope; do not upgrade the provider plan or mutate the catalog/cart. Repeat generated policy/variant questions in separately scoped staging. | Opt-in live provider smoke; not full model or production-site acceptance |
| TC-AST-003-01 | AST-03, AST-05 | Given AST-STALE, compare assistant search/availability/proposals with configured size rows and authoritative checkout; test empty/missing/obsolete rows and confirmation after sign-out or inventory changes. Record G-26, not a passing recommendation. | Known source gap; separate reproduction needed |
| TC-AST-006-01 | AST-06, CNT-03, NFR-07 | Given getStorePolicies all/shipping/returns/payment, returned policy facts state no actual charge/shipment/exchanges/returns/support and contain no free-shipping or 30-day-return promises. Live generated wording requires separate review. | Deterministic policy regression; provider prose unverified |
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
| TC-CHK-007-02 | CHK-06, CHK-07 | Given first line has stock and a later line fails inside the transaction, when checkout executes, then no order/lines/attempt remain and all inventory is unchanged. No separate API precheck exists. | Baseline; local SQL rollback regression, staging API evidence separate |
| TC-CHK-009-01 | CHK-09 | Given purchase safeguards and a valid attempt key, missing/invented size or required color, a size on an unsized item, or color on a no-color/demo-photo item returns invalid-option 400 with no writes. | Baseline contract; local SQL exceptions tested, live API/migration unverified G-08 |
| TC-CHK-009-02 | CHK-09 | Given a successful checkout, repeating the same authenticated customer/key/normalized payload returns its original order/total even after the last unit is gone, without changing counts or stock. | Baseline; local SQL regression, simultaneous live replay unverified G-14 |
| TC-CHK-009-03 | CHK-09 | Given an existing key, changing normalized items, address or payment returns 409 with no writes; another customer with the same key cannot read/replay that order and instead uses their own stock/order scope. | Baseline contract; local SQL regression, live API evidence separate |
| TC-CHK-009-04 | CHK-03, CHK-09 | Given an authenticated customer, omitted/malformed Idempotency-Key, malformed UUID, nonstring or trimmed size/color lengths above 30/40 returns 400 before purchase writes; duplicate entries merge and sorted equivalent payload replays the original order. | Baseline; staging API validation needed |
| TC-CHK-010-01 | CHK-08–10, CHK-04 | Given CHECKOUT-LOST for each demo method, first failure shows retry feedback, releases submit and keeps cart. Reload and re-enter identical details, then submit: same UUID key, demo confirmation, cleared cart and removed attempt storage, no delivery/email/support claim. Stored attempt contains only digest/key. | Baseline; mocked browser regression, not live transaction proof |
| TC-CHK-010-02 | CHK-10 | Given a retained attempt, changed customer/items/address/method generates a new key; blocked storage retains key only in memory. Closing the tab loses the reload guarantee. Malformed stored data and rapid clicks must be assessed separately. | Baseline contract; additional browser scenarios not executed |
| TC-PDP-003-01 | PDP-03–04, PDP-06, RST-01 | Given P-BLOUSE-OPTIONS, S is disabled; selecting M permits quantities up to four and blocks further increase; shipping panel makes no commercial promises. Given P-SIZED-ZERO, all sizes and purchase are disabled and whole-product Notify me is visible. Use the size-selection button name or a stable test ID, not card-only Add to bag. | Baseline; local fixture regression, specific unavailable-size alert remains G-09 |
| TC-PDP-009-01 | PDP-09 | Given one local product in each category family, detail title is name · category with zeouf suffix, description identifies product/demo and Open Graph title matches. Add collection/missing-product/image cases separately. | Baseline; seven-family title/description/OG-title regression, remaining metadata cases unexecuted |
| TC-NFR-005-01 | NFR-05 | Given home, listing, detail, search, favorites, checkout, orders, privacy and terms, each renders exactly one main and no main nested within main. Newsletter field has label/description. | Scoped regression; not WCAG acceptance |
| TC-ORD-001-01 | ORD-01, NFR-01 | Given orders for U-A and U-B, when U-A reads history and attempts a direct U-B order read, then only U-A's records are accessible. | Baseline with RLS evidence |
| TC-REV-004-01 | REV-04 | Given approved and pending reviews from U-A/U-B, when a visitor or U-B loads detail and public GET with approved=false, only approved feedback contributes; U-A may read own pending row directly. | Target pending live RLS/migration proof; G-04 |
| TC-REV-004-02 | REV-01, REV-04, NFR-01 | Given a customer token and public Supabase key, direct INSERT with approved=true, UPDATE approval/reply and DELETE all fail; POST /api/reviews creates only pending and validates owned image URLs. | Target live policy and API test; G-04 |
| TC-REV-003-01 | REV-03 | Given a comment and optional images, failed upload/API/network requests leave the form intact and show an error; successful 201 pending clears it and shows approval feedback without adding to public count/list. | Target configured integration |
| TC-REV-006-01 | REV-06, ADM-02 | Given approved and pending reviews, admin sidebar fetches all through a signed-cookie API while an unauthenticated direct API call returns 401; the sidebar remains read-only and direct pending moderation page remains separate. | Target protected admin list; G-05 |
| TC-REV-002-01 | REV-02 | Given U-A and existing product after the hardening migration, one to three real JPEG/PNG/WebP files within 1 byte–2 MiB return private object paths; an unauthenticated storage URL is denied and the moderator page shows ten-minute signed URLs. Empty/fourth/oversize/mismatched signature, invalid token/product and absent bucket fail. | Target applied storage integration |
| TC-REV-002-02 | REV-02, NFR-08 | Given U-A, the first ten valid upload requests in one day may pass and the eleventh returns 429 across separate app instances; failed review creation must not silently show a public review. Inspect orphan objects separately. | Target shared limiter and retention check |
| TC-RST-002-01 | RST-02 | Given a pending request, when the same email in different casing requests the same product/options, then already_subscribed is returned and pending count remains one. | Baseline |
| TC-RST-004-01 | RST-04 | Given S and M requests and only M stock restored, when notifying M, then only eligible M/whole-item requests are delivered; re-run, provider failure and size-less notification are checked separately. | Target eligibility plus baseline batching; G-12 |
| TC-RST-005-01 | RST-05 | Given a valid alert token, when using its unsubscribe URL twice, then record is absent and both valid-shape requests return confirmation; malformed token returns 400. | Baseline |
| TC-ADM-002-01 | ADM-02, AOR-01, STK-01 | Given admin_auth=1 without signed cookie, when calling admin order/stock APIs, then both deny authorization and no writes occur. | Baseline APIs; P0 |
| TC-ADM-001-01 | ADM-01, NFR-02 | Given two named admins and distinct password hashes, only matching username/password pairs receive a one-hour secure cookie; old DEV_CREATE_USER_KEY cannot sign in in production, and rotating ADMIN_SESSION_SECRET invalidates existing cookies. Test missing/short secrets and absent hashes. | Target production configuration and local fixture regression |
| TC-ADM-002-02 | ADM-02, REV-05 | Given customer token or old x-dev-key without signed admin cookie, DELETE /api/admin/reviews/{id} returns 401 and review remains; a valid cookie can delete. | Target protected mutation |
| TC-ADM-003-01 | ADM-03 | Given a signed admin cookie, when sidebar logout succeeds, then cookie and local flag are absent, route is /admin and a private API returns 401. Failed logout retains state and allows retry. GET logout redirects 303 on the request origin; POST returns no-store JSON. | Baseline; resolved G-13 |
| TC-PRD-002-01 | PRD-02, ADM-02 | Given the checked-in base write policies and cookie-only administrator, when saving a catalog change, then verify persistence on reload and capture the permissions failure instead of trusting closed form. | Known-gap reproduction; G-06 |
| TC-STK-002-01 | STK-02, ADM-04 | Given P-SIZED S=0/M=4/L=5 after purchase safeguards, when saving M=2 through stock API, then M is 2 and aggregate 7 atomically; refresh dashboard. Obsolete rows must not inflate aggregate. | Baseline; local RPC aggregate tested, staging API/dashboard separate |
| TC-STK-004-01 | STK-01–02, STK-04, NFR-01 | Given no signed cookie, PATCH denies 401. With cookie, negative/fraction/overflow stock and malformed UUID/type deny 400, absent service config gives 503; unknown product gives 404 and unsupported/omitted sized option gives 400 without stock changes. | Baseline; local API covers cookie/stock bounds/missing config, SQL covers option/product errors; live HTTP mapping separate |
| TC-STK-004-02 | STK-04, CHK-07 | Given independent staging sessions, run last-unit purchases, simultaneous identical-key retries, crossed multi-product orders, and stock edit versus checkout; assert no oversell, duplicate order, deadlock or inconsistent configured aggregate. | Target execution; single-connection PGlite cannot establish concurrency |
| TC-AOR-003-01 | AOR-03, ORD-02 | Given a pending U-A order, when admin sets processing, then persisted status and U-A history after reload show Processing. | Baseline |
| TC-ANL-001-01 | ANL-01, ANL-04 | Given known totals including a cancelled order, when loading analytics, then sum/average/top units use all loaded orders under baseline rules; cancelled-excluded metric is a separate owner decision. | Baseline |
| TC-OPS-002-01 | OPS-02–04, NFR-02 | Given production mode, when calling test reset/seed-user and dev create-user, then first two return 404 and dev helper returns 403; no mutation occurs. | Baseline |
| TC-NFR-008-01 | NFR-08 | Given two app instances behind a proxy that appends/overwrites x-forwarded-for, five admin attempts under the same address/account are allowed and the sixth is 429 across instances; unavailable limiter RPC/config returns 503. Repeat for checkout/review/restock boundaries. | Target deployed/shared database; local fallback is insufficient |
| TC-OPS-009-01 | OPS-09, NFR-01 | Given current purchase safeguards, inspector references removed four-argument RPC and cannot complete; record G-25. After inspector repair, inspect five-argument checkout/stock grants, private attempts RLS/grants, review/order/limiter policy and private bucket without writes/secrets; role-based behavior needs separate proof. | Known source gap G-25; target applied inspection not executed |
| TC-OPS-010-01 | OPS-10, CHK-05–09, STK-02, STK-04, NFR-01 | Run test:purchase with no live connection. Verify price/option snapshots, replay and changed-payload denial, customer key isolation, rollback, missing/obsolete size rows, stock membership/atomic total, denied anon/customer RPC/table access and removal of old RPC. | Scoped local SQL regression; no simultaneous-session or live integration proof |
| TC-CNT-001-01 | CNT-01 | Given footer form, preview limits are visible before entry and the email field is labelled; valid email displays no-save/no-send feedback and sends no subscription request. | Baseline demo; local browser regression |

For rollback cases, validation failure before writes does not prove SQL rollback. Arrange a later-line stock/option failure after an earlier line writes within the transaction; compare order/line/attempt counts and all inventory before/after. For concurrency use independent database sessions and customers, not one UI double-click or the single-connection PGlite suite.

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

Mock third-party rate and email responses for deterministic failure/boundary tests. Keep separate configured-integration smoke tests. Apply hardening after demo catalog/checkout, then purchase safeguards last in isolated staging; the new app requires the five-argument checkout RPC and stock RPC. Current security:check-db hardcodes the removed signature (G-25) and must be repaired before it can inspect this schema. Separately inspect definitions/grants/private attempts and use actual anon/customer/admin sessions to prove behavior. Do not accept mocks as proof of live RLS, auth policy, transaction atomicity, image permissions or mail delivery.

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
- Applied review-policy visibility, admin catalog/reply writes, account cart ownership,
  notification eligibility and catalog size-list synchronization need live verification or remain gaps.
- Current checkout requires a UUID attempt key, configured size/color options and the
  purchase safeguards migration. Exact same-customer/key/payload replay returns the
  original order; changed payload conflicts. Browser same-tab retries retain a digest/key.
  Single-connection SQL and mocked browser results do not prove live concurrency.
- The read-only security inspector still uses the removed checkout signature (G-25).
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

### Scoped verification on 10 October 2026

These pre-merge runs used the purchase/stock working copy later committed as 2059710. Its snapshot is retained in that commit and its reviews remain in the combined log. The current snapshot describes the merged code and must not be substituted for the tested pre-merge build. These are historical suite results, not full requirement acceptance or shopping-assistant evidence. At that review all manual/custom fields for 116 existing rows and all 146 prior history entries were preserved; three new requirements brought that branch to 119. The merged matrix also retains the incoming six AST requirements.

| Check | Observed result | Scope / limit |
|---|---|---|
| docs:check | Passed after synchronization/review | Documentation/source gate only |
| docs:test | 13 passed | Isolated documentation-tool regressions |
| lint | Passed with 28 warnings, zero errors | Existing unused-symbol/image warnings remain |
| build | Passed | Production compilation, TypeScript and static generation; no live checkout submission |
| test:purchase | 10 passed | Single-connection PGlite SQL/fixture tests; no live or concurrent-session proof |
| test:ui | 23 passed | Isolated fallback/customer/admin fixtures; sold-out selector corrected to the disabled Select a size control |
| test:catalog | 9 passed during the preceding assessment of the same source | Intercepted .invalid catalog/auth/checkout responses; source unchanged in this documentation update |
| test:live | 13 passed during the preceding assessment | Public deployed browsing only; deployed revision unverified and distinct from local working copy |

No live auth/order/stock/review/restock mutation, migration application, mail delivery or multi-session test was performed. G-25 is an inspected source incompatibility, not an executed live database failure. Repeat deployed checks after the new deployment and separately verify matching schema and roles in isolated staging.

### Merged-source verification on 10 October 2026

The merge working copy combines 2059710 and b431c0d, with assistant policies/prompt aligned to the demo restrictions and the assistant test configuration added to review fingerprints. Its exact inputs are captured by the regenerated merged source snapshot. Conflict resolution retained manual fields for all 119 local and 122 incoming rows, producing 125 requirements. Every history/review record from each branch was checked as present in the combined audit arrays; common records are shared, not discarded.

Observed merged checks: docs:check passed; docs:test 13 passed; test:purchase 10 passed; test:assistant 13 passed; test:ui 23 passed; production build passed; lint passed with zero errors and 28 warnings. These are scoped fixture/tool/build results. No current merged catalog or deployed-site suite was rerun, and earlier results above remain historical. No live provider, migration, authenticated database mutation, mail or multi-session test was performed. G-25/G-26 and other retained gaps remain open; no requirement execution field was changed to Passed by this merge review.

### Documentation regression coverage (OPS-06)

Run `npm run docs:test` with Node.js 20 or later. The suite creates isolated temporary documentation/source fixtures and removes only those fixtures; no Supabase, Docker, credentials or live data are required. It covers CSV quoting and multiline/manual/custom fields, unchanged results, changed/retired requirement archives, Needs retest after source review, invalid IDs/ranges/source codes, stale generated files, absent snapshots, unreviewed source changes, mismatched review evidence, broken links, retired-ID reuse and idempotent synchronization. Fingerprint scenarios cover line-ending normalization, deleted inputs and exclusion of local secrets/build output.

Then run `npm run docs:check` against the real repository and `npm run build`. A missing review or source drift must fail the documentation gate even after `docs:sync`; synchronization is not approval. Review requires a descriptive summary plus the actual affected IDs, or an explanation using `--no-functional-change`. Commit generated history, snapshot and review log together with the code/docs. These checks prove documentation tooling behavior; they do not establish passing website acceptance, database readiness, migration correctness or mail delivery. Keep the existing application gaps and execution statuses until separately tested.

### Storefront browser regressions (OPS-07)

Install dependencies with `npm ci`, install Chromium using `npx playwright install chromium`, then run `npm run test:ui` and `npm run test:catalog` sequentially. Each suite owns port 3100 and refuses a running server. Both disable live service-role/mail credentials; the storefront suite uses a named fixture admin hash and separate signing secret. The storefront suite selects the local fallback client; signup/currency responses are mocked and admin cookie authorization executes locally. The catalog suite selects a configured client pointed at the reserved .invalid domain and intercepts its requests. Neither creates a live account, product, order or email. ISOLATED_BROWSER_TESTS=1 selects the .next-browser-tests compilation cache so tests can coexist with ordinary localhost development; generated types from that cache are included in tsconfig.json.

The 23 storefront cases cover restoration/normalization, malformed/unavailable storage, quantity persistence/reload, confirmation validation, named admin denial, real cookie logout/retry, logout origin/cookie attributes, hero/media/navigation/focus, image failure/keyboard actions, responsive overflow, main landmarks, mixed/all-zero sized fixtures, product metadata in seven families, pre-submit newsletter limits and protected stock input validation. Nine catalog cases include the earlier six loading/fallback/recovery/cancellation cases, 24→48→49 counts and two mocked lost-response/reload checkout cases, one per payment method. Deadlines bound the entire query including auth-lock waits. Screenshots/traces use separate ignored test-results/storefront and test-results/catalog directories; CI uploads both and runs test:purchase before browser suites. Local fixture hashes/process-local limits do not prove the production shared limiter. Await hydration/reset scroll for screenshot comparisons.

For CAT-07/CAT-08, assert Showing 24/48/49 of 49 products alongside card counts, and check filtered totals/reset separately. Hold CAT-SLOW requests and assert Loading collection. At eight seconds loading ends with identified demo fallback and Retry collection. Successful retry replaces fallback and clears feedback; CAT-STOCK-SLOW retains live products with availability warning; CAT-EMPTY remains genuinely empty. Stock feedback does not prove live inventory readiness or resolve specific unavailable-size alert selection in G-09. Detail missing rows now disable size selection.

These cases do not cover live Supabase signup/RLS/checkout, copied-token revocation, complete cart ownership policy, all keyboard/screen-reader paths or WCAG conformance. Verify hidden-tab media behavior, quota-limited writes, reveal/tab-reset behavior and provider failures in separate scenarios as needed. Keep overall requirement statuses separate from passing scoped regression cases; preserve G-01/G-13 history and the unresolved portion of G-10.

### Isolated purchase SQL regressions (OPS-10)

Run npm run test:purchase after npm ci. scripts/purchase.test.mjs applies base, checkout security, demo catalog and purchase safeguards SQL to PGlite with minimal auth roles/schema, then resets only this in-memory instance between cases. No DATABASE_URL, Supabase account, service key, live reset or network is used. It does not apply the full review/storage/rate-limit hardening stack and must not stand in for those integrations. Ten cases check original-order replay after depletion, changed items/address/method conflicts, customer-scoped keys, rejected size/color combinations, shared-color snapshots, later-line rollback including attempts, missing-row stock edits, obsolete-row totals, denied customer RPC/private-table access and staging fixture UUID preservation. It uses one connection: last-unit competition, simultaneous retries and stock-versus-checkout lock behavior need independent staging sessions. SQL exceptions prove local transaction behavior; they do not by themselves prove HTTP error mappings or live policy state.

### Shopping assistant regressions (AST-01–06, OPS-07)

Run npm run test:assistant sequentially with UI/catalog suites after npm ci and installing Chromium. Its configuration starts an isolated development server, explicitly blanks GROQ_API_KEY/GROQ_MODEL to override local environment files, uses the fallback catalog and fake model clients/intercepted SDK/widget requests, and writes test-results/assistant. ASSISTANT_TEST_PORT changes the port but does not provide a separate compilation cache, so it is not authorization for parallel browser suites. No provider key, live model, account, database mutation or email is needed.

Sixteen cases cover search/argument validation, untrusted product text, approved card IDs, anonymous versus verified-token browser cart input, proposal-only adds, missing options/stock limits, model fallback/tool-loop termination, API errors, fallback catalog integration, widget focus/Enter/retry/HTML text and category grouping, plus Groq SDK wire format/function-output round-trip, missing/blank key without OpenAI fallback and provider 429 with no automatic retry. The widget verifies the display name, privacy reminder and usage-limit error before Retry. Policy facts are aligned with the demo copy. The widget case does not click Confirm or prove a completed signed-in addition, cross-account chat isolation, live model grounding, provider retention or concurrent rate limiting. G-26 availability/cached-option/confirmation limits remain open. Model text is instructed rather than structurally guaranteed; test generated answers manually in separately configured staging.

**11 October 2026 execution:** all 16 assistant regressions passed locally. A separate live smoke used the actual createGroqClient/default model and runAssistant loop with AST-GROQ-SMOKE: openai/gpt-oss-20b made two provider requests, called searchProducts, consumed its function output and returned one fixture-derived product card with a nonfallback reply and no cart proposals. Only the fictional prompt/tool facts were sent; no Supabase reads, customer identity, catalog/cart mutations or key output occurred. This proves that scoped connection/tool exchange, not live website catalog accuracy, policy compliance across prompts, successful Confirm, quota capacity or full acceptance. Other test results elsewhere in this guide remain historical until rerun on this working copy.

### Deployed-site browsing checks (OPS-08)

After installing Chromium, run `npm run test:live`. The default target is the public Vercel storefront; PLAYWRIGHT_BASE_URL can select another accessible HTTP(S) origin without credentials, path, query or fragment. This configuration has no webServer entry and launches no localhost process. Fresh browser contexts use reduced motion, no saved authentication state, one worker and no retries. Live results belong to the deployed revision/environment at execution time; record that revision separately from local fixture results.

The 13 cases check homepage/manual hero links, all seven populated collections without loading/empty/fallback warnings, name/category search, card-to-detail correspondence, mobile clothing navigation/overflow, privacy/terms accessibility and admin login rendering. The context intercepts and blocks non-GET/HEAD/OPTIONS methods plus known helper/logout paths, and asserts that no blocked request was attempted. No login, signup, checkout, favorite, review, restock, seed/reset or admin write is submitted. State-changing scenarios continue to use the isolated local suites or a separately scoped staging environment with dedicated identities.

Failures retain screenshots/traces under test-results/live. This opt-in suite does not run in the push workflow, which may execute before the new deployment is ready. Healthy browsing does not prove live authentication, purchase/stock integrity, email delivery, admin authorization or complete site acceptance. An empty or deliberately unavailable demo catalog is a failed populated-collection smoke assumption, not proof of a loading defect.

### README previews and capability accuracy

The README screenshots were refreshed from the `f6b916d` UI on 4 October 2026 using isolated fallback data, INR currency and reduced motion. Desktop previews use 1440px width; category captures include product names/prices. The dashboard uses local catalog data and an empty order-response fixture. Captures wait for fonts and visible images to load; full-page capture first scrolls through every section and checks all image loads before returning to the top. The development indicator is hidden only during capture. These images are presentation references, not evidence of live Supabase permissions, stock synchronization or mail delivery.

Review README links/images, English route labels, setup/migration sequence, current feature limitations and checkout description when updating previews. CHK-04 has no card-number input or decline simulation; both README and UI now describe successful simulation with no charge (historical G-11). Detail shipping overrides and demo confirmation/footer/history/privacy deny fulfillment/support. The old database diagram remains historical and must not substitute for current SQL migrations.
