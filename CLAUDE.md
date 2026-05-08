# Solomon Math Academy — 개발 지침

## ⚠️ Firebase 수정 전 필수 절차

**index.html의 Firebase 관련 코드를 수정하기 전에 반드시 아래 순서를 따를 것:**

1. Firebase 콘솔(https://console.firebase.google.com) 접속
2. 프로젝트 `solomon-76715` → Realtime Database 열기
3. 우상단 메뉴(⋮) → **"JSON 내보내기"** 클릭하여 전체 데이터 백업
4. 백업 파일을 `g:/aa/hp/backup/` 폴더에 날짜 포함 이름으로 저장
   (예: `firebase_backup_2026-04-06.json`)
5. 수정 작업 진행

> 이 절차를 건너뛰면 Firebase 동기화 버그 수정 중 데이터 유실 위험이 있음.
