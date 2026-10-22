'use client'

import { useState } from 'react'
import SuccessCardStudio, { type CardDesignDraft } from './SuccessCardStudio'
import SuccessWishes from './SuccessWishes'

export default function UnifiedSuccessWishes() {
  const [draft, setDraft] = useState<CardDesignDraft | null>(null)
  const [step, setStep] = useState<'design' | 'recipient'>('design')

  if (step === 'design') {
    return <SuccessCardStudio initialDraft={draft || undefined} onContinue={value => { setDraft(value); setStep('recipient') }} onOpenInbox={() => { setDraft(null); setStep('recipient') }} />
  }

  return <SuccessWishes
    initialWish={draft || undefined}
    initialMode={draft ? 'send' : 'inbox'}
    onBackToDesign={() => setStep('design')}
  />
}
