/** Share only canonical private gift links, retaining the complete fragment. */
export function giftWhatsAppUrl(link: string, candidate?: string, sender?: string): string | null {
  if (!/^https:\/\/vibeschool\.co\.ke\/success-wishes\/(?:gift|invitation)#token=[a-f0-9]{64}$/.test(link)) return null
  return 'https://wa.me/?text=' + encodeURIComponent(giftShareMessage(link, candidate, sender))
}

export function giftShareMessage(link: string, candidate?: string, sender?: string): string {
  const to = candidate?.trim()
  const from = sender?.trim()
  const names = from && to ? `From ${from} to ${to}` : to ? `For ${to}` : from ? `From ${from}` : ''
  return ['Success Wishes 2026', names, '', 'Open your card:', link].filter((line, index) => line !== '' || index === 2).join('\n')
}
