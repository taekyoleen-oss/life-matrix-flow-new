/**
 * dataOverview.ts — 데이터 개요/요약 (읽기 전용, 순수 TS)
 *
 * 위험률표·요율·계약정보 등 표 형태의 미리보기 데이터에서
 * 행 수 / 열 수 / 열별 추론 타입(수치형·범주형) / 결측·빈값 수를 계산한다.
 *
 * 절대 불변식: 읽기 전용 부가 기능. executePipeline·모듈 계산·연결·시각화에
 * 일절 영향을 주지 않으며, 이미 로드된 클라이언트 데이터만 사용한다.
 */

import type { ColumnInfo } from "../types";

export type InferredColumnType = "numeric" | "categorical";

export interface ColumnOverview {
  /** 열 이름 */
  name: string;
  /** 추론된 타입 (수치형/범주형) */
  inferredType: InferredColumnType;
  /** 원본 ColumnInfo.type (있으면) */
  declaredType?: string;
  /** 결측/빈값 개수 (null·undefined·빈 문자열·NaN) */
  missingCount: number;
  /** 결측 비율 (0~1) */
  missingRatio: number;
}

export interface DataOverview {
  /** 표본(미리보기) 행 수 — 실제 계산에 사용된 rows.length */
  sampledRowCount: number;
  /** 전체 행 수 (있으면 totalRowCount, 없으면 sampledRowCount) */
  totalRowCount: number;
  /** 열 수 */
  columnCount: number;
  /** 열별 요약 */
  columns: ColumnOverview[];
  /** 결측이 1개 이상 있는 열 이름 목록 (강조용) */
  columnsWithMissing: string[];
}

/** 값이 결측/빈값인지 판정 */
const isMissing = (val: unknown): boolean => {
  if (val === null || val === undefined) return true;
  if (typeof val === "number") return Number.isNaN(val);
  if (typeof val === "string") return val.trim() === "";
  return false;
};

/** 값이 (결측이 아닐 때) 수치로 해석 가능한지 */
const isNumericValue = (val: unknown): boolean => {
  if (typeof val === "number") return Number.isFinite(val);
  if (typeof val === "string") {
    const t = val.trim();
    if (t === "") return false;
    return !Number.isNaN(Number(t));
  }
  return false;
};

/**
 * 미리보기 데이터(columns + rows)에서 데이터 개요를 계산한다.
 * rows가 없으면 null 반환(부가 섹션을 숨기기 위함).
 */
export function computeDataOverview(
  columns: ColumnInfo[] | undefined,
  rows: Record<string, any>[] | undefined,
  totalRowCount?: number
): DataOverview | null {
  if (!columns || columns.length === 0) return null;
  if (!rows || rows.length === 0) return null;

  const sampledRowCount = rows.length;

  const columnOverviews: ColumnOverview[] = columns.map((col) => {
    let missingCount = 0;
    let presentCount = 0;
    let numericCount = 0;

    for (const row of rows) {
      const val = row ? row[col.name] : undefined;
      if (isMissing(val)) {
        missingCount++;
        continue;
      }
      presentCount++;
      if (isNumericValue(val)) numericCount++;
    }

    // 타입 추론: 선언된 type이 number면 우선 신뢰, 아니면 표본 기반.
    // 결측이 아닌 값의 과반 이상이 수치면 수치형으로 본다.
    let inferredType: InferredColumnType;
    if (col.type && col.type.toLowerCase() === "number") {
      inferredType = "numeric";
    } else if (presentCount > 0 && numericCount / presentCount >= 0.5) {
      inferredType = "numeric";
    } else {
      inferredType = "categorical";
    }

    return {
      name: col.name,
      inferredType,
      declaredType: col.type,
      missingCount,
      missingRatio: sampledRowCount > 0 ? missingCount / sampledRowCount : 0,
    };
  });

  return {
    sampledRowCount,
    totalRowCount:
      typeof totalRowCount === "number" ? totalRowCount : sampledRowCount,
    columnCount: columns.length,
    columns: columnOverviews,
    columnsWithMissing: columnOverviews
      .filter((c) => c.missingCount > 0)
      .map((c) => c.name),
  };
}
