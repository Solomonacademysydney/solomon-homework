// [점검 10-05 F4·F5 예방] 화면이 만들 수 있는 것 = 서버가 받는 것
//   F4 학생 아이디: 화면 studentIdProblem 이 통과시키는 아이디는 서버(prep_session KEY_RE)가 학부모 자녀 목록에 넣는다
//   F5 반 이름: 화면 sanitizeGroup 이 만드는 반 이름은 서버 hwSubmit(checkKeys)이 받는다
'use strict';
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync('E:/aa0/hp/index.html', 'utf8');
const H = require('../hw_submit')._internals;
let 통과 = 0, 실패 = 0;
function 재기(이름, 참, 덧) { if (참) { 통과++; console.log('  ✅ ' + 이름); } else { 실패++; console.log('  ⛔ ' + 이름 + (덧 ? '\n       ' + 덧 : '')); } }
const 떼기 = (a) => { const i = html.indexOf(a); if (i < 0) throw new Error('못 찾음: ' + a); return html.slice(i, html.indexOf('\n}\n', i) + 3); };
const studentIdProblem = new Function(떼기('function studentIdProblem(') + '; return studentIdProblem;')();
const sanitizeGroup = new Function(떼기('function sanitizeGroup(') + '; return sanitizeGroup;')();
const 세션소스 = fs.readFileSync(path.join(__dirname, '..', 'prep_session.js'), 'utf8');
const KEY_RE = new RegExp(/const KEY_RE = \/(.+)\/;/.exec(세션소스)[1]);

console.log('── F4 아이디 — 화면이 받는 것 = 서버가 자녀로 넣는 것(밑줄 빼고)');
const 아이디들 = ['Mina05', 'Hayley04', 'RYAN', 'MinjaeAaron', 't6', '민아', 'Kim-A', '김-민준', 'guest',
  'Kim_A', 'Kim A', ' Kim', 'Kim.A', 'a#b', 'a$b', 'a[b', 'a/b', 'Kim😀', 'Kim@A', 'Kim+A', 'é', 'a'.repeat(81), ''];
const 어긋남 = 아이디들.filter(id => {
  const 화면됨 = studentIdProblem(id) === null;
  const s = String(id).trim();
  const 서버됨 = KEY_RE.test(s) && !s.includes('_');
  return 화면됨 !== 서버됨;
});
재기('아이디 ' + 아이디들.length + '개 — 어긋남 0', 어긋남.length === 0, JSON.stringify(어긋남));
재기('띄어쓰기 든 아이디는 막는다(학부모 화면이 못 읽는다)', /띄어쓰기/.test(studentIdProblem('Kim A') || ''));
재기('지금 쓰는 꼴(영문·숫자·한글·하이픈)은 통과', ['Mina05', 'RYAN', '민아', 'Kim-A'].every(x => studentIdProblem(x) === null));
재기('학생 관리 표 — 규칙에 안 맞는 옛 아이디에 「⚠ 아이디」 딱지', /studentIdProblem\(s\.id\) \? ' <span title=[\s\S]{0,300}⚠ 아이디/.test(html));

console.log('\n── F5 반 이름 — 화면이 만드는 반 이름을 서버가 받는다');
const 반들 = ['민 준', '민준', 'A', 'B반', 'Year 5 Gold', '  앞뒤  ', 'a_b', 'a__b', 'A.B', 'x/y', '#1반', '$', '[A]', '탭\t반', '줄\n반',
  '(오후)', 'A&B', "O'Neil", '아주아주아주아주아주아주아주아주아주아주긴반이름', '😀반', '-', '--A'];
const 거절 = [];
for (const raw of 반들) {
  const g = sanitizeGroup(raw);
  if (!g) continue;                                   // 비면 반 없음(공통) — 따로 검사할 것 없음
  const hwKey = 'AU_y5-' + g + '_2026_m10_w2';
  try { H.checkKeys('Amy', 'Amy_2026_m10_w2_s0', hwKey, 5); }
  catch (e) { 거절.push(JSON.stringify(raw) + ' → ' + JSON.stringify(g) + ' : ' + e.message); }
}
재기('반 이름 ' + 반들.length + '개 — 서버 거절 0', 거절.length === 0, 거절.join('\n       '));
재기('코덱스가 든 예 「민 준」 반 숙제 열쇠를 서버가 받는다', (() => { try { H.checkKeys('Amy', 'Amy_2026_m10_w2_s0', 'AU_y5-민 준_2026_m10_w2', 5); return true; } catch (e) { return false; } })());
재기('반 이름에서 . # $ [ ] / 를 뺀다(파이어베이스 열쇠에 못 쓴다)', sanitizeGroup('A.B/C#D$E[F]') === 'ABCDEF');
재기('반 이름의 밑줄은 띄어쓰기로(예전과 같음)', sanitizeGroup('a_b') === 'a b');
const 됨 = (k) => { try { H.checkKeys('Amy', 'Amy_2026_m10_w2_s0', k, 5); return true; } catch (e) { return false; } };
재기('서버는 여전히 밑줄·경로 글자 든 반 열쇠를 거절', !됨('AU_y5-a_b_2026_m10_w2') && !됨('AU_y5-a/b_2026_m10_w2') && !됨('AU_y5-a.b_2026_m10_w2'));

console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
process.exit(실패 ? 1 : 0);
