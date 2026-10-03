# Keeping website requirements current

Whenever a change affects website behavior, routes, permissions, validation,
inventory, persistence, integrations, customer/admin copy, or configuration:

1. Review the changed behavior against `docs/BRD.md`. Update affected requirement
   rows, acceptance criteria, routes, business rules, source references, and gaps.
   Keep existing IDs stable; use new IDs for new functionality. Do not label a
   source observation as a passing test or silently remove an unresolved gap.
2. Update `docs/QA_TESTING_GUIDE.md` for affected fixtures, scenarios and limits.
3. Run `npm run docs:sync`. Never regenerate the CSV by discarding its manual
   test IDs, defects, owners, notes or execution history.
4. Record the review with:
   `npm run docs:review -- --summary "Describe the behavior/documentation change" --requirements "CHK-05,CHK-07"`
   Use the actual affected requirement IDs, not these example IDs. If a reviewed
   change has no functional/documentation impact, use `--no-functional-change`
   instead and explain why in the summary. Do not record review without inspecting
   the change. New routes/features must be documented before recording review.
5. Run `npm run docs:check` and the checks appropriate to the application change.
   Include documentation updates, review snapshot/log and generated sheet in the
   same change as the website code.

Generated matrix changes preserve manual fields. Changed/retired requirements
are archived in `docs/requirements-history.json`; affected executed results are
marked `Needs retest`. Do not reuse retired IDs. Archived evidence is historical,
not proof of the current build. `docs:sync` cannot determine feature semantics or
approve source changes; `docs:review` is an explicit reviewer assertion.

For documentation-only changes, update the BRD/guide as appropriate, regenerate
the matrix, record a descriptive review, and check the result. No user permission
is required for routine documentation maintenance within the authorized work.
