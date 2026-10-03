// 교사 「제출 처리」 — 이유를 고르고 누르면 「원장 처리 · 시각 · 이유」로 남는다.
//
// [2-B · 2026-10-01 원장 결정]
//   홈페이지 오류로 학생이 제출했는데 안 보일 때 원장님이 「한 걸로」 처리해 오셨다(옛 수동 완료 ✓ 단추).
//   ⛔ 옛 모습: 사유를 손으로 적고(prompt) 점수 0 으로 남겨 — 학생·학부모 화면에 **0%** 로 보였다.
//   이제: 이유를 **고르고**(기타는 적기) → 학생·학부모 화면에는 「완료 (원장 처리)」 · 점수 없음 ·
//         **약점 분석에 안 넣는다** · 리포트 평균에서도 뺀다.
//   ⛔ 이 기능이 생긴 뒤에 「남의 제출 칸 막기」를 켠다(마스터로 대신 풀어 내던 길을 막으므로).
//   기존 칸 이름(manuallyMarked · markedBy · markedAt · markedReason)은 그대로 · 새 칸 markedReasonCode 만 더한다.

'use strict';
const fs = require('fs');
const html = fs.readFileSync('E:/aa0/hp/index.html', 'utf8');
let 통과 = 0, 실패 = 0;
function 재기(이름, 참, 덧) {
  if (참) { 통과++; console.log('  ✅ ' + 이름); }
  else { 실패++; console.log('  ⛔ ' + 이름 + (덧 ? '\n       ' + 덧 : '')); }
}
function 떼기(시작, 끝표) {
  const i = html.indexOf(시작); if (i < 0) throw new Error('못 찾음: ' + 시작);
  const j = html.indexOf(끝표, i + 10); if (j < 0) throw new Error('끝 못 찾음: ' + 끝표);
  return html.slice(i, j);
}

const 소스 = 떼기('// ═══ [2-B] 제출 처리 — 시작', '// ═══ [2-B] 제출 처리 — 끝');

function 세상(처음제출, 서버제출) {
  const 상태 = { 쓴것: [], 줄: [], 알림: [], 경고: [], 다시그림: 0 };
  // [정비 §5] 원장 처리는 서버 칸을 보고 한 동작(트랜잭션)으로 쓴다 — 서버 값은 따로 줄 수 있다(사본과 다를 때)
  상태.서버 = 서버제출 === undefined ? (처음제출 ? JSON.parse(JSON.stringify(처음제출)) : null) : 서버제출;
  const p = { year: 2026, month: 10, week: 1 };
  const store = {
    currentPeriod: p,
    users: [{ id: 'Mina', name: '민아', role: 'student', year: 5, country: 'AU', group: '' }],
    homeworkSets: { AU_y5_2026_m10_w1: { sets: [{ title: 'Set 1 (분수)', questions: [{ id: 'q0', answer: '1' }, { id: 'q1', answer: '2' }] }] } },
    submissions: 처음제출 ? { Mina_2026_m10_w1_s0: 처음제출 } : {},
  };
  const 값 = {
    getStore: () => store, saveStore: () => true,
    subKey: (sid, pp, i) => `${sid}_${pp.year}_m${String(pp.month).padStart(2, '0')}_w${pp.week}_s${i}`,
    hwLookup: (s) => s.homeworkSets.AU_y5_2026_m10_w1,
    fbSetSubmission: (k, d, cb) => { 상태.통째 = true; cb && cb(true); },
    fbTxSubmission: (k, fn, cb) => {
      const 새 = fn(상태.서버 == null ? null : JSON.parse(JSON.stringify(상태.서버)));
      if (새 === undefined) { cb({ ok: true, committed: false, value: 상태.서버 }); return; }
      상태.서버 = 새; 상태.쓴것.push([k, JSON.parse(JSON.stringify(새))]);
      cb({ ok: true, committed: true, value: 새 });
    },
    _weaknessEnqueue: (j) => 상태.줄.push(j),
    showBackupToast: (m) => 상태.알림.push(m),
    alert: (m) => 상태.경고.push(m),
    renderTeacher: () => { 상태.다시그림++; },
    closeModal: () => {},
    escHtml: (s) => String(s),
    currentUser: { id: 'Principal', role: 'teacher' },
    document: { getElementById: (id) => ({ value: 상태.입력 ? 상태.입력[id] : '', classList: { add() {} }, set innerHTML(v) { 상태.창 = v; } }) },
    console,
  };
  const 이름 = Object.keys(값);
  상태.F = new Function(...이름, 소스 + '\n; return { MANUAL_REASONS, isManualDone, manualDoneLabel, markSubmissionByTeacher, manualMarkSubmission, confirmManualMark };')(...이름.map(k => 값[k]));
  상태.store = store;
  return 상태;
}

console.log('── 이유 목록');
{
  const s = 세상();
  const 목록 = s.F.MANUAL_REASONS;
  재기('이유가 셋 이상', Array.isArray(목록) && 목록.length >= 3, JSON.stringify(목록));
  재기('「홈페이지 오류」 이유가 있다', 목록.some(r => /홈페이지 오류/.test(r.label)));
  재기('「기타(직접 적기)」가 있다', 목록.some(r => r.code === 'other'));
}

console.log('\n── 처리하면 남는 것');
{
  const s = 세상({ answers: { q0: '1' }, submitted: false });
  const r = s.F.markSubmissionByTeacher('Mina', 0, 'site-error', '');
  const [k, d] = s.쓴것[0] || [];
  재기('처리된다', r && r.ok === true, JSON.stringify(r));
  재기('그 아이·그 세트 칸에 쓴다', k === 'Mina_2026_m10_w1_s0', k);
  재기('완료로 남는다(submitted)', d && d.submitted === true);
  재기('기존 칸 이름 그대로 — 원장 처리 · 시각 · 이유', d && d.manuallyMarked === true && d.markedBy === 'Principal' && /^\d{4}-\d\d-\d\dT/.test(d.markedAt) && /홈페이지 오류/.test(d.markedReason), JSON.stringify(d));
  재기('고른 이유의 부호도 남는다(새 칸)', d && d.markedReasonCode === 'site-error');
  재기('풀던 답은 지우지 않고 둔다', d && d.answers && d.answers.q0 === '1');
  재기('리포트 칸에도 원장 처리 표시', d && d.reportData && d.reportData.manuallyMarked === true && d.reportData.markedReason === d.markedReason);
  재기('⛔ 약점 반영 줄에 안 넣는다', s.줄.length === 0);
  재기('점수를 0 으로 박지 않는다(점수 칸 없음)', d && d.reportData && !('score' in d.reportData), JSON.stringify(d && d.reportData));
}
{
  const s = 세상();
  const r = s.F.markSubmissionByTeacher('Mina', 0, 'other', '');
  재기('기타인데 글이 비면 거절', r && r.ok === false && s.쓴것.length === 0, JSON.stringify(r));
  const r2 = s.F.markSubmissionByTeacher('Mina', 0, 'other', '태블릿 고장');
  재기('기타 + 글 → 처리 · 그 글이 이유', r2.ok && /태블릿 고장/.test(s.쓴것[0][1].markedReason));
}
{
  const s = 세상({ answers: { q0: '1', q1: '2' }, submitted: true, submitTime: '2026-10-01T00:00:00Z' });
  const r = s.F.markSubmissionByTeacher('Mina', 0, 'site-error', '');
  재기('정상 제출된 칸은 처리하지 않는다', r.ok === false && s.쓴것.length === 0, JSON.stringify(r));
}
{
  const s = 세상();
  const r = s.F.markSubmissionByTeacher('Mina', 0, 'nope', '');
  재기('목록에 없는 이유 부호 → 거절', r.ok === false);
}
console.log('\n── [정비 §5] 서버 칸을 보고 한 동작으로(T03)');
{
  // 원장 화면 사본은 미제출인데, 그 사이 아이가 서버에 제출했다
  const 서버 = { answers: { q0: '1', q1: '2' }, submitted: true, submitTime: '2026-10-03T09:00:00Z', rev: 1, reportData: { score: 100, kakaoMsg: 'k' } };
  const s = 세상({ answers: { q0: '1' }, submitted: false }, 서버);
  s.F.markSubmissionByTeacher('Mina', 0, 'site-error', '');
  재기('서버에 정상 제출이 있으면 아무것도 안 쓴다', s.쓴것.length === 0 && s.서버.submitted === true && !s.서버.manuallyMarked && s.서버.reportData.score === 100, JSON.stringify(s.서버));
  재기('까닭을 알린다', s.알림.some(m => /그 사이/.test(m)), s.알림.join(' | '));
  재기('이 브라우저 사본도 서버 값으로 맞춘다', s.store.submissions.Mina_2026_m10_w1_s0.submitted === true);
}
{
  // 서버 칸에 보충학습·판 번호 등 다른 칸이 있으면 남긴다
  const s = 세상({ answers: { q0: '1' }, submitted: false }, { answers: { q0: '1', q1: '9' }, submitted: false, remediation: { currentRound: 1 }, _prev: [{ x: 1 }] });
  s.F.markSubmissionByTeacher('Mina', 0, 'site-error', '');
  const d = s.쓴것[0] && s.쓴것[0][1];
  재기('서버의 답(사본에 없던 q1 포함)·보충·보관함을 지우지 않는다', d && d.answers.q1 === '9' && d.remediation && d.remediation.currentRound === 1 && d._prev.length === 1, JSON.stringify(d));
  재기('칸 통째 쓰기(fbSetSubmission)를 안 쓴다', !s.통째);
}

console.log('\n── 보이는 말');
{
  const s = 세상();
  재기('isManualDone: 원장 처리 칸', s.F.isManualDone({ submitted: true, manuallyMarked: true }) === true);
  재기('isManualDone: 보통 제출은 아님', s.F.isManualDone({ submitted: true }) === false && s.F.isManualDone(null) === false);
  재기('표시 말 = 완료 (원장 처리)', /완료 \(원장 처리\)/.test(s.F.manualDoneLabel({ submitted: true, manuallyMarked: true })));
}

console.log('\n── 창(모달) — 고르고 누르기 · 브라우저 기본 창(prompt·confirm) 안 씀');
{
  const s = 세상();
  s.F.manualMarkSubmission('Mina', 0);
  재기('창이 열린다 · 이유 고르기(select)가 있다', /<select[^>]+id="mmReason"/.test(s.창 || ''), (s.창 || '').slice(0, 200));
  재기('이유 목록이 다 들어 있다', s.F.MANUAL_REASONS.every(r => (s.창 || '').includes(r.label)));
  s.입력 = { mmReason: 'site-error', mmOther: '' };
  s.F.confirmManualMark('Mina', 0);
  재기('확인을 누르면 처리된다', s.쓴것.length === 1 && s.쓴것[0][1].markedReasonCode === 'site-error');
  재기('처리 뒤 교사 화면을 다시 그린다', s.다시그림 >= 1);
  const 제출처리소스 = 소스;
  재기('이 기능 안에서 prompt·confirm 을 안 쓴다', !/\bprompt\(|\bconfirm\(/.test(제출처리소스));
}

console.log('\n── 학생·학부모·교사·리포트가 「원장 처리」를 안다');
const 쓰는곳 = {
  '교사 표(renderTeacher)': 떼기('function renderTeacher() {', '\nfunction '),
  '학생 세트 목록(renderSetList)': 떼기('function renderSetList(hw, store, p) {', '\nfunction '),
  '학생 결과 화면(renderStudent)': 떼기('function renderStudent() {', '\nfunction '),
  '학부모 화면(renderParent)': 떼기('function renderParent() {', '\nfunction '),
  '리포트 자료(buildReportDataForStudent)': 떼기('function buildReportDataForStudent(studentId, period, store) {', '\nfunction '),
};
for (const [이름, 글] of Object.entries(쓰는곳)) 재기(이름 + ' 이 isManualDone 을 본다', /isManualDone\(/.test(글));

console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
process.exit(실패 ? 1 : 0);
