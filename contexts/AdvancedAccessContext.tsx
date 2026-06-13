import React, {
  createContext,
  useContext,
  useState,
  useCallback,
} from "react";
import { AdvancedUnlockModal } from "../components/AdvancedUnlockModal";

const STORAGE_KEY = "lmf_advanced_unlocked";

/** 빌드 시 주입된 고급기능 비밀번호 (vite.config.ts define). 미설정 시 빈 문자열. */
const ADVANCED_PASSWORD = (import.meta as any).env?.VITE_ADVANCED_PASSWORD ?? "";

interface AdvancedAccessContextType {
  /** 고급기능 잠금 해제 여부 */
  isUnlocked: boolean;
  /** 비밀번호가 빌드에 설정되어 있는지 */
  passwordConfigured: boolean;
  /** 비밀번호 검증 후 해제. 성공 시 true */
  unlock: (password: string) => boolean;
  /** 다시 잠그기 */
  lock: () => void;
  /** 잠금 해제 모달 열기 */
  openUnlockModal: () => void;
}

const AdvancedAccessContext = createContext<AdvancedAccessContextType | undefined>(
  undefined
);

export const AdvancedAccessProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [isModalOpen, setIsModalOpen] = useState(false);

  const passwordConfigured = ADVANCED_PASSWORD.length > 0;

  const unlock = useCallback((password: string): boolean => {
    if (!passwordConfigured) return false;
    if (password === ADVANCED_PASSWORD) {
      setIsUnlocked(true);
      try {
        localStorage.setItem(STORAGE_KEY, "1");
      } catch {
        /* localStorage 불가 환경 무시 */
      }
      setIsModalOpen(false);
      return true;
    }
    return false;
  }, [passwordConfigured]);

  const lock = useCallback(() => {
    setIsUnlocked(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* 무시 */
    }
    setIsModalOpen(false);
  }, []);

  const openUnlockModal = useCallback(() => setIsModalOpen(true), []);

  return (
    <AdvancedAccessContext.Provider
      value={{ isUnlocked, passwordConfigured, unlock, lock, openUnlockModal }}
    >
      {children}
      <AdvancedUnlockModal
        isOpen={isModalOpen}
        isUnlocked={isUnlocked}
        passwordConfigured={passwordConfigured}
        onClose={() => setIsModalOpen(false)}
        onUnlock={unlock}
        onLock={lock}
      />
    </AdvancedAccessContext.Provider>
  );
};

export const useAdvancedAccess = (): AdvancedAccessContextType => {
  const ctx = useContext(AdvancedAccessContext);
  if (!ctx) {
    throw new Error("useAdvancedAccess must be used within AdvancedAccessProvider");
  }
  return ctx;
};
