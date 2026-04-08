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
L.W  = L.XR - L.XL;   // 12.53
L.AH = L.YB - L.Y0;   // 5.68

const C = {
  navy:   '1E3A5F',
  blue:   '2563EB',
  black:  '111827',
  dark:   '374151',
  sub:    '6B7280',
  border: 'E5E7EB',
  card:   'F9FAFB',
  white:  'FFFFFF',
  accent: '0EA5E9',
  green:  '059669',
  amber:  'D97706',
};
const F = 'Noto Sans KR';

function calcCardH(startY, rows, gap = 0.10, margin = 0.05) {
  const available = (L.YB - margin) - startY;
  return Math.max((available - gap * (rows - 1)) / rows, 0.40);
}

function assertInBounds(y, h, label) {
  const bottom = y + h;
  if (bottom > L.YB + 0.01) {
    console.warn(`⚠ OVERFLOW [${label}]: ${bottom.toFixed(3)} > ${L.YB}`);
  }
}

function addHeader(s, num, title) {
  s.addShape('rect', { x: 0, y: 0, w: SLIDE.W, h: L.HDR, fill: { color: C.navy }, line: { width: 0 } });
  s.addText(`${num}  ${title}`, {
    x: 0.40, y: 0.10, w: SLIDE.W - 0.80, h: 0.82,
    fontSize: 28, bold: true, color: C.white, fontFace: F,
    valign: 'middle', fit: 'shrink',
  });
}

function addCard(s, cx, cy, cw, ch, icon, title, desc, titleSize = 20, descSize = 15) {
  assertInBounds(cy, ch, title);
  s.addShape('rect', { x: cx, y: cy, w: cw, h: ch, fill: { color: C.card }, line: { color: C.border, width: 0.75 } });
  const titleH = ch * 0.35;
  s.addText(`${icon}  ${title}`, {
    x: cx + 0.14, y: cy + 0.10, w: cw - 0.28, h: titleH,
    fontSize: titleSize, bold: true, color: C.black, fontFace: F,
    valign: 'top', fit: 'shrink', wrap: true,
  });
  const descY = cy + 0.10 + titleH + 0.06;
  const descH = Math.max(ch - 0.10 - titleH - 0.10 - 0.06, 0.30);
  s.addText(desc, {
    x: cx + 0.14, y: descY, w: cw - 0.28, h: descH,
    fontSize: descSize, color: C.dark, fontFace: F,
    valign: 'top', wrap: true, fit: 'shrink', lineSpacingMultiple: 1.2,
  });
}

// ─── PPT 생성 시작 ────────────────────────────────────────────────────────────
const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';
pptx.title = 'Life Matrix Flow — 생명보험 보험료 자동 산출 시스템';

// ══════════════════════════════════════════════════════════════════════════════
// 슬라이드 1 — 표지
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  s.addShape('rect', { x: 0, y: 0, w: SLIDE.W, h: 4.00, fill: { color: C.navy }, line: { width: 0 } });
  s.addShape('rect', { x: 0, y: 4.00, w: SLIDE.W, h: 0.09, fill: { color: C.accent }, line: { width: 0 } });

  s.addText('Life Matrix Flow', {
    x: 0.80, y: 0.55, w: SLIDE.W - 1.60, h: 1.20,
    fontSize: 52, bold: true, color: C.white, fontFace: F,
    valign: 'middle', align: 'left', fit: 'shrink',
  });
  s.addText('생명보험 보험료 자동 산출 시스템', {
    x: 0.80, y: 1.85, w: SLIDE.W - 1.60, h: 0.65,
    fontSize: 26, color: 'A5C8E6', fontFace: F,
    valign: 'middle', align: 'left', fit: 'shrink',
  });
  s.addText('비주얼 파이프라인 기반 · 계리 계산 자동화 · AI 파이프라인 생성', {
    x: 0.80, y: 2.58, w: SLIDE.W - 1.60, h: 0.48,
    fontSize: 17, color: '7FB3D3', fontFace: F, italic: true,
    valign: 'middle', align: 'left', fit: 'shrink',
  });
  s.addText('위험률 로드  →  교환함수 계산  →  순보험료  →  영업보험료  →  적립금', {
    x: 0.80, y: 3.12, w: SLIDE.W - 1.60, h: 0.48,
    fontSize: 16, color: '94B8D0', fontFace: F, italic: false,
    valign: 'middle', align: 'left', fit: 'shrink',
  });

  const tags = ['⚡ React 19', '🔷 TypeScript', '🤖 Gemini AI', '🗄 Supabase', '📊 pptxgenjs'];
  tags.forEach((tag, i) => {
    const tw = 2.10, th = 0.50, gap = 0.18;
    const startX = 0.80;
    s.addShape('rect', { x: startX + i * (tw + gap), y: 4.42, w: tw, h: th, fill: { color: '1A3252' }, line: { color: C.accent, width: 1 } });
    s.addText(tag, { x: startX + i * (tw + gap), y: 4.42, w: tw, h: th, fontSize: 14, color: C.white, fontFace: F, align: 'center', valign: 'middle', fit: 'shrink' });
  });

  s.addText('2026 · 생명보험 계리 플랫폼', {
    x: 0.80, y: 6.60, w: SLIDE.W - 1.60, h: 0.40,
    fontSize: 14, color: C.sub, fontFace: F, align: 'left', valign: 'middle',
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 슬라이드 2 — 목차
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addHeader(s, '📋', '목차');

  const items = [
    { num: '01', title: '앱 개요', sub: '비주얼 파이프라인 보험료 산출 시스템' },
    { num: '02', title: '비주얼 캔버스', sub: '드래그 & 드롭 파이프라인 편집' },
    { num: '03', title: '계약 설정 & 위험률', sub: '계약 정보·위험률 로드·기준 설정' },
    { num: '04', title: '교환함수 계산', sub: '생존자수 → Cx/Nx/Mx → NNX/MMX' },
    { num: '05', title: '순보험료 & 영업보험료', sub: '수식 기반 자동 산출' },
    { num: '06', title: '적립금 & 시나리오', sub: '책임준비금 계산·다중 시나리오 실행' },
    { num: '07', title: 'AI 파이프라인 자동 생성', sub: 'Gemini AI 기반 목표 기반 구성' },
    { num: '08', title: 'DSL 에디터 & 샘플 라이브러리', sub: '코드 기반 편집·Supabase 샘플 관리' },
    { num: '09', title: '보고서 & 기술 스택', sub: '파이프라인 설명서·슬라이드 보고서' },
  ];

  const colW = (L.W - 0.30) / 2;
  const COL_GAP = 0.30, ROW_GAP = 0.08;
  const rows = Math.ceil(items.length / 2);
  const cardH = calcCardH(L.Y0, rows, ROW_GAP);

  items.forEach((item, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const cx = L.XL + col * (colW + COL_GAP);
    const cy = L.Y0 + row * (cardH + ROW_GAP);
    assertInBounds(cy, cardH, `TOC[${i}]`);
    s.addShape('rect', { x: cx, y: cy, w: colW, h: cardH, fill: { color: C.card }, line: { color: C.border, width: 0.75 } });
    s.addShape('rect', { x: cx + 0.12, y: cy + 0.10, w: 0.50, h: cardH * 0.55, fill: { color: C.navy }, line: { width: 0 } });
    s.addText(item.num, { x: cx + 0.12, y: cy + 0.10, w: 0.50, h: cardH * 0.55, fontSize: 18, bold: true, color: C.white, fontFace: F, align: 'center', valign: 'middle', fit: 'shrink' });
    s.addText(item.title, { x: cx + 0.72, y: cy + 0.10, w: colW - 0.84, h: cardH * 0.45, fontSize: 17, bold: true, color: C.black, fontFace: F, valign: 'top', fit: 'shrink', wrap: true });
    s.addText(item.sub, { x: cx + 0.72, y: cy + 0.10 + cardH * 0.45, w: colW - 0.84, h: cardH * 0.40, fontSize: 13, color: C.sub, fontFace: F, valign: 'top', fit: 'shrink', wrap: true });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 슬라이드 3 — 앱 개요
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addHeader(s, '01', '앱 개요');

  s.addText('Life Matrix Flow는 위험률 로드부터 순보험료·영업보험료·책임준비금까지\n전체 생명보험 보험료 산출 과정을 비주얼 파이프라인으로 자동화합니다.', {
    x: L.XL, y: L.Y0, w: L.W, h: 0.65,
    fontSize: 17, color: C.dark, fontFace: F, valign: 'middle', wrap: true, fit: 'shrink',
  });

  const cards = [
    { icon: '🎨', title: '비주얼 파이프라인 빌더', desc: '드래그 & 드롭으로 계산 모듈 배치\n포트 연결로 데이터 흐름 구성\n실시간 실행 및 결과 즉시 확인' },
    { icon: '🧮', title: '계리 전문 모듈 라이브러리', desc: '교환함수(Cx·Nx·Mx·NNX·MMX)\n순보험료·영업보험료 수식 산출\n책임준비금·시나리오 분석' },
    { icon: '🤖', title: 'AI 파이프라인 자동 생성', desc: 'Gemini AI 기반 목표 입력\n"40세 남성 종신보험 보험료" 입력만으로\n전체 파이프라인 자동 구성' },
    { icon: '📊', title: '보고서 & 샘플 관리', desc: '파이프라인 설명서 자동 생성\nPPTX 슬라이드 보고서 출력\nSupabase/로컬 샘플 라이브러리' },
  ];

  const COL_GAP = 0.18, ROW_GAP = 0.10, cols = 2;
  const colW = (L.W - COL_GAP) / cols;
  const cardStartY = L.Y0 + 0.70;
  const cardH = calcCardH(cardStartY, 2, ROW_GAP);

  cards.forEach((card, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const cx = L.XL + col * (colW + COL_GAP);
    const cy = cardStartY + row * (cardH + ROW_GAP);
    addCard(s, cx, cy, colW, cardH, card.icon, card.title, card.desc, 20, 15);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 슬라이드 4 — 비주얼 캔버스
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addHeader(s, '02', '비주얼 파이프라인 캔버스');

  const leftW = L.W * 0.44;
  const rightX = L.XL + leftW + 0.25;
  const rightW = L.W - leftW - 0.25;

  const features = [
    { icon: '🖱️', title: '드래그 & 드롭', desc: '툴박스에서 모듈 드래그\n캔버스에 배치·이름 편집' },
    { icon: '🔗', title: '포트 연결', desc: '출력 포트 → 입력 포트 드래그\n타입 호환 자동 검증' },
    { icon: '▶️', title: '실행 & 결과', desc: '순서대로 자동 실행\n각 모듈 결과 팝업 확인' },
    { icon: '↩️', title: '실행 취소/다시 실행', desc: 'Undo / Redo 지원\nCtrl+Z / Ctrl+Y 단축키' },
    { icon: '🔍', title: '줌 & 이동', desc: '캔버스 줌 인/아웃\n전체 보기 자동 맞춤' },
    { icon: '📦', title: '그룹 & 레이어', desc: '모듈 그룹으로 묶기\n레이어 패널 탐색' },
  ];

  const COL_GAP = 0.16, ROW_GAP = 0.10, cols = 2;
  const colW = (leftW - COL_GAP) / cols;
  const rows = Math.ceil(features.length / cols);
  const cardH = calcCardH(L.Y0, rows, ROW_GAP);

  features.forEach((feat, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const cx = L.XL + col * (colW + COL_GAP);
    const cy = L.Y0 + row * (cardH + ROW_GAP);
    addCard(s, cx, cy, colW, cardH, feat.icon, feat.title, feat.desc, 17, 13);
  });

  // 우측 — 인터페이스 구성
  s.addShape('rect', { x: rightX, y: L.Y0, w: rightW, h: L.AH, fill: { color: 'F0F4F8' }, line: { color: C.border, width: 1 } });
  s.addText('인터페이스 구성', {
    x: rightX + 0.15, y: L.Y0 + 0.12, w: rightW - 0.30, h: 0.38,
    fontSize: 17, bold: true, color: C.navy, fontFace: F, valign: 'middle',
  });

  const zones = [
    { label: '🧰 툴박스 (좌측)', desc: '계리 계산 모듈 카탈로그', color: 'DBEAFE' },
    { label: '🎨 캔버스 (중앙)', desc: '모듈 배치·포트 연결·실행 상태', color: 'DCFCE7' },
    { label: '⚙️ 속성 패널 (우측)', desc: '선택한 모듈 파라미터 편집', color: 'FEF9C3' },
    { label: '📐 레이어 패널', desc: '모듈 계층 탐색 및 선택', color: 'FCE7F3' },
    { label: '💻 터미널 패널', desc: '실행 로그·코드 스니펫', color: 'F3E8FF' },
  ];

  const zoneH = (L.AH - 0.55) / zones.length - 0.06;
  zones.forEach((z, i) => {
    const zy = L.Y0 + 0.55 + i * (zoneH + 0.06);
    assertInBounds(zy, zoneH, `zone[${i}]`);
    s.addShape('rect', { x: rightX + 0.12, y: zy, w: rightW - 0.24, h: zoneH, fill: { color: z.color }, line: { color: C.border, width: 0.5 } });
    s.addText(z.label, { x: rightX + 0.22, y: zy + 0.04, w: rightW - 0.44, h: zoneH * 0.50, fontSize: 15, bold: true, color: C.black, fontFace: F, valign: 'top', fit: 'shrink', wrap: false });
    s.addText(z.desc, { x: rightX + 0.22, y: zy + 0.04 + zoneH * 0.50, w: rightW - 0.44, h: zoneH * 0.42, fontSize: 13, color: C.dark, fontFace: F, valign: 'top', fit: 'shrink', wrap: true });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 슬라이드 5 — 계약 설정 & 위험률
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addHeader(s, '03', '계약 설정 & 위험률 준비');

  s.addText('보험료 산출의 첫 단계 — 계약 조건을 정의하고 위험률을 불러와 산출 기준을 수립합니다.', {
    x: L.XL, y: L.Y0, w: L.W, h: 0.42,
    fontSize: 16, color: C.dark, fontFace: F, valign: 'middle', wrap: true, fit: 'shrink',
  });

  // 3단계 흐름도
  const flowY = L.Y0 + 0.48;
  const flowH = 0.80;
  const steps = [
    { icon: '📋', label: 'Define Policy Info', sub: '계약 기본 정보 입력' },
    { icon: '📂', label: 'Load Risk Rates', sub: 'CSV 위험률 파일 로드' },
    { icon: '🔨', label: 'Rating Basis Builder', sub: '보험기간·현가계수 적용' },
    { icon: '📐', label: 'Rate Modifier', sub: '위험률 수식 보정' },
    { icon: '✅', label: '산출 준비 완료', sub: '교환함수 계산 진행' },
  ];
  const stepW = (L.W - 0.10 * (steps.length - 1)) / steps.length;
  steps.forEach((st, i) => {
    const sx = L.XL + i * (stepW + 0.10);
    const isLast = i === steps.length - 1;
    s.addShape('rect', { x: sx, y: flowY, w: stepW, h: flowH, fill: { color: isLast ? C.green : C.navy }, line: { width: 0 } });
    s.addText(`${st.icon}  ${st.label}`, { x: sx + 0.06, y: flowY + 0.06, w: stepW - 0.12, h: flowH * 0.55, fontSize: 13, bold: true, color: C.white, fontFace: F, align: 'center', valign: 'middle', wrap: true, fit: 'shrink' });
    s.addText(st.sub, { x: sx + 0.06, y: flowY + flowH * 0.62, w: stepW - 0.12, h: flowH * 0.32, fontSize: 11, color: 'A5C8E6', fontFace: F, align: 'center', valign: 'middle', fit: 'shrink', wrap: false });
    if (!isLast) s.addText('›', { x: sx + stepW, y: flowY + flowH * 0.25, w: 0.10, h: flowH * 0.50, fontSize: 18, color: C.accent, fontFace: F, align: 'center', valign: 'middle' });
  });

  // 하단 상세 카드
  const cards = [
    {
      icon: '📋', title: 'Define Policy Info',
      desc: '• 계약자 나이·성별·보험기간 설정\n• 납입기간·예정이율(할인율) 입력\n• α₁·α₂·β₁·β₂·β′·γ 기본값 설정\n• 복수 특약(라이더) 개별 설정 가능',
    },
    {
      icon: '📂', title: 'Load Risk Rates',
      desc: '• CSV 파일에서 위험률 테이블 로드\n• 사망률·발생률·해약률 지원\n• 연령·성별 컬럼 자동 인식\n• 미리보기 및 컬럼 필터링 지원',
    },
    {
      icon: '🔨', title: 'Rating Basis Builder',
      desc: '• 계약 나이·성별 기준 필터링\n• 보험기간·납입기간 슬라이싱\n• 예정이율 기반 현가계수(vₓ) 자동 계산\n• 복수 위험률 동시 선택 가능',
    },
    {
      icon: '📐', title: 'Rate Modifier',
      desc: '• 기존 컬럼에 수식 적용 신규 열 생성\n• 예) 사망률 × 보험금액 → 가중 위험률\n• 복수 수식 체인 적용 가능\n• 결과 테이블 즉시 미리보기',
    },
  ];

  const COL_GAP = 0.16, ROW_GAP = 0.10, cols = 4;
  const colW = (L.W - COL_GAP * (cols - 1)) / cols;
  const cardStartY = flowY + flowH + 0.18;
  const cardH = calcCardH(cardStartY, 1, ROW_GAP);

  cards.forEach((card, i) => {
    const cx = L.XL + i * (colW + COL_GAP);
    assertInBounds(cardStartY, cardH, `step5card[${i}]`);
    s.addShape('rect', { x: cx, y: cardStartY, w: colW, h: cardH, fill: { color: C.card }, line: { color: C.border, width: 0.75 } });
    s.addText(`${card.icon}  ${card.title}`, {
      x: cx + 0.12, y: cardStartY + 0.10, w: colW - 0.24, h: cardH * 0.28,
      fontSize: 15, bold: true, color: C.navy, fontFace: F, valign: 'top', fit: 'shrink', wrap: false,
    });
    s.addText(card.desc, {
      x: cx + 0.12, y: cardStartY + 0.10 + cardH * 0.28 + 0.06, w: colW - 0.24, h: cardH * 0.58,
      fontSize: 13, color: C.dark, fontFace: F, valign: 'top', wrap: true, fit: 'shrink', lineSpacingMultiple: 1.3,
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 슬라이드 6 — 교환함수 계산
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addHeader(s, '04', '교환함수 단계별 계산');

  s.addText('생존자수부터 NNX·MMX까지 — 순보험료 산출에 필요한 모든 교환함수를 단계별로 자동 계산합니다.', {
    x: L.XL, y: L.Y0, w: L.W, h: 0.42,
    fontSize: 16, color: C.dark, fontFace: F, valign: 'middle', wrap: true, fit: 'shrink',
  });

  // 계산 흐름도
  const flowItems = [
    { label: 'lx\n생존자수', color: '1E3A5F' },
    { label: 'dx · Cx\n청구함수', color: '1D4ED8' },
    { label: 'Nx · Mx\n통환함수', color: '0369A1' },
    { label: 'NNX · MMX\n집계함수', color: '0891B2' },
    { label: 'PP\n순보험료', color: C.green },
  ];
  const arrowY = L.Y0 + 0.48;
  const fItemW = (L.W - 0.16 * (flowItems.length - 1)) / flowItems.length;
  const fItemH = 0.82;
  flowItems.forEach((fi, i) => {
    const fx = L.XL + i * (fItemW + 0.16);
    s.addShape('rect', { x: fx, y: arrowY, w: fItemW, h: fItemH, fill: { color: fi.color }, line: { width: 0 } });
    s.addText(fi.label, { x: fx + 0.06, y: arrowY + 0.06, w: fItemW - 0.12, h: fItemH - 0.12, fontSize: 15, bold: true, color: C.white, fontFace: F, align: 'center', valign: 'middle', wrap: true, fit: 'shrink' });
    if (i < flowItems.length - 1) s.addText('›', { x: fx + fItemW, y: arrowY + fItemH * 0.25, w: 0.16, h: fItemH * 0.50, fontSize: 20, color: C.accent, fontFace: F, align: 'center', valign: 'middle' });
  });

  // 상세 카드 (4개 — 계산 모듈별)
  const mods = [
    {
      icon: '👥', title: 'Survivors Calculator',
      desc: '• lx (생존자수) 연도별 계산\n• 단일/복수 위험률 동시 처리\n• 사망자수(dx) 자동 산출\n• 고정 초기 생존자 수(l₀) 설정 가능',
    },
    {
      icon: '💰', title: 'Claims Calculator',
      desc: '• dx·보험금 기반 청구액 계산\n• 현가계수 적용 Cx 산출\n• 복수 보장 항목 병렬 계산\n• 교환함수 Dx 동시 계산',
    },
    {
      icon: '🔢', title: 'Nx Mx Calculator',
      desc: '• Dx 누적합 → Nx 통환함수\n• Cx 누적합 → Mx 통환함수\n• 납입공제 옵션(0 / 0.25 / 0.5)\n• 연도별 지급비율 설정 지원',
    },
    {
      icon: '📊', title: 'NNX MMX Calculator',
      desc: '• Nx 누적합 → NNX 집계함수\n• Mx 기반 MMX(BPV) 계산\n• 복수 보장 항목 통합 집계\n• 보험료 산출 수식에 직접 활용',
    },
  ];

  const COL_GAP = 0.16, cols = 4;
  const colW = (L.W - COL_GAP * (cols - 1)) / cols;
  const cardStartY = arrowY + fItemH + 0.18;
  const cardH = calcCardH(cardStartY, 1, 0.10);

  mods.forEach((mod, i) => {
    const cx = L.XL + i * (colW + COL_GAP);
    assertInBounds(cardStartY, cardH, `calcCard[${i}]`);
    s.addShape('rect', { x: cx, y: cardStartY, w: colW, h: cardH, fill: { color: C.card }, line: { color: C.border, width: 0.75 } });
    s.addText(`${mod.icon}  ${mod.title}`, {
      x: cx + 0.12, y: cardStartY + 0.10, w: colW - 0.24, h: cardH * 0.28,
      fontSize: 15, bold: true, color: C.navy, fontFace: F, valign: 'top', fit: 'shrink', wrap: false,
    });
    s.addText(mod.desc, {
      x: cx + 0.12, y: cardStartY + 0.10 + cardH * 0.28 + 0.06, w: colW - 0.24, h: cardH * 0.60,
      fontSize: 13, color: C.dark, fontFace: F, valign: 'top', wrap: true, fit: 'shrink', lineSpacingMultiple: 1.3,
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 슬라이드 7 — 순보험료 & 영업보험료
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addHeader(s, '05', '순보험료 & 영업보험료 산출');

  const leftW = (L.W - 0.24) / 2;
  const rightX = L.XL + leftW + 0.24;

  // ── 왼쪽: 순보험료 ──────────────────────────────────────────────────────────
  s.addShape('rect', { x: L.XL, y: L.Y0, w: leftW, h: L.AH, fill: { color: 'EFF6FF' }, line: { color: 'BFDBFE', width: 1 } });
  s.addText('🧮 순보험료 계산기 (Net Premium Calculator)', {
    x: L.XL + 0.14, y: L.Y0 + 0.12, w: leftW - 0.28, h: 0.50,
    fontSize: 18, bold: true, color: C.navy, fontFace: F, valign: 'middle', fit: 'shrink',
  });
  s.addShape('rect', { x: L.XL + 0.14, y: L.Y0 + 0.66, w: leftW - 0.28, h: 0.02, fill: { color: 'BFDBFE' }, line: { width: 0 } });

  // 수식 예시 박스
  const fBoxY = L.Y0 + 0.74;
  s.addShape('rect', { x: L.XL + 0.14, y: fBoxY, w: leftW - 0.28, h: 0.68, fill: { color: '1E293B' }, line: { width: 0 } });
  s.addText('PP = MMX_사망 / NNX_사망', {
    x: L.XL + 0.20, y: fBoxY + 0.08, w: leftW - 0.40, h: 0.52,
    fontSize: 16, color: '7DD3FC', fontFace: 'Courier New',
    valign: 'middle', wrap: true, fit: 'shrink',
  });

  const npItems = [
    '• 사용자 정의 수식으로 순보험료 계산',
    '• NNX·MMX·추가변수 자동 대입',
    '• 수식 미리보기: 숫자 대입 결과 확인',
    '• 변수명 충돌 자동 검출 및 알림',
    '• 순보험료(PP) 결과 다음 모듈로 전달',
  ];
  npItems.forEach((item, i) => {
    const iy = fBoxY + 0.75 + i * 0.58;
    if (iy + 0.50 < L.YB) {
      s.addText(item, {
        x: L.XL + 0.18, y: iy, w: leftW - 0.36, h: 0.50,
        fontSize: 15, color: C.black, fontFace: F, valign: 'top', wrap: true, fit: 'shrink',
      });
    }
  });

  // ── 오른쪽: 영업보험료 ─────────────────────────────────────────────────────
  s.addShape('rect', { x: rightX, y: L.Y0, w: leftW, h: L.AH, fill: { color: 'F0FDF4' }, line: { color: 'BBF7D0', width: 1 } });
  s.addText('💵 영업보험료 계산기 (Gross Premium Calculator)', {
    x: rightX + 0.14, y: L.Y0 + 0.12, w: leftW - 0.28, h: 0.50,
    fontSize: 18, bold: true, color: C.navy, fontFace: F, valign: 'middle', fit: 'shrink',
  });
  s.addShape('rect', { x: rightX + 0.14, y: L.Y0 + 0.66, w: leftW - 0.28, h: 0.02, fill: { color: 'BBF7D0' }, line: { width: 0 } });

  const gfBoxY = L.Y0 + 0.74;
  s.addShape('rect', { x: rightX + 0.14, y: gfBoxY, w: leftW - 0.28, h: 0.68, fill: { color: '1E293B' }, line: { width: 0 } });
  s.addText('GP = PP / (1 - α₁ - β₁)', {
    x: rightX + 0.20, y: gfBoxY + 0.08, w: leftW - 0.40, h: 0.52,
    fontSize: 16, color: '86EFAC', fontFace: 'Courier New',
    valign: 'middle', wrap: true, fit: 'shrink',
  });

  const gpItems = [
    '• 순보험료(PP) 기반 영업보험료 산출',
    '• 부가보험료(α₁·α₂·β₁·β₂·γ) 자동 반영',
    '• 사용자 정의 수식 지원 (복잡한 부가 구조)',
    '• 추가변수(Additional Variables) 활용 가능',
    '• 결과 데이터 테이블 형태로 미리보기',
  ];
  gpItems.forEach((item, i) => {
    const iy = gfBoxY + 0.75 + i * 0.58;
    if (iy + 0.50 < L.YB) {
      s.addText(item, {
        x: rightX + 0.18, y: iy, w: leftW - 0.36, h: 0.50,
        fontSize: 15, color: C.black, fontFace: F, valign: 'top', wrap: true, fit: 'shrink',
      });
    }
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 슬라이드 8 — 적립금 & 시나리오
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addHeader(s, '06', '책임준비금 & 시나리오 분석');

  s.addText('영업보험료 산출 이후 — 책임준비금을 계산하고 다양한 조건에서 시나리오 분석을 수행합니다.', {
    x: L.XL, y: L.Y0, w: L.W, h: 0.42,
    fontSize: 16, color: C.dark, fontFace: F, valign: 'middle', wrap: true, fit: 'shrink',
  });

  const leftW = (L.W - 0.24) / 2;
  const rightX = L.XL + leftW + 0.24;
  const topH = L.AH * 0.48;
  const botY = L.Y0 + 0.48 + topH + 0.12;
  const botH = L.YB - botY - 0.05;

  // 적립금 카드
  s.addShape('rect', { x: L.XL, y: L.Y0 + 0.48, w: leftW, h: topH, fill: { color: C.card }, line: { color: C.border, width: 1 } });
  s.addText('📒 Reserve Calculator (적립금 계산기)', {
    x: L.XL + 0.14, y: L.Y0 + 0.58, w: leftW - 0.28, h: 0.44,
    fontSize: 17, bold: true, color: C.navy, fontFace: F, valign: 'middle', fit: 'shrink',
  });
  const resItems = [
    '• 납입기간 이내/이후 조건부 수식 적용',
    '• 공식: V = (MMX_t - MMX_n) - GP × (NNX_t - NNX_n)',
    '• 연도별 책임준비금 테이블 자동 생성',
    '• 영업보험료 산출 결과에서 직접 연결',
  ];
  resItems.forEach((item, i) => {
    const ry = L.Y0 + 0.48 + 0.55 + 0.44 + i * 0.52;
    if (ry + 0.44 < L.Y0 + 0.48 + topH) {
      s.addText(item, { x: L.XL + 0.18, y: ry, w: leftW - 0.36, h: 0.44, fontSize: 14, color: C.dark, fontFace: F, valign: 'top', wrap: true, fit: 'shrink' });
    }
  });

  // 시나리오 러너 카드
  s.addShape('rect', { x: rightX, y: L.Y0 + 0.48, w: leftW, h: topH, fill: { color: 'EFF6FF' }, line: { color: 'BFDBFE', width: 1 } });
  s.addText('🔄 Scenario Runner (시나리오 실행기)', {
    x: rightX + 0.14, y: L.Y0 + 0.58, w: leftW - 0.28, h: 0.44,
    fontSize: 17, bold: true, color: C.navy, fontFace: F, valign: 'middle', fit: 'shrink',
  });
  const scItems = [
    '• 복수 시나리오 조건(나이·성별·이율) 설정',
    '• 전체 파이프라인을 각 시나리오별 자동 반복',
    '• 결과 집계 테이블로 비교 분석',
    '• 다운로드(CSV/Excel) 및 보고서 연계',
  ];
  scItems.forEach((item, i) => {
    const ry = L.Y0 + 0.48 + 0.55 + 0.44 + i * 0.52;
    if (ry + 0.44 < L.Y0 + 0.48 + topH) {
      s.addText(item, { x: rightX + 0.18, y: ry, w: leftW - 0.36, h: 0.44, fontSize: 14, color: C.dark, fontFace: F, valign: 'top', wrap: true, fit: 'shrink' });
    }
  });

  // 하단 — Additional Variables
  assertInBounds(botY, botH, 'botCard');
  s.addShape('rect', { x: L.XL, y: botY, w: L.W, h: botH, fill: { color: 'FFF7ED' }, line: { color: 'FED7AA', width: 1 } });
  s.addText('🏷️  Additional Variables — 추가 변수 정의 모듈', {
    x: L.XL + 0.16, y: botY + 0.10, w: L.W * 0.35, h: 0.44,
    fontSize: 16, bold: true, color: C.navy, fontFace: F, valign: 'middle', fit: 'shrink',
  });
  s.addText(
    '사용자 정의 변수(α₁·α₂·β·γ 등) 또는 테이블에서 추출한 값(NNX_사망, MMX_질병 등)을 이름·값으로 등록해 순보험료·영업보험료 수식에 직접 활용',
    {
      x: L.XL + L.W * 0.36, y: botY + 0.08, w: L.W * 0.62, h: botH - 0.16,
      fontSize: 14, color: C.dark, fontFace: F, valign: 'middle', wrap: true, fit: 'shrink',
    }
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 슬라이드 9 — AI 파이프라인 자동 생성
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addHeader(s, '07', 'AI 파이프라인 자동 생성 (Gemini)');

  const leftW = (L.W - 0.24) / 2;
  const rightX = L.XL + leftW + 0.24;

  // 왼쪽 — 목표 기반
  s.addShape('rect', { x: L.XL, y: L.Y0, w: leftW, h: L.AH, fill: { color: 'EFF6FF' }, line: { color: 'BFDBFE', width: 1 } });
  s.addText('🎯 목표 기반 파이프라인 생성', { x: L.XL + 0.14, y: L.Y0 + 0.12, w: leftW - 0.28, h: 0.44, fontSize: 19, bold: true, color: C.navy, fontFace: F, valign: 'middle', fit: 'shrink' });
  s.addShape('rect', { x: L.XL + 0.14, y: L.Y0 + 0.60, w: leftW - 0.28, h: 0.02, fill: { color: 'BFDBFE' }, line: { width: 0 } });

  // 입력 예시 박스
  s.addShape('rect', { x: L.XL + 0.14, y: L.Y0 + 0.70, w: leftW - 0.28, h: 0.72, fill: { color: '1E293B' }, line: { width: 0 } });
  s.addText('"40세 남성 20년납 종신보험\n순보험료와 영업보험료 산출"', {
    x: L.XL + 0.20, y: L.Y0 + 0.76, w: leftW - 0.40, h: 0.58,
    fontSize: 14, color: '7DD3FC', fontFace: 'Courier New',
    valign: 'middle', wrap: true, fit: 'shrink', italic: true,
  });

  const goalSteps = [
    '① 자연어로 분석 목표 입력',
    '② Gemini AI가 필요 모듈 및 순서 추론',
    '③ DSL 코드 자동 생성',
    '④ 캔버스에 파이프라인 자동 배치',
    '⑤ 파라미터 기본값 자동 설정',
    '⑥ 즉시 실행 가능한 상태로 완성',
  ];
  goalSteps.forEach((step, i) => {
    const sy = L.Y0 + 1.52 + i * 0.66;
    if (sy + 0.58 < L.YB) {
      s.addText(step, { x: L.XL + 0.18, y: sy, w: leftW - 0.36, h: 0.58, fontSize: 15, color: C.black, fontFace: F, valign: 'top', wrap: true, fit: 'shrink' });
    }
  });

  // 오른쪽 — 위험률 데이터 기반
  s.addShape('rect', { x: rightX, y: L.Y0, w: leftW, h: L.AH, fill: { color: 'F0FDF4' }, line: { color: 'BBF7D0', width: 1 } });
  s.addText('📂 위험률 데이터 기반 생성', { x: rightX + 0.14, y: L.Y0 + 0.12, w: leftW - 0.28, h: 0.44, fontSize: 19, bold: true, color: C.navy, fontFace: F, valign: 'middle', fit: 'shrink' });
  s.addShape('rect', { x: rightX + 0.14, y: L.Y0 + 0.60, w: leftW - 0.28, h: 0.02, fill: { color: 'BBF7D0' }, line: { width: 0 } });

  s.addShape('rect', { x: rightX + 0.14, y: L.Y0 + 0.70, w: leftW - 0.28, h: 0.72, fill: { color: '1E293B' }, line: { width: 0 } });
  s.addText('"risk_rates.csv — 컬럼: Age, Sex,\nMortality_Rate, Lapse_Rate, ..."', {
    x: rightX + 0.20, y: L.Y0 + 0.76, w: leftW - 0.40, h: 0.58,
    fontSize: 14, color: '86EFAC', fontFace: 'Courier New',
    valign: 'middle', wrap: true, fit: 'shrink', italic: true,
  });

  const dataSteps = [
    '① 위험률 CSV 파일 업로드',
    '② 컬럼 구조 자동 파악',
    '③ Gemini가 적합한 계산 파이프라인 제안',
    '④ 위험률 컬럼 자동 매핑·모듈 구성',
    '⑤ 원클릭 캔버스 적용',
    '⑥ 즉시 실행하여 보험료 결과 확인',
  ];
  dataSteps.forEach((step, i) => {
    const sy = L.Y0 + 1.52 + i * 0.66;
    if (sy + 0.58 < L.YB) {
      s.addText(step, { x: rightX + 0.18, y: sy, w: leftW - 0.36, h: 0.58, fontSize: 15, color: C.black, fontFace: F, valign: 'top', wrap: true, fit: 'shrink' });
    }
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 슬라이드 10 — DSL 에디터 & 샘플 라이브러리
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addHeader(s, '08', 'DSL 에디터 & 샘플 라이브러리');

  const leftW = L.W * 0.50;
  const rightX = L.XL + leftW + 0.20;
  const rightW = L.W - leftW - 0.20;

  // ── 좌측: DSL 에디터 ────────────────────────────────────────────────────────
  const codeH = 2.70;
  const codeY = L.Y0;
  s.addShape('rect', { x: L.XL, y: codeY, w: leftW, h: codeH, fill: { color: '1E293B' }, line: { color: '334155', width: 1 } });
  s.addText('DSL 파이프라인 예시', {
    x: L.XL + 0.14, y: codeY + 0.06, w: leftW - 0.28, h: 0.28,
    fontSize: 13, color: '64748B', fontFace: 'Courier New', valign: 'middle',
  });
  const code = `PIPELINE "종신보험 순보험료" {
  MODULE DefinePolicyInfo AS policy {
    entryAge: 40, gender: "Male"
    policyTerm: 80, paymentTerm: 20
    interestRate: 2.5
  }
  MODULE LoadData AS rates {
    source: "mortality.csv"
  }
  MODULE SelectRiskRates AS basis {
    INPUT rates.data → risk_data_in
  }
  MODULE CalculateSurvivors AS lx {
    INPUT basis.data → data_in
  }
  MODULE NetPremiumCalculator AS np {
    formula: "MMX / NNX"
  }
}`;
  s.addText(code, {
    x: L.XL + 0.14, y: codeY + 0.38, w: leftW - 0.28, h: codeH - 0.50,
    fontSize: 12, color: '7DD3FC', fontFace: 'Courier New',
    valign: 'top', wrap: true, fit: 'shrink', lineSpacingMultiple: 1.3,
  });

  // DSL 기능 카드 (2×2)
  const dslCards = [
    { icon: '✏️', title: '인라인 편집', desc: '모듈별 버튼으로 해당 블록 직접 수정' },
    { icon: '🔄', title: '실시간 동기화', desc: '저장 시 캔버스 즉시 업데이트' },
    { icon: '📁', title: '.lifx 저장', desc: 'JSON 기반 파이프라인 파일 저장·공유' },
    { icon: '🤖', title: 'AI 자동 생성', desc: '자연어 → DSL 코드 자동 변환' },
  ];
  const dslCardStartY = codeY + codeH + 0.14;
  const dslCols = 2, dslGap = 0.14;
  const dslColW = (leftW - dslGap) / dslCols;
  const dslCardH = calcCardH(dslCardStartY, 2, 0.10);
  dslCards.forEach((dc, i) => {
    const col = i % dslCols, row = Math.floor(i / dslCols);
    const cx = L.XL + col * (dslColW + dslGap);
    const cy = dslCardStartY + row * (dslCardH + 0.10);
    addCard(s, cx, cy, dslColW, dslCardH, dc.icon, dc.title, dc.desc, 16, 13);
  });

  // ── 우측: 샘플 라이브러리 ────────────────────────────────────────────────────
  s.addShape('rect', { x: rightX, y: L.Y0, w: rightW, h: L.AH, fill: { color: C.card }, line: { color: C.border, width: 1 } });
  s.addText('📚 샘플 파이프라인 라이브러리', {
    x: rightX + 0.14, y: L.Y0 + 0.10, w: rightW - 0.28, h: 0.44,
    fontSize: 18, bold: true, color: C.navy, fontFace: F, valign: 'middle', fit: 'shrink',
  });
  s.addShape('rect', { x: rightX + 0.14, y: L.Y0 + 0.58, w: rightW - 0.28, h: 0.02, fill: { color: C.border }, line: { width: 0 } });

  const sFeats = [
    { icon: '☁️', text: 'Supabase 클라우드 동기화' },
    { icon: '🗄️', text: 'SQLite 로컬 저장소' },
    { icon: '📂', text: '.lifx 파일 직접 불러오기' },
    { icon: '✏️', text: '샘플 메타데이터 편집' },
    { icon: '📎', text: '첨부파일 삭제·재업로드' },
    { icon: '🔖', text: '카테고리·태그 분류' },
    { icon: '🔍', text: '샘플 검색 및 필터링' },
    { icon: '💾', text: '개인 작업물 저장·불러오기' },
  ];
  sFeats.forEach((sf, i) => {
    const fy = L.Y0 + 0.70 + i * 0.62;
    if (fy + 0.54 < L.YB) {
      s.addText(`${sf.icon}  ${sf.text}`, {
        x: rightX + 0.18, y: fy, w: rightW - 0.36, h: 0.54,
        fontSize: 14, color: C.black, fontFace: F, valign: 'middle', wrap: false, fit: 'shrink',
      });
    }
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 슬라이드 11 — 보고서 & 기술 스택
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addHeader(s, '09', '보고서 생성 & 기술 스택');

  // 보고서 섹션 (상단 절반)
  const topH = L.AH * 0.46;
  s.addText('📊 자동 보고서 생성', {
    x: L.XL, y: L.Y0, w: L.W, h: 0.38,
    fontSize: 17, bold: true, color: C.navy, fontFace: F, valign: 'middle',
  });

  const reports = [
    { icon: '📋', title: 'Pipeline Explainer', desc: '각 모듈 계산 설명\n수식·파라미터 자동 문서화\n감사 테이블 포함' },
    { icon: '📑', title: 'Slide Report (PPTX)', desc: 'pptxgenjs 기반 슬라이드\n모듈별 결과 자동 슬라이드화\n기업용 보고서 스타일' },
    { icon: '💻', title: 'Pipeline Execution Log', desc: '실행 단계별 로그\n오류 위치 추적\n코드 스니펫 출력' },
  ];
  const rCols = 3, rGap = 0.16;
  const rColW = (L.W - rGap * (rCols - 1)) / rCols;
  const rY = L.Y0 + 0.42;
  const rH = topH - 0.42;
  reports.forEach((r, i) => {
    const cx = L.XL + i * (rColW + rGap);
    addCard(s, cx, rY, rColW, rH, r.icon, r.title, r.desc, 17, 14);
  });

  // 기술 스택 (하단 절반)
  const botY = L.Y0 + topH + 0.14;
  s.addShape('rect', { x: L.XL, y: botY - 0.06, w: L.W, h: 0.02, fill: { color: C.border }, line: { width: 0 } });
  s.addText('🛠️ 기술 스택', {
    x: L.XL, y: botY + 0.02, w: L.W, h: 0.36,
    fontSize: 17, bold: true, color: C.navy, fontFace: F, valign: 'middle',
  });

  const stacks = [
    { icon: '⚛️', name: 'React 19', desc: 'UI 프레임워크\n고성능 캔버스 렌더링' },
    { icon: '🔷', name: 'TypeScript', desc: '엄격한 타입 정의\n모듈·포트 인터페이스' },
    { icon: '⚡', name: 'Vite 6', desc: '빠른 HMR 개발\n최적화 프로덕션 빌드' },
    { icon: '🤖', name: 'Gemini AI', desc: '파이프라인 자동 생성\nDSL 코드 자동 작성' },
    { icon: '🗄️', name: 'Supabase', desc: '클라우드 샘플 저장\nRLS 보안 정책' },
    { icon: '📊', name: 'pptxgenjs', desc: '슬라이드 보고서\n기업용 포맷 출력' },
    { icon: '💾', name: 'better-sqlite3', desc: '로컬 샘플 저장\n오프라인 지원' },
    { icon: '🌐', name: 'Express', desc: '파일 업로드 API\nRender 배포 지원' },
  ];

  const sCols = 8, sGap = 0.10;
  const sColW = (L.W - sGap * (sCols - 1)) / sCols;
  const sY = botY + 0.42;
  const sH = L.YB - sY - 0.05;

  stacks.forEach((st, i) => {
    const cx = L.XL + i * (sColW + sGap);
    assertInBounds(sY, sH, `stack[${i}]`);
    s.addShape('rect', { x: cx, y: sY, w: sColW, h: sH, fill: { color: C.card }, line: { color: C.border, width: 0.75 } });
    s.addText(`${st.icon}`, { x: cx + 0.05, y: sY + 0.08, w: sColW - 0.10, h: sH * 0.28, fontSize: 20, fontFace: F, align: 'center', valign: 'middle', fit: 'shrink' });
    s.addText(st.name, { x: cx + 0.05, y: sY + sH * 0.30, w: sColW - 0.10, h: sH * 0.26, fontSize: 13, bold: true, color: C.navy, fontFace: F, align: 'center', valign: 'middle', fit: 'shrink', wrap: false });
    s.addText(st.desc, { x: cx + 0.05, y: sY + sH * 0.56, w: sColW - 0.10, h: sH * 0.38, fontSize: 11, color: C.sub, fontFace: F, align: 'center', valign: 'top', fit: 'shrink', wrap: true, lineSpacingMultiple: 1.1 });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 슬라이드 12 — 마무리
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  s.addShape('rect', { x: 0, y: 0, w: SLIDE.W, h: SLIDE.H, fill: { color: C.navy }, line: { width: 0 } });
  s.addShape('rect', { x: 0, y: 3.20, w: SLIDE.W, h: 0.10, fill: { color: C.accent }, line: { width: 0 } });

  s.addText('Life Matrix Flow', {
    x: 0.80, y: 0.60, w: SLIDE.W - 1.60, h: 1.10,
    fontSize: 48, bold: true, color: C.white, fontFace: F, align: 'center', valign: 'middle', fit: 'shrink',
  });
  s.addText('생명보험 보험료 자동 산출 시스템', {
    x: 0.80, y: 1.80, w: SLIDE.W - 1.60, h: 0.60,
    fontSize: 24, color: 'A5C8E6', fontFace: F, align: 'center', valign: 'middle', fit: 'shrink',
  });
  s.addText('비주얼 파이프라인으로 위험률 로드부터 순보험료·영업보험료·책임준비금까지\n모든 계산 과정을 자동화하고 AI로 빠르게 구성하세요.', {
    x: 0.80, y: 3.50, w: SLIDE.W - 1.60, h: 0.85,
    fontSize: 18, color: 'CBD5E1', fontFace: F, align: 'center', valign: 'middle', wrap: true, fit: 'shrink',
  });

  const pills = ['비주얼 파이프라인 빌더', '계리 계산 모듈', '순보험료·영업보험료', '책임준비금', 'AI 자동 구성', '슬라이드 보고서'];
  const pillW = 1.90, pillH = 0.50, pillGap = 0.14;
  const totalW = pills.length * pillW + (pills.length - 1) * pillGap;
  const startX = (SLIDE.W - totalW) / 2;
  pills.forEach((pill, i) => {
    const px = startX + i * (pillW + pillGap);
    s.addShape('rect', { x: px, y: 4.55, w: pillW, h: pillH, fill: { color: '1A3252' }, line: { color: C.accent, width: 0.75 } });
    s.addText(pill, { x: px, y: 4.55, w: pillW, h: pillH, fontSize: 11, color: C.white, fontFace: F, align: 'center', valign: 'middle', fit: 'shrink' });
  });

  s.addText('2026 · Life Matrix Flow · 생명보험 계리 자동화 플랫폼', {
    x: 0.80, y: 6.60, w: SLIDE.W - 1.60, h: 0.40,
    fontSize: 13, color: '475569', fontFace: F, align: 'center', valign: 'middle',
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 저장
// ══════════════════════════════════════════════════════════════════════════════
const outputPath = resolveOutputPath(__dirname, 'Presentation');
await pptx.writeFile({ fileName: outputPath });
console.log(`✅ PPT 저장 완료: ${outputPath}`);
