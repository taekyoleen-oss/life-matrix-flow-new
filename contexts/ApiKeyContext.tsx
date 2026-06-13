import React, {
  createContext,
  useContext,
  useState,
  useCallback,
} from "react";
import { GoogleGenAI } from "@google/genai";
import {
  getStoredKey,
  setStoredKey,
  clearStoredKey,
} from "../utils/apiKey";
import { ApiKeyModal } from "../components/ApiKeyModal";

interface ApiKeyContextType {
  apiKey: string;
  hasKey: boolean;
  setKey: (key: string) => void;
  clearKey: () => void;
  openKeyModal: () => void;
  /** 키 있으면 GoogleGenAI 클라이언트 반환, 없으면 키 모달을 열고 null 반환. */
  ensureClient: () => GoogleGenAI | null;
}

const ApiKeyContext = createContext<ApiKeyContextType | undefined>(undefined);

export const ApiKeyProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [apiKey, setApiKeyState] = useState<string>(() => getStoredKey());
  const [isModalOpen, setIsModalOpen] = useState(false);

  const setKey = useCallback((key: string) => {
    const trimmed = key.trim();
    setStoredKey(trimmed);
    setApiKeyState(trimmed);
  }, []);

  const clearKey = useCallback(() => {
    clearStoredKey();
    setApiKeyState("");
  }, []);

  const openKeyModal = useCallback(() => setIsModalOpen(true), []);

  const ensureClient = useCallback((): GoogleGenAI | null => {
    if (!apiKey) {
      setIsModalOpen(true);
      return null;
    }
    return new GoogleGenAI({ apiKey });
  }, [apiKey]);

  return (
    <ApiKeyContext.Provider
      value={{
        apiKey,
        hasKey: !!apiKey,
        setKey,
        clearKey,
        openKeyModal,
        ensureClient,
      }}
    >
      {children}
      <ApiKeyModal
        isOpen={isModalOpen}
        currentKey={apiKey}
        onClose={() => setIsModalOpen(false)}
        onSave={(k) => {
          setKey(k);
          setIsModalOpen(false);
        }}
        onClear={clearKey}
      />
    </ApiKeyContext.Provider>
  );
};

export const useApiKey = (): ApiKeyContextType => {
  const ctx = useContext(ApiKeyContext);
  if (!ctx) {
    throw new Error("useApiKey must be used within ApiKeyProvider");
  }
  return ctx;
};
