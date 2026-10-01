# prep_worker — 5단계 PC 제작 일꾼

확정된 제작 주문(`sol_prep_v1/jobs`)을 집어서 테스트지·교재·종이 숙제 PDF와 교사용 답지를 만들고, 초안(`sol_prep_v1/drafts`)으로 기록합니다.

**10-01 원장 결정:** 파일 저장소(Storage)는 쓰지 않는다. PDF·답지·원본 JSON 은 드라이브 `Solomon_교재보관/학생별 교재/<학생>/<수업일>/판N/` 에 둔다(원장만 보고 인쇄 · 학생은 홈페이지 온라인 숙제만).
학교 사진은 원장이 휴대폰 드라이브 앱으로 `학생별 커리/<학생>/학교자료` 에 올리고, 일꾼이 한 바퀴마다 새 파일을 찾아 `sol_prep_v1/inbox` 에 적는다 → /prep/ 「새 자료 → 커리 먼저 검토」.
저장소 코드(`fb.upload`·다운로드 토큰 지우기·`--archive`)는 지우지 않고 `output:'storage'` 일 때만 돈다(꺼 둠).

## 실행 방식 (두 가지)
| 방식 | 언제 | 명령 |
|---|---|---|
| **반자동(기본)** | 원장님이 Claude Code 에 「확정 주문 처리해」 | `node prep_worker/일꾼.js --once` |
| 완전 자동 | `C:/솔로몬제작/설정.json` 의 `mode` 가 `auto` **이고** /prep/ 「지난 교재」의 「완전 자동 켜기」가 켜졌을 때만 | `node prep_worker/일꾼.js --watch` |

- 표본(한도 아끼기): `--sample 2` → MR·TS 각 2문항만.
- (꺼 둠) 승인 뒤 드라이브 복사 `--archive` — 이제 처음부터 드라이브에 저장하므로 쓰지 않는다.

## 지키는 선
- 생성은 Claude Code 구독만(`allowApi:false` 가 아니면 일꾼이 뜨지 않음). 자식 환경에서 `ANTHROPIC_API_KEY` 를 지운다.
- 작업별 모델은 설정 `models`(처음: 생성·검증 opus, 형식 정리 haiku). **실제로 돈 모델**은 Claude 가 돌려준 값으로 기록한다.
- 호출은 설명 파일이 최소인 `C:/솔로몬제작/작업실` 에서 도구·MCP 를 끄고 한다(바탕 글 실측 ≈27,000 → 539 토큰).
- 주문마다 토큰을 세고 `maxTokensPerJob` 을 넘기 전에 멈춘다 → 주문이 「보류(token-cap)」가 되고 /prep/ 에 뜬다.
- 일꾼은 `ts-worker` 사용자로 로그인해서 쓴다 — 숙제 칸·공개 과제·제출·확정 판은 **규칙이 막는다**.
- 드라이브 저장은 덮어쓰지 않고, 복사 뒤 다시 읽어 해시를 확인한다. Claude 가 요청을 막으면 보류(`claude-blocked`)로 두고 까닭을 /prep/ 에 띄운다.

## 파일
- `core.js` 셈(명세→칸, 검사, 재풀이 대조, 잠금, 토큰, manifest) · `fb.js` DB·저장소 · `claude.js` Claude 부르기
- `조판.py` 문항 JSON → PDF(기존 툴체인 `core/preamble.tex`) · `ts_고르기.py` TS 창고에서 고르기
- 시험: `prep_worker/시험/core.test.js` · `functions/에뮬레이터시험/일꾼.emu.js`
