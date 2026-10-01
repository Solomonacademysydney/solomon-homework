// 에뮬레이터에 **시험 자료**를 심는다 — 학생 화면을 브라우저로 시험하려고(2-A).
//
//   1) 에뮬레이터 띄우기(E:/AA0/HP 에서):
//        firebase emulators:start --only database,auth,functions,hosting --project demo-solomon
//   2) 다른 창에서:
//        set FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9000
//        set FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
//        node functions/에뮬레이터시험/시험자료_심기.js
//   3) 브라우저: http://127.0.0.1:5000/?emu=1   (아래 「시험 계정」으로 로그인)
//
// ⛔ 운영에는 절대 안 붙는다 — 두 에뮬레이터 변수가 없으면 멈춘다. 데이터는 demo-solomon 에만 쓴다.
// 시험 계정(가짜 · 에뮬레이터에만 있다)
//   학생 emu5 / emu5pass (Year 5) · 학생 emu9 / emu9pass (Year 9) · 학부모 emu5mom / mompass · 마스터 비번 emuMASTER

'use strict';
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

async function 심기(db) {
  const p = { year: 2026, month: 10, week: 1 };
  const 문항 = [
    { id: 'q0', text: '시험 1번: 2 + 3 = ?', type: 'mc', options: ['4', '5', '6', '7'], answer: 'B', hint1: '', hint2: '', explanation: '5',
      srcId: 'EMU_A_01', taxonomy_id: 'MR.Y5.EMU.add.one' },
    { id: 'q1', text: '시험 2번: 10 - 4 = ?', type: 'sa', options: null, answer: '6', hint1: '', hint2: '', explanation: '6',
      srcId: 'EMU_A_02', taxonomy_id: 'MR.Y5.EMU.sub.one' },
  ];
  await db.ref('solomon_hw_v3').set({
    currentPeriod: p,
    lastModified: Date.now(),
    users: [
      { id: 'emu5', role: 'student', name: '시험오', year: 5, country: 'AU', group: '', status: 'active', days: [] },
      { id: 'emu9', role: 'student', name: '시험구', year: 9, country: 'AU', group: '', status: 'active', days: [] },
      { id: 'emu5mom', role: 'parent', name: '시험오 학부모', childIds: ['emu5'], status: 'active' },
    ],
    homeworkSets: {
      AU_y5_2026_m10_w1: { year: 5, country: 'AU', period: p, group: '',
        sets: [{ setIdx: 0, title: 'Set 1 (에뮬레이터 시험)', questions: 문항, createdAt: '10/1/2026', calculatorRanges: [] }] },
    },
    submissions: {},
  });
  await db.ref('solomon_auth').set({
    student__emu5: { pw: scrypt('emu5pass') },
    student__emu9: { pw: scrypt('emu9pass') },
    parent__emu5mom: { pw: scrypt('mompass') },
    _master: { pw: scrypt('emuMASTER') },
  });
  // 새 뿌리 — 개인 배정 하나씩(emu5 는 공개 1 · 비공개 1)
  await db.ref('sol_prep_v1/releases').set({
    emu5_20261001_1_hw: { studentId: 'emu5', published: true, title: '시험오 개인 숙제', manifestHash: 'emu',
      sets: { s1: { title: '개인 Set 1', questions: 문항 } } },
    emu5_20261008_1_hw: { studentId: 'emu5', published: false, title: '시험오 다음 주(비공개)', sets: { s1: { title: 'x', questions: 문항 } } },
    emu9_20261001_1_hw: { studentId: 'emu9', published: true, title: '시험구 개인 숙제', sets: { s1: { title: 'y', questions: 문항 } } },
  });
}

(async () => {
  await 심기(admin.database());
  await 심기(일꾼칸.database());
  console.log('✅ 심었다(화면 칸·일꾼 칸) — http://127.0.0.1:5000/?emu=1  (emu5 / emu5pass)');
  process.exit(0);
})().catch(e => { console.error('⛔', e); process.exit(1); });
