// ts_approval.js — TS 숙제 **승인**. (계획서 v5 §3 · 지시서 v6 §11)
//
//   approveTsAssignment(requestId, revision, hash)   초안을 실제 숙제 칸에 올린다
//   unlockTsAssignment(칸)                            한 번도 공개된 적 없을 때만 되돌린다
//   onTsPublished                                     공개되면 `everPublished` 를 세운다
//
// ⛔⛔ 지키는 선
//   · 여기는 **admin SDK** 다 — 보안 규칙을 지나간다. 그러니 **스스로 다 확인해야 한다.**
//     규칙이 막아 줄 거라 믿고 빠뜨리면 아무도 안 막는다.
//   · 부르는 이가 **원장 uid** 가 아니면 아무것도 하지 않는다.
//   · **멱등** — 같은 `requestId` 로 몇 번을 불러도 결과가 하나다. 두 번 눌러도,
//     응답이 유실돼 다시 불러도, 중간에 죽었다 살아나도 같다.
//   · 「했다」는 **다시 읽어 해시가 맞은 것**만. 못 읽었으면 잠금을 **그대로 두고**
//     「확인 대기」로 남긴다 — 자동으로 풀지 않는다(푸는 순간 두 번 쓸 수 있다).
//   · 수학(`sets`·`published`)은 **한 글자도 안 건드린다.**
//
// 배포 (원장님 「하라」 뒤 · 조용한 시간):
//   firebase deploy --only functions:approveTsAssignment,functions:unlockTsAssignment,functions:onTsPublished
//   ⚠️ 배포 직후 `loginCheck` 를 시험 학생으로 한 번 불러 볼 것 —
//      로그인 함수 일곱이 **같은 codebase** 에 산다.

'use strict';
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onValueUpdated } = require('firebase-functions/v2/database');
const admin = require('firebase-admin');
const H = require('./ts_hash');

if (!admin.apps.length) {
  admin.initializeApp({
    databaseURL: 'https://solomon-76715-default-rtdb.asia-southeast1.firebasedatabase.app'
  });
}

const OPERATOR_UID = '62bxWubzDLMrhHjjv2oNfAQiyaD2';   // index.html:3397 과 같아야 한다
const 뿌리 = 'solomon_hw_v3';
const OPS = 'sol_v4/ops';
const 지역 = 'australia-southeast1';          // 부르는 함수(onCall) — 기존 함수들과 같은 곳
const DB_INSTANCE = 'solomon-76715-default-rtdb';
// ⛔ 자료판 트리거는 **데이터베이스가 사는 지역**에 세워야 한다.
//    `australia-southeast1` 로 세우려다 막혔다(2026-09-19):
//      cannot create a trigger in region australia-southeast1 (not yet revealed)
//    우리 RTDB 주소가 `…asia-southeast1.firebasedatabase.app` 이다.
const 트리거지역 = 'asia-southeast1';

const db = () => admin.database();
const 이제 = () => new Date().toISOString();

// ───────────────────────── 작은 도구 ─────────────────────────
function 원장인가(req) {
  const uid = req.auth && req.auth.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  if (uid !== OPERATOR_UID) throw new HttpsError('permission-denied', '원장님만 승인할 수 있습니다.');
  return uid;
}

async function 읽기(경로) {
  const s = await db().ref(경로).get();
  return s.exists() ? s.val() : null;
}

/** `AU_y4-션_2026_m09_w3` 꼴. index.html:3869 `hwKey` 와 **같아야 한다.** */
function 칸이름(year, country, p, group) {
  const g = (group && group !== '') ? ('-' + group) : '';
  return `${country}_y${year}${g}_${p.year}_m${String(p.month).padStart(2, '0')}_w${p.week}`;
}
const 칸무늬 = /^([A-Z]{2})_y(\d+)(?:-(.+))?_(\d{4})_m(\d{2})_w(\d+)$/;
function 칸풀기(key) {
  const m = 칸무늬.exec(key || '');
  if (!m) return null;
  return { country: m[1], year: +m[2], group: m[3] || '',
           period: { year: +m[4], month: +m[5], week: +m[6] } };
}
/** `2026_m09_w4` → {year, month, week} */
function 주차풀기(w) {
  const m = /^(\d{4})_m(\d{2})_w(\d+)$/.exec(w || '');
  return m ? { year: +m[1], month: +m[2], week: +m[3] } : null;
}

// ───────────────────────── ① 초안 검사 ─────────────────────────
/**
 * 초안이 **스스로 앞뒤가 맞는가**. 승인 전에 반드시 본다(계약.md §6).
 * ⛔ 「해시가 맞다」와 「내용이 온전하다」는 다른 것이다. 해시는 **바꿔치기**를 잡고,
 *    이 검사는 **처음부터 잘못 만들어진 것**을 잡는다. 둘 다 해야 한다.
 */
function 초안검사(draft) {
  const 탈 = [];
  const ts = (draft && draft.ts) || {};
  const dc = ts.day_config || {};
  const qs = ts.questions || [];
  const mf = (draft && draft.manifest) || [];

  const 양의정수 = v => Number.isInteger(v) && v > 0;
  if (!양의정수(dc.total_days)) 탈.push('일수가 양의 정수가 아닙니다: ' + dc.total_days);
  if (!양의정수(dc.questions_per_day)) 탈.push('하루 문항이 양의 정수가 아닙니다: ' + dc.questions_per_day);
  if (양의정수(dc.total_days) && 양의정수(dc.questions_per_day)) {
    const 있어야 = dc.total_days * dc.questions_per_day;
    if (qs.length !== 있어야) 탈.push(`문항 수가 ${qs.length} 인데 일수×하루문항 = ${있어야} 입니다`);
  }
  if (mf.length !== qs.length) 탈.push(`manifest ${mf.length}줄 ≠ 문항 ${qs.length}개`);

  const 본id = new Set();
  qs.forEach((q, i) => {
    const 어디 = `${i + 1}번 문항`;
    if (!q || typeof q !== 'object') { 탈.push(`${어디}이 비었습니다`); return; }
    if (!q._item_id) 탈.push(`${어디}에 문항 번호가 없습니다`);
    else if (본id.has(q._item_id)) 탈.push(`${어디}이 앞과 같은 문항입니다: ${q._item_id}`);
    else 본id.add(q._item_id);

    if (!q.text || !String(q.text).trim()) 탈.push(`${어디}에 지문이 없습니다`);
    const 보기 = q.options || [];
    if (보기.length < 2) 탈.push(`${어디}의 보기가 ${보기.length}개입니다`);
    if (보기.some(o => o === null || o === undefined || String(o).trim() === ''))
      탈.push(`${어디}에 빈 보기가 있습니다`);

    // 보기 차례 ↔ 정답 글자가 맞는가
    const 답 = String(q.answer || '');
    const 자리 = 답.charCodeAt(0) - 65;                 // 'A' → 0
    if (!/^[A-Z]$/.test(답)) 탈.push(`${어디}의 정답 글자가 이상합니다: ${q.answer}`);
    else if (자리 < 0 || 자리 >= 보기.length) 탈.push(`${어디}의 정답 ${답} 가 보기 ${보기.length}개 밖입니다`);
    const 지도 = q._label_to_id || {};
    if (!지도[답]) 탈.push(`${어디}의 _label_to_id 에 ${답} 가 없습니다`);
    if (Object.keys(지도).length !== 보기.length)
      탈.push(`${어디}의 _label_to_id ${Object.keys(지도).length}칸 ≠ 보기 ${보기.length}개`);

    // ⛔ 그림은 **파일 이름이 아니라 SVG 글자 그대로** 들어 있어야 한다.
    //    이름표(`§fig:…`)가 남아 있으면 학생 화면에 그림이 안 뜬다.
    const fig = String(q.figure || '');
    if (fig.startsWith('§fig:')) 탈.push(`${어디}의 그림이 이름표로 남아 있습니다`);

    const m = mf[i];
    if (m) {
      if (m.item_id && q._item_id && m.item_id !== q._item_id)
        탈.push(`${어디}: manifest 는 ${m.item_id} 인데 본문은 ${q._item_id} 입니다`);
      if (m.answer && m.answer !== 답)
        탈.push(`${어디}: manifest 정답 ${m.answer} ≠ 본문 ${답}`);
    }
  });
  return 탈;
}

// ───────────────────────── ② 자격판 ─────────────────────────
async function 자격판보기(draft) {
  const 벌 = draft.release;
  const e = 벌 ? await 읽기(`${OPS}/eligibility/${벌}`) : null;
  if (!e) return { 막힘: [], 기준: null, 있나: false };
  const blocked = new Set(e.blocked || []);
  const 막힘 = (draft.manifest || [])
    .map(m => m && m.item_id).filter(id => id && blocked.has(id));
  return { 막힘, 기준: e['동기화시각'] || e['만든시각'] || null, 있나: true };
}

// ───────────────────────── ③ 수신자 유일성 ─────────────────────────
/**
 * **가상 저장 후** 이 칸을 보게 되는 학생이 정확히 그 아이 하나인가.
 * ⛔ 「지금」이 아니라 **「이 칸을 만든 뒤」**로 따져야 한다. 공통 칸을 새로 만들면
 *    반이 없는 다른 아이들도 그 칸을 보게 된다 — 만들기 전에는 안 보이던 일이다.
 */
async function 수신자확인(칸, 학생id) {
  const users = await 읽기(`${뿌리}/users`);
  const 있는칸 = await 읽기(`${뿌리}/homeworkSets`);   // 열쇠만 쓴다
  const 칸들 = new Set(Object.keys(있는칸 || {}));
  칸들.add(칸);                                        // 가상 저장

  const 풀 = 칸풀기(칸);
  if (!풀) return { ok: false, 까닭: `칸 이름을 못 읽습니다: ${칸}` };

  let us = users ? (Array.isArray(users) ? users : Object.values(users)) : [];
  us = us.filter(u => u && typeof u === 'object' && u.role === 'student' && u.id);
  const 본 = new Set(); const 하나씩 = [];
  for (const u of us) { if (본.has(u.id)) continue; 본.add(u.id); 하나씩.push(u); }

  const 받는이 = [];
  for (const u of 하나씩) {
    if (+u.year !== 풀.year) continue;
    const c = u.country || 'AU';
    if (c !== 풀.country) continue;
    const g = (u.group || '').trim();
    const k1 = 칸이름(u.year, c, 풀.period, g);
    const k2 = g ? 칸이름(u.year, c, 풀.period, '') : null;
    const 본다 = 칸들.has(k1) ? k1 : (k2 && 칸들.has(k2) ? k2 : null);
    if (본다 === 칸) 받는이.push(u);
  }

  const 운영 = 받는이.filter(u => u.status !== 'inactive' && !u.isTest).map(u => u.id);
  const 시험 = 받는이.filter(u => u.isTest).map(u => u.id);
  const 대상 = 하나씩.find(u => u.id === 학생id);
  const 시험학생 = !!(대상 && 대상.isTest);
  const 재는것 = 시험학생 ? 시험 : 운영;

  if (재는것.length === 1 && 재는것[0] === 학생id) return { ok: true, 받는이: 재는것 };
  return {
    ok: false,
    받는이: 재는것,
    까닭: 재는것.length === 0
      ? `이 칸을 볼 학생이 없습니다(${학생id} 가 이 칸을 안 봅니다)`
      : `이 칸을 ${재는것.length}명이 봅니다: ${재는것.join(', ')}`
  };
}

// ───────────────────────── 승인 ─────────────────────────
exports.approveTsAssignment = onCall({ region: 지역 }, async (req) => {
  const uid = 원장인가(req);
  const { requestId, revision, hash } = req.data || {};
  if (!requestId || revision === undefined || !hash)
    throw new HttpsError('invalid-argument', 'requestId · revision · hash 가 필요합니다.');

  const 승인칸 = `${OPS}/approval/${requestId}`;

  // ── 0. 멱등 — 같은 부탁이면 하던 자리에서 이어 간다
  const 옛 = await 읽기(승인칸);
  if (옛) {
    if (옛.revision !== revision || 옛['해시'] !== hash)
      return { 결과: '막힘', 까닭: '초안이 바뀌었습니다. 화면을 새로 고치고 다시 보십시오.',
               서버판: 옛.revision, 서버해시: 옛['해시'] };
    if (옛['상태'] === 'verified')
      return { 결과: 'ok', 칸: 옛['칸'], 서버해시: 옛['서버해시'], 이미: true,
               까닭: '이미 승인돼 있습니다.' };
    // `written`(확인 대기) · `reserving`(하다 말았다) 은 아래에서 이어 간다
  }

  // ── 1. 초안 읽기 · 해시 대조 · 필드 검사
  const draft = await 읽기(`${OPS}/draft/${requestId}`);
  if (!draft) throw new HttpsError('not-found', `초안이 없습니다: ${requestId}`);
  if (draft.revision !== revision)
    return { 결과: '막힘', 까닭: `초안 판이 다릅니다 — 화면 ${revision} · 서버 ${draft.revision}` };

  const meta = { subject: draft.subject || 'TS', student: draft.student,
                 배정주차: draft['배정주차'], 칸: draft['칸'],
                 revision: draft.revision, release: draft.release };
  const 셈한해시 = H.sha(H.묶음만들기(meta, draft.ts));
  if (셈한해시 !== hash)
    return { 결과: '막힘', 까닭: '화면이 보낸 해시가 초안 본문과 다릅니다.',
             서버해시: 셈한해시 };
  if (draft.sha && draft.sha !== 셈한해시)
    return { 결과: '막힘', 까닭: '초안에 적힌 해시가 본문과 다릅니다(본문이 바뀐 듯합니다).',
             서버해시: 셈한해시, 초안해시: draft.sha };

  const 탈 = 초안검사(draft);
  if (탈.length) return { 결과: '막힘', 까닭: '초안 검사에서 걸렸습니다.', 걸린것: 탈 };

  // ── 2. 자격판
  const 자격 = await 자격판보기(draft);
  if (자격.막힘.length)
    return { 결과: '막힘', 까닭: '검수가 취소된 문항이 들어 있습니다.', 막힌문항: 자격.막힘,
             자격판기준: 자격.기준 };

  // ── 3. 칸 · 수신자 유일성
  const 칸 = draft['칸'];
  const 학생 = draft.student;
  const 주차 = draft['배정주차'];
  if (!칸 || !학생 || !주차)
    return { 결과: '막힘', 까닭: '초안에 칸·학생·주차가 없습니다.' };
  const 수신 = await 수신자확인(칸, 학생);
  if (!수신.ok) return { 결과: '막힘', 까닭: 수신.까닭, 받는이: 수신.받는이 };

  // ── 4. 잠금 (transaction) — 둘 다 비었거나 **내 것**일 때만
  const 반잠금 = `${OPS}/lock/${칸}`;
  const 아이잠금 = `${OPS}/lock_sw/${학생}_TS_${주차}`;
  const 잠금값 = { subject: 'TS', 학생, 주차, requestId, 상태: 'reserving', 시각: 이제() };

  const 잡기 = async (경로) => {
    const r = await db().ref(경로).transaction(cur => {
      if (cur === null) return 잠금값;                 // 비었으면 잡는다
      if (cur.requestId === requestId) return cur;     // 내 것이면 그대로 이어 간다
      return;                                          // 남의 것 — 손대지 않는다
    });
    return { 됐나: r.committed || (r.snapshot.val() || {}).requestId === requestId,
             값: r.snapshot.val() };
  };
  const a = await 잡기(반잠금);
  if (!a.됐나) return { 결과: '막힘', 까닭: `이 칸은 이미 잠겨 있습니다(${(a.값 || {}).학생 || '?'}).` };
  const b = await 잡기(아이잠금);
  if (!b.됐나) {
    // ⛔ 앞의 잠금은 **내가 방금 잡은 것일 때만** 되돌린다. 남의 것을 풀면 안 된다.
    if ((a.값 || {}).requestId === requestId && (a.값 || {})['상태'] === 'reserving')
      await db().ref(반잠금).remove();
    return { 결과: '막힘', 까닭: '이 아이의 이 주차는 이미 잠겨 있습니다.' };
  }
  await db().ref(승인칸).update({
    revision, 해시: hash, 칸, 학생, 주차, 상태: 'reserving', 승인자: uid, 시각: 이제()
  });

  // ── 5. 저장 직전 재검사 — 여기서 막으면 **되돌릴 수 있다**(아직 `ts` 를 안 썼다)
  const 되돌리기 = async (까닭) => {
    await db().ref(반잠금).remove();
    await db().ref(아이잠금).remove();
    await db().ref(승인칸).update({ 상태: 'failed', 까닭, 시각: 이제() });
    return { 결과: '막힘', 까닭 };
  };
  const 답 = await 읽기(`${뿌리}/submissions/ts_${학생}_${주차}`);
  if (답) return 되돌리기('이 주차에 이미 아이가 낸 답이 있습니다. 덮어쓰지 않습니다.');
  const 지금ts = await 읽기(`${뿌리}/homeworkSets/${칸}/ts`);
  if (지금ts) return 되돌리기('이 칸에 이미 TS 숙제가 들어 있습니다. 덮어쓰지 않습니다.');
  const 옛배정 = await 읽기(`${OPS}/assigned/${학생}/${주차}/current`);
  if (옛배정 && 옛배정.everPublished)
    return 되돌리기('이미 공개된 적 있는 배정이 있습니다.');

  // ── 6. 한 번의 update — 하나라도 막히면 다 막힌다(그게 맞다)
  const 칸값 = await 읽기(`${뿌리}/homeworkSets/${칸}`);
  const 풀 = 칸풀기(칸);
  const assignmentId = `${requestId}_r${revision}`;
  const 공개상태 = 칸값 ? 칸값.published : undefined;
  const everPublished = 공개상태 !== false && 공개상태 !== undefined ? !!공개상태 : false;

  const 묶음 = {};
  묶음[`${뿌리}/homeworkSets/${칸}/ts`] = draft.ts;
  if (!칸값) {                                          // 칸이 없으면 뼈대만 세운다
    묶음[`${뿌리}/homeworkSets/${칸}/year`] = 풀.year;
    묶음[`${뿌리}/homeworkSets/${칸}/country`] = 풀.country;
    묶음[`${뿌리}/homeworkSets/${칸}/period`] = 풀.period;
    if (풀.group) 묶음[`${뿌리}/homeworkSets/${칸}/group`] = 풀.group;
    // ⛔ `sets` 와 `published` 는 **만들지 않는다** — 수학의 것이다.
  }
  묶음[`${OPS}/approval/${requestId}/상태`] = 'written';
  묶음[`${OPS}/approval/${requestId}/assignmentId`] = assignmentId;
  묶음[`${OPS}/approval/${requestId}/쓴시각`] = 이제();
  묶음[`${반잠금}/상태`] = 'written';
  묶음[`${아이잠금}/상태`] = 'written';
  묶음[`${OPS}/assigned/${학생}/${주차}/${assignmentId}`] = {
    칸, revision, release: draft.release, requestId,
    manifest: draft.manifest || [],
    day_config: (draft.ts || {}).day_config || {},
    sha: 셈한해시, everPublished, 승인자: uid, 시각: 이제()
  };
  묶음[`${OPS}/assigned/${학생}/${주차}/current`] = {
    assignmentId, 칸, revision, sha: 셈한해시, everPublished, 시각: 이제()
  };

  try {
    await db().ref().update(묶음);
  } catch (e) {
    // ⛔ 여기서 잠금을 풀면 **두 번 쓸 수 있다.** 썼는지 안 썼는지 모르는 채로 풀면 안 된다.
    //    그대로 두고 「확인 대기」로 남긴다 — 다음 호출이 7 부터 다시 한다.
    await db().ref(승인칸).update({ 상태: 'written', 까닭: '쓰기 중 오류: ' + (e.code || e.message), 시각: 이제() });
    return { 결과: '확인대기', 칸, 까닭: '저장이 끝났는지 확인하지 못했습니다. 다시 눌러 주십시오.' };
  }

  // ── 7. 다시 읽어 대조 — 「했다」는 이것뿐이다
  return await 확인(requestId, 칸, 학생, 주차, 셈한해시, meta);
});

/** 서버에 실제로 들어간 것을 **다시 읽어** 해시가 맞는지 본다. */
async function 확인(requestId, 칸, 학생, 주차, 바란해시, meta) {
  let 서버ts;
  try {
    서버ts = await 읽기(`${뿌리}/homeworkSets/${칸}/ts`);
  } catch (e) {
    await db().ref(`${OPS}/approval/${requestId}`).update({
      상태: 'written', 까닭: '확인 읽기 실패: ' + (e.code || e.message), 시각: 이제() });
    return { 결과: '확인대기', 칸, 까닭: '저장 뒤 확인 읽기에 실패했습니다. 다시 눌러 주십시오.' };
  }
  const 서버해시 = 서버ts ? H.sha(H.묶음만들기(meta, 서버ts)) : null;
  if (서버해시 !== 바란해시) {
    await db().ref(`${OPS}/approval/${requestId}`).update({
      상태: 'written', 서버해시, 까닭: '확인 해시가 다릅니다', 시각: 이제() });
    return { 결과: '확인대기', 칸, 서버해시,
             까닭: '저장된 내용이 초안과 달라 보입니다. 잠금은 그대로 두었습니다.' };
  }
  const 공개 = await 읽기(`${뿌리}/homeworkSets/${칸}/published`);
  await db().ref(`${OPS}/approval/${requestId}`).update({
    상태: 'verified', 서버해시, 까닭: null, 확인시각: 이제() });
  await db().ref(`${OPS}/lock/${칸}/상태`).set('verified');
  await db().ref(`${OPS}/lock_sw/${학생}_TS_${주차}/상태`).set('verified');
  return { 결과: 'ok', 칸, 서버해시, 공개상태: 공개 === true ? '공개됨' : '비공개(수학 대기)' };
}

// ───────────────────────── 되돌리기 ─────────────────────────
exports.unlockTsAssignment = onCall({ region: 지역 }, async (req) => {
  원장인가(req);
  const 칸 = (req.data || {})['칸'];
  if (!칸) throw new HttpsError('invalid-argument', '칸이 필요합니다.');

  const 잠금 = await 읽기(`${OPS}/lock/${칸}`);
  if (!잠금) return { 결과: '막힘', 까닭: '이 칸은 잠겨 있지 않습니다.' };
  const { 학생, 주차, requestId } = 잠금;

  const cur = await 읽기(`${OPS}/assigned/${학생}/${주차}/current`);
  // ⛔ **한 번이라도 공개된 적 있으면 못 푼다.** 답이 0개여도 안 된다 —
  //    아이가 이미 보았을 수 있고, 본 것을 없던 일로 만들면 이력이 거짓이 된다.
  if (cur && cur.everPublished)
    return { 결과: '막힘', 까닭: '한 번이라도 공개된 배정은 되돌릴 수 없습니다.' };
  // 받침 — `everPublished` 는 트리거(`onTsPublished`)가 세운다. 트리거가 아직 없거나
  // 늦게 돌면 위의 문이 비어 있을 수 있으니, **지금 공개돼 있는지 직접 본다.**
  // ⛔ 이것만으로는 「공개했다가 되돌린 경우」를 못 잡는다 — 그건 트리거만 잡는다.
  const 지금공개 = await 읽기(`${뿌리}/homeworkSets/${칸}/published`);
  if (지금공개 === true)
    return { 결과: '막힘', 까닭: '지금 공개돼 있습니다. 먼저 공개를 내리십시오.' };
  const 답 = await 읽기(`${뿌리}/submissions/ts_${학생}_${주차}`);
  if (답) return { 결과: '막힘', 까닭: '아이가 낸 답이 있습니다.' };

  const 묶음 = {};
  묶음[`${뿌리}/homeworkSets/${칸}/ts`] = null;
  묶음[`${OPS}/lock/${칸}`] = null;
  묶음[`${OPS}/lock_sw/${학생}_TS_${주차}`] = null;
  묶음[`${OPS}/assigned/${학생}/${주차}/current`] = null;
  if (cur && cur.assignmentId) {
    묶음[`${OPS}/assigned/${학생}/${주차}/${cur.assignmentId}/취소`] =
      { 시각: 이제(), 까닭: '원장님이 되돌렸습니다' };
  }
  if (requestId) 묶음[`${OPS}/approval/${requestId}/상태`] = 'cancelled';
  await db().ref().update(묶음);
  return { 결과: 'ok', 칸, 까닭: '되돌렸습니다. 이력은 「취소」로 남습니다.' };
});

// ───────────────────────── 공개 트리거 ─────────────────────────
// `published` 가 true 로 바뀌고 그 칸이 잠겨 있으면 `everPublished` 를 세운다.
// ⛔ 이것이 세워진 뒤에는 `unlockTsAssignment` 가 거절한다 — 되돌릴 수 없는 선이다.
// ⛔ 자리표(`{…}`) 이름은 **영문·숫자만** 된다. `{칸}` 이라 썼다가 배포가 막혔다(2026-09-19):
//      expect Valid ID chars but got 칸
//    경로 자리표는 구글 Eventarc 가 읽는 것이라 우리 이름 규칙이 안 통한다.
exports.onTsPublished = onValueUpdated(
  { ref: '/solomon_hw_v3/homeworkSets/{hwKey}/published', instance: DB_INSTANCE, region: 트리거지역 },
  async (event) => {
    if (event.data.after.val() !== true) return;
    const 칸 = event.params.hwKey;
    const 잠금 = await 읽기(`${OPS}/lock/${칸}`);
    if (!잠금 || !잠금.학생 || !잠금.주차) return;
    await db().ref(`${OPS}/assigned/${잠금.학생}/${잠금.주차}/current/everPublished`).set(true);
    const cur = await 읽기(`${OPS}/assigned/${잠금.학생}/${잠금.주차}/current`);
    if (cur && cur.assignmentId) {
      await db().ref(`${OPS}/assigned/${잠금.학생}/${잠금.주차}/${cur.assignmentId}/everPublished`).set(true);
    }
  });

// 시험에서 쓴다(배포에는 영향 없다)
exports._속 = { 초안검사, 칸이름, 칸풀기, 주차풀기, 수신자확인 };
