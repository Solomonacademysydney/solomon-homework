// 6단계 공개 셈(functions/release_core.js) — 시드니 20:00 · 서머타임·월말·연말 · 공개 조건 · 묶음
//   node functions/화면시험/prep_공개.test.js
'use strict';
const path = require('path');
const RC = require(path.join(__dirname, '..', 'release_core'));
const C = require(path.join(__dirname, '..', '..', 'prep', 'prep_core'));
let 통과 = 0, 실패 = 0;
function 재기(이름, 참, 덧) { if (참) { 통과++; console.log('  ✅ ' + 이름); } else { 실패++; console.log('  ⛔ ' + 이름 + (덧 ? '\n       ' + 덧 : '')); } }
const Z = (s) => Date.parse(s);

console.log('── ① 시드니 20:00 → UTC (서머타임 · 월말 · 연말)');
재기('10-03(토) 서머타임 전 = 10:00Z', RC.releaseAtFor('2026-10-03') === Z('2026-10-03T10:00:00Z'), new Date(RC.releaseAtFor('2026-10-03')).toISOString());
재기('10-04(일) 서머타임 시작한 날 = 09:00Z', RC.releaseAtFor('2026-10-04') === Z('2026-10-04T09:00:00Z'), new Date(RC.releaseAtFor('2026-10-04')).toISOString());
재기('10-09 = 09:00Z', RC.releaseAtFor('2026-10-09') === Z('2026-10-09T09:00:00Z'));
재기('월말 10-31 = 09:00Z', RC.releaseAtFor('2026-10-31') === Z('2026-10-31T09:00:00Z'));
재기('연말 12-31 = 09:00Z', RC.releaseAtFor('2026-12-31') === Z('2026-12-31T09:00:00Z'));
재기('새해 2027-01-01 = 09:00Z', RC.releaseAtFor('2027-01-01') === Z('2027-01-01T09:00:00Z'));
재기('2027-04-03 서머타임 끝 전날 = 09:00Z', RC.releaseAtFor('2027-04-03') === Z('2027-04-03T09:00:00Z'));
재기('2027-04-04 서머타임 끝난 날 = 10:00Z', RC.releaseAtFor('2027-04-04') === Z('2027-04-04T10:00:00Z'), new Date(RC.releaseAtFor('2027-04-04')).toISOString());
재기('2월 말(윤년 아님) 2027-02-28 = 09:00Z', RC.releaseAtFor('2027-02-28') === Z('2027-02-28T09:00:00Z'));
재기('되읽기: 시드니 글자', RC.sydneyText(RC.releaseAtFor('2026-10-04')) === '2026-10-04 20:00' && RC.sydneyText(RC.releaseAtFor('2027-04-04')) === '2027-04-04 20:00');
재기('봄 없는 시각 02:30 도 터지지 않는다(앞으로 민다)', RC.sydneyText(RC.sydneyToUtc(2026, 10, 4, 2, 30)).startsWith('2026-10-04 03:'), RC.sydneyText(RC.sydneyToUtc(2026, 10, 4, 2, 30)));
재기('날짜 꼴이 틀리면 null', RC.releaseAtFor('10/9') === null);

console.log('\n── ② 수업일 → 숙제 주차 = 학생 화면과 같은 규칙(3년치 날마다)');
{
  let 다름 = null;
  for (let t = new Date(2026, 0, 1, 12); t < new Date(2029, 0, 1); t = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1, 12)) {
    const a = RC.periodOfYmd(C.ymd(t)), b = C.periodOfDate(t);
    if (JSON.stringify(a) !== JSON.stringify(b)) { 다름 = C.ymd(t) + ' ' + JSON.stringify(a) + ' ≠ ' + JSON.stringify(b); break; }
  }
  재기('release_core.periodOfYmd = prep_core.periodOfDate', !다름, 다름);
  재기('2026-10-09(금) → 10월 2주', JSON.stringify(RC.periodOfYmd('2026-10-09')) === '{"year":2026,"month":10,"week":2}');
}

// ── 시험 자료 ──
function 초안(over) {
  const q = (i, src, extra) => Object.assign({ id: 'q' + i, text: 'What is ' + i + '+1?', type: 'sa', answer: String(i + 1), explanation: 'add', srcId: src + i }, extra || {});
  const d = { _id: 'P_r2_online_x', kind: 'online', planId: 'P', planRev: 2, studentId: 'Mina', jobId: 'J2', sourceDraftId: 'PAPER2', published: false,
    sets: [{ setIdx: 0, title: 'MR Set 1', questions: [q(0, 'mrg-'), q(1, 'mrg-')] },
           { setIdx: 1, title: 'TS Set 2', questions: [q(2, 'ts-', { type: 'mc', options: ['a', 'b', 'c', 'd'], answer: 'B', figure: '<svg viewBox="0 0 1 1"></svg>' }), q(3, 'ts-', { type: 'mc', options: ['a', 'b', 'c', 'd', 'e'], answer: 'E' })] }],
    manifest: [{ itemId: 'mrg-0', src: 'mr', verify: 'verified-agree' }, { itemId: 'mrg-1', src: 'mr', verify: 'verified-agree' }, { itemId: 'ts-2', src: 'ts' }, { itemId: 'ts-3', src: 'ts' }] };
  return Object.assign(d, over || {});
}
const cfg = { mrSets: 1, tsSets: 1, perSet: 2 };
function 상태(over) {
  const base = {
    now: Z('2026-10-09T09:00:00Z'), cause: 'scheduled', planId: 'P', autoRelease: true, profile: { currentCurriculum: 'r1' }, inboxNew: [],
    plan: { latest: 2, revisions: { 2: { studentId: 'Mina', lessonDate: '2026-10-09' } },
      approvals: { 2: { paper: { draftId: 'PAPER2' }, online: { config: cfg, jobId: 'J2' } } },
      schedule: { studentId: 'Mina', lessonDate: '2026-10-09', releaseAt: RC.releaseAtFor('2026-10-09'), state: 'scheduled' } },
    paperDraft: { _id: 'PAPER2', planRev: 2 }, onlineDraft: 초안(), release: null };
  return Object.assign(base, over || {});
}
const 열쇠들 = (r) => r.reasons.map(x => x.key).join(',');

console.log('\n── ③ 온라인 초안 검수');
재기('멀쩡한 초안 = 문제 0', RC.checkOnlineDraft(초안(), cfg).length === 0, JSON.stringify(RC.checkOnlineDraft(초안(), cfg)));
재기('세트 수가 요청과 다르면', RC.checkOnlineDraft(초안(), { mrSets: 2, tsSets: 1, perSet: 2 }).some(x => /세트 수/.test(x)));
재기('세트 문항 수가 요청과 다르면', RC.checkOnlineDraft(초안(), { mrSets: 1, tsSets: 1, perSet: 3 }).some(x => /문항 2 ≠ 요청 3/.test(x)));
{ const d = 초안(); d.sets[0].questions[0].text = ' '; 재기('본문 없음', RC.checkOnlineDraft(d, cfg).some(x => /본문 없음/.test(x))); }
{ const d = 초안(); d.sets[0].questions[1].answer = ''; 재기('정답 없음', RC.checkOnlineDraft(d, cfg).some(x => /정답 없음/.test(x))); }
{ const d = 초안(); d.sets[1].questions[0].answer = 'E'; 재기('정답 글자가 보기 밖', RC.checkOnlineDraft(d, cfg).some(x => /보기 밖/.test(x))); }
{ const d = 초안(); d.sets[1].questions[0].figure = '<img src=x onerror=alert(1)>'; 재기('그림이 SVG 아님 · 실행 코드', RC.checkOnlineDraft(d, cfg).some(x => /SVG 가 아님/.test(x)) && RC.checkOnlineDraft(d, cfg).some(x => /실행 코드/.test(x))); }
{ const d = 초안(); d.manifest[0].verify = 'mismatch'; 재기('MR 검증 안 된 문항', RC.checkOnlineDraft(d, cfg).some(x => /MR 검증 안 됨/.test(x))); }
{ const d = 초안(); d.manifest[0].verify = 'teacher-edited'; 재기('원장이 고친 MR(teacher-edited)은 통과', RC.checkOnlineDraft(d, cfg).length === 0); }
{ const d = 초안(); d.sets[0].questions[0].srcId = 'mrg-남의것'; 재기('명세에 없는 문항(다른 초안·학생 것)', RC.checkOnlineDraft(d, cfg).some(x => /명세\(manifest\)에 없는/.test(x))); }
{ const d = 초안(); d.sets[0].questions[0].teacherNote = '정답은 1'; 재기('모르는 칸(교사용 메모 등)이 섞이면', RC.checkOnlineDraft(d, cfg).some(x => /모르는 칸 teacherNote/.test(x))); }
재기('표본 초안은 공개 안 함', RC.checkOnlineDraft(초안({ sample: true }), cfg).some(x => /표본/.test(x)));

console.log('\n── ④ 공개 조건 — 자동(20:00)');
재기('다 갖춤 + 20:00 → 공개', RC.releaseDecision(상태()).ok, 열쇠들(RC.releaseDecision(상태())));
재기('19:59 → 아직', 열쇠들(RC.releaseDecision(상태({ now: Z('2026-10-09T08:59:00Z') }))) === 'not-yet');
재기('20:01 → 공개', RC.releaseDecision(상태({ now: Z('2026-10-09T09:01:00Z') })).ok);
{ const s = 상태(); s.plan.schedule.state = 'held'; 재기('보류 → 막힘', 열쇠들(RC.releaseDecision(s)) === 'held'); }
{ const s = 상태(); s.plan.schedule.state = 'cancelled'; 재기('휴강 → 막힘', 열쇠들(RC.releaseDecision(s)) === 'cancelled'); }
재기('스위치 꺼짐 → 자동은 막힘', 열쇠들(RC.releaseDecision(상태({ autoRelease: false }))) === 'switch-off');
재기('커리 승인 없음 → 자동은 막힘', 열쇠들(RC.releaseDecision(상태({ profile: {} }))) === 'no-curriculum');
재기('학교 자료 검토 보류 → 막힘', RC.releaseDecision(상태({ profile: { currentCurriculum: 'r1', holdForCurriculum: true } })).reasons.some(x => x.key === 'curriculum-review'));
재기('새 학교 자료 → 막힘', RC.releaseDecision(상태({ inboxNew: [{ status: 'new' }] })).reasons.some(x => x.key === 'curriculum-review'));
{ const s = 상태(); s.plan.approvals[2].paper = null; 재기('교재 승인 없음 → 막힘', RC.releaseDecision(s).reasons.some(x => x.key === 'no-paper-approval')); }
{ const s = 상태(); s.plan.approvals[2].online = null; 재기('온라인 수량 확인 없음 → 막힘', RC.releaseDecision(s).reasons.some(x => x.key === 'no-online-config')); }
재기('온라인 초안 아직 없음 → 막힘', RC.releaseDecision(상태({ onlineDraft: null })).reasons.some(x => x.key === 'no-online-draft'));
{ const s = 상태(); s.plan.latest = 3; s.plan.revisions[3] = { studentId: 'Mina', lessonDate: '2026-10-09' }; s.plan.approvals[3] = s.plan.approvals[2];
  재기('판이 바뀜(판 3) → 옛 초안·옛 승인은 막힘', !RC.releaseDecision(s).ok && RC.releaseDecision(s).reasons.some(x => /stale/.test(x.key)), 열쇠들(RC.releaseDecision(s))); }
재기('다른 수량 주문의 초안 → 막힘', RC.releaseDecision(상태({ onlineDraft: 초안({ jobId: 'J-old' }) })).reasons.some(x => x.key === 'online-stale'));
재기('다른 교재로 만든 초안 → 막힘', RC.releaseDecision(상태({ onlineDraft: 초안({ sourceDraftId: 'PAPER1' }) })).reasons.some(x => x.key === 'online-stale'));
재기('남의 학생 초안 → 막힘', RC.releaseDecision(상태({ onlineDraft: 초안({ studentId: 'Aron' }) })).reasons.some(x => x.key === 'wrong-target'));
재기('미완성(문항 빠짐) → 막힘', RC.releaseDecision(상태({ onlineDraft: (() => { const d = 초안(); d.sets[0].questions.pop(); return d; })() })).reasons.some(x => x.key === 'incomplete'));
재기('이미 공개 → 「이미」 하나만', 열쇠들(RC.releaseDecision(상태({ release: { published: true } }))) === 'already');

console.log('\n── ⑤ 공개 조건 — 원장 공개(조기)');
재기('19:00 원장 공개 → 됨(시각 안 봄)', RC.releaseDecision(상태({ cause: 'manual', now: Z('2026-10-09T08:00:00Z') })).ok);
재기('스위치 꺼져도 원장 공개는 됨', RC.releaseDecision(상태({ cause: 'manual', autoRelease: false })).ok);
{ const s = 상태({ cause: 'manual' }); s.plan.schedule.state = 'held'; 재기('보류면 원장 공개도 막힘(먼저 해제)', 열쇠들(RC.releaseDecision(s)) === 'held'); }
{ const s = 상태({ cause: 'manual' }); s.plan.schedule.state = 'cancelled'; 재기('휴강이면 원장 공개도 막힘', 열쇠들(RC.releaseDecision(s)) === 'cancelled'); }
재기('미완성이면 원장 공개도 막힘', !RC.releaseDecision(상태({ cause: 'manual', onlineDraft: 초안({ sample: true }) })).ok);

console.log('\n── ⑥ 공개 묶음');
{
  const r = RC.buildRelease(초안(), { studentId: 'Mina', planId: 'P', planRev: 2, lessonDate: '2026-10-09', nowIso: '2026-10-09T09:00:00.000Z', cause: 'scheduled' });
  재기('세트 = s1·s2 (차례 그대로)', Object.keys(r.sets).join() === 's1,s2' && r.sets.s1.title === 'MR Set 1' && r.sets.s2.order === 1);
  재기('주차 = 수업일이 든 주 · 대상·판·원인', JSON.stringify(r.period) === '{"year":2026,"month":10,"week":2}' && r.studentId === 'Mina' && r.planRev === 2 && r.cause === 'scheduled' && r.published === true);
  재기('문항 칸은 정해진 것만(그림 포함)', Object.keys(r.sets.s2.questions[0]).sort().join() === 'answer,explanation,figure,id,options,srcId,text,type');
  const d2 = 초안(); d2.sets[1].questions[0].answer = 'C';
  재기('정답이 바뀌면 manifestHash 가 바뀐다', RC.manifestHashOf(초안(), 2) !== RC.manifestHashOf(d2, 2));
  const d3 = 초안(); d3.sets[1].questions[0].options = ['b', 'a', 'c', 'd'];
  재기('보기 차례가 바뀌면 manifestHash 가 바뀐다', RC.manifestHashOf(초안(), 2) !== RC.manifestHashOf(d3, 2));
  재기('판이 다르면 manifestHash 가 바뀐다', RC.manifestHashOf(초안(), 2) !== RC.manifestHashOf(초안(), 3));
}

console.log('\n── ⑦ 온라인 수량 확인');
재기('멀쩡', RC.checkOnlineConfig({ mrSets: 6, tsSets: 0, perSet: 20 }).length === 0);
재기('세트 0개', RC.checkOnlineConfig({ mrSets: 0, tsSets: 0, perSet: 20 }).some(x => /하나도/.test(x)));
재기('정수 아님 · 범위 밖', RC.checkOnlineConfig({ mrSets: 1.5, tsSets: -1, perSet: 0 }).length === 3);

console.log('\n── ⑧ 영향 영역(화면 셈)');
{
  const man = [{ slot: 'm001', section: 'test', src: 'mr' }, { slot: 'm011', section: 'book', src: 'mr' }, { slot: 't034', section: 'hw', src: 'ts' }];
  const a = C.affectedAreas(man, [{ slot: 'm001', action: 'edit' }], null);
  재기('앞장 문항 고침 → 테스트지·학생용 전체·교사용 답지·원본·검수', a.files.join() === 'items,qa,student,teacher,test', a.files.join());
  const b = C.affectedAreas(man, [], { fontSize: 12 });
  재기('조판만 → PDF 다섯 · 내용 유지', b.files.join() === 'book,hw,student,teacher,test' && b.contentKept === true, JSON.stringify(b));
  const c = C.affectedAreas(man, [{ slot: 't034', action: 'regenerate' }], null, { approved: true });
  재기('승인한 교재를 고치면 승인·홈페이지 초안도 무효라고 알린다', c.voids.indexOf('교재 승인') >= 0 && c.voids.indexOf('홈페이지 숙제 초안') >= 0, JSON.stringify(c));
}

console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
process.exit(실패 ? 1 : 0);
