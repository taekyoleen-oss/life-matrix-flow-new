# Round B 구현 기록 — 엔진 1건 + 표시코드 drift 보정 + 자동인식 + round-trip 완성도

> 작성자: sync-architect
> 기준: `_workspace/03_sync_design.md` (승인 블록 §3), `_workspace/03b_round_a_impl.md`
> baseline: Round A 16개 round-trip 테스트 통과 상태에서 시작.
> 제약: 엔진(executePipeline) 변경은 **decrementMethod 분기 1건만**. 그 외 엔진 무수정.

---

## 1. 변경/신규 파일

### 신규
| 파일 | 내용 |
|------|------|
| `utils/schemaInference.ts` | 정적 출력 컬럼 추론. `inferOutputColumns(module, upstream)`, `inferUpstreamColumns(targetId, modules, connections)`. 엔진 prefix 규칙(SelectData rename, SelectRiskRates Age/Gender+i_prem/i_claim, lx_/Dx_, dx_/Cx_(+_N suffix), Nx_/Mx_, NNX_X(period)_Col/BPV_Col, AdditionalName 변수, Reserve)을 정적 모사. 상류 미실행이어도 컬럼 예측. 실행된 상류는 실제 columns 우선. |
| `_workspace/tests/schemaInference.test.ts` | 추론 정확도 8 케이스(단일 모듈 6 + 체인/실행우선/미연결 3 → 일부 통합). vitest. |

### 수정
| 파일 | 변경 |
|------|------|
| `App.tsx` (엔진) | **유일한 엔진 변경(D-1).** CalculateSurvivors 다중탈퇴 결합식: `calc.decrementMethod ?? 'udd'` 분기. `'independent'`→`qm+q_others-qm*q_others`(독립곱), `'udd'`(기본)→`qm+q_others-qm*q_others/2`(기존식 그대로). 라인 3119-3129 부근. |
| `utils/dslParser.ts` | (a) CalculateSurvivors generateDSL/parse: `lx(rates, method=independent\|udd)` 토큰 forward/reverse. 미지정 시 미출력→키 미생성(round-trip 안정). (b) SelectData 미선택 열 `// off: col` 마커 forward/reverse 보존. (c) NxMx 비기본 `paymentRatios` 인라인 `// ratios=[...]` 마커 forward/reverse 보존. |
| `codeSnippets.ts` (표시 전용) | C-1(Gross/AdditionalName/NetPremium case 추가), D-1(decrementMethod 분기+UDD 주석), D-2(Mx 면책 factor+paymentRatios), D-3(maturityAge→policyTerm), D-4(자동 policyTerm/리네임/비숫자필터), D-5(중복 suffix), D-6(종신 분기+경계 fallback), D-7(BPV_Col Σ vs scalar 차이 주석), D-9(엔진 행참조 미지원 주석), D-10(m/n 스칼라치환/IF/round). |
| `components/ParameterInputModal.tsx` | (a) CalculateSurvivors 항목별 `decrementMethod` 드롭다운(2+ 위험률일 때만 노출, UDD/독립곱). (b) `getConnectedColumnsWithInference` 헬퍼 추가(live ?? inferred). CalculateSurvivors 드롭다운 소스에 추론 fallback + "예상값" 배지. |
| `_workspace/tests/roundtrip.test.ts` | Round B 신규 8 케이스: decrementMethod 5(independent/udd명시/혼합/미지정×2) + SelectData off 1 + NxMx ratios 2. |

**엔진 변경: 1건(decrementMethod 분기). 그 외 executePipeline 무수정.**

---

## 2. 엔진 변경의 기본값 결과 불변 보장 (핵심)

```ts
const decrementMethod = calc.decrementMethod ?? "udd";
const totalDecrementFactor =
  decrementMethod === "independent"
    ? mortalityRate + q_others - mortalityRate * q_others
    : mortalityRate + q_others - (mortalityRate * q_others) / 2.0;  // ← 기존식과 동일
```

- 기존 모든 파이프라인의 calc 에는 `decrementMethod` 키가 **없다** → `?? "udd"` 로 항상 else 분기.
- else 분기 식 `mortalityRate + q_others - (mortalityRate * q_others) / 2.0` 은 변경 전 원본과 **문자 단위로 동일**.
- 따라서 decrementMethod 미지정(=기존 데이터) 시 산출값은 **불변**. 'independent' 를 사용자가 명시적으로 선택한 항목에서만 새 식 적용.
- 단일 위험률(otherDecrementRates.length===0) 경로는 이 분기를 타지 않으므로 영향 없음.

---

## 3. round-trip 계약 확장 (Round B)

| 항목 | 보존 방식 | 비고 |
|------|-----------|------|
| CalculateSurvivors `decrementMethod` | `lx(..., method=X)` 토큰 (명시 시) / 미지정은 미출력 | 미지정 round-trip 시 키 안 생김(기본 udd 안정) |
| SelectData `selected:false` | `// off: originalName` 마커 | reverse 시 selected:false 로 복원. 데이터 손실 없음 |
| NxMx `paymentRatios` (비기본) | 인라인 `// ratios=[...]` 마커 | 기본값([{year:1,type:'100%'}])은 마커 생략, reverse 시 기본 복원 |

reverse 적용은 여전히 merge(`updateModuleParameters(id, params, false)`). 마커가 있는 키는 DSL 권위로 정확 복원, 마커 없는 비표현 키(fileContent/definitions 등)는 merge 보존.

---

## 4. 입출력 자동 인식 (schemaInference)

- `inferOutputColumns(module, upstreamCols)`: 모듈 1개의 정적 출력 컬럼.
- `inferUpstreamColumns(targetId, modules, connections)`: data 포트 상류 체인을 재귀 누적(사이클 방지 memo/visited, policy 포트 제외). 실행된 상류는 `outputData.columns` 우선.
- ParameterInputModal: `getConnectedColumnsWithInference` = live(`outputData.columns`) ?? inferred. CalculateSurvivors 에 연동(미실행 시 추론 컬럼으로 드롭다운 채우고 "예상값" 배지).
- 다른 모듈 드롭다운에도 동일 헬퍼로 확장 가능(헬퍼 export 됨). 이번엔 CalculateSurvivors 에 우선 적용(설계 §6 Phase 3 최소 적용).

---

## 5. 테스트 결과 (실측)

명령: `npm run test` (vitest run)

```
Test Files  2 passed (2)
     Tests  32 passed (32)
```

- Round A baseline: 16 통과 (회귀 없음).
- Round B 신규: 16 통과 = roundtrip.test.ts +8 (decrementMethod 5, SelectData off 1, NxMx ratios 2) + schemaInference.test.ts 8.
- TDD: decrementMethod 'udd' 명시/혼합 2건이 먼저 실패(generateDSL 가 'udd' 미출력) → generateDSL 가 명시 method 를 모두 출력하도록 보정해 통과.

빌드: `npm run build` → **✓ built in 10.52s** (성공). (xlsx dynamic-import 경고, chunk size 경고는 기존부터 존재, 에러 아님)

타입체크: `npx tsc --noEmit` → 전체 15개 에러 모두 **기존부터 존재**(App.tsx:1800, ExcelInputModal/SpreadViewModal/SamplesManagementModal unknown, vite.config overload, supabase/samples-api import.meta.env). **본 Round 신규/수정 파일(schemaInference/codeSnippets/dslParser/ParameterInputModal)에서 신규 에러 0건.**

---

## 6. 미완/이월 항목

1. **D-8 NetPremium IF** — 엔진 `processIfStatements` 추가는 별도 승인 필요(엔진 변경). 이번 Round B 범위 외(엔진 1건 제약 준수). NetPremium 표시코드는 변수 치환식으로 보정.
2. **D-9 Reserve 행참조** — 엔진 미수정(주석으로 "엔진은 현재 행 [col] + 스칼라 m/n, 행참조 [col][t] 미지원" 명시). 단일화는 계리 방향 확정 후.
3. **D-7 BPV_Col 계리 의미** — 표시코드에 "Σ Mx[row]×amount(표) vs (Mx[0]-Mx[종단])×amount(scalar)" 차이 주석. 어느 정의가 의도인지 계리 확인 필요(엔진 미수정).
4. **schemaInference 드롭다운 적용 범위** — CalculateSurvivors 우선 적용. ClaimsCalculator/NxMx/RateModifier 등 다른 모듈 드롭다운 확장은 헬퍼 재사용으로 후속 가능.
5. **이름변경 하류 전파 훅** (설계 §6.4) — DSL 적용 경로에서 handleModuleSaved nameChanges 전파 연결은 미연결(기존 PropertiesPanel 경로만). 후속.

---

## 7. 안전장치 (유지)

- 파싱 실패 시 파라미터 불변(Round A onApplyModuleDSL 미호출 경로 유지).
- `// off:`/`// ratios=` 마커 파싱 실패 시 try/catch 로 기본값 fallback(데이터 손실 없음).
- schemaInference 예외 시 빈 배열 반환(드롭다운 비는 것이 최악, 깨지지 않음).
- decrementMethod 드롭다운: 2+ 위험률일 때만 노출(단일 위험률은 엔진상 무의미).
