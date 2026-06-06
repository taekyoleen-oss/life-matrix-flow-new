/**
 * moduleSync.ts — 단일 모듈 단위 코드↔모듈 양방향 동기화 wrapper.
 *
 * 설계: _workspace/03_sync_design.md §4 (Strategy A: DSL 기반).
 *
 * - forward (모듈 → DSL 섹션): moduleToDSLSection()
 * - reverse (DSL 섹션 → 부분 파라미터): dslSectionToParams()
 *
 * 새 파서를 만들지 않고 utils/dslParser.ts 의 기존 함수
 * (generateDSL / extractModuleSection / parseDSL / buildModuleConfigs / analyzeFlowErrors)
 * 만 조합한다.
 *
 * round-trip 계약 (§3.1):
 *   applyReverse(p0) = merge(p0, dslSectionToParams(moduleToDSLSection(p0)))
 *   ⇒ DSL-표현 키는 무손실, 비표현 키(fileContent/definitions/paymentRatios/scenarios 등)는 p0 유지.
 *
 * 실패 안전 (§4.3): 파싱 실패 시 ok:false 만 반환. 호출부는 파라미터를 건드리지 않는다.
 */

import { CanvasModule, ModuleType } from '../types';
import {
  generateDSL,
  extractModuleSection,
  parseDSL,
  buildModuleConfigs,
  analyzeFlowErrors,
  DSL_MODULE_LABELS,
  DSLFlowError,
} from './dslParser';

export interface ReverseResult {
  ok: boolean;
  /** DSL에서 복원된 부분 파라미터 (merge 용). ok:true 일 때만 존재. */
  parameters?: Record<string, any>;
  /** 인라인 표시용 에러/경고. */
  errors?: string[];
  /** 흐름 경고(차단 아님): 미정의 변수 등. */
  warnings?: DSLFlowError[];
}

/** DSL 코드 편집을 지원하는 ModuleType (DSL_MODULE_LABELS 에 라벨이 있는 것). */
export function isDSLEditableType(type: ModuleType): boolean {
  // DefinePolicyInfo 는 '# ' 헤더 한 줄로 표현되며 DSL_MODULE_LABELS 에는 없지만 편집 대상이다.
  if (type === ModuleType.DefinePolicyInfo) return true;
  // ScenarioRunner 는 라벨은 있으나 본문 round-trip 비대상 → 편집 비대상으로 본다.
  if (type === ModuleType.ScenarioRunner) return false;
  return Boolean(DSL_MODULE_LABELS[type]);
}

/**
 * forward: 단일 모듈 → 해당 모듈의 DSL 섹션 텍스트(## Label 헤더 포함).
 *
 * @param module      대상 모듈
 * @param policyInfo  DefinePolicyInfo 모듈(있으면 헤더의 age/sex/pay/rate/term/maturity 맥락 반영)
 * @param productName 헤더 상품명(선택)
 */
export function moduleToDSLSection(
  module: CanvasModule,
  policyInfo?: CanvasModule,
  productName: string = 'New Life Product',
): string {
  if (!isDSLEditableType(module.type)) return '';

  // DefinePolicyInfo 자체를 편집하는 경우: 헤더 한 줄이 곧 그 섹션이다.
  if (module.type === ModuleType.DefinePolicyInfo) {
    const full = generateDSL(productName, [
      { type: ModuleType.DefinePolicyInfo, parameters: module.parameters },
    ]);
    // 헤더(첫 '# ' 라인)만 반환.
    const headerLine = full.split('\n').find((l) => l.startsWith('# ') && !l.startsWith('## '));
    return headerLine ?? full;
  }

  // 일반 모듈: policyInfo + 대상 모듈로 DSL 생성 후 해당 섹션만 추출.
  const mods: Array<{ type: ModuleType; parameters: Record<string, any> }> = [];
  if (policyInfo) {
    mods.push({ type: ModuleType.DefinePolicyInfo, parameters: policyInfo.parameters });
  }
  mods.push({ type: module.type, parameters: module.parameters });

  const fullDSL = generateDSL(productName, mods);
  return extractModuleSection(fullDSL, module.type);
}

/**
 * reverse: DSL 섹션 텍스트 → 해당 type 의 부분 파라미터.
 *
 * - sectionText 에 '## Label' 헤더가 없으면 자동으로 붙인다(본문만 편집해도 동작).
 * - parseDSL 의 model.errors 가 있으면 ok:false (마지막 유효 상태 유지).
 * - 해당 type 의 config 가 없으면 ok:false.
 */
export function dslSectionToParams(
  sectionText: string,
  type: ModuleType,
): ReverseResult {
  if (!isDSLEditableType(type)) {
    return { ok: false, errors: ['이 모듈은 DSL 코드 편집을 지원하지 않습니다.'] };
  }

  const label = DSL_MODULE_LABELS[type];

  // DefinePolicyInfo 는 '# ' 헤더 한 줄이 표현. 섹션 헤더(## )를 붙이지 않는다.
  let textToParse: string;
  if (type === ModuleType.DefinePolicyInfo) {
    const trimmed = sectionText.trim();
    // 사용자가 '# ' 없이 'age=40 | ...' 만 입력한 경우 보정.
    textToParse = trimmed.startsWith('#') ? trimmed : `# New Life Product | ${trimmed}`;
  } else if (!label) {
    return { ok: false, errors: [`알 수 없는 모듈 타입: ${type}`] };
  } else {
    const hasHeader = /(^|\n)\s*##\s+/.test(sectionText);
    textToParse = hasHeader ? sectionText : `## ${label}\n${sectionText}`;
  }

  let model;
  try {
    model = parseDSL(textToParse);
  } catch (e: any) {
    return { ok: false, errors: [`파싱 실패: ${e?.message ?? String(e)}`] };
  }

  if (model.errors && model.errors.length > 0) {
    return { ok: false, errors: model.errors };
  }

  let configs;
  try {
    configs = buildModuleConfigs(model);
  } catch (e: any) {
    return { ok: false, errors: [`파라미터 변환 실패: ${e?.message ?? String(e)}`] };
  }

  // DefinePolicyInfo 는 buildModuleConfigs 가 항상 맨 앞에 넣는다(policyParams).
  const config = configs.find((c) => c.type === type);
  if (!config) {
    return { ok: false, errors: ['인식된 모듈 섹션이 없습니다.'] };
  }

  // 흐름 경고(차단 아님)는 별도 수집.
  let warnings: DSLFlowError[] = [];
  try {
    warnings = analyzeFlowErrors(model);
  } catch {
    warnings = [];
  }

  // ── merge 시 비-DSL-표현 키가 buildModuleConfigs 의 주입 기본값으로 덮어쓰이지 않도록
  //    ⚠️ 부분-표현 타입은 DSL 이 실제로 표현하는 키만 남긴다 (설계 §3 테이블).
  const parameters = filterReverseKeys(type, config.parameters);

  return { ok: true, parameters, warnings };
}

/**
 * 부분-표현(⚠️) ModuleType 의 reverse 결과에서, DSL 이 실제로 표현하는 키만 남긴다.
 * 이래야 merge 적용 시 DSL 미표현 키(columnRenames/excludeNonNumericRows 등)가
 * buildModuleConfigs 의 주입 기본값에 의해 사라지지 않는다.
 * (그 외 타입은 전체 키를 그대로 반환 — selections/calculations 등 배열 키는 DSL 권위로 교체)
 */
function filterReverseKeys(type: ModuleType, params: Record<string, any>): Record<string, any> {
  // 타입별 "DSL 이 권위를 갖는 키" 화이트리스트. 미지정 타입은 전체 반환.
  const WHITELIST: Partial<Record<ModuleType, string[]>> = {
    // SelectRiskRates: ageCol/genderCol 만 DSL 표현. columnRenames/excludeNonNumericRows 는 보존.
    [ModuleType.SelectRiskRates]: ['ageColumn', 'genderColumn'],
    // AdditionalName: basicValues(name=value) 만 DSL 표현. definitions(static/lookup 파생변수)는
    // buildAdditionalNameParams 가 항상 [] 로 반환하므로, 화이트리스트로 제외해 merge 보존한다 (QA-BUG-1).
    [ModuleType.AdditionalName]: ['basicValues'],
  };
  const keys = WHITELIST[type];
  if (!keys) return params;
  const out: Record<string, any> = {};
  for (const k of keys) {
    if (k in params) out[k] = params[k];
  }
  return out;
}
