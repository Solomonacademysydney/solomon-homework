// 코덱스 주간 점검(2026-10-05) F1·F2·F3·F7 — 늦게 온 요청 · 축하 타이머 · 계정 바뀜 · 약점 다시 반영
//
//   F1 새로 풀기 뒤 늦게 온 옛 제출/옛 새로 풀기가 칸을 다시 바꾸면 안 된다(처리한 opId 를 _ops 에 여럿 기억)
//   F2 축하는 서버가 확정한 칸의 점수로 · 제출 전 사본을 통째로 되쓰지 않는다
//   F3 지금 로그인한 아이의 칸이 아니면 응답을 사본에 넣지 않는다
//   F7 서버가 weakPending 을 주면 화면은 줄의 일을 지우지 않는다(같은 opId 로 다시 → 서버가 다시 반영)
'use strict';
const fs = require('fs');
const html = fs.readFileSync('E:/aa0/hp/index.html', 'utf8');
const 서버소스 = fs.readFileSync(require('path').join(__dirname, '..', 'hw_submit.js'), 'utf8');
const H = require('../hw_submit')._internals;
let 통과 = 0, 실패 = 0;
function 재기(이름, 참, 덧) { if (참) { 통과++; console.log('  ✅ ' + 이름); } else { 실패++; console.log('  ⛔ ' + 이름 + (덧 ? '\n       ' + 덧 : '')); } }
const 떼기 = (a, b) => { const i = html.indexOf(a); if (i < 0) throw new Error('못 찾음: ' + a); const j = html.indexOf(b, i + 10); return html.slice(i, j); };

const 세트 = { title: 'S', questions: [{ id: 'q0', text: '2+3?', answer: 'B', type: 'mc', taxonomy_id: 'MR.Y5.A' }] };
const 제출입력 = (opId, answers, at) => ({ opId, answers, sent: {}, set: 세트, who: { id: 'Amy05', name: 'A', year: 5 },
  period: { year: 2026, month: 10, week: 1 }, now: 't' + at, at, hwKey: 'HK' });
const 새로입력 = (opId, at) => ({ opId, now: 't' + at, at, hwKey: 'HK' });
const 돌림 = (step, cur, inp) => { const out = {}; const n = step(cur, inp, out); return { out, 칸: n === undefined ? cur : n }; };

console.log('── F1 · 제출 X → 새로 풀기 → 늦게 온 X');
{
  let r = 돌림(H.submitStep, null, 제출입력('op_X_00001', { q0: 'B' }, 1));
  재기('X 는 새 제출', r.out.kind === 'new' && r.칸.submitted === true);
  r = 돌림(H.freshStep, r.칸, 새로입력('op_F_00001', 2));
  재기('새로 풀기 → 비고 보관함에 B', r.out.kind === 'new' && r.칸.submitted === false && r.칸._prev[0].answers.q0 === 'B');
  const 비운칸 = r.칸;
  r = 돌림(H.submitStep, 비운칸, 제출입력('op_X_00001', { q0: 'B' }, 3));
  재기('늦게 온 X → dup · 칸은 빈 채 · 제출 아님', r.out.kind === 'dup' && r.칸 === 비운칸 && r.칸.submitted === false && Object.keys(r.칸.answers).length === 0, JSON.stringify(r.out));
}

console.log('\n── F1 · 새로 풀기 A → 새로 풀기 B → 새 답 C → 늦게 온 A');
{
  let 칸 = { answers: { q0: 'B' }, submitted: true, rev: 1, lastSubmitOp: 'op_old_0001' };
  칸 = 돌림(H.freshStep, 칸, 새로입력('op_FA_00001', 1)).칸;
  칸 = 돌림(H.freshStep, 칸, 새로입력('op_FB_00001', 2)).칸;
  칸 = Object.assign({}, 칸, { answers: { q0: 'C' } });          // 아이가 새로 푸는 중(답 칸은 아이가 직접 쓴다)
  const r = 돌림(H.freshStep, 칸, 새로입력('op_FA_00001', 3));
  재기('늦게 온 A → dup · 진행 중인 답 C 그대로', r.out.kind === 'dup' && r.칸.answers.q0 === 'C' && r.칸._prev.length === 2, JSON.stringify(r.칸.answers));
}

console.log('\n── F1 · 기억은 최근 ' + H.OPS_KEEP + '개까지만(칸이 끝없이 커지지 않게)');
{
  let 칸 = { answers: {} };
  for (let i = 0; i < H.OPS_KEEP + 10; i++) 칸 = 돌림(H.freshStep, 칸, 새로입력('op_many_' + String(i).padStart(4, '0'), 100 + i)).칸;
  const ks = Object.keys(칸._ops || {});
  재기('개수 = ' + H.OPS_KEEP, ks.length === H.OPS_KEEP, String(ks.length));
  재기('가장 최근 것이 남는다', !!칸._ops['op_many_' + String(H.OPS_KEEP + 9).padStart(4, '0')] && !칸._ops['op_many_0000']);
  재기('이미 제출된 칸에 다른 답 → _conflicts 와 함께 opId 도 적는다(같은 일이 또 와도 두 번 안 적음)', (() => {
    const 첫 = 돌림(H.submitStep, { answers: { q0: 'B' }, submitted: true, rev: 1 }, 제출입력('op_cf_00001', { q0: 'C' }, 5));
    const 둘 = 돌림(H.submitStep, 첫.칸, 제출입력('op_cf_00001', { q0: 'C' }, 6));
    return 첫.out.kind === 'already' && 둘.out.kind === 'dup' && Object.keys(둘.칸._conflicts).length === 1;
  })());
}

console.log('\n── F7 · 서버가 약점 실패를 알리고 · dup 에서도 다시 반영한다');
{
  재기('응답에 weakPending 이 있다', /weakPending\s*\}/.test(서버소스) && /let weakPending = false/.test(서버소스));
  재기('dup·already 길에서 지금 서버 칸으로 다시 반영', /out\.kind === 'dup' \|\| out\.kind === 'already'\) && v\.submitted/.test(서버소스));
  const ds = 떼기('function doSubmit() {', '\n// [점검 10-05 F2]');
  재기('doSubmit — weakPending 이면 줄의 일을 안 지운다', /if \(_줄 && !\(res && res\.weakPending\)\)/.test(ds));
  재기('줄 비우기 — weakPending 이면 남긴다(일주일까지)', /res\.weakPending && \(Date\.now\(\) - \(Number\(item\.queuedAt\)/.test(html));
}

console.log('\n── F2 · 축하는 서버 칸으로 · 옛 사본을 되쓰지 않는다');
{
  const ds = 떼기('function doSubmit() {', '\n// [점검 10-05 F2]');
  재기('doSubmit 안에 setTimeout 속 saveStore(store) 가 없다', !/setTimeout\(function\(\)\{[\s\S]*?saveStore\(store\)/.test(ds));
  재기('축하는 서버 성공 뒤에만 건다', /showSubmitConfirmModal\('success'\);\s*\/\/ \[F2\][^\n]*\n\s*if \(typeof _hwCelebrate === 'function'\) setTimeout/.test(ds));

  const src = 떼기('function _hwCelebrate(key, uid) {', '\n// ═══ [1단계] 약점 반영 — 시작');
  const 만들기 = (서랍, 사람) => {
    const 기록 = [];
    const 값 = {
      currentUser: 사람, getStore: () => 서랍, saveStore: (s) => { 기록.push(['저장', JSON.parse(JSON.stringify(s))]); return true; },
      fbWrite: (u) => 기록.push(['쓰기', u]),
      gm_showSolomon: (o) => 기록.push(['축하', o.message]), gm_kidMode: () => true,
      document: { getElementById: () => null },
    };
    const 이름 = Object.keys(값);
    const f = new Function(...이름, src + '\n; return _hwCelebrate;')(...이름.map(k => 값[k]));
    return { f, 기록 };
  };
  const K = 'Mina_2026_m10_w1_s0';
  // 서버가 다른 창의 답 C 를 지켜 0점으로 확정 — 사본은 이미 서버 칸으로 맞춰져 있다
  const 서랍 = { submissions: { [K]: { answers: { q0: 'C' }, submitted: true, reportData: { score: 0, correctCount: 0, totalQuestions: 1 } }, 다른칸: { x: 1 } } };
  const { f, 기록 } = 만들기(서랍, { id: 'Mina' });
  f(K, 'Mina');
  const 축하 = 기록.find(x => x[0] === '축하'), 저장 = 기록.find(x => x[0] === '저장'), 쓰기 = 기록.find(x => x[0] === '쓰기');
  재기('서버 점수(0/1)로 축하', 축하 && /0\/1/.test(축하[1]), JSON.stringify(기록));
  재기('저장된 사본의 답·점수 = 서버 값 그대로(C · 0점)', 저장 && 저장[1].submissions[K].answers.q0 === 'C' && 저장[1].submissions[K].reportData.score === 0 && 저장[1].submissions[K].celebrationShown === true);
  재기('서버에는 깃발 하나만', 쓰기 && Object.keys(쓰기[1]).join() === 'submissions/' + K + '/celebrationShown');
  const 둘 = 만들기(서랍, { id: 'Mina' }); 둘.f(K, 'Mina');
  재기('두 번째는 안 띄운다(celebrationShown)', 둘.기록.length === 0);
  const 셋 = 만들기({ submissions: { [K]: { answers: {}, submitted: true, reportData: { score: 100, correctCount: 1, totalQuestions: 1 } } } }, { id: 'Ben' });
  셋.f(K, 'Mina');
  재기('그 사이 다른 아이로 바뀌었으면 아무것도 안 한다', 셋.기록.length === 0);
  const 넷 = 만들기({ submissions: { [K]: { answers: {}, submitted: false } } }, { id: 'Mina' });
  넷.f(K, 'Mina');
  재기('제출이 확정되지 않은 칸이면 축하 없음', 넷.기록.length === 0);
}

console.log('\n── F3 · 늦게 온 응답은 지금 아이의 칸에만');
{
  const src = 떼기('function _hwSubmitApply(key, res) {', '\n/** 서버 명령 실패');
  const 만들기 = (사람) => {
    const 서랍 = { submissions: {} }; let 저장 = 0;
    const 값 = { currentUser: 사람, getStore: () => 서랍, saveStore: () => { 저장++; return true; },
      showBackupToast: () => {}, renderStudent: () => {}, console };
    const 이름 = Object.keys(값);
    const f = new Function(...이름, src + '\n; return _hwSubmitApply;')(...이름.map(k => 값[k]));
    return { f, 서랍, 저장: () => 저장 };
  };
  const 응답 = { ok: true, kind: 'new', sub: { submitted: true, answers: { q0: 'B' } }, conflicts: [] };
  const a = 만들기({ id: 'Ben', role: 'student' });
  a.f('Mina_2026_m10_w1_s0', 응답);
  재기('형(Mina) 응답이 동생(Ben) 사본에 안 들어간다', !a.서랍.submissions['Mina_2026_m10_w1_s0'] && a.저장() === 0);
  const b = 만들기(null);
  b.f('Mina_2026_m10_w1_s0', 응답);
  재기('로그아웃 상태면 아무것도 안 한다', b.저장() === 0);
  const c = 만들기({ id: 'Mina', role: 'student' });
  c.f('Mina_2026_m10_w1_s0', 응답);
  재기('본인 칸은 그대로 맞춘다', c.서랍.submissions['Mina_2026_m10_w1_s0'] && c.저장() === 1);
  재기('doSubmit · 새로 풀기 — 응답 때 아이디를 대조한다',
    /currentUser\.id !== _uid\) return;/.test(떼기('function doSubmit() {', '\n// [점검 10-05 F2]')) &&
    /currentUser\.id !== _uid\) return;/.test(떼기('function startFreshSet(idx) {', '\n}\n')));
}

console.log('\n── 재검토 ① · 숙제가 바뀌어 새로 푼 뒤 늦게 온 옛 제출 — 칸을 바꾸지 않는다');
{
  const 옛제출 = (opId, answers, at) => Object.assign(제출입력(opId, answers, at), { hwKey: 'HK_OLD' });
  // 옛 숙제 칸(제출됨) → 숙제가 HK 로 바뀌어 새로 풀기 → 새 답 C 푸는 중
  const 옛칸 = { answers: { q0: 'B' }, submitted: true, rev: 1, hwKey: 'HK_OLD', lastSubmitOp: 'op_seen_0001' };
  let 새칸 = 돌림(H.freshStep, 옛칸, 새로입력('op_F_00002', 2)).칸;
  새칸 = Object.assign({}, 새칸, { answers: { q0: 'C' } });

  let r = 돌림(H.submitStep, 새칸, 옛제출('op_not_yet_seen', { q0: 'B' }, 3));
  재기('처음 보는 옛 요청 → stale · 답 C · 제출 아님 · 판 그대로',
    r.out.kind === 'stale' && r.칸.answers.q0 === 'C' && r.칸.submitted === false && r.칸.hwKey === 'HK' && r.칸.rev === 새칸.rev, JSON.stringify(r.out));
  재기('보낸 옛 답은 _staleSubmits 에 남는다', r.칸._staleSubmits && r.칸._staleSubmits.op_not_yet_seen.answers.q0 === 'B');
  재기('stale 에는 채점 결과(items)가 없다 — 약점에 안 들어간다', r.out.items === undefined);
  const r2 = 돌림(H.submitStep, r.칸, 옛제출('op_not_yet_seen', { q0: 'B' }, 4));
  재기('같은 옛 요청 또 → dup · 아무것도 안 씀', r2.out.kind === 'dup' && r2.칸 === r.칸);

  // 옛 칸에서 「같은 답 already」(작업 번호를 안 적던 길) → 새로 풀기 → 그 요청 다시
  const a1 = 돌림(H.submitStep, 옛칸, 옛제출('op_same_ans1', { q0: 'B' }, 5));
  재기('(전제) 옛 칸에 같은 답 → already', a1.out.kind === 'already');
  const a2 = 돌림(H.submitStep, 새칸, 옛제출('op_same_ans1', { q0: 'B' }, 6));
  재기('그 요청을 새로 풀기 뒤 다시 → stale · 새 풀이 그대로', a2.out.kind === 'stale' && a2.칸.submitted === false && a2.칸.answers.q0 === 'C');

  // 처리 이력 30개를 넘긴 옛 요청 재전송
  let 긴칸 = 새칸;
  for (let i = 0; i < H.OPS_KEEP + 5; i++) 긴칸 = Object.assign({}, 긴칸, { _ops: Object.assign({}, 긴칸._ops, { ['op_fill_' + i]: 1000 + i }) });
  const big = 돌림(H.submitStep, 긴칸, 옛제출('op_seen_0001x', { q0: 'B' }, 7));
  재기('이력이 넘친 뒤 옛 요청 → stale', big.out.kind === 'stale' && big.칸.submitted === false);

  // 옛 기록(hwKey 없음)은 예전처럼 받는다 — 막지 않는다
  const 무 = 돌림(H.submitStep, { answers: { q0: 'B' } }, 제출입력('op_nokey_001', { q0: 'B' }, 8));
  재기('hwKey 없는 칸 → 예전처럼 새 제출', 무.out.kind === 'new' && 무.칸.submitted === true && 무.칸.hwKey === 'HK');
  // 지금 숙제 그대로 낸 정상 제출
  const 정 = 돌림(H.submitStep, 새칸, 제출입력('op_normal_01', { q0: 'C' }, 9));
  재기('지금 숙제로 낸 정상 제출 → new', 정.out.kind === 'new' && 정.칸.submitted === true && 정.칸.answers.q0 === 'C');

  // _staleSubmits 는 10개까지만
  let 칸10 = 새칸;
  for (let i = 0; i < 15; i++) 칸10 = 돌림(H.submitStep, 칸10, 옛제출('op_st_' + String(i).padStart(5, '0'), { q0: 'B' }, 100 + i)).칸;
  재기('_staleSubmits 최근 10개', Object.keys(칸10._staleSubmits).length === 10 && !!칸10._staleSubmits.op_st_00014 && !칸10._staleSubmits.op_st_00000);

  const ds = 떼기('function doSubmit() {', '\n// [점검 10-05 F2]');
  재기('doSubmit — stale 이면 성공 창·축하를 안 띄운다', /res\.kind === 'stale'\) \{ showSubmitConfirmModal\('warning'\); return; \}/.test(ds));
  재기('사본 맞추기 — stale 안내 문구', /res\.kind === 'stale'/.test(떼기('function _hwSubmitApply(key, res) {', '\n/** 서버 명령 실패')));
}

console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
process.exit(실패 ? 1 : 0);
