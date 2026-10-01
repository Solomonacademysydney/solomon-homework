// 2-A 학생 세션 · 학생별 조회·제출 일꾼 — **진짜 DB·인증(에뮬레이터)** 에서 돌린다.
//
//   실행(E:/AA0/HP 에서):
//     firebase emulators:exec --only database,auth --project demo-solomon "node functions/에뮬레이터시험/세션_배정.emu.js"
//
// ⛔ 운영에 절대 안 붙는다 — DB·인증 에뮬레이터 변수가 둘 다 있어야 돈다.
// 일꾼은 `.run(요청)` 으로 부른다 — 요청의 `auth.token` 에는 **인증 에뮬레이터에 실제로 적힌
// 클레임**을 그대로 넣는다(브라우저가 토큰을 새로 받으면 그것이 들어온다).
//
// 지키는 것(거절이 먼저)
//   ① 세션: 틀린 비번 · 퇴원생 · 교사 역할은 세션을 못 받는다 · 맞으면 12시간 · 마스터는 보기 전용
//   ② 조회: 다른 학생 자료 · 주소의 학생 ID 바꾸기 · 세션 없음 · 만료 → 거절 · 「배정 없음」과 「비공개」를 가른다
//   ③ 제출: 마스터 · 학부모 · 남의 배정 · 비공개 · 만료 → 거절 · 같은 판 재시도는 하나 · 판은 덮지 않는다
//   ④ 학생에게 정답이 안 간다
//   ⑤ 옛 loginCheck 는 그대로다

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
const P = require(path.join(__dirname, '..', 'prep_session'));
const A = require(path.join(__dirname, '..', 'auth'));

let 통과 = 0, 실패 = 0;
function 재기(이름, 참, 덧) {
  if (참) { 통과++; console.log('  ✅ ' + 이름); }
  else { 실패++; console.log('  ⛔ ' + 이름 + (덧 ? '\n       ' + 덧 : '')); }
}
/** 일꾼을 부른다 — 인증 에뮬레이터에 적힌 클레임을 토큰으로. 던진 것은 { err: 'CODE/메시지' } 로. */
async function 부름(fn, uid, data, 덧토큰) {
  let token = {};
  if (uid) {
    const u = await admin.auth().getUser(uid);
    token = Object.assign({ uid }, u.customClaims || {}, 덧토큰 || {});
  }
  try {
    return await fn.run({ auth: uid ? { uid, token } : undefined, data: data || {}, rawRequest: { ip: '127.0.0.1', headers: {} } });
  } catch (e) {
    return { err: (e.code || '') + '/' + (e.message || '') };
  }
}
const 거절 = (r, 말) => !!(r && r.err && r.err.includes(말));

(async () => {
  await db.ref().set(null);
  const scrypt = A._internals.scryptHash;
  await db.ref('solomon_auth').set({
    student__Mina: { pw: scrypt('mina1234') },
    student__Aron: { pw: scrypt('aron1234') },
    student__Gone: { pw: scrypt('gone1234') },
    student__Solo: { pw: scrypt('solo1234') },
    parent__MinaMom: { pw: scrypt('mom12345') },
    teacher__T: { pw: scrypt('teach123') },
    _master: { pw: scrypt('MASTER99') },
  });
  await db.ref('solomon_hw_v3/users').set([
    { id: 'Mina', role: 'student', year: 5, status: 'active' },
    { id: 'Aron', role: 'student', year: 9, status: 'active' },
    { id: 'Gone', role: 'student', year: 5, status: 'inactive' },
    { id: 'Solo', role: 'student', year: 3, status: 'active' },
    { id: 'MinaMom', role: 'parent', childIds: ['Mina'], status: 'active' },
    { id: 'T', role: 'teacher' },
  ]);
  const 문항 = [{ id: 'q0', text: '2+3?', type: 'mc', options: ['4', '5'], answer: 'B', explanation: '5' },
                { id: 'q1', text: '10-4?', type: 'sa', answer: '6', answerKey: '6' }];
  await db.ref('sol_prep_v1/releases').set({
    A1: { studentId: 'Mina', published: true, title: '민아 10월 1주', period: { year: 2026, month: 10, week: 1 }, sets: { s1: { title: 'Set 1', questions: 문항 } } },
    A2: { studentId: 'Mina', published: false, title: '민아 10월 2주(비공개)', period: { year: 2026, month: 10, week: 2 }, sets: { s1: { title: 'Set 1', questions: 문항 } } },
    B1: { studentId: 'Aron', published: true, title: '아론 10월 1주', sets: { s1: { title: 'Set 1', questions: 문항 } } },
  });
  for (const uid of ['u-mina', 'u-aron', 'u-master', 'u-mom', 'u-x', 'u-gone', 'u-solo', 'u-t']) {
    try { await admin.auth().deleteUser(uid); } catch (e) { /* 없으면 그만 */ }
    await admin.auth().createUser({ uid });
  }

  console.log('── ① 세션');
  재기('세션 없이 부르면 거절', 거절(await 부름(P.prepStartSession, null, { id: 'Mina', role: 'student', pw: 'mina1234' }), 'NO-AUTH'));
  재기('틀린 비번 → 거절', 거절(await 부름(P.prepStartSession, 'u-mina', { id: 'Mina', role: 'student', pw: 'nope' }), 'BAD-LOGIN'));
  재기('틀린 비번 뒤 클레임이 안 붙는다', !((await admin.auth().getUser('u-mina')).customClaims || {}).prep);
  재기('퇴원생은 비번이 맞아도 거절', 거절(await 부름(P.prepStartSession, 'u-gone', { id: 'Gone', role: 'student', pw: 'gone1234' }), 'BAD-LOGIN'));
  재기('교사 역할은 이 길로 세션을 안 받는다', 거절(await 부름(P.prepStartSession, 'u-t', { id: 'T', role: 'teacher', pw: 'teach123' }), 'BAD-ROLE'));
  const 지금 = Date.now();
  const s = await 부름(P.prepStartSession, 'u-mina', { id: 'Mina', role: 'student', pw: 'mina1234' });
  const c = ((await admin.auth().getUser('u-mina')).customClaims || {}).prep || {};
  재기('맞으면 세션을 준다', s && s.ok === true && s.sid === 'Mina', JSON.stringify(s));
  재기('클레임 = 학생 ID·역할·마스터 아님', c.sid === 'Mina' && c.role === 'student' && c.master === false, JSON.stringify(c));
  재기('만료는 12시간 뒤', Math.abs(c.exp - (지금 + 12 * 3600 * 1000)) < 60 * 1000, String(c.exp - 지금));
  await 부름(P.prepStartSession, 'u-aron', { id: 'Aron', role: 'student', pw: 'aron1234' });
  await 부름(P.prepStartSession, 'u-solo', { id: 'Solo', role: 'student', pw: 'solo1234' });
  const m = await 부름(P.prepStartSession, 'u-master', { id: 'Mina', role: 'student', pw: 'MASTER99' });
  const mc = ((await admin.auth().getUser('u-master')).customClaims || {}).prep || {};
  재기('마스터 비번 → 세션은 주되 master:true', m && m.ok && mc.master === true && mc.sid === 'Mina', JSON.stringify(mc));
  const 기록 = (await db.ref('master_login_logs').once('value')).val() || {};
  재기('마스터 세션은 기록을 남긴다', Object.values(기록).some(x => x.via === 'prepStartSession' && x.targetId === 'Mina'));
  await 부름(P.prepStartSession, 'u-mom', { id: 'MinaMom', role: 'parent', pw: 'mom12345' });
  const pc = ((await admin.auth().getUser('u-mom')).customClaims || {}).prep || {};
  재기('학부모 클레임에 자녀 목록(서버가 공책에서 읽음)', pc.role === 'parent' && pc.kids && pc.kids.Mina === true && !pc.kids.Aron, JSON.stringify(pc));
  재기('화면이 보낸 자녀 목록은 안 믿는다',
    (await 부름(P.prepStartSession, 'u-mom', { id: 'MinaMom', role: 'parent', pw: 'mom12345', kids: ['Aron'] }), !(((await admin.auth().getUser('u-mom')).customClaims || {}).prep.kids || {}).Aron));

  console.log('\n── ② 조회 — 남의 것·주소 바꾸기·만료는 거절');
  const L = await 부름(P.prepListMyAssignments, 'u-mina', {});
  재기('민아: 공개된 자기 배정만(A1)', L && L.status === 'ok' && L.assignments.map(a => a.assignmentId).join() === 'A1', JSON.stringify(L));
  재기('민아: 비공개 배정이 있다는 것은 수로만 알린다', L && L.hiddenCount === 1, JSON.stringify(L));
  재기('[2-B] 목록에 배정의 주(period)가 있다', L && L.assignments[0].period && L.assignments[0].period.week === 1, JSON.stringify(L && L.assignments));
  재기('[2-B] 비공개는 주만 알린다(제목·내용 없음)', L && L.hidden.length === 1 && L.hidden[0].period.week === 2 && !('title' in L.hidden[0]), JSON.stringify(L && L.hidden));
  재기('주소의 학생 ID 를 Aron 으로 바꾸면 거절', 거절(await 부름(P.prepListMyAssignments, 'u-mina', { studentId: 'Aron' }), 'NOT-YOURS'));
  const 솔로 = await 부름(P.prepListMyAssignments, 'u-solo', {});
  재기('배정이 하나도 없으면 「none」(실패와 구별)', 솔로 && 솔로.status === 'none' && 솔로.assignments.length === 0, JSON.stringify(솔로));
  재기('세션 없는 기기는 거절', 거절(await 부름(P.prepListMyAssignments, 'u-x', {}), 'NO-SESSION'));
  재기('만료된 세션은 거절', 거절(await 부름(P.prepListMyAssignments, 'u-mina', {}, { prep: { sid: 'Mina', role: 'student', master: false, exp: Date.now() - 1000 } }), 'SESSION-EXPIRED'));
  const g = await 부름(P.prepGetAssignment, 'u-mina', { assignmentId: 'A1' });
  재기('자기 배정은 받는다', g && g.assignmentId === 'A1' && g.sets && g.sets.s1 && g.sets.s1.questions.length === 2, JSON.stringify(g).slice(0, 200));
  재기('④ 학생에게 정답·해설·정답표가 안 간다', g && !JSON.stringify(g.sets).match(/"answer"|"answerKey"|"explanation"/), JSON.stringify(g && g.sets).slice(0, 300));
  재기('남의 배정(B1)은 「없음」으로 거절', 거절(await 부름(P.prepGetAssignment, 'u-mina', { assignmentId: 'B1' }), 'NO-ASSIGNMENT'));
  재기('없는 배정도 같은 말로 거절(있는지 새지 않게)', 거절(await 부름(P.prepGetAssignment, 'u-mina', { assignmentId: 'ZZ' }), 'NO-ASSIGNMENT'));
  재기('자기 것이라도 비공개면 「비공개」', 거절(await 부름(P.prepGetAssignment, 'u-mina', { assignmentId: 'A2' }), 'NOT-PUBLISHED'));
  재기('주소 학생 ID 바꿔 남의 배정 받기 → 거절', 거절(await 부름(P.prepGetAssignment, 'u-mina', { assignmentId: 'B1', studentId: 'Aron' }), 'NOT-YOURS'));
  재기('학부모는 자녀 배정을 본다', (await 부름(P.prepGetAssignment, 'u-mom', { assignmentId: 'A1', studentId: 'Mina' })).assignmentId === 'A1');
  재기('학부모가 남의 아이를 요청 → 거절', 거절(await 부름(P.prepGetAssignment, 'u-mom', { assignmentId: 'B1', studentId: 'Aron' }), 'NOT-YOURS'));
  재기('마스터는 볼 수 있다(보기 전용)', (await 부름(P.prepGetAssignment, 'u-master', { assignmentId: 'A1' })).assignmentId === 'A1');

  console.log('\n── ③ 제출');
  const 답 = { q0: 'B', q1: '6' };
  const r1 = await 부름(P.prepSubmit, 'u-mina', { assignmentId: 'A1', setId: 's1', rev: 1, answers: 답 });
  재기('자기 배정 제출 → 됨', r1 && r1.ok && r1.rev === 1, JSON.stringify(r1));
  재기('[2-B] 서버가 채점한다(B·6 → 100)', r1 && r1.score === 100 && r1.correctCount === 2 && r1.total === 2 && r1.wrong.length === 0, JSON.stringify(r1));
  const 칸 = (await db.ref('sol_prep_v1/submissions/A1/Mina/s1').once('value')).val() || {};
  재기('판 1 이 저장된다(누가·언제 포함)', 칸.revs && 칸.revs['1'] && 칸.revs['1'].answers.q1 === '6' && 칸.revs['1'].uid === 'u-mina' && 칸.latest === 1, JSON.stringify(칸));
  const r1b = await 부름(P.prepSubmit, 'u-mina', { assignmentId: 'A1', setId: 's1', rev: 1, answers: 답 });
  재기('같은 판 재시도(응답 유실) → 같은 결과 하나', r1b && r1b.ok && r1b.rev === 1 && r1b.duplicate === true, JSON.stringify(r1b));
  재기('같은 판에 다른 답 → 거절(덮지 않는다)', 거절(await 부름(P.prepSubmit, 'u-mina', { assignmentId: 'A1', setId: 's1', rev: 1, answers: { q0: 'A' } }), 'REV-CONFLICT'));
  const r2 = await 부름(P.prepSubmit, 'u-mina', { assignmentId: 'A1', setId: 's1', rev: 2, answers: { q0: 'A', q1: '6' } });
  const 칸2 = (await db.ref('sol_prep_v1/submissions/A1/Mina/s1').once('value')).val() || {};
  재기('[2-B] 판 2 채점(A·6 → 50 · 틀린 문항 q0 · 정답은 안 준다)', r2 && r2.score === 50 && JSON.stringify(r2.wrong) === '["q0"]' && !JSON.stringify(r2).includes('"answer"'), JSON.stringify(r2));
  재기('[2-B] 같은 판 재시도는 처음 점수 그대로', r1b && r1b.score === 100, JSON.stringify(r1b));
  const g2 = await 부름(P.prepGetAssignment, 'u-mina', { assignmentId: 'A1' });
  재기('[2-B] 배정을 다시 열면 마지막 판 점수·내 답이 온다', g2.submitted && g2.submitted.s1 && g2.submitted.s1.latest === 2 && g2.submitted.s1.grade.score === 50 && g2.submitted.s1.answers.q0 === 'A', JSON.stringify(g2.submitted));
  재기('[2-B] 그래도 정답은 안 온다', !JSON.stringify(g2).match(/"answer"|"answerKey"|"explanation"/));
  const L2 = await 부름(P.prepListMyAssignments, 'u-mina', {});
  재기('[2-B] 목록에 내 제출 요약(mine)이 온다', L2.assignments[0].mine && L2.assignments[0].mine.s1 && L2.assignments[0].mine.s1.latest === 2 && L2.assignments[0].mine.s1.score === 50, JSON.stringify(L2.assignments[0].mine));
  재기('새 판(2)은 옛 판을 덮지 않고 쌓인다', r2 && r2.ok && 칸2.latest === 2 && 칸2.revs['1'] && 칸2.revs['1'].answers.q0 === 'B' && 칸2.revs['2'].answers.q0 === 'A', JSON.stringify(칸2));
  재기('옛 판 번호로 새 답 → 거절', 거절(await 부름(P.prepSubmit, 'u-mina', { assignmentId: 'A1', setId: 's1', rev: 1, answers: { q0: 'C' } }), 'REV-CONFLICT'));
  재기('마스터로 제출 → 거절', 거절(await 부름(P.prepSubmit, 'u-master', { assignmentId: 'A1', setId: 's1', rev: 3, answers: 답 }), 'MASTER-READONLY'));
  재기('학부모 제출 → 거절', 거절(await 부름(P.prepSubmit, 'u-mom', { assignmentId: 'A1', setId: 's1', rev: 3, answers: 답, studentId: 'Mina' }), 'READONLY'));
  재기('남의 배정에 제출 → 거절', 거절(await 부름(P.prepSubmit, 'u-mina', { assignmentId: 'B1', setId: 's1', rev: 1, answers: 답 }), 'NO-ASSIGNMENT'));
  재기('주소 학생 ID 바꿔 남의 칸에 제출 → 거절', 거절(await 부름(P.prepSubmit, 'u-mina', { assignmentId: 'B1', setId: 's1', rev: 1, answers: 답, studentId: 'Aron' }), 'NOT-YOURS'));
  재기('아론 칸은 비어 있다', (await db.ref('sol_prep_v1/submissions/B1').once('value')).val() === null);
  재기('비공개 배정에 제출 → 거절', 거절(await 부름(P.prepSubmit, 'u-mina', { assignmentId: 'A2', setId: 's1', rev: 1, answers: 답 }), 'NOT-PUBLISHED'));
  재기('없는 세트 → 거절', 거절(await 부름(P.prepSubmit, 'u-mina', { assignmentId: 'A1', setId: 's9', rev: 1, answers: 답 }), 'NO-SET'));
  재기('만료된 세션으로 제출 → 거절', 거절(await 부름(P.prepSubmit, 'u-mina', { assignmentId: 'A1', setId: 's1', rev: 3, answers: 답 }, { prep: { sid: 'Mina', role: 'student', master: false, exp: Date.now() - 1 } }), 'SESSION-EXPIRED'));
  재기('답이 너무 크면 거절', 거절(await 부름(P.prepSubmit, 'u-mina', { assignmentId: 'A1', setId: 's1', rev: 3, answers: { q0: 'x'.repeat(5000) } }), 'BAD-INPUT'));
  재기('판 번호가 이상하면 거절', 거절(await 부름(P.prepSubmit, 'u-mina', { assignmentId: 'A1', setId: 's1', rev: 0, answers: 답 }), 'BAD-INPUT'));
  재기('열쇠에 못 쓰는 글자(점) → 거절', 거절(await 부름(P.prepSubmit, 'u-mina', { assignmentId: 'A1', setId: 's.1', rev: 3, answers: 답 }), 'BAD-INPUT'));
  // 동시에 같은 판을 두 번 — 하나만
  const [x1, x2] = await Promise.all([
    부름(P.prepSubmit, 'u-mina', { assignmentId: 'A1', setId: 's1', rev: 3, answers: 답 }),
    부름(P.prepSubmit, 'u-mina', { assignmentId: 'A1', setId: 's1', rev: 3, answers: 답 })]);
  const 칸3 = (await db.ref('sol_prep_v1/submissions/A1/Mina/s1').once('value')).val() || {};
  재기('같은 판 동시 두 번 → 둘 다 성공 응답 · 저장은 하나', x1.ok && x2.ok && Object.keys(칸3.revs).length === 3 && 칸3.latest === 3, JSON.stringify([x1, x2, Object.keys(칸3.revs)]));

  console.log('\n── 세션 끝내기');
  await 부름(P.prepEndSession, 'u-mina', {});
  재기('끝내면 클레임이 지워진다', !(((await admin.auth().getUser('u-mina')).customClaims || {}).prep));
  재기('끝낸 뒤 조회 → 거절', 거절(await 부름(P.prepListMyAssignments, 'u-mina', {}), 'NO-SESSION'));

  console.log('\n── ⑤ 옛 loginCheck 는 그대로');
  const lc = await 부름(A.loginCheck, 'u-aron', { id: 'Aron', role: 'student', pw: 'aron1234' });
  재기('loginCheck 는 예전처럼 { ok, isMaster } 만', lc && lc.ok === true && lc.isMaster === false && Object.keys(lc).length === 2, JSON.stringify(lc));
  const lcm = await 부름(A.loginCheck, 'u-aron', { id: 'Mina', role: 'student', pw: 'MASTER99' });
  재기('loginCheck 마스터도 예전처럼', lcm && lcm.ok === true && lcm.isMaster === true && Object.keys(lcm).length === 2, JSON.stringify(lcm));
  재기('loginCheck 는 클레임을 건드리지 않는다', ((await admin.auth().getUser('u-aron')).customClaims || {}).prep.sid === 'Aron');

  await db.ref().set(null);
  console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
  process.exit(실패 ? 1 : 0);
})().catch(e => {
  console.log('  ⛔ 터졌다: ' + (e && e.stack || e));
  console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + (실패 + 1));
  process.exit(1);
});
