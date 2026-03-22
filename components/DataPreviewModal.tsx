import React, { useState, useMemo, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  CanvasModule,
  DataPreview,
  ScenarioRunnerOutput,
  PremiumComponentOutput,
} from "../types";
import {
  XCircleIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ArrowDownTrayIcon,
} from "./icons";

import { Connection } from "../types";
import { getConnectedDataSource } from "./ParameterInputModal";
import { SpreadViewModal } from "./SpreadViewModal";

interface DataPreviewModalProps {
  module: CanvasModule;
  projectName: string;
  onClose: () => void;
  allModules?: CanvasModule[];
  allConnections?: Connection[];
}

/** 열 이름 호버 툴팁: 계산 방법 팝업 */
const ColumnDescTooltip: React.FC<{ name: string; description?: string }> = ({ name, description }) => {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const thRef = React.useRef<HTMLDivElement>(null);

  if (!description) return <span className="truncate">{name}</span>;

  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPos({ x: rect.left, y: rect.bottom + 4 });
    setVisible(true);
  };

  return (
    <div
      ref={thRef}
      className="relative inline-flex items-center gap-1 cursor-help"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setVisible(false)}
    >
      <span className="truncate">{name}</span>
      <span className="text-blue-400 text-[10px] leading-none flex-shrink-0">ℹ</span>
      {visible && (
        <div
          className="fixed z-[9999] max-w-xs bg-gray-900 text-gray-100 text-xs rounded-lg shadow-2xl border border-gray-700 px-3 py-2 pointer-events-none"
          style={{ left: pos.x, top: pos.y, minWidth: 180 }}
        >
          <p className="font-semibold text-blue-300 mb-1">{name}</p>
          {description.split("\n").map((line, i) => (
            <p key={i} className={`leading-snug ${line.startsWith("공식:") || line.startsWith("📂") ? "text-yellow-300 font-mono" : "text-gray-300"}`}>
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

/** 모듈 이름 복사 버튼 (Ctrl+C 안내 포함) */
const CopyNameButton: React.FC<{ name: string }> = ({ name }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(name).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [name]);
  return (
    <button
      onClick={handleCopy}
      title="클릭하여 이름 복사 (Ctrl+C)"
      className="ml-2 p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0"
    >
      {copied ? (
        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );
};

type SortConfig = {
  key: string;
  direction: "ascending" | "descending";
} | null;

const ScatterPlot: React.FC<{
  rows: Record<string, any>[];
  xCol: string;
  yCol1: string;
  yCol2: string | null;
}> = ({ rows, xCol, yCol1, yCol2 }) => {
  const dataPoints1 = useMemo(() => {
    return rows
      .map((r) => ({ x: Number(r[xCol]), y: Number(r[yCol1]) }))
      .filter((p) => !isNaN(p.x) && !isNaN(p.y));
  }, [rows, xCol, yCol1]);

  const dataPoints2 = useMemo(() => {
    if (!yCol2) return [];
    return rows
      .map((r) => ({ x: Number(r[xCol]), y: Number(r[yCol2]) }))
      .filter((p) => !isNaN(p.x) && !isNaN(p.y));
  }, [rows, xCol, yCol2]);

  if (dataPoints1.length === 0 && dataPoints2.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        No valid data points for scatter plot.
      </div>
    );
  }

  const margin = { top: 40, right: 20, bottom: 40, left: 60 };
  const width = 600;
  const height = 400;

  const allPoints = [...dataPoints1, ...dataPoints2];
  const xMin = Math.min(...allPoints.map((d) => d.x));
  const xMax = Math.max(...allPoints.map((d) => d.x));
  const yMin = Math.min(...allPoints.map((d) => d.y));
  const yMax = Math.max(...allPoints.map((d) => d.y));

  const xScale = (x: number) =>
    margin.left +
    ((x - xMin) / (xMax - xMin || 1)) * (width - margin.left - margin.right);
  const yScale = (y: number) =>
    height -
    margin.bottom -
    ((y - yMin) / (yMax - yMin || 1)) * (height - margin.top - margin.bottom);

  const getTicks = (min: number, max: number, count: number) => {
    if (min === max) return [min];
    const ticks = [];
    const range = max - min;
    if (range === 0) return [min];
    const step = range / (count - 1);
    for (let i = 0; i < count; i++) {
      ticks.push(min + i * step);
    }
    return ticks;
  };

  const xTicks = getTicks(xMin, xMax, 5);
  const yTicks = getTicks(yMin, yMax, 5);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      <g transform={`translate(${margin.left}, 15)`} className="text-gray-600">
        <circle cx="0" cy="0" r="5" fill="#3b82f6" />
        <text x="10" y="4" fontSize="12">
          {yCol1}
        </text>
        {yCol2 && (
          <>
            <circle cx="120" cy="0" r="5" fill="#a855f7" />
            <text x="130" y="4" fontSize="12">
              {yCol2}
            </text>
          </>
        )}
      </g>

      <line
        x1={margin.left}
        y1={height - margin.bottom}
        x2={width - margin.right}
        y2={height - margin.bottom}
        stroke="currentColor"
        strokeWidth="1"
        className="text-gray-300"
      />
      <line
        x1={margin.left}
        y1={margin.top}
        x2={margin.left}
        y2={height - margin.bottom}
        stroke="currentColor"
        strokeWidth="1"
        className="text-gray-300"
      />
      {xTicks.map((tick, i) => (
        <g
          key={`x-${i}`}
          transform={`translate(${xScale(tick)}, ${height - margin.bottom})`}
        >
          <line
            y2="5"
            stroke="currentColor"
            strokeWidth="1"
            className="text-gray-300"
          />
          <text
            y="20"
            textAnchor="middle"
            fill="currentColor"
            fontSize="10"
            className="text-gray-500"
          >
            {tick.toFixed(0)}
          </text>
        </g>
      ))}
      <text
        x={width / 2}
        y={height - 5}
        textAnchor="middle"
        fill="currentColor"
        fontSize="12"
        fontWeight="bold"
        className="text-gray-600"
      >
        {xCol}
      </text>
      {yTicks.map((tick, i) => (
        <g
          key={`y-${i}`}
          transform={`translate(${margin.left}, ${yScale(tick)})`}
        >
          <line
            x2="-5"
            stroke="currentColor"
            strokeWidth="1"
            className="text-gray-300"
          />
          <text
            x="-10"
            y="3"
            textAnchor="end"
            fill="currentColor"
            fontSize="10"
            className="text-gray-500"
          >
            {tick.toExponential(1)}
          </text>
        </g>
      ))}
      <text
        transform={`translate(${20}, ${height / 2}) rotate(-90)`}
        textAnchor="middle"
        fill="currentColor"
        fontSize="12"
        fontWeight="bold"
        className="text-gray-600"
      >
        Value
      </text>

      {dataPoints1.map((p, i) => (
        <circle
          key={`p1-${i}`}
          cx={xScale(p.x)}
          cy={yScale(p.y)}
          r="3"
          fill="#3b82f6"
          opacity="0.7"
        />
      ))}
      {yCol2 &&
        dataPoints2.map((p, i) => (
          <circle
            key={`p2-${i}`}
            cx={xScale(p.x)}
            cy={yScale(p.y)}
            r="3"
            fill="#a855f7"
            opacity="0.7"
          />
        ))}
    </svg>
  );
};

// Format number preserving original format: integers as integers, decimals up to 6 places without trailing zeros
const formatNumberPreservingOriginal = (
  val: number,
  columnName?: string
): string => {
  // Handle special cases
  if (!isFinite(val)) {
    return val.toString();
  }

  // Check if it's an integer
  if (Number.isInteger(val)) {
    return val.toString();
  }

  // For i_prem and i_claim, use 8 decimal places
  const maxDecimals =
    columnName === "i_prem" || columnName === "i_claim" ? 8 : 6;

  // For decimals, preserve up to maxDecimals decimal places, remove trailing zeros
  // Use toFixed(maxDecimals) to ensure we get up to maxDecimals decimal places, then remove trailing zeros
  const fixed = val.toFixed(maxDecimals);
  // Remove trailing zeros and the decimal point if all zeros
  return fixed.replace(/\.?0+$/, "");
};

export const DataPreviewModal: React.FC<DataPreviewModalProps> = ({
  module,
  projectName,
  onClose,
  allModules = [],
  allConnections = [],
}) => {
  const getPreviewData = (): DataPreview | ScenarioRunnerOutput | null => {
    if (!module.outputData) return null;
    if (
      module.outputData.type === "DataPreview" ||
      module.outputData.type === "ScenarioRunnerOutput"
    )
      return module.outputData;
    if (
      module.outputData.type === "KMeansOutput" ||
      module.outputData.type === "HierarchicalClusteringOutput" ||
      module.outputData.type === "DBSCANOutput"
    ) {
      return module.outputData.clusterAssignments;
    }
    if (module.outputData.type === "PCAOutput") {
      return module.outputData.transformedData;
    }
    return null;
  };

  const data = getPreviewData();
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [activeTab, setActiveTab] = useState<"table" | "visualization">(
    "table"
  );

  // --- Special handling for NNX BPV Calculator Output ---
  if (module.outputData?.type === "PremiumComponentOutput") {
    const { nnxResults, bpvResults, mmxValue, data } = module.outputData;

    // Get input table data
    const inputTableData =
      allModules && allConnections
        ? getConnectedDataSource(
            module.id,
            "data_in",
            allModules,
            allConnections
          )
        : undefined;

    return (
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        onClick={onClose}
      >
        <div
          className="bg-white text-gray-900 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center min-w-0">
              <h2 className="text-xl font-bold text-gray-800">
                NNX BPV Calculator Output: {module.name}
              </h2>
              <CopyNameButton name={module.name} />
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-800 flex-shrink-0 ml-2"
            >
              <XCircleIcon className="w-6 h-6" />
            </button>
          </header>
          <main className="flex-grow p-6 overflow-auto space-y-8">
            {/* NNX Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-3 border-b pb-1">
                NNX Breakdown (Annuity Factors)
              </h3>
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="py-2 px-4 font-semibold text-gray-600">
                        Component
                      </th>
                      <th className="py-2 px-4 font-semibold text-gray-600 text-right">
                        Value
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(nnxResults).map(([key, value]) => (
                      <tr
                        key={key}
                        className="border-b border-gray-200 last:border-b-0"
                      >
                        <td className="py-2 px-4 font-medium text-gray-700">
                          {key}
                        </td>
                        <td className="py-2 px-4 font-mono text-right text-gray-700">
                          {formatNumberPreservingOriginal(Number(value))}
                        </td>
                      </tr>
                    ))}
                    {Object.keys(nnxResults).length === 0 && (
                      <tr>
                        <td
                          colSpan={2}
                          className="py-4 text-center text-gray-500"
                        >
                          No NNX results available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* BPV Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-3 border-b pb-1">
                BPV Breakdown (Benefit Present Value)
              </h3>
              <div className="overflow-x-auto border border-gray-200 rounded-lg mb-4">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="py-2 px-4 font-semibold text-gray-600">
                        Component (BPV)
                      </th>
                      <th className="py-2 px-4 font-semibold text-gray-600 text-right">
                        PV Value
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(bpvResults ?? {}).map(([key, value]) => (
                      <tr
                        key={key}
                        className="border-b border-gray-200 last:border-b-0"
                      >
                        <td className="py-2 px-4 font-medium text-gray-700">
                          {key}
                        </td>
                        <td className="py-2 px-4 font-mono text-right text-gray-700">
                          {formatNumberPreservingOriginal(Number(value))}
                        </td>
                      </tr>
                    ))}
                    {Object.keys(bpvResults ?? {}).length === 0 && (
                      <tr>
                        <td
                          colSpan={2}
                          className="py-4 text-center text-gray-500"
                        >
                          No BPV results available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg border border-blue-100">
                <span className="text-lg font-bold text-blue-800">
                  Total BPV
                </span>
                <span className="text-2xl font-mono font-black text-blue-700">
                  {formatNumberPreservingOriginal(mmxValue)}
                </span>
              </div>
            </div>

            {/* Enhanced Table Data with NNX and BPV columns */}
            {data && data.rows && (
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-3 border-b pb-1">
                  Enhanced Table Data (with NNX and BPV columns)
                </h3>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <div className="text-xs text-gray-500 mb-2 px-2">
                    Showing {Math.min(data.rows.length, 1000)} of{" "}
                    {data.totalRowCount.toLocaleString()} rows
                  </div>
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        {data.columns.map((col) => (
                          <th
                            key={col.name}
                            className={`py-2 px-3 font-semibold text-gray-600 ${
                              col.name.startsWith("NNX_") || col.name === "BPV_Col"
                                ? "bg-green-50"
                                : ""
                            }`}
                          >
                            {col.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.slice(0, 1000).map((row, idx) => (
                        <tr
                          key={idx}
                          className="border-b border-gray-200 hover:bg-gray-50"
                        >
                          {data.columns.map((col) => (
                            <td
                              key={col.name}
                              className={`py-1.5 px-3 text-gray-700 ${
                                col.name.startsWith("NNX_") ||
                                col.name === "BPV_Col"
                                  ? "bg-green-50/30 font-mono"
                                  : ""
                              }`}
                            >
                              {row[col.name] !== null &&
                              row[col.name] !== undefined
                                ? typeof row[col.name] === "number"
                                  ? formatNumberPreservingOriginal(
                                      row[col.name]
                                    )
                                  : String(row[col.name])
                                : "-"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {/* Fallback to input table if enhanced data not available */}
            {!data && inputTableData && inputTableData.rows && (
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-3 border-b pb-1">
                  Input Table Data
                </h3>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <div className="text-xs text-gray-500 mb-2 px-2">
                    Showing {Math.min(inputTableData.rows.length, 1000)} of{" "}
                    {inputTableData.totalRowCount.toLocaleString()} rows
                  </div>
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        {inputTableData.columns.map((col) => (
                          <th
                            key={col.name}
                            className="py-2 px-3 font-semibold text-gray-600"
                          >
                            {col.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {inputTableData.rows.slice(0, 1000).map((row, idx) => (
                        <tr
                          key={idx}
                          className="border-b border-gray-200 hover:bg-gray-50"
                        >
                          {inputTableData.columns.map((col) => (
                            <td
                              key={col.name}
                              className="py-1.5 px-3 text-gray-700"
                            >
                              {row[col.name] !== null &&
                              row[col.name] !== undefined
                                ? typeof row[col.name] === "number"
                                  ? formatNumberPreservingOriginal(
                                      row[col.name]
                                    )
                                  : String(row[col.name])
                                : "-"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    );
  }

  // --- Standard Data Preview ---
  const columns = data?.columns || [];
  const rows = data?.rows || [];

  const ageColumnName = useMemo(
    () =>
      columns.find(
        (c) =>
          c.name.toLowerCase() === "age" || c.name.toLowerCase() === "entryage"
      )?.name,
    [columns]
  );

  const visYAxisOptions = useMemo(
    () =>
      columns
        .filter(
          (c) =>
            c.type === "number" &&
            c.name.toLowerCase() !== "age" &&
            c.name.toLowerCase() !== "sex" &&
            c.name.toLowerCase() !== "gender" &&
            c.name.toLowerCase() !== "entryage"
        )
        .map((c) => c.name),
    [columns]
  );

  const [visYAxisCol, setVisYAxisCol] = useState<string | null>(null);
  const [visYAxisCol2, setVisYAxisCol2] = useState<string | null>(null);
  const [showSpreadView, setShowSpreadView] = useState(false);

  useEffect(() => {
    if (
      activeTab === "visualization" &&
      !visYAxisCol &&
      visYAxisOptions.length > 0
    ) {
      setVisYAxisCol(visYAxisOptions[0]);
    }
  }, [activeTab, visYAxisCol, visYAxisOptions]);

  const sortedRows = useMemo(() => {
    let sortableItems = [...rows];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;
        if (valA < valB) {
          return sortConfig.direction === "ascending" ? -1 : 1;
        }
        if (valA > valB) {
          return sortConfig.direction === "ascending" ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [rows, sortConfig]);

  const requestSort = (key: string) => {
    let direction: "ascending" | "descending" = "ascending";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "ascending"
    ) {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  const handleDownloadCSV = () => {
    if (!data || !data.columns || !data.rows) return;
    const header = data.columns.map((c) => c.name).join(",");
    const rows = data.rows
      .map((row) =>
        data.columns
          .map((col) => {
            const val = row[col.name];
            return val === null || val === undefined ? "" : String(val);
          })
          .join(",")
      )
      .join("\n");
    const csvContent = `data:text/csv;charset=utf-8,${header}\n${rows}`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `${module.name.replace(/\s+/g, "_")}_data.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // D-2: Excel 내보내기 (ScenarioRunner 및 일반 결과용)
  const handleDownloadExcel = () => {
    if (!data || !data.columns || !data.rows) return;
    const wsData = [
      data.columns.map((c) => c.name),
      ...data.rows.map((row) =>
        data.columns.map((col) => {
          const val = row[col.name];
          return val === null || val === undefined ? "" : val;
        })
      ),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, module.name.substring(0, 31));
    XLSX.writeFile(wb, `${module.name.replace(/\s+/g, "_")}_data.xlsx`);
  };

  if (!data) {
    return (
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        onClick={onClose}
      >
        <div
          className="bg-white p-6 rounded-lg shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-lg font-bold">No Data Available</h3>
          <p>The selected module has no previewable data.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white text-gray-900 rounded-lg shadow-xl w-full max-w-7xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center min-w-0 mr-2">
            <h2 className="text-xl font-bold text-gray-800">
              Data Preview: {module.name}
            </h2>
            <CopyNameButton name={module.name} />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSpreadView(true)}
              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
              Spread View
            </button>
            <button
              onClick={handleDownloadExcel}
              className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700 flex items-center gap-1"
              title="Excel 다운로드"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              Excel
            </button>
            <button
              onClick={handleDownloadCSV}
              className="text-gray-500 hover:text-gray-800 p-1 rounded hover:bg-gray-100"
              title="Download CSV"
            >
              <ArrowDownTrayIcon className="w-6 h-6" />
            </button>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-800"
            >
              <XCircleIcon className="w-6 h-6" />
            </button>
          </div>
        </header>
        <main className="flex-grow p-4 overflow-auto flex flex-col gap-4">
          <div className="flex-shrink-0 border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => setActiveTab("table")}
                className={`${
                  activeTab === "table"
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Data Table
              </button>
              <button
                onClick={() => setActiveTab("visualization")}
                className={`${
                  activeTab === "visualization"
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Visualization
              </button>
            </nav>
          </div>

          {activeTab === "table" && (
            <>
              <div className="flex justify-between items-center flex-shrink-0">
                <div className="text-sm text-gray-600">
                  Showing {Math.min(rows.length, 1000)} of{" "}
                  {data.totalRowCount.toLocaleString()} rows and{" "}
                  {columns.length} columns.
                </div>
              </div>
              <div className="flex-grow flex gap-4 overflow-hidden">
                <div className="overflow-auto border border-gray-200 rounded-lg w-full">
                  <table className="min-w-full text-sm text-left">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        {columns.map((col) => (
                          <th
                            key={col.name}
                            className="py-2 px-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100"
                            onClick={() => requestSort(col.name)}
                          >
                            <div className="flex items-center gap-1">
                              <ColumnDescTooltip name={col.name} description={col.description} />
                              {sortConfig?.key === col.name &&
                                (sortConfig.direction === "ascending" ? (
                                  <ChevronUpIcon className="w-3 h-3" />
                                ) : (
                                  <ChevronDownIcon className="w-3 h-3" />
                                ))}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedRows.map((row, rowIndex) => (
                        <tr
                          key={rowIndex}
                          className="border-b border-gray-200 last:border-b-0"
                        >
                          {columns.map((col) => {
                            const val = row[col.name];
                            let displayVal: React.ReactNode = val;

                            if (val === null || val === undefined) {
                              displayVal = (
                                <i className="text-gray-400">null</i>
                              );
                            } else if (typeof val === "number") {
                              displayVal = formatNumberPreservingOriginal(
                                val,
                                col.name
                              );
                            } else {
                              displayVal = String(val);
                            }

                            return (
                              <td
                                key={col.name}
                                className="py-1.5 px-3 font-mono truncate"
                                title={String(val)}
                              >
                                {displayVal}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeTab === "visualization" && (
            <div className="flex-grow flex flex-col items-center justify-start p-4 gap-4">
              {!ageColumnName ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">
                    An 'Age' or 'entryAge' column is required for visualization.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex-shrink-0 flex items-center gap-2 self-start flex-wrap">
                    <label className="font-semibold text-gray-700">
                      X-Axis:
                    </label>
                    <span className="p-2 border border-gray-200 rounded-md bg-gray-100 text-gray-600">
                      {ageColumnName}
                    </span>
                    <label
                      htmlFor="y-axis-select-1"
                      className="font-semibold text-gray-700 ml-4"
                    >
                      Y-Axis 1:
                    </label>
                    <select
                      id="y-axis-select-1"
                      value={visYAxisCol || ""}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setVisYAxisCol(newValue);
                        if (newValue === visYAxisCol2) {
                          setVisYAxisCol2(null);
                        }
                      }}
                      className="p-2 border border-gray-300 rounded-md"
                    >
                      <option value="" disabled>
                        Select a column
                      </option>
                      {visYAxisOptions.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                    <label
                      htmlFor="y-axis-select-2"
                      className="font-semibold text-gray-700 ml-4"
                    >
                      Y-Axis 2 (Optional):
                    </label>
                    <select
                      id="y-axis-select-2"
                      value={visYAxisCol2 || ""}
                      onChange={(e) => setVisYAxisCol2(e.target.value || null)}
                      className="p-2 border border-gray-300 rounded-md"
                      disabled={!visYAxisCol}
                    >
                      <option value="">None</option>
                      {visYAxisOptions
                        .filter((col) => col !== visYAxisCol)
                        .map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="w-full flex-grow min-h-0">
                    {visYAxisCol ? (
                      <ScatterPlot
                        rows={rows}
                        xCol={ageColumnName}
                        yCol1={visYAxisCol}
                        yCol2={visYAxisCol2}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-500">
                        <p>
                          Select a column for the Y-axis to visualize against{" "}
                          {ageColumnName}.
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </main>
      </div>
      {showSpreadView && rows.length > 0 && (
        <SpreadViewModal
          onClose={() => setShowSpreadView(false)}
          data={rows}
          columns={columns}
          title={`Spread View: ${module.name}`}
        />
      )}
    </div>
  );
};
