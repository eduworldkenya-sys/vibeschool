"use client"

interface SkelProps {
  w?:      string
  h?:      number
  radius?: number
  className?: string
}

export default function Skel({ w = "100%", h = 16, radius = 8, className = "" }: SkelProps) {
  return (
    <>
      <div
        className={`animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 ${className}`}
        style={{ width: w, height: h, borderRadius: radius, flexShrink: 0 }}
      />
    </>
  )
}
