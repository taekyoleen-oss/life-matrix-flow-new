/**
 * Node.js Express 서버 - Samples API
 * Life Matrix Flow 프로젝트용 샘플 관리 서버
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// better-sqlite3 빌드 확인 및 자동 빌드 시도
function checkAndBuildSqlite3() {
  const possiblePaths = [
    path.join(projectRoot, 'node_modules', '.pnpm', 'better-sqlite3@12.6.2', 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node'),
    path.join(projectRoot, 'node_modules', '.pnpm', 'better-sqlite3@12.6.2', 'node_modules', 'better-sqlite3', 'build', 'better_sqlite3.node'),
    path.join(projectRoot, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node'),
    path.join(projectRoot, 'node_modules', 'better-sqlite3', 'build', 'better_sqlite3.node'),
  ];
  
  const isBuilt = possiblePaths.some(p => fs.existsSync(p));
  
  if (isBuilt) {
    return true;
  }
  
  console.log('🔨 better-sqlite3 자동 빌드 시도 중...');
  try {
    // pnpm rebuild 시도
    try {
      execSync('pnpm rebuild better-sqlite3', {
        cwd: projectRoot,
        stdio: 'pipe',
        timeout: 120000 // 2분 타임아웃
      });
      if (possiblePaths.some(p => fs.existsSync(p))) {
        console.log('✓ better-sqlite3 자동 빌드 성공!');
        return true;
      }
    } catch (e) {
      // 무시
    }
    
    // npm rebuild 시도
    try {
      execSync('npm rebuild better-sqlite3', {
        cwd: projectRoot,
        stdio: 'pipe',
        timeout: 120000
      });
      if (possiblePaths.some(p => fs.existsSync(p))) {
        console.log('✓ better-sqlite3 자동 빌드 성공!');
        return true;
      }
    } catch (e) {
      // 무시
    }
  } catch (error) {
    // 무시
  }
  
  return false;
}

// 서버 시작 전 빌드 확인
checkAndBuildSqlite3();

const app = express();
const PORT = process.env.PORT || process.env.SERVER_PORT || 3002;
const isProduction = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 샘플 관리 API 라우트
import samplesRouter from './routes/samples.js';
app.use('/api/samples', samplesRouter);

// ============================================================================
// CORS 프록시: 원격 CSV/요율표를 브라우저 CORS 제약 없이 가져온다.
//   GET /api/proxy-csv?url=https://example.com/standard_life_table.csv
//   - URL 데이터 로더(ParameterInputModal LoadData)의 "URL" 소스에서 호출.
//   - 응답 본문(텍스트)을 그대로 반환 → 클라이언트는 파일 업로드와 동일 파서 사용.
// ============================================================================
app.get('/api/proxy-csv', async (req, res) => {
  const target = req.query.url;
  if (!target || typeof target !== 'string') {
    return res.status(400).json({ error: 'url 쿼리 파라미터가 필요합니다.' });
  }
  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return res.status(400).json({ error: '유효하지 않은 URL 형식입니다.' });
  }
  // http/https 만 허용 (SSRF 표면 축소: file:, ftp: 등 차단)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return res.status(400).json({ error: 'http(s) URL만 허용됩니다.' });
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000); // 20초 타임아웃
    const upstream = await fetch(target, {
      signal: controller.signal,
      headers: { 'User-Agent': 'life-matrix-flow-proxy' },
    });
    clearTimeout(timer);
    if (!upstream.ok) {
      return res
        .status(502)
        .json({ error: `원격 서버 응답 오류: ${upstream.status} ${upstream.statusText}` });
    }
    const text = await upstream.text();
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.set('Cache-Control', 'no-store');
    return res.send(text);
  } catch (err) {
    const msg = err && err.name === 'AbortError' ? '원격 요청 시간 초과(20초).' : (err && err.message) || '원격 데이터를 가져오지 못했습니다.';
    return res.status(502).json({ error: msg });
  }
});

// 프로덕션: 빌드된 프론트엔드 정적 파일 서빙
if (isProduction) {
  const distPath = path.join(projectRoot, 'dist');
  app.use(express.static(distPath));
  // SPA 폴백: API가 아닌 모든 요청은 index.html 반환
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ============================================================================
// 서버 시작
// ============================================================================

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`- Samples API: http://localhost:${PORT}/api/samples`);
    if (isProduction) console.log(`- 프론트엔드: http://localhost:${PORT}`);
    console.log(`\n⚠️  참고: better-sqlite3가 빌드되지 않은 경우 DB 기능이 비활성화됩니다.`);
    console.log(`   Samples는 samples.json 파일에서만 로드됩니다.`);
});

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`\n❌ 포트 ${PORT}가 이미 사용 중입니다.`);
        console.error(`다음 중 하나를 시도하세요:`);
        console.error(`1. 기존 서버 프로세스를 종료: Get-Process -Name node | Stop-Process -Force`);
        console.error(`2. 다른 포트 사용: SERVER_PORT=3003 pnpm dev`);
        console.error(`3. 잠시 기다린 후 다시 시도 (포트가 해제될 때까지)`);
        process.exit(1);
    } else {
        console.error('서버 시작 오류:', error);
        process.exit(1);
    }
});
