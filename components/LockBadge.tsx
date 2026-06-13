import React from "react";
import { LockClosedIcon } from "./icons";

/**
 * 잠긴(고급) 버튼 모서리에 표시되는 앰버색 원형 자물쇠 배지.
 * 부모 요소에 `relative`가 필요하다.
 */
export const LockBadge: React.FC<{ className?: string }> = ({ className = "" }) => (
  <span
    aria-label="잠김 — 고급기능"
    className={`pointer-events-none absolute -top-2 -right-2 flex items-center justify-center h-5 w-5 rounded-full bg-amber-500 text-white shadow-md ring-2 ring-white dark:ring-gray-900 ${className}`}
  >
    <LockClosedIcon className="h-3 w-3" />
  </span>
);
