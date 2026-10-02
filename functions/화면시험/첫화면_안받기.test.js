// 첫 화면 — **소개 화면에서는 DB 를 안 연다** (RTDB 요금 묶음 2 · 2026-10-02)
//
// 9월 요금 AU$54 의 거의 전부가 RTDB 내려받기(49GB)였다. 페이지를 열기만 해도
// 익명 로그인 → 앱 뿌리(10-02 실측 15MB) 전체 once + on 구독이 돌았다.
//
// 이 시험이 지키는 것
//   ① 페이지를 열 때(초기화 즉시 실행) 익명 로그인·구독·읽기가 0번이다
//   ② _dbStart() 는 몇 번 불려도 한 번만 돈다(연타·창 여닫기)
//   ③ _dbStart() 가 돌면 지금과 같은 일(익명 로그인 → 뿌리 구독·읽기 → 연결 감시)을 하고,
//      처음 읽기가 끝나야 끝난다(로그인이 서랍을 보기 전에 기다린다)
//   ④ 로그인은 _dbStart 를 기다리고 연타를 막는다 · 로그인 창을 열면 미리 시작한다
//   ⑤ 잠긴 칸 구독은 페이지 열 때가 아니라 교사 인증 뒤다 · 다시 불러도 겹치지 않는다
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
  return html.slice(i, j + 끝표.length);
}
const 쉼 = () => new Promise(r => setImmediate(r));

(async () => {
  const 소스 = 떼기('(function initFirebase() {', '\n})();');

  const 일 = [];
  let 처음읽기 = null;
  const ref = (p) => ({
    path: p,
    on: (ev, cb) => { 일.push('on ' + p); return cb; },
    once: (ev, ok) => { 일.push('once ' + p); 처음읽기 = ok; },
    off: () => 일.push('off ' + p),
    child: () => ref(p + '/?'),
  });
  const firebase = {
    initializeApp: () => 일.push('initializeApp'),
    database: () => ({ ref: (p) => { 일.push('ref ' + p); return ref(p); } }),
    auth: () => ({ signInAnonymously: () => { 일.push('anon'); return Promise.resolve({ user: { uid: 'anon1' } }); } }),
  };
  const 덮개 = { style: { display: 'flex' } };
  const document = { getElementById: (id) => id === 'loadingOverlay' ? 덮개 : null };
  const window = {};
  let 서랍확인 = 0;
  const 이름들 = ['firebase', 'window', 'document', '_EMU', '_EMU_CONFIG', 'firebaseConfig', '_emuConnect',
    'ensureStore', '_rawLocalStore', '_noteAllHomeworkKeys', '_storeLoadStateOf', '_persistLocalStore',
    'loadTaxonomy', '_flushRetryQueue', '_weaknessFlush', 'currentUser', '_localMirror', '_mirrorJson',
    'renderStudent', '_lastFbWriteTs', 'console', 'setTimeout', 'clearTimeout', '_잠긴칸지켜보기'];
  const 값들 = [firebase, window, document, false, {}, {}, () => {},
    () => { 서랍확인++; return Promise.resolve(); }, () => null, () => {}, () => 'ok', () => {},
    () => 일.push('taxonomy'), () => { 일.push('retry'); return Promise.resolve(); }, () => 일.push('weakness'),
    null, (x) => x, (x) => JSON.stringify(x), () => {}, 0,
    { log() {}, warn() {}, info() {}, error() {} }, () => 0, () => {}, () => 일.push('lockwatch')];
  new Function(...이름들, 소스)(...값들);

  console.log('── ① 페이지를 열 때');
  재기('익명 로그인 0번', !일.includes('anon'), 일.join(' | '));
  재기('구독(on)·읽기(once) 0번', !일.some(x => /^(on|once) /.test(x)), 일.join(' | '));
  재기('DB 주소(ref)도 안 만든다 — 만들기만 해도 SDK 가 연결을 연다', !일.some(x => /^ref /.test(x)), 일.join(' | '));
  재기('FB_REF 가 아직 비어 있다', window.FB_REF === null);
  재기('잠긴 칸 구독 0번', !일.includes('lockwatch') && !일.includes('on sol_v4/ops/lock'), 일.join(' | '));
  재기('로딩 덮개를 바로 걷는다(기다릴 것이 없다)', 덮개.style.display === 'none');
  재기('_dbStart 가 있다', typeof window._dbStart === 'function');

  console.log('\n── ② 한 번만');
  const a = window._dbStart(), b = window._dbStart(), c = window._dbStart();
  await 쉼(); await 쉼();
  재기('세 번 불러도 같은 약속', a === b && b === c);
  재기('FB_REF 를 이때 만든다', window.FB_REF && window.FB_REF.path === 'solomon_hw_v3');
  재기('익명 로그인 1번', 일.filter(x => x === 'anon').length === 1, 일.join(' | '));
  재기('연결 감시', 일.includes('on .info/connected'));
  // [묶음 3] _dbStart 는 익명 인증만 — 누가 들어오는지 모르니 자료는 안 받는다
  재기('⛔ 뿌리 구독·읽기 0번(묶음 3)', !일.includes('on solomon_hw_v3') && !일.includes('once solomon_hw_v3'), 일.join(' | '));

  console.log('\n── ③ 교사 전체 읽기(_loadFull) — 지금과 같은 일을 하고, 처음 읽기가 끝나야 끝난다');
  const f1 = window._loadFull(), f2 = window._loadFull();
  재기('두 번 불러도 같은 약속', f1 === f2);
  재기('뿌리 구독 1 · 읽기 1', 일.filter(x => x === 'on solomon_hw_v3').length === 1 && 일.filter(x => x === 'once solomon_hw_v3').length === 1, 일.join(' | '));
  let 끝남 = false; f1.then(() => { 끝남 = true; });
  await 쉼();
  재기('처음 읽기 전에는 안 끝난다', 끝남 === false);
  처음읽기({ val: () => ({ users: [], homeworkSets: {} }) });
  await 쉼(); await 쉼(); await 쉼();
  재기('처음 읽기 뒤에 끝난다', 끝남 === true);
  재기('fbReady 가 참', window.fbReady === true);
  재기('공책 정본 깃발(_usersCanonical)이 선다', window._usersCanonical === true);
  재기('서랍 확인(ensureStore) 1번', 서랍확인 === 1);
  재기('분류·재시도·약점 줄이 돈다', ['taxonomy', 'retry', 'weakness'].every(x => 일.includes(x)), 일.join(' | '));
  const 앞 = 일.length;
  await window._loadFull();
  재기('이미 받았으면 다시 받지 않는다', 일.slice(앞).every(x => !/^(on|once) solomon_hw_v3$/.test(x)), 일.slice(앞).join(' | '));

  console.log('\n── ③-2 로그아웃(_resetDataState) — 구독을 떼고, 늦은 응답은 버린다');
  window._resetDataState();
  재기('뿌리 구독을 뗀다', 일.includes('off solomon_hw_v3'));
  재기('fbReady · 정본 깃발이 내려간다', window.fbReady === false && window._usersCanonical === false);
  window._loadFull();
  const 늦은 = 처음읽기;
  window._resetDataState();   // 응답이 오기 전에 또 로그아웃
  늦은({ val: () => ({ users: [{ id: 'x' }], homeworkSets: {} }) });
  await 쉼();
  재기('⛔ 로그아웃 뒤에 온 응답은 fbReady 를 세우지 않는다', window.fbReady === false && window._usersCanonical === false);

  console.log('\n── ④ 로그인');
  const 로그인 = 떼기('async function doLogin() {', '\n}\n');
  재기('연타를 막는다(_loginBusy)', /if \(_loginBusy\) return;/.test(로그인) && /finally \{ _loginBusy = false; \}/.test(로그인));
  const 안쪽 = 떼기('async function _doLoginInner() {', 'const store = getStore();');
  재기('서랍을 보기 전에 _dbStart 를 기다린다', /await window\._dbStart\(\)/.test(안쪽));
  const 창 = 떼기('function openLoginModal() {', '\n  }\n');
  재기('로그인 창을 열면 미리 시작한다', /window\._dbStart\(\)/.test(창));
  // [묶음 3] 서버 프로필이 먼저 · 학생·학부모는 본인 몫(_loadScope) · 못 받으면 안 들여보낸다
  재기('서버 프로필로 들어온다(자녀 줄은 떼어 쥔다)', /loginProfile = p;\s*\n\s*user = Object\.assign\(\{\}, p\);\s*\n\s*delete user\.children;/.test(html));
  재기('학생·학부모는 _loadScope 를 기다린다(25초 끊기)', /_loadScope\(user, loginProfile\),\s*\n\s*new Promise\(\(_, rej\) => setTimeout\(\(\) => rej\(new Error\('SCOPE-TIMEOUT'\)\), 25000\)\)/.test(html));
  재기('못 받으면 「자료를 받지 못했습니다」로 멈춘다', /'지금 서버에서 자료를 받지 못했습니다\. 잠시 뒤 다시 시도해 주세요\.';\s*\n\s*document\.getElementById\('loginError'\)\.style\.display = 'block';\s*\n\s*return;/.test(html));
  const 교사길 = 떼기('await elevateToOperatorAuth(user.id, pw);', 'renderTeacher();');
  재기('교사는 원장 인증 뒤에 _loadFull 을 기다린다', /await window\._loadFull\(\);/.test(교사길));
  재기('로그아웃은 받기 상태를 비운다', /function doLogout\(\) \{[\s\S]{0,400}window\._resetDataState\(\)/.test(html));

  console.log('\n── ⑤ 잠긴 칸 구독');
  const 교사 = 떼기('await elevateToOperatorAuth(user.id, pw);', "btnBackupDownload').style.display = '';");
  재기('교사 인증 바로 뒤에 지켜본다', /_잠긴칸지켜보기\(\)/.test(교사));
  재기('초기화 즉시 실행 안에는 없다', !/_잠긴칸지켜보기\(\)/.test(소스));
  const 지켜 = 떼기('function _잠긴칸지켜보기() {', '\n}\n');
  재기('다시 불러도 겹치지 않게 먼저 뗀다', /ref\('sol_v4\/ops\/lock'\)\.off\('value'\);\s*\n\s*firebase\.database\(\)\.ref\('sol_v4\/ops\/lock'\)\.on\(/.test(지켜));

  console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
  process.exit(실패 ? 1 : 0);
})().catch(e => { console.log('  ⛔ 터졌다: ' + (e && e.stack || e)); console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + (실패 + 1)); process.exit(1); });
