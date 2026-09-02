'use client'

import Script from 'next/script'
import { useEffect, useRef } from 'react'

const GOOGLE_PREFERRED_SOURCE_SCRIPT = 'https://news.google.com/swg/js/v1/publisher.js'
const VIBESCHOOL_DOMAIN = 'vibeschool.co.ke'
export const VIBESCHOOL_PREFERRED_SOURCE_DEEPLINK = `https://www.google.com/preferences/source?q=${VIBESCHOOL_DOMAIN}`

type PreferredSourceButtonProps = {
  theme?: 'light' | 'dark'
  placement?: 'article-header' | 'article-footer' | 'blog-home'
}

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>
  }
}

export function PreferredSourceButton({ theme = 'light', placement = 'article-footer' }: PreferredSourceButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const recordClick = () => {
      window.dataLayer?.push({
        event: 'preferred_source_click',
        preferred_source_domain: VIBESCHOOL_DOMAIN,
        preferred_source_placement: placement,
      })
    }

    container.addEventListener('click', recordClick, { capture: true })
    return () => container.removeEventListener('click', recordClick, { capture: true })
  }, [placement])

  return (
    <>
      <Script src={GOOGLE_PREFERRED_SOURCE_SCRIPT} strategy="afterInteractive" />
      <div
        ref={containerRef}
        google-add-preferred-source-btn=""
        data-theme={theme}
        data-lang="en"
        data-placement={placement}
      />
    </>
  )
}
