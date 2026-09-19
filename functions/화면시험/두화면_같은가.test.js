// 두 화면(`index.html` · `ts/index.html`)이 **같아야 할 것**을 같게 들고 있는가.
//
// ⛔ 같은 일을 두 곳에 적어 두면 **한쪽만 고치고 끝난다.**
//    2026-09-19 — 요일 나누는 자를 `index.html` 만 고쳤더니 교사 화면은 「월/수」를
//    못 알아듣는 채로 남았다. 교사 화면은 그걸로 **「내일 수업인 아이」를 고른다.**
//
// ⛔ **이름이 같은지가 아니라 「같은 답을 내는지」를 잰다.** 두 파일은 이름 규칙이 다르다
//    (`_요일배열` vs `요일배열`). 글자를 견주면 멀쩡한 것을 틀렸다고 신고한다.

'use strict';
const fs = require('fs');
const 본 = fs.readFileSync('E:/aa0/hp/index.html', 'utf8');
const 교 = fs.readFileSync('E:/aa0/hp/ts/index.html', 'utf8');

let 통과 = 0, 실패 = 0;
function 재기(이름, 참, 덧) {
  if (참) { 통과++; console.log('  ✅ ' + 이름); }
  else { 실패++; console.log('  ⛔ ' + 이름 + (덧 ? '\n       ' + 덧 : '')); }
}

function 떼기(글, 시작, 끝) {
  const i = 글.indexOf(시작);
  if (i < 0) return null;
  const j = 글.indexOf(끝, i + 10);
  return j < 0 ? null : 글.slice(i, j);
}

console.log('── 글자까지 같아야 하는 것');
for (const [이름, 정규] of [
  ['원장 uid', /62bxWubzDLMrhHjjv2oNfAQiyaD2/],
  ['데이터베이스 주소', /https:\/\/solomon-76715-default-rtdb[^"']*/],
  ['숙제 뿌리 이름', /solomon_hw_v3/],
]) {
  const a = (본.match(정규) || [])[0], b = (교.match(정규) || [])[0];
  재기(이름, !!a && a === b, 'index: ' + a + '  ·  ts: ' + b);
}

console.log('\n── ⭐ 요일 자 — **같은 답을 내는가** (이름은 달라도 된다)');
const A = (() => {
  const 소스 = 떼기(본, 'const _요일들 = ', 'function _요일못알아들은것');
  return new Function(소스 + '\n; return _요일배열;')();
})();
const B = (() => {
  const 소스 = 떼기(교, 'const 요일말 = ', 'function 며칠뒤');
  return new Function(소스 + '\n; return 요일배열;')();
})();
// ⛔ 재는 값은 **자료에 실제로 있는 꼴**이다(실측 2026-09-19 — 배열 열하나 · 옛 글자 꼴).
for (const 값 of [['mon'], ['fri'], 'mon', 'mon/wed', 'mon,wed', 'MON', '', null, undefined,
                  ['mon', 'wed'], 'fri/sun',
                  // 한글도 — 원장님이 학생 관리에서 한글로 적으실 수 있다(2026-09-19 요청)
                  '금', '수', '월/수', '월,수,금', '금요일', '월 수', '월/fri', ['금'], '엉뚱']) {
  const a = JSON.stringify(A(값)), b = JSON.stringify(B(값));
  재기('둘이 같다 — ' + JSON.stringify(값) + ' → ' + a, a === b, a + '  vs  ' + b);
}

console.log('\n── 칸 이름 짓는 규칙 — 같은 답을 내는가');
const hwKey = new Function(떼기(본, 'function hwKey(', '\nconst HW_KEY_RE') + '\n; return hwKey;')();
// ⛔ `new Function(a, b)` 는 a 를 **매개변수 이름**으로 본다. 소스는 **하나로 이어 붙여** 넘긴다.
const _칸이름소스 = 떼기(교, 'function 칸이름(', '\nconst 칸무늬') || 떼기(교, 'function 칸이름(', '\nfunction ');
const 칸이름 = _칸이름소스 ? new Function(_칸이름소스 + '\n; return 칸이름;')() : null;
if (typeof 칸이름 === 'function') {
  for (const [y, c, p, g] of [[4, 'AU', { year: 2026, month: 9, week: 4 }, ''],
                              [5, 'AU', { year: 2026, month: 12, week: 1 }, '키이라'],
                              [3, 'AU', { year: 2027, month: 1, week: 5 }, '']]) {
    재기('hwKey(' + y + ',' + (g || '반없음') + ') 가 같다',
         hwKey(y, c, p, g) === 칸이름({ year: y, country: c, group: g },
               p.year + '_m' + String(p.month).padStart(2, '0') + '_w' + p.week, true),
         hwKey(y, c, p, g));
  }
} else {
  console.log('   ⏭ 교사 화면의 칸이름 을 못 떼어 냈습니다');
}

console.log('\n── 교사 화면이 지키는 선');
재기('익명 로그인 코드가 없다', !/firebase\.auth\(\)\.signInAnonymously/.test(교));
재기('`homeworkSets` 에 쓰지 않는다', !/homeworkSets[^\n]*\.(set|update|remove)\(/.test(교));
const 쓰기 = 교.match(/db\.ref\([^)]*\)\.(set|update|push|remove)/g) || [];
재기('파이어베이스 쓰기는 `ops/req` 에만', 쓰기.every(x => /req/.test(x)), JSON.stringify(쓰기));

console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
process.exit(실패 ? 1 : 0);
