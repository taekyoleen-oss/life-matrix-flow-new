
import React from 'react';
import { CanvasModule, PipelineExplainerOutput } from '../types';
import { XCircleIcon, ClipboardDocumentListIcon } from './icons';
import { TOOLBOX_MODULES } from '../constants';

interface PipelineReportModalProps {
    module: CanvasModule;
    onClose: () => void;
}

export const PipelineReportModal: React.FC<PipelineReportModalProps> = ({ module, onClose }) => {
    const output = module.outputData as PipelineExplainerOutput;
    if (!output || output.type !== 'PipelineExplainerOutput') return null;

    const { steps } = output;

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white text-gray-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0 bg-gray-50 rounded-t-lg print:hidden">
                    <div className="flex items-center gap-2">
                        <ClipboardDocumentListIcon className="w-6 h-6 text-purple-600" />
                        <h2 className="text-xl font-bold text-gray-800">Pipeline Execution Report</h2>
                    </div>
                    <div className="flex items-center gap-2">
                         <button onClick={handlePrint} className="text-gray-600 hover:text-gray-900 px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 text-sm font-medium transition-colors">
                            Print / PDF
                        </button>
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-800 transition-colors">
                            <XCircleIcon className="w-6 h-6" />
                        </button>
                    </div>
                </header>
                <main className="flex-grow p-8 overflow-auto bg-white space-y-8 print:p-0 print:overflow-visible">
                    <div className="text-center border-b pb-6 mb-6">
                        <h1 className="text-2xl font-bold text-gray-900">Calculation Pipeline Report</h1>
                        <p className="text-gray-500 mt-2">Generated on {new Date().toLocaleString()}</p>
                    </div>

                    <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                        {steps.map((step, index) => {
                            const moduleInfo = TOOLBOX_MODULES.find(m => m.type === step.moduleType);
                            const Icon = moduleInfo?.icon || ClipboardDocumentListIcon;

                            return (
                                <div key={index} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                    {/* Icon */}
                                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-300 group-[.is-active]:bg-purple-500 text-slate-500 group-[.is-active]:text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 transition-colors">
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    
                                    {/* Content Card */}
                                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-5 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-center justify-between space-x-2 mb-2">
                                            <div className="font-bold text-slate-900 text-lg">{step.moduleName}</div>
                                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium font-mono">{step.moduleType}</span>
                                        </div>
                                        <div className="text-slate-600 text-sm mb-4 leading-relaxed">{step.description}</div>
                                        
                                        {step.details.length > 0 && (
                                            <div className="bg-slate-50 rounded-md p-3 text-xs space-y-2 border border-slate-100">
                                                {step.details.map((detail, i) => (
                                                    <div key={i} className="flex flex-col sm:flex-row sm:justify-between sm:gap-4 border-b border-slate-200 last:border-0 pb-2 last:pb-0">
                                                        <span className="font-semibold text-slate-600 shrink-0">{detail.label}:</span>
                                                        <span className="font-mono text-slate-800 break-all text-right">{detail.value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {step.auditTable && step.auditTable.rows.length > 0 && (
                                            <div className="mt-3">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide">계산 중간값 (Audit Trail)</span>
                                                    {step.auditTable.totalRows !== undefined && step.auditTable.totalRows > step.auditTable.rows.length && (
                                                        <span className="text-xs text-slate-400">– 처음 {step.auditTable.rows.length}행 / 전체 {step.auditTable.totalRows}행</span>
                                                    )}
                                                </div>
                                                <div className="overflow-x-auto rounded border border-purple-100">
                                                    <table className="min-w-full text-xs">
                                                        <thead className="bg-purple-50">
                                                            <tr>
                                                                {step.auditTable.columns.map((col) => (
                                                                    <th key={col} className="px-2 py-1.5 text-left font-semibold text-purple-700 whitespace-nowrap border-b border-purple-100">{col}</th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {step.auditTable.rows.map((row, ri) => (
                                                                <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-purple-50/40'}>
                                                                    {step.auditTable!.columns.map((col) => (
                                                                        <td key={col} className="px-2 py-1 font-mono text-slate-700 whitespace-nowrap border-b border-purple-50">
                                                                            {row[col] === null || row[col] === undefined
                                                                                ? <i className="text-slate-400">–</i>
                                                                                : typeof row[col] === 'number'
                                                                                    ? row[col].toLocaleString(undefined, { maximumFractionDigits: 4 })
                                                                                    : String(row[col])}
                                                                        </td>
                                                                    ))}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    
                    <div className="text-center pt-8 text-slate-400 text-sm">
                        End of Report
                    </div>
                </main>
            </div>
        </div>
    );
};
