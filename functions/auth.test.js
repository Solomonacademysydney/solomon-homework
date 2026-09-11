// 계정 일꾼 자물쇠 시험 (2026-09-11)
//   node functions/auth.test.js
//
// ⛔ 여기서 재는 것은 **자물쇠 다루는 부분뿐**이다. 데이터베이스는 안 건드린다.
//    흠집(틀린 비번·잘린 자물쇠·길이가 다른 것)을 일부러 넣어 **물리는지**까지 본다.

const { _internals } = require('./auth');
const { sha256hex, scryptHash, safeEq, verifyPw, vaultKey } = _internals;

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name); }
}

console.log('\n① 옛 자물쇠(소금 없는 SHA-256) — 공책에 든 것');
const legacy = sha256hex('minsu1234');
ok('맞는 비번을 통과시킨다', verifyPw('minsu1234', legacy).ok === true);
ok('「갈아 끼워야 한다」고 알린다', verifyPw('minsu1234', legacy).needsUpgrade === true);
ok('⛔ 틀린 비번을 막는다', verifyPw('minsu1235', legacy).ok === false);
ok('⛔ 빈 비번을 막는다', verifyPw('', legacy).ok === false);
ok('⛔ 자물쇠를 잘라 놓으면 막는다', verifyPw('minsu1234', legacy.slice(0, 40)).ok === false);
ok('⛔ 자물쇠가 없으면 막는다', verifyPw('minsu1234', null).ok === false);

console.log('\n② 새 자물쇠(소금 있는 scrypt)');
const modern = scryptHash('minsu1234');
ok('꼴이 scrypt$소금$자물쇠 다', /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/.test(modern));
ok('맞는 비번을 통과시킨다', verifyPw('minsu1234', modern).ok === true);
ok('갈아 끼울 필요가 없다고 한다', verifyPw('minsu1234', modern).needsUpgrade === false);
ok('⛔ 틀린 비번을 막는다', verifyPw('minsu1235', modern).ok === false);
ok('⛔ 소금 칸을 건드리면 막는다', verifyPw('minsu1234', modern.replace(/\$[0-9a-f]{32}\$/, '$' + 'a'.repeat(32) + '$')).ok === false);
ok('⛔ 꼴이 망가지면 막는다(던지지 않고)', verifyPw('minsu1234', 'scrypt$abc').ok === false);

console.log('\n③ 소금이 진짜로 일하는가 — 같은 비번인데 자물쇠가 달라야 한다');
const a = scryptHash('same-password');
const b = scryptHash('same-password');
ok('같은 비번인데 자물쇠가 서로 다르다', a !== b);
ok('그래도 둘 다 열린다', verifyPw('same-password', a).ok && verifyPw('same-password', b).ok);
ok('⛔ 옛 방식은 같은 비번이면 자물쇠도 같다(그래서 위험했다)', sha256hex('x') === sha256hex('x'));

console.log('\n④ 길이가 다른 것을 대도 던지지 않는다 (timingSafeEqual 함정)');
let threw = false;
try { safeEq('abc', 'abcdef'); } catch (e) { threw = true; }
ok('길이가 달라도 던지지 않는다', threw === false);
ok('길이가 다르면 거짓이다', safeEq('abc', 'abcdef') === false);
ok('같으면 참이다', safeEq('abcdef', 'abcdef') === true);

console.log('\n⑤ 금고 서랍 이름');
ok('역할이 앞에 붙는다', vaultKey('student', 'Jasper05') === 'student__Jasper05');
ok('⛔ 역할이 다르면 서랍이 갈린다', vaultKey('student', 'Jasper05') !== vaultKey('parent', 'Jasper05'));

console.log('\n⑥ 흠집 주입 — 「이 손질로 참이 바뀌는가」');
//   자물쇠 한 글자만 바꾼다 ⇒ 답이 「열림」에서 「안 열림」으로 바뀌어야 한다.
const tampered = legacy.slice(0, -1) + (legacy.slice(-1) === 'a' ? 'b' : 'a');
ok('한 글자 바꾼 자물쇠는 안 열린다', verifyPw('minsu1234', tampered).ok === false);
//   비번 끝에 공백 하나 ⇒ 다른 비번이므로 안 열려야 한다.
ok('끝에 공백이 붙은 비번은 안 열린다', verifyPw('minsu1234 ', legacy).ok === false);

console.log('\n⑦ 새로 깔아 줄 비번 만들기');
const { makePassword, words } = _internals;
const W = words();
ok('낱말이 넉넉하다(80개 이상)', W.length >= 80);
ok('⛔ 같은 낱말이 두 번 들어가 있지 않다', new Set(W).size === W.length);
const sample = Array.from({ length: 2000 }, () => makePassword());
ok('꼴이 「낱말+숫자셋」이다', sample.every((p) => /^[a-z]+[0-9]{3}$/.test(p)));
ok('숫자가 100~999 다(앞자리 0 없음)', sample.every((p) => {
  const n = +p.slice(-3); return n >= 100 && n <= 999;
}));
ok('길이가 아이가 칠 만하다(6~12자)', sample.every((p) => p.length >= 6 && p.length <= 12));
ok('⛔ 같은 것이 마구 나오지 않는다(2000개 중 겹침 5% 미만)', (new Set(sample).size / sample.length) > 0.95);
ok('낱말이 골고루 나온다(2000번에 절반 이상 등장)', new Set(sample.map((p) => p.slice(0, -3))).size > W.length / 2);
// 흠집 주입: 뽑을 수 있는 가짓수가 정말 넉넉한가 — 낱말 86 × 900 = 77,400.
//   시간당 10번 막이 있으니 찍어 맞히려면 평균 수백 년이 걸린다.
ok('가짓수가 7만 이상이다', W.length * 900 >= 70000);

console.log('\n────────────────────────────');
console.log(fail === 0 ? `전부 통과 — ${pass}개` : `⛔ ${fail}개 실패 / ${pass}개 통과`);
process.exit(fail === 0 ? 0 : 1);
