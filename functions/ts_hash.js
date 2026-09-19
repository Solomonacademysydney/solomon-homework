// ts_hash.js — 초안·배정의 **정규 직렬화와 해시** (규격: `C:\TS작업\규격\계약.md` §4)
//
// ⛔⛔ 이 파일은 파이썬 `일꾼` 쪽과 **글자 하나까지 같은 값**을 내야 한다.
//     규칙이 한 글자라도 다르면 **멀쩡한 승인이 전부 막힌다.**
//     맞는지는 `C:\TS작업\규격\해시시험.json` 의 벡터 열 개로 잰다 —
//     고칠 때마다 `node functions/ts_hash.test.js` 를 돌릴 것.
//
// 규칙 (계약.md §4)
//   ① 정해진 칸만 담는다        ② 글자는 NFC        ③ 열쇠는 오름차순·배열은 차례 그대로
//   ④ 공백 없는 JSON · 유니코드 그대로   ⑤ 정수는 정수로 · 없는 값은 칸째로 뺀다
//   ⑥ UTF-8 로 sha256, 16진 소문자

'use strict';
const crypto = require('crypto');

/** 글자는 NFC 로 맞춘다. 파이썬 `unicodedata.normalize('NFC', …)` 과 같다. */
function nfc(x) {
  return (typeof x === 'string') ? x.normalize('NFC') : x;
}

/**
 * 열쇠를 **코드포인트 차례**로 견준다.
 * ⛔ 자바스크립트 기본 정렬은 UTF-16 조각 차례라, 이모지처럼 BMP 밖 글자가 열쇠에 오면
 *    파이썬 `sorted()`(코드포인트 차례)와 **어긋난다.** 한글·영문만 쓸 때는 같지만,
 *    같아 보이는 것에 기대지 않는다.
 */
function 코드포인트차례(a, b) {
  const A = Array.from(a), B = Array.from(b);
  const n = Math.min(A.length, B.length);
  for (let i = 0; i < n; i++) {
    const x = A[i].codePointAt(0), y = B[i].codePointAt(0);
    if (x !== y) return x < y ? -1 : 1;
  }
  return A.length - B.length;
}

/** 열쇠 정렬 · NFC · 없는 값은 칸째로 뺌 · 정수는 정수로. (파이썬 `canon()` 과 같다) */
function canon(v) {
  if (Array.isArray(v)) return v.map(canon);          // 배열은 차례 그대로 — 차례가 뜻이다
  if (v !== null && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort(코드포인트차례)) {
      if (v[k] === null || v[k] === undefined) continue;   // null 은 칸째로 뺀다
      out[nfc(k)] = canon(v[k]);
    }
    return out;
  }
  if (typeof v === 'boolean') return v;
  return nfc(v);
}

/**
 * 공백 없는 JSON. 열쇠는 `canon` 이 이미 정렬해 넣었고, `JSON.stringify` 는
 * 객체에 넣은 차례를 지킨다(글자 열쇠는 넣은 차례가 유지된다).
 * ⛔ 다만 **숫자로만 된 열쇠**는 자바스크립트가 앞으로 당겨 넣는다 — 그래서 열쇠를
 *    한 번 더 짚어 준다. 파이썬은 `"0"` 도 글자로 보고 정렬한다.
 */
function dumps(v) {
  return JSON.stringify(canon(v), function (k, val) {
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      const out = {};
      for (const kk of Object.keys(val).sort(코드포인트차례)) out[kk] = val[kk];
      return out;
    }
    return val;
  });
}

/** 글자면 그 글자를, 아니면 정규 직렬화한 것을 sha256. */
function sha(v) {
  const s = (typeof v === 'string') ? nfc(v) : dumps(v);
  return crypto.createHash('sha256').update(Buffer.from(s, 'utf8')).digest('hex');
}

/** 문항 한 줄을 해시에 드는 모양으로 줄인다(계약.md §4 「해시에 드는 것」). */
function q_entry(i, item_id, answer, options, label_to_id, text, aux, figure) {
  return {
    i: i,
    item_id: item_id,
    answer: answer,
    options: options,
    label_to_id: label_to_id,
    text_sha: sha(text || ''),
    aux_sha: sha(aux || ''),
    fig_sha: sha(figure || ''),
  };
}

/**
 * 서버가 들고 있는 `ts` 묶음에서 **해시에 드는 것만** 뽑는다.
 * ⛔ 초안이 준 해시를 그냥 믿으면 안 된다 — **본문에서 다시 셈해** 맞춰 봐야
 *    본문만 바꿔치기한 것을 잡는다.
 */
function 묶음만들기(meta, ts) {
  const qs = (ts && ts.questions) || [];
  const dc = (ts && ts.day_config) || {};
  return {
    subject: meta.subject,
    student: meta.student,
    배정주차: meta.배정주차,
    칸: meta.칸,
    revision: meta.revision,
    release: meta.release,
    day_config: { total_days: dc.total_days, questions_per_day: dc.questions_per_day },
    questions: qs.map((q, i) => q_entry(
      i, q._item_id, q.answer, q.options, q._label_to_id,
      q.text, [q.explanation || '', q.hint1 || '', q.hint2 || ''].join('\n'), q.figure)),
  };
}

module.exports = { nfc, canon, dumps, sha, q_entry, 묶음만들기, 코드포인트차례 };
