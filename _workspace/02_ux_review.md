# 02. 편집기 사용자 편의성(UX) 검토

작성: editor-ux-reviewer 에이전트
대상: 노드 기반 보험료 산출 편집기 (Life Matrix Flow)
검토 방식: 코드 정독 + 실제 앱 실행(`npm run dev` → localhost:3005, Playwright로 초기 화면·Run All·실패 시 동작 실측)
검토 범위: `App.tsx`(6,475줄), `components/*`, `constants.ts`, `types.ts`

> 실측 확인: 초기 화면 렌더링, Run All 실행 시 동작(alert + 터미널 자동 전환), 모듈 상태 색상(blue=성공 / green=실행준비 / red=실패), Fit-to-View 14% 줌 문제는 실제 화면에서 확인함.
> 실측 미확인: 각 파라미터 모달의 라이트모드 렌더링은 코드 기준 판정(ParameterInputModal은 `bg-gray-800 text-white` 하드코딩, 4,541줄 중 `useTheme` 참조 2회뿐). PolicySetupModal/Canvas/ComponentRenderer는 `useTheme` 정상 사용.

---

## 여정별 마찰 목록

### 단계 0 — 첫 실행 (Out-of-box)

**[P0] 기본 제공 파이프라인이 Run All 시 즉시 실패한다 (BPV_Mortality / NNX_Mortality(Year) 미해결)**
- 현상: 앱을 열면 기본 모듈 15개가 배치되어 있음. 아무 입력 없이 `Run All`을 누르면 Net Premium Calculator에서 실패. 터미널 메시지: "수식에 허용되지 않은 문자가 포함되어 있습니다 … `[BPV_Mortality]` / `[NNX_Mortality(Year)]`". 기본 NetPremium formula(`constants.ts:265` formula="" 이지만 저장된 default/샘플 로드 시)가 상류 NNX/MMX 모듈이 실제로 만들지 않는 변수를 참조함. (실측: Playwright Run All → alert 발생 후 빨간 노드 1개)
- 사용자 영향: 초심자가 "예제를 그냥 돌려본다"는 가장 자연스러운 첫 행동에서 곧바로 에러. 무엇을 잘못했는지 알 수 없음(아무것도 안 했는데 실패).
- 개선안: (1) 기본 캔버스를 **끝까지 성공적으로 실행되는** 완결 예제로 교체하거나, (2) 미연결/미설정 상태에서는 Net Premium formula를 비워 두고 노드에 "수식을 입력하세요" 플레이스홀더 상태를 표시. (3) 최소한 `App.tsx`의 DEFAULT_MODULES formula 기본값이 기본 상류 출력과 일치하도록 동기화.
- 위치: `constants.ts:240-270`, `App.tsx:3897`(에러 발생 지점), 기본 샘플 로드 로직 `App.tsx:1480-1520`

---

### 단계 1 — 모듈 추가 (사이드바/툴바 → 캔버스)

**[P2] 모듈 이름·카테고리가 전부 영어라 비전문가 진입장벽**
- 현상: 사이드바 카테고리 "Data / Actuarial / Automation"(영어)와 "도형메뉴"(한글) 혼용(`App.tsx:5500-5528`). 모듈명도 "Survivors Calculator", "NNX MMX Calculator" 등 영어 + 보험계리 약어. 툴팁 설명(`constants.ts`)도 전부 영어.
- 사용자 영향: 보험계리 비전문가는 "NNX MMX Calculator"가 무엇인지, 어느 순서로 놓아야 하는지 알 수 없음.
- 개선안: `constants.ts`의 각 모듈에 `nameKo`, `descriptionKo` 필드 추가 → UI는 한글 우선 표시(영문 약어 병기). 카테고리도 "데이터 / 계리계산 / 자동화"로 통일.
- 위치: `constants.ts:18-135`, `App.tsx:5500-5528`, 렌더 `App.tsx:6096-6119`

**[P2] 추가 방식(클릭/더블클릭/드래그)이 안내되지 않음**
- 현상: 사이드바 버튼은 click=추가, doubleClick=추가, drag=캔버스 드롭 모두 지원(`App.tsx:6056-6064`)하나 사용자에게 알려주는 힌트가 없음.
- 개선안: 사이드바 상단에 "클릭하거나 캔버스로 끌어다 놓으세요" 1줄 안내.
- 위치: `App.tsx:5908`~ 사이드바

---

### 단계 2 — 포트 연결

**[P1] 비호환 포트 연결이 "조용히 실패"한다 (피드백 전무)**
- 현상: 드래그/탭으로 연결 시 `fromPort.type === toPort.type`이 아니면 아무 동작 없이 무시됨(`Canvas.tsx:348, 355, 373`). 경고·하이라이트·진동 없음.
- 사용자 영향: 사용자는 "왜 선이 안 그려지지?"만 반복. 어떤 포트끼리 연결 가능한지 학습 불가. 초심자 최대 마찰 중 하나.
- 개선안: (1) 연결 드래그 중 호환 가능한 입력 포트를 초록 링으로 하이라이트, 비호환은 흐리게. (2) 비호환 드롭 시 짧은 토스트("data 출력은 premium 입력에 연결할 수 없습니다"). 이미 토스트 인프라(`App.tsx:5548 initialSavedToast`) 존재 → 재사용 가능.
- 위치: `Canvas.tsx:339-383`(handleEndConnection/handleTapPort)

**[P1] 필수 입력 미연결이 실행 전에 경고되지 않음 (console.warn만)**
- 현상: Run All 시 미연결 입력 포트를 수집하지만 사용자에게 표시하지 않고 `console.warn`만 함(`App.tsx:5221-5223`). 미연결 모듈은 "Skipped … remain in pending"으로 조용히 건너뜀(`App.tsx:2586-2595`).
- 사용자 영향: 일부 모듈이 실행 안 됐는데 이유를 모름. 결과가 부분적으로만 나오거나 하류가 전부 Pending.
- 개선안: 미연결 입력 목록을 실행 전 확인 모달 또는 실행 후 요약 패널로 노출("다음 입력이 연결되지 않아 N개 모듈을 건너뛰었습니다"). 해당 노드를 빨강/주황 테두리로 표시.
- 위치: `App.tsx:5207-5223`, `App.tsx:2586-2595`

**[P2] 연결 삭제 방법(더블클릭)이 숨겨져 있음**
- 현상: 연결선 더블클릭으로 삭제(`Canvas.tsx:386, 496`). `<title>Double-click to delete connection</title>`은 영어 + hover 시에만 보임.
- 개선안: 연결선 hover 시 작은 X 버튼 표시, 또는 한글 툴팁.
- 위치: `Canvas.tsx:493-497`

---

### 단계 3 — 파라미터 입력 (모달)

**[P0] 메인 파라미터 모달(ParameterInputModal)이 다크 테마 하드코딩 — 라이트모드 미지원**
- 현상: 가장 많이 쓰는 4,541줄짜리 모달이 루트에 `bg-gray-800 text-white` 고정, 내부도 `bg-gray-700/900`, `text-gray-300/400` 일색. `useTheme` 참조 2회뿐(`ParameterInputModal.tsx` 전체). 반면 PolicySetupModal/Canvas/ComponentRenderer는 테마 대응. (실측: 앱 기본이 라이트모드이며 캔버스는 흰 배경 → 이 모달만 열면 새까만 패널이 뜸)
- 사용자 영향: 라이트모드 사용자가 모듈을 편집할 때마다 시각적 단절·눈부심. 일관성 붕괴.
- 개선안: `useTheme()` 도입 후 `isDark` 기준 클래스 분기. 최소한 루트 컨테이너 + 입력 필드 + 라벨 색상부터. (PolicySetupModal 패턴 복사 가능)
- 위치: `ParameterInputModal.tsx:4445-4503`(루트/header), 본문 전반

**[P1] 헤더의 "저장" 버튼이 실제로는 "이 타입의 기본값으로 저장" — 사용자 기대와 불일치**
- 현상: 모달 헤더 "저장" 버튼(`ParameterInputModal.tsx:4457-4464`)은 title="Save as default for this module type"이며 `onModuleSaved(module.type, params)`를 호출(`:4387-4392`) — 해당 **모듈 타입 전체의 기본값**을 바꿈. 정작 *이 모듈 인스턴스*의 값 저장은 모달을 닫을 때 적용됨.
- 사용자 영향: 사용자는 "저장"을 누르면 지금 편집한 모듈이 저장된다고 믿음. 실제로는 전역 기본값을 덮어써서 이후 같은 타입 모듈이 영향받음 → 예측 불가한 부작용.
- 개선안: 버튼 라벨을 "기본값으로 저장"으로 명확화하고, 일반 저장은 "적용"으로 분리. 또는 기본값 저장은 부메뉴로 숨기고 1차 액션은 "적용/닫기".
- 위치: `ParameterInputModal.tsx:4457-4464, 4387-4392`

**[P1] 수식 입력의 미해결/오타 토큰을 입력 시점에 경고하지 않음**
- 현상: Net/Gross/Reserve formula는 토큰 칩(컬럼·변수 클릭 삽입)으로 오타를 줄이는 좋은 설계(`ParameterInputModal.tsx:826-884`). 그러나 Live Preview는 알 수 없는 토큰을 그냥 회색으로 표시할 뿐 "이 변수는 존재하지 않음"을 알리지 않음(`:684-703`). 결국 실행 시점에야 영어/한글 에러로 실패(단계 0 사례).
- 사용자 영향: 잘못된 변수명을 입력해도 모달 안에선 정상처럼 보임 → 사후 실패.
- 개선안: Live Preview에서 미해결 토큰을 **빨강 배경 + "?"**로 표시하고, 하단에 "미해결 변수: [X]. 상류 모듈에서 출력되지 않습니다" 안내. 사용 가능한 토큰 집합은 이미 `availableColumns`/`additionalVars`/`nnxResults`로 보유 중.
- 위치: `ParameterInputModal.tsx:672-722`(renderPreview)

**[P2] 모달 라벨 한/영 혼용**
- 현상: 같은 모달 안에 "Net Premium Formula", "Table Columns", "Policy Variables"(영어)와 "사망위험률 열", "변경사항 저장 확인"(한글)이 섞임(`:843, 891, 1946, 4512`).
- 개선안: 라벨 한글 통일(영문 약어는 괄호 병기).
- 위치: `ParameterInputModal.tsx` 전반

**[P2] (긍정) 컬럼 입력은 대부분 드롭다운 — 유지 권장**
- 현상: Age/Gender/Mortality Column, Death_Rate 열, SelectData 등이 상류 컬럼을 `<select>`/PropertySelect로 채워 오타를 예방함(`:571-584, 1951-1962, 2902-2912`). 이는 모범 사례.
- 개선안(보완): 남은 자유 입력 지점인 `newColumnName`(새 컬럼명)에 중복·예약어 검사 추가.

---

### 단계 4 — 실행 (개별/전체)

**[P0] 모든 실행 피드백이 네이티브 `alert()`/`confirm()` — 흐름 단절·영문·맥락 부족**
- 현상: 실패·성공·확인이 전부 브라우저 `alert`/`confirm`(`App.tsx` 내 30곳 이상, 예: `:1300, 1726, 5201, 5267, 5317`). Run All 실패 시 영문 alert "Pipeline execution failed at module: Net Premium Calculator. Check the Terminal panel…"(`:5265-5269`). (실측 확인)
- 사용자 영향: (a) 영문 alert ↔ 한글 터미널 로그 언어 불일치. (b) 모달 흐름이 OS 다이얼로그로 끊김. (c) "어느 모듈"만 알려주고 "왜/어떻게 고치는지"는 직접 터미널을 열어 찾아야 함.
- 개선안: 기존 토스트 인프라(`App.tsx:5548`)를 확장해 실행 결과 배너/토스트로 통일. 실패 시 토스트에 "[모듈명] 실패 — 클릭하여 원인 보기" → 클릭 시 해당 노드 선택 + 터미널 열기(이미 `:5270-5271`에서 일부 수행). 메시지 한글화.
- 위치: `App.tsx:5264-5271, 5314-5317` 및 alert 전역

**[P1] 전역 실행 진행 표시(progress)와 "Run All" 버튼 로딩 상태 없음**
- 현상: Run All 버튼은 실행 중에도 상태 변화 없음(`App.tsx:5653-5660`) — 스피너/disabled 없음. 다단계 산출인데 "지금 몇 번째 모듈 실행 중"인 전역 표시가 없음(노드별 색만 바뀜).
- 사용자 영향: 큰 파이프라인에서 멈춘 건지 도는 건지 불명. 버튼 중복 클릭 위험.
- 개선안: Run All에 `isRunning` 상태로 스피너+"실행 중 N/총M" 표시. 헤더에 얇은 진행바. (개별 노드 Running은 노란색으로 이미 표현됨 — `ComponentRenderer.tsx:46`)
- 위치: `App.tsx:5653-5660`, 실행 루프 `App.tsx:2573-2644`

**[P1] 노드 상태 색상 규약이 직관과 어긋남 (성공=파랑, 준비=초록)**
- 현상: Success=blue, Pending&runnable=green, Running=yellow, Error=red(`ComponentRenderer.tsx:44-49, 136-152`). (실측: 성공 노드가 파란색, 미실행 준비 노드가 초록색으로 표시됨)
- 사용자 영향: 일반적 관습(초록=완료/성공)과 반대라 초심자가 "초록인데 왜 결과가 없지?"로 혼동. 색만으로 상태 구분 시 오해.
- 개선안: (1) Success=초록, Ready=파랑/회색으로 규약을 관습에 맞추거나, (2) 색에 더해 노드 헤더에 상태 아이콘+텍스트("완료/대기/실행중/오류")를 병기해 색맹·색약 접근성도 확보.
- 위치: `ComponentRenderer.tsx:44-57, 136-154`

**[P1] 실패 노드가 화면 밖일 때 사용자가 찾기 어렵다**
- 현상: 실측 시 기본 줌 40%에서 실패한 Net Premium Calculator가 화면 우측 밖에 위치. alert는 떴지만 빨간 노드는 보이지 않음. `setSelectedModuleIds([failed])`는 하지만 뷰포트를 그 노드로 이동시키진 않음(`App.tsx:5270-5271`).
- 개선안: 실패/선택 노드로 자동 pan(center-on-node). 
- 위치: `App.tsx:5270-5271`

**[P2] "Fit to View"가 과도하게 축소 (14%)되어 노드 판독 불가**
- 현상: 실측 시 Fit to View 클릭 → 14% 줌, 노드 텍스트 식별 불가.
- 개선안: Fit 최소 배율 하한(예: 0.4) 또는 여백 비율 축소.
- 위치: Auto/Fit 핸들러 (`App.tsx` 컨트롤 바, `:6158`~ 근처)

---

### 단계 5 — 결과 확인 (Code / Terminal / Preview / Report)

**[P1] 결과 확인 진입 동선이 숨어 있다 (노드 우측 클릭 = 결과, 헤더 토글 = 패널)**
- 현상: 노드의 오른쪽 2/3 영역 클릭 시 결과 미리보기(`ComponentRenderer.tsx:499-510`), 왼쪽 1/3 클릭 시 파라미터 편집(`:453-456`). 이 분할 클릭 규약은 hover 툴팁(영문 "Click to view Results"/"Click to edit parameters")으로만 안내됨.
- 사용자 영향: 초심자는 노드 어디를 눌러야 결과/편집인지 모름. 좌=입력, 우=출력이라는 멘탈모델이 학습 전엔 불명확.
- 개선안: 노드 본문에 "INPUT"처럼 우측에도 작은 "결과 보기" 라벨/아이콘 명시, 툴팁 한글화.
- 위치: `ComponentRenderer.tsx:453-510`

**[P1] Code/Terminal 패널이 수동으로 열고 모듈을 선택해야 보인다**
- 현상: CodeTerminalPanel은 `isVisible`+선택 모듈 필요(`CodeTerminalPanel.tsx:34, 38`). 에러 시 자동으로 패널 열고 에러 탭 전환은 됨(`:28-32`, `App.tsx:5270`)이나 정상 실행 후 결과 확인은 사용자가 직접 패널 토글+노드 선택해야 함.
- 개선안: 모듈 실행 직후 해당 노드 자동 선택 + (옵션) 결과 요약 토스트. 패널 비표시 상태에서도 노드 클릭만으로 결과 미리보기 모달이 뜨도록 일원화.
- 위치: `CodeTerminalPanel.tsx:14-93`, `App.tsx:5790`(토글)

**[P2] (긍정) 에러 시 터미널 자동 전환은 좋은 설계**
- 현상: 로그에 ERROR 포함 시 자동으로 Terminal 탭 활성화(`CodeTerminalPanel.tsx:28-32`), 에러는 빨강·성공은 초록(`:78`). 유지 권장.

---

## Quick Wins (빠른 개선)

1. **[P0→빠름] Run All 실패 alert 한글화 + 토스트화** — `App.tsx:5265-5269`의 영문 메시지를 한글 + 기존 토스트로 교체. 1파일 소규모 수정.
2. **[P1→빠름] Run All 버튼 로딩 상태** — `isRunning` state 추가, 버튼 disabled + 스피너. `App.tsx:5653-5660`.
3. **[P1→빠름] 노드 상태에 텍스트 라벨 병기** — 헤더에 "완료/대기/실행중/오류" 칩 추가. 색 규약 변경 없이 접근성·명료성 즉시 개선. `ComponentRenderer.tsx:378-447`.
4. **[P1→빠름] 비호환 연결 거부 시 토스트** — `Canvas.tsx:348/355/373` else 분기에서 토스트 호출.
5. **[P2→빠름] 모달/툴바 라벨 한글 통일** — "Set Folder/Load/Save/Run All" → "폴더 지정/불러오기/저장/전체 실행". `App.tsx:5623-5659`.
6. **[P1→빠름] 실패/선택 노드로 자동 화면 이동** — `App.tsx:5270` 옆에 center-on-node pan 추가.

## 구조적 개선

1. **[P0] 첫 실행 완결성 보장** — 기본 캔버스를 끝까지 성공하는 검증된 예제로 교체하고, 미설정 formula는 빈 상태로 두어 "설정 필요" UX를 명시. logic-auditor의 `01_logic_auditor_findings.md`(executePipeline↔표시코드 괴리)와 연계 필요.
2. **[P0] 전역 알림 시스템 통일** — 30곳 이상의 native `alert/confirm`을 앱 내 토스트/모달 컴포넌트로 일원화(한글, 비차단, 액션 버튼 포함). 흐름 단절 제거.
3. **[P0] ParameterInputModal 테마 대응** — 가장 사용 빈도 높은 4,541줄 모달을 `useTheme` 기반으로 라이트/다크 분기. PolicySetupModal 패턴 적용.
4. **[P1] 입력 오류 예방 계층 강화** — (a) 수식 Live Preview에 미해결 토큰 빨강 표시 + 사유, (b) 미연결 입력 실행 전 사전 점검 모달, (c) 비호환 연결 사전 하이라이트. sync-architect의 입출력 자동 인식/자동완성과 직접 연계.
5. **[P1] 단계별 진행 가이드(온보딩)** — "1)데이터 로드 → 2)연결 → 3)파라미터 → 4)실행" 순서를 보여주는 첫 방문 가이드/체크리스트. 영어 모듈명·계리 약어에 한글 설명 병기.
6. **[P2] 노드 클릭 규약 명시화** — 좌=편집/우=결과 분할을 시각적으로(라벨/구분선/아이콘) 명확히.

---

## sync-architect 전달 사항 (입출력/자동완성 UI 요구)
- 수식 입력기는 "사용 가능한 변수 집합"을 이미 알고 있으므로(`availableColumns`, `additionalVars`, `nnxResults`), **미해결 토큰 실시간 검증 UI**를 자동완성 설계에 포함할 것.
- 상류 출력 스키마를 하류 컬럼 드롭다운에 전파하는 현 패턴(PropertySelect)은 우수 — 신규 편집 UI도 자유 입력 대신 이 패턴을 기본값으로 채택 권장.
