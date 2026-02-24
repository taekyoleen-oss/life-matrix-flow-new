# Supabase Samples (autoflow_samples) 설정

Samples 데이터는 **Supabase만** 사용합니다. 로컬 Samples API(Express + SQLite)는 사용하지 않으며, 목록/실행/관리는 모두 Supabase와 `samples.json` 폴백으로 동작합니다.

## 1. 환경 변수

`.env`에 다음 중 하나를 설정하세요.

- **옵션 A** (권장): Vite에서 사용
  ```
  VITE_SUPABASE_URL=https://your-project.supabase.co
  VITE_SUPABASE_ANON_KEY=your-anon-key
  ```
- **옵션 B**: 기존 키 그대로 사용 (vite.config에서 NEXT_PUBLIC_ 값으로 폴백)
  ```
  NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-anon-key
  ```

Supabase 대시보드 → Project Settings → API 에서 URL과 anon key를 복사하면 됩니다.

## 2. 데이터베이스 스키마 적용

Supabase 대시보드 → **SQL Editor**에서 아래 마이그레이션 파일 내용을 붙여넣고 실행하세요.

- `supabase/migrations/001_autoflow_samples_schema.sql`

또는 Supabase CLI가 있다면:

```bash
supabase db push
```

## 3. 테이블 구조 요약

| 테이블 | 설명 |
|--------|------|
| **sample_models** | 모델명 + 실행 플로우 JSON (모델명·입력데이터는 여기/별도 공간에서 DB로 불러옴) |
| **sample_input_data** | 입력 데이터 이름 + 내용 (텍스트/CSV 등) |
| **autoflow_samples** | 대구분(Life/ML/DFA), 카테고리, 개발자(이메일), 모델/입력데이터 참조, 모델 설명 |

- **대구분**: Life, ML, DFA 등 앱 구분 (기본값 Life)
- **카테고리**: 종신보험, 건강보험 등
- **개발자**: 이메일 주소
- **모델명**: `sample_models.name`
- **입력데이터**: `sample_input_data` 참조로 DB에서 불러옴

## 4. 동작 순서

1. Samples 메뉴를 열면 Supabase가 설정되어 있으면 **autoflow_samples** 목록을 조회합니다.
2. 목록에서 항목을 선택해 **모델 실행**을 누르면 해당 모델의 `file_content`(플로우 JSON)를 불러와 캔버스에 올리고 실행할 수 있습니다.
3. 샘플 관리에서는 Supabase에 등록된 샘플의 대구분·카테고리·개발자·설명 수정, 삭제, 파일 가져오기가 가능합니다.

Supabase가 없거나 설정되지 않았으면 `samples.json`만 사용합니다.

---

## 5. Whole Life + Risk_Rates 한 번에 등록 (시드 스크립트)

모델 파일(.lifx)과 입력 데이터(CSV)를 Supabase에 한 번에 넣으려면:

```bash
node scripts/seed-whole-life-to-supabase.mjs "모델파일경로" "데이터파일경로"
```

예 (종신보험 샘플):

```bash
node scripts/seed-whole-life-to-supabase.mjs "C:\Users\tklee\Downloads\Whole Life.lifx" "C:\Users\tklee\Downloads\Risk_Rates_Whole.csv"
```

- `sample_input_data`에 CSV 내용이 "Risk_Rates_Whole" 이름으로 등록됩니다.
- `sample_models`에 "Whole Life" 모델(modules + connections)이 등록됩니다.
- `autoflow_samples`에 카테고리 "종신보험", 대구분 "Life"로 연결됩니다.
