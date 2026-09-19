// TS 교사 화면으로 **가는 길**이 제대로 놓였는가.
//
// ⛔ 원장님 2026-09-19: 「TS 교사화면을 들어가는 방법이 너무 불편한거 아냐?」
//    그때까지는 주소를 손으로 치거나, 숙제 관리 표 깊숙이 묻힌 **11px 링크**를 찾아야 했다.
//    게다가 그 링크가 `?student=` 를 넘기는데 **교사 화면이 안 읽었다** — 눌러도 소용없었다.

'use strict';
const fs = require('fs');
const 본 = fs.readFileSync('E:/aa0/hp/index.html', 'utf8');
const 교 = fs.readFileSync('E:/aa0/hp/ts/index.html', 'utf8');

let 통과 = 0, 실패 = 0;
function 재기(이름, 참, 덧) {
  if (참) { 통과++; console.log('  ✅ ' + 이름); }
  else { 실패++; console.log('  ⛔ ' + 이름 + (덧 ? '\n       ' + 덧 : '')); }
}

console.log('── 홈페이지에서 가는 길');
재기('맨 윗줄에 「TS 교사 화면」 단추가 있다', /🧠 TS 교사 화면/.test(본));
const 단추 = (본.match(/<a href="\/ts\/"[^>]*>[^<]*🧠[^<]*<\/a>/) || [])[0] || '';
재기('그 단추가 `/ts/` 로 간다', 단추.includes('href="/ts/"'), 단추.slice(0, 80));
재기('⛔ **새 창**으로 연다 (같은 창이면 이 화면의 로그인이 흔들린다)',
     /target="_blank"/.test(단추), 단추);
재기('`rel="noopener"` 가 붙어 있다', /rel="noopener"/.test(단추));
재기('작은 글씨가 아니다 (11px 링크와 다르다)', !/font-size:11px/.test(단추), 단추);

console.log('\n── 아이 줄의 「TS ↗」도 그대로 있다');
const 줄링크 = (본.match(/<a href="\/ts\/\?student=[^>]*>[^<]*<\/a>/) || [])[0] || '';
재기('아이 이름 옆 링크가 있다', !!줄링크);
재기('그 아이 id 를 넘긴다', /student=\$\{encodeURIComponent\(s\.id\)\}/.test(줄링크), 줄링크.slice(0, 90));
재기('새 창으로 연다', /target="_blank"/.test(줄링크));

console.log('\n── ⭐ 교사 화면이 그 값을 **읽는가** (안 읽으면 링크가 헛것이다)');
재기('주소에서 `student` 를 읽는다', /URLSearchParams\(location\.search\)/.test(교));
재기("읽은 값으로 `아이고르기` 를 부른다", /아이고르기\(sid\)/.test(교));
재기('⛔ **명단에 있는 아이일 때만** 연다 (엉뚱한 아이를 열면 안 된다)',
     /학생들\.some\(x => x\.id === sid\)/.test(교));
재기('명단에 없으면 그렇다고 알린다', /이 화면이 보는 아이가 아닙니다/.test(교));
재기('읽다 터져도 화면은 뜬다 (try/catch)',
     /try \{[\s\S]{0,600}URLSearchParams[\s\S]{0,600}catch/.test(교));

console.log('\n── 실제로 골라지는가 (가짜 세상에서 돌려 본다)');
const i = 교.indexOf('async function 첫판(){');
const j = 교.indexOf('async function 다시읽기');
const 소스 = 교.slice(i, j);
const 불린것 = [];
const 첫판 = new Function('일꾼상태', '학생읽기', '학생들', '아이고르기', '글', 'document', 'location', 'console',
  소스 + '\n; return 첫판;')(
  async () => {}, async () => {},
  [{ id: 'Hayley04' }, { id: 'Minah' }],
  async (sid) => 불린것.push(sid),
  (s) => String(s),
  { getElementById: () => ({ style: {}, innerHTML: '' }) },
  { search: '?student=Hayley04' }, console);
첫판().then(() => {
  재기('`?student=Hayley04` 면 하경이 열린다', 불린것.join() === 'Hayley04', JSON.stringify(불린것));

  const 안불린것 = [];
  const 첫판2 = new Function('일꾼상태', '학생읽기', '학생들', '아이고르기', '글', 'document', 'location', 'console',
    소스 + '\n; return 첫판;')(
    async () => {}, async () => {}, [{ id: 'Hayley04' }],
    async (sid) => 안불린것.push(sid), (s) => String(s),
    { getElementById: () => ({ style: {}, innerHTML: '' }) },
    { search: '?student=없는아이' }, console);
  첫판2().then(() => {
    재기('명단에 없는 아이면 아무도 안 연다', 안불린것.length === 0, JSON.stringify(안불린것));

    const 셋 = [];
    const 첫판3 = new Function('일꾼상태', '학생읽기', '학생들', '아이고르기', '글', 'document', 'location', 'console',
      소스 + '\n; return 첫판;')(
      async () => {}, async () => {}, [{ id: 'Hayley04' }],
      async (sid) => 셋.push(sid), (s) => String(s),
      { getElementById: () => ({ style: {}, innerHTML: '' }) },
      { search: '' }, console);
    첫판3().then(() => {
      재기('주소에 아무것도 없으면 그냥 목록만', 셋.length === 0);
      console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
      process.exit(실패 ? 1 : 0);
    });
  });
});
