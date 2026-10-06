const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('loads the Supabase browser client from the application origin', () => {
  assert.match(html, /<script src="\/vendor\/supabase\.min\.js"><\/script>/);
  assert.doesNotMatch(html, /cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js/);
  assert.equal(fs.existsSync(path.join(root, 'vendor', 'supabase.min.js')), true);
});

test('shows a recoverable startup error instead of leaving an unusable login form', () => {
  assert.match(html, /id="startupError"/);
  assert.match(html, /id="retryStartupBtn"/);
  assert.match(html, /withTimeout\(/);
  assert.match(html, /showStartupError\(/);
});

test('prevents concurrent full reloads', () => {
  assert.match(html, /loadAllPromise=null/);
  assert.match(html, /if\(loadAllPromise\)return loadAllPromise/);
});
