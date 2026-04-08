import PptxGenJS from 'pptxgenjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveOutputPath(dir, baseName = 'Presentation') {
  let candidate = path.join(dir, `${baseName}.pptx`);
  if (!fs.existsSync(candidate)) return candidate;
  let n = 2;
  while (true) {
    candidate = path.join(dir, `${baseName}_${n}.pptx`);
    if (!fs.existsSync(candidate)) return candidate;
    n++;
  }
}

// ─── 레이아웃 상수 ────────────────────────────────────────────────────────────
const SLIDE = { W: 13.33, H: 7.5 };
const L = {
  HDR: 1.05,
  Y0:  1.12,
  YB:  6.80,
  XL:  0.40,
  XR:  12.93,
};
L.W  = L.XR - L.XL;
L.AH = L.YB - L.Y0;

const C = {
  navy:    '1E3A5F',
  blue:    '2563EB',
  purple:  '7C3AED',
  purple2: 'EDE9FE',
  black:   '111827',
  dark:    '374151',
  sub:     '6B7280',
  border:  'E5E7EB',
  card:    'F9FAFB',
  white:   'FFFFFF',
  green:   '059669',
  greenBg: 'ECFDF5',
  amber:   'D97706',
  amberBg: 'FFFBEB',
  blueBg:  'EFF6FF',
};
const F = 'Noto Sans KR';

function calcCardH(startY, rows, gap = 0.10, margin = 0.05) {
  const available = (L.YB - margin) - startY;
  return Math.max((available - gap * (rows - 1)) / rows, 0.40);
}

function assertInBounds(y, h, label) {
  const bottom = y + h;
  if (bottom > L.YB + 0.01) console.warn(`⚠ OVERFLOW [${label}]: ${bottom.toFixed(3)} > ${L.YB}`);
}

function addHeader(s, num, title) {
  s.addShape('rect', { x: 0, y: 0, w: SLIDE.W, h: L.HDR, fill: { color: C.navy }, line: { width: 0 } });
  s.addText(`${num}  ${title}`, {
    x: L.XL, y: 0, w: L.W, h: L.HDR,
    fontSize: 30, bold: true, color: C.white, fontFace: F,
    valign: 'middle', fit: 'shrink',
  });
}

// ─── PPT 초기화 ───────────────────────────────────────────────────────────────
const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';
pptx.title  = '보험료 자동 산출 파이프라인 빌더';

// ══════════════════════════════════════════════════════════════════
// 슬라이드 1 — 표지
// ══════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  // 배경 상단 네이비 블록
  s.addShape('rect', { x: 0, y: 0, w: SLIDE.W, h: 4.0, fill: { color: C.navy }, line: { width: 0 } });
  // 장식 원
  s.addShape('ellipse', { x: 10.5, y: -0.8, w: 3.5, h: 3.5, fill: { color: '243F6A' }, line: { width: 0 } });
  s.addShape('ellipse', { x: -0.8, y: 2.0,  w: 2.5, h: 2.5, fill: { color: '243F6A' }, line: { width: 0 } });

  s.addText('보험료 자동 산출', {
    x: 0.8, y: 0.6, w: 11.0, h: 0.90,
    fontSize: 46, bold: true, color: C.white, fontFace: F,
    valign: 'middle', fit: 'shrink',
  });
  s.addText('파이프라인 빌더', {
    x: 0.8, y: 1.45, w: 11.0, h: 0.90,
    fontSize: 46, bold: true, color: 'A5C8FF', fontFace: F,
    valign: 'middle', fit: 'shrink',
  });
  s.addText('Life Insurance Premium Calculation Pipeline Builder', {
    x: 0.8, y: 2.40, w: 11.0, h: 0.50,
    fontSize: 20, color: '93C5FD', fontFace: F, italic: true,
    valign: 'middle', fit: 'shrink',
  });
  s.addText('위험률 데이터 로딩부터 순보험료·영업보험료·준비금 산출까지\n비주얼 파이프라인으로 자동화 · Gemini AI 파이프라인 생성 지원', {
    x: 0.8, y: 4.40, w: 11.0, h: 1.10,
    fontSize: 19, color: C.dark, fontFace: F,
    valign: 'top', wrap: true, fit: 'shrink',
    lineSpacingMultiple: 1.4,
  });
  // 기술 뱃지
  const badges = ['React 19', 'TypeScript', 'Vite', 'Gemini AI', 'Supabase', 'pptxgenjs'];
  const bw = 1.70, bh = 0.42, bGap = 0.18;
  const totalBW = badges.length * bw + (badges.length - 1) * bGap;
  const bx0 = (SLIDE.W - totalBW) / 2;
  badges.forEach((b, i) => {
    const bx = bx0 + i * (bw + bGap);
    s.addShape('rect', { x: bx, y: 6.15, w: bw, h: bh, fill: { color: C.blueBg }, line: { color: C.blue, width: 1 } });
    s.addText(b, { x: bx, y: 6.15, w: bw, h: bh, fontSize: 14, bold: true, color: C.blue, fontFace: F, align: 'center', valign: 'middle', fit: 'shrink' });
  });
}

// ══════════════════════════════════════════════════════════════════
// 슬라이드 2 — 목차
// ══════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addHeader(s, '목차', 'Table of Contents');

  const items = [
    { n: '01', title: '앱 개요',              sub: '핵심 기능 요약 및 사용 시나리오' },
    { n: '02', title: '파이프라인 빌더',       sub: '비주얼 캔버스 · 모듈 배치 · 연결' },
    { n: '03', title: '계산 모듈 구성',        sub: '위험률 처리 → 보험료 산출 파이프라인' },
    { n: '04', title: 'DSL 편집기',            sub: '텍스트 기반 파이프라인 정의 · 적용' },
    { n: '05', title: 'AI 파이프라인 생성',    sub: '자연어 입력 → Gemini AI → 자동 배치 ★' },
    { n: '06', title: '보험료 산출 결과',      sub: '순보험료·영업보험료·준비금 확인 · AI 해석' },
    { n: '07', title: '시나리오 분석',         sub: '복수 조건 자동 반복 산출 · 비교' },
    { n: '08', title: '샘플 & 저장 관리',     sub: '파이프라인 저장·불러오기 · 공유 샘플' },
    { n: '09', title: '기술 스택',             sub: 'React · Vite · Gemini · Supabase' },
  ];

  const COL_GAP = 0.30;
  const colW = (L.W - COL_GAP) / 2;
  const rows = Math.ceil(items.length / 2);
  const cardH = calcCardH(L.Y0, rows, 0.10);
  const ROW_GAP = 0.10;

  items.forEach((item, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = L.XL + col * (colW + COL_GAP);
    const cy = L.Y0 + row * (cardH + ROW_GAP);

    const isAI = item.n === '05';
    s.addShape('rect', {
      x: cx, y: cy, w: colW, h: cardH,
      fill: { color: isAI ? C.purple2 : C.card },
      line: { color: isAI ? C.purple : C.border, width: isAI ? 1.5 : 0.75 },
    });
    s.addText(item.n, {
      x: cx + 0.15, y: cy + 0.10, w: 0.55, h: cardH - 0.20,
      fontSize: 26, bold: true, color: isAI ? C.purple : C.blue, fontFace: F,
      valign: 'middle', fit: 'shrink',
    });
    s.addText(item.title, {
      x: cx + 0.78, y: cy + 0.10, w: colW - 0.93, h: 0.38,
      fontSize: 18, bold: true, color: C.black, fontFace: F,
      valign: 'top', fit: 'shrink',
    });
    s.addText(item.sub, {
      x: cx + 0.78, y: cy + 0.48, w: colW - 0.93, h: cardH - 0.58,
      fontSize: 14, color: C.sub, fontFace: F,
      valign: 'top', wrap: true, fit: 'shrink',
    });
    assertInBounds(cy, cardH, `목차 카드[${i}]`);
  });
}

// ══════════════════════════════════════════════════════════════════
// 슬라이드 3 — 앱 개요
// ══════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addHeader(s, '01', '앱 개요');

  s.addText('보험료 산출 전 과정을 모듈화·자동화하는 비주얼 파이프라인 빌더', {
    x: L.XL, y: L.Y0, w: L.W, h: 0.38,
    fontSize: 17, color: C.sub, fontFace: F, valign: 'top', fit: 'shrink',
  });

  const cardStartY = L.Y0 + 0.45;
  const COL_GAP = 0.18;
  const colW = (L.W - COL_GAP) / 2;
  const cardH = calcCardH(cardStartY, 2, 0.12);
  const ROW_GAP = 0.12;

  const cards = [
    {
      icon: '🧩', title: '비주얼 파이프라인 빌더',
      desc: '• 모듈을 드래그&드롭으로 캔버스에 배치\n• 화살표로 모듈 간 데이터 흐름 연결\n• 실시간 Auto Layout 자동 정렬',
      color: C.blueBg, border: C.blue,
    },
    {
      icon: '🤖', title: 'AI 파이프라인 자동 생성',
      desc: '• 자연어로 보험 조건 입력\n• Gemini 2.5 Flash → DSL 마크다운 생성\n• 원클릭으로 캔버스에 자동 배치',
      color: C.purple2, border: C.purple,
    },
    {
      icon: '📊', title: '보험료 전 단계 자동 산출',
      desc: '• 위험률 로드 → 생존자 → Nx/Mx → BPV\n• 순보험료·영업보험료·준비금 일괄 계산\n• 수식 직접 입력으로 상품 맞춤 설정',
      color: C.greenBg, border: C.green,
    },
    {
      icon: '🔬', title: '시나리오 & 결과 분석',
      desc: '• 복수 조건(연령·성별·기간) 자동 반복 산출\n• AI가 결과를 자연어로 해석·설명\n• PPT 슬라이드 리포트 자동 생성',
      color: C.amberBg, border: C.amber,
    },
  ];

  cards.forEach((card, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = L.XL + col * (colW + COL_GAP);
    const cy = cardStartY + row * (cardH + ROW_GAP);

    s.addShape('rect', { x: cx, y: cy, w: colW, h: cardH, fill: { color: card.color }, line: { color: card.border, width: 1.5 } });

    const titleH = cardH * 0.35;
    s.addText(`${card.icon}  ${card.title}`, {
      x: cx + 0.18, y: cy + 0.14, w: colW - 0.36, h: titleH,
      fontSize: 20, bold: true, color: C.black, fontFace: F,
      valign: 'top', fit: 'shrink',
    });
    const descY = cy + 0.14 + titleH + 0.06;
    const descH = cardH - 0.14 - titleH - 0.06 - 0.14;
    s.addText(card.desc, {
      x: cx + 0.18, y: descY, w: colW - 0.36, h: Math.max(descH, 0.30),
      fontSize: 15, color: C.dark, fontFace: F,
      valign: 'top', wrap: true, fit: 'shrink', lineSpacingMultiple: 1.3,
    });
    assertInBounds(cy, cardH, `개요 카드[${i}]`);
  });
}

// ══════════════════════════════════════════════════════════════════
// 슬라이드 4 — 파이프라인 빌더
// ══════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addHeader(s, '02', '파이프라인 빌더');

  s.addText('비주얼 캔버스에서 모듈을 배치하고 연결해 보험료 산출 흐름을 구성', {
    x: L.XL, y: L.Y0, w: L.W, h: 0.36,
    fontSize: 16, color: C.sub, fontFace: F, valign: 'top', fit: 'shrink',
  });

  const cardStartY = L.Y0 + 0.44;
  const COL_GAP = 0.18;
  const colW = (L.W - COL_GAP) / 2;
  const cardH = calcCardH(cardStartY, 2, 0.10);

  const items = [
    {
      icon: '🖱️', title: '드래그 & 드롭 배치',
      desc: '• 왼쪽 툴박스에서 모듈을 캔버스로 드래그\n• 모듈 이동·복사·삭제 지원\n• 다중 선택 후 일괄 조작 가능',
    },
    {
      icon: '🔗', title: '모듈 연결 (화살표)',
      desc: '• 모듈 출력 포트 → 입력 포트로 드래그 연결\n• 연결선 자동 라우팅\n• 실행 순서 자동 추론 (위상 정렬)',
    },
    {
      icon: '⚙️', title: '파라미터 편집',
      desc: '• 모듈 클릭 → 우측 패널 인라인 편집\n• 수식 직접 입력 (NetPremium, Gross 등)\n• 편집 내용 즉시 캔버스에 반영',
    },
    {
      icon: '↩️', title: 'Undo/Redo & Auto Layout',
      desc: '• 실행 취소/다시 실행 히스토리 관리\n• Auto Layout으로 모듈 자동 정렬\n• 탭별 독립 파이프라인 관리',
    },
  ];

  items.forEach((item, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = L.XL + col * (colW + COL_GAP);
    const cy = cardStartY + row * (cardH + 0.10);

    s.addShape('rect', { x: cx, y: cy, w: colW, h: cardH, fill: { color: C.card }, line: { color: C.border, width: 0.75 } });
    const titleH = cardH * 0.35;
    s.addText(`${item.icon}  ${item.title}`, {
      x: cx + 0.15, y: cy + 0.12, w: colW - 0.30, h: titleH,
      fontSize: 19, bold: true, color: C.black, fontFace: F, valign: 'top', fit: 'shrink',
    });
    const descY = cy + 0.12 + titleH + 0.06;
    const descH = cardH - 0.12 - titleH - 0.06 - 0.12;
    s.addText(item.desc, {
      x: cx + 0.15, y: descY, w: colW - 0.30, h: Math.max(descH, 0.30),
      fontSize: 15, color: C.dark, fontFace: F,
      valign: 'top', wrap: true, fit: 'shrink', lineSpacingMultiple: 1.3,
    });
    assertInBounds(cy, cardH, `빌더 카드[${i}]`);
  });
}

// ══════════════════════════════════════════════════════════════════
// 슬라이드 5 — 계산 모듈 구성
// ══════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addHeader(s, '03', '계산 모듈 구성');

  s.addText('위험률 데이터 처리부터 보험료 산출까지 단계별 모듈로 구성', {
    x: L.XL, y: L.Y0, w: L.W, h: 0.34,
    fontSize: 16, color: C.sub, fontFace: F, valign: 'top', fit: 'shrink',
  });

  // 화살표 플로우 다이어그램
  const flowY = L.Y0 + 0.44;
  const flowH = 0.52;
  const modules = [
    { label: 'LoadData\n위험률 로드',      color: '3B82F6', bg: 'EFF6FF' },
    { label: 'SelectRiskRates\n기준 선택',  color: '3B82F6', bg: 'EFF6FF' },
    { label: 'SelectData\n컬럼 선택',      color: '3B82F6', bg: 'EFF6FF' },
    { label: 'RateModifier\n요율 보정',     color: '0891B2', bg: 'ECFEFF' },
    { label: 'DefinePolicyInfo\n증권 정보', color: '7C3AED', bg: 'F5F3FF' },
  ];
  const mw = (L.W - 0.20 * (modules.length - 1)) / modules.length;
  modules.forEach((m, i) => {
    const mx = L.XL + i * (mw + 0.20);
    s.addShape('rect', { x: mx, y: flowY, w: mw, h: flowH, fill: { color: m.bg }, line: { color: m.color, width: 1.2 } });
    s.addText(m.label, { x: mx, y: flowY, w: mw, h: flowH, fontSize: 12, bold: true, color: m.color, fontFace: F, align: 'center', valign: 'middle', wrap: true, fit: 'shrink', h: flowH });
    if (i < modules.length - 1) {
      s.addText('→', { x: mx + mw + 0.01, y: flowY, w: 0.18, h: flowH, fontSize: 18, bold: true, color: C.sub, fontFace: F, align: 'center', valign: 'middle', h: flowH, fit: 'shrink' });
    }
  });

  // 화살표 (아래로)
  const arrowY = flowY + flowH + 0.04;
  s.addText('↓', { x: L.XL + L.W / 2 - 0.3, y: arrowY, w: 0.6, h: 0.28, fontSize: 22, bold: true, color: C.sub, fontFace: F, align: 'center', valign: 'middle', fit: 'shrink' });

  const flow2Y = arrowY + 0.30;
  const modules2 = [
    { label: 'CalculateSurvivors\n생존자(Lx)',  color: '059669', bg: 'ECFDF5' },
    { label: 'ClaimsCalculator\n클레임',         color: '059669', bg: 'ECFDF5' },
    { label: 'NxMxCalculator\nNx/Mx',           color: '059669', bg: 'ECFDF5' },
    { label: 'PremiumComponent\nNNX/BPV',        color: 'D97706', bg: 'FFFBEB' },
    { label: 'AdditionalName\n추가 변수',        color: 'D97706', bg: 'FFFBEB' },
  ];
  const mw2 = (L.W - 0.20 * (modules2.length - 1)) / modules2.length;
  modules2.forEach((m, i) => {
    const mx = L.XL + i * (mw2 + 0.20);
    s.addShape('rect', { x: mx, y: flow2Y, w: mw2, h: flowH, fill: { color: m.bg }, line: { color: m.color, width: 1.2 } });
    s.addText(m.label, { x: mx, y: flow2Y, w: mw2, h: flowH, fontSize: 12, bold: true, color: m.color, fontFace: F, align: 'center', valign: 'middle', wrap: true, fit: 'shrink', h: flowH });
    if (i < modules2.length - 1) {
      s.addText('→', { x: mx + mw2 + 0.01, y: flow2Y, w: 0.18, h: flowH, fontSize: 18, bold: true, color: C.sub, fontFace: F, align: 'center', valign: 'middle', h: flowH, fit: 'shrink' });
    }
  });

  const arrow2Y = flow2Y + flowH + 0.04;
  s.addText('↓', { x: L.XL + L.W / 2 - 0.3, y: arrow2Y, w: 0.6, h: 0.28, fontSize: 22, bold: true, color: C.sub, fontFace: F, align: 'center', valign: 'middle', fit: 'shrink' });

  const flow3Y = arrow2Y + 0.30;
  const modules3 = [
    { label: 'NetPremiumCalculator\n순보험료',    color: 'B91C1C', bg: 'FEF2F2' },
    { label: 'GrossPremiumCalculator\n영업보험료', color: 'B91C1C', bg: 'FEF2F2' },
    { label: 'ReserveCalculator\n준비금',          color: 'B91C1C', bg: 'FEF2F2' },
    { label: 'ScenarioRunner\n시나리오',           color: '7C3AED', bg: 'F5F3FF' },
  ];
  const mw3 = (L.W - 0.20 * (modules3.length - 1)) / modules3.length;
  modules3.forEach((m, i) => {
    const mx = L.XL + i * (mw3 + 0.20);
    s.addShape('rect', { x: mx, y: flow3Y, w: mw3, h: flowH, fill: { color: m.bg }, line: { color: m.color, width: 1.2 } });
    s.addText(m.label, { x: mx, y: flow3Y, w: mw3, h: flowH, fontSize: 12, bold: true, color: m.color, fontFace: F, align: 'center', valign: 'middle', wrap: true, fit: 'shrink', h: flowH });
    if (i < modules3.length - 1) {
      s.addText('→', { x: mx + mw3 + 0.01, y: flow3Y, w: 0.18, h: flowH, fontSize: 18, bold: true, color: C.sub, fontFace: F, align: 'center', valign: 'middle', h: flowH, fit: 'shrink' });
    }
  });

  assertInBounds(flow3Y, flowH, '모듈 플로우 3행');
}

// ══════════════════════════════════════════════════════════════════
// 슬라이드 6 — DSL 편집기
// ══════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addHeader(s, '04', 'DSL 편집기');

  s.addText('텍스트 기반 DSL로 파이프라인 전체를 정의·적용하는 강력한 편집 도구', {
    x: L.XL, y: L.Y0, w: L.W, h: 0.34,
    fontSize: 16, color: C.sub, fontFace: F, valign: 'top', fit: 'shrink',
  });

  // 왼쪽: DSL 예시 코드 블록
  const codeX = L.XL;
  const codeW = L.W * 0.50;
  const codeY = L.Y0 + 0.44;
  const codeH = L.YB - codeY - 0.05;
  s.addShape('rect', { x: codeX, y: codeY, w: codeW, h: codeH, fill: { color: '1E293B' }, line: { color: '334155', width: 0.75 } });
  s.addText('DSL 마크다운 예시', {
    x: codeX + 0.15, y: codeY + 0.10, w: codeW - 0.30, h: 0.32,
    fontSize: 13, bold: true, color: '94A3B8', fontFace: F, valign: 'top', fit: 'shrink',
  });
  const dslCode = [
    '**상품명**: 종신보험 (20년납)',
    '**설명**: 30세 남성 기준 순보험료 산출',
    '',
    '## [1] 증권 기본 정보 (DefinePolicyInfo)',
    '**포함여부**: yes',
    '**가입연령**: 30',
    '**성별**: M',
    '**보험기간**: life',
    '**납입기간**: 20',
    '**이율 (%)**: 2.5',
    '',
    '## [9] 순보험료 계산 (NetPremiumCalculator)',
    '**포함여부**: yes',
    '**수식**: [BPV_Mortality] / [NNX_Mortality(Year)]',
    '**변수명**: PP',
    '',
    '## [10] 영업보험료 계산 (GrossPremiumCalculator)',
    '**포함여부**: yes',
    '**수식**: [PP] / (1 - 0.05)',
    '**변수명**: GP',
  ].join('\n');
  s.addText(dslCode, {
    x: codeX + 0.15, y: codeY + 0.46, w: codeW - 0.30, h: codeH - 0.56,
    fontSize: 11.5, color: '7DD3FC', fontFace: 'Courier New',
    valign: 'top', wrap: true, fit: 'shrink', lineSpacingMultiple: 1.25,
  });

  // 오른쪽: 기능 설명 카드
  const rightX = codeX + codeW + 0.25;
  const rightW = L.XR - rightX;
  const cardH = calcCardH(codeY, 3, 0.12);
  const features = [
    { icon: '📝', title: 'DSL로 파이프라인 전체 정의', desc: '• 상품명·설명·모듈별 파라미터 텍스트 작성\n• 포함여부(yes/no)로 모듈 활성화 제어\n• 수식 변수 직접 지정 가능' },
    { icon: '🔄', title: '파이프라인 빌드 / 파라미터 패치', desc: '• "빌드" — 기존 캔버스 교체 후 재배치\n• "패치" — 기존 모듈 위치 유지·파라미터만 갱신\n• 누락 모듈 자동 추가' },
    { icon: '💾', title: '.lifx 파일 저장 & 불러오기', desc: '• 파이프라인 전체를 .lifx 파일로 내보내기\n• 불러오기로 이전 작업 즉시 복원\n• Supabase 공유 샘플과 연동 가능' },
  ];
  features.forEach((f, i) => {
    const cy = codeY + i * (cardH + 0.12);
    s.addShape('rect', { x: rightX, y: cy, w: rightW, h: cardH, fill: { color: C.card }, line: { color: C.border, width: 0.75 } });
    const titleH = cardH * 0.36;
    s.addText(`${f.icon}  ${f.title}`, {
      x: rightX + 0.15, y: cy + 0.10, w: rightW - 0.30, h: titleH,
      fontSize: 17, bold: true, color: C.black, fontFace: F, valign: 'top', fit: 'shrink',
    });
    const descY = cy + 0.10 + titleH + 0.06;
    const descH = cardH - 0.10 - titleH - 0.06 - 0.10;
    s.addText(f.desc, {
      x: rightX + 0.15, y: descY, w: rightW - 0.30, h: Math.max(descH, 0.28),
      fontSize: 14, color: C.dark, fontFace: F, valign: 'top', wrap: true, fit: 'shrink', lineSpacingMultiple: 1.25,
    });
    assertInBounds(cy, cardH, `DSL 카드[${i}]`);
  });
}

// ══════════════════════════════════════════════════════════════════
// 슬라이드 7 — AI 파이프라인 생성 ★ (별도 1페이지)
// ══════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  // 헤더 — 보라색 강조
  s.addShape('rect', { x: 0, y: 0, w: SLIDE.W, h: L.HDR, fill: { color: '4C1D95' }, line: { width: 0 } });
  s.addText('✨  05  AI 파이프라인 자동 생성', {
    x: L.XL, y: 0, w: L.W, h: L.HDR,
    fontSize: 30, bold: true, color: C.white, fontFace: F,
    valign: 'middle', fit: 'shrink',
  });

  s.addText('자연어로 보험 조건을 입력하면 Gemini AI가 DSL을 생성하고 캔버스에 자동 배치', {
    x: L.XL, y: L.Y0, w: L.W, h: 0.34,
    fontSize: 16, color: C.sub, fontFace: F, valign: 'top', fit: 'shrink',
  });

  // ── 사용 흐름 (3단계 화살표) ─────────────────────────────────────
  const stepY = L.Y0 + 0.46;
  const stepH = 1.10;
  const stepW = (L.W - 0.25 * 2) / 3;
  const steps = [
    { n: '1', icon: '✍️', title: '조건 입력', desc: '예시 클릭 또는\n자연어로 직접 입력\n(예시 6종 제공)' },
    { n: '2', icon: '🤖', title: 'Gemini AI 생성', desc: 'Gemini 2.5 Flash\nDSL 마크다운 자동 작성\n(모듈·파라미터·수식 포함)' },
    { n: '3', icon: '🚀', title: '캔버스 자동 배치', desc: '"적용하기" 클릭\n→ 파이프라인 즉시 구성\n→ 바로 실행 가능' },
  ];
  steps.forEach((step, i) => {
    const sx = L.XL + i * (stepW + 0.25);
    s.addShape('rect', { x: sx, y: stepY, w: stepW, h: stepH, fill: { color: C.purple2 }, line: { color: C.purple, width: 1.5 } });
    s.addText(`${step.n}`, {
      x: sx + 0.15, y: stepY + 0.10, w: 0.40, h: 0.40,
      fontSize: 20, bold: true, color: C.purple, fontFace: F, align: 'center', valign: 'middle', fit: 'shrink',
    });
    s.addText(`${step.icon}  ${step.title}`, {
      x: sx + 0.58, y: stepY + 0.10, w: stepW - 0.73, h: 0.40,
      fontSize: 17, bold: true, color: '4C1D95', fontFace: F, valign: 'middle', fit: 'shrink',
    });
    s.addText(step.desc, {
      x: sx + 0.15, y: stepY + 0.56, w: stepW - 0.30, h: stepH - 0.66,
      fontSize: 14, color: C.dark, fontFace: F, valign: 'top', wrap: true, fit: 'shrink', lineSpacingMultiple: 1.3,
    });
    if (i < steps.length - 1) {
      s.addText('→', {
        x: sx + stepW + 0.03, y: stepY, w: 0.22, h: stepH,
        fontSize: 28, bold: true, color: C.purple, fontFace: F, align: 'center', valign: 'middle', fit: 'shrink',
      });
    }
    assertInBounds(stepY, stepH, `AI 단계[${i}]`);
  });

  // ── 예시 선택 버튼 섹션 ──────────────────────────────────────────
  const exLabelY = stepY + stepH + 0.18;
  s.addText('💡  제공되는 예시 6종 (클릭 선택 후 자유 수정)', {
    x: L.XL, y: exLabelY, w: L.W, h: 0.32,
    fontSize: 15, bold: true, color: C.dark, fontFace: F, valign: 'top', fit: 'shrink',
  });

  const exY = exLabelY + 0.36;
  const examples = [
    '종신보험 순보험료\n30세 남성, 20년납, 이율 2.5%',
    '정기보험 (10년납)\n40세 여성, 10년만기, 준비금 포함',
    '암보험 (20년만기)\n35세 남성, 성별·나이별 위험률',
    '연금보험 (65세 개시)\n45세 여성, 생존급부 위주',
    '요율 보정 종신보험\n보정계수 1.2 적용',
    '나이별 시나리오\n30~50세 가입연령 비교 산출',
  ];
  const exColGap = 0.18;
  const exCols = 3;
  const exRows = 2;
  const exW = (L.W - exColGap * (exCols - 1)) / exCols;
  const exH = calcCardH(exY, exRows, 0.10);

  examples.forEach((ex, i) => {
    const col = i % exCols;
    const row = Math.floor(i / exCols);
    const ex_x = L.XL + col * (exW + exColGap);
    const ex_y = exY + row * (exH + 0.10);
    s.addShape('rect', {
      x: ex_x, y: ex_y, w: exW, h: exH,
      fill: { color: 'F3F0FF' },
      line: { color: 'A78BFA', width: 1.0 },
    });
    s.addText(ex, {
      x: ex_x + 0.12, y: ex_y + 0.08, w: exW - 0.24, h: exH - 0.16,
      fontSize: 13, color: '4C1D95', fontFace: F,
      valign: 'middle', wrap: true, fit: 'shrink', lineSpacingMultiple: 1.3, bold: false,
    });
    assertInBounds(ex_y, exH, `AI 예시[${i}]`);
  });
}

// ══════════════════════════════════════════════════════════════════
// 슬라이드 8 — 보험료 산출 결과 & AI 해석
// ══════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addHeader(s, '06', '보험료 산출 결과 & AI 결과 해석');

  s.addText('파이프라인 실행 후 순보험료·영업보험료·준비금을 확인하고 AI로 자동 해석', {
    x: L.XL, y: L.Y0, w: L.W, h: 0.34,
    fontSize: 16, color: C.sub, fontFace: F, valign: 'top', fit: 'shrink',
  });

  const cardStartY = L.Y0 + 0.44;
  const COL_GAP = 0.18;
  const colW = (L.W - COL_GAP) / 2;
  const cardH = calcCardH(cardStartY, 2, 0.10);

  const cards = [
    {
      icon: '💰', title: '순보험료 프리뷰 (NetPremiumPreviewModal)',
      desc: '• Run All 실행 후 순보험료 계산 결과 표 표시\n• 연령별·성별 순보험료 행렬 확인\n• "AI로 결과 해석하기" 버튼으로 Gemini 해석 요청',
      color: C.greenBg, border: C.green,
    },
    {
      icon: '🤖', title: 'AI 결과 해석 (Gemini 2.5 Flash)',
      desc: '• 산출된 보험료 수치를 자연어로 설명\n• 이율·위험률·납입기간의 영향 분석\n• 마크다운 형식으로 구조화된 해석 제공',
      color: C.purple2, border: C.purple,
    },
    {
      icon: '📈', title: '영업보험료 & 준비금',
      desc: '• GrossPremiumCalculator — 부가보험료율 적용\n• ReserveCalculator — 납입기간별 준비금 산출\n• AdditionalVariables 프리뷰로 중간값 확인',
      color: C.amberBg, border: C.amber,
    },
    {
      icon: '📊', title: 'PPT 슬라이드 리포트 자동 생성',
      desc: '• 산출 결과를 즉시 PPT로 내보내기\n• 파이프라인 구조·파라미터·결과 포함\n• SlideReport 버튼 클릭 한 번으로 완성',
      color: C.blueBg, border: C.blue,
    },
  ];

  cards.forEach((card, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = L.XL + col * (colW + COL_GAP);
    const cy = cardStartY + row * (cardH + 0.10);
    s.addShape('rect', { x: cx, y: cy, w: colW, h: cardH, fill: { color: card.color }, line: { color: card.border, width: 1.2 } });
    const titleH = cardH * 0.35;
    s.addText(`${card.icon}  ${card.title}`, {
      x: cx + 0.15, y: cy + 0.12, w: colW - 0.30, h: titleH,
      fontSize: 17, bold: true, color: C.black, fontFace: F, valign: 'top', fit: 'shrink',
    });
    const descY = cy + 0.12 + titleH + 0.06;
    const descH = cardH - 0.12 - titleH - 0.06 - 0.12;
    s.addText(card.desc, {
      x: cx + 0.15, y: descY, w: colW - 0.30, h: Math.max(descH, 0.28),
      fontSize: 15, color: C.dark, fontFace: F, valign: 'top', wrap: true, fit: 'shrink', lineSpacingMultiple: 1.3,
    });
    assertInBounds(cy, cardH, `결과 카드[${i}]`);
  });
}

// ══════════════════════════════════════════════════════════════════
// 슬라이드 9 — 시나리오 분석
// ══════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addHeader(s, '07', '시나리오 분석');

  s.addText('복수 조건을 자동으로 반복 산출하고 결과를 비교 분석', {
    x: L.XL, y: L.Y0, w: L.W, h: 0.34,
    fontSize: 16, color: C.sub, fontFace: F, valign: 'top', fit: 'shrink',
  });

  const cardStartY = L.Y0 + 0.44;
  const COL_GAP = 0.18;
  const cols3W = (L.W - COL_GAP * 2) / 3;
  const cardH = calcCardH(cardStartY, 1, 0.10);

  const cards = [
    {
      icon: '🎛️', title: 'Scenario Runner 모듈',
      lines: [
        '• 가입연령·성별·보험기간·납입기간 등 파라미터를 범위/목록으로 지정',
        '• 조건 조합별로 파이프라인 자동 반복 실행',
        '• 조합 수 제한 없이 일괄 산출',
      ],
    },
    {
      icon: '📋', title: '결과 비교 & 실행 로그',
      lines: [
        '• 시나리오별 순보험료·영업보험료 결과 행렬 표시',
        '• Pipeline Execution Modal — 단계별 실행 로그 확인',
        '• 오류 발생 시 해당 모듈 즉시 식별',
      ],
    },
    {
      icon: '🔧', title: 'Policy Setup Modal',
      lines: [
        '• 증권 기본 정보 (연령·성별·이율·기간) UI로 한번에 설정',
        '• 설정 적용 → DefinePolicyInfo 모듈 자동 업데이트',
        '• 시나리오 시작 전 빠른 초기값 세팅에 최적',
      ],
    },
  ];

  cards.forEach((card, i) => {
    const cx = L.XL + i * (cols3W + COL_GAP);
    s.addShape('rect', { x: cx, y: cardStartY, w: cols3W, h: cardH, fill: { color: C.card }, line: { color: C.border, width: 0.75 } });
    const titleH = cardH * 0.28;
    s.addText(`${card.icon}  ${card.title}`, {
      x: cx + 0.15, y: cardStartY + 0.14, w: cols3W - 0.30, h: titleH,
      fontSize: 17, bold: true, color: C.black, fontFace: F, valign: 'top', fit: 'shrink',
    });
    const listY = cardStartY + 0.14 + titleH + 0.08;
    const listH = cardH - 0.14 - titleH - 0.08 - 0.14;
    s.addText(card.lines.join('\n'), {
      x: cx + 0.15, y: listY, w: cols3W - 0.30, h: Math.max(listH, 0.30),
      fontSize: 14, color: C.dark, fontFace: F, valign: 'top', wrap: true, fit: 'shrink', lineSpacingMultiple: 1.35,
    });
    assertInBounds(cardStartY, cardH, `시나리오 카드[${i}]`);
  });
}

// ══════════════════════════════════════════════════════════════════
// 슬라이드 10 — 샘플 & 저장 관리
// ══════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addHeader(s, '08', '샘플 & 저장 관리');

  s.addText('자주 사용하는 파이프라인을 저장하고 팀과 공유', {
    x: L.XL, y: L.Y0, w: L.W, h: 0.34,
    fontSize: 16, color: C.sub, fontFace: F, valign: 'top', fit: 'shrink',
  });

  const cardStartY = L.Y0 + 0.44;
  const COL_GAP = 0.18;
  const colW = (L.W - COL_GAP) / 2;
  const cardH = calcCardH(cardStartY, 2, 0.10);

  const cards = [
    {
      icon: '📁', title: '로컬 저장 & 불러오기',
      desc: '• .lifx 파일로 파이프라인 전체 내보내기\n• Load 버튼으로 이전 작업 즉시 복원\n• Set Folder로 저장 경로 지정',
      color: C.blueBg, border: C.blue,
    },
    {
      icon: '🌐', title: 'Supabase 공유 샘플',
      desc: '• Samples 버튼 → 공유 샘플 목록 브라우징\n• 샘플 클릭 → 즉시 파이프라인 로드\n• 관리 화면에서 신규 샘플 추가·삭제',
      color: C.greenBg, border: C.green,
    },
    {
      icon: '💼', title: 'My Work (개인 작업)',
      desc: '• 개인 작업 저장 공간 별도 관리\n• 로컬 파일 기반으로 오프라인에서도 접근\n• 파이프라인 이름·메타데이터 편집 가능',
      color: C.amberBg, border: C.amber,
    },
    {
      icon: '🏷️', title: '탭 & 다크 모드',
      desc: '• 여러 탭에 독립 파이프라인 동시 관리\n• 탭 이름·색상 커스터마이징\n• 다크 / 라이트 테마 토글 지원',
      color: C.card, border: C.border,
    },
  ];

  cards.forEach((card, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = L.XL + col * (colW + COL_GAP);
    const cy = cardStartY + row * (cardH + 0.10);
    s.addShape('rect', { x: cx, y: cy, w: colW, h: cardH, fill: { color: card.color }, line: { color: card.border, width: 1.2 } });
    const titleH = cardH * 0.36;
    s.addText(`${card.icon}  ${card.title}`, {
      x: cx + 0.15, y: cy + 0.12, w: colW - 0.30, h: titleH,
      fontSize: 19, bold: true, color: C.black, fontFace: F, valign: 'top', fit: 'shrink',
    });
    const descY = cy + 0.12 + titleH + 0.06;
    const descH = cardH - 0.12 - titleH - 0.06 - 0.12;
    s.addText(card.desc, {
      x: cx + 0.15, y: descY, w: colW - 0.30, h: Math.max(descH, 0.28),
      fontSize: 15, color: C.dark, fontFace: F, valign: 'top', wrap: true, fit: 'shrink', lineSpacingMultiple: 1.3,
    });
    assertInBounds(cy, cardH, `샘플 카드[${i}]`);
  });
}

// ══════════════════════════════════════════════════════════════════
// 슬라이드 11 — 기술 스택
// ══════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addHeader(s, '09', '기술 스택');

  const cardStartY = L.Y0;
  const COL_GAP = 0.18;
  const cols3W = (L.W - COL_GAP * 2) / 3;
  const cardH = calcCardH(cardStartY, 2, 0.10);

  const stacks = [
    {
      cat: '프론트엔드', icon: '⚛️',
      items: ['React 19 + TypeScript', 'Vite (빌드 도구)', 'Tailwind CSS (스타일링)', 'pptxgenjs (PPT 생성)'],
      color: C.blueBg, border: C.blue,
    },
    {
      cat: 'AI / 외부 서비스', icon: '🤖',
      items: ['Google Gemini 2.5 Flash', '@google/genai SDK', 'Supabase (공유 샘플 DB)', 'Supabase RLS (보안)'],
      color: C.purple2, border: C.purple,
    },
    {
      cat: '데이터 처리', icon: '📊',
      items: ['xlsx (엑셀 파싱)', 'mammoth (DOCX → MD)', 'better-sqlite3 (로컬 DB)', 'Custom DSL Parser'],
      color: C.greenBg, border: C.green,
    },
    {
      cat: '백엔드 / 서버', icon: '🖥️',
      items: ['Express.js (로컬 서버)', 'multer (파일 업로드)', 'Node.js v22', 'Render (배포)'],
      color: C.amberBg, border: C.amber,
    },
    {
      cat: '개발 도구', icon: '🔧',
      items: ['pnpm (패키지 매니저)', 'ESLint + TypeScript', 'concurrently (dev 서버)', 'Git (버전 관리)'],
      color: C.card, border: C.border,
    },
    {
      cat: '핵심 유틸리티', icon: '🧰',
      items: ['markdownModelParser (DSL 파싱)', 'pipelineBuilder (모듈 생성)', 'useHistoryState (Undo/Redo)', 'moduleDefaults (기본값 관리)'],
      color: C.card, border: C.border,
    },
  ];

  stacks.forEach((stack, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const cx = L.XL + col * (cols3W + COL_GAP);
    const cy = cardStartY + row * (cardH + 0.10);
    s.addShape('rect', { x: cx, y: cy, w: cols3W, h: cardH, fill: { color: stack.color }, line: { color: stack.border, width: 1.0 } });
    s.addText(`${stack.icon}  ${stack.cat}`, {
      x: cx + 0.13, y: cy + 0.10, w: cols3W - 0.26, h: 0.36,
      fontSize: 16, bold: true, color: C.black, fontFace: F, valign: 'top', fit: 'shrink',
    });
    const listY = cy + 0.50;
    const listH = cardH - 0.60;
    s.addText(stack.items.map(it => `• ${it}`).join('\n'), {
      x: cx + 0.13, y: listY, w: cols3W - 0.26, h: Math.max(listH, 0.28),
      fontSize: 13, color: C.dark, fontFace: F, valign: 'top', wrap: true, fit: 'shrink', lineSpacingMultiple: 1.3,
    });
    assertInBounds(cy, cardH, `스택 카드[${i}]`);
  });
}

// ══════════════════════════════════════════════════════════════════
// 슬라이드 12 — 마무리
// ══════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  s.addShape('rect', { x: 0, y: 0, w: SLIDE.W, h: SLIDE.H, fill: { color: C.navy }, line: { width: 0 } });
  s.addShape('ellipse', { x: 10.0, y: -1.0, w: 5.0, h: 5.0, fill: { color: '243F6A' }, line: { width: 0 } });
  s.addShape('ellipse', { x: -1.5, y: 4.5,  w: 4.5, h: 4.5, fill: { color: '243F6A' }, line: { width: 0 } });

  s.addText('보험료 자동 산출\n파이프라인 빌더', {
    x: 1.0, y: 1.2, w: 10.5, h: 2.00,
    fontSize: 44, bold: true, color: C.white, fontFace: F,
    valign: 'top', wrap: true, fit: 'shrink', lineSpacingMultiple: 1.2,
  });

  const summaries = [
    '✅  비주얼 파이프라인 빌더 — 드래그&드롭으로 직관적 구성',
    '✅  Gemini AI 파이프라인 생성 — 자연어 입력으로 즉시 자동화',
    '✅  순보험료·영업보험료·준비금 일괄 자동 산출',
    '✅  시나리오 분석 · AI 결과 해석 · PPT 리포트 자동 생성',
  ];
  summaries.forEach((line, i) => {
    s.addText(line, {
      x: 1.0, y: 3.45 + i * 0.60, w: 11.0, h: 0.55,
      fontSize: 17, color: 'A5C8FF', fontFace: F,
      valign: 'middle', wrap: true, fit: 'shrink',
    });
    assertInBounds(3.45 + i * 0.60, 0.55, `마무리 라인[${i}]`);
  });

  s.addText('바이브코딩랩 · Life Matrix Flow', {
    x: 1.0, y: 6.60, w: 11.0, h: 0.40,
    fontSize: 14, color: '93C5FD', fontFace: F, valign: 'middle', fit: 'shrink',
  });
}

// ─── 저장 ───────────────────────────────────────────────────────
const outputPath = resolveOutputPath(__dirname, 'Presentation');
await pptx.writeFile({ fileName: outputPath });
console.log(`✅  PPT 저장 완료: ${outputPath}`);
