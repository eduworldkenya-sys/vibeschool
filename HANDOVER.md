
---

## Student Portal — Theme System

**Theme switching is live.** Students can switch Light / Dark / Auto from their profile page.

**How it works:**
- `lib/student-theme.ts` — defines `StudentTheme = "light" | "dark" | "auto"`, `readTheme()`, `writeTheme()`, `resolveTheme()`
- `app/student/layout.tsx` — exports `useTheme` context hook. CSS vars (`--vs-bg`, `--vs-text`, `--vs-accent` etc) are injected at the layout level and update instantly on theme change.
- `app/student/profile/page.tsx` — theme toggle UI (Light / Dark / Auto buttons)

**Rule for all student pages:**
- ALWAYS use CSS variables, never hardcode colours:
  ```ts
  color: "var(--vs-text)"       // ✓ correct — theme-aware
  color: "#1C1A2E"              // ✗ wrong — breaks dark mode
--vs-bg           page background
--vs-surface      input/subtle background
--vs-card         card background
--vs-border       borders
--vs-text         primary text
--vs-muted        secondary text
--vs-accent       purple primary (#7C6EF8 dark / #5B4EE8 light)
--vs-accent-soft  accent background tint
--vs-success      green
--vs-warning      amber
--vs-error        red
--vs-nav-bg       bottom nav background
--vs-nav-border   bottom nav border
ls HANDOVER.md 2>/dev/null && echo "exists" || echo "not found"
