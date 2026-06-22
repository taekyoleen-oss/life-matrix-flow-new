// 보험료 재계산 함수 내보내기 (Recompute Export)
// ─────────────────────────────────────────────────────────────────────────────
// 이 모듈은 **순수 추가(additive) 생성기**다. 실행 엔진(executePipeline)이나
// codeSnippets.ts 의 기존 모듈 의사코드 생성을 일절 수정하지 않고, 이미 산출된
// 모듈 출력(파라미터·formula·substitutedFormula·variables)을 **읽기만** 하여
// 외부에서 보험료/준비금을 동일하게 재현할 수 있는 자체 완결형 TypeScript
// 스니펫을 만들어 다운로드한다.
//
// 핵심 아이디어:
//   - 앱의 산출은 `[Variable]` 자리표시자가 든 `formula` 와, 그 자리표시자가
//     실제 수치로 치환되어 평가된 `substitutedFormula`, 그리고 해결된 변수
//     컨텍스트(`variables`)로 구성된다.
//   - 따라서 입력(계약정보·위험률 선택·변수 컨텍스트)과 원본 수식을 함께
//     내보내면, 외부 런타임에서 동일한 산출을 재현할 수 있다.
// ─────────────────────────────────────────────────────────────────────────────

import {
  CanvasModule,
  ModuleType,
  ModuleStatus,
  PolicyInfoOutput,
  NetPremiumOutput,
  GrossPremiumOutput,
} from "../types";

// ─── 내부 유틸 ────────────────────────────────────────────────────────────────

function getModule(modules: CanvasModule[], type: ModuleType): CanvasModule | undefined {
  return modules.find((m) => m.type === type);
}

function getSuccessOutput<T = any>(
  modules: CanvasModule[],
  type: ModuleType
): T | null {
  const mod = getModule(modules, type);
  if (!mod || mod.status !== ModuleStatus.Success) return null;
  return (mod.outputData as unknown as T) ?? null;
}

function jsonLit(value: unknown): string {
  // 안정적이고 사람이 읽기 좋은 JSON 리터럴 (자리표시자 없이 그대로 실행 가능)
  return JSON.stringify(value ?? null, null, 2);
}

/** 산출 가능 여부 판정 — PPT 버튼과 동일한 의미(순/영업보험료 중 하나 이상 Success). */
export function canExportRecompute(modules: CanvasModule[]): {
  ready: boolean;
  reason?: string;
} {
  const net = getModule(modules, ModuleType.NetPremiumCalculator);
  const gross = getModule(modules, ModuleType.GrossPremiumCalculator);
  const hasPremium =
    net?.status === ModuleStatus.Success ||
    gross?.status === ModuleStatus.Success;
  if (!hasPremium) {
    return {
      ready: false,
      reason:
        "파이프라인을 먼저 실행하세요. 순보험료 또는 영업보험료 산출이 필요합니다.",
    };
  }
  return { ready: true };
}

// ─── 스니펫 빌더 ──────────────────────────────────────────────────────────────

export interface RecomputeSnippetResult {
  /** 생성된 자체 완결형 TypeScript 소스 */
  code: string;
  /** 권장 파일명 (확장자 포함) */
  fileName: string;
}

/**
 * 현재 캔버스의 산출 결과로부터 "보험료 재계산 함수" TypeScript 스니펫을 생성한다.
 *
 * 생성물은 외부 ts-node / 브라우저 / Node 어디서든 실행 가능하며, 앱 산출과 동일한
 * 순보험료·영업보험료·(가능 시)준비금을 재현한다. 자리표시자 수식 평가 방식은
 * 앱 엔진과 동일하게 `[Var]` → 컨텍스트 수치 치환 후 산술 평가다.
 */
export function buildRecomputeSnippet(
  productName: string,
  modules: CanvasModule[]
): RecomputeSnippetResult {
  const policy = getSuccessOutput<PolicyInfoOutput>(
    modules,
    ModuleType.DefinePolicyInfo
  );
  const net = getSuccessOutput<NetPremiumOutput>(
    modules,
    ModuleType.NetPremiumCalculator
  );
  const gross = getSuccessOutput<GrossPremiumOutput>(
    modules,
    ModuleType.GrossPremiumCalculator
  );

  // 위험률 선택 모듈의 파라미터(어떤 위험률을 사용했는지)를 입력 메타로 기록
  const riskMod = getModule(modules, ModuleType.SelectRiskRates);
  const riskParams = riskMod?.parameters ?? {};

  // 준비금: 파라미터(수식)만 기록 (행 단위 재계산은 표 데이터 의존이라 안내로 처리)
  const reserveMod = getModule(modules, ModuleType.ReserveCalculator);
  const reserveParams = reserveMod?.parameters ?? {};

  const safeName =
    (productName && productName.trim()) || "보험상품";
  const generatedAt = new Date().toISOString();

  // ── 입력 컨텍스트 구성 ──
  // 순보험료/영업보험료 산출 당시의 해결된 변수 컨텍스트를 그대로 입력으로 둔다.
  // (formula 의 [Var] 자리표시자가 이 컨텍스트로 치환되어 평가된다.)
  const netContext = net?.variables ?? {};
  const grossContext = gross?.variables ?? {};

  const policyLiteral = policy
    ? jsonLit({
        entryAge: policy.entryAge,
        gender: policy.gender,
        policyTerm: policy.policyTerm,
        paymentTerm: policy.paymentTerm,
        interestRate: policy.interestRate,
      })
    : "null";

  const lines: string[] = [];

  lines.push(`// ============================================================`);
  lines.push(`//  ${safeName} — 보험료 재계산 함수 (자체 완결형)`);
  lines.push(`//  Life Matrix Flow 에서 자동 생성 · ${generatedAt}`);
  lines.push(`// ------------------------------------------------------------`);
  lines.push(`//  이 파일은 앱 없이도 동일한 보험료/준비금을 재현하기 위한`);
  lines.push(`//  독립 실행 스니펫입니다. ts-node 또는 브라우저 콘솔에서 실행하세요.`);
  lines.push(`//`);
  lines.push(`//  산출 원리:`);
  lines.push(`//    formula 의 [변수] 자리표시자를 변수 컨텍스트의 수치로 치환한 뒤`);
  lines.push(`//    산술식으로 평가합니다. (앱 실행 엔진과 동일한 방식)`);
  lines.push(`// ============================================================`);
  lines.push(``);

  // ── 1) 계약 정보 ──
  lines.push(`/** 계약 정보 (Policy Info) */`);
  lines.push(`export const policyInfo = ${policyLiteral};`);
  lines.push(``);

  // ── 2) 위험률 선택 메타 ──
  lines.push(`/** 사용한 위험률 선택 정보 (Risk Rates) — 재현 추적용 메타 */`);
  lines.push(`export const riskRateSelection = ${jsonLit(riskParams)};`);
  lines.push(``);

  // ── 3) 수식 평가기 (앱 엔진과 동일한 [Var] 치환 방식의 축약판) ──
  lines.push(`/**`);
  lines.push(` * 수식 평가기: "[Var] + 2 * [Other]" 형태의 식에서`);
  lines.push(` * [Var] 자리표시자를 컨텍스트 수치로 치환한 뒤 산술 평가한다.`);
  lines.push(` * IF(조건, 참값, 거짓값) 구문도 앱과 동일하게 삼항식으로 변환한다.`);
  lines.push(` */`);
  lines.push(`export function evalFormula(`);
  lines.push(`  formula: string,`);
  lines.push(`  context: Record<string, number>`);
  lines.push(`): number {`);
  lines.push(`  let expr = formula;`);
  lines.push(`  // IF(a, b, c) → (a ? b : c)`);
  lines.push(`  expr = expr.replace(/\\bIF\\s*\\(/gi, "__IF__(");`);
  lines.push(`  expr = expr.replace(`);
  lines.push(`    /__IF__\\(([^,]+),([^,]+),([^)]+)\\)/g,`);
  lines.push(`    (_m, c, a, b) => \`((\${c}) ? (\${a}) : (\${b}))\``);
  lines.push(`  );`);
  lines.push(`  // [Var] 치환 (긴 이름부터 치환하여 부분일치 방지)`);
  lines.push(`  const keys = Object.keys(context).sort((x, y) => y.length - x.length);`);
  lines.push(`  for (const k of keys) {`);
  lines.push(`    expr = expr.split(\`[\${k}]\`).join(String(context[k] ?? 0));`);
  lines.push(`  }`);
  lines.push(`  // 남은 [..] 자리표시자는 0 으로 (미해결 변수 방어)`);
  lines.push(`  expr = expr.replace(/\\[[^\\]]*\\]/g, "0");`);
  lines.push(`  // eslint-disable-next-line no-new-func`);
  lines.push(`  return Function(\`"use strict"; return (\${expr});\`)() as number;`);
  lines.push(`}`);
  lines.push(``);

  // 5원단위 절사(앱의 roundTo5 와 동일) — 재현 정확도 보장
  lines.push(`/** 앱과 동일한 5원 단위 절사 (roundTo5) */`);
  lines.push(`export function roundTo5(v: number): number {`);
  lines.push(`  return Math.round(v / 5) * 5;`);
  lines.push(`}`);
  lines.push(``);

  // ── 4) 순보험료 재계산 ──
  if (net) {
    lines.push(`// ── 순보험료 (Net Premium) ──`);
    lines.push(`/** 순보험료 산출 당시 해결된 변수 컨텍스트 */`);
    lines.push(`export const netPremiumContext: Record<string, number> = ${jsonLit(
      netContext
    )};`);
    lines.push(`/** 원본 수식 (자리표시자 포함) */`);
    lines.push(`export const netPremiumFormula = ${JSON.stringify(net.formula)};`);
    lines.push(``);
    lines.push(`export function computeNetPremium(): number {`);
    lines.push(`  return roundTo5(evalFormula(netPremiumFormula, netPremiumContext));`);
    lines.push(`}`);
    lines.push(``);
    lines.push(`// 앱 산출값(검증 기준): ${net.netPremium}`);
    lines.push(``);
  }

  // ── 5) 영업보험료 재계산 ──
  if (gross) {
    lines.push(`// ── 영업보험료 (Gross Premium) ──`);
    lines.push(`/** 영업보험료 산출 당시 해결된 변수 컨텍스트 */`);
    lines.push(`export const grossPremiumContext: Record<string, number> = ${jsonLit(
      grossContext
    )};`);
    lines.push(`/** 원본 수식 (자리표시자 포함) */`);
    lines.push(`export const grossPremiumFormula = ${JSON.stringify(gross.formula)};`);
    lines.push(``);
    lines.push(`export function computeGrossPremium(): number {`);
    lines.push(
      `  return roundTo5(evalFormula(grossPremiumFormula, grossPremiumContext));`
    );
    lines.push(`}`);
    lines.push(``);
    lines.push(`// 앱 산출값(검증 기준): ${gross.grossPremium}`);
    lines.push(``);
  }

  // ── 6) 준비금 (수식 메타만; 행 단위 표 의존이라 안내) ──
  if (reserveMod) {
    lines.push(`// ── 준비금 (Reserve) ──`);
    lines.push(`// 준비금은 경과연도별 표(행 단위)에 의존하므로 본 스니펫에는 수식만 기록합니다.`);
    lines.push(`// 행별 재계산이 필요하면 앱의 Excel 내보내기(표 데이터)와 아래 수식을 함께 사용하세요.`);
    lines.push(`export const reserveFormulas = ${jsonLit({
      formulaForPaymentTermOrLess:
        reserveParams.formulaForPaymentTermOrLess ?? null,
      formulaForGreaterThanPaymentTerm:
        reserveParams.formulaForGreaterThanPaymentTerm ?? null,
      reserveColumnName: reserveParams.reserveColumnName ?? "Reserve",
    })};`);
    lines.push(``);
  }

  // ── 7) 실행/검증 ──
  lines.push(`// ── 실행 예시 (외부에서 재현) ──`);
  lines.push(`if (typeof require !== "undefined" && require.main === module) {`);
  if (net) {
    lines.push(`  console.log("순보험료:", computeNetPremium());`);
  }
  if (gross) {
    lines.push(`  console.log("영업보험료:", computeGrossPremium());`);
  }
  lines.push(`}`);
  lines.push(``);

  const code = lines.join("\n");
  const fileName = `${safeName}_recompute.ts`;

  return { code, fileName };
}

/**
 * 재계산 스니펫을 생성하여 로컬 파일로 다운로드한다.
 * (savePipeline 과 동일한 브라우저 Blob 다운로드 방식)
 */
export function exportRecomputeSnippet(
  productName: string,
  modules: CanvasModule[]
): RecomputeSnippetResult {
  const result = buildRecomputeSnippet(productName, modules);
  const blob = new Blob([result.code], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = result.fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return result;
}
