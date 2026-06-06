# Round C 구현 기록 — 엔진 안전성·drift 완료

> 작성자: sync-architect
> 기준: `_workspace/01_logic_auditor_findings.md`(C-2, D-7/8/9, NaN), `_workspace/04_qa_report.md`(QA-OBS-1/2), `_workspace/03c_round_b_impl.md`
> baseline: `npm run test` → **68 passed (7 files)** 에서 시작.
> 사용자 2차 지시: "모두 진행", 엔진 변경 허용. 각 변경 = TDD(실패 테스트 → 구현 → 통과) + 유효 기존 케이스 불변.
> 범위 준수: UI 컴포넌트(ParameterInputModal/Canvas/ComponentRenderer)·alert/toast **무수정**. executePipeline 엔진 + codeSnippets + 수식처리 + 테스트만.

---

## 0. 최종 결과 (실측)

| 항목 | 값 |
|------|----|
| `npm run test` | **82 passed (8 files)** — 기존 68 + Round C 신규 14 |
| 실패 | 0 |
| 스킵 | 0 |
| `npm run build` | **✓ built in 10.66s** (성공). xlsx dynamic-import·chunk-size 경고는 기존부터 존재(에러 아님) |

신규/수정 테스트:
- 신규 `_workspace/tests/qa_round_c_engine.test.ts` (14) — D-8(5) + D-9(9)
- 수정 `_workspace/tests/qa_c2_coverage.test.ts` (4) — "현재 동작 고정" → 수정 후 동작으로 뒤집음
- 수정 `_workspace/tests/qa_schema_and_edge.test.ts` (14, 변동 없음) — QA-OBS-1 NaN 단언을 Year 폴백으로 뒤집음

---

## 1. 변경 파일

| 파일 | 변경 |
|------|------|
| `App.tsx` (엔진) | (1) C-2: if-체인 끝에 TextBox/GroupBox/ScenarioRunner **명시 no-op 분기** + 최종 `else { throw }`. (2) Run All 필터에 TextBox/GroupBox 추가. (3) QA-OBS-1: NNX dxColumn 미지정 시 NaN→Year 폴백(scalar 경로 + 표 `_Col` 경로). (4) D-8: NetPremium validate 직전 `processIfStatements(expression)` 1줄. (5) D-9: Reserve 행참조 `[col][t\|m\|n\|0]`(+레거시 `[col][idx]`) 치환 `resolveRowRef` 추가. (6) D-7: BPV_Col ColumnInfo.description + 코드 주석(수식 미변경). |
| `codeSnippets.ts` (표시 전용) | D-9 "엔진 미지원" 주석 → "엔진과 단일화 완료" 갱신. D-8 IF 지원 주석 추가. (D-7 차이 주석은 Round B 것 유지) |
| `_workspace/tests/qa_round_c_engine.test.ts` | **신규.** D-8 processIfStatements 재현 + D-9 행참조 재현 + 정적 소스 스캔. |
| `_workspace/tests/qa_c2_coverage.test.ts` | 4 케이스 수정 후 동작으로 반전. region slice 범위 갱신(2640..4990). |
| `_workspace/tests/qa_schema_and_edge.test.ts` | QA-OBS-1 블록 NaN 단언 → Year 폴백 + dxColumn 지정 케이스 불변 단언. |

**엔진 변경 6건 모두 "기존 유효 케이스 불변" 보장(아래 §3).**

---

## 2. 각 항목 상세

### 1. C-2 / QA-OBS-2 — 미지원 타입 빈 Success 가드
- if-체인 끝(PipelineExplainer 분기 직후)에 추가:
  - `TextBox || GroupBox || ScenarioRunner` → 명시 no-op(`newOutputData = undefined`), status=Success 유지(의도된 동작). ScenarioRunner 는 별도 `runScenarioRunner` 경유라 executePipeline 직접 진입 시 무해 통과.
  - 그 외 진짜 미지원/신규 타입 → `else { throw new Error("지원하지 않는 모듈 타입입니다: " + module.type); }` (silent failure 차단).
- Run All 필터(`filteredModules`)에 `TextBox`/`GroupBox` 추가 → 비계산 모듈이 runQueue 진입해 빈 Success 노이즈를 만드는 경로 차단.

### 2. QA-OBS-1 — NNX dxColumn 미지정 NaN 전파 가드
- `App.tsx` nnxResults(scalar) 및 `_Col`(표) 두 경로 모두: dxColumn 미지정 시 Half/Quarter/Month 를 `NaN`→`roundTo5(nnxYear)` 로 폴백.
- 근거: 분할납 보정항 `k * dx_diff` 에서 dx_diff 미가용(=0)인 것과 수학적으로 동일 → Year 값. NaN 이 NetPremium 수식으로 조용히 전파되던 문제 제거.

### 3. D-8 — NetPremium IF() 지원
- 토큰치환·괄호정리 후 `validateFormulaExpression` 직전에 `expression = processIfStatements(expression);` 1줄 추가(RateModifier/Gross/Reserve 와 동일 위치·동일 함수).

### 4. D-9 — Reserve 행참조 `[col][t|m|n|0]` (additive, 표시=실행 단일화)
- 각 행 평가 시, 현재행 `[col]` 치환과 스칼라 `[m]/[n]` 치환 **이전에** 행참조를 숫자로 먼저 치환:
  - `[t]`=현재행(idx), `[0]`=첫행, `[m]`=납입종료행(paymentTerm-1), `[n]`=마지막 데이터행(len-1) — codeSnippets 표시코드와 동일 인덱스 규칙.
  - 신형 `Col[idx]` 와 레거시 `[Col][idx]` 두 표기 모두 처리. 범위초과 인덱스는 "0" 안전 처리.
- 치환 순서상 행참조는 숫자가 되어 `validateFormulaExpression` 을 통과(미해결 변수 throw 회피). codeSnippets D-9 주석 "미지원"→"단일화 완료" 갱신.

### 5. D-7 — BPV_Col vs scalar BPV (수식 미변경, 명확화만)
- 계리 의도 미확정 → 수식 불변. BPV_Col ColumnInfo 에 `description` 추가 + 산출부 주석으로 "행별 Σ(Mx[행]×보험금) 누적, scalar BPV(구간차)와 다름 — 비교 금지" 명시. codeSnippets D-7 차이 주석(Round B) 유지.

---

## 3. "유효 기존 케이스 불변" 보장 방식 (변경별)

| 변경 | 불변성 보장 |
|------|-------------|
| C-2 no-op/throw | 기존 13 계산모듈 + PipelineExplainer 분기는 그대로. no-op 은 원래도 무처리 Success 였던 3종(TextBox/GroupBox/ScenarioRunner)을 *명시*만 함 → 동작 동일. throw 는 enum 17종 어디에도 없는 타입에만 도달(현재 도달 불가). 정적 스캔 테스트로 enum 전체 처리 확인. |
| QA-OBS-1 폴백 | dxColumn **지정** 케이스는 기존 분기(`if (calc.dxColumn)`) 그대로 → 결과 불변. 변경은 `else`(미지정) 분기뿐. 테스트로 지정 케이스 보정값(Year≠Half) 단언. |
| D-8 IF | `processIfStatements` 는 `IF(` 매치가 없으면 입력을 **문자 그대로** 반환(while 루프 0회). IF 없는 기존 수식 = 불변. 테스트 `[D-8 불변]` 으로 plain 식 === 단언. |
| D-9 행참조 | 두 정규식은 *컬럼명+인덱스접미*(`Col[t]`/`[Col][t]`)만 매치. 단독 `[col]`(현재행)·단독 `[m]/[n]`(스칼라)은 미매치 → 기존 치환 경로 그대로. 테스트 `[D-9 불변]` 으로 `[V]*2`, `[V]/[m]`, `[n]`, `V[m]+[m]` 동시 단언. |
| D-7 설명 | 수식·산출 코드 **미변경**, description/주석만 추가 → 값 불변. |

---

## 4. 안전장치 / drift 상태

- Reserve 행참조 치환은 try/catch(기존 `App.tsx:4619-4621`) 내부에서 평가되어, 잘못된 식은 해당 행 `null`(데이터 안전). 행참조 도입으로 *기존엔 throw→null 이던* 표시문법 케이스가 이제 정상 산출됨.
- 표시(codeSnippets)↔실행(executePipeline) drift: D-8(IF), D-9(행참조)는 이번 Round 로 **단일화 완료**. D-7 은 의미 차이를 양쪽(엔진 description/주석 + codeSnippets 주석)에 명시해 오해 방지(수식 단일화는 계리 확정 후 과제로 잔존).
- D-1(다중탈퇴)·C-1(Gross/Additional 표시코드)·D-2~D-6/D-10 표시 보정은 Round B 에서 완료(이번 Round 범위 외, 회귀 없음 확인).

---

## 5. 이월 / 후속

1. **D-7 계리 단일화** — BPV_Col 과 scalar BPV 중 어느 정의가 보험료에 맞는지 계리 확정 후 수식 통합(현재는 명확화만).
2. **D-1 결합식 정답** — UDD `/2` vs 독립곱 중 권위식 확정(Round B 에서 method 옵션화 + 기본 udd 불변 처리; 정답 확정은 계리 영역).
3. **Goal 7 Playwright UI 스모크** — QA 미실측분(이번 Round 범위 외, UI 무수정 원칙).
