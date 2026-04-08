import React, { useState } from 'react';
import { XCircleIcon, SparklesIcon } from './icons';

interface AIPipelineFromGoalModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (goal: string) => void;
}

const EXAMPLES = [
    {
        label: '종신보험 순보험료',
        text: '30세 남성, 20년납, 종신보험, 이율 2.5% 기준으로 순보험료와 영업보험료를 산출해주세요. 부가보험료율은 5%로 설정합니다.',
    },
    {
        label: '정기보험 (10년납)',
        text: '40세 여성, 10년납 10년만기 정기보험, 이율 3.0% 기준으로 순보험료를 산출하고 준비금도 계산해주세요.',
    },
    {
        label: '암보험 (20년만기)',
        text: '35세 남성, 20년납 20년만기 암보험, 이율 2.0% 기준으로 순보험료를 산출해주세요. 위험률은 성별/나이별로 적용합니다.',
    },
    {
        label: '연금보험 (연금개시 65세)',
        text: '45세 여성, 20년납, 65세 연금개시 연금보험, 이율 2.5% 기준으로 순보험료를 산출해주세요. 생존급부 위주로 파이프라인을 구성해주세요.',
    },
    {
        label: '요율 보정 포함 종신보험',
        text: '30세 남성, 20년납 종신보험, 이율 2.5%이며 위험률 보정 계수 1.2를 적용한 순보험료와 영업보험료를 산출해주세요.',
    },
    {
        label: '시나리오 비교 (나이별)',
        text: '30세~50세 남성, 20년납 종신보험, 이율 2.5% 기준으로 가입연령별 순보험료를 비교 산출해주세요.',
    },
];

export const AIPipelineFromGoalModal: React.FC<AIPipelineFromGoalModalProps> = ({ isOpen, onClose, onSubmit }) => {
    const [goal, setGoal] = useState('');
    const [selectedExample, setSelectedExample] = useState<number | null>(null);

    const handleSelectExample = (index: number) => {
        setSelectedExample(index);
        setGoal(EXAMPLES[index].text);
    };

    const handleSubmit = () => {
        if (goal.trim()) {
            onSubmit(goal);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-40"
            onClick={onClose}
        >
            <div
                className="bg-gray-800 text-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <header className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <SparklesIcon className="w-6 h-6 text-purple-400" />
                        AI로 파이프라인 생성하기
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
                        <XCircleIcon className="w-6 h-6" />
                    </button>
                </header>
                <main className="p-6 overflow-y-auto flex-1">
                    <p className="text-gray-400 mb-3">
                        산출하고자 하는 보험료 조건을 설명해주세요. AI가 조건에 맞는 보험료 산출 파이프라인을 자동으로 생성해 드립니다.
                    </p>

                    {/* 예시 선택 버튼 */}
                    <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">예시 선택 (클릭하면 아래에 채워집니다)</p>
                        <div className="flex flex-wrap gap-2">
                            {EXAMPLES.map((ex, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleSelectExample(i)}
                                    className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                                        selectedExample === i
                                            ? 'bg-purple-600 border-purple-500 text-white'
                                            : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 hover:border-gray-500'
                                    }`}
                                >
                                    {ex.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <textarea
                        value={goal}
                        onChange={(e) => {
                            setGoal(e.target.value);
                            setSelectedExample(null);
                        }}
                        placeholder="예: 30세 남성, 20년납, 종신보험, 이율 2.5% 기준으로 순보험료와 영업보험료 산출"
                        className="w-full h-36 p-3 bg-gray-900 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-200 resize-none"
                        autoFocus
                    />
                    <p className="text-xs text-gray-500 mt-2">
                        예시를 선택한 후 내용을 자유롭게 수정하여 사용할 수 있습니다.
                    </p>
                </main>
                <footer className="flex justify-end p-4 bg-gray-900 rounded-b-lg flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-semibold text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-md mr-2"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!goal.trim()}
                        className="px-4 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed rounded-md"
                    >
                        파이프라인 생성
                    </button>
                </footer>
            </div>
        </div>
    );
};
