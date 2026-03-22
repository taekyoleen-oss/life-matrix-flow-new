import { CanvasModule, Connection, ModuleType, ModuleStatus } from '../types';
import { DEFAULT_MODULES } from '../constants';
import { ParsedModelDefinition } from './markdownModelParser';

// DefinePolicyInfo는 연결 체인에서 제외 (실행 엔진이 묵시적으로 참조)
const NON_CHAIN_TYPES = new Set<ModuleType>([
  ModuleType.DefinePolicyInfo,
  ModuleType.ScenarioRunner,
  ModuleType.PipelineExplainer,
]);

// ── 가로 배치 순서 (DefinePolicyInfo 제외한 메인 체인)
const LAYOUT_CHAIN: ModuleType[] = [
  ModuleType.LoadData,
  ModuleType.SelectData,
  ModuleType.SelectRiskRates,
  ModuleType.RateModifier,
  ModuleType.CalculateSurvivors,
  ModuleType.ClaimsCalculator,
  ModuleType.NxMxCalculator,
  ModuleType.PremiumComponent,
  ModuleType.AdditionalName,
  ModuleType.NetPremiumCalculator,
  ModuleType.GrossPremiumCalculator,
  ModuleType.ReserveCalculator,
  ModuleType.ScenarioRunner,
];

const H_SPACING = 210;
const MAIN_Y   = 220;
const POLICY_X = 50;
const POLICY_Y = 50;
const START_X  = 50;

function getModulePosition(
  type: ModuleType,
  includedTypes: Set<ModuleType>
): { x: number; y: number } {
  if (type === ModuleType.DefinePolicyInfo) {
    return { x: POLICY_X, y: POLICY_Y };
  }
  // 포함된 체인 모듈 중 순서 index
  const chainIncluded = LAYOUT_CHAIN.filter((t) => includedTypes.has(t));
  const idx = chainIncluded.indexOf(type);
  return { x: START_X + Math.max(0, idx) * H_SPACING, y: MAIN_Y };
}

function getDefaultForType(type: ModuleType): Omit<CanvasModule, 'id' | 'position' | 'name'> | null {
  return DEFAULT_MODULES.find((m) => m.type === type) ?? null;
}

export function buildPipelineFromModel(
  model: ParsedModelDefinition
): { modules: CanvasModule[]; connections: Connection[] } {
  const includedModules = model.modules.filter((m) => m.include);

  const modules: CanvasModule[] = [];
  const typeToId = new Map<ModuleType, string>();
  const includedTypes = new Set(includedModules.map((m) => m.type));

  // Build modules from included list
  includedModules.forEach((parsed) => {
    const defaults = getDefaultForType(parsed.type);
    if (!defaults) return;

    const id = `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    typeToId.set(parsed.type, id);

    // Deep-copy defaults and overlay parsed parameters
    const mergedParameters = {
      ...JSON.parse(JSON.stringify(defaults.parameters)),
      ...parsed.parameters,
    };

    const displayName = DISPLAY_NAMES[parsed.type] ?? (parsed.type as string);

    modules.push({
      id,
      type: parsed.type,
      name: displayName,
      status: ModuleStatus.Pending,
      parameters: mergedParameters,
      inputs: JSON.parse(JSON.stringify(defaults.inputs)),
      outputs: JSON.parse(JSON.stringify(defaults.outputs)),
      position: getModulePosition(parsed.type, includedTypes),
    });
  });

  // DSL 순서대로 순차 연결: 각 모듈의 첫 번째 출력 → 다음 모듈의 첫 번째 입력
  // DefinePolicyInfo / ScenarioRunner 등은 체인에서 제외
  const connections: Connection[] = [];
  const chainModules = modules.filter((m) => !NON_CHAIN_TYPES.has(m.type));

  for (let i = 0; i < chainModules.length - 1; i++) {
    const from = chainModules[i];
    const to = chainModules[i + 1];
    if (from.outputs.length === 0 || to.inputs.length === 0) continue;

    const fromPort = from.outputs[0].name;
    const toPort = to.inputs[0].name;

    connections.push({
      id: `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      from: { moduleId: from.id, portName: fromPort },
      to: { moduleId: to.id, portName: toPort },
    });
  }

  // Handle ScenarioRunner: replace policy-placeholder with actual DefinePolicyInfo ID
  const policyInfoId = typeToId.get(ModuleType.DefinePolicyInfo);
  if (policyInfoId) {
    const scenarioRunnerId = typeToId.get(ModuleType.ScenarioRunner);
    const scenarioModule = modules.find((m) => m.id === scenarioRunnerId);
    if (scenarioModule) {
      const scenarios = scenarioModule.parameters.scenarios;
      if (Array.isArray(scenarios)) {
        scenarioModule.parameters.scenarios = scenarios.map((s: any) => ({
          ...s,
          policyModuleId: policyInfoId,
        }));
      }
    }
  }

  return { modules, connections };
}

const DISPLAY_NAMES: Partial<Record<ModuleType, string>> = {
  [ModuleType.LoadData]: 'Load Risk Rates',
  [ModuleType.SelectRiskRates]: 'Rating Basis Builder',
  [ModuleType.SelectData]: 'Select Rates',
  [ModuleType.RateModifier]: 'Rate Modifier',
  [ModuleType.DefinePolicyInfo]: 'Define Policy Info',
  [ModuleType.CalculateSurvivors]: 'Survivors Calculator',
  [ModuleType.ClaimsCalculator]: 'Claims Calculator',
  [ModuleType.NxMxCalculator]: 'Nx Mx Calculator',
  [ModuleType.PremiumComponent]: 'Premium Component',
  [ModuleType.AdditionalName]: 'Additional Variables',
  [ModuleType.NetPremiumCalculator]: 'Net Premium Calculator',
  [ModuleType.GrossPremiumCalculator]: 'Gross Premium Calculator',
  [ModuleType.ReserveCalculator]: 'Reserve Calculator',
  [ModuleType.ScenarioRunner]: 'Scenario Runner',
};
