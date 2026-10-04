# zeouf website — Business Requirements Document

| Document control | Value |
|---|---|
| Version | 1.1 |
| Prepared | 2 October 2026 |
| Product | zeouf — Luxury Fashion & Lifestyle |
| Baseline | Source baseline over commit `3ba7f1c`; documentation tooling reviewed on 4 October 2026. Exact reviewed inputs are recorded in requirements-source-snapshot.json and requirements-reviews.json. |
| Status | Draft for business and QA review; no stakeholder sign-off recorded |
| Audience | Customers, product owner, administrators, developers, manual testers, and test-generation tools |
| Evidence | Repository inspection. No live website, database, email delivery, or end-to-end execution was verified for this document. |

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
| Home and navigation | Browse campaign videos, editorial collection links, categories, account, search, favorites, and cart. | Campaign content is defined in code. |
| Catalog | Browse seven main categories, clothing subcategories and highlights; filter, sort, and load more. | Listings can fall back to a local catalog. |
| Search | Search product names and category text. | Case-insensitive substring search; no relevance engine, suggestions, or full-text index established. |
| Product details | Inspect photographs, verified color options, size choices, quantity, size guide, information panels, related products, and reviews. | Demo-image products hide color choices; some descriptive content uses generic fallback copy. |
| Account | Register, sign in, sign out, reveal password, request a reset email. | Confirmation matching and completion of password recovery are incomplete. |
| Favorites | Save/remove products and see saved products and counts. | Requires a customer session and database. |
| Cart | Add chosen product options, change quantities, remove lines, see totals, proceed to checkout. | Adding requires sign-in; cart is stored in this browser and is not tied to one account. |
| Checkout | Enter contact/address details, choose demo card or simulated cash on delivery, save an order. | No card fields, actual charges, tax/shipping calculation, or delivery integration. |
| Order history | Read one's own orders and expand product lines. | No customer cancellation, refunds, tracking number, or reorder action. |
| Reviews | Submit stars/comments and optional images; read feedback and stored replies. | Public approval behavior and reply/schema support have gaps. |
| Restock alerts | Save an email request; administrator stock updates can trigger email; unsubscribe through a token link. | Delivery is optional and batch-limited; notification eligibility has gaps. |
| Admin | Login, dashboard, products, stock, orders, users, analytics, reviews, settings. | Some catalog writes lack checked-in admin permissions; some controls are informational or incomplete. |
| Information pages | Read terms, privacy notice, and portfolio/demo explanations. | They do not establish a commercial store policy or operational fulfillment service. |
| Newsletter | Submit an email-shaped value to a preview UI. | No subscription record or email is sent. |
| QA utilities | Application health, protected nonproduction reset/user setup, development user creation, schema text. | QA utilities are not customer features; reset is not a proven complete clean-up. |

**Outside the current scope:** real payment gateways; guest checkout; shipping/carrier fulfillment; invoices; tax calculation; coupon/discount engine; returns/refunds workflow; customer profile/address editing; social login/MFA; product comparison; localization beyond existing English presentation and legacy URL compatibility; admin roles/audit logs; full newsletter delivery; exports; editable store settings; independent color inventory. These must not be generated as implemented acceptance tests. Future work needs separate requirements and approval of scope.

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
| `/` | Home: alternating women/men campaign media, collection panels, curated category links, editorial copy | Collection links lead to category/listing pages, not necessarily specific products. |
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
| `/orders` | Customer order history | Account panel; own session |
| `/privacy`, `/terms` | Demo privacy information and terms | Footer/account links; return-home links |
| Account panel | Sign in/register/reset-email request and signed-in order-history/sign-out controls | Header icon or gated action; no dedicated account URL |
| Cart drawer | Browser cart, quantity/removal controls and checkout link | Header cart icon or successful add |
| Size guide overlay | XS–L chest/waist reference | Product detail size-guide button |

English URLs are rewrites to existing Turkish-named source directories. Legacy `/kadin`, `/erkek`, `/parfum`, `/ayakkabi`, `/canta`, `/aksesuar`, `/makyaj`, `/arama`, `/favorilerim`, and `/kullanim-kosullari` redirect permanently to their English equivalents. Specific legacy clothing slugs also translate, e.g. `/kadin/elbise` to `/women/dress`. Test redirects as navigation, not as separate duplicate features. Unrecognized product/subcategory values should produce the framework not-found page. Product helpers also support numeric local fixture IDs and attempt slug lookup; a database `slug` column is not part of the base schema.

### Administrator pages

| Entry | Function / route behavior |
|---|---|
| `/admin` | Password-only browser login |
| `/admin/dashboard` | Inventory snapshot, five recent orders, quick-access links |
| `/admin/products` | Catalog table, name search, category filter, add/edit/delete form |
| Stock Management sidebar item | Stock editing within `AdminApp`; no standalone `/admin/stock` page exists |
| `/admin/orders` | Search/filter orders; open detail modal; change status |
| `/admin/users` | Profile list; View control currently has no action |
| `/admin/analytics` | Order, inventory, top-product, and review summaries |
| `/admin/reviews` entered directly | Separate server-rendered pending-review page with approve/delete forms |
| Reviews sidebar item within `AdminApp` | Different, read-only all-review list; no visible reply/approve/delete controls |
| `/admin/settings` | Read-only store/catalog/database summary |

Sidebar navigation changes component state, not the browser URL. A refresh restores the page associated with the route originally opened. The storefront header/footer are omitted on admin pages.

## 5. User journeys

| Journey | Preconditions | Main flow | Result / exceptions | Requirements |
|---|---|---|---|---|
| J-01 Discover and inspect | Visitor; local or configured catalog | Home → category/subcategory → filters/sort/load more → card → product detail | Matching products or empty state; unsupported ID gives not-found | NAV-01–07, CAT-01–08, PDP-01–06 |
| J-02 Find by search | Visitor | Open search → enter query → submit → results → product | Name/category substring matches, deduplicated; blank header search stays put | SEA-01–03, PDP-01 |
| J-03 Create/use account | Auth configured | Account → Register → details → submit → verification if configured → Sign In | Session activates customer features; errors stay in account panel; matching confirmation is a gap | AUTH-01–07 |
| J-04 Save for later | Customer signed in | Heart on card/detail → favorites page → remove heart | Account-specific favorites/count update; visitor gets prompt | FAV-01–03 |
| J-05 Build cart | Customer; purchasable product | Select size/color if offered → quantity → add → drawer → edit/remove → refresh | Variant lines persist in this browser; inventory rechecked at checkout | PDP-03–04, CART-01–06 |
| J-06 Place demo order | Customer; nonempty cart; server/database ready | Checkout → all shipping fields → demo method → submit → confirmation → history | One pending demo order, trusted price snapshot, inventory reduction, cleared cart; failure keeps cart | CHK-01–09, ORD-01–03 |
| J-07 Leave feedback | Customer; review schema/storage ready | Detail → name/stars/comment → optional images → submit | Optimistic item then saved record or rollback/error; moderation visibility unresolved | REV-01–07 |
| J-08 Get restock notice | Unavailable item/size; alert database ready | Email request → pending subscription → admin adds stock → optional email → unsubscribe | Duplicate pending request reused; missing mail config saves request; eligibility/UI gaps apply | RST-01–05, STK-01–04 |
| J-09 Maintain products | Admin session and write permissions | Admin → Products → create/edit/images/sizes → stock view → publish through saved data | Database permission and size synchronization gaps can block intended save | ADM-01–04, PRD-01–06, STK-01–04 |
| J-10 Operate store | Admin session; orders/reviews exist | Dashboard → orders → status update → analytics; direct reviews route → moderation | Customers see changed status on reload; cancellation does not restore stock | AOR-01–04, ANL-01–05, REV-05–07 |

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

The catalogue contains 112 requirements across 19 modules (including nonfunctional requirements), with **24 source-level gap findings** tracked in section 12.

### 6.1 Home, navigation, and routes

| ID | Priority | State | Requirement and acceptance criteria | Source | QA focus |
|---|---|---|---|---|---|
| NAV-01 | P1 | I | Home shall show women/men campaign slides with matching collection links; automatic slide change occurs about every six seconds and is skipped when reduced motion is requested. | HOME | Timers, manual slide controls, video loading, reduced motion |
| NAV-02 | P1 | I | Collection panels and six curated feature tiles shall navigate to their configured category/subcategory destinations; editorial images are not live stock-driven product recommendations. | HOME | Every CTA and destination |
| NAV-03 | P1 | I | Desktop navigation shall expose all seven categories and women's/men's subcategory/highlight menus. | NAV, CATDEF | Hover/menu open-close and click |
| NAV-04 | P1 | I | Mobile navigation shall open/close and expose category links and expandable clothing menus. | NAV | Touch, narrow screen, menu dismissal |
| NAV-05 | P1 | I | Header shall expose account, search, favorites and cart; logo returns home; drawers/overlays can be closed through their available close/backdrop actions. | NAV, SHELL | State transitions, counts, overlay stacking |
| NAV-06 | P1 | I | English URLs and their legacy redirects/rewrites shall resolve to the intended page, including mapped legacy clothing slugs. | ROUTE | Direct URL, encoded query, redirect destination |
| NAV-07 | P1 | I | Unknown product/subcategory routes shall reach not-found; storefront chrome shall be absent from admin pages. | ROUTE, DETAILROUTE, SHELL | Missing ID, route refresh, admin layout |

### 6.2 Catalog listing

| ID | Priority | State | Requirement and acceptance criteria | Source | QA focus |
|---|---|---|---|---|---|
| CAT-01 | P1 | I | Listings shall restrict products to the selected category/subcategory using configured English categories and normalized matching; women's and men's collections remain distinct. | LIST, CATDEF | All 14 database categories, alias/normalization cases |
| CAT-02 | P1 | I | New Arrivals shall match tags containing new; Best Sellers shall match best/featured/populer tags; Collection shall include the main category. No sales ranking is implied. | LIST | Tags, main-category boundary, English/legacy slugs |
| CAT-03 | P1 | I | Brand and size filters shall use distinct values in the current collection and combine with other selected filters; missing option groups shall not show unusable selectors. | LIST | Single and combined filters, missing metadata |
| CAT-04 | P1 | I | Price filters shall apply inclusive displayed-currency min/max bounds through two sliders and suggested Under tiers; sliders shall not cross; currency changes clear price bounds. | LIST, CURRENCY | Boundary prices, tier rounding, currency change |
| CAT-05 | P1 | I | In stock only shall keep unsized products with positive stock and sized products with available size stock; selected size shall constrain availability when stock rows exist. | LIST | Stock 0/1, mixed sizes, missing size rows |
| CAT-06 | P1 | I | Sort shall offer Recommended, Price Low to High, Price High to Low, and New Arrivals; listing price ties use name; New Arrivals prioritizes new tags then date then name. Recommended retains incoming order. | LIST | Equal price/date, missing date/tag |
| CAT-07 | P1 | I | Listing shall initially reveal at most 24 matches and load 24 more per click; count shall describe matching versus collection totals; loading and empty/no-filter-match states shall appear appropriately. | LIST | 0/1/24/25/48/49 products, final batch, clear all |
| CAT-08 | P1 | I | Listing shall use local products when Supabase is unconfigured or product fetch fails; fallback browsing shall not imply that order/auth services work. | LIST, DBCLIENT | Unconfigured versus configured service failure |

### 6.3 Search

| ID | Priority | State | Requirement and acceptance criteria | Source | QA focus |
|---|---|---|---|---|---|
| SEA-01 | P1 | I | Header search shall focus its field, trim input, ignore empty submission, encode the query, close the search UI and navigate to /search?q=…. | NAV | Spaces, ampersand, Unicode, keyboard submit |
| SEA-02 | P1 | I | Results shall combine case-insensitive name and category substring queries and deduplicate by product ID. | SEARCH, DBCLIENT | Name-only/category-only/both matches, case, no matches |
| SEA-03 | P2 | P | Search shall show loading, query/count, results, and no-results states; explicit service-error/retry handling and clearing old results for a blank query are incomplete (G-15). | SEARCH | Slow/error responses, rapid query changes, blank after valid query |

### 6.4 Product cards and details

| ID | Priority | State | Requirement and acceptance criteria | Source | QA focus |
|---|---|---|---|---|---|
| PDP-01 | P1 | I | Cards/detail shall present product name, price and image, optional brand/tag/category, and a product link; detail shall use gallery thumbnails when multiple applicable photographs exist. | CARD, DETAIL | Single/multiple/missing images, supported remote host |
| PDP-02 | P1 | I | Verified color options shall expose named swatches and applicable images; selected color accompanies cart line. Products under /demo-products/ shall hide colors and use one demo photograph. | CARD, DETAIL | Color/image correspondence, no-color/demo fixtures |
| PDP-03 | P0 | P | Sized products shall require a chosen available size before add; unavailable sizes are disabled. Missing stock rows and selecting an unavailable size for an alert need resolution (G-09). | DETAIL | No size, stock 0, missing row, mixed stock |
| PDP-04 | P1 | I | Detail quantity shall start at one, not decrease below one, clamp to known positive available stock, and disable add/increase when the known limit is reached. | DETAIL | 1, stock limit, size change, unknown stock |
| PDP-05 | P2 | I | Size guide shall open/close and show XS/S/M/L chest and waist references; it is a static clothing reference, not a product-specific shoe or XL/XXL guide. | DETAIL | Overlay dismissal and reference values |
| PDP-06 | P2 | I | Detail shall offer one-open-at-a-time information panels for details, measurements, composition/care/origin, and shipping/exchanges/returns, using supplied text or generic fallback. | DETAIL | Open/switch/close, newline content, defaults |
| PDP-07 | P2 | I | Complete Your Look shall show up to eight other products whose category starts with the main category; the current product is excluded and an empty related section is hidden. | DETAIL | 0/1/8 related items, links, horizontal scroll |
| PDP-08 | P1 | I | In-stock unsized cards shall allow quick-add; sized cards shall send the user to choose size; out-of-stock cards shall display unavailable status and hide add controls. | CARD | Sized/unsized/out-of-stock and signed-out actions |

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
| AUTH-02 | P0 | P | Password confirmation shall match the password before registration; current required confirmation field is not compared or stored (G-01). | NAV | Equal/unequal/blank confirmation, reveal toggle |
| AUTH-03 | P0 | C | Sign In shall authenticate email/password, display failure, show loading, and close account panel on session success; protected customer actions become available. | NAV | Valid/wrong/unverified/expired account, repeat submit |
| AUTH-04 | P1 | I | Password visibility shall toggle in account forms without changing the entered password; Sign In/Register tabs shall be available. | NAV | Toggle, switch tab, stale feedback |
| AUTH-05 | P1 | P | Forgot Password shall require entered email and request a reset email; a complete new-password recovery screen/session handler is absent (G-02). | NAV | No email, provider error, reset link and recovery completion |
| AUTH-06 | P0 | C | Sign Out shall end customer session and clear in-memory favorites through auth updates; local cart currently remains. | NAV, FAV, CART | Reload, protected actions, account switch/cart boundary |
| AUTH-07 | P1 | C | Development registration may first try confirmed-user creation; on failure/unavailability it shall fall back to normal signup. Production helper shall be disabled. | NAV, DEVUSER | Protected helper failure, normal signup, production |

### 6.7 Favorites

| ID | Priority | State | Requirement and acceptance criteria | Source | QA focus |
|---|---|---|---|---|---|
| FAV-01 | P1 | C | Signed-in customers shall toggle a product favorite from card/detail; stored user/product pair is unique and successful changes update icon/count. | FAV, CARD, DETAIL, SCHEMA | Toggle/add/remove, duplicate click, failed write |
| FAV-02 | P0 | C | Favorites shall load for the current user and clear on sign-out; one customer must not read/change another customer's favorites. | FAV, SCHEMA | Two-account isolation, reload, direct database access |
| FAV-03 | P1 | C | Favorites page shall display saved product cards/count, loading, and empty Discover Collection link; visitors attempting to favorite shall get an account prompt. | FAVORITESPAGE, FAV, NAV | Empty/deleted product, guest prompt, card navigation |

### 6.8 Cart

| ID | Priority | State | Requirement and acceptance criteria | Source | QA focus |
|---|---|---|---|---|---|
| CART-01 | P0 | I | Add shall require a customer session; a visitor receives an account prompt without addition; successful add opens drawer. The interrupted action is not automatically replayed after login. | CART, NAV | Guest/customer, post-login retry |
| CART-02 | P1 | I | Lines shall be identified by product ID + size + color; matching tuples merge quantities and differing options create distinct lines. | CART | Same/different options, null/missing color, repeated add |
| CART-03 | P1 | I | Drawer shall show image/name/options/quantity/line total; plus/minus updates quantity; a quantity below one or explicit remove deletes the line. | CART, NAV | Remove at one, variant-specific deletion, total changes |
| CART-04 | P0 | P | Browser cart shall persist under els-cart; user-specific separation, sign-out clearing, corrupted-state recovery, and safe hydration need decisions/fixes (G-10). No cart_items synchronization is implemented. | CART | Refresh, malformed storage, two accounts, initial load |
| CART-05 | P1 | I | Item badge equals sum of quantities; base subtotal equals sum of stored line price × quantity, displayed through currency formatter. Checkout determines authoritative current prices. | CART, NAV, CHECKOUT | Multiple lines, rounding, changed database price |
| CART-06 | P1 | I | Empty drawer shall show Start Shopping; nonempty drawer shall show Proceed to Checkout and close when navigating; cart UI currently has no upper quantity cap. | NAV, CART | Empty/nonempty, close, quantity above API limit |

### 6.9 Demo checkout

| ID | Priority | State | Requirement and acceptance criteria | Source | QA focus |
|---|---|---|---|---|---|
| CHK-01 | P0 | C | Order submission shall require valid customer bearer token and nonempty cart; UI disables guest/empty submission and API rejects invalid/expired sessions. | CHECKOUT, CHECKOUTUI | Guest, expired token, forged user ID, empty cart |
| CHK-02 | P1 | C | All five shipping fields shall be nonempty after server trimming: full name, phone, address, city, postal code; current server truncation limits in section 7 apply. | CHECKOUT, CHECKOUTUI | Missing/whitespace fields, limits, numeric-looking strings |
| CHK-03 | P0 | C | Request shall contain 1–50 raw item entries and each normalized variant quantity shall be an integer 1–20; duplicate tuples merge and merged quantity above 20 fails. | CHECKOUT | 0/1/50/51 lines, quantity 0/1/20/21/fraction, duplicates |
| CHK-04 | P1 | D | Checkout shall offer demo card and simulated cash on delivery, clearly state no charge/delivery, and collect/send no card details. Current card flow adds a roughly 1.2-second simulation delay; no decline branch exists. | CHECKOUTUI, CHECKOUT | Both methods, request payload, stale decline copy G-11 |
| CHK-05 | P0 | C | Server shall fetch current inventory and use database price snapshots, ignoring browser-supplied prices/totals; selected size inventory applies when size is sent. | CHECKOUT, DEMOMIG | Price tampering, stale price, removed product |
| CHK-06 | P0 | C | A successful transaction shall create one pending order and all lines with quantity, unit price, size/color; decrement inventory and set total to sum of snapshots. | CHECKOUT, DEMOMIG | Sized/unsized/multi-line transactions, shared color stock |
| CHK-07 | P0 | C | Insufficient stock at precheck or transaction shall return conflict; transaction failure shall leave no partial order/lines/stock decrement. Competing orders must not oversell. | CHECKOUT, DEMOMIG | Last unit concurrency, later-line failure, DB failure |
| CHK-08 | P1 | C | On successful returned order ID, UI shall clear cart and show confirmation/ID and Continue Shopping; API failure shall show error and keep cart. | CHECKOUTUI | Success, error response, malformed response, network rejection G-15 |
| CHK-09 | P0 | P | Order service shall reject unsupported size/color and prevent duplicate orders from replay; current validation lacks catalog-option enforcement and idempotency (G-08, G-14). | CHECKOUT, DEMOMIG | Invalid option, sized item without size, repeated identical POST |

### 6.10 Customer orders

| ID | Priority | State | Requirement and acceptance criteria | Source | QA focus |
|---|---|---|---|---|---|
| ORD-01 | P0 | C | Customers shall retrieve only their own orders, newest first, including order lines; guest, loading, error and no-order states shall be distinct. | HISTORY, SCHEMA, CHECKOUTSEC | Two-account ownership, direct reads, empty/error |
| ORD-02 | P1 | C | Order cards shall show short ID, date, formatted total and status; expanding one order shows product/image, quantity, line total and payment label. | HISTORY | Expand/collapse, deleted product fallback, all statuses |
| ORD-03 | P1 | P | Selected size/color shall remain stored and should be visible in history/admin detail; the current views retrieve them but omit presentation (G-07). | HISTORY, ADMIN, DEMOMIG | Variant persistence versus rendered detail |

### 6.11 Reviews and moderation

| ID | Priority | State | Requirement and acceptance criteria | Source | QA focus |
|---|---|---|---|---|---|
| REV-01 | P1 | C | Review form shall require nonblank displayed name/comment and selected stars before submit, authenticate the user, and store product/user/rating/comment plus optional image URLs. Current direct insert omits displayed name (G-03). | DETAIL, REVIEWMIG | Missing fields, guest, rating 1/5, returned anonymous name |
| REV-02 | P1 | C | Optional review upload shall accept 1–3 JPEG/PNG/WebP images no larger than 2 MiB each, with customer bearer token and existing product; UI shall preview/remove selected files. | DETAIL, REVIEWUPLOAD | 0/1/3/4 files, exact size/over size, MIME, invalid token/product |
| REV-03 | P1 | C | Submission shall insert a temporary visible review, replace it on success or remove it on upload/database failure and show error; current form clears before persistence. | DETAIL | Optimistic success/rollback, retry/data loss, image display gap |
| REV-04 | P0 | P | Intended moderation shall publish only approved feedback in public results and average/count; current detail/RLS expose pending reviews and detail average includes them (G-04). | DETAIL, REVIEWSAPI, SCHEMA, REVIEWMIG | Pending/approved visibility, own pending review, rating consistency |
| REV-05 | P1 | C | Direct /admin/reviews shall list pending reviews and let a cookie-authenticated admin approve/delete; approval records moderation time and updates database approved aggregates. | MODPAGE, MODAPI, SCHEMA | Valid/expired admin, approval/deletion, pending empty state |
| REV-06 | P1 | P | Admin review navigation shall provide a coherent moderation experience; direct pending page and sidebar all-review read-only view currently differ, and form results return JSON (G-05). | ADMIN, MODPAGE, MODAPI | Both entry paths, form submission and return flow |
| REV-07 | P1 | P | Admin shall be able to save/remove a reply and customers shall read persisted reply text; helper functions exist without visible reply controls and reply columns are missing from supplied schema/migrations (G-03, G-05). | ADMIN, DETAIL, SCHEMA, REVIEWMIG | No false success, reply persistence, public display |

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
| ADM-01 | P0 | C | Browser admin login shall use configured password and issue one-hour HttpOnly/SameSite=Lax cookie, Secure in production; loading/errors/reveal toggle shall be available. Optional configured username blocks password-only form (G-16). | ADMINLOGIN, ADMINAUTH | Wrong/empty credential, cookie attributes, username setting |
| ADM-02 | P0 | P | Server mutations/private reads shall require admin authority independent of local UI flag; product writes and reply helpers do not use that authority in current implementation (G-06). | ADMIN, ADMINAUTH, ADMINAPIS, SCHEMA | Fake local flag, expired/forged cookie, customer-only session |
| ADM-03 | P0 | P | Admin Sign Out shall revoke browser admin access; sidebar currently only removes local flag while logout endpoint clears cookie (G-13). | ADMIN, ADMINLOGOUT | API after sidebar logout versus endpoint logout |
| ADM-04 | P1 | C | Dashboard shall show product/stock/out-of-stock/low-stock counts, up to five newest orders, inventory warning and quick links; no-order state shall display when empty. | ADMIN | Known fixture metrics, newest five, route/sidebar state |

### 6.14 Admin product management

| ID | Priority | State | Requirement and acceptance criteria | Source | QA focus |
|---|---|---|---|---|---|
| PRD-01 | P1 | C | Admin product table shall list newest created products and combine case-insensitive name search with exact category filter, showing no-match state. | ADMIN | Search, category, combined/empty, reload |
| PRD-02 | P1 | P | Add/edit shall save name/category/price/overall stock/description/sizes/main image/image list and reflect persisted values; current anonymous-client writes lack admin write policies (G-06). | ADMIN, SCHEMA | Create/edit/reload, permission denied, failed save feedback |
| PRD-03 | P0 | P | Product saves shall enforce nonblank name, finite nonnegative price and integer nonnegative stock; current check only ensures name/price presence and parsing (G-17). | ADMIN, SCHEMA | Whitespace, zero, negative, fraction, invalid number |
| PRD-04 | P1 | C | Product image form shall append pasted URL or one uploaded image per selection, set first image as main, and promote first remaining image when one is removed; uploads use product-images bucket. | ADMIN | Multiple sequential adds, delete first/last, upload failure/host |
| PRD-05 | P1 | P | Sizes shall be selectable from XS–XXL and 36–44; new sized products initialize zero stock rows. Editing sizes shall synchronize rows/aggregate stock, which is currently incomplete (G-18). | ADMIN, DEMOMIG | Add/remove size, zero initialized rows, old stock |
| PRD-06 | P1 | P | Delete shall require confirmation and reflect actual database removal; dependent favorite/review/size/alert rows cascade and historical order lines retain price/quantity with null product. Permission/error reporting gap applies. | ADMIN, SCHEMA, DEMOMIG | Cancel/confirm, referenced product, failed delete, history |

### 6.15 Admin stock

| ID | Priority | State | Requirement and acceptance criteria | Source | QA focus |
|---|---|---|---|---|---|
| STK-01 | P0 | C | Stock view shall expose one row per configured size or one Overall row for unsized products; edits save on field blur through protected stock PATCH. | ADMIN, STOCKAPI | Sized/unsized, blur versus typing, expired cookie |
| STK-02 | P0 | C | Stock API shall reject negative/noninteger values; size save shall upsert product/size row and recalculate product stock from all stored size rows. | STOCKAPI | 0/1/4/5, negative/fraction, missing/existing row |
| STK-03 | P1 | I | Row labels shall be Out of stock for zero, Low stock for 1–4, Available for 5+; dashboard low-stock count currently considers sized products only. | ADMIN | Thresholds, unsized low stock discrepancy |
| STK-04 | P0 | P | Size/overall inventory shall remain consistent on failures/concurrent saves; current multi-request stock update is not atomic and size membership is not enforced (G-18). | STOCKAPI, ADMIN | Failure between writes, concurrent edits, unsupported size |

### 6.16 Admin orders and users

| ID | Priority | State | Requirement and acceptance criteria | Source | QA focus |
|---|---|---|---|---|---|
| AOR-01 | P0 | C | Admin shall retrieve orders/lines newest first through authenticated API; table shall show ID/customer ID/INR total/status/date and View action. | ADMIN, ADMINAPIS | All versus own orders, expired cookie, retrieval failure |
| AOR-02 | P1 | I | Order search shall match order ID or customer ID case-insensitively and combine with exact status filter, distinguishing no orders from no matches. | ADMIN | Partial ID, casing, all five statuses |
| AOR-03 | P1 | C | View shall open order detail with product/quantity/line totals/order total and status selector; valid status updates persist and appear in customer history on reload. | ADMIN, ADMINAPIS, HISTORY | Open/close, update/reload, failed status change |
| AOR-04 | P0 | P | Allowed status values are pending/processing/shipped/delivered/cancelled; server currently permits any transition among them and cancellation restores no stock. Lifecycle/stock semantics require decision (G-19). | ADMINAPIS, ADMIN | Unsupported status, backward transition, cancellation |
| USR-01 | P1 | C | Admin users list shall retrieve at most 200 profiles ordered by updated_at, presenting ID/full name/update time; endpoint shall reject non-admin access. | ADMIN, ADMINAPIS | No profiles, cap 200/201, permissions |
| USR-02 | P2 | P | User View shall open profile detail only when implemented; current button has no handler. Editing, disabling, deleting or viewing user email are not supported flows. | ADMIN | Inert View control G-20 |

### 6.17 Analytics and settings

| ID | Priority | State | Requirement and acceptance criteria | Source | QA focus |
|---|---|---|---|---|---|
| ANL-01 | P1 | C | Analytics shall show sum of all loaded order totals, order count, average total per order (zero when empty), and stock units in INR/base values. Cancelled orders currently contribute. | ADMIN | Known totals, zero orders, cancelled inclusion |
| ANL-02 | P2 | I | Order pipeline shall show count and rounded percent for each of five statuses; rounding need not sum to exactly 100%. | ADMIN | Empty and uneven status distribution |
| ANL-03 | P1 | I | Inventory health shall show healthy=max(products−low−out,0), low/out counts and units derived from configured sizes or unsized stock. | ADMIN | Sized-only low count, inconsistent stored rows |
| ANL-04 | P2 | C | Top products shall rank up to five currently existing products by quantities in all loaded orders, including cancelled orders; empty sales state shall be shown. | ADMIN | Ties, deleted product, cancelled items, no sales |
| ANL-05 | P2 | C | Customer signal shall show loaded review count and mean rating to one decimal, zero when empty; current calculation is not approved-only. | ADMIN | Mixed approvals, 0/1/multiple reviews |
| SET-01 | P2 | D | Settings shall display store identity and catalog/category counts; database label is hardcoded. No configuration save, working feature toggles or live connectivity probe exists. | ADMIN | Read-only presentation, misleading connectivity G-21 |

### 6.18 Content and operational utilities

| ID | Priority | State | Requirement and acceptance criteria | Source | QA focus |
|---|---|---|---|---|---|
| CNT-01 | P1 | D | Footer newsletter shall require an email-shaped value, then show preview-only/no-save/no-send feedback. There shall be no implied successful real subscription. | FOOTER, INFO | Invalid/valid email, no network subscription/write |
| CNT-02 | P1 | I | Footer shall link all categories, favorites, privacy, terms and maintainer GitHub; information pages shall provide return-home navigation. | FOOTER, INFO | All destinations and external link attributes |
| CNT-03 | P1 | D | Checkout/privacy/terms shall explain demo limits and stored demo data; generic shipping/returns copy and confirmation wording need alignment (G-22). | INFO, DETAIL, CHECKOUTUI | Content consistency and fictional data guidance |
| CNT-04 | P2 | T | Holiday countdown component exists but is not mounted by current pages; enabling it needs scope confirmation. It counts to local-browser 31 Dec 2026 23:59:59, clamps at zero, and applies no discount. | SALE, SHELL | Exclude from current UI pass criteria; future timer tests |
| OPS-01 | P2 | I | GET health shall return status ok and timestamp; it is application liveness, not a database/service readiness proof. | HEALTH | JSON and timestamp, no inferred DB health |
| OPS-02 | P0 | P | Test reset shall be nonproduction and test-secret protected; it attempts catalog/favorite/cart/review cleanup and reseed but omits orders/local storage and ignores delete errors (G-23). | TESTAPI | Production 404, wrong secret 401, partial reset |
| OPS-03 | P1 | C | Test seed-user shall create a confirmed test user or reset an existing matched user's password, guarded by nonproduction plus separate test secret; inputs or configured defaults are required. | TESTAPI | New/existing user, missing fields, auth/production |
| OPS-04 | P1 | C | Dev create-user shall be disabled in production, require x-dev-key when configured, and cap counted dev_auto users at ten; it shall not overwrite non-dev accounts. | DEVUSER | Limit boundary, existing dev/non-dev, helper fallback |
| OPS-05 | P2 | I | Schema endpoint shall return base SQL as plain text or not-found; database-error copy action uses it. It does not include all migrations or fix the database automatically. | SCHEMAAPI, DETAIL | Schema available/missing, clipboard failure |
| OPS-06 | P1 | I | Requirements CI shall run the checked-in synchronization regression tests. Build and lint shall reject stale derived documentation, unreviewed tracked website source, or a mismatched review snapshot/log. Synchronization preserves manual fields and archives changed/retired rows; affected executed results become Needs retest. An explicit descriptive review is required to approve source changes and shall never mark tests Passed. | REQTOOLS | Missing snapshot, source drift, CSV manual evidence, retired IDs, repeated sync, review assertions |

## 7. Business rules and validation

### Catalog and inventory rules

| Rule | Baseline and test implication |
|---|---|
| BR-01: Main taxonomy | Seven storefront categories; 14 admin/seed database categories: Women's Dress, Women's Blouse & Shirt, Women's Jacket, Women's Skirt, Women's Trousers, Men's Suit, Men's Shirt, Men's Trousers, Men's Jacket, Shoes, Bags, Accessories, Perfume, Makeup. |
| BR-02: Highlights | New/best labels use tags, not date windows or computed sales. Recommended has no documented merchandising score. |
| BR-03: Sizes | Admin choices XS/S/M/L/XL/XXL and 36–44; products may have no sizes. Stock rows are unique per product/size. |
| BR-04: Stock | Unsized sale uses products.stock; sized sale uses product_size_stock. A size edit recalculates the product total. Dashboard sums configured sizes; API recalculation sums all stored size rows, including stale rows. |
| BR-05: Colors | Color selection changes display/cart/order metadata; inventory is shared across colors. Demo photograph products suppress colors to avoid unsupported visual variants. |
| BR-06: Pricing | Base catalog/order money is treated as INR. Display rounds after conversion to zero decimal places; SQL unit prices preserve numeric precision. Displayed line sums may differ from rounded displayed aggregate by a unit. |
| BR-07: Related products | Category-prefix matching, up to eight, excluding current ID; no personalized recommendation or availability guarantee. |

### Checkout validation and response behavior

| Field / condition | Source baseline | Tests to derive |
|---|---|---|
| Customer identity | Taken from verified bearer session; not caller user_id | Missing/invalid/expired token; attempts to order for another account |
| Item entries | Raw array length 1–50 | 0, 1, 50, 51; non-array |
| Product ID | Trimmed string, truncated to 100; no strict UUID validation in checkout route | Missing/string/numeric/malformed/removed ID; distinguish 400/409/500 behavior |
| Quantity | Number conversion then integer 1–20; duplicates merge per ID/size/color and merged amount must stay ≤20 | Numeric string, null, 0, 1, 20, 21, fraction; duplicate merged boundary |
| Size / color | Optional trimmed strings, truncated to 30/40; not checked against catalog options | Missing size for sized product, invented size/color; label as G-08 target tests |
| Full name | Required trimmed string; truncated to 120 | Empty/whitespace, 119/120/121 |
| Phone | Required trimmed string; truncated to 40; no country/phone-format rule | Empty, 39/40/41, alphabetic accepted baseline |
| Address | Required trimmed string; truncated to 500 | Multiline, whitespace, 499/500/501 |
| City | Required trimmed string; truncated to 120 | Unicode, empty, 119/120/121 |
| Postal code | Required trimmed string; truncated to 24; numeric input hint only | Leading zeros, letters, 23/24/25; no country-based validation assumed |
| Payment method | Exactly card_demo or cash_on_delivery | Missing/unsupported value; both valid choices |
| Stock | Precheck and guarded SQL transaction; zero/insufficient stock fails | Exact stock, one over, concurrency, rollback after earlier successful line |
| Price/total | Database snapshot; no additional tax, shipping or discount fields | Tampered browser total, price change since addition, decimal rounding |

Long strings are **truncated**, not rejected, by current checkout normalization. Tests must not invent password complexity, phone patterns, postcode length rules, delivery-country restrictions, consent checkboxes, or shipping fees. Customer password rules and signup email verification are determined by the configured Supabase project and must be captured as fixture/environment facts.

Checkout responses: success `200 {orderId,total}`; invalid payload `400`; customer/session failure `401`; insufficient stock `409`; process-local rate limit `429`; missing service config/inventory lookup failure `503`; transaction failure `500`. Malformed product IDs can reach a transaction/database failure rather than a clean validation response. Rate limiting executes before other validation, so repeated requests can mask later errors.

### Additional rules

| Rule | Baseline / unresolved decision |
|---|---|
| BR-08: Order status | All five supported labels may be set from any current status. No transition graph, customer cancellation, refund, or stock reversal is implemented. |
| BR-09: Order contents | Price/quantity/options are snapshots; product name/image are live relational joins and may disappear/change after product deletion/editing. |
| BR-10: Favorites | Unique account/product pair; successful DB mutation updates state. Failed mutations do not toggle saved state but lack explicit error feedback. |
| BR-11: Reviews | Stars 1–5, user/product relation, pending by default. UI requires name/comment; API allows optional title/comment and uses its own length checks. No purchase-verification or one-review-per-product rule exists. |
| BR-12: Review images | Server enforces at most 3 and ≤2 MiB each; JPEG/PNG/WebP. UI processes the first three selected files and rejects individual oversized files. Public storefront review list does not render stored image thumbnails. |
| BR-13: Restock | Email ≤254 characters, trimmed/lowercased; pending duplicate key includes product + email + normalized size/color. Product ID check is a 36-character hex/hyphen pattern rather than full UUID validation. |
| BR-14: Notifications | Sent records are excluded from later ordinary batches. A new request after notification can be created. No stock reservation follows an email. Current notify API does not itself check positive inventory. |
| BR-15: Rate limits | Per client address per process: admin login 5/minute, restock 5/minute, checkout 10/minute, review POST 5/minute, review upload 8/minute; next request beyond limit returns 429. Direct storefront review insert does not pass through review POST rate limiting. |
| BR-16: Permissions | Database RLS governs customer-owned records; cookie-protected server endpoints use server role. Base review policy is broader than review migration; checkout security migration removes direct customer order writes. |

## 8. Data and persistence

| Entity / store | Business fields | Ownership / lifecycle | Requirements |
|---|---|---|---|
| auth.users | Login email, authentication identity, name metadata | Supabase customer authentication; signup trigger creates profile | AUTH-01–07 |
| profiles | Customer ID, full name, avatar URL, updated_at | Own customer row; admin reads latest 200; checkout can upsert name from address | USR-01, CHK-06 |
| products | ID, name, category, INR price, stock, description, image(s), sizes, colors, brand, tag, created_at, approved aggregates | Public read; intended admin writes; delete cascades related records | CAT, PDP, PRD, STK |
| product_size_stock | Product ID, size, integer stock | Public read; protected server stock write; unique product/size | PDP-03, STK, CHK-06 |
| favorites | User ID, product ID, created_at | Customer-specific; unique pair; removed on product/user deletion | FAV-01–03 |
| Browser els-cart | Product display snapshot, base price, chosen size/color, quantity | localStorage; shared across accounts using this browser; cleared on successful checkout | CART-01–06, CHK-08 |
| cart_items | User/product/quantity | Schema exists; current cart UI does not use it | CART-04 |
| orders | ID, customer ID, base total, status, shipping JSON, method, placed_at | Server transaction creation; own customer read; admin status changes | CHK, ORD, AOR |
| order_items | Order/product IDs, quantity, unit price, size, color | Transaction snapshot; product reference becomes null when product is removed | CHK-06, ORD-02–03 |
| reviews | User/product IDs, rating, optional title/comment/images, approval/moderation metadata | New review pending; public baseline read is unrestricted; admin moderation endpoints | REV-01–07 |
| restock_notifications | Product, normalized email, optional size/color, created/notified time, unsubscribe token | Server-only table; product cascade deletion; token deletes a specific alert | RST-01–05 |
| Product image storage | Public product photographs | product-images bucket; removing URL from form does not establish deletion of stored object | PRD-04 |
| Review image storage | Public image URLs under reviews/product/user/random-file | public bucket; upload endpoint may create bucket; deletion cleanup is not implemented | REV-02–03 |
| Admin browser state | HttpOnly admin_token; local admin_auth UI flag | Cookie expires in one hour; local flag is not authority | ADM-01–03 |

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
| Static media / Google fonts | Campaign visuals and Poppins/Playfair Display | Asset loading/build availability; no CMS integration. |

### API routes

| Method and path | Authority | Contract / test implication | Requirements |
|---|---|---|---|
| GET /api/storefront/region?fallback=INR or USD | Public | country/currency/rate/rateDate; no-store response | CUR-01–02 |
| POST /api/checkout | Customer bearer token | items + shippingAddress + paymentMethod → orderId/total or error | CHK-01–09 |
| POST /api/restock-notifications | Public; rate-limited | productId/email/size/color → 201 subscribed or 200 already_subscribed with emailConfigured | RST-01–03 |
| GET or POST /api/restock-notifications/unsubscribe?token=… | Capability token in query | Plain-text confirmation; malformed token 400; service failures 503 | RST-05 |
| POST /api/admin/login | Configured admin password; optional username | JSON or URL-encoded form; issues cookie; no browser customer identity required | ADM-01 |
| GET or POST /api/admin/logout | Cookie-clearing endpoint | Redirects to /admin/reviews and expires cookie | ADM-03 |
| GET /api/admin/orders | Signed admin cookie | All orders with nested lines/products | AOR-01 |
| PATCH /api/admin/orders | Signed admin cookie | id/status → persisted order; invalid status/id shape 400 | AOR-03–04 |
| GET /api/admin/users | Signed admin cookie | users[] with profile ID/name/avatar/update; cap 200 | USR-01 |
| PATCH /api/admin/stock | Signed admin cookie | productId/optional size/stock → status/aggregate stock; invalid integer/pattern 400 | STK-01–04 |
| POST /api/admin/restock-alerts/notify | Signed admin cookie | productId/optional size → queued or processed/sent/configured; no direct stock validation | RST-04 |
| GET /api/reviews?productId=…&approved=… | Public with anon DB client | Defaults approved-only; approved=false requests all accessible rows | REV-04 |
| POST /api/reviews | Customer bearer token | productId/rating/optional title/comment/images → pending review; current detail UI inserts directly instead | REV-01, REV-04 |
| POST /api/reviews/upload | Customer bearer token | Multipart images/productId → public paths[]; one to three validated images | REV-02 |
| GET /api/admin/reviews?status=… | Signed admin cookie | Default pending; other status strings return all rather than an approved-only filter | REV-05–06 |
| PUT /api/admin/reviews/{id} | Signed admin cookie | Approves and records time/admin identifier | REV-05 |
| DELETE /api/admin/reviews/{id} | x-dev-key equal to DEV_CREATE_USER_KEY or ADMIN_KEY | Deletes; auth model differs from cookie-based POST delete | REV-05, ADM-02 |
| POST /api/admin/reviews/approve/{id} | Signed admin cookie | Approves; server form returns JSON | REV-05–06 |
| POST /api/admin/reviews/delete/{id} | Signed admin cookie | Deletes; server form returns JSON | REV-05–06 |
| GET /api/health | Public | status/time; no DB check | OPS-01 |
| POST /api/test/reset | Nonproduction + x-test-api-secret | Attempts deletes/reseeds; do not assume full reset | OPS-02 |
| POST /api/test/seed-user | Nonproduction + x-test-api-secret | email/password/fullName or defaults → userId/created | OPS-03 |
| POST /api/dev/create-user | Nonproduction; x-dev-key if configured | Confirmed dev account; ten dev_auto limit | AUTH-07, OPS-04 |
| GET /api/schema | Public | Base schema text only | OPS-05 |

Protected admin APIs generally return 401 for missing/invalid/expired cookie, but exact service/error codes differ per route. Consult the specific route rather than assuming all failures return 503. Product CRUD/images and review replies currently use browser Supabase calls, not cookie-authenticated product/reply APIs.

## 10. Nonfunctional requirements

These are quality acceptance targets. They must be reviewed and implemented/verified where marked T/P; they are not claims of compliance or benchmark results.

| ID | Priority | State | Requirement and acceptance criteria | Source | QA focus |
|---|---|---|---|---|---|
| NFR-01 | P0 | P | Customer-owned data and admin actions shall enforce ownership/authority server-side or in RLS; public users shall not forge totals, moderation or another customer's records. Known policy/write gaps must be resolved or explicitly scoped as blockers. | SCHEMA, REVIEWMIG, CHECKOUTSEC, ADMINAPIS | Cross-user reads/writes, review approval tampering, fake admin flag |
| NFR-02 | P0 | C | Service-role, admin, mail and test secrets shall stay server-side; QA utilities shall remain blocked in production and admin cookie shall carry intended secure attributes. | ADMINAUTH, TESTAPI, DEVUSER, CHECKOUT | Client bundle/network/log secret exposure, production guards |
| NFR-03 | P1 | P | Failed services shall show actionable feedback, preserve recoverable user state and avoid false success/partial inventory writes; fallback browsing must be distinguishable from working commerce in acceptance evidence. | LIST, DETAIL, ADMIN, CHECKOUTUI, STOCKAPI | Offline/timeout/DB/upload/provider errors, retry |
| NFR-04 | P1 | T | Agree and verify responsive support at 375px mobile, 768px tablet and 1440px desktop, with no clipped essential controls; proposed browsers are current Chromium, Firefox and WebKit. | NAV, LIST, DETAIL, ADMIN | Touch/hover differences, drawers, tables, horizontal scroll |
| NFR-05 | P1 | T | Proposed accessibility target is WCAG 2.2 AA; assess keyboard operation, meaningful labels, focus placement/trapping/restoration, contrast, announcements and reduced motion. Existing labels are not proof of conformance. | NAV, DETAIL, HOME, LIST | Keyboard-only/screen-reader audits, modal focus, hidden controls |
| NFR-06 | P2 | T | Agree measurable performance targets and dataset/network conditions before benchmarking; evaluate initial rendering, campaign-media weight, large catalogs and admin full-dataset reads. No current SLA is supplied. | HOME, LIST, ADMIN, REGION | Representative load, slow network, long lists, image sizes |
| NFR-07 | P1 | P | User-facing claims shall match demo capability; analytics shall state its population, settings must not imply live health, and stock/email order safety shall hold under concurrent operations. | INFO, ADMIN, NOTIFY, DEMOMIG | Content, metric definitions, concurrency/replay |

## 11. Dependencies and environment readiness

| Prerequisite | Why it matters | Readiness evidence QA should record |
|---|---|---|
| Next/React application running | UI/API routing and shared providers | Tested URL, build/commit, browser and deployment mode |
| Valid public Supabase URL/anon key | Real authentication/catalog/customer reads | Configured versus local-fallback mode; never copy secret values into reports |
| Server Supabase service role | Checkout transaction, admin reads/stock/moderation, restock/upload/helpers | Server feature availability and negative missing-config tests |
| Admin credential | Signed admin cookie | Configured yes/no, optional username setting, expiry behavior |
| Base schema + current migrations | Required columns, RPC and permissions | Table/column/policy/function inventory and migration order applied |
| Product/review buckets and permissions | Upload/display functionality | product-images and public bucket policies; approved image host configuration |
| Auth configuration | Signup email confirmation and recovery | Password rules, verification requirement, redirect allowlist, email delivery mode |
| Mail settings and public site URL | Valid restock sender/product/unsubscribe links | RESEND_API_KEY/RESTOCK_FROM_EMAIL availability, NEXT_PUBLIC_SITE_URL, sandbox mail recipient strategy |
| Isolated QA database and secret | Repeatable test users and safely scoped setup | Nonproduction environment, TEST_API_SECRET availability, confirmed dataset cleanup |
| Deterministic fixtures | Coverage of category/options/stock/history/moderation | Product IDs resolved after seeding; exact fixture values recorded |

For a fresh test database, review/apply the base schema, review ownership migration, checkout profile fix where needed, checkout security migration, checkout transaction migration, and **demo catalog migration last** because it replaces `create_checkout_order` with the size/color-aware implementation. Do not apply the older transaction definition afterward: it would discard size-specific checkout handling. Some reply/extended product columns and admin catalog write permissions still require additional implementation; the supplied migrations do not resolve them.

`npm run seed:products` adds/skips catalog data by name; it is not a reset. The repository documents 280 demo additions (20 per existing database category), but total live count must be measured after seeding. `npm run seed:admin-data` supplies three sample orders and four approved reviews and changes stock; those are demo fixtures, not deterministic empty-state cleanup. Local Docker PostgreSQL is useful for schema/seed work but does not alone provide Supabase Auth/Storage/API/RLS session behavior.

Build prerequisites include current generated documentation and an explicit source review. After inspecting source and updating the BRD/QA guide, run `npm run docs:sync`, then `npm run docs:review -- --summary "Describe the inspected change" --requirements "affected IDs"`, and `npm run docs:check`. Use `--no-functional-change` only when the inspected change has no functional/documentation impact. Commit the CSV, requirements-history.json, requirements-source-snapshot.json and requirements-reviews.json with the relevant code/docs. `npm run docs:test` verifies tooling with isolated temporary fixtures; it does not validate live commerce, database policies or email delivery.

## 12. Known gaps and business decisions

These are source findings, not executed defect reproductions. Owners and resolution dates are unassigned. A known gap is not permission to mark the corresponding intended requirement passed. Link resulting defect IDs into the RTM after reproduction.

| Gap | Finding / implication | Requirements | Decision / next action |
|---|---|---|---|
| G-01 | Required confirm-password field is uncontrolled and never compared. | AUTH-02 | Enforce matching before signup. |
| G-02 | Reset email request exists, but no complete recovery/new-password UI is present; fallback client also lacks resetPasswordForEmail. | AUTH-05 | Define recovery flow and unavailable-service behavior. |
| G-03 | Review UI requires name but omits it in insert; name/admin_reply/replied_at and extended detail fields are not fully in supplied schema. Customer review image list is not rendered. | REV-01, REV-03, REV-07, PDP-06 | Align schema and supported review/product fields; decide public image display. |
| G-04 | Public detail fetch and RLS allow pending reviews; detail average includes them while database aggregates are approved-only. Customer review INSERT/UPDATE policies do not restrict moderation fields. | REV-04, NFR-01 | Decide pending-author visibility and enforce approved public publication; protect moderation fields. |
| G-05 | Sidebar review list is read-only; direct review URL is a separate pending queue; reply helpers have no visible controls; server approve/delete forms return JSON. | REV-06–07 | Select and complete one coherent admin review workflow. |
| G-06 | Catalog CRUD/product upload/reply helpers use public browser client; signed admin cookie grants no Supabase role and checked-in schema supplies no admin catalog writes. Save/delete/reply errors are not reliably surfaced. | ADM-02, PRD-02–06, REV-07 | Provide authenticated server writes or an explicit database admin identity with reviewed permissions. |
| G-07 | Size/color fetched in history/admin order API are not rendered; admin order detail omits shipping address and method. | ORD-03, AOR-03 | Decide operational order detail fields and display them. |
| G-08 | Checkout accepts missing size on a sized product and arbitrary color text; stock API accepts arbitrary size text. Routing helper does not enforce product category path. | CHK-09, PDP-01, STK-04 | Validate catalog options/category behavior; add target tests. |
| G-09 | Zero-stock size buttons are disabled and cannot be selected to subscribe for that size; missing size stock can be treated as unknown and permit add in detail. | PDP-03, RST-01 | Separate option selection for notification from purchasability; define missing-row behavior. |
| G-10 | One local cart key persists across sign-out/accounts; JSON parse is unguarded; initial read/write effects can race. No database cart sync or automatic replay after login. | CART-01, CART-04 | Decide intended guest/account cart policy and robust storage hydration. |
| G-11 | README fictional card-number approval/decline instructions are stale; current UI has no card fields or decline branch despite approval-or-decline wording. | CHK-04 | Align copy/docs to current simulation, or define new decline behavior separately. |
| G-12 | Notify is triggered on any positive stock save, not verified zero→positive transition. It checks no inventory itself; size-less request can send all sizes; batch limit/retry/concurrent deduplication can leave wrong/missed/duplicate alerts. | RST-04 | Define eligible recipients, scheduling, batching, failure/duplicate guarantees. |
| G-13 | Sidebar logout leaves admin cookie valid. | ADM-03 | Invoke cookie-clearing logout and verify protected API rejection afterward. |
| G-14 | Checkout has no idempotency key/replay protection; identical valid POST can create another order. | CHK-09 | Define retry semantics and duplicate-order prevention. |
| G-15 | Checkout network rejection can leave submitting state unresolved; search lacks explicit error state and blank-query result clearing; several admin failures resemble empty/success states. | SEA-03, CHK-08, NFR-03 | Add failure/retry/state-retention acceptance paths. |
| G-16 | Browser admin form sends password only; optional DEV_ADMIN_USERNAME is enforced by API. | ADM-01 | Leave optional username unset or add corresponding browser input. |
| G-17 | Product validation does not enforce finite/nonnegative price or nonnegative integer stock; base products table lacks these checks. | PRD-03 | Agree domain rules and validate both input and persisted data. |
| G-18 | Size edits do not synchronize stock rows; stock PATCH updates multiple records without transaction; aggregate includes stale rows. Product form overall stock can diverge from size stock. | PRD-05, STK-04 | Choose authoritative inventory and make related updates atomic. |
| G-19 | All status transitions allowed; cancellation has no stock restoration; analytics/top units include cancelled orders and review averages include pending records. | AOR-04, ANL-01–05 | Agree lifecycle, inventory reversal and metric definitions before commercial use. |
| G-20 | User View has no handler; profile management is read-only. | USR-02 | Remove/label control or implement separately. |
| G-21 | Settings summary says configured regardless of a live connection; no functioning settings/toggles. | SET-01 | Align label and scope. |
| G-22 | Product fallback shipping/return promises and confirmation delivery copy conflict with demo limitations; terms attribution/license wording differs from repository documentation. Countdown is unused and has no discount logic. | CNT-03–04 | Owner to approve consistent content; no commercial policy inferred. |
| G-23 | Reset performs unfiltered deletes without checking results; omits orders/order_items/auth users and local storage. Delete safety restrictions/foreign keys may prevent intended cleanup; reseed may duplicate data. | OPS-02 | Verify cleanup in isolated QA data; create complete deterministic fixtures before relying on helper. |
| G-24 | Rate limit is process-local; multi-instance limits differ. Direct review insert bypasses review POST rate limit; size/main product stock consistency depends on applied RPC version. | NFR-01, NFR-07, CHK-07 | Record deployment topology and applied function; decide distributed abuse/consistency requirements. |

Open owner decisions: which partial requirements block demo release; whether cart belongs to account or browser; whether only approved reviews are public; password policy/recovery design; order transition graph and cancellation stock rules; analytics population; notification eligibility; product photo/description quality; responsive/browser/accessibility/performance targets; sign-off roles. Until resolved, QA must preserve baseline observations separately from target acceptance.

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
| CHECKOUTUI | [Checkout page](../src/app/checkout/page.tsx) |
| CHECKOUT | [Checkout API](../src/app/api/checkout/route.ts), [rate limits](../src/lib/rateLimit.ts) |
| HISTORY | [Customer orders](../src/app/orders/page.tsx) |
| SCHEMA | [Base schema](../supabase_schema.sql) |
| REVIEWMIG | [Review migration](../supabase_reviews_migration.sql) |
| DEMOMIG | [Latest catalog/stock/options/restock/checkout migration](../supabase_demo_catalog_migration.sql) |
| CHECKOUTSEC | [Checkout security migration](../supabase_checkout_security_migration.sql), [profile fix](../supabase_checkout_profile_fix.sql) |
| REVIEWSAPI | [Reviews API](../src/app/api/reviews/route.ts) |
| REVIEWUPLOAD | [Review upload API](../src/app/api/reviews/upload/route.ts) |
| MODPAGE | [Server pending reviews page](../src/app/admin/reviews/page.tsx) |
| MODAPI | [Admin review list](../src/app/api/admin/reviews/route.ts), [approve/update](../src/app/api/admin/reviews/%5Bid%5D/route.ts), [form approve](../src/app/api/admin/reviews/approve/%5Bid%5D/route.ts), [form delete](../src/app/api/admin/reviews/delete/%5Bid%5D/route.ts) |
| RESTOCK | [Subscribe API](../src/app/api/restock-notifications/route.ts) |
| NOTIFY | [Notification API](../src/app/api/admin/restock-alerts/notify/route.ts) |
| UNSUB | [Unsubscribe API](../src/app/api/restock-notifications/unsubscribe/route.ts) |
| ADMIN | [Admin application](../src/components/AdminApp.tsx) |
| ADMINLOGIN | [Admin login page](../src/app/admin/page.tsx), [login API](../src/app/api/admin/login/route.ts) |
| ADMINAUTH | [Signed admin token](../src/lib/adminAuth.ts) |
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
| REQTOOLS | [Requirements synchronizer and review gate](../scripts/requirements.mjs), [regression tests](../scripts/requirements.test.mjs), [npm scripts](../package.json), [requirements workflow](../.github/workflows/requirements.yml) |

## 15. Glossary and sign-off

| Term | Meaning |
|---|---|
| BRD | Business Requirements Document: agreed scope, behavior, rules and acceptance basis |
| RTM | Requirements Traceability Matrix: requirement → test → result → defect mapping |
| Variant | Product + selected size + selected color; color does not have independent stock here |
| Snapshot | Saved unit price/options at ordering time rather than a later catalog value |
| RLS | Row Level Security: database rules limiting accessible/writable rows |
| RPC | Database function called by server; checkout function groups order and stock operations in one transaction |
| Pending review | Review awaiting approval; current public visibility differs from intended moderated publication |
| Demo order | Saved simulated order that may reduce demo stock, without actual payment or fulfillment |
| Local fallback | Read-only local catalog behavior when real Supabase configuration is unavailable |
| Acceptance criterion | An observable expected result used to decide whether a requirement is met |

| Review role | Name | Decision / exceptions | Date |
|---|---|---|---|
| Product/business owner | Unassigned | Pending scope and open-decision review | — |
| Development owner | Unassigned | Pending technical/schema baseline review | — |
| QA owner | Unassigned | Pending test coverage and executed evidence | — |

Change control: retain requirement IDs when wording changes; assign new IDs for new behavior; record version/date and impacted tests after any change to routes, roles, schema, business rules or acceptance criteria. Update the CSV from the changed rows and preserve execution history separately.
