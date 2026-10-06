const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const migrationPath = path.join(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '20261006130000_optimize_application_reads.sql'
);

test('adds covering indexes for transaction and audit relationships', () => {
  assert.equal(fs.existsSync(migrationPath), true);
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert.match(sql, /audit_logs_transaction_id_idx/i);
  assert.match(sql, /transactions_created_by_idx/i);
  assert.match(sql, /transactions_updated_by_idx/i);
});

test('evaluates authorization helpers once per statement and removes duplicate update policy', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert.match(sql, /\(select public\.is_active_user\(\)\)/i);
  assert.match(sql, /drop policy if exists tx_admin_update/i);
});
