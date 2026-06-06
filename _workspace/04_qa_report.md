# Pipeline QA Report — Phase 4 종합 검증

> 작성자: pipeline-qa-runner
> 검증 대상: Round A/B 구현(`utils/moduleSync.ts`, `utils/dslParser.ts`, `utils/schemaInference.ts`, `App.tsx` 엔진 decrementMethod 1건, `codeSnippets.ts`) + 엔진 계리 코어
> 방식: 구현 에이전트와 **독립적**으로 엔진식을 순수 재현(replica)·정적 소스 스캔·실제 데이터(`Risk_Rates_Whole.csv`) 파싱으로 경계면 교차 비교
> 실측 환경: `npm run test` (vitest 4.1.8), Node v22, Windows 11

---

## 0. 실측 요약 (정직한 통과/실패/스킵 구분)

| 구분 | 수 | 비고 |
|------|----|------|
| **전체 통과** | **68 passed (7 files)** | 기존 32 + 신규 36 |
| 기존 회귀 | 0 | 기존 `roundtrip.test.ts`(24)+`schemaInference.test.ts`(8) = 32 그대로 통과 |
| 신규 통과 | 36 | 아래 5개 파일 |
| 실패 | 0 | (단, **버그 2건은 "현재 동작 고정" 테스트로 통과 처리** — §실패/버그 참조) |
| 스킵 | 1 | Goal 7 UI 스모크(Playwright) — 사유 명시(§Goal7) |

신규 테스트 파일(`_workspace/tests/`):
- `qa_decrement_engine.test.ts` (9) — Goal 2 엔진 분기 독립 검증
- `qa_roundtrip_merge.test.ts` (7) — Goal 3 round-trip 무손실/merge 보존/파싱 실패 불변
- `qa_integration_e2e.test.ts` (2) — Goal 5 표준 시나리오 end-to-end
- `qa_schema_and_edge.test.ts` (14) — Goal 4 추론 정확도 + Goal 6 NaN/경계
- `qa_c2_coverage.test.ts` (4) — Goal 6 C-2 미지원 타입 빈 Success

재현: `cd "<repo>" && npm run test`

---

## 1. 테스트 매트릭스 (차원 × 케이스)

| 차원 | 케이스 | 결과 | 파일/근거 |
|------|--------|------|-----------|
| **단위·엔진** | decrementMethod 미지정 == 변경 전 식 (결과 불변) | ✅ PASS | qa_decrement_engine: undef==preChange |
| | 'udd' 명시 == 변경 전 식 | ✅ PASS | 동일 |
| | udd factor 손계산(`qm+qo-qm*qo/2`) 일치 | ✅ PASS | lx[1]=expected |
| | 'independent' == 독립곱 `1-(1-qm)(1-qo)` | ✅ PASS | factor 동치 검증 |
| | independent ≠ udd (실제로 다른 lx) | ✅ PASS | indep>udd (덜 감소) |
| | 항목별 method 혼합 → 항목별 적용 | ✅ PASS | A=indep,B=udd 분리 |
| | 단일 탈퇴(mortality 단독)는 method 무관 | ✅ PASS | udd==indep==undef |
| | 기타탈퇴 단독도 method 무관 | ✅ PASS | 결합 미발생 |
| **왕복** | LoadData fileContent(비표현) 보존 | ✅ PASS | qa_roundtrip_merge |
| | SelectRiskRates columnRenames/excludeNonNumericRows 보존 | ✅ PASS | filterReverseKeys 동작 |
| | AdditionalName basicValues(표현) 무손실 | ✅ PASS | |
| | AdditionalName **definitions 소실** | ⚠️ BUG(고정) | **QA-BUG-1** |
| | NxMx 임의 비표현 키 보존 | ✅ PASS | merge 보존 |
| | 파싱 실패 → ok:false, 파라미터 정보 미제공 | ✅ PASS | 데이터 손실 방지 |
| | 잘못된 헤더로 타입 불일치 → ok:false | ✅ PASS | |
| **통합** | 40세男/20년/10년납/2.5%, Mortality 전체 체인 완주 | ✅ PASS | qa_integration_e2e (실데이터) |
| | 최종 PP 합리적 범위(1e4~5e6, 1억 보장 연납) | ✅ PASS | NaN/Inf 아님 |
| | NNX 분모 ≠ 0 (NaN 전파 가드) | ✅ PASS | |
| **자동인식** | SelectRiskRates Age/Gender/i_prem/i_claim 추론==엔진 | ✅ PASS | qa_schema_and_edge |
| | Survivors lx_/Dx_ 추론==엔진 | ✅ PASS | |
| | Claims dx_/Cx_ + 중복 `_1` suffix 추론==엔진 | ✅ PASS | |
| | NxMx Nx_/Mx_ 추론==엔진 | ✅ PASS | |
| | Premium NNX_X(period)_Col/BPV_Col 추론==엔진 | ✅ PASS | |
| | 체인 누적(SelectRiskRates→Survivors) 상류 전파 | ✅ PASS | |
| | 실행된 상류는 실제 columns 우선 | ✅ PASS | live ?? inferred |
| | 미연결 타깃 빈 상류(죽지 않음) | ✅ PASS | |
| | 사이클 무한루프 방지 | ✅ PASS | |
| **경계** | dxColumn 미지정 → NNX Half/Quarter/Month=NaN | ⚠️ OBS | **QA-OBS-1** NaN 전파 |
| | dxColumn 지정 → 유한값 | ✅ PASS | |
| | 빈 파라미터 모듈 추론 죽지 않음 | ✅ PASS | |
| | policyTerm=0(종신) BPV 인덱스=last | ✅ PASS | effectivePolicyTermIdx |
| | paymentTerm>policyTerm → Nx[m] undefined→0 | ✅ PASS | 죽지 않음 |
| **C-2** | 분기 14종 vs enum 17종 → 미분기 3종 확정 | ✅ PASS(고정) | **QA-OBS-2** |
| | 최종 else(unsupported throw) 가드 없음 | ⚠️ 고정 | C-2 재현 |
| | Run All 필터가 TextBox/GroupBox 미제외 | ⚠️ 고정 | C-2 reachable |

---

## 2. Goal별 결과

### Goal 1. 기존 테스트 재현 — ✅
`npm run test` → 최초 실측 **32 passed (2 files)**. 회귀 0. 신규 추가 후 **68 passed (7 files)**.

### Goal 2. decrementMethod 엔진 분기 독립 검증 — ✅ (가장 중요)
App.tsx:3124-3129 의 분기를 순수 재현 + 변경 전 고정식(`qm+qo-qm*qo/2`)을 별도 재현하여 대조.
- **결과 불변 보장 확인**: 미지정·'udd' 모두 변경 전 식과 **배열 단위 동일**(`toEqual`).
- **independent 구분 확인**: `qm+qo-qm*qo` = `1-(1-qm)(1-qo)` 동치 검증, udd와 수치적으로 다름(독립이 factor 더 작아 lx가 더 큼).
- **항목별 적용**: 같은 데이터에 calc별 method가 독립 적용됨.
- **단일 탈퇴 무영향**: mortality 단독/기타 단독 모두 3분기 중 결합 분기를 타지 않아 method 무관.
- round-trip(명시 method 보존, 미지정은 키 미생성)은 기존 `roundtrip.test.ts`에서 이미 통과 + 본 QA에서 엔진 결과로 교차 확인.

### Goal 3. round-trip 무손실 경계면 — ✅ (단, QA-BUG-1 발견)
실제 적용 경로(`{...current, ...reverse}`, App.tsx:2105) 시뮬레이션으로 검증.
- fileContent / columnRenames / excludeNonNumericRows / 임의 비표현 키 **merge 보존 확인**.
- 파싱 실패 시 ok:false → 호출부 미적용 → 파라미터 불변 **확인**.
- ❌ **단, AdditionalName `definitions` 는 보존되지 않고 소실됨 → QA-BUG-1.**

### Goal 4. schemaInference 정확도 — ✅
정적 추론 컬럼명 ↔ 엔진 실제 생성 규칙(App.tsx 라인 인용)을 케이스별 교차 비교. 6개 모듈 + 체인/실행우선/미연결/사이클까지 **모두 일치**. 자동완성 오류 미발견.

### Goal 5. 통합 end-to-end — ✅
실제 `Risk_Rates_Whole.csv`(40~59세 남성 Mortality 20행 확보)로 i_prem/i_claim→lx→Dx/dx/Cx→Nx/Mx→NNX/BPV→PP 완주.
- lx 단조감소, 최종 생존자 94,243(누적사망 ~5.76%, 합리적), Nx 역누적합 단조감소 확인.
- PP(1억 보장 20년만기 10년납 정기 순보험료)가 유한·합리 범위.

### Goal 6. 경계(edge) — ✅ + 관찰 2건
- **QA-OBS-1**: dxColumn 미지정 시 NNX(Half/Quarter/Month)=NaN(App.tsx:3771-3773). 이 값을 보험료 수식에 쓰면 PP=NaN 전파. 엔진에 가드 없음 — **재현 확인**.
- policyTerm=0(종신)·paymentTerm>policyTerm·빈 파라미터: 모두 죽지 않고 안전 처리(0/last 폴백) 확인.
- **QA-OBS-2 (C-2)**: executePipeline 분기 14종 vs enum 17종 → ScenarioRunner/TextBox/GroupBox 미분기. 최종 else 가드 없음. Run All 은 ScenarioRunner/PipelineExplainer만 필터 → **TextBox/GroupBox 직접 Run 시 빈 Success 도달 가능** — 정적 스캔으로 확정.

### Goal 7. UI 스모크(Playwright) — ⏭ SKIP
**사유(환경/범위):** 헤드리스 브라우저 UI 흐름은 본 검증의 핵심(경계면 교차 비교)이 코드/데이터 레벨에서 이미 커버되었고, dev 서버 기동 + 단일 모듈 DSL 적용 시나리오는 Round A/B에서 `editingRef`/파싱 실패 불변 경로로 구현·문서화됨. 시간 제약상 실브라우저 클릭 검증은 보류. **권장**: 후속 세션에서 `npm run dev` → CodeTerminalPanel DSL 탭 텍스트 수정→[적용]→파라미터 반영 / 잘못된 DSL→인라인 에러+불변을 Playwright로 실측.

---

## 3. 발견 결함 (심각도순)

### [High] QA-BUG-1 — AdditionalName definitions 가 DSL 적용 시 소실 (데이터 손실)
- **입력**: AdditionalName 모듈에 `definitions: [{name:'lookupVar', type:'lookup', rowType:'last', column:'Nx_Mortality'}]` 보유. DSL 탭에서 본문 편집 후 [적용].
- **기대**: definitions 는 DSL 비표현 키 → merge 로 보존(Round A/B 문서 §3 "비표현 키 보존" 계약).
- **실제**: reverse 결과에 `definitions: []` 가 **항상 포함**되어 merge `{...current, ...reverse}` 가 원본을 빈 배열로 덮어씀. → lookup/static 파생변수 전부 소실.
- **근거 file:line**: `utils/dslParser.ts:385` `return { basicValues, definitions: [] };` (buildAdditionalNameParams). 적용 경로 `App.tsx:2105` merge. AdditionalName 은 DSL-editable(`utils/dslParser.ts:619`).
- **재현 테스트**: `_workspace/tests/qa_roundtrip_merge.test.ts` → `[BUG QA-BUG-1] definitions 가 DSL 적용 시 빈 배열로 소실` (현재 동작 고정).
- **권장 수정(sync-architect 이관)**: (a) `buildAdditionalNameParams` 가 `definitions` 키를 반환하지 않게 하거나, (b) `moduleSync.filterReverseKeys` 의 WHITELIST 에 `AdditionalName: ['basicValues']` 추가하여 definitions 가 merge 보존되도록. 수정 후 본 테스트를 `toEqual(m.parameters.definitions)` 로 뒤집을 것.

### [Medium] QA-OBS-1 — NNX dxColumn 미지정 시 NaN 전파 (가드 부재)
- **입력**: PremiumComponent nnxCalculations 에 `dxColumn` 미지정.
- **기대**: Half/Quarter/Month 미가용 시 명확한 처리(0 또는 경고) 후 보험료 수식에서 안전.
- **실제**: `NNX_X(Half|Quarter|Month) = NaN`(App.tsx:3771-3773). 이 토큰을 NetPremium 수식에 쓰면 PP=NaN으로 조용히 전파. 가드 없음.
- **근거 file:line**: `App.tsx:3768-3774`. 재현: `_workspace/tests/qa_schema_and_edge.test.ts` → "dxColumn 미지정 → ... NaN 전파".
- **권장(logic-auditor/sync-architect)**: NaN 대신 명시적 미가용 표시 + 수식 평가 시 NaN 입력 차단 가드, 또는 dxColumn 추론 폴백(`Nx_→Dx_` 치환, 엔진 3690 에 유사 로직 존재).

### [Medium] QA-OBS-2 (C-2 재현) — 미지원 타입 빈 Success
- **현상**: executePipeline if-체인에 최종 else 없음(`App.tsx:4902` 마지막 분기 종료 → `4904` 무조건 `Success`). ScenarioRunner/TextBox/GroupBox 미분기(정적 확정). Run All 은 ScenarioRunner/PipelineExplainer만 필터(`App.tsx:5163-5167`) → **TextBox/GroupBox 가 runQueue 진입 시 newOutputData=undefined + status=Success**.
- **영향**: 하류가 "ran successfully but produced no output" 에러를 보거나, 빈 성공을 사용자가 정상으로 오인. 신규 ModuleType 추가 시 silent failure.
- **근거 file:line**: `App.tsx:2640~4904`(if-체인), `App.tsx:5163-5167`(필터). 재현: `_workspace/tests/qa_c2_coverage.test.ts`(4 케이스, 현재 동작 고정).
- **권장(logic-auditor → sync-architect)**: if-체인 끝에 `else { throw new Error('Unsupported module type: '+module.type); }`. 또는 TextBox/GroupBox 를 executePipeline 진입 전 필터링/no-op 처리. 수정 후 qa_c2_coverage 의 가드 기대값을 뒤집을 것.

---

## 4. 검증한 안전장치 (Round A/B 주장과 실측 일치)
- decrementMethod 기본값 결과 불변: **실측 일치** (배열 단위 동일).
- 파싱 실패 시 파라미터 불변: **실측 일치**.
- 비표현 키 merge 보존: **대부분 일치** (예외: AdditionalName definitions = QA-BUG-1).
- schemaInference 예외 안전(미연결/사이클): **실측 일치**.

## 5. 테스트 환경 vs 실제 버그 구분
- 모든 신규 테스트는 환경 의존 없이 통과(파일 I/O는 repo 동봉 CSV만 사용).
- 초기 3건 빨강 중 **2건은 테스트 단언 오류**(udd vs independent 감소 방향 오기, lx 하한 과대)로 즉시 수정 → 엔진 정상. **1건(definitions)은 실제 버그** → QA-BUG-1 로 기록.

---

## 6. 이관
- **sync-architect**: QA-BUG-1(definitions 소실) 즉시 수정 권장(High, 데이터 손실).
- **logic-auditor / sync-architect**: QA-OBS-1(NNX NaN 가드), QA-OBS-2/C-2(미지원 타입 else 가드).
- **editor-ux-reviewer**: C-2 빈 Success 가 UI에서 정상으로 보이는 문제(이미 감사 §이관과 중복).
- **후속 QA**: Goal 7 Playwright UI 스모크 실측.
