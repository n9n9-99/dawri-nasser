import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const path=new URL('../gulf-completion.mjs',import.meta.url);
test('completed Gulf final replaces prediction form and takes totals from all scored predictions',async()=>{
 assert.ok(readFileSync(path,'utf8').length);
 const {standings,completionMarkup}=await import(path);
 const rows=standings([{id:'a',display_name:'ابو فايز'},{id:'b',display_name:'ناصر'},{id:'c',display_name:'صالح'}],[{user_id:'a',total_points:12},{user_id:'a',total_points:4},{user_id:'b',total_points:11},{user_id:'c',total_points:14}]);
 assert.deepEqual(rows.map(r=>[r.name,r.points]),[['ابو فايز',16],['صالح',14],['ناصر',11]]);
 const html=completionMarkup({home_score:2,away_score:0},rows,x=>x);
 assert.match(html,/ألف مبروك أبو فايز — بطل توقعات خليجي 27/);
 assert.match(html,/16/);assert.doesNotMatch(html,/onclick|select|حفظ توقع|data-final-kickoff/);
 const other=completionMarkup({home_score:2,away_score:0},standings([{id:'b',display_name:'ناصر'},{id:'a',display_name:'ابو فايز'}],[{user_id:'b',total_points:20},{user_id:'a',total_points:16}]),x=>x);
 assert.match(other,/ألف مبروك ناصر/);assert.doesNotMatch(other,/ألف مبروك أبو فايز/);
});
