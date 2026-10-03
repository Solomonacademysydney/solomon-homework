// 제출·새로 풀기 서버(functions/hw_submit.js) — 한 동작으로 · 답을 덮지 않는다 · 화면과 같은 리포트 (정비 §5-①②⑤ · 2026-10-03)
//
// 지키는 것
//   ① 오래 열린 창의 옛 답이 다른 창의 새 답을 덮지 않는다(점검 R6) — 서버 답 기준 · 이 기기가 전에 보낸 값만 갈아 끼운다
//   ② 새로 풀기는 서버 칸 그대로를 보관함에 넣는다(점검 R5 — 읽고 비우는 사이 들어온 답도 서버 칸에 있으면 보관된다)
//   · 같은 opId 는 하나로(두 번 누르기·응답 유실) · 정상 제출된 칸은 안 바뀌고 다른 답은 _conflicts
//   · 리포트·약점 항목이 화면 doSubmit 과 같다 · detectWeakAreas 가 화면과 글자째 같다
'use strict';
const fs = require('fs');
const html = fs.readFileSync('E:/aa0/hp/index.html', 'utf8');
const H = require('../hw_submit')._internals;
let 통과 = 0, 실패 = 0;
function 재기(이름, 참, 덧) { if (참) { 통과++; console.log('  ✅ ' + 이름); } else { 실패++; console.log('  ⛔ ' + 이름 + (덧 ? '\n       ' + 덧 : '')); } }
const 떼기 = (a, b) => { const i = html.indexOf(a); const j = html.indexOf(b, i + 10); return html.slice(i, j); };

const 세트 = { title: 'Set 1', questions: [
  { id: 'q0', text: 'What is 2 + 3?', answer: 'B', type: 'mc', taxonomy_id: 'MR.Y5.A' },
  { id: 'q1', text: 'Area of a rectangle', answer: '12', type: 'sa' },
  { id: 'q2', text: 'Explain', answer: '', type: 'written' }] };
const 기본 = (덧) => Object.assign({ opId: 'op_abc123', answers: {}, sent: {}, set: 세트, who: { id: 'Amy05', name: '에이미', year: 5 },
  period: { year: 2026, month: 10, week: 1 }, now: '2026-10-03T10:00:00Z', at: 1, hwKey: 'AU_y5_2026_m10_w1' }, 덧);

console.log('── ① 옛 창의 옛 답이 새 답을 덮지 않는다(R6)');
{
  const out = {};
  const n = H.submitStep({ answers: { q0: 'B', q1: '12' } }, 기본({ answers: { q0: 'A', q1: '12' }, sent: { q0: 'A' } }), out);
  재기('서버 B · 기기가 전에 보낸 A → 이 기기가 마음을 바꾼 게 아니므로… (sent=A 이면 서버 B 는 다른 창 것) → 서버 B 를 지킨다',
    n.answers.q0 === 'B' && out.충돌.q0 && out.충돌.q0.mine === 'A', JSON.stringify(n.answers));
  재기('그 다른 답은 _conflicts 에 남는다', Object.keys(n._conflicts || {}).some(k => k.startsWith('answers|q0|')));
}
{
  const out = {};
  const n = H.submitStep({ answers: { q0: 'A' } }, 기본({ answers: { q0: 'B' }, sent: { q0: 'A' } }), out);
  재기('서버 A = 이 기기가 전에 보낸 A → 기기의 새 답 B 로 바꾼다(내 마음 바꿈)', n.answers.q0 === 'B' && !Object.keys(out.충돌).length);
}
{
  const out = {};
  const n = H.submitStep({ answers: { q0: 'B' } }, 기본({ answers: { q1: '12' } }), out);
  재기('기기에 없는 서버 답(q0 B)은 그대로 둔다 · 기기 답 q1 추가', n.answers.q0 === 'B' && n.answers.q1 === '12');
  재기('채점은 최종 답으로(2문항 모두 맞음 → 100)', n.reportData.score === 100 && n.reportData.correctCount === 2, JSON.stringify(n.reportData));
}

console.log('\n── 제출 확정');
{
  const out = {};
  const n = H.submitStep({ answers: { q0: 'B' }, rev: 2, manuallyMarked: true, markedBy: 'x', remediation: { r: 1 }, reportData: { kakaoMsg: 'k' } }, 기본({ answers: { q1: '9' } }), out);
  재기('rev = 서버 rev + 1 · submitted · hwKey · lastSubmitOp', n.rev === 3 && n.submitted === true && n.hwKey === 'AU_y5_2026_m10_w1' && n.lastSubmitOp === 'op_abc123');
  재기('원장 처리 표시는 지운다(진짜 제출이 이긴다)', !('manuallyMarked' in n) && !('markedBy' in n));
  재기('보충학습 등 다른 칸은 그대로', n.remediation && n.remediation.r === 1);
}
{
  const out = {};
  const r = H.submitStep({ answers: { q0: 'B' }, submitted: true, rev: 1, lastSubmitOp: 'op_abc123' }, 기본({ answers: { q0: 'B' } }), out);
  재기('같은 opId 로 다시 → 하나로(바꾸지 않음 · T13)', r === undefined && out.kind === 'dup');
}
{
  const out = {};
  const r = H.submitStep({ answers: { q0: 'B' }, submitted: true, rev: 1, lastSubmitOp: 'op_other1' }, 기본({ answers: { q0: 'C' } }), out);
  재기('이미 정상 제출된 칸 → 답·판은 그대로 · 다른 답은 같은 트랜잭션에서 _conflicts 로만', out.kind === 'already' && out.충돌.q0.mine === 'C'
    && r.answers.q0 === 'B' && r.rev === 1 && r.lastSubmitOp === 'op_other1' && Object.values(r._conflicts).some(x => x.mine === 'C'), JSON.stringify(r));
  const out2 = {};
  재기('이미 제출 · 다른 답 없음 → 아무것도 안 씀', H.submitStep({ answers: { q0: 'B' }, submitted: true, rev: 1 }, 기본({ answers: { q0: 'B' } }), out2) === undefined && out2.kind === 'already');
}

console.log('\n── ② 새로 풀기 — 서버 칸 그대로 보관(R5)');
{
  const out = {};
  const 서버 = { answers: { q0: 'B', q2: 'C' }, submitted: true, reportData: { s: 1 }, remediation: { r: 1 }, _prev: [{ old: 1 }], celebrationShown: true };
  const n = H.freshStep(서버, { opId: 'op_fresh1', now: 't', hwKey: 'HK' }, out);
  재기('서버 칸의 답(다른 창이 막 넣은 q2 포함)이 보관함에 들어간다', n._prev.length === 2 && n._prev[1].answers.q2 === 'C');
  재기('비우고 제출 false · 리포트·보충·축하 지움 · hwKey · lastFreshOp', Object.keys(n.answers).length === 0 && n.submitted === false && !n.reportData && !n.remediation && !n.celebrationShown && n.hwKey === 'HK' && n.lastFreshOp === 'op_fresh1');
  const out2 = {};
  재기('같은 opId 로 다시 → 두 번 보관하지 않는다', H.freshStep(n, { opId: 'op_fresh1', now: 't', hwKey: 'HK' }, out2) === undefined && out2.kind === 'dup');
}

console.log('\n── 열쇠 검사');
{
  const 됨 = (f) => { try { f(); return true; } catch (e) { return false; } };
  재기('본인 열쇠 · 같은 주 · 같은 학년 → 통과', 됨(() => H.checkKeys('Amy05', 'Amy05_2026_m10_w1_s0', 'AU_y5_2026_m10_w1', 5)));
  재기('밑줄 든 아이디도 통과', 됨(() => H.checkKeys('Kim_A', 'Kim_A_2026_m10_w1_s1', 'AU_y5-B_2026_m10_w1', 5)));
  재기('⛔ 남의 열쇠', !됨(() => H.checkKeys('Amy05', 'Ben03_2026_m10_w1_s0', 'AU_y5_2026_m10_w1', 5)));
  재기('⛔ 다른 주의 숙제 열쇠', !됨(() => H.checkKeys('Amy05', 'Amy05_2026_m10_w1_s0', 'AU_y5_2026_m10_w2', 5)));
  재기('⛔ 다른 학년 숙제', !됨(() => H.checkKeys('Amy05', 'Amy05_2026_m10_w1_s0', 'AU_y9_2026_m10_w1', 5)));
  재기('⛔ 경로를 비튼 열쇠', !됨(() => H.checkKeys('Amy05', 'Amy05_2026_m10_w1_s0/../x', 'AU_y5_2026_m10_w1', 5)));
}

console.log('\n── 화면과 같은가');
{
  const 화면 = 떼기('function detectWeakAreas(wrongQs) {', '\nconst REPORT_COLORS');
  const 서버 = fs.readFileSync(require.resolve('../hw_submit'), 'utf8');
  const 몸 = (s) => s.slice(s.indexOf('function detectWeakAreas(wrongQs) {'), s.indexOf('\n}\n', s.indexOf('function detectWeakAreas(wrongQs) {')) + 2).replace(/\s+/g, '');
  재기('detectWeakAreas 가 화면과 글자째 같다', 몸(화면) === 몸(서버));
  const r = H.buildReport(세트, { q0: 'A', q1: '12' }, { id: 'Amy05', name: '에이미', year: 5 }, { year: 2026, month: 10, week: 1 }, 't');
  재기('리포트 꼴이 화면 doSubmit 과 같은 칸들', ['studentId', 'studentName', 'year', 'setTitle', 'period', 'totalQuestions', 'correctCount', 'score', 'wrongQuestions', 'weakAreas', 'submittedAt'].every(k => k in r.reportData)
    && r.reportData.totalQuestions === 2 && r.reportData.score === 50 && r.reportData.wrongQuestions[0].studentAnswer === 'A');
  재기('약점 항목 = 분류 있는 문항만(화면 _weaknessJobOf 와 같은 규칙)', r.items.length === 1 && r.items[0].t === 'MR.Y5.A' && r.items[0].c === false);
}

console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
process.exit(실패 ? 1 : 0);
