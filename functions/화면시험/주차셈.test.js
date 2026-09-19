// 교사 화면의 주차 셈이 **홈페이지와 같은 답**을 내는가.
//
// ⛔ 2026-09-19 실측 — 홈페이지는 「Week 3 (Sep 14–18)」인데 교사 화면은 **w2** 라 했다.
//    그래서 분석 주차를 w1 으로, 칸을 `AU_y4_2026_m09_w1` 으로 잡아 **엉뚱한 주의 자료**를 보였다.
//    주차가 밀리면 **엉뚱한 칸에 숙제를 넣는다.** 셈하는 규칙은 한 벌이어야 한다.
//
// 규칙(ISO) — **그 주의 목요일이 든 달**에 그 주가 속한다.

'use strict';
const fs = require('fs');
const 본 = fs.readFileSync('E:/aa0/hp/index.html', 'utf8');
const 교 = fs.readFileSync('E:/aa0/hp/ts/index.html', 'utf8');

function 떼기(글, 시작, 끝) {
  const i = 글.indexOf(시작);
  if (i < 0) throw new Error('못 찾음: ' + 시작);
  const j = 글.indexOf(끝, i + 10);
  if (j < 0) throw new Error('끝 못 찾음: ' + 끝);
  return 글.slice(i, j);
}

// 교사 화면 — `시드니지금()` 을 시험이 주는 날짜로 바꿔 끼운다
const 이번주차 = (() => {
  const 소스 = 떼기(교, 'function 이번주차(d){', 'function 앞주차');
  return new Function('시드니지금', 소스 + '\n; return 이번주차;')(() => new Date());
})();

// 홈페이지 — 같은 일을 하는 자
const _weekNumInMonth = new Function(
  떼기(본, 'function _weekNumInMonth(', '\nfunction ') + '\n; return _weekNumInMonth;')();

let 통과 = 0, 실패 = 0;
function 재기(이름, 얻은, 바란) {
  if (얻은 === 바란) { 통과++; console.log('  ✅ ' + 이름 + '  → ' + 얻은); }
  else { 실패++; console.log('  ⛔ ' + 이름 + '\n       얻은 ' + 얻은 + '\n       바란 ' + 바란); }
}

console.log('── 오늘 화면에 뜬 것 (홈페이지가 「Week 3 (Sep 14–18)」이라 했다)');
재기('2026-09-19 (토)', 이번주차(new Date(2026, 8, 19)), '2026_m09_w3');
재기('2026-09-14 (그 주 월)', 이번주차(new Date(2026, 8, 14)), '2026_m09_w3');
재기('2026-09-20 (그 주 일)', 이번주차(new Date(2026, 8, 20)), '2026_m09_w3');

console.log('\n── 9월 전체');
재기('8/31 (월) — 목 9/3 이라 9월 1주', 이번주차(new Date(2026, 7, 31)), '2026_m09_w1');
재기('9/1  (화)', 이번주차(new Date(2026, 8, 1)), '2026_m09_w1');
재기('9/7  (월)', 이번주차(new Date(2026, 8, 7)), '2026_m09_w2');
재기('9/21 (월)', 이번주차(new Date(2026, 8, 21)), '2026_m09_w4');
재기('9/28 (월) — 목 10/1 이라 **10월 1주**', 이번주차(new Date(2026, 8, 28)), '2026_m10_w1');

console.log('\n── 달·해 경계');
재기('2026-12-28 (월) — 목 12/31 이라 12월 5주', 이번주차(new Date(2026, 11, 28)), '2026_m12_w5');
재기('2027-01-01 (금) — 그 주 목 12/31 이라 **2026년 12월**',
     이번주차(new Date(2027, 0, 1)), '2026_m12_w5');
재기('2027-01-04 (월) — 목 1/7 이라 1월 1주', 이번주차(new Date(2027, 0, 4)), '2027_m01_w1');

console.log('\n── ⭐ 홈페이지의 자와 **같은 답**을 내는가 (한 해를 다 훑는다)');
let 다름 = 0, 본것 = 0;
for (let d = new Date(2026, 0, 1); d < new Date(2027, 11, 31); d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
  본것++;
  const 월 = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  const 목 = new Date(월.getFullYear(), 월.getMonth(), 월.getDate() + 3);
  const 바란 = 목.getFullYear() + '_m' + String(목.getMonth() + 1).padStart(2, '0')
             + '_w' + _weekNumInMonth(목.getFullYear(), 목.getMonth() + 1, 월);
  const 얻은 = 이번주차(d);
  if (얻은 !== 바란) {
    다름++;
    if (다름 <= 5) console.log('     ⛔ ' + d.toISOString().slice(0, 10) + '  얻은 ' + 얻은 + ' · 바란 ' + 바란);
  }
}
재기('두 해(' + 본것 + '일) 동안 다른 날 수', 다름, 0);

console.log('\n── 앞·다음 주차 — **날짜로** 셈하는가 (숫자만 빼면 달 경계에서 틀린다)');
const W = (() => {
  const 소스 = 떼기(교, 'function 이번주차(d){', 'function 칸이름');
  return new Function('시드니지금',
    소스 + '\n; return {이번주차, 앞주차, 다음주차, 주차의월요일};')(() => new Date());
})();
재기('9월 4주의 다음은 10월 1주', W.다음주차('2026_m09_w4'), '2026_m10_w1');
재기('10월 1주의 앞은 9월 4주', W.앞주차('2026_m10_w1'), '2026_m09_w4');
재기('9월 3주의 앞은 9월 2주', W.앞주차('2026_m09_w3'), '2026_m09_w2');
재기('12월 5주의 다음은 2027년 1월 1주', W.다음주차('2026_m12_w5'), '2027_m01_w1');
재기('2027년 1월 1주의 앞은 2026년 12월 5주', W.앞주차('2027_m01_w1'), '2026_m12_w5');
재기('앞으로 갔다 뒤로 오면 제자리', W.다음주차(W.앞주차('2026_m09_w3')), '2026_m09_w3');
재기('없는 주차는 null', W.앞주차('2026_m09_w9'), null);
재기('이상한 글은 null', W.다음주차('엉뚱'), null);

console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
process.exit(실패 ? 1 : 0);
