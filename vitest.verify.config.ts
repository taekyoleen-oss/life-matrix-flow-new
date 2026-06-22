import { defineConfig } from "vitest/config";

// Phase 6 — 재현성 verify 하네스 전용 Vitest 설정.
// 기존 round-trip 테스트(vitest.config.ts, _workspace/tests)와 분리하여
// `npm run verify:pipelines` 로 verify/ 의 재현성 테스트만 실행한다.
export default defineConfig({
  test: {
    include: ["verify/**/*.{test,spec}.{ts,tsx}"],
    environment: "node",
    globals: true,
  },
});
