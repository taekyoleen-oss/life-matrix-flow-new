import React, { useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  /** 래퍼 span의 클래스 (flex 레이아웃 정렬용) */
  wrapperClassName?: string;
}

/**
 * 마우스 오버/포커스 시 설명 박스를 띄우는 가벼운 툴팁.
 * document.body로 portal 렌더하여 헤더의 overflow/clip 영향을 받지 않는다.
 */
export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  wrapperClassName = "inline-flex flex-shrink-0",
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const show = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const half = 130; // 최대폭(260px)의 절반 — 화면 밖으로 안 나가게 클램프
    const x = Math.min(
      Math.max(r.left + r.width / 2, half + 6),
      window.innerWidth - half - 6
    );
    setPos({ x, y: r.bottom + 8 });
  }, []);

  const hide = useCallback(() => setPos(null), []);

  return (
    <span
      ref={ref}
      className={wrapperClassName}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {pos &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: "fixed",
              left: pos.x,
              top: pos.y,
              transform: "translateX(-50%)",
              zIndex: 99999,
            }}
            className="pointer-events-none w-max max-w-[260px] whitespace-normal rounded-lg bg-gray-900 text-white text-[11px] leading-relaxed px-3 py-2 shadow-2xl ring-1 ring-white/10"
          >
            {content}
          </div>,
          document.body
        )}
    </span>
  );
};
