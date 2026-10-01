// 에뮬레이터 시험을 **한 번에** 돌린다(진짜 DB·인증 · 운영 아님).
//
//   E:/AA0/HP 에서:
//     firebase emulators:exec --only database,auth --project demo-solomon "node functions/에뮬레이터시험/돌리기.js"
//   (Git Bash 면 먼저 JDK 를 PATH 에: export PATH="/c/Program Files/Eclipse Adoptium/jdk-21.0.12.101-hotspot/bin:$PATH")
//
// ⛔ 각 시험이 스스로 에뮬레이터 변수를 확인하고, 없으면 멈춘다(운영 보호).
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const 시험들 = fs.readdirSync(__dirname).filter(f => f.endsWith('.emu.js')).sort();
let 통과 = 0, 실패 = 0;
const 넘어진것 = [];
for (const f of 시험들) {
  let 글 = '', 됐나 = true;
  try {
    글 = execFileSync(process.execPath, [path.join(__dirname, f)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) { 됐나 = false; 글 = (e.stdout || '') + (e.stderr || ''); }
  const 셈 = /셈 — 통과 (\d+) · 실패 (\d+)/.exec(글);
  if (됐나 && 셈) { 통과 += +셈[1]; console.log('  ✅ %s  통과 %s', f.padEnd(24), 셈[1]); }
  else {
    실패 += 셈 ? +셈[2] : 1; 넘어진것.push(f);
    console.log('  ⛔ %s  %s', f.padEnd(24), 셈 ? '실패 ' + 셈[2] : '터졌다');
    console.log(글.split('\n').filter(l => l.includes('⛔')).slice(0, 8).map(l => '       ' + l).join('\n'));
  }
}
console.log('\n── 셈 — 통과 %d · 실패 %d', 통과, 실패);
if (넘어진것.length) console.log('   넘어진 시험: ' + 넘어진것.join(', '));
process.exit(실패 ? 1 : 0);
