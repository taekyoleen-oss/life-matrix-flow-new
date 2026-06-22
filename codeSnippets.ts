import { CanvasModule, ModuleType } from "./types";

const replacePlaceholders = (
  template: string,
  params: Record<string, any>
): string => {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return params[key] !== undefined ? String(params[key]) : `{{${key}}}`;
  });
};

export const getModuleCode = (module: CanvasModule): string => {
  const { type, parameters } = module;

  switch (type) {
    case ModuleType.LoadData:
      // URL 소스인 경우에만 원격 로드 의사코드를 추가로 표기(파일 소스는 변경 없음).
      if (parameters.sourceUrl) {
        return `# Load Data (from URL)
import pandas as pd

# Remote data source (e.g. standard life table / rate table)
url = "${parameters.sourceUrl}"
df = pd.read_csv(url)
# print(df.head())`;
      }
      return `# Load Data
import pandas as pd
import io

def load_data(source_name):
    # In the real application, file content is handled in browser memory
    print(f"Loading data from {source_name}")
    # df = pd.read_csv(source_name)
    # return df

# Simulation
source = "${parameters.source || "filename.csv"}"
df = load_data(source)
# print(df.head())`;

    case ModuleType.SelectData:
      const selections = parameters.selections || [];
      const selectedCols = selections
        .filter((s: any) => s.selected)
        .map((s: any) => `'${s.originalName}'`)
        .join(", ");
      const renameDict = selections
        .filter((s: any) => s.selected && s.originalName !== s.newName)
        .map((s: any) => `'${s.originalName}': '${s.newName}'`)
        .join(", ");

      return `# Select Data
# Filter columns
selected_columns = [${selectedCols}]
df = df[selected_columns]

# Rename columns
if ${renameDict.length > 0 ? "True" : "False"}:
    rename_mapping = {${renameDict}}
    df = df.rename(columns=rename_mapping)

print(df.head())`;

    case ModuleType.RateModifier:
      const calculations = parameters.calculations || [];
      let calcCode = `# Rate Modifier\n`;
      // D-10: 엔진 실제 동작 반영
      //  - [PaymentTerm]/[m] → payment_term, [PolicyTerm]/[n] → policy_term (스칼라 치환)
      //  - IF(cond, a, b) 구문 지원 (processIfStatements)
      //  - 결과는 소수 5자리 반올림(roundTo5)
      calcCode += `m = int(policy_info['payment_term'])  # [m], [PaymentTerm]\n`;
      calcCode += `n = int(policy_info['policy_term'])   # [n], [PolicyTerm]\n`;
      if (calculations.length === 0) {
        calcCode += `# No rate modifications defined.\n`;
      } else {
        calculations.forEach((calc: any) => {
          calcCode += `\n# Calculate ${calc.newColumnName}\n`;
          // [Column] → row['Column'], [m]/[n] → 스칼라. IF()는 파이썬 표현으로 주석 안내.
          let pyFormula = calc.formula
            ? calc.formula
                .replace(/\[PaymentTerm\]|\[m\]/g, "m")
                .replace(/\[PolicyTerm\]|\[n\]/g, "n")
                .replace(/\[([^\]]+)\]/g, "row['$1']")
            : "0";
          const hasIf = /IF\s*\(/i.test(calc.formula || "");
          if (hasIf) {
            calcCode += `# 주: IF(cond, a, b) 는 엔진에서 (a if cond else b) 로 처리됩니다.\n`;
          }
          calcCode += `df['${calc.newColumnName}'] = [round(${pyFormula}, 5) for _, row in df.iterrows()]\n`;
        });
      }
      return calcCode;

    case ModuleType.DefinePolicyInfo:
      return `# Define Policy Info
# D-3: 엔진은 maturityAge 가 있으면 policy_term = maturityAge - entry_age 로 우선 계산한다.
#      (maturityAge 미지정/0 이면 policyTerm 값을 그대로 사용; policyTerm 도 비면 0=종신)
entry_age = ${parameters.entryAge}
maturity_age = ${parameters.maturityAge ?? 0}
policy_term_param = ${
        parameters.policyTerm === "" ||
        parameters.policyTerm === null ||
        parameters.policyTerm === undefined
          ? 0
          : parameters.policyTerm
      }
if maturity_age and maturity_age > 0 and (maturity_age - entry_age) > 0:
    policy_term = maturity_age - entry_age
else:
    policy_term = policy_term_param  # 0 이면 종신(whole life)

policy_info = {
    "entry_age": entry_age,
    "gender": "${parameters.gender}",
    "policy_term": policy_term,
    "payment_term": ${parameters.paymentTerm},
    "interest_rate": ${
      parameters.interestRate ? parameters.interestRate / 100 : 0.0
    }
}
print(policy_info)`;

    case ModuleType.SelectRiskRates: {
      const ageCol = parameters.ageColumn || "Age";
      const genderCol = parameters.genderColumn || "Gender";
      const excludeNonNumeric = parameters.excludeNonNumericRows !== false;
      const renames: Array<{ from: string; to: string }> =
        parameters.columnRenames ?? [];
      return `# Select Risk Rates (Rating Basis Builder)
entry_age = policy_info['entry_age']
gender = policy_info['gender']
term = policy_info['policy_term']

df_risk = df_rates.copy()
${
  excludeNonNumeric
    ? `# D-4: 비숫자 행 제외 (Age/Gender 열 제외하고, 숫자열에 비숫자 값이 있는 행 drop)
numeric_cols = [c for c in df_risk.columns if c not in ['${ageCol}', '${genderCol}'] and pd.api.types.is_numeric_dtype(df_risk[c])]
df_risk = df_risk[~df_risk[numeric_cols].apply(lambda r: r.map(lambda v: pd.notna(v) and not _is_number(v)).any(), axis=1)]`
    : `# (비숫자 행 제외 비활성)`
}

# D-4: policy_term 이 0/미지정이면 데이터의 최대 연령으로 자동 산출
if term <= 0:
    matching = df_risk[(df_risk['${genderCol}'] == gender) & (df_risk['${ageCol}'] >= entry_age)]
    max_age = matching['${ageCol}'].max()
    term = int(max_age - entry_age + 1)  # 행 개수 기준

df_risk = df_risk[
    (df_risk['${genderCol}'] == gender) &
    (df_risk['${ageCol}'] >= entry_age) &
    (df_risk['${ageCol}'] < entry_age + term)
].copy()

# Sort by age
df_risk = df_risk.sort_values(by='${ageCol}').reset_index(drop=True)
${
  renames.length > 0
    ? `# D-4: 사용자 지정 열 이름 변경(columnRenames)\ndf_risk = df_risk.rename(columns=${JSON.stringify(
        Object.fromEntries(renames.map((r) => [r.from, r.to]))
      )})\n`
    : ""
}# Age/Gender 표준 열 이름으로 자동 변경 (엔진 동작)
df_risk = df_risk.rename(columns={'${ageCol}': 'Age', '${genderCol}': 'Gender'})

# Calculate discount factors (t = 0..term-1)
i = policy_info['interest_rate']
t = df_risk.index
df_risk['i_prem'] = 1 / ((1 + i) ** t)         # v^t
df_risk['i_claim'] = 1 / ((1 + i) ** (t + 0.5)) # v^(t+0.5), 중앙지급

print(df_risk[['i_prem', 'i_claim']].head())`;
    }

    case ModuleType.CalculateSurvivors:
      const surCalcs = parameters.calculations || [];
      let surCode = `# Calculate Survivors (lx) and Dx\n`;
      surCode += `initial_lx = 100000\n\n`;

      surCalcs.forEach((c: any) => {
        const lxColName = c.name ? `lx_${c.name}` : 'lx';
        const dxColName = c.name ? `Dx_${c.name}` : 'Dx';

        // ── 고정값 lx
        if (c.fixedValue !== undefined) {
          surCode += `# Fixed lx column: ${lxColName} = ${c.fixedValue}\n`;
          surCode += `df['${lxColName}'] = ${c.fixedValue}\n`;
          surCode += `df['${dxColName}'] = df['${lxColName}'] * df['i_prem']\n\n`;
          return;
        }

        // ── 감소율 lx
        surCode += `# Calculation: ${c.name}\n`;
        surCode += `current_lx = initial_lx\n`;
        surCode += `lx_values = []\n`;

        surCode += `for index, row in df.iterrows():\n`;
        surCode += `    lx_values.append(current_lx)\n`;
        const decrements = c.decrementRates || [];
        if (decrements.length > 0) {
          if (decrements.length === 1) {
            surCode += `    q = row['${decrements[0]}']\n`;
            surCode += `    deaths = current_lx * q\n`;
          } else {
            // 다중탈퇴 결합식(D-1): 항목별 decrementMethod 선택.
            //   - 'independent' (독립곱): 1 - ∏(1 - qi) = qm + q_others - qm*q_others
            //   - 'udd' (기본/미지정): UDD 1/2 보정 = qm + q_others - qm*q_others/2  (엔진 기본 동작)
            // ※ 엔진(executePipeline)은 mortalityCol(qm) 과 나머지 위험률(q_others) 을 분리해 적용한다.
            const dMethod = c.decrementMethod === 'independent' ? 'independent' : 'udd';
            surCode += `    # Combined decrement rates (method=${dMethod})\n`;
            surCode += `    qm = row['${decrements[0]}']  # mortality decrement\n`;
            const others = decrements.slice(1);
            surCode += `    q_others = 1 - ${others
              .map((r: string) => `(1 - row['${r}'])`)
              .join(' * ')}\n`;
            if (dMethod === 'independent') {
              surCode += `    # 독립곱: 1 - ∏(1 - qi)\n`;
              surCode += `    q_total = qm + q_others - qm * q_others\n`;
            } else {
              surCode += `    # UDD 1/2 보정 (엔진 기본): 동시탈퇴 균등분포 가정\n`;
              surCode += `    q_total = qm + q_others - qm * q_others / 2.0\n`;
            }
            surCode += `    deaths = current_lx * q_total\n`;
          }
        } else {
          surCode += `    deaths = 0\n`;
        }
        surCode += `    current_lx -= deaths\n`;

        surCode += `df['${lxColName}'] = lx_values\n`;
        surCode += `df['${dxColName}'] = df['${lxColName}'] * df['i_prem']\n\n`;
      });
      return surCode;

    case ModuleType.ClaimsCalculator: {
      const claimCalcs = parameters.calculations || [];
      let claimCode = `# Calculate Claims (dx) and Commutation (Cx)\n`;
      // D-5: 엔진은 컬럼명이 이미 존재하면 _1, _2 ... suffix 를 붙여 중복을 피한다(getSafeName).
      claimCode += `# D-5: 동일 dx_/Cx_ 이름이 이미 있으면 _1, _2 ... 가 자동으로 붙습니다.\n`;
      const used = new Set<string>();
      const safe = (base: string) => {
        let n = base;
        let i = 1;
        while (used.has(n)) {
          n = `${base}_${i}`;
          i++;
        }
        used.add(n);
        return n;
      };
      claimCalcs.forEach((c: any) => {
        const name = c.name || c.riskRateColumn || "Calc";
        claimCode += `\n# Calculation for ${name}\n`;
        if (c.lxColumn && c.riskRateColumn) {
          const dxName = safe(`dx_${name}`);
          const cxName = safe(`Cx_${name}`);
          claimCode += `df['${dxName}'] = df['${c.lxColumn}'] * df['${c.riskRateColumn}']\n`;
          claimCode += `df['${cxName}'] = df['${dxName}'] * df['i_claim']\n`;
        } else {
          claimCode += `# Missing configuration for ${name}\n`;
        }
      });
      return claimCode;
    }

    case ModuleType.NxMxCalculator:
      const nxCalcs = parameters.nxCalculations || [];
      const mxCalcs = parameters.mxCalculations || [];
      let commutCode = `# Calculate Nx and Mx (Commutation Functions)\n`;

      nxCalcs.forEach((c: any) => {
        if (c.baseColumn) {
          commutCode += `\n# Nx for ${c.name}\n`;
          commutCode += `# Reverse cumsum (sum from age x to end)\n`;
          commutCode += `df['Nx_${c.name}'] = df['${c.baseColumn}'][::-1].cumsum()[::-1]\n`;
        }
      });

      mxCalcs.forEach((c: any) => {
        if (c.baseColumn) {
          // D-2: 엔진은 adjusted_Cx 를 (1) index0 에만 면책 factor, (2) 모든 행에 연도별 지급비율 곱.
          //   - 면책(deductibleType): '0.25'→×0.75, '0.5'→×0.5, 'custom'→×(1-customDeductible)  ※ index0(첫해)에만
          //   - paymentRatios[year=index+1]: type '100%'/'50%' 등은 ×(pct/100), 'Custom' 은 ×(customValue/100)
          const deductFactor =
            c.deductibleType === "0.25"
              ? "0.75"
              : c.deductibleType === "0.5"
              ? "0.5"
              : c.deductibleType === "custom"
              ? `(1 - ${Number(c.customDeductible) || 0})`
              : "1.0";
          const ratios = Array.isArray(c.paymentRatios) ? c.paymentRatios : [];
          commutCode += `\n# Mx for ${c.name}\n`;
          commutCode += `# 면책(${c.deductibleType ?? "0"}): 첫해(index 0) factor=${deductFactor}\n`;
          commutCode += `payment_ratios = ${JSON.stringify(
            ratios.map((r: any) => ({
              year: r.year,
              pct: r.type === "Custom" ? Number(r.customValue) || 0 : parseFloat(r.type) || 100,
            }))
          )}  # year별 지급비율(%)\n`;
          commutCode += `def adj_cx(i, cx):\n`;
          commutCode += `    factor = 1.0\n`;
          commutCode += `    if i == 0: factor *= ${deductFactor}  # 첫해 면책\n`;
          commutCode += `    for r in payment_ratios:\n`;
          commutCode += `        if r['year'] == i + 1: factor *= r['pct'] / 100\n`;
          commutCode += `    return cx * factor\n`;
          commutCode += `df['adjusted_Cx'] = [adj_cx(i, v) for i, v in enumerate(df['${c.baseColumn}'])]\n`;
          commutCode += `df['Mx_${c.name}'] = df['adjusted_Cx'][::-1].cumsum()[::-1]\n`;
        }
      });
      return commutCode;

    case ModuleType.PremiumComponent:
      const nnxCalcs = parameters.nnxCalculations || [];
      const sumxCalcs = parameters.sumxCalculations || [];
      let premCompCode = `# Premium Components\n`;
      premCompCode += `payment_term = int(policy_info['payment_term'])\n`;
      premCompCode += `policy_term = int(policy_info['policy_term'])\n`;
      // D-6: 종신(policy_term == 0)은 마지막 행(만기)을 종단으로 사용.
      premCompCode += `# 종신(policy_term==0)이면 마지막 행을 만기 인덱스로 사용\n`;
      premCompCode += `policy_term_idx = policy_term if policy_term > 0 else (len(df) - 1)\n`;
      premCompCode += `\n# Ensure indices exist\n`;

      nnxCalcs.forEach((c: any) => {
        if (c.nxColumn) {
          const base = c.nxColumn.replace("Nx_", "");
          premCompCode += `Nx_start = df.iloc[0]['${c.nxColumn}']\n`;
          premCompCode += `Nx_end = df.iloc[payment_term]['${c.nxColumn}'] if payment_term < len(df) else 0\n`;
          // NNX(Year). dxColumn 이 있으면 Half/Quarter/Month 보정 가능(엔진 동일 식).
          premCompCode += `NNX_${base}_Year = Nx_start - Nx_end\n`;
          if (c.dxColumn) {
            premCompCode += `Dx_start = df.iloc[0]['${c.dxColumn}']\n`;
            premCompCode += `Dx_end = df.iloc[payment_term]['${c.dxColumn}'] if payment_term < len(df) else 0\n`;
            premCompCode += `dx_diff = Dx_start - Dx_end\n`;
            premCompCode += `NNX_${base}_Half    = NNX_${base}_Year - (1/4)  * dx_diff\n`;
            premCompCode += `NNX_${base}_Quarter = NNX_${base}_Year - (3/8)  * dx_diff\n`;
            premCompCode += `NNX_${base}_Month   = NNX_${base}_Year - (11/24)* dx_diff\n`;
          }
        }
      });

      sumxCalcs.forEach((c: any) => {
        if (c.mxColumn) {
          const base = c.mxColumn.replace("Mx_", "");
          // D-6: 경계 초과 시 마지막 행(fallback)을 사용.
          premCompCode += `Mx_start = df.iloc[0]['${c.mxColumn}']\n`;
          premCompCode += `Mx_end = df.iloc[policy_term_idx]['${c.mxColumn}'] if policy_term_idx < len(df) else df.iloc[-1]['${c.mxColumn}']\n`;
          // scalar BPV = (Mx[0] - Mx[종단]) × 보험가입금액
          premCompCode += `BPV_${base} = ${c.amount || 0} * (Mx_start - Mx_end)\n`;
        }
      });

      // D-7: 표(table) 컬럼 BPV_Col 은 scalar BPV 와 의미가 다르다.
      //   - scalar BPV_X = (Mx_X[0] - Mx_X[종단]) × 금액   (위 식: 구간차)
      //   - 표 컬럼 BPV_Col[row] = Σ_calc ( Mx_calc[row] × 금액_calc )   (각 행의 Mx 가중합)
      // 즉 BPV_Col 은 "각 행 시점의 Mx 합계"이고 scalar BPV 는 "0~종단 구간 감소분"이다(서로 다른 값).
      premCompCode += `\n# D-7: 표 컬럼 BPV_Col (행별 Mx 가중합) — scalar BPV(구간차)와 다른 값\n`;
      premCompCode += `df['BPV_Col'] = 0\n`;
      sumxCalcs.forEach((c: any) => {
        if (c.mxColumn) {
          premCompCode += `df['BPV_Col'] += df['${c.mxColumn}'] * ${c.amount || 0}\n`;
        }
      });
      return premCompCode;

    case ModuleType.NetPremiumCalculator: {
      const varName = parameters.variableName || "PP";
      const rawFormula =
        parameters.formula || "[BPV_Mortality] / [NNX_Mortality(Year)]";
      // [Token] → 변수 컨텍스트 조회. 엔진은 PremiumComponent 의 nnxResults/bpvResults 를 ctx 로 사용.
      const pyFormula = rawFormula.replace(/\[([^\]]+)\]/g, "ctx['$1']");
      return `# Net Premium Calculator (순보험료, 수지상등)
# ctx: PremiumComponent 결과 — NNX_X(Year/Half/Quarter/Month), BPV_X 등
# D-8: 다른 수식 모듈처럼 IF(조건, 참값, 거짓값) 조건식 사용 가능 (→ 삼항으로 변환되어 평가)
formula = "${rawFormula.replace(/"/g, '\\"')}"
${varName} = ${pyFormula}  # 급부현가(BPV) ÷ 보험료현가(NNX), roundTo5
print(f"${varName} = {round(${varName}, 5)}")`;
    }

    case ModuleType.ReserveCalculator:
      const reserveColName = parameters.reserveColumnName || "Reserve";
      const formula1 = parameters.formulaForPaymentTermOrLess || "";
      const formula2 = parameters.formulaForGreaterThanPaymentTerm || "";
      let reserveCode = `# Reserve Calculator\n`;
      // D-9 (Round C 단일화 완료): 엔진과 표시코드가 동일 문법을 지원한다.
      //  - 단독 [컬럼명] → 그 행(현재 행)의 값, 단독 [m]/[n]/[PaymentTerm]/[PolicyTerm] → 스칼라.
      //  - 행참조 [col][t]/[col][0]/[col][m]/[col][n] (또는 col[t] 표기) 지원:
      //      [t]=현재 행(idx), [0]=첫 행, [m]=납입종료행(payment_term-1), [n]=마지막 데이터행(len-1).
      //  - 엔진(App.tsx ReserveCalculator)이 동일 인덱스 규칙으로 숫자 치환하므로 표시=실행 일치.
      reserveCode += `reserve_col = "${reserveColName}"\n`;
      reserveCode += `payment_term = int(policy_info['payment_term'])\n`;
      reserveCode += `n_idx = len(df) - 1  # 마지막 행 인덱스\n`;
      reserveCode += `m_idx = payment_term - 1  # 납입기간 마지막 행\n\n`;

      // ColName[t] → df.at[idx, 'ColName'] 등으로 변환
      // 구형 [ColName][t] 도 함께 처리
      const convertReserveFormula = (f: string) =>
        f
          // 구형: [ColName][idx] → ColName[idx] (먼저 외부 브래킷 제거)
          .replace(/\[([A-Za-z_][A-Za-z0-9_]*)\]\[/g, '$1[')
          // 구형: 나머지 [ColName] → ColName
          .replace(/(?<![}\])\w])\[([A-Za-z_][A-Za-z0-9_]*)\]/g, '$1')
          // ColName[t] → df.at[idx, 'ColName']
          .replace(/(\w+)\[t\]/g, "df.at[idx, '$1']")
          // ColName[n] → df.at[n_idx, 'ColName']
          .replace(/(\w+)\[n\]/g, "df.at[n_idx, '$1']")
          // ColName[m] → df.at[m_idx, 'ColName']
          .replace(/(\w+)\[m\]/g, "df.at[m_idx, '$1']")
          // ColName[0] → df['ColName'].iloc[0]
          .replace(/(\w+)\[0\]/g, "df['$1'].iloc[0]");

      if (formula1) {
        const pyFormula1 = convertReserveFormula(formula1);
        reserveCode += `# 납입 중 준비금 (t <= m)\n`;
        reserveCode += `formula1 = "${formula1}"\n`;
        reserveCode += `for idx in range(min(payment_term, len(df))):\n`;
        reserveCode += `    df.loc[idx, reserve_col] = ${pyFormula1}\n\n`;
      }

      if (formula2) {
        const pyFormula2 = convertReserveFormula(formula2);
        reserveCode += `# 납입 후 준비금 (t > m)\n`;
        reserveCode += `formula2 = "${formula2}"\n`;
        reserveCode += `for idx in range(payment_term, len(df)):\n`;
        reserveCode += `    df.loc[idx, reserve_col] = ${pyFormula2}\n`;
      }

      return reserveCode;

    case ModuleType.ScenarioRunner:
      const scenarios = parameters.scenarios || [];
      return `# Scenario Runner
scenarios = ${JSON.stringify(scenarios, null, 2)}

results = []
# Iterate through scenario combinations (Cartesian product)
# For each combination:
#   1. Update parameters
#   2. Run pipeline
#   3. Collect NetPremium
#   4. Append to results

import pandas as pd
# df_results = pd.DataFrame(results)
# print(df_results)`;

    case ModuleType.AdditionalName: {
      // C-1: 표시코드 누락 보완. 엔진 App.tsx:4116-4161 반영.
      const basicValues = parameters.basicValues || [];
      const definitions = parameters.definitions || [];
      let addCode = `# Additional Variables (사업비 계수 등)\n`;
      addCode += `variables = {}\n\n`;
      addCode += `# 1) 기본 계수 (basicValues): α1/α2(신계약비), β1/β2(유지비), γ(수금비)\n`;
      if (basicValues.length === 0) {
        addCode += `# (정의된 기본 계수 없음)\n`;
      } else {
        basicValues.forEach((bv: any) => {
          if (bv.name) addCode += `variables['${bv.name}'] = ${Number(bv.value) || 0}\n`;
        });
      }
      if (definitions.length > 0) {
        addCode += `\n# 2) 사용자 정의 변수 (definitions)\n`;
        definitions.forEach((def: any) => {
          if (!def.name) return;
          if (def.type === "static") {
            addCode += `variables['${def.name}'] = ${Number(def.staticValue) || 0}  # static\n`;
          } else if (def.type === "lookup") {
            // rowType → 행 인덱스 (entryAge=0, policyTerm=n, paymentTerm=m, custom/entryAgePlus=값)
            const rowExpr =
              def.rowType === "entryAge"
                ? "0"
                : def.rowType === "policyTerm"
                ? "policy_info['policy_term']"
                : def.rowType === "paymentTerm"
                ? "policy_info['payment_term']"
                : `${Number(def.customValue) || 0}`;
            addCode += `# lookup: ${def.column} 열의 행 인덱스 ${def.rowType}\n`;
            addCode += `_idx = min(max(int(${rowExpr}), 0), len(df) - 1)\n`;
            addCode += `variables['${def.name}'] = df.iloc[_idx]['${def.column}']\n`;
          }
        });
      }
      addCode += `\nprint(variables)`;
      return addCode;
    }

    case ModuleType.GrossPremiumCalculator: {
      // C-1: 표시코드 누락 보완. 영업보험료 GP = 순보험료 PP ÷ (1 - 사업비율)
      const varName = parameters.variableName || "GP";
      const rawFormula = parameters.formula || "PP / (1 - α1 - α2)";
      // [Token] → 변수 컨텍스트 조회. (엔진은 변수 치환 후 수식 평가)
      const pyFormula = rawFormula.replace(/\[([^\]]+)\]/g, "ctx['$1']");
      return `# Gross Premium Calculator (영업보험료)
# 변수 컨텍스트(ctx): NetPremium(PP), AdditionalName 계수(α1, α2, β1, β2, γ) 등
formula = "${rawFormula.replace(/"/g, '\\"')}"
${varName} = ${pyFormula}  # 결과는 소수 5자리 반올림(roundTo5)
print(f"${varName} = {round(${varName}, 5)}")`;
    }

    case ModuleType.PipelineExplainer:
      return `# Pipeline Explainer
# This module inspects the metadata of the connected graph
# and generates a structured report of the data flow and calculations.
print("Generates report...")`;

    default:
      return `# Code generation for ${type} is not yet implemented.
# Parameters:
# ${JSON.stringify(parameters, null, 2).split("\n").join("\n# ")}`;
  }
};
