// 처음 읽기 — **원격 뿌리에 쓰지 않는다 · 왜 비었는지 가른다.**
//
// ⛔ [1단계 · 2026-10-01] `initStore()` 가 빈 자료를 만들고 `FB_REF.set(d)` 로
//    solomon_hw_v3 **뿌리 전체를 덮으려** 했다. 지금은 규칙(.write:false)이 막아 주지만,
//    규칙 하나에 기대는 지뢰다(5/8·5/15 사고와 같은 모양). 게다가 「서버가 비었다」와
//    「인터넷이 끊겼다」·「권한이 막혔다」·「이 브라우저 첫 접속」이 화면에서 구별되지 않았다.
//
// 이 시험이 지키는 것
//   ① initStore 는 서버에 아무것도 안 쓴다(set·update·fbWrite 0번)
//   ② 처음 읽기 결과를 넷으로 가른다 — first(첫 접속) · empty(서버 자료 없음) · network · denied
//   ③ 처음 읽기가 끝나면 제출 재시도 → 약점 줄 비우기 순서로 부른다

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

(async () => {
  console.log('── ① initStore 는 서버에 안 쓴다');
  const 소스 = 떼기('async function initStore() {', '\n// period = { year, month, week }');
  재기('소스에 FB_REF.set 이 없다', !/FB_REF\s*\.\s*set\s*\(/.test(소스), 소스.slice(0, 400));
  const 쓴것 = [];
  const 가짜REF = { set: (v) => 쓴것.push(['set', v]), update: (v) => 쓴것.push(['update', v]), child: () => 가짜REF };
  let 저장 = null;
  const 상태들 = { first: 1 };
  const initStore = new Function('window', 'saveStore', 'fbWrite', 'console', 소스 + '\n; return initStore;')(
    { fbReady: true, FB_REF: 가짜REF, _storeLoadState: 'empty' }, (d) => { 저장 = d; return true; },
    (u) => 쓴것.push(['fbWrite', u]), { log() {}, warn() {}, info() {}, error() {} });
  const d = await initStore();
  재기('서버 쓰기 0번', 쓴것.length === 0, JSON.stringify(쓴것));
  재기('이 브라우저에는 빈 자료를 둔다(화면이 뜬다)', 저장 && Array.isArray(저장.users) && d === 저장);

  console.log('\n── ② 처음 읽기 결과를 가른다');
  const 가르기 = new Function(떼기('function _storeLoadStateOf(', '\n}\n') + '\n}\n; return _storeLoadStateOf;')();
  재기('서버 자료 있음 + 이 브라우저 빈 서랍 → first',
       가르기({ ok: true, fbData: { users: [] }, hadLocal: false }) === 'first');
  재기('서버 자료 있음 + 서랍 있음 → ok', 가르기({ ok: true, fbData: { users: [] }, hadLocal: true }) === 'ok');
  재기('서버가 비었음 → empty', 가르기({ ok: true, fbData: null, hadLocal: false }) === 'empty');
  재기('권한 거부 → denied', 가르기({ ok: false, err: { code: 'PERMISSION_DENIED', message: 'permission_denied at /' } }) === 'denied');
  재기('그 밖의 실패 → network', 가르기({ ok: false, err: new Error('Client is offline') }) === 'network');
  재기('익명 로그인 실패 → network(인증 길)', 가르기({ ok: false, err: { code: 'auth/network-request-failed' } }) === 'network');

  console.log('\n── ③ 처음 읽기 뒤 — 제출 재시도 → 약점 줄');
  const 읽기소스 = 떼기('const loadInitialData = () => {', '\n    // [2026-05-12] 익명 인증을 먼저 완료한 다음 DB 작업 시작');
  재기('_storeLoadStateOf 로 상태를 적는다', /window\._storeLoadState\s*=\s*_storeLoadStateOf\(/.test(읽기소스));
  재기('실패 쪽에서도 상태를 적는다', (읽기소스.match(/_storeLoadState\s*=/g) || []).length >= 2);
  재기('제출 재시도가 끝난 뒤 약점 줄을 비운다', /_flushRetryQueue\(\)\s*\.then\(\s*\(\)\s*=>\s*_weaknessFlush\(\)\s*\)/.test(읽기소스), '');
  재기('initStore 를 부르는 곳(ensureStore)은 서버가 「비었다」고 확인된 때만',
       /_storeLoadState\s*!==\s*'empty'/.test(떼기('async function ensureStore() {', '\n  // [Security 2026-05] 옛 store.claudeApiKey')));

  console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
  process.exit(실패 ? 1 : 0);
})().catch(e => { console.log('  ⛔ 터졌다: ' + (e && e.stack || e)); console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + (실패 + 1)); process.exit(1); });
