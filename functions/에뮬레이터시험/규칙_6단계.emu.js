// 6단계 규칙(backup/database.rules.6단계.json) — 공개 줄·공개 기록·정정 기록·자동 공개 스위치 · 승인·기본값은 서버만
//   firebase emulators:exec --only database --project demo-solomon "node functions/에뮬레이터시험/규칙_6단계.emu.js"
'use strict';
const fs = require('fs');
const path = require('path');
const DB = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
const NS = 'demo-solomon';
if (!DB || !/^(127\.0\.0\.1|localhost):\d+$/.test(DB)) { console.log('⛔ DB 에뮬레이터 변수가 없습니다'); console.log('\n셈 — 통과 0 · 실패 1'); process.exit(1); }
const 규칙 = path.join(__dirname, '..', '..', 'backup', process.env.RULES_FILE || 'database.rules.6단계c.json');   // 6단계c = 6단계 + 툴체인 단원 목록 + 프로젝트 결과물(10-02)
if (!fs.existsSync(규칙)) { console.log('⛔ 규칙 파일 없음'); console.log('\n셈 — 통과 0 · 실패 1'); process.exit(1); }
const OP = '62bxWubzDLMrhHjjv2oNfAQiyaD2';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
function 토큰(uid, 덧) {
  const now = Math.floor(Date.now() / 1000);
  return b64({ alg: 'none', typ: 'JWT' }) + '.' + b64(Object.assign({ iss: 'https://securetoken.google.com/' + NS, aud: NS, sub: uid, user_id: uid, iat: now, exp: now + 3600, auth_time: now, firebase: { sign_in_provider: 'anonymous', identities: {} } }, 덧 || {})) + '.';
}
async function 요청(방법, 경로, 값, uid, 덧) {
  const 관리자 = uid === 'owner';
  const url = `http://${DB}/${경로}.json?ns=${NS}` + (!관리자 && uid ? '&auth=' + 토큰(uid, 덧) : '');
  const r = await fetch(url, { method: 방법, headers: 관리자 ? { Authorization: 'Bearer owner' } : {}, body: 값 === undefined ? undefined : JSON.stringify(값) });
  return r.status;
}
const 읽기 = (p, u, 덧) => 요청('GET', p, undefined, u, 덧), 쓰기 = (p, v, u, 덧) => 요청('PUT', p, v, u, 덧);
const 됨 = (s) => s === 200, 막힘 = (s) => s === 401 || s === 403;
let 통과 = 0, 실패 = 0;
function 재기(이름, 참, 덧) { if (참) { 통과++; console.log('  ✅ ' + 이름); } else { 실패++; console.log('  ⛔ ' + 이름 + (덧 !== undefined ? '\n       ' + 덧 : '')); } }
const 학생 = (sid) => ({ prep: { sid, role: 'student', master: false, exp: Date.now() + 3600e3 } });

(async () => {
  await 요청('PUT', '', null, 'owner');
  const r = await 요청('PUT', '.settings/rules', JSON.parse(fs.readFileSync(규칙, 'utf8')), 'owner');
  if (r !== 200) throw new Error('규칙 올리기 실패 ' + r);
  await 쓰기('sol_prep_v1', { releaseQueue: { P1: 1 }, releases: { P1_hw: { studentId: 'Mina', published: true, sets: { s1: { questions: [{ answer: 'B' }] } } } },
    plans: { P1: { latest: 1, schedule: { state: 'scheduled' }, approvals: { 1: { paper: { draftId: 'd' } } } } }, releaseLog: { a: { aid: 'P1_hw' } }, releaseHistory: { P1_hw: { 1: { sets: {} } } },
    students: { Mina: { preferences: { paper: { settings: {} } } } }, config: { autoProduce: false } }, 'owner');

  console.log('── 원장');
  재기('원장은 공개 줄·공개·기록·예약을 읽는다', 됨(await 읽기('sol_prep_v1/releaseQueue', OP)) && 됨(await 읽기('sol_prep_v1/releases/P1_hw', OP)) && 됨(await 읽기('sol_prep_v1/releaseLog', OP)) && 됨(await 읽기('sol_prep_v1/plans/P1/schedule', OP)));
  재기('원장은 자동 공개 스위치를 켠다(참/거짓)', 됨(await 쓰기('sol_prep_v1/config/autoRelease', true, OP)));
  재기('⛔ 스위치에 참/거짓 아닌 값', 막힘(await 쓰기('sol_prep_v1/config/autoRelease', 'yes', OP)));
  재기('⛔ 원장도 공개 줄·공개 묶음·기록을 화면에서 직접 못 쓴다(서버 함수만)', 막힘(await 쓰기('sol_prep_v1/releaseQueue/P1', 2, OP)) && 막힘(await 쓰기('sol_prep_v1/releases/P1_hw/published', false, OP))
    && 막힘(await 쓰기('sol_prep_v1/releaseLog/x', { a: 1 }, OP)) && 막힘(await 쓰기('sol_prep_v1/releaseHistory/P1_hw/9', { a: 1 }, OP)));
  재기('⛔ 원장도 승인·예약·기본값을 화면에서 직접 못 쓴다(서버 함수만 — 이번 주만/기본값 구분을 지키려고)', 막힘(await 쓰기('sol_prep_v1/plans/P1/approvals/1/paper', { draftId: 'z' }, OP))
    && 막힘(await 쓰기('sol_prep_v1/plans/P1/schedule/state', 'held', OP)) && 막힘(await 쓰기('sol_prep_v1/students/Mina/preferences/paper', {}, OP)));

  console.log('\n── 일꾼');
  재기('일꾼은 판·예약을 읽는다(제작에 필요)', 됨(await 읽기('sol_prep_v1/plans/P1', 'ts-worker')));
  재기('⛔ 일꾼은 공개·공개 줄·기록을 못 읽고 못 쓴다', 막힘(await 읽기('sol_prep_v1/releases', 'ts-worker')) && 막힘(await 쓰기('sol_prep_v1/releases/P1_hw', { published: true }, 'ts-worker'))
    && 막힘(await 쓰기('sol_prep_v1/releaseQueue/P1', 0, 'ts-worker')) && 막힘(await 읽기('sol_prep_v1/releaseQueue', 'ts-worker')));
  재기('⛔ 일꾼은 승인·예약·기본값·자동 공개 스위치를 못 쓴다', 막힘(await 쓰기('sol_prep_v1/plans/P1/approvals/1/online', { jobId: 'j' }, 'ts-worker')) && 막힘(await 쓰기('sol_prep_v1/plans/P1/released', { rev: 1 }, 'ts-worker'))
    && 막힘(await 쓰기('sol_prep_v1/students/Mina/preferences/online', {}, 'ts-worker')) && 막힘(await 쓰기('sol_prep_v1/config/autoRelease', true, 'ts-worker')));

  console.log('\n── 세션 학생');
  재기('⛔ 학생은 공개 묶음(정답 있음)을 직접 못 읽는다 — 서버 함수로만', 막힘(await 읽기('sol_prep_v1/releases/P1_hw', 'u-mina', 학생('Mina'))));
  재기('⛔ 학생은 공개 줄·예약·기록·정정 기록을 못 읽는다', 막힘(await 읽기('sol_prep_v1/releaseQueue', 'u-mina', 학생('Mina'))) && 막힘(await 읽기('sol_prep_v1/plans/P1', 'u-mina', 학생('Mina')))
    && 막힘(await 읽기('sol_prep_v1/releaseLog', 'u-mina', 학생('Mina'))) && 막힘(await 읽기('sol_prep_v1/releaseHistory', 'u-mina', 학생('Mina'))));
  재기('⛔ 학생은 아무것도 못 쓴다', 막힘(await 쓰기('sol_prep_v1/releases/P1_hw/published', true, 'u-mina', 학생('Mina'))) && 막힘(await 쓰기('sol_prep_v1/config/autoRelease', false, 'u-mina', 학생('Mina'))));

  console.log('\n── [10-02] 툴체인 단원 목록(toolchainIndex) — 일꾼만 쓴다');
  재기('일꾼은 단원 목록을 올린다', 됨(await 쓰기('sol_prep_v1/toolchainIndex', { rev: 'rev55', units: { 0: { 트랙: 'y7geo' } } }, 'ts-worker')));
  재기('원장은 단원 목록을 읽는다', 됨(await 읽기('sol_prep_v1/toolchainIndex', OP)));
  재기('⛔ 원장 화면도 단원 목록을 직접 못 쓴다 · 학생은 읽지도 쓰지도 못한다', 막힘(await 쓰기('sol_prep_v1/toolchainIndex', { rev: 'x' }, OP))
    && 막힘(await 읽기('sol_prep_v1/toolchainIndex', 'u-mina', 학생('Mina'))) && 막힘(await 쓰기('sol_prep_v1/toolchainIndex', { rev: 'x' }, 'u-mina', 학생('Mina'))));
  재기('⛔ 일꾼도 판 번호(rev)는 글자만', 막힘(await 쓰기('sol_prep_v1/toolchainIndex/rev', 55, 'ts-worker')));

  console.log('\n── [10-02] 프로젝트 결과물(imports · importSets) — 일꾼은 새로 적기만');
  재기('일꾼은 새 결과물을 적는다(상태 new · 파일 이름)', 됨(await 쓰기('sol_prep_v1/imports/i1', { status: 'new', questions: 'a_questions.json' }, 'ts-worker'))
    && 됨(await 쓰기('sol_prep_v1/importSets/i1', [{ title: 'S' }], 'ts-worker')));
  재기('⛔ 일꾼은 이미 적힌 결과물을 덮지 못한다(등록됨으로 바꾸기 등)', 막힘(await 쓰기('sol_prep_v1/imports/i1', { status: 'new', questions: 'b_questions.json' }, 'ts-worker'))
    && 막힘(await 쓰기('sol_prep_v1/imports/i1/status', 'adopted', 'ts-worker')) && 막힘(await 쓰기('sol_prep_v1/importSets/i1', [{ title: 'X' }], 'ts-worker')));
  재기('⛔ 일꾼은 상태 new 가 아닌 결과물을 못 적는다', 막힘(await 쓰기('sol_prep_v1/imports/i2', { status: 'adopted', questions: 'a_questions.json' }, 'ts-worker')));
  재기('원장은 결과물을 읽는다 · ⛔ 화면에서 직접 등록 표시는 못 한다(서버 함수만)', 됨(await 읽기('sol_prep_v1/imports', OP)) && 막힘(await 쓰기('sol_prep_v1/imports/i1/status', 'adopted', OP)));
  재기('⛔ 학생은 결과물(정답 있음)을 못 읽는다', 막힘(await 읽기('sol_prep_v1/importSets/i1', 'u-mina', 학생('Mina'))) && 막힘(await 읽기('sol_prep_v1/imports', 'u-mina', 학생('Mina'))));

  await 요청('PUT', '', null, 'owner');
  console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
  process.exit(실패 ? 1 : 0);
})().catch(e => { console.log('  ⛔ 터졌다: ' + (e && e.stack || e)); console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + (실패 + 1)); process.exit(1); });
