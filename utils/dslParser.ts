/**
 * DSL Parser: "output = formula" 형식의 텍스트를 파이프라인 모듈 파라미터로 변환
 *
 * 포맷:
 *   # 상품명 | age=40 | sex=Male | pay=20 | rate=2.5
 *
 *   ## LoadData
 *   file = Risk_Rates.csv
 *
 *   ## SelectRiskRates
 *   Death_Rate = Male_Mortality
 *
 *   ## NetPremiumCalculator
 *   NP = BPV / NNX
 */

import { ModuleType } from '../types';

export interface DSLSection {
  type: ModuleType;
  include: boolean;
  lines: Array<{ output: string; formula: string; lineNumber: number }>;
  raw: string[];
}

export interface DSLModel {
  productName: string;
  policyParams: {
    entryAge: number;
    gender: string;
    paymentTerm: number;
    interestRate: number;
    policyTerm: number | '';
    maturityAge: number;
  };
  basicValues: Array<{ name: string; value: number }>;
  sections: DSLSection[];
  errors: string[];
}

// ── 헤더 키워드 → ModuleType 매핑
// NOTE: resolveModuleType()이 "calculator|module|모듈"을 strip한 뒤 조회하므로
//       키도 strip된 형태로 저장해야 합니다.
const HEADER_MAP: Record<string, ModuleType> = {
  loaddata: ModuleType.LoadData,
  load: ModuleType.LoadData,
  위험률로드: ModuleType.LoadData,
  selectriskrates: ModuleType.SelectRiskRates,
  ratingbasisbuilder: ModuleType.SelectRiskRates,
  연령성별매칭: ModuleType.SelectRiskRates,
  agegendermatching: ModuleType.SelectRiskRates,
  selectdata: ModuleType.SelectData,
  데이터선택: ModuleType.SelectData,
  ratemodifier: ModuleType.RateModifier,
  요율수정: ModuleType.RateModifier,
  calculatesurvivors: ModuleType.CalculateSurvivors,
  생존자계산: ModuleType.CalculateSurvivors,
  // "ClaimsCalculator" → strip → "claims"
  claims: ModuleType.ClaimsCalculator,
  클레임계산: ModuleType.ClaimsCalculator,
  // "NxMxCalculator" → strip → "nxmx"
  nxmx: ModuleType.NxMxCalculator,
  nxmx계산: ModuleType.NxMxCalculator,
  premiumcomponent: ModuleType.PremiumComponent,
  nnxmmx계산: ModuleType.PremiumComponent,
  additionalname: ModuleType.AdditionalName,
  추가변수: ModuleType.AdditionalName,
  사업비: ModuleType.AdditionalName,
  // "NetPremiumCalculator" → strip → "netpremium"
  netpremium: ModuleType.NetPremiumCalculator,
  순보험료: ModuleType.NetPremiumCalculator,
  // "GrossPremiumCalculator" → strip → "grosspremium"
  grosspremium: ModuleType.GrossPremiumCalculator,
  영업보험료: ModuleType.GrossPremiumCalculator,
  // "ReserveCalculator" → strip → "reserve"
  reserve: ModuleType.ReserveCalculator,
  준비금: ModuleType.ReserveCalculator,
  scenariorunner: ModuleType.ScenarioRunner,
  시나리오: ModuleType.ScenarioRunner,
  definepolicyinfo: ModuleType.DefinePolicyInfo,
};

function resolveModuleType(header: string): ModuleType | null {
  const key = header
    .toLowerCase()
    .replace(/[\s\[\]_\-]/g, '')
    .replace(/calculator|module|모듈/g, '');
  return HEADER_MAP[key] ?? null;
}

// ── 헤더(1행)의 정책 파라미터 파싱
// 예: # 종신보험 A형 | age=40 | sex=Male | pay=20 | rate=2.5
function parsePolicyHeader(line: string): Partial<DSLModel['policyParams']> & { productName?: string } {
  const parts = line.replace(/^#+\s*/, '').split('|').map((s) => s.trim());
  const result: any = { productName: parts[0] };

  for (const part of parts.slice(1)) {
    const [k, v] = part.split('=').map((s) => s.trim().toLowerCase());
    if (!k || !v) continue;
    if (k === 'age' || k === '가입연령') result.entryAge = Number(v);
    else if (k === 'sex' || k === 'gender' || k === '성별') result.gender = v.charAt(0).toUpperCase() + v.slice(1);
    else if (k === 'pay' || k === '납입기간' || k === 'payment') result.paymentTerm = Number(v);
    else if (k === 'rate' || k === '이율') result.interestRate = Number(v);
    else if (k === 'term' || k === '보험기간') result.policyTerm = Number(v);
    else if (k === 'maturity' || k === '만기연령') result.maturityAge = Number(v);
  }
  return result;
}

// ── "output = formula" 한 줄 파싱
function parseLine(raw: string): { output: string; formula: string } | null {
  const eqIdx = raw.indexOf('=');
  if (eqIdx < 0) return null;
  const output = raw.slice(0, eqIdx).trim();
  const formula = raw.slice(eqIdx + 1).trim();
  if (!output || !formula) return null;
  return { output, formula };
}

// ═══════════════════════════════════════════
// 섹션별 파라미터 변환
// ═══════════════════════════════════════════

function buildLoadDataParams(lines: Array<{ output: string; formula: string }>) {
  const fileLine = lines.find((l) => l.output.toLowerCase() === 'file');
  return { source: fileLine?.formula ?? 'Risk_Rates.csv' };
}

function buildSelectRiskRatesParams(lines: Array<{ output: string; formula: string }>) {
  const params: Record<string, any> = {
    ageColumn: 'Age',
    genderColumn: 'Sex',
    excludeNonNumericRows: true,
    columnRenames: [] as Array<{ from: string; to: string }>,
  };
  for (const { output, formula } of lines) {
    const key = output.toLowerCase();
    if (key === 'agecol' || key === '나이컬럼') params.ageColumn = formula;
    else if (key === 'gendercol' || key === '성별컬럼') params.genderColumn = formula;
    else if (output && formula) {
      // 열 이름 변경: 출력열이름 = 원본열이름 → 실행 시 입력 데이터에 존재해야 함
      params.columnRenames.push({ from: formula.trim(), to: output.trim() });
    }
  }
  return params;
}

function buildSelectDataParams(lines: Array<{ output: string; formula: string }>) {
  // cols = Age, Death_Rate, ... 형태 또는 output = input 형태
  const colsLine = lines.find((l) => l.output.toLowerCase() === 'cols');
  if (colsLine) {
    const names = colsLine.formula.split(',').map((s) => s.trim()).filter(Boolean);
    const selections = names.map((n) => ({ originalName: n, selected: true, newName: n }));
    const drSel = selections.find((s) => s.newName === 'Death_Rate');
    return { selections, deathRateColumn: drSel?.originalName ?? '' };
  }
  // output = input 형태로 지정된 경우
  const selections = lines.map(({ output, formula }) => ({
    originalName: formula,
    selected: true,
    newName: output,
  }));
  // Death_Rate로 이름 변경된 열을 deathRateColumn으로 자동 감지
  const drSel = selections.find((s) => s.newName === 'Death_Rate');
  return { selections, deathRateColumn: drSel?.originalName ?? '' };
}

function buildRateModifierParams(lines: Array<{ output: string; formula: string }>) {
  const calculations = lines.map(({ output, formula }, i) => ({
    id: `rm-${i}`,
    newColumnName: output,
    formula: formula.replace(/\[/g, '[').replace(/\]/g, ']'),
  }));
  return { calculations };
}

function buildCalculateSurvivorsParams(lines: Array<{ output: string; formula: string }>) {
  // 예: mortalityCol = Death_Rate       → mortalityColumn = 'Death_Rate'
  //     lx_Mortality = lx(Death_Rate)  → name = "Mortality"
  //     lx = 100000                    → fixedValue = 100000
  let mortalityColumn = 'None';
  const calculations: any[] = [];
  for (const { output, formula } of lines) {
    const key = output.toLowerCase().replace(/\s/g, '');
    // mortalityCol 지정 라인
    if (key === 'mortalitycol' || key === '사망률열' || key === '위험률열') {
      mortalityColumn = formula.trim();
      continue;
    }
    const lxKey = output.toLowerCase();
    if (!(lxKey === 'lx' || lxKey.startsWith('lx'))) continue;

    const nameFromOutput = output.replace(/^lx_?/i, '').trim();

    // 순수 숫자이면 고정값 lx
    if (/^[\d,]+(\.\d+)?$/.test(formula.trim())) {
      const fixedValue = Number(formula.trim().replace(/,/g, ''));
      calculations.push({
        id: `surv-${calculations.length}`,
        name: nameFromOutput || 'Fixed',
        fixedValue,
      });
      continue;
    }

    // 일반 감소율 lx
    const match = formula.match(/\(([^)]+)\)/);
    const decrementRates = match
      ? match[1].split(',').map((s) => s.trim())
      : [formula.trim()];
    const name = nameFromOutput || decrementRates[0].replace(/_/g, ' ').trim();
    calculations.push({
      id: `surv-${calculations.length}`,
      name,
      decrementRates,
    });
  }
  return {
    ageColumn: 'Age',
    mortalityColumn,
    addFixedLx: false,
    calculations,
  };
}

function buildClaimsCalculatorParams(lines: Array<{ output: string; formula: string }>) {
  // 예: dx = lx_Mortality * Death_Rate
  //     Cx = dx_Mortality * i_claim
  const calculations: any[] = [];
  for (const { output, formula } of lines) {
    const outLow = output.toLowerCase();
    if (outLow === 'dx' || outLow.startsWith('dx')) {
      // lx * ColName 에서 ColName 추출
      const parts = formula.split('*').map((s) => s.trim());
      const lxCol = parts[0]; // lx_Mortality
      const riskCol = parts[1]; // Death_Rate
      const name = lxCol.replace(/^lx_?/i, '') || 'Mortality';
      calculations.push({
        id: `claim-${calculations.length}`,
        lxColumn: lxCol,
        riskRateColumn: riskCol,
        name,
      });
    }
  }
  return { calculations };
}

function buildNxMxParams(lines: Array<{ output: string; formula: string }>) {
  const nxCalculations: any[] = [];
  const mxCalculations: any[] = [];
  // DSL에서 인식하는 공제 옵션 (ParameterInputModal의 옵션과 동일)
  const KNOWN_DEDUCT = new Set(['0', '0.25', '0.5']);

  for (const { output, formula } of lines) {
    const outLow = output.toLowerCase();
    // sum(col), cumsum_rev(col), cumsum_rev(col, deduct=X), Σ(col) 모두 지원
    const colMatch = formula.match(/\(([^)]+)\)/);
    const innerContent = colMatch ? colMatch[1].trim() : formula.trim();

    // deduct 파라미터 파싱: cumsum_rev(Cx_CI, deduct=0.5) → deductibleType='0.5'
    const deductMatch = innerContent.match(/,\s*deduct\s*=\s*([\d.]+)/i);
    const deductValue = deductMatch ? deductMatch[1] : '0';
    const deductibleType = KNOWN_DEDUCT.has(deductValue) ? deductValue : 'custom';
    const customDeductible = parseFloat(deductValue) || 0;

    // 첫 번째 인자가 baseColumn
    const baseColumn = innerContent.split(',')[0].trim();
    // output 변수 이름에서 name 파생: Nx_Mortality → "Mortality", Mx_CI → "CI"
    const nameFromOutput = output.replace(/^[NnMm]x_?/i, '').trim();
    const name = nameFromOutput || baseColumn.replace(/^[Dd]x_?/, '').replace(/^[Cc]x_?/, '') || output;

    if (outLow.startsWith('nx')) {
      nxCalculations.push({ id: `nx-${nxCalculations.length}`, baseColumn, name, active: true });
    } else if (outLow.startsWith('mx')) {
      mxCalculations.push({
        id: `mx-${mxCalculations.length}`,
        baseColumn,
        name,
        active: true,
        deductibleType,
        customDeductible,
        paymentRatios: [{ year: 1, type: '100%', customValue: 100 }],
      });
    }
  }
  return { nxCalculations, mxCalculations };
}

function buildPremiumComponentParams(lines: Array<{ output: string; formula: string }>) {
  const nnxCalculations: any[] = [];
  const sumxCalculations: any[] = [];

  for (const { output, formula } of lines) {
    const outLow = output.toLowerCase();
    if (outLow === 'nnx' || outLow.startsWith('nnx')) {
      // Diff(Nx_col, m) 또는 구형 Nx_col[0] - Nx_col[m] → nxColumn 추출
      const diffMatch = formula.match(/Diff\s*\(\s*([A-Za-z_]\w*)\s*,/i);
      const legacyMatch = formula.match(/([A-Za-z_]\w*)\[/);
      const nxCol = diffMatch ? diffMatch[1] : (legacyMatch ? legacyMatch[1] : 'Nx_Mortality');
      nnxCalculations.push({ id: `nnx-${nnxCalculations.length}`, nxColumn: nxCol });
    } else if (outLow === 'bpv' || outLow.startsWith('bpv_') || outLow === 'sumx' || outLow.startsWith('sumx')) {
      // Diff(Mx_col, n) * amount 또는 구형 (Mx_col[0] - Mx_col[n]) * amount → mxColumn + amount 추출
      const diffMatch = formula.match(/Diff\s*\(\s*([A-Za-z_]\w*)\s*,/i);
      const legacyMatch = formula.match(/([A-Za-z_]\w*)\[/);
      const mxCol = diffMatch ? diffMatch[1] : (legacyMatch ? legacyMatch[1] : 'Mx_Mortality');
      const amtMatch = formula.match(/\)\s*\*\s*([\d,]+)|\*\s*([\d,]+)/);
      const amtStr = amtMatch ? (amtMatch[1] ?? amtMatch[2]) : '10000';
      const amount = Number(amtStr.replace(/,/g, '')) || 10000;
      sumxCalculations.push({ id: `bpv-${sumxCalculations.length}`, mxColumn: mxCol, amount });
    }
  }
  return { nnxCalculations, sumxCalculations };
}

function buildAdditionalNameParams(lines: Array<{ output: string; formula: string }>) {
  const basicValues: Array<{ name: string; value: number }> = [];
  for (const { output, formula } of lines) {
    basicValues.push({ name: output, value: Number(formula) || 0 });
  }
  if (basicValues.length === 0) {
    basicValues.push(
      { name: 'α1', value: 0 },
      { name: 'α2', value: 0 },
      { name: 'β1', value: 0 },
      { name: 'β2', value: 0 },
      { name: 'γ',  value: 0 },
    );
  }
  return { basicValues, definitions: [] };
}

/** DSL 수식의 식별자에 대괄호를 복원한다: BPV / NNX → [BPV] / [NNX] */
function addVarBrackets(formula: string): string {
  // 이미 대괄호가 있으면 그대로 반환 (UI에서 직접 입력한 경우)
  if (formula.includes('[')) return formula;
  // 숫자·연산자가 아닌 식별자(알파·그리스문자·밑줄로 시작)에 대괄호 추가
  // NNX_Mortality(Year) 같이 괄호 접미사가 있는 경우도 포함
  return formula.replace(
    /([A-Za-z_\u03B1-\u03C9\u0391-\u03A9][A-Za-z0-9_\u03B1-\u03C9\u0391-\u03A9]*(?:\([^)]*\))?)/g,
    '[$1]'
  );
}

function buildFormulaParams(
  lines: Array<{ output: string; formula: string }>,
  defaultVarName: string
) {
  // Net/Gross Premium: 첫 번째 줄이 "VarName = formula"
  const first = lines[0];
  if (!first) return { formula: '', variableName: defaultVarName };
  return { formula: addVarBrackets(first.formula), variableName: first.output };
}

function buildReserveParams(lines: Array<{ output: string; formula: string }>) {
  let formulaForPaymentTermOrLess = '';
  let formulaForGreaterThanPaymentTerm = '';
  for (const { output, formula } of lines) {
    // V[t<=m] 또는 V[납입중] → 납입 중
    if (/<=|납입중|납입기간이하/i.test(output)) {
      formulaForPaymentTermOrLess = formula;
    } else if (/>|납입후|납입기간초과/i.test(output)) {
      formulaForGreaterThanPaymentTerm = formula;
    }
  }
  return {
    formulaForPaymentTermOrLess,
    formulaForGreaterThanPaymentTerm,
    reserveColumnName: 'Reserve',
  };
}

// ══════════════════════════════════════════════
// 메인 파서
// ══════════════════════════════════════════════

export function parseDSL(text: string): DSLModel {
  const errors: string[] = [];
  const lines = text.split('\n');

  const model: DSLModel = {
    productName: 'New Life Product',
    policyParams: {
      entryAge: 40,
      gender: 'Male',
      paymentTerm: 20,
      interestRate: 2.5,
      policyTerm: '',
      maturityAge: 0,
    },
    basicValues: [
      { name: 'α1', value: 0 },
      { name: 'α2', value: 0 },
      { name: 'β1', value: 0 },
      { name: 'β2', value: 0 },
      { name: 'γ',  value: 0 },
    ],
    sections: [],
    errors,
  };

  let currentSection: DSLSection | null = null;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();

    if (!line || line.startsWith('//') || line.startsWith('#!')) continue;

    // ── # 헤더: 상품명 + 정책 파라미터
    if (line.startsWith('# ') && !line.startsWith('## ')) {
      const parsed = parsePolicyHeader(line);
      if (parsed.productName) model.productName = parsed.productName;
      Object.assign(model.policyParams, parsed);
      continue;
    }

    // ── ## 섹션 헤더
    if (line.startsWith('## ')) {
      if (currentSection) model.sections.push(currentSection);
      const headerText = line.replace(/^##\s*/, '').split('//')[0].trim();
      const type = resolveModuleType(headerText);
      if (!type) {
        errors.push(`알 수 없는 모듈: "${headerText}" (${i + 1}번째 줄)`);
        currentSection = null;
      } else {
        currentSection = { type, include: true, lines: [], raw: [] };
      }
      continue;
    }

    // ── 섹션 내 줄: output = formula
    if (currentSection) {
      const comment = line.indexOf('//');
      const cleanLine = comment >= 0 ? line.slice(0, comment).trim() : line;
      if (!cleanLine) continue;

      const parsed = parseLine(cleanLine);
      if (parsed) {
        currentSection.lines.push({ ...parsed, lineNumber: i + 1 });
      }
      currentSection.raw.push(raw);
    }
  }

  if (currentSection) model.sections.push(currentSection);

  return model;
}

// ══════════════════════════════════════════════
// 파싱된 DSL → 모듈 파라미터 맵 변환
// ══════════════════════════════════════════════

export interface DSLModuleConfig {
  type: ModuleType;
  parameters: Record<string, any>;
}

export function buildModuleConfigs(model: DSLModel): DSLModuleConfig[] {
  const configs: DSLModuleConfig[] = [];

  // DefinePolicyInfo는 항상 포함
  configs.push({
    type: ModuleType.DefinePolicyInfo,
    parameters: { ...model.policyParams },
  });

  for (const section of model.sections) {
    if (!section.include) continue;
    const { type, lines } = section;
    let parameters: Record<string, any> = {};

    switch (type) {
      case ModuleType.LoadData:
        parameters = buildLoadDataParams(lines);
        break;
      case ModuleType.SelectRiskRates:
        parameters = buildSelectRiskRatesParams(lines);
        break;
      case ModuleType.SelectData:
        parameters = buildSelectDataParams(lines);
        break;
      case ModuleType.RateModifier:
        parameters = buildRateModifierParams(lines);
        break;
      case ModuleType.CalculateSurvivors:
        parameters = buildCalculateSurvivorsParams(lines);
        break;
      case ModuleType.ClaimsCalculator:
        parameters = buildClaimsCalculatorParams(lines);
        break;
      case ModuleType.NxMxCalculator:
        parameters = buildNxMxParams(lines);
        break;
      case ModuleType.PremiumComponent:
        parameters = buildPremiumComponentParams(lines);
        break;
      case ModuleType.AdditionalName:
        parameters = buildAdditionalNameParams(lines);
        break;
      case ModuleType.NetPremiumCalculator:
        parameters = buildFormulaParams(lines, 'PP');
        break;
      case ModuleType.GrossPremiumCalculator:
        parameters = buildFormulaParams(lines, 'GP');
        break;
      case ModuleType.ReserveCalculator:
        parameters = buildReserveParams(lines);
        break;
      default:
        parameters = {};
    }

    configs.push({ type, parameters });
  }

  return configs;
}

// ══════════════════════════════════════════════
// 현재 캔버스 → DSL 텍스트 생성 (역방향)
// ══════════════════════════════════════════════

/** `[VAR]` 형태의 변수 브래킷 제거 (배열 인덱스 `[t]`, `[0]`, `[m]`, `[n]` 등 단순 인덱스는 유지) */
function stripVarBrackets(formula: string): string {
  // 앞에 ']' 또는 단어 문자가 오지 않는 `[IDENTIFIER]` 만 제거 (배열 인덱스 제외)
  return formula.replace(/(?<![}\])\w])\[([A-Za-zα-ωΑ-Ω_][A-Za-z0-9α-ωΑ-Ω_]*)\]/g, '$1');
}

// ── DSL 섹션 레이블 맵 (모듈타입 → ## 헤더명)
export const DSL_MODULE_LABELS: Partial<Record<ModuleType, string>> = {
  [ModuleType.LoadData]: 'LoadData',
  [ModuleType.SelectRiskRates]: 'RatingBasisBuilder',
  [ModuleType.SelectData]: 'SelectData',
  [ModuleType.RateModifier]: 'RateModifier',
  [ModuleType.CalculateSurvivors]: 'CalculateSurvivors',
  [ModuleType.ClaimsCalculator]: 'ClaimsCalculator',
  [ModuleType.NxMxCalculator]: 'NxMxCalculator',
  [ModuleType.PremiumComponent]: 'PremiumComponent',
  [ModuleType.AdditionalName]: 'AdditionalName',
  [ModuleType.NetPremiumCalculator]: 'NetPremiumCalculator',
  [ModuleType.GrossPremiumCalculator]: 'GrossPremiumCalculator',
  [ModuleType.ReserveCalculator]: 'ReserveCalculator',
  [ModuleType.ScenarioRunner]: 'ScenarioRunner',
};

/** 전체 DSL 텍스트에서 특정 모듈의 섹션만 추출 (## Label 헤더 포함, 다음 ## 직전까지) */
export function extractModuleSection(dsl: string, moduleType: ModuleType): string {
  const label = DSL_MODULE_LABELS[moduleType];
  if (!label) return '';
  const lines = dsl.split('\n');
  let inSection = false;
  const sectionLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith(`## ${label}`)) {
      inSection = true;
      sectionLines.push(line);
    } else if (inSection) {
      if (line.startsWith('## ')) break;
      sectionLines.push(line);
    }
  }
  return sectionLines.join('\n').trimEnd();
}

/** 전체 DSL 텍스트에서 특정 모듈 섹션을 newSection 으로 교체; 섹션이 없으면 끝에 추가 */
export function replaceModuleSection(dsl: string, moduleType: ModuleType, newSection: string): string {
  const label = DSL_MODULE_LABELS[moduleType];
  if (!label) return dsl;
  const lines = dsl.split('\n');
  const startIdx = lines.findIndex(l => l.startsWith(`## ${label}`));
  if (startIdx === -1) {
    return dsl.trimEnd() + '\n\n' + newSection.trimEnd();
  }
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) { endIdx = i; break; }
  }
  const before = lines.slice(0, startIdx);
  const after = lines.slice(endIdx);
  const combined = [...before, ...newSection.trimEnd().split('\n'), '', ...after];
  return combined.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function generateDSL(
  productName: string,
  modules: Array<{ type: ModuleType; parameters: Record<string, any> }>
): string {
  const lines: string[] = [];

  const policyMod = modules.find((m) => m.type === ModuleType.DefinePolicyInfo);
  const p = policyMod?.parameters ?? {};
  lines.push(
    `# ${productName} | age=${p.entryAge ?? 40} | sex=${p.gender ?? 'Male'} | pay=${p.paymentTerm ?? 20} | rate=${p.interestRate ?? 2.5}`
  );
  lines.push('');

  const order: ModuleType[] = [
    ModuleType.LoadData,
    ModuleType.SelectData,
    ModuleType.SelectRiskRates,
    ModuleType.RateModifier,
    ModuleType.CalculateSurvivors,
    ModuleType.ClaimsCalculator,
    ModuleType.NxMxCalculator,
    ModuleType.PremiumComponent,
    ModuleType.AdditionalName,
    ModuleType.NetPremiumCalculator,
    ModuleType.GrossPremiumCalculator,
    ModuleType.ReserveCalculator,
    ModuleType.ScenarioRunner,
  ];

  const LABELS = DSL_MODULE_LABELS;

  // ── 모듈별 한글 설명 주석 (DSL 편집기에서 사용자가 볼 수 있도록)
  const MODULE_COMMENTS: Partial<Record<ModuleType, string[]>> = {
    [ModuleType.LoadData]: [
      '// 위험률 CSV 파일을 불러옵니다',
    ],
    [ModuleType.SelectRiskRates]: [
      '// 가입연령(ageCol)·성별(genderCol)로 보험기간 n 동안의 위험률 행을 선택합니다',
      '// 할인율(i_prem, i_claim)을 자동으로 계산합니다',
    ],
    [ModuleType.SelectData]: [
      '// 계산에 필요한 열만 선택합니다 (출력열이름 = 원본열이름)',
      '// Death_Rate로 이름 변경된 열은 Survivors Calculator의 사망위험률로 자동 적용됩니다',
    ],
    [ModuleType.RateModifier]: [
      '// 위험률 수정이 필요한 경우 수식을 추가하세요. 기본값은 아무 작업도 하지 않습니다.',
      '// 예: Modified_Rate = Death_Rate * 1.5',
    ],
    [ModuleType.CalculateSurvivors]: [
      '// mortalityCol: 사망위험률 열 이름 (Mortality Rate Column 항목과 연동)',
      '// lx(위험률): 나이별 생존자수  [초기값 lx[0] = 100,000]',
      '//   lx[t] = lx[t-1] × (1 - 위험률[t])',
      '//   다중감소 예: lx(사망률, 해약률)',
      '// Dx: 할인 생존자수 = lx × i_prem',
    ],
    [ModuleType.ClaimsCalculator]: [
      '// dx: 나이별 사망자수 = lx × 사망위험률',
      '// Cx: 할인 사망자수 = dx × i_claim',
    ],
    [ModuleType.NxMxCalculator]: [
      '// cumsum_rev(Dx): 역방향 누적합 — 각 나이부터 만기까지의 Dx 합계',
      '//   Nx[t] = Dx[t] + Dx[t+1] + ... + Dx[만기]',
      '//   Nx: 보험료 납입연금 현가 / Mx: 사망급부 현가 계산에 사용',
      '// 공제(대기기간) 옵션: cumsum_rev(Cx, deduct=0.25)  ← 25% 공제(3개월 대기)',
    ],
    [ModuleType.PremiumComponent]: [
      '// NNX = Diff(Nx, m)  ← Nx[0] - Nx[m]  (납입기간 보험료 연금현가)',
      '//   생성변수: NNX(Year), NNX(Half), NNX(Quarter), NNX(Month)',
      '// BPV = Diff(Mx, n) × 보험가입금액  ← (Mx[0] - Mx[n]) × 금액',
    ],
    [ModuleType.AdditionalName]: [
      '// 영업보험료 계산용 사업비 계수 (0이면 사업비 없음)',
      '// α1, α2: 신계약비율  /  β1, β2: 유지비율  /  γ: 수금비율',
    ],
    [ModuleType.NetPremiumCalculator]: [
      '// 순보험료 PP = 급부현가(BPV) ÷ 보험료현가(NNX)',
      '//   수지상등 원칙: 미래 급부현가 = 미래 보험료현가',
    ],
    [ModuleType.GrossPremiumCalculator]: [
      '// 영업보험료 GP = 순보험료 PP ÷ (1 - 사업비율)',
    ],
    [ModuleType.ReserveCalculator]: [
      '// 순보험료식 책임준비금: V[t] = 미래급부현가 - 미래보험료현가 (t 시점 기준)',
      '// V[t<=m]: 납입기간 중  /  V[t>m]: 납입 완료 후',
    ],
  };

  for (const type of order) {
    const mod = modules.find((m) => m.type === type);
    if (!mod) continue;
    const par = mod.parameters;
    const label = LABELS[type] ?? type;

    lines.push(`## ${label}`);
    // 모듈별 한글 설명 주석 삽입
    const moduleComments = MODULE_COMMENTS[type];
    if (moduleComments) {
      for (const c of moduleComments) lines.push(c);
    }

    switch (type) {
      case ModuleType.LoadData:
        lines.push(`file = ${par.source ?? 'Risk_Rates.csv'}`);
        break;

      case ModuleType.SelectRiskRates:
        lines.push(`ageCol    = ${par.ageColumn ?? 'Age'}`);
        lines.push(`genderCol = ${par.genderColumn ?? 'Sex'}`);
        break;

      case ModuleType.SelectData:
        if (Array.isArray(par.selections) && par.selections.length > 0) {
          for (const s of par.selections) {
            if (s.selected) {
              if (s.newName && s.newName !== s.originalName)
                lines.push(`${s.newName} = ${s.originalName}`);
              else
                lines.push(`${s.originalName} = ${s.originalName}`);
            }
          }
        } else {
          lines.push(`// (선택된 열 없음)`);
        }
        break;

      case ModuleType.RateModifier:
        if (Array.isArray(par.calculations)) {
          for (const c of par.calculations) {
            lines.push(`${c.newColumnName} = ${c.formula}`);
          }
        }
        if (!par.calculations?.length) lines.push(`// (수식 없음)`);
        break;

      case ModuleType.CalculateSurvivors:
        if (par.mortalityColumn && par.mortalityColumn !== 'None') {
          lines.push(`mortalityCol = ${par.mortalityColumn}`);
        }
        if (Array.isArray(par.calculations)) {
          for (const c of par.calculations) {
            const prefix = c.name ? `lx_${c.name}` : 'lx';
            if (c.fixedValue !== undefined) {
              // 고정값 lx: lx_Fixed = 100000
              lines.push(`${prefix} = ${c.fixedValue}`);
            } else {
              const rates = (c.decrementRates ?? []).join(', ');
              lines.push(`${prefix} = lx(${rates})`);
              lines.push(`Dx_${c.name} = ${prefix} * i_prem`);
            }
          }
        }
        if (!par.calculations?.length) lines.push(`lx = lx(Death_Rate)`);
        break;

      case ModuleType.ClaimsCalculator:
        if (Array.isArray(par.calculations)) {
          for (const c of par.calculations) {
            lines.push(`dx_${c.name} = ${c.lxColumn} * ${c.riskRateColumn}`);
            lines.push(`Cx_${c.name} = dx_${c.name} * i_claim`);
          }
        }
        if (!par.calculations?.length) lines.push(`dx = lx * Death_Rate`);
        break;

      case ModuleType.NxMxCalculator:
        if (Array.isArray(par.nxCalculations)) {
          for (const c of par.nxCalculations) {
            const nxName = c.name || c.baseColumn.replace(/^Dx_/, '');
            lines.push(`Nx_${nxName} = cumsum_rev(${c.baseColumn})`);
          }
        }
        if (Array.isArray(par.mxCalculations)) {
          for (const c of par.mxCalculations) {
            const mxName = c.name || c.baseColumn.replace(/^Cx_/, '');
            // deductibleType이 '0'이 아니면 deduct 파라미터 포함
            const deductSuffix = (c.deductibleType && c.deductibleType !== '0')
              ? `, deduct=${c.deductibleType === 'custom' ? (c.customDeductible ?? 0) : c.deductibleType}`
              : '';
            lines.push(`Mx_${mxName} = cumsum_rev(${c.baseColumn}${deductSuffix})`);
          }
        }
        if (!par.nxCalculations?.length && !par.mxCalculations?.length) {
          lines.push(`Nx = cumsum_rev(Dx_Mortality)`);
          lines.push(`Mx = cumsum_rev(Cx_Mortality)`);
        }
        break;

      case ModuleType.PremiumComponent:
        if (Array.isArray(par.nnxCalculations) && par.nnxCalculations.length > 0) {
          for (const c of par.nnxCalculations) {
            const baseName = c.nxColumn.replace(/^Nx_/, '');
            lines.push(`NNX_${baseName} = Diff(${c.nxColumn}, m)`);
          }
        } else {
          lines.push(`NNX_Mortality = Diff(Nx_Mortality, m)`);
        }
        if (Array.isArray(par.sumxCalculations) && par.sumxCalculations.length > 0) {
          for (const c of par.sumxCalculations) {
            const bpvBase = c.mxColumn.replace(/^Mx_/, '');
            lines.push(`BPV_${bpvBase} = Diff(${c.mxColumn}, n) * ${c.amount ?? 10000}`);
          }
        } else {
          lines.push(`BPV_Mortality = Diff(Mx_Mortality, n) * 10000`);
        }
        break;

      case ModuleType.AdditionalName:
        if (Array.isArray(par.basicValues)) {
          for (const bv of par.basicValues) {
            lines.push(`${bv.name} = ${bv.value}`);
          }
        }
        break;

      case ModuleType.NetPremiumCalculator:
        lines.push(`${par.variableName ?? 'PP'} = ${stripVarBrackets(par.formula || 'BPV_Mortality / NNX_Mortality(Year)')}`);
        break;

      case ModuleType.GrossPremiumCalculator:
        lines.push(`${par.variableName ?? 'GP'} = ${stripVarBrackets(par.formula || 'PP / (1 - α1 - α2)')}`);
        break;

      case ModuleType.ReserveCalculator:
        if (par.formulaForPaymentTermOrLess)
          lines.push(`V[t<=m] = ${stripVarBrackets(par.formulaForPaymentTermOrLess)}`);
        if (par.formulaForGreaterThanPaymentTerm)
          lines.push(`V[t>m]  = ${stripVarBrackets(par.formulaForGreaterThanPaymentTerm)}`);
        if (!par.formulaForPaymentTermOrLess && !par.formulaForGreaterThanPaymentTerm) {
          lines.push(`V[t<=m] = (Mx_Mortality[t] - Mx_Mortality[n]) / lx_Mortality[t] - GP * (Nx_Mortality[t] - Nx_Mortality[m]) / lx_Mortality[t]`);
          lines.push(`V[t>m]  = (Mx_Mortality[t] - Mx_Mortality[n]) / lx_Mortality[t]`);
        }
        break;

      default:
        lines.push(`// (설정 없음)`);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

// ══════════════════════════════════════════════
// 흐름 에러 분석
// ══════════════════════════════════════════════

export interface DSLFlowError {
  module: string;
  varName: string;
  message: string;
  lineNumber: number;   // 1-based line number in the DSL text
}

/** 수식에서 변수 참조 추출 ([VAR] 표기 및 일반 식별자) */
export function extractFormulaVarRefs(formula: string): string[] {
  const refs = new Set<string>();

  // 수식 함수/예약어 및 NNX 주기 접미사
  const SKIP = new Set(['sum', 'cumsum_rev', 'lx', 'abs', 'min', 'max', 'if', 'and', 'or', 'not', 'true', 'false',
                        'Diff', 'diff', 'Round', 'round', 'Floor', 'floor', 'Ceil', 'ceil', 'Sqrt', 'sqrt',
                        'Year', 'Half', 'Quarter', 'Month']);

  // [VarName] 또는 [VarName(suffix)] 괄호 표기에서 추출
  // NNX_Mortality(Year) 같은 접미사 포함 토큰도 단일 ref로 추출
  for (const m of formula.matchAll(/\[([A-Za-z_α-ωΑ-Ω][A-Za-z0-9_α-ωΑ-Ω]*(?:\([^)]*\))?)\]/g)) {
    refs.add(m[1]);
  }

  // 일반 식별자 추출 (대괄호 안 내용 제거 후)
  const cleaned = formula.replace(/\[[^\]]*\]/g, '');
  // Identifier(suffix) 형태 포함 추출
  const tokens = cleaned.match(/[A-Za-z_][A-Za-z0-9_]*(?:\([^)]*\))?/g) ?? [];

  for (const t of tokens) {
    const parenIdx = t.indexOf('(');
    if (parenIdx > 0) {
      const baseName = t.slice(0, parenIdx);
      if (SKIP.has(baseName) || SKIP.has(baseName.toLowerCase())) {
        // 함수 호출: cumsum_rev(Dx_Mortality), lx(Death_Rate) 등
        // 함수명은 건너뛰고 인자 안의 식별자를 추출
        const inner = t.slice(parenIdx + 1, t.length - 1);
        const innerTokens = inner.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
        for (const it of innerTokens) {
          if (!SKIP.has(it) && !SKIP.has(it.toLowerCase())) refs.add(it);
        }
      } else {
        // NNX_Mortality(Year) 같이 접미사가 있는 변수 — 전체를 단일 ref로
        if (!SKIP.has(t) && !SKIP.has(t.toLowerCase())) refs.add(t);
      }
    } else {
      if (!SKIP.has(t) && !SKIP.has(t.toLowerCase())) refs.add(t);
    }
  }

  return Array.from(refs);
}

/** DSL 모델 전체의 변수 흐름 에러를 반환 */
export function analyzeFlowErrors(model: DSLModel): DSLFlowError[] {
  const errors: DSLFlowError[] = [];

  // 정책 파라미터 및 SelectRiskRates가 자동 생성하는 변수만 초기 정의
  // CSV 열 이름은 SelectData에서 명시적으로 선택된 것만 포함됨
  const defined = new Set<string>([
    'i_prem', 'i_claim',
    'entryAge', 'gender', 'paymentTerm', 'interestRate', 'policyTerm',
  ]);

  // ── SelectData 처리: 선택된 출력 열 이름(LHS)만 defined에 추가
  // selectDataOutputCols = null이면 SelectData 블록 없음
  let selectDataOutputCols: Set<string> | null = null;

  for (const section of model.sections) {
    if (!section.include || section.type !== ModuleType.SelectData) continue;
    selectDataOutputCols = new Set<string>();
    for (const { output } of section.lines) {
      if (output) {
        selectDataOutputCols.add(output);
        defined.add(output);
      }
    }
  }

  // SelectData가 없으면 하위 호환성을 위해 기본 열 이름을 허용
  if (selectDataOutputCols === null) {
    ['Age', 'Sex', 'Death_Rate', 'CI_Rate', 'Disability_Rate', 'Lapse_Rate',
      'Male_Mortality', 'Female_Mortality'].forEach((col) => defined.add(col));
  }

  // ── SelectRiskRates 처리: SelectData 출력 열 기준으로 formula(RHS) 검증
  for (const section of model.sections) {
    if (!section.include || section.type !== ModuleType.SelectRiskRates) continue;
    for (const { output, formula } of section.lines) {
      const formulaTrimmed = formula.trim();
      // formula가 있고 SelectData가 존재한다면 → SelectData 출력 열에 있어야 함
      if (formulaTrimmed && selectDataOutputCols !== null) {
        if (!selectDataOutputCols.has(formulaTrimmed)) {
          errors.push({
            module: 'Rating Basis Builder',
            varName: formulaTrimmed,
            message: `[Rating Basis Builder] '${formulaTrimmed}' 열이 SelectData에서 선택되지 않았습니다`,
            lineNumber: section.lines.find((l) => l.output === output)?.lineNumber ?? 0,
          });
        }
      }
      // output(LHS)는 SelectRiskRates의 출력 열로 등록
      const key = output.toLowerCase();
      const isSpecialKey = key === 'agecol' || key === 'gendercol' || key === '나이컬럼' || key === '성별컬럼';
      if (output && !isSpecialKey) {
        defined.add(output);
      }
    }
  }

  // 흐름 체크용 수식 단일문자 인덱스 (t, n, m, 0, ...) 건너뜀
  const SKIP_TOKENS = new Set(['t', 'n', 'm', 'k', 'v', 'i', 'j', 'x', 'p', 'q']);

  const SECTION_LABELS: Partial<Record<ModuleType, string>> = {
    [ModuleType.LoadData]: '위험률 로드',
    [ModuleType.SelectRiskRates]: 'Rating Basis Builder',
    [ModuleType.SelectData]: '데이터 선택',
    [ModuleType.RateModifier]: '요율 수정',
    [ModuleType.CalculateSurvivors]: '생존자 계산',
    [ModuleType.ClaimsCalculator]: '클레임 계산',
    [ModuleType.NxMxCalculator]: 'NxMx 계산',
    [ModuleType.PremiumComponent]: 'Premium Component',
    [ModuleType.AdditionalName]: '추가 변수',
    [ModuleType.NetPremiumCalculator]: '순보험료',
    [ModuleType.GrossPremiumCalculator]: '영업보험료',
    [ModuleType.ReserveCalculator]: '준비금',
  };

  // 앞 3개 데이터 모듈은 흐름 검사 없이 출력만 등록 (이미 위에서 처리됨)
  const DATA_MODULES = new Set<ModuleType>([
    ModuleType.LoadData,
    ModuleType.SelectRiskRates,
    ModuleType.SelectData,
  ]);

  for (const section of model.sections) {
    if (!section.include) continue;
    const label = SECTION_LABELS[section.type] ?? String(section.type);

    for (const { output, formula } of section.lines) {
      if (!DATA_MODULES.has(section.type)) {
        const refs = extractFormulaVarRefs(formula);
        for (const ref of refs) {
          if (SKIP_TOKENS.has(ref)) continue;
          if (/^\d/.test(ref)) continue;     // 숫자로 시작하면 상수
          if (ref.length === 1) continue;    // 단일 문자 인덱스
          if (!defined.has(ref)) {
            errors.push({
              module: label,
              varName: ref,
              message: `[${label}] '${ref}' 변수가 이전 모듈에서 정의되지 않았습니다`,
              lineNumber: section.lines.find((l) => l.output === output)?.lineNumber ?? 0,
            });
          }
        }
      }
      if (output) {
        defined.add(output);
        // PremiumComponent: NNX_X 정의 시 실행엔진이 생성하는 4가지 변수를 모두 등록
        if (section.type === ModuleType.PremiumComponent) {
          if (/^NNX_/i.test(output)) {
            ['Year', 'Half', 'Quarter', 'Month'].forEach(freq =>
              defined.add(`${output}(${freq})`)
            );
          }
          // BPV_X 도 그대로 등록 (이미 위에서 add됨)
        }
      }
    }
  }

  return errors;
}

// ── 기본 예제 DSL
export const EXAMPLE_DSL = `# 종신보험 A형 | age=40 | sex=Male | pay=20 | rate=2.5

## LoadData
file = Risk_Rates.csv

## SelectData
// 출력열이름 = 원본열이름  (Death_Rate는 사망위험률로 자동 적용)
Age = Age
Sex = Sex
Death_Rate = Male_Mortality

## RatingBasisBuilder
ageCol    = Age
genderCol = Sex

## RateModifier
// 수정이 필요하면 수식을 추가하세요. 예: Modified_Rate = Death_Rate * 1.5

## CalculateSurvivors
mortalityCol = Death_Rate
lx_Mortality = lx(Death_Rate)
Dx_Mortality = lx_Mortality * i_prem

## ClaimsCalculator
dx_Mortality = lx_Mortality * Death_Rate
Cx_Mortality = dx_Mortality * i_claim

## NxMxCalculator
Nx_Mortality = cumsum_rev(Dx_Mortality)
Mx_Mortality = cumsum_rev(Cx_Mortality)

## PremiumComponent
NNX_Mortality = Diff(Nx_Mortality, m)
BPV_Mortality = Diff(Mx_Mortality, n) * 10000

## AdditionalName
// α1,α2: 신계약비  β1,β2: 유지비  γ: 수금비  (0이면 사업비 없음)
α1 = 0
α2 = 0
β1 = 0
β2 = 0
γ  = 0

## NetPremiumCalculator
PP = BPV_Mortality / NNX_Mortality(Year)

## GrossPremiumCalculator
GP = PP / (1 - α1 - α2)

## ReserveCalculator
V[t<=m] = (Mx_Mortality[t] - Mx_Mortality[n]) / lx_Mortality[t] - GP * (Nx_Mortality[t] - Nx_Mortality[m]) / lx_Mortality[t]
V[t>m]  = (Mx_Mortality[t] - Mx_Mortality[n]) / lx_Mortality[t]
`.trim();
