'use client'

import { useEffect } from 'react'

/**
 * The anchor remains native and functional before hydration. After hydration,
 * augment it with focus transfer without cancelling fragment navigation.
 */
export function PublicSkipFocus() {
  useEffect(() => {
    const link = document.querySelector<HTMLAnchorElement>('a[data-vs-public-skip]')
    if (!link) return
    const focusTarget = () => {
      const main = document.getElementById('main-content')
      if (!main) return
      window.requestAnimationFrame(() => {
        main.focus({ preventScroll: true })
        main.scrollIntoView({ block: 'start', behavior: 'auto' })
      })
    }
    link.addEventListener('click', focusTarget)
    return () => link.removeEventListener('click', focusTarget)
  }, [])
  return null
}
