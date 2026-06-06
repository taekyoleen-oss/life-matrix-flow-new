# life-matrix-flow — 프로젝트 지침

노드 기반 비주얼 보험료 산출 파이프라인 편집기 (React 19 + Vite + TypeScript + Supabase).
핵심: `App.tsx`의 `executePipeline`(실제 계산 엔진), `codeSnippets.ts`의 `getModuleCode`(표시용 코드), `types.ts`의 `ModuleType`/포트 계약.

## 하네스: 보험료 산출 파이프라인 검토·개선

**목표:** 보험료 산출의 로직 완결성·사용자 편의성을 검토하고, 코드↔모듈 양방향 동기화와 모듈 간 입출력 자동 인식을 설계·구현·검증한다.

**트리거:** 보험료 산출 점검, 로직 완결성/사용자 편의성 검토, 코드↔모듈 동기화, 양방향 동기화, 입출력 자동 인식, 파이프라인 테스트, 또는 후속 요청(재실행·보완·특정 모듈만 다시) 시 `insurance-pipeline-harness` 스킬을 사용하라. 단순 단일 파일 질문은 직접 응답 가능.

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-06-06 | 초기 구성 (에이전트 4 + 스킬 5) | 전체 | 로직 완결성·UX·코드모듈 동기화 검토 하네스 구축 |
| 2026-06-06 | Phase 1-4 1차 실행 | utils/moduleSync.ts·schemaInference.ts(신규), dslParser.ts·codeSnippets.ts·CodeTerminalPanel.tsx·App.tsx·ParameterInputModal.tsx | 코드↔모듈 양방향 DSL 동기화 + 입출력 자동인식 + 다중탈퇴 선택형(decrementMethod) 구현. 진단 36건/구현/QA 68 tests. 결정: 편집표면=DSL탭, 엔진보존(decrementMethod 예외 1건), 러너=vitest |
