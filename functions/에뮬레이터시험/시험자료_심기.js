// 에뮬레이터에 **시험 자료**를 심는다 — 학생 화면을 브라우저로 시험하려고(2-A · 2-B).
//
//   1) 에뮬레이터 띄우기(E:/AA0/HP 에서):
//        firebase emulators:start --only database,auth,functions,hosting --project demo-solomon
//   2) 다른 창에서:
//        set FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9000
//        set FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
//        node functions/에뮬레이터시험/시험자료_심기.js
//   3) 브라우저: http://127.0.0.1:5000/?emu=1   (아래 「시험 계정」으로 로그인)
//
// ⛔ 운영에는 절대 안 붙는다 — 두 에뮬레이터 변수가 없으면 멈춘다. 데이터는 에뮬레이터에만 쓴다.
// 시험 계정(가짜 · 에뮬레이터에만 있다)
//   학생 emu5 / emu5pass (Year 5 · 개인 배정: 10월 1주 공개 · 2주 비공개 · 3주는 그룹 숙제만)
//   학생 emu9 / emu9pass (Year 9 · 그룹 숙제만)
//   학부모 emu5mom / mompass · 마스터 비번 emuMASTER · 교사 emuT / emuTeach1 (원장 UID 로 만든다)
// [2-B·3단계] 화면 칸(demo-solomon)에 **3단계 판 규칙**(backup/database.rules.3단계.json = 스위치 판 + 종이 시험 명세)을 올린다.
//   막기 칸(solomon_hw_v3/submitLock)은 꺼 둔다 — 켜서 시험하려면 `--잠금` 을 붙인다.

'use strict';
const fs = require('fs');
const path = require('path');
const DB = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!DB || !AUTH || !/^(127\.0\.0\.1|localhost):\d+$/.test(DB) || !/^(127\.0\.0\.1|localhost):\d+$/.test(AUTH)) {
  console.log('⛔ DB·인증 에뮬레이터 변수가 없습니다 — 운영 보호를 위해 멈춥니다.');
  process.exit(1);
}
const admin = require(path.join(__dirname, '..', 'node_modules', 'firebase-admin'));
admin.initializeApp({ projectId: 'demo-solomon', databaseURL: `http://${DB}?ns=demo-solomon` });
// ⚠ 실측(10-01): 함수 에뮬레이터 안의 일꾼은 index.js 에 박힌 databaseURL 때문에 **같은 에뮬레이터의 다른 칸**
//   (ns = solomon-76715-default-rtdb)을 본다 — 운영이 아니라 에뮬레이터다(DB 에뮬레이터가 떠 있을 때).
//   화면(demo-solomon)과 일꾼이 같은 자료를 보도록 **두 칸에 똑같이** 심는다.
const 일꾼칸 = admin.initializeApp({ projectId: 'demo-solomon', databaseURL: `http://${DB}?ns=solomon-76715-default-rtdb` }, '일꾼칸');
const scrypt = require(path.join(__dirname, '..', 'auth'))._internals.scryptHash;
const OPERATOR_UID = '62bxWubzDLMrhHjjv2oNfAQiyaD2';

const W = (w) => ({ year: 2026, month: 10, week: w });
const 문항 = [
  { id: 'q0', text: '시험 1번: 2 + 3 = ?', type: 'mc', options: ['4', '5', '6', '7'], answer: 'B', hint1: '', hint2: '', explanation: '5',
    srcId: 'EMU_A_01', taxonomy_id: 'MR.Y5.EMU.add.one' },
  { id: 'q1', text: '시험 2번: 10 - 4 = ?', type: 'sa', options: null, answer: '6', hint1: '', hint2: '', explanation: '6',
    srcId: 'EMU_A_02', taxonomy_id: 'MR.Y5.EMU.sub.one' },
];
const 그룹세트 = (제목) => [{ setIdx: 0, title: 제목, questions: 문항, createdAt: '10/1/2026', calculatorRanges: [] }];

async function 심기(db) {
  await db.ref().set(null);
  await db.ref('solomon_hw_v3').set({
    currentPeriod: W(1),
    lastModified: Date.now(),
    users: [
      { id: 'emu5', role: 'student', name: '시험오', year: 5, country: 'AU', group: '', status: 'active', days: ['tue'] },
      { id: 'emu9', role: 'student', name: '시험구', year: 9, country: 'AU', group: '', status: 'active', days: ['fri'] },
      { id: 'emu5mom', role: 'parent', name: '시험오 학부모', childIds: ['emu5'], status: 'active' },
      { id: 'emuT', role: 'teacher', name: 'Teacher' },
    ],
    homeworkSets: {
      // 1주: 그룹 숙제가 있어도 emu5 는 개인 배정을 본다
      AU_y5_2026_m10_w1: { year: 5, country: 'AU', period: W(1), group: '', sets: 그룹세트('Set 1 (그룹 · 1주)') },
      // 3주: emu5 개인 배정 없음 → 그룹 숙제
      AU_y5_2026_m10_w3: { year: 5, country: 'AU', period: W(3), group: '', sets: 그룹세트('Set 1 (그룹 · 3주)') },
      AU_y9_2026_m10_w1: { year: 9, country: 'AU', period: W(1), group: '', sets: 그룹세트('Set 1 (Y9 그룹)') },
    },
    submissions: {},
    // [3단계] /prep/ 시험용 — 출석(최근 수업)·출석 요일
    attendance: { '2026-09-22': { emu5: 'present' }, '2026-09-29': { emu5: 'present' }, '2026-09-26': { emu9: 'present' } },
    attendance_days: { emu5: [2, 'tue'], emu9: [5, 'fri'] },
  });
  await db.ref('solomon_auth').set({
    student__emu5: { pw: scrypt('emu5pass') },
    student__emu9: { pw: scrypt('emu9pass') },
    parent__emu5mom: { pw: scrypt('mompass') },
    teacher__emuT: { pw: scrypt('emuTeach1') },
    _master: { pw: scrypt('emuMASTER') },
  });
  await db.ref('sol_prep_v1/releases').set({
    emu5_20261001_1_hw: { studentId: 'emu5', published: true, title: '시험오 개인 숙제', manifestHash: 'emu', period: W(1),
      sets: { s1: { title: '개인 Set 1', questions: 문항 } } },
    emu5_20261008_1_hw: { studentId: 'emu5', published: false, title: '시험오 다음 주(비공개)', period: W(2), sets: { s1: { title: 'x', questions: 문항 } } },
  });
}

(async () => {
  await 심기(admin.database());
  await 심기(일꾼칸.database());
  // 교사(원장) 계정 — 원장 UID 로 만들어야 규칙이 원장으로 본다
  try { await admin.auth().deleteUser(OPERATOR_UID); } catch (e) { /* 없으면 그만 */ }
  await admin.auth().createUser({ uid: OPERATOR_UID, email: 'emuT@solomon-academy.local', password: 'emuTeach1' });
  // 화면 칸에 「남의 제출 칸 막기」를 켠 규칙
  const 규칙 = fs.readFileSync(path.join(__dirname, '..', '..', 'backup', 'database.rules.3단계.json'), 'utf8');
  const r = await fetch(`http://${DB}/.settings/rules.json?ns=demo-solomon`, { method: 'PUT', headers: { Authorization: 'Bearer owner' }, body: 규칙 });
  if (r.status !== 200) throw new Error('규칙 올리기 실패 ' + r.status);
  const 잠금 = process.argv.includes('--잠금');
  await admin.database().ref('solomon_hw_v3/submitLock').set(잠금);
  console.log('✅ 심었다(화면 칸·일꾼 칸 · 3단계 판 규칙 · 막기 ' + (잠금 ? '켬' : '끔') + ') — http://127.0.0.1:5000/?emu=1  (emu5 / emu5pass)');
  process.exit(0);
})().catch(e => { console.error('⛔', e); process.exit(1); });
