// 코덱스 주간 점검(2026-10-05) F1·F7 — **진짜 DB(에뮬레이터)·트랜잭션**으로
//
//   firebase emulators:exec --only database,auth --project demo-solomon "node functions/에뮬레이터시험/점검1005.emu.js"
//
//   F1 ① 제출 X → 새로 풀기 → 늦게 온 X  ⇒ 칸은 빈 채(제출 아님)
//      ② 새로 풀기 A → 새로 풀기 B → 새 답 C → 늦게 온 A  ⇒ C 그대로
//   F7 약점 반영 전·끝에 오류 주입 → weakPending → 같은 opId 다시 → 결국 반영 · 두 번 세지 않음
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

// ── 오류 주입: hw_submit 이 부르기 전에 약점 반영을 감싼다('전' = 아무것도 안 하고 실패 · '끝' = 다 하고 응답만 실패)
const W = require(path.join(__dirname, '..', 'weakness_merge'));
const 진짜 = W.applyWeaknessJob;
let 주입 = null;
W.applyWeaknessJob = async (root, job) => {
  const 이번 = 주입; 주입 = null;
  if (이번 === '전') throw new Error('주입: 약점 반영 전 끊김');
  const r = await 진짜(root, job);
  if (이번 === '끝') throw new Error('주입: 약점 반영 뒤 응답 끊김');
  return r;
};
const H = require(path.join(__dirname, '..', 'hw_submit'));

let 통과 = 0, 실패 = 0;
function 재기(이름, 참, 덧) { if (참) { 통과++; console.log('  ✅ ' + 이름); } else { 실패++; console.log('  ⛔ ' + 이름 + (덧 ? '\n       ' + 덧 : '')); } }
async function 부름(fn, prep, data) {
  try { return await fn.run({ auth: { uid: 'u-' + prep.sid, token: { prep } }, data, rawRequest: { ip: '127.0.0.1', headers: {} } }); }
  catch (e) { return { err: (e.code || '') + '/' + (e.message || '') }; }
}
const 미나 = { sid: 'Mina', role: 'student', master: false, exp: Date.now() + 3600e3 };
const K = 'Mina_2026_m10_w1_s0', HK = 'AU_y5_2026_m10_w1', SUB = 'solomon_hw_v3/submissions/' + K;
const 읽기 = async (p) => (await db.ref(p).once('value')).val();
const 제출 = (opId, answers) => 부름(H.hwSubmit, 미나, { key: K, hwKey: HK, setIdx: 0, answers, sent: {}, opId });
const 새로 = (opId) => 부름(H.hwStartFresh, 미나, { key: K, hwKey: HK, opId });

(async () => {
  await db.ref().set(null);
  await db.ref('solomon_hw_v3').set({
    users: [{ id: 'Mina', role: 'student', name: '민아', year: 5 }],
    homeworkSets: { [HK]: { sets: [{ title: 'Set 1', questions: [
      { id: 'q0', text: 'What is 2 + 3?', answer: 'B', type: 'mc', taxonomy_id: 'MR.Y5.A' },
      { id: 'q1', text: 'Area of rectangle', answer: '12', type: 'sa', taxonomy_id: 'MR.Y5.B' }] }] } },
  });

  console.log('── F1 ① 제출 X → 새로 풀기 → 늦게 온 X');
  const x1 = await 제출('op_X_aaaa01', { q0: 'B', q1: '12' });
  const f1 = await 새로('op_F_aaaa01');
  const x2 = await 제출('op_X_aaaa01', { q0: 'B', q1: '12' });
  const v1 = await 읽기(SUB);
  재기('X 새 제출 → 새로 풀기 → 늦게 온 X 는 dup', x1.kind === 'new' && f1.kind === 'new' && x2.kind === 'dup', JSON.stringify([x1.kind, f1.kind, x2.kind || x2.err]));
  재기('칸은 빈 채 · 제출 아님 · 보관함에 B', v1.submitted === false && !v1.answers && v1._prev && Object.values(v1._prev)[0].answers.q0 === 'B', JSON.stringify(v1));
  재기('응답의 칸도 지금 서버 칸(빈 칸)이다 — 화면이 이것으로 사본을 맞춘다', x2.sub && x2.sub.submitted === false);

  console.log('\n── F1 ② 새로 풀기 A → 새로 풀기 B → 새 답 C → 늦게 온 A');
  await db.ref(SUB).set({ answers: { q0: 'A' }, submitted: true, rev: 1 });
  await 새로('op_FA_bbbb01');
  await 새로('op_FB_bbbb01');
  await db.ref(SUB + '/answers/q0').set('C');                       // 아이가 새로 푸는 중
  const a2 = await 새로('op_FA_bbbb01');
  const v2 = await 읽기(SUB);
  재기('늦게 온 A → dup · 진행 중인 답 C 그대로 · 보관함 2개', a2.kind === 'dup' && v2.answers.q0 === 'C' && Object.keys(v2._prev).length === 2, JSON.stringify(v2));

  console.log('\n── F7 약점 반영 전에 끊김 → 같은 opId 다시');
  await db.ref(SUB).set(null); await db.ref('solomon_hw_v3/weakness').set(null);
  주입 = '전';
  const w1 = await 제출('op_W_cccc01', { q0: 'B', q1: '9' });
  재기('제출은 저장 · weakPending', w1.kind === 'new' && w1.weakPending === true && (await 읽기(SUB)).submitted === true, JSON.stringify(w1.kind || w1.err));
  재기('약점은 아직 없음', !(await 읽기('solomon_hw_v3/weakness/Mina')));
  const w2 = await 제출('op_W_cccc01', { q0: 'B', q1: '9' });
  const 약 = await 읽기('solomon_hw_v3/weakness/Mina');
  재기('다시 보내면 dup · weakPending 없음 · 약점 두 분류 반영', w2.kind === 'dup' && w2.weakPending === false && 약 && Object.keys(약.skills || {}).length === 2, JSON.stringify(약 && 약.skills));
  재기('rev 그대로 1(다시 채점 안 함)', (await 읽기(SUB)).rev === 1);

  console.log('\n── F7 약점 반영은 됐는데 응답만 끊김 → 다시 보내도 두 번 안 센다');
  주입 = '끝';
  await 제출('op_W_cccc01', { q0: 'B', q1: '9' });                   // dup 길에서 반영(이미 됨) 뒤 끊김
  const w4 = await 제출('op_W_cccc01', { q0: 'B', q1: '9' });
  const 약2 = await 읽기('solomon_hw_v3/weakness/Mina');
  const 셈 = Object.values(약2.skills).map(s => s.attempts).join(',');
  재기('분류마다 attempts 1 그대로', 셈 === '1,1' && w4.weakPending === false, 셈);

  await db.ref().set(null);
  console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
  process.exit(실패 ? 1 : 0);
})().catch(e => { console.log('  ⛔ 터졌다: ' + (e && e.stack || e)); console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + (실패 + 1)); process.exit(1); });
