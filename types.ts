export enum ModuleType {
  LoadData = "LoadData",
  SelectData = "SelectData",
  DefinePolicyInfo = "DefinePolicyInfo",
  SelectRiskRates = "SelectRiskRates",
  Statistics = "Statistics",
  HandleMissingValues = "HandleMissingValues",
  EncodeCategorical = "EncodeCategorical",
  NormalizeData = "NormalizeData",
  TransitionData = "TransitionData",
  TransformData = "TransformData",
  SplitData = "SplitData",
  ResampleData = "ResampleData",
  TrainModel = "TrainModel",
  ScoreModel = "ScoreModel",
  EvaluateModel = "EvaluateModel",
  LinearRegression = "LinearRegression",
  LogisticRegression = "LogisticRegression",
  DecisionTree = "DecisionTree",
  RandomForest = "RandomForest",
  SVM = "SVM",
  KNN = "KNN",
  NaiveBayes = "NaiveBayes",
  LinearDiscriminantAnalysis = "LinearDiscriminantAnalysis",
  StatModels = "StatModels",
  ResultModel = "ResultModel",
  PredictModel = "PredictModel",
  KMeans = "KMeans",
  HierarchicalClustering = "HierarchicalClustering",
  DBSCAN = "DBSCAN",
  PrincipalComponentAnalysis = "PrincipalComponentAnalysis",
  FitLossDistribution = "FitLossDistribution",
  GenerateExposureCurve = "GenerateExposureCurve",
  PriceXoLLayer = "PriceXoLLayer",
  XolLoading = "XolLoading",
  ApplyThreshold = "ApplyThreshold",
  DefineXolContract = "DefineXolContract",
  CalculateCededLoss = "CalculateCededLoss",
  PriceXolContract = "PriceXolContract",
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
    | "model"
    | "evaluation"
    | "distribution"
    | "curve"
    | "contract"
    | "handler"
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

export interface StatisticsOutput {
  type: "StatisticsOutput";
  stats: Record<
    string,
    {
      count: number;
      mean?: number;
      std?: number;
      min?: number;
      "25%"?: number;
      "50%"?: number;
      "75%"?: number;
      max?: number;
      mode?: string | number;
      nulls: number;
      skewness?: number;
      kurtosis?: number;
    }
  >;
  correlation: Record<string, Record<string, number>>;
}

export interface SplitDataOutput {
  type: "SplitDataOutput";
  train: DataPreview;
  test: DataPreview;
}

export interface TrainedModelOutput {
  type: "TrainedModelOutput";
  modelType: ModuleType;
  coefficients: Record<string, number>;
  intercept: number;
  metrics: Record<string, string | number>;
  featureColumns: string[];
  labelColumn: string;
}

export interface StatsModelsResultOutput {
  type: "StatsModelsResultOutput";
  summary: {
    metrics: Record<string, string | number>;
    coefficients: Record<
      string,
      {
        coef: number;
        "std err": number;
        t?: number;
        z?: number;
        "P>|t|"?: number;
        "P>|z|"?: number;
        "[0.025": number;
        "0.975]": number;
      }
    >;
  };
  modelType: string;
  labelColumn: string;
}

export interface EvaluationOutput {
  type: "EvaluationOutput";
  modelType: "regression" | "classification";
  metrics: Record<string, string | number>;
}

export interface FittedDistributionOutput {
  type: "FittedDistributionOutput";
  params: any;
}

export interface ExposureCurveOutput {
  type: "ExposureCurveOutput";
  curve: [number, number][];
}

export interface XoLPriceOutput {
  type: "XoLPriceOutput";
  retention: number;
  limit: number;
  expectedLayerLoss: number;
  rateOnLinePct: number;
  premium: number;
}

export interface FinalXolPriceOutput {
  type: "FinalXolPriceOutput";
  expectedLoss: number;
  stdDev: number;
  volatilityMargin: number;
  purePremium: number;
  expenseLoading: number;
  finalPremium: number;
}

export interface MissingHandlerOutput {
  type: "MissingHandlerOutput";
  method: string;
  strategy?: string;
}

export interface EncoderOutput {
  type: "EncoderOutput";
  method: string;
}

export interface NormalizerOutput {
  type: "NormalizerOutput";
  method: string;
}

export interface KMeansOutput {
  type: "KMeansOutput";
  clusterAssignments: DataPreview;
}
export interface HierarchicalClusteringOutput {
  type: "HierarchicalClusteringOutput";
  clusterAssignments: DataPreview;
}
export interface DBSCANOutput {
  type: "DBSCANOutput";
  clusterAssignments: DataPreview;
}
export interface PCAOutput {
  type: "PCAOutput";
  transformedData: DataPreview;
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
  | StatisticsOutput
  | SplitDataOutput
  | TrainedModelOutput
  | StatsModelsResultOutput
  | EvaluationOutput
  | FittedDistributionOutput
  | ExposureCurveOutput
  | XoLPriceOutput
  | FinalXolPriceOutput
  | MissingHandlerOutput
  | EncoderOutput
  | NormalizerOutput
  | KMeansOutput
  | HierarchicalClusteringOutput
  | DBSCANOutput
  | PCAOutput
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
