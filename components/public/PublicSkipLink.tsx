'use client'

import type { MouseEvent, KeyboardEvent } from 'react'

/**
 * Use a native fragment for pre-hydration access and explicitly handle both
 * keyboard and pointer activation after hydration. This keeps the skip target
 * and focus stable when App Router's client navigation is mounting.
 */
export function PublicSkipLink({ className, children }: { className: string; children: string }) {
  const skip = () => {
    const main = document.getElementById('main-content')
    if (!main) {
      window.location.hash = 'main-content'
      return
    }
    // Use history API for deterministic fragment navigation even when the
    // browser's synthetic link click is intercepted during hydration.
    if (window.location.hash !== '#main-content') {
      window.history.pushState(null, '', '#main-content')
    }
    main.focus({ preventScroll: true })
    main.scrollIntoView({ block: 'start', behavior: 'auto' })
  }
  const click = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    skip()
  }
  const keyDown = (event: KeyboardEvent<HTMLAnchorElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    skip()
  }
  return <a href="#main-content" className={className} onClick={click} onKeyDown={keyDown}>{children}</a>
}
