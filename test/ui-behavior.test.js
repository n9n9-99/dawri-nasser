const test = require('node:test');
const assert = require('node:assert/strict');

let ui = {};
try {
  ui = require('../ui-behavior.js');
} catch (_) {
  // The first TDD run intentionally reaches this branch.
}

function classList(initial = []) {
  const values = new Set(initial);
  return {
    add: value => values.add(value),
    remove: value => values.delete(value),
    toggle(value, force) {
      if (force === true) values.add(value);
      else if (force === false) values.delete(value);
      else if (values.has(value)) values.delete(value);
      else values.add(value);
    },
    contains: value => values.has(value)
  };
}

function documentFixture() {
  const modals = {
    transaction: { classList: classList(['modal']) },
    calendar: { classList: classList(['modal']) }
  };
  return {
    body: { classList: classList() },
    getElementById: id => modals[id],
    querySelector: selector => selector === '.modal.open'
      ? Object.values(modals).find(modal => modal.classList.contains('open')) || null
      : null
  };
}

test('body remains locked until the final modal closes', () => {
  assert.equal(typeof ui.setModalOpen, 'function');
  const document = documentFixture();

  ui.setModalOpen(document, 'transaction', true);
  ui.setModalOpen(document, 'calendar', true);
  ui.setModalOpen(document, 'calendar', false);
  assert.equal(document.body.classList.contains('modal-open'), true);

  ui.setModalOpen(document, 'transaction', false);
  assert.equal(document.body.classList.contains('modal-open'), false);
});

test('view changes reset scroll immediately without smooth animation', () => {
  assert.equal(typeof ui.resetViewport, 'function');
  let received = null;
  ui.resetViewport({ scrollTo: options => { received = options; } });
  assert.deepEqual(received, { top: 0, left: 0, behavior: 'auto' });
});

test('historical transaction references preserve their official format', () => {
  assert.equal(typeof ui.isTransactionNumber, 'function');

  assert.equal(ui.isTransactionNumber('4800014642'), true);
  assert.equal(ui.isTransactionNumber('4800152971/1'), true);
  assert.equal(ui.isTransactionNumber('س/2/4800744070'), true);

  assert.equal(ui.isTransactionNumber('٤٨٠٠٠١٤٦٤٢'), false);
  assert.equal(ui.isTransactionNumber('A/4800014642'), false);
  assert.equal(ui.isTransactionNumber('س//4800744070'), false);
  assert.equal(ui.isTransactionNumber(''), false);
});
