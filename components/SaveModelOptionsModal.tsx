import React, { useEffect, useMemo, useState } from "react";

/** 저장 대상 모델 안의 데이터 로더(LoadData 등) 1건의 정보. */
export interface LoaderDataInfo {
  moduleId: string;
  name: string; // 모듈 표시 이름
  source: string; // 파일명
  sizeMB: number; // 임베드 본문 크기(MB)
  hasContent: boolean; // 현재 fileContent 보유 여부
  description: string; // 기존 데이터 설명(위치/출처)
}

/** 로더 1건에 대한 저장 결정. */
export interface SaveDataDecision {
  include: boolean; // 데이터 본문을 모델에 포함(임베드)
  registerToWeb: boolean; // Supabase 'datasets'에 웹 예제로 등록(참조 저장)
  description: string; // 데이터 설명(항상 저장)
}

export type SaveDecisions = Record<string, SaveDataDecision>;

interface SaveModelOptionsModalProps {
  isOpen: boolean;
  title: string; // 예: "내 작업으로 저장" / "Sample로 저장"
  defaultName: string;
  loaders: LoaderDataInfo[];
  embedLimitMB: number;
  isSaving: boolean;
  onConfirm: (name: string, decisions: SaveDecisions) => void;
  onClose: () => void;
}

/**
 * 모델 저장 옵션 모달.
 * - 데이터 파일별로 "포함(임베드) / 제외(참조만) / 웹 예제로 등록"을 선택.
 * - 용량이 임계(embedLimitMB)를 넘으면 임베드 불가를 안내하고 웹 등록을 유도.
 * - 데이터 설명(위치·출처)을 포함 여부와 무관하게 입력 가능.
 */
export const SaveModelOptionsModal: React.FC<SaveModelOptionsModalProps> = ({
  isOpen,
  title,
  defaultName,
  loaders,
  embedLimitMB,
  isSaving,
  onConfirm,
  onClose,
}) => {
  const [name, setName] = useState(defaultName);
  const [decisions, setDecisions] = useState<SaveDecisions>({});

  // 모달이 열릴 때 기본값 초기화.
  useEffect(() => {
    if (!isOpen) return;
    setName(defaultName);
    const init: SaveDecisions = {};
    for (const l of loaders) {
      const tooLarge = l.hasContent && l.sizeMB > embedLimitMB;
      init[l.moduleId] = {
        // 용량 초과 시 임베드 불가 → 기본 제외. 본문 없으면 참조만.
        include: l.hasContent && !tooLarge,
        // 용량 초과면 웹 등록을 기본 제안(데이터를 잃지 않도록).
        registerToWeb: tooLarge,
        description: l.description || "",
      };
    }
    setDecisions(init);
  }, [isOpen, defaultName, loaders, embedLimitMB]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSaving) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, isSaving]);

  const totalEmbeddedMB = useMemo(() => {
    return loaders.reduce((sum, l) => {
      const d = decisions[l.moduleId];
      return sum + (d?.include ? l.sizeMB : 0);
    }, 0);
  }, [loaders, decisions]);

  if (!isOpen) return null;

  const setDecision = (moduleId: string, patch: Partial<SaveDataDecision>) => {
    setDecisions((prev) => ({
      ...prev,
      [moduleId]: { ...prev[moduleId], ...patch },
    }));
  };

  const handleConfirm = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed, decisions);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={() => !isSaving && onClose()}
    >
      <div
        className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl shadow-2xl w-[560px] max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span aria-hidden>💾</span>
            {title}
          </h2>
          <button
            onClick={() => !isSaving && onClose()}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* 모델 이름 */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              모델 이름
            </label>
            <input
              type="text"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirm();
              }}
              placeholder="모델 이름 입력"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {loaders.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              이 모델에는 데이터 로더(LoadData)가 없습니다. 구성만 저장됩니다.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                데이터 파일을 모델에 함께 저장할지 선택하세요. 임베드 한도는{" "}
                <b>{embedLimitMB}MB</b>이며, 초과 시{" "}
                <b>웹 예제(Supabase)로 등록</b>해 이름(참조)으로 저장할 수 있습니다.
              </p>

              {loaders.map((l) => {
                const d = decisions[l.moduleId] || {
                  include: false,
                  registerToWeb: false,
                  description: "",
                };
                const tooLarge = l.hasContent && l.sizeMB > embedLimitMB;
                return (
                  <div
                    key={l.moduleId}
                    className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {l.name}
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                          {l.source || "(파일명 없음)"} ·{" "}
                          {l.hasContent
                            ? `${l.sizeMB.toFixed(2)}MB`
                            : "데이터 본문 없음(참조)"}
                        </div>
                      </div>
                    </div>

                    {/* 용량 초과 경고 */}
                    {tooLarge && (
                      <div className="rounded-md border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-2 text-[11px] text-amber-700 dark:text-amber-300">
                        ⚠ 용량({l.sizeMB.toFixed(2)}MB)이 임베드 한도(
                        {embedLimitMB}MB)를 초과해 모델에 직접 저장할 수 없습니다.
                        아래 <b>웹 예제로 등록</b>을 선택하면 데이터를 잃지 않고
                        이름(참조)으로 저장됩니다.
                      </div>
                    )}

                    {/* 옵션 */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                      <label
                        className={`flex items-center gap-1.5 text-[11px] ${
                          !l.hasContent || tooLarge
                            ? "text-gray-400 cursor-not-allowed"
                            : "text-gray-700 dark:text-gray-300 cursor-pointer"
                        }`}
                        title={
                          tooLarge
                            ? "용량 초과로 포함할 수 없습니다."
                            : !l.hasContent
                            ? "포함할 데이터 본문이 없습니다."
                            : ""
                        }
                      >
                        <input
                          type="checkbox"
                          disabled={!l.hasContent || tooLarge}
                          checked={d.include}
                          onChange={(e) =>
                            setDecision(l.moduleId, {
                              include: e.target.checked,
                            })
                          }
                        />
                        데이터 포함(임베드)
                      </label>

                      <label
                        className={`flex items-center gap-1.5 text-[11px] ${
                          !l.hasContent
                            ? "text-gray-400 cursor-not-allowed"
                            : "text-gray-700 dark:text-gray-300 cursor-pointer"
                        }`}
                        title={
                          !l.hasContent
                            ? "등록할 데이터 본문이 없습니다."
                            : "Supabase 'datasets' 버킷에 업로드해 참조로 저장합니다."
                        }
                      >
                        <input
                          type="checkbox"
                          disabled={!l.hasContent}
                          checked={d.registerToWeb}
                          onChange={(e) =>
                            setDecision(l.moduleId, {
                              registerToWeb: e.target.checked,
                            })
                          }
                        />
                        웹 예제로 등록(참조 저장)
                      </label>
                    </div>

                    {/* 데이터 설명(위치/출처) — 포함 여부와 무관하게 입력 가능 */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                        데이터 설명(위치·출처 등)
                      </label>
                      <textarea
                        value={d.description}
                        onChange={(e) =>
                          setDecision(l.moduleId, {
                            description: e.target.value,
                          })
                        }
                        rows={2}
                        placeholder="예: 사내 공유드라이브 /data/sales.csv, 또는 https://… (참조 저장 시 데이터 위치를 남겨두세요)"
                        className="w-full px-2.5 py-1.5 text-[11px] rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
                      />
                    </div>
                  </div>
                );
              })}

              {/* 임베드 합계 안내 */}
              <div className="text-[11px] text-gray-500 dark:text-gray-400">
                포함될 데이터 총량: <b>{totalEmbeddedMB.toFixed(2)}MB</b>
                {totalEmbeddedMB > 4 && (
                  <span className="text-amber-600 dark:text-amber-400">
                    {" "}
                    · 브라우저 저장 한도(약 5MB)에 근접합니다. 일부를 웹 예제로
                    등록하는 것을 권장합니다.
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 flex items-center justify-end gap-2">
          <button
            onClick={() => !isSaving && onClose()}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSaving || !name.trim()}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaveModelOptionsModal;
