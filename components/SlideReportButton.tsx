import React, { useState } from "react";
import { CanvasModule, ModuleType, ModuleStatus } from "../types";
import { buildSlideReport } from "../utils/buildSlideReport";

interface Props {
  productName: string;
  modules: CanvasModule[];
}

type ButtonState = "idle" | "loading" | "done" | "error";

export function SlideReportButton({ productName, modules }: Props) {
  const [state, setState] = useState<ButtonState>("idle");
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const handleClick = async () => {
    if (state === "loading") return;

    // 사전 검증: NetPremium 또는 GrossPremium 모듈 실행 여부 확인
    const netMod = modules.find((m) => m.type === ModuleType.NetPremiumCalculator);
    const grossMod = modules.find((m) => m.type === ModuleType.GrossPremiumCalculator);
    const hasComputed =
      netMod?.status === ModuleStatus.Success ||
      grossMod?.status === ModuleStatus.Success;

    if (!hasComputed) {
      showToast("⚠️ 파이프라인을 먼저 실행하세요. 순보험료 또는 영업보험료 산출 후 보고서를 생성할 수 있습니다.");
    }
    // 경고만 표시하고 진행은 허용

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

  const buttonConfig: Record<ButtonState, { label: string; className: string }> = {
    idle: {
      label: "📊 PPT 보고서",
      className:
        "flex items-center gap-2 px-3 py-1.5 text-xs rounded-md font-semibold transition-colors flex-shrink-0 bg-indigo-700 hover:bg-indigo-600 text-white cursor-pointer",
    },
    loading: {
      label: "⏳ 생성 중…",
      className:
        "flex items-center gap-2 px-3 py-1.5 text-xs rounded-md font-semibold transition-colors flex-shrink-0 bg-indigo-700 text-white opacity-70 cursor-not-allowed",
    },
    done: {
      label: "✅ 완료",
      className:
        "flex items-center gap-2 px-3 py-1.5 text-xs rounded-md font-semibold transition-colors flex-shrink-0 bg-green-700 text-white cursor-default",
    },
    error: {
      label: "❌ 오류",
      className:
        "flex items-center gap-2 px-3 py-1.5 text-xs rounded-md font-semibold transition-colors flex-shrink-0 bg-red-700 text-white cursor-default",
    },
  };

  const { label, className } = buttonConfig[state];

  return (
    <>
      <button
        onClick={handleClick}
        disabled={state === "loading" || state === "done" || state === "error"}
        className={className}
        title="파이프라인 결과를 PPT 슬라이드 보고서로 저장"
      >
        {label}
      </button>

      {/* 토스트 알림 */}
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
