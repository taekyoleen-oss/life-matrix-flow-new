import { ModuleType, CanvasModule, ModuleStatus } from "./types";
import {
  DatabaseIcon,
  TableCellsIcon,
  DocumentTextIcon,
  CalculatorIcon,
  PriceTagIcon,
  CheckBadgeIcon,
  QueueListIcon,
  AdjustmentsHorizontalIcon,
  ClipboardDocumentListIcon,
  TagIcon,
  BanknotesIcon,
  TextBoxIcon,
  GroupBoxIcon,
} from "./components/icons";

export const TOOLBOX_MODULES = [
  {
    type: ModuleType.DefinePolicyInfo,
    name: "Define Policy Info",
    icon: DocumentTextIcon,
    description:
      "Sets the basic information for the insurance product, such as age, gender, and terms.",
  },
  {
    type: ModuleType.LoadData,
    name: "Load Risk Rates",
    icon: DatabaseIcon,
    description:
      "Loads a risk rate table (e.g., mortality rates) from a CSV file.",
  },
  {
    type: ModuleType.SelectRiskRates,
    name: "Rating Basis Builder",
    icon: TableCellsIcon,
    description:
      "Selects rates for the policy term and calculates present value factors.",
  },
  {
    type: ModuleType.SelectData,
    name: "Select Rates",
    icon: TableCellsIcon,
    description: "Selects or removes columns from the data.",
  },
  {
    type: ModuleType.RateModifier,
    name: "Rate Modifier",
    icon: AdjustmentsHorizontalIcon,
    description:
      "Creates new risk rate columns by applying formulas to existing columns.",
  },
  {
    type: ModuleType.CalculateSurvivors,
    name: "Survivors Calculator",
    icon: CalculatorIcon,
    description:
      "Calculates the number of survivors over time based on selected risk rates.",
  },
  {
    type: ModuleType.ClaimsCalculator,
    name: "Claims Calculator",
    icon: CalculatorIcon,
    description:
      "Calculates claim amounts (dx) and commutation functions (Cx) based on survivors (lx), risk rates, and present value factors.",
  },
  {
    type: ModuleType.NxMxCalculator,
    name: "Nx Mx Calculator",
    icon: CalculatorIcon,
    description:
      "Generates commutation functions Nx and Mx by summing Dx and Cx, with advanced options for Mx.",
  },
  {
    type: ModuleType.PremiumComponent,
    name: "NNX MMX Calculator",
    icon: CalculatorIcon,
    description:
      "Calculates aggregate commutation functions (NNX, MMX) for premium calculation.",
  },
  {
    type: ModuleType.AdditionalName,
    name: "Additional Variables",
    icon: TagIcon,
    description:
      "Defines custom variables or extracts specific values from the data table for use in premium calculations.",
  },
  {
    type: ModuleType.NetPremiumCalculator,
    name: "Net Premium Calculator",
    icon: CheckBadgeIcon,
    description:
      "Calculates the final net premium using a user-defined formula.",
  },
  {
    type: ModuleType.GrossPremiumCalculator,
    name: "Gross Premium Calculator",
    icon: BanknotesIcon,
    description:
      "Calculates the gross premium (GP) based on Net Premium (PP) and loadings.",
  },
  {
    type: ModuleType.ReserveCalculator,
    name: "Reserve Calculator",
    icon: CalculatorIcon,
    description:
      "Calculates reserve values based on Gross Premium Calculator results and table data, with conditional formulas based on Payment Term.",
  },
  {
    type: ModuleType.ScenarioRunner,
    name: "Scenario Runner",
    icon: QueueListIcon,
    description:
      "Runs the entire pipeline multiple times for different scenarios and aggregates the results.",
  },
  {
    type: ModuleType.PipelineExplainer,
    name: "Pipeline Explainer",
    icon: ClipboardDocumentListIcon,
    description:
      "Generates a detailed report of the entire calculation pipeline, including formulas and steps.",
  },
  {
    type: ModuleType.TextBox,
    name: "텍스트 상자",
    icon: TextBoxIcon,
    description: "캔버스에 텍스트를 입력할 수 있는 텍스트 상자를 추가합니다.",
  },
  {
    type: ModuleType.GroupBox,
    name: "그룹 상자",
    icon: GroupBoxIcon,
    description: "선택된 모듈들을 그룹으로 묶어 함께 이동할 수 있도록 합니다.",
  },
];

export const DEFAULT_MODULES: Omit<CanvasModule, "id" | "position" | "name">[] =
  [
    {
      type: ModuleType.LoadData,
      status: ModuleStatus.Pending,
      parameters: { source: "your-risk-rates.csv" },
      inputs: [],
      outputs: [{ name: "data_out", type: "data" }],
    },
    {
      type: ModuleType.SelectData,
      status: ModuleStatus.Pending,
      parameters: { selections: [] },
      inputs: [{ name: "data_in", type: "data" }],
      outputs: [{ name: "data_out", type: "data" }],
    },
    {
      type: ModuleType.RateModifier,
      status: ModuleStatus.Pending,
      parameters: { calculations: [] },
      inputs: [{ name: "data_in", type: "data" }],
      outputs: [{ name: "data_out", type: "data" }],
    },
    {
      type: ModuleType.DefinePolicyInfo,
      status: ModuleStatus.Pending,
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
          { name: "γ",  value: 0 },
        ],
      },
      inputs: [],
      outputs: [{ name: "policy_info_out", type: "policy_info" }],
    },
    {
      type: ModuleType.SelectRiskRates,
      status: ModuleStatus.Pending,
      parameters: {
        ageColumn: "Age",
        genderColumn: "Sex",
        excludeNonNumericRows: true,
      },
      inputs: [{ name: "risk_data_in", type: "data" }],
      outputs: [{ name: "selected_rates_out", type: "data" }],
    },
    {
      type: ModuleType.CalculateSurvivors,
      status: ModuleStatus.Pending,
      parameters: {
        ageColumn: "Age",
        mortalityColumn: "None",
        calculations: [],
        addFixedLx: false,
      },
      inputs: [{ name: "data_in", type: "data" }],
      outputs: [{ name: "data_out", type: "data" }],
    },
    {
      type: ModuleType.ClaimsCalculator,
      status: ModuleStatus.Pending,
      parameters: { calculations: [] },
      inputs: [{ name: "data_in", type: "data" }],
      outputs: [{ name: "data_out", type: "data" }],
    },
    {
      type: ModuleType.NxMxCalculator,
      status: ModuleStatus.Pending,
      parameters: {
        nxCalculations: [],
        mxCalculations: [
          // Example structure of a calculation item. Added in the UI component.
          /*
            {
              id: 'mx-calc-1',
              baseColumn: 'Cx_SomeRate',
              name: 'SomeRate',
              deductibleType: '0', // '0', '0.25', '0.5', 'custom'
              customDeductible: 0,
              paymentRatios: [
                { year: 1, type: '100%', customValue: 100 },
                { year: 2, type: '100%', customValue: 100 },
                { year: 3, type: '100%', customValue: 100 }
              ]
            }
            */
        ],
      },
      inputs: [{ name: "data_in", type: "data" }],
      outputs: [{ name: "data_out", type: "data" }],
    },
    {
      type: ModuleType.PremiumComponent,
      status: ModuleStatus.Pending,
      parameters: { nnxCalculations: [], sumxCalculations: [] },
      inputs: [{ name: "data_in", type: "data" }],
      outputs: [{ name: "premium_components_out", type: "premium_components" }],
    },
    {
      type: ModuleType.AdditionalName,
      status: ModuleStatus.Pending,
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
      inputs: [{ name: "premium_components_in", type: "premium_components" }],
      outputs: [{ name: "output", type: "additional_variables" }],
    },
    {
      type: ModuleType.NetPremiumCalculator,
      status: ModuleStatus.Pending,
      parameters: { formula: "", variableName: "PP" },
      inputs: [
        { name: "additional_variables_in", type: "additional_variables" },
      ],
      outputs: [{ name: "premium_out", type: "premium" }],
    },
    {
      type: ModuleType.GrossPremiumCalculator,
      status: ModuleStatus.Pending,
      parameters: { formula: "PP / (1 - 0.0)", variableName: "GP" },
      inputs: [
        { name: "net_premium_in", type: "premium" },
        { name: "additional_vars_in", type: "variables" },
      ],
      outputs: [{ name: "gross_premium_out", type: "premium" }],
    },
    {
      type: ModuleType.ReserveCalculator,
      status: ModuleStatus.Pending,
      parameters: {
        formulaForPaymentTermOrLess: "",
        formulaForGreaterThanPaymentTerm: "",
        reserveColumnName: "Reserve",
      },
      inputs: [{ name: "gross_premium_in", type: "premium" }],
      outputs: [{ name: "data_out", type: "data" }],
    },
    {
      type: ModuleType.ScenarioRunner,
      status: ModuleStatus.Pending,
      parameters: {
        scenarios: [],
      },
      inputs: [],
      outputs: [{ name: "scenario_result_out", type: "scenario_result" }],
    },
    {
      type: ModuleType.PipelineExplainer,
      status: ModuleStatus.Pending,
      parameters: {},
      inputs: [],
      outputs: [{ name: "report_out", type: "report" }],
    },
    {
      type: ModuleType.TextBox,
      status: ModuleStatus.Pending,
      parameters: {
        text: "",
        fontSize: 14,
        color: "#90ee90",
        width: 200,
        height: 60,
      },
      inputs: [],
      outputs: [],
    },
    {
      type: ModuleType.GroupBox,
      status: ModuleStatus.Pending,
      parameters: {
        moduleIds: [],
        bounds: { x: 0, y: 0, width: 0, height: 0 },
        fontSize: 12,
      },
      inputs: [],
      outputs: [],
    },
  ];
