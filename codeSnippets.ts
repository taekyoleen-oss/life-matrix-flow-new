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
      if (calculations.length === 0) {
        calcCode += `# No rate modifications defined.\n`;
      } else {
        calculations.forEach((calc: any) => {
          calcCode += `# Calculate ${calc.newColumnName}\n`;
          // Simple replacement of [Column] with df['Column'] for python-ish syntax
          let pyFormula = calc.formula
            ? calc.formula.replace(/\[([^\]]+)\]/g, "df['$1']")
            : "0";
          calcCode += `df['${calc.newColumnName}'] = ${pyFormula}\n`;
        });
      }
      return calcCode;

    case ModuleType.DefinePolicyInfo:
      return `# Define Policy Info
policy_info = {
    "entry_age": ${parameters.entryAge},
    "gender": "${parameters.gender}",
    "policy_term": ${parameters.policyTerm},
    "payment_term": ${parameters.paymentTerm},
    "interest_rate": ${
      parameters.interestRate ? parameters.interestRate / 100 : 0.0
    }
}
print(policy_info)`;

    case ModuleType.SelectRiskRates:
      return `# Select Risk Rates
# Filter based on policy info
entry_age = policy_info['entry_age']
gender = policy_info['gender']
term = policy_info['policy_term']

# Assuming 'df_rates' is the input dataframe
df_risk = df_rates[
    (df_rates['${parameters.genderColumn || "Gender"}'] == gender) & 
    (df_rates['${parameters.ageColumn || "Age"}'] >= entry_age) & 
    (df_rates['${parameters.ageColumn || "Age"}'] < entry_age + term)
].copy()

# Sort by age
df_risk = df_risk.sort_values(by='${
        parameters.ageColumn || "Age"
      }').reset_index(drop=True)

# Calculate discount factors
i = policy_info['interest_rate']
t = df_risk.index  # 0 to term-1
df_risk['i_prem'] = 1 / ((1 + i) ** t)
df_risk['i_claim'] = 1 / ((1 + i) ** (t + 0.5))

print(df_risk[['i_prem', 'i_claim']].head())`;

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
            surCode += `    # Combined decrement rates\n`;
            surCode += `    q_independent = [row['${decrements.join(
              "'], row['"
            )}']]\n`;
            surCode += `    p_independent = [(1 - q) for q in q_independent]\n`;
            surCode += `    p_total = 1\n`;
            surCode += `    for p in p_independent: p_total *= p\n`;
            surCode += `    q_total = 1 - p_total\n`;
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

    case ModuleType.ClaimsCalculator:
      const claimCalcs = parameters.calculations || [];
      let claimCode = `# Calculate Claims (dx) and Commutation (Cx)\n`;
      claimCalcs.forEach((c: any) => {
        const name = c.name || c.riskRateColumn || "Calc";
        claimCode += `\n# Calculation for ${name}\n`;
        if (c.lxColumn && c.riskRateColumn) {
          claimCode += `df['dx_${name}'] = df['${c.lxColumn}'] * df['${c.riskRateColumn}']\n`;
          claimCode += `df['Cx_${name}'] = df['dx_${name}'] * df['i_claim']\n`;
        } else {
          claimCode += `# Missing configuration for ${name}\n`;
        }
      });
      return claimCode;

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
          commutCode += `\n# Mx for ${c.name}\n`;
          commutCode += `# Adjust Cx based on deductible (${c.deductibleType}) and payment schedule\n`;
          commutCode += `df['adjusted_Cx'] = df['${c.baseColumn}'] # Simplified placeholder\n`;
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
      premCompCode += `\n# Ensure indices exist\n`;

      nnxCalcs.forEach((c: any) => {
        if (c.nxColumn) {
          premCompCode += `Nx_start = df.iloc[0]['${c.nxColumn}']\n`;
          premCompCode += `Nx_end = df.iloc[payment_term]['${c.nxColumn}'] if payment_term < len(df) else 0\n`;
          premCompCode += `NNX_${c.nxColumn.replace(
            "Nx_",
            ""
          )} = Nx_start - Nx_end\n`;
        }
      });

      sumxCalcs.forEach((c: any) => {
        if (c.mxColumn) {
          premCompCode += `Mx_start = df.iloc[0]['${c.mxColumn}']\n`;
          premCompCode += `Mx_end = df.iloc[policy_term]['${c.mxColumn}'] if policy_term < len(df) else 0\n`;
          premCompCode += `BPV_${c.mxColumn.replace("Mx_", "")} = ${
            c.amount || 0
          } * (Mx_start - Mx_end)\n`;
        }
      });
      return premCompCode;

    case ModuleType.NetPremiumCalculator:
      return `# Net Premium Calculator
formula = "${parameters.formula || ""}"
# Replace [Tokens] with variable values
# Example: [BPV] / [NNX_Mortality]
# net_premium = eval(processed_formula, {}, context)
print(f"Formula: {formula}")
# print(f"Net Premium: {net_premium}")`;

    case ModuleType.ReserveCalculator:
      const reserveColName = parameters.reserveColumnName || "Reserve";
      const formula1 = parameters.formulaForPaymentTermOrLess || "";
      const formula2 = parameters.formulaForGreaterThanPaymentTerm || "";
      let reserveCode = `# Reserve Calculator\n`;
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
