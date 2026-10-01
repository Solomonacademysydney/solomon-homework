// /prep/ 5단계 방향 바꿈(10-01) — 저장소(Storage) 대신 구글 드라이브(prep/prep_core.js)
//   원장 지시: PDF 는 원장만 보고 인쇄 · 교재 PDF·답지·원본 JSON 은 드라이브 Solomon_교재보관 학생별·주차별 폴더
//            「지난 교재」는 드라이브 파일을 여는 방식 · 학교 사진은 원장이 휴대폰 드라이브 앱으로 학생별 커리\학생\학교자료 에 올림
//            PC 일꾼이 새 파일을 찾으면 /prep/ 에 「새 자료 → 커리 먼저 검토」 · /prep/ 에서 직접 올리기는 뺌
'use strict';
const path = require('path');
const fs = require('fs');
const C = require(path.join(__dirname, '..', '..', 'prep', 'prep_core.js'));
let 통과 = 0, 실패 = 0;
function 재기(이름, 참, 덧) { if (참) { 통과++; console.log('  ✅ ' + 이름); } else { 실패++; console.log('  ⛔ ' + 이름 + (덧 ? '\n       ' + 덧 : '')); } }
for (const f of ['inboxImports', 'driveSearchUrl', 'hasNewSchoolFiles']) {
  if (typeof C[f] !== 'function') { console.log('  ⛔ prep_core 에 ' + f + ' 가 없다'); 실패++; }
}
if (실패) { console.log('\n셈 — 통과 0 · 실패 ' + 실패); process.exit(1); }

console.log('── 새 학교 자료(일꾼이 드라이브에서 찾은 것) → 커리 먼저 검토');
{
  const inbox = { f1: { name: '시험범위.jpg', rel: '학생별 커리/민아/학교자료/시험범위.jpg', size: 10, status: 'new', foundAt: '2026-10-02T01:00:00Z' },
    f2: { name: '옛것.pdf', rel: '학생별 커리/민아/학교자료/옛것.pdf', status: 'imported', sourceId: 'drive_f2' } };
  재기('새 파일이 있으면 「새 자료」', C.hasNewSchoolFiles(inbox) && !C.hasNewSchoolFiles({ f2: inbox.f2 }) && !C.hasNewSchoolFiles(null));
  const r = C.inboxImports(inbox, {});
  재기('새 파일 하나 → 학교 자료 한 줄(올림 단계 · 드라이브에서 옴)', r.length === 1 && r[0].inboxId === 'f1' && r[0].sourceId === 'drive_f1'
    && r[0].source.status === 'uploaded' && r[0].source.via === 'drive' && r[0].source.driveRel === inbox.f1.rel && r[0].source.name === '시험범위.jpg', JSON.stringify(r));
  재기('가져온 자료가 생기면 「커리 먼저 검토」(3단계 셈 그대로)', C.needsCurriculumReview({ [r[0].sourceId]: r[0].source }));
  재기('이미 같은 자료가 있으면 또 만들지 않는다', C.inboxImports(inbox, { drive_f1: { status: 'confirmed' } }).length === 0);
  재기('자료 id 는 화면·DB 열쇠로 안전한 글자만', /^[A-Za-z0-9_-]+$/.test(C.inboxImports({ 'a.b/c': { name: 'x', status: 'new' } }, {})[0].sourceId));
}

console.log('\n── 드라이브 파일 열기(「지난 교재」·학교 자료)');
{
  const u = C.driveSearchUrl('2026-10-06_민아_판1_테스트지.pdf');
  재기('드라이브 검색 주소(파일 이름 그대로 찾기)', u.startsWith('https://drive.google.com/drive/search?q=') && decodeURIComponent(u.split('q=')[1]).includes('"2026-10-06_민아_판1_테스트지.pdf"'), u);
  재기('이름이 없으면 빈 주소', C.driveSearchUrl('') === '');
}

console.log('\n── 화면에서 직접 올리기는 뺐다 · 저장소는 꺼 둠(지우지 않음)');
{
  const h = fs.readFileSync(path.join(__dirname, '..', '..', 'prep', 'index.html'), 'utf8');
  재기('저장소 스위치가 꺼져 있다(저장소사용 = false)', /const 저장소사용 = false;/.test(h));
  재기('학교 자료 칸에 파일 고르기 입력이 그려지지 않는다(꺼짐일 때)', /저장소사용 \? `[^`]*id="자료파일"/.test(h) || !/id="자료파일"/.test(h));
  재기('「지난 교재」는 드라이브로 연다(driveSearchUrl)', /driveSearchUrl\(/.test(h));
  재기('저장소에서 받는 코드는 남아 있되 꺼짐 스위치 뒤에 있다', /function 파일받기/.test(h) && /if \(!저장소사용\)/.test(h));
}

console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
process.exit(실패 ? 1 : 0);
