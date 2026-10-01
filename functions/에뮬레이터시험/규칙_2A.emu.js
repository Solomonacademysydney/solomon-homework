// 2-A 규칙 — 새 뿌리 sol_prep_v1 · (꺼 둔) 제출 잠금 초안 — **에뮬레이터**에서 허용·거절을 다 본다.
//
//   실행(E:/AA0/HP 에서):
//     firebase emulators:exec --only database --project demo-solomon "node functions/에뮬레이터시험/규칙_2A.emu.js"
//
// ⛔ 규칙 파일은 공개 저장소에 안 올린다(firebase.json 주의 글) — backup/ 에 있다:
//      backup/database.rules.2A_sol_prep_v1.json       ← 2-A 판(운영 LIVE 10-01 + sol_prep_v1)
//      backup/database.rules.2B_제출잠금초안.json        ← 2-B 에서 켤 판(지금은 안 씀)
//    이 시험은 그 파일을 에뮬레이터에 **올려 놓고** 돈다(운영 규칙과 무관).
// 사용자 토큰은 서명 없는 JWT 로 만든다 — 에뮬레이터는 서명을 안 본다(운영에서는 통하지 않는다).

'use strict';
const fs = require('fs');
const path = require('path');

const DB = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
const NS = 'demo-solomon';
if (!DB || !/^(127\.0\.0\.1|localhost):\d+$/.test(DB)) {
  console.log('⛔ DB 에뮬레이터 변수가 없습니다 — 운영 보호를 위해 멈춥니다.');
  console.log('\n셈 — 통과 0 · 실패 1');
  process.exit(1);
}
const 뿌리 = path.join(__dirname, '..', '..');
const 규칙2A = path.join(뿌리, 'backup', 'database.rules.2A_sol_prep_v1.json');
const 규칙2B = path.join(뿌리, 'backup', 'database.rules.2B_제출잠금초안.json');
for (const f of [규칙2A, 규칙2B]) if (!fs.existsSync(f)) { console.log('⛔ 규칙 파일 없음: ' + f); console.log('\n셈 — 통과 0 · 실패 1'); process.exit(1); }

const OP = '62bxWubzDLMrhHjjv2oNfAQiyaD2';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
function 토큰(uid, 덧) {
  if (!uid) return null;
  const now = Math.floor(Date.now() / 1000);
  const body = Object.assign({ iss: 'https://securetoken.google.com/' + NS, aud: NS, sub: uid, user_id: uid,
    iat: now, exp: now + 3600, auth_time: now, firebase: { sign_in_provider: 'anonymous', identities: {} } }, 덧 || {});
  return b64({ alg: 'none', typ: 'JWT' }) + '.' + b64(body) + '.';
}
async function 요청(방법, 경로, 값, uid, 덧) {
  // ⛔ 실측(10-01): 에뮬레이터는 `Authorization: Bearer <아무 토큰>` 을 **관리자로** 본다 — 규칙 시험이
  //    다 통과해 버린다. 사용자 토큰은 반드시 `?auth=` 로 보낸다(그때만 규칙이 걸린다). 관리자만 Bearer owner.
  const 관리자 = uid === 'owner';
  const t = 관리자 ? null : 토큰(uid, 덧);
  const url = `http://${DB}/${경로}.json?ns=${NS}` + (t ? '&auth=' + t : '');
  const r = await fetch(url, { method: 방법, headers: 관리자 ? { Authorization: 'Bearer owner' } : {}, body: 값 === undefined ? undefined : JSON.stringify(값) });
  return r.status;
}
const 읽기 = (경로, uid, 덧) => 요청('GET', 경로, undefined, uid, 덧);
const 쓰기 = (경로, 값, uid, 덧) => 요청('PUT', 경로, 값, uid, 덧);
const 됨 = (s) => s === 200;
const 막힘 = (s) => s === 401 || s === 403;

let 통과 = 0, 실패 = 0;
function 재기(이름, 참, 덧) {
  if (참) { 통과++; console.log('  ✅ ' + 이름); }
  else { 실패++; console.log('  ⛔ ' + 이름 + (덧 !== undefined ? '\n       ' + 덧 : '')); }
}
async function 규칙올리기(f) {
  const s = await 요청('PUT', '.settings/rules', JSON.parse(fs.readFileSync(f, 'utf8')), 'owner');
  if (s !== 200) throw new Error('규칙 올리기 실패 ' + s);
}
const 학생 = (sid, 덧) => ({ prep: Object.assign({ sid, role: 'student', master: false, exp: Date.now() + 3600e3 }, 덧 || {}) });

(async () => {
  await 요청('PUT', '', null, 'owner');
  await 규칙올리기(규칙2A);
  await 요청('PUT', 'sol_prep_v1', {
    config: { autoRelease: false },
    students: { Mina: { profile: { year: 5 }, curricula: { r1: { v: 1 } } } },
    jobs: { j1: { owner: 'ts-worker', status: 'queued' }, j2: { owner: 'someone', status: 'queued' } },
    releases: { A1: { studentId: 'Mina', published: true } },
    answerKeys: { A1: { s1: { q0: 'B' } } },
    submissions: { A1: { Mina: { s1: { latest: 1 } } } },
  }, 'owner');
  await 요청('PUT', 'solomon_hw_v3', { submissions: { Mina_2026_m10_w1_s0: { submitted: true } }, users: [] }, 'owner');

  console.log('── 토큰이 먹는지(시험 장치 확인)');
  재기('원장 토큰으로 sol_prep_v1 를 읽는다', 됨(await 읽기('sol_prep_v1/config', OP)));
  재기('로그인 안 한 요청은 막힌다', 막힘(await 읽기('sol_prep_v1/config', null)));

  console.log('\n── 2-A: 학생·익명은 sol_prep_v1 에 직접 못 닿는다(함수로만)');
  for (const p of ['sol_prep_v1', 'sol_prep_v1/config', 'sol_prep_v1/releases/A1', 'sol_prep_v1/answerKeys/A1',
                   'sol_prep_v1/submissions/A1/Mina', 'sol_prep_v1/students/Mina/profile']) {
    재기('세션 학생이 읽기 막힘: ' + p, 막힘(await 읽기(p, 'u-mina', 학생('Mina'))));
  }
  재기('익명이 releases 읽기 막힘', 막힘(await 읽기('sol_prep_v1/releases', 'u-anon')));
  재기('세션 학생이 자기 제출 칸에 직접 쓰기 막힘', 막힘(await 쓰기('sol_prep_v1/submissions/A1/Mina/s1', { latest: 9 }, 'u-mina', 학생('Mina'))));
  재기('세션 학생이 releases 에 쓰기 막힘', 막힘(await 쓰기('sol_prep_v1/releases/A9', { studentId: 'Mina', published: true }, 'u-mina', 학생('Mina'))));
  재기('마스터 세션도 직접 쓰기 막힘', 막힘(await 쓰기('sol_prep_v1/submissions/A1/Mina/s1', { latest: 9 }, 'u-m', 학생('Mina', { master: true }))));

  console.log('\n── 2-A: 원장(교사)');
  재기('원장은 config 를 쓴다', 됨(await 쓰기('sol_prep_v1/config/autoRelease', true, OP)));
  재기('원장은 새 커리 판을 쓴다', 됨(await 쓰기('sol_prep_v1/students/Mina/curricula/r2', { v: 2 }, OP)));
  재기('⛔ 원장도 확정된 커리 판은 덮지 못한다', 막힘(await 쓰기('sol_prep_v1/students/Mina/curricula/r1', { v: 'x' }, OP)));
  재기('⛔ 원장도 releases 는 직접 못 쓴다(서버 함수만)', 막힘(await 쓰기('sol_prep_v1/releases/A1/published', false, OP)));
  재기('⛔ 원장도 학생 제출은 직접 못 쓴다', 막힘(await 쓰기('sol_prep_v1/submissions/A1/Mina/s1/latest', 5, OP)));
  재기('⛔ 원장도 preferences 는 직접 못 쓴다', 막힘(await 쓰기('sol_prep_v1/students/Mina/preferences', { x: 1 }, OP)));

  console.log('\n── 2-A: 일꾼(ts-worker)');
  재기('일꾼은 학생 프로필을 읽는다', 됨(await 읽기('sol_prep_v1/students/Mina/profile', 'ts-worker')));
  재기('⛔ 일꾼은 config 를 못 읽는다', 막힘(await 읽기('sol_prep_v1/config', 'ts-worker')));
  재기('⛔ 일꾼은 releases 를 못 읽는다', 막힘(await 읽기('sol_prep_v1/releases/A1', 'ts-worker')));
  재기('⛔ 일꾼은 정답표를 못 읽는다', 막힘(await 읽기('sol_prep_v1/answerKeys/A1', 'ts-worker')));
  재기('일꾼은 자기 일(j1)의 상태를 쓴다', 됨(await 쓰기('sol_prep_v1/jobs/j1/status', 'running', 'ts-worker')));
  재기('⛔ 일꾼은 남의 일(j2) 상태를 못 쓴다', 막힘(await 쓰기('sol_prep_v1/jobs/j2/status', 'running', 'ts-worker')));
  재기('⛔ 일꾼은 일의 주인 칸을 못 바꾼다', 막힘(await 쓰기('sol_prep_v1/jobs/j2/owner', 'ts-worker', 'ts-worker')));
  재기('일꾼은 자기 일의 초안을 쓴다', 됨(await 쓰기('sol_prep_v1/drafts/d1', { jobId: 'j1', body: 'x' }, 'ts-worker')));
  재기('⛔ 일꾼은 남의 일 초안을 못 쓴다', 막힘(await 쓰기('sol_prep_v1/drafts/d2', { jobId: 'j2', body: 'x' }, 'ts-worker')));
  재기('⛔ 일꾼은 공개(releases)를 못 쓴다', 막힘(await 쓰기('sol_prep_v1/releases/A1/published', false, 'ts-worker')));
  재기('⛔ 일꾼은 제출을 못 쓴다', 막힘(await 쓰기('sol_prep_v1/submissions/A1/Mina/s1/latest', 5, 'ts-worker')));
  재기('⛔ 세션 학생은 초안을 못 쓴다', 막힘(await 쓰기('sol_prep_v1/drafts/d3', { jobId: 'j1' }, 'u-mina', 학생('Mina'))));

  console.log('\n── 2-A 에서는 옛 제출 규칙이 **그대로** (잠금은 아직 꺼짐)');
  재기('로그인한 아무나 옛 제출 칸에 쓴다(지금 운영과 같다)', 됨(await 쓰기('solomon_hw_v3/submissions/Aron_2026_m10_w1_s0/x', 1, 'u-anyone')));
  재기('일꾼은 옛 제출 칸에 못 쓴다(지금 운영과 같다)', 막힘(await 쓰기('solomon_hw_v3/submissions/Mina_2026_m10_w1_s0/x', 1, 'ts-worker')));

  console.log('\n── 2-B 초안(꺼 둔 판)을 올려 거절을 미리 본다');
  await 규칙올리기(규칙2B);
  const 칸 = 'solomon_hw_v3/submissions/';
  재기('세션 학생은 자기 칸에 쓴다', 됨(await 쓰기(칸 + 'Mina_2026_m10_w1_s0/x', 1, 'u-mina', 학생('Mina'))));
  재기('세션 학생은 자기 TS 칸에 쓴다', 됨(await 쓰기(칸 + 'ts_Mina_2026_m10_w1/x', 1, 'u-mina', 학생('Mina'))));
  재기('⛔ 남의 칸(Aron)에 쓰기 막힘', 막힘(await 쓰기(칸 + 'Aron_2026_m10_w1_s0/x', 1, 'u-mina', 학생('Mina'))));
  재기('⛔ 이름이 앞이 같은 남(Mina2)의 칸 막힘', 막힘(await 쓰기(칸 + 'Mina2_2026_m10_w1_s0/x', 1, 'u-mina', 학생('Mina'))));
  재기('⛔ 세션 없는 로그인은 막힘', 막힘(await 쓰기(칸 + 'Mina_2026_m10_w1_s0/x', 1, 'u-anon')));
  재기('⛔ 만료된 세션은 막힘', 막힘(await 쓰기(칸 + 'Mina_2026_m10_w1_s0/x', 1, 'u-mina', 학생('Mina', { exp: Date.now() - 1000 }))));
  재기('⛔ 마스터 세션은 제출 칸에 못 쓴다', 막힘(await 쓰기(칸 + 'Mina_2026_m10_w1_s0/x', 1, 'u-m', 학생('Mina', { master: true }))));
  재기('⛔ 학부모 세션은 제출 칸에 못 쓴다', 막힘(await 쓰기(칸 + 'Mina_2026_m10_w1_s0/x', 1, 'u-p', { prep: { sid: 'MinaMom', role: 'parent', master: false, exp: Date.now() + 3600e3, kids: { Mina: true } } })));
  재기('⛔ 일꾼은 여전히 막힘', 막힘(await 쓰기(칸 + 'Mina_2026_m10_w1_s0/x', 1, 'ts-worker')));
  재기('원장은 쓴다', 됨(await 쓰기(칸 + 'Aron_2026_m10_w1_s0/x', 1, OP)));
  재기('2-B 초안에서도 sol_prep_v1 은 같다(학생 직접 읽기 막힘)', 막힘(await 읽기('sol_prep_v1/releases/A1', 'u-mina', 학생('Mina'))));

  await 요청('PUT', '', null, 'owner');
  console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
  process.exit(실패 ? 1 : 0);
})().catch(e => {
  console.log('  ⛔ 터졌다: ' + (e && e.stack || e));
  console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + (실패 + 1));
  process.exit(1);
});
