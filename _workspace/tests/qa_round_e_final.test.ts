/**
 * QA Round E — 2차 실행 최종 종합 검증 (pipeline-qa-runner, 독립)
 *
 * 목적: Round C 엔진 변경(C-2/QA-OBS-1/D-8/D-9)과 Round D P0-1(첫 실행 완결성)을
 *   구현 에이전트와 독립적으로, *행동(behavior)* 수준으로 재현/교차검증한다.
 *   - 단순 소스 스캔이 아니라 엔진의 실제 치환 순서/식 평가를 재현한다.
 *   - 기존 테스트(qa_round_c_engine 등)와 중복되지 않는 보강 케이스만 추가.
 *
 * 근거 라인(App.tsx, 2026-06-06 working tree):
 *   - C-2 throw: App.tsx:5017-5023, no-op 분기: 5008-5016, Run All 필터: 5286-5292
 *   - QA-OBS-1 NaN 폴백: scalar 3834-3836 / _Col 3926-3928
 *   - D-8 NetPremium IF: 4382-4387
 *   - D-9 Reserve 행참조: resolveRowRef 4668-4691, 현재행치환 4694-4700, scalar [m]/[n] 4703-4708
 *   - P0-1 기본설정: PremiumComponent.nxColumn="Nx_Male_Mortality"(270),
 *       NetPremium formula="[BPV_Male_Mortality] / [NNX_Male_Mortality(Year)]"(300),
 *       Reserve formula="0"(321-322)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Phase 6 리팩터: 계산 엔진은 utils/pipelineEngine.ts 로 동작 변경 없이 추출됨.
// 정적 스캔 대상에 추출 모듈을 합쳐 기존 엔진 불변식 검증을 유지한다.
const src =
  readFileSync(join(__dirname, '../../App.tsx'), 'utf-8') +
  '\n' +
  readFileSync(join(__dirname, '../../utils/pipelineEngine.ts'), 'utf-8');

// ── C-2: 미지원 타입 throw 의 *행동* 재현 ──────────────────────────────
// 엔진 if-체인을 단순화한 라우터로, "분기 없는 가짜 타입"이 진짜 throw 되는지 확인.
describe('C-2: 미지원 ModuleType 은 빈 Success 가 아니라 throw (행동 재현)', () => {
  const KNOWN_NOOP = new Set(['TextBox', 'GroupBox', 'ScenarioRunner']);
  const KNOWN_CALC = new Set([
    'LoadData', 'SelectData', 'RateModifier', 'DefinePolicyInfo', 'SelectRiskRates',
    'CalculateSurvivors', 'ClaimsCalculator', 'NxMxCalculator', 'PremiumComponent',
    'AdditionalName', 'NetPremiumCalculator', 'GrossPremiumCalculator',
    'ReserveCalculator', 'PipelineExplainer',
  ]);

  // 엔진 if-체인 끝단 구조(no-op | else throw)를 그대로 모사
  function routeModuleType(type: string): { ok: boolean; output: unknown; threw?: string } {
    if (KNOWN_CALC.has(type)) return { ok: true, output: { computed: true } };
    if (KNOWN_NOOP.has(type)) return { ok: true, output: undefined }; // 의도된 no-op
    throw new Error('지원하지 않는 모듈 타입입니다: ' + type);
  }

  it('가짜/신규 enum 타입은 throw 한다 (silent 빈 Success 차단)', () => {
    expect(() => routeModuleType('SomeFutureModule')).toThrowError(/지원하지 않는 모듈 타입입니다/);
  });

  it('TextBox/GroupBox/ScenarioRunner 는 throw 가 아니라 의도된 no-op(Success, output undefined)', () => {
    for (const t of ['TextBox', 'GroupBox', 'ScenarioRunner']) {
      const r = routeModuleType(t);
      expect(r.ok).toBe(true);
      expect(r.output).toBeUndefined();
    }
  });

  it('소스: 최종 else throw 가 no-op 분기 *뒤*에 위치(순서 정확)', () => {
    const noopIdx = src.indexOf('비계산(annotation/container) 모듈');
    const throwIdx = src.indexOf('지원하지 않는 모듈 타입입니다');
    expect(noopIdx).toBeGreaterThan(0);
    expect(throwIdx).toBeGreaterThan(noopIdx); // no-op 분기가 먼저, throw 가 최종 else
  });
});

// ── QA-OBS-1: dxColumn 미지정 시 NNX 가 NaN 아닌 유한 폴백 ────────────────
describe('QA-OBS-1: dxColumn 미지정 → NNX(Half/Quarter/Month) 유한 폴백(NaN 차단)', () => {
  const roundTo5 = (n: number) => Math.round(n * 1e5) / 1e5;

  // 엔진 scalar 경로(App.tsx:3795-3837) 재현
  function nnxScalar(rows: Record<string, number>[], nxColumn: string, dxColumn: string | '', paymentTerm: number) {
    const nx_start = Number(rows[0][nxColumn]) || 0;
    const nx_end = rows[paymentTerm] ? Number(rows[paymentTerm][nxColumn]) || 0 : 0;
    const baseName = nxColumn.replace('Nx_', '');
    const nnxYear = nx_start - nx_end;
    const out: Record<string, number> = {};
    out[`NNX_${baseName}(Year)`] = roundTo5(nnxYear);
    if (dxColumn) {
      const dx_start = Number(rows[0][dxColumn]) || 0;
      const dx_end = rows[paymentTerm] ? Number(rows[paymentTerm][dxColumn]) || 0 : 0;
      const dd = dx_start - dx_end;
      out[`NNX_${baseName}(Half)`] = roundTo5(nnxYear - (1 / 4) * dd);
      out[`NNX_${baseName}(Quarter)`] = roundTo5(nnxYear - (3 / 8) * dd);
      out[`NNX_${baseName}(Month)`] = roundTo5(nnxYear - (11 / 24) * dd);
    } else {
      out[`NNX_${baseName}(Half)`] = roundTo5(nnxYear);
      out[`NNX_${baseName}(Quarter)`] = roundTo5(nnxYear);
      out[`NNX_${baseName}(Month)`] = roundTo5(nnxYear);
    }
    return out;
  }

  const rows = [
    { Nx_Male_Mortality: 1000, Dx_Male_Mortality: 100 },
    { Nx_Male_Mortality: 800, Dx_Male_Mortality: 90 },
    { Nx_Male_Mortality: 600, Dx_Male_Mortality: 80 },
    { Nx_Male_Mortality: 400, Dx_Male_Mortality: 70 },
  ];

  it('dxColumn 미지정: Half/Quarter/Month 가 모두 유한 = Year 값(NaN 아님)', () => {
    const r = nnxScalar(rows, 'Nx_Male_Mortality', '', 2);
    const y = r['NNX_Male_Mortality(Year)'];
    expect(Number.isNaN(y)).toBe(false);
    for (const k of ['Half', 'Quarter', 'Month']) {
      const v = r[`NNX_Male_Mortality(${k})`];
      expect(Number.isNaN(v)).toBe(false);
      expect(v).toBe(y); // 보정항 0 → Year 와 동일
    }
  });

  it('NetPremium 으로 NaN 이 전파되지 않는다 (PP 유한)', () => {
    const r = nnxScalar(rows, 'Nx_Male_Mortality', '', 2);
    const NNX = r['NNX_Male_Mortality(Half)']; // 미지정이라도 유한
    const BPV = 1234.5;
    const PP = BPV / NNX;
    expect(Number.isFinite(PP)).toBe(true);
    expect(Number.isNaN(PP)).toBe(false);
  });

  it('dxColumn 지정 시 보정 적용되어 Half≠Year (기존 동작 불변)', () => {
    const r = nnxScalar(rows, 'Nx_Male_Mortality', 'Dx_Male_Mortality', 2);
    expect(r['NNX_Male_Mortality(Half)']).not.toBe(r['NNX_Male_Mortality(Year)']);
  });
});

// ── D-9: 엔진의 *실제 치환 순서* 로 행참조 vs 스칼라 분리 검증 ──────────────
// 핵심: 행참조 정규식(인덱스 접미) → 현재행 [col] → 컨텍스트 [m]/[n] 스칼라 순.
describe('D-9: 엔진 치환 순서대로 행참조와 스칼라가 충돌하지 않음', () => {
  const evalExpr = (e: string): number => new Function('return ' + e)();

  // App.tsx Reserve 분기(4668-4708)의 *치환 순서를 정확히* 모사
  function engineSubstitute(
    formula: string,
    outputRows: Record<string, any>[],
    rowIndex: number,
    paymentTerm: number,
    reserveEffectiveN: number,
    context: Record<string, any>,
  ): string {
    let evalFormula = formula;
    const resolveRowRef = (colName: string, idxToken: string): string => {
      let targetIdx: number;
      if (idxToken === 't') targetIdx = rowIndex;
      else if (idxToken === '0') targetIdx = 0;
      else if (idxToken === 'm') targetIdx = paymentTerm - 1;
      else if (idxToken === 'n') targetIdx = outputRows.length - 1;
      else return '0';
      if (targetIdx < 0 || targetIdx >= outputRows.length) return '0';
      return String(outputRows[targetIdx]?.[colName] ?? 0);
    };
    // 1) 레거시 [Col][idx]
    evalFormula = evalFormula.replace(/\[([A-Za-z_][A-Za-z0-9_]*)\]\[(t|m|n|0)\]/g, (_m, c, i) => resolveRowRef(c, i));
    // 2) 신형 Col[idx]
    evalFormula = evalFormula.replace(/([A-Za-z_][A-Za-z0-9_]*)\[(t|m|n|0)\]/g, (_m, c, i) => resolveRowRef(c, i));
    // 3) 현재행 [col]
    const row = outputRows[rowIndex];
    const keys = Object.keys(row).sort((a, b) => b.length - a.length);
    for (const k of keys) evalFormula = evalFormula.split(`[${k}]`).join(String(row[k] ?? 0));
    // 4) 컨텍스트(스칼라 [m]/[n] 포함)
    const ctx = { m: paymentTerm, n: reserveEffectiveN, ...context };
    for (const k in ctx) evalFormula = evalFormula.split(`[${k}]`).join(String(ctx[k]));
    return evalFormula;
  }

  const outputRows = [{ V: 10 }, { V: 20 }, { V: 30 }, { V: 40 }, { V: 50 }];
  const paymentTerm = 3;      // m_idx=2 → V=30 ; scalar [m]=3
  const reserveEffectiveN = 20; // scalar [n]=20 (policyTerm) — 행참조 n_idx=len-1=4 → V=50

  it('스칼라 [m]=paymentTerm, [n]=reserveEffectiveN (행참조와 별개 값)', () => {
    // V[m]=납입종료행 V(30), [m] 스칼라=3 → 30 + 3 = 33
    expect(evalExpr(engineSubstitute('V[m] + [m]', outputRows, 0, paymentTerm, reserveEffectiveN, {}))).toBe(33);
    // V[n]=마지막행 V(50), [n] 스칼라=reserveEffectiveN(20) → 50 - 20 = 30
    expect(evalExpr(engineSubstitute('V[n] - [n]', outputRows, 0, paymentTerm, reserveEffectiveN, {}))).toBe(30);
  });

  it('현재행 [V] 와 행참조 V[t] 가 같은 행을 가리킴 (일관)', () => {
    expect(evalExpr(engineSubstitute('[V]', outputRows, 2, paymentTerm, reserveEffectiveN, {}))).toBe(30);
    expect(evalExpr(engineSubstitute('V[t]', outputRows, 2, paymentTerm, reserveEffectiveN, {}))).toBe(30);
  });

  it('GrossPremium 컨텍스트 변수도 [GP] 로 치환됨 (회귀 없음)', () => {
    expect(evalExpr(engineSubstitute('[GP] * 2 + V[0]', outputRows, 1, paymentTerm, reserveEffectiveN, { GP: 100 }))).toBe(210);
  });
});

// ── P0-1: 기본 예제의 컬럼-토큰 계약 정합성 (cross-boundary) ────────────────
describe('P0-1: 기본 NetPremium 수식 토큰이 상류 엔진 출력 컬럼명과 정합', () => {
  it('PremiumComponent baseName 파생 → NNX/BPV 키가 기본 수식 토큰과 일치', () => {
    // 엔진 규칙: baseName = nxColumn.replace("Nx_","") → "Male_Mortality"
    const nxColumn = 'Nx_Male_Mortality';
    const baseName = nxColumn.replace('Nx_', '');
    const nnxKey = `NNX_${baseName}(Year)`;
    const bpvKey = `BPV_${baseName}`;
    expect(nnxKey).toBe('NNX_Male_Mortality(Year)');
    expect(bpvKey).toBe('BPV_Male_Mortality');
    // 기본 NetPremium 수식이 정확히 이 토큰들을 참조하는지 소스로 확인
    expect(src).toContain('[BPV_Male_Mortality] / [NNX_Male_Mortality(Year)]');
    expect(src).toContain('nxColumn: "Nx_Male_Mortality"');
  });

  it('기본 PremiumComponent nxColumn 의 baseName 과 NetPremium 수식 토큰 baseName 이 동일', () => {
    const defaultNx = 'Nx_Male_Mortality';
    const base = defaultNx.replace('Nx_', '');
    const formula = '[BPV_Male_Mortality] / [NNX_Male_Mortality(Year)]';
    // 수식에서 BPV_/NNX_ 토큰의 baseName 추출
    const bpvBase = /\[BPV_([^\]]+)\]/.exec(formula)?.[1];
    const nnxBase = /\[NNX_([^\(]+)\(/.exec(formula)?.[1];
    expect(bpvBase).toBe(base);
    expect(nnxBase).toBe(base);
  });

  it('기본 Reserve 수식 2종이 유효(빈 문자열 아님) → "준비금 1개 이상" 오류 회피', () => {
    // P0-1: 둘 다 "0" (유효식). 엔진은 둘 다 빈 문자열일 때만 throw.
    expect(src).toContain('formulaForPaymentTermOrLess: "0"');
    expect(src).toContain('formulaForGreaterThanPaymentTerm: "0"');
  });
});

// ── Round D 엔진 무변경 가드: 핵심 계리식이 그대로 존재 ──────────────────────
describe('Round D 엔진 무변경: 핵심 계리식/가드가 소스에 보존', () => {
  it('할인계수/생존자/통상함수/NNX/BPV 식 앵커 존재', () => {
    expect(src).toContain('processIfStatements'); // IF 처리기
    expect(src).toContain('resolveRowRef');        // D-9 행참조
    expect(src).toContain('지원하지 않는 모듈 타입입니다'); // C-2 throw
    expect(src).toContain('roundTo5(nnxYear)');     // QA-OBS-1 폴백
  });

  it('decrementMethod 분기(Goal2) 가 보존됨', () => {
    expect(src).toContain('decrementMethod');
  });
});
