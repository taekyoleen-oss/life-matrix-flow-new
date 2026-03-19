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
 *   NP = SUMX / NNX
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
  };
  for (const { output, formula } of lines) {
    const key = output.toLowerCase();
    if (key === 'agecol' || key === 'agecol' || key === '나이컬럼') params.ageColumn = formula;
    else if (key === 'gendercol' || key === '성별컬럼') params.genderColumn = formula;
    // 나머지: 출력열 = 입력열 → column rename (informational, stored separately)
  }
  return params;
}

function buildSelectDataParams(lines: Array<{ output: string; formula: string }>) {
  // cols = Age, Death_Rate, ... 형태 또는 output = input 형태
  const colsLine = lines.find((l) => l.output.toLowerCase() === 'cols');
  if (colsLine) {
    const names = colsLine.formula.split(',').map((s) => s.trim()).filter(Boolean);
    return {
      selections: names.map((n) => ({ originalName: n, selected: true, newName: n })),
    };
  }
  // output = input 형태로 지정된 경우
  const selections = lines.map(({ output, formula }) => ({
    originalName: formula,
    selected: true,
    newName: output,
  }));
  return { selections };
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
  // 예: lx_Mortality = lx(Death_Rate)  → name = "Mortality"
  //     lx = 100000                    → fixedValue = 100000
  const calculations: any[] = [];
  for (const { output, formula } of lines) {
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
    mortalityColumn: 'None',
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
  for (const { output, formula } of lines) {
    const outLow = output.toLowerCase();
    // Nx = sum(Dx_Mortality) 또는 Nx = Σ(Dx_Mortality)
    const colMatch = formula.match(/\(([^)]+)\)/);
    const baseColumn = colMatch ? colMatch[1].trim() : formula.trim();
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
        deductibleType: '0',
        customDeductible: 0,
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
      // NNX = Nx[0] - Nx[m]  → nxColumn 추출
      const colMatch = formula.match(/([A-Za-z_]\w*)\[/);
      const nxCol = colMatch ? colMatch[1] : 'Nx_Mortality';
      nnxCalculations.push({ id: `nnx-${nnxCalculations.length}`, nxColumn: nxCol });
    } else if (outLow === 'sumx' || outLow.startsWith('sumx')) {
      // SUMX = Mx[0] * 10000  → mxColumn + amount 추출
      const colMatch = formula.match(/([A-Za-z_]\w*)\[?/);
      const mxCol = colMatch ? colMatch[1] : 'Mx_Mortality';
      const amtMatch = formula.match(/\*\s*([\d,]+)/);
      const amount = amtMatch ? Number(amtMatch[1].replace(/,/g, '')) : 10000;
      sumxCalculations.push({ id: `sumx-${sumxCalculations.length}`, mxColumn: mxCol, amount });
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

function buildFormulaParams(
  lines: Array<{ output: string; formula: string }>,
  defaultVarName: string
) {
  // Net/Gross Premium: 첫 번째 줄이 "VarName = formula"
  const first = lines[0];
  if (!first) return { formula: '', variableName: defaultVarName };
  return { formula: first.formula, variableName: first.output };
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
    ModuleType.SelectRiskRates,
    ModuleType.SelectData,
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

  const LABELS: Partial<Record<ModuleType, string>> = {
    [ModuleType.LoadData]: 'LoadData',
    [ModuleType.SelectRiskRates]: 'SelectRiskRates',
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

  for (const type of order) {
    const mod = modules.find((m) => m.type === type);
    if (!mod) continue;
    const par = mod.parameters;
    const label = LABELS[type] ?? type;

    lines.push(`## ${label}`);

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
            lines.push(`Nx_${c.name} = sum(${c.baseColumn})`);
          }
        }
        if (Array.isArray(par.mxCalculations)) {
          for (const c of par.mxCalculations) {
            lines.push(`Mx_${c.name} = sum(${c.baseColumn})`);
          }
        }
        if (!par.nxCalculations?.length && !par.mxCalculations?.length) {
          lines.push(`Nx = sum(Dx_Mortality)`);
          lines.push(`Mx = sum(Cx_Mortality)`);
        }
        break;

      case ModuleType.PremiumComponent:
        if (Array.isArray(par.nnxCalculations)) {
          for (const c of par.nnxCalculations) {
            lines.push(`NNX = ${c.nxColumn}[0] - ${c.nxColumn}[m]`);
          }
        }
        if (Array.isArray(par.sumxCalculations)) {
          for (const c of par.sumxCalculations) {
            lines.push(`SUMX = ${c.mxColumn}[0] * ${c.amount ?? 10000}`);
          }
        }
        if (!par.nnxCalculations?.length) lines.push(`NNX  = Nx_Mortality[0] - Nx_Mortality[m]`);
        if (!par.sumxCalculations?.length) lines.push(`SUMX = Mx_Mortality[0] * 10000`);
        break;

      case ModuleType.AdditionalName:
        if (Array.isArray(par.basicValues)) {
          for (const bv of par.basicValues) {
            lines.push(`${bv.name} = ${bv.value}`);
          }
        }
        break;

      case ModuleType.NetPremiumCalculator:
        lines.push(`${par.variableName ?? 'PP'} = ${stripVarBrackets(par.formula || 'SUMX / NNX')}`);
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

  // [VarName] 괄호 표기에서 추출 (숫자 인덱스 제외)
  for (const m of formula.matchAll(/\[([A-Za-z_α-ωΑ-Ω][A-Za-z0-9_α-ωΑ-Ω]*)\]/g)) {
    refs.add(m[1]);
  }

  // 일반 식별자 추출 (대괄호 안 내용 제거 후)
  const cleaned = formula.replace(/\[[^\]]*\]/g, '');
  const tokens = cleaned.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
  // 수식 함수/예약어 제외
  const SKIP = new Set(['sum', 'lx', 'sum', 'abs', 'min', 'max', 'if', 'and', 'or', 'not', 'true', 'false']);
  for (const t of tokens) {
    if (!SKIP.has(t.toLowerCase())) refs.add(t);
  }

  return Array.from(refs);
}

/** DSL 모델 전체의 변수 흐름 에러를 반환 */
export function analyzeFlowErrors(model: DSLModel): DSLFlowError[] {
  const errors: DSLFlowError[] = [];

  // 데이터 소스에서 기본 제공되는 변수들 (CSV 컬럼, 정책 파라미터)
  const defined = new Set<string>([
    'Age', 'Sex', 'i_prem', 'i_claim',
    'Death_Rate', 'CI_Rate', 'Disability_Rate', 'Lapse_Rate',
    'Male_Mortality', 'Female_Mortality',
    'entryAge', 'gender', 'paymentTerm', 'interestRate', 'policyTerm',
  ]);

  // SelectData/SelectRiskRates의 원본 열 이름도 "정의됨"으로 처리
  for (const section of model.sections) {
    if (
      section.type === ModuleType.SelectData ||
      section.type === ModuleType.SelectRiskRates
    ) {
      for (const { formula } of section.lines) {
        const f = formula.trim();
        if (/^[A-Za-z_]\w*$/.test(f)) defined.add(f);
      }
    }
  }

  // 흐름 체크용 수식 단일문자 인덱스 (t, n, m, 0, ...) 건너뜀
  const SKIP_TOKENS = new Set(['t', 'n', 'm', 'k', 'v', 'i', 'j', 'x', 'p', 'q']);

  const SECTION_LABELS: Partial<Record<ModuleType, string>> = {
    [ModuleType.LoadData]: '위험률 로드',
    [ModuleType.SelectRiskRates]: '연령 성별 매칭',
    [ModuleType.SelectData]: '데이터 선택',
    [ModuleType.RateModifier]: '요율 수정',
    [ModuleType.CalculateSurvivors]: '생존자 계산',
    [ModuleType.ClaimsCalculator]: '클레임 계산',
    [ModuleType.NxMxCalculator]: 'NxMx 계산',
    [ModuleType.PremiumComponent]: 'NNX MMX 계산',
    [ModuleType.AdditionalName]: '추가 변수',
    [ModuleType.NetPremiumCalculator]: '순보험료',
    [ModuleType.GrossPremiumCalculator]: '영업보험료',
    [ModuleType.ReserveCalculator]: '준비금',
  };

  // 앞 3개 데이터 모듈은 흐름 검사 없이 출력만 등록
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
      if (output) defined.add(output);
    }
  }

  return errors;
}

// ── 기본 예제 DSL
export const EXAMPLE_DSL = `# 종신보험 A형 | age=40 | sex=Male | pay=20 | rate=2.5

## LoadData
file = Risk_Rates.csv

## SelectRiskRates
ageCol    = Age
genderCol = Sex
Death_Rate = Male_Mortality     // 입력열 → 출력열 이름 변경

## SelectData
Age        = Age
Death_Rate = Death_Rate
i_prem     = i_prem
i_claim    = i_claim

## CalculateSurvivors
lx_Mortality = lx(Death_Rate)   // 사망률 열로 lx 계산
Dx_Mortality = lx_Mortality * i_prem

## ClaimsCalculator
dx_Mortality = lx_Mortality * Death_Rate
Cx_Mortality = dx_Mortality * i_claim

## NxMxCalculator
Nx_Mortality = sum(Dx_Mortality)   // 역누적합
Mx_Mortality = sum(Cx_Mortality)

## PremiumComponent
NNX  = Nx_Mortality[0] - Nx_Mortality[m]  // m = 납입기간
SUMX = Mx_Mortality[0] * 10000            // 급부액 10,000원

## AdditionalName
α1 = 0
α2 = 0
β1 = 0
β2 = 0
γ  = 0

## NetPremiumCalculator
PP = SUMX / NNX

## GrossPremiumCalculator
GP = PP / (1 - α1 - α2)

## ReserveCalculator
V[t<=m] = (Mx_Mortality[t] - Mx_Mortality[n]) / lx_Mortality[t] - GP * (Nx_Mortality[t] - Nx_Mortality[m]) / lx_Mortality[t]
V[t>m]  = (Mx_Mortality[t] - Mx_Mortality[n]) / lx_Mortality[t]
`.trim();
