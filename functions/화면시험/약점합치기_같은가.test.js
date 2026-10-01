// 서버 약점 합치기(functions/weakness_merge.js)가 학생 화면(index.html)과 **글자째** 같은가 (3-D)
'use strict';
const fs = require('fs');
const html = fs.readFileSync('E:/aa0/hp/index.html', 'utf8');
const 서버 = fs.readFileSync(require.resolve('../weakness_merge'), 'utf8');
let 통과 = 0, 실패 = 0;
for (const 머리 of ['function _weaknessMerge(cur, cid, rev, v, now) {', 'function taxSafeKey(taxId) {']) {
  const i = html.indexOf(머리);
  const 글 = html.slice(i, html.indexOf('\n}\n', i) + 3);
  if (i >= 0 && 서버.includes(글)) { 통과++; console.log('  ✅ 같다: ' + 머리.slice(9, 30)); }
  else { 실패++; console.log('  ⛔ 다르다: ' + 머리.slice(9, 30) + ' — 화면을 고쳤으면 weakness_merge.js 도'); }
}
console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
process.exit(실패 ? 1 : 0);
