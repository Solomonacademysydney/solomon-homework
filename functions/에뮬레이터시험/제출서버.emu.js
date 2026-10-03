// 그룹 숙제 제출·새로 풀기 서버(hw_submit.js) — **진짜 DB(에뮬레이터)·트랜잭션**으로 돌린다 (정비 §5-①② · 2026-10-03)
//
//   firebase emulators:exec --only database,auth --project demo-solomon "node functions/에뮬레이터시험/제출서버.emu.js"
//
// 지키는 것(점검 R5·R6 · T03·T04·T13)
//   ① 오래 열린 창의 옛 답이 다른 창의 새 답을 덮지 않는다(R6) — 서버 답을 지키고 기기 답은 _conflicts
//   ② 새로 풀기 직전에 다른 창이 넣은 답도 보관함에 들어간다(R5)
//   · 같은 opId 두 번 = 한 번 · 이미 정상 제출 → 안 바뀜 · 원장 처리 뒤 아이 제출 → 진짜 제출로
//   · 채점·리포트·약점은 서버가 · 마스터·학부모·남의 열쇠·다른 학년 → 거절
'use strict';
const path = require('path');
const DB = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const 프로젝트 = 'demo-solomon';
if (!DB || !AUTH || !/^(127\.0\.0\.1|localhost):\d+$/.test(DB) || !/^(127\.0\.0\.1|localhost):\d+$/.test(AUTH)) {
  console.log('⛔ DB·인증 에뮬레이터 변수가 없습니다 — 운영 보호를 위해 멈춥니다.');
  console.log('\n셈 — 통과 0 · 실패 1');
  process.exit(1);
}
const admin = require(path.join(__dirname, '..', 'node_modules', 'firebase-admin'));
admin.initializeApp({ projectId: 프로젝트, databaseURL: `http://${DB}?ns=${프로젝트}` });
const db = admin.database();
const H = require(path.join(__dirname, '..', 'hw_submit'));

let 통과 = 0, 실패 = 0;
function 재기(이름, 참, 덧) { if (참) { 통과++; console.log('  ✅ ' + 이름); } else { 실패++; console.log('  ⛔ ' + 이름 + (덧 ? '\n       ' + 덧 : '')); } }
const 한시간 = () => Date.now() + 3600e3;
async function 부름(fn, prep, data) {
  try { return await fn.run({ auth: prep ? { uid: 'u-' + (prep.sid || 'x'), token: { prep } } : undefined, data: data || {}, rawRequest: { ip: '127.0.0.1', headers: {} } }); }
  catch (e) { return { err: (e.code || '') + '/' + (e.message || '') }; }
}
const 학생 = (sid, 덧) => Object.assign({ sid, role: 'student', master: false, exp: 한시간() }, 덧);
const K = 'Mina_2026_m10_w1_s0', HK = 'AU_y5_2026_m10_w1', SUB = 'solomon_hw_v3/submissions/' + K;
let 번호 = 0;
const op = () => 'op_emu_' + (++번호) + '_' + Date.now();

(async () => {
  await db.ref().set(null);
  await db.ref('solomon_hw_v3').set({
    users: [{ id: 'Mina', role: 'student', name: '민아', year: 5 }, { id: 'Ben', role: 'student', name: '벤', year: 9 }],
    homeworkSets: { [HK]: { sets: [{ title: 'Set 1', questions: [
      { id: 'q0', text: 'What is 2 + 3?', answer: 'B', type: 'mc', taxonomy_id: 'MR.Y5.A' },
      { id: 'q1', text: 'Area of rectangle', answer: '12', type: 'sa', taxonomy_id: 'MR.Y5.B' }] }] } },
  });
  const 미나 = 학생('Mina');

  console.log('── 거절이 먼저');
  재기('세션 없음', (await 부름(H.hwSubmit, null, { key: K, hwKey: HK, opId: op() })).err?.includes('unauthenticated'));
  재기('마스터 보기', (await 부름(H.hwSubmit, 학생('Mina', { master: true }), { key: K, hwKey: HK, opId: op() })).err?.includes('MASTER'));
  재기('학부모', (await 부름(H.hwSubmit, { sid: 'P', role: 'parent', exp: 한시간(), kids: { Mina: true } }, { key: K, hwKey: HK, opId: op() })).err?.includes('READONLY'));
  재기('남의 열쇠', (await 부름(H.hwSubmit, 미나, { key: 'Ben_2026_m10_w1_s0', hwKey: HK, opId: op() })).err?.includes('NOT-YOURS'));
  재기('다른 학년 숙제', (await 부름(H.hwSubmit, 미나, { key: K, hwKey: 'AU_y9_2026_m10_w1', opId: op() })).err?.includes('NOT-YOUR-YEAR'));
  재기('세션 끝', (await 부름(H.hwSubmit, 학생('Mina', { exp: Date.now() - 1 }), { key: K, hwKey: HK, opId: op() })).err?.includes('EXPIRED'));

  console.log('\n── ① 옛 창의 옛 답이 새 답을 덮지 않는다(R6)');
  await db.ref(SUB).set({ answers: { q0: 'B' }, submitted: false });           // 다른 창이 1번에 B 를 넣어 둠
  const r1 = await 부름(H.hwSubmit, 미나, { key: K, hwKey: HK, setIdx: 0, answers: { q0: 'A', q1: '12' }, sent: {}, opId: 'op_r6_aaaa' });
  const v1 = (await db.ref(SUB).once('value')).val();
  재기('서버의 B 가 남고 · 옛 창 A 는 _conflicts', v1.answers.q0 === 'B' && Object.values(v1._conflicts || {}).some(x => x.mine === 'A'), JSON.stringify(v1));
  재기('채점은 최종 답(B·12 → 100점) · rev 1 · 약점 반영', v1.reportData.score === 100 && v1.rev === 1 && v1.submitted === true, JSON.stringify(v1.reportData));
  const 약점 = (await db.ref('solomon_hw_v3/weakness/Mina').once('value')).val();
  재기('약점이 서버에서 반영됐다(두 분류)', 약점 && 약점.skills && Object.keys(약점.skills).length === 2, JSON.stringify(약점 && Object.keys(약점)));
  재기('화면에 알릴 충돌 목록', r1.conflicts && r1.conflicts[0] === 'q0' && r1.kind === 'new');

  console.log('\n── T13 같은 opId 두 번 · 이미 제출된 칸');
  const r2 = await 부름(H.hwSubmit, 미나, { key: K, hwKey: HK, setIdx: 0, answers: { q0: 'A', q1: '12' }, sent: {}, opId: 'op_r6_aaaa' });
  const v2 = (await db.ref(SUB).once('value')).val();
  재기('같은 opId → 하나로(rev 그대로 1)', r2.kind === 'dup' && v2.rev === 1);
  const r3 = await 부름(H.hwSubmit, 미나, { key: K, hwKey: HK, setIdx: 0, answers: { q0: 'C' }, sent: {}, opId: 'op_other_bbbb' });
  const v3 = (await db.ref(SUB).once('value')).val();
  재기('이미 정상 제출 → 바뀌지 않고 C 는 _conflicts', r3.kind === 'already' && v3.answers.q0 === 'B' && v3.rev === 1 && Object.values(v3._conflicts || {}).some(x => x.mine === 'C'));

  console.log('\n── ② 새로 풀기 직전에 들어온 답도 보관(R5)');
  await db.ref(SUB + '/answers/q1').set('99');                                  // (관리자) 마지막 순간 다른 값
  const f1 = await 부름(H.hwStartFresh, 미나, { key: K, hwKey: HK, opId: 'op_fresh_1111' });
  const v4 = (await db.ref(SUB).once('value')).val();
  const 보관 = Object.values(v4._prev || {});
  재기('보관함 마지막에 서버 칸 그대로(q1 99 포함)', 보관.length === 1 && 보관[0].answers.q1 === '99' && 보관[0].reportData.score === 100, JSON.stringify(보관));
  재기('비워지고 제출 false', v4.submitted === false && !v4.answers && !v4.reportData, JSON.stringify(v4));
  const f2 = await 부름(H.hwStartFresh, 미나, { key: K, hwKey: HK, opId: 'op_fresh_1111' });
  재기('같은 opId 새로 풀기 두 번 → 보관 하나', f2.kind === 'dup' && Object.values((await db.ref(SUB + '/_prev').once('value')).val()).length === 1);

  console.log('\n── 새로 푼 뒤 다시 제출 · 원장 처리 뒤 제출');
  await db.ref(SUB + '/answers').set({ q0: 'A' });                               // 학생이 새로 푼 답(항목 쓰기)
  const r4 = await 부름(H.hwSubmit, 미나, { key: K, hwKey: HK, setIdx: 0, answers: { q0: 'A', q1: '12' }, sent: { q0: 'A' }, opId: 'op_re_cccc' });
  const v5 = (await db.ref(SUB).once('value')).val();
  재기('rev 2 · 점수 50 · 이전 보관함 그대로', v5.rev === 2 && v5.reportData.score === 50 && Object.values(v5._prev).length === 1, JSON.stringify({ rev: v5.rev, s: v5.reportData.score }));
  await db.ref('solomon_hw_v3/submissions/Mina_2026_m10_w1_s1').set({ answers: {}, submitted: true, manuallyMarked: true, markedBy: 'T' });
  await db.ref('solomon_hw_v3/homeworkSets/' + HK + '/sets/1').set({ title: 'Set 2', questions: [{ id: 'q0', text: 'x', answer: 'A', type: 'mc' }] });
  const r5 = await 부름(H.hwSubmit, 미나, { key: 'Mina_2026_m10_w1_s1', hwKey: HK, setIdx: 1, answers: { q0: 'A' }, sent: {}, opId: 'op_mm_dddd' });
  const v6 = (await db.ref('solomon_hw_v3/submissions/Mina_2026_m10_w1_s1').once('value')).val();
  재기('원장 처리 칸에 아이가 내면 진짜 제출로(표시 지움)', r5.kind === 'new' && !v6.manuallyMarked && v6.reportData.score === 100);

  console.log('\n── T04 두 창이 동시에 제출(트랜잭션)');
  await db.ref('solomon_hw_v3/submissions/Mina_2026_m10_w1_s0').set({ answers: {}, submitted: false });
  const [a, b] = await Promise.all([
    부름(H.hwSubmit, 미나, { key: K, hwKey: HK, setIdx: 0, answers: { q0: 'B', q1: '12' }, sent: {}, opId: 'op_two_1111' }),
    부름(H.hwSubmit, 미나, { key: K, hwKey: HK, setIdx: 0, answers: { q0: 'C', q1: '12' }, sent: {}, opId: 'op_two_2222' })]);
  const v7 = (await db.ref(SUB).once('value')).val();
  재기('한 번만 확정(rev 1) · 다른 창의 다른 답은 _conflicts', v7.rev === 1 && [a.kind, b.kind].sort().join() === 'already,new' && Object.keys(v7._conflicts || {}).length >= 1, JSON.stringify({ a, b, v7 }));

  await db.ref().set(null);
  console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
  process.exit(실패 ? 1 : 0);
})().catch(e => { console.log('  ⛔ 터졌다: ' + (e && e.stack || e)); console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + (실패 + 1)); process.exit(1); });
