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
    const activate = () => {
      // Keep the native fragment destination and explicitly focus its landmark.
      // This is resilient when Next.js hydrates around keyboard activation.
      if (window.location.hash !== '#main-content') window.location.hash = 'main-content'
      focusTarget()
    }
    link.addEventListener('click', activate)
    link.dataset.vsSkipReady = 'true'
    return () => {
      link.removeEventListener('click', activate)
      delete link.dataset.vsSkipReady
    }
  }, [])
  return null
}
