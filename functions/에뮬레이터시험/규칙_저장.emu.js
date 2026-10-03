// 저장 규칙(정비 §5 · 2026-10-03) — 학생은 제출 칸을 **통째로 못 덮고** 항목만 쓴다.
//   firebase emulators:exec --only database --project demo-solomon "node functions/에뮬레이터시험/규칙_저장.emu.js"
//   (RULES_FILE=다른파일.json — 기본 database.rules.정비5.json)
//
// 지키는 것
//   T17 옛 탭(옛 코드)의 칸 통째 쓰기가 이미 있는 칸을 덮지 못한다 — 새 코드의 항목 쓰기는 된다
//   T05 제출된 칸의 답은 학생이 못 바꾼다(제출 묶음·새로 풀기는 된다)
//   rev 는 뒤로 못 간다 · 남의 칸·마스터는 못 쓴다 · 원장은 그대로
'use strict';
const fs = require('fs');
const path = require('path');
const DB = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
const NS = 'demo-solomon';
if (!DB || !/^(127\.0\.0\.1|localhost):\d+$/.test(DB)) { console.log('⛔ DB 에뮬레이터 변수가 없습니다'); console.log('\n셈 — 통과 0 · 실패 1'); process.exit(1); }
const 규칙 = path.join(__dirname, '..', '..', 'backup', process.env.RULES_FILE || 'database.rules.정비5.json');
if (!fs.existsSync(규칙)) { console.log('⛔ 규칙 파일 없음 ' + 규칙); console.log('\n셈 — 통과 0 · 실패 1'); process.exit(1); }
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
const 쓰기 = (p, v, u, 덧) => 요청('PUT', p, v, u, 덧);
const 여럿 = (u, uid, 덧) => 요청('PATCH', 'solomon_hw_v3', u, uid, 덧);   // 화면의 FB_REF.update(…) 와 같은 꼴
const 읽기 = (p) => fetch(`http://${DB}/${p}.json?ns=${NS}`, { headers: { Authorization: 'Bearer owner' } }).then(r => r.json());
const 됨 = (s) => s === 200, 막힘 = (s) => s === 401 || s === 403;
let 통과 = 0, 실패 = 0;
function 재기(이름, 참, 덧) { if (참) { 통과++; console.log('  ✅ ' + 이름); } else { 실패++; console.log('  ⛔ ' + 이름 + (덧 !== undefined ? '\n       ' + 덧 : '')); } }
const 한시간 = () => Date.now() + 3600e3;
const 학생 = (sid, 덧) => ({ prep: Object.assign({ sid, role: 'student', master: false, exp: 한시간() }, 덧) });

const K = 'Amy05_2026_m10_w1_s0', TS = 'ts_Amy05_2026_m10_w1', S = 'solomon_hw_v3/submissions/';
const 씨앗 = () => ({ solomon_hw_v3: { submitLock: true, submissions: {
  [K]: { answers: { q0: 'A', q1: 'B' }, submitted: false, rev: 1, reportData: { kakaoMsg: 'k' } },
  'Amy05_2026_m10_w1_s1': { answers: { q0: 'A' }, submitted: true, submitTime: 't', rev: 2, reportData: { score: 90 } },
  [TS]: { day1: { answers: { q0: { attempts: 1, correct: true } }, completed: true }, day2: { answers: {} } },
  'Ben03_2026_m10_w1_s0': { answers: { q0: 'B' } },
} } });

(async () => {
  await 요청('PUT', '', null, 'owner');
  const r = await 요청('PUT', '.settings/rules', JSON.parse(fs.readFileSync(규칙, 'utf8')), 'owner');
  if (r !== 200) throw new Error('규칙 올리기 실패 ' + r);
  const 심기 = async () => { await 요청('PUT', '', null, 'owner'); await 요청('PUT', '', 씨앗(), 'owner'); };
  const A = 'u-amy', 아미 = 학생('Amy05');

  await 심기();
  console.log('── T17 옛 탭의 칸 통째 쓰기');
  재기('⛔ 이미 있는 MR 칸을 통째로 덮지 못한다(옛 코드 fbSetSubmission)', 막힘(await 쓰기(S + K, { answers: { q0: 'A' }, submitted: false }, A, 아미)));
  재기('⛔ 이미 있는 TS 칸을 통째로 덮지 못한다(옛 코드 fbSetTSProgress)', 막힘(await 쓰기(S + TS, { day1: { answers: {} } }, A, 아미)));
  재기('⛔ 옛 코드의 제출(칸 통째) — 이미 있는 칸이면 거부', 막힘(await 쓰기(S + K, { answers: { q0: 'A' }, submitted: true, rev: 2 }, A, 아미)));
  재기('없는 칸은 만들 수 있다(처음 여는 세트 · 화면 트랜잭션)', 됨(await 쓰기(S + 'Amy05_2026_m10_w1_s5', { answers: {}, submitted: false }, A, 아미)));
  const 그대로 = await 읽기(S + K);
  재기('거부된 뒤 서버 칸은 그대로(교사 카톡 포함)', 그대로.answers.q1 === 'B' && 그대로.reportData.kakaoMsg === 'k', JSON.stringify(그대로));

  console.log('\n── 새 코드의 항목 쓰기');
  재기('답 하나(saveAnswer)', 됨(await 여럿({ ['submissions/' + K + '/answers/q2']: 'C', lastModified: 1 }, A, 아미)));
  재기('TS 문항 하나 · 하루 끝', 됨(await 여럿({ ['submissions/' + TS + '/day2/answers/q3']: { attempts: 1, correct: true }, ['submissions/' + TS + '/day2/completed']: true, lastModified: 2 }, A, 아미)));
  재기('보충학습 가지 · 확인 필요 칸', 됨(await 여럿({ ['submissions/' + K + '/remediation']: { currentRound: 0 }, ['submissions/' + K + '/_conflicts/answers|q0']: { mine: 'X' } }, A, 아미)));
  재기('제출 묶음(답들 + 제출 + 판 + 리포트 + 원장 처리 지우기)', 됨(await 여럿({
    ['submissions/' + K + '/answers/q0']: 'A', ['submissions/' + K + '/submitted']: true, ['submissions/' + K + '/submitTime']: 't',
    ['submissions/' + K + '/rev']: 2, ['submissions/' + K + '/reportData']: { score: 80 }, ['submissions/' + K + '/manuallyMarked']: null, lastModified: 3 }, A, 아미)));
  const 낸것 = await 읽기(S + K);
  재기('제출 뒤 다른 답(q1·q2)도 남아 있다', 낸것.submitted === true && 낸것.answers.q1 === 'B' && 낸것.answers.q2 === 'C', JSON.stringify(낸것.answers));

  console.log('\n── T05 제출된 칸의 답');
  재기('⛔ 제출된 칸의 답 하나를 바꾸지 못한다(늦은 임시 저장)', 막힘(await 여럿({ ['submissions/' + K + '/answers/q0']: 'Z' }, A, 아미)));
  재기('⛔ 제출된 칸의 답 통째도 못 바꾼다', 막힘(await 여럿({ ['submissions/' + K + '/answers']: { q0: 'Z' } }, A, 아미)));
  재기('새로 풀기(보관함 + 비우기 + 제출 false)는 된다', 됨(await 여럿({
    ['submissions/' + K + '/_prev']: [{ answers: { q0: 'A' } }], ['submissions/' + K + '/answers']: null, ['submissions/' + K + '/submitted']: false,
    ['submissions/' + K + '/submitTime']: null, ['submissions/' + K + '/reportData']: null, ['submissions/' + K + '/remediation']: null }, A, 아미)));
  재기('새로 푼 뒤엔 다시 답을 쓴다', 됨(await 여럿({ ['submissions/' + K + '/answers/q0']: 'D' }, A, 아미)));

  console.log('\n── 판 번호');
  재기('⛔ rev 를 낮추지 못한다(2 → 1)', 막힘(await 여럿({ ['submissions/' + K + '/rev']: 1 }, A, 아미)));
  재기('rev 를 올린다(2 → 3)', 됨(await 여럿({ ['submissions/' + K + '/rev']: 3 }, A, 아미)));

  console.log('\n── 남의 칸 · 마스터 · 원장');
  재기('⛔ 남의 칸 답 하나', 막힘(await 여럿({ ['submissions/Ben03_2026_m10_w1_s0/answers/q0']: 'X' }, A, 아미)));
  재기('⛔ 마스터 보기의 항목 쓰기', 막힘(await 여럿({ ['submissions/' + K + '/answers/q5']: 'X' }, 'u-m', 학생('Amy05', { master: true }))));
  재기('⛔ 세션 끝난 학생의 항목 쓰기', 막힘(await 여럿({ ['submissions/' + K + '/answers/q5']: 'X' }, A, 학생('Amy05', { exp: Date.now() - 1000 }))));
  재기('⛔ 익명의 항목 쓰기', 막힘(await 여럿({ ['submissions/' + K + '/answers/q5']: 'X' }, 'u-anon')));
  재기('원장은 칸 통째를 쓴다(원장 처리 트랜잭션)', 됨(await 쓰기(S + K, { answers: { q0: 'A' }, submitted: true, manuallyMarked: true, rev: 3 }, OP)));
  재기('원장은 카톡 두 칸을 쓴다', 됨(await 여럿({ ['submissions/' + K + '/reportData/kakaoMsg']: 'm', ['submissions/' + K + '/reportData/kakaoGeneratedAt']: 't' }, OP)));
  재기('원장은 칸을 지운다', 됨(await 쓰기(S + 'Amy05_2026_m10_w1_s5', null, OP)));

  await 요청('PUT', '', null, 'owner');
  console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
  process.exit(실패 ? 1 : 0);
})().catch(e => { console.log('  ⛔ 터졌다: ' + (e && e.stack || e)); console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + (실패 + 1)); process.exit(1); });
