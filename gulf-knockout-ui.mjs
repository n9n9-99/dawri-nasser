import {finalCard,finalStyles,countdownParts} from './gulf-final-card.mjs?v=51';
import {METHODS,validateKnockout} from './gulf-knockout-rules.mjs?v=51';
const GULF='GULF-27-2026',active=()=>localStorage.getItem('dawri_competition')===GULF;
const knockout=()=>active()&&[4,5].includes(currentRound?.round_number);
const locked=()=>!currentRound?.predictions_close_at||Date.now()>=Date.parse(currentRound.predictions_close_at);
const oldRender=window.renderFixtures,oldSave=window.savePredictions,oldRanking=window.loadRanking,oldCommunity=window.loadCommunity,oldCalculate=window.calculateRoundScores;
let results=new Map();
const style=document.createElement('style');style.textContent='.ko-methods{display:flex;gap:6px;margin:10px 0;flex-wrap:wrap}.ko-methods button{flex:1;border-radius:999px;font-size:12px;min-height:44px}.ko-note{font-size:12px;color:#aabbb0;line-height:1.7;margin:10px 0}.ko-methods .active{background:#3a3217;border-color:#d7b868}.ko-admin{margin-top:12px;border-top:1px solid #304739;padding-top:12px}';style.textContent+=finalStyles;document.head.appendChild(style);
function options(v){return '<option value="">—</option>'+Array.from({length:21},(_,n)=>`<option value="${n}" ${v===n?'selected':''}>${n}</option>`).join('')}
function methodButtons(p,f,L){return Object.entries(METHODS).map(([v,t])=>`<button type="button" ${L?'disabled':''} class="choice ${p?.finish_method===v?'active':''}" onclick="pickGulfFinish('${f.id}','${v}',this)" aria-pressed="${p?.finish_method===v}">${t}</button>`).join('')}
window.pickGulfFinish=(id,value,b)=>{if(!knockout()||locked())return;const p=myPredictions.get(id)||{fixture_id:id,user_id:me.id};p.finish_method=value;myPredictions.set(id,p);b.parentElement.querySelectorAll('button').forEach(n=>{n.classList.toggle('active',n===b);n.setAttribute('aria-pressed',String(n===b))})};
window.renderFixtures=function(L){
 if(!knockout())return oldRender.apply(this,arguments);
 if(currentRound.round_number===5){el('fixturesList').innerHTML=fixtures.map(f=>finalCard({f,p:myPredictions.get(f.id),L,esc,teamName,options,methodButtons})).join('');tickFinal();return;}
 const disabled=L?'disabled':'';
 el('fixturesList').innerHTML=fixtures.map(f=>{const p=myPredictions.get(f.id);return `<div class="card" data-fixture-id="${f.id}"><div class="match"><div class="team"><div class="badge">${esc(shortName(f.home_team_id))}</div><b>${esc(teamName(f.home_team_id))}</b></div><div class="vs">VS</div><div class="team"><div class="badge">${esc(shortName(f.away_team_id))}</div><b>${esc(teamName(f.away_team_id))}</b></div></div><div class="mini gulf-kickoff">${esc(new Date(f.kickoff_at).toLocaleString('ar-SA-u-ca-gregory-nu-latn',{timeZone:'Asia/Riyadh',day:'numeric',month:'long',hour:'numeric',minute:'2-digit'}))} — بتوقيت السعودية</div><div class="bonus gulf-exact-bonus">⭐ بونص النتيجة الدقيقة — نقطتان إضافيتان + نقطة للتوقع الصحيح</div><div class="choices" style="grid-template-columns:1fr 1fr"><button ${disabled} class="choice ${p?.outcome==='home'?'active':''}" onclick="pickOutcome('${f.id}','home',this)">فوز ${esc(teamName(f.home_team_id))}</button><button ${disabled} class="choice ${p?.outcome==='away'?'active':''}" onclick="pickOutcome('${f.id}','away',this)">فوز ${esc(teamName(f.away_team_id))}</button></div><div class="score-row"><select ${disabled} id="hs_${f.id}">${options(p?.predicted_home_score)}</select><label>النتيجة الدقيقة</label><select ${disabled} id="as_${f.id}">${options(p?.predicted_away_score)}</select></div><div class="ko-note">نتيجة اللعب بعد الوقت الإضافي إن وُجد، دون أهداف الترجيح. نقطتان للنتيجة الدقيقة + نقطة للفائز.</div><b class="mini">طريقة حسم المباراة — نقطة إضافية مستقلة</b><div class="ko-methods">${methodButtons(p,f,L)}</div></div>`}).join('')+(L?'':'<button class="primary" onclick="savePredictions()">حفظ توقعات الجولة</button>');
};
window.savePredictions=async function(){
 if(!knockout())return oldSave.apply(this,arguments);
 if(locked())return notify('التوقعات مغلقة حاليًا');
 const rows=[];
 for(const f of fixtures){const p=myPredictions.get(f.id);if(!p?.outcome&&!p?.finish_method)continue;const h=el('hs_'+f.id)?.value??'',a=el('as_'+f.id)?.value??'';const row={fixture_id:f.id,user_id:me.id,outcome:p?.outcome,finish_method:p?.finish_method,predicted_home_score:h===''?null:Number(h),predicted_away_score:a===''?null:Number(a)};const error=validateKnockout(row);if(error)return notify(teamName(f.home_team_id)+' × '+teamName(f.away_team_id)+': '+error);rows.push(row)}
 if(!rows.length)return notify('اختر توقعًا واحدًا على الأقل');
 if(rows.filter(p=>p.predicted_home_score!=null).length>2)return notify('الحد المسموح نتيجتان دقيقتان فقط في هذه الجولة');
 const {error}=await db.from('predictions').upsert(rows,{onConflict:'fixture_id,user_id'});
 if(error)return notify('تعذر الحفظ: '+error.message);
 rows.forEach(p=>myPredictions.set(p.fixture_id,p));notify('تم حفظ الفائز والنتيجة وطريقة الحسم');
};
async function readResults(ids){if(!ids.length)return new Map();const {data,error}=await db.from('gulf_knockout_results').select('*').in('fixture_id',ids);if(error)throw error;return new Map((data||[]).map(r=>[r.fixture_id,r]))}
window.loadCommunity=async function(){
 await oldCommunity.apply(this,arguments);if(!active())return;
 try{const ids=fixtures.map(f=>f.id);const [{data:pr,error},rr,scored]=await Promise.all([db.from('predictions').select('*').in('fixture_id',ids),readResults(ids),window.getGulfScores()]);if(error)throw error;if(!active())return;results=rr;const scoreMap=new Map(scored.map(p=>[p.prediction_id,p]));
 document.querySelectorAll('#communityContent .community-player').forEach(c=>{const arr=(pr||[]).filter(p=>p.user_id===c.dataset.uid).sort((a,b)=>Date.parse(fixtures.find(f=>f.id===a.fixture_id)?.kickoff_at)-Date.parse(fixtures.find(f=>f.id===b.fixture_id)?.kickoff_at));const pts=c.querySelector('.community-points');if(pts)pts.textContent=arr.reduce((n,p)=>n+(scoreMap.get(p.id)?.total_points||0),0)+' نقطة';c.querySelectorAll('.community-pick').forEach((pick,i)=>{const p=arr[i];if(!p)return;const method=document.createElement('div');method.className='community-exact';const points=scoreMap.get(p.id);method.textContent=(p.finish_method?'طريقة الحسم: '+METHODS[p.finish_method]+' • ':'')+'الفائز '+(points?.outcome_points||0)+' + النتيجة '+(points?.exact_score_points||0)+' + الحسم '+(points?.bonus_points||0)+' = '+(points?.total_points||0)+' نقطة';pick.appendChild(method)})});
 }catch(e){console.error('Gulf community',e)}
};
window.calculateRoundScores=async function(){if(!active())return oldCalculate.apply(this,arguments);await loadRanking();await loadCommunity();notify('النقاط موحّدة وتُحتسب تلقائيًا من النتائج المعتمدة');};
// Admin fallback when the score provider does not identify extra time / penalties.
async function adminResults(){
 if(!knockout()||me?.role!=='admin'){document.getElementById('gulfResultAdmin')?.classList.add('hidden');return;}
 let box=el('gulfResultAdmin');if(!box){box=document.createElement('div');box.id='gulfResultAdmin';document.querySelector('#admin .section')?.appendChild(box)}
 box.classList.remove('hidden');
 const done=fixtures.filter(f=>f.status==='finished');box.innerHTML='<div class="title"><h2>اعتماد نتائج خروج المغلوب</h2></div>'+done.map(f=>{const r=results.get(f.id);return `<div class="card ko-admin"><b>${esc(teamName(f.home_team_id))} × ${esc(teamName(f.away_team_id))}</b><div class="field"><label>الفائز النهائي</label><select id="kw_${f.id}"><option value="home" ${r?.winner==='home'?'selected':''}>${esc(teamName(f.home_team_id))}</option><option value="away" ${r?.winner==='away'?'selected':''}>${esc(teamName(f.away_team_id))}</option></select></div><div class="field"><label>طريقة الحسم</label><select id="km_${f.id}">${Object.entries(METHODS).map(([k,v])=>`<option value="${k}" ${r?.finish_method===k?'selected':''}>${v}</option>`).join('')}</select></div><div class="score-row"><input type="number" min="0" id="kh_${f.id}" value="${r?.home_score??f.home_score??''}"><label>نتيجة اللعب دون الترجيح</label><input type="number" min="0" id="ka_${f.id}" value="${r?.away_score??f.away_score??''}"></div><button class="primary" onclick="approveGulfResult('${f.id}')">اعتماد النتيجة واحتساب النقاط</button></div>`}).join('')||'<div class="card mini">يظهر اعتماد النتيجة بعد انتهاء المباراة.</div>';
}
window.approveGulfResult=async id=>{if(me?.role!=='admin'||!knockout())return;const hs=el('kh_'+id).value,as=el('ka_'+id).value;if(hs===''||as==='')return notify('أدخل نتيجة الفريقين');const r={fixture_id:id,winner:el('kw_'+id).value,finish_method:el('km_'+id).value,home_score:Number(hs),away_score:Number(as),source:'admin'};const error=validateKnockout({outcome:r.winner,finish_method:r.finish_method,predicted_home_score:r.home_score,predicted_away_score:r.away_score});if(error)return notify(error);const q=await db.from('gulf_knockout_results').upsert(r,{onConflict:'fixture_id'});if(q.error)return notify('تعذر اعتماد النتيجة: '+q.error.message);results.set(id,r);notify('تم اعتماد النتيجة واحتساب النقاط');await loadRanking();await loadCommunity()};
const oldShow=window.showScreen;window.showScreen=function(id,b){const r=oldShow.apply(this,arguments);if(id==='admin')adminResults();return r};
if(knockout()&&me){renderFixtures(locked());loadRanking()}

function tickFinal(){if(!knockout()||currentRound.round_number!==5)return;document.querySelectorAll('[data-final-kickoff]').forEach(box=>{const parts=countdownParts(box.dataset.finalKickoff);box.querySelectorAll('[data-final-part]').forEach((n,i)=>{if(n.textContent!==parts[i])n.textContent=parts[i]})})}
setInterval(tickFinal,1000);
