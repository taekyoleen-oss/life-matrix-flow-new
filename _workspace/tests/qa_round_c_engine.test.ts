/**
 * QA — Round C 엔진 변경 독립 검증 (D-8 NetPremium IF, D-9 Reserve 행참조)
 *
 * 방식: App.tsx 의 해당 로직(processIfStatements, Reserve 행참조 치환)을 *순수 재현*하여
 *   (a) 기존 유효 케이스 결과 불변,
 *   (b) 새 케이스(IF / 행참조)가 의도대로 동작함을 단언.
 *   추가로 App.tsx 소스를 정적 스캔하여 실제 엔진에 변경이 반영됐는지 확인한다.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(__dirname, '../../App.tsx'), 'utf-8');

// ── processIfStatements 순수 재현 (App.tsx:2449-2471 와 동일) ───────────────
function processIfStatements(expression: string): string {
  let processed = expression;
  let changed = true;
  while (changed) {
    changed = false;
    const ifPattern =
      /IF\s*\(([^()]*(?:\([^()]*(?:\([^()]*\)[^()]*)*\)[^()]*)*),\s*([^,()]*(?:\([^()]*(?:\([^()]*\)[^()]*)*\)[^()]*)*),\s*([^()]*(?:\([^()]*(?:\([^()]*\)[^()]*)*\)[^()]*)*)\)/g;
    processed = processed.replace(ifPattern, (_match, condition, trueValue, falseValue) => {
      changed = true;
      return `(${condition.trim()} ? ${trueValue.trim()} : ${falseValue.trim()})`;
    });
  }
  return processed;
}

const evalExpr = (e: string): number => new Function('return ' + e)();

// ─────────────────────────────────────────────────────────
// D-8: NetPremium IF() 지원
// ─────────────────────────────────────────────────────────
describe('D-8: NetPremium IF() 지원', () => {
  it('[D-8] IF() 가 삼항으로 변환되어 평가된다', () => {
    // 토큰 치환 후 가정: BPV=100, NNX=10
    const expr = 'IF(100 > 50, 100 / 10, 0)';
    const processed = processIfStatements(expr);
    expect(processed).toBe('(100 > 50 ? 100 / 10 : 0)');
    expect(evalExpr(processed)).toBe(10);
  });

  it('[D-8] IF false 분기도 정상 평가', () => {
    const processed = processIfStatements('IF(1 > 2, 999, 7 + 3)');
    expect(evalExpr(processed)).toBe(10);
  });

  it('[D-8] 중첩 IF 도 동작', () => {
    const processed = processIfStatements('IF(1 > 0, IF(2 > 3, 1, 2), 3)');
    expect(evalExpr(processed)).toBe(2);
  });

  it('[D-8 불변] IF 가 없는 기존 수식은 입력 그대로(결과 불변)', () => {
    const plain = '1000 / 50 + 20 * 2';
    expect(processIfStatements(plain)).toBe(plain);
    expect(evalExpr(processIfStatements(plain))).toBe(evalExpr(plain));
  });

  it('[D-8] 엔진(App.tsx NetPremium)에 processIfStatements 호출이 추가됨 (정적 확인)', () => {
    // NetPremium 분기: substitutedFormula/netPremium 직전에 processIfStatements 가 있어야 함
    const npStart = src.indexOf('type: "NetPremiumOutput"');
    const before = src.slice(Math.max(0, npStart - 800), npStart);
    expect(before).toContain('processIfStatements(expression)');
    // D-8 주석 흔적
    expect(src).toContain('D-8: NetPremium');
  });
});

// ─────────────────────────────────────────────────────────
// D-9: Reserve 행참조 [col][t|m|n|0]
// ─────────────────────────────────────────────────────────
describe('D-9: Reserve 행참조 [col][t|m|n|0] 엔진 지원', () => {
  // 엔진 resolveRowRef + 행참조 치환 순수 재현 (App.tsx Reserve 분기와 동일 규칙)
  function reserveSubstitute(
    formula: string,
    rows: Record<string, any>[],
    rowIndex: number,
    paymentTerm: number
  ): string {
    let evalFormula = formula;
    const resolveRowRef = (colName: string, idxToken: string): string => {
      let targetIdx: number;
      if (idxToken === 't') targetIdx = rowIndex;
      else if (idxToken === '0') targetIdx = 0;
      else if (idxToken === 'm') targetIdx = paymentTerm - 1;
      else if (idxToken === 'n') targetIdx = rows.length - 1;
      else return '0';
      if (targetIdx < 0 || targetIdx >= rows.length) return '0';
      const v = rows[targetIdx]?.[colName];
      return String(v ?? 0);
    };
    // 레거시: [Col][idx]
    evalFormula = evalFormula.replace(
      /\[([A-Za-z_][A-Za-z0-9_]*)\]\[(t|m|n|0)\]/g,
      (_m, col, idx) => resolveRowRef(col, idx)
    );
    // 신형: Col[idx]
    evalFormula = evalFormula.replace(
      /([A-Za-z_][A-Za-z0-9_]*)\[(t|m|n|0)\]/g,
      (_m, col, idx) => resolveRowRef(col, idx)
    );
    // 현재 행 [col] 치환
    const keys = Object.keys(rows[rowIndex]).sort((a, b) => b.length - a.length);
    for (const key of keys) {
      evalFormula = evalFormula.split(`[${key}]`).join(String(rows[rowIndex][key] ?? 0));
    }
    // 스칼라 [m]/[n]
    evalFormula = evalFormula.split('[m]').join(String(paymentTerm));
    evalFormula = evalFormula.split('[n]').join(String(rows.length));
    return evalFormula;
  }

  const rows = [
    { V: 10 }, // idx 0
    { V: 20 }, // idx 1
    { V: 30 }, // idx 2 (paymentTerm=3 → m_idx=2)
    { V: 40 }, // idx 3
    { V: 50 }, // idx 4 (last → n_idx=4)
  ];
  const paymentTerm = 3;

  it('[D-9] V[t] = 현재 행', () => {
    expect(evalExpr(reserveSubstitute('V[t]', rows, 1, paymentTerm))).toBe(20);
    expect(evalExpr(reserveSubstitute('V[t]', rows, 3, paymentTerm))).toBe(40);
  });

  it('[D-9] V[0] = 첫 행', () => {
    expect(evalExpr(reserveSubstitute('V[0]', rows, 2, paymentTerm))).toBe(10);
  });

  it('[D-9] V[m] = 납입종료행(payment_term-1=2)', () => {
    expect(evalExpr(reserveSubstitute('V[m]', rows, 0, paymentTerm))).toBe(30);
  });

  it('[D-9] V[n] = 마지막 데이터행(len-1=4)', () => {
    expect(evalExpr(reserveSubstitute('V[n]', rows, 0, paymentTerm))).toBe(50);
  });

  it('[D-9] 레거시 [V][m] 표기도 동일하게 동작', () => {
    expect(evalExpr(reserveSubstitute('[V][m]', rows, 0, paymentTerm))).toBe(30);
  });

  it('[D-9] 준비금 산출식: V[t] - V[n] (현재행 - 마지막행)', () => {
    // idx 1 기준: 20 - 50 = -30
    expect(evalExpr(reserveSubstitute('V[t] - V[n]', rows, 1, paymentTerm))).toBe(-30);
  });

  it('[D-9 불변] 행참조 없는 기존 스칼라 수식은 영향 없음', () => {
    // 단독 [V] = 현재행, 단독 [m]/[n] = 스칼라
    expect(evalExpr(reserveSubstitute('[V] * 2', rows, 2, paymentTerm))).toBe(60);
    expect(evalExpr(reserveSubstitute('[V] / [m]', rows, 1, paymentTerm))).toBe(20 / 3);
    expect(evalExpr(reserveSubstitute('[n]', rows, 0, paymentTerm))).toBe(5);
    // 행참조 토큰이 스칼라 [m]/[n] 치환을 깨뜨리지 않음
    expect(evalExpr(reserveSubstitute('V[m] + [m]', rows, 0, paymentTerm))).toBe(30 + 3);
  });

  it('[D-9] 경계초과 인덱스는 0 으로 안전 처리(죽지 않음)', () => {
    const small = [{ V: 7 }];
    // paymentTerm=5 → m_idx=4 (범위초과) → 0
    expect(evalExpr(reserveSubstitute('V[m]', small, 0, 5))).toBe(0);
  });

  it('[D-9] 엔진(App.tsx Reserve)에 resolveRowRef 행참조 치환이 추가됨 (정적 확인)', () => {
    expect(src).toContain('resolveRowRef');
    expect(src).toContain('[t|m|n|0]');
    // 신형/레거시 두 정규식 존재
    expect(src).toContain('\\[(t|m|n|0)\\]');
  });
});
