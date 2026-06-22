# life matrix flow new — 앱 설명 책자 제작 방향 및 가능성

> 원형: `ML Auto Flow/docs/azure_ml_book/02_app_booklet_direction.md`.
> 목표: Jeff Barnes의 Azure ML 책과 **유사한 형식**으로, **life matrix flow new(생명보험 보험료 산출·준비금 파이프라인 편집기)를 설명하는 책자**를 만든다. 본 문서는 **방향·가능성·구조·작업량** 기획서(작성은 승인 후).

---

## 1. 가능성 평가 — 결론: **높음 / 난이도 낮음**

책자화 원천 자료가 앱 안과 docs에 이미 존재한다. "재구성·정리"가 주 작업이다.

| 책자 구성요소 | 이미 존재하는 자산 | 비고 |
|---|---|---|
| 모듈별 설명 | `constants.ts`(`TOOLBOX_MODULES` 17종, name/nameKo/description) | 거의 전부 |
| 앱 개요·사용법 | `CLAUDE.md`(앱 정의·하네스), `README.md` | 1~2장 |
| 계산 모듈 설명 | `docs/ClaimsReserveModules.md`(클레임·준비금) | 5~6장 근거 |
| 코드(의사코드)·DSL | `codeSnippets.ts`(교육용 의사코드), `utils/dslParser.ts`(마크다운↔파이프라인) | 차별화 장 |
| 보험 예제 | `samples/Whole Life.lifx`, `sampleData.ts`(risk_rates) | 도메인 예제(확장 권장) |
| 보고서 출력 | `utils/buildSlideReport.ts`(PPT), `xlsx` 내보내기 | 결과물 장 |

→ 책과 달리 **클라우드·과금 불필요 + 노드 기반 보험료 파이프라인 + 즉시 산출**을 부각. (※ 이 앱은 순수 TS라 "Python 재현" 대신 **TS 결정성·DSL 양방향 동기화·보고서 자동화**를 차별점으로 둔다.)

---

## 2. 책자 목차(안) — 책 구조를 생명보험 계리로 매핑

| 장 | 제목 | 책 대응 | 핵심 내용 | 주 자산 |
|---|---|---|---|---|
| 1 | 생명보험 계리 입문 | Ch1 | 생명표·생존확률·보험료/준비금 개념 | 신규 서술 |
| 2 | life matrix flow 시작하기 | Ch3 전반 | 캔버스·모듈·연결·실행, 클라우드 불필요 | `README.md`, `CLAUDE.md` |
| 3 | 데이터·계약정보 입력 | Ch3 | LoadData·DefinePolicyInfo·SelectRiskRates | `ParameterInputModal.tsx` |
| 4 | 생존·계산 기초 | (책 너머) | CalculateSurvivors·NxMxCalculator(교환함수) | `docs/ClaimsReserveModules.md` |
| 5 | 보험료 산출 | (책 너머) | PremiumComponent·NetPremium·GrossPremium | 모듈 + `codeSnippets.ts`(의사코드) |
| 6 | 준비금·클레임 | (책 너머) | ReserveCalculator·ClaimsCalculator | `docs/ClaimsReserveModules.md` |
| 7 | 시나리오 분석 | (책 너머) | ScenarioRunner 다중 시나리오 비교 | 모듈 |
| 8 | **코드↔모듈 양방향 동기화와 재현성** | (앱 차별화) | DSL 파서, TS 결정성, verify(신설 후) | `utils/dslParser.ts`, `verify/`(신규) |
| 9 | **AI 보조 & 보고서 자동화** | (앱 차별화) | 목표/데이터 기반 파이프라인 생성, PPT/Excel 내보내기 | `AIPipelineFrom*Modal`, `utils/buildSlideReport.ts` |
| 부록 A | 모듈 레퍼런스 | — | 17종 모듈 카드(입출력·파라미터) | `constants.ts` |
| 부록 B | 변경 이력 | — | 연혁 | `CLAUDE.md` |

### 부각할 강점(책 대비)
1. **클라우드·과금 불필요** — 브라우저만으로 보험료 산출.
2. **노드 기반 보험료 파이프라인** — 계약정보→위험률→보험료→준비금을 시각적으로 조립.
3. **코드↔모듈 양방향 동기화** — DSL 마크다운과 캔버스가 상호 변환(`dslParser.ts`).
4. **결과 자동화** — Excel·PowerPoint 보고서, `.lifx` 저장.
5. **TS 결정성** — 동일 입력 동일 산출(verify 신설로 보증, `01_improvements_life.md` 1-5).

---

## 3. 제작 경로 / 포맷

| 옵션 | 도구/스킬 | 권장도 |
|---|---|---|
| Markdown → PDF | `make-pdf` | ★ 주 산출물 |
| Word(.docx) | `report-builder` | 보조 |
| PPT(.pptx) | `app-doc-ppt` (앱 내 `buildSlideReport` 자산 활용) | 발표용 |

**권장:** Markdown SSOT → `make-pdf` → 필요 시 Word/PPT.

---

## 4. 시각자료 & 작업량

- **스크린샷 자동화:** Playwright(MCP)로 앱(`npm run dev`, 포트 3005) 띄워 각 장 예제 캔버스·결과 모달 캡처. `samples/*.lifx` 로드로 동일 화면 재현.
- **코드 일관성:** 책자의 모든 산출 수치는 `01_improvements_life.md`의 **TS verify 하네스(1-5)** 로 검증된 레퍼런스 파이프라인 결과만 사용.

| 단계 | 범위 | 산출물 | 분량 |
|---|---|---|---|
| MVP | 1~6장 + 부록 A | PDF | 40~60p |
| 확장판 | 7~9장(시나리오/AI/보고서) + 부록 B | PDF | +20~40p |
| 발표본 | 핵심 요약 | PPTX | 20~30 슬라이드 |

> **권고:** `01_improvements_life.md`의 레퍼런스 파이프라인(1-3)·TS verify(1-5)를 먼저 완성하면 3~7장 예제·수치·스크린샷을 자동 확보해 중복 작업을 최소화한다.
