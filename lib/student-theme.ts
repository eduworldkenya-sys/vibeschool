// lib/student-theme.ts
// Student theme management — light / dark / auto
// Learner-wide green palette shared with Student Learn; preserve explicit light/dark choice

export type StudentTheme = "light" | "dark" | "auto"

const THEME_KEY = "vs_student_theme_v1"

export const STUDENT_THEMES = {
  light: {
    bg: "#f5f8f6", surface: "#ffffff", border: "#dce9de",
    textPrimary: "#1b4030", textMuted: "#597563",
    accent: "#166d49", accentSoft: "#eef7f0",
    success: "#168153", warning: "#a45a11", error: "#b93434",
    card: "#ffffff", navBg: "#ffffff", navBorder: "#dce9de",
  },
  dark: {
    bg: "#101d16", surface: "#1b2c21", border: "#355542",
    textPrimary: "#ebf6ee", textMuted: "#b1cfba",
    accent: "#79dbaa", accentSoft: "#254332",
    success: "#79dbaa", warning: "#fbbf74", error: "#ff9c9c",
    card: "#1b2c21", navBg: "#1b2c21", navBorder: "#355542",
  },
} as const

export function readTheme(): StudentTheme {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === "light" || stored === "dark" || stored === "auto") return stored
  } catch {}
  return "light"
}

export function writeTheme(theme: StudentTheme): void {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {}
}

export function resolveTheme(theme: StudentTheme): "light" | "dark" {
  if (theme === "auto") {
    if (typeof window === "undefined") return "light"
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  }
  return theme
}
