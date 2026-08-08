import { createContext, useContext, useEffect, useState, useCallback } from "react";

const ThemeContext = createContext(null);

const THEME_KEY = "cseaiml-theme";       // 'dark' | 'light'
const FONT_KEY  = "cseaiml-font-size";   // 'sm' | 'base' | 'lg'

const FONT_SCALES = {
  sm:   0.9,
  base: 1,
  lg:   1.125,
};

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem(THEME_KEY) || "dark"; // dark stays the default for existing users
  });

  const [fontSize, setFontSize] = useState(() => {
    return localStorage.getItem(FONT_KEY) || "base";
  });

  // Apply theme class to <html> whenever it changes
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // Apply font scale to <html> whenever it changes
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--app-font-scale",
      FONT_SCALES[fontSize] ?? 1
    );
    localStorage.setItem(FONT_KEY, fontSize);
  }, [fontSize]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  const value = {
    theme,
    setTheme,
    toggleTheme,
    isDark: theme === "dark",
    fontSize,
    setFontSize,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}