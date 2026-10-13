const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
function fixture(){
 const classes=new Set(); const area={innerHTML:''}; let calls=0;
 const elements={printArea:area,printPreviewToolbar:{classList:{add(){},remove(){}},querySelector(){return {focus(){}}}}};
 const context={LegalAffairsUI:{summarizeReportRows:()=>({total:1,active:1,completed:0,waiting:0,late:0})},$:id=>elements[id],esc:String,currentHijriLabel:()=>'',fmtDate:String,badgeClass:()=>'',WAIT_STATUSES:[],document:{body:{classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)}}},window:{print(){calls++},scrollTo(){}},setTimeout(){},toast(){}};
 vm.createContext(context);
 const source=html.slice(html.indexOf('function buildPrint('),html.indexOf('function printReport('));
 vm.runInContext(source,context);
 return {context,classes,area,calls:()=>calls};
}
test('print request runs while the click gesture is active',()=>{
 const f=fixture(); f.context.buildPrint([{transaction_no:'1',subject:'موضوع',entity:'جهة',entry_date:'2026-10-13',status:'قيد الإجراء',required_action:'متابعة'}],'تقرير');
 assert.equal(f.calls(),1);
});
test('report remains visible when an embedded browser ignores print',()=>{
 const f=fixture(); f.context.buildPrint([],'تقرير');
 assert.equal(f.classes.has('print-preview'),true); assert.match(f.area.innerHTML,/تقرير/);
});
