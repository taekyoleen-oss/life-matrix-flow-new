import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CanvasModule, Connection, ModuleType } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import {
  parseDSL,
  generateDSL,
  buildModuleConfigs,
  analyzeFlowErrors,
  DSLModel,
  DSLFlowError,
  DSLModuleConfig,
  EXAMPLE_DSL,
} from '../utils/dslParser';
import { buildPipelineFromModel } from '../utils/pipelineBuilder';
import { SAMPLE_DATA } from '../sampleData';

interface PipelineDSLModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  modules: CanvasModule[];
  onBuildPipeline: (modules: CanvasModule[], connections: Connection[], productName: string) => void;
  onPatchParameters: (configs: DSLModuleConfig[], productName: string) => void;
}

const MODULE_ORDER = [
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

const MODULE_LABELS: Partial<Record<ModuleType, string>> = {
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
  [ModuleType.ScenarioRunner]: '시나리오',
};

// 각 모듈의 계리적 수식 설명 (우측 패널 표시용)
const MODULE_DESCRIPTIONS: Partial<Record<ModuleType, { desc: string; formulas: string[] }>> = {
  [ModuleType.LoadData]: {
    desc: '위험률 CSV 파일을 불러옵니다',
    formulas: [
      'file = 파일명.csv  (파일 이름 지정)',
      '📂 불러오기 버튼으로 실제 파일을 선택하세요',
      '불러오면 LoadData·SelectData가 자동 설정됩니다',
    ],
  },
  [ModuleType.SelectRiskRates]: {
    desc: '가입연령·성별로 위험률 행을 선택하고 할인율(i_prem, i_claim)을 계산합니다',
    formulas: [
      'ageCol = 연령열이름  (예: Age)',
      'genderCol = 성별열이름  (예: Sex)',
      'i_prem: 보험료 이자계수 (납입 시점 현가)',
      'i_claim: 급부 이자계수 (지급 시점 현가)',
    ],
  },
  [ModuleType.SelectData]: {
    desc: '계산에 필요한 열만 선택하고 이름을 변경합니다',
    formulas: [
      '출력열이름 = 원본열이름',
      'Death_Rate 로 이름 변경한 열이 사망위험률로 자동 적용됩니다',
      '🔧 열 선택 버튼으로 열 목록에서 선택·순서 지정 가능',
    ],
  },
  [ModuleType.RateModifier]: {
    desc: '위험률을 수정하거나 파생 열을 추가합니다',
    formulas: [
      '예: Modified_Rate = Death_Rate * 1.5  (위험률 150% 적용)',
      '수정이 필요 없으면 내용을 비워두세요',
    ],
  },
  [ModuleType.CalculateSurvivors]: {
    desc: '나이별 생존자수(lx)와 할인 생존자수(Dx)를 계산합니다',
    formulas: [
      'mortalityCol = 사망위험률열이름',
      'lx(위험률): lx[t] = lx[t-1] × (1 − 위험률[t])  (초기값 100,000)',
      '다중감소: lx(사망률, 해약률)',
      'Dx = lx × i_prem  (할인 생존자수)',
    ],
  },
  [ModuleType.ClaimsCalculator]: {
    desc: '나이별 사망자수(dx)와 할인 사망자수(Cx)를 계산합니다',
    formulas: [
      'dx = lx × 사망위험률  (나이별 사망자수)',
      'Cx = dx × i_claim  (할인 사망자수)',
    ],
  },
  [ModuleType.NxMxCalculator]: {
    desc: '각 나이부터 만기까지의 역방향 누적합을 계산합니다',
    formulas: [
      'Nx[t] = Dx[t] + Dx[t+1] + ⋯ + Dx[만기]  (보험료 납입연금 현가)',
      'Mx[t] = Cx[t] + Cx[t+1] + ⋯ + Cx[만기]  (사망급부 현가)',
      '공제: cumsum_rev(Cx, deduct=0.25)  ← 3개월 대기기간',
      'Σ 버튼으로 sum / cumsum_rev 전환 가능',
    ],
  },
  [ModuleType.PremiumComponent]: {
    desc: '보험료·급부 현가 구성 요소를 계산합니다',
    formulas: [
      'NNX = Diff(Nx, m)  → Nx[0] − Nx[m]  (납입기간 보험료 연금현가)',
      '  생성: NNX_*(Year), NNX_*(Half), NNX_*(Quarter), NNX_*(Month)',
      'BPV = Diff(Mx, n) × 금액  → (Mx[0] − Mx[n]) × 보험가입금액',
      'Diff(col, n) = col[0] − col[n]  |  m=납입만료, n=보험만기',
    ],
  },
  [ModuleType.AdditionalName]: {
    desc: '영업보험료 계산용 사업비 계수를 정의합니다 (0이면 사업비 없음)',
    formulas: [
      'α1, α2: 신계약비율  (초년도 및 갱신 신계약비)',
      'β1, β2: 유지비율  (납입 중 및 납입 후)',
      'γ: 수금비율',
    ],
  },
  [ModuleType.NetPremiumCalculator]: {
    desc: '수지상등 원칙으로 순보험료(PP)를 계산합니다',
    formulas: [
      'PP = BPV ÷ NNX(Year)  (급부현가 ÷ 보험료현가)',
      '미래 급부현가 = 미래 보험료현가 원칙 적용',
    ],
  },
  [ModuleType.GrossPremiumCalculator]: {
    desc: '사업비를 반영한 영업보험료(GP)를 계산합니다',
    formulas: [
      'GP = PP ÷ (1 − 사업비율)',
      '사업비율 = α1 + α2  (신계약비)  + β1 + β2  (유지비)',
    ],
  },
  [ModuleType.ReserveCalculator]: {
    desc: '순보험료식 책임준비금(V)을 계산합니다',
    formulas: [
      'V[t] = 미래급부현가 − 미래보험료현가  (t 시점 기준)',
      'V[t≤m]: 납입기간 중  →  급부현가 − GP × 보험료현가',
      'V[t>m]:  납입 완료 후 →  급부현가만 계산',
    ],
  },
};

// 섹션 헤더 → ModuleType 매핑 (커서 위치 감지용)
const MODULE_HEADER_MAP: Record<string, ModuleType> = {
  loaddata: ModuleType.LoadData,
  load: ModuleType.LoadData,
  selectriskrates: ModuleType.SelectRiskRates,
  ratingbasisbuilder: ModuleType.SelectRiskRates,
  agegendermatching: ModuleType.SelectRiskRates,
  selectdata: ModuleType.SelectData,
  ratemodifier: ModuleType.RateModifier,
  calculatesurvivors: ModuleType.CalculateSurvivors,
  claimscalculator: ModuleType.ClaimsCalculator,
  claims: ModuleType.ClaimsCalculator,
  nxmxcalculator: ModuleType.NxMxCalculator,
  nxmx: ModuleType.NxMxCalculator,
  premiumcomponent: ModuleType.PremiumComponent,
  additionalname: ModuleType.AdditionalName,
  netpremiumcalculator: ModuleType.NetPremiumCalculator,
  netpremium: ModuleType.NetPremiumCalculator,
  grosspremiumcalculator: ModuleType.GrossPremiumCalculator,
  grosspremium: ModuleType.GrossPremiumCalculator,
  reservecalculator: ModuleType.ReserveCalculator,
  reserve: ModuleType.ReserveCalculator,
  scenariorunner: ModuleType.ScenarioRunner,
};

// ── DSL 특정 모듈 섹션 내용을 교체하는 유틸
function replaceModuleSection(dslText: string, targetType: ModuleType, newBodyLines: string[]): string {
  const lines = dslText.split('\n');
  let headerIdx = -1;
  let nextHeaderIdx = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith('## ')) {
      const key = t.slice(3).trim().toLowerCase().replace(/\s+/g, '');
      const type = MODULE_HEADER_MAP[key] ?? null;
      if (type === targetType) {
        headerIdx = i;
      } else if (headerIdx >= 0) {
        nextHeaderIdx = i;
        break;
      }
    }
  }
  if (headerIdx < 0) return dslText;
  return [
    ...lines.slice(0, headerIdx + 1),
    ...newBodyLines,
    '',
    ...lines.slice(nextHeaderIdx),
  ].join('\n');
}

// ── localStorage / sessionStorage 키
const DRAFT_KEY        = 'lmf_dsl_draft';
const SAVES_KEY        = 'lmf_dsl_saves';
const EXAMPLES_KEY     = 'lmf_dsl_examples';
const FILE_META_KEY    = 'lmf_dsl_file_meta';    // sessionStorage: 파일 메타 (이름·행·열)
const FILE_CONTENT_KEY = 'lmf_dsl_file_content'; // sessionStorage: 실제 CSV 내용

interface SavedEntry { text: string; savedAt: string; }

function readStorage(key: string): Record<string, SavedEntry> {
  try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
}
function getSaves():    Record<string, SavedEntry> { return readStorage(SAVES_KEY); }
function getExamples(): Record<string, SavedEntry> { return readStorage(EXAMPLES_KEY); }

// ── 검증
interface ValidationResult {
  errors: string[];
  warnings: string[];
}

function validateDSL(model: DSLModel): ValidationResult {
  const errors: string[] = [...model.errors];
  const warnings: string[] = [];

  const sections = model.sections.filter((s) => s.include);
  if (sections.length === 0) {
    errors.push('포함된 모듈이 없습니다. ## 모듈명 형식으로 최소 하나의 모듈을 추가하세요.');
    return { errors, warnings };
  }

  const types = new Set(sections.map((s) => s.type));

  for (const s of sections) {
    switch (s.type) {
      case ModuleType.NetPremiumCalculator:
        if (s.lines.length === 0)
          errors.push('[순보험료] 수식이 없습니다. 예: PP = BPV_Mortality / NNX_Mortality(Year)');
        break;
      case ModuleType.GrossPremiumCalculator:
        if (s.lines.length === 0)
          errors.push('[영업보험료] 수식이 없습니다. 예: GP = [PP] / (1 - [α1] - [α2])');
        break;
      case ModuleType.ReserveCalculator:
        if (s.lines.length === 0)
          warnings.push('[준비금] 수식이 없어 준비금 계산이 실행되지 않을 수 있습니다.');
        break;
      case ModuleType.CalculateSurvivors:
        if (!s.lines.some((l) => l.output.toLowerCase().startsWith('lx')))
          warnings.push('[생존자 계산] lx 정의가 없습니다. 예: lx_Mortality = lx(Death_Rate)');
        break;
      case ModuleType.ClaimsCalculator:
        if (!s.lines.some((l) => l.output.toLowerCase().startsWith('dx')))
          warnings.push('[클레임 계산] dx 정의가 없습니다. 예: dx_Mortality = lx_Mortality * Death_Rate');
        break;
      case ModuleType.NxMxCalculator:
        if (!s.lines.some((l) => l.output.toLowerCase().startsWith('nx')))
          warnings.push('[NxMx 계산] Nx 정의가 없습니다. 예: Nx_Mortality = cumsum_rev(Dx_Mortality)');
        break;
    }
  }

  // 순보험료가 있는데 전제 모듈이 없는 경우
  if (types.has(ModuleType.NetPremiumCalculator) && !types.has(ModuleType.PremiumComponent))
    warnings.push('[순보험료] Premium Component 모듈이 없어 BPV/NNX 값을 참조할 수 없습니다.');

  // Policy 파라미터 검증
  if (!model.policyParams.entryAge || model.policyParams.entryAge <= 0)
    warnings.push(`가입연령(age) 값이 올바르지 않습니다 (현재: ${model.policyParams.entryAge})`);
  if (!model.policyParams.paymentTerm || model.policyParams.paymentTerm <= 0)
    warnings.push(`납입기간(pay) 값이 올바르지 않습니다 (현재: ${model.policyParams.paymentTerm})`);
  if (!model.policyParams.interestRate || model.policyParams.interestRate <= 0)
    warnings.push(`이율(rate) 값이 올바르지 않습니다 (현재: ${model.policyParams.interestRate}%)`);

  return { errors, warnings };
}

// ── 열 이름이 나이 컬럼인지 판별
function isAgeCol(name: string): boolean {
  const n = name.toLowerCase().replace(/[\s_\-]/g, '');
  return n === 'age' || n === '나이' || n === '연령' || n === 'x';
}
// ── 열 이름이 성별 컬럼인지 판별
function isSexCol(name: string): boolean {
  const n = name.toLowerCase().replace(/[\s_\-]/g, '');
  return n === 'sex' || n === 'gender' || n === '성별' || n === '성' || n === 'male' || n === 'female';
}

// ── CSV 헤더 파싱 (열 이름 + 행 수)
function parseCSVMeta(text: string): { columns: string[]; rowCount: number } {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length === 0) return { columns: [], rowCount: 0 };
  const sep = lines[0].includes('\t') ? '\t' : ',';
  const columns = lines[0].split(sep).map(c => c.trim().replace(/^["']|["']$/g, ''));
  return { columns, rowCount: Math.max(0, lines.length - 1) };
}

// ── 불러온 파일 정보를 DSL 텍스트에 반영 (LoadData 파일명 + SelectData 열 목록 갱신)
function applyFileToDSL(dslText: string, fileName: string, columns: string[]): string {
  const lines = dslText.split('\n');
  const out: string[] = [];
  let sectionKey = '';
  let inSelectData = false;
  let selectDataInjected = false;
  let selectDataFound = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();

    // 섹션 헤더 감지
    if (t.startsWith('## ')) {
      const key = t.replace(/^##\s*/, '').split('//')[0].trim()
        .toLowerCase().replace(/[\s_\-]/g, '').replace(/calculator|module|모듈/g, '');
      inSelectData = key === 'selectdata' || key === '데이터선택';
      sectionKey = key;
      if (inSelectData) selectDataFound = true;

      out.push(line);

      // SelectData 헤더 직후 새 열 목록 주입
      // Age/Sex만 기본 선택, 나머지는 주석으로 추가 (열 선택 버튼으로 활성화 가능)
      if (inSelectData && !selectDataInjected) {
        out.push('// 계산에 필요한 열만 선택합니다 (출력열이름 = 원본열이름)');
        const defaultCols = columns.filter(c => isAgeCol(c) || isSexCol(c));
        const otherCols   = columns.filter(c => !isAgeCol(c) && !isSexCol(c));
        defaultCols.forEach(col => out.push(`${col} = ${col}`));
        if (otherCols.length > 0) {
          out.push('// 아래 열은 필요 시 주석 해제하거나 열 선택 버튼으로 추가하세요');
          otherCols.forEach(col => out.push(`// ${col} = ${col}`));
        }
        selectDataInjected = true;
      }
      continue;
    }

    // SelectData 내부: 기존 줄 건너뜀 (위에서 새 내용 주입 완료)
    if (inSelectData && selectDataInjected) {
      if (t !== '') continue; // 빈 줄 아닌 기존 내용 스킵
      out.push(line);         // 빈 줄(섹션 구분선)은 유지
      continue;
    }

    // LoadData 내부: file = 줄 갱신
    if ((sectionKey === 'loaddata' || sectionKey === 'load') && /^file\s*=/i.test(t)) {
      out.push(`file = ${fileName}`);
      continue;
    }

    out.push(line);
  }

  // SelectData 섹션이 없으면 LoadData 끝 이후에 삽입
  if (!selectDataFound && columns.length > 0) {
    let insertIdx = out.length;
    let inLoad = false;
    for (let i = 0; i < out.length; i++) {
      const t = out[i].trim();
      if (t.startsWith('## ')) {
        const k = t.replace(/^##\s*/, '').split('//')[0].trim()
          .toLowerCase().replace(/[\s_\-]/g, '').replace(/calculator|module|모듈/g, '');
        if (k === 'loaddata' || k === 'load') { inLoad = true; continue; }
        if (inLoad) { insertIdx = i; break; }
      }
    }
    const defaultCols2 = columns.filter(c => isAgeCol(c) || isSexCol(c));
    const otherCols2   = columns.filter(c => !isAgeCol(c) && !isSexCol(c));
    out.splice(insertIdx, 0,
      '',
      '## SelectData',
      '// 계산에 필요한 열만 선택합니다 (출력열이름 = 원본열이름)',
      ...defaultCols2.map(col => `${col} = ${col}`),
      ...(otherCols2.length > 0 ? ['// 아래 열은 필요 시 주석 해제하거나 열 선택 버튼으로 추가하세요'] : []),
      ...otherCols2.map(col => `// ${col} = ${col}`),
      '',
    );
  }

  return out.join('\n');
}

// ── SelectData DSL 섹션 갱신 (선택·순서 변경 반영)
function applySelectDataToDSL(
  dslText: string,
  items: Array<{ originalName: string; newName: string; selected: boolean }>
): string {
  const lines = dslText.split('\n');
  const out: string[] = [];
  let inSelectData = false;
  let injected = false;

  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith('## ')) {
      const key = t.replace(/^##\s*/, '').split('//')[0].trim()
        .toLowerCase().replace(/[\s_\-]/g, '').replace(/calculator|module|모듈/g, '');
      const wasIn = inSelectData;
      inSelectData = key === 'selectdata' || key === '데이터선택';
      if (inSelectData && !injected) {
        out.push(line);
        out.push('// 계산에 필요한 열만 선택합니다 (출력열이름 = 원본열이름)');
        for (const s of items) {
          if (!s.selected) continue;
          const lhs = s.newName && s.newName !== s.originalName ? s.newName : s.originalName;
          out.push(`${lhs} = ${s.originalName}`);
        }
        injected = true;
        continue;
      }
      if (wasIn && !inSelectData) { out.push(line); continue; }
    }
    if (inSelectData && injected) {
      if (t === '') { out.push(line); inSelectData = false; }
      continue;
    }
    out.push(line);
  }
  return out.join('\n');
}

export const PipelineDSLModal: React.FC<PipelineDSLModalProps> = ({
  isOpen,
  onClose,
  productName,
  modules,
  onBuildPipeline,
  onPatchParameters,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [dslText, setDslText] = useState(EXAMPLE_DSL);
  const [parsed, setParsed] = useState(() => parseDSL(EXAMPLE_DSL));
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumRef  = useRef<HTMLDivElement>(null);

  // ── 자동완성
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggPos,     setSuggPos]     = useState({ top: 0, left: 0 });
  const [suggActive,  setSuggActive]  = useState(0);

  // ── 저장/예제/검증 상태
  const [saves,       setSaves]      = useState<Record<string, SavedEntry>>(getSaves);
  const [examples,    setExamples]   = useState<Record<string, SavedEntry>>(getExamples);
  const [saveMsg,     setSaveMsg]    = useState('');
  // panel: 'saves' | 'examples' | null
  const [openPanel,   setOpenPanel]  = useState<'saves' | 'examples' | null>(null);
  // 저장 다이얼로그 (이름 입력)
  const [saveDialog,  setSaveDialog] = useState<{ mode: 'save' | 'example'; value: string } | null>(null);
  // 이름 바꾸기
  const [renaming,    setRenaming]   = useState<{ key: string; storage: 'saves' | 'examples'; value: string } | null>(null);
  const [validation,  setValidation] = useState<ValidationResult | null>(null);
  const [warnConfirm, setWarnConfirm] = useState(false);

  // ── 불러온 위험률 파일 정보 (content: 실제 CSV 텍스트 — 파이프라인 실행에 필요)
  const [loadedFileInfo, setLoadedFileInfo] = useState<{
    name: string; rowCount: number; columns: string[]; content: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── SelectData 열 선택 패널
  const [colSelectorOpen, setColSelectorOpen] = useState(false);
  const [colSelectorItems, setColSelectorItems] = useState<
    Array<{ originalName: string; newName: string; selected: boolean }>
  >([]);
  const [colSelectorDeathRate, setColSelectorDeathRate] = useState<string>('');

  // ── 표기 방식: 'cumsum_rev'(계리적 정확 표기) | 'sum'(간결 표기)
  const [notationStyle, setNotationStyle] = useState<'cumsum_rev' | 'sum'>('cumsum_rev');

  // ── 우측 패널 인라인 편집 상태 (lineNumber → {output, formula})
  const [lineEdits, setLineEdits] = useState<Record<number, { output: string; formula: string }>>({});

  // ── 흐름 에러 (실시간)
  const [flowErrors, setFlowErrors] = useState<DSLFlowError[]>([]);

  // ── 에디터 스크롤 위치 (LoadData 오버레이 위치 계산용)
  const [editorScrollTop, setEditorScrollTop] = useState(0);

  // ── 커서가 위치한 모듈 (DSL 문법 패널 연동)
  const [cursorModule, setCursorModule] = useState<ModuleType | null>(null);

  // ── 모듈 편집기 팝업
  const [moduleEditor, setModuleEditor] = useState<ModuleType | null>(null);
  const [moduleEditorData, setModuleEditorData] = useState<Record<string, any>>({});

  // ── DSL 파싱 (실시간)
  useEffect(() => {
    const p = parseDSL(dslText);
    setParsed(p);
    setFlowErrors(analyzeFlowErrors(p));
    setValidation(null);  // 편집하면 이전 검증 결과 초기화
    setWarnConfirm(false);
  }, [dslText]);

  // ── 자동 draft 저장 (DSL 텍스트)
  useEffect(() => {
    if (isOpen && dslText) {
      try { localStorage.setItem(DRAFT_KEY, dslText); } catch { /* ignore */ }
    }
  }, [dslText, isOpen]);

  // ── 불러온 파일 정보 자동 저장 (sessionStorage — 탭 유지 동안 유효)
  useEffect(() => {
    if (!loadedFileInfo) return;
    try {
      const { content, ...meta } = loadedFileInfo;
      sessionStorage.setItem(FILE_META_KEY, JSON.stringify(meta));
      sessionStorage.setItem(FILE_CONTENT_KEY, content);
    } catch { /* 용량 초과 시 무시 */ }
  }, [loadedFileInfo]);

  // ── loadedFileInfo 변경 시 열 선택 목록 초기화
  // 이미 DSL에 SelectData 내용이 있으면 그것을 우선, 없으면 파일 전체 열
  useEffect(() => {
    if (!loadedFileInfo) { setColSelectorItems([]); setColSelectorDeathRate(''); return; }
    const selectSection = parsed.sections.find(s => s.type === ModuleType.SelectData);
    if (selectSection && selectSection.lines.length > 0) {
      // DSL에 이미 선택 내용이 있으면 파싱된 값 사용 + 파일에만 있는 열 추가
      const existing = selectSection.lines.map(l => ({
        originalName: l.formula,
        newName: l.output,
        selected: true,
      }));
      const existingNames = new Set(existing.map(e => e.originalName));
      const extras = loadedFileInfo.columns
        .filter(c => !existingNames.has(c))
        .map(c => ({ originalName: c, newName: c, selected: false }));
      const allItems = [...existing, ...extras];
      setColSelectorItems(allItems);
      // Death_Rate 열 초기화: newName이 Death_Rate인 항목의 originalName
      const drItem = existing.find(e => e.newName === 'Death_Rate');
      setColSelectorDeathRate(drItem?.originalName ?? '');
    } else {
      // 파일에서 처음 불러올 때: Age/Sex만 기본 선택, 나머지는 미선택
      setColSelectorItems(
        loadedFileInfo.columns.map(c => ({
          originalName: c,
          newName: c,
          selected: isAgeCol(c) || isSexCol(c),
        }))
      );
      setColSelectorDeathRate('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedFileInfo]);

  // ── 모달 열릴 때 초기화
  useEffect(() => {
    if (!isOpen) return;
    setSuggestions([]);
    setValidation(null);
    setWarnConfirm(false);
    setOpenPanel(null);
    setSaveDialog(null);
    setRenaming(null);
    setLineEdits({});

    // ── 불러온 파일 정보 복원: 캔버스 LoadData 모듈 우선 → sessionStorage 순
    const canvasLoadData = modules.find(m => m.type === ModuleType.LoadData);
    if (canvasLoadData?.parameters?.fileContent) {
      const fc = canvasLoadData.parameters.fileContent as string;
      const { columns: cols, rowCount: rc } = parseCSVMeta(fc);
      setLoadedFileInfo({
        name: (canvasLoadData.parameters.source as string) || 'data.csv',
        rowCount: rc,
        columns: cols,
        content: fc,
      });
    } else {
      try {
        const metaJson = sessionStorage.getItem(FILE_META_KEY);
        const content  = sessionStorage.getItem(FILE_CONTENT_KEY) ?? '';
        const meta = metaJson ? JSON.parse(metaJson) : null;
        setLoadedFileInfo(meta && content ? { ...meta, content } : null);
      } catch {
        setLoadedFileInfo(null);
      }
    }

    // ── DSL 텍스트: draft 우선 → 캔버스 생성 → 예제
    // (캔버스가 있어도 사용자가 직접 편집한 draft를 덮어쓰지 않음)
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) {
      setDslText(draft);
    } else if (modules.length > 0) {
      const generated = generateDSL(
        productName,
        modules.map((m) => ({ type: m.type, parameters: m.parameters }))
      );
      setDslText(generated);
    } else {
      setDslText(EXAMPLE_DSL);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]); // modules/productName은 열릴 때 한 번만 참조하므로 의도적으로 제외

  // ── 캔버스 모듈로 DSL 재생성 (localStorage에도 저장하여 재오픈 시 유지)
  const handleRegenerateFromCanvas = useCallback(() => {
    if (modules.length === 0) return;
    const generated = generateDSL(
      productName,
      modules.map((m) => ({ type: m.type, parameters: m.parameters }))
    );
    setDslText(generated);
    try { localStorage.setItem(DRAFT_KEY, generated); } catch { /* ignore */ }
  }, [modules, productName]);

  // ── 저장 다이얼로그 열기
  const handleOpenSaveDialog = useCallback((mode: 'save' | 'example') => {
    setSaveDialog({ mode, value: parsed.productName || '' });
    setOpenPanel(null);
  }, [parsed.productName]);

  // ── 저장 확정
  const handleConfirmSave = useCallback(() => {
    if (!saveDialog) return;
    const name = saveDialog.value.trim();
    if (!name) return;
    const entry: SavedEntry = { text: dslText, savedAt: new Date().toISOString() };
    if (saveDialog.mode === 'save') {
      const updated = { ...getSaves(), [name]: entry };
      localStorage.setItem(SAVES_KEY, JSON.stringify(updated));
      setSaves(updated);
      setSaveMsg(`"${name}" 저장됨 ✓`);
    } else {
      const updated = { ...getExamples(), [name]: entry };
      localStorage.setItem(EXAMPLES_KEY, JSON.stringify(updated));
      setExamples(updated);
      setSaveMsg(`"${name}" 예제로 저장됨 ✓`);
    }
    setSaveDialog(null);
    setTimeout(() => setSaveMsg(''), 2500);
  }, [saveDialog, dslText]);

  // ── Ctrl+S: 빠른 저장 (상품명 자동 사용)
  const handleQuickSave = useCallback(() => {
    const name = parsed.productName || 'unnamed';
    const entry: SavedEntry = { text: dslText, savedAt: new Date().toISOString() };
    const updated = { ...getSaves(), [name]: entry };
    localStorage.setItem(SAVES_KEY, JSON.stringify(updated));
    setSaves(updated);
    setSaveMsg(`"${name}" 저장됨 ✓`);
    setTimeout(() => setSaveMsg(''), 2000);
  }, [dslText, parsed.productName]);

  // ── 불러오기
  const handleLoad = useCallback((text: string) => {
    setDslText(text);
    setOpenPanel(null);
    setSuggestions([]);
  }, []);

  // ── 삭제
  const handleDelete = useCallback((key: string, storage: 'saves' | 'examples') => {
    const storageKey = storage === 'saves' ? SAVES_KEY : EXAMPLES_KEY;
    const current = storage === 'saves' ? getSaves() : getExamples();
    const updated = { ...current };
    delete updated[key];
    localStorage.setItem(storageKey, JSON.stringify(updated));
    if (storage === 'saves') setSaves(updated);
    else setExamples(updated);
  }, []);

  // ── 이름 바꾸기 확정
  const handleRenameConfirm = useCallback(() => {
    if (!renaming || !renaming.value.trim()) return;
    const { key, storage, value } = renaming;
    const storageKey = storage === 'saves' ? SAVES_KEY : EXAMPLES_KEY;
    const current = storage === 'saves' ? getSaves() : getExamples();
    const entry = current[key];
    if (!entry) return;
    const { [key]: _, ...rest } = current;
    const updated = { ...rest, [value.trim()]: entry };
    localStorage.setItem(storageKey, JSON.stringify(updated));
    if (storage === 'saves') setSaves(updated);
    else setExamples(updated);
    setRenaming(null);
  }, [renaming]);

  // ── 실제 파이프라인 빌드
  const executeBuild = useCallback(() => {
    const configs = buildModuleConfigs(parsed);
    // DSL 편집기에서 불러온 파일이 있으면 LoadData에 fileContent 주입
    const enrichedConfigs = loadedFileInfo
      ? configs.map(cfg =>
          cfg.type === ModuleType.LoadData
            ? { ...cfg, parameters: { ...cfg.parameters, source: loadedFileInfo.name, fileContent: loadedFileInfo.content, fileType: 'csv' } }
            : cfg
        )
      : configs;

    const parsedModules = enrichedConfigs
      .filter((c) => c.type !== ModuleType.DefinePolicyInfo)
      .map((c) => ({ type: c.type, include: true, parameters: c.parameters }));

    const policyConfig = enrichedConfigs.find((c) => c.type === ModuleType.DefinePolicyInfo);
    if (policyConfig) {
      parsedModules.unshift({ type: ModuleType.DefinePolicyInfo, include: true, parameters: policyConfig.parameters });
    }

    const { modules: newModules, connections } = buildPipelineFromModel({
      productName: parsed.productName,
      description: '',
      modules: parsedModules,
    });
    onBuildPipeline(newModules, connections, parsed.productName);
    onClose();
  }, [parsed, loadedFileInfo, onBuildPipeline, onClose]);

  // ── 흐름 에러 클릭 → 해당 줄로 이동
  const handleFlowErrorClick = useCallback((lineNumber: number) => {
    const ta = textareaRef.current;
    if (!ta || lineNumber <= 0) return;
    const lines = ta.value.split('\n');
    // 1-based → 0-based
    const idx = lineNumber - 1;
    let charStart = 0;
    for (let i = 0; i < idx && i < lines.length; i++) charStart += lines[i].length + 1;
    const charEnd = charStart + (lines[idx]?.length ?? 0);
    ta.focus();
    ta.setSelectionRange(charStart, charEnd);
    // 해당 줄이 뷰포트 중앙에 오도록 스크롤
    const lh = parseFloat(getComputedStyle(ta).lineHeight) || 20;
    ta.scrollTop = Math.max(0, (idx * lh) - ta.clientHeight / 2 + lh);
  }, []);

  // ── 파라미터만 적용 (기존 캔버스 유지)
  const handlePatchParameters = useCallback(() => {
    const configs = buildModuleConfigs(parsed);
    const enrichedConfigs = loadedFileInfo
      ? configs.map(cfg =>
          cfg.type === ModuleType.LoadData
            ? { ...cfg, parameters: { ...cfg.parameters, source: loadedFileInfo.name, fileContent: loadedFileInfo.content, fileType: 'csv' } }
            : cfg
        )
      : configs;
    onPatchParameters(enrichedConfigs, parsed.productName);
    onClose();
  }, [parsed, loadedFileInfo, onPatchParameters, onClose]);

  // ── 검증 후 빌드
  const handleBuildWithValidation = useCallback(() => {
    const result = validateDSL(parsed);
    setValidation(result);
    setWarnConfirm(false);

    if (result.errors.length > 0) return; // 에러 있으면 중단
    if (result.warnings.length > 0) {
      setWarnConfirm(true);              // 경고 있으면 확인 대기
      return;
    }
    executeBuild();                       // 에러/경고 없으면 바로 생성
  }, [parsed, executeBuild]);

  // ── Ctrl+S 단축키
  const handleKeyDownGlobal = useCallback((e: KeyboardEvent) => {
    if (isOpen && (e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (saveDialog) handleConfirmSave();
      else handleQuickSave();
    }
  }, [isOpen, saveDialog, handleConfirmSave, handleQuickSave]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDownGlobal);
    return () => document.removeEventListener('keydown', handleKeyDownGlobal);
  }, [handleKeyDownGlobal]);

  // ── 자동완성 관련 -------------------------------------------------
  const BUILTIN_VARS = [
    'lx', 'dx', 'Cx', 'Dx', 'Nx', 'Mx',
    'lx_Mortality', 'dx_Mortality', 'Cx_Mortality', 'Dx_Mortality',
    'Nx_Mortality', 'Mx_Mortality',
    'NNX_Mortality', 'BPV_Mortality', 'NNX', 'BPV', 'SUMX', 'PP', 'GP',
    'i_prem', 'i_claim', 'Death_Rate', 'Age', 'Sex',
    'cumsum_rev', 'sum',
  ];

  const extractDSLVars = useCallback((text: string): string[] => {
    const vars = new Set<string>();
    for (const line of text.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('//') || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq <= 0) continue;
      const v = t.slice(0, eq).trim();
      if (v && /^[A-Za-z_α-ωΑ-Ω]/.test(v)) vars.add(v);
    }
    return Array.from(vars);
  }, []);

  const getCaretPixelPos = useCallback((ta: HTMLTextAreaElement) => {
    const mirror = document.createElement('div');
    const s = getComputedStyle(ta);
    (['fontFamily','fontSize','fontWeight','letterSpacing','lineHeight',
      'paddingTop','paddingRight','paddingBottom','paddingLeft',
      'borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth','boxSizing'] as const
    ).forEach((p) => { (mirror.style as any)[p] = (s as any)[p]; });
    mirror.style.position = 'absolute';
    mirror.style.top = '-9999px';
    mirror.style.left = '0';
    mirror.style.width = `${ta.offsetWidth}px`;
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.wordBreak = 'break-word';
    mirror.style.visibility = 'hidden';
    mirror.style.overflow = 'hidden';
    const text = ta.value.slice(0, ta.selectionStart ?? 0);
    mirror.textContent = text;
    const caret = document.createElement('span');
    caret.textContent = '\u200b';
    mirror.appendChild(caret);
    document.body.appendChild(mirror);
    const spanTop = caret.offsetTop;
    const spanLeft = caret.offsetLeft;
    document.body.removeChild(mirror);
    const taRect = ta.getBoundingClientRect();
    const lh = parseFloat(s.lineHeight) || 18;
    return { top: taRect.top + spanTop - ta.scrollTop + lh + 4, left: taRect.left + spanLeft };
  }, []);

  const updateCursorModule = useCallback((ta: HTMLTextAreaElement) => {
    const before = ta.value.substring(0, ta.selectionStart ?? 0);
    const lines = before.split('\n');
    let found: ModuleType | null = null;
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith('## ')) {
        const key = line.slice(3).trim().toLowerCase();
        found = MODULE_HEADER_MAP[key] ?? null;
        break;
      }
      if (line.startsWith('# ')) break;
    }
    setCursorModule(found);
  }, []);

  // ── 모듈 편집기 열기: parsed 결과에서 현재 값 추출 → form 초기화
  const openModuleEditor = useCallback((type: ModuleType) => {
    const section = parsed.sections.find(s => s.type === type);
    const lines = section?.lines ?? [];
    const g = (key: string) => lines.find(l => l.output.toLowerCase().replace(/\s/g,'') === key.toLowerCase())?.formula ?? '';
    const d: Record<string, any> = {};
    switch (type) {
      case ModuleType.SelectRiskRates:
        d.ageCol    = g('agecol')    || 'Age';
        d.genderCol = g('gendercol') || 'Sex';
        break;
      case ModuleType.RateModifier:
        d.rows = lines.map(l => ({ output: l.output, formula: l.formula }));
        if (d.rows.length === 0) d.rows = [{ output: '', formula: '' }];
        break;
      case ModuleType.CalculateSurvivors:
        d.mortalityCol = g('mortalitycol') || 'Death_Rate';
        d.rows = lines
          .filter(l => l.output.toLowerCase().startsWith('lx'))
          .map(l => {
            const m = l.formula.match(/\(([^)]+)\)/);
            return { name: l.output.replace(/^lx_?/i,''), rates: m ? m[1] : l.formula.trim() };
          });
        if (d.rows.length === 0) d.rows = [{ name: 'Mortality', rates: 'Death_Rate' }];
        break;
      case ModuleType.ClaimsCalculator:
        d.rows = lines
          .filter(l => l.output.toLowerCase().startsWith('dx'))
          .map(l => {
            const parts = l.formula.split('*').map((s: string) => s.trim());
            return { lxCol: parts[0] ?? '', riskCol: parts[1] ?? '' };
          });
        if (d.rows.length === 0) d.rows = [{ lxCol: 'lx_Mortality', riskCol: 'Death_Rate' }];
        break;
      case ModuleType.NxMxCalculator: {
        d.nxRows = lines.filter(l => l.output.toLowerCase().startsWith('nx')).map(l => {
          const m = l.formula.match(/\(([^,)]+)/); const dxCol = m ? m[1].trim() : l.formula.trim();
          return { dxCol, name: l.output.replace(/^Nx_?/i,'') || dxCol.replace(/^Dx_?/i,'') };
        });
        d.mxRows = lines.filter(l => l.output.toLowerCase().startsWith('mx')).map(l => {
          const inner = (l.formula.match(/\(([^)]+)\)/) ?? [])[1] ?? '';
          const dm = inner.match(/,\s*deduct\s*=\s*([\d.]+)/i);
          const cxCol = inner.split(',')[0].trim();
          return { cxCol, name: l.output.replace(/^Mx_?/i,'') || cxCol.replace(/^Cx_?/i,''), deduct: dm ? dm[1] : '0' };
        });
        if (d.nxRows.length === 0) d.nxRows = [{ dxCol: 'Dx_Mortality', name: 'Mortality' }];
        if (d.mxRows.length === 0) d.mxRows = [{ cxCol: 'Cx_Mortality', name: 'Mortality', deduct: '0' }];
        break;
      }
      case ModuleType.PremiumComponent:
        d.nnxRows = lines.filter(l => l.output.toLowerCase().startsWith('nnx')).map(l => {
          const m = l.formula.match(/Diff\s*\(\s*([A-Za-z_]\w*)/i);
          return { nxCol: m ? m[1] : 'Nx_Mortality' };
        });
        d.bpvRows = lines.filter(l => l.output.toLowerCase().startsWith('bpv')).map(l => {
          const m = l.formula.match(/Diff\s*\(\s*([A-Za-z_]\w*)/i);
          const am = l.formula.match(/\)\s*\*\s*([\d,]+)/);
          return { mxCol: m ? m[1] : 'Mx_Mortality', amount: am ? Number(am[1].replace(/,/g,'')) : 10000 };
        });
        if (d.nnxRows.length === 0) d.nnxRows = [{ nxCol: 'Nx_Mortality' }];
        if (d.bpvRows.length === 0) d.bpvRows = [{ mxCol: 'Mx_Mortality', amount: 10000 }];
        break;
      case ModuleType.AdditionalName:
        d.alpha1 = g('α1') || '0'; d.alpha2 = g('α2') || '0';
        d.beta1  = g('β1') || '0'; d.beta2  = g('β2') || '0';
        d.gamma  = g('γ')  || '0';
        break;
      case ModuleType.NetPremiumCalculator: {
        const f0 = lines[0];
        d.varName = f0?.output ?? 'PP';
        const pts = (f0?.formula ?? '').split('/').map((s: string) => s.trim());
        d.bpvCol = pts[0] || 'BPV_Mortality';
        const nm = (pts[1] ?? '').match(/([A-Za-z_]\w*)/);
        d.nnxCol = nm ? nm[1] : 'NNX_Mortality';
        const pm = (pts[1] ?? '').match(/\((\w+)\)/);
        d.period = pm ? pm[1] : 'Year';
        break;
      }
      case ModuleType.GrossPremiumCalculator: {
        const f0 = lines[0];
        d.varName = f0?.output ?? 'GP';
        const fm = (f0?.formula ?? '').match(/^([A-Za-z_α-ωΑ-Ω]\w*)/);
        d.ppCol = fm ? fm[1] : 'PP';
        const dm = (f0?.formula ?? '').match(/\(1\s*-\s*(.+)\)/);
        d.denomExpr = dm ? dm[1] : 'α1 + α2';
        break;
      }
      case ModuleType.ReserveCalculator: {
        const ltm = lines.find(l => /<=|납입중/i.test(l.output));
        const gtm = lines.find(l => />(?!=)|납입후/i.test(l.output));
        d.formulaLtm = ltm?.formula ?? '';
        d.formulaGtm = gtm?.formula ?? '';
        break;
      }
    }
    setModuleEditorData(d);
    setModuleEditor(type);
  }, [parsed]);

  // ── 모듈 편집기 적용: form 데이터 → DSL 줄 생성 → replaceModuleSection
  const applyModuleEditor = useCallback(() => {
    if (!moduleEditor) return;
    const d = moduleEditorData;
    let body: string[] = [];
    switch (moduleEditor) {
      case ModuleType.SelectRiskRates:
        body = [`ageCol    = ${d.ageCol}`, `genderCol = ${d.genderCol}`];
        break;
      case ModuleType.RateModifier:
        body = (d.rows as any[]).filter(r => r.output && r.formula).map(r => `${r.output} = ${r.formula}`);
        break;
      case ModuleType.CalculateSurvivors:
        body = [`mortalityCol = ${d.mortalityCol}`];
        for (const row of (d.rows as any[])) {
          if (!row.name) continue;
          const rates = (row.rates as string).split(',').map((s: string) => s.trim()).filter(Boolean);
          body.push(`lx_${row.name} = lx(${rates.join(', ')})`);
          body.push(`Dx_${row.name} = lx_${row.name} * i_prem`);
        }
        break;
      case ModuleType.ClaimsCalculator:
        for (const row of (d.rows as any[])) {
          if (!row.lxCol || !row.riskCol) continue;
          const name = row.lxCol.replace(/^lx_?/i,'') || 'Mortality';
          body.push(`dx_${name} = ${row.lxCol} * ${row.riskCol}`);
          body.push(`Cx_${name} = dx_${name} * i_claim`);
        }
        break;
      case ModuleType.NxMxCalculator:
        for (const row of ((d.nxRows ?? []) as any[])) {
          if (!row.dxCol) continue;
          body.push(`Nx_${row.name} = cumsum_rev(${row.dxCol})`);
        }
        for (const row of ((d.mxRows ?? []) as any[])) {
          if (!row.cxCol) continue;
          const dp = row.deduct && row.deduct !== '0' ? `, deduct=${row.deduct}` : '';
          body.push(`Mx_${row.name} = cumsum_rev(${row.cxCol}${dp})`);
        }
        break;
      case ModuleType.PremiumComponent:
        for (const row of ((d.nnxRows ?? []) as any[])) {
          if (!row.nxCol) continue;
          const name = row.nxCol.replace(/^Nx_?/i,'') || 'Mortality';
          body.push(`NNX_${name} = Diff(${row.nxCol}, m)`);
        }
        for (const row of ((d.bpvRows ?? []) as any[])) {
          if (!row.mxCol) continue;
          const name = row.mxCol.replace(/^Mx_?/i,'') || 'Mortality';
          body.push(`BPV_${name} = Diff(${row.mxCol}, n) * ${row.amount}`);
        }
        break;
      case ModuleType.AdditionalName:
        body = [`α1 = ${d.alpha1}`,`α2 = ${d.alpha2}`,`β1 = ${d.beta1}`,`β2 = ${d.beta2}`,`γ  = ${d.gamma}`];
        break;
      case ModuleType.NetPremiumCalculator:
        body = [`${d.varName} = ${d.bpvCol} / ${d.nnxCol}(${d.period})`];
        break;
      case ModuleType.GrossPremiumCalculator:
        body = [`${d.varName} = ${d.ppCol} / (1 - ${d.denomExpr})`];
        break;
      case ModuleType.ReserveCalculator:
        if (d.formulaLtm) body.push(`V[t<=m] = ${d.formulaLtm}`);
        if (d.formulaGtm) body.push(`V[t>m]  = ${d.formulaGtm}`);
        break;
    }
    setDslText(replaceModuleSection(dslText, moduleEditor, body));
    setModuleEditor(null);
  }, [moduleEditor, moduleEditorData, dslText]);

  const updateSuggestions = useCallback((ta: HTMLTextAreaElement) => {
    const val = ta.value;
    const cursor = ta.selectionStart ?? 0;
    const before = val.slice(0, cursor);
    const tokenMatch = before.match(/[A-Za-z_α-ωΑ-Ω][\w_α-ωΑ-Ω]*$/);
    const token = tokenMatch ? tokenMatch[0] : '';
    if (token.length < 2) { setSuggestions([]); return; }
    const allVars = [...new Set([...extractDSLVars(val), ...BUILTIN_VARS])];
    const filtered = allVars.filter((v) => v.toLowerCase().startsWith(token.toLowerCase()) && v !== token).slice(0, 8);
    setSuggestions(filtered);
    setSuggActive(0);
    if (filtered.length > 0) setSuggPos(getCaretPixelPos(ta));
  }, [extractDSLVars, getCaretPixelPos]);

  const applySuggestion = useCallback((suggestion: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const val = ta.value;
    const cursor = ta.selectionStart ?? 0;
    const before = val.slice(0, cursor);
    const tokenMatch = before.match(/[A-Za-z_α-ωΑ-Ω][\w_α-ωΑ-Ω]*$/);
    const tokenStart = tokenMatch ? cursor - tokenMatch[0].length : cursor;
    setDslText(val.slice(0, tokenStart) + suggestion + val.slice(cursor));
    setSuggestions([]);
    setTimeout(() => {
      ta.selectionStart = tokenStart + suggestion.length;
      ta.selectionEnd = tokenStart + suggestion.length;
      ta.focus();
    }, 0);
  }, []);

  const handleEditorKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSuggActive((p) => Math.min(p + 1, suggestions.length - 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSuggActive((p) => Math.max(p - 1, 0)); return; }
      if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); applySuggestion(suggestions[suggActive]); return; }
      if (e.key === 'Escape') { setSuggestions([]); return; }
    }
    // Ctrl+S 저장
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleQuickSave(); }
  }, [suggestions, suggActive, applySuggestion, handleQuickSave]);

  // ── 우측 패널 라인 편집 → DSL 텍스트 동기화
  const handleLineEdit = useCallback((
    lineNumber: number,
    field: 'output' | 'formula',
    newValue: string,
    currentOutput: string,
    currentFormula: string,
  ) => {
    if (!lineNumber) return;
    const newOutput  = field === 'output'  ? newValue : currentOutput;
    const newFormula = field === 'formula' ? newValue : currentFormula;

    // 로컬 편집 상태 저장 (입력 중 커서 유지)
    setLineEdits(prev => ({ ...prev, [lineNumber]: { output: newOutput, formula: newFormula } }));

    // DSL 텍스트에서 해당 줄 교체 (trailing 주석 보존)
    setDslText(prev => {
      const lines = prev.split('\n');
      const idx = lineNumber - 1;
      if (idx < 0 || idx >= lines.length) return prev;
      const oldLine = lines[idx];
      const commentIdx = oldLine.indexOf('//');
      const trailingComment = commentIdx >= 0 ? '  ' + oldLine.slice(commentIdx) : '';
      lines[idx] = `${newOutput} = ${newFormula}${trailingComment}`;
      return lines.join('\n');
    });
  }, []);

  // ── 편집 완료 시 로컬 상태 정리
  const handleLineEditBlur = useCallback((lineNumber: number) => {
    setLineEdits(prev => {
      const next = { ...prev };
      delete next[lineNumber];
      return next;
    });
  }, []);

  // ── 공통: 파일 정보 반영 + 모듈 자동 적용 (모달 유지)
  // fileContent: 실제 CSV 텍스트 — LoadData 모듈이 파이프라인 실행 시 이 값으로 데이터를 읽음
  const applyLoadedData = useCallback((fileName: string, columns: string[], rowCount: number, fileContent: string) => {
    const newDsl = applyFileToDSL(dslText, fileName, columns);
    setLoadedFileInfo({ name: fileName, rowCount, columns, content: fileContent });
    setDslText(newDsl);
    try {
      const newParsed = parseDSL(newDsl);
      const configs = buildModuleConfigs(newParsed);
      // LoadData 모듈에 fileContent 주입 — 이 값이 없으면 파이프라인 실행 시 "No file content" 에러 발생
      const enrichedConfigs = configs.map(cfg =>
        cfg.type === ModuleType.LoadData
          ? { ...cfg, parameters: { ...cfg.parameters, source: fileName, fileContent, fileType: 'csv' as const } }
          : cfg
      );
      onPatchParameters(enrichedConfigs, newParsed.productName);
    } catch (_) { /* 파싱 실패 시 무시 */ }
  }, [dslText, onPatchParameters]);

  // ── 위험률 CSV 파일 불러오기
  const handleFileLoad = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = (ev.target?.result as string) ?? '';
      const { columns, rowCount } = parseCSVMeta(text);
      applyLoadedData(file.name, columns, rowCount, text);
    };
    reader.readAsText(file, 'utf-8');
    // 동일 파일 재선택 허용
    e.target.value = '';
  }, [applyLoadedData]);

  // ── 예제 위험률 불러오기
  const handleExampleLoad = useCallback(() => {
    const example = SAMPLE_DATA[0];
    const { columns, rowCount } = parseCSVMeta(example.content);
    applyLoadedData(example.name, columns, rowCount, example.content);
  }, [applyLoadedData]);

  // ── 열 선택 패널: 열 선택/해제 토글
  const handleColToggle = useCallback((idx: number) => {
    setColSelectorItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, selected: !item.selected } : item
    ));
  }, []);

  // ── 열 선택 패널: 순서 이동 (위/아래)
  const handleColMove = useCallback((idx: number, dir: -1 | 1) => {
    setColSelectorItems(prev => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }, []);

  // ── 열 선택 패널: 이름 변경
  const handleColRename = useCallback((idx: number, newName: string) => {
    setColSelectorItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, newName } : item
    ));
  }, []);

  // ── 열 선택 패널: 적용 → DSL 업데이트 + 모듈 파라미터 즉시 반영
  const handleColSelectorApply = useCallback(() => {
    const newDsl = applySelectDataToDSL(dslText, colSelectorItems);
    setDslText(newDsl);
    setColSelectorOpen(false);
    // DSL 파싱 후 모든 모듈 파라미터 즉시 패치 (SelectData selections 포함)
    try {
      const newParsed = parseDSL(newDsl);
      const configs = buildModuleConfigs(newParsed);
      const enrichedConfigs = loadedFileInfo
        ? configs.map(cfg =>
            cfg.type === ModuleType.LoadData
              ? { ...cfg, parameters: { ...cfg.parameters, source: loadedFileInfo.name, fileContent: loadedFileInfo.content, fileType: 'csv' } }
              : cfg
          )
        : configs;
      // deathRateColumn이 설정된 경우 CalculateSurvivors의 mortalityColumn에도 반영
      const finalConfigs = colSelectorDeathRate
        ? enrichedConfigs.map(cfg =>
            cfg.type === ModuleType.CalculateSurvivors
              ? { ...cfg, parameters: { ...cfg.parameters, mortalityColumn: 'Death_Rate' } }
              : cfg
          )
        : enrichedConfigs;
      onPatchParameters(finalConfigs, newParsed.productName);
    } catch (_) { /* 파싱 실패 시 무시 */ }
  }, [dslText, colSelectorItems, colSelectorDeathRate, loadedFileInfo, onPatchParameters]);

  // ── 표기 방식 전환: sum() ↔ cumsum_rev()
  const handleToggleNotation = useCallback(() => {
    const nextStyle = notationStyle === 'cumsum_rev' ? 'sum' : 'cumsum_rev';
    setNotationStyle(nextStyle);
    if (nextStyle === 'sum') {
      setDslText((prev) => prev.replace(/= cumsum_rev\(/g, '= sum('));
    } else {
      setDslText((prev) => prev.replace(/= sum\(/g, '= cumsum_rev('));
    }
  }, [notationStyle]);

  if (!isOpen) return null;

  const includedTypes = new Set(parsed.sections.filter((s) => s.include).map((s) => s.type));
  const hasParseError = parsed.errors.length > 0;

  const bg  = isDark ? 'bg-gray-900'  : 'bg-white';
  const bdr = isDark ? 'border-gray-700' : 'border-gray-200';
  const txt = isDark ? 'text-gray-100' : 'text-gray-900';
  const sub = isDark ? 'text-gray-400' : 'text-gray-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className={`relative flex flex-col rounded-xl border ${bdr} ${bg} shadow-2xl overflow-hidden`}
        style={{ width: '1160px', maxWidth: '98vw', height: '86vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── 헤더 */}
        <div className={`flex items-center justify-between px-5 py-3 border-b ${bdr} flex-shrink-0`}>
          <div className="flex items-center gap-2">
            <span className="text-base">📝</span>
            <h2 className={`text-sm font-bold ${txt}`}>파이프라인 DSL 정의</h2>
            <span className={`text-xs ${sub}`}>— 출력 = 입력/수식 형태로 모듈 구성</span>
          </div>
          <div className="flex items-center gap-2">
            {saveMsg && (
              <span className="text-xs text-emerald-500 font-medium">{saveMsg}</span>
            )}
            <button
              onClick={onClose}
              className={`p-1 rounded text-xs ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
            >✕</button>
          </div>
        </div>

        {/* ── 본문 */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── 왼쪽: DSL 에디터 */}
          <div className="flex flex-col w-3/5 border-r" style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}>

            {/* ── 위험률 파일 숨김 input */}
            <input ref={fileInputRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={handleFileLoad} />

            {/* ── 파일 로드 정보 바 (파일이 로드된 경우에만 표시) */}
            {loadedFileInfo && (
              <div className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 border-b ${isDark ? 'border-gray-700 bg-gray-900' : 'border-emerald-100 bg-emerald-50'}`}>
                <span className={`text-[10px] flex-shrink-0 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>✓</span>
                <span className={`text-xs font-medium truncate max-w-[180px] ${isDark ? 'text-gray-200' : 'text-gray-700'}`}
                      title={loadedFileInfo.name}>
                  {loadedFileInfo.name}
                </span>
                <span className={`text-[10px] flex-shrink-0 px-1.5 py-0.5 rounded font-mono ${
                  isDark ? 'bg-emerald-900/60 text-emerald-300' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {loadedFileInfo.rowCount.toLocaleString()}행 · {loadedFileInfo.columns.length}열
                </span>
              </div>
            )}

            {/* 에디터 툴바 */}
            <div className={`flex-shrink-0 border-b text-xs ${sub}`} style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}>
              {/* 메인 툴바 행 */}
              <div className="flex items-center justify-between px-3 py-1.5">
                <span className="font-medium">DSL 편집기</span>
                <div className="flex items-center gap-1.5">
                  {/* 저장 목록 */}
                  <button
                    onClick={() => setOpenPanel((p) => p === 'saves' ? null : 'saves')}
                    className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 ${openPanel === 'saves' ? (isDark ? 'bg-indigo-700 text-white' : 'bg-indigo-100 text-indigo-700') : (isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600')}`}
                  >📂 저장 {Object.keys(saves).length > 0 && <span className="bg-indigo-500 text-white rounded-full px-1 text-[9px]">{Object.keys(saves).length}</span>}</button>
                  {/* 예제 목록 */}
                  <button
                    onClick={() => setOpenPanel((p) => p === 'examples' ? null : 'examples')}
                    className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 ${openPanel === 'examples' ? (isDark ? 'bg-teal-700 text-white' : 'bg-teal-100 text-teal-700') : (isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600')}`}
                  >📋 예제 {Object.keys(examples).length > 0 && <span className="bg-teal-500 text-white rounded-full px-1 text-[9px]">{Object.keys(examples).length + 1}</span>}</button>
                  <span className={`text-gray-600 select-none`}>|</span>
                  {/* 저장 버튼 */}
                  <button
                    onClick={() => handleOpenSaveDialog('save')}
                    title="이름을 지정해 저장 (Ctrl+S: 빠른 저장)"
                    className={`px-2 py-0.5 rounded text-xs ${isDark ? 'bg-emerald-800 hover:bg-emerald-700 text-emerald-200' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'}`}
                  >💾 저장…</button>
                  {/* 예제로 저장 버튼 */}
                  <button
                    onClick={() => handleOpenSaveDialog('example')}
                    title="예제 목록에 저장"
                    className={`px-2 py-0.5 rounded text-xs ${isDark ? 'bg-teal-800 hover:bg-teal-700 text-teal-200' : 'bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200'}`}
                  >📌 예제로 저장…</button>
                  {modules.length > 0 && (
                    <button
                      onClick={handleRegenerateFromCanvas}
                      title="현재 캔버스 상태에서 DSL 재생성"
                      className={`px-2 py-0.5 rounded text-xs ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
                    >🔄 캔버스 내용 가져오기</button>
                  )}
                </div>
              </div>

              {/* 저장 이름 입력 다이얼로그 */}
              {saveDialog && (
                <div className={`flex items-center gap-2 px-3 py-1.5 border-t ${bdr} ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                  <span className={`text-[10px] font-semibold ${saveDialog.mode === 'example' ? 'text-teal-400' : 'text-emerald-400'}`}>
                    {saveDialog.mode === 'example' ? '📌 예제 이름' : '💾 저장 이름'}
                  </span>
                  <input
                    autoFocus
                    type="text"
                    value={saveDialog.value}
                    onChange={(e) => setSaveDialog({ ...saveDialog, value: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmSave(); if (e.key === 'Escape') setSaveDialog(null); }}
                    placeholder="이름 입력…"
                    className={`flex-1 text-xs px-2 py-0.5 rounded border focus:outline-none ${isDark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-800'}`}
                  />
                  <button onClick={handleConfirmSave} className="px-2 py-0.5 rounded text-xs bg-indigo-600 hover:bg-indigo-500 text-white">저장</button>
                  <button onClick={() => setSaveDialog(null)} className={`px-2 py-0.5 rounded text-xs ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'}`}>취소</button>
                </div>
              )}

              {/* 저장 목록 패널 */}
              {openPanel === 'saves' && (
                <div className={`border-t max-h-52 overflow-y-auto ${bdr}`}>
                  {Object.keys(saves).length === 0 ? (
                    <p className={`px-3 py-2 text-[10px] ${sub}`}>저장된 DSL이 없습니다. 💾 저장… 버튼을 사용하세요.</p>
                  ) : (
                    (Object.entries(saves) as [string, SavedEntry][]).map(([k, v]) => (
                      <div key={k} className={`flex items-center gap-1.5 px-3 py-1.5 border-b last:border-0 ${bdr}`}>
                        {renaming?.key === k && renaming.storage === 'saves' ? (
                          <>
                            <input
                              autoFocus
                              value={renaming.value}
                              onChange={(e) => setRenaming({ ...renaming, value: e.target.value })}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleRenameConfirm(); if (e.key === 'Escape') setRenaming(null); }}
                              className={`flex-1 text-xs px-1.5 py-0.5 rounded border focus:outline-none ${isDark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300'}`}
                            />
                            <button onClick={handleRenameConfirm} className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-600 text-white">확인</button>
                            <button onClick={() => setRenaming(null)} className={`px-1.5 py-0.5 rounded text-[10px] ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-500'}`}>취소</button>
                          </>
                        ) : (
                          <>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-medium truncate ${txt}`}>{k}</p>
                              <p className={`text-[10px] ${sub}`}>{new Date(v.savedAt).toLocaleString('ko-KR')}</p>
                            </div>
                            <button onClick={() => handleLoad(v.text)} className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-600 text-white hover:bg-indigo-500 flex-shrink-0">불러오기</button>
                            <button onClick={() => setRenaming({ key: k, storage: 'saves', value: k })} className={`px-1.5 py-0.5 rounded text-[10px] flex-shrink-0 ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}>이름변경</button>
                            <button onClick={() => handleDelete(k, 'saves')} className={`px-1.5 py-0.5 rounded text-[10px] flex-shrink-0 ${isDark ? 'bg-gray-700 hover:bg-red-800 text-gray-300' : 'bg-gray-100 hover:bg-red-100 text-red-500'}`}>삭제</button>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* 예제 목록 패널 */}
              {openPanel === 'examples' && (
                <div className={`border-t max-h-52 overflow-y-auto ${bdr}`}>
                  {/* 기본 내장 예제 */}
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 border-b ${bdr}`}>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium truncate ${txt}`}>종신보험 A형 (기본 예제)</p>
                      <p className={`text-[10px] text-teal-500`}>내장 예제</p>
                    </div>
                    <button
                      onClick={() => { setDslText(EXAMPLE_DSL); setOpenPanel(null); setSuggestions([]); }}
                      className="px-1.5 py-0.5 rounded text-[10px] bg-teal-600 text-white hover:bg-teal-500 flex-shrink-0"
                    >불러오기</button>
                  </div>
                  {/* 사용자 저장 예제 */}
                  {Object.keys(examples).length === 0 ? (
                    <p className={`px-3 py-2 text-[10px] ${sub}`}>저장된 예제가 없습니다. 📌 예제로 저장… 버튼을 사용하세요.</p>
                  ) : (
                    (Object.entries(examples) as [string, SavedEntry][]).map(([k, v]) => (
                      <div key={k} className={`flex items-center gap-1.5 px-3 py-1.5 border-b last:border-0 ${bdr}`}>
                        {renaming?.key === k && renaming.storage === 'examples' ? (
                          <>
                            <input
                              autoFocus
                              value={renaming.value}
                              onChange={(e) => setRenaming({ ...renaming, value: e.target.value })}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleRenameConfirm(); if (e.key === 'Escape') setRenaming(null); }}
                              className={`flex-1 text-xs px-1.5 py-0.5 rounded border focus:outline-none ${isDark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300'}`}
                            />
                            <button onClick={handleRenameConfirm} className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-600 text-white">확인</button>
                            <button onClick={() => setRenaming(null)} className={`px-1.5 py-0.5 rounded text-[10px] ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-500'}`}>취소</button>
                          </>
                        ) : (
                          <>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-medium truncate ${txt}`}>{k}</p>
                              <p className={`text-[10px] ${sub}`}>{new Date(v.savedAt).toLocaleString('ko-KR')}</p>
                            </div>
                            <button onClick={() => handleLoad(v.text)} className="px-1.5 py-0.5 rounded text-[10px] bg-teal-600 text-white hover:bg-teal-500 flex-shrink-0">불러오기</button>
                            <button onClick={() => setRenaming({ key: k, storage: 'examples', value: k })} className={`px-1.5 py-0.5 rounded text-[10px] flex-shrink-0 ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}>이름변경</button>
                            <button onClick={() => handleDelete(k, 'examples')} className={`px-1.5 py-0.5 rounded text-[10px] flex-shrink-0 ${isDark ? 'bg-gray-700 hover:bg-red-800 text-gray-300' : 'bg-gray-100 hover:bg-red-100 text-red-500'}`}>삭제</button>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* 라인 번호 + 에디터 */}
            <div className={`relative flex flex-1 overflow-hidden font-mono text-xs ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`} style={{ lineHeight: '1.6' }}>
              <div
                ref={lineNumRef}
                aria-hidden
                className={`select-none overflow-hidden flex-shrink-0 text-right pr-2 pt-3 pb-3 pl-2 ${isDark ? 'text-gray-600 bg-gray-900' : 'text-gray-400 bg-gray-100'}`}
                style={{ lineHeight: '1.6', userSelect: 'none', minWidth: '2.8rem' }}
              >
                {dslText.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}
              </div>
              <textarea
                ref={textareaRef}
                value={dslText}
                onChange={(e) => { setDslText(e.target.value); updateSuggestions(e.target as HTMLTextAreaElement); updateCursorModule(e.target as HTMLTextAreaElement); }}
                onKeyDown={handleEditorKeyDown}
                onKeyUp={(e) => {
                  updateCursorModule(e.currentTarget);
                  if (!['ArrowUp','ArrowDown','Enter','Tab','Escape'].includes(e.key))
                    updateSuggestions(e.currentTarget);
                }}
                onClick={(e) => updateCursorModule(e.currentTarget)}
                onBlur={() => setTimeout(() => setSuggestions([]), 150)}
                onScroll={(e) => {
                  const st = (e.target as HTMLTextAreaElement).scrollTop;
                  if (lineNumRef.current) lineNumRef.current.scrollTop = st;
                  setEditorScrollTop(st);
                }}
                spellCheck={false}
                className={`flex-1 resize-none focus:outline-none p-3 ${isDark ? 'bg-gray-950 text-green-300 caret-green-400' : 'bg-gray-50 text-gray-800'}`}
                style={{ lineHeight: '1.6' }}
                placeholder="DSL을 입력하세요..."
              />

              {/* ── 모듈별 오버레이 버튼 (## 헤더 줄마다 렌더링) */}
              {dslText.split('\n').map((line, idx) => {
                const t = line.trim();
                if (!t.startsWith('## ')) return null;
                const headerKey = t.slice(3).trim().toLowerCase().replace(/\s+/g,'');
                const mtype = MODULE_HEADER_MAP[headerKey];
                if (!mtype) return null;
                const LINE_H = 12 * 1.6;
                const PAD_TOP = 12;
                const top = PAD_TOP + idx * LINE_H - editorScrollTop;

                // LoadData: 파일 불러오기 버튼
                if (mtype === ModuleType.LoadData) return (
                  <div key={idx} className="absolute right-2 z-10 flex items-center gap-1" style={{ top, pointerEvents: 'auto' }}>
                    <button onMouseDown={(e) => { e.preventDefault(); fileInputRef.current?.click(); }} title="위험률 CSV 파일 불러오기"
                      className={`px-2 py-0.5 rounded text-[10px] font-medium shadow-sm border ${isDark ? 'bg-blue-900/80 hover:bg-blue-700 text-blue-200 border-blue-600' : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300'}`}>
                      📂 불러오기
                    </button>
                    <button onMouseDown={(e) => { e.preventDefault(); handleExampleLoad(); }} title="예제 데이터 불러오기"
                      className={`px-2 py-0.5 rounded text-[10px] font-medium shadow-sm border ${isDark ? 'bg-emerald-900/80 hover:bg-emerald-700 text-emerald-200 border-emerald-600' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300'}`}>
                      📋 예제
                    </button>
                  </div>
                );

                // SelectData: 열 선택 버튼 (파일 로드 후)
                if (mtype === ModuleType.SelectData) return loadedFileInfo ? (
                  <div key={idx} className="absolute right-2 z-10 flex items-center gap-1" style={{ top, pointerEvents: 'auto' }}>
                    <button
                      onMouseDown={(e) => { e.preventDefault(); setColSelectorOpen(prev => { if (!prev) setColSelectorDeathRate(colSelectorItems.find(i => i.newName === 'Death_Rate')?.originalName ?? ''); return !prev; }); }}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium shadow-sm border flex items-center gap-1 ${colSelectorOpen ? (isDark ? 'bg-violet-600 text-white border-violet-500' : 'bg-violet-600 text-white border-violet-500') : (isDark ? 'bg-violet-900/80 hover:bg-violet-700 text-violet-200 border-violet-600' : 'bg-violet-50 hover:bg-violet-100 text-violet-700 border-violet-300')}`}>
                      🔧 열 선택 {colSelectorOpen ? '▲' : '▼'}
                    </button>
                  </div>
                ) : null;

                // 나머지 모듈: 편집 버튼
                const isOpen = moduleEditor === mtype;
                return (
                  <div key={idx} className="absolute right-2 z-10 flex items-center gap-1" style={{ top, pointerEvents: 'auto' }}>
                    <button
                      onMouseDown={(e) => { e.preventDefault(); if (isOpen) setModuleEditor(null); else openModuleEditor(mtype); }}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium shadow-sm border flex items-center gap-1 ${isOpen ? (isDark ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-indigo-600 text-white border-indigo-500') : (isDark ? 'bg-indigo-900/80 hover:bg-indigo-700 text-indigo-200 border-indigo-600' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-300')}`}>
                      🔧 편집 {isOpen ? '▲' : '▼'}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* 자동완성 드롭다운 */}
            {suggestions.length > 0 && (
              <div
                className={`fixed z-[60] rounded border shadow-xl text-xs font-mono overflow-hidden ${isDark ? 'bg-gray-800 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-800'}`}
                style={{ top: suggPos.top, left: suggPos.left, minWidth: '180px', maxWidth: '260px' }}
              >
                <div className={`px-2 py-0.5 text-[10px] border-b ${isDark ? 'border-gray-700 text-gray-500' : 'border-gray-200 text-gray-400'}`}>
                  변수 자동완성 · Tab/Enter 선택 · Esc 닫기
                </div>
                {suggestions.map((s, i) => (
                  <div
                    key={s}
                    className={`px-3 py-1.5 cursor-pointer flex items-center gap-2 ${i === suggActive ? (isDark ? 'bg-indigo-700 text-white' : 'bg-indigo-100 text-indigo-900') : (isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50')}`}
                    onMouseDown={(e) => { e.preventDefault(); applySuggestion(s); }}
                    onMouseEnter={() => setSuggActive(i)}
                  >
                    <span className={`text-[10px] ${isDark ? 'text-indigo-400' : 'text-indigo-500'}`}>⬡</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── 열 선택 팝업 오버레이 */}
          {colSelectorOpen && (
            <div className="absolute inset-0 z-50 flex items-start justify-center pt-16 px-8"
                 style={{ background: 'rgba(0,0,0,0.45)' }}
                 onClick={(e) => { if (e.target === e.currentTarget) setColSelectorOpen(false); }}>
              <div className={`w-full max-w-lg rounded-xl shadow-2xl border flex flex-col overflow-hidden ${
                isDark ? 'bg-gray-900 border-violet-700' : 'bg-white border-violet-200'
              }`} style={{ maxHeight: '70vh' }}>
                {/* 팝업 헤더 */}
                <div className={`flex items-center justify-between px-4 py-3 border-b ${
                  isDark ? 'border-violet-700 bg-violet-950/40' : 'border-violet-200 bg-violet-50'
                }`}>
                  <div>
                    <p className={`text-sm font-semibold ${isDark ? 'text-violet-200' : 'text-violet-800'}`}>
                      🔧 Select Data — 열 선택 및 순서 설정
                    </p>
                    {loadedFileInfo && (
                      <p className={`text-[11px] mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        파일: {loadedFileInfo.name} · {loadedFileInfo.rowCount.toLocaleString()}행 · {loadedFileInfo.columns.length}개 열
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setColSelectorItems(prev => prev.map(i => ({ ...i, selected: true })))}
                      className={`px-2 py-0.5 rounded text-xs ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-300'}`}
                    >전체 선택</button>
                    <button
                      onClick={() => setColSelectorItems(prev => prev.map(i => ({ ...i, selected: false })))}
                      className={`px-2 py-0.5 rounded text-xs ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-300'}`}
                    >전체 해제</button>
                    <button
                      onClick={() => setColSelectorOpen(false)}
                      className={`px-2 py-0.5 rounded text-xs ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-700'}`}
                    >✕</button>
                  </div>
                </div>

                {/* Death_Rate 열 지정 */}
                <div className={`px-4 py-2.5 border-b ${isDark ? 'border-orange-800/40 bg-orange-950/20' : 'border-orange-200 bg-orange-50'}`}>
                  <label className={`text-xs font-bold block mb-1 ${isDark ? 'text-orange-300' : 'text-orange-700'}`}>
                    사망위험률 열 (Death_Rate)
                  </label>
                  <select
                    value={colSelectorDeathRate}
                    onChange={(e) => {
                      const col = e.target.value;
                      setColSelectorDeathRate(col);
                      setColSelectorItems(prev => prev.map(item => {
                        // 이전 Death_Rate 열 복원
                        if (item.originalName === colSelectorDeathRate && item.newName === 'Death_Rate') {
                          return { ...item, newName: item.originalName };
                        }
                        // 새 열 지정
                        if (col && item.originalName === col) {
                          return { ...item, selected: true, newName: 'Death_Rate' };
                        }
                        return item;
                      }));
                    }}
                    className={`w-full text-xs rounded px-2 py-1 border focus:outline-none focus:ring-1 focus:ring-orange-500 ${
                      isDark ? 'bg-gray-800 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-700'
                    }`}
                  >
                    <option value="">(선택 안 함)</option>
                    {colSelectorItems
                      .filter(i => i.originalName !== 'Age' && i.originalName !== 'Sex' && i.originalName !== 'Gender')
                      .map(i => (
                        <option key={i.originalName} value={i.originalName}>{i.originalName}</option>
                      ))}
                  </select>
                </div>

                {/* 열 목록 */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
                  {colSelectorItems.length === 0 ? (
                    <p className={`text-sm text-center py-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      위험률 파일을 먼저 불러오세요
                    </p>
                  ) : (
                    colSelectorItems.map((item, idx) => {
                      const isDeathRateItem = item.originalName === colSelectorDeathRate;
                      return (
                      <div key={idx} className={`flex items-center gap-2 px-2 py-1.5 rounded ${
                        isDeathRateItem
                          ? (isDark ? 'bg-orange-950/40 border border-orange-800/40' : 'bg-orange-50 border border-orange-200')
                          : (isDark ? 'hover:bg-gray-800' : 'hover:bg-violet-50')
                      }`}>
                        {/* 순서 이동 */}
                        <div className="flex flex-col gap-0.5 flex-shrink-0">
                          <button
                            onClick={() => handleColMove(idx, -1)}
                            disabled={idx === 0}
                            className={`w-5 h-4 flex items-center justify-center text-[9px] rounded disabled:opacity-25 ${
                              isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-600'
                            }`}
                          >▲</button>
                          <button
                            onClick={() => handleColMove(idx, 1)}
                            disabled={idx === colSelectorItems.length - 1}
                            className={`w-5 h-4 flex items-center justify-center text-[9px] rounded disabled:opacity-25 ${
                              isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-600'
                            }`}
                          >▼</button>
                        </div>

                        {/* 체크박스 + 순번 */}
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={() => handleColToggle(idx)}
                          className="flex-shrink-0 cursor-pointer w-3.5 h-3.5"
                        />
                        <span className={`text-[10px] flex-shrink-0 w-5 text-right ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                          {idx + 1}
                        </span>

                        {/* 원본 열 이름 */}
                        <span className={`font-mono text-xs flex-1 min-w-0 truncate ${
                          item.selected
                            ? (isDark ? 'text-gray-200' : 'text-gray-700')
                            : (isDark ? 'text-gray-600 line-through' : 'text-gray-400 line-through')
                        }`} title={item.originalName}>{item.originalName}</span>

                        {/* 출력 이름 변경 */}
                        {item.selected && (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>→</span>
                            <input
                              value={item.newName}
                              onChange={e => !isDeathRateItem && handleColRename(idx, e.target.value)}
                              spellCheck={false}
                              placeholder={item.originalName}
                              disabled={isDeathRateItem}
                              className={`font-mono text-xs rounded px-2 py-0.5 border w-32 focus:outline-none focus:ring-1 ${
                                isDeathRateItem
                                  ? (isDark ? 'bg-orange-900/30 border-orange-700 text-orange-200 cursor-not-allowed opacity-80' : 'bg-orange-100 border-orange-300 text-orange-700 cursor-not-allowed opacity-80')
                                  : (isDark ? 'bg-gray-800 border-gray-600 text-emerald-300 focus:ring-violet-500' : 'bg-gray-50 border-gray-300 text-indigo-700 focus:ring-violet-500')
                              }`}
                            />
                          </div>
                        )}
                      </div>
                      );
                    })
                  )}
                </div>

                {/* 팝업 하단 */}
                <div className={`flex items-center justify-between px-4 py-3 border-t ${
                  isDark ? 'border-violet-700 bg-gray-900' : 'border-violet-200 bg-violet-50'
                }`}>
                  <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {colSelectorItems.filter(i => i.selected).length} / {colSelectorItems.length}개 열 선택됨
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setColSelectorOpen(false)}
                      className={`px-3 py-1.5 rounded text-xs font-medium ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-300'}`}
                    >취소</button>
                    <button
                      onClick={handleColSelectorApply}
                      className="px-3 py-1.5 rounded text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white"
                    >✓ SelectData DSL에 적용</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── 모듈 편집기 팝업 */}
          {moduleEditor && moduleEditor !== ModuleType.LoadData && moduleEditor !== ModuleType.SelectData && (() => {
            const d = moduleEditorData;
            const label = MODULE_LABELS[moduleEditor] ?? moduleEditor;
            const info = MODULE_DESCRIPTIONS[moduleEditor];
            // ── parsed.sections에서 각 단계별 실제 출력 컬럼 추출 (ParameterInputModal과 동일 방식)
            const secOuts = (type: ModuleType) =>
              parsed.sections.find(s => s.type === type)?.lines.map(l => l.output) ?? [];

            // SelectData 출력 열 (RatingBasisBuilder·CalculateSurvivors용 데이터 열 목록)
            const selectDataOuts   = secOuts(ModuleType.SelectData);
            const dataColOpts      = selectDataOuts.length ? selectDataOuts : (loadedFileInfo?.columns ?? []);
            // RateModifier 출력 (있으면 추가)
            const rateModOuts      = secOuts(ModuleType.RateModifier);
            const riskColOpts      = [...new Set([...dataColOpts, ...rateModOuts])];

            // CalculateSurvivors 출력에서 lx_* / Dx_*
            const survivorOuts     = secOuts(ModuleType.CalculateSurvivors);
            const lxColOpts        = survivorOuts.filter(v => /^lx_/i.test(v));
            const dxBigVars        = survivorOuts.filter(v => /^Dx_/i.test(v));
            // fallback: DSL 전체 변수에서
            const allDslVars       = [...new Set([...extractDSLVars(dslText), ...BUILTIN_VARS])];
            const lxColOptsFb      = lxColOpts.length  ? lxColOpts  : allDslVars.filter(v => /^lx_/i.test(v));
            const dxBigVarsFb      = dxBigVars.length  ? dxBigVars  : allDslVars.filter(v => /^Dx_/i.test(v));

            // ClaimsCalculator 출력에서 Cx_*
            const claimsOuts       = secOuts(ModuleType.ClaimsCalculator);
            const cxBigVars        = claimsOuts.filter(v => /^Cx_/i.test(v));
            const cxBigVarsFb      = cxBigVars.length  ? cxBigVars  : allDslVars.filter(v => /^Cx_/i.test(v));

            // NxMxCalculator 출력에서 Nx_* / Mx_*
            const nxmxOuts         = secOuts(ModuleType.NxMxCalculator);
            const nxVars           = nxmxOuts.filter(v => /^Nx_/i.test(v));
            const mxVars           = nxmxOuts.filter(v => /^Mx_/i.test(v));
            const nxVarsFb         = nxVars.length     ? nxVars     : allDslVars.filter(v => /^Nx_/i.test(v));
            const mxVarsFb         = mxVars.length     ? mxVars     : allDslVars.filter(v => /^Mx_/i.test(v));

            // PremiumComponent 출력에서 NNX_* / BPV_*
            const premOuts         = secOuts(ModuleType.PremiumComponent);
            const nnxVars          = premOuts.filter(v => /^NNX_/i.test(v));
            const bpvVars          = premOuts.filter(v => /^BPV_/i.test(v));
            const nnxVarsFb        = nnxVars.length    ? nnxVars    : allDslVars.filter(v => /^NNX_/i.test(v));
            const bpvVarsFb        = bpvVars.length    ? bpvVars    : allDslVars.filter(v => /^BPV_/i.test(v));

            // NetPremiumCalculator 출력 (GrossPremiumCalculator PP 열용)
            const netOuts          = secOuts(ModuleType.NetPremiumCalculator);
            const ppVars           = netOuts.length    ? netOuts    : allDslVars.filter(v => /^PP/.test(v));

            const inputCls = `flex-1 text-xs px-2 py-0.5 rounded border focus:outline-none ${isDark ? 'bg-gray-800 border-gray-600 text-gray-100 focus:border-indigo-400' : 'bg-white border-gray-300 text-gray-800 focus:border-indigo-400'}`;
            const selCls   = `flex-1 text-xs px-1 py-0.5 rounded border focus:outline-none ${isDark ? 'bg-gray-800 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-800'}`;
            const labelCls = `text-[10px] font-semibold flex-shrink-0 w-20 ${isDark ? 'text-gray-400' : 'text-gray-500'}`;
            const rowDel   = `px-1.5 py-0.5 rounded text-[10px] flex-shrink-0 ${isDark ? 'bg-gray-700 hover:bg-red-900 text-gray-400 hover:text-red-300' : 'bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-500'}`;
            const addBtn   = `px-2 py-0.5 rounded text-[10px] font-medium ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300 border border-gray-600' : 'bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-300'}`;
            const upd = (patch: Record<string, any>) => setModuleEditorData(prev => ({ ...prev, ...patch }));
            const updRow = (key: string, i: number, patch: Record<string, any>) =>
              setModuleEditorData(prev => ({ ...prev, [key]: (prev[key] as any[]).map((r: any, j: number) => j === i ? { ...r, ...patch } : r) }));
            const addRow = (key: string, tmpl: any) =>
              setModuleEditorData(prev => ({ ...prev, [key]: [...(prev[key] as any[]), { ...tmpl }] }));
            const delRow = (key: string, i: number) =>
              setModuleEditorData(prev => ({ ...prev, [key]: (prev[key] as any[]).filter((_: any, j: number) => j !== i) }));

            const Select = ({ value, onChange, opts }: { value: string; onChange: (v: string) => void; opts: string[] }) => (
              <select value={value} onChange={e => onChange(e.target.value)} className={selCls}>
                {!opts.includes(value) && <option value={value}>{value}</option>}
                {opts.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            );

            let formContent: React.ReactNode = null;
            switch (moduleEditor) {
              case ModuleType.SelectRiskRates:
                formContent = (
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2"><span className={labelCls}>연령 열</span><Select value={d.ageCol} onChange={v => upd({ ageCol: v })} opts={dataColOpts.length ? dataColOpts : allDslVars} /></div>
                    <div className="flex items-center gap-2"><span className={labelCls}>성별 열</span><Select value={d.genderCol} onChange={v => upd({ genderCol: v })} opts={dataColOpts.length ? dataColOpts : allDslVars} /></div>
                  </div>
                );
                break;
              case ModuleType.RateModifier:
                formContent = (
                  <div className="space-y-1.5 text-xs">
                    <p className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>수식 추가 시 기존 위험률을 변환합니다. 비워두면 통과합니다.</p>
                    {((d.rows ?? []) as any[]).map((row: any, i: number) => (
                      <div key={i} className="flex items-center gap-1">
                        <input value={row.output} onChange={e => updRow('rows', i, { output: e.target.value })} placeholder="출력열명" className={`${inputCls} w-28 flex-none`} />
                        <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>=</span>
                        <input value={row.formula} onChange={e => updRow('rows', i, { formula: e.target.value })} placeholder="수식 (예: Death_Rate * 1.5)" className={inputCls} />
                        <button onClick={() => delRow('rows', i)} className={rowDel}>✕</button>
                      </div>
                    ))}
                    <button onClick={() => addRow('rows', { output: '', formula: '' })} className={addBtn}>+ 수식 추가</button>
                    <div className={`mt-2 text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>빠른 스니펫 (위험률 열 클릭 후 배율 선택):</div>
                    <div className="flex flex-wrap gap-1">
                      {riskColOpts.filter(v => !/^(Age|Sex|i_prem|i_claim)$/.test(v)).map(col =>
                        ['1.5','2.0','0.5'].map(mul => (
                          <button key={col+mul} onClick={() => addRow('rows', { output: `Modified_${col}`, formula: `${col} * ${mul}` })} className={addBtn}>{col}×{mul}</button>
                        ))
                      ).flat().slice(0, 9)}
                    </div>
                  </div>
                );
                break;
              case ModuleType.CalculateSurvivors:
                formContent = (
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className={labelCls}>사망위험률열</span>
                      <Select value={d.mortalityCol}
                        onChange={v => upd({ mortalityCol: v })}
                        opts={riskColOpts.filter(c => !/^(Age|Sex|i_prem|i_claim)$/.test(c)).length
                          ? riskColOpts.filter(c => !/^(Age|Sex|i_prem|i_claim)$/.test(c))
                          : allDslVars} />
                    </div>
                    <p className={`text-[10px] font-semibold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>lx 항목 — Dx도 자동 생성됩니다</p>
                    {(d.rows as any[]).map((row: any, i: number) => {
                      // 위험률 열 변경 시 이름 자동 생성
                      const handleRatesChange = (v: string) => {
                        const autoName = v.split(',')[0].trim().replace(/^(Death|Lapse|Decrement)_?/i, '') || v.split(',')[0].trim();
                        const nameUnchanged = !row.name || row.name === (row.rates.split(',')[0].trim().replace(/^(Death|Lapse|Decrement)_?/i,'') || row.rates.split(',')[0].trim());
                        updRow('rows', i, { rates: v, ...(nameUnchanged ? { name: autoName } : {}) });
                      };
                      return (
                        <div key={i} className="flex items-center gap-1">
                          <span className={`text-[10px] flex-shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>lx_</span>
                          <input value={row.name} onChange={e => updRow('rows', i, { name: e.target.value })} placeholder="이름" className={`${inputCls} w-20 flex-none`} />
                          <span className={`text-[10px] flex-shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>=lx(</span>
                          <Select value={row.rates.split(',')[0].trim()}
                            onChange={v => handleRatesChange(v)}
                            opts={riskColOpts.filter(c => !/^(Age|Sex|i_prem|i_claim)$/.test(c)).length
                              ? riskColOpts.filter(c => !/^(Age|Sex|i_prem|i_claim)$/.test(c))
                              : allDslVars} />
                          <span className={`text-[10px] flex-shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>)</span>
                          <button onClick={() => delRow('rows', i)} className={rowDel}>✕</button>
                        </div>
                      );
                    })}
                    <button onClick={() => {
                      const defRisk = riskColOpts.find(c => !/^(Age|Sex|i_prem|i_claim)$/.test(c)) ?? d.mortalityCol;
                      const autoName = defRisk.replace(/^(Death|Lapse|Decrement)_?/i,'') || defRisk;
                      addRow('rows', { name: autoName, rates: defRisk });
                    }} className={addBtn}>+ lx 추가</button>
                  </div>
                );
                break;
              case ModuleType.ClaimsCalculator:
                formContent = (
                  <div className="space-y-2 text-xs">
                    <p className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>각 행마다 dx_이름 / Cx_이름이 자동 생성됩니다.</p>
                    {((d.rows ?? []) as any[]).map((row: any, i: number) => (
                      <div key={i} className="flex items-center gap-1">
                        <span className={`text-[10px] flex-shrink-0 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>lx열</span>
                        <Select value={row.lxCol}
                          onChange={v => updRow('rows', i, { lxCol: v })}
                          opts={lxColOptsFb.length ? lxColOptsFb : allDslVars} />
                        <span className={`text-[10px] flex-shrink-0 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>×</span>
                        <Select value={row.riskCol}
                          onChange={v => updRow('rows', i, { riskCol: v })}
                          opts={riskColOpts.filter(c => !/^(Age|Sex|i_prem|i_claim)$/.test(c)).length
                            ? riskColOpts.filter(c => !/^(Age|Sex|i_prem|i_claim)$/.test(c))
                            : allDslVars} />
                        <span className={`text-[10px] flex-shrink-0 font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                          → dx_{row.lxCol.replace(/^lx_?/i,'')}
                        </span>
                        <button onClick={() => delRow('rows', i)} className={rowDel}>✕</button>
                      </div>
                    ))}
                    <button onClick={() => {
                      const defLx = lxColOptsFb[0] ?? 'lx_Mortality';
                      const defRisk = riskColOpts.find(c => !/^(Age|Sex|i_prem|i_claim)$/.test(c)) ?? 'Death_Rate';
                      addRow('rows', { lxCol: defLx, riskCol: defRisk });
                    }} className={addBtn}>+ 항목 추가</button>
                  </div>
                );
                break;
              case ModuleType.NxMxCalculator:
                formContent = (
                  <div className="space-y-3 text-xs">
                    <div>
                      <p className={`text-[10px] font-semibold mb-1 ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>Nx 항목 — 보험료 납입연금현가</p>
                      {((d.nxRows ?? []) as any[]).map((row: any, i: number) => (
                        <div key={i} className="flex items-center gap-1 mb-1">
                          <span className={`text-[10px] flex-shrink-0 ${isDark ? 'text-gray-500':'text-gray-400'}`}>Nx_</span>
                          <input value={row.name} onChange={e => updRow('nxRows', i, { name: e.target.value })} placeholder="이름" className={`${inputCls} w-20 flex-none`} />
                          <span className={`text-[10px] flex-shrink-0 ${isDark ? 'text-gray-500':'text-gray-400'}`}>=Σrev(</span>
                          <Select value={row.dxCol}
                            onChange={v => {
                              const autoName = v.replace(/^Dx_?/i,'');
                              const nameUnchanged = !row.name || row.name === row.dxCol.replace(/^Dx_?/i,'');
                              updRow('nxRows', i, { dxCol: v, ...(nameUnchanged ? { name: autoName } : {}) });
                            }}
                            opts={dxBigVarsFb.length ? dxBigVarsFb : allDslVars} />
                          <span className={`text-[10px] flex-shrink-0 ${isDark ? 'text-gray-500':'text-gray-400'}`}>)</span>
                          <button onClick={() => delRow('nxRows', i)} className={rowDel}>✕</button>
                        </div>
                      ))}
                      <button onClick={() => {
                        const defDx = dxBigVarsFb[0] ?? 'Dx_Mortality';
                        addRow('nxRows', { dxCol: defDx, name: defDx.replace(/^Dx_?/i,'') });
                      }} className={addBtn}>+ Nx 추가</button>
                    </div>
                    <div>
                      <p className={`text-[10px] font-semibold mb-1 ${isDark ? 'text-orange-300' : 'text-orange-600'}`}>Mx 항목 — 사망급부현가</p>
                      {((d.mxRows ?? []) as any[]).map((row: any, i: number) => (
                        <div key={i} className="flex items-center gap-1 mb-1">
                          <span className={`text-[10px] flex-shrink-0 ${isDark ? 'text-gray-500':'text-gray-400'}`}>Mx_</span>
                          <input value={row.name} onChange={e => updRow('mxRows', i, { name: e.target.value })} placeholder="이름" className={`${inputCls} w-20 flex-none`} />
                          <span className={`text-[10px] flex-shrink-0 ${isDark ? 'text-gray-500':'text-gray-400'}`}>=Σrev(</span>
                          <Select value={row.cxCol}
                            onChange={v => {
                              const autoName = v.replace(/^Cx_?/i,'');
                              const nameUnchanged = !row.name || row.name === row.cxCol.replace(/^Cx_?/i,'');
                              updRow('mxRows', i, { cxCol: v, ...(nameUnchanged ? { name: autoName } : {}) });
                            }}
                            opts={cxBigVarsFb.length ? cxBigVarsFb : allDslVars} />
                          <select value={row.deduct} onChange={e => updRow('mxRows', i, { deduct: e.target.value })} className={`w-28 flex-none ${selCls}`}>
                            <option value="0">공제없음</option><option value="0.25">deduct=0.25 (3개월)</option><option value="0.5">deduct=0.5 (6개월)</option>
                          </select>
                          <button onClick={() => delRow('mxRows', i)} className={rowDel}>✕</button>
                        </div>
                      ))}
                      <button onClick={() => {
                        const defCx = cxBigVarsFb[0] ?? 'Cx_Mortality';
                        addRow('mxRows', { cxCol: defCx, name: defCx.replace(/^Cx_?/i,''), deduct: '0' });
                      }} className={addBtn}>+ Mx 추가</button>
                    </div>
                  </div>
                );
                break;
              case ModuleType.PremiumComponent:
                formContent = (
                  <div className="space-y-3 text-xs">
                    <div>
                      <p className={`text-[10px] font-semibold mb-1 ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>NNX 항목 — 납입연금현가 (Year/Half/Quarter/Month 자동 생성)</p>
                      {((d.nnxRows ?? []) as any[]).map((row: any, i: number) => (
                        <div key={i} className="flex items-center gap-1 mb-1">
                          <span className={`text-[10px] flex-shrink-0 ${isDark ? 'text-gray-500':'text-gray-400'}`}>NNX_* = Diff(</span>
                          <Select value={row.nxCol}
                            onChange={v => updRow('nnxRows', i, { nxCol: v })}
                            opts={nxVarsFb.length ? nxVarsFb : allDslVars} />
                          <span className={`text-[10px] flex-shrink-0 ${isDark ? 'text-gray-500':'text-gray-400'}`}>, m)</span>
                          <button onClick={() => delRow('nnxRows', i)} className={rowDel}>✕</button>
                        </div>
                      ))}
                      <button onClick={() => addRow('nnxRows', { nxCol: nxVarsFb[0] ?? 'Nx_Mortality' })} className={addBtn}>+ NNX 추가</button>
                    </div>
                    <div>
                      <p className={`text-[10px] font-semibold mb-1 ${isDark ? 'text-orange-300' : 'text-orange-600'}`}>BPV 항목 — 급부현가</p>
                      {((d.bpvRows ?? []) as any[]).map((row: any, i: number) => (
                        <div key={i} className="flex items-center gap-1 mb-1">
                          <span className={`text-[10px] flex-shrink-0 ${isDark ? 'text-gray-500':'text-gray-400'}`}>BPV_* = Diff(</span>
                          <Select value={row.mxCol}
                            onChange={v => updRow('bpvRows', i, { mxCol: v })}
                            opts={mxVarsFb.length ? mxVarsFb : allDslVars} />
                          <span className={`text-[10px] flex-shrink-0 ${isDark ? 'text-gray-500':'text-gray-400'}`}>, n) ×</span>
                          <input type="number" value={row.amount} onChange={e => updRow('bpvRows', i, { amount: Number(e.target.value) })} className={`${inputCls} w-24 flex-none`} />
                          <span className={`text-[10px] flex-shrink-0 ${isDark ? 'text-gray-500':'text-gray-400'}`}>원</span>
                          <button onClick={() => delRow('bpvRows', i)} className={rowDel}>✕</button>
                        </div>
                      ))}
                      <button onClick={() => addRow('bpvRows', { mxCol: mxVarsFb[0] ?? 'Mx_Mortality', amount: 10000 })} className={addBtn}>+ BPV 추가</button>
                    </div>
                  </div>
                );
                break;
              case ModuleType.AdditionalName:
                formContent = (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[['α1','alpha1','신계약비(초년도)'],['α2','alpha2','신계약비(갱신)'],['β1','beta1','유지비(납입중)'],['β2','beta2','유지비(납입후)'],['γ','gamma','수금비']].map(([sym, key, hint]) => (
                      <div key={key} className="flex items-center gap-1.5">
                        <span className={`font-mono text-sm flex-shrink-0 w-5 ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}>{sym}</span>
                        <input type="number" step="0.001" value={d[key]} onChange={e => upd({ [key]: e.target.value })} className={`${inputCls} w-20 flex-none`} />
                        <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{hint}</span>
                      </div>
                    ))}
                  </div>
                );
                break;
              case ModuleType.NetPremiumCalculator:
                formContent = (
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2"><span className={labelCls}>변수명</span><input value={d.varName} onChange={e => upd({ varName: e.target.value })} className={inputCls} /></div>
                    <div className="flex items-center gap-2"><span className={labelCls}>BPV 열</span>
                      <Select value={d.bpvCol} onChange={v => upd({ bpvCol: v })} opts={bpvVarsFb.length ? bpvVarsFb : allDslVars} />
                    </div>
                    <div className="flex items-center gap-2"><span className={labelCls}>NNX 열</span>
                      <Select value={d.nnxCol} onChange={v => upd({ nnxCol: v })} opts={nnxVarsFb.length ? nnxVarsFb : allDslVars} />
                    </div>
                    <div className="flex items-center gap-2"><span className={labelCls}>납입 단위</span>
                      <select value={d.period} onChange={e => upd({ period: e.target.value })} className={selCls}>
                        {['Year','Half','Quarter','Month'].map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <p className={`text-[10px] font-mono ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>→ {d.varName} = {d.bpvCol} / {d.nnxCol}({d.period})</p>
                  </div>
                );
                break;
              case ModuleType.GrossPremiumCalculator:
                formContent = (
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2"><span className={labelCls}>변수명</span><input value={d.varName} onChange={e => upd({ varName: e.target.value })} className={inputCls} /></div>
                    <div className="flex items-center gap-2"><span className={labelCls}>PP 열</span>
                      <Select value={d.ppCol} onChange={v => upd({ ppCol: v })} opts={ppVars.length ? ppVars : allDslVars} />
                    </div>
                    <div className="flex items-center gap-2"><span className={labelCls}>분모 수식</span>
                      <span className={`text-[10px] flex-shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>(1 − </span>
                      <input value={d.denomExpr} onChange={e => upd({ denomExpr: e.target.value })} className={inputCls} />
                      <span className={`text-[10px] flex-shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>)</span>
                    </div>
                    <p className={`text-[10px] font-mono ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>→ {d.varName} = {d.ppCol} / (1 - {d.denomExpr})</p>
                    <div className="flex flex-wrap gap-1">
                      {[['α1+α2','α1 + α2'],['α1+α2+β1','α1 + α2 + β1'],['α1+α2+β1+β2','α1 + α2 + β1 + β2']].map(([lbl, expr]) => (
                        <button key={lbl} onClick={() => upd({ denomExpr: expr })} className={addBtn}>{lbl}</button>
                      ))}
                    </div>
                  </div>
                );
                break;
              case ModuleType.ReserveCalculator: {
                const refVars = [...new Set([...bpvVarsFb, ...nnxVarsFb, ...nxVarsFb, ...mxVarsFb])].slice(0, 10);
                formContent = (
                  <div className="space-y-2 text-xs">
                    <p className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>V[t] = 미래급부현가 − 미래보험료현가. m=납입만료, n=보험만기.</p>
                    <div>
                      <label className={`text-[10px] font-semibold ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>V[t≤m] — 납입기간 중</label>
                      <textarea rows={2} value={d.formulaLtm} onChange={e => upd({ formulaLtm: e.target.value })}
                        className={`w-full mt-0.5 font-mono text-[10px] px-2 py-1 rounded border focus:outline-none ${isDark ? 'bg-gray-800 border-gray-600 text-green-300' : 'bg-gray-50 border-gray-300 text-gray-800'}`} />
                    </div>
                    <div>
                      <label className={`text-[10px] font-semibold ${isDark ? 'text-orange-300' : 'text-orange-600'}`}>V[t&gt;m] — 납입 완료 후</label>
                      <textarea rows={2} value={d.formulaGtm} onChange={e => upd({ formulaGtm: e.target.value })}
                        className={`w-full mt-0.5 font-mono text-[10px] px-2 py-1 rounded border focus:outline-none ${isDark ? 'bg-gray-800 border-gray-600 text-green-300' : 'bg-gray-50 border-gray-300 text-gray-800'}`} />
                    </div>
                    {refVars.length > 0 && (
                      <div>
                        <p className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>변수 클릭 → 클립보드 복사</p>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {refVars.map(v => (
                            <button key={v} className={`${addBtn} font-mono`}
                              onMouseDown={e => { e.preventDefault(); navigator.clipboard.writeText(v).catch(()=>{}); }}>{v}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
                break;
              }
              default:
                formContent = <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>이 모듈은 직접 편집을 지원하지 않습니다.</p>;
            }

            return (
              <div className="absolute inset-0 z-50 flex items-start justify-center pt-10 px-8"
                   style={{ background: 'rgba(0,0,0,0.45)' }}
                   onClick={(e) => { if (e.target === e.currentTarget) setModuleEditor(null); }}>
                <div className={`w-full max-w-lg rounded-xl shadow-2xl border flex flex-col overflow-hidden ${isDark ? 'bg-gray-900 border-indigo-700' : 'bg-white border-indigo-200'}`} style={{ maxHeight: '75vh' }}>
                  {/* 헤더 */}
                  <div className={`flex items-start justify-between px-4 py-3 border-b ${isDark ? 'border-indigo-700 bg-indigo-950/40' : 'border-indigo-200 bg-indigo-50'}`}>
                    <div>
                      <p className={`text-sm font-semibold ${isDark ? 'text-indigo-200' : 'text-indigo-800'}`}>🔧 {label}</p>
                      {info && <p className={`text-[11px] mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{info.desc}</p>}
                    </div>
                    <button onClick={() => setModuleEditor(null)} className={`text-xs p-1 ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-700'}`}>✕</button>
                  </div>
                  {/* 본문 */}
                  <div className="flex-1 overflow-y-auto px-4 py-3">
                    {formContent}
                  </div>
                  {/* 푸터 */}
                  <div className={`flex items-center justify-end gap-2 px-4 py-3 border-t ${isDark ? 'border-indigo-700 bg-gray-900' : 'border-indigo-100 bg-indigo-50'}`}>
                    <button onClick={() => setModuleEditor(null)} className={`px-3 py-1.5 rounded text-xs font-medium ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-300'}`}>취소</button>
                    <button onClick={applyModuleEditor} className="px-3 py-1.5 rounded text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white">✓ DSL에 적용</button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── 오른쪽: 미리보기 + 검증 */}
          <div className="flex flex-col w-2/5 overflow-y-auto">
            <div className="p-4 space-y-3 flex-1">

              {/* 상품 정보 */}
              <div className={`p-2 rounded border ${bdr}`}>
                <p className={`text-xs font-bold ${txt}`}>{parsed.productName || '(상품명 미정의)'}</p>
                <p className={`text-xs ${sub} mt-0.5`}>
                  가입연령 {parsed.policyParams.entryAge}세 · {parsed.policyParams.gender} ·{' '}
                  납입 {parsed.policyParams.paymentTerm}년 · 이율 {parsed.policyParams.interestRate}%
                </p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  <span className={`text-[10px] px-1.5 py-px rounded-full font-medium ${
                    hasParseError
                      ? (isDark ? 'bg-red-900/60 text-red-300' : 'bg-red-100 text-red-700')
                      : (isDark ? 'bg-emerald-900/60 text-emerald-300' : 'bg-emerald-100 text-emerald-700')
                  }`}>
                    {hasParseError ? `🚫 파싱 오류 ${parsed.errors.length}건` : '✓ 파싱 정상'}
                  </span>
                  <span className={`text-[10px] px-1.5 py-px rounded-full font-medium ${
                    flowErrors.length > 0
                      ? (isDark ? 'bg-orange-900/60 text-orange-300' : 'bg-orange-100 text-orange-700')
                      : (isDark ? 'bg-emerald-900/60 text-emerald-300' : 'bg-emerald-100 text-emerald-700')
                  }`}>
                    {flowErrors.length > 0 ? `⚠ 흐름 경고 ${flowErrors.length}건` : '✓ 흐름 정상'}
                  </span>
                  <span className={`text-[10px] px-1.5 py-px rounded-full font-medium ${
                    isDark ? 'bg-indigo-900/60 text-indigo-300' : 'bg-indigo-100 text-indigo-700'
                  }`}>
                    모듈 {includedTypes.size}개 포함
                  </span>
                </div>
              </div>

              {/* 파싱 에러 상세 */}
              {hasParseError && (
                <div className={`p-2 rounded border text-xs ${isDark ? 'border-red-700 bg-red-950/30 text-red-300' : 'border-red-200 bg-red-50 text-red-700'}`}>
                  <p className="font-semibold mb-1">🚫 파싱 오류 — DSL 구문을 확인하세요</p>
                  {parsed.errors.map((e, i) => <p key={i} className="font-mono break-all">• {e}</p>)}
                </div>
              )}

              {/* 흐름 경고 상세 — 실시간, 항상 표시 */}
              {flowErrors.length > 0 ? (
                <div className={`p-2 rounded border text-xs ${isDark ? 'border-orange-700 bg-orange-950/20 text-orange-300' : 'border-orange-200 bg-orange-50 text-orange-700'}`}>
                  <p className="font-semibold mb-1">🔗 흐름 경고 ({flowErrors.length}건) — 클릭하면 해당 줄로 이동</p>
                  <div className="space-y-0.5 max-h-48 overflow-y-auto">
                    {flowErrors.map((e, i) => (
                      <p
                        key={i}
                        className={`font-mono break-all cursor-pointer rounded px-1 -mx-1 leading-snug ${isDark ? 'hover:bg-orange-800/40' : 'hover:bg-orange-100'}`}
                        title={`${e.lineNumber}번째 줄로 이동`}
                        onClick={() => handleFlowErrorClick(e.lineNumber)}
                      >
                        <span className={`mr-1 font-semibold ${isDark ? 'text-orange-400' : 'text-orange-500'}`}>L{e.lineNumber}</span>
                        {e.message}
                      </p>
                    ))}
                  </div>
                </div>
              ) : (
                !hasParseError && (
                  <div className={`p-2 rounded border text-xs ${isDark ? 'border-emerald-800 bg-emerald-950/20 text-emerald-400' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                    ✅ 흐름 오류 없음 — DSL 구조가 정상입니다
                  </div>
                )
              )}

              {/* 검증 결과 (파이프라인 생성 버튼 클릭 후) */}
              {validation && (
                <div className="space-y-2">
                  {validation.errors.length > 0 && (
                    <div className={`p-2 rounded border text-xs ${isDark ? 'border-red-700 bg-red-950/30 text-red-300' : 'border-red-200 bg-red-50 text-red-700'}`}>
                      <p className="font-semibold mb-1">🚫 검증 오류 — 수정 후 생성하세요</p>
                      {validation.errors.map((e, i) => <p key={i} className="break-all">• {e}</p>)}
                    </div>
                  )}
                  {validation.warnings.length > 0 && (
                    <div className={`p-2 rounded border text-xs ${isDark ? 'border-yellow-700 bg-yellow-950/20 text-yellow-300' : 'border-yellow-200 bg-yellow-50 text-yellow-700'}`}>
                      <p className="font-semibold mb-1">⚠️ 검증 경고</p>
                      {validation.warnings.map((w, i) => <p key={i} className="break-all">• {w}</p>)}
                      {warnConfirm && validation.errors.length === 0 && (
                        <button
                          onClick={executeBuild}
                          className="mt-2 px-2 py-1 rounded text-xs bg-yellow-500 hover:bg-yellow-400 text-white font-semibold w-full"
                        >경고를 무시하고 파이프라인 생성</button>
                      )}
                    </div>
                  )}
                  {validation.errors.length === 0 && validation.warnings.length === 0 && (
                    <div className={`p-2 rounded border text-xs ${isDark ? 'border-emerald-700 bg-emerald-950/20 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                      ✅ 검증 통과 — 파이프라인을 생성합니다
                    </div>
                  )}
                </div>
              )}

              {/* 포함 모듈 요약 */}
              <div className={`rounded border ${bdr} overflow-hidden`}>
                <div className={`px-3 py-1.5 text-xs font-semibold ${sub} border-b ${bdr}`}>
                  포함 모듈 ({includedTypes.size}개)
                </div>
                <div className="px-3 py-2 flex flex-wrap gap-1.5">
                  {MODULE_ORDER.map((type) => {
                    const included = includedTypes.has(type);
                    return (
                      <span key={type} className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        included
                          ? (isDark ? 'bg-emerald-900/60 text-emerald-300' : 'bg-emerald-100 text-emerald-700')
                          : (isDark ? 'bg-gray-800 text-gray-600' : 'bg-gray-100 text-gray-400')
                      }`}>
                        {included ? '✓' : '○'} {MODULE_LABELS[type] ?? type}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* 문법 도움말 / 모듈 설명 */}
              <div className={`p-2 rounded border text-xs ${isDark ? 'border-blue-900 bg-blue-950/20 text-blue-300' : 'border-blue-100 bg-blue-50 text-blue-700'}`}>
                {cursorModule && MODULE_DESCRIPTIONS[cursorModule] ? (() => {
                  const info = MODULE_DESCRIPTIONS[cursorModule]!;
                  const label = MODULE_LABELS[cursorModule] ?? cursorModule;
                  return (
                    <>
                      <p className={`font-semibold mb-1 ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>
                        📌 {label}
                      </p>
                      <p className={`mb-1.5 leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        {info.desc}
                      </p>
                      {info.formulas.length > 0 && (
                        <ul className="space-y-0.5">
                          {info.formulas.map((f, i) => (
                            <li key={i} className={`font-mono text-[10px] leading-relaxed ${
                              f.startsWith('  ') ? 'pl-3 opacity-80' : ''
                            } ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                              {f.startsWith('  ') ? f : `• ${f}`}
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  );
                })() : (
                  <>
                    <p className="font-semibold mb-1">📌 DSL 문법</p>
                    <p className="font-mono"># 상품명 | age=40 | pay=20 | rate=2.5</p>
                    <p className="font-mono">## 모듈명</p>
                    <p className="font-mono">출력열 = 입력열/수식</p>
                    <p className="mt-1 font-mono text-[10px]">// 주석 · Ctrl+S 저장</p>
                    <p className={`mt-1 text-[10px] ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      편집기 안에서 커서를 이동하면 해당 모듈의 문법이 표시됩니다
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── 하단 버튼 */}
        <div className={`flex items-center justify-between px-5 py-3 border-t ${bdr} flex-shrink-0`}>
          <p className={`text-[10px] ${sub}`}>
            Ctrl+S 빠른 저장 · 💾 저장… 이름 지정 · 📌 예제로 저장… 예제 등록 · Σ 버튼으로 sum/cumsum_rev 전환
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
            >취소</button>
            {modules.length > 0 && (
              <button
                onClick={handlePatchParameters}
                disabled={hasParseError}
                title="기존 모듈의 위치·연결을 유지한 채 파라미터만 DSL에서 업데이트합니다"
                className={`px-3 py-1.5 text-xs font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${isDark ? 'bg-teal-800 hover:bg-teal-700 text-teal-200' : 'bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200'}`}
              >파라미터 적용</button>
            )}
            <button
              onClick={handleBuildWithValidation}
              disabled={hasParseError}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white"
            >파이프라인 생성</button>
          </div>
        </div>
      </div>
    </div>
  );
};
