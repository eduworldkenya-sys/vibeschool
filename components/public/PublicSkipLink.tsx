'use client'

/**
 * Keyboard-accessible skip link. Native fragment navigation is kept for
 * pre-hydration use. Once hydrated, explicitly move focus to the main landmark
 * as well: browser/Next hydration must not swallow Enter on the first tab stop.
 */
export function PublicSkipLink({ className, children }: { className: string; children: string }) {
  const skip = () => {
    const main = document.getElementById('main-content')
    if (!main) return
    if (window.location.hash !== '#main-content') window.location.hash = 'main-content'
    main.focus({ preventScroll: true })
    main.scrollIntoView({ block: 'start', behavior: 'auto' })
  }
  return <a href="#main-content" className={className} onClick={skip}>{children}</a>
}
