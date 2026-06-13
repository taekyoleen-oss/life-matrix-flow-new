# 고급기능 비밀번호 게이트 — 설계 스펙

- 날짜: 2026-06-13
- 대상 앱: life-matrix-flow (React 19 + Vite + TypeScript, 순수 클라이언트)

## 목표

앱 우측 상단에 **"고급기능"** 토글 버튼을 두고, 비밀번호로 잠금 해제해야만
고급기능(DSL 정의·AI 생성·AI 키 설정·PPT 보고서·코드/터미널 패널·초기화면 설정)을
사용할 수 있게 한다. 일반 사용자는 **모듈 배치 → 파라미터 입력 → 실행 → 결과 확인**의
핵심 흐름만 사용한다.

## 보안 전제 (중요)

백엔드가 없는 순수 클라이언트 앱이므로 비밀번호 검증은 브라우저 내에서만 일어난다.
개발자도구/번들로 우회 가능한 **소프트 잠금(deterrent)**이며, 목적("일반 사용자가
실수로 고급기능을 건드리지 못하게")에는 충분하다. 진짜 차단이 필요하면 서버 검증 필요.

## 결정사항 (사용자 확정)

| 항목 | 결정 |
|------|------|
| 잠금 대상 | DSL 정의, AI 생성+AI 키 설정, 슬라이드(PPT) 보고서, 코드·터미널 패널, "초기 화면으로 설정" |
| 잠긴 UI 표시 | 버튼은 보이되 비활성(흐림)+자물쇠 배지, 클릭 시 해제 모달 (발견성↑) |
| 해제 유지 | 이 브라우저에 기억 (localStorage) |
| 비밀번호 위치 | 빌드 환경변수 `VITE_ADVANCED_PASSWORD` (.env, git 미커밋) |

## 아키텍처

기존 `ApiKeyContext` 패턴을 그대로 복제한다.

### 신규 `contexts/AdvancedAccessContext.tsx`
- 상태: `isUnlocked: boolean`
- 메서드: `unlock(password): boolean`, `lock()`, `openUnlockModal()`
- `unlock`은 `import.meta.env.VITE_ADVANCED_PASSWORD`와 입력값을 비교. 일치 시
  `isUnlocked=true` + localStorage(`lmf_advanced_unlocked`)에 플래그 저장.
- 초기값은 localStorage에서 복원.
- 내부에 `AdvancedUnlockModal`을 렌더(ApiKeyProvider가 ApiKeyModal을 품는 것과 동일).

### 신규 `components/AdvancedUnlockModal.tsx`
- `ApiKeyModal` 스타일 차용. 비밀번호 입력 → "잠금 해제", 오답 시 에러.
- 이미 해제 상태면 "다시 잠그기" 노출.

### 신규 아이콘 `LockClosedIcon`, `LockOpenIcon` (`components/icons.tsx`)

### `index.tsx`
- `<ApiKeyProvider>` 안쪽(또는 바깥)에 `<AdvancedAccessProvider>` 추가해 App을 감싼다.

### `vite.config.ts`
- `define` 블록에 `'import.meta.env.VITE_ADVANCED_PASSWORD'` 추가.

### `.env.example`
- `VITE_ADVANCED_PASSWORD=` 항목과 설명 추가.

## 헤더 UI (`App.tsx`)

### 우측 상단 "고급기능" 토글 버튼 (신규)
- 잠김: `🔒 고급기능`(회색) → 클릭 시 해제 모달.
- 해제됨: `🔓 고급 모드`(강조색) → 클릭 시 다시 잠그기.

### 잠금 대상 버튼 처리
대상: AI 생성 · AI 키 설정 · DSL 정의 · SlideReportButton · 코드/터미널 토글 · "초기 화면으로 설정".
- 잠김: `opacity-50` + 🔒 배지, onClick은 `openUnlockModal`로 대체, title 변경.
- 해제: 원래 동작.
- 각 핸들러에 `isUnlocked` 방어 가드.

## 실행-안전 보장 (핵심 요구)

코드 추적 결과 `runSimulation`(App.tsx:5299) → `executePipeline`(App.tsx:2561)은
오직 `{ modules, connections, getTopologicalSort }`에만 의존한다. 잠금 대상 기능은
이 경로에 끼어들지 않으며(코드 패널=표시 전용, 내부 `generateDSL`=순수 직렬화),
따라서 **잠금 가드는 고급 UI 진입점에만 적용하고 실행 경로에는 절대 넣지 않는다.**
→ 잠금 상태에서도 일반 사용자의 모듈 배치/연결/파라미터/전체·개별 실행/결과 확인 보장.

### 항상 열린 기능 (잠금 무관)
모듈 드래그·배치, 포트 연결, 파라미터 입력, 전체/개별 실행, 모든 결과 미리보기,
폴더지정·불러오기·저장·예제·내 작업(초기화면 설정 제외), 테마·실행취소·온보딩·줌.

## 테스트 관점
- 잠김 상태: 6개 고급 진입점이 비활성+🔒, 클릭 시 해제 모달.
- 잠김 상태에서도 전체 실행이 정상 동작(결과 산출).
- 올바른 비밀번호 → 해제, 새로고침 후에도 해제 유지. 오답 → 에러.
- "다시 잠그기" → 즉시 잠김 + localStorage 플래그 제거.
