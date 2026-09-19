// ts_hash.test.js — 자바스크립트 해시가 **파이썬과 같은 값**을 내는지 잰다.
//
//   node functions/ts_hash.test.js
//
// ⛔ 벡터는 파이썬이 만든 것이다(`C:\TS작업\규격\해시시험_만들기.py`).
//    여기서 다시 셈해 `canonical` 글자와 `sha256` 이 **열 개 다** 같아야 한다.
//    하나라도 어긋나면 승인 함수를 쓰면 안 된다 — 멀쩡한 승인이 다 막힌다.

'use strict';
const fs = require('fs');
const H = require('./ts_hash');

const 벡터칸 = 'C:/TS작업/규격/해시시험.json';
const d = JSON.parse(fs.readFileSync(벡터칸, 'utf8'));
const 벡터 = d['벡터'] || [];

let 통과 = 0, 실패 = 0;
console.log('해시 시험 — 벡터 ' + 벡터.length + '개 (' + (d['규칙'] || '') + ')\n');

for (const v of 벡터) {
  const 이름 = v.name || '(이름 없음)';
  const 얻은글자 = H.dumps(v.input);
  const 얻은해시 = H.sha(v.input);
  const 글자맞나 = 얻은글자 === v.canonical;
  const 해시맞나 = 얻은해시 === v.sha256;

  if (글자맞나 && 해시맞나) { 통과++; console.log('  ✅ ' + 이름 + '  ' + 얻은해시.slice(0, 16) + '…'); continue; }
  실패++;
  console.log('  ⛔ ' + 이름 + (v.note ? '  (' + v.note + ')' : ''));
  if (!글자맞나) {
    console.log('     정규 직렬화가 다르다');
    // 어디서 갈렸는지 **첫 글자 자리**를 짚어 준다 — 눈으로 찾으면 못 찾는다
    const a = 얻은글자, b = v.canonical;
    let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
    console.log('     %d번째 글자부터 갈린다', i);
    console.log('       내 것 : …' + a.slice(Math.max(0, i - 30), i + 40));
    console.log('       벡터  : …' + b.slice(Math.max(0, i - 30), i + 40));
  }
  if (!해시맞나) console.log('     해시  내 것 ' + 얻은해시 + '\n           벡터  ' + v.sha256);
}

console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
process.exit(실패 ? 1 : 0);
