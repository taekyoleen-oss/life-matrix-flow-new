# 개발계획서: 모델 보고 슬라이드 내보내기 기능

> **문서 버전**: v1.0  
> **작성일**: 2025-07-01  
> **대상 앱**: Life Matrix Flow (Next.js 14 + Supabase + Vercel)  
> **구현 방식**: Claude Code가 이 계획서를 읽고 순서대로 구현

---

## 1. 기능 목적

보험료·책임준비금 산출 모델의 **입력 변수 → 모듈 구성 → DSL 실행 → 산출 결과** 전 과정을,  
모델 상세 페이지의 버튼 한 번으로 `.pptx` 보고 슬라이드로 내보낸다.

계리사·언더라이터·상품팀이 산출 근거를 **외부에 보고**하거나 **내부 검토**할 때 사용한다.

---

## 2. 사용자 경험 (UX 흐름)

```
모델 상세 페이지 접속
        │
        ▼
우측 상단 "📊 슬라이드 보고서 내보내기" 버튼 노출
        │  클릭
        ▼
버튼 상태: "⏳ 생성 중…" (로딩)
        │  약 2~4초
        ▼
브라우저 자동 다운로드
파일명: {모델명}_report.pptx
        │
        ▼
버튼 상태: "✅ 다운로드 완료" → 2.5초 후 원상복구
```

---

## 3. 슬라이드 구성 (8장)

| 순서 | 슬라이드 제목 | 배경 | 핵심 시각 요소 |
|------|--------------|------|---------------|
| 1 | 표지 | 다크 네이비 `#1E2761` | 모델명, 작성자, 날짜, 요약 |
| 2 | 입력 변수 | 라이트 `#F4F7FB` | 4열 테이블 (변수명/값/단위/설명) |
| 3 | 모듈 구성 | 라이트 | 아이콘 카드 그리드 (최대 6개) |
| 4 | DSL 실행 흐름 | 다크 네이비 | 좌: 단계별 플로우 / 우: DSL 코드 박스 |
| 5 | 보험료 산출 결과 | 라이트 | 순보험료·영업보험료 빅넘버 카드 |
| 6 | 책임준비금 추이 | 다크 네이비 | LINE 차트 + 연도별 키 수치 |
| 7 | 민감도 분석 | 라이트 | 영향도 컬러 테이블 (High/Medium/Low) |
| 8 | 부록·가정 사항 | 다크 네이비 | 가정 리스트 + 자동생성 면책 문구 |

**디자인 원칙**
- 컬러: 딥네이비 `1E2761` + 골드 `E8A020` + 아이스블루 `CADCFC`
- 폰트: 헤더 Georgia / 본문 Calibri / 코드 Consolas
- 다크·라이트 슬라이드 교차 (샌드위치 구조)
- 모든 슬라이드 우하단에 `{모델명} | N / 8` 푸터

---

## 4. 데이터 구조

### 4-1. TypeScript 타입 (`types/model-report.ts`)

```typescript
export interface ModelInput {
  name: string;         // "피보험자 연령"
  value: string;        // "35"
  unit?: string;        // "세"
  description: string;  // "계약 시점 기준 연령"
}

export interface ModelModule {
  id: string;
  name: string;         // "사망률표 모듈"
  icon: string;         // "💀"
  role: string;         // "KNS2019 경험생명표 적용"
  config?: Record<string, string>;
}

export interface DslStep {
  order: number;
  command: string;      // "LOAD mortality_table(KNS2019)"
  description: string;  // "사망률표 로드"
  status: "success" | "warning" | "error";
}

export interface SensitivityRow {
  variable: string;
  baseValue: string;
  changedValue: string;
  premiumChange: string;
  impact: "low" | "medium" | "high";
}

export interface ModelReportData {
  name: string;
  author: string;
  date: string;
  summary?: string;
  inputs: ModelInput[];
  modules: ModelModule[];
  dslCode: string;
  dslSteps: DslStep[];
  results: {
    netPremium: number;
    grossPremium: number;
    premiumRate: number;
    reserveByYear: number[];
    surrenderByYear?: number[];
  };
  sensitivity?: SensitivityRow[];
  assumptions: string[];
}
```

### 4-2. Supabase → ModelReportData 변환 규칙

| ModelReportData 필드 | Supabase 테이블/컬럼 |
|---------------------|---------------------|
| `name` | `models.name` |
| `author` | `models.author_name` (또는 `profiles.full_name` JOIN) |
| `date` | `models.created_at` → `toLocaleDateString("ko-KR")` |
| `summary` | `models.summary` |
| `inputs` | `model_inputs` 테이블 전체 |
| `modules` | `model_modules` 테이블 전체 |
| `dslCode` | `models.dsl_code` |
| `dslSteps` | `model_dsl_steps` 테이블 전체 |
| `results` | `model_results` 테이블 단일 행 |
| `sensitivity` | `model_sensitivity` 테이블 전체 (없으면 `undefined`) |
| `assumptions` | `model_assumptions` 테이블 → `.map(a => a.content)` |

> Supabase 테이블 구조가 다를 경우 변환 로직만 수정. 타입과 슬라이드 로직은 그대로 유지.

---

## 5. 구현 파일 목록

```
프로젝트 루트/
├── types/
│   └── model-report.ts              ← [신규] 타입 정의
│
├── lib/
│   └── slides/
│       ├── slideHelpers.ts           ← [신규] 색상·폰트·헬퍼 상수
│       └── buildReportSlides.ts      ← [신규] 8장 슬라이드 빌더 핵심 로직
│
├── app/
│   └── api/
│       └── export-slide/
│           └── route.ts              ← [신규] POST API 엔드포인트
│
├── components/
│   └── ExportSlideButton.tsx         ← [신규] 다운로드 버튼 컴포넌트
│
└── app/
    └── models/
        └── [id]/
            └── page.tsx              ← [수정] ExportSlideButton 삽입
```

---

## 6. 각 파일 구현 명세

### 6-1. `types/model-report.ts`
- 섹션 4-1의 타입을 그대로 작성
- `export` 키워드 필수

---

### 6-2. `lib/slides/slideHelpers.ts`

**포함 내용**
```typescript
// 컬러 팔레트 (# 없는 6자리 hex — pptxgenjs 규칙)
export const C = {
  navy: "1E2761", navyLight: "2E3A7A",
  ice: "4A90D9", iceLight: "CADCFC",
  white: "FFFFFF", offWhite: "F4F7FB",
  gray: "64748B", darkGray: "1E293B",
  accent: "E8A020",
  cardBg: "FFFFFF", cardBorder: "D4E3F7",
  success: "22C55E", warning: "F59E0B", error: "EF4444",
  codeBase: "0A0F1E", codeLine: "2A3550",
};

// 폰트
export const F = { title: "Georgia", body: "Calibri", mono: "Consolas" };

// 섀도우 — 매 호출마다 새 객체 반환 (pptxgenjs 객체 재사용 버그 방지)
export const makeShadow = () => ({
  type: "outer", color: "1E2761", blur: 8, offset: 3, angle: 135, opacity: 0.10,
});

// 라이트 슬라이드 공통 헤더 바 추가 함수
export function addSlideHeader(slide, title, subtitle?) { ... }

// 슬라이드 번호 푸터 추가 함수
export function addFooter(slide, modelName, pageNum, total, dark?) { ... }

// DSL 상태별 색상 반환
export function statusColor(status: "success"|"warning"|"error") { ... }

// 원화 포맷 (억원/만원 자동 변환)
export function formatKRW(value: number): string { ... }
```

**중요 규칙**
- hex 색상에 `#` 절대 사용 금지 → pptxgenjs 파일 손상
- `opacity`는 반드시 별도 속성으로 분리 (8자리 hex 금지)

---

### 6-3. `lib/slides/buildReportSlides.ts`

**함수 시그니처**
```typescript
export async function buildReportSlides(model: ModelReportData): Promise<Buffer>
```

**슬라이드별 빌더 함수 분리**
```typescript
function buildCoverSlide(pres, model)       // Slide 1
function buildInputsSlide(pres, model)      // Slide 2
function buildModulesSlide(pres, model)     // Slide 3
function buildDslSlide(pres, model)         // Slide 4
function buildPremiumSlide(pres, model)     // Slide 5
function buildReserveSlide(pres, model)     // Slide 6
function buildSensitivitySlide(pres, model) // Slide 7 (sensitivity 있을 때만)
function buildAssumptionsSlide(pres, model) // Slide 8
```

**Slide 4 (DSL) 코드 컬러링 규칙**
| 접두사 | 색상 |
|--------|------|
| `//` (주석) | `6B8CC7` (회색-파랑) |
| `SET` | `4FC1FF` (밝은 파랑) |
| `LOAD` | `CE9178` (연한 주황) |
| `RUN` | `DCDCAA` (연한 노랑) |
| `EXPORT` | `B5CEA8` (연한 초록) |
| 기타 | `FFFFFF` (흰색) |

**Slide 6 (차트) 설정**
```typescript
s.addChart("line", [{
  name: "책임준비금",
  labels: reserves.map((_, i) => `${i+1}년`),
  values: reserves,
}], {
  chartColors: ["E8A020"],          // 골드
  chartArea: { fill: { color: "0D1530" } },
  valGridLine: { color: "2A3550", size: 0.5 },
  catGridLine: { style: "none" },
  lineSize: 2.5, lineSmooth: true,
  showLegend: false,
});
```

**pptxgenjs 필수 주의사항**
- `pres.write({ outputType: "nodebuffer" })` 로 반환
- 옵션 객체는 매 호출마다 새로 생성 (`makeShadow()` 패턴)
- `bullet: true` 만 사용, 유니코드 `•` 금지
- `breakLine: true` 멀티라인 텍스트에 필수

---

### 6-4. `app/api/export-slide/route.ts`

```typescript
export async function POST(req: NextRequest) {
  // 1. body.model 파싱
  // 2. model.name, model.results 필수 검증 → 400 반환
  // 3. buildReportSlides(model) 호출
  // 4. Content-Type: application/vnd.openxmlformats-officedocument.presentationml.presentation
  // 5. Content-Disposition: attachment; filename="{인코딩된 모델명}_report.pptx"
  // 6. Cache-Control: no-store
  // 오류 시 500 + JSON { error: "..." }
}
```

---

### 6-5. `components/ExportSlideButton.tsx`

**Props**
```typescript
interface Props {
  model: ModelReportData;
  label?: string;    // 기본: "📊 슬라이드 보고서 내보내기"
  className?: string;
}
```

**상태 전환**
```
idle    → "📊 슬라이드 보고서 내보내기"  bg-[#1E2761]
loading → "⏳ 생성 중…"                  opacity-70, disabled
done    → "✅ 다운로드 완료"              bg-[#22C55E], 2.5초 후 idle
error   → "❌ 오류 — 다시 시도"          bg-[#EF4444], 3초 후 idle
```

**다운로드 로직**
```typescript
const blob = await res.blob();
const url  = URL.createObjectURL(blob);
const a    = document.createElement("a");
a.href     = url;
a.download = `${model.name}_report.pptx`;
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(url);
```

---

### 6-6. `app/models/[id]/page.tsx` 수정

기존 페이지 상단에 버튼 삽입:

```tsx
import { ExportSlideButton } from "@/components/ExportSlideButton";
import type { ModelReportData } from "@/types/model-report";

// Supabase에서 모델 로드 후 변환
const reportData: ModelReportData = { /* 섹션 4-2 변환 규칙 적용 */ };

// JSX 헤더 영역
<div className="flex items-center justify-between mb-6">
  <h1 className="text-2xl font-bold">{model.name}</h1>
  <ExportSlideButton model={reportData} />
</div>
```

---

## 7. 구현 순서 (Claude Code 실행 순서)

```
Step 1. npm install pptxgenjs

Step 2. types/model-report.ts 생성

Step 3. lib/slides/slideHelpers.ts 생성

Step 4. lib/slides/buildReportSlides.ts 생성

Step 5. app/api/export-slide/route.ts 생성

Step 6. components/ExportSlideButton.tsx 생성

Step 7. app/models/[id]/page.tsx 수정 (버튼 삽입)

Step 8. npx tsc --noEmit (타입 오류 확인)

Step 9. 로컬 테스트
        curl -X POST http://localhost:3000/api/export-slide \
          -H "Content-Type: application/json" \
          -d @test-model.json \
          --output test-report.pptx

Step 10. 생성된 pptx → pdf → jpg 변환 후 8장 시각 QA
         (겹침·잘림·색상 대비·빈 슬라이드 여부 확인)
         문제 발견 시 수정 후 재생성
```

---

## 8. 테스트 샘플 데이터 (`test-model.json`)

```json
{
  "model": {
    "name": "종신보험 A형 보험료 산출 모델",
    "author": "홍길동 계리사",
    "date": "2025-07-01",
    "summary": "35세 남성 종신보험 순보험료 및 연도별 책임준비금 산출",
    "inputs": [
      { "name": "피보험자 연령", "value": "35",      "unit": "세",  "description": "계약 시점 기준 연령" },
      { "name": "성별",          "value": "남성",    "unit": "",    "description": "피보험자 성별" },
      { "name": "보험기간",      "value": "종신",    "unit": "",    "description": "보험 적용 기간" },
      { "name": "납입기간",      "value": "20",      "unit": "년",  "description": "보험료 납입 기간" },
      { "name": "보험가입금액",  "value": "100,000", "unit": "천원","description": "사망 시 지급 보험금" },
      { "name": "예정이자율",    "value": "2.5",     "unit": "%",   "description": "적용 할인율 (연 단위)" },
      { "name": "사망률표",      "value": "KNS2019", "unit": "",    "description": "국민생명표 2019년 기준" },
      { "name": "사업비율",      "value": "35 / 5",  "unit": "%",   "description": "신계약비 / 유지비" }
    ],
    "modules": [
      { "id": "m1", "name": "사망률표 모듈", "icon": "💀",
        "role": "KNS2019 경험생명표 로드 및 연령별 qx 계산",
        "config": { "table": "KNS2019", "interpolation": "linear" } },
      { "id": "m2", "name": "이자율 모듈",   "icon": "📈",
        "role": "예정이자율 2.5% 적용, 연도별 할인계수 vt 산출",
        "config": { "rate": "0.025", "compound": "annual" } },
      { "id": "m3", "name": "해약률 모듈",   "icon": "🚪",
        "role": "표준해약률 적용, 연도별 해약환급금 계산",
        "config": { "type": "standard" } },
      { "id": "m4", "name": "급부 모듈",     "icon": "🔢",
        "role": "사망보험금 1억원, 사망즉시지급 조건",
        "config": { "death_benefit": "100000000", "payment": "immediate" } },
      { "id": "m5", "name": "보험료 모듈",   "icon": "💰",
        "role": "수지상등 원칙 기준 순보험료 및 영업보험료 산출",
        "config": { "principle": "equivalence", "loading": "0.35/0.05" } },
      { "id": "m6", "name": "준비금 모듈",   "icon": "📋",
        "role": "순보험료식 책임준비금, Zillmer 방식 초년도 조정",
        "config": { "method": "net_premium", "zillmer": "true" } }
    ],
    "dslCode": "// 종신보험 A형 보험료 산출 워크플로우\nSET age = 35, gender = M\nSET interest_rate = 0.025\nSET benefit = 100000000\n\nLOAD mortality_table(KNS2019)\nLOAD lapse_rate(standard)\n\nRUN benefit_module(death = benefit)\nRUN premium_module(type = net, loading = [0.35, 0.05])\nRUN reserve_module(method = zillmer)\n\nEXPORT result → slide_report",
    "dslSteps": [
      { "order": 1, "command": "SET age=35, gender=M, interest=0.025", "description": "기본 변수 설정",   "status": "success" },
      { "order": 2, "command": "LOAD mortality_table(KNS2019)",         "description": "사망률표 로드",   "status": "success" },
      { "order": 3, "command": "LOAD lapse_rate(standard)",             "description": "해약률 로드",     "status": "success" },
      { "order": 4, "command": "RUN benefit_module(death=100000000)",   "description": "급부 계산",       "status": "success" },
      { "order": 5, "command": "RUN premium_module(type=net)",          "description": "순보험료 산출",   "status": "success" },
      { "order": 6, "command": "RUN reserve_module(method=zillmer)",    "description": "책임준비금 산출", "status": "success" }
    ],
    "results": {
      "netPremium":   124500,
      "grossPremium": 138200,
      "premiumRate":  0.001382,
      "reserveByYear": [
        820000, 1680000, 2590000, 3550000, 4570000,
        5650000, 6800000, 8020000, 9320000, 10700000,
        12180000, 13760000, 15450000, 17260000, 19200000,
        21280000, 23510000, 25900000, 28460000, 31210000
      ]
    },
    "sensitivity": [
      { "variable": "예정이자율", "baseValue": "2.5%", "changedValue": "3.0%", "premiumChange": "-4.1%", "impact": "high" },
      { "variable": "예정이자율", "baseValue": "2.5%", "changedValue": "2.0%", "premiumChange": "+4.8%", "impact": "high" },
      { "variable": "사망률",     "baseValue": "KNS2019", "changedValue": "KNS2019 +10%", "premiumChange": "+3.2%", "impact": "medium" },
      { "variable": "납입기간",   "baseValue": "20년", "changedValue": "15년", "premiumChange": "+18.4%", "impact": "medium" },
      { "variable": "사업비율",   "baseValue": "35%", "changedValue": "40%",  "premiumChange": "+2.1%",  "impact": "low" }
    ],
    "assumptions": [
      "경험생명표 KNS2019 적용 (금융감독원 승인 기준)",
      "예정이자율 연 2.5% 복리 적용",
      "신계약비 35%, 유지비 5% 사업비 가정",
      "표준해약률 (생명보험협회 기준) 적용",
      "Zillmer 방식으로 초년도 사업비 조정",
      "수지상등 원칙 기준 순보험료 산출"
    ]
  }
}
```

---

## 9. QA 기준

| 항목 | 기준 |
|------|------|
| 파일 생성 | `.pptx` 파일이 정상 생성되어야 함 |
| 슬라이드 수 | 8장 (sensitivity 없으면 7장) |
| 데이터 반영 | 모든 inputs, modules, dslSteps, results 가 슬라이드에 표시 |
| 시각 QA | 텍스트 잘림 없음 / 요소 겹침 없음 / 색상 대비 충분 |
| 타입 오류 | `npx tsc --noEmit` 오류 0개 |
| 다운로드 | 버튼 클릭 시 자동 다운로드, 파일명 한글 정상 처리 |
| 에러 처리 | API 오류 시 버튼이 `❌ 오류` 상태로 전환 |

---

## 10. Claude Code 실행 프롬프트

> 아래를 Claude Code에 그대로 붙여넣어 구현을 시작합니다.

```
먼저 /mnt/skills/public/pptx/SKILL.md 와
/mnt/skills/public/pptx/pptxgenjs.md 를 읽어주세요.

그 다음 이 계획서(SLIDE_REPORT_PLAN.md)의 섹션 7 구현 순서대로
Step 1부터 Step 10까지 순서대로 진행해 주세요.

각 Step 완료 후 다음 Step으로 넘어가기 전에
완료 여부를 확인하고 오류가 있으면 그 자리에서 수정하세요.

pptxgenjs 필수 준수사항:
- hex 색상에 # 절대 사용 금지
- shadow opacity 는 반드시 opacity 속성으로 분리
- 옵션 객체는 매 호출마다 새로 생성 (재사용 금지)
- bullet 은 bullet: true 만 사용, 유니코드 • 금지
- 멀티라인 텍스트는 breakLine: true 필수
```

---

*파일명: `SLIDE_REPORT_PLAN.md` — 앱 루트 또는 `docs/` 폴더에 배치*
