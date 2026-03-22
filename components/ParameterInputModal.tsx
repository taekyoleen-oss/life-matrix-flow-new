import React, {
  useRef,
  useCallback,
  useState,
  useEffect,
  useMemo,
} from "react";
import {
  CanvasModule,
  Connection,
  ModuleType,
  DataPreview,
  PolicyInfoOutput,
  PremiumComponentOutput,
  AdditionalVariablesOutput,
  NetPremiumOutput,
  GrossPremiumOutput,
} from "../types";
import { XCircleIcon, XMarkIcon, PlayIcon, BookmarkIcon } from "./icons";
import { saveModuleDefault, loadModuleDefault } from "../utils/moduleDefaults";
import { SAMPLE_DATA } from "../sampleData";
import { ExcelInputModal } from "./ExcelInputModal";
import { generateDSL, extractModuleSection } from "../utils/dslParser";

// Dynamic import for xlsx to handle module resolution issues
let XLSX: any = null;
const loadXLSX = async () => {
  if (!XLSX) {
    XLSX = await import("xlsx");
  }
  return XLSX;
};

interface ParameterInputModalProps {
  module: CanvasModule;
  onClose: (shouldRestore?: boolean, skipStatusReset?: boolean) => void;
  updateModuleParameters: (id: string, newParams: Record<string, any>, replace?: boolean) => void;
  modules: CanvasModule[];
  connections: Connection[];
  projectName: string;
  folderHandle: FileSystemDirectoryHandle | null;
  onRunModule?: (id: string) => Promise<void>;
  onModuleSaved?: (moduleType: ModuleType, params: Record<string, any>) => void;
}

export const PropertyInput: React.FC<{
  label?: string;
  value: any;
  onChange: (value: any) => void;
  type?: string;
  step?: string;
  disabled?: boolean;
  placeholder?: string;
  compact?: boolean;
}> = ({
  label,
  value,
  onChange,
  type = "text",
  step,
  disabled = false,
  placeholder,
  compact = false,
}) => (
  <div>
    {label && (
      <label className={`block text-xs text-gray-400 mb-1`}>{label}</label>
    )}
    <input
      type={type}
      value={value}
      step={step}
      onChange={(e) =>
        onChange(
          type === "number" ? parseFloat(e.target.value) || 0 : e.target.value
        )
      }
      disabled={disabled}
      placeholder={placeholder}
      className={`w-full bg-gray-700 border border-gray-600 rounded ${
        compact ? "px-2 py-1 text-xs" : "px-2 py-1.5 text-xs"
      } focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-800 disabled:text-gray-500`}
    />
  </div>
);

export const PropertySelect: React.FC<{
  label?: string;
  value: any;
  onChange: (value: string) => void;
  options: { label: string; value: string }[] | string[];
  placeholder?: string;
  compact?: boolean;
}> = ({ label, value, onChange, options, placeholder, compact = false }) => (
  <div>
    {label && (
      <label className={`block text-xs text-gray-400 mb-1`}>{label}</label>
    )}
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full bg-gray-700 border border-gray-600 rounded ${
        compact ? "px-2 py-1 text-xs" : "px-2 py-1.5 text-xs"
      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((opt) => {
        const optionLabel = typeof opt === "string" ? opt : opt.label;
        const optionValue = typeof opt === "string" ? opt : opt.value;
        return (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        );
      })}
    </select>
  </div>
);

const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}> = ({ checked, onChange, label }) => (
  <div className="flex items-center gap-2">
    {label && <span className="text-xs text-gray-400">{label}</span>}
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${
        checked ? "bg-green-600" : "bg-gray-600"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-4.5" : "translate-x-1"
        }`}
        style={{
          transform: checked ? "translateX(1.125rem)" : "translateX(0.25rem)",
        }}
      />
    </button>
  </div>
);

export const getConnectedDataSource = (
  moduleId: string,
  portName: string,
  allModules: CanvasModule[],
  allConnections: Connection[]
): DataPreview | undefined => {
  const inputConnection = allConnections.find(
    (c) => c.to.moduleId === moduleId && c.to.portName === portName
  );
  if (!inputConnection) return undefined;
  const sourceModule = allModules.find(
    (m) => m.id === inputConnection.from.moduleId
  );
  if (sourceModule?.outputData?.type === "DataPreview")
    return sourceModule.outputData;
  return undefined;
};

export const getGlobalPolicyInfoFromCanvas = (
  allModules: CanvasModule[]
): PolicyInfoOutput | undefined => {
  const policyModule = allModules.find(
    (m) => m.type === ModuleType.DefinePolicyInfo
  );
  if (policyModule?.outputData?.type === "PolicyInfoOutput") {
    return policyModule.outputData;
  }
  // If not run, return parameters as a fallback
  const policyModuleParams = allModules.find(
    (m) => m.type === ModuleType.DefinePolicyInfo
  )?.parameters;
  if (policyModuleParams) {
    const policyTerm =
      policyModuleParams.policyTerm === "" ||
      policyModuleParams.policyTerm === null ||
      policyModuleParams.policyTerm === undefined
        ? 0
        : Number(policyModuleParams.policyTerm);
    return {
      type: "PolicyInfoOutput",
      entryAge: Number(policyModuleParams.entryAge),
      gender: policyModuleParams.gender,
      policyTerm: policyTerm,
      paymentTerm: Number(policyModuleParams.paymentTerm),
      interestRate: Number(policyModuleParams.interestRate) / 100,
    };
  }
  return undefined;
};

export const getConnectedPremiumComponents = (
  moduleId: string,
  portName: string,
  allModules: CanvasModule[],
  allConnections: Connection[]
): PremiumComponentOutput | undefined => {
  const inputConnection = allConnections.find(
    (c) => c.to.moduleId === moduleId && c.to.portName === portName
  );
  if (!inputConnection) return undefined;
  const sourceModule = allModules.find(
    (m) => m.id === inputConnection.from.moduleId
  );
  if (sourceModule?.outputData?.type === "PremiumComponentOutput")
    return sourceModule.outputData;
  return undefined;
};

export const getConnectedAdditionalVariables = (
  moduleId: string,
  portName: string,
  allModules: CanvasModule[],
  allConnections: Connection[]
): AdditionalVariablesOutput | undefined => {
  const inputConnection = allConnections.find(
    (c) => c.to.moduleId === moduleId && c.to.portName === portName
  );
  if (!inputConnection) return undefined;
  const sourceModule = allModules.find(
    (m) => m.id === inputConnection.from.moduleId
  );
  if (sourceModule?.outputData?.type === "AdditionalVariablesOutput")
    return sourceModule.outputData;
  return undefined;
};

export const getConnectedNetPremiumOutput = (
  moduleId: string,
  portName: string,
  allModules: CanvasModule[],
  allConnections: Connection[]
): NetPremiumOutput | undefined => {
  const inputConnection = allConnections.find(
    (c) => c.to.moduleId === moduleId && c.to.portName === portName
  );
  if (!inputConnection) return undefined;
  const sourceModule = allModules.find(
    (m) => m.id === inputConnection.from.moduleId
  );
  if (sourceModule?.outputData?.type === "NetPremiumOutput")
    return sourceModule.outputData;
  return undefined;
};

export const getConnectedGrossPremiumOutput = (
  moduleId: string,
  portName: string,
  allModules: CanvasModule[],
  allConnections: Connection[]
): GrossPremiumOutput | undefined => {
  const inputConnection = allConnections.find(
    (c) => c.to.moduleId === moduleId && c.to.portName === portName
  );
  if (!inputConnection) return undefined;
  const sourceModule = allModules.find(
    (m) => m.id === inputConnection.from.moduleId
  );
  if (sourceModule?.outputData?.type === "GrossPremiumOutput")
    return sourceModule.outputData;
  return undefined;
};

export const DefinePolicyInfoParams: React.FC<{
  parameters: Record<string, any>;
  onParametersChange: (newParams: Record<string, any>) => void;
  compact?: boolean;
}> = ({ parameters, onParametersChange, compact = false }) => {
  const [activeTab, setActiveTab] = React.useState<"policy" | "expenses">("policy");

  const {
    riderName = "주계약",
    entryAge,
    gender,
    policyTerm,
    paymentTerm,
    interestRate,
    maturityAge,
    basicValues = [
      { name: "α1", value: 0 },
      { name: "α2", value: 0 },
      { name: "β1", value: 0 },
      { name: "β2", value: 0 },
      { name: "γ",  value: 0 },
    ],
  } = parameters;

  const handleChange = (field: string, value: any) => {
    onParametersChange({ ...parameters, [field]: value });
  };

  const handleBasicValueChange = (index: number, field: string, value: any) => {
    const next = [...basicValues];
    const sanitized = field === "value" ? Math.max(0, parseFloat(value) || 0) : value;
    next[index] = { ...next[index], [field]: sanitized };
    onParametersChange({ ...parameters, basicValues: next });
  };

  const tabCls = (tab: "policy" | "expenses") =>
    `px-3 py-1.5 text-xs font-medium rounded-t transition-colors ${
      activeTab === tab
        ? "bg-blue-600 text-white"
        : "bg-gray-700 text-gray-400 hover:bg-gray-600"
    }`;

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {/* 특약명 */}
      <PropertyInput
        label="특약명"
        type="text"
        value={riderName}
        onChange={(v) => handleChange("riderName", v)}
        placeholder="주계약"
        compact={compact}
      />

      {/* 탭 헤더 */}
      <div className="flex gap-1 mt-1">
        <button className={tabCls("policy")} onClick={() => setActiveTab("policy")}>
          Policy Condition
        </button>
        <button className={tabCls("expenses")} onClick={() => setActiveTab("expenses")}>
          사업비
        </button>
      </div>

      {/* ── Policy Condition 탭 */}
      {activeTab === "policy" && (
        <div className={compact ? "space-y-2" : "space-y-4"}>
          <PropertyInput
            label="Entry Age"
            type="number"
            value={entryAge}
            onChange={(v) => handleChange("entryAge", v)}
            compact={compact}
          />
          <PropertySelect
            label="Gender"
            value={gender}
            onChange={(v) => handleChange("gender", v)}
            options={["Male", "Female"]}
            compact={compact}
          />
          <div className={`grid grid-cols-2 ${compact ? "gap-2" : "gap-4"}`}>
            <PropertyInput
              label="Policy Term (years)"
              type="number"
              value={policyTerm || ""}
              onChange={(v) => handleChange("policyTerm", v === "" ? "" : v)}
              disabled={!!maturityAge && maturityAge > 0}
              placeholder="Auto (max age)"
              compact={compact}
            />
            <PropertyInput
              label="Maturity Age (Optional)"
              type="number"
              value={maturityAge || ""}
              onChange={(v) => handleChange("maturityAge", v)}
              placeholder="e.g. 60"
              compact={compact}
            />
          </div>
          <p className={`${compact ? "text-[10px]" : "text-xs"} text-gray-500 -mt-2`}>
            보험기간을 비우면 위험률 데이터의 최대 연령에서 자동 산출합니다.
            만기연령 설정 시 보험기간 = 만기연령 − 가입연령.
          </p>
          <PropertyInput
            label="Payment Term (years)"
            type="number"
            value={paymentTerm}
            onChange={(v) => handleChange("paymentTerm", v)}
            compact={compact}
          />
          <PropertyInput
            label="Interest Rate (%)"
            type="number"
            step="0.1"
            value={interestRate}
            onChange={(v) => handleChange("interestRate", v)}
            compact={compact}
          />
        </div>
      )}

      {/* ── 사업비 탭 */}
      {activeTab === "expenses" && (
        <div className="space-y-3">
          <p className="text-xs text-gray-400">
            순보험료·영업보험료 계산에 사용되는 사업비 계수를 입력하세요.
            변수명은 수식에서 직접 참조됩니다.
          </p>
          <div className="grid grid-cols-5 gap-2">
            {basicValues.map((bv: { name: string; value: number }, idx: number) => (
              <div
                key={idx}
                className="rounded-lg border border-gray-600 p-2 flex flex-col gap-2 bg-gray-900/60"
              >
                <input
                  type="text"
                  value={bv.name}
                  onChange={(e) => handleBasicValueChange(idx, "name", e.target.value)}
                  className="w-full text-center text-xs rounded border px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-gray-800 border-gray-700 text-gray-300"
                  placeholder="이름"
                />
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={bv.value}
                  onChange={(e) => handleBasicValueChange(idx, "value", e.target.value)}
                  className="w-full text-center text-xs font-mono rounded border px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-gray-700 border-gray-600 text-white"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const SelectRiskRatesParams: React.FC<{
  parameters: Record<string, any>;
  onParametersChange: (newParams: Record<string, any>) => void;
  allModules: CanvasModule[];
  allConnections: Connection[];
  moduleId: string;
  compact?: boolean;
}> = ({
  parameters,
  onParametersChange,
  allModules,
  allConnections,
  moduleId,
  compact = false,
}) => {
  const { ageColumn, genderColumn, excludeNonNumericRows = true } = parameters;

  const dataSource = getConnectedDataSource(
    moduleId,
    "risk_data_in",
    allModules,
    allConnections
  );
  const columnOptions = dataSource?.columns.map((c) => c.name) || [];

  const handleChange = (field: string, value: string | boolean) => {
    onParametersChange({ ...parameters, [field]: value });
  };

  // Find rows with non-numeric values (excluding Age and Gender columns)
  const rowsToExclude = useMemo(() => {
    if (
      !dataSource?.rows ||
      !ageColumn ||
      !genderColumn ||
      !excludeNonNumericRows
    ) {
      return [];
    }

    const numericColumns = dataSource.columns
      .filter((c) => c.type === "number")
      .map((c) => c.name);

    const excludeAges: number[] = [];
    dataSource.rows.forEach((row, index) => {
      // Check all columns except Age and Gender
      for (const col of dataSource.columns) {
        if (col.name === ageColumn || col.name === genderColumn) continue;

        const value = row[col.name];
        // If column is supposed to be numeric but value is not numeric, exclude this row
        if (numericColumns.includes(col.name)) {
          const numValue = Number(value);
          if (
            value !== null &&
            value !== undefined &&
            value !== "" &&
            (isNaN(numValue) || !isFinite(numValue))
          ) {
            const age = Number(row[ageColumn]);
            if (!isNaN(age) && !excludeAges.includes(age)) {
              excludeAges.push(age);
            }
            break; // Found non-numeric value, no need to check other columns
          }
        }
      }
    });

    return excludeAges.sort((a, b) => a - b);
  }, [dataSource, ageColumn, genderColumn, excludeNonNumericRows]);

  if (!dataSource) {
    return (
      <p
        className={compact ? "text-xs text-gray-500" : "text-xs text-gray-500"}
      >
        Connect and run a data source to select columns.
      </p>
    );
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-2"}>
      {/* Checkbox for excluding non-numeric rows */}
      <div className="flex items-center gap-2 mb-2">
        <input
          type="checkbox"
          id="excludeNonNumericRows"
          checked={excludeNonNumericRows}
          onChange={(e) =>
            handleChange("excludeNonNumericRows", e.target.checked)
          }
          className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
        />
        <label
          htmlFor="excludeNonNumericRows"
          className="text-xs text-gray-300 cursor-pointer"
        >
          Exclude rows with non-numeric values (excluding Age, Gender columns)
        </label>
      </div>

      {/* Display ages to be excluded */}
      {excludeNonNumericRows && rowsToExclude.length > 0 && (
        <div className="mb-2 p-2 bg-gray-800/50 rounded border border-gray-600">
          <p className="text-[10px] text-gray-400 mb-1">
            Rows to be excluded (Age):
          </p>
          <p className="text-xs text-yellow-400 font-mono">
            {rowsToExclude.join(", ")}
          </p>
        </div>
      )}

      <PropertySelect
        label="Age Column"
        value={ageColumn}
        onChange={(v) => handleChange("ageColumn", v)}
        options={columnOptions}
        compact={compact}
      />
      <PropertySelect
        label="Gender Column"
        value={genderColumn}
        onChange={(v) => handleChange("genderColumn", v)}
        options={columnOptions}
        compact={compact}
      />

    </div>
  );
};

const NetPremiumCalculatorParams: React.FC<{
  parameters: Record<string, any>;
  onParametersChange: (newParams: Record<string, any>) => void;
  allModules: CanvasModule[];
  allConnections: Connection[];
  moduleId: string;
}> = ({
  parameters,
  onParametersChange,
  allModules,
  allConnections,
  moduleId,
}) => {
  const { formula, variableName } = parameters;
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [activeFormula, setActiveFormula] = useState<"formula" | "result">(
    "formula"
  );

  // Get Additional Variables output (contains premiumComponents, variables, and data)
  const additionalVarsOutput = getConnectedAdditionalVariables(
    moduleId,
    "additional_variables_in",
    allModules,
    allConnections
  );

  const premiumComponents = additionalVarsOutput?.premiumComponents;
  const additionalVars = additionalVarsOutput?.variables;
  const additionalData = additionalVarsOutput?.data;
  const policyInfo = getGlobalPolicyInfoFromCanvas(allModules);

  // Get table columns from Additional Variable's data
  const availableColumns = useMemo(() => {
    return additionalData?.columns.map((c) => c.name) || [];
  }, [additionalData]);

  const handleFormulaChange = (value: string) => {
    onParametersChange({ ...parameters, formula: value });
  };

  const handleVariableNameChange = (value: string) => {
    onParametersChange({ ...parameters, variableName: value });
  };

  const insertToken = (variableKey: string) => {
    const textarea = textAreaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = formula || "";
      const newText = text.substring(0, start) + variableKey + text.substring(end);
      onParametersChange({ ...parameters, formula: newText });
      setTimeout(() => {
        textarea.focus();
        const newCursorPos = start + variableKey.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    } else {
      onParametersChange({ ...parameters, formula: (formula || "") + variableKey });
    }
  };

  const handleKeyDown = (_e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 브래킷 토큰 방식 제거 — 기본 키 동작 사용
  };

  const getVarColor = (type: string) => {
    switch (type) {
      case "NNX":
        return "bg-blue-600 hover:bg-blue-500";
      case "MMX":
        return "bg-green-600 hover:bg-green-500";
      case "POLICY":
        return "bg-purple-600 hover:bg-purple-500";
      case "ADDITIONAL":
        return "bg-amber-600 hover:bg-amber-500";
      default:
        return "bg-gray-600 hover:bg-gray-500";
    }
  };

  const renderPreview = () => {
    if (!formula) return null;
    const parts = formula.split(/(\[[^\]]+\])/g);
    return (
      <div className="mt-2 p-2 bg-gray-800 rounded border border-gray-700 flex flex-wrap gap-1 items-center font-mono text-xs">
        <span className="text-gray-500 text-[10px] w-full uppercase font-bold mb-1">
          Live Preview
        </span>
        {parts.map((part, i) => {
          if (part.startsWith("[") && part.endsWith("]")) {
            const key = part.slice(1, -1);
            // Determine color based on variable type
            let colorClass = "bg-gray-600 text-gray-300";
            if (
              premiumComponents?.nnxResults &&
              Object.keys(premiumComponents.nnxResults).includes(key)
            ) {
              colorClass = "bg-blue-600 text-white";
            } else if (key === "MMX" || key === "SUMX" || key === "BPV") {
              colorClass = "bg-green-600 text-white";
            } else if (key === "PP" || key === variableName) {
              colorClass = "bg-green-600 text-white";
            } else if (
              additionalVars &&
              Object.keys(additionalVars).includes(key)
            ) {
              colorClass = "bg-amber-600 text-white";
            } else if (key === "m" || key === "n") {
              colorClass = "bg-purple-600 text-white";
            } else if (availableColumns.includes(key)) {
              colorClass = "bg-gray-600 text-gray-200";
            }
            return (
              <span
                key={i}
                className={`${colorClass} px-1.5 py-0.5 rounded text-xs shadow-sm`}
              >
                {part}
              </span>
            );
          }
          if (!part) return null;
          return (
            <span key={i} className="text-gray-300">
              {part}
            </span>
          );
        })}
      </div>
    );
  };

  if (!additionalVarsOutput) {
    return (
      <p className="text-sm text-gray-500">
        Connect 'Additional Variables' to see variables and table columns.
      </p>
    );
  }

  return (
    <div className="space-y-4 w-full">
      <div>
        <h4 className="text-xs text-gray-400 font-bold mb-3">
          Net Premium Calculator
        </h4>

        {/* Variable Name Input */}
        <div className="mb-4">
          <PropertyInput
            label="Variable Name"
            value={variableName || "PP"}
            onChange={handleVariableNameChange}
            placeholder="PP"
          />
        </div>

        {/* Main Layout: Left (Input Variables) and Right (Formula) */}
        <div className="flex gap-6 w-full">
          {/* Left Side: Input Variables */}
          <div className="w-2/5 flex flex-col gap-4">
            {/* NNX MMX Calculator Variables */}
            {premiumComponents && (
              <div className="flex-1 bg-gray-900/50 p-3 rounded-md border border-gray-600">
                <label className="block text-xs text-gray-400 font-bold mb-2">
                  Premium Component Variables
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-[200px] overflow-y-auto panel-scrollbar">
                  {Object.keys(premiumComponents.nnxResults).map((k) => (
                    <button
                      key={k}
                      onClick={() => insertToken(`[${k}]`)}
                      className="bg-blue-600 hover:bg-blue-500 text-xs font-mono px-2.5 py-1.5 rounded-md transition-colors shadow-sm border border-white/10"
                      title={`Insert [${k}]`}
                    >
                      {k}
                    </button>
                  ))}
                  {/* BPV variables: BPV_Mortality, BPV_CI, etc. */}
                  {Object.keys(premiumComponents.bpvResults ?? {}).length > 0
                    ? Object.keys(premiumComponents.bpvResults!).map((k) => (
                        <button
                          key={k}
                          onClick={() => insertToken(`[${k}]`)}
                          className="bg-green-600 hover:bg-green-500 text-xs font-mono px-2.5 py-1.5 rounded-md transition-colors shadow-sm border border-white/10"
                          title={`Insert [${k}]`}
                        >
                          {k}
                        </button>
                      ))
                    : (
                        <button
                          onClick={() => insertToken("[BPV]")}
                          className="bg-green-600 hover:bg-green-500 text-xs font-mono px-2.5 py-1.5 rounded-md transition-colors shadow-sm border border-white/10"
                          title="Insert [BPV]"
                        >
                          BPV
                        </button>
                      )
                  }
                  {/* Add PP (Net Premium) if available from previous execution */}
                  {(() => {
                    const currentModule = allModules.find(
                      (m) => m.id === moduleId
                    );
                    const output = currentModule?.outputData as
                      | NetPremiumOutput
                      | undefined;
                    if (output && output.type === "NetPremiumOutput") {
                      return (
                        <button
                          onClick={() =>
                            insertToken(`[${variableName || "PP"}]`)
                          }
                          className="bg-green-600 hover:bg-green-500 text-xs font-mono px-2.5 py-1.5 rounded-md transition-colors shadow-sm border border-white/10"
                          title={`Insert [${variableName || "PP"}]`}
                        >
                          {variableName || "PP"}
                        </button>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            )}

            {/* Additional Variables */}
            {additionalVars && Object.keys(additionalVars).length > 0 && (
              <div className="flex-1 bg-gray-900/50 p-3 rounded-md border border-gray-600">
                <label className="block text-xs text-gray-400 font-bold mb-2">
                  Additional Variables
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-[200px] overflow-y-auto panel-scrollbar">
                  {Object.keys(additionalVars).map((k) => (
                    <button
                      key={k}
                      onClick={() => insertToken(`[${k}]`)}
                      className="bg-amber-600 hover:bg-amber-500 text-xs font-mono px-2.5 py-1.5 rounded-md transition-colors shadow-sm border border-white/10"
                      title={`Insert [${k}]`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Table Columns */}
            {availableColumns.length > 0 && (
              <div className="flex-1 bg-gray-900/50 p-3 rounded-md border border-gray-600">
                <label className="block text-xs text-gray-400 font-bold mb-2">
                  Table Columns
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-[200px] overflow-y-auto panel-scrollbar">
                  {availableColumns.map((col) => (
                    <button
                      key={col}
                      onClick={() => insertToken(`[${col}]`)}
                      className="px-2.5 py-1.5 bg-gray-600 hover:bg-gray-500 rounded-md text-xs text-gray-200 whitespace-nowrap transition-colors"
                      title={`Insert [${col}]`}
                    >
                      {col}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Policy Variables */}
            {policyInfo && (
              <div className="bg-gray-900/50 p-3 rounded-md border border-gray-600">
                <label className="block text-xs text-gray-400 font-bold mb-2">
                  Policy Variables
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => insertToken("[m]")}
                    className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-md text-xs text-gray-200 whitespace-nowrap transition-colors"
                    title="Payment Term"
                  >
                    m
                  </button>
                  <button
                    onClick={() => insertToken("[n]")}
                    className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-md text-xs text-gray-200 whitespace-nowrap transition-colors"
                    title="Policy Term"
                  >
                    n
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Side: Formula and Result */}
          <div className="w-3/5 flex flex-col gap-4">
            {/* Formula Input */}
            <div className="flex-1 bg-gray-900/50 p-3 rounded-md border border-gray-600">
              <label className="block text-xs text-gray-400 font-bold mb-2">
                Net Premium Formula
              </label>
              <textarea
                ref={textAreaRef}
                value={formula}
                onChange={(e) => handleFormulaChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setActiveFormula("formula")}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2 min-h-[140px] resize-none"
                placeholder="e.g. [MMX] / [NNX_Male_Mortality] + [α1]"
              />
              {renderPreview()}
            </div>

            {/* Net Premium Result (if module has been executed) */}
            {(() => {
              const currentModule = allModules.find((m) => m.id === moduleId);
              const output = currentModule?.outputData as
                | NetPremiumOutput
                | undefined;
              if (output && output.type === "NetPremiumOutput") {
                return (
                  <div className="bg-gray-900/50 p-3 rounded-md border border-gray-600">
                    <label className="block text-xs text-gray-400 font-bold mb-2">
                      Net Premium Result
                    </label>
                    <div className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm font-mono">
                      <div className="text-gray-300 mb-1">
                        <span className="text-gray-500">Variable:</span>{" "}
                        <span className="text-blue-400">
                          {variableName || "PP"}
                        </span>
                      </div>
                      <div className="text-white text-lg font-bold">
                        {new Intl.NumberFormat("en-US", {
                          maximumFractionDigits: 6,
                        }).format(output.netPremium)}
                      </div>
                      {output.substitutedFormula && (
                        <div className="text-gray-400 text-xs mt-2">
                          <span className="text-gray-500">Substituted:</span>{" "}
                          {output.substitutedFormula}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </div>

        <p className="text-xs text-gray-500 mt-4">
          조건문 지원: IF(condition, true_value, false_value) 형식을 사용할 수
          있습니다. 예: IF([Age] &gt; 50, [PP] * 1.1, [PP])
        </p>
      </div>
    </div>
  );
};

const GrossPremiumCalculatorParams: React.FC<{
  parameters: Record<string, any>;
  onParametersChange: (newParams: Record<string, any>) => void;
  allModules: CanvasModule[];
  allConnections: Connection[];
  moduleId: string;
}> = ({
  parameters,
  onParametersChange,
  allModules,
  allConnections,
  moduleId,
}) => {
  const { formula, variableName } = parameters;
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [activeFormula, setActiveFormula] = useState<"formula" | "result">(
    "formula"
  );

  const netPremiumOutput = getConnectedNetPremiumOutput(
    moduleId,
    "net_premium_in",
    allModules,
    allConnections
  );

  // Find Net Premium Calculator module to get its Additional Variables input
  const netPremiumModule = useMemo(() => {
    if (!netPremiumOutput || !allModules || !allConnections) return null;
    const netPremiumConn = allConnections.find(
      (c) => c.to.moduleId === moduleId && c.to.portName === "net_premium_in"
    );
    if (netPremiumConn) {
      return allModules.find((m) => m.id === netPremiumConn.from.moduleId);
    }
    return null;
  }, [netPremiumOutput, allModules, allConnections, moduleId]);

  // Get Additional Variables Output from Net Premium Calculator's input
  const additionalVarsOutput = useMemo(() => {
    if (!netPremiumModule || !allConnections) return null;
    const additionalVarsConn = allConnections.find(
      (c) =>
        c.to.moduleId === netPremiumModule.id &&
        c.to.portName === "additional_variables_in"
    );
    if (additionalVarsConn) {
      const additionalVarModule = allModules?.find(
        (m) => m.id === additionalVarsConn.from.moduleId
      );
      if (
        additionalVarModule?.outputData?.type === "AdditionalVariablesOutput"
      ) {
        return additionalVarModule.outputData as AdditionalVariablesOutput;
      }
    }
    return null;
  }, [netPremiumModule, allModules, allConnections]);

  const premiumComponents = additionalVarsOutput?.premiumComponents;
  const additionalVars = additionalVarsOutput?.variables;
  const additionalData = additionalVarsOutput?.data;
  const policyInfo = getGlobalPolicyInfoFromCanvas(allModules);

  // Get table columns from Additional Variable's data
  const availableColumns = useMemo(() => {
    return additionalData?.columns.map((c) => c.name) || [];
  }, [additionalData]);

  // Categorize variables from Net Premium Output similar to Net Premium Calculator
  const premiumComponentVars = useMemo(() => {
    const vars: string[] = [];
    if (netPremiumOutput?.variables) {
      // NNX variables (typically start with NNX_)
      Object.keys(netPremiumOutput.variables).forEach((k) => {
        if (k.startsWith("NNX_")) {
          vars.push(k);
        }
      });
      // BPV (Benefit Present Value) — formerly MMX/SUMX
      if (netPremiumOutput.variables["BPV"] !== undefined) {
        vars.push("BPV");
      } else if (netPremiumOutput.variables["MMX"] !== undefined) {
        vars.push("MMX"); // backward compat
      }
      // PP (Net Premium result)
      const ppName =
        netPremiumOutput.variables["PP"] !== undefined
          ? "PP"
          : Object.keys(netPremiumOutput.variables).find(
              (k) =>
                !k.startsWith("NNX_") &&
                k !== "BPV" &&
                k !== "MMX" &&
                k !== "SUMX" &&
                k !== "m" &&
                k !== "n" &&
                !additionalVars?.[k]
            ) || "PP";
      if (netPremiumOutput.variables[ppName] !== undefined) {
        vars.push(ppName);
      }
    }
    return vars;
  }, [netPremiumOutput, additionalVars]);

  const additionalVarKeys = useMemo(() => {
    if (additionalVars) {
      return Object.keys(additionalVars);
    }
    // Fallback: extract from netPremiumOutput.variables if not in premiumComponentVars
    if (netPremiumOutput?.variables) {
      return Object.keys(netPremiumOutput.variables).filter(
        (k) =>
          !k.startsWith("NNX_") &&
          k !== "BPV" &&
          k !== "MMX" &&
          k !== "SUMX" &&
          k !== "PP" &&
          k !== "m" &&
          k !== "n"
      );
    }
    return [];
  }, [additionalVars, netPremiumOutput]);

  const handleFormulaChange = (value: string) => {
    onParametersChange({ ...parameters, formula: value });
  };

  const handleVariableNameChange = (value: string) => {
    onParametersChange({ ...parameters, variableName: value });
  };

  const insertToken = (variableKey: string) => {
    const textarea = textAreaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = formula || "";
      const newText = text.substring(0, start) + variableKey + text.substring(end);
      onParametersChange({ ...parameters, formula: newText });
      setTimeout(() => {
        textarea.focus();
        const newCursorPos = start + variableKey.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    } else {
      onParametersChange({ ...parameters, formula: (formula || "") + variableKey });
    }
  };

  const handleKeyDown = (_e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 브래킷 토큰 방식 제거 — 기본 키 동작 사용
  };

  const getVarColor = (type: string) => {
    switch (type) {
      case "NET_PREMIUM":
        return "bg-green-600 hover:bg-green-500";
      case "INHERITED":
        return "bg-blue-600 hover:bg-blue-500";
      case "ADDITIONAL":
        return "bg-amber-600 hover:bg-amber-500";
      default:
        return "bg-gray-600 hover:bg-gray-500";
    }
  };

  const renderPreview = () => {
    if (!formula) return null;
    const parts = formula.split(/(\[[^\]]+\])/g);
    return (
      <div className="mt-2 p-2 bg-gray-800 rounded border border-gray-700 flex flex-wrap gap-1 items-center font-mono text-xs">
        <span className="text-gray-500 text-[10px] w-full uppercase font-bold mb-1">
          Live Preview
        </span>
        {parts.map((part, i) => {
          if (part.startsWith("[") && part.endsWith("]")) {
            const key = part.slice(1, -1);
            // Check if it's a premium component var, additional var, or policy var
            let colorClass = "bg-gray-600 text-gray-300";
            if (premiumComponentVars.includes(key)) {
              colorClass = "bg-blue-600 text-white";
            } else if (key === "MMX") {
              colorClass = "bg-green-600 text-white";
            } else if (key === "PP" || key === variableName || key === "GP") {
              colorClass = "bg-green-600 text-white";
            } else if (additionalVarKeys.includes(key)) {
              colorClass = "bg-amber-600 text-white";
            } else if (key === "m" || key === "n") {
              colorClass = "bg-purple-600 text-white";
            } else if (availableColumns.includes(key)) {
              colorClass = "bg-gray-600 text-gray-200";
            }
            return (
              <span
                key={i}
                className={`${colorClass} px-1.5 py-0.5 rounded text-xs shadow-sm`}
              >
                {part}
              </span>
            );
          }
          if (!part) return null;
          return (
            <span key={i} className="text-gray-300">
              {part}
            </span>
          );
        })}
      </div>
    );
  };

  if (!netPremiumOutput) {
    return (
      <p className="text-sm text-gray-500">
        Connect 'Net Premium Calculator' to see variables.
      </p>
    );
  }

  return (
    <div className="space-y-4 w-full">
      <div>
        <h4 className="text-xs text-gray-400 font-bold mb-3">
          Gross Premium Calculator
        </h4>

        {/* Variable Name Input */}
        <div className="mb-4">
          <PropertyInput
            label="Variable Name"
            value={variableName || "GP"}
            onChange={handleVariableNameChange}
            placeholder="GP"
          />
        </div>

        {/* Main Layout: Left (Input Variables) and Right (Formula) */}
        <div className="flex gap-6 w-full">
          {/* Left Side: Input Variables */}
          <div className="w-2/5 flex flex-col gap-4">
            {/* NNX MMX Calculator Variables */}
            {premiumComponentVars.length > 0 && (
              <div className="flex-1 bg-gray-900/50 p-3 rounded-md border border-gray-600">
                <label className="block text-xs text-gray-400 font-bold mb-2">
                  Premium Component Variables
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-[200px] overflow-y-auto panel-scrollbar">
                  {premiumComponentVars.map((k) => (
                    <button
                      key={k}
                      onClick={() => insertToken(`[${k}]`)}
                      className={
                        k === "BPV" || k === "MMX" || k === "PP" || k === variableName
                          ? "bg-green-600 hover:bg-green-500 text-xs font-mono px-2.5 py-1.5 rounded-md transition-colors shadow-sm border border-white/10"
                          : "bg-blue-600 hover:bg-blue-500 text-xs font-mono px-2.5 py-1.5 rounded-md transition-colors shadow-sm border border-white/10"
                      }
                      title={`Insert [${k}]`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Additional Variables */}
            {additionalVarKeys.length > 0 && (
              <div className="flex-1 bg-gray-900/50 p-3 rounded-md border border-gray-600">
                <label className="block text-xs text-gray-400 font-bold mb-2">
                  Additional Variables
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-[200px] overflow-y-auto panel-scrollbar">
                  {additionalVarKeys.map((k) => (
                    <button
                      key={k}
                      onClick={() => insertToken(`[${k}]`)}
                      className="bg-amber-600 hover:bg-amber-500 text-xs font-mono px-2.5 py-1.5 rounded-md transition-colors shadow-sm border border-white/10"
                      title={`Insert [${k}]`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Table Columns */}
            {availableColumns.length > 0 && (
              <div className="flex-1 bg-gray-900/50 p-3 rounded-md border border-gray-600">
                <label className="block text-xs text-gray-400 font-bold mb-2">
                  Table Columns
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-[200px] overflow-y-auto panel-scrollbar">
                  {availableColumns.map((col) => (
                    <button
                      key={col}
                      onClick={() => insertToken(`[${col}]`)}
                      className="px-2.5 py-1.5 bg-gray-600 hover:bg-gray-500 rounded-md text-xs text-gray-200 whitespace-nowrap transition-colors"
                      title={`Insert [${col}]`}
                    >
                      {col}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Policy Variables */}
            {policyInfo && (
              <div className="bg-gray-900/50 p-3 rounded-md border border-gray-600">
                <label className="block text-xs text-gray-400 font-bold mb-2">
                  Policy Variables
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => insertToken("[m]")}
                    className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-md text-xs text-gray-200 whitespace-nowrap transition-colors"
                    title="Payment Term"
                  >
                    m
                  </button>
                  <button
                    onClick={() => insertToken("[n]")}
                    className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-md text-xs text-gray-200 whitespace-nowrap transition-colors"
                    title="Policy Term"
                  >
                    n
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Side: Formula */}
          <div className="w-3/5 flex flex-col gap-4">
            <div className="flex-1 bg-gray-900/50 p-3 rounded-md border border-gray-600">
              <label className="block text-xs text-gray-400 font-bold mb-2">
                Gross Premium Formula
              </label>
              <textarea
                ref={textAreaRef}
                value={formula}
                onChange={(e) => handleFormulaChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setActiveFormula("formula")}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2 min-h-[140px] resize-none"
                placeholder="e.g. [PP] / (1 - 0.0)"
              />
              {renderPreview()}
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-500 mt-4">
          조건문 지원: IF(condition, true_value, false_value) 형식을 사용할 수
          있습니다. 예: IF([PP] &gt; 1000, [PP] / (1 - 0.1), [PP] / (1 - 0.05))
        </p>
      </div>
    </div>
  );
};

const AdditionalNameParams: React.FC<{
  parameters: Record<string, any>;
  onParametersChange: (newParams: Record<string, any>) => void;
  allModules: CanvasModule[];
  allConnections: Connection[];
  moduleId: string;
}> = ({
  parameters,
  onParametersChange,
  allModules,
  allConnections,
  moduleId,
}) => {
  const { definitions = [], basicValues = [] } = parameters;

  // Get data from Premium Component output
  const premiumComponents = getConnectedPremiumComponents(
    moduleId,
    "premium_components_in",
    allModules,
    allConnections
  );
  const dataSource = premiumComponents?.data; // Get table data from NNX MMX Calculator output

  const policyInfo = getGlobalPolicyInfoFromCanvas(allModules);
  const columns = dataSource?.columns.map((c) => c.name) || [];

  const updateDefinitions = (newDefinitions: any[]) => {
    onParametersChange({ ...parameters, definitions: newDefinitions });
  };

  const updateBasicValues = (newBasicValues: any[]) => {
    onParametersChange({ ...parameters, basicValues: newBasicValues });
  };

  const handleAddDefinition = () => {
    const defaultColumn = columns.length > 0 ? columns[0] : "";
    const defaultRowType = "entryAge";
    const rowTypeLabel = getRowTypeLabel(defaultRowType, 0);
    const defaultName = defaultColumn ? `${defaultColumn}(${rowTypeLabel})` : "";
    
    const newDef = {
      id: `def-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: defaultName,
      type: "lookup", // 'static' or 'lookup'
      staticValue: 0,
      column: defaultColumn,
      rowType: defaultRowType, // 'entryAge', 'policyTerm', 'paymentTerm', 'entryAgePlus', 'custom'
      customValue: 0,
    };
    updateDefinitions([...definitions, newDef]);
  };

  const handleRemoveDefinition = (id: string) => {
    updateDefinitions(definitions.filter((d: any) => d.id !== id));
  };

  // Row Index Rule의 라벨을 가져오는 헬퍼 함수
  const getRowTypeLabel = (rowType: string, customValue?: number): string => {
    switch (rowType) {
      case "entryAge":
        return "Entry Age";
      case "policyTerm":
        return "Policy Term";
      case "paymentTerm":
        return "Payment Term";
      case "entryAgePlus":
        return `Entry Age + ${customValue || 0}`;
      case "custom":
        return `Row ${customValue || 0}`;
      default:
        return rowType;
    }
  };

  const handleUpdateDefinition = (id: string, field: string, value: any) => {
    const newDefinitions = definitions.map((d: any) => {
      if (d.id === id) {
        const updated = { ...d, [field]: value };
        
        // Column이나 Row Index Rule이 변경되면 Var Name 자동 업데이트
        if (field === "column" || field === "rowType" || field === "customValue") {
          if (updated.type === "lookup" && updated.column) {
            const rowTypeLabel = getRowTypeLabel(
              updated.rowType || "entryAge",
              updated.customValue
            );
            updated.name = `${updated.column}(${rowTypeLabel})`;
          }
        }
        
        return updated;
      }
      return d;
    });
    updateDefinitions(newDefinitions);
  };

  const handleUpdateBasicValue = (index: number, field: string, value: any) => {
    const newBasicValues = [...basicValues];
    newBasicValues[index] = { ...newBasicValues[index], [field]: value };
    updateBasicValues(newBasicValues);
  };

  const getPreviewValue = (def: any) => {
    if (!dataSource || !dataSource.rows) return "No Data";
    if (def.type === "static") return def.staticValue;

    if (def.type === "lookup") {
      if (!def.column) return "Select Col";
      if (!policyInfo) return "No Policy Info";

      let rowIndex = 0;
      if (def.rowType === "policyTerm") rowIndex = policyInfo.policyTerm;
      else if (def.rowType === "paymentTerm") rowIndex = policyInfo.paymentTerm;
      else if (def.rowType === "entryAgePlus")
        rowIndex = Number(def.customValue) || 0;
      // Assuming index maps to duration
      else if (def.rowType === "custom")
        rowIndex = Number(def.customValue) || 0;

      if (rowIndex < 0 || rowIndex >= dataSource.rows.length)
        return "Index Out of Bounds";
      const val = dataSource.rows[rowIndex][def.column];
      return val !== undefined ? Number(val).toFixed(5) : "Empty";
    }
    return "-";
  };

  if (!dataSource)
    return (
      <p className="text-sm text-gray-500">
        Connect 'Premium Component' to enable variable lookup.
      </p>
    );

  return (
    <div className="space-y-6">
      {/* Basic Loadings Section - 읽기 전용 (Define Policy Info에서 관리) */}
      <div>
        <h4 className="text-xs text-gray-400 font-bold mb-1">Basic Loadings (사업비)</h4>
        <div className="grid grid-cols-5 gap-2 opacity-60 pointer-events-none select-none">
          {basicValues.map((bv: any, index: number) => (
            <div
              key={index}
              className="bg-gray-900/50 p-2 rounded-md border border-gray-700 flex flex-col gap-2"
            >
              <input
                type="text"
                value={bv.name}
                readOnly
                className="w-full bg-gray-800 text-center text-gray-400 border border-gray-700 rounded px-1 py-1 text-xs cursor-not-allowed"
              />
              <input
                type="number"
                value={bv.value}
                readOnly
                step="0.001"
                className="w-full bg-gray-800 text-center text-gray-400 border border-gray-700 rounded px-1 py-1 text-xs font-mono cursor-not-allowed"
              />
            </div>
          ))}
        </div>
        <p className="text-[11px] text-yellow-400 mt-2">
          ℹ️ 사업비는 <strong>Define Policy Info</strong> 모듈에서 변경이 가능합니다.
        </p>
      </div>

      {/* Custom Variables Section */}
      <div className="space-y-4">
        <h4 className="text-xs text-gray-400 font-bold mb-2">
          Additional Variable Definitions
        </h4>
        <div className="space-y-3">
          {definitions.map((def: any) => (
            <div
              key={def.id}
              className="bg-gray-900/50 p-3 rounded-md border border-gray-600 relative flex flex-col gap-2"
            >
              <button
                onClick={() => handleRemoveDefinition(def.id)}
                className="absolute top-1.5 right-1.5 text-gray-500 hover:text-white"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>

              {/* Name Input */}
              <div className="flex items-center bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs h-[38px] w-full">
                <span className="text-gray-400 mr-2 font-bold text-xs">
                  Var Name:
                </span>
                <input
                  type="text"
                  placeholder="e.g. Extra_Loading"
                  value={def.name}
                  onChange={(e) =>
                    handleUpdateDefinition(def.id, "name", e.target.value)
                  }
                  className="flex-grow bg-transparent focus:outline-none text-gray-200 placeholder-gray-500"
                />
              </div>

              {/* Type Selector */}
              <div className="flex gap-4 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name={`type-${def.id}`}
                    checked={def.type === "static"}
                    onChange={() =>
                      handleUpdateDefinition(def.id, "type", "static")
                    }
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-300">Static Value</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name={`type-${def.id}`}
                    checked={def.type === "lookup"}
                    onChange={() =>
                      handleUpdateDefinition(def.id, "type", "lookup")
                    }
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-300">Table Lookup</span>
                </label>
              </div>

              {/* Conditional Inputs */}
              {def.type === "static" ? (
                <PropertyInput
                  label="Value"
                  type="number"
                  value={def.staticValue}
                  onChange={(v) =>
                    handleUpdateDefinition(def.id, "staticValue", v)
                  }
                />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <PropertySelect
                    label="Column"
                    value={def.column}
                    onChange={(v) => handleUpdateDefinition(def.id, "column", v)}
                    options={columns}
                  />
                  <PropertySelect
                    label="Row Index Rule"
                    value={def.rowType}
                    onChange={(v) => handleUpdateDefinition(def.id, "rowType", v)}
                    options={[
                      { label: "Entry Age", value: "entryAge" },
                      { label: "Policy Term (End)", value: "policyTerm" },
                      { label: "Payment Term (End)", value: "paymentTerm" },
                      { label: "Entry Age + X years", value: "entryAgePlus" },
                      { label: "Custom Row Index", value: "custom" },
                    ]}
                  />
                  {(def.rowType === "entryAgePlus" ||
                    def.rowType === "custom") && (
                    <div className="col-span-2">
                      <PropertyInput
                        label={
                          def.rowType === "entryAgePlus"
                            ? "Years after Entry Age (Duration)"
                            : "Row Index (0-based)"
                        }
                        type="number"
                        value={def.customValue}
                        onChange={(v) => handleUpdateDefinition(def.id, "customValue", v)}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Live Preview */}
              <div className="text-xs text-gray-400 mt-1 flex justify-between items-center bg-gray-800 px-2 py-1 rounded">
                <span>Preview Value:</span>
                <span className="font-mono font-bold text-green-400">
                  {getPreviewValue(def)}
                </span>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={handleAddDefinition}
          className="w-full mt-2 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 rounded-md font-semibold"
        >
          Add Variable
        </button>
      </div>
    </div>
  );
};

const LoadDataParams: React.FC<{
  parameters: Record<string, any>;
  onParametersChange: (newParams: Record<string, any>) => void;
  folderHandle: FileSystemDirectoryHandle | null;
}> = ({ parameters, onParametersChange, folderHandle }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showExcelModal, setShowExcelModal] = useState(false);

  // 엑셀 파일을 CSV로 변환하는 함수
  const convertExcelToCSV = async (workbook: any, sheetName?: string): Promise<string> => {
    const xlsx = await loadXLSX();
    const targetSheet = sheetName || workbook.SheetNames[0];
    const worksheet = workbook.Sheets[targetSheet];
    const jsonData = xlsx.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null,
      raw: false,
    });

    return jsonData
      .map((row: any) => {
        return row
          .map((cell: any) => {
            if (cell === null || cell === undefined) return "";
            const str = String(cell);
            if (str.includes(",") || str.includes('"') || str.includes("\n")) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(",");
      })
      .join("\n");
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const fileName = file.name.toLowerCase();
      
      if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
        // 엑셀 파일 처리
        try {
          const xlsx = await loadXLSX();
          const arrayBuffer = await file.arrayBuffer();
          const workbook = xlsx.read(arrayBuffer, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const csvContent = await convertExcelToCSV(workbook, firstSheetName);

          onParametersChange({
            source: file.name,
            fileContent: csvContent,
            fileType: "excel",
            sheetName: firstSheetName,
          });
        } catch (error) {
          console.error("Error processing Excel file:", error);
          alert("엑셀 파일 처리 중 오류가 발생했습니다.");
        }
      } else {
        // CSV 파일 처리
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          onParametersChange({ source: file.name, fileContent: content, fileType: "csv" });
        };
        reader.readAsText(file);
      }
    }
  };

  const handleLoadSample = (sample: { name: string; content: string }) => {
    onParametersChange({ source: sample.name, fileContent: sample.content });
  };

  const handleBrowseClick = async () => {
    if (folderHandle && (window as any).showOpenFilePicker) {
      try {
        const [fileHandle] = await (window as any).showOpenFilePicker({
          startIn: folderHandle,
          types: [
            { description: "CSV Files", accept: { "text/csv": [".csv"] } },
            {
              description: "Excel Files",
              accept: {
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
                "application/vnd.ms-excel": [".xls"],
              },
            },
          ],
        });
        const file = await fileHandle.getFile();
        const fileName = file.name.toLowerCase();

        if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
          // 엑셀 파일 처리
          const xlsx = await loadXLSX();
          const arrayBuffer = await file.arrayBuffer();
          const workbook = xlsx.read(arrayBuffer, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const csvContent = await convertExcelToCSV(workbook, firstSheetName);

          onParametersChange({
            source: file.name,
            fileContent: csvContent,
            fileType: "excel",
            sheetName: firstSheetName,
          });
        } else {
          // CSV 파일 처리
          const reader = new FileReader();
          reader.onload = (e) => {
            const content = e.target?.result as string;
            onParametersChange({ source: file.name, fileContent: content, fileType: "csv" });
          };
          reader.readAsText(file);
        }
      } catch (error: any) {
        if (error.name !== "AbortError") fileInputRef.current?.click();
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleExcelInputApply = (csvContent: string) => {
    onParametersChange({
      source: "엑셀 직접 입력",
      fileContent: csvContent,
      fileType: "excel",
    });
  };

  return (
    <div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".csv,.xlsx,.xls"
        className="hidden"
      />
      <label className="block text-xs text-gray-400 mb-1">Source</label>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={parameters.source}
          readOnly
          className="flex-grow bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-xs"
          placeholder="No file selected"
        />
        <button
          onClick={handleBrowseClick}
          className="px-3 py-1.5 text-xs bg-gray-600 hover:bg-gray-500 rounded-md font-semibold"
        >
          Browse...
        </button>
      </div>
      {/* 파일 타입 표시 */}
      {parameters.fileType === "excel" && parameters.sheetName && (
        <div className="mb-2 text-xs text-gray-500">
          Excel Sheet: {parameters.sheetName}
        </div>
      )}
      {/* 엑셀 데이터 직접 입력 버튼 */}
      <button
        onClick={() => setShowExcelModal(true)}
        className="mb-4 px-3 py-1.5 text-xs bg-gray-600 hover:bg-gray-500 rounded-md font-semibold"
      >
        엑셀 데이터 직접 입력
      </button>
      <div className="mt-4">
        <h4 className="text-xs text-gray-500 uppercase font-bold mb-2">
          Examples
        </h4>
        <div className="bg-gray-900 p-2 rounded-md space-y-1">
          {SAMPLE_DATA.filter((s) => s.name.includes(".csv")).map((sample) => (
            <div
              key={sample.name}
              onDoubleClick={() => handleLoadSample(sample)}
              className="px-2 py-1.5 text-xs rounded-md hover:bg-gray-700 cursor-pointer"
              title="Double-click to load"
            >
              {sample.name}
            </div>
          ))}
        </div>
      </div>
      {showExcelModal && (
        <ExcelInputModal
          onClose={() => setShowExcelModal(false)}
          onApply={handleExcelInputApply}
        />
      )}
    </div>
  );
};

interface SelectionItem {
  originalName: string;
  selected: boolean;
  newName: string;
}

const SelectDataParams: React.FC<{
  parameters: Record<string, any>;
  onParametersChange: (newParams: Record<string, any>) => void;
  allModules: CanvasModule[];
  allConnections: Connection[];
  moduleId: string;
}> = ({
  parameters,
  onParametersChange,
  allModules,
  allConnections,
  moduleId,
}) => {
  const dataSource = getConnectedDataSource(
    moduleId,
    "data_in",
    allModules,
    allConnections
  );
  const inputColumns = dataSource?.columns.map((c) => c.name) || [];

  const [selections, setSelections] = useState<SelectionItem[]>(() => {
    const existingSelections = parameters.selections || [];
    const existingSelectionMap = new Map(
      existingSelections.map((s: any) => [s.originalName, s])
    );
    // 기존 selections이 있으면(DSL에서 명시된 경우) 새 열은 미선택 기본값
    // 기존 selections이 없으면(처음 생성) 모두 선택 기본값
    const defaultSelected = existingSelections.length === 0;

    return inputColumns.map((colName) => {
      if (existingSelectionMap.has(colName)) {
        return existingSelectionMap.get(colName) as SelectionItem;
      }
      return { originalName: colName, selected: defaultSelected, newName: colName };
    });
  });

  useEffect(() => {
    const existingSelections = parameters.selections || [];
    const existingSelectionMap = new Map(
      existingSelections.map((s: any) => [s.originalName, s])
    );
    const defaultSelected = existingSelections.length === 0;

    const newSelections: SelectionItem[] = inputColumns.map((colName) => {
      const existing = existingSelectionMap.get(colName);
      if (existing) {
        return existing as SelectionItem;
      }
      return { originalName: colName, selected: defaultSelected, newName: colName };
    });

    if (JSON.stringify(newSelections) !== JSON.stringify(selections)) {
      setSelections(newSelections);
    }

    if (existingSelections.length === 0 && newSelections.length > 0) {
      onParametersChange({ selections: newSelections });
    }
  }, [inputColumns.join(",")]);

  const deathRateColumn: string = parameters.deathRateColumn || "";

  const handleSelectionChange = (index: number, selected: boolean) => {
    const newSelections = [...selections];
    newSelections[index] = { ...newSelections[index], selected };
    setSelections(newSelections);
    onParametersChange({ selections: newSelections, deathRateColumn });
  };

  const handleNameChange = (index: number, newName: string) => {
    const newSelections = [...selections];
    newSelections[index] = { ...newSelections[index], newName };
    setSelections(newSelections);
    onParametersChange({ selections: newSelections, deathRateColumn });
  };

  const handleSelectAll = () => {
    const newSelections = selections.map((s) => ({ ...s, selected: true }));
    setSelections(newSelections);
    onParametersChange({ selections: newSelections, deathRateColumn });
  };

  const handleDeselectAll = () => {
    const newSelections = selections.map((s) => ({ ...s, selected: false }));
    setSelections(newSelections);
    onParametersChange({ selections: newSelections, deathRateColumn });
  };

  const handleDeathRateColumnChange = (originalColName: string) => {
    let newSelections = selections.map((s) => {
      // 이전 Death_Rate 지정 열의 이름 복원
      if (s.originalName === deathRateColumn && s.newName === "Death_Rate") {
        return { ...s, newName: s.originalName };
      }
      return s;
    });
    // 새 열을 선택 + 이름을 Death_Rate로 고정
    if (originalColName) {
      newSelections = newSelections.map((s) =>
        s.originalName === originalColName
          ? { ...s, selected: true, newName: "Death_Rate" }
          : s
      );
    }
    setSelections(newSelections);
    onParametersChange({ selections: newSelections, deathRateColumn: originalColName });
  };

  if (!dataSource) {
    return (
      <p className="text-sm text-gray-500">
        Connect and run a data source to select columns.
      </p>
    );
  }

  return (
    <div>
      {/* Death_Rate 열 지정 */}
      <div className="mb-4 p-3 bg-orange-950/30 border border-orange-800/40 rounded-lg">
        <label className="text-xs text-orange-300 font-bold block mb-1.5">
          사망위험률 열 (Death_Rate)
        </label>
        <p className="text-xs text-gray-400 mb-2">
          선택한 열은 출력 시 <span className="text-orange-300 font-mono">Death_Rate</span>로 자동 이름 변경되며, Survivors Calculator의 Mortality Rate Column에 적용됩니다.
        </p>
        <select
          value={deathRateColumn}
          onChange={(e) => handleDeathRateColumnChange(e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="">(선택 안 함)</option>
          {inputColumns
            .filter((col) => col !== "Age" && col !== "Sex" && col !== "Gender")
            .map((col) => (
              <option key={col} value={col}>{col}</option>
            ))}
        </select>
      </div>

      <h4 className="text-sm text-gray-400 font-bold mb-2">
        Column Selections
      </h4>
      <div className="flex gap-2 mb-3">
        <button
          onClick={handleSelectAll}
          className="px-3 py-1.5 text-xs bg-gray-600 hover:bg-gray-500 rounded-md font-semibold w-full"
        >
          Select All
        </button>
        <button
          onClick={handleDeselectAll}
          className="px-3 py-1.5 text-xs bg-gray-600 hover:bg-gray-500 rounded-md font-semibold w-full"
        >
          Deselect All
        </button>
      </div>
      <div className="grid grid-cols-[auto,1fr] gap-x-3 items-center mb-2 px-2">
        <div />
        <div className="grid grid-cols-2 gap-x-3">
          <label className="text-sm text-gray-400 font-bold">
            Original Name
          </label>
          <label className="text-sm text-gray-400 font-bold">New Name</label>
        </div>
      </div>
      <div className="space-y-2 max-h-72 overflow-y-auto pr-2 panel-scrollbar">
        {selections.map((selection, index) => {
          const isDeathRate = selection.originalName === deathRateColumn;
          const isLocked =
            selection.originalName === "Age" ||
            selection.originalName === "Gender" ||
            isDeathRate;
          return (
            <div
              key={selection.originalName}
              className={`grid grid-cols-[auto,1fr] gap-x-3 items-center p-2 rounded-md ${
                isDeathRate
                  ? "bg-orange-950/40 border border-orange-800/40"
                  : "bg-gray-900/50"
              }`}
            >
              <input
                type="checkbox"
                checked={selection.selected}
                onChange={(e) => handleSelectionChange(index, e.target.checked)}
                className="form-checkbox h-4 w-4 text-blue-500 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
              />
              <div className="grid grid-cols-2 gap-x-3">
                <span
                  className="text-sm text-gray-300 truncate bg-gray-700 px-2 py-1.5 rounded-md border border-gray-600"
                  title={selection.originalName}
                >
                  {selection.originalName}
                </span>
                <input
                  type="text"
                  value={selection.newName}
                  onChange={(e) => handleNameChange(index, e.target.value)}
                  className={`border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 disabled:opacity-60 disabled:cursor-not-allowed ${
                    isDeathRate
                      ? "bg-orange-900/30 border-orange-700 text-orange-200 focus:ring-orange-500"
                      : "bg-gray-700 border-gray-600 focus:ring-blue-500"
                  }`}
                  placeholder="New column name"
                  disabled={isLocked}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ReserveCalculatorParams: React.FC<{
  parameters: Record<string, any>;
  onParametersChange: (newParams: Record<string, any>) => void;
  allModules: CanvasModule[];
  allConnections: Connection[];
  moduleId: string;
}> = ({
  parameters,
  onParametersChange,
  allModules,
  allConnections,
  moduleId,
}) => {
  const {
    formulaForPaymentTermOrLess,
    formulaForGreaterThanPaymentTerm,
    reserveColumnName = "Reserve",
  } = parameters;

  const formula1Ref = useRef<HTMLTextAreaElement>(null);
  const formula2Ref = useRef<HTMLTextAreaElement>(null);
  const [activeFormula, setActiveFormula] = useState<"formula1" | "formula2">(
    "formula1"
  );

  // Get Gross Premium Calculator output
  const grossPremiumOutput = getConnectedGrossPremiumOutput(
    moduleId,
    "gross_premium_in",
    allModules,
    allConnections
  );

  const grossPremiumVars = grossPremiumOutput?.variables || {};
  const tableData = grossPremiumOutput?.data;
  const policyInfo = getGlobalPolicyInfoFromCanvas(allModules);

  // Find Gross Premium Calculator module to get its Net Premium Calculator input
  const grossPremiumModule = useMemo(() => {
    if (!grossPremiumOutput || !allModules || !allConnections) return null;
    const grossPremiumConn = allConnections.find(
      (c) => c.to.moduleId === moduleId && c.to.portName === "gross_premium_in"
    );
    if (grossPremiumConn) {
      return allModules.find((m) => m.id === grossPremiumConn.from.moduleId);
    }
    return null;
  }, [grossPremiumOutput, allModules, allConnections, moduleId]);

  // Find Net Premium Calculator module from Gross Premium Calculator's input
  const netPremiumModule = useMemo(() => {
    if (!grossPremiumModule || !allConnections) return null;
    const netPremiumConn = allConnections.find(
      (c) =>
        c.to.moduleId === grossPremiumModule.id &&
        c.to.portName === "net_premium_in"
    );
    if (netPremiumConn) {
      return allModules?.find((m) => m.id === netPremiumConn.from.moduleId);
    }
    return null;
  }, [grossPremiumModule, allModules, allConnections]);

  // Get Additional Variables Output from Net Premium Calculator's input
  const additionalVarsOutput = useMemo(() => {
    if (!netPremiumModule || !allConnections) return null;
    const additionalVarsConn = allConnections.find(
      (c) =>
        c.to.moduleId === netPremiumModule.id &&
        c.to.portName === "additional_variables_in"
    );
    if (additionalVarsConn) {
      const additionalVarModule = allModules?.find(
        (m) => m.id === additionalVarsConn.from.moduleId
      );
      if (
        additionalVarModule?.outputData?.type === "AdditionalVariablesOutput"
      ) {
        return additionalVarModule.outputData as AdditionalVariablesOutput;
      }
    }
    return null;
  }, [netPremiumModule, allModules, allConnections]);

  const additionalVars = additionalVarsOutput?.variables;

  // Get table columns from Gross Premium Calculator's data
  const availableColumns = useMemo(() => {
    return tableData?.columns.map((c) => c.name) || [];
  }, [tableData]);

  // Categorize variables from Gross Premium Output similar to Gross Premium Calculator
  // Exclude table columns (those ending with _Col) from Premium Variables
  const premiumComponentVars = useMemo(() => {
    const vars: string[] = [];
    if (grossPremiumVars) {
      // NNX variables (typically start with NNX_) - exclude table columns ending with _Col
      Object.keys(grossPremiumVars).forEach((k) => {
        if (k.startsWith("NNX_") && !k.endsWith("_Col")) {
          vars.push(k);
        }
      });
      // BPV (variable, not table column BPV_Col)
      if (grossPremiumVars["BPV_Mortality"] !== undefined) {
        vars.push("BPV_Mortality");
      } else if (grossPremiumVars["BPV"] !== undefined) {
        vars.push("BPV");
      } else if (grossPremiumVars["MMX"] !== undefined) {
        vars.push("MMX"); // backward compat
      }
      // PP (Net Premium result) - exclude if it ends with _Col
      const ppName =
        grossPremiumVars["PP"] !== undefined && !grossPremiumVars["PP_Col"]
          ? "PP"
          : Object.keys(grossPremiumVars).find(
              (k) =>
                !k.startsWith("NNX_") &&
                k !== "BPV" &&
                k !== "BPV_Mortality" &&
                k !== "MMX" &&
                k !== "BPV_Col" &&
                k !== "MMX_Col" &&
                k !== "GP" &&
                k !== "m" &&
                k !== "n" &&
                !k.endsWith("_Col") &&
                !additionalVars?.[k] &&
                !availableColumns.includes(k) // Exclude table columns
            ) || "PP";
      if (grossPremiumVars[ppName] !== undefined && !ppName.endsWith("_Col")) {
        vars.push(ppName);
      }
      // GP (Gross Premium result) - exclude if it ends with _Col
      if (grossPremiumVars["GP"] !== undefined && !grossPremiumVars["GP_Col"]) {
        vars.push("GP");
      }
    }
    return vars;
  }, [grossPremiumVars, additionalVars, availableColumns]);

  const additionalVarKeys = useMemo(() => {
    if (additionalVars) {
      return Object.keys(additionalVars);
    }
    return [];
  }, [additionalVars]);

  const handleFormula1Change = (value: string) => {
    onParametersChange({
      ...parameters,
      formulaForPaymentTermOrLess: value,
    });
  };

  const handleFormula2Change = (value: string) => {
    onParametersChange({
      ...parameters,
      formulaForGreaterThanPaymentTerm: value,
    });
  };

  const handleReserveColumnNameChange = (value: string) => {
    onParametersChange({ ...parameters, reserveColumnName: value });
  };

  const insertToken = (
    token: string,
    targetFormula: "formula1" | "formula2"
  ) => {
    const textarea =
      targetFormula === "formula1" ? formula1Ref.current : formula2Ref.current;
    const currentFormula =
      targetFormula === "formula1"
        ? formulaForPaymentTermOrLess
        : formulaForGreaterThanPaymentTerm;

    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = currentFormula || "";
      const newText = text.substring(0, start) + token + text.substring(end);

      if (targetFormula === "formula1") {
        handleFormula1Change(newText);
      } else {
        handleFormula2Change(newText);
      }

      setTimeout(() => {
        textarea.focus();
        const newCursorPos = start + token.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    } else {
      if (targetFormula === "formula1") {
        handleFormula1Change((currentFormula || "") + token);
      } else {
        handleFormula2Change((currentFormula || "") + token);
      }
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    targetFormula: "formula1" | "formula2"
  ) => {
    if (e.key === "Backspace") {
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentFormula =
        targetFormula === "formula1"
          ? formulaForPaymentTermOrLess
          : formulaForGreaterThanPaymentTerm;
      const text = currentFormula || "";

      if (start === end && start > 0) {
        if (text[start - 1] === "]") {
          const openBracketIndex = text.lastIndexOf("[", start - 1);
          if (openBracketIndex !== -1) {
            const token = text.substring(openBracketIndex, start);
            if (token.length > 2) {
              e.preventDefault();
              const newText =
                text.substring(0, openBracketIndex) + text.substring(start);
              if (targetFormula === "formula1") {
                handleFormula1Change(newText);
              } else {
                handleFormula2Change(newText);
              }

              setTimeout(() => {
                if (targetFormula === "formula1" && formula1Ref.current) {
                  formula1Ref.current.focus();
                  formula1Ref.current.setSelectionRange(
                    openBracketIndex,
                    openBracketIndex
                  );
                } else if (
                  targetFormula === "formula2" &&
                  formula2Ref.current
                ) {
                  formula2Ref.current.focus();
                  formula2Ref.current.setSelectionRange(
                    openBracketIndex,
                    openBracketIndex
                  );
                }
              }, 0);
            }
          }
        }
      }
    }
  };

  if (!grossPremiumOutput) {
    return (
      <p className="text-sm text-gray-500">
        Connect 'Gross Premium Calculator' to see variables and table columns.
      </p>
    );
  }

  return (
    <div className="space-y-4 w-full">
      <div>
        <h4 className="text-xs text-gray-400 font-bold mb-3">
          Reserve Calculator
        </h4>

        {/* Reserve Column Name Input */}
        <div className="mb-4">
          <PropertyInput
            label="Reserve Column Name"
            value={reserveColumnName}
            onChange={handleReserveColumnNameChange}
            placeholder="Reserve"
          />
        </div>

        {/* Main Layout: Left (Input Variables) and Right (Formulas) */}
        <div className="flex gap-6 w-full">
          {/* Left Side: Input Variables */}
          <div className="w-2/5 flex flex-col gap-4">
            {/* Premium Variables */}
            {premiumComponentVars.length > 0 && (
              <div className="flex-1 bg-gray-900/50 p-3 rounded-md border border-gray-600">
                <label className="block text-xs text-gray-400 font-bold mb-2">
                  Premium Variables
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-[200px] overflow-y-auto panel-scrollbar">
                  {premiumComponentVars.map((k) => (
                    <button
                      key={k}
                      onClick={() => insertToken(`[${k}]`, activeFormula)}
                      className={
                        k === "BPV_Mortality" || k === "BPV" || k === "MMX" || k === "PP" || k === "GP"
                          ? "bg-green-600 hover:bg-green-500 text-xs font-mono px-2.5 py-1.5 rounded-md transition-colors shadow-sm border border-white/10"
                          : "bg-blue-600 hover:bg-blue-500 text-xs font-mono px-2.5 py-1.5 rounded-md transition-colors shadow-sm border border-white/10"
                      }
                      title={`Insert [${k}]`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Additional Variables */}
            {additionalVarKeys.length > 0 && (
              <div className="flex-1 bg-gray-900/50 p-3 rounded-md border border-gray-600">
                <label className="block text-xs text-gray-400 font-bold mb-2">
                  Additional Variables
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-[200px] overflow-y-auto panel-scrollbar">
                  {additionalVarKeys.map((k) => (
                    <button
                      key={k}
                      onClick={() => insertToken(`[${k}]`, activeFormula)}
                      className="bg-amber-600 hover:bg-amber-500 text-xs font-mono px-2.5 py-1.5 rounded-md transition-colors shadow-sm border border-white/10"
                      title={`Insert [${k}]`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Table Columns */}
            {availableColumns.length > 0 && (
              <div className="flex-1 bg-gray-900/50 p-3 rounded-md border border-gray-600">
                <label className="block text-xs text-gray-400 font-bold mb-2">
                  Table Columns
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-[200px] overflow-y-auto panel-scrollbar">
                  {availableColumns.map((col) => (
                    <button
                      key={col}
                      onClick={() => insertToken(`[${col}]`, activeFormula)}
                      className="px-2.5 py-1.5 bg-gray-600 hover:bg-gray-500 rounded-md text-xs text-gray-200 whitespace-nowrap transition-colors"
                      title={`Insert [${col}]`}
                    >
                      {col}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Policy Variables */}
            {policyInfo && (
              <div className="bg-gray-900/50 p-3 rounded-md border border-gray-600">
                <label className="block text-xs text-gray-400 font-bold mb-2">
                  Policy Variables
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => insertToken("[m]", activeFormula)}
                    className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-md text-xs text-gray-200 whitespace-nowrap transition-colors"
                    title="Payment Term"
                  >
                    m
                  </button>
                  <button
                    onClick={() => insertToken("[n]", activeFormula)}
                    className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-md text-xs text-gray-200 whitespace-nowrap transition-colors"
                    title="Policy Term"
                  >
                    n
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Side: Two Formulas (top and bottom) */}
          <div className="w-3/5 flex flex-col gap-4">
            {/* Top Formula: Payment Term or Less */}
            <div className="flex-1 bg-gray-900/50 p-3 rounded-md border border-gray-600">
              <label className="block text-xs text-gray-400 font-bold mb-2">
                Formula for Payment Term ≤ m
              </label>
              <textarea
                ref={formula1Ref}
                value={formulaForPaymentTermOrLess || ""}
                onChange={(e) => handleFormula1Change(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, "formula1")}
                onFocus={() => setActiveFormula("formula1")}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2 min-h-[140px] resize-none"
                placeholder="e.g. [GP] * [Age]"
              />
            </div>

            {/* Copy Button */}
            <div className="flex justify-center">
              <button
                onClick={() => {
                  if (formulaForPaymentTermOrLess) {
                    handleFormula2Change(formulaForPaymentTermOrLess);
                    setTimeout(() => {
                      if (formula2Ref.current) {
                        formula2Ref.current.focus();
                      }
                    }, 0);
                  }
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-md transition-colors flex items-center gap-2"
                title="Copy formula from above to below"
              >
                <span>↓</span>
                <span>Copy Formula</span>
                <span>↓</span>
              </button>
            </div>

            {/* Bottom Formula: Greater than Payment Term */}
            <div className="flex-1 bg-gray-900/50 p-3 rounded-md border border-gray-600">
              <label className="block text-xs text-gray-400 font-bold mb-2">
                Formula for Payment Term &gt; m
              </label>
              <textarea
                ref={formula2Ref}
                value={formulaForGreaterThanPaymentTerm || ""}
                onChange={(e) => handleFormula2Change(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, "formula2")}
                onFocus={() => setActiveFormula("formula2")}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2 min-h-[140px] resize-none"
                placeholder="e.g. [GP] * 0.5"
              />
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-500 mt-4">
          조건문 지원: IF(condition, true_value, false_value) 형식을 사용할 수
          있습니다. 예: IF([Age] &gt; 50, [GP] * 1.1, [GP])
        </p>
      </div>
    </div>
  );
};

const RateModifierParams: React.FC<{
  parameters: Record<string, any>;
  onParametersChange: (newParams: Record<string, any>) => void;
  allModules: CanvasModule[];
  allConnections: Connection[];
  moduleId: string;
}> = ({
  parameters,
  onParametersChange,
  allModules,
  allConnections,
  moduleId,
}) => {
  const { calculations = [] } = parameters;
  const dataSource = getConnectedDataSource(
    moduleId,
    "data_in",
    allModules,
    allConnections
  );
  const availableColumns = dataSource?.columns.map((c) => c.name) || [];

  const formulaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());

  const updateCalculations = (newCalculations: any[]) => {
    onParametersChange({ calculations: newCalculations });
  };

  const handleAddCalculation = () => {
    const newCalc = {
      id: `rate-mod-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      newColumnName: "",
      formula: "",
    };
    updateCalculations([...calculations, newCalc]);
  };

  const handleRemoveCalculation = (id: string) => {
    updateCalculations(calculations.filter((c: any) => c.id !== id));
    if (formulaRefs.current.has(id)) formulaRefs.current.delete(id);
  };

  const handleUpdateCalculation = (id: string, field: string, value: any) => {
    updateCalculations(
      calculations.map((c: any) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const insertToken = (calcId: string, token: string) => {
    const textarea = formulaRefs.current.get(calcId);
    const calc = calculations.find((c: any) => c.id === calcId);
    if (textarea && calc) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = calc.formula || "";
      const newText = text.substring(0, start) + token + text.substring(end);

      handleUpdateCalculation(calcId, "formula", newText);

      setTimeout(() => {
        textarea.focus();
        const newCursorPos = start + token.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    } else if (calc) {
      handleUpdateCalculation(calcId, "formula", (calc.formula || "") + token);
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    calcId: string
  ) => {
    if (e.key === "Backspace") {
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const calc = calculations.find((c: any) => c.id === calcId);
      const text = calc?.formula || "";

      if (start === end && start > 0) {
        if (text[start - 1] === "]") {
          const openBracketIndex = text.lastIndexOf("[", start - 1);
          if (openBracketIndex !== -1) {
            const token = text.substring(openBracketIndex, start);
            if (token.length > 2) {
              e.preventDefault();
              const newText =
                text.substring(0, openBracketIndex) + text.substring(start);
              handleUpdateCalculation(calcId, "formula", newText);

              setTimeout(() => {
                if (textarea) {
                  textarea.focus();
                  textarea.setSelectionRange(
                    openBracketIndex,
                    openBracketIndex
                  );
                }
              }, 0);
            }
          }
        }
      }
    }
  };

  const renderPreview = (formula: string) => {
    if (!formula) return null;
    const parts = formula.split(/(\[[^\]]+\])/g);
    return (
      <div className="mt-2 p-2 bg-gray-800 rounded border border-gray-700 flex flex-wrap gap-1 items-center font-mono text-xs">
        <span className="text-gray-500 text-[10px] w-full uppercase font-bold mb-1">
          Live Preview
        </span>
        {parts.map((part, i) => {
          if (part.startsWith("[") && part.endsWith("]")) {
            return (
              <span
                key={i}
                className="bg-blue-600 px-1.5 py-0.5 rounded text-xs shadow-sm text-white"
              >
                {part}
              </span>
            );
          }
          if (!part) return null;
          return (
            <span key={i} className="text-gray-300">
              {part}
            </span>
          );
        })}
      </div>
    );
  };

  if (!dataSource)
    return (
      <p className="text-sm text-gray-500">Connect and run a data source.</p>
    );

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-xs text-gray-400 font-bold mb-2">
          Rate Modifications
        </h4>
        <div className="space-y-4">
          {calculations.map((calc: any) => (
            <div
              key={calc.id}
              className="bg-gray-900/50 p-3 rounded-md border border-gray-600 relative flex flex-col gap-3"
            >
              <button
                onClick={() => handleRemoveCalculation(calc.id)}
                className="absolute top-1.5 right-1.5 text-gray-500 hover:text-white"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>

              <PropertyInput
                label="New Column Name"
                value={calc.newColumnName}
                onChange={(v) =>
                  handleUpdateCalculation(calc.id, "newColumnName", v)
                }
              />

              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Formula
                </label>
                <textarea
                  ref={(el) => {
                    if (el) formulaRefs.current.set(calc.id, el);
                    else formulaRefs.current.delete(calc.id);
                  }}
                  value={calc.formula}
                  onChange={(e) =>
                    handleUpdateCalculation(calc.id, "formula", e.target.value)
                  }
                  onKeyDown={(e) => handleKeyDown(e, calc.id)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2 min-h-[80px]"
                  placeholder="e.g. [Male_Cancer] * 0.9"
                />
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto panel-scrollbar bg-gray-800 p-1 rounded mb-2">
                  <span className="text-xs text-gray-500 w-full mb-1">
                    Click to add variable:
                  </span>
                  {availableColumns.map((col) => (
                    <button
                      key={col}
                      onClick={() => insertToken(calc.id, `[${col}]`)}
                      className="px-2 py-0.5 bg-gray-600 hover:bg-gray-500 rounded text-xs text-gray-200 whitespace-nowrap"
                    >
                      {col}
                    </button>
                  ))}
                  <button
                    onClick={() => insertToken(calc.id, "[PaymentTerm]")}
                    className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 rounded text-xs text-gray-200 whitespace-nowrap"
                    title="Payment Term from Policy Info"
                  >
                    PaymentTerm
                  </button>
                  <button
                    onClick={() => insertToken(calc.id, "[PolicyTerm]")}
                    className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 rounded text-xs text-gray-200 whitespace-nowrap"
                    title="Policy Term from Policy Info"
                  >
                    PolicyTerm
                  </button>
                </div>
                {renderPreview(calc.formula)}
              </div>
            </div>
          ))}
          <button
            onClick={handleAddCalculation}
            className="w-full px-3 py-2 text-sm bg-blue-600/80 hover:bg-blue-600 rounded-md font-semibold"
          >
            Add Modification Rule
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          조건문 지원: IF(condition, true_value, false_value) 형식을 사용할 수
          있습니다. 예: IF([Age] &gt; 50, [Value] * 1.1, [Value])
        </p>
      </div>
    </div>
  );
};

const CalculateSurvivorsParams: React.FC<{
  parameters: Record<string, any>;
  onParametersChange: (newParams: Record<string, any>) => void;
  allModules: CanvasModule[];
  allConnections: Connection[];
  moduleId: string;
}> = ({
  parameters,
  onParametersChange,
  allModules,
  allConnections,
  moduleId,
}) => {
  const { ageColumn, mortalityColumn, calculations, addFixedLx } = parameters;
  const [selectedRates, setSelectedRates] = useState<Record<string, string>>(
    {}
  );

  const dataSource = getConnectedDataSource(
    moduleId,
    "data_in",
    allModules,
    allConnections
  );
  const numericColumns =
    dataSource?.columns
      .filter(
        (c) =>
          c.type === "number" && c.name !== "i_prem" && c.name !== "i_claim"
      )
      .map((c) => c.name) || [];
  const columnOptions = ["None", ...numericColumns];

  useEffect(() => {
    setSelectedRates((prevRates) => {
      const newRates: Record<string, string> = {};
      (calculations || []).forEach((calc: any) => {
        // If decrementRates has "Male_Mortality", set it as selected rate
        // This allows the tag to display the combobox value
        if (calc.decrementRates && calc.decrementRates.includes("Male_Mortality")) {
          newRates[calc.id] = "Male_Mortality";
        } else {
          newRates[calc.id] = prevRates[calc.id] || "";
        }
      });
      return newRates;
    });
  }, [calculations]);

  const updateCalculations = (newCalculations: any[]) => {
    onParametersChange({ ...parameters, calculations: newCalculations });
  };

  const handleAddCalculation = () => {
    const newCalcId = `calc-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;
    const newCalc = {
      id: newCalcId,
      name: "",
      decrementRates: [],
    };
    updateCalculations([...(calculations || []), newCalc]);
  };

  const handleAddFixedCalculation = () => {
    const newCalcId = `calc-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;
    const newCalc = {
      id: newCalcId,
      name: "Fixed",
      fixedValue: 100000,
    };
    updateCalculations([...(calculations || []), newCalc]);
  };

  const handleToggleCalcType = (id: string) => {
    const newCalculations = (calculations || []).map((calc: any) => {
      if (calc.id !== id) return calc;
      if (calc.fixedValue !== undefined) {
        // 고정값 → 감소율
        const { fixedValue, ...rest } = calc;
        return { ...rest, decrementRates: [] };
      } else {
        // 감소율 → 고정값
        const { decrementRates, ...rest } = calc;
        return { ...rest, fixedValue: 100000, name: calc.name || "Fixed" };
      }
    });
    updateCalculations(newCalculations);
  };

  const handleFixedValueChange = (id: string, value: number) => {
    const newCalculations = (calculations || []).map((calc: any) =>
      calc.id === id ? { ...calc, fixedValue: value } : calc
    );
    updateCalculations(newCalculations);
  };

  const handleFixedNameChange = (id: string, name: string) => {
    const newCalculations = (calculations || []).map((calc: any) =>
      calc.id === id ? { ...calc, name } : calc
    );
    updateCalculations(newCalculations);
  };

  const handleRemoveCalculation = (id: string) => {
    updateCalculations((calculations || []).filter((c: any) => c.id !== id));
  };

  const handleAddRateToCalc = (id: string) => {
    const rateToAdd = selectedRates[id];
    if (!rateToAdd) return;

    const newCalculations = (calculations || []).map((calc: any) => {
      if (calc.id === id && !(calc.decrementRates || []).includes(rateToAdd)) {
        const newRates = [...(calc.decrementRates || []), rateToAdd];
        const autoName = newRates.join("_");
        const oldAutoName = (calc.decrementRates || []).join("_");
        // 사용자가 이름을 직접 편집하지 않은 경우(현재 이름이 자동생성과 같거나 비어있으면)만 자동 업데이트
        const shouldAutoUpdate = !calc.name || calc.name === oldAutoName;
        return {
          ...calc,
          name: shouldAutoUpdate ? autoName : calc.name,
          decrementRates: newRates,
        };
      }
      return calc;
    });
    updateCalculations(newCalculations);

    setSelectedRates((prev) => ({
      ...prev,
      [id]: "",
    }));
  };

  const handleRemoveRateFromCalc = (id: string, rate: string) => {
    const newCalculations = (calculations || []).map((calc: any) => {
      if (calc.id === id) {
        const newRates = (calc.decrementRates || []).filter(
          (r: string) => r !== rate
        );
        const autoName = (calc.decrementRates || []).join("_");
        const shouldAutoUpdate = !calc.name || calc.name === autoName;
        return {
          ...calc,
          name: shouldAutoUpdate ? newRates.join("_") : calc.name,
          decrementRates: newRates,
        };
      }
      return calc;
    });
    updateCalculations(newCalculations);
  };

  return (
    <>
      {/* Checkbox for adding fixed lx column */}
      <div className="mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={addFixedLx || false}
            onChange={(e) =>
              onParametersChange({
                ...parameters,
                addFixedLx: e.target.checked,
              })
            }
            className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-gray-300">
            lx 추가: 경과기간 동안 100,000 고정
          </span>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <PropertySelect
          label="Age Column"
          value={ageColumn || "None"}
          onChange={(v) => onParametersChange({ ...parameters, ageColumn: v })}
          options={columnOptions}
        />
        <PropertySelect
          label="Mortality Rate Column"
          value={mortalityColumn || "None"}
          onChange={(v) =>
            onParametersChange({ ...parameters, mortalityColumn: v })
          }
          options={columnOptions}
        />
      </div>

      <div>
        <h4 className="text-xs text-gray-400 font-bold mb-2">
          Survivors (lx) Calculations
        </h4>
        {numericColumns.length > 0 ? (
          <div className="space-y-2">
            <div className="flex flex-col space-y-2">
              {(calculations || []).map((calc: any) => {
                const isFixed = calc.fixedValue !== undefined;
                const availableRates = numericColumns.filter(
                  (c) =>
                    c !== ageColumn && !(calc.decrementRates || []).includes(c)
                );
                const lxColName = calc.name ? `lx_${calc.name}` : 'lx';
                const dxColName = calc.name ? `Dx_${calc.name}` : 'Dx';
                return (
                  <div
                    key={calc.id}
                    className="bg-gray-900/50 p-3 rounded-md border border-gray-600 relative flex flex-col gap-2"
                  >
                    <button
                      onClick={() => handleRemoveCalculation(calc.id)}
                      className="absolute top-1.5 right-1.5 text-gray-500 hover:text-white z-10"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>

                    {/* 타입 토글 */}
                    <div className="flex items-center gap-1.5 mb-1">
                      <button
                        onClick={() => handleToggleCalcType(calc.id)}
                        className={`px-2 py-0.5 rounded text-xs font-medium ${!isFixed ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                      >감소율</button>
                      <button
                        onClick={() => handleToggleCalcType(calc.id)}
                        className={`px-2 py-0.5 rounded text-xs font-medium ${isFixed ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                      >고정값</button>
                    </div>

                    {isFixed ? (
                      /* ── 고정값 UI */
                      <div className="flex items-center gap-2 w-full">
                        {/* 출력 열 이름 */}
                        <div className="flex items-center bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm h-[38px] flex-shrink-0">
                          <span className="text-gray-400 mr-1">출력:</span>
                          <span className="text-gray-300 mr-0.5">lx</span>
                          {calc.name && calc.name !== 'Fixed' && (
                            <span className="text-gray-400">_{calc.name}</span>
                          )}
                        </div>
                        <span className="text-gray-500 text-sm">=</span>
                        {/* 고정값 입력 */}
                        <div className="flex items-center bg-gray-700 border border-emerald-700 rounded px-2 py-1.5 text-sm h-[38px]">
                          <span className="text-gray-400 mr-1">입력:</span>
                          <input
                            type="number"
                            value={calc.fixedValue}
                            onChange={(e) => handleFixedValueChange(calc.id, Number(e.target.value))}
                            className="w-28 bg-transparent focus:outline-none text-emerald-300 font-mono"
                          />
                        </div>
                        {/* 이름 편집 */}
                        <div className="flex items-center bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm h-[38px] flex-shrink-0">
                          <span className="text-gray-400 mr-1 text-xs">이름:</span>
                          <input
                            type="text"
                            value={calc.name === 'Fixed' ? '' : calc.name}
                            placeholder="(선택)"
                            onChange={(e) => handleFixedNameChange(calc.id, e.target.value || 'Fixed')}
                            className="w-20 bg-transparent focus:outline-none text-gray-300 text-xs"
                          />
                        </div>
                      </div>
                    ) : (
                      /* ── 감소율 UI */
                      <div className="flex items-center gap-2 w-full min-w-0">
                        <div
                          className="flex items-center bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm h-[38px] flex-shrink-0"
                          title={`출력 열 이름: ${lxColName}`}
                        >
                          <span className="text-gray-400">lx_</span>
                          <input
                            type="text"
                            placeholder="(자동생성)"
                            value={calc.name}
                            onChange={(e) => handleFixedNameChange(calc.id, e.target.value)}
                            className="w-32 bg-transparent focus:outline-none text-blue-300"
                          />
                        </div>

                        <div className="flex-grow bg-gray-700 p-1.5 rounded-md border border-gray-600 min-h-[38px] flex flex-wrap gap-1 content-start items-center min-w-0">
                          {(calc.decrementRates || []).length === 0 && (
                            <p className="text-xs text-gray-500 px-1">
                              Add decrement rates...
                            </p>
                          )}
                          {(calc.decrementRates || []).map((rate: string) => {
                            let displayValue = rate;
                            if (selectedRates[calc.id] && selectedRates[calc.id] === rate) {
                              displayValue = selectedRates[calc.id];
                            } else if (rate === "Mortality" && selectedRates[calc.id] === "Male_Mortality") {
                              displayValue = "Male_Mortality";
                            }
                            return (
                              <div
                                key={rate}
                                className="flex items-center gap-1 bg-blue-600/50 text-blue-100 px-2 py-0.5 rounded text-xs h-fit"
                              >
                                <span>{displayValue}</span>
                                <button
                                  onClick={() =>
                                    handleRemoveRateFromCalc(calc.id, rate)
                                  }
                                >
                                  <XMarkIcon className="w-3 h-3" />
                                </button>
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex gap-2 flex-shrink-0">
                          <select
                            value={selectedRates[calc.id] || ""}
                            onChange={(e) =>
                              setSelectedRates((prev) => ({
                                ...prev,
                                [calc.id]: e.target.value,
                              }))
                            }
                            className="w-40 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm h-[38px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={availableRates.length === 0}
                          >
                            <option value="" disabled>
                              -- Select Decrement Rate --
                            </option>
                            {availableRates.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleAddRateToCalc(calc.id)}
                            disabled={!selectedRates[calc.id]}
                            className="px-3 py-1.5 text-sm bg-gray-600 hover:bg-gray-500 rounded-md font-semibold whitespace-nowrap h-[38px] disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed"
                          >
                            Add Rate
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="text-[10px] text-gray-500">
                      →{" "}
                      <span className="text-blue-300">{lxColName}</span>
                      {!isFixed && (
                        <>, <span className="text-blue-300">{dxColName}</span></>
                      )}
                      {isFixed && (
                        <span className="ml-2 text-emerald-600">
                          (모든 행: {calc.fixedValue?.toLocaleString()})
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleAddCalculation}
                className="flex-1 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 rounded-md font-semibold"
              >
                + 감소율 lx 추가
              </button>
              <button
                onClick={handleAddFixedCalculation}
                className="flex-1 px-3 py-1.5 text-xs bg-emerald-700 hover:bg-emerald-600 rounded-md font-semibold"
              >
                + 고정값 lx 추가
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-500">
            Connect and run a data source to select risk rate columns.
          </p>
        )}
      </div>
    </>
  );
};

const ClaimsCalculatorParams: React.FC<{
  parameters: Record<string, any>;
  onParametersChange: (newParams: Record<string, any>) => void;
  allModules: CanvasModule[];
  allConnections: Connection[];
  moduleId: string;
}> = ({
  parameters,
  onParametersChange,
  allModules,
  allConnections,
  moduleId,
}) => {
  const { calculations } = parameters;
  const dataSource = getConnectedDataSource(
    moduleId,
    "data_in",
    allModules,
    allConnections
  );

  const numericColumns = React.useMemo(() => {
    if (!dataSource) return [];
    const excludedNames = [
      "age",
      "sex",
      "gender",
      "entryage",
      "i_prem",
      "i_claim",
    ];
    return dataSource.columns
      .filter(
        (c) =>
          c.type === "number" && !excludedNames.includes(c.name.toLowerCase())
      )
      .map((c) => c.name);
  }, [dataSource]);

  const lxOptions = useMemo(
    () => numericColumns.filter((c) => c.startsWith("lx_")),
    [numericColumns]
  );
  const riskOptions = useMemo(
    () =>
      numericColumns.filter(
        (c) => !c.startsWith("lx_") && !c.startsWith("Dx_")
      ),
    [numericColumns]
  );

  const updateCalculations = (newCalculations: any[]) => {
    onParametersChange({ calculations: newCalculations });
  };

  const handleAddCalculation = useCallback(() => {
    // Automatically select the first 'lx_' column as default if available
    const defaultLx = lxOptions.length > 0 ? lxOptions[0] : "";
    // Automatically select the first risk rate column as default
    const defaultRiskRate = riskOptions.length > 0 ? riskOptions[0] : "";

    const newCalc = {
      id: `claim-calc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      lxColumn: defaultLx,
      riskRateColumn: defaultRiskRate,
      name: defaultRiskRate, // Auto-set name from risk rate column
    };
    updateCalculations([...(calculations || []), newCalc]);
  }, [calculations, lxOptions, riskOptions]);

  const handleRemoveCalculation = (id: string) => {
    updateCalculations((calculations || []).filter((c: any) => c.id !== id));
  };

  const handleUpdateCalculation = (
    id: string,
    field: "lxColumn" | "riskRateColumn" | "name",
    value: string
  ) => {
    const newCalculations = (calculations || []).map((c: any) => {
      if (c.id === id) {
        const updatedCalc = { ...c, [field]: value };
        // riskRateColumn 변경 시 name이 비어있을 때만 자동 설정 (사용자 편집값 유지)
        if (field === "riskRateColumn" && !c.name) {
          updatedCalc.name = value;
        }
        return updatedCalc;
      }
      return c;
    });
    updateCalculations(newCalculations);
  };

  // Ensure at least one calculation exists by default
  // Wait for dataSource to be loaded before initializing
  // Also update existing calculations if they have empty or invalid values
  useEffect(() => {
    // Only proceed when dataSource is available and has columns
    if (!dataSource || riskOptions.length === 0 || lxOptions.length === 0) {
      return;
    }

    // If no calculations exist, create one with default values
    if (!calculations || calculations.length === 0) {
      const defaultLx = lxOptions[0];
      const defaultRiskRate = riskOptions[0];
      const newCalc = {
        id: `claim-calc-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 7)}`,
        lxColumn: defaultLx,
        riskRateColumn: defaultRiskRate,
        name: defaultRiskRate, // Auto-set name from risk rate column
      };
      updateCalculations([newCalc]);
      return;
    }

    // If calculations exist but have empty or invalid values, update them
    let hasInvalidCalc = false;
    const updatedCalculations = calculations.map((calc: any) => {
      // Check if lxColumn or riskRateColumn is empty or not in available options
      const hasValidLx = calc.lxColumn && lxOptions.includes(calc.lxColumn);
      const hasValidRiskRate =
        calc.riskRateColumn && riskOptions.includes(calc.riskRateColumn);

      // If either is invalid, update with default values
      if (!hasValidLx || !hasValidRiskRate) {
        hasInvalidCalc = true;
        return {
          ...calc,
          lxColumn: hasValidLx ? calc.lxColumn : lxOptions[0],
          riskRateColumn: hasValidRiskRate
            ? calc.riskRateColumn
            : riskOptions[0],
          name: hasValidRiskRate ? calc.riskRateColumn : riskOptions[0],
        };
      }
      return calc;
    });

    if (hasInvalidCalc) {
      updateCalculations(updatedCalculations);
    }
  }, [
    // React when dataSource becomes available or changes
    dataSource?.columns?.length || 0,
    // React when riskOptions or lxOptions become available
    riskOptions.join(","),
    lxOptions.join(","),
    // React when calculations change (but avoid infinite loop)
    calculations?.length || 0,
  ]);

  // name이 비어있는 기존 calculation에만 riskRateColumn으로 초기화 (사용자 편집값은 유지)
  useEffect(() => {
    if (!calculations || calculations.length === 0) return;
    if (!dataSource || riskOptions.length === 0) return;

    let hasChange = false;
    const updatedCalculations = calculations.map((calc: any) => {
      // 이름이 비어있을 때만 riskRateColumn으로 초기 설정
      if (!calc.name && calc.riskRateColumn) {
        hasChange = true;
        return { ...calc, name: calc.riskRateColumn };
      }
      return calc;
    });

    if (hasChange) {
      updateCalculations(updatedCalculations);
    }
  }, [riskOptions.join(","), dataSource?.columns?.length || 0]);

  if (!dataSource) {
    return (
      <p className="text-sm text-gray-500">
        Connect and run a data source to select columns.
      </p>
    );
  }

  return (
    <div>
      <h4 className="text-sm text-gray-400 font-bold mb-2">
        Claim (dx) and Commutation (Cx) Calculations
      </h4>
      <div className="space-y-2">
        {(calculations || []).map((calc: any) => (
          <div
            key={calc.id}
            className="bg-gray-900/50 p-3 rounded-md border border-gray-600 relative flex flex-col gap-2"
          >
            <button
              onClick={() => handleRemoveCalculation(calc.id)}
              className="absolute top-1.5 right-1.5 text-gray-500 hover:text-white"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>

            {/* 단일 행: [출력 이름 편집] ← [lx 콤보] [q 콤보] */}
            <div className="flex items-center gap-1.5 w-full">
              <div className="flex items-center bg-gray-700 border border-gray-600 rounded px-2 py-1 h-[32px] flex-shrink-0">
                <span className="text-gray-500 text-xs mr-0.5">dx_/Cx_</span>
                <input
                  type="text"
                  placeholder={calc.riskRateColumn || "이름"}
                  value={calc.name || ""}
                  onChange={(e) =>
                    handleUpdateCalculation(calc.id, "name", e.target.value)
                  }
                  className="w-24 bg-transparent focus:outline-none text-blue-300 text-xs font-mono"
                />
              </div>
              <span className="text-gray-500 text-xs shrink-0">←</span>
              <div className="flex-1 min-w-0">
                <PropertySelect
                  label="lx"
                  value={calc.lxColumn}
                  onChange={(v) => handleUpdateCalculation(calc.id, "lxColumn", v)}
                  options={lxOptions}
                  placeholder="lx..."
                  compact={true}
                />
              </div>
              <div className="flex-1 min-w-0">
                <PropertySelect
                  label="q (위험률)"
                  value={calc.riskRateColumn}
                  onChange={(v) => handleUpdateCalculation(calc.id, "riskRateColumn", v)}
                  options={riskOptions}
                  placeholder="rate..."
                  compact={true}
                />
              </div>
            </div>
            <div className="text-[10px] text-gray-500 pl-1">
              → <span className="text-blue-300">dx_{calc.name || calc.riskRateColumn || "?"}</span>
              {", "}
              <span className="text-blue-300">Cx_{calc.name || calc.riskRateColumn || "?"}</span>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={handleAddCalculation}
        className="w-full mt-2 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-500 rounded-md font-semibold"
      >
        Add Calculation
      </button>
    </div>
  );
};

const NxMxCalculatorParams: React.FC<{
  parameters: Record<string, any>;
  onParametersChange: (newParams: Record<string, any>) => void;
  allModules: CanvasModule[];
  allConnections: Connection[];
  moduleId: string;
}> = ({
  parameters,
  onParametersChange,
  allModules,
  allConnections,
  moduleId,
}) => {
  const dataSource = getConnectedDataSource(
    moduleId,
    "data_in",
    allModules,
    allConnections
  );
  const dxColumns = useMemo(
    () =>
      dataSource?.columns
        .filter((c) => c.name.startsWith("Dx_"))
        .map((c) => c.name) || [],
    [dataSource]
  );
  const cxColumns = useMemo(
    () =>
      dataSource?.columns
        .filter((c) => c.name.startsWith("Cx_"))
        .map((c) => c.name) || [],
    [dataSource]
  );

  const { nxCalculations = [], mxCalculations = [] } = parameters;

  const updateCalculations = (
    field: "nxCalculations" | "mxCalculations",
    newCalculations: any[]
  ) => {
    onParametersChange({ [field]: newCalculations });
  };

  // Auto-populate Nx calculations from ALL Dx columns
  // Add new Dx columns automatically when they appear
  useEffect(() => {
    if (dxColumns.length > 0) {
      const existingBase = new Set(
        nxCalculations.map((c: any) => c.baseColumn)
      );
      const missing = dxColumns.filter((c) => !existingBase.has(c));
      if (missing.length > 0) {
        const newCalcs = missing.map((col) => ({
          id: `nx-auto-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 7)}-${col}`,
          baseColumn: col,
          name: col.replace(/^Dx_/, ""),
          active: true,
        }));
        updateCalculations("nxCalculations", [...nxCalculations, ...newCalcs]);
      }
    }
  }, [dxColumns.join(",")]);

  // Auto-populate Mx calculations from Cx columns
  // Create calculations based on the number of Cx columns (1 Cx = 1 calculation)
  // Sync mxCalculations to match cxColumns exactly
  useEffect(() => {
    if (cxColumns.length > 0) {
      const existingBaseSet = new Set(
        mxCalculations.map((c: any) => c.baseColumn)
      );
      const cxColumnsSet = new Set(cxColumns);

      // Check if we need to update (if counts don't match or columns don't match)
      const needsUpdate =
        mxCalculations.length !== cxColumns.length ||
        cxColumns.some((col) => !existingBaseSet.has(col)) ||
        mxCalculations.some((calc: any) => !cxColumnsSet.has(calc.baseColumn));

      if (needsUpdate) {
        // Create exactly one calculation per Cx column
        const newCalcs = cxColumns.map((col, idx) => {
          // Try to preserve existing calculation if it exists
          const existing = mxCalculations.find(
            (c: any) => c.baseColumn === col
          );
          if (existing) {
            return existing;
          }
          // Create new calculation
          return {
            id: `mx-auto-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2, 7)}-${idx}`,
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
        updateCalculations("mxCalculations", newCalcs);
      }
    } else if (cxColumns.length === 0 && mxCalculations.length > 0) {
      // If Cx columns are removed, clear mxCalculations
      updateCalculations("mxCalculations", []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cxColumns.join(",")]);

  const handleAdd = (field: "nxCalculations" | "mxCalculations") => {
    const prefix = field === "nxCalculations" ? "nx" : "mx";
    const newCalc = {
      id: `${prefix}-calc-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)}`,
      baseColumn: "",
      name: "",
      active: true,
      ...(field === "mxCalculations" && {
        deductibleType: "0",
        customDeductible: 0,
        paymentRatios: [
          { year: 1, type: "100%", customValue: 100 },
          { year: 2, type: "100%", customValue: 100 },
          { year: 3, type: "100%", customValue: 100 },
        ],
      }),
    };
    updateCalculations(field, [
      ...(field === "nxCalculations" ? nxCalculations : mxCalculations),
      newCalc,
    ]);
  };

  const handleRemove = (field: string, id: string) => {
    const current =
      field === "nxCalculations" ? nxCalculations : mxCalculations;
    updateCalculations(
      field as "nxCalculations" | "mxCalculations",
      current.filter((c: any) => c.id !== id)
    );
  };

  const handleUpdate = (field: string, id: string, updatedValues: any) => {
    const current =
      field === "nxCalculations" ? nxCalculations : mxCalculations;
    const newCalcs = current.map((c: any) =>
      c.id === id ? { ...c, ...updatedValues } : c
    );
    updateCalculations(field as "nxCalculations" | "mxCalculations", newCalcs);
  };

  const handleUpdatePaymentRatio = (
    calcId: string,
    year: number,
    field: "type" | "customValue",
    value: any
  ) => {
    const calc = mxCalculations.find((c: any) => c.id === calcId);
    if (!calc) return;
    const newRatios = (calc.paymentRatios || []).map((r: any) =>
      r.year === year ? { ...r, [field]: value } : r
    );
    handleUpdate("mxCalculations", calcId, { paymentRatios: newRatios });
  };

  if (!dataSource)
    return (
      <p className="text-sm text-gray-500">Connect and run a data source.</p>
    );

  return (
    <div className="flex gap-6 min-w-0">
      {/* Nx Calculations */}
      <div className="flex-1 min-w-0">
        <h4 className="text-xs text-gray-400 font-bold mb-2">Nx Calculator</h4>
        <div className="space-y-2 max-h-[70vh] overflow-y-auto">
          {nxCalculations.map((calc: any) => (
            <div
              key={calc.id}
              className="bg-gray-900/50 px-2 py-1.5 rounded-md border border-gray-600"
            >
              {/* 단일 행: [출력 textbox] ← [Dx 콤보] [toggle] [삭제] */}
              <div className="flex items-center gap-1.5">
                {/* 출력 변수 textbox */}
                <div className="flex items-center gap-0.5 w-28 shrink-0">
                  <span className="text-[10px] text-gray-500 shrink-0">Nx_</span>
                  <input
                    className={`flex-1 min-w-0 bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-[11px] font-mono ${calc.active !== false ? "text-blue-300" : "text-gray-500"}`}
                    value={calc.name || calc.baseColumn.replace(/^Dx_/, "")}
                    onChange={(e) =>
                      handleUpdate("nxCalculations", calc.id, { name: e.target.value })
                    }
                  />
                </div>
                {/* 화살표 */}
                <span className="text-gray-500 text-xs shrink-0">←</span>
                {/* Dx 콤보박스 */}
                <div className="flex-1 min-w-0">
                  <PropertySelect
                    value={calc.baseColumn}
                    onChange={(v) =>
                      handleUpdate("nxCalculations", calc.id, {
                        baseColumn: v,
                        name: v.replace(/^Dx_/, ""),
                      })
                    }
                    options={dxColumns}
                    compact={true}
                  />
                </div>
                <ToggleSwitch
                  checked={calc.active !== false}
                  onChange={(val) =>
                    handleUpdate("nxCalculations", calc.id, { active: val })
                  }
                />
                <button
                  onClick={() => handleRemove("nxCalculations", calc.id)}
                  className="text-gray-500 hover:text-white shrink-0"
                >
                  <XMarkIcon className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={() => handleAdd("nxCalculations")}
            className="w-full px-3 py-1.5 text-xs bg-blue-600/80 hover:bg-blue-600 rounded-md font-semibold"
          >
            Add Nx Calculation
          </button>
        </div>
      </div>

      {/* Mx Calculations */}
      <div className="flex-1 min-w-0">
        <h4 className="text-xs text-gray-400 font-bold mb-2">Mx Calculator</h4>
        <div className="space-y-2 max-h-[70vh] overflow-y-auto">
          {mxCalculations.map((calc: any) => (
            <div
              key={calc.id}
              className="bg-gray-900/50 px-2 py-1.5 rounded-md border border-gray-600 space-y-1.5"
            >
              {/* 단일 행: [출력 textbox] ← [Cx 콤보] [toggle] [삭제] */}
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-0.5 w-28 shrink-0">
                  <span className="text-[10px] text-gray-500 shrink-0">Mx_</span>
                  <input
                    className={`flex-1 min-w-0 bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-[11px] font-mono ${calc.active !== false ? "text-blue-300" : "text-gray-500"}`}
                    value={calc.name || calc.baseColumn.replace(/^Cx_/, "")}
                    onChange={(e) =>
                      handleUpdate("mxCalculations", calc.id, { name: e.target.value })
                    }
                  />
                </div>
                <span className="text-gray-500 text-xs shrink-0">←</span>
                <div className="flex-1 min-w-0">
                  <PropertySelect
                    value={calc.baseColumn}
                    onChange={(v) =>
                      handleUpdate("mxCalculations", calc.id, {
                        baseColumn: v,
                        name: v.replace(/^Cx_/, ""),
                      })
                    }
                    options={cxColumns}
                    compact={true}
                  />
                </div>
                <ToggleSwitch
                  checked={calc.active !== false}
                  onChange={(val) =>
                    handleUpdate("mxCalculations", calc.id, { active: val })
                  }
                />
                <button
                  onClick={() => handleRemove("mxCalculations", calc.id)}
                  className="text-gray-500 hover:text-white shrink-0"
                >
                  <XMarkIcon className="w-3 h-3" />
                </button>
              </div>
              {/* 추가 설정: Waiting Period + Payment Schedule */}
              <div className="flex gap-2 items-start">
                <div className="flex-1">
                  <PropertySelect
                    label="Waiting Period"
                    value={calc.deductibleType}
                    onChange={(v) =>
                      handleUpdate("mxCalculations", calc.id, { deductibleType: v })
                    }
                    options={[
                      { label: "None (100%)", value: "0" },
                      { label: "25% Deductible", value: "0.25" },
                      { label: "50% Deductible", value: "0.5" },
                      { label: "Custom %", value: "custom" },
                    ]}
                    compact={true}
                  />
                  {calc.deductibleType === "custom" && (
                    <PropertyInput
                      label="Custom Deductible (0-1)"
                      type="number"
                      step="0.01"
                      value={calc.customDeductible}
                      onChange={(v) =>
                        handleUpdate("mxCalculations", calc.id, { customDeductible: v })
                      }
                      compact={true}
                    />
                  )}
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] text-gray-400 mb-1 font-bold">
                    Payment Schedule (First 3 Years)
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {(calc.paymentRatios || []).map((ratio: any) => (
                      <div key={ratio.year} className="bg-gray-800 p-1 rounded text-[10px]">
                        <div className="text-gray-500 mb-0.5 text-center">Y{ratio.year}</div>
                        <select
                          value={ratio.type}
                          onChange={(e) =>
                            handleUpdatePaymentRatio(calc.id, ratio.year, "type", e.target.value)
                          }
                          className="w-full bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-[10px] mb-0.5"
                        >
                          <option value="100%">100%</option>
                          <option value="50%">50%</option>
                          <option value="0%">0%</option>
                          <option value="Custom">Custom</option>
                        </select>
                        {ratio.type === "Custom" && (
                          <input
                            type="number"
                            value={ratio.customValue}
                            onChange={(e) =>
                              handleUpdatePaymentRatio(calc.id, ratio.year, "customValue", parseFloat(e.target.value))
                            }
                            className="w-full bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-[10px]"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
          <button
            onClick={() => handleAdd("mxCalculations")}
            className="w-full px-3 py-1.5 text-xs bg-blue-600/80 hover:bg-blue-600 rounded-md font-semibold"
          >
            Add Mx Calculation
          </button>
        </div>
      </div>
    </div>
  );
};

const PremiumComponentParams: React.FC<{
  parameters: Record<string, any>;
  onParametersChange: (newParams: Record<string, any>) => void;
  allModules: CanvasModule[];
  allConnections: Connection[];
  moduleId: string;
}> = ({
  parameters,
  onParametersChange,
  allModules,
  allConnections,
  moduleId,
}) => {
  const dataSource = getConnectedDataSource(
    moduleId,
    "data_in",
    allModules,
    allConnections
  );
  const nxColumns = useMemo(
    () =>
      dataSource?.columns
        .filter((c) => c.name.startsWith("Nx_"))
        .map((c) => c.name) || [],
    [dataSource]
  );
  const dxColumns = useMemo(
    () =>
      dataSource?.columns
        .filter((c) => c.name.startsWith("Dx_"))
        .map((c) => c.name) || [],
    [dataSource]
  );
  const mxColumns = useMemo(
    () =>
      dataSource?.columns
        .filter((c) => c.name.startsWith("Mx_"))
        .map((c) => c.name) || [],
    [dataSource]
  );

  const { nnxCalculations = [], sumxCalculations = [] } = parameters;

  const updateCalculations = (
    field: "nnxCalculations" | "sumxCalculations",
    newCalculations: any[]
  ) => {
    onParametersChange({ [field]: newCalculations });
  };

  // Auto populate
  useEffect(() => {
    if (nxColumns.length > 0 && nnxCalculations.length === 0) {
      const newCalcs = nxColumns.map((col) => ({
        id: `nnx-auto-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        nxColumn: col,
        dxColumn: "", // DX column will be selected by user
      }));
      updateCalculations("nnxCalculations", newCalcs);
    }
  }, [nxColumns.join(",")]);

  // Auto-populate BPV calculations from Mx columns
  // Sync sumxCalculations to match mxColumns exactly (1 Mx = 1 calculation)
  useEffect(() => {
    if (mxColumns.length > 0) {
      const existingBaseSet = new Set(
        sumxCalculations.map((c: any) => c.mxColumn)
      );
      const mxColumnsSet = new Set(mxColumns);

      // Check if we need to update (if counts don't match or columns don't match)
      const needsUpdate =
        sumxCalculations.length === 0 ||
        sumxCalculations.length !== mxColumns.length ||
        mxColumns.some((col) => !existingBaseSet.has(col)) ||
        sumxCalculations.some((calc: any) => !mxColumnsSet.has(calc.mxColumn));

      if (needsUpdate) {
        // Create exactly one calculation per Mx column
        const newCalcs = mxColumns.map((col, idx) => {
          // Try to preserve existing calculation if it exists
          const existing = sumxCalculations.find(
            (c: any) => c.mxColumn === col
          );
          if (existing) {
            return existing;
          }
          // Create new calculation
          return {
            id: `sumx-auto-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2, 7)}-${idx}`,
            mxColumn: col,
            amount: 10000, // Default amount
          };
        });
        updateCalculations("sumxCalculations", newCalcs);
      }
    } else if (mxColumns.length === 0 && sumxCalculations.length > 0) {
      // If Mx columns are removed, clear sumxCalculations
      updateCalculations("sumxCalculations", []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mxColumns.join(",")]);

  const handleAdd = (field: "nnxCalculations" | "sumxCalculations") => {
    const newCalc = {
      id: `${field === "nnxCalculations" ? "nnx" : "sumx"}-calc-${Date.now()}`,
      ...(field === "nnxCalculations"
        ? { nxColumn: "", dxColumn: "" }
        : { mxColumn: "", amount: 0 }),
    };
    updateCalculations(field, [
      ...(field === "nnxCalculations" ? nnxCalculations : sumxCalculations),
      newCalc,
    ]);
  };

  const handleRemove = (
    field: "nnxCalculations" | "sumxCalculations",
    id: string
  ) => {
    const current =
      field === "nnxCalculations" ? nnxCalculations : sumxCalculations;
    updateCalculations(
      field,
      current.filter((c: any) => c.id !== id)
    );
  };

  const handleUpdate = (
    field: "nnxCalculations" | "sumxCalculations",
    id: string,
    updatedValues: any
  ) => {
    const current =
      field === "nnxCalculations" ? nnxCalculations : sumxCalculations;
    const newCalcs = current.map((c: any) =>
      c.id === id ? { ...c, ...updatedValues } : c
    );
    updateCalculations(field, newCalcs);
  };

  if (!dataSource)
    return (
      <p className="text-sm text-gray-500">Connect and run a data source.</p>
    );

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-xs text-gray-400 font-bold mb-2">
          NNX Components (Annuity Factors)
        </h4>
        <p className="text-xs text-gray-500 mb-2">
          Each Nx selection will automatically generate 4 NNX versions: Year, Half, Quarter, Month
        </p>
        <div className="space-y-2">
          {nnxCalculations.map((calc: any) => (
            <div
              key={calc.id}
              className="bg-gray-900/50 px-2 py-1.5 rounded-md border border-gray-600 space-y-1"
            >
              {/* 단일 행: [NNX_base (고정 라벨)] ← [Nx 콤보] [Dx 콤보] [삭제] */}
              <div className="flex items-center gap-1.5">
                <div className="w-28 shrink-0">
                  <span className={`text-[11px] font-mono ${calc.nxColumn ? "text-blue-300" : "text-gray-500"}`}>
                    {calc.nxColumn
                      ? `NNX_${calc.nxColumn.replace(/^Nx_/, "")}`
                      : "NNX_?"}
                  </span>
                </div>
                <span className="text-gray-500 text-xs shrink-0">←</span>
                <div className="flex-1 min-w-0">
                  <PropertySelect
                    value={calc.nxColumn}
                    onChange={(v) =>
                      handleUpdate("nnxCalculations", calc.id, { nxColumn: v })
                    }
                    options={nxColumns}
                    placeholder="Nx"
                    compact={true}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <PropertySelect
                    value={calc.dxColumn || ""}
                    onChange={(v) =>
                      handleUpdate("nnxCalculations", calc.id, { dxColumn: v })
                    }
                    options={dxColumns}
                    placeholder="Dx (Half/Qtr/Month)"
                    compact={true}
                  />
                </div>
                <button
                  onClick={() => handleRemove("nnxCalculations", calc.id)}
                  className="text-gray-500 hover:text-white shrink-0"
                >
                  <XMarkIcon className="w-3 h-3" />
                </button>
              </div>
              {/* 아래: 생성되는 변수 표시 */}
              {calc.nxColumn && (
                <div className="text-[10px] text-gray-500 pl-1">
                  {(() => {
                    const base = calc.nxColumn.replace(/^Nx_/, "");
                    return `→ NNX_${base}(Year), NNX_${base}(Half), NNX_${base}(Quarter), NNX_${base}(Month)`;
                  })()}
                </div>
              )}
            </div>
          ))}
          <button
            onClick={() => handleAdd("nnxCalculations")}
            className="w-full px-3 py-1.5 text-xs bg-blue-600/80 hover:bg-blue-600 rounded-md"
          >
            Add NNX
          </button>
        </div>
      </div>

      <div>
        <h4 className="text-xs text-gray-400 font-bold mb-2">
          BPV Components (Benefit Present Value)
        </h4>
        <div className="space-y-2">
          {sumxCalculations.map((calc: any) => (
            <div
              key={calc.id}
              className="bg-gray-900/50 px-2 py-1.5 rounded-md border border-gray-600 space-y-1"
            >
              {/* 단일 행: [BPV_name (고정 라벨)] ← [Mx 콤보] [Amount 입력] [삭제] */}
              <div className="flex items-center gap-1.5">
                <div className="w-28 shrink-0">
                  <span className={`text-[11px] font-mono ${calc.mxColumn ? "text-blue-300" : "text-gray-500"}`}>
                    {calc.mxColumn
                      ? `BPV_${calc.mxColumn.replace(/^Mx_/, "")}`
                      : "BPV_?"}
                  </span>
                </div>
                <span className="text-gray-500 text-xs shrink-0">←</span>
                <div className="flex-1 min-w-0">
                  <PropertySelect
                    value={calc.mxColumn}
                    onChange={(v) =>
                      handleUpdate("sumxCalculations", calc.id, { mxColumn: v })
                    }
                    options={mxColumns}
                    placeholder="Mx"
                    compact={true}
                  />
                </div>
                <div className="w-20 shrink-0">
                  <PropertyInput
                    label=""
                    type="number"
                    value={calc.amount}
                    onChange={(v) =>
                      handleUpdate("sumxCalculations", calc.id, { amount: v })
                    }
                    compact={true}
                  />
                </div>
                <button
                  onClick={() => handleRemove("sumxCalculations", calc.id)}
                  className="text-gray-500 hover:text-white shrink-0"
                >
                  <XMarkIcon className="w-3 h-3" />
                </button>
              </div>
              {/* 아래: 생성되는 변수 표시 */}
              {calc.mxColumn && (
                <div className="text-[10px] text-gray-500 pl-1">
                  {`→ BPV_${calc.mxColumn.replace(/^Mx_/, "")} = Diff(${calc.mxColumn}, n) × ${calc.amount ?? 10000}`}
                </div>
              )}
            </div>
          ))}
          <button
            onClick={() => handleAdd("sumxCalculations")}
            className="w-full px-3 py-1.5 text-xs bg-blue-600/80 hover:bg-blue-600 rounded-md"
          >
            Add BPV
          </button>
        </div>
      </div>
    </div>
  );
};

const ScenarioRunnerParams: React.FC<{
  parameters: Record<string, any>;
  onParametersChange: (newParams: Record<string, any>) => void;
  allModules: CanvasModule[];
}> = ({ parameters, onParametersChange, allModules }) => {
  const { scenarios = [] } = parameters;

  // Filter out relevant modules for targeting
  const targetableModules = allModules.filter((m) =>
    [ModuleType.DefinePolicyInfo, ModuleType.AdditionalName].includes(m.type)
  );

  const updateScenarios = (newScenarios: any[]) => {
    onParametersChange({ scenarios: newScenarios });
  };

  const handleAdd = () => {
    const newScenario = {
      id: `scen-${Date.now()}`,
      variableName: "ScenarioVar",
      targetModuleId: targetableModules[0]?.id || "",
      targetParameterName: "entryAge", // Default
      values: "10, 20, 30",
    };
    updateScenarios([...scenarios, newScenario]);
  };

  const handleRemove = (id: string) => {
    updateScenarios(scenarios.filter((s: any) => s.id !== id));
  };

  const handleUpdate = (id: string, field: string, value: any) => {
    updateScenarios(
      scenarios.map((s: any) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-900/20 border border-blue-800 p-3 rounded text-sm text-blue-200">
        Define variables to vary. The pipeline will run for every combination
        (Cartesian product).
      </div>
      {scenarios.map((scen: any) => (
        <div
          key={scen.id}
          className="bg-gray-900/50 p-3 rounded-md border border-gray-600 relative space-y-3"
        >
          <button
            onClick={() => handleRemove(scen.id)}
            className="absolute top-1.5 right-1.5 text-gray-500 hover:text-white"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>

          <PropertyInput
            label="Scenario Variable Name"
            value={scen.variableName}
            onChange={(v) => handleUpdate(scen.id, "variableName", v)}
            placeholder="e.g. Age"
          />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Target Module
              </label>
              <select
                value={scen.targetModuleId}
                onChange={(e) =>
                  handleUpdate(scen.id, "targetModuleId", e.target.value)
                }
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm"
              >
                <option value="" disabled>
                  Select Module
                </option>
                {targetableModules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <PropertyInput
              label="Param Name"
              value={scen.targetParameterName}
              onChange={(v) => handleUpdate(scen.id, "targetParameterName", v)}
              placeholder="e.g. entryAge"
            />
          </div>

          <PropertyInput
            label="Values (comma separated or range start-end)"
            value={scen.values}
            onChange={(v) => handleUpdate(scen.id, "values", v)}
            placeholder="e.g. 30, 40, 50 OR 30-60"
          />
        </div>
      ))}
      <button
        onClick={handleAdd}
        className="w-full px-3 py-2 text-sm bg-blue-600 hover:bg-blue-500 rounded-md font-semibold"
      >
        Add Scenario Variable
      </button>
    </div>
  );
};

export const renderParameterContent = (
  module: CanvasModule,
  onParametersChange: (newParams: Record<string, any>) => void,
  modules: CanvasModule[],
  connections: Connection[],
  folderHandle: FileSystemDirectoryHandle | null,
  compact: boolean = false
) => {
  switch (module.type) {
    case ModuleType.DefinePolicyInfo:
      return (
        <DefinePolicyInfoParams
          parameters={module.parameters}
          onParametersChange={onParametersChange}
          compact={compact}
        />
      );
    case ModuleType.LoadData:
      return (
        <LoadDataParams
          parameters={module.parameters}
          onParametersChange={onParametersChange}
          folderHandle={folderHandle}
          compact={compact}
        />
      );
    case ModuleType.SelectData:
      return (
        <SelectDataParams
          parameters={module.parameters}
          onParametersChange={onParametersChange}
          allModules={modules}
          allConnections={connections}
          moduleId={module.id}
          compact={compact}
        />
      );
    case ModuleType.RateModifier:
      return (
        <RateModifierParams
          parameters={module.parameters}
          onParametersChange={onParametersChange}
          allModules={modules}
          allConnections={connections}
          moduleId={module.id}
          compact={compact}
        />
      );
    case ModuleType.SelectRiskRates:
      return (
        <SelectRiskRatesParams
          parameters={module.parameters}
          onParametersChange={onParametersChange}
          allModules={modules}
          allConnections={connections}
          moduleId={module.id}
          compact={compact}
        />
      );
    case ModuleType.CalculateSurvivors:
      return (
        <CalculateSurvivorsParams
          parameters={module.parameters}
          onParametersChange={onParametersChange}
          allModules={modules}
          allConnections={connections}
          moduleId={module.id}
          compact={compact}
        />
      );
    case ModuleType.ClaimsCalculator:
      return (
        <ClaimsCalculatorParams
          parameters={module.parameters}
          onParametersChange={onParametersChange}
          allModules={modules}
          allConnections={connections}
          moduleId={module.id}
          compact={compact}
        />
      );
    case ModuleType.NxMxCalculator:
      return (
        <NxMxCalculatorParams
          parameters={module.parameters}
          onParametersChange={onParametersChange}
          allModules={modules}
          allConnections={connections}
          moduleId={module.id}
          compact={compact}
        />
      );
    case ModuleType.PremiumComponent:
      return (
        <PremiumComponentParams
          parameters={module.parameters}
          onParametersChange={onParametersChange}
          allModules={modules}
          allConnections={connections}
          moduleId={module.id}
          compact={compact}
        />
      );
    case ModuleType.AdditionalName:
      return (
        <AdditionalNameParams
          parameters={module.parameters}
          onParametersChange={onParametersChange}
          allModules={modules}
          allConnections={connections}
          moduleId={module.id}
          compact={compact}
        />
      );
    case ModuleType.NetPremiumCalculator:
      return (
        <NetPremiumCalculatorParams
          parameters={module.parameters}
          onParametersChange={onParametersChange}
          allModules={modules}
          allConnections={connections}
          moduleId={module.id}
          compact={compact}
        />
      );
    case ModuleType.GrossPremiumCalculator:
      return (
        <GrossPremiumCalculatorParams
          parameters={module.parameters}
          onParametersChange={onParametersChange}
          allModules={modules}
          allConnections={connections}
          moduleId={module.id}
          compact={compact}
        />
      );
    case ModuleType.ReserveCalculator:
      return (
        <ReserveCalculatorParams
          parameters={module.parameters}
          onParametersChange={onParametersChange}
          allModules={modules}
          allConnections={connections}
          moduleId={module.id}
          compact={compact}
        />
      );
    case ModuleType.ScenarioRunner:
      return (
        <ScenarioRunnerParams
          parameters={module.parameters}
          onParametersChange={onParametersChange}
          allModules={modules}
          compact={compact}
        />
      );
    default:
      return (
        <div className="text-gray-500 italic">
          No parameters available for this module type.
        </div>
      );
  }
};

export const ParameterInputModal: React.FC<ParameterInputModalProps> = ({
  module,
  onClose,
  updateModuleParameters,
  modules,
  connections,
  projectName,
  folderHandle,
  onRunModule,
  onModuleSaved,
}) => {
  const [isRunning, setIsRunning] = React.useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = React.useState(false);
  const [hasAppliedSavedDefaults, setHasAppliedSavedDefaults] = React.useState(false);
  const initialParametersRef = React.useRef<Record<string, any>>(
    JSON.parse(JSON.stringify(module.parameters))
  );
  // Additional Variables 모듈의 경우 원래 상태(status, outputData)를 저장
  const initialModuleStateRef = React.useRef<{
    status: any;
    outputData: any;
  } | null>(null);

  // 초기값과 현재값을 비교하여 실제 변경사항이 있는지 확인하는 함수
  // AdditionalName의 basicValues는 DefinePolicyInfo에서만 변경되므로 비교에서 제외
  const hasChanges = React.useCallback(() => {
    if (module.type === ModuleType.AdditionalName) {
      const { basicValues: _cv, ...currentRest } = module.parameters as any;
      const { basicValues: _iv, ...initialRest } = initialParametersRef.current as any;
      return JSON.stringify(currentRest) !== JSON.stringify(initialRest);
    }
    const current = JSON.stringify(module.parameters);
    const initial = JSON.stringify(initialParametersRef.current);
    return current !== initial;
  }, [module.parameters, module.type]);

  // 모듈이 열릴 때 저장된 기본값이 있으면 적용
  React.useEffect(() => {
    // Additional Variables 모듈의 경우 원래 상태 저장
    if (module.type === ModuleType.AdditionalName) {
      initialModuleStateRef.current = {
        status: module.status,
        outputData: module.outputData,
      };
    }
    
    const savedDefault = loadModuleDefault(module.type);
    if (savedDefault) {
      // 저장된 기본값을 현재 모듈에 적용
      updateModuleParameters(module.id, savedDefault);
      initialParametersRef.current = JSON.parse(JSON.stringify(savedDefault));
    } else {
      initialParametersRef.current = JSON.parse(JSON.stringify(module.parameters));
    }
    setHasAppliedSavedDefaults(true);
  }, [module.id, module.type, updateModuleParameters]);

  const handleParametersChange = (newParams: Record<string, any>) => {
    updateModuleParameters(module.id, newParams);
    // SelectData의 deathRateColumn이 변경되면 CalculateSurvivors의 mortalityColumn에 자동 반영
    if (module.type === ModuleType.SelectData && 'deathRateColumn' in newParams) {
      const deathRateCol = newParams.deathRateColumn as string;
      const survivorsMod = modules.find((m) => m.type === ModuleType.CalculateSurvivors);
      if (survivorsMod && deathRateCol) {
        updateModuleParameters(survivorsMod.id, { mortalityColumn: 'Death_Rate' });
      }
    }
  };

  const handleRun = async () => {
    if (onRunModule) {
      setIsRunning(true);
      try {
        handleSave();
        await onRunModule(module.id);
        // 실행 완료 후 닫기: 실행 결과(Success + outputData) 유지, Pending 리셋 건너뜀
        onClose(false, true);
      } finally {
        setIsRunning(false);
      }
    }
  };

  const handleSave = () => {
    // 현재 모듈의 parameters를 해당 모듈 타입의 기본값으로 저장
    saveModuleDefault(module.type, module.parameters);
    initialParametersRef.current = JSON.parse(JSON.stringify(module.parameters));
    // DSL 드래프트의 해당 섹션을 현재 파라미터 기준으로 동기화
    onModuleSaved?.(module.type, module.parameters);
  };

  const handleClose = () => {
    if (hasChanges()) {
      setShowCloseConfirm(true);
    } else {
      // 변경 없음 → 편집 전 상태 복원 (실행 결과 유지)
      onClose(true);
    }
  };

  const handleConfirmClose = (save: boolean) => {
    setShowCloseConfirm(false);
    if (save) {
      // 저장: 현재 변경사항 적용, 상태는 이미 Pending으로 변경되었으므로 그냥 닫기
      handleSave();
      onClose(false);
    } else {
      // 취소: 편집 전 상태 전체 복원 (params + status + outputData)
      onClose(true);
    }
  };

  const renderContent = () => {
    return renderParameterContent(
      module,
      handleParametersChange,
      modules,
      connections,
      folderHandle,
      false
    );
  };

  // Determine modal width based on module type
  const getModalWidthClass = () => {
    if (
      module.type === ModuleType.CalculateSurvivors ||
      module.type === ModuleType.NxMxCalculator
    ) {
      return "max-w-6xl"; // Wider for these modules
    }
    if (
      module.type === ModuleType.NetPremiumCalculator ||
      module.type === ModuleType.GrossPremiumCalculator ||
      module.type === ModuleType.ReserveCalculator
    ) {
      return "max-w-7xl"; // Extra wide for Premium Calculators and Reserve Calculator
    }
    return "max-w-lg"; // Default width
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleClose}
    >
      <div
        className={`bg-gray-800 text-white rounded-lg shadow-xl w-full ${getModalWidthClass()} max-h-[90vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
          <h2 className="text-xs font-bold">Edit Parameters: {module.name}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 rounded-md font-semibold text-white transition-colors"
              title="Save as default for this module type"
            >
              <BookmarkIcon className="h-3 w-3" />
              저장
            </button>
            {onRunModule && (
              <button
                onClick={handleRun}
                disabled={isRunning}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 hover:bg-green-500 rounded-md font-semibold text-white transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                title="Run this module"
              >
                <PlayIcon className="h-3 w-3" />
                {isRunning ? "Running..." : "Run"}
              </button>
            )}
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-white"
            >
              <XCircleIcon className="w-5 h-5" />
            </button>
          </div>
        </header>
        <main className="flex-grow p-4 overflow-auto custom-scrollbar">
          {renderContent()}
          {(() => {
            const fullDSL = generateDSL(projectName, modules);
            const section = extractModuleSection(fullDSL, module.type);
            if (!section) return null;
            return (
              <div className="mt-4 border-t border-gray-700 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-purple-300">DSL 섹션</span>
                  <span className="text-[10px] text-gray-500">저장 시 DSL 편집기에 반영됩니다</span>
                </div>
                <pre className="bg-gray-900 border border-gray-700 rounded p-3 text-xs text-green-300 font-mono whitespace-pre overflow-x-auto max-h-60 custom-scrollbar">
                  {section}
                </pre>
              </div>
            );
          })()}
        </main>
      </div>

      {/* Close Confirmation Dialog */}
      {showCloseConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60]">
          <div
            className="bg-gray-800 text-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-4">변경사항 저장 확인</h3>
            <p className="text-sm text-gray-300 mb-6">
              입력값이 변경되었습니다. 저장하지 않고 닫으시겠습니까?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => handleConfirmClose(false)}
                className="px-4 py-2 text-sm bg-gray-600 hover:bg-gray-500 rounded-md font-semibold text-white transition-colors"
              >
                저장 안 함
              </button>
              <button
                onClick={() => handleConfirmClose(true)}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 rounded-md font-semibold text-white transition-colors"
              >
                저장 후 닫기
              </button>
              <button
                onClick={() => setShowCloseConfirm(false)}
                className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded-md font-semibold text-white transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
