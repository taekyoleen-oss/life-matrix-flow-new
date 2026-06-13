import React, { useState, useEffect } from "react";
import { XCircleIcon, LockClosedIcon, LockOpenIcon, CheckIcon } from "./icons";

interface AdvancedUnlockModalProps {
  isOpen: boolean;
  isUnlocked: boolean;
  /** 비밀번호 자체가 빌드에 설정되지 않은 경우 true */
  passwordConfigured: boolean;
  onClose: () => void;
  /** 비밀번호 검증. 성공 시 true 반환 */
  onUnlock: (password: string) => boolean;
  onLock: () => void;
}

export const AdvancedUnlockModal: React.FC<AdvancedUnlockModalProps> = ({
  isOpen,
  isUnlocked,
  passwordConfigured,
  onClose,
  onUnlock,
  onLock,
}) => {
  const [input, setInput] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setInput("");
      setShow(false);
      setError("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUnlock = () => {
    const pw = input.trim();
    if (!pw) return;
    const ok = onUnlock(pw);
    if (!ok) {
      setError("비밀번호가 올바르지 않습니다.");
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg shadow-xl w-full max-w-lg flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold flex items-center gap-2">
            {isUnlocked ? (
              <LockOpenIcon className="w-5 h-5 text-amber-500" />
            ) : (
              <LockClosedIcon className="w-5 h-5 text-amber-500" />
            )}
            고급기능 {isUnlocked ? "(잠금 해제됨)" : "잠금 해제"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
          >
            <XCircleIcon className="w-6 h-6" />
          </button>
        </header>

        <main className="p-5 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
            고급기능(<strong>DSL 정의 · AI 생성 · AI 키 설정 · 슬라이드(PPT) 보고서 ·
            초기 화면 설정</strong>)을 사용하려면 비밀번호가 필요합니다. 일반
            사용자는 비밀번호 없이도 모듈 배치 · 연결 · 파라미터 입력 ·
            <strong>전체 실행</strong> · 결과 확인을 모두 사용할 수 있습니다.
          </p>

          {isUnlocked ? (
            <div className="flex items-center justify-between gap-2 text-sm bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2">
              <span className="text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                <CheckIcon className="w-4 h-4" />
                고급기능이 활성화되어 있습니다.
              </span>
              <button
                onClick={onLock}
                className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline"
              >
                다시 잠그기
              </button>
            </div>
          ) : !passwordConfigured ? (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md p-3 leading-relaxed">
              고급기능 비밀번호가 설정되지 않았습니다. 환경변수{" "}
              <span className="font-mono">VITE_ADVANCED_PASSWORD</span> 를 설정한 뒤
              다시 빌드/실행해 주세요.
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
                  비밀번호 입력
                </label>
                <div className="flex items-stretch gap-2">
                  <input
                    type={show ? "text" : "password"}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      if (error) setError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleUnlock();
                    }}
                    placeholder="고급기능 비밀번호"
                    autoComplete="off"
                    spellCheck={false}
                    autoFocus
                    className="flex-1 px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="px-3 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    {show ? "숨김" : "표시"}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              )}

              <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-md p-3 leading-relaxed">
                🔒 해제 상태는 이 브라우저에 기억되어 새로고침/재방문 시에도
                유지됩니다. 공용 PC에서는 사용 후 <strong>다시 잠그기</strong>를
                권장합니다.
              </div>
            </>
          )}
        </main>

        {!isUnlocked && passwordConfigured && (
          <footer className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleUnlock}
              disabled={!input.trim()}
              className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 rounded-md hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              잠금 해제
            </button>
          </footer>
        )}
      </div>
    </div>
  );
};
