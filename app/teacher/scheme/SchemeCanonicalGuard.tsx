"use client"

/**
 * Scheme authority is now explicit: opening the page is read-only.
 *
 * The former guard called ensure_scheme_from_curriculum() on navigation and
 * could mutate Scheme state merely by viewing the page. Canonical curriculum
 * commits now happen only through commit_curriculum_scheme() after an explicit
 * teacher action, so this layout guard deliberately has no write side effects.
 */
export function SchemeCanonicalGuard({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
