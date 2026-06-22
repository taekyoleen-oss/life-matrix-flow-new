# life matrix flow new — 책 기반 개선 사항 (앱별 계획, I/O·검증·책자 중심)

> 원형: `ML Auto Flow/docs/azure_ml_book/01_book_based_improvements.md`.
> 횡단 공통 I/O: `ML Auto Flow/docs/cross_app_io_improvements.md` 참조.
> 대상: **life matrix flow new** — 노드 기반 **생명보험 보험료 산출·준비금 파이프라인 편집기** (React 19 + Vite + TypeScript + Supabase). 본 문서는 **계획서**이며 구현은 승인 후 별도 진행.

---

## 0. 한눈에 보기 — 같은 캔버스, **순수 TypeScript**

life matrix flow new는 ML Auto Flow와 **동일한 캔버스 패턴**을 공유한다(탐색 확인): 모듈 enum(`types.ts`), 팔레트(`constants.ts`의 `TOOLBOX_MODULES` 17종), 캔버스(`components/Canvas.tsx`), 노드 렌더러(`components/ComponentRenderer.tsx`), 포트/연결 그래프, AI 기능(`AIPipelineFromGoalModal`/`AIPipelineFromDataModal`), 고급기능 게이트(`contexts/AdvancedAccessContext.tsx`), DSL 양방향 동기화(`utils/dslParser.ts`).

**그러나 결정적 차이:** 이 앱은 **Python/Pyodide가 없다.** 계산은 브라우저 TypeScript 실행엔진(`App.tsx`의 `executePipeline()`)에서 수행되고, `codeSnippets.ts`는 **실행되지 않는 교육용 의사코드**만 생성한다. 모듈은 보험계리 워크플로(`DefinePolicyInfo`, `SelectRiskRates`, `CalculateSurvivors`, `NxMxCalculator`, `NetPremiumCalculator`, `GrossPremiumCalculator`, `ReserveCalculator`, `ScenarioRunner` 등)다. 출력은 Excel(`xlsx`)·PPT(`pptxgenjs`)·`.lifx`(JSON). dev 포트 3005.

→ 따라서 **01의 sklearn 특화 항목은 해당 없음**이고, 본 계획은 **입출력(I/O)·재현성 검증·책자** 영역만 다룬다(사용자 확정 범위).

---

## 1. 적용 항목 (I/O · 검증 · 책자)

### 1-1. 데이터 개요/요약 패널 (01의 2-3 → 공통 문서 작업1)
- 위험률표·요율·계약정보를 들여온 직후 **열별 타입·결측·간단 분포**를 요약(연령×성별×위험 조합 커버리지 강조).
- 영향: `components/ParameterInputModal.tsx`(입력 파싱), `components/DataPreviewModal.tsx`.
- 재현성: 읽기 전용 요약, 영향 없음.

### 1-2. URL/원격 데이터 로더 (01의 3-2 → 공통 문서 작업2) ★입출력 핵심
- 표준생명표·표준위험률·요율표를 **URL에서 직접 로드**. Pyodide가 없으므로 **TS `fetch()`** 로 CSV 수신 후 기존 파서 재사용.
- 영향: 입력 로직 `components/ParameterInputModal.tsx`(fetch 분기), `codeSnippets.ts`(의사코드 표기만 갱신), `sampleData.ts`(기존 `risk_rates.csv` 내장 예시 참조).
- 재현성: URL 데이터 가변 → 검증용 **로컬 스냅샷 권장**.

### 1-3. 번들 레퍼런스 파이프라인 확장 (01의 3-3 → 공통 문서 작업3) ★난이도 낮음·고효용
- 현재 `samples/Whole Life.lifx` 1종 → 보험종류별 레퍼런스 추가:
  - `Reference_TermLife_StandardRates.lifx`(정기보험 + 표준위험률)
  - `Reference_WholeLife_WithReserves.lifx`(종신 + 준비금 체인)
  - `Reference_EndowmentPremium_Scenario.lifx`(양로 + ScenarioRunner 다중 시나리오)
- 각 샘플은 모듈·연결·기본 데이터 경로 사전 구성.
- 영향: `samples/*.lifx`, `samples/samples-metadata.json`, `sampleData.ts`.

### 1-4. 샘플 메타데이터 스키마 강화 (공통 문서 작업4)
- 현 메타(`{inputData, description, category}`)를 확장: **보험종류(종신/정기/양로)·계리기초(위험률·이율)·규제구분·기대 보험료/준비금**.
- 영향: `samples/samples-metadata.json`. (4개 앱 공통 스키마 형태와 정렬 권장 — 횡단 이식성)

### 1-5. TS 재현성 verify 하네스 신설 (공통 문서 작업5) ★고가치·신규
- 현재 **verify 하네스 없음**. ML Auto Flow의 `verify/run-verification.mjs` 개념을 **TypeScript로 신설**:
  - `verify/pipelines/*.json` 픽스처 + 기대 **보험료/준비금 출력값**.
  - `App.tsx`의 `executePipeline()`(또는 추출한 순수 계산 함수)을 2회 실행해 **동일 출력 단언**.
  - 이미 보유한 **Vitest**(`vitest.config.ts`)로 회귀 테스트화.
- 영향: 신규 `verify/`, 계산 로직 일부를 테스트 가능한 순수 함수로 추출, `package.json` 스크립트(`verify:pipelines` 상당).
- 재현성: 무작위·부동소수 연산 순서 고정으로 2회 실행 동일성 보장(sklearn 시드 개념의 TS 대체).

### 1-6. 결과/스코어링 내보내기 정합 (01의 3-6 → 공통 문서 작업6)
- **이미 Excel/PPT/.lifx 내보내기 보유**(`utils/buildSlideReport.ts`, `DataPreviewModal.tsx`의 `xlsx`, `utils/fileOperations.ts`). 보강은 **보험료 "재계산 함수" 내보내기**(입력 파라미터→보험료 산출을 외부에서 재현할 수 있는 TS/의사코드 스니펫) 정도.
- 영향: `utils/buildSlideReport.ts`, `codeSnippets.ts`, `utils/fileOperations.ts`. 고급기능 게이트(`AdvancedAccessContext`) 정합.

---

## 2. 명시적 "해당 없음" (순수 TS — sklearn 부재)

| 01 항목 | 상태 | 사유 |
|---|---|---|
| 2-1 Evaluate ROC/AUC·혼동행렬 | ❌ 해당 없음 | 모델 학습/평가 패러다임 아님(보험료 산출). 평가 대신 **ScenarioRunner 시나리오 비교**가 대응 |
| 2-2 회귀지표 정합(RMSE/MAE) | ❌ 해당 없음 | 동상 |
| 3-1 그래디언트 부스팅 모듈 | ❌ 해당 없음 | sklearn 미존재(순수 TS), 계리 공식 기반 |
| 3-4 하이퍼파라미터 스윕/CV | ❌ 해당 없음 | 학습 모델 부재 |
| 3-5 추천 모듈 | ❌ 해당 없음 | 도메인 무관 |
| 3-7 재학습 워크플로 | △ 부분 | "재학습" 대신 **ScenarioRunner 시나리오 재실행**으로 일부 대체 |

> 향후 ML 요소가 필요하면 별도 검토. 현 범위는 **I/O·검증·책자**로 한정(사용자 확정).

---

## 3. 우선순위 요약 (life matrix)

| 우선순위 | 항목 | 난이도 | 비고 |
|---|---|---|---|
| 1 | 1-4 샘플 메타 스키마 → 1-3 레퍼런스 확장 | 낮음 | 보험종류별 데모 |
| 2 | 1-1 데이터 개요 패널 | 낮음~중 | 입력 요약 |
| 3 | 1-2 URL 로더(TS fetch) | 중 | 표준생명표/요율 |
| 4 | 1-5 TS verify 하네스 | 중 | 재현성 보증(신규·고가치) |
| 5 | 1-6 재계산 함수 내보내기 | 중 | 기존 내보내기 보강 |

> **불변식(TS 결정성):** 무작위·부동소수 연산 순서 고정으로 2회 실행 byte-identical 출력. DSL 양방향 동기화(`dslParser.ts`/`moduleSync.ts`)와 모듈 파라미터 정합 유지. sklearn/Pyodide 재현성 개념은 미적용.


---

## 부록: 구현 결과 (2026-06-22)

> life matrix flow new는 **독자 범위(I/O·검증·책자)** 항목을 모두 구현 완료했습니다. sklearn 계열은 해당 없음(순수 TS).

### 항목별 구현 상태
| 항목 | 상태 | 비고 |
|---|---|---|
| 1-1 데이터 개요 패널 | ✅ | utils/dataOverview.ts + DataPreviewModal |
| 1-2 URL 로더(TS fetch) | ✅ | 파일/URL 토글 + /api/proxy-csv 폴백 |
| 1-3 레퍼런스 샘플 3종(.lifx) | ✅ | 정기·종신·양로 |
| 1-4 샘플 메타 스키마 강화 | ✅ | insuranceType/actuarialBasis/expectedPremium 등 |
| 1-5 TS 재현성 verify 하네스 | ✅ | utils/pipelineEngine.ts 추출(동작 보존) + verify/pipelines.repro.test.ts |
| 1-6 보험료 재계산 함수 내보내기 | ✅ | utils/recomputeExport.ts(고급기능 게이트) |
| 2-1/2-2/3-1/3-4/3-5 (sklearn 계열) | — 해당 없음 | 순수 TS, 보험계리 공식 기반 |
| 3-7 재학습 | △ 부분 | ScenarioRunner 시나리오 재실행으로 대체(기존) |

### 검증
- `npm run verify:pipelines` → **5/5 PASS** (보험료/준비금 2회 실행 동일성). 기존 테스트 110/110 PASS.
- `vite build` 성공. executePipeline 코어 추출은 동작 보존(call-through), 모듈 계산 로직 불변.
