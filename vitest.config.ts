import { defineConfig } from 'vitest/config';

// Round-trip / 단위 테스트 전용 설정.
// 앱 빌드(vite.config.ts)와 분리하여 빌드 파이프라인에 영향을 주지 않는다.
export default defineConfig({
  test: {
    // round-trip 테스트는 _workspace/tests 에 둔다.
    include: ['_workspace/tests/**/*.{test,spec}.{ts,tsx}'],
    environment: 'node',
    globals: true,
  },
});
