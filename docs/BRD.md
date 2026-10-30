# zeouf website — Business Requirements Document

| Document control | Value |
|---|---|
| Version | 2.0 |
| Prepared | 2 October 2026 |
| Product | zeouf — Luxury Fashion & Lifestyle |
| Baseline | Working copy reviewed 30 October 2026 for assistant exact-match/alternative disclosure and pending password recovery, unified review moderation, order lifecycle, profile dialogs, settings feedback, audit tooling and dependency changes. Snapshot/review log identify inspected inputs; dated execution evidence and unresolved live gaps remain separate. |
| Status | Draft for business and QA review; no stakeholder sign-off recorded |
| Audience | Customers, product owner, administrators, developers, manual testers, and test-generation tools |
| Evidence | Source inspection and scoped local SQL/API/browser/build evidence are recorded separately in the QA guide. Existing assistant live-fixture smoke is historical. No full acceptance, applied live catalog migration, real storage upload, complete live security inspection or multi-session concurrency is established. |

## Contents

1. [Purpose and business objectives](#1-purpose-and-business-objectives)
2. [Scope and feature overview](#2-scope-and-feature-overview)
3. [Roles and permissions](#3-roles-and-permissions)
4. [Website pages and navigation](#4-website-pages-and-navigation)
5. [User journeys](#5-user-journeys)
6. [Functional requirements](#6-functional-requirements)
7. [Business rules and validation](#7-business-rules-and-validation)
8. [Data and persistence](#8-data-and-persistence)
9. [Integrations and API inventory](#9-integrations-and-api-inventory)
10. [Nonfunctional requirements](#10-nonfunctional-requirements)
11. [Dependencies and environment readiness](#11-dependencies-and-environment-readiness)
12. [Known gaps and business decisions](#12-known-gaps-and-business-decisions)
13. [Testing and acceptance](#13-testing-and-acceptance)
14. [Source index](#14-source-index)
15. [Glossary and sign-off](#15-glossary-and-sign-off)

## 1. Purpose and business objectives

This document explains what the website does, who can use each function, the rules behind those functions, and what testers should check. Each requirement has a stable ID so test cases, defects, and release decisions can refer to the same functionality.

zeouf presents a luxury fashion and lifestyle catalog across women, men, perfume, shoes, accessories, bags, and makeup. Customers can discover products, select options, save favorites, and place demonstration orders. Administrators can inspect store activity and use the available catalog, inventory, order, and moderation tools.

**The current product is a portfolio demonstration.** Checkout saves demo orders and changes demo inventory when configured, but does not charge money or arrange delivery. Business acceptance must preserve that distinction in customer-facing copy.

| Objective | Business outcome | Suggested measure, pending owner approval |
|---|---|---|
| BO-01: Product discovery | Customers find suitable products through categories, search, and filters. | All published navigation paths resolve; discovery tests cover every category. |
| BO-02: Understand products | Customers see prices, photographs, sizes, stock, and relevant product information. | Product-option and availability requirements have traceable passing tests. |
| BO-03: Save shopping intent | Signed-in customers manage favorites and a browser-persisted cart. | Favorites remain account-specific; cart totals match selected variants and quantities. |
| BO-04: Demonstrate ordering | Customers place a complete demo order using trusted prices and available stock. | Both payment choices pass; failed transactions leave no partial order or stock change. |
| BO-05: Operate the catalog | Administrators inspect inventory, orders, customer profiles, and feedback. | Admin acceptance tests distinguish available actions from incomplete controls. |
| BO-06: Speed up QA | Testers generate cases from an explicit feature and rule inventory. | Every requirement has linked tests or a documented exclusion/blocker. |

No conversion, sales, traffic, uptime, or speed target has been supplied. Suggested quality targets below are proposals, not measured results or agreed service commitments.

## 2. Scope and feature overview

| Area | What the user can understand or do | Current boundary |
|---|---|---|
| Home and navigation | Browse one active campaign video or still poster, editorial collection links, seven category links, account, search, favorites, and cart. | Campaign content is defined in code; media pauses offscreen, in hidden tabs, on explicit pause, or for reduced motion. |
| Catalog | Browse seven main categories, clothing subcategories and highlights; filter, sort, and load more. | Listings can fall back to a local catalog. |
| Search | Search product names and category text. | Case-insensitive substring search; no relevance engine, suggestions, or full-text index established. |
| Product details | Inspect photographs, verified color options, size choices, quantity, size guide, information panels, related products, and reviews; share product-specific page metadata. | Demo-image products hide color choices; some descriptive content uses generic fallback copy; shipping text always reflects demo limits. |
| Account | Register with matching confirmation, sign in/out, reveal password, request a reset email and set a new password at /reset-password. | Recovery requires a valid Supabase session, configured email delivery and allowed redirect destination; live link completion remains unverified. |
| Favorites | Save/remove products and see saved products and counts. | Requires a customer session and database. |
| Cart | Restore validated saved lines, recover malformed data, add chosen options, change quantities, remove lines, see totals, proceed to checkout. | Adding requires sign-in; cart stays browser-wide. Unavailable storage permits in-memory use with feedback. |
| Checkout | Enter contact/address details, choose demo card or simulated cash on delivery, save an order with an attempt key and retry unchanged details safely. | Requires purchase safeguards migration; no card fields, actual charges, tax/shipping calculation, or delivery integration. |
| Order history | Read one's own orders and expand product lines. | No customer cancellation, refunds, tracking number, or reorder action. |
| Reviews | Submit display name/stars/comments and optional photos; read approved feedback, store replies and signed photo links. Admins approve/unpublish/delete and save/remove replies in one queue. | Requires current schema, private storage and service role; historical media and orphan cleanup remain gaps. |
| Restock alerts | Save an email request; administrator stock updates can trigger email; unsubscribe through a token link. | Delivery is optional and batch-limited; notification eligibility has gaps. |
| Admin | Login, dashboard, products, stock, orders, users, analytics, reviews, settings. | Catalog writes/uploads use signed-cookie server routes and service-only persistence. Applied permissions, schema, read-only/informational controls and other retained gaps still require verification. |
| Information pages | Read terms, privacy notice, and portfolio/demo explanations. | They do not establish a commercial store policy or operational fulfillment service. |
| Newsletter | Read preview limits before entering an email-shaped value and trying the preview UI. | No subscription record or email is sent. |
| Shopping assistant | Ask catalog/policy questions, follow up on ordered product cards, compare up to three products, find similar items, select options and confirm proposed bag additions. | Free-text chat requires server model configuration; card actions use validated tools without a model. Facts come from catalog/tool copy, display budgets support INR/USD, and requests have overall deadlines. Browser cart, cached recommendations and live concurrency limits remain G-26. No checkout/order/account tools. |
| QA utilities | Application health, protected nonproduction reset/user setup, development user creation, schema text. | QA utilities are not customer features; reset is not a proven complete clean-up. |

**Outside the current scope:** real payment gateways; guest checkout; shipping/carrier fulfillment; invoices; tax calculation; coupon/discount engine; returns/refunds workflow; customer profile/address editing; social login/MFA; a standalone comparison page (assistant card comparison is supported); localization beyond existing English presentation and legacy URL compatibility; admin roles/audit logs; full newsletter delivery; exports; editable store settings; independent color inventory. These must not be generated as implemented acceptance tests. Future work needs separate requirements and approval of scope.

## 3. Roles and permissions

| Capability | Visitor | Signed-in customer | Administrator |
|---|---|---|---|
| Home, catalog, search, product information, public information pages | Yes | Yes | Can visit storefront |
| Read reviews | Yes, under present read policy | Yes | Yes |
| Add products to cart | Opens account prompt | Yes | Only with a separate customer session |
| View/edit existing browser cart | Existing local cart may be visible | Yes | Browser-state dependent |
| Add/remove favorites | Opens account prompt | Own favorites | No administrator impersonation flow |
| Submit review or upload review images | No | Yes | Separate customer session required |
| Save restock email request/unsubscribe with token | Yes | Yes | Yes |
| Place demo order | No | Yes | Separate customer session required |
| Read customer order history | Sign-in message | Own orders only | Admin order API can read all orders |
| Admin dashboard/product/stock/order/user/review areas | Login required by intended design | Customer login grants no admin rights | Separate admin credential/cookie; known permission gaps below |
| Protected QA helper APIs | No ordinary access | No ordinary access | Separate nonproduction test secret; admin cookie is insufficient |

An admin session uses its own signed cookie. It is not a Supabase customer identity or database role. A local `admin_auth` flag drives navigation but must not be treated as authorization.

## 4. Website pages and navigation

### Public pages

| Route / entry point | Function | Key links / access |
|---|---|---|
| `/` | Home: women/men hero with pause/manual controls, seven-category navigation, two collection panels, six editorial tiles, blouse edit and demo explanation | Editorial links lead to category/listing pages. One active local video replaces multiple simultaneous videos and the third-party closing embed. |
| `/women`, `/men` | All products for a clothing main category | Subcategory/highlight mega menus and mobile navigation |
| `/perfume`, `/shoes`, `/accessories`, `/bags`, `/makeup` | Remaining main-category listings | Main navigation/footer |
| `/women/dress`, `/women/blouse`, `/women/jacket`, `/women/skirt`, `/women/trousers` | Clothing subcategories | Catalog and mega menu |
| `/men/suits`, `/men/shirts`, `/men/trousers`, `/men/jacket` | Clothing subcategories | Catalog and mega menu |
| `/women/new-arrivals`, `/women/best-sellers`, `/women/collection` | Women's highlight collections | Tag-derived highlights; collection is the main category |
| `/men/new-arrivals`, `/men/best-sellers`, `/men/collection` | Men's highlight collections | Same rules as women |
| `/{main-category}/{product-id}` | Product details | Product card image/name; identifiers are normally database UUIDs |
| `/search?q={encoded-query}` | Search results | Header search overlay |
| `/favorites` | Saved product list | Header/footer favorite links |
| `/checkout` | Demo order form, summary, then confirmation | Cart drawer; authenticated submission |
| `/orders` | Customer order history including saved size/color | Account panel; own session |
| `/reset-password` | Verify recovery/current session, update a confirmed new password, or request a new link | Public route; valid verified Supabase session required to update; noindex/nofollow |
| `/privacy`, `/terms` | Demo privacy information and terms | Footer/account links; return-home links |
| Account panel | Sign in/register/reset-email request and signed-in order-history/sign-out controls | Header icon or gated action; no dedicated account URL |
| Shopping assistant panel | Non-modal catalog/policy chat, ordered references, comparison/similar actions, option selection and proposed add-to-bag confirmation; View bag opens the existing drawer | Floating launcher on non-admin pages; no dedicated comparison or bag page URL; POST /api/assistant; POST /api/assistant/confirm |
| Cart drawer | Browser cart, quantity/removal controls and checkout link | Header cart icon or successful add |
| Size guide overlay | XS–L chest/waist reference | Product detail size-guide button |

English URLs are rewrites to existing Turkish-named source directories. Legacy `/kadin`, `/erkek`, `/parfum`, `/ayakkabi`, `/canta`, `/aksesuar`, `/makyaj`, `/arama`, `/favorilerim`, and `/kullanim-kosullari` redirect permanently to their English equivalents. Specific legacy clothing slugs also translate, e.g. `/kadin/elbise` to `/women/dress`. Test redirects as navigation, not as separate duplicate features. Unrecognized product/subcategory values should produce the framework not-found page. Product helpers also support numeric local fixture IDs and attempt slug lookup; a database `slug` column is not part of the base schema.

### Administrator pages

| Entry | Function / route behavior |
|---|---|
| `/admin` | Username/password browser login; production uses named hash entries |
| `/admin/dashboard` | Inventory snapshot, five recent orders, quick-access links |
| `/admin/products` | Catalog table, name search, category filter, add/edit/delete form |
| Stock Management sidebar item | Stock editing within `AdminApp`; no standalone `/admin/stock` page exists |
| `/admin/orders` | Search/filter orders; open detail modal; change status |
| `/admin/users` | Profile list; View opens a read-only dialog with customer-order search shortcut |
| `/admin/analytics` | Order, inventory, top-product, and review summaries |
| `/admin/reviews` entered directly | Shared AdminApp review queue with pending/approved/all filters, moderation, replies and signed attachments |
| Reviews sidebar item within `AdminApp` | Same queue and protected API as the direct route |
| `/admin/settings` | Read-only store/catalog/database summary |

Sidebar navigation changes component state, not the browser URL. A refresh restores the page associated with the route originally opened. The storefront header/footer are omitted on admin pages.

## 5. User journeys

| Journey | Preconditions | Main flow | Result / exceptions | Requirements |
|---|---|---|---|---|
| J-01 Discover and inspect | Visitor; local or configured catalog | Home → category/subcategory → filters/sort/load more → card → product detail | Matching products or empty state; unsupported ID gives not-found | NAV-01–07, CAT-01–08, PDP-01–06 |
| J-02 Find by search | Visitor | Open search → enter query → submit → results → product | Name/category substring matches, deduplicated; blank header search stays put | SEA-01–03, PDP-01 |
| J-03 Create/use account | Auth configured | Account → Register → matching password/confirmation → submit → verification if configured → Sign In | Session activates customer features; validation/provider errors stay in account panel | AUTH-01–07 |
| J-04 Save for later | Customer signed in | Heart on card/detail → favorites page → remove heart | Account-specific favorites/count update; visitor gets prompt | FAV-01–03 |
| J-05 Build cart | Customer; purchasable product | Select size/color if offered → quantity → add → drawer → edit/remove → refresh | Variant lines persist in this browser; inventory rechecked at checkout | PDP-03–04, CART-01–06 |
| J-06 Place demo order | Customer; nonempty cart; server/database ready | Checkout → all shipping fields → demo method → submit → confirmation → history | One pending demo order, trusted price snapshot, inventory reduction, cleared cart; failure keeps cart and the attempt key for unchanged retries | CHK-01–10, ORD-01–03 |
| J-07 Leave feedback | Customer; review schema/storage ready | Detail → name/stars/comment → optional images → submit | Saved pending record and approval acknowledgement; failed input remains available to retry | REV-01–07 |
| J-08 Get restock notice | Unavailable item/size; alert database ready | Email request → pending subscription → admin adds stock → optional email → unsubscribe | Duplicate pending request reused; missing mail config saves request; eligibility/UI gaps apply | RST-01–05, STK-01–04 |
| J-09 Maintain products | Admin session and write permissions | Admin → Products → create/edit/images/sizes → stock view → publish through saved data | Database permission and size synchronization gaps can block intended save | ADM-01–04, PRD-01–06, STK-01–04 |
| J-10 Operate store | Admin session; orders/reviews exist | Dashboard → orders → status update → analytics; direct reviews route → moderation | Customers see changed status on reload; permitted pre-shipment cancellation restores existing inventory once | AOR-01–04, ANL-01–05, REV-05–07 |

```mermaid
flowchart LR
  A[Browse or search] --> B[Product details]
  B --> C{Customer signed in?}
  C -->|No| D[Account prompt]
  D --> B
  C -->|Yes| E[Choose options and add to cart]
  E --> F[Demo checkout]
  F --> G{Session, details and stock valid?}
  G -->|No| H[Error; keep cart]
  H --> F
  G -->|Yes| I[Save order and reduce demo stock]
  I --> J[Confirmation; clear cart]
  J --> K[Own order history]
  I --> L[Admin orders and analytics]
```

## 6. Functional requirements

### How to read the requirement tables

**State:** `I` = behavior present in inspected source; `C` = present but depends on configured services/schema/permissions; `D` = deliberate demo/preview behavior; `P` = partial or inconsistent implementation; `T` = proposed target without complete implementation. None of these states means a test has passed. For P/T rows, acceptance text states intended behavior and names the gap; generate target tests with an explicit known-gap label. For I/C/D rows, acceptance text describes the source baseline.

**Priority:** P0 = access/data/order integrity; P1 = core customer/admin function; P2 = secondary presentation or convenience. These are suggested QA priorities, pending owner review. Source codes resolve in section 14. The CSV mirrors these rows and leaves execution/test-link fields open.

The catalogue contains 132 requirements across 20 modules (including nonfunctional requirements), with **26 source-level gap findings** tracked in section 12.

### 6.1 Home, navigation, and routes

| ID | Priority | State | Requirement and acceptance criteria | Source | QA focus |
|---|---|---|---|---|---|
| NAV-01 | P1 | I | Home shall show women/men hero content and matching links, with one active local video or still poster, manual slide selection and pause/play. Automatic change occurs about every six seconds while at least 10% visible, tab visible, unpaused and reduced motion disabled. Offscreen/hidden/paused media stops; reduced motion uses still imagery and manual selection. | HOME | Active-only playback, posters, manual selection, pause, offscreen/hidden tab, reduced motion |
| NAV-02 | P1 | I | Two collection panels, seven category links, six editorial tiles and the blouse edit shall navigate to configured category/subcategory destinations. The compact homepage uses consistent typography/spacing and explicit demo copy; editorial tiles remain curated category links. | HOME | Every CTA/destination, 375/768/1440 widths, image loading |
| NAV-03 | P1 | I | Desktop navigation shall expose seven categories and women's/men's subcategory/highlight menus, with pointer hover and keyboard-operable expanded-state disclosure controls. Escape closes menus and restores focus to the corresponding disclosure button, including when a menu link holds focus; closed menu links are inert. | NAV, CATDEF | Hover, disclosure click/Enter, Escape from link/disclosure, trigger focus restoration, inert links, current route |
| NAV-04 | P1 | I | Mobile navigation shall open/close, expose seven category links and expandable women's/men's clothing/highlight sections, and close after navigation or Escape. | NAV | Touch, narrow screen, subcategories, dismissal and focus restoration |
| NAV-05 | P1 | I | Header shall expose account, search, favorites and cart; logo returns home. Active account/cart/search/mobile dialogs lock background scrolling, contain keyboard focus, and support Escape/close/backdrop dismissal with focus restoration; closed drawers are inert. | NAV, SHELL | Dialog roles, Tab/Shift+Tab, Escape, counts, scroll lock, focus restoration |
| NAV-06 | P1 | I | English URLs and their legacy redirects/rewrites shall resolve to the intended page, including mapped legacy clothing slugs. | ROUTE | Direct URL, encoded query, redirect destination |
| NAV-07 | P1 | I | Unknown product/subcategory routes shall reach not-found; storefront chrome shall be absent from admin pages. | ROUTE, DETAILROUTE, SHELL | Missing ID, route refresh, admin layout |

### 6.2 Catalog listing

| ID | Priority | State | Requirement and acceptance criteria | Source | QA focus |
|---|---|---|---|---|---|
| CAT-01 | P1 | I | Listings shall restrict products to the selected category/subcategory using configured English categories and normalized matching. Ordinary subcategory matches shall also require membership of the selected main collection, so /men/trousers excludes Women's Trousers and /men/jacket excludes Women's Jacket. Existing main-category normalization/aliases and new-arrivals, best-sellers and collection tag-route rules remain applicable to live and fallback catalogs. | LIST, CATDEF | All 14 database categories, mixed men's/women's trousers and jackets, alias/normalization cases, tag routes, live/fallback catalogs |
| CAT-02 | P1 | I | New Arrivals shall match tags containing new; Best Sellers shall match best/featured/populer tags; Collection shall include the main category. No sales ranking is implied. | LIST | Tags, main-category boundary, English/legacy slugs |
| CAT-03 | P1 | I | Brand and size filters shall use distinct values in the current collection and combine with other selected filters; missing option groups shall not show unusable selectors. | LIST | Single and combined filters, missing metadata |
| CAT-04 | P1 | I | Price filters shall apply inclusive displayed-currency min/max bounds through two sliders and suggested Under tiers; sliders shall not cross; currency changes clear price bounds. | LIST, CURRENCY | Boundary prices, tier rounding, currency change |
| CAT-05 | P1 | I | In stock only shall keep unsized products with positive stock and sized products with available size stock; selected size shall constrain availability when stock rows exist. | LIST | Stock 0/1, mixed sizes, missing size rows |
| CAT-06 | P1 | I | Sort shall offer Recommended, Price Low to High, Price High to Low, and New Arrivals; listing price ties use name; New Arrivals prioritizes new tags then date then name. Recommended retains incoming order. | LIST | Equal price/date, missing date/tag |
| CAT-07 | P1 | I | Listing shall initially reveal at most 24 matches and load 24 more per click; count shall say Showing {visible} of {matching} products, following filters and the final batch. Changing brand, size, stock-only or either price bound, including clearing filters, shall reset the reveal limit to 24. After revealing all 49 products, applying a brand matching 30 shall show 24 cards, Showing 24 of 30 products and Load More; the next click reveals the remaining six and hides Load More. Pending requests show Loading collection, distinct from genuine empty collections and no-filter-match results. | LIST, UITEST | Pending request, 0/1/24/25/48/49 products, count text, final batch, each filter reset, removing filters, clear all, 49-to-30 brand regression |
| CAT-08 | P1 | I | Listing shall use local products when Supabase is unconfigured or product fetch fails. Configured product and stock operations each have an eight-second deadline and cancel on cleanup. Product failure/timeout shows identified demo fallback and Retry collection; stock-only failure/timeout retains live products with availability warning and retry. Successful retry clears feedback; a successful empty product response stays empty. Fallback browsing does not establish working order/auth services. | LIST, DBCLIENT, CATREQUEST | Product/stock slow, error and empty responses; timeout, cancellation, retry, genuine empty versus demo fallback |

### 6.3 Search

| ID | Priority | State | Requirement and acceptance criteria | Source | QA focus |
|---|---|---|---|---|---|
| SEA-01 | P1 | I | Header search shall focus its field, trim input, ignore empty submission, encode the query, close the search UI and navigate to /search?q=…. | NAV | Spaces, ampersand, Unicode, keyboard submit |
| SEA-02 | P1 | I | Results shall combine case-insensitive name and category substring queries and deduplicate by product ID. | SEARCH, DBCLIENT | Name-only/category-only/both matches, case, no matches |
| SEA-03 | P2 | P | Search shall show loading, query/count, results, and no-results states; explicit service-error/retry handling and clearing old results for a blank query are incomplete (G-15). | SEARCH | Slow/error responses, rapid query changes, blank after valid query |

### 6.4 Product cards and details

| ID | Priority | State | Requirement and acceptance criteria | Source | QA focus |
|---|---|---|---|---|---|
| PDP-01 | P1 | I | Cards/detail shall present name, price, image, optional brand/tag/category and product links; detail uses applicable gallery thumbnails. Cards use consistent crops and responsive image sizes, show loading placeholders, and retain readable product information with Image unavailable feedback after photo failure. | CARD, DETAIL | Selected-card destination, exact product heading and detail controls, pending navigation/browser errors, single/multiple/missing images, supported remote host, loading/failure state |
| PDP-02 | P1 | I | Verified color options shall expose named swatches and applicable images; selected color accompanies cart line. Products under /demo-products/ shall hide colors and use one demo photograph. | CARD, DETAIL | Color/image correspondence, no-color/demo fixtures |
| PDP-03 | P0 | P | Sized products shall require a chosen available size before add; zero or missing stock rows disable the size. Detail initializes from supplied size_stock then refreshes database rows; the local fallback supplies fixture rows. All-sold-out fixtures expose a whole-product restock form and disable purchase. Selecting a specific unavailable size for an alert remains unresolved (G-09). | DETAIL, DBCLIENT, SEED | No size, zero/missing row, mixed/all-zero stock, initial versus refreshed rows, unavailable-size alert gap |
| PDP-04 | P1 | I | Detail quantity shall start at one, not decrease below one, clamp to known positive available stock, and disable add/increase when the known limit is reached. | DETAIL | 1, stock limit, size change, unknown stock |
| PDP-05 | P2 | I | Size guide shall open/close and show XS/S/M/L chest and waist references; it is a static clothing reference, not a product-specific shoe or XL/XXL guide. | DETAIL | Overlay dismissal and reference values |
| PDP-06 | P2 | I | Detail shall offer one-open-at-a-time information panels for details, measurements, composition/care/origin, and shipping/exchanges/returns. Product information uses supplied text or generic fallback; shipping content always states no charge, shipment, exchanges, returns or support follow-up and asks for fictional details, overriding any product shipping promises. | DETAIL | Open/switch/close, newline content, defaults, supplied shipping promises cannot override demo limits |
| PDP-07 | P2 | I | Complete Your Look shall show up to eight other products whose category starts with the main category; the current product is excluded and an empty related section is hidden. | DETAIL | 0/1/8 related items, links, horizontal scroll |
| PDP-08 | P1 | I | In-stock unsized cards shall allow Add to bag; sized cards link to size selection; out-of-stock cards display unavailable status and omit purchase controls. Actions are visible on touch layouts and reveal on hover or keyboard focus on desktop; favorite controls remain visible with pressed state. | CARD | Sized/unsized/out-of-stock, guest prompt, touch/keyboard/hover actions |
| PDP-09 | P2 | I | Dynamic routes in all seven category families shall generate product-specific titles identifying name/category with the root zeouf suffix, demo descriptions and Open Graph title/description/image when supplied. Recognized clothing subcategories get collection metadata; missing products request no indexing/following. Product lookup is memoized within a server render. Metadata does not enforce category-path ownership (G-08). | PRODUCTMETA, DETAILROUTE, DBCLIENT, SHELL | Seven product families, collection slugs, absent product, Open Graph values, category-path gap |

The [17 October product-navigation investigation](PRODUCT_NAVIGATION_INVESTIGATION.md) records a corrected external test synchronization defect and an unresolved deployed navigation stall (PDP-01, NFR-03). Product lookup has no explicit deadline, and no route loading/error boundary is supplied. These source observations and later successful runs do not establish a website runtime fix or the original stall's cause. Preserve the failed trace and correlate any recurrence with deployment and database timing; production CI against the intended deployed revision remains pending. The category-path gap G-08 remains open.

### 6.5 Currency and pricing display

| ID | Priority | State | Requirement and acceptance criteria | Source | QA focus |
|---|---|---|---|---|---|
| CUR-01 | P1 | C | Storefront shall select USD for detected US country and INR for other countries; country headers take precedence over browser fallback (India time zone, America time zone, US language). | CURRENCY, REGION | Header precedence, absent country, browser fallbacks |
| CUR-02 | P1 | C | USD display shall convert base INR through a valid positive rate, round to whole displayed units and use en-US formatting; INR uses rate one and en-IN. Rate fetch failure shall fall back to INR. | CURRENCY, REGION | Invalid/zero rate, network failure, rounding |
| CUR-03 | P0 | I | Cart/detail/history shall use shared currency formatting; stored prices/order totals and admin monetary displays remain base INR. Conversion is presentation and does not establish USD settlement. | CURRENCY, CART, CHECKOUT, HISTORY, ADMIN | Base versus displayed totals, rate-dependent historical display |

### 6.6 Customer account

| ID | Priority | State | Requirement and acceptance criteria | Source | QA focus |
|---|---|---|---|---|---|
| AUTH-01 | P1 | C | Register shall collect required full name/email/password and call Supabase signup with name metadata; success switches to Sign In and explains email verification when applicable. | NAV, SCHEMA | Required/email validation, duplicate signup, provider policy |
| AUTH-02 | P0 | I | Controlled password confirmation shall match the exact password before Supabase signup. Blank confirmation is required; mismatch shows an alert and makes no create request. Confirmation clears on successful registration or account-tab change and is not sent to the provider. | NAV | Equal/unequal/blank confirmation, reveal toggle, request absence/payload, tab change |
| AUTH-03 | P0 | C | Sign In shall authenticate email/password, display failure, show loading, and close account panel on session success; protected customer actions become available. | NAV | Valid/wrong/unverified/expired account, repeat submit |
| AUTH-04 | P1 | I | Password visibility shall toggle in account forms without changing the entered password; Sign In/Register tabs shall be available. | NAV | Toggle, switch tab, stale feedback |
| AUTH-05 | P1 | C | Forgot Password requires an entered email and requests a link to /reset-password with non-enumerating success copy. The recovery page verifies a Supabase user/session before offering new password and exact confirmation (8–128 characters in browser); mismatch makes no update. Provider errors preserve input; successful update clears passwords and signs out locally, with feedback if logout fails. Invalid/expired/missing sessions offer a fresh-link form; unconfigured fallback reports unavailable. Any verified current session can use this screen; it does not require a recovery-only token. Live email/redirect/provider policy remains G-02. | NAV, RECOVERY | Missing email/config/session, expired/error links, mismatch, failed update/retry, success/signout, configured redirect/email |
| AUTH-06 | P0 | C | Sign Out shall end customer session and clear in-memory favorites through auth updates; local cart currently remains. | NAV, FAV, CART | Reload, protected actions, account switch/cart boundary |
| AUTH-07 | P1 | C | Browser registration shall use normal Supabase signup in every environment and shall never call the privileged dev create-user helper or receive its key. Confirmed development accounts may be created only through explicitly keyed nonproduction tooling; the helper remains disabled in production. | NAV, DEVUSER, UITEST | No helper browser requests, signup payload without confirmation, provider verification feedback, unconfigured signup, keyed local tooling |

### 6.7 Favorites

| ID | Priority | State | Requirement and acceptance criteria | Source | QA focus |
|---|---|---|---|---|---|
| FAV-01 | P1 | C | Signed-in customers shall toggle a product favorite from card/detail; stored user/product pair is unique and successful changes update icon/count. | FAV, CARD, DETAIL, SCHEMA | Toggle/add/remove, duplicate click, failed write |
| FAV-02 | P0 | C | Favorites shall load for the current user and clear on sign-out; one customer must not read/change another customer's favorites. | FAV, SCHEMA | Two-account isolation, reload, direct database access |
| FAV-03 | P1 | C | Favorites page shall display saved product cards/count, loading, and empty Discover Collection link; visitors attempting to favorite shall get an account prompt. | FAVORITESPAGE, FAV, NAV | Empty/deleted product, guest prompt, card navigation |

### 6.8 Cart

| ID | Priority | State | Requirement and acceptance criteria | Source | QA focus |
|---|---|---|---|---|---|
| CART-01 | P0 | I | Add shall require a current customer session; a visitor receives an account prompt without addition. CartContext returns whether an addition was accepted, rejects an optional expected-account mismatch and invalid/overflowing quantities, and opens the drawer only on success. The interrupted action is not automatically replayed after login. | CART, NAV, ASSIST | Guest/customer, stale account, accepted/refused outcome, quantity overflow, post-login retry |
| CART-02 | P1 | I | Lines shall be identified by product ID + size + color; missing/empty/null options normalize to null. Matching tuples merge quantities and differing options create distinct lines, including recovered legacy lines. | CART, CARTSTORE | Same/different options, null/missing color, repeated add, legacy restoration |
| CART-03 | P1 | I | Drawer shall show image/name/options/quantity/line total; plus/minus updates quantity; a quantity below one or explicit remove deletes the line. | CART, NAV | Remove at one, variant-specific deletion, total changes |
| CART-04 | P0 | P | Browser cart shall restore before writing els-cart. Malformed JSON/nonarrays recover to empty; invalid lines are removed while valid lines remain, with recovery feedback. Restored lines require nonempty display fields, supported photo URLs, finite nonnegative numeric prices, positive safe-integer quantities and valid options. Read/write storage failures keep an in-memory bag with a persistence notice. Account separation/sign-out clearing remain unresolved (G-10); no cart_items synchronization exists. | CART, CARTSTORE, NAV | Initial load/reload, mixed invalid rows, duplicate variants, unavailable/quota-limited storage, two accounts |
| CART-05 | P1 | I | Item badge equals sum of quantities; base subtotal equals sum of stored line price × quantity, displayed through currency formatter. Checkout determines authoritative current prices. | CART, NAV, CHECKOUT | Multiple lines, rounding, changed database price |
| CART-06 | P1 | I | Empty drawer shall show Start Shopping; nonempty drawer shall show Proceed to Checkout and close when navigating; cart UI currently has no upper quantity cap. | NAV, CART | Empty/nonempty, close, quantity above API limit |

### 6.9 Demo checkout

| ID | Priority | State | Requirement and acceptance criteria | Source | QA focus |
|---|---|---|---|---|---|
| CHK-01 | P0 | C | Order submission shall require valid customer bearer token and nonempty cart; UI disables guest/empty submission and API rejects invalid/expired sessions. | CHECKOUT, CHECKOUTUI | Guest, expired token, forged user ID, empty cart |
| CHK-02 | P1 | C | All five shipping fields shall be nonempty after server trimming: full name, phone, address, city, postal code; current server truncation limits in section 7 apply. | CHECKOUT, CHECKOUTUI | Missing/whitespace fields, limits, numeric-looking strings |
| CHK-03 | P0 | C | Request shall contain 1–50 raw item entries with strict UUID product IDs and integer quantities 1–20 after Number conversion; duplicate tuples merge and merged quantity above 20 fails. Nonstring or oversized size/color values fail before the transaction. | CHECKOUT | 0/1/50/51 lines, invalid UUID, quantity 0/1/20/21/fraction, duplicates, option type/length |
| CHK-04 | P1 | D | Checkout shall offer demo card and simulated cash on delivery, clearly state no charge/delivery, and collect/send no card details. Card adds a roughly 1.2-second simulation delay and is labelled Simulated successful payment; no charge; no decline branch exists. Historical G-11 is retained. | CHECKOUTUI, CHECKOUT, PROJECTDOCS | Both methods, request payload, no card details or approval/decline claim |
| CHK-05 | P0 | C | The authoritative database transaction shall use current database price snapshots and available inventory, ignoring browser-supplied prices/totals. Sized products require configured size stock; colors share that stock. There is no separate API inventory precheck. | CHECKOUT, PURCHASEMIG | Price tampering, stale price, removed product, missing stock row |
| CHK-06 | P0 | C | A new successful transaction shall create one pending order and all lines with quantity, unit price, size/color; decrement inventory and set total to sum of snapshots. Sized totals sum only currently configured size rows; obsolete rows do not inflate stock. | CHECKOUT, PURCHASEMIG | Sized/unsized/multi-line transactions, shared color stock, stale size rows |
| CHK-07 | P0 | C | Insufficient stock in the transaction shall return 409; failure shall leave no partial order/lines/attempt record or stock decrement. Product rows are locked in UUID order before writes, with guarded decrements. Competing orders must not oversell; multi-session concurrency remains unverified by the single-connection local suite. | CHECKOUT, PURCHASEMIG, PURCHASETEST | Last unit concurrency, crossed multi-product orders, later-line rollback, DB failure |
| CHK-08 | P1 | C | On successful returned order ID, UI shall clear cart and show demo confirmation/ID and Continue Shopping with no delivery/email/support promises. API failure, malformed response or network rejection shall show error, keep cart and release submitting state for retry. A synchronous guard prevents overlapping UI submissions. | CHECKOUTUI | Success, error/malformed response, network rejection, repeated click, state retention |
| CHK-09 | P0 | C | Purchase safeguards transaction shall enforce configured size and color: sized products require a listed size; unsized products reject size; non-demo products with color options require a listed color; demo-photo/no-color products reject color. A UUID Idempotency-Key is required. The same customer/key/normalized payload returns the original order and total before stock checks; changed payload returns 409 without writes. Different customers cannot replay each other's order. Applied/live behavior remains unverified (G-08, G-14). | CHECKOUT, PURCHASEMIG, PURCHASETEST | Missing/invented option, absent/malformed key, exact replay after depletion, changed items/address/payment, cross-customer keys |
| CHK-10 | P0 | I | Browser checkout shall retain a random attempt UUID and SHA-256 digest of customer/items/address/method under zeouf-checkout-attempt in sessionStorage, storing no raw contact fields there. Same details after a lost response/reload reuse the key; changed fingerprint generates a new key. Success removes it; unavailable storage permits in-memory retry only. Reload requires re-entering the same form details, and a new tab/session is not a guaranteed replay. | CHECKOUTUI, UITEST | Both methods, lost response/reload, unchanged/changed details, account switch, blocked storage, success cleanup, no raw contact storage |

### 6.10 Customer orders

| ID | Priority | State | Requirement and acceptance criteria | Source | QA focus |
|---|---|---|---|---|---|
| ORD-01 | P0 | C | Customers shall retrieve only their own orders, newest first, including order lines; guest, loading, error and no-order states shall be distinct. | HISTORY, SCHEMA, CHECKOUTSEC | Two-account ownership, direct reads, empty/error |
| ORD-02 | P1 | C | Order cards shall show short ID, date, formatted total and demo status; expanding one order shows product/image, quantity, line total and demo payment label, including Simulated cash on delivery. Introductory copy states no charge or delivery. | HISTORY | Expand/collapse, deleted product fallback, all statuses, demo copy/payment labels |
| ORD-03 | P1 | C | Saved size/color snapshots shall render on expanded customer order lines and admin order details when present, with deleted-product fallback. Admin detail also shows saved address/contact fields and demo payment method; historical absent fields use fallback copy. | HISTORY, ADMIN, DEMOMIG, ORDERFLOW | Present/missing variants/address/method, reload, deleted product |

### 6.11 Reviews and moderation

| ID | Priority | State | Requirement and acceptance criteria | Source | QA focus |
|---|---|---|---|---|---|
| REV-01 | P1 | C | Review form requires a nonblank display name of at most 120 trimmed characters, comment and integer stars 1–5. Verified bearer server creation stores the trimmed supplied name with pending product/user/rating/comment and optional owned private image paths. Workflow migration adds missing name/reply columns; historical names cannot be reconstructed. Direct customer writes remain denied. | DETAIL, REVIEWSAPI, SECURITYMIG, REVIEWFLOW | Blank/oversized name, guest, rating bounds, owned paths, pending stored name, missing migration |
| REV-02 | P1 | C | Review upload accepts 1–3 JPEG/PNG/WebP files of 1 byte–2 MiB each for an authenticated user and existing product, checks signatures, and limits each account to ten upload requests/day. New private review-images paths are validated against product/user ownership before ten-minute signed URLs are returned to moderators or public approved-review readers. Historical public files, signed-link access until expiry after unpublishing and orphan cleanup remain limits. | DETAIL, REVIEWUPLOAD, REVIEWFLOW, SECURITYMIG, RATELIMIT | File boundaries, ownership, private bucket, signed expiry, unpublish/deletion access window, historical cleanup |
| REV-03 | P1 | I | Submission keeps form data during upload/save, shows an error on failure, and clears it only after server creation. A successful pending review is acknowledged as awaiting approval and is not placed in the public list. | DETAIL, REVIEWSAPI | Successful pending response, upload/API/network failure, retry/data retention |
| REV-04 | P0 | C | Public GET /api/reviews and product detail show up to 100 newest approved rows only, including saved names/replies and signed owned photos when service-role signing is configured. Public responses omit user IDs and raw stored paths; without a service role displayImages is empty. Detail uses an eight-second request limit and Retry reviews feedback on failure. Database allows approved reads or author-owned pending reads and denies customer writes; live migration/visibility remain G-04. | DETAIL, REVIEWSAPI, SECURITYMIG, REVIEWFLOW | Approved-only, safe public fields, 100-row cap, no-service photos, failure/retry/timeout, live role checks |
| REV-05 | P1 | C | Cookie-authenticated admins shall approve, unpublish and delete reviews through protected server routes. Approval/unpublishing records moderator/time and updates approved aggregates. Mutations reject cross-site/origin mismatches and share 60 changes/admin/minute with unavailable production limiter failing closed. Missing reviews return 404, invalid updates 400/413, limited changes 429 and unavailable storage/configuration 503. Deletion retains private attachments. | MODPAGE, MODAPI, REVIEWFLOW, SCHEMA | Cookie/origin/limit denial, missing ID, aggregate changes, error/retry, retained attachments |
| REV-06 | P1 | C | Direct /admin/reviews and the Reviews sidebar shall use the same queue, loading up to 200 latest reviews via status=all and filtering pending/approved/all locally. API accepts pending (default), approved or all and rejects unknown statuses. Queue shows errors/refresh and confirms deletion. Legacy approve/delete form routes redirect to /admin/reviews with 303 after success and retain safe JSON errors on failure. | ADMIN, MODPAGE, MODAPI, REVIEWFLOW | Both entry paths, filters/caps, failure/refresh, deletion confirmation, legacy redirects |
| REV-07 | P1 | C | Admins shall save trimmed replies of 1–2000 characters or remove them with null through cookie-protected PATCH. Server records replied_at or clears it; approval/reply are the only accepted fields. Failed saves retain drafts and report failure; only persisted updates show success. Public replies appear only with approved reviews. Workflow migration supplies name/admin_reply/replied_at; applied environment remains unverified. | ADMIN, DETAIL, MODAPI, REVIEWFLOW | Whitespace/length/unknown fields, save/remove/reload, failed draft retention, public approval boundary |

### 6.12 Restock alerts

| ID | Priority | State | Requirement and acceptance criteria | Source | QA focus |
|---|---|---|---|---|---|
| RST-01 | P1 | C | Available alert UI shall accept email for an unavailable item/selected size and save product/email/size/color without customer authentication; invalid email/product shall fail. Specific unavailable-size selection is a UI gap (G-09). | DETAIL, RESTOCK | Guest, whole-product versus size request, invalid product/email |
| RST-02 | P1 | C | Email shall be trimmed/lowercased; duplicate pending product/email/size/color requests shall return already_subscribed; otherwise create one pending record and token. | RESTOCK, DEMOMIG | Case, null options, concurrent duplicate uniqueness |
| RST-03 | P1 | C | Response/UI shall distinguish saved-with-mail-enabled from saved-with-mail-disabled; absent delivery configuration shall keep pending requests. | RESTOCK, DETAIL, NOTIFY | Mail on/off, missing database, queued response |
| RST-04 | P0 | P | Admin positive stock save can trigger up to 100 pending product requests, filtering by size when supplied, and mark successful sends notified; true stock/transition checks, retry scheduling and robust deduplication are incomplete (G-12). | ADMIN, NOTIFY | Size eligibility, provider failure, repeated/concurrent batches |
| RST-05 | P1 | C | GET/POST token unsubscribe shall delete the matching alert and return plain confirmation; malformed token fails, well-formed already-removed token is still successful; public clients cannot directly read the alert table. | UNSUB, DEMOMIG | Valid/repeated/malformed token, privacy/RLS |

### 6.13 Admin access and dashboard

| ID | Priority | State | Requirement and acceptance criteria | Source | QA focus |
|---|---|---|---|---|---|
| ADM-01 | P0 | I | Admin login in every environment requires a named account with its scrypt password hash and a distinct session-signing secret of at least 32 characters; it issues a one-hour HttpOnly/SameSite=Lax cookie, Secure in production. The browser collects username/password. DEV_CREATE_USER_KEY shall never substitute for admin credentials or cookie signing; missing admin configuration returns 503 and missing/short signing secrets cannot sign or verify cookies. MFA and live credential provisioning remain open. | ADMINLOGIN, ADMINAUTH, RATELIMIT, UITEST | Wrong username/password, missing development/production config, helper-key denial, short/missing signing secret, cookie claims/attributes, MFA gap |
| ADM-02 | P0 | C | Catalog reads/saves/deletes/uploads and review moderation/replies shall require a signed admin cookie independent of local UI flags. Server service-role writes use validated routes and same-origin mutation guards; browser catalog/image/review writes are restricted by current migrations. Applied live role/storage permissions remain G-06. | ADMIN, ADMINAUTH, ADMINAPIS, ADMINCAT, REVIEWFLOW, SCHEMA | Forged/expired/customer cookies, cross-site writes, service-only RPCs/storage, review replies and live grants |
| ADM-03 | P0 | C | Sidebar logout shall POST the cookie-clearing endpoint and wait for success before removing the local flag and replacing the route with /admin. Failed requests preserve the session and display retry feedback. After successful logout the same browser's protected APIs deny access. This clears the browser cookie; copied signed tokens retain their original expiry. | ADMIN, ADMINLOGOUT | Cookie/flag after sidebar logout, API rejection, request failure/retry, endpoint contracts |
| ADM-04 | P1 | C | Dashboard shall show product/configured-stock/out-of-stock/low-stock counts including unsized low stock, up to five newest orders, inventory warning and quick links. Refresh/retry shall reload catalog/stock and orders; failed/loading inventory metrics show an unavailable dash and failed order reads do not show a successful empty state. Add a product shall open its form. | ADMIN, ADMINCAT, ADMINAPIS | Known sized/unsized counts, newest five, failed reads versus empty, refresh, working Add product |
| ADM-05 | P1 | C | Dashboard shall show a pending-order count linking to the pending queue and active demo order value excluding cancelled orders, with explicit no-payment-collected copy. Failed/loading order metrics show an unavailable dash. | ADMIN, ADMINAPIS, ADMINCAT | Pending-queue navigation, mixed status/value fixtures, unavailable states, demo copy |

### 6.14 Admin product management

| ID | Priority | State | Requirement and acceptance criteria | Source | QA focus |
|---|---|---|---|---|---|
| PRD-01 | P1 | C | Admin product table shall load products with configured size rows through signed-cookie GET /api/admin/products, newest first, and combine case-insensitive name search with exact category filter. Failed reads show actionable feedback rather than a successful empty catalog. | ADMIN, ADMINCAT | Cookie/503 failures, search/category/no matches, nested inventory, refresh |
| PRD-02 | P1 | C | Add/edit shall persist validated name/category/price/description/sizes/main image/image list through server-only catalog routes and save_admin_product. Initial unsized stock can be supplied on create; existing quantities are changed only on Stock Management. Failed writes keep the form and values, release saving state and show a safe error. | ADMIN, ADMINCAT | Create/edit/reload, denied writes, retained fields, retry, stale metadata form versus checkout |
| PRD-03 | P0 | C | Server product saves shall require a trimmed name of 1-200 characters, configured category, finite numeric price 0 to less than 10000000000 with at most two decimals, numeric integer stock 0-2147483647, description at most 10000 characters, unique configured sizes and at most 12 image URLs. Images accept local root paths or HTTPS on the configured Supabase origin, never executable/protocol-relative URLs. JSON body above 50000 JavaScript characters gives 413. Database price/stock checks enforce future writes; NOT VALID preserves legacy rows for explicit inspection/repair (G-17). | ADMIN, ADMINCAT | NaN/string/negative/fraction/overflow, duplicate/unknown size/category, URL/malformed/body boundaries, legacy invalid rows |
| PRD-04 | P1 | C | Product image upload shall use signed-cookie, same-origin server POST /api/admin/products/upload with shared limit 10/admin/minute; choose one 1-byte to 2-MiB JPEG/PNG/WebP file with matching signature. Declared Content-Length above 3 MiB gives 413. Server generates a UUID path in public product-images; storage bucket has matching size/type limits and restrictive browser-write guards. Upload failures show feedback; Save/Upload are disabled during upload. Removing a URL or abandoning a form does not delete stored objects. | ADMIN, ADMINCAT | Anonymous/cross-site denial, size/type/signature, failed upload, public URL, max images, signature-not-full-decode and multipart limits |
| PRD-05 | P1 | C | Atomic catalog save shall lock the parent product before size rows, preserving retained-size quantities, inserting new configured sizes at zero, deleting removed/obsolete rows and deriving sized total from current rows. Client overall stock cannot override a sized total or an existing unsized quantity. Removing all sizes starts unsized stock at zero. This shares checkout/stock lock order; live multi-session verification and separate seed-insert repair remain G-18. | ADMIN, ADMINCAT, PURCHASEMIG, PURCHASETEST | Retain/add/remove/missing/obsolete rows, sized-to-unsized, stale form after depletion, forced rollback, live concurrency |
| PRD-06 | P1 | C | Delete shall require browser confirmation and signed-cookie server DELETE /api/admin/products/[id]. Missing product gives 404; failed writes show feedback and retain the list. Database cascades dependent favorite/review/size/alert rows; historical order lines retain price/quantity with null product. Stored image files are not garbage-collected. | ADMIN, ADMINCAT, SCHEMA, DEMOMIG | Cancel/confirm, missing ID, denial/error, referenced product/history snapshots, image retention |

### 6.15 Admin stock

| ID | Priority | State | Requirement and acceptance criteria | Source | QA focus |
|---|---|---|---|---|---|
| STK-01 | P0 | C | Stock view shall expose one row per configured size or one Overall row for unsized products. Whole-number nonnegative edits save on blur through protected stock PATCH; failed writes/invalid values show feedback and do not update in-memory stock. Positive saves may still trigger notifications with G-12 limits. | ADMIN, STOCKAPI | Sized/unsized, blur, invalid/failing write, expired cookie, notification limits |
| STK-02 | P0 | C | Cookie-protected stock API shall require a strict UUID and Number-converted integer stock 0–2147483647, rejecting nonstring nonnull sizes. set_product_stock shall lock the product, validate size membership, upsert the size and sum only configured rows, or set unsized overall stock. Unknown product returns 404; invalid option 400; absent service config 503; RPC/migration failure 500. | STOCKAPI, PURCHASEMIG | 0/1/4/5, negative/fraction/overflow, invalid UUID/type, unknown product, missing/existing/stale row |
| STK-03 | P1 | I | Row labels shall be Out of stock for zero, Low stock for 1-4, Available for 5+. Dashboard and analytics low-stock counts include unsized products with 1-4 units and sized products with at least one configured size in that range. | ADMIN | 0/1/4/5, unsized low stock, configured size versus obsolete rows |
| STK-04 | P0 | C | Purchase stock RPC and atomic catalog save shall use parent-product-first locking with checkout. Stock RPC rejects unsupported size or overall edits on sized products; catalog save synchronizes configured rows/totals and preserves current existing unsized stock. Local rollback/permission tests are scoped evidence; separate seeding and live multi-session behavior remain G-18. | STOCKAPI, PURCHASEMIG, ADMINCAT, ADMIN, PURCHASETEST | Transaction failure, checkout/edit concurrency, configured aggregate, stale form, seed-repair limitation |

### 6.16 Admin orders and users

| ID | Priority | State | Requirement and acceptance criteria | Source | QA focus |
|---|---|---|---|---|---|
| AOR-01 | P0 | C | Admin shall retrieve orders/lines newest first through authenticated API; table shall show ID/customer ID/INR total/status/date and View action. | ADMIN, ADMINAPIS | All versus own orders, expired cookie, retrieval failure |
| AOR-02 | P1 | I | Order search shall match order ID or customer ID case-insensitively and combine with exact status filter, distinguishing no orders from no matches. | ADMIN | Partial ID, casing, all five statuses |
| AOR-03 | P1 | C | View shall open a native modal dialog showing customer, products, quantities, saved size/color, totals, saved shipping/contact address and demo payment method. Escape/Close restores trigger focus. Only current and permitted next statuses are offered, terminal selectors are disabled and updates block duplicates. Failed status changes remain visible without claiming success; successful cancellation refreshes inventory. | ADMIN, ADMINAPIS, HISTORY, ORDERFLOW | Keyboard/focus, present/missing fields, allowed statuses, failed update, cancellation inventory refresh |
| AOR-04 | P0 | C | Service-only set_admin_order_status shall allow pending→processing/cancelled, processing→shipped/cancelled, shipped→delivered; delivered/cancelled are terminal. Repeating the current status is idempotent. Order/product locking makes pre-shipment cancellation restore configured size or unsized quantities once and set stock_restored_at. Missing/deleted products are skipped; incompatible changed size configuration aborts all restoration/status writes with 409. Historic already-cancelled rows are not retroactively restocked. Invalid transitions return 409, absent order 404, unavailable RPC 503; API mutations require same origin and 60 changes/admin/minute. Live concurrency/application remain G-19. | ADMINAPIS, ADMIN, ORDERFLOW, PURCHASETEST | Forward/backward/terminal/repeated changes, shared colors, unsized/configured totals, atomic rollback, deleted/historical rows, privileges and live races |
| USR-01 | P1 | C | Admin users list shall retrieve at most 200 profiles ordered by updated_at, presenting ID/full name/update time; endpoint shall reject non-admin access. | ADMIN, ADMINAPIS | No profiles, cap 200/201, permissions |
| USR-02 | P2 | C | User View shall open a read-only native modal with full name, ID and profile update time. Escape/Close restores focus; View customer orders closes the dialog and selects Orders with that exact customer ID in search. Profile failures show Retry users. Email/edit/disable/delete are unsupported. | ADMIN, ORDERFLOW | Dialog focus/keyboard/fallbacks, customer search, failed reads/retry, read-only boundary |

### 6.17 Analytics and settings

| ID | Priority | State | Requirement and acceptance criteria | Source | QA focus |
|---|---|---|---|---|---|
| ANL-01 | P1 | C | Analytics shall show active demo order value and active order count excluding cancelled orders, average active order value (zero when empty), and configured stock units in INR/base values. Failed/loading data shows an unavailable dash for its summary metrics. These are demo order values, not collected revenue. Pipeline still includes all five statuses. | ADMIN | Known active/cancelled totals, zero orders, failed reads, average denominator, demo labels |
| ANL-02 | P2 | I | Order pipeline shall show count and rounded percent for each of five statuses; rounding need not sum to exactly 100%. | ADMIN | Empty and uneven status distribution |
| ANL-03 | P1 | I | Inventory health shall show healthy=max(products−low−out,0), low/out counts and units derived from configured sizes or unsized stock. | ADMIN | Sized/unsized low counts, inconsistent stored rows |
| ANL-04 | P2 | C | Top products shall rank up to five existing products by quantities in loaded noncancelled orders. Deleted products do not appear; ties follow existing product order and empty sales state is shown. | ADMIN | Ties, deleted product, cancelled exclusion, no active sales |
| ANL-05 | P2 | C | Customer signal shall show approved review count and mean approved rating to one decimal, zero when no approved reviews. Pending/unapproved reviews are excluded; failed/loading review data shows unavailable rather than zero. | ADMIN | Mixed approvals, 0/1/multiple approved, failed read, correct denominator |
| SET-01 | P2 | D | Settings shall show a read-only identity/catalog summary and status of the latest protected catalog request: checking, succeeded or unavailable with dashboard retry guidance. This is not a database-wide health probe; no configuration save or feature toggles exist. | ADMIN | Successful/failed/loading protected request, honest read-only/status copy |

### 6.18 Content and operational utilities

| ID | Priority | State | Requirement and acceptance criteria | Source | QA focus |
|---|---|---|---|---|---|
| CNT-01 | P1 | D | Footer newsletter shall identify Newsletter preview and state no save/subscription/send before entry. Labelled email field uses browser email validation; Try preview displays no-save/no-send feedback and sends no subscription request. | FOOTER, INFO | Pre-submit limits, accessible label/description, invalid/valid email, no network subscription/write |
| CNT-02 | P1 | I | Footer shall link all categories, favorites, privacy, terms and maintainer GitHub; information pages shall provide return-home navigation. | FOOTER, INFO | All destinations and external link attributes |
| CNT-03 | P1 | D | Home/checkout/privacy/terms/footer/history/detail shall explain demo limits and stored demo data. No charge, shipment, returns or support follow-up is promised; fictional details are requested. Privacy describes publicly approved review names/photos/replies, private photo storage, ten-minute signed links and attachment retention after review deletion. Attribution/license inconsistency remains G-22. | HOME, INFO, FOOTER, HISTORY, DETAIL, CHECKOUTUI, REVIEWFLOW | Content consistency, fictional data, approved photos/names/replies, expiry/retention, attribution gap |
| CNT-04 | P2 | T | Holiday countdown component exists but is not mounted by current pages; enabling it needs scope confirmation. It counts to local-browser 31 Dec 2026 23:59:59, clamps at zero, and applies no discount. | SALE, SHELL | Exclude from current UI pass criteria; future timer tests |
| OPS-01 | P2 | I | GET health shall return status ok and timestamp; it is application liveness, not a database/service readiness proof. | HEALTH | JSON and timestamp, no inferred DB health |
| OPS-02 | P0 | P | Test reset shall be nonproduction and test-secret protected; it attempts catalog/favorite/cart/review cleanup and reseed but omits orders/local storage and ignores delete errors (G-23). | TESTAPI | Production 404, wrong secret 401, partial reset |
| OPS-03 | P1 | C | Test seed-user shall create a confirmed test user or reset an existing matched user's password, guarded by nonproduction plus separate test secret; inputs or configured defaults are required. | TESTAPI | New/existing user, missing fields, auth/production |
| OPS-04 | P1 | C | Dev create-user shall always return 403 in production. Nonproduction requires a configured nonblank DEV_CREATE_USER_KEY (otherwise 503) and matching x-dev-key (otherwise 401) before processing input or accessing Supabase. The helper caps counted dev_auto users at ten and shall not overwrite non-dev accounts. Its key is server-only and separate from admin credentials/signing. | DEVUSER, UITEST | Production with/without key, missing/blank configured key, missing/wrong request key, authorized input validation, limit boundary, existing dev/non-dev |
| OPS-05 | P2 | I | Schema endpoint shall return base SQL as plain text or not-found; database-error copy action uses it. It does not include all migrations or fix the database automatically. | SCHEMAAPI, DETAIL | Schema available/missing, clipboard failure |
| OPS-06 | P1 | I | Requirements CI shall run the checked-in synchronization regression tests. Build and lint shall reject stale derived documentation, unreviewed tracked website source, or a mismatched review snapshot/log. All four browser configurations, including playwright.assistant.config.ts, require source review. Synchronization preserves manual fields and archives changed/retired rows; affected executed results become Needs retest. An explicit descriptive review shall never mark tests Passed. | REQTOOLS | Missing snapshot, source drift, assistant config coverage, CSV manual evidence, retired IDs, repeated sync, review assertions |
| OPS-07 | P1 | I | UI/admin, catalog and assistant Chromium suites run sequentially on dedicated servers with disabled live Supabase service-role/mail/model credentials, no server reuse, separate artifacts and isolated compilation output. ISOLATED_BROWSER_TESTS=1 disables persistent Turbopack development caching to avoid stale HMR output across changed fixture configurations/source; ordinary development and production cache settings retain defaults. Catalog/assistant browser fixtures intercept reserved .invalid Supabase domains; tool tests use injected stores or fallback data. Fictional sessions exercise auth notifications without real accounts. Mocks/local cookies are not live acceptance. | UITEST, REQTOOLS, ADMINCAT, ASSIST, ROUTE | Disabled live services, fresh fixture compilation after source/config change, sequential suites, artifacts/review |
| OPS-08 | P1 | I | npm run test:live shall run optional Chromium public-browsing checks against the deployed Vercel origin, with PLAYWRIGHT_BASE_URL accepting another HTTP(S) origin without credentials/path/query/fragment. No local server is launched or authenticated storage reused. The suite checks homepage, seven populated collections without fallback warnings, search, product detail, mobile navigation, information pages and admin login rendering. It blocks mutating HTTP methods and known helper/logout paths, and fails attempted writes. It does not authenticate, submit commerce/customer/admin changes or establish their acceptance. Artifacts use test-results/live; live checks remain separate from deployment-racing push CI. | LIVETEST, REQTOOLS | Correct target, no local startup, public data available, state-changing requests blocked, separate artifacts and acceptance limits |
| OPS-09 | P1 | C | Read-only npm run security:check-db with explicit DATABASE_URL shall inspect review/order/limiter RLS/grants plus current five-argument checkout, stock/catalog service-only RPCs, removed legacy RPC, private attempts, browser catalog write denial, product-image bucket/guards and legacy invalid price/stock rows. Shared catalog-inspector queries are exercised in isolated PostgreSQL, including a permission regression. Full applied Supabase verification remains pending; G-25 history is retained. | SECCHECK, SECURITYMIG, CHECKOUTSEC, PURCHASEMIG, ADMINCAT | Missing URL/migrations, current signatures, private attempts, table/column grants, storage guards, legacy invalid rows, no writes |
| OPS-10 | P1 | I | test:purchase applies base, checkout security, demo catalog, purchase safeguards, admin catalog, order lifecycle and review workflow migrations to isolated PGlite with minimal auth/storage fixtures. Twenty-six cases cover replay/options/rollback/totals, catalog synchronization/grants, lifecycle forward/idempotent transitions, cancellation restoration/rollback/deleted/historical products, service-only permissions and migration reapply. Single-connection mocked storage does not prove live Auth/Storage or concurrent sessions. | PURCHASETEST, UITEST, ADMINCAT, ORDERFLOW, REVIEWFLOW | 26 scoped cases, no live mutations, role/rollback/reapply assertions, live concurrency remains separate |

| OPS-11 | P2 | I | npm run audit:storefront collects a read-only unauthenticated Chromium/axe report at desktop/390px/320px widths for configured origin/paths, defaulting to the public storefront. It blocks attempted mutations/helpers/logout, records accessibility flags, overflow, image sizing and unthrottled lab timing. Strict mode fails errors/non-200/writes/overflow/axe findings; collection without strict is not a passing quality test. Reports use test-results/quality/storefront-audit.json. | QUALITY | Origin/path validation, guarded reads, strict failure, report scope; no field performance or WCAG conformance claim |

### 6.19 Shopping assistant

| ID | Priority | State | Requirement and acceptance criteria | Source | QA focus |
|---|---|---|---|---|---|
| AST-01 | P1 | C | Every non-admin page shows a bottom-right Ask Zeouf launcher opening a non-modal panel named Zeouf Shopping Assistant. Warm neutral surfaces, wine/brown accents, editorial typography, a product/size/bag welcome and icon suggestions match the store. AI-answer warning and privacy reminder stay visible in the footer. Escape closes and restores launcher focus; opening focuses input; Enter sends, Shift+Enter inserts a newline and IME composition does not submit. Messages are escaped, duplicate sends blocked and errors offer applicable Retry. New conversation clears chat/comparisons/pending work and returns the log to the welcome top. Confirm success offers View bag, closing chat and opening the existing drawer. | ASSIST, SHELL | Welcome/copy/privacy, focus/keyboard/IME, mobile layout, escaped HTML, retry/reset/top position, View bag, no admin launcher |
| AST-02 | P0 | C | POST /api/assistant shall keep GROQ_API_KEY server-side, use Groq Responses API with default openai/gpt-oss-20b or nonblank GROQ_MODEL, and limit each address to 10 requests/minute. No OpenAI credential fallback or automatic SDK retries; each provider call times out after 25 seconds. One 35-second server deadline covers body, limiter, auth, catalog and every model round; confirmation has a 10-second server deadline. Disconnect/deadline cancels supported provider/auth/catalog/limiter fetches, settles waits and prevents subsequent rounds; cancelled/timed-out requests return safe 504 responses when connected. It accepts 1–50 messages, validates/processes only the last 12, each trimmed to nonblank text of at most 1,000 characters with user/assistant roles and a final user message. Raw body length above 24,000 JavaScript characters gives 413, not a measured byte limit. Invalid input gives 400 before model configuration is checked. Missing key for valid free-text chat or unavailable production limiter gives 503; valid card interactions need no key. Address/provider quota gives safe 429; other model failures give 502. | ASSIST, RATELIMIT | SDK URL/auth/signal/model, complete-operation deadline, hanging auth/catalog, disconnect/no late rounds, keyless actions, quota/no retries, shape/history/body boundaries, production limiter |
| AST-03 | P0 | P | Tools shall read catalog facts, validate arguments and label authored text untrusted. Category filters match whole names or category prefixes/aliases, never men inside womens; subcategory phrases remain supported. Search uses normalized whole words with common singular/plural handling. Exact results require every query keyword in product name/category/brand/tag/configured color fields; description-only matches remain alternatives. Full matches exclude partial matches; absent full matches return relevant partial matches with “couldn't find an exact match” and “similar products you may like” copy including the query. Alternatives retain explicit category, budget, size, color and stock filters; no relevant candidate gives an empty result and filter guidance. Prompt/tool instructions preserve requested product type/keywords instead of silently broadening; real-provider routing remains G-26. Search/related returns at most eight products and replies at most three catalog-derived cards; invented IDs are dropped. Availability uses only configured sizes and their unique valid stock rows; missing/duplicate/retired rows never infer stock from the product total. Requested-size searches check that size. Demo contact-sheet products do not offer selectable colors, matching checkout. Server-rendered replies use tool-composed copy and catalog fields; raw model prose and descriptive instructions are never shown as factual answers. No-tool replies use a safe fallback. Recommendations remain cached for 30 seconds and model intent/tool selection still requires live evaluation (G-26). | ASSIST, CATDEF | Men/women/legacy aliases/subcategory boundaries, size-stock rules, exact-versus-similar cargo shorts/jeans, preserved filters, whole-word/plural matching, factual renderer, malicious model/product text, invented IDs, failed lookups, cache age |
| AST-04 | P0 | C | getCart shall require a verified customer bearer token, accept up to 30 valid browser-supplied lines and price them from catalog data (cached normally; fresh request snapshot for referenced follow-ups). Cart lines and totals render deterministically in display currency with INR base values. Anonymous/invalid tokens receive sign-in-required output. This is not an account-owned database cart; browser cart remains shared across accounts (G-10). Isolation follows AST-07. No order/account/checkout/payment tools exist. | ASSIST, CART | Verified token, client price tampering, currency totals, fresh references, browser ownership, removed products, account switch |
| AST-05 | P0 | P | addToCart shall propose without mutating after a verified session, intent flag and keyword heuristic; listed options and quantity 1-10 use cached stock including bag quantities across colors sharing the same product/size. Card Review bag addition submits explicit selected options through the same tool without a model. Confirm calls POST /api/assistant/confirm with bearer token, INR proposal price/options/quantity and up to 30 valid cart lines. Server identity and fresh uncached validation reject removed products 404, changed price/options or insufficient combined stock 409, invalid payload 400/413, missing identity 401, address limit 429 and unavailable limiter/stock 503; cancellation/deadline returns 504. It saves nothing and reserves no stock. Client session/cart checks and duplicate prevention mark Sent to your bag only after CartContext accepts the addition for the expected account. Checkout remains authoritative (G-26). | ASSIST, CART, PURCHASEMIG | Selected options, fresh identity/price/stock checks, INR under USD display, combined bag stock, timeout/retry/double click, actual cart outcome, no reservation |
| AST-06 | P2 | D | Store-policy tool, deterministic reply and prompt shall match portfolio-demo copy: no charges, shipment/delivery, shipping services, exchanges, returns or support follow-up. Demo card and simulated cash on delivery are available; fictional contact details are requested. Policy answers render the checked-in policy summaries, never model-generated commercial promises. Unknown/failed/no-tool topics use safe notices/fallbacks. No delivery dates, discounts or order lookup are provided. | ASSIST, INFO, DETAIL, CHECKOUTUI | Exact policy facts, malicious generated claims suppressed, unknown/no-tool fallback; live topic/tool selection remains unverified |
| AST-07 | P0 | I | Widget conversations, reference IDs, failed retry history, comparisons, proposals and confirmation flags reset on identity change; same-account token refresh preserves chat. Reset/unmount cancels browser requests and ignores older-generation responses. Outgoing history is capped to the last 12 entries with at most 1,000 characters each; browser waits end after 45 seconds for chat or 15 seconds for confirmation, outside the shorter AST-02 server deadlines. No conversation is persisted by the app. | ASSIST | Logout/switch, reference/comparison cleanup, late responses, token refresh, reset/unmount, bounded history, action retry |
| AST-08 | P1 | I | Assistant history may include zero to three unique ordered productIds per assistant entry, each a nonblank trimmed string of at most 100 characters; user entries may not supply this field. Invalid retained references return 400. For free-text follow-ups the server freshly reloads the most recent nonempty reference list, supplies catalog facts and original positions to the model, and explicitly marks removed IDs unavailable without shifting positions. Browser-supplied names/prices/options are never authoritative. References outside the retained 12-message window are forgotten. | ASSIST | Second-one follow-up, changed price/options, removed first item, duplicate/oversized references, fresh-read failure, bounded-history loss |
| AST-09 | P1 | I | Chat sends the storefront display currency and rate. Missing display defaults to INR/1; only INR/1 or USD with a finite positive rate up to 1000 is accepted, otherwise 400. Currency/rate are presentation input, never purchase-price authority. Budget tools default to display currency; explicit priceCurrency INR/USD overrides it and conversion to catalog INR happens once on the server. USD filters require an available USD display rate, otherwise request an INR budget. Cards, cart summaries and suggestions follow display currency; stored/proposed/confirmed prices stay INR. Display rounds to whole units; numeric budget filtering uses unrounded conversion. | ASSIST, REGION | INR/USD card/prose/suggestions, explicit rupees under USD, zero/invalid rate, unavailable USD rate, exact budget boundary, unchanged INR confirmation |
| AST-10 | P1 | I | Product cards show catalog category, optional brand, configured sizes with unavailable sizes disabled, and selectable colors under checkout rules. Compare selects two or three unique products in selection order; a fourth is not added and Clear selection resets. Find similar and Compare selected submit validated interactions through POST /api/assistant with no model/key requirement. Review bag addition requires all listed size/color choices and integer quantity 1-10, proposes only through AST-05 and never mutates before Confirm. Missing products/options/stock use safe notices. Interactions share chat address limits/deadlines and retry preserves the selected action. | ASSIST, CART | Mobile card controls, 2/3/4 comparison bounds, similar results, invalid/removed IDs, required/disabled options, quantity, keyless tool execution, no premature add |
| AST-11 | P1 | I | Assistant opening/closing, incoming messages, loading dots, hover/selection and confirmation feedback use scoped CSS motion. Closing immediately makes the panel inert/hidden to assistive technology and removes it after 180 ms; reopening cancels pending removal. Reduced motion disables animations/transitions and uses immediate scrolling/closure. The panel fits 320px/390px mobile and desktop viewports; VisualViewport resize/scroll updates height/keyboard offset while retaining a non-modal layout. Composer grows with text up to 128px, then scrolls. New content follows the bottom only while the reader is near it; scrolling earlier replies preserves that position and offers Latest message. Sending or Latest message resumes following. Empty welcome starts at the top and has no Latest message control. | ASSIST | Motion preference, inert close/quick reopen, 320/390px bounds, simulated keyboard viewport, multiline growth/Shift+Enter, reader position and resume; real-device keyboard checks remain separate |

## 7. Business rules and validation

### Catalog and inventory rules

| Rule | Baseline and test implication |
|---|---|
| BR-01: Main taxonomy | Seven storefront categories; 14 admin/seed database categories: Women's Dress, Women's Blouse & Shirt, Women's Jacket, Women's Skirt, Women's Trousers, Men's Suit, Men's Shirt, Men's Trousers, Men's Jacket, Shoes, Bags, Accessories, Perfume, Makeup. |
| BR-02: Highlights | New/best labels use tags, not date windows or computed sales. Recommended has no documented merchandising score. |
| BR-03: Sizes | Admin choices XS/S/M/L/XL/XXL and 36–44; products may have no sizes. Stock rows are unique per product/size. |
| BR-04: Stock | Unsized sale uses products.stock; sized sale uses configured product_size_stock rows. Missing rows are unavailable. Protected stock saves, sized purchases and atomic catalog size edits use product-first locking and recalculate configured totals. Catalog edits synchronize rows and preserve current existing unsized stock; separate seed-insert repair and live concurrency remain G-18. |
| BR-05: Colors | Color selection changes display/cart/order metadata; inventory is shared across colors. Demo photograph products suppress colors to avoid unsupported visual variants. |
| BR-06: Pricing | Base catalog/order money is treated as INR. Display rounds after conversion to zero decimal places; SQL unit prices preserve numeric precision. Displayed line sums may differ from rounded displayed aggregate by a unit. |
| BR-07: Related products | Category-prefix matching, up to eight, excluding current ID; no personalized recommendation or availability guarantee. |

### Checkout validation and response behavior

| Field / condition | Source baseline | Tests to derive |
|---|---|---|
| Customer identity | Taken from verified bearer session; not caller user_id | Missing/invalid/expired token; attempts to order for another account |
| Item entries | Raw array length 1–50 | 0, 1, 50, 51; non-array |
| Product ID | Trimmed string, truncated to 100, then strict UUID pattern; numeric IDs rejected | Missing/numeric/malformed ID 400; removed UUID 409 |
| Quantity | Number conversion then integer 1–20; duplicates merge per ID/size/color and merged amount must stay ≤20 | Numeric string, null, 0, 1, 20, 21, fraction; duplicate merged boundary |
| Size / color | Nonnull values must be strings with trimmed lengths ≤30/40; empty becomes null. Transaction enforces configured membership and required options; demo-photo/no-color products reject color | Missing/invented options, nonstring/oversized values, unsized with size, demo with color; 400 without writes |
| Attempt key | Required UUID Idempotency-Key header, scoped to verified customer; API merges/sorts variant entries before transaction payload comparison | Missing/malformed 400; exact replay 200 with original order even after depletion; altered normalized items/address/method 409 |
| Full name | Required trimmed string; truncated to 120 | Empty/whitespace, 119/120/121 |
| Phone | Required trimmed string; truncated to 40; no country/phone-format rule | Empty, 39/40/41, alphabetic accepted baseline |
| Address | Required trimmed string; truncated to 500 | Multiline, whitespace, 499/500/501 |
| City | Required trimmed string; truncated to 120 | Unicode, empty, 119/120/121 |
| Postal code | Required trimmed string; truncated to 24; numeric input hint only | Leading zeros, letters, 23/24/25; no country-based validation assumed |
| Payment method | Exactly card_demo or cash_on_delivery | Missing/unsupported value; both valid choices |
| Stock | Guarded SQL transaction; no separate API precheck. Replay lookup precedes inventory validation; new zero/insufficient-stock attempts fail | Exact stock, one over, concurrency, missing row, rollback after earlier successful line, replay after depletion |
| Price/total | Database snapshot; no additional tax, shipping or discount fields | Tampered browser total, price change since addition, decimal rounding |

Long shipping strings are **truncated**, not rejected, by checkout normalization; oversized size/color strings are rejected. Tests must not invent password complexity, phone patterns, postcode length rules, delivery-country restrictions, consent checkboxes, or shipping fees. Customer password rules and signup email verification are determined by the configured Supabase project and must be captured as fixture/environment facts.

Checkout responses: success/replay `200 {orderId,total}`; invalid payload/key/options `400`; customer/session failure `401`; insufficient stock or changed-payload replay `409`; shared production rate limit `429`; missing limiter/service config `503`; other transaction/migration failure `500`. Nonproduction without shared limiter settings uses an in-process fallback. Rate limiting executes before other validation, so repeated requests can mask later errors. The API uses the five-argument purchase RPC; older migrations alone cannot serve it.

### Additional rules

| Rule | Baseline / unresolved decision |
|---|---|
| BR-08: Order status | Forward lifecycle and pre-shipment cancellation follow AOR-04; repeat status is idempotent, cancellation restores existing configured inventory once under a transaction. Historical cancellations stay unchanged; no customer cancellation/refund is implemented. |
| BR-09: Order contents | Price/quantity/options are snapshots; product name/image are live relational joins and may disappear/change after product deletion/editing. |
| BR-10: Favorites | Unique account/product pair; successful DB mutation updates state. Failed mutations do not toggle saved state but lack explicit error feedback. |
| BR-11: Reviews | Integer stars 1–5, verified user/product, trimmed name 1–120, nonblank comment, pending by default. Admin replies are trimmed 1–2000 or null to remove, with moderation/reply timestamps. Direct customer writes remain revoked; no purchase-verification or one-review-per-product rule. |
| BR-12: Review images | 1–3 signature-checked JPEG/PNG/WebP files, 1 byte–2 MiB, ten uploads/account/day. Private owned paths produce ten-minute signed URLs for moderators and approved public reviews. Historical public objects/orphans remain; signed URLs can stay usable until expiry after unpublish/delete. |
| BR-13: Restock | Email ≤254 characters, trimmed/lowercased; pending duplicate key includes product + email + normalized size/color. Product ID check is a 36-character hex/hyphen pattern rather than full UUID validation. |
| BR-14: Notifications | Sent records are excluded from later ordinary batches. A new request after notification can be created. No stock reservation follows an email. Current notify API does not itself check positive inventory. |
| BR-15: Rate limits | Production uses an atomic Supabase counter shared across instances with HMAC-hashed keys; missing limiter configuration/RPC returns 503. Nonproduction without shared settings uses process-local counters. Per address: admin login 5/minute, restock 5/minute, checkout 10/minute, review POST 5/minute, upload 8/minute; admin username has a second 5/minute limit and uploads have ten requests/account/day. A trusted proxy must append or overwrite x-forwarded-for. |
| BR-16: Permissions | Database RLS governs customer-owned records; cookie-protected server endpoints use server role. Hardened review policies permit public approved reads and authors' own pending reads, while customer review writes are revoked. Checkout security migration removes direct customer order writes. Applied migration state requires read-only verification. |
| BR-17: Assistant | Shared limiter 10/address/minute per chat/confirm key. Groq free-text loop uses low reasoning, up to four tool rounds then one final round, 700 output tokens/call, nonstreaming, no automatic retries or store parameter. Model prose is suppressed; validated tool copy/cards provide facts. Search discloses partial matches as alternatives while retaining explicit filters; model instructions preserve the requested garment keywords. Card actions bypass the model. Browser history is in memory and sends only the last 12 entries plus bounded product references; handler rejects more than 50 raw entries. Server chat/confirm deadlines are 35/10 seconds; browser deadlines 45/15. Supported reads/model calls receive cancellation. Provider intent selection, quotas, disconnect propagation and actual concurrency remain staging checks. Display currency/rate only affect presentation and budget conversion; purchases stay INR. |
| BR-18: Admin catalog | Signed admin cookie and same-origin mutation checks; catalog, review and order writes each 60/admin/minute under their own keys, uploads 10/admin/minute, shared production limiter fails closed. Catalog save locks product first and synchronizes configured sizes in one transaction. New unsized products take initial stock; existing quantities change only on Stock Management. Removal of all sizes starts overall stock at zero. Browser catalog/image writes are denied; assets remain public and orphan cleanup is not implemented. |

## 8. Data and persistence

| Entity / store | Business fields | Ownership / lifecycle | Requirements |
|---|---|---|---|
| auth.users | Login email, authentication identity, name metadata | Supabase customer authentication; signup trigger creates profile | AUTH-01–07 |
| profiles | Customer ID, full name, avatar URL, updated_at | Own customer row; admin reads latest 200; checkout can upsert name from address | USR-01, CHK-06 |
| products | ID, name, category, INR price, stock, description, image(s), sizes, colors, brand, tag, created_at, approved aggregates | Public read; intended admin writes; delete cascades related records | CAT, PDP, PRD, STK |
| product_size_stock | Product ID, size, integer stock | Public read; protected server stock write; unique product/size | PDP-03, STK, CHK-06 |
| favorites | User ID, product ID, created_at | Customer-specific; unique pair; removed on product/user deletion | FAV-01–03 |
| Browser els-cart | Validated product display snapshot, base price, chosen size/color, quantity | Restore before first save; recover invalid lines; memory fallback if storage unavailable. Shared across accounts; cleared on successful checkout | CART-01–06, CHK-08 |
| cart_items | User/product/quantity | Schema exists; current cart UI does not use it | CART-04 |
| orders | ID, customer ID, base total, status, shipping JSON, method, placed_at, stock_restored_at | Server checkout creation; own customer read; service-only locked forward lifecycle and one-time cancellation restoration | CHK, ORD, AOR |
| order_items | Order/product IDs, quantity, unit price, size, color | Transaction snapshot; product reference becomes null when product is removed | CHK-06, ORD-02–03 |
| checkout_attempts | Customer ID + attempt UUID, normalized payload, order ID, total, created_at | Private server-only replay record created in the order transaction; payload includes shipping data. No retention policy is defined; linked orders cannot be deleted while referenced without coordinated cleanup | CHK-09, NFR-01 |
| Browser zeouf-checkout-attempt | SHA-256 fingerprint + random attempt UUID | sessionStorage for same-tab reload/retry; memory fallback, removed on success. Form details are not stored here and must be re-entered after reload | CHK-10 |
| reviews | User/product IDs, supplied display name, rating, optional title/comment/images, approval/moderation metadata, admin_reply/replied_at | Server creates pending; approved-only public endpoint returns signed photos and safe fields; author may read own pending after hardening; workflow migration adds name/reply columns, no historical name backfill | REV-01–07 |
| restock_notifications | Product, normalized email, optional size/color, created/notified time, unsubscribe token | Server-only table; product cascade deletion; token deletes a specific alert | RST-01–05 |
| Product image storage | Public product photographs | Server uploads UUID paths under product-images/admin; 2 MiB JPEG/PNG/WebP bucket limits and restrictive browser-write guards. Removing URLs, deleting products or failed/abandoned saves do not delete stored objects | PRD-04 |
| Review image storage | Private object paths under reviews/product/user/random-file | Hardening creates private bucket; server signs owned paths for moderators and approved public reviews for ten minutes; old public objects and orphan cleanup remain | REV-02–04 |
| Admin browser state | HttpOnly admin_token; local admin_auth UI flag | Cookie expires in one hour; local flag is not authority | ADM-01–03 |
| Assistant chat and proposals | User/assistant text, ordered product references/cards, display currency/rate, comparison selections, proposed variants and confirmed flags | Identity-scoped widget memory; identity changes/New conversation clear chat/references/comparisons/retries. Requests send bounded chat/references and signed-in browser cart. Free-text context/tool output goes to Groq; direct card actions use no model. No app conversation table or retention workflow; stateless requests do not establish provider retention behavior | AST-01–10 |

The detail component reads `admin_reply`, `replied_at`, name, and extended product information fields that are not fully defined in the supplied base schema/migrations. Treat additional deployed columns as environment-specific facts; do not assume their existence from TypeScript alone. No retention schedule, data export/deletion request process, shipping-address book, or cross-device cart is established.

## 9. Integrations and API inventory

| Integration | Purpose | Dependency / failure behavior |
|---|---|---|
| Supabase Auth | Customer registration/login/reset-email and sessions | Project authentication settings and redirect allowlist; normal customer flows fail without configuration. |
| Supabase Postgres/RLS | Products, stock, favorites, reviews, profiles, orders, restock requests | Current migrations and policies; listing fallback may mask backend failure. |
| Supabase Storage | Product/review photo uploads | Buckets, grants/policies and allowed image URLs; product and review upload paths differ. |
| Frankfurter rate endpoint | Server INR→USD display rate | Successful result cached/revalidated approximately every 12 hours; failure returns INR. |
| Resend email API | Optional restock email delivery | API key and verified sender; disabled config queues/saves requests; failed sends remain pending. |
| Hosting country headers | Country detection | x-vercel-ip-country first, cf-ipcountry second; browser currency fallback otherwise. |
| Static media / Google fonts | Active hero video/still poster, editorial images and Poppins/Playfair Display | Asset loading/build availability; no CMS. Shared ivory/ink/muted/accent tokens and spacing support the storefront refresh. |
| Groq via server OpenAI-compatible SDK | Shopping assistant text/tool calls | GROQ_API_KEY and optional GROQ_MODEL (code default openai/gpt-oss-20b), fixed https://api.groq.com/openai/v1 base URL; blank/missing key 503, provider quota safe 429, other failures safe 502. Free-plan quotas depend on account; no automatic retries or OpenAI fallback. [Responses documentation](https://console.groq.com/docs/responses-api) lists unsupported store and beta status. Scoped live fixture search/card passed; production catalog, authenticated actions and full model acceptance remain unverified |

### API routes

| Method and path | Authority | Contract / test implication | Requirements |
|---|---|---|---|
| GET /api/storefront/region?fallback=INR or USD | Public | country/currency/rate/rateDate; no-store response | CUR-01–02 |
| POST /api/assistant | Public; 10/address/minute; optional customer bearer for cart tools | messages with bounded assistant productIds, optional display currency/rate and optional similar/compare/prepare_add interaction (+ signed-in browser cart) → deterministic reply/products/actions; free text needs GROQ_API_KEY, card actions do not; invalid payload 400, quota 429, deadline/cancel 504; 35-second server deadline | AST-01–10 |
| POST /api/assistant/confirm | Verified customer bearer token; 10 requests/address/minute | Read-only fresh INR price/options/stock and browser-cart validation; no model/reservation; no-store authoritative action or safe error; 10-second deadline and cancellation return 504 | AST-02, AST-05, AST-07, NFR-08 |
| POST /api/checkout | Customer bearer token + UUID Idempotency-Key | items + shippingAddress + paymentMethod → original/new orderId/total; invalid option/key 400, changed replay or insufficient stock 409 | CHK-01–10 |
| POST /api/restock-notifications | Public; rate-limited | productId/email/size/color → 201 subscribed or 200 already_subscribed with emailConfigured | RST-01–03 |
| GET or POST /api/restock-notifications/unsubscribe?token=… | Capability token in query | Plain-text confirmation; malformed token 400; service failures 503 | RST-05 |
| POST /api/admin/login | Named admin username/password hash and independent signing secret in every environment | JSON or URL-encoded form; checks shared address/account limits, issues signed cookie; missing admin configuration 503; helper key cannot authenticate | ADM-01, NFR-08 |
| POST /api/admin/logout; GET /api/admin/logout | Cookie-clearing endpoint | POST returns 200 JSON status ok/no-store; GET redirects 303 to /admin on the request origin. Both expire the HttpOnly admin cookie, Secure in production | ADM-03 |
| GET /api/admin/orders | Signed admin cookie | All orders with nested lines/products | AOR-01 |
| PATCH /api/admin/orders | Signed admin cookie; same-origin guard; 60 changes/admin/minute | id/status → lifecycle RPC result; shape 400, missing 404, invalid transition/inventory change 409, limit 429, unavailable RPC/limiter 503 | AOR-03–04 |
| GET /api/admin/users | Signed admin cookie | users[] with profile ID/name/avatar/update; cap 200 | USR-01 |
| PATCH /api/admin/stock | Signed admin cookie | productId/size when sized/stock → status/aggregate stock via atomic RPC; invalid data/option 400, unknown product 404, missing config 503, RPC/migration failure 500 | STK-01–04 |
| GET/POST /api/admin/products | Signed admin cookie; mutations same-origin/shared-limited | Read products with size rows; validated create via atomic RPC; safe 400/401/403/413/429/503; create 201 | PRD-01-05 |
| PATCH/DELETE /api/admin/products/[id] | Signed admin cookie; same-origin/shared-limited | Atomic metadata/size edit or confirmed delete; strict UUID; missing product 404; safe write failure 503 | PRD-02-06 |
| POST /api/admin/products/upload | Signed admin cookie; same-origin; 10/admin/minute | One JPEG/PNG/WebP image, signature/size checks; public UUID URL; 201/400/401/403/413/429/503 | PRD-04 |
| POST /api/admin/restock-alerts/notify | Signed admin cookie | productId/optional size → queued or processed/sent/configured; no direct stock validation | RST-04 |
| GET /api/reviews?productId=… | Public; approved-only server query | Up to 100 newest safe review fields, stored names/replies and ten-minute signed owned photos; omits user IDs/raw paths; no service key gives empty displayImages; no-store | REV-01, REV-02, REV-04, REV-07 |
| POST /api/reviews | Customer bearer token | Valid productId/rating/trimmed name 1–120/nonblank comment/optional title/owned private image paths → 201 pending with reviewId; direct customer DB writes denied | REV-01, REV-03, REV-04 |
| POST /api/reviews/upload | Customer bearer token | Multipart images/productId → private object paths[]; one to three signature-checked images, account daily limit; migration-created bucket | REV-02, NFR-08 |
| GET /api/admin/reviews?status=… | Signed admin cookie | Default pending, approved/all accepted, unknown status 400; latest 200 with signed attachments, no-store | REV-05–07 |
| PUT /api/admin/reviews/{id} | Signed cookie, same-origin and mutation limiter | Approves and records time/admin identifier | REV-05 |
| PATCH /api/admin/reviews/{id} | Signed cookie, same-origin and mutation limiter | approved boolean and/or reply string 1–2000 or null; no unknown fields; 400/413 validation, 404 absent, 429 limit, 503 unavailable; safe persisted review response | REV-05–07 |
| DELETE /api/admin/reviews/{id} | Signed admin cookie | Deletes; the former x-dev-key alternate credential is removed | REV-05, ADM-02 |
| POST /api/admin/reviews/approve/{id} | Signed admin cookie | Approves; successful legacy form redirects 303 to /admin/reviews | REV-05–06 |
| POST /api/admin/reviews/delete/{id} | Signed admin cookie | Deletes; successful legacy form redirects 303 to /admin/reviews | REV-05–06 |
| GET /api/health | Public | status/time; no DB check | OPS-01 |
| POST /api/test/reset | Nonproduction + x-test-api-secret | Attempts deletes/reseeds; do not assume full reset | OPS-02 |
| POST /api/test/seed-user | Nonproduction + x-test-api-secret | email/password/fullName or defaults → userId/created | OPS-03 |
| POST /api/dev/create-user | Nonproduction plus mandatory dedicated x-dev-key; never browser signup | Production 403; missing/blank configured key 503; missing/wrong request key 401 before Supabase access; confirmed dev account, ten dev_auto limit | AUTH-07, OPS-04 |
| GET /api/schema | Public | Base schema text only | OPS-05 |

Protected admin APIs generally return 401 for missing/invalid/expired cookie, but exact service/error codes differ per route. Consult the specific route rather than assuming all failures return 503. Product CRUD/images and review replies currently use browser Supabase calls, not cookie-authenticated product/reply APIs.

## 10. Nonfunctional requirements

These are quality acceptance targets. They must be reviewed and implemented/verified where marked T/P; they are not claims of compliance or benchmark results.

| ID | Priority | State | Requirement and acceptance criteria | Source | QA focus |
|---|---|---|---|---|---|
| NFR-01 | P0 | P | Customer-owned data/admin actions shall enforce ownership/authority server-side or in RLS. Checkout/stock/catalog RPCs deny browser execution; catalog routes verify signed admin identity and use service role, with restrictive table/storage write guards in migration. Current inspector checks these contracts. Applied live permissions, remaining review workflow and other role acceptance still require verification. | ADMINCAT, SCHEMA, SECURITYMIG, CHECKOUTSEC, PURCHASEMIG, ADMINAUTH, SECCHECK | Forged identities, public/customer write denial, service-only RPCs, applied migrations, live cross-role checks |
| NFR-02 | P0 | I | Service-role, per-admin password hashes, signing/rate-limit secrets, mail and test secrets stay server-side; QA utilities stay blocked in production. Production admin sessions use a separate signing secret and secure cookie attributes. Live environment/secret provisioning and MFA are unverified. | ADMINAUTH, ADMINLOGIN, TESTAPI, DEVUSER, CHECKOUT | Client bundle/network/log exposure, production guards, secret separation/rotation, MFA gap |
| NFR-03 | P1 | P | Failed services shall show actionable feedback, preserve recoverable user state and avoid false success/partial inventory writes; fallback browsing must be distinguishable from working commerce in acceptance evidence. | NAV, CART, LIST, DETAIL, ADMIN, CHECKOUTUI, STOCKAPI | Offline/timeout/DB/upload/provider/storage errors, retry, pending product navigation with exact destination and browser/server timing correlation |
| NFR-04 | P1 | T | Agree and verify responsive support at 375px mobile, 768px tablet and 1440px desktop, with no clipped essential controls; proposed browsers are current Chromium, Firefox and WebKit. Assistant-specific 320px/390px and keyboard viewport behavior follows AST-11; Chromium emulation does not establish all-device support. | NAV, LIST, DETAIL, ADMIN, ASSIST | Touch/hover differences, drawers, tables, horizontal scroll, assistant keyboard/viewport emulation versus real devices |
| NFR-05 | P1 | T | Proposed accessibility target is WCAG 2.2 AA; assess keyboard operation, meaningful labels, focus placement/trapping/restoration, contrast, announcements and reduced motion. Storefront shell supplies one main landmark, with listing/detail/search/favorites/checkout/history/privacy using div containers to avoid nested main elements; newsletter has an explicit field label/description. Assistant close is immediately inert and reduced-motion preference disables its animated feedback. Scoped landmark/label/motion checks do not prove conformance. | NAV, DETAIL, HOME, LIST, SHELL, SEARCH, FAVORITESPAGE, CHECKOUTUI, HISTORY, INFO, FOOTER, ASSIST | One nonnested main, labelled preview, assistant inert close/focus/reduced motion, full keyboard/screen-reader/contrast audits, modal focus |
| NFR-06 | P2 | T | Agree measurable performance targets and dataset/network conditions before benchmarking; evaluate initial rendering, campaign-media weight, large catalogs and admin full-dataset reads. No current SLA is supplied. | HOME, LIST, ADMIN, REGION | Representative load, slow network, long lists, image sizes |
| NFR-07 | P1 | P | User-facing claims shall match demo capability; storefront denies fulfillment/support/newsletter delivery and admin order values are labelled demo, excluding cancelled orders; approved-only rating metrics and unsized low stock are corrected. Settings connection label and restock concurrency remain gaps. Transaction locks require live multi-session verification. | INFO, FOOTER, DETAIL, CHECKOUTUI, HISTORY, ADMIN, NOTIFY, PURCHASEMIG, ADMINCAT | Demo copy, metric definitions, settings label, live permissions/concurrency, retained limits |
| NFR-08 | P1 | I | Admin login, checkout, review creation/upload, restock subscription and shopping assistant shall use one atomic production database rate-limit counter across instances; missing shared configuration/RPC fails closed with 503. Assistant chat and confirmation each allow 10 requests/address/minute under separate limiter keys. Keys are HMAC-hashed, and the ingress proxy must append or overwrite x-forwarded-for. Nonproduction may use a process-local fallback. Catalog writes and product uploads also use shared per-admin limits of 60 and 10/minute respectively. | RATELIMIT, SECURITYMIG, ADMINLOGIN, CHECKOUT, RESTOCK, REVIEWSAPI, REVIEWUPLOAD, ASSIST, ADMINCAT | Multi-instance limits, assistant limit, 429 boundary, 503 unavailable, proxy-spoof test, account upload quota |

## 11. Dependencies and environment readiness

| Prerequisite | Why it matters | Readiness evidence QA should record |
|---|---|---|
| Next/React application running | UI/API routing and shared providers | Tested URL, build/commit, browser and deployment mode |
| Valid public Supabase URL/anon key | Real authentication/catalog/customer reads | Configured versus local-fallback mode; never copy secret values into reports |
| Server Supabase service role | Checkout transaction, admin reads/stock/moderation, restock/upload/helpers | Server feature availability and negative missing-config tests |
| Admin credentials and separate signing secret | Named admin login and signed admin cookie | Per-admin hashes, distinct secret, rotation/expiry, MFA decision; no values in reports |
| Base schema + current migrations | Required columns/RPC/permissions | Demo catalog after older checkout, then hardening, purchase safeguards, admin catalog, order lifecycle and review workflow. Run current read-only inspector and stage cross-role/concurrency checks; local passes do not prove live state |
| Shared limiter configuration | Cross-instance limits including assistant chat/confirmation | Production npm run start needs valid URL/service role, RATE_LIMIT_SECRET of at least 32 characters, limiter RPC and trusted proxy headers, even on localhost. Nonproduction npm run dev uses a local counter only when shared settings are incomplete; configured RPC failure still fails closed. Health is liveness only. |
| Product/review buckets and permissions | Upload/display functionality | product-images policy, private review-images bucket, moderator signed URLs and historical public-object cleanup |
| Auth configuration | Signup email confirmation and recovery | Password rules, verification requirement, redirect allowlist, email delivery mode |
| Mail settings and public site URL | Valid restock sender/product/unsubscribe links | RESEND_API_KEY/RESTOCK_FROM_EMAIL availability, NEXT_PUBLIC_SITE_URL, sandbox mail recipient strategy |
| Isolated QA database and secret | Repeatable test users and safely scoped setup | Nonproduction environment, TEST_API_SECRET availability, confirmed dataset cleanup |
| Deterministic fixtures | Coverage of category/options/stock/history/moderation | Product IDs resolved after seeding; exact fixture values recorded |
| Shopping assistant configuration | Server-side Groq model calls and shared address limiter | GROQ_API_KEY, optional GROQ_MODEL, current limiter setup; old OPENAI_API_KEY/OPENAI_MODEL no longer read. Use server-only local/hosting env and restart/redeploy. Model overrides must support Responses/function calling and low-effort reasoning. Fake/intercepted tests use no real provider calls and explicitly blank the server key. Run browser suites sequentially despite port override because compilation output is shared; fixture persistent development caching is disabled |

For a fresh isolated test database, apply base schema, review migration, checkout profile fix where needed, checkout security and older transaction, then demo catalog, security hardening, purchase safeguards [admin catalog migration](../supabase_admin_catalog_migration.sql), then [order lifecycle](../supabase_order_lifecycle_migration.sql) and [review workflow](../supabase_review_workflow_migration.sql). Deploy matching schema/app together; never reapply older checkout definitions afterward. Admin catalog adds the service-only save RPC, future-write price/stock checks and restrictive browser catalog/image write guards. NOT VALID preserves legacy invalid rows for explicit repair. The current read-only inspector recognizes the new signatures/permissions; its catalog portion is locally exercised but a complete Supabase run and multi-session stock tests remain required. The new review workflow migration supplies name/reply columns. Configure allowed /reset-password redirects for deployed/preview origins and verify email completion separately. Extended product fields and media cleanup remain separate work.

`npm run seed:products` adds/skips catalog data by name; it is not a reset. New rows with explicit size_stock fixtures insert product rows first, then separate size rows; this is not atomic. A failed size insert leaves products and rerunning skips their names, so staging repair is required. Existing products do not receive these fixtures automatically. The repository documents 280 demo additions (20 per database category), but measure live count after seeding. [Staging product options](../scripts/staging_product_options.sql) explicitly resets stock/sizes for all matching rows under three demo image URLs, preserves UUIDs, and reports resulting rows; use only in an isolated fixture database. It is not part of runtime/build or automatic migration execution. `npm run seed:admin-data` still supplies three orders/four approved reviews and changes stock. Local Docker and single-connection PGlite do not establish Supabase Auth/Storage/API or multi-session acceptance.

Build prerequisites include current generated documentation and an explicit source review. After inspecting source and updating the BRD/QA guide, run `npm run docs:sync`, then `npm run docs:review -- --summary "Describe the inspected change" --requirements "affected IDs"`, and `npm run docs:check`. Use `--no-functional-change` only when the inspected change has no functional/documentation impact. Commit the CSV, requirements-history.json, requirements-source-snapshot.json and requirements-reviews.json with the relevant code/docs. `npm run docs:test` verifies tooling with isolated temporary fixtures; it does not validate live commerce, database policies or email delivery.

The browser suite requires the checked-in Playwright dependency and Chromium (`npx playwright install chromium` locally; CI installs system dependencies as well). It starts its own development server on port 3100 with dummy public Supabase configuration, no service/mail credentials and fixture hashed admin credentials; it refuses an existing server. The shared limiter uses a nonproduction local fallback in this fixture. `turbopack.root` is explicitly the project working directory to avoid parent-lockfile root inference. Functional acceptance against real Supabase remains a separate task.

## 12. Known gaps and business decisions

These are source findings, not executed defect reproductions. Owners and resolution dates are unassigned. A known gap is not permission to mark the corresponding intended requirement passed. Link resulting defect IDs into the RTM after reproduction.

All historical finding IDs are retained. G-06/G-15/G-17/G-18/G-19/G-25 record the scoped admin catalog/dashboard/inspector fixes and remaining portions; older source/test history is not current acceptance. G-26 retains recommendation-cache and live/concurrent integration limits after the scoped assistant corrections.

| Gap | Finding / implication | Requirements | Decision / next action |
|---|---|---|---|
| G-01 | Historical finding: required confirmation was uncontrolled and never compared. Resolved in the 4 October 2026 sprint through controlled exact comparison before either create path. | AUTH-02 | Retain finding history; regression covers unequal/blank/matching values with mocked creation, not live provider signup. |
| G-02 | Historical missing recovery UI/fallback methods are addressed in source with /reset-password, verified-session password update, confirmation, retries and link request. Real email/redirect/session completion remains unverified. | AUTH-05 | Verify allowed deployed redirect, real expired/valid links and project password policy; retain historical finding. |
| G-03 | Historical omitted review name/reply columns and absent photo rendering are addressed by workflow migration, stored name, unified replies and signed approved photos. Existing author names cannot be reconstructed; extended product text/schema, old public images and orphan retention remain. | REV-01, REV-03, REV-07, PDP-06 | Apply schema and verify public/authenticated/storage flows; retain remaining data/media limits. |
| G-04 | Historical source finding: public detail/RLS exposed pending reviews and customer writes could set moderation fields. Source now filters approved public reads and revokes direct customer review writes; authors may read own pending rows. Applied migration and live cross-role behavior remain unverified. | REV-04, NFR-01 | Apply hardening migration and run read-only policy plus role-based visibility/write checks; retain historical finding. |
| G-05 | Historical split/inert moderation paths and JSON form success are replaced with one shared queue, approval/unpublish/delete/replies and legacy 303 redirects. Applied schema, real storage signing and live cookie/limiter acceptance remain unverified. | REV-05–07 | Verify migration, public approval boundaries, reply reload and expired links in staging; retain history. |
| G-06 | Catalog and review replies now use cookie-protected server-only writes; browser catalog/image/review writes are restricted by migrations. Historical unwired public-client reply helpers were removed. Live role/storage permissions remain unverified. | ADM-02, PRD-02-06, REV-07 | Verify current migrations with real admin CRUD/upload/replies and browser-write denial. |
| G-07 | Historical missing size/color/address/payment presentation is addressed in history and admin detail with read-only native dialogs. Historical absent fields and deleted product names/images still use fallbacks. | ORD-03, AOR-03 | Verify actual persisted variants/address/method after reload; retain historical finding. |
| G-08 | Historical option-validation finding addressed by purchase/stock RPCs: configured sizes/colors are enforced, with local SQL regressions. Applied live RPC behavior remains unverified. Routing/metadata lookup still does not enforce product category path. | CHK-09, PDP-01, PDP-09, STK-04 | Verify current migration and live options; retain category-path gap. |
| G-09 | Missing size rows now behave as zero in detail and fail purchase transaction; all-zero sized fixtures offer whole-product alerts. Zero-stock buttons remain disabled, so a specific unavailable size cannot be selected for a size-specific subscription. | PDP-03, RST-01 | Retain unavailable-size selection gap; verify missing-row and mixed-stock behavior against configured services. |
| G-10 | One local cart key still persists across sign-out/accounts; no database cart sync or automatic post-login replay. Assistant reads the signed-in browser's supplied snapshot, not a separately owned database cart. The 4 October sprint fixed restoration/storage issues. | CART-01, CART-04, AST-04 | Account/browser ownership policy remains open; preserve shared-cart baseline and recovery regression coverage. |
| G-11 | Historical fictional card-number/decline README instructions corrected on 4 October; UI approval-or-decline label now corrected on 10 October to successful simulated payment with no charge. No decline branch/card fields were introduced. | CHK-04 | Retain finding history and both-method copy regressions; no live payment acceptance implied. |
| G-12 | Notify is triggered on any positive stock save, not verified zero→positive transition. It checks no inventory itself; size-less request can send all sizes; batch limit/retry/concurrent deduplication can leave wrong/missed/duplicate alerts. | RST-04 | Define eligible recipients, scheduling, batching, failure/duplicate guarantees. |
| G-13 | Historical finding: sidebar logout left the browser cookie valid. Resolved in the 4 October 2026 sprint by awaiting cookie-clearing POST, then clearing UI state and redirecting. | ADM-03 | Retain history; regression verifies real local signed cookie removal, subsequent 401 and failed-request retry. Copied-token revocation is outside this fix. |
| G-14 | Historical replay vulnerability addressed in source on 10 October: customer/key/payload transaction record returns original order before inventory checks; mismatched payload conflicts. Browser retains same-detail key/digest through same-tab reload. Local SQL and mocked lost-response browser regressions are scoped evidence; live applied migration and simultaneous replay are unverified. | CHK-09–10 | Retain history; verify concurrent replays and deployment. Different keys, changed details or lost tab storage can represent new attempts. |
| G-15 | Checkout recovery was previously fixed; catalog/save/delete/upload/stock and order-read/update failures show feedback and forms survive failed saves. Profile reads now expose Retry users and review reads expose retry feedback. Search still lacks explicit retry/blank-query clearing; other admin/stale-data failure paths need review. | SEA-03, CHK-08, NFR-03, ADM-04, PRD-02, USR-02 | Retain unresolved search/other failure portions and history; verify live service failures and stale-data presentation. |
| G-16 | Historical finding: browser admin form sent password only. Form now sends username and password. The 26 October hardening removes the remaining nonproduction dev-key login/signing fallback: named hashes and a separate signing secret are required everywhere. The dev helper now requires its own key and browser signup no longer calls it. | ADM-01, AUTH-07, OPS-04 | Retain history; verify deployed credential provisioning and helper guards. MFA remains a separate decision; scoped local tests do not establish live acceptance. |
| G-17 | Admin API/RPC validates finite nonnegative two-decimal price and whole nonnegative stock; migration adds future-write checks. Existing invalid rows are not rewritten or validated by NOT VALID constraints; inspector flags them. | PRD-03 | Inspect/repair legacy rows explicitly, then validate constraints in staging; no applied-data acceptance claimed. |
| G-18 | Catalog RPC now synchronizes size rows/totals under the checkout product-first lock and prevents metadata edits overwriting current unsized stock. Local SQL covers retention/removal/new rows, rollback and stale form after depletion. Separate seed inserts still need repair on failure; live concurrency/apply status remains unverified. | PRD-05, STK-04, OPS-10 | Verify staging concurrent checkout/stock/catalog edits and seed repair; one local connection is not concurrency proof. |
| G-19 | Historical unrestricted transitions/no cancellation restoration are addressed by a service-only transactional forward lifecycle and one-time pre-shipment restoration. Changed size configuration requires reconciliation; historical cancellations remain unchanged. Live concurrent checkout/cancel/edit and migration application remain unverified. | AOR-04, ANL-01-05, ADM-05 | Apply lifecycle migration and stage independent-session races/rollback plus metric reconciliation; retain history. |
| G-20 | Historical inert View control is replaced by a read-only profile dialog and customer-order search shortcut. Profile reads show retry feedback; account editing/email remain outside scope. | USR-02 | Verify real profile/filtered order permissions, focus and reload; retain history. |
| G-21 | Historical hardcoded configured label now reflects latest protected catalog request with checking/failure/success copy. Settings remain a read-only summary and not a complete connectivity probe. | SET-01 | Verify failure/recovery presentation; no editable settings scope inferred. |
| G-22 | Historical shipping/return and confirmation promises corrected on 10 October across detail/checkout/footer/history/privacy: no fulfillment, returns or support follow-up; newsletter preview disclosed before entry. Terms attribution/license wording still differs from repository documentation; countdown remains unused without discounts. | CNT-01, CNT-03–04 | Preserve remaining attribution/countdown limits; verify demo content, with no commercial policy inferred. |
| G-23 | Reset performs unfiltered deletes without checking results; omits orders/order_items/auth users and local storage. Delete safety restrictions/foreign keys may prevent intended cleanup; reseed may duplicate data. | OPS-02 | Verify cleanup in isolated QA data; create complete deterministic fixtures before relying on helper. |
| G-24 | Historical process-local limiter and direct-review-insert bypass are addressed in source by a shared production RPC and server-only review creation. Migration/config/proxy behavior are unverified; size/main product stock consistency still depends on applied RPC version. | NFR-01, NFR-07, NFR-08, CHK-07 | Verify live limiter, grants, ingress proxy and applied checkout function; retain stock consistency gap. |
| G-25 | Historical removed-signature failure is corrected: inspector uses current five-argument checkout, stock/catalog RPCs and private attempts; checks browser catalog/storage guards and legacy invalid rows. Shared catalog queries pass isolated SQL checks and detect a granted customer RPC. Full Supabase inspector execution is still unperformed. | OPS-09, NFR-01 | Run the full read-only inspector after current migrations and record applied-environment evidence; retain historical failure and live-verification limit. |
| G-26 | Historical size/obsolete-row/false-confirmation defects retain scoped fixture evidence. Current source also corrects assistant men/women membership, rehydrates ordered references, converts display budgets, bounds server work, suppresses model prose and adds validated card interactions. Recommendations still use a 30-second cache; fresh product/stock reads are not atomic, browser cart/rate inputs are not server-owned, and adding reserves no inventory. A separate basic local smoke exercised public policy/search/related cards and product links; this does not establish broad real-provider intent/ordinal/currency evaluation. Deployed disconnect propagation, authenticated Supabase and concurrent confirmation/checkout acceptance remain unverified. | AST-02, AST-03, AST-05, AST-07, AST-08, AST-09, AST-10 | Retain historical evidence; stage current model routing/follow-ups/currency, cancellation, real auth and stock races. Checkout remains the final purchase guard. |

Open owner decisions: which partial requirements block demo release; whether cart belongs to account or browser; admin MFA and review-image retention/cleanup; deployed password recovery/password policy; live lifecycle application and changed-inventory cancellation reconciliation; analytics population; notification eligibility; product photo/description quality; responsive/browser/accessibility/performance targets; sign-off roles. Until resolved, QA must preserve baseline observations separately from target acceptance.

## 13. Testing and acceptance

Use [QA_TESTING_GUIDE.md](QA_TESTING_GUIDE.md) for fixture definitions, coverage dimensions, Given/When/Then seeds, and a test-generation prompt. Use [REQUIREMENTS_TRACEABILITY.csv](REQUIREMENTS_TRACEABILITY.csv) as the editable requirement-to-test matrix. Test cases must link to one or more exact requirement IDs; defects should link to requirement and gap IDs.

Suggested release acceptance:

1. Business owner reviews scope, demo boundaries, priorities, open decisions and document baseline.
2. Every requirement has positive/negative/boundary coverage where applicable, or a reasoned exclusion. C rows record verified configuration; P/T rows carry explicit known-gap/target status.
3. P0 identity, ownership, price integrity, inventory transaction and production-helper guards have execution evidence; unresolved P0 issues are release blockers unless scope is explicitly revised.
4. End-to-end customer ordering with both demo payment choices and admin status visibility passes against an isolated database with current migration version.
5. Browser/responsive/accessibility/error recovery tests meet agreed targets. No unexecuted test is recorded as Passed.
6. QA confirms fixture cleanup and captures API/database assertions, not only UI toasts. Admin save claims are checked after reload.
7. Product owner, development owner and QA owner record accepted exceptions and approve the same document/build revision.

Documentation creation does not establish that the application meets these criteria. No live mutations, database reset, seed, emails or payments were performed while preparing this BRD.

## 14. Source index

Source paths identify implementation evidence; reopen them after changes. The recorded source snapshot identifies the reviewed baseline, including changes beyond the named commit. Source observations and documentation review remain separate from executed acceptance evidence.

| Code | Evidence files |
|---|---|
| HOME | [Home](../src/app/page.tsx) |
| NAV | [Navbar and account/cart/search UI](../src/components/Navbar.tsx), [auth prompt](../src/context/AuthPromptContext.tsx) |
| SHELL | [Site shell](../src/components/SiteShell.tsx), [root layout](../src/app/layout.tsx) |
| ROUTE | [Redirects/rewrites](../next.config.ts) |
| CATDEF | [Categories](../src/lib/categories.ts), [product types/normalization](../src/lib/productTypes.ts) |
| LIST | [Product listing](../src/components/ProductListing.tsx) |
| ASSIST | [Assistant widget](../src/components/ShoppingAssistant.tsx), [interactive product card](../src/components/AssistantProductCard.tsx), [assistant styles and motion](../src/components/shopping-assistant.css), [currency presentation](../src/lib/assistant/presentation.ts), [route](../src/app/api/assistant/route.ts), [handler](../src/lib/assistant/handler.ts), [chat loop and deterministic renderer](../src/lib/assistant/chat.ts), [catalog cache](../src/lib/assistant/catalogStore.ts), [limits/types](../src/lib/assistant/types.ts), [inventory rules](../src/lib/assistant/inventory.ts), [browser/server request cancellation](../src/lib/assistant/requestLifetime.ts), [confirmation handler](../src/lib/assistant/confirm.ts), [confirmation route](../src/app/api/assistant/confirm/route.ts), [tools](../src/lib/assistant/tools.ts), [prompt](../src/lib/assistant/prompt.ts), [policies](../src/lib/assistant/policies.ts), [tests](../tests/assistant.spec.ts), [isolated test configuration](../playwright.assistant.config.ts), [configuration template](../.env.example) |
| CATREQUEST | [Catalog operation deadline and cancellation](../src/lib/catalogRequest.ts) |
| CARD | [Product card](../src/components/ProductCard.tsx) |
| DETAIL | [Product detail](../src/components/ProductDetailView.tsx) |
| DETAILROUTE | [Women's dynamic route](../src/app/kadin/%5Bslug%5D/page.tsx), [men's dynamic route](../src/app/erkek/%5Bslug%5D/page.tsx), [shoe dynamic route](../src/app/ayakkabi/%5Bslug%5D/page.tsx); analogous routes for bags/accessories/perfume/makeup |
| SEARCH | [Search page](../src/app/arama/page.tsx) |
| CURRENCY | [Currency provider](../src/context/CurrencyContext.tsx) |
| REGION | [Region API](../src/app/api/storefront/region/route.ts) |
| DBCLIENT | [Supabase client/local query helper](../src/lib/supabase.ts), [local products](../src/lib/localProducts.ts) |
| FAV | [Favorites provider](../src/context/FavoritesContext.tsx) |
| FAVORITESPAGE | [Favorites page](../src/app/favorilerim/page.tsx) |
| CART | [Cart provider](../src/context/CartContext.tsx) |
| CARTSTORE | [Validated browser cart restoration and variant matching](../src/lib/cartStorage.ts) |
| CHECKOUTUI | [Checkout page](../src/app/checkout/page.tsx) |
| CHECKOUT | [Checkout API](../src/app/api/checkout/route.ts), [rate limits](../src/lib/rateLimit.ts) |
| HISTORY | [Customer orders](../src/app/orders/page.tsx) |
| SCHEMA | [Base schema](../supabase_schema.sql) |
| REVIEWMIG | [Review migration](../supabase_reviews_migration.sql) |
| SECURITYMIG | [Security hardening migration](../supabase_security_hardening_migration.sql) |
| DEMOMIG | [Catalog/stock/options/restock and predecessor checkout migration](../supabase_demo_catalog_migration.sql) |
| PURCHASEMIG | [Current idempotent checkout and atomic stock migration](../supabase_purchase_safeguards_migration.sql) |
| PRODUCTMETA | [Product/collection metadata helper](../src/lib/productMetadata.ts) |
| SEED | [Product fixture data](../scripts/products-data.js), [Supabase product/size seed](../migrate-products.js), [explicit staging option fixtures](../scripts/staging_product_options.sql) |
| PURCHASETEST | [Isolated PostgreSQL purchase and fixture regressions](../scripts/purchase.test.mjs), [test dependency and command](../package.json), [browser/purchase CI](../.github/workflows/storefront.yml) |
| CHECKOUTSEC | [Checkout security migration](../supabase_checkout_security_migration.sql), [profile fix](../supabase_checkout_profile_fix.sql) |
| REVIEWSAPI | [Reviews API](../src/app/api/reviews/route.ts) |
| REVIEWUPLOAD | [Review upload API](../src/app/api/reviews/upload/route.ts) |
| MODPAGE | [Server pending reviews page](../src/app/admin/reviews/page.tsx) |
| MODAPI | [Admin review list](../src/app/api/admin/reviews/route.ts), [approve/update](../src/app/api/admin/reviews/%5Bid%5D/route.ts), [form approve](../src/app/api/admin/reviews/approve/%5Bid%5D/route.ts), [form delete](../src/app/api/admin/reviews/delete/%5Bid%5D/route.ts) |
| RESTOCK | [Subscribe API](../src/app/api/restock-notifications/route.ts) |
| NOTIFY | [Notification API](../src/app/api/admin/restock-alerts/notify/route.ts) |
| UNSUB | [Unsubscribe API](../src/app/api/restock-notifications/unsubscribe/route.ts) |
| ADMIN | [Admin application](../src/components/AdminApp.tsx) |
| ADMINCAT | [Catalog validation/handlers](../src/lib/adminCatalog.ts), [list/create route](../src/app/api/admin/products/route.ts), [edit/delete route](../src/app/api/admin/products/%5Bid%5D/route.ts), [upload route](../src/app/api/admin/products/upload/route.ts), [atomic catalog/storage migration](../supabase_admin_catalog_migration.sql), [admin API/dashboard regressions](../tests/admin.spec.ts), [read-only inspector queries](../scripts/admin_security_inventory.mjs) |
| ADMINLOGIN | [Admin login page](../src/app/admin/page.tsx), [login API](../src/app/api/admin/login/route.ts) |
| ADMINAUTH | [Signed admin token](../src/lib/adminAuth.ts) |
| RATELIMIT | [Shared rate-limit client and nonproduction fallback](../src/lib/rateLimit.ts) |
| ADMINLOGOUT | [Logout API](../src/app/api/admin/logout/route.ts) |
| ADMINAPIS | [Admin orders API](../src/app/api/admin/orders/route.ts), [admin users API](../src/app/api/admin/users/route.ts) |
| STOCKAPI | [Stock update API](../src/app/api/admin/stock/route.ts) |
| FOOTER | [Footer/newsletter](../src/components/Footer.tsx) |
| INFO | [Privacy](../src/app/privacy/page.tsx), [terms](../src/app/kullanim-kosullari/page.tsx) |
| SALE | [Unmounted sale banner](../src/components/SaleBanner.tsx) |
| HEALTH | [Health API](../src/app/api/health/route.ts) |
| TESTAPI | [Test reset](../src/app/api/test/reset/route.ts), [test seed-user](../src/app/api/test/seed-user/route.ts) |
| DEVUSER | [Dev user API](../src/app/api/dev/create-user/route.ts) |
| SCHEMAAPI | [Schema API](../src/app/api/schema/route.ts) |
| RECOVERY | [Password recovery page](../src/app/reset-password/page.tsx), [recovery UI](../src/components/PasswordRecovery.tsx), [recovery tests](../tests/recovery.spec.ts), [fallback auth client](../src/lib/supabase.ts) |
| REVIEWFLOW | [Unified moderation queue](../src/components/AdminReviewQueue.tsx), [protected moderation handler](../src/lib/adminReviews.ts), [signed review images](../src/lib/reviewImages.ts), [review workflow migration](../supabase_review_workflow_migration.sql), [workflow tests](../tests/workflows.spec.ts) |
| ORDERFLOW | [Order lifecycle migration](../supabase_order_lifecycle_migration.sql), [UI transition graph](../src/lib/orderLifecycle.ts), [native admin dialogs](../src/components/AdminDialog.tsx), [workflow tests](../tests/workflows.spec.ts), [SQL regressions](../scripts/purchase.test.mjs) |
| QUALITY | [Read-only storefront audit](../scripts/audit-storefront.mjs), [commands and dependencies](../package.json) |
| REQTOOLS | [Requirements synchronizer and review gate](../scripts/requirements.mjs), [regression tests](../scripts/requirements.test.mjs), [npm scripts](../package.json), [requirements workflow](../.github/workflows/requirements.yml) |
| SECCHECK | [Read-only database security inspection](../scripts/check_security_db.mjs), [admin password hash generator](../scripts/hash_admin_password.mjs) |
| UITEST | [Isolated browser-test configuration](../playwright.config.ts), [configured-catalog fixture configuration](../playwright.catalog.config.ts), [storefront/auth/cart/logout regressions](../tests/storefront.spec.ts), [admin/helper authorization regressions](../tests/admin.spec.ts), [catalog loading/recovery/signup regressions](../tests/catalog.spec.ts), [catalog pagination/filter-reset regressions](../tests/ecommerce/catalog-boundaries-fixture.spec.ts), [browser CI](../.github/workflows/storefront.yml) |
| LIVETEST | [Deployed-site browser configuration](../playwright.live.config.ts), [public browsing smoke checks](../tests/live.spec.ts), [run commands and target override](../README.md) |
| PROJECTDOCS | [Repository README, setup instructions and capability limits](../README.md), [current homepage preview](../screenshots/home.png), [fully loaded homepage](../screenshots/home-full.png), [women's listing](../screenshots/kadin.png), [perfume listing](../screenshots/parfum.png) |

## 15. Glossary and sign-off

| Term | Meaning |
|---|---|
| BRD | Business Requirements Document: agreed scope, behavior, rules and acceptance basis |
| RTM | Requirements Traceability Matrix: requirement → test → result → defect mapping |
| Variant | Product + selected size + selected color; color does not have independent stock here |
| Snapshot | Saved unit price/options at ordering time rather than a later catalog value |
| RLS | Row Level Security: database rules limiting accessible/writable rows |
| RPC | Database function called by server; checkout function groups order and stock operations in one transaction |
| Pending review | Review awaiting approval; source policy lets the author read it, while public product/API lists request approved reviews only; applied database state must be checked |
| Demo order | Saved simulated order that may reduce demo stock, without actual payment or fulfillment |
| Local fallback | Read-only local catalog behavior when real Supabase configuration is unavailable |
| Acceptance criterion | An observable expected result used to decide whether a requirement is met |

| Review role | Name | Decision / exceptions | Date |
|---|---|---|---|
| Product/business owner | Unassigned | Pending scope and open-decision review | — |
| Development owner | Unassigned | Pending technical/schema baseline review | — |
| QA owner | Unassigned | Pending test coverage and executed evidence | — |

Change control: retain requirement IDs when wording changes; assign new IDs for new behavior; record version/date and impacted tests after any change to routes, roles, schema, business rules or acceptance criteria. Update the CSV from the changed rows and preserve execution history separately.
