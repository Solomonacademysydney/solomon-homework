// Cloud Functions for Solomon (2026-05 → Phase 2A)
// Anthropic API proxy: hides API key from all clients (students + teachers).
// Supports both prompt: string (legacy) and messages: array (with cache_control).
//
// Deploy:
//   firebase functions:secrets:set ANTHROPIC_KEY
//   firebase deploy --only functions:callClaudeForStudent,functions:cleanupRateLimits
//
// Usage from client:
//   const callable = firebase.functions('australia-southeast1')
//     .httpsCallable('callClaudeForStudent');
//   // (a) Simple string:
//   const res = await callable({ prompt: '...', model: 'claude-sonnet-4-6' });
//   // (b) Messages array with prompt caching:
//   const res = await callable({
//     messages: [{ role: 'user', content: [
//       { type: 'text', text: 'cached prefix...', cache_control: { type: 'ephemeral' } },
//       { type: 'text', text: 'fresh suffix...' }
//     ]}],
//     model: 'claude-sonnet-4-6'
//   });
//   const text = res.data.text;

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');

// Phase 1.5: Realtime Database 기반 Rate Limit 사용을 위한 admin 초기화
// 솔로몬 RTDB는 asia-southeast1 지역 인스턴스 → databaseURL 명시 필수
if (!admin.apps.length) {
  admin.initializeApp({
    databaseURL: 'https://solomon-76715-default-rtdb.asia-southeast1.firebasedatabase.app'
  });
}

setGlobalOptions({ region: 'australia-southeast1' });

const anthropicKey = defineSecret('ANTHROPIC_KEY');

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-4-6';
const MAX_PROMPT_LEN = 50000;
const MAX_TOKENS = 8000;

// Phase 2A: 모델 화이트리스트 — 비싼 모델(opus 등) 호출 차단으로 비용 폭탄 방지
// 새 모델 도입 시 여기에 추가 후 재배포 필요
const ALLOWED_MODELS = new Set([
  'claude-sonnet-4-6',                // 현재 표준
  'claude-sonnet-4-5-20250929'        // push 직후 옛 HTML 호환 (추후 제거 가능)
]);

// Phase 2A: messages 배열 입력 시 보안 한계
const MAX_MESSAGES = 5;        // 1~2개가 일반적, 5개면 충분
const MAX_CONTENT_BLOCKS = 4;  // cached + fresh + 여유분

// Phase 1.5: 사용자(uid)별 일일 호출 제한
// 1인 운영 + 학원 30명 기준 충분 (학생 30명 × 호출 10회 = 300, 교사 일괄 작업 여유분 200)
// 익명 인증 UID는 브라우저별로 stable, 한도 초과 시 다음날 자정에 리셋
const RATE_LIMIT_PER_DAY = 500;

// ============================================================
// Phase 1.5: Rate Limit 헬퍼
// 트랜잭션으로 원자적 증가 + 한도 검증 (race condition 방지)
// 한도 초과 시 'R-DAILY' HttpsError throw
// ============================================================
async function checkAndIncrementRateLimit(uid) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC 기준)
  const ref = admin.database().ref(`rate_limits/${uid}_${today}`);

  const result = await ref.transaction((current) => {
    const next = (current || 0) + 1;
    if (next > RATE_LIMIT_PER_DAY) {
      return; // abort: 트랜잭션 미커밋
    }
    return next;
  });

  if (!result.committed) {
    throw new HttpsError('resource-exhausted', 'R-DAILY');
  }
}

exports.callClaudeForStudent = onCall({
  region: 'australia-southeast1',
  timeoutSeconds: 60,
  memory: '256MiB',
  secrets: [anthropicKey]
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'S-AUTH');
  }

  // Phase 1.5: 인증 직후 Rate Limit 체크 (입력 검증 전)
  // → 무거운 검증 로직 진입 전에 차단, 비용/CPU 절약
  await checkAndIncrementRateLimit(request.auth.uid);

  const { prompt, messages: clientMessages, model } = request.data || {};

  // ============================================================
  // 입력 파싱: 두 가지 형태 지원
  //   (a) prompt: string                       — 학생 호출 (기존 호환)
  //   (b) messages: [{role, content}]          — 교사 호출 (cache_control 포함)
  //
  // 보안: messages 배열 입력은 다음을 모두 통과해야 함
  //   1. 메시지 개수 <= MAX_MESSAGES
  //   2. role은 'user' 또는 'assistant'만
  //   3. content는 string 또는 text-only array
  //   4. content 배열 블록 수 <= MAX_CONTENT_BLOCKS
  //   5. 각 블록의 type은 'text'만 (image/document 등 차단)
  //   6. 총 텍스트 길이 0 < total <= MAX_PROMPT_LEN
  //
  // cache_control 통과 보장:
  //   클라이언트가 content block에 첨부한 cache_control 필드
  //   (예: { type: 'ephemeral' })는 Anthropic API에 그대로 전달되어야
  //   prompt caching이 작동 (~90% 비용 절감). 아래 messagesToSend는
  //   clientMessages를 변형 없이 전달하므로 이 필드는 자동 통과.
  // ============================================================

  let messagesToSend;

  if (Array.isArray(clientMessages) && clientMessages.length > 0) {
    // (b) messages 배열 경로 — 교사 호출
    if (clientMessages.length > MAX_MESSAGES) {
      throw new HttpsError('invalid-argument', 'S-MSG-COUNT');
    }

    let totalLen = 0;
    for (const m of clientMessages) {
      // role 검증
      if (!m || typeof m !== 'object') {
        throw new HttpsError('invalid-argument', 'S-MSG-SHAPE');
      }
      if (m.role !== 'user' && m.role !== 'assistant') {
        throw new HttpsError('invalid-argument', 'S-ROLE');
      }

      // content 검증
      if (typeof m.content === 'string') {
        totalLen += m.content.length;
      } else if (Array.isArray(m.content)) {
        if (m.content.length === 0) {
          throw new HttpsError('invalid-argument', 'S-BLOCK-EMPTY');
        }
        if (m.content.length > MAX_CONTENT_BLOCKS) {
          throw new HttpsError('invalid-argument', 'S-BLOCK-COUNT');
        }
        for (const p of m.content) {
          if (!p || typeof p !== 'object') {
            throw new HttpsError('invalid-argument', 'S-BLOCK-SHAPE');
          }
          // text 블록만 허용 (image/document/tool_use 등 차단)
          if (p.type !== 'text') {
            throw new HttpsError('invalid-argument', 'S-BLOCK-TYPE');
          }
          if (typeof p.text !== 'string') {
            throw new HttpsError('invalid-argument', 'S-TEXT-MISSING');
          }
          totalLen += p.text.length;
          // cache_control 필드는 추가 검증 없이 통과
          // (Anthropic이 알아서 처리 — 잘못된 형식이면 거기서 에러)
        }
      } else {
        throw new HttpsError('invalid-argument', 'S-CONTENT');
      }
    }

    if (totalLen === 0) {
      throw new HttpsError('invalid-argument', 'S-EMPTY');
    }
    if (totalLen > MAX_PROMPT_LEN) {
      throw new HttpsError('invalid-argument', 'S-LEN');
    }

    messagesToSend = clientMessages;

  } else if (typeof prompt === 'string' && prompt.length > 0) {
    // (a) prompt 문자열 경로 — 학생 호출 (기존 호환)
    if (prompt.length > MAX_PROMPT_LEN) {
      throw new HttpsError('invalid-argument', 'S-LEN');
    }
    messagesToSend = [{ role: 'user', content: prompt }];

  } else {
    throw new HttpsError('invalid-argument', 'S-ARG');
  }

  // Phase 2A: 모델 화이트리스트 검증
  // 클라이언트가 비싼 모델(opus 등)을 지정해서 비용 폭탄 시도 차단
  const requestedModel = typeof model === 'string' ? model : DEFAULT_MODEL;
  if (!ALLOWED_MODELS.has(requestedModel)) {
    throw new HttpsError('invalid-argument', 'S-MODEL');
  }

  const apiKey = anthropicKey.value();
  if (!apiKey) {
    throw new HttpsError('internal', 'S-CFG');
  }

  let res;
  try {
    res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION
      },
      body: JSON.stringify({
        model: requestedModel,
        max_tokens: MAX_TOKENS,
        temperature: 0.15,
        messages: messagesToSend
      })
    });
  } catch (err) {
    console.error('[callClaudeForStudent] fetch failed:', err);
    throw new HttpsError('internal', 'S-NET');
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('[callClaudeForStudent] upstream error:', res.status, errText);
    throw new HttpsError('internal', `S-${res.status}`);
  }

  let data;
  try {
    data = await res.json();
  } catch (err) {
    throw new HttpsError('internal', 'S-PARSE');
  }

  const text = data?.content?.[0]?.text || '';
  return { text };
});

// ============================================================
// Phase 1.5: rate_limits 노드 자동 정리 (cron, 매일 자정 시드니 시간)
// 7일 이상 된 rate_limits 키를 일괄 삭제.
// rate_limits 노드가 무한 누적되는 것을 방지.
// ============================================================
exports.cleanupRateLimits = onSchedule({
  schedule: 'every day 00:00',
  region: 'australia-southeast1',
  timeZone: 'Australia/Sydney',
  memory: '256MiB'
}, async () => {
  const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);

  const snap = await admin.database().ref('rate_limits').once('value');
  if (!snap.exists()) {
    console.log('[cleanupRateLimits] no rate_limits node — nothing to clean');
    return;
  }

  const updates = {};
  let cleanedCount = 0;
  snap.forEach((child) => {
    const key = child.key; // 형식: "{uid}_YYYY-MM-DD"
    const datePart = key.split('_').pop();
    if (datePart && datePart < cutoffDate) {
      updates[key] = null;
      cleanedCount++;
    }
  });

  if (cleanedCount > 0) {
    await admin.database().ref('rate_limits').update(updates);
    console.log(`[cleanupRateLimits] removed ${cleanedCount} entries older than ${cutoffDate}`);
  } else {
    console.log(`[cleanupRateLimits] no entries older than ${cutoffDate}`);
  }
});
