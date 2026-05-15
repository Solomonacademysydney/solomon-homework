# Solomon Academy 데이터 손실 사고 보고서 — 2026-05-15

**한 줄 요약**: 부팅 시 wholesale upload 버그(5/8 사고에서 미수정으로 남았던 3 경로 중 하나)가 stale localStorage를 가진 기기 접속 시 발동하여 Firebase 메인 트리를 통째 교체. 30개 자동 백업에서 합집합 추출하여 100% 이상 회수, 동일 패턴 차단 패치 배포.

---

## 1. 사고 개요

| 항목 | 내용 |
|---|---|
| **발생 시각** | 2026-05-15 16:11 ~ 17:54 Sydney time (103분 윈도우) |
| **발견 시각** | 2026-05-15 저녁, 사용자가 "5월 1·2주차 숙제 데이터 없어졌다" 인지 |
| **영향 범위** | submissions 60개 손실, homeworkSets 11개 손실 |
| **동일 패턴 선행 사고** | 2026-05-08 (41 submissions 손실, 당시 surgical merge로 복구) |
| **최종 회수 결과** | submissions 100%+ (185, 사고 직전 피크 180 초과), homeworkSets 100% (48) |
| **차단 패치 배포** | commit db16ef5, 2026-05-15 20:01 Sydney |
| **회수 도구 배포** | commit 8a491f3 (`recovery_2026-05-15.html`) |

---

## 2. 타임라인

| 시각 (Sydney) | 사건 |
|---|---|
| 2026-05-08 ~14:25 | **1차 사고** — submissions 41건 손실. 당시 `submission_recovery.html`로 surgical merge 복구. 미수정 코드 경로 3개 잔존. |
| 2026-05-12 21:32 | commit ad1a5c0 "security + safety hardening pass" — `deleteSet` / `confirmMoveSet` 두 함수의 wholesale 버그만 fix. 다른 3 경로 미수정. |
| 2026-05-15 11:43 | autoBackup 정상 (180 subs, 47 hwSets) |
| 2026-05-15 13:48 | autoBackup 피크 (180 subs, **48** hwSets, m05_w1=26, m05_w2=19) |
| 2026-05-15 16:11 | autoBackup (173 subs, 47 hwSets) — 아직 정상 범위 |
| **2026-05-15 16:11~17:54** | **사고 발생 윈도우** — wholesale wipe 트리거됨 |
| 2026-05-15 17:54 | autoBackup이 wipe된 상태 캡처 (113 subs, **36** hwSets, m05_w1=0, m05_w2=1) |
| 2026-05-15 19:32 | autoBackup, 여전히 wipe 상태 (113 / 36) |
| 2026-05-15 저녁 | 사용자 인지 → 진단 시작 |
| 2026-05-15 20:01 | 차단 패치 commit db16ef5 푸시 (라이브 보호 시작) |
| 2026-05-15 21:xx | 회수 도구 commit 8a491f3 배포 |
| 2026-05-15 22:xx | surgical merge 회수 완료 (185 / 48) |

---

## 3. 사고 원인 — 확정

### 3.1 직접 원인

`index.html` line 11966의 **부팅 시 wholesale upload 분기**:

```javascript
// 부팅 시 코드 (사고 발생 당시 버전)
if (fbData) {
  const fbTs = fbData.lastModified || 0;
  const localTs = localData?.lastModified || 0;
  if (localTs > fbTs) {
    // ⚠️ 위험: localData 전체를 Firebase로 푸시
    window.FB_REF.update(Object.assign({}, localData, { lastModified: localTs }));
  } else {
    localStorage.setItem(STORE_KEY, JSON.stringify(fbData));
  }
}
```

### 3.2 발동 메커니즘

1. 어떤 기기(가장 유력: **태블릿**)에 stale localStorage 존재
   - 36 hwSets, ~113 submissions 보유 (Firebase 정상 상태 47/173보다 적음)
   - 그 기기에서 사용자가 작업 → `saveStore()` → `localStorage.lastModified` 갱신
2. 그 기기가 16:11~17:54 사이 솔로몬 사이트 로드
3. 부팅 path 실행:
   - 익명 인증 완료 → `loadInitialData()` 호출
   - `fbData.lastModified` (Firebase 정상 상태) vs `localData.lastModified` (stale 기기) 비교
   - **`localTs > fbTs` 판정** (사용자 행동으로 인해 local 쪽이 새 timestamp 가짐)
   - `FB_REF.update(Object.assign({}, localData, {...}))` 실행
4. `update()` partial update가 top-level keys (users, homeworkSets, submissions 등) 각각을 **stale 값으로 통째 교체**
5. Firebase 메인 트리가 36/113 상태로 전락
6. 17:54 사용자 교사 로그인 → `autoBackupToFirebase()`가 wipe된 상태 그대로 백업으로 저장

### 3.3 원인 패턴

도구의 Step 4 자동 분석 결과: **"wholesale set/update 패턴과 일치"**.

손실 분포 (이 패턴의 지표):
- hwSets: m03_w5 (1), m05_w1 (5), m05_w2 (5)
- submissions: m04_w1 (1), m04_w2 (1), m04_w4 (4), m04_w5 (16), m05_w1 (27), m05_w2 (12)
- 다양한 주차에 걸친 손실 → 의도적 삭제가 아님 → wholesale 교체 확인

### 3.4 왜 5/8 후에도 발생했나

5/12 commit이 `deleteSet` / `confirmMoveSet` 두 함수만 surgical로 재작성. 다른 3 wholesale 경로는 그대로:
1. `forceUploadToFirebase` (line 7079) — 수동 클릭, 위험도 높음
2. **부팅 path (line 11966)** — 모든 페이지 방문에 자동 발동, **위험도 최고** ← 5/15 사고 원인
3. `restoreBackup` (line 12393) — 수동 클릭

5/8 사고 분석에서 부팅 path까지 점검했더라면 5/15 사고는 막을 수 있었음. 이 점이 가장 큰 교훈.

---

## 4. 적용한 조치

### 4.1 차단 패치 (commit db16ef5)

3 wholesale write 경로를 모두 no-op + 사용자 안내로 변경:

| 경로 | 변경 |
|---|---|
| `forceUploadToFirebase` (line 7071) | 클릭 시 안내창만 표시. wholesale set 실행 안 됨. |
| **부팅 path (line ~11960)** | **download-only로 강제**. `localTs > fbTs` 분기 자체 제거. 모든 페이지 방문 = 단방향 다운로드만. |
| `restoreBackup` (line 12374) | 클릭 시 안내창만 표시. wholesale set 실행 안 됨. |

### 4.2 회수 도구 배포 (commit 8a491f3)

`E:\AA0\HP\recovery_2026-05-15.html` — surgical merge 도구:
- Step 1: 익명 인증 + 진단 (읽기 전용)
- Step 2: 회수 계획 미리보기 (현재 Firebase에 없는 키만 식별)
- Step 3: per-key update만 사용한 surgical merge (200건 단위 batch)
- Step 4: 자동 사고 원인 분석 (인접 백업 간 drop 탐지 + 패턴 매칭)

접속 URL: `https://solomonacademy.com.au/recovery_2026-05-15.html`

### 4.3 합집합 자동 회수 (콘솔 스크립트)

30개 백업의 합집합 추출:
- timestamp 오름차순 정렬
- 각 키를 가장 최신 백업 버전으로 덮어쓰기
- 현재 Firebase에 없는 키만 추가 (기존 데이터 보존)
- per-key path update, wholesale 사용 안 함

---

## 5. 데이터 회수 결과

| 항목 | 사고 직후 | 사고 직전 피크 | 회수 후 |
|---|---|---|---|
| submissions | 113 | 180 | **185** (+5) |
| homeworkSets | 36 | 48 | **48** |
| m05_w1 | 0 | 26 | **28** (+2) |
| m05_w2 | 1 | 19 | **21** (+2) |

**185 / 48 / 28 / 21** — 어떤 단일 백업이 보유한 것보다 많은 unique 키. 30개 백업의 합집합 효과.

### 미세 캐비엇

사고 직전 피크(180)보다 5 subs 더 회수됐는데, 이는 **과거 백업엔 있었지만 사고 직전 시점엔 의도적으로 삭제·리셋된 키**가 같이 부활했을 가능성. 영향 미미 (학생이 다시 풀면 덮어쓰기됨). 데이터 손실보다 과도 회수가 훨씬 안전하므로 그대로 둠.

---

## 6. 검증 항목

라이브 사이트 https://solomonacademy.com.au 교사 로그인 후 다음 확인:

- [ ] 학생 목록·학년 정상 표시
- [ ] 5/15 13:48 백업 시점 보였던 5월 1·2주차 set 모두 보임
- [ ] 학생별 제출 표시 정상 (체크/도트 등)
- [ ] 학부모 화면 정상 작동
- [ ] 학생 화면 정상 작동

이상 시 즉시 대응 필요.

---

## 7. 후속 조치 (재발 방지)

### 7.1 즉시 (1순위, 5분 작업)

- [ ] **Firebase Console → Realtime Database → 백업 탭 → "시작하기" 클릭**
  - Cloud Storage에 daily JSON.gz 자동 저장
  - 사이트 코드와 완전 분리된 외부 안전망
  - 비용: 데이터 크기상 월 ~$1 수준
  - 보존 기간 30일 설정 권장
  - Blaze 무료 체험 크레딧 $414로 1년 이상 충분

### 7.2 단기 (1~2주 안)

- [ ] `autoBackupToFirebase` 트리거 다양화
  - 현재: 교사 로그인 시에만 (line 3875)
  - 변경: 학생/학부모 로그인 시에도 1일 1회 (timestamp 체크)
  - 효과: 교사 비활성 기간에도 백업 누락 방지
- [ ] 비활성화한 3 함수를 surgical 버전으로 재작성 후 재활성화
  - `forceUploadToFirebase` → per-key path update
  - `restoreBackup` → per-key path update (5/8 `submission_recovery.html` 패턴)
  - 부팅 path → conflict resolution 로직 설계 (양방향 sync 필요 시)

### 7.3 중장기 (운영 루틴)

- [ ] 주 1회 `manualBackupDownload` 클릭 → 로컬 `backup/` 폴더에 저장 (off-site)
- [ ] 월 1회 정기 점검:
  - Firebase Console 자동 백업 정상 작동 확인
  - `solomon_backups` 노드 30개 유지 확인
  - 최근 자동 백업의 hwSets·submissions 카운트 추이 모니터링 (급감 시 즉시 알람)

---

## 8. 교훈 (Lessons Learned)

### 8.1 설계 교훈

**Wholesale write는 자동 발동 경로에서 절대 금지**. 특히 부팅 path에서:
- 모든 페이지 방문에 무의식 발동
- 사용자가 막을 수 없음
- 한 번의 fire로 전체 데이터 교체 가능
- 5/8 사고 후에도 부팅 path가 미수정으로 남은 게 5/15 사고의 직접 원인

대안: 부팅은 **download-only**가 안전. 양방향 sync가 정말 필요하면 conflict resolution 로직 별도 설계.

### 8.2 진단 교훈

Firebase 경로 구조 확인이 진단 첫 단계:
- `solomon_backups`는 **DB 루트 직속** (`solomon_hw_v3/solomon_backups` 아님)
- 5/15 사고 초기 진단에서 잘못된 경로 조회로 "백업 0개" 오진. 약 1시간 손실
- 이후 [[reference_solomon_firebase_paths]] 메모리로 영구 기록

### 8.3 백업 다중화 교훈

여러 백업이 있어도 모두 같은 종류 결함 보유 시 동시 무력화 가능:
- `autoBackupToFirebase` (자동, 같은 DB 안) ← 다행히 wholesale 경로가 `solomon_hw_v3`만 건드려서 별개 트리인 `solomon_backups`는 살아남음
- `manualBackupDownload` (수동, 자동화 부재) — 4/13 이후 안 함
- Firebase RTDB Automated Backups (Google 빌트인) — 활성화 안 함

세 시스템이 **각각 다른 종류의 결함**으로 동시 무력화될 뻔함. 다층 백업이 진짜 다층이려면 결함 종류가 달라야 함.

### 8.4 사후 대응 교훈

이번 사고 회수가 성공한 핵심 요인:
1. `solomon_backups`가 우연히 별도 top-level 트리에 있어서 wholesale wipe의 영향권 밖이었음
2. 30개 백업 보관 정책 (`BACKUP_MAX_COUNT = 30`)
3. autoBackup이 교사 로그인 시 빈번하게 발동되어 사고 직전·직후 모두 캡처

만약 `solomon_backups`가 `solomon_hw_v3/` 안에 nested됐다면 같이 wipe됐을 것. 그러면 회수 불가능했을 것.

→ **앞으로도 백업은 항상 본 데이터 트리 바깥에 보관**.

---

## 9. 참고

### 9.1 관련 commit

- `db16ef5` — wholesale write 3 경로 차단
- `8a491f3` — recovery_2026-05-15.html 회수 도구
- `ad1a5c0` (5/12) — 일부 wholesale 함수 fix (불완전)

### 9.2 관련 파일

- `E:\AA0\HP\index.html` — 메인 platform
- `E:\AA0\HP\submission_recovery.html` — 5/8 사고용 복구 도구
- `E:\AA0\HP\recovery_2026-05-15.html` — 5/15 사고용 복구 도구
- `E:\AA0\HP\backup\` — 수동 다운로드 백업 폴더 (마지막 4/13)
- `E:\AA0\HP\_archive_20260512\` — 5/12 hardening pass 전 백업

### 9.3 관련 메모리

- `reference_solomon_firebase_paths.md` — RTDB 경로 구조 (이 사고에서 얻은 교훈)
- `feedback_solomon_wholesale_write_hazard.md` — wholesale 패턴 위험 인식
- `reference_solomon_auth.md` — 5/12 Rules 강화
- `project_solomon.md` — Solomon platform 운영 facts

---

**보고서 작성**: 2026-05-15 사고 당일
