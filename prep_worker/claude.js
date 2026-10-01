/* =============================================================================
 * prep_worker/claude.js — Claude 부르기 (구독 = Claude Code 비대화 실행만)
 *
 * · 작업별 모델은 설정 파일(models.generate / verify / format)에서 고른다.
 * · 실제로 어떤 모델이 돌았는지는 Claude 가 돌려준 modelUsage 에서 읽어 **기록**한다(설정값을 그대로 적지 않는다).
 * · 호출마다 붙는 바탕 글을 줄인다 — 설명 파일이 최소인 전용 폴더에서 · 도구 끔 · MCP 끔 · 시스템 글 짧게.
 *     (2026-10-01 실측: 바탕 글 ≈27,000 → 539 토큰)
 * · ⛔ API 로 넘어가지 않는다 — 자식 환경에서 ANTHROPIC_API_KEY 를 지운다. allowApi 는 꺼져 있어야 한다.
 * · backend 'fake' 는 시험용(돈·한도 0) — 정해 둔 답을 돌려준다.
 * ============================================================================= */
'use strict';
const { spawn } = require('child_process');

function cliArgs(model, system, schema) {
  const a = ['-p', '--model', model, '--output-format', 'json', '--tools', '', '--strict-mcp-config', '--no-session-persistence',
    '--setting-sources', 'project', '--system-prompt', system];
  if (schema) a.push('--json-schema', JSON.stringify(schema));
  return a;
}

/** 한 번 부른다 → { out, usage, models:[실제 모델], tokens, ms, raw }
 *  ⚠ 10-01 실측: 재풀이 요청에 --json-schema 를 붙이면 Opus 안전 장치가 정상 수학 문제를 막는 일이 되풀이됐다(스키마를 빼면 통과).
 *    ⇒ 안전 장치에 걸리면 스키마 없이 한 번 더 부른다(답은 글에서 JSON 을 뽑는다). */
async function call(cfg, role, system, input, schema) {
  try { return await call1(cfg, role, system, input, schema); }
  catch (e) {
    if (schema && /safeguards flagged/i.test(e.message)) { const r = await call1(cfg, role, system, input, null); r.retriedWithoutSchema = true; return r; }
    throw e;
  }
}
async function call1(cfg, role, system, input, schema) {
  if (cfg.allowApi) throw new Error('API 전환은 꺼 두기로 했습니다(설정 allowApi=false 여야 함)');
  const model = (cfg.models || {})[role];
  if (!model) throw new Error('설정에 ' + role + ' 모델이 없습니다');
  if (cfg.backend === 'fake') return cfg.fake(role, input, model);
  const env = Object.assign({}, process.env); delete env.ANTHROPIC_API_KEY; delete env.ANTHROPIC_AUTH_TOKEN; delete env.CLAUDE_CODE_USE_BEDROCK; delete env.CLAUDE_CODE_USE_VERTEX;
  const t0 = Date.now();
  const raw = await new Promise((res, rej) => {
    const p = spawn(cfg.claudeBin || 'claude', cliArgs(model, system, schema), { cwd: cfg.claudeWorkdir, env, windowsHide: true, shell: process.platform === 'win32' && !/\.exe$/i.test(cfg.claudeBin || '') });
    let o = '', e = '';
    const timer = setTimeout(() => { p.kill(); rej(new Error('시간 넘김(' + cfg.callTimeoutSec + '초)')); }, (cfg.callTimeoutSec || 600) * 1000);
    p.stdout.on('data', d => { o += d; }); p.stderr.on('data', d => { e += d; });
    p.on('error', err => { clearTimeout(timer); rej(err); });
    p.on('close', code => { clearTimeout(timer); if (code !== 0 && !o) rej(new Error('claude 종료 ' + code + ' ' + e.slice(0, 300))); else res(o); });
    p.stdin.end(JSON.stringify(input));
  });
  let j; try { j = JSON.parse(raw); } catch (err) { throw new Error('claude 출력이 JSON 이 아님: ' + raw.slice(0, 200)); }
  if (j.is_error) throw new Error('claude 오류: ' + String(j.result || j.api_error_status || '').slice(0, 300));
  let out = j.structured_output;
  if (out == null) { const m = /\{[\s\S]*\}/.exec(String(j.result || '')); if (m) { try { out = JSON.parse(m[0]); } catch (e2) { out = null; } } }
  if (out == null) throw new Error('claude 가 구조화된 답을 안 냈습니다');
  const usage = j.usage || {};
  const tokens = (usage.input_tokens || 0) + (usage.output_tokens || 0) + (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0);
  return { out, usage: { input: usage.input_tokens || 0, output: usage.output_tokens || 0, cacheCreate: usage.cache_creation_input_tokens || 0, cacheRead: usage.cache_read_input_tokens || 0 },
    models: Object.keys(j.modelUsage || {}), asked: model, tokens, ms: Date.now() - t0, costNote: j.total_cost_usd };
}
module.exports = { call, cliArgs };
