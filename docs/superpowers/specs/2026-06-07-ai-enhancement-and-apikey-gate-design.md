# AI 활용 고도화 + API 키 입력 게이트 설계

- 작성일: 2026-06-07
- 대상 앱: life-matrix-flow (노드 기반 보험료 산출 파이프라인 편집기)
- 범위: (1) API 키 입력 게이트 **구현**, (2) AI 활용 고도화 **로드맵 설계(문서)**

---

## 1. 배경 / 문제

런타임에서 Gemini를 호출하는 곳은 정확히 2곳이다.

| 위치 | 기능 | 모델 | 방식 |
|------|------|------|------|
| `App.tsx` `handleGeneratePipelineFromGoal` | 목표 자연어 → 파이프라인 자동 생성 | gemini-2.5-flash | 마크다운 DSL 반환 → `parseMarkdownModel` 정규식 파싱 |
| `components/NetPremiumPreviewModal.tsx` `handleInterpret` | 산출 결과 자연어 해석 | gemini-2.5-flash | 텍스트 프롬프트 → 텍스트 |

두 곳 모두 `process.env.API_KEY`를 사용하며, 이 값은 `vite.config.ts`의 `define`이 빌드 시
`GEMINI_API_KEY`를 **클라이언트 번들에 평문으로 주입**한다. 따라서 배포 시 누구나 브라우저에서
키를 추출해 무제한 사용할 수 있다.

목표:
1. 일반 사용자에게는 키를 제공하지 않고, **사용자가 자신의 Gemini API 키를 입력해야만** AI 기능 사용 가능.
2. AI 활용 영역 자체를 더 고도화하기 위한 단계적 로드맵을 정의.

---

## 2. Part 2 — API 키 입력 게이트 (구현 대상)

### 2.1 결정 사항
- **키 저장:** `localStorage`(영구). 재방문 시 재입력 불필요. 공용 PC 대비 삭제 버튼 제공.
- **개발자 폴백:** `import.meta.env.DEV`(개발 모드)에서만 `.env`의 키를 폴백으로 사용. 프로덕션 번들에는 키 미포함.
- **키 모달 진입점:** 헤더 상시 버튼(🔑) + AI 실행 시 키 없으면 자동 오픈.
- **연결 테스트:** 저장 시 가벼운 테스트 호출로 키 유효성 검증(+ 검증 없이 저장 옵션).

### 2.2 아키텍처: 단일 컨텍스트가 키 상태·모달·클라이언트 발급을 소유

```
<ApiKeyProvider>                      (contexts/ApiKeyContext.tsx)
   상태: apiKey(localStorage 동기화), isModalOpen
   노출(useApiKey): { apiKey, hasKey, setKey, clearKey, openKeyModal, ensureClient }
   렌더: <ApiKeyModal/>               (provider 레벨 — 어디서든 openKeyModal 호출 가능)
      └─ App / NetPremiumPreviewModal 등 모든 소비자가 useApiKey() 사용
```

`ensureClient()` 계약:
- 키 있음 → `new GoogleGenAI({ apiKey })` 인스턴스 반환.
- 키 없음 → `openKeyModal()` 호출 후 `null` 반환.

호출부 공통 패턴:
```ts
const ai = ensureClient();
if (!ai) return;            // 키 모달이 열림
const res = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt });
```

### 2.3 신규 / 변경 파일

| 파일 | 구분 | 내용 |
|------|------|------|
| `utils/apiKey.ts` | 신규 | 순수 저장 서비스. `STORAGE_KEY='gemini_api_key'`. `getStoredKey()`(없으면 dev 한정 `process.env.API_KEY` 폴백), `setStoredKey`, `clearStoredKey`, `maskKey` |
| `contexts/ApiKeyContext.tsx` | 신규 | `ApiKeyProvider` + `useApiKey()`. 상태·모달·`ensureClient` 제공. `ApiKeyModal` 렌더 |
| `components/ApiKeyModal.tsx` | 신규 | 마스킹 입력(표시 토글), 발급 링크, 보안 경고, 저장·삭제, 연결 테스트 |
| `components/icons.tsx` | 변경 | `KeyIcon` 추가 |
| `vite.config.ts` | 변경 | `process.env.API_KEY`/`GEMINI_API_KEY` define을 **dev에서만 키, prod에선 `''`** 로 |
| `index.tsx` | 변경 | `<ApiKeyProvider>`로 `<App/>` 래핑(ThemeProvider 안쪽) |
| `App.tsx` | 변경 | `useApiKey()` 사용. `handleGeneratePipelineFromGoal`에서 `ensureClient` 게이트. 헤더에 🔑 버튼(상태 표시) |
| `components/NetPremiumPreviewModal.tsx` | 변경 | `handleInterpret`에서 `ensureClient` 게이트. 키 없을 때 인라인 안내 |

### 2.4 보안 고지 (모달 내 문구)
- 키는 이 브라우저의 localStorage에만 저장되며 서버로 전송되지 않음.
- 호출은 브라우저에서 Google API로 직접 전송됨.
- 공용 PC에서는 사용 후 "키 삭제" 권장.

### 2.5 엣지 케이스
- 키 미입력 + AI 실행 → 키 모달 자동 오픈, 작업 중단.
- 잘못된 키 → 호출 401/403 → 사용자에게 "키가 유효하지 않습니다" 안내 + 모달 재오픈 유도.
- dev 모드 + `.env` 키 존재 → 별도 입력 없이 동작(개발 편의).

---

## 3. Part 1 — AI 활용 고도화 로드맵 (설계만)

핵심 원칙: 현재 "마크다운 → 정규식 파싱" 경로의 깨지기 쉬움을 제거하고, 앱의 "로직 완결성" 목표와
AI를 직접 결합한다.

### Phase 1 — 생성 신뢰성 (최우선)
- **구조화 출력 전환:** `responseSchema`(JSON 모드)로 `ModuleType`·포트 계약에 맞는 타입 보장 JSON을 받게 하여
  정규식 파싱 실패를 구조적으로 제거. 기존 `parseMarkdownModel` → `parseModelJson`으로 대체(폴백 유지).
- **systemInstruction 분리 + 저온도(≈0.1):** 계리 도메인 컨텍스트를 system에 고정, 결정론적 생성.
- 산출물: 파이프라인 생성 성공률·재현성 향상.

### Phase 2 — 검증/품질
- **AI 파이프라인 검증·감사:** 생성·편집 결과의 연결 누락·포트 불일치·로직 완결성을 AI가 점검
  (기존 `pipeline-logic-auditor` 하네스와 결합).
- **모델 선택제(flash ↔ pro):** 복잡 추론은 `gemini-2.5-pro`, 빠른 해석은 `flash`. 사용자 선택 + 비용 표시.
- **thinking budget 활성화:** 복잡 파이프라인 생성 품질 향상.

### Phase 3 — 활용 확장
- **대화형 편집:** "납입기간 20년으로 바꿔줘" → 기존 `handlePatchParametersFromDSL` 재사용해 파라미터 패치.
- **파라미터 값 추천:** 구조뿐 아니라 연령·성별·이율 등 기본값 추천.
- **결과 해석 고도화:** 시나리오 간 비교·민감도·이상치 감지.
- **스트리밍(generateContentStream) + 프롬프트 캐싱 + 토큰/비용 가시화.**

### 우선순위 요약
`Phase 1(구조화 출력) → Phase 2(AI 검증) → Phase 3(대화형/스트리밍)`.
Phase 1·2가 본 앱의 로직 완결성 목표와 가장 직결되므로 먼저 구현 권장.

---

## 4. 테스트 / 검증 계획

### Part 2 (구현)
- 빌드 검증: `npm run build` 후 산출 번들에 `GEMINI_API_KEY` 값 문자열이 포함되지 않음을 확인.
- 수동: 키 미입력 상태에서 "AI 생성"/"AI 결과 해석" → 키 모달 오픈 확인.
- 키 입력·저장 → 새로고침 후에도 유지(localStorage) 확인.
- "키 삭제" → 다시 게이트 동작 확인.
- dev 모드 `.env` 폴백 동작 확인.

### Part 1 (설계)
- 각 Phase는 별도 spec → plan → 구현 사이클로 진행.

---

## 5. 비범위 (Out of scope)
- 서버/프록시 경유 키 보관(향후 Supabase Edge Function 옵션으로 검토 가능).
- Part 1의 실제 구현(본 작업은 설계 문서화까지).
