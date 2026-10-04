import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, watch, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const GENERATED_COLUMNS = [
  'requirement_id', 'module', 'priority', 'implementation_state',
  'requirement_and_acceptance', 'source_codes', 'qa_focus', 'known_gap_ids',
];
export const MANUAL_COLUMNS = [
  'test_case_ids', 'execution_status', 'defect_ids', 'owner', 'notes',
];
const DEFAULT_COLUMNS = [...GENERATED_COLUMNS, ...MANUAL_COLUMNS];
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MATRIX = 'docs/REQUIREMENTS_TRACEABILITY.csv';
const HISTORY = 'docs/requirements-history.json';
const SNAPSHOT = 'docs/requirements-source-snapshot.json';
const REVIEWS = 'docs/requirements-reviews.json';
const normalize = (text) => text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
const read = (root, path) => normalize(readFileSync(join(root, path), 'utf8'));
const hash = (text) => createHash('sha256').update(normalize(text)).digest('hex');
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

function writeChanged(root, path, text) {
  if (existsSync(join(root, path)) && read(root, path) === text) return false;
  writeFileSync(join(root, path), text, 'utf8');
  return true;
}

export function parseCsv(text) {
  const records = [];
  let row = [], field = '', quoted = false, closed = false;
  const input = normalize(text);
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else field += char;
    } else if (char === '"') {
      if (field || closed) throw new Error('Invalid quote in CSV field.');
      quoted = true;
    } else if (char === ',' || char === '\n') {
      row.push(field); field = ''; closed = false;
      if (char === '\n') {
        if (row.some((value) => value !== '')) records.push(row);
        row = [];
      }
    } else {
      if (closed) throw new Error('Unexpected text after closing CSV quote.');
      field += char;
    }
  }
  if (quoted) throw new Error('Unclosed CSV quote.');
  if (field || closed || row.length) { row.push(field); records.push(row); }
  if (!records.length) return { columns: [...DEFAULT_COLUMNS], rows: [] };
  const [columns, ...values] = records;
  if (new Set(columns).size !== columns.length) throw new Error('Duplicate CSV columns.');
  for (const column of DEFAULT_COLUMNS) {
    if (!columns.includes(column)) throw new Error(`Missing CSV column: ${column}`);
  }
  const rows = values.map((values, index) => {
    if (values.length !== columns.length) throw new Error(`CSV row ${index + 2} has the wrong number of fields.`);
    return Object.fromEntries(columns.map((column, i) => [column, values[i]]));
  });
  uniqueIds(rows, 'CSV');
  return { columns, rows };
}

export function formatCsv(rows, columns = DEFAULT_COLUMNS) {
  const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [columns, ...rows.map((row) => columns.map((column) => row[column] ?? ''))]
    .map((row) => row.map(quote).join(',')).join('\n') + '\n';
}

function uniqueIds(rows, label) {
  const seen = new Set();
  for (const row of rows) {
    if (!/^[A-Z]+-\d{2}$/.test(row.requirement_id)) throw new Error(`Invalid ${label} requirement ID: ${row.requirement_id}`);
    if (seen.has(row.requirement_id)) throw new Error(`Duplicate ${label} requirement ID: ${row.requirement_id}`);
    seen.add(row.requirement_id);
  }
}

function cells(line) {
  return line.split(/(?<!\\)\|/).slice(1, -1).map((value) => value.trim().replace(/\\\|/g, '|'));
}

export function expandIds(text) {
  const ids = [];
  for (const match of text.matchAll(/\b([A-Z]+)-(\d{2})(?!\d)(?:[–-](?:([A-Z]+)-)?(\d{2})(?!\d))?/g)) {
    const [, prefix, first, endPrefix, last] = match;
    if (['G', 'BO', 'J', 'BR'].includes(prefix)) continue;
    if (endPrefix && endPrefix !== prefix) throw new Error(`Invalid mixed-prefix range: ${match[0]}`);
    const start = Number(first), end = Number(last ?? first);
    if (end < start) throw new Error(`Invalid descending range: ${match[0]}`);
    for (let i = start; i <= end; i++) ids.push(`${prefix}-${String(i).padStart(2, '0')}`);
  }
  return ids;
}

export function parseBrd(text) {
  const rows = [], gaps = new Map(), sources = new Set();
  let module = '';
  const input = normalize(text);
  for (const line of input.split('\n')) {
    const heading = line.match(/^### 6\.\d+ (.+)$/);
    if (heading) module = heading[1];
    if (/^## 10\./.test(line)) module = 'Nonfunctional requirements';
    if (/^\|\s*[A-Z]+-\d{2}\s*\|\s*P[012]\s*\|/.test(line)) {
      const values = cells(line);
      if (values.length !== 6 || !/^[ICDPT]$/.test(values[2]) || !module) {
        throw new Error(`Invalid requirement row: ${line}`);
      }
      rows.push({ requirement_id: values[0], module, priority: values[1], implementation_state: values[2],
        requirement_and_acceptance: values[3], source_codes: values[4], qa_focus: values[5], known_gap_ids: '' });
    }
    const gap = line.match(/^\|\s*(G-\d{2})\s*\|/);
    if (gap) {
      if (gaps.has(gap[1])) throw new Error(`Duplicate gap ID: ${gap[1]}`);
      gaps.set(gap[1], expandIds(cells(line)[2] ?? ''));
    }
    const source = line.match(/^\|\s*([A-Z]+)\s*\|\s*\[/);
    if (source) sources.add(source[1]);
  }
  if (!rows.length) throw new Error('No requirement rows found in BRD.');
  uniqueIds(rows, 'BRD');
  const ids = new Set(rows.map((row) => row.requirement_id));
  for (const id of expandIds(input)) {
    if (!ids.has(id)) throw new Error(`BRD references unknown requirement: ${id}`);
  }
  for (const row of rows) {
    for (const code of row.source_codes.split(/,\s*/)) {
      if (!sources.has(code)) throw new Error(`${row.requirement_id} uses unknown source code: ${code}`);
    }
    row.known_gap_ids = [...gaps].filter(([, references]) => references.includes(row.requirement_id))
      .map(([gap]) => gap).join('; ');
    for (const match of `${row.requirement_and_acceptance} ${row.qa_focus}`.matchAll(/\bG-\d{2}\b/g)) {
      if (!gaps.has(match[0])) throw new Error(`${row.requirement_id} references unknown gap: ${match[0]}`);
    }
  }
  return { rows, gaps, modules: new Set(rows.map((row) => row.module)).size };
}

export function mergeMatrix(requirements, previous, { now = new Date().toISOString(), impacted = [] } = {}) {
  const old = new Map(previous.rows.map((row) => [row.requirement_id, row]));
  const columns = [...DEFAULT_COLUMNS, ...previous.columns.filter((column) => !DEFAULT_COLUMNS.includes(column))];
  const history = [];
  const affected = new Set(impacted);
  const rows = requirements.map((requirement) => {
    const former = old.get(requirement.requirement_id);
    const row = Object.fromEntries(columns.map((column) => [column, former?.[column] ?? '']));
    Object.assign(row, requirement);
    if (!former) row.execution_status = 'Not executed';
    else {
      const changed = GENERATED_COLUMNS.filter((column) => former[column] !== requirement[column]);
      if (changed.length || affected.has(row.requirement_id)) {
        const reason = changed.length ? 'requirement_changed' : 'source_change_review';
        history.push({ archived_at: now, reason, changed_fields: changed, row: former });
        if (!['', 'Not executed', 'Needs retest'].includes(former.execution_status)) row.execution_status = 'Needs retest';
      }
    }
    old.delete(requirement.requirement_id);
    return row;
  });
  for (const row of old.values()) history.push({ archived_at: now, reason: 'requirement_retired', changed_fields: [], row });
  return { rows, columns, history };
}

function loadJson(root, path, fallback) {
  return existsSync(join(root, path)) ? JSON.parse(read(root, path)) : fallback;
}

function validateLinks(root, path, input) {
  for (const match of input.matchAll(/\]\(([^)]+)\)/g)) {
    const target = match[1];
    if (target.startsWith('#') || /^https?:/.test(target)) continue;
    const resolved = resolve(root, dirname(path), decodeURIComponent(target.split('#')[0]));
    if (!existsSync(resolved)) throw new Error(`${path} links to missing file: ${target}`);
  }
}

function summaryText(input, model) {
  return input.replace(/(maps|contains) (?:\*\*)?\d+(?:\*\*)? requirements across (?:\*\*)?\d+(?:\*\*)? modules(?:\*\*)?/g,
    (_, verb) => `${verb} ${model.rows.length} requirements across ${model.modules} modules`)
    .replace(/\*\*\d+ source-level gap findings\*\*/g, `**${model.gaps.size} source-level gap findings**`)
    .replace(/records \d+ source-level gaps/g, `records ${model.gaps.size} source-level gaps`)
    .replace(/with \*\*\d+ source-level gap findings\*\*/g, `with **${model.gaps.size} source-level gap findings**`);
}

export function planSync(root, { impacted = [], now } = {}) {
  const brd = read(root, 'docs/BRD.md');
  const model = parseBrd(brd);
  const guide = read(root, 'docs/QA_TESTING_GUIDE.md');
  const known = new Set(model.rows.map((row) => row.requirement_id));
  for (const id of expandIds(guide)) {
    if (!known.has(id)) throw new Error(`QA guide references unknown requirement: ${id}`);
  }
  for (const id of impacted) if (!known.has(id)) throw new Error(`Unknown reviewed requirement: ${id}`);
  const history = loadJson(root, HISTORY, []);
  const retired = new Set(history.filter((entry) => entry.reason === 'requirement_retired').map((entry) => entry.row.requirement_id));
  for (const id of known) if (retired.has(id)) throw new Error(`Retired requirement ID cannot be reused: ${id}`);
  const previous = existsSync(join(root, MATRIX)) ? parseCsv(read(root, MATRIX)) : { columns: DEFAULT_COLUMNS, rows: [] };
  const merged = mergeMatrix(model.rows, previous, { now, impacted });
  const outputs = new Map([
    [MATRIX, formatCsv(merged.rows, merged.columns)],
    [HISTORY, json([...history, ...merged.history])],
    ['docs/BRD.md', summaryText(brd, model)],
    ['docs/README.md', summaryText(read(root, 'docs/README.md'), model)],
  ]);
  for (const path of ['docs/BRD.md', 'docs/QA_TESTING_GUIDE.md', 'docs/README.md']) {
    validateLinks(root, path, outputs.get(path) ?? read(root, path));
  }
  return { outputs, model, merged };
}

export function sync(root, options = {}) {
  const plan = planSync(root, options);
  for (const [path, text] of plan.outputs) writeChanged(root, path, text);
  return plan;
}

// Code/config/schema inputs only. No local secrets, node_modules, build output or binaries.
export function sourceFingerprints(root) {
  const files = [];
  const extension = /\.(?:ts|tsx|js|jsx|mjs|css|json|sql|toml|yml|yaml)$/;
  const walk = (dir) => {
    if (!existsSync(join(root, dir))) return;
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && extension.test(path) && !/^scripts\/requirements(?:\.test)?\.mjs$/.test(path)) files.push(path);
    }
  };
  for (const dir of ['src', 'scripts', 'supabase', 'tests', '.github/workflows']) walk(dir);
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isFile() && (/\.sql$/.test(entry.name) || [
      'package.json', 'package-lock.json', 'next.config.ts', 'middleware.ts', 'tsconfig.json', 'playwright.config.ts',
      'postcss.config.mjs', 'migrate-products.js', 'upload-images.js',
      '.env.example', 'docker-compose.yml', 'README.md', 'architecture.md', 'SECURITY.md',
    ].includes(entry.name))) files.push(entry.name);
  }
  return Object.fromEntries(files.sort().map((path) => [path, hash(read(root, path))]));
}

export function changedSources(current, previous = {}) {
  return [...new Set([...Object.keys(current), ...Object.keys(previous)])].sort()
    .filter((path) => current[path] !== previous[path]);
}

export function check(root) {
  const { outputs, model } = planSync(root);
  const stale = [...outputs].filter(([path, text]) => !existsSync(join(root, path)) || read(root, path) !== text).map(([path]) => path);
  if (stale.length) throw new Error(`Derived requirements files are stale: ${stale.join(', ')}. Run npm run docs:sync.`);
  const snapshot = loadJson(root, SNAPSHOT, null);
  if (!snapshot || snapshot.version !== 1) throw new Error('No reviewed source snapshot. Review the BRD/guide, then run npm run docs:review with a summary.');
  const changed = changedSources(sourceFingerprints(root), snapshot.files);
  if (changed.length) throw new Error(`Website source changed since documentation review:\n${changed.map((path) => `  ${path}`).join('\n')}\nUpdate BRD/QA coverage, run docs:sync, then docs:review with affected IDs (or explain no functional change).`);
  const reviews = loadJson(root, REVIEWS, []);
  const last = reviews.at(-1);
  if (!last || last.reviewed_at !== snapshot.reviewed_at || last.source_digest !== hash(json(snapshot.files))) {
    throw new Error('Source snapshot does not match the last recorded documentation review.');
  }
  return model;
}

export function review(root, { summary, impacted = [], noFunctionalChange = false, now = new Date().toISOString() }) {
  if (!summary?.trim()) throw new Error('Review requires --summary describing the inspected change.');
  if (Boolean(impacted.length) === Boolean(noFunctionalChange)) {
    throw new Error('Review requires either --requirements ID,ID or --no-functional-change, not both.');
  }
  // Validate everything before writes, including IDs and source snapshot readability.
  const files = sourceFingerprints(root);
  const previous = loadJson(root, SNAPSHOT, null);
  const reviews = loadJson(root, REVIEWS, []);
  const plan = planSync(root, { impacted, now });
  const entry = { reviewed_at: now, summary: summary.trim(), requirement_ids: impacted,
    no_functional_change: noFunctionalChange, changed_sources: changedSources(files, previous?.files),
    source_digest: hash(json(files)), evidence: 'Documentation/source review; not test execution' };
  for (const [path, text] of plan.outputs) writeChanged(root, path, text);
  writeChanged(root, REVIEWS, json([...reviews, entry]));
  writeChanged(root, SNAPSHOT, json({ version: 1, reviewed_at: now, files }));
  return plan;
}

function parseOptions(args) {
  const options = { impacted: [], noFunctionalChange: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--summary' && args[i + 1]) options.summary = args[++i];
    else if (args[i] === '--requirements' && args[i + 1]) options.impacted = [...new Set(args[++i].split(',').map((id) => id.trim()).filter(Boolean))];
    else if (args[i] === '--no-functional-change') options.noFunctionalChange = true;
    else throw new Error(`Unknown or incomplete option: ${args[i]}`);
  }
  return options;
}

function watchDocs(root) {
  let timer, lastMessage;
  const update = () => {
    try {
      sync(root);
      const model = check(root);
      report(`Docs synchronized: ${model.rows.length} requirements. Source review is current.`);
    } catch (error) { report(error.message); }
  };
  const report = (message) => {
    if (message !== lastMessage) { console.log(message); lastMessage = message; }
  };
  const schedule = () => { clearTimeout(timer); timer = setTimeout(update, 300); };
  const watchers = [watch(root, { recursive: false }, schedule)];
  for (const dir of ['docs', 'src', 'scripts', 'supabase', 'tests', '.github/workflows']) {
    if (existsSync(join(root, dir))) watchers.push(watch(join(root, dir), { recursive: true }, schedule));
  }
  const stop = () => { clearTimeout(timer); for (const watcher of watchers) watcher.close(); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  console.log('Watching BRD/QA/source changes. CSV updates automatically; source review stays explicit. Ctrl+C to stop.');
  update();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [command, ...args] = process.argv.slice(2);
    if (command === 'sync') {
      if (args.length) throw new Error('sync accepts no options.');
      console.log(`Synchronized ${sync(ROOT).model.rows.length} requirements; manual test fields preserved.`);
    } else if (command === 'check') {
      if (args.length) throw new Error('check accepts no options.');
      console.log(`Documentation check passed: ${check(ROOT).rows.length} requirements; source review is current.`);
    } else if (command === 'review') {
      console.log(`Recorded documentation review for ${review(ROOT, parseOptions(args)).model.rows.length} requirements. No tests were marked Passed.`);
    } else if (command === 'watch') {
      if (args.length) throw new Error('watch accepts no options.');
      watchDocs(ROOT);
    } else throw new Error('Usage: requirements.mjs sync | check | review --summary TEXT (--requirements ID,ID | --no-functional-change) | watch');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
