// ============================================================
// 6단계 — 미리보기 뒤 승인 · 조정 · 20:00 공개 (2026-10-02)
//
//   ① prepApprovePaper     교재 승인 — 「이번 주만」/「다음 주 기본값에도」 (기본값은 이것과 ②에서만 저장)
//   ② prepConfirmOnline    홈페이지 숙제 수량 확인 → 온라인 초안 주문(prep-online)
//   ③ prepRequestRevision  교재 부분 수정 요청(다시 만들기·문항 고치기·조판만) → 주문(prep-revise) — 일꾼이 새 초안을 낸다
//   ④ prepEditOnline       홈페이지 숙제 초안의 문항 고치기 → 새 초안(옛 것은 그대로)
//   ⑤ prepReleaseStatus    공개 조건 미리 보기(수동·자동 둘 다)
//   ⑥ prepRelease          원장 공개(조기 공개 포함) — ⑦과 **같은 공개 셈**(releaseCore)
//   ⑦ prepReleaseTick      매분 — 시각이 된 예약을 공개(조건 미달이면 까닭만 남김) · PC 가 꺼져 있어도 서버가 한다
//   ⑧ prepLessonControl    공개 보류/해제 · 휴강/되살리기 · 수업일 변경(공개 시각 다시 셈 · 옛 예약 취소)
//   ⑨ prepCorrectRelease   공개된 내용 정정 — 옛 판을 기록에 남기고 고친다(지난 제출은 당시 정답표 그대로)
//
// ⛔ 지키는 선
//   · 모두 원장만(OPERATOR-ONLY) — Admin 은 규칙을 우회하므로 함수마다 권한·상태·꼴을 직접 본다
//   · 공개는 한 번만 — plans/<planId> 트랜잭션(문지기)이 판·보류·휴강을 한 자리에서 보고, releases/<aid> 는 「없을 때만」 만든다
//   · 자동 공개는 기본값(preferences)을 건드리지 않는다
//   · 판·초안은 덮지 않는다 — 고치면 새 초안·새 판
//
// 쓰는 곳(모두 sol_prep_v1 아래 · 규칙은 클라이언트 쓰기를 막는다)
//   plans/<planId>/approvals/<rev>/{paper,online} · plans/<planId>/schedule · plans/<planId>/released
//   releaseQueue/<planId> = releaseAt(ms) · releases/<aid> · releaseHistory/<aid>/<releaseRev> · releaseLog/<push>
//   students/<sid>/preferences/{paper,online} · drafts/<id>/{approval,status,published,publishedAt} · drafts/<새 id>(④) · jobs/<push>
// ============================================================
'use strict';
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const S = require('./auth')._shared;
const RC = require('./release_core');

const ROOT = 'sol_prep_v1';
const KEY_RE = /^[A-Za-z0-9_\-가-힣]{1,120}$/;
const iso = (ms) => new Date(ms == null ? Date.now() : ms).toISOString();

function 원장만(req) { if (!req.auth || req.auth.uid !== S.OPERATOR_UID) throw new HttpsError('permission-denied', 'OPERATOR-ONLY'); return req.auth.uid; }
function 열쇠(v, 이름) { const s = String(v == null ? '' : v); if (!KEY_RE.test(s)) throw new HttpsError('invalid-argument', 'BAD-INPUT:' + 이름); return s; }
const 날짜꼴 = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !isNaN(Date.parse(s + 'T00:00:00Z'));
const db = () => admin.database();
const ref = (p) => db().ref(p ? ROOT + '/' + p : ROOT);
const val = async (p) => (await ref(p).once('value')).val();
const asArr = (x) => Array.isArray(x) ? x.filter(v => v != null) : Object.values(x || {}).filter(v => v != null);

// ─────────────────── 예약 ───────────────────
/** 공개 예약이 없으면 만든다(수업일 시드니 20:00). 있으면 그대로 */
async function 예약확보(planId, studentId, lessonDate, now) {
  const at = RC.releaseAtFor(lessonDate);
  let 만듦 = false;
  const t = await ref('plans/' + planId + '/schedule').transaction(cur => {
    if (cur) return;   // 그대로
    만듦 = true;
    return { studentId, lessonDate, releaseAt: at, releaseAtSydney: RC.sydneyText(at), state: 'scheduled', createdAt: iso(now) };
  });
  if (만듦 && t.committed) await ref('releaseQueue/' + planId).set(at);
  return t.snapshot.val();
}

// ─────────────────── 모으기 ───────────────────
/** 공개 판단에 쓸 상태를 한 번에 모은다 */
async function 모으기(planId) {
  const plan = await val('plans/' + planId);
  if (!plan) return { planId, plan: null };
  const rev = Number(plan.latest) || 0;
  const v = plan.revisions && plan.revisions[rev];
  const sid = v ? v.studentId : (plan.schedule && plan.schedule.studentId);
  const [profile, inbox, autoRelease, drafts, release] = await Promise.all([
    sid ? val('students/' + sid + '/profile') : null, sid ? val('inbox/' + sid) : null, val('config/autoRelease'),
    db().ref(ROOT + '/drafts').orderByChild('planId').equalTo(planId).once('value').then(s => s.val() || {}),
    val('releases/' + planId + '_hw')]);
  const ap = (plan.approvals && plan.approvals[rev]) || {};
  const paperDraft = ap.paper && drafts[ap.paper.draftId] ? Object.assign({ _id: ap.paper.draftId }, drafts[ap.paper.draftId]) : null;
  const onlineDraft = 온라인초안고르기(drafts, ap.online && ap.online.jobId);
  return { planId, plan, profile: profile || {}, inboxNew: Object.values(inbox || {}).filter(x => x && x.status === 'new'),
    autoRelease: autoRelease === true, paperDraft, onlineDraft, release, drafts };
}
/** 확인한 수량 주문(jobId)으로 만든 홈페이지 초안 가운데 가장 나중 고친 판 */
function 온라인초안고르기(drafts, jobId) {
  if (!jobId) return null;
  let 고름 = null;
  for (const [id, d] of Object.entries(drafts || {})) {
    if (!d || d.kind !== 'online' || d.jobId !== jobId) continue;
    if (!고름 || (Number(d.editRev) || 0) > (Number(고름.editRev) || 0)) 고름 = Object.assign({ _id: id }, d);
  }
  return 고름;
}

// ─────────────────── 공개 셈(수동·예약 하나) ───────────────────
/**
 * @returns { ok, released?, already?, reasons?, aid }
 * 문지기 = plans/<planId> 트랜잭션: 그 순간의 최신 판·보류·휴강·시각을 다시 보고 released 를 적는다.
 *   → 원장 확정(판 올림)·보류와 겨루면 한쪽만 이긴다. 같은 판·같은 초안의 재시도는 통과(이어 쓰기).
 * 묶음 = releases/<aid> 「없을 때만」 만든다 → 수동·예약이 동시에 와도 결과는 하나.
 */
async function releaseCore(planId, cause, now, by) {
  const s = await 모으기(planId);
  if (!s.plan) return { ok: false, reasons: [{ key: 'no-plan', msg: '계획이 없습니다' }], aid: planId + '_hw' };
  const d = RC.releaseDecision(Object.assign({ now, cause }, s));
  const aid = d.aid;
  if (s.release && s.release.published === true) {
    await 정리(planId).catch(() => {});
    return { ok: false, already: true, aid, reasons: d.reasons };
  }
  if (!d.ok) return { ok: false, reasons: d.reasons, aid };
  const rev = Number(s.plan.latest);
  const od = s.onlineDraft;
  const v = s.plan.revisions[rev];
  const sch = s.plan.schedule;
  const 묶음 = RC.buildRelease(od, { studentId: v.studentId, planId, planRev: rev, lessonDate: sch.lessonDate || v.lessonDate,
    title: (sch.lessonDate || v.lessonDate) + ' 숙제', nowIso: iso(now), cause, by });

  // 문지기
  let 막힘 = null;
  const g = await ref('plans/' + planId).transaction(cur => {
    if (!cur) return cur;
    막힘 = null;
    if (Number(cur.latest) !== rev) { 막힘 = '판이 바뀌었습니다'; return; }
    const c = cur.schedule || {};
    if (c.state === 'held') { 막힘 = '원장 보류 중입니다'; return; }
    if (c.state === 'cancelled') { 막힘 = '휴강으로 막혀 있습니다'; return; }
    if (cause === 'scheduled' && !(Number(c.releaseAt) <= now)) { 막힘 = '공개 시각 전입니다'; return; }
    if (cur.released) {
      if (Number(cur.released.rev) === rev && cur.released.draftId === od._id) return cur;   // 같은 공개의 이어 쓰기
      막힘 = '이미 다른 판이 공개되었습니다'; return;
    }
    cur.released = { rev, draftId: od._id, aid, cause, at: iso(now), manifestHash: 묶음.manifestHash };
    cur.schedule = Object.assign({}, c, { state: 'published', publishedAt: iso(now), lastCheck: null });
    return cur;
  });
  if (!g.committed || 막힘) {
    // 겨루다 진 쪽 — 이긴 쪽이 이미 공개했으면 「이미」로 끝낸다(까닭을 남기지 않는다)
    const 지금공개 = await val('releases/' + aid);
    if (지금공개 && 지금공개.published === true) return { ok: false, already: true, aid };
    return { ok: false, reasons: [{ key: 'race', msg: 막힘 || '다른 처리와 겹쳤습니다' }], aid };
  }
  const 이긴 = g.snapshot.val().released;
  if (이긴.draftId !== od._id) return { ok: false, reasons: [{ key: 'race', msg: '다른 초안이 공개되었습니다' }], aid };

  // 묶음 — 없을 때만
  let 이미 = false;
  const w = await ref('releases/' + aid).transaction(cur => {
    if (cur && cur.published === true) { 이미 = true; return; }
    return Object.assign({}, 묶음, { cause: 이긴.cause, releasedAt: 이긴.at });
  });
  if (!w.committed && 이미) { await 정리(planId).catch(() => {}); return { ok: false, already: true, aid }; }
  if (!w.committed) throw new Error('공개 묶음을 못 씀');
  await Promise.all([
    정리(planId),
    ref('drafts/' + od._id).update({ status: 'published', published: true, publishedAt: 이긴.at }),
    ref('releaseLog').push({ aid, planId, studentId: v.studentId, cause: 이긴.cause, at: 이긴.at, by: by || null, manifestHash: 이긴.manifestHash, draftId: od._id, planRev: rev })
  ]);
  return { ok: true, released: true, aid, cause: 이긴.cause, at: 이긴.at, manifestHash: 이긴.manifestHash };
}
async function 정리(planId) { await ref('releaseQueue/' + planId).remove(); }

/** 매분 한 바퀴 — 시각이 된 예약만 본다(releaseQueue 는 작다) */
async function tickOnce(now) {
  const due = (await db().ref(ROOT + '/releaseQueue').orderByValue().endAt(now).once('value')).val() || {};
  const out = [];
  for (const planId of Object.keys(due)) {
    try {
      const r = await releaseCore(planId, 'scheduled', now, null);
      if (!r.ok && !r.already) {
        // 조건 미달 — 까닭이 바뀐 때만 적는다(매분 같은 글을 쓰지 않는다)
        //   ⛔ set 이 아니라 트랜잭션으로 — 같은 자리(plans/<planId>)의 다른 트랜잭션(공개 문지기)을 끊지 않게
        if (!r.reasons.some(x => x.key === 'race')) {
          await ref('plans/' + planId + '/schedule').transaction(cur => {
            if (!cur) return cur;
            if (cur.state === 'published') return;
            if (cur.lastCheck && RC.sameReasons(cur.lastCheck.reasons, r.reasons)) return;
            return Object.assign({}, cur, { lastCheck: { at: iso(now), reasons: r.reasons } });
          });
        }
        const st = await val('plans/' + planId + '/schedule/state');
        if (st === 'held' || st === 'cancelled' || st === 'published') await 정리(planId);   // 줄에 남을 까닭이 없다
      }
      out.push(Object.assign({ planId }, r));
    } catch (e) {
      console.error('[prepReleaseTick]', planId, e && e.stack || e);
      out.push({ planId, error: String(e && e.message || e) });
    }
  }
  return out;
}

// ─────────────────── ① 교재 승인 ───────────────────
exports.prepApprovePaper = onCall({ region: S.REGION }, async (req) => {
  const uid = 원장만(req);
  const d = req.data || {};
  const draftId = 열쇠(d.draftId, 'draftId');
  const scope = d.scope === 'default' ? 'default' : (d.scope === 'thisWeek' ? 'thisWeek' : null);
  if (!scope) throw new HttpsError('invalid-argument', 'BAD-INPUT:scope');
  const dr = await val('drafts/' + draftId);
  if (!dr || dr.kind !== 'paper') throw new HttpsError('not-found', 'NO-DRAFT');
  if (dr.sample) throw new HttpsError('failed-precondition', 'SAMPLE', { why: '표본은 승인할 수 없습니다(짧게 만든 것)' });
  const plan = await val('plans/' + dr.planId);
  const rev = Number(plan && plan.latest);
  if (Number(dr.planRev) !== rev || dr.invalidatedByRev) throw new HttpsError('failed-precondition', 'STALE', { why: '지금 판의 교재가 아닙니다' });
  if (plan.released) throw new HttpsError('failed-precondition', 'PUBLISHED', { why: '이미 공개된 수업입니다 — 정정을 쓰세요' });
  if (!dr.qa || dr.qa.ok !== true) throw new HttpsError('failed-precondition', 'QA', { why: 'PDF 검사를 통과하지 못한 초안입니다' });
  // 이 초안을 고친 더 새 초안이 있으면 그것을 승인해야 한다
  const 같은판 = (await db().ref(ROOT + '/drafts').orderByChild('planId').equalTo(dr.planId).once('value')).val() || {};
  if (Object.values(같은판).some(x => x && x.parentDraftId === draftId)) throw new HttpsError('failed-precondition', 'SUPERSEDED', { why: '이 교재를 고친 새 초안이 있습니다' });
  const now = Date.now(), at = iso(now);
  const v = plan.revisions[rev];
  const 고칠 = {
    ['drafts/' + draftId + '/approval']: { approved: true, at, by: uid, scope },
    ['drafts/' + draftId + '/status']: 'paperApproved',
    ['plans/' + dr.planId + '/approvals/' + rev + '/paper']: { draftId, at, by: uid, scope },
  };
  // 「다음 주 기본값에도」일 때만 기본값을 바꾼다(이번 주만 칸은 판에 적힌 대로 빠진다 — prefill 이 thisWeekOnly 를 건너뜀)
  if (scope === 'default') 고칠['students/' + dr.studentId + '/preferences/paper'] = { settings: v.settings, thisWeekOnly: v.thisWeekOnly || [], planId: dr.planId, rev, draftId, at, source: 'paper-approval' };
  await ref(null).update(고칠);
  await 예약확보(dr.planId, dr.studentId, v.lessonDate, now);
  return { ok: true, draftId, scope, savedDefault: scope === 'default' };
});

// ─────────────────── ② 온라인 수량 확인 ───────────────────
exports.prepConfirmOnline = onCall({ region: S.REGION }, async (req) => {
  const uid = 원장만(req);
  const d = req.data || {};
  const draftId = 열쇠(d.paperDraftId, 'paperDraftId');
  const c = d.online || {};
  const config = { mrSets: Number(c.mrSets), tsSets: Number(c.tsSets), perSet: Number(c.perSet), daily: !!c.daily, dupPolicy: c.dupPolicy || 'avoid' };
  const 문제 = RC.checkOnlineConfig(config);
  if (문제.length) throw new HttpsError('invalid-argument', 'BAD-ONLINE', { problems: 문제 });
  const scope = d.scope === 'default' ? 'default' : 'thisWeek';
  const dr = await val('drafts/' + draftId);
  if (!dr || dr.kind !== 'paper' || !dr.approval || dr.approval.approved !== true) throw new HttpsError('failed-precondition', 'NOT-APPROVED', { why: '교재 승인이 먼저입니다' });
  const plan = await val('plans/' + dr.planId);
  const rev = Number(plan && plan.latest);
  const ap = plan.approvals && plan.approvals[rev];
  if (Number(dr.planRev) !== rev || !ap || !ap.paper || ap.paper.draftId !== draftId) throw new HttpsError('failed-precondition', 'STALE', { why: '지금 판에서 승인한 교재가 아닙니다' });
  if (plan.released) throw new HttpsError('failed-precondition', 'PUBLISHED', { why: '이미 공개된 수업입니다' });
  const v = plan.revisions[rev];
  const now = Date.now(), at = iso(now);
  const jobRef = ref('jobs').push();
  // 옛 온라인 주문(같은 판)은 대기면 취소 · 돌고 있으면 취소 요청
  const 옛 = (await db().ref(ROOT + '/jobs').orderByChild('planId').equalTo(dr.planId).once('value')).val() || {};
  const 고칠 = {};
  for (const [k, j] of Object.entries(옛)) {
    if (!j || j.type !== 'prep-online') continue;
    if (j.status === 'queued') 고칠['jobs/' + k + '/status'] = 'cancelled';
    else if (j.status === 'running') 고칠['jobs/' + k + '/status'] = 'cancel-requested';
  }
  고칠['jobs/' + jobRef.key] = { type: 'prep-online', planId: dr.planId, rev, studentId: dr.studentId, lessonDate: v.lessonDate, sourceDraftId: draftId,
    onlineConfig: config, specHash: dr.specHash || null, maxAttempts: 3, status: 'queued', createdAt: at };
  고칠['plans/' + dr.planId + '/approvals/' + rev + '/online'] = { config, scope, at, by: uid, jobId: jobRef.key };
  if (scope === 'default') 고칠['students/' + dr.studentId + '/preferences/online'] = { config, planId: dr.planId, rev, at, source: 'online-approval' };
  await ref(null).update(고칠);
  await 예약확보(dr.planId, dr.studentId, v.lessonDate, now);
  return { ok: true, jobId: jobRef.key, config, scope };
});

// ─────────────────── ③ 교재 부분 수정 요청 ───────────────────
const LAYOUT_KEYS = { fontSize: [9, 14], margin: [10, 25], answerCols: [1, 2] };
exports.prepRequestRevision = onCall({ region: S.REGION }, async (req) => {
  원장만(req);
  const d = req.data || {};
  const draftId = 열쇠(d.draftId, 'draftId');
  const dr = await val('drafts/' + draftId);
  if (!dr || dr.kind !== 'paper') throw new HttpsError('not-found', 'NO-DRAFT');
  if (dr.approval && dr.approval.approved) throw new HttpsError('failed-precondition', 'APPROVED', { why: '승인한 교재는 고치지 않습니다 — 제작 방향을 다시 확정하세요' });
  const plan = await val('plans/' + dr.planId);
  if (Number(dr.planRev) !== Number(plan && plan.latest) || dr.invalidatedByRev) throw new HttpsError('failed-precondition', 'STALE', { why: '지금 판의 교재가 아닙니다' });
  const 칸 = {}; for (const m of asArr(dr.manifest)) 칸[m.slot] = m;
  const edits = [];
  for (const e of (Array.isArray(d.edits) ? d.edits : []).slice(0, 60)) {
    const slot = 열쇠(e && e.slot, 'slot');
    const m = 칸[slot];
    if (!m) throw new HttpsError('invalid-argument', 'BAD-INPUT:slot', { why: slot + ' 는 이 교재에 없습니다' });
    if (e.action === 'regenerate') edits.push({ slot, action: 'regenerate' });
    else if (e.action === 'edit') {
      if (m.src !== 'mr') throw new HttpsError('invalid-argument', 'TS-EDIT', { why: 'TS 는 창고 문항이라 고치지 않고 「다시 고르기」만 됩니다' });
      const o = { slot, action: 'edit' };
      for (const k of ['stem', 'answer', 'working']) if (e[k] != null) { const s = String(e[k]); if (s.length > 3000) throw new HttpsError('invalid-argument', 'TOO-LONG'); o[k] = s; }
      if (e.choices != null) { if (!Array.isArray(e.choices) || e.choices.length !== 4) throw new HttpsError('invalid-argument', 'BAD-CHOICES'); o.choices = e.choices.map(x => String(x).slice(0, 500)); }
      if (Object.keys(o).length <= 2) throw new HttpsError('invalid-argument', 'EMPTY-EDIT');
      edits.push(o);
    } else throw new HttpsError('invalid-argument', 'BAD-INPUT:action');
  }
  let layout = null;
  if (d.layout && typeof d.layout === 'object') {
    layout = {};
    for (const [k, [lo, hi]] of Object.entries(LAYOUT_KEYS)) if (d.layout[k] != null) { const n = Number(d.layout[k]); if (!Number.isInteger(n) || n < lo || n > hi) throw new HttpsError('invalid-argument', 'BAD-LAYOUT:' + k); layout[k] = n; }
    if (d.layout.workSpace != null) { if (['compact', 'normal', 'wide'].indexOf(d.layout.workSpace) < 0) throw new HttpsError('invalid-argument', 'BAD-LAYOUT:workSpace'); layout.workSpace = d.layout.workSpace; }
    if (d.layout.bilingual != null) layout.bilingual = !!d.layout.bilingual;
    if (!Object.keys(layout).length) layout = null;
  }
  if (!edits.length && !layout) throw new HttpsError('invalid-argument', 'NOTHING');
  const 같은판 = (await db().ref(ROOT + '/drafts').orderByChild('planId').equalTo(dr.planId).once('value')).val() || {};
  if (Object.values(같은판).some(x => x && x.parentDraftId === draftId)) throw new HttpsError('failed-precondition', 'SUPERSEDED', { why: '이 교재를 고친 새 초안이 이미 있습니다 — 그것을 고치세요' });
  const at = iso();
  const jobRef = ref('jobs').push();
  await jobRef.set({ type: 'prep-revise', planId: dr.planId, rev: dr.planRev, studentId: dr.studentId, lessonDate: dr.lessonDate, sourceDraftId: draftId,
    revision: (Number(dr.revision) || 0) + 1, edits, layout, specHash: dr.specHash || null, maxAttempts: 3, status: 'queued', createdAt: at,
    affects: affectsOf(edits, layout, 칸) });
  return { ok: true, jobId: jobRef.key, affects: affectsOf(edits, layout, 칸) };
});
/** 영향 영역 — 화면(prep_core.affectedAreas)과 같은 셈을 서버에도 둔다(주문에 적어 둔다) */
function affectsOf(edits, layout, 칸) {
  const files = new Set(), notes = [];
  const 구역파일 = { test: 'test', book: 'book', hw: 'hw' };
  for (const e of edits) {
    const m = 칸[e.slot] || {};
    files.add(구역파일[m.section] || 'book'); files.add('student'); files.add('teacher'); files.add('items'); files.add('qa');
  }
  if (layout) { ['test', 'book', 'hw', 'student', 'teacher'].forEach(f => files.add(f)); notes.push('조판만 — 문항 내용·정답은 그대로'); }
  if (edits.length) notes.push('문항·정답이 바뀌면 답지·원본 JSON·검수 기록을 함께 다시 만든다');
  return { files: Array.from(files).sort(), notes };
}

// ─────────────────── ④ 홈페이지 초안 고치기 ───────────────────
exports.prepEditOnline = onCall({ region: S.REGION }, async (req) => {
  const uid = 원장만(req);
  const d = req.data || {};
  const draftId = 열쇠(d.draftId, 'draftId');
  const dr = await val('drafts/' + draftId);
  if (!dr || dr.kind !== 'online') throw new HttpsError('not-found', 'NO-DRAFT');
  if (dr.published) throw new HttpsError('failed-precondition', 'PUBLISHED', { why: '공개된 숙제는 「정정」을 쓰세요' });
  const plan = await val('plans/' + dr.planId);
  if (Number(dr.planRev) !== Number(plan && plan.latest) || dr.invalidatedByRev) throw new HttpsError('failed-precondition', 'STALE', { why: '지금 판의 초안이 아닙니다' });
  const 같은 = (await db().ref(ROOT + '/drafts').orderByChild('planId').equalTo(dr.planId).once('value')).val() || {};
  const 최신 = 온라인초안고르기(같은, dr.jobId);
  if (!최신 || 최신._id !== draftId) throw new HttpsError('failed-precondition', 'SUPERSEDED', { why: '이 초안을 고친 새 초안이 있습니다' });
  const sets = RC.setsOf(dr).map(s => Object.assign({}, s, { questions: asArr(s.questions).map(q => Object.assign({}, q)) }));
  const man = asArr(dr.manifest).map(m => Object.assign({}, m));
  const 바뀜 = [];
  for (const e of (Array.isArray(d.edits) ? d.edits : []).slice(0, 100)) {
    const s = sets[Number(e && e.set)], q = s && s.questions[Number(e.q)];
    if (!q) throw new HttpsError('invalid-argument', 'BAD-INPUT:q');
    const 전 = { text: q.text, options: q.options || null, answer: q.answer, explanation: q.explanation || '' };
    if (e.text != null) q.text = String(e.text).slice(0, 4000);
    if (e.explanation != null) q.explanation = String(e.explanation).slice(0, 4000);
    if (e.options != null) { if (!Array.isArray(e.options) || e.options.length < 2 || e.options.length > 6) throw new HttpsError('invalid-argument', 'BAD-OPTIONS'); q.options = e.options.map(x => String(x).slice(0, 500)); }
    if (e.answer != null) q.answer = String(e.answer).slice(0, 200);
    if (q.type === 'mc' && 'ABCDEF'.indexOf(String(q.answer)) >= (q.options || []).length) throw new HttpsError('invalid-argument', 'BAD-ANSWER', { why: '정답 글자가 보기 밖입니다' });
    const mi = man.findIndex(m => m.itemId === q.srcId);
    if (mi >= 0) { man[mi].verify = 'teacher-edited'; man[mi].itemRevision = (Number(man[mi].itemRevision) || 1) + 1; }
    바뀜.push({ set: Number(e.set), q: Number(e.q), id: q.id, srcId: q.srcId || null, before: 전, after: { text: q.text, options: q.options || null, answer: q.answer, explanation: q.explanation || '' } });
  }
  if (!바뀜.length) throw new HttpsError('invalid-argument', 'NOTHING');
  const editRev = (Number(dr.editRev) || 0) + 1;
  const newId = draftId.replace(/_e\d+$/, '') + '_e' + editRev;
  const 새 = Object.assign({}, dr, { sets, manifest: man, editRev, parentDraftId: draftId, edits: 바뀜, editedAt: iso(), editedBy: uid, status: 'onlineReview', published: false });
  delete 새._id;
  const t = await ref('drafts/' + newId).transaction(cur => (cur ? undefined : 새));
  if (!t.committed) throw new HttpsError('aborted', 'EXISTS');
  return { ok: true, draftId: newId, editRev, changed: 바뀜.length };
});

// ─────────────────── ⑤ 공개 조건 미리 보기 ───────────────────
exports.prepReleaseStatus = onCall({ region: S.REGION }, async (req) => {
  원장만(req);
  const planId = 열쇠(req.data && req.data.planId, 'planId');
  const s = await 모으기(planId);
  if (!s.plan) return { planId, exists: false };
  const now = Date.now();
  const 수동 = RC.releaseDecision(Object.assign({ now, cause: 'manual' }, s));
  const 자동 = RC.releaseDecision(Object.assign({ now, cause: 'scheduled' }, s));
  const sch = s.plan.schedule || null;
  return { planId, exists: true, now: iso(now), manual: { ok: 수동.ok, reasons: 수동.reasons }, auto: { ok: 자동.ok, reasons: 자동.reasons },
    schedule: sch ? Object.assign({}, sch, { releaseAtSydney: sch.releaseAt ? RC.sydneyText(sch.releaseAt) : null }) : null,
    autoRelease: s.autoRelease, onlineDraftId: s.onlineDraft ? s.onlineDraft._id : null, paperDraftId: s.paperDraft ? s.paperDraft._id : null,
    release: s.release ? { aid: 수동.aid, releasedAt: s.release.releasedAt, cause: s.release.cause, releaseRev: s.release.releaseRev || 1, manifestHash: s.release.manifestHash } : null };
});

// ─────────────────── ⑥ 원장 공개 ───────────────────
exports.prepRelease = onCall({ region: S.REGION }, async (req) => {
  const uid = 원장만(req);
  const planId = 열쇠(req.data && req.data.planId, 'planId');
  const r = await releaseCore(planId, 'manual', Date.now(), uid);
  if (r.ok || r.already) return r;
  throw new HttpsError('failed-precondition', 'NOT-READY', { reasons: r.reasons });
});

// ─────────────────── ⑦ 매분 예약 공개 ───────────────────
exports.prepReleaseTick = onSchedule({ schedule: 'every 1 minutes', region: S.REGION, timeZone: RC.TZ, memory: '256MiB', retryCount: 0 }, async () => {
  const r = await tickOnce(Date.now());
  if (r.length) console.log('[prepReleaseTick]', JSON.stringify(r.map(x => ({ p: x.planId, ok: x.ok, already: x.already || false, why: (x.reasons || []).map(y => y.key) }))));
});

// ─────────────────── ⑧ 보류 · 휴강 · 수업일 변경 ───────────────────
exports.prepLessonControl = onCall({ region: S.REGION }, async (req) => {
  const uid = 원장만(req);
  const d = req.data || {};
  const planId = 열쇠(d.planId, 'planId');
  const action = String(d.action || '');
  if (['hold', 'unhold', 'cancel', 'restore', 'changeDate'].indexOf(action) < 0) throw new HttpsError('invalid-argument', 'BAD-INPUT:action');
  if (action === 'changeDate' && !날짜꼴(d.newDate)) throw new HttpsError('invalid-argument', 'BAD-INPUT:newDate');
  const plan = await val('plans/' + planId);
  if (!plan || !plan.latest) throw new HttpsError('not-found', 'NO-PLAN');
  const v = plan.revisions[plan.latest];
  const now = Date.now(), at = iso(now);
  if (!plan.schedule) await 예약확보(planId, v.studentId, v.lessonDate, now);
  let 까닭 = null, 결과 = null;
  const t = await ref('plans/' + planId + '/schedule').transaction(cur => {
    까닭 = null; 결과 = null;
    if (!cur) return cur;   // 처음 한 번은 빈 값으로 불린다 — 그대로 돌려줘야 서버 값으로 다시 돈다
    if (cur.state === 'published') { 까닭 = 'PUBLISHED'; return; }
    const 기록 = Array.isArray(cur.history) ? cur.history.slice() : Object.values(cur.history || {});
    const n = Object.assign({}, cur);
    if (action === 'hold') { if (cur.state !== 'scheduled') { 까닭 = 'NOT-SCHEDULED'; return; } n.state = 'held'; }
    if (action === 'unhold') { if (cur.state !== 'held') { 까닭 = 'NOT-HELD'; return; } n.state = 'scheduled'; }
    if (action === 'cancel') { if (cur.state === 'cancelled') { 까닭 = 'ALREADY'; return; } n.state = 'cancelled'; }
    if (action === 'restore') { if (cur.state !== 'cancelled') { 까닭 = 'NOT-CANCELLED'; return; } n.state = 'scheduled'; }
    if (action === 'changeDate') {
      const at2 = RC.releaseAtFor(d.newDate);
      기록.push({ action, at, by: uid, from: cur.lessonDate, to: d.newDate, fromReleaseAt: cur.releaseAt, toReleaseAt: at2 });
      n.lessonDate = d.newDate; n.releaseAt = at2; n.releaseAtSydney = RC.sydneyText(at2);
    } else 기록.push({ action, at, by: uid, from: cur.state, to: n.state });
    n.history = 기록.slice(-50);
    n.lastCheck = null;
    결과 = n;
    return n;
  });
  if (!t.committed || 까닭 || !결과) throw new HttpsError('failed-precondition', 까닭 || 'NO-SCHEDULE');
  // 줄(releaseQueue) 맞추기 — 예약 상태일 때만 줄에 둔다. 수업일을 바꾸면 옛 시각은 사라지고 새 시각만 남는다
  if (결과.state === 'scheduled') await ref('releaseQueue/' + planId).set(결과.releaseAt); else await 정리(planId);
  return { ok: true, schedule: Object.assign({}, 결과, { releaseAtSydney: RC.sydneyText(결과.releaseAt) }) };
});

// ─────────────────── ⑨ 공개된 내용 정정 ───────────────────
exports.prepCorrectRelease = onCall({ region: S.REGION }, async (req) => {
  const uid = 원장만(req);
  const d = req.data || {};
  const aid = 열쇠(d.assignmentId, 'assignmentId');
  const setId = 열쇠(d.setId, 'setId');
  const qid = 열쇠(d.qid, 'qid');
  const reason = String(d.reason || '').trim().slice(0, 500);
  if (!reason) throw new HttpsError('invalid-argument', 'NO-REASON', { why: '정정 까닭을 적어 주세요' });
  const ch = d.changes || {};
  const now = iso();
  let 까닭 = null, 옛판 = null, 바뀜 = null;
  const t = await ref('releases/' + aid).transaction(cur => {
    까닭 = null; 바뀜 = null;
    if (!cur) return cur;
    if (cur.published !== true) { 까닭 = 'NOT-PUBLISHED'; return; }
    const set = cur.sets && cur.sets[setId];
    const qs = set ? asArr(set.questions) : [];
    const i = qs.findIndex(q => q.id === qid);
    if (i < 0) { 까닭 = 'NO-QUESTION'; return; }
    const q = Object.assign({}, qs[i]);
    const 전 = { text: q.text, options: q.options || null, answer: q.answer, explanation: q.explanation || '' };
    if (ch.text != null) q.text = String(ch.text).slice(0, 4000);
    if (ch.explanation != null) q.explanation = String(ch.explanation).slice(0, 4000);
    if (ch.options != null) { if (!Array.isArray(ch.options) || ch.options.length < 2 || ch.options.length > 6) { 까닭 = 'BAD-OPTIONS'; return; } q.options = ch.options.map(x => String(x).slice(0, 500)); }
    if (ch.answer != null) q.answer = String(ch.answer).slice(0, 200);
    if (q.type === 'mc' && 'ABCDEF'.indexOf(String(q.answer)) >= (q.options || []).length) { 까닭 = 'BAD-ANSWER'; return; }
    if (JSON.stringify(전) === JSON.stringify({ text: q.text, options: q.options || null, answer: q.answer, explanation: q.explanation || '' })) { 까닭 = 'NOTHING'; return; }
    옛판 = { releaseRev: cur.releaseRev || 1, manifestHash: cur.manifestHash, sets: cur.sets, savedAt: now };
    const n = Object.assign({}, cur);
    const nq = qs.slice(); nq[i] = q;
    n.sets = Object.assign({}, cur.sets, { [setId]: Object.assign({}, set, { questions: nq }) });
    n.releaseRev = (cur.releaseRev || 1) + 1;
    n.manifestHash = RC.manifestHashOf({ _id: cur.draftId, planId: cur.planId, sets: Object.keys(n.sets).sort().map((k, j) => Object.assign({ setIdx: j }, n.sets[k])) }, cur.planRev) + '-r' + n.releaseRev;
    const 정정 = Array.isArray(cur.corrections) ? cur.corrections.slice() : Object.values(cur.corrections || {});
    바뀜 = { at: now, by: uid, setId, qid, reason, before: 전, after: { text: q.text, options: q.options || null, answer: q.answer, explanation: q.explanation || '' }, fromRev: 옛판.releaseRev, toRev: n.releaseRev };
    정정.push(바뀜);
    n.corrections = 정정; n.correctedAt = now;
    return n;
  });
  if (!t.committed || 까닭 || !바뀜) throw new HttpsError('failed-precondition', 까닭 || 'NO-RELEASE');
  // 옛 판은 기록에 남긴다(지난 제출은 제출 때 받은 채점 그대로 — 새 정답표로 다시 채점하지 않는다)
  await ref('releaseHistory/' + aid + '/' + 옛판.releaseRev).transaction(cur => (cur ? undefined : 옛판));
  await ref('releaseLog').push({ aid, kind: 'correction', at: now, by: uid, setId, qid, reason, toRev: 바뀜.toRev });
  return { ok: true, assignmentId: aid, releaseRev: 바뀜.toRev };
});

// ─────────────────── ⑩ [10-02] 프로젝트 결과물 등록 ───────────────────
//   원장님이 프로젝트에서 만든 교재(드라이브)를 PC 일꾼이 imports/<id> 로 올려 둔다(숙제 JSON 은 홈페이지 꼴로 바꿔 둠).
//   원장이 「이 수업으로 등록」하면: 그 학생·수업일 계획에 새 판(출처 = 프로젝트) · 교재 초안(승인됨) · 홈페이지 초안 ·
//   승인 자리(교재 + 수량) · 20:00 예약 → 이후는 같은 공개 셈(지금 공개 / 20:00 자동).
//   교재 문항은 프로젝트 툴체인이 정답을 따로 다시 셈해 맞춘 것 → 검증 표시 'toolchain-verified'.
const 파일종류 = (n) => /MarkingGuide|Answer|정답|교사/i.test(n) ? 'teacher' : /KeyIdeas|EN-KO/i.test(n) ? 'keyideas' : /Workbook|교재/i.test(n) ? 'book'
  : /Homework|숙제|HW/i.test(n) ? 'hw' : /Test|테스트/i.test(n) ? 'test' : 'other';
exports.prepAdoptImport = onCall({ region: S.REGION }, async (req) => {
  const uid = 원장만(req);
  const d = req.data || {};
  const id = 열쇠(d.importId, 'importId');
  const sid = 열쇠(d.studentId, 'studentId');
  if (!날짜꼴(d.lessonDate)) throw new HttpsError('invalid-argument', 'BAD-INPUT:lessonDate');
  const lessonDate = String(d.lessonDate);
  const imp = await val('imports/' + id);
  if (!imp) throw new HttpsError('not-found', 'NO-IMPORT');
  if (imp.status === 'adopted') throw new HttpsError('failed-precondition', 'ALREADY', { why: '이미 등록한 결과물입니다(' + ((imp.adopted || {}).planId || '') + ')' });
  const impSets = imp.ok === true ? await val('importSets/' + id) : null;
  if (imp.ok !== true || !impSets || !asArr(impSets).length) throw new HttpsError('failed-precondition', 'BAD-IMPORT', { why: '숙제 JSON 을 바꾸지 못한 결과물입니다 — ' + (imp.problems || []).slice(0, 3).join(' · ') });
  const now = Date.now(), at = iso(now);
  const planId = sid + '_' + lessonDate.replace(/-/g, '') + '_1';
  // 판 — 공개된 수업이면 막는다(공개 문지기와 같은 자리를 겨룬다)
  let 공개됨 = false;
  const sets = asArr(impSets).map((s, i) => Object.assign({}, s, { setIdx: i, questions: asArr(s.questions).map(q => Object.assign({}, q)) }));
  const man = [];
  sets.forEach((s, si) => s.questions.forEach((q, qi) => {
    if (!q.srcId) q.srcId = 'imp-' + id.slice(0, 8) + '-' + si + '-' + qi;
    man.push({ itemId: q.srcId, itemRevision: 1, src: 'mr', set: si, verify: 'toolchain-verified' });
  }));
  const 크기 = sets.map(s => s.questions.length);
  const config = { mrSets: sets.length, tsSets: 0, perSet: 크기.every(n => n === 크기[0]) ? 크기[0] : 0, daily: false, dupPolicy: 'avoid' };
  const t = await ref('plans/' + planId).transaction(cur => {
    공개됨 = false;
    const c = cur || {};
    if (c.released) { 공개됨 = true; return; }
    const rev = (Number(c.latest) || 0) + 1;
    const revs = Object.assign({}, c.revisions || {});
    revs[rev] = { rev, studentId: sid, lessonDate, confirmedAt: at, by: uid, source: 'import', importId: id, folder: imp.folder,
      spec: { studentId: sid, lessonDate, parts: [Object.assign({ kind: 'online-hw', afterPaperApproval: true }, config)] } };
    return Object.assign({}, c, { latest: rev, revisions: revs });
  });
  if (공개됨 || !t.committed) throw new HttpsError('failed-precondition', 'PUBLISHED', { why: '이미 공개된 수업입니다 — 공개된 숙제는 「정정」으로' });
  const rev = Number(t.snapshot.val().latest);
  const paperId = planId + '_r' + rev + '_paper_imp_' + id.slice(0, 8);
  const onlineId = planId + '_r' + rev + '_online_imp_' + id.slice(0, 8);
  const files = (imp.files || []).filter(f => f && (!(f.students || []).length || (f.students || []).includes(sid)))
    .map(f => ({ kind: 파일종류(f.name), name: f.name, rel: imp.folder, where: 'drive-project' }));
  const 고칠 = {};
  고칠['drafts/' + paperId] = { kind: 'paper', source: 'import', importId: id, planId, planRev: rev, studentId: sid, lessonDate, files,
    qa: { ok: true, via: 'toolchain' }, status: 'paperApproved', approval: { approved: true, scope: 'thisWeek', at, by: uid, via: 'import' }, published: false, createdAt: at };
  고칠['drafts/' + onlineId] = { kind: 'online', source: 'import', importId: id, jobId: 'import:' + id, sourceDraftId: paperId, planId, planRev: rev, studentId: sid, lessonDate,
    sets, manifest: man, status: 'onlineReview', published: false, createdAt: at };
  고칠['plans/' + planId + '/approvals/' + rev] = { paper: { draftId: paperId, at, by: uid, scope: 'thisWeek', via: 'import' },
    online: { config, scope: 'thisWeek', at, by: uid, jobId: 'import:' + id, via: 'import' } };
  고칠['imports/' + id + '/status'] = 'adopted';
  고칠['imports/' + id + '/adopted'] = { studentId: sid, planId, rev, lessonDate, at, by: uid };
  // 옛 판 초안 무효 · 이 계획의 대기 주문 취소(일꾼이 따로 만들지 않게)
  const 옛초안 = (await db().ref(ROOT + '/drafts').orderByChild('planId').equalTo(planId).once('value')).val() || {};
  for (const [k, x] of Object.entries(옛초안)) if (x && Number(x.planRev) < rev && x.published !== true && !x.invalidatedByRev) { 고칠['drafts/' + k + '/invalidatedByRev'] = rev; 고칠['drafts/' + k + '/invalidatedAt'] = at; }
  const 옛주문 = (await db().ref(ROOT + '/jobs').orderByChild('planId').equalTo(planId).once('value')).val() || {};
  for (const [k, j] of Object.entries(옛주문)) { if (!j) continue; if (j.status === 'queued') 고칠['jobs/' + k + '/status'] = 'cancelled'; else if (j.status === 'running') 고칠['jobs/' + k + '/status'] = 'cancel-requested'; }
  await ref(null).update(고칠);
  await 예약확보(planId, sid, lessonDate, now);
  return { ok: true, planId, rev, paperId, onlineId, sets: sets.length, count: man.length, files: files.length };
});
exports.prepDismissImport = onCall({ region: S.REGION }, async (req) => {
  원장만(req);
  const id = 열쇠(req.data && req.data.importId, 'importId');
  const imp = await val('imports/' + id);
  if (!imp) throw new HttpsError('not-found', 'NO-IMPORT');
  if (imp.status === 'adopted') throw new HttpsError('failed-precondition', 'ALREADY');
  await ref('imports/' + id + '/status').set('dismissed');
  return { ok: true };
});

// 시험용
exports._internals = { releaseCore, tickOnce, 모으기, 예약확보, 온라인초안고르기, affectsOf, 파일종류 };
