/**
 * QA — C-2 수정 검증: executePipeline 의 미지원 타입 빈 Success 가드 (Goal 6 / Round C)
 *
 * 감사(01_logic_auditor_findings.md C-2 / QA-OBS-2): executePipeline if-체인에 최종 else 가 없어
 *   분기 없는 ModuleType(ScenarioRunner/TextBox/GroupBox)이 runQueue 에 들어오면
 *   newOutputData=undefined 인 채 status=Success 로 마킹되던 문제.
 *
 * Round C 수정:
 *   - TextBox/GroupBox/ScenarioRunner 는 명시적 no-op 분기로 처리(의도된 Success, 출력 없음).
 *   - 그 외 진짜 미지원 타입은 최종 else 에서 throw('지원하지 않는 모듈 타입입니다: ...').
 *   - Run All 필터에 TextBox/GroupBox 추가.
 *
 * 본 테스트는 App.tsx 소스를 정적 스캔하여 수정 후 동작을 고정한다:
 *   (a) 계산 모듈 + PipelineExplainer 분기 존재,
 *   (b) 모든 enum 타입이 명시적으로 처리됨(미처리 타입 0),
 *   (c) 최종 else 의 미지원-타입 throw 가드가 *존재*함,
 *   (d) Run All 필터가 TextBox/GroupBox 도 거름.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ModuleType } from '../../types';

// Phase 6 리팩터: executePipeline 계산 코어는 utils/pipelineEngine.ts 로
// 동작 변경 없이 추출되었다(App.tsx 는 call-through). 정적 스캔 대상에 추출된
// 엔진 소스를 포함하여 기존 불변식 검증을 그대로 유지한다.
const appSrc = readFileSync(join(__dirname, '../../App.tsx'), 'utf-8');
const engineSrc = readFileSync(
  join(__dirname, '../../utils/pipelineEngine.ts'),
  'utf-8'
);
const src = appSrc + '\n' + engineSrc;

/** executePipeline 본문(루프 처리부) 영역을 라인으로 잘라낸다. */
function pipelineRegion(): string {
  const lines = src.split(/\r?\n/);
  // if-체인 시작(LoadData 분기) ~ 종료(no-op/throw 분기 직후 newStatus=Success)
  // 근거: App.tsx 의 LoadData 분기 ~ 최종 else throw('지원하지 않는 모듈 타입입니다') 부근.
  // 절대 라인 오프셋 대신 앵커(LoadData 분기 / 최종 throw)로 영역을 동적으로 잘라
  // UI 레이어 변경(상단 코드 추가)으로 인한 라인 드리프트에 견고하도록 한다.
  const startIdx = lines.findIndex((l) => l.includes('module.type === ModuleType.LoadData'));
  const throwIdx = lines.findIndex((l) => l.includes('지원하지 않는 모듈 타입입니다'));
  const start = startIdx === -1 ? 2640 : Math.max(0, startIdx - 10);
  const end = throwIdx === -1 ? 4990 : throwIdx + 40;
  return lines.slice(start, end).join('\n');
}

describe('C-2: executePipeline 분기 커버리지 vs ModuleType enum', () => {
  const region = pipelineRegion();
  const allTypes = Object.values(ModuleType);

  const branched = new Set<string>();
  const re = /module\.type === ModuleType\.(\w+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(region)) !== null) branched.add(m[1]);

  it('계산 모듈 13종 + PipelineExplainer 는 분기가 존재', () => {
    const expectBranch = [
      'LoadData', 'SelectData', 'RateModifier', 'DefinePolicyInfo', 'SelectRiskRates',
      'CalculateSurvivors', 'ClaimsCalculator', 'NxMxCalculator', 'PremiumComponent',
      'AdditionalName', 'NetPremiumCalculator', 'GrossPremiumCalculator', 'ReserveCalculator',
      'PipelineExplainer',
    ];
    for (const t of expectBranch) expect(branched.has(t), `분기 누락: ${t}`).toBe(true);
  });

  it('[C-2 수정] 모든 ModuleType enum 이 executePipeline 에서 명시적으로 처리된다 (미처리 0)', () => {
    // Round C: TextBox/GroupBox/ScenarioRunner 도 명시 no-op 분기로 처리됨.
    const noBranch = allTypes.filter((t) => !branched.has(t));
    expect(noBranch).toEqual([]);
  });

  it('[C-2 수정] if-체인 종료부에 미지원-타입 throw(최종 else) 가드가 존재한다', () => {
    const region2 = pipelineRegion();
    // 최종 else 에서 "지원하지 않는 모듈 타입입니다" throw 가드 존재.
    const hasGuard = /\}\s*else\s*\{[\s\S]*?throw new Error\(\s*["']지원하지 않는 모듈 타입입니다/.test(region2);
    expect(hasGuard).toBe(true);
  });
});

describe('C-2: Run All 필터 범위', () => {
  it('[C-2 수정] Run All 은 ScenarioRunner/PipelineExplainer + TextBox/GroupBox 를 모두 거른다', () => {
    // 근거: App.tsx filteredModules
    const anchor = src.indexOf('Filter out non-computing');
    const filterBlock = src.slice(anchor, anchor + 500);
    expect(filterBlock).toContain('ModuleType.ScenarioRunner');
    expect(filterBlock).toContain('ModuleType.PipelineExplainer');
    // Round C: TextBox/GroupBox 도 필터에 포함 → 빈 Success 경로 도달 차단.
    expect(filterBlock).toContain('ModuleType.TextBox');
    expect(filterBlock).toContain('ModuleType.GroupBox');
  });
});
