import PptxGenJS from 'pptxgenjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── 출력 파일명 중복 방지 ───────────────────────────────────────────────────
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

// ─── 색상·폰트 ────────────────────────────────────────────────────────────────
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
};
const F = 'Noto Sans KR';

// ─── 유틸 함수 ────────────────────────────────────────────────────────────────
function calcCardH(startY, rows, gap = 0.10, margin = 0.05) {
  const available = (L.YB - margin) - startY;
  const cardH = (available - gap * (rows - 1)) / rows;
  return Math.max(cardH, 0.40);
}

function assertInBounds(y, h, label) {
  const bottom = y + h;
  if (bottom > L.YB + 0.01) {
    console.warn(`⚠ OVERFLOW [${label}]: y=${y.toFixed(3)} + h=${h.toFixed(3)} = ${bottom.toFixed(3)} > YB=${L.YB}`);
  }
}

// ─── 헤더 바 ──────────────────────────────────────────────────────────────────
function addHeader(s, num, title) {
  s.addShape('rect', { x: 0, y: 0, w: SLIDE.W, h: L.HDR, fill: { color: C.navy }, line: { width: 0 } });
  s.addText(`${num}  ${title}`, {
    x: 0.40, y: 0.10, w: SLIDE.W - 0.80, h: 0.82,
    fontSize: 28, bold: true, color: C.white, fontFace: F,
    valign: 'middle', fit: 'shrink',
  });
}

// ─── 카드 그리기 ──────────────────────────────────────────────────────────────
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

// ─── 메인 ─────────────────────────────────────────────────────────────────────
const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';
pptx.title = 'Life Matrix Flow';

// ══════════════════════════════════════════════════════════════════════════════
// 슬라이드 1 — 표지
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  // 배경 상단 블록
  s.addShape('rect', { x: 0, y: 0, w: SLIDE.W, h: 3.80, fill: { color: C.navy }, line: { width: 0 } });
  // 장식 라인
  s.addShape('rect', { x: 0, y: 3.80, w: SLIDE.W, h: 0.08, fill: { color: C.accent }, line: { width: 0 } });

  s.addText('Life Matrix Flow', {
    x: 0.80, y: 0.70, w: SLIDE.W - 1.60, h: 1.30,
    fontSize: 52, bold: true, color: C.white, fontFace: F,
    valign: 'middle', align: 'left', fit: 'shrink',
  });
  s.addText('보험 계리 & 데이터 사이언스 비주얼 파이프라인 빌더', {
    x: 0.80, y: 2.10, w: SLIDE.W - 1.60, h: 0.60,
    fontSize: 22, color: 'A5C8E6', fontFace: F,
    valign: 'middle', align: 'left', fit: 'shrink',
  });
  s.addText('Actuarial Computation · ML Pipeline · XoL Reinsurance · AI Auto-Generation', {
    x: 0.80, y: 2.75, w: SLIDE.W - 1.60, h: 0.50,
    fontSize: 16, color: '7FB3D3', fontFace: F, italic: true,
    valign: 'middle', align: 'left', fit: 'shrink',
  });

  // 하단 태그들
  const tags = ['⚡ React 19', '🔷 TypeScript', '🤖 Gemini AI', '🗄 Supabase', '📊 pptxgenjs'];
  tags.forEach((tag, i) => {
    const tw = 2.10, th = 0.50, gap = 0.18;
    const startX = 0.80;
    s.addShape('rect', {
      x: startX + i * (tw + gap), y: 4.30, w: tw, h: th,
      fill: { color: '1A3252' }, line: { color: C.accent, width: 1 },
    });
    s.addText(tag, {
      x: startX + i * (tw + gap), y: 4.30, w: tw, h: th,
      fontSize: 14, color: C.white, fontFace: F,
      align: 'center', valign: 'middle', fit: 'shrink',
    });
  });

  s.addText('2026 · Actuarial Analytics Platform', {
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
    { num: '01', title: '앱 개요', sub: '비주얼 파이프라인 빌더' },
    { num: '02', title: '비주얼 캔버스', sub: '드래그 & 드롭 파이프라인 편집' },
    { num: '03', title: '생명보험 계리 모듈', sub: '순보험료·적립금 자동 계산' },
    { num: '04', title: '재보험 XoL 가격 산출', sub: 'Excess of Loss 레이어 프라이싱' },
    { num: '05', title: '데이터 사이언스 / ML', sub: '전처리·모델 학습·평가 파이프라인' },
    { num: '06', title: 'AI 파이프라인 자동 생성', sub: 'Gemini AI로 목표 기반 파이프라인 생성' },
    { num: '07', title: 'DSL 파이프라인 에디터', sub: '코드 기반 파이프라인 정의' },
    { num: '08', title: '샘플 라이브러리 & 리포트', sub: 'Supabase 샘플 관리 · 슬라이드 보고서' },
    { num: '09', title: '기술 스택', sub: 'React · TypeScript · Vite · Gemini' },
  ];

  const colW = (L.W - 0.30) / 2;
  const ROW_GAP = 0.08;
  const COL_GAP = 0.30;
  const rows = Math.ceil(items.length / 2);
  const cardH = calcCardH(L.Y0, rows, ROW_GAP);

  items.forEach((item, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = L.XL + col * (colW + COL_GAP);
    const cy = L.Y0 + row * (cardH + ROW_GAP);
    assertInBounds(cy, cardH, `TOC[${i}]`);

    s.addShape('rect', { x: cx, y: cy, w: colW, h: cardH, fill: { color: C.card }, line: { color: C.border, width: 0.75 } });
    // 번호 배지
    s.addShape('rect', { x: cx + 0.12, y: cy + 0.10, w: 0.50, h: cardH * 0.55, fill: { color: C.navy }, line: { width: 0 } });
    s.addText(item.num, {
      x: cx + 0.12, y: cy + 0.10, w: 0.50, h: cardH * 0.55,
      fontSize: 18, bold: true, color: C.white, fontFace: F,
      align: 'center', valign: 'middle', fit: 'shrink',
    });
    s.addText(item.title, {
      x: cx + 0.72, y: cy + 0.10, w: colW - 0.84, h: cardH * 0.45,
      fontSize: 17, bold: true, color: C.black, fontFace: F,
      valign: 'top', fit: 'shrink', wrap: true,
    });
    s.addText(item.sub, {
      x: cx + 0.72, y: cy + 0.10 + cardH * 0.45, w: colW - 0.84, h: cardH * 0.40,
      fontSize: 13, color: C.sub, fontFace: F,
      valign: 'top', fit: 'shrink', wrap: true,
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 슬라이드 3 — 앱 개요
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addHeader(s, '01', '앱 개요');

  s.addText('Life Matrix Flow는 보험 계리 계산과 데이터 사이언스 파이프라인을 하나의 비주얼 캔버스에서 구축·실행하는 플랫폼입니다.', {
    x: L.XL, y: L.Y0, w: L.W, h: 0.55,
    fontSize: 17, color: C.dark, fontFace: F,
    valign: 'middle', wrap: true, fit: 'shrink',
  });

  const cards = [
    { icon: '🎨', title: '비주얼 파이프라인 빌더', desc: '드래그 & 드롭으로 모듈 배치\n포트 연결로 데이터 흐름 구성\n실시간 실행 및 결과 확인' },
    { icon: '🧮', title: '보험 계리 전문 모듈', desc: '생명보험 순보험료 산출\nXoL 재보험 레이어 프라이싱\n시나리오 러너로 다중 계산' },
    { icon: '🤖', title: 'AI 파이프라인 자동 생성', desc: 'Gemini AI 기반 목표 분석\n자연어로 파이프라인 자동 구성\nDSL 코드 자동 생성 및 편집' },
    { icon: '📊', title: '데이터 사이언스 & 리포트', desc: 'ML 모델 학습·평가 파이프라인\n파이프라인 설명서 자동 생성\nPPTX 슬라이드 보고서 출력' },
  ];

  const COL_GAP = 0.18;
  const ROW_GAP = 0.10;
  const colW = (L.W - COL_GAP) / 2;
  const cardStartY = L.Y0 + 0.62;
  const cardH = calcCardH(cardStartY, 2, ROW_GAP);

  cards.forEach((card, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
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

  // 좌측 설명
  const leftW = L.W * 0.44;
  const rightX = L.XL + leftW + 0.25;
  const rightW = L.W - leftW - 0.25;

  const features = [
    { icon: '🖱️', title: '드래그 & 드롭', desc: '툴박스에서 모듈을 캔버스로 드래그\n모듈 이름 인라인 편집 가능' },
    { icon: '🔗', title: '포트 연결', desc: '출력 포트 → 입력 포트 드래그로 연결\n타입 호환 시 자동 연결 허용' },
    { icon: '▶️', title: '실행 & 결과', desc: '파이프라인 순서대로 자동 실행\n각 모듈 결과 미리보기 팝업' },
    { icon: '↩️', title: '히스토리', desc: 'Undo / Redo 지원\nCtrl+Z / Ctrl+Y 단축키 제공' },
    { icon: '🔍', title: '줌 & 이동', desc: '캔버스 줌 인/아웃 (+/–)\n전체 보기 자동 맞춤 기능' },
    { icon: '📦', title: '그룹 & 레이어', desc: '여러 모듈을 그룹으로 묶기\n레이어 패널로 모듈 구조 탐색' },
  ];

  const COL_GAP = 0.16;
  const ROW_GAP = 0.10;
  const cols = 2;
  const colW = (leftW - COL_GAP) / cols;
  const rows = Math.ceil(features.length / cols);
  const cardH = calcCardH(L.Y0, rows, ROW_GAP);

  features.forEach((feat, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = L.XL + col * (colW + COL_GAP);
    const cy = L.Y0 + row * (cardH + ROW_GAP);
    addCard(s, cx, cy, colW, cardH, feat.icon, feat.title, feat.desc, 17, 13);
  });

  // 우측 — 인터페이스 구조 다이어그램
  s.addShape('rect', { x: rightX, y: L.Y0, w: rightW, h: L.AH, fill: { color: 'F0F4F8' }, line: { color: C.border, width: 1 } });
  s.addText('인터페이스 구성', {
    x: rightX + 0.15, y: L.Y0 + 0.12, w: rightW - 0.30, h: 0.38,
    fontSize: 17, bold: true, color: C.navy, fontFace: F, valign: 'middle',
  });

  const zones = [
    { label: '🧰 툴박스 (좌측)', desc: '보험 계리 · ML · 재보험 모듈 카탈로그', color: 'DBEAFE' },
    { label: '🎨 캔버스 (중앙)', desc: '모듈 배치 · 포트 연결 · 실행 상태 표시', color: 'DCFCE7' },
    { label: '⚙️ 속성 패널 (우측)', desc: '선택한 모듈 파라미터 편집', color: 'FEF9C3' },
    { label: '📐 레이어 패널', desc: '모듈 계층 구조 탐색 및 선택', color: 'FCE7F3' },
    { label: '💻 터미널 패널', desc: '실행 로그 · Python/JS 코드 스니펫', color: 'F3E8FF' },
  ];

  const zoneH = (L.AH - 0.55) / zones.length - 0.06;
  zones.forEach((z, i) => {
    const zy = L.Y0 + 0.55 + i * (zoneH + 0.06);
    assertInBounds(zy, zoneH, `zone[${i}]`);
    s.addShape('rect', { x: rightX + 0.12, y: zy, w: rightW - 0.24, h: zoneH, fill: { color: z.color }, line: { color: C.border, width: 0.5 } });
    s.addText(z.label, {
      x: rightX + 0.22, y: zy + 0.04, w: rightW - 0.44, h: zoneH * 0.50,
      fontSize: 15, bold: true, color: C.black, fontFace: F,
      valign: 'top', fit: 'shrink', wrap: false,
    });
    s.addText(z.desc, {
      x: rightX + 0.22, y: zy + 0.04 + zoneH * 0.50, w: rightW - 0.44, h: zoneH * 0.42,
      fontSize: 13, color: C.dark, fontFace: F,
      valign: 'top', fit: 'shrink', wrap: true,
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 슬라이드 5 — 생명보험 계리 모듈
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addHeader(s, '03', '생명보험 계리 모듈');

  s.addText('계약 설계부터 순보험료·적립금 산출까지 필요한 모든 계리 모듈을 제공합니다.', {
    x: L.XL, y: L.Y0, w: L.W, h: 0.42,
    fontSize: 16, color: C.dark, fontFace: F, valign: 'middle', wrap: true, fit: 'shrink',
  });

  const modules = [
    { icon: '📋', title: 'Define Policy Info', desc: '계약 기본 정보 입력\n가입 나이·성별·보험기간·이율\nα, β, γ 기본값 설정' },
    { icon: '📂', title: 'Load Risk Rates', desc: 'CSV 파일에서 위험률 로드\n사망률·발생률·해약률 테이블\n열 선택 및 필터링 지원' },
    { icon: '🔨', title: 'Rating Basis Builder', desc: '보험기간·납입기간 적용\n할인율 기반 현가계수 계산\n성별 필터링 지원' },
    { icon: '📐', title: 'Rate Modifier', desc: '기존 열에 수식 적용\n신규 위험률 열 생성\n복잡한 보정 계수 적용' },
    { icon: '👥', title: 'Survivors Calculator', desc: '생존자수(lx) 계산\n연도별 사망자수 추적\n복수 위험률 동시 처리' },
    { icon: '💰', title: 'Claims & Commutation', desc: 'dx, Cx 청구 함수 계산\nNx, Mx 통환 함수 생성\nNNX, MMX 집계 함수 산출' },
    { icon: '🧮', title: 'Net Premium Calculator', desc: '사용자 정의 수식으로 순보험료\n변수 자동 대입 계산\n수식 미리보기 및 검증' },
    { icon: '💵', title: 'Gross / Reserve', desc: '부가보험료 반영 영업보험료\n납입기간 조건부 적립금 계산\n시나리오별 다중 산출 지원' },
  ];

  const COL_GAP = 0.15;
  const ROW_GAP = 0.09;
  const cols = 4;
  const colW = (L.W - COL_GAP * (cols - 1)) / cols;
  const cardStartY = L.Y0 + 0.48;
  const rows = Math.ceil(modules.length / cols);
  const cardH = calcCardH(cardStartY, rows, ROW_GAP);

  modules.forEach((mod, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = L.XL + col * (colW + COL_GAP);
    const cy = cardStartY + row * (cardH + ROW_GAP);
    addCard(s, cx, cy, colW, cardH, mod.icon, mod.title, mod.desc, 16, 13);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 슬라이드 6 — 재보험 XoL 가격 산출
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addHeader(s, '04', '재보험 XoL (Excess of Loss) 가격 산출');

  s.addText('손해 분포 적합부터 XoL 레이어 보험료 산출까지 재보험 가격 결정 파이프라인을 제공합니다.', {
    x: L.XL, y: L.Y0, w: L.W, h: 0.42,
    fontSize: 16, color: C.dark, fontFace: F, valign: 'middle', wrap: true, fit: 'shrink',
  });

  // 파이프라인 흐름도
  const flowY = L.Y0 + 0.48;
  const flowH = 0.68;
  const steps = [
    { label: '📊 Fit Loss\nDistribution', sub: '손해분포 적합' },
    { label: '📈 Exposure\nCurve', sub: '노출 곡선 생성' },
    { label: '📜 Define XoL\nContract', sub: '계약 조건 정의' },
    { label: '🔢 Price XoL\nLayer', sub: '레이어 보험료' },
    { label: '💸 XoL Loading', sub: '추가 부가액' },
    { label: '✅ Final Price', sub: '최종 가격 산출' },
  ];
  const stepW = (L.W - 0.10 * (steps.length - 1)) / steps.length;
  steps.forEach((st, i) => {
    const sx = L.XL + i * (stepW + 0.10);
    s.addShape('rect', { x: sx, y: flowY, w: stepW, h: flowH, fill: { color: C.navy }, line: { width: 0 } });
    s.addText(st.label, {
      x: sx + 0.06, y: flowY + 0.04, w: stepW - 0.12, h: flowH * 0.65,
      fontSize: 13, bold: true, color: C.white, fontFace: F,
      align: 'center', valign: 'middle', wrap: true, fit: 'shrink',
    });
    s.addText(st.sub, {
      x: sx + 0.06, y: flowY + flowH * 0.68, w: stepW - 0.12, h: flowH * 0.28,
      fontSize: 11, color: 'A5C8E6', fontFace: F,
      align: 'center', valign: 'middle', fit: 'shrink', wrap: false,
    });
    // 화살표
    if (i < steps.length - 1) {
      s.addText('›', {
        x: sx + stepW, y: flowY + flowH * 0.25, w: 0.10, h: flowH * 0.50,
        fontSize: 18, color: C.accent, fontFace: F, align: 'center', valign: 'middle',
      });
    }
  });

  // 상세 카드
  const cards = [
    { icon: '📊', title: '손해 분포 적합', desc: '파레토·대수정규·감마 분포\n최대우도추정(MLE) 자동 적합\n적합도 검정 결과 제공' },
    { icon: '📈', title: '노출 곡선', desc: '임계값별 초과 손실 비율 산출\n레이어 기대손실 추정에 활용\n커스텀 커브 포인트 설정' },
    { icon: '📋', title: 'XoL 계약 정의', desc: '보유액(Retention) 설정\n한도(Limit) 및 연간 집계 정의\n복수 레이어 구성 지원' },
    { icon: '💡', title: '최종 가격 산출', desc: '순보험료·변동성 마진 계산\n사업비 반영 최종 보험료\nRoL% 기준 가격 산출' },
  ];

  const COL_GAP = 0.18;
  const ROW_GAP = 0.10;
  const colW = (L.W - COL_GAP * 3) / 4;
  const cardStartY = flowY + flowH + 0.15;
  const cardH = calcCardH(cardStartY, 1, ROW_GAP);

  cards.forEach((card, i) => {
    const cx = L.XL + i * (colW + COL_GAP);
    addCard(s, cx, cardStartY, colW, cardH, card.icon, card.title, card.desc, 17, 13);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 슬라이드 7 — 데이터 사이언스 / ML
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addHeader(s, '05', '데이터 사이언스 / 머신러닝 파이프라인');

  s.addText('데이터 전처리부터 모델 학습·평가까지 완전한 ML 파이프라인을 비주얼로 구성합니다.', {
    x: L.XL, y: L.Y0, w: L.W, h: 0.42,
    fontSize: 16, color: C.dark, fontFace: F, valign: 'middle', wrap: true, fit: 'shrink',
  });

  const groups = [
    {
      title: '🔧 데이터 전처리',
      color: 'EFF6FF',
      border: 'BFDBFE',
      items: ['LoadData · SelectData', '결측값 처리 (HandleMissing)', '범주형 인코딩 (Encode)', '정규화 (Normalize)', '데이터 분할 (SplitData)', '리샘플링 (Resample)'],
    },
    {
      title: '🎯 지도학습 모델',
      color: 'F0FDF4',
      border: 'BBF7D0',
      items: ['선형 회귀 / 로지스틱 회귀', '의사결정 나무', '랜덤 포레스트', 'SVM · KNN · NaiveBayes', 'LDA · StatModels', 'TrainModel → ScoreModel → Evaluate'],
    },
    {
      title: '🔍 비지도학습',
      color: 'FFF7ED',
      border: 'FED7AA',
      items: ['K-Means 클러스터링', '계층적 클러스터링', 'DBSCAN 밀도 기반', 'PCA 차원 축소', '클러스터 결과 시각화', '변환 데이터 미리보기'],
    },
  ];

  const COL_GAP = 0.20;
  const colW = (L.W - COL_GAP * (groups.length - 1)) / groups.length;
  const cardStartY = L.Y0 + 0.48;
  const cardH = L.YB - cardStartY - 0.05;

  groups.forEach((grp, i) => {
    const cx = L.XL + i * (colW + COL_GAP);
    assertInBounds(cardStartY, cardH, `grp[${i}]`);
    s.addShape('rect', { x: cx, y: cardStartY, w: colW, h: cardH, fill: { color: grp.color }, line: { color: grp.border, width: 1 } });
    s.addText(grp.title, {
      x: cx + 0.14, y: cardStartY + 0.12, w: colW - 0.28, h: 0.42,
      fontSize: 18, bold: true, color: C.navy, fontFace: F,
      valign: 'middle', fit: 'shrink', wrap: false,
    });
    s.addShape('rect', { x: cx + 0.14, y: cardStartY + 0.58, w: colW - 0.28, h: 0.02, fill: { color: grp.border }, line: { width: 0 } });

    const itemH = (cardH - 0.70) / grp.items.length - 0.02;
    grp.items.forEach((item, j) => {
      const iy = cardStartY + 0.68 + j * (itemH + 0.02);
      assertInBounds(iy, itemH, `grp[${i}]item[${j}]`);
      s.addText(`• ${item}`, {
        x: cx + 0.18, y: iy, w: colW - 0.36, h: Math.max(itemH, 0.25),
        fontSize: 14, color: C.dark, fontFace: F,
        valign: 'top', wrap: true, fit: 'shrink', lineSpacingMultiple: 1.1,
      });
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 슬라이드 8 — AI 파이프라인 자동 생성
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addHeader(s, '06', 'AI 파이프라인 자동 생성 (Gemini)');

  // 두 가지 AI 기능
  const leftW = (L.W - 0.24) / 2;
  const rightX = L.XL + leftW + 0.24;

  // 왼쪽 — 목표 기반 생성
  s.addShape('rect', { x: L.XL, y: L.Y0, w: leftW, h: L.AH, fill: { color: 'EFF6FF' }, line: { color: 'BFDBFE', width: 1 } });
  s.addText('🎯 목표 기반 파이프라인 생성', {
    x: L.XL + 0.14, y: L.Y0 + 0.12, w: leftW - 0.28, h: 0.44,
    fontSize: 19, bold: true, color: C.navy, fontFace: F, valign: 'middle', fit: 'shrink',
  });
  s.addText('AIPipelineFromGoalModal', {
    x: L.XL + 0.14, y: L.Y0 + 0.58, w: leftW - 0.28, h: 0.30,
    fontSize: 13, color: C.sub, fontFace: F, italic: true, valign: 'middle', fit: 'shrink',
  });

  const goalSteps = [
    '① 분석 목표 자연어로 입력',
    '   (예: "40세 남성 종신보험 순보험료 계산")',
    '② Gemini가 필요 모듈 목록 추론',
    '③ DSL 코드 자동 생성',
    '④ 캔버스에 파이프라인 자동 배치',
    '⑤ 파라미터 기본값 자동 설정',
  ];
  goalSteps.forEach((step, i) => {
    const sy = L.Y0 + 0.96 + i * 0.70;
    if (sy + 0.62 < L.YB) {
      s.addText(step, {
        x: L.XL + 0.14, y: sy, w: leftW - 0.28, h: 0.62,
        fontSize: 15, color: step.startsWith(' ') ? C.sub : C.black, fontFace: F, italic: step.startsWith(' '),
        valign: 'top', wrap: true, fit: 'shrink',
      });
    }
  });

  // 오른쪽 — 데이터 기반 생성
  s.addShape('rect', { x: rightX, y: L.Y0, w: leftW, h: L.AH, fill: { color: 'F0FDF4' }, line: { color: 'BBF7D0', width: 1 } });
  s.addText('📂 데이터 기반 파이프라인 생성', {
    x: rightX + 0.14, y: L.Y0 + 0.12, w: leftW - 0.28, h: 0.44,
    fontSize: 19, bold: true, color: C.navy, fontFace: F, valign: 'middle', fit: 'shrink',
  });
  s.addText('AIPipelineFromDataModal', {
    x: rightX + 0.14, y: L.Y0 + 0.58, w: leftW - 0.28, h: 0.30,
    fontSize: 13, color: C.sub, fontFace: F, italic: true, valign: 'middle', fit: 'shrink',
  });

  const dataSteps = [
    '① 데이터 파일(CSV/Excel) 업로드',
    '② 컬럼 구조 자동 파악',
    '③ Gemini가 적합한 분석 파이프라인 제안',
    '④ 모델 유형·파라미터 자동 추천',
    '⑤ 원클릭 캔버스 적용',
    '⑥ 즉시 실행 가능한 상태로 구성',
  ];
  dataSteps.forEach((step, i) => {
    const sy = L.Y0 + 0.96 + i * 0.70;
    if (sy + 0.62 < L.YB) {
      s.addText(step, {
        x: rightX + 0.14, y: sy, w: leftW - 0.28, h: 0.62,
        fontSize: 15, color: C.black, fontFace: F,
        valign: 'top', wrap: true, fit: 'shrink',
      });
    }
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 슬라이드 9 — DSL 파이프라인 에디터
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addHeader(s, '07', 'DSL 파이프라인 에디터');

  s.addText('코드 기반으로 파이프라인을 정의하고 편집합니다. 비주얼 캔버스와 실시간으로 동기화됩니다.', {
    x: L.XL, y: L.Y0, w: L.W, h: 0.42,
    fontSize: 16, color: C.dark, fontFace: F, valign: 'middle', wrap: true, fit: 'shrink',
  });

  // DSL 예시 코드 박스
  const codeY = L.Y0 + 0.48;
  const codeH = 2.60;
  s.addShape('rect', { x: L.XL, y: codeY, w: L.W * 0.52, h: codeH, fill: { color: '1E293B' }, line: { color: '334155', width: 1 } });
  s.addText('DSL Example', {
    x: L.XL + 0.15, y: codeY + 0.08, w: L.W * 0.52 - 0.30, h: 0.30,
    fontSize: 13, color: '64748B', fontFace: 'Courier New', valign: 'middle',
  });
  const code = `PIPELINE "종신보험 순보험료 산출" {
  MODULE DefinePolicyInfo AS policy {
    entryAge: 40, gender: "Male"
    policyTerm: 80, paymentTerm: 20
    interestRate: 2.5
  }
  MODULE LoadData AS rates {
    source: "risk_rates.csv"
  }
  MODULE SelectRiskRates AS basis {
    INPUT rates.data → risk_data_in
    INPUT policy.policy_info → policy_info_in
  }
  MODULE NetPremiumCalculator AS np {
    formula: "MMX / NNX"
    INPUT basis.data → data_in
  }
}`;
  s.addText(code, {
    x: L.XL + 0.15, y: codeY + 0.44, w: L.W * 0.52 - 0.30, h: codeH - 0.55,
    fontSize: 12, color: '7DD3FC', fontFace: 'Courier New',
    valign: 'top', wrap: true, fit: 'shrink', lineSpacingMultiple: 1.3,
  });

  // 우측 DSL 기능 카드
  const rX = L.XL + L.W * 0.52 + 0.20;
  const rW = L.W * 0.48 - 0.20;

  const dslFeatures = [
    { icon: '✏️', title: '인라인 편집', desc: '모듈별 편집 버튼 클릭\n해당 모듈 DSL 블록 직접 수정' },
    { icon: '🔄', title: '실시간 동기화', desc: 'DSL 저장 시 캔버스 즉시 업데이트\n비주얼↔코드 양방향 동기화' },
    { icon: '📤', title: '파일 저장/불러오기', desc: '.lifx 포맷으로 전체 파이프라인 저장\n공유 및 재사용 가능한 파이프라인 파일' },
    { icon: '🤖', title: 'AI 자동 완성', desc: 'Gemini 기반 DSL 코드 생성\n자연어 설명 → DSL 변환' },
  ];

  const COL_GAP2 = 0.14;
  const cols2 = 2;
  const cw2 = (rW - COL_GAP2) / cols2;
  const rows2 = Math.ceil(dslFeatures.length / cols2);
  const ch2 = calcCardH(L.Y0 + 0.48, rows2, 0.10);

  dslFeatures.forEach((feat, i) => {
    const col = i % cols2;
    const row = Math.floor(i / cols2);
    const cx2 = rX + col * (cw2 + COL_GAP2);
    const cy2 = L.Y0 + 0.48 + row * (ch2 + 0.10);
    addCard(s, cx2, cy2, cw2, ch2, feat.icon, feat.title, feat.desc, 16, 13);
  });

  // 하단 — 파이프라인 저장 형식 정보
  const infoY = codeY + codeH + 0.15;
  const infoH = L.YB - infoY - 0.05;
  if (infoH > 0.40) {
    s.addShape('rect', { x: L.XL, y: infoY, w: L.W * 0.52, h: infoH, fill: { color: 'FFF7ED' }, line: { color: 'FED7AA', width: 1 } });
    s.addText('📁 .lifx 파일 포맷  |  JSON 기반 파이프라인 직렬화  |  모듈 위치·연결·파라미터 전체 저장', {
      x: L.XL + 0.15, y: infoY + 0.06, w: L.W * 0.52 - 0.30, h: Math.max(infoH - 0.12, 0.25),
      fontSize: 13, color: C.dark, fontFace: F,
      valign: 'middle', wrap: true, fit: 'shrink',
    });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 슬라이드 10 — 샘플 라이브러리 & 리포트
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addHeader(s, '08', '샘플 라이브러리 & 리포트 생성');

  const leftW = (L.W - 0.24) / 2;
  const rightX = L.XL + leftW + 0.24;

  // 샘플 라이브러리 (좌측)
  s.addShape('rect', { x: L.XL, y: L.Y0, w: leftW, h: L.AH, fill: { color: C.card }, line: { color: C.border, width: 1 } });
  s.addText('📚 샘플 파이프라인 라이브러리', {
    x: L.XL + 0.14, y: L.Y0 + 0.12, w: leftW - 0.28, h: 0.44,
    fontSize: 19, bold: true, color: C.navy, fontFace: F, valign: 'middle', fit: 'shrink',
  });
  s.addShape('rect', { x: L.XL + 0.14, y: L.Y0 + 0.60, w: leftW - 0.28, h: 0.02, fill: { color: C.border }, line: { width: 0 } });

  const sampleFeats = [
    '☁️  Supabase 클라우드 동기화',
    '🗄️  SQLite 로컬 저장소',
    '📂  파일(.lifx) 직접 불러오기',
    '✏️  샘플 메타데이터 편집',
    '🗑️  첨부파일 삭제·재업로드',
    '🔖  카테고리 및 태그 분류',
    '🔍  샘플 검색 및 필터링',
    '📤  개인 작업물 저장/불러오기',
  ];
  sampleFeats.forEach((feat, i) => {
    const fy = L.Y0 + 0.72 + i * 0.65;
    if (fy + 0.56 < L.YB) {
      s.addText(feat, {
        x: L.XL + 0.18, y: fy, w: leftW - 0.36, h: 0.56,
        fontSize: 15, color: C.black, fontFace: F,
        valign: 'middle', wrap: true, fit: 'shrink',
      });
    }
  });

  // 리포트 생성 (우측)
  s.addShape('rect', { x: rightX, y: L.Y0, w: leftW, h: L.AH, fill: { color: 'EFF6FF' }, line: { color: 'BFDBFE', width: 1 } });
  s.addText('📊 파이프라인 리포트 생성', {
    x: rightX + 0.14, y: L.Y0 + 0.12, w: leftW - 0.28, h: 0.44,
    fontSize: 19, bold: true, color: C.navy, fontFace: F, valign: 'middle', fit: 'shrink',
  });
  s.addShape('rect', { x: rightX + 0.14, y: L.Y0 + 0.60, w: leftW - 0.28, h: 0.02, fill: { color: 'BFDBFE' }, line: { width: 0 } });

  const reportTypes = [
    { icon: '📋', title: 'Pipeline Explainer', desc: '각 모듈의 계산 설명\n수식·파라미터 자동 문서화\n감사 테이블 포함' },
    { icon: '📑', title: 'Slide Report (PPTX)', desc: 'pptxgenjs 기반 슬라이드 생성\n모듈별 결과 자동 슬라이드화\n기업용 보고서 스타일 적용' },
    { icon: '🖨️', title: 'Pipeline Execution Log', desc: '실행 단계별 로그 출력\n오류 발생 위치 추적\n실행 시간 측정' },
  ];

  const rCardH = calcCardH(L.Y0 + 0.68, reportTypes.length, 0.12);
  reportTypes.forEach((rt, i) => {
    const ry = L.Y0 + 0.68 + i * (rCardH + 0.12);
    assertInBounds(ry, rCardH, `report[${i}]`);
    s.addShape('rect', { x: rightX + 0.14, y: ry, w: leftW - 0.28, h: rCardH, fill: { color: C.white }, line: { color: 'BFDBFE', width: 0.75 } });
    s.addText(`${rt.icon}  ${rt.title}`, {
      x: rightX + 0.22, y: ry + 0.08, w: leftW - 0.44, h: rCardH * 0.38,
      fontSize: 16, bold: true, color: C.navy, fontFace: F,
      valign: 'top', fit: 'shrink', wrap: false,
    });
    s.addText(rt.desc, {
      x: rightX + 0.22, y: ry + 0.08 + rCardH * 0.38, w: leftW - 0.44, h: rCardH * 0.52,
      fontSize: 13, color: C.dark, fontFace: F,
      valign: 'top', wrap: true, fit: 'shrink', lineSpacingMultiple: 1.2,
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 슬라이드 11 — 기술 스택
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  addHeader(s, '09', '기술 스택');

  const stacks = [
    { icon: '⚛️', title: 'React 19', sub: 'UI 프레임워크', desc: 'Hooks · Context · 비동기 상태\n고성능 캔버스 렌더링' },
    { icon: '🔷', title: 'TypeScript', sub: '타입 안전성', desc: '엄격한 타입 정의\n모듈·포트 인터페이스 타입화' },
    { icon: '⚡', title: 'Vite 6', sub: '빌드 도구', desc: '빠른 HMR 개발 서버\n최적화된 프로덕션 번들' },
    { icon: '🤖', title: 'Google Gemini', sub: 'AI 엔진', desc: 'Gemini 2.0 Flash 사용\n파이프라인·DSL 자동 생성' },
    { icon: '🗄️', title: 'Supabase', sub: '클라우드 DB', desc: 'PostgreSQL 기반 샘플 저장\nRLS 보안 정책 적용' },
    { icon: '📊', title: 'pptxgenjs', sub: 'PPT 생성', desc: '슬라이드 보고서 자동 생성\n기업용 보고서 포맷 출력' },
    { icon: '💾', title: 'better-sqlite3', sub: '로컬 DB', desc: '로컬 샘플 데이터 저장\n오프라인 환경 지원' },
    { icon: '🌐', title: 'Express', sub: 'API 서버', desc: '파일 업로드·처리 API\nRender 배포 지원' },
  ];

  const COL_GAP = 0.15;
  const ROW_GAP = 0.10;
  const cols = 4;
  const colW = (L.W - COL_GAP * (cols - 1)) / cols;
  const cardStartY = L.Y0;
  const rows = Math.ceil(stacks.length / cols);
  const cardH = calcCardH(cardStartY, rows, ROW_GAP);

  stacks.forEach((st, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = L.XL + col * (colW + COL_GAP);
    const cy = cardStartY + row * (cardH + ROW_GAP);
    assertInBounds(cy, cardH, `stack[${i}]`);
    s.addShape('rect', { x: cx, y: cy, w: colW, h: cardH, fill: { color: C.card }, line: { color: C.border, width: 0.75 } });
    s.addText(`${st.icon}  ${st.title}`, {
      x: cx + 0.12, y: cy + 0.10, w: colW - 0.24, h: cardH * 0.28,
      fontSize: 18, bold: true, color: C.navy, fontFace: F,
      valign: 'top', fit: 'shrink', wrap: false,
    });
    s.addText(st.sub, {
      x: cx + 0.12, y: cy + 0.10 + cardH * 0.28, w: colW - 0.24, h: cardH * 0.18,
      fontSize: 13, color: C.accent, fontFace: F, bold: true,
      valign: 'top', fit: 'shrink', wrap: false,
    });
    s.addShape('rect', {
      x: cx + 0.12, y: cy + 0.10 + cardH * 0.28 + cardH * 0.18 + 0.04,
      w: colW - 0.24, h: 0.02, fill: { color: C.border }, line: { width: 0 },
    });
    const descY = cy + 0.10 + cardH * 0.28 + cardH * 0.18 + 0.10;
    const descH = Math.max(cardH - 0.10 - cardH * 0.28 - cardH * 0.18 - 0.14, 0.25);
    s.addText(st.desc, {
      x: cx + 0.12, y: descY, w: colW - 0.24, h: descH,
      fontSize: 13, color: C.dark, fontFace: F,
      valign: 'top', wrap: true, fit: 'shrink', lineSpacingMultiple: 1.2,
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 슬라이드 12 — 마무리
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  s.addShape('rect', { x: 0, y: 0, w: SLIDE.W, h: SLIDE.H, fill: { color: C.navy }, line: { width: 0 } });
  s.addShape('rect', { x: 0, y: 3.10, w: SLIDE.W, h: 0.10, fill: { color: C.accent }, line: { width: 0 } });

  s.addText('Life Matrix Flow', {
    x: 0.80, y: 0.70, w: SLIDE.W - 1.60, h: 1.10,
    fontSize: 48, bold: true, color: C.white, fontFace: F,
    align: 'center', valign: 'middle', fit: 'shrink',
  });
  s.addText('보험 계리 × 데이터 사이언스 × AI 자동화', {
    x: 0.80, y: 1.85, w: SLIDE.W - 1.60, h: 0.55,
    fontSize: 22, color: 'A5C8E6', fontFace: F,
    align: 'center', valign: 'middle', fit: 'shrink',
  });
  s.addText('하나의 캔버스에서 계리 계산, ML 파이프라인, 재보험 가격 산출을\nAI의 도움으로 빠르게 구성하고 실행하세요.', {
    x: 0.80, y: 3.40, w: SLIDE.W - 1.60, h: 0.80,
    fontSize: 18, color: 'CBD5E1', fontFace: F,
    align: 'center', valign: 'middle', wrap: true, fit: 'shrink',
  });

  const pills = ['비주얼 파이프라인 빌더', '생명보험 계리 모듈', 'XoL 재보험 프라이싱', 'ML/AI 자동화', '슬라이드 보고서 생성'];
  const pillW = 2.20, pillH = 0.50, pillGap = 0.16;
  const totalW = pills.length * pillW + (pills.length - 1) * pillGap;
  const startX = (SLIDE.W - totalW) / 2;
  pills.forEach((pill, i) => {
    const px = startX + i * (pillW + pillGap);
    s.addShape('rect', { x: px, y: 4.40, w: pillW, h: pillH, fill: { color: '1A3252' }, line: { color: C.accent, width: 0.75 } });
    s.addText(pill, {
      x: px, y: 4.40, w: pillW, h: pillH,
      fontSize: 12, color: C.white, fontFace: F,
      align: 'center', valign: 'middle', fit: 'shrink',
    });
  });

  s.addText('2026 · Life Matrix Flow · Actuarial Analytics Platform', {
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
