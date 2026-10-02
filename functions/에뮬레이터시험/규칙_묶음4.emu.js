// 묶음 4 규칙(backup/database.rules.묶음4.json) — 읽기 잠그기 (RTDB 요금 · 2026-10-02)
//   firebase emulators:exec --only database --project demo-solomon "node functions/에뮬레이터시험/규칙_묶음4.emu.js"
//
// 지키는 것
//   ① 익명(소개 화면·레벨테스트)은 앱 자료를 못 읽는다 — 막기 칸·이번 주 같은 작은 칸만 · 레벨테스트 쓰기는 그대로
//   ② 학생은 자기 숙제 칸(하나씩)·자기 제출(앞머리 범위)·자기 리포트·약점만 — 남의 것·목록 통째는 못 읽는다
//   ③ 학부모는 자녀 몫만 — 자녀 아닌 아이는 못 읽는다 · 비슷한 꼴의 범위로 우회 못 한다
//   ④ 세션이 끝나면(12시간) 못 읽는다 · 마스터 보기는 읽는다
//   ⑤ 원장은 뿌리 통째 · PC 일꾼(ts-worker)은 제출 칸 하나·숙제 칸만
//   ⑥ 쓰기는 그대로(자기 제출 쓰기 · 약점 쓰기 · 남의 제출 막힘)
'use strict';
const fs = require('fs');
const path = require('path');
const DB = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
const NS = 'demo-solomon';
if (!DB || !/^(127\.0\.0\.1|localhost):\d+$/.test(DB)) { console.log('⛔ DB 에뮬레이터 변수가 없습니다'); console.log('\n셈 — 통과 0 · 실패 1'); process.exit(1); }
const 규칙 = path.join(__dirname, '..', '..', 'backup', process.env.RULES_FILE || 'database.rules.묶음4.json');
if (!fs.existsSync(규칙)) { console.log('⛔ 규칙 파일 없음'); console.log('\n셈 — 통과 0 · 실패 1'); process.exit(1); }
const OP = '62bxWubzDLMrhHjjv2oNfAQiyaD2';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
function 토큰(uid, 덧) {
  const now = Math.floor(Date.now() / 1000);
  return b64({ alg: 'none', typ: 'JWT' }) + '.' + b64(Object.assign({ iss: 'https://securetoken.google.com/' + NS, aud: NS, sub: uid, user_id: uid, iat: now, exp: now + 3600, auth_time: now, firebase: { sign_in_provider: 'anonymous', identities: {} } }, 덧 || {})) + '.';
}
async function 요청(방법, 경로, 값, uid, 덧, 물음) {
  const 관리자 = uid === 'owner';
  const url = `http://${DB}/${경로}.json?ns=${NS}` + (!관리자 && uid ? '&auth=' + 토큰(uid, 덧) : '') + (물음 || '');
  const r = await fetch(url, { method: 방법, headers: 관리자 ? { Authorization: 'Bearer owner' } : {}, body: 값 === undefined ? undefined : JSON.stringify(값) });
  return r.status;
}
const 읽기 = (p, u, 덧) => 요청('GET', p, undefined, u, 덧), 쓰기 = (p, v, u, 덧) => 요청('PUT', p, v, u, 덧);
// 화면 _scopeSubsOf 와 같은 꼴의 범위 읽기
const 범위 = (시작, u, 덧, 끝) => 요청('GET', 'solomon_hw_v3/submissions', undefined, u, 덧,
  '&orderBy=' + encodeURIComponent('"$key"') + '&startAt=' + encodeURIComponent(JSON.stringify(시작)) + '&endAt=' + encodeURIComponent(JSON.stringify(끝 === undefined ? 시작 + '' : 끝)));
const 됨 = (s) => s === 200, 막힘 = (s) => s === 401 || s === 403;
let 통과 = 0, 실패 = 0;
function 재기(이름, 참, 덧) { if (참) { 통과++; console.log('  ✅ ' + 이름); } else { 실패++; console.log('  ⛔ ' + 이름 + (덧 !== undefined ? '\n       ' + 덧 : '')); } }
const 한시간 = () => Date.now() + 3600e3;
const 학생 = (sid, 덧) => ({ prep: Object.assign({ sid, role: 'student', master: false, exp: 한시간() }, 덧) });
const 부모 = (sid, kids) => ({ prep: { sid, role: 'parent', master: false, exp: 한시간(), kids } });

(async () => {
  await 요청('PUT', '', null, 'owner');
  const r = await 요청('PUT', '.settings/rules', JSON.parse(fs.readFileSync(규칙, 'utf8')), 'owner');
  if (r !== 200) throw new Error('규칙 올리기 실패 ' + r);
  await 쓰기('solomon_hw_v3', {
    currentPeriod: { year: 2026, month: 10, week: 1 }, lastModified: 1, migrationISO2026Done: true, submitLock: true, schools: { NSW: { x: 1 } },
    users: [{ id: 'Amy05', role: 'student' }, { id: 'Ben03', role: 'student' }],
    homeworkSets: { AU_y5_2026_m10_w1: { sets: [{ title: 'a' }] }, AU_y3_2026_m10_w1: { sets: [{ title: 'b' }] } },
    submissions: { Amy05_2026_m10_w1_s0: { answers: { q0: 'A' } }, ts_Amy05_2026_m10_w1: { day1: { a: 1 } }, Ben03_2026_m10_w1_s0: { answers: { q0: 'B' } },
                   Amy05X_2026_m10_w1_s0: { answers: { q0: 'C' } } },
    reports: { '2026_m10_w1': { Amy05: { maths: { s: 1 } }, Ben03: { maths: { s: 2 } } } },
    monthlyReports: { '2026-10': { Amy05: { c: 1 }, Ben03: { c: 2 } } },
    weakness: { Amy05: { skills: { k: 1 } }, Ben03: { skills: { k: 2 } } },
    aiCache: { AU_y5_2026_m10_w1: { 0: { round_0: { x: 1 } } } },
  }, 'owner');

  const A = 'u-amy', 아미 = 학생('Amy05');
  console.log('── ① 익명(소개 화면·로그인 전)');
  재기('⛔ 뿌리 통째', 막힘(await 읽기('solomon_hw_v3', 'u-anon')));
  재기('⛔ 숙제 칸 하나·제출 범위·공책·리포트', 막힘(await 읽기('solomon_hw_v3/homeworkSets/AU_y5_2026_m10_w1', 'u-anon')) && 막힘(await 범위('Amy05_', 'u-anon'))
    && 막힘(await 읽기('solomon_hw_v3/users', 'u-anon')) && 막힘(await 읽기('solomon_hw_v3/reports/2026_m10_w1/Amy05', 'u-anon')));
  재기('작은 칸(막기·이번 주·학교·옮김 깃발·마지막 수정)은 읽는다', 됨(await 읽기('solomon_hw_v3/submitLock', 'u-anon')) && 됨(await 읽기('solomon_hw_v3/currentPeriod', 'u-anon'))
    && 됨(await 읽기('solomon_hw_v3/schools', 'u-anon')) && 됨(await 읽기('solomon_hw_v3/migrationISO2026Done', 'u-anon')) && 됨(await 읽기('solomon_hw_v3/lastModified', 'u-anon')));
  재기('⛔ 로그인 안 한 사람은 작은 칸도 못 읽는다', 막힘(await 읽기('solomon_hw_v3/submitLock', null)));
  재기('레벨테스트 결과 쓰기(익명 push)는 그대로', 됨(await 쓰기('lt_results/t1', { name: 'n', phone: 'p', timestamp: 1 }, 'u-anon')));

  console.log('\n── ② 학생 Amy05');
  재기('⛔ 뿌리 통째·숙제 목록 통째·제출 목록 통째·공책', 막힘(await 읽기('solomon_hw_v3', A, 아미)) && 막힘(await 읽기('solomon_hw_v3/homeworkSets', A, 아미))
    && 막힘(await 읽기('solomon_hw_v3/submissions', A, 아미)) && 막힘(await 읽기('solomon_hw_v3/users', A, 아미)));
  재기('숙제 칸 하나씩은 읽는다', 됨(await 읽기('solomon_hw_v3/homeworkSets/AU_y5_2026_m10_w1', A, 아미)));
  재기('자기 제출 범위(Amy05_) · 자기 TS 범위(ts_Amy05_)', 됨(await 범위('Amy05_', A, 아미)) && 됨(await 범위('ts_Amy05_', A, 아미)));
  재기('⛔ 남의 제출 범위(Ben03_ · ts_Ben03_)', 막힘(await 범위('Ben03_', A, 아미)) && 막힘(await 범위('ts_Ben03_', A, 아미)));
  재기('⛔ 끝을 넓힌 범위(Amy05_ ~ Z)로 남의 것을 끌어오기', 막힘(await 범위('Amy05_', A, 아미, 'Z')));
  재기('⛔ 앞머리를 줄인 범위(Amy0)로 Amy05X 끌어오기', 막힘(await 범위('Amy0', A, 아미)));
  재기('자기 제출 칸 하나(다시 보내기·약점 확인)', 됨(await 읽기('solomon_hw_v3/submissions/Amy05_2026_m10_w1_s0', A, 아미)) && 됨(await 읽기('solomon_hw_v3/submissions/ts_Amy05_2026_m10_w1', A, 아미)));
  재기('⛔ 남의 제출 칸 하나(Ben03 · 비슷한 아이디 Amy05X)', 막힘(await 읽기('solomon_hw_v3/submissions/Ben03_2026_m10_w1_s0', A, 아미)) && 막힘(await 읽기('solomon_hw_v3/submissions/Amy05X_2026_m10_w1_s0', A, 아미)));
  재기('자기 리포트·월간·약점', 됨(await 읽기('solomon_hw_v3/reports/2026_m10_w1/Amy05', A, 아미)) && 됨(await 읽기('solomon_hw_v3/monthlyReports/2026-10/Amy05', A, 아미)) && 됨(await 읽기('solomon_hw_v3/weakness/Amy05', A, 아미)));
  재기('⛔ 남의 리포트·월간·약점 · 리포트 한 주 통째', 막힘(await 읽기('solomon_hw_v3/reports/2026_m10_w1/Ben03', A, 아미)) && 막힘(await 읽기('solomon_hw_v3/monthlyReports/2026-10/Ben03', A, 아미))
    && 막힘(await 읽기('solomon_hw_v3/weakness/Ben03', A, 아미)) && 막힘(await 읽기('solomon_hw_v3/reports/2026_m10_w1', A, 아미)));
  재기('AI 해설 저장 읽기', 됨(await 읽기('solomon_hw_v3/aiCache/AU_y5_2026_m10_w1/0/round_0', A, 아미)));

  console.log('\n── ④ 세션 끝 · 마스터');
  const 끝난 = 학생('Amy05', { exp: Date.now() - 1000 });
  재기('⛔ 세션이 끝나면 숙제·제출·약점 못 읽는다', 막힘(await 읽기('solomon_hw_v3/homeworkSets/AU_y5_2026_m10_w1', A, 끝난)) && 막힘(await 범위('Amy05_', A, 끝난)) && 막힘(await 읽기('solomon_hw_v3/weakness/Amy05', A, 끝난)));
  const 마스터 = 학생('Amy05', { master: true });
  재기('마스터 보기(원장님이 아이 아이디로)는 그 아이 것을 읽는다', 됨(await 범위('Amy05_', 'u-m', 마스터)) && 됨(await 읽기('solomon_hw_v3/homeworkSets/AU_y5_2026_m10_w1', 'u-m', 마스터)));

  console.log('\n── ③ 학부모 Mom (자녀 Amy05)');
  const M = 'u-mom', 엄마 = 부모('Mom', { Amy05: true });
  재기('자녀 제출 범위 · 자녀 TS 범위', 됨(await 범위('Amy05_', M, 엄마)) && 됨(await 범위('ts_Amy05_', M, 엄마)));
  재기('⛔ 자녀 아닌 아이 범위(Ben03_ · ts_Ben03_)', 막힘(await 범위('Ben03_', M, 엄마)) && 막힘(await 범위('ts_Ben03_', M, 엄마)));
  재기('⛔ 꼴을 비튼 범위(Amy05_x_ · Amy0 · ts_ts_Amy05_)', 막힘(await 범위('Amy05_x_', M, 엄마)) && 막힘(await 범위('Amy0', M, 엄마)) && 막힘(await 범위('ts_ts_Amy05_', M, 엄마)));
  재기('⛔ 자기 아이디 범위(Mom_)', 막힘(await 범위('Mom_', M, 엄마)));
  재기('자녀 리포트·월간·약점', 됨(await 읽기('solomon_hw_v3/reports/2026_m10_w1/Amy05', M, 엄마)) && 됨(await 읽기('solomon_hw_v3/monthlyReports/2026-10/Amy05', M, 엄마)) && 됨(await 읽기('solomon_hw_v3/weakness/Amy05', M, 엄마)));
  재기('⛔ 자녀 아닌 아이 리포트·약점', 막힘(await 읽기('solomon_hw_v3/reports/2026_m10_w1/Ben03', M, 엄마)) && 막힘(await 읽기('solomon_hw_v3/weakness/Ben03', M, 엄마)));
  재기('숙제 칸 하나씩은 읽는다', 됨(await 읽기('solomon_hw_v3/homeworkSets/AU_y3_2026_m10_w1', M, 엄마)));
  재기('⛔ 학생 행세(role 을 parent 로 둔 채 sid 만 Ben03) — 학부모는 본인 칸 읽기 길이 없다', 막힘(await 범위('Ben03_', M, 부모('Ben03', {}))));

  console.log('\n── ⑤ 원장 · PC 일꾼');
  재기('원장은 뿌리 통째 · 공책', 됨(await 읽기('solomon_hw_v3', OP)) && 됨(await 읽기('solomon_hw_v3/users', OP)));
  재기('일꾼은 제출 칸 하나 · 숙제 칸의 세트', 됨(await 읽기('solomon_hw_v3/submissions/Ben03_2026_m10_w1_s0', 'ts-worker')) && 됨(await 읽기('solomon_hw_v3/homeworkSets/AU_y3_2026_m10_w1/sets', 'ts-worker')));
  재기('⛔ 일꾼은 뿌리 통째·공책·제출 목록 통째', 막힘(await 읽기('solomon_hw_v3', 'ts-worker')) && 막힘(await 읽기('solomon_hw_v3/users', 'ts-worker')) && 막힘(await 읽기('solomon_hw_v3/submissions', 'ts-worker')));

  console.log('\n── ⑥ 쓰기는 그대로');
  재기('학생은 자기 제출 칸을 쓴다(막기 켜짐 + 세션)', 됨(await 쓰기('solomon_hw_v3/submissions/Amy05_2026_m10_w1_s1', { answers: { q0: 'A' } }, A, 아미)));
  재기('⛔ 학생은 남의 제출 칸을 못 쓴다', 막힘(await 쓰기('solomon_hw_v3/submissions/Ben03_2026_m10_w1_s1', { answers: {} }, A, 아미)));
  재기('학생은 자기 약점을 쓴다(트랜잭션 길)', 됨(await 쓰기('solomon_hw_v3/weakness/Amy05/skills/k', 3, A, 아미)));
  재기('⛔ 마스터 보기는 못 쓴다', 막힘(await 쓰기('solomon_hw_v3/submissions/Amy05_2026_m10_w1_s2', { answers: {} }, 'u-m', 마스터)));
  재기('원장은 숙제 칸을 쓴다', 됨(await 쓰기('solomon_hw_v3/homeworkSets/AU_y5_2026_m10_w2/sets', [{ title: 'c' }], OP)));

  await 요청('PUT', '', null, 'owner');
  console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
  process.exit(실패 ? 1 : 0);
})().catch(e => { console.log('  ⛔ 터졌다: ' + (e && e.stack || e)); console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + (실패 + 1)); process.exit(1); });
