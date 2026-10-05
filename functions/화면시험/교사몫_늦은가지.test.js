// 교사 몫 — 가지가 따로 늦게 와도 서랍에 들어가는가 (2026-10-05 밤 점검 재현)
//
//   옛 고침 전: lastModified 가 먼저 와 서랍 시각을 올리면, 뒤에 온 숙제 내용(2분 뒤 찾은 새 칸 ·
//   300ms 넘게 늦은 칸)은 「시각이 같다」며 버려졌다. ⇒ 이제 바뀐 가지만 꽂는다(_leanPatch).
//   실제 코드 조각(_leanChanged ~ _leanPoll)을 떼어 가짜 DB 로 돌린다.
'use strict';
const fs = require('fs');
const html = fs.readFileSync('E:/aa0/hp/index.html', 'utf8');
let 통과 = 0, 실패 = 0;
function 재기(이름, 참, 덧) { if (참) { 통과++; console.log('  ✅ ' + 이름); } else { 실패++; console.log('  ⛔ ' + 이름 + (덧 ? '\n       ' + 덧 : '')); } }
const i = html.indexOf('    const _leanChanged = (path) => {');
const j = html.indexOf('    // 돌려주는 값: 모은 자료 | null', i);
if (i < 0 || j < 0) throw new Error('조각을 못 찾음');
const 조각 = html.slice(i, j);

// ── 가짜 DB(경로별 값 + 구독) ──
function 가짜DB(초기) {
  const 값 = JSON.parse(JSON.stringify(초기));
  const 구독 = [];
  const 읽기 = p => p.split('/').reduce((o, k) => (o == null ? undefined : o[k]), 값);
  const ref = (p) => ({
    child: c => ref(p ? p + '/' + c : c),
    on: (ev, cb) => { 구독.push({ p, cb }); setTimeout(() => cb({ val: () => { const v = 읽기(p); return v === undefined ? null : JSON.parse(JSON.stringify(v)); } }), 0); return cb; },
    off: (ev, cb) => { const n = 구독.findIndex(s => s.cb === cb); if (n >= 0) 구독.splice(n, 1); },
  });
  const 쓰기 = (p, v) => {
    const ks = p.split('/'); let o = 값;
    for (let n = 0; n < ks.length - 1; n++) o = o[ks[n]] = o[ks[n]] || {};
    if (v == null) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = v;
    for (const s of 구독) if (p === s.p || p.startsWith(s.p + '/')) { const w = 읽기(s.p); s.cb({ val: () => (w === undefined ? null : JSON.parse(JSON.stringify(w))) }); }
  };
  return { 값, ref, 쓰기, 이름들: p => Object.keys(읽기(p) || {}) };
}
const 잠깐 = ms => new Promise(r => setTimeout(r, ms));

async function 판(이름, 몸) {
  const db = 가짜DB({ lastModified: 1, users: [{ id: 't', role: 'teacher' }], submissions: {},
    homeworkSets: { AU_y8_2026_m10_w1: { sets: [{ title: '옛' }] } } });
  let 서랍 = null;
  const window = { fbReady: true, FB_REF: db.ref(''), _teacherLean: null };
  const env = {
    window, setTimeout, clearTimeout, console,
    _rawLocalStore: () => 서랍,
    _persistLocalStore: d => { 서랍 = JSON.stringify(d); return true; },
    _noteAllHomeworkKeys: () => {},
    _recentPeriodKeySet: () => new Set(['2026_m10_w1', '2026_m10_w2', '2026_m10_w3', '2026_m10_w4']),
    getTodayPeriod: () => ({ year: 2026, month: 10, week: 2 }),
    _periodCanon: c => `${c.year}_m${String(c.month).padStart(2, '0')}_w${c.week}`,
    _teacherHwWanted: (k, keep) => keep.has((/_(\d{4})_m(\d{2})_w(\d+)/.exec(k) || []).slice(1).join('_').replace(/^(\d{4})_(\d{2})_/, '$1_m$2_w')),
    _dbShallowKeys: async p => db.이름들(p),
  };
  const 이름표 = Object.keys(env);
  const 만들 = new Function(...이름표, 'let _lean = null;\n' + 조각 +
    '\nreturn { set: L => { _lean = L; window._teacherLean = L; }, _leanTop, _leanHw, _leanPoll, get: () => _lean };');
  const 안 = 만들(...이름표.map(k => env[k]));
  const L = { data: { homeworkSets: {} }, listeners: [], topOn: new Set(), hwOn: new Set(), dirty: new Set(), poll: null, tick: null };
  안.set(L);
  await Promise.all(['lastModified', 'users', 'submissions'].map(k => 안._leanTop(L, k)));
  await 안._leanHw(L, 'AU_y8_2026_m10_w1');
  서랍 = JSON.stringify(L.data);                         // 처음 읽기(_firstData 가 하는 일)
  await 몸({ db, L, 안, 서랍: () => JSON.parse(서랍) });
  console.log('  (' + 이름 + ')');
}

(async () => {
  console.log('── ① 새 칸: 시각 먼저 → 2분 뒤 이름 목록으로 새 칸');
  await 판('새 칸', async ({ db, L, 안, 서랍 }) => {
    db.쓰기('homeworkSets/AU_y6_2026_m10_w3', { sets: [{ title: '새 칸' }] });
    db.쓰기('lastModified', 2);
    await 잠깐(400);
    재기('시각은 서랍에 들어감', 서랍().lastModified === 2);
    await 안._leanPoll(L);
    await 잠깐(400);
    재기('수신 메모리에 새 칸', !!L.data.homeworkSets.AU_y6_2026_m10_w3);
    재기('서랍에도 새 칸', !!(서랍().homeworkSets || {}).AU_y6_2026_m10_w3, JSON.stringify(Object.keys(서랍().homeworkSets || {})));
  });

  console.log('\n── ② 있는 칸 수정: 시각 먼저 → 300ms 넘게 뒤에 내용');
  await 판('늦은 내용', async ({ db, 서랍 }) => {
    db.쓰기('lastModified', 3);
    await 잠깐(400);
    db.쓰기('homeworkSets/AU_y8_2026_m10_w1/sets', [{ title: '고침' }]);
    await 잠깐(400);
    재기('서랍에 고친 내용', 서랍().homeworkSets.AU_y8_2026_m10_w1.sets[0].title === '고침', JSON.stringify(서랍().homeworkSets.AU_y8_2026_m10_w1));
  });

  console.log('\n── ③ 시각과 내용이 함께(대조)');
  await 판('함께', async ({ db, 서랍 }) => {
    db.쓰기('homeworkSets/AU_y8_2026_m10_w1/sets', [{ title: '함께' }]);
    db.쓰기('lastModified', 4);
    await 잠깐(400);
    재기('서랍에 고친 내용', 서랍().homeworkSets.AU_y8_2026_m10_w1.sets[0].title === '함께');
  });

  console.log('\n── ④ 바뀌지 않은 가지는 그대로 · 지워진 칸은 지운다');
  await 판('꽂기만', async ({ db, 서랍 }) => {
    const 전 = 서랍();
    db.쓰기('submissions/amy_2026_m10_w2_s0', { answers: { q0: 'B' } });
    await 잠깐(400);
    const 후 = 서랍();
    재기('새 제출 들어감', !!후.submissions.amy_2026_m10_w2_s0);
    재기('명단·숙제 칸은 그대로', JSON.stringify(후.users) === JSON.stringify(전.users) && JSON.stringify(후.homeworkSets) === JSON.stringify(전.homeworkSets));
    db.쓰기('homeworkSets/AU_y8_2026_m10_w1', null);
    await 잠깐(400);
    재기('서버에서 지운 칸은 서랍에서도 지움', !('AU_y8_2026_m10_w1' in (서랍().homeworkSets || {})));
  });

  console.log('\n── 셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
  process.exit(실패 ? 1 : 0);
})().catch(e => { console.log('  ⛔ 터짐: ' + (e && e.stack || e)); console.log('\n── 셈 — 통과 ' + 통과 + ' · 실패 ' + (실패 + 1)); process.exit(1); });
