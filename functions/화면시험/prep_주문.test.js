// /prep/ 4단계 — 주간 설정 · 기본값 · 제작 주문 셈(prep/order_core.js)
//   지시서 완료 기준: 0·생략·MR만·TS 합본·혼합 비율·자유 지시가 주문 명세에 정확히 반영.
//   · 문항 수 0 이상 정수 · 비율 0~100 · 세트 수×문항 수와 합계 일치 · 상충 요청은 생성 전 표시
//   · 계산기 % 는 정수 문항 수로(반올림 기준 표시) · 지난 승인값과 현재 커리를 나눠 미리 채움 · 바뀐 값·「이번 주만」 표시
'use strict';
const fs = require('fs');
const path = require('path');
const 파일 = path.join(__dirname, '..', '..', 'prep', 'order_core.js');
let 통과 = 0, 실패 = 0;
function 재기(이름, 참, 덧) { if (참) { 통과++; console.log('  ✅ ' + 이름); } else { 실패++; console.log('  ⛔ ' + 이름 + (덧 ? '\n       ' + 덧 : '')); } }
if (!fs.existsSync(파일)) { console.log('  ⛔ prep/order_core.js 가 없다'); console.log('\n셈 — 통과 0 · 실패 1'); process.exit(1); }
const O = require(파일);

console.log('── 서버 사본이 글자째 같다');
{
  const 서버 = path.join(__dirname, '..', 'order_core.js');
  재기('functions/order_core.js = prep/order_core.js', fs.existsSync(서버) && fs.readFileSync(서버, 'utf8') === fs.readFileSync(파일, 'utf8'));
}

const 기본 = O.defaultSettings();
const 복 = (v) => JSON.parse(JSON.stringify(v));

console.log('\n── 기본값 · 검사');
{
  재기('기본값은 검사를 통과', O.validateSettings(기본).ok, JSON.stringify(O.validateSettings(기본)));
  const 고침 = (f) => { const s = 복(기본); f(s); return O.validateSettings(s); };
  재기('음수 문항 → 거절', !고침(s => { s.paperHw.perSet[0].mr = -1; }).ok);
  재기('소수 문항 → 거절', !고침(s => { s.mr.units[0].practice = 2.5; }).ok);
  재기('비율 100 넘음 → 거절', !고침(s => { s.composition.calculatorPct = 120; }).ok);
  재기('기본·표준·도전 비중 합이 100 이 아니면 거절', !고침(s => { s.difficulty.mix = { basic: 50, standard: 30, challenge: 30 }; }).ok);
  재기('객관식·단답·서술 합이 100 이 아니면 거절', !고침(s => { s.composition.mcPct = 90; }).ok);
  재기('세트 수와 세트별 칸 수가 다르면 거절', !고침(s => { s.paperHw.sets = 3; }).ok);
  재기('목표 수준 1~5 밖 → 거절', !고침(s => { s.difficulty.target = 9; }).ok);
}

console.log('\n── 상충 — 생성 전에 표시');
{
  const s = 복(기본); s.ts.include = false; s.paperHw.perSet = [{ mr: 20, ts: 10 }, { mr: 20, ts: 10 }];
  const v = O.validateSettings(s);
  재기('TS 제외인데 숙제에 TS → 상충', v.conflicts.some(c => /TS/.test(c)), JSON.stringify(v));
  const s2 = 복(기본); s2.mr.review = { integrated: true, questions: 0, sets: 2 };
  재기('종합문제 세트 2 인데 문항 0 → 상충', O.validateSettings(s2).conflicts.length > 0);
  const s3 = 복(기본); s3.frontTest = Object.assign(s3.frontTest, { mode: 'normal', includeMR: false, includeTS: false });
  재기('앞장 테스트인데 MR·TS 둘 다 뺌 → 상충', O.validateSettings(s3).conflicts.length > 0);
}

console.log('\n── 주문 명세 — 0 · 생략 · MR만 · TS 합본 · 혼합 비율');
{
  const s = 복(기본);
  s.mr.review = { integrated: false, questions: 0, sets: 0 };            // 0 → 생략
  s.frontTest.mode = 'skip';                                               // 첫 수업 생략
  const 명 = O.specFromSettings(s, { studentId: 'Mina', lessonDate: '2026-10-07' });
  재기('종합문제 0 → 명세에서 빠짐', !명.parts.some(p => p.kind === 'mr-review'), JSON.stringify(명.parts.map(p => p.kind)));
  재기('앞장 테스트 생략 → 명세에서 빠짐', !명.parts.some(p => p.kind === 'front-test'));
  const m = 복(기본); m.ts.include = false; m.paperHw.perSet = m.paperHw.perSet.map(x => ({ mr: x.mr + x.ts, ts: 0 }));
  const 명2 = O.specFromSettings(m, { studentId: 'Aron', lessonDate: '2026-10-07' });
  재기('MR만 → TS 부분 없음 · 숙제 TS 0', !명2.parts.some(p => /^ts/.test(p.kind)) && 명2.parts.find(p => p.kind === 'paper-hw').sets.every(x => x.ts === 0));
  const t = 복(기본); t.ts.mode = 'combined';
  재기('TS 합본 → TS 부분 하나', O.specFromSettings(t, { studentId: 'X', lessonDate: '2026-10-07' }).parts.filter(p => p.kind === 'ts-combined').length === 1);
  const 명3 = O.specFromSettings(복(기본), { studentId: 'X', lessonDate: '2026-10-07' });
  const 숙제 = 명3.parts.find(p => p.kind === 'paper-hw');
  재기('혼합 비율 20+10 · 세트 2 → 합계 60', 숙제.total === 60 && 숙제.sets.length === 2, JSON.stringify(숙제));
  재기('난이도 비중이 명세에 그대로', JSON.stringify(명3.difficulty.mix) === JSON.stringify(기본.difficulty.mix));
}

console.log('\n── 계산기 % → 정수 문항');
{
  const c = O.calculatorCount(17, 30);
  재기('17문항 × 30% = 5.1 → 5문항(반올림 기준 표시)', c.count === 5 && /반올림/.test(c.note), JSON.stringify(c));
  재기('0% → 0', O.calculatorCount(20, 0).count === 0);
}

console.log('\n── 미리 채우기 — 지난 승인값과 커리를 나눈다');
{
  const 지난 = 복(기본); 지난.paperHw.perSet = [{ mr: 25, ts: 5 }, { mr: 25, ts: 5 }]; 지난.layout.fontSize = 13;
  const 승인 = { settings: 지난, thisWeekOnly: ['layout.fontSize'] };
  const 커리 = { lessons: [{ date: '2026-10-07', mr: '분수 덧셈', ts: '수열', reviewRatio: 40, targetLevel: 4 }] };
  const r = O.prefill(승인, 커리, '2026-10-07');
  재기('지난 승인값을 가져온다(25+5)', r.settings.paperHw.perSet[0].mr === 25);
  재기('「이번 주만」 값은 안 가져온다(글자 크기 기본으로)', r.settings.layout.fontSize === 기본.layout.fontSize);
  재기('커리의 그 수업 MR·TS 단원이 들어온다', r.settings.mr.units[0].title === '분수 덧셈' && r.settings.ts.title === '수열');
  재기('커리 목표 수준이 들어온다(L4)', r.settings.difficulty.target === 4);
  재기('어디서 왔는지 표시(승인·커리·기본)', r.source['paperHw.perSet'] === '지난 승인' && r.source['mr.units.0.title'] === '커리' && r.source['layout.fontSize'] === '기본', JSON.stringify(r.source));
  const 고침 = 복(r.settings); 고침.composition.calculatorPct = 50;
  재기('바뀐 값 표시', O.changedPaths(r.settings, 고침).join() === 'composition.calculatorPct', O.changedPaths(r.settings, 고침).join());
  재기('승인값이 없어도 된다(기본 + 커리)', O.prefill(null, 커리, '2026-10-07').settings.mr.units[0].title === '분수 덧셈');
}

console.log('\n── 자유 지시 — 해석 → 원장 확인 · 해석 불가는 보류');
{
  const r = O.interpretFreeText('이번 주는 TS 빼줘. 세트 3개로, 25+5. 계산기 30%. 종합문제 생략, 앞장 테스트 생략. 잘 부탁해요', 복(기본));
  재기('TS 빼줘 → ts.include=false · 숙제 TS 0', r.settings.ts.include === false && r.settings.paperHw.perSet.every(x => x.ts === 0), JSON.stringify(r.settings.paperHw));
  재기('세트 3개 → 세트 3', r.settings.paperHw.sets === 3 && r.settings.paperHw.perSet.length === 3);
  재기('25+5 이지만 TS 를 뺐으니 MR 30 으로 합침(상충 없이)', r.settings.paperHw.perSet.every(x => x.mr === 30 && x.ts === 0), JSON.stringify(r.settings.paperHw.perSet));
  재기('계산기 30%', r.settings.composition.calculatorPct === 30);
  재기('종합문제 생략 → 세트 0', r.settings.mr.review.sets === 0);
  재기('앞장 테스트 생략', r.settings.frontTest.mode === 'skip');
  재기('알아들은 것 목록', r.applied.length >= 5, JSON.stringify(r.applied));
  재기('못 알아들은 말은 보류(「잘 부탁해요」)', r.unresolved.length === 1 && /부탁/.test(r.unresolved[0]), JSON.stringify(r.unresolved));
  재기('해석한 설정도 검사를 통과', O.validateSettings(r.settings).ok, JSON.stringify(O.validateSettings(r.settings)));
  const 원본 = 복(기본); O.interpretFreeText('TS 빼', 원본);
  재기('원래 설정은 안 바꾼다(새 값을 돌려준다)', 원본.ts.include === 기본.ts.include);
}

console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
process.exit(실패 ? 1 : 0);
