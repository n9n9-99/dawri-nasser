import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
const source=readFileSync(new URL('../supabase/functions/dawri-control/control.js',import.meta.url),'utf8');
const logoLine=source.split('\n').find(l=>l.startsWith('const LOGOS='));
test('every Roshn club has an official crest source, including previously missing clubs',()=>{const logos=vm.runInNewContext(logoLine+';LOGOS');const clubs=['أبها','الأهلي','الاتحاد','الاتفاق','التعاون','الحزم','الخلود','الخليج','الدرعية','الرياض','الشباب','الفتح','الفيحاء','الفيصلي','القادسية','النصر','الهلال','نيوم'];for(const name of clubs)assert.match(logos[name]||'',/^https:\/\/media-sdp\.spl\.com\.sa\/clubLogos\//,name)});
