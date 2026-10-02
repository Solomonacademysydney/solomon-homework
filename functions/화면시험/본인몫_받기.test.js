// 본인 몫 받기 — 학생·학부모는 **자기 칸만** 받는다 (RTDB 요금 묶음 3 · 2026-10-02)
//
// 지키는 것
//   ① 학생: 반 칸 + 공통 칸을 **함께** 받는다 · 남의 학년·반·학생 칸은 안 받는다
//   ② 제출은 그 아이 것을 **주차 가리지 않고 전부**(앞머리 범위) — 남의 제출(비슷한 아이디 포함)은 안 받는다
//   ③ 리포트·월간 리포트·약점도 그 아이 몫만 · 공책(users)은 본인 줄뿐
//   ④ 학부모: 자녀 줄(profile.children)마다 받는다 · 자녀 줄이 없으면 NO-CHILD-ROWS 로 던진다
//   ⑤ fbWrite 문지기: 받은 주가 아닌 주의 제출 칸 쓰기를 가려낸다 · 지난 주를 받으면 풀린다
//   ⑥ 실시간: 숙제 칸이 바뀌면 서랍의 **그 칸만** 고친다 · 지워지면 지운다
//   ⑦ 로그아웃(_scopeDetach): 구독을 떼고, 그사이 끝난 받기는 STALE 로 버린다
//   ⑧ 읽기가 거절되면 던진다(들여보내지 않는다)
//
// 대상 파일: 환경변수 HP_INDEX(배포 후보) — 없으면 E:/aa0/hp/index.html

'use strict';
const fs = require('fs');
const html = fs.readFileSync(process.env.HP_INDEX || 'E:/aa0/hp/index.html', 'utf8');

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
const 함수 = (이름) => 떼기('function ' + 이름 + '(', '\n}\n') + '\n}\n';
const 쉼 = () => new Promise(r => setImmediate(r));

// ── 가짜 DB ────────────────────────────────────────────────────────────────
const W = (y, m, w) => ({ year: y, month: m, week: w });
function 새DB() {
  return {
    currentPeriod: W(2026, 10, 1), lastModified: 1, migrationISO2026Done: true, submitLock: true,
    schools: { NSW_Public: { display_name: 'x' } },
    users: [{ id: 'T', role: 'teacher' }, { id: 'Amy05', role: 'student' }, { id: 'Ben03', role: 'student' }],
    taxonomy_mr: { big: 'x'.repeat(5000) },
    homeworkSets: {
      'AU_y5-A_2026_m10_w1': { sets: [{ title: '반A 1주' }] },
      'AU_y5_2026_m10_w1': { sets: [{ title: '공통 1주' }] },
      'AU_y5_2026_m10_w2': { sets: [{ title: '공통 2주' }] },
      'AU_y5-B_2026_m10_w1': { sets: [{ title: '반B — 남의 반' }] },
      'AU_y3_2026_m10_w1': { sets: [{ title: 'Y3 — 남의 학년' }] },
      'AU_y5_2026_m08_w1': { sets: [{ title: '옛 주 공통' }] },
      'AU_y5-A_2026_m08_w1': { sets: [{ title: '옛 주 반A' }] },
    },
    submissions: {
      'Amy05_2026_m10_w1_s0': { answers: { q0: 'B' }, submitted: false },
      'Amy05_2026_m08_w1_s0': { answers: { q0: 'A' }, submitted: true },
      'ts_Amy05_2026_m10_w1': { day1: { completed: true } },
      'Amy05X_2026_m10_w1_s0': { answers: { q0: 'C' } },   // 비슷한 아이디 — 남이다
      'Ben03_2026_m10_w1_s0': { answers: { q0: 'D' } },
      'ts_Ben03_2026_m10_w1': { day1: {} },
    },
    reports: { '2026_m10_w1': { Amy05: { maths: { s: 1 } }, Ben03: { maths: { s: 2 } } } },
    monthlyReports: { '2026-10': { Amy05: { c: 'a' }, Ben03: { c: 'b' } } },
    weakness: { Amy05: { skills: { k: 1 } }, Ben03: { skills: { k: 2 } } },
  };
}
function 가짜FB(db, 막을 = null) {
  const 읽음 = [];
  const 듣는것 = [];
  const get = (path) => path.replace(/^solomon_hw_v3\/?/, '').split('/').filter(Boolean).reduce((o, k) => (o == null ? undefined : o[k]), db);
  const snap = (v) => ({ val: () => (v === undefined ? null : JSON.parse(JSON.stringify(v))) });
  const 거절 = (path) => 막을 && 막을.test(path);
  const ref = (path) => ({
    path,
    child: (c) => ref(path ? path + '/' + c : c),
    once: async () => { 읽음.push(path); if (거절(path)) throw Object.assign(new Error('permission_denied'), { code: 'PERMISSION_DENIED' }); return snap(get(path)); },
    on: (ev, cb, errCb) => {
      읽음.push('on:' + path);
      듣는것.push({ path, cb });
      setImmediate(() => { if (거절(path)) { if (errCb) errCb(new Error('permission_denied')); } else cb(snap(get(path))); });
      return cb;
    },
    off: (ev, cb) => { const i = 듣는것.findIndex(l => l.path === path && l.cb === cb); if (i >= 0) 듣는것.splice(i, 1); },
    orderByKey: () => ({ startAt: (a) => ({ endAt: (b) => ({ once: async () => {
      읽음.push('range:' + path + ':' + a);
      if (거절(path)) throw Object.assign(new Error('permission_denied'), { code: 'PERMISSION_DENIED' });
      const all = get(path) || {};
      const o = {}; for (const k of Object.keys(all)) if (k >= a && k <= b) o[k] = all[k];
      return snap(o);
    } }) }) }),
  });
  const 보내기 = (path) => { for (const l of 듣는것.filter(l => l.path === path)) l.cb(snap(get(path))); };
  return { root: ref('solomon_hw_v3'), 읽음, 듣는것, 보내기 };
}

// ── 홈페이지 코드 떼어 오기 ─────────────────────────────────────────────────
const 덩이 = 떼기('// ═══ [RTDB 요금 묶음 3 · 2026-10-02] 학생·학부모 — **본인 몫만** 받는다', '// 서랍을 읽는 **단 하나의 길목.**');
const 도우미 = ['hwKey', '_periodCanon', '_periodOfKey', 'prevPeriod', 'nextPeriod', 'weeksInMonth', 'reportPeriodKey'].map(함수).join('\n');

function 만들기(db, 막을) {
  const fb = 가짜FB(db, 막을);
  const window = { FB_REF: { child: (c) => fb.root.child(c) } };
  let 서랍 = null;
  const 환경 = {
    window,
    currentUser: null,
    getTodayPeriod: () => W(2026, 10, 1),
    _LOCAL_KEEP_FWD: 2, _LOCAL_KEEP_BACK: 1,
    _rawLocalStore: () => 서랍,
    _persistLocalStore: (d) => { 서랍 = JSON.stringify(d); return true; },
    renderStudent: () => { 환경.그림++; },
    document: { getElementById: () => ({}) },
    console: { log() {}, warn() {}, info() {}, error() {} },
    그림: 0,
  };
  const 이름들 = Object.keys(환경).filter(k => k !== '그림');
  const 몸 = 도우미 + '\n' + 덩이 + '\n; return { _loadScope, _scopeLoadPeriod, _scopeUnreadWrites, _scopeDetach, setUser: (u) => { currentUser = u; } };';
  const api = new Function(...이름들, 몸)(...이름들.map(k => 환경[k]));
  return { api, fb, window, 서랍: () => JSON.parse(서랍), 환경 };
}

(async () => {
  console.log('── ① ② ③ 학생 Amy05 (Y5 반A)');
  const db = 새DB();
  const amy = { id: 'Amy05', role: 'student', year: 5, country: 'AU', group: 'A', status: 'active' };
  const t = 만들기(db);
  t.api.setUser(amy);
  await t.api._loadScope(amy, Object.assign({}, amy));
  const d = t.서랍();
  const hk = Object.keys(d.homeworkSets).sort();
  재기('반 칸과 공통 칸을 함께 받는다(1주)', hk.includes('AU_y5-A_2026_m10_w1') && hk.includes('AU_y5_2026_m10_w1'), hk.join(','));
  재기('반 칸이 없는 주(2주)는 공통 칸이 온다', hk.includes('AU_y5_2026_m10_w2'), hk.join(','));
  재기('⛔ 남의 반(B)·남의 학년(Y3)은 안 받는다', !hk.includes('AU_y5-B_2026_m10_w1') && !hk.includes('AU_y3_2026_m10_w1'), hk.join(','));
  재기('⛔ 창 밖(8월) 칸은 안 받는다', !hk.some(k => /_m08_/.test(k)), hk.join(','));
  const sk = Object.keys(d.submissions).sort();
  재기('자기 제출을 주차 가리지 않고 전부(8월 포함) + TS', sk.join(',') === 'Amy05_2026_m08_w1_s0,Amy05_2026_m10_w1_s0,ts_Amy05_2026_m10_w1', sk.join(','));
  재기('⛔ 비슷한 아이디(Amy05X)·남(Ben03)의 제출은 안 받는다', !sk.some(k => /Amy05X|Ben03/.test(k)));
  재기('리포트는 자기 것만', d.reports['2026_m10_w1'] && d.reports['2026_m10_w1'].Amy05 && !d.reports['2026_m10_w1'].Ben03, JSON.stringify(d.reports));
  재기('월간 리포트는 자기 것만', d.monthlyReports['2026-10'] && d.monthlyReports['2026-10'].Amy05 && !d.monthlyReports['2026-10'].Ben03);
  재기('약점은 자기 것만', d.weakness.Amy05 && !d.weakness.Ben03);
  재기('공책은 본인 줄 하나뿐', d.users.length === 1 && d.users[0].id === 'Amy05');
  재기('작은 칸(이번 주·막기·학교·옮김 깃발)은 받는다', d.currentPeriod.week === 1 && d.submitLock === true && !!d.schools && d.migrationISO2026Done === true);
  재기('⛔ 앱 뿌리·숙제 전체·제출 전체·분류표는 안 읽는다',
       !t.fb.읽음.some(p => p === 'solomon_hw_v3' || p === 'solomon_hw_v3/homeworkSets' || p === 'solomon_hw_v3/submissions' || /taxonomy/.test(p)), t.fb.읽음.join(' | '));
  재기('fbReady 가 선다 · 정본 깃발은 안 선다', t.window.fbReady === true && t.window._usersCanonical === false);
  const 전체 = Buffer.byteLength(JSON.stringify(db));
  const 받은 = Buffer.byteLength(JSON.stringify(d));
  console.log('     (가짜 DB ' + 전체 + '바이트 중 ' + 받은 + '바이트를 받음)');

  console.log('\n── ⑤ 안 읽은 주에는 쓰지 않는다');
  재기('이번 주 제출 칸 → 써도 된다', t.api._scopeUnreadWrites({ 'submissions/Amy05_2026_m10_w1_s0': {} }).length === 0);
  재기('이번 주 TS 칸 → 써도 된다', t.api._scopeUnreadWrites({ 'submissions/ts_Amy05_2026_m10_w1': {} }).length === 0);
  재기('⛔ 안 읽은 8월 칸 → 가려낸다', t.api._scopeUnreadWrites({ 'submissions/Amy05_2026_m08_w1_s0': {} }).length === 1);
  재기('⛔ 가지 쓰기(…/answers/q0)도 가려낸다', t.api._scopeUnreadWrites({ 'submissions/Amy05_2026_m08_w1_s0/answers/q0': 'A' }).length === 1);
  재기('제출이 아닌 칸(약점 등)은 상관 않는다', t.api._scopeUnreadWrites({ 'weakness/Amy05/x': 1 }).length === 0);
  await t.api._scopeLoadPeriod(W(2026, 8, 1));
  const ex = t.window._extraPeriodData;
  재기('지난 주를 받는다 — 그 주 반 칸·공통 칸', ex && ex.homeworkSets['AU_y5-A_2026_m08_w1'] && ex.homeworkSets['AU_y5_2026_m08_w1']);
  재기('지난 주 — 그 주 자기 제출만', ex && Object.keys(ex.submissions).join(',') === 'Amy05_2026_m08_w1_s0', ex && Object.keys(ex.submissions).join(','));
  재기('받은 뒤에는 그 주에 써도 된다', t.api._scopeUnreadWrites({ 'submissions/Amy05_2026_m08_w1_s0': {} }).length === 0);
  t.api.setUser({ id: 'T', role: 'teacher' });
  재기('교사에게는 문지기가 안 선다', t.api._scopeUnreadWrites({ 'submissions/Amy05_2026_m07_w1_s0': {} }).length === 0);
  t.api.setUser(amy);

  console.log('\n── ⑥ 실시간 — 그 칸만 고친다');
  db.homeworkSets['AU_y5_2026_m10_w2'] = { sets: [{ title: '공통 2주 (고침)' }] };
  t.fb.보내기('solomon_hw_v3/homeworkSets/AU_y5_2026_m10_w2');
  let d2 = t.서랍();
  재기('바뀐 칸이 서랍에 들어온다', d2.homeworkSets['AU_y5_2026_m10_w2'].sets[0].title === '공통 2주 (고침)');
  재기('다른 칸·제출은 그대로', d2.homeworkSets['AU_y5-A_2026_m10_w1'] && Object.keys(d2.submissions).length === 3);
  재기('학생 화면을 다시 그린다', t.환경.그림 >= 1);
  delete db.homeworkSets['AU_y5_2026_m10_w2'];
  t.fb.보내기('solomon_hw_v3/homeworkSets/AU_y5_2026_m10_w2');
  재기('지워진 칸은 서랍에서도 지운다', !('AU_y5_2026_m10_w2' in t.서랍().homeworkSets));
  재기('반 칸이 없는 주의 반 칸도 듣는다(나중에 생기면 들어오게)', t.fb.듣는것.some(l => l.path === 'solomon_hw_v3/homeworkSets/AU_y5-A_2026_m10_w2'));

  console.log('\n── ⑦ 로그아웃');
  const 듣던수 = t.fb.듣는것.length;
  t.api._scopeDetach();
  재기('구독을 다 뗀다', 듣던수 > 0 && t.fb.듣는것.length === 0, 듣던수 + ' → ' + t.fb.듣는것.length);
  재기('문지기도 내려간다(다음 사람은 새로 받는다)', t.window._scope === null);
  const t2 = 만들기(새DB());
  t2.api.setUser(amy);
  const 받기 = t2.api._loadScope(amy, amy);
  t2.api._scopeDetach();   // 받는 사이 로그아웃
  let 던짐 = '';
  try { await 받기; } catch (e) { 던짐 = e.message; }
  재기('⛔ 받는 사이 로그아웃하면 STALE 로 버린다', 던짐 === 'STALE', 던짐);
  재기('⛔ 그 받기는 fbReady 를 세우지 않는다', t2.window.fbReady !== true);

  console.log('\n── ④ 학부모');
  const t3 = 만들기(새DB());
  const mom = { id: 'Mom', role: 'parent', childIds: ['Amy05', 'Ben03'], status: 'active' };
  const ben = { id: 'Ben03', role: 'student', year: 3, country: 'AU', group: '', status: 'active' };
  t3.api.setUser(mom);
  await t3.api._loadScope(mom, Object.assign({}, mom, { children: [amy, ben] }));
  const d3 = t3.서랍();
  재기('자녀 둘의 숙제 칸', d3.homeworkSets['AU_y5-A_2026_m10_w1'] && d3.homeworkSets['AU_y3_2026_m10_w1'], Object.keys(d3.homeworkSets).join(','));
  재기('자녀 둘의 제출', Object.keys(d3.submissions).some(k => k.startsWith('Ben03_')) && Object.keys(d3.submissions).some(k => k.startsWith('Amy05_')));
  재기('⛔ 비슷한 아이디(Amy05X)는 여전히 안 받는다', !Object.keys(d3.submissions).some(k => k.startsWith('Amy05X')));
  재기('공책 = 학부모 줄 + 자녀 줄', d3.users.map(u => u.id).join(',') === 'Mom,Amy05,Ben03');
  let 없음 = '';
  try { await 만들기(새DB()).api._loadScope(mom, Object.assign({}, mom)); } catch (e) { 없음 = e.message; }
  재기('자녀 줄이 없으면 NO-CHILD-ROWS(옛 길로)', 없음 === 'NO-CHILD-ROWS', 없음);

  console.log('\n── ⑧ 읽기가 거절되면');
  const t4 = 만들기(새DB(), /submissions/);
  t4.api.setUser(amy);
  let 거절 = '';
  try { await t4.api._loadScope(amy, amy); } catch (e) { 거절 = String(e.message); }
  재기('던진다(들여보내지 않는다)', /permission/.test(거절), 거절);
  재기('fbReady 가 안 선다', t4.window.fbReady !== true);
  const t5 = 만들기(새DB(), /homeworkSets\/AU_y5-A_2026_m10_w1$/);
  t5.api.setUser(amy);
  let 거절2 = '';
  try { await t5.api._loadScope(amy, amy); } catch (e) { 거절2 = String(e.message); }
  재기('⛔ 반 칸 하나만 거절돼도 던진다(공통으로 내려가지 않는다)', /permission/.test(거절2), 거절2);

  console.log('\n── ⑨ 문지기가 도는 길 위에 있는가');
  const 쓰기 = 떼기('function fbWrite(updates, onSuccess) {', 'window.FB_REF.update(updates)');
  재기('fbWrite 가 서버에 보내기 전에 _scopeUnreadWrites 를 부르고, 걸리면 멈춘다',
       /const _안읽은칸 = _scopeUnreadWrites\(updates\);\s*\n\s*if \(_안읽은칸\.length\) \{[\s\S]{0,400}?return;\s*\n\s*\}/.test(쓰기));
  재기('⛔ 걸린 것을 다시 보내기 줄에 넣지 않는다', !/_안읽은칸[\s\S]{0,400}_addToRetryQueue/.test(쓰기.slice(쓰기.indexOf('_안읽은칸'), 쓰기.indexOf('_안읽은칸') + 500)));
  const 공책 = 함수('fbSetUsers');
  재기('fbSetUsers 는 정본 깃발 없이는 안 쓴다', /if \(!window\._usersCanonical\) \{[\s\S]{0,300}?return;\s*\n\s*\}/.test(공책) && 공책.indexOf('_usersCanonical') < 공책.indexOf('fbWrite('));
  재기('지난 주 열기는 학생·학부모일 때 본인 몫 받기로 간다', /if \(window\._scope\) \{ await _scopeLoadPeriod\(p\); return; \}/.test(함수('_ensurePeriodLoaded')));

  console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
  process.exit(실패 ? 1 : 0);
})().catch(e => { console.log('  ⛔ 터졌다: ' + (e && e.stack || e)); console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + (실패 + 1)); process.exit(1); });
