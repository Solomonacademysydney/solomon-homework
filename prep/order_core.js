/* =============================================================================
 * order_core.js — 4단계 주간 설정 · 기본값 · 제작 주문 셈 (2026-10-01)
 *
 * 화면(/prep/)과 서버(functions/order_core.js)가 **글자째 같은 파일**을 쓴다
 *   (functions/화면시험/prep_주문.test.js 가 두 파일이 같은지 지킨다 — 고치면 둘 다 복사할 것).
 * DB 를 만지지 않는다 — 받은 값으로 셈만.
 * ============================================================================= */
(function (root) {
  'use strict';
  const 복 = (v) => JSON.parse(JSON.stringify(v));

  function defaultSettings() {
    return {
      mr: { units: [{ title: '', goal: '', examples: 3, practice: 10, types: ['mc', 'sa'], difficulty: 'standard', steps: true }],
            review: { integrated: true, questions: 10, sets: 1 } },
      ts: { include: true, mode: 'perUnit', title: '', examples: 2, practice: 8, difficulty: 'standard' },
      paperHw: { sets: 2, perSet: [{ mr: 20, ts: 10 }, { mr: 20, ts: 10 }] },
      frontTest: { mode: 'normal', includeMR: true, includeTS: true, questions: 10, points: 1, minutes: 15, answerKey: true },
      difficulty: { target: 3, mix: { basic: 30, standard: 50, challenge: 20 }, complexity: 2 },
      composition: { mcPct: 60, saPct: 30, writtenPct: 10, calculatorPct: 0, figures: 'include', figureScale: 100 },
      layout: { answerCols: 2, fontSize: 11, margin: 15, workSpace: 'normal', bilingual: false },
      onlineHw: { mrSets: 6, tsSets: 0, perSet: 20, daily: false, dupPolicy: 'avoid' },
    };
  }
  // 「바뀐 값」·「어디서 왔나」를 세는 단위(배열은 통째로 하나)
  const PATHS = ['mr.units', 'mr.review', 'ts.include', 'ts.mode', 'ts.title', 'ts.examples', 'ts.practice', 'ts.difficulty',
    'paperHw.sets', 'paperHw.perSet', 'frontTest', 'difficulty.target', 'difficulty.mix', 'difficulty.complexity',
    'composition.mcPct', 'composition.saPct', 'composition.writtenPct', 'composition.calculatorPct', 'composition.figures', 'composition.figureScale',
    'layout.answerCols', 'layout.fontSize', 'layout.margin', 'layout.workSpace', 'layout.bilingual', 'onlineHw'];
  function get(o, p) { return p.split('.').reduce((v, k) => (v == null ? undefined : v[k]), o); }
  function set(o, p, val) { const ks = p.split('.'); let x = o; for (const k of ks.slice(0, -1)) { if (x[k] == null) x[k] = {}; x = x[k]; } x[ks[ks.length - 1]] = val; }

  const 정수 = (v) => Number.isInteger(v) && v >= 0;
  const 비율 = (v) => typeof v === 'number' && v >= 0 && v <= 100;
  /** 검사 — problems(값이 틀림) · conflicts(서로 맞지 않는 요청 — 생성 전에 표시). ok = 둘 다 없음 */
  function validateSettings(s) {
    const p = [], c = [];
    const 정수칸 = [['mr.review.questions'], ['mr.review.sets'], ['ts.examples'], ['ts.practice'], ['paperHw.sets'], ['frontTest.questions'],
      ['frontTest.points'], ['frontTest.minutes'], ['onlineHw.mrSets'], ['onlineHw.tsSets'], ['onlineHw.perSet'], ['layout.fontSize'], ['layout.margin']];
    for (const [k] of 정수칸) if (!정수(get(s, k))) p.push(k + ': 0 이상 정수');
    (get(s, 'mr.units') || []).forEach((u, i) => { for (const k of ['examples', 'practice']) if (!정수(u[k])) p.push('mr.units.' + i + '.' + k + ': 0 이상 정수'); });
    (get(s, 'paperHw.perSet') || []).forEach((x, i) => { for (const k of ['mr', 'ts']) if (!정수(x[k])) p.push('paperHw.perSet.' + i + '.' + k + ': 0 이상 정수'); });
    for (const k of ['composition.mcPct', 'composition.saPct', 'composition.writtenPct', 'composition.calculatorPct',
      'difficulty.mix.basic', 'difficulty.mix.standard', 'difficulty.mix.challenge']) if (!비율(get(s, k))) p.push(k + ': 0~100');
    const m = s.difficulty.mix; if (m.basic + m.standard + m.challenge !== 100) p.push('난이도 비중(기본+표준+도전)은 합 100');
    const cp = s.composition; if (cp.mcPct + cp.saPct + cp.writtenPct !== 100) p.push('문제 구성(객관식+단답+서술)은 합 100');
    if ((s.paperHw.perSet || []).length !== s.paperHw.sets) p.push('종이 숙제 세트 수(' + s.paperHw.sets + ')와 세트별 칸 수(' + (s.paperHw.perSet || []).length + ')가 다릅니다');
    if (!(Number.isInteger(s.difficulty.target) && s.difficulty.target >= 1 && s.difficulty.target <= 5)) p.push('목표 수준은 1~5');
    if (!(Number.isInteger(s.difficulty.complexity) && s.difficulty.complexity >= 1 && s.difficulty.complexity <= 3)) p.push('복잡도는 1~3');
    if (!(cp.figureScale >= 10 && cp.figureScale <= 300)) p.push('그림 배율은 10~300%');
    // 상충
    if (!s.ts.include) {
      if ((s.paperHw.perSet || []).some(x => x.ts > 0)) c.push('TS 를 뺐는데 종이 숙제에 TS 문항이 있습니다');
      if (s.onlineHw.tsSets > 0) c.push('TS 를 뺐는데 홈페이지 숙제에 TS 세트가 있습니다');
      if (s.frontTest.mode !== 'skip' && s.frontTest.includeTS) c.push('TS 를 뺐는데 앞장 테스트에 TS 가 있습니다');
    }
    if (s.mr.review.integrated && s.mr.review.sets > 0 && s.mr.review.questions === 0) c.push('종합문제 세트가 있는데 문항이 0 입니다(생략하려면 세트를 0 으로)');
    if (s.frontTest.mode === 'normal' && !s.frontTest.includeMR && !s.frontTest.includeTS) c.push('앞장 테스트에 MR·TS 가 둘 다 빠졌습니다(생략하려면 「생략」)');
    return { ok: p.length === 0 && c.length === 0, problems: p, conflicts: c };
  }
  /** 계산기 % → 정수 문항(반올림) */
  function calculatorCount(n, pct) {
    const raw = n * pct / 100, count = Math.round(raw);
    return { count, note: n + '문항 × ' + pct + '% = ' + (Math.round(raw * 10) / 10) + ' → 반올림 ' + count + '문항' };
  }
  /** 주문 명세 — 0·생략은 빠지고, MR만이면 TS 가 없고, TS 합본이면 하나 */
  function specFromSettings(s, ctx) {
    const parts = [];
    for (const u of s.mr.units) parts.push({ kind: 'mr-unit', title: u.title, goal: u.goal, examples: u.examples, practice: u.practice, types: u.types, difficulty: u.difficulty, steps: u.steps });
    if (s.mr.review.sets > 0 && s.mr.review.questions > 0) parts.push({ kind: 'mr-review', integrated: s.mr.review.integrated, questions: s.mr.review.questions, sets: s.mr.review.sets });
    if (s.ts.include) parts.push({ kind: s.ts.mode === 'combined' ? 'ts-combined' : 'ts-unit', title: s.ts.title, examples: s.ts.examples, practice: s.ts.practice, difficulty: s.ts.difficulty });
    if (s.paperHw.sets > 0) {
      const sets = s.paperHw.perSet.map(x => ({ mr: x.mr, ts: s.ts.include ? x.ts : 0 }));
      parts.push({ kind: 'paper-hw', sets, total: sets.reduce((t, x) => t + x.mr + x.ts, 0) });
    }
    if (s.frontTest.mode !== 'skip') parts.push(Object.assign({ kind: 'front-test' }, 복(s.frontTest), { includeTS: s.ts.include && s.frontTest.includeTS }));
    if (s.onlineHw.mrSets + (s.ts.include ? s.onlineHw.tsSets : 0) > 0) parts.push(Object.assign({ kind: 'online-hw', afterPaperApproval: true }, 복(s.onlineHw), { tsSets: s.ts.include ? s.onlineHw.tsSets : 0 }));
    const hwMr = s.paperHw.sets > 0 ? s.paperHw.perSet.reduce((t, x) => t + x.mr, 0) : 0;
    return { studentId: (ctx || {}).studentId || null, lessonDate: (ctx || {}).lessonDate || null, parts,
      difficulty: 복(s.difficulty), composition: 복(s.composition), layout: 복(s.layout),
      calculator: calculatorCount(hwMr, s.composition.calculatorPct) };
  }
  /** 미리 채우기 — 지난 승인값(이번 주만 뺌) → 커리의 그 수업 → 나머지 기본. 어디서 왔는지 함께 */
  function prefill(approved, curriculum, lessonDate) {
    const s = defaultSettings(), source = {};
    const 이번주만 = (approved && approved.thisWeekOnly) || [];
    for (const p of PATHS) {
      const v = approved && approved.settings ? get(approved.settings, p) : undefined;
      if (v !== undefined && !이번주만.some(x => x === p || x.startsWith(p + '.') || p.startsWith(x + '.'))) { set(s, p, 복(v)); source[p] = '지난 승인'; }
      else source[p] = '기본';
    }
    const l = ((curriculum && curriculum.lessons) || []).find(x => x && x.date === lessonDate);
    if (l) {
      if (!s.mr.units.length) s.mr.units.push(defaultSettings().mr.units[0]);
      s.mr.units[0].title = l.mr || ''; source['mr.units.0.title'] = '커리';
      // [10-02] 한 수업에 주제가 여럿(유준 v3 = A 신개념 · B 다른 영역 · C 복습)이면 B·C 도 채운다
      ['mrB', 'mrC'].forEach((k, i) => { if (l[k]) { s.mr.units[i + 1] = Object.assign(복(s.mr.units[0]), { title: String(l[k]) }); source['mr.units.' + (i + 1) + '.title'] = '커리'; } });
      s.ts.title = l.ts || ''; source['ts.title'] = '커리';
      if (Number.isInteger(l.targetLevel)) { s.difficulty.target = l.targetLevel; source['difficulty.target'] = '커리'; }
    }
    return { settings: s, source };
  }
  function changedPaths(a, b) { return PATHS.filter(p => JSON.stringify(get(a, p)) !== JSON.stringify(get(b, p))); }

  /** 자유 지시 → 설정값. 알아들은 것은 applied, 못 알아들은 말은 unresolved(보류 — 원장 확인 전엔 반영 안 됨) */
  function interpretFreeText(text, settings) {
    const s = 복(settings), applied = [], unresolved = [];
    const 조각 = String(text || '').split(/[.\n;,!?]+/).map(x => x.trim()).filter(Boolean);
    const 세트맞추기 = (n) => { const last = s.paperHw.perSet[s.paperHw.perSet.length - 1] || { mr: 20, ts: 10 }; while (s.paperHw.perSet.length < n) s.paperHw.perSet.push(복(last)); s.paperHw.perSet.length = n; s.paperHw.sets = n; };
    for (const f of 조각) {
      let 알아들음 = false; let m;
      if (/(TS|티에스)\s*(를|은|는)?\s*(빼|제외|없이)/.test(f) || /MR\s*만/.test(f)) { s.ts.include = false; applied.push('TS 제외'); 알아들음 = true; }
      if (/TS\s*합본/.test(f)) { s.ts.mode = 'combined'; applied.push('TS 합본'); 알아들음 = true; }
      if ((m = /세트\s*(\d+)\s*개/.exec(f))) { 세트맞추기(+m[1]); applied.push('종이 숙제 세트 ' + m[1]); 알아들음 = true; }
      if ((m = /(\d+)\s*\+\s*(\d+)/.exec(f))) { s.paperHw.perSet = s.paperHw.perSet.map(() => ({ mr: +m[1], ts: +m[2] })); applied.push('세트별 ' + m[1] + '+' + m[2]); 알아들음 = true; }
      if ((m = /계산기\s*(\d+)\s*%/.exec(f))) { s.composition.calculatorPct = +m[1]; applied.push('계산기 ' + m[1] + '%'); 알아들음 = true; }
      if (/종합\s*(문제)?\s*(을|는)?\s*(생략|빼|없이)/.test(f)) { s.mr.review.sets = 0; applied.push('종합문제 생략'); 알아들음 = true; }
      if (/앞장\s*(테스트)?\s*(는|를)?\s*(생략|빼|없이)/.test(f)) { s.frontTest.mode = 'skip'; applied.push('앞장 테스트 생략'); 알아들음 = true; }
      if (/영한\s*병기/.test(f)) { s.layout.bilingual = !/(빼|없이)/.test(f); applied.push('영한 병기 ' + (s.layout.bilingual ? '켬' : '끔')); 알아들음 = true; }
      if ((m = /답지\s*(1|2)\s*단/.exec(f))) { s.layout.answerCols = +m[1]; applied.push('답지 ' + m[1] + '단'); 알아들음 = true; }
      if ((m = /글자\s*(크기)?\s*(\d+)/.exec(f))) { s.layout.fontSize = +m[2]; applied.push('글자 ' + m[2]); 알아들음 = true; }
      if ((m = /목표\s*(수준|레벨)?\s*L?\s*([1-5])/.exec(f))) { s.difficulty.target = +m[2]; applied.push('목표 L' + m[2]); 알아들음 = true; }
      if (!알아들음) unresolved.push(f);
    }
    // TS 를 뺐으면 TS 칸을 MR 로 합친다(상충이 남지 않게)
    if (!s.ts.include) {
      s.paperHw.perSet = s.paperHw.perSet.map(x => ({ mr: x.mr + x.ts, ts: 0 }));
      s.onlineHw.tsSets = 0; s.frontTest.includeTS = false;
    }
    return { settings: s, applied, unresolved };
  }

  const OrderCore = { defaultSettings, validateSettings, calculatorCount, specFromSettings, prefill, changedPaths, interpretFreeText, PATHS };
  if (typeof module !== 'undefined' && module.exports) module.exports = OrderCore;
  else root.OrderCore = OrderCore;
})(typeof window !== 'undefined' ? window : this);
