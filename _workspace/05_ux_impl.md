# 05. UX 개선 구현 결과 (Round D)

작성: editor-ux-reviewer 에이전트
기준 문서: `_workspace/02_ux_review.md` (이전 UX 검토)
검증: `npm run test` 82 passed (회귀 0) · `npm run build` 성공 · `npm run dev`(localhost:3006) + Playwright 실측

---

## 변경 파일

| 파일 | 변경 요약 |
|------|-----------|
| `App.tsx` | 기본 NetPremium/Reserve formula 동기화(P0#1), 범용 토스트 인프라+showToast, isRunning/진행 상태, 실패 alert→한글 토스트(P0#3), centerOnModule, Fit 하한 0.4, 미연결 입력 토스트, 툴바 한글화, Reserve 오류 메시지 한글화 |
| `components/ParameterInputModal.tsx` | useTheme 기반 라이트/다크 분기(P0#2: 루트/헤더/DSL/확인창/PropertyInput/PropertySelect), 헤더 "저장"→"기본값으로 저장" 명확화, Live Preview 미해결 토큰 빨강+사유(구조#9), 라벨 한글화 |
| `components/Canvas.tsx` | 비호환 포트 연결 거부 시 토스트(onConnectionRejected, QuickWin#6), 포트타입 한글 라벨 |
| `components/ComponentRenderer.tsx` | 노드 헤더 상태 텍스트 칩 "완료/대기/실행중/오류" 병기(QuickWin#5, 색약 접근성) |
| `components/icons.tsx` | ArrowPathIcon(스피너) 추가 |
| `_workspace/tests/qa_c2_coverage.test.ts` | 절대 라인오프셋 → 앵커(LoadData 분기/최종 throw) 기반으로 견고화(UI 코드 추가로 인한 라인 드리프트 대응). 검증 의도 동일, 로직 무변경 |

엔진(`executePipeline`)·`codeSnippets`·`moduleSync`·`dslParser`·`schemaInference` 로직은 미변경. Reserve 오류 메시지 문자열만 표현 레이어로 한글화(분기/계산 로직 불변).

---

## P0 (필수 3건) — 완료

### P0-1. 첫 실행 완결성 (실측 확인)
- 원인: 기본 `net-premium-calculator-1` formula `[BPV_Mortality] / [NNX_Mortality(Year)]`가 상류 출력 베이스명(`Male_Mortality`)과 불일치 → 미해결 토큰으로 즉시 실패. 추가로 `reserve-calculator-1`의 두 formula가 모두 빈 문자열 → "준비금 수식 1개 이상" 오류로 끝단에서도 실패.
- 조치(option b, 검증된 완결 예제):
  - NetPremium formula → `[BPV_Male_Mortality] / [NNX_Male_Mortality(Year)]` (`App.tsx` 기본 모듈 정의).
  - Reserve formula 2종 → `"0"` (준비금 0, 유효 수식). 사용자는 자신의 산출식으로 교체.
- 실측: localStorage 초기화 후 첫 Run All → **노드 13개 모두 "완료", ERROR 0건**. 콘솔에 ERROR 없음(기존 `additional_vars_in` 선택 입력 미연결 경고만 남음 = 정상).

### P0-2. ParameterInputModal 테마 대응 (실측 확인)
- `useTheme()` 도입, PolicySetupModal의 `isDark` 토큰 패턴 적용:
  - 루트 패널: 라이트=`bg-white text-gray-900`, 다크=`bg-gray-800 text-white`.
  - 헤더/구분선/닫기버튼/DSL 섹션/변경확인 다이얼로그 분기.
  - 공유 입력 컴포넌트 `PropertyInput`·`PropertySelect`(모든 모듈 공통) 라이트/다크 분기 → "입력필드+라벨" 우선 처리.
- 실측: 라이트모드에서 모달 패널 `rgb(255,255,255)` + 텍스트 `rgb(17,24,39)`, 스크린샷(`paraminput-lightmode.png`)으로 가독성 확인.
- 잔여(의도적 범위 제한): 변수 버튼 패널/수식 textarea 등 일부 내부 서브패널은 다크 스타일 유지(색 칩은 양 테마 모두 가독). 과제 명시 "최소 루트+입력필드+라벨부터" 충족.

### P0-3. alert/confirm → 토스트 한글화 (실측 확인)
- 범용 토스트 인프라 신설(`toast` 상태 + `showToast(message, kind, opts)` + 렌더). kind=info/success/warning/error, 액션버튼·닫기 지원, 자동 소멸(error 6~8s).
- Run All 실패: 영문 `alert` 제거 → 한글 error 토스트 "'[모듈]' 모듈에서 실행이 실패했습니다. 클릭하여 원인을 확인하세요." + [원인 보기] 버튼(코드패널 열기+노드 선택+센터). 예기치 못한 오류도 토스트화.
- Run All 성공: "전체 실행이 완료되었습니다 (모듈 N개)." (실측 토스트 캡처 확인).
- 파괴적 confirm(변경사항 저장 확인 등)은 모달 유지하되 한글.

---

## Quick Wins — 완료

- **#4 Run All 로딩 상태**: `isRunning` → 버튼 disabled + ArrowPathIcon 스피너 + "실행 중…" 라벨, finally에서 해제. (코드 확인; 실측은 실행이 빨라 스피너 프레임 포착 불가하나 토스트/상태칩으로 완료 흐름 확인.)
- **#5 노드 상태 텍스트 칩**: 헤더에 "완료/대기/실행중/오류" 칩 병기(Running은 펄스 점). 실측: Run All 후 "완료" 칩 13개 카운트.
- **#6 비호환 연결 거부 토스트**: `Canvas` 3개 분기 else에 `notifyIncompatible` → App에서 warning 토스트. 한글 메시지 "X 출력은 Y 입력에 연결할 수 없습니다…". (코드 확인.)
- **#7 실패/선택 노드 자동 이동**: `centerOnModule`로 실패 노드를 화면 중앙 pan. 실패 토스트/액션에 연동.
- **#8 툴바 한글화**: 폴더 지정/불러오기/저장/전체 실행/예제/내 작업, 파라미터 모달 제목·버튼 한글. 실측: 버튼 텍스트 한글 확인.
- (추가) **Fit to View 하한 0.4**: 과축소(14%) 방지(P2).

---

## 구조적 개선 — 부분 완료

- **#9 수식 Live Preview 미해결 토큰 빨강+사유**: 완료(실측). 미지의 토큰은 빨강+"?" 표시, 하단 "⚠ 미해결 변수: […] 상류 모듈에서 출력되지 않는 변수입니다…" 안내. `bpvResults`도 known 집합에 반영.
- **#10 미연결 입력 실행 전 안내**: 완료. 기존 console.warn 옆에 warning 토스트("입력이 연결되지 않은 포트 N곳…") 추가.
- (미착수) 온보딩 가이드(#5 구조), 노드 좌/우 클릭 규약 시각화(#6 구조), 모듈명 한글화(nameKo): 이번 범위 외 — 미완.

---

## 검증 결과

- `npm run test`: **82 passed** (8 files). 회귀 0.
  - C-2 커버리지 테스트가 절대 라인오프셋 기반이라 UI 코드 추가로 1회 실패 → 앵커 기반으로 수정(검증 의도 동일, executePipeline 무변경)하여 복구.
- `npm run build`: **성공** (built in ~18s). 기존 xlsx dynamic-import 경고/청크 크기 경고는 사전 존재(무관).
- Playwright 실측(localhost:3006, 라이트모드):
  - 첫 Run All → 노드 13개 "완료", ERROR 0 (P0-1).
  - ParameterInputModal 라이트모드 흰 패널/한글 라벨 (P0-2, 스크린샷).
  - Run All 성공 토스트 한글 (P0-3).
  - Live Preview 미해결 토큰 빨강+경고 (#9).
  - 상태 칩 "완료" 카운트 (#5), 툴바 한글 (#8).
- 실측 미확인(코드 근거 판정): Run All 스피너 프레임(실행이 짧아 포착 실패), 비호환 연결 드래그 토스트(드래그 시뮬레이션 미수행), 다크모드 모달 렌더(라이트 검증 + isDark 분기 코드 근거).

## 비고
- 테스트 중 앱의 beforeunload 자동저장이 첫 실패 상태를 localStorage에 캐싱해 재현을 방해 → 테스트 한정 `Storage.setItem` 패치로 초기상태 키 저장 차단 후 코드 기본값 로드로 검증. 앱 코드는 무변경.
