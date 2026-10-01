# prep_worker — 5단계 PC 제작 일꾼

확정된 제작 주문(`sol_prep_v1/jobs`)을 집어서 테스트지·교재·종이 숙제 PDF와 교사용 답지를 만들고, 초안(`sol_prep_v1/drafts`)으로 올립니다.

## 실행 방식 (두 가지)
| 방식 | 언제 | 명령 |
|---|---|---|
| **반자동(기본)** | 원장님이 Claude Code 에 「확정 주문 처리해」 | `node prep_worker/일꾼.js --once` |
| 완전 자동 | `C:/솔로몬제작/설정.json` 의 `mode` 가 `auto` **이고** /prep/ 「지난 교재」의 「완전 자동 켜기」가 켜졌을 때만 | `node prep_worker/일꾼.js --watch` |

- 표본(한도 아끼기): `--sample 2` → MR·TS 각 2문항만.
- 승인된 교재 드라이브 복사: `--archive <초안id> --root <폴더>`(설정 `archive.enabled` 가 꺼져 있으면 임시 폴더만 받음).

## 지키는 선
- 생성은 Claude Code 구독만(`allowApi:false` 가 아니면 일꾼이 뜨지 않음). 자식 환경에서 `ANTHROPIC_API_KEY` 를 지운다.
- 작업별 모델은 설정 `models`(처음: 생성·검증 opus, 형식 정리 haiku). **실제로 돈 모델**은 Claude 가 돌려준 값으로 기록한다.
- 호출은 설명 파일이 최소인 `C:/솔로몬제작/작업실` 에서 도구·MCP 를 끄고 한다(바탕 글 실측 ≈27,000 → 539 토큰).
- 주문마다 토큰을 세고 `maxTokensPerJob` 을 넘기 전에 멈춘다 → 주문이 「보류(token-cap)」가 되고 /prep/ 에 뜬다.
- 일꾼은 `ts-worker` 사용자로 로그인해서 쓴다 — 숙제 칸·공개 과제·제출·확정 판은 **규칙이 막는다**.
- 저장소 파일은 올린 직후 공개 다운로드 토큰을 지우고 다시 읽어 확인한다(에뮬레이터는 미지원이라 건너뜀).

## 파일
- `core.js` 셈(명세→칸, 검사, 재풀이 대조, 잠금, 토큰, manifest) · `fb.js` DB·저장소 · `claude.js` Claude 부르기
- `조판.py` 문항 JSON → PDF(기존 툴체인 `core/preamble.tex`) · `ts_고르기.py` TS 창고에서 고르기
- 시험: `prep_worker/시험/core.test.js` · `functions/에뮬레이터시험/일꾼.emu.js`
