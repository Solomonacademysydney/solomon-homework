# RTDB 읽기 의존성 (묶음 1)

잰 날: 2026-10-02 · 대상 `index.html` = 운영과 같은 SHA-256 `283950aa…e5e7` (커밋 `6ebd75a`)

세 갈래로 나눠 읽었다(학생·학부모 화면 / 쓰기 함수·교사 화면 / 바깥에서 읽는 이·프로필 약속). 줄 번호는 읽은 사람이 직접 연 것이고, (추정) 표시는 짐작이다. 7653~7659(빈 답 통째 쓰기)와 3004(재시도 줄이 `ts_` 를 안 받음)는 따로 다시 열어 확인했다.

## 꼭 기억할 것 (요약)

1. **세 층이다**: 서버 → 로컬 서랍(`_localMirror` 2845, 4주 창) → `getStore()`(4471, 매번 localStorage 를 다시 풂). 부분 로드는 세 층을 다 바꿔야 한다.
2. **「칸이 없으면 빈 제출을 만들어 통째로 쓴다」**: `renderStudent` 7653~7659 · `saveAnswer` 8307/8312 · `answerSA` 8382 · `doSubmit` 8451/8543 · 보충학습 · TS `submitTSAnswer` 17149 · `completeTSDay` 17195. 부분 로드 전에 이 길을 「서버에서 없음을 확인한 뒤에만」으로 막아야 한다.
3. `hwLookup` 4028 / `hwLookupKey` 4045 는 그룹 칸이 없으면 공통으로 내려간다(9/5 션 사고와 같은 꼴). 그룹 칸과 공통 칸은 함께 읽고, 「그룹 칸 없음」은 서버 확인으로 정한다.
4. `fbSetUsers` 3592 는 `users/<번호>` 로 쓴다 → 부분 명단 저장 금지. `initStore` 3988 은 `ensureStore` 5041 에서만 불리고, `_storeLoadState==='empty'` 는 뿌리 전체가 null 일 때만 정해진다(14856, 3981).
5. **바깥에서 읽는 이**: `/ts/` · `/prep/` · `submission_recovery.html`(원장 uid), PC 일꾼 `ts-worker`(`submissions/<열쇠>`, `homeworkSets/<칸>/sets` 읽기만). 새 규칙에 ts-worker 읽기를 꼭 적을 것 — 안 적으면 수집이 조용히 멈춘다.
6. 로그인 함수는 지금 프로필을 돌려주지 않는다(`prepStartSession` = `{ok,sid,role,master,exp}`). 클레임 `prep` = `{sid, role, master, exp(12시간), kids(학부모)}`.
7. **지금도 있는 흠**(이번 일 밖, 기록만): TS 답 재시도 안 됨(3004) · `deleteParent` 7356 명단 끝 중복(추정) · 아이디 바꾸기 7165 가 `ts_` 기록을 안 옮김 · 월간 리포트·학부모 7주 기록이 4주 창 때문에 앞쪽이 빠질 수 있음 · 교사 쓰기 넷이 서버 먼저 읽기를 안 함(16430 · 12785 · 3094~3101 · 15556).


---
<!-- 원본: dep_student_parent.md -->

## 학생·학부모 화면 — 읽는 자료 의존표 (index.html 읽기 전용 조사 · 2026-10-02)

출처: `E:\AA0\HP\index.html` (줄 번호는 이번에 직접 본 것) · `E:\AA0\HP\functions\prep_session.js` · `E:\AA0\HP\game\*.html`.
직접 읽지 않고 짐작한 것은 **(추정)** 으로 표시.

---

## 0. 먼저 알아야 할 바탕 — 「store」는 전역 변수가 아니다

| 항목 | 위치 | 실제 동작 | 부분 로딩 때 뜻 |
|---|---|---|---|
| 뿌리 참조 | `initFirebase` 14764 | `window.FB_REF = firebase.database().ref('solomon_hw_v3')` | — |
| 처음 읽기 | `loadInitialData` 14838~14888 | `FB_REF.once('value')` 로 **뿌리 통째** → `_persistLocalStore(fbData)` 14864 → `window.fbReady = true` 14871 → `_flushRetryQueue().then(_weaknessFlush)` 14875 → `finishInit` | `fbReady` 는 **「뿌리 전체를 한 번 받았다」**는 뜻으로 쓰이고 있다. 부분 로딩이면 이 깃발의 뜻을 다시 정해야 한다(쓰기 문지기 `fbWrite` 3344 가 이것만 본다). |
| 실시간 | `attachRealtimeListener` 14786~14835 | 뿌리 `.on('value')`. `if (!data.homeworkSets) return;` 14790. **학생·학부모**: 로컬 사본의 `homeworkSets` 를 `_localMirror` 로 깎은 서버 것 **통째로 갈아끼움** 14803·14807, `currentPeriod` 교체 14812, `submissions` 는 안 건드림 → 바뀌면 `renderStudent()`. 교사: `lastModified` 비교 14831 후 통째 저장 | 이 갈아끼우기는 「서버 `homeworkSets` 전체를 받았다」를 전제한다. 일부 칸만 듣게 바꾸면 **나머지 칸을 지운 것으로** 덮는다. |
| 7초 타임아웃 | 14782 | 응답 없으면 `finishInit` → 로컬 서랍만으로 화면 | 로그인 화면이 서버 자료 없이 열릴 수 있음(현재도). |
| 읽는 길목 | `getStore()` 4471 | 전역 `store` 가 없다. **매번 `localStorage['solomon_hw_v3']`(또는 `_memStoreRaw`) 를 JSON.parse** 한 사본을 돌려준다 4490~4493. 미리보기면 `_previewStore` 4478. | 부분 로딩 설계는 「서버 → 서랍(localStorage) → getStore」 세 단을 다 바꿔야 한다. 화면 함수는 서랍만 본다. |
| 서랍 쓰기 | `_persistLocalStore` 2919 | `_localMirror(d)` → `_mirrorJson` (그림 떼기) → `localStorage.setItem(STORE_KEY)` 2923. quota 면 `_memStoreRaw` 에 들고 있음 2930 | 서랍에 쓰는 것은 **늘 통째**다. 부분만 받은 객체를 그대로 넘기면 서랍의 다른 가지가 사라진다. |
| 서랍 깎기 | `_localMirror` 2845~2864 | `FB_ONLY_LOCAL_DROP`(2683: `aiCache`,`taxonomy_mr`,`taxonomy_feedback`,`lt_results`) 제거. `homeworkSets`·`submissions` 는 키 안의 `_YYYY_mMM_wW` 가 **보관 창**(오늘 기준 지난 1주 + 이번 주 + 앞 2주, 2830~2840)에 들 때만 남김. `reports` 는 키가 창에 들 때만. 주차 없는 키는 늘 남김 2842. | **이미 오늘도 「부분 로딩」이다.** 서랍에는 4주치만 있다. 아래 표의 「지금도 새는 곳」 참고. |
| 과거 주차 덧씌우기 | `_captureOldPeriodOverlay` 2867 · `getStore` 4654~4658 | `window._extraPeriodData` 를 `homeworkSets`·`submissions` 위에 얹음 | |
| 리포트 덧씌우기 | `getStore` 4660~4668 | `window._reportOverlay` 를 `reports` 위에 얹음 | |
| 키 메타 | `_noteAllHomeworkKeys` 5425 | 뿌리 통째 스냅숏에서 `homeworkSets` 키·문항 수만 `window._allHwMeta` 에 | 교사용(`findUnseenHomework`). 부분 로딩이면 이 메타가 비게 됨 (추정: 교사 경고가 0건). |

---

## 1. 로그인 · 세션

| 화면 | 함수@줄 | 읽는 것 (경로/필드) | 「다 받았다」 전제 | 부분 로딩 때 위험 |
|---|---|---|---|---|
| 로그인 | `doLogin` 5215 | `getStore()` 5218 → `store.users` 에서 `u.id === id && u.role === loginRole` 5236 (일꾼 `loginCheck` 가 ok 한 뒤) | `store.users` 에 **그 사람 줄이 들어 있다** | 줄이 없으면 비번이 맞아도 `user=null` → 「ID 또는 비밀번호가 올바르지 않습니다」 5263~5267. **서랍 비었을 때(새 기기 + 7초 타임아웃) 오늘도 같은 증상.** 부분 로딩이면 로그인 전에 `users` 를 먼저(혹은 그 한 줄을) 받아야 한다. |
| 로그인 | `doLogin` 5269 | `user.status === 'inactive'` | 줄의 `status` 가 최신 | — |
| 세션 | `doLogin` 5280~5284 → 일꾼 `prepStartSession` | 서버가 `S.BOOK`(공책 users)을 **통째 읽어** `find(id, role)` (`prep_session.js` 88~93 `bookRow`) · 마스터 대조 · 학부모면 `row.childIds` 로 `prep.kids` 를 서버가 만듦 132~137 · 돌려주는 것은 `{ok,sid,role,master,exp}` 뿐 140 | 서버 쪽은 화면 자료와 무관 | **세션 응답에 프로필(year·country·group·childIds·name)이 없다** → 화면은 여전히 `store.users` 의 줄이 필요하다. 프로필을 세션 응답에 실으면 `users` 통째 읽기를 피할 수 있다(추정·제안). |
| 세션 실패 폴백 | `doLogin` 5285~5297 | `_readSubmitLock()` 4167 → `FB_REF.child('submitLock').once` (5초) · 실패 시 `getStore().submitLock === true` 4175 | 서랍에 `submitLock` 이 있다 | 부분 로딩으로 서랍에 `submitLock` 을 안 담으면 폴백이 늘 「꺼짐」→ 옛 방식으로 들여보냄. 「없음 = 꺼짐」으로 읽는 자리. |
| 상단 이름 | `doLogin` 5315~5318 | 학부모: `parentDisplayName(user.childIds)` 5076 (id 글자만 씀, users 안 읽음) · 학생: `englishName(user.id)`, `user.year` | — | 없음 |
| 학부모 진입 | `doLogin` 5339~5343 | `user.childIds` 마다 `prepLoadAssignments(k, true)` | childIds 가 서랍 줄에서 옴 | 서버 `prep.kids` 와 화면 `childIds` 가 다른 곳에서 온다(서버=공책 직접, 화면=서랍). |
| 학생 진입 | `doLogin` 5345~5356 | `getStore().currentPeriod` 5348 → `studentPeriod = (_stored < today) ? today : _stored` 5350 · `prepLoadAssignments(user.id)` · `_flushRetryQueue().then(_weaknessFlush)` 5356 | `currentPeriod` 가 서랍에 있다 | 없으면 `getStore` 가 **올해·이번 달·1주차**로 채움 4525 → 오늘보다 작으니 today 로. 위험 낮음. |
| currentUser | `doLogin` 5299 | `currentUser = user` — **로그인 순간의 서랍 줄 객체**. 세션 내내 이것을 씀(`year`·`country`·`group`·`childIds`) | 로그인 때 줄이 최신 | 나중에 users 가 바뀌어도 currentUser 는 안 바뀜(지금도). |
| 비번 옮기기 | `ensureStore` 5025~5053 | `store.users` 를 돌며 평문 `pw` 를 해시 → `fbSetUsers(store.users)` 5053 | users 가 **전부·제 순서** | ⛔ `fbSetUsers` 3592 는 `users/${i}` **배열 번호로** 쓴다. users 일부만 서랍에 있으면 **번호가 어긋나 남의 줄을 덮는다.** (지금은 공책에 pw 가 없어 안 돎 — 추정, 실측 안 함.) |

---

## 2. 프로필에 기대는 화면 조각

| 화면 | 함수@줄 | 읽는 것 | 전제 | 위험 |
|---|---|---|---|---|
| 게임 카드 | `renderGameCard` 9505~9508 | `currentUser.role === 'student'`, `currentUser.year` 가 `'K'` 이거나 `parseInt ≤ 6` | currentUser 에 year | 서버 자료 안 읽음. 게임 4개 링크(`game/gugudan-rain.html`·`clock-master`·`division-defense`·`fraction-pizza`) 9518~9521 |
| 게임 카드가 붙는 곳 | 7475 · 7502 · 7623 · 8049 · 8059 · 8157 | `renderGameCard() + renderMyAccountCard()` | — | — |
| 게이미피케이션 | `gm_kidMode` 18659~18662 | `Number(currentUser.year) >= 7` 이면 끔 · `_gmState` 18655 는 세션 메모리(서버·localStorage 안 씀) | — | 없음 |
| 계정 카드 | `renderMyAccountCard` 9526 | `currentUser.id` 만 | — | 없음 |
| 학부모 헤더 | `renderParent` 8901 | `store.users.filter(role==='student' && status!=='inactive' && childIds.includes(id))` · `child.name`, `child.year` | **자녀 줄들이 서랍에 다 있다** | 하나라도 없으면 탭에서 빠지고, 다 없으면 「No children linked to this account.」 8904. 「없음 = 연결 안 됨」. |
| 나라/반 | `hwViewFor` 4133·4135 · 여러 곳 | `user.year`, `user.country || 'AU'`, `user.group` | — | `country` 없으면 `getStore` 가 `'AU'` 로 채우고 **migrated=true → 서랍 다시 씀** 4586 |
| 수업 요일 | `getStore` 4519 (`u.days = _요일배열`) · 쓰는 곳은 교사 화면 6932~6935·7219·7225 | 학생·학부모 화면에서 `days` 를 **읽는 곳을 못 찾음**(grep `lessonDay`/`days.` 결과 교사 쪽뿐) | — | — |
| 학교 정보 · 시험 D-day | `getSchoolsData` 4673 · `calculateNextExamDday` 4680 · `formatSchoolInfo` 4723 | `store.schools[group].calendars[year].termN.start/end`, `typical_exam_offset.termN`, `display_name` · 학생 줄 `school_group`(없으면 `'NSW_Public'`), `school_calendar_override`, `school_name` | `schools` 가 서랍에 있다 | `schools` 가 비면 `console.warn('[D-day] schools 데이터 없음')` 후 null 4683~4685 → 카드에서 D-day 빠짐. 주차 없는 키라 지금은 서랍에 늘 있음. |

---

## 3. 학생 숙제 화면

### 3-1. 열쇠 꼴

| 이름 | 줄 | 꼴 |
|---|---|---|
| 숙제 칸 | `hwKey` 4005 | `{country}_y{year}[-{group}]_{YYYY}_m{MM}_w{W}` (예 `AU_y5-sean_2026_m09_w2`) · 되읽기 `HW_KEY_RE` 4015 |
| MR 제출 | `subKey` 4232 | `{sid}_{YYYY}_m{MM}_w{W}_s{setIdx}` — **반(group)이 안 들어간다** (4033~4043 주석: 션 사고의 뿌리) |
| TS 진행 | `tsSubKey` 4233 | `ts_{sid}_{YYYY}_m{MM}_w{W}` (안에 `day1..dayN` → `answers.q{idx}`) |
| 리포트 | `reportPeriodKey` 8795 | `{YYYY}_m{MM}_w{W}` → `reports/{pKey}/{sid}/maths` |
| 월 리포트 | 11551 | `monthlyReports/{YYYY-MM}/{sid}` |
| 개인 배정 초안 | `_draftKey` 7453 | localStorage `prep_draft_{aid}_{setId}` |

### 3-2. 어떤 숙제를 보여 줄지 고르기

| 화면 | 함수@줄 | 읽는 것 | 전제 | 위험 |
|---|---|---|---|---|
| 공통 조회 | `hwViewFor` 4115~4138 | ① `_prepCacheFor(sid)` 4110 (학생·학부모=`_prepAssignBySid` · 교사/미리보기=`_teacherView`) ② `list.find(samePeriod)` → personal 4129 ③ `hidden` 에 그 주 → pending 4130 ④ 아니면 `hwLookup` + `visibleHw` 4132~4133 ⑤ `raw.published === false` → pending 4136 ⑥ none | 개인 배정은 **서버 함수**(sol_prep_v1)에서 따로 받음 — 뿌리 로딩과 무관 | 캐시 없음/`loading` → 학생은 「불러오는 중」 4119 (그룹으로 안 바꿈 — 안전). |
| 반 숙제 + 폴백 | `hwLookup` 4028~4031 | `store.homeworkSets[hwKey(…, group)]` **없으면** `store.homeworkSets[hwKey(…)]`(공통) | 반 칸이 서랍에 **없다면 서버에도 없다** | ⛔⛔ **가장 위험.** 반 칸을 안 받아 온 상태면 **공통 숙제를 보여 준다** → 아이가 공통 숙제를 풀고 같은 `subKey` 에 저장 → 반 숙제가 들어오면 다른 정답표로 재채점(2026-09-05 션 사고와 같은 꼴). 반 칸과 공통 칸은 **늘 함께** 받고, 「반 칸 없음」을 서버가 확인해야 한다. |
| 고른 칸의 열쇠 | `hwLookupKey` 4045~4052 | 같은 폴백 | 같음 | 반 칸이 빠지면 공통 열쇠를 돌려줌 → 아래 `subIsStale` 오판 |
| 어긋난 제출 | `subIsStale` 4055~4058 | `sub.hwKey !== hwLookupKey(…)` | 같음 | 반 칸이 빠지면 반 숙제를 낸 기록이 **「다른 숙제를 푼 것」으로 찍혀** 결과 대신 안내 화면(7668) · 리포트에서 빠짐(9919). |
| 공개 여부 | `visibleHw` 2667~2671 | `hw.published === false` 면 null (미리보기는 그대로) | — | 칸이 아예 없으면 「No homework assigned」 7612~7623(「없음 = 숙제 없음」). |
| 학생 본문 | `renderStudent` 7596~7610 | `store.currentPeriod`, `hwViewFor`, `hw.sets[]`, `hw.ts.enabled`, `hw.ts.questions` | — | — |
| TS 정답 고치기 | `_migrateTSAnswers` 16905 (7600 에서 매번) | `hwLookup(…).ts.questions[q].answer/options` · `store.submissions['ts_…']` · 고치면 `fbSetTSProgress(tsKey, 통째)` 16934 | ts 칸·진행 둘 다 최신 | 반 칸이 빠져 **공통 ts** 를 보면 다른 문항으로 정답을 「고쳐」 서버에 씀 (추정: 같은 칸 구조일 때만 일어남). |
| 개인 배정 | `renderPersonalHw` 7483 · `openPersonalSet` 7505 (`prepGetAssignment` 7508) · `renderPersonalSet` 7522 · `submitPersonalSet` 7572 (`prepSubmit` 7581) | 전부 서버 함수 응답 + `prep_draft_…`(localStorage) · 뿌리 자료는 `store.currentPeriod` 만(기간 줄) | — | 뿌리 로딩과 거의 무관. |
| 상태 카드 | `renderHwState` 7458 | `view.kind` (loading/error/pending) · `store.currentPeriod` | — | — |

### 3-3. MR 세트 (`_sN`)

| 화면 | 함수@줄 | 읽는 것 | 전제 | 위험 |
|---|---|---|---|---|
| 홈(MR+TS 둘 다) | `renderStudentHome` 8002 | `store.submissions[tsSubKey]` 8005~8006 · 세트마다 `store.submissions[subKey(…, idx)]?.submitted` 8014 | 제출 칸이 서랍에 있다 | 없으면 「안 함」으로 셈. |
| 세트 목록 | `renderSetList` 8062 | `store.submissions[subKey(idx)]` 8085~8086 · **앞 세트 `submitted` 여야 다음 세트 열림** 8087~8088 · `subIsStale` 8090 | 같음 | 제출 칸이 빠지면 **냈던 세트가 「안 냄」 + 뒤 세트 잠김.** |
| 문제 풀이 진입 | `renderStudent` 7651~7659 | `store.submissions[key]` | **없으면 서버에도 없다** | ⛔⛔ **없으면 빈 답안지를 만들어 `fbSetSubmission(key, {answers:{},submitted:false})` 로 서버에 씀** 7653~7656 · `answers` 가 없어도 같은 쓰기 7659. 제출 칸을 안 받아 온 채 세트를 열면 **서버의 진짜 답·제출을 빈 것으로 덮는다.** (지금도 과거 주차에서 `_ensurePeriodLoaded` 가 실패하면 `_extraPeriodData=null` 2898 로 같은 길이 열린다 — 추정 아님, 코드 경로 확인. 실제로 밟혔는지는 안 잼.) |
| 답 고르기 | `saveAnswer` 8303~8313 · `answerMC` 8315 · `answerSA` 8378~8392 | `store.submissions[key]` 없으면 새로 만들고 `answers[qid]` 하나 넣어 **칸 통째로** `fbSetSubmission` 8312 / 8391 | 같음 | 칸이 빠졌으면 옛 답들을 지우고 답 하나짜리로 덮음. `submitted` 도 안 보여 **이미 낸 세트에 다시 답이 들어감**(8309 `if submitted return` 이 못 막음). |
| 제출 | `doSubmit` 8442~ | 없으면 `{answers:{},submitted:false}` 8451~8453 → `submitted=true`, `rev = (sub.rev||0)+1`, `hwKey` 기록 | 같음 | `rev` 가 1 로 되돌아감 → 약점 반영의 「한 번만」 판정(`_weaknessMerge` 8602 · `applied/{cid}` 8666)이 흔들림 (추정). |
| 결과·복습 | `renderStudent` 7681~ · `startRemediation` 13699 | `sub.answers`, `sub.remediation.rounds[]`, `set.questions[].answer` | 같음 | — |
| AI 해설 캐시 열쇠 | `startRemediation` 13738 · 연습문제 14140 | `store.homeworkSets[hwKey(…, group)]` 이 **있으면** 반 열쇠, 없으면 공통 열쇠 → `aiCache/{hwKey}/{setIdx}/round_{n}` | 반 칸이 서랍에 있다 | 반 칸이 빠지면 **공통 숙제의 AI 해설 캐시**를 반 숙제 오답에 붙임 / 공통 캐시에 반 숙제 해설을 덧씀(`appendToAICache` 3751). |

### 3-4. TS (`ts_<sid>_<week>`)

| 화면 | 함수@줄 | 읽는 것 | 전제 | 위험 |
|---|---|---|---|---|
| TS 블록 | `renderTSBlock` 16728~16760 | `store.submissions[tsKey]` 의 `day{d}.completed` · `ts.day_config.questions_per_day/total_days` · `ts.questions.length` | 진행 칸이 서랍에 있다 | 없으면 0% · Day1 만 열림. |
| TS 하루 | `renderTSDay` 16959~16990 | `hwLookup(…).ts` (⚠️ `visibleHw` 안 거침) · `store.submissions[tsKey][dayN].answers.q{i}` (`selected`,`correct`,`revealed`,`wrongAttempts`,`hint1_used`) · `q.hint1`·`q.explanation` 17058~17072 | 같음 | 없으면 `{}` 를 만들어 **서랍에만** 저장 16973~16977. |
| TS 답 | `selectTSAnswer` 17096 (서랍만) · `submitTSAnswer` 17115 → `fbSetTSProgress(tsKey, store.submissions[tsKey])` 17149·17195 | **ts 칸 통째(모든 day)** 를 씀 4234 | 같음 | ⛔ 진행 칸을 안 받아 온 채 하루를 풀면 **다른 날 기록을 다 지운 칸**으로 서버를 덮음. |
| 미리보기 | `renderTSViewer` 17393 · 17454~17456 | `q.hint1`, `q.explanation` | — | 교사용(추정). |

### 3-5. 그림 · 힌트 · 해설 · AI · 약점

| 항목 | 함수@줄 | 읽는 것 | 전제 | 위험 |
|---|---|---|---|---|
| 그림 떼기 | `_mirrorJson` 2716~2725 | 서랍에 쓸 때 `figure` SVG 를 `§fig:…` 이름표로 바꾸고 실물은 **`window._figStore`(메모리)** 2702 | — | `_figStore` 는 **새로고침하면 빈다.** 서버에서 그 칸을 한 번 받아 `_persistLocalStore` 를 지나야 다시 찬다. |
| 그림 되돌리기 | `_restoreFigures` 2803~2811 · `getStore` 4512 | `_figStore[이름표]` 없으면 `figure=''`, `_figPending` 표시 | 이번 세션에 그 칸을 서버에서 받았다 | 부분 로딩에서 **서랍에는 있는데 이번에 안 받은 칸**은 그림이 빈 칸으로 보인다. (지금도 7초 타임아웃·서버 실패 때 같음.) |
| 그림 쓰기 문지기 | `_figGuardOk` 2768~2797 (`fbWrite` 3326) | `homeworkSets/…` 쓰기에 미복원 그림이 섞이면 막음 | — | 학생은 `homeworkSets` 를 안 써서 해당 적음. |
| 과거 주차 그림 | `_ensurePeriodLoaded` 2895 | `_extraPeriodData` 는 `_mirrorJson` 을 안 지나 SVG 원본 그대로 | — | 안전(이름표가 아님). |
| 힌트·해설 | 그룹 TS: `q.hint1` 17058, `q.explanation` 17071 (숙제 칸 안의 문항 필드) · 개인 배정: 서버 `prepGetAssignment` 응답(정답 없음 7447~7448 주석) | 숙제 칸에 들어 있음 | 칸을 받으면 같이 옴 | — |
| 공식 | `renderMath` 3863 (문항 글자 안의 수식을 그림) | 별도 자료 안 읽음 (추정: KaTeX 로컬) | — | — |
| AI 해설·연습 | `generateExplanationsForWrong` 13210 · `getAICache` 3720 · `appendToAICache` 3751 · `callAI` 12518 → `_callAIViaFunctions` 12524 → 함수 `callClaudeForStudent` 12575 | `aiCache/…` 는 **서버 직접 읽기**(서랍에서 뺌 2683) | — | 열쇠 고르기만 서랍 의존(위 3-3 마지막 줄). |
| 약점 쓰기 | `_weaknessEnqueue` 8654 · `applyWeaknessUpdates` 8661~8690(추정 끝줄) · `_weaknessFlush` 8692~8718(추정 끝줄) | localStorage `solomon_weakness_queue` → 서버 `weakness/{sid}/applied/{cid}`, `weakness/{sid}/skills/{k}` **transaction** · 확인용으로 `submissions/{subKey}` **서버 직접** 8705 | `fbReady` | 서랍 무관 — 안전. 단 `fbReady` 뜻이 바뀌면 시작 시점이 바뀜. |
| 약점 읽기 | `calculateStudentAccuracy` 4739 · `analyzeStudentStrengthsWeaknesses` 4794 · `calculateLearningConsistency` 4836 · `renderD1MetricsCard` 4940~4947 | `store.weakness[sid].skills` (주차 없는 키 → 서랍에 통째) | 서랍에 `weakness` 전체 | 빠지면 「학습 분석 준비 중」 4948~4953 (「없음 = 아직 제출 없음」). 4737 주석: 「페이지 로드 시점 기준」. |

### 3-6. 지난 주로 가기 · 「최근 주는 이미 서랍에 있다」 가정

| 자리 | 줄 | 하는 일 | 가정 | 위험 |
|---|---|---|---|---|
| `_ensurePeriodLoaded` | 2881~2900 | 창 안 주차면 오버레이 끄고 끝 2883 · 아니면 **`homeworkSets` 전체 + `submissions` 전체를 `once`** 2887~2890 하고 정규식으로 그 주만 골라 `_extraPeriodData` 2895 · 실패면 null 2898 | **창 안 주차는 서랍에 이미 다 있다** | 부분 로딩이면 「창 안이니 안 받는다」 2883 가 틀린다. 또 지금도 지난 한 주를 보려고 **두 가지를 통째로** 받는다. |
| `navigateStudentPeriod` | 4213~4231 | `_extraPeriodData=null` 4227 → 창 안이면 바로 `renderStudent` 4228 · 밖이면 `_ensurePeriodLoaded().then(renderStudent)` 4230 | 같음 | 실패해도 그냥 그림 → 「No homework」 / 세트 열면 7653 빈 칸 쓰기. |
| 교사 `setPeriod` | 6004~6027 | 6023 같은 판단 | 같음 | 교사용(참고). |
| `_recentPeriodKeySet` | 2834~2840 | **오늘(`getTodayPeriod`) 기준** 창 | 학생 `studentPeriod` 도 오늘 근처 | 학부모는 `store.currentPeriod`(8914, 원장이 정한 주)를 씀 → 원장이 창 밖 주로 맞추면 학부모 화면은 그 주 자료가 서랍에 없음(추정·실측 안 함). |

---

## 4. 학부모 화면

| 화면 | 함수@줄 | 읽는 것 | 전제 | 위험 |
|---|---|---|---|---|
| 자녀 목록 | `renderParent` 8892~8904 | `currentUser.childIds` (또는 교사 미리보기 `currentParentChildId`) · `store.users` 자녀 줄(`role`,`status`,`id`,`name`,`year`,`country`,`group`) | 자녀 줄 다 | 위 2장 참고. |
| 자녀 바꾸기 | `selectParentChild` 8808 | `currentParentChildId = id` → `renderParent()` | 자녀 자료가 이미 서랍에 | 부분 로딩이면 여기서 그 자녀 자료를 받아야 함(지금은 아무것도 안 받음). |
| 기간 | 8914 | `store.currentPeriod` (학생과 달리 이전/다음 주 단추 없음) | — | — |
| 이번 주 숙제 | 8916 `hwViewFor(store, child, p)` · 8955~8960 · 8962~ | `store.submissions[subKey(child.id,p,idx)]` 의 `submitted`,`answers`,`remediation.rounds[].practiceQuestions/practiceAnswers/practiceSubmitted/explanationRead` · `set.questions[].answer/type` | 제출 칸 있음 | 빠지면 「⏳ Not started yet」(「없음 = 안 함」). |
| 개인 배정 카드 | `parentViewCard` 8870 | 서버 함수 캐시만 | — | — |
| 주간 카드 | `renderParentMobileReports` 11546~11549 · `renderMobileWeeklyCard` 11209 | `store.reports[pKey][child.id].maths` (`weekTotalSets`,`weekDoneSets`,`weekSetCompletion`, 점수들) · 없으면 `hwLookup`+`submissions` 로 다시 셈 11221~11228 · `buildTSReportData` 9813 (ts 칸 + `ts_…` 진행) · `getPreviousWeekScore` 11260 | — | — |
| 지난주 점수 화살표 | `getPreviousWeekScore` 10143~10161 | `store.reports` 를 **최대 3달 거슬러** | 옛 리포트가 서랍에 있다 | ⚠️ **지금도 새는 곳**: 서랍은 `reports` 를 창(지난 1주~앞 2주) 안 키만 둔다 2857~2860 → 지난주 리포트가 없으면 그 앞은 늘 없음 → null(▲▼ 안 보임). |
| 4주 종합 | `aggregateMonthlyReport` 10168~10178 · 11552~11556 | `store.reports['{Y}_m{MM}_w1..5'][sid].maths.scorePercent…` · `store.monthlyReports['{Y}-{MM}'][sid].comment/actions` | 그 달 리포트 다 서랍에 | ⚠️ **지금도 새는 곳**: 그 달 앞 주들이 창 밖이면 빠짐 → 평균이 최근 1~2주만으로 계산되거나 「아직 4주치 데이터가 충분하지 않습니다」 11409. 「없음 = 리포트 안 만듦」. |
| 학습 분석 | `renderD1MetricsCard` 4940 | `store.users` 자녀 줄 · `store.weakness[childId]` · `schools` (D-day) | — | 위 3-5. |
| 최근 히스토리 | `renderParentHistory` 9223~9256 | **7주** 동안 `visibleHw(hwLookup(…))` + `store.submissions[subKey]` | 7주치가 서랍에 | ⚠️ **지금도 새는 곳**: 서랍엔 이번 주·지난주만 → 대부분 `history.length <= 1` → 카드 안 뜸 9256. |
| 교사 메모 | `renderTeacherDetailPanel` 11706 → 11789 `store.teacherMemos[child.id]` | **교사일 때만**(`isTeacher` 11547 · 옆 칸 11587~11590) | — | 학부모 계정은 `teacherMemos` 를 읽지 않음(본 범위). |
| 리포트 코멘트 저장 | 12274~12294 등 | 교사 쓰기 | — | 학부모 해당 없음. |
| 학생 시각 리포트 | `renderStudentVisualReport` 14603~14617 · `buildVisualReportData` 10008 | `store.reports[pKey][sid].maths` · `store.users` · 위 builder 들 | — | 같음. |

---

## 5. 브라우저 저장소(localStorage) 키 전부

| 키 | 줄 | 누가 | 내용 |
|---|---|---|---|
| `solomon_hw_v3` (`STORE_KEY`) | 2644 · 쓰기 2923 · 읽기 2906 | 모두 | 뿌리 사본(깎은 것). 그림은 이름표. |
| `solomon_fb_retry_queue` (`FB_RETRY_QUEUE_KEY`) | 2988 · 3011~3015 · 3153~3190 | 학생·학부모 | 못 보낸 **자기 `submissions/…`** updates (최대 20개, 15분) · 비울 때 서버 `FB_REF.child(path).once` 로 견줌 3174 → 서랍 무관. |
| `solomon_weakness_queue` (`WEAK_QUEUE_KEY`) | 8573 · 8643~8650 | 학생 | 약점 반영 할 일 줄. |
| `prep_draft_{aid}_{setId}` | 7453~7455 | 학생 | 개인 배정 풀던 답. |
| `solomon_session` (`SESSION_KEY`) | 17498 · 17502 · 17510~17526 | (추정: 교사 세션 유지 — 본 범위에서 줄 맥락 미확인) | `{userId, role, ts}` |
| `solomon_dead_calls` | 3625~3635 | 교사 | 폐기 함수 호출 기록. |
| `claude_api_key`, `solomon_teacher_api_key` | 5058~5059 · 5305~5307 | 모두 | 지우기만. |
| `solomon_lt_last_check` | 5099~5104 | 교사 | 레벨테스트 본 시각. |
| `apiKeyCleanup_v1_done`, `backupKeyCleanup_v1_done` | 15062~15109 | 교사 | 1회 청소 깃발. |
| `lastAutoBackupSig_v1` | 15213 · 15258 | 교사 | 자동 백업 서명. |
| `solomon_upkeep_snooze_until` | 17224 · 17245~17251 | 교사 | 알림 미루기. |
| 게임 기록 | `game/*.html` 각 `STORE_KEY`: `gugudanStats`(gugudan-rain 426) · `clockStats`(clock-master 274) · `divisionStats`(division-defense 426) · `pizzaStats`(fraction-pizza 314) · `coinShopStats` · `patternStats` · `logicStats` · `kenkenStats` · `minesweeperStats`(y3-y6-sydney만) · `sydneyGamesDeviceName`(y3-y6-sydney/index) | 학생(게임) | **기기 localStorage 에만** — 파이어베이스·`index.html` 서랍과 무관. 뿌리 로딩을 바꿔도 영향 없음. |
| 세션 메모리(저장 안 함) | `_gmState` 18655 · `_figStore` 2702 · `_prepAssignBySid` 4072 · `_prepDetail` 4187 · `_extraPeriodData` · `_reportOverlay` · `_memStoreRaw` · `_allHwMeta` | — | 새로고침하면 사라짐. |

---

## 6. 「서랍에 없음 = 존재하지 않음」으로 읽는 자리 (부분 로딩 때 위험 순)

| 등급 | 자리@줄 | 무엇이 일어나나 |
|---|---|---|
| ⛔⛔ 서버를 덮음 | `renderStudent` 7653~7656 · 7659 | 제출 칸이 없으면 빈 답안지를 **서버에 씀** → 진짜 답·제출 소멸. |
| ⛔⛔ 서버를 덮음 | `saveAnswer` 8307~8312 · `answerSA` 8382~8391 · `doSubmit` 8451~ | 제출 칸 통째 쓰기 — 서랍에 없던 옛 답 지워짐, `submitted` 우회, `rev` 1로. |
| ⛔⛔ 서버를 덮음 | `submitTSAnswer` 17149·17195 (+ `renderTSDay` 16973 이 만든 빈 칸) | ts 진행 칸 통째 쓰기 — 다른 날 기록 소멸. |
| ⛔⛔ 엉뚱한 숙제 | `hwLookup` 4028~4031 · `hwLookupKey` 4045~4052 | 반 칸이 없으면 공통 숙제로 폴백 → 션 사고 꼴. |
| ⛔ 서버를 덮음(조건부) | `_migrateTSAnswers` 16905~16934 | 엉뚱한 ts 로 정답을 「고쳐」 씀. |
| ⛔ 서버를 덮음(조건부) | `ensureStore` 5053 → `fbSetUsers` 3592 (`users/${i}` 번호 쓰기) | users 일부만 있으면 남의 줄 덮음. |
| ⛔ 서랍을 덮음 | 실시간 리스너 14803~14807 | 받은 `homeworkSets` 가 일부면 서랍의 나머지 칸 삭제. |
| ⛔ 서랍을 덮음 | `getStore` 마이그레이션 4554~4652 (`migrated → _persistLocalStore`) | 일부 자료로 v3 열쇠 바꾸기·`migrationISO2026Done` 재실행·`country='AU'` 채우기 후 서랍 다시 씀. 특히 `migrationISO2026Done` 4598 깃발이 서랍에 안 오면 **주차 열쇠 옮기기가 다시 돈다**. |
| ⚠️ 잘못 보임 | `subIsStale` 4055 | 반 칸이 없으면 낸 기록을 「다른 숙제」로 찍음. |
| ⚠️ 잘못 보임 | 13738 · 14140 AI 캐시 열쇠 | 반 칸 없으면 공통 캐시 사용·오염. |
| ⚠️ 잘못 보임 | `doLogin` 5236 | 줄 없으면 「비밀번호 틀림」. |
| ⚠️ 잘못 보임 | `renderParent` 8901 · `renderSetList` 8087~8088 · `renderParentHistory` 9223 · `aggregateMonthlyReport` 10168 · `getPreviousWeekScore` 10143 · `renderD1MetricsCard` 4945 · `calculateNextExamDday` 4683 · `_readSubmitLock` 4175 | 「없음」을 「없음/안 함/꺼짐」으로 표시. 뒤 셋째~다섯째는 **지금도** 서랍 깎기 때문에 반쯤 빈다. |
| ⚠️ 판단 틀림 | `_ensurePeriodLoaded` 2883 · `navigateStudentPeriod` 4228 · `setPeriod` 6023 | 「창 안 주차는 이미 다 있다」. |
| ⚠️ 그림 빔 | `_restoreFigures` 2803 | 이번 세션에 안 받은 칸은 그림이 빈 칸. |
| ⚠️ 깃발 뜻 | `fbReady` 14871 · `fbWrite` 3344 · `_flushRetryQueue` 3148 · `_weaknessFlush` 8696 | 「뿌리를 다 받았다」= 「써도 된다」로 묶여 있음. |

---

## 7. 화면별 최소 필요 자료 (정리)

| 화면 | 꼭 받아야 할 것 |
|---|---|
| 로그인 | `users` 중 그 사람 줄(또는 세션 응답에 프로필) · `submitLock` |
| 학생 이번 주 | 서버 함수 `prepListMyAssignments` · `currentPeriod` · `homeworkSets/{반 칸}` **와** `homeworkSets/{공통 칸}`(둘 다, 「없음」 확인 포함) · `submissions/{sid}_{주}_s0..sN` · `submissions/ts_{sid}_{주}` · `reports/{주}/{sid}` · (D-1 카드 쓰면) `weakness/{sid}`, `schools` |
| 학생 지난 주 | 위와 같은 열쇠를 그 주로 (지금은 `homeworkSets`·`submissions` 통째) |
| 학부모 | 자녀마다: 프로필 줄 · 위 「학생 이번 주」 열쇠(기간 = `currentPeriod`) · 히스토리 7주 · `reports/{그 달 1~5주}/{sid}` + 지난 3달(화살표) · `monthlyReports/{YYYY-MM}/{sid}` · `weakness/{sid}` · `schools` |
| 게임 | 없음(기기 localStorage) |


---
<!-- 원본: dep_writes_teacher.md -->

## 쓰기·교사 화면 의존표 — `E:\AA0\HP\index.html` (2026-10-02 읽음)

- 모든 줄 번호는 이번에 직접 연 줄이다. 직접 확인하지 못한 것은 **(추정)** 으로 적었다.
- 「store」 = `getStore()` 가 돌려주는 사본. ★ **이미 전체가 아니다**: 부팅 때 뿌리 전체를 받지만 `_persistLocalStore`(2919) → `_localMirror`(2846~2864) 가 `homeworkSets`·`submissions` 는 **보관 창(지난 1주·이번 주·다음 2주, 2830~2840)** 만, `reports` 도 같은 창만 남기고, `aiCache`·`taxonomy_mr`·`taxonomy_feedback`·`lt_results` 는 뺀다(2683). `users`·`currentPeriod`·`teacherMemos`·`monthlyReports`·`schools`·`submitLock` 등은 그대로 다 남는다.
- 지난 주차는 `_ensurePeriodLoaded`(2881~2900) 가 **`homeworkSets` 전체 + `submissions` 전체**를 다시 받아 그 주 것만 메모리 덧칠(`_extraPeriodData`)로 얹는다 → `getStore()` 4654~4658 에서 합쳐진다. ⇒ 이것도 「뿌리 통째 읽기」와 같은 무게의 읽기다(같이 바꿔야 한다).

---

## 0. 공통 길목 (모든 쓰기가 지나는 곳)

| 길목@줄 | 하는 일 | 미리 읽는 것 | 부분 store 일 때 |
|---|---|---|---|
| `fbWrite`@3308 | 미리보기면 안 씀(3314) → 그림 문지기 `_figGuardOk`(3326, 2769) → 학생·학부모 세션 검사(3330~3343) → `fbReady` 아니면 줄(retry queue)·배너(3344~3351) → 잠긴 칸 갈라내기(3353~3360) → **`updates.lastModified = ts`(3363)** 붙여 `FB_REF.update`(3364). 거부면 서버값으로 되돌림(3375~3380). | `window._잠긴칸`(`sol_v4/ops/lock` 지켜보기 3210), `window._figStore`(그림 실물), `fbReady` | 경로 단위 `update` 라 **보낸 경로만** 바뀐다. 위험은 「값을 만든 사본이 낡았나/비었나」뿐. ⛔ 모든 쓰기가 뿌리의 `lastModified` 를 같이 쓴다 ⇒ 학생도 `solomon_hw_v3/lastModified` 쓰기 권한이 있어야 함(규칙 쪽 확인 필요 · 추정). |
| `_칸맞추기`@3411 | `homeworkSets/<칸>` **한 칸을 서버에서 다시 읽어** 사본에 넣고 저장. 못 읽으면 `undefined`(쓰기 멈춤 신호). | 서버 `homeworkSets/<칸>` | ✅ 이미 「부분 읽기」 모양. 숙제 칸을 쓰는 모든 길이 이것을 거쳐야 함(아래 ⚠ 표시가 안 거치는 길). |
| `_서버값으로되돌리기`@3278 | 거부된 경로를 서버에서 읽어 사본에 박음 | 서버 해당 경로 | 부분 읽기 모양 ✅ |
| `_잠긴칸지켜보기`@3208~3219 | **읽기만**: `firebase.database().ref('sol_v4/ops/lock').on('value')` → `_잠긴칸` 집합. 이 페이지는 lock 을 **쓰지 않는다**(grep 결과 쓰기 0). | — | 못 읽으면 잠금 없음으로 보고 진행(3214~3217) → 그때 잠긴 칸 쓰기는 서버 거부 → 되돌림. |
| 재시도 줄 `_isStudentOwnedSubmissionUpdate`@2992~3006 | 학생·학부모가 못 보낸 쓰기를 localStorage 줄에 넣을지 판정 | `currentUser.id` / `childIds` | ⛔ 허용 조건이 `subKey.startsWith(sid + '_')`(3004). TS 진행 열쇠는 `ts_<sid>_…`(4233) 라 **`ts_` 키는 줄에 안 들어간다** ⇒ TS 답은 실패 시 서버로 다시 안 감(이 기기 사본에만 남음). 현재도 있는 구멍. |
| `_flushRetryQueue`@3147~3194 | 줄의 경로마다 **서버 값을 먼저 읽고**(3174) `_retryDecision`(3122) 으로 합친 뒤 `FB_REF.update({[path]: 값, lastModified})`(3181) | 서버 `submissions/<key>` (경로별) | 부분 읽기 모양 ✅. 읽기 권한이 없으면 catch → 줄에 남김(3183~3185). |

---

## A. DB 에 쓰는 함수 전부

### A-1. `users` (공책)

| 함수@줄 | 쓰는 경로 | 먼저 읽어야 하는 것 | 그 읽기가 없거나 일부면 |
|---|---|---|---|
| `fbSetUsers`@3592~3609 | `users/0`, `users/1`, … **배열 차례 번호마다 통째**(3603~3606), `pw` 칸은 뗌(3605) | **`store.users` 전체 배열이 서버와 같은 차례로** | 학생만 받은 사본·빈 사본(`getStore()` 4492 · `initStore` 3994)으로 부르면 `users/0…` 가 **남의 자리를 덮는다**. 배열이 줄면(삭제) 서버의 마지막 번호는 **안 지워져 남는다**(아래 `deleteParent`). |
| 부르는 곳(13곳 + 1): `ensureStore`@5053(비번 해시 이전), `toggleStudentDay`@6937, `deactivateStudent`@6955, `reactivateStudent`@6969, `saveStudentEdit`@7149·7228, `addChildToParent`@7318, `removeChildFromParent`@7330, `saveParentEdit`@7347, `deleteParent`@7358, `addStudent`@7396, `addParent`@7420, `saveTeacherAccount`@9698 | 위와 같음 | 모두 `getStore().users` 전체 | 전부 「전체 users 정본」 필요. |
| ⛔ `deleteParent`@7352~7360 | `store.users = filter(…)`(7356) 뒤 `fbSetUsers` | 전체 users | **지금도 있는 흠**: 길이가 n→n-1 로 줄면 `users/0..n-2` 만 쓰고 서버 `users/n-1`(옛 마지막 사람)은 그대로 → 그 사람이 **두 번** 들어 있게 된다(코드상 확실 · 서버에서 실측은 안 함). |
| `ensureStore`@5025~5054 | 비번이 평문인 사람이 있으면 `fbSetUsers(store.users)`(5053) | 서랍(로컬) 전체 | 서랍이 낡은 채 `fbReady` 이면 낡은 users 로 덮음(추정 — 지금은 비번이 금고로 옮겨져 평문이 없을 것이라 거의 안 불림). |

### A-2. `homeworkSets` (숙제 칸)

| 함수@줄 | 쓰는 경로 | 먼저 읽는 것 | 일부/없으면 |
|---|---|---|---|
| `fbSetHomeworkSet`@3442~3452 | `homeworkSets/<칸>/<가지>` 가지마다(`빼기` 제외) | 부르는 쪽이 넘긴 칸 사본 | 넘긴 사본이 낡으면 그 가지(특히 `sets`)를 낡은 것으로 덮는다. ⇒ 부르기 전에 `_칸맞추기` 필수. 끝나고 `_ensureGroupPlaceholders` 부름(3451). |
| `fbSetHomeworkMaths`@3455 | 위와 같음, `ts` 뺌 | 〃 | 〃 |
| `fbSetHomeworkTs`@3462~3479 | `homeworkSets/<칸>/ts`; 서버에 칸이 **없을 때만** 뼈대 가지(3465~3471) | 서버 `homeworkSets/<칸>` once(3465) | ✅ 스스로 서버를 본다. 못 읽으면 `/ts` 만 씀(3472~3475). |
| `_ensureGroupPlaceholders`@3495~3557 | `homeworkSets/<반칸>` **transaction**(비었을 때만, 3542~3543) | `store.users`(반 있는 아이 목록, 3504~3507) · `store.submissions`(그 주에 푼 흔적, 3516~3520) · 서버 `homeworkSets/<반칸>` once(3527) | users 가 일부면 빈 칸을 못 세움(사고 재발 위험: 공통 숙제가 반 아이에게 보임). submissions 가 일부면 이미 푼 아이 칸에도 빈 칸을 세워 **보던 숙제를 가림**(③ 조건이 무너짐). transaction 이라 서버 숙제를 덮지는 않음. |
| `_칸비었으면지우기`@3567~3582 | `homeworkSets/<칸>` = null | 서버 칸 once(3569) | ✅ 서버 확인 후에만 지움. |
| `fbDeleteHomeworkSet`@3560 | `homeworkSets/<칸>` = null | 없음 | 부르는 곳 없음(주석 3559). |
| `doSave`@6644~6727 (손으로 만든 세트 저장) | ① `submissions/<sk>`=null · `submissions_archive/<sk>_<ts>`(6699~6718) ② `homeworkSets/<칸>/{sets,published,year,…}`(6727) | 서버 칸 `_칸맞추기`(6677) ✅ · **`store.users`**(학년 학생, 6665·6696) · **`store.submissions`**(그 자리 제출, 6702·6710~6716) | 칸은 안전. 제출 정리는 사본에 있는 것만 → 사본에 없는 제출은 **보관 안 되고 그 자리에 남아** 새 세트에 엉뚱하게 이어진다(제출 칸 열쇠에 세트 번호만 있어서, 4232). |
| `deleteSet`@6078~6118 | `submissions/<sk>`=null + archive(6103~6105) · `homeworkSets/<칸>/sets`(6111) | `_칸맞추기`(6084) ✅ · `store.users`(6095) · `store.submissions`(6096·6104) | 위와 같음 + 세트 번호가 당겨지므로(6108) 정리 못 한 제출이 **다른 세트의 답**으로 보인다. |
| `confirmMoveSet`@6243~6304 | 두 칸의 `…/sets`(6294~6295) | `_칸맞추기` 양쪽(6262~6263) ✅ | 칸은 안전. 제출은 안 옮김(경고 문구 6176). |
| `togglePublishYear`@6120~6142 | `homeworkSets/<칸>/published` 하나(6140) | `store.homeworkSets[<칸>]`(6125) — 있는지·세트 수만 봄 | 사본에 칸이 없으면 「등록된 set 없음」으로 **멈춤**(쓰기 사고는 아님). |
| `_applyTsImport`@15759~15818 (TS JSON 등록) | `fbSetHomeworkTs` 로 `/ts`(+빈 칸이면 뼈대) | `store.homeworkSets[<칸>]` 은 되돌리기용(15776~15777) · 서버 존재는 `fbSetHomeworkTs` 가 봄 | 서버 쪽 안전. 끝나고 `_칸맞추기`(15803). |
| `removeTSForYear`@15826~15838 | `homeworkSets/<칸>/ts` = null(15835) | `store.homeworkSets[<칸>].ts` 가 있어야 실행(15831) | 사본에 없으면 아무것도 안 함. |
| `doImportHwJson`@16569~16711 (MR JSON 등록) | 제출 정리(16666·16684) · `homeworkSets/<칸>/*`(ts 뺌, 16690) · 다시 읽어 확인 `_MR등록확인`(16550) | `_칸맞추기`(16602) ✅ · `store.users`(16635) · `store.submissions`(16641·16666) | 칸 안전. 제출 정리는 doSave 와 같은 한계. |
| ⚠ `applySetAnswerFix`@16413~16430 (정답 고치기) | `homeworkSets/<칸>/*`(ts 뺌) **칸 통째 가지들** | `store.homeworkSets[<칸>]` 만 — **`_칸맞추기` 없음** | 사본이 낡았으면 서버 `sets` 를 낡은 것으로 덮는다(R-0 이 막으려던 바로 그 모양). |
| ⚠ `finalizeTagReview`@12779~12790 | 위와 같음(12785) | `store.homeworkSets[state.hwKey]` 만 — `_칸맞추기` 없음 | 위와 같음. 또 `handleTagReview` 가 고친 `state.questions` 는 `getStore()` 새 사본과 다른 물건이라 **고친 분류가 저장 안 될 수 있다**(추정 — `getStore()` 가 매번 JSON 파싱한 새 사본을 주는 것은 4493 에서 확인). |
| ⚠ `_retryTeacherHomeworkSync`@3058~3114 (빨간 띠 「지금 다시 저장」) | 사본의 **모든 칸 × 모든 가지(ts 제외)** + `currentPeriod`(3094~3101) | **사본 전체** — 서버를 안 읽음 | 사본이 낡았으면 **보관 창 안의 모든 칸 `sets` 를 낡은 것으로 덮는다**. 부분 store 로 바꾸면 더 위험. 칸마다 `_칸맞추기` 후 보내거나 「실패한 쓰기 묶음」만 다시 보내게 바꿔야 함. |

### A-3. `submissions` — 학생 쪽 (MR)

| 함수@줄 | 쓰는 경로 | 먼저 읽는 것 | 일부/없으면 |
|---|---|---|---|
| `fbSetSubmission`@3584 / `fbDeleteSubmission`@3588 | `submissions/<key>` **통째** / null | 넘긴 값 | 값이 사본에서 오므로, 사본에 없던 서버 기록은 **통째로 덮인다**. |
| `renderStudent`@7652~7659 | 사본에 제출 칸이 없으면 `{answers:{},submitted:false,submitTime:null}` 를 만들어 **바로 서버에 통째 씀**(7653~7656); `answers` 없을 때도(7659) | `store.submissions[subKey]` | ⛔ **가장 위험**. 사본에 그 칸이 없으면(다른 기기에서 푼 것 · 지난 주 덧칠 `_ensurePeriodLoaded` 실패 2896~2898 · 부분 로드) **서버의 답·제출 완료를 빈 칸으로 지운다**. 부분 로드로 가면 「그 아이 그 주 칸」을 **반드시 서버에서 먼저 읽고**, 못 읽었으면 만들지 말아야 함. |
| `saveAnswer`@8303~8313 | `submissions/<key>` 통째(8312) | 사본의 그 칸(없으면 빈 칸 생성 8307) | 같은 모양: 사본에 없거나 낡으면 서버의 다른 답을 지움. 지금도 학생 실시간 리스너가 `submissions` 를 갱신하지 않으므로(14795~14822) **두 기기 동시 풀기**에서 서로 덮는다(코드상). |
| `answerSA`@8378~8391 | 400ms 뒤 통째(8388~8390) | 〃 | 〃 |
| `startFreshSet`@8190~8217 | 통째(8214) — 옛 판을 `_prev` 로 보관 | 사본의 그 칸(8194) | 사본에 없으면 `startSet` 로 넘어가 renderStudent 의 빈 칸 쓰기로 이어짐. |
| `doSubmit`@8442~8559 | 통째(8543), 5.1초 뒤 `celebrationShown` 통째 다시(8497~8499) | 사본 칸(8451~8453 없으면 빈 칸) · `hwLookup` 숙제(8455) · `sub.rev`(8460) | 사본 칸이 낡으면 `rev` 가 낮게 매겨지고 서버 답을 덮음. `rev` 는 약점 반영 판정에 쓰임. |
| 보충학습 `startRemediation`@13757 · `renderRemediationExplanation`@13877 · `showHintStage`@14050 · `answerHintRetry`@14075·14090 · `onExplanationRead`@14119·14126·14146 · `savePracticeAnswer`@14403 · `practiceAnswerWithHint`@14431·14441·14450·14455·14462 · `savePracticeAnswerSA`@14500 · `submitPracticeSet`@14533 · `renderFinalReport`@14655 | 모두 `submissions/<key>` 통째 | 사본의 그 칸(`remediation` 가지 포함) | 모두 같은 모양 — 사본이 그 칸의 최신본이어야 함. |

### A-4. `submissions` — 학생 쪽 (TS 진행 `ts_<sid>_<주>`)

| 함수@줄 | 쓰는 경로 | 먼저 읽는 것 | 일부/없으면 |
|---|---|---|---|
| `fbSetTSProgress`@4234 | `submissions/ts_…` 통째 | 넘긴 값 | 통째 덮기. ⛔ 재시도 줄 허용 밖(위 0절). |
| `selectTSAnswer`@17096~17113 | **서버에 안 씀** — 사본에 `{}` · `day<n>:{answers:{},completed:false}` 를 만들기만(17101~17102) | 사본의 `ts_…` 칸 | 사본에 서버 진행이 없으면 빈 칸이 생기고, 다음 쓰기에서 그것이 통째로 올라감. |
| `submitTSAnswer`@17115~17157 | 통째(17149) | 사본 `ts_…` 칸 + `hw.ts` | 사본에 다른 날(day) 기록이 없으면 **그 날들을 지운다**. |
| `completeTSDay`@17187~17199 | 통째(17195) | 〃 | 〃 (사본에 칸이 없으면 17192 에서 터짐) |
| `_migrateTSAnswers`@16905~16935 | 통째(16934) | 〃 | 〃 |

### A-5. `submissions` — 교사 쪽

| 함수@줄 | 쓰는 경로 | 먼저 읽는 것 | 일부/없으면 |
|---|---|---|---|
| `resetSubmission`@6334~6345 | `submissions/<sk>` = null | `store.users`(이름 표시) | 읽기 없이 지움 — 의도된 동작. |
| `markSubmissionByTeacher`@6402~6448 | `submissions/<sk>` 통째(6441) | 사본 칸(6412: 이미 정상 제출인지 · 기존 `answers` 보존 6420) · `store.users`(6405) · `hwLookup`(6416) | 사본에 정상 제출이 안 보이면 「이미 냈다」 막기(6413)가 안 걸려 **아이의 진짜 제출을 원장 처리로 덮고 `answers` 를 잃는다**. ⇒ 그 칸 서버 읽기 필요. |
| `restoreSubmission`@6356~6381 (콘솔 전용) | `submissions/<orig>` + `submissions_archive/<k>`=null 묶음(6374~6377) | 서버 archive(6358) · 서버 원위치(6365) | ✅ 서버를 본다. |
| `saveStudentEdit`@7140~7232 (아이디 바꿈) | `submissions/<옛키>`=null · `submissions/<새키>`=값(7165~7173, 7229) + users | `store.submissions` 중 `oldId_` 로 시작하는 것(7165) | ⛔ **사본(보관 창 4주)에 있는 것만** 옮긴다 ⇒ 옛 주차 기록은 옛 아이디 밑에 남는다(키이라 19건 고아와 같은 모양 · 추정 연결). `ts_<oldId>_…` 는 `startsWith(oldId+'_')` 에 안 걸려 **TS 기록은 아예 안 옮김**(코드상). |
| `generateT6Kakao`@11926~11969 | `submissions/<sKey>/reportData/kakaoMsg` 한 가지(11969) | 사본 칸이 있어야 씀(11965) | 좁은 경로라 안전. 사본에 없으면 안 씀. |
| ⚠ `generateAndShowKakao`@12430~12449 | `submissions/<key>` **통째**(12449) | 사본 칸 `reportData`(12445) | 교사 사본은 그 사이 아이가 바꾼 것을 모를 수 있음 → 통째로 덮음. `kakaoMsg` 가지만 쓰게 바꾸는 것이 맞음(11969 처럼). |

### A-6. `weakness` (약점)

| 함수@줄 | 쓰는 경로 | 먼저 읽는 것 | 일부/없으면 |
|---|---|---|---|
| `applyWeaknessUpdates`@8661~8688 | `weakness/<sid>/skills/<k>` **transaction**(8680) · `weakness/<sid>/applied/<cid>` set(8682) | 서버 `weakness/<sid>/applied/<cid>` once(8667) · transaction 이 서버 현재값을 읽음 | store 에 기대지 않음 ✅. 단 **읽기 권한 필수** — `applied` once 가 막히면 catch → false → 줄에 남김(8684~8686); transaction 도 읽기 권한이 있어야 돈다(Firebase transaction 은 현재값을 읽어 옴 · 일반 지식). |
| `_weaknessFlush`@8692~8719 | (위를 부름) | 서버 `submissions/<subKey>` once(8705) — 그 판(`rev`)이 저장됐는지 | store 에 기대지 않음 ✅. 학생이 자기 제출 칸을 읽을 권한 필요. 부팅 때 `_flushRetryQueue` 뒤에 불림(14875), 제출 성공 뒤 불림(8546). |

### A-7. 캐시·분류

| 함수@줄 | 쓰는 경로 | 먼저 읽는 것 | 일부/없으면 |
|---|---|---|---|
| `setAICache`@3731~3748 | `aiCache/<칸>/<세트>/round_<n>` set(통째) | 없음 (교사만 3732) | 그 round 통째 덮음 — 의도. |
| `appendToAICache`@3751~3768 | 같은 경로 set | 서버 같은 경로 once(3754, `getAICache` 3723) | store 무관 ✅. 읽고-쓰기가 transaction 이 아니라 동시 두 학생이면 한쪽 것이 사라질 수 있음(추정). 부르는 곳 13235·13246·13316·13326. |
| `onTaxonomyFileSelected`@3803~3839 | `taxonomy_mr` set(3828) | `window.TAXONOMY_MR`(확인창용, 3820) | 파일 통째 교체 — 의도. |
| `handleTagReview`@12719~12752 | `taxonomy_feedback/<칸>_<세트>_q<n>/<ts>` set(12749) | 없음 | 매번 새 열쇠 — 안전. |

### A-8. 그 밖

| 함수@줄 | 쓰는 경로 | 먼저 읽는 것 | 일부/없으면 |
|---|---|---|---|
| `fbSetPeriod`@3611 | `currentPeriod` | — | 부르는 곳: 교사 로그인 `doLogin`@5326~5330(오늘 주로 덮음) · `setPeriod`@6020. 사본 무관. |
| (모든 `fbWrite`) | `lastModified`(3363) · `_flushRetryQueue`(3181) | — | 교사 실시간 리스너가 이것으로 「내 메아리」를 거른다(14826) · 자동 백업 서명에 쓰인다(15212). |
| `fbSetReport`@8799 | `reports/<주>/<sid>/<과목>` 통째 | 넘긴 값 | 아래 B-5 참고. |
| `saveTeacherMemo`@12016~12034 | `teacherMemos/<sid>/<ts>` | — | 새 열쇠 — 안전. |
| `saveReportEditor`@12260~12296 | 주간: `reports/…/maths` 통째(12288) = 사본의 기존 리포트 ∪ `ctx.data` ∪ 코멘트(12277~12283) · 월간: `monthlyReports/<월>/<sid>`(12296) | 사본 `store.reports[주][sid].maths`(12277) | 사본에 그 리포트가 없으면(보관 창 밖 주) `ctx.data` 에 없는 칸을 잃은 채 덮음(추정). |
| `cleanupLegacyApiKey`@15060~15079 | `claudeApiKey` remove(15065) | — | 한 번만(플래그). |
| `cleanupLegacyBackupKeys`@15083~15113 | `solomon_backups/<k>/data/claudeApiKey`=null(15104) | **`solomon_backups` 전체 once**(15087) | 큰 읽기. 한 번만(플래그). |
| `autoBackupToFirebase`@15186~15265 | `solomon_backups/<날짜>` 또는 `suspect_<날짜>` set(15238·15244) · 30개 넘으면 옛 것 null(15255) | `_fullStoreForBackup`(아래) · `_v4ForBackup`(`sol_v4/{assign,work,ops}` 가지별, 15156~15171) · `_detectBackupAnomaly`(마지막 10개, 15272) · `solomon_backups` 열쇠 목록 전체(15246) | `_fullStoreForBackup` 이 null 이면 백업 안 함(15190). |
| `uploadTsToNewLane`@15546~15636 | `sol_v4/bank/ts/<id>` · `sol_v4/fig/<id>`(50개씩 update, 15617~15622) | **사본** `store.homeworkSets[<칸>].ts.questions`(15556) · 서버 bank/fig 문항마다 once(15591·15607) | TS 본문을 사본에서 가져옴 — 사본이 낡으면 옛 문항을 창고로 올림(판 번호가 올라감). `_칸맞추기` 후 쓰는 것이 맞음. |

### A-9. `initStore()` / `ensureStore()` — 언제 저절로 도나

| 항목@줄 | 확인한 것 |
|---|---|
| `initStore`@3988~4002 | 이제 **서버에 안 쓴다**(3990~3992). 이 브라우저 서랍에 `{users:[], homeworkSets:{}, submissions:{}, currentPeriod}` 만 저장(3993~3999). |
| 부르는 곳 | `ensureStore`@5041 **한 곳뿐**(grep 결과). |
| `ensureStore`@5025 에서 `initStore` 까지 가는 조건 | ① 서랍이 비었고(5026~5028) ② `fbReady === true`(5029~5034) ③ `window._storeLoadState === 'empty'`(5037~5040). |
| `_storeLoadState='empty'` 가 되는 곳 | 부팅 첫 읽기 `FB_REF.once('value')` 결과 `fbData == null` 일 때(14856, 판정 3981). ⇒ **뿌리 전체를 읽고 비었을 때만**. |
| `ensureStore` 를 부르는 곳 | `finishInit`@14772~14779(첫 읽기 성공·실패·7초 시간 초과 14782·익명 로그인 실패 14916) · 초기화 예외@14920. 시간 초과·실패 길은 `fbReady=false` 라 ②에서 멈춤. |
| ⛔ 부분 로드로 바꿀 때 | `_storeLoadState` 를 「일부 가지가 비었다」로 `'empty'` 판정하면 안 된다(뿌리 전체가 없을 때만). 또 `initStore` 가 서버엔 안 써도 **빈 `users:[]` 서랍**을 만들고, 그 뒤 교사가 학생을 하나 추가하면 `fbSetUsers([새 학생])` → **`users/0` 을 덮는다**(A-1). `getStore()` 도 서랍이 없으면 같은 빈 모양을 돌려준다(4492) ⇒ `fbSetUsers` 는 「users 를 서버에서 받은 적이 있다」는 표시 없이는 쓰지 못하게 막아야 함. |

---

## B. 교사 화면별 의존표

「정본 필요」 = 저장 전에 그 범위를 **서버에서 온전히** 갖고 있어야 하는가.

| 화면 / 동작 | 함수@줄 | 읽는 것 | 정본 필요? |
|---|---|---|---|
| 주간 화면 그리기 | `renderTeacher`@5550~6002 | `store.currentPeriod` · `store.users` 전체(반 탭 `allGroups`@5455, 학생 목록 5557~5563) · 그 주 `homeworkSets`(5605) · 그 주 `submissions`(5944 등) · `_allHwMeta`(못 닿는 주차 경고 — **뿌리 전체에서만 만들어짐** `_noteAllHomeworkKeys`@5425, 부를 때 14793·14853) | 그리기만 — 쓰기 없음. 단 `users` 전체 · 그 주 칸·제출이 필요. `_allHwMeta` 는 `homeworkSets` 열쇠 목록이 필요(shallow 로 대체 가능 · 추정). |
| 주 바꾸기 | `setPeriod`@6004~6027 | 사본 · 창 밖이면 `_ensurePeriodLoaded`(homeworkSets·submissions **전체** 읽기) | `currentPeriod` 만 씀 → 정본 불필요. 그 주 칸·제출 읽기는 필요. |
| 숙제 만들기(손) | `doSave`@6644 | `_칸맞추기` · users · 그 자리 submissions | 칸 = 서버에서 읽음 ✅ · **users 전체 · 그 학년·반·주·세트 자리의 submissions 정본 필요**(정리·보관 때문). |
| JSON 등록(MR) | `doImportHwJson`@16569 | 위와 같음 | 위와 같음. |
| JSON 등록(TS) | `_applyTsImport`@15759 | 사본 칸(되돌리기용) | `fbSetHomeworkTs` 가 서버를 봄 → 칸 정본 불필요. |
| 세트 고치기 | `editSet`@6069 → `doSave` | 사본 칸 | doSave 가 `_칸맞추기` ✅ |
| 정답 고치기 | ⚠ `applySetAnswerFix`@16413 | 사본 칸만 | **필요한데 안 읽음** — `_칸맞추기` 넣어야 함. |
| 태깅 확정 | ⚠ `finalizeTagReview`@12779 | 사본 칸만 | **필요한데 안 읽음**. |
| 공개/숨김 | `togglePublishYear`@6120 | 사본 칸 존재·세트 수 | `published` 한 가지만 씀 → 정본 불필요(칸 존재 확인만 서버로 하면 충분 · 추정). |
| 세트 삭제 | `deleteSet`@6078 | `_칸맞추기` · users · submissions | 칸 ✅ · users·submissions 정본 필요. |
| 세트 옮기기 | `confirmMoveSet`@6243 | `_칸맞추기` 양쪽 | ✅ |
| TS 지우기 | `removeTSForYear`@15826 | 사본 칸 `.ts` | 사본에 없으면 안 지워짐(사고는 아님). |
| TS 새 길 올리기 | `uploadTsToNewLane`@15546 | 사본 `ts.questions` | **필요**(사본 TS 가 서버 TS 와 같아야). |
| 빨간 띠 다시 저장 | ⚠ `_retryTeacherHomeworkSync`@3058 | 사본 전체 | **위험** — 부분 사본이면 고쳐서 써야 함. |
| 제출 보기(리뷰) | `renderTeacher` 표 · `renderTeacherReportBody`@10437 | 그 주 submissions · homeworkSets · users | 읽기만. |
| 제출 초기화 | `resetSubmission`@6334 | users(이름) | 불필요. |
| 원장 처리 | `markSubmissionByTeacher`@6402 | 그 칸 제출 · users · 그 주 숙제 | **그 한 칸 정본 필요**(정상 제출 덮어쓰기 방지). |
| 학생 추가 | `addStudent`@7368 | `store.users` 전체(중복 아이디 7377) | **users 전체 정본 필요**(+ `fbSetUsers` 차례 번호). |
| 학부모 추가 | `addParent`@7403 | users 전체(중복 7409, 아이 확인 7412) | 〃 |
| 학생 정보 고치기 | `saveStudentEdit`@7140 | users 전체 · 그 아이 submissions(아이디 바꿀 때 7165 · 반 바꿀 때 이번 주 7197) | users 전체 필요 · 아이디를 바꾸면 **그 아이의 모든 주 submissions(ts_ 포함) 정본 필요** — 지금은 4주 창만 옮김. |
| 요일 토글 | `toggleStudentDay`@6928 | users 전체 | users 전체. |
| 퇴원/복귀 | `deactivateStudent`@6940 · `reactivateStudent`@6959 | users 전체(연결 학부모까지) | users 전체. |
| 학부모 고치기/아이 연결·해제 | `saveParentEdit`@7334 · `addChildToParent`@7304 · `removeChildFromParent`@7322 | users 전체 | users 전체. |
| 학부모 삭제 | ⛔ `deleteParent`@7352 | users 전체 | users 전체 + **배열이 줄어드는 흠**(A-1) 먼저 고쳐야 함. |
| 비번 다시 정하기 | `resetParentPassword`@15032 → `_resetPasswordVia` | 서버 일꾼 호출 | `users` 에 안 씀(추정 — `_resetPasswordVia` 본문은 안 열어 봄). |
| 원장 계정 | `saveTeacherAccount`@9649 | users 전체 | users 전체. |
| 주간 리포트 만들기 | `viewAsParent`@10302(10359) · `renderTrpSummary`@10457(10500) · `generateParentReportInline`@10760(10803) · `generateVisualReport`@12330(12394) | 그 주 submissions·숙제·users · 이전 주 리포트(`getPreviousWeekScore`@10143) | 쓰기는 `reports/<주>/<sid>/maths` 통째 — 새로 계산한 것이라 사본 의존은 **계산 재료**(그 주 제출 전부)뿐. 그 주 제출 정본 필요. |
| 코멘트 고치기 | `saveTrpComment`@10672~10686 | 사본 `reports[주][sid].maths`(10682) | **그 리포트 정본 필요** — 사본에 없으면 저장 안 함(10682 조건), 있으면 통째 다시 씀. |
| 리포트 편집기 | `saveReportEditor`@12260 | 사본 리포트(12277) | 그 리포트 정본 필요. |
| 월간 묶음 | `aggregateMonthlyReport`@10168~10180 | 사본 `reports` 의 그 달 1~5주 | ⛔ 지금도 **사본 `reports` 는 보관 창만** 남아(2858~2861) 달 앞쪽 주가 빠질 수 있음(코드상). 그 달 리포트 정본 필요. |
| 메모 | `saveTeacherMemo`@12016 | — | 불필요(새 열쇠). |
| 카톡 문구 | `generateT6Kakao`@11926 · ⚠ `generateAndShowKakao`@12430 | 그 칸 제출 | 앞은 가지 하나만 · 뒤는 **통째**라 그 칸 정본 필요. |
| 자동 백업 | `autoBackupToFirebase`@15186 ← 교사 로그인 5337 | `_fullStoreForBackup`@15120~15134 = **`FB_REF.once('value')` 뿌리 통째**(15123), 못 하면 null → 백업 안 함 · `sol_v4` 가지 셋 | **정본 전체 필요(일부러)**. 뿌리 통째 읽기를 없애도 이 함수는 남겨야 하는 자리 — 따로 가지별 읽기로 바꾸거나 서버 함수로 옮길 것(추정 권고). |
| 수동 백업 | `manualBackupDownload`@15316~15348 | `_fullStoreForBackup` · 실패 시 확인 받고 **사본**(15322~15325, 「불완전」 경고) · `sol_v4` 다섯 가지 | 정본 전체 필요. |
| 백업 목록/복구 | `loadBackupList`@15445(`solomon_backups` 전체 once 15454) · `restoreBackup`@15495(꺼짐 15499) | — | 복구는 꺼져 있음. 목록은 백업 30개 **본문까지** 받는다(큰 읽기 · shallow 로 줄일 수 있음 · 추정). |
| 강제 내려받기 | `forceDownloadFromFirebase`@9635~9647 | 뿌리 통째 once(9638) | 쓰기는 서랍만. 뿌리 통째 읽기 자리 중 하나. |
| 강제 올리기 | `forceUploadToFirebase`@9627 | — | 꺼짐(9631). |
| 레벨테스트 결과 | `checkNewLtResults`(5106 부근) · `loadLevelTestResults`(6800) | `lt_results` (뿌리 밖) | 읽기만. |
| 교사 개인 배정 캐시 | `prepLoadTeacher`@4152~4163 | `sol_prep_v1/releases` · `sol_prep_v1/submissions` 통째 | 읽기만. |

---

## C. 뿌리 통째 읽기를 없앨 때 — 저장 전 최소 읽기

| 쓰기 묶음 | 저장 전에 서버에서 꼭 받아야 할 것 |
|---|---|
| `users/*` (13곳) | `users` **전체**(차례 그대로) + 「받았음」 표시. 받지 못했으면 `fbSetUsers` 금지. |
| 숙제 칸 쓰기 | `homeworkSets/<칸>` 하나(`_칸맞추기`). ⚠ `applySetAnswerFix` · `finalizeTagReview` · `_retryTeacherHomeworkSync` · `uploadTsToNewLane` 에 빠져 있음. |
| 세트 만들기·지우기의 제출 정리 | 그 학년·반·주 학생들의 `submissions/<sid>_<주>_s<n>` (세트 번호 ≥ 대상) |
| 학생 MR 답·제출·보충 | `submissions/<자기 sid>_<주>_s<n>` 한 칸 — **못 읽었으면 빈 칸을 만들어 쓰지 말 것**(7653~7656). |
| 학생 TS | `submissions/ts_<sid>_<주>` 한 칸 — 그리고 재시도 줄 허용에 `ts_<sid>_` 넣기. |
| 원장 처리·카톡(통째) | 그 한 칸 |
| 아이디 바꾸기 | 그 아이의 **모든 주** `submissions`(`<id>_…` 와 `ts_<id>_…`) |
| 리포트 코멘트·편집 | `reports/<주>/<sid>/maths` 한 칸 |
| 월간 리포트 | 그 달 `reports/<주>` 1~5주 |
| 반 빈 칸 세우기 | `users` 전체 + 그 주 그 아이들 `submissions` |
| 백업 | 뿌리 전체(일부러) — 교사 로그인 때만 · 다른 길로 옮길 것 |

### 이번에 본 「지금도 있는」 흠 (부분 로드와 무관하게)

1. `deleteParent`@7352 — `users` 배열이 줄어도 서버 마지막 번호가 남아 한 사람이 둘이 됨.
2. 재시도 줄 허용(3004)이 `ts_<sid>_…` 를 못 받음 → TS 답 실패분은 서버로 안 감.
3. `_retryTeacherHomeworkSync`@3094~3101 — 서버를 안 보고 사본 전체 칸의 `sets` 를 밀어 올림.
4. `applySetAnswerFix`@16430 · `finalizeTagReview`@12785 — `_칸맞추기` 없이 칸 가지를 통째로 씀.
5. `saveStudentEdit`@7165 — 아이디 바꿀 때 4주 창 안의 MR 기록만 옮기고 `ts_` 는 안 옮김.
6. `generateAndShowKakao`@12449 — 가지 하나면 될 것을 제출 칸 통째로 씀.
7. `aggregateMonthlyReport`@10176 — 사본 `reports` 가 보관 창만이라 달 앞쪽 주가 빠질 수 있음.
8. 뿌리 통째 읽기 자리(없앨 목록): 부팅 `once`@14843 · 실시간 `on`@14786 · `_fullStoreForBackup`@15123 · `forceDownloadFromFirebase`@9638 · 가지 통째: `_ensurePeriodLoaded`@2888~2889 · `loadBackupList`@15454 · `cleanupLegacyBackupKeys`@15087 · `autoBackupToFirebase` 정리용 목록@15246.


---
<!-- 원본: dep_external_profile.md -->

## index.html 밖에서 DB 를 읽는 곳 · 서버 프로필 칸 약속 (2026-10-02 · 읽기 전용 조사)

표기: **잰 것** = 파일을 열어 본 줄 번호 · **(추정)** = 코드 흐름으로 짐작한 것. 원장 uid 는 `OPER`(= `62bxWu…`) 로 줄여 적는다. 비번·열쇠·토큰 값은 적지 않았다.

## 결론 먼저
- index.html 밖의 **브라우저 화면 셋(ts · prep · submission_recovery)은 모두 원장 이메일 로그인(uid = OPER)** 으로만 읽는다. ⇒ 새 규칙에 「`auth.uid === OPER` 이면 solomon_hw_v3 전체 읽기」 한 줄만 남기면 안 깨진다.
- **PC 일꾼(`ts-worker`)은 solomon_hw_v3 의 `submissions/<열쇠>` 와 `homeworkSets/<칸>/sets` 를 읽는다**(쓰지 않음). 지금은 `auth != null` 덕에 읽히는 것이다 ⇒ 새 규칙에 **ts-worker 읽기 허용을 따로 적지 않으면 수집이 「못읽음」으로 조용히 멈춘다.**
- 서버 함수(Admin SDK)는 규칙을 안 탄다. 다만 `loginCheck`·`prepStartSession` 은 **공책(`solomon_hw_v3/users`)을 통째로 읽어** 사람을 찾는다(서버 쪽이라 문제 없음).
- 지금 로그인 함수는 **프로필을 돌려주지 않는다**(`loginCheck` → `{ok,isMaster}` · `prepStartSession` → `{ok,sid,role,master,exp}`). index.html 은 로그인 뒤 사람을 **내려받은 공책(store.users)에서** 찾는다(index.html:5236) ⇒ 읽기를 좁히려면 서버가 프로필을 돌려줘야 한다.

---

## 1. ts/index.html (TS 교사 화면)

| 항목 | 내용 | 근거 |
|---|---|---|
| 인증 | 익명 로그인 안 함. `onAuthStateChanged` 로 지켜보다 `u.isAnonymous \|\| u.uid !== OPERATOR_UID` 이면 잠근다 | ts:12, 309~322 (잰 것) |
| 클레임 | 쓰지 않음(uid 만 본다) | 잰 것 |
| 원장 로그인 길 | 이 페이지엔 로그인 창이 없다 — 같은 origin 의 index.html 에서 원장 로그인한 세션을 그대로 쓴다(`elevateToOperatorAuth` → `signInWithEmailAndPassword`, index.html:3664~3680) | 잰 것 |

| 읽는 경로 (solomon_hw_v3) | 줄 | 범위 |
|---|---|---|
| `users` (통째) | 628 | 전체 학생 → `role==='student'`, `status!=='inactive'` 로 거름(633) · `u.days`·`u.group`·`u.name`·`u.id` 씀 |
| `homeworkSets/<칸>/sets`, `homeworkSets/<칸>/ts` | 722, 723 | 아이·주차 한 칸(반 칸 → 학년 공통 폴백) |
| `submissions/ts_<아이>_<주차>` | 728, 1326 | 한 건 |
| `submissions/<아이>_<주차>_s<n>` | 819 | 세트마다 한 건 |

그 밖 `sol_v4/ops/*`(pc · bank_status · curriculum · history · draft · report · req) 읽기·쓰기(576~577, 629, 964, 989, 1054, 1087~1090, 1306, 1374, 1410) · 함수 `approveTsAssignment` 부름(1254).

## 2. prep/index.html (수업 준비 화면)

| 항목 | 내용 | 근거 |
|---|---|---|
| 인증 | ts 와 같다 — 익명이거나 OPER 가 아니면 잠금 | prep:13, 113~119 (잰 것) |
| 클레임 | 안 씀 | 잰 것 |

| 경로 (solomon_hw_v3) | 읽기/쓰기 | 줄 |
|---|---|---|
| `users` (통째) | 읽기 | 124 (`role==='student'`, `status!=='inactive'`, `!isTest` 로 거름 · 128) |
| `attendance`, `attendance_days` (통째) | 읽기 | 124 |
| `homeworkSets/<칸>` (칸 전체) | 읽기 | 152 |
| `submissions` — `orderByKey().startAt('<sid>_')` / `startAt('ts_<sid>_')` **범위 질의** | 읽기 | 154~155 |
| `weakness/<sid>` | 읽기 | 155 |
| `weakness/<sid>/applied/<cid>`, `…/skills/<k>` | 읽기 · 트랜잭션 쓰기 | 926~933 |

⚠ `submissions` 범위 질의는 **`submissions` 노드에 읽기 권한**이 있어야 돈다(추정 — RTDB 질의 규칙). 원장 전체 읽기가 있으면 문제 없음.
그 밖 `sol_prep_v1/*` 다수(125~173, 427, 489, 527, 820, 907, 919, 998~1063) · 함수 `prepConfirmOrder` 등.

## 3. PC 일꾼 — C:\TS작업\일꾼

| 항목 | 내용 | 근거 |
|---|---|---|
| 신분 | 서비스 계정 열쇠 + `databaseAuthVariableOverride: {"uid":"ts-worker"}` ⇒ 규칙에서 `auth.uid === 'ts-worker'` 로 보인다. **`auth.token.prep` 없음** | 수집.py:52~57 · 올리기.py:62~65 · ts_worker.py:89(여기는 `{"uid":"ts-worker","_일꾼":True}`) (잰 것) |
| 수집.py 읽기 | `solomon_hw_v3/submissions/<열쇠>` — 열쇠 = `ts_<아이>_<주차>`(141) · `<아이>_<주차>_s<n>`(207) | 109 |
| | `solomon_hw_v3/homeworkSets/<칸>/sets` — `shallow=True`(안 되면 통째) | 161, 163 |
| 수집.py 쓰기 | **DB 에 안 쓴다** — 로컬 파일(`수집/<아이>/<주차>/…json`)만 | 128~136 |
| 아이 명단 | DB `users` 가 아니라 **로컬 공책 파일**(`아이공책/*.json`)에서 | 66~69 |
| ts_worker.py | `req/collect` 받으면 `수집` 모듈을 불러 같은 경로를 읽는다 | 174~184 |
| 올리기.py | `sol_v4/ops/{curriculum,eligibility,bank_status,report,history}` 쓰기만 | 133~215 |
| 단발 도구 R0_재기2.py | ts-worker 로 `homeworkSets/<칸>`(59) · **`users` 통째**(85) 읽기 | 잰 것 · 매주 도는 것인지는 (추정: 단발) |
| 권한_재기.py | ts-worker 로 `homeworkSets/…/ts`·`submissions/ts_…` 읽기를 **「읽혀야 한다(True)」로 시험** | 131~132 |

같은 폴더의 다른 길(규칙을 안 탄다):
- 승인_부르기.py — 열쇠로 **덮어쓰기 없이** 초기화(전권, 54) → `homeworkSets/<칸>`·`…/ts` 읽기(94~114) · OPER 커스텀 토큰으로 함수 부름(59~68).
- R0_민아.py·R0_민아2.py — 덮어쓰기 uid = OPER(40 / 37).
- R0_재기.py · 아이공책/공책_만들기.py — `firebase database:get` CLI(원장 구글 계정 = 전권). 공책_만들기는 `users`·`homeworkSets`·`submissions` **통째**(55~57).
- prep_worker(E:\AA0\HP\prep_worker) — 커스텀 토큰 uid `ts-worker`(fb.js:21) · 읽는 곳은 `sol_prep_v1/*` 뿐(일꾼.js:90~698) · solomon_hw_v3 안 읽음.

## 4. lt/level-test.html (레벨테스트)

| 항목 | 내용 | 근거 |
|---|---|---|
| 인증 | `firebase.auth().signInAnonymously()` | 435 |
| DB | `lt_results` 만 — `LT_AUTH` 기다린 뒤 `LT_REF.push(record)` | 426, 1435~1436 |
| solomon_hw_v3 | 안 읽는다 | grep 0 |
| 규칙 | `lt_results/$id/.write = OPER \|\| (auth != null && !data.exists())` + validate `name,phone,timestamp` | rules |

⇒ **익명 인증을 끄면 안 된다** · `lt_results` 규칙은 손대지 말 것.

## 5. 서버 함수 (E:\AA0\HP\functions · Admin SDK = 규칙 우회)

| 함수(파일) | solomon_hw_v3 에서 | 그 밖 |
|---|---|---|
| `loginCheck`(auth.js:188) | `users` 통째 읽기(금고에 없을 때만, 167) | `solomon_auth/*`, `rate_limits/*`, `master_login_logs` |
| `changeMyPassword`·`setPasswordByOperator`·`resetPasswordsBulk`·`migratePasswordsToVault`·`setMasterAndOperatorPassword`(auth.js) | `users` 통째 읽기(331, 472, 552, 611) | `solomon_auth` |
| `dropBookPasswords`(auth.js:381) | `users` 읽기 + **`users` update(424)** — 공책의 pw 칸 지우기 | 원장만 |
| `prepStartSession`·`prepEndSession`·`prepList…`·`prepGet…`·`prepSubmit`(prep_session.js) | `users` 통째 읽기(`bookRow`, 87~91) · `weakness/<sid>/…` 트랜잭션(applyWeaknessJob, weakness_merge.js:46~61) | `sol_prep_v1/{releases,submissions}` |
| `approveTsAssignment`·`unlockTsAssignment`·`onTsPublished`(ts_approval.js) | `users`(334) · `homeworkSets` 범위 질의(199~202) · `homeworkSets/<칸>`·`/ts`·`/published` 읽기·쓰기(489~633) · `submissions/ts_…`, `…_s<n>` 읽기(216~218, 500, 634) | `sol_v4/ops/*` |
| prep_release.js(`prepRelease`·`prepReleaseTick` 등) | `users`(73) · `homeworkSets/<칸>` 읽기·트랜잭션 쓰기(81, 95, 98, 127) · `submissions/<열쇠>` 읽기(87, 124~125) | `sol_prep_v1/*` |
| `callClaudeForStudent`·`cleanupRateLimits`(index.js) | 없음 | `rate_limits` (95, 298, 316) |

### prepStartSession 이 거는 클레임 (prep_session.js:131~153, 잰 것)

| 칸 (`customClaims.prep.*`) | 값 | 누가 정하나 |
|---|---|---|
| `sid` | 로그인한 id | 서버 |
| `role` | `'student'` 또는 `'parent'` (**teacher 는 받지 않는다** · 106) | 서버 |
| `master` | 마스터 비번으로 들어왔으면 true | 서버 |
| `exp` | 지금 + 12시간(ms) | 서버 (`SESSION_MS`, 37) |
| `kids` | 학부모만 · `{ <자녀id>: true }` — **서버가 공책 `row.childIds` 에서** 만든다(141~143) | 서버 |

- 기존 클레임에 `prep` 을 덧붙여 저장(144~145). 화면은 그 뒤 `getIdToken(true)` 로 새 토큰을 받는다(index.html:5283).
- 퇴원생(`status==='inactive'`)은 비번이 맞아도 거절(119~130).
- **돌려주는 것**: `{ ok: true, sid, role, master, exp }` (155) — 이름·학년·반·자녀 정보 없음.
- `loginCheck` 가 돌려주는 것: `{ ok:true, isMaster:true }` 또는 `{ ok:true, isMaster:false }` (219, 251). 주석 그대로 「사람 정보는 안 돌려준다 — 홈페이지는 공책을 이미 갖고 있으므로」(184~186).
- 교사(원장)는 클레임이 아니라 **Firebase 이메일 로그인 uid = OPER** 로 구별된다(index.html:3664~3680).

## 6. E:\AA0\HP 의 다른 html (`_archive*`·`backup`·`node_modules` 뺌)

grep(`solomon_hw_v3` · `firebase.database` · `firebase-database` · `firebasedatabase.app`) 에 걸린 html 은 **index.html · ts/index.html · prep/index.html · lt/level-test.html · submission_recovery.html** 다섯뿐(그 밖 `.claude/worktrees/agent-accc9339/index.html` = 일꾼 작업 사본).

| 파일 | 인증 | solomon_hw_v3 |
|---|---|---|
| submission_recovery.html | 원장 이메일 로그인 · uid ≠ OPER 이면 거절(144~153) | `submissions` **통째** 읽기(221, 280) · 뿌리 `update`(278) · `solomon_backups` 읽기(95, 128, 220) |
| online.html · thinking-skills.html · game/ · a1 · a2 · 학부모 리포트 | — | 걸린 것 없음 |
| b3.js (뿌리의 js 조각) | — | index.html 코드 조각 사본으로 보임(STORE_KEY 등) · 어느 html 도 불러오지 않음(grep 0) (추정: 안 쓰는 파일) |

## 7. database.rules.json — 규칙과 쓰는 auth 값

### solomon_hw_v3

| 경로 | 규칙 | 쓰는 auth |
|---|---|---|
| `solomon_hw_v3/.read` | `auth != null` | (아무 로그인 · **익명 포함**) |
| `solomon_hw_v3/.write` | false | — |
| `lastModified` | write `auth != null` | — |
| `users/$id` | write OPER | uid |
| `submissions/$key` | write: OPER **또는** (`auth != null` && uid ≠ `ts-worker` && (`submitLock` 아님 **또는** 학생 세션: `auth.token.prep != null` && `prep.master !== true` && `prep.role === 'student'` && `prep.exp > now` && `$key` 가 `<prep.sid>_` 또는 `ts_<prep.sid>_` 로 시작)) | uid · **`auth.token.prep.{master, role, exp, sid}`** |
| `submissions_archive/$key` | write OPER | uid |
| `homeworkSets/$key` | write OPER && `sol_v4/ops/lock/$key` 없음 · 하위 `sets/published/year/country/period/group/_placeholder/_note` = OPER · `ts` = OPER && 잠금 없음 | uid |
| `reports/$periodKey` · `monthlyReports/$monthKey` · `teacherMemos/$studentId` · `currentPeriod` · `aiCache` · `taxonomy_mr` | write OPER | uid |
| `weakness/$studentId` | write `auth != null` | — |
| `taxonomy_feedback` | write `auth != null` | — |
| `submitLock` | write OPER && boolean | uid |

⚠ 규칙이 쓰는 클레임은 **`prep.sid / role / master / exp` 넷뿐**. `prep.kids` 는 클레임엔 있으나 **규칙 어디에서도 안 쓴다**(학부모는 세션 길로 쓸 수 없고 submitLock 이 꺼졌을 때만 쓴다).
⚠ `attendance`, `attendance_days` 는 규칙에 칸이 없다 ⇒ 읽기는 위 `.read` 를 물려받고, 쓰기는 false 를 물려받는다(추정 — 원장 쓰기도 막힘? 확인 필요).

### 다른 뿌리

| 뿌리 | 읽기 | 쓰기 | auth |
|---|---|---|---|
| `lt_results` | OPER | OPER 또는 (`auth != null` && 새 것) + validate | uid |
| `solomon_backups` | OPER | OPER | uid |
| `master_login_logs` | OPER | `auth != null` | uid |
| `sol_v4` (`bank`·`fig`·`assign`·`work`) | 뿌리 OPER · 낱개(`$type/$itemId`, `$figId`, `$hwKey`, `$studentId`) `auth != null` | OPER · `work/$studentId` 는 `auth != null` | uid |
| `sol_v4/ops` | OPER 또는 `ts-worker` | req = OPER·ts-worker · defaults = OPER · draft/history/report/bank_status/pc/curriculum/eligibility = ts-worker | uid |
| `sol_prep_v1` | 뿌리 OPER · 여러 칸 `ts-worker` | 대부분 OPER 또는 ts-worker(조건부 lease·token·now) · releases/answerKeys/submissions/releaseQueue/releaseHistory/releaseLog = false(함수만) | uid · `now` |

(어느 규칙도 `auth.token.email`·`auth.provider` 등은 안 쓴다.)

---

## 8. 좁힌 규칙을 세울 때 반드시 남길 읽기 (위를 합친 것)

| 누가 | 신분 | 꼭 읽혀야 하는 solomon_hw_v3 경로 |
|---|---|---|
| 원장(index · ts · prep · recovery) | uid = OPER | 전부(`users`·`attendance*`·`homeworkSets`·`submissions` 범위 질의·`weakness` …) |
| PC 일꾼 | uid = `ts-worker` | `submissions/$key`(낱개) · `homeworkSets/$key/sets`(shallow) — (단발 도구까지 살리려면 `homeworkSets/$key` · `users`) |
| 서버 함수 | Admin | 규칙 무관 |
| 레벨테스트 | 익명 | solomon_hw_v3 필요 없음 · `lt_results` 쓰기만 |

---

## 9. 서버 프로필 칸 약속(초안) — 로그인 함수가 돌려줄 것

### index.html 이 `currentUser.*` 로 쓰는 칸 (grep 횟수, 잰 것)

| 칸 | 횟수 | 쓰는 곳(예) |
|---|---|---|
| `id` | 48 | 숙제 열쇠·제출 열쇠 |
| `year` | 30 | 칸 이름(hwKey) |
| `group` | 21 | 반 칸 → 학년 공통 폴백 |
| `role` | 20 | 화면 갈래 · `_isStudentOwnedSubmissionUpdate`(2993~2999) |
| `country` | 19 | 칸 이름(없으면 'AU') |
| `name` | 2 | 학생 이름(8504) · 미리보기 띠(14960) |
| `childIds` | 2 | 학부모 자녀 목록(2999, 8900) |

학생 행에 실제로 있는 칸(새 학생 만들기, index.html:7393~7394): `id, role, name, year, country, group, status, days, school_name, school_group, school_calendar_override` (+ `isTest` · 4522). 학부모 행(7418): `id, role, name, childIds, status`.

### 역할별 약속

| 역할 | 돌려줄 칸 | 까닭 | 돌려주지 말 것 |
|---|---|---|---|
| **학생** | `id`, `role`, `name`, `year`, `country`, `group`, `status` | 로그인 판정(5262~5272 status) · 칸 이름 · 화면 이름 | `pw`(공책에 남아 있을 수 있음 — `readStoredPw` 가 아직 공책을 뒤짐, auth.js:166~174) · 다른 아이 행 · `days` · `isTest` |
| | (선택) `school_group`, `school_calendar_override`, `school_name` | 학생 리포트 D-day·학교 정보(`calculateNextExamDday` 4680 · `formatSchoolInfo` 4723) — 부르는 곳이 `getStudentReportData`(4886) 하나이고 그 함수를 부르는 줄은 grep 에 안 걸림 (추정: 학생 화면엔 필요 없음) | |
| **학부모** | `id`, `role`, `name`, `status`, `childIds` | 자녀 목록(8898~8901) · 제출 소유 판정(2999) | `pw` · 자녀 아닌 아이 |
| ↳ 자녀마다 | `id`, `role`(='student'), `name`, `year`, `country`, `group`, `status`, `school_group`, `school_calendar_override` | `renderParent` 가 `role==='student' && status!=='inactive'` 로 거름(8901) · 칸 이름(child.year/country/group) · D-1 카드 D-day(4942, 4959 → 4687~4691) | 자녀의 `pw` · `days` · 다른 아이 |
| **교사(원장)** | `id`, `role`(='teacher'), `name` | 교사 화면(6892, 9654) | `pw` |
| | + 공책 **전체** | 학생 관리·숙제 관리가 `store.users` 74곳에서 전원을 씀 — 원장은 uid=OPER 로 **DB 에서 직접** 읽게 두는 편이 맞다(추정) | |

### 덧붙임
- 자녀 목록은 클레임 `prep.kids` 와 **같은 출처(공책 `childIds`)** 여야 한다 — 서버가 프로필을 돌려줄 때 `kids` 에서 만들면 둘이 어긋나지 않는다(추정).
- 마스터 로그인(원장이 아이 id 로 들어감)은 `master:true` 가 이미 돌아온다(prep_session.js:155) — 프로필에도 같은 값을 실어 화면의 「보기 전용」(index.html:5296 `window._legacyMaster`)과 맞출 것(추정).
- ⚠ 이 조사 범위 밖이지만 막힐 자리: index.html 은 열리자마자 **익명 로그인(5169) 뒤 `solomon_hw_v3` 뿌리 통째에 `on('value')`** 를 건다(14764, 14786) — 읽기를 좁히면 이 리스너가 먼저 거절된다.
- 공책에 `pw` 칸이 지금 실제로 남아 있는지는 **재지 않았다**(DB 를 안 열었음). `dropBookPasswords` 를 돌렸는지 확인할 것.
- RTDB 규칙에서 `auth.token.prep.kids[$sid]` 처럼 **변수 열쇠로 클레임 안을 찾는 꼴이 되는지 확인 필요**(추정 — 안 되면 학부모 읽기는 함수로 돌려야 한다).
