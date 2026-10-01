// 정답 맞추기 규칙 — 학생 화면(index.html) normAns 를 **그대로** 옮긴 것(2-B · 2026-10-01).
// 서버가 개인 배정을 채점할 때 쓴다. ⛔ 두 곳이 어긋나면 화면과 서버 점수가 달라진다 —
// functions/화면시험/채점규칙_같은가.test.js 가 같은지 지킨다(화면 쪽을 고치면 여기도).
'use strict';
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

module.exports = { normAns };
