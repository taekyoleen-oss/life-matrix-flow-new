/**
 * schemaInference 정확도 테스트 (입출력 자동 인식).
 *
 * 엔진 prefix 규칙을 정적으로 모사한 inferOutputColumns / inferUpstreamColumns 가
 * "상류 미실행 상태"에서도 하류가 보게 될 컬럼을 올바르게 예측하는지 검증한다.
 */

import { describe, it, expect } from 'vitest';
import { CanvasModule, Connection, ModuleType, ModuleStatus } from '../../types';
import {
  inferOutputColumns,
  inferUpstreamColumns,
} from '../../utils/schemaInference';

function mod(type: ModuleType, parameters: Record<string, any>, id?: string): CanvasModule {
  return {
    id: id ?? `test-${type}`,
    name: type,
    type,
    position: { x: 0, y: 0 },
    status: ModuleStatus.Pending,
    parameters,
    inputs: [],
    outputs: [],
  };
}

function conn(fromId: string, toId: string, toPort = 'data_in'): Connection {
  return {
    id: `${fromId}->${toId}`,
    from: { moduleId: fromId, portName: 'data_out' },
    to: { moduleId: toId, portName: toPort },
  };
}

describe('inferOutputColumns: 단일 모듈', () => {
  it('SelectData: selected newName 만, 미선택 제외', () => {
    const cols = inferOutputColumns(
      mod(ModuleType.SelectData, {
        selections: [
          { originalName: 'Age', selected: true, newName: 'Age' },
          { originalName: 'Male_Mortality', selected: true, newName: 'Death_Rate' },
          { originalName: 'Notes', selected: false, newName: 'Notes' },
        ],
      }),
      ['Age', 'Male_Mortality', 'Notes'],
    );
    expect(cols).toContain('Age');
    expect(cols).toContain('Death_Rate');
    expect(cols).not.toContain('Notes');
    expect(cols).not.toContain('Male_Mortality');
  });

  it('SelectRiskRates: Age/Gender rename + i_prem/i_claim', () => {
    const cols = inferOutputColumns(
      mod(ModuleType.SelectRiskRates, { ageColumn: 'Age', genderColumn: 'Sex' }),
      ['Age', 'Sex', 'Death_Rate'],
    );
    expect(cols).toContain('Age');
    expect(cols).toContain('Gender');
    expect(cols).toContain('Death_Rate');
    expect(cols).toContain('i_prem');
    expect(cols).toContain('i_claim');
    expect(cols).not.toContain('Sex');
  });

  it('CalculateSurvivors: lx_/Dx_ prefix', () => {
    const cols = inferOutputColumns(
      mod(ModuleType.CalculateSurvivors, {
        calculations: [
          { id: 's0', name: 'Mortality', decrementRates: ['Death_Rate'] },
          { id: 's1', name: 'CI', decrementRates: ['CI_Rate'] },
        ],
        addFixedLx: true,
      }),
      ['Age', 'i_prem'],
    );
    expect(cols).toContain('lx_Mortality');
    expect(cols).toContain('Dx_Mortality');
    expect(cols).toContain('lx_CI');
    expect(cols).toContain('Dx_CI');
    expect(cols).toContain('lx'); // addFixedLx
    expect(cols).toContain('Age'); // pass-through
  });

  it('ClaimsCalculator: dx_/Cx_ + 중복 suffix(D-5)', () => {
    const cols = inferOutputColumns(
      mod(ModuleType.ClaimsCalculator, {
        calculations: [
          { id: 'c0', name: 'Mortality', lxColumn: 'lx_Mortality', riskRateColumn: 'Death_Rate' },
          { id: 'c1', name: 'Mortality', lxColumn: 'lx_Mortality', riskRateColumn: 'Death_Rate' },
        ],
      }),
      ['lx_Mortality', 'Death_Rate', 'i_claim'],
    );
    expect(cols).toContain('dx_Mortality');
    expect(cols).toContain('Cx_Mortality');
    // 두 번째 동일 이름 → _1 suffix
    expect(cols).toContain('dx_Mortality_1');
    expect(cols).toContain('Cx_Mortality_1');
  });

  it('NxMxCalculator: Nx_/Mx_ prefix', () => {
    const cols = inferOutputColumns(
      mod(ModuleType.NxMxCalculator, {
        nxCalculations: [{ id: 'n0', baseColumn: 'Dx_Mortality', name: 'Mortality', active: true }],
        mxCalculations: [{ id: 'm0', baseColumn: 'Cx_Mortality', name: 'Mortality', active: true }],
      }),
      ['Dx_Mortality', 'Cx_Mortality'],
    );
    expect(cols).toContain('Nx_Mortality');
    expect(cols).toContain('Mx_Mortality');
  });

  it('PremiumComponent: NNX_X(period)_Col + BPV_Col', () => {
    const cols = inferOutputColumns(
      mod(ModuleType.PremiumComponent, {
        nnxCalculations: [{ id: 'nnx0', nxColumn: 'Nx_Mortality' }],
        sumxCalculations: [{ id: 'bpv0', mxColumn: 'Mx_Mortality', amount: 10000 }],
      }),
      ['Nx_Mortality', 'Mx_Mortality'],
    );
    expect(cols).toContain('NNX_Mortality(Year)_Col');
    expect(cols).toContain('NNX_Mortality(Month)_Col');
    expect(cols).toContain('BPV_Col');
  });
});

describe('inferUpstreamColumns: 상류 체인 누적 (미실행)', () => {
  it('SelectData → SelectRiskRates → CalculateSurvivors 체인', () => {
    const sd = mod(ModuleType.SelectData, {
      selections: [
        { originalName: 'Age', selected: true, newName: 'Age' },
        { originalName: 'Sex', selected: true, newName: 'Sex' },
        { originalName: 'Male_Mortality', selected: true, newName: 'Death_Rate' },
      ],
    }, 'sd');
    const srr = mod(ModuleType.SelectRiskRates, { ageColumn: 'Age', genderColumn: 'Sex' }, 'srr');
    const cs = mod(ModuleType.CalculateSurvivors, {
      calculations: [{ id: 's0', name: 'Mortality', decrementRates: ['Death_Rate'] }],
    }, 'cs');

    const modules = [sd, srr, cs];
    const connections = [conn('sd', 'srr'), conn('srr', 'cs')];

    // CalculateSurvivors 입력으로 들어오는 컬럼(상류 SelectRiskRates 의 출력) 추론
    const upstream = inferUpstreamColumns('cs', modules, connections);
    expect(upstream).toContain('Age');
    expect(upstream).toContain('Gender');
    expect(upstream).toContain('Death_Rate');
    expect(upstream).toContain('i_prem');
    expect(upstream).toContain('i_claim');
  });

  it('실행된 상류의 실제 컬럼을 추론값보다 우선한다', () => {
    const sd = mod(ModuleType.SelectData, { selections: [] }, 'sd');
    // 실제 출력(실행됨)
    sd.outputData = {
      type: 'DataPreview',
      columns: [{ name: 'RealCol1', type: 'number' }, { name: 'RealCol2', type: 'number' }],
      totalRowCount: 0,
    };
    const cs = mod(ModuleType.CalculateSurvivors, { calculations: [] }, 'cs');
    const upstream = inferUpstreamColumns('cs', [sd, cs], [conn('sd', 'cs')]);
    expect(upstream).toContain('RealCol1');
    expect(upstream).toContain('RealCol2');
  });

  it('미연결 모듈은 빈 배열', () => {
    const cs = mod(ModuleType.CalculateSurvivors, { calculations: [] }, 'cs');
    expect(inferUpstreamColumns('cs', [cs], [])).toEqual([]);
  });
});
