import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    // Supabase: VITE_ 또는 NEXT_PUBLIC_ 값 노출
    const supabaseUrl = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || '';
    // Claude(Anthropic) 키는 개발 모드에서만 번들에 주입(개발자 폴백). 프로덕션 빌드에는 키를 포함하지 않는다.
    // 일반 사용자는 앱 내 'AI 키 설정'에서 본인 키를 직접 입력해야 AI 기능 사용 가능.
    const anthropicKey = mode === 'development' ? (env.ANTHROPIC_API_KEY || '') : '';
    // 고급기능 잠금 해제 비밀번호 (소프트 잠금). 미설정 시 빈 값.
    const advancedPassword = env.VITE_ADVANCED_PASSWORD || '';
    return {
      server: {
        port: 3005,
        host: '0.0.0.0',
        hmr: true,
        allowedHosts: 'all',
        headers: {
          'Cache-Control': 'no-store',
        },
        // CORS 프록시: 원격 CSV 로더(/api/proxy-csv)를 Express 서버(3002)로 전달.
        // 서버가 떠 있지 않으면 클라이언트가 직접 fetch 폴백을 시도한다.
        proxy: {
          '/api/proxy-csv': {
            target: env.VITE_API_URL || 'http://localhost:3002',
            changeOrigin: true,
          },
        },
      },
      preview: {
        host: '0.0.0.0',
        allowedHosts: 'all',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(anthropicKey),
        'process.env.ANTHROPIC_API_KEY': JSON.stringify(anthropicKey),
        'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
        'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseKey),
        'import.meta.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(supabaseUrl),
        'import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY': JSON.stringify(supabaseKey),
        'import.meta.env.VITE_ADVANCED_PASSWORD': JSON.stringify(advancedPassword),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      optimizeDeps: {
        include: ['xlsx'],
      },
      build: {
        commonjsOptions: {
          include: [/xlsx/, /node_modules/]
        }
      }
    };
});
