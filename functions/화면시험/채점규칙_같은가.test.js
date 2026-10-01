// 서버 채점(functions/norm_answer.js)과 화면 채점(index.html normAns)이 **같은가**.
//   [2-B] 개인 배정은 서버가 채점한다(학생에게 정답을 안 보내므로). 두 규칙이 어긋나면
//   같은 답이 화면과 리포트에서 다르게 채점된다. 여러 꼴의 답을 넣어 하나라도 다르면 넘어진다.
'use strict';
const fs = require('fs');
const html = fs.readFileSync('E:/aa0/hp/index.html', 'utf8');
const i = html.indexOf('function normAns(a) {');
const 화면 = new Function(html.slice(i, html.indexOf('\n}\n', i) + 3) + '\n; return normAns;')();
const 서버 = require('../norm_answer').normAns;

const 답들 = [null, undefined, '', ' b ', 'B', '3.0', '05', '+7', '-8', '\u22128', '50%', '50 %', 'x=-8', 'X = 7',
  'ANSWER: B', '✓ ANSWER: C', '$3/5$', '\\dfrac{3}{5}', '4\\dfrac{2}{3}', '4 \\frac{2}{3}', '\\text{cm}', '{12}',
  '1\u00A0000', 'a  b', '3.14', '0.50', '1e3', '12 cm', '−0.5', 'True', '⭕', 7, 0, 2.5];
let 통과 = 0, 실패 = 0;
for (const a of 답들) {
  const x = 화면(a), y = 서버(a);
  if (x === y) 통과++;
  else { 실패++; console.log('  ⛔ 다름: ' + JSON.stringify(a) + ' → 화면 ' + JSON.stringify(x) + ' · 서버 ' + JSON.stringify(y)); }
}
console.log('  ' + (실패 ? '⛔' : '✅') + ' 답 ' + 답들.length + '꼴 중 같음 ' + 통과);
// 글자째 같은지도 본다(규칙 한 줄만 바뀌어도 잡히게)
const 서버글 = fs.readFileSync(require.resolve('../norm_answer'), 'utf8');
const 화면글 = html.slice(i, html.indexOf('\n}\n', i) + 3);
if (서버글.includes(화면글)) { 통과++; console.log('  ✅ 함수 글자가 화면과 똑같다'); }
else { 실패++; console.log('  ⛔ 함수 글자가 화면과 다르다 — 화면 normAns 를 고쳤으면 norm_answer.js 도 고칠 것'); }
console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
process.exit(실패 ? 1 : 0);
