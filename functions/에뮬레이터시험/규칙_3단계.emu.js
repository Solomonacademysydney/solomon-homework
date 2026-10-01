// 3단계 규칙 — 종이 시험 명세 · 결과 · 커리 · 학교 자료(DB + 저장소) — 에뮬레이터에서 허용·거절을 다 본다.
//
//   실행(E:/AA0/HP 에서):
//     firebase emulators:exec --only database,storage --project demo-solomon "node functions/에뮬레이터시험/규칙_3단계.emu.js"
//
// 규칙 파일은 공개 저장소 밖(backup/): database.rules.3단계.json · storage.rules
'use strict';
const fs = require('fs');
const path = require('path');
const DB = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
const ST = process.env.FIREBASE_STORAGE_EMULATOR_HOST || '127.0.0.1:9199';
const NS = 'demo-solomon';
if (!DB || !/^(127\.0\.0\.1|localhost):\d+$/.test(DB)) { console.log('⛔ DB 에뮬레이터 변수가 없습니다'); console.log('\n셈 — 통과 0 · 실패 1'); process.exit(1); }
const 규칙 = path.join(__dirname, '..', '..', 'backup', 'database.rules.3단계.json');
if (!fs.existsSync(규칙)) { console.log('⛔ 규칙 파일 없음'); console.log('\n셈 — 통과 0 · 실패 1'); process.exit(1); }
const OP = '62bxWubzDLMrhHjjv2oNfAQiyaD2';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
function 토큰(uid, 덧) {
  const now = Math.floor(Date.now() / 1000);
  return b64({ alg: 'none', typ: 'JWT' }) + '.' + b64(Object.assign({ iss: 'https://securetoken.google.com/' + NS, aud: NS, sub: uid, user_id: uid, iat: now, exp: now + 3600, auth_time: now, firebase: { sign_in_provider: 'anonymous', identities: {} } }, 덧 || {})) + '.';
}
// ⚠ 사용자 토큰은 ?auth= (Bearer 는 에뮬레이터가 관리자로 본다 — 2-A 실측)
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
  const 명세 = { testId: 'pt-20261001-1', title: 't', items: [{ no: 1, type: 'mc', answer: 'B', points: 1 }] };

  console.log('── 종이 시험 명세(paperTests)');
  재기('원장은 명세를 쓴다', 됨(await 쓰기('sol_prep_v1/paperTests/pt-20261001-1', 명세, OP)));
  재기('일꾼은 명세를 읽는다', 됨(await 읽기('sol_prep_v1/paperTests/pt-20261001-1', 'ts-worker')));
  재기('⛔ 일꾼은 명세를 못 쓴다', 막힘(await 쓰기('sol_prep_v1/paperTests/pt-x', 명세, 'ts-worker')));
  재기('⛔ 세션 학생은 명세를 못 읽는다(정답이 들어 있다)', 막힘(await 읽기('sol_prep_v1/paperTests/pt-20261001-1', 'u-mina', 학생('Mina'))));
  재기('⛔ 세션 학생은 명세를 못 쓴다', 막힘(await 쓰기('sol_prep_v1/paperTests/pt-x', 명세, 'u-mina', 학생('Mina'))));

  console.log('\n── 종이 시험 결과 · 커리 · 자료 · 보류 칸');
  재기('원장은 결과를 쓴다', 됨(await 쓰기('sol_prep_v1/paperResults/Mina/pt-20261001-1', { current: { rev: 1 } }, OP)));
  재기('⛔ 학생은 결과를 못 쓴다', 막힘(await 쓰기('sol_prep_v1/paperResults/Mina/pt-20261001-1', { current: { rev: 9 } }, 'u-mina', 학생('Mina'))));
  재기('⛔ 학생은 자기 결과도 직접 못 읽는다', 막힘(await 읽기('sol_prep_v1/paperResults/Mina', 'u-mina', 학생('Mina'))));
  재기('원장은 새 커리 판을 쓴다', 됨(await 쓰기('sol_prep_v1/students/Mina/curricula/r1', { v: 1 }, OP)));
  재기('⛔ 같은 판을 덮지 못한다', 막힘(await 쓰기('sol_prep_v1/students/Mina/curricula/r1', { v: 2 }, OP)));
  재기('원장은 프로필(지금 판·보류 칸)을 쓴다', 됨(await 쓰기('sol_prep_v1/students/Mina/profile', { currentCurriculum: 'r1', holdForCurriculum: true }, OP)));
  재기('원장은 학교 자료 기록을 쓴다', 됨(await 쓰기('sol_prep_v1/students/Mina/sources/src1', { status: 'uploaded' }, OP)));
  재기('일꾼은 프로필·커리·자료를 읽는다', 됨(await 읽기('sol_prep_v1/students/Mina/profile', 'ts-worker')) && 됨(await 읽기('sol_prep_v1/students/Mina/curricula', 'ts-worker')) && 됨(await 읽기('sol_prep_v1/students/Mina/sources', 'ts-worker')));
  재기('⛔ 학생은 자기 프로필도 직접 못 읽는다', 막힘(await 읽기('sol_prep_v1/students/Mina/profile', 'u-mina', 학생('Mina'))));
  재기('원장은 약점 칸에 쓴다(종이 시험 기여분)', 됨(await 쓰기('solomon_hw_v3/weakness/Mina/applied/paper_pt-20261001-1', { rev: 1 }, OP)));

  console.log('\n── 스위치 판 그대로(3단계 판이 2-B 를 바꾸지 않는다)');
  재기('⛔ 학생은 막기 칸을 못 바꾼다', 막힘(await 쓰기('solomon_hw_v3/submitLock', false, 'u-mina', 학생('Mina'))));
  재기('막기 칸이 꺼져 있으면 세션 없는 로그인도 제출 칸에 쓴다', 됨(await 쓰기('solomon_hw_v3/submissions/Aron_2026_m10_w1_s0/x', 1, 'u-anon')));

  console.log('\n── 저장소(학교 자료 사진·PDF) — 원장만');
  // ⚠ 실측(10-01): 파일 종류(contentType)는 **multipart** 로 올려야 규칙에 실린다(브라우저 SDK 가 이렇게 올린다).
  //   단순 POST 로 올리면 종류가 비어 원장 것까지 다 거절된다 — 그러면 거절 시험이 헛통과한다.
  const 올리기 = async (uid, 이름, 종류, 크기) => {
    const bd = '----p' + Date.now() + Math.random().toString(16).slice(2);
    const 줄 = String.fromCharCode(13, 10);
    const body = Buffer.concat([
      Buffer.from('--' + bd + 줄 + 'Content-Type: application/json; charset=utf-8' + 줄 + 줄 + JSON.stringify({ name: 이름, contentType: 종류 }) + 줄
        + '--' + bd + 줄 + 'Content-Type: ' + 종류 + 줄 + 줄),
      Buffer.alloc(크기 || 10), Buffer.from(줄 + '--' + bd + '--')]);
    const h = { 'Content-Type': 'multipart/related; boundary=' + bd, 'X-Goog-Upload-Protocol': 'multipart' };
    if (uid) h.Authorization = 'Firebase ' + 토큰(uid);
    const r2 = await fetch(`http://${ST}/v0/b/${NS}.appspot.com/o?name=${encodeURIComponent(이름)}`, { method: 'POST', headers: h, body });
    return r2.status;
  };
  const 받기 = async (uid, 이름) => {
    const h = uid ? { Authorization: 'Firebase ' + 토큰(uid) } : {};
    const r3 = await fetch(`http://${ST}/v0/b/${NS}.appspot.com/o/${encodeURIComponent(이름)}?alt=media`, { headers: h });
    return r3.status;
  };
  재기('원장은 prep/ 에 사진을 올린다', 됨(await 올리기(OP, 'prep/Mina/src1/a.png', 'image/png')));
  재기('원장은 PDF 도 올린다', 됨(await 올리기(OP, 'prep/Mina/src1/b.pdf', 'application/pdf')));
  재기('⛔ 원장도 사진·PDF 말고는 못 올린다', 막힘(await 올리기(OP, 'prep/Mina/src1/c.exe', 'application/octet-stream')));
  재기('원장은 받는다', 됨(await 받기(OP, 'prep/Mina/src1/a.png')));
  재기('⛔ 학생(익명)은 못 받는다', 막힘(await 받기('u-mina', 'prep/Mina/src1/a.png')));
  재기('⛔ 로그인 없이 못 받는다(공개 링크 없음)', 막힘(await 받기(null, 'prep/Mina/src1/a.png')));
  재기('⛔ 학생은 못 올린다', 막힘(await 올리기('u-mina', 'prep/Mina/src1/d.png', 'image/png')));
  재기('⛔ prep/ 밖에는 원장도 못 올린다', 막힘(await 올리기(OP, 'other/x.png', 'image/png')));
  재기('⛔ 20MB 넘으면 원장도 못 올린다', 막힘(await 올리기(OP, 'prep/Mina/src1/big.png', 'image/png', 21 * 1024 * 1024)));

  await 요청('PUT', '', null, 'owner');
  console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
  process.exit(실패 ? 1 : 0);
})().catch(e => { console.log('  ⛔ 터졌다: ' + (e && e.stack || e)); console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + (실패 + 1)); process.exit(1); });
