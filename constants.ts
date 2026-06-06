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
    nameKo: "보험상품 정보 (Policy Info)",
    icon: DocumentTextIcon,
    description:
      "Sets the basic information for the insurance product, such as age, gender, and terms.",
    descriptionKo:
      "가입나이·성별·보험기간·납입기간·예정이율 등 상품의 기본 정보를 정의합니다. 산출의 출발점입니다.",
  },
  {
    type: ModuleType.LoadData,
    name: "Load Risk Rates",
    nameKo: "위험률 데이터 로드 (Load Rates)",
    icon: DatabaseIcon,
    description:
      "Loads a risk rate table (e.g., mortality rates) from a CSV file.",
    descriptionKo:
      "CSV 파일에서 위험률 표(예: 사망률)를 불러옵니다. 보험료 산출의 첫 단계입니다.",
  },
  {
    type: ModuleType.SelectRiskRates,
    name: "Rating Basis Builder",
    nameKo: "연령·성별 매칭 (Rating Basis)",
    icon: TableCellsIcon,
    description:
      "Selects rates for the policy term and calculates present value factors.",
    descriptionKo:
      "가입나이·성별에 맞는 위험률을 보험기간만큼 추출하고 할인계수(현가요소)를 계산합니다.",
  },
  {
    type: ModuleType.SelectData,
    name: "Select Rates",
    nameKo: "데이터 선택 (Select)",
    icon: TableCellsIcon,
    description: "Selects or removes columns from the data.",
    descriptionKo: "표에서 사용할 열을 고르거나 불필요한 열을 제거합니다.",
  },
  {
    type: ModuleType.RateModifier,
    name: "Rate Modifier",
    nameKo: "위험률 가공 (Rate Modifier)",
    icon: AdjustmentsHorizontalIcon,
    description:
      "Creates new risk rate columns by applying formulas to existing columns.",
    descriptionKo:
      "기존 열에 수식을 적용해 새로운 위험률 열을 만듭니다(예: 사망률 × 할증).",
  },
  {
    type: ModuleType.CalculateSurvivors,
    name: "Survivors Calculator",
    nameKo: "생존자 계산 (Survivors)",
    icon: CalculatorIcon,
    description:
      "Calculates the number of survivors over time based on selected risk rates.",
    descriptionKo:
      "선택한 위험률을 적용해 기간별 생존자수(lx)와 할인생존자수(Dx)를 계산합니다.",
  },
  {
    type: ModuleType.ClaimsCalculator,
    name: "Claims Calculator",
    nameKo: "사망자 계산 (Claims)",
    icon: CalculatorIcon,
    description:
      "Calculates claim amounts (dx) and commutation functions (Cx) based on survivors (lx), risk rates, and present value factors.",
    descriptionKo:
      "생존자수(lx)·위험률·할인계수로 사망자수(dx)와 할인사망자수(Cx)를 계산합니다.",
  },
  {
    type: ModuleType.NxMxCalculator,
    name: "Nx Mx Calculator",
    nameKo: "통상함수 Nx·Mx 계산 (Nx Mx)",
    icon: CalculatorIcon,
    description:
      "Generates commutation functions Nx and Mx by summing Dx and Cx, with advanced options for Mx.",
    descriptionKo:
      "Dx·Cx를 누적해 통상함수 Nx(연금)·Mx(보험금)를 만듭니다. Mx는 지급비율·면책 옵션 지원.",
  },
  {
    type: ModuleType.PremiumComponent,
    name: "NNX MMX Calculator",
    nameKo: "보험료 구성요소 NNX·BPV (NNX MMX)",
    icon: CalculatorIcon,
    description:
      "Calculates aggregate commutation functions (NNX, MMX) for premium calculation.",
    descriptionKo:
      "보험료 산출에 쓰이는 통상함수 합계 NNX(납입현가)·BPV(보험금현가)를 집계합니다.",
  },
  {
    type: ModuleType.AdditionalName,
    name: "Additional Variables",
    nameKo: "추가 변수 정의 (Variables)",
    icon: TagIcon,
    description:
      "Defines custom variables or extracts specific values from the data table for use in premium calculations.",
    descriptionKo:
      "보험료 수식에 쓸 사용자 정의 변수를 만들거나 표에서 특정 값을 추출합니다(사업비율 등).",
  },
  {
    type: ModuleType.NetPremiumCalculator,
    name: "Net Premium Calculator",
    nameKo: "순보험료 계산 (Net Premium)",
    icon: CheckBadgeIcon,
    description:
      "Calculates the final net premium using a user-defined formula.",
    descriptionKo:
      "사용자가 정의한 수식으로 순보험료(PP)를 계산합니다. 예: [BPV] / [NNX(Year)].",
  },
  {
    type: ModuleType.GrossPremiumCalculator,
    name: "Gross Premium Calculator",
    nameKo: "영업보험료 계산 (Gross Premium)",
    icon: BanknotesIcon,
    description:
      "Calculates the gross premium (GP) based on Net Premium (PP) and loadings.",
    descriptionKo:
      "순보험료(PP)에 사업비(부가보험료)를 반영해 영업보험료(GP)를 계산합니다.",
  },
  {
    type: ModuleType.ReserveCalculator,
    name: "Reserve Calculator",
    nameKo: "준비금 계산 (Reserve)",
    icon: CalculatorIcon,
    description:
      "Calculates reserve values based on Gross Premium Calculator results and table data, with conditional formulas based on Payment Term.",
    descriptionKo:
      "영업보험료 결과와 표 데이터로 책임준비금을 계산합니다. 납입기간 기준 조건부 수식 지원.",
  },
  {
    type: ModuleType.ScenarioRunner,
    name: "Scenario Runner",
    nameKo: "시나리오 실행 (Scenario)",
    icon: QueueListIcon,
    description:
      "Runs the entire pipeline multiple times for different scenarios and aggregates the results.",
    descriptionKo:
      "여러 조건(나이·성별 등)으로 전체 파이프라인을 반복 실행하고 결과를 모읍니다.",
  },
  {
    type: ModuleType.PipelineExplainer,
    name: "Pipeline Explainer",
    nameKo: "산출 리포트 (Report)",
    icon: ClipboardDocumentListIcon,
    description:
      "Generates a detailed report of the entire calculation pipeline, including formulas and steps.",
    descriptionKo:
      "전체 산출 과정(수식·단계·중간값)을 정리한 상세 리포트를 만듭니다.",
  },
  {
    type: ModuleType.TextBox,
    name: "텍스트 상자",
    nameKo: "텍스트 상자",
    icon: TextBoxIcon,
    description: "캔버스에 텍스트를 입력할 수 있는 텍스트 상자를 추가합니다.",
    descriptionKo: "캔버스에 텍스트를 입력할 수 있는 텍스트 상자를 추가합니다.",
  },
  {
    type: ModuleType.GroupBox,
    name: "그룹 상자",
    nameKo: "그룹 상자",
    icon: GroupBoxIcon,
    description: "선택된 모듈들을 그룹으로 묶어 함께 이동할 수 있도록 합니다.",
    descriptionKo: "선택된 모듈들을 그룹으로 묶어 함께 이동할 수 있도록 합니다.",
  },
];

/**
 * 모듈의 한글 표시명을 반환한다(없으면 영문 name 폴백).
 * 영문 name(DSL/내부 식별자)은 변경하지 않으며, 이 함수는 UI 표시 전용이다.
 */
export const getModuleNameKo = (type: ModuleType): string => {
  const info = TOOLBOX_MODULES.find((m) => m.type === type);
  return info?.nameKo || info?.name || String(type);
};

/**
 * 모듈의 한글 설명을 반환한다(없으면 영문 description 폴백).
 */
export const getModuleDescriptionKo = (type: ModuleType): string => {
  const info = TOOLBOX_MODULES.find((m) => m.type === type);
  return info?.descriptionKo || info?.description || "";
};

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
          { name: "β'", value: 0 },
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
