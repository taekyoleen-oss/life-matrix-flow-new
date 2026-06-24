import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  DragEvent,
} from "react";
import { Canvas } from "./components/Canvas";
import {
  CanvasModule,
  ModuleType,
  Connection,
  ModuleStatus,
  ModuleOutput,
  ColumnInfo,
  DataPreview,
  NetPremiumOutput,
  PremiumComponentOutput,
  PolicyInfoOutput,
  PipelineReportStep,
  AdditionalVariablesOutput,
  GrossPremiumOutput,
} from "./types";
import { DEFAULT_MODULES, TOOLBOX_MODULES } from "./constants";
import {
  executePipelineCore,
  getTopologicalSort as getTopologicalSortCore,
} from "./utils/pipelineEngine";
import {
  LogoIcon,
  PlayIcon,
  CodeBracketIcon,
  FolderOpenIcon,
  PlusIcon,
  MinusIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  ArrowsPointingOutIcon,
  SparklesIcon,
  CheckIcon,
  CommandLineIcon,
  Bars3Icon,
  ClipboardDocumentListIcon,
  BeakerIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  QueueListIcon,
  FontSizeIncreaseIcon,
  FontSizeDecreaseIcon,
  XMarkIcon,
  SunIcon,
  MoonIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  KeyIcon,
  LockClosedIcon,
  LockOpenIcon,
} from "./components/icons";
import useHistoryState from "./hooks/useHistoryState";
import { useTheme } from "./contexts/ThemeContext";
import { useApiKey } from "./contexts/ApiKeyContext";
import { useAdvancedAccess } from "./contexts/AdvancedAccessContext";
import { Tooltip } from "./components/Tooltip";
import { LockBadge } from "./components/LockBadge";
import { DataPreviewModal } from "./components/DataPreviewModal";
import { ParameterInputModal } from "./components/ParameterInputModal";
import { SAMPLE_DATA } from "./sampleData";
import { CodeTerminalPanel } from "./components/CodeTerminalPanel";
import { NetPremiumPreviewModal } from "./components/NetPremiumPreviewModal";
import { AdditionalVariablesPreviewModal } from "./components/AdditionalVariablesPreviewModal";
import { PipelineReportModal } from "./components/PipelineReportModal";
import { PipelineExecutionModal } from "./components/PipelineExecutionModal";
import SamplesModal from "./components/SamplesModal";
import { SamplesManagementModal } from "./components/SamplesManagementModal";
import { PolicySetupModal } from "./components/PolicySetupModal";
import { PipelineDSLModal } from "./components/PipelineDSLModal";
import {
  loadSharedSamples,
  saveSampleToFile,
  loadSampleFromFile,
  loadPersonalWork,
  savePersonalWork,
  SampleData,
} from "./utils/samples";
import {
  isSupabaseConfigured,
  fetchAutoflowSamplesList,
  fetchAutoflowSampleById,
} from "./utils/supabase-samples";
import { savePipeline, loadPipeline } from "./utils/fileOperations";
import {
  bindDatasetsToModules,
  contentSizeMB,
  EMBED_SIZE_LIMIT_MB,
  uploadDatasetToWeb,
} from "./utils/datasetRegistry";
import {
  SaveModelOptionsModal,
  type LoaderDataInfo,
  type SaveDecisions,
} from "./components/SaveModelOptionsModal";
import { SlideReportButton } from "./components/SlideReportButton";
import { RecomputeExportButton } from "./components/RecomputeExportButton";
import { loadModuleDefault } from "./utils/moduleDefaults";
import { buildPipelineFromModel } from "./utils/pipelineBuilder";
import { generateDSL } from "./utils/dslParser";
import { AIPipelineFromGoalModal } from "./components/AIPipelineFromGoalModal";
import { AIPlanDisplayModal } from "./components/AIPlanDisplayModal";
import { parseMarkdownModel } from "./utils/markdownModelParser";

function buildPipelineGenerationPrompt(goal: string): string {
  return `당신은 보험료 산출 파이프라인 설계 전문가입니다.
사용자의 목표에 맞는 보험료 산출 파이프라인을 아래 DSL 마크다운 형식으로 생성하세요.

[사용 가능한 모듈]
- LoadData: 위험률 CSV 파일 로드
- SelectRiskRates: 나이/성별 기준 위험률 선택
- SelectData: 위험률 컬럼 선택
- RateModifier: 요율 보정
- DefinePolicyInfo: 증권 기본 정보 (가입연령, 성별, 보험기간, 납입기간, 이율)
- CalculateSurvivors: 생존자 수(Lx) 계산
- ClaimsCalculator: 클레임 계산
- NxMxCalculator: Nx/Mx 통신 계산
- PremiumComponent: NNX/BPV 계산
- AdditionalName: 추가 변수 정의
- NetPremiumCalculator: 순보험료 계산 (수식 포함)
- GrossPremiumCalculator: 영업보험료 계산 (수식 포함)
- ReserveCalculator: 준비금 계산

[DSL 형식 예시]
**상품명**: 종신보험
**설명**: 30세 남성 기준 순보험료 산출

## [1] 증권 기본 정보 (DefinePolicyInfo)
**포함여부**: yes
**가입연령**: 30
**성별**: M
**보험기간**: life
**납입기간**: 20
**이율 (%)**: 2.5

## [2] 위험률 데이터 로드 (LoadData)
**포함여부**: yes

## [3] 나이/성별 기준 위험률 선택 (SelectRiskRates)
**포함여부**: yes

## [4] 위험률 컬럼 선택 (SelectData)
**포함여부**: yes

## [5] 생존자 수 계산 (CalculateSurvivors)
**포함여부**: yes

## [6] 클레임 계산 (ClaimsCalculator)
**포함여부**: yes

## [7] Nx/Mx 계산 (NxMxCalculator)
**포함여부**: yes

## [8] NNX/BPV 계산 (PremiumComponent)
**포함여부**: yes

## [9] 순보험료 계산 (NetPremiumCalculator)
**포함여부**: yes
**수식**: [BPV_Mortality] / [NNX_Mortality(Year)]
**변수명**: PP

## [10] 영업보험료 계산 (GrossPremiumCalculator)
**포함여부**: yes
**수식**: [PP] / (1 - 0.05)
**변수명**: GP

사용자 목표: ${goal}

위 형식에 맞는 DSL 마크다운을 생성하세요. 코드블록 없이 마크다운만 출력하세요.`;
}

const getModuleDefault = (type: ModuleType) => {
  const defaultData = DEFAULT_MODULES.find((m) => m.type === type)!;
  const moduleInfo = TOOLBOX_MODULES.find((m) => m.type === type)!;
  
  // 저장된 사용자 정의 기본값이 있으면 우선 사용, 없으면 기본값 사용
  const savedDefault = loadModuleDefault(type);
  const parameters = savedDefault 
    ? JSON.parse(JSON.stringify(savedDefault))
    : JSON.parse(JSON.stringify(defaultData.parameters));
  
  return {
    type,
    // 표시명은 한글 우선(+영문 약어 병기). DSL/내부 식별은 module.type 기준이라 안전.
    name: (moduleInfo as any).nameKo || moduleInfo.name,
    status: ModuleStatus.Pending,
    parameters, // Deep copy
    inputs: JSON.parse(JSON.stringify(defaultData.inputs)), // Deep copy
    outputs: JSON.parse(JSON.stringify(defaultData.outputs)), // Deep copy
  };
};

const sampleRiskData = SAMPLE_DATA.find((d) => d.name === "risk_rates.csv");

// Load initial modules and connections from New Life Product.lifx
// This will be populated from the shared samples JSON file
// Since loadSharedSamples is async, we'll load it in useEffect and set initial state
// For now, return empty arrays - the actual loading happens in useEffect
const loadInitialModelFromLifx = (): { modules: CanvasModule[]; connections: Connection[] } => {
  // This will be populated asynchronously in useEffect
  return { modules: [], connections: [] };
};

const { modules: lifxModules, connections: lifxConnections } = loadInitialModelFromLifx();

// Initial Layout Configuration (U-shape flow)
const initialModules: CanvasModule[] = lifxModules.length > 0 ? lifxModules : [
  // Row 1: Data & Basic Calc (Left to Right)
  {
    id: "load-1",
    ...getModuleDefault(ModuleType.LoadData),
    position: { x: 320, y: 50 },
    parameters: {
      source: sampleRiskData?.name || "risk_rates.csv",
      fileContent: sampleRiskData?.content || "",
    },
  },
  {
    id: "select-rates-1",
    ...getModuleDefault(ModuleType.SelectRiskRates),
    position: { x: 590, y: 50 },
    parameters: {
      ageColumn: "Age",
      genderColumn: "Sex",
    },
  },
  {
    id: "select-data-1",
    ...getModuleDefault(ModuleType.SelectData),
    position: { x: 860, y: 50 },
  },
  {
    id: "rate-modifier-1",
    ...getModuleDefault(ModuleType.RateModifier),
    position: { x: 1130, y: 50 },
  },
  {
    id: "survivors-1",
    ...getModuleDefault(ModuleType.CalculateSurvivors),
    position: { x: 1400, y: 50 },
    parameters: {
      ageColumn: "Age",
      mortalityColumn: "Male_Mortality",
      calculations: [
        {
          id: `calc-${Date.now()}`,
          name: "Male_Mortality",
          decrementRates: ["Male_Mortality"],
        },
      ],
    },
  },

  // Row 2: Advanced Calc & Premium (Right to Left flow conceptually, but positioned below)
  {
    id: "claims-1",
    ...getModuleDefault(ModuleType.ClaimsCalculator),
    position: { x: 1400, y: 220 },
    parameters: {
      calculations: [], // Let the component initialize based on loaded data
    },
  },
  {
    id: "nx-mx-calculator-1",
    ...getModuleDefault(ModuleType.NxMxCalculator),
    position: { x: 1130, y: 220 },
    parameters: {
      nxCalculations: [
        {
          id: "nx-calc-initial",
          baseColumn: "Dx_Male_Mortality",
          name: "Male_Mortality",
        },
      ],
      mxCalculations: [], // Let the component initialize based on loaded data
    },
  },
  {
    id: "premium-component-1",
    ...getModuleDefault(ModuleType.PremiumComponent),
    position: { x: 860, y: 220 },
    parameters: {
      nnxCalculations: [
        {
          id: "nnx-calc-initial",
          nxColumn: "Nx_Male_Mortality",
          dxColumn: "", // Will be selected by user
        },
      ],
      sumxCalculations: [], // Let the component initialize based on loaded data
    },
  },
  {
    id: "additional-name-1",
    ...getModuleDefault(ModuleType.AdditionalName),
    position: { x: 590, y: 320 }, // Initial position adjusted
    parameters: {
      basicValues: [
        { name: "α1", value: 0 },
        { name: "α2", value: 0 },
        { name: "β1", value: 0 },
        { name: "β2", value: 0 },
        { name: "γ", value: 0 },
      ],
      definitions: [],
    },
  },
  {
    id: "net-premium-calculator-1",
    ...getModuleDefault(ModuleType.NetPremiumCalculator),
    position: { x: 320, y: 220 },
    parameters: {
      // 기본 상류 출력(베이스명 "Male_Mortality")과 일치하도록 동기화.
      // 이전 값 "[BPV_Mortality] / [NNX_Mortality(Year)]" 은 상류가 만들지 않는
      // 토큰을 참조하여 첫 Run All 즉시 실패의 원인이었음(UX P0).
      formula: "[BPV_Male_Mortality] / [NNX_Male_Mortality(Year)]",
      variableName: "PP",
    },
  },
  {
    id: "gross-premium-calculator-1",
    ...getModuleDefault(ModuleType.GrossPremiumCalculator),
    position: { x: 50, y: 400 },
    parameters: {
      formula: "[PP] / (1 - 0.0)",
      variableName: "GP",
    },
  },
  {
    id: "reserve-calculator-1",
    ...getModuleDefault(ModuleType.ReserveCalculator),
    position: { x: 320, y: 400 },
    parameters: {
      // 첫 Run All이 끝까지 성공하도록 유효한 기본 수식("0" = 준비금 0)을 제공한다(UX P0).
      // 빈 수식 2개이면 엔진이 "준비금 수식을 1개 이상 정의해야 합니다" 오류로 즉시 실패함.
      // 사용자는 자신의 준비금 산출식(예: 장래법/과거법)으로 교체하면 된다.
      formulaForPaymentTermOrLess: "0",
      formulaForGreaterThanPaymentTerm: "0",
      reserveColumnName: "Reserve",
    },
  },

  // Sidebar / Config modules (Unconnected)
  {
    id: "policy-1",
    ...getModuleDefault(ModuleType.DefinePolicyInfo),
    position: { x: 50, y: 50 },
    parameters: {
      riderName: "주계약",
      entryAge: 40,
      gender: "Male",
      policyTerm: "",
      paymentTerm: 10,
      interestRate: 2.5,
      maturityAge: 0,
      basicValues: [
        { name: "α1", value: 0 },
        { name: "α2", value: 0 },
        { name: "β1", value: 0 },
        { name: "β2", value: 0 },
        { name: "β'", value: 0 },
        { name: "γ",  value: 0 },
      ],
    },
  },
  {
    id: "scenario-runner-1",
    ...getModuleDefault(ModuleType.ScenarioRunner),
    position: { x: 70, y: 270 }, // Below policy info (moved down 50px + box padding 20px)
    parameters: {
      scenarios: [
        {
          id: "scen-1",
          variableName: "entryAge",
          targetModuleId: "policy-1",
          targetParameterName: "entryAge",
          values: "30-40",
        },
        {
          id: "scen-2",
          variableName: "gender",
          targetModuleId: "policy-1",
          targetParameterName: "gender",
          values: "Male, Female",
        },
        {
          id: "scen-3",
          variableName: "policyTerm",
          targetModuleId: "policy-1",
          targetParameterName: "policyTerm",
          values: "20, 30",
        },
        {
          id: "scen-mat",
          variableName: "maturityAge",
          targetModuleId: "policy-1",
          targetParameterName: "maturityAge",
          values: "0",
        },
        {
          id: "scen-4",
          variableName: "paymentTerm",
          targetModuleId: "policy-1",
          targetParameterName: "paymentTerm",
          values: "20, 30",
        },
      ],
    },
  },
  {
    id: "explainer-1",
    ...getModuleDefault(ModuleType.PipelineExplainer),
    position: { x: 70, y: 450 }, // Below scenario runner (box height 160 + spacing 20 = 180px gap)
  },
];

const initialConnections: Connection[] = lifxConnections.length > 0 ? lifxConnections : [
  {
    id: "conn-1",
    from: { moduleId: "load-1", portName: "data_out" },
    to: { moduleId: "select-rates-1", portName: "risk_data_in" },
  },
  {
    id: "conn-3",
    from: { moduleId: "select-rates-1", portName: "selected_rates_out" },
    to: { moduleId: "select-data-1", portName: "data_in" },
  },
  {
    id: "conn-3-1",
    from: { moduleId: "select-data-1", portName: "data_out" },
    to: { moduleId: "rate-modifier-1", portName: "data_in" },
  },
  {
    id: "conn-4",
    from: { moduleId: "rate-modifier-1", portName: "data_out" },
    to: { moduleId: "survivors-1", portName: "data_in" },
  },
  {
    id: "conn-5",
    from: { moduleId: "survivors-1", portName: "data_out" },
    to: { moduleId: "claims-1", portName: "data_in" },
  },
  {
    id: "conn-6",
    from: { moduleId: "claims-1", portName: "data_out" },
    to: { moduleId: "nx-mx-calculator-1", portName: "data_in" },
  },
  {
    id: "conn-8",
    from: { moduleId: "nx-mx-calculator-1", portName: "data_out" },
    to: { moduleId: "premium-component-1", portName: "data_in" },
  },
  {
    id: "conn-10",
    from: {
      moduleId: "premium-component-1",
      portName: "premium_components_out",
    },
    to: {
      moduleId: "additional-name-1",
      portName: "premium_components_in",
    },
  },
  {
    id: "conn-10-1",
    from: {
      moduleId: "additional-name-1",
      portName: "output",
    },
    to: {
      moduleId: "net-premium-calculator-1",
      portName: "additional_variables_in",
    },
  },
  {
    id: "conn-12",
    from: { moduleId: "net-premium-calculator-1", portName: "premium_out" },
    to: { moduleId: "gross-premium-calculator-1", portName: "net_premium_in" },
  },
  {
    id: "conn-13",
    from: {
      moduleId: "gross-premium-calculator-1",
      portName: "gross_premium_out",
    },
    to: { moduleId: "reserve-calculator-1", portName: "gross_premium_in" },
  },
];

// PREDEFINED_SAMPLES removed - samples are now loaded from /samples/samples.json

// Load initial state from localStorage
const loadInitialState = (): {
  modules: CanvasModule[];
  connections: Connection[];
} | null => {
  try {
    const saved = localStorage.getItem("lifeMatrixFlow_initialState");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.modules && parsed.connections) {
        // Restore separately stored fileContents
        let fileContents: Record<string, string> = {};
        try {
          const fc = localStorage.getItem("lifeMatrixFlow_fileContents");
          if (fc) fileContents = JSON.parse(fc);
        } catch {}
        const modules = parsed.modules.map((m: any) => {
          if (m.parameters?.fileContent === "__STORED_SEPARATELY__" && fileContents[m.id]) {
            return { ...m, parameters: { ...m.parameters, fileContent: fileContents[m.id] } };
          }
          return m;
        });
        return { modules, connections: parsed.connections };
      }
    }
  } catch (error) {
    console.error("Failed to load initial state from localStorage:", error);
  }
  return null;
};

// Save initial state to localStorage
// Large fileContent values are stored separately to avoid 5MB limit
const INITIAL_STATE_KEY = "lifeMatrixFlow_initialState";
const FILE_CONTENT_KEY = "lifeMatrixFlow_fileContents";

const saveInitialState = (
  modules: CanvasModule[],
  connections: Connection[]
): boolean => {
  try {
    // Extract large fileContent values separately
    const fileContents: Record<string, string> = {};
    const cleanModules = modules.map((m) => {
      const { outputData, ...moduleWithoutOutput } = m;
      const params = { ...(m.parameters || {}) };
      if (params.fileContent && typeof params.fileContent === "string" && params.fileContent.length > 10000) {
        fileContents[m.id] = params.fileContent;
        params.fileContent = "__STORED_SEPARATELY__";
      }
      return {
        ...moduleWithoutOutput,
        status: ModuleStatus.Pending,
        parameters: params,
      };
    });
    // Save file contents separately
    if (Object.keys(fileContents).length > 0) {
      localStorage.setItem(FILE_CONTENT_KEY, JSON.stringify(fileContents));
    }
    localStorage.setItem(
      INITIAL_STATE_KEY,
      JSON.stringify({ modules: cleanModules, connections })
    );
    return true;
  } catch (error) {
    console.error("Failed to save initial state to localStorage:", error);
    return false;
  }
};

// ── 출력 이름 변경 추적 헬퍼 ──────────────────────────────────────────────────

/**
 * 모듈 저장 전후 파라미터를 비교하여 출력 컬럼명 변경 맵을 반환한다.
 * 예: CalculateSurvivors에서 name "Mortality"→"Custom" 이면
 *   "lx_Mortality"→"lx_Custom", "Dx_Mortality"→"Dx_Custom"
 */
function getColumnNameChanges(
  moduleType: ModuleType,
  oldParams: Record<string, any>,
  newParams: Record<string, any>
): Map<string, string> {
  const changes = new Map<string, string>();

  if (moduleType === ModuleType.CalculateSurvivors) {
    const oldCalcs: any[] = oldParams.calculations ?? [];
    const newCalcs: any[] = newParams.calculations ?? [];
    for (const oldCalc of oldCalcs) {
      const newCalc = newCalcs.find((c) => c.id === oldCalc.id);
      if (newCalc && oldCalc.name !== newCalc.name) {
        changes.set(`lx_${oldCalc.name}`, `lx_${newCalc.name}`);
        changes.set(`Dx_${oldCalc.name}`, `Dx_${newCalc.name}`);
      }
    }
  } else if (moduleType === ModuleType.ClaimsCalculator) {
    const oldCalcs: any[] = oldParams.calculations ?? [];
    const newCalcs: any[] = newParams.calculations ?? [];
    for (const oldCalc of oldCalcs) {
      const newCalc = newCalcs.find((c) => c.id === oldCalc.id);
      if (newCalc && oldCalc.name !== newCalc.name) {
        changes.set(`dx_${oldCalc.name}`, `dx_${newCalc.name}`);
        changes.set(`Cx_${oldCalc.name}`, `Cx_${newCalc.name}`);
      }
    }
  } else if (moduleType === ModuleType.NxMxCalculator) {
    const oldNxCalcs: any[] = oldParams.nxCalculations ?? [];
    const newNxCalcs: any[] = newParams.nxCalculations ?? [];
    for (const oldCalc of oldNxCalcs) {
      const newCalc = newNxCalcs.find((c) => c.id === oldCalc.id);
      if (newCalc && oldCalc.name !== newCalc.name) {
        changes.set(`Nx_${oldCalc.name}`, `Nx_${newCalc.name}`);
      }
    }
    const oldMxCalcs: any[] = oldParams.mxCalculations ?? [];
    const newMxCalcs: any[] = newParams.mxCalculations ?? [];
    for (const oldCalc of oldMxCalcs) {
      const newCalc = newMxCalcs.find((c) => c.id === oldCalc.id);
      if (newCalc && oldCalc.name !== newCalc.name) {
        changes.set(`Mx_${oldCalc.name}`, `Mx_${newCalc.name}`);
      }
    }
  }

  return changes;
}

/**
 * 컬럼명 변경 맵을 다운스트림 모듈의 파라미터에 적용한다.
 * 변경이 없으면 동일한 params 객체를 반환한다.
 */
function applyColumnNameChanges(
  moduleType: ModuleType,
  params: Record<string, any>,
  nameChanges: Map<string, string>
): Record<string, any> {
  if (nameChanges.size === 0) return params;

  const rename = (col: string): string => nameChanges.get(col) ?? col;

  if (moduleType === ModuleType.ClaimsCalculator) {
    const calcs: any[] = params.calculations ?? [];
    const updatedCalcs = calcs.map((c) => {
      const newLx = rename(c.lxColumn);
      return newLx !== c.lxColumn ? { ...c, lxColumn: newLx } : c;
    });
    if (updatedCalcs.some((c, i) => c !== calcs[i])) {
      return { ...params, calculations: updatedCalcs };
    }
  } else if (moduleType === ModuleType.NxMxCalculator) {
    const nxCalcs: any[] = params.nxCalculations ?? [];
    const mxCalcs: any[] = params.mxCalculations ?? [];
    const updatedNx = nxCalcs.map((c) => {
      const newBase = rename(c.baseColumn);
      return newBase !== c.baseColumn ? { ...c, baseColumn: newBase } : c;
    });
    const updatedMx = mxCalcs.map((c) => {
      const newBase = rename(c.baseColumn);
      return newBase !== c.baseColumn ? { ...c, baseColumn: newBase } : c;
    });
    if (
      updatedNx.some((c, i) => c !== nxCalcs[i]) ||
      updatedMx.some((c, i) => c !== mxCalcs[i])
    ) {
      return { ...params, nxCalculations: updatedNx, mxCalculations: updatedMx };
    }
  } else if (moduleType === ModuleType.PremiumComponent) {
    const nnxCalcs: any[] = params.nnxCalculations ?? [];
    const sumxCalcs: any[] = params.sumxCalculations ?? [];
    const updatedNnx = nnxCalcs.map((c) => {
      const newNx = rename(c.nxColumn);
      return newNx !== c.nxColumn ? { ...c, nxColumn: newNx } : c;
    });
    const updatedSumx = sumxCalcs.map((c) => {
      const newMx = rename(c.mxColumn);
      return newMx !== c.mxColumn ? { ...c, mxColumn: newMx } : c;
    });
    if (
      updatedNnx.some((c, i) => c !== nnxCalcs[i]) ||
      updatedSumx.some((c, i) => c !== sumxCalcs[i])
    ) {
      return { ...params, nnxCalculations: updatedNnx, sumxCalculations: updatedSumx };
    }
  }

  return params;
}

// ─────────────────────────────────────────────────────────────────────────────

/** 고급(잠금) 기능 버튼의 호버 툴팁 내용. locked=true면 자물쇠·안내 문구 추가. */
function featureTip(title: string, desc: string, locked: boolean): React.ReactNode {
  return (
    <>
      <span className={`font-bold ${locked ? "text-amber-300" : "text-white"}`}>
        {locked ? "🔒 " : ""}
        {title}
      </span>
      <span className="block mt-0.5 text-gray-200">{desc}</span>
      {locked && (
        <span className="block mt-1 text-[10px] text-amber-200/90">
          클릭하면 잠금 해제 창이 열립니다
        </span>
      )}
    </>
  );
}

const App: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { ensureClient, hasKey, openKeyModal } = useApiKey();
  const {
    isUnlocked: advUnlocked,
    openUnlockModal: openAdvModal,
  } = useAdvancedAccess();
  // Shared samples (from files, shared across all users)
  const [sharedSamples, setSharedSamples] = useState<SampleData[]>([]);
  
  // Personal work (from localStorage, user-specific)
  const [personalWork, setPersonalWork] = useState<SampleData[]>(() =>
    loadPersonalWork()
  );

  // Load shared samples on mount
  useEffect(() => {
    loadSharedSamples().then((samples) => {
      setSharedSamples(samples);
    });
  }, []);

  // Load initial state from localStorage if available
  const loadedInitialState = useMemo(() => loadInitialState(), []);
  const initialModulesToUse = loadedInitialState?.modules || initialModules;
  const initialConnectionsToUse =
    loadedInitialState?.connections || initialConnections;

  const [modules, setModules, undo, redo, resetModules, canUndo, canRedo] =
    useHistoryState<CanvasModule[]>(initialModulesToUse);
  const [connections, _setConnections] = useState<Connection[]>(
    initialConnectionsToUse
  );
  
  // Load initial model from "종신보험" sample if no localStorage state and modules are empty
  const initialModelLoadedRef = useRef(false);
  useEffect(() => {
    if (!initialModelLoadedRef.current && !loadedInitialState && modules.length === 0 && initialModules.length === 0) {
      initialModelLoadedRef.current = true;
      loadSharedSamples().then((samples) => {
        const sample = samples.find((s) => s.name === "종신보험");
        if (sample && sample.modules && sample.connections) {
          // Convert JSON modules to CanvasModule format
          const convertedModules: CanvasModule[] = sample.modules.map((m: any) => ({
            id: m.id,
            type: m.type as ModuleType,
            name: m.name || "",
            status: (m.status as ModuleStatus) || ModuleStatus.Pending,
            parameters: m.parameters || {},
            inputs: m.inputs || [],
            outputs: m.outputs || [],
            position: m.position || { x: 0, y: 0 },
            outputData: m.outputData,
          }));
          const convertedConnections: Connection[] = sample.connections.map((c: any) => ({
            id: c.id,
            from: c.from,
            to: c.to,
          }));
          // Set modules and connections
          resetModules(convertedModules);
          _setConnections(convertedConnections);
          setProductName(sample.name || "New Life Product");
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedInitialState, modules.length, initialModules.length]);

  // 페이지 종료 시 현재 상태를 자동 저장 (항상 마지막 작업 상태로 복원)
  const modulesRef = useRef(modules);
  const connectionsRef = useRef(connections);
  useEffect(() => { modulesRef.current = modules; }, [modules]);
  useEffect(() => { connectionsRef.current = connections; }, [connections]);
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveInitialState(modulesRef.current, connectionsRef.current);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const [selectedModuleIds, setSelectedModuleIds] = useState<string[]>([]);
  const [productName, setProductName] = useState("New Life Product");
  const [isEditingProductName, setIsEditingProductName] = useState(false);
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  const [pendingSample, setPendingSample] = useState<SampleData | null>(null);
  const [overwriteContext, setOverwriteContext] = useState<'shared' | 'personal' | null>(null);

  // 모델 저장 옵션 모달(데이터 포함/제외/웹 등록/설명)
  const [saveOptions, setSaveOptions] = useState<{
    open: boolean;
    mode: 'mywork';
    name: string;
    loaders: LoaderDataInfo[];
  }>({ open: false, mode: 'mywork', name: '', loaders: [] });
  const [isSavingModel, setIsSavingModel] = useState(false);

  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [viewingDataForModule, setViewingDataForModule] =
    useState<CanvasModule | null>(null);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);

  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const folderHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const [clipboard, setClipboard] = useState<{
    modules: CanvasModule[];
    connections: Connection[];
  } | null>(null);
  const pasteOffset = useRef(0);

  const [isDirty, setIsDirty] = useState(false);
  const [saveButtonText, setSaveButtonText] = useState("저장");
  const [initialSavedToast, setInitialSavedToast] = useState<string | null>(null);

  // 온보딩 가이드: 첫 방문(또는 닫기 전)에 4단계 산출 순서를 안내. localStorage로 재표시 억제.
  const ONBOARDING_KEY = "lifeMatrixFlow_onboardingDismissed";
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    try {
      return localStorage.getItem(ONBOARDING_KEY) !== "1";
    } catch {
      return true;
    }
  });
  const dismissOnboarding = useCallback((remember: boolean) => {
    setShowOnboarding(false);
    if (remember) {
      try {
        localStorage.setItem(ONBOARDING_KEY, "1");
      } catch {
        /* localStorage 불가 환경 무시 */
      }
    }
  }, []);

  // 범용 토스트(실행 결과·연결 거부 등 비차단 알림). 기존 alert 흐름 단절을 대체.
  const [toast, setToast] = useState<
    | {
        message: string;
        kind: "info" | "success" | "error" | "warning";
        actionLabel?: string;
        onAction?: () => void;
      }
    | null
  >(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback(
    (
      message: string,
      kind: "info" | "success" | "error" | "warning" = "info",
      opts?: { durationMs?: number; actionLabel?: string; onAction?: () => void }
    ) => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      setToast({ message, kind, actionLabel: opts?.actionLabel, onAction: opts?.onAction });
      const duration = opts?.durationMs ?? (kind === "error" ? 6000 : 3500);
      toastTimerRef.current = setTimeout(() => setToast(null), duration);
    },
    []
  );

  // 전역 실행 상태(Run All 버튼 로딩/진행 표시용)
  const [isRunning, setIsRunning] = useState(false);
  const [runProgress, setRunProgress] = useState<{ done: number; total: number } | null>(null);

  // Canvas tabs: multiple canvases with add/rename
  const [tabs, setTabs] = useState<{ id: string; name: string; backgroundColor?: string }[]>([{ id: "tab-1", name: "Tab 1" }]);
  const [activeTabId, setActiveTabId] = useState<string>("tab-1");
  const tabContentsRef = useRef<Record<string, { modules: CanvasModule[]; connections: Connection[]; scale: number; pan: { x: number; y: number }; selectedModuleIds: string[] }>>({});
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabName, setEditingTabName] = useState("");
  const prevActiveTabIdRef = useRef<string>("tab-1");
  const [tabContextMenu, setTabContextMenu] = useState<{ tabId: string; x: number; y: number } | null>(null);
  const tabContextMenuRef = useRef<HTMLDivElement>(null);

  const [isCodePanelVisible, setIsCodePanelVisible] = useState(false);
  const [terminalOutputs, setTerminalOutputs] = useState<
    Record<string, string[]>
  >({});

  // Controls Panel State
  const [controlsPosition, setControlsPosition] = useState({ x: 0, y: 0 });
  const isDraggingControls = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  const hasInitialRearranged = useRef(false);
  // DSL 빌드 후 Auto Layout 트리거 플래그
  const pendingRearrangeAfterDSL = useRef(false);

  const [isSamplesMenuOpen, setIsSamplesMenuOpen] = useState(false);
  const [isSampleMenuOpen, setIsSampleMenuOpen] = useState(false);
  const [isSamplesManagementOpen, setIsSamplesManagementOpen] = useState(false);
  const [isPolicySetupModalOpen, setIsPolicySetupModalOpen] = useState(false);
  const [isDSLModalOpen, setIsDSLModalOpen] = useState(false);
  const [folderSamples, setFolderSamples] = useState<
    Array<{
      id?: number | string;
      modelId?: string;
      filename: string;
      name: string;
      data: any;
      inputData?: string;
      description?: string;
      category?: string;
      appSection?: string;
      developerEmail?: string;
      // 강화된 샘플 메타데이터 (선택, 후방호환 — samples-metadata.json에서 병합)
      tags?: string[];
      dataFile?: string;
      expectedOutput?: string;
      insuranceType?: string;
      actuarialBasis?: string;
      expectedPremium?: string;
    }>
  >([]);
  const [isLoadingSamples, setIsLoadingSamples] = useState(false);
  const [isMyWorkMenuOpen, setIsMyWorkMenuOpen] = useState(false);
  
  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        !target.closest('.samples-menu-container') &&
        !target.closest('.my-work-menu-container')
      ) {
        setIsSamplesMenuOpen(false);
        setIsMyWorkMenuOpen(false);
      }
    };

    if (isSamplesMenuOpen || isMyWorkMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isSamplesMenuOpen, isMyWorkMenuOpen]);
  
  const [isToolboxExpanded, setIsToolboxExpanded] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set()
  );
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isPipelineExecutionModalOpen, setIsPipelineExecutionModalOpen] =
    useState(false);
  const [isAIGoalModalOpen, setIsAIGoalModalOpen] = useState(false);
  const [aiGeneratedPlan, setAiGeneratedPlan] = useState<string>('');
  const [isAIPlanModalOpen, setIsAIPlanModalOpen] = useState(false);
  const [isGeneratingPipeline, setIsGeneratingPipeline] = useState(false);

  const setConnections = useCallback(
    (value: React.SetStateAction<Connection[]>) => {
      _setConnections(value);
      setIsDirty(true);
    },
    []
  );

  const saveCurrentTabContent = useCallback(() => {
    tabContentsRef.current[activeTabId] = {
      modules: JSON.parse(JSON.stringify(modules)),
      connections: JSON.parse(JSON.stringify(connections)),
      scale,
      pan: { ...pan },
      selectedModuleIds: [...selectedModuleIds],
    };
  }, [activeTabId, modules, connections, scale, pan, selectedModuleIds]);

  useEffect(() => {
    if (prevActiveTabIdRef.current === activeTabId) return;
    const data = tabContentsRef.current[activeTabId];
    if (data) {
      resetModules(data.modules);
      _setConnections(data.connections);
      setScale(data.scale);
      setPan(data.pan);
      setSelectedModuleIds(data.selectedModuleIds);
    } else {
      resetModules([]);
      _setConnections([]);
      setScale(1);
      setPan({ x: 0, y: 0 });
      setSelectedModuleIds([]);
    }
    prevActiveTabIdRef.current = activeTabId;
  }, [activeTabId, resetModules]);

  const handleTabClick = useCallback((tabId: string) => {
    if (tabId === activeTabId) return;
    saveCurrentTabContent();
    setActiveTabId(tabId);
  }, [activeTabId, saveCurrentTabContent]);

  const handleAddTab = useCallback(() => {
    saveCurrentTabContent();
    const newId = `tab-${Date.now()}`;
    setTabs((prev) => [...prev, { id: newId, name: `Tab ${prev.length + 1}` }]);
    setActiveTabId(newId);
  }, [saveCurrentTabContent]);

  const handleTabRename = useCallback((tabId: string, newName: string) => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, name: newName.trim() || t.name } : t)));
    setEditingTabId(null);
  }, []);

  const handleDeleteTab = useCallback((tabId: string) => {
    if (tabs.length <= 1) return;
    saveCurrentTabContent();
    const nextTabs = tabs.filter((t) => t.id !== tabId);
    delete tabContentsRef.current[tabId];
    if (activeTabId === tabId) {
      const idx = tabs.findIndex((t) => t.id === tabId);
      const newActiveId = (idx > 0 ? tabs[idx - 1] : nextTabs[0])?.id;
      if (newActiveId) {
        setActiveTabId(newActiveId);
        prevActiveTabIdRef.current = newActiveId;
      }
    }
    setTabs(nextTabs);
    setTabContextMenu(null);
  }, [activeTabId, tabs, saveCurrentTabContent]);

  const handleTabBackgroundColor = useCallback((tabId: string, color: string | undefined) => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, backgroundColor: color } : t)));
    setTabContextMenu(null);
  }, []);

  useEffect(() => {
    if (!tabContextMenu) return;
    const close = (e: MouseEvent) => {
      if (tabContextMenuRef.current?.contains(e.target as Node)) return;
      setTabContextMenu(null);
    };
    document.addEventListener("click", close, true);
    return () => document.removeEventListener("click", close, true);
  }, [tabContextMenu]);

  // Additional Variables 모듈의 원래 상태를 저장하기 위한 ref
  // 모든 모듈의 편집 전 상태를 저장 (취소 시 복원용)
  const moduleInitialStateRef = useRef<Map<string, {
    parameters: Record<string, any>;
    status: ModuleStatus;
    outputData: any;
    downstreamStates: Map<string, { status: ModuleStatus; outputData: any }>;
  }>>(new Map());

  // 하위 호환성을 위한 별칭
  const additionalVariablesInitialStateRef = moduleInitialStateRef;

  const handleEditParameters = useCallback((moduleId: string) => {
    const module = modules.find((m) => m.id === moduleId);
    if (!module) { setEditingModuleId(moduleId); return; }

    // 편집 전 상태 저장 (모든 모듈)
    const adj: Record<string, string[]> = {};
    connections.forEach((conn) => {
      if (!adj[conn.from.moduleId]) adj[conn.from.moduleId] = [];
      adj[conn.from.moduleId].push(conn.to.moduleId);
    });

    const downstreamStates = new Map<string, { status: ModuleStatus; outputData: any }>();
    const queue = [moduleId];
    const visited = new Set<string>();
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      (adj[currentId] || []).forEach((childId) => {
        const childModule = modules.find((m) => m.id === childId);
        if (childModule) {
          downstreamStates.set(childId, {
            status: childModule.status,
            outputData: childModule.outputData,
          });
          queue.push(childId);
        }
      });
    }

    moduleInitialStateRef.current.set(moduleId, {
      parameters: JSON.parse(JSON.stringify(module.parameters)),
      status: module.status,
      outputData: module.outputData,
      downstreamStates,
    });

    setEditingModuleId(moduleId);
  }, [modules, connections]);

  // 현재 편집 중인 모듈 ID를 ref로도 유지 (updateModuleParameters 내부에서 동기 접근)
  const editingModuleIdRef = useRef<string | null>(null);
  useEffect(() => {
    editingModuleIdRef.current = editingModuleId;
  }, [editingModuleId]);

  const editingModule = useMemo(() => {
    return modules.find((m) => m.id === editingModuleId) || null;
  }, [modules, editingModuleId]);

  const handleFitToView = useCallback(() => {
    if (!canvasContainerRef.current) return;
    const canvasRect = canvasContainerRef.current.getBoundingClientRect();

    if (modules.length === 0) {
      setPan({ x: 0, y: 0 });
      setScale(1);
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    const moduleWidth = 224; // w-56
    const moduleHeight = 80; // approximate height

    modules.forEach((module) => {
      minX = Math.min(minX, module.position.x);
      minY = Math.min(minY, module.position.y);
      maxX = Math.max(maxX, module.position.x + moduleWidth);
      maxY = Math.max(maxY, module.position.y + moduleHeight);
    });

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    const padding = 50;
    const scaleX = (canvasRect.width - padding * 2) / contentWidth;
    const scaleY = (canvasRect.height - padding * 2) / contentHeight;
    // 노드 텍스트가 식별 불가능할 정도로 과도하게 축소(이전 14%)되는 것을 방지하기 위해
    // 하한 0.4를 둔다. 일부 노드가 화면 밖이어도 최소 가독성을 우선(UX P2).
    const newScale = Math.max(0.4, Math.min(scaleX, scaleY, 1));

    const newPanX =
      (canvasRect.width - contentWidth * newScale) / 2 - minX * newScale;
    const newPanY =
      (canvasRect.height - contentHeight * newScale) / 2 - minY * newScale;

    setScale(newScale);
    setPan({ x: newPanX, y: newPanY });
  }, [modules]);

  // 특정 노드를 화면 중앙으로 이동(pan). 실패/선택 노드가 화면 밖일 때 사용(UX P1).
  const centerOnModule = useCallback(
    (moduleId: string) => {
      if (!canvasContainerRef.current) return;
      const target = modules.find((m) => m.id === moduleId);
      if (!target) return;
      const canvasRect = canvasContainerRef.current.getBoundingClientRect();
      const moduleWidth = 224;
      const moduleHeight = 80;
      setScale((prevScale) => {
        const s = prevScale;
        const newPanX =
          canvasRect.width / 2 - (target.position.x + moduleWidth / 2) * s;
        const newPanY =
          canvasRect.height / 2 - (target.position.y + moduleHeight / 2) * s;
        setPan({ x: newPanX, y: newPanY });
        return prevScale;
      });
    },
    [modules]
  );

  const handleRearrangeModules = useCallback(() => {
    if (modules.length === 0) return;

    // 1. Identify unconnected and connected modules
    const allModuleIds = new Set(modules.map((m) => m.id));
    const inDegree: Record<string, number> = {};
    const outDegree: Record<string, number> = {};
    const adj: Record<string, string[]> = {}; // Adjacency list for traversing

    modules.forEach((m) => {
      inDegree[m.id] = 0;
      outDegree[m.id] = 0;
      adj[m.id] = [];
    });

    const connectionsToUse = connections.filter(
      (c) =>
        allModuleIds.has(c.from.moduleId) && allModuleIds.has(c.to.moduleId)
    );

    connectionsToUse.forEach((conn) => {
      adj[conn.from.moduleId].push(conn.to.moduleId);
      inDegree[conn.to.moduleId]++;
      outDegree[conn.from.moduleId]++;
    });

    const unconnectedModuleIds = modules
      .filter((m) => inDegree[m.id] === 0 && outDegree[m.id] === 0)
      .map((m) => m.id);

    const connectedModuleIds = modules
      .filter((m) => !unconnectedModuleIds.includes(m.id))
      .map((m) => m.id);

    // 2. Compute Levels (Topological Depth) for Connected Modules
    // Simple longest path algorithm for DAGs
    const levels: Record<string, number> = {};

    const computeLevel = (id: string, visited: Set<string>): number => {
      if (levels[id] !== undefined) return levels[id];
      if (visited.has(id)) return 0; // Break cycle safely

      visited.add(id);

      // Find parents
      const parents = connectionsToUse
        .filter((c) => c.to.moduleId === id)
        .map((c) => c.from.moduleId);

      if (parents.length === 0) {
        levels[id] = 0;
      } else {
        let maxParentLevel = -1;
        parents.forEach((pid) => {
          maxParentLevel = Math.max(
            maxParentLevel,
            computeLevel(pid, new Set(visited))
          );
        });
        levels[id] = maxParentLevel + 1;
      }
      return levels[id];
    };

    connectedModuleIds.forEach((id) => computeLevel(id, new Set()));

    // 3. Group nodes by Level
    const levelGroups: Record<number, string[]> = {};
    let maxLevel = 0;

    Object.entries(levels).forEach(([id, lvl]) => {
      if (!connectedModuleIds.includes(id)) return;
      if (!levelGroups[lvl]) levelGroups[lvl] = [];
      levelGroups[lvl].push(id);
      maxLevel = Math.max(maxLevel, lvl);
    });

    // 4. Layout Configuration
    const newModules = [...modules];
    const moduleWidth = 224;
    const moduleHeight = 80; // Height of module card
    const colSpacing = 60; // Horizontal gap
    const rowSpacing = 40; // Vertical gap between stacked items
    const initialX = 50;
    const initialY = 50;
    const groupGap = 100;

    // --- Place Unconnected Modules (Left Column) ---
    // Separate ScenarioRunner and PipelineExplainer from other unconnected modules
    const specialModuleIds = unconnectedModuleIds.filter((id) => {
      const module = newModules.find((m) => m.id === id);
      return (
        module &&
        (module.type === ModuleType.ScenarioRunner ||
          module.type === ModuleType.PipelineExplainer)
      );
    });
    const regularUnconnectedIds = unconnectedModuleIds.filter(
      (id) => !specialModuleIds.includes(id)
    );

    let maxX_Unconnected = initialX;
    let regularUnconnectedY = initialY;

    // Place regular unconnected modules first
    if (regularUnconnectedIds.length > 0) {
      regularUnconnectedIds.forEach((moduleId, index) => {
        const moduleIndex = newModules.findIndex((m) => m.id === moduleId);
        if (moduleIndex !== -1) {
          const x = initialX;
          const y = initialY + index * (moduleHeight + rowSpacing);
          newModules[moduleIndex].position = { x, y };
          regularUnconnectedY = y + moduleHeight + rowSpacing;
        }
      });
      maxX_Unconnected += moduleWidth;
    } else {
      maxX_Unconnected = initialX - groupGap; // Reset if empty
    }

    // Place special modules (ScenarioRunner and PipelineExplainer) 50px below regular unconnected modules
    // Account for box padding (20px) for special modules
    const boxPadding = 20;
    const specialModuleHeight = 120; // Increased height for special modules
    const boxHeight = specialModuleHeight + boxPadding * 2; // Total box height: 160px
    const minBoxSpacing = 20; // Minimum spacing between boxes to prevent overlap
    if (specialModuleIds.length > 0) {
      const specialModuleYStart = regularUnconnectedY + 50 + boxPadding;
      specialModuleIds.forEach((moduleId, index) => {
        const moduleIndex = newModules.findIndex((m) => m.id === moduleId);
        if (moduleIndex !== -1) {
          const x = initialX + boxPadding;
          // Calculate Y position ensuring boxes don't overlap
          // Each box needs boxHeight + minBoxSpacing space
          const y = specialModuleYStart + index * (boxHeight + minBoxSpacing);
          newModules[moduleIndex].position = { x, y };
        }
      });
      if (maxX_Unconnected < initialX) {
        maxX_Unconnected = initialX + moduleWidth + boxPadding * 2;
      }
    }

    // --- Place Connected Modules (Layered Layout) ---
    const startX_Connected = maxX_Unconnected + groupGap;

    // Sort groups to minimize crossing (Heuristic: Average Y of parents)
    // We process levels 1..N
    for (let l = 1; l <= maxLevel; l++) {
      if (!levelGroups[l]) continue;
      levelGroups[l].sort((a, b) => {
        const getAvgParentY = (nodeId: string) => {
          const parents = connectionsToUse
            .filter((c) => c.to.moduleId === nodeId)
            .map((c) => c.from.moduleId);
          if (parents.length === 0) return 0;
          const parentYs = parents.map((pid) => {
            const pm = newModules.find((m) => m.id === pid);
            return pm ? pm.position.y : 0;
          });
          return parentYs.reduce((sum, y) => sum + y, 0) / parentYs.length;
        };
        return getAvgParentY(a) - getAvgParentY(b);
      });
    }

    // If level 0 has multiple inputs, spread them out first
    if (levelGroups[0]) {
      // Keep them in current ID order or existing Y order if possible?
      // Just ID order for stability or preserve array order
    }

    // 5. Assign coordinates with 5-column wrapping logic
    const COLUMNS_PER_ROW = 5;
    const COLUMN_WIDTH = moduleWidth + colSpacing;

    // We need to track the Y-offset for each "Row of Columns"
    let currentYBase = initialY;

    for (
      let rowStartLevel = 0;
      rowStartLevel <= maxLevel;
      rowStartLevel += COLUMNS_PER_ROW
    ) {
      let maxStackHeightInRow = 0;

      // First pass: determine max height needed for this row of columns
      for (let l = rowStartLevel; l < rowStartLevel + COLUMNS_PER_ROW; l++) {
        if (levelGroups[l]) {
          const stackHeight =
            levelGroups[l].length * (moduleHeight + rowSpacing);
          maxStackHeightInRow = Math.max(maxStackHeightInRow, stackHeight);
        }
      }

      // Second pass: Place nodes
      for (let l = rowStartLevel; l < rowStartLevel + COLUMNS_PER_ROW; l++) {
        if (!levelGroups[l]) continue;

        const group = levelGroups[l];
        const colIndex = l % COLUMNS_PER_ROW;
        const x = startX_Connected + colIndex * COLUMN_WIDTH;

        // Place stacked items
        group.forEach((moduleId, stackIndex) => {
          const moduleIndex = newModules.findIndex((m) => m.id === moduleId);
          if (moduleIndex !== -1) {
            // Simple stacking from top of the row base
            const y = currentYBase + stackIndex * (moduleHeight + rowSpacing);
            newModules[moduleIndex].position = { x, y };
          }
        });
      }

      // Advance Y base for the next row of columns
      currentYBase += maxStackHeightInRow + 80; // Extra padding between graph rows
    }

    setModules(newModules);
    setIsDirty(true);
    setTimeout(() => handleFitToView(), 0);
  }, [modules, connections, setModules, handleFitToView]);

  // Auto rearrange on start and fit to view
  useEffect(() => {
    if (!hasInitialRearranged.current && modules.length > 0) {
      setTimeout(() => {
        handleRearrangeModules();
        hasInitialRearranged.current = true;
        // Fit to view after rearrangement
        setTimeout(() => {
          handleFitToView();
        }, 200);
      }, 100);
    }
  }, [handleRearrangeModules, handleFitToView]);

  // DSL 빌드 후 Auto Layout 실행
  // modules + connections 양쪽이 갱신된 render에서 effect가 실행되므로 stale closure 없음
  useEffect(() => {
    if (!pendingRearrangeAfterDSL.current || modules.length === 0) return;
    pendingRearrangeAfterDSL.current = false;
    // 같은 이벤트에서 일어난 두 setState가 별도 render를 만들 경우를 대비해
    // 한 tick 뒤에 실행하여 connections까지 반영된 handleRearrangeModules 호출
    const t = setTimeout(() => handleRearrangeModules(), 0);
    return () => clearTimeout(t);
  }, [modules, connections, handleRearrangeModules]);

  const handleSavePipeline = useCallback(async () => {
    try {
      // Ensure all modules include their parameters when saving
      const modulesWithParameters = modules.map((m) => ({
        ...m,
        parameters: m.parameters || {}, // Ensure parameters exist
      }));
      const pipelineState = {
        modules: modulesWithParameters,
        connections,
        productName,
      };

      await savePipeline(pipelineState, {
        extension: ".lifx",
        description: "Life Matrix File",
        onSuccess: (fileName) => {
          setIsDirty(false);
          setSaveButtonText("저장됨!");
          setTimeout(() => setSaveButtonText("저장"), 2000);
        },
        onError: (error) => {
          console.error("Failed to save pipeline:", error);
          alert(`파일 저장 중 오류가 발생했습니다: ${error.message || error}`);
        },
      });
    } catch (error: any) {
      if (error.name !== "AbortError") {
        console.error("Failed to save pipeline:", error);
        alert(`파일 저장 중 오류가 발생했습니다: ${error.message || error}`);
      }
    }
  }, [modules, connections, productName]);

  const handleLoadPipeline = useCallback(async () => {
    const savedState = await loadPipeline({
      extension: ".lifx",
      onError: (error) => {
        console.error("Failed to load pipeline:", error);
      },
    });

    if (savedState) {
      if (savedState.modules && savedState.connections) {
        resetModules(savedState.modules);
        _setConnections(savedState.connections);
        if (savedState.productName) setProductName(savedState.productName);
        setSelectedModuleIds([]);
        setIsDirty(false);
      }
    }
  }, [resetModules]);

  const handleSetFolder = useCallback(async () => {
    try {
      if (!("showDirectoryPicker" in window)) {
        alert("Your browser does not support the File System Access API.");
        return;
      }
      const handle = await (window as any).showDirectoryPicker();
      folderHandleRef.current = handle;
    } catch (error: any) {
      if (error.name !== "AbortError") {
        console.error("Failed to set save folder:", error);
      }
    }
  }, []);

  const createCleanSample = useCallback((): SampleData => {
    return {
      name: productName,
      modules: modules.map((m) => {
        // Create a clean copy without outputData and with Pending status
        // Keep all parameters including selections, formulas, etc.
        const { outputData, ...moduleWithoutOutput } = m;
        return {
          ...moduleWithoutOutput,
          status: ModuleStatus.Pending,
          parameters: m.parameters || {}, // Ensure parameters are included
        };
      }),
      connections: connections,
    };
  }, [productName, modules, connections]);

  // Samples 목록: Supabase(우선) → samples.json 폴백 (로컬 Samples API 미사용)
  const loadFolderSamplesLocal = useCallback(async () => {
    setIsLoadingSamples(true);
    try {
      // 강화된 샘플 메타데이터(samples-metadata.json)를 읽어 목록에 후방호환적으로 병합.
      // 실패해도 목록 로딩에는 영향 없음(있을 때만 추가 표시).
      let sampleMetadata: Record<string, any> = {};
      try {
        const metaResp = await fetch("/samples/samples-metadata.json");
        if (metaResp.ok) {
          const meta = await metaResp.json();
          if (meta && typeof meta === "object") sampleMetadata = meta;
        }
      } catch {
        /* 메타데이터 없음/오류 — 무시 */
      }
      // 파일명 또는 "<name>.lifx"로 메타데이터 매칭하여 선택 필드만 병합
      const enrichWithMetadata = <T extends { filename?: string; name?: string }>(
        s: T
      ): T => {
        const key =
          (s.filename && sampleMetadata[s.filename]) ||
          (s.name && sampleMetadata[`${s.name}.lifx`]) ||
          (s.name && sampleMetadata[s.name]);
        if (!key) return s;
        const {
          tags,
          dataFile,
          expectedOutput,
          insuranceType,
          actuarialBasis,
          expectedPremium,
        } = key;
        return {
          ...s,
          ...(tags !== undefined ? { tags } : {}),
          ...(dataFile !== undefined ? { dataFile } : {}),
          ...(expectedOutput !== undefined ? { expectedOutput } : {}),
          ...(insuranceType !== undefined ? { insuranceType } : {}),
          ...(actuarialBasis !== undefined ? { actuarialBasis } : {}),
          ...(expectedPremium !== undefined ? { expectedPremium } : {}),
        };
      };

      if (isSupabaseConfigured()) {
        const list = await fetchAutoflowSamplesList();
        if (list.length > 0) {
          console.log(`Loaded ${list.length} samples from Supabase (autoflow_samples)`);
          setFolderSamples(
            list.map((s) =>
              enrichWithMetadata({
                id: s.id,
                modelId: s.model_id,
                filename: s.model_name,
                name: s.model_name,
                inputData: s.input_data_name ?? undefined,
                description: s.description ?? undefined,
                category: s.category ?? "기타",
                appSection: s.app_section,
                developerEmail: s.developer_email ?? undefined,
                data: null,
              })
            )
          );
          return;
        }
      }

      const response = await fetch("/samples/samples.json");
      if (response.ok) {
        const samples = await response.json();
        if (Array.isArray(samples) && samples.length > 0) {
          console.log(`Loaded ${samples.length} samples from samples.json`);
          setFolderSamples(
            samples.map((s: any) =>
              enrichWithMetadata({ ...s, category: s.category || "기타" })
            )
          );
        } else setFolderSamples([]);
      } else setFolderSamples([]);
    } catch (error: any) {
      console.error("Error loading samples:", error);
      setFolderSamples([]);
    } finally {
      setIsLoadingSamples(false);
    }
  }, []);

  // Samples 메뉴가 열릴 때마다 폴더 샘플 목록 새로고침
  useEffect(() => {
    if (isSampleMenuOpen) {
      console.log("Samples menu opened, loading folder samples...");
      const timer = setTimeout(() => {
        loadFolderSamplesLocal();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isSampleMenuOpen, loadFolderSamplesLocal]);

  const handleLoadSample = useCallback(
    async (
      sampleName: string,
      filename?: string,
      sampleId?: number | string
    ) => {
      console.log(
        "handleLoadSample called with:",
        sampleName,
        "filename:",
        filename,
        "sampleId:",
        sampleId
      );
      try {
        let sampleModel: any = null;

        if (sampleId) {
          if (isSupabaseConfigured() && typeof sampleId === "string") {
            const supabaseSample = await fetchAutoflowSampleById(sampleId);
            if (supabaseSample) sampleModel = supabaseSample.file_content;
          }
          if (!sampleModel) {
            alert("샘플을 불러올 수 없습니다. Supabase가 설정되어 있는지 확인하세요.");
            return;
          }
        } else if (filename) {
          // samples.json에서 파일 찾기
          try {
            const response = await fetch("/samples/samples.json");
            if (!response.ok) {
              throw new Error(
                `Failed to fetch samples.json: ${response.status}`
              );
            }
            const samples = await response.json();
            if (Array.isArray(samples)) {
              const foundSample = samples.find(
                (s: any) => s.filename === filename || s.name === sampleName
              );
              if (foundSample && foundSample.data) {
                sampleModel = foundSample.data;
                console.log(
                  "Loaded sample from samples.json:",
                  foundSample.name
                );
              } else {
                alert(`Sample file not found: ${filename}`);
                return;
              }
            } else {
              alert(`Invalid samples.json format`);
              return;
            }
          } catch (error: any) {
            console.error("Error loading folder sample:", error);
            alert(`Error loading sample file: ${error.message || error}`);
            return;
          }
        } else {
          // Shared samples에서 찾기
          const foundSample = sharedSamples.find((s) => s.name === sampleName);
          if (foundSample) {
            sampleModel = foundSample;
          }
        }

        console.log("Found sample model:", sampleModel);
        if (!sampleModel) {
          console.error("Sample model not found:", sampleName);
          alert(`Sample model "${sampleName}" not found.`);
          return;
        }

        // Convert sample model format to app format
        const originalIdToNewIdMap = new Map<string, string>();
        const newModules: CanvasModule[] = sampleModel.modules.map(
          (m: any, index: number) => {
            const moduleId = `module-${Date.now()}-${index}`;
            const originalId = m.id;

            if (originalId) {
              originalIdToNewIdMap.set(originalId, moduleId);
            }

            const defaultModule = DEFAULT_MODULES.find(
              (dm) => dm.type === m.type
            );
            if (!defaultModule) {
              alert(`Module type "${m.type}" not found in DEFAULT_MODULES.`);
              throw new Error(`Module type "${m.type}" not found`);
            }
            const moduleInfo = TOOLBOX_MODULES.find((tm) => tm.type === m.type);
            const defaultName = moduleInfo
              ? (moduleInfo as any).nameKo || moduleInfo.name
              : m.type;
            return {
              ...defaultModule,
              id: moduleId,
              name: m.name || defaultName,
              position: m.position || { x: 50 + (index % 5) * 300, y: 50 + Math.floor(index / 5) * 150 },
              parameters: m.parameters || defaultModule.parameters,
              status: ModuleStatus.Pending,
              // inputs와 outputs도 명시적으로 설정 (연결 검증에 필요)
              inputs: m.inputs || defaultModule.inputs,
              outputs: m.outputs || defaultModule.outputs,
            };
          }
        );

        // Convert connections - ensure all module IDs are mapped correctly
        console.log(
          "Processing connections, total:",
          sampleModel.connections?.length || 0
        );
        console.log("First connection sample:", sampleModel.connections?.[0]);
        console.log("Modules count:", sampleModel.modules?.length || 0);
        console.log("New modules count:", newModules.length);
        console.log("ID mapping size:", originalIdToNewIdMap.size);

        const newConnections: Connection[] = (sampleModel.connections || [])
          .map((c: any, index: number) => {
            try {
              // Get original module IDs from connection
              const originalFromId = c.from?.moduleId;
              const originalToId = c.to?.moduleId;

              if (!originalFromId || !originalToId) {
                console.warn(
                  `Connection at index ${index}: Missing module IDs`,
                  { c }
                );
                return null;
              }

              // Get new module IDs from the mapping
              const newFromId = originalIdToNewIdMap.get(originalFromId);
              const newToId = originalIdToNewIdMap.get(originalToId);

              if (!newFromId || !newToId) {
                // Try to find by index as fallback
                const originalFromIndex = sampleModel.modules.findIndex(
                  (m: any) => m.id === originalFromId
                );
                const originalToIndex = sampleModel.modules.findIndex(
                  (m: any) => m.id === originalToId
                );

                if (originalFromIndex >= 0 && originalToIndex >= 0) {
                  const fromModule = newModules[originalFromIndex];
                  const toModule = newModules[originalToIndex];

                  if (!fromModule || !toModule) {
                    console.warn(
                      `Connection at index ${index}: Module not found by index`,
                      {
                        originalFromId,
                        originalToId,
                        fromIndex: originalFromIndex,
                        toIndex: originalToIndex,
                      }
                    );
                    return null;
                  }

                  // Verify ports exist
                  const fromPort = c.from?.portName || c.from?.port || "";
                  const toPort = c.to?.portName || c.to?.port || "";

                  const fromPortExists = fromModule.outputs?.some(
                    (o) => o.name === fromPort
                  );
                  const toPortExists = toModule.inputs?.some(
                    (i) => i.name === toPort
                  );

                  if (!fromPortExists || !toPortExists) {
                    console.warn(
                      `Connection at index ${index}: Port not found`,
                      {
                        fromPort,
                        toPort,
                        fromPortExists,
                        toPortExists,
                        fromModuleOutputs: fromModule.outputs?.map((o) => o.name),
                        toModuleInputs: toModule.inputs?.map((i) => i.name),
                      }
                    );
                    return null;
                  }

                  return {
                    id: `connection-${Date.now()}-${index}`,
                    from: {
                      moduleId: fromModule.id,
                      portName: fromPort,
                    },
                    to: {
                      moduleId: toModule.id,
                      portName: toPort,
                    },
                  };
                } else {
                  console.warn(
                    `Connection at index ${index}: Could not find module IDs`,
                    {
                      originalFromId,
                      originalToId,
                      newFromId,
                      newToId,
                      fromIndex: originalFromIndex,
                      toIndex: originalToIndex,
                      availableModuleIds:
                        sampleModel.modules?.map((m: any) => m.id) || [],
                      mapSize: originalIdToNewIdMap.size,
                    }
                  );
                  return null;
                }
              }

              // Verify both modules exist in the new modules array
              const fromModule = newModules.find((m) => m.id === newFromId);
              const toModule = newModules.find((m) => m.id === newToId);

              if (!fromModule || !toModule) {
                console.warn(
                  `Connection at index ${index}: Module not found in new modules`,
                  {
                    newFromId,
                    newToId,
                    fromModule: !!fromModule,
                    toModule: !!toModule,
                  }
                );
                return null;
              }

              // Get port names
              const fromPort = c.from?.portName || c.from?.port || "";
              const toPort = c.to?.portName || c.to?.port || "";

              // Verify ports exist
              const fromPortExists = fromModule.outputs?.some(
                (o) => o.name === fromPort
              );
              const toPortExists = toModule.inputs?.some(
                (i) => i.name === toPort
              );

              if (!fromPortExists || !toPortExists) {
                console.warn(`Connection at index ${index}: Port not found`, {
                  fromPort,
                  toPort,
                  fromPortExists,
                  toPortExists,
                  fromModuleOutputs: fromModule.outputs?.map((o) => o.name),
                  toModuleInputs: toModule.inputs?.map((i) => i.name),
                });
                return null;
              }

              return {
                id: `connection-${Date.now()}-${index}`,
                from: {
                  moduleId: newFromId,
                  portName: fromPort,
                },
                to: {
                  moduleId: newToId,
                  portName: toPort,
                },
              };
            } catch (error: any) {
              console.error(
                `Error processing connection at index ${index}:`,
                error,
                { connection: c }
              );
              return null;
            }
          })
          .filter((conn): conn is Connection => conn !== null);

        console.log(
          `Successfully created ${newConnections.length} connections out of ${sampleModel.connections?.length || 0}`
        );

        // 데이터 자동 바인딩: 파일명(source)만 있고 본문(fileContent)이 없는
        // LoadData 모듈에 실제 CSV 본문을 주입한다(번들 레지스트리→Supabase 폴백).
        // 이 앱 샘플은 fileContent를 동봉하므로 기존 동작은 불변이며(이미 본문이
        // 있으면 건너뜀), 본문 없이 저장된 샘플/모델에 대해서만 가산적으로 작동한다.
        try {
          await bindDatasetsToModules(newModules);
        } catch (bindErr) {
          console.warn("Dataset auto-binding skipped:", bindErr);
        }

        resetModules(newModules);
        _setConnections(newConnections);
        setProductName(sampleModel.name || sampleName || sampleModel.productName);
        setSelectedModuleIds([]);
        setIsDirty(false);
        setIsSampleMenuOpen(false);
        setIsSamplesMenuOpen(false);
        setIsMyWorkMenuOpen(false);

        // 위치 정보가 있으면 자동 재배치를 건너뛰고, 없으면 재배치
        const hasPositions = newModules.some(m => m.position && (m.position.x !== 0 || m.position.y !== 0));
        if (!hasPositions) {
          // 위치 정보가 없으면 자동 재배치
          setTimeout(() => {
            hasInitialRearranged.current = false;
            handleRearrangeModules();
          }, 100);
        } else {
          // 위치 정보가 있으면 Fit to View만 실행
          setTimeout(() => {
            handleFitToView();
          }, 100);
        }
      } catch (error: any) {
        console.error("Error loading sample:", error);
        alert(`Error loading sample: ${error.message || error}`);
      }
    },
    [sharedSamples, resetModules, _setConnections, handleRearrangeModules]
  );

  // Save to shared samples (downloads file)
  const handleSaveToSharedSamples = () => {
    const newSample = createCleanSample();

    // Check if sample with same name exists
    const existingIndex = sharedSamples.findIndex((s) => s.name === productName);

    if (existingIndex >= 0) {
      // Show overwrite confirmation
      setPendingSample(newSample);
      setOverwriteContext('shared');
      setShowOverwriteConfirm(true);
    } else {
      // Download file
      saveSampleToFile(newSample);
      setIsSamplesMenuOpen(false);
      alert(`"${productName}"이(가) 다운로드되었습니다. samples 폴더에 저장하고 커밋하세요.`);
    }
  };

  // 이 앱의 데이터 로더 타입(LoadData 1종). 새 로더 타입이 생기면 여기에 추가.
  const isLoaderModuleType = (type: string): boolean => type === ModuleType.LoadData;

  // 현재 캔버스에서 로더 모듈들의 저장 옵션용 정보를 수집한다.
  const collectLoaderInfos = (): LoaderDataInfo[] => {
    const infos: LoaderDataInfo[] = [];
    for (const m of modules) {
      if (!isLoaderModuleType(m.type as string)) continue;
      const p = (m.parameters || {}) as Record<string, any>;
      const content = typeof p.fileContent === "string" ? p.fileContent : "";
      const hasContent = Boolean(content && content.trim());
      infos.push({
        moduleId: m.id,
        name: m.name || (m.type as string),
        source: String(p.source || "").trim(),
        sizeMB: hasContent ? contentSizeMB(content) : 0,
        hasContent,
        description: String(p.dataDescription || "").trim(),
      });
    }
    return infos;
  };

  // 저장 옵션 모달을 연다(현재 모델 저장 진입점).
  const openSaveOptions = (mode: 'mywork') => {
    setIsMyWorkMenuOpen(false);
    setSaveOptions({
      open: true,
      mode,
      name: productName,
      loaders: collectLoaderInfos(),
    });
  };

  // localStorage 쿼터 초과 에러인지 판정(브라우저별 명칭 차이 대응).
  const isQuotaError = (err: any): boolean => {
    if (!err) return false;
    const name = err.name || "";
    const msg = String(err.message || err);
    return (
      name === "QuotaExceededError" ||
      name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      err.code === 22 ||
      err.code === 1014 ||
      /quota/i.test(msg)
    );
  };

  // 저장 옵션 모달 확인 → 실제 저장 수행.
  const performModelSave = async (name: string, decisions: SaveDecisions) => {
    setIsSavingModel(true);
    try {
      // 1) 웹 등록 대상 먼저 업로드(참조 저장). 실패해도 저장 자체는 진행.
      const uploadWarnings: string[] = [];
      for (const l of saveOptions.loaders) {
        const d = decisions[l.moduleId];
        if (!d?.registerToWeb || !l.hasContent) continue;
        const mod = modules.find((m) => m.id === l.moduleId);
        const content = String((mod?.parameters as any)?.fileContent || "");
        if (!content) continue;
        const res = await uploadDatasetToWeb(l.source || name, content);
        if (!res.ok) {
          uploadWarnings.push(`${l.name}: ${res.error || "웹 등록 실패"}`);
        }
      }

      // 2) 저장할 깨끗한 샘플 생성 후, 결정에 따라 로더별 데이터를 임베드/제외.
      const baseSample = createCleanSample();
      const sampleModules = baseSample.modules.map((m: any) => {
        if (!isLoaderModuleType(m.type)) return m;
        const d = decisions[m.id];
        const params = { ...(m.parameters || {}) } as Record<string, any>;
        if (d) {
          // 데이터 설명은 항상 반영(포함 여부와 무관).
          params.dataDescription = d.description || "";
          if (!d.include) {
            // 제외(참조만): 본문 제거 — 로드 시 datasetRegistry가 source로 재해석.
            delete params.fileContent;
          }
        }
        return { ...m, parameters: params };
      });
      const sample: SampleData = { ...baseSample, name, modules: sampleModules };

      // 3) localStorage 저장(쿼터 초과 안전 처리). 동명 모델은 덮어쓰기.
      const existingIndex = personalWork.findIndex((s) => s.name === name);
      const updatedWork = [...personalWork];
      if (existingIndex >= 0) updatedWork[existingIndex] = sample;
      else updatedWork.push(sample);

      try {
        savePersonalWork(updatedWork); // 쿼터 초과 시 throw 가능
      } catch (err: any) {
        if (isQuotaError(err)) {
          alert(
            "브라우저 저장 공간이 부족합니다(쿼터 초과). 기존 데이터는 보존되었습니다.\n" +
              "데이터 본문 '포함'을 해제하거나 '웹 예제로 등록(참조 저장)'을 사용해 다시 저장하세요."
          );
          return; // 상태 미반영 → 데이터 유실 방지
        }
        throw err;
      }

      // 저장 성공 시에만 상태 반영.
      setPersonalWork(updatedWork);
      setSaveOptions((s) => ({ ...s, open: false }));
      if (uploadWarnings.length > 0) {
        alert(
          "모델은 저장되었으나 일부 데이터의 웹 등록에 실패했습니다:\n" +
            uploadWarnings.join("\n")
        );
      }
    } catch (err: any) {
      console.error("모델 저장 실패:", err);
      alert(`모델 저장 중 오류가 발생했습니다: ${err?.message || err}`);
    } finally {
      setIsSavingModel(false);
    }
  };

  // Save to personal work (localStorage) — 저장 옵션 모달을 거친다.
  const handleSaveToPersonalWork = () => {
    openSaveOptions("mywork");
  };

  const handleSetAsInitial = () => {
    const ok = saveInitialState(modules, connections);
    if (ok) {
      setInitialSavedToast("✓ 초기 화면으로 설정되었습니다. 다음 실행 시 이 모델이 표시됩니다.");
      setTimeout(() => setInitialSavedToast(null), 3000);
    } else {
      setInitialSavedToast("⚠ 저장에 실패했습니다. 파일 크기를 확인하세요.");
      setTimeout(() => setInitialSavedToast(null), 4000);
    }
    setIsMyWorkMenuOpen(false);
  };

  const handleDeletePersonalWork = (workName: string, index: number) => {
    if (confirm(`"${workName}"을(를) 삭제하시겠습니까?`)) {
      const updatedWork = personalWork.filter((_, idx) => idx !== index);
      setPersonalWork(updatedWork);
      savePersonalWork(updatedWork);
    }
  };

  const handleLoadPersonalWorkFromFile = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const sample = await loadSampleFromFile(file);
        if (sample) {
          handleLoadSample(sample);
        } else {
          alert('파일을 읽을 수 없습니다. 올바른 형식의 JSON 파일인지 확인하세요.');
        }
      }
    };
    input.click();
  }, []);

  const handleGeneratePipelineFromGoal = async (goal: string) => {
    setIsAIGoalModalOpen(false);
    const ai = ensureClient();
    if (!ai) return; // 키 없음 → 키 입력 모달이 열림
    setIsGeneratingPipeline(true);
    try {
      const prompt = buildPipelineGenerationPrompt(goal);
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      const dslMarkdown = response.text ?? '';
      setAiGeneratedPlan(dslMarkdown);
      setIsAIPlanModalOpen(true);
    } catch (err) {
      console.error('AI pipeline generation failed:', err);
      alert('파이프라인 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGeneratingPipeline(false);
    }
  };

  const handleApplyAIPlan = () => {
    const model = parseMarkdownModel(aiGeneratedPlan);
    const { modules: newModules, connections: newConnections } = buildPipelineFromModel(model);
    handleBuildPipelineFromDSL(newModules, newConnections, model.productName);
    setIsAIPlanModalOpen(false);
  };

  const handleBuildPipelineFromDSL = useCallback(
    (newModules: CanvasModule[], newConnections: Connection[], name: string) => {
      resetModules(newModules);
      _setConnections(newConnections);
      setProductName(name);
      setSelectedModuleIds([]);
      setIsDirty(true);
      // 상태 업데이트 완료 후 useEffect에서 Auto Layout 실행
      pendingRearrangeAfterDSL.current = true;
    },
    [resetModules, _setConnections]
  );

  // DSL 파라미터만 적용: 기존 모듈 위치·연결 유지, 파라미터만 업데이트
  // DSL에 있지만 캔버스에 없는 모듈은 새로 생성하여 추가
  const handlePatchParametersFromDSL = useCallback(
    (configs: Array<{ type: ModuleType; parameters: Record<string, any> }>, name: string) => {
      setModules((prev) => {
        // 1. 기존 모듈 파라미터 업데이트
        const patched = prev.map((mod) => {
          const config = configs.find((c) => c.type === mod.type);
          if (!config) return mod;
          return { ...mod, parameters: { ...mod.parameters, ...config.parameters } };
        });

        // 2. 캔버스에 없는 DSL 모듈 찾기
        const existingTypes = new Set(prev.map((m) => m.type));
        const missingConfigs = configs.filter((c) => !existingTypes.has(c.type));
        if (missingConfigs.length === 0) return patched;

        // 3. 누락 모듈만 buildPipelineFromModel로 생성 (DefinePolicyInfo 제외)
        const missingParsedModules = missingConfigs
          .filter((c) => c.type !== ModuleType.DefinePolicyInfo)
          .map((c) => ({ type: c.type, include: true, parameters: c.parameters }));
        if (missingParsedModules.length === 0) return patched;

        const allParsedModules = [
          ...prev.map((m) => ({ type: m.type, include: true, parameters: m.parameters })),
          ...missingParsedModules,
        ];
        const { modules: rebuilt } = buildPipelineFromModel({
          productName: name,
          description: '',
          modules: allParsedModules,
        });

        // 4. 기존 모듈 위치 유지 + 새 모듈 추가
        const newModulesByType = new Map(rebuilt.map((m) => [m.type, m]));
        const result = patched.map((m) => {
          const rebuiltMod = newModulesByType.get(m.type);
          return rebuiltMod ? { ...rebuiltMod, position: m.position } : m;
        });
        missingParsedModules.forEach(({ type }) => {
          const newMod = newModulesByType.get(type);
          if (newMod) result.push(newMod);
        });
        return result;
      });
      setProductName(name);
      setIsDirty(true);
    },
    [setModules]
  );

  const DRAFT_KEY = 'lmf_dsl_draft';

  // 모듈 저장 시 출력 이름 변경을 다운스트림에 전파하고 전체 DSL을 재생성
  const handleModuleSaved = useCallback(
    (moduleType: ModuleType, savedParams: Record<string, any>) => {
      const moduleId = editingModuleIdRef.current;

      // 편집 전 파라미터로 이름 변경 감지
      const initialState = moduleId ? moduleInitialStateRef.current.get(moduleId) : null;
      const oldParams = initialState?.parameters;
      const nameChanges = oldParams
        ? getColumnNameChanges(moduleType, oldParams, savedParams)
        : new Map<string, string>();

      // 다운스트림 모듈 파라미터 업데이트 (이름 변경이 있을 때만)
      if (nameChanges.size > 0) {
        setModules((prevModules) =>
          prevModules.map((m) => {
            if (m.id === moduleId) return m; // 현재 모듈은 onClose에서 처리
            const updatedParams = applyColumnNameChanges(m.type, m.parameters, nameChanges);
            return updatedParams !== m.parameters ? { ...m, parameters: updatedParams } : m;
          })
        );
      }

      // 전체 DSL 재생성 (최신 modules 기준으로 인라인 빌드)
      const updatedModules = modules.map((m) => {
        if (m.id === moduleId) return { ...m, parameters: savedParams };
        if (nameChanges.size === 0) return m;
        const updatedParams = applyColumnNameChanges(m.type, m.parameters, nameChanges);
        return updatedParams !== m.parameters ? { ...m, parameters: updatedParams } : m;
      });
      const fullDsl = generateDSL(productName, updatedModules);
      localStorage.setItem(DRAFT_KEY, fullDsl);
    },
    [modules, productName]
  );

  const handleConfirmOverwrite = () => {
    if (!pendingSample || !overwriteContext) return;

    if (overwriteContext === 'shared') {
      // For shared samples, download the file
      saveSampleToFile(pendingSample);
      alert(`"${pendingSample.name}"이(가) 다운로드되었습니다. samples 폴더에 저장하고 커밋하세요.`);
    } else if (overwriteContext === 'personal') {
      // For personal work, update localStorage
      const existingIndex = personalWork.findIndex(
        (s) => s.name === pendingSample.name
      );
      const updatedWork = [...personalWork];

      if (existingIndex >= 0) {
        updatedWork[existingIndex] = pendingSample;
      } else {
        updatedWork.push(pendingSample);
      }

      setPersonalWork(updatedWork);
      savePersonalWork(updatedWork);
    }

    setShowOverwriteConfirm(false);
    setPendingSample(null);
    setOverwriteContext(null);
    setIsSamplesMenuOpen(false);
    setIsMyWorkMenuOpen(false);
  };

  const handleCancelOverwrite = () => {
    setShowOverwriteConfirm(false);
    setPendingSample(null);
    setOverwriteContext(null);
  };

  const createModule = useCallback(
    (type: ModuleType, position?: { x: number; y: number }) => {
      const defaultData = DEFAULT_MODULES.find((m) => m.type === type);
      if (!defaultData) return;

      // 저장된 사용자 정의 기본값이 있으면 우선 사용, 없으면 기본값 사용
      const savedDefault = loadModuleDefault(type);
      const defaultParameters = savedDefault 
        ? JSON.parse(JSON.stringify(savedDefault))
        : JSON.parse(JSON.stringify(defaultData.parameters));

      const moduleInfo = TOOLBOX_MODULES.find((m) => m.type === type);
      const baseName = moduleInfo
        ? (moduleInfo as any).nameKo || moduleInfo.name
        : type;
      const count = modules.filter((m) => m.type === type).length + 1;

      // Check if this is a special module that needs a container box
      const isSpecialModule =
        type === ModuleType.ScenarioRunner ||
        type === ModuleType.PipelineExplainer;
      const boxPadding = isSpecialModule ? 20 : 0;
      const moduleWidth = 224; // w-56
      const moduleHeight = isSpecialModule ? 120 : 60;
      const boxHeight = isSpecialModule ? moduleHeight + boxPadding * 2 : 0;
      const minBoxSpacing = 20;

      let finalPosition = position;
      if (!finalPosition) {
        if (canvasContainerRef.current) {
          const canvasRect = canvasContainerRef.current.getBoundingClientRect();

          if (isSpecialModule) {
            // Find existing special modules to avoid overlap
            const existingSpecialModules = modules.filter(
              (m) =>
                m.type === ModuleType.ScenarioRunner ||
                m.type === ModuleType.PipelineExplainer
            );

            // Find a position that doesn't overlap with existing boxes
            let candidateY =
              (canvasRect.height / 2 - moduleHeight / 2 - pan.y) / scale +
              boxPadding;
            let foundPosition = false;

            // Check if candidate position overlaps with existing boxes
            for (let attempt = 0; attempt < 10; attempt++) {
              const candidateBoxTop = candidateY - boxPadding;
              const candidateBoxBottom = candidateBoxTop + boxHeight;

              const overlaps = existingSpecialModules.some((existing) => {
                const existingBoxTop = existing.position.y - boxPadding;
                const existingBoxBottom = existingBoxTop + boxHeight;

                // Check if boxes overlap
                return !(
                  candidateBoxBottom < existingBoxTop ||
                  candidateBoxTop > existingBoxBottom
                );
              });

              if (!overlaps) {
                foundPosition = true;
                break;
              }

              // Move down by box height + spacing
              candidateY += boxHeight + minBoxSpacing;
            }

            finalPosition = {
              x:
                (canvasRect.width / 2 - moduleWidth / 2 - pan.x) / scale +
                boxPadding,
              y: candidateY,
            };
          } else {
            finalPosition = {
              x: (canvasRect.width / 2 - moduleWidth / 2 - pan.x) / scale,
              y: (canvasRect.height / 2 - moduleHeight / 2 - pan.y) / scale,
            };
          }
        } else {
          finalPosition = { x: 100 + boxPadding, y: 100 + boxPadding };
        }
      }

      const newModule: CanvasModule = {
        id: `${type}-${Date.now()}`,
        name: `${baseName} ${count}`,
        type,
        position: finalPosition,
        status: ModuleStatus.Pending,
        parameters: defaultParameters, // 저장된 기본값 또는 기본값 사용
        inputs: JSON.parse(JSON.stringify(defaultData.inputs)), // Deep copy
        outputs: JSON.parse(JSON.stringify(defaultData.outputs)), // Deep copy
      };

      setModules((prev) => [...prev, newModule]);
      setSelectedModuleIds([newModule.id]);
      setIsDirty(true);
    },
    [modules, setModules, setSelectedModuleIds, scale, pan]
  );

  const updateModulePositions = useCallback(
    (updates: { id: string; position: { x: number; y: number } }[]) => {
      const updatesMap = new Map(updates.map((u) => [u.id, u.position]));
      setModules(
        (prev) =>
          prev.map((m) => {
            const newPos = updatesMap.get(m.id);
            return newPos ? { ...m, position: newPos } : m;
          }),
        true
      );
      setIsDirty(true);
    },
    [setModules]
  );

  const updateModuleParameters = useCallback(
    (id: string, newParams: Record<string, any>, replace = false) => {
      setModules((prevModules) => {
        const currentModule = prevModules.find((m) => m.id === id);
        const mergedParams = currentModule
          ? replace
            ? { ...newParams }
            : { ...currentModule.parameters, ...newParams }
          : newParams;

        // ── 모달 편집 중: status/outputData 변경 없이 파라미터만 업데이트
        // (저장 또는 취소 시점에 한 번에 반영)
        if (editingModuleIdRef.current === id) {
          return prevModules.map((m) =>
            m.id === id ? { ...m, parameters: mergedParams } : m
          );
        }

        // ── 모달 밖: 실제 변경 없으면 status 유지
        if (currentModule) {
          const unchanged =
            JSON.stringify(mergedParams) ===
            JSON.stringify(currentModule.parameters);
          if (unchanged) {
            return prevModules.map((m) =>
              m.id === id ? { ...m, parameters: mergedParams } : m
            );
          }
        }

        // ── 모달 밖 + 실제 변경: 현재 모듈 및 다운스트림 Pending으로 리셋
        const adj: Record<string, string[]> = {};
        connections.forEach((conn) => {
          if (!adj[conn.from.moduleId]) adj[conn.from.moduleId] = [];
          adj[conn.from.moduleId].push(conn.to.moduleId);
        });

        const modulesToReset = new Set<string>();
        const queue = [id];
        while (queue.length > 0) {
          const currentId = queue.shift()!;
          (adj[currentId] || []).forEach((childId) => {
            if (!modulesToReset.has(childId)) {
              modulesToReset.add(childId);
              queue.push(childId);
            }
          });
        }

        let updatedModules = prevModules.map((m) => {
          if (m.id === id) {
            return {
              ...m,
              parameters: mergedParams,
              status: ModuleStatus.Pending,
              outputData: undefined,
            };
          }
          if (modulesToReset.has(m.id)) {
            return { ...m, status: ModuleStatus.Pending, outputData: undefined };
          }
          return m;
        });

        // ── basicValues 양방향 동기화: DefinePolicyInfo ↔ AdditionalName
        if (mergedParams.basicValues !== undefined) {
          if (currentModule?.type === ModuleType.DefinePolicyInfo) {
            // AdditionalName과 그 downstream(NetPremium, GrossPremium, Reserve 등)도 Pending으로 리셋
            const addMod = updatedModules.find((m) => m.type === ModuleType.AdditionalName);
            const addDownstream = new Set<string>();
            if (addMod) {
              const q2 = [addMod.id];
              while (q2.length > 0) {
                const cid = q2.shift()!;
                (adj[cid] || []).forEach((child) => {
                  if (!addDownstream.has(child)) { addDownstream.add(child); q2.push(child); }
                });
              }
            }
            updatedModules = updatedModules.map((m) => {
              if (m.type === ModuleType.AdditionalName)
                return { ...m, parameters: { ...m.parameters, basicValues: mergedParams.basicValues }, status: ModuleStatus.Pending, outputData: undefined };
              if (addDownstream.has(m.id))
                return { ...m, status: ModuleStatus.Pending, outputData: undefined };
              return m;
            });
          } else if (currentModule?.type === ModuleType.AdditionalName) {
            updatedModules = updatedModules.map((m) =>
              m.type === ModuleType.DefinePolicyInfo
                ? { ...m, parameters: { ...m.parameters, basicValues: mergedParams.basicValues } }
                : m
            );
          }
        }

        return updatedModules;
      });
      setIsDirty(true);
    },
    [setModules, connections]
  );

  // ── DefinePolicyInfo.basicValues → AdditionalName 동기화 (로드·외부변경 포함)
  useEffect(() => {
    const defMod = modules.find((m) => m.type === ModuleType.DefinePolicyInfo);
    const addMod = modules.find((m) => m.type === ModuleType.AdditionalName);
    if (!defMod?.parameters.basicValues || !addMod) return;
    if (
      JSON.stringify(defMod.parameters.basicValues) ===
      JSON.stringify(addMod.parameters.basicValues)
    ) return;
    const synced = defMod.parameters.basicValues;

    // AdditionalName의 downstream도 함께 Pending으로 리셋
    const adj: Record<string, string[]> = {};
    connections.forEach((conn) => {
      if (!adj[conn.from.moduleId]) adj[conn.from.moduleId] = [];
      adj[conn.from.moduleId].push(conn.to.moduleId);
    });
    const addDownstream = new Set<string>();
    const q2 = [addMod.id];
    while (q2.length > 0) {
      const cid = q2.shift()!;
      (adj[cid] || []).forEach((child) => {
        if (!addDownstream.has(child)) { addDownstream.add(child); q2.push(child); }
      });
    }

    setModules(
      (prev) =>
        prev.map((m) => {
          if (m.type === ModuleType.AdditionalName)
            return { ...m, parameters: { ...m.parameters, basicValues: synced }, status: ModuleStatus.Pending, outputData: undefined };
          if (addDownstream.has(m.id))
            return { ...m, status: ModuleStatus.Pending, outputData: undefined };
          return m;
        }),
      true // overwrite: 히스토리 진입 없이 덮어쓰기
    );
  }, [modules, setModules, connections]);

  const handlePolicySetupApply = useCallback(
    (
      name: string,
      policyParams: Record<string, any>,
      basicValues: Array<{ name: string; value: number }>
    ) => {
      setProductName(name);
      const policyModule = modules.find((m) => m.type === ModuleType.DefinePolicyInfo);
      if (policyModule) {
        updateModuleParameters(policyModule.id, policyParams);
      }
      const additionalModule = modules.find((m) => m.type === ModuleType.AdditionalName);
      if (additionalModule) {
        updateModuleParameters(additionalModule.id, {
          ...additionalModule.parameters,
          basicValues,
        });
      }
      setIsDirty(true);
    },
    [modules, updateModuleParameters]
  );

  const adjustFontSize = useCallback(
    (increase: boolean) => {
      const shapeModules = modules.filter(
        (m) =>
          selectedModuleIds.includes(m.id) &&
          (m.type === ModuleType.TextBox || m.type === ModuleType.GroupBox)
      );

      if (shapeModules.length === 0) {
        alert("글자 크기를 조정할 도형을 선택하세요.");
        return;
      }

      shapeModules.forEach((module) => {
        const currentFontSize =
          module.parameters?.fontSize ||
          (module.type === ModuleType.TextBox ? 14 : 12);
        const step = 2;
        const newFontSize = increase
          ? Math.min(48, currentFontSize + step)
          : Math.max(8, currentFontSize - step);
        updateModuleParameters(module.id, { fontSize: newFontSize });
      });
    },
    [modules, selectedModuleIds, updateModuleParameters]
  );

  const updateModuleName = useCallback(
    (id: string, newName: string) => {
      setModules((prev) =>
        prev.map((m) => (m.id === id ? { ...m, name: newName } : m))
      );
      setIsDirty(true);
    },
    [setModules]
  );

  const deleteModules = useCallback(
    (idsToDelete: string[]) => {
      setModules((prev) => prev.filter((m) => !idsToDelete.includes(m.id)));
      setConnections((prev) =>
        prev.filter(
          (c) =>
            !idsToDelete.includes(c.from.moduleId) &&
            !idsToDelete.includes(c.to.moduleId)
        )
      );
      setSelectedModuleIds((prev) =>
        prev.filter((id) => !idsToDelete.includes(id))
      );
      setIsDirty(true);
    },
    [setModules, setConnections, setSelectedModuleIds]
  );

  const handleViewDetails = (moduleId: string) => {
    const module = modules.find((m) => m.id === moduleId);
    if (module?.outputData) {
      setViewingDataForModule(module);
    }
  };

  const handleCloseModal = () => {
    setViewingDataForModule(null);
  };

  const renderOutputModal = () => {
    const currentViewingModule = viewingDataForModule
      ? modules.find((m) => m.id === viewingDataForModule.id)
      : null;

    if (!currentViewingModule || !currentViewingModule.outputData) return null;
    const { outputData } = currentViewingModule;

    switch (outputData.type) {
      case "DataPreview":
      case "ScenarioRunnerOutput":
      case "PremiumComponentOutput":
        return (
          <DataPreviewModal
            module={currentViewingModule}
            projectName={productName}
            onClose={handleCloseModal}
            allModules={modules}
            allConnections={connections}
          />
        );
      case "NetPremiumOutput":
      case "GrossPremiumOutput":
        return (
          <NetPremiumPreviewModal
            module={currentViewingModule}
            projectName={productName}
            onClose={handleCloseModal}
            allModules={modules}
            allConnections={connections}
          />
        );
      case "AdditionalVariablesOutput":
        return (
          <AdditionalVariablesPreviewModal
            module={currentViewingModule}
            projectName={productName}
            onClose={handleCloseModal}
            allModules={modules}
            allConnections={connections}
          />
        );
      case "PipelineExplainerOutput":
        return (
          <PipelineReportModal
            module={currentViewingModule}
            onClose={handleCloseModal}
          />
        );
      default:
        return null;
    }
  };

  // ── 계산 코어는 utils/pipelineEngine.ts 로 추출되었다(동작 변경 없는 call-through). ──
  // 아래 보조 함수들은 추출된 모듈 함수를 그대로 가리키는 별칭으로, 컴포넌트 내 기존
  // 호출부(예: getTopologicalSort, roundTo5)의 동작·시그니처를 동일하게 유지한다.
  const getTopologicalSort = getTopologicalSortCore;

  // executePipeline 은 추출된 순수 코어(executePipelineCore)를 호출하는 얇은 래퍼다.
  // 기존 시그니처/동작을 보존한다(재현성 verify 하네스가 동일 코어를 headless 로 호출).
  const executePipeline = useCallback(
    (
      pipelineModules: CanvasModule[],
      pipelineConnections: Connection[],
      runQueue: string[],
      logFn: (moduleId: string, message: string) => void,
      overriddenParams: Record<string, Record<string, any>> | undefined,
      throwOnError: boolean
    ): Promise<CanvasModule[]> =>
      executePipelineCore(
        pipelineModules,
        pipelineConnections,
        runQueue,
        logFn,
        overriddenParams,
        throwOnError
      ),
    []
  );


  const runScenarioRunner = useCallback(
    async (runnerId: string) => {
      const runnerModule = modules.find((m) => m.id === runnerId)!;
      const { scenarios } = runnerModule.parameters;

      const log = (message: string) => {
        setTerminalOutputs((prev) => ({
          ...prev,
          [runnerId]: [
            ...(prev[runnerId] || []),
            `[${new Date().toLocaleTimeString()}] ${message}`,
          ],
        }));
      };

      log(`Starting scenario run for ${runnerModule.name}...`);
      setModules((prev) =>
        prev.map((m) =>
          m.id === runnerId ? { ...m, status: ModuleStatus.Running } : m
        )
      );

      try {
        const parseValues = (valueStr: string): (string | number)[] => {
          if (valueStr.includes(",")) {
            return valueStr.split(",").map((s) => s.trim());
          }
          if (valueStr.includes("-")) {
            const [start, end] = valueStr.split("-").map(Number);
            if (!isNaN(start) && !isNaN(end) && start <= end) {
              return Array.from(
                { length: end - start + 1 },
                (_, i) => start + i
              );
            }
          }
          return [valueStr];
        };

        const scenarioParams = scenarios.map((s: any) => ({
          ...s,
          parsedValues: parseValues(s.values),
        }));
        const cartesian = (...a: any[][]) =>
          a.reduce((a, b) => a.flatMap((d) => b.map((e) => [d, e].flat())));
        const valueArrays = scenarioParams.map((s: any) => s.parsedValues);
        const combinations =
          valueArrays.length > 0 ? cartesian(...valueArrays) : [[]];

        log(`Generated ${combinations.length} scenarios to run.`);
        const results: Record<string, any>[] = [];
        const resultColumns: ColumnInfo[] = [
          ...scenarios.map((s: any) => ({
            name: s.variableName,
            type: "string",
          })),
          { name: "NetPremium", type: "number" },
        ];

        for (let i = 0; i < combinations.length; i++) {
          const combo = Array.isArray(combinations[i])
            ? combinations[i]
            : [combinations[i]];
          const overrides: Record<string, Record<string, any>> = {};
          const resultRow: Record<string, any> = {};

          // Identify Policy Module ID to handle logic
          const policyModuleId = modules.find(
            (m) => m.type === ModuleType.DefinePolicyInfo
          )?.id;

          scenarios.forEach((scenario: any, index: number) => {
            const value = combo[index];

            if (!overrides[scenario.targetModuleId]) {
              overrides[scenario.targetModuleId] = {};
            }

            // Explicit logic for split PolicyTerm and MaturityAge
            if (scenario.targetModuleId === policyModuleId) {
              if (scenario.targetParameterName === "maturityAge") {
                overrides[scenario.targetModuleId]["maturityAge"] = value;
                // We do NOT reset policyTerm to 0 here.
                // We let the module execution logic decide.
                // If maturityAge is valid (>0) and calculated term > 0, it will be used.
                // If not, original policyTerm will be used (fallback).
              } else if (scenario.targetParameterName === "policyTerm") {
                overrides[scenario.targetModuleId]["policyTerm"] = value;
                // Reset maturityAge to 0 to ensure calculation based on duration takes precedence
                overrides[scenario.targetModuleId]["maturityAge"] = 0;
              } else {
                overrides[scenario.targetModuleId][
                  scenario.targetParameterName
                ] = value;
              }
            } else {
              overrides[scenario.targetModuleId][scenario.targetParameterName] =
                value;
            }

            // Handle legacy suffix support if needed
            if (
              scenario.targetModuleId === policyModuleId &&
              typeof value === "string" &&
              value.endsWith("(Age)")
            ) {
              const matAge = parseInt(value.replace("(Age)", ""));
              overrides[scenario.targetModuleId]["maturityAge"] = matAge;
            }

            resultRow[scenario.variableName] = value;
          });

          log(
            `Running scenario ${i + 1}/${combinations.length}: ${JSON.stringify(
              resultRow
            )}`
          );

          try {
            const allModules = JSON.parse(JSON.stringify(modules));
            // Use topological sort to ensure correct execution order
            const executionOrder = getTopologicalSort(
              allModules,
              connections
            ).filter((id) => id !== runnerId);

            const finalModules = await executePipeline(
              allModules,
              connections,
              executionOrder,
              () => {},
              overrides,
              true
            );

            // Capture final Policy Term
            const finalPolicyModule = finalModules.find(
              (m) => m.type === ModuleType.DefinePolicyInfo
            );
            if (finalPolicyModule?.outputData?.type === "PolicyInfoOutput") {
              const calculatedTerm = finalPolicyModule.outputData.policyTerm;
              // Update result table to show calculated Duration if Maturity Age was used
              scenarios.forEach((s: any) => {
                if (s.targetModuleId === policyModuleId) {
                  // If user targeted Maturity Age, table should reflect Duration
                  if (
                    s.targetParameterName === "maturityAge" ||
                    (typeof resultRow[s.variableName] === "string" &&
                      resultRow[s.variableName].endsWith("(Age)"))
                  ) {
                    resultRow[s.variableName] = calculatedTerm;
                  }
                }
              });
            }

            const premiumModule = finalModules.find(
              (m) => m.type === ModuleType.NetPremiumCalculator
            );
            if (premiumModule?.outputData?.type === "NetPremiumOutput") {
              resultRow["NetPremium"] = premiumModule.outputData.netPremium;
            } else {
              resultRow["NetPremium"] = null; // Mark as failed
            }
            results.push(resultRow);
          } catch (e: any) {
            log(`ERROR: Scenario ${i + 1} failed: ${e.message}`);
            resultRow["NetPremium"] = null;
            results.push(resultRow);
          }
        }

        const outputData: ModuleOutput = {
          type: "ScenarioRunnerOutput",
          columns: resultColumns,
          totalRowCount: results.length,
          rows: results,
        };

        setModules((prev) =>
          prev.map((m) =>
            m.id === runnerId
              ? { ...m, status: ModuleStatus.Success, outputData }
              : m
          )
        );
        log("Scenario run finished successfully.");
      } catch (e: any) {
        log(`FATAL ERROR in Scenario Runner: ${e.message}`);
        setModules((prev) =>
          prev.map((m) =>
            m.id === runnerId ? { ...m, status: ModuleStatus.Error } : m
          )
        );
      }
    },
    [modules, connections, executePipeline, getTopologicalSort]
  );

  const runSimulation = useCallback(
    async (startModuleId?: string) => {
      // Run All (no startModuleId) runs only the currently active tab: modules/connections are always the active tab's state.
      const isScenarioRun =
        startModuleId &&
        modules.find((m) => m.id === startModuleId)?.type ===
          ModuleType.ScenarioRunner;
      const isPipelineExplainer =
        startModuleId &&
        modules.find((m) => m.id === startModuleId)?.type ===
          ModuleType.PipelineExplainer;

      if (isScenarioRun) {
        await runScenarioRunner(startModuleId!);
        return;
      }

      // Filter out non-computing / specially-handled modules from Run All.
      // ScenarioRunner: 별도 runScenarioRunner 경유. PipelineExplainer: 명시 실행 대상.
      // TextBox/GroupBox: 비계산 annotation/container → Run All 에서 제외(빈 Success 노이즈 방지, C-2).
      const filteredModules = modules.filter(
        (m) =>
          m.type !== ModuleType.ScenarioRunner &&
          m.type !== ModuleType.PipelineExplainer &&
          m.type !== ModuleType.TextBox &&
          m.type !== ModuleType.GroupBox
      );

      // A-1: 순환 참조(Circular Dependency) 검사 (Run All 시에만)
      if (!startModuleId) {
        const graph = new Map<string, string[]>();
        filteredModules.forEach((m) => graph.set(m.id, []));
        connections.forEach((c) => {
          const downstream = graph.get(c.from.moduleId);
          if (downstream) downstream.push(c.to.moduleId);
        });

        const cycles: string[][] = [];
        const visited = new Set<string>();
        const inStack = new Set<string>();
        const stack: string[] = [];

        const dfs = (id: string) => {
          if (inStack.has(id)) {
            const cycleStart = stack.indexOf(id);
            const cycleModuleNames = stack.slice(cycleStart).map((mid) => {
              const m = filteredModules.find((mod) => mod.id === mid);
              return m ? m.name : mid;
            });
            cycles.push(cycleModuleNames);
            return;
          }
          if (visited.has(id)) return;
          inStack.add(id);
          stack.push(id);
          for (const child of graph.get(id) || []) {
            dfs(child);
          }
          stack.pop();
          inStack.delete(id);
          visited.add(id);
        };

        filteredModules.forEach((m) => dfs(m.id));

        if (cycles.length > 0) {
          const cycleDescriptions = cycles.map((c) => c.join(" → ")).join("\n");
          alert(
            `⚠️ 순환 참조(Circular Dependency) 감지됨!\n\n다음 순환 경로를 제거한 후 다시 실행해주세요:\n\n${cycleDescriptions}`
          );
          return;
        }

        // A-2: 필수 입력 포트 연결 검증
        const unconnectedInputs: string[] = [];
        filteredModules.forEach((m) => {
          if (m.inputs.length === 0) return;
          m.inputs.forEach((port) => {
            const isConnected = connections.some(
              (c) => c.to.moduleId === m.id && c.to.portName === port.name
            );
            if (!isConnected) {
              unconnectedInputs.push(`• ${m.name}: '${port.name}' 입력 포트 미연결`);
            }
          });
        });

        if (unconnectedInputs.length > 0) {
          console.warn("미연결 입력 포트:\n" + unconnectedInputs.join("\n"));
          // 사용자에게도 안내(비차단). 미연결 입력은 해당 모듈을 건너뛰게 하므로 사전 고지.
          const count = unconnectedInputs.length;
          showToast(
            `입력이 연결되지 않은 포트 ${count}곳이 있어 일부 모듈이 실행되지 않을 수 있습니다. (콘솔에서 상세 확인)`,
            "warning",
            { durationMs: 5000 }
          );
        }
      }

      const runQueue = startModuleId
        ? [startModuleId]
        : isPipelineExplainer
        ? [startModuleId!]
        : getTopologicalSort(filteredModules, connections);

      const log = (moduleId: string, message: string) => {
        setTerminalOutputs((prev) => ({
          ...prev,
          [moduleId]: [
            ...(prev[moduleId] || []),
            `[${new Date().toLocaleTimeString()}] ${message}`,
          ],
        }));
      };

      const modulesToRun = modules.map((m) => ({
        ...m,
        status: runQueue.includes(m.id) ? ModuleStatus.Running : m.status,
      }));
      setModules(modulesToRun);

      // 전역 실행 상태 ON (Run All 버튼 로딩/진행 표시)
      setIsRunning(true);
      setRunProgress({ done: 0, total: runQueue.length });

      try {
        const finalModules = await executePipeline(
          modulesToRun,
          connections,
          runQueue,
          log,
          undefined,
          false
        );

        const failedModuleInQueue = runQueue
          .map((id) => finalModules.find((m) => m.id === id))
          .find((m) => m?.status === ModuleStatus.Error);

        setModules(finalModules);

        if (failedModuleInQueue) {
          const errorMsg = `Pipeline execution failed at module: ${failedModuleInQueue.name}`;
          console.error(errorMsg);
          setIsCodePanelVisible(true);
          setSelectedModuleIds([failedModuleInQueue.id]);
          // 실패 노드가 화면 밖일 수 있으므로 중앙으로 이동.
          centerOnModule(failedModuleInQueue.id);
          // 영문 alert → 한글 토스트(비차단). 클릭 시 원인(터미널) 확인.
          showToast(
            `'${failedModuleInQueue.name}' 모듈에서 실행이 실패했습니다. 클릭하여 원인을 확인하세요.`,
            "error",
            {
              durationMs: 8000,
              actionLabel: "원인 보기",
              onAction: () => {
                setIsCodePanelVisible(true);
                setSelectedModuleIds([failedModuleInQueue.id]);
                centerOnModule(failedModuleInQueue.id);
              },
            }
          );
        } else if (startModuleId) {
          // Reset downstream modules on success
          const adj: Record<string, string[]> = {};
          modules.forEach((m) => {
            adj[m.id] = [];
          });
          connections.forEach((conn) =>
            adj[conn.from.moduleId].push(conn.to.moduleId)
          );
          const descendants = new Set<string>();
          const q = [...(adj[startModuleId] || [])];
          q.forEach((id) => descendants.add(id));
          let head = 0;
          while (head < q.length) {
            const u = q[head++];
            (adj[u] || []).forEach((v) => {
              if (!descendants.has(v)) {
                descendants.add(v);
                q.push(v);
              }
            });
          }
          if (descendants.size > 0) {
            const finalDescendants = Array.from(descendants);
            setModules((prev) =>
              prev.map((m) =>
                finalDescendants.includes(m.id)
                  ? {
                      ...m,
                      status: ModuleStatus.Pending,
                      outputData: undefined,
                    }
                  : m
              )
            );
            setTerminalOutputs((prev) => {
              const newTerminal = { ...prev };
              finalDescendants.forEach((id) => delete newTerminal[id]);
              return newTerminal;
            });
          }
        }

        // 성공 피드백(비차단 토스트). 실패가 없을 때만.
        if (!failedModuleInQueue) {
          const ranCount = runQueue.length;
          showToast(
            startModuleId
              ? "모듈 실행이 완료되었습니다."
              : `전체 실행이 완료되었습니다 (모듈 ${ranCount}개).`,
            "success"
          );
        }
      } catch (error: any) {
        // executePipeline 외부의 예기치 못한 오류(getTopologicalSort/setModules 등) 처리
        console.error("Unexpected error during simulation run:", error);
        showToast(`예기치 못한 오류가 발생했습니다: ${error.message}`, "error");
      } finally {
        // 전역 실행 상태 OFF (Run All 버튼 로딩 해제)
        setIsRunning(false);
        setRunProgress(null);
      }
    },
    [
      modules,
      connections,
      executePipeline,
      runScenarioRunner,
      getTopologicalSort,
      showToast,
      centerOnModule,
    ]
  );

  const adjustScale = (delta: number) => {
    setScale((prev) => Math.max(0.2, Math.min(2, prev + delta)));
  };

  const handleControlsMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    isDraggingControls.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!isDraggingControls.current) return;
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      setControlsPosition((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    };
    const handleWindowMouseUp = () => {
      isDraggingControls.current = false;
    };
    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isEditingText =
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          (activeElement as HTMLElement).isContentEditable);
      if (isEditingText) return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z") {
          e.preventDefault();
          undo();
        } else if (e.key === "y") {
          e.preventDefault();
          redo();
        } else if (e.key === "a") {
          e.preventDefault();
          setSelectedModuleIds(modules.map((m) => m.id));
        } else if (e.key === "c") {
          // 텍스트가 선택돼 있으면 브라우저 기본 복사를 허용(코드/로그 복사 가능)
          const s = window.getSelection();
          if (s && s.toString().trim()) return;
          if (selectedModuleIds.length > 0) {
            e.preventDefault();
            pasteOffset.current = 0;
            const selectedModules = modules.filter((m) =>
              selectedModuleIds.includes(m.id)
            );
            const selectedIdsSet = new Set(selectedModuleIds);
            const internalConnections = connections.filter(
              (c) =>
                selectedIdsSet.has(c.from.moduleId) &&
                selectedIdsSet.has(c.to.moduleId)
            );
            setClipboard({
              modules: JSON.parse(JSON.stringify(selectedModules)),
              connections: JSON.parse(JSON.stringify(internalConnections)),
            });
          }
        } else if (e.key === "v") {
          e.preventDefault();
          if (clipboard) {
            pasteOffset.current += 30;
            const idMap: Record<string, string> = {};
            const newModules = clipboard.modules.map((mod) => {
              const newId = `${mod.type}-${Date.now()}-${Math.random()
                .toString(36)
                .substring(2, 7)}`;
              idMap[mod.id] = newId;
              return {
                ...mod,
                id: newId,
                position: {
                  x: mod.position.x + pasteOffset.current,
                  y: mod.position.y + pasteOffset.current,
                },
                status: ModuleStatus.Pending,
                outputData: undefined,
              };
            });
            const newConnections = clipboard.connections.map((conn) => ({
              ...conn,
              id: `conn-${Date.now()}-${Math.random()
                .toString(36)
                .substring(2, 7)}`,
              from: { ...conn.from, moduleId: idMap[conn.from.moduleId] },
              to: { ...conn.to, moduleId: idMap[conn.to.moduleId] },
            }));
            setModules((prev) => [...prev, ...newModules]);
            setConnections((prev) => [...prev, ...newConnections]);
            setSelectedModuleIds(newModules.map((m) => m.id));
          }
        } else if (e.key === "x") {
          // Cut (copy and delete)
          // 텍스트가 선택돼 있으면 브라우저 기본 잘라내기를 허용
          const s = window.getSelection();
          if (s && s.toString().trim()) return;
          if (selectedModuleIds.length > 0) {
            e.preventDefault();
            pasteOffset.current = 0;
            const selectedModules = modules.filter((m) =>
              selectedModuleIds.includes(m.id)
            );
            const selectedIdsSet = new Set(selectedModuleIds);
            const internalConnections = connections.filter(
              (c) =>
                selectedIdsSet.has(c.from.moduleId) &&
                selectedIdsSet.has(c.to.moduleId)
            );
            setClipboard({
              modules: JSON.parse(JSON.stringify(selectedModules)),
              connections: JSON.parse(JSON.stringify(internalConnections)),
            });
            deleteModules([...selectedModuleIds]);
          }
        } else if (e.key === "s") {
          e.preventDefault();
          handleSavePipeline();
        } else if (e.key === "=" || e.key === "+") {
          // Zoom in (step by step)
          e.preventDefault();
          const newScale = Math.min(2, scale + 0.1);
          setScale(newScale);
        } else if (e.key === "-" || e.key === "_") {
          // Zoom out (step by step)
          e.preventDefault();
          const newScale = Math.max(0.2, scale - 0.1);
          setScale(newScale);
        } else if (e.key === "0") {
          // Fit to view
          e.preventDefault();
          handleFitToView();
        } else if (e.key === "1") {
          // 100% view
          e.preventDefault();
          setScale(1);
          setPan({ x: 0, y: 0 });
        }
      } else if (
        selectedModuleIds.length > 0 &&
        (e.key === "Delete" || e.key === "Backspace")
      ) {
        e.preventDefault();
        deleteModules([...selectedModuleIds]);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedModuleIds,
    undo,
    redo,
    setModules,
    setConnections,
    setSelectedModuleIds,
    modules,
    connections,
    clipboard,
    deleteModules,
    scale,
    setScale,
    setPan,
    handleFitToView,
    handleSavePipeline,
  ]);

  const categorizedModules = [
    { name: "도형메뉴", types: [ModuleType.TextBox, ModuleType.GroupBox] },
    {
      name: "데이터",
      types: [
        ModuleType.DefinePolicyInfo,
        ModuleType.LoadData,
        ModuleType.SelectRiskRates,
        ModuleType.SelectData,
        ModuleType.RateModifier,
      ],
    },
    {
      name: "계리계산",
      types: [
        ModuleType.CalculateSurvivors,
        ModuleType.ClaimsCalculator,
        ModuleType.NxMxCalculator,
        ModuleType.PremiumComponent,
        ModuleType.AdditionalName,
        ModuleType.NetPremiumCalculator,
        ModuleType.GrossPremiumCalculator,
        ModuleType.ReserveCalculator,
      ],
    },
    {
      name: "자동화",
      types: [ModuleType.ScenarioRunner, ModuleType.PipelineExplainer],
    },
  ];

  const handleDragStart = (
    e: DragEvent<HTMLButtonElement>,
    type: ModuleType
  ) => {
    e.dataTransfer.setData("application/reactflow", type);
    e.dataTransfer.effectAllowed = "move";
  };

  const lastSelectedModule = useMemo(() => {
    if (selectedModuleIds.length === 0) return null;
    const lastId = selectedModuleIds[selectedModuleIds.length - 1];
    return modules.find((m) => m.id === lastId) || null;
  }, [selectedModuleIds, modules]);

  // 온보딩 체크리스트 진행도(현재 상태 반영). 엔진 무관, 순수 표시용.
  const onboardingProgress = (() => {
    const hasData = modules.some(
      (m) => m.type === ModuleType.LoadData && m.status === ModuleStatus.Success
    );
    const hasConnections = connections.length > 0;
    const hasParams = modules.some(
      (m) =>
        m.type === ModuleType.NetPremiumCalculator &&
        !!(m.parameters?.formula && String(m.parameters.formula).trim())
    );
    const hasRun = modules.some((m) => m.status === ModuleStatus.Success);
    return { hasData, hasConnections, hasParams, hasRun };
  })();

  return (
    <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white h-screen w-full flex flex-col overflow-hidden transition-colors duration-200">
      {/* 온보딩 가이드(첫 방문) — 4단계 산출 순서 체크리스트 */}
      {showOnboarding && (
        <div
          className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
          onClick={() => dismissOnboarding(false)}
        >
          <div
            className="w-[92vw] max-w-md rounded-2xl shadow-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="시작 가이드"
          >
            <div className="flex items-start justify-between mb-1">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <SparklesIcon className="h-5 w-5 text-blue-500" />
                보험료 산출 시작하기
              </h2>
              <button
                onClick={() => dismissOnboarding(false)}
                className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-full transition-colors"
                aria-label="닫기"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              아래 순서대로 진행하면 순보험료·영업보험료·준비금을 산출할 수 있습니다.
            </p>
            <ol className="space-y-3">
              {[
                {
                  done: onboardingProgress.hasData,
                  title: "1) 위험률 데이터 로드",
                  desc: "왼쪽 [데이터] 메뉴의 “위험률 데이터 로드”로 사망률 등 위험률표(CSV)를 불러옵니다.",
                },
                {
                  done: onboardingProgress.hasConnections,
                  title: "2) 모듈 연결",
                  desc: "노드의 오른쪽 출력 포트를 다음 노드의 왼쪽 입력 포트로 드래그해 연결합니다.",
                },
                {
                  done: onboardingProgress.hasParams,
                  title: "3) 파라미터 입력",
                  desc: "노드의 왼쪽(입력·편집) 영역을 클릭해 가입정보·수식 등 값을 입력합니다.",
                },
                {
                  done: onboardingProgress.hasRun,
                  title: "4) 실행 및 결과 확인",
                  desc: "상단 [전체 실행]으로 파이프라인을 돌리고, 노드 오른쪽(출력·결과)을 클릭해 결과를 봅니다.",
                },
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                      step.done
                        ? "bg-emerald-500 text-white"
                        : "bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-300"
                    }`}
                  >
                    {step.done ? "✓" : i + 1}
                  </span>
                  <div>
                    <p
                      className={`text-sm font-semibold ${
                        step.done
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-gray-900 dark:text-gray-100"
                      }`}
                    >
                      {step.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug">
                      {step.desc}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-5 flex items-center justify-between gap-2">
              <button
                onClick={() => dismissOnboarding(true)}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                다시 보지 않기
              </button>
              <button
                onClick={() => dismissOnboarding(false)}
                className="px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
              >
                시작하기
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 초기 화면 저장 토스트 */}
      {initialSavedToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 border border-gray-700 dark:border-gray-300 flex items-center gap-2 animate-fade-in">
          {initialSavedToast}
        </div>
      )}
      {/* 범용 토스트(실행 결과·경고·오류) — 비차단 알림 */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[10000] px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold flex items-center gap-3 animate-fade-in max-w-[90vw] ${
            toast.kind === "error"
              ? "bg-red-600 text-white border border-red-400"
              : toast.kind === "warning"
              ? "bg-amber-500 text-white border border-amber-300"
              : toast.kind === "success"
              ? "bg-emerald-600 text-white border border-emerald-400"
              : "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 border border-gray-700 dark:border-gray-300"
          }`}
          role="status"
          aria-live="polite"
        >
          <span className="flex-shrink-0">
            {toast.kind === "error"
              ? "⚠"
              : toast.kind === "warning"
              ? "⚠"
              : toast.kind === "success"
              ? "✓"
              : "ℹ"}
          </span>
          <span className="leading-snug">{toast.message}</span>
          {toast.actionLabel && toast.onAction && (
            <button
              onClick={() => {
                toast.onAction?.();
                setToast(null);
              }}
              className="ml-1 px-2 py-0.5 rounded-md bg-white/20 hover:bg-white/30 text-white text-xs font-bold flex-shrink-0 transition-colors"
            >
              {toast.actionLabel}
            </button>
          )}
          <button
            onClick={() => setToast(null)}
            className="ml-1 text-white/80 hover:text-white flex-shrink-0"
            aria-label="닫기"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      )}
      <header className="flex flex-col px-4 py-1.5 bg-white dark:bg-gray-900 border-b border-gray-300 dark:border-gray-700 flex-shrink-0 z-20 relative overflow-visible">
        {/* 첫 번째 줄: 제목 및 모델 이름 */}
        <div className="flex items-center w-full">
          <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
            <LogoIcon className="h-5 w-5 md:h-6 md:w-6 text-blue-500 dark:text-blue-400 flex-shrink-0" />
            <h1 className="text-base md:text-xl font-bold text-blue-600 dark:text-blue-300 tracking-wide flex-shrink-0">
              Life Matrix Flow
            </h1>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-gray-400 dark:text-gray-600 hidden md:inline">|</span>
              {isEditingProductName ? (
                <input
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  onBlur={() => setIsEditingProductName(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Escape") setIsEditingProductName(false);
                  }}
                  className="bg-gray-100 dark:bg-gray-800 text-sm md:text-lg font-semibold text-gray-900 dark:text-white px-2 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
                  autoFocus
                />
              ) : (
                <h2
                  onClick={() => setIsEditingProductName(true)}
                  className="text-sm md:text-lg font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 px-2 py-1 rounded-md cursor-pointer truncate"
                  title="Click to edit product name"
                >
                  {productName}
                </h2>
              )}
            </div>
          </div>
          {/* 우측 상단: 고급기능 잠금/해제 토글 — 다른 버튼과 확실히 차별화 */}
          <button
            onClick={openAdvModal}
            className={`group flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg font-bold tracking-wide transition-all flex-shrink-0 text-white shadow-md hover:shadow-lg hover:-translate-y-px ring-1 ${
              advUnlocked
                ? "bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 shadow-emerald-500/30 ring-emerald-300/60"
                : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-orange-500/40 ring-amber-300/70"
            }`}
            title={
              advUnlocked
                ? "고급 모드 활성화됨 — 클릭하여 잠금 관리"
                : "고급기능 실행 (비밀번호 필요)"
            }
          >
            {advUnlocked ? (
              <LockOpenIcon className="h-4 w-4" />
            ) : (
              <LockClosedIcon className="h-4 w-4 group-hover:scale-110 transition-transform" />
            )}
            <span>{advUnlocked ? "고급 모드 ON" : "고급기능 실행"}</span>
          </button>
        </div>

        {/* 두 번째 줄: 테마, Undo/Redo, Set Folder, Load, Save, Run All */}
        <div className="flex items-center justify-end gap-2 w-full overflow-x-auto scrollbar-hide mt-1">
          <button
            onClick={() => setShowOnboarding(true)}
            className="p-1.5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors flex-shrink-0"
            title="시작 가이드 (산출 4단계 안내)"
          >
            <SparklesIcon className="h-5 w-5 text-blue-500" />
          </button>
          <Tooltip
            content={featureTip(
              "AI 키 설정",
              "AI 기능에 사용할 Gemini API 키를 입력·관리합니다.",
              !advUnlocked
            )}
          >
            <button
              onClick={advUnlocked ? openKeyModal : openAdvModal}
              className="relative p-1.5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors flex-shrink-0"
            >
              <KeyIcon
                className={`h-5 w-5 ${hasKey ? "text-green-500" : "text-gray-400"} ${
                  !advUnlocked ? "opacity-40" : ""
                }`}
              />
              {!advUnlocked ? (
                <LockBadge />
              ) : (
                <span
                  className={`absolute top-1 right-1 block h-2 w-2 rounded-full ring-1 ring-white dark:ring-gray-900 ${
                    hasKey ? "bg-green-500" : "bg-red-500"
                  }`}
                />
              )}
            </button>
          </Tooltip>
          <button
            onClick={toggleTheme}
            className="p-1.5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors flex-shrink-0"
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === "dark" ? (
              <SunIcon className="h-5 w-5 text-yellow-400" />
            ) : (
              <MoonIcon className="h-5 w-5 text-gray-700" />
            )}
          </button>
          <button
            onClick={undo}
            disabled={!canUndo}
            className="p-1.5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md disabled:text-gray-400 dark:disabled:text-gray-600 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            title="Undo (Ctrl+Z)"
          >
            <ArrowUturnLeftIcon className="h-5 w-5" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="p-1.5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md disabled:text-gray-400 dark:disabled:text-gray-600 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            title="Redo (Ctrl+Y)"
          >
            <ArrowUturnRightIcon className="h-5 w-5" />
          </button>
          <div className="h-5 border-l border-gray-700"></div>
          <button
            onClick={handleSetFolder}
            className="flex items-center gap-2 px-3 py-1.5 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-md font-semibold transition-colors flex-shrink-0"
            title="저장 폴더 지정"
          >
            <FolderOpenIcon className="h-4 w-4" />
            <span>폴더 지정</span>
          </button>
          <button
            onClick={handleLoadPipeline}
            className="flex items-center gap-2 px-3 py-1.5 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-md font-semibold transition-colors flex-shrink-0"
            title="파이프라인 불러오기"
          >
            <FolderOpenIcon className="h-4 w-4" />
            <span>불러오기</span>
          </button>
          <button
            onClick={handleSavePipeline}
            disabled={!isDirty}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-md font-semibold transition-colors flex-shrink-0 text-white dark:text-white ${
              !isDirty
                ? "bg-gray-400 dark:bg-gray-600 cursor-not-allowed opacity-50"
                : "bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600"
            }`}
            title="파이프라인 저장"
          >
            {saveButtonText === "저장" ? (
              <ArrowDownTrayIcon className="h-4 w-4" />
            ) : (
              <CheckIcon className="h-4 w-4" />
            )}
            <span>{saveButtonText}</span>
          </button>
          <div className="h-5 border-l border-gray-300 dark:border-gray-700"></div>
          {advUnlocked ? (
            <SlideReportButton productName={productName} modules={modules} />
          ) : (
            <Tooltip
              content={featureTip(
                "PPT 보고서",
                "산출 결과(순보험료·영업보험료 등)를 슬라이드(PPT) 보고서로 자동 생성해 다운로드합니다.",
                true
              )}
            >
              <button
                onClick={openAdvModal}
                className="relative flex items-center px-3 py-1.5 text-xs rounded-md font-semibold transition-colors flex-shrink-0 text-white bg-indigo-700"
              >
                <span className="flex items-center gap-2 opacity-40">
                  <span>📊</span>
                  <span>PPT 보고서</span>
                </span>
                <LockBadge />
              </button>
            </Tooltip>
          )}
          {advUnlocked ? (
            <RecomputeExportButton productName={productName} modules={modules} />
          ) : (
            <Tooltip
              content={featureTip(
                "재계산 함수",
                "보험료/준비금 산출을 외부에서 동일하게 재현할 수 있는 TypeScript 함수(.ts)로 내보냅니다.",
                true
              )}
            >
              <button
                onClick={openAdvModal}
                className="relative flex items-center px-3 py-1.5 text-xs rounded-md font-semibold transition-colors flex-shrink-0 text-white bg-teal-700"
              >
                <span className="flex items-center gap-2 opacity-40">
                  <span>🧮</span>
                  <span>재계산 함수</span>
                </span>
                <LockBadge />
              </button>
            </Tooltip>
          )}
          <div className="h-5 border-l border-gray-300 dark:border-gray-700"></div>
          <button
            onClick={() => runSimulation()}
            disabled={isRunning}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-md font-semibold transition-colors flex-shrink-0 text-white ${
              isRunning
                ? "bg-green-700 cursor-wait opacity-80"
                : "bg-green-600 hover:bg-green-500"
            }`}
            title={isRunning ? "실행 중입니다…" : "전체 모듈 실행 (Run All)"}
          >
            {isRunning ? (
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
            ) : (
              <PlayIcon className="h-4 w-4" />
            )}
            <span>{isRunning ? "실행 중…" : "전체 실행"}</span>
          </button>
          <div className="h-5 border-l border-gray-300 dark:border-gray-700"></div>
          <Tooltip
            content={featureTip(
              "AI 생성",
              "목표를 입력하면 AI가 보험료 산출 파이프라인을 자동 설계·생성합니다. (Gemini API 키 필요)",
              !advUnlocked
            )}
          >
            <button
              onClick={advUnlocked ? () => setIsAIGoalModalOpen(true) : openAdvModal}
              disabled={isGeneratingPipeline}
              className="relative flex items-center px-3 py-1.5 text-xs rounded-md font-semibold transition-colors flex-shrink-0 bg-purple-600 hover:bg-purple-500 disabled:cursor-not-allowed text-white"
            >
              <span className={`flex items-center gap-2 ${!advUnlocked ? "opacity-40" : ""}`}>
                <SparklesIcon className="w-4 h-4" />
                <span>{isGeneratingPipeline ? 'AI 생성 중...' : 'AI 생성'}</span>
              </span>
              {!advUnlocked && <LockBadge />}
            </button>
          </Tooltip>
        </div>

        {/* 세 번째 줄: 햄버거(사이드바), Samples, My Work(왼쪽) | Code/Terminal(오른쪽) */}
        <div className="flex items-center justify-between gap-1 md:gap-2 w-full mt-1 overflow-visible">
          <div className="flex items-center gap-1 md:gap-2">
            <button
              onClick={() => setIsSidebarVisible((prev) => !prev)}
              className="p-1.5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors flex-shrink-0"
              aria-label="Toggle modules panel"
              title="Toggle Module Sidebar"
            >
              <Bars3Icon className="h-5 w-5" />
            </button>
            <div className="h-5 border-l border-gray-300 dark:border-gray-700"></div>
            <button
              onClick={() => {
                setIsSampleMenuOpen(true);
                setIsSamplesMenuOpen(false);
                setIsMyWorkMenuOpen(false);
              }}
              className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-md font-semibold transition-colors flex-shrink-0 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-200"
              title="예제 모음"
            >
              <BeakerIcon className="h-4 w-4" />
              <span>예제</span>
            </button>
            <Tooltip
              content={featureTip(
                "DSL 정의",
                "파이프라인 전체를 '출력=수식' 텍스트(DSL)로 한 번에 정의·편집합니다. 모듈↔코드가 양방향 동기화됩니다.",
                !advUnlocked
              )}
            >
              <button
                onClick={advUnlocked ? () => setIsDSLModalOpen(true) : openAdvModal}
                className="relative flex items-center px-3 py-1.5 text-xs rounded-md font-semibold transition-colors flex-shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                <span className={`flex items-center gap-2 ${!advUnlocked ? "opacity-40" : ""}`}>
                  <span>📝</span>
                  <span>DSL 정의</span>
                </span>
                {!advUnlocked && <LockBadge />}
              </button>
            </Tooltip>
            <div className="relative flex-shrink-0" style={{ zIndex: 1000 }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMyWorkMenuOpen(!isMyWorkMenuOpen);
                  setIsSamplesMenuOpen(false);
                }}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-md font-semibold transition-colors flex-shrink-0 ${
                  isMyWorkMenuOpen
                    ? "bg-purple-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-200"
                }`}
                title="내 작업"
              >
                <FolderOpenIcon className="h-4 w-4" />
                <span>내 작업</span>
              </button>
              {isMyWorkMenuOpen && (
                <div
                  className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-xl min-w-[200px]"
                  style={{ zIndex: 9999 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={handleLoadPersonalWorkFromFile}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer flex items-center gap-2 border-b border-gray-200 dark:border-gray-700"
                  >
                    <FolderOpenIcon className="w-4 h-4 text-blue-400" />
                    <span>파일에서 불러오기</span>
                  </button>
                  <button
                    onClick={handleSaveToPersonalWork}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer flex items-center gap-2 border-b border-gray-200 dark:border-gray-700"
                  >
                    <PlusIcon className="w-4 h-4 text-blue-400" />
                    <span>현재 모델 저장</span>
                  </button>
                  <button
                    onClick={
                      advUnlocked
                        ? handleSetAsInitial
                        : () => {
                            setIsMyWorkMenuOpen(false);
                            openAdvModal();
                          }
                    }
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer flex items-center gap-2 border-b border-gray-200 dark:border-gray-700"
                    title={advUnlocked ? "현재 캔버스 모델을 앱 시작 기본 화면으로 저장합니다" : "고급기능 — 잠금 해제 필요"}
                  >
                    {advUnlocked ? (
                      <SparklesIcon className="w-4 h-4 text-yellow-400" />
                    ) : (
                      <LockClosedIcon className="w-4 h-4 text-amber-500" />
                    )}
                    <div className={`flex flex-col ${!advUnlocked ? "opacity-40" : ""}`}>
                      <span className="text-green-400">초기 화면으로 설정</span>
                      <span className="text-[10px] text-gray-400">현재 모델을 앱 시작 기본값으로 저장</span>
                    </div>
                  </button>
                  <div className="p-2 text-xs font-bold text-gray-500 dark:text-gray-500 uppercase border-b border-gray-200 dark:border-gray-700">
                    My Saved Models
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {personalWork.length === 0 ? (
                      <div className="px-4 py-2 text-sm text-gray-400 last:rounded-b-md">저장된 모델이 없습니다</div>
                    ) : (
                      personalWork.map((work, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between group border-b border-gray-200 dark:border-gray-700 last:border-0 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <button
                            onClick={() => handleLoadSample(work)}
                            className="flex-1 text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors last:rounded-b-md"
                          >
                            {work.name}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePersonalWork(work.name, idx);
                            }}
                            className="px-3 py-2 text-gray-400 hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100"
                            title={`Delete "${work.name}"`}
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 md:gap-2 ml-auto">
            <button
              onClick={() => setIsCodePanelVisible((prev) => !prev)}
              className="p-1.5 md:p-1.5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors flex-shrink-0"
              title="코드 · 터미널 패널 열기/닫기"
            >
              <CommandLineIcon className="h-4 w-4 md:h-5 md:w-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-grow min-h-0 flex flex-col">
        <div className="flex items-center gap-0 border-b border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 flex-shrink-0 overflow-x-auto scrollbar-hide min-h-0 relative">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setEditingTabId(tab.id);
                setEditingTabName(tab.name);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setTabContextMenu({ tabId: tab.id, x: e.clientX, y: e.clientY });
              }}
              className={`flex items-center min-w-0 max-w-[140px] px-2 py-1 cursor-pointer border-r border-gray-300 dark:border-gray-600 select-none ${
                tab.backgroundColor
                  ? (activeTabId === tab.id ? "text-blue-600 dark:text-blue-400 font-semibold" : "text-gray-700 dark:text-gray-300 hover:opacity-90")
                  : (activeTabId === tab.id ? "bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 font-semibold" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700")
              }`}
              style={tab.backgroundColor ? { backgroundColor: tab.backgroundColor } : undefined}
            >
              {editingTabId === tab.id ? (
                <input
                  type="text"
                  value={editingTabName}
                  onChange={(e) => setEditingTabName(e.target.value)}
                  onBlur={() => handleTabRename(tab.id, editingTabName)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleTabRename(tab.id, editingTabName);
                    if (e.key === "Escape") { setEditingTabName(tab.name); setEditingTabId(null); }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full bg-transparent border border-blue-500 rounded px-1 py-0.5 text-xs text-gray-900 dark:text-white focus:outline-none"
                  autoFocus
                />
              ) : (
                <span className="truncate text-xs">{tab.name}</span>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleAddTab(); }}
            className="flex-shrink-0 p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors"
            title="탭 추가"
            aria-label="탭 추가"
          >
            <PlusIcon className="h-4 w-4" />
          </button>
          {tabContextMenu && (
            <div
              ref={tabContextMenuRef}
              className="fixed z-[9999] min-w-[140px] py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg"
              style={{ left: tabContextMenu.x, top: tabContextMenu.y }}
            >
              <button
                type="button"
                onClick={() => {
                  const tab = tabs.find((t) => t.id === tabContextMenu.tabId);
                  if (tab) {
                    setEditingTabId(tab.id);
                    setEditingTabName(tab.name);
                    setTabContextMenu(null);
                  }
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                이름 바꾸기
              </button>
              <div className="border-t border-gray-200 dark:border-gray-600 my-1" />
              <div className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400">배경색</div>
              <div className="flex flex-wrap gap-1 px-2 pb-1">
                {[
                  { label: "기본", value: undefined },
                  { label: "흰색", value: "#ffffff" },
                  { label: "회색", value: "#9ca3af" },
                  { label: "검정", value: "#111827" },
                  { label: "파란", value: "#3b82f6" },
                  { label: "빨간", value: "#ef4444" },
                ].map(({ label, value }) => (
                  <button
                    key={value ?? "default"}
                    type="button"
                    onClick={() => handleTabBackgroundColor(tabContextMenu.tabId, value)}
                    className={`px-2 py-1 text-xs rounded border ${value ? "" : "border-gray-300 dark:border-gray-600"} hover:bg-gray-100 dark:hover:bg-gray-700`}
                    style={value ? { backgroundColor: value } : undefined}
                    title={value ?? "테마 기본"}
                  >
                    {label ?? ""}
                  </button>
                ))}
              </div>
              <div className="border-t border-gray-200 dark:border-gray-600 my-1" />
              <button
                type="button"
                onClick={() => handleDeleteTab(tabContextMenu.tabId)}
                disabled={tabs.length <= 1}
                className="w-full text-left px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                탭 삭제
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-1 min-h-0 flex flex-row">
        {isSidebarVisible && (
          <div className="flex-shrink-0 bg-gray-100 dark:bg-gray-800 border-r border-gray-300 dark:border-gray-700 z-10 p-2 relative w-64 overflow-y-auto scrollbar-hide">
            <div className="flex flex-col gap-1">
              {/* Pipeline Execution Button - Above Data Category */}
              <button
                onClick={() => setIsPipelineExecutionModalOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 rounded-md font-semibold text-white transition-colors w-full justify-center mb-1"
                title="파이프라인 실행 (Pipeline Execution)"
              >
                <QueueListIcon className="h-4 w-4" />
                파이프라인 실행
              </button>
              {/* 모듈 추가 방법 안내 */}
              <p className="text-[10px] leading-snug text-gray-500 dark:text-gray-400 px-1 pb-1 mb-1 border-b border-gray-200 dark:border-gray-700">
                아래 모듈을 클릭하거나 캔버스로 끌어다 놓으면 추가됩니다.
              </p>
              {categorizedModules.map((category, index) => {
                const isCollapsed = collapsedCategories.has(category.name);
                const isShapeMenu = category.name === "도형메뉴";
                const isFirstShapeMenu = isShapeMenu && index === 0;
                const toggleCategory = () => {
                  setCollapsedCategories((prev) => {
                    const newSet = new Set(prev);
                    if (newSet.has(category.name)) {
                      newSet.delete(category.name);
                    } else {
                      newSet.add(category.name);
                    }
                    return newSet;
                  });
                };

                return (
                  <div
                    key={category.name}
                    className={`flex flex-col ${
                      isShapeMenu ? "gap-0" : "gap-2"
                    } ${isFirstShapeMenu ? "mt-0" : ""}`}
                  >
                    {!isShapeMenu && (
                      <button
                        onClick={toggleCategory}
                        className="flex items-center justify-between text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300 whitespace-nowrap w-full text-left px-1 py-1 rounded transition-colors"
                      >
                        <span>{category.name}</span>
                        {isCollapsed ? (
                          <ChevronDownIcon className="h-4 w-4 flex-shrink-0" />
                        ) : (
                          <ChevronUpIcon className="h-4 w-4 flex-shrink-0" />
                        )}
                      </button>
                    )}
                    {(!isCollapsed || isShapeMenu) && (
                      <div
                        className={
                          isShapeMenu
                            ? "flex flex-row items-center justify-between gap-2"
                            : "flex flex-col gap-2"
                        }
                      >
                        {isShapeMenu ? (
                          <>
                            <div className="flex flex-row gap-1 items-center">
                              {TOOLBOX_MODULES.filter((m) =>
                                category.types.includes(m.type)
                              ).map((moduleInfo) => {
                                const handleClick = () => {
                                  if (moduleInfo.type === ModuleType.GroupBox) {
                                    // Create group box from selected modules
                                    if (selectedModuleIds.length === 0) {
                                      alert(
                                        "그룹을 만들려면 먼저 모듈을 선택하세요."
                                      );
                                      return;
                                    }
                                    const selectedModules = modules.filter(
                                      (m) =>
                                        selectedModuleIds.includes(m.id) &&
                                        m.type !== ModuleType.GroupBox &&
                                        m.type !== ModuleType.TextBox
                                    );
                                    if (selectedModules.length === 0) {
                                      alert("그룹에 포함할 모듈이 없습니다.");
                                      return;
                                    }

                                    // Calculate bounds
                                    const moduleWidth = 224;
                                    const moduleHeight = 80;
                                    let minX = Infinity,
                                      minY = Infinity,
                                      maxX = -Infinity,
                                      maxY = -Infinity;

                                    selectedModules.forEach((m) => {
                                      minX = Math.min(minX, m.position.x);
                                      minY = Math.min(minY, m.position.y);
                                      maxX = Math.max(
                                        maxX,
                                        m.position.x + moduleWidth
                                      );
                                      maxY = Math.max(
                                        maxY,
                                        m.position.y + moduleHeight
                                      );
                                    });

                                    const padding = 20;
                                    const bounds = {
                                      x: minX - padding,
                                      y: minY - padding,
                                      width: maxX - minX + padding * 2,
                                      height: maxY - minY + padding * 2,
                                    };

                                    const groupModule: CanvasModule = {
                                      id: `group-${Date.now()}`,
                                      name: `그룹 ${
                                        modules.filter(
                                          (m) => m.type === ModuleType.GroupBox
                                        ).length + 1
                                      }`,
                                      type: ModuleType.GroupBox,
                                      position: { x: bounds.x, y: bounds.y },
                                      status: ModuleStatus.Pending,
                                      parameters: {
                                        moduleIds: selectedModules.map(
                                          (m) => m.id
                                        ),
                                        bounds: bounds,
                                        fontSize: 12,
                                      },
                                      inputs: [],
                                      outputs: [],
                                    };

                                    setModules((prev) => [
                                      ...prev,
                                      groupModule,
                                    ]);
                                    setSelectedModuleIds([groupModule.id]);
                                    setIsDirty(true);
                                  } else {
                                    createModule(moduleInfo.type);
                                  }
                                };

                                return (
                                  <div
                                    key={moduleInfo.type}
                                    className="relative group"
                                  >
                                    <button
                                      onClick={handleClick}
                                      onDoubleClick={() =>
                                        createModule(moduleInfo.type)
                                      }
                                      draggable
                                      onDragStart={(e) =>
                                        handleDragStart(e, moduleInfo.type)
                                      }
                                      className="p-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors"
                                      title={(moduleInfo as any).nameKo || moduleInfo.name}
                                    >
                                      <moduleInfo.icon className="h-4 w-4 text-gray-700 dark:text-gray-300" />
                                    </button>
                                    {/* Tooltip */}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-0.5 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                                      {(moduleInfo as any).nameKo || moduleInfo.name}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="flex gap-1 ml-auto">
                              <button
                                onClick={() => adjustFontSize(true)}
                                className="p-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors"
                                title="글자 크게"
                              >
                                <FontSizeIncreaseIcon className="h-4 w-4 text-gray-300" />
                              </button>
                              <button
                                onClick={() => adjustFontSize(false)}
                                className="p-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors"
                                title="글자 작게"
                              >
                                <FontSizeDecreaseIcon className="h-4 w-4 text-gray-300" />
                              </button>
                            </div>
                          </>
                        ) : (
                          TOOLBOX_MODULES.filter((m) =>
                            category.types.includes(m.type)
                          ).map((moduleInfo) => {
                            const handleClick = () => {
                              createModule(moduleInfo.type);
                            };

                            return (
                              <button
                                key={moduleInfo.type}
                                onClick={handleClick}
                                onDoubleClick={() =>
                                  createModule(moduleInfo.type)
                                }
                                draggable
                                onDragStart={(e) =>
                                  handleDragStart(e, moduleInfo.type)
                                }
                                className="flex items-center gap-2 px-3 py-1.5 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-200 rounded-md font-semibold transition-colors whitespace-nowrap w-full text-left"
                                title={`${(moduleInfo as any).nameKo || moduleInfo.name}\n${(moduleInfo as any).descriptionKo || moduleInfo.description}`}
                              >
                                <moduleInfo.icon className="h-4 w-4 flex-shrink-0" />
                                {(moduleInfo as any).nameKo || moduleInfo.name}
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                    {index < categorizedModules.length - 1 && !isShapeMenu && (
                      <div className="w-full h-px bg-gray-600 my-2"></div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <main
          ref={canvasContainerRef}
          className={`flex-grow h-full relative overflow-hidden ${theme === "dark" ? "canvas-bg" : "canvas-bg-light"}`}
        >
          <Canvas
            modules={modules}
            connections={connections}
            setConnections={setConnections}
            selectedModuleIds={selectedModuleIds}
            setSelectedModuleIds={setSelectedModuleIds}
            updateModulePositions={updateModulePositions}
            onModuleDrop={(type, pos) => createModule(type, pos)}
            scale={scale}
            setScale={setScale}
            pan={pan}
            setPan={setPan}
            canvasContainerRef={canvasContainerRef}
            onViewDetails={handleViewDetails}
            onEditParameters={handleEditParameters}
            onRunModule={(id) => runSimulation(id)}
            onDeleteModule={(id) => deleteModules([id])}
            onUpdateModuleName={updateModuleName}
            onUpdateModuleParameters={updateModuleParameters}
            onConnectionRejected={(message) => showToast(message, "warning", { durationMs: 4500 })}
          />
          <div
            onMouseDown={handleControlsMouseDown}
            style={{
              transform: `translate(calc(-50% + ${controlsPosition.x}px), ${controlsPosition.y}px)`,
              cursor: "grab",
            }}
            className={`absolute bottom-8 left-1/2 -translate-x-1/2 backdrop-blur-md rounded-full px-4 py-2 flex items-center gap-4 shadow-2xl z-50 select-none transition-transform active:scale-95 ${
              theme === "dark"
                ? "bg-gray-900/80 border border-gray-700"
                : "bg-white/90 border border-gray-300"
            }`}
          >
            <div className="flex items-center gap-1">
              <button
                onClick={() => adjustScale(-0.1)}
                className={`p-2 rounded-full transition-colors ${
                  theme === "dark"
                    ? "hover:bg-gray-700/50 text-gray-400 hover:text-white"
                    : "hover:bg-gray-200 text-gray-600 hover:text-gray-900"
                }`}
              >
                <MinusIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  setScale(1);
                  setPan({ x: 0, y: 0 });
                }}
                className={`px-2 text-sm font-medium min-w-[3rem] text-center ${
                  theme === "dark"
                    ? "text-gray-300 hover:text-white"
                    : "text-gray-700 hover:text-gray-900"
                }`}
                title="Reset View"
              >
                {Math.round(scale * 100)}%
              </button>
              <button
                onClick={() => adjustScale(0.1)}
                className={`p-2 rounded-full transition-colors ${
                  theme === "dark"
                    ? "hover:bg-gray-700/50 text-gray-400 hover:text-white"
                    : "hover:bg-gray-200 text-gray-600 hover:text-gray-900"
                }`}
              >
                <PlusIcon className="w-5 h-5" />
              </button>
            </div>

            <div
              className={`w-px h-4 ${
                theme === "dark" ? "bg-gray-700" : "bg-gray-300"
              }`}
            ></div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleFitToView}
                className={`p-2 rounded-full transition-colors ${
                  theme === "dark"
                    ? "hover:bg-gray-700/50 text-gray-400 hover:text-white"
                    : "hover:bg-gray-200 text-gray-600 hover:text-gray-900"
                }`}
                title="Fit to View"
              >
                <ArrowsPointingOutIcon className="w-5 h-5" />
              </button>
              <button
                onClick={handleRearrangeModules}
                className={`p-2 rounded-full transition-colors ${
                  theme === "dark"
                    ? "hover:bg-gray-700/50 text-gray-400 hover:text-white"
                    : "hover:bg-gray-200 text-gray-600 hover:text-gray-900"
                }`}
                title="Auto Layout"
              >
                <SparklesIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </main>
        <CodeTerminalPanel
          isVisible={isCodePanelVisible}
          onClose={() => setIsCodePanelVisible(false)}
          selectedModule={lastSelectedModule}
          terminalOutput={
            lastSelectedModule
              ? terminalOutputs[lastSelectedModule.id] || []
              : []
          }
          productName={productName}
          policyInfoModule={
            modules.find((m) => m.type === ModuleType.DefinePolicyInfo) ?? null
          }
          onApplyModuleDSL={(id, params) =>
            updateModuleParameters(id, params, false)
          }
        />
        </div>
      </div>

      {editingModule && (
        <ParameterInputModal
          module={editingModule}
          onClose={(shouldRestore?: boolean, skipStatusReset?: boolean) => {
            if (editingModule) {
              const initialState = moduleInitialStateRef.current.get(editingModule.id);

              if (shouldRestore) {
                // 취소/변경없음 → 편집 전 상태(params + status + outputData) 전체 복원
                if (initialState) {
                  setModules((prevModules) =>
                    prevModules.map((m) => {
                      if (m.id === editingModule.id) {
                        return {
                          ...m,
                          parameters: initialState.parameters,
                          status: initialState.status,
                          outputData: initialState.outputData,
                        };
                      }
                      const ds = initialState.downstreamStates.get(m.id);
                      return ds ? { ...m, status: ds.status, outputData: ds.outputData } : m;
                    })
                  );
                }
              } else if (!skipStatusReset) {
                // 저장 후 닫기 → 파라미터 실제 변경 여부 확인 후 Pending 처리
                if (initialState) {
                  setModules((prevModules) => {
                    const current = prevModules.find((m) => m.id === editingModule.id);
                    if (!current) return prevModules;

                    const paramsChanged =
                      JSON.stringify(current.parameters) !==
                      JSON.stringify(initialState.parameters);

                    if (!paramsChanged) {
                      // 변경 없음 → status/outputData 유지
                      return prevModules;
                    }

                    // 변경 있음 → 현재 모듈 + 다운스트림 Pending으로 리셋
                    const adj: Record<string, string[]> = {};
                    connections.forEach((conn) => {
                      if (!adj[conn.from.moduleId]) adj[conn.from.moduleId] = [];
                      adj[conn.from.moduleId].push(conn.to.moduleId);
                    });
                    const toReset = new Set<string>();
                    const q = [editingModule.id];
                    while (q.length > 0) {
                      const cid = q.shift()!;
                      (adj[cid] || []).forEach((child) => {
                        if (!toReset.has(child)) { toReset.add(child); q.push(child); }
                      });
                    }
                    // DefinePolicyInfo 저장 시 basicValues 변경이면 AdditionalName + 그 downstream도 리셋
                    if (editingModule.type === ModuleType.DefinePolicyInfo) {
                      const oldBV = JSON.stringify(initialState.parameters.basicValues ?? []);
                      const newBV = JSON.stringify(current.parameters.basicValues ?? []);
                      if (oldBV !== newBV) {
                        const addMod = prevModules.find((m) => m.type === ModuleType.AdditionalName);
                        if (addMod) {
                          const q2 = [addMod.id];
                          while (q2.length > 0) {
                            const cid = q2.shift()!;
                            (adj[cid] || []).forEach((child) => {
                              if (!toReset.has(child)) { toReset.add(child); q2.push(child); }
                            });
                          }
                          toReset.add(addMod.id);
                        }
                      }
                    }

                    return prevModules.map((m) => {
                      if (m.id === editingModule.id)
                        return { ...m, status: ModuleStatus.Pending, outputData: undefined };
                      if (toReset.has(m.id))
                        return { ...m, status: ModuleStatus.Pending, outputData: undefined };
                      return m;
                    });
                  });
                }
              }

              moduleInitialStateRef.current.delete(editingModule.id);
            }
            setEditingModuleId(null);
          }}
          updateModuleParameters={updateModuleParameters}
          modules={modules}
          connections={connections}
          projectName={productName}
          folderHandle={folderHandleRef.current}
          onRunModule={async (id) => {
            await runSimulation(id);
          }}
          onModuleSaved={handleModuleSaved}
        />
      )}

      {renderOutputModal()}

      {isPipelineExecutionModalOpen && (
        <PipelineExecutionModal
          modules={modules}
          connections={connections}
          onClose={() => setIsPipelineExecutionModalOpen(false)}
          onUpdateModule={(id, updates) => {
            if (updates.parameters) {
              const currentModule = modules.find((m) => m.id === id);
              if (currentModule) {
                updateModuleParameters(id, {
                  ...currentModule.parameters,
                  ...updates.parameters,
                });
              } else {
                updateModuleParameters(id, updates.parameters);
              }
            }
            if (updates.name) {
              updateModuleName(id, updates.name);
            }
          }}
          onRunModule={async (id) => {
            await runSimulation(id);
          }}
          getTopologicalSort={getTopologicalSort}
          executePipeline={executePipeline}
          folderHandle={folderHandleRef.current}
        />
      )}

      {/* Overwrite Confirmation Dialog */}
      {showOverwriteConfirm && pendingSample && overwriteContext && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 text-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4">
              {overwriteContext === 'shared' ? 'Overwrite Shared Sample?' : 'Overwrite Personal Work?'}
            </h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-6">
              {overwriteContext === 'shared' 
                ? `A shared sample with the name "${pendingSample.name}" already exists. Do you want to overwrite it?`
                : `Personal work with the name "${pendingSample.name}" already exists. Do you want to overwrite it?`}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={handleCancelOverwrite}
                className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-md font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmOverwrite}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 rounded-md font-semibold transition-colors"
              >
                Overwrite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 모델 저장 옵션 모달(데이터 포함/제외/웹 등록/설명) */}
      <SaveModelOptionsModal
        isOpen={saveOptions.open}
        title="내 작업으로 저장"
        defaultName={saveOptions.name}
        loaders={saveOptions.loaders}
        embedLimitMB={EMBED_SIZE_LIMIT_MB}
        isSaving={isSavingModel}
        onConfirm={performModelSave}
        onClose={() => setSaveOptions((s) => ({ ...s, open: false }))}
      />

      {/* Samples Modal */}
      <SamplesModal
        isOpen={isSampleMenuOpen}
        onClose={() => setIsSampleMenuOpen(false)}
        samples={folderSamples}
        onLoadSample={handleLoadSample}
        onRefresh={loadFolderSamplesLocal}
        isLoading={isLoadingSamples}
      />

      {/* Samples Management Modal */}
      <SamplesManagementModal
        isOpen={isSamplesManagementOpen}
        onClose={() => setIsSamplesManagementOpen(false)}
        onRefresh={() => {
          loadFolderSamplesLocal();
        }}
      />

      {/* Policy Setup Modal */}
      {isPolicySetupModalOpen && (
        <PolicySetupModal
          isOpen={isPolicySetupModalOpen}
          onClose={() => setIsPolicySetupModalOpen(false)}
          productName={productName}
          modules={modules}
          onApply={handlePolicySetupApply}
        />
      )}

      {/* Pipeline DSL Modal */}
      {isDSLModalOpen && (
        <PipelineDSLModal
          isOpen={isDSLModalOpen}
          onClose={() => setIsDSLModalOpen(false)}
          productName={productName}
          modules={modules}
          onBuildPipeline={handleBuildPipelineFromDSL}
          onPatchParameters={handlePatchParametersFromDSL}
        />
      )}

      {/* AI Pipeline From Goal Modal */}
      <AIPipelineFromGoalModal
        isOpen={isAIGoalModalOpen}
        onClose={() => setIsAIGoalModalOpen(false)}
        onSubmit={handleGeneratePipelineFromGoal}
      />

      {/* AI Plan Display Modal */}
      <AIPlanDisplayModal
        isOpen={isAIPlanModalOpen}
        onClose={() => setIsAIPlanModalOpen(false)}
        plan={aiGeneratedPlan}
        onApply={handleApplyAIPlan}
      />
    </div>
  );
};

export default App;
