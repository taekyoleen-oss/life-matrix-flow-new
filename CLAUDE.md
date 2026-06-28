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
| 2026-06-22 | URL/원격 데이터 로더(작업2) | components/ParameterInputModal.tsx(LoadData: 파일/URL 소스 토글+URL 입력·불러오기, 프록시 우선→직접 fetch 폴백, 동일 `{source,fileContent,fileType:"csv"}` 저장+sourceUrl), server/split-data-server.js(GET /api/proxy-csv?url= CORS 프록시, http(s)만 허용·20s 타임아웃), vite.config.ts(`/api/proxy-csv`→localhost:3002 프록시), codeSnippets.ts(URL 소스 한정 의사코드 추가) | 표준생명표·요율표 CSV를 URL에서 직접 로드. 파일 업로드 경로 불변(기본 소스=파일), URL 분기만 추가. executePipeline/계산/연결/시각화 미변경. vite build 성공 |
| 2026-06-22 | TS 재현성 verify 하네스 신설(작업5/Phase 6) | utils/pipelineEngine.ts(신규: App.tsx executePipeline+보조함수 5종을 **동작 변경 없이** 추출한 순수 모듈 executePipelineCore/getTopologicalSort/roundTo5/roundTo8/validateFormulaExpression/processIfStatements), App.tsx(엔진 본문 제거→executePipelineCore call-through 래퍼+getTopologicalSort 별칭, import 추가), verify/pipelines.repro.test.ts·verify/README.md(신규), vitest.verify.config.ts(신규: include verify/**), package.json(`verify:pipelines` 스크립트), _workspace/tests qa_c2_coverage·qa_round_c_engine·qa_round_e_final(정적 스캔 src 에 추출 엔진 소스 합산) | 보험료(순/영업)·준비금 산출이 결정적임을 회귀 보증. 레퍼런스 4종(.lifx)을 실제 계산 코어로 2회 실행→net/gross/준비금표/상태 byte-identical 단언. 엔진은 추출만 했을 뿐 코드 byte-identical(call-through)→앱 동작 보존. verify 5/5 PASS, 기존 110/110 PASS, vite build 성공 |
| 2026-06-28 | '마지막 작업 불러오기' 신설 (ML 기능 동기화, 자체 키 적응) | App.tsx(모듈레벨 신규: `lifeMatrixFlow_lastWork`+`_files`+`_meta` 키, saveLastWork/loadLastWork/getLastWorkMeta/formatSavedAt — 기존 `lifeMatrixFlow_initialState`[초기 화면 설정·마운트 자동복원]와 **분리**; 디바운스 800ms 저장 effect + beforeunload 동시 저장; lastWorkMeta state + 메뉴 열림 시 새로고침 effect; '내 작업' 드롭다운 최상단 🕘'마지막 작업 불러오기' 버튼=loadLastWork→resetModules/_setConnections 복원, showToast 피드백, 없으면 비활성) | ML/JMDC와 동일 기능. LM은 이미 initialState 자동복원이 있었으나 **명시적 버튼·연속(디바운스) 저장**이 없었음→분리된 lastWork 키로 추가(초기 화면 설정 의미 불훼손, 대용량 fileContent 별도 키 분리 패턴 재사용). 공유 useAutoSave 훅 미사용=LM 아키텍처(productName·showToast·useHistoryState) 적응 자체 구현. UI 전용→재현성 무관. 검증: vite build exit 0·verify 6/6 PASS, **실브라우저**(디바운스 저장 15→16 모듈 savedAt 갱신·버튼 '방금 전·15개 모듈' 활성→클릭→메뉴 닫힘·캔버스 복원, 콘솔 에러 0) |
