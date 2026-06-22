# verify/ — TS 재현성 verify 하네스 (Phase 6)

순수 TypeScript(Pyodide 없음) 보험료/준비금 파이프라인의 **결정성(재현성)** 을
회귀 테스트로 보증하는 하네스다. ML Auto Flow 의 `verify/run-verification.mjs`
개념을 이 앱의 Vitest 환경에 맞춰 TypeScript 로 신설한 것이다.

## 무엇을 검증하나

`verify/pipelines.repro.test.ts` 는 번들 레퍼런스 파이프라인(`samples/*.lifx`)을
실제 계산 코어로 **2회 실행**하고, 출력이 완전히 동일한지 단언한다:

- 순보험료(`netPremium`) · 영업보험료(`grossPremium`) byte-identical
- 치환 수식(`substitutedFormula`) 동일
- 준비금 표(`ReserveCalculator` 의 행별 출력) 동일 (null 패턴까지 결정적)
- 전체 모듈 실행 상태(status) 동일
- (sanity) 보험료가 0/NaN 이 아니고, gross ≥ net, 서로 다른 상품은 서로 다른 보험료

검증 대상 픽스처:
- `Reference_WholeLife_WithReserves.lifx` (종신 + 준비금 체인)
- `Reference_TermLife_StandardRates.lifx` (정기 + 표준위험률)
- `Reference_Endowment_Scenario.lifx` (양로 + ScenarioRunner)
- `Whole Life.lifx` (기존 샘플)

각 `.lifx` 는 `LoadData.parameters.fileContent` 에 데이터를 내장하므로 외부 I/O 없이
자기완결적으로 실행된다.

## 실행

```bash
npm run verify:pipelines     # vitest run --config vitest.verify.config.ts
```

설정: `vitest.verify.config.ts` (include: `verify/**`). 기존 round-trip 테스트
(`vitest.config.ts`, `_workspace/tests`)와 분리되어 서로 영향을 주지 않는다.

## 계산 코어가 headless 인 이유

계산 엔진(`executePipeline`)은 원래 `App.tsx` 의 React 컴포넌트 안에 있었으나,
Phase 6 에서 **동작 변경 없이** `utils/pipelineEngine.ts` 의 순수 함수
`executePipelineCore` 로 추출되었다. `App.tsx` 는 이 함수를 그대로 호출
(call-through)하므로 앱 런타임 동작은 보존되며, 동일 코어를 테스트가 React/DOM
없이 직접 호출할 수 있다. 엔진은 난수를 쓰지 않고 부동소수 연산 순서가 고정되어
있어 동일 입력 → 동일 출력이 보장된다(sklearn `random_state` 의 TS 대체).
