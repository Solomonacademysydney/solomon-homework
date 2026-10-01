// 학생 화면 시험 환경(에뮬레이터) 스위치 — **운영 주소에서는 절대 안 켜진다.**
//
// [2-A · 2026-10-01] 지금까지 학생 화면은 운영 설정이 박혀 있어 브라우저 시험을 못 했다(1단계 미실행 항목).
//   ⇒ `localhost`·`127.0.0.1` 에서 주소에 `?emu=1` 이 있을 때만 에뮬레이터(데모 프로젝트)에 붙고,
//     화면에 「시험 환경」 띠를 크게 띄운다.
//
// 이 시험이 지키는 것
//   ① 운영 주소(solomonacademy.com.au 등)는 ?emu=1 이 있어도 **운영 그대로**
//   ② 시험 설정에는 운영 프로젝트 이름·주소가 한 글자도 없다
//   ③ 운영 설정(firebaseConfig) 글자는 1단계 배포본(c92484b)과 같다
//   ④ 켜지면 DB·인증·함수 셋 다 에뮬레이터로 · 띠가 뜬다 / 꺼지면 아무것도 안 부른다

'use strict';
const fs = require('fs');
const { execFileSync } = require('child_process');
const html = fs.readFileSync('E:/aa0/hp/index.html', 'utf8');

let 통과 = 0, 실패 = 0;
function 재기(이름, 참, 덧) {
  if (참) { 통과++; console.log('  ✅ ' + 이름); }
  else { 실패++; console.log('  ⛔ ' + 이름 + (덧 ? '\n       ' + 덧 : '')); }
}
function 떼기(시작, 끝표, 원본) {
  const h = 원본 || html;
  const i = h.indexOf(시작);
  if (i < 0) throw new Error('못 찾음: ' + 시작);
  const j = h.indexOf(끝표, i + 10);
  if (j < 0) throw new Error('끝 못 찾음: ' + 끝표);
  return h.slice(i, j);
}

console.log('── ① 언제 켜지나');
const 가르기 = new Function(떼기('function _emuModeOf(', '\n}\n') + '\n}\n; return _emuModeOf;')();
const 곳 = (hostname, search) => ({ hostname, search });
재기('운영 주소 + ?emu=1 → 꺼짐', 가르기(곳('solomonacademy.com.au', '?emu=1')) === false);
재기('www 운영 주소 + ?emu=1 → 꺼짐', 가르기(곳('www.solomonacademy.com.au', '?emu=1')) === false);
재기('github.io + ?emu=1 → 꺼짐', 가르기(곳('solomonacademysydney.github.io', '?emu=1')) === false);
재기('localhost 를 흉내 낸 남의 주소 → 꺼짐', 가르기(곳('localhost.evil.com', '?emu=1')) === false);
재기('localhost 인데 ?emu=1 없음 → 꺼짐', 가르기(곳('localhost', '')) === false);
재기('localhost + ?emu=10 → 꺼짐(정확히 1 만)', 가르기(곳('localhost', '?emu=10')) === false);
재기('localhost + ?emu=1 → 켜짐', 가르기(곳('localhost', '?emu=1')) === true);
재기('127.0.0.1 + ?a=b&emu=1 → 켜짐', 가르기(곳('127.0.0.1', '?a=b&emu=1')) === true);
재기('location 이 없어도 안 터지고 꺼짐', 가르기(undefined) === false);

console.log('\n── ② 시험 설정에 운영 것이 없다');
const 시험설정 = 떼기('const _EMU_CONFIG = {', '};');
재기('시험 설정에 운영 프로젝트 이름이 없다', !/solomon-76715/.test(시험설정), 시험설정);
재기('시험 설정의 프로젝트는 demo- 로 시작(에뮬레이터 전용)', /projectId:\s*'demo-/.test(시험설정));
재기('시험 설정의 DB 는 127.0.0.1', /databaseURL:\s*'http:\/\/127\.0\.0\.1:9000/.test(시험설정));

console.log('\n── ③ 운영 설정은 그대로');
const 배포본 = execFileSync('git', ['-C', 'E:/AA0/HP', 'show', 'c92484b:index.html'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const 운영설정 = (h) => 떼기('const firebaseConfig = {', '};', h);
재기('firebaseConfig 글자가 1단계 배포본과 같다', 운영설정(html) === 운영설정(배포본));
재기('initializeApp 는 스위치를 거친다', /firebase\.initializeApp\(_EMU \? _EMU_CONFIG : firebaseConfig\);/.test(html));
재기('스위치를 거치지 않는 initializeApp 이 없다', (html.match(/firebase\.initializeApp\(/g) || []).length === 1);
재기('에뮬레이터 붙이기는 _EMU 일 때만', /if \(_EMU\) _emuConnect\(firebase, document\);/.test(html));

console.log('\n── ④ 켜지면 셋 다 에뮬레이터 · 띠');
const 붙이기 = new Function(떼기('function _emuConnect(', '\n}\n') + '\n}\n; return _emuConnect;')();
const 불림 = [];
const 몸 = { kids: [], appendChild(e) { this.kids.push(e); }, insertBefore(e) { this.kids.push(e); }, firstChild: null };
const 가짜문서 = { body: 몸, readyState: 'complete', title: '솔로몬', createElement: () => ({ style: {}, set textContent(t) { this._t = t; }, get textContent() { return this._t; } }),
                  addEventListener() {} };
const 가짜fb = {
  database: () => ({ useEmulator: (h, p) => 불림.push('db ' + h + ':' + p) }),
  auth: () => ({ useEmulator: (u) => 불림.push('auth ' + u) }),
  app: () => ({ functions: (r) => ({ useEmulator: (h, p) => 불림.push('fn ' + r + ' ' + h + ':' + p) }) }),
};
붙이기(가짜fb, 가짜문서);
재기('DB → 127.0.0.1:9000', 불림.includes('db 127.0.0.1:9000'), 불림.join(' | '));
재기('인증 → 127.0.0.1:9099', 불림.includes('auth http://127.0.0.1:9099'), 불림.join(' | '));
재기('함수(australia-southeast1) → 127.0.0.1:5001', 불림.includes('fn australia-southeast1 127.0.0.1:5001'), 불림.join(' | '));
재기('「시험 환경」 띠가 붙는다', 몸.kids.some(e => /시험 환경/.test(e.textContent || '')), JSON.stringify(몸.kids.map(e => e.textContent)));
재기('창 제목에도 [시험] 이 붙는다', /^\[시험\]/.test(가짜문서.title), 가짜문서.title);

console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
process.exit(실패 ? 1 : 0);
