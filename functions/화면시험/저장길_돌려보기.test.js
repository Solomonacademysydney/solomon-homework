// 고친 함수들을 **가짜 세상에서 진짜로 돌려 본다.**
//
// ⛔ 왜 필요한가 — 오늘 세 번 당했다:
//    ① `const hw` 에 다시 대입   ② 선언도 안 된 `store` 를 먼저 씀   ③ 서랍을 두 개 듦
//    ①②는 `node --check` 를 **통과한다.** 돌려야 터진다. 그때는 원장님이 단추를 누른 뒤다.
// ⛔ 떼어 낸 글 뒤에 무엇을 붙일 땐 **줄바꿈을 먼저** — 끝이 주석 한가운데면 먹힌다(실측).

const fs = require('fs');
const html = fs.readFileSync('E:/aa0/hp/index.html', 'utf8');

function 떼기(시작, 끝표) {
  const i = html.indexOf(시작);
  if (i < 0) throw new Error('못 찾음: ' + 시작);
  const j = html.indexOf(끝표, i + 10);
  if (j < 0) throw new Error('끝 못 찾음: ' + 끝표);
  return html.slice(i, j);
}

const 소스 =
  떼기('async function _칸맞추기(key) {', 'function fbSetHomeworkSet(key, data, 빼기)') +
  떼기('async function deleteSet(idx) {', '\nfunction togglePublishYear') +
  떼기('async function confirmMoveSet(fromIdx) {', '\nfunction ');

/** 서버·서랍을 가진 가짜 세상. 서랍은 **하나뿐**이라 사본이 갈리면 바로 드러난다. */
function 세상(서버, 서랍, 읽기막힘) {
  const w = { fbReady: true, isPreviewMode: false };
  const 상태 = { 서랍: JSON.parse(JSON.stringify(서랍)), 쓴것: null, 알림: [] };
  w.FB_REF = { child: (path) => ({ once: async () => {
    if (읽기막힘) throw new Error('네트워크');
    let v = 서버; for (const m of path.split('/')) v = (v == null ? undefined : v[m]);
    return { exists: () => v != null, val: () => JSON.parse(JSON.stringify(v)) };
  } }) };
  const 값 = {
    window: w,
    getStore: () => 상태.서랍,
    saveStore: (d) => { 상태.서랍 = d; return true; },
    showBackupToast: (m) => 상태.알림.push(m),
    renderTeacher: () => {},
    confirm: () => true,
    fbWrite: (u) => { 상태.쓴것 = u; },
    closeModal: () => {},
    periodLabel: () => 'L',
    hwKey: (y, c, p, g) => c + '_y' + y + (g ? '-' + g : '') + '_' + p.year
                         + '_m' + String(p.month).padStart(2, '0') + '_w' + p.week,
    _countSubmittedAt: () => 0,
    _archiveAndClearSubmissions: () => {},
    _칸비었으면지우기: () => {},
    selectedYear: 5, selectedCountry: 'AU', selectedGroup: '',
    editingSetIdx: null, parsedQuestions: [],
    document: { getElementById: (id) => ({ value: ({ moveToYear: '5', moveToPYear: '2026',
                                                     moveToPMonth: '10', moveToPWeek: '1' })[id] }) },
    console,
  };
  const 이름 = Object.keys(값);
  // ⛔ 앞에 **줄바꿈**을 꼭 붙인다 — 떼어 낸 글이 주석으로 끝나면 이 줄이 먹힌다.
  상태.F = new Function(...이름, 소스 + '\n; return {deleteSet, confirmMoveSet, _칸맞추기};')(
    ...이름.map(k => 값[k]));
  return 상태;
}

const 세트 = (n) => Array.from({ length: n }, (_, i) =>
  ({ setIdx: i, title: 'Set ' + (i + 1), questions: [{ q: i }] }));
const 서버칸 = () => ({ homeworkSets: {
  'AU_y5_2026_m09_w4': { sets: 세트(6), ts: { questions: new Array(48).fill({}) }, year: 5, country: 'AU' },
} });
const 빈서랍 = () => ({ homeworkSets: {}, currentPeriod: { year: 2026, month: 9, week: 4 }, users: [] });

let 통과 = 0, 실패 = 0;
function 재기(이름, 참, 덧) {
  if (참) { 통과++; console.log('  ✅ ' + 이름); }
  else { 실패++; console.log('  ⛔ ' + 이름 + (덧 ? '\n       ' + 덧 : '')); }
}

(async () => {
  console.log('── 세트 지우기 — 서랍이 비어 있어도 서버의 여섯을 안 지운다');
  let S = 세상(서버칸(), 빈서랍());
  try {
    await S.F.deleteSet(2);
    const 쓴 = (S.쓴것 || {})['homeworkSets/AU_y5_2026_m09_w4/sets'];
    재기('돌 때 안 터진다', true);
    재기('서버에 다섯을 쓴다 (0개가 아니다)', Array.isArray(쓴) && 쓴.length === 5,
         '쓴 것 ' + JSON.stringify(쓴 && 쓴.length));
    재기('`ts` 는 안 건드린다', !Object.keys(S.쓴것 || {}).some(k => k.endsWith('/ts')),
         JSON.stringify(Object.keys(S.쓴것 || {})));
    재기('서랍도 다섯으로 맞는다',
         (S.서랍.homeworkSets['AU_y5_2026_m09_w4'].sets || []).length === 5);
    재기('서랍의 TS 48문항이 살아 있다',
         ((S.서랍.homeworkSets['AU_y5_2026_m09_w4'].ts || {}).questions || []).length === 48);
  } catch (e) { 재기('돌 때 안 터진다', false, e.constructor.name + ': ' + e.message); }

  console.log('\n── ⛔ 서버를 못 읽으면 **아무것도 쓰지 않는다**');
  S = 세상(서버칸(), 빈서랍(), true);
  try {
    await S.F.deleteSet(2);
    재기('한 글자도 안 썼다', S.쓴것 === null, JSON.stringify(S.쓴것));
    재기('까닭을 알린다', S.알림.some(m => m.includes('못 읽어')), JSON.stringify(S.알림));
  } catch (e) { 재기('못 읽어도 안 터진다', false, e.constructor.name + ': ' + e.message); }

  console.log('\n── 세트 옮기기 — 서랍을 두 개 들지 않는가');
  S = 세상(서버칸(), 빈서랍());
  try {
    await S.F.confirmMoveSet(0);
    const 쓴 = S.쓴것 || {};
    재기('돌 때 안 터진다', true);
    재기('보낸 칸은 다섯', (쓴['homeworkSets/AU_y5_2026_m09_w4/sets'] || []).length === 5);
    재기('받는 칸은 하나', (쓴['homeworkSets/AU_y5_2026_m10_w1/sets'] || []).length === 1);
    재기('`ts` 는 안 건드린다', !Object.keys(쓴).some(k => k.endsWith('/ts')));
    재기('⭐ 서랍도 서버와 같다 (사본이 안 갈렸다)',
         (S.서랍.homeworkSets['AU_y5_2026_m09_w4'].sets || []).length === 5 &&
         ((S.서랍.homeworkSets['AU_y5_2026_m10_w1'] || {}).sets || []).length === 1,
         '서랍 보낸칸 ' + (S.서랍.homeworkSets['AU_y5_2026_m09_w4'].sets || []).length +
         ' · 받는칸 ' + ((S.서랍.homeworkSets['AU_y5_2026_m10_w1'] || {}).sets || []).length);
    재기('서랍의 TS 48문항이 살아 있다',
         ((S.서랍.homeworkSets['AU_y5_2026_m09_w4'].ts || {}).questions || []).length === 48);
  } catch (e) { 재기('돌 때 안 터진다', false, e.constructor.name + ': ' + e.message); }

  console.log('\n── ⛔ 옮기기도 못 읽으면 안 쓴다');
  S = 세상(서버칸(), 빈서랍(), true);
  try {
    await S.F.confirmMoveSet(0);
    재기('한 글자도 안 썼다', S.쓴것 === null, JSON.stringify(S.쓴것));
  } catch (e) { 재기('못 읽어도 안 터진다', false, e.constructor.name + ': ' + e.message); }

  console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
  process.exit(실패 ? 1 : 0);
})();
