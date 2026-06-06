/**
 * schemaInference.ts — 정적 출력 컬럼 추론 (입출력 자동 인식)
 *
 * 설계: _workspace/03_sync_design.md §6.2.
 *
 * 목적: 상류 모듈이 아직 실행되지 않아 `outputData.columns` 가 비어 있어도,
 *       파라미터만으로 "하류가 보게 될 컬럼명"을 예측한다.
 *       엔진(executePipeline)의 prefix 생성 규칙을 정적으로 모사한다.
 *
 * 사용처: ParameterInputModal 드롭다운 소스 = `outputData.columns ?? inferred`.
 *        실행 후엔 실제값 우선, 미실행 시 추론값("예상값" 배지).
 *
 * 주의: 엔진 실제 동작과 어긋나면 안 되므로, 각 함수에 대응 엔진 위치를 주석으로 남긴다.
 */

import { CanvasModule, Connection, ModuleType } from '../types';

/** 한 모듈이 (정적으로) 출력에 추가/통과시키는 컬럼명을 추론한다. 입력 컬럼은 upstream 누적이 담당. */
export function inferOutputColumns(
  module: CanvasModule,
  upstreamColumns: string[] = [],
): string[] {
  const p = module.parameters || {};
  // 통과(pass-through) 기반: 대부분의 계산 모듈은 입력 컬럼을 보존하고 새 컬럼을 추가한다.
  const out = new Set<string>(upstreamColumns);

  switch (module.type) {
    // ── LoadData: 원본 CSV 헤더는 파라미터만으로 알 수 없음(파일 본문 필요) → 빈 추가.
    case ModuleType.LoadData:
      return [];

    // ── SelectData: selected 항목의 newName 만 통과 (rename 반영). 미선택은 제거.
    //   엔진: 선택된 열만 남기고 newName 으로 rename.
    case ModuleType.SelectData: {
      const selections: any[] = Array.isArray(p.selections) ? p.selections : [];
      const cols = selections
        .filter((s) => s.selected)
        .map((s) => s.newName || s.originalName);
      return cols;
    }

    // ── SelectRiskRates: Age/Gender 로 rename + i_prem/i_claim 추가.
    //   엔진 App.tsx:2964-3011.
    case ModuleType.SelectRiskRates: {
      const ageCol = p.ageColumn;
      const genderCol = p.genderColumn;
      const result = new Set<string>();
      for (const c of upstreamColumns) {
        if (c === 'i_prem' || c === 'i_claim') continue;
        if (c === ageCol) result.add('Age');
        else if (c === genderCol) result.add('Gender');
        else result.add(c);
      }
      // ageCol/genderCol 가 상류 추론에 없더라도(미실행) 예상 출력은 Age/Gender 포함.
      result.add('Age');
      result.add('Gender');
      result.add('i_prem');
      result.add('i_claim');
      return [...result];
    }

    // ── RateModifier: 각 calc.newColumnName 추가 (통과 + 신규).
    //   엔진 App.tsx:2800.
    case ModuleType.RateModifier: {
      const calcs: any[] = Array.isArray(p.calculations) ? p.calculations : [];
      for (const c of calcs) if (c.newColumnName) out.add(c.newColumnName);
      return [...out];
    }

    // ── CalculateSurvivors: 각 calc 마다 lx_{name}, Dx_{name} (+옵션 lx).
    //   엔진 App.tsx:3078/3135/3153.
    case ModuleType.CalculateSurvivors: {
      const calcs: any[] = Array.isArray(p.calculations) ? p.calculations : [];
      for (const c of calcs) {
        const name = c.name || 'Mortality';
        out.add(`lx_${name}`);
        out.add(`Dx_${name}`);
      }
      if (p.addFixedLx) out.add('lx');
      return [...out];
    }

    // ── ClaimsCalculator: dx_{name}, Cx_{name} (중복 시 _N suffix — D-5).
    //   엔진 App.tsx:3265-3295 getSafeName.
    case ModuleType.ClaimsCalculator: {
      const calcs: any[] = Array.isArray(p.calculations) ? p.calculations : [];
      const used = new Set<string>(out);
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
      for (const c of calcs) {
        if (!c.lxColumn || !c.riskRateColumn) continue;
        const name = c.name || c.riskRateColumn || 'Calc';
        const dx = safe(`dx_${name}`);
        const cx = safe(`Cx_${name}`);
        out.add(dx);
        out.add(cx);
      }
      return [...out];
    }

    // ── NxMxCalculator: Nx_{name}, Mx_{name}.
    //   엔진 App.tsx:3502/3544.
    case ModuleType.NxMxCalculator: {
      const nx: any[] = Array.isArray(p.nxCalculations) ? p.nxCalculations : [];
      const mx: any[] = Array.isArray(p.mxCalculations) ? p.mxCalculations : [];
      for (const c of nx) {
        if (c.active === false || !c.baseColumn) continue;
        const name = c.name || c.baseColumn.replace(/^Dx_/, '');
        out.add(`Nx_${name}`);
      }
      for (const c of mx) {
        if (c.active === false || !c.baseColumn) continue;
        const name = c.name || c.baseColumn.replace(/^Cx_/, '');
        out.add(`Mx_${name}`);
      }
      return [...out];
    }

    // ── PremiumComponent: 표 컬럼 NNX_X(Year|Half|Quarter|Month)_Col, BPV_Col.
    //   스칼라 결과(NNX_X(Year)/BPV_X)는 별도 출력 객체(nnxResults/bpvResults). 표 추론은 _Col.
    //   엔진 App.tsx:3818-3870.
    case ModuleType.PremiumComponent: {
      const nnx: any[] = Array.isArray(p.nnxCalculations) ? p.nnxCalculations : [];
      const periods = ['Year', 'Half', 'Quarter', 'Month'];
      for (const c of nnx) {
        if (!c.nxColumn) continue;
        const base = String(c.nxColumn).replace(/^Nx_/, '');
        for (const per of periods) out.add(`NNX_${base}(${per})_Col`);
      }
      out.add('BPV_Col');
      return [...out];
    }

    // ── AdditionalName: basicValues name + definitions name (스칼라 변수).
    case ModuleType.AdditionalName: {
      const bv: any[] = Array.isArray(p.basicValues) ? p.basicValues : [];
      const defs: any[] = Array.isArray(p.definitions) ? p.definitions : [];
      for (const v of bv) if (v.name) out.add(v.name);
      for (const d of defs) if (d.name) out.add(d.name);
      return [...out];
    }

    // ── NetPremium/GrossPremium: variableName 변수 추가(스칼라). 표는 통과.
    case ModuleType.NetPremiumCalculator:
      if (p.variableName) out.add(p.variableName);
      return [...out];
    case ModuleType.GrossPremiumCalculator:
      if (p.variableName) out.add(p.variableName);
      return [...out];

    // ── ReserveCalculator: reserveColumnName 추가.
    case ModuleType.ReserveCalculator:
      out.add(p.reserveColumnName || 'Reserve');
      return [...out];

    default:
      return [...out];
  }
}

/** 모듈 id → 모듈 빠른 조회 */
function indexModules(modules: CanvasModule[]): Map<string, CanvasModule> {
  const m = new Map<string, CanvasModule>();
  for (const mod of modules) m.set(mod.id, mod);
  return m;
}

/**
 * targetModuleId 의 데이터 입력 포트로 들어오는 상류 체인을 따라가며 컬럼명을 누적 추론한다.
 * (PolicyInfo 같은 비-데이터 포트는 무시.)
 *
 * @returns 상류가 제공할 것으로 예상되는 컬럼명 배열 (중복 제거)
 */
export function inferUpstreamColumns(
  targetModuleId: string,
  modules: CanvasModule[],
  connections: Connection[],
): string[] {
  const byId = indexModules(modules);

  // 데이터성 포트 이름(정책정보 포트 제외). 보수적으로 'policy' 포함 포트만 제외.
  const isDataPort = (portName: string) =>
    !/policy/i.test(portName);

  // 한 모듈의 (정적) 출력 컬럼을 재귀적으로 계산. 사이클 방지용 visited.
  const memo = new Map<string, string[]>();
  const computing = new Set<string>();

  const outputsOf = (moduleId: string): string[] => {
    if (memo.has(moduleId)) return memo.get(moduleId)!;
    if (computing.has(moduleId)) return []; // 사이클 차단
    computing.add(moduleId);

    const mod = byId.get(moduleId);
    if (!mod) {
      computing.delete(moduleId);
      return [];
    }

    // 실행되어 실제 컬럼이 있으면 그것을 우선 사용.
    const live =
      mod.outputData && mod.outputData.type === 'DataPreview'
        ? mod.outputData.columns.map((c) => c.name)
        : null;

    let result: string[];
    if (live && live.length > 0) {
      result = live;
    } else {
      // 상류 데이터 입력들을 누적해서 이 모듈에 들어오는 컬럼을 구성.
      const upstream = incomingDataColumns(moduleId);
      result = inferOutputColumns(mod, upstream);
    }

    computing.delete(moduleId);
    memo.set(moduleId, result);
    return result;
  };

  const incomingDataColumns = (moduleId: string): string[] => {
    const cols = new Set<string>();
    for (const conn of connections) {
      if (conn.to.moduleId !== moduleId) continue;
      if (!isDataPort(conn.to.portName)) continue;
      for (const c of outputsOf(conn.from.moduleId)) cols.add(c);
    }
    return [...cols];
  };

  return incomingDataColumns(targetModuleId);
}
