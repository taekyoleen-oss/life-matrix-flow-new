# 보험료 산출 파이프라인 로직 완결성 감사 결과

> 감사관: pipeline-logic-auditor
> 대상 커밋 기준 작업트리: `App.tsx` (6475 lines), `codeSnippets.ts` (312), `constants.ts` (332), `types.ts` (152)
> 진실원천 2개: `App.tsx` `executePipeline` (line 2473~4936, 실제 엔진) ↔ `codeSnippets.ts` `getModuleCode` (line 12~312, 표시용 Python 의사코드)
> 모든 근거는 `file:line` 인용. 확신 없는 항목은 **[검증필요]** 표기.

---

## 모듈 커버리지 매트릭스

`types.ts:1-19`의 `ModuleType` enum 17종 전체 기준.

| # | ModuleType | executePipeline 분기 | getModuleCode case | 일치 여부 |
|---|------------|----------------------|--------------------|-----------|
| 1 | LoadData | ✅ `App.tsx:2650` | ✅ `codeSnippets.ts:16` | ⚠️ 표시는 read_csv 시뮬레이션, 실제는 인메모리 CSV 파싱 (의사코드 수준 일치) |
| 2 | SelectData | ✅ `App.tsx:2693` | ✅ `codeSnippets.ts:32` | ✅ 일치 (열 선택/리네임) |
| 3 | DefinePolicyInfo | ✅ `App.tsx:2815` | ✅ `codeSnippets.ts:72` | ⚠️ **drift**: 표시코드에 maturityAge→policyTerm 환산 로직 없음 (D-3) |
| 4 | SelectRiskRates | ✅ `App.tsx:2838` | ✅ `codeSnippets.ts:85` | ⚠️ 할인계수 일치, 그러나 표시코드는 policyTerm 자동산출·열 리네임·excludeNonNumericRows 미반영 (D-4) |
| 5 | CalculateSurvivors | ✅ `App.tsx:3019` | ✅ `codeSnippets.ts:112` | ❌ **drift Critical**: 다중탈퇴 결합식 불일치 (D-1) |
| 6 | ClaimsCalculator | ✅ `App.tsx:3172` | ✅ `codeSnippets.ts:162` | ⚠️ 핵심수식 일치, 표시코드에 열 중복방지(getSafeName)·기본계산 자동생성 없음 (D-5) |
| 7 | NxMxCalculator | ✅ `App.tsx:3337` | ✅ `codeSnippets.ts:177` | ❌ **drift High**: Mx 면책/지급비율 조정이 표시코드는 placeholder (D-2) |
| 8 | PremiumComponent | ✅ `App.tsx:3567` | ✅ `codeSnippets.ts:200` | ❌ **drift High**: BPV 인덱스(payment_term vs policy_term)·BPV_Col 수식 불일치 (D-6, D-7) |
| 9 | NetPremiumCalculator | ✅ `App.tsx:4164` | ✅ `codeSnippets.ts:230` | ⚠️ 표시코드는 `# net_premium = eval(...)` 주석만, 실제는 토큰치환+Function 평가. 의사코드라 placeholder 수준 (D-8) |
| 10 | GrossPremiumCalculator | ✅ `App.tsx:4318` | ❌ **없음 → default placeholder** | ❌ **누락 High** (C-1) |
| 11 | ReserveCalculator | ✅ `App.tsx:4505` | ✅ `codeSnippets.ts:239` | ❌ **drift Critical**: 분기 경계 t≤m 인덱스 정의 불일치 (D-9) |
| 12 | ScenarioRunner | ❌ executePipeline에 분기 없음 (별도 `runScenarioRunner` `App.tsx:4938`) | ✅ `codeSnippets.ts:284` | ⚠️ 의도된 분리. 단, executePipeline 직접 호출 시 무처리·무출력 Success (C-2) |
| 13 | RateModifier | ✅ `App.tsx:2742` | ✅ `codeSnippets.ts:55` | ⚠️ 표시코드에 IF()·m/n·PaymentTerm 토큰·반올림 없음 (D-10) |
| 14 | PipelineExplainer | ✅ `App.tsx:4624` | ✅ `codeSnippets.ts:301` | ✅ (성격상 placeholder, 허용) |
| 15 | AdditionalName | ✅ `App.tsx:3927` | ❌ **없음 → default placeholder** | ❌ **누락 High** (C-1) |
| 16 | TextBox | ❌ 분기 없음 → 무출력 Success | ❌ default placeholder | ⚠️ 비계산 모듈 (C-2) |
| 17 | GroupBox | ❌ 분기 없음 → 무출력 Success | ❌ default placeholder | ⚠️ 비계산 모듈 (C-2) |

**커버리지 요약:** 계산 모듈 13종 중 executePipeline 구현 13/13. getModuleCode는 `GrossPremiumCalculator`, `AdditionalName` 2종 누락(placeholder). drift 10건(아래 D-1~D-10).

---

## 발견 사항

### Critical

#### [Critical] C-2. executePipeline에 최종 `else` 분기 부재 → 미지원 타입이 "성공"으로 위장
- `file:line`: `App.tsx:2650`(if 체인 시작) ~ `App.tsx:4895`(체인 종료, 마지막 분기 PipelineExplainer), `App.tsx:4897` `newStatus = ModuleStatus.Success`
- **현상**: `if (LoadData) … else if (PipelineExplainer) { … }` 체인에 **최종 `else`(미지원 타입 처리)가 없다**. ScenarioRunner / TextBox / GroupBox가 runQueue에 들어오면 어떤 분기도 타지 않고 그대로 `4897`로 진행해 `newOutputData = undefined`(`App.tsx:2647`)인 채 **status=Success**로 마킹된다(`App.tsx:4922-4931`).
- **영향**: 하류 모듈이 `getAndValidateConnectedInput`에서 "ran successfully but produced no output"(`App.tsx:2562`) 에러를 만나거나, 사용자가 빈 성공을 정상 산출로 오인. 알 수 없는 신규 ModuleType 추가 시에도 조용히 통과(silent failure).
- **권장 수정**: if 체인 끝에 `else { throw new Error('Unsupported module type in executePipeline: ' + module.type); }` 추가. ScenarioRunner는 runQueue 진입 자체를 차단(현재 `App.tsx:5155-5158`에서 Run All은 필터링하나 직접 실행 경로 확인 필요).

#### [Critical] D-1. CalculateSurvivors 다중탈퇴 결합식이 표시코드와 실제 엔진에서 다름
- `file:line`: 실제 `App.tsx:3119-3122`; 표시 `codeSnippets.ts:142-150`
- **현상**:
  - 표시코드(getModuleCode): 독립결합 `q_total = 1 - ∏(1 - q_i)` (`codeSnippets.ts:146-149`). 이는 SKILL.md가 정상으로 규정한 식.
  - 실제엔진(executePipeline): mortality + 기타탈퇴가 동시 존재할 때 `totalDecrementFactor = mortalityRate + q_others - (mortalityRate * q_others) / 2.0` (`App.tsx:3121`). 이는 **UDD(균등분포) 1/2 보정식**으로, 독립곱 `1-(1-qm)(1-qo)=qm+qo-qm*qo`와 **분모 계수가 다름**(`-qm*qo` vs `-qm*qo/2`).
  - 또한 표시코드는 단일탈퇴(`codeSnippets.ts:139` `q=row[col]`)와 다중탈퇴를 분기하지만, 실제엔진은 "mortality 단독", "기타 단독", "둘 다" 3분기(`App.tsx:3098-3123`)로 mortalityColumn 특별취급. 단순 결합 외에 mortality를 별도 변수로 분리하는 로직이 표시코드에 전혀 없음.
- **영향**: 사용자가 보는 코드의 사망/탈퇴 결합 결과 ≠ 실제 lx. 다중탈퇴 상품에서 lx, Dx, 이후 Nx/Mx/보험료/준비금 전 단계가 체계적으로 어긋남. 어느 식이 보험계리적으로 옳은지 자체가 **[검증필요]** — `/2.0` 보정의 출처(UDD 가정 의도)인지, 버그인지 확인 필요.
- **권장 수정**: 정답 결합식을 확정한 뒤 두 원천을 단일화. (sync-architect 단일화 대상 1순위)

#### [Critical] D-9. ReserveCalculator t≤m / t>m 분기 경계 정의가 표시코드와 실제 엔진에서 불일치
- `file:line`: 실제 `App.tsx:4563`; 표시 `codeSnippets.ts:270, 278`
- **현상**:
  - 실제엔진: `if (rowIndex <= paymentTerm - 1)` → 1차식, else 2차식 (`App.tsx:4563`). 즉 rows 0..m-1 이 "납입중".
  - 표시코드: 1차식 루프 `range(min(payment_term, len(df)))` = idx 0..m-1 (`codeSnippets.ts:270`), 2차식 루프 `range(payment_term, len(df))` = idx m..끝 (`codeSnippets.ts:278`). → 경계는 두 원천이 **우연히 일치**(0..m-1 vs m..).
  - 그러나 인덱스 토큰 변환이 다르다: 표시코드는 `[t]→df.at[idx,'col']`, `[m]→df.at[m_idx]` (m_idx=payment_term-1, `codeSnippets.ts:247`), `[n]→df.at[n_idx]` (n_idx=len-1, `codeSnippets.ts:246`). 실제엔진(`App.tsx:4572-4595`)은 `m`/`n`/`PaymentTerm`/`PolicyTerm`을 **스칼라 값**(paymentTerm, reserveEffectiveN)으로만 치환하고, 행 단위 `[col]`은 현재 행 값으로 치환. **`[col][t]`/`[col][m]`/`[col][n]` 같은 특정행 참조 문법을 실제엔진은 지원하지 않는다**(표시코드만 지원).
- **영향**: 사용자가 표시코드 문법(`Nx_Mortality[m]`)을 믿고 준비금 수식을 작성하면 실제엔진에서는 `[m]`→스칼라 숫자로 치환되어 `Nx_Mortality<숫자>`가 되고 validateFormulaExpression(`App.tsx:2440`)에서 미해결 변수로 throw → 해당 행 `null`(`App.tsx:4606`). 준비금이 조용히 빈 값.
- **권장 수정**: 실제엔진에 표시코드의 `[col][t|m|n|0]` 행참조 변환을 동일 구현하거나, 표시코드를 실제엔진의 "현재행 + 스칼라 m/n" 모델로 축소. 두 문법을 반드시 단일화.

### High

#### [High] C-1. getModuleCode에 GrossPremiumCalculator·AdditionalName case 누락
- `file:line`: `codeSnippets.ts:307-311` (default), executePipeline 구현은 `App.tsx:4318`(Gross), `App.tsx:3927`(Additional)
- **현상**: 두 모듈은 switch에 case가 없어 `default`로 빠져 `# Code generation for GrossPremiumCalculator is not yet implemented.` 표시.
- **영향**: 핵심 산출(영업보험료) 및 추가변수 정의 모듈의 표시코드가 비어 사용자가 로직을 코드로 확인 불가. AdditionalName은 lookup(rowType별 행 인덱스)·basicValues 등 복잡 로직이라 부재 영향 큼.
- **권장 수정**: 두 case 추가. Gross는 `GP = PP / (1 - loadings)` 형태와 토큰치환, Additional은 basicValues + definitions(static/lookup) 의사코드 작성.

#### [High] D-2. NxMx의 Mx 면책(deductible)·지급비율(paymentRatios) 조정이 표시코드에서 placeholder
- `file:line`: 실제 `App.tsx:3517-3535`; 표시 `codeSnippets.ts:190-196`
- **현상**: 실제엔진은 첫행(index 0)에 deductibleType별 factor(0.75/0.5/custom, `App.tsx:3521-3524`)와 연도별 paymentRatios factor(`App.tsx:3526-3533`)를 곱한 adjusted_Cx로 역누적합. 표시코드는 `df['adjusted_Cx'] = df['Cx_..'] # Simplified placeholder`(`codeSnippets.ts:194`)로 **조정 전혀 없음**.
- **영향**: Mx 표시코드가 실제와 다른 결과(면책·지급비율 무시한 단순 누적합). BPV/보험금현가 신뢰도 저하.
- **권장 수정**: 표시코드에 면책·지급비율 곱 반영.

#### [High] D-6. PremiumComponent BPV(scalar) 인덱스가 표시코드와 실제 엔진에서 다름
- `file:line`: 실제 `App.tsx:3773, 3782`; 표시 `codeSnippets.ts:222`
- **현상**: 표시코드 `Mx_end = df.iloc[policy_term] if policy_term < len(df) else 0` (`codeSnippets.ts:222`). 실제엔진 `effectivePolicyTermIdx = policyTerm > 0 ? policyTerm : rows.length - 1` (`App.tsx:3773`), `mxN_row = rows[idx] ?? rows[last]` (`App.tsx:3782`). policyTerm>0이면 둘 다 `iloc[policy_term]`로 일치하나, **policyTerm=0(종신) 처리가 표시코드엔 없음**(표시는 0, 실제는 마지막행 Mx≈0). 또한 경계초과 시 표시는 0, 실제는 last row fallback — 미묘하게 다름.
- **영향**: 종신/만기 자동산출 케이스에서 BPV 표시값 ≠ 실제값.
- **권장 수정**: 표시코드에 종신(policy_term==0→last index) 분기 추가.

#### [High] D-7. PremiumComponent 표 컬럼 BPV_Col 수식이 scalar BPV와 내부 불일치
- `file:line`: `App.tsx:3862-3870` (BPV_Col) vs `App.tsx:3778-3787` (scalar bpvResults)
- **현상**: scalar BPV = `(Mx[0] - Mx[n]) × amount` (구간차, `App.tsx:3787`). 표 컬럼 BPV_Col = `Σ Mx[row] × amount` (구간차 아님, 현재행 Mx 그대로, `App.tsx:3868`). **같은 모듈 내 두 BPV 정의가 다르다.**
- **영향**: 사용자가 표의 BPV_Col 합과 보험료에 쓰인 BPV(scalar)를 비교하면 불일치. 표시코드(`codeSnippets.ts:223`)는 scalar식만 있어 표 컬럼 식은 어디에도 문서화 안 됨. BPV_Col의 계리적 의미 **[검증필요]**.
- **권장 수정**: BPV_Col 의도 확정 후 scalar식과 정합화하거나 컬럼명/설명으로 의미 구분 명시.

#### [High] D-4. SelectRiskRates 표시코드가 자동 policyTerm 산출·열 리네임·행 필터를 누락
- `file:line`: 실제 `App.tsx:2914-2934`(policyTerm 자동), `App.tsx:2967-2977`(Age/Gender 리네임), `App.tsx:2886-2912`(excludeNonNumericRows); 표시 `codeSnippets.ts:85-110`
- **현상**: 실제엔진은 policyTerm≤0이면 데이터 최대연령으로 `maxAge - entryAge + 1` 자동산출(`App.tsx:2928`), Age/Gender 열을 표준명으로 리네임, 비숫자행 제거. 표시코드는 단순 필터+정렬+할인계수만 보여줌.
- **영향**: 표시코드대로 따라 하면 종신/만기상품 행수(policyTerm)가 달라질 수 있음.
- **권장 수정**: 표시코드에 자동 policyTerm·리네임·필터 반영.

### Medium

#### [Medium] D-3. DefinePolicyInfo maturityAge→policyTerm 환산이 표시코드에 없음
- `file:line`: 실제 `App.tsx:2823-2829` (및 getGlobalPolicyInfo `App.tsx:2516-2531`); 표시 `codeSnippets.ts:72-83`
- **현상**: 실제엔진은 `maturityAge>0`이면 `policyTerm = maturityAge - entryAge`(`App.tsx:2825`). 표시코드는 입력 policyTerm을 그대로 출력.
- **영향**: 만기연령 기반 설계 시 표시코드가 실제 term을 반영 못함.
- **권장 수정**: 표시코드에 maturityAge 분기 추가.

#### [Medium] D-5. ClaimsCalculator 표시코드에 열 중복방지·기본계산 자동생성 부재
- `file:line`: 실제 `App.tsx:3200-3254`(빈 계산 시 기본 lx/risk 자동선택), `App.tsx:3265-3295`(getSafeName 중복방지); 표시 `codeSnippets.ts:162-175`
- **현상**: 핵심 수식 `dx = lx × q`, `Cx = dx × i_claim`는 일치(`App.tsx:3323-3327` vs `codeSnippets.ts:169-170`). 그러나 자동 기본계산·열명 충돌회피(`dx_X_1`)는 표시코드에 없음.
- **영향**: 동일 위험률 2회 선택 시 실제는 `_1` suffix 생성, 표시코드는 미반영. 하류 자동인식 컬럼명 예측 어긋남.
- **권장 수정**: 표시코드에 중복 시 suffix 규칙 주석화.

#### [Medium] D-8. NetPremiumCalculator는 IF()를 지원하지 않음 (다른 수식 모듈과 비대칭)
- `file:line`: `App.tsx:4304` (validate 직전 processIfStatements 호출 없음) ↔ RateModifier `App.tsx:2790`, Gross `App.tsx:4488`, Reserve `App.tsx:4598`은 호출함
- **현상**: NetPremium은 토큰치환 후 `validateFormulaExpression`(`App.tsx:4304`) 직행. `processIfStatements` 미호출. `validateFormulaExpression`(`App.tsx:2441`)은 `IF` 같은 알파벳 토큰을 차단하므로 NetPremium 수식에 IF() 쓰면 throw.
- **영향**: 사용자가 순보험료 수식에 IF 조건을 쓸 수 없음(영업보험료·준비금·RateModifier는 가능). 일관성 결여.
- **권장 수정**: NetPremium에도 `expression = processIfStatements(expression);`를 validate 직전 추가.

#### [Medium] D-10. RateModifier 표시코드가 IF()·m/n·PaymentTerm 토큰·반올림 미반영
- `file:line`: 실제 `App.tsx:2784-2795`; 표시 `codeSnippets.ts:55-70`
- **현상**: 실제엔진은 `[PaymentTerm]/[PolicyTerm]/[m]/[n]` 치환(`App.tsx:2784-2787`), IF 처리(`App.tsx:2790`), `roundTo5`(`App.tsx:2795`). 표시코드는 `[col]→df['col']` 치환만(`codeSnippets.ts:65`).
- **영향**: 표시코드가 정책변수·조건식 사용을 안내하지 못함.
- **권장 수정**: 표시코드에 토큰·IF 주석 추가.

### Low

#### [Low] L-1. roundTo5 과다 반올림으로 소액 dx 소실 위험
- `file:line`: `App.tsx:2382-2384`, 적용 `App.tsx:3096, 3138, 3324, 3504, 3546`
- **현상**: 모든 중간값을 소수 5자리로 반올림. lx 100,000 기준 위험률이 1e-5 미만이면 dx가 0으로 떨어질 수 있음. 주석(`App.tsx:3322` "avoid zeroing")은 인지하나 직후 `roundTo5(rawDx)`로 다시 반올림.
- **영향**: 초고연령/저위험 구간 누적합(Mx/Nx) 미세오차.
- **권장 수정**: 중간계산은 미반올림 유지, 표시단계에서만 반올림. **[검증필요]** (정밀도 요구사항 확인).

#### [Low] L-2. getTopologicalSort가 순환/미연결을 조용히 뒤에 붙임
- `file:line`: `App.tsx:2427-2430`
- **현상**: 위상정렬에 안 들어온 노드(순환 포함)를 그대로 sorted 끝에 append. 순환 시 에러 없이 임의 순서 실행.
- **영향**: 잘못 연결된 그래프가 경고 없이 부분 실행될 수 있음.
- **권장 수정**: 미정렬 노드 존재 시 경고/에러.

---

## 입출력 계약 맵

### 생성 컬럼 → 하류 참조 (자동인식/수동 구분)

| 생성 모듈 | 생성 컬럼/필드 | 생성 위치 | 하류 참조 모듈 | 참조 파라미터 | 인식 방식 |
|-----------|----------------|-----------|----------------|---------------|-----------|
| SelectRiskRates | `i_prem`, `i_claim`, `Age`, `Gender` | `App.tsx:2980-2981, 2999-3011` | CalculateSurvivors(Dx), ClaimsCalculator(Cx) | `row["i_prem"]`/`row["i_claim"]` **하드코딩 키** | ⚙️ 코드 고정(존재 검증 `App.tsx:3056, 3193`) |
| CalculateSurvivors | `lx_{name}`, `Dx_{name}` (+옵션 `lx`) | `App.tsx:3078, 3135, 3153` | ClaimsCalculator | `lxColumn` | ✅ 드롭다운(`lx_` 필터 `App.tsx:3219`) / 모달 dataSource.columns |
| RateModifier | `{newColumnName}` (사용자정의) | `App.tsx:2800` | CalculateSurvivors/Claims | `decrementRates[]`, `riskRateColumn` | ✅ 드롭다운, 단 RateModifier 자체 newColumnName은 **수동 타이핑** (오타위험) |
| ClaimsCalculator | `dx_{name}`, `Cx_{name}` (중복 시 `_N`) | `App.tsx:3288-3295` | NxMxCalculator | `mxCalculations[].baseColumn` (`Cx_*` 자동매칭) | ✅ **완전자동**: `Cx_` prefix 스캔 후 1:1 동기화(`App.tsx:3360-3403`) |
| CalculateSurvivors | `Dx_*` | (위) | NxMxCalculator | `nxCalculations[].baseColumn` | ✅ **완전자동**: `Dx_` prefix 스캔(`App.tsx:3442-3470`) |
| NxMxCalculator | `Nx_{name}`, `Mx_{name}` | `App.tsx:3502, 3544` | PremiumComponent | `nnxCalculations[].nxColumn`, `sumxCalculations[].mxColumn` | ✅ **완전자동**: `Nx_`/`Mx_` prefix 스캔(`App.tsx:3591-3712`); dxColumn은 `Nx_→Dx_` 치환 추론(`App.tsx:3690, 3717`) |
| PremiumComponent | `nnxResults{NNX_X(Year/Half/Quarter/Month)}`, `bpvResults{BPV_X}`, `mmxValue`, `mxResults`, 표컬럼 `NNX_*_Col`/`BPV_Col` | `App.tsx:3727-3926` | NetPremium(context), AdditionalName(passthrough) | 수식 토큰 `[NNX_X(Year)]`, `[BPV]`, `[MMX]`, `[SUMX]` | ⚙️ context 자동주입(`App.tsx:4196-4200`), 단 **수식 토큰명은 사용자 수동 타이핑**(괄호포함 `(Year)` 등 오타위험 큼) |
| AdditionalName | `variables{name:val}` (basicValues+definitions), data passthrough | `App.tsx:4109-4154` | NetPremium, Gross | 수식 토큰 `[α1]`, `[변수명]` | ⚙️ context 주입(`App.tsx:4205`), **토큰 수동 타이핑** |
| NetPremium | `variables[PP]`(또는 variableName), substitutedFormula | `App.tsx:4308-4317` | Gross | `[PP]` 토큰 | ⚙️ variables 전체 상속(`App.tsx:4406`), 토큰 수동 |
| Gross | `variables[GP]`, `data`(표 passthrough) | `App.tsx:4495-4504` | Reserve | `gross_premium_in.data`, `variables` | ⚙️ data 직접 전달; 준비금 수식 토큰 수동 |
| PolicyInfo(global) | entryAge/gender/policyTerm/paymentTerm/interestRate, 토큰 `m`,`n`,`PaymentTerm`,`PolicyTerm` | `App.tsx:2533-2540` | RateModifier/Premium/Net/Gross/Reserve | `getGlobalPolicyInfo()` 전역탐색 | ⚙️ **포트연결 불필요**: canvas에서 DefinePolicyInfo 모듈을 type으로 전역 검색(`App.tsx:2484-2486`) |

### 포트 타입 호환 검증
- `getAndValidateConnectedInput`(`App.tsx:2543-2571`)가 **expectedType 문자열 1개**로 검증. 호출부가 직접 기대타입 지정(예: `"DataPreview"`). 연결 자체의 `Port.type`(types.ts:30-38) 호환은 **executePipeline 단계에선 검증 안 함** — 출력 `outputData.type`만 본다. 즉 잘못된 포트끼리 연결돼도 출력타입이 맞으면 통과, 틀리면 "unexpected type" throw(`App.tsx:2566-2569`).
- **PolicyInfo는 포트 미경유**(전역 find). 캔버스에 DefinePolicyInfo 없으면 `App.tsx:2489` throw. 2개 이상이면 `find` 첫 번째만 사용 → **다중 PolicyInfo 시 비결정적** **[검증필요]**.

### 자동인식의 전제조건 (중요)
- 모달의 컬럼 드롭다운은 `getConnectedDataSource`가 **상류 모듈의 `outputData`**(이미 실행 성공)에서만 컬럼을 읽음(`ParameterInputModal.tsx:165-166, 478`). 즉 **상류를 먼저 실행해야 하류 드롭다운에 컬럼이 뜬다**. 미실행 시 빈 드롭다운 → 사용자가 수동 입력하거나 빈 채로 둠.
- executePipeline 실행 시점엔 prefix 스캔(`Cx_`/`Dx_`/`Nx_`/`Mx_`)으로 재동기화하므로 모달 미설정이어도 자동 생성됨(`App.tsx:3364, 3446, 3595, 3672`). → **모달 표시(빈값)와 실제 실행(자동채움)이 또 다른 경계면**.

---

## 수리 정확성 체크리스트 결과

| 항목 | 위치 | 판정 | 근거 |
|------|------|------|------|
| 할인계수 i_prem = 1/(1+i)^t | `App.tsx:2980` | ✅ 정확 | t=정렬된 0-based 인덱스, 표시코드(`codeSnippets.ts:107`)와 일치 |
| 할인계수 i_claim = 1/(1+i)^(t+0.5) | `App.tsx:2981` | ✅ 정확 | 중앙지급(반기) 가정 일관, 표시(`codeSnippets.ts:108`)와 일치 |
| lx 초기값 100,000 | `App.tsx:3077, 3155` | ✅ 정확 | 표시(`codeSnippets.ts:114`)와 일치 |
| lx[t]=lx[t-1]×(1-q[t-1]) (선반영 후 감소) | `App.tsx:3095-3124` | ✅ 정확 | 행 시작 시 현재값 기록→deaths 차감 순서 정상 |
| 다중탈퇴 결합 q_total | `App.tsx:3121` | ❌ **의심(D-1)** | 실제 `qm+qo-qm*qo/2` (UDD형) vs 표시 `1-∏(1-qi)` (독립곱). 계리 의도 **[검증필요]** |
| Dx = lx × v^t (i_prem) | `App.tsx:3138` | ✅ 정확 | 표시(`codeSnippets.ts:125,158`)와 일치 |
| dx = lx × q, Cx = dx × i_claim | `App.tsx:3323-3327` | ✅ 정확 | 표시(`codeSnippets.ts:169-170`)와 일치 |
| Nx 역누적합 (뒤→앞) | `App.tsx:3496-3499` | ✅ 정확 | `for i=len-1..0: sum+=base[i]` 정상. 표시 `[::-1].cumsum()[::-1]`(`codeSnippets.ts:186`)와 동치 |
| Mx 역누적합 + 면책/지급비율 | `App.tsx:3514-3547` | ⚠️ 엔진 로직 자체는 타당하나 **표시 placeholder(D-2)**. 면책 factor가 **index 0행에만** 적용(`App.tsx:3520`) — 첫해만 면책인지 **[검증필요]** |
| NNX(Year)=Nx[0]-Nx[m] | `App.tsx:3731-3740` | ✅ 정확 | m=paymentTerm을 **인덱스로 직접 사용**(0-based). rows[paymentTerm]=m번째 행=납입 종료 직후. 표시(`codeSnippets.ts:210-211`)와 일치. 단 m=납입연수일 때 인덱스 m이 (m+1)번째 행임에 주의 — off-by-one 가능성 **[검증필요]** |
| NNX(Half/Quarter/Month) 보정 1/4·3/8·11/24 | `App.tsx:3751-3760` | ⚠️ **검증필요** | 계수의 계리적 출처 미확인. dxColumn 없으면 NaN(`App.tsx:3764`)이 보험료 수식에 유입 시 NaN 전파 위험 |
| BPV(scalar)=(Mx[0]-Mx[n])×amount | `App.tsx:3787` | ✅ 식 자체 정상 | n 인덱스 = policyTerm(또는 종신 시 last). 단 표시(D-6)·표컬럼(D-7)과 불일치 |
| BPV_Col(표) = Σ Mx[row]×amount | `App.tsx:3868` | ❌ **의심(D-7)** | scalar와 다른 정의. 구간차 아님 |
| 준비금 t≤m 분기 (rowIndex<=m-1) | `App.tsx:4563` | ⚠️ 경계는 표시와 우연 일치하나 **행참조 문법 불일치(D-9)** | `[col][t/m/n]` 미지원 → null 산출 위험 |
| n_idx/m_idx off-by-one (표시코드) | `codeSnippets.ts:246-247` | ⚠️ **검증필요** | m_idx=payment_term-1, n_idx=len-1. 실제엔진은 m을 스칼라로만 사용 → 행참조 의미가 두 원천에서 상이 |
| effectiveN (policyTerm=0→행수/last) | `App.tsx:4190-4193, 4397-4400, 4550-4553` | ✅ 일관 | Net/Gross/Reserve 모두 종신 시 행수로 n 추론. 표시코드엔 이 분기 없음 |
| 토큰치환 longest-first 정렬 | `App.tsx:4250-4252, 4433-4435, 4581` | ✅ 정확 | `[NNX_X(Year)]`가 `[NNX_X]`보다 먼저 치환되어 부분매칭 방지 |

### 종합
- **수식 코어(할인계수·Dx·Cx·Nx·BPV scalar식)는 정확**하고 표시코드와 일치.
- **체계적 위험 3축**: ① 다중탈퇴 결합식(D-1, Critical) ② 준비금 행참조 문법 부재(D-9, Critical) ③ Mx 면책/BPV 표컬럼 정의 모호(D-2, D-7).
- **NaN 전파**: NNX(Half/Quarter/Month)에서 dxColumn 미지정 시 NaN 생성(`App.tsx:3764`)이 NetPremium context에 들어가면 보험료가 NaN. 가드 없음. **[검증필요/qa-runner 이관]**.

---

## sync-architect / qa-runner 이관 항목
- **단일화 1순위(sync-architect)**: D-1(다중탈퇴), D-9(준비금 행참조 문법), D-2/D-6/D-7(Mx·BPV).
- **테스트 케이스 후보(qa-runner)**: 다중탈퇴 2개 이상 lx 검산 / 종신(policyTerm=0) BPV / dxColumn 미지정 시 NNX NaN 전파 / `[col][m]` 준비금 수식 / 동일 위험률 중복선택 시 `Cx_X_1` 자동인식 / Scenario·TextBox가 runQueue 진입 시 빈 Success(C-2).
- **editor-ux 이관**: C-2(빈 출력 Success가 사용자에게 정상으로 보임), 자동인식 전제조건(상류 미실행 시 빈 드롭다운).
