// ============================================================
// 6단계 공개 셈 (2026-10-02) — DB·시계를 만지지 않는다. 받은 값으로 셈만 한다.
//   시험: functions/화면시험/prep_공개.test.js · 에뮬레이터 functions/에뮬레이터시험/공개.emu.js
//
// 지시서 §3 「상태와 공개」
//   · 수동 공개와 20:00 자동 공개는 같은 공개 함수 — 조건 셈도 여기 하나
//   · 자동 공개 조건(전부): ① releaseAt 지남 · 휴강/취소/보류 아님 ② 승인된 커리 · 확정 제작 방향 · 교재 승인 · 온라인 수량 확인
//     ③ 초안이 현재 판과 같고 학교 자료 검토 보류 없음 ④ 요청한 MR·TS 세트 전부 완성 · 수량·정답·본문·그림·명세 검수
//     ⑤ 다른 학생 자료·교사용 정답 없음 · 대상 학생·수업·배정 ID 일치 ⑥ 자동 공개 스위치 켜짐 · 아직 공개 안 됨
//   · 날짜·공개 시각은 Australia/Sydney 로 셈하고 저장은 UTC(ms·ISO)
// ============================================================
'use strict';
const crypto = require('crypto');

const TZ = 'Australia/Sydney';
const RELEASE_HOUR = 20;   // 수업일 시드니 20:00

// ─────────────────── 시드니 시각 ───────────────────
const _fmt = new Intl.DateTimeFormat('en-AU', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
/** UTC ms → 시드니 벽시계 {y,m,d,h,mi,s} */
function sydneyParts(ms) {
  const o = {};
  for (const p of _fmt.formatToParts(new Date(ms))) if (p.type !== 'literal') o[p.type] = Number(p.value);
  return { y: o.year, m: o.month, d: o.day, h: o.hour === 24 ? 0 : o.hour, mi: o.minute, s: o.second };
}
/** 시드니 벽시계 → UTC ms. 서머타임 앞뒤도 맞게(두 번 고쳐 본다). 없는 시각(02:00~02:59 봄)은 앞으로 민다. */
function sydneyToUtc(y, m, d, h, mi) {
  const want = Date.UTC(y, m - 1, d, h, mi || 0);
  let t = want - 10 * 3600000;
  for (let i = 0; i < 3; i++) {
    const p = sydneyParts(t);
    const got = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi);
    if (got === want) return t;
    t += want - got;
  }
  // 없는 시각(봄 02:00~02:59) — 고치기가 오가다 앞 시각에 머문다. 한 시간 앞으로 민다
  const p = sydneyParts(t);
  if (Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi) < want) t += 3600000;
  return t;
}
/** 'YYYY-MM-DD' → 그날 시드니 20:00 의 UTC ms */
function releaseAtFor(lessonDate, hour) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(lessonDate || ''));
  if (!m) return null;
  return sydneyToUtc(+m[1], +m[2], +m[3], hour == null ? RELEASE_HOUR : hour, 0);
}
/** UTC ms → 시드니 'YYYY-MM-DD HH:MM' (화면·기록용) */
function sydneyText(ms) {
  const p = sydneyParts(ms), z = (n) => String(n).padStart(2, '0');
  return p.y + '-' + z(p.m) + '-' + z(p.d) + ' ' + z(p.h) + ':' + z(p.mi);
}

// ─────────────────── 날짜 → 숙제 주차 ───────────────────
// prep_core.periodOfDate · 학생 화면 getTodayPeriod 와 같은 규칙(그 주 목요일이 든 달 · ISO). 시험이 「같은가」를 잰다.
// 배정 주차 = 수업일이 든 주 — TS 교사 화면 아이주차(수업 당일은 「다음 수업 = 오늘」)와 같다.
function periodOfYmd(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) return null;
  const day = new Date(+m[1], +m[2] - 1, +m[3], 12);
  const dow = day.getDay();
  const monday = new Date(day.getFullYear(), day.getMonth(), day.getDate() + (dow === 0 ? -6 : 1 - dow));
  const thursday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 3);
  const year = thursday.getFullYear(), month = thursday.getMonth() + 1;
  let week = 0;
  for (let d = 1 - 7; d <= 31; d++) {
    const dt = new Date(year, month - 1, d);
    if (dt.getDay() !== 1) continue;
    const thu = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + 3);
    if (thu.getFullYear() !== year || thu.getMonth() + 1 !== month) continue;
    week++;
    if (dt.getFullYear() === monday.getFullYear() && dt.getMonth() === monday.getMonth() && dt.getDate() === monday.getDate()) return { year, month, week };
  }
  return { year, month, week: 1 };
}

// ─────────────────── 해시 ───────────────────
const 빈 = (x) => x === null || x === undefined || (Array.isArray(x) && x.length === 0) || (x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).every(k => 빈(x[k])));
function canon(v) {
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().filter(k => !빈(v[k])).map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

// ─────────────────── 온라인 초안 → 공개 묶음 ───────────────────
const Q_FIELDS = ['id', 'text', 'type', 'options', 'answer', 'explanation', 'hint1', 'hint2', 'srcId', 'figure', 'taxonomy_id'];
const asArr = (x) => Array.isArray(x) ? x.filter(v => v != null) : Object.values(x || {}).filter(v => v != null);

/** 초안의 세트 차례 그대로 s1, s2 … (화면 표시 차례와 setId 를 나눈다) */
function setsOf(draft) {
  return asArr(draft && draft.sets).slice().sort((a, b) => (a.setIdx || 0) - (b.setIdx || 0));
}

/** 공개 묶음 검증값 — 문항 id·판·보기 차례·정답표·대상 판(지시서 ID 표 manifestHash) */
function manifestHashOf(draft, planRev) {
  const sets = setsOf(draft).map(s => ({ t: s.title || '', q: asArr(s.questions).map(q => ({ id: q.id, src: q.srcId || null, o: q.options || null, a: q.answer, x: q.text })) }));
  return sha(canon({ draftId: draft && draft._id, planId: draft && draft.planId, planRev, sets })).slice(0, 24);
}

/** 학생에게 갈 묶음(정답은 서버에만 — 학생은 prepGetAssignment 가 정답을 빼고 준다) */
function buildRelease(draft, ctx) {
  const sets = {};
  setsOf(draft).forEach((s, i) => {
    sets['s' + (i + 1)] = {
      title: String(s.title || ('Set ' + (i + 1))), order: i,
      questions: asArr(s.questions).map(q => { const o = {}; for (const k of Q_FIELDS) if (q[k] != null && q[k] !== '') o[k] = q[k]; return o; })
    };
  });
  return {
    studentId: ctx.studentId, planId: ctx.planId, planRev: ctx.planRev, lessonDate: ctx.lessonDate,
    period: periodOfYmd(ctx.lessonDate), title: ctx.title || (ctx.lessonDate + ' 숙제'),
    draftId: draft._id, sourceDraftId: draft.sourceDraftId || null, sets, published: true,
    releasedAt: ctx.nowIso, cause: ctx.cause, by: ctx.by || null, manifestHash: manifestHashOf(draft, ctx.planRev), releaseRev: 1
  };
}

// ─────────────────── 온라인 초안 검수 ───────────────────
/**
 * 요청한 수량대로 다 됐는가 · 문항마다 본문·정답·보기·그림·검증.
 * cfg = 온라인 수량 확인값 { mrSets, tsSets, perSet }
 */
function checkOnlineDraft(draft, cfg) {
  const p = [];
  if (!draft) return ['홈페이지 숙제 초안이 없습니다'];
  if (draft.sample) p.push('표본 초안은 공개하지 않습니다');
  const sets = setsOf(draft);
  const want = (Number(cfg && cfg.mrSets) || 0) + (Number(cfg && cfg.tsSets) || 0);
  if (sets.length !== want) p.push('세트 수 ' + sets.length + ' ≠ 요청 ' + want);
  const man = asArr(draft.manifest);
  const 검증 = {}; for (const m of man) if (m && m.itemId) 검증[m.itemId] = m;
  const ids = new Set();
  sets.forEach((s, si) => {
    const qs = asArr(s.questions);
    if (cfg && Number(cfg.perSet) && qs.length !== Number(cfg.perSet)) p.push('세트 ' + (si + 1) + ' 문항 ' + qs.length + ' ≠ 요청 ' + cfg.perSet);
    qs.forEach((q, qi) => {
      const 이름 = '세트 ' + (si + 1) + ' Q' + (qi + 1);
      if (!q.id || ids.has(si + '|' + q.id)) p.push(이름 + ': 문항 id 없음/겹침');
      ids.add(si + '|' + q.id);
      if (!String(q.text || '').trim()) p.push(이름 + ': 본문 없음');
      if (q.answer == null || !String(q.answer).trim()) p.push(이름 + ': 정답 없음');
      if (q.type === 'mc') {
        const o = Array.isArray(q.options) ? q.options : [];
        if (o.length < 2 || o.length > 6 || o.some(x => !String(x == null ? '' : x).trim())) p.push(이름 + ': 보기가 비었거나 수가 이상함');
        const k = 'ABCDEF'.indexOf(String(q.answer || ''));
        if (k < 0 || k >= o.length) p.push(이름 + ': 정답 글자가 보기 밖');
      } else if (q.type !== 'sa' && q.type !== 'written') p.push(이름 + ': 문항 꼴을 모름(' + q.type + ')');
      if (q.figure !== undefined && q.figure !== null && typeof q.figure !== 'string') p.push(이름 + ': 그림 꼴이 틀림');
      if (typeof q.figure === 'string' && q.figure && !/^\s*<svg[\s>]/i.test(q.figure)) p.push(이름 + ': 그림이 SVG 가 아님');
      if (typeof q.figure === 'string' && /<script|\son\w+\s*=/i.test(q.figure)) p.push(이름 + ': 그림에 실행 코드');
      const m = q.srcId ? 검증[q.srcId] : null;
      if (!m) p.push(이름 + ': 명세(manifest)에 없는 문항');
      else if (m.src === 'mr' && m.verify !== 'verified-agree' && m.verify !== 'teacher-edited') p.push(이름 + ': MR 검증 안 됨(' + (m.verify || '없음') + ')');
      for (const k of Object.keys(q)) if (Q_FIELDS.indexOf(k) < 0) p.push(이름 + ': 모르는 칸 ' + k);
    });
  });
  return p;
}

// ─────────────────── 공개 조건 ───────────────────
/**
 * s = 서버가 모아 온 상태
 *   { now, cause:'manual'|'scheduled', planId, plan:{latest, revisions, approvals, released, schedule},
 *     profile, inboxNew:[], autoRelease:bool, onlineDraft:{…,_id}, paperDraft:{…,_id}, release:(이미 있는 공개) }
 * → { ok, reasons:[{key, msg}], aid, draft }
 */
function releaseDecision(s) {
  const R = [];
  const 막 = (key, msg) => R.push({ key, msg });
  const auto = s.cause === 'scheduled';
  const plan = s.plan || {};
  const rev = Number(plan.latest) || 0;
  const v = rev && plan.revisions ? plan.revisions[rev] : null;
  const sch = plan.schedule || null;
  const ap = (plan.approvals && plan.approvals[rev]) || {};
  const aid = s.planId + '_hw';

  // ⑥ 아직 공개 안 됨 — 맨 먼저(이미 공개면 다른 까닭은 볼 필요가 없다)
  if (s.release && s.release.published === true) { 막('already', '이미 공개되었습니다'); return { ok: false, reasons: R, aid }; }
  if (!v) { 막('no-plan', '확정된 제작 방향이 없습니다'); return { ok: false, reasons: R, aid }; }

  // ① 시각 · 휴강 · 보류
  if (!sch) 막('no-schedule', '공개 예약이 없습니다');
  else {
    if (sch.state === 'cancelled') 막('cancelled', '휴강으로 막혀 있습니다');
    if (sch.state === 'held') 막('held', '원장 보류 중입니다');
    if (auto && !(Number(sch.releaseAt) <= s.now)) 막('not-yet', '공개 시각 전입니다(' + (sch.releaseAt ? sydneyText(sch.releaseAt) : '?') + ')');
  }
  // ② 승인 넷
  if (!(s.profile && s.profile.currentCurriculum)) { if (auto) 막('no-curriculum', '승인된 커리가 없습니다'); }
  if (!ap.paper || !ap.paper.draftId) 막('no-paper-approval', '교재 승인이 없습니다');
  if (!ap.online || !ap.online.config) 막('no-online-config', '홈페이지 숙제 수량 확인이 없습니다');
  // ③ 판·자료 검토
  const pd = s.paperDraft, od = s.onlineDraft;
  if (ap.paper && pd && (Number(pd.planRev) !== rev || pd.invalidatedByRev)) 막('paper-stale', '승인한 교재가 지금 판과 다릅니다');
  if (s.profile && s.profile.holdForCurriculum === true) 막('curriculum-review', '학교 자료 검토(커리 먼저 검토)가 남아 있습니다');
  if ((s.inboxNew || []).length) 막('curriculum-review', '새 학교 자료 ' + s.inboxNew.length + '개 — 커리 먼저 검토');
  if (!od) { if (ap.online) 막('no-online-draft', '홈페이지 숙제 초안이 아직 없습니다'); }
  else {
    if (Number(od.planRev) !== rev || od.invalidatedByRev) 막('online-stale', '홈페이지 숙제 초안이 지금 판과 다릅니다');
    if (ap.online && od.jobId !== ap.online.jobId) 막('online-stale', '확인한 수량으로 만든 초안이 아닙니다');
    if (ap.paper && od.sourceDraftId !== ap.paper.draftId) 막('online-stale', '승인한 교재로 만든 초안이 아닙니다');
    // ⑤ 대상 일치
    if (od.studentId !== v.studentId || od.planId !== s.planId) 막('wrong-target', '다른 학생·수업의 초안입니다');
    // ④ 완성·검수
    for (const m of checkOnlineDraft(od, ap.online && ap.online.config)) 막('incomplete', m);
  }
  if (sch && v && sch.studentId && sch.studentId !== v.studentId) 막('wrong-target', '예약의 학생이 판과 다릅니다');
  // ⑥ 스위치(자동만)
  if (auto && s.autoRelease !== true) 막('switch-off', '자동 공개 스위치가 꺼져 있습니다');
  return { ok: R.length === 0, reasons: R, aid };
}

/** 이유 목록이 같은가(매분 같은 이유를 다시 쓰지 않으려고) */
const sameReasons = (a, b) => JSON.stringify((a || []).map(x => x.key + ':' + x.msg)) === JSON.stringify((b || []).map(x => x.key + ':' + x.msg));

// ─────────────────── 온라인 수량 ───────────────────
function checkOnlineConfig(c) {
  const p = [];
  const int = (k, lo, hi) => { const v = c && c[k]; if (!Number.isInteger(v) || v < lo || v > hi) p.push(k + ' 는 ' + lo + '~' + hi + ' 정수'); };
  int('mrSets', 0, 20); int('tsSets', 0, 20); int('perSet', 1, 60);
  if (c && Number.isInteger(c.mrSets) && Number.isInteger(c.tsSets) && c.mrSets + c.tsSets === 0) p.push('세트가 하나도 없습니다');
  if (c && c.dupPolicy != null && ['avoid', 'allow'].indexOf(c.dupPolicy) < 0) p.push('중복 정책은 avoid/allow');
  return p;
}

module.exports = { TZ, RELEASE_HOUR, sydneyParts, sydneyToUtc, releaseAtFor, sydneyText, periodOfYmd, canon, manifestHashOf, buildRelease,
  checkOnlineDraft, releaseDecision, sameReasons, checkOnlineConfig, setsOf, Q_FIELDS };
