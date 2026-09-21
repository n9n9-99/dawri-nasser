import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const controlScript = await readFile(
  new URL('../supabase/functions/dawri-control/control.js', import.meta.url),
  'utf8',
);

test('published control bundle identifies the activated Gulf 27 release', () => {
  assert.match(controlScript, /window\.DAWRI_REMOTE_VERSION='42\.0\.0'/);
  assert.match(controlScript, /window\.DAWRI_GULF27_ACTIVE=true/);
});

test('Gulf 27 opening time is derived as 48 hours before the selected round', () => {
  const functionSource = controlScript.match(/function gulfOpenAt\(r\)\{[^}]+\}/)?.[0];
  assert.ok(functionSource, 'gulfOpenAt(round) must exist');

  const gulfOpenAt = Function(`return (${functionSource.replace('function gulfOpenAt', 'function')})`)();
  const firstMatchAt = '2026-10-02T18:00:00.000Z';
  const actual = gulfOpenAt({ first_match_at: firstMatchAt });
  const expected = new Date(firstMatchAt).getTime() - 48 * 60 * 60 * 1000;
  assert.equal(actual, expected);
});

test('Roshn pause presentation never hides Gulf 27 fixtures', () => {
  assert.match(controlScript, /const active=comp===RSL&&Date\.now\(\)<RSL_RETURN_AT/);
});

test('exact scores must agree with the selected outcome', () => {
  const match = controlScript.match(/function exactOutcomeError\(outcome,h,a\)\{[^}]+\}/);
  assert.ok(match, 'exactOutcomeError must exist');
  const exactOutcomeError = Function(`return (${match[0]})`)();

  assert.equal(exactOutcomeError('home', '', ''), '');
  assert.notEqual(exactOutcomeError('home', '2', '2'), '');
  assert.equal(exactOutcomeError('home', '2', '1'), '');
  assert.notEqual(exactOutcomeError('away', '2', '1'), '');
  assert.equal(exactOutcomeError('away', '1', '2'), '');
  assert.notEqual(exactOutcomeError('draw', '2', '1'), '');
  assert.equal(exactOutcomeError('draw', '2', '2'), '');
});

test('community list shows every approved player and reveals details at lock', () => {
  assert.match(controlScript, /const revealed=!!currentRound\.predictions_revealed\|\|isLocked\(currentRound\)/);
  assert.match(controlScript, /Object\.fromEntries\(\(ps\|\|\[\]\)\.map\(p=>\[p\.id,\[\]\]\)\)/);
  assert.match(controlScript, /arr\.length<total\?'⚠️':''/);
  assert.match(controlScript, /if\(document\.getElementById\('community'\)\?\.classList\.contains\('active'\)\)loadCommunity\(\)/);
});
