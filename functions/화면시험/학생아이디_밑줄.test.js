// 학생 아이디에 밑줄(_) 금지 — 학생 추가·아이디 바꾸기 둘 다.
//
// [2-B · 2026-10-01 원장 결정] 제출 칸 열쇠는 `<학생ID>_<연도>_m<월>_w<주>_s<세트>` 다.
//   새 쓰기 규칙(남의 칸 막기)은 「열쇠가 `<내 ID>_` 로 시작하는가」로 주인을 가린다.
//   ID 에 밑줄이 들어가면(예: `Kim` 과 `Kim_A`) 앞머리가 겹쳐 남의 칸에 쓸 수 있게 된다.
//   10-01 실측: 학생 28명 중 밑줄 든 ID 0 ⇒ 지금 금지해도 걸리는 아이가 없다.
//   파이어베이스 열쇠에 못 쓰는 글자(. # $ [ ] /)도 함께 막는다(제출 칸 열쇠가 깨진다).

'use strict';
const fs = require('fs');
const html = fs.readFileSync('E:/aa0/hp/index.html', 'utf8');
let 통과 = 0, 실패 = 0;
function 재기(이름, 참, 덧) {
  if (참) { 통과++; console.log('  ✅ ' + 이름); }
  else { 실패++; console.log('  ⛔ ' + 이름 + (덧 ? '\n       ' + 덧 : '')); }
}
function 떼기(시작, 끝표) {
  const i = html.indexOf(시작); if (i < 0) throw new Error('못 찾음: ' + 시작);
  const j = html.indexOf(끝표, i + 10); if (j < 0) throw new Error('끝 못 찾음: ' + 끝표);
  return html.slice(i, j);
}

const 검사 = new Function(떼기('function studentIdProblem(', '\n}\n') + '\n}\n; return studentIdProblem;')();
console.log('── 아이디 검사');
재기('밑줄 → 거절', /밑줄/.test(검사('Kim_A') || ''));
재기('점 → 거절', !!검사('Kim.A'));
재기('# $ [ ] / → 거절', ['a#b', 'a$b', 'a[b', 'a]b', 'a/b'].every(x => !!검사(x)));
재기('빈 아이디 → 거절', !!검사(''));
재기('보통 아이디는 통과', 검사('Mina05') === null && 검사('Hayley04') === null && 검사('t6') === null && 검사('check06') === null);
재기('한글·하이픈 아이디는 통과', 검사('민아') === null && 검사('Kim-A') === null);

console.log('\n── 두 길 모두 검사를 부른다');
재기('학생 추가(addStudent)가 부른다', /studentIdProblem\(id\)/.test(떼기('async function addStudent() {', '\nasync function addParent')));
재기('학생 아이디 바꾸기(saveStudentEdit)가 부른다', /studentIdProblem\(newId\)/.test(떼기('async function saveStudentEdit(oldId) {', '\n}\n')));
재기('입력칸 안내에 밑줄 금지가 적혀 있다', /밑줄\(_\) 안 됨/.test(html));

console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
process.exit(실패 ? 1 : 0);
