# Website requirements and testing

Start with [BRD.md](BRD.md) for the complete customer/admin feature inventory, routes, user journeys, business rules, acceptance criteria, implementation gaps and source references.

The BRD maps 125 requirements across 20 modules and records 26 source-level gaps separately from implemented behavior.

- [QA_TESTING_GUIDE.md](QA_TESTING_GUIDE.md): fixture catalog, coverage checklist, test-case format, scenario seeds and a ready-to-use test-generation prompt.
- [REQUIREMENTS_TRACEABILITY.csv](REQUIREMENTS_TRACEABILITY.csv): spreadsheet-friendly requirement matrix with blank test/defect/owner fields and Not executed status.

Prepared from repository source on 2 October 2026; updated on 10 October for checkout replay/stock safeguards, sized fixtures, product metadata, visible counts, landmarks and demo copy. Historical finding IDs remain, including earlier G-01/G-13 fixes and the remaining portions of G-08/G-09/G-15/G-18/G-22. G-25 records the legacy security inspector's incompatibility with the current checkout migration. Implementation states are source observations, not passing test results. Payment and delivery are simulated.

The merge with the shopping-assistant branch retains both requirement sets, manual matrix fields and both audit histories. Assistant policies now match the demo shipping/returns limits; G-26 records remaining cached inventory/confirmation limits. Pre-merge test evidence remains historical; use the regenerated snapshot for the merged source.

For changes, inspect source and update the BRD/guide, run `npm run docs:sync`, record `npm run docs:review -- --summary "Describe the inspected change" --requirements "affected IDs"`, then run `npm run docs:test` and `npm run docs:check`. Use `--no-functional-change` only with an explanation when appropriate. Include the generated CSV, history, review log and source snapshot in the same change. Build and lint also run the documentation check; syncing alone does not approve changed source.

Run `npm run test:ui` then `npm run test:catalog` sequentially after installing Chromium. The second suite uses an intercepted .invalid fixture domain to check configured-client loading, timeout, fallback and retry; both disable live Supabase/mail integration and use an isolated compilation cache. CI retains both artifact directories. Passing these regressions is scoped evidence and does not complete the full website acceptance matrix.

`npm run test:assistant` runs fake-client tools/API and an intercepted widget case. Run sequentially with UI/catalog even if ASSISTANT_TEST_PORT changes the port; the compilation cache is shared. The assistant config is included in the source-review gate. These tests do not establish live model answers or successful confirmed cart additions.

`npm run test:purchase` executes ten SQL/fixture regressions in isolated in-memory PostgreSQL (PGlite). CI runs it before the browser suites. One connection cannot prove concurrent checkout/stock safety. Apply purchase safeguards after demo catalog and hardening in staging; the app requires its five-argument checkout RPC and stock RPC. The current read-only security inspector must be repaired before it can check that schema (G-25).

`npm run test:live` separately checks public browsing on the deployed Vercel site, with no local server, no saved authentication and blocked state-changing requests. PLAYWRIGHT_BASE_URL selects another accessible deployment origin. Results describe the deployed revision at execution time and stay separate from local fixtures; this optional smoke suite does not prove live customer/admin mutations or full acceptance.
