import React, { useState } from "react";
import { CanvasModule, ModuleType, ModuleStatus } from "../types";
import { buildSlideReport } from "../utils/buildSlideReport";

interface Props {
  productName: string;
  modules: CanvasModule[];
}

type ButtonState = "idle" | "loading" | "done" | "error";

// 파이프라인이 정상 완료되었는지 확인
// - Error/Running 모듈이 하나도 없어야 함
// - NetPremium 또는 GrossPremium 중 하나 이상 Success여야 함
function isPipelineReady(modules: CanvasModule[]): { ready: boolean; reason?: string } {
  const ignored = new Set([ModuleType.TextBox, ModuleType.GroupBox]);
  const calcModules = modules.filter((m) => !ignored.has(m.type));

  const hasError   = calcModules.some((m) => m.status === ModuleStatus.Error);
  const hasRunning = calcModules.some((m) => m.status === ModuleStatus.Running);

  if (hasError)   return { ready: false, reason: "에러가 발생한 모듈이 있습니다. 오류를 확인하세요." };
  if (hasRunning) return { ready: false, reason: "실행 중인 모듈이 있습니다. 완료 후 보고서를 생성하세요." };

  const netMod   = modules.find((m) => m.type === ModuleType.NetPremiumCalculator);
  const grossMod = modules.find((m) => m.type === ModuleType.GrossPremiumCalculator);
  const hasPremium =
    netMod?.status === ModuleStatus.Success ||
    grossMod?.status === ModuleStatus.Success;

  if (!hasPremium)
    return { ready: false, reason: "파이프라인을 먼저 실행하세요. 순보험료 또는 영업보험료 산출이 필요합니다." };

  return { ready: true };
}

export function SlideReportButton({ productName, modules }: Props) {
  const [state, setState] = useState<ButtonState>("idle");
  const [toast, setToast] = useState<string | null>(null);

  const { ready, reason } = isPipelineReady(modules);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const handleClick = async () => {
    if (!ready || state === "loading") return;

    setState("loading");
    try {
      await buildSlideReport(productName, modules);
      setState("done");
      setTimeout(() => setState("idle"), 2000);
    } catch (err) {
      console.error("PPT 생성 오류:", err);
      setState("error");
      showToast(`❌ PPT 생성 중 오류가 발생했습니다: ${err instanceof Error ? err.message : String(err)}`);
      setTimeout(() => setState("idle"), 3000);
    }
  };

  // 비활성화 상태 계산
  const isDisabled = !ready || state === "loading" || state === "done" || state === "error";

  let label = "📊 PPT 보고서";
  let className =
    "flex items-center gap-2 px-3 py-1.5 text-xs rounded-md font-semibold transition-colors flex-shrink-0 text-white";

  if (!ready) {
    className += " bg-gray-500 opacity-50 cursor-not-allowed";
  } else if (state === "loading") {
    label = "⏳ 생성 중…";
    className += " bg-indigo-700 opacity-70 cursor-not-allowed";
  } else if (state === "done") {
    label = "✅ 완료";
    className += " bg-green-700 cursor-default";
  } else if (state === "error") {
    label = "❌ 오류";
    className += " bg-red-700 cursor-default";
  } else {
    className += " bg-indigo-700 hover:bg-indigo-600 cursor-pointer";
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isDisabled}
        className={className}
        title={ready ? "파이프라인 결과를 PPT 슬라이드 보고서로 저장" : (reason ?? "파이프라인 실행 후 사용 가능")}
      >
        {label}
      </button>

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "1.5rem",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            background: "#1e293b",
            color: "#f8fafc",
            padding: "0.65rem 1.2rem",
            borderRadius: "0.5rem",
            fontSize: "0.82rem",
            maxWidth: "36rem",
            textAlign: "center",
            boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
            lineHeight: 1.5,
          }}
        >
          {toast}
        </div>
      )}
    </>
  );
}
