// 다시 보내기 줄 — 답 **개수**가 아니라 **내용**을 견준다.
//
// [2026-10-01 원장 지시] 「학생이 제출했는데 홈페이지에 안 보이던 문제가 이것 때문일 수 있다」
//   ⛔ 옛 판단: (줄이 제출 · 서버는 미제출) 또는 (줄의 답 개수 > 서버 답 개수) 일 때만 보냈다.
//      ⇒ 답을 **바꾸기만** 했거나 개수가 같으면 「서버가 더 새것」으로 보고 **줄을 버렸다**(2-B 브라우저 시험에서 실측).
//   이제: 내용이 하나라도 다르면 보낸다. 서버에만 있는 답은 지키고(합친다), 서버가 이미 제출됐는데
//        줄은 풀던 중이면 안 보낸다(제출을 풀던 답으로 덮지 않게) · 서버 판(rev)이 더 높으면 안 보낸다.

'use strict';
const fs = require('fs');
const html = fs.readFileSync('E:/aa0/hp/index.html', 'utf8');
let 통과 = 0, 실패 = 0;
function 재기(이름, 참, 덧) {
  if (참) { 통과++; console.log('  ✅ ' + 이름); }
  else { 실패++; console.log('  ⛔ ' + 이름 + (덧 ? '\n       ' + 덧 : '')); }
}
const i = html.indexOf('function _retryDecision(');
if (i < 0) { console.log('  ⛔ _retryDecision 이 없다'); console.log('\n셈 — 통과 0 · 실패 1'); process.exit(1); }
const 판단 = new Function(html.slice(i, html.indexOf('\n}\n', i) + 3) + '\n; return _retryDecision;')();

console.log('── 보낸다');
let d = 판단({ answers: { q0: 'B' } }, { answers: { q0: 'C' } });
재기('개수는 같고 답만 바뀜 → 보낸다(옛 판단은 버렸다)', d.push === true && d.value.answers.q0 === 'C', JSON.stringify(d));
d = 판단({ answers: { q0: 'B', q1: '6' } }, { answers: { q0: 'C' } });
재기('줄이 개수는 적어도 내용이 다르면 → 보내되 서버에만 있는 답(q1)은 지킨다', d.push && d.value.answers.q0 === 'C' && d.value.answers.q1 === '6', JSON.stringify(d));
d = 판단({ answers: { q0: 'B' } }, { answers: { q0: 'B', q1: '6' } });
재기('줄에 답이 더 있음 → 보낸다', d.push && d.value.answers.q1 === '6');
d = 판단({ answers: { q0: 'B' }, submitted: false }, { answers: { q0: 'B' }, submitted: true, rev: 1 });
재기('줄은 제출 · 서버는 미제출 → 보낸다(제출이 사라지던 경우)', d.push && d.value.submitted === true && d.value.rev === 1);
d = 판단(null, { answers: { q0: 'B' } });
재기('서버에 칸이 없음 → 보낸다', d.push && d.value.answers.q0 === 'B');
d = 판단({ answers: { q0: 'B' }, submitted: true, rev: 1 }, { answers: { q0: 'A' }, submitted: true, rev: 2 });
재기('둘 다 제출 · 줄이 더 새 판(rev 2) → 보낸다', d.push && d.value.rev === 2 && d.value.answers.q0 === 'A');
d = 판단({ answers: { q0: '5' } }, { answers: { q0: 5 } });
재기('같은 답의 글자/숫자 차이는 같은 것으로(헛 보내기 없음)', d.push === false, JSON.stringify(d));

console.log('\n── 안 보낸다');
d = 판단({ answers: { q0: 'B', q1: '6' } }, { answers: { q0: 'B', q1: '6' } });
재기('내용이 같음 → 안 보낸다', d.push === false);
d = 판단({ answers: { q0: 'B', q1: '6' }, submitted: true, rev: 1 }, { answers: { q0: 'C' }, submitted: false });
재기('서버는 이미 제출 · 줄은 풀던 중 → 안 보낸다(제출을 덮지 않는다)', d.push === false, JSON.stringify(d));
d = 판단({ answers: { q0: 'B' }, submitted: true, rev: 3 }, { answers: { q0: 'A' }, submitted: true, rev: 2 });
재기('둘 다 제출 · 서버가 더 새 판 → 안 보낸다', d.push === false);
d = 판단({ answers: { q0: 'B' }, manuallyMarked: true, submitted: true }, { answers: { q0: 'C' }, submitted: false });
재기('원장 처리된 칸은 풀던 답으로 덮지 않는다', d.push === false);

console.log('\n── TS 칸(answers 가 없는 꼴)');
d = 판단({ day1: { completed: true } }, { day1: { completed: true } });
재기('TS 칸이 같으면 안 보낸다', d.push === false);
d = 판단({ day1: { completed: true } }, { day1: { completed: true }, day2: { completed: true } });
재기('TS 칸에 줄 쪽 진도가 더 있으면 보낸다', d.push === true && d.value.day2 && d.value.day1, JSON.stringify(d));

console.log('\n── 쓰는 곳');
const 줄 = html.slice(html.indexOf('async function _flushRetryQueue() {'), html.indexOf('\n// ── Firebase Granular Write Helpers'));
재기('_flushRetryQueue 가 _retryDecision 을 쓴다', /_retryDecision\(fbVal, queueVal\)/.test(줄));
재기('옛 「개수만」 판단이 남아 있지 않다', !/queueAnsCount > fbAnsCount/.test(줄));

console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
process.exit(실패 ? 1 : 0);
