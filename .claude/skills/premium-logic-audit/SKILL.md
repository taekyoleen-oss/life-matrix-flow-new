---
name: premium-logic-audit
description: 보험료 산출 파이프라인의 로직 완결성을 감사하는 방법론. executePipeline(실제 엔진)과 getModuleCode(표시 코드)의 괴리, ModuleType 커버리지 누락, 모듈 간 입출력 계약(포트·컬럼), 수리적 정확성(할인계수·생존자·통상함수·NNX/BPV·순/영업보험료·준비금)을 단계별로 점검할 때 사용. pipeline-logic-auditor 에이전트가 사용.
---

# Premium Logic Audit — 보험료 산출 로직 감사 방법론

## 왜 이 감사가 필요한가

이 앱에는 보험료 산출 로직이 **두 곳**에 따로 존재한다. 사용자가 보는 코드(`getModuleCode`)와 실제 계산(`executePipeline`)이 다르면 사용자는 잘못된 코드를 신뢰하게 된다. 또 모듈은 단계적으로 데이터를 넘기므로, 한 단계의 출력 컬럼명이 다음 단계 입력과 어긋나면 조용히 틀린 값이 나온다. 그래서 감사는 "각 단계가 완결되는가 + 단계 간 계약이 지켜지는가 + 두 진실원천이 일치하는가"를 본다.

## 감사 절차

### 1. 커버리지 매트릭스 작성
`types.ts`의 `ModuleType` enum 전체를 행으로 두고, 각 행에 대해:
- `executePipeline`(App.tsx)에 처리 분기가 있는가? (`case ModuleType.X`)
- `getModuleCode`(codeSnippets.ts)에 `case`가 있는가?
- 둘의 로직이 일치하는가 / 표시만 placeholder인가 / 아예 없는가
누락·placeholder·불일치를 모두 표로 만든다.

### 2. 진실원천 대조 (drift 검출)
각 ModuleType마다 `getModuleCode`가 만드는 의사코드와 `executePipeline`의 실제 TS 계산을 나란히 읽고, **변수명·수식·경계조건**이 일치하는지 본다. 불일치는 심각도 High 이상.

### 3. 입출력 계약 맵
모듈이 만드는 컬럼/필드와 하류가 참조하는 이름을 추적한다:
- 생성: `lx_*`, `Dx`, `dx_*`, `Cx_*`, `Nx_*`, `Mx_*`, `i_prem`, `i_claim`, NNX/BPV 키
- 참조: 하류 모듈 파라미터의 컬럼 지정(예: ClaimsCalculator의 `lxColumn`, NxMx의 `baseColumn`, PremiumComponent의 `nxColumn`/`mxColumn`)
- 각 참조가 **자동 인식**(드롭다운/스키마 기반)인지 **수동 타이핑**인지 표시. 수동이면 오타 위험으로 분류.
- 포트 타입 호환은 `getAndValidateConnectedInput`로 검증되는지 확인.

### 4. 수리 정확성 체크리스트
- **할인계수:** `i_prem = 1/(1+i)^t`, `i_claim = 1/(1+i)^(t+0.5)` — 반기 가정 일관성.
- **생존자(lx):** 초기값, 다중탈퇴율 독립결합 `q_total = 1 - ∏(1-q_i)`, 감소 순서.
- **통상함수:** Nx/Mx 역누적합(reverse cumsum) 방향, Mx 공제(deductible)·납입비율 반영.
- **NNX/BPV:** 구간합 `Nx_start - Nx_end`의 인덱스(`payment_term` vs `policy_term`), 경계 초과 시 0 처리.
- **준비금:** `t ≤ m`(납입중) vs `t > m`(납입후) 분기, `n_idx`/`m_idx` off-by-one.
- 각 항목: 정확 / 의심(근거) / 검증필요.

## 출력 형식

`_workspace/01_logic_auditor_findings.md`:
- `## 발견 사항` — [심각도] · 제목 · `file:line` · 현상 · 영향 · 권장 수정
- `## 모듈 커버리지 매트릭스`
- `## 입출력 계약 맵` (자동인식/수동 구분)
- `## 수리 정확성 체크리스트 결과`

## 원칙

추정 금지 — 감사 대상 함수는 전체를 읽고 `file:line`으로 인용한다. 확신 없는 수리 로직은 "검증필요"로 표시하고 qa-runner에 넘긴다. 틀린 단정보다 정직한 불확실성이 낫다.
