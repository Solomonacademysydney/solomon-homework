#!/usr/bin/env node
/* =============================================================================
 * prep_worker/일꾼.js — 5단계 PC 제작 일꾼 (2026-10-01)
 *
 *   node prep_worker/일꾼.js --once             반자동(기본): 쌓인 확정 주문을 지금 처리하고 끝낸다
 *                                                  (원장님이 Claude Code 에 「확정 주문 처리해」 하시면 이것을 돌린다)
 *   node prep_worker/일꾼.js --watch            완전 자동: 설정 mode=auto **이고** DB 스위치 config/autoProduce=true 일 때만 집는다
 *   node prep_worker/일꾼.js --once --sample 2  표본: MR·TS 각 2문항만 만든다(한도 아끼기)
 *   node prep_worker/일꾼.js --archive <draftId> --root <폴더>   승인된 교재를 학생별·수업일 폴더로 복사
 *   공통: --config <설정.json>  (기본 C:/솔로몬제작/설정.json)
 *
 * ⛔ 지키는 선
 *   · 쓰는 곳 = sol_prep_v1/jobs/<쥔 주문>/lease·status·w · sol_prep_v1/drafts(새로 만들기만) · 저장소 prep/<학생>/drafts/…
 *     숙제 칸·공개된 과제·제출·승인 판에는 쓰지 않는다 — **규칙이 막는다**(일꾼은 ts-worker 사용자로 로그인).
 *   · 생성은 Claude Code 구독만(API 전환 끔). 실제로 돈 모델을 작업 기록에 남긴다.
 *   · 토큰 상한을 넘기 전에 멈추고 주문을 「보류(token-cap)」로 둔다 — /prep/ 에 뜬다.
 *   · 단계마다 결과를 일감 폴더에 저장 — 멈췄다 다시 켜면 이어서 한다(쓴 토큰도 이어서 센다).
 * ============================================================================= */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const C = require('./core');
const { FB } = require('./fb');
const CL = require('./claude');

const ROOT = 'sol_prep_v1';
const 지금 = () => Date.now();
const iso = () => new Date().toISOString();

function 인자(argv) {
  const a = { once: false, watch: false, sample: 0, config: 'C:/솔로몬제작/설정.json' };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--once') a.once = true; else if (k === '--watch') a.watch = true;
    else if (k === '--sample') a.sample = Number(argv[++i]) || 2; else if (k === '--config') a.config = argv[++i];
    else if (k === '--archive') a.archive = argv[++i]; else if (k === '--root') a.root = argv[++i];
    else if (k === '--job') a.job = argv[++i];
  }
  return a;
}

/* ── 작업 기록(한 줄 JSON) ── */
function 기록(cfg, o) {
  fs.mkdirSync(path.dirname(cfg.logFile), { recursive: true });
  fs.appendFileSync(cfg.logFile, JSON.stringify(Object.assign({ at: iso(), worker: cfg.workerId }, o)) + '\n');
}

class 멈춤 extends Error { constructor(kind, msg, detail) { super(msg); this.kind = kind; this.detail = detail || null; } }

/* ── 일감 폴더: 단계 결과 저장 · 이어하기 ── */
class 일감 {
  constructor(cfg, jobId) { this.dir = path.join(cfg.workRoot, jobId); fs.mkdirSync(this.dir, { recursive: true }); }
  p(n) { return path.join(this.dir, n); }
  has(n) { return fs.existsSync(this.p(n)); }
  read(n) { return JSON.parse(fs.readFileSync(this.p(n), 'utf8')); }
  write(n, v) { const t = this.p(n) + '.tmp'; fs.writeFileSync(t, JSON.stringify(v, null, 1)); fs.renameSync(t, this.p(n)); }
}

/* ── 한 주문 처리 ── */
class 처리 {
  constructor(cfg, fb, jobId, job, opts) {
    Object.assign(this, { cfg, fb, jobId, job, opts: opts || {} });
    this.w = new 일감(cfg, jobId);
    this.usage = this.w.has('usage.json') ? this.w.read('usage.json') : { tokens: 0, calls: [] };
    this.token = null; this.abort = null;
  }
  async 쥐기() {
    const d = C.leaseDecision(this.job, this.cfg.workerId, 지금());
    const l = this.job.lease;
    if (!d.take && d.why !== 'unknown-type') return d;
    const { val, etag } = await this.fb.getE(ROOT + '/jobs/' + this.jobId + '/lease');
    if (val && val.until > 지금() && val.workerId !== this.cfg.workerId) return { take: false, why: '다른 일꾼이 쥠' };
    // 재시작해 내 것을 이어받을 때는 같은 표(token)를 쓴다 — 이미 낸 초안의 표와 맞아야 하므로
    this.token = (val && val.workerId === this.cfg.workerId && val.token) || crypto.randomBytes(12).toString('hex');
    try {
      await this.fb.put(ROOT + '/jobs/' + this.jobId + '/lease', { workerId: this.cfg.workerId, token: this.token, until: 지금() + C.LEASE_MS, at: iso() }, etag);
    } catch (e) { if (e.status === 412) return { take: false, why: '다른 일꾼이 먼저 쥠' }; throw e; }
    if (d.why === 'unknown-type') { await this.상태('failed', { lastError: '알 수 없는 작업 종류: ' + this.job.type }); return { take: false, why: 'unknown-type → failed' }; }
    const attempts = ((this.job.w && this.job.w.attempts) || 0) + (d.resume ? 0 : 1);
    await this.fb.patch(ROOT + '/jobs/' + this.jobId + '/w', { attempts, startedAt: iso(), heartbeat: iso(), worker: this.cfg.workerId });
    await this.fb.put(ROOT + '/jobs/' + this.jobId + '/status', 'running');
    this.attempts = attempts;
    this.박동 = setInterval(() => this.살아있음().catch(() => {}), (this.cfg.heartbeatSec || 60) * 1000);
    return d;
  }
  async 살아있음() {
    const cur = await this.fb.get(ROOT + '/jobs/' + this.jobId);
    if (!cur || !cur.lease || cur.lease.token !== this.token) { this.abort = '다른 일꾼이 넘겨받음'; return; }
    if (cur.status === 'cancel-requested') { this.abort = 'cancel'; return; }
    await this.fb.put(ROOT + '/jobs/' + this.jobId + '/lease/until', 지금() + C.LEASE_MS).catch(() => {});
    await this.fb.patch(ROOT + '/jobs/' + this.jobId + '/w', { heartbeat: iso() });
  }
  확인() { if (this.abort) throw new 멈춤(this.abort === 'cancel' ? 'cancel' : 'lost', this.abort); }
  async 진행(step, msg) {
    this.확인();
    기록(this.cfg, { job: this.jobId, step, msg });
    await this.fb.patch(ROOT + '/jobs/' + this.jobId + '/w', { progress: { step, msg: msg || '', at: iso() }, usage: { tokens: this.usage.tokens, calls: this.usage.calls.length, cap: this.cfg.maxTokensPerJob } });
  }
  async 상태(st, extra) {
    if (extra) await this.fb.patch(ROOT + '/jobs/' + this.jobId + '/w', extra);
    await this.fb.put(ROOT + '/jobs/' + this.jobId + '/status', st);
  }
  async 놓기() {
    clearInterval(this.박동);
    // 잠금을 풀어 다른 일꾼(다음 시도)이 바로 쥘 수 있게 — 같은 표로 until=0
    if (this.token) await this.fb.put(ROOT + '/jobs/' + this.jobId + '/lease', { workerId: this.cfg.workerId, token: this.token, until: 0, at: iso() }).catch(() => {});
  }

  /* ── Claude 부르기(토큰 상한 · 실제 모델 기록) ── */
  async 부름(role, system, input, schema) {
    const est = (this.cfg.estimatePerCall || {})[role] || 0;
    if (C.overCap(this.usage.tokens, est, this.cfg.maxTokensPerJob)) {
      throw new 멈춤('token-cap', '토큰 상한 ' + this.cfg.maxTokensPerJob + ' — 지금까지 ' + this.usage.tokens + ' + 다음 어림 ' + est, { used: this.usage.tokens, cap: this.cfg.maxTokensPerJob });
    }
    this.확인();
    let r;
    try { r = await CL.call(this.cfg, role, system, input, schema); }
    catch (e) {
      // Claude 안전 장치가 막거나 응답을 거절하면 재시도해도 같다 → 보류로 두고 까닭을 화면에(10-01 원장 지시)
      if (/safeguards flagged|usage policy|refus/i.test(e.message)) throw new 멈춤('claude-blocked', (role === 'verify' ? '검증(재풀이)' : role === 'generate' ? '생성' : '형식 정리') + ' 호출이 막힘 — ' + e.message.slice(0, 160),
        { role, slots: ((input && input.items) || []).map(x => x.slot) });
      throw e;
    }
    this.usage.tokens += r.tokens;
    this.usage.calls.push({ role, asked: r.asked, models: r.models, tokens: r.tokens, usage: r.usage, ms: r.ms, at: iso() });
    this.w.write('usage.json', this.usage);
    기록(this.cfg, { job: this.jobId, call: role, asked: r.asked, models: r.models, tokens: r.tokens, total: this.usage.tokens });
    if (C.overCap(this.usage.tokens, 0, this.cfg.maxTokensPerJob)) throw new 멈춤('token-cap', '토큰 상한을 넘었습니다: ' + this.usage.tokens + ' > ' + this.cfg.maxTokensPerJob, { used: this.usage.tokens, cap: this.cfg.maxTokensPerJob });
    return r.out;
  }

  /* ── MR: 생성 → 꼴 검사(형식 정리) → 재풀이 → 어긋난 것 다시 만들기 ── */
  async MR만들기(slots, year, tag) {
    const 받음 = this.w.has(tag + '_mr.json') ? this.w.read(tag + '_mr.json') : {};
    const 남음 = () => slots.filter(s => !받음[s.id] || !받음[s.id]._ok);
    for (let round = 1; round <= (this.cfg.maxRounds || 3) && 남음().length; round++) {
      const todo = 남음();
      await this.진행('mr-generate', tag + ' ' + todo.length + '문항 · ' + round + '회');
      for (let i = 0; i < todo.length; i += (this.cfg.batchSize || 12)) {
        const batch = todo.slice(i, i + (this.cfg.batchSize || 12));
        // 만든 문항은 검증 전에 먼저 저장 — 검증에서 멈춰도 다음에 다시 만들지 않는다(토큰 아끼기)
        const 생성칸 = tag + '_gen_' + C.sha256(batch.map(s => s.id).join(',') + '|' + round).slice(0, 10) + '.json';
        let out = this.w.has(생성칸) ? this.w.read(생성칸) : await this.부름('generate', 프롬프트.생성, { task: 'Write these practice questions for a ' + year + ' maths class.', year, items: batch.map(s => ({ slot: s.id, unit: s.unit, type: s.type, difficulty: s.difficulty, calculator: s.calculator, worked: !!s.worked })), rules: 프롬프트.생성규칙 }, 스키마.생성);
        this.w.write(생성칸, out);
        let items = 정리(out && out.items);
        let chk = C.checkMrItems(items, batch);
        const 꼴만 = Object.values(chk.bad).some(ps => ps.some(p => /문항 없음|문제 글 없음|정답 없음|보기는 4개/.test(p)));
        if (꼴만 && (this.cfg.models || {}).format) {
          out = await this.부름('format', 프롬프트.형식, { items, problems: chk.bad, rule: '꼴만 고친다 — 수·문장 뜻·정답은 바꾸지 않는다' }, 스키마.생성);
          items = 정리(out && out.items); chk = C.checkMrItems(items, batch);
        }
        // 재풀이 — 정답을 안 보여 주고 따로 푼다
        const ok = items.filter(it => batch.some(s => s.id === it.slot) && !chk.bad[it.slot]);
        let 대조 = {};
        if (ok.length) {
          const 풀칸 = tag + '_solve_' + C.sha256(ok.map(it => it.slot + it.stem).join('|')).slice(0, 10) + '.json';
          // 재풀이는 스키마 없이(위 claude.js 실측) — 돌려받는 꼴은 시스템 글에 적고, 여러 꼴을 받아 정리한다
          const sv = this.w.has(풀칸) ? this.w.read(풀칸) : await this.부름('verify', 프롬프트.재풀이, { task: 'Please solve these worksheet questions for a ' + year + ' maths class and give your answers.', items: ok.map(it => ({ slot: it.slot, stem: it.stem, choices: it.type === 'mc' ? it.choices : undefined })) }, null);
          this.w.write(풀칸, sv);
          대조 = C.compareSolve(ok, 답모으기(sv));
        }
        for (const s of batch) {
          const it = items.find(x => x.slot === s.id);
          if (!it) continue;
          const v = 대조[s.id];
          it._verify = v ? { status: v.status, calc: v.calc, theirs: v.theirs, models: this.usage.calls.slice(-1)[0].models } : null;
          it._problems = chk.bad[s.id] || (v && v.status !== 'verified-agree' ? ['재풀이 불일치(' + v.theirs + ')'] : []);
          it._ok = it._problems.length === 0;
          if (it.type === 'mc' && it._ok) it.answerIndex = it.choices.findIndex(c => C.sameAnswer(c, it.answer));
          받음[s.id] = it;
        }
        this.w.write(tag + '_mr.json', 받음);
      }
    }
    const 못함 = 남음();
    if (못함.length) throw new 멈춤('mr-unverified', 'MR ' + 못함.length + '문항이 검사·재풀이를 못 넘음', 못함.map(s => ({ slot: s.id, problems: (받음[s.id] || {})._problems || ['문항 없음'] })));
    return 받음;
  }

  async TS고르기(slots, spec, tag, 빼기) {
    if (this.w.has(tag + '_ts.json')) return this.w.read(tag + '_ts.json');
    if (!slots.length) return {};
    await this.진행('ts-select', slots.length + '문항');
    const 묶음 = {};
    for (const s of slots) { const k = s.section + '|' + (s.title || ''); (묶음[k] = 묶음[k] || []).push(s); }
    const picks = {}, used = new Set(빼기 || []);
    for (const [k, ss] of Object.entries(묶음)) {
      const inp = this.w.p(tag + '_ts_in.json'), outp = this.w.p(tag + '_ts_out.json');
      fs.writeFileSync(inp, JSON.stringify({ tsRoot: this.cfg.tsRoot, level: spec.difficulty.target, title: ss[0].title, figures: spec.composition.figures,
        slots: ss.map(s => ({ id: s.id, section: s.section })), exclude: Array.from(used), seed: this.job.studentId + '|' + this.job.lessonDate + '|' + k }));
      const r = spawnSync(this.cfg.python || 'python', [path.join(__dirname, 'ts_고르기.py'), inp, outp], { encoding: 'utf8', env: Object.assign({}, process.env, { PYTHONUTF8: '1' }) });
      if (r.status !== 0) throw new Error('TS 고르기 실패: ' + (r.stderr || '').slice(-300));
      const o = JSON.parse(fs.readFileSync(outp, 'utf8'));
      if (!o.ok) throw new 멈춤('ts-short', 'TS 창고 부족 — ' + o.short.why + ' (필요 ' + o.short.need + ' · 있음 ' + o.short.have + ')', o.short);
      for (const [sid, it] of Object.entries(o.picks)) { picks[sid] = Object.assign(it, { release: o.release, typeWhy: o.typeWhy }); used.add(it.id); }
    }
    this.w.write(tag + '_ts.json', picks);
    return picks;
  }

  async 올리기(base, files) {
    const out = [];
    for (const f of files) {
      const buf = fs.readFileSync(f.local), h = C.sha256(buf);
      const p = base + '/' + f.dest;
      let 있음 = null;
      try { 있음 = await this.fb.download(p); } catch (e) { if (e.status !== 404 && e.status !== 403) throw e; }
      if (!있음) await this.fb.upload(p, buf, f.type);
      const back = 있음 || await this.fb.download(p);
      if (C.sha256(back) !== h) throw new Error('올린 뒤 다시 읽은 해시가 다름: ' + p);
      const tokenState = await this.fb.clearDownloadTokens(p);   // 공개 다운로드 토큰 지우기 + 다시 읽어 확인
      out.push({ kind: f.kind, path: p, sha256: h, bytes: buf.length, pages: f.pages || null, downloadToken: tokenState });
    }
    return out;
  }

  /** 드라이브(G: 동기화 폴더)에 복사 — 덮어쓰지 않고, 복사 뒤 다시 읽어 해시 확인. 같은 파일이 이미 있으면 그대로 */
  드라이브저장(profile, list) {
    const d = (this.cfg.drive || {});
    if (!d.root) throw new Error('설정 drive.root 가 없습니다');
    const folder = 폴더이름(profile, this.job.studentId);
    const dest = C.driveDest(d.root, folder, this.job, !!this.opts.sample);
    fs.mkdirSync(dest.dir, { recursive: true });
    return list.map(f => {
      const buf = fs.readFileSync(f.local), h = C.sha256(buf), name = C.driveFileName(folder, this.job, f.kind, f.ext, !!this.opts.sample);
      const to = path.join(dest.dir, name);
      if (fs.existsSync(to)) { if (C.sha256(fs.readFileSync(to)) !== h) throw new Error('같은 이름의 다른 파일이 있어 덮어쓰지 않음: ' + to); }
      else fs.copyFileSync(f.local, to);
      if (C.sha256(fs.readFileSync(to)) !== h) throw new Error('복사 뒤 다시 읽은 해시가 다름: ' + to);
      return { kind: f.kind, name, rel: dest.rel, sha256: h, bytes: buf.length, pages: f.pages || null, where: 'drive' };
    });
  }

  /* ── prep-paper: 교재·테스트지·종이 숙제 PDF ── */
  async 종이() {
    const j = this.job;
    const plan = await this.fb.get(ROOT + '/plans/' + j.planId + '/revisions/' + j.rev);
    if (!plan || !plan.spec) throw new 멈춤('bad-plan', '확정 판을 못 읽음');
    if (C.specHash(plan.spec) !== j.specHash && j.specHash) throw new 멈춤('bad-plan', '명세 해시가 주문과 다름');
    const spec = plan.spec, hash = C.specHash(spec);
    const profile = (await this.fb.get(ROOT + '/students/' + j.studentId + '/profile')) || {};
    // 3단계 「커리 먼저 검토」 — 학교 자료 검토가 안 끝났으면 만들지 않는다(Claude 를 부르기 전에 멈춘다)
    if (profile.holdForCurriculum === true) throw new 멈춤('curriculum-review', '커리 먼저 검토 — 학교 자료 검토가 끝나지 않았습니다');
    const 새자료 = Object.values((await this.fb.get(ROOT + '/inbox/' + j.studentId)) || {}).filter(x => x && x.status === 'new');
    if (새자료.length) throw new 멈춤('curriculum-review', '새 학교 자료 ' + 새자료.length + '개 → 커리 먼저 검토(' + 새자료.map(x => x.name).slice(0, 3).join(', ') + ')');
    let prevUnit = null;
    const cur = profile.currentCurriculum ? await this.fb.get(ROOT + '/students/' + j.studentId + '/curricula/' + profile.currentCurriculum) : null;
    if (cur && Array.isArray(cur.lessons)) { const before = cur.lessons.filter(l => l && l.date < j.lessonDate).sort((a, b) => a.date < b.date ? 1 : -1)[0]; if (before) prevUnit = before.mr; }
    let slots = C.slotsFromSpec(spec, { prevUnit });
    if (this.opts.sample) slots = C.sampleSlots(slots, this.opts.sample);
    this.w.write('slots.json', slots);
    const year = profile.year || profile.grade || 'Year 5';
    const mr = await this.MR만들기(slots.filter(s => s.src === 'mr'), year, 'paper');
    const ts = await this.TS고르기(slots.filter(s => s.src === 'ts'), spec, 'paper', []);
    return this.조판저장({ slots, mr, ts, spec, layout: spec.layout, profile, hash, draftId: C.draftIdFor(j, 'paper', hash), extra: {} });
  }

  /** 조판 → PDF 검사 → 원본 JSON → 드라이브(또는 저장소) → 초안 기록. 종이·부분 수정이 함께 쓴다 */
  async 조판저장({ slots, mr, ts, spec, layout, profile, hash, draftId, extra }) {
    const j = this.job;
    // 조판
    const out = this.w.p('pdf');
    if (!this.w.has('pdf/조판보고.json')) {
      await this.진행('typeset', '');
      const inp = this.w.p('조판_in.json');
      fs.writeFileSync(inp, JSON.stringify({ coreDir: this.cfg.coreDir, outDir: out, edge: this.cfg.edge, title: 'Weekly Pack', studentName: profile.name || j.studentId,
        lessonDate: j.lessonDate, layout, figureScale: spec.composition.figureScale, order: slots, mr, ts }));
      const r = spawnSync(this.cfg.python || 'python', [path.join(__dirname, '조판.py'), inp], { encoding: 'utf8', env: Object.assign({}, process.env, { PYTHONUTF8: '1' }), timeout: 20 * 60 * 1000 });
      if (r.status !== 0) throw new 멈춤('typeset', '조판 실패: ' + (r.stderr || r.stdout || '').slice(-400));
    }
    const 보고 = JSON.parse(fs.readFileSync(path.join(out, '조판보고.json'), 'utf8'));

    // PDF 검사 — 문항 수·빠짐·빈 쪽·정답 노출·넘침
    await this.진행('pdf-check', '');
    const qa = { files: {}, ok: true };
    const 해설 = Object.values(mr).filter(it => !slots.find(s => s.id === it.slot).worked).map(it => String(it.working || '').replace(/\$/g, '').replace(/\s+/g, ' ').trim()).filter(x => x.length >= 12);
    for (const f of 보고.files) {
      const r = spawnSync(this.cfg.python || 'python', [path.join(__dirname, '조판.py'), '--검사', path.join(out, f.file)], { encoding: 'utf8', env: Object.assign({}, process.env, { PYTHONUTF8: '1' }) });
      const pages = JSON.parse(r.stdout);
      const expect = f.kind === 'student' || f.kind === 'teacher' ? slots.map(s => s.id) : slots.filter(s => s.section === f.kind).map(s => s.id);
      const res = C.checkPdfText(pages, expect, f.kind === 'teacher' ? [] : 해설);
      if (f.overfullMaxPt > (this.cfg.overfullFailPt || 30)) { res.ok = false; res.problems.push('글이 칸을 ' + f.overfullMaxPt + 'pt 넘침'); }
      if (f.kind !== 'teacher' && pages.some(p => /Teacher Answer Key/.test(p.text))) { res.ok = false; res.problems.push('학생용에 답지 표지'); }
      qa.files[f.kind] = Object.assign(res, { pages: pages.length, overfullMaxPt: f.overfullMaxPt });
      f.pages = pages.length;
      if (!res.ok) qa.ok = false;
    }
    this.w.write('qa.json', qa);
    if (!qa.ok) throw new 멈춤('pdf-check', 'PDF 검사 실패', qa);

    // 원본 JSON — 문항·정답·manifest(문항 하나하나가 명세의 어느 칸인지)
    const manifest = C.buildManifest(slots, mr, ts);
    fs.writeFileSync(path.join(out, 'items.json'), JSON.stringify({ draftId, slots, mr, ts, manifest, layout }, null, 1));
    fs.writeFileSync(path.join(out, 'qa.json'), JSON.stringify({ qa, usage: this.usage }, null, 1));

    const 낼것 = 보고.files.map(f => ({ kind: f.kind, local: path.join(out, f.file), ext: 'pdf', pages: f.pages }))
      .concat([{ kind: 'items', local: path.join(out, 'items.json'), ext: 'json' }, { kind: 'qa', local: path.join(out, 'qa.json'), ext: 'json' }]);
    let files;
    if ((this.cfg.output || 'drive') === 'drive') {
      // 10-01 원장 결정: 저장소(Storage) 안 씀 — 드라이브 Solomon_교재보관 학생별·주차별 폴더에 둔다(원장만 보고 인쇄)
      await this.진행('drive-save', '');
      files = this.드라이브저장(profile, 낼것);
    } else {
    // ⛔ 꺼 둔 길(저장소) — 설정 output:'storage' 일 때만. 지우지 않고 남겨 둠
    await this.진행('upload', '');
    const base = 'prep/' + j.studentId + '/drafts/' + draftId;
    const 종류 = { test: 'student/test.pdf', book: 'student/book.pdf', hw: 'student/hw.pdf', student: 'student/student.pdf', teacher: 'teacher/teacher.pdf' };
    files = await this.올리기(base, 보고.files.map(f => ({ kind: f.kind, local: path.join(out, f.file), dest: 종류[f.kind], type: 'application/pdf', pages: f.pages }))
      .concat([{ kind: 'items', local: path.join(out, 'items.json'), dest: 'data/items.json', type: 'application/json' },
               { kind: 'qa', local: path.join(out, 'qa.json'), dest: 'data/qa.json', type: 'application/json' }]));
    }

    await this.초안쓰기(draftId, Object.assign({ kind: 'paper', specHash: hash, sample: !!this.opts.sample, files, layout,
      counts: { mr: Object.keys(mr).length, ts: Object.keys(ts).length, slots: slots.length },
      manifest: manifest.map(m => ({ slot: m.slot, section: m.section, part: m.part, set: m.set, src: m.src, itemId: m.itemId, itemRevision: m.itemRevision, verify: m.verify ? (m.verify.status || m.verify) : null })),
      items: C.itemsForDraft(slots, mr, ts),   // [6단계] 원장 화면 미리보기·부분 수정용(교사·서버만 읽음)
      qa: { ok: qa.ok, files: Object.fromEntries(Object.entries(qa.files).map(([k, v]) => [k, { pages: v.pages, count: v.count, overfullMaxPt: v.overfullMaxPt }])) } }, extra || {}));
    this.후보적립(mr, draftId);
    return draftId;
  }

  /* ── [6단계] prep-revise: 교재 부분 수정 — 고친 칸만 새로, 나머지는 그대로. 조판만이면 내용 유지 ── */
  async 수정() {
    const j = this.job;
    const src = await this.fb.get(ROOT + '/drafts/' + j.sourceDraftId);
    const plan = await this.fb.get(ROOT + '/plans/' + j.planId + '/revisions/' + j.rev);
    if (!src || !plan || !plan.spec) throw new 멈춤('bad-plan', '원래 교재 초안 또는 판을 못 읽음');
    if (src.planRev !== j.rev || src.studentId !== j.studentId) throw new 멈춤('bad-plan', '초안과 주문의 판·학생이 다름');
    const latest = await this.fb.get(ROOT + '/plans/' + j.planId + '/latest');
    if (Number(latest) !== Number(j.rev)) throw new 멈춤('bad-plan', '판이 바뀌었습니다 — 새 판에서 다시 만드세요');
    const profile = (await this.fb.get(ROOT + '/students/' + j.studentId + '/profile')) || {};
    // 원본 JSON 은 드라이브에 있다 — 해시로 같은 파일인지 확인
    const f = (src.files || []).find(x => x.kind === 'items');
    if (!f) throw new 멈춤('bad-plan', '원래 초안에 원본 JSON 이 없음');
    const 원본길 = path.join((this.cfg.drive || {}).root || '', f.rel || '', f.name || '');
    if (!fs.existsSync(원본길)) throw new 멈춤('bad-plan', '원본 JSON 을 못 찾음: ' + 원본길);
    const buf = fs.readFileSync(원본길);
    if (C.sha256(buf) !== f.sha256) throw new 멈춤('bad-plan', '원본 JSON 해시가 초안 기록과 다름');
    const 옛 = JSON.parse(buf.toString('utf8'));
    const slots = 옛.slots, mr = Object.assign({}, 옛.mr), ts = Object.assign({}, 옛.ts);
    const spec = plan.spec, hash = C.specHash(spec);
    const year = profile.year || profile.grade || 'Year 5';
    const 칸 = {}; for (const s of slots) 칸[s.id] = s;
    const 바뀜 = [];
    for (const e of j.edits || []) {
      const s = 칸[e.slot];
      if (!s) throw new 멈춤('bad-plan', '없는 칸: ' + e.slot);
      if (e.action === 'regenerate' && s.src === 'mr') {
        const 새것 = await this.MR만들기([s], year, 'rev' + j.revision + '_' + s.id);
        바뀜.push({ slot: s.id, action: e.action, before: mr[s.id] ? mr[s.id].stem : null, after: 새것[s.id].stem });
        mr[s.id] = 새것[s.id];
      } else if (e.action === 'regenerate' && s.src === 'ts') {
        const 쓴것 = Object.values(ts).map(t => t.id);
        const 새것 = await this.TS고르기([s], spec, 'rev' + j.revision + '_' + s.id, 쓴것);
        바뀜.push({ slot: s.id, action: e.action, before: ts[s.id] ? ts[s.id].id : null, after: 새것[s.id].id });
        ts[s.id] = 새것[s.id];
      } else if (e.action === 'edit' && s.src === 'mr') {
        const it = C.applyMrEdit(mr[s.id], e);
        const chk = C.checkMrItems([Object.assign({}, it, { slot: s.id })], [s]);
        if (!chk.ok) throw new 멈춤('mr-unverified', '고친 문항이 검사를 못 넘음', [{ slot: s.id, problems: chk.bad[s.id] }]);
        // 원장이 고친 답은 원장이 기준이다 — 다시 풀어 보고 다르면 막지 않고 「경고」로 남긴다
        const 풀칸 = 'rev' + j.revision + '_solve_' + s.id + '.json';
        const sv = this.w.has(풀칸) ? this.w.read(풀칸) : await this.부름('verify', 프롬프트.재풀이, { task: 'Please solve this worksheet question for a ' + year + ' maths class and give your answer.', items: [{ slot: s.id, stem: it.stem, choices: it.type === 'mc' ? it.choices : undefined }] }, null);
        this.w.write(풀칸, sv);
        const 대조 = C.compareSolve([Object.assign({}, it, { slot: s.id })], 답모으기(sv))[s.id] || {};
        it._verify = { status: 'teacher-edited', agree: !!대조.agree, theirs: 대조.theirs || null };
        if (it.type === 'mc') it.answerIndex = it.choices.findIndex(c => C.sameAnswer(c, it.answer));
        it._ok = true;
        바뀜.push({ slot: s.id, action: e.action, before: mr[s.id] ? mr[s.id].answer : null, after: it.answer, 재풀이일치: !!대조.agree, 재풀이답: 대조.theirs || null });
        mr[s.id] = it;
      } else throw new 멈춤('bad-plan', '할 수 없는 수정: ' + e.slot + ' ' + e.action);
    }
    const layout = Object.assign({}, src.layout || spec.layout, j.layout || {});
    const 경고 = 바뀜.filter(x => x.재풀이일치 === false).map(x => x.slot + ': 원장이 고친 답(' + x.after + ')과 재풀이(' + x.재풀이답 + ')가 다름');
    return this.조판저장({ slots, mr, ts, spec, layout, profile, hash, draftId: C.draftIdFor(j, 'paper_v' + j.revision, hash),
      extra: { parentDraftId: j.sourceDraftId, revision: j.revision, changes: 바뀜, contentKept: !(j.edits || []).length, warnings: 경고, affects: j.affects || null } });
  }

  /* ── prep-online: 교재 승인 뒤 홈페이지 MR/TS 숙제 초안 ── */
  async 온라인() {
    const j = this.job;
    const plan = await this.fb.get(ROOT + '/plans/' + j.planId + '/revisions/' + j.rev);
    const src = await this.fb.get(ROOT + '/drafts/' + j.sourceDraftId);
    if (!plan || !src) throw new 멈춤('bad-plan', '판 또는 교재 초안을 못 읽음');
    if (!src.approval || src.approval.approved !== true) throw new 멈춤('not-approved', '교재가 아직 승인되지 않음');
    const 명세몫 = plan.spec.parts.find(p => p.kind === 'online-hw');
    // [6단계] 원장이 「수량 확인」에서 정한 값이 먼저 — 없으면(옛 주문) 명세 그대로
    const on = j.onlineConfig ? Object.assign({}, 명세몫 || {}, j.onlineConfig) : 명세몫;
    if (!on) throw new 멈춤('bad-plan', '명세에 홈페이지 숙제가 없음');
    const profile = (await this.fb.get(ROOT + '/students/' + j.studentId + '/profile')) || {};
    const unit = (plan.spec.parts.find(p => p.kind === 'mr-unit') || {}).title || '';
    let slots = []; let k = 0;
    for (let s = 0; s < on.mrSets; s++) for (let i = 0; i < on.perSet; i++) slots.push({ id: 'o' + String(++k).padStart(3, '0'), src: 'mr', section: 'online', part: 'online-mr', set: s, unit, type: i % 3 === 2 ? 'sa' : 'mc', difficulty: ['basic', 'standard', 'challenge'][i % 3], calculator: false });
    for (let s = 0; s < on.tsSets; s++) for (let i = 0; i < on.perSet; i++) slots.push({ id: 'p' + String(++k).padStart(3, '0'), src: 'ts', section: 'online', part: 'online-ts', set: on.mrSets + s, title: (plan.spec.parts.find(p => /^ts/.test(p.kind)) || {}).title || '' });
    if (this.opts.sample) slots = C.sampleSlots(slots, this.opts.sample);
    const mr = await this.MR만들기(slots.filter(s => s.src === 'mr'), profile.year || 'Year 5', 'online');
    const 종이TS = Object.values((src.manifest || [])).filter(m => m.src === 'ts').map(m => m.itemId);   // 종이에 나간 TS 는 빼고
    const ts = await this.TS고르기(slots.filter(s => s.src === 'ts'), plan.spec, 'online', 종이TS);
    // 홈페이지 세트 꼴(기존 숙제 문항과 같은 모양)
    const sets = {};
    for (const s of slots) {
      const set = (sets[s.set] = sets[s.set] || { setIdx: s.set, title: (s.src === 'mr' ? 'MR ' : 'TS ') + 'Set ' + (s.set + 1), questions: [] });
      const n = set.questions.length;
      if (s.src === 'mr') {
        const it = mr[s.id];
        set.questions.push({ id: 'q' + n, text: it.stem, type: it.type === 'mc' ? 'mc' : 'sa', options: it.type === 'mc' ? it.choices : null,
          answer: it.type === 'mc' ? 'ABCD'[it.answerIndex] : it.answer, explanation: it.working || '', hint1: '', hint2: '', srcId: C.itemIdFor(it) });
      } else {
        const t = ts[s.id];
        set.questions.push({ id: 'q' + n, text: t.stem_en, type: 'mc', options: t.options.map(o => o.en), answer: t.answerLetter, explanation: (t.solution_en || []).map(x => { x = String(x || '').trim(); return x && !/[.!?]$/.test(x) ? x + '.' : x; }).filter(Boolean).join(' '), hint1: '', hint2: '', srcId: t.id, figure: t.figureSvg || null });
      }
    }
    const hash = C.specHash(plan.spec);
    // [6단계] 수량을 다시 확인하면(새 주문) 새 초안이어야 한다 — 주문 id 를 초안 id 에 넣는다.
    //   공개는 「승인 자리에 적힌 주문(jobId)」의 초안만 고른다(prep_release 온라인초안고르기)
    const draftId = C.draftIdFor(j, 'online' + (j.onlineConfig ? '_' + String(this.jobId).replace(/[^A-Za-z0-9]/g, '').slice(-8) : ''), hash);
    const manifest = C.buildManifest(slots, mr, ts);
    await this.초안쓰기(draftId, { kind: 'online', sourceDraftId: j.sourceDraftId, specHash: hash, sample: !!this.opts.sample, sets: Object.values(sets),
      manifest: manifest.map(m => ({ slot: m.slot, set: m.set, src: m.src, itemId: m.itemId, itemRevision: m.itemRevision, verify: m.verify ? m.verify.status : null })) });
    this.후보적립(mr, draftId);
    return draftId;
  }

  async 초안쓰기(draftId, body) {
    const j = this.job;
    await this.진행('draft', draftId);
    const 있음 = await this.fb.get(ROOT + '/drafts/' + draftId);
    if (있음) { 기록(this.cfg, { job: this.jobId, msg: '같은 초안이 이미 있음 — 다시 쓰지 않음', draftId }); return; }
    await this.fb.put(ROOT + '/drafts/' + draftId, Object.assign({ jobId: this.jobId, claimToken: this.token, planId: j.planId, planRev: j.rev, studentId: j.studentId,
      lessonDate: j.lessonDate, status: body.kind === 'paper' ? 'paperReview' : 'onlineReview', published: false, createdAt: iso(), worker: this.cfg.workerId,
      usage: { tokens: this.usage.tokens, calls: this.usage.calls.map(c => ({ role: c.role, asked: c.asked, models: c.models, tokens: c.tokens })) },
      verifyNote: '재풀이 일치는 「검증 일치」이며 정답 보장이 아님' }, body));
  }
  후보적립(mr, draftId) {
    fs.mkdirSync(path.dirname(this.cfg.candidatesFile), { recursive: true });
    const 이미 = fs.existsSync(this.cfg.candidatesFile) ? fs.readFileSync(this.cfg.candidatesFile, 'utf8') : '';
    const 줄 = Object.values(mr).map(it => ({ itemId: C.itemIdFor(it), itemRevision: 1, status: 'unapproved', unit: it.unit, difficulty: it.difficulty, type: it.type,
      stem: it.stem, choices: it.choices || null, answer: it.answer, working: it.working || '', verify: it._verify, source: { draftId, jobId: this.jobId, studentId: this.job.studentId, models: this.usage.calls.map(c => c.models).flat() }, at: iso() }))
      .filter(x => 이미.indexOf('"itemId":"' + x.itemId + '"') < 0);
    if (줄.length) fs.appendFileSync(this.cfg.candidatesFile, 줄.map(x => JSON.stringify(x)).join('\n') + '\n');
  }

  async 돌리기() {
    const d = await this.쥐기();
    if (!d.take) return { jobId: this.jobId, skipped: d.why };
    기록(this.cfg, { job: this.jobId, type: this.job.type, msg: '쥠 — ' + d.why, attempts: this.attempts, sample: this.opts.sample || 0 });
    try {
      const draftId = this.job.type === 'prep-paper' ? await this.종이() : this.job.type === 'prep-revise' ? await this.수정() : await this.온라인();
      this.확인();
      await this.상태('done', { resultRef: draftId, finishedAt: iso(), usage: { tokens: this.usage.tokens, calls: this.usage.calls.length, cap: this.cfg.maxTokensPerJob }, models: 모델모음(this.usage) });
      기록(this.cfg, { job: this.jobId, msg: '끝', draftId, tokens: this.usage.tokens, models: 모델모음(this.usage) });
      return { jobId: this.jobId, done: draftId, tokens: this.usage.tokens };
    } catch (e) {
      const kind = e instanceof 멈춤 ? e.kind : 'error';
      기록(this.cfg, { job: this.jobId, msg: '멈춤', kind, error: e.message, detail: e.detail });
      if (kind === 'lost') return { jobId: this.jobId, lost: e.message };
      if (kind === 'cancel') { await this.상태('cancelled', { lastError: '원장 판 변경으로 취소' }).catch(() => {}); return { jobId: this.jobId, cancelled: true }; }
      const 보류 = ['token-cap', 'ts-short', 'mr-unverified', 'pdf-check', 'not-approved', 'bad-plan', 'curriculum-review', 'claude-blocked'].indexOf(kind) >= 0;
      const 다시 = !보류 && this.attempts < (this.job.maxAttempts || 3);
      await this.상태(보류 ? 'held' : (다시 ? 'queued' : 'failed'), { lastError: e.message.slice(0, 500), hold: 보류 ? { kind, msg: e.message.slice(0, 300), detail: JSON.parse(JSON.stringify(e.detail || null)) } : null,
        usage: { tokens: this.usage.tokens, calls: this.usage.calls.length, cap: this.cfg.maxTokensPerJob }, models: 모델모음(this.usage) }).catch(() => {});
      return { jobId: this.jobId, held: 보류 ? kind : null, error: e.message, requeued: 다시 };
    } finally { await this.놓기(); }
  }
}
/** 재풀이 답 꼴 정리 — {answers:[…]} · {items:[…]} · [{slot,answer}] · {m001: '답'} 모두 받는다 */
function 답모으기(sv) {
  if (!sv) return [];
  const arr = Array.isArray(sv) ? sv : (Array.isArray(sv.answers) ? sv.answers : (Array.isArray(sv.items) ? sv.items : null));
  if (arr) return arr.filter(x => x && x.slot).map(x => ({ slot: String(x.slot), answer: String(x.answer == null ? '' : x.answer) }));
  return Object.entries(sv).filter(([k, v]) => /^[mo]\d{3}$/.test(k) && (typeof v === 'string' || typeof v === 'number' || (v && v.answer != null)))
    .map(([k, v]) => ({ slot: k, answer: String(typeof v === 'object' ? v.answer : v) }));
}
function 모델모음(u) { const o = {}; for (const c of u.calls) { o[c.role] = Array.from(new Set([].concat(o[c.role] || [], c.models))); } return o; }
function 정리(items) {
  if (!Array.isArray(items)) return [];
  return items.filter(x => x && typeof x === 'object').map(x => {
    const it = Object.assign({}, x);
    if (Array.isArray(it.choices)) it.choices = it.choices.map(c => String(c).replace(/^\s*\(?[A-D][).:]\s+/, '').trim());
    if (it.type === 'mc' && Array.isArray(it.choices)) it.answer = String(C.resolveChoice(it.answer, it.choices) || '');
    for (const k of ['stem', 'answer', 'working', 'check']) if (it[k] != null) it[k] = String(it[k]);
    return it;
  });
}

const 프롬프트 = {
  생성: 'You write mathematics questions for Australian primary/secondary students as JSON. Follow the input exactly. Output only the JSON object.',
  생성규칙: [
    'Write one item per input slot. Echo slot, unit, type, difficulty and calculator exactly as given.',
    'stem: English. Plain text; put mathematics only inside $...$ using LaTeX (\\frac{a}{b}, \\times, \\div). No other LaTeX commands, no markdown.',
    'type mc: exactly 4 different choices; answer must be character-for-character equal to one of the choices.',
    'type sa: answer is the final value. type written: answer is a short model answer; working shows the full reasoning.',
    'check: an arithmetic expression using only digits, + - * / ( ) whose value equals the answer when the answer is a number; otherwise "".',
    'working: short step-by-step solution. If worked is true the item is a teaching example and working must teach the method.',
    'difficulty basic = one step, standard = two steps, challenge = multi-step or unfamiliar context. Match the year level.',
    'calculator true means the numbers may need a calculator; false means mental or written methods suffice.',
    'figure must be false. Do not write questions that need a picture.',
  ],
  재풀이: 'Solve each question independently and carefully. "answer" must be the final answer only (a number with its unit, or the exact text of the correct choice) — no working, no equations, no sentences. For multiple choice give the exact text of the correct choice. Reply with only this JSON: {"answers":[{"slot":"<slot>","answer":"<final answer only>"}]}',
  형식: 'You fix only the JSON shape of question items (missing fields, choice labels, field names). Never change numbers, wording meaning, or answers. Output only the JSON object.',
};
const 스키마 = {
  생성: { type: 'object', required: ['items'], properties: { items: { type: 'array', items: { type: 'object', required: ['slot', 'stem', 'answer', 'working', 'check', 'unit', 'difficulty', 'type', 'calculator', 'figure'],
    properties: { slot: { type: 'string' }, stem: { type: 'string' }, choices: { type: 'array', items: { type: 'string' } }, answer: { type: 'string' }, working: { type: 'string' }, check: { type: 'string' },
      unit: { type: 'string' }, difficulty: { type: 'string' }, type: { type: 'string' }, calculator: { type: 'boolean' }, figure: { type: 'boolean' } } } } } },
  재풀이: { type: 'object', required: ['answers'], properties: { answers: { type: 'array', items: { type: 'object', required: ['slot', 'answer'], properties: { slot: { type: 'string' }, answer: { type: 'string' }, working: { type: 'string' } } } } } },
};

function 폴더이름(profile, sid) { return (profile && (profile.driveFolder || profile.koName || profile.name)) || sid; }

/** 학교 자료 찾기 — 원장님이 휴대폰 드라이브 앱으로 `학생별 커리/<학생>/학교자료` 에 올린 새 사진·PDF 를 inbox 에 적는다.
 *  학생 연결은 /prep/ 에서 정한 driveFolders(폴더 이름 → 학생 id). 연결 안 된 폴더는 inbox/_미연결 에 적어 화면에 띄운다. */
async function 학교자료찾기(cfg, fb) {
  const root = (cfg.drive || {}).curriculumRoot;
  if (!root || !fs.existsSync(root)) return { skipped: '학생별 커리 폴더 없음' };
  const 연결 = (await fb.get(ROOT + '/driveFolders')) || {};
  const 적음 = [], 미연결 = [];
  for (const folder of fs.readdirSync(root)) {
    const dir = path.join(root, folder, '학교자료');
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;
    const files = fs.readdirSync(dir).map(name => { const st = fs.statSync(path.join(dir, name)); return st.isFile() ? { name, rel: folder + '/학교자료/' + name, size: st.size, mtime: st.mtimeMs } : null; }).filter(Boolean);
    const sid = 연결[folder] || null;
    const key = sid || '_미연결';
    const known = (await fb.get(ROOT + '/inbox/' + key)) || {};
    for (const f of C.schoolFileNews(files, known)) {
      await fb.put(ROOT + '/inbox/' + key + '/' + f.id, { name: f.name, rel: f.rel, size: f.size, folder, status: 'new', foundAt: iso(), worker: cfg.workerId });
      (sid ? 적음 : 미연결).push(folder + '/' + f.name);
    }
  }
  if (적음.length || 미연결.length) 기록(cfg, { msg: '학교 자료 찾음', 적음, 미연결 });
  return { 적음, 미연결 };
}

/* ── 주문 훑기 ── */
async function 한바퀴(cfg, fb, opts) {
  if (!opts.noScan) { try { const s = await 학교자료찾기(cfg, fb); if (s.적음 && (s.적음.length || s.미연결.length)) console.log('학교 자료: ' + JSON.stringify(s)); } catch (e) { 기록(cfg, { msg: '학교 자료 찾기 실패', error: e.message }); } }
  const jobs = (await fb.get(ROOT + '/jobs')) || {};
  const 결과 = [];
  const ids = Object.keys(jobs).filter(id => !opts.job || id === opts.job)
    .sort((a, b) => String(jobs[a].createdAt).localeCompare(String(jobs[b].createdAt)));
  for (const id of ids) {
    const j = jobs[id];
    if (!j || ['done', 'failed', 'held', 'cancelled'].indexOf(j.status) >= 0) continue;
    if (j.status === 'cancel-requested') {
      // 아무도 안 돌리는 취소 요청(일꾼이 죽은 뒤) — 잠금을 쥐고 취소로 닫는다
      const p = new 처리(cfg, fb, id, Object.assign({}, j, { status: 'queued' }), opts);
      const l = j.lease;
      if (!l || l.until < 지금() || l.workerId === cfg.workerId) {
        const { val, etag } = await fb.getE(ROOT + '/jobs/' + id + '/lease');
        try { await fb.put(ROOT + '/jobs/' + id + '/lease', { workerId: cfg.workerId, token: (val && val.workerId === cfg.workerId && val.token) || crypto.randomBytes(12).toString('hex'), until: 지금() + 60000, at: iso() }, etag);
          await fb.put(ROOT + '/jobs/' + id + '/status', 'cancelled'); 결과.push({ jobId: id, cancelled: true }); } catch (e) { 결과.push({ jobId: id, error: e.message }); }
      }
      void p; continue;
    }
    결과.push(await new 처리(cfg, fb, id, j, opts).돌리기());
  }
  return 결과;
}

function 설정읽기(file) {
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  cfg.workerId = cfg.workerId || (os.hostname() + '-prep');
  if (cfg.allowApi) throw new Error('설정 allowApi 가 켜져 있습니다 — 원장님 결정은 「API 전환 끔」');
  return cfg;
}

/** 완전 자동은 둘 다 켜졌을 때만 — 이 PC 설정 mode=auto · DB 스위치 config/autoProduce=true(원장만 바꿈) */
async function 자동켜짐(cfg, fb) {
  if (cfg.mode !== 'auto') return false;
  const on = await fb.get(ROOT + '/config/autoProduce').catch(() => null);
  return on === true;
}

async function 보관(cfg, fb, draftId, root) {
  const d = await fb.get(ROOT + '/drafts/' + draftId);
  if (!d) throw new Error('초안 없음: ' + draftId);
  if (!d.approval || d.approval.approved !== true) throw new Error('승인되지 않은 교재는 복사하지 않습니다');
  const profile = (await fb.get(ROOT + '/students/' + d.studentId + '/profile')) || {};
  const 받기 = [];
  for (const f of d.files || []) {
    if (!/\.pdf$/.test(f.path)) continue;
    const buf = await fb.download(f.path);
    if (C.sha256(buf) !== f.sha256) throw new Error('내려받은 해시가 다름: ' + f.path);
    const tmp = path.join(cfg.workRoot, '_보관', draftId); fs.mkdirSync(tmp, { recursive: true });
    const local = path.join(tmp, path.basename(f.path)); fs.writeFileSync(local, buf);
    받기.push({ kind: f.kind, local, sha256: f.sha256 });
  }
  const plan = C.archivePlan(root, profile.koName || profile.name || d.studentId, d.lessonDate, 받기);
  for (const p of plan) {
    fs.mkdirSync(path.dirname(p.to), { recursive: true });
    if (fs.existsSync(p.to) && C.sha256(fs.readFileSync(p.to)) === p.sha256) continue;
    if (fs.existsSync(p.to)) throw new Error('같은 이름의 다른 파일이 있어 덮어쓰지 않음: ' + p.to);
    fs.copyFileSync(p.from, p.to);
    if (C.sha256(fs.readFileSync(p.to)) !== p.sha256) throw new Error('복사 뒤 해시가 다름: ' + p.to);
  }
  기록(cfg, { msg: '보관 복사', draftId, root, files: plan.map(p => p.to) });
  return plan;
}

async function main() {
  const a = 인자(process.argv);
  const cfg = 설정읽기(a.config);
  const fb = new FB(cfg.firebase);
  if (a.archive) {
    if (!a.root) throw new Error('--root 로 복사할 폴더를 주십시오');
    if (!cfg.archive || !cfg.archive.enabled) { if (!/^[A-Za-z]:[\\/](Users|솔로몬제작)|Temp|tmp/i.test(a.root)) throw new Error('보관(드라이브 복사)이 꺼져 있습니다 — 시험은 임시 폴더로만'); }
    console.log(JSON.stringify(await 보관(cfg, fb, a.archive, a.root), null, 1)); return;
  }
  if (a.watch) {
    if (cfg.mode !== 'auto') { console.log('설정 mode 가 auto 가 아닙니다 — 완전 자동은 꺼져 있습니다(반자동은 --once).'); return; }
    for (;;) {
      if (await 자동켜짐(cfg, fb)) { const r = await 한바퀴(cfg, fb, a); if (r.length) console.log(JSON.stringify(r)); }
      await new Promise(r => setTimeout(r, (cfg.pollSec || 60) * 1000));
    }
  }
  const r = await 한바퀴(cfg, fb, a);
  console.log(JSON.stringify(r, null, 1));
}

module.exports = { 학교자료찾기, 폴더이름, 답모으기, 처리, 한바퀴, 설정읽기, 보관, 자동켜짐, 프롬프트, 스키마, 정리 };
if (require.main === module) main().catch(e => { console.error('⛔ ' + (e && e.stack || e)); process.exit(1); });
