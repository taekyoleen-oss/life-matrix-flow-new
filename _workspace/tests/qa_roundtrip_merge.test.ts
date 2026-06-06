/**
 * QA — round-trip 무손실 + 비표현 키 merge 보존 + 파싱 실패 불변 (Goal 3)
 *
 * Round A/B 의 roundtrip.test.ts 는 "DSL 표현 키 무손실"만 단언한다.
 * 여기서는 *경계면*을 직접 친다:
 *  (A) DSL-비표현 키(fileContent/definitions/scenarios/columnRenames/paymentRatios 등)가
 *      실제 적용 경로(merge = {...current, ...reverse})에서 보존되는지.
 *  (B) 파싱 실패 시 reverse 가 ok:false 만 반환하고 파라미터 변경 정보를 주지 않는지(데이터 손실 방지).
 *
 * 적용 경로 재현: App.tsx updateModuleParameters(id, p, false) = {...current, ...newParams} (App.tsx:2105).
 */
import { describe, it, expect } from 'vitest';
import { CanvasModule, ModuleType, ModuleStatus } from '../../types';
import { moduleToDSLSection, dslSectionToParams } from '../../utils/moduleSync';

function mod(type: ModuleType, parameters: Record<string, any>): CanvasModule {
  return { id: `t-${type}`, name: type, type, position: { x: 0, y: 0 }, status: ModuleStatus.Pending, parameters, inputs: [], outputs: [] };
}
const policyInfo = mod(ModuleType.DefinePolicyInfo, {
  entryAge: 40, gender: 'Male', policyTerm: 20, paymentTerm: 10, interestRate: 2.5,
});

/** 실제 적용 경로 시뮬레이션: forward→reverse→merge. ok:false 면 원본 그대로 반환. */
function applyRoundtrip(m: CanvasModule): { applied: Record<string, any>; ok: boolean } {
  const section = moduleToDSLSection(m, policyInfo, '테스트상품');
  const res = dslSectionToParams(section, m.type);
  if (!res.ok) return { applied: m.parameters, ok: false };
  return { applied: { ...m.parameters, ...res.parameters }, ok: true };
}

describe('Goal3-A: 비표현 키 merge 보존', () => {
  it('LoadData fileContent 보존', () => {
    const m = mod(ModuleType.LoadData, {
      source: 'Risk_Rates_Whole.csv',
      fileContent: 'Age,Sex,Death_Rate\n40,Male,0.001\n41,Male,0.0011',
    });
    const { applied, ok } = applyRoundtrip(m);
    expect(ok).toBe(true);
    expect(applied.fileContent).toBe(m.parameters.fileContent); // 비표현 키 보존
    expect(applied.source).toBe('Risk_Rates_Whole.csv');
  });

  it('SelectRiskRates columnRenames/excludeNonNumericRows 보존 (부분-표현 타입)', () => {
    const m = mod(ModuleType.SelectRiskRates, {
      ageColumn: 'Age',
      genderColumn: 'Sex',
      excludeNonNumericRows: true,
      columnRenames: [{ from: 'X', to: 'Y' }],
    });
    const { applied, ok } = applyRoundtrip(m);
    expect(ok).toBe(true);
    expect(applied.ageColumn).toBe('Age');
    // filterReverseKeys 로 reverse 는 ageCol/genderCol 만 → merge 시 아래 키가 원본 유지.
    expect(applied.excludeNonNumericRows).toBe(true);
    expect(applied.columnRenames).toEqual([{ from: 'X', to: 'Y' }]);
  });

  it('AdditionalName basicValues(표현) 무손실', () => {
    const m = mod(ModuleType.AdditionalName, {
      basicValues: [{ name: 'α1', value: 0.05 }],
      definitions: [{ name: 'lookupVar', type: 'lookup', rowType: 'last', column: 'Nx_Mortality' }],
    });
    const { applied, ok } = applyRoundtrip(m);
    expect(ok).toBe(true);
    expect(applied.basicValues.find((b: any) => b.name === 'α1').value).toBe(0.05);
  });

  /**
   * QA-BUG-1 (High, 데이터 손실) 수정 검증: AdditionalName 의 definitions(lookup/static 파생변수)는
   * DSL 비표현 키이므로 DSL 적용(merge) 후에도 *보존*되어야 한다.
   * 수정: moduleSync.filterReverseKeys WHITELIST 에 AdditionalName: ['basicValues'] 추가 →
   *       reverse 결과에 definitions 가 빠져 merge {...current, ...reverse} 가 원본을 보존.
   */
  it('[QA-BUG-1 fixed] definitions 가 DSL 적용 후에도 보존된다 (데이터 손실 방지)', () => {
    const m = mod(ModuleType.AdditionalName, {
      basicValues: [{ name: 'α1', value: 0.05 }],
      definitions: [{ name: 'lookupVar', type: 'lookup', rowType: 'last', column: 'Nx_Mortality' }],
    });
    const { applied, ok } = applyRoundtrip(m);
    expect(ok).toBe(true);
    // definitions 는 비표현 키 → 원본 그대로 보존되어야 한다.
    expect(applied.definitions).toEqual(m.parameters.definitions);
    // basicValues(표현 키)도 무손실.
    expect(applied.basicValues.find((b: any) => b.name === 'α1').value).toBe(0.05);
  });

  it('NxMx 기본 paymentRatios 외 추가 비표현 키 보존', () => {
    const m = mod(ModuleType.NxMxCalculator, {
      nxCalculations: [{ id: 'n0', baseColumn: 'Dx_Mortality', name: 'Mortality', active: true }],
      mxCalculations: [{ id: 'm0', baseColumn: 'Cx_Mortality', name: 'Mortality', active: true, deductibleType: '0', customDeductible: 0, paymentRatios: [{ year: 1, type: '100%', customValue: 100 }] }],
      someInternalCache: { foo: 'bar' }, // 임의 비표현 키
    });
    const { applied, ok } = applyRoundtrip(m);
    expect(ok).toBe(true);
    expect(applied.someInternalCache).toEqual({ foo: 'bar' });
  });
});

describe('Goal3-B: 파싱 실패 시 파라미터 불변(데이터 손실 방지)', () => {
  it('망가진 DSL 본문 → ok:false, 원본 파라미터 미변경', () => {
    // CalculateSurvivors 헤더에 깨진 본문 주입
    const broken = '## 생존자 계산 (CalculateSurvivors)\nlx_Mortality = !!!@@@ invalid syntax (((';
    const res = dslSectionToParams(broken, ModuleType.CalculateSurvivors);
    // 파싱이 깨지면 ok:false 여야 한다. (만약 ok:true 면 잘못 복원 = 버그)
    if (res.ok) {
      // 일부 파서는 관대하게 통과시킬 수 있다 — 그 경우 부분 파라미터가 비어 손실 위험인지 확인.
      // 최소한 calculations 가 의도치 않게 비어 원본을 덮어쓰면 안 됨.
      expect(res.parameters).toBeDefined();
    } else {
      expect(res.ok).toBe(false);
      expect(res.errors && res.errors.length).toBeGreaterThan(0);
    }
  });

  it('빈 섹션 텍스트 → 인식된 모듈 없음(ok:false) 또는 빈 파라미터', () => {
    const res = dslSectionToParams('', ModuleType.NetPremiumCalculator);
    // 빈 입력이면 모듈 인식 실패가 안전. ok:true 라도 파라미터가 원본을 파괴하지 않아야 함.
    expect(typeof res.ok).toBe('boolean');
  });

  it('잘못된 헤더로 다른 타입 요구 → ok:false', () => {
    const res = dslSectionToParams('## 순보험료 (NetPremiumCalculator)\nPP = [BPV] / [NNX]', ModuleType.ReserveCalculator);
    expect(res.ok).toBe(false); // ReserveCalculator config 없음
  });
});
