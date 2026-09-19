// ts_빈칸.test.js — **반 빈 칸** 규칙이 홈페이지와 같은가. (2026-09-20)
//
//   node functions/ts_빈칸.test.js
//
// 왜 이 시험이 있나
//   공통 칸(반 이름 없는 칸)은 **반 칸이 없는 아이들이 다 같이 본다.**
//   홈페이지는 공통 칸을 세울 때 반 아이들의 **빈 칸**을 함께 세워 그것을 막는다.
//   승인 함수가 그 규칙을 몰라서 —
//     ㉠ 멀쩡한 승인이 「2명이 봅니다」로 막히고
//     ㉡ 문을 열면 다른 반 아이가 그 TS 를 **진짜로 받는다**
//
// ⛔⛔ 규칙을 여기에 **베껴 적지 않는다.** 베끼면 둘이 갈라져도 시험은 ✅ 를 낸다.
//     `index.html` 에서 함수를 **떼어 내** 맞댄다(`ts_approval.test.js` 가 hwKey 에 쓴 방법).

'use strict';
const fs = require('fs');
const { _속 } = require('./ts_approval');

const HTML = 'E:/aa0/hp/index.html';
const html = fs.readFileSync(HTML, 'utf8');

let 통과 = 0, 실패 = 0;
function 재기(이름, 얻은, 바란) {
  const a = JSON.stringify(얻은), b = JSON.stringify(바란);
  if (a === b) { 통과++; console.log('  ✅ ' + 이름); }
  else { 실패++; console.log('  ⛔ ' + 이름 + '\n       얻은 ' + a + '\n       바란 ' + b); }
}
function 참이어야(이름, 값) { 재기(이름, !!값, true); }

/** `index.html` 에서 함수 하나를 **글자 그대로** 떼어 낸다(중괄호를 세어 끝을 찾는다). */
function 떼기(이름) {
  const i = html.indexOf('function ' + 이름 + '(');
  if (i < 0) throw new Error('index.html 에서 못 찾았다: ' + 이름);
  let 깊이 = 0, 열었나 = false, j = i;
  for (; j < html.length; j++) {
    const c = html[j];
    if (c === '{') { 깊이++; 열었나 = true; }
    else if (c === '}') { 깊이--; if (열었나 && 깊이 === 0) { j++; break; } }
  }
  return html.slice(i, j);
}
function 불러오기(이름, 고치기) {
  let src = 떼기(이름);
  if (고치기) src = 고치기(src);
  return new Function(src + '\n; return ' + 이름 + ';')();
}

// ═════════════ ① 반 이름 정리 — sanitizeGroup 과 같은가 ═════════════
console.log('── ① 반 이름 정리 (index.html 의 sanitizeGroup)');
const sanitizeGroup = 불러오기('sanitizeGroup');
for (const v of ['션', ' 션 ', '키이라', 'A', '', null, undefined, '민  준', '가_나',
                 '탭\t끼움', '줄\n바꿈', '아주아주아주아주아주아주아주긴반이름입니다', 12]) {
  재기('반정리(' + JSON.stringify(v) + ')', _속.반정리(v), sanitizeGroup(v));
}
// ⛔ 옛 코드는 `.trim()` 만 했다. 그것으로는 못 잡는 것이 실제로 있는가?
참이어야('`.trim()` 만으로는 모자란 경우가 있다',
        ['가_나', '민  준', '탭\t끼움'].some(v => String(v).trim() !== sanitizeGroup(v)));

// ═════════════ ② 주차 비교 — periodGte 와 같은가 ═════════════
console.log('\n── ② 주차 비교 (index.html 의 periodGte)');
const periodGte = 불러오기('periodGte');
let 주차틀림 = 0, 주차셈 = 0;
for (const ay of [2025, 2026, 2027]) for (const am of [1, 9, 12]) for (const aw of [1, 4, 5])
  for (const by of [2025, 2026, 2027]) for (const bm of [1, 9, 12]) for (const bw of [1, 4, 5]) {
    주차셈++;
    const a = { year: ay, month: am, week: aw }, b = { year: by, month: bm, week: bw };
    if (_속.주차크거나같나(a, b) !== periodGte(a, b)) 주차틀림++;
  }
재기(`주차 비교 ${주차셈}짝이 다 같다`, 주차틀림, 0);

// ═════════════ ③ 오늘 주차 — getTodayPeriod 와 같은가 (두 해치 날마다) ═════════════
console.log('\n── ③ 오늘 주차 (index.html 의 getTodayPeriod · ISO 8601)');
// 원본은 날짜를 못 받는다. **그 한 줄만** 갈아 끼워 날마다 잰다.
//   ⛔ 이 줄이 바뀌면 시험이 큰 소리로 멈춘다 — 조용히 안 재고 넘어가면 안 된다.
const 바꿀줄 = '  const today = new Date();';
if (html.indexOf(바꿀줄) < 0) { console.log('  ⛔ getTodayPeriod 의 첫 줄이 바뀌었다 — 시험을 고칠 것'); 실패++; }
const getTodayPeriod = 불러오기('getTodayPeriod',
  s => s.replace(바꿀줄, '  const today = arguments[0] || new Date();'));

// ⛔ **낮 12시로만 재면 시간대 흠을 못 잡는다.** 시드니 아침 9시는 UTC 로 아직 **어제**다
//    (원장님이 실제로 일하시는 시각이 아침이다). 그래서 두 시각으로 잰다.
for (const [때, 시, 분] of [['낮 12시', 12, 0], ['아침 9시(UTC 로는 어제)', 9, 0]]) {
  let 날틀림 = 0, 날셈 = 0, 첫틀림 = null;
  for (let t = Date.UTC(2026, 0, 1); t <= Date.UTC(2027, 11, 31); t += 86400000) {
    const u = new Date(t);
    const 그날 = new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate(), 시, 분, 0);
    날셈++;
    const a = _속.오늘주차(그날), b = getTodayPeriod(그날);
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      날틀림++;
      if (!첫틀림) 첫틀림 = { 날: 그날.toString().slice(0, 24), 서버: a, 홈페이지: b };
    }
  }
  재기(`${때} — ${날셈}일이 다 같다 (2026-01-01 ~ 2027-12-31)`, 날틀림, 0);
  if (첫틀림) console.log('       처음 갈린 날: ' + JSON.stringify(첫틀림));
}
console.log('       오늘 = ' + JSON.stringify(_속.오늘주차()) +
            ' (시드니 ' + JSON.stringify(_속.시드니날짜(new Date())) + ')');

// ═════════════ ④ 빈 칸 값이 홈페이지가 세우는 것과 글자까지 같은가 ═════════════
console.log('\n── ④ 빈 칸 값 (index.html `_ensureGroupPlaceholders` 의 ph)');
{
  const i = html.indexOf('const ph = {');
  const j = html.indexOf('\n      };', i);
  if (i < 0 || j < 0) { console.log('  ⛔ index.html 에서 ph 를 못 찾았다'); 실패++; }
  else {
    const 만들기 = new Function('m', 's', 'grp', 'p',
      html.slice(i, j + 9) + '\n; return ph;');
    const p = { year: 2026, month: 9, week: 4 };
    const ph = 만들기({ country: 'AU' }, { year: 4 }, '션', p);
    재기('빈칸값이 홈페이지의 ph 와 같다', _속.빈칸값('AU', 4, '션', p), ph);
  }
}

// ═════════════ ⑤ 좁혀 읽는 범위가 필요한 칸을 다 담는가 ═════════════
// ⛔ 「열쇠만 쓰는데 10.5MB 를 통째로」 읽지 않으려고 앞자리로 좁혔다(2026-09-20 실측).
//    좁히다가 **필요한 칸을 빠뜨리면** 그 아이가 칸을 안 가진 것으로 보여 빈 칸을 헛세운다.
console.log('\n── ⑤ 좁혀 읽기 범위 (orderByKey 와 같은 셈)');
{
  const 담아야 = ['AU_y4_2026_m09_w4', 'AU_y4-션_2026_m09_w4', 'AU_y4-A_2026_m12_w1',
                 'AU_y4_2027_m01_w5', 'AU_y4-아주긴반이름_2026_m09_w4'];
  const 빠져야 = ['AU_y5_2026_m09_w4', 'AU_y5-키이라_2026_m09_w3', 'NZ_y4_2026_m09_w4',
                 'AU_y3_2026_m09_w4'];
  재기('AU_y4 범위가 담아야 할 칸을 다 담는다',
       담아야.filter(k => !_속.범위안인가(k, 'AU_y4')), []);
  재기('AU_y4 범위가 남의 칸을 안 담는다',
       빠져야.filter(k => _속.범위안인가(k, 'AU_y4')), []);
  // ⚠️ 앞자리라 한 자리 학년은 두 자리 학년을 **넉넉히** 담는다. 알고 두는 것이다.
  참이어야('AU_y1 이 AU_y10 을 넉넉히 담는 것은 알고 있다(셈은 안 틀린다)',
          _속.범위안인가('AU_y10_2026_m09_w4', 'AU_y1'));
}

// ═════════════ ⑥ 규칙 넷 — 진짜 명부 꼴로 ═════════════
console.log('\n── ⑥ 규칙 넷 (하경 · 션 · 시험계정 t4 — 2026-09-20 실측한 명부 꼴)');

const 미래 = 'AU_y4_2026_m12_w1';          // 먼 미래 주차(계획서가 정한 시험 자리)
const 미래반 = 'AU_y4-션_2026_m12_w1';
const 과거 = 'AU_y4_2026_m01_w1';

const 명부 = [
  { id: 'Hayley04', role: 'student', year: 4, country: 'AU', group: '',  status: 'active' },
  { id: 'Sean05',   role: 'student', year: 4, country: 'AU', group: '션', status: 'active' },
  { id: 't4',       role: 'student', year: 4, country: 'AU', group: '',  status: 'active', isTest: true },
  { id: 'Keira05',  role: 'student', year: 5, country: 'AU', group: '키이라', status: 'active' },
];

/** 서버 없이 재려고 **가짜 읽기**를 끼운다. 자료는 평범한 객체 하나다. */
function 읽개(자료) {
  return async (경로) => {
    const 조각 = 경로.split('/');
    let v = 자료;
    for (const c of 조각) { if (v == null || typeof v !== 'object') return null; v = v[c]; }
    return v === undefined ? null : v;
  };
}
function 마당({ 칸열쇠 = [], 제출 = {}, 명부: us = 명부 } = {}) {
  const hw = {}; for (const k of 칸열쇠) hw[k] = { sets: [] };
  return { solomon_hw_v3: { users: us, homeworkSets: hw, submissions: 제출 } };
}
const 칸이름만 = a => (a || []).map(x => x.칸);

async function 볼것(이름, 마당자료, 하기) {
  _속.읽기바꾸기(읽개(마당자료));
  try { await 하기(); } finally { _속.읽기바꾸기(null); }
}

(async () => {
  // ─ ㉠ 아무것도 없는 미래 주차 — 션의 빈 칸을 세워야 한다
  await 볼것('기본', 마당(), async () => {
    const 계획 = await _속.세울빈칸들(미래, [], 명부);
    재기('공통 칸을 세우면 션의 빈 칸이 딸려 나온다', 칸이름만(계획.칸들), [미래반]);

    const 가상 = await _속.수신자확인(미래, 'Hayley04');
    재기('고친 뒤 — 하경 승인이 통과한다', { ok: 가상.ok, 받는이: 가상.받는이 },
         { ok: true, 받는이: ['Hayley04'] });

    // ⛔ 이것이 **고치기 전의 모습**이다. 빈 칸을 안 세우면 션이 딸려 온다.
    const 진짜 = await _속.수신자확인(미래, 'Hayley04', { 가상: false });
    재기('빈 칸을 안 세우면 2명이 본다(= 옛 흠)',
         { ok: 진짜.ok, 받는이: 진짜.받는이 }, { ok: false, 받는이: ['Hayley04', 'Sean05'] });
  });

  // ─ ㉡ 규칙 ① 반 칸을 승인할 때는 빈 칸을 안 세운다
  await 볼것('반칸', 마당(), async () => {
    const 계획 = await _속.세울빈칸들(미래반, [], 명부);
    재기('규칙① 반 칸이면 세울 것이 없다', 칸이름만(계획.칸들), []);
    const r = await _속.수신자확인(미래반, 'Sean05');
    재기('규칙① 션의 반 칸 승인은 그대로 통과', { ok: r.ok, 받는이: r.받는이 },
         { ok: true, 받는이: ['Sean05'] });
  });

  // ─ ㉢ 규칙 ② 지난 주차는 손대지 않는다 → 그러면 **막혀야 한다**(새 나가면 안 된다)
  await 볼것('지난주', 마당(), async () => {
    const 계획 = await _속.세울빈칸들(과거, [], 명부);
    재기('규칙② 지난 주차는 빈 칸을 안 세운다', 칸이름만(계획.칸들), []);
    const r = await _속.수신자확인(과거, 'Hayley04');
    재기('규칙② 지난 주차는 승인이 막힌다', r.ok, false);
    참이어야('규칙② 막는 말에 까닭이 붙는다', /지난 주차/.test(r.까닭 || ''));
  });

  // ─ ㉣ 규칙 ③ 그 주에 푼 흔적이 있으면 그 아이 칸은 안 건드린다
  for (const [무엇, 제출] of [
    ['TS 를 냈다',      { 'ts_Sean05_2026_m12_w1': { answers: { 0: 'A' } } }],
    ['수학 답이 있다',  { 'Sean05_2026_m12_w1_s0': { answers: { 0: 'B' } } }],
    ['수학을 제출했다', { 'Sean05_2026_m12_w1_s3': { submitted: true } }],
  ]) {
    await 볼것('푼흔적', 마당({ 제출 }), async () => {
      const 계획 = await _속.세울빈칸들(미래, [], 명부);
      재기(`규칙③ 션이 ${무엇} → 빈 칸을 안 세운다`, 칸이름만(계획.칸들), []);
      const r = await _속.수신자확인(미래, 'Hayley04');
      재기(`규칙③ 션이 ${무엇} → 승인이 막힌다(새 나가지 않는다)`, r.ok, false);
    });
  }
  // 빈 제출 껍데기는 「푼 것」이 아니다
  await 볼것('빈껍데기', 마당({ 제출: { 'Sean05_2026_m12_w1_s0': { answers: {} } } }), async () => {
    const 계획 = await _속.세울빈칸들(미래, [], 명부);
    재기('규칙③ 답이 0개인 껍데기는 푼 것이 아니다', 칸이름만(계획.칸들), [미래반]);
  });

  // ─ ㉤ 규칙 ④ 반 칸이 이미 있으면 건너뛴다
  await 볼것('이미있음', 마당({ 칸열쇠: [미래반] }), async () => {
    const 계획 = await _속.세울빈칸들(미래, [미래반], 명부);
    재기('규칙④ 반 칸이 이미 있으면 안 세운다', 칸이름만(계획.칸들), []);
    const r = await _속.수신자확인(미래, 'Hayley04', { 가상: false });
    재기('규칙④ 그때는 진짜 상태로도 통과한다', { ok: r.ok, 받는이: r.받는이 },
         { ok: true, 받는이: ['Hayley04'] });
  });

  // ─ ㉥ 쉬는 아이·시험 계정은 빈 칸을 안 세운다
  await 볼것('쉬는아이', 마당({
    명부: 명부.concat([
      { id: '쉬는아이', role: 'student', year: 4, country: 'AU', group: '쉼', status: 'inactive' },
      { id: '시험아이', role: 'student', year: 4, country: 'AU', group: '시험', isTest: true, status: 'active' },
    ])
  }), async () => {
    const 계획 = await _속.세울빈칸들(미래, [], 명부.concat([
      { id: '쉬는아이', role: 'student', year: 4, country: 'AU', group: '쉼', status: 'inactive' },
      { id: '시험아이', role: 'student', year: 4, country: 'AU', group: '시험', isTest: true, status: 'active' },
    ]));
    재기('쉬는 아이·시험 계정 몫은 안 세운다', 칸이름만(계획.칸들), [미래반]);
  });

  // ─ ㉦ 반 이름에 빈칸이 섞여도 홈페이지와 **같은 칸**을 센다
  await 볼것('빈칸섞인반이름', 마당(), async () => {
    const us = [
      { id: 'Hayley04', role: 'student', year: 4, country: 'AU', group: '', status: 'active' },
      { id: 'Sean05', role: 'student', year: 4, country: 'AU', group: ' 션 ', status: 'active' },
    ];
    const 계획 = await _속.세울빈칸들(미래, [], us);
    재기('반 이름의 앞뒤 빈칸을 홈페이지처럼 다듬는다', 칸이름만(계획.칸들), [미래반]);
  });

  // ─ ㉧ 다른 학년은 건드리지 않는다
  await 볼것('다른학년', 마당(), async () => {
    const 계획 = await _속.세울빈칸들(미래, [], 명부);
    참이어야('Y5 키이라 칸은 안 세운다', !칸이름만(계획.칸들).some(k => k.includes('y5')));
  });

  // ─ ㉨ 시험 학생 둘이면 막힌다 (계획서 §2 의 계약이 안 깨졌나)
  await 볼것('시험학생둘', 마당(), async () => {
    const us = 명부.concat([{ id: 't4b', role: 'student', year: 4, country: 'AU', group: '', status: 'active', isTest: true }]);
    _속.읽기바꾸기(읽개(마당({ 명부: us })));
    const r = await _속.수신자확인(미래, 't4');
    재기('시험 학생이 둘이면 막힌다', r.ok, false);
  });

  console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
  process.exit(실패 ? 1 : 0);
})().catch(e => { console.error('시험이 터졌다:', e); process.exit(1); });
