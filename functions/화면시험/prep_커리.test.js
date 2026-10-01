// /prep/ 3-C — 커리 · 학교 자료(prep/prep_core.js)
//   지시서: 장기(시작일·목표 시험일·휴강·완충 주) · 단기 내신(남은 수업 수·확정 범위·자료 사진·시험 형식) ·
//           각 수업에 MR 단원·TS 단원·복습 비중·목표 수준.
//           학교 자료: 업로드 → 범위·날짜 초안 → 원장 확인 → 기존 커리와 차이 표시 → 개정 승인.
//           업로드만으로 커리를 바꾸지 않는다 · 범위가 바뀔 수 있으면 「커리 먼저 검토」 · 개정 시 미공개 초안만 무효.
'use strict';
const path = require('path');
const C = require(path.join(__dirname, '..', '..', 'prep', 'prep_core.js'));
let 통과 = 0, 실패 = 0;
function 재기(이름, 참, 덧) { if (참) { 통과++; console.log('  ✅ ' + 이름); } else { 실패++; console.log('  ⛔ ' + 이름 + (덧 ? '\n       ' + 덧 : '')); } }
for (const f of ['planLessonDates', 'validateCurriculum', 'diffCurriculum', 'nextCurriculumRev', 'sourceStep', 'needsCurriculumReview', 'staleDrafts']) {
  if (typeof C[f] !== 'function') { console.log('  ⛔ prep_core 에 ' + f + ' 가 없다'); 실패++; }
}
if (실패) { console.log('\n셈 — 통과 0 · 실패 ' + 실패); process.exit(1); }

console.log('── 장기 — 수업 날짜 짜기');
{
  const 날 = C.planLessonDates({ startDate: '2026-10-05', targetExamDate: '2026-11-16', holidays: ['2026-10-19'], bufferWeeks: 1, days: ['mon'] });
  재기('월요일만 · 휴강(10-19) 뺌 · 시험 전 완충 1주(11-09 이후) 뺌', 날.join() === '2026-10-05,2026-10-12,2026-10-26,2026-11-02', 날.join());
  재기('시작일이 시험일보다 늦으면 빈 목록', C.planLessonDates({ startDate: '2026-12-01', targetExamDate: '2026-11-01', days: ['mon'] }).length === 0);
}

const 커리 = {
  long: { startDate: '2026-10-05', targetExamDate: '2026-11-16', holidays: ['2026-10-19'], bufferWeeks: 1 },
  short: { remainingClasses: 4, confirmedRange: 'Ch 5-7 (분수·소수)', examDate: '2026-11-16', examFormat: '객관식 20 + 서술 5', sourceIds: ['src1'] },
  lessons: [
    { date: '2026-10-05', mr: '분수 덧셈', ts: '수열', reviewRatio: 20, targetLevel: 3 },
    { date: '2026-10-12', mr: '분수 곱셈', ts: '도형 회전', reviewRatio: 30, targetLevel: 3 },
    { date: '2026-10-26', mr: '소수', ts: '논리', reviewRatio: 40, targetLevel: 4 },
    { date: '2026-11-02', mr: '총복습', ts: '모의', reviewRatio: 100, targetLevel: 4 } ] };

console.log('\n── 검사');
{
  재기('올바른 커리 통과', C.validateCurriculum(커리).ok, JSON.stringify(C.validateCurriculum(커리).problems));
  const 고친 = (f) => { const c = JSON.parse(JSON.stringify(커리)); f(c); return C.validateCurriculum(c); };
  재기('휴강날 수업 → 거절', !고친(c => { c.lessons[1].date = '2026-10-19'; }).ok);
  재기('같은 날 수업 두 번 → 거절', !고친(c => { c.lessons[1].date = '2026-10-05'; }).ok);
  재기('복습 비중 0~100 밖 → 거절', !고친(c => { c.lessons[0].reviewRatio = 120; }).ok);
  재기('목표 수준 1~5 밖 → 거절', !고친(c => { c.lessons[0].targetLevel = 7; }).ok);
  재기('시험일 뒤 수업 → 거절', !고친(c => { c.lessons[3].date = '2026-11-30'; }).ok);
  재기('단기: 확정 범위 없음 → 거절', !고친(c => { c.short.confirmedRange = ''; }).ok);
  재기('단기: 남은 수업 수와 수업 줄 수가 다르면 알린다(경고)', 고친(c => { c.short.remainingClasses = 6; }).warnings.length === 1);
  재기('MR·TS 단원이 비면 거절', !고친(c => { c.lessons[0].mr = ''; }).ok);
}

console.log('\n── 개정 — 판은 덮지 않고 새로 · 차이를 보인다');
{
  재기('다음 판 번호(있는 판의 최대 + 1)', C.nextCurriculumRev({ r1: {}, r3: {} }) === 'r4' && C.nextCurriculumRev(null) === 'r1');
  const 새 = JSON.parse(JSON.stringify(커리));
  새.short.confirmedRange = 'Ch 5-8 (분수·소수·백분율)';
  새.lessons[2].mr = '소수·백분율';
  새.lessons.push({ date: '2026-11-09', mr: '시험 직전', ts: '-', reviewRatio: 100, targetLevel: 4 });
  새.lessons.splice(1, 1);
  const d = C.diffCurriculum(커리, 새);
  재기('범위 바뀜을 잡는다', d.some(x => x.what === 'short.confirmedRange' && x.to.includes('백분율')), JSON.stringify(d));
  재기('수업 내용 바뀜(10-26 MR)', d.some(x => x.kind === 'changed' && x.date === '2026-10-26' && x.field === 'mr'));
  재기('수업 더함(11-09)', d.some(x => x.kind === 'added' && x.date === '2026-11-09'));
  재기('수업 뺌(10-12)', d.some(x => x.kind === 'removed' && x.date === '2026-10-12'));
  재기('같으면 차이 0', C.diffCurriculum(커리, JSON.parse(JSON.stringify(커리))).length === 0);
}

console.log('\n── 학교 자료 — 업로드만으로는 커리가 안 바뀐다');
{
  let s = { srcId: 'src1', status: 'uploaded' };
  재기('올린 자료는 초안부터', C.sourceStep(s, 'confirm').ok === false);
  재기('초안 넣기 → drafted', (s = C.sourceStep(s, 'draft', { range: 'Ch 5-8', examDate: '2026-11-16' }).source).status === 'drafted');
  재기('초안에 범위가 없으면 거절', C.sourceStep({ status: 'uploaded' }, 'draft', { examDate: '2026-11-16' }).ok === false);
  재기('원장 확인 → confirmed', (s = C.sourceStep(s, 'confirm').source).status === 'confirmed');
  재기('개정 승인 전에는 적용 안 됨', s.appliedRev == null);
  재기('개정 승인 → applied + 판 번호', (s = C.sourceStep(s, 'apply', { rev: 'r2' }).source).status === 'applied' && s.appliedRev === 'r2');
  재기('되돌릴 수 없는 단계 거꾸로 → 거절', C.sourceStep(s, 'draft', { range: 'x' }).ok === false);
  재기('거절(reject)도 기록', C.sourceStep({ status: 'drafted' }, 'reject', { why: '작년 자료' }).source.status === 'rejected');
}

console.log('\n── 「커리 먼저 검토」 · 미공개 초안만 무효');
{
  재기('검토 안 끝난 자료가 있으면 → 검토 필요(제작 보류)', C.needsCurriculumReview({ a: { status: 'applied' }, b: { status: 'drafted' } }) === true);
  재기('다 적용·거절이면 → 아님', C.needsCurriculumReview({ a: { status: 'applied' }, b: { status: 'rejected' } }) === false);
  const 초안 = { d1: { studentId: 'Mina', basedOnCurriculumRev: 'r1', published: false }, d2: { studentId: 'Mina', basedOnCurriculumRev: 'r1', published: true },
                d3: { studentId: 'Mina', basedOnCurriculumRev: 'r2', published: false }, d4: { studentId: 'Aron', basedOnCurriculumRev: 'r1', published: false } };
  const 무효 = C.staleDrafts(초안, 'Mina', 'r2');
  재기('개정(r2) 뒤 무효 = 민아의 옛 판 **미공개** 초안만(d1)', 무효.join() === 'd1', 무효.join());
}

console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
process.exit(실패 ? 1 : 0);
