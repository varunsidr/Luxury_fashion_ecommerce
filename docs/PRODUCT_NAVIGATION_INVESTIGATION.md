# Product-navigation investigation: 17 October 2026

The framework had a confirmed synchronization weakness: `openFirstProduct()` clicked a product without awaiting its destination, and `expectProductDetailLoaded()` accepted the collection's `main h1` as its heading check. The original deployed navigation stall's server/network/client-routing cause is still unestablished. The framework correction improves observation and readiness checks; it does not establish a website runtime fix.

## Retained failure evidence

The external framework retains the failing trace and page snapshot under `test-results/website-fixed-live-verification/ecommerce-product-detail-E-545ac-ntity-and-review-form-happy-ecommerce-chromium/`.

- The click resolved on Brown Twist Blouse. The selected destination was `/women/1e41389c-7408-4662-9a33-4bed6da6fa0e`.
- The generic heading assertion ran immediately afterward and accepted the still-visible Women collection. The add-to-cart visibility assertion then exhausted its existing 5,000 ms allowance.
- Two subsequent selected-product RSC requests have no completed response recorded (`status=-1`, unfinished timings). An earlier prefetch for the same product had completed with HTTP 200; that does not establish completion of the clicked navigation.
- The final snapshot remains the collection. No browser exception was found in the retained trace. The user reported three later standalone passes; those do not erase the failed attempt or identify its cause.

## Website source inspection

| Area | Observation | Interpretation limit |
| --- | --- | --- |
| [ProductCard](../src/components/ProductCard.tsx) | Image and name links use Next Link with the same category-derived destination and product ID. Prevent-default handlers belong to separate favorite controls. | No deterministic product-link interception defect was identified. |
| [ProductListing](../src/components/ProductListing.tsx) | Browser catalog reads populate card state after mounting. | Visible live cards establish that listing rendering ran after hydration; this does not prove every later routing operation succeeds. |
| [Women route](../src/app/kadin/[slug]/page.tsx) and [metadata](../src/lib/productMetadata.ts) | A non-category slug awaits the shared product lookup before supplying ProductDetailView. | A pending server result can keep the current screen visible; the trace does not expose backend execution. |
| [Product lookup](../src/lib/supabase.ts) | React cache shares a lookup during rendering. UUID lookup can try ID, slug and catalog-list reads sequentially, without an explicit deadline. | This is a latency risk, not proof the failed production request was waiting on Supabase. No production server/database timing was available. |
| Routing shell | No checked-in route loading.tsx/error.tsx boundary was found. | No explicit product-route loading feedback is supplied; changing that behavior was not justified as the fix for an unknown cause. |
| [ProductDetailView](../src/components/ProductDetailView.tsx) | The name and applicable detail controls render from the server-supplied product. Stock, reviews and related products are fetched afterward in an effect. | Those browser reads can delay ancillary content but do not gate the initial unsized product heading and controls. |

The existing category-path limitation G-08 and service-failure limitations remain open. Website runtime source is unchanged by this investigation.

## Framework correction and diagnostics

In the separate Playwright framework, `pages/ecommerce-storefront-page.ts` captures the chosen card's display name and its containing link's href before clicking. It awaits that exact URL with waitForURL using the existing test timeout budget. The readiness helper checks that URL, the selected product's exact level-one heading, add/favorite controls, quantity and review-submit control. The original test bodies' quantity, disabled guest review and guest-cart assertions remain unchanged. No fixed sleep, force click, timeout increase or added retry was introduced.

`fixtures/ecommerce-base.ts` and `utils/ecommerce-navigation-diagnostics.ts` passively collect main-frame URLs, request start/end/status/failure, pending document/RSC/script/API reads, page exceptions and console errors. Failure reports attach JSON automatically; ECOMMERCE_NAVIGATION_DIAGNOSTICS=1 also retains successful diagnostics. Buffers are bounded and URL query values omitted. Requests pending at test teardown and `net::ERR_ABORTED` during a successful route must be interpreted with final URL, controls, trace and timing; they are not automatically navigation failures.

## Execution evidence

The website candidate is the production build of source commit fe6b539, served with `npm run start -- --port 3200`. The public deployment was observed through its mutable origin; an immutable deployed SHA was not independently established.

| Run | Target / concurrency | Result |
| --- | --- | --- |
| Corrected affected tests, repeatEach=3 | Public deployment; three workers; retries=0 | 9 passed, zero skipped/flaky |
| Corrected affected tests | http://localhost:3200; three workers; retries=0 | 3 passed, zero skipped/flaky |
| Full public read-only browser suite | http://localhost:3200; three workers; retries=0 | 144 passed, zero skipped/flaky |
| Framework npm run check | Formatting, lint, TypeScript, static analysis, mappings and 38 script regressions | Passed |
| Website checks | Lint, TypeScript, production build | Passed; lint retains 28 existing warnings |

The nine deployed affected executions captured no page exceptions, console errors or recorded HTTP error statuses. Each reached the selected product and passed its original business assertions. RSC cancellations were captured in successful attempts, so those cancellations cannot alone explain the historical failure. The diagnostics do not prove that production cannot stall again.

Raw framework reports, each with per-test navigation-diagnostics attachments, are `test-results/product-navigation-deployed-corrected-results.json`, `test-results/product-navigation-local-targeted-results.json` and `test-results/product-navigation-local-public-results.json`. Targeted runs retain traces. Matching HTML reports are under `playwright-report/product-navigation-*`. Reports remain separate from older failures and monitoring history.

The first draft helper used an incorrectly scoped nested locator. Six executions timed out before a product click and the remaining repetition was interrupted. Per-test artifacts remain under `test-results/product-navigation-deployed/`; the interrupted run has no final JSON report. This was an implementation error corrected before the above validation, not reproduction of the original website symptom.

**21 October 2026 documentation review:** re-inspected the website route/lookup/rendering source and external framework helpers, and read the three retained JSON reports. Their saved totals are 9, 3 and 144 expected passes, with zero unexpected, skipped or flaky results and three workers/zero retries. The deployed report uses repeatEach=3 in one invocation; it does not establish three separate CI runs. These are historical executions from 17 October, not browser tests rerun during this documentation review.

## Follow-up evidence needed

Rerun production CI against the intended deployed revision using the corrected helper and retained diagnostics. For a future stall, correlate the selected product URL and timestamp with deployment request/stream logs and Supabase query timing. Distinguish a request waiting for server response, an unfinished stream, a client exception, and an aborted/replaced RSC read. Assign a website/server/network root cause only after that correlation; the five-second original assertion and later successful runs cannot establish it.
