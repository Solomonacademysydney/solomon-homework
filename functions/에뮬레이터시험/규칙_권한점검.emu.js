// 권한 점검 — 운영 규칙(backup/database.rules.json)을 그대로 올려 신분마다 **직접 DB 요청**으로 잰다.
//   firebase emulators:exec --only database --project demo-solomon "node functions/에뮬레이터시험/규칙_권한점검.emu.js"
//   (RULES_FILE=다른파일.json 으로 다른 규칙을 잴 수 있다)
//
// 「홈페이지정비 최종작업지시서 1003」 §3. 기대값은 지시서의 권한 기준표다 —
//   학생은 자기 것만 · 학부모는 자녀 것만 · 익명은 학원 학생 자료에 손 못 댐 · 마스터는 쓰기 못 함 · 일꾼은 정해진 길만.
// ⛔ 이 파일의 ⛔ 줄은 「규칙이 기준표와 다르다」는 뜻이다(시험이 깨진 것이 아니라 구멍이 보인 것).
//    submitLock 은 켬(true)·끔(false)·없음 셋을 다 잰다.
'use strict';
const fs = require('fs');
const path = require('path');
const DB = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
const NS = 'demo-solomon';
if (!DB || !/^(127\.0\.0\.1|localhost):\d+$/.test(DB)) { console.log('⛔ DB 에뮬레이터 변수가 없습니다'); console.log('\n셈 — 통과 0 · 실패 1'); process.exit(1); }
const 규칙 = path.join(__dirname, '..', '..', 'backup', process.env.RULES_FILE || 'database.rules.json');
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
const 읽기 = (p, u, 덧) => 요청('GET', p, undefined, u, 덧);
const 쓰기 = (p, v, u, 덧) => 요청('PUT', p, v, u, 덧);
const 지우기 = (p, u, 덧) => 요청('DELETE', p, undefined, u, 덧);
const 됨 = (s) => s === 200, 막힘 = (s) => s === 401 || s === 403;
let 통과 = 0, 실패 = 0;
const 구멍 = [];
function 재기(이름, 참, 덧) { if (참) { 통과++; console.log('  ✅ ' + 이름); } else { 실패++; 구멍.push(이름); console.log('  ⛔ ' + 이름 + (덧 !== undefined ? '\n       ' + 덧 : '')); } }
const 한시간 = () => Date.now() + 3600e3;
const 학생 = (sid, 덧) => ({ prep: Object.assign({ sid, role: 'student', master: false, exp: 한시간() }, 덧) });
const 부모 = (sid, kids) => ({ prep: { sid, role: 'parent', master: false, exp: 한시간(), kids } });

const 씨앗 = (lock) => ({
  solomon_hw_v3: Object.assign({
    currentPeriod: { year: 2026, month: 10, week: 1 }, lastModified: 1, schools: { NSW: { x: 1 } },
    users: [{ id: 'Amy05', role: 'student' }, { id: 'Ben03', role: 'student' }],
    homeworkSets: { AU_y5_2026_m10_w1: { sets: [{ title: 'a' }] } },
    submissions: { Amy05_2026_m10_w1_s0: { answers: { q0: 'A' } }, Ben03_2026_m10_w1_s0: { answers: { q0: 'B' }, submitted: true }, ts_Ben03_2026_m10_w1: { day1: { a: 1 } } },
    reports: { '2026_m10_w1': { Ben03: { maths: { s: 2 } } } },
    teacherMemos: { Ben03: { t1: 'memo' } },
    weakness: { Amy05: { skills: { k: 1 } }, Ben03: { skills: { k: 2 } } },
    taxonomy_feedback: { x: { y: 1 } },
  }, lock === undefined ? {} : { submitLock: lock }),
  sol_v4: {
    bank: { ts: { item1: { text: 'q', answer: 'B' } } }, fig: { f1: '<svg/>' },
    assign: { AU_y5_2026_m10_w1: { items: ['item1'] } },
    work: { Ben03: { '2026_m10_w1': { day1: { a: 'B' } } } },
    ops: { lock: { X: true } },
  },
  sol_prep_v1: { config: { autoProduce: false }, students: { Ben03: { profile: { n: 1 } } }, releases: { r1: { studentId: 'Ben03' } }, submissions: { r1: { Ben03: { a: 1 } } } },
  lt_results: { t0: { name: 'n', phone: 'p', timestamp: 1 } },
  master_login_logs: { l1: { at: 1 } },
  solomon_backups: { '2026-10-01_12-41': { data: { x: 1 } } },
  solomon_auth: { Ben03: { h: 'x' } },
  store: { x: 1 },
  rate_limits: { x: 1 },
});

(async () => {
  await 요청('PUT', '', null, 'owner');
  const r = await 요청('PUT', '.settings/rules', JSON.parse(fs.readFileSync(규칙, 'utf8')), 'owner');
  if (r !== 200) throw new Error('규칙 올리기 실패 ' + r);
  const 다시심기 = async (lock) => { await 요청('PUT', '', null, 'owner'); await 요청('PUT', '', 씨앗(lock), 'owner'); };

  const AN = 'u-anon';                 // 익명(누구나 홈페이지에서 받을 수 있는 신분)
  const A = 'u-amy', 아미 = 학생('Amy05');
  const M = 'u-mom', 엄마 = 부모('Mom', { Amy05: true });
  const 마스터 = 학생('Ben03', { master: true });

  // ── 1. 학생 숙제·제출 — submitLock 셋
  for (const lock of [true, false, undefined]) {
    await 다시심기(lock);
    console.log(`\n── 제출 칸 · submitLock = ${lock === undefined ? '없음' : lock}`);
    재기(`[lock ${lock}] ⛔ 익명이 남의 제출(Ben03)을 덮어쓴다`, 막힘(await 쓰기('solomon_hw_v3/submissions/Ben03_2026_m10_w1_s0', { answers: { q0: 'X' } }, AN)));
    재기(`[lock ${lock}] ⛔ 익명이 남의 제출을 지운다`, 막힘(await 지우기('solomon_hw_v3/submissions/Ben03_2026_m10_w1_s0', AN)));
    재기(`[lock ${lock}] ⛔ 학생 Amy 가 Ben 제출을 덮어쓴다`, 막힘(await 쓰기('solomon_hw_v3/submissions/Ben03_2026_m10_w1_s0', { answers: { q0: 'X' } }, A, 아미)));
    재기(`[lock ${lock}] ⛔ 학생 Amy 가 Ben 의 TS 칸을 쓴다`, 막힘(await 쓰기('solomon_hw_v3/submissions/ts_Ben03_2026_m10_w1', { day1: {} }, A, 아미)));
    재기(`[lock ${lock}] ⛔ 학부모가 자녀 아닌 아이 제출을 쓴다`, 막힘(await 쓰기('solomon_hw_v3/submissions/Ben03_2026_m10_w1_s0', { answers: {} }, M, 엄마)));
    재기(`[lock ${lock}] ⛔ 마스터 보기가 그 아이 제출을 쓴다`, 막힘(await 쓰기('solomon_hw_v3/submissions/Ben03_2026_m10_w1_s1', { answers: {} }, 'u-m', 마스터)));
    재기(`[lock ${lock}] ⛔ 일꾼이 제출을 쓴다`, 막힘(await 쓰기('solomon_hw_v3/submissions/Ben03_2026_m10_w1_s1', { answers: {} }, 'ts-worker')));
    재기(`[lock ${lock}] 학생 Amy 는 자기 제출을 쓴다(정상 이용)`, 됨(await 쓰기('solomon_hw_v3/submissions/Amy05_2026_m10_w1_s1', { answers: { q0: 'A' } }, A, 아미)));
    재기(`[lock ${lock}] 학생 Amy 는 자기 TS 칸을 쓴다(정상 이용)`, 됨(await 쓰기('solomon_hw_v3/submissions/ts_Amy05_2026_m10_w1', { day1: { a: 1 } }, A, 아미)));
  }

  await 다시심기(true);
  console.log('\n── 약점(weakness)');
  재기('⛔ 익명이 남의 약점을 쓴다', 막힘(await 쓰기('solomon_hw_v3/weakness/Ben03/skills/k', 99, AN)));
  재기('⛔ 익명이 남의 약점을 통째로 지운다', 막힘(await 지우기('solomon_hw_v3/weakness/Ben03', AN)));
  재기('⛔ 학생 Amy 가 Ben 약점을 쓴다', 막힘(await 쓰기('solomon_hw_v3/weakness/Ben03/skills/k', 99, A, 아미)));
  재기('학생 Amy 는 자기 약점을 쓴다(정상 이용)', 됨(await 쓰기('solomon_hw_v3/weakness/Amy05/skills/k', 3, A, 아미)));
  재기('⛔ 학생 Amy 가 Ben 약점을 읽는다', 막힘(await 읽기('solomon_hw_v3/weakness/Ben03', A, 아미)));
  재기('학생 Amy 는 자기 약점 반영 표시(applied)를 쓴다(화면 applyWeaknessUpdates 길)', 됨(await 쓰기('solomon_hw_v3/weakness/Amy05/applied/c1', { rev: 1, skills: ['k'], at: 'x' }, A, 아미)));
  재기('⛔ 마스터 보기가 약점을 쓴다', 막힘(await 쓰기('solomon_hw_v3/weakness/Ben03/skills/k', 1, 'u-m', 마스터)));
  재기('원장은 약점을 쓴다', 됨(await 쓰기('solomon_hw_v3/weakness/Ben03/skills/k', 1, OP)));

  console.log('\n── 새 저장 길 sol_v4');
  재기('⛔ 익명이 남의 풀이(work/Ben03)를 읽는다', 막힘(await 읽기('sol_v4/work/Ben03', AN)));
  재기('⛔ 익명이 남의 풀이를 쓴다', 막힘(await 쓰기('sol_v4/work/Ben03/2026_m10_w1/day1', { a: 'X' }, AN)));
  재기('⛔ 익명이 남의 풀이를 지운다', 막힘(await 지우기('sol_v4/work/Ben03', AN)));
  재기('⛔ 학생 Amy 가 Ben 풀이를 읽는다', 막힘(await 읽기('sol_v4/work/Ben03', A, 아미)));
  재기('⛔ 학생 Amy 가 Ben 풀이를 쓴다', 막힘(await 쓰기('sol_v4/work/Ben03/2026_m10_w1/day1', { a: 'X' }, A, 아미)));
  재기('⛔ 익명이 문항 창고(답 포함)를 읽는다', 막힘(await 읽기('sol_v4/bank/ts/item1', AN)));
  재기('⛔ 익명이 배정 칸을 읽는다', 막힘(await 읽기('sol_v4/assign/AU_y5_2026_m10_w1', AN)));
  재기('⛔ 익명이 그림을 읽는다', 막힘(await 읽기('sol_v4/fig/f1', AN)));
  재기('학생 Amy 는 자기 풀이를 읽고 쓴다 · 학부모는 자녀 풀이를 읽는다', 됨(await 쓰기('sol_v4/work/Amy05/2026_m10_w1/day1', { a: 'A' }, A, 아미)) && 됨(await 읽기('sol_v4/work/Amy05', A, 아미)) && 됨(await 읽기('sol_v4/work/Amy05', M, 엄마)));
  재기('학생은 문항 창고·배정·그림을 읽는다(세션 있음)', 됨(await 읽기('sol_v4/bank/ts/item1', A, 아미)) && 됨(await 읽기('sol_v4/assign/AU_y5_2026_m10_w1', A, 아미)) && 됨(await 읽기('sol_v4/fig/f1', A, 아미)));
  재기('원장·일꾼은 문항 창고를 읽는다 · 원장은 창고를 쓴다', 됨(await 읽기('sol_v4/bank/ts/item1', OP)) && 됨(await 읽기('sol_v4/bank/ts/item1', 'ts-worker')) && 됨(await 쓰기('sol_v4/bank/ts/item2', { text: 'q' }, OP)));
  재기('원장은 분류 피드백을 쓴다 · 누구나 lastModified 에 숫자를 쓴다', 됨(await 쓰기('solomon_hw_v3/taxonomy_feedback/k/1', { r: 'ok' }, OP)) && 됨(await 쓰기('solomon_hw_v3/lastModified', 5, A, 아미)));
  재기('⛔ lastModified 에 숫자 아닌 것', 막힘(await 쓰기('solomon_hw_v3/lastModified', 'x', A, 아미)));
  재기('⛔ 학생이 잠금 목록을 쓴다', 막힘(await 쓰기('sol_v4/ops/lock/Y', true, A, 아미)));

  console.log('\n── 원장 전용 항목');
  재기('⛔ 학생이 공책(users) 줄을 쓴다', 막힘(await 쓰기('solomon_hw_v3/users/0', { id: 'Amy05', role: 'teacher' }, A, 아미)));
  재기('⛔ 학생이 숙제 칸을 쓴다', 막힘(await 쓰기('solomon_hw_v3/homeworkSets/AU_y5_2026_m10_w1/sets', [], A, 아미)));
  재기('⛔ 학생이 리포트를 쓴다', 막힘(await 쓰기('solomon_hw_v3/reports/2026_m10_w1/Amy05', { maths: { s: 100 } }, A, 아미)));
  재기('⛔ 학생이 교사 메모를 읽거나 쓴다', 막힘(await 읽기('solomon_hw_v3/teacherMemos/Ben03', A, 아미)) && 막힘(await 쓰기('solomon_hw_v3/teacherMemos/Amy05', { t: 'x' }, A, 아미)));
  재기('⛔ 학생이 submitLock 을 끈다', 막힘(await 쓰기('solomon_hw_v3/submitLock', false, A, 아미)));
  재기('⛔ 학생이 이번 주(currentPeriod)를 바꾼다', 막힘(await 쓰기('solomon_hw_v3/currentPeriod', { year: 2020 }, A, 아미)));
  // 받아들인 남은 것(10-03): lastModified 는 모든 쓰기가 함께 올리는 칸이라 쓰기를 못 막는다 — 숫자만으로 좁혔다.
  재기('(남은 것) 로그인한 누구나 lastModified 에 숫자는 쓴다', 됨(await 쓰기('solomon_hw_v3/lastModified', 1, AN)));
  재기('⛔ 익명이 분류 피드백(taxonomy_feedback) 통째를 지운다', 막힘(await 지우기('solomon_hw_v3/taxonomy_feedback', AN)));

  console.log('\n── 나머지 뿌리');
  재기('⛔ 익명이 마스터 로그인 기록 통째를 지운다', 막힘(await 지우기('master_login_logs', AN)));
  재기('⛔ 익명이 마스터 로그인 기록 한 줄을 고친다', 막힘(await 쓰기('master_login_logs/l1', { at: 2 }, AN)));
  재기('⛔ 익명이 레벨테스트 결과를 읽는다', 막힘(await 읽기('lt_results', AN)));
  재기('⛔ 익명이 이미 있는 레벨테스트 결과를 덮는다', 막힘(await 쓰기('lt_results/t0', { name: 'x', phone: 'x', timestamp: 2 }, AN)));
  재기('익명은 새 레벨테스트 결과를 쓴다(정상 이용)', 됨(await 쓰기('lt_results/t9', { name: 'n', phone: 'p', timestamp: 1 }, AN)));
  재기('⛔ 익명·학생·일꾼이 옛 백업을 읽는다', 막힘(await 읽기('solomon_backups', AN)) && 막힘(await 읽기('solomon_backups', A, 아미)) && 막힘(await 읽기('solomon_backups', 'ts-worker')));
  재기('⛔ 누구도(원장 브라우저 포함) 비번 금고를 읽는다', 막힘(await 읽기('solomon_auth', AN)) && 막힘(await 읽기('solomon_auth', OP)));
  재기('⛔ 익명·학생이 수업 준비 자료를 읽는다', 막힘(await 읽기('sol_prep_v1', AN)) && 막힘(await 읽기('sol_prep_v1/releases', A, 아미)) && 막힘(await 읽기('sol_prep_v1/submissions/r1/Ben03', A, 아미)));
  재기('⛔ 학생이 수업 준비 제출을 직접 쓴다(함수만 쓴다)', 막힘(await 쓰기('sol_prep_v1/submissions/r1/Amy05', { a: 1 }, A, 아미)));
  재기('⛔ 익명이 store · rate_limits 를 읽는다', 막힘(await 읽기('store', AN)) && 막힘(await 읽기('rate_limits', AN)));

  console.log('\n── 일꾼');
  재기('⛔ 일꾼이 공책·리포트·약점을 읽는다', 막힘(await 읽기('solomon_hw_v3/users', 'ts-worker')) && 막힘(await 읽기('solomon_hw_v3/reports/2026_m10_w1/Ben03', 'ts-worker')) && 막힘(await 읽기('solomon_hw_v3/weakness/Ben03', 'ts-worker')));
  재기('⛔ 일꾼이 숙제 칸을 쓴다', 막힘(await 쓰기('solomon_hw_v3/homeworkSets/AU_y5_2026_m10_w1/sets', [], 'ts-worker')));

  console.log('\n── 정상 이용(막히면 안 되는 것)');
  재기('원장은 남의 제출·공책·옛 백업을 읽고 쓴다', 됨(await 읽기('solomon_hw_v3/users', OP)) && 됨(await 쓰기('solomon_hw_v3/submissions/Ben03_2026_m10_w1_s2', { answers: {} }, OP)) && 됨(await 읽기('solomon_backups', OP)));
  재기('학부모는 자녀 약점을 읽는다', 됨(await 읽기('solomon_hw_v3/weakness/Amy05', M, 엄마)));
  재기('학생은 숙제 칸을 읽는다', 됨(await 읽기('solomon_hw_v3/homeworkSets/AU_y5_2026_m10_w1', A, 아미)));

  await 요청('PUT', '', null, 'owner');
  console.log('\n── 기준표와 다른 곳 ' + 구멍.length + '개');
  구멍.forEach(n => console.log('   · ' + n));
  console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
  process.exit(실패 ? 1 : 0);
})().catch(e => { console.log('  ⛔ 터졌다: ' + (e && e.stack || e)); console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + (실패 + 1)); process.exit(1); });
