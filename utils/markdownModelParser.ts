import { ModuleType } from '../types';

export interface ParsedModuleConfig {
  type: ModuleType;
  include: boolean;
  parameters: Record<string, any>;
}

export interface ParsedModelDefinition {
  productName: string;
  description: string;
  modules: ParsedModuleConfig[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Maps section header keywords → ModuleType
const SECTION_TYPE_MAP: Record<string, ModuleType> = {
  LoadData: ModuleType.LoadData,
  'Load Risk Rates': ModuleType.LoadData,
  '위험률 데이터 로드': ModuleType.LoadData,

  SelectRiskRates: ModuleType.SelectRiskRates,
  RatingBasisBuilder: ModuleType.SelectRiskRates,
  'Rating Basis Builder': ModuleType.SelectRiskRates,
  'Age Gender Matching': ModuleType.SelectRiskRates,
  '연령 성별 매칭': ModuleType.SelectRiskRates,

  SelectData: ModuleType.SelectData,
  'Select Rates': ModuleType.SelectData,
  '데이터 선택': ModuleType.SelectData,

  RateModifier: ModuleType.RateModifier,
  'Rate Modifier': ModuleType.RateModifier,
  '요율 수정': ModuleType.RateModifier,

  DefinePolicyInfo: ModuleType.DefinePolicyInfo,
  'Define Policy Info': ModuleType.DefinePolicyInfo,
  '증권 기본 정보': ModuleType.DefinePolicyInfo,

  CalculateSurvivors: ModuleType.CalculateSurvivors,
  'Survivors Calculator': ModuleType.CalculateSurvivors,
  '생존자 계산': ModuleType.CalculateSurvivors,

  ClaimsCalculator: ModuleType.ClaimsCalculator,
  'Claims Calculator': ModuleType.ClaimsCalculator,
  '클레임 계산': ModuleType.ClaimsCalculator,

  NxMxCalculator: ModuleType.NxMxCalculator,
  'Nx Mx Calculator': ModuleType.NxMxCalculator,
  'NxMx 계산': ModuleType.NxMxCalculator,

  PremiumComponent: ModuleType.PremiumComponent,
  'NNX MMX Calculator': ModuleType.PremiumComponent,
  'NNX MMX 계산': ModuleType.PremiumComponent,

  AdditionalName: ModuleType.AdditionalName,
  'Additional Variables': ModuleType.AdditionalName,
  '추가 변수': ModuleType.AdditionalName,

  NetPremiumCalculator: ModuleType.NetPremiumCalculator,
  'Net Premium Calculator': ModuleType.NetPremiumCalculator,
  '순보험료 계산': ModuleType.NetPremiumCalculator,

  GrossPremiumCalculator: ModuleType.GrossPremiumCalculator,
  'Gross Premium Calculator': ModuleType.GrossPremiumCalculator,
  '영업보험료 계산': ModuleType.GrossPremiumCalculator,

  ReserveCalculator: ModuleType.ReserveCalculator,
  'Reserve Calculator': ModuleType.ReserveCalculator,
  '준비금 계산': ModuleType.ReserveCalculator,

  ScenarioRunner: ModuleType.ScenarioRunner,
  'Scenario Runner': ModuleType.ScenarioRunner,
  '시나리오 실행': ModuleType.ScenarioRunner,
};

// Maps Korean field names → parameter keys and types
type FieldType = 'string' | 'number' | 'boolean' | 'json';

interface FieldSpec {
  key: string;
  type: FieldType;
}

const FIELD_MAP: Record<ModuleType, Record<string, FieldSpec>> = {
  [ModuleType.LoadData]: {
    '파일명': { key: 'source', type: 'string' },
    'source': { key: 'source', type: 'string' },
    'File': { key: 'source', type: 'string' },
  },
  [ModuleType.SelectRiskRates]: {
    '나이 컬럼': { key: 'ageColumn', type: 'string' },
    'Age Column': { key: 'ageColumn', type: 'string' },
    '성별 컬럼': { key: 'genderColumn', type: 'string' },
    'Gender Column': { key: 'genderColumn', type: 'string' },
    '비숫자 행 제외': { key: 'excludeNonNumericRows', type: 'boolean' },
    'Exclude Non-Numeric': { key: 'excludeNonNumericRows', type: 'boolean' },
  },
  [ModuleType.SelectData]: {
    '선택 항목': { key: 'selections', type: 'json' },
    'Selections': { key: 'selections', type: 'json' },
  },
  [ModuleType.RateModifier]: {
    '계산 목록': { key: 'calculations', type: 'json' },
    'Calculations': { key: 'calculations', type: 'json' },
  },
  [ModuleType.DefinePolicyInfo]: {
    '가입연령': { key: 'entryAge', type: 'number' },
    'Entry Age': { key: 'entryAge', type: 'number' },
    '성별': { key: 'gender', type: 'string' },
    'Gender': { key: 'gender', type: 'string' },
    '보험기간': { key: 'policyTerm', type: 'string' },
    'Policy Term': { key: 'policyTerm', type: 'string' },
    '만기연령': { key: 'maturityAge', type: 'number' },
    'Maturity Age': { key: 'maturityAge', type: 'number' },
    '납입기간': { key: 'paymentTerm', type: 'number' },
    'Payment Term': { key: 'paymentTerm', type: 'number' },
    '이율 (%)': { key: 'interestRate', type: 'number' },
    '이율(%)': { key: 'interestRate', type: 'number' },
    'Interest Rate (%)': { key: 'interestRate', type: 'number' },
    'Interest Rate': { key: 'interestRate', type: 'number' },
  },
  [ModuleType.CalculateSurvivors]: {
    '나이 컬럼': { key: 'ageColumn', type: 'string' },
    'Age Column': { key: 'ageColumn', type: 'string' },
    '사망률 컬럼': { key: 'mortalityColumn', type: 'string' },
    'Mortality Column': { key: 'mortalityColumn', type: 'string' },
    '계산 목록': { key: 'calculations', type: 'json' },
    'Calculations': { key: 'calculations', type: 'json' },
    '고정 Lx 추가': { key: 'addFixedLx', type: 'boolean' },
    'Add Fixed Lx': { key: 'addFixedLx', type: 'boolean' },
  },
  [ModuleType.ClaimsCalculator]: {
    '계산 목록': { key: 'calculations', type: 'json' },
    'Calculations': { key: 'calculations', type: 'json' },
  },
  [ModuleType.NxMxCalculator]: {
    'Nx 계산 목록': { key: 'nxCalculations', type: 'json' },
    'Nx Calculations': { key: 'nxCalculations', type: 'json' },
    'Mx 계산 목록': { key: 'mxCalculations', type: 'json' },
    'Mx Calculations': { key: 'mxCalculations', type: 'json' },
  },
  [ModuleType.PremiumComponent]: {
    'NNX 계산 목록': { key: 'nnxCalculations', type: 'json' },
    'NNX Calculations': { key: 'nnxCalculations', type: 'json' },
    'BPV 계산 목록': { key: 'sumxCalculations', type: 'json' },
    'SUMX 계산 목록': { key: 'sumxCalculations', type: 'json' },  // backward compat
    'BPV Calculations': { key: 'sumxCalculations', type: 'json' },
    'SUMX Calculations': { key: 'sumxCalculations', type: 'json' }, // backward compat
  },
  [ModuleType.AdditionalName]: {
    '기본값': { key: 'basicValues', type: 'json' },
    'Basic Values': { key: 'basicValues', type: 'json' },
    '정의 목록': { key: 'definitions', type: 'json' },
    'Definitions': { key: 'definitions', type: 'json' },
  },
  [ModuleType.NetPremiumCalculator]: {
    '수식': { key: 'formula', type: 'string' },
    'Formula': { key: 'formula', type: 'string' },
    '변수명': { key: 'variableName', type: 'string' },
    'Variable Name': { key: 'variableName', type: 'string' },
  },
  [ModuleType.GrossPremiumCalculator]: {
    '수식': { key: 'formula', type: 'string' },
    'Formula': { key: 'formula', type: 'string' },
    '변수명': { key: 'variableName', type: 'string' },
    'Variable Name': { key: 'variableName', type: 'string' },
  },
  [ModuleType.ReserveCalculator]: {
    '납입기간 이하 수식': { key: 'formulaForPaymentTermOrLess', type: 'string' },
    'Formula (Payment Term or Less)': { key: 'formulaForPaymentTermOrLess', type: 'string' },
    '납입기간 초과 수식': { key: 'formulaForGreaterThanPaymentTerm', type: 'string' },
    'Formula (Greater Than Payment Term)': { key: 'formulaForGreaterThanPaymentTerm', type: 'string' },
    '준비금 컬럼명': { key: 'reserveColumnName', type: 'string' },
    'Reserve Column Name': { key: 'reserveColumnName', type: 'string' },
  },
  [ModuleType.ScenarioRunner]: {
    '시나리오': { key: 'scenarios', type: 'json' },
    'Scenarios': { key: 'scenarios', type: 'json' },
  },
  // Unused module types in this context
  [ModuleType.Statistics]: {},
  [ModuleType.HandleMissingValues]: {},
  [ModuleType.EncodeCategorical]: {},
  [ModuleType.NormalizeData]: {},
  [ModuleType.TransitionData]: {},
  [ModuleType.TransformData]: {},
  [ModuleType.SplitData]: {},
  [ModuleType.ResampleData]: {},
  [ModuleType.TrainModel]: {},
  [ModuleType.ScoreModel]: {},
  [ModuleType.EvaluateModel]: {},
  [ModuleType.LinearRegression]: {},
  [ModuleType.LogisticRegression]: {},
  [ModuleType.DecisionTree]: {},
  [ModuleType.RandomForest]: {},
  [ModuleType.SVM]: {},
  [ModuleType.KNN]: {},
  [ModuleType.NaiveBayes]: {},
  [ModuleType.LinearDiscriminantAnalysis]: {},
  [ModuleType.StatModels]: {},
  [ModuleType.ResultModel]: {},
  [ModuleType.PredictModel]: {},
  [ModuleType.KMeans]: {},
  [ModuleType.HierarchicalClustering]: {},
  [ModuleType.DBSCAN]: {},
  [ModuleType.PrincipalComponentAnalysis]: {},
  [ModuleType.FitLossDistribution]: {},
  [ModuleType.GenerateExposureCurve]: {},
  [ModuleType.PriceXoLLayer]: {},
  [ModuleType.XolLoading]: {},
  [ModuleType.ApplyThreshold]: {},
  [ModuleType.DefineXolContract]: {},
  [ModuleType.CalculateCededLoss]: {},
  [ModuleType.PriceXolContract]: {},
  [ModuleType.PipelineExplainer]: {},
  [ModuleType.TextBox]: {},
  [ModuleType.GroupBox]: {},
};

function convertValue(raw: string, fieldType: FieldType): any {
  const trimmed = raw.trim();
  if (fieldType === 'number') {
    const n = parseFloat(trimmed);
    return isNaN(n) ? 0 : n;
  }
  if (fieldType === 'boolean') {
    return trimmed.toLowerCase() === 'yes' || trimmed.toLowerCase() === 'true';
  }
  if (fieldType === 'json') {
    try {
      return JSON.parse(trimmed);
    } catch {
      return [];
    }
  }
  return trimmed;
}

function parseSection(header: string, body: string): ParsedModuleConfig | null {
  // Extract module type from parentheses: "## [1] 위험률 데이터 로드 (LoadData)"
  let moduleType: ModuleType | null = null;

  // Try English type name in parentheses first
  const parenMatch = header.match(/\(([^)]+)\)\s*$/);
  if (parenMatch) {
    const key = parenMatch[1].trim();
    moduleType = SECTION_TYPE_MAP[key] ?? null;
  }

  // Fall back to matching known keywords in the header
  if (!moduleType) {
    for (const [keyword, type] of Object.entries(SECTION_TYPE_MAP)) {
      if (header.includes(keyword)) {
        moduleType = type;
        break;
      }
    }
  }

  if (!moduleType) return null;

  // Determine include/exclude
  const includeMatch = body.match(/\*\*포함여부\*\*\s*:\s*(.+)/i) ||
    body.match(/\*\*Include\*\*\s*:\s*(.+)/i);
  const includeVal = includeMatch ? includeMatch[1].trim().toLowerCase() : 'yes';
  const include = includeVal === 'yes' || includeVal === 'true';

  const parameters: Record<string, any> = {};
  const fieldMap = FIELD_MAP[moduleType] ?? {};

  // Extract scalar fields: **필드명**: value
  const scalarRegex = /\*\*([^*]+)\*\*\s*:\s*([^\n]*)/g;
  let m: RegExpExecArray | null;
  while ((m = scalarRegex.exec(body)) !== null) {
    const fieldName = m[1].trim();
    const rawValue = m[2].trim();
    if (fieldName === '포함여부' || fieldName === 'Include') continue;

    const spec = fieldMap[fieldName];
    if (spec && spec.type !== 'json') {
      parameters[spec.key] = convertValue(rawValue, spec.type);
    }
  }

  // Extract JSON blocks: **필드명**:\n```json\n...\n```
  const jsonBlockRegex = /\*\*([^*]+)\*\*\s*:\s*[\s\S]*?```json\s*([\s\S]*?)```/g;
  while ((m = jsonBlockRegex.exec(body)) !== null) {
    const fieldName = m[1].trim();
    const jsonStr = m[2].trim();
    const spec = fieldMap[fieldName];
    if (spec) {
      try {
        parameters[spec.key] = JSON.parse(jsonStr);
      } catch {
        // ignore malformed json
      }
    }
  }

  return { type: moduleType, include, parameters };
}

export function parseMarkdownModel(markdown: string): ParsedModelDefinition {
  // Remove HTML comments
  const cleaned = markdown.replace(/<!--[\s\S]*?-->/g, '');

  // Extract product info from top section
  let productName = 'New Model';
  let description = '';

  const productNameMatch = cleaned.match(/\*\*상품명\*\*\s*:\s*(.+)/);
  if (productNameMatch) productName = productNameMatch[1].trim();

  const descMatch = cleaned.match(/\*\*설명\*\*\s*:\s*(.+)/);
  if (descMatch) description = descMatch[1].trim();

  // Split on ## headings
  const sections = cleaned.split(/^## /m).slice(1);
  const modules: ParsedModuleConfig[] = [];

  for (const section of sections) {
    const nlIdx = section.indexOf('\n');
    const header = nlIdx >= 0 ? section.slice(0, nlIdx).trim() : section.trim();
    const body = nlIdx >= 0 ? section.slice(nlIdx + 1) : '';

    const parsed = parseSection(header, body);
    if (parsed) modules.push(parsed);
  }

  return { productName, description, modules };
}

export function validateModelDefinition(model: ParsedModelDefinition): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const includedTypes = new Set(
    model.modules.filter((m) => m.include).map((m) => m.type)
  );

  // Error: downstream modules included but DefinePolicyInfo excluded
  const needsPolicyInfo: ModuleType[] = [
    ModuleType.CalculateSurvivors,
    ModuleType.ClaimsCalculator,
    ModuleType.NxMxCalculator,
    ModuleType.PremiumComponent,
    ModuleType.NetPremiumCalculator,
    ModuleType.GrossPremiumCalculator,
    ModuleType.ReserveCalculator,
  ];
  const hasDownstream = needsPolicyInfo.some((t) => includedTypes.has(t));
  if (hasDownstream && !includedTypes.has(ModuleType.DefinePolicyInfo)) {
    errors.push('DefinePolicyInfo (증권 기본 정보) 모듈이 포함되어야 합니다.');
  }

  // Error: ScenarioRunner included but DefinePolicyInfo excluded
  if (includedTypes.has(ModuleType.ScenarioRunner) && !includedTypes.has(ModuleType.DefinePolicyInfo)) {
    errors.push('ScenarioRunner를 사용하려면 DefinePolicyInfo 모듈이 필요합니다.');
  }

  // Warning: NetPremiumCalculator formula empty
  const netPremium = model.modules.find((m) => m.type === ModuleType.NetPremiumCalculator && m.include);
  if (netPremium && !netPremium.parameters.formula) {
    warnings.push('NetPremiumCalculator의 수식(formula)이 비어있습니다.');
  }

  // Warning: DefinePolicyInfo entry age = 0
  const policyInfo = model.modules.find((m) => m.type === ModuleType.DefinePolicyInfo && m.include);
  if (policyInfo && policyInfo.parameters.entryAge === 0) {
    warnings.push('DefinePolicyInfo의 가입연령이 0입니다. 올바른 값인지 확인하세요.');
  }

  // Warning: ClaimsCalculator included but CalculateSurvivors excluded
  if (includedTypes.has(ModuleType.ClaimsCalculator) && !includedTypes.has(ModuleType.CalculateSurvivors)) {
    warnings.push('ClaimsCalculator는 CalculateSurvivors (생존자 계산) 결과가 필요합니다.');
  }

  // Warning: NxMxCalculator included but ClaimsCalculator excluded
  if (includedTypes.has(ModuleType.NxMxCalculator) && !includedTypes.has(ModuleType.ClaimsCalculator)) {
    warnings.push('NxMxCalculator는 ClaimsCalculator 결과가 필요합니다.');
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function summarizeModule(m: ParsedModuleConfig): string {
  const parts: string[] = [];
  const p = m.parameters;

  switch (m.type) {
    case ModuleType.DefinePolicyInfo:
      if (p.entryAge !== undefined) parts.push(`가입연령: ${p.entryAge}`);
      if (p.gender) parts.push(`성별: ${p.gender}`);
      if (p.paymentTerm !== undefined) parts.push(`납입기간: ${p.paymentTerm}`);
      if (p.interestRate !== undefined) parts.push(`이율: ${p.interestRate}%`);
      break;
    case ModuleType.LoadData:
      if (p.source) parts.push(`파일: ${p.source}`);
      break;
    case ModuleType.NetPremiumCalculator:
      if (p.formula) parts.push(`수식: ${p.formula.slice(0, 30)}${p.formula.length > 30 ? '...' : ''}`);
      if (p.variableName) parts.push(`변수: ${p.variableName}`);
      break;
    case ModuleType.GrossPremiumCalculator:
      if (p.formula) parts.push(`수식: ${p.formula.slice(0, 30)}${p.formula.length > 30 ? '...' : ''}`);
      break;
    case ModuleType.ReserveCalculator:
      if (p.reserveColumnName) parts.push(`컬럼: ${p.reserveColumnName}`);
      break;
    default:
      break;
  }

  return parts.join(', ') || '-';
}
