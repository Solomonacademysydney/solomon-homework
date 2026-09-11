// ============================================================
// 솔로몬 계정 일꾼 (2026-09-11)
//
// 무엇을 하나
//   ① loginCheck            로그인 비번을 **서버가** 대조한다
//   ② changeMyPassword      아이가 **스스로** 비번을 바꾼다 (지금 비번을 확인한 뒤)
//   ③ migratePasswordsToVault  공책의 비번을 금고로 한 번 옮겨 적는다 (원장님만)
//
// 왜 짓나
//   공책(solomon_hw_v3/users)은 규칙이 `.read = auth != null` 이고 익명 로그인이
//   열려 있다 ⇒ **홈페이지를 연 사람이면 누구나 36명의 비번 자물쇠를 읽는다.**
//   게다가 그 자물쇠는 소금 없는 SHA-256 이라 비번이 단순하면 금방 풀린다.
//   금고(solomon_auth)는 읽기·쓰기가 **둘 다 막혀** 있고, 이 일꾼만 admin 으로 만진다.
//
//   그리고 규칙은 「위에서 한 번 열어 주면 아래에서 못 닫는다」 —
//   그래서 `users` 안의 pw 칸만 감추는 것은 **불가능**하고, 바깥 서랍으로 옮겨야 한다.
//
// ⛔⛔ 순서가 생명이다. 금고에 옮겨 적기 **전에** 공책에서 지우면 아무도 못 들어온다.
//     (1) 이 파일 배포        ← 아무도 안 부르니 무해
//     (2) migratePasswordsToVault 한 번 실행 (공책은 그대로 둔다)
//     (3) 홈페이지가 loginCheck / changeMyPassword 를 보게 고치고 확인
//     (4) **확인된 뒤에야** 공책에서 pw 칸을 지운다
//
//   (3) 까지는 두 길이 다 살아 있다 — 되돌리려면 홈페이지만 되돌리면 된다.
//
// 배포:
//   firebase deploy --only functions:loginCheck,functions:changeMyPassword,functions:migratePasswordsToVault
// ============================================================

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const crypto = require('crypto');

const REGION = 'australia-southeast1';
const OPERATOR_UID = '62bxWubzDLMrhHjjv2oNfAQiyaD2';

const VAULT = 'solomon_auth';            // 금고 — 규칙에서 읽기·쓰기 둘 다 false
const BOOK = 'solomon_hw_v3/users';      // 공책 — 지금은 누구나 읽는다

// 비번 맞히기(무차별 대입) 막기.
//   ⚠ 맞는 비번까지 막아야 의미가 있다 — 맞을 때까지 찍는 것을 막는 장치이므로
//     「틀린 횟수가 찼으면 옳은 비번이어도 그 시간 동안은 안 받는다」.
//   한 시간이 지나면 저절로 풀린다(열쇠에 시각이 들어 있어 새 칸이 생긴다).
const FAIL_LIMIT_PER_HOUR = 10;   // 아이디 하나가 한 시간에 틀릴 수 있는 횟수
const TRY_LIMIT_PER_DAY = 200;    // 브라우저 하나가 하루에 시도할 수 있는 횟수

// 새 비번의 최소 조건. 아이들이 쓰는 것이라 길이는 짧게 두되,
// 「아이디와 같은 것」과 「한 글자 되풀이(0000)」만은 막는다.
const MIN_PW_LEN = 4;

// ─────────────────────────────────────────────
// 자물쇠 다루기
//   옛 것 = 소금 없는 SHA-256 hex 64자 (공책에 들어 있는 것)
//   새 것 = `scrypt$<소금>$<자물쇠>`  — 소금이 있어 같은 비번이어도 사람마다 다르다
//   옛 것으로 로그인에 성공하면 **그 자리에서 새 것으로 바꿔 둔다**(upgrade-on-login).
// ─────────────────────────────────────────────
function sha256hex(s) {
  return crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');
}

function scryptHash(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = crypto.scryptSync(String(pw), salt, 64).toString('hex');
  return 'scrypt$' + salt + '$' + key;
}

// 길이가 다르면 timingSafeEqual 이 **던진다** — 먼저 길이를 본다.
function safeEq(a, b) {
  const A = Buffer.from(String(a), 'utf8');
  const B = Buffer.from(String(b), 'utf8');
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

// { ok, needsUpgrade } 를 돌려준다. needsUpgrade = 옛 자물쇠로 맞았다는 뜻.
function verifyPw(pw, stored) {
  if (!stored || !pw) return { ok: false, needsUpgrade: false };
  const s = String(stored);

  if (s.startsWith('scrypt$')) {
    const parts = s.split('$');
    if (parts.length !== 3) return { ok: false, needsUpgrade: false };
    const calc = crypto.scryptSync(String(pw), parts[1], 64).toString('hex');
    return { ok: safeEq(calc, parts[2]), needsUpgrade: false };
  }

  // 옛 방식
  return { ok: safeEq(sha256hex(pw), s), needsUpgrade: true };
}

// 시험용으로만 내보낸다(functions/auth.test.js). 일꾼 동작에는 쓰이지 않는다.
exports._internals = {
  sha256hex, scryptHash, safeEq, verifyPw,
  vaultKey: (r, i) => vaultKey(r, i),
  makePassword: () => makePassword(),
  words: () => PW_WORDS
};

function vaultKey(role, id) {
  // 아이디가 역할끼리 겹칠 수 있어 역할을 앞에 붙인다.
  // (2026-09-11 창고 실측: 겹치는 것은 `Jasper05` 한 건이고 그것은 같은 줄이 두 번
  //  들어간 **중복**이라 역할 충돌은 아니었다. 그래도 앞으로를 위해 갈라 둔다.)
  return String(role) + '__' + String(id);
}

// ─────────────────────────────────────────────
// 횟수 제한 — 기존 rate_limits 서랍을 같이 쓴다.
//   cleanupRateLimits 가 `key.split('_').pop()` 으로 날짜를 떼어 7일 뒤 치우므로
//   열쇠 **맨 뒤**가 날짜꼴이어야 한다. 아래 두 열쇠 모두 그 꼴을 지킨다.
// ─────────────────────────────────────────────
async function _bump(path, limit) {
  const res = await admin.database().ref(path).transaction((cur) => {
    const next = (cur || 0) + 1;
    if (next > limit) return;   // abort
    return next;
  });
  return res.committed;
}

function hourKey() {
  return new Date().toISOString().slice(0, 13);   // YYYY-MM-DDTHH
}

function dayKey() {
  return new Date().toISOString().slice(0, 10);   // YYYY-MM-DD
}

async function assertNotLocked(role, id) {
  const path = 'rate_limits/authfail_' + vaultKey(role, id) + '_' + hourKey();
  const snap = await admin.database().ref(path).once('value');
  if ((snap.val() || 0) >= FAIL_LIMIT_PER_HOUR) {
    throw new HttpsError('resource-exhausted', 'TOO-MANY-TRIES');
  }
}

async function noteFailure(role, id) {
  await _bump('rate_limits/authfail_' + vaultKey(role, id) + '_' + hourKey(), FAIL_LIMIT_PER_HOUR);
}

async function clearFailures(role, id) {
  await admin.database()
    .ref('rate_limits/authfail_' + vaultKey(role, id) + '_' + hourKey())
    .remove();
}

async function assertTryBudget(uid) {
  if (uid === OPERATOR_UID) return;
  if (!(await _bump('rate_limits/authtry_' + uid + '_' + dayKey(), TRY_LIMIT_PER_DAY))) {
    throw new HttpsError('resource-exhausted', 'TOO-MANY-TRIES');
  }
}

// ─────────────────────────────────────────────
// 금고에서 자물쇠 꺼내기
//   ⚠ 넘어가는 동안(위 순서 (2)~(4) 사이)에는 금고에 아직 없는 사람이 있을 수 있다.
//     그때는 공책을 본다. 공책을 볼 때마다 기록을 남겨 **언제 다 옮겨졌는지** 알 수 있게 한다.
// ─────────────────────────────────────────────
async function readStoredPw(role, id) {
  const db = admin.database();

  const v = await db.ref(VAULT + '/' + vaultKey(role, id)).once('value');
  if (v.exists() && v.val() && v.val().pw) {
    return { pw: v.val().pw, from: 'vault' };
  }

  // 아직 금고에 없다 → 공책
  const bookSnap = await db.ref(BOOK).once('value');
  const users = bookSnap.val() || [];
  const list = Array.isArray(users) ? users : Object.values(users);
  const u = list.find((x) => x && x.id === id && x.role === role);
  if (u && u.pw) {
    console.warn('[auth] 아직 공책을 보고 있다 — ' + vaultKey(role, id) + ' (옮겨 적기 전)');
    return { pw: u.pw, from: 'book' };
  }

  return { pw: null, from: null };
}

// [순서 4 · 2026-09-11] findBookSlot 은 지웠다 — 공책에 비번을 함께 쓰던 동안만 쓰던 것이고,
//   이제 아무도 안 부른다. (부르는 곳 0 인 것을 확인하고 지웠다.)

// ─────────────────────────────────────────────
// ① 로그인 대조
//    돌려주는 것은 **「맞다/아니다」뿐**이다. 사람 정보는 안 돌려준다 —
//    홈페이지는 공책을 이미 갖고 있으므로 그쪽에서 찾으면 된다.
//    (그래서 이 일꾼을 붙이는 데 홈페이지를 크게 안 고쳐도 된다.)
// ─────────────────────────────────────────────
exports.loginCheck = onCall({ region: REGION }, async (req) => {
  const uid = req.auth && req.auth.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'NO-AUTH');

  const id = String((req.data && req.data.id) || '').trim();
  const role = String((req.data && req.data.role) || '').trim();
  const pw = String((req.data && req.data.pw) || '');
  if (!id || !role || !pw) throw new HttpsError('invalid-argument', 'BAD-INPUT');

  await assertTryBudget(uid);
  await assertNotLocked(role, id);

  // 마스터 비번 — 원장님이 아이 ID 로 들어가 보실 때. 개별 비번 확인을 건너뛴다.
  //   ⛔ 교사 계정은 제외(원래 규칙 그대로).
  //   ★ 이것이 서버로 오면 **홈페이지 코드에 박힌 마스터 자물쇠를 지울 수 있다.**
  if (role !== 'teacher') {
    const m = await admin.database().ref(VAULT + '/_master').once('value');
    const masterPw = m.exists() && m.val() ? m.val().pw : null;
    if (masterPw && verifyPw(pw, masterPw).ok) {
      try {
        await admin.database().ref('master_login_logs').push({
          targetId: id,
          targetRole: role,
          via: 'loginCheck',
          timestamp: Date.now(),
          timestampISO: new Date().toISOString()
        });
      } catch (e) {
        console.warn('[auth] 마스터 로그인 기록 실패:', e && e.message);
      }
      return { ok: true, isMaster: true };
    }
  }

  const stored = await readStoredPw(role, id);
  if (!stored.pw) {
    await noteFailure(role, id);
    throw new HttpsError('permission-denied', 'BAD-LOGIN');
  }

  const r = verifyPw(pw, stored.pw);
  if (!r.ok) {
    await noteFailure(role, id);
    throw new HttpsError('permission-denied', 'BAD-LOGIN');
  }

  await clearFailures(role, id);

  // 옛 자물쇠로 맞았으면 이 참에 소금 있는 것으로 바꿔 금고에 넣어 둔다.
  // ⚠ 공책은 **안 건드린다** — 넘어가는 동안 옛 로그인 길이 아직 살아 있어야 한다.
  if (r.needsUpgrade) {
    try {
      await admin.database().ref(VAULT + '/' + vaultKey(role, id)).update({
        pw: scryptHash(pw),
        role: role,
        id: id,
        upgradedAt: new Date().toISOString()
      });
    } catch (e) {
      console.warn('[auth] 자물쇠 갈아 끼우기 실패(로그인은 통과):', e && e.message);
    }
  }

  return { ok: true, isMaster: false };
});

// ─────────────────────────────────────────────
// ② 아이가 스스로 비번 바꾸기
//    ⛔ 지금 비번을 반드시 함께 받는다. 그게 「이 사람이 본인이다」의 유일한 증거다
//       (서버는 아이를 익명으로만 알기 때문에 다른 증거가 없다).
// ─────────────────────────────────────────────
exports.changeMyPassword = onCall({ region: REGION }, async (req) => {
  const uid = req.auth && req.auth.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'NO-AUTH');

  const id = String((req.data && req.data.id) || '').trim();
  const role = String((req.data && req.data.role) || '').trim();
  const currentPw = String((req.data && req.data.currentPw) || '');
  const newPw = String((req.data && req.data.newPw) || '');

  if (!id || !role || !currentPw || !newPw) {
    throw new HttpsError('invalid-argument', 'BAD-INPUT');
  }
  if (newPw.length < MIN_PW_LEN) throw new HttpsError('invalid-argument', 'PW-TOO-SHORT');
  if (newPw.toLowerCase() === id.toLowerCase()) throw new HttpsError('invalid-argument', 'PW-IS-ID');
  if (new Set(newPw.split('')).size === 1) throw new HttpsError('invalid-argument', 'PW-TOO-SIMPLE');
  if (newPw === currentPw) throw new HttpsError('invalid-argument', 'PW-SAME');

  await assertTryBudget(uid);
  await assertNotLocked(role, id);

  const stored = await readStoredPw(role, id);
  if (!stored.pw) {
    await noteFailure(role, id);
    throw new HttpsError('permission-denied', 'BAD-LOGIN');
  }
  if (!verifyPw(currentPw, stored.pw).ok) {
    await noteFailure(role, id);
    throw new HttpsError('permission-denied', 'WRONG-CURRENT-PW');
  }
  await clearFailures(role, id);

  const db = admin.database();

  // ㉠ 금고 — 여기가 앞으로의 정본이다. 소금 있는 자물쇠로 넣는다.
  await db.ref(VAULT + '/' + vaultKey(role, id)).update({
    pw: scryptHash(newPw),
    role: role,
    id: id,
    changedAt: new Date().toISOString()
  });

  // ㉡ 공책 — [순서 4 · 2026-09-11] **더 이상 쓰지 않는다.**
  //    넘어가는 동안에는 여기에도 함께 썼다(홈페이지가 공책을 보고 로그인했으므로).
  //    이제 정본은 금고 하나뿐이다. 공책에 비번을 되돌려 놓으면 안 된다.

  return { ok: true };
});

// ─────────────────────────────────────────────
// ⑦ 원장님 비번 **셋을 한 번에** 바꾼다 (원장님만)
//
//   ⛔⛔ 왜 한 번에 해야 하나 — 원장님 비번은 **세 곳이 짝**이다.
//      ㉠ 홈페이지 로그인 (금고의 `teacher__<id>`)
//      ㉡ 마스터 비번    (금고의 `_master` · 아이 ID 로 들어가실 때)
//      ㉢ 파이어베이스 계정 (`<id>@solomon-academy.local` · **저장 권한**)
//      하나라도 어긋나면 **원장님이 아무것도 저장 못 하게 된다**(elevateToOperatorAuth 실패).
//      손으로 세 군데를 따로 하면 언젠가 반드시 어긋난다 ⇒ 한 통로로 묶는다.
//
//   ⚠️ 바꾼 뒤에는 **로그아웃하고 새 비번으로 다시 로그인**하셔야 한다 —
//      지금 열린 창은 옛 비번을 들고 있어(_operatorPwCache) 다음 권한 전환에서 실패한다.
// ─────────────────────────────────────────────
exports.setMasterAndOperatorPassword = onCall({ region: REGION }, async (req) => {
  const uid = req.auth && req.auth.uid;
  if (uid !== OPERATOR_UID) throw new HttpsError('permission-denied', 'OPERATOR-ONLY');

  const newPw = String((req.data && req.data.newPw) || '');
  // 파이어베이스 계정 비번은 6자 이상이어야 한다 — 셋을 같은 값으로 두려면 여기서 막아야 한다.
  if (newPw.length < 6) throw new HttpsError('invalid-argument', 'PW-TOO-SHORT-MIN-6');

  const db = admin.database();

  // 교사 줄을 공책에서 찾는다(이제 공책엔 비번이 없지만 id·role 은 있다).
  const snap = await db.ref(BOOK).once('value');
  const users = snap.val() || [];
  const list = Array.isArray(users) ? users : Object.values(users);
  const teacher = list.find((u) => u && u.role === 'teacher' && u.id);
  if (!teacher) throw new HttpsError('not-found', 'NO-TEACHER-ROW');

  const done = { firebaseAuth: false, master: false, homepageLogin: false };
  try {
    // ㉢ 을 먼저 — 여기가 제일 잘 실패한다(비번 규칙·계정 없음). 실패하면 나머지를 안 건드린다.
    await admin.auth().updateUser(OPERATOR_UID, { password: newPw });
    done.firebaseAuth = true;

    const hashed = scryptHash(newPw);
    const stamp = new Date().toISOString();
    await db.ref(VAULT + '/_master').update({ pw: hashed, changedAt: stamp });
    done.master = true;
    await db.ref(VAULT + '/' + vaultKey('teacher', teacher.id)).update({
      pw: hashed, role: 'teacher', id: teacher.id, changedAt: stamp
    });
    done.homepageLogin = true;
  } catch (e) {
    // ⛔ 어디까지 됐는지 **정확히** 돌려준다 — 반만 된 상태를 모르면 고칠 수가 없다.
    console.error('[auth] 원장 비번 세 곳 바꾸기 실패:', e && e.message);
    throw new HttpsError('internal',
      'PARTIAL:' + JSON.stringify(done) + ' — ' + (e && e.message ? e.message : 'unknown'));
  }

  return {
    ok: true,
    teacherId: teacher.id,
    changed: ['firebaseAuth', 'vault/_master', 'vault/teacher__' + teacher.id],
    nextStep: '로그아웃하고 새 비밀번호로 다시 로그인하세요'
  };
});

// ─────────────────────────────────────────────
// ⑥ 【순서 4】 공책에서 비번 칸을 지운다 (원장님만 · 되돌리기 어려움)
//
//   이것이 **㉠ (비번이 누구나 읽힌다) 를 실제로 막는 걸음**이다.
//   여기까지 오기 전에는 금고에 복사만 해 둔 것이라 공책에 그대로 남아 있었다.
//
//   ⛔⛔ **스스로 안전을 확인하고, 못 미더우면 거부한다.**
//      공책에 비번이 있는데 **금고에 짝이 없는 사람**이 하나라도 있으면 지우지 않는다.
//      그 사람은 지우는 순간 **영영 로그인 못 하게 되기 때문**이다.
//      (그런 사람이 생기는 길 = ④ 전에 만들어졌고 한 번도 로그인 안 한 계정.)
//      고치는 법 = `migratePasswordsToVault({dryRun:false})` 를 한 번 더 돌리면 채워진다.
//
//   ⚠️ 지운 뒤로는 **일꾼이 죽으면 아무도 로그인 못 한다.** 뒷길이 사라지기 때문이다.
//      그것이 이 걸음의 값이다 — 비번을 감추는 대신 일꾼에 기대게 된다.
// ─────────────────────────────────────────────
exports.dropBookPasswords = onCall({ region: REGION }, async (req) => {
  const uid = req.auth && req.auth.uid;
  if (uid !== OPERATOR_UID) throw new HttpsError('permission-denied', 'OPERATOR-ONLY');
  const dryRun = !!(req.data && req.data.dryRun);

  const db = admin.database();
  const [bookSnap, vaultSnap] = await Promise.all([
    db.ref(BOOK).once('value'),
    db.ref(VAULT).once('value')
  ]);
  const users = bookSnap.val() || [];
  const vault = vaultSnap.val() || {};
  const slots = Array.isArray(users)
    ? users.map((u, i) => [String(i), u])
    : Object.keys(users).map((k) => [k, users[k]]);

  const willDrop = [];
  const missing = [];
  for (const [slot, u] of slots) {
    if (!u || !u.pw) continue;                       // 이미 비번 칸이 없다
    if (!u.id || !u.role) { missing.push({ slot, id: u.id || '(없음)', role: u.role || '(없음)', why: '아이디나 역할이 비었다' }); continue; }
    const k = vaultKey(u.role, u.id);
    if (vault[k] && vault[k].pw) willDrop.push({ slot, id: u.id, role: u.role });
    else missing.push({ slot, id: u.id, role: u.role, why: '금고에 짝이 없다' });
  }

  if (missing.length) {
    // ⛔ 던지지 않고 돌려준다 — 원장님이 **누가 빠졌는지 눈으로 보셔야** 하기 때문이다.
    return {
      ok: false,
      refused: 'MISSING-IN-VAULT',
      missing,
      wouldDrop: willDrop.length,
      howToFix: 'migratePasswordsToVault({dryRun:false}) 를 한 번 더 돌린 뒤 다시 시도하세요'
    };
  }

  if (dryRun) {
    return { ok: true, dryRun: true, wouldDrop: willDrop.length, alreadyClean: slots.length - willDrop.length };
  }

  const updates = {};
  for (const w of willDrop) updates[w.slot + '/pw'] = null;
  if (Object.keys(updates).length) await db.ref(BOOK).update(updates);

  return { ok: true, dryRun: false, dropped: willDrop.length, at: new Date().toISOString() };
});

// ─────────────────────────────────────────────
// ⑤ 원장님이 한 사람의 비번을 **정해서** 바꾸기 (원장님만)
//
//   ⛔ 왜 필요한가 — 「🔑 PW」 단추는 원래 **공책에만** 썼다. 비번이 금고로 옮겨진
//      뒤로는 로그인이 금고를 먼저 보므로, 공책만 고치면 **바꿔도 안 먹는다.**
//      (2026-09-11 내가 만든 회귀다. 이 일꾼이 두 곳을 함께 고쳐 그것을 없앤다.)
//
//   role 은 안 주셔도 된다 — 공책에서 그 아이디를 찾아 정한다.
//   같은 아이디가 역할 둘로 있으면 어느 쪽인지 물어본다(멋대로 고르지 않는다).
//
//   ⛔ 교사 줄은 `allowTeacher: true` 를 함께 주셔야 바꾼다.
//      교사 비번은 **파이어베이스 계정 비번과 짝**이라, 한쪽만 바꾸면
//      원장 권한 전환(elevateToOperatorAuth)이 깨져 아무것도 저장 못 하게 된다.
// ─────────────────────────────────────────────
exports.setPasswordByOperator = onCall({ region: REGION }, async (req) => {
  const uid = req.auth && req.auth.uid;
  if (uid !== OPERATOR_UID) throw new HttpsError('permission-denied', 'OPERATOR-ONLY');

  const id = String((req.data && req.data.id) || '').trim();
  const newPw = String((req.data && req.data.newPw) || '');
  const wantRole = String((req.data && req.data.role) || '').trim();
  const allowTeacher = !!(req.data && req.data.allowTeacher);
  // mode: 'both'(기본) = 금고+공책 · 'vault' = 금고만.
  //   'vault' 는 **계정을 새로 만들 때** 쓴다 — 그때는 공책 쪽을 홈페이지가 이미 쓰고 있고,
  //   그 쓰기가 서버에 닿기 전이라 여기서 찾으면 「없는 아이디」가 되기 때문이다(경합).
  //   ⇒ 'vault' 는 공책을 보지 않으므로 순서에 매이지 않는다.
  const mode = String((req.data && req.data.mode) || 'both').trim();
  if (mode !== 'both' && mode !== 'vault') throw new HttpsError('invalid-argument', 'BAD-MODE');
  if (!id || !newPw) throw new HttpsError('invalid-argument', 'BAD-INPUT');

  const db = admin.database();

  if (mode === 'vault') {
    if (!wantRole) throw new HttpsError('invalid-argument', 'ROLE-REQUIRED');
    if (wantRole === 'teacher' && !allowTeacher) {
      throw new HttpsError('failed-precondition', 'TEACHER-NEEDS-CONFIRM');
    }
    await db.ref(VAULT + '/' + vaultKey(wantRole, id)).update({
      pw: scryptHash(newPw), role: wantRole, id: id, setByOperatorAt: new Date().toISOString()
    });
    return { ok: true, id, role: wantRole, mode: 'vault', rowsUpdated: 0 };
  }

  const snap = await db.ref(BOOK).once('value');
  const users = snap.val() || [];
  const slots = Array.isArray(users)
    ? users.map((u, i) => [String(i), u])
    : Object.keys(users).map((k) => [k, users[k]]);

  const hits = slots.filter(([, u]) => u && u.id === id && (!wantRole || u.role === wantRole));
  if (!hits.length) throw new HttpsError('not-found', 'NO-SUCH-ID');

  const roles = Array.from(new Set(hits.map(([, u]) => u.role)));
  if (roles.length > 1) {
    // 멋대로 고르지 않는다 — 어느 쪽인지 받아야 한다.
    throw new HttpsError('failed-precondition', 'AMBIGUOUS-ROLE:' + roles.join(','));
  }

  const role = roles[0];
  const name = (hits[0][1] && hits[0][1].name) || '';
  if (role === 'teacher' && !allowTeacher) {
    throw new HttpsError('failed-precondition', 'TEACHER-NEEDS-CONFIRM');
  }

  const stamp = new Date().toISOString();
  await db.ref(VAULT + '/' + vaultKey(role, id)).update({
    pw: scryptHash(newPw), role: role, id: id, setByOperatorAt: stamp
  });

  // [순서 4 · 2026-09-11] 공책에는 **더 이상 쓰지 않는다.** 정본은 금고 하나다.
  //   `mode:'both'` 라는 이름은 「공책에서 찾아서 역할을 정한다」는 뜻으로만 남는다.

  return { ok: true, id, role, name, rowsUpdated: hits.length, shortPw: newPw.length < 4 };
});

// ─────────────────────────────────────────────
// ④ 아이들 비번을 한 번에 새로 깔기 (원장님만)
//
//   왜 —  공책이 넉 달간 열려 있었다. 그 사이에 누가 베껴 갔다면 **옛 비번은 이미
//         나가 있고, 공책에서 지운다고 주워 담아지지 않는다.** 한 번 갈아 끼워야
//         그 유출이 죽는다. 갈아 끼운 뒤에는 아이가 스스로 자기 것으로 바꾸면 된다.
//
//   ⛔⛔ **교사(원장) 줄은 절대 건드리지 않는다.** 원장님 비번은 파이어베이스 계정
//        비번과 **짝을 맞춰 두어야** 하고(elevateToOperatorAuth), 여기서 바꾸면
//        그 짝이 깨져 원장님이 아무것도 저장 못 하게 된다.
//
//   dryRun: true 로 먼저 **누가 바뀌는지만** 보고 실행할 것(그때는 비번을 안 만든다).
// ─────────────────────────────────────────────
const PW_WORDS = [
  'apple', 'bear', 'bird', 'boat', 'book', 'bread', 'bridge', 'brush', 'candle', 'cloud',
  'coral', 'corn', 'crayon', 'daisy', 'dolphin', 'dragon', 'drum', 'eagle', 'feather', 'forest',
  'garden', 'giraffe', 'grape', 'green', 'guitar', 'hammer', 'honey', 'island', 'jacket', 'jelly',
  'kangaroo', 'kite', 'koala', 'ladder', 'lemon', 'lion', 'lotus', 'magnet', 'mango', 'maple',
  'marble', 'melon', 'mirror', 'monkey', 'moon', 'mountain', 'muffin', 'noodle', 'ocean', 'olive',
  'orange', 'panda', 'paper', 'peach', 'pencil', 'penguin', 'piano', 'pillow', 'planet', 'pocket',
  'puppy', 'rabbit', 'rainbow', 'river', 'robot', 'rocket', 'salad', 'silver', 'socks', 'spoon',
  'star', 'summer', 'sunset', 'tiger', 'tomato', 'towel', 'train', 'turtle', 'violet', 'walnut',
  'whale', 'window', 'winter', 'yellow', 'yogurt', 'zebra'
];

// 낱말 하나 + 숫자 셋. 아이가 칠 수 있을 만큼 짧고, 찍어 맞히기는 시간당 10번으로 막혀 있다.
// ⛔ 열쇠는 crypto 로 뽑는다 — Math.random 은 골라내기 쉬워 비번에 쓰면 안 된다.
function makePassword() {
  const w = PW_WORDS[crypto.randomInt(PW_WORDS.length)];
  const n = String(crypto.randomInt(100, 1000));
  return w + n;
}

exports.resetPasswordsBulk = onCall({ region: REGION }, async (req) => {
  const uid = req.auth && req.auth.uid;
  if (uid !== OPERATOR_UID) throw new HttpsError('permission-denied', 'OPERATOR-ONLY');

  const dryRun = !!(req.data && req.data.dryRun);
  const roles = (req.data && Array.isArray(req.data.roles) && req.data.roles.length)
    ? req.data.roles
    : ['student', 'parent'];
  if (roles.indexOf('teacher') !== -1) {
    throw new HttpsError('invalid-argument', 'TEACHER-NOT-ALLOWED');
  }
  // 아이디를 대면 그 사람들만 바꾼다(없으면 roles 에 해당하는 사람 전부).
  const onlyIds = (req.data && Array.isArray(req.data.onlyIds)) ? req.data.onlyIds : null;

  const db = admin.database();
  const snap = await db.ref(BOOK).once('value');
  const users = snap.val() || [];
  const isArray = Array.isArray(users);
  const slots = isArray
    ? users.map((u, i) => [String(i), u])
    : Object.keys(users).map((k) => [k, users[k]]);

  const targets = [];
  const seen = new Set();
  for (const [slot, u] of slots) {
    if (!u || !u.id || !u.role) continue;
    if (u.role === 'teacher') continue;                  // ⛔ 절대 제외
    if (roles.indexOf(u.role) === -1) continue;
    if (onlyIds && onlyIds.indexOf(u.id) === -1) continue;
    const k = vaultKey(u.role, u.id);
    if (seen.has(k)) continue;                           // 공책의 중복 줄은 한 번만
    seen.add(k);
    targets.push({ slot, key: k, id: u.id, name: u.name || '', role: u.role, status: u.status || '' });
  }

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      wouldChange: targets.length,
      people: targets.map((t) => ({ id: t.id, name: t.name, role: t.role, status: t.status }))
    };
  }

  const vaultUpdates = {};
  const out = [];
  const stamp = new Date().toISOString();

  for (const t of targets) {
    let pw = makePassword();
    while (pw.toLowerCase() === t.id.toLowerCase()) pw = makePassword();
    vaultUpdates[t.key] = { pw: scryptHash(pw), role: t.role, id: t.id, resetAt: stamp };
    out.push({ id: t.id, name: t.name, role: t.role, status: t.status, newPw: pw });
  }

  // [순서 4 · 2026-09-11] 공책에는 안 쓴다. 정본은 금고 하나다.
  await db.ref(VAULT).update(vaultUpdates);

  return { ok: true, dryRun: false, changed: out.length, resetAt: stamp, list: out };
});

// ─────────────────────────────────────────────
// ③ 공책 → 금고 옮겨 적기 (원장님만 · 한 번)
//    ⛔ 공책은 **그대로 둔다.** 지우는 것은 홈페이지 확인이 끝난 뒤 따로 한다.
//    dryRun: true 로 먼저 세어 보고 실행할 것.
// ─────────────────────────────────────────────
exports.migratePasswordsToVault = onCall({ region: REGION }, async (req) => {
  const uid = req.auth && req.auth.uid;
  if (uid !== OPERATOR_UID) throw new HttpsError('permission-denied', 'OPERATOR-ONLY');

  const dryRun = !!(req.data && req.data.dryRun);
  const masterHash = String((req.data && req.data.masterHash) || '').trim();

  const db = admin.database();
  const snap = await db.ref(BOOK).once('value');
  const users = snap.val() || [];
  const list = Array.isArray(users) ? users : Object.values(users);

  const vaultSnap = await db.ref(VAULT).once('value');
  const vault = vaultSnap.val() || {};

  const updates = {};
  let copied = 0, skippedExisting = 0, skippedNoPw = 0, dup = 0;
  const seen = new Set();

  for (const u of list) {
    if (!u || !u.id || !u.role) continue;
    const k = vaultKey(u.role, u.id);
    if (seen.has(k)) { dup++; continue; }
    seen.add(k);
    if (!u.pw) { skippedNoPw++; continue; }
    if (vault[k] && vault[k].pw) { skippedExisting++; continue; }
    updates[k] = { pw: String(u.pw), role: u.role, id: u.id, copiedAt: new Date().toISOString() };
    copied++;
  }

  // 마스터 비번.
  //   안 주시면 **교사 줄의 비번**을 쓴다 — 2026-09-11 실측으로 둘이 같은 값이었다.
  //   (원장님이 64자를 손으로 옮겨 적다 틀리는 일을 없애려는 것이다. 한 번 복사한
  //    뒤로는 따로 놀므로, 나중에 교사 비번을 바꿔도 마스터는 그대로 남는다.)
  let masterCopied = false;
  let masterFrom = null;
  if (!(vault._master && vault._master.pw)) {
    let mh = masterHash;
    if (!mh) {
      const t = list.find((u) => u && u.role === 'teacher' && u.pw);
      if (t) { mh = String(t.pw); masterFrom = 'teacher:' + t.id; }
    } else {
      masterFrom = 'given';
    }
    if (mh) {
      updates._master = { pw: mh, copiedAt: new Date().toISOString(), from: masterFrom };
      masterCopied = true;
    }
  }

  if (!dryRun && Object.keys(updates).length > 0) {
    await db.ref(VAULT).update(updates);
  }

  return {
    ok: true,
    dryRun,
    copied,
    skippedExisting,
    skippedNoPw,
    duplicateRows: dup,
    masterCopied,
    masterFrom,
    totalRows: list.length
  };
});
