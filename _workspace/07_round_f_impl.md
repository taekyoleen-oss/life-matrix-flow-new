# 07. Round F — 남은 UX + 계리 마무리 구현 결과

작성: editor-ux-reviewer 에이전트
기준 문서: `_workspace/02_ux_review.md`(§구조적 개선 미완분), `_workspace/05_ux_impl.md`(Round D 미완), `_workspace/01_logic_auditor_findings.md`(D-1/D-7), `_workspace/03d_round_c_impl.md`(D-7 라벨 현황)
검증: `npm run test` **96 passed**(회귀 0) · `npm run build` 성공 · `npm run dev`(localhost:3006) + Playwright 실측

---

## 변경 파일

| 파일 | 변경 요약 |
|------|-----------|
| `constants.ts` | TOOLBOX_MODULES 각 항목에 `nameKo`·`descriptionKo` 추가(한글 우선 + 영문 약어 병기). 표시 전용 헬퍼 `getModuleNameKo()`·`getModuleDescriptionKo()` export. **영문 `name`(DSL/내부 식별자)은 불변.** |
| `App.tsx` | (1) 온보딩 가이드 오버레이(4단계 체크리스트 + 진행도 + localStorage 재표시 억제 + 헤더 재호출 버튼). (2) 모듈 생성/로드 시 인스턴스 `name`을 한글 우선으로(`getModuleDefault`·createModule·파일로드 폴백). (3) 카테고리 한글화(데이터/계리계산/자동화). (4) 사이드바 모듈 버튼·툴팁·shape 메뉴 한글명 표시 + "추가 방법" 안내문 + "파이프라인 실행" 버튼 한글. (5) D-7 BPV_Col description 멀티라인 보강(공식/⚠ 경고/scalar 차이). |
| `components/ComponentRenderer.tsx` | 노드 좌/우 클릭 규약 시각화: 좌측 "입력·편집" 라벨 + "✎ 클릭하면 파라미터를 편집합니다" 한글 툴팁, 우측 "출력·결과" 라벨 + "▶ 클릭하면 결과를 봅니다" 한글 툴팁. 좌측 설명 툴팁 한글(descriptionKo). 실행/삭제 버튼 title 한글화. |
| `components/ParameterInputModal.tsx` | D-1 다중탈퇴 결합식 드롭다운 옆 `?` 헬프(title 툴팁): UDD 보정(1/2)·독립곱(1−∏) 의미·선택 기준 안내. 엔진/로직 무변경, 안내만. |
| `components/DataPreviewModal.tsx` | "Enhanced Table Data"(PremiumComponent 출력 표) 헤더가 `col.description`을 native title 툴팁 + ℹ 마커로 노출하도록 보강 → BPV_Col 설명이 실제 표 미리보기에서 사용자에게 전달됨(D-7). |

엔진(`executePipeline`)·`codeSnippets`·`utils/moduleSync`·`utils/dslParser`·`utils/schemaInference`·BPV_Col **수식**은 미변경. D-7은 description 문자열만 보강(값/수식 불변).

---

## UX 항목 (02번 §구조적 개선 미완분)

### 1. 온보딩/단계 가이드 — 완료(실측)
- 첫 방문(localStorage `lifeMatrixFlow_onboardingDismissed` 미설정) 시 모달 오버레이로 표시.
- 4단계 체크리스트: 1)위험률 데이터 로드 2)모듈 연결 3)파라미터 입력 4)실행·결과 확인. 각 단계는 현재 상태(`hasData`/`hasConnections`/`hasParams`/`hasRun`)에 따라 ✓/번호 표시.
- 닫기: 우상단 X·백드롭 클릭·"시작하기"(상태만 닫음, 다음 새로고침엔 다시) / "다시 보지 않기"(localStorage 기록 → 영구 억제).
- 헤더 ✨ 버튼("시작 가이드")으로 언제든 재호출.
- 실측: 키 초기화 후 새로고침 → 한글 4단계 오버레이 표시(스크린샷 `onboarding.png`, 로드된 종신보험 샘플 기준 2·3단계 ✓). 닫힘·재호출 동작 확인.

### 2. 모듈명 한글화 — 완료(실측)
- 15개 모듈 전부 `nameKo`/`descriptionKo` 부여. 표시: "생존자 계산 (Survivors)" 형식(한글 우선 + 영문 약어 병기).
- 사이드바 버튼·shape 메뉴 툴팁·노드 헤더·파라미터 모달 제목 모두 한글. 카테고리 "데이터/계리계산/자동화".
- **영문 `name` 보존**: DSL은 `module.type` 별칭으로 파싱(`dslParser.ts:45~`)하고 round-trip 테스트는 calc item `name`만 검사 → 인스턴스 `name`을 한글로 바꿔도 동기화 무손실(96 테스트 통과로 확인).
- 실측: 사이드바·노드 헤더 15종 모두 한글명 확인(Playwright innerText·h3 수집).

### 3. 노드 좌/우 클릭 규약 시각화 — 완료(실측)
- 좌측(1/3): "입력·편집" 라벨 + 한글 편집 안내 툴팁. 우측(2/3): "출력·결과" 라벨 + 한글 결과 안내 툴팁. 기존 좌우 분할 border 유지로 구분선 역할.
- 실측: "입력·편집"·"출력·결과" 라벨 DOM 존재 확인.

---

## 계리 항목 마무리

### 4. D-1 다중탈퇴 UI 안내 — 완료(코드 확인, 라이브 상태 미트리거)
- `decrementMethod` 드롭다운(UDD 보정 / 독립곱) 라벨 옆 `?` 헬프 추가. title 툴팁: "UDD 보정: qm+qo−qm·qo/2(1년 내 균등 가정 1/2 보정)", "독립곱: 1−∏(1−qi)", "위험률 특성·산출 기준에 맞게 선택".
- **엔진/로직 무변경** — 기존 드롭다운과 동일 조건(`!isFixed && decrementRates.length>=2`) 블록 내 헬프만 추가.
- 실측: 생존자 계산 모달은 열림 확인(제목 한글). 단 드롭다운은 calc 항목에 2개 이상 탈퇴율이 있을 때만 노출 → 로드 샘플의 현재 상태에선 미노출이라 헬프 자체는 라이브 미포착. 헬프가 드롭다운과 동일 가드 내 co-located이므로 드롭다운 노출 시 함께 표시됨(코드 확인).

### 5. D-7 BPV_Col 라벨 명확화 확인·보강 — 완료(실측)
- Round C가 추가한 ColumnInfo.description(`App.tsx:3985`)을 멀티라인으로 보강: "보험금 현가(행별 참고용) / 공식: Σ(Mx[행]×보험금) / ⚠ scalar BPV와 다름 / scalar=(Mx[0]−Mx[종단])×보험금(구간차) / 직접 비교하지 마세요".
- **확인 결과 보강 필요했던 갭**: BPV_Col이 실제 노출되는 곳은 PremiumComponent 출력의 "Enhanced Table Data" 표(`DataPreviewModal.tsx:492`)인데, 이 표는 `ColumnDescTooltip`(line 828 경로)이 아니라 plain `<th>{col.name}</th>`라서 **description이 사용자에게 전혀 보이지 않았음**. → `<th>`에 `title`(native 툴팁) + ℹ 마커 + cursor-help 추가하여 보강.
- **수식 절대 불변**: 산출부(`App.tsx:3933,3943`)·codeSnippets 미변경.
- 실측: 전체 실행 후 NNX MMX 노드 우측 클릭 → Enhanced Table Data 표의 `BPV_Col` 헤더가 ℹ 표시 + cursor-help + title="…scalar BPV와 직접 비교하지 마세요" 보유 확인(Playwright `th.title` 추출 일치).

---

## 검증 결과

- `npm run test`: **96 passed**(9 files). 회귀 0.
- `npm run build`: **성공**(~11~14s). 기존 xlsx dynamic-import 경고·청크 크기 경고만(사전 존재, 무관).
- Playwright 실측(localhost:3006):
  - 온보딩 4단계 한글 오버레이 표시·닫힘·헤더 재호출(스크린샷).
  - 사이드바·노드 헤더 15종 한글명("…(영문)") 확인.
  - 노드 좌 "입력·편집"/우 "출력·결과" 라벨 확인.
  - D-7 BPV_Col 표 헤더 ℹ + 한글 경고 툴팁 확인.
  - 생존자 계산 모달 한글 제목 확인.
- 실측 미확인(코드 근거 판정):
  - D-1 decrementMethod 헬프 `?` 렌더 — 드롭다운이 2개+ 탈퇴율 조건에서만 노출되며 로드 샘플 현재 상태로는 미트리거. 헬프가 드롭다운과 동일 가드 블록에 co-located되어 함께 표시됨(코드 확인).
  - 다크모드에서 온보딩/신규 라벨 렌더 — 라이트모드 실측 + dark: 클래스 분기 코드 근거.

## 미완 / 잔여 과제(범위 외)

- D-7 **계리 단일화**(BPV_Col vs scalar BPV 수식 통합)는 여전히 계리 확정 대기 — 이번 Round도 명확화(라벨/툴팁)까지만. `03d_round_c_impl.md` 후속 과제와 동일.
- 비호환 포트 연결 사전 하이라이트(드래그 중 호환 입력 초록 링) — Round D에서 거부 토스트까지 구현, 사전 하이라이트는 미착수(02번 구조#4 일부).
- 파라미터 모달 내부 일부 서브패널 다크 스타일 유지(Round D 의도적 범위 제한 그대로).
