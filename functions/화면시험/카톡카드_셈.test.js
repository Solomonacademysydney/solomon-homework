// 카톡 카드(kakao-report.js)의 셈이 지시서 v7 대로 나오는가 — 가짜 학생(Ben03)만 쓴다.
//
//   node functions/화면시험/카톡카드_셈.test.js
//
// 보는 것: 분모(제출한 세트만·빈칸=오답) · 바뀐 숙제 뺌 · 칭찬 최소 75% · 단원 오답 합계 = 실제 오답 ·
//          TS 영역 합치기·단계 최빈값(동률 높은 쪽) · 매핑 없는 유형 · 숙제 없는 주 · 장 수 · 내부 slug 안 보임

'use strict';
const path = require('path');
const fs = require('fs');
const KR = require(path.join('E:/aa0/hp', 'kakao-report.js'));

// index.html 의 채점 정규화를 그대로 떼어 쓴다(같은 채점 규칙)
const 본 = fs.readFileSync('E:/aa0/hp/index.html', 'utf8');
const i0 = 본.indexOf('function normAns(a) {');
const i1 = 본.indexOf('\nfunction ', i0 + 10);
const normAns = new Function(본.slice(i0, i1) + '\n; return normAns;')();

let 통과 = 0, 실패 = 0;
function 재기(이름, 얻은, 바란) {
  const a = JSON.stringify(얻은), b = JSON.stringify(바란);
  if (a === b) { 통과++; console.log('  ✅ ' + 이름 + '  → ' + a); }
  else { 실패++; console.log('  ⛔ ' + 이름 + '\n       얻은 ' + a + '\n       바란 ' + b); }
}

function mset(title, n, tax) {
  return { title, questions: Array.from({ length: n }, (_, i) => ({ id: 'q' + i, type: 'mc', answer: 'A', ...(tax ? { taxonomy_id: tax(i) } : {}) })) };
}
function msub(n, right, extra) {   // 앞 right 개 정답, 나머지 오답
  const answers = {}; for (let i = 0; i < n; i++) answers['q' + i] = i < right ? 'A' : 'B';
  return Object.assign({ submitted: true, answers }, extra || {});
}
const ST = { id: 'Ben03', name: '벤', year: 4 };

console.log('── Math 분모 · 바뀐 숙제 · 빈칸');
{
  const hw = { sets: [mset('Set 1 (Selective Prep · Data and Graphs II · Set 1)', 20), mset('Set 2 (Selective Prep · Data and Graphs II · Set 2)', 20),
                      mset('Set 3 (Selective Prep · Data and Graphs II · Set 3)', 20), mset('Set 4 (Y7 NP The Number Plane - Set 4)', 20)] };
  const s3 = msub(20, 0); delete s3.answers.q5;   // 빈칸 하나 → 오답
  const m = KR.compute({ student: ST, hw, subs: { 0: msub(20, 19), 1: msub(20, 18), 2: msub(20, 10) }, stale: { 2: true }, normAns, periodText: 'x', periodKey: 'k' });
  재기('완료 세트(바뀐 숙제도 제출은 셈)', [m.math.doneSets, m.math.totalSets], [2, 4]);
  재기('정답/분모 — 바뀐 숙제·미제출 세트 뺌', [m.math.correct, m.math.total], [37, 40]);
  재기('바뀐 숙제 세트 상태', m.math.sets[2].status, 'stale');
  재기('바뀐 숙제 알림', m.warn.some(w => w.includes('숙제가 바뀌어 확인 필요')), true);
  재기('세트 제목 줄이기', m.math.sets[3].title, 'Set 4 · The Number Plane');
  재기('정답률 판정 92.5% = 잘함', m.math.band, 'good');
  재기('남은 세트 문장은 따로', m.edit.check.split('\n')[0], 'Math 개념을 잘 익혔습니다. 남은 세트를 마쳐야 합니다.');
  const m2 = KR.compute({ student: ST, hw: { sets: [hw.sets[0]] }, subs: { 0: s3 }, stale: {}, normAns });
  재기('빈칸은 오답(0/20) 이지만 답 하나도 없음은 아님', [m2.math.correct, m2.math.total], [0, 20]);
  const m3 = KR.compute({ student: ST, hw: { sets: [hw.sets[0]] }, subs: { 0: { submitted: true } }, stale: {}, normAns });
  재기('답이 하나도 없는 제출 → 정답률에서 뺌 + 알림', [m3.math.total, m3.warn.some(w => w.includes('답이 하나도 없음'))], [0, true]);
}

console.log('\n── 정답률 경계(판정은 원값)');
재기('74.6% → 연습 필요', KR.band(746, 1000), 'mid');
재기('75% → 잘함', KR.band(15, 20), 'good');
재기('49.9% → 다시 학습', KR.band(499, 1000), 'low');
재기('4문항 → 추가 확인 필요', KR.band(4, 4), 'few');

console.log('\n── 잘한 점 · 다시 볼 점 (그 주 답안에서 · 칭찬 최소 75%)');
{
  // 분류 있는 세트: 갈래 NUM 10문항, GEO 6문항, 이름 모르는 갈래 4문항
  const tax = i => i < 10 ? 'MR.Y4.NUM.RATIO.X' + i : i < 16 ? 'MR.Y4.GEO.ANGLE.Y' + i : 'MR.Y4.ZZZ.Q' + i;
  const hw = { sets: [mset('Set 1 (A · Set 1)', 20, tax)] };
  // NUM 10 중 6 정답(60%), GEO 6 중 3(50%), ZZZ 4 중 0
  const ans = {}; for (let i = 0; i < 20; i++) ans['q' + i] = (i < 6 || (i >= 10 && i < 13)) ? 'A' : 'B';
  const m = KR.compute({ student: ST, hw, subs: { 0: { submitted: true, answers: ans } }, stale: {}, normAns });
  재기('75% 넘는 단원 없음 → 중립 칭찬', m.math.praise, '이번 주 숙제를 끝까지 풀었습니다.');
  재기('「거의 실수 없이」 안 나옴', /거의 실수 없이/.test(m.math.praise), false);
  재기('다시 볼 점 = 오답 최다 단원', m.math.review, '수와 계산에서 오답이 4문항 있습니다.');
  재기('단원 오답 + 분류 없음 오답 = 실제 오답', [m.math.check.wrongByUnits, m.math.check.wrong, m.math.check.ok], [11, 11, true]);
  재기('분류 없는 문항 알림', m.warn.some(w => w.includes('분류 없는 문항 4개')), true);
  const ans2 = {}; for (let i = 0; i < 20; i++) ans2['q' + i] = i < 10 ? 'A' : 'B';
  const mm = KR.compute({ student: ST, hw, subs: { 0: { submitted: true, answers: ans2 } }, stale: {}, normAns });
  재기('100% 단원 → 거의 실수 없이', mm.math.praise, '수와 계산은 거의 실수 없이 정확합니다.');
  // 분류 없는 세트 → 세트 제목 단원
  const mn = KR.compute({ student: ST, hw: { sets: [mset('Set 1 (Selective Prep · Data and Graphs II · Set 1)', 20)] }, subs: { 0: msub(20, 16) }, stale: {}, normAns });
  재기('분류 없는 세트는 제목 단원(80%)', mn.math.praise, 'Data and Graphs II를 잘 풀었습니다.');
}

console.log('\n── Thinking Skills (n일차 · 맞힌 수 = 결국 맞힘 · 힌트 = 그중 한 번에 못 맞힌 것)');
{
  const tq = [
    ...Array(4).fill('TS.conclusion-must-be-true.L2'), ...Array(4).fill('TS.conclusion-cannot-be-true.L3'),
    ...Array(6).fill('TS.weaken.L4'), ...Array(3).fill('TS.matching-arguments.L2'), '', 'TS.pattern', 'TS.pattern.L1'
  ].map((t, i) => ({ id: 'ts' + i, taxonomy_id: t }));
  const ts = { enabled: true, questions: tq.concat(tq.map(q => Object.assign({}, q))), day_config: { total_days: 2, questions_per_day: 20 } };
  const ans = {};
  for (let i = 0; i < 20; i++) ans['q' + i] = i % 2 === 0 ? { attempts: 1, correct: true } : { attempts: 2, correct: true };
  ans.q2 = { attempts: 1, correct: true, hint1_used: true };   // 힌트 쓰면 정답 아님
  const m = KR.compute({ student: ST, hw: { sets: [], ts }, subs: {}, stale: {}, normAns, tsProgress: { day1: { completed: true, answers: ans }, day2: { completed: false, answers: {} } } });
  재기('Math 없음 → math null', m.math, null);
  재기('완료 1/2일(끝내지 않은 날은 미제출)', [m.ts.doneSets, m.ts.totalSets], [1, 2]);
  재기('분모 = 끝낸 날 문항만', m.ts.total, 20);
  재기('맞힌 수(힌트 포함) · 힌트 수', [m.ts.correct, m.ts.hint], [20, 11]);
  재기('일차 이름', m.ts.sets[0].title, '1일차');
  재기('카드에 「20/20 · 힌트 11」', /20\/20<span class="kr-hint"> · 힌트 11<\/span>/.test(KR.renderCards(m).join('')), true);
  // 션 11월 1주 1일차 꼴: 한 번에 1 · 힌트 보고 2 · 정답 봄 1 → 3/4 · 힌트 1이 아니라 「3/4 · 힌트 2」
  const sean = KR.computeTs({ enabled: true, questions: [{}, {}, {}, {}], day_config: { total_days: 1, questions_per_day: 4 } },
    { day1: { completed: true, answers: {
      q0: { attempts: 1, correct: true }, q1: { attempts: 3, correct: false, hint1_used: true, hint2_used: true, revealed: true },
      q2: { attempts: 2, correct: true, hint1_used: true }, q3: { attempts: 2, correct: true, hint1_used: true } } } });
  재기('정답을 본 문제는 틀림 · 힌트 보고 맞힌 것은 맞힘', [sean.sets[0].correct, sean.sets[0].total, sean.sets[0].hint], [3, 4, 2]);
  const dc = m.ts.areasAll.find(a => a.name === 'Drawing Conclusions');
  재기('같은 영역 두 slug → 한 줄', m.ts.areasAll.filter(a => a.name === 'Drawing Conclusions').length, 1);
  재기('합친 줄 문항 수', dc.total, 8);
  재기('단계 최빈값 동률(L2 4·L3 4) → 높은 쪽', dc.level, 3);
  재기('매핑 없는 유형 알림', m.warn.some(w => w.includes('매핑 없는 유형 1개')), true);
  재기('유형 없는 문항 알림', m.warn.some(w => w.includes('유형 없는 문항 1개')), true);
  const pat = m.ts.areasAll.find(a => a.name === 'Pattern');
  재기('단계 없는 문항은 단계에서만 뺌(정답률엔 넣음)', [pat.total, pat.level], [2, 1]);
  재기('영역 검산(보이는 + 숨긴 = 전체)', m.ts.check.ok, true);
  재기('최대 4줄', m.ts.areas.length <= 4, true);
  const html = KR.renderCards(m).join('');
  재기('장 수(TS만) = 2', KR.renderCards(m).length, 2);
  재기('카드에 내부 slug 안 보임', /matching-arguments|conclusion-must|TS\./.test(html), false);
  재기('마지막 카드에 연락처', /0424 743 564/.test(KR.renderCards(m)[1]), true);
}

console.log('\n── 숙제 없는 주 · 비공개 · 장 수');
재기('숙제 없음', KR.compute({ student: ST, hw: null, subs: {}, stale: {}, normAns }).noHomework, true);
재기('비공개는 없음으로', KR.compute({ student: ST, hw: { published: false, sets: [mset('Set 1', 5)] }, subs: {}, stale: {}, normAns }).noHomework, true);
{
  const m = KR.compute({ student: Object.assign({}, ST, { classMode: 'online' }), hw: { sets: [mset('Set 1 (A)', 10)] }, subs: {}, stale: {}, normAns, periodText: '11월 2일–6일', periodKey: '2026_m11_w1' });
  const cards = KR.renderCards(m);
  재기('Math만 → 2장', cards.length, 2);
  재기('하나도 안 냄 → 아직 시작 전', /아직 시작 전/.test(cards[0]), true);
  재기('정답률 칸 –', />–</.test(cards[0]), true);
  재기('온라인 표기', /벤 · 온라인/.test(cards[0]) && /Online/.test(cards[0]), true);
  재기('원장 한마디는 2번(마지막) 카드에', /원장 선생님 한마디/.test(cards[1]), true);
  재기('자리표시 기본값에 있음', m.edit.message.includes(KR.PLACEHOLDER), true);
  재기('다음 주 없음 → 배정 예정', m.edit.nextMath, '배정 예정');
  재기('다음 주 없음 → 처음엔 카드에서 뺌', [m.edit.showNextMath, /다음 주 Math 숙제/.test(cards.join(''))], [false, false]);
  const on = KR.renderCards(Object.assign({}, m, { edit: Object.assign({}, m.edit, { showNextMath: true }) })).join('');
  재기('체크하면 카드에 넣음', /다음 주 Math 숙제/.test(on), true);
  const mn = KR.compute({ student: ST, hw: { sets: [mset('Set 1 (A)', 10)] }, subs: {}, stale: {}, normAns, nextHw: { sets: [mset('Set 1 (Selective Prep · Fractions · Set 1)', 10)] } });
  재기('다음 주 배정 있음 → 처음부터 넣음', [mn.edit.showNextMath, mn.edit.nextMath], [true, '1세트 · Fractions']);
}
재기('조사(받침)', [KR.josa('분수', '은', '는'), KR.josa('도형', '은', '는')], ['는', '은']);

console.log(`\n── 셈 — 통과 ${통과} · 실패 ${실패}`);
process.exit(실패 ? 1 : 0);
