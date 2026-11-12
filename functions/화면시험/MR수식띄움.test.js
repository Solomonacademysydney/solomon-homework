// MR 숙제 가져오기 — 보기 「9\ \text{students}」가 「\(9\\) students」로 깨지지 않는가 (2026-11-12 · 흠 299문항의 뿌리)
'use strict';
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync('E:/aa0/hp/index.html', 'utf8').replace(/\r\n/g, '\n');
const i = html.indexOf('function _katexToMixed'); const j = html.indexOf('\n}\n', i) + 2;
const c = vm.createContext({}); vm.runInContext(html.slice(i, j), c);
const B = '\\';
let 통과 = 0, 실패 = 0;
const 재기 = (입력, 기대) => { const 나옴 = c._katexToMixed(입력);
  if (나옴 === 기대) { 통과++; console.log('  ✅', JSON.stringify(입력), '→', JSON.stringify(나옴)); }
  else { 실패++; console.log('  ⛔', JSON.stringify(입력), '→', JSON.stringify(나옴), '기대', JSON.stringify(기대)); } };
재기('9' + B + ' ' + B + 'text{students}', B + '(9' + B + ') students');
재기('9' + B + ',' + B + 'text{ students}', B + '(9' + B + ') students');
재기('34' + B + ';' + B + 'text{cm}', B + '(34' + B + ') cm');
재기('15' + B + 'text{ books}', B + '(15' + B + ') books');
재기(B + 'text{Solve } x^2=4', 'Solve ' + B + '(x^2=4' + B + ')');
재기(B + 'text{Solve } 3x > 14 ' + B + 'text{ or } 5x ' + B + 'leq 4', 'Solve ' + B + '(3x > 14' + B + ') or ' + B + '(5x ' + B + 'leq 4' + B + ')');
재기(B + 'text{total } ' + B + 'quad 10f+5', 'total ' + B + '(10f+5' + B + ')');
// 어떤 결과에도 「역슬래시 두 개 + )」가 남으면 안 된다
console.log(`\n셈 — 통과 ${통과} · 실패 ${실패}`);
process.exit(실패 ? 1 : 0);
