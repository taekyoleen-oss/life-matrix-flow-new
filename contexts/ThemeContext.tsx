import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark';
    // 1) URL 쿼리 (InsureAutoFlow_Web 앱 실행 페이지에서 iframe으로 불러올 때 ?theme= 전달)
    const params = new URLSearchParams(window.location.search);
    const urlTheme = params.get('theme');
    if (urlTheme === 'light' || urlTheme === 'dark') return urlTheme as Theme;
    // 2) localStorage
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved as Theme;
    // 3) 시스템 설정
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
    if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light';
    return 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', theme);
    }
  }, [theme]);

  // InsureAutoFlow_Web 앱 실행 페이지에서 postMessage로 테마 전달 시 적용 (리로드 없이 연동)
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type !== 'INSURE_AUTO_FLOW_THEME') return;
      const next = e.data.theme;
      if (next === 'light' || next === 'dark') setTheme(next);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
