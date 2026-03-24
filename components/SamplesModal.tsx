import React from "react";
import { XMarkIcon, PlusCircleIcon, PencilIcon } from "@heroicons/react/24/outline";
import {
  isSupabaseConfigured,
  createSampleModel,
  createSampleInputData,
  createAutoflowSample,
  updateSampleModel,
  updateAutoflowSample,
  updateSampleModelContent,
  fetchAutoflowSampleById,
} from "../utils/supabase-samples";

interface Sample {
  id?: number | string; // DB(Supabase uuid 또는 로컬 id)에서 로드할 때 사용
  modelId?: string;
  filename: string;
  name: string;
  data: any;
  inputData?: string;
  description?: string;
  category?: string;
  appSection?: string;
  developerEmail?: string;
}

interface SamplesModalProps {
  isOpen: boolean;
  onClose: () => void;
  samples: Array<{
    id?: number | string;
    modelId?: string;
    filename: string;
    name: string;
    data: any;
    inputData?: string;
    description?: string;
    category?: string;
    appSection?: string;
    developerEmail?: string;
  }>;
  onLoadSample: (
    sampleName: string,
    filename: string,
    sampleId?: number | string
  ) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

const CATEGORIES = [
  "전체",
  "종신보험",
  "건강보험",
  "상해보험",
  "운전자",
  "생명기타",
] as const;

type TabType = "list" | "register";

const SamplesModal: React.FC<SamplesModalProps> = ({
  isOpen,
  onClose,
  samples,
  onLoadSample,
  onRefresh,
  isLoading = false,
}) => {
  const [selectedCategory, setSelectedCategory] =
    React.useState<string>("전체");
  const [tab, setTab] = React.useState<TabType>("list");
  const [registering, setRegistering] = React.useState(false);
  const [registerError, setRegisterError] = React.useState<string | null>(null);
  const [registerForm, setRegisterForm] = React.useState({
    modelName: "",
    modelFile: null as File | null,
    inputDataName: "",
    inputDataFile: null as File | null,
    app_section: "LIFE",
    category: "종신보험",
    developer_email: "",
    description: "",
  });
  const [editingSample, setEditingSample] = React.useState<Sample | null>(null);
  const [editForm, setEditForm] = React.useState({
    name: "",
    category: "종신보험",
    description: "",
    developer_email: "",
    modelFile: null as File | null,
    inputDataFile: null as File | null,
    inputDataName: "",
  });
  const [editSaving, setEditSaving] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);
  const [editLoadingContent, setEditLoadingContent] = React.useState(false);
  const [editCurrentContent, setEditCurrentContent] = React.useState<{
    modelName: string;
    modelJson: string | null;
    inputDataName: string | null;
    inputDataContent: string | null;
  } | null>(null);

  // Samples 닫을 때 등록 탭·편집 초기화
  React.useEffect(() => {
    if (!isOpen) {
      setTab("list");
      setEditingSample(null);
    }
  }, [isOpen]);

  const handleEditOpen = async (sample: Sample) => {
    setEditingSample(sample);
    setEditError(null);
    setEditCurrentContent(null);
    setEditForm({
      name: sample.name,
      category: sample.category || "종신보험",
      description: sample.description || "",
      developer_email: sample.developerEmail || "",
      modelFile: null,
      inputDataFile: null,
      inputDataName: sample.inputData || "",
    });

    // Supabase에서 실제 첨부 파일 내용 로드
    if (sample.id && isSupabaseConfigured()) {
      setEditLoadingContent(true);
      try {
        const full = await fetchAutoflowSampleById(String(sample.id));
        if (full) {
          setEditCurrentContent({
            modelName: full.model_name,
            modelJson: JSON.stringify(full.file_content, null, 2),
            inputDataName: full.input_data_name,
            inputDataContent: full.input_data_content,
          });
        }
      } catch (e) {
        console.error("Failed to load sample content for edit:", e);
      } finally {
        setEditLoadingContent(false);
      }
    }
  };

  const handleDownloadModelJson = () => {
    if (!editCurrentContent?.modelJson) return;
    const blob = new Blob([editCurrentContent.modelJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${editCurrentContent.modelName || "model"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadInputData = () => {
    if (!editCurrentContent?.inputDataContent) return;
    const blob = new Blob([editCurrentContent.inputDataContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${editCurrentContent.inputDataName || "input_data"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleEditSave = async () => {
    if (!editingSample || !editingSample.id || !(editingSample as Sample & { modelId?: string }).modelId) return;
    const modelId = (editingSample as Sample & { modelId?: string }).modelId as string;
    setEditSaving(true);
    setEditError(null);
    try {
      await updateSampleModel(modelId, { name: editForm.name.trim() });

      let inputDataId: string | undefined = undefined;
      if (editForm.inputDataFile && editForm.inputDataName.trim()) {
        const content = await editForm.inputDataFile.text();
        const inputResult = await createSampleInputData(editForm.inputDataName.trim(), content);
        if (inputResult) inputDataId = inputResult.id;
      }

      if (editForm.modelFile) {
        const modelText = await editForm.modelFile.text();
        let modelData: { modules?: unknown[]; connections?: unknown[] };
        try {
          modelData = JSON.parse(modelText);
        } catch {
          setEditError("모델 파일이 올바른 JSON이 아닙니다.");
          setEditSaving(false);
          return;
        }
        const modules = Array.isArray(modelData.modules) ? modelData.modules : [];
        const connections = Array.isArray(modelData.connections) ? modelData.connections : [];
        await updateSampleModelContent(modelId, { modules, connections });
      }

      await updateAutoflowSample(String(editingSample.id), {
        category: editForm.category || null,
        description: editForm.description.trim() || null,
        developer_email: editForm.developer_email.trim() || null,
        ...(inputDataId ? { input_data_id: inputDataId } : {}),
      });
      setEditingSample(null);
      onRefresh?.();
    } catch (e) {
      console.error("Edit sample failed:", e);
      setEditError("저장 중 오류가 발생했습니다.");
    } finally {
      setEditSaving(false);
    }
  };

  if (!isOpen) return null;

  const handleClose = () => {
    setTab("list");
    onClose();
  };

  const handleLoad = (sample: Sample) => {
    onLoadSample(sample.name, sample.filename, sample.id);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured()) {
      setRegisterError("Supabase가 설정되지 않았습니다. .env를 확인하세요.");
      return;
    }
    if (!registerForm.modelName.trim()) {
      setRegisterError("모델명을 입력하세요.");
      return;
    }
    if (!registerForm.modelFile) {
      setRegisterError("모델 파일(.lifx 또는 .json)을 선택하세요.");
      return;
    }
    setRegisterError(null);
    setRegistering(true);
    try {
      const modelText = await registerForm.modelFile.text();
      let modelData: { modules?: unknown[]; connections?: unknown[] };
      try {
        modelData = JSON.parse(modelText);
      } catch {
        setRegisterError("모델 파일이 올바른 JSON이 아닙니다.");
        setRegistering(false);
        return;
      }
      const modules = Array.isArray(modelData.modules) ? modelData.modules : [];
      const connections = Array.isArray(modelData.connections) ? modelData.connections : [];
      const modelResult = await createSampleModel(registerForm.modelName.trim(), {
        modules,
        connections,
      });
      if (!modelResult) {
        setRegisterError("모델 등록에 실패했습니다.");
        setRegistering(false);
        return;
      }
      let inputDataId: string | null = null;
      if (registerForm.inputDataFile && registerForm.inputDataName.trim()) {
        const content = await registerForm.inputDataFile.text();
        const inputResult = await createSampleInputData(
          registerForm.inputDataName.trim(),
          content
        );
        if (inputResult) inputDataId = inputResult.id;
      }
      const sampleResult = await createAutoflowSample({
        app_section: "LIFE",
        category: registerForm.category || null,
        developer_email: registerForm.developer_email.trim() || null,
        model_id: modelResult.id,
        input_data_id: inputDataId,
        description: registerForm.description.trim() || null,
      });
      if (!sampleResult) {
        setRegisterError("샘플 등록에 실패했습니다.");
        setRegistering(false);
        return;
      }
      setRegisterForm({
        modelName: "",
        modelFile: null,
        inputDataName: "",
        inputDataFile: null,
        app_section: "LIFE",
        category: "종신보험",
        developer_email: "",
        description: "",
      });
      setTab("list");
      onRefresh?.();
      alert("샘플이 등록되었습니다.");
    } catch (err: any) {
      setRegisterError(err?.message || "등록 중 오류가 발생했습니다.");
    } finally {
      setRegistering(false);
    }
  };

  // 카테고리별 필터링
  const filteredSamples =
    selectedCategory === "전체"
      ? samples
      : samples.filter((sample) => sample.category === selectedCategory);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-300 dark:border-gray-700 z-10">
          <div className="p-4 flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Samples
            </h2>
            <div className="flex items-center gap-2">
              {isSupabaseConfigured() && (
                <button
                  onClick={() => { setTab(tab === "list" ? "register" : "list"); setRegisterError(null); }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    tab === "register"
                      ? "bg-purple-600 text-white"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                  }`}
                  title="샘플 등록"
                >
                  <PlusCircleIcon className="w-5 h-5" />
                  {tab === "list" ? "데이터 입력" : "목록 보기"}
                </button>
              )}
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-white transition-colors p-1 rounded-md hover:bg-gray-800"
                aria-label="Close"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
          </div>

          {tab === "list" && (
            <div className="px-4 pb-4 flex gap-2 overflow-x-auto">
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-md text-sm font-semibold whitespace-nowrap transition-colors ${
                    selectedCategory === category
                      ? "bg-purple-600 text-white"
                      : "bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 샘플 등록 폼 (데이터 입력) */}
        {tab === "register" && (
          <div className="flex-1 overflow-y-auto p-6">
            {!isSupabaseConfigured() ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                Supabase를 설정하면 샘플 등록이 가능합니다.
              </p>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="max-w-2xl mx-auto space-y-4">
                {registerError && (
                  <div className="p-3 rounded-md bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">
                    {registerError}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">모델명 *</label>
                  <input
                    type="text"
                    value={registerForm.modelName}
                    onChange={(e) => setRegisterForm((f) => ({ ...f, modelName: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white"
                    placeholder="예: Whole Life"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">모델 파일 (.lifx, .json) *</label>
                  <input
                    type="file"
                    accept=".lifx,.json"
                    onChange={(e) => setRegisterForm((f) => ({ ...f, modelFile: e.target.files?.[0] ?? null }))}
                    className="w-full text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-purple-600 file:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">입력 데이터 이름 (선택)</label>
                  <input
                    type="text"
                    value={registerForm.inputDataName}
                    onChange={(e) => setRegisterForm((f) => ({ ...f, inputDataName: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white"
                    placeholder="예: Risk_Rates_Whole"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">입력 데이터 파일 (.csv, .txt) (선택)</label>
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={(e) => setRegisterForm((f) => ({ ...f, inputDataFile: e.target.files?.[0] ?? null }))}
                    className="w-full text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-purple-600 file:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">카테고리</label>
                  <select
                    value={registerForm.category}
                    onChange={(e) => setRegisterForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white"
                  >
                    <option value="종신보험">종신보험</option>
                    <option value="건강보험">건강보험</option>
                    <option value="상해보험">상해보험</option>
                    <option value="운전자">운전자</option>
                    <option value="생명기타">생명기타</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">개발자 이메일</label>
                  <input
                    type="email"
                    value={registerForm.developer_email}
                    onChange={(e) => setRegisterForm((f) => ({ ...f, developer_email: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white"
                    placeholder="developer@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">모델 설명</label>
                  <textarea
                    value={registerForm.description}
                    onChange={(e) => setRegisterForm((f) => ({ ...f, description: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white"
                    rows={3}
                    placeholder="모델에 대한 설명을 입력하세요"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setTab("list")}
                    className="px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={registering}
                    className="px-6 py-2 rounded-md bg-purple-600 text-white font-medium hover:bg-purple-700 disabled:opacity-50"
                  >
                    {registering ? "등록 중..." : "DB 등록"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* 카드 그리드 (목록) */}
        {tab === "list" && (
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-400 text-lg">Loading samples...</div>
            </div>
          ) : filteredSamples.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-400 text-lg">
                {selectedCategory === "전체"
                  ? "No samples available"
                  : `'${selectedCategory}' 카테고리에 샘플이 없습니다.`}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSamples.map((sample) => (
                <div
                  key={sample.filename}
                  className="bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 p-6 hover:border-purple-500 transition-all duration-200 hover:shadow-lg hover:shadow-purple-500/20 flex flex-col relative"
                >
                  {isSupabaseConfigured() && sample.id && (sample as Sample & { modelId?: string }).modelId && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleEditOpen(sample); }}
                      className="absolute top-3 right-3 p-1.5 rounded-md text-gray-500 hover:text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                      title="편집"
                    >
                      <PencilIcon className="w-5 h-5" />
                    </button>
                  )}
                  {/* 카드 헤더 */}
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 truncate pr-8">
                    {sample.name}
                  </h3>

                  {/* 모델 정보 (대구분은 LIFE로 고정, 표시하지 않음) */}
                  <div className="space-y-3 mb-4 flex-1">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">
                        카테고리:{" "}
                      </span>
                      <span className="text-gray-900 dark:text-white text-sm">
                        {sample.category || "생명기타"}
                      </span>
                    </div>
                    {sample.developerEmail && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">
                          개발자:{" "}
                        </span>
                        <span className="text-gray-900 dark:text-white text-sm truncate">
                          {sample.developerEmail}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">
                        모델:{" "}
                      </span>
                      <span className="text-white text-sm truncate">
                        {sample.name}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">
                        입력데이터:{" "}
                      </span>
                      <span className="text-gray-900 dark:text-white text-sm">
                        {sample.inputData || "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">
                        모델 설명:
                      </span>
                      <p className="text-gray-700 dark:text-gray-300 text-sm mt-1 line-clamp-3">
                        {sample.description || "설명 없음"}
                      </p>
                    </div>
                  </div>

                  {/* 실행 버튼 */}
                  <button
                    onClick={() => handleLoad(sample)}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2.5 px-4 rounded-md transition-colors duration-200 mt-auto"
                  >
                    모델 실행
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {/* 샘플 편집 모달 */}
        {editingSample && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setEditingSample(null)}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">샘플 편집</h3>
              {editError && (
                <div className="p-3 rounded-md bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">{editError}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">이름</label>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white"
                  placeholder="모델명"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">카테고리</label>
                <select
                  value={editForm.category}
                  onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white"
                >
                  <option value="종신보험">종신보험</option>
                  <option value="건강보험">건강보험</option>
                  <option value="상해보험">상해보험</option>
                  <option value="운전자">운전자</option>
                  <option value="생명기타">생명기타</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">설명</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white"
                  rows={3}
                  placeholder="모델 설명"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">개발자 이메일</label>
                <input
                  type="email"
                  value={editForm.developer_email}
                  onChange={(e) => setEditForm((f) => ({ ...f, developer_email: e.target.value }))}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white"
                  placeholder="developer@example.com"
                />
              </div>
              {/* 첨부 파일 섹션 */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">첨부 파일</p>

                {editLoadingContent && (
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 py-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    파일 정보 불러오는 중...
                  </div>
                )}

                {/* 모델 파일 */}
                <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">모델 파일</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white mt-0.5">
                        {editCurrentContent?.modelName || editingSample.filename || "—"}
                        <span className="ml-2 text-xs text-gray-400 font-normal">.json</span>
                      </p>
                      {editCurrentContent?.modelJson && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {(() => {
                            try {
                              const parsed = JSON.parse(editCurrentContent.modelJson);
                              return `모듈 ${(parsed.modules || []).length}개 · 연결 ${(parsed.connections || []).length}개`;
                            } catch { return ""; }
                          })()}
                        </p>
                      )}
                    </div>
                    {editCurrentContent?.modelJson && (
                      <button
                        type="button"
                        onClick={handleDownloadModelJson}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 rounded-md hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        다운로드
                      </button>
                    )}
                  </div>
                  {/* 모델 파일 교체 */}
                  <div className="pt-1 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-xs text-gray-400 mb-1.5">교체할 파일 선택 (선택 안 하면 기존 유지)</p>
                    <input
                      type="file"
                      accept=".lifx,.json"
                      onChange={(e) => setEditForm((f) => ({ ...f, modelFile: e.target.files?.[0] ?? null }))}
                      className="w-full text-xs text-gray-700 dark:text-gray-300 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-medium file:bg-purple-50 file:text-purple-700 dark:file:bg-purple-900/30 dark:file:text-purple-300 hover:file:bg-purple-100"
                    />
                    {editForm.modelFile && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">✓ 선택됨: {editForm.modelFile.name}</p>
                    )}
                  </div>
                </div>

                {/* 입력 데이터 파일 */}
                <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">입력 데이터 파일</p>
                      {editCurrentContent?.inputDataName ? (
                        <>
                          <p className="text-sm font-medium text-gray-800 dark:text-white mt-0.5">
                            {editCurrentContent.inputDataName}
                          </p>
                          {editCurrentContent.inputDataContent && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              {editCurrentContent.inputDataContent.split("\n").length.toLocaleString()}행 · {(editCurrentContent.inputDataContent.length / 1024).toFixed(1)} KB
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5 italic">첨부된 파일 없음</p>
                      )}
                    </div>
                    {editCurrentContent?.inputDataContent && (
                      <button
                        type="button"
                        onClick={handleDownloadInputData}
                        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        다운로드
                      </button>
                    )}
                  </div>
                  {/* 입력 데이터 미리보기 */}
                  {editCurrentContent?.inputDataContent && (
                    <div className="pt-1 border-t border-gray-100 dark:border-gray-700">
                      <p className="text-xs text-gray-400 mb-1">내용 미리보기 (처음 5행)</p>
                      <pre className="text-[10px] text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 rounded p-2 overflow-x-auto whitespace-pre max-h-20 overflow-y-auto font-mono">
                        {editCurrentContent.inputDataContent.split("\n").slice(0, 5).join("\n")}
                      </pre>
                    </div>
                  )}
                  {/* 입력 데이터 교체 */}
                  <div className="pt-1 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-xs text-gray-400 mb-1.5">교체할 파일 선택 (선택 안 하면 기존 유지)</p>
                    <input
                      type="text"
                      value={editForm.inputDataName}
                      onChange={(e) => setEditForm((f) => ({ ...f, inputDataName: e.target.value }))}
                      className="w-full px-2.5 py-1.5 mb-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white text-xs"
                      placeholder="새 입력 데이터 이름 (파일 선택 시 필수)"
                    />
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls,.txt"
                      onChange={(e) => setEditForm((f) => ({ ...f, inputDataFile: e.target.files?.[0] ?? null }))}
                      className="w-full text-xs text-gray-700 dark:text-gray-300 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-medium file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-900/30 dark:file:text-blue-300 hover:file:bg-blue-100"
                    />
                    {editForm.inputDataFile && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">✓ 선택됨: {editForm.inputDataFile.name}</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setEditingSample(null); setEditError(null); }}
                  className="flex-1 px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleEditSave}
                  disabled={editSaving}
                  className="flex-1 px-4 py-2 rounded-md bg-purple-600 text-white font-medium hover:bg-purple-700 disabled:opacity-50"
                >
                  {editSaving ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SamplesModal;
