# Website requirements and testing

Start with [BRD.md](BRD.md) for the complete customer/admin feature inventory, routes, user journeys, business rules, acceptance criteria, implementation gaps and source references.

The BRD maps 112 requirements across 19 modules and records 24 source-level gaps separately from implemented behavior.

- [QA_TESTING_GUIDE.md](QA_TESTING_GUIDE.md): fixture catalog, coverage checklist, test-case format, scenario seeds and a ready-to-use test-generation prompt.
- [REQUIREMENTS_TRACEABILITY.csv](REQUIREMENTS_TRACEABILITY.csv): spreadsheet-friendly requirement matrix with blank test/defect/owner fields and Not executed status.

Prepared from repository source on 2 October 2026; documentation tooling coverage and the recorded source baseline were updated on 4 October 2026. Implementation states are source observations, not passing test results. This website is a portfolio demo; payment and delivery are simulated.

For changes, inspect source and update the BRD/guide, run `npm run docs:sync`, record `npm run docs:review -- --summary "Describe the inspected change" --requirements "affected IDs"`, then run `npm run docs:test` and `npm run docs:check`. Use `--no-functional-change` only with an explanation when appropriate. Include the generated CSV, history, review log and source snapshot in the same change. Build and lint also run the documentation check; syncing alone does not approve changed source.
