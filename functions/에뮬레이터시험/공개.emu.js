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
  // [10-02 B] 공개는 숙제 관리와 같은 칸에 들어간다 — 명단(반·학년)과 그 주 칸(기존 세트 + TS 가지)을 심어 둔다
  await db.ref('solomon_hw_v3/users').set([
    { id: 'Mina', role: 'student', year: 5, country: 'AU', group: '', status: 'active' },
    { id: 'Aron', role: 'student', year: 9, country: 'AU', group: '', status: 'active' },
    { id: 'Kim5', role: 'student', year: 5, country: 'AU', group: 'K반', status: 'active' },
    { id: 't5', role: 'student', year: 5, country: 'AU', group: '', status: 'active', isTest: true }]);
  await db.ref('solomon_hw_v3/homeworkSets/AU_y5_2026_m10_w2').set({ country: 'AU', year: 5, group: '', period: { year: 2026, month: 10, week: 2 }, published: true,
    sets: [{ setIdx: 0, title: 'Set 1 (숙제 관리에서 올린 것)', questions: [{ id: 'q0', text: 'old', type: 'sa', answer: '1' }] }], ts: { questions: [{ id: 'ts-x' }], published: true } });
  const 칸 = async (k) => (await db.ref('solomon_hw_v3/homeworkSets/' + k).once('value')).val();
  const 공개됨 = async (planId) => !!(await v('plans/' + planId + '/released/slot'));
  const 들어간 = async (planId) => { const sl = await v('plans/' + planId + '/released/slot'); if (!sl) return null; const k = await 칸(sl.key); return { sl, sets: ((k && k.sets) || []).filter(x => x.prep && x.prep.planId === planId) }; };

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
  재기('19:59 → 줄에서 안 꺼냄(공개 0)', r.length === 0 && !(await 공개됨(c1.planId)));
  r = await R._internals.tickOnce(Z('2026-10-09T09:00:00Z'));
  const lc1 = await v('plans/' + c1.planId + '/schedule/lastCheck');
  재기('20:00 · 스위치 꺼짐 → 공개 안 함 · 까닭을 남김', !(await 공개됨(c1.planId)) && lc1 && lc1.reasons.some(x => x.key === 'switch-off'), JSON.stringify(lc1));
  await R._internals.tickOnce(Z('2026-10-09T09:01:00Z'));
  재기('같은 까닭이면 다시 쓰지 않는다(매분 쓰기 없음)', (await v('plans/' + c1.planId + '/schedule/lastCheck/at')) === lc1.at);
  await db.ref(ROOT + '/config/autoRelease').set(true);
  재기('보류', (await 부름(R.prepLessonControl, OP, { planId: c1.planId, action: 'hold' })).ok && (await v('releaseQueue/' + c1.planId)) === null);
  await R._internals.tickOnce(Z('2026-10-09T09:02:00Z'));
  재기('보류 중 20:02 → 공개 안 함', !(await 공개됨(c1.planId)));
  const 보류중수동 = await 부름(R.prepRelease, OP, { planId: c1.planId });
  재기('보류 중 원장 공개도 막힘(먼저 해제)', 거절(보류중수동, 'NOT-READY') && 보류중수동.details.reasons.some(x => x.key === 'held'));
  재기('보류는 저절로 안 풀린다 — 원장이 해제', (await v('plans/' + c1.planId + '/schedule/state')) === 'held' && (await 부름(R.prepLessonControl, OP, { planId: c1.planId, action: 'unhold' })).ok
    && (await v('releaseQueue/' + c1.planId)) === Z('2026-10-09T09:00:00Z'));

  console.log('\n── 공개 경쟁 — 원장 공개와 예약이 동시에 · [10-02 B] 숙제 관리와 같은 칸에 덧붙인다');
  const [가, 나, 다] = await Promise.all([R._internals.releaseCore(c1.planId, 'manual', Z('2026-10-09T09:03:00Z'), OP), R._internals.tickOnce(Z('2026-10-09T09:03:00Z')), R._internals.releaseCore(c1.planId, 'manual', Z('2026-10-09T09:03:00Z'), OP)]);
  const 민칸 = await 칸('AU_y5_2026_m10_w2');
  const 기록들 = Object.values((await v('releaseLog')) || {}).filter(x => x.aid === c1.planId + '_hw');
  const 새세트 = (민칸.sets || []).filter(x => x.prep && x.prep.aid === c1.planId + '_hw');
  재기('동시에 셋이 와도 칸에는 한 번만(세트 둘) · 공개 기록도 하나', 새세트.length === 2 && 기록들.length === 1, JSON.stringify({ 가, 나, 다, n: 기록들.length, sets: (민칸.sets || []).length }));
  재기('숙제 관리 칸 그대로: 기존 Set 1 뒤에 Set 2·3 으로 덧붙음(제목 · 순번)', 민칸.sets.length === 3 && 민칸.sets[0].title === 'Set 1 (숙제 관리에서 올린 것)' && 민칸.sets[1].setIdx === 1 && /^Set 2 \(/.test(민칸.sets[1].title) && 민칸.sets[2].setIdx === 2, JSON.stringify(민칸.sets.map(x => x.title)));
  재기('TS 가지(TS 교사 화면 몫)는 손대지 않음 · 칸은 공개 그대로', 민칸.ts && 민칸.ts.published === true && Object.keys(민칸.ts).length === 2 && 민칸.ts.questions.length === 1 && 민칸.ts.questions[0].id === 'ts-x' && 민칸.published === true);
  재기('문항은 홈페이지 꼴(정답 글자·해설·그림·hint 칸) — 숙제 관리 등록과 같은 모양', 새세트[1].questions[0].answer === 'B' && 새세트[1].questions[0].figure && 새세트[0].questions[0].hint1 === '' && 새세트[0].createdAt && Array.isArray(새세트[0].calculatorRanges) === false);
  재기('계획에 들어간 자리 기록(칸 · Set 2~3) · 개인 숙제 길(releases)은 안 씀', JSON.stringify(await v('plans/' + c1.planId + '/released/slot/key')) === '"AU_y5_2026_m10_w2"' && (await v('plans/' + c1.planId + '/released/slot/from')) === 1 && !(await v('releases/' + c1.planId + '_hw')));
  재기('초안 = 공개됨 · 줄에서 빠짐 · 예약 상태 published', (await v('drafts/' + 온1 + '/published')) === true && (await v('releaseQueue/' + c1.planId)) === null && (await v('plans/' + c1.planId + '/schedule/state')) === 'published');
  재기('다시 공개 → 「이미」(칸에 또 안 넣음)', (await 부름(R.prepRelease, OP, { planId: c1.planId })).already === true && ((await 칸('AU_y5_2026_m10_w2')).sets || []).length === 3);
  재기('공개 뒤 제작 방향 다시 확정 → 거절', 거절(await 부름(P.prepConfirmOrder, OP, { studentId: 'Mina', lessonDate: '2026-10-09', settings: 설정() }), 'PUBLISHED'));
  재기('공개 뒤 보류 → 거절', 거절(await 부름(R.prepLessonControl, OP, { planId: c1.planId, action: 'hold' }), 'PUBLISHED'));
  재기('자동 공개는 기본값을 건드리지 않는다(교재 기본값 없음 그대로)', !(await v('students/Mina/preferences/paper')));
  const 목록 = await 부름(P.prepListMyAssignments, 'u-mina', {}, 학생('Mina'));
  재기('학생 개인 숙제 길에는 아무것도 없다 → 아이 화면은 숙제 칸(MR + TS)을 그대로 쓴다', 목록.status === 'none', JSON.stringify(목록));
  재기('공개 뒤 정정 함수는 칸 공개에 쓰지 않는다(숙제 관리에서 고침)', 거절(await 부름(R.prepCorrectRelease, OP, { assignmentId: c1.planId + '_hw', setId: 's1', qid: 'q0', changes: { answer: 'C' }, reason: 'x' }), 'NO-RELEASE'));
  재기('반 없는 아이(민아)의 공통 칸 → 반 있는 같은 학년 아이(K반)에게 빈 칸막이 · 테스트 계정은 안 세움', (await 칸('AU_y5-K반_2026_m10_w2') || {})._placeholder === true);
  await db.ref(ROOT + '/config/autoRelease').set(false);

  console.log('\n── [10-02 B] 숙제 칸 사정 — 비공개 칸 · 옛 제출이 있으면 멈춘다');
  {
    const 숨 = await 준비('Mina', '2027-02-19');
    await db.ref('solomon_hw_v3/homeworkSets/AU_y5_2027_m02_w3').set({ country: 'AU', year: 5, group: '', period: { year: 2027, month: 2, week: 3 }, published: false, sets: [] });
    const 숨r = await 부름(R.prepRelease, OP, { planId: 숨.planId });
    재기('숙제 관리에서 그 주 칸을 비공개로 해 두었으면 멈춤(원장 뜻을 안 바꿈)', 거절(숨r, 'NOT-READY') && 숨r.details.reasons.some(x => x.key === 'slot-hidden'), JSON.stringify(숨r.details));
    await db.ref('solomon_hw_v3/homeworkSets/AU_y5_2027_m02_w3/published').set(true);
    await db.ref('solomon_hw_v3/submissions/Mina_2027_m02_w3_s1').set({ submitted: true, answers: { q0: 'A' } });
    const 옛r = await 부름(R.prepRelease, OP, { planId: 숨.planId });
    재기('덧붙일 자리(Set 2)에 옛 제출 기록이 있으면 멈춤(숙제 관리에서 정리)', 거절(옛r, 'NOT-READY') && 옛r.details.reasons.some(x => x.key === 'slot-stale'), JSON.stringify(옛r.details));
    await db.ref('solomon_hw_v3/submissions/Mina_2027_m02_w3_s1').remove();
    const 됨r = await 부름(R.prepRelease, OP, { planId: 숨.planId });
    재기('정리하고 다시 → 공개(Set 1~2)', 됨r.ok && 됨r.slot === 'AU_y5_2027_m02_w3' && 됨r.from === 0 && 됨r.count === 2, JSON.stringify(됨r));
  }

  console.log('\n── 휴강 · 수업일 변경 · 공개 직전 판 변경 · 미완성 · 이어 쓰기 (일꾼 없이 서버만 — PC 꺼짐)');
  await db.ref(ROOT + '/config/autoRelease').set(true);
  const 휴 = await 준비('Mina', '2026-10-16');
  재기('휴강', (await 부름(R.prepLessonControl, OP, { planId: 휴.planId, action: 'cancel' })).ok && (await v('releaseQueue/' + 휴.planId)) === null);
  await R._internals.tickOnce(Z('2026-10-16T09:05:00Z'));
  재기('휴강이면 20:05 에도 공개 안 함', !(await 공개됨(휴.planId)));
  const 휴수동 = await 부름(R.prepRelease, OP, { planId: 휴.planId });
  재기('휴강이면 원장 공개도 막힘', 거절(휴수동, 'NOT-READY') && 휴수동.details.reasons.some(x => x.key === 'cancelled'));
  재기('휴강 되살리기 → 다시 줄에', (await 부름(R.prepLessonControl, OP, { planId: 휴.planId, action: 'restore' })).ok && (await v('releaseQueue/' + 휴.planId)) === Z('2026-10-16T09:00:00Z'));

  const 바 = await 준비('Aron', '2026-10-30');
  const 바꿈 = await 부름(R.prepLessonControl, OP, { planId: 바.planId, action: 'changeDate', newDate: '2026-11-02' });
  재기('수업일 변경 10-30 → 11-02 · 공개 시각 다시 셈(월 넘김)', 바꿈.ok && 바꿈.schedule.releaseAt === Z('2026-11-02T09:00:00Z') && (await v('releaseQueue/' + 바.planId)) === Z('2026-11-02T09:00:00Z'), JSON.stringify(바꿈.schedule));
  재기('옛 날짜·옛 시각은 기록에만(바뀐 전후)', Object.values((await v('plans/' + 바.planId + '/schedule/history')) || {}).some(h => h.from === '2026-10-30' && h.to === '2026-11-02'));
  await R._internals.tickOnce(Z('2026-10-30T09:05:00Z'));
  재기('옛 시각(10-30 20:05)에는 공개 안 함', !(await 공개됨(바.planId)));
  await R._internals.tickOnce(Z('2026-11-02T09:00:30Z'));
  const 바공개 = await 들어간(바.planId);
  재기('새 시각(11-02 20:00)에 공개 · 칸은 새 수업일 주(11월 1주 · Y9)', 바공개 && 바공개.sl.key === 'AU_y9_2026_m11_w1' && 바공개.sets.length === 2 && 바공개.sets[0].prep.cause === 'scheduled', JSON.stringify(바공개 && 바공개.sl));

  const 직전 = await 준비('Mina', '2026-10-23');
  const 새판 = await 부름(P.prepConfirmOrder, OP, { studentId: 'Mina', lessonDate: '2026-10-23', settings: 설정() });
  await R._internals.tickOnce(Z('2026-10-23T09:00:00Z'));
  const 직전까닭 = await v('plans/' + 직전.planId + '/schedule/lastCheck');
  재기('공개 직전에 판이 바뀜 → 옛 초안은 공개 안 함(까닭: 승인 없음/판 다름)', 새판.ok && !(await 공개됨(직전.planId)) && 직전까닭 && 직전까닭.reasons.some(x => x.key === 'no-paper-approval' || /stale/.test(x.key)), JSON.stringify(직전까닭));

  const 덜 = await 준비('Aron', '2026-12-31');
  await db.ref(ROOT + '/drafts/' + 덜.online + '/sets/1/questions/1').remove();
  const 덜수동 = await 부름(R.prepRelease, OP, { planId: 덜.planId });
  재기('미완성(TS 세트 문항 하나 빠짐) → 원장 공개도 막힘', 거절(덜수동, 'NOT-READY') && 덜수동.details.reasons.some(x => x.key === 'incomplete'), JSON.stringify(덜수동.details));
  await R._internals.tickOnce(Z('2026-12-31T09:00:00Z'));
  재기('연말 12-31 20:00 예약도 미완성이면 공개 안 함', !(await 공개됨(덜.planId)));

  const 이어 = await 준비('Mina', '2027-01-08');
  // 문지기는 통과했는데(released 적힘) 묶음을 쓰기 전에 함수가 죽은 경우
  await db.ref(ROOT + '/plans/' + 이어.planId).update({ released: { rev: 이어.rev, draftId: 이어.online, aid: 이어.aid, cause: 'scheduled', at: '2027-01-08T09:00:00.000Z', manifestHash: 'x' }, 'schedule/state': 'published' });
  await R._internals.tickOnce(Z('2027-01-08T09:01:00Z'));
  const 이어공개 = await 들어간(이어.planId);
  재기('반쯤 된 공개 → 다음 분에 이어 써서 칸에 한 번만', 이어공개 && 이어공개.sets.length === 2 && (await v('releaseQueue/' + 이어.planId)) === null, JSON.stringify(이어공개 && 이어공개.sl));

  console.log('\n── ④ 홈페이지 초안 고치기 · ③ 교재 부분 수정 요청');
  const 고 = await 준비('Aron', '2027-02-05');
  const 고침 = await 부름(R.prepEditOnline, OP, { draftId: 고.online, edits: [{ set: 0, q: 0, text: 'Q0 (fixed)', answer: '7' }] });
  const 새초안 = await v('drafts/' + 고침.draftId);
  재기('새 초안(_e1) · 옛 초안 그대로 · 원장 고침 표시 · 문항 판 올림', 고침.ok && 고침.draftId === 고.online + '_e1' && 새초안.parentDraftId === 고.online
    && (await v('drafts/' + 고.online + '/sets/0/questions/0/text')) === 'Q0' && 새초안.manifest[0].verify === 'teacher-edited' && 새초안.manifest[0].itemRevision === 2, JSON.stringify(고침));
  재기('옛 초안을 또 고치려면 거절(새 것을 고쳐라)', 거절(await 부름(R.prepEditOnline, OP, { draftId: 고.online, edits: [{ set: 0, q: 1, text: 'x' }] }), 'SUPERSEDED'));
  const 고공개 = await 부름(R.prepRelease, OP, { planId: 고.planId });
  const 고칸 = await 들어간(고.planId);
  재기('공개는 고친 초안으로(원장 조기 공개)', 고공개.ok && 고칸.sets[0].prep.draftId === 고침.draftId && 고칸.sets[0].prep.cause === 'manual' && 고칸.sets[0].questions[0].text === 'Q0 (fixed)', JSON.stringify(고공개));

  const 수 = await 부름(P.prepConfirmOrder, OP, { studentId: 'Aron', lessonDate: '2027-02-12', settings: 설정() });
  const 수종이 = await 종이초안(수.planId, 수.rev, 'Aron', '2027-02-12');
  재기('TS 문항 고치기 → 거절(창고 문항은 다시 고르기만)', 거절(await 부름(R.prepRequestRevision, OP, { draftId: 수종이, edits: [{ slot: 't002', action: 'edit', stem: 'x' }] }), 'TS-EDIT'));
  const 수요청 = await 부름(R.prepRequestRevision, OP, { draftId: 수종이, edits: [{ slot: 'm001', action: 'edit', answer: '5' }, { slot: 't002', action: 'regenerate' }] });
  const 수주문 = await v('jobs/' + 수요청.jobId);
  재기('MR 고침 + TS 다시 고르기 → prep-revise 주문 · 영향 = 테스트지·교재·학생용·답지·원본·검수', 수요청.ok && 수주문.type === 'prep-revise' && 수주문.revision === 1 && 수주문.affects.files.join() === 'book,items,qa,student,teacher,test', JSON.stringify(수주문 && 수주문.affects));
  const 조판만 = await 부름(R.prepRequestRevision, OP, { draftId: 수종이, layout: { fontSize: 12 } });
  재기('조판만 → 내용 유지 안내', 조판만.ok && 조판만.affects.notes.some(x => /조판만/.test(x)));
  재기('조판 값이 범위 밖이면 거절', 거절(await 부름(R.prepRequestRevision, OP, { draftId: 수종이, layout: { fontSize: 40 } }), 'BAD-LAYOUT'));

  console.log('\n── [10-02] 프로젝트 결과물 등록(prepAdoptImport)');
  {
    const q = (i, x) => Object.assign({ id: 'q' + i, text: 'P' + i, type: 'sa', answer: String(i), hint1: '', hint2: '', explanation: 'e', srcId: 'Y7-W4-ST1-Q0' + i, taxonomy_id: 'MR.Y7.MEAS.AREA.RECT', source: 'toolchain' }, x || {});
    await db.ref(ROOT + '/importSets/imp1').set([{ setIdx: 0, title: 'Set 1 (Y7 M2 Area - Set 1)', questions: [q(0), q(1, { type: 'mc', options: ['1', '2', '3', '4'], answer: 'B' })] },
      { setIdx: 1, title: 'Set 2 (Y7 M2 Area - Set 2)', questions: [q(2), q(3)] }]);
    await db.ref(ROOT + '/imports/imp1').set({ folder: '2026-09/2026-09-20', folderDate: '2026-09-20', questions: 'Y7_M2_Area_2026-09-W4_Stella_questions.json', students: ['Mina'],
      files: [{ name: 'Y7_T4_M2_Area_Workbook_Stella_2026-09-W4.pdf', students: ['Mina'] }, { name: 'Y7_T4_M2_Area_KeyIdeas_EN-KO_2026-09-W4.pdf', students: [] }, { name: 'X_Minjun.pdf', students: ['Aron'] }],
      ok: true, setSizes: [2, 2], count: 4, status: 'new' });
    await db.ref(ROOT + '/imports/bad').set({ folder: 'x', folderDate: '2026-09-20', questions: 'bad_questions.json', students: [], ok: false, problems: ['정답 충돌'], status: 'new' });
    재기('원장 아니면 거절', 거절(await 부름(R.prepAdoptImport, 'u-mina', { importId: 'imp1', studentId: 'Mina', lessonDate: '2027-03-05' }, 학생('Mina')), 'OPERATOR-ONLY'));
    재기('못 바꾼 결과물은 등록 안 됨(까닭과 함께)', 거절(await 부름(R.prepAdoptImport, OP, { importId: 'bad', studentId: 'Mina', lessonDate: '2027-03-05' }), 'BAD-IMPORT'));
    // 같은 수업일에 주간 설정으로 확정해 둔 주문이 있으면 → 등록이 새 판이 되고 옛 주문·초안은 멈춘다
    const 앞 = await 부름(P.prepConfirmOrder, OP, { studentId: 'Mina', lessonDate: '2027-03-05', settings: 설정() });
    await 종이초안(앞.planId, 앞.rev, 'Mina', '2027-03-05');
    const 등 = await 부름(R.prepAdoptImport, OP, { importId: 'imp1', studentId: 'Mina', lessonDate: '2027-03-05' });
    재기('등록 → 새 판(2) · 교재 초안 · 홈페이지 초안 · 2세트 4문항 · 이 학생 PDF 2개(남의 것 뺌)', 등.ok && 등.rev === 2 && 등.sets === 2 && 등.count === 4 && 등.files === 2, JSON.stringify(등));
    const 판2 = (await v('plans/' + 등.planId + '/revisions/2')) || {};
    재기('판에 출처 = 프로젝트 · 결과물 id · 폴더', 판2.source === 'import' && 판2.importId === 'imp1' && 판2.folder === '2026-09/2026-09-20');
    재기('옛 판 대기 주문은 취소 · 옛 교재 초안은 무효', (await v('jobs/' + 앞.jobId + '/status')) === 'cancelled' && (await v('drafts/' + 앞.planId + '_r1_paper_aaaa/invalidatedByRev')) === 2);
    const 교 = await v('drafts/' + 등.paperId), 온 = await v('drafts/' + 등.onlineId);
    재기('교재 초안 = 승인됨(이번 주만 · 등록으로) · 파일 종류(교재·핵심정리)', 교.approval.approved === true && 교.approval.via === 'import' && 교.files.map(f => f.kind).join() === 'book,keyideas', JSON.stringify(교.files));
    재기('홈페이지 초안: 문항 id·분류·출처 그대로 · 검증 = 툴체인 재유도', 온.sets[0].questions[1].srcId === 'Y7-W4-ST1-Q01' && 온.sets[0].questions[1].taxonomy_id === 'MR.Y7.MEAS.AREA.RECT' && 온.manifest.every(m => m.verify === 'toolchain-verified'));
    const st = await 부름(R.prepReleaseStatus, OP, { planId: 등.planId });
    재기('등록하자마자 원장 공개 조건 ✅(교재 승인·수량 확인·초안 다 있음)', st.manual.ok, JSON.stringify(st.manual.reasons));
    const 공 = await 부름(R.prepRelease, OP, { planId: 등.planId });
    const 묶 = await 들어간(등.planId);
    재기('지금 공개 → 숙제 칸(3월 1주 · Y5)에 2세트 · 문항 id·분류 그대로', 공.ok && 묶.sl.key === 'AU_y5_2027_m03_w1' && 묶.sets.length === 2 && 묶.sets[0].questions[1].srcId === 'Y7-W4-ST1-Q01' && 묶.sets[0].questions[0].source === 'toolchain', JSON.stringify(묶 && 묶.sl));
    재기('결과물 = 등록됨 · 두 번 등록 막힘', (await v('imports/imp1/status')) === 'adopted' && 거절(await 부름(R.prepAdoptImport, OP, { importId: 'imp1', studentId: 'Mina', lessonDate: '2027-03-12' }), 'ALREADY'));
    await db.ref(ROOT + '/imports/imp2').set({ folder: 'y', folderDate: '2026-09-20', questions: 'z_questions.json', students: [], ok: true, setSizes: [2], count: 2, status: 'new' });
    await db.ref(ROOT + '/importSets/imp2').set([{ setIdx: 0, title: 'S', questions: [q(0), q(1)] }]);
    재기('공개된 수업에는 등록 못 함', 거절(await 부름(R.prepAdoptImport, OP, { importId: 'imp2', studentId: 'Mina', lessonDate: '2027-03-05' }), 'PUBLISHED'));
    재기('숨기기', (await 부름(R.prepDismissImport, OP, { importId: 'imp2' })).ok && (await v('imports/imp2/status')) === 'dismissed');
  }

  await db.ref().set(null);
  console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
  process.exit(실패 ? 1 : 0);
})().catch(e => { console.log('  ⛔ 터졌다: ' + (e && e.stack || e)); console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + (실패 + 1)); process.exit(1); });
