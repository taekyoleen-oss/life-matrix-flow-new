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
