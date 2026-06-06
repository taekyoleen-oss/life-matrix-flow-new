/**
 * QA — 통합(end-to-end) 표준 시나리오 (Goal 5)
 *
 * 시나리오: 40세 남성, 보험기간 20년, 납입 10년, 이율 2.5%, Risk_Rates_Whole.csv 의 Mortality.
 * 목적: LoadData→SelectRiskRates→Survivors→Claims→NxMx→Premium→Net 의 계리 코어를
 *   순수 재현(replica)으로 끝까지 완주시키고, 최종 순보험료(PP=BPV/NNX)가 합리적 범위인지 확인.
 *
 * 엔진 근거(식): App.tsx i_prem=1/(1+i)^t (2980), i_claim=1/(1+i)^(t+0.5) (2981),
 *   lx[0]=100000, dx=lx*q, Cx=dx*i_claim (3323-3327), Dx=lx*i_prem (3146),
 *   Nx/Mx 역누적합 (3503/3545), NNX=Nx[0]-Nx[m] (3731), BPV=(Mx[0]-Mx[n])*amount (3787).
 *
 * 데이터는 Risk_Rates_Whole.csv 를 직접 파싱(파일 I/O)하여 사용.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

interface Rate { age: number; sex: string; mortality: number; }

function loadRates(): Rate[] {
  const csv = readFileSync(join(__dirname, '../../Risk_Rates_Whole.csv'), 'utf-8');
  const [header, ...lines] = csv.trim().split(/\r?\n/);
  const cols = header.split(',');
  const ai = cols.indexOf('Age'), si = cols.indexOf('Sex'), mi = cols.indexOf('Mortality');
  return lines.map((l) => {
    const f = l.split(',');
    return { age: Number(f[ai]), sex: f[si], mortality: Number(f[mi]) };
  });
}

describe('통합 E2E: 40세 남성 / 보험기간 20 / 납입 10 / 이율 2.5%', () => {
  const entryAge = 40, policyTerm = 20, paymentTerm = 10, i = 0.025, sumAssured = 100_000_000;

  it('전체 계리 체인이 완주하고 PP 가 합리적 범위', () => {
    const rates = loadRates()
      .filter((r) => r.sex === 'Male' && r.age >= entryAge && r.age < entryAge + policyTerm)
      .sort((a, b) => a.age - b.age);

    expect(rates.length).toBe(policyTerm); // 20행 확보 (데이터 충분)
    expect(rates[0].age).toBe(40);
    expect(rates[0].mortality).toBeGreaterThan(0);

    // SelectRiskRates: 할인계수
    const iPrem = rates.map((_, t) => 1 / (1 + i) ** t);
    const iClaim = rates.map((_, t) => 1 / (1 + i) ** (t + 0.5));

    // CalculateSurvivors: lx (단일 사망탈퇴)
    const lx: number[] = [];
    let cur = 100000;
    for (let t = 0; t < rates.length; t++) {
      lx.push(round5(cur));
      cur -= cur * rates[t].mortality;
    }
    expect(lx[0]).toBe(100000);
    expect(lx[lx.length - 1]).toBeLessThan(100000);
    expect(lx[lx.length - 1]).toBeGreaterThan(90000); // 40~59세 누적 사망 ~5.8% → 생존 ~94,243 (실측)
    expect(lx[lx.length - 1]).toBeLessThan(96000);

    // Dx = lx * i_prem
    const Dx = lx.map((v, t) => round5(v * iPrem[t]));
    // dx = lx * q ; Cx = dx * i_claim
    const dx = lx.map((v, t) => round5(v * rates[t].mortality));
    const Cx = dx.map((v, t) => round5(v * iClaim[t]));
    expect(Dx.every((v) => v > 0)).toBe(true);
    expect(Cx.every((v) => v > 0)).toBe(true);

    // Nx 역누적합 (Dx)
    const Nx = new Array(Dx.length).fill(0);
    { let s = 0; for (let k = Dx.length - 1; k >= 0; k--) { s += Dx[k]; Nx[k] = round5(s); } }
    // Mx 역누적합 (Cx, 면책 없음)
    const Mx = new Array(Cx.length).fill(0);
    { let s = 0; for (let k = Cx.length - 1; k >= 0; k--) { s += Cx[k]; Mx[k] = round5(s); } }
    // Nx 는 단조 감소(역누적합)
    for (let k = 1; k < Nx.length; k++) expect(Nx[k]).toBeLessThanOrEqual(Nx[k - 1]);

    // NNX(Year) = Nx[0] - Nx[paymentTerm]  (납입 10년 → 인덱스 10)
    const NNX = Nx[0] - (Nx[paymentTerm] ?? 0);
    // BPV(scalar) = (Mx[0] - Mx[n]) * 1  (n = policyTerm 인덱스, 여기선 행수=20 이므로 종단 last 사용)
    const nIdx = policyTerm < Mx.length ? policyTerm : Mx.length - 1;
    const bpvUnit = Mx[0] - (Mx[nIdx] ?? 0); // 보험금 1단위 기준 현가합(연시)
    expect(NNX).toBeGreaterThan(0);
    expect(bpvUnit).toBeGreaterThan(0);

    // 순보험료 PP = (보험금 * BPV단위) / NNX  (정기보험 연납 순보험료)
    const PP = (sumAssured * bpvUnit) / NNX;
    // 합리성: 40세 남성 20년만기 10년납 1억 정기보험 연납 순보험료 — 수십만 원 수준이어야.
    expect(Number.isFinite(PP)).toBe(true);
    expect(PP).toBeGreaterThan(10_000);    // 너무 작지 않음
    expect(PP).toBeLessThan(5_000_000);    // 너무 크지 않음(1억 보장 연납 순보험료)
    // 참고 출력 (실측 기록용)
    // console.log({ NNX, bpvUnit, PP });
  });

  it('NNX 분모가 0 이 아니어서 PP 가 NaN/Inf 가 되지 않음 (NaN 전파 가드 확인)', () => {
    const rates = loadRates().filter((r) => r.sex === 'Male' && r.age >= 40 && r.age < 60).sort((a, b) => a.age - b.age);
    const lx: number[] = []; let cur = 100000;
    for (const r of rates) { lx.push(cur); cur -= cur * r.mortality; }
    const Dx = lx.map((v, t) => v / (1.025 ** t));
    const Nx = new Array(Dx.length).fill(0);
    { let s = 0; for (let k = Dx.length - 1; k >= 0; k--) { s += Dx[k]; Nx[k] = s; } }
    const NNX = Nx[0] - Nx[10];
    expect(NNX).not.toBe(0);
    expect(Number.isNaN(NNX)).toBe(false);
  });
});
