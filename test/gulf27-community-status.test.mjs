import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../supabase/functions/dawri-control/control.js',import.meta.url),'utf8').split('\n').find(s=>s.startsWith('window.loadCommunity='));
async function render(competition='GULF-27-2026',fail=false){
 const nodes={communityHint:{},communityContent:{}};
 const c={comp:competition,GULF:'GULF-27-2026',currentRound:{id:'round',predictions_revealed:false},fixtures:[{id:'final'}],el:id=>nodes[id],isLocked:()=>false,document:{querySelectorAll:()=>[]},esc:String,teamName:String,livePredictionPoints:()=>0,notify:()=>{},getGulfScores:async()=>[],db:{rpc:async()=>fail?{error:{message:'unavailable'}}:{data:[{user_id:'nasser',prediction_count:1},{user_id:'fahad',prediction_count:1},{user_id:'missing',prediction_count:0}]},from:table=>({select(){return this},in:async()=>({data:[{user_id:'fahad',fixture_id:'final',outcome:'home'}]}),eq:async()=>({data:[{id:'nasser',display_name:'ناصر'},{id:'fahad',display_name:'فهد'},{id:'missing',display_name:'لم يتوقع'}]})})}};
 c.window=c;vm.createContext(c);vm.runInContext(source,c);await c.loadCommunity();return nodes.communityContent.innerHTML;
}
test('player sees everyone’s submission status before reveal, without prediction details',async()=>{
 const html=await render();const cards=html.split('<div data-uid=');
 assert.match(cards.find(s=>s.startsWith('"nasser"')),/1\/1 توقعات/);
 assert.doesNotMatch(cards.find(s=>s.startsWith('"nasser"')),/incomplete/);
 assert.match(cards.find(s=>s.startsWith('"missing"')),/0\/1 توقعات.*⚠️/);
 assert.doesNotMatch(html,/community-details|التوقع:/);
});
test('status service failure shows an error instead of falsely marking everyone missing',async()=>{assert.equal(await render('GULF-27-2026',true),'تعذر تحميل التوقعات')});
test('Roshn community keeps its existing visible-row counts',async()=>{const html=await render('SPL-2026-2027');assert.match(html.split('<div data-uid=').find(s=>s.startsWith('"nasser"')),/0\/1 توقعات/)});
