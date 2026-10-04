// [점검 10-05 F6] 서버가 「이 아이에게 걸린 숙제인가」를 본다 — **진짜 DB(에뮬레이터)** 로
//
//   firebase emulators:exec --only database,auth --project demo-solomon "node functions/에뮬레이터시험/배정1005.emu.js"
//
//   막기 켬(HW_ASSIGN_ENFORCE=1): 본인 반 ✅ · 반 칸 없을 때 공통 ✅ · 다른 반·다른 나라·칸막이 있는데 공통 ⛔NOT-ASSIGNED
//                                 · 비공개 ⛔NOT-PUBLISHED · 반 옮긴 뒤 옛 반 ⛔ · 새로 풀기도 같은 검사
//   기록만(기본): 위의 거절 경우가 **성공**하고 sol_v4/ops/assignWarn 에만 남는다
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
async function 부름(fn, sid, data) {
  const prep = { sid, role: 'student', master: false, exp: Date.now() + 3600e3 };
  try { return await fn.run({ auth: { uid: 'u-' + sid, token: { prep } }, data, rawRequest: { ip: '127.0.0.1', headers: {} } }); }
  catch (e) { return { err: (e.code || '') + '/' + (e.message || '') }; }
}
let 번호 = 0;
const op = () => 'op_as_' + (++번호) + '_' + Date.now();
const W = '_2026_m10_w2';
const 세트 = { sets: Array.from({ length: 7 }, (_, i) => ({ title: 'S' + i, questions: [{ id: 'q0', text: '2+3?', answer: 'B', type: 'mc' }] })) };   // 칸 _s0~_s6
const 제출 = (sid, hwKey, s = 0) => 부름(H.hwSubmit, sid, { key: sid + W + '_s' + s, hwKey, setIdx: 0, answers: { q0: 'B' }, sent: {}, opId: op() });
const 새로 = (sid, hwKey, s = 0) => 부름(H.hwStartFresh, sid, { key: sid + W + '_s' + s, hwKey, opId: op() });
const 거절됨 = (r, 코드) => !!(r && r.err && r.err.includes('permission-denied') && r.err.includes(코드));

(async () => {
  await db.ref().set(null);
  await db.ref('solomon_hw_v3').set({
    users: [
      { id: 'Sean', role: 'student', year: 5, country: 'AU', group: '션' },     // 반 있음 · 반 칸 있음
      { id: 'Amy', role: 'student', year: 5, country: 'AU', group: '' },       // 반 없음
      { id: 'Kei', role: 'student', year: 5, country: 'AU', group: '키이라' }, // 반 있음 · 반 칸 없음 → 공통
      { id: 'Jun', role: 'student', year: 5, country: 'AU', group: '민준' },   // 반 칸막이만 있음
    ],
    homeworkSets: {
      ['AU_y5' + W]: 세트,
      ['AU_y5-션' + W]: 세트,
      ['AU_y5-민준' + W]: { published: true, sets: [], _placeholder: true },
      ['NZ_y5' + W]: 세트,
      ['AU_y5-닫힘' + W]: Object.assign({ published: false }, 세트),
    },
  });

  console.log('── 막기 켬');
  process.env.HW_ASSIGN_ENFORCE = '1';
  재기('① 본인 반 숙제 → 성공', (await 제출('Sean', 'AU_y5-션' + W)).kind === 'new');
  재기('② 반 없는 아이 · 공통 → 성공', (await 제출('Amy', 'AU_y5' + W)).kind === 'new');
  재기('② 반 칸 없는 반 아이 · 공통 → 성공', (await 제출('Kei', 'AU_y5' + W)).kind === 'new');
  재기('③ 반 칸 있는 아이가 공통 → NOT-ASSIGNED', 거절됨(await 제출('Sean', 'AU_y5' + W, 1), 'NOT-ASSIGNED'));
  재기('③ 반 없는 아이가 다른 반 → NOT-ASSIGNED', 거절됨(await 제출('Amy', 'AU_y5-션' + W, 1), 'NOT-ASSIGNED'));
  재기('④ 다른 나라 → NOT-ASSIGNED', 거절됨(await 제출('Amy', 'NZ_y5' + W, 1), 'NOT-ASSIGNED'));
  const r5 = await 제출('Jun', 'AU_y5' + W);
  재기('⑤ 반 칸막이가 있는데 공통 → NOT-ASSIGNED', 거절됨(r5, 'NOT-ASSIGNED'), JSON.stringify(r5));
  재기('거절된 칸은 안 생긴다', !(await db.ref('solomon_hw_v3/submissions/Jun' + W + '_s0').once('value')).val());

  // ⑥ 비공개 — 반 칸을 비공개로 돌린 뒤 그 반 숙제로 제출
  await db.ref('solomon_hw_v3/homeworkSets/AU_y5-션' + W + '/published').set(false);
  재기('⑥ 비공개 숙제 → NOT-PUBLISHED', 거절됨(await 제출('Sean', 'AU_y5-션' + W, 2), 'NOT-PUBLISHED'));
  await db.ref('solomon_hw_v3/homeworkSets/AU_y5-션' + W + '/published').remove();

  // ⑦ 반 옮김 — Sean 이 반을 잃은 뒤 옛 반 숙제를 다시 보냄
  await db.ref('solomon_hw_v3/users/0/group').set('');
  재기('⑦ 반 옮긴 뒤 옛 반 숙제 → NOT-ASSIGNED', 거절됨(await 제출('Sean', 'AU_y5-션' + W, 3), 'NOT-ASSIGNED'));
  { const r7 = await 제출('Sean', 'AU_y5' + W, 3); 재기('⑦ 옮긴 뒤 공통 숙제는 → 성공', r7.kind === 'new', JSON.stringify(r7.err || r7.kind)); }
  await db.ref('solomon_hw_v3/users/0/group').set('션');

  // ⑧ 새로 풀기도 같은 검사
  재기('⑧ 새로 풀기 · 다른 반 → NOT-ASSIGNED', 거절됨(await 새로('Amy', 'AU_y5-션' + W), 'NOT-ASSIGNED'));
  재기('⑧ 새로 풀기 · 본인 숙제 → 성공', (await 새로('Amy', 'AU_y5' + W)).kind === 'new');
  const 기록켬 = Object.values((await db.ref('sol_v4/ops/assignWarn').once('value')).val() || {});
  재기('막은 것도 기록에 남는다(enforced:true)', 기록켬.length >= 6 && 기록켬.every(x => x.enforced === true), String(기록켬.length));

  console.log('\n── 기록만(기본)');
  delete process.env.HW_ASSIGN_ENFORCE;
  await db.ref('sol_v4/ops/assignWarn').remove();
  const a = await 제출('Amy', 'AU_y5-션' + W, 4);
  const b = await 새로('Amy', 'NZ_y5' + W, 5);
  재기('⑨ 다른 반 제출이 성공한다(지금과 같음)', a.kind === 'new', JSON.stringify(a.err || a.kind));
  재기('⑨ 다른 나라 새로 풀기도 지금처럼 돈다', !b.err, JSON.stringify(b.err || b.kind));
  const 기록 = Object.values((await db.ref('sol_v4/ops/assignWarn').once('value')).val() || {});
  재기('⑨ 둘 다 기록에만 남는다(enforced:false · 무엇을 기대했는지까지)', 기록.length === 2 && 기록.every(x => x.enforced === false && x.why === 'NOT-ASSIGNED' && x.expect === 'AU_y5' + W), JSON.stringify(기록));
  const c = await 제출('Sean', 'AU_y5-션' + W, 6);
  재기('정상 제출은 기록도 안 남긴다', c.kind === 'new' && Object.keys((await db.ref('sol_v4/ops/assignWarn').once('value')).val() || {}).length === 2);

  await db.ref().set(null);
  console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
  process.exit(실패 ? 1 : 0);
})().catch(e => { console.log('  ⛔ 터졌다: ' + (e && e.stack || e)); console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + (실패 + 1)); process.exit(1); });
