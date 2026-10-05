// 교사 화면도 필요한 몫만 받는다 (2026-10-05 · 16.0MB → 에뮬레이터 실측 3.1MB)
//
//   맨 위 가지는 다 듣고(제출·명단·리포트…), 숙제 칸은 서랍 창 + 원장이 정한 주 + 오늘 이후 + 주차 깨진 칸만 듣는다.
//   지난 주는 그 주 칸만(이름 목록 → 칸별 once). 이름 목록을 못 받으면 옛 길(뿌리 전체).
'use strict';
const fs = require('fs');
const html = fs.readFileSync('E:/aa0/hp/index.html', 'utf8');
let 통과 = 0, 실패 = 0;
function 재기(이름, 참, 덧) { if (참) { 통과++; console.log('  ✅ ' + 이름); } else { 실패++; console.log('  ⛔ ' + 이름 + (덧 ? '\n       ' + 덧 : '')); } }
const 떼기 = (a, b) => { const i = html.indexOf(a); if (i < 0) throw new Error('못 찾음: ' + a); const j = html.indexOf(b, i + 10); return html.slice(i, j); };

console.log('── _teacherHwWanted (실제로 돌린다)');
{
  const 몸 = 떼기('function _periodOfKey(k)', '\n') + '\n'
    + 떼기('function parseHwKey(key) {', '\n}\n') + '\n}\n'
    + 떼기('function _teacherHwWanted(k, keep, today, cp) {', '\n}\n') + '\n}\n';
  const HW_KEY_RE = new RegExp(/HW_KEY_RE\s*=\s*(\/.*\/[a-z]*);/.exec(html)[1].slice(1, -1));
  const weeksInMonth = (y, m) => (m === 8 ? 4 : 5);
  const periodGte = (a, b) => a.year !== b.year ? a.year > b.year : a.month !== b.month ? a.month > b.month : a.week >= b.week;
  const f = new Function('HW_KEY_RE', 'weeksInMonth', 'periodGte', 몸 + '; return _teacherHwWanted;')(HW_KEY_RE, weeksInMonth, periodGte);
  const keep = new Set(['2026_m10_w1', '2026_m10_w2', '2026_m10_w3', '2026_m10_w4']);
  const today = { year: 2026, month: 10, week: 2 };
  재기('창 안 칸', f('AU_y8_2026_m10_w1', keep, today, null) === true);
  재기('반 칸도 창 안이면', f('AU_y7-정별_2026_m10_w3', keep, today, null) === true);
  재기('지난 달 칸은 안 듣는다', f('AU_y8_2026_m09_w3', keep, today, null) === false);
  재기('원장이 정한 주(창 밖)는 듣는다', f('AU_y8_2026_m09_w3', keep, today, '2026_m09_w3') === true);
  재기('오늘 이후(창 밖 · 11월)는 듣는다', f('AU_y5_2026_m11_w2', keep, today, null) === true);
  재기('주차 깨진 칸은 듣는다(경고용)', f('AU_y7_2026_m08_w5', keep, today, null) === true);
  재기('주차 없는 열쇠는 듣는다', f('weird_key', keep, today, null) === true);
}

console.log('\n── 처음 읽기 길');
{
  const 길 = 떼기('const loadInitialData = (gen, finishInit) => {', 'const _firstFail');
  재기('교사면 필요한 몫 먼저', /if \(_leanOk\(\)\) \{[\s\S]*_loadTeacherLean\(gen\)/.test(길));
  재기('이름 목록 못 받으면 옛 길(뿌리 구독 + 뿌리 once)', /r === null[\s\S]*attachRealtimeListener\(\);[\s\S]*window\.FB_REF\.once\('value'/.test(길));
  재기('옛 길도 그대로 남아 있다', /window\.FB_REF\.once\('value', snap => _firstData\(gen, snap\.val\(\), finishInit\)/.test(길));
  const 로드 = 떼기('window._loadFull = function () {', 'window._resetDataState');
  재기('교사 몫이면 뿌리 구독을 걸지 않는다', /if \(!_leanOk\(\)\) attachRealtimeListener\(\);/.test(로드));
  const 리셋 = 떼기('window._resetDataState = function () {', '};');
  재기('로그아웃·계정 바꾸기에 구독을 뗀다', /_leanDetach\(\);/.test(리셋));
  const 됨 = 떼기('const _leanOk = () => {', '};');
  재기('원장 인증일 때만', /u\.uid === OPERATOR_UID/.test(됨) && /role === 'teacher'/.test(됨));
  재기('되돌리기 스위치(sol_teacher_lean_off)', /sol_teacher_lean_off/.test(됨));
  const 짐 = 떼기('const _loadTeacherLean = async (gen) => {', '\n    };');
  재기('그사이 로그아웃이면 stale', /gen !== _fullGen\) return 'stale'/.test(짐));
  재기('서버가 비었으면 옛 길의 null 처럼', /empty: true/.test(짐) && /r\.empty \? null : r/.test(길));
  재기('claudeApiKey 는 안 듣는다', /k !== 'claudeApiKey'/.test(짐));
  재기('새 칸은 이름 목록을 다시 보아 듣는다(2분)', /setInterval\([\s\S]*_leanPoll\(L\)[\s\S]*120000/.test(짐));
}

console.log('\n── 지난 주');
{
  const 지난 = 떼기('async function _ensurePeriodLoaded(p) {', '\n}\n');
  재기('교사 몫이면 그 주 칸만(이름 목록 → 칸별 once)', /_dbShallowKeys\('homeworkSets'\)[\s\S]*want\.map\(k => window\.FB_REF\.child\('homeworkSets\/' \+ k\)\.once/.test(지난));
  재기('제출은 듣고 있는 것에서 거른다', /L\.data\.submissions/.test(지난));
  const i교사 = 지난.indexOf('window._teacherLean'), i옛 = 지난.indexOf("child('homeworkSets').once");
  재기('옛 전체 읽기는 교사 몫이 실패했을 때만(뒤에)', i교사 > 0 && i옛 > i교사);
}

console.log('\n── 셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
process.exit(실패 ? 1 : 0);
