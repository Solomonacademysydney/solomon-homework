// /prep/ 3-B — 종이 시험(prep/prep_core.js)
//   지시서: 고정 testId 와 문항별 정답·배점·분류 명세를 먼저 만든다. 객관식·단답·부분점수·미답·미응시를 구분한다.
//           수정은 이전 결과를 대체하고 이력을 남기며 집계는 기여분 대체. 미응시는 0점 응시로 합치지 않는다.
'use strict';
const fs = require('fs');
const path = require('path');
const C = require(path.join(__dirname, '..', '..', 'prep', 'prep_core.js'));
const html = fs.readFileSync('E:/aa0/hp/index.html', 'utf8');
let 통과 = 0, 실패 = 0;
function 재기(이름, 참, 덧) { if (참) { 통과++; console.log('  ✅ ' + 이름); } else { 실패++; console.log('  ⛔ ' + 이름 + (덧 ? '\n       ' + 덧 : '')); } }
function 떼기(시작, 끝표) { const i = html.indexOf(시작); if (i < 0) throw new Error('못 찾음: ' + 시작); return html.slice(i, html.indexOf(끝표, i + 10)); }
const 있나 = (이름) => typeof C[이름] === 'function';
for (const f of ['newTestId', 'validateTestSpec', 'gradePaper', 'nextPaperRecord', 'paperWeaknessJob', 'weaknessMerge', 'paperSummary']) {
  if (!있나(f)) { console.log('  ⛔ prep_core 에 ' + f + ' 가 없다'); 실패++; }
}
if (실패) { console.log('\n셈 — 통과 0 · 실패 ' + 실패); process.exit(1); }

const 명세 = { testId: 'pt-20261001-1', title: '10월 1주 단원평가', date: '2026-10-01', items: [
  { no: 1, type: 'mc', answer: 'B', points: 1, taxonomyId: 'MR.Y5.NA.add' },
  { no: 2, type: 'sa', answer: '3 1/2', points: 2, taxonomyId: 'MR.Y5.NA.frac' },
  { no: 3, type: 'partial', points: 4, taxonomyId: 'MR.Y5.ME.area' },
  { no: 4, type: 'mc', answer: 'D', points: 1 } ] };

console.log('── 명세');
{
  재기('testId 는 날짜·번호로 고정(pt-YYYYMMDD-n)', C.newTestId('2026-10-01', ['pt-20261001-1']) === 'pt-20261001-2' && C.newTestId('2026-10-01', []) === 'pt-20261001-1');
  재기('올바른 명세 통과', C.validateTestSpec(명세).ok === true, JSON.stringify(C.validateTestSpec(명세)));
  const 나쁨 = (고침) => C.validateTestSpec(Object.assign(JSON.parse(JSON.stringify(명세)), 고침));
  재기('testId 꼴이 틀리면 거절', !나쁨({ testId: 'abc' }).ok);
  재기('문항 번호 중복 거절', !나쁨({ items: [{ no: 1, type: 'mc', answer: 'A', points: 1 }, { no: 1, type: 'mc', answer: 'B', points: 1 }] }).ok);
  재기('배점 0·음수 거절', !나쁨({ items: [{ no: 1, type: 'mc', answer: 'A', points: 0 }] }).ok);
  재기('객관식·단답에 정답 없으면 거절', !나쁨({ items: [{ no: 1, type: 'sa', points: 1 }] }).ok);
  재기('모르는 유형 거절', !나쁨({ items: [{ no: 1, type: 'essay', points: 1 }] }).ok);
  재기('문항 0개 거절', !나쁨({ items: [] }).ok);
}

console.log('\n── 채점 — 객관식·단답·부분점수·미답·미응시');
const 응시 = { status: 'taken', answers: { 1: 'b', 2: '3 1/2', 4: '' }, partial: { 3: 3 } };
const g = C.gradePaper(명세, 응시);
{
  재기('객관식 맞음(대소문자 무시)', g.items[1].state === 'correct' && g.items[1].score === 1);
  재기('단답 맞음(학생 화면과 같은 정답 비교)', g.items[2].state === 'correct' && g.items[2].score === 2);
  재기('부분점수 3/4 → partial', g.items[3].state === 'partial' && g.items[3].score === 3 && g.items[3].max === 4);
  재기('빈칸 → blank(오답과 구분)', g.items[4].state === 'blank' && g.items[4].score === 0);
  재기('합계 6/8 · 75%', g.score === 6 && g.max === 8 && g.percent === 75, JSON.stringify([g.score, g.max, g.percent]));
  const 틀림 = C.gradePaper(명세, { status: 'taken', answers: { 1: 'A', 2: '4', 4: 'D' }, partial: { 3: 0 } });
  재기('객관식 틀림 → wrong', 틀림.items[1].state === 'wrong');
  재기('부분점수 0 → wrong(빈칸 아님)', 틀림.items[3].state === 'wrong');
  재기('부분점수 만점 → correct', C.gradePaper(명세, { status: 'taken', answers: {}, partial: { 3: 4 } }).items[3].state === 'correct');
  재기('부분점수가 배점을 넘으면 배점까지만', C.gradePaper(명세, { status: 'taken', answers: {}, partial: { 3: 9 } }).items[3].score === 4);
  const 미응시 = C.gradePaper(명세, { status: 'absent' });
  재기('미응시 → 점수 없음(0점 아님)', 미응시.status === 'absent' && 미응시.score === null && 미응시.percent === null, JSON.stringify(미응시));
}

console.log('\n── 수정 — 이전 결과를 대체하고 이력을 남긴다');
{
  const r1 = C.nextPaperRecord(null, g, { at: 't1', by: 'T' });
  재기('첫 입력 판 1', r1.current.rev === 1 && r1.history['1'].score === 6, JSON.stringify(r1.current));
  const g2 = C.gradePaper(명세, { status: 'taken', answers: { 1: 'B', 2: '3 1/2', 4: 'D' }, partial: { 3: 4 } });
  const r2 = C.nextPaperRecord(r1, g2, { at: 't2', by: 'T' });
  재기('수정 → 판 2 가 현재 · 판 1 은 이력에 그대로', r2.current.rev === 2 && r2.current.score === 8 && r2.history['1'].score === 6 && r2.history['2'].score === 8);
  const r3 = C.nextPaperRecord(r2, C.gradePaper(명세, { status: 'absent' }), { at: 't3', by: 'T' });
  재기('미응시로 고쳐도 이력은 남는다', r3.current.status === 'absent' && Object.keys(r3.history).length === 3);
}

console.log('\n── 집계 — 미응시는 평균에 안 넣는다');
{
  const 기록들 = [ { current: { status: 'taken', percent: 80 } }, { current: { status: 'absent', percent: null } }, { current: { status: 'taken', percent: 60 } } ];
  const s = C.paperSummary(기록들);
  재기('평균 70(미응시 뺌) · 응시 2 · 미응시 1', s.average === 70 && s.taken === 2 && s.absent === 1, JSON.stringify(s));
}

console.log('\n── 약점 — 기여분 대체(학생 화면과 같은 합치기)');
{
  const 화면합치기 = new Function(떼기('function _weaknessMerge(cur, cid, rev, v, now) {', '\n}\n') + '\n}\n; return _weaknessMerge;')();
  const 사례 = [
    [null, 'paper_pt', 1, { t: 'MR.A', n: 2, c: 1, list: [true, false] }],
    [{ attempts: 3, correct: 1, wrong: 2, history: [{ correct: true }], contrib: { paper_pt: { rev: 1, n: 2, c: 1 } } }, 'paper_pt', 2, { t: 'MR.A', n: 1, c: 1, list: [true] }],
    [{ attempts: 3, correct: 1, wrong: 2, history: [], contrib: { paper_pt: { rev: 2, n: 2, c: 1 } } }, 'paper_pt', 2, { t: 'MR.A', n: 1, c: 1, list: [true] }],
    [null, 'paper_pt', 3, { t: null, n: 0, c: 0, list: [] }] ];
  const 같음 = 사례.every(([cur, cid, rev, v]) => JSON.stringify(C.weaknessMerge(cur, cid, rev, v, 'now')) === JSON.stringify(화면합치기(cur, cid, rev, v, 'now')));
  재기('합치기가 학생 화면 _weaknessMerge 와 같다(4 사례)', 같음);
  const j1 = C.paperWeaknessJob(명세, g, 'Mina', 1);
  재기('일 = 학생·「paper_<testId>」·판 · 분류 있는 문항만(4번 없음)', j1.sid === 'Mina' && j1.subKey === 'paper_pt-20261001-1' && j1.rev === 1 && j1.items.length === 3, JSON.stringify(j1));
  재기('부분점수는 만점일 때만 맞음 · 빈칸은 틀림', j1.items.find(x => x.t === 'MR.Y5.ME.area').c === false && j1.items.find(x => x.t === 'MR.Y5.NA.add').c === true);
  const j3 = C.paperWeaknessJob(명세, C.gradePaper(명세, { status: 'absent' }), 'Mina', 3);
  재기('미응시로 고친 판은 문항 0(옛 기여분만 빠진다)', j3.items.length === 0 && j3.rev === 3);
}

console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
process.exit(실패 ? 1 : 0);
