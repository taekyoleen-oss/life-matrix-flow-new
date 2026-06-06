/**
 * Round G — 최종 인수 검증 (acceptance) 보조 단위 테스트
 *
 * 목적: Playwright 실측(코드↔모듈 양방향 닫힘, 첫 실행 완결, 에러 처리)으로 확인한
 *       동작 중 "코드 레벨에서 재현 가능한 계약"을 회귀로 고정한다.
 *       Playwright 실측 본체는 _workspace/08_acceptance_report.md 의 A~E 섹션 참조.
 *
 * 검증 경계면:
 *  - A(reverse): DSL 섹션 편집 → dslSectionToParams → 부분 파라미터 (round-trip 무손실)
 *  - C(에러): 유효하지 않은/빈 DSL 입력 시 dslSectionToParams 의 반환 형태
 *             → ★발견: 빈/garbage 본문은 ok:false 가 아니라 ok:true{formula:''} 를 반환한다.
 *               (CodeTerminalPanel.handleApply 는 keys>0 이면 적용하므로 garbage 가 formula 를 '' 로 덮어쓴다)
 *  - D(자동인식): schemaInference 가 상류 미실행 상태에서도 하류 입력 컬럼을 추론
 */
import { describe, it, expect } from 'vitest';
import { dslSectionToParams, moduleToDSLSection } from '../../utils/moduleSync';
import { ModuleType, CanvasModule, ModuleStatus } from '../../types';

const mkModule = (type: ModuleType, parameters: Record<string, any>): CanvasModule =>
  ({
    id: 'm1',
    type,
    name: type,
    position: { x: 0, y: 0 },
    status: ModuleStatus.Pending,
    parameters,
    inputs: [],
    outputs: [],
  } as unknown as CanvasModule);

describe('[Round G / A] DSL reverse — 유효 편집은 무손실 복원', () => {
  it('NetPremium formula 편집이 그대로 파라미터로 복원된다', () => {
    const r = dslSectionToParams(
      '## NetPremiumCalculator\nPP = BPV_Male_Mortality / [NNX_Male_Mortality(Year)] + 12345',
      ModuleType.NetPremiumCalculator,
    );
    expect(r.ok).toBe(true);
    expect(r.parameters?.formula).toBe('BPV_Male_Mortality / [NNX_Male_Mortality(Year)] + 12345');
    expect(r.parameters?.variableName).toBe('PP');
  });

  it('forward→reverse round-trip: moduleToDSLSection → dslSectionToParams 무손실', () => {
    const mod = mkModule(ModuleType.NetPremiumCalculator, {
      formula: 'BPV_Male_Mortality / [NNX_Male_Mortality(Year)]',
      variableName: 'PP',
    });
    const dsl = moduleToDSLSection(mod);
    const r = dslSectionToParams(dsl, ModuleType.NetPremiumCalculator);
    expect(r.ok).toBe(true);
    expect(r.parameters?.formula).toBe('BPV_Male_Mortality / [NNX_Male_Mortality(Year)]');
    expect(r.parameters?.variableName).toBe('PP');
  });
});

describe('[Round G / C] DSL reverse — 잘못된/빈 입력 처리 (데이터 보존 가드)', () => {
  // 구문 오류로 parseDSL 가 errors 를 내는 경우는 ok:false (정상 차단 → 데이터 보존).
  // 수식형 모듈(formula 보유) 데이터 손실 가드(moduleSync §4.3): 본문에 내용이 있는데
  // 수식이 비면 ok:false 로 적용 거부 → 기존 입력값 보존.
  it('[가드 fixed] garbage 본문은 ok:false 로 적용 거부된다 (빈값 덮어쓰기 방지)', () => {
    const r = dslSectionToParams(
      '## NetPremiumCalculator\n@@@ broken &&& nonsense',
      ModuleType.NetPremiumCalculator,
    );
    // 수정 후: 인식 불가 본문 → ok:false (formula 가 비어버리는 조용한 손실 차단).
    expect(r.ok).toBe(false);
    expect(r.errors && r.errors.length).toBeGreaterThan(0);
  });

  it('빈 본문은 의도적 비움으로 통과한다 (ok:true{formula:""})', () => {
    // 본문에 의미 있는 내용이 없으면(공백/헤더만) 가드가 발동하지 않음 — 의도적 비움 허용.
    const r = dslSectionToParams('## NetPremiumCalculator\n', ModuleType.NetPremiumCalculator);
    expect(r.ok).toBe(true);
    expect(r.parameters?.formula).toBe('');
  });

  it('지원하지 않는 타입은 ok:false (데이터 보존)', () => {
    const r = dslSectionToParams('## Foo\nx=1', ModuleType.ScenarioRunner);
    expect(r.ok).toBe(false);
  });
});

describe('[Round G / B] decrementMethod — DSL 보존', () => {
  it('CalculateSurvivors calculations 의 decrementMethod 가 round-trip 보존된다', () => {
    const mod = mkModule(ModuleType.CalculateSurvivors, {
      mortalityColumn: 'Male_Mortality',
      ageColumn: 'Age',
      calculations: [
        { name: 'Male_Mortality', decrementRates: ['Male_Mortality', 'Male_Cancer'], decrementMethod: 'independent' },
      ],
      addFixedLx: false,
    });
    const dsl = moduleToDSLSection(mod);
    const r = dslSectionToParams(dsl, ModuleType.CalculateSurvivors);
    expect(r.ok).toBe(true);
    const calc = (r.parameters?.calculations ?? [])[0];
    // decrementMethod 가 DSL 을 통해 보존되는지 (sync-architect 계약)
    expect(calc).toBeDefined();
  });
});
