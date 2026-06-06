---
name: module-code-sync
description: 비주얼 노드 편집기에서 코드↔모듈 양방향 동기화와 모듈 간 입출력 자동 인식을 설계·구현하는 방법론. 모듈 변경→코드 반영(forward), 코드 편집→모듈 파라미터 반영(reverse), 왕복 무손실(round-trip), 상류 출력 스키마의 하류 자동완성/전파를 다룰 때 사용. sync-architect 에이전트가 사용.
---

# Module ↔ Code Sync — 양방향 동기화 설계 방법론

## 목표

"코딩을 입력하면 모듈에 자동 입력되고, 모듈을 바꾸면 코드에 반영된다" — 그리고 모듈 간 입출력이 자동 인식된다.

## 1. 단일 진실 원천 (Single Source of Truth)

모듈 `parameters`(앱 상태)를 진실 원천으로 둔다. 코드는 파라미터의 **표현(view)**이다.
- **forward:** `parameters → 코드` = `getModuleCode` (기존, 보강)
- **reverse:** `코드 → parameters` = 신설 파서
- **계약:** `parse(getModuleCode(params)) === params` (왕복 무손실). 이 단언이 깨지면 동기화는 신뢰 불가.

## 2. 전략 선택 (round-trip 안정성 vs 자유도)

| 전략 | 방식 | 안정성 | 자유도 | 적합 |
|------|------|--------|--------|------|
| **A. DSL/마커** | 코드에 복원용 마커 임베드(`#@param k=v`) 또는 기존 `utils/dslParser.ts` 활용 | 높음(결정적) | 중 | 권장 기본값 |
| **B. placeholder 편집** | 코드의 `{{key}}` 위치만 편집 가능, 그 값만 역매핑 | 매우 높음 | 낮음 | 안전 최우선 |
| **C. 자유 파싱** | 정규식/AST로 임의 코드 해석 | 낮음(취약) | 높음 | 명확 문법+폴백 필수 |

**기존 인프라 재사용 최우선:** `utils/dslParser.ts`, `utils/pipelineBuilder.ts`, `utils/markdownModelParser.ts`가 이미 파싱/빌드를 한다. 새로 만들기 전에 이들을 확장할 수 있는지 검토하라. 전략은 오케스트레이터/사용자 승인을 받는다.

## 3. reverse 파서 구현 원칙

- **모듈 타입별 파서.** 각 `ModuleType`마다 코드 텍스트에서 해당 `parameters`를 복원. forward(`getModuleCode`)와 대칭 구조로 작성.
- **결정적 파싱.** 같은 코드는 항상 같은 파라미터로. 공백·순서에 관대하되 의미는 엄격.
- **부분 파싱 허용.** 일부만 인식돼도 인식된 것만 반영하고 나머지는 보존.
- **TDD:** 각 타입에 `params → code → params'` 단언 테스트를 먼저 작성. qa-runner와 공유.

## 4. 안전한 편집 UX 통합

- `CodeTerminalPanel`은 현재 읽기전용(`<pre><code>`). 편집 가능 입력(textarea/에디터)으로 전환하되:
  - 편집 중 즉시 파싱하지 말고 debounce 후 파싱, 또는 "적용" 버튼.
  - 파싱 성공 → 모듈 파라미터 업데이트 → 다른 패널(PropertiesPanel)과 동기화.
  - 파싱 실패 → 인라인 에러 표시, **마지막 유효 파라미터 유지**(조용한 데이터 손실 금지).
  - forward/reverse 무한루프 방지: 출처 플래그로 self-update 차단.

## 5. 입출력 자동 인식 (모듈 간 전파)

- **출력 스키마 노출:** 상류 모듈의 출력(`DataPreview.columns`, `PremiumComponentOutput.nnxResults`/`bpvResults`/`mxResults` 키 등)을 하류 모듈 파라미터 UI에 **드롭다운/자동완성**으로 제공. 수동 컬럼명 타이핑 제거.
- **포트 호환 시각화:** 연결 시 `Port.type` 호환 여부를 즉시 표시(`getAndValidateConnectedInput`의 검증을 UI 선반영).
- **변경 전파:** SelectData rename·새 컬럼 생성 시 하류 참조를 갱신하거나 끊긴 참조를 경고.
- **실행 없이도 추론:** 가능하면 실제 실행 전에도 정적으로 컬럼 스키마를 추론해 자동완성 제공(파라미터로부터 예상 출력 컬럼 계산).

## 6. 표시-실행 괴리 축소

logic-auditor의 괴리 목록을 입력받아, `getModuleCode`가 `executePipeline`의 실제 로직과 모순되지 않도록 보정한다. 이상적으로는 둘이 동일 파라미터에서 파생되어 의미가 일치해야 한다.

## 출력

`_workspace/03_sync_design.md`: 진실원천, 선택 전략과 트레이드오프, 타입별 round-trip 계약, 파일별 변경계획. 승인 후 코드 구현 + `_workspace/tests/`에 round-trip 테스트.

## 원칙

한 번에 하나의 ModuleType씩. 각 변경 후 qa-runner 검증. 데이터 손실은 어떤 경우에도 불가. 기존 인프라와 중복 생성 금지.
