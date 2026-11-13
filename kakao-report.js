// kakao-report.js — 학부모 리포트 카톡 카드 (1단계 · 1부 숙제 리포트)
//   지시서: 바탕화면 「학부모리포트_카톡카드_1단계_작업지시서_v7.md」(2026-11-13)
//
// 두 부분으로 나뉜다.
//   ① 셈(KR.compute …) — 화면·파이어베이스를 모르는 순수 함수. 노드 시험(functions/화면시험/카톡카드_셈.test.js)이 이것을 부른다.
//   ② 화면(krMount …) — 교사 화면 「카톡 리포트」 탭. index.html 의 getStore·hwLookup·subIsStale 등을 빌려 쓴다.
//
// ⛔ 지키는 것
//   · 파이어베이스에 카드·편집 문장을 쓰지 않는다. 쓰는 것은 학생 설정 두 칸(reportParts·classMode) 낱칸뿐.
//   · 지난 주 자료는 그 주 숙제 칸만 받는다. 목록을 못 받으면 **전체 읽기로 넘어가지 않고** 다시 시도 안내.
//   · 약점 데이터(weakness)는 쓰지 않는다 — 그 주 세트와 그 주 답안에서 직접 센다.
//   · 바뀐 숙제를 푼 제출(subIsStale)은 다시 채점하지 않고 집계에서 뺀다.
(function (root) {
'use strict';

// ═══ ① 셈 ═══════════════════════════════════════════════════════════════

const C = {
  navy: '#1e2b4f', tsHead: '#0f6f6f', ts: '#138a8a',
  green: '#178a3e', yellow: '#c99a06', orange: '#d9730d', gray: '#888'
};

// 3-2 구간 — 판정은 반올림 전 원값
const BANDS = {
  good: { label: '잘함',      color: C.green,  eval: '개념을 잘 익혔습니다.',                              plan: '다음 단계 문제로 넘어갑니다.' },
  mid:  { label: '연습 필요', color: C.yellow, eval: '기본은 익혔지만 일부 유형을 더 연습해야 합니다.',   plan: '틀린 유형을 중심으로 추가 연습합니다.' },
  low:  { label: '다시 학습', color: C.orange, eval: '개념을 다시 다져야 합니다.',                          plan: '수업에서 개념을 다시 설명하고 유사 문제로 확인합니다.' },
  few:  { label: '추가 확인 필요', color: C.gray, eval: '문항 수가 적어 다음 주에 다시 확인합니다.',       plan: '' }
};
function band(correct, total) {
  if (!(total > 0)) return null;
  if (total < 5) return 'few';
  const r = correct / total;
  if (r >= 0.75) return 'good';
  if (r >= 0.5) return 'mid';
  return 'low';
}
function pct(correct, total) { return total > 0 ? Math.round(correct / total * 100) : null; }

// 3-4 유형표 — slug → 영역 이름 · 한국어 설명. 같은 영역 이름은 한 줄로 합친다.
const TS_AREAS = {
  'evaluate-reasoning':        ['Evaluating Reasoning', '누구의 추론이 옳은지 판단'],
  'flawed-reasoning':          ['Flawed Reasoning', '잘못된 추론 찾기'],
  'conclusion-must-be-true':   ['Drawing Conclusions', '반드시 참인 결론 · 참일 수 없는 결론 찾기'],
  'conclusion-cannot-be-true': ['Drawing Conclusions', '반드시 참인 결론 · 참일 수 없는 결론 찾기'],
  'strengthen':                ['Strengthening Arguments', '주장을 강화하는 근거'],
  'weaken':                    ['Weakening Arguments', '주장을 약화하는 근거'],
  'hidden-information':        ['Hidden Information', '글 속에 숨은 정보 찾기'],
  'main-idea':                 ['Main Idea', '글의 중심 생각 찾기'],
  'logic-arrangement':         ['Logic Arrangement', '조건으로 순서·자리 정하기'],
  'timetable':                 ['Timetable', '시간표·일정 읽기'],
  'numeric-puzzle':            ['Numeric Puzzle', '수 추론 퍼즐'],
  'symbol-switching':          ['Symbol Switching', '기호 바꾸기 규칙'],
  'pattern':                   ['Pattern', '규칙 찾기'],
  'graphs':                    ['Graphs', '그래프 읽기'],
  'venn':                      ['Venn Diagram', '벤다이어그램'],
  'views':                     ['Spatial Views', '보는 방향에 따른 모양'],
  '2d-assembly':               ['2D Assembly', '도형 조각 맞추기'],
  '3d-puzzle':                 ['3D Puzzle', '입체 퍼즐'],
  'nets-dice':                 ['Nets & Dice', '전개도·주사위']
};

// Math 단원 — taxonomy_id(MR.Y4.NUM.RATIO.…)의 셋째 마디(갈래)로 묶는다. 문항 하나 = 단원 하나.
//   (문항마다 끝 마디가 다 달라 끝 마디로 묶으면 단원마다 1문항이 된다 — 래온 11월 1주 실측 20문항 20갈래)
const MATH_STRANDS = {
  NUM: '수와 계산', NO: '수와 연산', NT: '수의 성질', FRRATIO: '분수와 비', FR: '분수', DEC: '소수',
  ALG: '규칙과 식', PAT: '규칙 찾기', GEO: '도형', MEAS: '측정', ME: '측정', TIME: '시간',
  STATS: '평균과 통계', DATA: '자료와 그래프', PROB: '확률', COMB: '경우의 수', LOGIC: '논리', LG: '논리'
};
function mathUnitOf(q, setUnit) {
  const t = String((q && q.taxonomy_id) || '');
  if (t) {
    const m = /^MR\.Y\d+\.([A-Z]+)\./.exec(t);
    if (m && MATH_STRANDS[m[1]]) return MATH_STRANDS[m[1]];
    return null;                    // 분류는 있는데 이름을 모른다 → 「분류 없는 문항」
  }
  return setUnit || null;           // 분류가 아예 없는 세트 → 세트 제목의 세부 단원명
}

// 4-6 세트 제목 줄이기 — "Set 1 (Selective Prep · Data and Graphs II · Set 1)" → 세부 단원 "Data and Graphs II"
function setSubunit(title) {
  const s = String(title || '');
  const m = /\(([^)]*)\)/.exec(s);
  const inner = m ? m[1] : s;
  const parts = inner.split(/\s+[·\-–]\s+/).map(x => x.trim()).filter(Boolean)
    .filter(x => !/^set\s*\d+$/i.test(x));
  let last = parts.length ? parts[parts.length - 1] : '';
  last = last.replace(/^Y\d+\s+[A-Z]{1,5}\s+/, '').trim();   // "Y7 NP The Number Plane" → "The Number Plane"
  if (/^selective prep$/i.test(last)) last = '';
  return last;
}
function shortSetTitle(idx, title, isTs) {
  if (isTs) return 'Set ' + (idx + 1);
  const u = setSubunit(title);
  return 'Set ' + (idx + 1) + (u ? ' · ' + u : '');
}

function _answered(v) { return v !== undefined && v !== null && String(v).trim() !== ''; }

/**
 * Math 한 주 셈.
 * @param hw       그 주 숙제 칸(hwLookup 결과) — sets[]
 * @param subs     세트 번호 → 제출 기록
 * @param stale    세트 번호 → 바뀐 숙제를 푼 제출인가(subIsStale)
 * @param normAns  index.html 의 채점 정규화(같은 채점 규칙)
 */
function computeMath(hw, subs, stale, normAns) {
  const sets = (hw && hw.sets) || [];
  if (!sets.length) return null;
  const out = { sets: [], totalSets: sets.length, doneSets: 0, correct: 0, total: 0,
                units: {}, unclassified: { correct: 0, total: 0 }, nonAuto: 0, warn: [] };
  sets.forEach((set, idx) => {
    const sub = subs[idx];
    const qs = set.questions || [];
    const row = { idx, title: shortSetTitle(idx, set.title, false), status: 'notStarted', correct: 0, total: 0 };
    if (!sub || !sub.submitted) { out.sets.push(row); return; }
    if (stale[idx]) {
      row.status = 'stale';
      out.warn.push(`Set ${idx + 1}: 숙제가 바뀌어 확인 필요 (다른 숙제를 푼 제출 — 카드 집계에서 뺌)`);
      out.sets.push(row); return;
    }
    out.doneSets++;
    if (sub.manuallyMarked) {
      row.status = 'manual';
      out.warn.push(`Set ${idx + 1}: 원장 처리(수동 완료) — 완료로는 세고 정답률에서는 뺌`);
      out.sets.push(row); return;
    }
    const auto = qs.filter(q => q && q.type !== 'written');
    out.nonAuto += qs.length - auto.length;
    const ans = sub.answers || {};
    if (auto.length && !auto.some(q => _answered(ans[q.id]))) {
      row.status = 'empty';
      out.warn.push(`Set ${idx + 1}: 제출은 됐는데 답이 하나도 없음 — 정답률에서 뺌(확인 필요)`);
      out.sets.push(row); return;
    }
    const setUnit = setSubunit(set.title);
    auto.forEach(q => {
      const ok = normAns(ans[q.id]) === normAns(q.answer);   // 빈칸은 오답(3-2)
      row.total++; if (ok) row.correct++;
      const u = mathUnitOf(q, setUnit);
      const bucket = u ? (out.units[u] = out.units[u] || { name: u, correct: 0, total: 0 }) : out.unclassified;
      bucket.total++; if (ok) bucket.correct++;
    });
    row.status = 'done';
    out.correct += row.correct; out.total += row.total;
    out.sets.push(row);
  });
  out.rate = pct(out.correct, out.total);
  out.band = band(out.correct, out.total);
  // 3-5 잘한 점 · 다시 볼 점
  const units = Object.values(out.units);
  const cand = units.filter(u => u.total >= 3 && u.correct / u.total >= 0.75)
                    .sort((a, b) => (b.correct / b.total) - (a.correct / a.total) || b.total - a.total);
  if (cand.length) {
    const u = cand[0], r = u.correct / u.total;
    out.praise = r >= 0.9 ? `${u.name}${josa(u.name, '은', '는')} 거의 실수 없이 정확합니다.`
                          : `${u.name}${josa(u.name, '을', '를')} 잘 풀었습니다.`;
  } else {
    out.praise = out.total > 0 ? '이번 주 숙제를 끝까지 풀었습니다.' : '잘한 점은 숙제를 마친 뒤 다시 확인합니다.';
  }
  const worst = units.filter(u => u.total - u.correct > 0)
                     .sort((a, b) => (b.total - b.correct) - (a.total - a.correct) || (a.correct / a.total) - (b.correct / b.total))[0];
  if (worst) out.review = `${worst.name}에서 오답이 ${worst.total - worst.correct}문항 있습니다.`;
  else out.review = out.total > 0 ? '이번 주 숙제에서 틀린 문항이 없습니다.' : '숙제를 마친 뒤 다시 확인합니다.';
  // 검산: 단원 합계 + 분류 없음 = 전체
  const sumWrong = units.reduce((n, u) => n + u.total - u.correct, 0) + (out.unclassified.total - out.unclassified.correct);
  out.check = { wrongByUnits: sumWrong, wrong: out.total - out.correct, ok: sumWrong === out.total - out.correct };
  return out;
}

/**
 * Thinking Skills 한 주 셈. TS 숙제는 「세트」가 아니라 「n일차」로 저장돼 있다(day_config) — 카드에 「n일차」로 적는다.
 *   맞힌 수 = 결국 맞힌 문항(힌트 포함) · 힌트 = 그중 한 번에·힌트 없이는 아니었던 문항(원장 11-13 「3/4 · 힌트 1」).
 *   제출한 세트 = completed 인 날. 끝내지 않은 날은 미제출로 본다(분모에서 뺀다).
 */
function computeTs(ts, progress) {
  if (!ts || !ts.enabled || !(ts.questions && ts.questions.length)) return null;
  const qPer = (ts.day_config && ts.day_config.questions_per_day) || ts.questions.length;
  const days = (ts.day_config && ts.day_config.total_days) || Math.ceil(ts.questions.length / qPer);
  const prog = progress || {};
  const out = { sets: [], totalSets: days, doneSets: 0, correct: 0, total: 0, hint: 0, areas: [], warn: [],
                unmapped: {}, unknownType: { correct: 0, total: 0 } };
  const areaMap = {};
  for (let d = 1; d <= days; d++) {
    const dp = prog['day' + d];
    const row = { idx: d - 1, title: d + '일차', status: 'notStarted', correct: 0, total: 0, hint: 0 };
    if (!dp || !dp.completed) { out.sets.push(row); continue; }
    out.doneSets++;
    const start = (d - 1) * qPer, end = Math.min(d * qPer, ts.questions.length);
    const ans = dp.answers || {};
    for (let i = start; i < end; i++) {
      const q = ts.questions[i] || {};
      const a = ans['q' + i] || {};
      // [11-13 원장] 「3/4 · 힌트 1」 — 맞힌 수 = 결국 맞힌 문제(힌트 보고 맞힌 것 포함 · 정답을 본 것은 틀림)
      //   힌트 = 맞혔지만 한 번에·힌트 없이는 아니었던 문제
      const ok = a.correct === true;
      const hinted = ok && ((a.attempts || 0) > 1 || !!a.hint1_used || !!a.hint2_used);
      row.total++; if (ok) row.correct++; if (hinted) row.hint++;
      const m = /^TS\.([a-z0-9-]+)(?:\.L(\d+))?/.exec(String(q.taxonomy_id || ''));
      if (!m) { out.unknownType.total++; if (ok) out.unknownType.correct++; continue; }
      const slug = m[1], lv = m[2] ? +m[2] : null;
      const def = TS_AREAS[slug];
      if (!def) {
        const u = out.unmapped[slug] = out.unmapped[slug] || { correct: 0, total: 0 };
        u.total++; if (ok) u.correct++; continue;
      }
      const ar = areaMap[def[0]] = areaMap[def[0]] || { name: def[0], desc: def[1], correct: 0, total: 0, levels: {} };
      ar.total++; if (ok) ar.correct++;
      if (lv) ar.levels[lv] = (ar.levels[lv] || 0) + 1;
    }
    row.status = 'done';
    out.correct += row.correct; out.total += row.total; out.hint += row.hint;
    out.sets.push(row);
  }
  out.rate = pct(out.correct, out.total);
  out.band = band(out.correct, out.total);
  const all = Object.values(areaMap).map(a => {
    let best = null, bestN = 0;
    for (const k of Object.keys(a.levels)) {
      const n = a.levels[k];
      if (n > bestN || (n === bestN && +k > best)) { best = +k; bestN = n; }   // 최빈값 · 동률이면 높은 쪽
    }
    return Object.assign(a, { level: best, band: band(a.correct, a.total) });
  });
  out.areas = all.sort((a, b) => (a.correct / a.total) - (b.correct / b.total) || b.total - a.total).slice(0, 4);
  out.areasAll = all;
  const nUnm = Object.keys(out.unmapped).length;
  if (nUnm) out.warn.push(`매핑 없는 유형 ${nUnm}개 (${Object.keys(out.unmapped).join(', ')}) — 카드에는 안 보임`);
  if (out.unknownType.total) out.warn.push(`유형 없는 문항 ${out.unknownType.total}개 — 카드에는 안 보임`);
  const sum = all.reduce((n, a) => n + a.total, 0) + Object.values(out.unmapped).reduce((n, u) => n + u.total, 0) + out.unknownType.total;
  out.check = { totalByAreas: sum, total: out.total, ok: sum === out.total };
  return out;
}

function josa(word, a, b) {
  const ch = String(word || '').trim().slice(-1);
  const c = ch.charCodeAt(0);
  if (c >= 0xAC00 && c <= 0xD7A3) return ((c - 0xAC00) % 28) ? a : b;
  return /[13678LMNRlmnr0]$/.test(ch) ? a : b;   // 영문·숫자 끝: 대강 받침 소리
}

function completion(subj) {
  const left = subj.totalSets - subj.doneSets;
  if (subj.doneSets === 0) return { big: '아직 시작 전', small: `${subj.totalSets}세트 중 0세트`, color: C.orange };
  if (left === 0) return { big: '모두 완료', small: `${subj.totalSets}세트 중 ${subj.doneSets}세트`, color: C.green };
  return { big: `${left}세트 남음`, small: `${subj.totalSets}세트 중 ${subj.doneSets}세트`, color: C.orange };
}

// 이번 주 숙제 점검 한 줄(과목 하나)
function checkSentence(subj) {
  if (!subj) return '';
  if (subj.doneSets === 0) return '아직 숙제를 시작하지 않았습니다.';
  const b = subj.band ? BANDS[subj.band] : null;
  let s = b ? b.eval : '채점할 문항이 없어 다음 주에 다시 확인합니다.';
  if (subj.doneSets < subj.totalSets) s += ' 남은 세트를 마쳐야 합니다.';   // 별도 문장(3-2)
  return s;
}
function planSentence(subj) {
  if (!subj || !subj.band) return '';
  return BANDS[subj.band].plan;
}

function nextText(nextHw, isTs) {
  if (!nextHw) return '배정 예정';
  if (isTs) {
    const ts = nextHw.ts;
    if (!ts || !ts.enabled || !(ts.questions && ts.questions.length)) return '배정 예정';
    const d = (ts.day_config && ts.day_config.total_days) || 0;
    return d ? `${d}세트 · 하루 ${ts.day_config.questions_per_day}문제` : '배정 예정';
  }
  const sets = nextHw.sets || [];
  if (!sets.length) return '배정 예정';
  const units = [...new Set(sets.map(s => setSubunit(s.title)).filter(Boolean))];
  return `${sets.length}세트` + (units.length ? ' · ' + units.join(', ') : '');
}

/**
 * 한 학생·한 주의 카드 모형 전체.
 * in: { student, periodText, periodKey, hw, subs, stale, tsProgress, nextHw, normAns, personal }
 */
function compute(inp) {
  const st = inp.student || {};
  const hw = inp.hw && inp.hw.published !== false ? inp.hw : null;
  const warn = [];
  if (inp.hw && inp.hw.published === false) warn.push('이 주 숙제가 비공개(published:false)라 배정 없음으로 봤습니다.');
  if (inp.personal) {
    return { blocked: '이 학생은 이 주에 개인 배정 숙제를 받았습니다. 1단계 카드는 반·공통 숙제만 만듭니다.', warn };
  }
  const math = computeMath(hw, inp.subs || {}, inp.stale || {}, inp.normAns);
  const ts = computeTs(hw && hw.ts, inp.tsProgress);
  if (!math && !ts) return { noHomework: true, warn };
  if (math) warn.push(...math.warn);
  if (ts) warn.push(...ts.warn);
  if (math && math.nonAuto) warn.push(`Math 자동채점 아닌 문항 ${math.nonAuto}개 — 정답률 분모에서 뺌`);
  if (math && math.unclassified.total) warn.push(`Math 분류 없는 문항 ${math.unclassified.total}개 — 단원 집계(잘한 점·다시 볼 점)에는 안 보임`);
  const nextHw = inp.nextHw && inp.nextHw.published !== false ? inp.nextHw : null;
  const online = st.classMode === 'online';
  const lines = [];
  if (math) lines.push({ subj: 'Math', text: checkSentence(math) });
  if (ts) lines.push({ subj: 'Thinking Skills', text: checkSentence(ts) });
  const nextMath = math ? nextText(nextHw, false) : '';
  const nextTs = ts ? nextText(nextHw, true) : '';
  // [3단계] 2부(현장 수업) — 일꾼이 올린 수업 요약(lessonSummaries) 하나. 없으면 1부만.
  const L = inp.lesson && inp.lesson.lessonDate ? inp.lesson : null;
  const part2 = L ? {
    date: L.lessonDate, dateText: koDate(L.lessonDate), topic: L.topic || '',
    test: L.test && L.test.questions && L.test.questions.length ? { title: L.test.title || '오늘 본 테스트', questions: L.test.questions } : null
  } : null;
  const weekHw = [];
  if (L) {
    (L.homework || []).forEach(h => weekHw.push(h));
    if (math && nextMath !== '배정 예정') weekHw.push('홈페이지 Math 숙제 · ' + nextMath);
    if (ts && nextTs !== '배정 예정') weekHw.push('홈페이지 Thinking Skills 숙제 · ' + nextTs);
  }
  const msg = [];
  if (math && math.band) msg.push('Math ' + planSentence(math));
  if (ts && ts.band) msg.push('Thinking Skills ' + planSentence(ts));
  return {
    student: { name: st.name || st.id, year: st.year, online },
    periodText: inp.periodText, periodKey: inp.periodKey,
    math, ts, warn, part2,
    edit: {
      check: lines.map(l => l.subj + ' ' + l.text).join('\n'),
      praise: math ? math.praise : '',
      review: math ? math.review : '',
      nextMath, nextTs,
      // [11-13 원장] 다음 주 숙제 칸은 원장이 넣고 뺀다 — 처음엔 배정돼 있으면 넣고, 「배정 예정」이면 뺀다
      showNextMath: !!math && nextMath !== '배정 예정',
      showNextTs: !!ts && nextTs !== '배정 예정',
      message: (msg.length ? msg.join('\n') + ' ' : '') + '[원장님 관찰 추가]',
      // 2부 편집 칸
      learned: L ? (L.learned || []).map(x => (x.title ? x.title + ': ' : '') + (x.desc || '')).join('\n') : '',
      testWrong: '', testScore: '', showTest: !!(part2 && part2.test),
      weekHw: weekHw.join('\n')
    }
  };
}

function koDate(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
  if (!m) return String(ymd || '');
  const d = new Date(+m[1], +m[2] - 1, +m[3], 12);
  return `${+m[2]}월 ${+m[3]}일(${'일월화수목금토'[d.getDay()]})`;
}

/**
 * 2부 테스트 — 원장이 넣은 「틀린 번호」·「점수」로 단원별 결과를 낸다(저장 안 함).
 *   틀린 번호 칸이 비면 아직 안 넣은 것(entered:false). 「0」·「없음」 = 다 맞음.
 */
function testResult(test, wrongText, scoreText) {
  if (!test) return null;
  const nums = new Set(test.questions.map(q => q.n));
  const raw = String(wrongText || '').trim();
  const entered = raw !== '';
  const wrong = new Set(), bad = [];
  if (entered && !/^(0|없음|없다|none)$/i.test(raw)) {
    for (const t of raw.split(/[\s,·、/]+/).filter(Boolean)) {
      const n = +t;
      if (Number.isInteger(n) && nums.has(n)) wrong.add(n); else bad.push(t);
    }
  }
  const total = test.questions.length;
  const sc = String(scoreText || '').trim();
  const score = sc !== '' && /^\d+(\.\d+)?$/.test(sc) ? +sc : (entered ? total - wrong.size : null);
  const units = {};
  for (const q of test.questions) {
    const u = units[q.unit] = units[q.unit] || { name: q.unit, correct: 0, total: 0 };
    u.total++; if (!wrong.has(q.n)) u.correct++;
  }
  const list = Object.values(units).sort((a, b) => (a.correct / a.total) - (b.correct / b.total) || b.total - a.total);
  const worst = list.filter(u => u.correct < u.total).sort((a, b) => (b.total - b.correct) - (a.total - a.correct))[0];
  const note = !entered ? '' : worst ? `다시 볼 단원: ${worst.name} (오답 ${worst.total - worst.correct}문항)` : '모든 문항을 맞혔습니다.';
  return { entered, total, score, wrong: [...wrong].sort((a, b) => a - b), bad, units: list, note };
}

const PLACEHOLDER = '[원장님 관찰 추가]';

// ═══ ② 카드 HTML ═════════════════════════════════════════════════════════

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// 줄 첫머리의 과목 이름은 과목 색 굵은 글씨(3-3)
function subjLines(text) {
  return String(text || '').split('\n').map(line => {
    const m = /^(Math|Thinking Skills)(\s+|$)(.*)$/.exec(line);
    const body = esc(m ? m[3] : line).replace(esc(PLACEHOLDER), `<span class="kr-ph">${esc(PLACEHOLDER)}</span>`);
    if (!m) return body;
    const col = m[1] === 'Math' ? C.navy : C.ts;
    return `<b style="color:${col}">${m[1]}</b> ${body}`;
  }).join('<br>');
}
function ring(rate, color, size) {
  const circ = 314.16;
  const dash = rate == null ? 0 : Math.max(0, Math.min(1, rate / 100)) * circ;
  const label = rate == null ? '–' : rate + '%';
  const fill = rate == null ? C.gray : '#1f2a44';
  return `<svg viewBox="0 0 120 120" width="${size}" height="${size}" style="width:${size}px;height:${size}px">`
    + `<circle cx="60" cy="60" r="50" fill="none" stroke="#eef0f4" stroke-width="14"/>`
    + (dash > 0 ? `<circle cx="60" cy="60" r="50" fill="none" stroke="${color}" stroke-width="14" stroke-dasharray="${dash.toFixed(1)} ${circ}" transform="rotate(-90 60 60)" stroke-linecap="round"/>` : '')
    + `<text x="60" y="70" text-anchor="middle" font-size="28" font-weight="700" fill="${fill}" font-family="Noto Sans KR, sans-serif">${label}</text></svg>`;
}
function summaryRow(name, color, subj) {
  const c = completion(subj);
  const doneRate = Math.round(subj.doneSets / subj.totalSets * 100);
  const b = subj.band ? BANDS[subj.band] : null;
  const rateCell = subj.doneSets === 0 || subj.total === 0
    ? `<div><div class="kr-ct">정답률</div><div class="kr-st" style="color:${C.gray}">–</div></div>`
    : `<div><div class="kr-ct">정답률</div><div class="kr-st" style="color:${b.color}">${b.label}</div><div class="kr-d">${subj.correct} / ${subj.total} 문제${subj.hint ? ` · 힌트 ${subj.hint}` : ''}</div></div>`;
  return `<div class="kr-srow"><div class="kr-sname-wrap"><span class="kr-sname" style="background:${color}">${name}</span></div>`
    + `<div class="kr-cell kr-big">${ring(doneRate, color, 150)}<div><div class="kr-ct">완료율</div><div class="kr-st" style="color:${c.color}">${c.big}</div><div class="kr-d">${c.small}</div></div></div>`
    + `<div class="kr-cell">${ring(subj.doneSets === 0 || subj.total === 0 ? null : subj.rate, color, 120)}${rateCell}</div></div>`;
}
function setRows(subj) {
  return subj.sets.map(r => {
    let right;
    if (r.status === 'notStarted') right = `<span class="kr-s" style="color:${C.orange}">아직 시작 전</span>`;
    else if (r.status === 'stale') right = `<span class="kr-s" style="color:${C.gray}">확인 중</span>`;
    else if (r.status === 'manual' || r.status === 'empty') right = `<span class="kr-s" style="color:${C.gray}">완료</span>`;
    else {
      const b = BANDS[band(r.correct, r.total)] || { color: C.gray };
      right = `<span class="kr-s" style="color:${b.color}">${r.correct}/${r.total}${r.hint ? `<span class="kr-hint"> · 힌트 ${r.hint}</span>` : ''}</span>`;
    }
    return `<div class="kr-row"><span>${esc(r.title)}</span>${right}</div>`;
  }).join('');
}
function head(color, title, sub, part, partStyle, pg) {
  return `<div class="kr-top" style="background:${color}"><div class="kr-brand">SOLOMON MATH ACADEMY</div><h1>${title}</h1>`
    + `<div class="kr-sub">${sub}</div><span class="kr-part" style="${partStyle}">${part}</span><div class="kr-pg">${pg}</div></div>`;
}
function foot(m, last) {
  const left = m.student.online ? 'Solomon Math Academy · Online' : 'Solomon Math Academy';
  return last
    ? `<div class="kr-foot"><span>상세 리포트: solomonacademy.com.au</span><span>0424 743 564</span></div>`
    : `<div class="kr-foot"><span>${left}</span><span>다음 장 →</span></div>`;
}
function subjSub(subj) {
  const c = completion(subj);
  return `${subj.totalSets}세트 · ${c.big}`;
}
function messageBox(e) {
  return `<div class="kr-h">원장 선생님 한마디</div><div class="kr-box kr-msg${e.message.includes(PLACEHOLDER) ? ' kr-fill' : ''}">${subjLines(e.message)}<div class="kr-sign">— 최정호 원장</div></div>`;
}

/** 카드 HTML 배열(1080×1350 그대로). */
function renderCards(m) {
  const e = m.edit, cards = [];
  const p2 = m.part2 || null;
  const n = 1 + (m.math ? 1 : 0) + (m.ts ? 1 : 0) + (p2 ? 2 : 0);
  const pg = i => `${i} / ${n}`;
  const who = esc(m.student.name) + ' · ' + (m.student.online ? '온라인' : ('Y' + esc(m.student.year)));
  const badge1 = p2 ? '1부 · 숙제' : '숙제 리포트';
  // 2부가 있으면 원장 한마디·다음 주 숙제는 2부 마지막 장으로 간다
  const e1 = p2 ? Object.assign({}, e, { showNextMath: false, showNextTs: false }) : e;
  const lastOf1 = !p2;
  // 1 요약
  cards.push(`<div class="kr-card kr-card-summary">${head(C.navy, who, '주간 학습 리포트 · 숙제 (' + esc(m.periodText) + ')', badge1, '', pg(1))}`
    + `<div class="kr-body"><div class="kr-h">이번 주 숙제 점검</div><div class="kr-box kr-one">${subjLines(e.check)}</div>`
    + `<div class="kr-h">숙제 요약</div><div class="kr-grid">`
    + (m.math ? summaryRow('Math', C.navy, m.math) : '') + (m.ts ? summaryRow('Thinking Skills', C.ts, m.ts) : '')
    + `</div></div>${foot(m, false)}</div>`);
  let i = 2;
  if (m.math) {
    const last = !m.ts && lastOf1;
    cards.push(`<div class="kr-card kr-card-math">${head(C.navy, 'Math 숙제 결과', subjSub(m.math), 'Math', 'background:#e6e9f2', pg(i))}`
      + `<div class="kr-body"><div class="kr-box">${setRows(m.math)}</div>`
      + `<div class="kr-h">잘한 점 · 다시 볼 점</div><div class="kr-box"><ul>`
      + `<li><b>잘한 점:</b> ${esc(e.praise)}</li><li><b>다시 볼 점:</b> ${esc(e.review)}</li></ul></div>`
      + (e1.showNextMath !== false ? `<div class="kr-h">다음 주 Math 숙제</div><div class="kr-box kr-nx">${esc(e.nextMath)}</div>` : '')
      + (last ? messageBox(e) : '') + `</div>${foot(m, last)}</div>`);
    i++;
  }
  if (m.ts) {
    const areas = m.ts.areas.map(a => {
      const b = a.band ? BANDS[a.band] : null;
      const dots = a.level ? `<span class="kr-dots">${'●'.repeat(Math.min(5, a.level))}${'○'.repeat(Math.max(0, 5 - a.level))}</span><span class="kr-lvn">${a.level}단계</span>` : '<span class="kr-dots"></span><span class="kr-lvn"></span>';
      return `<div class="kr-row kr-lv"><span class="kr-lvname"><b>${esc(a.name)}</b><small>${esc(a.desc)}</small></span>${dots}<span class="kr-s" style="color:${b ? b.color : C.gray}">${b ? b.label : ''}</span></div>`;
    }).join('');
    cards.push(`<div class="kr-card kr-card-ts">${head(C.tsHead, 'Thinking Skills 숙제 결과', subjSub(m.ts), 'Thinking Skills', 'background:#d9f0ef;color:#0f6f6f', pg(i))}`
      + `<div class="kr-body"><div class="kr-box">${setRows(m.ts)}${m.ts.hint ? '<div class="kr-note">힌트: 막혔을 때 실마리를 보고 맞힌 문제</div>' : ''}</div>`
      + (m.ts.areas.length ? `<div class="kr-h">이번 주 Thinking Skills 영역별 결과</div><div class="kr-box">${areas}<div class="kr-note">단계: 1(기초)~5(시험 최상위) · 이번 주 푼 문항 기준</div></div>` : '')
      + (e1.showNextTs !== false ? `<div class="kr-box kr-nx"><b>다음 주 숙제</b> · ${esc(e.nextTs)}</div>` : '')
      + (lastOf1 ? messageBox(e) : '') + `</div>${foot(m, lastOf1)}</div>`);
    i++;
  }
  if (p2) {
    const sub = esc(p2.dateText) + (p2.topic ? ' · ' + esc(p2.topic) : '');
    const learned = String(e.learned || '').split('\n').map(s => s.trim()).filter(Boolean).map(line => {
      const k = line.indexOf(':');
      return k > 0 && k < 40 ? `<li><b>${esc(line.slice(0, k))}:</b> ${esc(line.slice(k + 1).trim())}</li>` : `<li>${esc(line)}</li>`;
    }).join('');
    let testHtml = '';
    if (p2.test && e.showTest !== false) {
      const r = testResult(p2.test, e.testWrong, e.testScore);
      const scoreTxt = r.score == null ? `__ / ${r.total}` : `${r.score} / ${r.total}`;
      const sc = r.score == null ? C.gray : (BANDS[r.score / r.total >= 0.75 ? 'good' : r.score / r.total >= 0.5 ? 'mid' : 'low'].color);
      const rows = r.entered ? r.units.slice(0, 5).map(u => {
        const q = u.correct / u.total, col = q >= 0.75 ? C.green : q >= 0.5 ? C.yellow : C.orange;
        return `<div class="kr-row kr-unit"><span>${esc(u.name)}</span><span class="kr-s" style="color:${col}">${u.correct}/${u.total}</span></div>`;
      }).join('') : '';
      testHtml = `<div class="kr-h">오늘 본 테스트</div><div class="kr-box"><div class="kr-row"><span><b>${esc(p2.test.title)}</b> (${r.total}문항)</span>`
        + `<span class="kr-s${r.score == null ? ' kr-fillchip' : ''}" style="color:${sc}">${scoreTxt}</span></div>${rows}`
        + (r.note ? `<div class="kr-note">${esc(r.note)}</div>` : '') + `</div>`;
    }
    cards.push(`<div class="kr-card kr-card-lesson">${head(C.navy, '오늘 수업', sub, '2부 · 수업', '', pg(i))}`
      + `<div class="kr-body"><div class="kr-h">오늘 배운 내용</div><div class="kr-box"><ul>${learned}</ul></div>${testHtml}</div>${foot(m, false)}</div>`);
    i++;
    const hw = String(e.weekHw || '').split('\n').map(s => s.trim()).filter(Boolean).map(s => `<li>${esc(s)}</li>`).join('');
    cards.push(`<div class="kr-card kr-card-wrap">${head(C.navy, '이번 주 숙제 · 원장 한마디', sub, '2부 · 수업', '', pg(i))}`
      + `<div class="kr-body">` + (hw ? `<div class="kr-h">이번 주 숙제</div><div class="kr-box"><ul>${hw}</ul></div>` : '')
      + messageBox(e) + `</div>${foot(m, true)}</div>`);
  }
  return cards;
}

const KR = { compute, computeMath, computeTs, renderCards, testResult, koDate, setSubunit, shortSetTitle, band, BANDS, TS_AREAS, MATH_STRANDS, PLACEHOLDER, josa, subjLines };
if (typeof module !== 'undefined' && module.exports) { module.exports = KR; return; }
root.KR = KR;

// ═══ ③ 교사 화면 탭 ═══════════════════════════════════════════════════════

const S = { sid: '', period: null, data: null, model: null, edit: null, dirty: false, loading: false, err: '', owner: null };
root._krState = S;

function _ownerOk() {
  // currentUser 는 index.html 의 `let` 이라 window 에 없다 — 전역 이름으로 읽는다
  // eslint-disable-next-line no-undef
  const id = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.id : null;
  if (S.owner !== id) { krReset(); S.owner = id; }
}
/** 학생을 바꾸거나 로그아웃하면 이전 미리보기·편집 문장을 지운다(1-C). */
function krReset() {
  S.sid = ''; S.period = null; S.data = null; S.model = null; S.edit = null; S.dirty = false; S.err = '';
  S.store = null; S.lessons = []; S.lessonId = '';
  const el = document.getElementById('kakaoReport'); if (el) el.innerHTML = '';
}
root.krReset = krReset;

function _periodKey(p) { return `${p.year}_m${String(p.month).padStart(2, '0')}_w${p.week}`; }
function _koRange(p) {
  try {
    const mon = root._getMondayOfWeek(p.year, p.month, p.week);
    if (!mon) return _periodKey(p);
    const fri = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 4);
    const a = `${mon.getMonth() + 1}월 ${mon.getDate()}일`;
    const b = fri.getMonth() === mon.getMonth() ? `${fri.getDate()}일` : `${fri.getMonth() + 1}월 ${fri.getDate()}일`;
    return a + '–' + b;
  } catch (e) { return _periodKey(p); }
}

/**
 * 그 주(와 다음 주) 자료 받기 — 지난 주는 그 주 숙제 칸만.
 * ⛔ 목록(_dbShallowKeys)을 못 받으면 **전체 읽기로 넘어가지 않는다**(_ensurePeriodLoaded 의 옛 길을 안 탄다).
 */
async function krLoad(periods) {
  const base = root.getStore();
  const hw = Object.assign({}, base.homeworkSets || {});
  const sub = Object.assign({}, base.submissions || {});
  const need = periods.filter(p => !root._recentPeriodKeySet().has(root._periodCanon(p)));
  if (need.length) {
    const L = root._teacherLean;
    if (!L) throw new Error('NO-LEAN');
    const keys = await root._dbShallowKeys('homeworkSets');
    if (!keys) throw new Error('LIST-FAIL');
    for (const p of need) {
      const canon = root._periodCanon(p);
      const re = new RegExp('_' + canon.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(_|$)');
      const want = keys.filter(k => re.test(k));
      const vals = await Promise.all(want.map(k => root.FB_REF.child('homeworkSets/' + k).once('value').then(s => s.val())));
      want.forEach((k, i) => { if (vals[i] != null) hw[k] = vals[i]; });
      for (const k of Object.keys((L.data && L.data.submissions) || {})) if (re.test(k)) sub[k] = L.data.submissions[k];
    }
  }
  return Object.assign({}, base, { homeworkSets: hw, submissions: sub });
}

function _students(store) {
  return (store.users || []).filter(u => u.role === 'student' && u.status !== 'inactive' && !u.isTest)
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko'));
}

function _build(store, student, p, lesson) {
  const country = student.country || 'AU';
  const hw = root.hwLookup(store, student.year, country, p, student.group);
  const subs = {}, stale = {};
  ((hw && hw.sets) || []).forEach((_, i) => {
    const s = store.submissions[root.subKey(student.id, p, i)];
    subs[i] = s;
    stale[i] = !!(s && s.submitted && root.subIsStale(store, s, student.year, country, p, student.group));
  });
  let personal = false;
  try { personal = root.hwViewFor(store, student, p).kind === 'personal'; } catch (e) { /* 교사 캐시 없음 — 그룹으로 본다 */ }
  return compute({
    student: Object.assign({}, student, { classMode: student.classMode || 'onsite' }),
    periodText: _koRange(p), periodKey: _periodKey(p),
    hw, subs, stale,
    tsProgress: store.submissions[root.tsSubKey(student.id, p)],
    nextHw: root.hwLookup(store, student.year, country, root.nextPeriod(p), student.group),
    normAns: root.normAns, personal, lesson: lesson || null
  });
}

/** [3단계] 이 학생의 수업 요약들(일꾼이 올린 것) — 원장 계정만 읽는다. 못 읽으면 빈 목록(1부만). */
async function krLoadLessons(sid) {
  try {
    const v = (await root.FB_REF.root.child('sol_prep_v1/lessonSummaries/' + sid).once('value')).val() || {};
    return Object.keys(v).map(id => Object.assign({ id }, v[id])).filter(x => x && x.lessonDate)
      .sort((a, b) => String(b.lessonDate).localeCompare(String(a.lessonDate)) || String(b.foundAt || '').localeCompare(String(a.foundAt || '')));
  } catch (e) { console.warn('[카톡 카드] 수업 요약 못 읽음:', e && (e.code || e.message)); return null; }
}
/** 숙제 주(p)의 「다음 주」(카드를 보내는 주) 월~일에 든 수업 — 가장 늦은 것 */
function _defaultLesson(lessons, p) {
  try {
    const q = root.nextPeriod(p);
    const mon = root._getMondayOfWeek(q.year, q.month, q.week);
    if (!mon) return null;
    const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const a = ymd(mon), b = ymd(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6));
    return (lessons || []).find(x => x.lessonDate >= a && x.lessonDate <= b) || null;
  } catch (e) { return null; }
}
/** 2부 수업 고르기 — 1부 편집은 그대로 두고 2부 칸만 새로 채운다 */
function krPickLesson(el) {
  const id = el.value;
  const lesson = (S.lessons || []).find(x => x.id === id) || null;
  const st = S.store.users.find(u => u.id === S.sid);
  const keep = S.edit;
  S.lessonId = lesson ? lesson.id : '';
  S.model = _build(S.store, st, S.period, lesson);
  const fresh = S.model.edit || {};
  S.edit = Object.assign({}, fresh, keep ? {
    check: keep.check, praise: keep.praise, review: keep.review, nextMath: keep.nextMath, nextTs: keep.nextTs,
    showNextMath: keep.showNextMath, showNextTs: keep.showNextTs, message: keep.message } : {});
  S.dirty = true;
  krRender();
}

async function krOpen() {
  const sid = document.getElementById('krStudent').value;
  const y = +document.getElementById('krYear').value, mo = +document.getElementById('krMonth').value, w = +document.getElementById('krWeek').value;
  if (!sid || !(y && mo && w)) return;
  const p = { year: y, month: mo, week: Math.min(w, root.weeksInMonth(y, mo)) };
  if (S.dirty && !confirm('고친 문장이 사라집니다. 계속할까요?')) { krRender(); return; }
  if (sid !== S.sid) { S.model = null; S.edit = null; }   // 다른 학생 → 이전 미리보기 지움
  S.sid = sid; S.period = p; S.dirty = false; S.err = ''; S.loading = true; S.model = null;
  krRender();
  try {
    const store = await krLoad([p, root.nextPeriod(p)]);
    if (S.sid !== sid || S.period !== p) return;           // 그새 바뀌었다
    const st = store.users.find(u => u.id === sid);
    // [3단계] 1부+2부 학생이면 수업 요약을 읽어 다음 주(보내는 주) 수업을 2부로
    S.lessons = (st.reportParts || 'both') === 'part1' ? [] : await krLoadLessons(sid);
    if (S.sid !== sid || S.period !== p) return;
    const lesson = _defaultLesson(S.lessons, p);
    S.store = store; S.lessonId = lesson ? lesson.id : '';
    S.model = _build(store, st, p, lesson);
    S.edit = S.model.edit ? Object.assign({}, S.model.edit) : null;
  } catch (e) {
    S.err = (e && e.message) === 'LIST-FAIL' || (e && e.message) === 'NO-LEAN'
      ? '지난 주 자료를 못 받았습니다. 다시 시도해 주세요.' : ('자료를 읽지 못했습니다: ' + ((e && e.message) || e));
  }
  S.loading = false;
  krRender();
}

function _field(key, label, rows) {
  return `<label class="kr-f"><span>${label}</span><textarea rows="${rows}" data-k="${key}" oninput="krEdit(this)">${esc(S.edit[key])}</textarea></label>`;
}
function krEdit(el) {
  S.edit[el.dataset.k] = el.value; S.dirty = true;
  _paintCards();
}
// 다음 주 숙제 칸을 카드에 넣을지 — 체크칸
function _nextField(key, showKey, label) {
  const on = S.edit[showKey] !== false;
  return `<label class="kr-f"><span>${label} <label class="kr-chk"><input type="checkbox" data-k="${showKey}"${on ? ' checked' : ''} onchange="krToggle(this)"> 카드에 넣기</label></span>`
    + `<textarea rows="2" data-k="${key}" oninput="krEdit(this)"${on ? '' : ' disabled'}>${esc(S.edit[key])}</textarea></label>`;
}
function krToggle(el) {
  S.edit[el.dataset.k] = el.checked; S.dirty = true;
  el.closest('.kr-f').querySelectorAll('textarea, input:not([type=checkbox])').forEach(x => { x.disabled = !el.checked; });
  _paintCards();
}

function _paintCards() {
  const box = document.getElementById('krCards');
  if (!box || !S.model || !S.edit) return;
  const m = Object.assign({}, S.model, { edit: S.edit });
  box.innerHTML = renderCards(m).map(h => `<div class="kr-frame"><div class="kr-scope kr-scale">${h}</div></div>`).join('');
  // 글이 넘치면 글자를 단계적으로 줄이고, 그래도 넘치면 경고 + 저장 막기
  const over = [];
  box.querySelectorAll('.kr-card').forEach((card, i) => {
    const body = card.querySelector('.kr-body');
    for (const lv of ['', 'kr-fs1', 'kr-fs2', 'kr-fs3']) {
      card.classList.remove('kr-fs1', 'kr-fs2', 'kr-fs3');
      if (lv) card.classList.add(lv);
      if (body.scrollHeight <= body.clientHeight + 1) break;
    }
    if (body.scrollHeight > body.clientHeight + 1) over.push(i + 1);
  });
  S.overflow = over;
  _paintGuard();
}
function _paintGuard() {
  const g = document.getElementById('krGuard'), btn = document.getElementById('krSave');
  if (!g || !btn) return;
  const why = [];
  if (Object.values(S.edit).some(v => typeof v === 'string' && v.includes(PLACEHOLDER))) why.push(`「${PLACEHOLDER}」 자리를 채워 주세요.`);
  if (S.overflow && S.overflow.length) why.push(`글이 깁니다 — ${S.overflow.join(', ')}번 카드에서 글이 넘칩니다. 문장을 줄여 주세요.`);
  const p2 = S.model && S.model.part2;
  if (p2 && p2.test && S.edit.showTest !== false) {
    const r = testResult(p2.test, S.edit.testWrong, S.edit.testScore);
    if (!r.entered) why.push('오늘 테스트의 틀린 번호를 넣어 주세요(다 맞았으면 0). 테스트를 빼려면 「카드에 넣기」를 끄세요.');
    if (r.bad.length) why.push(`테스트에 없는 번호: ${r.bad.join(', ')}`);
    if (r.score != null && (r.score < 0 || r.score > r.total)) why.push(`점수가 0~${r.total} 밖입니다.`);
  }
  g.innerHTML = why.map(w => `<div>⚠️ ${esc(w)}</div>`).join('');
  btn.disabled = why.length > 0;
}

async function krSave() {
  if (!S.model || !S.edit) return;
  _paintGuard();
  if (document.getElementById('krSave').disabled) return;
  const m = Object.assign({}, S.model, { edit: S.edit });
  const html = renderCards(m);
  if (!confirm(`${m.student.name} 학생 카드 ${html.length}장을 저장합니다.\n받는 학부모가 맞는지 확인하세요.`)) return;
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  const cap = document.createElement('div');
  cap.className = 'kr-scope kr-capture';
  document.body.appendChild(cap);
  try {
    for (let i = 0; i < html.length; i++) {
      cap.innerHTML = html[i];
      const card = cap.firstElementChild;
      const shown = document.querySelectorAll('#krCards .kr-card')[i];
      if (shown) ['kr-fs1', 'kr-fs2', 'kr-fs3'].forEach(c => { if (shown.classList.contains(c)) card.classList.add(c); });
      const canvas = await root.html2canvas(card, { scale: 1, width: 1080, height: 1350, backgroundColor: '#faf7f0', useCORS: true, logging: false });
      if (canvas.width !== 1080 || canvas.height !== 1350) {
        alert(`⚠️ ${i + 1}번 카드 크기가 ${canvas.width}×${canvas.height} 입니다(1080×1350 이어야 함). 저장하지 않았습니다.`);
        return;
      }
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${String(m.student.name).replace(/\s+/g, '')}_${m.periodKey}_${i + 1}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      await new Promise(r => setTimeout(r, 400));
    }
    S.dirty = false;
  } finally { cap.remove(); }
}

/** 학생 설정 두 칸 — 그 학생 줄의 두 칸만 낱칸으로 쓴다(5절). */
function krSaveSettings() {
  const store = root.getStore();
  const i = (store.users || []).findIndex(u => u.id === S.sid);
  if (i < 0) return;
  if (!root._usersCanonical) { alert('⚠️ 학생 명단을 아직 서버에서 다 받지 못해 저장하지 않았습니다. 새로고침한 뒤 다시 해 주세요.'); return; }
  const rp = document.getElementById('krRP').value, cm = document.getElementById('krCM').value;
  root.fbWrite({ [`users/${i}/reportParts`]: rp, [`users/${i}/classMode`]: cm });
  store.users[i].reportParts = rp; store.users[i].classMode = cm;
  root.saveStore(store);
  if (S.model) { S.model.student.online = cm === 'online'; _paintCards(); }
  if (root.showBackupToast) root.showBackupToast('✅ 학생 설정 저장');
}

function krRender() {
  _ownerOk();
  const el = document.getElementById('kakaoReport');
  if (!el) return;
  const store = root.getStore();
  const studs = _students(store);
  const p = S.period || root.prevPeriod(root.getTodayPeriod());
  const yOpt = [2025, 2026, 2027].map(y => `<option value="${y}"${y === p.year ? ' selected' : ''}>${y}</option>`).join('');
  const mOpt = Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}"${i + 1 === p.month ? ' selected' : ''}>${i + 1}월</option>`).join('');
  const wOpt = Array.from({ length: root.weeksInMonth(p.year, p.month) }, (_, i) => i + 1)
    .map(w => `<option value="${w}"${w === p.week ? ' selected' : ''}>${esc(root.periodLabelShort({ year: p.year, month: p.month, week: w }))}</option>`).join('');
  const sOpt = studs.map(s => `<option value="${esc(s.id)}"${s.id === S.sid ? ' selected' : ''}>${esc(s.name)} (Y${esc(s.year)})</option>`).join('');
  const st = studs.find(s => s.id === S.sid);
  let body = '';
  if (S.loading) body = '<div class="kr-msgline">⏳ 불러오는 중…</div>';
  else if (S.err) body = `<div class="kr-msgline kr-err">${esc(S.err)} <button class="btn-sm btn-navy" onclick="krOpen()">다시 시도</button></div>`;
  else if (S.model && S.model.blocked) body = `<div class="kr-msgline">${esc(S.model.blocked)}</div>`;
  else if (S.model && S.model.noHomework) body = `<div class="kr-msgline">이 주에는 배정된 숙제가 없습니다.</div>`
    + (S.model.warn.length ? `<div class="kr-warn">${S.model.warn.map(w => '<div>• ' + esc(w) + '</div>').join('')}</div>` : '');
  else if (S.model) {
    const m = S.model;
    const both = st && (st.reportParts || 'both') !== 'part1';
    let lessonPick = '';
    if (both) {
      if (S.lessons === null) lessonPick = `<div class="kr-warn">2부 수업 요약을 읽지 못했습니다 — 1부만 만듭니다.</div>`;
      else {
        const opts = [`<option value="">2부 빼기 (1부만)</option>`].concat((S.lessons || []).slice(0, 12).map(x =>
          `<option value="${esc(x.id)}"${x.id === S.lessonId ? ' selected' : ''}>${esc(KR.koDate(x.lessonDate))}${x.topic ? ' · ' + esc(x.topic) : ''}</option>`)).join('');
        lessonPick = `<label class="kr-f"><span>2부 수업 (수업 요약에서 고르기)</span><select onchange="krPickLesson(this)">${opts}</select></label>`
          + (!(S.lessons || []).length ? `<div class="kr-help">아직 들어온 수업 요약이 없습니다. 프로젝트가 교재와 함께 「…_수업요약.json」을 저장하면 여기에 나타납니다.</div>`
            : (!S.lessonId ? `<div class="kr-help">보내는 주에 든 수업 요약이 없어 2부를 뺐습니다. 위에서 고르면 넣을 수 있습니다.</div>` : ''));
      }
    }
    const p2 = m.part2;
    const testBox = p2 && p2.test ? `<label class="kr-f"><span>오늘 테스트 — ${esc(p2.test.title)} (${p2.test.questions.length}문항) <label class="kr-chk"><input type="checkbox" data-k="showTest"${S.edit.showTest !== false ? ' checked' : ''} onchange="krToggle(this)"> 카드에 넣기</label></span>`
      + `<input data-k="testWrong" placeholder="틀린 번호 (예: 3, 7, 12 · 다 맞았으면 0)" value="${esc(S.edit.testWrong)}" oninput="krEdit(this)"${S.edit.showTest !== false ? '' : ' disabled'}>`
      + `<input data-k="testScore" placeholder="점수 (비우면 문항 수 − 틀린 수)" value="${esc(S.edit.testScore)}" oninput="krEdit(this)"${S.edit.showTest !== false ? '' : ' disabled'}></label>` : '';
    body = `<div class="kr-wrap"><div class="kr-side">`
      + (m.warn.length ? `<div class="kr-warn"><b>교사 화면에만 보이는 알림</b>${m.warn.map(w => '<div>• ' + esc(w) + '</div>').join('')}</div>` : '')
      + lessonPick
      + `<div class="kr-sec">1부 · 숙제</div>`
      + _field('check', '이번 주 숙제 점검 (줄마다 과목)', 3)
      + (m.math ? _field('praise', '잘한 점', 2) + _field('review', '다시 볼 점', 2) + (p2 ? '' : _nextField('nextMath', 'showNextMath', '다음 주 Math 숙제')) : '')
      + (m.ts && !p2 ? _nextField('nextTs', 'showNextTs', '다음 주 Thinking Skills 숙제') : '')
      + (p2 ? `<div class="kr-sec">2부 · 수업 (${esc(p2.dateText)})</div>` + _field('learned', '오늘 배운 내용 (한 줄에 하나 · 「제목: 설명」)', 4) + testBox + _field('weekHw', '이번 주 숙제 (한 줄에 하나)', 3) : '')
      + _field('message', '원장 선생님 한마디', 4)
      + `<div id="krGuard" class="kr-guard"></div>`
      + `<button id="krSave" class="btn-sm btn-navy" style="font-size:15px;padding:10px 18px" onclick="krSave()">🖼 카드 이미지 저장</button>`
      + `<div class="kr-help">PC 다운로드 폴더에 저장됩니다. 카카오톡 대화창으로 끌어다 놓아 보내세요. 글자가 흐리면 '파일로 전송'으로 원본을 보내세요. 보낸 뒤 파일은 지워도 됩니다.<br>크롬이 「여러 파일 다운로드 허용」을 물으면 한 번 허용해 주세요.</div>`
      + `</div><div id="krCards" class="kr-cards"></div></div>`;
  }
  const settings = st ? `<div class="kr-set">학생 설정 — 리포트 구성 <select id="krRP"><option value="both"${(st.reportParts || 'both') === 'both' ? ' selected' : ''}>1부+2부</option><option value="part1"${st.reportParts === 'part1' ? ' selected' : ''}>1부만</option></select>`
    + ` 수업 방식 <select id="krCM"><option value="onsite"${(st.classMode || 'onsite') === 'onsite' ? ' selected' : ''}>현장</option><option value="online"${st.classMode === 'online' ? ' selected' : ''}>온라인</option></select>`
    + ` <button class="btn-sm btn-blue" onclick="krSaveSettings()">설정 저장</button></div>` : '';
  el.innerHTML = `<div class="page-title">💬 카톡 리포트</div>`
    + `<div class="kr-bar"><select id="krStudent"><option value="">-- 학생 --</option>${sOpt}</select>`
    + `<select id="krYear" onchange="krWeekOpts()">${yOpt}</select><select id="krMonth" onchange="krWeekOpts()">${mOpt}</select><select id="krWeek">${wOpt}</select>`
    + `<button class="btn-sm btn-navy" onclick="krOpen()">카드 만들기 ▶</button></div>` + settings + body;
  if (S.model && S.edit && !S.model.noHomework && !S.model.blocked) _paintCards();
}
function krWeekOpts() {
  const y = +document.getElementById('krYear').value, mo = +document.getElementById('krMonth').value;
  document.getElementById('krWeek').innerHTML = Array.from({ length: root.weeksInMonth(y, mo) }, (_, i) => i + 1)
    .map(w => `<option value="${w}">${esc(root.periodLabelShort({ year: y, month: mo, week: w }))}</option>`).join('');
}
function krMount() { krRender(); }

window.addEventListener('beforeunload', ev => { if (S.dirty) { ev.preventDefault(); ev.returnValue = ''; } });

Object.assign(root, { krMount, krRender, krOpen, krEdit, krToggle, krPickLesson, krSave, krSaveSettings, krWeekOpts });
})(typeof window !== 'undefined' ? window : globalThis);
