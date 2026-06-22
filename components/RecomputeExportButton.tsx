import React, { useState } from "react";
import { CanvasModule } from "../types";
import {
  canExportRecompute,
  exportRecomputeSnippet,
} from "../utils/recomputeExport";

interface Props {
  productName: string;
  modules: CanvasModule[];
}

type ButtonState = "idle" | "done" | "error";

/**
 * 보험료 "재계산 함수" 내보내기 버튼.
 * 현재 캔버스 산출(계약정보·위험률·수식·변수)을 외부에서 동일하게 재현 가능한
 * 자체 완결형 TypeScript 스니펫(.ts)으로 다운로드한다. (기존 PPT/Excel/.lifx 와 별개의 추가 기능)
 */
export function RecomputeExportButton({ productName, modules }: Props) {
  const [state, setState] = useState<ButtonState>("idle");
  const [toast, setToast] = useState<string | null>(null);

  const { ready, reason } = canExportRecompute(modules);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const handleClick = () => {
    if (!ready) return;
    try {
      const { fileName } = exportRecomputeSnippet(productName, modules);
      setState("done");
      showToast(`✅ 재계산 함수를 내보냈습니다: ${fileName}`);
      setTimeout(() => setState("idle"), 2000);
    } catch (err) {
      console.error("재계산 함수 내보내기 오류:", err);
      setState("error");
      showToast(
        `❌ 내보내기 중 오류가 발생했습니다: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      setTimeout(() => setState("idle"), 3000);
    }
  };

  const isDisabled = !ready || state === "done" || state === "error";

  let label = "🧮 재계산 함수";
  let className =
    "flex items-center gap-2 px-3 py-1.5 text-xs rounded-md font-semibold transition-colors flex-shrink-0 text-white";

  if (!ready) {
    className += " bg-gray-500 opacity-50 cursor-not-allowed";
  } else if (state === "done") {
    label = "✅ 완료";
    className += " bg-green-700 cursor-default";
  } else if (state === "error") {
    label = "❌ 오류";
    className += " bg-red-700 cursor-default";
  } else {
    className += " bg-teal-700 hover:bg-teal-600 cursor-pointer";
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isDisabled}
        className={className}
        title={
          ready
            ? "보험료/준비금 산출을 외부에서 재현할 수 있는 TypeScript 함수로 내보냅니다."
            : reason ?? "파이프라인 실행 후 사용 가능"
        }
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
