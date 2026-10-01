// 5단계 PC 제작 일꾼(prep_worker) — 진짜 DB·인증·저장소(에뮬레이터) + 가짜 Claude(돈·한도 0)
//   firebase emulators:exec --only database,auth,storage --project demo-solomon "node functions/에뮬레이터시험/일꾼.emu.js"
// 지시서 5단계 완료 기준: 한 학생 설정에 맞는 PDF·온라인 초안 생성 · 모든 문항이 명세와 연결 ·
//   생성·업로드 실패 · 한도 초과 · 중단 복구 · 중복 주문 시험 · 비용 상한 초과 시 중단과 화면 표시(w.hold)
// 원장 지시: 일꾼은 drafts 에만(숙제 칸·공개 과제·제출 ✕) · 반자동 기본 · 드라이브 복사는 임시 폴더로만
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const DB = process.env.FIREBASE_DATABASE_EMULATOR_HOST, AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST, ST = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
if (!DB || !AUTH || !ST || !/^(127\.0\.0\.1|localhost):\d+$/.test(DB)) { console.log('⛔ 에뮬레이터 변수가 없습니다(database·auth·storage)'); console.log('\n셈 — 통과 0 · 실패 1'); process.exit(1); }
const admin = require(path.join(__dirname, '..', 'node_modules', 'firebase-admin'));
admin.initializeApp({ projectId: 'demo-solomon', databaseURL: `http://${DB}?ns=demo-solomon` });
const db = admin.database();
const P = require(path.join(__dirname, '..', 'prep_session'));
const O = require(path.join(__dirname, '..', 'order_core'));
const W = require(path.join(__dirname, '..', '..', 'prep_worker', '일꾼'));
const C = require(path.join(__dirname, '..', '..', 'prep_worker', 'core'));
const { FB } = require(path.join(__dirname, '..', '..', 'prep_worker', 'fb'));
const OP = '62bxWubzDLMrhHjjv2oNfAQiyaD2';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
let 통과 = 0, 실패 = 0;
function 재기(이름, 참, 덧) { if (참) { 통과++; console.log('  ✅ ' + 이름); } else { 실패++; console.log('  ⛔ ' + 이름 + (덧 ? '\n       ' + String(덧).slice(0, 600) : '')); } }
const 값 = async (p) => (await db.ref(p).once('value')).val();
async function 거절됨(f) { try { await f(); return false; } catch (e) { return e.status === 401 || e.status === 403; } }

/* ── 가짜 Claude — 칸마다 맞는 문항을 만든다. 옵션으로 틀린 재풀이·호출 순간 끼어들기 ── */
function 가짜(opt) {
  const o = opt || {}, n = { generate: 0, verify: 0, format: 0 }, 정답 = {};
  const fake = async (role, input, model) => {
    n[role]++;
    if (o.onCall) await o.onCall(role, n);
    const base = { usage: { input: 100, output: 200, cacheCreate: 0, cacheRead: 0 }, models: [model === 'haiku' ? 'claude-haiku-fake' : 'claude-opus-fake'], asked: model, tokens: o.tokens || 300, ms: 1 };
    if (role === 'generate') {
      return Object.assign(base, { out: { items: input.items.map((s, i) => {
        const a = 2 + (parseInt(s.slot.slice(1), 10) % 40), b = 3 + i, sum = a + b; 정답[s.slot] = String(sum);
        const it = { slot: s.slot, stem: 'Ben has ' + a + ' apples and gets ' + b + ' more. How many now?', answer: String(sum), working: 'Count on: ' + a + ' plus ' + b + ' makes ' + sum + ' apples in all.',
          check: a + '+' + b, unit: s.unit, difficulty: s.difficulty, type: s.type, calculator: s.calculator, figure: false };
        if (s.type === 'mc') it.choices = [String(sum), String(sum + 1), String(sum + 2), String(sum - 1)];
        return it;
      }) } });
    }
    if (role === 'verify') return Object.assign(base, { out: { answers: input.items.map(x => ({ slot: x.slot, answer: o.wrong && o.wrong(x.slot) ? '999' : 정답[x.slot] })) } });
    return Object.assign(base, { out: { items: input.items } });
  };
  return { fake, n };
}
const 바탕 = fs.mkdtempSync(path.join(os.tmpdir(), '일꾼시험-'));
function 설정(이름, 덧) {
  return Object.assign({ mode: 'semi', backend: 'fake', allowApi: false, models: { generate: 'opus', verify: 'opus', format: 'haiku' }, maxTokensPerJob: 100000,
    estimatePerCall: {}, batchSize: 12, maxRounds: 2, workRoot: path.join(바탕, 이름, '일감'), logFile: path.join(바탕, 이름, '기록.jsonl'),
    candidatesFile: path.join(바탕, 이름, '후보.jsonl'), coreDir: 'C:/솔로몬제작/toolchain_core', tsRoot: 'C:/TS작업', python: 'python', edge: EDGE,
    heartbeatSec: 60, workerId: 'PC-A', firebase: { emulator: true, dbUrl: 'http://' + DB, ns: 'demo-solomon', bucket: 'demo-solomon.appspot.com',
      storageBase: 'http://' + ST, authBase: 'http://' + AUTH, apiKey: 'demo-key', uid: 'ts-worker' } }, 덧 || {});
}
function 작은설정() {
  const s = O.defaultSettings();
  s.mr.units[0] = Object.assign(s.mr.units[0], { title: '분수 덧셈', examples: 1, practice: 3 });
  s.mr.review = { integrated: true, questions: 4, sets: 1 };
  s.ts = Object.assign(s.ts, { title: '규칙 찾기', examples: 1, practice: 2 });
  s.paperHw = { sets: 1, perSet: [{ mr: 4, ts: 2 }] };
  s.frontTest.questions = 4;
  s.composition.calculatorPct = 25;
  s.onlineHw = { mrSets: 1, tsSets: 1, perSet: 3, daily: false, dupPolicy: 'avoid' };
  return s;
}
async function 주문(날, s) {
  const r = await P.prepConfirmOrder.run({ auth: { uid: OP, token: { uid: OP } }, data: { studentId: 'emu5', lessonDate: 날, settings: s || 작은설정() } });
  return r;
}

(async () => {
  await db.ref().set(null);
  const 규칙 = fs.readFileSync(path.join(__dirname, '..', '..', 'backup', 'database.rules.5단계.json'), 'utf8');
  const rr = await fetch(`http://${DB}/.settings/rules.json?ns=demo-solomon`, { method: 'PUT', headers: { Authorization: 'Bearer owner' }, body: 규칙 });
  if (!rr.ok) throw new Error('규칙 올리기 실패 ' + rr.status);
  await db.ref('sol_prep_v1/students/emu5').set({ profile: { currentCurriculum: 'r1', name: 'Emu Five', koName: '시험오', year: 'Year 5' },
    curricula: { r1: { lessons: [{ date: '2026-09-29', mr: '분수 개념', ts: '규칙 찾기' }, { date: '2026-10-06', mr: '분수 덧셈', ts: '규칙 찾기', targetLevel: 3 }] } } });
  await db.ref('solomon_hw_v3/homework/Y5_x').set({ title: '그대로 있어야 할 숙제' });
  const fb = new FB(설정('규칙').firebase);

  console.log('── 일꾼 로그인 · 쓰면 안 되는 칸 (규칙이 막는다)');
  await fb.token();
  재기('일꾼은 ts-worker 로 로그인(관리자 아님)', !!fb.id);
  재기('숙제 칸 쓰기 ✕', await 거절됨(() => fb.put('solomon_hw_v3/homework/Y5_x/title', '바꿈')));
  재기('제출 칸 쓰기 ✕', await 거절됨(() => fb.put('solomon_hw_v3/submissions/emu5/q0', 'x')));
  재기('공개 과제(releases)·정답표·제출(새) 쓰기 ✕', await 거절됨(() => fb.put('sol_prep_v1/releases/a1', { x: 1 })) && await 거절됨(() => fb.put('sol_prep_v1/answerKeys/a1', { x: 1 }))
    && await 거절됨(() => fb.put('sol_prep_v1/submissions/a1/emu5', { x: 1 })));
  재기('확정 판(plans)·학생 정보·스위치 쓰기 ✕', await 거절됨(() => fb.put('sol_prep_v1/plans/p/revisions/1', { x: 1 })) && await 거절됨(() => fb.put('sol_prep_v1/students/emu5/profile/name', 'x'))
    && await 거절됨(() => fb.put('sol_prep_v1/config/autoProduce', true)));
  재기('숙제 칸 값은 그대로', (await 값('solomon_hw_v3/homework/Y5_x/title')) === '그대로 있어야 할 숙제');

  console.log('\n── 주문 · 잠금(한 일꾼만)');
  const o1 = await 주문('2026-10-06');
  const j1 = await 값('sol_prep_v1/jobs/' + o1.jobId);
  재기('주문 = 새 작업 종류 prep-paper · 명세 해시(서버 셈 = 일꾼 셈) · 재시도 3', j1.type === 'prep-paper' && j1.specHash === C.specHash(o1.spec) && P.specHashOf(o1.spec) === j1.specHash && j1.maxAttempts === 3, JSON.stringify(j1));
  재기('잠금 없이 상태 바꾸기 ✕', await 거절됨(() => fb.put('sol_prep_v1/jobs/' + o1.jobId + '/status', 'running')));
  const e0 = await fb.getE('sol_prep_v1/jobs/' + o1.jobId + '/lease');
  const 둘 = await Promise.allSettled([fb.put('sol_prep_v1/jobs/' + o1.jobId + '/lease', { workerId: 'A', token: 'ta', until: Date.now() + 60000 }, e0.etag),
    fb.put('sol_prep_v1/jobs/' + o1.jobId + '/lease', { workerId: 'B', token: 'tb', until: Date.now() + 60000 }, e0.etag)]);
  재기('같은 순간 둘이 쥐려 하면 하나만 된다(조건부 쓰기)', 둘.filter(x => x.status === 'fulfilled').length === 1, JSON.stringify(둘.map(x => x.status + (x.reason ? ':' + x.reason.status : ''))));
  재기('남이 쥔(만료 전) 잠금을 다른 표로 덮기 ✕', await 거절됨(() => fb.put('sol_prep_v1/jobs/' + o1.jobId + '/lease', { workerId: 'C', token: 'tc', until: Date.now() + 60000 })));
  재기('잠금은 15분 넘게 못 잡는다', await 거절됨(async () => { const l = await 값('sol_prep_v1/jobs/' + o1.jobId + '/lease'); await fb.put('sol_prep_v1/jobs/' + o1.jobId + '/lease', Object.assign({}, l, { until: Date.now() + 3600000 })); }));
  await db.ref('sol_prep_v1/jobs/' + o1.jobId + '/lease/until').set(Date.now() - 1000);
  재기('만료된 잠금은 다른 일꾼이 넘겨받는다', !(await 거절됨(() => fb.put('sol_prep_v1/jobs/' + o1.jobId + '/lease', { workerId: 'C', token: 'tc', until: Date.now() + 60000 }))));
  await db.ref('sol_prep_v1/jobs/' + o1.jobId + '/lease').remove();

  console.log('\n── 정상 제작(가짜 Claude) — PDF · 원본 JSON · 초안 · 명세 연결');
  const g1 = 가짜();
  const cA = 설정('정상', { fake: g1.fake });
  const r1 = await W.한바퀴(cA, fb, { job: o1.jobId });
  const 끝 = await 값('sol_prep_v1/jobs/' + o1.jobId);
  재기('주문 끝(done) · 결과 초안 id', 끝.status === 'done' && !!끝.w.resultRef, JSON.stringify(r1) + ' ' + JSON.stringify(끝.w));
  const d1 = await 값('sol_prep_v1/drafts/' + 끝.w.resultRef) || {};
  재기('초안 id = 계획+판+산출물+명세해시', 끝.w.resultRef === C.draftIdFor(j1, 'paper', j1.specHash));
  const 칸 = C.slotsFromSpec(o1.spec, { prevUnit: '분수 개념' });
  재기('모든 칸이 manifest 에 한 번씩(명세와 연결) · 문항 id·판 있음', d1.manifest && d1.manifest.length === 칸.length && 칸.every(s => d1.manifest.filter(m => m.slot === s.id).length === 1)
    && d1.manifest.every(m => m.itemId), d1.manifest && d1.manifest.length + ' vs ' + 칸.length);
  재기('MR 은 재풀이 「검증 일치」 표시 · 정답 보장이라 쓰지 않음', d1.manifest.filter(m => m.src === 'mr').every(m => m.verify === 'verified-agree') && /정답 보장이 아님/.test(d1.verifyNote));
  재기('초안: 공개 아님 · 교재 검토 상태 · 판·학생 맞음', d1.published === false && d1.status === 'paperReview' && d1.planRev === 1 && d1.studentId === 'emu5');
  const 파일 = Object.fromEntries((d1.files || []).map(f => [f.kind, f]));
  재기('PDF 5종(테스트지·교재·숙제·학생용 전체·교사용 답지) + 원본 JSON·검수 기록', ['test', 'book', 'hw', 'student', 'teacher', 'items', 'qa'].every(k => 파일[k]), Object.keys(파일).join(','));
  재기('학생용과 교사용 답지는 자리가 다르다', /\/student\//.test(파일.student.path) && /\/teacher\//.test(파일.teacher.path));
  const 다시 = await fb.download(파일.teacher.path);
  재기('저장소에서 다시 읽은 해시 = 기록한 해시', C.sha256(다시) === 파일.teacher.sha256);
  재기('올린 파일마다 다운로드 토큰 처리 기록(에뮬레이터는 지우기를 지원 안 해 「건너뜀」 — 운영에서 지우고 다시 읽어 확인)', d1.files.every(f => f.downloadToken === 'emulator-skip'));
  재기('검사: 학생용 전체에 칸 수만큼 문항 · 쪽 있음', d1.qa.ok && d1.qa.files.student.count === 칸.length && d1.qa.files.student.pages >= 3, JSON.stringify(d1.qa));
  재기('작업 기록: 토큰·실제 모델(생성·검증 opus · 설정대로)', 끝.w.usage.tokens > 0 && JSON.stringify(끝.w.models.generate) === '["claude-opus-fake"]' && JSON.stringify(끝.w.models.verify) === '["claude-opus-fake"]', JSON.stringify(끝.w.models));
  const 기록줄 = fs.readFileSync(cA.logFile, 'utf8').trim().split('\n').map(x => JSON.parse(x));
  재기('PC 작업 기록 파일에 호출마다 모델·토큰', 기록줄.filter(x => x.call).every(x => x.models && x.tokens > 0) && 기록줄.some(x => x.msg === '끝'));
  const 후보 = fs.readFileSync(cA.candidatesFile, 'utf8').trim().split('\n').map(x => JSON.parse(x));
  재기('생성 MR 은 「미승인 후보」로 적립(문항·정답·분류·출처·검수)', 후보.length === 칸.filter(s => s.src === 'mr').length && 후보.every(x => x.status === 'unapproved' && x.answer && x.unit && x.source.draftId && x.verify));
  재기('저장소 일꾼 초안 덮어쓰기 ✕', await 거절됨(() => fb.upload(파일.test.path, Buffer.from('%PDF-1.4 x'), 'application/pdf')));
  재기('저장소: 학교 자료 자리(sources) 쓰기 ✕ · PDF·JSON 말고 ✕', await 거절됨(() => fb.upload('prep/emu5/sources/x.pdf', Buffer.from('%PDF'), 'application/pdf'))
    && await 거절됨(() => fb.upload('prep/emu5/drafts/zz/student/x.html', Buffer.from('<b>'), 'text/html')));

  console.log('\n── 중복 주문 · 늦게 온 옛 결과');
  const r1b = await W.한바퀴(cA, fb, { job: o1.jobId });
  재기('끝난 주문을 다시 돌려도 안 집는다', r1b.length === 0 && g1.n.generate > 0);
  const 가짜초안 = { jobId: o1.jobId, claimToken: 'x', planId: j1.planId, planRev: 1, studentId: 'emu5', published: false };
  재기('같은 초안 id 로 또 쓰기 ✕(새로 만들기만)', await 거절됨(() => fb.put('sol_prep_v1/drafts/' + 끝.w.resultRef, 가짜초안)));
  재기('끝난 주문 표로 새 초안 ✕(늦게 온 옛 결과)', await 거절됨(() => fb.put('sol_prep_v1/drafts/late1', Object.assign({}, 가짜초안, { claimToken: 끝.lease.token }))));

  console.log('\n── 판 변경 · 취소');
  const o2 = await 주문('2026-10-06');
  재기('판 2 확정 → 판 1 초안에 무효 표시', (await 값('sol_prep_v1/drafts/' + 끝.w.resultRef + '/invalidatedByRev')) === 2);
  const g2 = 가짜({ onCall: async (role, n) => { if (role === 'generate' && n.generate === 1) { await 주문('2026-10-06'); } } });
  const cB = 설정('취소', { fake: g2.fake, heartbeatSec: 0.05 });
  const r2 = await W.한바퀴(cB, fb, { job: o2.jobId });
  재기('도는 중 새 판이 나오면 옛 주문은 「취소 요청」 → 일꾼이 멈추고 취소로 닫는다', (await 값('sol_prep_v1/jobs/' + o2.jobId + '/status')) === 'cancelled', JSON.stringify(r2));
  재기('취소된 주문은 초안을 안 남긴다', !(await 값('sol_prep_v1/drafts/' + C.draftIdFor({ planId: o2.planId, rev: 2 }, 'paper', C.specHash(o2.spec)))));
  // 판 3 주문은 다음 시험들에 안 쓰므로 취소해 둔다
  for (const [k, j] of Object.entries((await 값('sol_prep_v1/jobs')) || {})) if (j.status === 'queued') await db.ref('sol_prep_v1/jobs/' + k + '/status').set('cancelled');

  console.log('\n── 토큰 상한 · 알 수 없는 종류');
  const o3 = await 주문('2026-10-13');
  const cC = 설정('상한', { fake: 가짜({ tokens: 300 }).fake, maxTokensPerJob: 500 });
  await W.한바퀴(cC, fb, { job: o3.jobId });
  const j3 = await 값('sol_prep_v1/jobs/' + o3.jobId);
  재기('상한을 넘으면 멈추고 「보류(token-cap)」 · 쓴 양·상한이 화면용 칸(w)에', j3.status === 'held' && j3.w.hold.kind === 'token-cap' && j3.w.usage.cap === 500 && j3.w.usage.tokens >= 500, JSON.stringify(j3.w));
  const jx = db.ref('sol_prep_v1/jobs').push(); await jx.set({ type: 'produce-video', planId: 'emu5_x', rev: 1, studentId: 'emu5', status: 'queued', createdAt: new Date().toISOString() });
  await W.한바퀴(설정('모름', { fake: 가짜().fake }), fb, { job: jx.key });
  재기('알 수 없는 작업 종류 → 실패(failed) 처리', (await 값('sol_prep_v1/jobs/' + jx.key + '/status')) === 'failed');

  console.log('\n── 중단 뒤 이어하기 · 올리기 실패');
  const o4 = await 주문('2026-10-20');
  const g4 = 가짜();
  const cD = 설정('이어', { fake: g4.fake, firebase: Object.assign({}, 설정('x').firebase, { storageBase: 'http://127.0.0.1:9' }) });
  const r4 = await W.한바퀴(cD, new FB(cD.firebase), { job: o4.jobId });   // 저장소가 죽은 연결
  const j4 = await 값('sol_prep_v1/jobs/' + o4.jobId);
  재기('올리기 실패 → 다시 대기(queued) · 까닭 기록 · 재시도 1', j4.status === 'queued' && /fetch failed|올리기|거절/.test(j4.w.lastError) && j4.w.attempts === 1, JSON.stringify(r4) + JSON.stringify(j4.w));
  const 앞호출 = g4.n.generate + g4.n.verify;
  // PC 가 죽은 것처럼: 내 잠금이 살아 있는 채 「running」
  await db.ref('sol_prep_v1/jobs/' + o4.jobId).update({ status: 'running', lease: { workerId: 'PC-A', token: 'tok-old', until: Date.now() + 60000 } });
  const cD2 = 설정('이어', { fake: g4.fake });
  const r4b = await W.한바퀴(cD2, fb, { job: o4.jobId });
  const j4b = await 값('sol_prep_v1/jobs/' + o4.jobId);
  재기('재시작한 같은 PC 가 이어서 끝낸다 · Claude 를 다시 안 부른다(저장한 단계 결과)', j4b.status === 'done' && g4.n.generate + g4.n.verify === 앞호출, JSON.stringify(r4b) + ' 호출 ' + 앞호출 + '→' + (g4.n.generate + g4.n.verify));
  재기('이어하기는 재시도 횟수를 늘리지 않는다', j4b.w.attempts === 1);

  console.log('\n── 재시도 다 씀 · 재풀이 불일치 · TS 창고 부족');
  const o5 = await 주문('2026-10-27');
  const cE = 설정('실패', { fake: 가짜().fake, firebase: Object.assign({}, 설정('x').firebase, { storageBase: 'http://127.0.0.1:9' }) });
  const fbE = new FB(cE.firebase);
  for (let i = 0; i < 3; i++) await W.한바퀴(cE, fbE, { job: o5.jobId });
  재기('세 번 실패하면 failed', (await 값('sol_prep_v1/jobs/' + o5.jobId + '/status')) === 'failed');
  const o6 = await 주문('2026-11-03');
  const g6 = 가짜({ wrong: (slot) => slot === 'm001' });
  await W.한바퀴(설정('불일치', { fake: g6.fake }), fb, { job: o6.jobId });
  const j6 = await 값('sol_prep_v1/jobs/' + o6.jobId);
  재기('재풀이가 계속 어긋나면 보충 생성 뒤 보류(mr-unverified) · 어느 문항인지', j6.status === 'held' && j6.w.hold.kind === 'mr-unverified' && JSON.stringify(j6.w.hold.detail).includes('m001') && g6.n.generate >= 2, JSON.stringify(j6.w.hold));
  const 큰 = 작은설정(); 큰.ts.title = '결론을 이끄는 근거'; 큰.difficulty.target = 5; 큰.ts.practice = 40;
  const o7 = await 주문('2026-11-10', 큰);
  await W.한바퀴(설정('부족', { fake: 가짜().fake }), fb, { job: o7.jobId });
  const j7 = await 값('sol_prep_v1/jobs/' + o7.jobId);
  재기('TS 창고가 모자라면 보류(ts-short) · 대안(다른 레벨·유형) 표시 · 임의로 안 채움', j7.status === 'held' && j7.w.hold.kind === 'ts-short' && Array.isArray(j7.w.hold.detail.alternatives) && j7.w.hold.detail.alternatives.length > 0, JSON.stringify(j7.w.hold));

  console.log('\n── 홈페이지(온라인) 초안 — 교재 승인 뒤');
  await db.ref('sol_prep_v1/drafts/' + 끝.w.resultRef + '/approval').set({ approved: true, by: OP, at: 'x' });
  const jo = db.ref('sol_prep_v1/jobs').push();
  await jo.set({ type: 'prep-online', planId: j1.planId, rev: 1, studentId: 'emu5', lessonDate: '2026-10-06', sourceDraftId: 끝.w.resultRef, status: 'queued', maxAttempts: 3, createdAt: new Date().toISOString() });
  // 판 1 은 무효가 됐지만 시험용으로 판 1 의 승인 교재로 온라인을 만든다(latest 와 무관 — 주문이 가리킨 판)
  await W.한바퀴(설정('온라인', { fake: 가짜().fake }), fb, { job: jo.key });
  const jo2 = await 값('sol_prep_v1/jobs/' + jo.key);
  const od = jo2.w && jo2.w.resultRef ? await 값('sol_prep_v1/drafts/' + jo2.w.resultRef) : null;
  재기('온라인 초안: MR 세트 1 + TS 세트 1 × 3문항 · 홈페이지 문항 꼴', od && od.kind === 'online' && od.sets.length === 2 && od.sets.every(s => s.questions.length === 3)
    && od.sets[0].questions.every(q => q.id && q.text && q.answer && q.srcId), JSON.stringify(jo2.w) + JSON.stringify(od && od.sets).slice(0, 300));
  재기('온라인 TS 는 종이에 나간 TS 와 겹치지 않는다', od && od.sets[1].questions.every(q => !d1.manifest.some(m => m.itemId === q.srcId)));
  재기('온라인 초안도 공개 아님(published:false)', od && od.published === false && od.status === 'onlineReview');
  const ju = db.ref('sol_prep_v1/jobs').push();
  await ju.set({ type: 'prep-online', planId: o4.planId, rev: o4.rev, studentId: 'emu5', lessonDate: '2026-10-20', sourceDraftId: (await 값('sol_prep_v1/jobs/' + o4.jobId + '/w/resultRef')), status: 'queued', maxAttempts: 3, createdAt: new Date().toISOString() });
  await W.한바퀴(설정('미승인', { fake: 가짜().fake }), fb, { job: ju.key });
  재기('승인 안 된 교재로는 온라인을 안 만든다(보류 not-approved)', (await 값('sol_prep_v1/jobs/' + ju.key + '/w/hold/kind')) === 'not-approved');

  console.log('\n── 구글 드라이브 보관(임시 폴더로만) · 실행 방식 스위치');
  const 임시 = path.join(바탕, '드라이브흉내');
  const plan = await W.보관(설정('보관'), fb, 끝.w.resultRef, 임시);
  재기('학생/수업일 폴더에 PDF 5종 · 해시 같음', plan.length === 5 && plan.every(p => fs.existsSync(p.to) && C.sha256(fs.readFileSync(p.to)) === p.sha256) && plan[0].to.includes(path.join('시험오', '2026-10-06').replace(/\\/g, '/')), JSON.stringify(plan.map(p => p.to)));
  const plan2 = await W.보관(설정('보관'), fb, 끝.w.resultRef, 임시);
  재기('두 번 복사해도 같은 파일은 그대로(덮어쓰기 없음)', plan2.length === 5);
  let 막 = false; try { await W.보관(설정('보관'), fb, (await 값('sol_prep_v1/jobs/' + o4.jobId + '/w/resultRef')), 임시); } catch (e) { 막 = /승인/.test(e.message); }
  재기('승인 안 된 교재는 복사 안 함', 막);
  재기('완전 자동: 이 PC 설정 semi 면 꺼짐', !(await W.자동켜짐(설정('s'), fb)));
  재기('완전 자동: auto 라도 DB 스위치가 없으면 꺼짐', !(await W.자동켜짐(설정('s', { mode: 'auto' }), fb)));
  await db.ref('sol_prep_v1/config/autoProduce').set(true);
  재기('완전 자동: auto + 원장 스위치 켬 → 켜짐', await W.자동켜짐(설정('s', { mode: 'auto' }), fb));
  let api = false; try { W.설정읽기((() => { const f = path.join(바탕, 'api.json'); fs.writeFileSync(f, JSON.stringify({ allowApi: true })); return f; })()); } catch (e) { api = /API/.test(e.message); }
  재기('설정에서 API 를 켜면 일꾼이 아예 안 뜬다', api);

  await db.ref('sol_prep_v1/students/emu5/profile/holdForCurriculum').set(true);
  const o9 = await 주문('2026-11-17'); const g9 = 가짜();
  await W.한바퀴(설정('커리보류', { fake: g9.fake }), fb, { job: o9.jobId });
  재기('「커리 먼저 검토」가 켜져 있으면 Claude 를 안 부르고 보류(curriculum-review)', (await 값('sol_prep_v1/jobs/' + o9.jobId + '/w/hold/kind')) === 'curriculum-review' && g9.n.generate === 0);

  await db.ref().set(null);
  console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
  process.exit(실패 ? 1 : 0);
})().catch(e => { console.log('  ⛔ 터졌다: ' + (e && e.stack || e)); console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + (실패 + 1)); process.exit(1); });
