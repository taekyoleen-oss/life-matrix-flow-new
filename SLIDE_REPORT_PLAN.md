# PPT 슬라이드 보고서 기능 구현 가이드

> **문서 버전**: v2.0
> **최초 작성**: 2025-07-01 / **업데이트**: 2026-03-24
> **대상 앱**: Life Matrix Flow (Vite + React + TypeScript)
> **목적**: 이 앱의 PPT 구현 방식을 준용하여 유사한 앱에 PPT 보고서 기능을 추가할 때 참조

---

## 1. 기능 목적

보험료 산출 파이프라인의 **입력 → 모듈 구성 → 계산 단계 → 최종 결과** 전 과정을,
버튼 한 번으로 `.pptx` 보고 슬라이드로 내보낸다.

계리사·언더라이터·상품팀이 산출 근거를 **외부에 보고**하거나 **내부 검토**할 때 사용한다.

---

## 2. 핵심 아키텍처 결정사항

### 2-1. 클라이언트 전용 방식 (API 서버 없음)

```
브라우저 내 pptxgenjs → pres.writeFile() → 브라우저 자동 다운로드
```

- `pptxgenjs`를 **클라이언트에서 직접** 실행한다.
- Next.js API Route 등 서버 엔드포인트가 **불필요**하다.
- `pres.writeFile({ fileName: "..." })` 호출 한 번으로 다운로드까지 완료된다.

> 이 방식은 서버리스 배포(Vercel 등)에서도 추가 설정 없이 동작한다.

### 2-2. 앱 상태 직접 활용

- 별도 API 직렬화 없이 앱의 상태(모듈 배열 `CanvasModule[]`)를 그대로 슬라이드 빌더에 전달한다.
- `outputData`, `parameters` 등 모듈 런타임 데이터를 직접 읽는다.

### 2-3. 단일 파일 구조

- 슬라이드 빌더 전체를 **하나의 파일** `utils/buildSlideReport.ts`에 구현한다.
- 색상·폰트 상수, 헬퍼 함수, 슬라이드별 빌더 함수를 모두 이 파일에 넣는다.

---

## 3. 사용자 경험 (UX 흐름)

```
파이프라인 실행 완료 (NetPremium 또는 GrossPremium Success 상태)
        │
        ▼
툴바에 "📊 PPT 보고서" 버튼 활성화
(파이프라인 미실행 시 버튼 회색 비활성화)
        │  클릭
        ▼
버튼 상태: "⏳ 생성 중…" (로딩)
        │  약 2~4초
        ▼
브라우저 자동 다운로드
파일명: {productName}_보험료산출보고서.pptx
        │
        ▼
버튼 상태: "✅ 완료" → 2초 후 원상복구
(오류 시 "❌ 오류", 하단 토스트 메시지 표시)
```

---

## 4. 슬라이드 구성 (13장)

| 순서 | 슬라이드 제목 | 핵심 콘텐츠 | 빌더 함수 |
|------|-------------|------------|----------|
| 1 | 표지 | 상품명, 가입조건 요약 칩, 생성일 | `addCoverSlide` |
| 2 | 정책 입력 변수 | 가입연령·성별·보험기간·납입기간·이자율 테이블 | `addPolicySlide` |
| 3 | 파이프라인 구성 | 모듈 카드 그리드 (이름, 역할, 상태 색상) | `addPipelineSlide` |
| 4 | 위험률 & 할인계수 | 공식 수식 테이블 + 샘플 데이터 | `addRatingBasisSlide` |
| 5 | 생존자수 산출 (lx, Dx) | lx/Dx 공식 + 샘플 데이터 | `addSurvivorsSlide` |
| 6 | 클레임 산출 (dx, Cx) | dx/Cx 공식 + 샘플 데이터 | `addClaimsSlide` |
| 7 | 교환함수 (Nx, Mx) | Nx/Mx 공식 + 샘플 데이터 | `addNxMxSlide` |
| 8 | BPV / NNX | BPV·NNX 계산값 + 납입주기별 공식 | `addBpvNnxSlide` |
| 9 | 추가 변수 | 사용자 정의 변수 목록 테이블 | `addAdditionalVariablesSlide` |
| 10 | 순보험료 (PP) | 산출 공식 + 빅넘버 카드 | `addNetPremiumSlide` |
| 11 | 영업보험료 (GP) | 산출 공식 + 빅넘버 카드 | `addGrossPremiumSlide` |
| 12 | 연도별 준비금 추이 | LINE 차트 + 최고 준비금 요약 | `addReserveSlide` |
| 13 | 가정사항 & 면책 | 가정 목록 테이블 + 면책 박스 | `addAssumptionsSlide` |

**디자인 원칙**
- 컬러: 딥네이비 `1E2761` + 골드 `E8A020` + 아이스블루 `4A90D9`
- 폰트: **Malgun Gothic** (제목/본문), **Courier New** (코드/수식) — 한글 호환 우선
- 모든 슬라이드 헤더: 네이비 바 + 흰 제목 텍스트
- 모든 슬라이드 푸터: 우하단 `{productName}  |  N / 13`

---

## 5. 구현 파일 목록

```
프로젝트 루트/
├── utils/
│   └── buildSlideReport.ts    ← [신규] 슬라이드 빌더 전체 (색상·헬퍼·13장 슬라이드 포함)
│
└── components/
    └── SlideReportButton.tsx  ← [신규] 다운로드 버튼 + 파이프라인 상태 검증
```

> **기존 타입 활용**: 별도 `types/model-report.ts` 불필요.
> 앱의 기존 `types.ts`에서 `CanvasModule`, `ModuleType`, `ModuleStatus` 등을 import한다.

---

## 6. `utils/buildSlideReport.ts` 구현 명세

### 6-1. 컬러 팔레트 & 폰트 상수

```typescript
// hex 색상: # 절대 사용 금지 — pptxgenjs 규칙
const C = {
  navy:      "1E2761",   // 헤더 배경, 진한 강조
  blue:      "4A90D9",   // 차트선, 카드 테두리
  gold:      "E8A020",   // 하이라이트, 표지 부제
  white:     "FFFFFF",
  offWhite:  "F8FAFC",   // 라이트 슬라이드 배경, 카드 배경
  darkText:  "1E293B",
  midText:   "64748B",
  tableOdd:  "F8FAFC",
  tableEven: "FFFFFF",
  border:    "E2E8F0",
};

// 한글 지원을 위해 Malgun Gothic 사용
const F = { title: "Malgun Gothic", body: "Malgun Gothic", mono: "Courier New" };

// 레이아웃 상수 (LAYOUT_WIDE = 13.33 × 7.5 인치)
const SLIDE_W   = 13.33;
const SLIDE_H   = 7.5;
const HEADER_H  = 1.0;
const BODY_Y    = 1.25;   // 헤더 아래 콘텐츠 시작 y
const MARGIN    = 0.5;
const CONTENT_W = SLIDE_W - MARGIN * 2;  // 12.33
const TOTAL_SLIDES = 13;
```

### 6-2. 헬퍼 함수

**슬라이드 헤더** (모든 슬라이드에 공통 사용)
```typescript
function addSlideHeader(
  slide: PptxGenJS.Slide,
  title: string,
  slideNum: number,
  productName: string,
  moduleName?: string   // 있으면 "ModuleName : 제목" 형식
): void
```

**수식 흐름 테이블** (3열: 단계 | 공식 | 샘플값)
```typescript
function addFormulaTable(
  slide: PptxGenJS.Slide,
  rows: string[][],   // 첫 행 = 헤더
  y: number,
  rowH = 0.6
): number  // 다음 콘텐츠의 y 반환
// colW = [2.5, 6.83, 3.0] — 합계 12.33
// 헤더: 네이비 배경 흰 글씨 / 짝홀 교차 배경색
// 공식 열(ci === 1): Courier New 폰트
```

**샘플 데이터 테이블** (최대 5행, 최대 열 수 자동 계산)
```typescript
function addSampleDataTable(
  slide: PptxGenJS.Slide,
  allRows: Record<string, any>[],
  startY: number,
  sectionLabel?: string
): number  // 다음 y 반환
// 열 초과 시 하단에 "※ 표시 외 N개 컬럼 생략" 표시
```

**빅넘버 카드** (산출 결과 강조 표시)
```typescript
function addBigNumberCard(
  slide: PptxGenJS.Slide,
  label: string,    // "순보험료 (PP)"
  value: string,    // "124,500 원"
  unit: string,     // "원 / 연"
  y: number
): void
// 중앙 카드 (x=3.2, w=7.0, h=3.2), 파란 테두리
// 라벨(20pt) → 빅넘버(64pt bold navy) → 단위(18pt)
```

**숫자 포맷 헬퍼**
```typescript
function formatNum(v: any, d = 4): string
// 1000 이상: 한국 로케일 쉼표, 이하: 소수점 d자리

function formatCurrency(v: any): string
// 한국 로케일 정수 + " 원" 접미사
```

### 6-3. 슬라이드별 빌더 패턴

각 슬라이드 빌더 함수는 아래 패턴을 따른다:

```typescript
function addXxxSlide(pres: PptxGenJS, productName: string, modules: CanvasModule[]): void {
  const slide = pres.addSlide();
  const mod = getModule(modules, ModuleType.XxxModule);
  addSlideHeader(slide, "슬라이드 제목", slideNum, productName, mod?.name);

  // 모듈 outputData 접근
  const output = getOutputData(modules, ModuleType.XxxModule) as XxxOutput | null;
  const rows   = getOutputRows(modules, ModuleType.XxxModule); // rows 기반 모듈

  // 미산출 시 안내 텍스트
  if (!output) {
    slide.addText("※ 미산출 (파이프라인 실행 필요)", { ... });
    return;
  }
  // ... 슬라이드 콘텐츠
}
```

**데이터 접근 헬퍼**
```typescript
getModule(modules, type)        // 모듈 객체 반환
getOutputData(modules, type)    // outputData 반환 (status === Success일 때만)
getOutputRows(modules, type)    // outputData.rows 반환
```

### 6-4. Slide 12: 차트 설정

```typescript
slide.addChart("line" as PptxGenJS.CHART_NAME, [
  { name: "책임준비금", labels, values },
], {
  x: MARGIN, y: BODY_Y, w: CONTENT_W, h: 5.5,
  chartColors: [C.blue],
  lineSize: 2, lineSmooth: true, showLegend: false,
  valAxisTitle: "준비금 (원)", catAxisTitle: "경과연도",
  valGridLine: { color: C.border, size: 0.5 },
  catGridLine: { style: "none" },
  chartArea: { fill: { color: C.white } },
  plotArea: { fill: { color: C.offWhite } },
});
// reserveCol 탐지: 컬럼명에 "reserve" 또는 "준비금" 포함 여부로 자동 탐지
```

### 6-5. 메인 진입점

```typescript
export async function buildSlideReport(
  productName: string,
  modules: CanvasModule[]
): Promise<void> {
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE";  // 16:9 와이드

  addCoverSlide(pres, productName, modules);
  addPolicySlide(pres, productName, modules);
  // ... 나머지 슬라이드 순서대로 ...
  addAssumptionsSlide(pres, productName, modules);

  // 클라이언트에서 직접 파일 저장 (서버 불필요)
  await pres.writeFile({ fileName: `${productName}_보험료산출보고서` });
}
```

---

## 7. `components/SlideReportButton.tsx` 구현 명세

### 7-1. Props

```typescript
interface Props {
  productName: string;
  modules: CanvasModule[];
}
```

### 7-2. 파이프라인 유효성 검증

버튼 클릭 전 파이프라인 상태를 확인한다:

```typescript
function isPipelineReady(modules: CanvasModule[]): { ready: boolean; reason?: string } {
  // TextBox, GroupBox는 계산 모듈이 아니므로 제외
  const ignored = new Set([ModuleType.TextBox, ModuleType.GroupBox]);
  const calcModules = modules.filter((m) => !ignored.has(m.type));

  if (calcModules.some((m) => m.status === ModuleStatus.Error))
    return { ready: false, reason: "에러가 발생한 모듈이 있습니다." };
  if (calcModules.some((m) => m.status === ModuleStatus.Running))
    return { ready: false, reason: "실행 중인 모듈이 있습니다." };

  // NetPremium 또는 GrossPremium 중 하나 이상 Success여야 함
  const hasPremium =
    modules.find((m) => m.type === ModuleType.NetPremiumCalculator)?.status === ModuleStatus.Success ||
    modules.find((m) => m.type === ModuleType.GrossPremiumCalculator)?.status === ModuleStatus.Success;

  if (!hasPremium)
    return { ready: false, reason: "파이프라인을 먼저 실행하세요." };

  return { ready: true };
}
```

### 7-3. 버튼 상태 전환

```
idle    → "📊 PPT 보고서"   bg-indigo-700   (파이프라인 미실행 시 bg-gray-500 opacity-50)
loading → "⏳ 생성 중…"     bg-indigo-700 opacity-70, disabled
done    → "✅ 완료"         bg-green-700, 2초 후 idle
error   → "❌ 오류"         bg-red-700, 하단 토스트 표시, 3초 후 idle
```

### 7-4. 다운로드 로직

```typescript
const handleClick = async () => {
  if (!ready || state === "loading") return;
  setState("loading");
  try {
    await buildSlideReport(productName, modules);
    setState("done");
    setTimeout(() => setState("idle"), 2000);
  } catch (err) {
    setState("error");
    showToast(`❌ PPT 생성 중 오류: ${err instanceof Error ? err.message : String(err)}`);
    setTimeout(() => setState("idle"), 3000);
  }
};
```

> `buildSlideReport` 내부에서 `pres.writeFile()`이 브라우저 다운로드까지 처리한다.
> API fetch, blob, URL.createObjectURL 등의 과정이 **없다**.

### 7-5. 토스트 알림

오류 메시지를 화면 하단 중앙에 고정 표시한다:

```tsx
{toast && (
  <div style={{
    position: "fixed", bottom: "1.5rem", left: "50%",
    transform: "translateX(-50%)", zIndex: 9999,
    background: "#1e293b", color: "#f8fafc",
    padding: "0.65rem 1.2rem", borderRadius: "0.5rem",
    fontSize: "0.82rem", maxWidth: "36rem",
  }}>
    {toast}
  </div>
)}
```

---

## 8. pptxgenjs 필수 준수사항

| 규칙 | 설명 | 위반 시 결과 |
|------|------|-------------|
| hex에 `#` 금지 | `"1E2761"` ✅ / `"#1E2761"` ❌ | pptx 파일 손상 |
| opacity 속성 분리 | `opacity: 0.1` ✅ / `"1E276119"` 8자리 hex ❌ | 투명도 무시 |
| 옵션 객체 재사용 금지 | 매 호출마다 `{ fill: { color: ... } }` 새 객체 생성 | 이전 슬라이드 덮어씀 |
| `bullet: true`만 사용 | `bullet: true` ✅ / 유니코드 `•` ❌ | 인코딩 오류 |
| `breakLine: true` | 멀티라인 텍스트 배열에 필수 | 줄바꿈 무시 |
| `pres.layout = "LAYOUT_WIDE"` | 슬라이드 추가 전에 설정 | 슬라이드 크기 오류 |
| `addChart` 타입 캐스팅 | `"line" as PptxGenJS.CHART_NAME` | TypeScript 컴파일 오류 |
| `addShape` 타입 캐스팅 | `"rect" as PptxGenJS.SHAPE_NAME` | 동일 |

---

## 9. 구현 순서

```
Step 1. pptxgenjs 설치
        npm install pptxgenjs
        (또는 pnpm add pptxgenjs)

Step 2. utils/buildSlideReport.ts 생성
        - 컬러·폰트·레이아웃 상수 정의
        - 헬퍼 함수 구현 (addSlideHeader, addFormulaTable, addSampleDataTable, addBigNumberCard)
        - 슬라이드별 빌더 함수 구현 (앱 도메인에 맞게 조정)
        - 메인 buildSlideReport() 함수 작성

Step 3. components/SlideReportButton.tsx 생성
        - isPipelineReady() 검증 함수
        - 4단계 상태 관리 (idle/loading/done/error)
        - 토스트 알림

Step 4. 버튼 삽입
        - 상단 툴바 또는 페이지 헤더에 <SlideReportButton> 추가

Step 5. 타입 오류 확인
        npx tsc --noEmit

Step 6. 로컬 테스트
        - 파이프라인 실행 → PPT 버튼 클릭 → .pptx 다운로드 확인
        - 에러 케이스: 파이프라인 미실행 상태에서 버튼 비활성화 확인

Step 7. 시각 QA
        생성된 .pptx 파일을 열어 확인:
        - 텍스트 잘림 없음
        - 요소 겹침 없음
        - 차트 정상 렌더링
        - 한글 폰트 표시 여부
```

---

## 10. 유사 앱 적용 시 커스터마이징 포인트

### 10-1. 슬라이드 구성 변경

도메인에 맞게 슬라이드 수와 내용을 조정한다:

```typescript
// 보험료 산출 앱 예: 13장
// 손해보험 앱 예: 손해율·E/R·요율 계산 흐름에 맞게 슬라이드 재구성
// ML 모델 앱 예: 데이터→학습→평가→예측 흐름으로 재구성

const TOTAL_SLIDES = N;  // 실제 슬라이드 수에 맞게 변경
```

### 10-2. 데이터 소스 변경

```typescript
// 현재: CanvasModule[] 배열에서 직접 추출
export async function buildSlideReport(productName: string, modules: CanvasModule[])

// 유사 앱에서는 앱의 상태 타입에 맞게 시그니처 변경
export async function buildSlideReport(reportData: MyAppReportData)
```

### 10-3. 파이프라인 유효성 검증 변경

```typescript
// 현재: NetPremium/GrossPremium 중 하나가 Success여야 활성화
// 유사 앱: 해당 앱의 "최종 결과 모듈" 조건으로 변경
function isPipelineReady(state: MyAppState): { ready: boolean; reason?: string }
```

### 10-4. 컬러·폰트 변경

```typescript
// 브랜드 컬러나 도메인에 맞게 C, F 상수 교체
// 한글 앱: Malgun Gothic 유지 권장
// 영문 앱: Georgia/Calibri로 변경 가능
```

### 10-5. 버튼 위치

```tsx
// 현재: 상단 툴바에 삽입
<SlideReportButton productName={productName} modules={modules} />

// 유사 앱: 상세 페이지 헤더, 모달 하단, 사이드바 등 적합한 위치에 배치
```

---

## 11. 알려진 제약사항 및 해결책

| 제약 | 원인 | 해결책 |
|------|------|--------|
| 한글 폰트가 깨질 수 있음 | 시스템에 Malgun Gothic 미설치 | 맑은 고딕(Malgun Gothic)은 Windows 기본 폰트; Mac/Linux에서는 나눔고딕 등으로 대체 |
| 차트가 Office 외 뷰어에서 다르게 보임 | pptxgenjs 차트는 Office Open XML 기반 | Google Slides 등은 차트를 이미지로 렌더링 — 허용 범위 내 |
| 슬라이드당 과도한 행 수 | 표가 슬라이드 밖으로 잘림 | `maxRows = Math.floor((SLIDE_H - BODY_Y - 0.6) / ROW_H)` 로 제한, 초과 시 "N개 생략" 표시 |
| 대용량 데이터셋에서 느림 | 클라이언트에서 대량 XML 생성 | 샘플 데이터 5행 이하로 제한 (`rows.slice(0, 5)`) |

---

## 12. QA 기준

| 항목 | 기준 |
|------|------|
| 파일 생성 | `.pptx` 파일이 정상 다운로드됨 |
| 슬라이드 수 | 정의된 슬라이드 수 (`TOTAL_SLIDES`) 와 일치 |
| 데이터 반영 | 파이프라인 실행 결과가 슬라이드에 표시됨 |
| 미산출 처리 | 모듈 미실행 시 "※ 미산출" 안내 텍스트 표시 (크래시 없음) |
| 시각 QA | 텍스트 잘림 없음 / 요소 겹침 없음 / 한글 정상 표시 |
| 버튼 비활성화 | 파이프라인 미실행 시 버튼 회색 + tooltip 이유 표시 |
| 에러 처리 | 오류 시 버튼이 `❌ 오류` 상태로 전환, 토스트 메시지 표시 |
| 타입 오류 | `npx tsc --noEmit` 오류 0개 |

---

*파일명: `SLIDE_REPORT_PLAN.md` — 프로젝트 루트에 배치*
