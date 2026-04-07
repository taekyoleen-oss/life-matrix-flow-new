export enum ModuleType {
  LoadData = "LoadData",
  SelectData = "SelectData",
  DefinePolicyInfo = "DefinePolicyInfo",
  SelectRiskRates = "SelectRiskRates",
  CalculateSurvivors = "CalculateSurvivors",
  ClaimsCalculator = "ClaimsCalculator",
  NxMxCalculator = "NxMxCalculator",
  PremiumComponent = "PremiumComponent",
  NetPremiumCalculator = "NetPremiumCalculator",
  GrossPremiumCalculator = "GrossPremiumCalculator",
  ReserveCalculator = "ReserveCalculator",
  ScenarioRunner = "ScenarioRunner",
  RateModifier = "RateModifier",
  PipelineExplainer = "PipelineExplainer",
  AdditionalName = "AdditionalName",
  TextBox = "TextBox",
  GroupBox = "GroupBox",
}

export enum ModuleStatus {
  Pending = "Pending",
  Running = "Running",
  Success = "Success",
  Error = "Error",
}

export interface Port {
  name: string;
  type:
    | "data"
    | "policy_info"
    | "premium_components"
    | "premium"
    | "scenario_result"
    | "report"
    | "variables"
    | "additional_variables";
}

export interface ColumnInfo {
  name: string;
  type: string;
  description?: string; // Tooltip: how this column was calculated
}

export interface DataPreview {
  type: "DataPreview"; // Differentiator
  columns: ColumnInfo[];
  totalRowCount: number;
  rows?: Record<string, any>[];
}

export interface PolicyInfoOutput {
  type: "PolicyInfoOutput";
  entryAge: number;
  gender: "Male" | "Female";
  policyTerm: number;
  paymentTerm: number;
  interestRate: number;
}

export interface PremiumComponentOutput {
  type: "PremiumComponentOutput";
  nnxResults: Record<string, number>;  // { "NNX_Mortality(Year)": value, ... }
  bpvResults: Record<string, number>;  // { "BPV_Mortality": value, ... }
  mmxValue: number; // total BPV scalar (backward compat)
  mxResults: Record<string, number>;   // { "Mortality": value, ... }
  data?: DataPreview; // Table data with NNX and BPV columns added
}

export interface AdditionalVariablesOutput {
  type: "AdditionalVariablesOutput";
  variables: Record<string, number>;
  data?: DataPreview; // Optional: table data passed through
  premiumComponents?: PremiumComponentOutput; // Pass through premium components
}

export interface NetPremiumOutput {
  type: "NetPremiumOutput";
  formula: string;
  substitutedFormula?: string;
  netPremium: number;
  variables: Record<string, number>;
}

export interface GrossPremiumOutput {
  type: "GrossPremiumOutput";
  formula: string;
  substitutedFormula?: string;
  grossPremium: number;
  variables?: Record<string, number>;
  data?: DataPreview; // Table data from upstream modules
}

export interface ScenarioRunnerOutput {
  type: "ScenarioRunnerOutput";
  columns: ColumnInfo[];
  totalRowCount: number;
  rows?: Record<string, any>[];
}

export interface PipelineReportStep {
  moduleId: string;
  moduleName: string;
  moduleType: ModuleType;
  description: string;
  details: { label: string; value: string }[];
  auditTable?: {
    columns: string[];
    rows: Record<string, any>[];
    totalRows?: number;
  };
}

export interface PipelineExplainerOutput {
  type: "PipelineExplainerOutput";
  steps: PipelineReportStep[];
}

export type ModuleOutput =
  | DataPreview
  | PolicyInfoOutput
  | PremiumComponentOutput
  | AdditionalVariablesOutput
  | NetPremiumOutput
  | GrossPremiumOutput
  | ScenarioRunnerOutput
  | PipelineExplainerOutput;

export interface CanvasModule {
  id: string;
  name: string;
  type: ModuleType;
  position: { x: number; y: number };
  status: ModuleStatus;
  parameters: Record<string, any>;
  inputs: Port[];
  outputs: Port[];
  outputData?: ModuleOutput;
}

export interface Connection {
  id: string;
  from: { moduleId: string; portName: string };
  to: { moduleId: string; portName: string };
}

export interface GroupBoxData {
  moduleIds: string[];
  bounds: { x: number; y: number; width: number; height: number };
}
