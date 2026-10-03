# 서버 일일 백업 (Firebase RTDB 기본 자동 백업)

「홈페이지정비 최종작업지시서 1003」 §2. 2026-10-03 확인.

## 설정 (원장님 콘솔 화면 · 10-03 캡처)
- **이미 켜져 있었다.** 데이터베이스 `solomon-76715-default-rtdb` · 매일 · 저장 통 `solomon-76715-default-rtdb-backups`
- 시각: 매일 01:42 UTC(시드니 11:42) 무렵 · 화면에 9-27 ~ 10-03 하루도 빠짐없음 · 한 번에 38~56초
- 파일 둘: `<시각>_solomon-76715-default-rtdb_data.json.gz` · `…_rules.json.gz`
- 크기(압축): 66.6MB(9-27) → 71.2MB(10-03) — 대부분 DB 안 옛 백업 묶음(`solomon_backups` 약 450MB 풀린 크기)
- 저장 통(10-03 클라우드 콘솔에서 읽기만): 위치 `asia-southeast1`(싱가포르) · Standard · 보호 = 소프트 삭제 켜짐 · **수명 주기 = 만든 지 30일 지나면 삭제**(규칙 1개)
- 권한(주 구성원 11): 프로젝트 소유자 · `backups@firebase-prod`(백업 서비스 — 꼭 남길 것) · `firebase-adminsdk-fbsvc`(서버 함수용) · 기본 compute · cloudbuild · 구글 서비스 에이전트들(함수·Run·Eventarc·컨테이너·Firebase 관리). **`allUsers`·`allAuthenticatedUsers` 없음.** 학생·학부모(Firebase Auth)는 이 체계에 없다.
- ⚠ 「공개 액세스: 객체 ACL 적용」 = 공개 액세스 방지가 **꺼져 있다** + 객체별 ACL 허용. 지금 공개 구성원은 없지만, 누가 파일 하나를 공개로 바꾸면 막을 장치가 없다 ⇒ 「공개 액세스 방지」 켜기를 권함(원장님 승인 필요 · 설정 변경).
- `firebase-adminsdk` 계정이 이 통을 볼 수 있다 = 서버 함수가 이론상 읽을 수 있다(프로젝트에서 물려받은 권한). 지금 함수 코드에 이 통을 읽는 곳은 없음.
- ⏸ 아직 모름: 단가·통화(청구 화면)

## 내용 확인 (10-02 · 10-03 두 벌 · 원장님이 내려받아 로컬에서 열어 봄)
- gzip 정상 · 풀린 크기 466.5MB(10-02) / 472.0MB(10-03)
- 맨 위 9칸 **다 있음**: `lt_results` · `master_login_logs` · `rate_limits` · `sol_prep_v1` · `sol_v4` · `solomon_auth` · `solomon_backups` · `solomon_hw_v3` · `store`
- ⇒ **`sol_prep_v1`(수업 준비)도 서버 백업에 들어 있다.** 10-03 의 「어느 백업에도 없다」는 로그인 백업·로컬 사본·스크립트만 보고 한 말이었다(틀림).
- 10-03 표본: 제출 1,116칸(답 있는 MR 제출 946 · TS 62) · 숙제 220칸(그림 svg 1,227개) · 명단 40 · 리포트 25주 · 비번 금고 40칸(값은 안 봄) · `sol_prep_v1` 가지 11 — 14:26 에 따로 받은 사본과 가지·칸 수 같음
- 규칙 파일: 10-03 것 = 권한 수정 배포 **전** 운영 규칙(`database.rules.PRE_권한1003.json`)과 같음
- 크게 쓸 때: 통째 파싱하지 말고 맨 위 칸을 바이트로 갈라 연다(로컬 메모리 3.5GB 로도 됨)

## 선택 복구 시험 (가짜 DB · 운영 안 건드림)
10-03 파일에서 고른 가지만 넣고 다시 읽어 견줌 — 모두 같음:
- `solomon_hw_v3/submissions`(2.3MB) · `homeworkSets/AU_y5_2026_m09_w2`(0.85MB) · `sol_prep_v1`(2.4MB)
- 골라 넣는 동안 다른 가지(`users`)는 그대로
- 주의: 백업 파일은 배열을 `{"0":…}` 꼴로 담는다. 넣으면 DB 가 배열로 돌려준다(같은 자료) — 견줄 땐 꼴을 맞출 것.

## 복구 절차 (실제로 할 때)
1. 콘솔 → Realtime Database → 백업 → 필요한 날의 `data.json.gz` 내려받기
2. 풀어서 **필요한 가지만** 떼어 낸다(통째 덮기 금지 — 그 뒤 학생 답이 지워진다)
3. 가짜 DB 에 먼저 넣어 확인
4. 운영에는 그 가지만 `firebase database:set /<경로> 파일` 또는 수술식 update · 그 사이 생긴 자료가 있으면 합칠 기준을 먼저 정한다

## §4 로그인 백업 끄기 + 이름만 받기 (10-03 · 로컬 · 배포 전)
- `index.html`: 로그인 길의 `autoBackupToFirebase()` 주석 처리 · `_backupKeysShallow`·`_backupField`·`_한번에` 새로 · `cleanupLegacyBackupKeys`·`loadBackupList` 를 이름만 받게 · 백업 다운로드 단추에 「DB 전체 아님」 풍선말
- 시험: `functions/화면시험/백업_이름만.test.js` 26 통과 · 화면시험 전체 **780 통과 · 실패 0**(전 754 + 26)
- 브라우저(에뮬레이터 · 교사 emuT · 가짜 옛 백업 36칸 · 권한1003 규칙): 로그인 정상 · 설정 탭 백업 목록 표가 뜸(날짜·학생 수·숙제 수) · 네트워크에 `solomon_backups.json?…&shallow=true` 1건(200) 뿐
- 그 브라우저에서 비밀키 정리는 이미 깃발이 있어 안 돌았다(로직은 단위 시험으로만 확인)
- 옛 일(이번과 무관): `cleanupLegacyApiKey` 가 `solomon_hw_v3/claudeApiKey` 지우기에서 PERMISSION_DENIED — 규칙에 그 칸 쓰기가 없어서. 10-02 에도 있던 것.

## 남은 것
- 보관 일수·권한·비용(§2-1) — 저장 통 화면 확인 필요
- 매일 확인 담당(결정 5 = PC 일꾼 · 전용 계정)
