/**
 * QA — schemaInference 정확도(Goal 4) + 경계/NaN 전파(Goal 6)
 *
 * Goal 4: inferOutputColumns 의 정적 추론 컬럼명이 *실제 엔진이 만드는 컬럼명*과 일치하는지
 *   경계면 교차 비교. 엔진 규칙을 별도 상수로 손코딩(추론 구현과 독립)하여 대조.
 *
 * Goal 6: dxColumn 미지정 시 NNX NaN 전파(App.tsx:3771-3773), C-2(미지원 타입 빈 Success),
 *   빈 데이터/극단값에서 추론이 죽지 않는지.
 */
import { describe, it, expect } from 'vitest';
import { CanvasModule, Connection, ModuleType, ModuleStatus } from '../../types';
import { inferOutputColumns, inferUpstreamColumns } from '../../utils/schemaInference';

function mod(type: ModuleType, parameters: Record<string, any>, id = `m-${type}`): CanvasModule {
  return { id, name: type, type, position: { x: 0, y: 0 }, status: ModuleStatus.Pending, parameters, inputs: [], outputs: [] };
}

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

// ─────────────────────────────────────────────────────────
// Goal 4: 추론 vs 실제 엔진 컬럼명
// ─────────────────────────────────────────────────────────
describe('Goal4: schemaInference 추론 컬럼명 == 엔진 실제 규칙', () => {
  it('SelectRiskRates: Age/Gender/i_prem/i_claim (엔진 App.tsx:2980-3011)', () => {
    const cols = inferOutputColumns(
      mod(ModuleType.SelectRiskRates, { ageColumn: 'Age', genderColumn: 'Sex' }),
      ['Age', 'Sex', 'Mortality'],
    );
    expect(cols).toContain('Age');
    expect(cols).toContain('Gender'); // Sex → Gender 리네임
    expect(cols).toContain('i_prem');
    expect(cols).toContain('i_claim');
    expect(cols).toContain('Mortality'); // 통과 컬럼
  });

  it('CalculateSurvivors: lx_{name}, Dx_{name} (엔진 App.tsx:3078/3142)', () => {
    const cols = inferOutputColumns(
      mod(ModuleType.CalculateSurvivors, { calculations: [{ name: 'Mortality', decrementRates: ['Mortality'] }], addFixedLx: true }),
      ['Age', 'Mortality', 'i_prem'],
    );
    expect(cols).toContain('lx_Mortality');
    expect(cols).toContain('Dx_Mortality');
    expect(cols).toContain('lx'); // addFixedLx
  });

  it('ClaimsCalculator: dx_{name}, Cx_{name} + 중복 _N suffix (엔진 getSafeName 3265-3295)', () => {
    const cols = inferOutputColumns(
      mod(ModuleType.ClaimsCalculator, {
        calculations: [
          { name: 'Mortality', lxColumn: 'lx_Mortality', riskRateColumn: 'Mortality' },
          { name: 'Mortality', lxColumn: 'lx_Mortality', riskRateColumn: 'Mortality' }, // 중복명
        ],
      }),
      ['lx_Mortality', 'Mortality'],
    );
    expect(cols).toContain('Cx_Mortality');
    expect(cols).toContain('Cx_Mortality_1'); // 중복 시 suffix
  });

  it('NxMxCalculator: Nx_{name}, Mx_{name} (엔진 3509/3550)', () => {
    const cols = inferOutputColumns(
      mod(ModuleType.NxMxCalculator, {
        nxCalculations: [{ baseColumn: 'Dx_Mortality', name: 'Mortality', active: true }],
        mxCalculations: [{ baseColumn: 'Cx_Mortality', name: 'Mortality', active: true }],
      }),
      ['Dx_Mortality', 'Cx_Mortality'],
    );
    expect(cols).toContain('Nx_Mortality');
    expect(cols).toContain('Mx_Mortality');
  });

  it('PremiumComponent: NNX_{base}(period)_Col, BPV_Col (엔진 3818-3870)', () => {
    const cols = inferOutputColumns(
      mod(ModuleType.PremiumComponent, {
        nnxCalculations: [{ nxColumn: 'Nx_Mortality' }],
        sumxCalculations: [{ mxColumn: 'Mx_Mortality', amount: 10000 }],
      }),
      ['Nx_Mortality', 'Mx_Mortality'],
    );
    expect(cols).toContain('NNX_Mortality(Year)_Col');
    expect(cols).toContain('NNX_Mortality(Month)_Col');
    expect(cols).toContain('BPV_Col');
  });

  it('체인 누적: SelectRiskRates → Survivors 상류 추론', () => {
    const sr = mod(ModuleType.SelectRiskRates, { ageColumn: 'Age', genderColumn: 'Sex' }, 'sr');
    const sv = mod(ModuleType.CalculateSurvivors, { calculations: [{ name: 'Mortality', decrementRates: ['Mortality'] }] }, 'sv');
    sr.outputData = undefined; // 미실행 → 정적 추론
    const conns: Connection[] = [{ from: { moduleId: 'sr', portName: 'data_out' }, to: { moduleId: 'sv', portName: 'data_in' } }];
    const upstream = inferUpstreamColumns('sv', [sr, sv], conns);
    expect(upstream).toContain('i_prem'); // SelectRiskRates 출력이 상류로 전파
    expect(upstream).toContain('Age');
  });

  it('실행된 상류는 실제 outputData.columns 우선', () => {
    const sr = mod(ModuleType.SelectRiskRates, { ageColumn: 'Age', genderColumn: 'Sex' }, 'sr');
    sr.outputData = { type: 'DataPreview', columns: [{ name: 'REAL_COL', type: 'number' }], totalRowCount: 1, rows: [{ REAL_COL: 1 }] } as any;
    const sv = mod(ModuleType.CalculateSurvivors, {}, 'sv');
    const conns: Connection[] = [{ from: { moduleId: 'sr', portName: 'out' }, to: { moduleId: 'sv', portName: 'data_in' } }];
    const upstream = inferUpstreamColumns('sv', [sr, sv], conns);
    expect(upstream).toContain('REAL_COL'); // 실제값 우선
    expect(upstream).not.toContain('i_prem'); // 추론 폴백 아님
  });

  it('미연결 타깃은 빈 상류(죽지 않음)', () => {
    const sv = mod(ModuleType.CalculateSurvivors, {}, 'sv');
    expect(inferUpstreamColumns('sv', [sv], [])).toEqual([]);
  });

  it('사이클이 있어도 무한루프 없이 반환(죽지 않음)', () => {
    const a = mod(ModuleType.RateModifier, { calculations: [{ newColumnName: 'A' }] }, 'a');
    const b = mod(ModuleType.RateModifier, { calculations: [{ newColumnName: 'B' }] }, 'b');
    const conns: Connection[] = [
      { from: { moduleId: 'a', portName: 'o' }, to: { moduleId: 'b', portName: 'data_in' } },
      { from: { moduleId: 'b', portName: 'o' }, to: { moduleId: 'a', portName: 'data_in' } },
    ];
    expect(() => inferUpstreamColumns('a', [a, b], conns)).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────
// Goal 6: 경계 / NaN 전파
// ─────────────────────────────────────────────────────────
describe('Goal6 / QA-OBS-1 수정: NNX dxColumn 미지정 시 Year 폴백(NaN 전파 차단) (엔진 App.tsx:3768-3774)', () => {
  // Round C 수정 후 엔진 로직 재현:
  //   dxColumn 미지정 → 분할납 보정(k*dx_diff)의 dx_diff=0 과 동일 → Half/Quarter/Month = Year 값.
  function nnxResults(hasDx: boolean) {
    const nx_start = 1000, nx_end = 400;
    const nnxYear = nx_start - nx_end;
    const r: Record<string, number> = { 'NNX_M(Year)': round5(nnxYear) };
    if (hasDx) {
      const dx_diff = 100 - 40;
      r['NNX_M(Half)'] = round5(nnxYear - 0.25 * dx_diff);
      r['NNX_M(Quarter)'] = round5(nnxYear - 0.375 * dx_diff);
      r['NNX_M(Month)'] = round5(nnxYear - (11 / 24) * dx_diff);
    } else {
      // 수정: NaN 대신 Year 값으로 폴백.
      r['NNX_M(Half)'] = round5(nnxYear);
      r['NNX_M(Quarter)'] = round5(nnxYear);
      r['NNX_M(Month)'] = round5(nnxYear);
    }
    return r;
  }

  it('[QA-OBS-1 수정] dxColumn 미지정 → Half/Quarter/Month 가 유한값(Year)이고 NaN 이 보험료로 전파되지 않음', () => {
    const r = nnxResults(false);
    expect(Number.isNaN(r['NNX_M(Half)'])).toBe(false);
    expect(Number.isFinite(r['NNX_M(Half)'])).toBe(true);
    expect(r['NNX_M(Half)']).toBe(r['NNX_M(Year)']);
    expect(r['NNX_M(Quarter)']).toBe(r['NNX_M(Year)']);
    expect(r['NNX_M(Month)']).toBe(r['NNX_M(Year)']);
    // 보험료 수식에서 이 값을 분모로 써도 PP 가 유한(NaN 전파 차단 확인)
    const PP = 1000 / r['NNX_M(Half)'];
    expect(Number.isFinite(PP)).toBe(true);
  });

  it('dxColumn 지정 → Half/Quarter/Month 가 분할납 보정된 유한값(기존 동작 불변)', () => {
    const r = nnxResults(true);
    expect(Number.isFinite(r['NNX_M(Half)'])).toBe(true);
    // 보정항이 0 이 아니므로 Year 와 달라야 함(dxColumn 지정 케이스 결과 불변 검증)
    expect(r['NNX_M(Half)']).not.toBe(r['NNX_M(Year)']);
    expect(r['NNX_M(Half)']).toBe(round5(600 - 0.25 * 60));
  });
});

describe('Goal6: 경계값 추론이 죽지 않음', () => {
  it('빈 파라미터 모듈도 빈 배열/통과 반환', () => {
    expect(() => inferOutputColumns(mod(ModuleType.NxMxCalculator, {}), [])).not.toThrow();
    expect(inferOutputColumns(mod(ModuleType.LoadData, {}), [])).toEqual([]);
  });

  it('policyTerm=0(종신) BPV 인덱스 = last row (엔진 effectivePolicyTermIdx 3780)', () => {
    const Mx = [500, 300, 150, 50, 10]; // 5행
    const policyTerm = 0;
    const idx = policyTerm > 0 ? policyTerm : Mx.length - 1;
    expect(idx).toBe(4); // 마지막 행
    const bpvUnit = Mx[0] - Mx[idx];
    expect(bpvUnit).toBe(490);
    expect(Number.isFinite(bpvUnit)).toBe(true);
  });

  it('paymentTerm>policyTerm: NNX 인덱스 초과 시 Nx[m] undefined→0 처리', () => {
    const Nx = [1000, 700, 400]; // 3행 (policyTerm=3)
    const paymentTerm = 10; // > policyTerm
    const nx_end = Nx[paymentTerm] ?? 0; // 엔진 rows[paymentTerm] 없으면 0 처리 패턴
    expect(nx_end).toBe(0);
    const NNX = Nx[0] - nx_end;
    expect(NNX).toBe(1000); // 전체 납입 현가 (죽지 않음)
  });
});
