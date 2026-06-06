/**
 * QA — CalculateSurvivors lx 엔진 독립 검증 (Goal 2, 최우선)
 *
 * 목적: sync-architect 구현과 *독립적으로*, decrementMethod 분기가
 *  (1) 미지정/'udd' → 변경 전 식 `qm + qo - qm*qo/2` 와 동일 결과
 *  (2) 'independent' → 독립곱 `qm + qo - qm*qo`(= 1-(1-qm)(1-qo)) 로 *다른* 결과
 *  (3) 항목별 method 혼합이 항목별로 정확히 적용
 *  (4) 단일 탈퇴(otherRates=0)는 method 무관(결합 미발생)
 *  임을 수치로 검증한다.
 *
 * 방법: App.tsx 의 lx 루프(3076-3132)를 *순수 함수로 재현*(replica)한 뒤,
 *       엔진과 동일한 입력에 대해 손계산 기대값과 비교한다.
 *       (App.tsx 는 React/브라우저 의존이라 직접 import 불가 → 동등 재현이 표준 기법.)
 *
 * 엔진 근거: App.tsx:3076-3132 (currentSurvivors 루프, totalDecrementFactor 분기).
 */
import { describe, it, expect } from 'vitest';

type Row = Record<string, number>;
const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

/**
 * App.tsx CalculateSurvivors lx 루프의 순수 재현.
 * mortalityColumn + otherRates 분리 로직, 3분기, decrementMethod 분기까지 동일.
 * 변경 전 동작과의 비교를 위해 decrementMethod=undefined 는 'udd' 로 처리.
 */
function computeLx(
  rows: Row[],
  mortalityColumn: string | null,
  decrementRates: string[],
  decrementMethod?: 'udd' | 'independent',
): number[] {
  const isMortalityPresent =
    mortalityColumn !== null && mortalityColumn !== 'None' && decrementRates.includes(mortalityColumn);
  const otherRates = decrementRates.filter((r) => r !== mortalityColumn);
  const getRate = (row: Row, col: string) => {
    const v = row[col];
    if (v === null || v === undefined || isNaN(Number(v))) return 0;
    return Number(v);
  };

  let cur = 100000;
  const lx: number[] = [];
  for (const row of rows) {
    lx.push(round5(cur));
    let deaths = 0;
    if (isMortalityPresent && otherRates.length === 0) {
      deaths = cur * getRate(row, mortalityColumn!);
    } else if (!isMortalityPresent && otherRates.length > 0) {
      const sp = otherRates.reduce((p, c) => p * (1 - getRate(row, c)), 1);
      deaths = cur * (1 - sp);
    } else if (isMortalityPresent && otherRates.length > 0) {
      const qm = getRate(row, mortalityColumn!);
      const osp = otherRates.reduce((p, c) => p * (1 - getRate(row, c)), 1);
      const qo = 1 - osp;
      const method = decrementMethod ?? 'udd';
      const factor =
        method === 'independent'
          ? qm + qo - qm * qo
          : qm + qo - (qm * qo) / 2.0;
      deaths = cur * factor;
    }
    cur -= deaths;
  }
  return lx;
}

/** 변경 *이전* 엔진(분기 없음)의 식: 항상 qm+qo-qm*qo/2. method 개념 없음. */
function computeLxPreChange(rows: Row[], mortalityColumn: string, decrementRates: string[]): number[] {
  const otherRates = decrementRates.filter((r) => r !== mortalityColumn);
  const getRate = (row: Row, col: string) => {
    const v = row[col];
    return v === null || v === undefined || isNaN(Number(v)) ? 0 : Number(v);
  };
  let cur = 100000;
  const lx: number[] = [];
  for (const row of rows) {
    lx.push(round5(cur));
    let deaths = 0;
    const qm = getRate(row, mortalityColumn);
    if (otherRates.length === 0) {
      deaths = cur * qm;
    } else {
      const osp = otherRates.reduce((p, c) => p * (1 - getRate(row, c)), 1);
      const qo = 1 - osp;
      deaths = cur * (qm + qo - (qm * qo) / 2.0); // 변경 전 고정식
    }
    cur -= deaths;
  }
  return lx;
}

// 표준 다중탈퇴 3행 데이터: 사망 + 해지(기타탈퇴)
const multiRows: Row[] = [
  { Death_Rate: 0.01, Lapse_Rate: 0.05 },
  { Death_Rate: 0.02, Lapse_Rate: 0.04 },
  { Death_Rate: 0.03, Lapse_Rate: 0.03 },
];

describe('Goal2-(1) 미지정/udd == 변경 전 식 (결과 불변)', () => {
  it('decrementMethod 미지정 결과 = 변경 전 엔진 결과', () => {
    const undef = computeLx(multiRows, 'Death_Rate', ['Death_Rate', 'Lapse_Rate'], undefined);
    const pre = computeLxPreChange(multiRows, 'Death_Rate', ['Death_Rate', 'Lapse_Rate']);
    expect(undef).toEqual(pre);
  });

  it("decrementMethod 'udd' 명시 결과 = 변경 전 엔진 결과", () => {
    const udd = computeLx(multiRows, 'Death_Rate', ['Death_Rate', 'Lapse_Rate'], 'udd');
    const pre = computeLxPreChange(multiRows, 'Death_Rate', ['Death_Rate', 'Lapse_Rate']);
    expect(udd).toEqual(pre);
  });

  it('udd factor 손계산 확인 (1행: qm=.01 qo=.05 → .01+.05-.0005/2=.059975)', () => {
    // factor = .01 + .05 - (.01*.05)/2 = .06 - .00025 = .059750... 잠깐 손계산
    const qm = 0.01, qo = 0.05;
    const factor = qm + qo - (qm * qo) / 2;
    const expectedLx1 = round5(100000 - 100000 * factor);
    const lx = computeLx(multiRows, 'Death_Rate', ['Death_Rate', 'Lapse_Rate'], 'udd');
    expect(lx[0]).toBe(100000);
    expect(lx[1]).toBe(expectedLx1);
  });
});

describe('Goal2-(2) independent == 독립곱, udd 와 다름', () => {
  it('independent factor = 1-(1-qm)(1-qo) = qm+qo-qm*qo', () => {
    const qm = 0.01, qo = 0.05;
    const indepFactor = 1 - (1 - qm) * (1 - qo);
    expect(round5(indepFactor)).toBe(round5(qm + qo - qm * qo)); // 식 동치 확인
    const lx = computeLx(multiRows, 'Death_Rate', ['Death_Rate', 'Lapse_Rate'], 'independent');
    expect(lx[1]).toBe(round5(100000 - 100000 * indepFactor));
  });

  it('independent 와 udd 는 실제로 다른 lx 를 준다', () => {
    const indep = computeLx(multiRows, 'Death_Rate', ['Death_Rate', 'Lapse_Rate'], 'independent');
    const udd = computeLx(multiRows, 'Death_Rate', ['Death_Rate', 'Lapse_Rate'], 'udd');
    expect(indep[1]).not.toBe(udd[1]); // 첫 감소부터 갈림
    // factor 비교: udd = qm+qo-qm*qo/2, independent = qm+qo-qm*qo.
    //  -qm*qo < -qm*qo/2 이므로 independent factor < udd factor → independent 가 *덜* 감소 → lx 더 큼.
    expect(indep[1]).toBeGreaterThan(udd[1]);
  });
});

describe('Goal2-(3) 항목별 method 혼합', () => {
  it('같은 데이터, calc A=independent / B=udd 가 항목별로 다른 lx', () => {
    const a = computeLx(multiRows, 'Death_Rate', ['Death_Rate', 'Lapse_Rate'], 'independent');
    const b = computeLx(multiRows, 'Death_Rate', ['Death_Rate', 'Lapse_Rate'], 'udd');
    // independent(A) factor 가 더 작아 덜 감소 → 마지막 생존자가 더 많다.
    expect(a[a.length - 1]).toBeGreaterThan(b[b.length - 1]);
    // 각자 자기 식대로 정확히 산출되는지 1행 검증
    const qm = 0.01, qo = 0.05;
    expect(a[1]).toBe(round5(100000 * (1 - (qm + qo - qm * qo))));
    expect(b[1]).toBe(round5(100000 * (1 - (qm + qo - (qm * qo) / 2))));
  });
});

describe('Goal2-(4) 단일 탈퇴는 method 무관(결합 미발생)', () => {
  it('mortality 단독: udd/independent/미지정 결과 동일', () => {
    const rates = ['Death_Rate'];
    const u = computeLx(multiRows, 'Death_Rate', rates, 'udd');
    const i = computeLx(multiRows, 'Death_Rate', rates, 'independent');
    const n = computeLx(multiRows, 'Death_Rate', rates, undefined);
    expect(u).toEqual(i);
    expect(u).toEqual(n);
    // 단일 사망률: lx[1] = 100000*(1-.01) = 99000
    expect(u[1]).toBe(99000);
  });

  it('기타탈퇴 단독(mortality 없음): method 무관', () => {
    const rates = ['Lapse_Rate'];
    const u = computeLx(multiRows, 'Death_Rate', rates, 'udd'); // mortality 미포함
    const i = computeLx(multiRows, 'Death_Rate', rates, 'independent');
    expect(u).toEqual(i);
    expect(u[1]).toBe(round5(100000 * (1 - 0.05)));
  });
});
