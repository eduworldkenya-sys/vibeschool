/** Canonical VibeSchool support WhatsApp destination. Phone digits must not be rendered as page copy. */
export const OFFICIAL_WHATSAPP_NUMBER = '254720614664'

export function officialWhatsAppHref(message: string): string {
  return `https://wa.me/${OFFICIAL_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}
