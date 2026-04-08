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
} from "./components/icons";
import useHistoryState from "./hooks/useHistoryState";
import { useTheme } from "./contexts/ThemeContext";
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
import { SlideReportButton } from "./components/SlideReportButton";
import { loadModuleDefault } from "./utils/moduleDefaults";
import { buildPipelineFromModel } from "./utils/pipelineBuilder";
import { generateDSL } from "./utils/dslParser";
import { GoogleGenAI } from "@google/genai";
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
    name: moduleInfo.name,
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
      formula: "[BPV_Mortality] / [NNX_Mortality(Year)]",
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
      formulaForPaymentTermOrLess: "",
      formulaForGreaterThanPaymentTerm: "",
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

const App: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
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
  const [saveButtonText, setSaveButtonText] = useState("Save");
  const [initialSavedToast, setInitialSavedToast] = useState<string | null>(null);

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
    const newScale = Math.min(scaleX, scaleY, 1);

    const newPanX =
      (canvasRect.width - contentWidth * newScale) / 2 - minX * newScale;
    const newPanY =
      (canvasRect.height - contentHeight * newScale) / 2 - minY * newScale;

    setScale(newScale);
    setPan({ x: newPanX, y: newPanY });
  }, [modules]);

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
          setSaveButtonText("Saved!");
          setTimeout(() => setSaveButtonText("Save"), 2000);
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
      if (isSupabaseConfigured()) {
        const list = await fetchAutoflowSamplesList();
        if (list.length > 0) {
          console.log(`Loaded ${list.length} samples from Supabase (autoflow_samples)`);
          setFolderSamples(
            list.map((s) => ({
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
            }))
          );
          return;
        }
      }

      const response = await fetch("/samples/samples.json");
      if (response.ok) {
        const samples = await response.json();
        if (Array.isArray(samples) && samples.length > 0) {
          console.log(`Loaded ${samples.length} samples from samples.json`);
          setFolderSamples(samples.map((s: any) => ({ ...s, category: s.category || "기타" })));
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
            const defaultName = moduleInfo ? moduleInfo.name : m.type;
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

  // Save to personal work (localStorage)
  const handleSaveToPersonalWork = () => {
    const newSample = createCleanSample();

    // Check if work with same name exists
    const existingIndex = personalWork.findIndex((s) => s.name === productName);

    if (existingIndex >= 0) {
      // Show overwrite confirmation
      setPendingSample(newSample);
      setOverwriteContext('personal');
      setShowOverwriteConfirm(true);
    } else {
      // Add new work
      const updatedWork = [...personalWork, newSample];
      setPersonalWork(updatedWork);
      savePersonalWork(updatedWork);
      setIsMyWorkMenuOpen(false);
    }
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
    setIsGeneratingPipeline(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
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
      const baseName = moduleInfo ? moduleInfo.name : type;
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

  const roundTo5 = (num: number) => {
    return Number(num.toFixed(5));
  };

  const roundTo8 = (num: number) => {
    return Number(num.toFixed(8));
  };

  const getTopologicalSort = useCallback(
    (nodes: CanvasModule[], edges: Connection[]): string[] => {
      const adj: Record<string, string[]> = {};
      const inDegree: Record<string, number> = {};

      nodes.forEach((m) => {
        adj[m.id] = [];
        inDegree[m.id] = 0;
      });

      edges.forEach((conn) => {
        if (
          adj[conn.from.moduleId] &&
          inDegree[conn.to.moduleId] !== undefined
        ) {
          adj[conn.from.moduleId].push(conn.to.moduleId);
          inDegree[conn.to.moduleId]++;
        }
      });

      const queue = nodes.filter((m) => inDegree[m.id] === 0).map((m) => m.id);
      const sorted: string[] = [];

      while (queue.length > 0) {
        const u = queue.shift()!;
        sorted.push(u);

        (adj[u] || []).forEach((v) => {
          if (inDegree[v] !== undefined) {
            inDegree[v]--;
            if (inDegree[v] === 0) {
              queue.push(v);
            }
          }
        });
      }

      // Add remaining nodes (cycles or disjoint parts that weren't caught)
      nodes.forEach((m) => {
        if (!sorted.includes(m.id)) sorted.push(m.id);
      });

      return sorted;
    },
    []
  );

  // D-1: 수식 보안 검증 - 허용된 문자만 포함하는지 확인 (코드 인젝션 방어)
  // 허용: 숫자(과학 표기법 포함), 사칙연산자(+,-,*,/,**,%), 괄호, 공백, 비교/논리 연산자
  // 차단: 문자열 리터럴, 함수 호출, 변수 참조, 브라우저 API 접근 등
  const validateFormulaExpression = (expression: string): void => {
    if (/[^0-9+\-*/%.()\s<>!=?:&|eE]/.test(expression)) {
      throw new Error(
        `수식에 허용되지 않은 문자가 포함되어 있습니다. 미해결 변수가 있거나 허용되지 않는 함수가 포함된 경우 해당 오류가 발생합니다: ${expression}`
      );
    }
  };

  // Helper function to process IF statements in formulas
  const processIfStatements = (expression: string): string => {
    // Convert IF(condition, true_value, false_value) to JavaScript ternary operator
    // Handle nested IF statements by processing from innermost to outermost
    let processed = expression;
    let changed = true;

    while (changed) {
      changed = false;
      // Match IF(condition, true_value, false_value) - handles nested parentheses
      const ifPattern =
        /IF\s*\(([^()]*(?:\([^()]*(?:\([^()]*\)[^()]*)*\)[^()]*)*),\s*([^,()]*(?:\([^()]*(?:\([^()]*\)[^()]*)*\)[^()]*)*),\s*([^()]*(?:\([^()]*(?:\([^()]*\)[^()]*)*\)[^()]*)*)\)/g;

      processed = processed.replace(
        ifPattern,
        (match, condition, trueValue, falseValue) => {
          changed = true;
          return `(${condition.trim()} ? ${trueValue.trim()} : ${falseValue.trim()})`;
        }
      );
    }

    return processed;
  };

  const executePipeline = useCallback(
    async (
      pipelineModules: CanvasModule[],
      pipelineConnections: Connection[],
      runQueue: string[],
      logFn: (moduleId: string, message: string) => void,
      overriddenParams: Record<string, Record<string, any>> | undefined,
      throwOnError: boolean
    ): Promise<CanvasModule[]> => {
      let currentModules = JSON.parse(JSON.stringify(pipelineModules));

      const getGlobalPolicyInfo = (): PolicyInfoOutput => {
        const policyModule = currentModules.find(
          (m) => m.type === ModuleType.DefinePolicyInfo
        );
        if (!policyModule) {
          throw new Error(
            "A 'Define Policy Info' module is required in the canvas."
          );
        }
        if (
          policyModule.status === ModuleStatus.Success &&
          policyModule.outputData &&
          policyModule.outputData.type === "PolicyInfoOutput"
        ) {
          return policyModule.outputData as PolicyInfoOutput;
        }

        const params =
          overriddenParams && overriddenParams[policyModule.id]
            ? {
                ...policyModule.parameters,
                ...overriddenParams[policyModule.id],
              }
            : policyModule.parameters;

        // Handle Maturity Age logic
        let policyTerm =
          params.policyTerm === "" ||
          params.policyTerm === null ||
          params.policyTerm === undefined
            ? 0
            : Number(params.policyTerm);
        if (params.maturityAge && Number(params.maturityAge) > 0) {
          const calculatedTerm =
            Number(params.maturityAge) - Number(params.entryAge);
          // Fallback logic: if calculatedTerm is invalid, check if original policyTerm is valid
          if (calculatedTerm <= 0) {
            if (policyTerm > 0) {
              // Use original policyTerm, ignore maturityAge
              // (No action needed, policyTerm is already set)
            } else {
              // Both invalid, let calculated term pass through to trigger error or be handled
              policyTerm = calculatedTerm;
            }
          } else {
            policyTerm = calculatedTerm;
          }
        }

        return {
          type: "PolicyInfoOutput",
          entryAge: Number(params.entryAge),
          gender: params.gender,
          policyTerm: policyTerm,
          paymentTerm: Number(params.paymentTerm),
          interestRate: Number(params.interestRate) / 100,
        };
      };

      const getAndValidateConnectedInput = <T extends ModuleOutput["type"]>(
        moduleId: string,
        portName: string,
        expectedType: T
      ): Extract<ModuleOutput, { type: T }> => {
        const inputConnection = pipelineConnections.find(
          (c) => c.to.moduleId === moduleId && c.to.portName === portName
        );
        if (!inputConnection)
          throw new Error(`Input port '${portName}' is not connected.`);
        const sourceModule = currentModules.find(
          (m) => m.id === inputConnection.from.moduleId
        );
        if (!sourceModule)
          throw new Error(`Source module for port '${portName}' not found.`);
        if (sourceModule.status !== ModuleStatus.Success)
          throw new Error(
            `The upstream module '${sourceModule.name}' connected to '${portName}' has not run successfully.`
          );
        if (!sourceModule.outputData)
          throw new Error(
            `The upstream module '${sourceModule.name}' ran successfully but produced no output.`
          );
        if (sourceModule.outputData.type !== expectedType)
          throw new Error(
            `Data from upstream module '${sourceModule.name}' has an unexpected type. Expected '${expectedType}', got '${sourceModule.outputData.type}'.`
          );
        return sourceModule.outputData as Extract<ModuleOutput, { type: T }>;
      };

      for (const moduleId of runQueue) {
        let module = currentModules.find((m) => m.id === moduleId)!;

        const isSourceModule = [
          ModuleType.LoadData,
          ModuleType.DefinePolicyInfo,
          ModuleType.ScenarioRunner,
          ModuleType.PipelineExplainer,
        ].includes(module.type);
        const hasInputConnections = pipelineConnections.some(
          (c) => c.to.moduleId === moduleId
        );

        if (!isSourceModule && !hasInputConnections) {
          logFn(
            moduleId,
            "Skipped: Input port not connected. Module will remain in pending state."
          );
          const skippedModule = { ...module, status: ModuleStatus.Pending };
          const idx = currentModules.findIndex((m) => m.id === moduleId);
          currentModules[idx] = skippedModule;
          continue;
        }

        // Initialize module parameters with defaults if needed (before overriddenParams)
        if (module.type === ModuleType.AdditionalName) {
          const defaultModule = DEFAULT_MODULES.find(
            (m) => m.type === ModuleType.AdditionalName
          );
          const defaultBasicValues = defaultModule?.parameters?.basicValues || [
            { name: "α1", value: 0 },
            { name: "α2", value: 0 },
            { name: "β1", value: 0 },
            { name: "β2", value: 0 },
            { name: "γ", value: 0 },
          ];
          if (!module.parameters) {
            module.parameters = {
              basicValues: JSON.parse(JSON.stringify(defaultBasicValues)),
              definitions: [],
            };
          } else if (
            !module.parameters.basicValues ||
            !Array.isArray(module.parameters.basicValues) ||
            module.parameters.basicValues.length === 0
          ) {
            module.parameters = {
              ...module.parameters,
              basicValues: JSON.parse(JSON.stringify(defaultBasicValues)),
              definitions: module.parameters.definitions || [],
            };
          }
          // Update the module in currentModules array
          const modIdx = currentModules.findIndex((m) => m.id === moduleId);
          if (modIdx !== -1) {
            currentModules[modIdx] = {
              ...currentModules[modIdx],
              parameters: module.parameters,
            };
            // Update module reference
            module = currentModules[modIdx];
          }
        }

        if (overriddenParams && overriddenParams[moduleId]) {
          module = {
            ...module,
            parameters: { ...module.parameters, ...overriddenParams[moduleId] },
          };
        }

        logFn(moduleId, `Running module: ${module.name}`);

        let newStatus: ModuleStatus = ModuleStatus.Error;
        let newOutputData: CanvasModule["outputData"] | undefined = undefined;

        try {
          if (module.type === ModuleType.LoadData) {
            const fileContent = module.parameters.fileContent as string;
            if (!fileContent) throw new Error("No file content loaded.");
            const lines = fileContent.trim().split("\n");
            if (lines.length < 1)
              throw new Error("CSV file is empty or invalid.");
            const header = lines[0]
              .split(",")
              .map((h) => h.trim().replace(/"/g, ""));
            const stringRows = lines.slice(1).map((line) => {
              const values = line.split(",");
              const rowObj: Record<string, string> = {};
              header.forEach((col, index) => {
                rowObj[col] = values[index]?.trim().replace(/"/g, "") || "";
              });
              return rowObj;
            });
            const columns = header.map((name) => {
              const sample = stringRows
                .slice(0, 100)
                .map((r) => r[name])
                .filter((v) => v && v.trim() !== "");
              const allAreNumbers =
                sample.length > 0 && sample.every((v) => !isNaN(Number(v)));
              return { name, type: allAreNumbers ? "number" : "string" };
            });
            const rows = stringRows.map((stringRow) => {
              const typedRow: Record<string, string | number | null> = {};
              for (const col of columns) {
                const val = stringRow[col.name];
                if (col.type === "number")
                  typedRow[col.name] =
                    val && val.trim() !== "" ? parseFloat(val) : null;
                else typedRow[col.name] = val;
              }
              return typedRow;
            });
            newOutputData = {
              type: "DataPreview",
              columns,
              totalRowCount: rows.length,
              rows: rows.slice(0, 1000),
            };
          } else if (module.type === ModuleType.SelectData) {
            const inputData = getAndValidateConnectedInput(
              module.id,
              "data_in",
              "DataPreview"
            );
            if (!inputData.rows)
              throw new Error("Input data is valid but contains no rows.");

            const { selections } = module.parameters;
            const populatedSelections =
              selections && selections.length > 0
                ? selections
                : inputData.columns.map((c: any) => ({
                    originalName: c.name,
                    selected: true,
                    newName: c.name,
                  }));

            const selectedAndRenamed = populatedSelections.filter(
              (s: any) => s.selected
            );
            if (selectedAndRenamed.length === 0)
              throw new Error("No columns were selected.");

            const outputColumnsInfo = inputData.columns
              .filter((c) =>
                selectedAndRenamed.some((s: any) => s.originalName === c.name)
              )
              .map((c) => {
                const selection = selectedAndRenamed.find(
                  (s: any) => s.originalName === c.name
                );
                return { ...c, name: selection.newName };
              });

            const outputRows = inputData.rows.map((row) => {
              const newRow: Record<string, any> = {};
              selectedAndRenamed.forEach((s: any) => {
                newRow[s.newName] = row[s.originalName];
              });
              return newRow;
            });
            newOutputData = {
              type: "DataPreview",
              columns: outputColumnsInfo,
              totalRowCount: outputRows.length,
              rows: outputRows,
            };
          } else if (module.type === ModuleType.RateModifier) {
            const inputData = getAndValidateConnectedInput(
              module.id,
              "data_in",
              "DataPreview"
            );
            if (!inputData.rows)
              throw new Error("Input data contains no rows.");
            const { calculations } = module.parameters;

            // Get policy info for PaymentTerm and PolicyTerm
            let policyInfo: PolicyInfoOutput | null = null;
            try {
              policyInfo = getGlobalPolicyInfo();
            } catch (e) {
              // Policy info not available, continue without it
            }

            if (!calculations || calculations.length === 0) {
              newOutputData = inputData;
            } else {
              const outputRows = inputData.rows.map((r) => ({ ...r }));
              const outputColumnsInfo = [...inputData.columns];

              for (const calc of calculations) {
                const { newColumnName, formula } = calc;
                if (!newColumnName || !formula) continue;
                for (const row of outputRows) {
                  let evalFormula = formula;
                  const keys = Object.keys(row).sort(
                    (a, b) => b.length - a.length
                  );
                  for (const key of keys) {
                    const val = row[key];
                    evalFormula = evalFormula
                      .split(`[${key}]`)
                      .join(String(val ?? 0));
                  }
                  // Add PaymentTerm/PolicyTerm and m/n aliases from policyInfo
                  if (policyInfo) {
                    const mVal = String(policyInfo.paymentTerm ?? 0);
                    const nVal = String(policyInfo.policyTerm ?? 0);
                    evalFormula = evalFormula.split("[PaymentTerm]").join(mVal);
                    evalFormula = evalFormula.split("[PolicyTerm]").join(nVal);
                    evalFormula = evalFormula.split("[m]").join(mVal);
                    evalFormula = evalFormula.split("[n]").join(nVal);
                  }
                  // Process IF statements
                  evalFormula = processIfStatements(evalFormula);
                  try {
                    validateFormulaExpression(evalFormula);
                    const result = new Function("return " + evalFormula)();
                    row[newColumnName] =
                      typeof result === "number" ? roundTo5(result) : result;
                  } catch (e) {
                    row[newColumnName] = null;
                  }
                }
                if (!outputColumnsInfo.some((c) => c.name === newColumnName)) {
                  outputColumnsInfo.push({
                    name: newColumnName,
                    type: "number",
                    description: `수식으로 계산된 열 (Rate Modifier)\n공식: ${formula}`,
                  });
                }
              }
              newOutputData = {
                type: "DataPreview",
                columns: outputColumnsInfo,
                totalRowCount: outputRows.length,
                rows: outputRows,
              };
            }
          } else if (module.type === ModuleType.DefinePolicyInfo) {
            const params = module.parameters;
            let policyTerm =
              params.policyTerm === "" ||
              params.policyTerm === null ||
              params.policyTerm === undefined
                ? 0
                : Number(params.policyTerm);
            if (params.maturityAge && Number(params.maturityAge) > 0) {
              const calculatedTerm =
                Number(params.maturityAge) - Number(params.entryAge);
              if (calculatedTerm > 0) {
                policyTerm = calculatedTerm;
              }
            }
            newOutputData = {
              type: "PolicyInfoOutput",
              entryAge: Number(params.entryAge),
              gender: params.gender,
              policyTerm: policyTerm,
              paymentTerm: Number(params.paymentTerm),
              interestRate: Number(params.interestRate) / 100,
            };
          } else if (module.type === ModuleType.SelectRiskRates) {
            const riskData = getAndValidateConnectedInput(
              module.id,
              "risk_data_in",
              "DataPreview"
            );
            const policyInfo = getGlobalPolicyInfo();

            const {
              ageColumn,
              genderColumn,
              excludeNonNumericRows = true,
            } = module.parameters;
            let { entryAge, policyTerm, gender, interestRate } = policyInfo;

            if (!ageColumn || !genderColumn)
              throw new Error(
                "Age and Gender columns must be specified in the module parameters."
              );
            if (interestRate === undefined)
              throw new Error(
                "Interest Rate is not defined in the connected Policy Info module."
              );

            // 입력 데이터의 열 이름 목록
            const inputColNames = riskData.columns.map((c) => c.name);

            // ageColumn/genderColumn이 입력 데이터에 있는지 확인
            if (!inputColNames.includes(ageColumn))
              throw new Error(
                `[Rating Basis Builder] '${ageColumn}' 열이 입력 데이터에 없습니다. SelectData에서 이 열을 선택했는지 확인하세요.`
              );
            if (!inputColNames.includes(genderColumn))
              throw new Error(
                `[Rating Basis Builder] '${genderColumn}' 열이 입력 데이터에 없습니다. SelectData에서 이 열을 선택했는지 확인하세요.`
              );

            // columnRenames의 원본 열(from)이 입력 데이터에 있는지 확인
            const columnRenames: Array<{ from: string; to: string }> =
              module.parameters.columnRenames ?? [];
            for (const { from } of columnRenames) {
              if (!inputColNames.includes(from)) {
                throw new Error(
                  `[Rating Basis Builder] '${from}' 열이 입력 데이터에 없습니다. SelectData에서 이 열을 선택했는지 확인하세요.`
                );
              }
            }

            // Filter out rows with non-numeric values if excludeNonNumericRows is true
            let rowsToProcess = riskData.rows || [];
            if (excludeNonNumericRows) {
              const numericColumns = riskData.columns
                .filter((c) => c.type === "number")
                .map((c) => c.name);

              rowsToProcess = rowsToProcess.filter((row) => {
                // Check all columns except Age and Gender
                for (const col of riskData.columns) {
                  if (col.name === ageColumn || col.name === genderColumn)
                    continue;

                  // If column is supposed to be numeric, check if value is numeric
                  if (numericColumns.includes(col.name)) {
                    const value = row[col.name];
                    if (value !== null && value !== undefined && value !== "") {
                      const numValue = Number(value);
                      if (isNaN(numValue) || !isFinite(numValue)) {
                        return false; // Exclude this row
                      }
                    }
                  }
                }
                return true; // Keep this row
              });
            }

            // If policyTerm is 0 or empty, calculate from maximum age in data
            if (policyTerm <= 0) {
              const matchingRows = rowsToProcess.filter((row) => {
                const rowGender = row[genderColumn];
                const rowAge = Number(row[ageColumn]);
                return rowGender === gender && rowAge >= entryAge;
              });

              if (matchingRows && matchingRows.length > 0) {
                const maxAge = Math.max(
                  ...matchingRows.map((row) => Number(row[ageColumn]))
                );
                // Calculate policyTerm as the number of rows from entryAge to maxAge (inclusive)
                // Example: entryAge=40, maxAge=110 -> policyTerm = 110 - 40 + 1 = 71
                policyTerm = maxAge - entryAge + 1;
              } else {
                throw new Error(
                  `No risk data found for gender "${gender}" and age >= ${entryAge}. Cannot calculate Policy Term automatically.`
                );
              }
            }

            const filteredRows = rowsToProcess.filter((row) => {
              const rowGender = row[genderColumn];
              const rowAge = Number(row[ageColumn]);
              return (
                rowGender === gender &&
                rowAge >= entryAge &&
                rowAge < entryAge + policyTerm
              );
            });

            if (!filteredRows || filteredRows.length === 0) {
              const availableGenders = [
                ...new Set(riskData.rows?.map((r) => r[genderColumn])),
              ];
              throw new Error(
                `No risk data found for gender "${gender}" and age range ${entryAge}-${
                  entryAge + policyTerm - 1
                }. Available genders in data: [${availableGenders.join(
                  ", "
                )}]. Check column settings and policy info.`
              );
            }

            const i = interestRate;
            const sortedRows = [...filteredRows].sort(
              (a, b) => Number(a[ageColumn]) - Number(b[ageColumn])
            );

            const outputRows = sortedRows.map((row, t) => {
              const newRow: Record<string, any> = { ...row };

              // Rename Age column if it's not already 'Age'
              if (ageColumn !== "Age") {
                newRow["Age"] = newRow[ageColumn];
                delete newRow[ageColumn];
              }

              // Rename Gender column if it's not already 'Gender'
              if (genderColumn !== "Gender") {
                newRow["Gender"] = newRow[genderColumn];
                delete newRow[genderColumn];
              }

              // Add interest rates
              newRow["i_prem"] = roundTo8(1 / Math.pow(1 + i, t));
              newRow["i_claim"] = roundTo8(1 / Math.pow(1 + i, t + 0.5));

              return newRow;
            });

            const baseColumns = riskData.columns
              .filter((c) => c.name !== "i_prem" && c.name !== "i_claim")
              .map((c) => {
                const isAge = c.name === ageColumn;
                const isGender = c.name === genderColumn;
                const name = isAge ? "Age" : isGender ? "Gender" : c.name;
                return {
                  ...c,
                  name,
                  description: `📂 Load Data에서 가져온 원본 열\n원본 열 이름: ${c.name}`,
                };
              });

            const outputColumnsInfo = [
              ...baseColumns,
              {
                name: "i_prem",
                type: "number" as const,
                description: `할인계수 (보험료)\n공식: v^t = 1 / (1+i)^t\nt: 경과기간 (0부터 시작)\ni: 연이율 ${(interestRate * 100).toFixed(2)}%`,
              },
              {
                name: "i_claim",
                type: "number" as const,
                description: `할인계수 (보험금)\n공식: v^(t+0.5) = 1 / (1+i)^(t+0.5)\n중앙지급 가정 (기간 중앙에 지급)\ni: 연이율 ${(interestRate * 100).toFixed(2)}%`,
              },
            ];

            newOutputData = {
              type: "DataPreview",
              columns: outputColumnsInfo,
              totalRowCount: outputRows.length,
              rows: outputRows,
            };
          } else if (module.type === ModuleType.CalculateSurvivors) {
            const inputData = getAndValidateConnectedInput(
              module.id,
              "data_in",
              "DataPreview"
            );
            if (!inputData.rows)
              throw new Error("Input data is valid but contains no rows.");

            const { ageColumn, addFixedLx } = module.parameters;
            let { mortalityColumn, calculations } = module.parameters;

            // mortalityColumn이 없거나 입력 데이터에 존재하지 않을 경우 Death_Rate로 자동 적용
            if (
              (!mortalityColumn ||
                mortalityColumn === "None" ||
                !inputData.columns.some((c) => c.name === mortalityColumn)) &&
              inputData.columns.some((c) => c.name === "Death_Rate")
            ) {
              mortalityColumn = "Death_Rate";
            }

            if (!ageColumn || ageColumn === "None")
              throw new Error("Age Column must be specified.");
            if (
              !calculations ||
              !Array.isArray(calculations) ||
              calculations.length === 0
            ) {
              throw new Error("At least one lx calculation must be defined.");
            }

            const sortedRows = [...inputData.rows].sort(
              (a, b) => Number(a[ageColumn]) - Number(b[ageColumn])
            );
            if (
              sortedRows.length > 0 &&
              sortedRows[0]["i_prem"] === undefined
            ) {
              throw new Error(
                "Input data must contain an 'i_prem' column for Dx calculations. Connect a 'Select Rates' module."
              );
            }

            const outputRows = sortedRows.map((r) => ({ ...r })); // Deep copy
            const outputColumnsInfo = [...inputData.columns];

            const getSafeRate = (row: Record<string, any>, colName: string) => {
              const val = row[colName];
              if (val === null || val === undefined) return 0;
              const num = Number(val);
              if (isNaN(num)) return 0;
              return num;
            };

            const inputColNames = new Set(inputData.columns.map((c) => c.name));

            for (const calc of calculations) {
              let currentSurvivors = 100000;
              const lxColName = `lx_${calc.name}`;
              // decrementRates에 없는 열이 있으면 mortalityColumn으로 대체 (SelectData에서 이름 변경된 경우 대응)
              const rawRates: string[] = calc.decrementRates || [];
              const decrementRatesInCalc = rawRates.map((rate) =>
                !inputColNames.has(rate) &&
                mortalityColumn &&
                inputColNames.has(mortalityColumn)
                  ? mortalityColumn
                  : rate
              );
              const isMortalityPresent =
                mortalityColumn !== "None" &&
                decrementRatesInCalc.includes(mortalityColumn);
              const otherDecrementRates = decrementRatesInCalc.filter(
                (r) => r !== mortalityColumn
              );

              for (const row of outputRows) {
                row[lxColName] = roundTo5(currentSurvivors); // Round to 5 decimal places
                let deaths = 0;
                if (isMortalityPresent && otherDecrementRates.length === 0) {
                  const mortalityRate = getSafeRate(row, mortalityColumn);
                  deaths = currentSurvivors * mortalityRate;
                } else if (
                  !isMortalityPresent &&
                  otherDecrementRates.length > 0
                ) {
                  const survivalProduct = otherDecrementRates.reduce(
                    (prod, rateCol) => prod * (1 - getSafeRate(row, rateCol)),
                    1
                  );
                  deaths = currentSurvivors * (1 - survivalProduct);
                } else if (
                  isMortalityPresent &&
                  otherDecrementRates.length > 0
                ) {
                  const mortalityRate = getSafeRate(row, mortalityColumn);
                  const otherSurvivalProduct = otherDecrementRates.reduce(
                    (prod, rateCol) => prod * (1 - getSafeRate(row, rateCol)),
                    1
                  );
                  const q_others = 1 - otherSurvivalProduct;
                  const totalDecrementFactor =
                    mortalityRate + q_others - (mortalityRate * q_others) / 2.0;
                  deaths = currentSurvivors * totalDecrementFactor;
                }
                currentSurvivors -= deaths;
              }

              if (!outputColumnsInfo.some((c) => c.name === lxColName)) {
                const ratesDesc = decrementRatesInCalc.join(", ") || "(없음)";
                outputColumnsInfo.push({
                  name: lxColName,
                  type: "number",
                  description: `생존자수 (Survivors)\nlx[0] = 100,000\nlx[t] = lx[t-1] × (1 - q[t-1])\n적용 위험률: ${ratesDesc}`,
                });
              }
              const dxColName = `Dx_${calc.name}`;
              for (const row of outputRows) {
                // Round Dx to 5 decimal places
                row[dxColName] = roundTo5(
                  (Number(row[lxColName]) || 0) * (Number(row["i_prem"]) || 0)
                );
              }
              if (!outputColumnsInfo.some((c) => c.name === dxColName)) {
                outputColumnsInfo.push({
                  name: dxColName,
                  type: "number",
                  description: `할인 생존자수 (Discounted Survivors)\n공식: Dx[t] = lx_${calc.name}[t] × v^t\nv^t = i_prem`,
                });
              }
            }

            // Add fixed lx column if checkbox is checked
            if (addFixedLx) {
              const fixedLxColName = "lx";
              for (const row of outputRows) {
                row[fixedLxColName] = 100000;
              }
              if (!outputColumnsInfo.some((c) => c.name === fixedLxColName)) {
                outputColumnsInfo.push({
                  name: fixedLxColName,
                  type: "number",
                  description: "고정 생존자수\nlx = 100,000 (상수)",
                });
              }
            }

            newOutputData = {
              type: "DataPreview",
              columns: outputColumnsInfo,
              totalRowCount: outputRows.length,
              rows: outputRows,
            };
          } else if (module.type === ModuleType.ClaimsCalculator) {
            const inputData = getAndValidateConnectedInput(
              module.id,
              "data_in",
              "DataPreview"
            );
            if (!inputData.rows)
              throw new Error("Input data is valid but contains no rows.");

            // Ensure module.parameters exists
            if (!module.parameters) {
              module.parameters = { calculations: [] };
            }
            if (!module.parameters.calculations) {
              module.parameters.calculations = [];
            }

            let calculations = module.parameters.calculations || [];

            if (
              inputData.rows.length > 0 &&
              inputData.rows[0]["i_claim"] === undefined
            ) {
              throw new Error(
                "Input data must contain an 'i_claim' column. Connect a 'Select Rates' module."
              );
            }

            // If calculations is empty, create default calculation
            if (calculations.length === 0) {
              // Find available columns
              const excludedNames = [
                "age",
                "sex",
                "gender",
                "entryage",
                "i_prem",
                "i_claim",
              ];
              const numericColumns = inputData.columns
                .filter(
                  (c) =>
                    c.type === "number" &&
                    !excludedNames.includes(c.name.toLowerCase())
                )
                .map((c) => c.name);

              const lxOptions = numericColumns.filter((c) =>
                c.startsWith("lx_")
              );
              const riskOptions = numericColumns.filter(
                (c) => !c.startsWith("lx_") && !c.startsWith("Dx_")
              );

              // Create default calculation if columns are available
              if (lxOptions.length > 0 && riskOptions.length > 0) {
                const defaultLx = lxOptions[0];
                const defaultRiskRate = riskOptions[0];
                calculations = [
                  {
                    id: `claim-calc-default-${Date.now()}`,
                    lxColumn: defaultLx,
                    riskRateColumn: defaultRiskRate,
                    name: defaultRiskRate,
                  },
                ];
                // Update module parameters with default calculations
                module.parameters = {
                  ...module.parameters,
                  calculations: calculations,
                };
                // Update the module in currentModules array
                const moduleIdx = currentModules.findIndex(
                  (m) => m.id === module.id
                );
                if (moduleIdx !== -1) {
                  currentModules[moduleIdx] = {
                    ...currentModules[moduleIdx],
                    parameters: module.parameters,
                  };
                }
              }
            }

            // Deep copy rows to prevent mutating original input
            const outputRows = inputData.rows.map((r) => ({ ...r }));
            const outputColumnsInfo = [...inputData.columns];

            // Set to track ALL column names to ensure global uniqueness
            const usedColumnNames = new Set(
              outputColumnsInfo.map((c) => c.name)
            );

            const getSafeName = (baseName: string) => {
              let name = baseName;
              let counter = 1;
              while (usedColumnNames.has(name)) {
                name = `${baseName}_${counter}`;
                counter++;
              }
              return name;
            };

            // Use for...of loop to ensure sequential execution and correct column name tracking
            for (const calc of calculations) {
              const { lxColumn, riskRateColumn } = calc;

              // 1. Validation: Check if columns are selected
              if (!lxColumn || !riskRateColumn) {
                // Skip this calculation if configuration is incomplete
                continue;
              }

              const calcName = calc.name || riskRateColumn || "Calc";

              // 2. Generate unique column names
              const dxBaseName = `dx_${calcName}`;
              const cxBaseName = `Cx_${calcName}`;

              const dxColName = getSafeName(dxBaseName);
              usedColumnNames.add(dxColName); // Important: Register immediately

              const cxColName = getSafeName(cxBaseName);
              usedColumnNames.add(cxColName); // Important: Register immediately

              // 3. Register Column Info
              outputColumnsInfo.push({
                name: dxColName,
                type: "number",
                description: `사망자수 (Claims)\n공식: dx[t] = ${lxColumn}[t] × ${riskRateColumn}[t]\nlx: 생존자수, q: 위험률`,
              });
              outputColumnsInfo.push({
                name: cxColName,
                type: "number",
                description: `할인 사망자수 (Discounted Claims)\n공식: Cx[t] = ${dxColName}[t] × i_claim[t]\ni_claim = v^(t+0.5) (중앙지급 할인계수)`,
              });

              // 4. Perform Calculation for all rows
              for (const row of outputRows) {
                // Safe number parsing, default to 0 if missing/NaN
                const lxVal = row[lxColumn];
                const qVal = row[riskRateColumn];
                const iClaimVal = row["i_claim"];

                const lx = !isNaN(Number(lxVal)) ? Number(lxVal) : 0;
                const q = !isNaN(Number(qVal)) ? Number(qVal) : 0;
                const i_claim = !isNaN(Number(iClaimVal))
                  ? Number(iClaimVal)
                  : 0;

                // Calculate dx WITHOUT immediate rounding to avoid zeroing out small values
                const rawDx = lx * q;
                const dxVal = roundTo5(rawDx);

                row[dxColName] = dxVal;
                row[cxColName] = roundTo5(dxVal * i_claim);
              }
            }

            newOutputData = {
              type: "DataPreview",
              columns: outputColumnsInfo,
              totalRowCount: outputRows.length,
              rows: outputRows,
            };
          } else if (module.type === ModuleType.NxMxCalculator) {
            const inputData = getAndValidateConnectedInput(
              module.id,
              "data_in",
              "DataPreview"
            );
            if (!inputData.rows) throw new Error("Input data has no rows.");

            // Ensure module.parameters exists
            if (!module.parameters) {
              module.parameters = { nxCalculations: [], mxCalculations: [] };
            }
            if (!module.parameters.nxCalculations) {
              module.parameters.nxCalculations = [];
            }
            if (!module.parameters.mxCalculations) {
              module.parameters.mxCalculations = [];
            }

            let { nxCalculations = [], mxCalculations = [] } =
              module.parameters;

            // Sync mxCalculations to match Cx columns exactly (1 Cx = 1 calculation)
            const cxColumns = inputData.columns
              .filter((c) => c.name.startsWith("Cx_"))
              .map((c) => c.name);

            if (cxColumns.length > 0) {
              const existingBaseSet = new Set(
                mxCalculations.map((c: any) => c.baseColumn)
              );
              const cxColumnsSet = new Set(cxColumns);

              // Check if we need to update (if counts don't match or columns don't match)
              const needsUpdate =
                mxCalculations.length === 0 ||
                mxCalculations.length !== cxColumns.length ||
                cxColumns.some((col) => !existingBaseSet.has(col)) ||
                mxCalculations.some(
                  (calc: any) => !cxColumnsSet.has(calc.baseColumn)
                );

              if (needsUpdate) {
                // Create exactly one calculation per Cx column
                mxCalculations = cxColumns.map((col, idx) => {
                  // Try to preserve existing calculation if it exists
                  const existing = mxCalculations.find(
                    (c: any) => c.baseColumn === col
                  );
                  if (existing) {
                    return existing;
                  }
                  // Create new calculation
                  return {
                    id: `mx-auto-${Date.now()}-${idx}`,
                    baseColumn: col,
                    name: col.replace(/^Cx_/, ""),
                    active: true,
                    deductibleType: "0",
                    customDeductible: 0,
                    paymentRatios: [
                      { year: 1, type: "100%", customValue: 100 },
                      { year: 2, type: "100%", customValue: 100 },
                      { year: 3, type: "100%", customValue: 100 },
                    ],
                  };
                });
                // Update module parameters with default mxCalculations
                module.parameters = {
                  ...module.parameters,
                  mxCalculations: mxCalculations,
                };
                // Update the module in currentModules array
                const modIdx = currentModules.findIndex(
                  (m) => m.id === module.id
                );
                if (modIdx !== -1) {
                  currentModules[modIdx] = {
                    ...currentModules[modIdx],
                    parameters: module.parameters,
                  };
                  // Update module reference
                  module = currentModules[modIdx];
                }
              }
            } else if (cxColumns.length === 0 && mxCalculations.length > 0) {
              // If no Cx columns, clear mxCalculations
              mxCalculations = [];
              module.parameters = {
                ...module.parameters,
                mxCalculations: [],
              };
              const modIdx = currentModules.findIndex(
                (m) => m.id === module.id
              );
              if (modIdx !== -1) {
                currentModules[modIdx] = {
                  ...currentModules[modIdx],
                  parameters: module.parameters,
                };
                // Update module reference
                module = currentModules[modIdx];
              }
            }
            // Auto-sync nxCalculations with available Dx_* columns (same as mxCalculations with Cx_*)
            const dxColumns = inputData.columns
              .filter((c) => c.name.startsWith("Dx_"))
              .map((c) => c.name);

            if (dxColumns.length > 0) {
              const existingNxBaseSet = new Set(
                nxCalculations.map((c: any) => c.baseColumn)
              );
              const dxColumnsSet = new Set(dxColumns);
              const needsNxUpdate =
                nxCalculations.length === 0 ||
                nxCalculations.length !== dxColumns.length ||
                dxColumns.some((col) => !existingNxBaseSet.has(col)) ||
                nxCalculations.some(
                  (calc: any) => !dxColumnsSet.has(calc.baseColumn)
                );
              if (needsNxUpdate) {
                nxCalculations = dxColumns.map((col, idx) => {
                  const existing = nxCalculations.find(
                    (c: any) => c.baseColumn === col
                  );
                  if (existing) return existing;
                  return {
                    id: `nx-auto-${Date.now()}-${idx}`,
                    baseColumn: col,
                    name: col.replace(/^Dx_/, ""),
                    active: true,
                  };
                });
                module.parameters = { ...module.parameters, nxCalculations };
                const modIdx = currentModules.findIndex(
                  (m) => m.id === module.id
                );
                if (modIdx !== -1) {
                  currentModules[modIdx] = {
                    ...currentModules[modIdx],
                    parameters: module.parameters,
                  };
                  module = currentModules[modIdx];
                }
              }
            }

            const outputRows = inputData.rows.map((r) => ({ ...r }));
            const outputColumnsInfo = [...inputData.columns];

            for (const calc of nxCalculations) {
              if (calc.active === false) continue;
              if (!calc.baseColumn) continue;
              const baseData = outputRows.map(
                (row) => Number(row[calc.baseColumn]) || 0
              );
              const cumulativeData = new Array(baseData.length).fill(0);
              let sum = 0;
              for (let i = baseData.length - 1; i >= 0; i--) {
                sum += baseData[i];
                cumulativeData[i] = sum;
              }
              // calc.name이 있으면 우선 사용, 없으면 baseColumn에서 파생: Dx_XXX -> Nx_XXX
              const nxBaseName = calc.name || calc.baseColumn.replace(/^Dx_/, "");
              const newColName = `Nx_${nxBaseName}`;
              outputRows.forEach((row, i) => {
                row[newColName] = roundTo5(cumulativeData[i]);
              });
              if (!outputColumnsInfo.some((c) => c.name === newColName))
                outputColumnsInfo.push({
                  name: newColName,
                  type: "number",
                  description: `연생연금 현가 분자 (Annuity Numerator)\n공식: Nx[t] = Σ(s=t → n-1) ${calc.baseColumn}[s]\n역방향 누적합 (뒤에서부터 더함)`,
                });
            }

            for (const calc of mxCalculations) {
              if (calc.active === false) continue;
              if (!calc.baseColumn) continue;
              const adjustedCxData = outputRows.map((row, index) => {
                let cx = Number(row[calc.baseColumn]) || 0;
                let factor = 1.0;
                if (index === 0) {
                  if (calc.deductibleType === "0.25") factor *= 0.75;
                  else if (calc.deductibleType === "0.5") factor *= 0.5;
                  else if (calc.deductibleType === "custom")
                    factor *= 1 - (Number(calc.customDeductible) || 0);
                }
                const ratio = (calc.paymentRatios || []).find(
                  (r: any) => r.year === index + 1
                );
                if (ratio) {
                  if (ratio.type === "Custom")
                    factor *= (Number(ratio.customValue) || 0) / 100;
                  else factor *= parseFloat(ratio.type) / 100;
                }
                return cx * factor;
              });
              const cumulativeData = new Array(adjustedCxData.length).fill(0);
              let sum = 0;
              for (let i = adjustedCxData.length - 1; i >= 0; i--) {
                sum += adjustedCxData[i];
                cumulativeData[i] = sum;
              }
              // calc.name이 있으면 우선 사용, 없으면 baseColumn에서 파생: Cx_XXX -> Mx_XXX
              const mxBaseName = calc.name || calc.baseColumn.replace(/^Cx_/, "");
              const newColName = `Mx_${mxBaseName}`;
              outputRows.forEach((row, i) => {
                row[newColName] = roundTo5(cumulativeData[i]);
              });
              if (!outputColumnsInfo.some((c) => c.name === newColName)) {
                const deductDesc =
                  calc.deductibleType === "0" ? "면책 없음" :
                  calc.deductibleType === "0.25" ? "첫해 0.25년치 면책" :
                  calc.deductibleType === "0.5" ? "첫해 0.5년치 면책" :
                  `사용자 면책: ${calc.customDeductible}`;
                outputColumnsInfo.push({
                  name: newColName,
                  type: "number",
                  description: `보험금 현가 분자 (Benefit Numerator)\n공식: Mx[t] = Σ(s=t → n-1) (${calc.baseColumn}[s] × 지급비율 × 면책조정)\n역방향 누적합\n${deductDesc}`,
                });
              }
            }
            newOutputData = {
              type: "DataPreview",
              columns: outputColumnsInfo,
              totalRowCount: outputRows.length,
              rows: outputRows,
            };
          } else if (module.type === ModuleType.PremiumComponent) {
            const inputData = getAndValidateConnectedInput(
              module.id,
              "data_in",
              "DataPreview"
            );
            const policyInfo = getGlobalPolicyInfo();
            if (!inputData.rows) throw new Error("Input data has no rows.");

            // Ensure module.parameters exists
            if (!module.parameters) {
              module.parameters = { nnxCalculations: [], sumxCalculations: [] };
            }
            if (!module.parameters.nnxCalculations) {
              module.parameters.nnxCalculations = [];
            }
            if (!module.parameters.sumxCalculations) {
              module.parameters.sumxCalculations = [];
            }

            let { nnxCalculations = [], sumxCalculations = [] } =
              module.parameters;

            // Sync sumxCalculations to match Mx columns exactly (1 Mx = 1 calculation)
            const availableMxColumns = inputData.columns
              .filter((c) => c.name.startsWith("Mx_"))
              .map((c) => c.name);

            if (availableMxColumns.length > 0) {
              const existingBaseSet = new Set(
                sumxCalculations.map((c: any) => c.mxColumn)
              );
              const mxColumnsSet = new Set(availableMxColumns);

              // Check if we need to update (if counts don't match or columns don't match)
              const needsUpdate =
                sumxCalculations.length === 0 ||
                sumxCalculations.length !== availableMxColumns.length ||
                availableMxColumns.some((col) => !existingBaseSet.has(col)) ||
                sumxCalculations.some(
                  (calc: any) => !mxColumnsSet.has(calc.mxColumn)
                );

              if (needsUpdate) {
                // Create exactly one calculation per Mx column
                sumxCalculations = availableMxColumns.map((col, idx) => {
                  // Try to preserve existing calculation if it exists
                  const existing = sumxCalculations.find(
                    (c: any) => c.mxColumn === col
                  );
                  if (existing) {
                    return existing;
                  }
                  // Create new calculation
                  return {
                    id: `sumx-auto-${Date.now()}-${idx}`,
                    mxColumn: col,
                    amount: 10000, // Default amount
                  };
                });
                // Update module parameters with default sumxCalculations
                module.parameters = {
                  ...module.parameters,
                  sumxCalculations: sumxCalculations,
                };
                // Update the module in currentModules array
                const modIdx = currentModules.findIndex(
                  (m) => m.id === module.id
                );
                if (modIdx !== -1) {
                  currentModules[modIdx] = {
                    ...currentModules[modIdx],
                    parameters: module.parameters,
                  };
                  // Update module reference
                  module = currentModules[modIdx];
                }
              }
            } else if (
              availableMxColumns.length === 0 &&
              sumxCalculations.length > 0
            ) {
              // If no Mx columns, clear sumxCalculations
              sumxCalculations = [];
              module.parameters = {
                ...module.parameters,
                sumxCalculations: [],
              };
              const modIdx = currentModules.findIndex(
                (m) => m.id === module.id
              );
              if (modIdx !== -1) {
                currentModules[modIdx] = {
                  ...currentModules[modIdx],
                  parameters: module.parameters,
                };
                // Update module reference
                module = currentModules[modIdx];
              }
            }
            // Auto-sync nnxCalculations with available Nx_* columns
            const availableNxColumns = inputData.columns
              .filter((c) => c.name.startsWith("Nx_"))
              .map((c) => c.name);

            if (availableNxColumns.length > 0) {
              const existingNxSet = new Set(
                nnxCalculations.map((c: any) => c.nxColumn)
              );
              const nxColumnsSet = new Set(availableNxColumns);
              const needsNxUpdate =
                nnxCalculations.length === 0 ||
                nnxCalculations.length !== availableNxColumns.length ||
                availableNxColumns.some((col) => !existingNxSet.has(col)) ||
                nnxCalculations.some(
                  (calc: any) => !nxColumnsSet.has(calc.nxColumn)
                );
              if (needsNxUpdate) {
                nnxCalculations = availableNxColumns.map((col, idx) => {
                  const existing = nnxCalculations.find(
                    (c: any) => c.nxColumn === col
                  );
                  if (existing) return existing;
                  const dxCol = col.replace(/^Nx_/, "Dx_");
                  const hasDx = inputData.columns.some(
                    (c) => c.name === dxCol
                  );
                  return {
                    id: `nnx-auto-${Date.now()}-${idx}`,
                    nxColumn: col,
                    dxColumn: hasDx ? dxCol : "",
                  };
                });
                module.parameters = { ...module.parameters, nnxCalculations };
                const modIdx = currentModules.findIndex(
                  (m) => m.id === module.id
                );
                if (modIdx !== -1) {
                  currentModules[modIdx] = {
                    ...currentModules[modIdx],
                    parameters: module.parameters,
                  };
                  module = currentModules[modIdx];
                }
              }
            }

            // 기존 nnxCalculations에서 dxColumn이 비어있으면 자동으로 채움
            nnxCalculations = nnxCalculations.map((calc: any) => {
              if (!calc.dxColumn && calc.nxColumn) {
                const dxCol = calc.nxColumn.replace(/^Nx_/, "Dx_");
                const hasDx = inputData.columns.some((c) => c.name === dxCol);
                return { ...calc, dxColumn: hasDx ? dxCol : "" };
              }
              return calc;
            });

            const { paymentTerm, policyTerm } = policyInfo;
            const rows = inputData.rows;

            const nnxResults: Record<string, number> = {};
            for (const calc of nnxCalculations) {
              if (!calc.nxColumn) continue;
              
              const nx_start = Number(rows[0][calc.nxColumn]) || 0;
              const nx_end = rows[paymentTerm]
                ? Number(rows[paymentTerm][calc.nxColumn]) || 0
                : 0;
              
              const baseName = calc.nxColumn.replace("Nx_", "");
              
              // NNX(Year): NX[Entry Age] - NX[Payment Term]
              const nnxYear = nx_start - nx_end;
              nnxResults[`NNX_${baseName}(Year)`] = roundTo5(nnxYear);
              
              // DX values for Half/Quarter/Month calculations
              if (calc.dxColumn) {
                const dx_start = Number(rows[0][calc.dxColumn]) || 0;
                const dx_end = rows[paymentTerm]
                  ? Number(rows[paymentTerm][calc.dxColumn]) || 0
                  : 0;
                const dx_diff = dx_start - dx_end;
                
                // NNX(Half): NX[Entry Age] - NX[Payment Term] - 1/4*(DX[Entry Age] - DX[Payment Term])
                const nnxHalf = nnxYear - (1/4) * dx_diff;
                nnxResults[`NNX_${baseName}(Half)`] = roundTo5(nnxHalf);
                
                // NNX(Quarter): NX[Entry Age] - NX[Payment Term] - 3/8*(DX[Entry Age] - DX[Payment Term])
                const nnxQuarter = nnxYear - (3/8) * dx_diff;
                nnxResults[`NNX_${baseName}(Quarter)`] = roundTo5(nnxQuarter);
                
                // NNX(Month): NX[Entry Age] - NX[Payment Term] - 11/24*(DX[Entry Age] - DX[Payment Term])
                const nnxMonth = nnxYear - (11/24) * dx_diff;
                nnxResults[`NNX_${baseName}(Month)`] = roundTo5(nnxMonth);
              } else {
                // If DX column is not selected, only Year version is available
                // Set other versions to NaN or 0 to indicate they're not available
                nnxResults[`NNX_${baseName}(Half)`] = NaN;
                nnxResults[`NNX_${baseName}(Quarter)`] = NaN;
                nnxResults[`NNX_${baseName}(Month)`] = NaN;
              }
            }

            let mmxValue = 0;
            const mxResults: Record<string, number> = {};
            // policyTerm=0 means whole life → use last row as terminal (Mx[last] ≈ 0)
            const effectivePolicyTermIdx = policyTerm > 0 ? policyTerm : rows.length - 1;
            for (const calc of sumxCalculations) {
              // Skip if mxColumn is not set
              if (!calc.mxColumn) continue;

              // BPV = (Mx[0] - Mx[n]) × amount
              const mx0_val = rows[0]?.[calc.mxColumn];
              const mx0 = mx0_val !== undefined && mx0_val !== null ? Number(mx0_val) : 0;

              const mxN_row = rows[effectivePolicyTermIdx] ?? rows[rows.length - 1];
              const mxN_val = mxN_row?.[calc.mxColumn];
              const mxN = mxN_val !== undefined && mxN_val !== null ? Number(mxN_val) : 0;

              const amount = Number(calc.amount) || 0;
              const benefit_pv = (mx0 - mxN) * amount;

              // Only add if valid number
              if (!isNaN(benefit_pv) && isFinite(benefit_pv)) {
                mmxValue += benefit_pv;
              }

              const resultName = calc.mxColumn.replace("Mx_", "");
              mxResults[resultName] = roundTo5(benefit_pv);
            }

            // Build BPV results: BPV_Mortality, BPV_CI, etc.
            const bpvResults: Record<string, number> = {};
            for (const [baseName, val] of Object.entries(mxResults)) {
              bpvResults[`BPV_${baseName}`] = val;
            }

            // Create enhanced table data with NNX and BPV columns
            const enhancedRows = rows.map((row, rowIndex) => {
              const newRow = { ...row };

              // Add NNX columns: 4 versions for each Nx column
              // If rowIndex > paymentTerm, set to 0
              for (const calc of nnxCalculations) {
                if (!calc.nxColumn) continue;
                
                const nxColumn = calc.nxColumn;
                const baseName = nxColumn.replace("Nx_", "");
                
                if (rowIndex > paymentTerm) {
                  // Set all versions to 0 if rowIndex > paymentTerm
                  newRow[`NNX_${baseName}(Year)_Col`] = 0;
                  newRow[`NNX_${baseName}(Half)_Col`] = 0;
                  newRow[`NNX_${baseName}(Quarter)_Col`] = 0;
                  newRow[`NNX_${baseName}(Month)_Col`] = 0;
                } else {
                  const nx_current = Number(row[nxColumn]) || 0;
                  const nx_paymentTerm =
                    rows[paymentTerm] && rows[paymentTerm][nxColumn]
                      ? Number(rows[paymentTerm][nxColumn])
                      : 0;
                  
                  // NNX(Year): NX[rowIndex] - NX[Payment Term]
                  const nnxYear = nx_current - nx_paymentTerm;
                  newRow[`NNX_${baseName}(Year)_Col`] = roundTo5(nnxYear);
                  
                  // DX values for Half/Quarter/Month calculations
                  if (calc.dxColumn) {
                    const dx_current = Number(row[calc.dxColumn]) || 0;
                    const dx_paymentTerm =
                      rows[paymentTerm] && rows[paymentTerm][calc.dxColumn]
                        ? Number(rows[paymentTerm][calc.dxColumn])
                        : 0;
                    const dx_diff = dx_current - dx_paymentTerm;
                    
                    // NNX(Half): NX[rowIndex] - NX[Payment Term] - 1/4*(DX[rowIndex] - DX[Payment Term])
                    const nnxHalf = nnxYear - (1/4) * dx_diff;
                    newRow[`NNX_${baseName}(Half)_Col`] = roundTo5(nnxHalf);
                    
                    // NNX(Quarter): NX[rowIndex] - NX[Payment Term] - 3/8*(DX[rowIndex] - DX[Payment Term])
                    const nnxQuarter = nnxYear - (3/8) * dx_diff;
                    newRow[`NNX_${baseName}(Quarter)_Col`] = roundTo5(nnxQuarter);
                    
                    // NNX(Month): NX[rowIndex] - NX[Payment Term] - 11/24*(DX[rowIndex] - DX[Payment Term])
                    const nnxMonth = nnxYear - (11/24) * dx_diff;
                    newRow[`NNX_${baseName}(Month)_Col`] = roundTo5(nnxMonth);
                  } else {
                    // If DX column is not selected, set other versions to NaN
                    newRow[`NNX_${baseName}(Half)_Col`] = NaN;
                    newRow[`NNX_${baseName}(Quarter)_Col`] = NaN;
                    newRow[`NNX_${baseName}(Month)_Col`] = NaN;
                  }
                }
              }

              // Add BPV column: Sum of all Mx columns × Benefit Amount
              let mmxValue = 0;
              for (const calc of sumxCalculations) {
                if (!calc.mxColumn) continue;
                const mxVal = Number(row[calc.mxColumn]) || 0;
                const benefitAmount = Number(calc.amount) || 0;
                mmxValue += mxVal * benefitAmount;
              }
              newRow["BPV_Col"] = roundTo5(mmxValue);

              return newRow;
            });

            // Create enhanced columns list
            const enhancedColumns = [...inputData.columns];
            // Add NNX columns (4 versions for each Nx column)
            for (const calc of nnxCalculations) {
              if (!calc.nxColumn) continue;
              
              const baseName = calc.nxColumn.replace("Nx_", "");
              
              // Add all 4 versions
              const nnxVersions = [
                `${baseName}(Year)`,
                `${baseName}(Half)`,
                `${baseName}(Quarter)`,
                `${baseName}(Month)`,
              ];
              
              for (const version of nnxVersions) {
                const nnxColumnName = `NNX_${version}_Col`;
                if (!enhancedColumns.find((c) => c.name === nnxColumnName)) {
                  enhancedColumns.push({
                    name: nnxColumnName,
                    type: "number",
                  });
                }
              }
            }
            // Add BPV column (sum of all Mx columns × Benefit Amount)
            if (
              sumxCalculations.length > 0 &&
              !enhancedColumns.find((c) => c.name === "BPV_Col")
            ) {
              enhancedColumns.push({
                name: "BPV_Col",
                type: "number",
              });
            }

            const enhancedData: DataPreview = {
              type: "DataPreview",
              columns: enhancedColumns,
              rows: enhancedRows,
              totalRowCount: enhancedRows.length,
            };

            newOutputData = {
              type: "PremiumComponentOutput",
              nnxResults,
              bpvResults,
              mmxValue: roundTo5(mmxValue),
              mxResults,
              data: enhancedData,
            };
          } else if (module.type === ModuleType.AdditionalName) {
            // Get NNX MMX Calculator output (for validation, but we need the table from its data_in)
            const premiumComponents = getAndValidateConnectedInput(
              module.id,
              "premium_components_in",
              "PremiumComponentOutput"
            );

            // First, try to get table data from PremiumComponentOutput.data (enhanced data with NNX/MMX)
            let inputData: DataPreview | undefined = premiumComponents.data;

            // If not available, trace back to NNX MMX Calculator's data_in
            if (!inputData || !inputData.rows || inputData.rows.length === 0) {
              const premiumComponentsConn = pipelineConnections.find(
                (c) =>
                  c.to.moduleId === module.id &&
                  c.to.portName === "premium_components_in"
              );
              if (premiumComponentsConn) {
                const premiumComponentModule = pipelineModules.find(
                  (m) => m.id === premiumComponentsConn.from.moduleId
                );
                if (premiumComponentModule) {
                  // Recursively trace back through data_in connections
                  const getDataFromConnection = (
                    moduleId: string,
                    portName: string,
                    visited: Set<string> = new Set()
                  ): DataPreview | undefined => {
                    // Prevent infinite loops
                    if (visited.has(moduleId)) return undefined;
                    visited.add(moduleId);

                    const conn = pipelineConnections.find(
                      (c) =>
                        c.to.moduleId === moduleId && c.to.portName === portName
                    );
                    if (!conn) return undefined;

                    const sourceModule = pipelineModules.find(
                      (m) => m.id === conn.from.moduleId
                    );
                    if (!sourceModule) return undefined;

                    // If source module has outputData of type DataPreview, use it
                    if (sourceModule.outputData?.type === "DataPreview") {
                      return sourceModule.outputData as DataPreview;
                    }

                    // If source module has a data_in connection, recursively trace back
                    const sourceDataConn = pipelineConnections.find(
                      (c) =>
                        c.to.moduleId === sourceModule.id &&
                        c.to.portName === "data_in"
                    );
                    if (sourceDataConn) {
                      return getDataFromConnection(
                        sourceModule.id,
                        "data_in",
                        visited
                      );
                    }

                    return undefined;
                  };

                  inputData = getDataFromConnection(
                    premiumComponentModule.id,
                    "data_in"
                  );
                }
              }
            }

            if (!inputData || !inputData.rows) {
              // Check if NNX MMX Calculator is connected
              const premiumComponentsConnForError = pipelineConnections.find(
                (c) =>
                  c.to.moduleId === module.id &&
                  c.to.portName === "premium_components_in"
              );
              if (!premiumComponentsConnForError) {
                throw new Error(
                  "Additional Variables requires a connection to NNX MMX Calculator's premium_components_out port."
                );
              }
              // Check if NNX MMX Calculator has data_in connection
              const premiumComponentModule = pipelineModules.find(
                (m) => m.id === premiumComponentsConnForError.from.moduleId
              );
              if (premiumComponentModule) {
                const hasDataIn = pipelineConnections.some(
                  (c) =>
                    c.to.moduleId === premiumComponentModule.id &&
                    c.to.portName === "data_in"
                );
                if (!hasDataIn) {
                  throw new Error(
                    "NNX MMX Calculator must have a data_in connection. Please connect a data source to NNX MMX Calculator's data_in port."
                  );
                }
              }
              throw new Error(
                "Input data has no rows. Please ensure NNX MMX Calculator has been executed successfully and has table data available."
              );
            }

            const policyInfo = getGlobalPolicyInfo();

            // Get default values from DEFAULT_MODULES if parameters are missing or empty
            const defaultModule = DEFAULT_MODULES.find(
              (m) => m.type === ModuleType.AdditionalName
            );
            const defaultBasicValues = defaultModule?.parameters
              ?.basicValues || [
              { name: "α1", value: 0 },
              { name: "α2", value: 0 },
              { name: "β1", value: 0 },
              { name: "β2", value: 0 },
              { name: "γ", value: 0 },
            ];

            // Ensure module.parameters exists and initialize with defaults if needed
            // Re-check and update from currentModules to ensure we have the latest state
            const modIdxForAdditional = currentModules.findIndex(
              (m) => m.id === module.id
            );
            if (modIdxForAdditional !== -1) {
              module = currentModules[modIdxForAdditional];
            }

            // Initialize parameters if missing or empty
            if (!module.parameters) {
              module.parameters = {
                basicValues: JSON.parse(JSON.stringify(defaultBasicValues)), // Deep copy
                definitions: [],
              };
            } else {
              // Ensure basicValues exists and is valid
              if (
                !module.parameters.basicValues ||
                !Array.isArray(module.parameters.basicValues) ||
                module.parameters.basicValues.length === 0
              ) {
                module.parameters = {
                  ...module.parameters,
                  basicValues: JSON.parse(JSON.stringify(defaultBasicValues)), // Deep copy
                  definitions: module.parameters.definitions || [],
                };
              }
              // Ensure definitions exists
              if (!module.parameters.definitions) {
                module.parameters.definitions = [];
              }
            }

            // Always update the module in currentModules array to ensure consistency
            if (modIdxForAdditional !== -1) {
              currentModules[modIdxForAdditional] = {
                ...currentModules[modIdxForAdditional],
                parameters: module.parameters,
              };
              // Update module reference to use the updated version
              module = currentModules[modIdxForAdditional];
            } else {
              // If module not found in currentModules, update it anyway
              const modIdx = currentModules.findIndex(
                (m) => m.id === module.id
              );
              if (modIdx !== -1) {
                currentModules[modIdx] = {
                  ...currentModules[modIdx],
                  parameters: module.parameters,
                };
                module = currentModules[modIdx];
              }
            }

            // Use the (now guaranteed) module parameters
            const definitions = module.parameters.definitions || [];
            const basicValues = module.parameters.basicValues || [];

            const variables: Record<string, number> = {};

            // Process Basic Values
            for (const bv of basicValues) {
              if (bv.name) {
                variables[bv.name] = Number(bv.value) || 0;
              }
            }

            // Process Custom Definitions
            for (const def of definitions) {
              if (!def.name) continue;

              if (def.type === "static") {
                variables[def.name] = Number(def.staticValue) || 0;
              } else if (def.type === "lookup") {
                if (!def.column) continue;

                let rowIndex = 0;

                if (def.rowType === "entryAge") {
                  // Entry Age is always row 0 (first row)
                  rowIndex = 0;
                } else if (def.rowType === "policyTerm") {
                  rowIndex = policyInfo.policyTerm;
                } else if (def.rowType === "paymentTerm") {
                  rowIndex = policyInfo.paymentTerm;
                } else if (def.rowType === "entryAgePlus") {
                  // Assumes rows start at entry age or index 0 = duration 0.
                  // Usually commutation columns are indexed by age or duration.
                  // If input comes from NxMxCalculator which inherits from SelectRiskRates, row 0 = Entry Age.
                  // So row index for "Entry Age + X" simply means duration index X.
                  rowIndex = Number(def.customValue) || 0;
                } else if (def.rowType === "custom") {
                  rowIndex = Number(def.customValue) || 0;
                }

                // Ensure index is within bounds
                if (rowIndex < 0) rowIndex = 0;
                if (rowIndex >= inputData.rows.length)
                  rowIndex = inputData.rows.length - 1;

                const val = inputData.rows[rowIndex][def.column];
                variables[def.name] = Number(val) || 0;
              }
            }

            // Store both variables output and pass-through NNX MMX Calculator output
            // We'll handle multiple outputs separately
            newOutputData = {
              type: "AdditionalVariablesOutput",
              variables,
              data: inputData, // Include table data in output
              premiumComponents: premiumComponents, // Pass through NNX MMX Calculator output
            };
          } else if (module.type === ModuleType.NetPremiumCalculator) {
            // Get Additional Variables output (contains premiumComponents, variables, and data)
            const additionalVarsOutput = getAndValidateConnectedInput(
              module.id,
              "additional_variables_in",
              "AdditionalVariablesOutput"
            );

            if (!additionalVarsOutput.premiumComponents) {
              throw new Error(
                "Additional Variables output does not contain NNX MMX Calculator output."
              );
            }

            const premiumComponents = additionalVarsOutput.premiumComponents;
            const additionalVars = additionalVarsOutput.variables;
            const policyInfo = getGlobalPolicyInfo();
            const { formula, variableName } = module.parameters;

            if (!formula) throw new Error("Premium formula is not defined.");

            // Get table data from Additional Variables output for table column access
            const additionalData = additionalVarsOutput.data;

            // When policyTerm is 0 (blank), infer n from actual data row count
            // (SelectRiskRates outputs exactly policyTerm rows)
            const effectiveN =
              policyInfo.policyTerm > 0
                ? policyInfo.policyTerm
                : (additionalData?.rows?.length ?? 0);

            const context: Record<string, any> = {
              ...premiumComponents.nnxResults,   // NNX_Mortality(Year), NNX_Mortality(Half), ...
              ...(premiumComponents.bpvResults ?? {}), // BPV_Mortality, BPV_CI, ...
              MMX: premiumComponents.mmxValue,   // backward compat (total)
              SUMX: premiumComponents.mmxValue,  // backward compat
              BPV: premiumComponents.mmxValue,   // total BPV
              m: policyInfo.paymentTerm,
              n: effectiveN,
              PaymentTerm: policyInfo.paymentTerm,
              PolicyTerm: effectiveN,
              ...additionalVars,
            };

            // Add table column access: if formula references a column, use first row value
            // This allows formulas like [Nx_Male_Mortality] to access table columns
            if (
              additionalData &&
              additionalData.rows &&
              additionalData.rows.length > 0
            ) {
              const firstRow = additionalData.rows[0];
              // Add all columns from first row to context (for backward compatibility and direct column access)
              additionalData.columns.forEach((col) => {
                if (
                  firstRow[col.name] !== undefined &&
                  firstRow[col.name] !== null
                ) {
                  context[col.name] = Number(firstRow[col.name]) || 0;
                }
              });
            }

            let expression = formula;

            // Pre-clean context: Remove all brackets from context values before replacement
            const cleanedContext: Record<string, any> = {};
            for (const key in context) {
              let value = (context as any)[key];
              if (typeof value === "number") {
                cleanedContext[key] = value;
              } else if (typeof value === "string") {
                // Remove all brackets from string values
                const cleaned = value
                  .replace(/^\[+|\]+$/g, "")
                  .replace(/\[|\]/g, "");
                const numVal = Number(cleaned);
                cleanedContext[key] =
                  !isNaN(numVal) && isFinite(numVal) ? numVal : cleaned;
              } else {
                cleanedContext[key] = value;
              }
            }

            // STRICT Token Replacement: Only handle [Variable]
            // Sort keys by length (longest first) to avoid partial matches
            const sortedKeys = Object.keys(cleanedContext).sort(
              (a, b) => b.length - a.length
            );

            for (const key of sortedKeys) {
              const token = `[${key}]`;
              // Skip if token doesn't exist in expression
              if (!expression.includes(token)) continue;

              // Get the cleaned value (guaranteed to have no brackets)
              let value = cleanedContext[key];

              // Always convert to string and ensure it's a clean number (no brackets)
              if (typeof value === "number") {
                expression = expression.split(token).join(String(value));
              } else {
                // For non-numbers, ensure no brackets
                const cleanValue = String(value).replace(/\[|\]/g, "");
                expression = expression.split(token).join(cleanValue);
              }
            }

            // Aggressive cleanup: Remove ALL bracket patterns
            // Remove any double brackets (multiple passes to catch nested cases)
            let prevExpression = "";
            let iterationCount = 0;
            while (prevExpression !== expression && iterationCount < 10) {
              prevExpression = expression;
              iterationCount++;
              // Remove triple brackets first
              expression = expression.replace(/\[\[\[([^\]]*)\]\]\]/g, "[$1]");
              // Remove double brackets
              expression = expression.replace(/\[\[([^\]]*)\]\]/g, "$1");
              // Remove any remaining brackets around numbers
              expression = expression.replace(/\[(\d+\.?\d*)\]/g, "$1");
            }
            // Final pass: Remove any brackets around variable-like patterns that are actually numbers
            expression = expression.replace(
              /\[\[?([A-Za-z_][A-Za-z0-9_]*)\]\]?/g,
              (match, varName) => {
                // If it's in our context and is a number, remove brackets
                if (cleanedContext[varName] !== undefined) {
                  const val = cleanedContext[varName];
                  return typeof val === "number" ? String(val) : `[${varName}]`;
                }
                // If not found, keep single bracket only
                return `[${varName}]`;
              }
            );
            // Final cleanup: Remove any remaining double brackets
            expression = expression.replace(/\[\[([^\]]*)\]\]/g, "[$1]");
            // Remove any single brackets around numbers
            expression = expression.replace(/\[(\d+\.?\d*)\]/g, "$1");

            validateFormulaExpression(expression);
            const netPremium = new Function("return " + expression)();

            // Add result to context using user-defined variable name (default PP)
            const resultVarName = variableName || "PP";
            context[resultVarName] = roundTo5(netPremium);

            newOutputData = {
              type: "NetPremiumOutput",
              formula,
              substitutedFormula: expression,
              netPremium: roundTo5(netPremium),
              variables: context, // Include context for downstream modules
            };
          } else if (module.type === ModuleType.GrossPremiumCalculator) {
            const netPremiumInput = getAndValidateConnectedInput(
              module.id,
              "net_premium_in",
              "NetPremiumOutput"
            );
            const { formula, variableName } = module.parameters;

            // Optional: Additional Variables
            let additionalVars: Record<string, number> = {};
            let tableData: DataPreview | null = null;
            const additionalVarsConn = pipelineConnections.find(
              (c) =>
                c.to.moduleId === module.id &&
                c.to.portName === "additional_vars_in"
            );
            if (additionalVarsConn) {
              try {
                const output = getAndValidateConnectedInput(
                  module.id,
                  "additional_vars_in",
                  "AdditionalVariablesOutput"
                );
                additionalVars = output.variables;
                // Get table data from Additional Variables output
                if (output.data) {
                  tableData = output.data;
                }
              } catch (e) {
                throw e;
              }
            }

            // Fallback: If table data not available from Additional Variables, try to get from Net Premium Calculator's source
            if (!tableData) {
              // Find Net Premium Calculator module
              const netPremiumConn = pipelineConnections.find(
                (c) =>
                  c.to.moduleId === module.id &&
                  c.to.portName === "net_premium_in"
              );
              if (netPremiumConn) {
                const netPremiumModule = currentModules.find(
                  (m) => m.id === netPremiumConn.from.moduleId
                );
                if (netPremiumModule) {
                  // Find Additional Variables connected to Net Premium Calculator
                  const additionalVarsConnForNet = pipelineConnections.find(
                    (c) =>
                      c.to.moduleId === netPremiumModule.id &&
                      c.to.portName === "additional_variables_in"
                  );
                  if (additionalVarsConnForNet) {
                    const additionalVarModule = currentModules.find(
                      (m) => m.id === additionalVarsConnForNet.from.moduleId
                    );
                    if (
                      additionalVarModule?.outputData?.type ===
                      "AdditionalVariablesOutput"
                    ) {
                      const output =
                        additionalVarModule.outputData as AdditionalVariablesOutput;
                      if (output.data) {
                        tableData = output.data;
                      }
                    }
                  }
                }
              }
            }

            if (!formula)
              throw new Error("Gross Premium formula is not defined.");

            // Context construction: Inherit previous context + Additional Vars
            // Note: NetPremiumCalculator already added its result (e.g., PP) to variables
            // Ensure m/n are always present (NetPremiumCalculator propagates them, but guard here too)
            let grossPolicyInfo: PolicyInfoOutput | null = null;
            try { grossPolicyInfo = getGlobalPolicyInfo(); } catch (_) {}
            const grossEffectiveN =
              grossPolicyInfo && grossPolicyInfo.policyTerm > 0
                ? grossPolicyInfo.policyTerm
                : (tableData?.rows?.length ?? netPremiumInput.variables?.["n"] ?? 0);
            const context = {
              m: grossPolicyInfo?.paymentTerm ?? 0,
              n: grossEffectiveN,
              PaymentTerm: grossPolicyInfo?.paymentTerm ?? 0,
              PolicyTerm: grossEffectiveN,
              ...netPremiumInput.variables,
              ...additionalVars,
            };

            let expression = formula;

            // Pre-clean context: Remove all brackets from context values before replacement
            const cleanedContext: Record<string, any> = {};
            for (const key in context) {
              let value = (context as any)[key];
              if (typeof value === "number") {
                cleanedContext[key] = value;
              } else if (typeof value === "string") {
                // Remove all brackets from string values
                const cleaned = value
                  .replace(/^\[+|\]+$/g, "")
                  .replace(/\[|\]/g, "");
                const numVal = Number(cleaned);
                cleanedContext[key] =
                  !isNaN(numVal) && isFinite(numVal) ? numVal : cleaned;
              } else {
                cleanedContext[key] = value;
              }
            }

            // STRICT Token Replacement: Only handle [Variable]
            // Sort keys by length (longest first) to avoid partial matches
            const sortedKeys = Object.keys(cleanedContext).sort(
              (a, b) => b.length - a.length
            );

            for (const key of sortedKeys) {
              const token = `[${key}]`;
              // Skip if token doesn't exist in expression
              if (!expression.includes(token)) continue;

              // Get the cleaned value (guaranteed to have no brackets)
              let value = cleanedContext[key];

              // Always convert to string and ensure it's a clean number (no brackets)
              if (typeof value === "number") {
                expression = expression.split(token).join(String(value));
              } else {
                // For non-numbers, ensure no brackets
                const cleanValue = String(value).replace(/\[|\]/g, "");
                expression = expression.split(token).join(cleanValue);
              }
            }

            // Aggressive cleanup: Remove ALL bracket patterns
            // Remove any double brackets (multiple passes to catch nested cases)
            let prevExpression = "";
            let iterationCount = 0;
            while (prevExpression !== expression && iterationCount < 10) {
              prevExpression = expression;
              iterationCount++;
              // Remove triple brackets first
              expression = expression.replace(/\[\[\[([^\]]*)\]\]\]/g, "[$1]");
              // Remove double brackets
              expression = expression.replace(/\[\[([^\]]*)\]\]/g, "[$1]");
              // Remove any remaining brackets around numbers
              expression = expression.replace(/\[(\d+\.?\d*)\]/g, "$1");
            }
            // Final pass: Remove any brackets around variable-like patterns that are actually numbers
            expression = expression.replace(
              /\[\[?([A-Za-z_][A-Za-z0-9_]*)\]\]?/g,
              (match, varName) => {
                // If it's in our context and is a number, remove brackets
                if (cleanedContext[varName] !== undefined) {
                  const val = cleanedContext[varName];
                  return typeof val === "number" ? String(val) : `[${varName}]`;
                }
                // If not found, keep single bracket only
                return `[${varName}]`;
              }
            );
            // Final cleanup: Remove any remaining double brackets
            expression = expression.replace(/\[\[([^\]]*)\]\]/g, "[$1]");
            // Remove any single brackets around numbers
            expression = expression.replace(/\[(\d+\.?\d*)\]/g, "$1");

            // Process IF statements
            expression = processIfStatements(expression);

            validateFormulaExpression(expression);
            const grossPremium = new Function("return " + expression)();

            // Add result to context using user-defined variable name (default GP)
            const resultVarName = variableName || "GP";
            context[resultVarName] = roundTo5(grossPremium);

            newOutputData = {
              type: "GrossPremiumOutput",
              formula,
              substitutedFormula: expression,
              grossPremium: roundTo5(grossPremium),
              variables: context,
              data: tableData || undefined, // Include table data for Reserve Calculator
            };
          } else if (module.type === ModuleType.ReserveCalculator) {
            const grossPremiumInput = getAndValidateConnectedInput(
              module.id,
              "gross_premium_in",
              "GrossPremiumOutput"
            );

            // Get table data directly from Gross Premium Calculator output
            let inputData: DataPreview | null = null;
            if (grossPremiumInput.data) {
              inputData = grossPremiumInput.data;
            }

            if (!inputData || !inputData.rows)
              throw new Error(
                "Input table data is required. Please ensure Gross Premium Calculator is connected to Additional Variables module which provides table data."
              );

            const {
              formulaForPaymentTermOrLess,
              formulaForGreaterThanPaymentTerm,
              reserveColumnName = "Reserve",
            } = module.parameters;

            // Get policy info for PaymentTerm
            let policyInfo: PolicyInfoOutput | null = null;
            try {
              policyInfo = getGlobalPolicyInfo();
            } catch (e) {
              throw new Error(
                "Policy Info is required for Reserve Calculator."
              );
            }

            if (
              !formulaForPaymentTermOrLess &&
              !formulaForGreaterThanPaymentTerm
            ) {
              throw new Error("At least one reserve formula must be defined.");
            }

            const outputRows = inputData.rows.map((r) => ({ ...r }));
            const outputColumnsInfo = [...inputData.columns];
            const paymentTerm = policyInfo.paymentTerm;
            // When policyTerm is 0 (blank), infer n from actual data row count
            const reserveEffectiveN =
              policyInfo.policyTerm > 0
                ? policyInfo.policyTerm
                : inputData.rows.length;

            // Build context from Gross Premium variables and table columns
            for (let rowIndex = 0; rowIndex < outputRows.length; rowIndex++) {
              const row = outputRows[rowIndex];
              let evalFormula = "";

              // Determine which formula to use based on row index vs payment term
              // Row index 0 corresponds to first row (age = entryAge)
              // Payment Term m means rows 0 to m-1 use first formula, rows m+ use second
              if (rowIndex <= paymentTerm - 1) {
                evalFormula = formulaForPaymentTermOrLess || "";
              } else {
                evalFormula = formulaForGreaterThanPaymentTerm || "";
              }

              if (!evalFormula) continue;

              // Build context: Gross Premium variables + table row values
              const context: Record<string, any> = {
                m: paymentTerm,
                n: reserveEffectiveN,
                PaymentTerm: paymentTerm,
                PolicyTerm: reserveEffectiveN,
                ...grossPremiumInput.variables,
              };

              // Replace table column values
              const keys = Object.keys(row).sort((a, b) => b.length - a.length);
              for (const key of keys) {
                const val = row[key];
                evalFormula = evalFormula
                  .split(`[${key}]`)
                  .join(String(val ?? 0));
              }

              // Replace Gross Premium variables and policy terms
              for (const key in context) {
                const token = `[${key}]`;
                evalFormula = evalFormula
                  .split(token)
                  .join(String(context[key]));
              }

              // Process IF statements
              evalFormula = processIfStatements(evalFormula);

              try {
                validateFormulaExpression(evalFormula);
                const result = new Function("return " + evalFormula)();
                row[reserveColumnName] =
                  typeof result === "number" ? roundTo5(result) : result;
              } catch (e) {
                row[reserveColumnName] = null;
              }
            }

            // Add Reserve column to columns info if it doesn't exist
            if (!outputColumnsInfo.some((c) => c.name === reserveColumnName)) {
              outputColumnsInfo.push({
                name: reserveColumnName,
                type: "number",
              });
            }

            newOutputData = {
              type: "DataPreview",
              columns: outputColumnsInfo,
              totalRowCount: outputRows.length,
              rows: outputRows,
            };
          } else if (module.type === ModuleType.PipelineExplainer) {
            // Generate a comprehensive report of the pipeline
            // We will iterate through the topological sort order to explain the flow

            const sort = getTopologicalSort(
              currentModules,
              pipelineConnections
            );
            const steps: PipelineReportStep[] = [];

            // Find the Policy Info first as it's global context
            const policyInfo = getGlobalPolicyInfo();
            steps.push({
              moduleId: "policy-info-global",
              moduleName: "Global Policy Info",
              moduleType: ModuleType.DefinePolicyInfo,
              description:
                "Global policy parameters used throughout the calculation.",
              details: [
                { label: "Entry Age", value: String(policyInfo.entryAge) },
                { label: "Gender", value: policyInfo.gender },
                {
                  label: "Policy Term",
                  value: `${policyInfo.policyTerm} years`,
                },
                {
                  label: "Payment Term",
                  value: `${policyInfo.paymentTerm} years`,
                },
                {
                  label: "Interest Rate",
                  value: `${(policyInfo.interestRate * 100).toFixed(2)}%`,
                },
              ],
            });

            for (const modId of sort) {
              const mod = currentModules.find((m) => m.id === modId);
              if (!mod || mod.id === moduleId) continue; // Skip self and not found

              if (mod.type === ModuleType.LoadData) {
                steps.push({
                  moduleId: mod.id,
                  moduleName: mod.name,
                  moduleType: mod.type,
                  description: `Loaded data from ${mod.parameters.source}`,
                  details: [],
                });
              } else if (mod.type === ModuleType.SelectRiskRates) {
                steps.push({
                  moduleId: mod.id,
                  moduleName: mod.name,
                  moduleType: mod.type,
                  description: "Selected and filtered risk rate table.",
                  details: [
                    { label: "Age Column", value: mod.parameters.ageColumn },
                    {
                      label: "Gender Column",
                      value: mod.parameters.genderColumn,
                    },
                    {
                      label: "Action",
                      value: "Calculated i_prem and i_claim factors.",
                    },
                  ],
                });
              } else if (mod.type === ModuleType.RateModifier) {
                const calcs = mod.parameters.calculations || [];
                steps.push({
                  moduleId: mod.id,
                  moduleName: mod.name,
                  moduleType: mod.type,
                  description: `Applied ${calcs.length} rate modification formulas.`,
                  details: calcs.map((c: any) => ({
                    label: `New Column: ${c.newColumnName}`,
                    value: `Formula: ${c.formula}`,
                  })),
                });
              } else if (mod.type === ModuleType.CalculateSurvivors) {
                const calcs = mod.parameters.calculations || [];
                const dp = mod.outputData as DataPreview | undefined;
                const auditCols = dp?.columns
                  ?.map((c) => c.name)
                  .filter((n) =>
                    /^(age|lx_|Dx_)/i.test(n)
                  ) ?? [];
                const auditRows = dp?.rows?.slice(0, 8) ?? [];
                steps.push({
                  moduleId: mod.id,
                  moduleName: mod.name,
                  moduleType: mod.type,
                  description: "Calculated survivor counts (lx) and Dx.",
                  details: calcs.map((c: any) => ({
                    label: `Calculation: ${c.name}`,
                    value: `Decrements: ${(c.decrementRates || []).join(", ")}`,
                  })),
                  ...(auditCols.length > 0 && auditRows.length > 0
                    ? {
                        auditTable: {
                          columns: auditCols,
                          rows: auditRows,
                          totalRows: dp?.totalRowCount,
                        },
                      }
                    : {}),
                });
              } else if (mod.type === ModuleType.ClaimsCalculator) {
                const calcs = mod.parameters.calculations || [];
                const dp = mod.outputData as DataPreview | undefined;
                const auditCols = dp?.columns
                  ?.map((c) => c.name)
                  .filter((n) => /^(age|dx_|Cx_)/i.test(n)) ?? [];
                const auditRows = dp?.rows?.slice(0, 8) ?? [];
                steps.push({
                  moduleId: mod.id,
                  moduleName: mod.name,
                  moduleType: mod.type,
                  description: "Calculated claim amounts (dx) and Cx.",
                  details: calcs.map((c: any) => ({
                    label: `Calculation: ${c.name || "Unnamed"}`,
                    value: `lx: ${c.lxColumn}, q: ${c.riskRateColumn}`,
                  })),
                  ...(auditCols.length > 0 && auditRows.length > 0
                    ? {
                        auditTable: {
                          columns: auditCols,
                          rows: auditRows,
                          totalRows: dp?.totalRowCount,
                        },
                      }
                    : {}),
                });
              } else if (mod.type === ModuleType.NxMxCalculator) {
                const nx = mod.parameters.nxCalculations || [];
                const mx = mod.parameters.mxCalculations || [];
                const dp = mod.outputData as DataPreview | undefined;
                const auditCols = dp?.columns
                  ?.map((c) => c.name)
                  .filter((n) => /^(age|Nx_|Mx_)/i.test(n)) ?? [];
                const auditRows = dp?.rows?.slice(0, 8) ?? [];
                steps.push({
                  moduleId: mod.id,
                  moduleName: mod.name,
                  moduleType: mod.type,
                  description: "Calculated commutation functions Nx and Mx.",
                  details: [
                    ...nx.map((c: any) => ({
                      label: `Nx: ${c.name}`,
                      value: `From: ${c.baseColumn}`,
                    })),
                    ...mx.map((c: any) => ({
                      label: `Mx: ${c.name}`,
                      value: `From: ${c.baseColumn} (Deductible: ${c.deductibleType})`,
                    })),
                  ],
                  ...(auditCols.length > 0 && auditRows.length > 0
                    ? {
                        auditTable: {
                          columns: auditCols,
                          rows: auditRows,
                          totalRows: dp?.totalRowCount,
                        },
                      }
                    : {}),
                });
              } else if (mod.type === ModuleType.PremiumComponent) {
                const dp = mod.outputData as DataPreview | undefined;
                const auditCols = dp?.columns?.map((c) => c.name).filter((n) =>
                  /^(age|NNX|MMX|Dx_)/i.test(n)
                ) ?? [];
                const auditRows = dp?.rows?.slice(0, 8) ?? [];
                steps.push({
                  moduleId: mod.id,
                  moduleName: mod.name,
                  moduleType: mod.type,
                  description: "Aggregated NNX and BPV components.",
                  details: [
                    ...(mod.parameters.nnxCalculations || []).map((c: any) => ({
                      label: "NNX Source",
                      value: c.nxColumn,
                    })),
                    ...(mod.parameters.sumxCalculations || []).map(
                      (c: any) => ({
                        label: "BPV Source",
                        value: `${c.mxColumn} (Amount: ${c.amount})`,
                      })
                    ),
                  ],
                  ...(auditCols.length > 0 && auditRows.length > 0
                    ? {
                        auditTable: {
                          columns: auditCols,
                          rows: auditRows,
                          totalRows: dp?.totalRowCount,
                        },
                      }
                    : {}),
                });
              } else if (mod.type === ModuleType.AdditionalName) {
                const defs = mod.parameters.definitions || [];
                const bvs = mod.parameters.basicValues || [];
                steps.push({
                  moduleId: mod.id,
                  moduleName: mod.name,
                  moduleType: mod.type,
                  description: "Defined additional variables.",
                  details: [
                    ...bvs.map((b: any) => ({
                      label: b.name,
                      value: `Basic Value: ${b.value}`,
                    })),
                    ...defs.map((d: any) => ({
                      label: d.name,
                      value:
                        d.type === "static"
                          ? `Static: ${d.staticValue}`
                          : `Lookup: ${d.column} @ ${d.rowType}`,
                    })),
                  ],
                });
              } else if (mod.type === ModuleType.NetPremiumCalculator) {
                steps.push({
                  moduleId: mod.id,
                  moduleName: mod.name,
                  moduleType: mod.type,
                  description: "Calculated final Net Premium.",
                  details: [
                    { label: "Formula", value: mod.parameters.formula },
                    {
                      label: "Substituted",
                      value:
                        (mod.outputData as NetPremiumOutput)
                          ?.substitutedFormula || "N/A",
                    },
                    {
                      label: "Result",
                      value: String(
                        (mod.outputData as NetPremiumOutput)?.netPremium
                      ),
                    },
                  ],
                });
              } else if (mod.type === ModuleType.GrossPremiumCalculator) {
                steps.push({
                  moduleId: mod.id,
                  moduleName: mod.name,
                  moduleType: mod.type,
                  description: "Calculated Gross Premium from Net Premium.",
                  details: [
                    { label: "Formula", value: mod.parameters.formula },
                    {
                      label: "Substituted",
                      value:
                        (mod.outputData as GrossPremiumOutput)
                          ?.substitutedFormula || "N/A",
                    },
                    {
                      label: "Result",
                      value: String(
                        (mod.outputData as GrossPremiumOutput)?.grossPremium
                      ),
                    },
                  ],
                });
              }
            }

            newOutputData = {
              type: "PipelineExplainerOutput",
              steps: steps,
            };
          }

          newStatus = ModuleStatus.Success;
          logFn(moduleId, `SUCCESS: Module finished successfully.`);
        } catch (error: any) {
          newStatus = ModuleStatus.Error;
          const errorMessage = `ERROR: ${error.message}`;
          logFn(moduleId, errorMessage);
          console.error(`Module [${module.name}] failed: ${error.message}`);

          const finalModuleState = {
            ...module,
            parameters: module.parameters, // Preserve updated parameters (including defaults)
            status: newStatus,
            outputData: newOutputData,
          };
          const errorModuleIdx = currentModules.findIndex(
            (m) => m.id === moduleId
          );
          currentModules[errorModuleIdx] = finalModuleState;

          if (throwOnError) {
            throw new Error(error.message);
          }
          return currentModules;
        }

        const finalModuleState = {
          ...module,
          parameters: module.parameters, // Preserve updated parameters (including defaults)
          status: newStatus,
          outputData: newOutputData,
        };
        const successModuleIdx = currentModules.findIndex(
          (m) => m.id === moduleId
        );
        currentModules[successModuleIdx] = finalModuleState;
      }
      return currentModules;
    },
    [getTopologicalSort]
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

      // Filter out ScenarioRunner and PipelineExplainer from Run All
      const filteredModules = modules.filter(
        (m) =>
          m.type !== ModuleType.ScenarioRunner &&
          m.type !== ModuleType.PipelineExplainer
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
          alert(
            `${errorMsg}\n\nCheck the Terminal panel for detailed error logs.`
          );
          setIsCodePanelVisible(true);
          setSelectedModuleIds([failedModuleInQueue.id]);
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
      } catch (error: any) {
        // This catch block handles unexpected errors outside executePipeline (e.g. during getTopologicalSort or setModules)
        console.error("Unexpected error during simulation run:", error);
        alert(`An unexpected error occurred: ${error.message}`);
      }
    },
    [
      modules,
      connections,
      executePipeline,
      runScenarioRunner,
      getTopologicalSort,
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
      name: "Data",
      types: [
        ModuleType.DefinePolicyInfo,
        ModuleType.LoadData,
        ModuleType.SelectRiskRates,
        ModuleType.SelectData,
        ModuleType.RateModifier,
      ],
    },
    {
      name: "Actuarial",
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
      name: "Automation",
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

  return (
    <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white h-screen w-full flex flex-col overflow-hidden transition-colors duration-200">
      {/* 초기 화면 저장 토스트 */}
      {initialSavedToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 border border-gray-700 dark:border-gray-300 flex items-center gap-2 animate-fade-in">
          {initialSavedToast}
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
        </div>

        {/* 두 번째 줄: 테마, Undo/Redo, Set Folder, Load, Save, Run All */}
        <div className="flex items-center justify-end gap-2 w-full overflow-x-auto scrollbar-hide mt-1">
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
            title="Set Save Folder"
          >
            <FolderOpenIcon className="h-4 w-4" />
            <span>Set Folder</span>
          </button>
          <button
            onClick={handleLoadPipeline}
            className="flex items-center gap-2 px-3 py-1.5 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-md font-semibold transition-colors flex-shrink-0"
            title="Load Pipeline"
          >
            <FolderOpenIcon className="h-4 w-4" />
            <span>Load</span>
          </button>
          <button
            onClick={handleSavePipeline}
            disabled={!isDirty}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-md font-semibold transition-colors flex-shrink-0 text-white dark:text-white ${
              !isDirty
                ? "bg-gray-400 dark:bg-gray-600 cursor-not-allowed opacity-50"
                : "bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600"
            }`}
            title="Save Pipeline"
          >
            {saveButtonText === "Save" ? (
              <ArrowDownTrayIcon className="h-4 w-4" />
            ) : (
              <CheckIcon className="h-4 w-4" />
            )}
            <span>{saveButtonText}</span>
          </button>
          <div className="h-5 border-l border-gray-300 dark:border-gray-700"></div>
          <SlideReportButton productName={productName} modules={modules} />
          <div className="h-5 border-l border-gray-300 dark:border-gray-700"></div>
          <button
            onClick={() => runSimulation()}
            className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-md font-semibold transition-colors flex-shrink-0 bg-green-600 hover:bg-green-500 text-white"
            title="Run All Modules"
          >
            <PlayIcon className="h-4 w-4" />
            <span>Run All</span>
          </button>
          <div className="h-5 border-l border-gray-300 dark:border-gray-700"></div>
          <button
            onClick={() => setIsAIGoalModalOpen(true)}
            disabled={isGeneratingPipeline}
            title="AI로 파이프라인 생성"
            className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-md font-semibold transition-colors flex-shrink-0 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white"
          >
            <SparklesIcon className="w-4 h-4" />
            <span>{isGeneratingPipeline ? 'AI 생성 중...' : 'AI 생성'}</span>
          </button>
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
              title="Samples"
            >
              <BeakerIcon className="h-4 w-4" />
              <span>Samples</span>
            </button>
            <button
              onClick={() => setIsDSLModalOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-md font-semibold transition-colors flex-shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white"
              title="출력=수식 형태로 파이프라인 전체 정의"
            >
              <span>📝</span>
              <span>DSL 정의</span>
            </button>
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
                title="My Personal Work"
              >
                <FolderOpenIcon className="h-4 w-4" />
                <span>My Work</span>
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
                    onClick={handleSetAsInitial}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer flex items-center gap-2 border-b border-gray-200 dark:border-gray-700"
                    title="현재 캔버스 모델을 앱 시작 기본 화면으로 저장합니다"
                  >
                    <SparklesIcon className="w-4 h-4 text-yellow-400" />
                    <div className="flex flex-col">
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
              title="Toggle Code & Terminal Panel"
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
                title="Pipeline Execution"
              >
                <QueueListIcon className="h-4 w-4" />
                Pipeline Execution
              </button>
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
                                      title={moduleInfo.name}
                                    >
                                      <moduleInfo.icon className="h-4 w-4 text-gray-700 dark:text-gray-300" />
                                    </button>
                                    {/* Tooltip */}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-0.5 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                                      {moduleInfo.name}
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
                                title={moduleInfo.description}
                              >
                                <moduleInfo.icon className="h-4 w-4 flex-shrink-0" />
                                {moduleInfo.name}
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
