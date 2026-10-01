// 2-B 학생 화면 — 세션 받기 · 공통 조회 장치(hwViewFor) · 쓰기 문지기.
//
// [2026-10-01 원장 지시]
//   · 로그인할 때 새 세션을 받는다(학생·학부모). 마스터 = 보기만(제출 막음).
//   · 숙제는 **공통 조회 장치**를 거친다: 개인 배정이 있으면 그것 · 없을 때만 그룹 숙제.
//   · 비공개 → 「준비 중」 · 권한 거절·연결 실패 → 「연결 실패」 — ⛔ 그룹 숙제로 **바꿔 보여주지 않는다.**
//   · 풀이·제출·지난주·학부모 화면·리포트가 **같은 배정**을 본다.
//   · 세션이 끝났으면(12시간) 저장을 보내지 않고 다시 로그인을 부탁한다(쓰기 거절로 답을 잃지 않게).

'use strict';
const fs = require('fs');
const html = fs.readFileSync('E:/aa0/hp/index.html', 'utf8');
let 통과 = 0, 실패 = 0;
function 재기(이름, 참, 덧) {
  if (참) { 통과++; console.log('  ✅ ' + 이름); }
  else { 실패++; console.log('  ⛔ ' + 이름 + (덧 ? '\n       ' + 덧 : '')); }
}
function 떼기(시작, 끝표) {
  const i = html.indexOf(시작); if (i < 0) throw new Error('못 찾음: ' + 시작);
  const j = html.indexOf(끝표, i + 10); if (j < 0) throw new Error('끝 못 찾음: ' + 끝표);
  return html.slice(i, j);
}
const 장치소스 = 떼기('// ═══ [2-B] 공통 조회 장치 — 시작', '// ═══ [2-B] 공통 조회 장치 — 끝');

const P1 = { year: 2026, month: 10, week: 1 }, P2 = { year: 2026, month: 10, week: 2 }, P3 = { year: 2026, month: 10, week: 3 };
const 그룹칸 = (published) => ({ sets: [{ title: 'G1', questions: [] }], ...(published === false ? { published: false } : {}) });

function 세상({ 역할 = 'student', 캐시, 선생캐시, 그룹 = {}, 미리보기 = false, 세션 } = {}) {
  const w = { isPreviewMode: 미리보기, _prepSession: 세션 === undefined ? { sid: 'Mina', role: 역할, master: false, exp: Date.now() + 3600e3 } : 세션 };
  const store = { users: [{ id: 'Mina', role: 'student', year: 5, country: 'AU', group: '' }], homeworkSets: 그룹, submissions: {} };
  const hwKey = (y, c, p, g) => `${c}_y${y}${g ? '-' + g : ''}_${p.year}_m${String(p.month).padStart(2, '0')}_w${p.week}`;
  const 값 = {
    window: w,
    currentUser: { id: 역할 === 'teacher' ? 'T' : 'Mina', role: 역할 },
    hwLookup: (s, y, c, p, g) => s.homeworkSets[hwKey(y, c, p, g)],
    hwLookupKey: (s, y, c, p, g) => (s.homeworkSets[hwKey(y, c, p, g)] ? hwKey(y, c, p, g) : null),
    visibleHw: (hw) => (w.isPreviewMode ? hw || null : (!hw || hw.published === false ? null : hw)),
    callAuthWorker: async () => { throw new Error('안 불려야 함'); },
    console: { log() {}, warn() {}, info() {}, error() {} },
  };
  const 이름 = Object.keys(값);
  const F = new Function(...이름, 장치소스 + '\n; return { hwViewFor, samePeriod, _prepCacheFor, _prepAssignBySid: () => _prepAssignBySid, _setPrepCache, _setTeacherCache, prepSessionState };')(...이름.map(k => 값[k]));
  if (캐시) F._setPrepCache('Mina', 캐시);
  if (선생캐시) F._setTeacherCache(선생캐시);
  return { F, store, w };
}
const 개인목록 = (extra) => Object.assign({ status: 'ok', list: [{ assignmentId: 'A1', period: P1, title: '민아 개인', sets: [{ setId: 's1', title: 'S1', n: 2 }], mine: {} }],
  hidden: [{ assignmentId: 'A2', period: P2 }] }, extra || {});

console.log('── ① 공통 조회 장치 — 학생');
{
  const 그룹 = { AU_y5_2026_m10_w1: 그룹칸(), AU_y5_2026_m10_w2: 그룹칸(), AU_y5_2026_m10_w3: 그룹칸() };
  const { F, store } = 세상({ 캐시: 개인목록(), 그룹 });
  const u = store.users[0];
  const v1 = F.hwViewFor(store, u, P1);
  재기('개인 배정이 있는 주 → personal (그룹이 있어도)', v1.kind === 'personal' && v1.assignmentId === 'A1', JSON.stringify(v1));
  const v2 = F.hwViewFor(store, u, P2);
  재기('개인 배정이 비공개인 주 → pending(준비 중) · 그룹으로 안 바꾼다', v2.kind === 'pending' && !v2.hw, JSON.stringify(v2));
  const v3 = F.hwViewFor(store, u, P3);
  재기('개인 배정이 없는 주 → 그룹 숙제', v3.kind === 'group' && v3.hw && v3.hwKey === 'AU_y5_2026_m10_w3', JSON.stringify(v3));
}
{
  const { F, store } = 세상({ 캐시: { status: 'error', error: 'network' }, 그룹: { AU_y5_2026_m10_w1: 그룹칸() } });
  const v = F.hwViewFor(store, store.users[0], P1);
  재기('조회 실패(연결) → error · ⛔ 그룹 숙제로 안 바꾼다', v.kind === 'error' && !v.hw, JSON.stringify(v));
}
{
  const { F, store } = 세상({ 캐시: { status: 'error', error: 'SESSION-EXPIRED' }, 그룹: { AU_y5_2026_m10_w1: 그룹칸() } });
  const v = F.hwViewFor(store, store.users[0], P1);
  재기('권한 거절(세션 만료) → error · 다시 로그인 안내', v.kind === 'error' && v.relogin === true, JSON.stringify(v));
}
{
  const { F, store } = 세상({ 캐시: undefined, 그룹: { AU_y5_2026_m10_w1: 그룹칸() } });
  const v = F.hwViewFor(store, store.users[0], P1);
  재기('아직 못 물어봄 → loading · 그룹으로 안 바꾼다', v.kind === 'loading' && !v.hw, JSON.stringify(v));
}
{
  const { F, store } = 세상({ 캐시: { status: 'none', list: [], hidden: [] }, 그룹: { AU_y5_2026_m10_w1: 그룹칸(false) } });
  const v = F.hwViewFor(store, store.users[0], P1);
  재기('그룹 숙제가 비공개 → pending(준비 중)', v.kind === 'pending', JSON.stringify(v));
  const v0 = F.hwViewFor(store, store.users[0], P2);
  재기('아무것도 없음 → none', v0.kind === 'none', JSON.stringify(v0));
}

console.log('\n── ② 교사·미리보기 — 교사 캐시로 같은 판정(실패면 그룹으로 보되 표시)');
{
  const 선생 = { status: 'ok', releases: { A1: { studentId: 'Mina', published: true, period: P1, title: '민아 개인', sets: { s1: { title: 'S1', questions: [{ id: 'q0', answer: 'B' }] } } },
                                         A2: { studentId: 'Mina', published: false, period: P2, sets: {} } }, subs: { A1: { Mina: { s1: { latest: 1, revs: { 1: { grade: { score: 50 } } } } } } } };
  const { F, store } = 세상({ 역할: 'teacher', 선생캐시: 선생, 그룹: { AU_y5_2026_m10_w1: 그룹칸() }, 세션: null });
  const v = F.hwViewFor(store, store.users[0], P1);
  재기('교사도 같은 학생·같은 주 → 같은 배정(A1)', v.kind === 'personal' && v.assignmentId === 'A1', JSON.stringify(v));
  재기('교사 캐시에서 학생의 점수(mine)를 만든다', v.assignment.mine.s1 && v.assignment.mine.s1.latest === 1 && v.assignment.mine.s1.score === 50, JSON.stringify(v.assignment.mine));
  재기('교사: 비공개 주 → pending', F.hwViewFor(store, store.users[0], P2).kind === 'pending');
}
{
  const { F, store } = 세상({ 역할: 'teacher', 선생캐시: { status: 'error' }, 그룹: { AU_y5_2026_m10_w1: 그룹칸() }, 세션: null });
  const v = F.hwViewFor(store, store.users[0], P1);
  재기('교사 캐시 실패 → 그룹으로 보되 personalUnknown 표시', v.kind === 'group' && v.personalUnknown === true, JSON.stringify(v));
}

console.log('\n── ③ 세션 상태');
{
  재기('세션 있음 → ok', 세상({}).F.prepSessionState() === 'ok');
  재기('마스터 → master', 세상({ 세션: { sid: 'Mina', role: 'student', master: true, exp: Date.now() + 1e6 } }).F.prepSessionState() === 'master');
  재기('만료 → expired', 세상({ 세션: { sid: 'Mina', role: 'student', master: false, exp: Date.now() - 1 } }).F.prepSessionState() === 'expired');
  재기('없음 → none', 세상({ 세션: null }).F.prepSessionState() === 'none');
  { const z = 세상({ 세션: null }); z.w._legacyMaster = true; 재기('[2-B 추가] 세션 없이 들어온 마스터 → master(보기 전용)', z.F.prepSessionState() === 'master'); }
  { const z = 세상({ 세션: null }); z.F._setPrepCache('Mina', { status: 'none', list: [], hidden: [], legacy: true });
    const zv = z.F.hwViewFor({ users: [], homeworkSets: { AU_y5_2026_m10_w1: 그룹칸() }, submissions: {} }, { id: 'Mina', year: 5, country: 'AU', group: '' }, P1);
    재기('[2-B 추가] 옛 방식(세션 없음)이면 그룹 숙제가 보인다', zv.kind === 'group', JSON.stringify(zv)); }
}

console.log('\n── ④ 로그인·로그아웃·쓰기 문지기·제출이 장치와 세션을 쓴다(글자로 확인)');
const 로그인 = 떼기('async function doLogin() {', '\nfunction doLogout');
재기('로그인: 학생·학부모는 prepStartSession 을 부른다', /callAuthWorker\('prepStartSession'/.test(로그인));
재기('로그인: 세션 뒤 토큰을 새로 받는다(getIdToken(true))', /getIdToken\(true\)/.test(로그인));
// [2-B 추가 · 원장 지시] 세션을 못 받으면 — 막기 칸이 꺼져 있으면 경고만 하고 옛 방식으로 들여보내고, 켜져 있으면 막는다.
재기('로그인: 막기 칸(submitLock)을 읽는다', /_readSubmitLock\(\)/.test(로그인));
재기('로그인: 세션 실패 + 칸 켜짐 → 막는다(return)', /if \(_lockOn\)\s*\{[\s\S]{0,400}return;/.test(로그인));
재기('로그인: 세션 실패 + 칸 꺼짐 → 경고만 하고 들여보낸다(옛 방식)', /_prepLegacy = true[\s\S]{0,400}showBackupToast\(/.test(로그인));
재기('로그인: 옛 방식이면 배정 목록을 묻지 않고 「개인 배정 없음」으로 둔다(그룹 숙제가 보이게)', /legacy: true/.test(로그인));
재기('로그인: 옛 방식이어도 마스터는 보기 전용(loginCheck 의 isMaster)', /_legacyMaster = isMasterLogin/.test(로그인));
재기('로그인: 학생·학부모는 배정 목록을 먼저 받아 둔다', /await prepLoadAssignments\(/.test(로그인));
재기('로그인: 교사는 교사 캐시를 받아 둔다', /prepLoadTeacher\(/.test(로그인));
재기('로그아웃: 세션을 끝낸다', /prepEndSessionClient\(\)/.test(떼기('function doLogout() {', '\n}\n')));
const 문지기 = 떼기('function fbWrite(updates, onSuccess) {', '\n// ★★★ [R-0');
재기('fbWrite: 마스터 세션이면 안 보낸다', /prepSessionState\(\)[\s\S]{0,80}'master'[\s\S]{0,200}return;/.test(문지기));
재기('fbWrite: 학생 세션이 끝났으면 안 보내고 줄에 넣는다', /'expired'[\s\S]{0,400}_addToRetryQueue\(updates\)/.test(문지기));
// [2-B 추가] 마스터 화면에서 누른 답이 **이 기기 서랍에도** 남지 않게 — 같은 기기로 아이가 들어오면
//   그 답이 아이 답으로 보이고(객관식은 바꿀 수 없다) 제출 때 서버로 간다(브라우저 시험 실측).
const 객관식 = 떼기('function answerMC(qid, letter, btnEl) {', '\n}\n');
const 주관식 = 떼기('function answerSA(qid, val) {', '\n}\n');
const 저장답 = 떼기('function saveAnswer(qid, val) {', '\n}\n');
재기('answerMC: 마스터면 답을 안 받는다', /prepSessionState\(\) === 'master'[\s\S]{0,120}return;/.test(객관식));
재기('answerSA: 마스터면 답을 안 받는다', /prepSessionState\(\) === 'master'[\s\S]{0,120}return;/.test(주관식));
재기('saveAnswer: 마스터면 서랍에도 안 쓴다', /prepSessionState\(\) === 'master'[\s\S]{0,120}return;/.test(저장답));
const 제출 = 떼기('function doSubmit() {', '\n// ═══ [1단계] 약점 반영 — 시작');
재기('doSubmit: 마스터는 제출 못 한다', /prepSessionState\(\)\s*===\s*'master'/.test(제출));

console.log('\n── ⑤ 같은 배정 — 학생 홈·지난주·학부모·리포트·교사 표가 장치를 거친다');
const 쓰는곳 = {
  '학생 홈(renderStudent)': 떼기('function renderStudent() {', '\nfunction '),
  '학부모 화면(renderParent)': 떼기('function renderParent() {', '\nfunction '),
  '리포트(buildReportDataForStudent)': 떼기('function buildReportDataForStudent(studentId, period, store) {', '\nfunction '),
  '교사 표(renderTeacher)': 떼기('function renderTeacher() {', '\nfunction '),
};
for (const [k, v] of Object.entries(쓰는곳)) 재기(k + ' 가 hwViewFor 를 부른다', /hwViewFor\(/.test(v));
재기('지난주 이동(navigateStudentPeriod)은 renderStudent 로 다시 그린다(같은 장치)', /renderStudent\(\)/.test(떼기('function navigateStudentPeriod(dir) {', '\n}\n')));

console.log('\n── ⑥ 다시 보내기 줄 — 로그인 전에는 버리지 않는다');
{
  const 줄소스 = 떼기('async function _flushRetryQueue() {', '\n// ── Firebase Granular Write Helpers');
  재기('로그인 전(currentUser 없음)에는 줄을 그대로 둔다', /if \(!currentUser\) return;/.test(줄소스));
  const 로그인2 = 떼기('async function doLogin() {', '\nfunction doLogout');
  재기('학생 로그인 뒤 줄을 다시 보낸다(그다음 약점)', /_flushRetryQueue\(\)\s*\.then\(\(\)\s*=>\s*_weaknessFlush\(\)\)/.test(로그인2));
}

console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
process.exit(실패 ? 1 : 0);
