// ============================================================
// 학생 세션 · 학생별 배정 조회 · 제출 일꾼 (2-A · 2026-10-01)
//
// 무엇을 하나
//   ① prepStartSession       비번을 **서버가** 다시 대조하고, 이 기기(익명 UID)에
//                            「누구로 들어왔는지」를 클레임으로 묶는다 — 12시간
//   ② prepEndSession         그 묶음을 푼다(로그아웃·학생 전환)
//   ③ prepListMyAssignments  내 배정 목록(공개된 것만) — 「배정 없음」과 「비공개」를 가른다
//   ④ prepGetAssignment      배정 하나 — **정답·해설은 빼고** 준다
//   ⑤ prepSubmit             제출 — 판(rev)마다 쌓고, 같은 판 재시도는 하나로, 덮지 않는다
//
// 왜 짓나
//   지금 로그인(loginCheck)은 「맞다/아니다」만 돌려줘서, 서버는 이 기기가 누구인지 모른다.
//   ⇒ 화면이 보낸 학생 ID 를 믿을 수밖에 없다(주소의 ID 를 바꾸면 남의 것을 본다).
//   여기서는 **클레임만** 믿는다. 화면이 보낸 studentId·isMaster·kids 는 판정에 쓰지 않는다
//   (studentId 를 보내면 「클레임과 같은가」 확인에만 쓴다 — 다르면 거절).
//
// ⛔ 덧붙이기만 했다 — loginCheck 와 옛 학생 화면은 그대로다. 이 일꾼들은 아직 아무도 안 부른다(2-B 에서 붙인다).
// ⛔ 새 자료는 새 뿌리 `sol_prep_v1` 에만 쓴다. 옛 solomon_hw_v3 는 읽기만(공책의 학생 줄).
//
// 클레임 꼴 (customClaims.prep)
//   { sid, role: 'student'|'parent', master: bool, kids: { <자녀ID>: true }(학부모만), exp: ms }
//   ⚠ 이름이 `exp` 인 맨 윗칸은 토큰 예약어라 `prep` 안에 둔다.
// ============================================================

'use strict';
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const S = require('./auth')._shared;
const { normAns } = require('./norm_answer');   // [2-B] 화면과 같은 채점 규칙
const { applyWeaknessJob } = require('./weakness_merge');   // [3-D] 화면과 같은 약점 합치기

const ROOT = 'sol_prep_v1';
const SESSION_MS = 12 * 60 * 60 * 1000;                 // 원장 결정 2026-10-01: 12시간
const KEY_RE = /^[A-Za-z0-9_\-가-힣]{1,80}$/;           // 경로 열쇠로 받을 수 있는 꼴
const MAX_ANSWERS = 300;
const MAX_ANSWER_LEN = 2000;
const HIDE_FIELDS = ['answer', 'answerKey', 'answers', 'explanation', 'correct', 'correct_choice', 'correct_text', 'solution'];

// ─────────────────────────────────────────────
// 세션 꺼내기 — 클레임만 믿는다
// ─────────────────────────────────────────────
function sessionOf(req) {
  if (!req.auth || !req.auth.uid) throw new HttpsError('unauthenticated', 'NO-AUTH');
  const p = req.auth.token && req.auth.token.prep;
  if (!p || !p.sid || !p.role) throw new HttpsError('unauthenticated', 'NO-SESSION');
  if (!(Number(p.exp) > Date.now())) throw new HttpsError('unauthenticated', 'SESSION-EXPIRED');
  return p;
}

/** 이 세션이 볼 수 있는 학생 ID. 화면이 studentId 를 보냈으면 그것이 허용 범위 안이어야 한다. */
function targetStudent(sess, asked) {
  const want = asked == null || asked === '' ? null : String(asked);
  if (sess.role === 'student') {
    if (want && want !== sess.sid) throw new HttpsError('permission-denied', 'NOT-YOURS');
    return sess.sid;
  }
  if (sess.role === 'parent') {
    const kids = sess.kids || {};
    const one = Object.keys(kids).filter(k => kids[k] === true);
    if (want) {
      if (!kids[want]) throw new HttpsError('permission-denied', 'NOT-YOURS');
      return want;
    }
    if (one.length === 1) return one[0];
    throw new HttpsError('invalid-argument', 'WHICH-CHILD');
  }
  throw new HttpsError('permission-denied', 'BAD-ROLE');
}

function safeKey(v, 이름) {
  const s = String(v == null ? '' : v);
  if (!KEY_RE.test(s)) throw new HttpsError('invalid-argument', 'BAD-INPUT:' + 이름);
  return s;
}

/** 학생에게 보낼 문항 — 정답·해설 칸을 뺀다(깊이 상관없이). */
function stripForStudent(v) {
  if (Array.isArray(v)) return v.map(stripForStudent);
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v)) if (!HIDE_FIELDS.includes(k)) o[k] = stripForStudent(v[k]);
    return o;
  }
  return v;
}

async function bookRow(role, id) {
  const snap = await admin.database().ref(S.BOOK).once('value');
  const users = snap.val() || [];
  const list = Array.isArray(users) ? users : Object.values(users);
  return list.find(u => u && u.id === id && u.role === role) || null;
}

// ─────────────────────────────────────────────
// ① 세션 시작 — loginCheck 와 **같은 대조 규칙**(횟수 제한·마스터·금고)
// ─────────────────────────────────────────────
exports.prepStartSession = onCall({ region: S.REGION }, async (req) => {
  const uid = req.auth && req.auth.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'NO-AUTH');
  const id = String((req.data && req.data.id) || '').trim();
  const role = String((req.data && req.data.role) || '').trim();
  const pw = String((req.data && req.data.pw) || '');
  if (!id || !role || !pw) throw new HttpsError('invalid-argument', 'BAD-INPUT');
  if (role !== 'student' && role !== 'parent') throw new HttpsError('invalid-argument', 'BAD-ROLE');

  await S.assertTryBudget(uid);
  await S.assertNotLocked(role, id);

  // 공책에 살아 있는 사람이어야 한다 — 퇴원생은 비번이 맞아도 세션을 안 준다
  const row = await bookRow(role, id);
  const alive = row && row.status !== 'inactive';

  let master = false;
  const m = await admin.database().ref(S.VAULT + '/_master').once('value');
  const masterPw = m.exists() && m.val() ? m.val().pw : null;
  if (masterPw && S.verifyPw(pw, masterPw).ok) {
    master = true;
  } else {
    const stored = await S.readStoredPw(role, id);
    if (!stored.pw || !S.verifyPw(pw, stored.pw).ok) {
      await S.noteFailure(role, id);
      throw new HttpsError('permission-denied', 'BAD-LOGIN');
    }
  }
  if (!alive) {
    if (!master) await S.noteFailure(role, id);
    throw new HttpsError('permission-denied', 'BAD-LOGIN');
  }
  if (!master) await S.clearFailures(role, id);

  const exp = Date.now() + SESSION_MS;
  const prep = { sid: id, role, master, exp };
  if (role === 'parent') {
    // 자녀 목록은 **서버가 공책에서** 읽는다. 화면이 보낸 값은 안 믿는다.
    prep.kids = {};
    for (const k of (row.childIds || [])) if (KEY_RE.test(String(k))) prep.kids[String(k)] = true;
  }
  const cur = (await admin.auth().getUser(uid)).customClaims || {};
  await admin.auth().setCustomUserClaims(uid, Object.assign({}, cur, { prep }));

  if (master) {
    try {
      await admin.database().ref('master_login_logs').push({
        targetId: id, targetRole: role, via: 'prepStartSession',
        timestamp: Date.now(), timestampISO: new Date().toISOString()
      });
    } catch (e) { console.warn('[prep] 마스터 기록 실패:', e && e.message); }
  }
  // 화면은 이 뒤에 getIdToken(true) 로 토큰을 새로 받아야 클레임이 실린다.
  return { ok: true, sid: id, role, master, exp };
});

// ─────────────────────────────────────────────
// ② 세션 끝내기
// ─────────────────────────────────────────────
exports.prepEndSession = onCall({ region: S.REGION }, async (req) => {
  const uid = req.auth && req.auth.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'NO-AUTH');
  const cur = (await admin.auth().getUser(uid)).customClaims || {};
  if (cur.prep) {
    const next = Object.assign({}, cur);
    delete next.prep;
    await admin.auth().setCustomUserClaims(uid, Object.keys(next).length ? next : null);
  }
  return { ok: true };
});

// ─────────────────────────────────────────────
// ③ 내 배정 목록
// ─────────────────────────────────────────────
exports.prepListMyAssignments = onCall({ region: S.REGION }, async (req) => {
  const sess = sessionOf(req);
  const sid = targetStudent(sess, req.data && req.data.studentId);
  const snap = await admin.database().ref(ROOT + '/releases').orderByChild('studentId').equalTo(sid).once('value');
  const all = snap.val() || {};
  const assignments = [];
  const hidden = [];   // [2-B] 비공개는 「어느 주가 준비 중인지」만 — 제목·내용은 안 준다
  let hiddenCount = 0;
  for (const [assignmentId, r] of Object.entries(all)) {
    if (!r || r.studentId !== sid) continue;
    if (r.published !== true) { hiddenCount++; hidden.push({ assignmentId, period: periodOf(r) }); continue; }
    const sets = r.sets || {};
    // [2-B] 내 제출 요약(세트마다 마지막 판·점수) — 학생 홈·학부모 화면이 한 번에 그린다
    const subs = (await admin.database().ref(ROOT + '/submissions/' + assignmentId + '/' + sid).once('value')).val() || {};
    const mine = {};
    for (const setId of Object.keys(subs)) {
      const m = subs[setId] || {};
      const last = m.latest && m.revs ? m.revs[String(m.latest)] : null;
      mine[setId] = { latest: m.latest || 0, score: last && last.grade ? last.grade.score : null,
        correctCount: last && last.grade ? last.grade.correctCount : null, total: last && last.grade ? last.grade.total : null,
        submittedAt: last ? last.submittedAt || null : null };
    }
    assignments.push({
      assignmentId, title: r.title || '', releasedAt: r.releasedAt || null, period: periodOf(r),
      sets: Object.keys(sets).map(setId => ({ setId, title: (sets[setId] && sets[setId].title) || '',
        n: Object.keys((sets[setId] && sets[setId].questions) || {}).length })),
      mine
    });
  }
  // 「none」 = 서버를 읽었고 이 아이 몫이 하나도 없다(실패와 다르다) · 「ok」 = 공개된 것이 있다
  //  · 「hidden」 = 있는데 아직 비공개뿐
  const status = assignments.length ? 'ok' : (hiddenCount ? 'hidden' : 'none');
  return { status, studentId: sid, assignments, hiddenCount, hidden };
});

// ─────────────────────────────────────────────
// ④ 배정 하나 — 정답·해설은 빼고
// ─────────────────────────────────────────────
/** 배정의 주(period) — { year, month, week } 꼴만 받는다. 없으면 null. */
function periodOf(r) {
  const p = r && r.period;
  if (!p) return null;
  const y = Number(p.year), m = Number(p.month), w = Number(p.week);
  return (Number.isInteger(y) && Number.isInteger(m) && Number.isInteger(w)) ? { year: y, month: m, week: w } : null;
}

/** [2-B] 서버 채점 — 화면 doSubmit 과 같은 규칙(서술형 빼고 · normAns). */
function gradeSet(set, answers) {
  const qs = set && set.questions ? (Array.isArray(set.questions) ? set.questions : Object.values(set.questions)) : [];
  const autoQs = qs.filter(q => q && q.type !== 'written');
  const wrong = [];
  let correctCount = 0;
  for (const q of autoQs) {
    if (normAns(answers[q.id]) === normAns(q.answer)) correctCount++;
    else wrong.push(q.id);
  }
  const total = autoQs.length;
  return { score: total > 0 ? Math.round(correctCount / total * 100) : 0, correctCount, total, wrong };
}

async function readMine(sess, assignmentId, askedStudent) {
  const sid = targetStudent(sess, askedStudent);
  const aid = safeKey(assignmentId, 'assignmentId');
  const r = (await admin.database().ref(ROOT + '/releases/' + aid).once('value')).val();
  // 남의 것과 없는 것은 **같은 말**로 — 있는지조차 새지 않게
  if (!r || r.studentId !== sid) throw new HttpsError('not-found', 'NO-ASSIGNMENT');
  if (r.published !== true) throw new HttpsError('failed-precondition', 'NOT-PUBLISHED');
  return { sid, aid, r };
}

exports.prepGetAssignment = onCall({ region: S.REGION }, async (req) => {
  const sess = sessionOf(req);
  const { sid, aid, r } = await readMine(sess, req.data && req.data.assignmentId, req.data && req.data.studentId);
  const mine = (await admin.database().ref(ROOT + '/submissions/' + aid + '/' + sid).once('value')).val() || {};
  const submitted = {};
  for (const setId of Object.keys(mine)) {
    const m = mine[setId] || {};
    const last = m.latest && m.revs ? m.revs[String(m.latest)] : null;
    submitted[setId] = { latest: m.latest || 0,
      grade: last && last.grade ? last.grade : null, submittedAt: last ? last.submittedAt || null : null,
      // 학생이 낸 답(자기 것) — 결과 화면용. 정답은 안 준다.
      answers: last ? last.answers || {} : {},
      manual: m.manual || null };
  }
  return {
    assignmentId: aid, studentId: sid, title: r.title || '', releasedAt: r.releasedAt || null, period: periodOf(r),
    manifestHash: r.manifestHash || null,
    sets: stripForStudent(r.sets || {}),
    submitted,
    readOnly: !!sess.master || sess.role !== 'student'
  };
});

// ─────────────────────────────────────────────
// ⑤ 제출 — 판마다 쌓는다 · 같은 판 같은 답 = 하나 · 같은 판 다른 답 = 거절
// ─────────────────────────────────────────────
function checkAnswers(a) {
  if (!a || typeof a !== 'object' || Array.isArray(a)) throw new HttpsError('invalid-argument', 'BAD-INPUT:answers');
  const ks = Object.keys(a);
  if (ks.length > MAX_ANSWERS) throw new HttpsError('invalid-argument', 'BAD-INPUT:answers');
  const out = {};
  for (const k of ks) {
    safeKey(k, 'answerKey');
    const v = a[k];
    if (v == null) continue;
    if (typeof v !== 'string' && typeof v !== 'number') throw new HttpsError('invalid-argument', 'BAD-INPUT:answers');
    const s = String(v);
    if (s.length > MAX_ANSWER_LEN) throw new HttpsError('invalid-argument', 'BAD-INPUT:answers');
    out[k] = s;
  }
  return out;
}
const sameAnswers = (a, b) => JSON.stringify(Object.keys(a || {}).sort().map(k => [k, a[k]]))
                            === JSON.stringify(Object.keys(b || {}).sort().map(k => [k, b[k]]));

exports.prepSubmit = onCall({ region: S.REGION }, async (req) => {
  const sess = sessionOf(req);
  if (sess.master) throw new HttpsError('permission-denied', 'MASTER-READONLY');
  if (sess.role !== 'student') throw new HttpsError('permission-denied', 'READONLY');
  const d = req.data || {};
  const rev = Number(d.rev);
  if (!Number.isInteger(rev) || rev < 1 || rev > 1000) throw new HttpsError('invalid-argument', 'BAD-INPUT:rev');
  const setId = safeKey(d.setId, 'setId');
  const answers = checkAnswers(d.answers);
  const { sid, aid, r } = await readMine(sess, d.assignmentId, d.studentId);
  if (!r.sets || !r.sets[setId]) throw new HttpsError('not-found', 'NO-SET');

  const base = admin.database().ref(ROOT + '/submissions/' + aid + '/' + sid + '/' + setId);
  const grade = gradeSet(r.sets[setId], answers);   // [2-B] 서버가 채점한다(학생은 정답을 모른다)
  const now = new Date().toISOString();
  let 결과 = null;
  const res = await base.child('revs/' + rev).transaction(cur => {
    if (cur) {
      결과 = sameAnswers(cur.answers, answers) ? 'dup' : 'conflict';
      return;   // 이미 있는 판은 손대지 않는다
    }
    결과 = 'new';
    return { answers, submittedAt: now, uid: req.auth.uid, manifestHash: r.manifestHash || null, grade };
  });
  if (!res.committed) {
    // 트랜잭션이 그만둔 까닭 — 마지막으로 본 값으로 가른다
    const v = res.snapshot.val();
    if (v && sameAnswers(v.answers, answers)) 결과 = 'dup';
    else 결과 = 'conflict';
  }
  if (결과 === 'conflict') throw new HttpsError('already-exists', 'REV-CONFLICT');
  await base.child('latest').transaction(cur => (Number(cur) || 0) >= rev ? undefined : rev);
  // ★ [3-D · 2026-10-01 원장 결정] 개인 배정 약점 반영 — 학생 화면 그룹 숙제와 같은 칸·같은 규칙.
  //   같은 제출(prep_<배정>_<세트>)·같은 판은 한 번 · 새 판은 옛 기여분 대체. 실패해도 제출은 성공으로 둔다
  //   (다음 판이나 같은 판 재시도 때 다시 반영된다 — applied 판으로 거른다).
  try {
    const qs = Array.isArray(r.sets[setId].questions) ? r.sets[setId].questions : Object.values(r.sets[setId].questions || {});
    const items = qs.filter(q => q && q.type !== 'written' && q.taxonomy_id)
      .map(q => ({ t: String(q.taxonomy_id), c: normAns(answers[q.id]) === normAns(q.answer) }));
    if (items.length || rev > 1) {
      await applyWeaknessJob(admin.database().ref(), { sid, subKey: 'prep_' + aid + '_' + setId, rev, items });
    }
  } catch (e) {
    console.warn('[prep] 약점 반영 실패(제출은 저장됨):', aid, setId, rev, e && e.message);
  }
  // 점수만 돌려준다 — 어느 문항을 틀렸는지(id)는 주되 정답은 안 준다
  const 저장된 = (await base.child('revs/' + rev + '/grade').once('value')).val() || grade;
  return { ok: true, assignmentId: aid, setId, rev, duplicate: 결과 === 'dup',
    score: 저장된.score, correctCount: 저장된.correctCount, total: 저장된.total, wrong: 저장된.wrong || [] };
});

// 시험용(일꾼 동작에는 안 쓰인다)
exports._internals = { sessionOf, targetStudent, stripForStudent, safeKey, SESSION_MS, gradeSet, periodOf };
