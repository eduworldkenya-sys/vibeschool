'use client'

import { useEffect, useState } from 'react'
import { generateInsight } from '@/lib/reports/aiInsights'

interface AIInsightBannerProps {
  reportType: string
  data: unknown[]
}

export default function AIInsightBanner({ reportType, data }: AIInsightBannerProps) {
  const [insight, setInsight] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!data || data.length === 0) {
      setInsight('No data available for analysis.')
      setLoading(false)
      return
    }
    setLoading(true)
    generateInsight(reportType, data)
      .then(setInsight)
      .finally(() => setLoading(false))
  }, [reportType, data])

  return (
    <div className="w-full rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 flex items-start gap-3">
      <span className="text-xl mt-0.5">🤖</span>
      <div className="flex-1">
        <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-0.5">
          AI Insight
        </p>
        {loading ? (
          <div className="h-4 w-2/3 rounded bg-amber-500/20 animate-pulse" />
        ) : (
          <p className="text-sm text-amber-100">{insight}</p>
        )}
      </div>
    </div>
  )
}