// 6단계 승인 · 조정 · 20:00 공개 — 진짜 DB·인증(에뮬레이터)
//   firebase emulators:exec --only database,auth --project demo-solomon "node functions/에뮬레이터시험/공개.emu.js"
// 지시서 6단계 완료 기준: 미승인 완성본의 20:00 공개 · 원장 조기 공개 · 미완성·보류·휴강본 차단 · 공개 경쟁·재시도 ·
//   서머타임·월말·연말(셈 시험 prep_공개.test.js) · PC 꺼짐(일꾼 없이 서버만으로) · 수동 승인 기본값과 자동 공개 이력 구분
'use strict';
const path = require('path');
const DB = process.env.FIREBASE_DATABASE_EMULATOR_HOST, AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!DB || !AUTH || !/^(127\.0\.0\.1|localhost):\d+$/.test(DB)) { console.log('⛔ 에뮬레이터 변수가 없습니다'); console.log('\n셈 — 통과 0 · 실패 1'); process.exit(1); }
const admin = require(path.join(__dirname, '..', 'node_modules', 'firebase-admin'));
admin.initializeApp({ projectId: 'demo-solomon', databaseURL: `http://${DB}?ns=demo-solomon` });
const db = admin.database();
const P = require(path.join(__dirname, '..', 'prep_session'));
const R = require(path.join(__dirname, '..', 'prep_release'));
const RC = require(path.join(__dirname, '..', 'release_core'));
const O = require(path.join(__dirname, '..', 'order_core'));
const OP = '62bxWubzDLMrhHjjv2oNfAQiyaD2';
const ROOT = 'sol_prep_v1';
let 통과 = 0, 실패 = 0;
function 재기(이름, 참, 덧) { if (참) { 통과++; console.log('  ✅ ' + 이름); } else { 실패++; console.log('  ⛔ ' + 이름 + (덧 ? '\n       ' + 덧 : '')); } }
async function 부름(fn, uid, data, token) {
  try { return await fn.run({ auth: uid ? { uid, token: Object.assign({ uid }, token || {}) } : undefined, data: data || {} }); }
  catch (e) { return { err: (e.code || '') + '/' + (e.message || ''), details: e.details }; }
}
const 거절 = (r, 말) => !!(r && r.err && r.err.includes(말));
const v = async (p) => (await db.ref(ROOT + '/' + p).once('value')).val();
const 학생 = (sid) => ({ prep: { sid, role: 'student', master: false, exp: Date.now() + 3600e3 } });
const Z = (s) => Date.parse(s);
const 설정 = () => { const s = O.defaultSettings(); s.mr.units[0].title = 'Probability II'; s.onlineHw = { mrSets: 1, tsSets: 1, perSet: 2, daily: false, dupPolicy: 'avoid' }; return s; };

/** 일꾼이 낼 교재 초안(종이) */
async function 종이초안(planId, rev, sid, lessonDate, over) {
  const id = planId + '_r' + rev + '_paper_aaaa';
  await db.ref(ROOT + '/drafts/' + id).set(Object.assign({ kind: 'paper', planId, planRev: rev, studentId: sid, lessonDate, status: 'paperReview', published: false, jobId: 'jp-' + planId,
    qa: { ok: true }, specHash: 'h', manifest: [{ slot: 'm001', section: 'test', src: 'mr', itemId: 'mrg-a' }, { slot: 't002', section: 'book', src: 'ts', itemId: 'ts-b' }] }, over || {}));
  return id;
}
/** 일꾼이 낼 홈페이지 초안(온라인) — 확인한 수량 1+1 세트 × 2 문항 */
async function 온라인초안(planId, rev, sid, lessonDate, jobId, paperId, over) {
  const id = planId + '_r' + rev + '_online_' + jobId.slice(-4);
  const q = (i, src, x) => Object.assign({ id: 'q' + (i % 2), text: 'Q' + i, type: 'sa', answer: String(i), explanation: 'e' + i, srcId: src + i }, x || {});
  await db.ref(ROOT + '/drafts/' + id).set(Object.assign({ kind: 'online', planId, planRev: rev, studentId: sid, lessonDate, status: 'onlineReview', published: false, jobId, sourceDraftId: paperId,
    sets: [{ setIdx: 0, title: 'MR Set 1', questions: [q(0, 'mrg-'), q(1, 'mrg-')] }, { setIdx: 1, title: 'TS Set 2', questions: [q(2, 'ts-', { type: 'mc', options: ['a', 'b', 'c', 'd'], answer: 'B', figure: '<svg viewBox="0 0 2 2"><circle r="1"/></svg>' }), q(3, 'ts-', { type: 'mc', options: ['a', 'b', 'c', 'd'], answer: 'C' })] }],
    manifest: [{ itemId: 'mrg-0', src: 'mr', verify: 'verified-agree' }, { itemId: 'mrg-1', src: 'mr', verify: 'verified-agree' }, { itemId: 'ts-2', src: 'ts' }, { itemId: 'ts-3', src: 'ts' }] }, over || {}));
  return id;
}
/** 공개 준비가 다 된 수업 하나: 확정 → 교재 초안 → 교재 승인 → 수량 확인 → 홈페이지 초안 */
async function 준비(sid, lessonDate, scope) {
  const c = await 부름(P.prepConfirmOrder, OP, { studentId: sid, lessonDate, settings: 설정() });
  if (!c.ok) throw new Error('확정 실패 ' + JSON.stringify(c));
  const paper = await 종이초안(c.planId, c.rev, sid, lessonDate);
  const a = await 부름(R.prepApprovePaper, OP, { draftId: paper, scope: scope || 'thisWeek' });
  if (!a.ok) throw new Error('승인 실패 ' + JSON.stringify(a));
  const o = await 부름(R.prepConfirmOnline, OP, { paperDraftId: paper, online: { mrSets: 1, tsSets: 1, perSet: 2 }, scope: scope || 'thisWeek' });
  if (!o.ok) throw new Error('수량 확인 실패 ' + JSON.stringify(o));
  const online = await 온라인초안(c.planId, c.rev, sid, lessonDate, o.jobId, paper);
  return { planId: c.planId, rev: c.rev, paper, online, jobId: o.jobId, aid: c.planId + '_hw' };
}

(async () => {
  await db.ref().set(null);
  await db.ref(ROOT + '/students').set({ Mina: { profile: { currentCurriculum: 'r1', driveFolder: '민아' } }, Aron: { profile: { currentCurriculum: 'r1' } } });

  console.log('── 문지기 — 원장만');
  for (const [이름, fn, data] of [['교재 승인', R.prepApprovePaper, { draftId: 'x', scope: 'thisWeek' }], ['수량 확인', R.prepConfirmOnline, { paperDraftId: 'x' }],
    ['부분 수정', R.prepRequestRevision, { draftId: 'x' }], ['홈페이지 초안 고치기', R.prepEditOnline, { draftId: 'x' }], ['공개 조건 보기', R.prepReleaseStatus, { planId: 'x' }],
    ['공개', R.prepRelease, { planId: 'x' }], ['보류·휴강', R.prepLessonControl, { planId: 'x', action: 'hold' }], ['정정', R.prepCorrectRelease, { assignmentId: 'x' }]]) {
    재기(이름 + ' — 세션 학생·로그인 없음 거절', 거절(await 부름(fn, 'u-mina', data, 학생('Mina')), 'OPERATOR-ONLY') && 거절(await 부름(fn, null, data), 'OPERATOR-ONLY'));
  }

  console.log('\n── 확정 → 공개 예약(수업일 시드니 20:00)');
  const c1 = await 부름(P.prepConfirmOrder, OP, { studentId: 'Mina', lessonDate: '2026-10-09', settings: 설정() });
  const sch1 = await v('plans/' + c1.planId + '/schedule');
  재기('확정하면 예약이 생긴다: 10-09 20:00(시드니) = 09:00Z · 예약 상태', sch1 && sch1.releaseAt === Z('2026-10-09T09:00:00Z') && sch1.state === 'scheduled' && sch1.releaseAtSydney === '2026-10-09 20:00', JSON.stringify(sch1));
  재기('예약 줄(releaseQueue)에 시각이 들어간다', (await v('releaseQueue/' + c1.planId)) === Z('2026-10-09T09:00:00Z'));

  console.log('\n── ① 교재 승인');
  const 표본 = await 종이초안(c1.planId, 1, 'Mina', '2026-10-09', { sample: true });
  재기('표본 초안은 승인 안 됨', 거절(await 부름(R.prepApprovePaper, OP, { draftId: 표본, scope: 'thisWeek' }), 'SAMPLE'));
  await db.ref(ROOT + '/drafts/' + 표본).remove();
  const 판1종이 = await 종이초안(c1.planId, 1, 'Mina', '2026-10-09');
  const c1b = await 부름(P.prepConfirmOrder, OP, { studentId: 'Mina', lessonDate: '2026-10-09', settings: 설정() });   // 판 2
  재기('옛 판(1) 교재는 승인 안 됨(STALE)', 거절(await 부름(R.prepApprovePaper, OP, { draftId: 판1종이, scope: 'thisWeek' }), 'STALE'));
  const 종이2 = await 종이초안(c1.planId, 2, 'Mina', '2026-10-09', { qa: { ok: false } });
  재기('PDF 검사 실패 초안은 승인 안 됨', 거절(await 부름(R.prepApprovePaper, OP, { draftId: 종이2, scope: 'thisWeek' }), 'QA'));
  await db.ref(ROOT + '/drafts/' + 종이2 + '/qa/ok').set(true);
  const 승인 = await 부름(R.prepApprovePaper, OP, { draftId: 종이2, scope: 'thisWeek' });
  재기('「이번 주만」 승인 → 승인 기록 · 기본값은 그대로(없음)', 승인.ok && !승인.savedDefault && (await v('drafts/' + 종이2 + '/approval/approved')) === true
    && (await v('drafts/' + 종이2 + '/status')) === 'paperApproved' && !(await v('students/Mina/preferences')), JSON.stringify(승인));
  재기('판 2 승인 자리에 교재 초안 id', (await v('plans/' + c1.planId + '/approvals/2/paper/draftId')) === 종이2);

  console.log('\n── ② 홈페이지 숙제 수량 확인');
  재기('수량이 틀리면 거절(까닭과 함께)', 거절(await 부름(R.prepConfirmOnline, OP, { paperDraftId: 종이2, online: { mrSets: 0, tsSets: 0, perSet: 20 } }), 'BAD-ONLINE'));
  const 미승인 = await 종이초안('Aron_20261009_1', 1, 'Aron', '2026-10-09');
  재기('교재 승인 전에는 거절', 거절(await 부름(R.prepConfirmOnline, OP, { paperDraftId: 미승인, online: { mrSets: 1, tsSets: 0, perSet: 5 } }), 'NOT-APPROVED'));
  const on1 = await 부름(R.prepConfirmOnline, OP, { paperDraftId: 종이2, online: { mrSets: 1, tsSets: 1, perSet: 2 }, scope: 'thisWeek' });
  const j1 = await v('jobs/' + on1.jobId);
  재기('주문 prep-online · 확인한 수량 · 승인 교재 · 판 2', j1 && j1.type === 'prep-online' && j1.onlineConfig.perSet === 2 && j1.sourceDraftId === 종이2 && j1.rev === 2 && j1.status === 'queued', JSON.stringify(j1));
  const on2 = await 부름(R.prepConfirmOnline, OP, { paperDraftId: 종이2, online: { mrSets: 1, tsSets: 1, perSet: 2 }, scope: 'default' });
  재기('다시 확인 → 옛 대기 주문은 취소 · 「기본값에도」면 기본값 저장(수동 승인 표시)', (await v('jobs/' + on1.jobId + '/status')) === 'cancelled'
    && (await v('students/Mina/preferences/online/source')) === 'online-approval' && (await v('students/Mina/preferences/online/config/perSet')) === 2);
  const 온1 = await 온라인초안(c1.planId, 2, 'Mina', '2026-10-09', on2.jobId, 종이2);

  console.log('\n── ⑤ 공개 조건 보기');
  const st = await 부름(R.prepReleaseStatus, OP, { planId: c1.planId });
  재기('원장 공개는 됨 · 자동은 「스위치 꺼짐」(지금은 10-09 전이라 「시각 전」도)', st.manual.ok && !st.auto.ok && st.auto.reasons.some(x => x.key === 'switch-off') && st.auto.reasons.some(x => x.key === 'not-yet'), JSON.stringify(st.auto.reasons));

  console.log('\n── ⑦ 매분 예약 — 19:59 · 20:00(스위치 꺼짐) · 보류');
  let r = await R._internals.tickOnce(Z('2026-10-09T08:59:00Z'));
  재기('19:59 → 줄에서 안 꺼냄(공개 0)', r.length === 0 && !(await v('releases/' + c1.planId + '_hw')));
  r = await R._internals.tickOnce(Z('2026-10-09T09:00:00Z'));
  const lc1 = await v('plans/' + c1.planId + '/schedule/lastCheck');
  재기('20:00 · 스위치 꺼짐 → 공개 안 함 · 까닭을 남김', !(await v('releases/' + c1.planId + '_hw')) && lc1 && lc1.reasons.some(x => x.key === 'switch-off'), JSON.stringify(lc1));
  await R._internals.tickOnce(Z('2026-10-09T09:01:00Z'));
  재기('같은 까닭이면 다시 쓰지 않는다(매분 쓰기 없음)', (await v('plans/' + c1.planId + '/schedule/lastCheck/at')) === lc1.at);
  await db.ref(ROOT + '/config/autoRelease').set(true);
  재기('보류', (await 부름(R.prepLessonControl, OP, { planId: c1.planId, action: 'hold' })).ok && (await v('releaseQueue/' + c1.planId)) === null);
  await R._internals.tickOnce(Z('2026-10-09T09:02:00Z'));
  재기('보류 중 20:02 → 공개 안 함', !(await v('releases/' + c1.planId + '_hw')));
  const 보류중수동 = await 부름(R.prepRelease, OP, { planId: c1.planId });
  재기('보류 중 원장 공개도 막힘(먼저 해제)', 거절(보류중수동, 'NOT-READY') && 보류중수동.details.reasons.some(x => x.key === 'held'));
  재기('보류는 저절로 안 풀린다 — 원장이 해제', (await v('plans/' + c1.planId + '/schedule/state')) === 'held' && (await 부름(R.prepLessonControl, OP, { planId: c1.planId, action: 'unhold' })).ok
    && (await v('releaseQueue/' + c1.planId)) === Z('2026-10-09T09:00:00Z'));

  console.log('\n── 공개 경쟁 — 원장 공개와 예약이 동시에');
  const [가, 나, 다] = await Promise.all([R._internals.releaseCore(c1.planId, 'manual', Z('2026-10-09T09:03:00Z'), OP), R._internals.tickOnce(Z('2026-10-09T09:03:00Z')), R._internals.releaseCore(c1.planId, 'manual', Z('2026-10-09T09:03:00Z'), OP)]);
  const 공개 = await v('releases/' + c1.planId + '_hw');
  const 기록들 = Object.values((await v('releaseLog')) || {}).filter(x => x.aid === c1.planId + '_hw');
  재기('공개 묶음은 하나 · 공개 기록도 하나', 공개 && 공개.published === true && 기록들.length === 1, JSON.stringify({ 가, 나, 다, n: 기록들.length }));
  재기('묶음: 학생·판·초안·주차(10월 2주)·세트 둘·원인', 공개.studentId === 'Mina' && 공개.planRev === 2 && 공개.draftId === 온1 && 공개.period.week === 2 && 공개.period.month === 10
    && Object.keys(공개.sets).join() === 's1,s2' && ['manual', 'scheduled'].indexOf(공개.cause) >= 0, JSON.stringify(공개.period));
  재기('초안 = 공개됨 · 줄에서 빠짐 · 예약 상태 published', (await v('drafts/' + 온1 + '/published')) === true && (await v('releaseQueue/' + c1.planId)) === null && (await v('plans/' + c1.planId + '/schedule/state')) === 'published');
  재기('다시 공개 → 「이미」(두 번째 묶음 없음)', (await 부름(R.prepRelease, OP, { planId: c1.planId })).already === true);
  재기('공개 뒤 제작 방향 다시 확정 → 거절(정정을 쓰라)', 거절(await 부름(P.prepConfirmOrder, OP, { studentId: 'Mina', lessonDate: '2026-10-09', settings: 설정() }), 'PUBLISHED'));
  재기('공개 뒤 보류 → 거절', 거절(await 부름(R.prepLessonControl, OP, { planId: c1.planId, action: 'hold' }), 'PUBLISHED'));
  재기('자동 공개는 기본값을 건드리지 않는다(교재 기본값 없음 그대로)', !(await v('students/Mina/preferences/paper')));

  console.log('\n── 학생이 받는다(서버 경유) · 남은 못 받는다');
  const 목록 = await 부름(P.prepListMyAssignments, 'u-mina', {}, 학생('Mina'));
  재기('민아 목록에 이 숙제(10월 2주) · 세트 둘', 목록.status === 'ok' && 목록.assignments.some(a => a.assignmentId === c1.planId + '_hw' && a.period.week === 2 && a.sets.length === 2), JSON.stringify(목록));
  const 받음 = await 부름(P.prepGetAssignment, 'u-mina', { assignmentId: c1.planId + '_hw' }, 학생('Mina'));
  재기('민아가 받은 문항에는 정답·해설이 없다 · 그림은 있다', 받음.sets && !JSON.stringify(받음.sets).includes('"answer"') && !JSON.stringify(받음.sets).includes('explanation') && JSON.stringify(받음.sets).includes('<svg'), JSON.stringify(받음).slice(0, 300));
  재기('아론이 민아 것을 달라면 「없음」', 거절(await 부름(P.prepGetAssignment, 'u-aron', { assignmentId: c1.planId + '_hw' }, 학생('Aron')), 'NO-ASSIGNMENT'));
  await db.ref(ROOT + '/config/autoRelease').set(false);
  재기('자동 공개 스위치를 꺼도 공개된 숙제는 그대로 읽힌다', !!(await 부름(P.prepGetAssignment, 'u-mina', { assignmentId: c1.planId + '_hw' }, 학생('Mina'))).sets);

  console.log('\n── ⑨ 공개된 내용 정정 — 옛 판 기록 · 지난 제출은 당시 채점 그대로');
  const 제출1 = await 부름(P.prepSubmit, 'u-mina', { assignmentId: c1.planId + '_hw', setId: 's2', rev: 1, answers: { q0: 'C', q1: 'C' } }, 학생('Mina'));
  재기('정정 전 제출: q0 정답 B → C 는 틀림(50점)', 제출1.ok && 제출1.score === 50, JSON.stringify(제출1));
  재기('까닭 없이 정정 → 거절', 거절(await 부름(R.prepCorrectRelease, OP, { assignmentId: c1.planId + '_hw', setId: 's2', qid: 'q0', changes: { answer: 'C' } }), 'NO-REASON'));
  const 정정 = await 부름(R.prepCorrectRelease, OP, { assignmentId: c1.planId + '_hw', setId: 's2', qid: 'q0', changes: { answer: 'C' }, reason: '정답 표기 잘못' });
  const 뒤 = await v('releases/' + c1.planId + '_hw');
  재기('정정 → 판 2 · 기록(전·후·까닭) · 검증값 바뀜', 정정.ok && 뒤.releaseRev === 2 && 뒤.manifestHash !== 공개.manifestHash && Object.values(뒤.corrections)[0].reason === '정답 표기 잘못' && Object.values(뒤.corrections)[0].before.answer === 'B', JSON.stringify(정정));
  재기('옛 판(1) 전체가 releaseHistory 에 남는다', (await v('releaseHistory/' + c1.planId + '_hw/1/manifestHash')) === 공개.manifestHash);
  const 지난 = await v('submissions/' + c1.planId + '_hw/Mina/s2/revs/1/grade');
  재기('지난 제출은 당시 정답표 점수 그대로(50 · 다시 채점 안 함)', 지난 && 지난.score === 50, JSON.stringify(지난));
  const 제출2 = await 부름(P.prepSubmit, 'u-mina', { assignmentId: c1.planId + '_hw', setId: 's2', rev: 2, answers: { q0: 'C', q1: 'C' } }, 학생('Mina'));
  재기('정정 뒤 새 제출은 새 정답표로(100)', 제출2.ok && 제출2.score === 100, JSON.stringify(제출2));
  재기('바뀐 것이 없으면 정정 거절', 거절(await 부름(R.prepCorrectRelease, OP, { assignmentId: c1.planId + '_hw', setId: 's2', qid: 'q0', changes: { answer: 'C' }, reason: 'x' }), 'NOTHING'));

  console.log('\n── 휴강 · 수업일 변경 · 공개 직전 판 변경 · 미완성 · 이어 쓰기 (일꾼 없이 서버만 — PC 꺼짐)');
  await db.ref(ROOT + '/config/autoRelease').set(true);
  const 휴 = await 준비('Mina', '2026-10-16');
  재기('휴강', (await 부름(R.prepLessonControl, OP, { planId: 휴.planId, action: 'cancel' })).ok && (await v('releaseQueue/' + 휴.planId)) === null);
  await R._internals.tickOnce(Z('2026-10-16T09:05:00Z'));
  재기('휴강이면 20:05 에도 공개 안 함', !(await v('releases/' + 휴.aid)));
  const 휴수동 = await 부름(R.prepRelease, OP, { planId: 휴.planId });
  재기('휴강이면 원장 공개도 막힘', 거절(휴수동, 'NOT-READY') && 휴수동.details.reasons.some(x => x.key === 'cancelled'));
  재기('휴강 되살리기 → 다시 줄에', (await 부름(R.prepLessonControl, OP, { planId: 휴.planId, action: 'restore' })).ok && (await v('releaseQueue/' + 휴.planId)) === Z('2026-10-16T09:00:00Z'));

  const 바 = await 준비('Aron', '2026-10-30');
  const 바꿈 = await 부름(R.prepLessonControl, OP, { planId: 바.planId, action: 'changeDate', newDate: '2026-11-02' });
  재기('수업일 변경 10-30 → 11-02 · 공개 시각 다시 셈(월 넘김)', 바꿈.ok && 바꿈.schedule.releaseAt === Z('2026-11-02T09:00:00Z') && (await v('releaseQueue/' + 바.planId)) === Z('2026-11-02T09:00:00Z'), JSON.stringify(바꿈.schedule));
  재기('옛 날짜·옛 시각은 기록에만(바뀐 전후)', Object.values((await v('plans/' + 바.planId + '/schedule/history')) || {}).some(h => h.from === '2026-10-30' && h.to === '2026-11-02'));
  await R._internals.tickOnce(Z('2026-10-30T09:05:00Z'));
  재기('옛 시각(10-30 20:05)에는 공개 안 함', !(await v('releases/' + 바.aid)));
  await R._internals.tickOnce(Z('2026-11-02T09:00:30Z'));
  const 바공개 = await v('releases/' + 바.aid);
  재기('새 시각(11-02 20:00)에 공개 · 주차는 새 수업일(11월 1주)', 바공개 && 바공개.cause === 'scheduled' && 바공개.period.month === 11 && 바공개.period.week === 1 && 바공개.lessonDate === '2026-11-02', JSON.stringify(바공개 && 바공개.period));

  const 직전 = await 준비('Mina', '2026-10-23');
  const 새판 = await 부름(P.prepConfirmOrder, OP, { studentId: 'Mina', lessonDate: '2026-10-23', settings: 설정() });
  await R._internals.tickOnce(Z('2026-10-23T09:00:00Z'));
  const 직전까닭 = await v('plans/' + 직전.planId + '/schedule/lastCheck');
  재기('공개 직전에 판이 바뀜 → 옛 초안은 공개 안 함(까닭: 승인 없음/판 다름)', 새판.ok && !(await v('releases/' + 직전.aid)) && 직전까닭 && 직전까닭.reasons.some(x => x.key === 'no-paper-approval' || /stale/.test(x.key)), JSON.stringify(직전까닭));

  const 덜 = await 준비('Aron', '2026-12-31');
  await db.ref(ROOT + '/drafts/' + 덜.online + '/sets/1/questions/1').remove();
  const 덜수동 = await 부름(R.prepRelease, OP, { planId: 덜.planId });
  재기('미완성(TS 세트 문항 하나 빠짐) → 원장 공개도 막힘', 거절(덜수동, 'NOT-READY') && 덜수동.details.reasons.some(x => x.key === 'incomplete'), JSON.stringify(덜수동.details));
  await R._internals.tickOnce(Z('2026-12-31T09:00:00Z'));
  재기('연말 12-31 20:00 예약도 미완성이면 공개 안 함', !(await v('releases/' + 덜.aid)));

  const 이어 = await 준비('Mina', '2027-01-08');
  // 문지기는 통과했는데(released 적힘) 묶음을 쓰기 전에 함수가 죽은 경우
  await db.ref(ROOT + '/plans/' + 이어.planId).update({ released: { rev: 이어.rev, draftId: 이어.online, aid: 이어.aid, cause: 'scheduled', at: '2027-01-08T09:00:00.000Z', manifestHash: 'x' }, 'schedule/state': 'published' });
  await R._internals.tickOnce(Z('2027-01-08T09:01:00Z'));
  const 이어공개 = await v('releases/' + 이어.aid);
  재기('반쯤 된 공개 → 다음 분에 이어 써서 하나로 끝남', 이어공개 && 이어공개.published === true && (await v('releaseQueue/' + 이어.planId)) === null, JSON.stringify(이어공개 && 이어공개.cause));

  console.log('\n── ④ 홈페이지 초안 고치기 · ③ 교재 부분 수정 요청');
  const 고 = await 준비('Aron', '2027-02-05');
  const 고침 = await 부름(R.prepEditOnline, OP, { draftId: 고.online, edits: [{ set: 0, q: 0, text: 'Q0 (fixed)', answer: '7' }] });
  const 새초안 = await v('drafts/' + 고침.draftId);
  재기('새 초안(_e1) · 옛 초안 그대로 · 원장 고침 표시 · 문항 판 올림', 고침.ok && 고침.draftId === 고.online + '_e1' && 새초안.parentDraftId === 고.online
    && (await v('drafts/' + 고.online + '/sets/0/questions/0/text')) === 'Q0' && 새초안.manifest[0].verify === 'teacher-edited' && 새초안.manifest[0].itemRevision === 2, JSON.stringify(고침));
  재기('옛 초안을 또 고치려면 거절(새 것을 고쳐라)', 거절(await 부름(R.prepEditOnline, OP, { draftId: 고.online, edits: [{ set: 0, q: 1, text: 'x' }] }), 'SUPERSEDED'));
  const 고공개 = await 부름(R.prepRelease, OP, { planId: 고.planId });
  재기('공개는 고친 초안으로(원장 조기 공개 · 10-?? 전)', 고공개.ok && (await v('releases/' + 고.aid + '/draftId')) === 고침.draftId && (await v('releases/' + 고.aid + '/cause')) === 'manual', JSON.stringify(고공개));

  const 수 = await 부름(P.prepConfirmOrder, OP, { studentId: 'Aron', lessonDate: '2027-02-12', settings: 설정() });
  const 수종이 = await 종이초안(수.planId, 수.rev, 'Aron', '2027-02-12');
  재기('TS 문항 고치기 → 거절(창고 문항은 다시 고르기만)', 거절(await 부름(R.prepRequestRevision, OP, { draftId: 수종이, edits: [{ slot: 't002', action: 'edit', stem: 'x' }] }), 'TS-EDIT'));
  const 수요청 = await 부름(R.prepRequestRevision, OP, { draftId: 수종이, edits: [{ slot: 'm001', action: 'edit', answer: '5' }, { slot: 't002', action: 'regenerate' }] });
  const 수주문 = await v('jobs/' + 수요청.jobId);
  재기('MR 고침 + TS 다시 고르기 → prep-revise 주문 · 영향 = 테스트지·교재·학생용·답지·원본·검수', 수요청.ok && 수주문.type === 'prep-revise' && 수주문.revision === 1 && 수주문.affects.files.join() === 'book,items,qa,student,teacher,test', JSON.stringify(수주문 && 수주문.affects));
  const 조판만 = await 부름(R.prepRequestRevision, OP, { draftId: 수종이, layout: { fontSize: 12 } });
  재기('조판만 → 내용 유지 안내', 조판만.ok && 조판만.affects.notes.some(x => /조판만/.test(x)));
  재기('조판 값이 범위 밖이면 거절', 거절(await 부름(R.prepRequestRevision, OP, { draftId: 수종이, layout: { fontSize: 40 } }), 'BAD-LAYOUT'));

  await db.ref().set(null);
  console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
  process.exit(실패 ? 1 : 0);
})().catch(e => { console.log('  ⛔ 터졌다: ' + (e && e.stack || e)); console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + (실패 + 1)); process.exit(1); });
