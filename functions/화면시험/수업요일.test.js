// 수업 요일 칸을 잰다.
//
// ⛔ 2026-09-19 실측 — 화면이 「예: 월/수」라고 **한글로 안내**해 놓고 한글을 안 받았다.
//    원장님이 안내대로 「월/수」라 적으셨고 민준의 요일이 **통째로 지워졌다.**
//    재는 것 둘 — ① 한글을 받는가 ② **못 알아들은 값을 조용히 지우지 않는가.**

'use strict';
const fs = require('fs');
const html = fs.readFileSync('E:/aa0/hp/index.html', 'utf8');

function 떼기(a, b) {
  const i = html.indexOf(a), j = html.indexOf(b, i + 10);
  if (i < 0 || j < 0) throw new Error('못 찾음: ' + a);
  return html.slice(i, j);
}
// ⛔ 끝 표는 **바로 다음에 오는 것**으로. 넓게 잡으면 엉뚱한 코드까지 끌어와
//    엉뚱한 데서 터진다(2026-09-19 — 잠금 코드가 딸려 와 `window is not defined`).
const 소스 = 떼기("const _요일들 = ", 'function _eachQuestionList');
const F = new Function(소스 + '\n; return {_요일배열, _요일못알아들은것, _한글요일, _요일들};')();

let 통과 = 0, 실패 = 0;
function 재기(이름, 얻은, 바란) {
  const a = JSON.stringify(얻은), b = JSON.stringify(바란);
  if (a === b) { 통과++; console.log('  ✅ ' + 이름); }
  else { 실패++; console.log('  ⛔ ' + 이름 + '\n       얻은 ' + a + '\n       바란 ' + b); }
}

console.log('── 지금 자료에 있는 꼴 (건드리면 안 된다)');
재기('목록 그대로', F._요일배열(['mon']), ['mon']);
재기('글자 하나도 받는다 (민준·정별이 그랬다)', F._요일배열('mon'), ['mon']);
재기('쉼표', F._요일배열('mon,wed'), ['mon', 'wed']);
재기('슬래시 — 원장님이 실제로 쓰신 꼴', F._요일배열('mon/wed'), ['mon', 'wed']);
재기('빈 것', F._요일배열(''), []);
재기('없음', F._요일배열(null), []);

console.log('\n── ⭐ 한글 — 화면이 안내하는 꼴');
재기('「월/수」 — 값이 날아갔던 바로 그 글', F._요일배열('월/수'), ['mon', 'wed']);
재기('한 글자', F._요일배열('금'), ['fri']);
재기('「월요일」', F._요일배열('월요일'), ['mon']);
재기('쉼표로 셋', F._요일배열('월,수,금'), ['mon', 'wed', 'fri']);
재기('일곱 요일이 다 된다',
     F._요일배열('월화수목금토일'.split('').join('/')),
     ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
재기('한글과 영어를 섞어도', F._요일배열('월,wed'), ['mon', 'wed']);
재기('같은 것을 두 번 적으면 한 번만', F._요일배열('월/월/수'), ['mon', 'wed']);
재기('대문자도', F._요일배열('MON/Wed'), ['mon', 'wed']);

console.log('\n── ⛔ 못 알아들은 것을 짚어 준다 (조용히 지우면 안 된다)');
재기('「월/수」는 이제 다 알아듣는다', F._요일못알아들은것('월/수'), []);
재기('엉뚱한 글자를 짚는다', F._요일못알아들은것('월/엉뚱'), ['엉뚱']);
재기('다 엉뚱하면 다 짚는다', F._요일못알아들은것('가나/다라'), ['가나', '다라']);
재기('빈 것은 짚을 게 없다', F._요일못알아들은것(''), []);
재기('영어 오타도 짚는다', F._요일못알아들은것('mon/wenesday'), ['wenesday']);

console.log('\n── 저장하는 쪽이 「지우지 않는다」를 지키는가 (코드를 읽어 확인)');
const 저장 = 떼기('const seDaysEl = document.getElementById(`se_days_${oldId}`);', 'saveStore(store);');
const 확인 = [
  ['적었는데 하나도 못 알아들으면 멈춘다', /적은것\.trim\(\)\s*&&\s*!새것\.length/.test(저장)],
  ['그때 `return` 으로 빠져나온다', /!새것\.length\)\s*\{[\s\S]*?return;[\s\S]*?\}/.test(저장)],
  ['그때 옛 값을 칸에 되돌려 놓는다', /seDaysEl\.value\s*=/.test(저장)],
  ['일부만 못 알아들으면 알리고 넘어간다', /못알아들음\.length\)\s*\{[\s\S]*?showBackupToast/.test(저장)],
  ['알림에 못 알아들은 낱말이 들어간다', /못알아들음\.join/.test(저장)],
];
for (const [이름, 참] of 확인) 재기(이름, 참, true);

console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
process.exit(실패 ? 1 : 0);
