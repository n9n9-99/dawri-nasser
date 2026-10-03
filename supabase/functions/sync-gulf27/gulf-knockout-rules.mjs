export const METHODS={regulation:'الوقت الأصلي',extra_time:'الوقت الإضافي',penalties:'ضربات الترجيح'};
export function validateKnockout(p){
 if(!['home','away'].includes(p.outcome))return 'اختر المنتخب الفائز';
 if(!Object.hasOwn(METHODS,p.finish_method))return 'اختر طريقة حسم المباراة';
 const h=p.predicted_home_score,a=p.predicted_away_score;
 if(h==null&&a==null)return '';
 if(h==null||a==null||!Number.isInteger(h)||!Number.isInteger(a)||h<0||a<0)return 'أدخل نتيجة الفريقين بأرقام صحيحة';
 if(p.finish_method==='penalties')return h===a?'':'عند اختيار ضربات الترجيح يجب أن تكون نتيجة اللعب تعادلًا';
 return (p.outcome==='home'?h>a:a>h)?'':'النتيجة يجب أن توافق المنتخب الفائز';
}
export function scoreKnockout(p,r){
 const outcome_points=r&&p.outcome===r.winner?1:0;
 const exact_score_points=r&&p.predicted_home_score!=null&&p.predicted_away_score!=null&&p.predicted_home_score===r.home_score&&p.predicted_away_score===r.away_score?2:0;
 const bonus_points=r&&p.finish_method===r.finish_method?1:0;
 return {outcome_points,exact_score_points,bonus_points,total:outcome_points+exact_score_points+bonus_points};
}
export function providerKnockoutResult(e){
 if(e.state!=='finished'||!Object.hasOwn(METHODS,e.decidedBy)||!Number.isInteger(e.homeScore)||!Number.isInteger(e.awayScore))return null;
 let winner;
 if(e.decidedBy==='penalties'){
  if(e.homeScore!==e.awayScore||!Number.isInteger(e.penaltyHome)||!Number.isInteger(e.penaltyAway)||e.penaltyHome===e.penaltyAway)return null;
  winner=e.penaltyHome>e.penaltyAway?'home':'away';
 }else{if(e.homeScore===e.awayScore)return null;winner=e.homeScore>e.awayScore?'home':'away';}
 return {winner,finish_method:e.decidedBy,home_score:e.homeScore,away_score:e.awayScore};
}
