# 저장 약속 (정비 §5-0 · 2026-10-03)

「홈페이지정비 최종작업지시서 1003」 §5. 학생 답·제출을 **누가 · 어느 항목만** 쓰는지 정한다.

## 지금 (10-03 코드 조사)
- 제출 칸을 쓰는 곳 30곳(`fbSetSubmission` 27 · `fbSetTSProgress` 3) — **30곳 모두 칸 통째를 이 기기 사본으로 덮는다.**
- 위험 큰 셋: 학생이 문항 하나 고를 때마다 칸 통째(`saveAnswer`) · 교사 카톡이 교사 사본으로 학생 칸 통째(`generateAndShowKakao`) · TS 답·하루 끝(`submitTSAnswer`·`completeTSDay`)이 다른 날·다른 기기 기록까지 통째
- `rev` 는 최종 제출(`doSubmit`) 한 곳에서만 올린다(MR만 · TS 없음). 일반 쓰기는 `rev` 를 안 본다.
- 다시 보내기 줄: 칸 통째를 넣는다 · 학생·학부모의 `sid_` 열쇠만 받는다 ⇒ **교사 쓰기와 TS(`ts_`)는 줄에 안 들어간다** · 15분·20개 넘으면 버림 · 계정 바뀌면 앞 사람 것 버림 · 글자 답 판단 거부 · 같은 문제는 줄이 이김 · 비우는 중 새 일 지움
- 칸 모양 — MR: `answers{q}` · `submitted` · `submitTime` · `rev` · `hwKey` · `celebrationShown` · `reportData{… kakaoMsg, kakaoGeneratedAt, remediation[]}` · `remediation{currentRound, rounds[…], final…}` · `_prev[]` · `manuallyMarked`·`marked*` / TS: `dayN{answers{qK{selected, attempts, correct, wrongAttempts[], hint1_used, hint2_used, revealed}}, completed, completed_at}`

## 갈래와 최소 쓰기 경로
| 갈래 | 자리(함수) | 쓸 경로 | 상태 |
|---|---|---|---|
| ① 칸 처음 만들기 | renderStudent | 안 씀(답 쓸 때 생김) | |
| ② 학생 답 하나 | saveAnswer · answerSA | `answers/<q>` | **saveAnswer 시범 ✅** · answerSA 남음 |
| ③ 최종 제출 | doSubmit | `submitted`·`submitTime`·`rev`·`hwKey`·`reportData/<자기 칸>` — **트랜잭션**(서버 rev 보다 클 때만) | |
| ④ 표시 깃발 | doSubmit 5초 뒤 · 보충 화면 | 그 깃발 하나 | |
| ⑤ 보충 진행 | 보충 함수 13곳 | `remediation/…/<q>` 그 항목 | |
| ⑥ 보충 제출 | submitPracticeSet | `…/practiceSubmitted` · `reportData/remediation/<n>` | |
| ⑦ 새로 풀기 | startFreshSet | `_prev/<n>` 더하고 답·제출·리포트·보충 비우기 — **트랜잭션** · `kakaoMsg` 는 남길지 결정 | |
| ⑧ 교사 처리 | markSubmissionByTeacher | **그 칸 트랜잭션**: 정상 제출이 있으면 중단 · 없을 때만 `submitted`·`submitTime`·`marked*` · 답 보존 | |
| ⑨ 교사 카톡 | generateAndShowKakao | `reportData/kakaoMsg`·`kakaoGeneratedAt` | **✅ 시범** |
| ⑩ TS 답 하나 | submitTSAnswer | `ts_…/day<N>/answers/<qK>` | |
| ⑪ TS 하루 끝 | completeTSDay | `…/day<N>/completed`·`completed_at` | |
| ⑫ TS 옛 자료 옮기기 | _migrateTSAnswers | 바뀐 `…/correct` 들만 | |

## 충돌 방침(§5-2)
- 다른 문제의 답은 각각 보존(항목 쓰기로 저절로).
- 같은 문제에 다른 답: **서버 값을 덮지 않고 「확인 필요」로 남긴다**(이 기기 `solomon_fb_retry_conflicts`) — 원장님이 볼 화면은 「꼭」 안에서 만든다.
- 제출된 칸의 답은 바꾸지 않는다(지금 화면 약속과 같음). 객관식 첫 답 고정 · TS 시도 제한 유지.

## 다시 보내기 줄(시범 반영분)
- 항목 경로(`submissions/<key>/<…>`)는 그 항목만 견준다: 서버에 없음 → 보냄 · 같음 → 끝 · 제출된 칸의 답 → 안 바꿈 · 다른 값 → 「확인 필요」.
- 남은 것(「꼭」): 작업마다 열쇠 하나(두 탭 안전 · T09·T10) · 15분·20개·계정 바뀜에 버리지 않기 · `ts_` 받기 · 교사 쓰기 줄 · 옛 줄 이전.

## 옛 탭 보호(T17 · T27)
- 규칙: `submissions/$key` 쓰기는 새 `rev` 가 서버보다 낮지 않을 때만 — 옛 코드의 낡은 통째 쓰기를 거부. §3 의 다음 규칙 배포와 묶는다.
- 거부된 옛 탭 입력은 줄에 남아 새 코드로 다시 로그인하면 보내진다(T14).

## 10-03 저녁 — 「꼭」 가~마 로컬 완료 (배포 전)
- 가: `markSubmissionByTeacher` = 그 칸 트랜잭션(`fbTxSubmission` 새로) · 서버에 정상 제출 있으면 중단 · 답·보충·rev 보존 / `doSubmit` = 항목 묶음(답들·submitted·submitTime·rev·hwKey·reportData + 원장 처리 표시 null) / `startFreshSet` = 서버 칸 읽고 항목만(보관함 `_prev` 포함) / `renderStudent` 빈 칸 = 서버에 없을 때만 트랜잭션 / `answerSA` 답 하나(문항마다 늦춤 따로) / 깃발 `celebrationShown` 하나
- 나: 보충학습 18곳 → `fbSetRemediation`(remediation 가지 · 보충 제출은 reportData/remediation 도)
- 다: TS 답 = `day<N>/answers/<q>` 하나 · 하루 끝 = completed·completed_at · 옛 자료 옮기기 = 바뀐 correct 들만 · **TS 도 다시 보내기 줄에 든다**
- 라: 줄 = 일 하나에 열쇠 하나(`solomon_fbq_…`) · 15분·20개 버림 없앰 · 형제 줄 보존 · 비우는 중 새 일 보존 · 옛 배열 줄은 옮긴 뒤 지움 · 저장 공간 부족 즉시 알림 · 제출 묶음은 한 덩어리 판단(서버 rev ≥ 내 rev 면 건너뜀) · 답 충돌 → `_conflicts` 칸 + 이 기기 기록 · 거부된 줄 → 「확인 필요」로 옮기고 지움
- 마: 규칙 `backup/database.rules.정비5.json`(= 권한1003 + 제출 칸): 학생은 **칸 통째를 못 쓴다(없을 때 만들기만)** · `answers` 는 제출된 칸이면 못 바꿈(새로 풀기 묶음은 됨) · `rev` 는 뒤로 못 감 · 그 밖 항목은 본인
- 남은 `fbSetSubmission`·`fbSetTSProgress` 호출 = 0(함수 정의만)
- 시험: 화면시험 820/0(새 `답저장_항목만` 34 · 고친 `제출처리`·`약점_반영`·`다시보내기_답비교`) · 에뮬레이터 495/0(새 `규칙_저장` 23 · 정비5 판으로 전부)
- 브라우저(에뮬레이터 · 정비5 규칙): 학생 emu9 로그인 → 객관식·주관식 답 → 제출 → 서버 칸 = 답 둘·submitted·rev 1·reportData(100점) — 정상

### 10-03 저녁 브라우저 시험(에뮬레이터 · 정비5 규칙 · 「두 기기」 = 다른 포트 = 따로인 기기 사본)
| 시험 | 어떻게 | 결과 |
|---|---|---|
| T01 두 기기 · 다른 문제 | 기기 A(5000) 1번=B · 기기 B(5056) 2번=6 | ✅ 서버에 둘 다(`q0:B · q1:6`) — 예전엔 B 의 통째 쓰기가 A 의 답을 지웠다 |
| T17·T27 옛 탭 + 새 규칙 | 옛 판(main=운영 중) 을 5055 로 띄워 같은 아이로 1번을 C 로 바꿈 | ✅ 규칙이 거부 · 서버 그대로(B) · 옛 탭 화면도 B 로 돌아감 |
| T15 TS | Day1 1번 C(틀림)→힌트1→B(맞음) · 2번 C · 하루 끝 | ✅ 서버 `attempts 2·wrongAttempts[C]·hint1_used` · `completed·completed_at` · 화면 Day1 50% |
| T03 원장 처리 중 아이 제출 | 원장 「처리하기」 창을 연 채 서버에 아이 제출을 넣고 확인 | ✅ 서버 = 아이 제출 그대로(점수 100 · 원장 처리 표시 없음) |
| 기본 흐름 | 학생 로그인·답·제출 / 원장 로그인·현황 | ✅ |
- 옛 일(무관): 원장 로그인 때 `cleanupLegacyApiKey` 의 PERMISSION_DENIED 는 그대로(규칙에 그 칸 쓰기가 없음).

### 운영 배포 (2026-10-03 토 18:28 시드니 · 원장 지시 「배포하고 계속」)
- 배포 전 운영 DB 마지막 쓰기 17:07(1시간 20분 조용함 — 값 하나 읽음)
- ① 규칙 `database.rules.정비5.json` → `firebase deploy --only database` → 운영 규칙을 다시 받아 **같음** 확인
- ② 화면 `main` 5916247 → 3facc2f push → 약 45초 뒤 운영 `index.html` 지문 = 커밋 확인
- 되돌리기: 규칙 = `database.rules.권한1003.json` 을 `database.rules.json` 으로 덮고 `firebase deploy --only database` · 화면 = 5916247 로 되돌리는 커밋 push. 새 코드는 항목만 쓰므로 되돌려도 그 사이 답은 남는다.

### 10-03 밤 — Codex 점검 뒤 고친 판(898c3c3 · 5b517c0) 브라우저 시험 (에뮬레이터 · 함수 에뮬레이터 · 정비6 규칙)
| 시험 | 결과 |
|---|---|
| 새 화면 제출 → hwSubmit(서버 채점·리포트·opId) | ✅ 서버 칸 submitted·rev 1·점수 100·lastSubmitOp · 줄에서 지워짐 |
| ① 옛 창 제출(이 창은 B · 서버는 다른 창이 C) | ✅ 서버 C 유지 · B 는 `_conflicts` · 점수 50(서버 답 기준) · 이 창 화면도 C 로 맞춰짐 |
| 옛 판(운영 3facc2f) 탭이 정비6 규칙에서 제출 | ✅ 규칙이 거부 · 서버 칸 그대로(미제출 · 답 보존). ⚠ 옛 화면은 「저장 확인 중 — 다시 풀 필요 없음」 안내를 띄운다(옛 코드의 말) → 그 아이는 새로고침 뒤 **다시 제출**해야 한다 |
- 메모: 이 함수 에뮬레이터는 화면과 **같은 칸(demo-solomon)** 에 쓴다(시험자료_심기.js 의 「다른 칸」 메모는 이 함수에는 해당 안 됨 — 실측).
- 브라우저로 안 돌린 것: 끊김 30분·새로고침(단위 시험 R7)·두 탭 동시 재전송(단위 R4)·새로 풀기 단추(에뮬레이터 시험 R5 — 화면 confirm 창 때문에 자동 조작 안 함)·휴대폰.

### 아직 안 한 것(바 — 정직하게)
- 브라우저로 안 돌린 것(단위·규칙 시험으로만): 끊김 30분(T06)·새로고침(T07)·형제 로그인(T08)·두 탭 동시 재전송(T10)·응답 유실·중복 클릭(T13)·새로 풀기 단추·보충학습 화면(AI 필요)·AI 해설·게임(T24)·모바일(T26).
- 「확인 필요」를 원장님이 볼 화면은 안 만듦(서버 `_conflicts` 칸에 남기만 함).
- ⚠ 배포 직후: 배포 **전부터 열려 있던 학생 탭**은 옛 코드라 이미 있는 칸에 쓰면 규칙이 거부한다 → 그 탭은 「쓰기 거부」 안내와 함께 사본이 서버 값으로 돌아간다(답 하나를 다시 골라야 함). 새로고침하면 끝 ⇒ 배포는 숙제 적은 때 · 배포 뒤 「새로고침」 안내.

## 시범으로 잰 것(10-03)
- 고친 곳: ② saveAnswer · ⑨ 카톡 · 다시 보내기 줄의 항목 경로 판단
- 시험: `functions/화면시험/답저장_항목만.test.js` 10 · 화면시험 전체 790/0 · 에뮬레이터 묶음 472/0
- **배포 안 함** — 지시서: T04·T05·T10·T13·T17·T27 이 통과하기 전에는 저장 수정을 올리지 않는다.
