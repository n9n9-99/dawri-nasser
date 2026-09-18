const test = require('node:test');
const assert = require('node:assert/strict');

let calendar = {};
try {
  calendar = require('../hijri-calendar.js');
} catch (_) {
  // The first TDD run intentionally reaches this branch: the feature does not exist yet.
}

test('buildMonth returns the Umm al-Qura days for Rabi al-Thani 1448', () => {
  assert.equal(typeof calendar.buildMonth, 'function');
  const month = calendar.buildMonth(1448, 4);
  assert.equal(month.year, 1448);
  assert.equal(month.month, 4);
  assert.equal(month.monthName, 'ربيع الآخر');
  assert.equal(month.days.length, 30);
  assert.equal(month.days[0].hijri, '1448/04/01');
  assert.equal(month.days[0].gregorian, '2026-09-12');
  assert.equal(month.days[0].weekday, 6);
  assert.equal(month.days[29].hijri, '1448/04/30');
  assert.equal(month.days[29].gregorian, '2026-10-11');
});

test('shiftMonth crosses the Hijri year boundary', () => {
  assert.deepEqual(calendar.shiftMonth(1448, 12, 1), { year: 1449, month: 1 });
  assert.deepEqual(calendar.shiftMonth(1448, 1, -1), { year: 1447, month: 12 });
});

test('normalizeHijri accepts only a real Umm al-Qura date', () => {
  assert.equal(calendar.normalizeHijri('1448/04/08'), '1448/04/08');
  assert.equal(calendar.normalizeHijri('1448/04/31'), null);
  assert.equal(calendar.normalizeHijri('١٤٤٨/٠٤/٠٨'), null);
});
