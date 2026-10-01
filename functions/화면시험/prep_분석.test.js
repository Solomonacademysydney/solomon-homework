// /prep/ 3-A — 학생 목록·카드 셈(prep/prep_core.js)
//   ① 날짜→숙제 주차가 학생 화면 getTodayPeriod 와 **같다**(날짜 900개)
//   ② 숙제 칸 고르기가 학생 화면 hwLookup·hwKey 와 **같다** · 개인 배정 우선
//   ③ 내일 수업 학생이 먼저 · 「지난주」 = 직전 수업과 분석 기간
//   ④ 지난 숙제 분석 — 점수·미답·원장 처리 · TS 첫 시도·힌트 · **같은 제출은 한 번만**
//   ⑤ 약점 상위 — 안전 키·옛 점 열쇠를 원문으로 묶는다
'use strict';
const fs = require('fs');
const path = require('path');
const C = require(path.join(__dirname, '..', '..', 'prep', 'prep_core.js'));
const html = fs.readFileSync('E:/aa0/hp/index.html', 'utf8');
let 통과 = 0, 실패 = 0;
function 재기(이름, 참, 덧) { if (참) { 통과++; console.log('  ✅ ' + 이름); } else { 실패++; console.log('  ⛔ ' + 이름 + (덧 ? '\n       ' + 덧 : '')); } }
function 떼기(시작, 끝표) { const i = html.indexOf(시작); if (i < 0) throw new Error('못 찾음: ' + 시작); return html.slice(i, html.indexOf(끝표, i + 10)); }
const normAns = new Function(떼기('function normAns(a) {', '\n}\n') + '\n}\n; return normAns;')();

console.log('── ① 날짜 → 숙제 주차가 학생 화면과 같다');
{
  const 소스 = 떼기('function getTodayPeriod() {', '\n}\n') + '\n}\n';
  let 다름 = [];
  for (let i = 0; i < 900; i++) {
    const 날 = new Date(2025, 0, 1 + i, 12, 0, 0);
    const 가짜Date = function (...a) { return a.length ? new Date(...a) : new Date(날.getTime()); };
    const g = new Function('Date', 소스 + '; return getTodayPeriod;')(가짜Date)();
    const p = C.periodOfDate(날);
    if (!C.samePeriod(g, p)) 다름.push(C.ymd(날) + ' 화면 ' + JSON.stringify(g) + ' · prep ' + JSON.stringify(p));
  }
  재기('900일(2025-01-01~) 모두 같다', 다름.length === 0, 다름.slice(0, 3).join(' | '));
}

console.log('\n── ② 숙제 칸 고르기가 학생 화면과 같다');
{
  const 화면 = new Function(떼기('function hwKey(yearLevel, country, p, group) {', '\n// ★ [2026-08-30') + '\n; return { hwKey, hwLookup: ' + 떼기('function hwLookup(store, yearLevel, country, p, group) {', '\n}\n').replace('function hwLookup', 'function') + '\n} };')();
  const p = { year: 2026, month: 10, week: 1 };
  const 칸 = { AU_y5_2026_m10_w1: { sets: [{ title: '공통' }] }, 'AU_y7-민준_2026_m10_w1': { sets: [{ title: '민준반' }] }, AU_y7_2026_m10_w1: { sets: [{ title: 'Y7 공통' }] } };
  const 아이들 = [{ id: 'A', year: 5, group: '' }, { id: 'B', year: 5, group: '없는반' }, { id: 'C', year: 7, group: '민준' }, { id: 'D', year: 9, group: '' }];
  for (const u of 아이들) {
    const 화면칸 = 화면.hwLookup({ homeworkSets: 칸 }, u.year, 'AU', p, u.group);
    const v = C.viewForTeacher(u, p, 칸, {});
    재기(u.id + ': 같은 칸', (화면칸 || null) === (v.hw || null), JSON.stringify([화면칸 && 화면칸.sets[0].title, v.hw && v.hw.sets[0].title]));
  }
  재기('hwKey 글자도 같다', 화면.hwKey(7, 'AU', p, '민준') === C.hwKey(7, 'AU', p, '민준'));
  const 개인 = { R1: { studentId: 'A', published: true, period: p, sets: { s1: { title: '개인' } } } };
  재기('개인 배정이 있으면 그것(그룹 칸이 있어도)', C.viewForTeacher(아이들[0], p, 칸, 개인).kind === 'personal');
  const 비공개 = { R1: { studentId: 'A', published: false, period: p, sets: {} } };
  재기('개인 배정 비공개 → 준비 중(그룹으로 안 바꿈)', C.viewForTeacher(아이들[0], p, 칸, 비공개).kind === 'pending');
}

console.log('\n── ③ 목록 차례 · 「지난주」');
{
  const 오늘 = new Date(2026, 9, 1, 12);   // 2026-10-01 목
  const 아이들 = [{ id: 'Mon', name: '가', days: ['mon'] }, { id: 'Fri', name: '나', days: ['금'] }, { id: 'None', name: '다' }, { id: 'Sat', name: '라', days: ['sat'] }];
  const 차례 = C.orderStudents(아이들, { None: [3, 'wed'] }, 오늘).map(x => x.user.id);
  재기('내일(금) 수업 학생이 맨 앞', 차례[0] === 'Fri', 차례.join(','));
  재기('그다음 가까운 수업일 차례(토 → 월 → 수)', 차례.join(',') === 'Fri,Sat,Mon,None', 차례.join(','));
  재기('한글 요일·출석표 요일도 읽는다', C.classDaysOf(아이들[1], {}).join() === 'fri' && C.classDaysOf(아이들[2], { None: [3, 'wed'] }).join() === 'wed');
  const 출석 = { '2026-09-22': { Mon: 'present' }, '2026-09-29': { Mon: 'absent' }, '2026-10-06': { Mon: 'present' } };
  const w = C.analysisWindow({ id: 'Mon', days: ['mon'] }, 출석, {}, 오늘);
  재기('직전 수업 = 오늘 이전 마지막 기록(미래 기록 무시)', w.lastClass === '2026-09-29' && w.prevClass === '2026-09-22', JSON.stringify(w));
  재기('분석 기간 = 앞 수업 다음날 ~ 직전 수업', w.from === '2026-09-23' && w.to === '2026-09-29');
  재기('결석도 알린다', w.status === 'absent');
  const w2 = C.analysisWindow({ id: 'X', days: ['tue'] }, {}, {}, 오늘);
  재기('출석 기록이 없으면 요일로 짐작(표시)', w2.source === 'weekday' && w2.lastClass === '2026-09-29', JSON.stringify(w2));
  const ps = C.periodsInWindow({ from: '2026-09-23', to: '2026-09-29' });
  재기('분석 기간의 숙제 주차(겹치지 않게)', ps.length === 2 && C.periodKey(ps[0]) === '2026_m09_w4' && C.periodKey(ps[1]) === '2026_m10_w1', JSON.stringify(ps));
}

console.log('\n── ④ 지난 숙제 분석');
{
  const p = { year: 2026, month: 10, week: 1 };
  const u = { id: 'Mina', year: 5, country: 'AU', group: '' };
  const 칸 = { AU_y5_2026_m10_w1: { sets: [
      { title: 'S1', questions: [{ id: 'q0', answer: 'B' }, { id: 'q1', answer: '6' }, { id: 'q2', answer: '3', type: 'written' }] },
      { title: 'S2', questions: [{ id: 'q0', answer: 'A' }] },
      { title: 'S3', questions: [{ id: 'q0', answer: 'A' }] }],
    ts: { day_config: { total_days: 2 } } } };
  const 제출 = {
    Mina_2026_m10_w1_s0: { submitted: true, submitTime: 't1', answers: { q0: 'b' } },          // 1/2 · 미답 1
    Mina_2026_m10_w1_s1: { submitted: true, manuallyMarked: true, markedReason: '홈페이지 오류', answers: {} },
    ts_Mina_2026_m10_w1: { day1: { completed: true, answers: [
      { correct: true, attempts: 1 }, { correct: true, attempts: 2 }, { correct: true, attempts: 1, hint1_used: true }, { correct: false, attempts: 3 }] } },
  };
  const r = C.analyzeHomework({ user: u, periods: [p, p], homeworkSets: 칸, submissions: 제출, releases: {}, prepSubs: {}, normAns });
  재기('같은 주를 두 번 넘겨도 한 번만 센다', r.weeks[1].sets.length === 0 && r.counted.length === 4 && r.totals.sets === 3, JSON.stringify(r.counted));
  const [s1, s2, s3] = r.weeks[0].sets;
  재기('점수(서술형 뺌 · 대소문자 무시) 50 · 미답 1', s1.score === 50 && s1.unanswered === 1 && s1.total === 2, JSON.stringify(s1));
  재기('원장 처리는 점수 없이 표시', s2.manual === true && s2.score === null && s2.markedReason === '홈페이지 오류');
  재기('안 낸 세트', s3.submitted === false && s3.score === null);
  재기('평균은 원장 처리를 뺀다(50)', r.totals.avgScore === 50 && r.totals.manual === 1, JSON.stringify(r.totals));
  재기('TS 첫 시도 1/4 · 힌트 1/4', r.weeks[0].ts.firstTry === 1 && r.weeks[0].ts.hintUsed === 1 && r.weeks[0].ts.questions === 4 && r.weeks[0].ts.done === 1, JSON.stringify(r.weeks[0].ts));
  const 개인 = { R1: { studentId: 'Mina', published: true, period: p, sets: { s1: { title: '개인 S1', questions: [{ id: 'q0', answer: 'B' }, { id: 'q1', answer: '6' }] } } } };
  const 개인제출 = { R1: { Mina: { s1: { latest: 2, revs: { 1: { answers: { q0: 'A' }, grade: { score: 0 } }, 2: { answers: { q0: 'B' }, submittedAt: 't2', grade: { score: 50, correctCount: 1, total: 2 } } } } } } };
  const r2 = C.analyzeHomework({ user: u, periods: [p], homeworkSets: 칸, submissions: 제출, releases: 개인, prepSubs: 개인제출, normAns });
  재기('개인 배정 주는 그것만(그룹 세트 안 셈)', r2.weeks[0].kind === 'personal' && r2.weeks[0].sets.length === 1 && r2.totals.sets === 1);
  재기('개인 배정은 마지막 판 점수 · 미답', r2.weeks[0].sets[0].score === 50 && r2.weeks[0].sets[0].unanswered === 1, JSON.stringify(r2.weeks[0].sets[0]));
}

console.log('\n── ⑤ 약점 상위');
{
  const 줄 = (n, c) => Array.from({ length: n }, (_, i) => ({ correct: i < c }));
  const 약점 = { skills: {
    [C.taxSafeKey('MR.Y5.A.x')]: { taxonomyId: 'MR.Y5.A.x', history: 줄(3, 0) },
    'MR.Y5.A.x': { history: 줄(1, 1) },
    [C.taxSafeKey('MR.Y5.B.y')]: { history: 줄(4, 3) },
    [C.taxSafeKey('MR.Y5.C.z')]: { history: 줄(1, 0) } } };
  const t = C.weakTop(약점, 3, 2);
  재기('원문으로 묶어 정답률 낮은 순(x 25% → y 75%) · 시도 적은 것(z 1회) 뺌', t.map(x => x.taxId + ':' + x.accuracy).join() === 'MR.Y5.A.x:25,MR.Y5.B.y:75', JSON.stringify(t));
  재기('안전 키는 학생 화면과 같은 글자', C.taxSafeKey('MR.Y5.A.x') === new Function(떼기('function taxSafeKey(taxId) {', '\n}\n') + '\n}\n; return taxSafeKey;')()('MR.Y5.A.x'));
}

console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
process.exit(실패 ? 1 : 0);
