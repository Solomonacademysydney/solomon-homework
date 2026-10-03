// 백업 — 로그인 자동 백업을 끄고, 옛 백업 묶음은 **이름만** 받는다(정비 §4 · 2026-10-03).
//
// ⛔ 예전: 원장 로그인마다 ① 비밀키 정리(브라우저마다 한 번)가 묶음 전체(~400MB)를 받고
//    ② 자동 백업이 뿌리 전체 + 최근 10벌 + 묶음 전체를 받고 ③ 설정 탭의 백업 목록도 묶음 전체를 받았다.
//    서버 일일 백업이 따로 돌고 있음을 확인했다(docs/rtdb-backup-server.md).
//
// 이 시험이 지키는 것
//   ① 로그인 길에서 autoBackupToFirebase() 를 부르지 않는다
//   ② _backupKeysShallow — shallow 로 이름만 · 필터 안 섞음 · 빈 묶음 [] 과 실패 null 을 가른다 · 늦은 답은 버린다
//   ③ cleanupLegacyBackupKeys — 묶음 통째 읽기 없음 · 키 있는 칸의 그 값만 지움 · 하나라도 못 보면 깃발 안 씀
//   ④ loadBackupList — 묶음 통째 읽기 없음 · 숫자 없음 「-」· 못 읽음 「확인 실패」· 이름 실패와 빈 목록이 다른 글

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
const 조용 = { log() {}, warn() {}, info() {}, error() {} };

// 가짜 백업 묶음: 정상 3 · 의심 1 · pre_recovery 1 — k2 와 suspect 에 옛 키
const 묶음 = {
  '2026-10-01_10-00': { studentCount: 28, hwSetCount: 219, data: { x: 1 } },
  '2026-10-02_10-00': { studentCount: 28, hwSetCount: 220, data: { claudeApiKey: 'SECRET-A' } },
  '2026-10-03_10-00': { studentCount: 29, data: { x: 1 } },
  'pre_recovery_2026-05-08_16-36-06': { hwSetCount: 36, data: { x: 1 } },
  'suspect_2026-09-30_10-00': { studentCount: 27, hwSetCount: 200, data: { claudeApiKey: 'SECRET-B' } },
};
function 가짜DB(opt) {
  opt = opt || {};
  const 기록 = { 통째읽기: 0, 값읽기: [], 고침: [] };
  const 값 = (path) => path.split('/').reduce((o, k) => (o == null ? undefined : o[k]), 묶음);
  const 참조 = (path) => ({
    child: (c) => 참조(path ? path + '/' + c : c),
    orderByKey: () => ({ once: async () => { 기록.통째읽기++; return { forEach() {}, val: () => 묶음 }; }, limitToLast: () => ({ once: async () => { 기록.통째읽기++; return { val: () => 묶음 }; } }) }),
    once: async () => {
      if (!path) { 기록.통째읽기++; return { val: () => 묶음 }; }
      기록.값읽기.push(path);
      if (opt.값실패 && path.includes(opt.값실패)) throw new Error('permission_denied');
      const v = 값(path);
      return { exists: () => v !== undefined, val: () => (v === undefined ? null : v) };
    },
    update: async (u) => { 기록.고침.push(u); },
  });
  return { 기록, getBackupRef: () => 참조('') };
}
function 가짜fetch(응답) {
  const 부른 = [];
  const f = async (url, o) => { 부른.push(url); return 응답(url, o); };
  f.부른 = 부른;
  return f;
}
const 이름응답 = (v, status) => async () => ({ ok: (status || 200) === 200, status: status || 200, json: async () => v });

(async () => {
  console.log('── ① 로그인 길에서 자동 백업을 부르지 않는다');
  const 로그인길 = 떼기('await cleanupLegacyBackupKeys();', "else if (user.role==='parent')");
  재기('autoBackupToFirebase() 호출이 주석으로만 남았다',
       !/^\s*autoBackupToFirebase\(\)/m.test(로그인길) && /\/\/\s*autoBackupToFirebase\(\)/.test(로그인길), 로그인길);

  const 도구소스 = 떼기('async function _backupKeysShallow() {', '\n// ── 옛 평문 API 키 1회 정리');
  const 짓기 = (환경) => new Function('firebase', 'currentUser', 'firebaseConfig', '_EMU', 'BACKUP_REF_PATH', 'getBackupRef', 'fetch', 'AbortController', 'setTimeout', 'clearTimeout', 'console', 'localStorage',
    도구소스 + '\n; return { _backupKeysShallow, _backupField, _한번에 };')(
    환경.firebase, 환경.currentUser, { databaseURL: 'https://db.example' }, false, 'solomon_backups', 환경.getBackupRef, 환경.fetch,
    AbortController, setTimeout, clearTimeout, 조용, 환경.localStorage);

  console.log('\n── ② 이름만 받기');
  const 로그인됨 = { auth: () => ({ currentUser: { getIdToken: async () => 'TOKEN' } }) };
  {
    const f = 가짜fetch(이름응답({ b: true, a: true, 'suspect_x': true }));
    const t = 짓기({ firebase: 로그인됨, currentUser: { id: 'boss' }, fetch: f, getBackupRef: 가짜DB().getBackupRef });
    const keys = await t._backupKeysShallow();
    재기('이름을 정렬해 돌려준다', JSON.stringify(keys) === '["a","b","suspect_x"]', JSON.stringify(keys));
    재기('shallow=true · 필터(orderBy·limit) 없음 · 묶음 경로', /solomon_backups\.json\?shallow=true&auth=TOKEN$/.test(f.부른[0]) && !/orderBy|limitTo|startAt/.test(f.부른[0]), f.부른[0]);
  }
  {
    const t = 짓기({ firebase: 로그인됨, currentUser: { id: 'boss' }, fetch: 가짜fetch(이름응답(null)), getBackupRef: 가짜DB().getBackupRef });
    재기('빈 묶음 → [] (「없음」)', JSON.stringify(await t._backupKeysShallow()) === '[]');
  }
  {
    const t = 짓기({ firebase: 로그인됨, currentUser: { id: 'boss' }, fetch: 가짜fetch(이름응답({ error: 'x' }, 401)), getBackupRef: 가짜DB().getBackupRef });
    재기('권한 거부 → null (「못 받음」 · 빈 목록과 다르다)', (await t._backupKeysShallow()) === null);
  }
  {
    const t = 짓기({ firebase: 로그인됨, currentUser: { id: 'boss' }, fetch: async () => { throw Object.assign(new Error('abort'), { name: 'AbortError' }); }, getBackupRef: 가짜DB().getBackupRef });
    재기('시간 초과·끊김 → null', (await t._backupKeysShallow()) === null);
  }
  {
    const 사람 = { id: 'boss' };
    const 환경 = { firebase: 로그인됨, currentUser: 사람, getBackupRef: 가짜DB().getBackupRef };
    // 응답이 오는 사이 다른 사람으로 바뀐다 — 함수 안의 currentUser 는 짓기 때 넘긴 값을 보므로, 바꾸는 길을 열어 둔다
    const 소스 = 도구소스.replace(/currentUser/g, '사람판.v');
    const 사람판 = { v: 사람 };
    const t = new Function('firebase', '사람판', 'firebaseConfig', '_EMU', 'BACKUP_REF_PATH', 'getBackupRef', 'fetch', 'AbortController', 'setTimeout', 'clearTimeout', 'console',
      소스 + '\n; return { _backupKeysShallow };')(환경.firebase, 사람판, { databaseURL: 'https://db.example' }, false, 'solomon_backups', 환경.getBackupRef,
      async () => { 사람판.v = { id: 'kid' }; return { ok: true, status: 200, json: async () => ({ a: true }) }; }, AbortController, setTimeout, clearTimeout, 조용);
    재기('로그아웃·계정 바꾸기 뒤 늦게 온 답은 버린다(null)', (await t._backupKeysShallow()) === null);
  }
  {
    const t = 짓기({ firebase: { auth: () => ({ currentUser: null }) }, currentUser: { id: 'boss' }, fetch: 가짜fetch(이름응답({ a: true })), getBackupRef: 가짜DB().getBackupRef });
    재기('파이어베이스 로그인이 없으면 null', (await t._backupKeysShallow()) === null);
  }

  console.log('\n── ③ 옛 비밀키 정리');
  const 정리소스 = 떼기('async function cleanupLegacyBackupKeys() {', '\n// ── 1. Firebase 자동 백업');
  재기('소스에 묶음 통째 읽기(getBackupRef().once)가 없다', !/getBackupRef\(\)\s*\.\s*once\(/.test(정리소스));
  async function 정리돌리기(opt) {
    const db = 가짜DB(opt);
    const 깃발 = {};
    const ls = { getItem: (k) => 깃발[k] || null, setItem: (k, v) => { 깃발[k] = v; } };
    const 환경 = { firebase: 로그인됨, currentUser: { id: 'boss', role: 'teacher' }, getBackupRef: db.getBackupRef, localStorage: ls,
      fetch: opt.이름실패 ? 가짜fetch(이름응답(null, 500)) : 가짜fetch(이름응답(Object.fromEntries(Object.keys(묶음).map(k => [k, true])))) };
    const 도구 = 짓기(환경);
    const 로그 = [];
    const 말 = { log: (...a) => 로그.push(a.join(' ')), warn: (...a) => 로그.push(a.join(' ')), error: (...a) => 로그.push(a.join(' ')), info() {} };
    const f = new Function('currentUser', 'localStorage', 'getBackupRef', '_backupKeysShallow', '_backupField', '_한번에', 'console', 정리소스 + '\n; return cleanupLegacyBackupKeys;')(
      환경.currentUser, ls, db.getBackupRef, 도구._backupKeysShallow, 도구._backupField, 도구._한번에, 말);
    await f();
    return { db, 깃발, 로그 };
  }
  {
    const r = await 정리돌리기({});
    재기('키 든 칸(정상·의심 하나씩)의 그 값만 지운다', JSON.stringify(r.db.기록.고침) === JSON.stringify([{ '2026-10-02_10-00/data/claudeApiKey': null, 'suspect_2026-09-30_10-00/data/claudeApiKey': null }]), JSON.stringify(r.db.기록.고침));
    재기('묶음 통째 읽기 0번 · 칸마다 값 하나씩(5칸)', r.db.기록.통째읽기 === 0 && r.db.기록.값읽기.length === 5, JSON.stringify(r.db.기록));
    재기('다 끝나면 깃발', r.깃발.backupKeyCleanup_v1_done === '1');
    재기('키 값이 로그에 안 나온다', !r.로그.join('\n').includes('SECRET'), r.로그.join(' | '));
  }
  {
    const r = await 정리돌리기({ 값실패: 'suspect_' });
    재기('한 칸이라도 못 보면 지우지도·깃발도 안 한다', r.db.기록.고침.length === 0 && !r.깃발.backupKeyCleanup_v1_done);
  }
  {
    const r = await 정리돌리기({ 이름실패: true });
    재기('이름을 못 받으면 깃발 안 쓰고 끝(통째 읽기로 돌아가지 않는다)', !r.깃발.backupKeyCleanup_v1_done && r.db.기록.통째읽기 === 0);
  }

  console.log('\n── ④ 백업 목록 화면');
  const 목록소스 = 떼기('async function loadBackupList() {', '\nasync function restoreBackup(');
  재기('소스에 묶음 통째 읽기(orderByKey().once)가 없다', !/orderByKey\(\)\s*\.\s*once\(/.test(목록소스));
  async function 목록돌리기(opt) {
    const db = 가짜DB(opt);
    const 상자 = { innerHTML: '', appendChild() {} };
    const document = { getElementById: (id) => (id === 'backupListContainer' ? 상자 : null), createElement: () => ({ style: {} }) };
    const 환경 = { firebase: 로그인됨, currentUser: { id: 'boss' }, getBackupRef: db.getBackupRef,
      fetch: opt.이름실패 ? 가짜fetch(이름응답(null, 500)) : 가짜fetch(이름응답(opt.빈 ? null : Object.fromEntries(Object.keys(묶음).map(k => [k, true])))) };
    const 도구 = 짓기(환경);
    const f = new Function('document', 'window', 'getBackupRef', '_backupKeysShallow', '_backupField', '_한번에', 목록소스 + '\n; return loadBackupList;')(
      document, { FB_REF: {} }, db.getBackupRef, 도구._backupKeysShallow, 도구._backupField, 도구._한번에);
    await f();
    return { html: 상자.innerHTML, db };
  }
  {
    const r = await 목록돌리기({});
    재기('숫자 있는 칸은 그대로(28명 · 219개)', r.html.includes('28명') && r.html.includes('219개'));
    재기('숫자 없는 옛 칸은 「-」', r.html.includes('-개') && r.html.includes('-명'));
    재기('최신이 위', r.html.indexOf('2026-10-03') < r.html.indexOf('2026-10-01'));
    재기('pre_recovery · suspect 칸도 목록에 보인다', r.html.includes('pre recovery') && r.html.includes('suspect'));
    재기('본문(data) 읽기 0 · 칸마다 숫자 둘만', r.db.기록.통째읽기 === 0 && r.db.기록.값읽기.every(p => /\/(studentCount|hwSetCount)$/.test(p)) && r.db.기록.값읽기.length === 10, JSON.stringify(r.db.기록.값읽기));
    재기('복구 단추는 그대로 restoreBackup(경고만 띄우는 함수)', r.html.includes("restoreBackup('2026-10-01_10-00')"));
  }
  {
    const r = await 목록돌리기({ 값실패: '2026-10-02_10-00/studentCount' });
    재기('숫자를 못 읽은 칸은 0 이 아니라 「확인 실패」', r.html.includes('확인 실패') && !r.html.includes('0명'));
  }
  {
    const r = await 목록돌리기({ 이름실패: true });
    재기('이름 실패 → 「불러오지 못했습니다」', r.html.includes('불러오지 못했습니다') && !r.html.includes('저장된 백업이 없습니다'));
  }
  {
    const r = await 목록돌리기({ 빈: true });
    재기('빈 묶음 → 「저장된 백업이 없습니다」', r.html.includes('저장된 백업이 없습니다'));
  }

  console.log('\n── restoreBackup 은 여전히 꺼져 있다');
  const 복구소스 = 떼기('async function restoreBackup(backupKey) {', '\n}\n');
  const 복구코드 = 복구소스.replace(/\/\/.*$/gm, '');   // 주석의 「FB_REF.set(...)」 설명은 빼고 본다
  재기('경고만 띄우고 쓰기 없음', /alert\(/.test(복구코드) && !/\.(set|update|remove)\(/.test(복구코드), 복구코드);

  console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
  process.exit(실패 ? 1 : 0);
})().catch(e => { console.log('  ⛔ 터졌다: ' + (e && e.stack || e)); console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + (실패 + 1)); process.exit(1); });
