// R-0 「잠긴 칸 가르기」를 **파일에서 그대로 떼어 내** 대어 본다.
// ⛔ 베껴 쓰면 시험이 거짓이 된다.
const fs = require('fs');
const html = fs.readFileSync('E:/aa0/hp/index.html', 'utf8');

function 떼기(시작표, 끝표) {
  const i = html.indexOf(시작표), j = html.indexOf(끝표);
  if (i < 0 || j < 0 || j <= i) throw new Error('못 찾음: ' + 시작표);
  return html.slice(i, j);
}

const 소스 = 떼기('function _경로의칸(path)', 'async function _서버값으로되돌리기');
const win = { _잠긴칸: new Set() };
const F = new Function('window', 소스 +
  '; return {_경로의칸,_경로의가지,_잠겨서막히나,_묶음가르기,_사본에박기,_잠겨도쓰는가지};')(win);

let 통과 = 0, 실패 = 0;
function 재기(이름, 얻은, 바란) {
  const a = JSON.stringify(얻은), b = JSON.stringify(바란);
  if (a === b) { 통과++; console.log('  ✅ ' + 이름); }
  else { 실패++; console.log('  ⛔ ' + 이름 + '\n       얻은 ' + a + '\n       바란 ' + b); }
}
const 칸 = 'AU_y4_2026_m09_w3';

console.log('── 칸·가지 뽑기');
재기('칸 이름', F._경로의칸('homeworkSets/' + 칸 + '/ts'), 칸);
재기('가지 이름', F._경로의가지('homeworkSets/' + 칸 + '/ts'), 'ts');
재기('칸 통째면 가지 없음', F._경로의가지('homeworkSets/' + 칸), null);
재기('숙제 칸이 아님', F._경로의칸('submissions/ts_Hayley04_2026_m09_w3'), null);

console.log('\n── 잠긴 칸이 **없을 때**는 오늘과 똑같아야 한다');
win._잠긴칸 = new Set();
const 묶음 = {
  ['homeworkSets/' + 칸 + '/sets']: [1],
  ['homeworkSets/' + 칸 + '/ts']: {q: 1},
  'currentPeriod': 'x'
};
재기('다 보낸다', Object.keys(F._묶음가르기(묶음).보낼것).length, 3);
재기('막힌 것 없다', Object.keys(F._묶음가르기(묶음).막힌것), []);

console.log('\n── ★ 잠긴 칸에서도 **수학은 살아야 한다** (원장님 결정: 순서 무관)');
win._잠긴칸 = new Set([칸]);
재기('sets 는 안 막힌다',      F._잠겨서막히나('homeworkSets/' + 칸 + '/sets'), false);
재기('published 는 안 막힌다', F._잠겨서막히나('homeworkSets/' + 칸 + '/published'), false);
재기('period 는 안 막힌다',    F._잠겨서막히나('homeworkSets/' + 칸 + '/period'), false);
재기('ts 는 막힌다',          F._잠겨서막히나('homeworkSets/' + 칸 + '/ts'), true);
재기('칸 통째는 막힌다',        F._잠겨서막히나('homeworkSets/' + 칸), true);
let g = F._묶음가르기(묶음);
재기('보낼 것 = sets + currentPeriod', Object.keys(g.보낼것).sort(),
     ['currentPeriod', 'homeworkSets/' + 칸 + '/sets']);
재기('막힌 것 = ts 뿐', Object.keys(g.막힌것), ['homeworkSets/' + 칸 + '/ts']);

console.log('\n── 다른 칸은 잠긴 칸 때문에 막히면 안 된다 (update 는 하나 막히면 다 막힌다)');
g = F._묶음가르기({
  ['homeworkSets/' + 칸 + '/ts']: {q: 1},
  'homeworkSets/AU_y5_2026_m09_w3/sets': [2]
});
재기('안 잠긴 칸은 살아 나간다', Object.keys(g.보낼것), ['homeworkSets/AU_y5_2026_m09_w3/sets']);
재기('잠긴 칸의 ts 만 막힌다',   Object.keys(g.막힌것), ['homeworkSets/' + 칸 + '/ts']);

console.log('\n── 허용 가지 목록이 규칙 초안과 같은가');
const 규칙 = JSON.parse(
  fs.readFileSync('E:/aa0/hp/backup/database.rules.DRAFT_R1_20260919.json', 'utf8')
    .replace(/^\uFEFF/, '').replace(/\/\/[^\n]*/g, '')
).rules.solomon_hw_v3.homeworkSets.$key;
const 규칙이허락 = Object.keys(규칙).filter(k =>
  k !== '.write' && 규칙[k] && 규칙[k]['.write'] && !/lock/.test(규칙[k]['.write']));
재기('화면 목록 = 규칙 목록', [...F._잠겨도쓰는가지].sort(), 규칙이허락.sort());

console.log('\n── 사본 되돌리기');
const st = {homeworkSets: {[칸]: {ts: {q: '내가 고친 것'}, sets: [1]}}};
F._사본에박기(st, 'homeworkSets/' + 칸 + '/ts', {q: '서버 값'});
재기('서버 값으로 덮인다', st.homeworkSets[칸].ts, {q: '서버 값'});
재기('옆 가지는 안 건드린다', st.homeworkSets[칸].sets, [1]);
F._사본에박기(st, 'homeworkSets/' + 칸 + '/ts', null);
재기('서버에 없으면 지운다', 'ts' in st.homeworkSets[칸], false);
F._사본에박기(st, 'homeworkSets/새칸/ts', {q: 1});
재기('없던 칸도 만든다', st.homeworkSets['새칸'].ts, {q: 1});

console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
process.exit(실패 ? 1 : 0);
