
import React from 'react';
import { CanvasModule } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface ModuleOutputSummaryProps {
    module: CanvasModule;
    }

const Stat: React.FC<{ label: string; value: string | number; theme: 'light' | 'dark' }> = ({ label, value, theme }) => (
    <div className="flex items-baseline justify-between w-full gap-2">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider truncate shrink-0">{label}</span>
        <span className={`font-mono text-xl font-black truncate leading-none ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>{value}</span>
    </div>
);

const formatNum = (num: unknown, maxDecimals: number) => {
    if (typeof num !== 'number') return String(num);
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: maxDecimals }).format(num);
};

export const ModuleOutputSummary: React.FC<ModuleOutputSummaryProps> = ({ module }) => {
    const { theme } = useTheme();
    if (!module.outputData) return <div className="flex items-center justify-center h-full text-xs text-gray-600 italic">No Output</div>;

    const renderContent = () => {
        switch (module.outputData.type) {
            case 'DataPreview':
                return <div className="flex flex-col gap-1 w-full">
                    <Stat label="Rows" value={module.outputData.totalRowCount.toLocaleString()} theme={theme} />
                    <Stat label="Cols" value={module.outputData.columns.length} theme={theme} />
                </div>;
            case 'PolicyInfoOutput':
                 return <div className="flex flex-col gap-1 w-full">
                    <Stat label="Age" value={module.outputData.entryAge} theme={theme} />
                    <Stat label="Term" value={module.outputData.policyTerm} theme={theme} />
                </div>;
            case 'PremiumComponentOutput':
                return <div className="flex items-center justify-center h-full w-full">
                    <span className="text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors cursor-pointer">
                        Click (Output)
                    </span>
                </div>;
             case 'NetPremiumOutput':
                 return <div className="flex flex-col justify-center h-full w-full">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center mb-0.5">Net Premium</span>
                    <span className={`font-mono text-2xl font-black truncate text-center leading-tight ${theme === 'light' ? 'text-green-700' : 'text-green-400'}`}>{formatNum(module.outputData.netPremium, 2)}</span>
                 </div>;
             case 'GrossPremiumOutput':
                 return <div className="flex flex-col justify-center h-full w-full">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center mb-0.5">Gross Premium</span>
                    <span className={`font-mono text-2xl font-black truncate text-center leading-tight ${theme === 'light' ? 'text-green-700' : 'text-green-400'}`}>{formatNum(module.outputData.grossPremium, 2)}</span>
                 </div>;
            case 'ScenarioRunnerOutput':
                return <div className="flex flex-col gap-1 w-full">
                    <Stat label="Scenarios" value={module.outputData.totalRowCount.toLocaleString()} theme={theme} />
                    <Stat label="Cols" value={module.outputData.columns.length} theme={theme} />
                </div>;
            case 'PipelineExplainerOutput':
                return <div className="flex items-center justify-center h-full w-full">
                     <span className="text-sm font-bold text-purple-400 hover:text-purple-300 transition-colors cursor-pointer">
                        Click (Report)
                    </span>
                </div>;
            default:
                return <div className="text-xs text-gray-400 text-center font-semibold">Done</div>;
        }
    }

    return (
        <div className="w-full h-full flex flex-col justify-center p-1">
            {renderContent()}
        </div>
    );
};
