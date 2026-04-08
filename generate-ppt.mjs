/**
 * Life Matrix Flow — Presentation.pptx  v5.0
 * ─────────────────────────────────────────────
 * 슬라이드 14장  |  10" × 7.5"  (LAYOUT_16x9)
 *
 * 설계 원칙 v5
 *   · 모든 요소를 고정 크기(fixed size)로 선언 — 계산식으로 페이지 끝까지 채우지 않는다
 *   · 콘텐츠 목표 하단: Y = 5.60"  (슬라이드 하단 7.5"에서 1.9" 여백 확보)
 *   · fit:"shrink" 텍스트박스가 지정 h보다 크게 렌더되는 PowerPoint 이슈 방지
 *   · 절대 초과 금지선: YBC = 6.00"
 *
 * 고정 치수
 *   HDR  = 1.10   헤더 바
 *   Y0   = 1.22   콘텐츠 시작
 *   XL   = 0.35   좌측 여백
 *   W    = 9.30   콘텐츠 폭
 */
import PptxGenJS from "pptxgenjs";

const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_16x9";

// ── 팔레트 ────────────────────────────────────────────────
const C = {
  navy:   "1E3A5F",
  blue:   "2563EB",
  black:  "111827",
  dark:   "374151",
  sub:    "6B7280",
  white:  "FFFFFF",
  card:   "F8FAFC",
  border: "E2E8F0",
  sky:    "EFF6FF",
  code:   "1E1E2E",
};
const F = "Noto Sans KR";

const Y0  = 1.22;
const XL  = 0.35;
const W   = 9.30;

// ── 공통 컴포넌트 ─────────────────────────────────────────
function hdr(s, num, title) {
  s.addShape(pptx.ShapeType.rect, { x:0,y:0,w:"100%",h:1.10, fill:{color:C.navy} });
  s.addText(num,   { x:0.35,y:0.12,w:0.56,h:0.86, fontSize:14,bold:true,color:C.blue,fontFace:F,valign:"middle",fit:"shrink" });
  s.addText(title, { x:0.96,y:0.12,w:8.65,h:0.86, fontSize:18,bold:true,color:C.white,fontFace:F,valign:"middle",fit:"shrink" });
}
function card(s, x, y, w, h) {
  s.addShape(pptx.ShapeType.roundRect, { x,y,w,h, fill:{color:C.card},line:{color:C.border,width:0.75},rectRadius:0.06 });
}
function whiteCard(s, x, y, w, h) {
  s.addShape(pptx.ShapeType.roundRect, { x,y,w,h, fill:{color:C.white},line:{color:C.blue,width:1.0},rectRadius:0.06 });
}
function navyBar(s, x, y, w, h, text) {
  s.addShape(pptx.ShapeType.roundRect, { x,y,w,h, fill:{color:C.navy},line:{color:C.navy,width:0},rectRadius:0.05 });
  s.addText(text, { x:x+0.10,y,w:w-0.14,h, fontSize:10.5,bold:true,color:C.white,fontFace:F,valign:"middle",fit:"shrink" });
}
function accentCard(s, x, y, w, h) {
  card(s, x, y, w, h);
  s.addShape(pptx.ShapeType.rect, { x,y:y+0.08,w:0.04,h:h-0.16, fill:{color:C.blue},line:{color:C.blue,width:0} });
}
function blueDot(s, x, cy) {
  s.addShape(pptx.ShapeType.ellipse, { x:x-0.07,y:cy-0.07,w:0.14,h:0.14, fill:{color:C.blue},line:{color:C.blue,width:0} });
}
function numBadge(s, x, y, n) {
  s.addShape(pptx.ShapeType.ellipse, { x,y,w:0.26,h:0.26, fill:{color:C.blue},line:{color:C.blue,width:0} });
  s.addText(String(n), { x,y,w:0.26,h:0.26, fontSize:8,bold:true,color:C.white,fontFace:F,align:"center",valign:"middle" });
}
function sqDot(s, x, cy) {
  s.addShape(pptx.ShapeType.rect, { x,y:cy-0.05,w:0.09,h:0.09, fill:{color:C.blue},line:{color:C.blue,width:0} });
}
function hLine(s, y, col) {
  s.addShape(pptx.ShapeType.line, { x:XL,y,w:W,h:0, line:{color:col??C.border,width:0.75} });
}
/** 슬라이드 설명 한 줄 (Y0 ~ Y0+0.24) + 구분선 */
function desc(s, text) {
  s.addText(text, { x:XL,y:Y0,w:W,h:0.24, fontSize:10.5,color:C.dark,fontFace:F,fit:"shrink" });
  hLine(s, Y0+0.28, C.blue);
}

// ══════════════════════════════════════════════════════════
//  1. 표지
// ══════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  s.addShape(pptx.ShapeType.rect, { x:0,y:0,w:"100%",h:2.40, fill:{color:C.navy} });
  s.addShape(pptx.ShapeType.rect, { x:0,y:2.40,w:"100%",h:0.07, fill:{color:C.blue} });

  s.addText("Life Matrix Flow", { x:0.50,y:0.28,w:9,h:0.90, fontSize:38,bold:true,color:C.white,fontFace:F,fit:"shrink" });
  s.addText("생명보험 계리 파이프라인 비주얼 빌더",     { x:0.50,y:1.22,w:9,h:0.40, fontSize:16,color:"A5C8FF",fontFace:F,fit:"shrink" });
  s.addText("Life Insurance Actuarial Pipeline Visual Builder", { x:0.50,y:1.66,w:9,h:0.34, fontSize:12,color:"7AACDF",fontFace:F,fit:"shrink" });

  // 핵심 가치 3개
  ["🏗️  비주얼 파이프라인","🤖  AI 자동 설계","📊  결과 보고 자동화"].forEach((t,i)=>{
    s.addShape(pptx.ShapeType.roundRect,{x:0.50+i*3.10,y:2.60,w:2.88,h:0.48, fill:{color:C.white},line:{color:C.blue,width:1},rectRadius:0.08});
    s.addText(t,{x:0.50+i*3.10,y:2.60,w:2.88,h:0.48, fontSize:12,bold:true,color:C.navy,fontFace:F,align:"center",valign:"middle",fit:"shrink"});
  });

  s.addText(
    "드래그&드롭으로 보험료 산출 파이프라인을 시각적으로 구성하고,\nGemini AI가 목표에 맞는 파이프라인을 자동 설계합니다.",
    {x:0.50,y:3.26,w:9,h:0.72, fontSize:13,color:C.dark,fontFace:F,lineSpacingMultiple:1.28,fit:"shrink"}
  );

  // 기술 태그
  ["React 19","TypeScript 5.8","Vite 6","Gemini AI","Supabase","pptxgenjs"].forEach((t,i)=>{
    s.addShape(pptx.ShapeType.roundRect,{x:0.50+i*1.56,y:4.16,w:1.44,h:0.28, fill:{color:"F1F5F9"},line:{color:C.border,width:0.75},rectRadius:0.05});
    s.addText(t,{x:0.50+i*1.56,y:4.16,w:1.44,h:0.28, fontSize:9.5,color:C.sub,fontFace:F,align:"center",valign:"middle",fit:"shrink"});
  });

  s.addText("2026.03.31",{x:0.50,y:5.46,w:9,h:0.22, fontSize:10,color:C.sub,fontFace:F,fit:"shrink"});
}

// ══════════════════════════════════════════════════════════
//  2. 목차  — 2열 × 5행, 고정 cardH = 0.84"
// ══════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  hdr(s,"00","목차");

  const GAP=0.08, cw=(W-GAP)/2, rh=0.84;
  const items=[
    ["01","앱 개요",              "핵심 기능 3가지"],
    ["02","캔버스 & 편집 UI",     "드래그&드롭 모듈 배치·연결"],
    ["03","계리 계산 파이프라인", "보험료 산출 9단계 흐름"],
    ["04","모듈 라이브러리",      "계리·데이터 전체 17개 모듈"],
    ["05","파이프라인 실행",       "실행·결과 미리보기"],
    ["06","AI 파이프라인 생성",   "Gemini AI 자동 설계"],
    ["07","DSL 편집기",           "코드 기반 파이프라인 편집"],
    ["08","샘플 관리",            "저장·공유·재사용"],
    ["09","산출 보고서 내보내기", ".pptx 자동 생성"],
    ["10","기술 스택",            "프론트·AI·백엔드·배포"],
  ];
  // 5행: Y0 ~ Y0 + 5*rh + 4*gap = 1.22 + 4.20 + 0.32 = 5.74 ✓
  items.forEach(([num,title,sub],i)=>{
    const col=i%2, row=Math.floor(i/2);
    const x=XL+col*(cw+GAP), y=Y0+row*(rh+GAP);
    card(s,x,y,cw,rh);
    s.addText(num,  {x:x+0.10,y,w:0.46,h:rh, fontSize:13,bold:true,color:C.blue,fontFace:F,valign:"middle",fit:"shrink"});
    s.addText(title,{x:x+0.60,y:y+0.06,w:cw-0.68,h:rh*0.50, fontSize:11,bold:true,color:C.black,fontFace:F,valign:"bottom",fit:"shrink"});
    s.addText(sub,  {x:x+0.60,y:y+rh*0.56,w:cw-0.68,h:rh*0.38, fontSize:9.5,color:C.sub,fontFace:F,valign:"top",fit:"shrink"});
  });
  // bottom: 1.22 + 5*0.84 + 4*0.08 = 1.22+4.20+0.32 = 5.74 ✓
}

// ══════════════════════════════════════════════════════════
//  3. 앱 개요  — 3열 고정 cardH = 3.60"
// ══════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  hdr(s,"01","앱 개요");
  desc(s,"Life Matrix Flow는 생명보험 계리 파이프라인을 시각적으로 설계·실행·보고하는 올인원 플랫폼입니다.");

  const cY=Y0+0.38, GAP=0.10, cw=(W-GAP*2)/3;   // cw≈2.97
  const HDR=0.30, cardH=3.60;
  // cY+cardH = 1.60+3.60 = 5.20 ✓

  const features=[
    {num:"01",title:"비주얼 파이프라인", pts:["캔버스 드래그&드롭 모듈 배치","포트 연결로 데이터 흐름 정의","Undo/Redo 무제한 히스토리","줌·팬·다크모드 지원"]},
    {num:"02",title:"계리 특화 계산",   pts:["순보험료·영업보험료·준비금 산출","생존자·교환함수(Nx/Mx) 자동 계산","시나리오 러너 민감도 분석","계리 전용 17개 모듈"]},
    {num:"03",title:"AI & 자동화",      pts:["Gemini AI 파이프라인 자동 설계","목표 입력만으로 최적 구조 추천","DSL 텍스트 파이프라인 편집","결과 .pptx 보고서 1클릭"]},
  ];
  features.forEach((f,i)=>{
    const x=XL+i*(cw+GAP);
    navyBar(s,x,cY,cw,HDR,`${f.num}  ${f.title}`);
    const bodyY=cY+HDR, bodyH=cardH-HDR, ih=bodyH/4;
    card(s,x,bodyY,cw,bodyH);
    f.pts.forEach((pt,pi)=>{
      sqDot(s,x+0.14,bodyY+pi*ih+ih/2);
      s.addText(pt,{x:x+0.28,y:bodyY+pi*ih+0.06,w:cw-0.34,h:ih-0.10, fontSize:11,color:C.dark,fontFace:F,valign:"middle",fit:"shrink"});
    });
  });

  // 배너 (cY+cardH=5.20 → banner at 5.28)
  const bannerY=cY+cardH+0.08, bannerH=0.42;
  s.addShape(pptx.ShapeType.roundRect,{x:XL,y:bannerY,w:W,h:bannerH, fill:{color:C.sky},line:{color:C.blue,width:0.75},rectRadius:0.06});
  s.addText("💡  파이프라인을 한 번 설계하면 .lifx 파일로 저장해 다른 상품에 즉시 재사용할 수 있습니다.",
    {x:XL+0.14,y:bannerY,w:W-0.22,h:bannerH, fontSize:11,color:C.navy,fontFace:F,valign:"middle",fit:"shrink"});
  // bannerY+bannerH = 5.70 ✓
}

// ══════════════════════════════════════════════════════════
//  4. 캔버스 & 편집 UI  — 2열×3행, 고정 rh=1.38"
// ══════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  hdr(s,"02","캔버스 & 편집 UI");
  desc(s,"드래그&드롭 기반 비주얼 편집으로 복잡한 계리 파이프라인을 직관적으로 구성합니다.");

  const cY=Y0+0.38, GAP=0.08, cw=(W-GAP)/2, rh=1.24;
  // bottom: 1.60 + 3*1.24 + 2*0.08 = 1.60+3.72+0.16 = 5.48 ✓
  const items=[
    ["🖱️","드래그 & 드롭",       "툴박스에서 캔버스로 드래그하여 모듈 배치\n다중 선택 후 한꺼번에 이동"],
    ["🔗","포트 연결",            "출력 포트→입력 포트 드래그로 연결\n타입 불일치 시 연결 차단"],
    ["⚙️","파라미터 인라인 편집", "모듈 옆 편집 버튼으로 해당 DSL 블록만 수정\n캔버스 자동 동기화"],
    ["↩️","Undo / Redo",         "무제한 히스토리\nCtrl+Z / Ctrl+Y 단축키 지원"],
    ["🔍","줌 & 팬",             "마우스 휠 확대·축소, 스페이스+드래그 패닝\nFit 버튼으로 전체 맞춤"],
    ["🌙","다크 / 라이트 모드",   "시스템 테마 연동 또는 수동 전환"],
  ];
  items.forEach(([icon,title,desc],i)=>{
    const col=i%2, row=Math.floor(i/2);
    const x=XL+col*(cw+GAP), y=cY+row*(rh+GAP);
    accentCard(s,x,y,cw,rh);
    s.addText(icon, {x:x+0.12,y:y+0.10,w:0.40,h:0.40, fontSize:16,fontFace:"Segoe UI Emoji"});
    s.addText(title,{x:x+0.58,y:y+0.08,w:cw-0.66,h:0.36, fontSize:11,bold:true,color:C.black,fontFace:F,valign:"middle",fit:"shrink"});
    s.addText(desc, {x:x+0.12,y:y+0.52,w:cw-0.18,h:rh-0.60, fontSize:10,color:C.dark,fontFace:F,lineSpacingMultiple:1.15,fit:"shrink"});
  });
}

// ══════════════════════════════════════════════════════════
//  5. 계리 파이프라인 흐름  — 3열×3행, 고정 rh=1.36"
// ══════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  hdr(s,"03","계리 계산 파이프라인 흐름");
  desc(s,"종신보험 순보험료 산출 예시 — 9개 모듈의 데이터 흐름");

  const cY=Y0+0.38, GX=0.24, GY=0.12, rh=1.24;
  const cw=(W-GX*2)/3;
  // bottom: 1.60 + 3*1.24 + 2*0.12 = 1.60+3.72+0.24 = 5.56 ✓

  const steps=[
    {n:"1",label:"Define Policy Info", desc:"가입연령·성별·보험기간·납입기간·이율"},
    {n:"2",label:"Load Risk Rates",    desc:"위험률표 CSV 로드 (사망률·질병율)"},
    {n:"3",label:"Rating Basis",       desc:"보험기간 요율 & 현가계수 vⁿ 산출"},
    {n:"4",label:"Rate Modifier",      desc:"수식으로 신규 요율 컬럼 생성·변환"},
    {n:"5",label:"Survivors Calc",     desc:"lx → Dx (= lx·vˣ) 생존자수 산출"},
    {n:"6",label:"Claims Calc",        desc:"dx (= lx−lx+1) → Cx 교환함수"},
    {n:"7",label:"Nx / Mx Calc",       desc:"Nx = ΣDx,  Mx = ΣCx 누적 함수"},
    {n:"8",label:"NNX / MMX Calc",     desc:"NNX·MMX 집계 및 납입주기 보정"},
    {n:"9",label:"Net Premium Calc",   desc:"PP = MMX / NNX (사용자 정의 수식)"},
  ];
  steps.forEach((st,i)=>{
    const col=i%3, row=Math.floor(i/3);
    const x=XL+col*(cw+GX), y=cY+row*(rh+GY);
    whiteCard(s,x,y,cw,rh);
    numBadge(s,x+0.10,y+0.10,st.n);
    s.addText(st.label,{x:x+0.42,y:y+0.08,w:cw-0.50,h:0.34, fontSize:10.5,bold:true,color:C.black,fontFace:F,valign:"middle",fit:"shrink"});
    s.addText(st.desc, {x:x+0.10,y:y+0.46,w:cw-0.16,h:rh-0.54, fontSize:9.5,color:C.dark,fontFace:F,lineSpacingMultiple:1.1,fit:"shrink"});
    if(col<2) s.addText("→",{x:x+cw+0.04,y:y+rh/2-0.12,w:GX-0.06,h:0.24, fontSize:11,bold:true,color:C.blue,fontFace:F,align:"center"});
    if(col===2&&row<2) s.addText("↓",{x:x+cw/2-0.10,y:y+rh+0.01,w:0.20,h:GY-0.02, fontSize:10,bold:true,color:C.blue,fontFace:F,align:"center"});
  });
}

// ══════════════════════════════════════════════════════════
//  6. 모듈 라이브러리  — 2열, 고정 itemH
// ══════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  hdr(s,"04","모듈 라이브러리  —  전체 17개 모듈");

  const GAP=0.10, cW=(W-GAP)/2, HDR_H=0.28;
  const listY=Y0+HDR_H+0.04;   // 1.54
  // 9개 항목, itemH=0.40, gap=0.04 → 9*0.40+8*0.04=3.60+0.32=3.92 → listY+3.92+0.08=1.54+4.00=5.54 ✓
  const itemH=0.40, itemGap=0.04;

  const groups=[
    { label:"계리 계산 모듈  (9개)", items:[
      ["Define Policy Info",    "가입조건 (연령·성별·기간·이율)"],
      ["Survivors Calculator",  "생존자수 lx → Dx 계산"],
      ["Claims Calculator",     "dx · Cx 교환함수 산출"],
      ["Nx Mx Calculator",      "Nx · Mx 누적 교환함수"],
      ["NNX MMX Calculator",    "NNX · MMX 집계·납입주기 보정"],
      ["Additional Variables",  "사용자 정의 변수 (α β γ 등)"],
      ["Net Premium Calc",      "수식 입력으로 순보험료 산출"],
      ["Gross Premium Calc",    "PP / (1 − 사업비율)"],
      ["Reserve Calculator",    "준비금 산출 (조건부 수식)"],
    ]},
    { label:"데이터 · 유틸리티 모듈  (8개)", items:[
      ["Load Risk Rates",       "위험률표 CSV 파일 로드"],
      ["Select Rates",          "컬럼 선택·제거"],
      ["Rating Basis Builder",  "보험기간 요율·현가계수 산출"],
      ["Rate Modifier",         "수식으로 신규 요율 컬럼 생성"],
      ["Scenario Runner",       "시나리오별 민감도 분석"],
      ["Pipeline Explainer",    "AI 파이프라인 보고서 자동 생성"],
      ["텍스트 상자",            "캔버스에 메모·설명 추가"],
      ["그룹 상자",              "모듈 묶기·일괄 이동"],
    ]},
  ];

  groups.forEach((g,gi)=>{
    const x=XL+gi*(cW+GAP);
    navyBar(s,x,Y0,cW,HDR_H,g.label);
    const listH=g.items.length*(itemH+itemGap)-itemGap;
    card(s,x,listY,cW,listH+0.08);
    g.items.forEach((item,ii)=>{
      const iy=listY+0.04+ii*(itemH+itemGap);
      sqDot(s,x+0.14,iy+itemH/2);
      s.addText(item[0],{x:x+0.28,y:iy,w:cW*0.44,h:itemH, fontSize:10.5,bold:true,color:C.black,fontFace:F,valign:"middle",fit:"shrink"});
      s.addText(item[1],{x:x+0.28+cW*0.44,y:iy,w:cW*0.50,h:itemH, fontSize:10,color:C.sub,fontFace:F,valign:"middle",fit:"shrink"});
    });
  });
}

// ══════════════════════════════════════════════════════════
//  7. 파이프라인 실행 & 결과 미리보기
// ══════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  hdr(s,"05","파이프라인 실행 & 결과 미리보기");
  desc(s,"▶ 실행 버튼 한 번으로 전체 모듈을 순차 실행하고, 각 결과를 미리보기 모달로 확인합니다.");

  // 흐름 4단계 — 고정 FLOW_H=1.12
  const fY=Y0+0.38, FLOW_H=1.12, SGP=0.12, sw=(W-SGP*3)/4;
  [
    {n:"1",icon:"🔧",l1:"파이프라인 구성", l2:"모듈 배치 & 포트 연결"},
    {n:"2",icon:"▶️", l1:"실행 버튼 클릭", l2:"상단 툴바"},
    {n:"3",icon:"⚙️",l1:"모듈 순차 실행",  l2:"상태 색상 표시"},
    {n:"4",icon:"📋",l1:"결과 미리보기",   l2:"모달 팝업"},
  ].forEach((st,i)=>{
    const x=XL+i*(sw+SGP);
    card(s,x,fY,sw,FLOW_H);
    s.addText(st.icon,{x:x+(sw-0.36)/2,y:fY+0.08,w:0.36,h:0.36, fontSize:15,fontFace:"Segoe UI Emoji",align:"center"});
    numBadge(s,x+0.10,fY+0.09,st.n);
    s.addText(st.l1,{x:x+0.05,y:fY+0.50,w:sw-0.10,h:0.28, fontSize:10,bold:true,color:C.black,fontFace:F,align:"center",fit:"shrink"});
    s.addText(st.l2,{x:x+0.05,y:fY+0.78,w:sw-0.10,h:0.26, fontSize:9.5,color:C.sub,fontFace:F,align:"center",fit:"shrink"});
    if(i<3) s.addText("→",{x:x+sw+0.02,y:fY+FLOW_H/2-0.12,w:SGP-0.02,h:0.24, fontSize:11,bold:true,color:C.blue,fontFace:F,align:"center"});
  });
  // fY+FLOW_H = 1.60+1.12 = 2.72

  // 섹션
  const secY=fY+FLOW_H+0.10;
  s.addText("결과 미리보기 모달 종류",{x:XL,y:secY,w:W,h:0.24, fontSize:11,bold:true,color:C.navy,fontFace:F,fit:"shrink"});
  hLine(s,secY+0.26);

  // 4열×2행, 고정 pw, ph=1.16
  const pY=secY+0.32, GAP=0.07, pw=(W-GAP*3)/4, ph=1.16;
  // bottom: 2.72+0.10+0.24+0.26+0.32 + 2*1.16+0.07 = 3.14+2.39=5.53 ✓
  [
    ["📊","Data Preview",   "테이블 형식 데이터"],
    ["📈","Statistics",      "기술통계 요약"],
    ["💰","Net Premium",     "순보험료 결과"],
    ["💵","Gross Premium",   "영업보험료 결과"],
    ["📋","Addl Variables",  "추가 변수 목록"],
    ["🔢","Spread View",     "스프레드시트 뷰"],
    ["🎯","Scenario Result", "다중 시나리오 비교"],
    ["📄","Pipeline Report", "AI 파이프라인 보고서"],
  ].forEach((p,i)=>{
    const col=i%4, row=Math.floor(i/4);
    const x=XL+col*(pw+GAP), y=pY+row*(ph+GAP);
    card(s,x,y,pw,ph);
    s.addText(p[0],{x:x+0.08,y:y+0.06,w:0.30,h:ph-0.10, fontSize:12,fontFace:"Segoe UI Emoji",valign:"middle"});
    s.addText(p[1],{x:x+0.42,y:y+0.06,w:pw-0.48,h:ph*0.50, fontSize:10,bold:true,color:C.black,fontFace:F,valign:"bottom",fit:"shrink"});
    s.addText(p[2],{x:x+0.42,y:y+ph*0.56,w:pw-0.48,h:ph*0.36, fontSize:9,color:C.sub,fontFace:F,valign:"top",fit:"shrink"});
  });
}

// ══════════════════════════════════════════════════════════
//  8. AI 파이프라인 자동 생성
// ══════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  hdr(s,"06","AI 파이프라인 자동 생성  (Gemini AI)");
  desc(s,"목표 텍스트 입력 또는 데이터 업로드만으로 Gemini AI가 최적 파이프라인을 자동 설계합니다.");

  const pY=Y0+0.38, GAP=0.12, cW=(W-GAP)/2;
  const HDR=0.28, stepH=0.80;
  // 4 steps: bodyH=4*0.80=3.20, panelH=0.28+3.20=3.48
  // pY+3.48 = 1.60+3.48 = 5.08 → notice at 5.56

  [
    {title:"목표 기반  (AIPipelineFromGoal)",
     steps:["분석 목표 텍스트 입력 (예: 종신보험 순보험료 산출)","Gemini AI가 필요 모듈·연결 순서 추론","AIPlanDisplay에서 단계별 설계 확인","확인 후 캔버스에 자동 배치 완료"]},
    {title:"데이터 기반  (AIPipelineFromData)",
     steps:["CSV / Excel 파일 업로드","컬럼 구조·데이터 타입 자동 인식","데이터 특성에 맞는 파이프라인 추천","추천 파이프라인 즉시 적용"]},
  ].forEach((m,mi)=>{
    const x=XL+mi*(cW+GAP), bodyY=pY+HDR;
    navyBar(s,x,pY,cW,HDR,m.title);
    card(s,x,bodyY,cW,stepH*4);
    m.steps.forEach((st,si)=>{
      const iy=bodyY+si*stepH;
      numBadge(s,x+0.14,iy+stepH/2-0.13,si+1);
      s.addText(st,{x:x+0.46,y:iy+0.10,w:cW-0.54,h:stepH-0.18, fontSize:11,color:C.dark,fontFace:F,valign:"middle",fit:"shrink"});
    });
  });

  // 하단 배너 (pY+HDR+stepH*4 = 1.60+0.28+3.20=5.08 → bY=5.16)
  const bY=pY+HDR+stepH*4+0.08, bH=0.38;
  s.addShape(pptx.ShapeType.roundRect,{x:XL,y:bY,w:W,h:bH, fill:{color:C.sky},line:{color:C.blue,width:0.75},rectRadius:0.05});
  s.addText("💡  AIPlanDisplayModal — AI 설계 결과 단계별 시각화 후 캔버스 적용  |  Pipeline Explainer — AI 파이프라인 전체 해설 보고서",
    {x:XL+0.12,y:bY,w:W-0.20,h:bH, fontSize:10.5,color:C.navy,fontFace:F,valign:"middle",fit:"shrink"});
  // bY+bH = 5.40+0.08+0.40 = 5.88 ✓
}

// ══════════════════════════════════════════════════════════
//  9. DSL 편집기
// ══════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  hdr(s,"07","DSL 편집기");
  desc(s,"파이프라인을 텍스트 DSL로 직접 정의·편집합니다. 캔버스 ↔ DSL 양방향 동기화 지원.");

  const cY=Y0+0.38, cH=3.90;   // 고정 3.90", bottom=1.60+3.90=5.50 ✓
  const CODE_W=5.10, FEAT_W=W-CODE_W-0.12, featX=XL+CODE_W+0.12;

  // 코드 패널
  s.addShape(pptx.ShapeType.roundRect,{x:XL,y:cY,w:CODE_W,h:cH, fill:{color:C.code},line:{color:"2D2D44",width:0.75},rectRadius:0.06});
  s.addText("DSL  예시",{x:XL+0.14,y:cY+0.08,w:CODE_W-0.22,h:0.20, fontSize:9,color:"888AAA",fontFace:"Courier New",fit:"shrink"});

  const dslLines=[
    [{t:"PIPELINE ",c:"569CD6"},{t:"WholeLifePremium",c:"D4D4D4"}],
    [{t:"  MODULE ",c:"C586C0"},{t:"LoadData",c:"4EC9B0"}],
    [{t:"    source: ",c:"9CDCFE"},{t:'"Risk_Rates.csv"',c:"CE9178"}],
    [{t:"  MODULE ",c:"C586C0"},{t:"DefinePolicyInfo",c:"4EC9B0"}],
    [{t:"    entryAge: ",c:"9CDCFE"},{t:"40",c:"B5CEA8"},{t:"  gender: ",c:"9CDCFE"},{t:'"Male"',c:"CE9178"}],
    [{t:"    policyTerm: ",c:"9CDCFE"},{t:'"whole"',c:"CE9178"}],
    [{t:"  MODULE ",c:"C586C0"},{t:"NetPremiumCalc",c:"4EC9B0"}],
    [{t:"    formula: ",c:"9CDCFE"},{t:'"MMX / NNX"',c:"CE9178"}],
    [{t:"  CONNECT ",c:"DCDCAA"},{t:"LoadData → RatingBasis",c:"D4D4D4"}],
    [{t:"  CONNECT ",c:"DCDCAA"},{t:"DefinePolicyInfo → Survivors",c:"D4D4D4"}],
  ];
  const lnH=(cH-0.32)/dslLines.length;
  dslLines.forEach((tokens,li)=>{
    s.addText(tokens.map(t=>({text:t.t,options:{color:t.c,fontFace:"Courier New",fontSize:10}})),
      {x:XL+0.14,y:cY+0.30+li*lnH,w:CODE_W-0.22,h:lnH, valign:"middle",fit:"shrink"});
  });

  // 기능 카드 4개 (고정 fh=0.96")
  const fGAP=0.08, fh=(cH-fGAP*3)/4;  // ≈0.975
  [
    ["📝","모듈별 인라인 편집",  "모듈 옆 편집 버튼으로 해당 블록만 수정, 캔버스 자동 반영"],
    ["🔄","캔버스 ↔ DSL 동기화","DSL 저장 시 캔버스 즉시 업데이트"],
    ["📋","코드 복사",           "DSL 전체 텍스트 클립보드 복사"],
    ["✅","구문 검증",           "잘못된 모듈명·연결 오류 즉시 표시"],
  ].forEach((f,i)=>{
    const fy=cY+i*(fh+fGAP);
    accentCard(s,featX,fy,FEAT_W,fh);
    s.addText(f[0],{x:featX+0.10,y:fy+0.06,w:0.36,h:fh-0.10, fontSize:15,fontFace:"Segoe UI Emoji",valign:"middle"});
    s.addText(f[1],{x:featX+0.52,y:fy+0.06,w:FEAT_W-0.60,h:fh*0.44, fontSize:11,bold:true,color:C.black,fontFace:F,valign:"bottom",fit:"shrink"});
    s.addText(f[2],{x:featX+0.52,y:fy+fh*0.52,w:FEAT_W-0.60,h:fh*0.40, fontSize:9.5,color:C.sub,fontFace:F,valign:"top",fit:"shrink"});
  });
}

// ══════════════════════════════════════════════════════════
//  10. 샘플 관리  — 3열×2행, 고정 rh=2.10"
// ══════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  hdr(s,"08","샘플 관리");
  desc(s,"자주 사용하는 파이프라인을 저장·재사용하거나 Supabase를 통해 팀과 공유합니다.");

  const cY=Y0+0.38, GAP=0.10, cw=(W-GAP*2)/3, rh=1.90;
  // bottom: 1.60 + 2*1.90 + 0.10 = 1.60+3.90 = 5.50 ✓
  [
    {icon:"💾",title:"파일 저장",      desc:".lifx 파일로 로컬 저장\n언제든 재로드 가능"},
    {icon:"☁️",title:"Supabase 공유", desc:"팀 공유 샘플 업로드\n팀원이 즉시 불러오기"},
    {icon:"📂",title:"개인 작업 보존", desc:"브라우저 자동 저장\n재시작 후 복원"},
    {icon:"📋",title:"샘플 불러오기", desc:"SamplesModal에서 선택\n캔버스에 즉시 로드"},
    {icon:"✏️",title:"편집·삭제",      desc:"이름·설명·첨부파일 수정\n및 삭제"},
    {icon:"🔍",title:"필터·검색",      desc:"카테고리·이름 필터로\n빠른 탐색"},
  ].forEach((c,i)=>{
    const col=i%3, row=Math.floor(i/3);
    const x=XL+col*(cw+GAP), y=cY+row*(rh+GAP);
    accentCard(s,x,y,cw,rh);
    s.addText(c.icon, {x:x+0.12,y:y+0.12,w:0.40,h:0.40, fontSize:17,fontFace:"Segoe UI Emoji"});
    s.addText(c.title,{x:x+0.58,y:y+0.12,w:cw-0.66,h:0.36, fontSize:11,bold:true,color:C.black,fontFace:F,valign:"middle",fit:"shrink"});
    s.addText(c.desc, {x:x+0.12,y:y+0.58,w:cw-0.18,h:rh-0.68, fontSize:10.5,color:C.dark,fontFace:F,lineSpacingMultiple:1.2,fit:"shrink"});
  });
}

// ══════════════════════════════════════════════════════════
//  11. 산출 보고서 내보내기
// ══════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  hdr(s,"09","산출 보고서 내보내기  (.pptx 자동 생성)");
  desc(s,"파이프라인 실행 완료 후 버튼 한 번으로 산출 근거 전체를 .pptx 슬라이드로 내보냅니다.");

  // 흐름 4단계
  const fY=Y0+0.38, FLOW_H=1.10, SGP=0.12, sw=(W-SGP*3)/4;
  [
    {n:"1",icon:"✅",l1:"파이프라인 실행",  l2:"완료 상태 확인"},
    {n:"2",icon:"📊",l1:'"📊 PPT 보고서"',  l2:"버튼 클릭"},
    {n:"3",icon:"⏳",l1:"생성 중",          l2:"2~4초 소요"},
    {n:"4",icon:"⬇️",l1:"자동 다운로드",    l2:"브라우저 저장"},
  ].forEach((f,i)=>{
    const x=XL+i*(sw+SGP);
    card(s,x,fY,sw,FLOW_H);
    s.addText(f.icon,{x:x+(sw-0.36)/2,y:fY+0.08,w:0.36,h:0.36, fontSize:15,fontFace:"Segoe UI Emoji",align:"center"});
    numBadge(s,x+0.10,fY+0.09,f.n);
    s.addText(f.l1,{x:x+0.05,y:fY+0.48,w:sw-0.10,h:0.28, fontSize:10,bold:true,color:C.black,fontFace:F,align:"center",fit:"shrink"});
    s.addText(f.l2,{x:x+0.05,y:fY+0.76,w:sw-0.10,h:0.26, fontSize:9.5,color:C.sub,fontFace:F,align:"center",fit:"shrink"});
    if(i<3) s.addText("→",{x:x+sw+0.02,y:fY+FLOW_H/2-0.12,w:SGP-0.02,h:0.24, fontSize:11,bold:true,color:C.blue,fontFace:F,align:"center"});
  });
  // fY+FLOW_H = 1.60+1.10 = 2.70

  const secY=fY+FLOW_H+0.10;
  s.addText("보고서에 포함되는 내용  (13장 슬라이드)",{x:XL,y:secY,w:W,h:0.24, fontSize:11,bold:true,color:C.navy,fontFace:F,fit:"shrink"});
  hLine(s,secY+0.26);

  // 3열×2행, 고정 rh2=1.00"
  const cY=secY+0.32, GAP=0.08, cw=(W-GAP*2)/3;
  const rh2=1.00;
  // bottom: 3.62 + 2*1.00+0.08 = 3.62+2.08 = 5.70 ✓
  [
    ["📋","파이프라인 구조",   "모듈 목록·연결 관계"],
    ["⚙️","모듈 파라미터",    "입력값·설정 전체 기록"],
    ["📊","위험률 & 현가계수", "RatingBasis 산출 테이블"],
    ["💰","순보험료 결과",     "Net Premium 산출값"],
    ["💵","영업보험료 결과",   "Gross Premium 산출값"],
    ["🏷️","파일명 자동 지정",  "{상품명}_보험료산출보고서.pptx"],
  ].forEach((c,i)=>{
    const col=i%3, row=Math.floor(i/3);
    const x=XL+col*(cw+GAP), y=cY+row*(rh2+GAP);
    card(s,x,y,cw,rh2);
    s.addText(c[0],{x:x+0.10,y:y+0.05,w:0.30,h:rh2-0.08, fontSize:13,fontFace:"Segoe UI Emoji",valign:"middle"});
    s.addText(c[1],{x:x+0.44,y:y+0.06,w:cw-0.52,h:rh2*0.50, fontSize:10.5,bold:true,color:C.black,fontFace:F,valign:"middle",fit:"shrink"});
    s.addText(c[2],{x:x+0.44,y:y+rh2*0.56,w:cw-0.52,h:rh2*0.36, fontSize:9.5,color:C.sub,fontFace:F,valign:"top",fit:"shrink"});
  });
}

// ══════════════════════════════════════════════════════════
//  12. 기술 스택  — 2열×2행, 고정 blkH=2.20"
// ══════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  hdr(s,"10","기술 스택");

  const GAP=0.10, cw=(W-GAP)/2, blkH=2.20, HDR=0.28;
  // bottom: Y0 + 2*2.20 + 0.10 = 1.22+4.50 = 5.72 ✓
  [
    {cat:"🖥️  프론트엔드",    items:["React 19 (Concurrent Mode)","TypeScript 5.8","Vite 6 (빌드 도구)","TailwindCSS"]},
    {cat:"🤖  AI 연동",       items:["Google Gemini API (@google/genai)","목표 기반 DSL 자동 생성","데이터 기반 파이프라인 추천","파이프라인 AI 설명 보고서"]},
    {cat:"🗄️  백엔드 / 데이터",items:["Express.js (로컬 API 서버)","better-sqlite3 (로컬 SQLite)","Supabase (공유 DB / Auth)","multer (파일 업로드)"]},
    {cat:"📄  문서 / 배포",    items:["pptxgenjs (PPT 클라이언트 생성)","xlsx (Excel 처리)","mammoth (Word → Markdown)","Render.com 클라우드 배포"]},
  ].forEach((st,i)=>{
    const col=i%2, row=Math.floor(i/2);
    const x=XL+col*(cw+GAP), y=Y0+row*(blkH+GAP);
    navyBar(s,x,y,cw,HDR,st.cat);
    card(s,x,y+HDR,cw,blkH-HDR);
    const ih=(blkH-HDR)/4;
    st.items.forEach((item,ii)=>{
      const iy=y+HDR+ii*ih;
      sqDot(s,x+0.16,iy+ih/2);
      s.addText(item,{x:x+0.30,y:iy+0.06,w:cw-0.36,h:ih-0.10, fontSize:11,color:C.dark,fontFace:F,valign:"middle",fit:"shrink"});
    });
  });
}

// ══════════════════════════════════════════════════════════
//  13. 시나리오 러너 & 추가 기능
// ══════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  hdr(s,"11","시나리오 러너 & 추가 기능");

  const GAP=0.12, cW=(W-GAP)/2, HDR=0.28;
  const leftX=XL, rightX=XL+cW+GAP;

  // 왼쪽 블록1: 시나리오 러너 (고정 bodyH=1.76)
  const b1Y=Y0, b1Body=1.76;
  navyBar(s,leftX,b1Y,cW,HDR,"📊  시나리오 러너 (ScenarioRunner)");
  card(s,leftX,b1Y+HDR,cW,b1Body);
  const b1Pts=["파이프라인 전체를 시나리오별로 반복 실행","이자율·가입연령 등 파라미터 범위 지정","시나리오별 결과 비교 테이블 자동 생성","민감도 분석·상품 요율 검토에 활용"];
  const b1ih=b1Body/4;
  b1Pts.forEach((pt,pi)=>{
    const iy=b1Y+HDR+pi*b1ih;
    sqDot(s,leftX+0.14,iy+b1ih/2);
    s.addText(pt,{x:leftX+0.28,y:iy+0.06,w:cW-0.34,h:b1ih-0.10, fontSize:10.5,color:C.dark,fontFace:F,valign:"middle",fit:"shrink"});
  });
  // b1 bottom: Y0+HDR+b1Body = 1.22+0.28+1.76 = 3.26

  // 왼쪽 블록2: Pipeline Explainer (고정 bodyH=1.56)
  const b2Y=b1Y+HDR+b1Body+GAP, b2Body=1.56;
  navyBar(s,leftX,b2Y,cW,HDR,"🗂️  Pipeline Explainer");
  card(s,leftX,b2Y+HDR,cW,b2Body);
  const b2Pts=["Gemini AI가 파이프라인 전체 단계별 해설","각 모듈의 역할·수식·결과 자동 보고서화","비전문가도 이해할 수 있는 설명 생성"];
  const b2ih=b2Body/3;
  b2Pts.forEach((pt,pi)=>{
    const iy=b2Y+HDR+pi*b2ih;
    sqDot(s,leftX+0.14,iy+b2ih/2);
    s.addText(pt,{x:leftX+0.28,y:iy+0.06,w:cW-0.34,h:b2ih-0.10, fontSize:10.5,color:C.dark,fontFace:F,valign:"middle",fit:"shrink"});
  });
  // b2 bottom: 3.26+0.12+0.28+1.56 = 5.22 ✓

  // 오른쪽: 기타 기능 (고정 rBodyH=4.32, 6 items)
  const rBodyH=b1Body+b2Body+HDR*2+GAP;  // 좌측 합산과 동일: 4.00
  navyBar(s,rightX,Y0,cW,HDR,"🔧  기타 주요 기능");
  card(s,rightX,Y0+HDR,cW,rBodyH);
  const rItems=[
    ["⌨️",".lifx 파일 포맷",      "파이프라인 전체 상태 JSON 저장·복원"],
    ["📁","Excel / CSV 입력",      "xlsx로 엑셀 직접 업로드·처리"],
    ["📝","Word → Markdown",       "mammoth으로 Word 파일 분석 자료화"],
    ["🌐","Render.com 배포",       "Express 서버 통합, allowedHosts 설정"],
    ["🔒","Supabase RLS",         "행 수준 보안으로 접근 제어"],
    ["📱","반응형 UI",             "TailwindCSS 모바일·태블릿 대응"],
  ];
  const rih=rBodyH/6;
  rItems.forEach(([icon,title,d],i)=>{
    const iy=Y0+HDR+i*rih;
    s.addText(icon, {x:rightX+0.12,y:iy+0.06,w:0.30,h:rih-0.10, fontSize:12,fontFace:"Segoe UI Emoji",valign:"middle"});
    s.addText(title,{x:rightX+0.46,y:iy+0.06,w:cW-0.54,h:rih*0.46, fontSize:10.5,bold:true,color:C.black,fontFace:F,valign:"bottom",fit:"shrink"});
    s.addText(d,    {x:rightX+0.46,y:iy+rih*0.52,w:cW-0.54,h:rih*0.40, fontSize:9.5,color:C.sub,fontFace:F,valign:"top",fit:"shrink"});
  });
  // right bottom: Y0+HDR+rBodyH = 1.22+0.28+4.00 = 5.50 ✓
}

// ══════════════════════════════════════════════════════════
//  14. 마무리
// ══════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  s.addShape(pptx.ShapeType.rect,{x:0,y:0,w:"100%",h:"100%", fill:{color:C.navy}});
  s.addShape(pptx.ShapeType.rect,{x:0,y:3.16,w:"100%",h:0.06, fill:{color:C.blue}});

  s.addText("Life Matrix Flow",{x:0.50,y:1.54,w:9,h:0.90, fontSize:36,bold:true,color:C.white,fontFace:F,align:"center",fit:"shrink"});
  s.addText("생명보험 계리 파이프라인 비주얼 빌더",{x:0.50,y:2.48,w:9,h:0.44, fontSize:17,color:"A5C8FF",fontFace:F,align:"center",fit:"shrink"});

  ["🏗️  비주얼 파이프라인","🤖  AI 자동 설계","📐  계리 17개 모듈","📊  보고서 자동화"].forEach((v,i)=>{
    s.addShape(pptx.ShapeType.roundRect,{x:0.50+i*2.32,y:3.36,w:2.18,h:0.48, fill:{color:C.white},line:{color:C.blue,width:1},rectRadius:0.08});
    s.addText(v,{x:0.50+i*2.32,y:3.36,w:2.18,h:0.48, fontSize:11,bold:true,color:C.navy,fontFace:F,align:"center",valign:"middle",fit:"shrink"});
  });

  s.addText("React 19  ·  TypeScript  ·  Vite 6  ·  Gemini AI  ·  Supabase  ·  pptxgenjs",
    {x:0.50,y:4.36,w:9,h:0.32, fontSize:11,color:"7AACDF",fontFace:F,align:"center",fit:"shrink"});
}

// ── 저장 ──────────────────────────────────────────────────
await pptx.writeFile({ fileName: "Presentation.pptx" });
console.log("✅  Presentation.pptx 생성 완료  (14장)");
