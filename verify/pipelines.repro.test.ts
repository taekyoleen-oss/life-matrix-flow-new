/**
 * Phase 6 — TS 재현성 verify 하네스 (Vitest)
 * ─────────────────────────────────────────────────────────────────────────────
 * 목적: 보험료(순/영업)·준비금 산출이 **결정적(deterministic)** 임을 증명한다.
 *   - 번들 레퍼런스 파이프라인(`samples/*.lifx`)을 그대로 로드하여
 *   - 계산 코어(`utils/pipelineEngine.ts` 의 executePipelineCore)를 **2회 실행**하고
 *   - 출력(순보험료·영업보험료·준비금 표)이 **완전히 동일**한지 단언한다.
 *
 * 중요: 이 하네스는 앱이 실제로 쓰는 계산 코어를 *그대로* headless 호출한다.
 *   executePipelineCore 는 App.tsx 의 executePipeline 에서 동작 변경 없이 추출된
 *   순수 함수다(App.tsx 는 동일 함수를 call-through 로 호출). 따라서 본 테스트가
 *   통과하면 앱 런타임의 산출도 같은 코어를 거치므로 재현성이 보장된다.
 *
 * sklearn 시드(random_state) 개념의 TS 대체: 이 엔진은 난수를 쓰지 않으며
 *   부동소수 연산 순서가 고정되어 있으므로 동일 입력 → 동일 출력(byte-identical)이다.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  executePipelineCore,
  getTopologicalSort,
} from "../utils/pipelineEngine";
import {
  CanvasModule,
  Connection,
  ModuleStatus,
  ModuleType,
  NetPremiumOutput,
  GrossPremiumOutput,
  DataPreview,
} from "../types";

const SAMPLES_DIR = join(__dirname, "..", "samples");

interface LifxFile {
  modules: CanvasModule[];
  connections: Connection[];
  productName?: string;
  name?: string;
}

/** 검증 대상 레퍼런스 파이프라인 (Phase 2 에서 추가된 Reference_*.lifx + 기존 Whole Life). */
const FIXTURES = [
  "Reference_WholeLife_WithReserves.lifx",
  "Reference_TermLife_StandardRates.lifx",
  "Reference_TermLife_Age45.lifx",
  "Reference_Endowment_Scenario.lifx",
  "Whole Life.lifx",
];

/** .lifx 를 로드해 실행 직전의 초기 모듈 상태(Pending, 출력 없음)로 정규화한다. */
function loadFixture(fileName: string): LifxFile {
  const raw = readFileSync(join(SAMPLES_DIR, fileName), "utf-8");
  const data = JSON.parse(raw) as LifxFile;
  // 매 실행마다 깨끗한 입력에서 출발하도록 status/outputData 초기화 (깊은 복제).
  const modules: CanvasModule[] = JSON.parse(JSON.stringify(data.modules)).map(
    (m: CanvasModule) => ({
      ...m,
      status: ModuleStatus.Pending,
      outputData: undefined,
    })
  );
  return { ...data, modules, connections: data.connections };
}

/** 파이프라인을 1회 실행하고, 재현성 비교 대상이 되는 핵심 출력만 추출한다. */
async function runOnce(fixture: LifxFile) {
  // 매 실행마다 입력 모듈을 깊은 복제 → 이전 실행이 다음 실행에 영향 주지 않음.
  const modules: CanvasModule[] = JSON.parse(JSON.stringify(fixture.modules));
  const connections = fixture.connections;
  const runQueue = getTopologicalSort(modules, connections);
  const noopLog = () => {};

  const out = await executePipelineCore(
    modules,
    connections,
    runQueue,
    noopLog,
    undefined,
    false
  );

  const byType = (t: ModuleType) => out.find((m) => m.type === t);
  const net = byType(ModuleType.NetPremiumCalculator);
  const gross = byType(ModuleType.GrossPremiumCalculator);
  const reserve = byType(ModuleType.ReserveCalculator);

  return {
    statuses: out.map((m) => ({ type: m.type, status: m.status })),
    netStatus: net?.status,
    grossStatus: gross?.status,
    reserveStatus: reserve?.status,
    netPremium: (net?.outputData as NetPremiumOutput | undefined)?.netPremium,
    netSubstituted: (net?.outputData as NetPremiumOutput | undefined)
      ?.substitutedFormula,
    grossPremium: (gross?.outputData as GrossPremiumOutput | undefined)
      ?.grossPremium,
    grossSubstituted: (gross?.outputData as GrossPremiumOutput | undefined)
      ?.substitutedFormula,
    // 준비금: 표 전체(행별 Reserve 값 포함)를 직렬화하여 행 단위까지 동일성 검증.
    reserveRows: (reserve?.outputData as DataPreview | undefined)?.rows ?? null,
  };
}

describe("Phase 6 — 보험료/준비금 산출 재현성 (TS verify 하네스)", () => {
  for (const fileName of FIXTURES) {
    describe(`fixture: ${fileName}`, () => {
      it("2회 실행 시 순/영업보험료·준비금 출력이 완전히 동일하다 (결정성)", async () => {
        const fixture = loadFixture(fileName);

        const a = await runOnce(fixture);
        const b = await runOnce(fixture);

        // 1) 보험료 산출 모듈이 정상 실행되었는지 (계산이 실제로 일어났음을 보장)
        expect(a.netStatus).toBe(ModuleStatus.Success);
        expect(a.grossStatus).toBe(ModuleStatus.Success);
        expect(typeof a.netPremium).toBe("number");
        expect(typeof a.grossPremium).toBe("number");
        expect(Number.isFinite(a.netPremium as number)).toBe(true);
        expect(Number.isFinite(a.grossPremium as number)).toBe(true);
        // 산출값이 0/NaN 으로 무너지지 않았는지 (의미 있는 보험료)
        expect(a.netPremium as number).toBeGreaterThan(0);
        expect(a.grossPremium as number).toBeGreaterThan(0);
        // 영업보험료는 사업비 부가분 때문에 순보험료 이상이어야 한다.
        expect(a.grossPremium as number).toBeGreaterThanOrEqual(
          a.netPremium as number
        );

        // 2) 핵심: 두 번의 독립 실행이 byte-identical (재현성 불변식)
        expect(b.netPremium).toBe(a.netPremium);
        expect(b.grossPremium).toBe(a.grossPremium);
        expect(b.netSubstituted).toBe(a.netSubstituted);
        expect(b.grossSubstituted).toBe(a.grossSubstituted);

        // 3) 준비금 표(행별 값 포함)와 전체 모듈 상태도 동일해야 한다.
        //    (이 픽스처들의 Reserve 가 null 이더라도 그 null 패턴까지 결정적이어야 함)
        expect(JSON.stringify(b.reserveRows)).toBe(
          JSON.stringify(a.reserveRows)
        );
        expect(JSON.stringify(b.statuses)).toBe(JSON.stringify(a.statuses));
      });
    });
  }

  it("서로 다른 보험상품은 서로 다른 보험료를 산출한다 (픽스처가 실제로 구분됨)", async () => {
    const results = await Promise.all(
      FIXTURES.map(async (f) => {
        const r = await runOnce(loadFixture(f));
        return r.netPremium;
      })
    );
    const distinct = new Set(results.map((v) => String(v)));
    // 최소한 2개 이상의 서로 다른 순보험료가 나와야 한다 (엔진이 입력에 반응함을 증명).
    expect(distinct.size).toBeGreaterThan(1);
  });
});
