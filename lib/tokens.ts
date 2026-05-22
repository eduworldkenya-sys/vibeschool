export const TOKENS = {
  // Emotional Temperature Scale (Warm & Intentional)
  bgDefault: "#fafaf8",      // Warm off-white home feel
  bgCard: "#ffffff",
  textPrimary: "#1e293b",
  textMuted: "#64748b",
  borderDefault: "#e2e8f0",
  linkBlue: "#2563eb",
  danger: "#ef4444",
  warning: "#d97706",
  success: "#10b981",
  
  // Custom Status Palette
  overdueBg: "#fff1f0",      // Dusty rose
  overdueText: "#cf1322",
  overdueBorder: "#ffccc7",
  
  pendingBg: "#fffdf7",      // Cream
  pendingText: "#d46b08",
  pendingBorder: "#ffe7ba",
  
  completedBg: "#f0faf4",    // Sage green
  completedText: "#389e0d",
  completedBorder: "#b7eb8f",
  
  radiusCard: "24px",
  
  // High-Fidelity Font Pairings
  fontHeader: "var(--font-fraunces), Georgia, serif",
  fontBody: "var(--font-inter), system-ui, sans-serif",
  fontFamily: "var(--font-inter), system-ui, sans-serif"
} as const;

export const ROUTES = {
  homeworkList: "/parent/learn/homework",
  homeworkDetail: (id: string) => `/parent/learn/homework/${id}`
} as const;
