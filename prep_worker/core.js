/* =============================================================================
 * prep_worker/core.js — 5단계 PC 제작 일꾼의 셈 (2026-10-01)
 *
 * DB·파일·Claude 를 만지지 않는다. 받은 값으로 셈만 한다(시험: 시험/core.test.js).
 *   · 명세 → 만들 칸(slot) 목록       · 표본(짧게) 줄이기
 *   · 생성 결과 검사(꼴·수·단원·난이도·정답/보기·계산기·그림)
 *   · 재풀이 대조 · 수식 셈(분수 정확히)
 *   · 잠금(lease) 판정 · 토큰 상한 · 초안 id · manifest
 * ============================================================================= */
'use strict';
const crypto = require('crypto');

const KNOWN_TYPES = ['prep-paper', 'prep-online'];
const LEASE_MS = 10 * 60 * 1000;           // 잠금 10분 — 생존 표시로 늘린다
const LEVELS = ['basic', 'standard', 'challenge'];

/* ── 정규 직렬화 · 해시 ── */
// DB(RTDB)는 null·빈 배열·빈 객체를 저장하지 않는다 ⇒ 해시도 그것들을 빼고 센다(서버 prep_session.js canonJ 와 같은 셈)
const 빈 = (x) => x === null || x === undefined || (Array.isArray(x) && x.length === 0) || (x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).every(k => 빈(x[k])));
function canon(v) {
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().filter(k => !빈(v[k])).map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const specHash = (spec) => sha256(canon(spec)).slice(0, 16);

/** 초안 id — 계획+판+산출물+명세해시. 같은 주문을 두 번 돌려도 같은 id(규칙이 「새로 만들기만」이라 두 번째는 막힌다) */
function draftIdFor(job, output, hash) {
  return String(job.planId) + '_r' + job.rev + '_' + output + '_' + String(hash).slice(0, 8);
}

/* ── 큰 나머지 방식 배분: 비율(합 100) → 정수 n 개 ── */
function apportion(n, pcts, keys) {
  const raw = keys.map(k => n * (pcts[k] || 0) / 100);
  const out = raw.map(Math.floor);
  let left = n - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let j = 0; left > 0; j = (j + 1) % order.length, left--) out[order[j][1]]++;
  const o = {}; keys.forEach((k, i) => { o[k] = out[i]; }); return o;
}
/** n 칸에 값 나눠 깔기(차례: 기본 → 표준 → 도전) */
function spread(n, counts, keys) {
  const arr = []; for (const k of keys) for (let i = 0; i < (counts[k] || 0); i++) arr.push(k);
  return arr.slice(0, n);
}

/**
 * 명세 → 만들 칸 목록.
 *   MR 칸: { id, src:'mr', section, part, set?, unit, type, difficulty, calculator, worked }
 *   TS 칸: { id, src:'ts', section, part, set?, title }
 * section = test(앞장) · book(교재) · hw(종이 숙제)
 * ctx = { prevUnit } — 앞장 테스트는 지난 범위(없으면 이번 단원)
 */
function slotsFromSpec(spec, ctx) {
  const c = ctx || {}, slots = [];
  const comp = spec.composition || { mcPct: 100, saPct: 0, writtenPct: 0 };
  const mix = (spec.difficulty && spec.difficulty.mix) || { basic: 30, standard: 50, challenge: 20 };
  const unit0 = (spec.parts.find(p => p.kind === 'mr-unit') || {}).title || '';
  let k = 0; const nid = (p) => p + String(++k).padStart(3, '0');
  function mrBlock(n, base) {
    if (n <= 0) return;
    const dif = spread(n, apportion(n, mix, LEVELS), LEVELS);
    const typ = spread(n, apportion(n, { mc: comp.mcPct, sa: comp.saPct, written: comp.writtenPct }, ['mc', 'sa', 'written']), ['mc', 'sa', 'written']);
    for (let i = 0; i < n; i++) slots.push(Object.assign({ id: nid('m'), src: 'mr', type: typ[i], difficulty: base.difficulty || dif[i], calculator: false, worked: false }, base, { difficulty: base.difficulty || dif[i] }));
  }
  const ft = spec.parts.find(p => p.kind === 'front-test');
  if (ft) {
    const nTs = ft.includeTS ? (ft.includeMR ? Math.round(ft.questions * 0.3) : ft.questions) : 0;
    const nMr = ft.includeMR ? ft.questions - nTs : 0;
    mrBlock(nMr, { section: 'test', part: 'front-test', unit: c.prevUnit || unit0 });
    for (let i = 0; i < nTs; i++) slots.push({ id: nid('t'), src: 'ts', section: 'test', part: 'front-test', title: c.prevTs || '' });
  }
  for (const p of spec.parts) {
    if (p.kind === 'mr-unit') {
      const d = { basic: 'basic', standard: 'standard', challenge: 'challenge' }[p.difficulty] || null;
      for (let i = 0; i < p.examples; i++) slots.push({ id: nid('m'), src: 'mr', section: 'book', part: 'mr-unit-example', unit: p.title, type: 'sa', difficulty: d || 'standard', calculator: false, worked: true });
      mrBlock(p.practice, { section: 'book', part: 'mr-unit-practice', unit: p.title, difficulty: d });
    } else if (p.kind === 'mr-review') {
      for (let s = 0; s < p.sets; s++) mrBlock(p.questions, { section: 'book', part: 'mr-review', set: s, unit: '종합' });
    } else if (p.kind === 'ts-unit' || p.kind === 'ts-combined') {
      for (let i = 0; i < p.examples + p.practice; i++) slots.push({ id: nid('t'), src: 'ts', section: 'book', part: p.kind, title: p.title, worked: i < p.examples });
    } else if (p.kind === 'paper-hw') {
      p.sets.forEach((x, s) => {
        mrBlock(x.mr, { section: 'hw', part: 'paper-hw', set: s, unit: unit0 });
        for (let i = 0; i < x.ts; i++) slots.push({ id: nid('t'), src: 'ts', section: 'hw', part: 'paper-hw', set: s, title: '' });
      });
    }
  }
  // 계산기 — 종이 숙제 MR 중 앞에서부터 명세의 개수만큼(도전 → 표준 순으로 고른다)
  const calc = (spec.calculator && spec.calculator.count) || 0;
  const hwMr = slots.filter(s => s.src === 'mr' && s.section === 'hw');
  const order = hwMr.slice().sort((a, b) => LEVELS.indexOf(b.difficulty) - LEVELS.indexOf(a.difficulty));
  order.slice(0, calc).forEach(s => { s.calculator = true; });
  if (spec.composition && spec.composition.figures === 'exclude') slots.forEach(s => { s.noFigure = true; });
  return slots;
}

/** 표본 — 시험할 때 한도를 아끼려고 MR·TS 각각 n 개만 남긴다(구역 하나씩은 살린다) */
function sampleSlots(slots, n) {
  const keep = []; const seen = {};
  for (const src of ['mr', 'ts']) {
    let left = n;
    for (const s of slots) if (s.src === src && left > 0 && !seen[s.section + src]) { keep.push(s); seen[s.section + src] = 1; left--; }
    for (const s of slots) if (s.src === src && left > 0 && keep.indexOf(s) < 0) { keep.push(s); left--; }
  }
  return slots.filter(s => keep.indexOf(s) >= 0);
}

/* ── 값 셈: 정수·소수·분수·대분수·$\frac{a}{b}$·백분율 → 정확한 분수 ── */
function gcd(a, b) { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) { [a, b] = [b, a % b]; } return a; }
function R(n, d) { if (d === undefined) d = 1n; if (d === 0n) throw new Error('0 으로 나눔'); if (d < 0n) { n = -n; d = -d; } const g = gcd(n, d) || 1n; return { n: n / g, d: d / g }; }
const radd = (a, b) => R(a.n * b.d + b.n * a.d, a.d * b.d);
const rsub = (a, b) => R(a.n * b.d - b.n * a.d, a.d * b.d);
const rmul = (a, b) => R(a.n * b.n, a.d * b.d);
const rdiv = (a, b) => R(a.n * b.d, a.d * b.n);
function decToR(s) { const m = /^(-?)(\d*)(?:\.(\d+))?$/.exec(s); if (!m || (m[2] === '' && !m[3])) return null; const f = m[3] || ''; const r = R(BigInt((m[2] || '0') + f), 10n ** BigInt(f.length)); return m[1] ? R(-r.n, r.d) : r; }
/** 답 글자 → 분수(못 읽으면 null). 단위 낱말은 떼고 본다 */
function valueOf(s) {
  let t = String(s == null ? '' : s).trim()
    .replace(/\$/g, '').replace(/\\[dt]?frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)')
    .replace(/\\times/g, '*').replace(/\\div/g, '/').replace(/\\,|\\ |~/g, ' ').replace(/,(?=\d{3}\b)/g, '')
    .replace(/[−–]/g, '-').replace(/×/g, '*').replace(/÷/g, '/');
  t = t.replace(/\s*(cm|mm|m|km|kg|g|mL|ml|L|min|minutes|hours|h|s|units|square units|cubic units|degrees|°|\$|dollars|cents)(\^?\d)?\s*$/i, '').trim();
  let pct = false; if (/%$/.test(t)) { pct = true; t = t.slice(0, -1).trim(); }
  const mixed = /^(-?\d+)\s+\(?(\d+)\)?\s*\/\s*\(?(\d+)\)?$/.exec(t);
  let v = null;
  if (mixed) { const w = BigInt(mixed[1]); const fr = R(BigInt(mixed[2]), BigInt(mixed[3])); v = w < 0n ? rsub(R(w), fr) : radd(R(w), fr); }
  else { try { v = evalExact(t); } catch (e) { v = null; } }
  if (v && pct) v = rdiv(v, R(100n));
  return v;
}
/** 수식 셈 — + - * / ( ) 와 수만. 그 밖의 글자는 거절(eval 안 씀) */
function evalExact(expr) {
  const src = String(expr).replace(/\s+/g, '');
  if (!src || /[^0-9.+\-*/()]/.test(src)) throw new Error('셈할 수 없는 글자');
  let i = 0;
  const peek = () => src[i];
  function num() { const m = /^\d*\.?\d+/.exec(src.slice(i)); if (!m) throw new Error('수 자리'); i += m[0].length; return decToR(m[0]); }
  function fac() { if (peek() === '-') { i++; const v = fac(); return R(-v.n, v.d); } if (peek() === '(') { i++; const v = expr0(); if (src[i++] !== ')') throw new Error('괄호'); return v; } return num(); }
  function term() { let v = fac(); while (peek() === '*' || peek() === '/') { const op = src[i++]; const w = fac(); v = op === '*' ? rmul(v, w) : rdiv(v, w); } return v; }
  function expr0() { let v = term(); while (peek() === '+' || peek() === '-') { const op = src[i++]; const w = term(); v = op === '+' ? radd(v, w) : rsub(v, w); } return v; }
  const v = expr0(); if (i !== src.length) throw new Error('남은 글자'); return v;
}
const req = (a, b) => !!a && !!b && a.n === b.n && a.d === b.d;
const normText = (s) => String(s == null ? '' : s).toLowerCase().replace(/\$|\\,|\s+/g, '').replace(/[.。]$/, '');
/** 두 답이 같은가 — 값으로 읽히면 값으로, 아니면 글자로 */
function sameAnswer(a, b) { const va = valueOf(a), vb = valueOf(b); if (va && vb) return req(va, vb); return normText(a) === normText(b) && normText(a) !== ''; }
/** 객관식에서 재풀이가 낸 것이 글자(A~E)면 보기로 바꾼다 */
function resolveChoice(ans, choices) { const m = /^\s*\(?([A-E])\)?\s*$/.exec(String(ans || '')); if (m && Array.isArray(choices)) return choices['ABCDE'.indexOf(m[1])]; return ans; }

/* ── 생성 결과 검사 ── */
/** items: Claude 가 낸 MR 문항 · slots: 부탁한 칸. 칸마다 문제 목록을 돌려준다 */
function checkMrItems(items, slots) {
  const bad = {}, byId = {};
  const add = (id, m) => { (bad[id] = bad[id] || []).push(m); };
  for (const it of (Array.isArray(items) ? items : [])) if (it && it.slot) byId[it.slot] = it;
  for (const s of slots) {
    const it = byId[s.id];
    if (!it) { add(s.id, '문항 없음'); continue; }
    if (typeof it.stem !== 'string' || it.stem.trim().length < 5) add(s.id, '문제 글 없음');
    if (typeof it.answer !== 'string' || !it.answer.trim()) add(s.id, '정답 없음');
    if (it.difficulty !== s.difficulty) add(s.id, '난이도 다름(' + it.difficulty + ' ≠ ' + s.difficulty + ')');
    if (it.type !== s.type) add(s.id, '꼴 다름(' + it.type + ' ≠ ' + s.type + ')');
    if (s.unit && s.unit !== '종합' && it.unit !== s.unit) add(s.id, '단원 다름');
    if (!!it.calculator !== !!s.calculator) add(s.id, '계산기 표시 다름');
    if (it.figure) add(s.id, '그림 문항은 아직 못 받음');
    if (s.type === 'mc') {
      const ch = it.choices;
      if (!Array.isArray(ch) || ch.length !== 4) add(s.id, '보기는 4개');
      else {
        const keys = ch.map(normText);
        if (new Set(keys).size !== 4) add(s.id, '보기 겹침');
        const hit = ch.filter(c => sameAnswer(c, it.answer)).length;
        if (hit !== 1) add(s.id, '정답이 보기에 ' + hit + '번');
      }
    }
    if (it.check) {
      let v = null; try { v = evalExact(it.check); } catch (e) { add(s.id, '셈식을 못 읽음'); }
      if (v && !req(v, valueOf(it.answer))) add(s.id, '셈식 값 ≠ 정답');
    }
    if (/\\(input|include|write|immediate|openout|catcode|def)\b/.test(String(it.stem) + (it.choices || []).join('') + String(it.working || ''))) add(s.id, '위험한 조판 명령');
  }
  const extra = Object.keys(byId).filter(id => !slots.some(s => s.id === id));
  return { ok: Object.keys(bad).length === 0, bad, extra };
}
/** 재풀이 대조 — 같은 모델 두 번 일치는 「검증 일치」일 뿐 「정답 보장」이 아니다 */
function compareSolve(items, solved) {
  const sv = {}; for (const x of (Array.isArray(solved) ? solved : [])) if (x && x.slot) sv[x.slot] = x;
  const out = {};
  for (const it of items) {
    const s = sv[it.slot];
    const theirs = s ? resolveChoice(s.answer, it.choices) : null;
    const calcOk = it.check ? (() => { try { return req(evalExact(it.check), valueOf(it.answer)); } catch (e) { return false; } })() : null;
    const agree = !!s && sameAnswer(theirs, it.answer);
    out[it.slot] = { agree, theirs: theirs == null ? null : String(theirs), calc: calcOk === null ? 'none' : (calcOk ? 'ok' : 'bad'),
      status: agree && calcOk !== false ? 'verified-agree' : 'mismatch' };
  }
  return out;
}

/* ── 잠금(lease) — 일꾼 하나만 한 주문을 쥔다 ── */
/** 지금 이 주문을 쥘 수 있는가 → { take, why } */
function leaseDecision(job, me, now) {
  if (!job) return { take: false, why: '주문 없음' };
  if (KNOWN_TYPES.indexOf(job.type) < 0) return { take: false, why: 'unknown-type' };
  if (job.status === 'cancel-requested' || job.status === 'cancelled') return { take: false, why: '취소' };
  if (['done', 'failed', 'held'].indexOf(job.status) >= 0) return { take: false, why: '끝난 주문' };
  const l = job.lease;
  if (l && l.until > now && l.workerId !== me) return { take: false, why: '다른 일꾼이 쥠' };
  // 이어하기 = 내 잠금이 **아직 살아 있을 때**(PC 가 죽었다 바로 켜짐). 잠금을 풀고 나간 뒤 다시 집는 것은 새 시도다
  const resume = !!(l && l.workerId === me && l.until > now);
  const tried = (job.w && job.w.attempts) || job.attempts || 0;
  if (tried >= (job.maxAttempts || 3) && !resume) return { take: false, why: '재시도 다 씀' };
  return { take: true, resume, why: resume ? '내 것 — 이어서' : (l && l.until > 0 && l.until <= now && l.workerId !== me ? '잠금 만료 — 넘겨받음' : '새 시도') };
}

/* ── 토큰 ── */
function usageTokens(u) { if (!u) return 0; return (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0); }
/** 다음 호출 전에 — 지금까지 + 어림이 상한을 넘으면 멈춘다 */
function overCap(used, estimateNext, cap) { return cap > 0 && used + (estimateNext || 0) > cap; }

/* ── manifest — 문항 하나하나가 명세의 어느 칸인지 ── */
function itemIdFor(it) { return 'mrg-' + sha256(canon({ stem: it.stem, choices: it.choices || null, answer: it.answer })).slice(0, 12); }
function buildManifest(slots, mrById, tsById) {
  return slots.map((s, i) => {
    const base = { slot: s.id, section: s.section, part: s.part, set: s.set == null ? null : s.set, src: s.src, order: i };
    if (s.src === 'mr') { const it = mrById[s.id]; return Object.assign(base, { itemId: itemIdFor(it), itemRevision: 1, answer: it.answer, difficulty: it.difficulty, type: it.type, calculator: !!it.calculator, verify: it._verify || null }); }
    const t = tsById[s.id]; return Object.assign(base, { itemId: t.id, itemRevision: t.rev || null, answer: t.answerLetter, level: t.level, tsType: t.type });
  });
}

/* ── PDF 검사(뽑은 글자로) ── */
/** pages: [{ text, ink }] · expectTags: 이 PDF 에 있어야 할 문항 꼬리표 · forbid: 나오면 안 되는 글(정답 해설 등) */
function checkPdfText(pages, expectTags, forbid, opt) {
  const o = opt || {}, problems = [], all = pages.map(p => p.text).join('\n');
  if (!pages.length) problems.push('쪽이 없음');
  pages.forEach((p, i) => { if (p.ink < (o.minInk || 0.002) && !/This page is intentionally blank/i.test(p.text)) problems.push((i + 1) + '쪽이 비었음'); });
  const tags = (all.match(/\[[mt]\d{3}\]/g) || []).map(x => x.slice(1, -1));
  const missing = expectTags.filter(t => tags.indexOf(t) < 0);
  const extra = tags.filter(t => expectTags.indexOf(t) < 0);
  const dup = tags.filter((t, i) => tags.indexOf(t) !== i);
  if (missing.length) problems.push('빠진 문항 ' + missing.length + ': ' + missing.slice(0, 5).join(','));
  if (extra.length) problems.push('명세에 없는 문항 ' + extra.length);
  if (dup.length) problems.push('두 번 나온 문항 ' + dup.length);
  const flat = all.replace(/\s+/g, ' ');
  for (const f of (forbid || [])) if (f && f.length >= 12 && flat.indexOf(f) >= 0) { problems.push('정답 노출: ' + f.slice(0, 30)); break; }
  return { ok: problems.length === 0, problems, count: tags.length };
}

/* ── 구글 드라이브 보관 자리 ── */
const safeName = (s) => String(s || '').replace(/[\\/:*?"<>|]/g, '_').trim() || '이름없음';
function archivePlan(root, studentName, lessonDate, files) {
  const dir = root.replace(/[\\/]+$/, '') + '/' + safeName(studentName) + '/' + lessonDate;
  const 이름 = { test: '테스트지', book: '교재', hw: '숙제', student: '학생용_전체', teacher: '교사용_답지' };
  return files.map(f => ({ from: f.local, to: dir + '/' + lessonDate + '_' + (이름[f.kind] || f.kind) + '.pdf', sha256: f.sha256 }));
}

module.exports = { KNOWN_TYPES, LEASE_MS, canon, sha256, specHash, draftIdFor, apportion, slotsFromSpec, sampleSlots, valueOf, evalExact, sameAnswer,
  resolveChoice, checkMrItems, compareSolve, leaseDecision, usageTokens, overCap, itemIdFor, buildManifest, checkPdfText, archivePlan, safeName };
