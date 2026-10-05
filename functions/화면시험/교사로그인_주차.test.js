// 교사 로그인 직후 「이번 주」 쓰기 (2026-10-05 원장님 실측)
//
//   뿌리(15MB)가 7초 안에 안 오면 서랍으로 먼저 연다. 그때 바로 fbSetPeriod 를 부르면
//   fbReady=false 라 실패 → 빨간 띠 · 늦게 온 서버 값이 옛 주차로 화면을 되돌린다.
//   ⇒ fbReady 면 바로 쓰고, 아니면 _fbReady뒤에 로 미룬다.
'use strict';
const fs = require('fs');
const html = fs.readFileSync('E:/aa0/hp/index.html', 'utf8');
let 통과 = 0, 실패 = 0;
function 재기(이름, 참, 덧) { if (참) { 통과++; console.log('  ✅ ' + 이름); } else { 실패++; console.log('  ⛔ ' + 이름 + (덧 ? '\n       ' + 덧 : '')); } }
const 떼기 = (a, b) => { const i = html.indexOf(a); if (i < 0) throw new Error('못 찾음: ' + a); const j = html.indexOf(b, i + 10); return html.slice(i, j); };

console.log('── 로그인 길');
{
  const 길 = 떼기('await window._loadFull();', 'await prepLoadTeacher();');
  재기('fbReady 일 때만 바로 쓴다', /if \(window\.fbReady\) fbSetPeriod\(todayPeriod\);/.test(길));
  재기('아니면 _fbReady뒤에 로 미룬다', /else _fbReady뒤에\(/.test(길));
  재기('미룬 쓰기 = 서랍 주차도 다시 맞추고 다시 그린다', /s\.currentPeriod = todayPeriod;[\s\S]*saveStore\(s\);[\s\S]*fbSetPeriod\(todayPeriod\);[\s\S]*renderTeacher\(\);/.test(길));
  재기('미룬 사이 교사가 아니게 되면 쓰지 않는다', /currentUser\.role !== 'teacher'\) return;/.test(길));
  const 맨쓰기 = 길.replace(/if \(window\.fbReady\) fbSetPeriod\(todayPeriod\);/, '').replace(/_fbReady뒤에\([\s\S]*\}\);/, '');
  재기('조건 없는 fbSetPeriod 가 남지 않았다', !/fbSetPeriod\(/.test(맨쓰기), 맨쓰기);
}

console.log('\n── _fbReady뒤에 를 실제로 돌린다');
const 몸 = 떼기('function _fbReady뒤에(fn) {', '\n}\n') + '\n}\n';
function 만들기(창) { return new Function('window', 'setTimeout', 'console', 몸 + '; return _fbReady뒤에;'); }
(async () => {
  // ① 이미 준비됨 → 바로 한 번
  {
    const w = { fbReady: true, FB_REF: {} };
    let n = 0;
    만들기()(w, setTimeout, console)(() => n++);
    재기('준비돼 있으면 바로 한 번', n === 1);
  }
  // ② 늦게 준비됨 → 준비된 뒤 한 번만
  {
    const w = { fbReady: false, FB_REF: null };
    let n = 0;
    만들기()(w, setTimeout, console)(() => n++);
    await new Promise(r => setTimeout(r, 700));
    재기('준비 전에는 안 부른다', n === 0);
    w.fbReady = true; w.FB_REF = {};
    await new Promise(r => setTimeout(r, 1200));
    재기('준비된 뒤 한 번만', n === 1, 'n=' + n);
  }
  // ③ 2분 넘게 안 옴 → 안 부른다(가짜 시계)
  {
    const w = { fbReady: false, FB_REF: null };
    let n = 0, 시각 = 0;
    const 가짜 = (f) => { 시각 += 500; if (시각 < 130000) f(); };
    const 진짜Now = Date.now; const 시작 = 진짜Now();
    Date.now = () => 시작 + 시각;
    try { 만들기()(w, 가짜, { warn() {} })(() => n++); } finally { Date.now = 진짜Now; }
    재기('2분 넘게 안 오면 쓰지 않는다', n === 0);
  }
  console.log('\n── 셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
  process.exit(실패 ? 1 : 0);
})();
