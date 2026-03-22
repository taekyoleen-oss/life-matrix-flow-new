import PptxGenJS from "pptxgenjs";
import {
  CanvasModule,
  ModuleType,
  ModuleStatus,
  PolicyInfoOutput,
  NetPremiumOutput,
  GrossPremiumOutput,
  PremiumComponentOutput,
  AdditionalVariablesOutput,
} from "../types";

// ─── 컬러 팔레트 ─────────────────────────────────────────────────────────────
const C = {
  navy:      "1E2761",
  blue:      "4A90D9",
  gold:      "E8A020",
  white:     "FFFFFF",
  offWhite:  "F8FAFC",
  darkText:  "1E293B",
  midText:   "64748B",
  tableOdd:  "F8FAFC",
  tableEven: "FFFFFF",
  border:    "E2E8F0",
};

const F = { title: "Malgun Gothic", body: "Malgun Gothic", mono: "Courier New" };

// ─── 레이아웃 상수 (LAYOUT_WIDE = 13.33 × 7.5 인치) ─────────────────────────
const SLIDE_W   = 13.33;
const SLIDE_H   = 7.5;
const HEADER_H  = 1.0;
const BODY_Y    = 1.25;
const MARGIN    = 0.5;
const CONTENT_W = SLIDE_W - MARGIN * 2;  // 12.33
const TOTAL_SLIDES = 13;

// ─── 헬퍼: 데이터 접근 ────────────────────────────────────────────────────────

function getModule(modules: CanvasModule[], type: ModuleType) {
  return modules.find((m) => m.type === type);
}
function getOutputData(modules: CanvasModule[], type: ModuleType): any | null {
  const mod = getModule(modules, type);
  if (mod?.status !== ModuleStatus.Success) return null;
  return mod.outputData ?? null;
}
function getOutputRows(modules: CanvasModule[], type: ModuleType): Record<string, any>[] | null {
  const data = getOutputData(modules, type);
  if (!data) return null;
  return (data as any)?.rows ?? null;
}
function formatNum(v: any, d = 4): string {
  const n = Number(v);
  if (isNaN(n)) return String(v ?? "-");
  if (Math.abs(n) >= 1000) return n.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
  return n.toFixed(d);
}
function formatCurrency(v: any): string {
  const n = Number(v);
  if (isNaN(n)) return "-";
  return n.toLocaleString("ko-KR", { maximumFractionDigits: 0 }) + " 원";
}

// ─── 슬라이드 헤더 ────────────────────────────────────────────────────────────
// moduleName 을 넣으면  "ModuleName : 제목" 형식으로 표시

function addSlideHeader(
  slide: PptxGenJS.Slide,
  title: string,
  slideNum: number,
  productName: string,
  moduleName?: string
): void {
  const displayTitle = moduleName ? `${moduleName} : ${title}` : title;

  slide.addShape("rect" as PptxGenJS.SHAPE_NAME, {
    x: 0, y: 0, w: SLIDE_W, h: HEADER_H,
    fill: { color: C.navy }, line: { color: C.navy },
  });
  slide.addText(displayTitle, {
    x: MARGIN, y: 0, w: SLIDE_W - MARGIN - 0.5, h: HEADER_H,
    fontFace: F.title, fontSize: 22, bold: true, color: C.white,
    valign: "middle",
  });
  slide.addText(`${productName}  |  ${slideNum} / ${TOTAL_SLIDES}`, {
    x: SLIDE_W - 3.3, y: SLIDE_H - 0.38, w: 3.2, h: 0.35,
    fontFace: F.body, fontSize: 13, color: C.midText, align: "right",
  });
}

// ─── 수식 흐름표 (3열) ────────────────────────────────────────────────────────
// colW 합계 = CONTENT_W = 12.33

function addFormulaTable(
  slide: PptxGenJS.Slide,
  rows: string[][],
  y: number,
  rowH = 0.6
): number /* 다음 y 반환 */ {
  const colW = [2.5, 6.83, 3.0]; // sum = 12.33
  const tRows: PptxGenJS.TableRow[] = rows.map((row, ri) => {
    const isHdr = ri === 0;
    return row.map((cell, ci) => ({
      text: String(cell),
      options: {
        fontFace: !isHdr && ci === 1 ? F.mono : F.body,
        fontSize: !isHdr && ci === 1 ? 15 : isHdr ? 17 : 15,
        bold: isHdr,
        color: isHdr ? C.white : C.darkText,
        fill: { color: isHdr ? C.navy : ri % 2 === 1 ? C.tableOdd : C.tableEven },
        align: (isHdr || ci === 0) ? "center" : "left",
        valign: "middle",
        border: [
          { type: "solid", pt: 0.75, color: C.border },
          { type: "solid", pt: 0.75, color: C.border },
          { type: "solid", pt: 0.75, color: C.border },
          { type: "solid", pt: 0.75, color: C.border },
        ],
      } as PptxGenJS.TableCellProps,
    }));
  });
  const h = rows.length * rowH;
  slide.addTable(tRows, { x: MARGIN, y, w: CONTENT_W, h, colW, rowH });
  return y + h;
}

// ─── 샘플 데이터 테이블 (최대 5행) ────────────────────────────────────────────

function addSampleDataTable(
  slide: PptxGenJS.Slide,
  allRows: Record<string, any>[],
  startY: number,
  sectionLabel = "입출력 데이터 샘플 (상위 5행)"
): number /* 다음 y */ {
  if (!allRows || allRows.length === 0) return startY;

  slide.addText(sectionLabel, {
    x: MARGIN, y: startY, w: CONTENT_W, h: 0.35,
    fontFace: F.body, fontSize: 16, bold: true, color: C.navy,
  });

  const allCols = Object.keys(allRows[0]);
  const MAX_COLS = Math.floor(CONTENT_W / 1.4); // 최대 열 수
  const cols = allCols.slice(0, MAX_COLS);
  const remainCols = allCols.length - cols.length;

  const dataRows = allRows.slice(0, 5);
  const colW = cols.map(() => CONTENT_W / cols.length);

  const hdrRow: PptxGenJS.TableRow = cols.map((col) => ({
    text: col,
    options: {
      fontFace: F.body, fontSize: 12, bold: true,
      color: C.white,
      fill: { color: C.navy },
      align: "center", valign: "middle",
      border: [
        { type: "solid", pt: 0.5, color: C.border },
        { type: "solid", pt: 0.5, color: C.border },
        { type: "solid", pt: 0.5, color: C.border },
        { type: "solid", pt: 0.5, color: C.border },
      ],
    } as PptxGenJS.TableCellProps,
  }));

  const bodyRows: PptxGenJS.TableRow[] = dataRows.map((row, ri) =>
    cols.map((col) => ({
      text: String(row[col] ?? "-"),
      options: {
        fontFace: F.mono, fontSize: 11,
        color: C.darkText,
        fill: { color: ri % 2 === 0 ? C.tableOdd : C.tableEven },
        align: "center", valign: "middle",
        border: [
          { type: "solid", pt: 0.5, color: C.border },
          { type: "solid", pt: 0.5, color: C.border },
          { type: "solid", pt: 0.5, color: C.border },
          { type: "solid", pt: 0.5, color: C.border },
        ],
      } as PptxGenJS.TableCellProps,
    }))
  );

  const ROW_H = 0.38;
  const tableH = (1 + dataRows.length) * ROW_H;
  slide.addTable([hdrRow, ...bodyRows], {
    x: MARGIN,
    y: startY + 0.4,
    w: CONTENT_W,
    h: tableH,
    colW,
    rowH: ROW_H,
  });

  let nextY = startY + 0.4 + tableH + 0.1;
  if (remainCols > 0) {
    slide.addText(`※ 표시 외 ${remainCols}개 컬럼 생략 (총 ${allCols.length}개)`, {
      x: MARGIN, y: nextY, w: CONTENT_W, h: 0.3,
      fontFace: F.body, fontSize: 12, color: C.midText,
    });
    nextY += 0.32;
  }
  return nextY;
}

// ─── 빅넘버 카드 ─────────────────────────────────────────────────────────────

function addBigNumberCard(
  slide: PptxGenJS.Slide,
  label: string,
  value: string,
  unit: string,
  y: number
): void {
  const cardX = 3.2, cardW = 7.0, cardH = 3.2;
  slide.addShape("rect" as PptxGenJS.SHAPE_NAME, {
    x: cardX, y, w: cardW, h: cardH,
    fill: { color: C.offWhite }, line: { color: C.blue, pt: 2 },
  });
  slide.addText(label, {
    x: cardX, y: y + 0.15, w: cardW, h: 0.6,
    align: "center", fontFace: F.body, fontSize: 20, color: C.midText,
  });
  slide.addText(value, {
    x: cardX, y: y + 0.85, w: cardW, h: 1.5,
    align: "center", fontFace: F.title, fontSize: 64, bold: true, color: C.navy,
  });
  slide.addText(unit, {
    x: cardX, y: y + 2.5, w: cardW, h: 0.55,
    align: "center", fontFace: F.body, fontSize: 18, color: C.midText,
  });
}

// ─── Slide 1: 표지 ────────────────────────────────────────────────────────────

function addCoverSlide(pres: PptxGenJS, productName: string, modules: CanvasModule[]): void {
  const slide = pres.addSlide();
  slide.addShape("rect" as PptxGenJS.SHAPE_NAME, {
    x: 0, y: 0, w: SLIDE_W, h: SLIDE_H,
    fill: { color: C.navy },
  });
  slide.addShape("rect" as PptxGenJS.SHAPE_NAME, {
    x: 0, y: SLIDE_H - 0.6, w: SLIDE_W, h: 0.6,
    fill: { color: C.gold },
  });
  slide.addText(productName, {
    x: 1.5, y: 1.6, w: SLIDE_W - 3, h: 1.5,
    align: "center", fontFace: F.title, fontSize: 60, bold: true, color: C.white,
  });
  slide.addText("보험료 산출 보고서", {
    x: 1.5, y: 3.2, w: SLIDE_W - 3, h: 0.85,
    align: "center", fontFace: F.body, fontSize: 36, color: C.gold,
  });

  const policyMod = getModule(modules, ModuleType.DefinePolicyInfo);
  const params = policyMod?.parameters ?? {};
  const chips: string[] = [];
  if (params.entryAge)    chips.push(`가입연령: ${params.entryAge}세`);
  if (params.gender)      chips.push(`성별: ${params.gender === "Male" ? "남자" : "여자"}`);
  if (params.policyTerm)  chips.push(`보험기간: ${params.policyTerm}년`);
  if (params.paymentTerm) chips.push(`납입기간: ${params.paymentTerm}년`);
  if (params.interestRate) chips.push(`예정이자율: ${Number(params.interestRate).toFixed(1)}%`);

  if (chips.length > 0) {
    slide.addText(chips.join("   |   "), {
      x: 1.5, y: 4.25, w: SLIDE_W - 3, h: 0.65,
      align: "center", fontFace: F.body, fontSize: 20, color: C.white,
    });
  }
  slide.addText(`생성일: ${new Date().toLocaleDateString("ko-KR")}`, {
    x: 1.5, y: 6.4, w: SLIDE_W - 3, h: 0.4,
    align: "center", fontFace: F.body, fontSize: 16, color: C.midText,
  });
  slide.addText(`${productName}  |  1 / ${TOTAL_SLIDES}`, {
    x: SLIDE_W - 3.3, y: SLIDE_H - 0.42, w: 3.2, h: 0.35,
    fontFace: F.body, fontSize: 13, color: C.midText, align: "right",
  });
}

// ─── Slide 2: 정책 입력 변수 ──────────────────────────────────────────────────

function addPolicySlide(pres: PptxGenJS, productName: string, modules: CanvasModule[]): void {
  const slide = pres.addSlide();
  const mod = getModule(modules, ModuleType.DefinePolicyInfo);
  addSlideHeader(slide, "정책 입력 변수", 2, productName, mod?.name);

  const params = mod?.parameters ?? {};
  const out = getOutputData(modules, ModuleType.DefinePolicyInfo) as PolicyInfoOutput | null;

  const entryAge    = String(out?.entryAge    ?? params.entryAge    ?? "-");
  const gender      = (() => { const g = out?.gender ?? params.gender ?? "-"; return g === "Male" ? "남자" : g === "Female" ? "여자" : String(g); })();
  const policyTerm  = String(out?.policyTerm  ?? params.policyTerm  ?? "-");
  const paymentTerm = String(out?.paymentTerm ?? params.paymentTerm ?? "-");
  const interestRate = (() => {
    // out.interestRate는 소수(0.025), params.interestRate는 퍼센트(2.5)로 저장됨
    if (out?.interestRate != null) return (Number(out.interestRate) * 100).toFixed(2) + "%";
    if (params.interestRate != null) return Number(params.interestRate).toFixed(2) + "%";
    return "-";
  })();

  const dataRows: string[][] = [
    ["변수명", "값", "단위", "설명"],
    ["가입연령 (x)", entryAge, "세", "피보험자 가입 시 연령"],
    ["성별 (sex)", gender, "-", "피보험자 성별"],
    ["보험기간 (n)", policyTerm, "년", "계약 만료까지 기간"],
    ["납입기간 (m)", paymentTerm, "년", "보험료 납입 기간"],
    ["예정이자율 (i)", interestRate, "-", "연 복리 예정이자율"],
  ];

  const extraParams = Object.entries(params).filter(
    ([k]) => !["entryAge","gender","policyTerm","paymentTerm","interestRate"].includes(k)
  );
  extraParams.slice(0, 4).forEach(([k, v]) => dataRows.push([k, String(v), "-", "-"]));

  const ROW_H = 0.55;
  const colW = [3.0, 2.5, 1.5, 5.33]; // sum = 12.33
  const tRows: PptxGenJS.TableRow[] = dataRows.map((row, ri) => {
    const isHdr = ri === 0;
    return row.map((cell) => ({
      text: cell,
      options: {
        fontFace: F.body, fontSize: isHdr ? 17 : 15,
        bold: isHdr,
        color: isHdr ? C.white : C.darkText,
        fill: { color: isHdr ? C.navy : ri % 2 === 1 ? C.tableOdd : C.tableEven },
        align: "center", valign: "middle",
        border: [
          { type: "solid", pt: 0.75, color: C.border },
          { type: "solid", pt: 0.75, color: C.border },
          { type: "solid", pt: 0.75, color: C.border },
          { type: "solid", pt: 0.75, color: C.border },
        ],
      } as PptxGenJS.TableCellProps,
    }));
  });
  slide.addTable(tRows, {
    x: MARGIN, y: BODY_Y, w: CONTENT_W, h: dataRows.length * ROW_H,
    colW, rowH: ROW_H,
  });
}

// ─── Slide 3: 파이프라인 구성 ─────────────────────────────────────────────────

function addPipelineSlide(pres: PptxGenJS, productName: string, modules: CanvasModule[]): void {
  const slide = pres.addSlide();
  addSlideHeader(slide, "파이프라인 구성", 3, productName);

  const roleMap: Partial<Record<ModuleType, string>> = {
    [ModuleType.LoadData]: "위험률 데이터 로드",
    [ModuleType.DefinePolicyInfo]: "계약 조건 정의",
    [ModuleType.SelectRiskRates]: "위험률 & 할인계수 선택",
    [ModuleType.SelectData]: "데이터 컬럼 선택",
    [ModuleType.RateModifier]: "위험률 조정",
    [ModuleType.CalculateSurvivors]: "생존자수(lx, Dx) 산출",
    [ModuleType.ClaimsCalculator]: "클레임(dx, Cx) 산출",
    [ModuleType.NxMxCalculator]: "교환함수(Nx, Mx) 산출",
    [ModuleType.PremiumComponent]: "BPV / NNX 산출",
    [ModuleType.AdditionalName]: "추가 변수 정의",
    [ModuleType.NetPremiumCalculator]: "순보험료(PP) 산출",
    [ModuleType.GrossPremiumCalculator]: "영업보험료(GP) 산출",
    [ModuleType.ReserveCalculator]: "연도별 준비금 산출",
    [ModuleType.ScenarioRunner]: "시나리오 분석",
    [ModuleType.PipelineExplainer]: "파이프라인 해설",
  };
  const statusColor: Record<ModuleStatus, string> = {
    [ModuleStatus.Success]: "16A34A",
    [ModuleStatus.Error]:   "DC2626",
    [ModuleStatus.Running]: "D97706",
    [ModuleStatus.Pending]: "6B7280",
  };

  const visible = modules.filter(
    (m) => m.type !== ModuleType.TextBox && m.type !== ModuleType.GroupBox
  );
  const COLS = 3;
  const cellW = CONTENT_W / COLS;
  const cellH = 0.9;

  visible.forEach((mod, idx) => {
    const col = idx % COLS;
    const row = Math.floor(idx / COLS);
    const cx = MARGIN + col * cellW;
    const cy = BODY_Y + row * (cellH + 0.08);
    if (cy + cellH > SLIDE_H - 0.4) return;

    slide.addShape("rect" as PptxGenJS.SHAPE_NAME, {
      x: cx, y: cy, w: cellW - 0.08, h: cellH,
      fill: { color: C.offWhite }, line: { color: C.border, pt: 1 },
    });
    slide.addShape("ellipse" as PptxGenJS.SHAPE_NAME, {
      x: cx + cellW - 0.35, y: cy + 0.12, w: 0.18, h: 0.18,
      fill: { color: statusColor[mod.status] },
      line: { color: statusColor[mod.status] },
    });
    slide.addText(mod.name, {
      x: cx + 0.14, y: cy + 0.04, w: cellW - 0.55, h: 0.42,
      fontFace: F.body, fontSize: 15, bold: true, color: C.darkText, valign: "middle",
    });
    slide.addText(roleMap[mod.type] ?? mod.type, {
      x: cx + 0.14, y: cy + 0.47, w: cellW - 0.28, h: 0.36,
      fontFace: F.body, fontSize: 13, color: C.midText, valign: "middle",
    });
  });
}

// ─── Slide 4: 위험률 & 할인계수 ──────────────────────────────────────────────

function addRatingBasisSlide(pres: PptxGenJS, productName: string, modules: CanvasModule[]): void {
  const slide = pres.addSlide();
  const mod = getModule(modules, ModuleType.SelectRiskRates);
  addSlideHeader(slide, "위험률 선택 & 할인계수", 4, productName, mod?.name);

  const rows = getOutputRows(modules, ModuleType.SelectRiskRates);
  const s0 = rows?.[0] ?? {}, s1 = rows?.[1] ?? {};
  const p0 = formatNum(s0["i_prem"] ?? s0["discount_prem"]);
  const c0 = formatNum(s0["i_claim"] ?? s0["discount_claim"]);
  const p1 = formatNum(s1["i_prem"] ?? s1["discount_prem"]);
  const c1 = formatNum(s1["i_claim"] ?? s1["discount_claim"]);

  const fRows = [
    ["단계", "공식", "샘플값 (0년차 | 1년차)"],
    ["할인계수(보험료)", "i_prem[t] = 1 / (1+i)^t", `${p0}  |  ${p1}`],
    ["할인계수(보험금)", "i_claim[t] = 1 / (1+i)^(t+0.5)", `${c0}  |  ${c1}`],
  ];
  if (!rows) fRows.push(["", "※ 미산출 (파이프라인 실행 필요)", ""]);

  let curY = addFormulaTable(slide, fRows, BODY_Y, 0.6);
  curY += 0.15;

  const loadMod = getModule(modules, ModuleType.LoadData);
  slide.addText(`위험률 소스: ${loadMod?.parameters?.source ?? "업로드 파일"}`, {
    x: MARGIN, y: curY, w: CONTENT_W, h: 0.4,
    fontFace: F.body, fontSize: 16, color: C.midText,
  });
  curY += 0.45;

  if (rows) addSampleDataTable(slide, rows, curY);
}

// ─── Slide 5: 생존자수 ────────────────────────────────────────────────────────

function addSurvivorsSlide(pres: PptxGenJS, productName: string, modules: CanvasModule[]): void {
  const slide = pres.addSlide();
  const mod = getModule(modules, ModuleType.CalculateSurvivors);
  addSlideHeader(slide, "생존자수 산출 (lx, Dx)", 5, productName, mod?.name);

  const rows = getOutputRows(modules, ModuleType.CalculateSurvivors);
  const s = [rows?.[0] ?? {}, rows?.[1] ?? {}, rows?.[2] ?? {}];
  const lxCol = rows ? Object.keys(rows[0]).find((k) => k.startsWith("lx_") || k === "lx") : null;
  const dxCol = rows ? Object.keys(rows[0]).find((k) => k.startsWith("Dx_") || k === "Dx") : null;
  const lxV = s.map((r) => (lxCol ? formatNum(r[lxCol], 2) : "-")).join("  |  ");
  const dxV = s.map((r) => (dxCol ? formatNum(r[dxCol], 6) : "-")).join("  |  ");

  const fRows = [
    ["단계", "공식", "샘플값 (0~2년차)"],
    ["생존자수 lx", "lx[t+1] = lx[t] × (1 - qx[t])", lxV || "미산출"],
    ["할인생존자수 Dx", "Dx[t] = lx[t] × v^t", dxV || "미산출"],
  ];
  if (!rows) fRows.push(["", "※ 미산출 (파이프라인 실행 필요)", ""]);

  let curY = addFormulaTable(slide, fRows, BODY_Y, 0.6);
  curY += 0.15;

  if (rows) {
    slide.addText(`초기 생존자수 lx[0] = ${lxCol ? formatNum(rows[0][lxCol], 0) : "100,000"}  |  총 ${rows.length}행`, {
      x: MARGIN, y: curY, w: CONTENT_W, h: 0.38,
      fontFace: F.body, fontSize: 16, color: C.midText,
    });
    curY += 0.45;
    addSampleDataTable(slide, rows, curY);
  }
}

// ─── Slide 6: 클레임 ──────────────────────────────────────────────────────────

function addClaimsSlide(pres: PptxGenJS, productName: string, modules: CanvasModule[]): void {
  const slide = pres.addSlide();
  const mod = getModule(modules, ModuleType.ClaimsCalculator);
  addSlideHeader(slide, "클레임 산출 (dx, Cx)", 6, productName, mod?.name);

  const rows = getOutputRows(modules, ModuleType.ClaimsCalculator);
  const s = [rows?.[0] ?? {}, rows?.[1] ?? {}, rows?.[2] ?? {}];
  const dxCol = rows ? Object.keys(rows[0]).find((k) => k.startsWith("dx_") || k === "dx") : null;
  const cxCol = rows ? Object.keys(rows[0]).find((k) => k.startsWith("Cx_") || k === "Cx") : null;
  const dxV = s.map((r) => (dxCol ? formatNum(r[dxCol], 2) : "-")).join("  |  ");
  const cxV = s.map((r) => (cxCol ? formatNum(r[cxCol], 6) : "-")).join("  |  ");

  const fRows = [
    ["단계", "공식", "샘플값 (0~2년차)"],
    ["사망자수 dx", "dx[t] = lx[t] - lx[t+1]", dxV || "미산출"],
    ["할인사망자수 Cx", "Cx[t] = dx[t] × v^(t+0.5)", cxV || "미산출"],
  ];
  if (!rows) fRows.push(["", "※ 미산출 (파이프라인 실행 필요)", ""]);

  let curY = addFormulaTable(slide, fRows, BODY_Y, 0.6);
  curY += 0.2;
  if (rows) addSampleDataTable(slide, rows, curY);
}

// ─── Slide 7: 교환함수 ────────────────────────────────────────────────────────

function addNxMxSlide(pres: PptxGenJS, productName: string, modules: CanvasModule[]): void {
  const slide = pres.addSlide();
  const mod = getModule(modules, ModuleType.NxMxCalculator);
  addSlideHeader(slide, "교환함수 산출 (Nx, Mx)", 7, productName, mod?.name);

  const rows = getOutputRows(modules, ModuleType.NxMxCalculator);
  const r0 = rows?.[0] ?? {};
  const nxCol = rows ? Object.keys(r0).find((k) => k.startsWith("Nx_") || k === "Nx") : null;
  const mxCol = rows ? Object.keys(r0).find((k) => k.startsWith("Mx_") || k === "Mx") : null;

  const fRows = [
    ["단계", "공식", "샘플값 (0년차)"],
    ["Nx (누적 Dx)", "Nx[t] = Σ Dx[k]  (k=t..n)", nxCol ? formatNum(r0[nxCol], 6) : "미산출"],
    ["Mx (누적 Cx)", "Mx[t] = Σ Cx[k]  (k=t..n)", mxCol ? formatNum(r0[mxCol], 6) : "미산출"],
  ];
  if (!rows) fRows.push(["", "※ 미산출 (파이프라인 실행 필요)", ""]);

  let curY = addFormulaTable(slide, fRows, BODY_Y, 0.6);
  curY += 0.2;
  if (rows) addSampleDataTable(slide, rows, curY);
}

// ─── Slide 8: BPV / NNX ──────────────────────────────────────────────────────
// NNX 납입주기별 공식 포함 (테이블 대신)

function addBpvNnxSlide(pres: PptxGenJS, productName: string, modules: CanvasModule[]): void {
  const slide = pres.addSlide();
  const mod = getModule(modules, ModuleType.PremiumComponent);
  addSlideHeader(slide, "BPV / NNX 산출 (보험수리적 현가)", 8, productName, mod?.name);

  const output = getOutputData(modules, ModuleType.PremiumComponent) as PremiumComponentOutput | null;
  const bpvEntries = output ? Object.entries(output.bpvResults ?? {}) : [];
  const nnxEntries = output ? Object.entries(output.nnxResults ?? {}) : [];

  // ── BPV / NNX 값 테이블
  const valRows: string[][] = [["구분", "공식", "계산값"]];
  bpvEntries.forEach(([k, v]) => valRows.push([k, "BPV = Mx[x] / Dx[x]", formatNum(v, 6)]));

  // Year 버전만 표시 (대표값)
  nnxEntries
    .filter(([k]) => k.includes("(Year)"))
    .forEach(([k, v]) => valRows.push([k, "NNX(Year) = Nx[x] - Nx[x+m]", formatNum(v, 6)]));

  if (valRows.length === 1) valRows.push(["", "※ 미산출 (파이프라인 실행 필요)", ""]);

  let curY = addFormulaTable(slide, valRows, BODY_Y, 0.55);
  curY += 0.25;

  // ── NNX 납입주기별 수식 테이블 ────────────────────────────────────────────────
  slide.addText("NNX 납입주기별 산출 공식", {
    x: MARGIN, y: curY, w: CONTENT_W, h: 0.38,
    fontFace: F.body, fontSize: 17, bold: true, color: C.navy,
  });
  curY += 0.42;

  // 각 납입주기별 실제 계산된 값 찾기
  function findNNX(freq: string): string {
    if (!output) return "미산출";
    const entry = Object.entries(output.nnxResults ?? {}).find(([k]) => k.includes(`(${freq})`));
    if (!entry) return "미산출";
    const v = entry[1];
    return isNaN(v) ? "미산출 (Dx 미설정)" : formatNum(v, 6);
  }

  // Dx 조정계수 (Dx[x] - Dx[x+m]) 표시용 — 첫번째 nnx 기준
  const freqRows: string[][] = [
    ["납입주기", "산출 공식", "보정계수", "계산값"],
    ["연납 (Year)",   "NNX(Year) = Nx[x] - Nx[x+m]",                              "기준",   findNNX("Year")],
    ["반년납 (Half)", "NNX(Half) = NNX(Year) - (1/4) × (Dx[x] - Dx[x+m])",        "- 1/4",  findNNX("Half")],
    ["분기납 (Quarter)", "NNX(Qtr) = NNX(Year) - (3/8) × (Dx[x] - Dx[x+m])",     "- 3/8",  findNNX("Quarter")],
    ["월납 (Month)",  "NNX(Month) = NNX(Year) - (11/24) × (Dx[x] - Dx[x+m])",    "- 11/24", findNNX("Month")],
  ];

  const colW4 = [2.1, 6.43, 1.3, 2.5]; // sum = 12.33
  const freqTableRows: PptxGenJS.TableRow[] = freqRows.map((row, ri) => {
    const isHdr = ri === 0;
    return row.map((cell, ci) => ({
      text: String(cell),
      options: {
        fontFace: !isHdr && ci === 1 ? F.mono : F.body,
        fontSize: !isHdr && ci === 1 ? 13 : isHdr ? 15 : 14,
        bold: isHdr,
        color: isHdr ? C.white : C.darkText,
        fill: { color: isHdr ? C.navy : ri % 2 === 1 ? C.tableOdd : C.tableEven },
        align: (isHdr || ci === 0) ? "center" : "left",
        valign: "middle",
        border: [
          { type: "solid", pt: 0.75, color: C.border },
          { type: "solid", pt: 0.75, color: C.border },
          { type: "solid", pt: 0.75, color: C.border },
          { type: "solid", pt: 0.75, color: C.border },
        ],
      } as PptxGenJS.TableCellProps,
    }));
  });

  const freqH = freqRows.length * 0.56;
  slide.addTable(freqTableRows, {
    x: MARGIN, y: curY, w: CONTENT_W, h: freqH, colW: colW4, rowH: 0.56,
  });
}

// ─── Slide 9: 추가 변수 (AdditionalName) ─────────────────────────────────────

function addAdditionalVariablesSlide(
  pres: PptxGenJS,
  productName: string,
  modules: CanvasModule[]
): void {
  const slide = pres.addSlide();
  const mod = getModule(modules, ModuleType.AdditionalName);
  addSlideHeader(slide, "추가 변수 (Additional Variables)", 9, productName, mod?.name);

  const output = getOutputData(modules, ModuleType.AdditionalName) as AdditionalVariablesOutput | null;

  if (!mod) {
    slide.addText("※ AdditionalName 모듈이 파이프라인에 없습니다.", {
      x: MARGIN, y: 3.0, w: CONTENT_W, h: 0.6,
      fontFace: F.body, fontSize: 20, color: C.midText, align: "center",
    });
    return;
  }

  // 정의된 변수 목록 표시
  const variables = output?.variables ?? {};
  const params = mod.parameters ?? {};
  const varEntries = Object.entries(variables).length > 0
    ? Object.entries(variables)
    : Object.entries(params).filter(([k]) => k !== "formula").slice(0, 20);

  if (varEntries.length === 0) {
    slide.addText("※ 정의된 추가 변수가 없습니다.", {
      x: MARGIN, y: 3.0, w: CONTENT_W, h: 0.6,
      fontFace: F.body, fontSize: 18, color: C.midText, align: "center",
    });
    return;
  }

  const ROW_H = 0.48;
  const colW = [5.0, 3.5, 3.83]; // sum = 12.33
  const hdrRow: PptxGenJS.TableRow = ["변수명", "값", "비고"].map((t) => ({
    text: t,
    options: {
      fontFace: F.body, fontSize: 16, bold: true, color: C.white,
      fill: { color: C.navy }, align: "center", valign: "middle",
      border: [
        { type: "solid", pt: 0.75, color: C.border },
        { type: "solid", pt: 0.75, color: C.border },
        { type: "solid", pt: 0.75, color: C.border },
        { type: "solid", pt: 0.75, color: C.border },
      ],
    } as PptxGenJS.TableCellProps,
  }));

  const bodyRows: PptxGenJS.TableRow[] = varEntries.map(([k, v], ri) =>
    ([k, formatNum(v, 6), "-"] as string[]).map((cell) => ({
      text: String(cell),
      options: {
        fontFace: F.mono, fontSize: 14,
        color: C.darkText,
        fill: { color: ri % 2 === 0 ? C.tableOdd : C.tableEven },
        align: "left", valign: "middle",
        border: [
          { type: "solid", pt: 0.75, color: C.border },
          { type: "solid", pt: 0.75, color: C.border },
          { type: "solid", pt: 0.75, color: C.border },
          { type: "solid", pt: 0.75, color: C.border },
        ],
      } as PptxGenJS.TableCellProps,
    }))
  );

  const maxRows = Math.floor((SLIDE_H - BODY_Y - 0.6) / ROW_H);
  const displayRows = bodyRows.slice(0, maxRows - 1);

  slide.addTable([hdrRow, ...displayRows], {
    x: MARGIN, y: BODY_Y, w: CONTENT_W,
    h: (1 + displayRows.length) * ROW_H,
    colW, rowH: ROW_H,
  });

  if (bodyRows.length > displayRows.length) {
    slide.addText(`※ 표시 외 ${bodyRows.length - displayRows.length}개 변수 생략 (총 ${varEntries.length}개)`, {
      x: MARGIN, y: BODY_Y + (1 + displayRows.length) * ROW_H + 0.1, w: CONTENT_W, h: 0.35,
      fontFace: F.body, fontSize: 14, color: C.midText,
    });
  }
}

// ─── Slide 10: 순보험료 ──────────────────────────────────────────────────────

function addNetPremiumSlide(pres: PptxGenJS, productName: string, modules: CanvasModule[]): void {
  const slide = pres.addSlide();
  const mod = getModule(modules, ModuleType.NetPremiumCalculator);
  addSlideHeader(slide, "순보험료 (Net Premium)", 10, productName, mod?.name);

  const output = getOutputData(modules, ModuleType.NetPremiumCalculator) as NetPremiumOutput | null;
  const formula = output?.formula ?? "PP = BPV / NNX";

  slide.addText("산출 공식", {
    x: MARGIN, y: BODY_Y, w: CONTENT_W, h: 0.42,
    fontFace: F.body, fontSize: 18, bold: true, color: C.navy,
  });
  slide.addShape("rect" as PptxGenJS.SHAPE_NAME, {
    x: MARGIN, y: BODY_Y + 0.47, w: CONTENT_W, h: 0.72,
    fill: { color: C.offWhite }, line: { color: C.border, pt: 1 },
  });
  slide.addText(formula, {
    x: MARGIN + 0.2, y: BODY_Y + 0.47, w: CONTENT_W - 0.4, h: 0.72,
    fontFace: F.mono, fontSize: 22, color: C.darkText, valign: "middle",
  });

  if (output?.substitutedFormula) {
    slide.addText(`= ${output.substitutedFormula}`, {
      x: MARGIN + 0.2, y: BODY_Y + 1.27, w: CONTENT_W, h: 0.45,
      fontFace: F.mono, fontSize: 16, color: C.midText,
    });
  }

  if (output?.netPremium !== undefined) {
    addBigNumberCard(slide, "순보험료 (PP)", formatCurrency(output.netPremium), "원 / 연", BODY_Y + 1.85);
  } else {
    slide.addText("※ 미산출 (파이프라인 실행 필요)", {
      x: MARGIN, y: 3.0, w: CONTENT_W, h: 0.6,
      fontFace: F.body, fontSize: 20, color: C.midText, align: "center",
    });
  }
}

// ─── Slide 11: 영업보험료 ─────────────────────────────────────────────────────

function addGrossPremiumSlide(pres: PptxGenJS, productName: string, modules: CanvasModule[]): void {
  const slide = pres.addSlide();
  const mod = getModule(modules, ModuleType.GrossPremiumCalculator);
  addSlideHeader(slide, "영업보험료 (Gross Premium)", 11, productName, mod?.name);

  const output = getOutputData(modules, ModuleType.GrossPremiumCalculator) as GrossPremiumOutput | null;
  const formula = output?.formula ?? "GP = PP / (1 - expense_ratio)";

  slide.addText("산출 공식", {
    x: MARGIN, y: BODY_Y, w: CONTENT_W, h: 0.42,
    fontFace: F.body, fontSize: 18, bold: true, color: C.navy,
  });
  slide.addShape("rect" as PptxGenJS.SHAPE_NAME, {
    x: MARGIN, y: BODY_Y + 0.47, w: CONTENT_W, h: 0.72,
    fill: { color: C.offWhite }, line: { color: C.border, pt: 1 },
  });
  slide.addText(formula, {
    x: MARGIN + 0.2, y: BODY_Y + 0.47, w: CONTENT_W - 0.4, h: 0.72,
    fontFace: F.mono, fontSize: 22, color: C.darkText, valign: "middle",
  });

  if (output?.substitutedFormula) {
    slide.addText(`= ${output.substitutedFormula}`, {
      x: MARGIN + 0.2, y: BODY_Y + 1.27, w: CONTENT_W, h: 0.45,
      fontFace: F.mono, fontSize: 16, color: C.midText,
    });
  }

  if (output?.grossPremium !== undefined) {
    addBigNumberCard(slide, "영업보험료 (GP)", formatCurrency(output.grossPremium), "원 / 연", BODY_Y + 1.85);
  } else {
    slide.addText("※ 미산출 (파이프라인 실행 필요)", {
      x: MARGIN, y: 3.0, w: CONTENT_W, h: 0.6,
      fontFace: F.body, fontSize: 20, color: C.midText, align: "center",
    });
  }
}

// ─── Slide 12: 연도별 준비금 ──────────────────────────────────────────────────

function addReserveSlide(pres: PptxGenJS, productName: string, modules: CanvasModule[]): void {
  const slide = pres.addSlide();
  const mod = getModule(modules, ModuleType.ReserveCalculator);
  addSlideHeader(slide, "연도별 준비금 추이", 12, productName, mod?.name);

  const rows = getOutputRows(modules, ModuleType.ReserveCalculator);

  if (!rows || rows.length === 0) {
    slide.addText("※ 미산출 (ReserveCalculator 실행 필요)", {
      x: MARGIN, y: 3.0, w: CONTENT_W, h: 0.7,
      fontFace: F.body, fontSize: 20, color: C.midText, align: "center",
    });
    return;
  }

  const firstRow = rows[0];
  const reserveCol = Object.keys(firstRow).find(
    (k) => k.toLowerCase().includes("reserve") || k.toLowerCase().includes("준비금")
  );

  if (!reserveCol) {
    slide.addText(`사용 가능한 컬럼: ${Object.keys(firstRow).join(", ")}`, {
      x: MARGIN, y: BODY_Y, w: CONTENT_W, h: 0.55,
      fontFace: F.body, fontSize: 14, color: C.midText,
    });
    slide.addText("※ 'reserve' 포함 컬럼을 찾을 수 없습니다.", {
      x: MARGIN, y: 3.0, w: CONTENT_W, h: 0.55,
      fontFace: F.body, fontSize: 18, color: C.midText, align: "center",
    });
    return;
  }

  const values = rows.map((r) => Number(r[reserveCol]) || 0);
  const labels = rows.map((_, i) => `${i + 1}년`);

  slide.addChart("line" as PptxGenJS.CHART_NAME, [
    { name: "책임준비금", labels, values },
  ], {
    x: MARGIN, y: BODY_Y, w: CONTENT_W, h: 5.5,
    chartColors: [C.blue],
    lineSize: 2, lineSmooth: true, showLegend: false,
    valAxisTitle: "준비금 (원)", catAxisTitle: "경과연도",
    valGridLine: { color: C.border, size: 0.5 },
    catGridLine: { style: "none" },
    chartArea: { fill: { color: C.white } },
    plotArea: { fill: { color: C.offWhite } },
  });

  const maxV = Math.max(...values);
  const maxIdx = values.indexOf(maxV);
  slide.addText(
    `최고 준비금: ${formatCurrency(maxV)} (${maxIdx + 1}년차)  |  총 ${rows.length}개 연도`,
    {
      x: MARGIN, y: BODY_Y + 5.52, w: CONTENT_W, h: 0.35,
      fontFace: F.body, fontSize: 14, color: C.midText, align: "center",
    }
  );
}

// ─── Slide 13: 가정사항 & 면책 ────────────────────────────────────────────────

function addAssumptionsSlide(pres: PptxGenJS, productName: string, modules: CanvasModule[]): void {
  const slide = pres.addSlide();
  addSlideHeader(slide, "가정사항 & 면책 문구", 13, productName);

  const policyMod = getModule(modules, ModuleType.DefinePolicyInfo);
  const params = policyMod?.parameters ?? {};
  const loadMod = getModule(modules, ModuleType.LoadData);

  const assumptions: string[] = [];
  if (params.interestRate)
    assumptions.push(`예정이자율 ${Number(params.interestRate).toFixed(2)}% 복리 적용`);
  if (params.entryAge && params.gender)
    assumptions.push(`가입연령 ${params.entryAge}세, ${params.gender === "Male" ? "남자" : "여자"} 기준`);
  if (params.policyTerm && params.paymentTerm)
    assumptions.push(`보험기간 ${params.policyTerm}년, 납입기간 ${params.paymentTerm}년`);
  assumptions.push(`위험률 데이터: ${loadMod?.parameters?.source ?? "업로드 파일"}`);
  assumptions.push("초기 생존자수 lx[0] = 100,000 (기준 생명수)");
  assumptions.push("보험료 단위: 원/연 (연납 기준)");
  assumptions.push("계산 정밀도: 소수점 4자리 이하 반올림");

  const ROW_H = 0.5;
  const colW = [0.7, CONTENT_W - 0.7]; // sum = 12.33

  const bulletRows: PptxGenJS.TableRow[] = assumptions.map((text, idx) => [
    {
      text: `${idx + 1}.`,
      options: {
        fontFace: F.body, fontSize: 15, bold: true, color: C.navy,
        align: "center", valign: "middle",
        fill: { color: idx % 2 === 0 ? C.tableOdd : C.tableEven },
        border: [
          { type: "solid", pt: 0.75, color: C.border },
          { type: "solid", pt: 0.75, color: C.border },
          { type: "solid", pt: 0.75, color: C.border },
          { type: "solid", pt: 0.75, color: C.border },
        ],
      } as PptxGenJS.TableCellProps,
    },
    {
      text,
      options: {
        fontFace: F.body, fontSize: 15, color: C.darkText,
        align: "left", valign: "middle",
        fill: { color: idx % 2 === 0 ? C.tableOdd : C.tableEven },
        border: [
          { type: "solid", pt: 0.75, color: C.border },
          { type: "solid", pt: 0.75, color: C.border },
          { type: "solid", pt: 0.75, color: C.border },
          { type: "solid", pt: 0.75, color: C.border },
        ],
      } as PptxGenJS.TableCellProps,
    },
  ]);

  const tableH = assumptions.length * ROW_H;
  slide.addTable(bulletRows, {
    x: MARGIN, y: BODY_Y, w: CONTENT_W, h: tableH, colW, rowH: ROW_H,
  });

  const discY = BODY_Y + tableH + 0.35;
  slide.addShape("rect" as PptxGenJS.SHAPE_NAME, {
    x: MARGIN, y: discY, w: CONTENT_W, h: 0.9,
    fill: { color: "FEF3C7" }, line: { color: C.gold, pt: 1.5 },
  });
  slide.addText(
    "본 보고서는 내부 검토용이며 외부 공시 자료가 아닙니다. 본 보고서의 수치는 검증 전 자동 산출값으로, 최종 의사결정에 앞서 계리사의 공식 검토가 필요합니다.",
    {
      x: MARGIN + 0.15, y: discY + 0.07, w: CONTENT_W - 0.3, h: 0.78,
      fontFace: F.body, fontSize: 15, color: "92400E",
      valign: "middle", wrap: true,
    }
  );
}

// ─── 메인 진입점 ──────────────────────────────────────────────────────────────

export async function buildSlideReport(
  productName: string,
  modules: CanvasModule[]
): Promise<void> {
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE";

  addCoverSlide(pres, productName, modules);
  addPolicySlide(pres, productName, modules);
  addPipelineSlide(pres, productName, modules);
  addRatingBasisSlide(pres, productName, modules);
  addSurvivorsSlide(pres, productName, modules);
  addClaimsSlide(pres, productName, modules);
  addNxMxSlide(pres, productName, modules);
  addBpvNnxSlide(pres, productName, modules);
  addAdditionalVariablesSlide(pres, productName, modules);
  addNetPremiumSlide(pres, productName, modules);
  addGrossPremiumSlide(pres, productName, modules);
  addReserveSlide(pres, productName, modules);
  addAssumptionsSlide(pres, productName, modules);

  await pres.writeFile({ fileName: `${productName}_보험료산출보고서` });
}
