// prep_worker/core.js 시험 — node prep_worker/시험/core.test.js
'use strict';
const path = require('path');
const C = require(path.join(__dirname, '..', 'core'));
const O = require(path.join(__dirname, '..', '..', 'prep', 'order_core'));
let 통과 = 0, 실패 = 0;
function 재기(이름, 참, 덧) { if (참) { 통과++; console.log('  ✅ ' + 이름); } else { 실패++; console.log('  ⛔ ' + 이름 + (덧 ? '\n       ' + 덧 : '')); } }

console.log('── 명세 → 만들 칸');
const s = O.defaultSettings(); s.mr.units[0].title = '분수 덧셈'; s.ts.title = '규칙 찾기';
const spec = O.specFromSettings(s, { studentId: 'emu5', lessonDate: '2026-10-06' });
const slots = C.slotsFromSpec(spec, { prevUnit: '분수 개념' });
const 센 = (f) => slots.filter(f).length;
재기('앞장 테스트 10 = MR 7 + TS 3, MR 은 지난 범위', 센(x => x.section === 'test' && x.src === 'mr') === 7 && 센(x => x.section === 'test' && x.src === 'ts') === 3
  && slots.filter(x => x.section === 'test' && x.src === 'mr').every(x => x.unit === '분수 개념'));
재기('교재 MR = 예제 3 + 연습 10 + 종합 10', 센(x => x.part === 'mr-unit-example') === 3 && 센(x => x.part === 'mr-unit-practice') === 10 && 센(x => x.part === 'mr-review') === 10);
재기('교재 TS = 예제 2 + 연습 8', 센(x => x.section === 'book' && x.src === 'ts') === 10);
재기('종이 숙제 = (20+10)×2', 센(x => x.section === 'hw' && x.src === 'mr') === 40 && 센(x => x.section === 'hw' && x.src === 'ts') === 20);
재기('칸 id 가 겹치지 않는다', new Set(slots.map(x => x.id)).size === slots.length);
const pr = slots.filter(x => x.part === 'mr-review');
재기('난이도 30/50/20 → 종합 10문항 3·5·2', pr.filter(x => x.difficulty === 'basic').length === 3 && pr.filter(x => x.difficulty === 'standard').length === 5 && pr.filter(x => x.difficulty === 'challenge').length === 2);
재기('꼴 60/30/10 → 10문항 6·3·1', pr.filter(x => x.type === 'mc').length === 6 && pr.filter(x => x.type === 'sa').length === 3 && pr.filter(x => x.type === 'written').length === 1);
const s2 = O.defaultSettings(); s2.composition.calculatorPct = 30; s2.ts.include = false; s2.paperHw.perSet = [{ mr: 30, ts: 0 }, { mr: 30, ts: 0 }]; s2.frontTest.includeTS = false; s2.onlineHw.tsSets = 0;
const sp2 = O.specFromSettings(s2, {}); const sl2 = C.slotsFromSpec(sp2, {});
재기('계산기 60 × 30% = 18 칸, 다 종이 숙제', sl2.filter(x => x.calculator).length === 18 && sl2.filter(x => x.calculator).every(x => x.section === 'hw'));
재기('TS 를 빼면 TS 칸이 없다', sl2.every(x => x.src === 'mr'));
const s3 = O.defaultSettings(); s3.frontTest.mode = 'skip'; s3.mr.review.sets = 0; s3.composition.figures = 'exclude';
const sl3 = C.slotsFromSpec(O.specFromSettings(s3, {}), {});
재기('앞장 생략·종합 생략이면 그 칸이 없다', sl3.every(x => x.section !== 'test' && x.part !== 'mr-review'));
재기('도형 제외면 모든 칸에 그림 금지 표시', sl3.every(x => x.noFigure));
const smp = C.sampleSlots(slots, 2);
재기('표본 2 = MR 2 + TS 2 (서로 다른 구역부터)', smp.filter(x => x.src === 'mr').length === 2 && smp.filter(x => x.src === 'ts').length === 2
  && new Set(smp.filter(x => x.src === 'mr').map(x => x.section)).size === 2);

console.log('\n── 값 셈');
재기('3/4 + 1/8 = 7/8', C.sameAnswer(String('7/8'), '$\\frac{7}{8}$') && C.evalExact('3/4+1/8').n === 7n && C.evalExact('3/4+1/8').d === 8n);
재기('대분수 1 1/2 = 3/2 = 1.5', C.sameAnswer('1 1/2', '3/2') && C.sameAnswer('1.5', '3/2'));
재기('단위는 떼고 본다: 12 cm = 12', C.sameAnswer('12 cm', '12'));
재기('50% = 0.5', C.sameAnswer('50%', '0.5'));
재기('다른 값은 다르다', !C.sameAnswer('7/8', '6/8'));
let 막힘 = false; try { C.evalExact('process.exit(1)'); } catch (e) { 막힘 = true; }
재기('셈식에 수·연산 말고 다른 글자가 있으면 거절(eval 안 씀)', 막힘);
재기('0.1+0.2 = 0.3 정확히', C.sameAnswer(String('0.3'), '0.1+0.2'));

console.log('\n── 생성 결과 검사');
const 칸 = [{ id: 'm001', src: 'mr', type: 'mc', difficulty: 'standard', unit: '분수 덧셈', calculator: false },
  { id: 'm002', src: 'mr', type: 'sa', difficulty: 'basic', unit: '분수 덧셈', calculator: true }];
const 좋음 = [{ slot: 'm001', stem: 'What is $\\frac{3}{4}+\\frac{1}{8}$?', choices: ['$\\frac{7}{8}$', '$\\frac{4}{12}$', '$\\frac{1}{2}$', '1'], answer: '$\\frac{7}{8}$', check: '3/4+1/8', unit: '분수 덧셈', difficulty: 'standard', type: 'mc', calculator: false, figure: false, working: '6/8+1/8' },
  { slot: 'm002', stem: 'Work out 2.5 x 4.', answer: '10', check: '2.5*4', unit: '분수 덧셈', difficulty: 'basic', type: 'sa', calculator: true, figure: false }];
재기('맞는 두 문항 → 통과', C.checkMrItems(좋음, 칸).ok, JSON.stringify(C.checkMrItems(좋음, 칸).bad));
const 흠 = (f) => { const x = JSON.parse(JSON.stringify(좋음)); f(x); return C.checkMrItems(x, 칸); };
재기('정답이 보기에 없으면 걸린다', !흠(x => { x[0].answer = '5/8'; x[0].check = ''; }).ok);
재기('정답이 보기에 두 번이면 걸린다(7/8 과 14/16)', !흠(x => { x[0].choices[1] = '14/16'; }).ok);
재기('셈식 값 ≠ 정답이면 걸린다', !흠(x => { x[1].answer = '12'; }).ok);
재기('난이도·꼴·단원·계산기가 부탁과 다르면 걸린다', !흠(x => { x[0].difficulty = 'basic'; }).ok && !흠(x => { x[1].type = 'mc'; }).ok
  && !흠(x => { x[0].unit = '곱셈'; }).ok && !흠(x => { x[1].calculator = false; }).ok);
재기('문항이 빠지면 걸린다', !C.checkMrItems([좋음[0]], 칸).ok);
재기('조판 명령 끼워넣기(\\input)는 걸린다', !흠(x => { x[1].stem = 'Hi \\input{/etc/passwd} there'; }).ok);
const 재 = C.compareSolve(좋음, [{ slot: 'm001', answer: 'A' }, { slot: 'm002', answer: '9' }]);
재기('재풀이: 글자 A → 보기 7/8 로 바꿔 일치 · 9 ≠ 10 은 불일치', 재.m001.status === 'verified-agree' && 재.m002.status === 'mismatch', JSON.stringify(재));
재기('재풀이 결과 이름은 「검증 일치」 — 「정답 보장」이라 쓰지 않는다', !JSON.stringify(재).includes('보장') && !/guarante/i.test(JSON.stringify(재)));

console.log('\n── 잠금 · 토큰 · id');
const now = 1e12;
재기('모르는 종류 → 안 쥠(실패 처리감)', C.leaseDecision({ type: 'produce-x', status: 'queued' }, 'A', now).why === 'unknown-type');
재기('대기 주문 → 쥠', C.leaseDecision({ type: 'prep-paper', status: 'queued' }, 'A', now).take);
재기('남이 쥔(만료 전) 주문 → 안 쥠', !C.leaseDecision({ type: 'prep-paper', status: 'running', lease: { workerId: 'B', until: now + 1000 } }, 'A', now).take);
재기('만료된 잠금 → 넘겨받음', C.leaseDecision({ type: 'prep-paper', status: 'running', lease: { workerId: 'B', until: now - 1 } }, 'A', now).take);
재기('내가 쥐던 것(재시작) → 이어서', C.leaseDecision({ type: 'prep-paper', status: 'running', lease: { workerId: 'A', until: now + 5 } }, 'A', now).resume);
재기('취소 요청·끝난 주문 → 안 쥠', !C.leaseDecision({ type: 'prep-paper', status: 'cancel-requested' }, 'A', now).take && !C.leaseDecision({ type: 'prep-paper', status: 'done' }, 'A', now).take);
재기('재시도 3번 다 쓰면 안 쥠(w.attempts)', !C.leaseDecision({ type: 'prep-paper', status: 'queued', w: { attempts: 3 } }, 'A', now).take);
재기('내가 풀고 나간 잠금(until 0)을 다시 집으면 이어하기가 아니라 새 시도', !C.leaseDecision({ type: 'prep-paper', status: 'queued', lease: { workerId: 'A', until: 0 } }, 'A', now).resume);
재기('토큰 = 입력+출력+캐시 둘', C.usageTokens({ input_tokens: 1, output_tokens: 2, cache_creation_input_tokens: 3, cache_read_input_tokens: 4 }) === 10);
재기('상한: 900+200 > 1000 → 멈춤 · 상한 0 = 끔', C.overCap(900, 200, 1000) && !C.overCap(900, 200, 0));
const h = C.specHash(spec);
const 뒤집기 = (v) => Array.isArray(v) ? v.map(뒤집기) : (v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).reverse().map(k => [k, 뒤집기(v[k])])) : v);
재기('명세 해시는 열쇠 차례와 무관', h === C.specHash(뒤집기(spec)) && h !== C.specHash(Object.assign({}, spec, { lessonDate: 'x' })));
재기('초안 id = 계획+판+산출물+해시 — 같은 주문은 같은 id', C.draftIdFor({ planId: 'emu5_20261006_1', rev: 2 }, 'paper', h) === 'emu5_20261006_1_r2_paper_' + h.slice(0, 8));

console.log('\n── PDF 글자 검사');
const 쪽 = [{ text: 'Part A 1. What [m001] 2. Work [m002]', ink: 0.05 }, { text: '3. [t003]', ink: 0.03 }];
재기('꼬리표가 다 있으면 통과', C.checkPdfText(쪽, ['m001', 'm002', 't003'], []).ok);
재기('빠진 문항을 잡는다', !C.checkPdfText(쪽, ['m001', 'm002', 't003', 'm004'], []).ok);
재기('빈 쪽을 잡는다', !C.checkPdfText(쪽.concat([{ text: '', ink: 0 }]), ['m001', 'm002', 't003'], []).ok);
재기('학생용에 해설 글이 있으면 정답 노출로 잡는다', !C.checkPdfText([{ text: 'x [m001] because six eighths plus one eighth', ink: .1 }], ['m001'], ['because six eighths plus one eighth']).ok);

console.log('\n── 드라이브 보관 자리');
console.log('── 드라이브 폴더 = 월/W주차/날짜(요일)/학생 (10-04 원장)');
재기('주차 = 홈페이지 숙제 칸과 같은 셈(목요일이 든 달) — 10/5 = 10월 W2 · 9/28 = 10월 W1 · 10/9 금요일도 W2', JSON.stringify(C.periodOfYmd('2026-10-05')) === '{"year":2026,"month":10,"week":2}' && C.periodOfYmd('2026-09-28').week === 1 && C.periodOfYmd('2026-09-28').month === 10 && C.periodOfYmd('2026-10-09').week === 2);
재기('날짜 폴더에 요일', C.dateFolder('2026-10-05') === '2026-10-05(월)' && C.dateFolder('2026-10-09') === '2026-10-09(금)');
재기('수업 폴더 = 2026-10/W2/2026-10-05(월)/별이', C.lessonDir('2026-10-05', '별이') === '2026-10/W2/2026-10-05(월)/별이', C.lessonDir('2026-10-05', '별이'));
재기('폴더 이름 → 날짜 (요일 있어도·없어도)', C.ymdOfFolder('2026-10-05(월)') === '2026-10-05' && C.ymdOfFolder('2026-10-05') === '2026-10-05' && C.ymdOfFolder('W2') === null);
const ap = C.archivePlan('C:/tmp/보관/', '유준', '2026-10-06', [{ kind: 'test', local: 'a.pdf', sha256: 'x' }, { kind: 'teacher', local: 'b.pdf' }]);
재기('학생/수업일/날짜_종류.pdf', ap[0].to === 'C:/tmp/보관/2026-10/W2/2026-10-06(화)/유준/2026-10-06_테스트지.pdf' && ap[1].to.endsWith('교사용_답지.pdf'));
재기('이름의 금지 글자는 바꾼다', C.safeName('a/b:c') === 'a_b_c');

console.log('\n── 드라이브 저장(10-01 방향 바꿈: 저장소 대신 드라이브)');
{
  const d = C.driveDest('C:/tmp/교재/', '민아', { lessonDate: '2026-10-06', rev: 2 }, false);
  재기('월/W주차/날짜(요일)/학생/판 폴더', d.dir === 'C:/tmp/교재/2026-10/W2/2026-10-06(화)/민아/판2' && d.rel === '2026-10/W2/2026-10-06(화)/민아/판2', JSON.stringify(d));
  재기('표본은 폴더에 「표본」 표시', C.driveDest('C:/r', '민아', { lessonDate: '2026-10-06', rev: 1 }, true).dir.endsWith('/판1_표본'));
  const n = C.driveFileName('민아', { lessonDate: '2026-10-06', rev: 2 }, 'teacher', 'pdf');
  재기('파일 이름 = 날짜_학생_판_종류(드라이브 검색으로 하나만 찾히게)', n === '2026-10-06_민아_판2_교사용답지.pdf', n);
  재기('표본은 파일 이름에도 「표본」(같은 판 정식 교재와 검색이 안 섞이게)', C.driveFileName('민아', { lessonDate: '2026-10-06', rev: 2 }, 'test', 'pdf', true) === '2026-10-06_민아_판2_표본_테스트지.pdf');
  재기('원본 JSON·검수 기록 이름', C.driveFileName('민아', { lessonDate: '2026-10-06', rev: 2 }, 'items', 'json') === '2026-10-06_민아_판2_원본.json'
    && C.driveFileName('민아', { lessonDate: '2026-10-06', rev: 2 }, 'qa', 'json') === '2026-10-06_민아_판2_검수기록.json');
}

console.log('\n── 학교 자료 새 파일 찾기(원장님이 휴대폰 드라이브 앱으로 올림)');
{
  const 파일 = [{ rel: '민아/학교자료/범위.jpg', name: '범위.jpg', size: 100, mtime: 1 }, { rel: '민아/학교자료/메모.txt', name: '메모.txt', size: 5, mtime: 1 },
    { rel: '민아/학교자료/시험지.PDF', name: '시험지.PDF', size: 900, mtime: 2 }, { rel: '민아/학교자료/~$임시.jpg', name: '~$임시.jpg', size: 1, mtime: 3 }];
  const 새 = C.schoolFileNews(파일, {});
  재기('사진·PDF 만(대소문자 무관) · 임시 파일 뺌', 새.length === 2 && 새.every(x => /\.(jpg|pdf)$/i.test(x.name)), JSON.stringify(새.map(x => x.name)));
  재기('파일 id 는 경로+크기로 고정(같은 파일은 같은 id)', 새[0].id === C.schoolFileNews(파일, {})[0].id && /^[a-f0-9]{16}$/.test(새[0].id));
  const 받은 = {}; 새.forEach(x => { 받은[x.id] = { status: 'new' }; });
  재기('이미 알린 파일은 다시 알리지 않는다', C.schoolFileNews(파일, 받은).length === 0);
  재기('같은 이름이라도 크기가 바뀌면(새로 찍어 덮음) 새 파일', C.schoolFileNews([Object.assign({}, 파일[0], { size: 101 })], 받은).length === 1);
}

console.log('\n── 재풀이가 풀이째 답을 보낼 때 (10-02 별이 교재 실측 — 맞는 10문항이 「불일치」로 잡혔다)');
{
  const t = (a, b, ty) => C.compareSolve([{ slot: 'x', answer: a, type: ty || 'sa' }], [{ slot: 'x', answer: b }]).x.status;
  재기('「Volume = 6 × 4 × 5 = 120 cm³」 ↔ 정답 120 → 일치', t('120', 'Volume = 6 × 4 × 5 = 120 cm³') === 'verified-agree');
  재기('「… = 30 000 cm³. 30 000 ÷ 1000 = 30 L」 ↔ 30 → 일치(마지막 = 뒤)', t('30', 'Volume = 50 × 20 × 30 = 30 000 cm³. 30 000 ÷ 1000 = 30 L') === 'verified-agree');
  재기('서술형 「Box B has the greater volume, by 5 cm³.」 ↔ 「… 125 − 120 = 5 cm³」 → 일치', t('Box B has the greater volume, by 5 cm³.', 'Box A = 120 cm³. Box B = 125 cm³. by 125 − 120 = 5 cm³', 'written') === 'verified-agree');
  재기('= 뒤에 덧말이 붙어도(「= 30 cubes. … divides by 2」) 30 을 본다', t('30 cubes can be packed into the box.', '5 × 3 × 2 = 30 cubes. Every edge divides exactly by 2, so there are no gaps.', 'written') === 'verified-agree');
  재기('⛔ = 뒤의 답이 다르면 불일치(121 ≠ 120)', t('120', 'Volume = 6 × 4 × 5 = 121 cm³') === 'mismatch');
  재기('⛔ 서술형도 = 뒤 답이 다르면 불일치', t('The water will last 40 days.', '2000 ÷ 50 = 41 days', 'written') === 'mismatch');
  재기('⛔ 객관식은 수 하나 맞는다고 일치가 아니다(보기 글로만)', t('Blue', 'Red', 'mc') === 'mismatch');
  재기('분수·소수 값이 같으면 일치(3/8 = 0.375)', t('3/8', '0.375') === 'verified-agree');
}

console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
process.exit(실패 ? 1 : 0);
