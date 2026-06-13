// Gemini API 키 저장 서비스 (순수 함수 — React 비의존)
// 저장: localStorage(영구). 개발 모드에서만 .env 주입 키를 폴백으로 사용.

const STORAGE_KEY = "gemini_api_key";

/**
 * vite.config.ts의 define이 dev 모드에서만 process.env.API_KEY에 실제 키를,
 * prod 빌드에서는 빈 문자열을 주입한다. (process.env.API_KEY 토큰은 빌드 시 치환됨)
 */
function devFallbackKey(): string {
  try {
    const injected = (process.env.API_KEY as string) || "";
    return import.meta.env.DEV ? injected : "";
  } catch {
    return "";
  }
}

/** 저장된 사용자 키 우선, 없으면 dev 폴백. */
export function getStoredKey(): string {
  if (typeof window !== "undefined") {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) return saved;
  }
  return devFallbackKey();
}

export function setStoredKey(key: string): void {
  if (typeof window === "undefined") return;
  const trimmed = key.trim();
  if (trimmed) {
    window.localStorage.setItem(STORAGE_KEY, trimmed);
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export function clearStoredKey(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

/** UI 표시용 마스킹 (앞 4 + 뒤 4만 노출). */
export function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "••••";
  return `${key.slice(0, 4)}••••••${key.slice(-4)}`;
}
