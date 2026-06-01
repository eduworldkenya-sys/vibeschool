'use client'

import React from 'react'

interface SkeletonGridProps {
  count?: number
}

export function SkeletonGrid({ count = 4 }: SkeletonGridProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, width: '100%' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          height: 150, borderRadius: 16,
          backgroundColor: '#1a2235',
          backgroundImage: 'linear-gradient(90deg,#1a2235 25%,#243044 50%,#1a2235 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s infinite linear',
          border: '1px solid rgba(255,255,255,0.06)',
        }} />
      ))}
    </div>
  )
}
