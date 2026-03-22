import React, { useState, useEffect } from 'react';
import { CanvasModule } from '../types';
import { XMarkIcon } from './icons';
import { getModuleCode } from '../codeSnippets';
import { useTheme } from '../contexts/ThemeContext';

interface CodeTerminalPanelProps {
    selectedModule: CanvasModule | null;
    terminalOutput: string[];
    isVisible: boolean;
    onClose: () => void;
}

export const CodeTerminalPanel: React.FC<CodeTerminalPanelProps> = ({ selectedModule, terminalOutput, isVisible, onClose }) => {
    const [activeTab, setActiveTab] = useState<'code' | 'terminal'>('code');
    const [code, setCode] = useState('');
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    useEffect(() => {
        if (selectedModule) {
            setCode(getModuleCode(selectedModule));
        } else {
            setCode('# Select a module to see its code.');
        }
    }, [selectedModule]);

    useEffect(() => {
        if (selectedModule && terminalOutput.some(line => line.includes('ERROR'))) {
            setActiveTab('terminal');
        }
    }, [selectedModule, terminalOutput]);

    if (!isVisible) {
        return null;
    }

    const title = selectedModule ? `${selectedModule.name}` : 'No Module Selected';

    return (
        <div className={`w-[450px] flex-shrink-0 border-l ${isDark ? 'bg-gray-800 text-white border-gray-700' : 'bg-gray-50 text-gray-900 border-gray-300'}`}>
            <div className="flex flex-col h-full">
                <header className={`flex items-center justify-between px-4 py-2 flex-shrink-0 ${isDark ? 'bg-gray-900' : 'bg-white border-b border-gray-200'}`}>
                    <div className="flex items-center gap-4 min-w-0">
                        <h3 className="font-bold truncate" title={title}>{title}</h3>
                        {selectedModule && (
                             <div className={`flex items-center text-sm border rounded-md p-0.5 flex-shrink-0 ${isDark ? 'border-gray-700' : 'border-gray-300'}`}>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setActiveTab('code'); }}
                                    className={`px-3 py-0.5 rounded-sm ${activeTab === 'code' ? (isDark ? 'bg-gray-600' : 'bg-gray-200') : (isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100')}`}
                                >Code</button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setActiveTab('terminal'); }}
                                    className={`px-3 py-0.5 rounded-sm ${activeTab === 'terminal' ? (isDark ? 'bg-gray-600' : 'bg-gray-200') : (isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100')}`}
                                >Terminal</button>
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
                    <main className={`flex-grow p-2 overflow-auto font-mono text-sm ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
                        {activeTab === 'code' ? (
                            <pre className={`whitespace-pre-wrap ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
                                <code>{code}</code>
                            </pre>
                        ) : (
                            <div className={isDark ? 'text-gray-300' : 'text-gray-700'}>
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
