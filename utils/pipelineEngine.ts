// ─────────────────────────────────────────────────────────────────────────────
// pipelineEngine.ts — 보험료/준비금 계산 코어 (App.tsx executePipeline 에서 추출)
//
// 이 모듈은 App.tsx 의 React 컴포넌트 안에 있던 executePipeline 및 그 보조 함수
// (roundTo5/roundTo8/getTopologicalSort/validateFormulaExpression/processIfStatements)
// 를 **동작 변경 없이 그대로** 옮긴 것이다. App.tsx 는 이 모듈을 import 하여
// 동일하게 호출(call-through)하므로 기존 실행 동작은 보존된다.
//
// 추출 목적: 계산 코어를 React/DOM 없이 headless 로 호출 가능하게 하여
// 재현성(verify) 하네스가 동일 입력에 대해 2회 실행 후 출력 동일성을 단언할 수 있게 한다.
// (Phase 6 — TS 재현성 verify 하네스)
// ─────────────────────────────────────────────────────────────────────────────

import {
  CanvasModule,
  ModuleType,
  Connection,
  ModuleStatus,
  ModuleOutput,
  DataPreview,
  NetPremiumOutput,
  PolicyInfoOutput,
  PipelineReportStep,
  AdditionalVariablesOutput,
  GrossPremiumOutput,
} from "../types";
import { DEFAULT_MODULES } from "../constants";

export const roundTo5 = (num: number): number => {
  return Number(num.toFixed(5));
};

export const roundTo8 = (num: number): number => {
  return Number(num.toFixed(8));
};

export const getTopologicalSort = (
  nodes: CanvasModule[],
  edges: Connection[]
): string[] => {
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
};

export const validateFormulaExpression = (expression: string): void => {
  if (/[^0-9+\-*/%.()\s<>!=?:&|eE]/.test(expression)) {
    throw new Error(
      `수식에 허용되지 않은 문자가 포함되어 있습니다. 미해결 변수가 있거나 허용되지 않는 함수가 포함된 경우 해당 오류가 발생합니다: ${expression}`
    );
  }
};

export const processIfStatements = (expression: string): string => {
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

export const executePipelineCore = 
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
                // 다중탈퇴 결합식 선택 (D-1):
                //  - 'independent' (독립곱): 1 - ∏(1 - qi) = qm + q_others - qm*q_others
                //  - 'udd' (기본/미지정): UDD 1/2 보정 = qm + q_others - qm*q_others/2  (기존 동작)
                // D-1 확정: 새 항목 기본값은 독립곱(UI에서 'independent' 명시). 엔진 fallback은 'udd'로
                // 유지하여, decrementMethod 필드가 없는 레거시 데이터의 산출 결과가 불변임을 보장한다.
                const decrementMethod = calc.decrementMethod ?? "udd";
                const totalDecrementFactor =
                  decrementMethod === "independent"
                    ? mortalityRate + q_others - mortalityRate * q_others
                    : mortalityRate + q_others - (mortalityRate * q_others) / 2.0;
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
              // QA-OBS-1: dxColumn 미지정 시 과거에는 Half/Quarter/Month=NaN 으로 두어
              // 이 토큰이 보험료(NetPremium) 수식에 쓰이면 PP=NaN 으로 조용히 전파되었다.
              // 분할납 보정항 (k * dx_diff) 의 dx_diff 가 미가용(=0)인 것과 동일하게 취급하여
              // Year 값(=보정 없음)으로 폴백한다. NaN 전파를 차단하면서 수식 평가가 가능해진다.
              // (dxColumn 지정 시 결과는 위 분기로 처리되어 불변)
              nnxResults[`NNX_${baseName}(Half)`] = roundTo5(nnxYear);
              nnxResults[`NNX_${baseName}(Quarter)`] = roundTo5(nnxYear);
              nnxResults[`NNX_${baseName}(Month)`] = roundTo5(nnxYear);
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
                  // QA-OBS-1 일관성: dxColumn 미지정 시 표 컬럼도 NaN 대신 Year 값으로 폴백
                  // (분할납 보정항 dx_diff=0 과 동일). 표시 NaN 노이즈 제거.
                  newRow[`NNX_${baseName}(Half)_Col`] = roundTo5(nnxYear);
                  newRow[`NNX_${baseName}(Quarter)_Col`] = roundTo5(nnxYear);
                  newRow[`NNX_${baseName}(Month)_Col`] = roundTo5(nnxYear);
                }
              }
            }

            // D-7 주의: BPV_Col(표 컬럼) = 현재 행의 Σ(Mx[행] × benefitAmount).
            //   보험료에 쓰이는 scalar BPV( (Mx[0]-Mx[종단])×amount, 구간차, line ~3787 )와
            //   정의가 다르므로 두 값을 직접 비교하면 안 된다. (계리 의도 미확정 → 수식 미변경)
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
              // D-7: 이 표 컬럼은 각 행에서 Σ(Mx[해당행] × benefitAmount) 누적값이며,
              // 보험료 산출에 쓰이는 scalar BPV( (Mx[0]-Mx[종단]) × amount, 구간차 )와는 정의가 다르다.
              // 두 값을 직접 비교하지 말 것.
              description:
                "보험금 현가(행별 참고용)\n" +
                "공식: BPV_Col[행] = Σ(Mx[행] × 보험금)\n" +
                "⚠ 보험료에 쓰이는 BPV(scalar)와 다릅니다.\n" +
                "scalar BPV = (Mx[0] − Mx[종단]) × 보험금 (구간차)\n" +
                "이 열은 각 행 누적값이라 scalar BPV와 직접 비교하지 마세요.",
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

          // D-8: NetPremium 도 다른 수식 모듈(RateModifier/Gross/Reserve)과 동일하게 IF() 지원.
          // IF(cond, a, b) → (cond ? a : b) 변환. IF 가 없는 수식은 입력 그대로 반환되어 결과 불변.
          expression = processIfStatements(expression);

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
            throw new Error("준비금 수식을 1개 이상 입력하세요. (납입기간 이하/초과 중 최소 하나)");
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

            // D-9: 행참조 문법 [col][t|m|n|0] 지원 (표시코드 codeSnippets.ts 와 단일화).
            //   [col][t] → 현재 행, [col][0] → 첫 행, [col][m] → 납입종료행(payment_term-1),
            //   [col][n] → 마지막 데이터행(len-1).
            //   엔진의 기존 동작(단독 [col]=현재행, 단독 [m]/[n]=스칼라)과 충돌하지 않도록
            //   *행참조(인덱스 접미)* 를 먼저 숫자값으로 치환한다.
            //   레거시 [col][idx] 와 신형 col[idx] 두 표기를 모두 처리.
            const resolveRowRef = (
              colName: string,
              idxToken: string
            ): string => {
              let targetIdx: number;
              if (idxToken === "t") targetIdx = rowIndex;
              else if (idxToken === "0") targetIdx = 0;
              else if (idxToken === "m") targetIdx = paymentTerm - 1;
              else if (idxToken === "n") targetIdx = outputRows.length - 1;
              else return "0";
              if (targetIdx < 0 || targetIdx >= outputRows.length) return "0";
              const v = outputRows[targetIdx]?.[colName];
              return String(v ?? 0);
            };
            // 레거시: [Col][t|m|n|0]
            evalFormula = evalFormula.replace(
              /\[([A-Za-z_][A-Za-z0-9_]*)\]\[(t|m|n|0)\]/g,
              (_m, col, idx) => resolveRowRef(col, idx)
            );
            // 신형: Col[t|m|n|0]
            evalFormula = evalFormula.replace(
              /([A-Za-z_][A-Za-z0-9_]*)\[(t|m|n|0)\]/g,
              (_m, col, idx) => resolveRowRef(col, idx)
            );

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
        } else if (
          module.type === ModuleType.TextBox ||
          module.type === ModuleType.GroupBox ||
          module.type === ModuleType.ScenarioRunner
        ) {
          // C-2: 비계산(annotation/container) 모듈 + ScenarioRunner(별도 runScenarioRunner 경유)는
          // executePipeline 에서 의도적 no-op. status=Success 유지하되 출력은 없음(undefined)이 의도된 동작.
          // 이렇게 명시 분기로 처리해야 아래 최종 else 의 "미지원 타입 throw" 에 걸리지 않는다.
          newOutputData = undefined;
        } else {
          // C-2: 위 어떤 분기에도 해당하지 않는 진짜 미지원/신규 ModuleType 은
          // 빈 Success 로 위장시키지 않고 명시적으로 실패시킨다(silent failure 방지).
          throw new Error(
            "지원하지 않는 모듈 타입입니다: " + module.type
          );
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
};
