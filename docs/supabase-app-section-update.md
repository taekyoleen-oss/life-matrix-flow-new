# Supabase app_section "Life" → "LIFE" 일괄 수정

앱에서 대분류를 **LIFE**로 사용하므로, 기존에 **Life**로 저장된 행을 한 번만 **LIFE**로 바꿔 두면 됩니다.

## 방법 1: SQL Editor에서 실행 (권장)

1. [Supabase 대시보드](https://supabase.com/dashboard) 로그인
2. 해당 프로젝트 선택
3. 왼쪽 메뉴 **SQL Editor** 클릭
4. **New query** 선택 후 아래 SQL 붙여넣기
5. **Run** 실행

```sql
UPDATE autoflow_samples
SET app_section = 'LIFE'
WHERE app_section = 'Life';
```

6. 실행 결과에서 업데이트된 행 개수 확인

---

## 방법 2: Table Editor에서 수동 수정

1. Supabase 대시보드 → **Table Editor**
2. **autoflow_samples** 테이블 선택
3. **Filter**에서 `app_section` = `Life` 조건 추가
4. 해당 행들의 **app_section** 셀을 `Life` → `LIFE` 로 수정 후 저장

---

## 확인

수정 후 아래로 다시 조회해 보면 `app_section`이 `LIFE`로 나와야 합니다.

```sql
SELECT id, app_section, category, created_at
FROM autoflow_samples
WHERE app_section = 'LIFE'
ORDER BY created_at DESC;
```

이후 Life 앱 Samples 목록·카드 편집이 정상 동작합니다.
