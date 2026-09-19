// 「수학 자리에 TS 파일」을 막는 자가 **진짜 파일**에서 맞게 무는지 잰다.
//
// ⛔ 두 쪽을 다 봐야 한다 — TS 를 물어야 하고, **수학을 물면 안 된다.**
//    수학까지 물면 원장님이 진짜 숙제를 못 올리신다. 그게 더 나쁘다.

const fs = require('fs');
const path = require('path');
const html = fs.readFileSync('E:/aa0/hp/index.html', 'utf8');

const i = html.indexOf('function _TS파일인가(data) {');
const j = html.indexOf('function importHwJsonForYear', i);
const _TS파일인가 = new Function(html.slice(i, j) + '\n; return _TS파일인가;')();

let 통과 = 0, 실패 = 0;
function 재기(이름, 참, 덧) {
  if (참) { 통과++; console.log('  ✅ ' + 이름); }
  else { 실패++; console.log('  ⛔ ' + 이름 + (덧 ? '  ' + 덧 : '')); }
}

function 읽기(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } }

console.log('── TS 파일은 물어야 한다 (원장님이 실제로 올리신 갈래)');
const TS칸 = 'C:/TS작업/pool/build/2026-m09-w4';
let 봤다 = 0;
for (const f of (fs.existsSync(TS칸) ? fs.readdirSync(TS칸) : [])) {
  if (!f.endsWith('_문항.json')) continue;
  const d = 읽기(path.join(TS칸, f));
  if (!d) continue;
  봤다++;
  const r = _TS파일인가(d);
  재기(f + ' 를 문다', !!r, r ? '(문항 ' + r.문항 + ' 중 표 ' + r.표 + ')' : '못 물었다');
}
// 초안 안의 ts 묶음도
const 초안 = 읽기(path.join(TS칸, 'Hayley04_초안.json'));
if (초안) 재기('초안의 ts 묶음도 문다', !!_TS파일인가(초안.ts));
if (!봤다) console.log('   ⏭ TS 문항 파일을 못 찾았습니다');

console.log('\n── ⛔ 수학 파일은 물면 안 된다 (더 나쁜 잘못이다)');
const 수학후보 = [
  'E:/aa0/hp/generated_sets',
  'C:/TS작업/pool/build/지운것',
];
let 수학봤다 = 0;
for (const 칸 of 수학후보) {
  if (!fs.existsSync(칸)) continue;
  for (const f of fs.readdirSync(칸).slice(0, 6)) {
    if (!f.endsWith('.json')) continue;
    // ⛔ 이 폴더에는 **TS 파일도 섞여 있다**(이름에 `_TS_`). 다 수학이라 여겼다가
    //    자가 맞는데 시험이 틀렸다고 신고할 뻔했다(실측 2026-09-19).
    if (/_TS_/i.test(f)) { console.log('   ⏭ ' + f + ' 는 이름부터 TS 다 — 건너뛴다'); continue; }
    const d = 읽기(path.join(칸, f));
    if (!d) continue;
    // 지운것 안에는 칸 통째가 들어 있다 — 그 안의 수학 세트를 꺼내 본다
    const 세트들 = (d['칸'] && Object.values(d['칸']).flatMap(v => (v && v.sets) || [])) || null;
    if (세트들 && 세트들.length) {
      for (const s of 세트들.slice(0, 4)) {
        const 제목 = (s.title || '').slice(0, 40);
        if (/Thinking Skills/i.test(제목)) continue;      // 이건 잘못 올라간 TS 다
        수학봤다++;
        재기('수학 세트 「' + 제목 + '」 는 안 문다',
             _TS파일인가(s.questions) === null,
             JSON.stringify(_TS파일인가(s.questions)));
      }
      continue;
    }
    수학봤다++;
    재기('수학 파일 ' + f + ' 는 안 문다', _TS파일인가(d) === null);
  }
}
if (!수학봤다) console.log('   ⏭ 수학 파일을 못 찾았습니다');

console.log('\n── 가장자리');
재기('빈 것은 안 문다', _TS파일인가([]) === null);
재기('빈 사전도 안 문다', _TS파일인가({}) === null);
재기('null 도 안 문다', _TS파일인가(null) === null);
재기('TS 표가 하나뿐이면 안 문다 (절반 넘어야 한다)',
     _TS파일인가([{ taxonomy_id: 'TS.x.L1' }, { a: 1 }, { a: 2 }, { a: 3 }]) === null);
재기('절반 넘으면 문다',
     !!_TS파일인가([{ taxonomy_id: 'TS.x.L1' }, { _item_id: 'ts-y' }, { _label_to_id: {} }, { a: 1 }]));

console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
process.exit(실패 ? 1 : 0);
