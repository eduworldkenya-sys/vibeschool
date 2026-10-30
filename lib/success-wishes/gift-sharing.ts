/** Share only canonical private gift links, retaining the complete fragment. */
export function giftWhatsAppUrl(link: string, candidate?: string, sender?: string, recipientPhone?: string): string | null {
  if (!/^https:\/\/vibeschool\.co\.ke\/success-wishes\/(?:gift|invitation)#token=[a-f0-9]{64}$/.test(link)) return null
  const digits = recipientPhone?.replace(/\D/g, '') || ''
  const kenyan = /^(?:0[17]\d{8}|254[17]\d{8}|[17]\d{8})$/.test(digits)
  const destination = kenyan ? digits.startsWith('0') ? '254' + digits.slice(1) : digits.length === 9 ? '254' + digits : digits : ''
  return 'https://wa.me/' + destination + '?text=' + encodeURIComponent(giftShareMessage(link, candidate, sender))
}

export function giftShareMessage(link: string, candidate?: string, sender?: string): string {
  const to = candidate?.trim()
  const from = sender?.trim()
  const names = from && to ? `From ${from} to ${to}` : to ? `For ${to}` : from ? `From ${from}` : ''
  return ['Success Wishes 2026', names, '', 'Open your card:', link].filter((line, index) => line !== '' || index === 2).join('\n')
}
