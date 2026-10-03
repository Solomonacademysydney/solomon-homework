// 답 저장 — 칸 통째가 아니라 **바뀐 항목만** 쓴다(정비 §5 시범 · 2026-10-03).
//
// ⛔ 예전: 학생이 문항 하나를 고를 때마다(saveAnswer) 제출 칸 전체를 이 기기의 사본으로 덮었다 →
//    다른 탭·기기에서 낸 답과 제출이 지워질 수 있었다. 교사 카톡 저장(generateAndShowKakao)도
//    교사 사본으로 학생 칸 전체를 덮었다. 다시 보내기 줄은 글자 답(객체 아님)을 판단에서 **버렸다**.
//
// 이 시험이 지키는 것
//   ① saveAnswer 는 submissions/<key>/answers/<qid> 하나만 쓴다
//   ② 교사 카톡은 reportData/kakaoMsg·kakaoGeneratedAt 둘만 쓴다
//   ③ 다시 보내기 줄 — 항목 경로: 서버에 없으면 보냄 · 같으면 끝 · 제출된 칸의 답은 안 바꿈 · 다른 값이면 덮지 않고 「확인 필요」

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

(async () => {
  console.log('── ① saveAnswer — 답 하나만');
  {
    const 소스 = 떼기('function saveAnswer(qid, val) {', '\nfunction answerMC(');
    const 쓴것 = [];
    let 서랍 = { currentPeriod: { year: 2026, month: 10, week: 1 }, submissions: { K: { answers: { q1: 'A' }, submitted: false, reportData: { kakaoMsg: 'm' } } } };
    const f = new Function('prepSessionState', '_masterViewOnlyToast', 'getStore', 'saveStore', 'subKey', 'currentUser', 'studentPeriod', 'currentSetIdx', 'fbWrite', 'fbSetSubmission',
      소스 + '\n; return saveAnswer;')(() => 'ok', () => {}, () => 서랍, (s) => { 서랍 = s; }, () => 'K', { id: 'Amy05' }, null, 0,
      (u) => 쓴것.push(u), () => 쓴것.push('통째'));
    f('q2', 'C');
    재기('쓴 것은 answers/q2 하나', 쓴것.length === 1 && JSON.stringify(쓴것[0]) === JSON.stringify({ 'submissions/K/answers/q2': 'C' }), JSON.stringify(쓴것));
    재기('이 기기 사본에도 들어간다', 서랍.submissions.K.answers.q2 === 'C' && 서랍.submissions.K.answers.q1 === 'A');
    서랍.submissions.K.submitted = true; 쓴것.length = 0; f('q3', 'D');
    재기('제출된 칸에는 안 쓴다', 쓴것.length === 0);
  }

  console.log('\n── ② 교사 카톡 — 두 칸만');
  {
    const 소스 = 떼기('async function generateAndShowKakao(', '\n}\n');
    재기('fbSetSubmission(칸 통째) 호출이 없다', !/fbSetSubmission\(/.test(소스.replace(/\/\/.*$/gm, '')));
    재기('reportData/kakaoMsg · kakaoGeneratedAt 경로만 쓴다', /reportData\/kakaoMsg'\]/.test(소스) && /reportData\/kakaoGeneratedAt'\]/.test(소스));
  }

  console.log('\n── ③ 다시 보내기 줄 — 항목 경로');
  const 줄소스 = 떼기('const FB_RETRY_ITEM_PREFIX', '\nfunction _notifyStudentSaveFailure()') + 떼기('const FB_RETRY_CONFLICT_KEY', '\n// ── Firebase Granular Write Helpers');
  function 가짜저장소(처음) {
    const 저장소 = Object.assign({}, 처음 || {});
    return { 저장소, ls: {
      getItem: (k) => 저장소[k] ?? null, setItem: (k, v) => { 저장소[k] = String(v); }, removeItem: (k) => { delete 저장소[k]; },
      key: (i) => Object.keys(저장소)[i] ?? null, get length() { return Object.keys(저장소).length; } } };
  }
  function 줄짓기(서버, 저장, 소유) {
    const 쓴것 = [];
    const 값 = (p) => p.split('/').reduce((o, k) => (o == null ? null : o[k]), 서버);
    // 가짜 서버: 읽기·쓰기·트랜잭션(한 칸) — 쓴 것은 서버 값에도 반영한다(다음 읽기가 본다)
    const 놓기 = (p, v) => { const ks = p.split('/'); let o = 서버; for (const k of ks.slice(0, -1)) { if (o[k] == null || typeof o[k] !== 'object') o[k] = {}; o = o[k]; } if (v === null) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = JSON.parse(JSON.stringify(v)); };
    const FB_REF = {
      child: (p) => ({
        once: async () => { if (서버.__끊김) throw new Error('offline'); return { val: () => 값(p) ?? null }; },
        transaction: async (fn) => { if (서버.__끊김) throw new Error('offline'); const 새 = fn(값(p) ?? null); if (새 === undefined) return { committed: false }; 놓기(p, 새); 쓴것.push({ [p]: 새, __tx: true }); return { committed: true }; },
      }),
      update: async (u) => { if (서버.__끊김 || 서버.__쓰기실패) throw new Error('offline'); 쓴것.push(u); for (const [k, v] of Object.entries(u)) if (k !== 'lastModified') 놓기(k, v); },
    };
    const ns = new Function('window', 'localStorage', 'currentUser', '_isStudentOwnedSubmissionUpdate', '_retryDecision', '_clearStudentSaveFailure', 'showBackupToast', 'console', 'FB_RETRY_QUEUE_KEY', '_lastFbWriteTs', 'document',
      줄소스 + '\n; return { _flushRetryQueue, _addToRetryQueue, _retryItemKeys };')(
      { fbReady: true, FB_REF }, 저장.ls, { id: 'Amy05', role: 'student' }, 소유 || (() => true), () => ({ push: false }), () => {}, () => {}, 조용, 'solomon_fb_retry_queue', 0, { getElementById: () => null });
    return { ns, 쓴것 };
  }
  async function 돌리기(서버, 줄) {
    const 저장 = 가짜저장소({ solomon_fb_retry_queue: JSON.stringify(줄) });   // 옛 판(배열) 줄에서 시작 — 옮기기도 함께 잰다
    const { ns, 쓴것 } = 줄짓기(서버, 저장);
    await ns._flushRetryQueue();
    return { 쓴것, 저장소: 저장.저장소 };
  }
  const 지금 = Date.now();
  {
    const r = await 돌리기({ submissions: { K: { answers: { q1: 'A' } } } }, [{ updates: { 'submissions/K/answers/q2': 'C', lastModified: 1 }, queuedAt: 지금 }]);
    재기('서버에 없는 답 → 그 항목만 보낸다(예전엔 글자 답이라 버렸다)', r.쓴것.length === 1 && r.쓴것[0]['submissions/K/answers/q2'] === 'C' && Object.keys(r.쓴것[0]).length === 2, JSON.stringify(r.쓴것));
  }
  {
    const r = await 돌리기({ submissions: { K: { answers: { q2: 'C' } } } }, [{ updates: { 'submissions/K/answers/q2': 'C' }, queuedAt: 지금 }]);
    재기('같은 답 → 안 보냄', r.쓴것.length === 0);
  }
  {
    const r = await 돌리기({ submissions: { K: { answers: { q2: 'B' }, submitted: true } } }, [{ updates: { 'submissions/K/answers/q2': 'C' }, queuedAt: 지금 }]);
    재기('이미 제출된 칸의 답 → 안 바꾸고, 버리지도 않고 「확인 필요」로 남긴다(R1)', !r.쓴것.some(u => 'submissions/K/answers/q2' in u) && r.쓴것.some(u => Object.keys(u).some(k => k.startsWith('submissions/K/_conflicts/answers|q2|'))), JSON.stringify(r.쓴것));
  }
  {
    const r = await 돌리기({ submissions: { K: { answers: { q2: 'B' } } } }, [{ updates: { 'submissions/K/answers/q2': 'C' }, queuedAt: 지금 }]);
    const 기록 = JSON.parse(r.저장소.solomon_fb_retry_conflicts || '[]');
    const 답쓰기 = r.쓴것.filter(u => Object.keys(u).some(k => /\/answers\//.test(k)));
    const 확인칸열쇠 = (r.쓴것.map(u => Object.keys(u).find(k => k.startsWith('submissions/K/_conflicts/answers|q2|'))).find(Boolean)); const 확인칸 = 확인칸열쇠 && r.쓴것.find(u => 확인칸열쇠 in u)[확인칸열쇠];
    재기('서버에 다른 답 → 덮지 않고 「확인 필요」에 적는다(기기 + 그 칸 _conflicts)', 답쓰기.length === 0 && 기록.length === 1 && 기록[0].server === 'B' && 기록[0].mine === 'C'
         && 확인칸 && 확인칸.mine === 'C', JSON.stringify(r.쓴것));
  }
  {
    const r = await 돌리기({}, [{ updates: { 'submissions/K/answers/q1': 'A' }, queuedAt: 지금 }]);
    재기('칸 자체가 없을 때도 보낸다', r.쓴것.length === 1);
  }

  {
    const r = await 돌리기({ submissions: { K: { remediation: { currentRound: 0 } } } }, [{ updates: { 'submissions/K/remediation': { currentRound: 1 } }, queuedAt: 지금 }]);
    재기('답이 아닌 가지(보충학습)는 서버에 값이 있어도 보낸다', r.쓴것.length === 1 && r.쓴것[0]['submissions/K/remediation'].currentRound === 1);
  }

  {
    const r = await 돌리기({ submissions: { ts_A: { day1: { answers: { q0: { attempts: 1 } } } } } }, [{ updates: { 'submissions/ts_A/day1/answers/q0': { attempts: 2, correct: true } }, queuedAt: 지금 }]);
    재기('TS 문항 — 줄이 더 많이 시도했으면 보낸다', r.쓴것.length === 1);
    const r2 = await 돌리기({ submissions: { ts_A: { day1: { answers: { q0: { attempts: 3, correct: false } } } } } }, [{ updates: { 'submissions/ts_A/day1/answers/q0': { attempts: 2, correct: true } }, queuedAt: 지금 }]);
    재기('TS 문항 — 서버가 더 많이 시도했으면 안 덮고 「확인 필요」로 남긴다', !r2.쓴것.some(u => 'submissions/ts_A/day1/answers/q0' in u) && r2.쓴것.some(u => Object.keys(u).some(k => k.includes('/_conflicts/'))));
  }
  {
    const 소유 = 떼기('function _isStudentOwnedSubmissionUpdate(updates) {', '\n}\n') + '\n}';
    const f = (u, who) => new Function('currentUser', 소유 + '\n; return _isStudentOwnedSubmissionUpdate;')(who)(u);
    재기('TS 칸(ts_<sid>_…)도 다시 보내기 줄에 든다', f({ 'submissions/ts_Amy05_2026_m10_w1/day1/answers/q0': {} }, { id: 'Amy05', role: 'student' }));
    재기('남의 TS 칸은 안 든다', !f({ 'submissions/ts_Ben03_2026_m10_w1/day1/answers/q0': {} }, { id: 'Amy05', role: 'student' }));
  }
  {
    const 소스 = 떼기('function submitTSAnswer(qKey) {', '\nfunction useTSHint(');
    재기('TS 답은 그 문항 기록 하나만 쓴다', /\/answers\/' \+ qKey\]: JSON\.parse\(JSON\.stringify\(ansData\)\)/.test(소스) && !/fbSetTSProgress\(/.test(소스));
    const 끝소스 = 떼기('function completeTSDay() {', '\n}\n');
    재기('TS 하루 끝은 completed·completed_at 둘만', /\/completed'\]: true/.test(끝소스) && /\/completed_at'\]/.test(끝소스) && !/fbSetTSProgress\(/.test(끝소스));
    재기('fbSetTSProgress 를 부르는 곳이 없다', (html.match(/fbSetTSProgress\(/g) || []).length === 1);
  }

  console.log('\n── ③-2 줄 — 일 하나에 열쇠 하나 (T06·T08·T09·T10·T11)');
  {
    const 저장 = 가짜저장소();
    const { ns } = 줄짓기({}, 저장);
    for (let i = 0; i < 25; i++) ns._addToRetryQueue({ ['submissions/Amy05_K/answers/q' + i]: 'A' });
    재기('25개를 넣어도 하나도 안 버린다(예전 20개 제한)', ns._retryItemKeys().length === 25, ns._retryItemKeys().length);
  }
  {
    const 저장 = 가짜저장소({ solomon_fbq_1_a: JSON.stringify({ updates: { 'submissions/Amy05_K/answers/q1': 'A' }, queuedAt: 1 }) });
    const { ns, 쓴것 } = 줄짓기({}, 저장);
    await ns._flushRetryQueue();
    재기('하루 지난 일도 버리지 않고 보낸다(예전 15분 제한)', 쓴것.length === 1 && !('solomon_fbq_1_a' in 저장.저장소));
  }
  {
    const 저장 = 가짜저장소({
      solomon_fbq_1_a: JSON.stringify({ updates: { 'submissions/Ben03_K/answers/q1': 'B' }, queuedAt: 1 }),
      solomon_fbq_2_b: JSON.stringify({ updates: { 'submissions/Amy05_K/answers/q1': 'A' }, queuedAt: 2 }) });
    const 소유 = (u) => Object.keys(u).every(k => k.startsWith('submissions/Amy05_'));
    const { ns, 쓴것 } = 줄짓기({}, 저장, 소유);
    await ns._flushRetryQueue();
    재기('다른 아이(형제) 일은 보내지도 지우지도 않는다 · 내 것만 보낸다', 쓴것.length === 1 && 'solomon_fbq_1_a' in 저장.저장소 && !('solomon_fbq_2_b' in 저장.저장소), JSON.stringify(Object.keys(저장.저장소)));
  }
  {
    const 저장 = 가짜저장소({ solomon_fbq_1_a: JSON.stringify({ updates: { 'submissions/Amy05_K/answers/q1': 'A' }, queuedAt: 1 }) });
    const 서버 = {};
    const { ns } = 줄짓기(서버, 저장);
    // 비우는 도중(서버 읽기 사이)에 새 일이 들어온다
    const 옛 = 저장.ls.getItem;
    let 한번 = false;
    저장.ls.getItem = (k) => { if (!한번 && k === 'solomon_fbq_1_a') { 한번 = true; ns._addToRetryQueue({ 'submissions/Amy05_K/answers/q2': 'B' }); } return 옛(k); };
    await ns._flushRetryQueue();
    재기('비우는 도중 들어온 새 일은 남는다(예전엔 통째 덮어 지웠다)', ns._retryItemKeys().length === 1 && JSON.parse(저장.저장소[ns._retryItemKeys()[0]]).updates['submissions/Amy05_K/answers/q2'] === 'B');
  }
  {
    const 저장 = 가짜저장소({ solomon_fbq_1_a: JSON.stringify({ updates: { 'submissions/Amy05_K/answers/q1': 'A' }, queuedAt: 1 }) });
    const { ns } = 줄짓기({ __끊김: true }, 저장);
    await ns._flushRetryQueue();
    재기('인터넷이 끊겨 못 보내면 남는다', 'solomon_fbq_1_a' in 저장.저장소);
  }
  {
    const 저장 = 가짜저장소({ solomon_fb_retry_queue: '{깨진' });
    const { ns } = 줄짓기({}, 저장);
    await ns._flushRetryQueue();
    재기('옛 줄을 못 읽으면 지우지 않고 둔다', 저장.저장소.solomon_fb_retry_queue === '{깨진');
  }
  {
    const 저장 = 가짜저장소();
    let 알림 = '';
    저장.ls.setItem = () => { throw new Error('QuotaExceededError'); };
    const ns = new Function('window', 'localStorage', 'currentUser', '_isStudentOwnedSubmissionUpdate', '_retryDecision', '_clearStudentSaveFailure', 'showBackupToast', 'console', 'FB_RETRY_QUEUE_KEY', '_lastFbWriteTs', 'document',
      줄소스 + '\n; return { _addToRetryQueue };')({}, 저장.ls, { id: 'Amy05' }, () => true, null, () => {}, (m) => { 알림 = m; }, 조용, 'x', 0, { getElementById: () => null });
    ns._addToRetryQueue({ 'submissions/Amy05_K/answers/q1': 'A' });
    재기('기기 저장 공간이 없으면 「보관 못 했다」고 바로 알린다', /보관하지 못했습니다/.test(알림), 알림);
  }

  console.log('\n── ③-3 점검(10-03 Codex) 재현 — 답을 조용히 버리지 않는다');
  {
    // R2 같은 판 번호, 다른 제출 답 → 답이 다르면 남긴다
    const r = await 돌리기({ submissions: { K: { submitted: true, rev: 1, answers: { q1: 'A', q2: 'X' } } } },
      [{ updates: { 'submissions/K/answers/q1': 'A', 'submissions/K/answers/q2': 'B', 'submissions/K/submitted': true, 'submissions/K/rev': 1 }, queuedAt: 지금 }]);
    const 남긴것 = r.쓴것.filter(u => Object.keys(u).some(k => k.startsWith('submissions/K/_conflicts/answers|q2|')));
    재기('R2 같은 판·다른 답 → q2 를 「확인 필요」로 남기고 q1(같음)은 안 남김', 남긴것.length === 1 && !r.쓴것.some(u => Object.keys(u).some(k => k.includes('_conflicts/answers|q1'))), JSON.stringify(r.쓴것));
  }
  {
    // R3 새로 풀기 묶음 — null(지우기)도 빠짐없이 보낸다 · 이미 반영됐으면 건너뛴다
    const 새로 = { 'submissions/K/_prev': [{ answers: { q1: 'A' } }], 'submissions/K/answers': null, 'submissions/K/submitted': false, 'submissions/K/submitTime': null, 'submissions/K/reportData': null };
    const r = await 돌리기({ submissions: { K: { answers: { q1: 'A' }, submitted: true, reportData: { s: 1 } } } }, [{ updates: 새로, queuedAt: 지금 }]);
    const 묶음 = r.쓴것.find(u => 'submissions/K/submitted' in u);
    재기('R3 새로 풀기 묶음을 null 까지 한 번에 보낸다', 묶음 && 묶음['submissions/K/answers'] === null && 묶음['submissions/K/reportData'] === null && 묶음['submissions/K/submitted'] === false, JSON.stringify(r.쓴것));
    const r2 = await 돌리기({ submissions: { K: { _prev: [{ a: 1 }], submitted: false } } }, [{ updates: 새로, queuedAt: 지금 }]);
    재기('R3 이미 반영된 새로 풀기(보관함 길이 같음) → 다시 안 보낸다', r2.쓴것.length === 0);
  }
  {
    // R4 두 기기가 같은 빈 문항에 다른 답 — 트랜잭션: 먼저 들어간 답이 있으면 덮지 않고 남긴다
    const 서버 = { submissions: { K: { answers: {} } } };
    const 저장1 = 가짜저장소({ solomon_fbq_1_a: JSON.stringify({ updates: { 'submissions/K/answers/q1': 'A' }, queuedAt: 1 }) });
    const 저장2 = 가짜저장소({ solomon_fbq_1_b: JSON.stringify({ updates: { 'submissions/K/answers/q1': 'B' }, queuedAt: 1 }) });
    const 갑 = 줄짓기(서버, 저장1), 을 = 줄짓기(서버, 저장2);
    await 갑.ns._flushRetryQueue(); await 을.ns._flushRetryQueue();
    재기('R4 먼저 들어간 A 를 B 가 덮지 않는다 · B 는 「확인 필요」', 서버.submissions.K.answers.q1 === 'A' && Object.keys(서버.submissions.K._conflicts || {}).some(k => k.startsWith('answers|q1|')), JSON.stringify(서버));
  }
  {
    // 같은 기기가 마음을 바꿈(A 다음 B · 둘 다 줄에) → 낡은 A 는 건너뛰고 B 를 보낸다(가짜 충돌을 만들지 않는다)
    const 서버 = { submissions: { K: { answers: {} } } };
    const 저장 = 가짜저장소({
      solomon_fbq_1_a: JSON.stringify({ updates: { 'submissions/K/answers/q1': 'A' }, queuedAt: 1 }),
      solomon_fbq_2_b: JSON.stringify({ updates: { 'submissions/K/answers/q1': 'B' }, queuedAt: 2 }) });
    const { ns } = 줄짓기(서버, 저장);
    await ns._flushRetryQueue();
    재기('같은 기기의 나중 답 B 가 들어간다 · 충돌 기록 없음', 서버.submissions.K.answers.q1 === 'B' && !서버.submissions.K._conflicts, JSON.stringify(서버));
  }
  {
    // 서버 값이 「이 기기가 전에 보낸 값」이면 덮는다 — A 를 보냈고(성공), 끊긴 사이 B 로 바꿈
    const 서버 = { submissions: { K: { answers: { q1: 'A' } } } };
    const 저장 = 가짜저장소({ solomon_fb_sent_answers: JSON.stringify({ 'submissions/K/answers/q1': 'A' }),
      solomon_fbq_2_b: JSON.stringify({ updates: { 'submissions/K/answers/q1': 'B' }, queuedAt: 2 }) });
    const { ns } = 줄짓기(서버, 저장);
    await ns._flushRetryQueue();
    재기('내가 전에 보낸 A 위에는 B 를 쓴다(내 마음 바꿈)', 서버.submissions.K.answers.q1 === 'B' && !서버.submissions.K._conflicts, JSON.stringify(서버));
  }
  {
    // 「확인 필요」를 서버에 못 남기면 원래 일을 지우지 않는다
    const 서버 = { submissions: { K: { answers: { q1: 'X' } } } };
    const 저장 = 가짜저장소({ solomon_fbq_1_a: JSON.stringify({ updates: { 'submissions/K/answers/q1': 'A' }, queuedAt: 1 }) });
    서버.__쓰기실패 = true;     // 트랜잭션은 「다른 값」이라 커밋 안 함 → 「확인 필요」 쓰기(update)가 실패
    const { ns } = 줄짓기(서버, 저장);
    await ns._flushRetryQueue();
    재기('「확인 필요」를 서버에 못 남기면 원래 일을 줄에 둔다', 'solomon_fbq_1_a' in 저장.저장소 && 서버.submissions.K.answers.q1 === 'X');
  }

  console.log('\n── ③-4 점검 R7 — 먼저 기기에 적고 보낸다(끊긴 채 창을 닫아도 남는다)');
  {
    const 쓰기소스 = 떼기('function fbWrite(updates, onSuccess) {', '\nfunction fbSetHomeworkSet(');
    async function 써보기(결과) {
      const 저장 = 가짜저장소();
      const 줄 = new Function('localStorage', 'currentUser', 'showBackupToast', 'document', 'window',
        떼기('const FB_RETRY_ITEM_PREFIX', '\nfunction _notifyStudentSaveFailure()') + '\nfunction _isStudentOwnedSubmissionUpdate(u){return Object.keys(u).filter(k=>k!=="lastModified").every(k=>k.startsWith("submissions/Amy05_"));}\n; return { _addToRetryQueue, _retryItemKeys, _notifySaveWaiting, _clearSaveWaiting, _isStudentOwnedSubmissionUpdate };')(
        저장.ls, { id: 'Amy05', role: 'student' }, () => {}, { getElementById: () => null, createElement: () => ({ style: {} }), body: { appendChild() {} } }, {});
      let 풀기, 거절;
      const 약속 = new Promise((a, b) => { 풀기 = a; 거절 = b; });
      const 창 = { isPreviewMode: false, fbReady: true, FB_REF: { update: () => 약속 } };
      const 남김 = [];
      const fbWrite = new Function('window', 'localStorage', 'currentUser', '_figGuardOk', '_scopeUnreadWrites', 'prepSessionState', '_묶음가르기', '_addToRetryQueue', '_notifySaveWaiting', '_clearSaveWaiting',
        '_clearStudentSaveFailure', '_clearTeacherWriteFail', '_notifyStudentSaveFailure', '_notifyTeacherWriteFail', '_notifySessionExpired', 'showBackupToast', '_잠김알리기', '_서버값으로되돌리기', '_retryConflictNote', '_sentRemember', 'console', 'setTimeout', 'clearTimeout', '_lastFbWriteTs',
        쓰기소스 + '\n; return fbWrite;')(창, 저장.ls, { id: 'Amy05', role: 'student' }, () => true, () => [], () => 'ok', (u) => ({ 보낼것: u, 막힌것: {} }), 줄._addToRetryQueue, () => {}, () => {},
        () => {}, () => {}, () => {}, () => {}, () => {}, () => {}, () => {}, () => 0, async (p, s, m) => { 남김.push(p); }, () => {}, 조용, setTimeout, clearTimeout, 0);
      fbWrite({ 'submissions/Amy05_K/answers/q1': 'A' });
      const 보내는중 = 줄._retryItemKeys().length;
      if (결과 === 'ok') 풀기(); else if (결과 === 'denied') 거절(Object.assign(new Error('PERMISSION_DENIED'), { code: 'PERMISSION_DENIED' })); else if (결과 === 'net') 거절(new Error('network'));
      await new Promise(r => setTimeout(r, 5));
      return { 보내는중, 뒤: 줄._retryItemKeys().length, 남김 };
    }
    const 기다림 = await 써보기('wait');
    재기('R7 서버 응답을 기다리는 동안 이미 기기 줄에 있다(창을 닫아도 남는다)', 기다림.보내는중 === 1 && 기다림.뒤 === 1);
    const 됨 = await 써보기('ok');
    재기('서버가 받으면 그 일만 지운다', 됨.보내는중 === 1 && 됨.뒤 === 0);
    const 끊김 = await 써보기('net');
    재기('인터넷 실패면 줄에 그대로(두 번 넣지 않는다)', 끊김.뒤 === 1);
    const 거부 = await 써보기('denied');
    재기('거부면 「확인 필요」를 남긴 뒤 지운다', 거부.뒤 === 0 && 거부.남김.length === 1);
  }

  console.log('\n── ④ 다시 보내기 줄 — 제출 묶음(doSubmit 이 한 번에 쓴 항목들)');
  const 제출묶음 = (rev) => ({ 'submissions/K/answers/q1': 'A', 'submissions/K/answers/q2': 'B', 'submissions/K/submitted': true, 'submissions/K/submitTime': 't', 'submissions/K/rev': rev, 'submissions/K/manuallyMarked': null, lastModified: 1 });
  {
    const r = await 돌리기({ submissions: { K: { answers: { q1: 'X' } } } }, [{ updates: 제출묶음(1), queuedAt: 지금 }]);
    재기('서버 미제출 → 묶음을 한 번에 보낸다(답이 서버와 달라도 제출이 이긴다)', r.쓴것.length === 1 && r.쓴것[0]['submissions/K/submitted'] === true && r.쓴것[0]['submissions/K/answers/q1'] === 'A', JSON.stringify(r.쓴것));
  }
  {
    const r = await 돌리기({ submissions: { K: { submitted: true, rev: 2 } } }, [{ updates: 제출묶음(1), queuedAt: 지금 }]);
    재기('서버가 더 새 판으로 제출됨 → 보내지 않되 다른 답은 「확인 필요」로 남긴다(R2)', !r.쓴것.some(u => 'submissions/K/submitted' in u) && r.쓴것.filter(u => Object.keys(u).some(k => k.includes('/_conflicts/answers|'))).length === 2, JSON.stringify(r.쓴것));
  }
  {
    const r = await 돌리기({ submissions: { K: { submitted: true, manuallyMarked: true } } }, [{ updates: 제출묶음(1), queuedAt: 지금 }]);
    재기('서버가 원장 처리 → 아이의 진짜 제출로 바꾼다', r.쓴것.length === 1 && r.쓴것[0]['submissions/K/manuallyMarked'] === null);
  }

  console.log('\n── ⑥ 보충학습 — remediation 가지만');
  {
    const 시작 = html.indexOf('function getRemediation(sub) {');
    const 끝 = html.indexOf('\n}\n', html.indexOf('function renderFinalReport('));
    const 보충 = html.slice(시작, 끝);
    재기('보충학습 구역에 칸 통째 쓰기(fbSetSubmission)가 없다', !/fbSetSubmission\(/.test(보충.replace(/\/\/.*$/gm, '')));
    재기('fbSetRemediation 을 18곳에서 쓴다', (보충.match(/fbSetRemediation\(key, store/g) || []).length === 18);
    const 도우미 = 떼기('function fbSetRemediation(', '\n}\n') + '\n}';
    const 쓴것 = [];
    const f = new Function('fbWrite', 도우미 + '\n; return fbSetRemediation;')((u) => 쓴것.push(u));
    f('K', { submissions: { K: { remediation: { r: 1 }, reportData: { remediation: [1], kakaoMsg: 'k' }, answers: { q: 'A' } } } }, true);
    재기('remediation · reportData/remediation 두 경로만', JSON.stringify(Object.keys(쓴것[0])) === JSON.stringify(['submissions/K/remediation', 'submissions/K/reportData/remediation']), JSON.stringify(쓴것));
  }

  console.log('\n── ⑦ 원장 현황표 「확인 필요」 표시');
  {
    const 소스 = 떼기('function _conflictBadge(sub, html) {', '\n}\n') + '\n}';
    const f = new Function('escHtml', 소스 + '\n; return _conflictBadge;')((x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'));
    재기('충돌 없으면 그대로', f({ submitted: true }, 'X') === 'X' && f(null, 'X') === 'X');
    const h = f({ _conflicts: { 'answers|q2': { server: 'B', mine: '<C>' } } }, 'X');
    재기('충돌 있으면 ⚠ 확인 · 문항·서버·기기 답(글은 escape)', /⚠ 확인/.test(h) && /q2: 서버 B \/ 기기 &lt;C>/.test(h), h);
    재기('현황표가 _conflictBadge 로 감싼다', /sets\.map\(\(set, idx\) => _conflictBadge\(/.test(html));
  }

  console.log('\n── ⑤ 새로 풀기 — 서버 칸을 보고 한 동작으로');
  {
    const 소스 = 떼기('function startFreshSet(idx) {', '\nfunction startSet(');
    const 서버 = { answers: { q1: 'A', q9: 'Z' }, submitted: true, submitTime: 't', rev: 2, reportData: { s: 1 }, remediation: { r: 1 }, _prev: [{ old: 1 }] };
    let 쓴값 = null, 시작 = 0, 서랍 = { currentPeriod: { y: 1 }, submissions: { K: { answers: { q1: 'A' }, submitted: true } } };
    const 창 = { fbReady: true, FB_REF: { child: () => ({ once: async () => ({ val: () => JSON.parse(JSON.stringify(서버)) }) }) } };
    const f = new Function('window', 'getStore', 'saveStore', 'subKey', 'currentUser', 'studentPeriod', 'startSet', 'confirm', 'hwLookupKey', 'fbTxSubmission', 'fbSetSubmission', 'fbWrite', 'showBackupToast', 'qIdx',
      소스 + '\n; return startFreshSet;')(창, () => 서랍, (s) => { 서랍 = s; }, () => 'K', { id: 'Amy05', year: 5 }, null, () => { 시작++; }, () => true, () => 'HK',
      () => { 쓴값 = '트랜잭션'; }, () => { 쓴값 = '통째'; }, (u, cb) => { 쓴값 = u; cb(true); }, () => {}, 0);
    f(0);
    await new Promise(r => setTimeout(r, 10));
    const P = 'submissions/K/';
    재기('서버 칸의 기록(사본에 없던 q9 포함)을 보관함에 넣는다', 쓴값 && 쓴값[P + '_prev'] && 쓴값[P + '_prev'].length === 2 && 쓴값[P + '_prev'][1].answers.q9 === 'Z', JSON.stringify(쓴값));
    재기('칸 통째가 아니라 항목만 — 답·제출·리포트·보충 비우고 숙제 열쇠', 쓴값 && Object.keys(쓴값).every(k => k.startsWith(P)) && 쓴값[P + 'answers'] === null && 쓴값[P + 'submitted'] === false && 쓴값[P + 'reportData'] === null && 쓴값[P + 'remediation'] === null && 쓴값[P + 'hwKey'] === 'HK', JSON.stringify(쓴값 && Object.keys(쓴값)));
    재기('저장된 뒤에 세트를 연다', 시작 === 1);
  }

  console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
  process.exit(실패 ? 1 : 0);
})().catch(e => { console.log('  ⛔ 터졌다: ' + (e && e.stack || e)); console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + (실패 + 1)); process.exit(1); });
