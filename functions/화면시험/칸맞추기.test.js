// 고친 함수들을 **파일에서 떼어 내 진짜로 돌려 본다.**
//
// ⛔ `node --check` 는 `const` 에 다시 대입하는 것을 **못 잡는다**(실측). 돌려야 터진다.
//    그래서 「문법 이상 없음 ✅」만 보고 넘기면 원장님이 단추를 누르는 순간 터진다.
// ⛔ 이 시험이 재는 것 = **낡은 사본으로 남의 것을 지우는가.** 오늘 실측으로 드러난 그 흠이다.

const fs = require('fs');
const html = fs.readFileSync('E:/aa0/hp/index.html', 'utf8');

function 떼기(시작, 끝표) {
  const i = html.indexOf(시작);
  if (i < 0) throw new Error('못 찾음: ' + 시작);
  const j = html.indexOf(끝표, i);
  if (j < 0) throw new Error('끝을 못 찾음: ' + 끝표);
  return html.slice(i, j);
}

// ── 가짜 세상 ─────────────────────────────────────────
function 세상만들기(서버, 로컬) {
  const 쓴것 = [];
  const env = {
    서버, 쓴것,
    store: JSON.parse(JSON.stringify(로컬)),
    window: { fbReady: true, isPreviewMode: false },
    알림: [],
  };
  env.window.FB_REF = {
    child(path) {
      return {
        async once() {
          const 마디 = path.split('/');
          let v = 서버;
          for (const m of 마디) v = (v == null ? undefined : v[m]);
          return { exists: () => v !== undefined && v !== null, val: () => v };
        }
      };
    }
  };
  env.getStore = () => env.store;
  env.saveStore = (d) => { env.store = d; return true; };
  env.showBackupToast = (m) => env.알림.push(m);
  env.renderTeacher = () => {};
  env.console = console;
  return env;
}

const 도우미소스 = 떼기('async function _칸맞추기(key) {', 'function fbSetHomeworkSet(key, data, 빼기)');

function 만들기(env) {
  const 이름 = Object.keys(env).filter(k => k !== '서버' && k !== '쓴것' && k !== '알림');
  const 값 = 이름.map(k => env[k]);
  return new Function(...이름, 도우미소스 + '; return {_칸맞추기, _칸못맞춤알림};')(...값);
}

let 통과 = 0, 실패 = 0;
function 재기(이름, 참, 덧) {
  if (참) { 통과++; console.log('  ✅ ' + 이름); }
  else { 실패++; console.log('  ⛔ ' + 이름 + (덧 ? '\n       ' + 덧 : '')); }
}

(async () => {
  console.log('── 오늘 실측으로 드러난 흠: 로컬 사본에 칸이 없다');
  // 서버에는 수학 6세트 + TS 48문항. 로컬 사본에는 그 칸이 **없다**(트리밍됐다).
  const 서버 = { homeworkSets: { K: {
    sets: [1, 2, 3, 4, 5, 6].map(i => ({ setIdx: i - 1, title: 'Set ' + i, questions: [{ q: i }] })),
    ts: { enabled: true, questions: new Array(48).fill({ t: 1 }) },
    year: 5, country: 'AU'
  } } };
  const env = 세상만들기(서버, { homeworkSets: {}, currentPeriod: { year: 2026, month: 9, week: 4 } });
  const F = 만들기(env);

  재기('맞추기 전 — 로컬에 그 칸이 없다', env.store.homeworkSets.K === undefined);
  const r = await F._칸맞추기('K');
  재기('맞추기가 서버 것을 돌려준다', r && (r.sets || []).length === 6);
  재기('로컬 사본이 서버와 같아졌다',
       (env.store.homeworkSets.K.sets || []).length === 6, JSON.stringify(env.store.homeworkSets.K && env.store.homeworkSets.K.sets && env.store.homeworkSets.K.sets.length));
  재기('TS 도 함께 들어왔다', ((env.store.homeworkSets.K.ts || {}).questions || []).length === 48);

  console.log('\n── 맞추고 나면 한 세트를 더해도 여섯이 안 지워진다');
  env.store.homeworkSets.K.sets.push({ setIdx: 6, title: 'Set 7', questions: [{ q: 7 }] });
  재기('여섯 + 하나 = 일곱 (예전엔 0 + 1 = 하나가 됐다)',
       env.store.homeworkSets.K.sets.length === 7);

  console.log('\n── 서버에 그 칸이 없으면 로컬에서도 지운다');
  const env2 = 세상만들기({ homeworkSets: {} },
                        { homeworkSets: { K: { sets: [{ 낡음: true }] } }, currentPeriod: {} });
  const F2 = 만들기(env2);
  재기('돌려주는 값이 null (없다)', await F2._칸맞추기('K') === null);
  재기('로컬의 낡은 칸이 치워졌다', env2.store.homeworkSets.K === undefined);

  console.log('\n── ⛔ 못 읽었을 때는 「없다」가 아니라 undefined 여야 한다');
  const env3 = 세상만들기(서버, { homeworkSets: {}, currentPeriod: {} });
  env3.window.FB_REF = { child: () => ({ once: async () => { throw new Error('네트워크'); } }) };
  const F3 = 만들기(env3);
  재기('못 읽으면 undefined', await F3._칸맞추기('K') === undefined);
  const env4 = 세상만들기(서버, { homeworkSets: {}, currentPeriod: {} });
  env4.window.fbReady = false;
  재기('서버에 안 붙어 있어도 undefined', await 만들기(env4)._칸맞추기('K') === undefined);
  재기('「없다(null)」와 「못 읽었다(undefined)」가 다르다',
       (await F2._칸맞추기('K')) === null && (await F3._칸맞추기('K')) === undefined);

  console.log('\n── 미리보기에서는 서버를 안 본다');
  const env5 = 세상만들기(서버, { homeworkSets: {}, currentPeriod: {} });
  env5.window.isPreviewMode = true;
  재기('미리보기면 undefined (아무것도 안 한다)', await 만들기(env5)._칸맞추기('K') === undefined);
  재기('미리보기에서 로컬을 안 건드린다', Object.keys(env5.store.homeworkSets).length === 0);

  console.log('\n── 고친 함수들이 **돌 때 안 터지는가** (const 다시 대입 등)');
  for (const [이름, 시작, 끝] of [
    ['deleteSet', 'async function deleteSet(idx) {', '\nfunction togglePublishYear'],
    ['confirmMoveSet', 'async function confirmMoveSet(fromIdx) {', '\nfunction '],
  ]) {
    try {
      const 소스 = 떼기(시작, 끝);
      new Function(소스);                       // 파싱
      const 다시대입 = /\n\s{2}(hw|store|p|key)\s*=(?![=>])/.test(소스);
      재기(이름 + ' — const 에 다시 대입하는 줄이 없다', !다시대입,
           (소스.match(/\n\s{2}(hw|store|p|key)\s*=(?![=>])[^\n]*/g) || []).join(' / '));
    } catch (e) {
      재기(이름 + ' — 떼어 낼 수 있다', false, e.message);
    }
  }

  console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
  process.exit(실패 ? 1 : 0);
})();
