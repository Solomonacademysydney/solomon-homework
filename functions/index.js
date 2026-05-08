// Cloud Functions for Solomon (2026-05)
// Student-side AI proxy: hides Anthropic API key from browser.
// Teachers continue to call Anthropic directly from their browser (Option B).
//
// Deploy:
//   firebase functions:secrets:set ANTHROPIC_KEY
//   firebase deploy --only functions:callClaudeForStudent
//
// Usage from client:
//   const callable = firebase.functions('australia-southeast1')
//     .httpsCallable('callClaudeForStudent');
//   const res = await callable({ prompt: '...', model: 'claude-sonnet-4-5-20250929' });
//   const text = res.data.text;

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { setGlobalOptions } = require('firebase-functions/v2');

setGlobalOptions({ region: 'australia-southeast1' });

const anthropicKey = defineSecret('ANTHROPIC_KEY');

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';
const MAX_PROMPT_LEN = 50000;
const MAX_TOKENS = 8000;

exports.callClaudeForStudent = onCall({
  region: 'australia-southeast1',
  timeoutSeconds: 60,
  memory: '256MiB',
  secrets: [anthropicKey]
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'S-AUTH');
  }

  const { prompt, model } = request.data || {};
  if (!prompt || typeof prompt !== 'string') {
    throw new HttpsError('invalid-argument', 'S-ARG');
  }
  if (prompt.length > MAX_PROMPT_LEN) {
    throw new HttpsError('invalid-argument', 'S-LEN');
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
        model: typeof model === 'string' ? model : DEFAULT_MODEL,
        max_tokens: MAX_TOKENS,
        temperature: 0.15,
        messages: [{ role: 'user', content: prompt }]
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
