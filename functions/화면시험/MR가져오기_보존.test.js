// MR JSON 숙제 가져오기 — **문항 정보를 잃지 않는가 · 이상하면 멈추는가.**
//
// ⛔ [1단계 · 2026-10-01] 운영 DB 실측: 숙제 칸의 문항 19,479 개 중 `taxonomy_id` 가 **0 개**,
//    `weakness` 가지도 **없다.** 파일에 있던 분류·원래 번호·출처가 병합(_mergeHwJsonFiles)과
//    등록(doImportHwJson) 두 군데서 떨어져 나가, 약점 분석이 한 번도 돌지 못했다.
//    정답 파일 병합도 「맞는 것이 없으면 조용히 빈 정답」으로 지나갔다.
//
// 이 시험이 지키는 것
//   ① 병합: id · taxonomy_id · 정답 · 해설 · 출처가 문제 파일·정답 파일 어느 쪽에서 와도 남는다
//   ② 병합: 정답 충돌 · 매칭 실패 · 중복 문항이면 **null 을 돌려 등록을 멈추고** 까닭을 알린다
//   ③ 등록: 문항 id 는 그대로 `q0…`(제출 답의 열쇠) · 원래 id 는 `srcId` 로 **덧붙인다**
//   ④ 등록: 파일에 분류가 있으면 AI 태깅이 덮지 않는다(분류 없는 문항만 태깅)
//   ⑤ 등록: 서버에 쓴 뒤 **다시 읽어** 세트 수·내용 지문이 맞아야 「완료」를 띄운다

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
const 복 = (v) => JSON.parse(JSON.stringify(v));

// ── ① ② 병합 ─────────────────────────────────────────────
const 병합소스 =
  떼기('function _stripKatexForAnswer(', '\n}\n') + '\n}\n' +
  떼기('function _hwJsonPickQuestion(', '\n// 미리보기 표시');
function 병합(results) {
  const 알림 = [];
  const f = new Function('alert', 'console', 병합소스 + '\n; return _mergeHwJsonFiles;')(
    (m) => 알림.push(String(m)), console);
  return { 결과: f(복(results)), 알림 };
}

console.log('── ① 병합이 문항 정보를 지킨다');
{
  const 문제 = { questions: [
    { id: 'T5W1_A_01', set: 'A', number: 1, question_text: '1+1?', type: 'SA',
      taxonomy_id: 'MR.Y5.NA.WN.addTwoDigit', source: 'ICAS 2019 Q3', answer: '2', explanation: '더하기' },
    { id: 'T5W1_A_02', set: 'A', number: 2, question_text: '고르기', type: 'MCQ',
      choices: ['1', '2', '3', '4'], taxonomy_id: 'MR.Y5.NA.WN.compare' },
  ] };
  const 정답 = { answers: [
    { id: 'T5W1_A_02', correct_choice: 'C', explanation: '셋째', source: '자체 제작' },
  ] };
  const { 결과, 알림 } = 병합([{ name: 'q.json', data: 문제 }, { name: 'a.json', data: 정답 }]);
  재기('병합이 멈추지 않는다', Array.isArray(결과) && 결과.length === 2, 알림.join(' / '));
  const [a, b] = 결과 || [{}, {}];
  재기('원래 id 가 남는다', a.id === 'T5W1_A_01' && b.id === 'T5W1_A_02', JSON.stringify([a.id, b.id]));
  재기('taxonomy_id 가 남는다', a.taxonomy_id === 'MR.Y5.NA.WN.addTwoDigit' && b.taxonomy_id === 'MR.Y5.NA.WN.compare');
  재기('문제 파일의 출처가 남는다', a.source === 'ICAS 2019 Q3', a.source);
  재기('정답 파일의 출처가 들어온다', b.source === '자체 제작', b.source);
  재기('문제 파일의 정답·해설이 남는다', a.answer === '2' && a.explanation === '더하기');
  재기('정답 파일의 정답·해설이 들어온다', b.answer === 'C' && b.explanation === '셋째', JSON.stringify([b.answer, b.explanation]));
}
{
  // 정답 파일에만 분류·id 가 있을 때
  const 문제 = [{ set: 'B', num: 1, question_text: 'x?' }];
  const 정답 = [{ set: 'B', number: 1, correct_text: '5', taxonomy_id: 'MR.Y5.AL.EQ.solve', id: 'B_1' }];
  const { 결과, 알림 } = 병합([{ name: 'q', data: 문제 }, { name: 'a', data: 정답 }]);
  const q = (결과 || [])[0] || {};
  재기('배열 형식도 병합된다', !!결과, 알림.join(' / '));
  재기('정답 파일의 taxonomy_id 가 들어온다', q.taxonomy_id === 'MR.Y5.AL.EQ.solve', q.taxonomy_id);
  재기('정답 파일의 id 가 들어온다(문제에 없을 때)', q.id === 'B_1', q.id);
  재기('정답이 들어온다', q.answer === '5', q.answer);
}

console.log('\n── ② 이상하면 등록을 멈춘다');
{
  const 문제 = { questions: [{ set: 'A', number: 1, question_text: 'q', type: 'SA', answer: '7' }] };
  const 정답 = { answers: [{ set: 'A', number: 1, correct_text: '8' }] };
  const { 결과, 알림 } = 병합([{ name: 'q', data: 문제 }, { name: 'a', data: 정답 }]);
  재기('정답 충돌이면 null', 결과 === null, JSON.stringify(결과));
  재기('충돌을 알린다', /충돌/.test(알림.join('\n')), 알림.join(' / '));
}
{
  const 문제 = { questions: [{ set: 'A', number: 1, question_text: 'q', type: 'MCQ', choices: ['a', 'b'], answer: 'B' }] };
  const 정답 = { answers: [{ set: 'A', number: 1, correct_choice: 'B' }] };
  const { 결과 } = 병합([{ name: 'q', data: 문제 }, { name: 'a', data: 정답 }]);
  재기('같은 정답이면 충돌이 아니다', Array.isArray(결과) && 결과[0].answer === 'B');
}
{
  const 문제 = { questions: [
    { set: 'A', number: 1, question_text: 'q1' }, { set: 'A', number: 2, question_text: 'q2' }] };
  const 정답 = { answers: [{ set: 'A', number: 1, correct_text: '1' }, { set: 'A', number: 9, correct_text: '9' }] };
  const { 결과, 알림 } = 병합([{ name: 'q', data: 문제 }, { name: 'a', data: 정답 }]);
  재기('매칭 실패(정답 없는 문항·주인 없는 정답)면 null', 결과 === null);
  재기('매칭 실패를 알린다', /매칭 실패/.test(알림.join('\n')), 알림.join(' / '));
}
{
  const 문제 = { questions: [
    { set: 'A', number: 1, question_text: 'q1', answer: '1' }, { set: 'A', number: 1, question_text: 'q1 again', answer: '1' }] };
  const { 결과, 알림 } = 병합([{ name: 'q', data: 문제 }]);
  재기('같은 세트·번호가 두 번이면 null', 결과 === null);
  재기('중복을 알린다', /중복/.test(알림.join('\n')), 알림.join(' / '));
}
{
  const 문제 = { questions: [
    { id: 'X1', set: 'A', number: 1, question_text: 'q1', answer: '1' }, { id: 'X1', set: 'A', number: 2, question_text: 'q2', answer: '2' }] };
  const { 결과 } = 병합([{ name: 'q', data: 문제 }]);
  재기('같은 id 가 두 번이면 null', 결과 === null);
}
{
  const 문제 = { questions: [{ set: 'A', number: 1, question_text: 'q1' }] };
  const 정답 = { answers: [{ set: 'A', number: 1, correct_text: '1' }, { set: 'A', number: 1, correct_text: '1' }] };
  const { 결과 } = 병합([{ name: 'q', data: 문제 }, { name: 'a', data: 정답 }]);
  재기('정답 파일에 같은 문항이 두 번이면 null', 결과 === null);
}
{
  // 정답 파일 없이 문제만 — 옛날처럼 그대로 지나간다
  const 문제 = { questions: [{ set: 'A', number: 1, question_text: 'q1', answer: '1' }] };
  const { 결과 } = 병합([{ name: 'q', data: 문제 }]);
  재기('정답 파일이 없으면 예전처럼 통과', Array.isArray(결과) && 결과.length === 1);
}

// ── ③ ④ ⑤ 등록 ───────────────────────────────────────────
console.log('\n── ③④⑤ 등록이 정보를 서버까지 가져가고, 다시 읽어 확인한다');
const 등록소스 =
  떼기('function _hwJsonToSetQuestion(', '\n}\n') + '\n}\n' +
  떼기('function _hwContentHash(', '\n}\n') + '\n}\n' +
  떼기('async function _MR등록확인(', '\n}\n') + '\n}\n' +
  떼기('async function doImportHwJson(yr) {', '\n// ── TS Student Functions');

function 등록세상({ 서버칸, 쓰기망가뜨림, 파일 }) {
  const 서버 = { homeworkSets: 서버칸 ? { AU_y5_2026_m10_w1: 복(서버칸) } : {} };
  const 상태 = { 서랍: { currentPeriod: { year: 2026, month: 10, week: 1 }, homeworkSets: {}, users: [] },
                 알림: [], 경고: [], 몸: [], 태깅받음: [] };
  const 읽기 = (path) => { let v = 서버; for (const m of path.split('/')) v = (v == null ? undefined : v[m]); return v; };
  const w = { fbReady: true, isPreviewMode: false, TAXONOMY_MR: { ok: 1 }, _hwJsonFixes: {} };
  w.FB_REF = { child: (path) => ({ once: async () => {
    const v = 읽기(path);
    return { exists: () => v != null, val: () => (v == null ? null : 복(v)) };
  } }) };
  const 미리보기 = { dataset: { parsed: JSON.stringify(파일) } };
  const 값 = {
    window: w,
    getStore: () => 상태.서랍,
    saveStore: (d) => { 상태.서랍 = d; return true; },
    showBackupToast: (m) => 상태.알림.push(m),
    alert: (m) => 상태.경고.push(String(m)),
    confirm: () => true,
    renderTeacher: () => {},
    hwKey: (y, c, p, g) => c + '_y' + y + (g ? '-' + g : '') + '_' + p.year
                         + '_m' + String(p.month).padStart(2, '0') + '_w' + p.week,
    _칸맞추기: async (key) => { const v = 읽기('homeworkSets/' + key); return v ? 복(v) : null; },
    _칸못맞춤알림: () => 상태.알림.push('못맞춤'),
    _countSubmittedAt: () => 0,
    _archiveAndClearSubmissions: () => {},
    fbWrite: () => {},
    // 서버 쓰기 — 가지별로 받아 서버에 반영하고 결과를 알린다
    fbSetHomeworkSet: (key, data, 빼기, 끝) => {
      if (!쓰기망가뜨림) {
        서버.homeworkSets[key] = 서버.homeworkSets[key] || {};
        for (const k of Object.keys(data)) if (!(빼기 || []).includes(k)) 서버.homeworkSets[key][k] = 복(data[k]);
        if (쓰기망가뜨림 === undefined && 상태.서버손질) 상태.서버손질(서버.homeworkSets[key]);
      }
      if (끝) 끝(!쓰기망가뜨림);
    },
    fbSetHomeworkMaths: () => { throw new Error('등록은 확인 가능한 쓰기(fbSetHomeworkSet + 끝)로 가야 한다'); },
    tagQuestions: async (qs) => { 상태.태깅받음.push(qs.map(q => q.id)); qs.forEach(q => { q.taxonomy_id = 'MR.AI.TAG'; }); },
    showTaggingReviewModal: () => { 상태.확인창 = true; },
    AUTO_TAG_ENABLED: false,
    _katexToMixed: (s) => s,
    selectedCountry: 'AU', selectedGroup: '',
    document: {
      getElementById: (id) => (id === 'hwJsonPreview_5' ? 미리보기 : null),
      createElement: () => ({ style: {}, set textContent(t) { 상태.몸.push(t); }, remove() {} }),
      body: { appendChild: () => {} },
    },
    setTimeout: () => 0,
    console,
  };
  const 이름 = Object.keys(값);
  상태.F = new Function(...이름, 등록소스 + '\n; return {doImportHwJson, _MR등록확인, _hwContentHash};')(
    ...이름.map(k => 값[k]));
  상태.서버 = 서버;
  return 상태;
}

const 파일 = { A: { title: 'Fractions', questions: [
  { number: 1, id: 'T5W1_A_01', question_text: 'q1', type: 'SA', answer: '2', explanation: 'e1',
    taxonomy_id: 'MR.Y5.NA.FR.add', source: 'ICAS' },
  { number: 2, id: 'T5W1_A_02', question_text: 'q2', type: 'SA', answer: '3', explanation: 'e2' },
] } };

(async () => {
  {
    const s = 등록세상({ 파일 });
    await s.F.doImportHwJson(5);
    const 세트 = (((s.서버.homeworkSets.AU_y5_2026_m10_w1 || {}).sets) || [])[0] || {};
    const [a, b] = 세트.questions || [{}, {}];
    재기('서버에 세트가 써졌다', (세트.questions || []).length === 2, JSON.stringify(s.경고));
    재기('문항 id 는 q0·q1 그대로(제출 답 열쇠)', a.id === 'q0' && b.id === 'q1', JSON.stringify([a.id, b.id]));
    재기('원래 id 가 srcId 로 남는다', a.srcId === 'T5W1_A_01' && b.srcId === 'T5W1_A_02', JSON.stringify([a.srcId, b.srcId]));
    재기('파일의 분류가 서버까지 간다', a.taxonomy_id === 'MR.Y5.NA.FR.add', a.taxonomy_id);
    재기('출처가 서버까지 간다', a.source === 'ICAS', a.source);
    재기('정답·해설이 서버까지 간다', a.answer === '2' && a.explanation === 'e1' && b.answer === '3');
    // [1단계 추가 · 2026-10-01 원장 결정] 자동 분류(유료 API)는 끈다 — 분류 없는 문항은 분류 없이 등록
    재기('AI 자동 분류를 부르지 않는다', s.태깅받음.length === 0, JSON.stringify(s.태깅받음));
    재기('분류 없던 문항은 분류 없이 등록된다', !b.taxonomy_id, b.taxonomy_id);
    재기('파일 분류만으로는 「자동 태깅 확인」 창을 띄우지 않는다', !s.확인창, '');
    재기('다시 읽어 맞으면 「등록 완료」', s.몸.some(t => /등록 완료/.test(t)), JSON.stringify(s.몸));
  }
  {
    const s = 등록세상({ 파일, 쓰기망가뜨림: true });
    await s.F.doImportHwJson(5);
    재기('서버 쓰기가 실패하면 「완료」를 띄우지 않는다', !s.몸.some(t => /완료/.test(t)), JSON.stringify(s.몸));
    재기('실패를 알린다', [...s.경고, ...s.알림].some(t => /확인 실패|저장 실패|실패/.test(t)), JSON.stringify([s.경고, s.알림]));
  }
  {
    const s = 등록세상({ 파일 });
    s.서버손질 = (칸) => { 칸.sets[0].questions.pop(); };   // 서버에 한 문항이 덜 들어갔다
    await s.F.doImportHwJson(5);
    재기('다시 읽은 문항 수가 다르면 「완료」가 아니다', !s.몸.some(t => /등록 완료/.test(t)), JSON.stringify(s.몸));
    재기('어긋남을 알린다', [...s.경고, ...s.알림].some(t => /확인 실패/.test(t)), JSON.stringify([s.경고, s.알림]));
  }
  {
    const s = 등록세상({ 파일 });
    s.서버손질 = (칸) => { 칸.sets[0].questions[0].answer = 'X'; };   // 내용이 바뀌어 들어갔다
    await s.F.doImportHwJson(5);
    재기('다시 읽은 내용 지문이 다르면 「완료」가 아니다', !s.몸.some(t => /등록 완료/.test(t)), JSON.stringify(s.몸));
  }
  {
    // 자동 분류 스위치 — 꺼져 있으면 tagQuestions 가 AI 를 부르지 않는다
    재기('AUTO_TAG_ENABLED 가 false 로 박혀 있다', /const AUTO_TAG_ENABLED = false;/.test(html));
    const tq = 떼기('async function tagQuestions(questions, year) {', '\n// ── ANSWER VERIFICATION');
    let 불림 = 0;
    const tagQ = new Function('AUTO_TAG_ENABLED', 'window', 'callAI', 'flattenTaxonomySubskills', 'parseTaggingResponse', 'console',
      tq + '\n; return tagQuestions;')(false, { TAXONOMY_MR: {} }, async () => { 불림++; return '{}'; },
      () => [{ id: 'MR.X', name: 'x' }], () => ({}), { warn() {}, log() {} });
    const r = await tagQ([{ num: 1, text: 'q' }], 5);
    재기('스위치가 꺼져 있으면 tagQuestions 가 AI 를 안 부른다', 불림 === 0 && r.skipped === true, JSON.stringify(r));
    const 저장 = 떼기('async function doSave(', '\nfunction ');
    재기('수동 세트 저장(doSave)도 스위치를 본다', /AUTO_TAG_ENABLED/.test(저장));
  }
  {
    // 지문은 그림 떼기(figure → 번호)에 흔들리지 않아야 한다
    const s = 등록세상({ 파일 });
    const h1 = s.F._hwContentHash([{ id: 'q0', text: 't', answer: '1', figure: '<svg/>' }]);
    const h2 = s.F._hwContentHash([{ id: 'q0', text: 't', answer: '1', figure: { ref: 'f1' } }]);
    재기('지문은 그림 칸을 보지 않는다', h1 === h2);
    const h3 = s.F._hwContentHash([{ id: 'q0', text: 't', answer: '2' }]);
    재기('정답이 바뀌면 지문이 바뀐다', h1 !== h3);
  }
  console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
  process.exit(실패 ? 1 : 0);
})().catch(e => { console.log('  ⛔ 터졌다: ' + (e && e.stack || e)); console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + (실패 + 1)); process.exit(1); });
