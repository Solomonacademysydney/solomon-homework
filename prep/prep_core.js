/* =============================================================================
 * prep_core.js — 수업 준비 화면(/prep/)의 **셈만** 모은 곳 (3단계 · 2026-10-01)
 *
 * 화면(prep/index.html)과 시험(functions/화면시험/prep_*.test.js)이 **같은 파일**을 쓴다.
 * DB·화면을 만지지 않는다 — 받은 자료로 셈만 한다(그래서 node 로 바로 시험한다).
 *
 * ⛔ 학생 화면(index.html)과 어긋나면 안 되는 셈이 셋 있다. 셋 다 시험이 「같은가」를 지킨다.
 *    ① 날짜 → 숙제 주차(periodOfDate ↔ getTodayPeriod · ISO 목요일 규칙)
 *    ② 숙제 칸 고르기(hwKey · 그룹 칸 → 공통 칸 폴백 · 개인 배정 우선)
 *    ③ 약점 합치기(weaknessMerge ↔ _weaknessMerge · 안전 키)
 * ============================================================================= */
(function (root) {
  'use strict';

  // ───────────────────────── 날짜 ─────────────────────────
  const 요일 = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const 한글요일 = { '월': 'mon', '화': 'tue', '수': 'wed', '목': 'thu', '금': 'fri', '토': 'sat', '일': 'sun',
    '월요일': 'mon', '화요일': 'tue', '수요일': 'wed', '목요일': 'thu', '금요일': 'fri', '토요일': 'sat', '일요일': 'sun' };
  const 요일말 = { mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일' };

  function ymd(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function parseYmd(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    return m ? new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0) : null;
  }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12, 0, 0); }

  /** 날짜 → 숙제 주차 {year, month, week}. 학생 화면 getTodayPeriod 와 같은 규칙(ISO: 그 주 목요일이 든 달). */
  function periodOfDate(day) {
    const dow = day.getDay();
    const diffToMon = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(day.getFullYear(), day.getMonth(), day.getDate() + diffToMon);
    const thursday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 3);
    const year = thursday.getFullYear();
    const month = thursday.getMonth() + 1;
    // 그 달에 귀속되는 월요일들(목요일이 그 달) 가운데 몇 번째인가
    const mondays = [];
    for (let d = -6; d <= 0; d++) {
      const dt = new Date(year, month - 1, d);
      if (dt.getDay() === 1) {
        const thu = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + 3);
        if (thu.getMonth() + 1 === month && thu.getFullYear() === year) mondays.push(dt);
      }
    }
    const dim = new Date(year, month, 0).getDate();
    for (let d = 1; d <= dim; d++) {
      const dt = new Date(year, month - 1, d);
      if (dt.getDay() === 1) {
        const thu = new Date(year, month - 1, d + 3);
        if (thu.getMonth() + 1 === month) mondays.push(dt);
      }
    }
    const i = mondays.findIndex(m => m.getFullYear() === monday.getFullYear() && m.getMonth() === monday.getMonth() && m.getDate() === monday.getDate());
    return { year, month, week: i >= 0 ? i + 1 : 1 };
  }
  function periodKey(p) { return p.year + '_m' + String(p.month).padStart(2, '0') + '_w' + p.week; }
  function samePeriod(a, b) { return !!(a && b && +a.year === +b.year && +a.month === +b.month && +a.week === +b.week); }

  // ───────────────────────── 수업 요일 · 최근 수업 ─────────────────────────
  /** 수업 요일 — 학생 줄의 days(영어·한글) 우선, 없으면 attendance_days[sid][1] */
  function classDaysOf(user, attendanceDays) {
    const out = [];
    const add = (x) => { const s = String(x || '').trim().toLowerCase(); const k = 요일.includes(s) ? s : 한글요일[String(x || '').trim()]; if (k && !out.includes(k)) out.push(k); };
    (Array.isArray(user && user.days) ? user.days : []).forEach(add);
    if (!out.length && attendanceDays && attendanceDays[user.id]) {
      const a = attendanceDays[user.id];
      (Array.isArray(a) ? a.slice(1) : []).forEach(add);
    }
    return out;
  }
  /** 오늘 다음(오늘 제외) 첫 수업일 — 없으면 null */
  function nextClassDate(days, today) {
    if (!days.length) return null;
    for (let i = 1; i <= 7; i++) { const d = addDays(today, i); if (days.includes(요일[d.getDay()])) return d; }
    return null;
  }
  /** 출석 기록으로 본 최근 수업일들(오늘 포함 이전) — 새것부터 */
  function pastClassDates(sid, attendance, today, n) {
    const t = ymd(today);
    const ds = Object.keys(attendance || {}).filter(d => d <= t && attendance[d] && attendance[d][sid]).sort().reverse();
    return ds.slice(0, n || 2);
  }
  /** 「지난주」 = 직전 수업과 그 앞 수업 사이(분석 기간). 출석 기록이 없으면 요일로 짐작(표시에 「짐작」).
   *  [10-02] 최근 출석이 14일보다 오래됐으면 믿지 않고 요일로 짐작한다 — 출석부가 4-24 에서 끊겨
   *  7명의 「지난주」가 4월로 나왔다(운영 실측). */
  const 출석유효일 = 14;
  function analysisWindow(user, attendance, attendanceDays, today) {
    const 기록 = pastClassDates(user.id, attendance, today, 2);
    if (기록.length && parseYmd(기록[0]) >= addDays(today, -출석유효일)) {
      const last = parseYmd(기록[0]);
      const prev = 기록[1] ? parseYmd(기록[1]) : addDays(last, -7);
      return { lastClass: 기록[0], prevClass: 기록[1] || null, from: ymd(addDays(prev, 1)), to: 기록[0], source: 'attendance',
               status: attendance[기록[0]][user.id] };
    }
    const days = classDaysOf(user, attendanceDays);
    for (let i = 0; i <= 7 && days.length; i++) {
      const d = addDays(today, -i);
      if (days.includes(요일[d.getDay()])) return { lastClass: ymd(d), prevClass: null, from: ymd(addDays(d, -6)), to: ymd(d), source: 'weekday', status: null };
    }
    return { lastClass: null, prevClass: null, from: ymd(addDays(today, -6)), to: ymd(today), source: 'none', status: null };
  }
  /** 분석 기간에 걸친 숙제 주차들(겹치지 않게) */
  function periodsInWindow(win) {
    const out = [];
    let d = parseYmd(win.from); const end = parseYmd(win.to);
    while (d && end && d <= end) { const p = periodOfDate(d); if (!out.some(x => samePeriod(x, p))) out.push(p); d = addDays(d, 1); }
    return out;
  }
  /** 학생 목록 차례 — 내일 수업 → 가까운 수업일 → 이름 */
  function orderStudents(students, attendanceDays, today) {
    const 내일 = 요일[addDays(today, 1).getDay()];
    const 정보 = students.map(u => {
      const days = classDaysOf(u, attendanceDays);
      const next = nextClassDate(days, today);
      return { u, days, tomorrow: days.includes(내일), next };
    });
    정보.sort((a, b) => (b.tomorrow - a.tomorrow)
      || ((a.next ? a.next.getTime() : Infinity) - (b.next ? b.next.getTime() : Infinity))
      || String(a.u.name || a.u.id).localeCompare(String(b.u.name || b.u.id), 'ko'));
    return 정보.map(x => ({ user: x.u, days: x.days, tomorrow: x.tomorrow, nextClass: x.next ? ymd(x.next) : null }));
  }

  // ───────────────────────── 숙제 칸 고르기 ─────────────────────────
  function hwKey(year, country, p, group) {
    const g = group ? '-' + group : '';
    return country + '_y' + year + g + '_' + p.year + '_m' + String(p.month).padStart(2, '0') + '_w' + p.week;
  }
  function subKey(sid, p, i) { return sid + '_' + p.year + '_m' + String(p.month).padStart(2, '0') + '_w' + p.week + '_s' + i; }
  function tsSubKey(sid, p) { return 'ts_' + sid + '_' + p.year + '_m' + String(p.month).padStart(2, '0') + '_w' + p.week; }
  /** 교사 쪽 판정 — 학생 화면 hwViewFor 와 같은 차례: 개인 배정(공개) → 개인 배정(비공개)=준비 중 → 그룹 칸 → 공통 칸 */
  function viewForTeacher(user, p, homeworkSets, releases) {
    for (const aid of Object.keys(releases || {})) {
      const r = releases[aid];
      if (r && r.studentId === user.id && samePeriod(r.period, p)) {
        return r.published === true ? { kind: 'personal', assignmentId: aid, release: r } : { kind: 'pending', reason: 'personal-hidden', assignmentId: aid };
      }
    }
    const sets = homeworkSets || {};
    const country = user.country || 'AU';
    const k1 = hwKey(user.year, country, p, user.group || '');
    const k2 = user.group ? hwKey(user.year, country, p, '') : null;
    const key = sets[k1] ? k1 : (k2 && sets[k2] ? k2 : null);
    if (!key) return { kind: 'none' };
    const hw = sets[key];
    return { kind: hw.published === false ? 'pending' : 'group', hwKey: key, hw, reason: hw.published === false ? 'group-hidden' : undefined };
  }

  // ───────────────────────── 숙제 분석 ─────────────────────────
  const 목록 = (v) => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.keys(v).sort((a, b) => (+a) - (+b)).map(k => v[k]) : []);

  /**
   * 한 학생 · 여러 주차 숙제 분석. 같은 제출(같은 열쇠)은 **한 번만** 센다.
   *   돌려주는 것 = { weeks:[{period, kind, ref, sets:[…], ts}], counted:[열쇠…], totals }
   *   세트 = { title, key, submitted, submittedAt, score, correct, total, unanswered, manual, personal }
   *   TS   = { days, done, questions, firstTry, hintUsed, firstTryRate, hintRate }
   */
  function analyzeHomework({ user, periods, homeworkSets, submissions, releases, prepSubs, normAns }) {
    const 센것 = new Set();
    const weeks = [];
    const tot = { sets: 0, submitted: 0, manual: 0, scoreSum: 0, scored: 0, unanswered: 0, tsQ: 0, tsFirst: 0, tsHint: 0 };
    for (const p of periods) {
      const v = viewForTeacher(user, p, homeworkSets, releases);
      const w = { period: p, kind: v.kind, ref: v.assignmentId || v.hwKey || null, sets: [], ts: null };
      if (v.kind === 'personal') {
        const r = v.release; const mine = (((prepSubs || {})[v.assignmentId] || {})[user.id]) || {};
        for (const setId of Object.keys(r.sets || {})) {
          const 열쇠 = 'prep:' + v.assignmentId + ':' + setId;
          if (센것.has(열쇠)) continue; 센것.add(열쇠);
          const s = r.sets[setId]; const qs = 목록(s.questions).filter(q => q && q.type !== 'written');
          const m = mine[setId] || {}; const last = m.latest && m.revs ? m.revs[String(m.latest)] : null;
          const ans = (last && last.answers) || {};
          const g = last && last.grade;
          const row = { title: s.title || setId, key: 열쇠, personal: true, submitted: !!last, submittedAt: last ? last.submittedAt || null : null,
            score: g ? g.score : null, correct: g ? g.correctCount : null, total: g ? g.total : qs.length,
            unanswered: last ? qs.filter(q => ans[q.id] == null || String(ans[q.id]).trim() === '').length : null, manual: false };
          w.sets.push(row);
        }
      } else if (v.kind === 'group' || v.kind === 'pending') {
        목록(v.hw && v.hw.sets).forEach((set, i) => {
          if (!set) return;
          const 열쇠 = subKey(user.id, p, i);
          if (센것.has(열쇠)) return; 센것.add(열쇠);
          const sub = (submissions || {})[열쇠] || null;
          const qs = 목록(set.questions).filter(q => q && q.type !== 'written');
          const ans = (sub && sub.answers) || {};
          const manual = !!(sub && sub.submitted && sub.manuallyMarked);
          let score = null, correct = null;
          if (sub && sub.submitted && !manual) {
            correct = qs.filter(q => normAns(ans[q.id]) === normAns(q.answer)).length;
            score = qs.length ? Math.round(correct / qs.length * 100) : 0;
          }
          w.sets.push({ title: set.title || ('Set ' + (i + 1)), key: 열쇠, personal: false, submitted: !!(sub && sub.submitted),
            submittedAt: sub ? sub.submitTime || null : null, score, correct, total: qs.length,
            unanswered: sub && sub.submitted && !manual ? qs.filter(q => ans[q.id] == null || String(ans[q.id]).trim() === '').length : null,
            manual, markedReason: manual ? sub.markedReason || '' : null });
        });
        // TS — 첫 시도 · 힌트
        const tsKey = tsSubKey(user.id, p);
        if (v.hw && v.hw.ts && !센것.has(tsKey)) {
          센것.add(tsKey);
          const prog = (submissions || {})[tsKey] || {};
          const days = Number((v.hw.ts.day_config || {}).total_days) || Object.keys(prog).filter(k => /^day\d+$/.test(k)).length;
          let done = 0, q = 0, first = 0, hint = 0;
          for (let d = 1; d <= days; d++) {
            const dd = prog['day' + d]; if (!dd) continue;
            if (dd.completed) done++;
            for (const a of 목록(dd.answers)) {
              if (!a) continue; q++;
              if (a.correct && Number(a.attempts) === 1 && !a.hint1_used && !a.hint2_used && !a.revealed) first++;
              if (a.hint1_used || a.hint2_used) hint++;
            }
          }
          w.ts = { days, done, questions: q, firstTry: first, hintUsed: hint,
            firstTryRate: q ? Math.round(first / q * 100) : null, hintRate: q ? Math.round(hint / q * 100) : null };
          tot.tsQ += q; tot.tsFirst += first; tot.tsHint += hint;
        }
      }
      for (const s of w.sets) {
        tot.sets++; if (s.submitted) tot.submitted++; if (s.manual) tot.manual++;
        if (s.score != null) { tot.scoreSum += s.score; tot.scored++; }
        if (s.unanswered) tot.unanswered += s.unanswered;
      }
      weeks.push(w);
    }
    return { weeks, counted: Array.from(센것), totals: {
      sets: tot.sets, submitted: tot.submitted, manual: tot.manual,
      avgScore: tot.scored ? Math.round(tot.scoreSum / tot.scored) : null, unanswered: tot.unanswered,
      tsFirstTryRate: tot.tsQ ? Math.round(tot.tsFirst / tot.tsQ * 100) : null, tsHintRate: tot.tsQ ? Math.round(tot.tsHint / tot.tsQ * 100) : null } };
  }

  // ───────────────────────── 약점(학생 화면과 같은 규칙) ─────────────────────────
  function taxSafeKey(taxId) {
    return String(taxId).replace(/[%.#$\[\]\/]/g, ch => '%' + ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'));
  }
  function taxFromSafeKey(key) { return String(key).replace(/%([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))); }
  /** 약점 상위 — 원문 분류로 묶어 최근 이력의 정답률이 낮은 순 */
  function weakTop(weaknessData, n, minAttempts) {
    const by = {};
    const skills = (weaknessData && weaknessData.skills) || {};
    for (const k of Object.keys(skills)) {
      const s = skills[k]; if (!s) continue;
      const t = s.taxonomyId || taxFromSafeKey(k);
      const h = 목록(s.history);
      if (!by[t]) by[t] = { taxId: t, attempts: 0, correct: 0 };
      by[t].attempts += h.length; by[t].correct += h.filter(x => x && x.correct).length;
    }
    return Object.values(by).filter(x => x.attempts >= (minAttempts || 2))
      .map(x => Object.assign(x, { accuracy: Math.round(x.correct / x.attempts * 100) }))
      .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts).slice(0, n || 3);
  }


  // ───────────────────────── 종이 시험 (3-B) ─────────────────────────
  // ⛔ 아래 두 함수는 학생 화면(index.html)에서 **글자째** 옮겼다 — 시험(prep_종이시험·채점규칙)이 같은지 지킨다.
  function normAns(a) {
    if (a === null || a === undefined) return a;
    let s = String(a).trim();
    // $...$ 제거 (KaTeX 마크업이 남아있을 경우)
    s = s.replace(/^\$+|\$+$/g, '').trim();
    // 분수 정규화: \dfrac{3}{5} → 3/5, 4\dfrac{2}{3} → 4 2/3
    s = s.replace(/(\d+)\s*\\d?frac\{(\d+)\}\{(\d+)\}/g, '$1 $2/$3');
    s = s.replace(/\\d?frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2');
    // LaTeX 명령어·중괄호 제거
    s = s.replace(/\\[a-zA-Z]+/g, '').replace(/[{}]/g, '');
    // Normalize unicode minus/dash variants to hyphen-minus (fixes "-8 vs −8" mismatch)
    s = s.replace(/[\u2212\u2013\u2014\u2010\u2011]/g, '-');
    // Normalize all whitespace variants (non-breaking space, thin space, etc.) to regular space
    s = s.replace(/[\u00A0\u2009\u202F\u3000]/g, ' ').replace(/\s+/g, ' ').trim();
    // Strip leading checkmark/cross symbols (PDF answer keys: "✓ ANSWER: B" → "ANSWER: B")
    s = s.replace(/^[✓✔☑✅❌⭕]\s*/, '').trim();
    // Strip "WORD: value" prefix — handles "ANSWER: B", "Answer: C", etc.
    s = s.replace(/^[A-Za-z]+\s*[:：]\s*/, '').trim();
    // Strip single-letter variable assignment — "X = 7" → "7", "x=-8" → "-8"
    s = s.replace(/^[A-Za-z]\s*=\s*/, '').trim();
    // Strip trailing % for percent answers ("50%" → "50")
    const pct = /^-?\d+(\.\d+)?\s*%$/.test(s);
    if (pct) s = s.replace(/\s*%$/, '');
    // Numeric normalization: "3.0" → "3", "05" → "5", "+7" → "7" (strict decimal only)
    if (/^[+-]?\d+(\.\d+)?$/.test(s)) {
      const n = parseFloat(s);
      if (Number.isFinite(n)) s = String(n);
    }
    return s.toUpperCase();
  }

  function _weaknessMerge(cur, cid, rev, v, now) {
    const contrib0 = (cur && cur.contrib) || {};
    const old = contrib0[cid];
    if (old && (old.rev || 0) >= rev) return undefined;      // 이미 이 판(또는 더 새 판)이 들어 있다
    if (!cur && !v.n) return null;                           // 빈 칸에 뺄 것만 — 만들지 않는다
    const base = cur || { attempts: 0, correct: 0, wrong: 0, history: [] };
    let attempts = base.attempts || 0, correct = base.correct || 0, wrong = base.wrong || 0;
    let history = Array.isArray(base.history) ? base.history.slice()
                : (base.history ? Object.values(base.history) : []);
    if (old) {
      attempts -= old.n || 0; correct -= old.c || 0; wrong -= (old.n || 0) - (old.c || 0);
      history = history.filter(h => !h || h.sub !== cid);
    }
    const list = v.list || [];
    for (const ok of list) history.push({ ts: now, correct: !!ok, sub: cid });
    attempts += v.n; correct += v.c; wrong += v.n - v.c;
    const contrib = Object.assign({}, contrib0, { [cid]: { rev, n: v.n, c: v.c } });
    const out = {
      attempts: Math.max(0, attempts), correct: Math.max(0, correct), wrong: Math.max(0, wrong),
      last_seen: v.n ? now : (base.last_seen || null),
      last_correct: v.c ? now : (base.last_correct || null),
      history: history.slice(-50),
      contrib
    };
    const tid = v.t || base.taxonomyId;
    if (tid) out.taxonomyId = tid;
    return out;
  }

  function weaknessMerge(cur, cid, rev, v, now) { return _weaknessMerge(cur, cid, rev, v, now); }

  /** 고정 testId — pt-YYYYMMDD-n(같은 날 몇 번째). 한 번 정하면 바꾸지 않는다. */
  function newTestId(dateYmd, existingIds) {
    const d = String(dateYmd || '').replace(/-/g, '');
    let n = 1;
    while ((existingIds || []).includes('pt-' + d + '-' + n)) n++;
    return 'pt-' + d + '-' + n;
  }
  const 유형 = ['mc', 'sa', 'partial'];
  /** 명세 검사 — { ok, problems[] } */
  function validateTestSpec(spec) {
    const p = [];
    if (!spec || !/^pt-\d{8}-\d+$/.test(String(spec.testId || ''))) p.push('testId 꼴(pt-YYYYMMDD-n)이 아닙니다');
    if (!spec || !String(spec.title || '').trim()) p.push('시험 이름이 없습니다');
    const items = (spec && Array.isArray(spec.items)) ? spec.items : [];
    if (!items.length) p.push('문항이 없습니다');
    const 본 = new Set();
    items.forEach((it, i) => {
      const 이름 = (it && it.no != null) ? it.no + '번' : (i + 1) + '째 줄';
      if (!it || !Number.isInteger(Number(it.no)) || Number(it.no) < 1) { p.push(이름 + ': 번호가 이상합니다'); return; }
      if (본.has(Number(it.no))) p.push(이름 + ': 번호가 두 번 있습니다'); 본.add(Number(it.no));
      if (!유형.includes(it.type)) p.push(이름 + ': 유형은 mc·sa·partial 중 하나');
      if (!(Number(it.points) > 0)) p.push(이름 + ': 배점은 0보다 커야 합니다');
      if ((it.type === 'mc' || it.type === 'sa') && !String(it.answer == null ? '' : it.answer).trim()) p.push(이름 + ': 정답이 없습니다');
    });
    return { ok: p.length === 0, problems: p };
  }
  /**
   * 채점 — entry = { status: 'taken'|'absent', answers: {번호: 답}, partial: {번호: 점수} }
   *   문항 상태: correct · wrong · partial · blank(빈칸 — 오답과 구분)
   *   ⛔ 미응시(absent)는 점수 null — 0점 응시로 합치지 않는다.
   */
  function gradePaper(spec, entry) {
    const max = spec.items.reduce((s, it) => s + Number(it.points), 0);
    if (!entry || entry.status === 'absent') return { status: 'absent', score: null, max, percent: null, items: {} };
    const items = {};
    let score = 0;
    for (const it of spec.items) {
      const no = Number(it.no), pts = Number(it.points);
      if (it.type === 'partial') {
        const raw = (entry.partial || {})[no];
        if (raw == null || String(raw).trim() === '') { items[no] = { state: 'blank', score: 0, max: pts }; continue; }
        const s = Math.max(0, Math.min(pts, Number(raw) || 0));
        items[no] = { state: s >= pts ? 'correct' : (s > 0 ? 'partial' : 'wrong'), score: s, max: pts };
        score += s;
      } else {
        const a = (entry.answers || {})[no];
        if (a == null || String(a).trim() === '') { items[no] = { state: 'blank', score: 0, max: pts }; continue; }
        const ok = normAns(a) === normAns(it.answer);
        items[no] = { state: ok ? 'correct' : 'wrong', score: ok ? pts : 0, max: pts, answer: String(a) };
        if (ok) score += pts;
      }
    }
    return { status: 'taken', score, max, percent: max ? Math.round(score / max * 100) : 0, items };
  }
  /** 수정 — 현재를 새 판으로 바꾸고 이력에 모두 남긴다 */
  function nextPaperRecord(prev, graded, meta) {
    const rev = ((prev && prev.current && Number(prev.current.rev)) || 0) + 1;
    const cur = Object.assign({}, graded, { rev, enteredAt: (meta && meta.at) || null, by: (meta && meta.by) || null });
    const history = Object.assign({}, (prev && prev.history) || {}, { [String(rev)]: cur });
    return { current: cur, history };
  }
  /** 집계 — 미응시는 평균에 안 넣는다 */
  function paperSummary(records) {
    const cur = (records || []).map(r => r && r.current).filter(Boolean);
    const taken = cur.filter(c => c.status === 'taken' && c.percent != null);
    return { taken: taken.length, absent: cur.filter(c => c.status === 'absent').length,
      average: taken.length ? Math.round(taken.reduce((s, c) => s + c.percent, 0) / taken.length) : null };
  }
  /** 약점 반영할 일 — 학생 화면 약점 줄과 같은 꼴 · 기여분 열쇠 paper_<testId> · 판이 오르면 옛 기여분을 대체 */
  function paperWeaknessJob(spec, graded, sid, rev) {
    const items = [];
    if (graded && graded.status === 'taken') {
      for (const it of spec.items) {
        if (!it.taxonomyId) continue;
        const r = graded.items[Number(it.no)];
        items.push({ t: String(it.taxonomyId), c: !!(r && r.state === 'correct') });
      }
    }
    return { sid, subKey: 'paper_' + spec.testId, rev, items };
  }


  // ───────────────────────── 커리 · 학교 자료 (3-C) ─────────────────────────
  const YMD = /^\d{4}-\d{2}-\d{2}$/;
  /** 장기 커리 수업 날짜 — 수업 요일 · 휴강 뺌 · 시험 전 완충 주 뺌 */
  function planLessonDates({ startDate, targetExamDate, holidays, bufferWeeks, days }) {
    const s = parseYmd(startDate), e = parseYmd(targetExamDate);
    if (!s || !e || s > e || !(days || []).length) return [];
    const 끝 = addDays(e, -7 * (Number(bufferWeeks) || 0));
    const 휴 = new Set(holidays || []);
    const out = [];
    for (let d = s; d < 끝 && d < e; d = addDays(d, 1)) {
      if (days.includes(요일[d.getDay()]) && !휴.has(ymd(d))) out.push(ymd(d));
    }
    return out;
  }
  /** 커리 검사 — { ok, problems[], warnings[] } */
  function validateCurriculum(c) {
    const p = [], w = [];
    const L = (c && c.long) || {}, S = c && c.short, ls = (c && Array.isArray(c.lessons)) ? c.lessons : [];
    if (!YMD.test(L.startDate || '')) p.push('장기: 시작일이 없습니다');
    if (!YMD.test(L.targetExamDate || '')) p.push('장기: 목표 시험일이 없습니다');
    if (YMD.test(L.startDate || '') && YMD.test(L.targetExamDate || '') && L.startDate > L.targetExamDate) p.push('장기: 시작일이 시험일보다 늦습니다');
    const 휴 = new Set(L.holidays || []);
    if (!(Number(L.bufferWeeks) >= 0)) p.push('장기: 완충 주는 0 이상');
    if (S) {
      if (!String(S.confirmedRange || '').trim()) p.push('단기: 확정 범위가 없습니다');
      if (S.examDate && !YMD.test(S.examDate)) p.push('단기: 시험일 꼴이 틀립니다');
      if (S.remainingClasses != null && Number(S.remainingClasses) !== ls.length) w.push('단기: 남은 수업 ' + S.remainingClasses + '번인데 수업 줄은 ' + ls.length + '개');
    }
    const 본 = new Set();
    ls.forEach((x, i) => {
      const 이름 = (x && x.date) || ((i + 1) + '째 수업');
      if (!x || !YMD.test(x.date || '')) { p.push(이름 + ': 날짜가 없습니다'); return; }
      if (본.has(x.date)) p.push(이름 + ': 같은 날 수업이 두 번'); 본.add(x.date);
      if (휴.has(x.date)) p.push(이름 + ': 휴강날입니다');
      if (L.startDate && x.date < L.startDate) p.push(이름 + ': 시작일 전입니다');
      if (L.targetExamDate && x.date > L.targetExamDate) p.push(이름 + ': 목표 시험일 뒤입니다');
      if (!String(x.mr || '').trim() || !String(x.ts || '').trim()) p.push(이름 + ': MR·TS 단원을 적어 주세요');
      if (!(Number(x.reviewRatio) >= 0 && Number(x.reviewRatio) <= 100)) p.push(이름 + ': 복습 비중은 0~100');
      if (!(Number.isInteger(Number(x.targetLevel)) && Number(x.targetLevel) >= 1 && Number(x.targetLevel) <= 5)) p.push(이름 + ': 목표 수준은 1~5');
    });
    return { ok: p.length === 0, problems: p, warnings: w };
  }
  /** 두 판의 차이 — 칸(장기·단기)과 수업(날짜별 더함·뺌·바뀜) */
  function diffCurriculum(a, b) {
    const out = [];
    const 같나 = (x, y) => JSON.stringify(x == null ? null : x) === JSON.stringify(y == null ? null : y);
    for (const part of ['long', 'short']) {
      const A = (a && a[part]) || {}, B = (b && b[part]) || {};
      for (const k of Array.from(new Set(Object.keys(A).concat(Object.keys(B)))).sort()) {
        if (!같나(A[k], B[k])) out.push({ kind: 'field', what: part + '.' + k, from: A[k] == null ? null : A[k], to: B[k] == null ? null : B[k] });
      }
    }
    const 줄 = (c) => { const m = {}; ((c && c.lessons) || []).forEach(x => { if (x && x.date) m[x.date] = x; }); return m; };
    const A = 줄(a), B = 줄(b);
    for (const d of Array.from(new Set(Object.keys(A).concat(Object.keys(B)))).sort()) {
      if (!A[d]) { out.push({ kind: 'added', date: d, to: B[d] }); continue; }
      if (!B[d]) { out.push({ kind: 'removed', date: d, from: A[d] }); continue; }
      for (const f of ['mr', 'ts', 'reviewRatio', 'targetLevel']) {
        if (!같나(A[d][f], B[d][f])) out.push({ kind: 'changed', date: d, field: f, from: A[d][f], to: B[d][f] });
      }
    }
    return out;
  }
  const revNum = (r) => { const m = /^r(\d+)$/.exec(String(r || '')); return m ? +m[1] : 0; };
  /** 다음 판 번호 — 판은 덮지 않는다(규칙도 새 판만 쓰게 한다) */
  function nextCurriculumRev(revs) {
    const n = Object.keys(revs || {}).reduce((m, k) => Math.max(m, revNum(k)), 0);
    return 'r' + (n + 1);
  }
  /**
   * 학교 자료 단계 — uploaded → drafted(범위·날짜 초안) → confirmed(원장 확인) → applied(개정 승인)
   *   언제든 rejected. ⛔ 업로드·초안·확인만으로는 커리를 안 바꾼다(apply 때 새 판이 생긴다).
   *   돌려주는 값 = { ok, source(새 꼴), why }
   */
  function sourceStep(source, action, data) {
    const s = Object.assign({}, source || {});
    const 지금 = s.status || 'uploaded';
    const 안됨 = (why) => ({ ok: false, source: source, why });
    if (action === 'draft') {
      if (!['uploaded', 'drafted'].includes(지금)) return 안됨('이미 확인·적용·거절된 자료입니다');
      if (!data || !String(data.range || '').trim()) return 안됨('범위를 적어 주세요');
      s.status = 'drafted'; s.draft = { range: String(data.range).trim(), examDate: data.examDate || null, note: data.note || '' };
      return { ok: true, source: s };
    }
    if (action === 'confirm') {
      if (지금 !== 'drafted') return 안됨('초안이 먼저 있어야 확인할 수 있습니다');
      s.status = 'confirmed'; return { ok: true, source: s };
    }
    if (action === 'apply') {
      if (지금 !== 'confirmed') return 안됨('원장 확인이 먼저입니다');
      if (!data || !data.rev) return 안됨('새 커리 판 번호가 없습니다');
      s.status = 'applied'; s.appliedRev = data.rev; return { ok: true, source: s };
    }
    if (action === 'reject') {
      if (['applied', 'rejected'].includes(지금)) return 안됨('이미 끝난 자료입니다');
      s.status = 'rejected'; s.rejectWhy = (data && data.why) || ''; return { ok: true, source: s };
    }
    return 안됨('모르는 단계: ' + action);
  }
  /** 검토가 안 끝난 자료가 있으면 「커리 먼저 검토」 — 그동안 관련 제작은 보류 */
  function needsCurriculumReview(sources) {
    return Object.values(sources || {}).some(s => s && ['uploaded', 'drafted', 'confirmed'].includes(s.status || 'uploaded'));
  }
  /** 개정 뒤 무효로 볼 초안 — 그 학생의 **미공개** 초안 중 옛 판 기준인 것만 */
  /* ── 5단계 방향 바꿈(10-01): 학교 사진은 원장이 휴대폰 드라이브 앱으로 올리고, PC 일꾼이 찾아 inbox 에 적는다 ── */
  function hasNewSchoolFiles(inbox) { return Object.values(inbox || {}).some(x => x && x.status === 'new'); }
  /** inbox 의 새 파일 → 학교 자료(sources) 한 줄씩. 이미 있는 자료는 건너뛴다. 원장 화면이 쓴다(sources 는 원장만 쓰는 칸) */
  function inboxImports(inbox, sources) {
    const out = [];
    for (const [id, x] of Object.entries(inbox || {})) {
      if (!x || x.status !== 'new') continue;
      const sourceId = 'drive_' + String(id).replace(/[^A-Za-z0-9_-]/g, '_');
      if ((sources || {})[sourceId]) continue;
      out.push({ inboxId: id, sourceId, source: { name: x.name || '', driveRel: x.rel || '', size: x.size || 0, via: 'drive', status: 'uploaded', uploadedAt: x.foundAt || '' } });
    }
    return out;
  }
  /** 드라이브에서 파일 이름으로 찾는 주소(원장 구글 계정으로 연다 · 공개 링크 아님) */
  function driveSearchUrl(name) { return name ? 'https://drive.google.com/drive/search?q=' + encodeURIComponent('"' + name + '"') : ''; }

  function staleDrafts(drafts, sid, currentRev) {
    const cur = revNum(currentRev);
    return Object.keys(drafts || {}).filter(k => {
      const d = drafts[k];
      return d && d.studentId === sid && d.published !== true && revNum(d.basedOnCurriculumRev) < cur;
    }).sort();
  }

  // ───────────────────────── 6단계 · 부분 수정의 영향 영역 ─────────────────────────
  /**
   * 무엇을 고치면 무엇이 다시 만들어지는가 — 원장이 「수정 요청」을 누르기 전에 본다.
   *   manifest: 초안의 문항 목록 [{slot, section(test|book|hw), src}] · edits: [{slot, action}] · layout: 조판만 바꿀 값
   *   opts.approved: 이미 승인한 교재인가(승인·홈페이지 초안이 무효가 된다)
   * → { files:[test|book|hw|student|teacher|items|qa], contentKept, voids:[], notes:[] }
   * 서버(prep_release.js affectsOf)와 같은 셈 — 주문에도 적힌다.
   */
  function affectedAreas(manifest, edits, layout, opts) {
    const 칸 = {}; (manifest || []).forEach(m => { if (m && m.slot) 칸[m.slot] = m; });
    const files = new Set(), notes = [], voids = [];
    for (const e of edits || []) {
      const m = 칸[e.slot] || {};
      files.add({ test: 'test', book: 'book', hw: 'hw' }[m.section] || 'book');
      ['student', 'teacher', 'items', 'qa'].forEach(f => files.add(f));
    }
    const contentKept = !(edits || []).length;
    if (layout && Object.keys(layout).length) { ['test', 'book', 'hw', 'student', 'teacher'].forEach(f => files.add(f)); notes.push('조판만 — 문항 내용·정답은 그대로'); }
    if (!contentKept) notes.push('문항·정답이 바뀌면 답지·원본 JSON·검수 기록을 함께 다시 만듭니다');
    if (opts && opts.approved && files.size) voids.push('교재 승인', '홈페이지 숙제 초안');
    return { files: Array.from(files).sort(), contentKept, voids, notes };
  }

  // ───────────────────────── 툴체인 단원 찾기 (10-02) ─────────────────────────
  //   주간 설정의 MR 단원 이름 → 쌓인 단원 프로그램(툴체인 색인) 가운데 같은 기술을 다루는 것.
  //   이름이 영어·한국어로 섞여 있어 낱말 대신 「기술 열쇠」로 맞댄다. 학년이 달라도 보여 주되 학년을 붙인다
  //   (Y3 곱셈 ≠ Y9 문자식 곱셈 — 판정은 원장이 한다).
  const 기술말 = [
    ['vol', /volume|capacity|부피|들이/i], ['surf', /surface\s*area|겉넓이/i], ['area', /(?<!surface\s)\barea\b|(?<!겉)넓이/i],
    ['perim', /perimeter|circumference|둘레|원주/i], ['frac', /fraction|분수|가분수|대분수/i], ['dec', /decimal|소수(?!인수)/i],
    ['pct', /percent|백분율/i], ['ratio', /ratio|\brate\b|비율|비례/i], ['prob', /probabilit|chance|확률/i],
    ['comb', /combination|경우의\s*수/i], ['angle', /angle|각도|\b각\b/i], ['tri', /triangle|삼각형/i],
    ['quad', /quadrilateral|사각형/i], ['eqn', /equation|방정식/i], ['alg', /algebra|대수|문자식/i],
    ['idx', /\bind(ex|ices)\b|지수/i], ['data', /\bdata\b|graph|자료|그래프|표와/i], ['stat', /statistic|mean|median|mode|평균|대푯값/i],
    ['coord', /coordinate|number plane|좌표/i], ['sym', /symmetr|대칭/i], ['mass', /\bmass\b|weight|무게|질량/i],
    ['len', /length|길이/i], ['mult', /multiplication|곱셈/i], ['div', /division|나눗셈/i], ['prism', /prism|cylinder|각기둥|원기둥/i],
    ['cong', /congruen|합동/i], ['pyth', /pythag|피타고라스/i], ['trig', /trigonometr|삼각비/i],
    ['factor', /factor|prime|약수|배수|소인수/i], ['pattern', /pattern|sequence|수열|규칙/i], ['solid', /\b3d\b|solid|\bnets?\b|입체|전개도/i],
    ['time', /\btime\b|시각|시간/i], ['money', /money|\$|돈/i], ['estim', /estimat|round|어림|반올림/i], ['spatial', /spatial|공간/i],
    ['logic', /logic|논리/i], ['analogy', /analog|유추/i], ['oddone', /odd one out|다른 하나/i], ['matrix', /matrix|행렬/i],
  ];
  function 기술열쇠(글) { const s = String(글 || ''); return 기술말.filter(([, r]) => r.test(s)).map(([k]) => k); }
  const 트랙학년 = { y3yujun: 'Y3', y4hk: 'Y4', y4sean: 'Y4', y5kiara: 'Y5', y5sel: 'Y5', y7geo: 'Y7', y8irene: 'Y8', y9ncm: 'Y9' };
  /**
   * index = { rev, units:[{트랙, 파일, 제목, 처음, 줄}] } · title = MR 단원 이름
   * → [{ 트랙, 학년, 파일, 제목, 겹침:[열쇠], 점수 }] (점수 높은 순 · 같은 트랙·파일은 마지막 판 하나)
   */
  function toolchainMatches(index, title, n) {
    const 내 = 기술열쇠(title);
    if (!내.length || !index || !Array.isArray(index.units)) return [];
    const 하나 = {};
    for (const u of index.units) {
      const k = u.트랙 + '|' + String(u.파일).replace(/^banks\//, '');
      if (!하나[k] || u.처음 === '지금' || String(u.처음) > String(하나[k].처음 === '지금' ? '~' : 하나[k].처음)) 하나[k] = u;
    }
    const 줄 = [];
    for (const u of Object.values(하나)) {
      const 그 = 기술열쇠(u.제목);
      const 겹침 = 내.filter(k => 그.includes(k));
      if (!겹침.length) continue;
      줄.push({ 트랙: u.트랙, 학년: 트랙학년[u.트랙] || '', 파일: u.파일, 제목: u.제목, 겹침, 점수: 겹침.length / 내.length });
    }
    return 줄.sort((a, b) => b.점수 - a.점수 || String(a.학년).localeCompare(String(b.학년))).slice(0, n || 6);
  }

  const PrepCore = {
    toolchainMatches, 기술열쇠,
    affectedAreas,
    요일말, ymd, parseYmd, addDays, periodOfDate, periodKey, samePeriod,
    classDaysOf, nextClassDate, pastClassDates, analysisWindow, periodsInWindow, orderStudents,
    hwKey, subKey, tsSubKey, viewForTeacher, analyzeHomework,
    taxSafeKey, taxFromSafeKey, weakTop,
    normAns, weaknessMerge, newTestId, validateTestSpec, gradePaper, nextPaperRecord, paperSummary, paperWeaknessJob,
    planLessonDates, validateCurriculum, diffCurriculum, nextCurriculumRev, sourceStep, needsCurriculumReview, staleDrafts,
    hasNewSchoolFiles, inboxImports, driveSearchUrl,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = PrepCore;
  else root.PrepCore = PrepCore;
})(typeof window !== 'undefined' ? window : this);
