// ============================================================
// 그룹 숙제(MR) 제출 · 새로 풀기 — 서버가 한 동작으로 (정비 §5-①②⑤ · 2026-10-03)
//
// 왜 서버로 옮기나 (10-03 점검)
//   ① 화면이 「이 창이 기억하는 답」을 다 다시 올려 제출하면, 오래 열린 창이 다른 창의 새 답을 덮는다.
//   ② 새로 풀기가 「읽고 → 따로 비우기」라 그 사이 들어온 답이 보관함에도 안 들어가고 사라진다.
//   ⑤ 학생이 자기 칸의 제출 표시·점수를 직접 쓸 수 있었다(규칙이 막지 못함).
//   ⇒ 제출 확정·채점·리포트·새로 풀기는 **서버가 트랜잭션으로** 하고, 학생은 답 칸만 쓴다(규칙 정비6).
//
// hwSubmit(data)      { key, hwKey, setIdx, answers:{q:값}, sent:{q:이 기기가 마지막으로 보낸 값}, opId }
//   - 서버 칸의 답이 기준. 서버에 없거나 · 같거나 · 「이 기기가 전에 보낸 값」이면 기기 답을 쓴다.
//     그 밖(다른 창·기기가 쓴 다른 답)은 **서버 답을 지키고** 기기 답을 _conflicts 에 남긴다(①).
//   - 채점·리포트는 서버가(화면 doSubmit 과 같은 꼴) · rev = 서버 rev + 1 · 원장 처리 표시는 지운다.
//   - 같은 opId 로 다시 오면 하나로(응답 유실·두 번 누르기 · T13).
//   - 이미 정상 제출된 칸이면 바꾸지 않고, 다른 답만 _conflicts 에 남긴다.
// hwStartFresh(data)  { key, hwKey, opId } — 서버 칸 그대로를 보관함(_prev)에 넣고 비운다(②) · 같은 opId 는 하나로.
//
// 신분: 학생 세션 클레임만 믿는다(prep_session.sessionOf) · 마스터·학부모·세션 끝 = 거절 · 열쇠는 본인 것만.
// ============================================================
'use strict';
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const S = require('./auth')._shared;
const { normAns } = require('./norm_answer');
const { applyWeaknessJob } = require('./weakness_merge');
const { sessionOf } = require('./prep_session')._internals;

const ROOT = 'solomon_hw_v3';
const MAX_ANSWERS = 300, MAX_ANSWER_LEN = 2000;
const OP_RE = /^[A-Za-z0-9_\-]{6,80}$/;

// 화면 detectWeakAreas 를 글자째 옮김 — 화면을 고치면 여기도(functions/화면시험/제출서버_같은가.test.js 가 지킨다)
function detectWeakAreas(wrongQs) {
  const areas = {};
  wrongQs.forEach(q => {
    const text = (q.text||'').toLowerCase();
    const keywords = [
      {area:'Fractions', patterns:['fraction','분수','/','numerator','denominator']},
      {area:'Decimals', patterns:['decimal','소수','0.']},
      {area:'Percentages', patterns:['percent','%','백분율']},
      {area:'Algebra', patterns:['algebra','equation','변수','x =','solve','simplif']},
      {area:'Geometry', patterns:['area','perimeter','angle','triangle','circle','rectangle','도형','넓이','둘레']},
      {area:'Multiplication', patterns:['multiply','times','×','곱']},
      {area:'Division', patterns:['divide','÷','나누']},
      {area:'Addition/Subtraction', patterns:['add','subtract','sum','difference','더하','빼']},
      {area:'Word Problems', patterns:['how many','how much','altogether','remaining','몇 개','얼마']},
      {area:'Measurement', patterns:['cm','mm','kg','litre','meter','측정']},
      {area:'Statistics', patterns:['mean','median','mode','average','평균','통계']},
      {area:'Ratio/Proportion', patterns:['ratio','proportion','비율']},
    ];
    let matched = false;
    keywords.forEach(kw => {
      if (kw.patterns.some(p => text.includes(p))) {
        areas[kw.area] = (areas[kw.area]||0) + 1;
        matched = true;
      }
    });
    if (!matched) areas['General Math'] = (areas['General Math']||0) + 1;
  });
  return Object.entries(areas).sort((a,b)=>b[1]-a[1]).map(([area,count])=>({area,count}));
}

const 같다 = (a, b) => JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);
const 목록 = (v) => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);

function checkAnswers(a) {
  if (a == null) return {};
  if (typeof a !== 'object' || Array.isArray(a)) throw new HttpsError('invalid-argument', 'BAD-INPUT:answers');
  const out = {};
  const ks = Object.keys(a);
  if (ks.length > MAX_ANSWERS) throw new HttpsError('invalid-argument', 'BAD-INPUT:answers');
  for (const k of ks) {
    if (!/^[A-Za-z0-9_\-]{1,40}$/.test(k)) throw new HttpsError('invalid-argument', 'BAD-INPUT:answers');
    const v = a[k];
    if (v == null) continue;
    const s = typeof v === 'string' ? v : String(v);
    if (s.length > MAX_ANSWER_LEN) throw new HttpsError('invalid-argument', 'BAD-INPUT:answers');
    out[k] = s;
  }
  return out;
}

/** 열쇠·숙제 열쇠가 이 학생·이 주의 것인지. 돌려주는 값: { period, setIdx } */
function checkKeys(sid, key, hwKey, year) {
  key = String(key || ''); hwKey = String(hwKey || '');
  if (!key.startsWith(sid + '_')) throw new HttpsError('permission-denied', 'NOT-YOURS');
  const m = /^(\d{4})_m(\d{2})_w(\d)_s(\d{1,2})$/.exec(key.slice(sid.length + 1));
  if (!m) throw new HttpsError('invalid-argument', 'BAD-INPUT:key');
  const 꼬리 = '_' + m[1] + '_m' + m[2] + '_w' + m[3];
  const h = /^([A-Z]{2})_y(\d{1,2})(-[A-Za-z0-9_\-가-힣]{1,30})?(_\d{4}_m\d{2}_w\d)$/.exec(hwKey);
  if (!h || h[4] !== 꼬리) throw new HttpsError('invalid-argument', 'BAD-INPUT:hwKey');
  if (year != null && String(h[2]) !== String(year)) throw new HttpsError('permission-denied', 'NOT-YOUR-YEAR');
  return { period: { year: Number(m[1]), month: Number(m[2]), week: Number(m[3]) }, setIdx: Number(m[4]) };
}

// ── [점검 10-05 F6] 이 아이에게 **걸린** 숙제인가 — 화면 hwLookupKey + visibleHw 와 **같은 규칙**으로 고른다
//   (functions/화면시험/배정고르기_같은가.test.js 가 화면과 같은지 지킨다 · 설계 docs/설계_F6_배정확인_1005.md)
//   ① 반이 있고 반 칸이 DB 에 있으면(반 칸막이 _placeholder 포함) → 반 열쇠만
//   ② 아니면 공통 열쇠만 · ③ 고른 칸이 published === false 면 비공개
//   개인 배정이 있는 주의 그룹 제출은 막지 않는다(원장 결정 10-05 ㉢ — 화면이 이미 안 보여 준다).
//   반을 옮긴 뒤의 옛 반 제출 · 비공개 숙제 제출은 거절(㉠㉡) — 화면이 답을 교사 「⚠ 확인」에 남긴다.
// ⛔ ASSIGN_ENFORCE=false 동안은 **기록만**(sol_v4/ops/assignWarn) — 3일 지켜보고 0건이면 true 로(㉣).
const ASSIGN_ENFORCE = false;
const 막기켜짐 = () => ASSIGN_ENFORCE || process.env.HW_ASSIGN_ENFORCE === '1';   // 환경 변수는 시험용
function 배정후보(who, period) {
  const c = who.country || 'AU', g = who.group || '';
  const 꼬리 = '_' + period.year + '_m' + String(period.month).padStart(2, '0') + '_w' + period.week;
  return { 반: g ? c + '_y' + who.year + '-' + g + 꼬리 : null, 공통: c + '_y' + who.year + 꼬리 };
}
/** 순수 — 칸(k) = { exists, published } 를 주면 { key, why } · why: null | 'NOT-PUBLISHED' | 'NO-HW' */
function 배정고르기(who, period, 칸) {
  const { 반, 공통 } = 배정후보(who, period);
  const key = (반 && 칸(반).exists) ? 반 : (칸(공통).exists ? 공통 : null);
  if (!key) return { key: null, why: 'NO-HW' };
  if (칸(key).published === false) return { key, why: 'NOT-PUBLISHED' };
  return { key, why: null };
}
/** 보낸 hwKey 를 판정 — null(통과) | 'NOT-ASSIGNED' | 'NOT-PUBLISHED' */
function 배정판정(고름, hwKey) {
  if (!고름.key || 고름.key !== hwKey) return 'NOT-ASSIGNED';
  return 고름.why === 'NOT-PUBLISHED' ? 'NOT-PUBLISHED' : null;
}
/** DB 에서 칸 둘(반·공통)을 작게 읽어(통째로 안 읽는다 — 그림 때문에 수백 KB) 판정하고, 막기/기록한다. */
async function 배정확인(fn, sid, who, period, key, hwKey) {
  const db = admin.database();
  const 후보 = 배정후보(who, period);
  const 정보 = {};
  await Promise.all([후보.반, 후보.공통].filter(Boolean).map(async (k) => {
    const [있음, 공개] = await Promise.all([
      db.ref(ROOT + '/homeworkSets/' + k).orderByKey().limitToFirst(1).once('value').then(s => s.exists()),
      db.ref(ROOT + '/homeworkSets/' + k + '/published').once('value').then(s => s.val()),
    ]);
    정보[k] = { exists: 있음, published: 공개 };
  }));
  const 고름 = 배정고르기(who, period, (k) => 정보[k] || { exists: false, published: null });
  const 판정 = 배정판정(고름, hwKey);
  if (!판정) return;
  const 막음 = 막기켜짐();
  console.warn('[' + fn + '] 배정 아님(' + 판정 + (막음 ? ' · 거절' : ' · 기록만') + '):', sid, key, hwKey, '→', 고름.key);
  await db.ref('sol_v4/ops/assignWarn').push({ fn, sid, key, hwKey, expect: 고름.key || null, why: 판정, enforced: 막음, at: Date.now() }).catch(() => {});
  if (막음) throw new HttpsError('permission-denied', 판정);
}

/** 서버 답 + 기기 답 → 최종 답 · 남길 충돌. sent = 이 기기가 전에 서버에 보낸 값. */
function mergeAnswers(server, device, sent) {
  const 최종 = Object.assign({}, server || {});
  const 충돌 = {};
  for (const [q, v] of Object.entries(device || {})) {
    const s = (server || {})[q];
    if (s == null || 같다(s, v) || ((sent || {})[q] !== undefined && 같다(s, sent[q]))) 최종[q] = v;
    else 충돌[q] = { server: s, mine: v };
  }
  return { 최종, 충돌 };
}

/** 화면 doSubmit 과 같은 리포트 꼴 */
function buildReport(set, answers, who, period, now) {
  const qs = 목록(set.questions);
  const autoQs = qs.filter(q => q && q.type !== 'written');
  const correct = autoQs.filter(q => normAns(answers[q.id]) === normAns(q.answer)).length;
  const score = autoQs.length > 0 ? Math.round(correct / autoQs.length * 100) : 0;
  const wrongQs = autoQs.filter(q => normAns(answers[q.id]) !== normAns(q.answer));
  return {
    reportData: {
      studentId: who.id, studentName: who.name || who.id, year: who.year, setTitle: set.title || '',
      period, totalQuestions: autoQs.length, correctCount: correct, score,
      wrongQuestions: wrongQs.map((q, i) => ({ num: i + 1, text: String(q.text || '').substring(0, 80),
        studentAnswer: answers[q.id] || '(no answer)', correctAnswer: q.answer == null ? '' : q.answer, type: q.type || '' })),
      weakAreas: detectWeakAreas(wrongQs), submittedAt: now,
    },
    items: qs.filter(q => q && q.taxonomy_id).map(q => ({ t: String(q.taxonomy_id), c: normAns(answers[q.id]) === normAns(q.answer) })),
  };
}

// [점검 10-05 F1] 이 칸이 이미 처리한 작업 번호(opId) — 마지막 하나만 보면
//   「제출 X → 새로 풀기 → 늦게 온 X」 에서 X 가 새 칸에 다시 들어가고,
//   「새로 풀기 A → 새로 풀기 B → 새 답 → 늦게 온 A」 에서 진행 중인 풀이가 비워졌다.
//   ⇒ 제출·새로 풀기 둘 다 최근 OPS_KEEP 개를 칸 안 _ops 에 적고, 어느 것이든 본 번호면 손대지 않는다.
const OPS_KEEP = 30;
function 본작업(c, opId) {
  return !!c && (c.lastSubmitOp === opId || c.lastFreshOp === opId || !!(c._ops && c._ops[opId]));
}
function 작업적기(n, opId, at) {
  const o = Object.assign({}, n._ops || {});
  o[opId] = Number(at) || Date.now();
  n._ops = {};
  Object.keys(o).sort((a, b) => o[b] - o[a]).slice(0, OPS_KEEP).forEach(k => { n._ops[k] = o[k]; });
}

/** 트랜잭션 몸 — 서버 값 cur 로 다음 값을 낸다(순수 · 시험이 그대로 부른다). 결과는 out 에 적는다. */
function submitStep(cur, inp, out) {
  out.kind = null; out.충돌 = {};
  const c = cur || {};
  if (본작업(c, inp.opId)) { out.kind = 'dup'; return undefined; }
  if (c.submitted && !c.manuallyMarked) {
    for (const [q, v] of Object.entries(inp.answers)) if (!같다((c.answers || {})[q], v)) out.충돌[q] = { server: (c.answers || {})[q] == null ? null : c.answers[q], mine: v };
    out.kind = 'already';
    if (!Object.keys(out.충돌).length) return undefined;
    // 제출은 그대로 두고 _conflicts 만 더한다 — **같은 트랜잭션 안에서**(따로 쓰면 다른 트랜잭션을 깨뜨린다)
    const n = Object.assign({}, c, { _conflicts: Object.assign({}, c._conflicts || {}) });
    for (const [q, x] of Object.entries(out.충돌)) n._conflicts['answers|' + q + '|' + inp.at] = { server: x.server, mine: x.mine, at: inp.at };
    작업적기(n, inp.opId, inp.at);   // 같은 일이 다시 와도 충돌을 두 번 적지 않게
    return n;
  }
  const { 최종, 충돌 } = mergeAnswers(c.answers, inp.answers, inp.sent);
  out.충돌 = 충돌;
  const 리포트 = buildReport(inp.set, 최종, inp.who, inp.period, inp.now);
  out.items = 리포트.items;
  const n = Object.assign({}, c, {
    answers: 최종, submitted: true, submitTime: inp.now, rev: (Number(c.rev) || 0) + 1,
    hwKey: inp.hwKey, reportData: 리포트.reportData, lastSubmitOp: inp.opId,
  });
  for (const k of ['manuallyMarked', 'markedBy', 'markedAt', 'markedReason', 'markedReasonCode']) delete n[k];
  if (Object.keys(충돌).length) {
    n._conflicts = Object.assign({}, c._conflicts || {});
    for (const [q, x] of Object.entries(충돌)) n._conflicts['answers|' + q + '|' + inp.at] = { server: x.server, mine: x.mine, at: inp.at };
  }
  작업적기(n, inp.opId, inp.at);
  out.kind = 'new'; out.rev = n.rev;
  return n;
}

function freshStep(cur, inp, out) {
  out.kind = null;
  if (!cur) { out.kind = 'empty'; return null; }
  if (본작업(cur, inp.opId)) { out.kind = 'dup'; return undefined; }
  const stash = {
    answers: cur.answers || {}, reportData: cur.reportData || null,
    submitTime: cur.submitTime || null, hwKey: cur.hwKey || null,
    remediation: cur.remediation || null, movedAt: inp.now,
  };
  const n = Object.assign({}, cur);
  n._prev = 목록(cur._prev).concat([stash]);
  n.answers = {}; n.submitted = false; n.submitTime = null;
  delete n.reportData; delete n.remediation; delete n.celebrationShown;
  n.hwKey = inp.hwKey; n.lastFreshOp = inp.opId;
  작업적기(n, inp.opId, inp.at);
  out.kind = 'new';
  return n;
}

async function 학생과줄(req) {
  const sess = sessionOf(req);
  if (sess.master) throw new HttpsError('permission-denied', 'MASTER-READONLY');
  if (sess.role !== 'student') throw new HttpsError('permission-denied', 'READONLY');
  const snap = await admin.database().ref(S.BOOK).once('value');
  const users = 목록(snap.val());
  const who = users.find(u => u && u.id === sess.sid && u.role === 'student');
  if (!who) throw new HttpsError('not-found', 'NO-STUDENT');
  return { sid: sess.sid, who };
}

exports.hwSubmit = onCall({ region: S.REGION }, async (req) => {
  const d = req.data || {};
  if (!OP_RE.test(String(d.opId || ''))) throw new HttpsError('invalid-argument', 'BAD-INPUT:opId');
  const { sid, who } = await 학생과줄(req);
  const { period, setIdx } = checkKeys(sid, d.key, d.hwKey, who.year);
  const answers = checkAnswers(d.answers), sent = checkAnswers(d.sent);
  await 배정확인('hwSubmit', sid, who, period, String(d.key), String(d.hwKey));
  const set =(await admin.database().ref(ROOT + '/homeworkSets/' + d.hwKey + '/sets/' + setIdx).once('value')).val();
  if (!set) throw new HttpsError('not-found', 'NO-SET');
  const now = new Date().toISOString();
  const inp = { opId: String(d.opId), answers, sent, set, who, period, now, at: Date.now(), hwKey: String(d.hwKey) };
  const out = {};
  const ref = admin.database().ref(ROOT + '/submissions/' + d.key);
  // applyLocally=false — 끝나지 않은 값을 같은 서버의 다른 요청이 보지 않게(진짜 저장된 값만 본다)
  const res = await ref.transaction(cur => submitStep(cur, inp, out), undefined, false);
  const v = res.snapshot.val() || {};
  // [점검 10-05 F7] 약점 반영이 실패하면 weakPending 으로 알린다 — 화면은 줄의 일을 지우지 않고 두었다가
  //   같은 opId 로 다시 보낸다 ⇒ 아래 「dup·already」 길에서 **지금 서버 칸** 그대로 다시 반영한다.
  //   applyWeaknessJob 은 판(rev)으로 한 번만 세므로 몇 번 불러도 두 번 더해지지 않는다. 제출은 건드리지 않는다.
  let weakPending = false;
  const 약점 = async (rev, items) => {
    try { await applyWeaknessJob(admin.database().ref(), { sid, subKey: String(d.key), rev, items: items || [] }); }
    catch (e) { weakPending = true; console.warn('[hwSubmit] 약점 반영 실패(제출은 저장됨):', d.key, e && e.message); }
  };
  if (res.committed && out.kind === 'new') {
    await admin.database().ref(ROOT + '/lastModified').set(Date.now()).catch(() => {});
    await 약점(out.rev, out.items);
  } else if ((out.kind === 'dup' || out.kind === 'already') && v.submitted && !v.manuallyMarked && Number(v.rev) > 0 && v.hwKey === inp.hwKey) {
    await 약점(Number(v.rev), buildReport(set, v.answers || {}, who, period, now).items);
  }
  return { ok: true, kind: out.kind || (res.committed ? 'new' : 'dup'), sub: v, conflicts: Object.keys(out.충돌 || {}), weakPending };
});

exports.hwStartFresh = onCall({ region: S.REGION }, async (req) => {
  const d = req.data || {};
  if (!OP_RE.test(String(d.opId || ''))) throw new HttpsError('invalid-argument', 'BAD-INPUT:opId');
  const { sid, who } = await 학생과줄(req);
  const { period } = checkKeys(sid, d.key, d.hwKey, who.year);
  await 배정확인('hwStartFresh', sid, who, period, String(d.key), String(d.hwKey));
  const inp = { opId: String(d.opId), now:new Date().toISOString(), at: Date.now(), hwKey: String(d.hwKey) };
  const out = {};
  const ref = admin.database().ref(ROOT + '/submissions/' + d.key);
  const res = await ref.transaction(cur => freshStep(cur, inp, out), undefined, false);
  if (res.committed && out.kind === 'new') await admin.database().ref(ROOT + '/lastModified').set(Date.now()).catch(() => {});
  return { ok: true, kind: out.kind || 'dup', sub: res.snapshot.val() || { answers: {}, submitted: false, submitTime: null } };
});

exports._internals = { detectWeakAreas, mergeAnswers, buildReport, submitStep, freshStep, checkKeys, checkAnswers, 본작업, OPS_KEEP, 배정후보, 배정고르기, 배정판정 };
