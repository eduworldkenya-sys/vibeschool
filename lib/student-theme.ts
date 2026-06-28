// lib/student-theme.ts
// Student theme management — light / dark / auto
// Eye-doctor standard: true AMOLED dark, soft light, no harsh whites

export type StudentTheme = "light" | "dark" | "auto"

const THEME_KEY = "vs_student_theme_v1"

export const STUDENT_THEMES = {
  light: {
    bg:          "#F7F5FF",
    surface:     "#FFFFFF",
    border:      "#E5E3F5",
    textPrimary: "#1C1A2E",
    textMuted:   "#6B6880",
    accent:      "#5B4EE8",
    accentSoft:  "#EDE9FE",
    success:     "#059669",
    warning:     "#D97706",
    error:       "#DC2626",
    card:        "#FFFFFF",
    navBg:       "#FFFFFF",
    navBorder:   "#E5E3F5",
  },
  dark: {
    bg:          "#0F0F1A",
    surface:     "#1A1A2E",
    border:      "#2D2D4E",
    textPrimary: "#F0EFFF",
    textMuted:   "#9090B0",
    accent:      "#7C6EF8",
    accentSoft:  "#1E1A3E",
    success:     "#34D399",
    warning:     "#FBBF24",
    error:       "#F87171",
    card:        "#1A1A2E",
    navBg:       "#0F0F1A",
    navBorder:   "#2D2D4E",
  },
} as const

export function readTheme(): StudentTheme {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === "light" || stored === "dark" || stored === "auto") return stored
  } catch {}
  return "auto"
}

export function writeTheme(theme: StudentTheme): void {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {}
}

export function resolveTheme(theme: StudentTheme): "light" | "dark" {
  if (theme === "auto") {
    if (typeof window === "undefined") return "dark"
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  }
  return theme
}
