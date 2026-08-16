'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { recordPathwaysEvent } from '@/lib/pathways/telemetry'

export default function PathwaysRouteTelemetry() {
  const pathname = usePathname()
  const params = useSearchParams()

  useEffect(() => {
    const source = params.get('utm_source') ?? params.get('source') ?? undefined
    const campaign = params.get('utm_campaign') ?? undefined
    const event = pathname === '/pathways' ? 'pathways_landing_viewed' : 'pathways_returned'
    void recordPathwaysEvent(event, { route: pathname, source, campaign })
  }, [pathname, params])

  return null
}
