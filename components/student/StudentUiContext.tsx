"use client"

import { createContext, useContext } from "react"
import type { StudentTheme } from "@/lib/student-theme"

interface ToastCtx {
  showToast: (msg: string) => void
}

const ToastContext = createContext<ToastCtx>({ showToast: () => {} })
export const useToast = () => useContext(ToastContext)

interface ThemeCtx {
  theme: StudentTheme
  setTheme: (theme: StudentTheme) => void
}

const ThemeContext = createContext<ThemeCtx>({ theme: "auto", setTheme: () => {} })
export const useTheme = () => useContext(ThemeContext)

export { ToastContext, ThemeContext }
