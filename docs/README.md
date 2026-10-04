# Website requirements and testing

Start with [BRD.md](BRD.md) for the complete customer/admin feature inventory, routes, user journeys, business rules, acceptance criteria, implementation gaps and source references.

The BRD maps 114 requirements across 19 modules and records 24 source-level gaps separately from implemented behavior.

- [QA_TESTING_GUIDE.md](QA_TESTING_GUIDE.md): fixture catalog, coverage checklist, test-case format, scenario seeds and a ready-to-use test-generation prompt.
- [REQUIREMENTS_TRACEABILITY.csv](REQUIREMENTS_TRACEABILITY.csv): spreadsheet-friendly requirement matrix with blank test/defect/owner fields and Not executed status.

Prepared from repository source on 2 October 2026; storefront polish, registration/logout/cart recovery and regression coverage were updated on 4 October 2026. The 24 finding IDs remain in the BRD, including resolved G-01/G-13 and partially unresolved G-10. Implementation states are source observations, not passing test results. This website is a portfolio demo; payment and delivery are simulated.

For changes, inspect source and update the BRD/guide, run `npm run docs:sync`, record `npm run docs:review -- --summary "Describe the inspected change" --requirements "affected IDs"`, then run `npm run docs:test` and `npm run docs:check`. Use `--no-functional-change` only with an explanation when appropriate. Include the generated CSV, history, review log and source snapshot in the same change. Build and lint also run the documentation check; syncing alone does not approve changed source.

Run `npm run test:ui` then `npm run test:catalog` sequentially after installing Chromium. The second suite uses an intercepted .invalid fixture domain to check configured-client loading, timeout, fallback and retry; both disable live Supabase/mail integration and use an isolated compilation cache. CI retains both artifact directories. Passing these regressions is scoped evidence and does not complete the full website acceptance matrix.

`npm run test:live` separately checks public browsing on the deployed Vercel site, with no local server, no saved authentication and blocked state-changing requests. PLAYWRIGHT_BASE_URL selects another accessible deployment origin. Results describe the deployed revision at execution time and stay separate from local fixtures; this optional smoke suite does not prove live customer/admin mutations or full acceptance.
