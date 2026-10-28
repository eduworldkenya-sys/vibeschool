/** Share only canonical private gift links, retaining the complete fragment. */
export function giftWhatsAppUrl(link: string): string | null {
  if (!/^https:\/\/vibeschool\.co\.ke\/success-wishes\/(?:gift|invitation)#token=[a-f0-9]{64}$/.test(link)) return null
  return 'https://wa.me/?text=' + encodeURIComponent('A special Success Wish is waiting for you. Open your private card: ' + link)
}
