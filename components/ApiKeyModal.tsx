import React, { useState, useEffect } from "react";
import { GoogleGenAI } from "@google/genai";
import { XCircleIcon, KeyIcon, CheckIcon } from "./icons";
import { maskKey } from "../utils/apiKey";

interface ApiKeyModalProps {
  isOpen: boolean;
  currentKey: string;
  onClose: () => void;
  onSave: (key: string) => void;
  onClear: () => void;
}

type TestState = {
  status: "idle" | "testing" | "ok" | "fail";
  message?: string;
};

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  currentKey,
  onClose,
  onSave,
  onClear,
}) => {
  const [input, setInput] = useState("");
  const [show, setShow] = useState(false);
  const [test, setTest] = useState<TestState>({ status: "idle" });

  useEffect(() => {
    if (isOpen) {
      setInput("");
      setShow(false);
      setTest({ status: "idle" });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const runTest = async (key: string): Promise<boolean> => {
    setTest({ status: "testing" });
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: "ping",
      });
      setTest({ status: "ok", message: "키가 정상 동작합니다." });
      return true;
    } catch (e) {
      console.error("API key test failed:", e);
      setTest({
        status: "fail",
        message: "키 검증에 실패했습니다. 키 값을 다시 확인해 주세요.",
      });
      return false;
    }
  };

  const handleSaveWithTest = async () => {
    const key = input.trim();
    if (!key) return;
    const ok = await runTest(key);
    if (ok) onSave(key);
  };

  const handleSaveWithoutTest = () => {
    const key = input.trim();
    if (!key) return;
    onSave(key);
  };

  const isTesting = test.status === "testing";

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
            <KeyIcon className="w-5 h-5 text-purple-500" />
            Gemini API 키 설정
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
            AI 기능(파이프라인 자동 생성 · 결과 해석)을 사용하려면 본인의 Gemini
            API 키가 필요합니다. 키는{" "}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-600 dark:text-purple-400 font-medium underline"
            >
              Google AI Studio
            </a>
            에서 무료로 발급받을 수 있습니다.
          </p>

          {currentKey && (
            <div className="flex items-center justify-between gap-2 text-sm bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-md px-3 py-2">
              <span className="text-green-700 dark:text-green-300 flex items-center gap-1.5">
                <CheckIcon className="w-4 h-4" />
                저장된 키: <span className="font-mono">{maskKey(currentKey)}</span>
              </span>
              <button
                onClick={onClear}
                className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline"
              >
                키 삭제
              </button>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
              {currentKey ? "새 키 입력 (교체)" : "API 키 입력"}
            </label>
            <div className="flex items-stretch gap-2">
              <input
                type={show ? "text" : "password"}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  if (test.status !== "idle") setTest({ status: "idle" });
                }}
                placeholder="AIza..."
                autoComplete="off"
                spellCheck={false}
                className="flex-1 px-3 py-2 text-sm font-mono rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
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

          {test.status === "ok" && (
            <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1.5">
              <CheckIcon className="w-4 h-4" />
              {test.message}
            </p>
          )}
          {test.status === "fail" && (
            <p className="text-sm text-red-600 dark:text-red-400">{test.message}</p>
          )}

          <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-md p-3 leading-relaxed">
            🔒 키는 이 브라우저(localStorage)에만 저장되며 별도 서버로 전송되지
            않습니다. AI 호출은 브라우저에서 Google API로 직접 전송됩니다. 공용
            PC에서는 사용 후 <strong>키 삭제</strong>를 권장합니다.
          </div>
        </main>

        <footer className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleSaveWithoutTest}
            disabled={!input.trim() || isTesting}
            className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            검증 없이 저장
          </button>
          <button
            onClick={handleSaveWithTest}
            disabled={!input.trim() || isTesting}
            className="px-4 py-2 text-sm font-semibold text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-wait"
          >
            {isTesting ? "검증 중..." : "검증 후 저장"}
          </button>
        </footer>
      </div>
    </div>
  );
};
