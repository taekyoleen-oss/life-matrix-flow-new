# 08. Round G — 최종 인수 검증 보고서 (Acceptance Test)

> 작성자: pipeline-qa-runner
> 검증 기준: 사용자 인수 원문 — "처음에 계획했던 내용이 잘 완료되었는지 확인. 특히 **코드와 모듈의 연계성**, 이 둘이 **서로 상호작용하면서 완성도를 높이는지**, **에러 처리**, 모듈에서의 **입력값 산출 및 자동화**."
> 방식: **실제 앱 Playwright 실측**(`npm run dev` → localhost:**3007**) + 단위/통합 테스트(vitest) + 소스 앵커.
> 환경: Node v22 / Windows 11 / vite v6.4.1. 베이스라인 커밋 `0070b20`, 변경 working tree(미커밋).

---

## 0. 실측 요약

| 항목 | 결과 |
|------|------|
| `npm run test` | **102 passed (10 files)** — 기존 96 + Round G 신규 6. 실패 0, 스킵 0. |
| `npm run build` | **✓ built in 9.83s** (성공) |
| 첫 실행(기본 예제) 전체 실행 | **13개 계산 모듈 전부 "상태: 완료"**, 콘솔 에러 0 |
| Playwright 실측 | 코드↔모듈 양방향 닫힘 **직접 관찰** (DSL→모듈 12345, 모듈→DSL 99999) |

**A~E 판정:** A=PASS, B=PASS, C=**부분 PASS(1개 실데이터 갭 발견)**, D=PASS, E=PASS(계약 충족).

---

## A. 코드↔모듈 양방향 연계 (핵심) — **PASS (양방향 실측 닫힘)**

대상 모듈: **NetPremiumCalculator**(가장 단순, formula 1줄). localhost:3007, 기본 예제 13노드 로드.

### A-1. forward (모듈 선택 → DSL 탭 표시) — PASS
- NetPremium 노드 선택 → CodeTerminalPanel `모듈(DSL)` 탭에 실측:
  ```
  ## NetPremiumCalculator
  // 순보험료 PP = 급부현가(BPV) ÷ 보험료현가(NNX)
  PP = BPV_Male_Mortality / [NNX_Male_Mortality(Year)]
  ```
- 패널 헤더 "순보험료 계산 (Net Premium)" 정확. 탭 3종(`모듈(DSL) / 코드(Python) / 터미널`) 존재 확인.

### A-2. reverse (DSL 편집 → [적용] → 모듈 파라미터 변경) — **PASS (결정적)**
- DSL 탭에서 formula 를 `... + 12345` 로 수정 → **[적용]** 클릭.
- 직후 ParameterInputModal("파라미터 편집: 순보험료 계산") 의 **formula 필드 = `BPV_Male_Mortality / [NNX_Male_Mortality(Year)] + 12345`** 로 실측 일치.
- 즉 DSL 편집 → `updateModuleParameters(id, params, false)`(merge) → SoT(`modules[i].parameters`) → ParameterInputModal 까지 완전히 닫힘.
- 부수 관찰: 적용 직후 NetPremium 상태가 **완료→대기(Pending)** 로 리셋 + 하류 리셋 → 파라미터가 *실제로 변경*되었다는 강한 방증(unchanged 면 status 유지 — App.tsx:2202-2210).

### A-3. forward 재생성 (모달에서 파라미터 변경 → DSL 갱신) — PASS
- ParameterInputModal 에서 formula 를 `... + 99999` 로 수정 → "저장 후 닫기".
- DSL 탭이 자동으로 `PP = BPV_Male_Mortality / [NNX_Male_Mortality(Year)] + 99999` 로 **재생성**됨을 실측.
- `editingRef` 가 [적용] 성공 후 false 로 내려가 외부(모달) 변경을 다시 수신하는 §1.4 설계대로 동작.

> **결론(가장 중요): 코드↔모듈 양방향 루프가 실제 앱에서 닫힌다.**
> 코딩 입력(DSL) → 모듈 자동 반영(12345 확인), 모듈 변경(모달) → 코드 반영(99999 확인) 모두 실측.

소스 앵커: `components/CodeTerminalPanel.tsx`(3탭/editingRef/handleApply), `utils/moduleSync.ts`(moduleToDSLSection/dslSectionToParams), `App.tsx:6617-6632`(onApplyModuleDSL=updateModuleParameters(id,p,false)).

---

## B. 상호작용·완성도 (drift 해소) — **PASS**

- **표시코드↔산출 무모순(스팟체크)**: 기본 예제 13노드 전체 실행이 NetPremium 까지 "완료"로 끝나고(§D), PP 산출이 유한·합리 범위(`qa_integration_e2e` 재현). NetPremium 의 DSL 표시식(`PP = BPV/NNX`)과 실제 산출 경로(수지상등)가 정합.
- **decrementMethod 일관성**: `qa_decrement_engine.test.ts`(8 케이스) — udd(`qm+qo-qm·qo/2`) vs independent(`1-∏(1-qi)`) 가 *서로 다른* 정확한 수치, 항목별 혼합 정확 적용, 단일탈퇴 method 무관을 재현. Round G 신규 테스트로 calc 의 `decrementMethod` 가 DSL round-trip 보존됨도 확인. ParameterInputModal 에 method 드롭다운 + `?` 헬프(Round F) co-located(코드 확인).
- D-1/D-7 계리 단일화는 설계상 "옵션화 + 기본 불변/주석"으로 종결(계리 확정은 범위 외) — 값 불변.

---

## C. 에러 처리 — **부분 PASS (앱 견고성 PASS, DSL 빈값 덮어쓰기 갭 1건)**

### C-1. 잘못된 DSL 입력 → [적용] — **갭 발견 (중간 심각도)**
- 실측 1: 본문 `@@@ broken &&& nonsense` 입력 → [적용].
  - 결과: 패널에 **`✓ 적용됨`** 표시, **인라인 에러 배너 없음**, 노드 카드 Formula = **`-`(빈값)**.
- 단위 재현(`qa_round_g_acceptance.test.ts`): `dslSectionToParams('## NetPremiumCalculator\n@@@...', NetPremium)` →
  - **반환 = `{ ok:true, parameters:{ formula:"", variableName:"PP" } }`** (★).
- **분석**: parseDSL 가 인식 못 한 본문을 *구문오류(errors)* 가 아니라 *빈 formula* 로 처리 → `ok:true`. CodeTerminalPanel.handleApply 의 보류 가드는 `Object.keys(parameters).length===0` 인데, 여기는 키가 2개(formula+variableName)라 가드를 통과 → **빈 formula 가 기존 formula 를 덮어씀.**
- **영향**: 설계 §4.3 "데이터 손실 금지(절대 원칙)" 및 사용자 인수 기준 "모듈 파라미터 불변(데이터 손실 없음)" 을 **부분 위반**. 단, *구문오류*(parseDSL 가 errors 를 내는 입력)는 정상적으로 ok:false 차단됨(데이터 보존). 갭은 "헤더는 맞고 본문이 인식 불가/빈" 경우에 한정.
- **권장 수정(sync-architect)**: handleApply 또는 dslSectionToParams 에서 **수식 모듈의 formula 가 빈 문자열로 산출되면 ok:false 처리**(또는 "인식된 수식 없음" 인라인 에러) 하여 빈값 덮어쓰기 차단. 1~2줄 가드.

### C-2. 빈/잘못 입력으로 실행 → 명확한 한글 안내 + 앱 무중단 — **PASS**
- 빈 formula 상태에서 전체 실행 → NetPremium **상태: 오류**, 터미널에 **`ERROR: Premium formula is not defined.`** 명확 표시. 하류 모듈 정지, 상류 10개는 완료 유지. **앱 무중단**(콘솔 error=0, 크래시 없음).
- 미연결 입력 포트: `App.tsx:5368-5387` — 실행 전 "입력이 연결되지 않은 포트 N곳…" 비차단 토스트 + 콘솔 상세(소스 확인).
- NaN 전파 방지: NNX dxColumn 미지정 시 Year 폴백(`qa_round_e_final` 재현) — PP 유한.

### C-3. 비호환 포트 연결 → 거부 토스트 — **PASS (코드 확인)**
- `components/Canvas.tsx:373-386`(drag), `402-406`(tap): `fromPort.type !== toPort.type` 면 연결 미생성 + `notifyIncompatible` 호출.
- 메시지(한글): `"{X} 출력은 {Y} 입력에 연결할 수 없습니다. 같은 종류의 포트끼리 연결하세요."` → `App.tsx:6534` `showToast(msg,"warning")`.

---

## D. 입력값 산출·자동화 — **PASS**

### D-1. schemaInference — 상류 미실행에도 하류 드롭다운 + "예상값" 배지 — PASS
- `utils/schemaInference.ts` + `schemaInference.test.ts`(17 케이스 통과): `inferOutputColumns`/`inferUpstreamColumns` 가 엔진 prefix 규칙(lx_/Dx_/dx_/Cx_/Nx_/Mx_/NNX_/BPV_ …)을 정적 모사 → 미실행 상태에서도 하류 입력 컬럼 예측.
- ParameterInputModal: 드롭다운 소스 = `outputData.columns ?? inferred`(`getConnectedColumnsWithInference`, line 198-215). 추론 시 **"예상값" 배지** + 한글 툴팁("상류 모듈이 아직 실행되지 않아 …예상값입니다. 파이프라인 실행 후 실제 컬럼으로 대체됩니다.") 렌더(line 3036-3041).
- 실측(부수): NetPremium 모달에서 상류 토큰 자동완성 버튼 세트(`NNX_Male_Mortality(Year)`, `BPV_Male_Mortality`, `lx/Dx/dx/Cx/Nx/Mx_Male_Mortality`, `i_prem`, `i_claim`, `m`, `n` 등) 노출 확인 — 토큰 오타 위험 감소.

### D-2. 상류 실행 후 실제 컬럼 갱신 — PASS
- live 컬럼 존재 시 `inferred:false` 로 실제값 우선(line 206-207). 전체 실행 후 모달 토큰이 실제 산출 컬럼과 일치.

### D-3. 첫 실행(기본 예제) 무실패 완주 — PASS
- 온보딩 닫고 **[전체 실행]** 1회 → 13개 계산 모듈 전부 **"상태: 완료"**, 콘솔 에러 0(P0-1 토큰 정합 + Reserve 기본식 효과). 스크린샷 `acceptance_round_g.png`.

---

## E. 원 계획(03_sync_design.md) 대비 완료 매핑 — **PASS (계약 충족)**

| 원 계획 목표/계약 | 충족 | 근거 |
|---|---|---|
| **단일 진실 원천 = `modules[i].parameters`** | ✅ | DSL/모달 양쪽 모두 `updateModuleParameters` 경유 → 같은 상태 구독(A-2/A-3 실측) |
| **forward (모듈→DSL/Python)** | ✅ | DSL 탭·Python 탭 forward 표시. 모달 변경 → DSL 재생성 실측(A-1/A-3) |
| **reverse (DSL→모듈)** | ✅ | [적용] → 파라미터 merge 반영 실측(A-2). +12345 모달 일치 |
| **round-trip 무손실(DSL-표현 키)** | ✅ | `roundtrip.test.ts`+`qa_roundtrip_merge.test.ts`(40) + Round G forward→reverse 단언 |
| **비표현 키 보존(merge, replace=false)** | ✅ | QA-BUG-1 해소(definitions 보존, moduleSync.ts:167 WHITELIST). reverse=merge(App.tsx:6631) |
| **무한루프 방지(editingRef + 적용버튼)** | ✅ | 편집 중 forward 덮어쓰기 차단, 적용 후 false 복귀 실측(A-3) |
| **편집 표면 = DSL 탭만(Python 읽기전용)** | ✅ | Python 탭 `<pre>` 읽기전용, DSL 탭만 textarea 편집 |
| **schemaInference 자동인식 + 예상값 배지** | ✅ | D-1/D-2 |
| **drift 단일화(엔진 권위, 표시 보정)** | ✅ | D-8/D-9 단일화, C-1 case 추가(`qa_round_c_engine`/`qa_round_e_final`) |
| **엔진 산출 불변(예외=decrementMethod udd 기본)** | ✅ | `qa_decrement_engine` udd 기본 무변경 |
| **실패 안전: 파싱 실패 시 파라미터 불변** | ⚠️ **부분** | 구문오류는 ok:false 차단됨(보존). 그러나 "빈/garbage 본문→빈 formula 적용" 갭 1건(§C-1) |

---

## 잔존 이슈 (심각도순)

1. **[중간] DSL 빈/garbage 본문이 수식 모듈 formula 를 빈값으로 덮어쓴다 (데이터 손실 갭).**
   - 재현: DSL 탭에 `## NetPremiumCalculator\n@@@...` → [적용] → formula="" 적용, 인라인 에러 없이 `✓ 적용됨`.
   - 기대: 설계 §4.3 절대원칙 — 인식 실패 시 파라미터 불변 + 인라인 에러.
   - 위치: `components/CodeTerminalPanel.tsx:100-103`(keys>0 가드가 빈 formula 통과), `utils/moduleSync.ts:92-152`(빈 본문→ok:true).
   - 수정안: 수식형 모듈(Net/Gross/Reserve/RateModifier 등)에서 핵심 키(formula 등)가 빈 문자열이면 ok:false 또는 적용 보류 + "인식된 수식이 없습니다" 인라인 에러. → **sync-architect 통보.**
   - 완화: 빈 formula 로 실행 시 런타임에 `ERROR: Premium formula is not defined.` 로 명확 차단되어 *잘못된 산출은 발생하지 않음*(앱 무중단). 즉 "잘못된 값 산출"이 아니라 "조용한 입력 소실"이 문제.

2. **[낮음/표시] CodeTerminalPanel 패널 헤더 title 이 일시적으로 직전 모듈명을 보일 수 있음.**
   - 관찰: 초기 조회 시 `h3.font-bold` 가 툴박스 항목과 충돌했던 것으로, 재조회 시 패널 헤더는 "순보험료 계산 (Net Premium)" 정확. 실제 결함 아님(측정 아티팩트). 별도 조치 불요.

3. **[낮음/계리·범위외] D-1/D-7 계리 단일화** — 옵션화·주석으로 종결, 권위식 확정은 계리 영역(이월).

---

## 산출물

- `_workspace/tests/qa_round_g_acceptance.test.ts` (신규 6 케이스, 재실행 가능) — A 무손실 / C 빈값 갭 고정 / B decrementMethod 보존.
- 기존 9개 테스트 파일(96) 전부 재현 통과. 합계 **102 passed**.
- 스크린샷: `acceptance_round_g.png`(전체 실행 완료 상태).
- 재현: `npm run test` → 102 passed / `npm run dev` → localhost 에서 NetPremium DSL [적용]·모달 저장 왕복.
