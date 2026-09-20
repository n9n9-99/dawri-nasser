# Manual WhatsApp Report Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** تمكين المدير من إنشاء ملف PDF موحد للمعاملات غير المنتهية ومشاركته يدويًا من الآيفون إلى مجموعة واتساب، دون الاعتماد على WhatsApp Cloud API.

**Architecture:** تضيف وظيفة Supabase Edge Function باسم `manual-report` طبقة آمنة تتحقق من جلسة المدير، تحدّث حالات المتابعة، تقرأ أحدث المعاملات المفتوحة، وتعيد ملف PDF مباشرة. تضيف الواجهة وحدة مستقلة لتحويل الاستجابة إلى `File` ثم استخدام Web Share API، مع تنزيل احتياطي عندما لا يدعم المتصفح مشاركة الملفات.

**Tech Stack:** HTML/CSS/JavaScript، Web Share API، Node test runner، Supabase Auth/Postgres/Edge Functions، Deno/TypeScript، PDFKit `0.17.2`، Vercel.

**Spec:** `docs/superpowers/specs/2026-09-20-manual-whatsapp-report-sharing-design.md`

## Global Constraints

- التقرير موحد لجميع المستخدمين ويحتوي على المعاملات التي حالتها ليست «منتهية» فقط.
- زر المشاركة ووظيفة التقرير متاحان للمدير فقط.
- لا يختار التطبيق مجموعة واتساب ولا يضغط «إرسال» نيابة عن المدير.
- المسار الجديد لا يستدعي Meta API ولا يحتاج أسرار WhatsApp.
- لا تُحذف وظيفة WhatsApp القديمة أو أسرارها في هذا الإصدار؛ تبقى الجدولة القديمة معطلة.
- لا يُخزن ملف التقرير في رابط عام أو دائم.
- لا يتم النشر قبل نجاح الاختبارات المحلية والتحقق من وظيفة Supabase.

## Review Focus

- جلسة منتهية أثناء الإنشاء: تظهر رسالة تطلب تسجيل الدخول مجددًا ولا يُنشأ ملف.
- مستخدم موظف يستدعي الوظيفة مباشرة: ترجع `403` دون كشف بيانات.
- لا توجد معاملات مفتوحة: ترجع `204` وتعرض الواجهة رسالة واضحة دون ملف فارغ.
- Safari يدعم المشاركة لكن لا يدعم مشاركة الملفات: يستخدم التنزيل الاحتياطي.
- إلغاء نافذة المشاركة من المستخدم: لا يظهر كفشل ولا يعاد إنشاء التقرير.

---

## File Structure

- `report-sharing.js`: منطق مشاركة ملف PDF والتنزيل الاحتياطي، مستقل وقابل للاختبار.
- `test/report-sharing.test.js`: اختبارات Web Share API ومسار التنزيل والإلغاء.
- `supabase/functions/manual-report/report.ts`: تصفية المعاملات وترتيبها وبناء نموذج التقرير.
- `supabase/functions/manual-report/pdf.ts`: إنشاء PDF عربي من نموذج التقرير.
- `supabase/functions/manual-report/index.ts`: المصادقة، تفويض المدير، قراءة البيانات، وإرجاع PDF.
- `supabase/functions/manual-report/index_test.ts`: اختبارات النموذج والاستجابة والصلاحيات دون اتصال فعلي.
- `supabase/functions/manual-report/deno.json`: إصدارات الاعتمادات المثبتة.
- `index.html`: زر المدير، حالة التحميل، استدعاء الوظيفة، ونص إعدادات المشاركة اليدوية.

### Task 1: وحدة مشاركة الملف في المتصفح

**Files:**
- Create: `report-sharing.js`
- Create: `test/report-sharing.test.js`

**Interfaces:**
- Produces: `buildFilename(date): string` و`shareOrDownload({ file, navigatorRef, documentRef, urlRef }): Promise<'shared'|'downloaded'|'cancelled'>`.

- [ ] **Step 1: كتابة اختبارات فاشلة للمشاركة والتنزيل والإلغاء**

```js
test('shares a PDF file when file sharing is supported', async () => {
  const calls = [];
  const result = await shareOrDownload({
    file: { name: 'report.pdf' },
    navigatorRef: { canShare: () => true, share: async value => calls.push(value) },
    documentRef: {}, urlRef: {}
  });
  assert.equal(result, 'shared');
  assert.equal(calls[0].files[0].name, 'report.pdf');
});

test('downloads when file sharing is unavailable', async () => {
  const clicks = [];
  const result = await shareOrDownload({
    file: { name: 'report.pdf' },
    navigatorRef: { canShare: () => false },
    documentRef: { createElement: () => ({ click: () => clicks.push(true), remove() {} }), body: { appendChild() {} } },
    urlRef: { createObjectURL: () => 'blob:test', revokeObjectURL() {} }
  });
  assert.equal(result, 'downloaded');
  assert.equal(clicks.length, 1);
});
```

- [ ] **Step 2: تشغيل الاختبار والتأكد من فشله**

Run: `node --test test/report-sharing.test.js`
Expected: FAIL لأن `report-sharing.js` غير موجود.

- [ ] **Step 3: تنفيذ الوحدة بأقل كود**

```js
async function shareOrDownload({ file, navigatorRef, documentRef, urlRef }) {
  if (navigatorRef.share && navigatorRef.canShare?.({ files: [file] })) {
    try {
      await navigatorRef.share({ files: [file], title: 'تقرير متابعة المعاملات' });
      return 'shared';
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled';
      throw error;
    }
  }
  const href = urlRef.createObjectURL(file);
  const link = documentRef.createElement('a');
  link.href = href;
  link.download = file.name;
  documentRef.body.appendChild(link);
  link.click();
  link.remove();
  urlRef.revokeObjectURL(href);
  return 'downloaded';
}
```

- [ ] **Step 4: إضافة اختبار `AbortError` ثم تشغيل جميع اختبارات الواجهة**

Run: `node --test test/*.test.js`
Expected: PASS.

- [ ] **Step 5: الالتزام بالتغيير**

```bash
git add report-sharing.js test/report-sharing.test.js
git commit -m "feat: add manual report file sharing"
```

### Task 2: نموذج التقرير ومولد PDF

**Files:**
- Create: `supabase/functions/manual-report/report.ts`
- Create: `supabase/functions/manual-report/pdf.ts`
- Create: `supabase/functions/manual-report/deno.json`
- Create: `supabase/functions/manual-report/index_test.ts`

**Interfaces:**
- Produces: `buildReportModel(rows, reportDate): ReportModel` و`renderArabicPdf(model, suppliedFont?): Promise<Uint8Array>`.

- [ ] **Step 1: كتابة اختبار فاشل لاستبعاد المنتهي وترتيب الأولوية**

```ts
test('orders open rows and excludes completed rows', () => {
  const model = buildReportModel([
    { transaction_no: '3', subject: 'ج', entity: 'ج', status: 'قيد الإجراء', required_action: 'متابعة' },
    { transaction_no: '2', subject: 'ب', entity: 'ب', status: 'منتهية', required_action: '—' },
    { transaction_no: '1', subject: 'أ', entity: 'أ', status: 'متأخرة', required_action: 'عاجل' }
  ], '2026-09-20');
  assert.deepEqual(model.rows.map(row => row.status), ['متأخرة', 'قيد الإجراء']);
});
```

- [ ] **Step 2: تشغيل الاختبار والتأكد من فشله**

Run: `node --test supabase/functions/manual-report/index_test.ts`
Expected: FAIL لعدم وجود الملفات.

- [ ] **Step 3: نقل منطق التقرير المجرب من حزمة `whatsapp-dispatch`**

استخدم ترتيب الحالات: متأخرة، تحتاج إلحاقي، بانتظار رد، تحت الإجراء، قيد الإجراء. ثبّت `pdfkit` على `0.17.2` وخط `@fontsource/noto-naskh-arabic` على `5.2.5`، واجعل كل نص عربي بمحاذاة اليمين وميزة `rtla`.

- [ ] **Step 4: إضافة اختبار توقيع PDF وتشغيله**

```ts
test('renders PDF bytes', async () => {
  const bytes = await renderArabicPdf(model, localFontBytes);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), '%PDF');
});
```

Run: `node --test supabase/functions/manual-report/index_test.ts`
Expected: PASS وتكون bytes أكبر من 1000.

- [ ] **Step 5: الالتزام بالتغيير**

```bash
git add supabase/functions/manual-report
git commit -m "feat: add on-demand legal report PDF"
```

### Task 3: وظيفة Supabase الآمنة للمدير

**Files:**
- Create: `supabase/functions/manual-report/index.ts`
- Modify: `supabase/functions/manual-report/index_test.ts`

**Interfaces:**
- Consumes: `POST` مع `Authorization: Bearer <session token>`.
- Produces: PDF (`200`)، لا محتوى (`204`)، أو JSON آمن (`401/403/405/500`).

- [ ] **Step 1: كتابة اختبارات فاشلة للطريقة والمصادقة والتفويض**

```ts
test('rejects non-POST requests', async () => {
  assert.equal((await handleRequest(new Request('https://local'), deps)).status, 405);
});

test('rejects a staff profile', async () => {
  const response = await handleRequest(postRequest, fakeDeps({ profileRole: 'staff' }));
  assert.equal(response.status, 403);
});
```

- [ ] **Step 2: تشغيل الاختبارات والتأكد من فشلها**

Run: `node --test supabase/functions/manual-report/index_test.ts`
Expected: FAIL لأن `handleRequest` غير معرف.

- [ ] **Step 3: تنفيذ `handleRequest` بحقن الاعتمادات**

يقرأ Bearer token، يستدعي `auth.getUser(token)`، يتحقق من `profiles.role === 'admin'`، يستدعي `sync_followup_statuses_system`، ثم يقرأ المعاملات المفتوحة. يمنع `store` العام ويعيد:

```ts
return new Response(pdfBytes, {
  status: 200,
  headers: {
    'content-type': 'application/pdf',
    'content-disposition': `attachment; filename="legal-open-transactions-${reportDate}.pdf"`,
    'cache-control': 'no-store'
  }
});
```

- [ ] **Step 4: اختبار 204 وPDF والأخطاء المنقحة**

Run: `node --test supabase/functions/manual-report/index_test.ts`
Expected: PASS لكل الحالات، ولا تتضمن الأخطاء أي JWT أو service key.

- [ ] **Step 5: مراجعة وثائق Supabase الحالية قبل النشر**

استخدم `supabase_search_docs` للتحقق من Auth داخل Edge Functions، وافحص `https://supabase.com/changelog.md` للتغييرات الكاسرة ذات الصلة.

- [ ] **Step 6: الالتزام بالتغيير**

```bash
git add supabase/functions/manual-report
git commit -m "feat: secure manual report endpoint"
```

### Task 4: ربط زر المشاركة بالواجهة

**Files:**
- Modify: `index.html`
- Modify: `test/report-sharing.test.js`

**Interfaces:**
- Consumes: `LegalReportShare.shareOrDownload` ووظيفة `/functions/v1/manual-report`.
- Produces: `createAndShareReport(): Promise<void>` وزر `#shareReportBtn` للمدير.

- [ ] **Step 1: إضافة اختبار وجود نصوص الواجهة وربط الوحدة**

```js
test('index exposes the admin report sharing controls', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="shareReportBtn"/);
  assert.match(html, /مشاركة التقرير/);
  assert.match(html, /report-sharing\.js/);
});
```

- [ ] **Step 2: تشغيل الاختبار والتأكد من فشله**

Run: `node --test test/report-sharing.test.js`
Expected: FAIL لعدم وجود الزر والربط.

- [ ] **Step 3: إضافة الزر الإداري والنص الجديد**

أضف `data-admin-only` إلى زر `shareReportBtn`، واستبدل وصف WhatsApp Business بعبارة المشاركة اليدوية من رقم المدير، مع إبقاء زر الطباعة.

- [ ] **Step 4: تنفيذ جلب الملف ومشاركته**

يحصل `createAndShareReport` على جلسة Supabase، يطلب الوظيفة بالـJWT والمفتاح العام، يعالج `204/401/403`، ينشئ `File` من Blob، ثم يستدعي وحدة المشاركة. يعطّل الزر أثناء التنفيذ ويعيده دائمًا في `finally`.

- [ ] **Step 5: تشغيل جميع اختبارات الواجهة**

Run: `node --test test/*.test.js`
Expected: PASS.

- [ ] **Step 6: الالتزام بالتغيير**

```bash
git add index.html report-sharing.js test/report-sharing.test.js
git commit -m "feat: share open transactions report"
```

### Task 5: نشر Supabase والتحقق

**Files:**
- No repository changes expected.

**Interfaces:**
- Produces: وظيفة منشورة `manual-report` في المشروع `rcvuymsoucnyskyvlxql`.

- [ ] **Step 1: تشغيل كامل الاختبارات المحلية**

Run: `node --test test/*.test.js supabase/functions/manual-report/index_test.ts`
Expected: PASS.

- [ ] **Step 2: التحقق من أن الجدولة القديمة معطلة**

```sql
select jobname, active from cron.job where jobname like 'whatsapp-%';
```

Expected: جميع وظائف WhatsApp القديمة `active = false`.

- [ ] **Step 3: نشر `manual-report`**

استخدم Supabase MCP لنشر الوظيفة في المشروع `rcvuymsoucnyskyvlxql` مع التحقق داخل الكود. لا ترسل أي رسالة واتساب أثناء التحقق.

- [ ] **Step 4: اختبار الصلاحيات دون إرسال**

تحقق من رفض الطلب بلا جلسة (`401`) ومن أن استدعاء المدير يرجع PDF أو `204`. افحص أن `content-type` صحيح وأن الاستجابة لا تحتوي أسرارًا.

### Task 6: نشر Vercel والتحقق النهائي

**Files:**
- Modify: plan checkboxes only after verification.

**Interfaces:**
- Produces: إصدار إنتاج جديد لمشروع Vercel `legal-affairs-department`.

- [ ] **Step 1: دفع commits إلى فرع `legal-affairs-department`**

Run: `git push origin legal-affairs-department`
Expected: نجاح الدفع وتشغيل نشر Vercel التلقائي.

- [ ] **Step 2: انتظار نشر الإنتاج وفحص السجلات**

استخدم Vercel للحصول على أحدث deployment. يجب أن تكون `readyState = READY` ولا توجد أخطاء build/runtime.

- [ ] **Step 3: فحص الواجهة المنشورة**

تحقق أن الموظف لا يرى زر المشاركة، وأن المدير يراه، وأن زر الطباعة ما زال يعمل، وأن الضغط المكرر ممنوع أثناء إنشاء الملف.

- [ ] **Step 4: اختبار آيفون قبل الإرسال الفعلي**

يفتح المدير التطبيق من Safari، يضغط «مشاركة التقرير»، ويتأكد أن ملف PDF يظهر داخل قائمة المشاركة ويستطيع اختيار مجموعة القسم. لا يضغط «إرسال» إلا باختياره الصريح.

- [ ] **Step 5: توثيق نتيجة النشر**

سجل رابط deployment وSHA النهائي ونتائج الاختبارات. اترك تنظيف WhatsApp Cloud API لتغيير مستقل بعد موافقة المدير على الاختبار.
