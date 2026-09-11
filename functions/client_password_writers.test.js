// 홈페이지에서 **비번을 쓰는 곳**이 금고를 함께 건드리는지 보는 자 (2026-09-11)
//   node functions/client_password_writers.test.js
//
// ⛔ 왜 이 자가 있나 —
//   비번의 **정본을 금고(solomon_auth)로 옮기면서, 그 칸에 쓰는 곳을 전부 옮기지 않았다.**
//   같은 날 두 번 그랬다(「🔑 PW」 단추 · 계정 새로 만들기). 둘 다 **화면은 성공이라 하고
//   실제로는 안 바뀌는** 꼴이었다 — 눈으로는 안 보인다.
//
//   그래서 자를 세운다: 비번을 쓰는 함수는 **금고를 건드리는 말**이 그 안에 있어야 한다.
//   새 쓰기 자리가 생기면 아래 목록에 없어서 **시험이 깨진다** — 그게 이 자의 일이다.

const fs = require('fs');
const path = require('path');

// CHECK_FILE 로 다른 파일을 겨눌 수 있다 — **이 자가 무는지 시험할 때** 쓴다
// (사본에 흠집을 내어 걸리는지 본다. 진짜 index.html 은 건드리지 않는다).
const FILE = process.env.CHECK_FILE || path.join(__dirname, '..', 'index.html');
const HTML = fs.readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  OK   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}

// ── 비번을 쓰는 자리를 찾아 그 함수 이름을 알아낸다 ──
function findWriters() {
  const re = /\.pw\s*=[^=]|pw\s*:\s*hpw|pw\s*:\s*await\s+hashPw/g;
  const out = {};
  let m;
  while ((m = re.exec(HTML))) {
    const before = HTML.slice(0, m.index);
    const fns = [...before.matchAll(/(?:^|\n)\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)];
    const name = fns.length ? fns[fns.length - 1][1] : '(top-level)';
    const line = before.split('\n').length;
    (out[name] = out[name] || []).push(line);
  }
  return out;
}

function bodyOf(name) {
  const re = new RegExp('(?:^|\\n)\\s*(?:async\\s+)?function\\s+' + name + '\\s*\\(');
  const m = re.exec(HTML);
  if (!m) return null;
  const start = m.index;
  const end = HTML.indexOf('\n}\n', start);
  return end === -1 ? HTML.slice(start) : HTML.slice(start, end + 3);
}

// 금고를 건드린다고 인정하는 말들. 하나라도 있으면 통과.
const TOUCHES_VAULT = [
  'ensureVaultPassword',      // 계정 새로 만들기
  'setPasswordByOperator',    // 원장님이 정해서 바꾸기
  'changeMyPassword'          // 아이가 스스로 바꾸기
];

// 금고를 안 건드려도 되는 곳 — **이유를 반드시 적을 것.**
const EXEMPT = {
  ensureStore:
    '옛 평문 비번을 SHA-256 으로 바꾸던 한 번짜리 이주. 40명 모두 이미 해시라 돌지 않고, ' +
    '순서 (4) 로 공책의 pw 칸이 사라지면 조건 자체가 거짓이 된다.'
};

console.log('\n① 비번을 쓰는 곳을 전부 찾았나');
const writers = findWriters();
const names = Object.keys(writers).sort();
console.log('   찾은 곳: ' + names.join(', '));

const EXPECTED = ['_resetPasswordVia', 'addParent', 'addStudent', 'ensureStore', 'saveMyAccount', 'saveTeacherAccount'];
ok('알던 목록과 같다 (새 자리가 생기면 여기서 걸린다)',
  names.join(',') === EXPECTED.join(','),
  '지금=' + names.join(',') + ' / 알던것=' + EXPECTED.join(','));

console.log('\n② 쓰는 곳마다 금고를 함께 건드리나');
for (const name of names) {
  if (EXEMPT[name]) { console.log('  --   ' + name + ' (면제: ' + EXEMPT[name].slice(0, 40) + '…)'); continue; }
  const body = bodyOf(name);
  if (!body) { ok(name + ' 의 몸통을 찾았다', false); continue; }
  const hit = TOUCHES_VAULT.find((w) => body.indexOf(w) !== -1);
  ok(name + ' 이(가) 금고를 건드린다', !!hit, hit ? '' : '금고를 건드리는 말이 하나도 없다');
}

console.log('\n③ 면제한 곳은 이유가 적혀 있나');
for (const name of Object.keys(EXEMPT)) {
  ok(name + ' 에 면제 이유가 적혀 있다', String(EXEMPT[name]).length > 30);
}

console.log('\n④ 순서 (4) 에서 함께 지울 것들이 아직 제자리에 있나');
//   ⛔ 이것들은 **지금은 있어야 한다.** 공책에서 pw 를 지우는 날 함께 지운다.
//      먼저 사라지면 뒷길이 끊겨 일꾼이 삐끗할 때 아무도 못 들어온다.
ok('doLogin 에 「옛 길로 물러섬」이 아직 있다', /옛 길로 물러섰다/.test(HTML));
ok('fbSetUsers 가 아직 pw 를 함께 쓴다 (여기를 떼면 그게 곧 순서 4다)',
  /function fbSetUsers[\s\S]{0,200}updates\[`users\/\$\{i\}`\] = u;/.test(HTML));

console.log('\n────────────────────────────');
console.log(fail === 0 ? '전부 통과 — ' + pass + '개' : '실패 ' + fail + '개 / 통과 ' + pass + '개');
process.exit(fail === 0 ? 0 : 1);
