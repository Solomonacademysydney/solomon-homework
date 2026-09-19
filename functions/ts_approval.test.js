// ts_approval.test.js — 승인 함수의 **셈하는 부분**을 잰다(서버 없이).
//
//   node functions/ts_approval.test.js
//
// 여기서 재는 것
//   ① 칸 이름이 홈페이지의 `hwKey` 와 **글자까지 같은가** — 다르면 엉뚱한 칸에 숙제가 간다
//   ② 초안 검사가 **심은 흠을 실제로 무는가** — 흠마다 「이 흠이 아이에게 무엇을 하는가」를 적었다
//   ③ 해시가 **본문을 한 글자 바꾸면 달라지는가**
//
// ⛔ 서버가 필요한 것(잠금 transaction · 멱등 · 되돌림)은 여기서 못 잰다.
//    그건 에뮬레이터(자바 필요)에서 열다섯 사례로 재야 한다.

'use strict';
const fs = require('fs');
const H = require('./ts_hash');
const { _속 } = require('./ts_approval');

let 통과 = 0, 실패 = 0;
function 재기(이름, 얻은, 바란) {
  const a = JSON.stringify(얻은), b = JSON.stringify(바란);
  if (a === b) { 통과++; console.log('  ✅ ' + 이름); }
  else { 실패++; console.log('  ⛔ ' + 이름 + '\n       얻은 ' + a + '\n       바란 ' + b); }
}
function 문다(이름, 초안, 무는말) {
  const 탈 = _속.초안검사(초안);
  const 물었나 = 탈.some(t => t.includes(무는말));
  if (물었나) { 통과++; console.log('  ✅ ' + 이름); }
  else { 실패++; console.log('  ⛔ ' + 이름 + ' — 「' + 무는말 + '」 를 못 물었다\n       나온 말: ' + JSON.stringify(탈)); }
}

// ───────── ① 칸 이름이 홈페이지와 같은가 ─────────
console.log('── 칸 이름 (index.html 의 hwKey 를 파일에서 떼어 내 맞댄다)');
const html = fs.readFileSync('E:/aa0/hp/index.html', 'utf8');
const i = html.indexOf('function hwKey(');
const hwKey = new Function(html.slice(i, html.indexOf('\n}', i) + 2) + '; return hwKey;')();

const 경우 = [
  [4, 'AU', { year: 2026, month: 9, week: 4 }, ''],
  [4, 'AU', { year: 2026, month: 9, week: 4 }, '션'],
  [5, 'AU', { year: 2026, month: 12, week: 1 }, '키이라'],
  [3, 'AU', { year: 2027, month: 1, week: 5 }, ''],
];
for (const [y, c, p, g] of 경우) {
  재기(`hwKey(${y},${c},${p.month}월 ${p.week}주,${g || '반없음'})`,
       _속.칸이름(y, c, p, g), hwKey(y, c, p, g));
}
재기('칸 풀기는 되돌린다', _속.칸풀기('AU_y4-션_2026_m09_w4'),
     { country: 'AU', year: 4, group: '션', period: { year: 2026, month: 9, week: 4 } });
재기('주차 풀기', _속.주차풀기('2026_m09_w4'), { year: 2026, month: 9, week: 4 });

// ───────── ② 초안 검사가 흠을 무는가 ─────────
// ⛔ 흠마다 **이 흠이 아이에게 무엇을 하는가**를 먼저 적는다. 안 적으면
//    「자가 통과했다」와 「흠이 없다」를 못 가른다.
function 성한초안(고치기) {
  const q = (n) => ({
    num: n, set: 'T-D1', type: 'Symbol switching', taxonomy_id: 'TS.symbol-switching.L2',
    _item_id: 'ts-x-' + n, text: '문항 ' + n + ' 의 지문입니다.',
    options: ['가', '나', '다', '라'], answer: 'B',
    _label_to_id: { A: 'opt-a', B: 'opt-b', C: 'opt-c', D: 'opt-d' },
    explanation: '해설', hint1: '힌트1', hint2: '힌트2', figure: ''
  });
  const d = {
    subject: 'TS', student: 'Hayley04', 배정주차: '2026_m09_w4', 칸: 'AU_y4_2026_m09_w4',
    revision: 1, release: 'r2026-09-19',
    ts: { enabled: true, day_config: { total_days: 2, questions_per_day: 2 },
          questions: [q(1), q(2), q(3), q(4)] },
    manifest: [1, 2, 3, 4].map((n, i) => ({ i, item_id: 'ts-x-' + n, answer: 'B' }))
  };
  if (고치기) 고치기(d);
  return d;
}

console.log('\n── 성한 초안은 통과해야 한다');
재기('걸린 것 없음', _속.초안검사(성한초안()), []);

console.log('\n── 심은 흠을 무는가');
문다('일수가 0 — 아이가 받을 숙제가 0일이 된다',
     성한초안(d => { d.ts.day_config.total_days = 0; }), '일수가 양의 정수가');
문다('총수가 안 맞는다 — 마지막 날이 빈다',
     성한초안(d => { d.ts.questions.pop(); }), '일수×하루문항');
문다('빈 지문 — 아이가 물음 없이 보기만 본다',
     성한초안(d => { d.ts.questions[1].text = '   '; }), '지문이 없습니다');
문다('같은 문항이 두 번 — 한 주에 같은 걸 두 번 푼다',
     성한초안(d => { d.ts.questions[2]._item_id = 'ts-x-1'; }), '앞과 같은 문항');
문다('빈 보기 — 고를 수 없는 칸이 생긴다',
     성한초안(d => { d.ts.questions[0].options[2] = ''; }), '빈 보기');
문다('정답이 보기 밖 — 아이가 무엇을 골라도 틀린다',
     성한초안(d => { d.ts.questions[0].answer = 'E'; d.ts.questions[0]._label_to_id.E = 'opt-e'; }),
     '보기 4개 밖');
문다('지도에 정답 글자가 없다 — 어느 보기가 정답인지 모른다',
     성한초안(d => { delete d.ts.questions[0]._label_to_id.B; }), '_label_to_id 에 B');
문다('지도 칸 수가 보기와 다르다 — 섞은 지도가 깨졌다',
     성한초안(d => { delete d.ts.questions[0]._label_to_id.D; d.ts.questions[0].answer = 'A'; }),
     '_label_to_id');
문다('그림이 이름표로 남았다 — 학생 화면에 그림이 안 뜬다',
     성한초안(d => { d.ts.questions[0].figure = '§fig:abc123'; }), '이름표로 남아');
문다('manifest 와 본문의 문항이 다르다 — 검증이 딴 것을 본다',
     성한초안(d => { d.manifest[2].item_id = 'ts-다른것'; }), 'manifest 는');
문다('manifest 와 본문의 정답이 다르다 — 채점이 어긋난다',
     성한초안(d => { d.manifest[1].answer = 'C'; }), 'manifest 정답');
문다('manifest 줄 수가 모자라다',
     성한초안(d => { d.manifest.pop(); }), 'manifest 3줄');

// ───────── ③ 해시가 본문을 따라가는가 ─────────
console.log('\n── 해시는 본문 한 글자에도 달라져야 한다');
const meta = { subject: 'TS', student: 'Hayley04', 배정주차: '2026_m09_w4',
               칸: 'AU_y4_2026_m09_w4', revision: 1, release: 'r2026-09-19' };
const 바탕 = 성한초안();
const h0 = H.sha(H.묶음만들기(meta, 바탕.ts));
const 같은것 = H.sha(H.묶음만들기(meta, 성한초안().ts));
재기('같은 본문 → 같은 해시', 같은것, h0);

const 달라야 = [
  ['지문 한 글자', d => { d.ts.questions[0].text += '.'; }],
  ['보기 차례', d => { const o = d.ts.questions[0].options; [o[0], o[1]] = [o[1], o[0]]; }],
  ['정답 글자', d => { d.ts.questions[0].answer = 'C'; }],
  ['섞은 지도', d => { d.ts.questions[0]._label_to_id.B = 'opt-c'; }],
  ['해설', d => { d.ts.questions[0].explanation += '!'; }],
  ['그림', d => { d.ts.questions[0].figure = '<svg/>'; }],
  ['일수', d => { d.ts.day_config.total_days = 3; }],
];
for (const [이름, 고치기] of 달라야) {
  const h = H.sha(H.묶음만들기(meta, 성한초안(고치기).ts));
  if (h !== h0) { 통과++; console.log('  ✅ ' + 이름 + ' 를 바꾸면 해시가 달라진다'); }
  else { 실패++; console.log('  ⛔ ' + 이름 + ' 를 바꿨는데 해시가 그대로다'); }
}
// 해시에 **안 드는** 것 — 이건 달라지면 안 된다(고쳐도 승인이 안 깨져야 하는 것들)
const h한글 = H.sha(H.묶음만들기(meta, 성한초안(d => { d.ts.questions[0].type = '기호 바꾸기'; }).ts));
재기('화면에 보이는 이름은 해시에 안 든다', h한글, h0);

console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
process.exit(실패 ? 1 : 0);
