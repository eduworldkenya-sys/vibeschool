import { Suspense, type ReactNode } from 'react'
import PathwaysRouteTelemetry from '@/components/pathways/PathwaysRouteTelemetry'

export default function PathwaysLayout({ children }: { children: ReactNode }) {
  return <>
    <Suspense fallback={null}>
      <PathwaysRouteTelemetry />
    </Suspense>
    {children}
  </>
}
