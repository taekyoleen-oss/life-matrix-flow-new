---
name: pipeline-test-harness
description: 보험료 산출 파이프라인을 다양한 경우의 수로 테스트하는 방법론. 단위(모듈 계산)·통합(전체 파이프라인)·경계(빈입력/극단값/미연결)·왕복(코드↔모듈)·자동인식(컬럼 전파) 테스트를 작성·실행하고 executePipeline 실제 출력과 표시·계약을 경계면 교차 비교할 때 사용. pipeline-qa-runner 에이전트가 사용.
---

# Pipeline Test Harness — 보험료 산출 테스트 방법론

## 핵심 사고: 경계면 교차 비교

버그는 대부분 모듈 "사이"에서 난다. "이 모듈이 동작한다"가 아니라 "이 모듈의 출력이 다음 모듈의 입력 기대와 정확히 맞는가"를 본다. 검증할 4개 경계면:
1. `executePipeline` 실제 출력 shape ↔ 하류 모듈 기대 입력 shape
2. `getModuleCode` 표시 코드 ↔ `executePipeline` 실제 계산 (drift)
3. `params → code → params'` 왕복 보존
4. 상류 출력 컬럼명 ↔ 하류 참조 컬럼명

## 테스트 매트릭스 (차원별)

### 단위 (모듈 계산 정확성)
알려진 입력 → 손계산 기대값과 비교:
- SelectRiskRates: `i_prem=1/(1+i)^t`, `i_claim=1/(1+i)^(t+0.5)`
- CalculateSurvivors: 초기 lx, 단일/다중탈퇴율 `q_total=1-∏(1-q_i)`
- ClaimsCalculator: `dx=lx*q`, `Cx=dx*i_claim`
- NxMxCalculator: Nx/Mx 역누적합
- PremiumComponent: `NNX=Nx_start-Nx_end`, `BPV=amount*(Mx_start-Mx_end)`
- Net/Gross: 수식 치환·평가, GP 부가보험료 반영
- Reserve: t≤m / t>m 분기, 경계 인덱스

### 통합 (end-to-end)
표준 시나리오로 전체 완주 확인. 예: **40세 남성, 보험기간 20년, 납입 10년, 이율 2.5%**, 샘플 위험률(`Risk_Rates_Whole.csv` 또는 `sampleData.ts`) 사용. 최종 순/영업보험료가 합리적 범위인지.

### 경계 (edge cases)
빈 데이터프레임 / 미연결 포트 / `policyTerm=0` / `maturityAge<entryAge` / `paymentTerm>policyTerm` / 음수·0 위험률 / 누락 컬럼 / 빈·잘못된 수식 / NaN·무한대. 각 경우 **명확한 에러 메시지** 또는 안전한 처리가 나오는지(앱이 죽지 않는지) 확인.

### 왕복 (round-trip)
각 ModuleType에 대해 `parse(getModuleCode(params)) === params`. sync-architect 구현과 동기.

### 자동인식 (propagation)
상류 컬럼명 변경 → 하류 드롭다운/참조 갱신 또는 끊긴 참조 경고가 뜨는지.

## 실행 방법

- **계산 로직:** TS 함수를 Node로 추출 실행하거나 동등 검증 스크립트로 재현해 수치 비교. `_workspace/tests/`에 보존.
- **UI 흐름:** `npm run dev` 후 Playwright로 모듈 추가→연결→파라미터→실행→결과확인을 실제 수행. 콘솔 에러 수집.
- **점진적:** 한 모듈/기능 완성 직후 즉시 그 부분 검증(전체 완성 대기 금지).

## 공통 헬퍼 (번들링)

여러 테스트가 반복하는 셋업은 헬퍼로:
- `standardPolicy()` — 표준 정책 파라미터
- `loadSampleRates()` — 샘플 위험률 로드
- `runUnit(moduleType, params, input)` — 단일 모듈 실행
- `assertRoundTrip(moduleType, params)` — 왕복 단언

## 출력

`_workspace/04_qa_report.md`: 테스트 매트릭스(차원×케이스) 표 + 통과/실패/스킵 + 실패 상세(입력→기대→실제→`file:line`). `_workspace/tests/`에 재실행 가능한 코드.

## 원칙

통과/실패/스킵을 정직하게 구분. 스킵은 사유 명시. 환경 문제와 실제 버그를 구분. 완료 주장 전 실제 실행 결과를 증거로.
