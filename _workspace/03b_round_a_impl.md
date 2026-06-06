# Round A 구현 기록 — 양방향 동기화 핵심 메커니즘

> 작성자: sync-architect
> 기준 설계: `_workspace/03_sync_design.md` (Strategy A, 사용자 승인 블록 2026-06-06)
> 범위: 설계 §8.3 Phase 0 + Phase 1 + 전체 DSL 대상 모듈 round-trip
> 제약 준수: 편집 표면 = DSL 탭만 / 엔진(executePipeline) 미수정 / reverse=merge(replace=false) / 데이터 손실 금지

---

## 1. 변경/신규 파일 목록

### 신규
| 파일 | 내용 |
|------|------|
| `utils/moduleSync.ts` | 단일 모듈 forward/reverse wrapper. `moduleToDSLSection()`, `dslSectionToParams()`, `isDSLEditableType()`, `filterReverseKeys()`. 기존 dslParser 함수만 조합(새 파서 없음). |
| `_workspace/tests/roundtrip.test.ts` | 전체 DSL 대상 ModuleType round-trip 단언 (vitest). 16 케이스. |
| `vitest.config.ts` | vitest 전용 설정(앱 빌드와 분리). `include: _workspace/tests/**`. |

### 수정
| 파일 | 변경 |
|------|------|
| `package.json` | devDep `vitest` 추가. 스크립트 `test`(=`vitest run`), `test:watch` 추가. |
| `utils/dslParser.ts` | (a) generateDSL 헤더에 `term=`/`maturity=` 조건부 출력(D-3 round-trip). (b) `parseLine` → `findAssignmentEq`: 대입 `=`를 비교연산자(`<=`/`>=`/`==`/`!=`)의 `=`와 구분(ReserveCalculator `V[t<=m]` 파싱 수정). |
| `components/CodeTerminalPanel.tsx` | 2탭 → 3탭(`모듈(DSL) 편집가능 | 코드(Python) 읽기전용 | 터미널`). DSL textarea + [적용]/[되돌리기] + 인라인 에러/경고. editingRef 무한루프 방지. DSL 비대상 모듈 안내. |
| `App.tsx` | CodeTerminalPanel 에 `onApplyModuleDSL`(=`updateModuleParameters(id,params,false)`), `policyInfoModule`, `productName` prop 연결. (호출부 1곳만 변경, 엔진/기타 로직 무수정) |

**엔진(executePipeline) 변경: 0건.** (제약 준수)

---

## 2. round-trip 계약 구현 (설계 §3.1)

```
applyReverse(p0) = merge(p0, dslSectionToParams(moduleToDSLSection(p0)))
계약: DSL-표현 키 무손실 + 비표현 키(fileContent/definitions/paymentRatios/excludeNonNumericRows/columnRenames...) 보존
```

- reverse 적용 = `updateModuleParameters(id, params, false)` (merge). DSL 미표현 키는 `{...current, ...new}` 에서 보존됨.
- `selections`/`calculations`/`nxCalculations` 등 배열 키는 단일 키로 통째 교체(= DSL 권위) — §3 의도와 일치.
- ⚠️ 부분-표현 타입(SelectRiskRates)은 `filterReverseKeys` 로 `ageColumn`/`genderColumn` 만 남겨, buildModuleConfigs 의 주입 기본값(`columnRenames:[]`, `excludeNonNumericRows:true`)이 기존 값을 덮어쓰지 않게 함.

---

## 3. 테스트 결과 (실측)

명령: `npm run test` (vitest run)

```
Test Files  1 passed (1)
     Tests  16 passed (16)
```

커버 ModuleType (각 DSL-표현 키 무손실 단언):
DefinePolicyInfo(age/sex/pay/rate/term/maturity), LoadData, SelectData(선택+rename+deathRateColumn),
SelectRiskRates, RateModifier, CalculateSurvivors(decrementRates + fixedValue), ClaimsCalculator,
NxMxCalculator(nx/mx + deduct), PremiumComponent(nnx/sumx+amount), AdditionalName(basicValues),
NetPremiumCalculator, GrossPremiumCalculator, ReserveCalculator(2구간) + reverse 실패 안전 2케이스.

TDD: DefinePolicyInfo(term/maturity 미출력) + Reserve(`<=` 오파싱) 2건이 먼저 실패 → 구현으로 통과.

## 4. 타입체크 / 빌드 (실측)

- `npm run build` (vite, 프로젝트 실제 배포 게이트): **✓ built in ~12s** (성공).
- `npx tsc --noEmit`: 기존 strict 에러만 잔존(import.meta.env 타이핑, vite.config overload, ExcelInputModal/SpreadViewModal unknown 등). **본 Round 변경 파일(moduleSync/CodeTerminalPanel/dslParser/roundtrip)에서 신규 에러 0건.** (변경 전부터 존재하던 항목, 회귀 아님)

---

## 5. Round B 로 이월할 항목

설계 §7/§9 의 엔진·표시코드 보정. Round A 범위(엔진 미수정)에서 의도적으로 제외:

1. **D-1 다중탈퇴 decrementMethod** — `CalculateSurvivors` calc 별 `'udd'|'independent'` 분기. 엔진 통제된 1건 수정(기본 'udd' 불변) + getModuleCode/DSL/UI 반영. (승인 블록 §3)
2. **표시코드(getModuleCode) drift 보정** — C-1(Gross/AdditionalName case 추가), D-2/D-3/D-4/D-5/D-6/D-10 보정, D-7/D-9 주석.
3. **D-8 NetPremium IF** — 엔진 `processIfStatements` 1줄(별도 승인).
4. **D-9 Reserve 행참조** — 엔진 vs 표시 단일화 방향 확정 후.
5. **schemaInference.ts (자동 인식)** — 상류 출력 컬럼 정적 추론 + ParameterInputModal/DSL탭 드롭다운 fallback (설계 §6, Phase 3).
6. **SelectData `// off:` 마커** — 미선택 열 보존(현재는 selected:true 만 DSL 출력, 미선택은 merge 로 보존되나 명시 마커 미구현).
7. **NxMx paymentRatios 마커** — 연도별 지급비율 배열은 현재 merge 보존(DSL 미표현). 필요 시 `// ratios=[...]` 마커.
8. **이름변경 하류 전파 훅** — DSL 적용 경로에서 handleModuleSaved nameChanges 전파 연결(설계 §6.4).

---

## 6. 검증된 안전장치

- 파싱 실패(`ok:false`) 시 `onApplyModuleDSL` 미호출 → 파라미터 불변. 인라인 빨간 배너만.
- 빈 인식(`parameters` 비었음) 시 적용 보류 + 경고.
- editingRef: 편집 중 외부 변경이 textarea 를 덮어쓰지 않음. 적용 성공 시 해제.
- DSL 비대상 모듈(ScenarioRunner/TextBox/GroupBox/PipelineExplainer): textarea 비활성 + 안내. `isDSLEditableType` 로 일원화.
