const GULF='GULF-27-2026';
export function standings(profiles,scores){
 const rows=profiles.map(p=>({id:p.id,name:p.display_name||'لاعب',points:0}));
 const users=new Map(rows.map(p=>[p.id,p]));
 for(const p of scores){const user=users.get(p.user_id);if(user)user.points+=Number(p.total_points)||0}
 rows.sort((a,b)=>b.points-a.points||a.name.localeCompare(b.name,'ar'));
 rows.forEach((r,i)=>r.rank=i&&r.points===rows[i-1].points?rows[i-1].rank:i+1);return rows;
}
export function completionMarkup(f,rows,esc){
 const first=rows[0],winnerName=first&&/^(أ|ا)بو فايز$/.test(first.name.trim())?'أبو فايز':first?.name;
 return '<article class="gulf-finale-hero" aria-label="السعودية بطل خليجي 27"><div class="gulf-sparks" aria-hidden="true">✦ ✧ ✦ ✧ ✦</div><div class="gulf-finale-kicker">كأس الخليج العربي • ليلة التتويج</div><div class="gulf-finale-cup" aria-hidden="true">🏆</div><h1>🇸🇦 السعودية</h1><h2>بطل خليجي 27</h2><div class="gulf-finale-score">السعودية <b dir="ltr">'+f.home_score+' – '+f.away_score+'</b> الإمارات</div><p>النهائي • انتهت</p><small>الحسم في الوقت الأصلي</small></article><section class="gulf-final-standings" aria-label="الترتيب النهائي لمسابقة التوقعات"><h2>الترتيب النهائي للتوقعات</h2>'+(first?'<article class="gulf-prediction-champion"><span class="gulf-winner-label">🥇 بطل التوقعات</span><div class="gulf-winner-name"><span>🏆</span><h3>'+esc(winnerName)+'</h3></div><strong class="gulf-winner-points">'+first.points+' <small>نقطة</small></strong><p>ألف مبروك '+esc(winnerName)+' — بطل توقعات خليجي 27</p><span class="gulf-sparks" aria-hidden="true">✦ ✧ ✦</span></article>':'')+rows.slice(1).map(r=>'<div class="gulf-final-row"><span class="gulf-final-position">'+(r.rank===2?'🥈':r.rank===3?'🥉':r.rank)+'</span><b>'+esc(r.name)+'</b><strong>'+r.points+' <small>نقطة</small></strong></div>').join('')+'<p class="gulf-final-note">من جميع مباريات البطولة • الفائز +1 • النتيجة +2 • الحسم +1</p></section>';
}
const styles=`
#home[data-gulf-complete]>.section>.hero,#home[data-gulf-complete]>.section>.title,#home[data-gulf-complete] #fixturesList{display:none!important}
.gulf-completion{direction:rtl;width:100%;min-width:0}.gulf-finale-hero{position:relative;overflow:hidden;text-align:center;padding:27px 16px 24px;border:1px solid #bc9b4b;border-radius:28px;background:radial-gradient(ellipse at 50% 15%,#b9913040,transparent 57%),linear-gradient(150deg,#173c2b,#071c14 80%);box-shadow:0 15px 35px #0005,inset 0 1px #ffe9a52b}.gulf-finale-kicker{font-size:11px;color:#c7b785;letter-spacing:.5px}.gulf-finale-cup{font-size:92px;line-height:1.35;margin:9px auto;filter:drop-shadow(0 0 20px #eac55665);animation:gulfCupGlow 4s ease-in-out 3}.gulf-finale-hero h1{font-size:34px;color:#fff;margin:0;line-height:1.5}.gulf-finale-hero h2{font-size:25px;color:#f7db8a;margin:0 0 20px}.gulf-finale-score{display:flex;justify-content:center;align-items:center;gap:14px;font-size:16px;font-weight:800;padding:14px 8px;border-radius:16px;background:#06150fa6;border:1px solid #ac8b3d50}.gulf-finale-score b{font-size:29px;color:#ffe8a5;white-space:nowrap}.gulf-finale-hero p{margin:15px 0 5px;font-size:13px;color:#efe2b7}.gulf-finale-hero small{color:#97b1a0;font-size:11px}.gulf-sparks{display:block;text-align:center;color:#e9c96e;letter-spacing:14px;font-size:17px;animation:gulfSparkle 3s ease-in-out 4}.gulf-final-standings>h2{margin:25px 2px 14px;font-size:21px;color:#f0e4be}.gulf-prediction-champion{position:relative;overflow:hidden;border:1px solid #ead17f;border-radius:24px;padding:23px 15px;text-align:center;background:radial-gradient(ellipse at top,#e7c26644,transparent 68%),linear-gradient(135deg,#66501d,#2c2916 70%);box-shadow:0 0 28px #d8b34b1c,inset 0 1px #fff0bb4d;margin-bottom:14px}.gulf-winner-label{font-size:12px;color:#f6e3a5}.gulf-winner-name{display:flex;justify-content:center;align-items:center;gap:12px;margin-top:12px}.gulf-winner-name>span{font-size:43px}.gulf-winner-name h3{font-size:32px;margin:0;color:#fff4c9;overflow-wrap:anywhere}.gulf-winner-points{display:block;font-size:35px;color:#ffdf88;margin:10px}.gulf-winner-points small{font-size:14px}.gulf-prediction-champion p{font-size:13px;line-height:1.9;color:#fff2bf;margin:10px 0}.gulf-final-row{display:grid;grid-template-columns:38px minmax(0,1fr) auto;align-items:center;gap:10px;padding:15px 12px;border:1px solid #294335;border-radius:16px;margin:8px 0;background:#0e2118}.gulf-final-position{text-align:center;font-size:21px;color:#c7b06e}.gulf-final-row>b{font-size:16px;overflow-wrap:anywhere}.gulf-final-row>strong{font-size:22px;color:#ecd798;white-space:nowrap}.gulf-final-row small{font-size:10px;color:#9fb3a5}.gulf-final-note{text-align:center;font-size:10px;line-height:1.8;color:#829b8a;margin:16px 3px}@keyframes gulfCupGlow{50%{transform:translateY(-3px);opacity:.9}}@keyframes gulfSparkle{50%{opacity:.45}}@media(prefers-reduced-motion:reduce){.gulf-finale-cup,.gulf-sparks{animation:none}}@media(max-width:360px){.gulf-finale-hero{padding:22px 11px}.gulf-finale-score{gap:8px;font-size:14px}.gulf-finale-hero h1{font-size:29px}.gulf-winner-name h3{font-size:28px}}
`;
if(typeof window!=='undefined'){
 const style=document.createElement('style');style.id='gulf-completion-v54';style.textContent=styles;document.head.appendChild(style);
 let generation=0;
 const final=()=>localStorage.getItem('dawri_competition')===GULF&&currentRound?.round_number===5&&(fixtures||[]).find(f=>f.status==='finished'&&f.winner_team_id===f.home_team_id);
 async function renderCompletion(){
  const home=el('home'),f=final(),token=++generation;
  if(!f){home?.removeAttribute('data-gulf-complete');el('gulfCompletion')?.remove();return}
  home.setAttribute('data-gulf-complete','');
  let box=el('gulfCompletion');if(!box){box=document.createElement('div');box.id='gulfCompletion';box.className='gulf-completion';home.querySelector('.section').appendChild(box)}
  try{
   const [profiles,scores]=await Promise.all([db.from('profiles').select('id,display_name').eq('approval_status','approved'),window.getGulfScores()]);
   if(token!==generation||!final())return;if(profiles.error)throw profiles.error;
   const markup=completionMarkup(f,standings(profiles.data||[],scores),esc);
   if(box.innerHTML!==markup)box.innerHTML=markup;
  }catch(e){if(token===generation)box.innerHTML='<div class="card">تعذر تحميل الترتيب النهائي. <button onclick="loadRanking()">إعادة المحاولة</button></div>';console.error('Gulf completion',e)}
 }
 const renderBefore=window.renderFixtures;
 window.renderFixtures=function(){if(final()){renderCompletion();return}renderCompletion();return renderBefore.apply(this,arguments)};
 const rankingBefore=window.loadRanking;
 window.loadRanking=async function(){const result=await rankingBefore.apply(this,arguments);await renderCompletion();return result};
 const roundBefore=window.loadCurrentRound;
 window.loadCurrentRound=async function(){const result=await roundBefore.apply(this,arguments);await renderCompletion();return result};
 renderCompletion();
}
