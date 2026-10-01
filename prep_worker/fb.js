/* =============================================================================
 * prep_worker/fb.js — 일꾼이 DB·저장소와 통하는 길 (REST · 꾸러미 없이)
 *
 * ⭐ 일꾼은 **진짜 Firebase 사용자 `ts-worker`** 로 로그인해서 쓴다.
 *    ⇒ DB 규칙·저장소 규칙이 일꾼에게도 그대로 걸린다(코드가 조심하는 것과 권한이 좁은 것은 다르다).
 *    · 운영: 서비스 계정 열쇠로 「ts-worker」 사용자 토큰을 서명 → 로그인 → ID 토큰(1시간, 50분마다 갱신)
 *    · 에뮬레이터: 서명 없는 토큰 → 에뮬레이터 로그인
 * ⛔ 관리자 권한(Bearer owner · 서비스 계정 OAuth)으로 DB 를 쓰지 않는다.
 * ============================================================================= */
'use strict';
const crypto = require('crypto');
const fs = require('fs');

const b64u = (b) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

class FB {
  /** cfg = { emulator:bool, dbUrl, ns?, bucket, storageBase, authBase, apiKey, keyFile?, uid } */
  constructor(cfg) { this.c = cfg; this.id = null; this.exp = 0; this.refresh = null; }

  customToken() {
    const uid = this.c.uid || 'ts-worker', now = Math.floor(Date.now() / 1000);
    if (this.c.emulator) {
      return b64u(JSON.stringify({ alg: 'none', typ: 'JWT' })) + '.' + b64u(JSON.stringify({ uid, iat: now, exp: now + 3600,
        aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit', iss: 'emu', sub: 'emu' })) + '.';
    }
    const k = JSON.parse(fs.readFileSync(this.c.keyFile, 'utf8'));
    const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const body = b64u(JSON.stringify({ iss: k.client_email, sub: k.client_email, uid, iat: now, exp: now + 3600,
      aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit' }));
    const sig = crypto.createSign('RSA-SHA256').update(head + '.' + body).sign(k.private_key);
    return head + '.' + body + '.' + b64u(sig);
  }
  async token() {
    if (this.id && Date.now() < this.exp) return this.id;
    const base = this.c.authBase || 'http://127.0.0.1:9099';
    let r;
    if (this.refresh && !this.c.emulator) {
      r = await fetch('https://securetoken.googleapis.com/v1/token?key=' + this.c.apiKey, { method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(this.refresh) });
      const j = await r.json(); if (!r.ok) throw new Error('토큰 갱신 실패: ' + JSON.stringify(j).slice(0, 200));
      this.id = j.id_token; this.refresh = j.refresh_token;
    } else {
      const 주소 = this.c.emulator ? base + '/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken' : 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken';
      r = await fetch(주소 + '?key=' + (this.c.apiKey || 'demo-key'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: this.customToken(), returnSecureToken: true }) })
        .catch(e => { throw new Error('로그인 서버에 닿지 않음: ' + e.message); });
      const j = await r.json(); if (!r.ok) throw new Error('일꾼 로그인 실패: ' + JSON.stringify(j).slice(0, 200));
      this.id = j.idToken; this.refresh = j.refreshToken;
    }
    this.exp = Date.now() + 50 * 60 * 1000;
    return this.id;
  }
  dbUrl(p, extra) {
    const q = ['auth=' + encodeURIComponent(this.id)];
    if (this.c.ns) q.push('ns=' + this.c.ns);
    if (extra) q.push(extra);
    return this.c.dbUrl.replace(/\/$/, '') + '/' + p.replace(/^\//, '') + '.json?' + q.join('&');
  }
  async get(p, extra) {
    await this.token();
    const r = await fetch(this.dbUrl(p, extra));
    if (!r.ok) { const e = new Error('읽기 거절 ' + r.status + ' ' + p); e.status = r.status; throw e; }
    return r.json();
  }
  /** 값과 ETag — 조건부 쓰기(원자적 확보)에 쓴다 */
  async getE(p) {
    await this.token();
    const r = await fetch(this.dbUrl(p), { headers: { 'X-Firebase-ETag': 'true' } });
    if (!r.ok) { const e = new Error('읽기 거절 ' + r.status + ' ' + p); e.status = r.status; throw e; }
    return { val: await r.json(), etag: r.headers.get('etag') };
  }
  async write(method, p, v, etag) {
    await this.token();
    const h = { 'Content-Type': 'application/json' }; if (etag) h['if-match'] = etag;
    const r = await fetch(this.dbUrl(p), { method, headers: h, body: JSON.stringify(v) });
    if (r.status === 412) { const e = new Error('먼저 바뀜(ETag) ' + p); e.status = 412; throw e; }
    if (!r.ok) { const e = new Error('쓰기 거절 ' + r.status + ' ' + p + ' ' + (await r.text()).slice(0, 120)); e.status = r.status; throw e; }
    return r.json();
  }
  put(p, v, etag) { return this.write('PUT', p, v, etag); }
  patch(p, v) { return this.write('PATCH', p, v); }

  /* ── 저장소(비공개) ── */
  objUrl(path) { return (this.c.storageBase || 'https://firebasestorage.googleapis.com') + '/v0/b/' + this.c.bucket + '/o'; }
  async upload(path, buf, contentType) {
    await this.token();
    const bd = 'prepw' + crypto.randomBytes(8).toString('hex'), CRLF = '\r\n';
    const head = '--' + bd + CRLF + 'Content-Type: application/json; charset=UTF-8' + CRLF + CRLF + JSON.stringify({ name: path, contentType }) + CRLF
      + '--' + bd + CRLF + 'Content-Type: ' + contentType + CRLF + CRLF;
    const body = Buffer.concat([Buffer.from(head), buf, Buffer.from(CRLF + '--' + bd + '--' + CRLF)]);
    // ⚠ 10-01 실측: X-Goog-Upload-Protocol: multipart 가 있어야 파일 종류가 규칙에 실린다(없으면 단순 업로드로 읽혀 거절)
    const r = await fetch(this.objUrl() + '?name=' + encodeURIComponent(path), { method: 'POST',
      headers: { Authorization: 'Firebase ' + this.id, 'Content-Type': 'multipart/related; boundary=' + bd, 'X-Goog-Upload-Protocol': 'multipart' }, body });
    if (!r.ok) { const e = new Error('올리기 거절 ' + r.status + ' ' + path + ' ' + (await r.text()).slice(0, 160)); e.status = r.status; throw e; }
    return r.json();
  }
  /** 서비스 계정 OAuth(저장소 메타데이터만 고칠 때) — 1시간 */
  async saToken() {
    if (this.sa && Date.now() < this.saExp) return this.sa;
    const k = JSON.parse(fs.readFileSync(this.c.keyFile, 'utf8')), now = Math.floor(Date.now() / 1000);
    const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const body = b64u(JSON.stringify({ iss: k.client_email, scope: 'https://www.googleapis.com/auth/devstorage.read_write', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
    const jwt = head + '.' + body + '.' + b64u(crypto.createSign('RSA-SHA256').update(head + '.' + body).sign(k.private_key));
    const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + jwt });
    const j = await r.json(); if (!r.ok) throw new Error('서비스 계정 토큰 실패: ' + JSON.stringify(j).slice(0, 160));
    this.sa = j.access_token; this.saExp = Date.now() + 50 * 60 * 1000; return this.sa;
  }
  /**
   * ⛔ 지시서 금지 5 — 비공개 파일에 영구 다운로드 토큰을 두지 않는다.
   *   Firebase 저장소는 올릴 때 다운로드 토큰을 저절로 붙인다(10-01 실측: 그 토큰만 있으면 로그인 없이 200).
   *   ⇒ 올린 직후 지우고, **다시 읽어 토큰이 없는지 확인**한다. 남아 있으면 실패(주문은 다시 대기).
   *   에뮬레이터는 이 고치기를 지원하지 않는다(Not Implemented) → 'emulator-skip' 으로 적는다.
   */
  async clearDownloadTokens(path) {
    if (this.c.emulator) return 'emulator-skip';
    const sa = await this.saToken();
    const r = await fetch('https://storage.googleapis.com/storage/v1/b/' + this.c.bucket + '/o/' + encodeURIComponent(path), { method: 'PATCH',
      headers: { Authorization: 'Bearer ' + sa, 'Content-Type': 'application/json' }, body: JSON.stringify({ metadata: { firebaseStorageDownloadTokens: null } }) });
    if (!r.ok) throw new Error('다운로드 토큰 지우기 실패 ' + r.status + ' ' + path);
    await this.token();
    const m = await (await fetch(this.objUrl() + '/' + encodeURIComponent(path), { headers: { Authorization: 'Firebase ' + this.id } })).json();
    if (m.downloadTokens) throw new Error('다운로드 토큰이 남아 있음: ' + path);
    return 'cleared';
  }
  async download(path) {
    await this.token();
    const r = await fetch(this.objUrl() + '/' + encodeURIComponent(path) + '?alt=media', { headers: { Authorization: 'Firebase ' + this.id } });
    if (!r.ok) { const e = new Error('내려받기 거절 ' + r.status + ' ' + path); e.status = r.status; throw e; }
    return Buffer.from(await r.arrayBuffer());
  }
}
module.exports = { FB };
