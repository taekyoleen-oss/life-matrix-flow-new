import React, { useState, useEffect } from "react";
import {
  XMarkIcon,
  PencilIcon,
  TrashIcon,
  ArrowUpTrayIcon,
} from "@heroicons/react/24/outline";
import {
  isSupabaseConfigured,
  fetchAutoflowSamplesList,
  updateAutoflowSample,
  deleteAutoflowSample,
  createSampleModel,
  createAutoflowSample,
} from "../utils/supabase-samples";

/** 샘플 관리용 타입 (Supabase autoflow_samples 기준) */
type ManagementSample = {
  id: string;
  filename: string;
  name: string;
  input_data?: string;
  description?: string;
  category?: string;
  created_at?: string;
  updated_at?: string;
  app_section?: string;
  developer_email?: string;
  model_name?: string;
  input_data_name?: string | null;
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export const SamplesManagementModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onRefresh,
}) => {
  const [samples, setSamples] = useState<ManagementSample[]>([]);
  const [editing, setEditing] = useState<ManagementSample | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    input_data: "",
    description: "",
    category: "생명기타",
    app_section: "LIFE",
    developer_email: "",
  });

  useEffect(() => {
    if (isOpen) {
      loadSamples();
    }
  }, [isOpen]);

  const loadSamples = async () => {
    setLoading(true);
    try {
      if (!isSupabaseConfigured()) {
        setSamples([]);
        return;
      }
      const list = await fetchAutoflowSamplesList();
      const mapped: ManagementSample[] = list.map((s) => ({
        id: s.id,
        filename: s.model_name,
        name: s.model_name,
        input_data: s.input_data_name ?? undefined,
        description: s.description ?? undefined,
        category: s.category ?? "생명기타",
        created_at: s.created_at,
        updated_at: s.updated_at,
        app_section: s.app_section,
        developer_email: s.developer_email ?? undefined,
        model_name: s.model_name,
        input_data_name: s.input_data_name,
      }));
      setSamples(mapped);
    } catch (error: any) {
      console.error("Failed to load samples:", error);
      setSamples([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!isSupabaseConfigured()) return;
    if (!confirm("정말 이 샘플을 삭제하시겠습니까?")) return;
    try {
      const ok = await deleteAutoflowSample(id);
      if (!ok) throw new Error("삭제 실패");
      await loadSamples();
      onRefresh();
      alert("삭제되었습니다.");
    } catch (error: any) {
      alert("삭제 실패: " + error.message);
    }
  };

  const handleEdit = (sample: ManagementSample) => {
    setEditing(sample);
    setFormData({
      name: sample.name,
      input_data: (sample.input_data ?? sample.input_data_name) ?? "",
      description: sample.description || "",
      category: sample.category || "생명기타",
      app_section: sample.app_section || "LIFE",
      developer_email: sample.developer_email || "",
    });
  };

  const handleSave = async () => {
    if (!editing || !editing.id || !isSupabaseConfigured()) return;
    if (!formData.name?.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }
    try {
      setLoading(true);
      const ok = await updateAutoflowSample(editing.id, {
        app_section: formData.app_section || "LIFE",
        category: formData.category || "생명기타",
        developer_email: formData.developer_email || null,
        description: formData.description || null,
      });
      if (!ok) throw new Error("수정 실패");
      setEditing(null);
      setFormData({
        name: "",
        input_data: "",
        description: "",
        category: "생명기타",
        app_section: "LIFE",
        developer_email: "",
      });
      await loadSamples();
      onRefresh();
      alert("저장되었습니다.");
    } catch (error: any) {
      console.error("handleSave: Update failed", error);
      alert("저장 실패: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (
      editing &&
      (formData.name !== (editing.name || "") ||
        formData.input_data !== (editing.input_data ?? editing.input_data_name ?? "") ||
        formData.description !== (editing.description || "") ||
        formData.category !== (editing.category || "생명기타") ||
        formData.app_section !== (editing.app_section || "LIFE") ||
        formData.developer_email !== (editing.developer_email || ""))
    ) {
      if (!confirm("변경사항이 있습니다. 정말 취소하시겠습니까? 변경사항은 저장되지 않습니다.")) {
        return;
      }
    }
    setEditing(null);
    setFormData({
      name: "",
      input_data: "",
      description: "",
      category: "생명기타",
      app_section: "LIFE",
      developer_email: "",
    });
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isSupabaseConfigured()) {
      alert("Supabase를 설정하면 파일에서 가져오기를 사용할 수 있습니다.");
      e.target.value = "";
      return;
    }
    if (!file.name.endsWith(".lifx") && !file.name.endsWith(".json")) {
      alert("지원하는 파일 형식은 .lifx 또는 .json입니다.");
      return;
    }
    try {
      setLoading(true);
      const text = await file.text();
      let data: { name?: string; modules?: unknown[]; connections?: unknown[] };
      try {
        data = JSON.parse(text);
      } catch {
        alert("유효한 JSON 파일이 아닙니다.");
        return;
      }
      const name = data.name || data.projectName || file.name.replace(/\.(lifx|json)$/i, "");
      const modules = Array.isArray(data.modules) ? data.modules : [];
      const connections = Array.isArray(data.connections) ? data.connections : [];
      const modelResult = await createSampleModel(name, { modules, connections });
      if (!modelResult) throw new Error("모델 생성 실패");
      const sampleResult = await createAutoflowSample({
        app_section: "LIFE",
        category: "생명기타",
        model_id: modelResult.id,
        description: "",
      });
      if (!sampleResult) throw new Error("샘플 등록 실패");
      await loadSamples();
      onRefresh();
      alert("파일이 성공적으로 가져와졌습니다.");
      e.target.value = "";
    } catch (error: any) {
      alert("가져오기 실패: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: "90vh" }}
      >
        {/* 헤더 */}
        <div className="p-4 border-b border-gray-300 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            샘플 관리
          </h2>
          <button
            onClick={onClose}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Close"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* 파일 가져오기 (Supabase 설정 시에만 사용 가능) */}
        <div className="p-4 border-b border-gray-300 dark:border-gray-700 flex-shrink-0">
          <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            파일에서 가져오기 (.lifx, .json)
          </label>
          <div className="flex items-center gap-2">
            <label className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${isSupabaseConfigured() ? "bg-purple-600 hover:bg-purple-700 text-white cursor-pointer" : "bg-gray-400 dark:bg-gray-600 text-gray-200 cursor-not-allowed"}`}>
              <ArrowUpTrayIcon className="w-5 h-5" />
              <span>파일 선택</span>
              <input
                type="file"
                accept=".lifx,.json"
                onChange={handleFileImport}
                className="hidden"
                disabled={loading || !isSupabaseConfigured()}
              />
            </label>
            {loading && (
              <span className="text-gray-600 dark:text-gray-400 text-sm">
                처리 중...
              </span>
            )}
          </div>
        </div>

        {/* 샘플 목록 */}
        <div
          className={`flex-1 overflow-y-auto p-4 ${editing ? "pb-2" : ""}`}
          style={{
            maxHeight: editing ? "calc(90vh - 400px)" : "calc(90vh - 200px)",
          }}
        >
          {loading && samples.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-600 dark:text-gray-400 text-lg">
                로딩 중...
              </div>
            </div>
          ) : samples.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <div className="text-gray-600 dark:text-gray-400 text-lg">
                {isSupabaseConfigured() ? "샘플이 없습니다" : "Supabase를 설정하면 샘플 관리가 가능합니다"}
              </div>
              {!isSupabaseConfigured() && (
                <p className="text-gray-500 dark:text-gray-500 text-sm max-w-md text-center">
                  .env에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 설정하고, Supabase에 스키마를 적용하세요.
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-300 dark:border-gray-700">
                    <th className="text-left p-3 text-gray-700 dark:text-gray-300 font-semibold">
                      이름
                    </th>
                    <th className="text-left p-3 text-gray-300 font-semibold">
                      대구분
                    </th>
                    <th className="text-left p-3 text-gray-300 font-semibold">
                      카테고리
                    </th>
                    <th className="text-left p-3 text-gray-300 font-semibold">
                      개발자
                    </th>
                    <th className="text-left p-3 text-gray-300 font-semibold">
                      입력 데이터
                    </th>
                    <th className="text-left p-3 text-gray-300 font-semibold">
                      설명
                    </th>
                    <th className="text-left p-3 text-gray-300 font-semibold">
                      생성일
                    </th>
                    <th className="text-left p-3 text-gray-300 font-semibold">
                      작업
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {samples.map((sample) => (
                    <tr
                      key={sample.id}
                      className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="p-3 text-gray-900 dark:text-white font-medium">
                        {sample.name}
                      </td>
                      <td className="p-3 text-gray-600 dark:text-gray-400 text-xs">
                        {sample.app_section || "-"}
                      </td>
                      <td className="p-3 text-gray-600 dark:text-gray-400">
                        <span className="px-2 py-1 bg-purple-600/20 text-purple-300 rounded text-xs">
                          {sample.category || "생명기타"}
                        </span>
                      </td>
                      <td className="p-3 text-gray-600 dark:text-gray-400 text-xs max-w-[120px] truncate">
                        {sample.developer_email || "-"}
                      </td>
                      <td className="p-3 text-gray-600 dark:text-gray-400">
                        {sample.input_data ?? sample.input_data_name ?? "-"}
                      </td>
                      <td className="p-3 text-gray-400 max-w-md truncate">
                        {sample.description || "-"}
                      </td>
                      <td className="p-3 text-gray-500 dark:text-gray-500 text-xs">
                        {sample.created_at
                          ? new Date(sample.created_at).toLocaleDateString(
                              "ko-KR"
                            )
                          : "-"}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(sample)}
                            className="text-blue-400 hover:text-blue-300 transition-colors p-1 rounded"
                            title="수정"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(sample.id)}
                            className="text-red-400 hover:text-red-300 transition-colors p-1 rounded"
                            title="삭제"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 수정 폼 - 하단 고정 */}
        {editing && (
          <div
            className="p-4 border-t-2 border-purple-600 bg-gray-50 dark:bg-gray-800 flex-shrink-0 shadow-lg overflow-y-auto"
            style={{ maxHeight: "400px" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                샘플 수정
              </h3>
              <button
                type="button"
                onClick={handleCancel}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                title="닫기"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                  이름 (모델명)
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded border border-gray-300 dark:border-gray-600 focus:border-purple-500 focus:outline-none"
                  readOnly
                  placeholder="모델명은 별도 테이블에서 관리됩니다"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                  대구분
                </label>
                <select
                  value={formData.app_section}
                  onChange={(e) =>
                    setFormData({ ...formData, app_section: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded border border-gray-300 dark:border-gray-600 focus:border-purple-500 focus:outline-none"
                >
                  <option value="LIFE">LIFE</option>
                  <option value="ML">ML</option>
                  <option value="DFA">DFA</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                  개발자 (이메일)
                </label>
                <input
                  type="email"
                  value={formData.developer_email}
                  onChange={(e) =>
                    setFormData({ ...formData, developer_email: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded border border-gray-300 dark:border-gray-600 focus:border-purple-500 focus:outline-none"
                  placeholder="developer@example.com"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                  입력 데이터
                </label>
                <input
                  type="text"
                  value={formData.input_data}
                  onChange={(e) =>
                    setFormData({ ...formData, input_data: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded border border-gray-300 dark:border-gray-600 focus:border-purple-500 focus:outline-none"
                  placeholder="예: Risk Rates"
                  readOnly
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                  카테고리
                </label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded border border-gray-300 dark:border-gray-600 focus:border-purple-500 focus:outline-none"
                >
                  <option value="종신보험">종신보험</option>
                  <option value="건강보험">건강보험</option>
                  <option value="상해보험">상해보험</option>
                  <option value="운전자">운전자</option>
                  <option value="생명기타">생명기타</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                  설명
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded border border-gray-300 dark:border-gray-600 focus:border-purple-500 focus:outline-none"
                  rows={3}
                  placeholder="모델에 대한 설명을 입력하세요"
                />
              </div>
              <div className="flex gap-3 justify-end pt-4 mt-4 border-t-2 border-gray-300 dark:border-gray-600 sticky bottom-0 bg-gray-50 dark:bg-gray-800 pb-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={loading}
                  className="px-5 py-2.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 active:bg-gray-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed min-w-[80px] flex items-center justify-center"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={loading}
                  className="px-6 py-2.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 active:bg-purple-800 transition-colors font-semibold shadow-lg shadow-purple-600/30 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[100px]"
                >
                  {loading ? (
                    <>
                      <svg
                        className="animate-spin h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      <span>저장 중...</span>
                    </>
                  ) : (
                    "저장"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
