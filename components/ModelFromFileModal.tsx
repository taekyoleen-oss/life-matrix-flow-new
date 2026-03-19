import React, { useState, useCallback, useRef } from 'react';
import { CanvasModule, Connection, ModuleType } from '../types';
import {
  parseMarkdownModel,
  validateModelDefinition,
  summarizeModule,
  ParsedModuleConfig,
} from '../utils/markdownModelParser';
import { buildPipelineFromModel } from '../utils/pipelineBuilder';
import { DocumentTextIcon, ArrowDownTrayIcon } from './icons';
import { useTheme } from '../contexts/ThemeContext';

interface ModelFromFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBuildPipeline: (modules: CanvasModule[], connections: Connection[], productName: string) => void;
}

const MODULE_LABELS: Partial<Record<ModuleType, string>> = {
  [ModuleType.LoadData]: '위험률 데이터 로드',
  [ModuleType.SelectRiskRates]: '연령 성별 매칭',
  [ModuleType.SelectData]: '데이터 선택',
  [ModuleType.RateModifier]: '요율 수정',
  [ModuleType.DefinePolicyInfo]: '증권 기본 정보',
  [ModuleType.CalculateSurvivors]: '생존자 계산',
  [ModuleType.ClaimsCalculator]: '클레임 계산',
  [ModuleType.NxMxCalculator]: 'NxMx 계산',
  [ModuleType.PremiumComponent]: 'NNX MMX 계산',
  [ModuleType.AdditionalName]: '추가 변수',
  [ModuleType.NetPremiumCalculator]: '순보험료 계산',
  [ModuleType.GrossPremiumCalculator]: '영업보험료 계산',
  [ModuleType.ReserveCalculator]: '준비금 계산',
  [ModuleType.ScenarioRunner]: '시나리오 실행',
};

// ─── Markdown Template ──────────────────────────────────────────────────────
const TEMPLATE_MARKDOWN = `# Life Matrix Flow 모델 정의 템플릿
<!-- 이 파일을 편집하여 보험 상품 모델을 정의하세요. -->
<!-- 포함여부: yes = 파이프라인에 포함 / no = 제외 -->

## 상품 정보
**상품명**: 종신보험 A형
**설명**: 남성 40세 기준 종신보험

---

## [1] 위험률 데이터 로드 (LoadData)
**포함여부**: yes
**파일명**: Risk_Rates.csv

---

## [2] 연령 성별 매칭 (SelectRiskRates)
**포함여부**: yes
**나이 컬럼**: Age
**성별 컬럼**: Sex
**비숫자 행 제외**: yes

---

## [3] 데이터 선택 (SelectData)
**포함여부**: yes
**선택 항목**:
\`\`\`json
[]
\`\`\`

---

## [4] 요율 수정 (RateModifier)
**포함여부**: no
**계산 목록**:
\`\`\`json
[]
\`\`\`

---

## [5] 증권 기본 정보 (DefinePolicyInfo)
**포함여부**: yes
**가입연령**: 40
**성별**: Male
**보험기간**:
**만기연령**: 0
**납입기간**: 20
**이율 (%)**: 2.5

---

## [6] 생존자 계산 (CalculateSurvivors)
**포함여부**: yes
**나이 컬럼**: Age
**사망률 컬럼**: None
**계산 목록**:
\`\`\`json
[]
\`\`\`

---

## [7] 클레임 계산 (ClaimsCalculator)
**포함여부**: yes
**계산 목록**:
\`\`\`json
[]
\`\`\`

---

## [8] NxMx 계산 (NxMxCalculator)
**포함여부**: yes
**Nx 계산 목록**:
\`\`\`json
[]
\`\`\`
**Mx 계산 목록**:
\`\`\`json
[]
\`\`\`

---

## [9] NNX MMX 계산 (PremiumComponent)
**포함여부**: yes
**NNX 계산 목록**:
\`\`\`json
[]
\`\`\`
**SUMX 계산 목록**:
\`\`\`json
[]
\`\`\`

---

## [10] 추가 변수 (AdditionalName)
**포함여부**: yes
**기본값**:
\`\`\`json
[
  { "name": "α1", "value": 0 },
  { "name": "α2", "value": 0 },
  { "name": "β1", "value": 0 },
  { "name": "β2", "value": 0 },
  { "name": "γ", "value": 0 }
]
\`\`\`
**정의 목록**:
\`\`\`json
[]
\`\`\`

---

## [11] 순보험료 계산 (NetPremiumCalculator)
**포함여부**: yes
**수식**: [SUMX] / [NNX]
**변수명**: PP

---

## [12] 영업보험료 계산 (GrossPremiumCalculator)
**포함여부**: yes
**수식**: [PP] / (1 - 0.0)
**변수명**: GP

---

## [13] 준비금 계산 (ReserveCalculator)
**포함여부**: yes
**납입기간 이하 수식**:
**납입기간 초과 수식**:
**준비금 컬럼명**: Reserve

---

## [14] 시나리오 실행 (ScenarioRunner)
**포함여부**: no
**시나리오**:
\`\`\`json
[]
\`\`\`
`;

export const ModelFromFileModal: React.FC<ModelFromFileModalProps> = ({
  isOpen,
  onClose,
  onBuildPipeline,
}) => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'download' | 'upload'>('download');
  const [parsedModules, setParsedModules] = useState<ParsedModuleConfig[] | null>(null);
  const [productName, setProductName] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    const blob = new Blob([TEMPLATE_MARKDOWN], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'life-matrix-template.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const processFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setParsedModules(null);
    setErrors([]);
    setWarnings([]);
    setIsValid(false);

    let text = '';
    if (file.name.endsWith('.docx')) {
      const { docxToMarkdown } = await import('../utils/docxToMarkdown');
      text = await docxToMarkdown(file);
    } else {
      text = await file.text();
    }

    const model = parseMarkdownModel(text);
    const validation = validateModelDefinition(model);

    setProductName(model.productName);
    setParsedModules(model.modules);
    setErrors(validation.errors);
    setWarnings(validation.warnings);
    setIsValid(validation.valid);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleBuild = () => {
    if (!parsedModules || !isValid) return;
    const model = { productName, description: '', modules: parsedModules };
    const { modules, connections } = buildPipelineFromModel(model);
    onBuildPipeline(modules, connections, productName);
    onClose();
  };

  if (!isOpen) return null;

  const isDark = theme === 'dark';
  const bg = isDark ? 'bg-gray-900' : 'bg-white';
  const border = isDark ? 'border-gray-700' : 'border-gray-200';
  const text = isDark ? 'text-gray-100' : 'text-gray-900';
  const subText = isDark ? 'text-gray-400' : 'text-gray-500';
  const cardBg = isDark ? 'bg-gray-800' : 'bg-gray-50';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className={`relative w-full max-w-2xl max-h-[90vh] rounded-xl border ${border} ${bg} shadow-2xl flex flex-col overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${border}`}>
          <div className="flex items-center gap-2">
            <DocumentTextIcon className="w-5 h-5 text-indigo-500" />
            <h2 className={`text-base font-bold ${text}`}>파일로 모델 생성</h2>
          </div>
          <button
            onClick={onClose}
            className={`p-1 rounded-md ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'} transition-colors`}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className={`flex border-b ${border}`}>
          {(['download', 'upload'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-indigo-500 text-indigo-500'
                  : `${subText} hover:${text}`
              }`}
            >
              {tab === 'download' ? '📥 템플릿 다운로드' : '📂 파일 업로드'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'download' && (
            <div className="space-y-4">
              <div className={`p-4 rounded-lg ${cardBg} border ${border}`}>
                <p className={`text-sm ${text} font-semibold mb-1`}>사용 방법</p>
                <ol className={`text-sm ${subText} space-y-1 list-decimal list-inside`}>
                  <li>아래 버튼으로 Markdown 템플릿을 다운로드하세요.</li>
                  <li>텍스트 편집기(VS Code, 메모장 등)로 열어 각 모듈의 파라미터를 입력하세요.</li>
                  <li><strong>포함여부: yes/no</strong>로 각 모듈을 선택하세요.</li>
                  <li>저장 후 <strong>파일 업로드</strong> 탭에서 업로드하면 파이프라인이 자동 생성됩니다.</li>
                  <li>Word 사용 시: 같은 형식을 유지한 채 .docx로 저장하면 됩니다.</li>
                </ol>
              </div>

              <button
                onClick={handleDownloadTemplate}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <ArrowDownTrayIcon className="w-4 h-4" />
                Markdown 템플릿 다운로드 (.md)
              </button>

              <div className={`p-4 rounded-lg border ${isDark ? 'border-blue-700 bg-blue-950/30' : 'border-blue-200 bg-blue-50'}`}>
                <p className={`text-xs font-semibold ${isDark ? 'text-blue-300' : 'text-blue-700'} mb-2`}>작성 가이드</p>
                <ul className={`text-xs ${isDark ? 'text-blue-200' : 'text-blue-600'} space-y-1 list-disc list-inside`}>
                  <li><code>**필드명**: 값</code> 형식으로 파라미터를 입력하세요.</li>
                  <li>배열 파라미터는 <code>```json [...] ```</code> 블록으로 작성하세요.</li>
                  <li>이율은 % 단위로 입력하세요 (예: 2.5 → 2.5%)</li>
                  <li>포함여부가 <code>no</code>인 모듈은 파이프라인에서 제외됩니다.</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="space-y-4">
              {/* Drop zone */}
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragOver
                    ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30'
                    : `${isDark ? 'border-gray-600 hover:border-gray-500' : 'border-gray-300 hover:border-gray-400'}`
                }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".md,.docx"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <DocumentTextIcon className={`w-10 h-10 mx-auto mb-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                <p className={`text-sm font-medium ${text}`}>
                  {fileName || '.md 또는 .docx 파일을 드래그하거나 클릭하세요'}
                </p>
                <p className={`text-xs ${subText} mt-1`}>Markdown (.md) 또는 Word (.docx)</p>
              </div>

              {/* Errors */}
              {errors.length > 0 && (
                <div className={`p-3 rounded-lg border ${isDark ? 'border-red-700 bg-red-950/30' : 'border-red-200 bg-red-50'}`}>
                  <p className={`text-xs font-semibold ${isDark ? 'text-red-300' : 'text-red-700'} mb-1`}>오류 (파이프라인 생성 불가)</p>
                  <ul className={`text-xs ${isDark ? 'text-red-200' : 'text-red-600'} space-y-0.5 list-disc list-inside`}>
                    {errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}

              {/* Warnings */}
              {warnings.length > 0 && (
                <div className={`p-3 rounded-lg border ${isDark ? 'border-yellow-700 bg-yellow-950/30' : 'border-yellow-200 bg-yellow-50'}`}>
                  <p className={`text-xs font-semibold ${isDark ? 'text-yellow-300' : 'text-yellow-700'} mb-1`}>경고</p>
                  <ul className={`text-xs ${isDark ? 'text-yellow-200' : 'text-yellow-600'} space-y-0.5 list-disc list-inside`}>
                    {warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}

              {/* Preview table */}
              {parsedModules && parsedModules.length > 0 && (
                <div>
                  <p className={`text-sm font-semibold ${text} mb-2`}>
                    파싱 결과 미리보기 — <span className="text-indigo-500">{productName}</span>
                  </p>
                  <div className={`rounded-lg border ${border} overflow-hidden`}>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className={`${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                          <th className={`px-3 py-2 text-left font-semibold ${text}`}>모듈</th>
                          <th className={`px-3 py-2 text-center font-semibold ${text}`}>포함</th>
                          <th className={`px-3 py-2 text-left font-semibold ${text}`}>주요 설정</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedModules.map((m, i) => (
                          <tr
                            key={i}
                            className={`border-t ${border} ${!m.include ? 'opacity-40' : ''}`}
                          >
                            <td className={`px-3 py-1.5 font-medium ${text}`}>
                              {MODULE_LABELS[m.type] ?? m.type}
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              {m.include ? '✅' : '—'}
                            </td>
                            <td className={`px-3 py-1.5 ${subText}`}>
                              {summarizeModule(m)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-end gap-3 px-5 py-3 border-t ${border}`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            취소
          </button>
          {activeTab === 'upload' && (
            <button
              onClick={handleBuild}
              disabled={!isValid}
              className="px-4 py-2 text-sm font-semibold rounded-lg transition-colors bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-400 disabled:cursor-not-allowed text-white"
            >
              파이프라인 생성
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
