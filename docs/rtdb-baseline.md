# RTDB 내려받기 요금 — 기준선 (묶음 1)

잰 날: 2026-10-02 (Sydney) · 브랜치 `fix/rtdb-bandwidth` (출발점 `6ebd75a` = origin/main)

## 1. 운영본 대조

| 대상 | 결과 | 어떻게 쟀나 |
|---|---|---|
| `index.html` | ✅ 같다 · SHA-256 `283950aa041af4a3…69e5e7` · 885,488바이트 | solomonacademy.com.au 를 받아 해시 / 로컬 해시 |
| DB 규칙 | ✅ 같다 (8,225자) | `firebase database:get /.settings/rules` → `backup/rtdb_bandwidth_20261002/live_rules.json` 과 `backup/database.rules.json` 을 JSON 으로 견줌 |
| 함수 | ⏸ **아직 못 견줌** | `functions:list` 로 이름만 봄. 배포된 소스·배포 시각을 읽으려면 원장님 로그인 열쇠를 꺼내야 해서 멈춤 → 원장님이 콘솔에서 확인하시거나 허락 필요 |
| 자동 검사 | ✅ 통과 676 · 실패 0 | `node functions/화면시험/돌리기.js` |

## 2. 청구 기준선

| 항목 | 값 | 출처 |
|---|---|---|
| 9월 RTDB Outgoing Bandwidth | 49GB = AU$53.85 | 지시서 §1 (원장님 명세) |
| SKU별 수량·무료분·GST·크레딧, 일일 추이 | ⏸ **아직 안 적음** | GCP 결제 보고서는 원장님 화면에서만 열림 |

## 3. 자료 크기 (잰 값)

| 가지 | 2026-08-25 | 2026-10-02 |
|---|---:|---:|
| `solomon_hw_v3` 전체 | 7,656,865 | **15,298,382** |
| `homeworkSets` (220주차) | 5,698,061 | **12,613,415** |
| `submissions` (1,114칸) | 1,622,137 | 2,277,335 |
| `reports` | 160,127 | 227,013 |
| `taxonomy_mr` | 139,775 | 139,775 |

⇒ 루트를 통째 받는 한 번이 8월의 두 배다. 요금은 「받는 횟수 × 크기」라서 숙제가 쌓일수록 같은 사용에도 오른다.

`homeworkSets` 안쪽(바이트): MR 그림 1.93M · TS 그림 1.89M · MR 문제글 1.62M · MR 해설 1.58M · MR 보기 1.00M · TS 해설 0.87M · TS 문제글 0.51M.
가장 큰 한 주 = `AU_y5_2026_m09_w2` 848,607 (그중 MR 그림 721,375).

## 4. 백업 (묶음 1)

위치 `backup/rtdb_bandwidth_20261002/` — **커밋하지 않음**(학생 자료).

| 파일 | 바이트 | SHA-256 앞 16자 |
|---|---:|---|
| `live_rules.json` | 11,884 | A5B34DED6B9C6FE4 |
| `db/solomon_hw_v3.json` | 15,298,383 | 16C496B04EBB6A45 |
| `db/sol_v4.json` | 1,206,835 | 7E0A5661F8A7EA62 |
| `db/lt_results.json` | 1,030 | 2C0C5AD507535A1C |
| `db/store.json` | 134,003 | C94631B78397B62B |
| `db/solomon_auth.json` | 9,047 | E60AD00395E63293 |
| `db/rate_limits.json` | 4,217 | F0F41E8444F04E2E |
| `db/master_login_logs.json` | 7,291 | 36A260BD5CA818D4 |

일곱 다 JSON 으로 열림을 확인함. `solomon_backups`(옛 백업 묶음, 10-01 에 416MB)는 이번에 다시 받지 않았다 — 어제 받은 `backup/firebase_backup_2026-10-01/solomon_backups.json` 이 있다.
코드 쪽 되돌릴 자리 = 커밋 `6ebd75a` (운영과 같음).
