"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { localTheme } from "@/lib/db";

const ThemeContext = createContext({
  dark: false,
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const d = localTheme.getDark();
    setDark(d);
    document.documentElement.classList.toggle("dark", d);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    localTheme.setDark(next);
  };

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
