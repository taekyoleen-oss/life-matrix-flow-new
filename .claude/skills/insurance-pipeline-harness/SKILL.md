---
name: insurance-pipeline-harness
description: 보험료 산출 앱(노드 기반 비주얼 파이프라인)의 로직 완결성·사용자 편의성을 검토하고, 코드↔모듈 양방향 동기화와 입출력 자동 인식을 설계·구현·검증하는 오케스트레이터. "보험료 산출 점검", "로직 완결성 검토", "사용자 편의성 검토", "코드 모듈 동기화", "양방향 동기화", "입출력 자동 인식", "파이프라인 테스트", "하네스 실행", 그리고 후속 요청("다시 실행", "재실행", "업데이트", "보완", "특정 모듈만 다시", "이전 결과 기반 개선") 시 반드시 이 스킬을 사용하라. 단순 단일 파일 질문은 직접 응답 가능.
---

# Insurance Pipeline Harness — 오케스트레이터

보험료 산출 앱의 검토·개선을 위한 에이전트 팀을 조율한다. **실행 모드: 에이전트 팀**(기본).

## 팀 구성

| 에이전트 | 타입 | 역할 |
|---------|------|------|
| `pipeline-logic-auditor` | opus | 산출 로직 완결성·executePipeline↔getModuleCode 괴리·커버리지·수리 정확성 감사 |
| `editor-ux-reviewer` | opus | 사용자 편의성·단계별 피드백·입력오류 예방 검토 |
| `sync-architect` | opus | 코드↔모듈 양방향 동기화 + 입출력 자동 인식 설계·구현 |
| `pipeline-qa-runner` | general-purpose, opus | 단위·통합·경계·왕복 테스트 작성·실행, 경계면 교차 비교 |

모든 Agent 호출에 `model: "opus"` 명시. 팀은 `TeamCreate`로 구성하고 `SendMessage`/`TaskCreate`로 자체 조율.

## Phase 0: 컨텍스트 확인

1. `_workspace/` 존재 여부 확인:
   - 미존재 → **초기 실행** (Phase 1부터 전체)
   - 존재 + 사용자가 부분 수정 요청 → **부분 재실행** (해당 에이전트만 재호출, 기존 산출물 읽고 보완)
   - 존재 + 새 입력 → **새 실행** (`_workspace/`를 `_workspace_prev/`로 이동 후 초기 실행)
2. 사용자에게 실행 계획을 요약 보고하고 확인받는다. 특히 **양방향 동기화 전략(A: DSL/마커, B: placeholder 편집, C: 자유파싱)** 은 아키텍처 결정이므로 구현 착수 전 사용자 승인을 받는다.

## Phase 1: 병렬 진단 (감사 + UX)

**실행 모드: 에이전트 팀.** logic-auditor와 ux-reviewer를 동시 가동:
- `pipeline-logic-auditor` → `_workspace/01_logic_auditor_findings.md`
- `editor-ux-reviewer` → `_workspace/02_ux_review.md`

두 진단이 끝나면 리더가 종합해 사용자에게 **진단 리포트**를 보고한다. (사용자가 "점검만" 원하면 여기서 종료 가능.)

## Phase 2: 동기화 설계 (승인 게이트)

- `sync-architect`가 01번 괴리·커버리지 목록을 입력받아 `_workspace/03_sync_design.md`(진실원천·전략·round-trip 계약·파일별 변경계획) 작성.
- **리더는 설계를 사용자에게 보고하고 승인받은 뒤에만** Phase 3로 진행한다. 미승인 시 설계 수정 반복.

## Phase 3: 구현 + 점진적 검증 (생성-검증)

- `sync-architect`가 한 번에 하나의 ModuleType/기능씩 구현(TDD 권장).
- 각 구현 직후 `pipeline-qa-runner`가 해당 기능을 즉시 검증(점진적 QA). 실패 → architect에 통보 → 수정 → 재검증.
- 동시에 qa-runner는 기존 로직의 단위·통합·경계 테스트도 `_workspace/tests/`에 축적.
- logic-auditor가 발견한 커버리지 누락(예: GrossPremiumCalculator, AdditionalName)을 architect가 보완.

## Phase 4: 종합 검증 및 보고

- qa-runner가 전체 테스트 매트릭스를 실행해 `_workspace/04_qa_report.md` 작성.
- 리더가 진단·설계·구현·검증을 종합해 최종 리포트를 사용자에게 보고.
- `superpowers:verification-before-completion`: 완료를 주장하기 전 실제 테스트 실행 결과(통과/실패 수)를 증거로 제시한다.

## 데이터 전달 프로토콜

- 태스크 기반(`TaskCreate`/`TaskUpdate`, 의존관계) + 파일 기반(`_workspace/{phase}_{agent}_{artifact}.md`) + 메시지 기반(`SendMessage`, 실시간 조율) 병용.
- 최종 산출물(리포트, 코드 변경)만 사용자에게, 중간 파일은 `_workspace/`에 보존(감사 추적).

## 에러 핸들링

- 에이전트 1회 재시도 후 재실패 → 해당 결과 없이 진행하되 최종 보고에 누락 명시.
- 상충 발견은 삭제하지 않고 출처 병기.
- 구현이 기존 기능을 깨면 즉시 롤백하고 리더에 보고.

## 테스트 시나리오

- **정상 흐름:** 사용자가 "보험료 산출 로직 점검하고 코드-모듈 동기화 보완해줘" → Phase 0 확인 → Phase 1 진단 → 진단 보고 → Phase 2 설계+승인 → Phase 3 구현+점진검증 → Phase 4 종합보고.
- **에러 흐름:** Phase 2 설계를 사용자가 거부 → architect가 다른 전략으로 재설계 → 재승인. / Phase 3 구현이 round-trip 테스트 실패 → architect 수정 → qa 재검증, 2회 실패 시 해당 ModuleType 보류하고 리포트에 명시.
- **부분 재실행:** "Reserve 모듈 동기화만 다시" → Phase 0에서 부분 재실행 판별 → architect+qa만 해당 모듈 재작업.

## 진화

매 실행 후 사용자 피드백을 받아 에이전트/스킬/CLAUDE.md를 갱신하고 변경 이력에 기록한다.
