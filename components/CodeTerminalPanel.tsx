import React, { useState, useEffect, useRef } from 'react';
import { CanvasModule, ModuleType } from '../types';
import { XMarkIcon } from './icons';
import { getModuleCode } from '../codeSnippets';
import { useTheme } from '../contexts/ThemeContext';
import { moduleToDSLSection, dslSectionToParams, isDSLEditableType } from '../utils/moduleSync';
import { DSLFlowError } from '../utils/dslParser';

interface CodeTerminalPanelProps {
    selectedModule: CanvasModule | null;
    terminalOutput: string[];
    isVisible: boolean;
    onClose: () => void;
    /** reverse 적용 콜백: DSL → 파라미터 merge 적용 (App.tsx 의 updateModuleParameters(id, params, false) 바인딩). */
    onApplyModuleDSL?: (moduleId: string, parameters: Record<string, any>) => void;
    /** forward 생성 시 헤더 맥락용 DefinePolicyInfo 모듈(선택). */
    policyInfoModule?: CanvasModule | null;
    /** forward 생성 시 헤더 상품명(선택). */
    productName?: string;
}

type TabKey = 'dsl' | 'code' | 'terminal';

export const CodeTerminalPanel: React.FC<CodeTerminalPanelProps> = ({
    selectedModule,
    terminalOutput,
    isVisible,
    onClose,
    onApplyModuleDSL,
    policyInfoModule,
    productName,
}) => {
    const [activeTab, setActiveTab] = useState<TabKey>('dsl');
    const [code, setCode] = useState('');           // Python 읽기전용
    const [dslText, setDslText] = useState('');      // 편집 가능 DSL 섹션
    const [dslErrors, setDslErrors] = useState<string[]>([]);
    const [dslWarnings, setDslWarnings] = useState<DSLFlowError[]>([]);
    const [applied, setApplied] = useState(false);   // 적용 성공 표시(잠깐)
    const editingRef = useRef(false);                // 사용자가 textarea 편집 중인지 (무한루프 방지)
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const editable = selectedModule ? isDSLEditableType(selectedModule.type) : false;

    // ── forward: Python 코드(읽기전용)
    useEffect(() => {
        if (selectedModule) {
            setCode(getModuleCode(selectedModule));
        } else {
            setCode('# Select a module to see its code.');
        }
    }, [selectedModule]);

    // ── forward: DSL 섹션. 사용자가 편집 중이 아닐 때만 재설정(무한루프 방지).
    useEffect(() => {
        if (editingRef.current) return; // 편집 중이면 외부 변경으로 덮어쓰지 않음
        if (selectedModule && isDSLEditableType(selectedModule.type)) {
            setDslText(moduleToDSLSection(selectedModule, policyInfoModule ?? undefined, productName));
        } else {
            setDslText('');
        }
        setDslErrors([]);
        setDslWarnings([]);
        setApplied(false);
    }, [selectedModule, policyInfoModule, productName]);

    // ── 모듈이 바뀌면 편집 플래그 초기화 + DSL 탭으로
    useEffect(() => {
        editingRef.current = false;
    }, [selectedModule?.id]);

    useEffect(() => {
        if (selectedModule && terminalOutput.some(line => line.includes('ERROR'))) {
            setActiveTab('terminal');
        }
    }, [selectedModule, terminalOutput]);

    if (!isVisible) {
        return null;
    }

    const title = selectedModule ? `${selectedModule.name}` : 'No Module Selected';

    const handleDslChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        editingRef.current = true;
        setApplied(false);
        setDslText(e.target.value);
    };

    const handleApply = () => {
        if (!selectedModule || !onApplyModuleDSL) return;
        const res = dslSectionToParams(dslText, selectedModule.type);
        if (!res.ok) {
            // 실패: 파라미터를 건드리지 않음. 인라인 에러만 표시. textarea 유지.
            setDslErrors(res.errors ?? ['알 수 없는 오류로 적용에 실패했습니다.']);
            setDslWarnings([]);
            return;
        }
        if (!res.parameters || Object.keys(res.parameters).length === 0) {
            setDslErrors(['인식된 항목이 없습니다. 적용을 보류합니다.']);
            return;
        }
        // 성공: merge 적용 (replace=false 는 App.tsx 바인딩에서 보장)
        onApplyModuleDSL(selectedModule.id, res.parameters);
        setDslErrors([]);
        setDslWarnings(res.warnings ?? []);
        setApplied(true);
        editingRef.current = false; // 다음 외부 변경을 다시 받도록
    };

    const handleRevert = () => {
        if (!selectedModule) return;
        editingRef.current = false;
        setDslText(moduleToDSLSection(selectedModule, policyInfoModule ?? undefined, productName));
        setDslErrors([]);
        setDslWarnings([]);
        setApplied(false);
    };

    const tabBtn = (key: TabKey, label: string) => (
        <button
            onClick={(e) => { e.stopPropagation(); setActiveTab(key); }}
            className={`px-3 py-0.5 rounded-sm whitespace-nowrap ${activeTab === key ? (isDark ? 'bg-gray-600' : 'bg-gray-200') : (isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100')}`}
        >{label}</button>
    );

    return (
        <div className={`w-[450px] flex-shrink-0 border-l ${isDark ? 'bg-gray-800 text-white border-gray-700' : 'bg-gray-50 text-gray-900 border-gray-300'}`}>
            <div className="flex flex-col h-full">
                <header className={`flex items-center justify-between px-4 py-2 flex-shrink-0 ${isDark ? 'bg-gray-900' : 'bg-white border-b border-gray-200'}`}>
                    <div className="flex items-center gap-3 min-w-0">
                        <h3 className="font-bold truncate" title={title}>{title}</h3>
                        {selectedModule && (
                             <div className={`flex items-center text-xs border rounded-md p-0.5 flex-shrink-0 ${isDark ? 'border-gray-700' : 'border-gray-300'}`}>
                                {tabBtn('dsl', '모듈(DSL)')}
                                {tabBtn('code', '코드(Python)')}
                                {tabBtn('terminal', '터미널')}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center">
                        <button
                            onClick={(e) => { e.stopPropagation(); onClose(); }}
                            className={`p-1 rounded-md ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}
                        >
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>
                </header>

                {selectedModule ? (
                    <main className={`flex-grow flex flex-col overflow-hidden ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
                        {activeTab === 'dsl' ? (
                            <div className="flex flex-col h-full">
                                {editable ? (
                                    <>
                                        <div className={`px-3 py-1.5 text-xs flex-shrink-0 ${isDark ? 'text-gray-400 bg-gray-800' : 'text-gray-500 bg-gray-100'}`}>
                                            모듈의 DSL 코드를 편집하고 <span className="font-semibold">[적용]</span>을 누르면 모듈 파라미터에 반영됩니다.
                                        </div>
                                        <textarea
                                            ref={textareaRef}
                                            value={dslText}
                                            onChange={handleDslChange}
                                            spellCheck={false}
                                            className={`flex-grow w-full p-2 font-mono text-sm resize-none outline-none ${isDark ? 'bg-gray-900 text-cyan-300' : 'bg-white text-cyan-700'}`}
                                        />
                                        {/* 인라인 에러 */}
                                        {dslErrors.length > 0 && (
                                            <div className="px-3 py-2 text-xs text-red-100 bg-red-700/90 flex-shrink-0 max-h-28 overflow-auto">
                                                {dslErrors.map((er, i) => <div key={i}>⚠ {er}</div>)}
                                            </div>
                                        )}
                                        {/* 흐름 경고(차단 아님) */}
                                        {dslErrors.length === 0 && dslWarnings.length > 0 && (
                                            <div className="px-3 py-2 text-xs text-amber-900 bg-amber-200/90 flex-shrink-0 max-h-28 overflow-auto">
                                                {dslWarnings.map((w, i) => <div key={i}>· {w.message}</div>)}
                                            </div>
                                        )}
                                        <div className={`flex items-center gap-2 px-3 py-2 flex-shrink-0 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                                            <button
                                                onClick={handleApply}
                                                disabled={!onApplyModuleDSL}
                                                className={`px-3 py-1 rounded-md text-sm font-medium ${onApplyModuleDSL ? 'bg-cyan-600 hover:bg-cyan-500 text-white' : 'bg-gray-400 text-gray-200 cursor-not-allowed'}`}
                                            >적용</button>
                                            <button
                                                onClick={handleRevert}
                                                className={`px-3 py-1 rounded-md text-sm ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                                            >되돌리기</button>
                                            {editingRef.current && !applied && (
                                                <span className="text-xs text-amber-500">● 미적용 변경</span>
                                            )}
                                            {applied && (
                                                <span className="text-xs text-green-500">✓ 적용됨</span>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className={`flex-grow p-4 flex items-center justify-center text-center text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                        이 모듈은 코드(DSL) 편집을 지원하지 않습니다.<br />
                                        (계산 모듈에서만 DSL 편집이 가능합니다)
                                    </div>
                                )}
                            </div>
                        ) : activeTab === 'code' ? (
                            <pre className={`flex-grow p-2 overflow-auto font-mono text-sm whitespace-pre-wrap ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
                                <code>{code}</code>
                            </pre>
                        ) : (
                            <div className={`flex-grow p-2 overflow-auto font-mono text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {terminalOutput.length > 0 ? terminalOutput.map((line, index) => (
                                    <div key={index} className={`flex ${line.includes('ERROR') ? 'text-red-500' : (line.includes('SUCCESS') ? 'text-green-600' : '')}`}>
                                        <span className="flex-shrink-0 mr-2">{'>'}</span>
                                        <pre className="whitespace-pre-wrap flex-1">{line}</pre>
                                    </div>
                                )) : <div>Ready. Run the module to see output.</div>}
                            </div>
                        )}
                    </main>
                ) : (
                     <main className={`flex-grow p-4 flex items-center justify-center overflow-auto font-sans ${isDark ? 'bg-gray-900 text-gray-500' : 'bg-gray-50 text-gray-400'}`}>
                        Select a module in the canvas to view its details.
                    </main>
                )}
            </div>
        </div>
    );
};
