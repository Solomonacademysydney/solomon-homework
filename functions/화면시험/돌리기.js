// 돌리기.js — 화면·함수 시험을 **한 번에** 돌린다.
//
//   node functions/화면시험/돌리기.js
//
// 왜 여기 두나
//   · `functions/**` 는 hosting 이 안 올린다(firebase.json) — 시험이 사이트에 안 나간다
//   · 그래도 git 에는 남는다 — 다음에 고칠 때 이 시험이 지켜 준다
//
// ⛔ 이 시험들이 지키는 것 (2026-09-19 에 실제로 당한 것들)
//   · `node --check` 는 **`const` 다시 대입·선언 전 사용을 못 잡는다** — 돌려야 터진다
//   · 좁은 가지만 써도 **값이 낡은 사본에서 오면** 남의 것이 지워진다
//   · `getStore()` 는 부를 때마다 **새 사본** — 두 개 들면 맞춘 것이 덮인다
//   · 아이 글이 그대로 HTML 이 되면 안 된다

'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const 여기 = __dirname;
const 시험들 = fs.readdirSync(여기)
  .filter(f => f.endsWith('.test.js'))
  .sort();

if (!시험들.length) {
  console.log('⛔ 돌릴 시험이 없습니다: ' + 여기);
  process.exit(1);
}

let 통과 = 0, 실패 = 0;
const 실패한것 = [];
for (const f of 시험들) {
  let 글 = '';
  let 됐나 = true;
  try {
    글 = execFileSync(process.execPath, [path.join(여기, f)],
                     { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    됐나 = false;
    글 = (e.stdout || '') + (e.stderr || '');
  }
  const 셈 = /셈 — 통과 (\d+) · 실패 (\d+)/.exec(글);
  if (됐나 && 셈) {
    통과 += +셈[1];
    console.log('  ✅ %s  통과 %s', f.padEnd(28), 셈[1]);
  } else {
    실패 += 셈 ? +셈[2] : 1;
    실패한것.push(f);
    console.log('  ⛔ %s  %s', f.padEnd(28), 셈 ? '실패 ' + 셈[2] : '터졌다');
    console.log(글.split('\n').filter(l => l.includes('⛔')).slice(0, 8)
                 .map(l => '       ' + l).join('\n'));
  }
}

console.log('\n── 셈 — 통과 %d · 실패 %d', 통과, 실패);
if (실패한것.length) console.log('   넘어진 시험: ' + 실패한것.join(', '));
process.exit(실패 ? 1 : 0);
