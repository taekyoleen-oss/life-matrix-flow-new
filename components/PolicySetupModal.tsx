import React, { useState, useEffect } from 'react';
import { CanvasModule, ModuleType } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface PolicySetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  modules: CanvasModule[];
  onApply: (
    productName: string,
    policyParams: Record<string, any>,
    basicValues: Array<{ name: string; value: number }>
  ) => void;
}

const DEFAULT_POLICY = {
  entryAge: 40,
  gender: 'Male',
  policyTerm: '',
  maturityAge: 0,
  paymentTerm: 20,
  interestRate: 2.5,
};

const DEFAULT_BASIC_VALUES = [
  { name: 'α1', value: 0 },
  { name: 'α2', value: 0 },
  { name: 'β1', value: 0 },
  { name: 'β2', value: 0 },
  { name: 'γ',  value: 0 },
];

export const PolicySetupModal: React.FC<PolicySetupModalProps> = ({
  isOpen,
  onClose,
  productName: initialProductName,
  modules,
  onApply,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [tab, setTab] = useState<'product' | 'policy' | 'expenses'>('product');

  // ── 상품 정보
  const [name, setName] = useState(initialProductName);
  const [description, setDescription] = useState('');

  // ── 증권 기본 정보
  const [policy, setPolicy] = useState({ ...DEFAULT_POLICY });

  // ── 사업비 (α1, α2, β1, β2, γ)
  const [basicValues, setBasicValues] = useState<Array<{ name: string; value: number }>>(
    JSON.parse(JSON.stringify(DEFAULT_BASIC_VALUES))
  );

  // 모달이 열릴 때 캔버스의 현재 값으로 초기화
  useEffect(() => {
    if (!isOpen) return;

    setName(initialProductName);

    const policyModule = modules.find((m) => m.type === ModuleType.DefinePolicyInfo);
    if (policyModule) {
      const p = policyModule.parameters;
      setPolicy({
        entryAge: p.entryAge ?? DEFAULT_POLICY.entryAge,
        gender: p.gender ?? DEFAULT_POLICY.gender,
        policyTerm: p.policyTerm ?? DEFAULT_POLICY.policyTerm,
        maturityAge: p.maturityAge ?? DEFAULT_POLICY.maturityAge,
        paymentTerm: p.paymentTerm ?? DEFAULT_POLICY.paymentTerm,
        interestRate: p.interestRate ?? DEFAULT_POLICY.interestRate,
      });
    } else {
      setPolicy({ ...DEFAULT_POLICY });
    }

    const additionalModule = modules.find((m) => m.type === ModuleType.AdditionalName);
    if (additionalModule && Array.isArray(additionalModule.parameters.basicValues)) {
      setBasicValues(
        JSON.parse(JSON.stringify(additionalModule.parameters.basicValues))
      );
    } else {
      setBasicValues(JSON.parse(JSON.stringify(DEFAULT_BASIC_VALUES)));
    }
  }, [isOpen, initialProductName, modules]);

  const handleApply = () => {
    onApply(name.trim() || 'New Life Product', policy, basicValues);
    onClose();
  };

  if (!isOpen) return null;

  // ── 스타일 헬퍼
  const bg    = isDark ? 'bg-gray-900' : 'bg-white';
  const bdr   = isDark ? 'border-gray-700' : 'border-gray-200';
  const txt   = isDark ? 'text-gray-100' : 'text-gray-900';
  const sub   = isDark ? 'text-gray-400' : 'text-gray-500';
  const card  = isDark ? 'bg-gray-800' : 'bg-gray-50';
  const input = isDark
    ? 'bg-gray-700 border-gray-600 text-gray-100 focus:ring-blue-500'
    : 'bg-white border-gray-300 text-gray-900 focus:ring-blue-500';

  const labelCls = `block text-xs font-medium ${sub} mb-1`;
  const inputCls = `w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 ${input}`;

  const tabs: { key: typeof tab; label: string; icon: string }[] = [
    { key: 'product',  label: '상품 정보',  icon: '🏷️' },
    { key: 'policy',   label: '증권 기본 정보', icon: '📋' },
    { key: 'expenses', label: '사업비 (α, β, γ)', icon: '🔢' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-lg rounded-xl border ${bdr} ${bg} shadow-2xl flex flex-col overflow-hidden`}
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── 헤더 */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${bdr}`}>
          <div className="flex items-center gap-2">
            <span className="text-lg">⚙️</span>
            <h2 className={`text-base font-bold ${txt}`}>상품 정보 설정</h2>
          </div>
          <button
            onClick={onClose}
            className={`p-1 rounded-md ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'} transition-colors text-sm`}
          >
            ✕
          </button>
        </div>

        {/* ── 탭 */}
        <div className={`flex border-b ${bdr}`}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
                tab === t.key
                  ? 'border-b-2 border-blue-500 text-blue-500'
                  : `${sub} hover:${txt}`
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ── 탭 내용 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* 상품 정보 */}
          {tab === 'product' && (
            <div className="space-y-4">
              <div className={`p-3 rounded-lg border ${bdr} ${card}`}>
                <p className={`text-xs ${sub} mb-3`}>
                  보험 상품의 이름과 설명을 입력하세요.
                </p>
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>상품명 *</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={inputCls}
                      placeholder="예: 종신보험 A형"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>설명 (선택)</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      className={`${inputCls} resize-none`}
                      placeholder="예: 남성 40세 기준 종신보험"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 증권 기본 정보 */}
          {tab === 'policy' && (
            <div className="space-y-4">
              <div className={`p-3 rounded-lg border ${bdr} ${card}`}>
                <p className={`text-xs ${sub} mb-3`}>
                  보험 계약의 기본 조건을 입력하세요.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>가입연령 (세)</label>
                    <input
                      type="number"
                      value={policy.entryAge}
                      onChange={(e) => setPolicy({ ...policy, entryAge: Number(e.target.value) || 0 })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>성별</label>
                    <select
                      value={policy.gender}
                      onChange={(e) => setPolicy({ ...policy, gender: e.target.value })}
                      className={inputCls}
                    >
                      <option value="Male">Male (남)</option>
                      <option value="Female">Female (여)</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>보험기간 (년)</label>
                    <input
                      type="number"
                      value={policy.policyTerm || ''}
                      onChange={(e) =>
                        setPolicy({ ...policy, policyTerm: e.target.value === '' ? '' : Number(e.target.value) })
                      }
                      disabled={!!(policy.maturityAge && Number(policy.maturityAge) > 0)}
                      placeholder="Auto (만기연령 기준)"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>만기연령 (세, 선택)</label>
                    <input
                      type="number"
                      value={policy.maturityAge || ''}
                      onChange={(e) =>
                        setPolicy({ ...policy, maturityAge: e.target.value === '' ? 0 : Number(e.target.value) })
                      }
                      placeholder="예: 60"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>납입기간 (년)</label>
                    <input
                      type="number"
                      value={policy.paymentTerm}
                      onChange={(e) => setPolicy({ ...policy, paymentTerm: Number(e.target.value) || 0 })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>이율 (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={policy.interestRate}
                      onChange={(e) => setPolicy({ ...policy, interestRate: Number(e.target.value) || 0 })}
                      className={inputCls}
                    />
                  </div>
                </div>
                {policy.maturityAge && Number(policy.maturityAge) > 0 ? (
                  <p className={`text-xs mt-2 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                    ℹ️ 만기연령이 설정되면 보험기간 = 만기연령 − 가입연령
                  </p>
                ) : (
                  <p className={`text-xs mt-2 ${sub}`}>
                    ℹ️ 보험기간을 비우면 위험률 데이터의 최대 연령에서 자동 산출합니다.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 사업비 (α, β, γ) */}
          {tab === 'expenses' && (
            <div className="space-y-4">
              <div className={`p-3 rounded-lg border ${bdr} ${card}`}>
                <p className={`text-xs ${sub} mb-3`}>
                  순보험료 및 영업보험료 계산에 사용되는 사업비 계수를 입력하세요.
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {basicValues.map((bv, idx) => (
                    <div
                      key={idx}
                      className={`rounded-lg border ${bdr} p-2 flex flex-col gap-2 ${isDark ? 'bg-gray-900/60' : 'bg-white'}`}
                    >
                      <input
                        type="text"
                        value={bv.name}
                        onChange={(e) => {
                          const next = [...basicValues];
                          next[idx] = { ...next[idx], name: e.target.value };
                          setBasicValues(next);
                        }}
                        className={`w-full text-center text-xs rounded border px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 ${isDark ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-gray-100 border-gray-200 text-gray-700'}`}
                        placeholder="이름"
                      />
                      <input
                        type="number"
                        step="0.001"
                        value={bv.value}
                        onChange={(e) => {
                          const next = [...basicValues];
                          next[idx] = { ...next[idx], value: parseFloat(e.target.value) || 0 };
                          setBasicValues(next);
                        }}
                        className={`w-full text-center text-xs font-mono rounded border px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                      />
                    </div>
                  ))}
                </div>
                <p className={`text-xs mt-3 ${sub}`}>
                  ℹ️ 변수명은 순보험료·영업보험료 수식에서 직접 참조됩니다.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── 하단 버튼 */}
        <div className={`flex items-center justify-between px-5 py-3 border-t ${bdr}`}>
          <div className="flex gap-1.5">
            {tabs.map((t, i) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`w-2 h-2 rounded-full transition-colors ${tab === t.key ? 'bg-blue-500' : isDark ? 'bg-gray-600' : 'bg-gray-300'}`}
                title={t.label}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              취소
            </button>
            <button
              onClick={handleApply}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            >
              적용
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
