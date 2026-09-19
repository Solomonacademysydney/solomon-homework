// 화면의 「문항 한 장」과 빼기 표시를 **파일에서 떼어 내** 진짜 초안으로 그려 본다.
const fs = require('fs');
const html = fs.readFileSync('E:/aa0/hp/ts/index.html', 'utf8');

function 떼기(시작, 끝) {
  const i = html.indexOf(시작), j = html.indexOf(끝);
  if (i < 0 || j < 0 || j <= i) throw new Error('못 찾음: ' + 시작);
  return html.slice(i, j);
}
const 소스 = 떼기('function 글(s){', 'function 시각말(')
           + 떼기('function 문항한장(q){', '// ─────────────────── 승인');
// ⛔ 끝 표는 **바로 다음에 오는 것**으로 잡는다. 사이에 새 토막이 끼면
//    엉뚱한 코드까지 끌어와 시험이 엉뚱한 데서 터진다(2026-09-19 실측 —
//    승인 토막이 끼어들어 `firebase is not defined` 로 넘어졌다).
const F = new Function('뺄것', 소스 + '; return {글, 문항한장};');

const d = JSON.parse(fs.readFileSync(
  'C:/TS작업/pool/build/2026-m09-w4/Hayley04_초안.json', 'utf8'));
const qs = d.ts.questions;
const q = qs.find(x => !String(x.figure || '').trim());

let 통과 = 0, 실패 = 0;
function 재기(이름, 참, 덧) {
  if (참) { 통과++; console.log('  ✅ ' + 이름); }
  else { 실패++; console.log('  ⛔ ' + 이름 + (덧 ? '  ' + 덧 : '')); }
}

console.log('── 안 뺀 문항');
let A = F(new Set()).문항한장(q);
재기('「이 문항 빼기」 단추가 보인다', A.includes('✕ 이 문항 빼기'));
재기('「되돌리기」는 안 보인다', !A.includes('↺ 되돌리기'));
재기('뺀 것 표시가 없다', !A.includes('뺀것'));
재기('단추가 그 문항 id 를 넘긴다', A.includes("문항빼기('" + q._item_id + "')"));

console.log('\n── 뺀 문항');
let B = F(new Set([q._item_id])).문항한장(q);
재기('「되돌리기」로 바뀐다', B.includes('↺ 되돌리기') && !B.includes('✕ 이 문항 빼기'));
재기('뺀 것 표시가 붙는다', B.includes('문항장 뺀것'));
재기('지문·보기는 그대로 보인다',
     B.includes(F(new Set()).글(q.text)) && q.options.every(o => B.includes(F(new Set()).글(o))));

console.log('\n── 다른 문항은 안 흔들린다');
const 옆 = qs.find(x => x._item_id !== q._item_id);
const C = F(new Set([q._item_id])).문항한장(옆);
재기('옆 문항엔 뺀 것 표시가 안 붙는다', !C.includes('문항장 뺀것'));

console.log('\n── 아이 글이 그대로 HTML 이 되면 안 된다');
const 심은것 = Object.assign({}, q, {
  _item_id: "ts-x' onclick='alert(1)",
  text: '<img src=x onerror=alert(1)>',
  options: ['<b>가</b>', '나', '다', '라']
});
const D = F(new Set()).문항한장(심은것);
재기('지문의 꺾쇠가 글자로 나간다', D.includes('&lt;img') && !D.includes('<img src=x'));
재기('보기의 꺾쇠가 글자로 나간다', D.includes('&lt;b&gt;'));
재기('문항 id 의 따옴표가 새지 않는다', !D.includes("onclick='alert(1)"),
     D.slice(D.indexOf('문항빼기'), D.indexOf('문항빼기') + 80));

console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
process.exit(실패 ? 1 : 0);
