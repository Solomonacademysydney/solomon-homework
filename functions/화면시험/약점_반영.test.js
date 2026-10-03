// 약점 반영 — **저장이 된 뒤에만 · 한 제출에 한 번만 · 고쳐 내면 바꿔 끼운다.**
//
// ⛔ [1단계 · 2026-10-01] 예전 모습
//    · doSubmit 이 제출을 서버에 보내기 **전에** 약점을 더했다 — 제출이 실패해도 약점은 늘었다
//    · 같은 제출을 다시 보내면(재시도·다시 제출) **또 더했다** — 횟수가 부풀었다
//    · 분류 ID 에 점(.)이 있어 `weakness/<아이>/skills/MR.Y5…` 경로가 **아예 못 쓰였다**
//      (파이어베이스 열쇠에 점이 들어갈 수 없다) — 운영 DB 에 weakness 가지가 0 이었다
//
// 이 시험이 지키는 것 (가짜 서버 — 진짜 서버 시험은 에뮬레이터시험/저장신뢰.emu.js)
//   ① 안전 키: 점·$·#·[·]·/·% 가 든 분류 ID 가 열쇠가 되고, 원문으로 되돌아온다
//   ② 합치기: 같은 제출·같은 판(rev)은 두 번 더하지 않는다 · 새 판은 옛 기여분을 **빼고** 더한다
//   ③ 줄(큐): 제출 저장이 서버에서 확인되기 전에는 반영하지 않는다(응답 유실·창 닫힘 → 다음에 다시)
//   ④ doSubmit: 줄에 먼저 넣고 → 제출 저장 → **성공했을 때만** 줄을 비운다
//   ⑤ 읽는 쪽: 원문 taxonomyId 로 나눈다 · 옛 점 열쇠 자료도 함께 읽는다(이중 읽기)

'use strict';
const fs = require('fs');
const html = fs.readFileSync('E:/aa0/hp/index.html', 'utf8');

let 통과 = 0, 실패 = 0;
function 재기(이름, 참, 덧) {
  if (참) { 통과++; console.log('  ✅ ' + 이름); }
  else { 실패++; console.log('  ⛔ ' + 이름 + (덧 ? '\n       ' + 덧 : '')); }
}
function 떼기(시작, 끝표) {
  const i = html.indexOf(시작);
  if (i < 0) throw new Error('못 찾음: ' + 시작);
  const j = html.indexOf(끝표, i + 10);
  if (j < 0) throw new Error('끝 못 찾음: ' + 끝표);
  return html.slice(i, j);
}
const 복 = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

const 약점소스 = 떼기('// ═══ [1단계] 약점 반영 — 시작', '// ═══ [1단계] 약점 반영 — 끝');
const 정답소스 = 떼기('function normAns(a) {', '\n}\n') + '\n}\n';

/** 메모리 서버 — child(path).once / set / transaction. 열쇠에 금지 글자가 들면 진짜처럼 터진다. */
function 가짜서버(처음) {
  const 뿌리 = { v: 복(처음) || {} };
  const 금지 = /[.#$\[\]]/;
  const 길 = (p) => { const ms = p.split('/').filter(Boolean); for (const m of ms) if (금지.test(m)) throw new Error('Invalid path: ' + p); return ms; };
  const 읽기 = (ms) => { let v = 뿌리.v; for (const m of ms) v = (v == null ? undefined : v[m]); return v; };
  const 쓰기 = (ms, val) => {
    if (!ms.length) { 뿌리.v = val; return; }
    let o = 뿌리.v; for (const m of ms.slice(0, -1)) { if (o[m] == null || typeof o[m] !== 'object') o[m] = {}; o = o[m]; }
    if (val === null || val === undefined) delete o[ms[ms.length - 1]]; else o[ms[ms.length - 1]] = val;
  };
  const 서버 = {
    쓴횟수: 0, 읽기막힘: false,
    ref: { child: (p) => {
      const ms = 길(p);
      return {
        once: async () => { if (서버.읽기막힘) throw new Error('network'); const v = 복(읽기(ms)); return { exists: () => v != null, val: () => (v == null ? null : v) }; },
        set: async (val) => { 서버.쓴횟수++; 쓰기(ms, 복(val)); },
        transaction: async (fn) => {
          const 새것 = fn(복(읽기(ms)) ?? null);
          if (새것 === undefined) return { committed: false };
          서버.쓴횟수++; 쓰기(ms, 복(새것)); return { committed: true };
        },
      };
    } },
    값: (p) => 복(읽기(p.split('/').filter(Boolean))),
    넣기: (p, v) => 쓰기(p.split('/').filter(Boolean), 복(v)),
  };
  return 서버;
}

function 서랍() { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; }, _m: m }; }

function 약점세상(서버) {
  const w = { fbReady: true, FB_REF: 서버.ref, isPreviewMode: false };
  const ls = 서랍();
  const F = new Function('window', 'localStorage', 'console', 정답소스 + 약점소스 +
    '\n; return { taxSafeKey, taxFromSafeKey, _weaknessMerge, _weaknessJobOf, _weaknessEnqueue, _weaknessQueueRead, _weaknessFlush, applyWeaknessUpdates, _weaknessSkillsByTaxId };')(
    w, ls, { log() {}, warn() {}, info() {}, error() {} });
  return { F, w, ls };
}

(async () => {
  console.log('── ① 안전 키');
  {
    const { F } = 약점세상(가짜서버());
    const 원문 = 'MR.Y5.NA.FR.add$#[x]/50%';
    const k = F.taxSafeKey(원문);
    재기('금지 글자가 하나도 없다', !/[.#$\[\]\/]/.test(k), k);
    재기('원문으로 되돌아온다', F.taxFromSafeKey(k) === 원문, F.taxFromSafeKey(k));
    재기('옛 점 열쇠는 그대로 읽힌다(이중 읽기)', F.taxFromSafeKey('MR.Y5.NA') === 'MR.Y5.NA');
    재기('같은 원문은 같은 열쇠', F.taxSafeKey('MR.Y5.A') === F.taxSafeKey('MR.Y5.A'));
  }

  console.log('\n── ② 합치기 — 한 번만 · 새 판은 바꿔 끼운다');
  {
    const { F } = 약점세상(가짜서버());
    const v1 = { t: 'MR.Y5.A', n: 2, c: 1, list: [true, false] };
    const a = F._weaknessMerge(null, 'S1', 1, v1, '2026-10-01T00:00:00Z');
    재기('처음 반영: 2회 1정답', a.attempts === 2 && a.correct === 1 && a.wrong === 1, JSON.stringify(a));
    재기('원문 taxonomyId 를 적는다', a.taxonomyId === 'MR.Y5.A');
    재기('기여분을 적는다', a.contrib && a.contrib.S1 && a.contrib.S1.rev === 1 && a.contrib.S1.n === 2);
    재기('같은 판을 다시 → 바꾸지 않는다(undefined = 그만)', F._weaknessMerge(복(a), 'S1', 1, v1, 'x') === undefined);
    const b = F._weaknessMerge(복(a), 'S1', 2, { t: 'MR.Y5.A', n: 2, c: 2, list: [true, true] }, '2026-10-02T00:00:00Z');
    재기('새 판: 옛 기여분을 빼고 더한다(2회 2정답)', b.attempts === 2 && b.correct === 2 && b.wrong === 0, JSON.stringify(b));
    재기('새 판: 이력에서 옛 판 줄을 지운다', b.history.length === 2 && b.history.every(h => h.correct), JSON.stringify(b.history));
    const c = F._weaknessMerge(복(b), 'S2', 1, { t: 'MR.Y5.A', n: 1, c: 0, list: [false] }, 'z');
    재기('다른 제출은 따로 쌓인다', c.attempts === 3 && c.correct === 2 && c.wrong === 1);
    const d = F._weaknessMerge(복(c), 'S1', 3, { t: null, n: 0, c: 0, list: [] }, 'z');
    재기('새 판에서 빠진 분류 → 옛 기여분만 뺀다', d.attempts === 1 && d.correct === 0 && d.contrib.S1.n === 0, JSON.stringify(d));
    const 옛것 = { attempts: 5, correct: 3, wrong: 2, history: [{ ts: 't', correct: true }] };
    const e = F._weaknessMerge(복(옛것), 'S9', 1, { t: 'MR.Y5.B', n: 1, c: 1, list: [true] }, 'z');
    재기('옛 자료(기여분 없음)는 그대로 두고 더한다', e.attempts === 6 && e.correct === 4 && e.history.length === 2);
    재기('빈 칸에 뺄 것만 있으면 아무것도 안 만든다', F._weaknessMerge(null, 'S1', 2, { t: null, n: 0, c: 0, list: [] }, 'z') === null);
  }

  console.log('\n── ③ 줄 — 서버에 제출이 있어야 반영한다');
  {
    const 서버 = 가짜서버();
    const { F } = 약점세상(서버);
    const qs = [{ id: 'q0', answer: '2', taxonomy_id: 'MR.Y5.NA.add' }, { id: 'q1', answer: '3', taxonomy_id: 'MR.Y5.NA.add' },
                { id: 'q2', answer: '4' }];
    const job = F._weaknessJobOf(qs, { q0: '2', q1: '9' }, 'Mina', 'Mina_2026_m10_w1_s0', 1);
    재기('줄 하나에 분류 있는 문항만', job.items.length === 2 && job.sid === 'Mina' && job.rev === 1, JSON.stringify(job));
    F._weaknessEnqueue(job);
    await F._weaknessFlush();
    재기('서버에 제출이 없으면(응답 유실 전·창 닫힘) 반영 안 함', 서버.값('weakness') === undefined);
    재기('줄은 남아 있다(다음에 다시)', F._weaknessQueueRead().length === 1);

    서버.넣기('submissions/Mina_2026_m10_w1_s0', { submitted: true, rev: 1, answers: { q0: '2' } });
    await F._weaknessFlush();
    const k = F.taxSafeKey('MR.Y5.NA.add');
    const 칸 = 서버.값('weakness/Mina/skills/' + k);
    재기('서버에 제출이 생기면 반영한다', 칸 && 칸.attempts === 2 && 칸.correct === 1, JSON.stringify(칸));
    재기('반영 뒤 줄이 빈다', F._weaknessQueueRead().length === 0);
    재기('반영 기록(applied)을 남긴다', (서버.값('weakness/Mina/applied/' + F.taxSafeKey('Mina_2026_m10_w1_s0')) || {}).rev === 1);

    // 같은 줄이 다시 들어와도(두 번 눌림·재시도) 한 번만
    F._weaknessEnqueue(job);
    await F._weaknessFlush();
    await F.applyWeaknessUpdates(job);
    재기('같은 제출·같은 판 → 한 번만', 서버.값('weakness/Mina/skills/' + k).attempts === 2);

    // 고쳐 낸 제출(rev 2)
    서버.넣기('submissions/Mina_2026_m10_w1_s0', { submitted: true, rev: 2 });
    F._weaknessEnqueue(F._weaknessJobOf(qs, { q0: '2', q1: '3' }, 'Mina', 'Mina_2026_m10_w1_s0', 2));
    await F._weaknessFlush();
    const 칸2 = 서버.값('weakness/Mina/skills/' + k);
    재기('고쳐 내면 바꿔 끼운다(2회 2정답)', 칸2.attempts === 2 && 칸2.correct === 2, JSON.stringify(칸2));

    // 서버가 더 새 판이면 낡은 줄은 버린다
    F._weaknessEnqueue(F._weaknessJobOf(qs, {}, 'Mina', 'Mina_2026_m10_w1_s0', 1));
    await F._weaknessFlush();
    재기('낡은 판의 줄은 버린다', F._weaknessQueueRead().length === 0 && 서버.값('weakness/Mina/skills/' + k).correct === 2);

    // 서버 판이 아직 낮으면 기다린다
    F._weaknessEnqueue(F._weaknessJobOf(qs, {}, 'Mina', 'Mina_2026_m10_w1_s0', 3));
    await F._weaknessFlush();
    재기('서버 판이 아직 낮으면 기다린다', F._weaknessQueueRead().length === 1 && 서버.값('weakness/Mina/skills/' + k).correct === 2);

    // 읽기가 막혀도 줄은 지켜진다
    서버.읽기막힘 = true;
    await F._weaknessFlush();
    재기('네트워크가 끊겨도 줄을 잃지 않는다', F._weaknessQueueRead().length === 1);
  }
  {
    // 동시에 두 번 불려도 한 번만 반영
    const 서버 = 가짜서버({ submissions: { S_2026_m10_w1_s0: { submitted: true, rev: 1 } } });
    const { F } = 약점세상(서버);
    F._weaknessEnqueue(F._weaknessJobOf([{ id: 'q0', answer: '1', taxonomy_id: 'MR.X' }], { q0: '1' }, 'S', 'S_2026_m10_w1_s0', 1));
    await Promise.all([F._weaknessFlush(), F._weaknessFlush()]);
    재기('동시에 두 번 불려도 한 번만', 서버.값('weakness/S/skills/' + F.taxSafeKey('MR.X')).attempts === 1);
  }
  {
    // 미리보기·서버 없음
    const 서버 = 가짜서버({ submissions: { S_s0: { submitted: true, rev: 1 } } });
    const { F, w } = 약점세상(서버);
    w.fbReady = false;
    F._weaknessEnqueue(F._weaknessJobOf([{ id: 'q0', answer: '1', taxonomy_id: 'MR.X' }], { q0: '1' }, 'S', 'S_s0', 1));
    await F._weaknessFlush();
    재기('서버에 안 붙었으면 아무것도 안 한다', 서버.값('weakness') === undefined && F._weaknessQueueRead().length === 1);
  }

  console.log('\n── ④ doSubmit — 줄 먼저 · 저장 성공 뒤에만 반영');
  {
    const doSubmit소스 = 떼기('function doSubmit() {', '\n// ═══ [1단계] 약점 반영 — 시작');
    const 기록 = [];
    const 쓴경로 = [];
    let 저장콜백 = null;
    const 서랍값 = { currentPeriod: { year: 2026, month: 10, week: 1 }, submissions: {},
      homeworkSets: { AU_y5_2026_m10_w1: { sets: [{ title: 'S1', questions: [
        { id: 'q0', text: 'a', answer: '2', taxonomy_id: 'MR.Y5.A' }, { id: 'q1', text: 'b', answer: '3' }] }] } } };
    const 값 = {
      getStore: () => 서랍값, saveStore: () => true,
      studentPeriod: null, currentSetIdx: 0,
      currentUser: { id: 'Mina', name: 'M', year: 5, country: 'AU', group: '' },
      subKey: (sid, p, i) => `${sid}_${p.year}_m${String(p.month).padStart(2, '0')}_w${p.week}_s${i}`,
      hwLookup: (s) => s.homeworkSets.AU_y5_2026_m10_w1,
      hwLookupKey: () => 'AU_y5_2026_m10_w1',
      normAns: (a) => (a == null ? a : String(a).trim()),
      detectWeakAreas: () => [],
      gm_showSolomon: undefined, gm_kidMode: undefined,
      window: { TAXONOMY_MR: {}, isPreviewMode: false },
      applyWeaknessUpdates: () => { 기록.push('바로반영'); return Promise.resolve(); },
      _weaknessJobOf: (qs, ans, sid, key, rev) => ({ sid, subKey: key, rev, items: qs.filter(q => q.taxonomy_id).map(q => ({ t: q.taxonomy_id })) }),
      _weaknessEnqueue: (job) => 기록.push('줄:' + job.rev + ':' + job.items.length),
      _weaknessFlush: () => { 기록.push('비우기'); return Promise.resolve(); },
      showSubmitConfirmModal: (s) => 기록.push('창:' + s),
      fbSetSubmission: (key, data, cb) => { 기록.push('통째저장'); 저장콜백 = cb; },
      // [정비 §5] 제출은 맡은 항목만 쓴다 — 판 번호는 .../rev 경로로 간다
      fbWrite: (u, cb) => { const r = Object.keys(u).find(k => /\/rev$/.test(k)); 기록.push('저장:' + (r ? u[r] : '?')); 쓴경로.push(...Object.keys(u)); 저장콜백 = cb; },
      setTimeout: () => 0, clearTimeout: () => {},
      renderStudent: () => {}, qIdx: 0,
      // [2-B] doSubmit 이 세션 상태를 본다(마스터 = 보기만)
      prepSessionState: () => 세션상태, showBackupToast: (m) => 기록.push('알림'),
      console,
    };
    let 세션상태 = 'ok';
    const 이름 = Object.keys(값);
    const doSubmit = new Function(...이름, doSubmit소스 + '\n; return doSubmit;')(...이름.map(k => 값[k]));
    doSubmit();
    재기('바로 반영(applyWeaknessUpdates 직접 부름)을 안 한다', !기록.includes('바로반영'), 기록.join(' → '));
    재기('줄에 먼저 넣고 그다음 저장', 기록.indexOf('줄:1:1') >= 0 && 기록.indexOf('줄:1:1') < 기록.indexOf('저장:1'), 기록.join(' → '));
    재기('저장 응답 전에는 비우지 않는다', !기록.includes('비우기'), 기록.join(' → '));
    저장콜백(false);
    재기('저장 실패면 비우지 않는다(줄은 남아 다음에)', !기록.includes('비우기'), 기록.join(' → '));
    doSubmit();
    재기('다시 내면 판(rev)이 올라간다', 기록.includes('저장:2') && 기록.includes('줄:2:1'), 기록.join(' → '));
    저장콜백(true);
    재기('저장 성공이면 줄을 비운다(반영)', 기록.includes('비우기'), 기록.join(' → '));
    재기('제출 기록의 기존 열쇠는 그대로(answers·submitted·reportData)',
         ['answers', 'submitted', 'submitTime', 'reportData'].every(k => k in 서랍값.submissions.Mina_2026_m10_w1_s0),
         Object.keys(서랍값.submissions.Mina_2026_m10_w1_s0).join(','));
    // [정비 §5] 제출이 맡은 항목만 — 보충학습·보관함·카톡은 안 건드린다 · 원장 처리 표시는 지운다 · 칸 통째 쓰기 없음
    재기('[정비 §5] 제출은 칸 통째가 아니라 항목만 쓴다', !기록.includes('통째저장')
         && 쓴경로.every(k => /^submissions\/Mina_2026_m10_w1_s0\/(answers\/|submitted$|submitTime$|rev$|hwKey$|reportData$|manuallyMarked$|markedBy$|markedAt$|markedReason$|markedReasonCode$)/.test(k))
         && 쓴경로.includes('submissions/Mina_2026_m10_w1_s0/submitted'), 쓴경로.join(' '));
    // [2-B] 마스터 세션이면 제출·줄 넣기 둘 다 안 한다
    const 전 = 기록.length;
    세션상태 = 'master';
    doSubmit();
    재기('[2-B] 마스터는 제출 못 한다(저장·줄 0 · 알림만)', 기록.slice(전).join() === '알림', 기록.slice(전).join(' → '));
  }

  console.log('\n── ⑤ 읽는 쪽 — 원문으로 나누고 옛 자료도 읽는다');
  {
    const { F } = 약점세상(가짜서버());
    // 1분 전 — 읽개는 「ts < 지금」 이라 같은 밀리초면 빠진다(시험이 가끔 넘어지던 까닭)
    const 지금 = new Date(Date.now() - 60 * 1000).toISOString();
    const 줄 = (n, c) => Array.from({ length: n }, (_, i) => ({ ts: 지금, correct: i < c }));
    const 약점 = { skills: {
      [F.taxSafeKey('MR.Y8.AL.LE.linear')]: { taxonomyId: 'MR.Y8.AL.LE.linear', history: 줄(4, 1) },
      'MR.Y8.AL.LE.linear': { history: 줄(2, 0) },     // 옛 점 열쇠(이중 읽기)
      [F.taxSafeKey('MR.Y8.GE.AR.tri')]: { history: 줄(5, 5) },   // taxonomyId 없음 → 열쇠를 풀어 읽는다
    } };
    const 묶음 = F._weaknessSkillsByTaxId(약점);
    재기('같은 분류의 새 열쇠·옛 열쇠를 하나로 합친다', 묶음['MR.Y8.AL.LE.linear'] && 묶음['MR.Y8.AL.LE.linear'].history.length === 6, JSON.stringify(Object.keys(묶음)));
    재기('taxonomyId 없는 새 열쇠는 풀어서 원문으로', !!묶음['MR.Y8.GE.AR.tri']);

    const 읽개 = 떼기('function calculateStudentAccuracy(studentId, options) {', '\nfunction calculateLearningConsistency');
    const store = { weakness: { Kid: 약점 } };
    const R = new Function('getStore', '_weaknessSkillsByTaxId', 읽개 + '\n; return {calculateStudentAccuracy, analyzeStudentStrengthsWeaknesses};')(
      () => store, F._weaknessSkillsByTaxId);
    const acc = R.calculateStudentAccuracy('Kid');
    재기('정확도: 열쇠가 원문 분류', !!acc.breakdown['MR.Y8.AL.LE.linear'] && !!acc.breakdown['MR.Y8.GE.AR.tri'], JSON.stringify(Object.keys(acc.breakdown)));
    재기('정확도: 옛 자료까지 합쳐 센다(11회)', acc.totalAttempts === 11, acc.totalAttempts);
    const sw = R.analyzeStudentStrengthsWeaknesses('Kid', { minAttempts: 5 });
    재기('강약 분석: 원문을 점으로 나눠 영역을 안다', sw.byStrand.AL && sw.byStrand.GE, JSON.stringify(sw.byStrand));
    재기('강약 분석: 약점에 linear(6회 1정답)', sw.weaknesses.some(s => s.taxId === 'MR.Y8.AL.LE.linear'), JSON.stringify(sw.weaknesses));
  }

  console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
  process.exit(실패 ? 1 : 0);
})().catch(e => { console.log('  ⛔ 터졌다: ' + (e && e.stack || e)); console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + (실패 + 1)); process.exit(1); });
