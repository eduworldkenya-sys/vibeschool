export const MINI_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function miniPublicPath(id: string) {
  return '/mini/' + encodeURIComponent(id)
}
export function miniExplorePath(id?: string | null) {
  return id && MINI_ID.test(id) ? '/explore?mini=' + encodeURIComponent(id) : '/explore'
}
export function miniSearchText(value: string) {
  // Restrict PostgREST filter grammar; retain Unicode letters and numbers.
  return value.normalize('NFKC').replace(/[^\p{L}\p{N}\s-]/gu, ' ').trim().replace(/\s+/g, ' ').slice(0,100)
}
