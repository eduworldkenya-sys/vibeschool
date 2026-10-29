/** Share only canonical private gift links, retaining the complete fragment. */
export function giftWhatsAppUrl(link: string, candidate?: string): string | null {
  if (!/^https:\/\/vibeschool\.co\.ke\/success-wishes\/(?:gift|invitation)#token=[a-f0-9]{64}$/.test(link)) return null
  return 'https://wa.me/?text=' + encodeURIComponent(giftShareMessage(link, candidate))
}

export function giftShareMessage(link: string, candidate?: string): string {
  return candidate?.trim()
    ? `${candidate.trim()}, I made you a success card 💛\nOpen your wish here: ${link}`
    : 'A special Success Wish is waiting for you. Open your private card: ' + link
}
