// [11-13] 일꾼 「수업요약찾기」 — 가짜 교재보관 폴더 · 가짜 DB 로(진짜 드라이브·DB 안 씀)
//   node prep_worker/시험/수업요약찾기.test.js
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const W = require(path.join(__dirname, '..', '일꾼.js'));
let 통과 = 0, 실패 = 0;
function 재기(이름, 참, 더) { if (참) { 통과++; console.log('  ✅ ' + 이름); } else { 실패++; console.log('  ⛔ ' + 이름 + (더 ? '\n       ' + 더 : '')); } }

(async () => {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), '수업요약_'));
  const 오늘 = new Date().toISOString().slice(0, 10);
  const 달 = 오늘.slice(0, 7);
  const 옛 = path.join(뿌리, 달, 오늘); fs.mkdirSync(옛, { recursive: true });
  const 새 = path.join(뿌리, 달, 'W2', 오늘 + '(월)', '별이'); fs.mkdirSync(새, { recursive: true });
  const 바른 = { type: 'solomon_lesson_summary', version: 1, lessonDate: 오늘, topic: '좌표평면', learned: [{ title: '좌표', desc: '읽기' }], test: { title: 'T', questions: [{ n: 1, unit: '좌표' }] }, homework: [] };
  fs.writeFileSync(path.join(옛, 'Y4_C2W3_수업요약.json'), '﻿' + JSON.stringify(Object.assign({}, 바른, { studentIds: ['Hayley04'] })));
  fs.writeFileSync(path.join(새, '별이_수업요약.json'), JSON.stringify(바른));   // ID 없음 → 폴더 연결로
  fs.writeFileSync(path.join(옛, '깨진_수업요약.json'), '{ 이건 JSON 아님');
  fs.writeFileSync(path.join(옛, '틀린꼴_수업요약.json'), JSON.stringify({ type: 'x' }));
  const 쓴 = [];
  const fb = { get: async (p) => (p.endsWith('/driveFolders') ? { '별이': 'Stella07' } : null), put: async (p, v) => { 쓴.push([p, v]); } };
  const cfg = { drive: { base: 뿌리 }, workRoot: path.join(뿌리, '_작업'), summaryState: path.join(뿌리, '상태.json'), importDays: 400, workerId: '시험', logFile: path.join(뿌리, '_기록', '작업기록.jsonl') };
  const r = await W.수업요약찾기(cfg, fb);
  재기('바른 파일 둘 올림', r.올림.length === 2, JSON.stringify(r));
  재기('깨진 JSON·틀린 꼴은 실패로만', r.실패.length === 2, JSON.stringify(r.실패));
  재기('ID 적힌 파일 → lessonSummaries/Hayley04/…', 쓴.some(([p]) => /^sol_prep_v1\/lessonSummaries\/Hayley04\/[0-9a-f]{16}$/.test(p)));
  재기('ID 없는 파일 → 폴더 연결로 Stella07', 쓴.some(([p, v]) => /lessonSummaries\/Stella07\//.test(p) && v.folder.includes('W2')));
  재기('올린 자료에 파일 이름·배운 내용', 쓴.every(([, v]) => v.file && v.learned.length === 1));
  const r2 = await W.수업요약찾기(cfg, fb);
  재기('두 번째 바퀴엔 다시 안 올림', r2.올림.length === 0 && r2.실패.length === 0 && 쓴.length === 2);
  fs.rmSync(뿌리, { recursive: true, force: true });
  console.log('\n셈 — 통과 ' + 통과 + ' · 실패 ' + 실패);
  process.exit(실패 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
