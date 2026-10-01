// 약점 합치기 — 학생 화면(index.html) _weaknessMerge·taxSafeKey 를 **글자째** 옮긴 것 (3-D · 2026-10-01).
// 서버(prepSubmit)가 개인 배정 제출의 약점을 반영할 때 쓴다. 학생 화면 그룹 숙제와 **같은 칸·같은 규칙**.
// ⛔ 화면 쪽을 고치면 여기도 — functions/화면시험/약점합치기_같은가.test.js 가 같은지 지킨다.
'use strict';
function taxSafeKey(taxId) {
  return String(taxId).replace(/[%.#$\[\]\/]/g,
    ch => '%' + ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'));
}

function _weaknessMerge(cur, cid, rev, v, now) {
  const contrib0 = (cur && cur.contrib) || {};
  const old = contrib0[cid];
  if (old && (old.rev || 0) >= rev) return undefined;      // 이미 이 판(또는 더 새 판)이 들어 있다
  if (!cur && !v.n) return null;                           // 빈 칸에 뺄 것만 — 만들지 않는다
  const base = cur || { attempts: 0, correct: 0, wrong: 0, history: [] };
  let attempts = base.attempts || 0, correct = base.correct || 0, wrong = base.wrong || 0;
  let history = Array.isArray(base.history) ? base.history.slice()
              : (base.history ? Object.values(base.history) : []);
  if (old) {
    attempts -= old.n || 0; correct -= old.c || 0; wrong -= (old.n || 0) - (old.c || 0);
    history = history.filter(h => !h || h.sub !== cid);
  }
  const list = v.list || [];
  for (const ok of list) history.push({ ts: now, correct: !!ok, sub: cid });
  attempts += v.n; correct += v.c; wrong += v.n - v.c;
  const contrib = Object.assign({}, contrib0, { [cid]: { rev, n: v.n, c: v.c } });
  const out = {
    attempts: Math.max(0, attempts), correct: Math.max(0, correct), wrong: Math.max(0, wrong),
    last_seen: v.n ? now : (base.last_seen || null),
    last_correct: v.c ? now : (base.last_correct || null),
    history: history.slice(-50),
    contrib
  };
  const tid = v.t || base.taxonomyId;
  if (tid) out.taxonomyId = tid;
  return out;
}

/**
 * 한 일을 반영한다(관리자 권한 · 트랜잭션). 학생 화면 applyWeaknessUpdates 와 같은 순서:
 *   applied/<cid> 판 확인 → 분류별 칸 합치기 → 옛 판에만 있던 분류는 기여분만 빼기 → applied 기록.
 *   job = { sid, subKey(cid 원문), rev, items:[{t, c}] }
 */
async function applyWeaknessJob(rootRef, job) {
  const cid = taxSafeKey(job.subKey);
  const base = 'solomon_hw_v3/weakness/' + job.sid;
  const appliedRef = rootRef.child(base + '/applied/' + cid);
  const prev = (await appliedRef.once('value')).val();
  if (prev && (prev.rev || 0) >= job.rev) return { skipped: true };
  const now = new Date().toISOString();
  const bySkill = {};
  for (const it of job.items || []) {
    const k = taxSafeKey(it.t);
    if (!bySkill[k]) bySkill[k] = { t: it.t, n: 0, c: 0, list: [] };
    bySkill[k].n++; if (it.c) bySkill[k].c++; bySkill[k].list.push(!!it.c);
  }
  const oldSkills = prev && prev.skills ? Object.values(prev.skills) : [];
  for (const k of oldSkills) if (!bySkill[k]) bySkill[k] = { t: null, n: 0, c: 0, list: [] };
  for (const k of Object.keys(bySkill)) {
    const v = bySkill[k];
    await rootRef.child(base + '/skills/' + k).transaction(cur => _weaknessMerge(cur, cid, job.rev, v, now));
  }
  await appliedRef.set({ rev: job.rev, skills: Object.keys(bySkill).filter(k => bySkill[k].n > 0), at: now });
  return { skipped: false };
}
module.exports = { taxSafeKey, _weaknessMerge, applyWeaknessJob };
