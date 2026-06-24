// 모듈 입력 화면(ParameterInputModal) 최상단에 표시하는 초보자 친화 설명.
// 각 모듈이 "무엇을 하고 / 어떤 입력을 받아 / 어떤 출력을 내는지"를
// 계리·생명표 도메인 용어를 쉬운 비유와 함께 2~3문장으로 풀어 설명한다.
// (참고 톤: ML Auto Flow의 moduleDescriptions.ts — 일상어/비유 위주, 전문용어 최소화)

import { ModuleType } from "../types";

export interface ModuleHelp {
  /** 모달 상단 카드 제목 */
  title: string;
  /** 2~3문장 초보자 설명 (무엇을/입력/출력) */
  description: string;
}

export const MODULE_HELP: Partial<Record<ModuleType, ModuleHelp>> = {
  [ModuleType.LoadData]: {
    title: "데이터 불러오기 (Load Data)",
    description:
      "분석의 '출발점'입니다. CSV·엑셀 파일을 선택하면 행과 열로 된 표 형태로 앱에 들어옵니다. 입력은 파일, 출력은 이후 모든 계산이 이어받는 원본 데이터 표입니다. 파이프라인 맨 앞에 두고 가장 먼저 실행하세요.",
  },
  [ModuleType.SelectData]: {
    title: "열 선택 / 이름 변경 (Select Data)",
    description:
      "표에서 쓸 열만 골라내고, 필요하면 열 이름을 바꾸는 블록입니다. 예를 들어 사망위험률 열을 골라 'Death_Rate'라는 표준 이름으로 통일할 수 있습니다. 입력은 원본 표, 출력은 선택·정리된 표입니다.",
  },
  [ModuleType.SelectRiskRates]: {
    title: "위험률 선택 (Select Risk Rates)",
    description:
      "사망률·발생률 같은 '위험률(q)' 표를 골라 분석에 가져오는 블록입니다. 보험료·준비금 계산의 기초가 되는 확률값을 여기서 지정합니다. 입력은 위험률 데이터, 출력은 후속 계산에 쓸 위험률 표입니다.",
  },
  [ModuleType.DefinePolicyInfo]: {
    title: "계약 정보 정의 (Define Policy Info)",
    description:
      "보험 상품의 기본 조건(가입나이·보험기간·납입기간·이율 등)을 입력하는 블록입니다. 이 값들이 이후 모든 보험료·준비금 계산의 전제가 됩니다. 입력은 사용자가 정하는 계약 조건, 출력은 계약 정보 묶음입니다.",
  },
  [ModuleType.CalculateSurvivors]: {
    title: "생존자 수 계산 (Calculate Survivors)",
    description:
      "사망률(q)을 이용해 생명표의 핵심인 '생존자 수(lx)'와 '사망자 수(dx)'를 나이대별로 계산합니다. 처음 10만 명이 나이를 먹으며 몇 명이 살아남는지 따라가는 표를 만든다고 생각하면 됩니다. 입력은 나이·사망률 열, 출력은 lx·dx가 추가된 생명표입니다.",
  },
  [ModuleType.ClaimsCalculator]: {
    title: "보험금 현가 계산 (Claims Calculator)",
    description:
      "생존자/사망자 수와 위험률을 이용해 보험금 지급의 '현재가치 기초량(dx·Cx)'을 계산합니다. 미래에 지급할 보험금을 이자로 할인해 지금 가치로 환산하는 준비 단계입니다. 입력은 lx·위험률 열, 출력은 dx_·Cx_ 계산 열입니다.",
  },
  [ModuleType.NxMxCalculator]: {
    title: "정산기호 Nx·Mx 계산 (Nx / Mx Calculator)",
    description:
      "계리 계산을 빠르게 하기 위한 '누적 정산기호(Nx, Mx)'를 만듭니다. Dx·Cx 값을 나이 위에서부터 차곡차곡 더한 누적합으로, 보험료·연금 공식의 분자·분모에 바로 쓰입니다. 입력은 Dx·Cx 열, 출력은 Nx_·Mx_ 누적 열입니다.",
  },
  [ModuleType.PremiumComponent]: {
    title: "보험료 구성요소 (Premium Component)",
    description:
      "Nx·Mx 같은 정산기호를 조합해 보험료 공식의 '구성 요소(NNX 등)'를 미리 만들어 둡니다. 복잡한 보험료 식을 작은 부품으로 나눠 재사용하는 단계입니다. 입력은 Nx·Mx 열, 출력은 보험료 계산용 조합 값입니다.",
  },
  [ModuleType.NetPremiumCalculator]: {
    title: "순보험료 계산 (Net Premium)",
    description:
      "사업비를 빼고 위험과 적립만 반영한 '순보험료'를 계산합니다. 보험금 현가를 납입 기간 현가로 나눈 값이 1회 보험료가 됩니다. 입력은 정산기호·계약 정보, 출력은 순보험료 금액입니다.",
  },
  [ModuleType.GrossPremiumCalculator]: {
    title: "영업보험료 계산 (Gross Premium)",
    description:
      "순보험료에 사업비(부가보험료)를 더해 실제로 고객이 내는 '영업보험료'를 계산합니다. 입력은 순보험료와 사업비 가정, 출력은 최종 청구 보험료입니다.",
  },
  [ModuleType.ReserveCalculator]: {
    title: "책임준비금 계산 (Reserve Calculator)",
    description:
      "보험사가 미래의 보험금 지급에 대비해 적립해 두어야 할 '책임준비금'을 시점별로 계산합니다. 받은 보험료의 현가에서 지급할 보험금의 현가를 뺀 차이를 따라갑니다. 입력은 정산기호·보험료, 출력은 연도별 준비금 표입니다.",
  },
  [ModuleType.RateModifier]: {
    title: "위험률 조정 (Rate Modifier)",
    description:
      "기초 위험률에 할인·할증(예: 1.2배)이나 가산값을 적용해 조정하는 블록입니다. 흡연·우량체 등 위험도 차이를 반영할 때 씁니다. 입력은 원본 위험률, 출력은 조정된 위험률 표입니다.",
  },
  [ModuleType.ScenarioRunner]: {
    title: "시나리오 실행 (Scenario Runner)",
    description:
      "이율·위험률 등 가정을 바꿔가며 결과가 어떻게 달라지는지 여러 경우를 한 번에 비교하는 블록입니다. 'if 이율이 1% 낮아지면?' 같은 민감도 분석에 유용합니다. 입력은 파이프라인과 가정 조합, 출력은 시나리오별 결과 비교입니다.",
  },
};

/** 위 맵에 없는 모듈에 보여줄 일반 안내 */
export const DEFAULT_MODULE_HELP: ModuleHelp = {
  title: "모듈 설정",
  description:
    "이 블록의 입력 값을 설정하는 화면입니다. 위쪽 입력란을 채운 뒤 '실행'을 누르면 결과가 계산되어 다음 블록으로 전달됩니다. 각 입력란 옆 라벨과 기본값을 참고하세요.",
};
