// 툴체인 단원 찾기(prep_core.toolchainMatches) — 주간 설정의 MR 단원 이름 → 쌓인 단원 프로그램 가운데 같은 기술
//   node functions/화면시험/prep_툴체인.test.js
'use strict';
const path = require('path');
const C = require(path.join(__dirname, '..', '..', 'prep', 'prep_core'));
let 통과 = 0, 실패 = 0;
function 재기(이름, 참, 덧) { if (참) { 통과++; console.log('  ✅ ' + 이름); } else { 실패++; console.log('  ⛔ ' + 이름 + (덧 ? '\n       ' + 덧 : '')); } }

const ix = { rev: 'rev55', units: [
  { 트랙: 'y9ncm', 파일: 'banks/mr_areavol_b.py', 제목: 'NCM9 10.06-10.09 — 원·부채꼴, 각기둥·원기둥 겉넓이, 각기둥·원기둥 부피.', 처음: '지금' },
  { 트랙: 'y3yujun', 파일: 'banks/y3_volume.py', 제목: 'B블록 — 측정: 부피와 들이 (S09).', 처음: '지금' },
  { 트랙: 'y4sean', 파일: 'banks/mr_mult.py', 제목: 'Year 4 Mathematical Reasoning — Multiplication rebuild', 처음: '지금' },
  { 트랙: 'y9ncm', 파일: 'banks/mr_indices.py', 제목: 'NCM9 5.01-5.04 — 지수법칙 · 거듭제곱의 거듭제곱', 처음: '지금' },
  { 트랙: 'y7geo', 파일: 'geo_tri.py', 제목: 'G2 Triangles — 옛 판', 처음: '2026-09-W1' },
  { 트랙: 'y7geo', 파일: 'banks/geo_tri.py', 제목: 'G2 Triangles — 이번 판', 처음: '지금' },
  { 트랙: 'y7geo', 파일: 'layout.py', 제목: '2단 조판 블록', 처음: '지금' } ] };

console.log('── 기술 열쇠 — 영어·한국어 이름을 같은 열쇠로');
재기('Volume and Surface Area of Prisms → 부피 · 겉넓이 · 각기둥', JSON.stringify(C.기술열쇠('Volume and Surface Area of Prisms (cm³, m³, L)').sort()) === JSON.stringify(['prism', 'surf', 'vol']), JSON.stringify(C.기술열쇠('Volume and Surface Area of Prisms')));
재기('「겉넓이」는 넓이(area)로 세지 않는다', !C.기술열쇠('surface area').includes('area') && !C.기술열쇠('겉넓이').includes('area'));
재기('「소수 사칙연산」은 소수(dec) · 「소인수」는 소수가 아님', C.기술열쇠('소수 셋째 자리까지 / 소수 사칙연산').includes('dec') && !C.기술열쇠('소인수분해').includes('dec'));

console.log('\n── 찾기');
const 부피 = C.toolchainMatches(ix, 'Volume and Surface Area of Prisms (cm³, m³, L)');
재기('부피·겉넓이 → Y9 각기둥(셋 겹침)이 맨 앞 · Y3 부피도 학년을 붙여 보인다', 부피[0].트랙 === 'y9ncm' && 부피[0].학년 === 'Y9' && 부피[0].겹침.length === 3 && 부피.some(m => m.학년 === 'Y3'), JSON.stringify(부피));
재기('곱셈 → Y4 곱셈만(Y9 지수는 기술이 다르니 안 나옴)', JSON.stringify(C.toolchainMatches(ix, 'Multiplication').map(m => m.트랙)) === '["y4sean"]');
재기('같은 트랙·같은 파일은 지금 판 하나만', C.toolchainMatches(ix, 'Triangles').length === 1 && C.toolchainMatches(ix, 'Triangles')[0].제목.includes('이번 판'));
재기('처음 나오는 단원 → 빈 목록(화면에 「새로 지어야」)', C.toolchainMatches(ix, 'Congruent figures').length === 0);
재기('이름이 비었거나 목록이 없으면 빈 목록', C.toolchainMatches(ix, '').length === 0 && C.toolchainMatches(null, 'Volume').length === 0);
재기('도우미 파일(조판 블록)은 안 걸린다', !C.toolchainMatches(ix, 'Area').some(m => m.파일 === 'layout.py'));

console.log('\n── 프로젝트에 붙여 넣을 부탁 글');
{
  const O = require(path.join(__dirname, '..', '..', 'prep', 'order_core'));
  const s = O.defaultSettings(); s.mr.units[0].title = 'Volume and Surface Area of Prisms'; s.ts.include = false; s.onlineHw.tsSets = 0;
  s.mr.units[1] = Object.assign(JSON.parse(JSON.stringify(s.mr.units[0])), { title: 'Multiplication' });
  const 글 = C.projectRequest({ student: { id: 'Stella07', name: '정별', year: 7 }, lessonDate: '2026-10-05', settings: s, lesson: { session: 6, hw: 'M3 유닛' }, index: ix });
  재기('학생 · 영어 이름 · 트랙 · 수업일 · 회차', /정별 \(Stella · Stella07\) · Y7 · 툴체인 트랙 y7geo/.test(글) && /수업일: 2026-10-05 · 커리 6회차/.test(글));
  재기('주제 A·B 마다 비슷한 단원과 판정 후보', /A 신개념: Volume/.test(글) && /mr_areavol_b\.py \(Y9\) — 학년 다름/.test(글) && /B 다른 영역: Multiplication/.test(글) && /mr_mult\.py \(Y4\)/.test(글), 글);
  재기('TS 를 뺐으면 종이 숙제에 TS 를 적지 않는다', /TS: 없음/.test(글) && !/\+ TS 10/.test(글));
  재기('파일 이름에 영어 이름을 넣으라는 말(들어올 때 주인 알아보기)', /「Stella」를 꼭 넣어/.test(글) && /Solomon_교재보관\/2026-10\//.test(글));
  const 비슷없음 = C.projectRequest({ student: { id: 'Youjun03', name: '조유준', year: 3 }, lessonDate: '2026-10-14', settings: Object.assign(O.defaultSettings(), {}), index: ix });
  재기('주제가 비면 「커리대로」 · 유준 = y3yujun · Yujun', /주제를 적지 않았습니다/.test(비슷없음) && /Yujun · Youjun03/.test(비슷없음) && /y3yujun/.test(비슷없음));
  const p = O.prefill(null, { lessons: [{ date: '2026-10-14', mr: '소수 사칙연산', mrB: '복합도형 넓이', mrC: '분수 문장제 복습', ts: 'odd-one-out' }] }, '2026-10-14');
  재기('커리에 B·C 주제가 있으면 주간 설정에 미리 채운다(유준 v3)', p.settings.mr.units.map(u => u.title).join('|') === '소수 사칙연산|복합도형 넓이|분수 문장제 복습' && p.source['mr.units.2.title'] === '커리');
}

console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
process.exit(실패 ? 1 : 0);
