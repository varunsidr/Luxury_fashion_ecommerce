import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const target = new URL(process.env.AUDIT_BASE_URL || 'https://zeouf-luxury-fashion-ecommerce.vercel.app');
if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password || target.pathname !== '/' || target.search || target.hash) throw new Error('AUDIT_BASE_URL must be an HTTP(S) origin without credentials, path or query.');
const paths = (process.env.AUDIT_PATHS || '/,/women,/bags,/privacy,/terms').split(',');
if (paths.some(path => !path.startsWith('/') || path.startsWith('//'))) throw new Error('Audit paths must be relative to the selected origin.');
const report = { target: target.origin, capturedAt: new Date().toISOString(), scope: 'Fresh unauthenticated Chromium contexts; read-only; reduced motion; unthrottled lab observations, not field Core Web Vitals or WCAG acceptance.', pages: [] };
const browser = await chromium.launch();
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
    for (const path of paths) {
      const context = await browser.newContext({ viewport, reducedMotion: 'reduce', serviceWorkers: 'block' });
      const attemptedWrites = [];
      await context.route('**/*', route => {
        const request = route.request();
        if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method()) || /\/api\/(test|dev)\/|\/api\/admin\/logout/.test(new URL(request.url()).pathname)) {
          attemptedWrites.push({ method: request.method(), path: new URL(request.url()).pathname });
          return route.abort();
        }
        return route.continue();
      });
      const page = await context.newPage();
      await page.addInitScript(() => {
        window.__audit = { lcp: null, cls: 0 };
        new PerformanceObserver(list => { for (const entry of list.getEntries()) window.__audit.lcp = entry.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__audit.cls += entry.value; }).observe({ type: 'layout-shift', buffered: true });
      });
      let result;
      try {
        const response = await page.goto(new URL(path, target.origin).href, { waitUntil: 'load', timeout: 45_000 });
        await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => {});
        await page.evaluate(() => document.fonts.ready);
        const observations = await page.evaluate(() => {
          const navigation = performance.getEntriesByType('navigation')[0];
          return {
            viewport: innerWidth, documentWidth: document.documentElement.scrollWidth,
            ...window.__audit,
            ttfb: navigation?.responseStart ?? null,
            loadEventEnd: navigation?.loadEventEnd ?? null,
            resourceTransferBytes: performance.getEntriesByType('resource').reduce((sum, entry) => sum + (entry.transferSize || 0), 0),
            undersizedVisibleImages: [...document.images].filter(image => image.width > 100 && image.naturalWidth > 0 && image.naturalWidth < image.width).map(image => ({ source: new URL(image.currentSrc || image.src).pathname, naturalWidth: image.naturalWidth, displayWidth: image.width })).slice(0, 30),
          };
        });
        const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
        result = { path, viewport, status: response?.status(), observations, violations: scan.violations.map(({ id, impact, description, helpUrl, nodes }) => ({ id, impact, description, helpUrl, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) })), incompleteRules: scan.incomplete.map(rule => rule.id), attemptedWrites };
      } catch (error) { result = { path, viewport, error: String(error), attemptedWrites }; }
      report.pages.push(result);
      console.log(`${viewport.width}px ${path}: ${result.error || `${result.status}, ${result.violations.length} axe rules flagged, LCP ${Math.round(result.observations.lcp || 0)}ms`}`);
      await context.close();
    }
  }
} finally { await browser.close(); }
await mkdir('test-results/quality', { recursive: true });
await writeFile('test-results/quality/storefront-audit.json', JSON.stringify(report, null, 2) + '\n');
console.log('Report: test-results/quality/storefront-audit.json. Investigate findings; collection alone is not a passing accessibility/performance test.');
if (process.argv.includes('--strict') && report.pages.some(page => page.error || page.status !== 200 || page.attemptedWrites.length || page.observations.documentWidth > page.observations.viewport + 1 || page.violations.length)) process.exitCode = 1;
