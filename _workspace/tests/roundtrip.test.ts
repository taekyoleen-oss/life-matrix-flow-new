/**
 * round-trip 테스트: 모듈 → DSL 섹션 → 모듈(부분 파라미터)
 *
 * 계약 (_workspace/03_sync_design.md §3.1):
 *   - DSL-표현 가능한 키는 parse(generate(params)) 후에도 무손실로 보존된다.
 *   - 비표현 키(fileContent/definitions/paymentRatios/scenarios 등)는 reverse 결과에 포함되지 않거나,
 *     포함되더라도 merge 적용 시 원본을 덮어쓰지 않는다(여기서는 "표현 키 무손실"만 단언).
 *
 * 본 테스트는 utils/moduleSync.ts 의 moduleToDSLSection / dslSectionToParams 만 사용한다.
 */

import { describe, it, expect } from 'vitest';
import { CanvasModule, ModuleType, ModuleStatus } from '../../types';
import { moduleToDSLSection, dslSectionToParams } from '../../utils/moduleSync';

// 테스트용 모듈 빌더 (id/name/position 채움)
function mod(type: ModuleType, parameters: Record<string, any>): CanvasModule {
  return {
    id: `test-${type}`,
    name: type,
    type,
    position: { x: 0, y: 0 },
    status: ModuleStatus.Pending,
    parameters,
    inputs: [],
    outputs: [],
  };
}

const policyInfo = mod(ModuleType.DefinePolicyInfo, {
  riderName: '주계약',
  entryAge: 40,
  gender: 'Male',
  policyTerm: 30,
  paymentTerm: 20,
  interestRate: 2.5,
  maturityAge: 80,
});

/** forward → reverse 헬퍼. ok 가 아니면 테스트 실패. */
function roundtrip(m: CanvasModule): Record<string, any> {
  const section = moduleToDSLSection(m, policyInfo, '테스트상품');
  expect(section, `섹션 생성 실패: ${m.type}`).toBeTruthy();
  const res = dslSectionToParams(section, m.type);
  expect(res.ok, `reverse 실패 (${m.type}): ${JSON.stringify(res.errors)}\n--- 섹션 ---\n${section}`).toBe(true);
  return res.parameters!;
}

describe('round-trip: DefinePolicyInfo', () => {
  it('age/sex/pay/rate/term/maturity 무손실', () => {
    const p = roundtrip(policyInfo);
    expect(p.entryAge).toBe(40);
    expect(p.gender).toBe('Male');
    expect(p.paymentTerm).toBe(20);
    expect(p.interestRate).toBe(2.5);
    expect(p.policyTerm).toBe(30);
    expect(p.maturityAge).toBe(80);
  });
});

describe('round-trip: LoadData', () => {
  it('source 무손실', () => {
    const p = roundtrip(mod(ModuleType.LoadData, { source: 'Risk_Rates_2024.csv' }));
    expect(p.source).toBe('Risk_Rates_2024.csv');
  });
});

describe('round-trip: SelectData', () => {
  it('selections(선택+rename) 무손실', () => {
    const m = mod(ModuleType.SelectData, {
      selections: [
        { originalName: 'Age', selected: true, newName: 'Age' },
        { originalName: 'Sex', selected: true, newName: 'Sex' },
        { originalName: 'Male_Mortality', selected: true, newName: 'Death_Rate' },
      ],
      deathRateColumn: 'Male_Mortality',
    });
    const p = roundtrip(m);
    const byNew: Record<string, string> = {};
    for (const s of p.selections) byNew[s.newName] = s.originalName;
    expect(byNew['Age']).toBe('Age');
    expect(byNew['Sex']).toBe('Sex');
    expect(byNew['Death_Rate']).toBe('Male_Mortality');
    expect(p.deathRateColumn).toBe('Male_Mortality');
  });
});

describe('round-trip: SelectRiskRates', () => {
  it('ageColumn/genderColumn 무손실', () => {
    const p = roundtrip(mod(ModuleType.SelectRiskRates, {
      ageColumn: 'Age',
      genderColumn: 'Sex',
      excludeNonNumericRows: true,
    }));
    expect(p.ageColumn).toBe('Age');
    expect(p.genderColumn).toBe('Sex');
  });
});

describe('round-trip: RateModifier', () => {
  it('newColumnName=formula 무손실', () => {
    const p = roundtrip(mod(ModuleType.RateModifier, {
      calculations: [
        { id: 'rm-0', newColumnName: 'Modified_Rate', formula: 'Death_Rate * 1.5' },
      ],
    }));
    expect(p.calculations).toHaveLength(1);
    expect(p.calculations[0].newColumnName).toBe('Modified_Rate');
    expect(p.calculations[0].formula.replace(/\s/g, '')).toBe('Death_Rate*1.5'.replace(/\s/g, ''));
  });
});

describe('round-trip: CalculateSurvivors', () => {
  it('mortalityColumn + lx calc(name/decrementRates) 무손실', () => {
    const p = roundtrip(mod(ModuleType.CalculateSurvivors, {
      ageColumn: 'Age',
      mortalityColumn: 'Death_Rate',
      addFixedLx: false,
      calculations: [
        { id: 'surv-0', name: 'Mortality', decrementRates: ['Death_Rate'] },
      ],
    }));
    expect(p.mortalityColumn).toBe('Death_Rate');
    expect(p.calculations).toHaveLength(1);
    expect(p.calculations[0].name).toBe('Mortality');
    expect(p.calculations[0].decrementRates).toEqual(['Death_Rate']);
  });

  it('fixedValue lx 무손실', () => {
    const p = roundtrip(mod(ModuleType.CalculateSurvivors, {
      ageColumn: 'Age',
      mortalityColumn: 'Death_Rate',
      addFixedLx: false,
      calculations: [
        { id: 'surv-0', name: 'Mortality', decrementRates: ['Death_Rate'] },
        { id: 'surv-1', name: 'Fixed', fixedValue: 100000 },
      ],
    }));
    const fixed = p.calculations.find((c: any) => c.name === 'Fixed');
    expect(fixed).toBeTruthy();
    expect(fixed.fixedValue).toBe(100000);
  });
});

describe('round-trip (Round B): CalculateSurvivors decrementMethod', () => {
  it('independent method 무손실 (다중 위험률)', () => {
    const p = roundtrip(mod(ModuleType.CalculateSurvivors, {
      ageColumn: 'Age',
      mortalityColumn: 'Death_Rate',
      addFixedLx: false,
      calculations: [
        { id: 'surv-0', name: 'Multi', decrementRates: ['Death_Rate', 'Lapse_Rate'], decrementMethod: 'independent' },
      ],
    }));
    const c = p.calculations[0];
    expect(c.decrementRates).toEqual(['Death_Rate', 'Lapse_Rate']);
    expect(c.decrementMethod).toBe('independent');
  });

  it('udd method(명시) 무손실', () => {
    const p = roundtrip(mod(ModuleType.CalculateSurvivors, {
      ageColumn: 'Age',
      mortalityColumn: 'Death_Rate',
      addFixedLx: false,
      calculations: [
        { id: 'surv-0', name: 'Multi', decrementRates: ['Death_Rate', 'Lapse_Rate'], decrementMethod: 'udd' },
      ],
    }));
    expect(p.calculations[0].decrementMethod).toBe('udd');
  });

  it('항목별로 다른 method 가 섞인 케이스', () => {
    const p = roundtrip(mod(ModuleType.CalculateSurvivors, {
      ageColumn: 'Age',
      mortalityColumn: 'Death_Rate',
      addFixedLx: false,
      calculations: [
        { id: 'surv-0', name: 'A', decrementRates: ['Death_Rate', 'Lapse_Rate'], decrementMethod: 'independent' },
        { id: 'surv-1', name: 'B', decrementRates: ['Death_Rate', 'CI_Rate'], decrementMethod: 'udd' },
        { id: 'surv-2', name: 'C', decrementRates: ['Death_Rate', 'Disability_Rate'] }, // 미지정 → 기본 udd
      ],
    }));
    const byName: Record<string, any> = {};
    for (const c of p.calculations) byName[c.name] = c;
    expect(byName['A'].decrementMethod).toBe('independent');
    expect(byName['B'].decrementMethod).toBe('udd');
    // C 는 미지정: decrementMethod 키 없음(기본 udd) — round-trip 안정.
    expect(byName['C'].decrementMethod).toBeUndefined();
  });

  it('미지정(기본 udd)는 round-trip 후에도 키가 생기지 않는다', () => {
    const p = roundtrip(mod(ModuleType.CalculateSurvivors, {
      ageColumn: 'Age',
      mortalityColumn: 'Death_Rate',
      addFixedLx: false,
      calculations: [
        { id: 'surv-0', name: 'Single', decrementRates: ['Death_Rate'] },
      ],
    }));
    expect(p.calculations[0].decrementMethod).toBeUndefined();
  });
});

describe('round-trip (Round B): SelectData 미선택 열 보존(// off:)', () => {
  it('selected:false 열이 round-trip 후 보존된다', () => {
    const p = roundtrip(mod(ModuleType.SelectData, {
      selections: [
        { originalName: 'Age', selected: true, newName: 'Age' },
        { originalName: 'Sex', selected: true, newName: 'Sex' },
        { originalName: 'Male_Mortality', selected: true, newName: 'Death_Rate' },
        { originalName: 'Female_Mortality', selected: false, newName: 'Female_Mortality' },
        { originalName: 'Notes', selected: false, newName: 'Notes' },
      ],
      deathRateColumn: 'Male_Mortality',
    }));
    const byName: Record<string, any> = {};
    for (const s of p.selections) byName[s.originalName] = s;
    expect(byName['Age'].selected).toBe(true);
    expect(byName['Death_Rate'] ?? byName['Male_Mortality']).toBeTruthy();
    // 미선택 열이 보존되고 selected:false 로 복원됨.
    expect(byName['Female_Mortality']).toBeTruthy();
    expect(byName['Female_Mortality'].selected).toBe(false);
    expect(byName['Notes']).toBeTruthy();
    expect(byName['Notes'].selected).toBe(false);
    expect(p.deathRateColumn).toBe('Male_Mortality');
  });
});

describe('round-trip (Round B): NxMx paymentRatios 보존(// ratios=)', () => {
  it('비기본 paymentRatios 가 round-trip 후 보존된다', () => {
    const customRatios = [
      { year: 1, type: '50%', customValue: 50 },
      { year: 2, type: '100%', customValue: 100 },
      { year: 3, type: 'Custom', customValue: 80 },
    ];
    const p = roundtrip(mod(ModuleType.NxMxCalculator, {
      nxCalculations: [
        { id: 'nx-0', baseColumn: 'Dx_Mortality', name: 'Mortality', active: true },
      ],
      mxCalculations: [
        { id: 'mx-0', baseColumn: 'Cx_CI', name: 'CI', active: true,
          deductibleType: '0.5', customDeductible: 0, paymentRatios: customRatios },
      ],
    }));
    const mxCI = p.mxCalculations.find((c: any) => c.name === 'CI');
    expect(mxCI.deductibleType).toBe('0.5');
    expect(mxCI.paymentRatios).toEqual(customRatios);
  });

  it('기본 paymentRatios 는 마커 없이도 기본값으로 복원', () => {
    const p = roundtrip(mod(ModuleType.NxMxCalculator, {
      nxCalculations: [],
      mxCalculations: [
        { id: 'mx-0', baseColumn: 'Cx_Mortality', name: 'Mortality', active: true,
          deductibleType: '0', customDeductible: 0,
          paymentRatios: [{ year: 1, type: '100%', customValue: 100 }] },
      ],
    }));
    const mx = p.mxCalculations.find((c: any) => c.name === 'Mortality');
    expect(mx.paymentRatios).toHaveLength(1);
    expect(mx.paymentRatios[0].type).toBe('100%');
  });
});

describe('round-trip: ClaimsCalculator', () => {
  it('name/lxColumn/riskRateColumn 무손실', () => {
    const p = roundtrip(mod(ModuleType.ClaimsCalculator, {
      calculations: [
        { id: 'claim-0', name: 'Mortality', lxColumn: 'lx_Mortality', riskRateColumn: 'Death_Rate' },
      ],
    }));
    expect(p.calculations).toHaveLength(1);
    expect(p.calculations[0].lxColumn).toBe('lx_Mortality');
    expect(p.calculations[0].riskRateColumn).toBe('Death_Rate');
    expect(p.calculations[0].name).toBe('Mortality');
  });
});

describe('round-trip: NxMxCalculator', () => {
  it('nx/mx baseColumn+name 무손실, deduct 무손실', () => {
    const p = roundtrip(mod(ModuleType.NxMxCalculator, {
      nxCalculations: [
        { id: 'nx-0', baseColumn: 'Dx_Mortality', name: 'Mortality', active: true },
      ],
      mxCalculations: [
        { id: 'mx-0', baseColumn: 'Cx_Mortality', name: 'Mortality', active: true,
          deductibleType: '0', customDeductible: 0, paymentRatios: [{ year: 1, type: '100%', customValue: 100 }] },
        { id: 'mx-1', baseColumn: 'Cx_CI', name: 'CI', active: true,
          deductibleType: '0.5', customDeductible: 0, paymentRatios: [{ year: 1, type: '100%', customValue: 100 }] },
      ],
    }));
    expect(p.nxCalculations[0].baseColumn).toBe('Dx_Mortality');
    expect(p.nxCalculations[0].name).toBe('Mortality');
    const mxCI = p.mxCalculations.find((c: any) => c.name === 'CI');
    expect(mxCI.baseColumn).toBe('Cx_CI');
    expect(mxCI.deductibleType).toBe('0.5');
    const mxM = p.mxCalculations.find((c: any) => c.name === 'Mortality');
    expect(mxM.deductibleType).toBe('0');
  });
});

describe('round-trip: PremiumComponent', () => {
  it('nnx nxColumn / sumx mxColumn+amount 무손실', () => {
    const p = roundtrip(mod(ModuleType.PremiumComponent, {
      nnxCalculations: [{ id: 'nnx-0', nxColumn: 'Nx_Mortality' }],
      sumxCalculations: [{ id: 'bpv-0', mxColumn: 'Mx_Mortality', amount: 10000 }],
    }));
    expect(p.nnxCalculations[0].nxColumn).toBe('Nx_Mortality');
    expect(p.sumxCalculations[0].mxColumn).toBe('Mx_Mortality');
    expect(p.sumxCalculations[0].amount).toBe(10000);
  });
});

describe('round-trip: AdditionalName', () => {
  it('basicValues name/value 무손실', () => {
    const p = roundtrip(mod(ModuleType.AdditionalName, {
      basicValues: [
        { name: 'α1', value: 0.05 },
        { name: 'α2', value: 0 },
        { name: 'β1', value: 0.03 },
        { name: 'β2', value: 0 },
        { name: 'γ', value: 0.02 },
      ],
      definitions: [],
    }));
    const byName: Record<string, number> = {};
    for (const bv of p.basicValues) byName[bv.name] = bv.value;
    expect(byName['α1']).toBe(0.05);
    expect(byName['β1']).toBe(0.03);
    expect(byName['γ']).toBe(0.02);
  });
});

describe('round-trip: NetPremiumCalculator', () => {
  it('variableName/formula 무손실', () => {
    const p = roundtrip(mod(ModuleType.NetPremiumCalculator, {
      formula: '[BPV_Mortality] / [NNX_Mortality(Year)]',
      variableName: 'PP',
    }));
    expect(p.variableName).toBe('PP');
    // formula 는 stripVarBrackets→addVarBrackets 왕복. 의미적 동등(변수 토큰) 확인.
    expect(p.formula).toContain('BPV_Mortality');
    expect(p.formula).toContain('NNX_Mortality(Year)');
  });
});

describe('round-trip: GrossPremiumCalculator', () => {
  it('variableName/formula 무손실', () => {
    const p = roundtrip(mod(ModuleType.GrossPremiumCalculator, {
      formula: '[PP] / (1 - [α1] - [α2])',
      variableName: 'GP',
    }));
    expect(p.variableName).toBe('GP');
    expect(p.formula).toContain('PP');
    expect(p.formula).toContain('α1');
  });
});

describe('round-trip: ReserveCalculator', () => {
  it('두 구간 formula 무손실', () => {
    const p = roundtrip(mod(ModuleType.ReserveCalculator, {
      formulaForPaymentTermOrLess: '(Mx_Mortality[t] - Mx_Mortality[n]) / lx_Mortality[t] - GP * (Nx_Mortality[t] - Nx_Mortality[m]) / lx_Mortality[t]',
      formulaForGreaterThanPaymentTerm: '(Mx_Mortality[t] - Mx_Mortality[n]) / lx_Mortality[t]',
      reserveColumnName: 'Reserve',
    }));
    expect(p.formulaForPaymentTermOrLess).toContain('Mx_Mortality[t]');
    expect(p.formulaForGreaterThanPaymentTerm).toContain('Mx_Mortality[t]');
  });
});

describe('reverse 실패 안전', () => {
  it('알 수 없는 모듈 헤더는 ok:false', () => {
    const res = dslSectionToParams('## UnknownModuleXYZ\nfoo = bar', ModuleType.LoadData);
    // LoadData 로 파싱 시도하지만 헤더가 다르므로 LoadData config 없음 → ok:false 기대.
    expect(res.ok).toBe(false);
  });

  it('DSL 비대상 모듈(ScenarioRunner)은 ok:false', () => {
    const res = dslSectionToParams('## ScenarioRunner\n', ModuleType.ScenarioRunner);
    expect(res.ok).toBe(false);
  });
});
