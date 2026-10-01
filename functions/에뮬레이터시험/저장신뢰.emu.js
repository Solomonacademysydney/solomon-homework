// 1단계 저장 신뢰성 — **진짜 데이터베이스(에뮬레이터)** 에서 돌린다.
//
//   실행(E:/AA0/HP 에서):
//     firebase emulators:exec --only database --project demo-solomon "node functions/에뮬레이터시험/저장신뢰.emu.js"
//
// ⛔ 운영 DB 에는 절대 안 붙는다 — FIREBASE_DATABASE_EMULATOR_HOST 가 없거나 프로젝트가 demo-* 가
//    아니면 바로 멈춘다(emulators:exec 가 그 변수를 넣어 준다).
// 가짜 서버 시험(화면시험/약점_반영.test.js 등)이 못 보는 것 — **진짜 트랜잭션**(첫 호출에 null 이
// 오는 것 포함) · 진짜 열쇠 규칙(점이 든 경로는 터진다) · 여러 탭이 동시에 반영하는 경우.

'use strict';
const fs = require('fs');
const path = require('path');

const 호스트 = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
const 프로젝트 = 'demo-solomon';
if (!호스트 || !/^(127\.0\.0\.1|localhost):\d+$/.test(호스트)) {
  console.log('⛔ 에뮬레이터 변수(FIREBASE_DATABASE_EMULATOR_HOST)가 없습니다 — 운영 DB 보호를 위해 멈춥니다.');
  console.log('\n셈 — 통과 0 · 실패 1');
  process.exit(1);
}
const admin = require(path.join(__dirname, '..', 'node_modules', 'firebase-admin'));
const app = admin.initializeApp({ projectId: 프로젝트, databaseURL: `http://${호스트}?ns=${프로젝트}` });
const db = app.database();
const REF = db.ref('solomon_hw_v3');

const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
function 떼기(시작, 끝표) {
  const i = html.indexOf(시작);
  if (i < 0) throw new Error('못 찾음: ' + 시작);
  const j = html.indexOf(끝표, i + 10);
  if (j < 0) throw new Error('끝 못 찾음: ' + 끝표);
  return html.slice(i, j);
}
const 약점소스 = 떼기('// ═══ [1단계] 약점 반영 — 시작', '// ═══ [1단계] 약점 반영 — 끝');
const 정답소스 = 떼기('function normAns(a) {', '\n}\n') + '\n}\n';
const 등록소스 = 떼기('function _hwContentHash(', '\n}\n') + '\n}\n' + 떼기('async function _MR등록확인(', '\n}\n') + '\n}\n';
const 처음소스 = 떼기('async function initStore() {', '\n// period = { year, month, week }');

let 통과 = 0, 실패 = 0;
function 재기(이름, 참, 덧) {
  if (참) { 통과++; console.log('  ✅ ' + 이름); }
  else { 실패++; console.log('  ⛔ ' + 이름 + (덧 ? '\n       ' + 덧 : '')); }
}
const 조용 = { log() {}, warn() {}, info() {}, error() {} };
function 서랍() { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; }
/** 브라우저 탭 하나 — 서랍(localStorage)을 넘기면 「창을 닫았다 다시 연」 탭이 된다. */
function 탭(ls) {
  const w = { fbReady: true, FB_REF: REF, isPreviewMode: false };
  ls = ls || 서랍();
  const F = new Function('window', 'localStorage', 'console', 정답소스 + 약점소스 +
    '\n; return { taxSafeKey, _weaknessJobOf, _weaknessEnqueue, _weaknessQueueRead, _weaknessFlush, applyWeaknessUpdates };')(w, ls, 조용);
  return { F, ls, w };
}
const 값 = async (p) => (await (p ? REF.child(p) : REF).once('value')).val();
// 학생 화면 fbWrite 와 같은 모양으로 제출을 쓴다(update + lastModified)
const 제출쓰기 = (key, data) => REF.update({ ['submissions/' + key]: data, lastModified: Date.now() });

(async () => {
  await db.ref().set(null);
  await REF.set({ users: { 0: { id: 'Mina', role: 'student' } }, submissions: { 기존: { submitted: true, answers: { q0: 'A' } } } });

  console.log('── 뿌리 원인 확인 — 점이 든 분류 ID 는 경로로 못 쓴다(예전 코드가 조용히 실패한 까닭)');
  let 터짐 = null;
  try { await REF.child('weakness/Mina/skills/MR.Y5.NA.add').set({ attempts: 1 }); } catch (e) { 터짐 = e; }
  재기('옛 경로(점 포함)는 진짜 DB 에서 거부된다', !!터짐, 터짐 ? '' : '안 터졌다');

  console.log('\n── 약점 반영 — 저장 확인 뒤 · 한 번만 · 바꿔 끼우기');
  const 문항 = [{ id: 'q0', answer: '2', taxonomy_id: 'MR.Y5.NA.WN.add' },
                { id: 'q1', answer: '3', taxonomy_id: 'MR.Y5.NA.WN.add' },
                { id: 'q2', answer: '4', taxonomy_id: 'MR.Y5.ME.AR.rect' }];
  const SK = 'Mina_2026_m10_w1_s0';
  const A = 탭();
  const k1 = A.F.taxSafeKey('MR.Y5.NA.WN.add'), k2 = A.F.taxSafeKey('MR.Y5.ME.AR.rect');

  // (가) 창이 닫혀 저장 전 — 줄만 있고 서버엔 제출 없음
  A.F._weaknessEnqueue(A.F._weaknessJobOf(문항, { q0: '2', q1: '9', q2: '4' }, 'Mina', SK, 1));
  await A.F._weaknessFlush();
  재기('(가) 서버에 제출이 없으면 약점을 안 쓴다', (await 값('weakness')) === null);
  재기('(가) 줄은 남는다', A.F._weaknessQueueRead().length === 1);

  // (나) 저장은 됐는데 응답이 끊겼다 — 같은 서랍으로 다시 연 탭이 반영한다
  await 제출쓰기(SK, { submitted: true, rev: 1, answers: { q0: '2', q1: '9', q2: '4' } });
  const A2 = 탭(A.ls);
  await A2.F._weaknessFlush();
  const 칸1 = await 값('weakness/Mina/skills/' + k1);
  재기('(나) 다시 연 탭이 반영한다 — 점 든 분류가 안전 키로 써진다', 칸1 && 칸1.attempts === 2 && 칸1.correct === 1, JSON.stringify(칸1));
  재기('(나) 원문 taxonomyId 가 칸에 있다', 칸1 && 칸1.taxonomyId === 'MR.Y5.NA.WN.add');
  재기('(나) 다른 분류도 써진다', ((await 값('weakness/Mina/skills/' + k2)) || {}).attempts === 1);
  재기('(나) 줄이 빈다', A2.F._weaknessQueueRead().length === 0);

  // (다) 같은 제출을 또 — 두 번 눌림 · 재시도 · 다른 탭
  const B = 탭();
  B.F._weaknessEnqueue(B.F._weaknessJobOf(문항, { q0: '2', q1: '9', q2: '4' }, 'Mina', SK, 1));
  await Promise.all([B.F._weaknessFlush(), A2.F.applyWeaknessUpdates(A2.F._weaknessJobOf(문항, { q0: '2', q1: '9', q2: '4' }, 'Mina', SK, 1))]);
  재기('(다) 같은 제출·같은 판은 한 번만', (await 값('weakness/Mina/skills/' + k1)).attempts === 2);

  // (라) 고쳐 낸 제출(rev 2) — 두 탭이 동시에
  await 제출쓰기(SK, { submitted: true, rev: 2, answers: { q0: '2', q1: '3' } });
  const 일2 = (t) => t.F._weaknessJobOf(문항.slice(0, 2), { q0: '2', q1: '3' }, 'Mina', SK, 2);
  const C = 탭(), D = 탭();
  C.F._weaknessEnqueue(일2(C)); D.F._weaknessEnqueue(일2(D));
  await Promise.all([C.F._weaknessFlush(), D.F._weaknessFlush()]);
  const 칸2 = await 값('weakness/Mina/skills/' + k1);
  재기('(라) 새 판은 옛 기여분을 빼고 넣는다 — 두 탭이 동시에 해도 한 번', 칸2.attempts === 2 && 칸2.correct === 2, JSON.stringify(칸2));
  const 칸3 = await 값('weakness/Mina/skills/' + k2);
  재기('(라) 새 판에서 빠진 분류는 옛 기여분만 빠진다', 칸3.attempts === 0 && 칸3.contrib && Object.values(칸3.contrib)[0].rev === 2, JSON.stringify(칸3));

  // (마) 다른 제출은 따로 쌓인다
  const SK2 = 'Mina_2026_m10_w1_s1';
  await 제출쓰기(SK2, { submitted: true, rev: 1 });
  const E = 탭();
  E.F._weaknessEnqueue(E.F._weaknessJobOf([문항[0]], { q0: '1' }, 'Mina', SK2, 1));
  await E.F._weaknessFlush();
  재기('(마) 다른 제출은 더해진다(3회 2정답)', (await 값('weakness/Mina/skills/' + k1)).attempts === 3);

  // (바) 기존 제출 기록은 손대지 않았다
  재기('(바) 옛 제출 기록 그대로', JSON.stringify(await 값('submissions/기존')) === JSON.stringify({ answers: { q0: 'A' }, submitted: true }));

  console.log('\n── MR 등록 확인 — 다시 읽어 견준다');
  const R = new Function('window', 'console', 등록소스 + '\n; return { _hwContentHash, _MR등록확인 };')({ FB_REF: REF }, 조용);
  const 세트 = { title: 'Set 1', questions: [{ id: 'q0', srcId: 'T_A_01', text: '1+1', type: 'sa', answer: '2', taxonomy_id: 'MR.Y5.NA.WN.add', options: null },
                                             { id: 'q1', text: 'pick', type: 'mc', answer: 'B', options: ['a', 'b'] }] };
  const 칸 = 'AU_y5_2026_m10_w1';
  await REF.update({ ['homeworkSets/' + 칸 + '/sets']: [세트], lastModified: Date.now() });
  const 기대 = [{ idx: 0, n: 2, hash: R._hwContentHash(세트.questions) }];
  const 됨 = await R._MR등록확인(칸, 기대);
  재기('서버에 그대로 있으면 ok', 됨.ok, JSON.stringify(됨));
  재기('null 옵션·배열이 서버를 다녀와도 지문이 같다', 됨.ok);
  await REF.child('homeworkSets/' + 칸 + '/sets/0/questions/1/answer').set('C');
  const 틀림 = await R._MR등록확인(칸, 기대);
  재기('서버 내용이 다르면 ok 아님', !틀림.ok && /다릅니다/.test(틀림.문제.join()), JSON.stringify(틀림));
  const 없음 = await R._MR등록확인(칸, [{ idx: 3, n: 2, hash: 'x' }]);
  재기('세트가 없으면 ok 아님', !없음.ok, JSON.stringify(없음));

  console.log('\n── initStore — 뿌리에 안 쓴다');
  const 전 = JSON.stringify(await 값(''));
  let 서랍값 = null;
  const initStore = new Function('window', 'saveStore', 'console', 처음소스 + '\n; return initStore;')(
    { fbReady: true, FB_REF: REF, _storeLoadState: 'empty' }, (d) => { 서랍값 = d; return true; }, 조용);
  await initStore();
  await new Promise(r => setTimeout(r, 300));
  재기('initStore 뒤 서버 뿌리가 그대로', JSON.stringify(await 값('')) === 전);
  재기('이 브라우저 서랍에만 빈 자료', 서랍값 && Array.isArray(서랍값.users));

  await db.ref().set(null);
  console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
  await app.delete();
  process.exit(실패 ? 1 : 0);
})().catch(async e => {
  console.log('  ⛔ 터졌다: ' + (e && e.stack || e));
  console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + (실패 + 1));
  process.exit(1);
});
