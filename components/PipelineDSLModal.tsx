import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CanvasModule, Connection, ModuleType } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import {
  parseDSL,
  generateDSL,
  buildModuleConfigs,
  analyzeFlowErrors,
  DSLModel,
  DSLFlowError,
  DSLModuleConfig,
  EXAMPLE_DSL,
} from '../utils/dslParser';
import { buildPipelineFromModel } from '../utils/pipelineBuilder';

interface PipelineDSLModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  modules: CanvasModule[];
  onBuildPipeline: (modules: CanvasModule[], connections: Connection[], productName: string) => void;
  onPatchParameters: (configs: DSLModuleConfig[], productName: string) => void;
}

const MODULE_ORDER = [
  ModuleType.LoadData,
  ModuleType.SelectRiskRates,
  ModuleType.SelectData,
  ModuleType.RateModifier,
  ModuleType.CalculateSurvivors,
  ModuleType.ClaimsCalculator,
  ModuleType.NxMxCalculator,
  ModuleType.PremiumComponent,
  ModuleType.AdditionalName,
  ModuleType.NetPremiumCalculator,
  ModuleType.GrossPremiumCalculator,
  ModuleType.ReserveCalculator,
  ModuleType.ScenarioRunner,
];

const MODULE_LABELS: Partial<Record<ModuleType, string>> = {
  [ModuleType.LoadData]: '위험률 로드',
  [ModuleType.SelectRiskRates]: '연령 성별 매칭',
  [ModuleType.SelectData]: '데이터 선택',
  [ModuleType.RateModifier]: '요율 수정',
  [ModuleType.CalculateSurvivors]: '생존자 계산',
  [ModuleType.ClaimsCalculator]: '클레임 계산',
  [ModuleType.NxMxCalculator]: 'NxMx 계산',
  [ModuleType.PremiumComponent]: 'NNX MMX 계산',
  [ModuleType.AdditionalName]: '추가 변수',
  [ModuleType.NetPremiumCalculator]: '순보험료',
  [ModuleType.GrossPremiumCalculator]: '영업보험료',
  [ModuleType.ReserveCalculator]: '준비금',
  [ModuleType.ScenarioRunner]: '시나리오',
};

// ── localStorage 키
const DRAFT_KEY    = 'lmf_dsl_draft';
const SAVES_KEY    = 'lmf_dsl_saves';
const EXAMPLES_KEY = 'lmf_dsl_examples';

interface SavedEntry { text: string; savedAt: string; }

function readStorage(key: string): Record<string, SavedEntry> {
  try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
}
function getSaves():    Record<string, SavedEntry> { return readStorage(SAVES_KEY); }
function getExamples(): Record<string, SavedEntry> { return readStorage(EXAMPLES_KEY); }

// ── 검증
interface ValidationResult {
  errors: string[];
  warnings: string[];
}

function validateDSL(model: DSLModel): ValidationResult {
  const errors: string[] = [...model.errors];
  const warnings: string[] = [];

  const sections = model.sections.filter((s) => s.include);
  if (sections.length === 0) {
    errors.push('포함된 모듈이 없습니다. ## 모듈명 형식으로 최소 하나의 모듈을 추가하세요.');
    return { errors, warnings };
  }

  const types = new Set(sections.map((s) => s.type));

  for (const s of sections) {
    switch (s.type) {
      case ModuleType.NetPremiumCalculator:
        if (s.lines.length === 0)
          errors.push('[순보험료] 수식이 없습니다. 예: PP = SUMX / NNX');
        break;
      case ModuleType.GrossPremiumCalculator:
        if (s.lines.length === 0)
          errors.push('[영업보험료] 수식이 없습니다. 예: GP = [PP] / (1 - [α1] - [α2])');
        break;
      case ModuleType.ReserveCalculator:
        if (s.lines.length === 0)
          warnings.push('[준비금] 수식이 없어 준비금 계산이 실행되지 않을 수 있습니다.');
        break;
      case ModuleType.CalculateSurvivors:
        if (!s.lines.some((l) => l.output.toLowerCase().startsWith('lx')))
          warnings.push('[생존자 계산] lx 정의가 없습니다. 예: lx_Mortality = lx(Death_Rate)');
        break;
      case ModuleType.ClaimsCalculator:
        if (!s.lines.some((l) => l.output.toLowerCase().startsWith('dx')))
          warnings.push('[클레임 계산] dx 정의가 없습니다. 예: dx_Mortality = lx_Mortality * Death_Rate');
        break;
      case ModuleType.NxMxCalculator:
        if (!s.lines.some((l) => l.output.toLowerCase().startsWith('nx')))
          warnings.push('[NxMx 계산] Nx 정의가 없습니다. 예: Nx_Mortality = sum(Dx_Mortality)');
        break;
    }
  }

  // 순보험료가 있는데 전제 모듈이 없는 경우
  if (types.has(ModuleType.NetPremiumCalculator) && !types.has(ModuleType.PremiumComponent))
    warnings.push('[순보험료] NNX/MMX 계산 모듈이 없어 SUMX/NNX 값을 참조할 수 없습니다.');

  // Policy 파라미터 검증
  if (!model.policyParams.entryAge || model.policyParams.entryAge <= 0)
    warnings.push(`가입연령(age) 값이 올바르지 않습니다 (현재: ${model.policyParams.entryAge})`);
  if (!model.policyParams.paymentTerm || model.policyParams.paymentTerm <= 0)
    warnings.push(`납입기간(pay) 값이 올바르지 않습니다 (현재: ${model.policyParams.paymentTerm})`);
  if (!model.policyParams.interestRate || model.policyParams.interestRate <= 0)
    warnings.push(`이율(rate) 값이 올바르지 않습니다 (현재: ${model.policyParams.interestRate}%)`);

  return { errors, warnings };
}

export const PipelineDSLModal: React.FC<PipelineDSLModalProps> = ({
  isOpen,
  onClose,
  productName,
  modules,
  onBuildPipeline,
  onPatchParameters,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [dslText, setDslText] = useState(EXAMPLE_DSL);
  const [parsed, setParsed] = useState(() => parseDSL(EXAMPLE_DSL));
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumRef  = useRef<HTMLDivElement>(null);

  // ── 자동완성
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggPos,     setSuggPos]     = useState({ top: 0, left: 0 });
  const [suggActive,  setSuggActive]  = useState(0);

  // ── 저장/예제/검증 상태
  const [saves,       setSaves]      = useState<Record<string, SavedEntry>>(getSaves);
  const [examples,    setExamples]   = useState<Record<string, SavedEntry>>(getExamples);
  const [saveMsg,     setSaveMsg]    = useState('');
  // panel: 'saves' | 'examples' | null
  const [openPanel,   setOpenPanel]  = useState<'saves' | 'examples' | null>(null);
  // 저장 다이얼로그 (이름 입력)
  const [saveDialog,  setSaveDialog] = useState<{ mode: 'save' | 'example'; value: string } | null>(null);
  // 이름 바꾸기
  const [renaming,    setRenaming]   = useState<{ key: string; storage: 'saves' | 'examples'; value: string } | null>(null);
  const [validation,  setValidation] = useState<ValidationResult | null>(null);
  const [warnConfirm, setWarnConfirm] = useState(false);

  // ── 흐름 에러 (실시간)
  const [flowErrors, setFlowErrors] = useState<DSLFlowError[]>([]);

  // ── DSL 파싱 (실시간)
  useEffect(() => {
    const p = parseDSL(dslText);
    setParsed(p);
    setFlowErrors(analyzeFlowErrors(p));
    setValidation(null);  // 편집하면 이전 검증 결과 초기화
    setWarnConfirm(false);
  }, [dslText]);

  // ── 자동 draft 저장
  useEffect(() => {
    if (isOpen && dslText) {
      try { localStorage.setItem(DRAFT_KEY, dslText); } catch { /* ignore */ }
    }
  }, [dslText, isOpen]);

  // ── 모달 열릴 때 초기화
  useEffect(() => {
    if (!isOpen) return;
    setSuggestions([]);
    setValidation(null);
    setWarnConfirm(false);
    setOpenPanel(null);
    setSaveDialog(null);
    setRenaming(null);

    if (modules.length > 0) {
      // 캔버스 모듈이 있으면 캔버스에서 DSL 생성 (항상 최신 반영)
      const generated = generateDSL(
        productName,
        modules.map((m) => ({ type: m.type, parameters: m.parameters }))
      );
      setDslText(generated);
    } else {
      // 캔버스가 비어 있으면 draft 또는 예제 로드
      const draft = localStorage.getItem(DRAFT_KEY);
      setDslText(draft || EXAMPLE_DSL);
    }
  }, [isOpen]);

  // ── 캔버스 모듈로 DSL 재생성
  const handleRegenerateFromCanvas = useCallback(() => {
    if (modules.length === 0) return;
    const generated = generateDSL(
      productName,
      modules.map((m) => ({ type: m.type, parameters: m.parameters }))
    );
    setDslText(generated);
  }, [modules, productName]);

  // ── 저장 다이얼로그 열기
  const handleOpenSaveDialog = useCallback((mode: 'save' | 'example') => {
    setSaveDialog({ mode, value: parsed.productName || '' });
    setOpenPanel(null);
  }, [parsed.productName]);

  // ── 저장 확정
  const handleConfirmSave = useCallback(() => {
    if (!saveDialog) return;
    const name = saveDialog.value.trim();
    if (!name) return;
    const entry: SavedEntry = { text: dslText, savedAt: new Date().toISOString() };
    if (saveDialog.mode === 'save') {
      const updated = { ...getSaves(), [name]: entry };
      localStorage.setItem(SAVES_KEY, JSON.stringify(updated));
      setSaves(updated);
      setSaveMsg(`"${name}" 저장됨 ✓`);
    } else {
      const updated = { ...getExamples(), [name]: entry };
      localStorage.setItem(EXAMPLES_KEY, JSON.stringify(updated));
      setExamples(updated);
      setSaveMsg(`"${name}" 예제로 저장됨 ✓`);
    }
    setSaveDialog(null);
    setTimeout(() => setSaveMsg(''), 2500);
  }, [saveDialog, dslText]);

  // ── Ctrl+S: 빠른 저장 (상품명 자동 사용)
  const handleQuickSave = useCallback(() => {
    const name = parsed.productName || 'unnamed';
    const entry: SavedEntry = { text: dslText, savedAt: new Date().toISOString() };
    const updated = { ...getSaves(), [name]: entry };
    localStorage.setItem(SAVES_KEY, JSON.stringify(updated));
    setSaves(updated);
    setSaveMsg(`"${name}" 저장됨 ✓`);
    setTimeout(() => setSaveMsg(''), 2000);
  }, [dslText, parsed.productName]);

  // ── 불러오기
  const handleLoad = useCallback((text: string) => {
    setDslText(text);
    setOpenPanel(null);
    setSuggestions([]);
  }, []);

  // ── 삭제
  const handleDelete = useCallback((key: string, storage: 'saves' | 'examples') => {
    const storageKey = storage === 'saves' ? SAVES_KEY : EXAMPLES_KEY;
    const current = storage === 'saves' ? getSaves() : getExamples();
    const updated = { ...current };
    delete updated[key];
    localStorage.setItem(storageKey, JSON.stringify(updated));
    if (storage === 'saves') setSaves(updated);
    else setExamples(updated);
  }, []);

  // ── 이름 바꾸기 확정
  const handleRenameConfirm = useCallback(() => {
    if (!renaming || !renaming.value.trim()) return;
    const { key, storage, value } = renaming;
    const storageKey = storage === 'saves' ? SAVES_KEY : EXAMPLES_KEY;
    const current = storage === 'saves' ? getSaves() : getExamples();
    const entry = current[key];
    if (!entry) return;
    const { [key]: _, ...rest } = current;
    const updated = { ...rest, [value.trim()]: entry };
    localStorage.setItem(storageKey, JSON.stringify(updated));
    if (storage === 'saves') setSaves(updated);
    else setExamples(updated);
    setRenaming(null);
  }, [renaming]);

  // ── 실제 파이프라인 빌드
  const executeBuild = useCallback(() => {
    const configs = buildModuleConfigs(parsed);
    const parsedModules = configs
      .filter((c) => c.type !== ModuleType.DefinePolicyInfo)
      .map((c) => ({ type: c.type, include: true, parameters: c.parameters }));

    const policyConfig = configs.find((c) => c.type === ModuleType.DefinePolicyInfo);
    if (policyConfig) {
      parsedModules.unshift({ type: ModuleType.DefinePolicyInfo, include: true, parameters: policyConfig.parameters });
    }

    const { modules: newModules, connections } = buildPipelineFromModel({
      productName: parsed.productName,
      description: '',
      modules: parsedModules,
    });
    onBuildPipeline(newModules, connections, parsed.productName);
    onClose();
  }, [parsed, onBuildPipeline, onClose]);

  // ── 흐름 에러 클릭 → 해당 줄로 이동
  const handleFlowErrorClick = useCallback((lineNumber: number) => {
    const ta = textareaRef.current;
    if (!ta || lineNumber <= 0) return;
    const lines = ta.value.split('\n');
    // 1-based → 0-based
    const idx = lineNumber - 1;
    let charStart = 0;
    for (let i = 0; i < idx && i < lines.length; i++) charStart += lines[i].length + 1;
    const charEnd = charStart + (lines[idx]?.length ?? 0);
    ta.focus();
    ta.setSelectionRange(charStart, charEnd);
    // 해당 줄이 뷰포트 중앙에 오도록 스크롤
    const lh = parseFloat(getComputedStyle(ta).lineHeight) || 20;
    ta.scrollTop = Math.max(0, (idx * lh) - ta.clientHeight / 2 + lh);
  }, []);

  // ── 파라미터만 적용 (기존 캔버스 유지)
  const handlePatchParameters = useCallback(() => {
    const configs = buildModuleConfigs(parsed);
    onPatchParameters(configs, parsed.productName);
    onClose();
  }, [parsed, onPatchParameters, onClose]);

  // ── 검증 후 빌드
  const handleBuildWithValidation = useCallback(() => {
    const result = validateDSL(parsed);
    setValidation(result);
    setWarnConfirm(false);

    if (result.errors.length > 0) return; // 에러 있으면 중단
    if (result.warnings.length > 0) {
      setWarnConfirm(true);              // 경고 있으면 확인 대기
      return;
    }
    executeBuild();                       // 에러/경고 없으면 바로 생성
  }, [parsed, executeBuild]);

  // ── Ctrl+S 단축키
  const handleKeyDownGlobal = useCallback((e: KeyboardEvent) => {
    if (isOpen && (e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (saveDialog) handleConfirmSave();
      else handleQuickSave();
    }
  }, [isOpen, saveDialog, handleConfirmSave, handleQuickSave]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDownGlobal);
    return () => document.removeEventListener('keydown', handleKeyDownGlobal);
  }, [handleKeyDownGlobal]);

  // ── 자동완성 관련 -------------------------------------------------
  const BUILTIN_VARS = [
    'lx', 'dx', 'Cx', 'Dx', 'Nx', 'Mx',
    'lx_Mortality', 'dx_Mortality', 'Cx_Mortality', 'Dx_Mortality',
    'Nx_Mortality', 'Mx_Mortality',
    'NNX', 'SUMX', 'PP', 'GP',
    'i_prem', 'i_claim', 'Death_Rate', 'Age', 'Sex', 'sum',
  ];

  const extractDSLVars = useCallback((text: string): string[] => {
    const vars = new Set<string>();
    for (const line of text.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('//') || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq <= 0) continue;
      const v = t.slice(0, eq).trim();
      if (v && /^[A-Za-z_α-ωΑ-Ω]/.test(v)) vars.add(v);
    }
    return Array.from(vars);
  }, []);

  const getCaretPixelPos = useCallback((ta: HTMLTextAreaElement) => {
    const mirror = document.createElement('div');
    const s = getComputedStyle(ta);
    (['fontFamily','fontSize','fontWeight','letterSpacing','lineHeight',
      'paddingTop','paddingRight','paddingBottom','paddingLeft',
      'borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth','boxSizing'] as const
    ).forEach((p) => { (mirror.style as any)[p] = (s as any)[p]; });
    mirror.style.position = 'absolute';
    mirror.style.top = '-9999px';
    mirror.style.left = '0';
    mirror.style.width = `${ta.offsetWidth}px`;
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.wordBreak = 'break-word';
    mirror.style.visibility = 'hidden';
    mirror.style.overflow = 'hidden';
    const text = ta.value.slice(0, ta.selectionStart ?? 0);
    mirror.textContent = text;
    const caret = document.createElement('span');
    caret.textContent = '\u200b';
    mirror.appendChild(caret);
    document.body.appendChild(mirror);
    const spanTop = caret.offsetTop;
    const spanLeft = caret.offsetLeft;
    document.body.removeChild(mirror);
    const taRect = ta.getBoundingClientRect();
    const lh = parseFloat(s.lineHeight) || 18;
    return { top: taRect.top + spanTop - ta.scrollTop + lh + 4, left: taRect.left + spanLeft };
  }, []);

  const updateSuggestions = useCallback((ta: HTMLTextAreaElement) => {
    const val = ta.value;
    const cursor = ta.selectionStart ?? 0;
    const before = val.slice(0, cursor);
    const tokenMatch = before.match(/[A-Za-z_α-ωΑ-Ω][\w_α-ωΑ-Ω]*$/);
    const token = tokenMatch ? tokenMatch[0] : '';
    if (token.length < 2) { setSuggestions([]); return; }
    const allVars = [...new Set([...extractDSLVars(val), ...BUILTIN_VARS])];
    const filtered = allVars.filter((v) => v.toLowerCase().startsWith(token.toLowerCase()) && v !== token).slice(0, 8);
    setSuggestions(filtered);
    setSuggActive(0);
    if (filtered.length > 0) setSuggPos(getCaretPixelPos(ta));
  }, [extractDSLVars, getCaretPixelPos]);

  const applySuggestion = useCallback((suggestion: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const val = ta.value;
    const cursor = ta.selectionStart ?? 0;
    const before = val.slice(0, cursor);
    const tokenMatch = before.match(/[A-Za-z_α-ωΑ-Ω][\w_α-ωΑ-Ω]*$/);
    const tokenStart = tokenMatch ? cursor - tokenMatch[0].length : cursor;
    setDslText(val.slice(0, tokenStart) + suggestion + val.slice(cursor));
    setSuggestions([]);
    setTimeout(() => {
      ta.selectionStart = tokenStart + suggestion.length;
      ta.selectionEnd = tokenStart + suggestion.length;
      ta.focus();
    }, 0);
  }, []);

  const handleEditorKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSuggActive((p) => Math.min(p + 1, suggestions.length - 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSuggActive((p) => Math.max(p - 1, 0)); return; }
      if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); applySuggestion(suggestions[suggActive]); return; }
      if (e.key === 'Escape') { setSuggestions([]); return; }
    }
    // Ctrl+S 저장
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleQuickSave(); }
  }, [suggestions, suggActive, applySuggestion, handleQuickSave]);

  if (!isOpen) return null;

  const includedTypes = new Set(parsed.sections.filter((s) => s.include).map((s) => s.type));
  const hasParseError = parsed.errors.length > 0;

  const bg  = isDark ? 'bg-gray-900'  : 'bg-white';
  const bdr = isDark ? 'border-gray-700' : 'border-gray-200';
  const txt = isDark ? 'text-gray-100' : 'text-gray-900';
  const sub = isDark ? 'text-gray-400' : 'text-gray-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className={`relative flex flex-col rounded-xl border ${bdr} ${bg} shadow-2xl overflow-hidden`}
        style={{ width: '960px', maxWidth: '96vw', height: '82vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── 헤더 */}
        <div className={`flex items-center justify-between px-5 py-3 border-b ${bdr} flex-shrink-0`}>
          <div className="flex items-center gap-2">
            <span className="text-base">📝</span>
            <h2 className={`text-sm font-bold ${txt}`}>파이프라인 DSL 정의</h2>
            <span className={`text-xs ${sub}`}>— 출력 = 입력/수식 형태로 모듈 구성</span>
          </div>
          <div className="flex items-center gap-2">
            {saveMsg && (
              <span className="text-xs text-emerald-500 font-medium">{saveMsg}</span>
            )}
            <button
              onClick={onClose}
              className={`p-1 rounded text-xs ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
            >✕</button>
          </div>
        </div>

        {/* ── 본문 */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── 왼쪽: DSL 에디터 */}
          <div className="flex flex-col w-3/5 border-r" style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}>

            {/* 에디터 툴바 */}
            <div className={`flex-shrink-0 border-b text-xs ${sub}`} style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}>
              {/* 메인 툴바 행 */}
              <div className="flex items-center justify-between px-3 py-1.5">
                <span className="font-medium">DSL 편집기</span>
                <div className="flex items-center gap-1.5">
                  {/* 저장 목록 */}
                  <button
                    onClick={() => setOpenPanel((p) => p === 'saves' ? null : 'saves')}
                    className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 ${openPanel === 'saves' ? (isDark ? 'bg-indigo-700 text-white' : 'bg-indigo-100 text-indigo-700') : (isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600')}`}
                  >📂 저장 {Object.keys(saves).length > 0 && <span className="bg-indigo-500 text-white rounded-full px-1 text-[9px]">{Object.keys(saves).length}</span>}</button>
                  {/* 예제 목록 */}
                  <button
                    onClick={() => setOpenPanel((p) => p === 'examples' ? null : 'examples')}
                    className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 ${openPanel === 'examples' ? (isDark ? 'bg-teal-700 text-white' : 'bg-teal-100 text-teal-700') : (isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600')}`}
                  >📋 예제 {Object.keys(examples).length > 0 && <span className="bg-teal-500 text-white rounded-full px-1 text-[9px]">{Object.keys(examples).length + 1}</span>}</button>
                  <span className={`text-gray-600 select-none`}>|</span>
                  {/* 저장 버튼 */}
                  <button
                    onClick={() => handleOpenSaveDialog('save')}
                    title="이름을 지정해 저장 (Ctrl+S: 빠른 저장)"
                    className={`px-2 py-0.5 rounded text-xs ${isDark ? 'bg-emerald-800 hover:bg-emerald-700 text-emerald-200' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'}`}
                  >💾 저장…</button>
                  {/* 예제로 저장 버튼 */}
                  <button
                    onClick={() => handleOpenSaveDialog('example')}
                    title="예제 목록에 저장"
                    className={`px-2 py-0.5 rounded text-xs ${isDark ? 'bg-teal-800 hover:bg-teal-700 text-teal-200' : 'bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200'}`}
                  >📌 예제로 저장…</button>
                  {modules.length > 0 && (
                    <button
                      onClick={handleRegenerateFromCanvas}
                      title="현재 캔버스 상태에서 DSL 재생성"
                      className={`px-2 py-0.5 rounded text-xs ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
                    >🔄 캔버스 재생성</button>
                  )}
                </div>
              </div>

              {/* 저장 이름 입력 다이얼로그 */}
              {saveDialog && (
                <div className={`flex items-center gap-2 px-3 py-1.5 border-t ${bdr} ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                  <span className={`text-[10px] font-semibold ${saveDialog.mode === 'example' ? 'text-teal-400' : 'text-emerald-400'}`}>
                    {saveDialog.mode === 'example' ? '📌 예제 이름' : '💾 저장 이름'}
                  </span>
                  <input
                    autoFocus
                    type="text"
                    value={saveDialog.value}
                    onChange={(e) => setSaveDialog({ ...saveDialog, value: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmSave(); if (e.key === 'Escape') setSaveDialog(null); }}
                    placeholder="이름 입력…"
                    className={`flex-1 text-xs px-2 py-0.5 rounded border focus:outline-none ${isDark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-800'}`}
                  />
                  <button onClick={handleConfirmSave} className="px-2 py-0.5 rounded text-xs bg-indigo-600 hover:bg-indigo-500 text-white">저장</button>
                  <button onClick={() => setSaveDialog(null)} className={`px-2 py-0.5 rounded text-xs ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'}`}>취소</button>
                </div>
              )}

              {/* 저장 목록 패널 */}
              {openPanel === 'saves' && (
                <div className={`border-t max-h-52 overflow-y-auto ${bdr}`}>
                  {Object.keys(saves).length === 0 ? (
                    <p className={`px-3 py-2 text-[10px] ${sub}`}>저장된 DSL이 없습니다. 💾 저장… 버튼을 사용하세요.</p>
                  ) : (
                    (Object.entries(saves) as [string, SavedEntry][]).map(([k, v]) => (
                      <div key={k} className={`flex items-center gap-1.5 px-3 py-1.5 border-b last:border-0 ${bdr}`}>
                        {renaming?.key === k && renaming.storage === 'saves' ? (
                          <>
                            <input
                              autoFocus
                              value={renaming.value}
                              onChange={(e) => setRenaming({ ...renaming, value: e.target.value })}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleRenameConfirm(); if (e.key === 'Escape') setRenaming(null); }}
                              className={`flex-1 text-xs px-1.5 py-0.5 rounded border focus:outline-none ${isDark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300'}`}
                            />
                            <button onClick={handleRenameConfirm} className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-600 text-white">확인</button>
                            <button onClick={() => setRenaming(null)} className={`px-1.5 py-0.5 rounded text-[10px] ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-500'}`}>취소</button>
                          </>
                        ) : (
                          <>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-medium truncate ${txt}`}>{k}</p>
                              <p className={`text-[10px] ${sub}`}>{new Date(v.savedAt).toLocaleString('ko-KR')}</p>
                            </div>
                            <button onClick={() => handleLoad(v.text)} className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-600 text-white hover:bg-indigo-500 flex-shrink-0">불러오기</button>
                            <button onClick={() => setRenaming({ key: k, storage: 'saves', value: k })} className={`px-1.5 py-0.5 rounded text-[10px] flex-shrink-0 ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}>이름변경</button>
                            <button onClick={() => handleDelete(k, 'saves')} className={`px-1.5 py-0.5 rounded text-[10px] flex-shrink-0 ${isDark ? 'bg-gray-700 hover:bg-red-800 text-gray-300' : 'bg-gray-100 hover:bg-red-100 text-red-500'}`}>삭제</button>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* 예제 목록 패널 */}
              {openPanel === 'examples' && (
                <div className={`border-t max-h-52 overflow-y-auto ${bdr}`}>
                  {/* 기본 내장 예제 */}
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 border-b ${bdr}`}>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium truncate ${txt}`}>종신보험 A형 (기본 예제)</p>
                      <p className={`text-[10px] text-teal-500`}>내장 예제</p>
                    </div>
                    <button
                      onClick={() => { setDslText(EXAMPLE_DSL); setOpenPanel(null); setSuggestions([]); }}
                      className="px-1.5 py-0.5 rounded text-[10px] bg-teal-600 text-white hover:bg-teal-500 flex-shrink-0"
                    >불러오기</button>
                  </div>
                  {/* 사용자 저장 예제 */}
                  {Object.keys(examples).length === 0 ? (
                    <p className={`px-3 py-2 text-[10px] ${sub}`}>저장된 예제가 없습니다. 📌 예제로 저장… 버튼을 사용하세요.</p>
                  ) : (
                    (Object.entries(examples) as [string, SavedEntry][]).map(([k, v]) => (
                      <div key={k} className={`flex items-center gap-1.5 px-3 py-1.5 border-b last:border-0 ${bdr}`}>
                        {renaming?.key === k && renaming.storage === 'examples' ? (
                          <>
                            <input
                              autoFocus
                              value={renaming.value}
                              onChange={(e) => setRenaming({ ...renaming, value: e.target.value })}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleRenameConfirm(); if (e.key === 'Escape') setRenaming(null); }}
                              className={`flex-1 text-xs px-1.5 py-0.5 rounded border focus:outline-none ${isDark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300'}`}
                            />
                            <button onClick={handleRenameConfirm} className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-600 text-white">확인</button>
                            <button onClick={() => setRenaming(null)} className={`px-1.5 py-0.5 rounded text-[10px] ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-500'}`}>취소</button>
                          </>
                        ) : (
                          <>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-medium truncate ${txt}`}>{k}</p>
                              <p className={`text-[10px] ${sub}`}>{new Date(v.savedAt).toLocaleString('ko-KR')}</p>
                            </div>
                            <button onClick={() => handleLoad(v.text)} className="px-1.5 py-0.5 rounded text-[10px] bg-teal-600 text-white hover:bg-teal-500 flex-shrink-0">불러오기</button>
                            <button onClick={() => setRenaming({ key: k, storage: 'examples', value: k })} className={`px-1.5 py-0.5 rounded text-[10px] flex-shrink-0 ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}>이름변경</button>
                            <button onClick={() => handleDelete(k, 'examples')} className={`px-1.5 py-0.5 rounded text-[10px] flex-shrink-0 ${isDark ? 'bg-gray-700 hover:bg-red-800 text-gray-300' : 'bg-gray-100 hover:bg-red-100 text-red-500'}`}>삭제</button>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* 라인 번호 + 에디터 */}
            <div className={`flex flex-1 overflow-hidden font-mono text-xs ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`} style={{ lineHeight: '1.6' }}>
              <div
                ref={lineNumRef}
                aria-hidden
                className={`select-none overflow-hidden flex-shrink-0 text-right pr-2 pt-3 pb-3 pl-2 ${isDark ? 'text-gray-600 bg-gray-900' : 'text-gray-400 bg-gray-100'}`}
                style={{ lineHeight: '1.6', userSelect: 'none', minWidth: '2.8rem' }}
              >
                {dslText.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}
              </div>
              <textarea
                ref={textareaRef}
                value={dslText}
                onChange={(e) => { setDslText(e.target.value); updateSuggestions(e.target as HTMLTextAreaElement); }}
                onKeyDown={handleEditorKeyDown}
                onKeyUp={(e) => {
                  if (!['ArrowUp','ArrowDown','Enter','Tab','Escape'].includes(e.key))
                    updateSuggestions(e.currentTarget);
                }}
                onBlur={() => setTimeout(() => setSuggestions([]), 150)}
                onScroll={(e) => {
                  if (lineNumRef.current)
                    lineNumRef.current.scrollTop = (e.target as HTMLTextAreaElement).scrollTop;
                }}
                spellCheck={false}
                className={`flex-1 resize-none focus:outline-none p-3 ${isDark ? 'bg-gray-950 text-green-300 caret-green-400' : 'bg-gray-50 text-gray-800'}`}
                style={{ lineHeight: '1.6' }}
                placeholder="DSL을 입력하세요..."
              />
            </div>

            {/* 자동완성 드롭다운 */}
            {suggestions.length > 0 && (
              <div
                className={`fixed z-[60] rounded border shadow-xl text-xs font-mono overflow-hidden ${isDark ? 'bg-gray-800 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-800'}`}
                style={{ top: suggPos.top, left: suggPos.left, minWidth: '180px', maxWidth: '260px' }}
              >
                <div className={`px-2 py-0.5 text-[10px] border-b ${isDark ? 'border-gray-700 text-gray-500' : 'border-gray-200 text-gray-400'}`}>
                  변수 자동완성 · Tab/Enter 선택 · Esc 닫기
                </div>
                {suggestions.map((s, i) => (
                  <div
                    key={s}
                    className={`px-3 py-1.5 cursor-pointer flex items-center gap-2 ${i === suggActive ? (isDark ? 'bg-indigo-700 text-white' : 'bg-indigo-100 text-indigo-900') : (isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50')}`}
                    onMouseDown={(e) => { e.preventDefault(); applySuggestion(s); }}
                    onMouseEnter={() => setSuggActive(i)}
                  >
                    <span className={`text-[10px] ${isDark ? 'text-indigo-400' : 'text-indigo-500'}`}>⬡</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── 오른쪽: 미리보기 + 검증 */}
          <div className="flex flex-col w-2/5 overflow-y-auto">
            <div className="p-4 space-y-3 flex-1">

              {/* 상품 정보 */}
              <div>
                <p className={`text-xs font-bold ${txt}`}>{parsed.productName}</p>
                <p className={`text-xs ${sub}`}>
                  가입연령 {parsed.policyParams.entryAge}세 · {parsed.policyParams.gender} ·{' '}
                  납입 {parsed.policyParams.paymentTerm}년 · 이율 {parsed.policyParams.interestRate}%
                </p>
              </div>

              {/* 파싱 에러 */}
              {hasParseError && (
                <div className={`p-2 rounded border text-xs ${isDark ? 'border-red-700 bg-red-950/30 text-red-300' : 'border-red-200 bg-red-50 text-red-700'}`}>
                  <p className="font-semibold mb-1">🚫 파싱 오류</p>
                  {parsed.errors.map((e, i) => <p key={i} className="font-mono">{e}</p>)}
                </div>
              )}

              {/* 검증 결과 */}
              {validation && (validation.errors.length > 0 || validation.warnings.length > 0) && (
                <div className="space-y-2">
                  {validation.errors.length > 0 && (
                    <div className={`p-2 rounded border text-xs ${isDark ? 'border-red-700 bg-red-950/30 text-red-300' : 'border-red-200 bg-red-50 text-red-700'}`}>
                      <p className="font-semibold mb-1">🚫 오류 — 수정 후 생성하세요</p>
                      {validation.errors.map((e, i) => <p key={i}>• {e}</p>)}
                    </div>
                  )}
                  {validation.warnings.length > 0 && (
                    <div className={`p-2 rounded border text-xs ${isDark ? 'border-yellow-700 bg-yellow-950/20 text-yellow-300' : 'border-yellow-200 bg-yellow-50 text-yellow-700'}`}>
                      <p className="font-semibold mb-1">⚠️ 경고</p>
                      {validation.warnings.map((w, i) => <p key={i}>• {w}</p>)}
                      {warnConfirm && validation.errors.length === 0 && (
                        <button
                          onClick={executeBuild}
                          className="mt-2 px-2 py-1 rounded text-xs bg-yellow-500 hover:bg-yellow-400 text-white font-semibold w-full"
                        >경고를 무시하고 파이프라인 생성</button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 검증 통과 메시지 */}
              {validation && validation.errors.length === 0 && validation.warnings.length === 0 && (
                <div className={`p-2 rounded border text-xs ${isDark ? 'border-emerald-700 bg-emerald-950/20 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                  ✅ 검증 통과 — 파이프라인을 생성합니다
                </div>
              )}

              {/* 흐름 에러 */}
              {flowErrors.length > 0 && (
                <div className={`p-2 rounded border text-xs ${isDark ? 'border-orange-700 bg-orange-950/20 text-orange-300' : 'border-orange-200 bg-orange-50 text-orange-700'}`}>
                  <p className="font-semibold mb-1">🔗 흐름 경고 ({flowErrors.length}건) — 클릭하면 해당 줄로 이동</p>
                  <div className="space-y-0.5 max-h-28 overflow-y-auto">
                    {flowErrors.map((e, i) => (
                      <p
                        key={i}
                        className={`font-mono truncate cursor-pointer rounded px-1 -mx-1 ${isDark ? 'hover:bg-orange-800/40' : 'hover:bg-orange-100'}`}
                        title={`${e.lineNumber}번째 줄로 이동`}
                        onClick={() => handleFlowErrorClick(e.lineNumber)}
                      >
                        <span className={`mr-1 ${isDark ? 'text-orange-500' : 'text-orange-400'}`}>L{e.lineNumber}</span>
                        {e.message}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* 모듈 체크리스트 */}
              <div className={`rounded border ${bdr} overflow-hidden`}>
                <div className={`px-3 py-1.5 text-xs font-semibold ${sub} border-b ${bdr}`}>
                  포함 모듈 ({includedTypes.size}개)
                </div>
                {MODULE_ORDER.map((type) => {
                  const included = includedTypes.has(type);
                  const section = parsed.sections.find((s) => s.type === type);
                  return (
                    <div key={type} className={`flex items-start gap-2 px-3 py-1.5 border-b last:border-0 ${bdr} ${!included ? 'opacity-35' : ''}`}>
                      <span className="text-xs mt-0.5">{included ? '✅' : '—'}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium ${txt} truncate`}>{MODULE_LABELS[type] ?? type}</p>
                        {included && section && section.lines.length > 0 && (
                          <div className="mt-0.5 space-y-0.5">
                            {section.lines.map((l, i) => (
                              <p key={i} className={`text-[10px] font-mono ${sub} truncate`}>{l.output} = {l.formula}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 문법 도움말 */}
              <div className={`p-2 rounded border text-xs ${isDark ? 'border-blue-900 bg-blue-950/20 text-blue-300' : 'border-blue-100 bg-blue-50 text-blue-700'}`}>
                <p className="font-semibold mb-1">📌 DSL 문법</p>
                <p className="font-mono"># 상품명 | age=40 | pay=20 | rate=2.5</p>
                <p className="font-mono">## 모듈명</p>
                <p className="font-mono">출력열 = 입력열/수식</p>
                <p className="mt-1 font-mono text-[10px]">// 주석 · Ctrl+S 저장</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── 하단 버튼 */}
        <div className={`flex items-center justify-between px-5 py-3 border-t ${bdr} flex-shrink-0`}>
          <p className={`text-[10px] ${sub}`}>
            Ctrl+S 빠른 저장 · 💾 저장… 이름 지정 · 📌 예제로 저장… 예제 등록
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
            >취소</button>
            {modules.length > 0 && (
              <button
                onClick={handlePatchParameters}
                disabled={hasParseError}
                title="기존 모듈의 위치·연결을 유지한 채 파라미터만 DSL에서 업데이트합니다"
                className={`px-3 py-1.5 text-xs font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${isDark ? 'bg-teal-800 hover:bg-teal-700 text-teal-200' : 'bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200'}`}
              >파라미터 적용</button>
            )}
            <button
              onClick={handleBuildWithValidation}
              disabled={hasParseError}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white"
            >파이프라인 생성</button>
          </div>
        </div>
      </div>
    </div>
  );
};
