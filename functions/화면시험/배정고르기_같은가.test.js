// [점검 10-05 F6] 서버 배정고르기 = 화면 hwLookupKey + visibleHw — 같은 아이·같은 주면 같은 숙제를 고르는가
//   + 화면 _hwSubmitFailed 가 배정 거절(NOT-ASSIGNED·NOT-PUBLISHED)을 「거절」로 다루고 답을 교사 확인 칸에 남기는가
'use strict';
const fs = require('fs');
const html = fs.readFileSync('E:/aa0/hp/index.html', 'utf8');
const H = require('../hw_submit')._internals;
let 통과 = 0, 실패 = 0;
function 재기(이름, 참, 덧) { if (참) { 통과++; console.log('  ✅ ' + 이름); } else { 실패++; console.log('  ⛔ ' + 이름 + (덧 ? '\n       ' + 덧 : '')); } }
const 떼기 = (a, b) => { const i = html.indexOf(a); if (i < 0) throw new Error('못 찾음: ' + a); const j = html.indexOf(b, i + 10); return html.slice(i, j) + b; };

const 화면 = new Function('window',
  떼기('function hwKey(yearLevel, country, p, group) {', '\n}\n') +
  떼기('function hwLookup(store, yearLevel, country, p, group) {', '\n}\n') +
  떼기('function hwLookupKey(store, yearLevel, country, p, group) {', '\n}\n') +
  떼기('function visibleHw(hw) {', '\n}\n') +
  '; return { hwKey, hwLookup, hwLookupKey, visibleHw };')({ isPreviewMode: false });

console.log('── 화면과 서버가 같은 숙제를 고르는가(경우 묶음 전부)');
const p = { year: 2026, month: 10, week: 2 };
const 사람들 = [
  { year: 5, country: 'AU', group: '' }, { year: 5, country: 'AU', group: '션' }, { year: 5, group: 'A' },
  { year: 7, country: 'NZ', group: '민준' }, { year: 5, country: 'KR', group: '' },
];
const 칸꼴 = [null, { sets: [{ q: 1 }] }, { sets: [{ q: 1 }], published: true }, { sets: [{ q: 1 }], published: false },
  { published: true, sets: [], _placeholder: true }];
let 경우 = 0, 어긋남 = [];
for (const 사람 of 사람들) for (const 반칸 of 칸꼴) for (const 공통칸 of 칸꼴) for (const 남의칸 of [null, { sets: [1] }]) {
  const 후보 = H.배정후보(사람, p);
  const homeworkSets = {};
  if (후보.반 && 반칸) homeworkSets[후보.반] = 반칸;
  if (공통칸) homeworkSets[후보.공통] = 공통칸;
  if (남의칸) homeworkSets['AU_y5-다른반_2026_m10_w2'] = 남의칸;
  const store = { homeworkSets };
  // 화면: 아이에게 보이는 숙제 열쇠(안 보이면 null) · 비공개 칸이면 그 열쇠
  const c = 사람.country || 'AU';
  const 열쇠 = 화면.hwLookupKey(store, 사람.year, c, p, 사람.group);
  const 보임 = 화면.visibleHw(화면.hwLookup(store, 사람.year, c, p, 사람.group));
  const 화면답 = !열쇠 ? 'NO-HW' : (보임 ? 'OK:' + 열쇠 : 'HIDDEN:' + 열쇠);
  const 서버 = H.배정고르기(사람, p, (k) => ({ exists: !!homeworkSets[k], published: homeworkSets[k] ? homeworkSets[k].published : null }));
  const 서버답 = !서버.key ? 'NO-HW' : (서버.why ? 'HIDDEN:' + 서버.key : 'OK:' + 서버.key);
  경우++;
  if (화면답 !== 서버답) 어긋남.push(JSON.stringify({ 사람, 반칸, 공통칸, 화면답, 서버답 }));
  // 화면이 보여 주는 열쇠는 서버가 받고, 그 밖의 열쇠는 거절
  if (보임 && H.배정판정(서버, 열쇠) !== null) 어긋남.push('보이는데 거절: ' + 열쇠);
  for (const 남 of ['AU_y5-다른반_2026_m10_w2', 후보.공통, 후보.반].filter(Boolean)) {
    if (남 !== 열쇠 && H.배정판정(서버, 남) !== 'NOT-ASSIGNED') 어긋남.push('남의 열쇠를 받음: ' + 남 + ' (고른 것 ' + 열쇠 + ')');
  }
  if (열쇠 && !보임 && H.배정판정(서버, 열쇠) !== 'NOT-PUBLISHED') 어긋남.push('비공개를 받음: ' + 열쇠);
}
재기('경우 ' + 경우 + '개 — 어긋남 0', 어긋남.length === 0, 어긋남.slice(0, 5).join('\n       '));
재기('반 칸막이가 있으면 공통 숙제를 안 받는다', (() => {
  const 사람 = { year: 5, country: 'AU', group: '션' }, 후보 = H.배정후보(사람, p);
  const hs = { [후보.반]: { published: true, sets: [], _placeholder: true }, [후보.공통]: { sets: [1] } };
  const g = H.배정고르기(사람, p, (k) => ({ exists: !!hs[k], published: hs[k] && hs[k].published }));
  return g.key === 후보.반 && H.배정판정(g, 후보.공통) === 'NOT-ASSIGNED';
})());
재기('기본은 「기록만」(ASSIGN_ENFORCE=false) — 3일 지켜본 뒤 켠다', /const ASSIGN_ENFORCE = false;/.test(fs.readFileSync(require('path').join(__dirname, '..', 'hw_submit.js'), 'utf8')));

console.log('\n── 화면 — 배정 거절은 「거절」로(줄에 계속 남기지 않고 답을 교사 확인에)');
{
  const src = 떼기('function _hwSubmitFailed(줄열쇠, e) {', '\n}\n');
  const 기록 = [];
  const 저장소 = { k1: JSON.stringify({ op: 'hwSubmit', data: { key: 'Mina_2026_m10_w2_s0', answers: { q0: 'B' } } }) };
  const 값 = {
    _notifySaveWaiting: () => 기록.push('대기'), showBackupToast: (m) => 기록.push('알림:' + m),
    _retryConflictNote: (path, why, v) => { 기록.push('확인:' + path + '=' + v + why); return Promise.resolve(); },
    localStorage: { getItem: (k) => 저장소[k], removeItem: (k) => { delete 저장소[k]; 기록.push('지움:' + k); } },
    console: { error() {}, warn() {}, log() {} },
  };
  const 이름 = Object.keys(값);
  const f = new Function(...이름, src + '; return _hwSubmitFailed;')(...이름.map(k => 값[k]));
  const 끝 = f('k1', Object.assign(new Error('NOT-ASSIGNED'), { code: 'functions/permission-denied' }));
  await_(() => {
    재기('「거절」로 다룬다(dropped)', 끝 === 'dropped');
    재기('아이 알림은 쉬운 말(숙제가 바뀌었거나 닫혔어요)', 기록.some(x => x.startsWith('알림:') && /숙제가 바뀌었거나 닫혔어요/.test(x)), 기록.join(' | '));
    재기('답은 교사 확인 칸에 남기고 · 그다음 줄에서 지운다', 기록.some(x => x.includes('확인:submissions/Mina_2026_m10_w2_s0/answers/q0=B') && x.includes('NOT-ASSIGNED')) && 기록.indexOf('지움:k1') > 기록.findIndex(x => x.startsWith('확인:')), 기록.join(' | '));
    const 둘 = [];
    const g = new Function(...이름, src + '; return _hwSubmitFailed;')(...이름.map(k => k === 'showBackupToast' ? (m) => 둘.push(m) : 값[k]));
    g(null, Object.assign(new Error('BAD-INPUT:key'), { code: 'functions/invalid-argument' }));
    재기('다른 거절은 예전 문구 그대로', 둘.length === 1 && /서버가 받지 않았습니다\(functions\/invalid-argument\)/.test(둘[0]), 둘.join());
    재기('새로 풀기 실패도 배정 거절이면 「인터넷」 탓을 하지 않는다', /NOT-ASSIGNED\|NOT-PUBLISHED\/\.test[\s\S]{0,200}지금 시작할 수 없어요/.test(떼기('function startFreshSet(idx) {', '\n}\n')));
    console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
    process.exit(실패 ? 1 : 0);
  });
}
function await_(f) { setTimeout(f, 20); }
