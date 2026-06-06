# 코드↔모듈 양방향 동기화 설계 (Strategy A: DSL/마커 기반)

> 작성자: sync-architect
> 입력: `_workspace/01_logic_auditor_findings.md` (drift D-1~D-10, 입출력 계약 맵, C-1/C-2), `_workspace/02_ux_review.md`, 사용자 확정 전략 **A**
> 상태: **승인 완료 (2026-06-06). Phase 3 구현 진행.** ModuleType 1개씩 구현.
>
> ## ✅ 사용자 승인 결정 (2026-06-06) — 이 블록이 §9 미결 항목보다 우선
> 1. **편집 표면 = DSL 탭만** (Python 읽기전용 유지). §9.2-4 확정.
> 2. **엔진(executePipeline) 수정 금지 — 표시·동기화만.** drift 단일화는 "표시코드(getModuleCode)를 엔진에 맞춤" 방향으로만. 엔진 로직(§7의 D-8 processIfStatements 포함)은 **건드리지 않는다.** 산출값 불변 보장.
> 3. **D-1 다중탈퇴 = 선택형으로 둘 다 지원 (사용자 추가 지시 2026-06-06).** 다중탈퇴 결합은 위험률(계산 항목)별로 다를 수 있으므로, **독립곱 `1-∏(1-qi)`** 과 **UDD 보정 `qm+qo-qm*qo/2`** 을 **계산 항목별로 선택** 가능하게 한다.
>    - `CalculateSurvivors`의 각 calculation에 `decrementMethod: 'udd' | 'independent'` 파라미터 추가.
>    - **엔진(executePipeline) 통제된 추가 변경 1건 허용**: 해당 파라미터로 분기. **기본값 = `'udd'`(현재 동작)** 으로 기존 파이프라인 결과 불변 보장. 이것이 "엔진 보존" 결정의 유일한 예외(사용자 명시 지시).
>    - getModuleCode 표시·DSL 표현·항목별 UI(드롭다운) 모두 이 선택을 반영.
>    - D-7/D-9는 여전히 엔진 미수정 → 표시코드를 엔진 실제 동작에 맞춰 보정/주석. §9.2-1,2,3 확정.
> 4. **테스트 러너 = vitest** (devDependency 추가). §9.2-5 확정.
> 5. ScenarioRunner/TextBox/GroupBox/PipelineExplainer = DSL 코드편집 비대상(안내 표시). §9.2-6 확정.
> 6. reverse 적용 시 하류 Pending 리셋 = 기존 updateModuleParameters 동작 유지(맞음). §9.2-7 확정.
>
> **결과적 Phase 3 범위:** DSL 양방향 동기화 + schemaInference 자동인식 + 표시코드 보정(C-1 case 추가, D-2~D-10 표시 보정, D-1/D-7/D-9는 주석). **엔진 코드 변경 0건.**
> 핵심 발견: **양방향 DSL 인프라가 이미 존재**한다 (`utils/dslParser.ts`). 새 파서를 만들 필요가 거의 없고, 기존 자산을 "단일 모듈 단위"로 재포장 + drift 보정하는 것이 본 설계의 핵심.

---

## 0. 핵심 요약 (먼저 읽기)

1. **진실 원천 = 모듈 `parameters`** (앱 상태, `CanvasModule.parameters`). 코드/DSL은 그 표현(view).
2. **전략 A는 두 표현을 가진다:**
   - **DSL 텍스트** (`## Module` + `output = formula` + `// 주석`): **이미 forward/reverse 양방향 완성** (`generateDSL` ↔ `parseDSL`+`buildModuleConfigs`). 이것이 round-trip 안정성의 본체.
   - **Python 의사코드** (`getModuleCode`): **표시(display) 전용, forward-only**. 이건 "읽기용 설명"으로 유지하고 round-trip 대상에서 제외한다. drift 보정만 한다.
3. **CodeTerminalPanel을 편집 가능으로 만들 때, 편집 대상은 Python 의사코드가 아니라 "해당 모듈의 DSL 섹션"이다.** 즉 패널에 DSL 탭(편집 가능) + Code 탭(Python, 읽기 전용) + Terminal 탭 3개를 둔다. 이렇게 하면 reverse 파서를 새로 짤 필요 없이 `extractModuleSection`/`parseDSL`/`buildModuleConfigs`를 그대로 쓴다.
4. **무손실 보장은 DSL 차원에서만 계약한다** (`parse(generate(params)) ≈ params`). Python 의사코드는 무손실 비대상.

---

## 1. 단일 진실 원천과 데이터 흐름

### 1.1 진실 원천
- **SoT = `modules[i].parameters`** (App.tsx 상태, `setModules`로만 변경).
- 변경 경로(기존):
  - `updateModuleParameters(id, params, replace?)` — 단일 모듈 (App.tsx:2098). `replace=true`면 파라미터 전체 교체.
  - `handlePatchParametersFromDSL(configs, name)` — DSL 모달에서 다수 모듈 일괄 patch (App.tsx:1854).

### 1.2 Forward (모듈 → 표현)
```
parameters ──generateDSL()──▶ DSL 텍스트 (전체)
           └─extractModuleSection()─▶ 단일 모듈 DSL 섹션  ← CodeTerminalPanel DSL 탭에 표시
parameters ──getModuleCode()──▶ Python 의사코드          ← CodeTerminalPanel Code 탭(읽기전용)
```

### 1.3 Reverse (표현 → 모듈)
```
편집된 단일 모듈 DSL 섹션
  ──parseDSL()──▶ DSLModel
  ──buildModuleConfigs()──▶ [{type, parameters}]
  ──(해당 type만 추출)──▶ updateModuleParameters(selectedId, params, replace=true)
  ──▶ setModules ──▶ (forward 재실행으로 DSL 재생성: self-update 차단 플래그 필요)
```

### 1.4 무한루프 방지 (출처 플래그)
- forward는 `selectedModule.parameters`가 바뀌면 `useEffect`로 DSL을 재생성한다.
- reverse가 방금 적용한 변경이 다시 forward를 트리거해 사용자가 편집 중인 텍스트를 덮어쓰면 안 된다.
- **해법:** `CodeTerminalPanel` 내부 `editingRef`(boolean). 사용자가 textarea를 편집하면 `editingRef=true`. forward useEffect는 `editingRef.current === false`일 때만 텍스트를 재설정. "적용" 성공 후 `editingRef=false`로 내려 다음 외부 변경(예: PropertiesPanel 편집)을 다시 받게 한다. (즉시 파싱이 아니라 "적용 버튼" 모델을 택하므로 루프 위험이 구조적으로 낮다 — §5 참조.)

---

## 2. 전략 A 구체화: 무엇을 쓰고 무엇을 만들 것인가

### 2.1 기존 인프라 재사용 (신규 작성 최소화)
| 기능 | 기존 함수 | 위치 | 재사용 여부 |
|------|-----------|------|-------------|
| 모듈→DSL (전체) | `generateDSL` | dslParser.ts:586 | ✅ 그대로 |
| 모듈→DSL (단일 섹션 추출) | `extractModuleSection` | dslParser.ts:549 | ✅ 그대로 |
| DSL 섹션 교체 | `replaceModuleSection` | dslParser.ts:568 | ✅ 그대로 |
| DSL→모델 | `parseDSL` | dslParser.ts:377 | ✅ 그대로 |
| 모델→파라미터 | `buildModuleConfigs` | dslParser.ts:460 | ✅ 그대로 |
| 흐름 검증 | `analyzeFlowErrors` | dslParser.ts:884 | ✅ 인라인 에러에 재사용 |
| 단일 모듈 patch | `updateModuleParameters(id, p, true)` | App.tsx:2098 | ✅ reverse 적용 경로 |

### 2.2 신규로 필요한 최소 코드
- **`utils/moduleSync.ts`** (신규, 소형): 단일 모듈에 특화된 wrapper.
  - `moduleToDSLSection(module): string` — `generateDSL(name, [module(+policyInfo)])` → `extractModuleSection(..., module.type)`.
  - `dslSectionToParams(sectionText, type): { ok: true, parameters } | { ok: false, error }` — 섹션 텍스트를 `## Label` 헤더가 없으면 붙여서 `parseDSL` → `buildModuleConfigs` → 해당 type의 parameters만 반환. 실패/빈 결과 시 `ok:false`.
  - 이 wrapper가 "단일 모듈 round-trip 계약"의 단언 지점이 된다.
- **round-trip 테스트** (`_workspace/tests/roundtrip.test.ts`, 단 **테스트 러너 미설치** → §8 위험 항목 참조).

### 2.3 왜 Python 의사코드를 reverse 대상에서 빼는가 (트레이드오프)
- Python 의사코드(`getModuleCode`)는 자유형식·다중 분기·자연어 주석이 섞여 있어 결정적 역파싱이 사실상 C 전략(취약)이 된다.
- DSL은 이미 `output = formula` 한 줄 문법으로 **결정적**이고 양방향이 검증돼 있다.
- 따라서 **편집은 DSL에서, Python은 "이 모듈이 내부적으로 무엇을 하는지" 설명용 읽기 텍스트로** 역할 분리. 사용자 요구("코딩을 입력하면 모듈에 반영")는 DSL 탭으로 100% 충족된다.

---

## 3. ModuleType별 round-trip 계약

범례: **DSL** = DSL 섹션으로 표현·역파싱되어 무손실 / **마커** = 코드로 표현 안 되고 파라미터/주석 마커로만 보존 / **N/A** = 비계산·DSL 비대상.

| ModuleType | DSL 표현 항목 | round-trip 무손실? | 마커/보존 처리 | 비고 |
|------------|---------------|--------------------|----------------|------|
| DefinePolicyInfo | `# 헤더` age/sex/pay/rate | ⚠️ 부분 | `policyTerm`, `maturityAge`는 헤더에 미출력(generateDSL이 age/sex/pay/rate만 출력) → **헤더에 `term=`,`maturity=` 추가 필요** | D-3 연동. 현재 무손실 깨짐 |
| LoadData | `file = source` | ✅ | `fileContent`(CSV 본문)는 DSL에 없음 → 파라미터로만 보존(reverse 시 기존 값 유지) | fileContent를 DSL이 덮어쓰지 않게 merge |
| SelectData | `newName = originalName` 줄 | ✅ | `selected:false` 항목은 DSL에 안 나옴 → reverse 시 누락. **주석 `// off: col`로 보존** 권장 | deathRateColumn 자동 |
| SelectRiskRates | `ageCol`,`genderCol` | ⚠️ 부분 | `excludeNonNumericRows`,`columnRenames`는 DSL 미표현 → 파라미터 merge 보존 | D-4는 표시코드 문제(별개) |
| RateModifier | `newColumnName = formula` | ✅ | 없음 | D-10은 표시코드 문제 |
| CalculateSurvivors | `mortalityCol`, `lx_X = lx(rates)` / `lx_X = 고정값` | ✅ | `addFixedLx`, `ageColumn` 파라미터 merge 보존 | D-1은 **엔진 로직**(표시·실행), DSL round-trip과 무관 |
| ClaimsCalculator | `dx_X = lxCol * riskCol` | ✅ | `Cx_` 줄은 파생(재생성). name/lxColumn/riskRateColumn 복원 | D-5 표시코드 |
| NxMxCalculator | `Nx_X = cumsum_rev(base)`, `Mx_X = cumsum_rev(base, deduct=)` | ⚠️ 부분 | `paymentRatios`(연도별 지급비율 배열)는 DSL 미표현 → **마커 `// ratios=[...]` 또는 파라미터 merge 보존** | D-2 표시코드 |
| PremiumComponent | `NNX_X = Diff(Nx_X, m)`, `BPV_X = Diff(Mx_X, n) * amount` | ✅ | 없음 | D-6/D-7 표시·엔진 |
| AdditionalName | `name = value` (basicValues) | ⚠️ 부분 | `definitions`(static/lookup 복합 객체)는 DSL 미표현 → 파라미터 merge 보존 또는 JSON 마커 | C-1 표시코드 누락 |
| NetPremiumCalculator | `varName = formula` | ✅ | 없음 | D-8 IF 미지원(엔진) |
| GrossPremiumCalculator | `varName = formula` | ✅ | 없음 | C-1 표시코드 누락 |
| ReserveCalculator | `V[t<=m] = f1`, `V[t>m] = f2` | ✅ | `reserveColumnName` 파라미터 merge 보존 | D-9 행참조 문법(엔진) |
| ScenarioRunner | (DSL 섹션 라벨 존재하나 본문 미파싱) | ❌ | `scenarios` 배열 → JSON 마커 필요하거나 DSL 비대상 처리 | DSL 비대상 권장 |
| PipelineExplainer | N/A | N/A | — | 메타 모듈 |
| TextBox / GroupBox | N/A | N/A | `content`/`fontSize`/group bounds | 비계산. DSL 비대상 |

### 3.1 round-trip 계약의 정확한 정의 (중요)
완전 동일(`===`)이 아니라 **"DSL-표현 가능 키의 무손실 + 비표현 키의 보존"**으로 계약한다:
```
applyReverse(params0) = merge(params0, dslSectionToParams(moduleToDSLSection(params0)))
계약: applyReverse(params0) 의 DSL-표현 키 === params0 의 DSL-표현 키
      AND  비표현 키(fileContent, definitions, paymentRatios, scenarios...) 는 params0에서 그대로 유지
```
→ **reverse 적용은 항상 `replace=false` (merge)** 로 한다. 이래야 DSL에 없는 키(fileContent 등)가 사라지지 않는다. (단 selections처럼 "DSL이 권위를 갖는" 배열은 교체. §3 테이블의 ⚠️ 항목별로 merge/replace 정책을 개별 지정 — §8 사용자 확인.)

---

## 4. reverse 파서 설계

### 4.1 파일/시그니처 (`utils/moduleSync.ts`, 신규 ~80줄)
```ts
export interface ReverseResult {
  ok: boolean;
  parameters?: Record<string, any>;   // DSL에서 복원된 부분 파라미터 (merge용)
  errors?: DSLFlowError[] | string[]; // 인라인 표시용
}

// forward: 단일 모듈 → DSL 섹션 텍스트
export function moduleToDSLSection(
  module: CanvasModule,
  policyInfo?: CanvasModule,   // m/n/age 토큰 맥락이 필요한 모듈용 (선택)
  productName?: string
): string;

// reverse: DSL 섹션 텍스트 → 부분 파라미터
export function dslSectionToParams(
  sectionText: string,
  type: ModuleType
): ReverseResult;
```

### 4.2 reverse 알고리즘
1. `sectionText`에 `## Label` 헤더가 없으면 `DSL_MODULE_LABELS[type]`로 붙인다(사용자가 본문만 편집해도 동작).
2. `parseDSL(headeredText)` → `model`. `model.errors` 비어있지 않으면 → `ok:false, errors`.
3. `buildModuleConfigs(model)` → `configs`. `configs.find(c => c.type === type)` 추출.
4. 없으면 → `ok:false` (마지막 유효 상태 유지).
5. `analyzeFlowErrors(model)`로 미정의 변수 경고를 수집(차단 아닌 경고).
6. `ok:true, parameters: config.parameters, errors: warnings`.

### 4.3 실패 시 폴백 (데이터 손실 금지 — 절대 원칙)
- `ok:false`면 **`updateModuleParameters`를 호출하지 않는다.** 모듈 파라미터는 마지막 유효 상태 그대로.
- 패널에 인라인 에러(빨간 배너 + 줄 번호)만 표시. textarea 내용은 사용자가 계속 편집 가능(되돌릴 기회 보존).
- `ok:true`라도 빈 parameters(전부 인식 실패)면 적용 보류 + "인식된 항목 없음" 경고.

### 4.4 무한루프 방지 (재확인)
- "적용" 버튼 모델 + `editingRef` 플래그(§1.4). 디바운스 자동적용을 쓰더라도 적용 직후 forward는 `editingRef`로 1틱 무시.

---

## 5. 편집 UI 통합 (CodeTerminalPanel)

### 5.1 탭 구조 변경
현재: `Code | Terminal`(2탭, 둘 다 읽기전용).
변경: **`모듈(DSL) | 코드(Python) | 터미널`** (3탭).
- **모듈(DSL) 탭** — `<textarea>` 편집 가능. 내용 = `moduleToDSLSection(selectedModule)`.
  - 하단: `[적용]` 버튼 + 변경 표시 dot + 인라인 에러 영역.
  - `[적용]` → `dslSectionToParams` → `ok`면 `updateModuleParameters(id, params, false)` 호출(merge), `editingRef=false`.
  - `ok:false`면 에러 배너(줄 번호 클릭 시 textarea 해당 줄 선택 — PipelineDSLModal의 `handleFlowErrorClick` 패턴 재사용).
- **코드(Python) 탭** — 기존 `getModuleCode`, `<pre>` 읽기전용 유지(설명용).
- **터미널 탭** — 기존 그대로.

### 5.2 동기화 동작
- forward: `selectedModule.parameters` 변경 → `editingRef.current===false`일 때만 DSL textarea 재설정.
- reverse: `[적용]` → SoT 변경 → PropertiesPanel/ParameterInputModal과 자동 동기(모두 같은 `modules` 상태 구독).
- props 추가: `onApplyModuleDSL?: (moduleId, parameters) => void` (App.tsx에서 `updateModuleParameters` 바인딩). 기존 호출부 변경 최소.

### 5.3 안전장치
- 자동적용 대신 **명시적 [적용] 버튼**(기본값). debounce 자동적용은 옵션 토글로 둘 수 있으나 1차 구현에선 버튼만.
- DSL 비대상 모듈(ScenarioRunner/TextBox/GroupBox/PipelineExplainer) 선택 시: DSL 탭에 "이 모듈은 코드 편집을 지원하지 않습니다" 안내 + textarea 비활성.

---

## 6. 입출력 자동 인식 보강

### 6.1 문제 (감사 C-2 / UX): 상류 미실행 시 빈 드롭다운
- 현재 드롭다운은 상류 `outputData.columns`에서만 컬럼을 읽음(`ParameterInputModal.tsx:165`). 상류 미실행이면 빈 목록 → 수동 타이핑.

### 6.2 해법: 정적 스키마 추론 (`utils/schemaInference.ts`, 신규)
- 실행 없이 **파라미터만으로 하류가 보게 될 컬럼명을 예측**한다. 엔진의 prefix 규칙을 그대로 모사:
  - SelectRiskRates → `['i_prem','i_claim','Age','Gender', ...selectedCols]`
  - CalculateSurvivors → 각 calc에 대해 `lx_{name}`, `Dx_{name}` (+옵션 `lx`)
  - ClaimsCalculator → `dx_{name}`, `Cx_{name}` (중복 시 `_N` suffix 규칙도 모사 — D-5)
  - NxMxCalculator → `Nx_{name}`, `Mx_{name}`
  - PremiumComponent → 토큰 `NNX_X(Year|Half|Quarter|Month)`, `BPV_X`, `MMX`, `SUMX`
  - AdditionalName → basicValues name들 + definitions name들
- `inferOutputColumns(module): string[]` + `inferUpstreamColumns(targetModuleId, modules, connections): string[]`(상류 체인 누적).
- **드롭다운 소스 = `outputData.columns ?? inferred`**. 실행 전엔 추론값, 실행 후엔 실제값(우선). 추론은 "예상값" 배지로 구분 표시.

### 6.3 수식 토큰 자동완성
- PipelineDSLModal에 이미 `BUILTIN_VARS` + `extractDSLVars`로 자동완성이 있음(dslParser/Modal). CodeTerminalPanel DSL 탭에도 **동일 자동완성 컴포넌트를 재사용**하거나, 최소한 상류 추론 컬럼(§6.2)을 후보로 제공.
- 토큰 오타 위험(괄호 포함 `NNX_X(Year)`, `[α1]`)을 줄이기 위해 추론된 정확한 토큰명을 자동완성 1순위로.

### 6.4 변경 전파/끊긴 참조 경고
- `analyzeFlowErrors`가 이미 "이전 모듈에서 정의되지 않은 변수"를 잡아냄(dslParser.ts:884). 이를 CodeTerminalPanel 인라인 경고로 노출.
- SelectData rename / CalculateSurvivors name 변경 시 하류 baseColumn 참조 갱신은 기존 `handleModuleSaved`(App.tsx:1906)의 nameChanges 전파 로직이 담당 — DSL 적용 경로에서도 동일 전파 훅을 타도록 연결(§8 확인 항목).

---

## 7. drift 단일화 계획 (forward Python 코드를 엔진에 맞춤)

> 원칙: **엔진(`executePipeline`)이 권위.** `getModuleCode`를 엔진 실제 로직에 맞게 보정. (D-1만 예외 — 계리 정답 미확정.)
> 이 작업은 round-trip과 독립적이며, "표시-실행 괴리 축소"(원칙 5) 충족용. DSL round-trip에는 영향 없음.

| ID | 모듈 | 보정 내용 | 권위 위치 | 위험도 |
|----|------|-----------|-----------|--------|
| **D-1** | CalculateSurvivors | 다중탈퇴 결합식: 표시 `1-∏(1-qi)` vs 엔진 `qm+qo-qm*qo/2`(UDD형). **정답 미확정 → 사용자(계리) 확인 후 단일화.** 확정 전엔 표시코드에 "엔진은 UDD 1/2 보정 사용" 주석만 추가 | 엔진 App.tsx:3121 / 표시 codeSnippets.ts:142 | **높음(보류)** |
| **D-2** | NxMxCalculator | Mx adjusted_Cx에 면책 factor(0.75/0.5/custom, index0)·연도별 paymentRatios 곱 반영 | App.tsx:3517-3535 | 중 |
| **D-6** | PremiumComponent | BPV scalar: 종신(policyTerm=0→last index) 분기 + 경계초과 last-row fallback 추가 | App.tsx:3773-3787 | 중 |
| **D-7** | PremiumComponent | 표 컬럼 `BPV_Col`(=Σ Mx[row]×amount)가 scalar BPV(구간차)와 다름. 의미 확정 후 정합 또는 컬럼 설명 명시. **계리 의미 [검증필요] → 사용자 확인** | App.tsx:3862-3870 | 중(확인필요) |
| **D-9** | ReserveCalculator | 행참조 문법 `[col][t|m|n|0]`: 엔진은 스칼라 m/n만 지원, 표시코드는 행참조 변환. **엔진에 행참조 구현 추가** 또는 표시코드를 엔진 모델로 축소. 두 문법 단일화 필요 — 방향 사용자 확인 | App.tsx:4563-4595 / codeSnippets.ts:251 | **높음** |

부수 보정(표시코드 누락 추가, drift 잔여):
- **C-1**: `getModuleCode`에 `GrossPremiumCalculator`, `AdditionalName` case 추가.
- D-3(maturityAge→policyTerm), D-4(자동 policyTerm/리네임/필터), D-5(중복 suffix), D-8(NetPremium IF 미지원 — 엔진에 `processIfStatements` 추가가 더 옳음), D-10(RateModifier 토큰/IF/반올림) — 표시코드 주석/로직 보강.

> **D-8은 표시 보정이 아니라 엔진 수정**이 정답(다른 수식 모듈과의 일관성). 엔진 App.tsx:4304 직전에 `expression = processIfStatements(expression)` 1줄 추가. 별도 승인.

---

## 8. 파일별 변경 계획 + 단계별 구현 순서

### 8.1 신규 파일
| 파일 | 내용 | 크기 | 위험도 |
|------|------|------|--------|
| `utils/moduleSync.ts` | 단일 모듈 forward/reverse wrapper (§4.1) | 소 (~80줄) | 낮음 (기존 함수 조합) |
| `utils/schemaInference.ts` | 정적 출력 컬럼 추론 (§6.2) | 중 (~150줄) | 중 (엔진 prefix 규칙 모사 정확도) |
| `_workspace/tests/roundtrip.test.ts` | 타입별 round-trip 단언 | 중 | 낮음 (단 러너 미설치) |

### 8.2 수정 파일
| 파일 | 변경 | 크기 | 위험도 |
|------|------|------|--------|
| `components/CodeTerminalPanel.tsx` | 3탭화, DSL textarea 편집+적용+인라인에러, editingRef (§5) | 중~대 | 중 (UI 회귀) |
| `App.tsx` | CodeTerminalPanel에 `onApplyModuleDSL` prop 연결(=updateModuleParameters bind). 이름변경 전파 훅 연결 | 소 | 낮음 |
| `utils/dslParser.ts` | DefinePolicyInfo 헤더에 `term=`/`maturity=` 출력+파싱(D-3 round-trip), SelectData `// off:` 보존(선택) | 소 | 중 (기존 DSL 호환) |
| `codeSnippets.ts` | C-1 case 추가 + D-2/D-3/D-4/D-5/D-6/D-10 표시코드 보정 | 중 | 낮~중 (표시 전용) |
| `App.tsx` (엔진) | D-8 processIfStatements 1줄, (승인 시) D-9 행참조, D-1 결합식 | 소~중 | **높음 (실행 결과 변동)** |
| `ParameterInputModal.tsx` | 드롭다운 소스에 inferred 컬럼 fallback (§6.2) | 소 | 중 |

### 8.3 단계별 구현 순서 (ModuleType 1개씩, 각 단계 후 qa-runner 검증)
**Phase 0 — 기반 (round-trip 인프라, 실행결과 무영향)**
1. `utils/moduleSync.ts` 작성 + round-trip 단언(러너 결정 후).
2. `dslParser.ts` DefinePolicyInfo 헤더 term/maturity 보강 → DefinePolicyInfo round-trip 무손실 확보.

**Phase 1 — 편집 UI (모듈 1개로 검증)**
3. CodeTerminalPanel 3탭 + DSL 편집/적용/에러. **NetPremiumCalculator**(가장 단순, formula 1줄)로 end-to-end 검증.
4. App.tsx prop 연결.

**Phase 2 — 모듈 확대 (한 번에 하나)**
순서: SelectData → SelectRiskRates → RateModifier → CalculateSurvivors → ClaimsCalculator → NxMxCalculator → PremiumComponent → AdditionalName → Gross → Reserve.
각 모듈: (a) round-trip 단언 통과 (b) merge/replace 정책 확정 (c) qa-runner 검증.

**Phase 3 — 자동 인식**
5. `schemaInference.ts` + ParameterInputModal/DSL탭 드롭다운 fallback.

**Phase 4 — drift 단일화 (표시, 실행무영향 먼저)**
6. codeSnippets.ts C-1/D-2~D-10 표시 보정.
7. (별도 승인) 엔진 수정 D-8 → D-9 → D-1.

---

## 9. 트레이드오프 / 사용자 확인 필요 항목

### 9.1 트레이드오프
- **편집 표면을 DSL로 한정**: Python 의사코드는 읽기 전용 유지. 장점=결정적 무손실·구현 최소·기존 검증 자산 재사용. 단점=사용자가 "Python을 직접 편집"하진 못함(요구는 DSL로 충족). → 권장.
- **적용 버튼 vs 즉시 동기**: 버튼=루프/오타 안전, 단계 1회 추가. 즉시=매끄럽지만 위험. → 1차 버튼.
- **merge 우선 reverse**: DSL 비표현 키(fileContent/definitions/paymentRatios/scenarios) 보존. 단점=DSL에서 항목을 "삭제"해도 파라미터에 남을 수 있음(배열은 replace로 개별 처리).

### 9.2 사용자(또는 계리) 확인 필요
1. **D-1 다중탈퇴 결합 정답식**: 독립곱(`1-∏(1-qi)`) vs UDD 1/2 보정(`qm+qo-qm*qo/2`) 중 무엇이 정답인가? (엔진/표시 단일화 방향 결정) — **계리 확인**.
2. **D-9 준비금 행참조 단일화 방향**: 엔진에 `[col][t|m|n]` 행참조를 구현할지, 표시코드를 엔진의 스칼라 모델로 축소할지.
3. **D-7 BPV_Col 의미**: 표 컬럼(Σ Mx[row]) vs scalar(구간차) — 어느 정의가 의도인가.
4. **편집 표면 확정**: "DSL 탭 편집"으로 사용자 요구("코딩 입력→모듈 반영")가 충족되는지, 아니면 Python 자유편집까지 원하는지.
5. **테스트 러너 부재**: 현재 vitest/jest 미설치(package.json 확인). round-trip TDD를 위해 vitest 추가를 승인할지, 아니면 임시 `node`/`tsx` 실행 스크립트로 대체할지.
6. **DSL 비대상 모듈(ScenarioRunner) 처리**: 코드편집 비지원으로 둘지, scenarios JSON 마커까지 지원할지.
7. **reverse 적용 시 status 리셋 범위**: `updateModuleParameters`는 변경 시 하류를 Pending 리셋(App.tsx:2128). DSL 적용도 동일하게 하류 리셋이 맞는지(맞다고 가정).
