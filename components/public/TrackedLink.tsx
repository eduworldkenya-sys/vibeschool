'use client'

import Link from 'next/link'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { trackPublicEvent, type PublicEventName } from '@/lib/publicTelemetry'

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string
  event: PublicEventName
  children: ReactNode
  external?: boolean
}

export function TrackedLink({ href,event,children,external=false,onClick,...rest }:Props) {
  const click: AnchorHTMLAttributes<HTMLAnchorElement>['onClick'] = e => {
    trackPublicEvent(event)
    onClick?.(e)
  }
  if (external) return <a href={href} data-vs-tracked="true" onClick={click} {...rest}>{children}</a>
  return <Link href={href} data-vs-tracked="true" onClick={click} {...rest}>{children}</Link>
}
