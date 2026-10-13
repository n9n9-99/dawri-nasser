const test=require('node:test');const assert=require('node:assert/strict');
let reports={};try{reports=require('../activity-reports.js')}catch{}
test('Saudi inclusive date range crosses UTC day correctly',()=>{assert.deepEqual(reports.periodBounds('2026-10-01','2026-10-31'),{start:'2026-09-30T21:00:00.000Z',end:'2026-10-31T21:00:00.000Z'});assert.throws(()=>reports.periodBounds('2026-10-31','2026-10-01'));});
test('ranks real edits, excludes no-op saves and keeps unassigned movements separate',()=>{
const people=[{id:'a',username:'a',full_name:'أ'},{id:'b',username:'b',full_name:'ب'}];
const logs=[{user_id:'a',action:'insert',transaction_id:'1'}, {user_id:'a',action:'update',transaction_id:'1',old_data:{status:'انتظار',updated_at:'1'},new_data:{status:'منتهية',updated_at:'2'}},{user_id:'a',action:'update',transaction_id:'1',old_data:{status:'منتهية',updated_at:'2'},new_data:{status:'منتهية',updated_at:'3'}},{user_id:'b',action:'insert',transaction_id:'2'},{user_id:null,action:'update',transaction_id:'3'}];
const r=reports.summarize(people,logs);assert.equal(r.rows[0].username,'a');assert.equal(r.rows[0].inserted,1);assert.equal(r.rows[0].edits,1);assert.equal(r.rows[0].editedTransactions,1);assert.equal(r.rows[0].ignoredSaves,1);assert.equal(r.rows[0].total,2);assert.equal(r.unassigned,1);assert.equal(r.movements.length,3);
});
test('report escapes names and shows all tied leaders',()=>{const r=reports.summarize([{id:'a',username:'a',full_name:'<script>'},{id:'b',username:'b',full_name:'ب'}],[{user_id:'a',action:'insert'},{user_id:'b',action:'insert'}]);const h=reports.render(r,'2026-10-01','2026-10-31');assert.equal(r.leaders.length,2);assert.ok(h.includes('&lt;script&gt;'));assert.ok(!h.includes('<script>'));assert.ok(h.includes('من 2026-10-01 إلى 2026-10-31'));});
