// TS 교사 화면에서 **나가는 길**이 있는가.
//
// ⛔ 원장님 2026-09-19: 「돌아가는 버튼도 있어야 하는 거 아냐?」 — 나가는 길이 없었다.
//    이 화면은 **새 창**으로 열리므로 브라우저 「뒤로」가 안 듣는다(올 데가 없다).
// ⛔⛔ 그냥 `/` 로 보내면 안 된다 — 홈페이지는 열릴 때 **무조건 익명 로그인**을 해서
//    따로 열어 둔 홈페이지 창의 **원장 로그인을 푼다.** 그래서 **창을 닫는 쪽을 먼저** 한다.

'use strict';
const fs = require('fs');
const 교 = fs.readFileSync('E:/aa0/hp/ts/index.html', 'utf8');

let 통과 = 0, 실패 = 0;
function 재기(이름, 참, 덧) {
  if (참) { 통과++; console.log('  ✅ ' + 이름); }
  else { 실패++; console.log('  ⛔ ' + 이름 + (덧 ? '\n       ' + 덧 : '')); }
}

console.log('── 나가는 길이 놓였는가');
const 길 = 교.match(/<a[^>]*class="돌아가기"[^>]*>[^<]*<\/a>/g) || [];
재기('「← 홈페이지」가 있다', 길.length >= 1, JSON.stringify(길.length));
재기('⭐ **잠금막 안에도** 있다 (막이 화면을 통째로 덮는다 — 갇히면 안 된다)',
     길.length >= 2, '찾은 것 ' + 길.length + '개');
재기('모두 `홈으로()` 를 거친다', 길.every(x => x.includes('홈으로(event)')), JSON.stringify(길));
재기('작은 글씨가 아니다', !/font-size:11px/.test(교.match(/\.돌아가기\{[^}]*\}/)?.[0] || ''));

console.log('\n── 창을 닫는 쪽을 먼저 하는가');
const i = 교.indexOf('function 홈으로(e){');
const 소스 = 교.slice(i, 교.indexOf('\n// ───', i));
const 홈으로 = new Function('history', 'window', 'document', 'location', 'confirm', 'setTimeout',
                          소스 + '\n; return 홈으로;');

function 해보기({ 뒤로갈데, 닫히나, 물음답 }) {
  const 자국 = { 닫았나: false, 간곳: null, 막았나: false, 물었나: false };
  const e = { preventDefault: () => { 자국.막았나 = true; } };
  const loc = { set href(v) { 자국.간곳 = v; }, get href() { return 자국.간곳; } };
  const 돌아온값 = 홈으로(
    { length: 뒤로갈데 ? 3 : 1 },
    { close: () => { 자국.닫았나 = true; } },
    { get hidden() { return 닫히나; } },
    loc,
    (m) => { 자국.물었나 = true; return 물음답; },
    (fn) => fn())(e);         // setTimeout 을 그 자리에서 돌린다 · 링크 눌림(e)을 넘긴다
  자국.돌아온값 = 돌아온값;
  return 자국;
}

let r = 해보기({ 뒤로갈데: false, 닫히나: true, 물음답: true });
재기('새 창이면 **창을 닫는다**', r.닫았나);
재기('그때 링크 기본 동작을 막는다', r.막았나 && r.돌아온값 === false);
재기('닫혔으면 아무 데도 안 간다 (홈페이지를 안 연다)', r.간곳 === null, String(r.간곳));
재기('닫혔으면 묻지도 않는다', !r.물었나);

console.log('\n── 브라우저가 창을 못 닫게 막을 때');
r = 해보기({ 뒤로갈데: false, 닫히나: false, 물음답: true });
재기('못 닫으면 **여쭤 본다**', r.물었나);
재기('「예」면 홈페이지로 간다', r.간곳 === '/');
r = 해보기({ 뒤로갈데: false, 닫히나: false, 물음답: false });
재기('⭐ 「취소」면 **그대로 머문다** (다른 창의 로그인을 안 푼다)', r.간곳 === null, String(r.간곳));

console.log('\n── 같은 창에서 온 경우');
r = 해보기({ 뒤로갈데: true, 닫히나: false, 물음답: true });
재기('창을 안 닫는다', !r.닫았나);
재기('링크가 그냥 듣는다 (true 를 돌려준다)', r.돌아온값 === true);
재기('묻지 않는다', !r.물었나);

console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
process.exit(실패 ? 1 : 0);
