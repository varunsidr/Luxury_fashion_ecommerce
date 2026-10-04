import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  GENERATED_COLUMNS, MANUAL_COLUMNS, changedSources, check, expandIds,
  formatCsv, mergeMatrix, parseBrd, parseCsv, review, sourceFingerprints, sync,
} from './requirements.mjs';

const columns = [...GENERATED_COLUMNS, ...MANUAL_COLUMNS];
const now = '2026-10-04T00:00:00.000Z';
const requirement = (id = 'OPS-01', acceptance = 'Keep evidence.') => ({
  requirement_id: id, module: 'Operations', priority: 'P1', implementation_state: 'I',
  requirement_and_acceptance: acceptance, source_codes: 'TOOLS', qa_focus: 'Regression', known_gap_ids: '',
});
const manual = {
  test_case_ids: 'TC-OPS-001-01', execution_status: 'Passed', defect_ids: 'BUG-12',
  owner: 'QA owner', notes: 'Previous execution, with "quotes"\nand a newline.', custom_evidence: 'build-123',
};
const brd = (acceptance = 'Keep evidence.') => `# Requirements
Contains 1 requirements across 1 modules.
### 6.1 Operations
| ID | Priority | State | Requirement and acceptance criteria | Source | QA focus |
|---|---|---|---|---|---|
| OPS-01 | P1 | I | ${acceptance} | TOOLS | Regression |
## 14. Source index
| TOOLS | [Source](../src/page.ts) |
`;

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'zeouf-requirements-'));
  // Only remove the exact temporary directory created by this fixture.
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'docs'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'src/page.ts'), 'export const value = 1;\n');
  writeFileSync(join(root, 'docs/BRD.md'), brd());
  writeFileSync(join(root, 'docs/QA_TESTING_GUIDE.md'), 'Cover OPS-01.\n');
  writeFileSync(join(root, 'docs/README.md'), 'Contains 1 requirements across 1 modules.\n');
  return root;
}

test('CSV round-trip preserves multiline manual evidence and additional columns', () => {
  const row = { ...requirement(), ...manual };
  assert.deepEqual(parseCsv('\uFEFF' + formatCsv([row], [...columns, 'custom_evidence']).replace(/\n/g, '\r\n')),
    { columns: [...columns, 'custom_evidence'], rows: [row] });
  assert.throws(() => parseCsv(formatCsv([row, row])), /Duplicate CSV requirement ID/);
  assert.throws(() => parseCsv(formatCsv([row]) + '"'), /Unclosed CSV quote/);
});

test('synchronization preserves manual results when requirements are unchanged', () => {
  const former = { ...requirement(), ...manual };
  const merged = mergeMatrix([requirement()], { columns: [...columns, 'custom_evidence'], rows: [former] }, { now });
  assert.deepEqual(merged.rows, [former]);
  assert.deepEqual(merged.history, []);
});

test('changed and retired requirements archive original evidence and mark executed results for retest', () => {
  const former = { ...requirement(), ...manual };
  const retired = { ...requirement('OPS-02'), ...manual };
  const merged = mergeMatrix([requirement('OPS-01', 'Changed acceptance.')],
    { columns: [...columns, 'custom_evidence'], rows: [former, retired] }, { now });
  assert.equal(merged.rows[0].execution_status, 'Needs retest');
  for (const key of [...MANUAL_COLUMNS.filter((key) => key !== 'execution_status'), 'custom_evidence']) {
    assert.equal(merged.rows[0][key], former[key]);
  }
  assert.deepEqual(merged.history.map((entry) => [entry.reason, entry.row]),
    [['requirement_changed', former], ['requirement_retired', retired]]);
});

test('source review marks affected executed results for retest without claiming a pass', () => {
  const former = { ...requirement(), ...manual };
  const merged = mergeMatrix([requirement(), requirement('OPS-02')],
    { columns, rows: [former] }, { now, impacted: ['OPS-01'] });
  assert.equal(merged.rows[0].execution_status, 'Needs retest');
  assert.equal(merged.rows[1].execution_status, 'Not executed');
  assert.equal(merged.history[0].reason, 'source_change_review');
  assert.equal(merged.history[0].row.execution_status, 'Passed');
});

test('requirement ranges expand and invalid references are rejected', () => {
  assert.deepEqual(expandIds('OPS-01–03, CHK-05-CHK-07, G-01, J-01'),
    ['OPS-01', 'OPS-02', 'OPS-03', 'CHK-05', 'CHK-06', 'CHK-07']);
  assert.throws(() => expandIds('OPS-03–01'), /descending range/);
  assert.throws(() => expandIds('OPS-01–CHK-03'), /mixed-prefix range/);
  assert.throws(() => parseBrd(brd() + '\nSee OPS-99.\n'), /unknown requirement/);
  assert.throws(() => parseBrd(brd().replace('| TOOLS | Regression |', '| MISSING | Regression |')), /unknown source code/);
});

test('check requires synchronized files and an explicit source review', (t) => {
  const root = fixture(t);
  assert.throws(() => check(root), /files are stale/);
  sync(root);
  assert.throws(() => check(root), /No reviewed source snapshot/);
  review(root, { summary: 'Inspect initial operations baseline.', impacted: ['OPS-01'], now });
  assert.equal(check(root).rows.length, 1);
  assert.equal(parseCsv(readFileSync(join(root, 'docs/REQUIREMENTS_TRACEABILITY.csv'), 'utf8')).rows[0].execution_status, 'Not executed');
});

test('source drift and mismatched review evidence fail the build gate', (t) => {
  const root = fixture(t);
  review(root, { summary: 'Inspect baseline.', impacted: ['OPS-01'], now });
  writeFileSync(join(root, 'src/page.ts'), 'export const value = 2;\n');
  assert.throws(() => check(root), /Website source changed/);
  // Regenerating the matrix must not silently approve changed source.
  sync(root);
  assert.throws(() => check(root), /Website source changed/);
  review(root, { summary: 'Inspect changed source.', impacted: ['OPS-01'], now: '2026-10-04T00:01:00.000Z' });
  assert.equal(check(root).rows.length, 1);
  writeFileSync(join(root, 'docs/requirements-reviews.json'), '[]\n');
  assert.throws(() => check(root), /does not match/);
});

test('review validates assertions before writing and retired IDs cannot be reused', (t) => {
  const root = fixture(t);
  const original = readFileSync(join(root, 'docs/BRD.md'), 'utf8');
  assert.throws(() => review(root, { impacted: ['OPS-01'], now }), /requires --summary/);
  assert.throws(() => review(root, { summary: 'Both modes.', impacted: ['OPS-01'], noFunctionalChange: true, now }), /not both/);
  assert.throws(() => review(root, { summary: 'Unknown ID.', impacted: ['OPS-99'], now }), /Unknown reviewed requirement/);
  assert.equal(readFileSync(join(root, 'docs/BRD.md'), 'utf8'), original);
  writeFileSync(join(root, 'docs/requirements-history.json'), JSON.stringify([
    { reason: 'requirement_retired', row: { requirement_id: 'OPS-01' } },
  ]));
  assert.throws(() => sync(root), /Retired requirement ID cannot be reused/);
});

test('QA references and documentation links must resolve', (t) => {
  const root = fixture(t);
  writeFileSync(join(root, 'docs/QA_TESTING_GUIDE.md'), 'Cover OPS-99.\n');
  assert.throws(() => sync(root), /QA guide references unknown requirement/);
  writeFileSync(join(root, 'docs/QA_TESTING_GUIDE.md'), 'Cover OPS-01. [Missing](missing.md)\n');
  assert.throws(() => sync(root), /links to missing file/);
});

test('fingerprints normalize line endings, track deletions, and exclude secrets and build output', (t) => {
  const root = fixture(t);
  const before = sourceFingerprints(root);
  writeFileSync(join(root, 'src/page.ts'), 'export const value = 1;\r\n');
  writeFileSync(join(root, '.env.local'), 'PRIVATE_KEY=fixture-only\n');
  mkdirSync(join(root, '.next'));
  writeFileSync(join(root, '.next/generated.js'), 'generated\n');
  assert.deepEqual(sourceFingerprints(root), before);
  rmSync(join(root, 'src/page.ts'));
  assert.deepEqual(changedSources(sourceFingerprints(root), before), ['src/page.ts']);
});

test('sync is idempotent and archives manual evidence only once after a requirement edit', (t) => {
  const root = fixture(t);
  writeFileSync(join(root, 'docs/REQUIREMENTS_TRACEABILITY.csv'),
    formatCsv([{ ...requirement(), ...manual }], [...columns, 'custom_evidence']));
  writeFileSync(join(root, 'docs/BRD.md'), brd('Changed acceptance.'));
  sync(root, { now });
  const matrix = readFileSync(join(root, 'docs/REQUIREMENTS_TRACEABILITY.csv'), 'utf8');
  const history = readFileSync(join(root, 'docs/requirements-history.json'), 'utf8');
  sync(root, { now: '2026-10-04T00:01:00.000Z' });
  assert.equal(readFileSync(join(root, 'docs/REQUIREMENTS_TRACEABILITY.csv'), 'utf8'), matrix);
  assert.equal(readFileSync(join(root, 'docs/requirements-history.json'), 'utf8'), history);
  assert.equal(JSON.parse(history).length, 1);
  assert.equal(parseCsv(matrix).rows[0].execution_status, 'Needs retest');
});

test('generated counts remove complete bold markers and remain stable on the next sync', (t) => {
  const root = fixture(t);
  writeFileSync(join(root, 'docs/BRD.md'), brd().replace('Contains 1 requirements across 1 modules.',
    'The catalogue contains **99 requirements across 88 modules**.'));
  sync(root, { now });
  const updated = readFileSync(join(root, 'docs/BRD.md'), 'utf8');
  assert.ok(updated.includes('The catalogue contains 1 requirements across 1 modules.'));
  assert.ok(!updated.includes('**'));
  sync(root, { now });
  assert.equal(readFileSync(join(root, 'docs/BRD.md'), 'utf8'), updated);
});

test('browser configuration, regression tests and CI workflows are included in source review', (t) => {
  const root = fixture(t);
  mkdirSync(join(root, 'tests'));
  mkdirSync(join(root, '.github/workflows'), { recursive: true });
  writeFileSync(join(root, 'playwright.config.ts'), 'export default {};\n');
  writeFileSync(join(root, 'playwright.catalog.config.ts'), 'export default {};\n');
  writeFileSync(join(root, 'playwright.live.config.ts'), 'export default {};\n');
  writeFileSync(join(root, 'tests/cart.spec.ts'), '// fixture\n');
  writeFileSync(join(root, '.github/workflows/storefront.yml'), 'name: fixture\n');
  const inputs = sourceFingerprints(root);
  for (const path of ['playwright.config.ts', 'playwright.catalog.config.ts', 'playwright.live.config.ts', 'tests/cart.spec.ts', '.github/workflows/storefront.yml']) {
    assert.ok(inputs[path], `${path} must require review when changed`);
  }
});
