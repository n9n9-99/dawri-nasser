const test = require('node:test');
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const path = require('node:path');

let sharing = {};
try {
  sharing = require('../report-sharing.js');
} catch (_) {
  // The first TDD run intentionally reaches this branch.
}

test('builds a stable dated PDF filename', () => {
  assert.equal(typeof sharing.buildFilename, 'function');
  assert.equal(
    sharing.buildFilename(new Date('2026-09-20T12:00:00Z')),
    'legal-open-transactions-2026-09-20.pdf'
  );
});

test('shares a PDF file when file sharing is supported', async () => {
  assert.equal(typeof sharing.shareOrDownload, 'function');
  const calls = [];
  const result = await sharing.shareOrDownload({
    file: { name: 'report.pdf' },
    navigatorRef: { canShare: () => true, share: async value => calls.push(value) },
    documentRef: {},
    urlRef: {}
  });
  assert.equal(result, 'shared');
  assert.equal(calls[0].files[0].name, 'report.pdf');
});

test('downloads when file sharing is unavailable', async () => {
  const clicks = [];
  const result = await sharing.shareOrDownload({
    file: { name: 'report.pdf' },
    navigatorRef: { canShare: () => false },
    documentRef: {
      createElement: () => ({ click: () => clicks.push(true), remove() {} }),
      body: { appendChild() {} }
    },
    urlRef: { createObjectURL: () => 'blob:test', revokeObjectURL() {} }
  });
  assert.equal(result, 'downloaded');
  assert.equal(clicks.length, 1);
});

test('treats closing the native share sheet as cancellation', async () => {
  const cancelled = new Error('cancelled');
  cancelled.name = 'AbortError';
  const result = await sharing.shareOrDownload({
    file: { name: 'report.pdf' },
    navigatorRef: { canShare: () => true, share: async () => { throw cancelled; } },
    documentRef: {},
    urlRef: {}
  });
  assert.equal(result, 'cancelled');
});

test('index exposes the admin report sharing controls', async () => {
  const html = await readFile(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /id="shareReportBtn"[^>]*data-admin-only/);
  assert.match(html, /مشاركة التقرير/);
  assert.match(html, /report-sharing\.js/);
  assert.match(html, /functions\/v1\/manual-report/);
  assert.match(html, /LegalReportShare\.shareOrDownload/);
});
