(function(root){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function periodBounds(from,to){
 const valid=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00+03:00'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
 if(!valid(from)||!valid(to)||from>to)throw new Error('اختر فترة صحيحة: تاريخ البداية قبل النهاية');
 return {start:new Date(from+'T00:00:00+03:00').toISOString(),end:new Date(Date.parse(to+'T00:00:00+03:00')+86400000).toISOString()};
}
const labels={transaction_no:'رقم المعاملة',entry_date:'تاريخ القيد',subject:'الموضوع',entity:'الجهة',transaction_type:'النوع',status:'الحالة',required_action:'الإجراء',sent_date:'تاريخ الإرسال',outgoing_letter_no:'رقم الخطاب',sent_to:'الجهة المرسل إليها',notes:'الملاحظات',closed_at:'تاريخ الإنهاء'};
function changedFields(log){const old=log.old_data||{},next=log.new_data||{};return Object.keys(labels).filter(k=>JSON.stringify(old[k]??null)!==JSON.stringify(next[k]??null));}
function summarize(people,logs){
 const rows=people.map(p=>({...p,inserted:0,edits:0,ignoredSaves:0,editedIds:new Set(),total:0}));const byId=new Map(rows.map(p=>[p.id,p]));const movements=[];let unassigned=0;
 for(const log of logs){if(!['insert','update'].includes(log.action))continue;const p=byId.get(log.user_id);if(!p){unassigned++;continue;}
 if(log.action==='update'&&!changedFields(log).length){p.ignoredSaves++;continue;}
 if(log.action==='insert')p.inserted++;else{p.edits++;p.editedIds.add(log.transaction_id||'unknown');}
 p.total++;movements.push({...log,full_name:p.full_name,username:p.username,changed:changedFields(log)});
 }
 rows.forEach(p=>{p.editedTransactions=p.editedIds.size;delete p.editedIds;});rows.sort((a,b)=>b.total-a.total||b.inserted-a.inserted||a.username.localeCompare(b.username));
 const leaders=rows.filter(p=>p.total>0&&p.total===rows[0].total);return {rows,leaders,movements,unassigned,total:rows.reduce((n,p)=>n+p.total,0)};
}
function render(model,from,to,mode='full'){
 let h='<div class="print-head"><h1>قسم الشؤون القانونية</h1><h2>تقرير نشاط المستخدمين</h2><p>من '+esc(from)+' إلى '+esc(to)+' (ميلادي) • توقيت المملكة العربية السعودية</p></div>';
 h+='<div class="activity-winner"><strong>'+(model.leaders.length?'الأكثر نشاطًا'+(model.leaders.length>1?' — تعادل':''):'لا يوجد نشاط مسجل خلال الفترة')+'</strong><p>'+model.leaders.map(p=>esc(p.full_name)+' ('+esc(p.username)+') — '+p.total+' حركة فعلية').join(' • ')+'</p></div>';
 h+='<table class="activity-table"><thead><tr><th>الترتيب</th><th>المستخدم</th><th>اسم الدخول</th><th>أدخل</th><th>معاملات معدلة</th><th>تعديلات فعلية</th><th>الإجمالي</th></tr></thead><tbody>';
 h+=model.rows.map((p,i)=>'<tr class="'+(model.leaders.includes(p)?'activity-leader':'')+'"><td>'+(i+1)+'</td><td>'+esc(p.full_name)+'</td><td>'+esc(p.username)+'</td><td>'+p.inserted+'</td><td>'+p.editedTransactions+'</td><td>'+p.edits+'</td><td><b>'+p.total+'</b></td></tr>').join('');
 h+='<tr><td colspan="3"><b>المجموع</b></td><td>'+model.rows.reduce((n,p)=>n+p.inserted,0)+'</td><td>—</td><td>'+model.rows.reduce((n,p)=>n+p.edits,0)+'</td><td><b>'+model.total+'</b></td></tr></tbody></table>';
 h+='<p class="print-note">الإجمالي = الإدخال + التعديلات الفعلية. «معاملات معدلة» يحسب المعاملة مرة واحدة لكل مستخدم، بينما «تعديلات فعلية» يحسب كل تغيير حقيقي. الحفظ دون تغيير مستبعد ('+model.rows.reduce((n,p)=>n+p.ignoredSaves,0)+' حركة). الحركات غير المنسوبة لمستخدم: '+model.unassigned+'؛ مستبعدة من ترتيب الهدية. القياس يعكس النشاط المسجل ولا يقيس جودة العمل. يشمل الجدول حساب الأدمن.</p>';
 if(mode==='summary')return h;
 h+='<h3>تفاصيل حركات الإدخال والتعديل</h3><table class="activity-detail-table"><thead><tr><th>م</th><th>التاريخ والوقت</th><th>المستخدم</th><th>رقم المعاملة</th><th>الحركة</th><th>تفاصيل التغيير</th></tr></thead><tbody>';
 h+=model.movements.map((m,i)=>{const date=m.created_at?new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn',{timeZone:'Asia/Riyadh',dateStyle:'short',timeStyle:'short'}).format(new Date(m.created_at)):'—';const detail=m.action==='insert'?'تسجيل معاملة جديدة':m.changed.map(k=>labels[k]+': '+String(m.old_data?.[k]??'—')+' ← '+String(m.new_data?.[k]??'—')).join('؛ ');return '<tr><td>'+(i+1)+'</td><td>'+esc(date)+'</td><td>'+esc(m.full_name)+'</td><td>'+esc(m.new_data?.transaction_no||m.old_data?.transaction_no||m.transaction_id||'—')+'</td><td>'+(m.action==='insert'?'إدخال':'تعديل')+'</td><td>'+esc(detail)+'</td></tr>';}).join('');
 return h+'</tbody></table>';
}
const api={periodBounds,summarize,render};if(typeof module==='object'&&module.exports)module.exports=api;else root.LegalActivityReports=api;
})(typeof window==='undefined'?globalThis:window);
