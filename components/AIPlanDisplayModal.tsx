import React from 'react';
import { XCircleIcon, SparklesIcon } from './icons';
import { MarkdownRenderer } from './MarkdownRenderer';

interface AIPlanDisplayModalProps {
    isOpen: boolean;
    onClose: () => void;
    plan: string;
    onApply?: () => void;
}

export const AIPlanDisplayModal: React.FC<AIPlanDisplayModalProps> = ({ isOpen, onClose, plan, onApply }) => {
    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50"
            onClick={onClose}
        >
            <div 
                className="bg-white text-gray-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <header className="flex items-center justify-between p-4 border-b border-gray-200">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <SparklesIcon className="w-6 h-6 text-purple-500" />
                        AI Pipeline Generation Plan
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
                        <XCircleIcon className="w-6 h-6" />
                    </button>
                </header>
                <main className="p-6 overflow-y-auto">
                    <MarkdownRenderer text={plan} />
                </main>
                <footer className="flex justify-end gap-2 p-4 bg-gray-50 border-t rounded-b-lg">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md"
                    >
                        닫기
                    </button>
                    {onApply && (
                        <button
                            onClick={onApply}
                            className="px-4 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-md"
                        >
                            이 파이프라인 적용하기
                        </button>
                    )}
                </footer>
            </div>
        </div>
    );
};
