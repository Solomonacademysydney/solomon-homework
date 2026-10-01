// 4단계 제작 주문 확정 일꾼(prepConfirmOrder) — 진짜 DB·인증(에뮬레이터)
//   firebase emulators:exec --only database,auth --project demo-solomon "node functions/에뮬레이터시험/주문.emu.js"
// 지시서: 제작 방향 확정 시 커리·결과 기준 시각·규격 판·수업일·검수 기준 스냅샷을 고정하고 주문을 만든다.
//         확정 판은 수정 불가. 판 변경 시 새 판과 관련 초안 무효화 기록. 자유 지시 해석 불가는 보류.
'use strict';
const path = require('path');
const DB = process.env.FIREBASE_DATABASE_EMULATOR_HOST, AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!DB || !AUTH || !/^(127\.0\.0\.1|localhost):\d+$/.test(DB)) { console.log('⛔ 에뮬레이터 변수가 없습니다'); console.log('\n셈 — 통과 0 · 실패 1'); process.exit(1); }
const admin = require(path.join(__dirname, '..', 'node_modules', 'firebase-admin'));
admin.initializeApp({ projectId: 'demo-solomon', databaseURL: `http://${DB}?ns=demo-solomon` });
const db = admin.database();
const P = require(path.join(__dirname, '..', 'prep_session'));
const O = require(path.join(__dirname, '..', 'order_core'));
const OP = '62bxWubzDLMrhHjjv2oNfAQiyaD2';
let 통과 = 0, 실패 = 0;
function 재기(이름, 참, 덧) { if (참) { 통과++; console.log('  ✅ ' + 이름); } else { 실패++; console.log('  ⛔ ' + 이름 + (덧 ? '\n       ' + 덧 : '')); } }
async function 부름(uid, data) {
  try { return await P.prepConfirmOrder.run({ auth: uid ? { uid, token: { uid } } : undefined, data }); }
  catch (e) { return { err: (e.code || '') + '/' + (e.message || ''), details: e.details }; }
}
const 거절 = (r, 말) => !!(r && r.err && r.err.includes(말));

(async () => {
  await db.ref().set(null);
  await db.ref('sol_prep_v1/students/Mina').set({
    profile: { currentCurriculum: 'r2' },
    curricula: { r1: { lessons: [] }, r2: { lessons: [{ date: '2026-10-07', mr: '분수 덧셈', ts: '수열', reviewRatio: 30, targetLevel: 4 }] } } });
  const s = O.defaultSettings(); s.ts.include = false; s.paperHw.perSet = s.paperHw.perSet.map(x => ({ mr: x.mr + x.ts, ts: 0 })); s.frontTest.includeTS = false; s.onlineHw.tsSets = 0;
  s.mr.review.sets = 0;   // 생략

  console.log('── 문지기');
  재기('원장 아닌 사람 → 거절', 거절(await 부름('someone', { studentId: 'Mina', lessonDate: '2026-10-07', settings: s }), 'OPERATOR-ONLY'));
  const 나쁨 = O.defaultSettings(); 나쁨.composition.mcPct = 90;
  const r나쁨 = await 부름(OP, { studentId: 'Mina', lessonDate: '2026-10-07', settings: 나쁨 });
  재기('설정이 틀리면 거절(까닭을 함께)', 거절(r나쁨, 'BAD-SETTINGS') && r나쁨.details && r나쁨.details.problems.length > 0, JSON.stringify(r나쁨));
  const 상충 = O.defaultSettings(); 상충.ts.include = false;
  재기('상충이 남아 있으면 거절', 거절(await 부름(OP, { studentId: 'Mina', lessonDate: '2026-10-07', settings: 상충 }), 'BAD-SETTINGS'));
  재기('자유 지시에 못 알아들은 말이 남아 있으면 보류(거절)', 거절(await 부름(OP, { studentId: 'Mina', lessonDate: '2026-10-07', settings: s, unresolved: ['잘 부탁해요'] }), 'FREE-TEXT-UNRESOLVED'));
  재기('날짜 꼴이 틀리면 거절', 거절(await 부름(OP, { studentId: 'Mina', lessonDate: '10/7', settings: s }), 'BAD-INPUT'));

  console.log('\n── 판 1 확정 — 스냅샷 · 주문');
  const r1 = await 부름(OP, { studentId: 'Mina', lessonDate: '2026-10-07', settings: s, thisWeekOnly: ['layout.fontSize'], freeText: 'TS 빼줘', freeTextApplied: ['TS 제외'] });
  재기('확정 → 판 1 · 주문 하나', r1.ok && r1.planId === 'Mina_20261007_1' && r1.rev === 1 && !!r1.jobId, JSON.stringify(r1));
  const v1 = (await db.ref('sol_prep_v1/plans/Mina_20261007_1/revisions/1').once('value')).val() || {};
  재기('스냅샷: 커리 판 r2 · 그 수업(분수 덧셈) · 결과 기준 시각 · 규격 판 · 검수 기준 · 수업일', v1.snapshot && v1.snapshot.curriculumRev === 'r2' && v1.snapshot.curriculumLesson.mr === '분수 덧셈'
    && !!v1.snapshot.resultsAsOf && v1.snapshot.specVersion === 'order-v1' && v1.snapshot.qaVersion === 'qa-v1' && v1.snapshot.lessonDate === '2026-10-07', JSON.stringify(v1.snapshot));
  재기('명세: MR만(TS 없음) · 종합문제 생략 · 숙제 30+0 × 2', v1.spec && !v1.spec.parts.some(p => /^ts/.test(p.kind)) && !v1.spec.parts.some(p => p.kind === 'mr-review')
    && v1.spec.parts.find(p => p.kind === 'paper-hw').total === 60, JSON.stringify(v1.spec && v1.spec.parts.map(p => p.kind)));
  재기('「이번 주만」·자유 지시가 판에 남는다', JSON.stringify(v1.thisWeekOnly) === '["layout.fontSize"]' && v1.freeText === 'TS 빼줘');
  const j1 = (await db.ref('sol_prep_v1/jobs/' + r1.jobId).once('value')).val() || {};
  재기('주문 = 대기(queued) · 주인 없음 · 판 1', j1.status === 'queued' && !j1.owner && j1.rev === 1 && j1.planId === 'Mina_20261007_1', JSON.stringify(j1));

  console.log('\n── 판 2 — 옛 판은 그대로 · 관련 초안 무효 기록');
  await db.ref('sol_prep_v1/drafts').set({
    d1: { studentId: 'Mina', planId: 'Mina_20261007_1', planRev: 1, published: false },
    d2: { studentId: 'Mina', planId: 'Mina_20261007_1', planRev: 1, published: true },
    d3: { studentId: 'Aron', planId: 'Aron_20261007_1', planRev: 1, published: false } });
  const s2 = O.defaultSettings();   // TS 다시 넣음
  const r2 = await 부름(OP, { studentId: 'Mina', lessonDate: '2026-10-07', settings: s2 });
  재기('판 2', r2.ok && r2.rev === 2 && r2.jobId !== r1.jobId, JSON.stringify(r2));
  const v1b = (await db.ref('sol_prep_v1/plans/Mina_20261007_1/revisions/1').once('value')).val() || {};
  재기('확정 판 1 은 바뀌지 않는다', JSON.stringify(v1b.spec) === JSON.stringify(v1.spec) && v1b.confirmedAt === v1.confirmedAt);
  const v2 = (await db.ref('sol_prep_v1/plans/Mina_20261007_1/revisions/2').once('value')).val() || {};
  재기('판 2 에 무효로 한 초안 기록(d1 만 — 공개된 d2·남의 d3 는 아님)', JSON.stringify(v2.invalidatedDrafts) === '["d1"]', JSON.stringify(v2.invalidatedDrafts));
  const 초안 = (await db.ref('sol_prep_v1/drafts').once('value')).val();
  재기('d1 에 무효 표시 · d2·d3 그대로', 초안.d1.invalidatedByRev === 2 && !초안.d2.invalidatedByRev && !초안.d3.invalidatedByRev, JSON.stringify(초안));
  재기('옛 판 주문(대기)은 취소', ((await db.ref('sol_prep_v1/jobs/' + r1.jobId).once('value')).val() || {}).status === 'cancelled');
  재기('latest = 2', (await db.ref('sol_prep_v1/plans/Mina_20261007_1/latest').once('value')).val() === 2);
  await db.ref('sol_prep_v1/jobs/' + r2.jobId).update({ status: 'running', owner: 'ts-worker' });
  const r3 = await 부름(OP, { studentId: 'Mina', lessonDate: '2026-10-07', settings: s });
  재기('판 3 — 일꾼이 잡아 돌던 옛 주문은 「취소 요청」(멋대로 끊지 않음)', r3.ok && ((await db.ref('sol_prep_v1/jobs/' + r2.jobId).once('value')).val() || {}).status === 'cancel-requested');

  await db.ref().set(null);
  console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
  process.exit(실패 ? 1 : 0);
})().catch(e => { console.log('  ⛔ 터졌다: ' + (e && e.stack || e)); console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + (실패 + 1)); process.exit(1); });
