# Final QA Report — 2차 실행 종합 검증 (Round E)

> 작성자: pipeline-qa-runner
> 검증 대상: Round C 엔진 변경(C-2 / QA-OBS-1 / D-8 / D-9 / D-7), Round D UX 변경(P0-1/2/3 등), QA-BUG-1 수정
> 방식: 구현 에이전트와 **독립적**으로 — App.tsx 엔진 로직을 *행동(behavior)* 수준 순수 재현 + 실제 치환 순서 모사 + 컬럼-토큰 계약 교차 검증 + 정적 소스 앵커 확인
> 실측 환경: `npm run test`(vitest 4.1.8), Node v22, Windows 11. 모든 변경은 working tree(미커밋), 베이스라인 커밋 `0070b20`.

---

## 0. 실측 요약 (정직한 통과/실패/스킵)

| 항목 | 값 |
|------|----|
| `npm run test` (전체) | **96 passed (9 files)** — 기존 82 + Round E 신규 14 |
| 실패 | **0** |
| 스킵 | **0** (단 UI Playwright 스모크는 미실행 = §6 사유) |
| `npm run build` | **✓ built in 12.78s** (성공) — xlsx dynamic-import·chunk-size 경고는 베이스라인부터 존재(에러 아님) |

신규 테스트: `_workspace/tests/qa_round_e_final.test.ts` (14) — C-2 행동(3), QA-OBS-1(3), D-9 치환순서(3), P0-1 토큰계약(3), Round D 엔진무변경 앵커(2).
기존 8개 파일(82개) 전부 재현 통과, 회귀 0.

---

## 1. Round C 엔진 변경 독립 검증 (가장 중요) — 전부 PASS

### C-2 가드 (미지원 타입 throw + no-op 분기) — ✅ 실재 확인
- **소스 직접 확인**: `App.tsx:5008-5023`. if-체인 끝에
  - `TextBox || GroupBox || ScenarioRunner` → 명시 no-op(`newOutputData = undefined`), Success 유지(의도된 처리).
  - 그 외 → `else { throw new Error("지원하지 않는 모듈 타입입니다: " + module.type) }` (silent failure 차단).
- **행동 재현**(qa_round_e_final): 가짜 타입 `'SomeFutureModule'` 라우팅 → **실제 throw** 확인. TextBox/GroupBox/ScenarioRunner → throw 아닌 `{ok, output:undefined}` no-op 확인. no-op 분기가 최종 throw **앞**에 위치(순서 정확) 확인.
- **Run All 필터**: `App.tsx:5286-5292` — ScenarioRunner/PipelineExplainer + **TextBox/GroupBox** 제외. 빈 Success 노이즈 경로 차단 확인.
- Round D가 qa_c2_coverage 테스트를 앵커 기반으로 바꿨으나, **가드 로직 자체는 소스에 실재**함을 직접 확인.

### QA-OBS-1 NaN 가드 — ✅ 엔진식 재현 확인
- **소스**: scalar 경로 `App.tsx:3834-3836`, 표 `_Col` 경로 `3926-3928`. dxColumn 미지정 시 Half/Quarter/Month = `roundTo5(nnxYear)` 폴백(보정항 0).
- **행동 재현**: dxColumn 미지정 → Half/Quarter/Month 모두 **유한 = Year 값**(NaN 아님). 이 NNX 로 `PP = BPV/NNX` 계산 시 **PP 유한**(NaN 미전파) 확인. dxColumn 지정 시 Half≠Year (기존 보정 동작 불변) 확인.

### D-8 NetPremium IF() — ✅ (기존 qa_round_c_engine 재현 통과)
- **소스**: NetPremium 분기 `App.tsx:4382-4387` — `validateFormulaExpression` 직전 `processIfStatements(expression)` 1줄. `processIfStatements`(2509-2531)는 `IF(` 미존재 시 입력을 **그대로 반환**(while 0회).
- IF 변환·중첩 IF·false 분기 평가 + **IF 없는 기존 수식 불변**(`processIfStatements(plain)===plain`) 모두 통과.

### D-9 Reserve 행참조 `[col][t|m|n|0]` — ✅ 실제 치환순서로 재확인
- **소스**: `resolveRowRef`(4668-4681), 레거시 `[Col][idx]`(4683-4686) + 신형 `Col[idx]`(4688-4691) 두 정규식이 **현재행 `[col]` 치환(4694-4700)·스칼라 `[m]/[n]`(context, 4703-4708)보다 먼저** 실행. t=현재행, 0=첫행, m=납입종료행(paymentTerm-1), n=마지막행(len-1), 범위초과→"0".
- **엔진 치환 순서를 정확히 모사**한 신규 재현: `V[m] + [m]` → 행참조 V[2]=30 + 스칼라 m=3 = **33**(행참조와 스칼라 분리 정확). `V[n] - [n]` → 행참조 V[len-1]=50 − 스칼라 n=reserveEffectiveN=20 = **30**(스칼라 [n]은 행참조 n_idx와 다른 값임을 확인). 현재행 `[V]`와 `V[t]`가 동일 행 가리킴. GrossPremium 컨텍스트 `[GP]` 치환 회귀 없음.
- **불변**: 단독 `[col]`·단독 `[m]/[n]` 스칼라는 행참조 정규식(인덱스 접미 필수)에 미매치 → 기존 경로 그대로.

### D-7 BPV_Col vs scalar BPV — (수식 미변경, 명확화만)
- 수식·산출 코드 미변경(계리 확정 대기). description/주석만 추가. 값 불변 — 회귀 대상 아님.

---

## 2. Round D 엔진 무변경 확인 — ✅ (허용 범위 내 변경만)

Round D 보고서(05_ux_impl)는 "엔진(executePipeline)·codeSnippets·moduleSync·dslParser·schemaInference 로직 미변경, constants/기본 formula·Reserve 기본값·문자열 한글화만"이라고 주장. 독립 확인 결과:

- **허용된 변경(기본값/문자열) 확인**:
  - 기본 NetPremium formula `App.tsx:300` = `[BPV_Male_Mortality] / [NNX_Male_Mortality(Year)]` (P0-1, 토큰 정합 — §3).
  - 기본 Reserve formula `App.tsx:321-322` = `"0"`/`"0"` (P0-1, 유효식).
  - Reserve 오류 메시지 한글화(`App.tsx:4625` 등) — 분기/계산 로직 불변, 표현 레이어만.
- **엔진 계리식 보존 확인**(소스 앵커): `processIfStatements`·`resolveRowRef`·`지원하지 않는 모듈 타입`·`roundTo5(nnxYear)`·`decrementMethod` 모두 Round C 상태 그대로 존재. decrementMethod 분기(`3184-3188`)의 udd 기본/independent 식 손상 없음.
- **한계(정직히 명시)**: Round A~D 변경이 전부 단일 working tree(미커밋)에 누적되어 **git diff 로 Round C↔D 구간만 분리 비교 불가**. 따라서 "Round D가 엔진 라인을 단 1줄도 안 건드렸다"는 라인-수준 단정은 git 으로 증명 불가. 대신 (a) 엔진 핵심 함수/식이 Round C 문서 기재 상태와 일치, (b) 전체 회귀 96/0, (c) 엔진 변경 행동 재현 전부 통과 — 로 **엔진 동작 무회귀를 실측 확인**했다. **엔진 로직 변경으로 의심되는 결함은 발견되지 않음.**

---

## 3. 통합 end-to-end + 첫 실행 완결성(P0-1) — ✅

- **표준 시나리오**(40세男/20년/10년납/2.5%, `Risk_Rates_Whole.csv`): 기존 `qa_integration_e2e`(2)가 i_prem/i_claim→lx→Dx/dx/Cx→Nx/Mx→NNX/BPV→PP 전체 체인 완주 + PP 유한·합리범위(1e4~5e6) 재현 통과. lx 단조감소, Nx 역누적합 단조감소 확인.
- **P0-1 토큰 계약**(신규, cross-boundary): 기본 PremiumComponent `nxColumn: "Nx_Male_Mortality"`(`App.tsx:270`) → 엔진 규칙 `baseName = nxColumn.replace("Nx_","")` = `Male_Mortality` → 상류가 `NNX_Male_Mortality(Year)`·`BPV_Male_Mortality` 키 생성. 기본 NetPremium 수식 `[BPV_Male_Mortality] / [NNX_Male_Mortality(Year)]` 토큰과 **baseName 정합** 확인 → 첫 Run All 즉시 실패(미해결 토큰) 원인 해소. Reserve 기본식 `"0"` 2종으로 "준비금 1개 이상" 끝단 실패도 해소.
- 결론: **기본 예제가 끝까지 성공하도록 컬럼-토큰 계약이 정합**함을 데이터/계약 레벨에서 독립 확인. (실브라우저 13노드 "완료" 카운트는 Round D Playwright 실측 기록 — §6.)

---

## 4. round-trip · schemaInference 회귀 — ✅ 0 회귀

- `roundtrip.test.ts` + `schemaInference.test.ts` + `qa_roundtrip_merge.test.ts` = **40 passed** 재현, 회귀 없음.
- **QA-BUG-1 (AdditionalName definitions 소실) 해소 확인**: `utils/moduleSync.ts:167` WHITELIST 에 `[ModuleType.AdditionalName]: ['basicValues']` 추가됨 → DSL parser 가 항상 반환하는 `definitions: []`(dslParser.ts:385)가 reverse 결과에서 **제외**되어 merge `{...current,...reverse}` 가 원본 definitions 보존. 테스트 `[QA-BUG-1 fixed] definitions 가 DSL 적용 후에도 보존된다`가 `toEqual(원본)` 로 **수정 후 동작 단언**하며 통과.

---

## 5. "2차 실행으로 해소된 항목" (1차 QA 04 → 현재)

| 1차 ID | 1차 상태 | 현재 상태 | 근거 |
|--------|---------|----------|------|
| **QA-BUG-1** (High, definitions 소실) | BUG(고정) | ✅ **해소** | moduleSync.ts:167 WHITELIST. 테스트 fixed 단언 통과 |
| **QA-OBS-1** (Med, NNX NaN 전파) | OBS(고정) | ✅ **해소** | App.tsx:3834-3836/3926-3928 Year 폴백. 행동 재현 PP 유한 |
| **QA-OBS-2 / C-2** (Med, 미지원 타입 빈 Success) | OBS(고정) | ✅ **해소** | App.tsx:5008-5023 no-op+throw, 5286-5292 필터. 행동 재현 throw 확인 |
| **D-8** NetPremium IF 미지원 | drift | ✅ **단일화** | App.tsx:4382-4387 |
| **D-9** Reserve 행참조 표시≠실행 | drift | ✅ **단일화** | App.tsx:4668-4691 |
| **P0-1** 첫 Run All 즉시 실패 | (UX 보고) | ✅ **해소** | 기본 formula 토큰 정합 + Reserve "0" |

---

## 6. 미실행 / 스킵 (정직히)

- **UI Playwright 스모크 (선택 항목)**: 본 Round E 에서 **미실행**. 사유: (a) 핵심 검증(경계면 교차)은 코드/데이터/계약 레벨에서 완료, (b) Round D 보고서(05_ux_impl §검증)가 localhost:3006 에서 첫 Run All 13노드 "완료"/ERROR 0, 라이트모달, 성공 토스트, Live Preview 빨강 등을 이미 Playwright 실측 기록함. 시간 제약상 재실행 보류. **권장**: 후속 세션에서 `npm run dev` → 첫 Run All 무실패 + DSL 탭 [적용] 재확인 실측.
- 환경 문제 없음(모든 테스트는 repo 동봉 CSV만 사용, 외부 의존 0).

---

## 7. 잔존 결함 (심각도순)

**신규 실제 버그: 없음.** Round E 독립 검증에서 새로운 결함 미발견. 전체 96 passed / 0 failed.

이월(결함 아님, 계리/범위 과제):
- **[Low/계리] D-7** BPV_Col vs scalar BPV 의미 차이 — 수식 미통합(계리 정의 확정 후 단일화 과제). 현재 양쪽 주석으로 오해 방지, 값 불변.
- **[Low/계리] D-1** 다중탈퇴 결합식 정답(UDD ½ vs 독립곱) — method 옵션화 + udd 기본 불변 처리됨. 권위식 확정은 계리 영역.
- **[검증 한계] Round C↔D git 분리 비교 불가**(working tree 누적). 엔진 무회귀는 실측(96/0 + 행동 재현)으로 확인했으나 라인-수준 diff 증명은 불가 — 후속 커밋 분할 시 해소 권장.

---

## 8. 산출물

- `_workspace/tests/qa_round_e_final.test.ts` (신규, 14 케이스, 재실행 가능)
- 기존 8개 테스트 파일 전부 재현 통과
- 재현: `cd "<repo>" && npm run test` → 96 passed
