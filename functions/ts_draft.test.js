// ts_draft.test.js — **실제 초안**에 대어 본다. 시험 벡터가 아니라 진짜 자료다.
//
//   node functions/ts_draft.test.js
//
// 왜 따로 재나
//   벡터 열 개가 맞는 것과, **한 주치 48문항(인라인 SVG·한국어·섞은 보기)**이 맞는 것은
//   다른 일이다. 벡터는 내가 고른 것이고 초안은 뽑개가 만든 것이다.
//   여기서 갈리면 원장님이 승인 단추를 눌러도 **전부 「초안이 바뀌었습니다」로 막힌다.**

'use strict';
const fs = require('fs');
const path = require('path');
const H = require('./ts_hash');
const { _속 } = require('./ts_approval');

const 초안칸 = 'C:/TS작업/pool/build';

function 초안찾기() {
  const out = [];
  for (const 주 of fs.readdirSync(초안칸)) {
    const d = path.join(초안칸, 주);
    if (!fs.statSync(d).isDirectory()) continue;
    for (const f of fs.readdirSync(d)) {
      if (f.endsWith('_초안.json')) out.push(path.join(d, f));
    }
  }
  return out;
}

const 파일들 = 초안찾기();
if (!파일들.length) {
  console.log('⛔ 초안이 없습니다. 먼저 PC 에서 돌리십시오:');
  console.log('   py -3.12 일꾼\\초안_만들기.py --student Hayley04 --배정주차 2026_m09_w4');
  process.exit(1);
}

let 통과 = 0, 실패 = 0;
function 재기(이름, 참인가, 덧말) {
  if (참인가) { 통과++; console.log('  ✅ ' + 이름); }
  else { 실패++; console.log('  ⛔ ' + 이름 + (덧말 ? '\n       ' + 덧말 : '')); }
}

console.log('실제 초안 ' + 파일들.length + '벌에 대어 본다\n');

for (const p of 파일들) {
  const d = JSON.parse(fs.readFileSync(p, 'utf8'));
  const meta = {
    subject: d.subject, student: d.student, 배정주차: d['배정주차'], 칸: d['칸'],
    revision: d.revision, release: d.release
  };
  const qs = (d.ts || {}).questions || [];
  const 그림 = qs.filter(q => (q.figure || '').trim()).length;
  console.log('── ' + d.student + ' · ' + d['배정주차'] + ' · 문항 ' + qs.length + ' · 그림 ' + 그림);

  // ① 파이썬이 적은 해시와 자바스크립트가 셈한 해시가 같은가 — 여기가 관문이다
  const js해시 = H.sha(H.묶음만들기(meta, d.ts));
  재기('파이썬 해시 = 자바스크립트 해시',
       js해시 === d.sha, '파이썬 ' + d.sha + '\n       자바스크립트 ' + js해시);

  // ② 승인 함수의 초안 검사를 통과하는가 — 진짜 자료로
  const 탈 = _속.초안검사(d);
  재기('초안 검사 통과', 탈.length === 0, JSON.stringify(탈));

  // ③ 칸 이름이 초안에 적힌 것과 같은가
  const 풀 = _속.칸풀기(d['칸']);
  재기('칸 이름을 되풀 수 있다', !!풀, d['칸']);
  if (풀) {
    const 주 = _속.주차풀기(d['배정주차']);
    재기('칸의 주차 = 배정 주차',
         !!주 && 풀.period.year === 주.year && 풀.period.month === 주.month && 풀.period.week === 주.week,
         JSON.stringify(풀.period) + ' vs ' + JSON.stringify(주));
  }

  // ④ 그림이 **인라인 SVG 글자**로 들어 있는가 (이름표로 남으면 학생 화면이 빈다)
  const 이름표 = qs.filter(q => String(q.figure || '').startsWith('§fig:')).length;
  재기('그림이 이름표로 남은 것 0개', 이름표 === 0, '이름표 ' + 이름표 + '개');
  const svg = qs.filter(q => String(q.figure || '').includes('<svg')).length;
  재기('그림 있는 문항은 다 SVG 글자다', svg === 그림, 'SVG ' + svg + ' / 그림 ' + 그림);

  // ⑤ 본문을 **한 글자만 바꿔도** 해시가 달라지는가 (바꿔치기를 잡는가)
  const 흔든것 = JSON.parse(JSON.stringify(d.ts));
  흔든것.questions[0].text += ' ';
  재기('지문 끝에 빈칸 하나만 넣어도 해시가 달라진다',
       H.sha(H.묶음만들기(meta, 흔든것)) !== d.sha);

  // ⑥ manifest 만 바꿔치기한 것을 잡는가
  const 흔든meta = Object.assign({}, meta, { revision: meta.revision + 1 });
  재기('판번호가 다르면 해시가 달라진다',
       H.sha(H.묶음만들기(흔든meta, d.ts)) !== d.sha);
  console.log('');
}

console.log('셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
process.exit(실패 ? 1 : 0);
